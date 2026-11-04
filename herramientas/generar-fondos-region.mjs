// Dibuja en pixel art los fondos de región (los que se ganan completando cada generación en la
// colección de «Juegos») y los guarda en img/fondos/region-<id>.png.
//
//   node herramientas/generar-fondos-region.mjs [carpeta-para-la-muestra]
//
// Cada uno es una tira de 256×72 que se repite a lo ancho sin que se note el corte, con un paisaje
// de esa región abajo. Los píxeles son algo transparentes (lo de lejos más), para que se siga
// leyendo lo que va encima de la tarjeta. La web los amplía sin suavizar (css/juegos.css).
// Mismas mañas que el escenario de «Combates» (js/lucha/escenario.js): trama de Bayer, siluetas
// con ondas y un azar fijo. Todo dibujado por código: nada de imágenes de otros ni de IA.
//
// Con una carpeta, deja además allí muestra-fondos-region.png: los nueve sobre el color de las
// tarjetas de cada tema, para mirarlos sin abrir la web.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const W = 256;
const H = 72;
const CARPETA = fileURLToPath(new URL("../img/fondos/", import.meta.url));

// ---------- El lienzo ----------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
const umbral = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const vuelta = (x) => ((Math.round(x) % W) + W) % W; // a lo ancho da la vuelta: así casa al repetirse

function azarFijo(texto) {
  let h = 2166136261;
  for (const letra of texto) h = Math.imul(h ^ letra.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let x = h;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function lienzo() {
  const datos = new Uint8Array(W * H * 4);
  // alfa: lo opaco que queda (0…1). Lo que se pinta encima tapa lo de debajo.
  const poner = (x, y, color, alfa) => {
    y = Math.round(y);
    if (y < 0 || y >= H) return;
    const i = (y * W + vuelta(x)) * 4;
    const [r, g, b] = rgb(color);
    datos.set([r, g, b, Math.round(alfa * 255)], i);
  };
  return { datos, poner };
}

// ---------- Piezas ----------

function rect(l, x, y, ancho, alto, color, a) {
  for (let dy = 0; dy < alto; dy++) for (let dx = 0; dx < ancho; dx++) l.poner(x + dx, y + dy, color, a);
}

function disco(l, cx, cy, r, color, a) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) l.poner(cx + x, cy + y, color, a);
}

// Una silueta de montes o colinas. ondas: [vueltas a lo ancho, peso] (vueltas enteras: casa al
// repetirse). La ladera que mira a la izquierda, con el borde más claro (la luz viene de ahí).
// nieve: hasta qué altura llevan nieve las cumbres.
function monte(l, azar, { base, alto, ondas, color, claro, a, hasta = H, nieve = 0 }) {
  const fases = ondas.map(() => azar() * Math.PI * 2);
  const altura = (x) => base - alto * (0.5 + ondas.reduce((s, [k, p], i) => s + Math.sin((2 * Math.PI * k * x) / W + fases[i]) * p, 0));
  const tope = [];
  for (let x = 0; x < W; x++) {
    const y0 = Math.round(altura(x));
    tope.push(y0);
    const subiendo = altura(x + 1) < altura(x - 1);
    for (let y = y0; y < hasta; y++) {
      let c = y - y0 < 2 && subiendo ? claro : color;
      if (nieve && y < nieve && y - y0 < 7 - (y - y0 > 3 && umbral(x, y) > 0.5 ? 3 : 0)) c = subiendo ? "#ffffff" : "#dfe8f3";
      l.poner(x, y, c, a);
    }
  }
  return tope; // la altura en cada columna, para poner cosas encima
}

// El suelo: de lejos a cerca, con trama entre un tono y otro
function suelo(l, y0, colores, a) {
  for (let y = y0; y < H; y++) {
    const t = (y - y0) / Math.max(1, H - y0 - 1);
    for (let x = 0; x < W; x++) {
      const tono = Math.max(0, Math.min(colores.length - 1, Math.floor(t * (colores.length - 0.2) + umbral(x, y) - 0.5)));
      l.poner(x, y, colores[tono], a);
    }
  }
}

function nube(l, cx, cy, ancho, [claro, sombra], a) {
  for (let k = -2; k <= 2; k++) disco(l, cx + k * (ancho / 3), cy - (2 - Math.abs(k)) * 1.5, 2 + (2 - Math.abs(k)), claro, a);
  for (let x = -ancho; x <= ancho; x++) l.poner(cx + x, cy + 3, sombra, a);
}

function arbol(l, x, y, tam, [oscuro, claro, brillo], a) {
  const r = Math.max(3, Math.round(tam / 2));
  l.poner(x, y, "#5a3e28", a);
  l.poner(x, y - 1, "#5a3e28", a);
  disco(l, x, y - r - 1, r, oscuro, a);
  disco(l, x - 1, y - r - 2, r - 1, claro, a);
  l.poner(x - Math.ceil(r / 2), y - r - Math.ceil(r / 2) - 1, brillo, a);
  l.poner(x - Math.ceil(r / 2) + 1, y - r - Math.ceil(r / 2) - 1, brillo, a);
}

function pino(l, x, y, alto, [oscuro, claro, nieve], a, nevado = false) {
  const tramo = Math.ceil(alto / 3);
  for (let fila = 0; fila < alto; fila++) {
    const ancho = Math.floor((fila % tramo) * 0.8 + fila / 3) + 1;
    const conNieve = nevado && fila % tramo < 1;
    for (let dx = -ancho; dx <= ancho; dx++) l.poner(x + dx, y - alto + fila, conNieve ? nieve : dx < 0 ? claro : oscuro, a);
  }
  l.poner(x, y, "#4a3424", a);
  l.poner(x, y + 1, "#4a3424", a);
}

function palmera(l, x, y, tam, [oscuro, claro, tronco], a, lado = 1) {
  for (let i = 0; i < tam; i++) {
    const tx = x + lado * Math.round(Math.sin(i / tam) * 4);
    l.poner(tx, y - i, i % 3 ? tronco : "#5e4428", a);
    l.poner(tx + 1, y - i, "#5e4428", a);
  }
  const cx = x + lado * 4;
  const cy = y - tam;
  for (const [dx, dy] of [[-1, 0.4], [1, 0.4], [-0.75, -0.3], [0.75, -0.3], [-0.2, -0.8], [0.3, -0.7]]) {
    for (let k = 1; k <= tam * 0.55; k++) {
      const caida = (k * k) / (tam * 1.1);
      l.poner(cx + dx * k, cy + dy * k + caida, k % 2 ? oscuro : claro, a);
      l.poner(cx + dx * k, cy + dy * k + caida + 1, oscuro, a);
    }
  }
  l.poner(cx, cy + 1, "#6e4a2a", a); // cocos
  l.poner(cx + 1, cy + 1, "#6e4a2a", a);
}

// Una casa con tejado a dos aguas, ventana y puerta
function casa(l, x, base, ancho, alto, { tejado, sombra, pared }, a) {
  rect(l, x, base - alto, ancho, alto, pared, a);
  rect(l, x, base - 1, ancho, 1, "#b8ac98", a);
  rect(l, x + 2, base - alto + 3, 3, 2, "#8cc8f0", a);
  rect(l, x + ancho - 6, base - 5, 3, 5, "#7a5236", a);
  const filas = Math.ceil(ancho / 2.6);
  for (let r = 0; r < filas; r++) {
    const desde = x - 2 + r;
    const hasta = x + ancho + 1 - r;
    for (let px = desde; px <= hasta; px++) l.poner(px, base - alto - 1 - r, r === 0 ? sombra : tejado, a);
  }
}

function hierbaAlta(l, x, y, color, a) {
  for (const [dx, dy] of [[0, 0], [1, -1], [2, 0], [3, -1], [4, 0], [1, 0], [3, 0]]) l.poner(x + dx, y + dy, color, a);
}

// ---------- Las regiones ----------
//
// Las capas, de lejos a cerca, cada vez más opacas
const LEJOS = 0.42;
const MEDIO = 0.6;
const CERCA = 0.8;
const DETALLE = 0.92;

const REGIONES = {
  // Kanto: un pueblito tranquilo, una casa de tejado rojo y otra de tejado azul, hierba alta y el
  // monte al fondo
  kanto(l, azar) {
    nube(l, 34, 10, 12, ["#ffffff", "#dbe7f2"], 0.45);
    nube(l, 150, 16, 9, ["#ffffff", "#dbe7f2"], 0.45);
    nube(l, 214, 7, 11, ["#ffffff", "#dbe7f2"], 0.45);
    monte(l, azar, { base: 50, alto: 24, ondas: [[1, 0.38], [3, 0.12]], color: "#7d93b8", claro: "#9fb3d2", a: LEJOS, hasta: 58 });
    monte(l, azar, { base: 59, alto: 8, ondas: [[2, 0.4], [5, 0.15]], color: "#5f9c4f", claro: "#7cb860", a: MEDIO, hasta: 61 });
    suelo(l, 60, ["#7cba5c", "#6caa4e", "#5c9842"], CERCA);
    // El camino
    for (let x = 0; x < W; x++) {
      const y = 65 + Math.round(Math.sin((2 * Math.PI * 2 * x) / W) * 1.5);
      l.poner(x, y - 1, "#b89a62", CERCA);
      rect(l, x, y, 1, 3, (x + y) % 5 ? "#dcc690" : "#cdb47c", CERCA);
    }
    for (const x of [14, 72, 118, 142, 238]) arbol(l, x, 60, 8 + (x % 3), ["#2f6b34", "#4a8f45", "#86c868"], DETALLE);
    casa(l, 36, 60, 18, 9, { tejado: "#d24a3a", sombra: "#9a2c24", pared: "#f2ead8" }, DETALLE);
    casa(l, 174, 60, 18, 9, { tejado: "#3c6ad0", sombra: "#264a9c", pared: "#f2ead8" }, DETALLE);
    // Una valla
    for (let x = 88; x <= 110; x++) {
      l.poner(x, 58, "#a07448", DETALLE);
      if (x % 3 === 1) rect(l, x, 56, 1, 4, "#7a5434", DETALLE);
    }
    for (let i = 0; i < 26; i++) hierbaAlta(l, Math.floor(azar() * W), 69 + Math.floor(azar() * 3), "#3e7d36", DETALLE);
  },

  // Johto: otoño, una torre de cinco pisos y hojas que caen
  johto(l, azar) {
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(azar() * W);
      const y = 2 + Math.floor(azar() * 40);
      const c = ["#e0782c", "#c8462a", "#f0b040"][i % 3];
      l.poner(x, y, c, 0.7);
      l.poner(x + 1, y + 1, c, 0.7);
    }
    monte(l, azar, { base: 48, alto: 20, ondas: [[1, 0.35], [2, 0.18], [6, 0.05]], color: "#8a7aa0", claro: "#a898bc", a: LEJOS, hasta: 58 });
    monte(l, azar, { base: 58, alto: 8, ondas: [[3, 0.3], [5, 0.15]], color: "#b8742e", claro: "#d08c3c", a: MEDIO, hasta: 61 });
    suelo(l, 60, ["#a08e4a", "#8e7c3e", "#7a6a32"], CERCA);
    // La torre
    const cx = 186;
    let y = 60;
    for (let piso = 0; piso < 5; piso++) {
      const media = 11 - piso * 2;
      rect(l, cx - media + 2, y - 5, (media - 2) * 2 + 1, 5, "#8c2f22", DETALLE);
      for (let x = cx - media + 3; x <= cx + media - 3; x += 3) rect(l, x, y - 4, 1, 3, "#f0c060", DETALLE);
      y -= 5;
      for (let x = cx - media - 2; x <= cx + media + 2; x++) l.poner(x, y - 1, "#4a2e26", DETALLE);
      for (let x = cx - media; x <= cx + media; x++) l.poner(x, y - 2, "#6a4434", DETALLE);
      l.poner(cx - media - 3, y - 2, "#4a2e26", DETALLE);
      l.poner(cx + media + 3, y - 2, "#4a2e26", DETALLE);
      y -= 2;
    }
    for (let k = 0; k < 6; k++) l.poner(cx, y - k, "#e8b840", DETALLE);
    for (const k of [1, 3]) {
      l.poner(cx - 1, y - k, "#e8b840", DETALLE);
      l.poner(cx + 1, y - k, "#e8b840", DETALLE);
    }
    const colores = [["#a8401e", "#d0602a", "#f6a050"], ["#b06a10", "#e09a28", "#f8d468"], ["#8e2a20", "#bc4030", "#e87850"]];
    [12, 40, 70, 98, 128, 150, 222, 246].forEach((x, i) => arbol(l, x, 61, 9 + (i % 3) * 2, colores[i % 3], DETALLE));
    for (let i = 0; i < 40; i++) l.poner(Math.floor(azar() * W), 63 + Math.floor(azar() * 9), ["#e0782c", "#c8462a", "#f0b040"][i % 3], DETALLE);
  },

  // Hoenn: el mar, un volcán que echa humo al fondo y una isla con palmeras
  hoenn(l, azar) {
    for (const [x, y] of [[150, 12], [160, 9], [168, 14]]) {
      l.poner(x - 1, y - 1, "#ffffff", 0.7);
      l.poner(x, y, "#ffffff", 0.7);
      l.poner(x + 1, y - 1, "#ffffff", 0.7);
    }
    // El volcán (un cono con la cima cortada) y su humo
    const vx = 70;
    for (let y = 18; y < 48; y++) {
      const media = 6 + (y - 18) * 1.25;
      for (let x = -media; x <= media; x++) l.poner(vx + x, y, x < -media + 3 ? "#9a766c" : "#7a5a52", LEJOS + 0.08);
    }
    for (let x = -5; x <= 5; x++) l.poner(vx + x, 18, x % 2 ? "#ff8a3a" : "#ffc060", 0.75);
    for (let i = 0; i < 7; i++) disco(l, vx + 2 + i * 4, 13 - i * 1.6, 2 + (i >> 1), "#c8c0c0", 0.32);
    // El mar
    for (let y = 46; y < H; y++) {
      const t = (y - 46) / (H - 46);
      for (let x = 0; x < W; x++) l.poner(x, y, t * 1.6 + umbral(x, y) - 0.5 > 0.5 ? "#2a7cb2" : "#4aa2d2", MEDIO);
    }
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(azar() * W);
      const y = 48 + Math.floor(azar() * 24);
      for (let k = 0; k < 2 + (y > 60 ? 2 : 0); k++) l.poner(x + k, y, "#e6f7ff", 0.7);
    }
    // La isla
    for (let x = 140; x <= 252; x++) {
      const t = (x - 140) / 112;
      const top = Math.round(72 - Math.sin(t * Math.PI) * 15);
      for (let y = top; y < H; y++) l.poner(x, y, y - top < 1 ? "#f6e6b8" : (x + y) % 7 ? "#e6cc8c" : "#d6b874", CERCA);
      l.poner(x, top - 1, "#e6f7ff", 0.75);
      if (t > 0.25 && t < 0.75) for (let y = top; y < top + 3; y++) l.poner(x, y, (x + y) % 3 ? "#4e9a4a" : "#68b45c", CERCA);
    }
    palmera(l, 176, 60, 20, ["#2f7a44", "#4aa05a", "#8a6a44"], DETALLE, 1);
    palmera(l, 206, 58, 24, ["#2f7a44", "#4aa05a", "#8a6a44"], DETALLE, -1);
    palmera(l, 230, 63, 17, ["#2f7a44", "#4aa05a", "#8a6a44"], DETALLE, 1);
  },

  // Sinnoh: la gran montaña nevada en medio, pinos con nieve y copos
  sinnoh(l, azar) {
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(azar() * W);
      const y = Math.floor(azar() * 60);
      l.poner(x, y, "#ffffff", 0.65);
      if (i % 5 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, "#dfe8f3", 0.5);
    }
    monte(l, azar, { base: 58, alto: 50, ondas: [[1, 0.52], [2, 0.12], [5, 0.04]], color: "#6f86b0", claro: "#8ea4c8", a: LEJOS + 0.06, hasta: 62, nieve: 30 });
    monte(l, azar, { base: 62, alto: 18, ondas: [[3, 0.32], [7, 0.1]], color: "#8aa0c4", claro: "#a6bad8", a: MEDIO, hasta: 64, nieve: 52 });
    suelo(l, 63, ["#f4f8fc", "#e2ecf6", "#cddbe9"], CERCA);
    for (let i = 0; i < 16; i++) {
      const x = Math.floor((i * W) / 16 + azar() * 10);
      pino(l, x, 63 + Math.floor(azar() * 3), 10 + Math.floor(azar() * 8), ["#2e4e4c", "#3e6662", "#ffffff"], DETALLE, true);
    }
    for (let i = 0; i < 30; i++) l.poner(Math.floor(azar() * W), 66 + Math.floor(azar() * 6), "#ffffff", DETALLE);
  },

  // Teselia: la ciudad al anochecer, con las ventanas encendidas, y un puente colgante
  teselia(l, azar) {
    for (let i = 0; i < 26; i++) l.poner(Math.floor(azar() * W), Math.floor(azar() * 22), i % 4 ? "#c9d4ff" : "#ffffff", 0.6);
    disco(l, 38, 10, 4, "#f3f1e2", 0.75);
    disco(l, 40, 9, 3, "#4a4470", 0.0);
    const base = 62;
    const edificios = (desde, hasta, alto, color, ventana, a, densidad) => {
      let x = desde;
      while (x < hasta) {
        const ancho = 7 + Math.floor(azar() * 10);
        const h = alto[0] + Math.floor(azar() * (alto[1] - alto[0]));
        rect(l, x, base - h, ancho - 1, h, color, a);
        if (azar() < 0.4) rect(l, x + Math.floor(ancho / 2) - 1, base - h - 3, 1, 3, color, a); // antena
        for (let wy = base - h + 2; wy < base - 2; wy += 3) {
          for (let wx = x + 1; wx < x + ancho - 2; wx += 2) if (azar() < densidad) l.poner(wx, wy, ventana, a + 0.1);
        }
        x += ancho;
      }
    };
    edificios(0, W, [22, 50], "#3c4260", "#ffd66b", LEJOS + 0.08, 0.3);
    // El puente: dos torres, el cable que cuelga entre ellas y el tablero
    const [t1, t2, cima, tablero] = [150, 226, 22, 50];
    for (let x = 128; x <= 250; x++) {
      for (let y = tablero + 1; y < base; y++) l.poner(x, y, (x + y) % 6 ? "#2c4a78" : "#3c6098", MEDIO);
      rect(l, x, tablero, 1, 2, "#c8ccd8", CERCA);
    }
    for (const t of [t1, t2]) {
      rect(l, t - 1, cima, 3, base - cima, "#d6dae6", CERCA);
      for (let y = cima + 4; y < tablero; y += 8) rect(l, t - 2, y, 5, 1, "#aab0c0", CERCA);
    }
    const cable = (x0, y0, x1, y1, comba) => {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0);
        const y = Math.round(y0 + (y1 - y0) * t + comba * 4 * t * (1 - t));
        l.poner(x, y, "#e8ecf6", CERCA);
        if (x % 4 === 0 && y < tablero) for (let k = y + 1; k < tablero; k++) l.poner(x, k, "#9aa2b8", 0.55);
      }
    };
    cable(t1, cima, t2, cima, 22);
    cable(128, tablero - 4, t1, cima, 4);
    cable(t2, cima, 250, tablero - 4, 4);
    edificios(0, 124, [10, 28], "#262a3e", "#ffe9a8", CERCA - 0.05, 0.4);
    suelo(l, base, ["#2a2d40", "#22253a", "#1c1e30"], CERCA);
    for (let x = 0; x < W; x += 8) rect(l, x, 67, 4, 1, "#e8c050", DETALLE);
  },

  // Kalos: la torre de celosía en medio, árboles recortados y parterres de flores
  kalos(l, azar) {
    for (const [x, y, ancho] of [[40, 12, 14], [210, 8, 12]]) {
      for (let k = -ancho; k <= ancho; k++) l.poner(x + k, y + Math.round(Math.abs(k) / 6), "#f6c4d8", 0.45);
      for (let k = -ancho + 4; k <= ancho - 4; k++) l.poner(x + k + 3, y - 2, "#fbe0ec", 0.45);
    }
    // Las casas de la ciudad, con sus tejados de pizarra
    let x = 0;
    while (x < W) {
      const ancho = 9 + Math.floor(azar() * 8);
      const h = 9 + Math.floor(azar() * 9);
      rect(l, x, 60 - h, ancho - 1, h, "#d8c8c0", LEJOS);
      for (let r = 0; r < 4; r++) for (let k = r; k < ancho - 1 - r; k++) l.poner(x + k, 60 - h - 1 - r, "#5a6a98", LEJOS + 0.05);
      for (let wy = 60 - h + 2; wy < 58; wy += 4) for (let wx = x + 2; wx < x + ancho - 2; wx += 3) l.poner(wx, wy, "#7a86b0", LEJOS + 0.1);
      x += ancho;
    }
    // La torre
    const cx = 128;
    const cTorre = "#a890c0";
    const cLuz = "#e6d6f0";
    for (let y = 8; y <= 61; y++) {
      const t = (y - 8) / 53;
      const media = Math.round(1 + t * t * 15 + t * 2);
      l.poner(cx - media, y, cTorre, DETALLE);
      l.poner(cx + media, y, cTorre, DETALLE);
      if (t > 0.55) {
        l.poner(cx - media + 1, y, cTorre, DETALLE);
        l.poner(cx + media - 1, y, cTorre, DETALLE);
      }
      const paso = (y - 8) % 6;
      if (paso === 0) for (let k = -media; k <= media; k++) l.poner(cx + k, y, cLuz, DETALLE);
      else if (y < 52) {
        const d = Math.round((media * 2 * paso) / 6);
        l.poner(cx - media + d, y, cTorre, MEDIO);
        l.poner(cx + media - d, y, cTorre, MEDIO);
      }
    }
    for (const y of [26, 44]) {
      const media = Math.round(1 + ((y - 8) / 53) ** 2 * 15 + ((y - 8) / 53) * 2) + 2;
      rect(l, cx - media, y, media * 2 + 1, 2, cLuz, DETALLE);
    }
    for (let y = 1; y < 8; y++) l.poner(cx, y, cTorre, DETALLE);
    l.poner(cx, 0, "#7fe0f0", DETALLE);
    l.poner(cx - 1, 4, "#f08cb0", DETALLE);
    l.poner(cx + 1, 4, "#7fe0f0", DETALLE);
    suelo(l, 61, ["#eadccc", "#ddcab8", "#cdb8a4"], CERCA);
    // Árboles en forma de cono y parterres
    for (const x of [16, 48, 80, 176, 208, 240]) {
      for (let fila = 0; fila < 12; fila++) {
        const media = Math.round(fila / 2.6);
        for (let k = -media; k <= media; k++) l.poner(x + k, 50 + fila, k < 0 ? "#5a9a5e" : "#3f7a4a", DETALLE);
      }
      rect(l, x - 2, 62, 5, 2, "#b0a090", DETALLE);
    }
    for (let x = 0; x < W; x++) {
      if (x > 104 && x < 152) continue; // delante de la torre, el paseo
      const flor = ["#f08cb0", "#7fa8f0", "#f6d870", "#f8f0f4"][Math.floor(x / 3) % 4];
      rect(l, x, 67, 1, 4, (x + 1) % 3 ? "#4e8a50" : "#3c7040", DETALLE);
      if (x % 2 === 0) l.poner(x, 66 + (x % 4 ? 0 : 1), flor, DETALLE);
    }
  },

  // Alola: el sol que se pone en el mar, una isla volcánica, la playa con palmeras y flores
  alola(l, azar) {
    disco(l, 204, 44, 15, "#ffcf7a", 0.7);
    disco(l, 204, 44, 11, "#ffe2a0", 0.75);
    monte(l, azar, { base: 47, alto: 18, ondas: [[1, 0.3]], color: "#3f7a5a", claro: "#55966e", a: LEJOS, hasta: 47 });
    for (let x = 0; x < W; x++) {
      for (let y = 46; y < 62; y++) l.poner(x, y, (y - 46) / 16 + umbral(x, y) - 0.5 > 0.5 ? "#2c86ac" : "#3a9cc0", MEDIO);
    }
    for (let y = 47; y < 61; y += 2) {
      const ancho = 14 - (y - 47);
      for (let k = -ancho; k <= ancho; k += 1) if ((k + y) % 3) l.poner(204 + k, y, "#ffd88a", 0.75);
    }
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(azar() * W);
      if (Math.abs(x - 204) < 18) continue;
      rect(l, x, 48 + Math.floor(azar() * 12), 3, 1, "#d6f2fa", 0.6);
    }
    suelo(l, 62, ["#f2dca6", "#e6ca8c", "#d8b878"], CERCA);
    for (let x = 0; x < W; x++) l.poner(x, 62, "#ffffff", 0.7); // la espuma en la orilla
    palmera(l, 24, 68, 30, ["#2f7a44", "#3f9454", "#8a6a44"], DETALLE, 1);
    palmera(l, 110, 66, 22, ["#2f7a44", "#3f9454", "#8a6a44"], DETALLE, -1);
    palmera(l, 150, 69, 28, ["#2f7a44", "#3f9454", "#8a6a44"], DETALLE, 1);
    palmera(l, 244, 67, 24, ["#2f7a44", "#3f9454", "#8a6a44"], DETALLE, -1);
    for (const x of [40, 92, 170, 228]) {
      disco(l, x, 68, 3, "#3c8a4a", DETALLE);
      l.poner(x - 1, 66, "#f0466a", DETALLE);
      l.poner(x + 2, 68, "#ff7a9a", DETALLE);
      l.poner(x, 69, "#f0466a", DETALLE);
    }
  },

  // Galar: colinas verdes con muros de piedra, un castillo, ovejas y el cielo nublado
  galar(l, azar) {
    for (let i = 0; i < 6; i++) nube(l, 20 + i * 44 + Math.floor(azar() * 10), 6 + Math.floor(azar() * 8), 10 + Math.floor(azar() * 6), ["#d6dae2", "#b8bec8"], 0.42);
    monte(l, azar, { base: 46, alto: 10, ondas: [[2, 0.35], [5, 0.1]], color: "#6c8a6a", claro: "#82a080", a: LEJOS, hasta: 56 });
    const colina = monte(l, azar, { base: 58, alto: 12, ondas: [[1, 0.3], [3, 0.2]], color: "#5f9a4e", claro: "#78b060", a: MEDIO, hasta: 64 });
    for (let x = 0; x < W; x++) if (x % 3) l.poner(x, colina[x] + 4, "#a8a49c", MEDIO + 0.1);
    for (const x of [30, 96, 150, 222]) for (let y = colina[x] + 4; y < 64; y++) l.poner(x, y, "#a8a49c", MEDIO + 0.1);
    // El castillo, encima de la colina
    const cx = 60;
    const base = colina[cx] + 2;
    const piedra = "#8c8a92";
    rect(l, cx - 9, base - 16, 19, 16, piedra, DETALLE);
    rect(l, cx + 6, base - 16, 4, 16, "#74727a", DETALLE);
    for (let x = cx - 9; x <= cx + 9; x += 2) l.poner(x, base - 17, piedra, DETALLE);
    for (const tx of [cx - 15, cx + 10]) {
      rect(l, tx, base - 24, 6, 24, "#9a98a0", DETALLE);
      for (let r = 0; r < 6; r++) for (let k = r; k < 6 - r; k++) l.poner(tx + k, base - 25 - r, "#4a4e66", DETALLE);
      rect(l, tx + 2, base - 18, 2, 3, "#2e2c34", DETALLE);
    }
    for (const wx of [cx - 5, cx, cx + 5]) rect(l, wx, base - 12, 1, 2, "#2e2c34", DETALLE);
    rect(l, cx - 2, base - 6, 5, 6, "#2e2c34", DETALLE);
    rect(l, cx, base - 23, 1, 6, "#5a5050", DETALLE);
    rect(l, cx + 1, base - 23, 3, 2, "#c8323c", DETALLE);
    suelo(l, 63, ["#6aa850", "#5c9846", "#4e8a3c"], CERCA);
    for (let x = 0; x < W; x++) if ((x * 7) % 11 < 6) l.poner(x, 63, "#3e7032", CERCA); // el seto
    // Ovejas
    for (const [x, y] of [[110, 68], [126, 70], [184, 67], [204, 70], [18, 69], [240, 68]]) {
      rect(l, x, y - 3, 5, 3, "#f4f2ea", DETALLE);
      rect(l, x + 1, y - 4, 3, 1, "#ffffff", DETALLE);
      rect(l, x + 5, y - 3, 2, 2, "#3a3436", DETALLE);
      l.poner(x + 1, y, "#3a3436", DETALLE);
      l.poner(x + 4, y, "#3a3436", DETALLE);
    }
  },

  // Paldea: llanuras doradas, mesetas rojas, el gran cráter con niebla al fondo, molinos de viento
  // y un pueblo blanco
  paldea(l, azar) {
    for (const [x, y] of [[40, 14], [48, 11], [56, 15]]) {
      l.poner(x - 1, y - 1, "#5a4a5a", 0.6);
      l.poner(x, y, "#5a4a5a", 0.6);
      l.poner(x + 1, y - 1, "#5a4a5a", 0.6);
    }
    // El cráter: una montaña muy ancha que sube hasta un borde con el hueco en medio, y un anillo de
    // niebla a media altura
    const suave = (v) => v * v * (3 - 2 * v);
    for (let x = 24; x <= 232; x++) {
      const t = (x - 24) / 208;
      const subida = suave(Math.min(1, Math.min(t, 1 - t) / 0.3));
      const top = Math.round(57 - subida * 37 + 5 * Math.exp(-(((t - 0.5) / 0.16) ** 2)) + Math.sin(x / 5) * 0.6);
      const ladera = t < 0.3;
      for (let y = top; y < 58; y++) {
        const borde = y - top < 2;
        l.poner(x, y, borde && (ladera || Math.abs(t - 0.5) < 0.12) ? "#a898b8" : y > 46 && umbral(x, y) < (y - 46) / 12 ? "#6c5c7c" : "#7a6a8a", LEJOS);
      }
    }
    for (let y = 26; y <= 34; y++) {
      const densidad = 0.55 * (1 - Math.abs(y - 30) / 4.5);
      for (let x = 44; x <= 212; x++) {
        const lado = Math.min(x - 44, 212 - x) / 20;
        if (umbral(x, y) < densidad * Math.min(1, lado)) l.poner(x, y, "#f4f0ff", 0.42);
      }
    }
    // Las mesetas rojas: cima plana, laderas en talud, la cara de la izquierda al sol y una veta
    for (const [desde, hasta, cima] of [[-6, 36, 36], [210, 252, 31]]) {
      const alto = 60 - cima;
      for (let x = desde; x <= hasta; x++) {
        const borde = Math.min(x - desde, hasta - x);
        const top = cima + Math.max(0, Math.round((8 - borde) * 1.6)) + (x % 7 === 0 ? 1 : 0);
        for (let y = top; y < 60; y++) {
          const sol = x - desde < 9 && borde < 9;
          const veta = Math.abs(y - (cima + Math.round(alto * 0.45))) < 1;
          l.poner(x, y, y - top < 1 ? "#d88a62" : veta ? "#8e4632" : sol ? "#c87250" : "#a85238", MEDIO);
        }
      }
    }
    monte(l, azar, { base: 61, alto: 5, ondas: [[2, 0.4], [6, 0.1]], color: "#c8a85a", claro: "#dcbe70", a: MEDIO + 0.1, hasta: 63 });
    suelo(l, 62, ["#d6b864", "#c8a656", "#b89448"], CERCA);
    // El pueblo blanco
    for (const [x, ancho, alto] of [[66, 8, 6], [75, 6, 8], [82, 9, 5], [92, 7, 7], [100, 8, 5]]) {
      rect(l, x, 61 - alto, ancho, alto, "#f4f0e6", DETALLE);
      rect(l, x, 60 - alto, ancho, 1, "#d8783c", DETALLE);
      rect(l, x + 2, 63 - alto, 1, 2, "#6a5a50", DETALLE);
    }
    // Los molinos
    for (const x of [150, 174, 196]) {
      for (let r = 0; r < 14; r++) {
        const media = r < 7 ? 3 : 2;
        rect(l, x - media, 60 - r, media * 2 + 1, 1, "#f4f0e6", DETALLE);
        l.poner(x + media, 60 - r, "#d6d0c4", DETALLE);
      }
      rect(l, x - 1, 57, 2, 3, "#5a4a3e", DETALLE);
      for (let r = 0; r < 3; r++) rect(l, x - 2 + r, 46 - r, 5 - r * 2, 1, "#5a4a3e", DETALLE);
      for (let k = 1; k <= 8; k++) {
        for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) l.poner(x + dx * k, 44 + dy * k, k > 2 && k % 2 ? "#c8b8a0" : "#6a5440", DETALLE);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(azar() * W);
      if (x > 140 && x < 204) continue;
      disco(l, x, 66 + Math.floor(azar() * 4), 2, "#7a8a52", DETALLE);
      l.poner(x - 1, 64 + Math.floor(azar() * 4), "#98a86a", DETALLE);
    }
  }
};

// ---------- PNG ----------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, rgba) {
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * ancho * 4, ancho * 4).copy(filas, y * (ancho * 4 + 1) + 1);
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", cabecera),
    trozo("IDAT", deflateSync(filas, { level: 9 })),
    trozo("IEND", Buffer.alloc(0))
  ]);
}

// ---------- A pintar ----------

const pintados = {};
for (const [id, pintar] of Object.entries(REGIONES)) {
  const l = lienzo();
  pintar(l, azarFijo(id));
  pintados[id] = l.datos;
  writeFileSync(join(CARPETA, `region-${id}.png`), png(W, H, l.datos));
}
console.log(`${Object.keys(pintados).length} fondos en ${CARPETA}`);

// La muestra: cada uno dos veces a lo ancho y a ×2, sobre el color de las tarjetas de los tres
// temas (Atardecer, Oscuro y Claro). Detrás de la carpeta se pueden poner solo algunos: kanto,johto
const carpetaMuestra = process.argv[2];
const soloEstos = process.argv[3] ? process.argv[3].split(",") : null;
if (soloEstos) for (const id of Object.keys(pintados)) if (!soloEstos.includes(id)) delete pintados[id];
if (carpetaMuestra) {
  const ESCALA = 2;
  const TEMAS = ["#32302f", "#2c2e3e", "#ffffff"];
  const anchoTema = W * 2 * ESCALA;
  const altoFila = H * ESCALA + 4;
  const ancho = anchoTema * TEMAS.length + (TEMAS.length - 1) * 4;
  const alto = altoFila * Object.keys(pintados).length;
  const muestra = new Uint8Array(ancho * alto * 4).fill(0);
  Object.values(pintados).forEach((datos, fila) => {
    TEMAS.forEach((tema, i) => {
      const fondo = rgb(tema);
      for (let y = 0; y < H * ESCALA; y++) {
        for (let x = 0; x < anchoTema; x++) {
          const j = ((Math.floor(y / ESCALA)) * W + (Math.floor(x / ESCALA) % W)) * 4;
          const a = datos[j + 3] / 255;
          const k = ((fila * altoFila + y) * ancho + i * (anchoTema + 4) + x) * 4;
          for (let c = 0; c < 3; c++) muestra[k + c] = Math.round(datos[j + c] * a + fondo[c] * (1 - a));
          muestra[k + 3] = 255;
        }
      }
    });
  });
  writeFileSync(join(carpetaMuestra, "muestra-fondos-region.png"), png(ancho, alto, muestra));
  console.log(`Muestra en ${join(carpetaMuestra, "muestra-fondos-region.png")}`);
}
