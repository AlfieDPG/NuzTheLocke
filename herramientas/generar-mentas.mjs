// Genera el dibujo de las mentas para los juegos que no las tienen (js/randomizer/dibujos-mentas.js), hecho por
// código: una ramita de cinco hojas y su tallo, como la de Espada y Escudo (la ilustración de PokeAPI/sprites,
// items/*-mint.png, de referencia), en el estilo de los iconos de la GBA: 24 × 24, contorno oscuro, cuatro tonos y
// el nervio claro. Un solo dibujo para todas y una paleta por color (el de cada estadística, como en los juegos).
//
// En la 4.ª generación los iconos son de 32 × 32, con el dibujo de 24 × 24 arriba a la izquierda (como los demás).
//
//   node herramientas/generar-mentas.mjs [vista.png]   (con vista.png, además, una muestra ampliada)

import { writeFileSync } from "node:fs";
import { png } from "./png.mjs";

const W = 24;
// (base, punta, ancho) de cada hoja, de atrás adelante
const HOJAS = [
  [[12.0, 10.0], [15.5, 2.5], 5.0], // arriba, en medio
  [[13.0, 10.5], [21.5, 4.0], 6.0], // arriba a la derecha
  [[11.5, 11.0], [1.0, 5.0], 8.0], // la grande de la izquierda
  [[11.0, 12.5], [12.5, 19.5], 5.5], // la pequeña de abajo
  [[12.5, 11.5], [22.5, 18.5], 8.0] // la grande de abajo a la derecha
];
const TALLO = [[10.5, 13.0], [3.0, 19.5]];

// Índices de la paleta: 0 transparente, 1 contorno, 2 borde de la hoja, 3 la cara oscura, 4 la de la luz, 5 el nervio
const LETRAS = { ".": 0, O: 1, D: 2, M: 3, L: 4, H: 5 };

function dibujo() {
  const g = Array.from({ length: W }, () => new Array(W).fill("."));
  const [[x0, y0], [x1, y1]] = TALLO;
  for (let k = 0; k < 40; k++) {
    const t = k / 39;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    g[y][x] = "M";
    if (t < 0.85) g[y][x + 1] = "D";
  }
  for (const [[bx, by], [tx, ty], ancho] of HOJAS) {
    const largo = Math.hypot(tx - bx, ty - by);
    const [ux, uy] = [(tx - bx) / largo, (ty - by) / largo];
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const [px, py] = [x + 0.5 - bx, y + 0.5 - by];
        const t = (px * ux + py * uy) / largo;
        if (t < 0 || t > 1) continue;
        const d = px * -uy + py * ux; // a un lado de la hoja (+) o al otro (-)
        const w = (ancho / 2) * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.75;
        if (Math.abs(d) > w) continue;
        g[y][x] = Math.abs(d) > w - 0.9 ? "D" : Math.abs(d) < 0.55 && t > 0.12 && t < 0.85 ? "H" : d < 0 ? "L" : "M";
      }
    }
  }
  // El contorno, por fuera
  const lleno = (x, y) => x >= 0 && y >= 0 && x < W && y < W && g[y][x] !== ".";
  return g.map((fila, y) => fila.map((c, x) => (c === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => lleno(x + dx, y + dy)) ? "O" : c)));
}

// Del color base, los cinco tonos (como colorsys.hls_to_rgb)
function hls(h, l, s) {
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  const v = (hue) => {
    hue = ((hue % 1) + 1) % 1;
    if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6;
    if (hue < 0.5) return m2;
    if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
    return m1;
  };
  return s === 0 ? [l, l, l] : [v(h + 1 / 3), v(h), v(h - 1 / 3)];
}
function aHls([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l <= 0.5 ? d / (max + min) : d / (2 - max - min);
  const h = max === R ? ((G - B) / d) / 6 : max === G ? (2 + (B - R) / d) / 6 : (4 + (R - G) / d) / 6;
  return [(h + 1) % 1, l, s];
}
function rampa(base) {
  const [h, , s] = aHls(base);
  const tono = (l, sat = s) => hls(h, l, Math.min(1, sat)).map((v) => Math.round(v * 255));
  return [[0, 0, 0], tono(0.12, s * 0.6), tono(0.3), tono(0.46), tono(0.62), tono(0.82, s * 0.7)];
}

// Los colores de las mentas, por la estadística que suben: Ataque, Defensa, At. Esp., Def. Esp., Velocidad y la Seria
const COLORES = [[226, 64, 64], [64, 80, 220], [70, 200, 240], [236, 104, 170], [80, 190, 80], [200, 180, 110]];

const g = dibujo();
// 4 bits por píxel, en cuadros de 8 × 8 (fila a fila); el píxel de la izquierda, en los 4 bits bajos. lado: 3 cuadros
// (GBA, 24 × 24) o 4 (DS, 32 × 32, con el dibujo arriba a la izquierda)
function enCuadros(lado) {
  const tiles = new Uint8Array(lado * lado * 32);
  const pixel = (x, y) => (x < W && y < W ? LETRAS[g[y][x]] : 0);
  for (let t = 0; t < lado * lado; t++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x += 2) {
        const [gx, gy] = [(t % lado) * 8 + x, Math.floor(t / lado) * 8 + y];
        tiles[t * 32 + y * 4 + x / 2] = pixel(gx, gy) | (pixel(gx + 1, gy) << 4);
      }
    }
  }
  return tiles;
}
const paletas = COLORES.map((base) => {
  const p = new Uint8Array(32);
  rampa(base).forEach(([r, gg, b], i) => {
    const c = (r >> 3) | ((gg >> 3) << 5) | ((b >> 3) << 10);
    p[i * 2] = c & 0xff;
    p[i * 2 + 1] = c >> 8;
  });
  return p;
});

const hex = (b) => Buffer.from(b).toString("hex");
const salida = `// Generado por herramientas/generar-mentas.mjs (no tocar a mano): el dibujo de las mentas, en el formato de los
// iconos de objeto. DIBUJO_MENTA: 24 × 24 a 4 bits por píxel (nueve cuadros de 8 × 8, GBA); DIBUJO_MENTA_DS: 32 × 32
// (dieciséis cuadros, DS); PALETAS: 16 colores BGR555 (el 0, transparente) por color de menta: Ataque, Defensa,
// At. Esp., Def. Esp., Velocidad y la Seria.

export const DIBUJO_MENTA = "${hex(enCuadros(3))}";

export const DIBUJO_MENTA_DS = "${hex(enCuadros(4))}";

export const PALETAS_MENTA = [
${paletas.map((p) => `  "${hex(p)}"`).join(",\n")}
];
`;
writeFileSync(new URL("../js/randomizer/dibujos-mentas.js", import.meta.url), salida);

if (process.argv[2]) {
  const ancho = 27 * COLORES.length;
  const escala = 8;
  const rgba = new Uint8Array(ancho * escala * W * escala * 4).fill(200);
  COLORES.forEach((base, k) => {
    const colores = rampa(base);
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = LETRAS[g[y][x]];
        if (!i) continue;
        for (let dy = 0; dy < escala; dy++) {
          for (let dx = 0; dx < escala; dx++) {
            const o = (((y * escala + dy) * ancho * escala) + (k * 27 + x) * escala + dx) * 4;
            rgba.set([...colores[i], 255], o);
          }
        }
      }
    }
  });
  writeFileSync(process.argv[2], png(ancho * escala, W * escala, rgba));
}
console.log("Dibujo de las mentas generado.");
