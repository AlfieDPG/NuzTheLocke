// Dibuja en pixel art los fondos de la tarjeta de jugador que van con dibujo de paisaje: los de
// región (se ganan completando cada generación en la colección de «Juegos»), los de Eevee (con los
// logros de registrarlas) y los de la Tienda.
// Guarda las capas en img/fondos/ (region-<id>.png, eevee-<id>-<capa>.png, tienda-<id>-<capa>.png)
// y escribe su CSS en
// css/fondos-pixel.css (ese archivo no se toca a mano: se cambia aquí y se vuelve a ejecutar).
//
//   node herramientas/generar-fondos-pixel.mjs [carpeta-para-la-muestra] [solo,estos] [momento]
//
// Cada fondo son una o varias capas que se repiten (a lo ancho, o a lo ancho y a lo alto) sin que
// se note el corte. Los píxeles son algo transparentes (lo de lejos más), para que se siga leyendo
// lo que va encima de la tarjeta. La web los amplía sin suavizar: cada píxel mide --px (2px en las
// tarjetas grandes, 1px en las muestras pequeñas). Lo que se mueve lo hace desplazando sus capas
// (background-position), a saltos de un píxel, como en los juegos.
// Mismas mañas que el escenario de «Combates» (js/lucha/escenario.js): trama de Bayer, siluetas
// con ondas y un azar fijo. Todo dibujado por código: nada de imágenes de otros ni de IA.
//
// Con una carpeta, deja además allí muestra-fondos-pixel.png: cada fondo como se vería en una
// tarjeta, sobre el color de las tarjetas de los temas Atardecer y Claro, para mirarlos sin abrir
// la web. Detrás se pueden poner solo algunos (kanto,tienda-bosque) y el momento de la animación
// que se quiere ver (de 0 a 1).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { png } from "./png.mjs";

// Las tiras de las regiones
const W = 256;
const H = 72;
const CARPETA = fileURLToPath(new URL("../img/fondos/", import.meta.url));
const ARCHIVO_CSS = fileURLToPath(new URL("../css/fondos-pixel.css", import.meta.url));

// ---------- El lienzo ----------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
const umbral = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const vuelta = (n, tope) => ((Math.round(n) % tope) + tope) % tope; // da la vuelta: así casa al repetirse

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

// A lo ancho siempre da la vuelta; a lo alto, solo en las capas que se repiten también hacia abajo
function lienzo(ancho = W, alto = H, envolverAlto = false) {
  const datos = new Uint8Array(ancho * alto * 4);
  // alfa: lo opaco que queda (0…1). Lo que se pinta encima tapa lo de debajo.
  const poner = (x, y, color, alfa) => {
    y = envolverAlto ? vuelta(y, alto) : Math.round(y);
    if (y < 0 || y >= alto) return;
    const i = (y * ancho + vuelta(x, ancho)) * 4;
    const [r, g, b] = rgb(color);
    datos.set([r, g, b, Math.round(alfa * 255)], i);
  };
  return { datos, poner, ancho, alto };
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
function monte(l, azar, { base, alto, ondas, color, claro, a, hasta = l.alto, nieve = 0 }) {
  const fases = ondas.map(() => azar() * Math.PI * 2);
  const altura = (x) => base - alto * (0.5 + ondas.reduce((s, [k, p], i) => s + Math.sin((2 * Math.PI * k * x) / l.ancho + fases[i]) * p, 0));
  const tope = [];
  for (let x = 0; x < l.ancho; x++) {
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
  for (let y = y0; y < l.alto; y++) {
    const t = (y - y0) / Math.max(1, l.alto - y0 - 1);
    for (let x = 0; x < l.ancho; x++) {
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

// Lo que dice el CSS de cada región: qué se ve y el tinte suave del cielo, por encima del paisaje
const CIELOS_REGION = {
  kanto: ["Kanto: un pueblito con una casa de tejado rojo y otra azul, hierba alta y el monte al fondo", "linear-gradient(115deg, rgba(220, 60, 50, 0.16), rgba(60, 100, 220, 0.18) 60%, transparent)"],
  johto: ["Johto: otoño, la torre de cinco pisos y hojas que caen", "linear-gradient(to bottom, rgba(230, 150, 60, 0.24), transparent 75%)"],
  hoenn: ["Hoenn: el mar, el volcán echando humo y una isla con palmeras", "linear-gradient(to bottom, rgba(60, 150, 220, 0.24), transparent 75%)"],
  sinnoh: ["Sinnoh: la gran montaña nevada, pinos con nieve y copos", "linear-gradient(to bottom, rgba(120, 150, 210, 0.26), transparent 75%)"],
  teselia: ["Teselia: la ciudad de noche con las ventanas encendidas y el puente colgante", "linear-gradient(to bottom, rgba(70, 60, 130, 0.32), transparent 80%)"],
  kalos: ["Kalos: la torre de celosía, árboles recortados y parterres de flores", "linear-gradient(to bottom, rgba(240, 170, 200, 0.24), rgba(150, 180, 240, 0.12) 60%, transparent)"],
  alola: ["Alola: el sol poniéndose en el mar, palmeras y flores", "linear-gradient(to bottom, rgba(255, 140, 90, 0.28), rgba(230, 90, 150, 0.16) 70%, transparent)"],
  galar: ["Galar: colinas con muros de piedra, el castillo, ovejas y el cielo nublado", "linear-gradient(to bottom, rgba(150, 160, 175, 0.24), transparent 75%)"],
  paldea: ["Paldea: el gran cráter con niebla, mesetas rojas, molinos y un pueblo blanco", "linear-gradient(110deg, rgba(220, 60, 60, 0.2), rgba(140, 70, 200, 0.2))"]
};

// ---------- Más piezas (para la Tienda) ----------

// Para cambiar de dibujo de golpe n veces por vuelta (los dibujos, uno al lado del otro en la
// misma capa): los momentos justo antes y justo en cada cambio (también el del final de la vuelta:
// si no, el último tramo se desliza hasta el principio), y cuál de dos toca en cada momento
const saltos = (n) => Array.from({ length: n }, (_, i) => [(i + 1) / n - 0.0001, (i + 1) / n]).flat();
const turno = (t, n) => Math.floor(t * n + 1e-6) % 2;

// Una secuencia de dibujos (uno al lado del otro en la capa, de «ancho» cada uno):
// [[desde, dibujo], ...] (en la vuelta, de 0 a 1; la primera desde 0 y la última con el mismo dibujo
// que la primera). Da las paradas (cada cambio, de golpe) y cuánto se desplaza la capa
function secuencia(pasos, ancho) {
  const dibujoEn = (t) => pasos.reduce((dibujo, [desde, cual]) => (t + 1e-6 >= desde ? cual : dibujo), pasos[0][1]);
  return {
    paradas: pasos.slice(1).flatMap(([desde]) => [desde - 0.0001, desde]),
    mueve: (t) => [-dibujoEn(t) * ancho, 0] // hacia la izquierda: así se ve justo ese dibujo
  };
}

// Un dibujito escrito con letras: cada letra, un color (las que no están, transparentes)
function mapa(l, x, y, filas, colores, a) {
  filas.forEach((fila, dy) => [...fila].forEach((c, dx) => {
    if (colores[c]) l.poner(x + dx, y + dy, colores[c], a);
  }));
}

// Un brillo con trama: más denso en el centro
function brillo(l, cx, cy, r, color, fuerza, a) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d <= 1 && umbral(cx + x, cy + y) < fuerza * (1 - d)) l.poner(cx + x, cy + y, color, a);
    }
  }
}

// Un abeto por pisos, con la luz por la izquierda y el borde de abajo de cada piso dentado
function abeto(l, x, base, alto, [oscuro, medio, claro], a, tronco = "#4a3020") {
  const pie = Math.max(2, Math.round(alto * 0.12));
  rect(l, x - 1, base - pie, 2, pie, tronco, a);
  const copa = alto - pie;
  const pisos = alto > 22 ? 4 : 3;
  const anchoMax = Math.max(3, Math.round(alto * 0.3));
  for (let p = 0; p < pisos; p++) {
    const arriba = base - pie - copa + Math.round((p * copa) / (pisos + 0.6));
    const altoPiso = Math.round((copa / pisos) * 1.6);
    const anchoPiso = anchoMax * (0.45 + (0.55 * (p + 1)) / pisos);
    for (let k = 0; k <= altoPiso; k++) {
      const y = arriba + k;
      if (y > base - pie) break;
      const media = Math.round((anchoPiso * k) / altoPiso);
      for (let dx = -media; dx <= media; dx++) {
        if (k === altoPiso && (x + dx) % 2) continue;
        l.poner(x + dx, y, dx <= -media + 1 ? claro : dx < 0 ? medio : oscuro, a);
      }
    }
  }
}

// Una mata de hierba alta: cuatro hojas puntiagudas (la cara izquierda al sol, la derecha en
// sombra y un perfil oscuro), unidas abajo. Mide unos 12 de ancho.
function mata(l, x, base, alto, [oscuro, claro, sombra], a) {
  for (const [dx, menos, ladea] of [[0, 1, -1], [3, 0, -1], [6, 2, 1], [9, 1, 1]]) {
    const h = Math.max(3, alto - menos);
    for (let k = 0; k < h; k++) {
      const px = x + dx + (k > h * 0.55 ? ladea : 0) + (k > h * 0.85 ? ladea : 0);
      const punta = k >= h - 2;
      l.poner(px, base - k, punta ? claro : claro, a);
      if (!punta) l.poner(px + 1, base - k, oscuro, a);
      if (!punta && k < h * 0.7) l.poner(px + 2, base - k, sombra, a);
    }
  }
  rect(l, x - 1, base - 1, 13, 2, oscuro, a);
}

function mariposa(l, x, y, ala, a) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [1, -1], [-2, -1], [2, -1]]) l.poner(x + dx, y + dy, ala, a);
  l.poner(x, y, "#3a2e2a", a);
  l.poner(x, y - 1, "#3a2e2a", a);
}

// Nubes blancas de día, con la base plana y algo de sombra (las de los fondos con cielo de día)
function nubesDeDia(l, azar) {
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor((i * l.ancho) / 4 + azar() * 30);
    const cy = 10 + Math.floor(azar() * 16);
    const ancho = 9 + Math.floor(azar() * 8);
    for (let k = -2; k <= 2; k++) disco(l, cx + k * (ancho / 3), cy - (2 - Math.abs(k)) * 2, 3 + (2 - Math.abs(k)), "#ffffff", 0.92);
    for (let x = -ancho - 1; x <= ancho + 1; x++) {
      l.poner(cx + x, cy + 3, "#e2eef8", 0.92);
      l.poner(cx + x, cy + 4, "#c8dcf0", 0.92);
    }
  }
}

// Wobbuffet saliendo de una caja, en la Guarida Rocket (x0: dónde empieza ese dibujo en la capa).
// dibujo: 0 la caja cerrada, 1 se asoma (la coronilla y los ojos), 2 medio fuera (ya con la boca),
// 3 y 4 fuera del todo con los dos brazos arriba, meneándose a un lado y al otro, y con la cola
// asomando por el lado de la caja.
// Dibujado píxel a píxel a partir de cómo es (nada copiado ni de IA): cuerpo azul de una pieza con
// la coronilla redonda, ojos cerrados en «> <», una bocaza abierta con el borde de arriba en
// zigzag y la lengua rosa, brazos planos y largos, y la cola negra con dos ojos con pupila.
const WOBBU = {
  contorno: "#1c4470", cuerpo: "#58b2ea", luz: "#9cd8fb", sombra: "#3a8cca",
  ojo: "#15202e", boca: "#5a1222", garganta: "#8e2a3c", lengua: "#ec8299"
};

// El dibujo de Wobbuffet: un mapa «dx,fila» → color, con dx desde el centro (el cuerpo va de -9 a
// 8) y fila desde la coronilla (las negativas, los brazos que suben por encima de la cabeza)
function figuraWobbuffet(brazos) {
  const figura = new Map();
  const poner = (dx, fila, color) => figura.set(`${dx},${fila}`, color);
  const hay = (dx, fila) => figura.has(`${dx},${fila}`);

  // Los brazos, detrás del cuerpo: del hombro salen hacia fuera, suben rectos y la mano se dobla
  // hacia la cabeza (aletas planas y anchas, de 5). El derecho es el izquierdo en espejo.
  if (brazos) {
    const brazo = [[-9, 17], [-10, 16], [-11, 15], [-12, 14], [-13, 13], [-14, 12], [-14, 11], [-14, 10], [-14, 9],
      [-14, 8], [-14, 7], [-14, 6], [-14, 5], [-14, 4], [-14, 3], [-13, 2], [-13, 1], [-12, 0], [-11, -1], [-10, -2]];
    for (const [dx, fila] of brazo) {
      for (const k of [-2, -1, 0, 1, 2]) {
        poner(dx + k, fila, WOBBU.cuerpo);
        poner(-1 - (dx + k), fila, WOBBU.cuerpo);
      }
    }
  }
  // El cuerpo: la coronilla redonda y luego recto (lo de abajo queda dentro de la caja)
  const MEDIO = [4, 6, 7, 8, 8, 9];
  for (let fila = 0; fila < 34; fila++) {
    const m = MEDIO[fila] || 9;
    for (let dx = -m; dx < m; dx++) poner(dx, fila, WOBBU.cuerpo);
  }
  // El contorno: todo lo que da al vacío (lo de abajo del todo queda dentro de la caja)
  const borde = [];
  for (const clave of figura.keys()) {
    const [dx, fila] = clave.split(",").map(Number);
    if (!hay(dx - 1, fila) || !hay(dx + 1, fila) || !hay(dx, fila - 1) || !hay(dx, fila + 1)) borde.push([dx, fila]);
  }
  // Luz a la izquierda y sombra a la derecha (dos píxeles por dentro del contorno)
  for (const clave of figura.keys()) {
    const [dx, fila] = clave.split(",").map(Number);
    const izquierda = !hay(dx - 1, fila) || !hay(dx - 2, fila);
    const derecha = !hay(dx + 1, fila) || !hay(dx + 2, fila);
    if (izquierda && fila < 26) poner(dx, fila, WOBBU.luz);
    else if (derecha) poner(dx, fila, WOBBU.sombra);
  }
  for (const [dx, fila] of borde) poner(dx, fila, WOBBU.contorno);
  // Un brillo en la coronilla
  for (const [dx, fila] of [[-4, 2], [-3, 2], [-5, 3], [-4, 3]]) poner(dx, fila, WOBBU.luz);

  // Los ojos cerrados: «>» y «<» de 4×5
  const OJO = ["k...", ".kk.", "...k", ".kk.", "k..."];
  OJO.forEach((filaOjo, f) => [...filaOjo].forEach((c, i) => {
    if (c !== "k") return;
    poner(-6 + i, 6 + f, WOBBU.ojo);   // el izquierdo, «>»
    poner(5 - i, 6 + f, WOBBU.ojo);    // el derecho, «<» (en espejo)
  }));

  // La bocaza: arriba en zigzag (los «dientes» son del color del cuerpo), oscura por dentro, roja
  // hacia abajo y la lengua rosa al fondo
  const BOCA = [3, 5, 5, 6, 6, 6, 5, 5, 4, 2];   // medio ancho de cada fila, desde la fila 12
  BOCA.forEach((m, f) => {
    for (let dx = -m; dx < m; dx++) {
      if (f === 0 && (dx + 10) % 2) continue;                     // el zigzag de arriba
      const centro = Math.abs(dx + 0.5) < m - 1;
      let color = WOBBU.boca;
      if (f >= 3 && centro) color = WOBBU.garganta;
      if (f >= 6 && Math.abs(dx + 0.5) < m - 1.5) color = WOBBU.lengua;
      if (f === BOCA.length - 1) color = WOBBU.boca;
      poner(dx, 12 + f, color);
    }
  });
  return figura;
}

function pintarWobbuffet(l, x0, dibujo) {
  const [cx, boca] = [x0 + 133, 47]; // el centro de la caja y su borde de arriba
  const a = 0.97;
  const fuera = [0, 9, 20, 31, 31][dibujo];
  const desvio = dibujo === 3 ? -1 : dibujo === 4 ? 1 : 0;
  const top = boca - fuera;
  if (fuera) {
    // Al menearse, la cabeza y los brazos se ladean un píxel y lo de abajo se queda
    for (const [clave, color] of figuraWobbuffet(dibujo >= 3)) {
      const [dx, fila] = clave.split(",").map(Number);
      const y = top + fila;
      if (y >= boca) continue;   // lo que queda dentro de la caja
      l.poner(cx + dx + (fila < 18 ? desvio : 0), y, color, a);
    }
    if (dibujo >= 3) {
      // La cola, negra y con sus dos ojos con pupila, asomando por el lado de la caja
      mapa(l, cx + 12, boca + 2 - (dibujo - 3), [
        "..aaaa..",
        ".aaaaaaa",
        "aawwawwa",
        "aawkawka",
        ".aaaaaaa",
        "..aaaa.."
      ], { a: "#24242c", w: "#ffffff", k: "#000000" }, a);
    }
  }
  // La caja, delante (tapa lo que queda dentro)
  rect(l, cx - 12, boca, 24, 15, "#8a5a30", a);
  rect(l, cx - 12, boca, 24, 1, fuera ? "#3a2412" : "#b07a44", a);
  rect(l, cx - 12, boca + 7, 24, 1, "#6a4424", a);
  rect(l, cx + 11, boca, 1, 15, "#6a4424", a);
  mapa(l, cx - 2, boca + 2, ["##.", "#.#", "##.", "#.#"], { "#": "#a01820" }, a);
  // La tapa: cerrada, levantada sobre la cabeza o apoyada a un lado
  if (dibujo === 0) rect(l, cx - 13, boca - 2, 26, 2, "#b07a44", a);
  else if (dibujo === 1) rect(l, cx - 11, top - 2, 24, 2, "#b07a44", a);
  else for (let k = 0; k < 16; k++) rect(l, cx - 14 - Math.floor(k / 3), boca + 14 - k, 2, 1, k % 4 ? "#b07a44" : "#8a5a30", a);
}

// Un fantasmita de sábana: cabeza redonda, ojos, boquita y el borde de abajo ondulado; un poco
// transparente y con un resplandor lila
function fantasma(l, x, y, a) {
  brillo(l, x + 5, y + 6, 10, "#c8b8ff", 0.4, a * 0.35);
  mapa(l, x, y, [
    "...aaaaa...",
    "..aaaaaab..",
    ".aaaaaaaab.",
    ".aakaaakab.",
    ".aakaaakab.",
    ".aaaaaaaab.",
    ".aaaaoaaab.",
    ".aaaaaaaab.",
    ".aaaaaaaab.",
    ".aaaaaaaab.",
    ".aa.aab.ab.",
    ".a...a...b."
  ], { a: "#f4f2ff", b: "#c8c4e8", k: "#2a2438", o: "#6a5a88" }, a);
}

// Cristales de cueva en racimo, con su resplandor
function cristales(l, x, base, [color, claro], a) {
  brillo(l, x, base - 5, 11, color, 0.5, 0.32);
  for (const [dx, alto, inclina] of [[-6, 4, -0.6], [5, 5, 0.6], [-3, 8, -0.3], [3, 7, 0.35], [0, 12, 0]]) {
    for (let k = 0; k < alto; k++) {
      const px = x + dx + Math.round(k * inclina);
      l.poner(px, base - k, k >= alto - 1 ? "#ffffff" : claro, a);
      if (k < alto - 2) l.poner(px + 1, base - k, color, a);
    }
  }
}

// Olas que avanzan hacia la derecha: suben despacio y caen de golpe por delante (con espuma)
function olas(l, { base, alto, crestas, color, claro, espuma, a }) {
  const periodo = l.ancho / crestas;
  for (let x = 0; x < l.ancho; x++) {
    const t = (x % periodo) / periodo;
    const f = t < 0.72 ? (t / 0.72) ** 1.8 : Math.max(0, 1 - (t - 0.72) / 0.16);
    const top = Math.round(base - f * alto);
    for (let y = top; y < l.alto; y++) {
      const d = y - top;
      let c = d < 2 || (d < 4 && umbral(x, y) < 0.5) ? claro : color;
      if (d === 0 && f > 0.3) c = espuma;
      if (t > 0.72 && t < 0.9 && d < 3) c = espuma;
      l.poner(x, y, c, a);
    }
    if (f > 0.9 && x % 2 === 0) l.poner(x + 1, top - 1, espuma, a);
  }
}

// Una cortina de aurora: un borde de abajo brillante que ondea y, encima, rayos verticales (cada
// unos 8 píxeles uno fuerte) que se apagan hacia arriba
function cortina(l, azar, { base, alto, colores: [borde, medio, arriba], a }) {
  const fases = [azar(), azar(), azar(), azar()].map((f) => f * Math.PI * 2);
  const onda = (x, k, f) => Math.sin((2 * Math.PI * k * x) / l.ancho + f);
  for (let x = 0; x < l.ancho; x++) {
    const bajo = base + Math.round(onda(x, 1, fases[0]) * 7 + onda(x, 3, fases[1]) * 3);
    const largo = alto + Math.round(onda(x, 2, fases[2]) * 8);
    const rayo = 0.5 + 0.5 * Math.cos((2 * Math.PI * 32 * x) / l.ancho + onda(x, 4, fases[3]) * 2);
    const fuerza = 0.4 + 0.6 * rayo;
    for (let k = 0; k < largo; k++) {
      const t = k / largo;
      const y = bajo - k;
      if (k < 2) l.poner(x, y, borde, a);
      else if (umbral(x, y) < fuerza * (1 - t) ** 0.9) l.poner(x, y, t < 0.35 ? medio : arriba, t < 0.35 ? a : a * 0.8);
    }
  }
}

// Dibujitos de 4×5 para las tragaperras: «7», cerezas y «BAR»
const SIMBOLOS = {
  siete: ["rrrr", "...r", "..r.", ".r..", ".r.."],
  cereza: ["..gg", ".g.g", ".g.g", "rr.r", "rr.."],
  bar: ["....", "kkkk", "k..k", "kkkk", "...."]
};
const COLOR_SIMBOLO = { r: "#d8283a", g: "#3a9a4a", k: "#2a2228" };

// Sin pantalla: sin los dibujos de los rodillos ni la palanca (los pone pantallaTragaperras)
function tragaperras(l, x, base, [cuerpo, sombra], simbolos, a, sinPantalla = false) {
  rect(l, x, base - 32, 20, 32, cuerpo, a);
  rect(l, x + 16, base - 32, 4, 32, sombra, a);
  rect(l, x, base - 33, 20, 3, "#f0c040", a);
  for (let k = 1; k < 20; k += 3) l.poner(x + k, base - 32, "#fff6c0", a);
  rect(l, x + 2, base - 26, 16, 11, "#3a2a30", a);
  rect(l, x + 3, base - 25, 14, 9, "#f4f0e6", a);
  if (sinPantalla) simbolos = [];
  simbolos.forEach((nombre, i) => {
    SIMBOLOS[nombre].forEach((fila, dy) => {
      [...fila].forEach((c, dx) => { if (c !== ".") l.poner(x + 4 + i * 5 + dx, base - 23 + dy, COLOR_SIMBOLO[c], a); });
    });
  });
  rect(l, x + 4, base - 9, 12, 4, "#2a2228", a);
  for (const dx of [6, 9, 12]) l.poner(x + dx, base - 7, "#f0c040", a);
  if (sinPantalla) return;
  rect(l, x + 20, base - 26, 1, 10, "#b8b8c0", a);
  rect(l, x + 20, base - 28, 2, 2, "#e83a4a", a);
}

// La pantalla y la palanca de la tragaperras que se pone en marcha. dibujo: 0 quieta, 1 palanca
// abajo y rodillos girando, 2 y 3 rodillos girando, 4 el premio (tres sietes y la pantalla dorada)
function pantallaTragaperras(l, x, base, dibujo) {
  const a = 0.95;
  rect(l, x + 3, base - 25, 14, 9, dibujo === 4 ? "#fff3a0" : "#f4f0e6", a);
  if (dibujo === 0 || dibujo === 4) {
    (dibujo === 4 ? ["siete", "siete", "siete"] : ["cereza", "bar", "siete"]).forEach((nombre, i) => {
      SIMBOLOS[nombre].forEach((fila, dy) => [...fila].forEach((c, dx) => {
        if (c !== ".") l.poner(x + 4 + i * 5 + dx, base - 23 + dy, COLOR_SIMBOLO[c], a);
      }));
    });
  } else {
    for (let i = 0; i < 3; i++) {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 4; dx++) if ((dy + dibujo * 2 + i) % 3 === 0) l.poner(x + 4 + i * 5 + dx, base - 24 + dy, dx % 2 ? "#d8283a" : "#9a90a0", a);
      }
    }
  }
  if (dibujo === 4) {
    for (const [dx, dy] of [[1, -29], [10, -30], [18, -29], [-2, -20], [22, -20]]) mapa(l, x + dx, base + dy, DESTELLO_PREMIO, { a: "#fff3a0", b: "#ffffff" }, a);
    for (const dx of [5, 8, 11, 14]) rect(l, x + dx, base - 8, 2, 2, "#f0c040", a);
  }
  if (dibujo === 1) {
    rect(l, x + 20, base - 18, 1, 6, "#b8b8c0", a);
    rect(l, x + 20, base - 12, 2, 2, "#e83a4a", a);
  } else {
    rect(l, x + 20, base - 26, 1, 10, "#b8b8c0", a);
    rect(l, x + 20, base - 28, 2, 2, "#e83a4a", a);
  }
}
const DESTELLO_PREMIO = [".a.", "aba", ".a."];

function ficha(l, x, y, a) {
  const dibujo = [".ooo.", "oyyyo", "oy.yo", "oyyyo", ".ooo."];
  dibujo.forEach((fila, dy) => [...fila].forEach((c, dx) => {
    if (c === "o") l.poner(x + dx, y + dy, "#b8862a", a);
    if (c === "y") l.poner(x + dx, y + dy, dx + dy < 3 ? "#fff2a0" : "#f0c040", a);
  }));
}

// Copos: de un píxel (lejos), en cruz o de seis brazos (cerca)
function copo(l, x, y, tam, a) {
  l.poner(x, y, "#ffffff", a);
  if (tam < 1) return;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, "#e6f0fa", a);
  if (tam < 2) return;
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) l.poner(x + dx, y + dy, "#ffffff", a);
  for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) l.poner(x + dx, y + dy, "#cfe0f2", a);
}

// ---------- La Tienda ----------
//
// Cada fondo: sus capas (la primera, la de más arriba) y, si se mueve, cómo. Con cieloDeDia, se le
// añaden detrás unas nubes blancas (y su tinte es un cielo azul claro). En cada capa:
//   ancho × alto, repetir ("x": a lo ancho; "xy": también hacia abajo; "no": una vez), dónde va
//   (desde la izquierda o la derecha y desde arriba o abajo, en píxeles del dibujo) y mueve: lo
//   que se desplaza en una vuelta de la animación, [derecha, abajo] (un múltiplo de su tamaño, para
//   que no se note el salto al volver a empezar), o una función del momento (0…1) si no va recto.

// Lo que hace Wobbuffet en la Guarida Rocket a lo largo de la vuelta (dibujos de pintarWobbuffet)
const WOBBUFFET = secuencia([[0, 0], [0.2, 1], [0.25, 2], [0.3, 3], [0.38, 4], [0.46, 3], [0.54, 4], [0.62, 3], [0.7, 4], [0.78, 2], [0.83, 1], [0.88, 0]], 256);

// La tragaperras que se pone en marcha en el Casino: quieta, baja la palanca, los rodillos giran y
// sale el premio (dibujos de pantallaTragaperras)
const JUGADA = secuencia([[0, 0], [0.55, 1], [0.58, 2], [0.61, 3], [0.64, 2], [0.67, 3], [0.7, 2], [0.73, 4], [0.92, 0]], 256);

// Las estrellas fugaces de «Noche estrellada»: [empieza, acaba] (en la vuelta, de 0 a 1) y de dónde sale
const FUGACES = [[0.12, 0.18, -30], [0.47, 0.53, 120], [0.8, 0.86, 40]];

const TIENDA = {
  hierba: {
    comentario: "Hierba alta: filas de matas, de lejos (claras) a cerca (oscuras), con flores, rocío y dos mariposas",
    cieloDeDia: true,
    tinte: ["linear-gradient(to bottom, rgba(80, 167, 248, 0.8), rgba(116, 189, 255, 0.85) 50%, rgba(150, 212, 255, 0.9))"],
    capas: [{
      nombre: "campo", ancho: 256, alto: 60, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 26, alto: 8, ondas: [[1, 0.3], [3, 0.15]], color: "#86cc6a", claro: "#a6e086", a: 0.7 });
        const filas = [
          ["#7acc5a", "#a8ec86", "#58a844", 0.8], ["#5cbc44", "#8ae06a", "#3e9a32", 0.88],
          ["#46aa36", "#72d054", "#2c8426", 0.94], ["#34962a", "#5cc040", "#1e6e1c", 0.98]
        ];
        filas.forEach(([oscuro, claro, sombra, a], r) => {
          const base = 27 + r * 9;
          rect(l, 0, base, l.ancho, l.alto - base, oscuro, a);
          for (let x = (r % 2) * 6; x < l.ancho; x += 12) {
            mata(l, x + Math.floor(azar() * 2), base, 8 + r * 2 + Math.floor(azar() * 3), [oscuro, claro, sombra], a);
          }
          for (let x = 0; x < l.ancho; x++) if ((x + r) % 3) l.poner(x, base + 1, sombra, a);
          if (r >= 2) {
            for (let i = 0; i < 7; i++) {
              const x = Math.floor(azar() * l.ancho);
              const flor = ["#ffffff", "#ffe066", "#ff8fb1", "#c9a2ff"][i % 4];
              l.poner(x, base - 2, flor, 0.95);
              l.poner(x - 1, base - 1, flor, 0.95);
              l.poner(x + 1, base - 1, flor, 0.95);
              l.poner(x, base - 1, "#ffe066", 0.95);
            }
          }
          for (let i = 0; i < 6; i++) l.poner(Math.floor(azar() * l.ancho), base - 4 - Math.floor(azar() * 4), "#f2fff0", Math.min(1, a + 0.1));
        });
        mariposa(l, 60, 16, "#f6d870", 0.9);
        mariposa(l, 186, 10, "#ffffff", 0.85);
      }
    }]
  },

  bosque: {
    comentario: "Bosque: abetos de lejos (claros y azulados) a cerca (oscuros y grandes), helechos y setas",
    cieloDeDia: true,
    tinte: ["linear-gradient(to bottom, rgba(80, 167, 248, 0.8), rgba(116, 189, 255, 0.85) 50%, rgba(150, 212, 255, 0.9))"],
    capas: [{
      nombre: "arboles", ancho: 256, alto: 68, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 45, alto: 6, ondas: [[2, 0.3], [5, 0.12]], color: "#7ab8a0", claro: "#8ccab0", a: 0.6 });
        for (let i = 0; i < 22; i++) abeto(l, Math.floor((i * l.ancho) / 22 + azar() * 6), 42, 12 + Math.floor(azar() * 6), ["#7ab8a8", "#90cab8", "#acdccc"], 0.6);
        monte(l, azar, { base: 57, alto: 6, ondas: [[3, 0.3], [7, 0.1]], color: "#3a925c", claro: "#4aa86c", a: 0.85 });
        for (let i = 0; i < 14; i++) abeto(l, Math.floor((i * l.ancho) / 14 + azar() * 8), 54, 18 + Math.floor(azar() * 8), ["#3a925c", "#4aa86c", "#6cc488"], 0.85);
        suelo(l, 58, ["#4a8a3a", "#3c7630", "#2e6226"], 0.95);
        for (let i = 0; i < 8; i++) abeto(l, Math.floor((i * l.ancho) / 8 + 10 + azar() * 12), 66, 34 + Math.floor(azar() * 12), ["#1c5a30", "#267040", "#3e9058"], 0.96);
        for (let i = 0; i < 12; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 62 + Math.floor(azar() * 5);
          for (let k = 1; k <= 3; k++) {
            l.poner(x - k, y - k + 1, "#5aa060", 0.92);
            l.poner(x + k, y - k + 1, "#4a9050", 0.92);
          }
          l.poner(x, y - 2, "#6ab470", 0.92);
          l.poner(x, y, "#3a7040", 0.92);
        }
        for (const x of [30, 101, 160, 222]) {
          rect(l, x, 63, 1, 3, "#f0e6d0", 0.95);
          rect(l, x - 2, 61, 5, 2, "#d23a2a", 0.95);
          l.poner(x - 1, 61, "#ffffff", 0.95);
          l.poner(x + 1, 62, "#ffffff", 0.95);
        }
      }
    }]
  },

  cueva: {
    comentario: "Cueva: el techo con estalactitas que gotean y murciélagos, y abajo estalagmitas, rocas, un charco y racimos de cristales que brillan",
    tinte: ["radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(30, 22, 18, 0.32))", "linear-gradient(to bottom, rgba(70, 55, 40, 0.24), transparent 50%, rgba(70, 55, 40, 0.2))"],
    capas: [{
      nombre: "techo", ancho: 256, alto: 32, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let x = 0; x < l.ancho; x++) {
          const grosor = 4 + Math.round(Math.sin((x * 2 * Math.PI) / 64) * 1.2 + Math.sin((x * 2 * Math.PI) / 23) * 0.8);
          for (let y = 0; y < grosor; y++) l.poner(x, y, y === grosor - 1 ? "#7a665a" : "#4e3e38", 0.75);
        }
        let x = 2;
        while (x < l.ancho - 4) {
          const ancho = 3 + Math.floor(azar() * 6);
          const largo = 5 + Math.floor(azar() * 22);
          const cx = x + Math.floor(ancho / 2);
          for (let fila = 0; fila < largo; fila++) {
            const media = Math.round((ancho / 2) * (1 - fila / largo) ** 0.8);
            for (let dx = -media; dx <= media; dx++) l.poner(cx + dx, 3 + fila, dx < 0 ? "#7a665a" : dx === media && media > 0 ? "#3a2e2a" : "#5e4c44", 0.72);
          }
          if (azar() < 0.4) {
            l.poner(cx, 3 + largo + 1, "#a8d8f0", 0.8);
            l.poner(cx, 3 + largo + 4, "#a8d8f0", 0.6);
          }
          x += ancho + Math.floor(azar() * 4);
        }
        const VOLANDO = ["...a.a...", "b..rar..b", "ab.aaa.ba", ".aaaaaaa.", "..a...a.."];
        const COLGADO = [".a.", "aaa", "ara", "aaa", "a.a"];
        for (const [x, y] of [[36, 17], [128, 22], [204, 13]]) mapa(l, x, y, VOLANDO, { a: "#4a3a5e", b: "#7a6a90", r: "#ff4a4a" }, 0.95);
        for (const x of [86, 168]) mapa(l, x, 4, COLGADO, { a: "#4a3a5e", r: "#ff4a4a" }, 0.95);
      }
    }, {
      nombre: "suelo", ancho: 256, alto: 48, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 30, alto: 14, ondas: [[2, 0.3], [5, 0.15], [11, 0.06]], color: "#3e322e", claro: "#4e403a", a: 0.4 });
        monte(l, azar, { base: 42, alto: 6, ondas: [[3, 0.3], [8, 0.12]], color: "#4e3e38", claro: "#6a5850", a: 0.8 });
        let x = 0;
        while (x < l.ancho - 4) {
          const ancho = 4 + Math.floor(azar() * 6);
          const largo = 4 + Math.floor(azar() * 14);
          const cx = x + Math.floor(ancho / 2);
          for (let fila = 0; fila < largo; fila++) {
            const media = Math.round((ancho / 2) * (fila / largo) ** 0.8);
            for (let dx = -media; dx <= media; dx++) l.poner(cx + dx, 42 - largo + fila, dx < 0 ? "#7a665a" : "#5e4c44", 0.78);
          }
          x += ancho + 6 + Math.floor(azar() * 14);
        }
        // El charco
        for (let y = -3; y <= 3; y++) {
          for (let dx = -20; dx <= 20; dx++) {
            if ((dx * dx) / 400 + (y * y) / 9 > 1) continue;
            l.poner(150 + dx, 44 + y, y === -3 || (dx + y) % 7 === 0 ? "#6fa8d0" : "#1c3a5a", 0.75);
          }
        }
        cristales(l, 40, 42, ["#9a6aff", "#cdb0ff"], 0.9);
        cristales(l, 118, 43, ["#3ac8f0", "#a8ecff"], 0.9);
        cristales(l, 196, 42, ["#ff6ab0", "#ffb8d8"], 0.9);
        cristales(l, 236, 44, ["#3ac8f0", "#a8ecff"], 0.9);
        for (let i = 0; i < 30; i++) l.poner(Math.floor(azar() * l.ancho), 44 + Math.floor(azar() * 4), "#7a665a", 0.85);
      }
    }]
  },

  atardecer: {
    comentario: "Atardecer: el sol a medio esconder en el mar, con su reflejo, nubes largas, un islote con palmera y pájaros",
    tinte: ["linear-gradient(to top, rgba(255, 160, 80, 0.34), rgba(240, 110, 90, 0.22) 45%, rgba(130, 70, 150, 0.16) 85%, transparent)"],
    capas: [{
      nombre: "sol", ancho: 64, alto: 44, repetir: "no", sitio: { x: 40, lado: "derecha", y: 10, desde: "abajo" },
      pintar(l) {
        for (let y = 0; y < 28; y++) {
          for (let x = 0; x < 64; x++) {
            const d = Math.sqrt((x - 32) ** 2 + (y - 28) ** 2);
            if (d <= 13) l.poner(x, y, d < 7 ? "#fff0b0" : d < 11 || umbral(x, y) < 0.5 ? "#ffd070" : "#ff9a58", 0.9);
            else if (d < 24 && umbral(x, y) < 0.5 * (1 - (d - 13) / 11)) l.poner(x, y, "#ffb070", 0.4);
          }
        }
        for (let y = 29; y < 44; y++) {
          const media = Math.round(13 - (y - 29) * 0.7);
          for (let dx = -media; dx <= media; dx++) if ((dx + y * 3 + 40) % 5 < 3) l.poner(32 + dx, y, y < 34 ? "#ffd080" : "#ff9a60", 0.75);
        }
        for (const [x, y] of [[8, 9], [16, 5], [50, 11]]) {
          l.poner(x - 2, y - 1, "#4a2a4a", 0.75);
          l.poner(x - 1, y, "#4a2a4a", 0.75);
          l.poner(x, y - 1, "#4a2a4a", 0.75);
          l.poner(x + 1, y, "#4a2a4a", 0.75);
          l.poner(x + 2, y - 1, "#4a2a4a", 0.75);
        }
      }
    }, {
      nombre: "nubes", ancho: 256, alto: 20, repetir: "x", sitio: { y: 36, desde: "abajo" },
      pintar(l, azar) {
        for (let i = 0; i < 5; i++) {
          const x = i * 52 + Math.floor(azar() * 20);
          const y = 3 + Math.floor(azar() * 13);
          const largo = 24 + Math.floor(azar() * 26);
          for (let k = 0; k < largo; k++) {
            const grueso = k < 4 || k > largo - 5 ? 1 : 2;
            for (let g = 0; g < grueso; g++) l.poner(x + k, y + g, g === grueso - 1 ? "#ffb890" : "#b07aa0", 0.5);
          }
        }
      }
    }, {
      // El horizonte, 20 píxeles por debajo de lo alto de la capa (encima, el islote)
      nombre: "mar", ancho: 256, alto: 46, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        const tonos = ["#e08a7a", "#9a5a8a", "#5a3a78", "#3a2a60"];
        for (let y = 20; y < l.alto; y++) {
          const t = ((y - 20) / (l.alto - 21)) * (tonos.length - 1);
          for (let x = 0; x < l.ancho; x++) {
            const i = Math.min(tonos.length - 1, Math.floor(t + umbral(x, y) - 0.5));
            l.poner(x, y, tonos[Math.max(0, i)], 0.6);
          }
        }
        for (let i = 0; i < 40; i++) rect(l, Math.floor(azar() * l.ancho), 22 + Math.floor(azar() * 22), 2 + Math.floor(azar() * 3), 1, "#ffb890", 0.65);
        for (let x = 22; x <= 58; x++) {
          const t = (x - 22) / 36;
          const alto = Math.round(Math.sin(t * Math.PI) * 6);
          for (let y = 20 - alto; y <= 21; y++) l.poner(x, y, "#2a1a3a", 0.85);
        }
        palmera(l, 42, 16, 14, ["#1e1230", "#2a1a40", "#2a1a3a"], 0.85, -1);
      }
    }]
  },

  magma: {
    comentario: "Magma: roca oscura agrietada con la lava brillando por las grietas, un río de lava con burbujas y brasas en el aire",
    tinte: ["linear-gradient(to top, rgba(230, 80, 30, 0.36), rgba(140, 35, 20, 0.14) 55%, transparent)"],
    capas: [{
      nombre: "roca", ancho: 256, alto: 50, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 26, alto: 18, ondas: [[2, 0.3], [5, 0.2], [13, 0.06]], color: "#4e2c26", claro: "#6a3a2e", a: 0.45 });
        const tope = monte(l, azar, { base: 36, alto: 14, ondas: [[3, 0.3], [7, 0.15], [17, 0.06]], color: "#2e1a18", claro: "#4a2a22", a: 0.85 });
        // Las grietas: primero el resplandor, luego la lava
        const puntos = [];
        for (let i = 0; i < 9; i++) {
          let x = Math.floor((i * l.ancho) / 9 + azar() * 20);
          let y = tope[vuelta(x, l.ancho)] + 2;
          for (let k = 0; k < 6 + Math.floor(azar() * 10) && y < 44; k++) {
            puntos.push([x, y]);
            y += 1;
            x += Math.round((azar() - 0.5) * 2.6);
          }
        }
        for (const [x, y] of puntos) brillo(l, x, y, 3, "#ff5a1a", 0.5, 0.5);
        puntos.forEach(([x, y], i) => l.poner(x, y, i % 3 ? "#ff7a2a" : "#ffd060", 0.95));
        for (let x = 0; x < l.ancho; x++) {
          const top = 43 + Math.round(Math.sin((x * 2 * Math.PI) / 32) * 1.2);
          for (let y = top; y < l.alto; y++) {
            const caliente = (y - top) / 6 + umbral(x, y) - 0.5;
            l.poner(x, y, y === top ? "#ffe8a0" : caliente > 0.5 ? "#ff8a2a" : "#ffc040", 0.85);
          }
          if ((x * 7) % 23 === 0) l.poner(x, top + 2, "#6a2a1a", 0.85);
        }
        for (const x of [34, 90, 170, 214]) {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) l.poner(x + dx, 46 + dy, "#ffe8a0", 0.9);
        }
      }
    }, {
      nombre: "brasas", ancho: 96, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 18; i++) {
          const x = Math.floor(azar() * 96);
          const y = Math.floor(azar() * 96);
          const c = ["#ffb040", "#ff7a2a", "#ffe080"][i % 3];
          l.poner(x, y, c, 0.75);
          if (i % 3 === 0) l.poner(x, y + 1, "#ff5a1a", 0.55);
        }
      }
    }]
  },

  olas: {
    comentario: "Surf: tres filas de olas que avanzan, cada una a su velocidad (las de delante, más deprisa y con espuma)",
    cieloDeDia: true,
    tinte: ["linear-gradient(to bottom, rgba(80, 167, 248, 0.8), rgba(116, 189, 255, 0.85) 50%, rgba(150, 212, 255, 0.9))"],
    animacion: { duracion: 12, pasos: 128 },
    capas: [{
      nombre: "delante", ancho: 128, alto: 16, repetir: "x", sitio: { y: 0, desde: "abajo" }, mueve: [384, 0],
      pintar(l) { olas(l, { base: 11, alto: 8, crestas: 1, color: "#2a7cb8", claro: "#4aa2d8", espuma: "#f2fbff", a: 0.78 }); }
    }, {
      nombre: "medio", ancho: 128, alto: 12, repetir: "x", sitio: { y: 12, desde: "abajo" }, mueve: [256, 0],
      pintar(l) { olas(l, { base: 8, alto: 5, crestas: 2, color: "#3a90c8", claro: "#62b4e2", espuma: "#e6f7ff", a: 0.62 }); }
    }, {
      nombre: "lejos", ancho: 128, alto: 10, repetir: "x", sitio: { y: 22, desde: "abajo" }, mueve: [128, 0],
      pintar(l) { olas(l, { base: 7, alto: 3, crestas: 4, color: "#5aaad8", claro: "#86c6ea", espuma: "#d8f2ff", a: 0.48 }); }
    }, {
      nombre: "mar", ancho: 256, alto: 36, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        const tonos = ["#9ad4f2", "#6ab8e6", "#4aa2d8"];
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const i = Math.floor((y / l.alto) * 2.6 + umbral(x, y) - 0.5);
            l.poner(x, y, tonos[Math.max(0, Math.min(2, i))], 0.38);
          }
        }
        for (let i = 0; i < 30; i++) rect(l, Math.floor(azar() * l.ancho), Math.floor(azar() * 14), 2, 1, "#ffffff", 0.6);
      }
    }]
  },

  nieve: {
    comentario: "Nevada: copos que caen (los grandes, más deprisa y de lado: están más cerca), pinos nevados y una cabaña con la luz encendida",
    tinte: ["linear-gradient(to bottom, rgba(100, 150, 215, 0.36), rgba(150, 195, 235, 0.14) 85%)"],
    animacion: { duracion: 12, pasos: 128 },
    capas: [{
      nombre: "copos-cerca", ancho: 128, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: [128, 256],
      pintar(l, azar) {
        for (let i = 0; i < 9; i++) copo(l, Math.floor(azar() * 128), Math.floor(azar() * 128), i % 3 ? 1 : 2, 0.88);
      }
    }, {
      nombre: "paisaje", ancho: 256, alto: 40, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 22, alto: 10, ondas: [[2, 0.3], [5, 0.12]], color: "#c8d8ea", claro: "#e6eff8", a: 0.4 });
        for (let i = 0; i < 18; i++) pino(l, Math.floor((i * l.ancho) / 18 + azar() * 8), 30 + Math.floor(azar() * 3), 9 + Math.floor(azar() * 7), ["#2e4e4c", "#3e6662", "#ffffff"], 0.72, true);
        // La cabaña
        const [cx, base] = [70, 34];
        rect(l, cx, base - 9, 16, 9, "#7a5236", 0.92);
        for (let y = base - 8; y < base; y += 2) rect(l, cx, y, 16, 1, "#5e3e28", 0.92);
        rect(l, cx + 12, base - 15, 2, 4, "#4a3a34", 0.92);
        for (let r = 0; r < 5; r++) for (let k = -2 + r; k <= 17 - r; k++) l.poner(cx + k, base - 10 - r, r === 0 ? "#dfe8f3" : "#ffffff", 0.95);
        brillo(l, cx + 4, base - 5, 6, "#ffd66b", 0.5, 0.4);
        rect(l, cx + 3, base - 6, 3, 3, "#ffd66b", 0.95);
        rect(l, cx + 9, base - 5, 3, 5, "#3e2a1c", 0.95);
        for (let i = 0; i < 4; i++) disco(l, cx + 13 + i * 2, base - 18 - i * 3, 1 + (i >> 1), "#c8ccd4", 0.35);
        monte(l, azar, { base: 37, alto: 6, ondas: [[3, 0.3], [7, 0.12]], color: "#eef4fa", claro: "#ffffff", a: 0.85 });
        for (let i = 0; i < 20; i++) l.poner(Math.floor(azar() * l.ancho), 36 + Math.floor(azar() * 4), "#b8cce4", 0.9);
      }
    }, {
      nombre: "copos-lejos", ancho: 64, alto: 64, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: [0, 128],
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) copo(l, Math.floor(azar() * 64), Math.floor(azar() * 64), i % 5 ? 0 : 1, 0.6);
      }
    }]
  },

  noche: {
    comentario: "Noche estrellada: estrellas que titilan cada una a su ritmo, la luna, colinas con una casita y luciérnagas y, de vez en cuando, estrellas fugaces",
    tinte: ["linear-gradient(170deg, rgba(60, 70, 160, 0.36), rgba(20, 22, 60, 0.26) 70%)"],
    // Las estrellas: cuatro dibujos uno al lado del otro (cada estrella, más o menos brillante en
    // cada uno) que se turnan cada 0,6 s sin moverse de su sitio. Las fugaces: tres a lo largo de
    // la vuelta, cada una en su momento y por su sitio.
    animacion: { duracion: 12, paradas: [0, ...saltos(20), ...FUGACES.flatMap(([desde, hasta]) => [desde, hasta]), 1] },
    capas: [
      ...FUGACES.map(([desde, hasta, x], k) => ({
        nombre: `fugaz-${k + 1}`, archivo: "fugaz", ancho: 32, alto: 16, repetir: "no", sitio: { x, lado: "derecha", y: -20, desde: "arriba" },
        mueve: (t) => {
          const p = Math.max(0, Math.min(1, (t - desde) / (hasta - desde)));
          return [-p * 300, p * 150];
        },
        pintar: k ? undefined : (l) => {
          for (let n = 0; n < 28; n++) {
            const px = 3 + n;
            const py = 13 - Math.round(n * 0.45);
            if (n < 6 || umbral(px, py) < 1 - n / 28) l.poner(px, py, n < 3 ? "#ffffff" : n < 12 ? "#e6ecff" : "#9aaae0", 0.95 - n * 0.02);
          }
          rect(l, 2, 12, 2, 2, "#ffffff", 1);
        }
      })), {
      nombre: "luna", ancho: 26, alto: 26, repetir: "no", sitio: { x: 28, lado: "derecha", y: 8, desde: "arriba" },
      pintar(l) {
        brillo(l, 13, 13, 12, "#c9d4ff", 0.45, 0.25);
        for (let y = 0; y < 26; y++) {
          for (let x = 0; x < 26; x++) {
            const dentro = (x - 13) ** 2 + (y - 13) ** 2 <= 70;
            const corte = (x - 17) ** 2 + (y - 10) ** 2 <= 52;
            if (dentro && !corte) l.poner(x, y, (x + y) % 6 === 0 ? "#d8d4c0" : "#f3f1e2", 0.95);
            else if (corte && dentro) l.poner(x, y, "#000000", 0);
          }
        }
      }
    }, {
      nombre: "colinas", ancho: 256, alto: 36, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 20, alto: 12, ondas: [[2, 0.3], [5, 0.12]], color: "#1c2a48", claro: "#24365a", a: 0.55 });
        for (let i = 0; i < 12; i++) pino(l, Math.floor((i * l.ancho) / 12 + azar() * 10), 28 + Math.floor(azar() * 3), 8 + Math.floor(azar() * 6), ["#0c1626", "#122036", "#122036"], 0.85);
        monte(l, azar, { base: 31, alto: 8, ondas: [[3, 0.3], [7, 0.1]], color: "#121c34", claro: "#1a2844", a: 0.82 });
        const [cx, base] = [180, 30];
        rect(l, cx, base - 6, 10, 6, "#1e2a40", 0.92);
        for (let r = 0; r < 4; r++) for (let k = -1 + r; k <= 10 - r; k++) l.poner(cx + k, base - 7 - r, "#2a3550", 0.92);
        brillo(l, cx + 3, base - 3, 5, "#ffd66b", 0.45, 0.4);
        rect(l, cx + 2, base - 4, 2, 2, "#ffe08a", 1);
        for (let i = 0; i < 14; i++) l.poner(Math.floor(azar() * l.ancho), 14 + Math.floor(azar() * 20), "#d8ff70", 0.9);
      }
    }, {
      nombre: "estrellas", ancho: 384, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      mueve: (t) => [(Math.floor(t * 20 + 1e-6) % 4) * 96, 0],
      pintar(l, azar) {
        for (let i = 0; i < 34; i++) {
          const x = Math.floor(azar() * 96);
          const y = Math.floor(azar() * 96);
          const fase = Math.floor(azar() * 4);
          const titila = i % 3 !== 0;
          const grande = i % 5 === 0;
          for (let dibujo = 0; dibujo < 4; dibujo++) {
            const nivel = titila ? [3, 2, 1, 2][(dibujo + fase) % 4] : 2; // 3: brilla mucho; 1: casi apagada
            const px = x + dibujo * 96;
            if (nivel === 1) {
              l.poner(px, y, "#6a78b8", 0.6);
              continue;
            }
            l.poner(px, y, "#ffffff", nivel === 3 ? 1 : 0.8);
            if (nivel === 3 || grande) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(px + dx, y + dy, "#a8b8f0", nivel === 3 ? 0.75 : 0.45);
          }
        }
      }
    }]
  },

  casino: {
    comentario: "Casino: dos filas de bombillas que se persiguen como en un cartel, tragaperras (de vez en cuando una se pone en marcha y da premio), fichas y la moqueta de rombos",
    tinte: ["linear-gradient(160deg, rgba(200, 60, 150, 0.26), rgba(90, 40, 140, 0.22) 60%, rgba(241, 196, 15, 0.1))"],
    // Las bombillas avanzan una cada 0,45 s; la tragaperras, como dice JUGADA
    animacion: { duracion: 7.2, paradas: [0, ...saltos(16), ...JUGADA.paradas, 1] },
    capas: [{
      nombre: "bombillas", archivo: "bombillas", ancho: 8, alto: 6, repetir: "x", sitio: { y: 1, desde: "arriba" }, mueve: (t) => [turno(t, 16) * 4, 0],
      pintar(l) {
        for (const [x, color, centro] of [[1, "#ffd040", "#ffffff"], [5, "#7a5a28", "#9a7a40"]]) {
          rect(l, x, 1, 3, 3, color, 0.95);
          l.poner(x + 1, 2, centro, 0.95);
        }
        rect(l, 0, 5, 8, 1, "#3a2a40", 0.6);
      }
    }, {
      nombre: "bombillas-abajo", archivo: "bombillas", ancho: 8, alto: 6, repetir: "x", sitio: { y: 1, desde: "abajo" }, mueve: (t) => [-turno(t, 16) * 4, 0]
    }, {
      nombre: "jugada", ancho: 1280, alto: 40, repetir: "x", sitio: { y: 8, desde: "abajo" }, mueve: JUGADA.mueve,
      pintar(l) {
        for (let dibujo = 0; dibujo < 5; dibujo++) pantallaTragaperras(l, dibujo * 256 + 6 + 3 * 32, 40, dibujo);
      }
    }, {
      nombre: "maquinas", ancho: 256, alto: 40, repetir: "x", sitio: { y: 8, desde: "abajo" },
      pintar(l) {
        const colores = [["#b8283a", "#8c1c2c"], ["#2a4ab8", "#1c348c"], ["#7a2ab8", "#5a1c8c"]];
        const tiradas = [["siete", "siete", "siete"], ["cereza", "bar", "siete"], ["bar", "bar", "cereza"], ["cereza", "cereza", "cereza"]];
        for (let i = 0; i < 8; i++) tragaperras(l, 6 + i * 32, 40, colores[i % 3], tiradas[i % 4], 0.75, i === 3);
      }
    }, {
      nombre: "fichas", ancho: 128, alto: 80, repetir: "xy", sitio: { x: 20, y: 10, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 7; i++) ficha(l, Math.floor(azar() * 123), Math.floor(azar() * 75), 0.6);
        for (let i = 0; i < 6; i++) {
          const x = Math.floor(azar() * 128);
          const y = Math.floor(azar() * 80);
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, "#fff2a0", dx || dy ? 0.4 : 0.7);
        }
      }
    }, {
      nombre: "rombos", ancho: 16, alto: 16, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.abs(x - 8) + Math.abs(y - 8) === 8) l.poner(x, y, "#d06ab0", 0.18);
      }
    }]
  },

  aurora: {
    comentario: "Aurora: dos cortinas de luz (verde y violeta) que ondean una contra otra sobre montañas nevadas, con su reflejo en un lago helado",
    tinte: ["linear-gradient(to bottom, rgba(20, 30, 70, 0.38), rgba(30, 80, 90, 0.12) 70%, transparent)"],
    animacion: { duracion: 24, pasos: 256 },
    capas: [{
      nombre: "paisaje", ancho: 256, alto: 40, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 28, alto: 20, ondas: [[2, 0.35], [5, 0.12]], color: "#1a2444", claro: "#26345c", a: 0.72, hasta: 31, nieve: 18 });
        for (let i = 0; i < 16; i++) pino(l, Math.floor((i * l.ancho) / 16 + azar() * 10), 30, 6 + Math.floor(azar() * 6), ["#0a1424", "#101c30", "#101c30"], 0.85);
        rect(l, 0, 31, l.ancho, 9, "#0e1e32", 0.7);
        rect(l, 0, 31, l.ancho, 1, "#3a5a78", 0.7);
        const fase = azar() * 6;
        for (let x = 0; x < l.ancho; x++) {
          const fuerza = 0.5 + 0.5 * Math.sin((x * 2 * Math.PI * 3) / l.ancho + fase);
          for (let y = 32; y < 38; y++) if (umbral(x, y) < fuerza * 0.55 * (1 - (y - 32) / 6)) l.poner(x, y, y < 34 ? "#7fffb0" : "#4fe0a0", 0.5);
        }
        for (let i = 0; i < 10; i++) l.poner(Math.floor(azar() * l.ancho), 34 + Math.floor(azar() * 6), "#c9d4ff", 0.6);
      }
    }, {
      nombre: "verde", ancho: 256, alto: 56, repetir: "x", sitio: { y: 2, desde: "arriba" }, mueve: [256, 0],
      pintar(l, azar) { cortina(l, azar, { base: 50, alto: 36, colores: ["#b0ffd8", "#4fe0a0", "#3a9ac8"], a: 0.55 }); }
    }, {
      nombre: "violeta", ancho: 256, alto: 50, repetir: "x", sitio: { y: 10, desde: "arriba" }, mueve: [-256, 0],
      pintar(l, azar) { cortina(l, azar, { base: 44, alto: 30, colores: ["#f0c8ff", "#a07aff", "#5a6ad8"], a: 0.4 }); }
    }, {
      nombre: "estrellas", ancho: 96, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 22; i++) l.poner(Math.floor(azar() * 96), Math.floor(azar() * 96), i % 4 ? "#c9d4ff" : "#ffffff", 0.6);
      }
    }]
  },

  desierto: {
    comentario: "Desierto: el cielo de día, el sol que aprieta, dunas con su borde al sol, cactus y las columnas de unas ruinas antiguas",
    tinte: ["linear-gradient(to bottom, rgba(80, 160, 240, 0.78), rgba(150, 205, 250, 0.74) 45%, rgba(255, 220, 160, 0.72) 75%, rgba(245, 190, 120, 0.62))"],
    capas: [{
      nombre: "sol", ancho: 50, alto: 50, repetir: "no", sitio: { x: 30, lado: "derecha", y: 4, desde: "arriba" },
      pintar(l) {
        brillo(l, 25, 25, 24, "#fff4c0", 0.6, 0.5);
        disco(l, 25, 25, 10, "#ffe070", 1);
        disco(l, 25, 25, 7, "#fff6d0", 1);
        disco(l, 23, 23, 3, "#ffffff", 1);
      }
    }, {
      nombre: "dunas", ancho: 256, alto: 56, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 32, alto: 12, ondas: [[1, 0.4], [2, 0.15]], color: "#e8c890", claro: "#f6e0b0", a: 0.6 });
        // Las ruinas: columnas (alguna rota) y un arco
        const columna = (x, alto, rota) => {
          const base = 34;
          rect(l, x, base - alto, 5, alto, "#c8a070", 0.6);
          rect(l, x, base - alto, 1, alto, "#e0c090", 0.6);
          rect(l, x + 4, base - alto, 1, alto, "#a07a50", 0.6);
          if (rota) for (let k = 0; k < 5; k++) l.poner(x + k, base - alto - (k % 2), "#c8a070", 0.6);
          else rect(l, x - 1, base - alto - 2, 7, 2, "#d8b080", 0.6);
          rect(l, x - 1, base - 2, 7, 2, "#a07a50", 0.6);
        };
        columna(150, 20, false);
        columna(172, 20, false);
        rect(l, 149, 12, 29, 3, "#d8b080", 0.6);
        columna(196, 13, true);
        columna(214, 8, true);
        monte(l, azar, { base: 42, alto: 10, ondas: [[2, 0.35], [3, 0.12]], color: "#e4b876", claro: "#f6d898", a: 0.82 });
        const cerca = monte(l, azar, { base: 50, alto: 8, ondas: [[1, 0.3], [3, 0.2]], color: "#d8a462", claro: "#f0c486", a: 0.94 });
        for (let x = 0; x < l.ancho; x++) {
          for (let y = cerca[x] + 3; y < l.alto; y += 3) if ((x + y * 2) % 9 < 3) l.poner(x, y, "#b88246", 0.85);
        }
        // Cactus
        for (const [x, alto] of [[30, 16], [96, 12], [238, 18]]) {
          const base = cerca[x] + 2;
          rect(l, x - 1, base - alto, 3, alto, "#3f8a4a", 0.92);
          rect(l, x - 1, base - alto, 1, alto, "#62ac62", 0.92);
          l.poner(x, base - alto - 1, "#3f8a4a", 0.92);
          const brazo = (lado, altura, largo) => {
            const y = base - Math.round(alto * altura);
            rect(l, lado < 0 ? x - 4 : x + 2, y, 3, 2, "#3f8a4a", 0.92);
            rect(l, lado < 0 ? x - 4 : x + 3, y - largo, 2, largo, lado < 0 ? "#62ac62" : "#2c6a38", 0.92);
          };
          brazo(-1, 0.5, 5);
          brazo(1, 0.65, 4);
          for (let k = 2; k < alto; k += 3) l.poner(x + 1, base - k, "#f4f0c8", 0.92);
        }
        for (let i = 0; i < 12; i++) {
          const x = Math.floor(azar() * l.ancho);
          rect(l, x, cerca[x] + 4 + Math.floor(azar() * 4), 2, 1, "#8a6a48", 0.85);
        }
      }
    }]
  },

  bayas: {
    comentario: "Huerto de bayas: matas cargadas de bayas de colores en surcos de tierra, una valla, un cartel y, al fondo, un molino y un granero",
    cieloDeDia: true,
    tinte: ["linear-gradient(to bottom, rgba(80, 167, 248, 0.8), rgba(116, 189, 255, 0.85) 50%, rgba(150, 212, 255, 0.9))"],
    capas: [{
      nombre: "huerto", ancho: 256, alto: 54, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 26, alto: 8, ondas: [[2, 0.3], [5, 0.12]], color: "#78b860", claro: "#94cc78", a: 0.75 });
        // El molino: torre blanca, tejado de madera y cuatro aspas de listones
        const [mx, mb] = [52, 31];
        for (let r = 0; r < 18; r++) {
          const media = Math.round(6 - r * 0.2);
          rect(l, mx - media, mb - r, media * 2 + 1, 1, "#f2ece0", 0.85);
          l.poner(mx + media, mb - r, "#d6cbb8", 0.85);
          l.poner(mx - media, mb - r, "#fffaf0", 0.85);
        }
        rect(l, mx - 1, mb - 4, 3, 4, "#7a5236", 0.85);
        rect(l, mx - 1, mb - 11, 2, 2, "#6a8aa8", 0.85);
        for (let r = 0; r < 4; r++) rect(l, mx - 4 + r, mb - 18 - r, (4 - r) * 2 + 1, 1, "#8a5a3a", 0.85);
        const eje = [mx, mb - 20];
        for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          for (let k = 1; k <= 10; k++) {
            l.poner(eje[0] + dx * k, eje[1] + dy * k, "#6a4a30", 0.9);
            if (k > 2) l.poner(eje[0] + dx * k + dy, eje[1] + dy * k, k % 2 ? "#e8dcc8" : "#c8b8a0", 0.9);
          }
        }
        rect(l, eje[0] - 1, eje[1] - 1, 2, 2, "#4a3424", 0.9);
        // El granero
        const [gx, gb] = [146, 30];
        rect(l, gx, gb - 10, 20, 10, "#c0392b", 0.85);
        rect(l, gx + 19, gb - 10, 1, 10, "#8e2a20", 0.85);
        for (let r = 0; r < 6; r++) rect(l, gx - 1 + r, gb - 11 - r, 22 - r * 2, 1, r ? "#7a2a20" : "#5a1e18", 0.85);
        rect(l, gx + 7, gb - 7, 6, 7, "#f2ece0", 0.85);
        for (let k = 0; k < 6; k++) {
          l.poner(gx + 7 + k, gb - 7 + k, "#c0392b", 0.85);
          l.poner(gx + 12 - k, gb - 7 + k, "#c0392b", 0.85);
        }
        rect(l, gx + 9, gb - 14, 2, 2, "#f2ece0", 0.85);
        // La valla
        for (let x = 0; x < l.ancho; x++) {
          for (const y of [24, 28]) l.poner(x, y, "#b88a58", 0.75);
          if (x % 10 === 0) {
            rect(l, x, 21, 2, 11, "#a07448", 0.75);
            l.poner(x, 20, "#a07448", 0.75);
          }
        }
        rect(l, 0, 32, l.ancho, 4, "#7aaa58", 0.6);
        // Los surcos
        for (let y = 36; y < l.alto; y++) for (let x = 0; x < l.ancho; x++) l.poner(x, y, Math.floor((y - 36) / 3) % 2 ? "#7a5232" : "#8e6440", 0.85);
        const bayas = [["#e83a3a", "#ff9a9a"], ["#3a6ae8", "#9ab8ff"], ["#f0c030", "#fff0a0"], ["#f08ab8", "#ffd8ea"], ["#9a4ad8", "#d8a8ff"]];
        for (let i = 0; i < 11; i++) {
          const x = 12 + i * 23;
          const base = i % 2 ? 46 : 52;
          const [color, brillo] = bayas[i % bayas.length];
          rect(l, x - 5, base, 11, 2, "#6a4428", 0.9);
          rect(l, x, base - 3, 1, 3, "#4a6a2a", 0.9);
          disco(l, x, base - 8, 5, "#357035", 0.9);
          disco(l, x - 2, base - 9, 4, "#4a8f45", 0.9);
          disco(l, x + 3, base - 7, 3, "#2e6230", 0.9);
          l.poner(x - 3, base - 12, "#7cc06a", 0.9);
          l.poner(x - 2, base - 12, "#7cc06a", 0.9);
          for (const [dx, dy] of [[-4, -8], [1, -11], [3, -6], [-1, -5], [4, -10]]) {
            rect(l, x + dx, base + dy, 2, 2, color, 0.95);
            l.poner(x + dx, base + dy, brillo, 0.95);
          }
        }
        for (let i = 0; i < 18; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 40 + Math.floor(azar() * 13);
          l.poner(x, y, "#6ab45a", 0.9);
          l.poner(x - 1, y - 1, "#6ab45a", 0.9);
          l.poner(x + 1, y - 1, "#6ab45a", 0.9);
        }
        // El cartel
        rect(l, 200, 26, 2, 10, "#7a5236", 0.92);
        rect(l, 195, 20, 12, 7, "#c8965a", 0.92);
        rect(l, 195, 26, 12, 1, "#8a6038", 0.92);
        for (const y of [22, 24]) rect(l, 197, y, 8, 1, "#6a4428", 0.92);
      }
    }]
  },

  eevee: {
    comentario: "Eeveelutions: un paisaje con un tramo para cada una (agua, rayo, fuego, sol, luna, hoja, hielo y hada) que va girando despacio; encima, su piedra u objeto sube y baja con un efecto de su tipo, y unas huellas de Eevee lo cruzan",
    tinte: ["linear-gradient(to bottom, rgba(200, 150, 90, 0.2), transparent 70%)"],
    // A cada paso (1/8 s) el paisaje avanza un píxel y las piezas, además, pasan al dibujo
    // siguiente: en su capa hay 8 dibujos uno al lado del otro (256 × 8) y cada paso se desplaza
    // 1 − 256 = −255 (un píxel a la derecha y un dibujo hacia delante). Tras 2048 pasos todo vuelve a
    // estar donde empezó, sin saltos.
    animacion: { duracion: 256, pasos: 2048 },
    capas: [{
      nombre: "piezas", ancho: 2048, alto: 40, repetir: "x", sitio: { y: 22, desde: "abajo" }, mueve: [2048 * -255, 0],
      pintar(l) {
        const SIMBOLOS_PIEDRA = {
          agua: ["..#..", ".###.", "#####", "#####", ".###."],
          rayo: ["...#.", "..#..", ".###.", "..#..", ".#..."],
          fuego: ["..#..", ".##..", ".###.", "#####", ".###."],
          hoja: ["...##", "..###", ".###.", "###..", "#...."],
          hielo: ["#.#.#", ".###.", "##.##", ".###.", "#.#.#"]
        };
        const piedra = (cx, cy, [color, claro, borde], simbolo, tinta, fuerza) => {
          brillo(l, cx, cy, 11, claro, fuerza, 0.35);
          const dentro = (p, q) => (p / 4.6) ** 2 + (q / 5.6) ** 2 <= 1;
          for (let dy = -6; dy <= 6; dy++) {
            for (let dx = -5; dx <= 5; dx++) {
              if (!dentro(dx, dy)) continue;
              const orilla = !dentro(dx - 1, dy) || !dentro(dx + 1, dy) || !dentro(dx, dy - 1) || !dentro(dx, dy + 1);
              l.poner(cx + dx, cy + dy, orilla ? borde : dx + dy < -3 ? claro : color, 0.95);
            }
          }
          mapa(l, cx - 2, cy - 2, SIMBOLOS_PIEDRA[simbolo], { "#": tinta }, 0.95);
          l.poner(cx - 2, cy - 4, "#ffffff", 0.95);
        };
        const CORAZON = [".a.a.", "aaaaa", ".aaa.", "..a.."];
        const DESTELLO = [".a.", "aba", ".a."];
        const CHISPA = ["#.", ".#", "#."];
        for (let f = 0; f < 8; f++) {
          const fase = (2 * Math.PI * f) / 8;
          const x0 = f * 256;
          const alto = (k) => 18 + Math.round(Math.sin(fase + k * 0.8) * 2);
          const fuerza = 0.42 + 0.14 * Math.sin(fase);

          // Agua: gotas que caen a los lados
          let cx = x0 + 16;
          let cy = alto(0);
          piedra(cx, cy, ["#3a7ad8", "#8ac0ff", "#1c3a7a"], "agua", "#d8f0ff", fuerza);
          for (const [dx, desfase] of [[-8, 0], [7, 6]]) {
            const y = cy - 4 + ((f * 2 + desfase) % 14);
            l.poner(cx + dx, y, "#d8f0ff", 0.85);
            l.poner(cx + dx, y + 1, "#6aa8f0", 0.85);
          }

          // Rayo: chispas en zigzag que saltan de un lado a otro
          cx = x0 + 48;
          cy = alto(1);
          piedra(cx, cy, ["#7ac040", "#c8f080", "#2e5a1a"], "rayo", "#fff060", fuerza);
          if (f % 2 === 0) {
            mapa(l, cx - 9, cy - 7 + (f % 4), CHISPA, { "#": "#fff060" }, 0.95);
            mapa(l, cx + 7, cy + 1, CHISPA, { "#": "#ffffff" }, 0.95);
          } else {
            mapa(l, cx + 7, cy - 6, CHISPA, { "#": "#fff060" }, 0.95);
            mapa(l, cx - 8, cy + 3 - (f % 3), CHISPA, { "#": "#ffffff" }, 0.95);
          }

          // Fuego: una llama encima que baila
          cx = x0 + 80;
          cy = alto(2);
          piedra(cx, cy, ["#e86a2a", "#ffb070", "#7a2a10"], "fuego", "#ffe060", fuerza);
          mapa(l, cx - 2, cy - 11, f % 2 ? ["..a..", ".aa..", ".aba.", "abbba"] : ["..a..", "..aa.", ".aba.", "abbba"], { a: "#ff7a2a", b: "#ffe060" }, 0.92);

          // Sol (Espeon): los rayos se turnan, rectos y en diagonal
          cx = x0 + 112;
          cy = alto(3);
          brillo(l, cx, cy, 12, "#ffc8f0", fuerza + 0.05, 0.35);
          disco(l, cx, cy, 4, "#ffd040", 0.95);
          disco(l, cx - 1, cy - 1, 2, "#fff0a0", 0.95);
          const rectos = [[0, -7], [0, 7], [-7, 0], [7, 0]];
          const diagonales = [[-5, -5], [5, 5], [-5, 5], [5, -5]];
          for (const [dx, dy] of f % 2 ? rectos : diagonales) {
            l.poner(cx + dx, cy + dy, "#ff80c0", 0.95);
            l.poner(cx + Math.round(dx * 0.8), cy + Math.round(dy * 0.8), "#ffb0d8", 0.95);
          }

          // Luna (Umbreon): los anillos se encienden y se apagan, y titila una estrella
          cx = x0 + 144;
          cy = alto(4);
          brillo(l, cx, cy, 12, "#ffe060", fuerza, 0.3);
          for (let dy = -6; dy <= 6; dy++) {
            for (let dx = -6; dx <= 6; dx++) {
              if (dx * dx + dy * dy <= 30 && (dx - 3) ** 2 + (dy + 2) ** 2 > 20) l.poner(cx + dx, cy + dy, dx + dy < -2 ? "#fff4a0" : "#ffd84a", 0.95);
            }
          }
          const anillo = f % 4 < 2 ? "#ffe880" : "#a08a30";
          for (const [dx, dy] of [[5, 5], [7, 1]]) mapa(l, cx + dx - 1, cy + dy - 1, ["aaa", "a.a", "aaa"], { a: anillo }, 0.95);
          if (f % 4 === 0) mapa(l, cx - 9, cy - 8, DESTELLO, { a: "#c9d4ff", b: "#ffffff" }, 0.9);

          // Hoja: dos hojitas que dan vueltas alrededor
          cx = x0 + 176;
          cy = alto(5);
          piedra(cx, cy, ["#3a9a3a", "#8ad080", "#1a4a1a"], "hoja", "#c8f0a0", fuerza);
          for (const giro of [0, Math.PI]) {
            const hx = cx + Math.round(Math.cos(fase + giro) * 9);
            const hy = cy + Math.round(Math.sin(fase + giro) * 5);
            mapa(l, hx - 1, hy - 1, [".a", "ab"], { a: "#8ad070", b: "#4a8a3a" }, 0.95);
          }

          // Hielo: destellos que aparecen alrededor
          cx = x0 + 208;
          cy = alto(6);
          piedra(cx, cy, ["#7ad0e8", "#d8f8ff", "#2a6a8a"], "hielo", "#ffffff", fuerza);
          const [sx, sy] = [[-9, -6], [8, -3], [-7, 6], [9, 7]][f % 4];
          mapa(l, cx + sx - 1, cy + sy - 1, DESTELLO, { a: "#9ae8ff", b: "#ffffff" }, 0.95);

          // Hada (Sylveon): el lazo y corazones que suben
          cx = x0 + 240;
          cy = alto(7);
          brillo(l, cx, cy + 1, 12, "#ffb8d8", fuerza, 0.35);
          mapa(l, cx - 5, cy - 3, [
            "##.....##",
            "###...###",
            "####o####",
            "###...###",
            "##.b.b.##",
            "...b.b...",
            "..b...b.."
          ], { "#": "#ff7ab0", o: "#c8407a", b: "#6ab0ff" }, 0.95);
          mapa(l, cx + 6, cy - 2 - ((f * 2) % 12), CORAZON, { a: "#ff8ac0" }, 0.85);
        }
      }
    }, {
      nombre: "tramos", ancho: 256, alto: 64, repetir: "x", sitio: { y: 0, desde: "abajo" }, mueve: [2048, 0],
      pintar(l, azar) {
        const TRAMOS = [
          { cielo: "#4fa3e0", suelo: ["#3a86c8", "#2a6aa8"], pieza: "agua" },
          { cielo: "#f2d040", suelo: ["#d8c050", "#b8a038"], pieza: "rayo" },
          { cielo: "#f07838", suelo: ["#b84a2a", "#8a3420"], pieza: "fuego" },
          { cielo: "#d088e0", suelo: ["#b07ad0", "#8a5aa8"], pieza: "sol" },
          { cielo: "#3a3a6a", suelo: ["#2a2a4a", "#1c1c34"], pieza: "luna" },
          { cielo: "#6ac060", suelo: ["#5a9a4a", "#46803a"], pieza: "hoja" },
          { cielo: "#8ae0f0", suelo: ["#c8ecf4", "#9ad0e0"], pieza: "hielo" },
          { cielo: "#f4a0c8", suelo: ["#f0b8d8", "#d890b8"], pieza: "hada" }
        ];
        const tramoDe = (x, y) => {
          const i = Math.floor(vuelta(x, 256) / 32);
          const f = (vuelta(x, 256) % 32) / 32;
          if (f > 0.8 && umbral(x, y) < ((f - 0.8) / 0.2) * 0.5) return TRAMOS[(i + 1) % 8];
          if (f < 0.2 && umbral(x, y) < ((0.2 - f) / 0.2) * 0.5) return TRAMOS[(i + 7) % 8];
          return TRAMOS[i];
        };
        // El cielo de cada tramo, cada vez más denso hacia abajo, y el suelo
        for (let x = 0; x < l.ancho; x++) {
          const top = 48 + Math.round(Math.sin((x * 2 * Math.PI * 3) / l.ancho) * 1.5);
          for (let y = 6; y < top; y++) if (umbral(x, y) < 0.32 * ((y - 6) / (top - 6)) ** 1.5) l.poner(x, y, tramoDe(x, y).cielo, 0.3);
          for (let y = top; y < l.alto; y++) {
            const tramo = tramoDe(x, y);
            l.poner(x, y, y === top ? tramo.cielo : (y - top) / 8 + umbral(x, y) - 0.5 > 0.5 ? tramo.suelo[1] : tramo.suelo[0], 0.82);
          }
        }
        // Lo de cada tramo en el suelo
        for (let i = 0; i < 8; i++) {
          for (let k = 0; k < 10; k++) {
            const x = i * 32 + 3 + Math.floor(azar() * 26);
            const y = 52 + Math.floor(azar() * 10);
            const pieza = TRAMOS[i].pieza;
            if (pieza === "agua") rect(l, x, y, 3, 1, "#d8f2ff", 0.9);
            if (pieza === "rayo") mapa(l, x, y - 2, ["#.", ".#", "#."], { "#": "#fff080" }, 0.9);
            if (pieza === "fuego") mapa(l, x, y - 3, [".a.", "aba", "aba"], { a: "#ff8a2a", b: "#ffe060" }, 0.92);
            if (pieza === "sol") mapa(l, x, y - 1, [".a.", "aaa", ".a."], { a: "#ffc8f0" }, 0.85);
            if (pieza === "luna") mapa(l, x, y - 1, ["aaa", "a.a", "aaa"], { a: "#ffd84a" }, 0.85);
            if (pieza === "hoja") mapa(l, x, y - 2, ["..a", ".ab", "ab."], { a: "#8ad070", b: "#4a8a3a" }, 0.92);
            if (pieza === "hielo") mapa(l, x, y - 3, ["a", "a", "b"], { a: "#ffffff", b: "#6ad0e8" }, 0.92);
            if (pieza === "hada") mapa(l, x, y - 1, ["a.a", "aaa", ".a."], { a: "#ff6aa8" }, 0.9);
          }
        }
        // Las estrellas del tramo de la luna
        for (let k = 0; k < 6; k++) l.poner(128 + 3 + Math.floor(azar() * 26), 8 + Math.floor(azar() * 30), "#e6ecff", 0.7);
        // Las huellas de Eevee, cruzándolo todo
        for (let x = 4; x < l.ancho; x += 11) {
          const y = (x / 11) % 2 < 1 ? 56 : 59;
          mapa(l, x, y, ["a.a.a", ".....", ".aaa.", ".aaa."], { a: "#3a2a20" }, 0.4);
        }
      }
    }]
  },

  espacio: {
    comentario: "Espacio: nebulosas de colores, estrellas, un planeta con anillos, una luna, un cometa y el suelo lleno de cráteres de una luna",
    tinte: ["linear-gradient(to bottom, rgba(40, 20, 90, 0.4), rgba(20, 30, 80, 0.25))"],
    capas: [{
      nombre: "planeta", ancho: 48, alto: 32, repetir: "no", sitio: { x: 26, lado: "derecha", y: 12, desde: "arriba" },
      pintar(l) {
        const anillo = (dx, dy) => Math.abs((dx / 21) ** 2 + (dy / 4.5) ** 2 - 1) < 0.22;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 48; x++) {
            const [dx, dy] = [x - 24, y - 16];
            const planeta = dx * dx + dy * dy <= 100;
            if (anillo(dx, dy) && dy < 0 && planeta) continue; // el anillo pasa por detrás
            if (planeta) l.poner(x, y, Math.floor((dy + 10) / 3) % 2 ? (dx < -3 ? "#e8b070" : "#c88a50") : dx < -3 ? "#f6d098" : "#d8a060", 0.95);
          }
        }
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 48; x++) {
            const [dx, dy] = [x - 24, y - 16];
            if (anillo(dx, dy) && (dy >= 0 || dx * dx + dy * dy > 100)) l.poner(x, y, Math.abs(dx) > 17 ? "#a890c8" : "#e0d0f8", 0.85);
          }
        }
      }
    }, {
      nombre: "luna", ancho: 14, alto: 14, repetir: "no", sitio: { x: 70, y: 48, desde: "arriba" },
      pintar(l) {
        disco(l, 7, 7, 5, "#a8a8b8", 0.92);
        disco(l, 6, 6, 3, "#c8c8d8", 0.92);
        for (const [x, y] of [[8, 9], [5, 5], [9, 5]]) l.poner(x, y, "#7a7a8a", 0.92);
      }
    }, {
      nombre: "cometa", ancho: 40, alto: 20, repetir: "no", sitio: { x: 16, y: 8, desde: "arriba" },
      pintar(l) {
        for (let k = 0; k < 34; k++) {
          const x = 36 - k;
          const y = 16 - Math.round(k * 0.4);
          if (k < 5 || umbral(x, y) < 1 - k / 34) {
            l.poner(x, y, k < 4 ? "#ffffff" : "#9ae0ff", 0.9 - k * 0.015);
            if (k > 3 && k < 20) l.poner(x, y - 1, "#5aa0e0", 0.5);
          }
        }
        rect(l, 35, 15, 3, 3, "#ffffff", 1);
      }
    }, {
      nombre: "suelo", ancho: 256, alto: 22, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        const tope = monte(l, azar, { base: 10, alto: 6, ondas: [[2, 0.3], [5, 0.15]], color: "#5a5a6e", claro: "#7a7a90", a: 0.85 });
        for (let i = 0; i < 9; i++) {
          const cx = Math.floor((i * l.ancho) / 9 + azar() * 14);
          const cy = tope[vuelta(cx, 256)] + 5 + Math.floor(azar() * 8);
          const rx = 3 + Math.floor(azar() * 4);
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -rx; dx <= rx; dx++) {
              const d = (dx / rx) ** 2 + (dy / 2) ** 2;
              if (d <= 1) l.poner(cx + dx, cy + dy, d > 0.6 && dy > 0 ? "#9a9ab0" : "#43435a", 0.88);
            }
          }
        }
      }
    }, {
      nombre: "nebulosa", ancho: 256, alto: 96, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        const fases = Array.from({ length: 6 }, () => azar() * Math.PI * 2);
        const s = (x, y, kx, ky, f) => Math.sin((2 * Math.PI * kx * x) / 256 + y * ky + f);
        for (let y = 0; y < 96; y++) {
          for (let x = 0; x < 256; x++) {
            const n = s(x, 0, 2, 0, fases[0]) * Math.sin(y * 0.07 + fases[1]) * 0.6 + s(x, 0, 5, 0, fases[2]) * Math.sin(y * 0.15 + fases[4]) * 0.3 + s(x, y, 9, 0.2, fases[5]) * 0.1 - 0.12;
            const tono = s(x, y, 1, 0.03, fases[3]);
            const densidad = Math.max(0, n) * 0.9 * (1 - y / 120);
            if (umbral(x, y) < densidad) l.poner(x, y, tono > 0.3 ? "#c86ad8" : tono > -0.3 ? "#7a6ae8" : "#4aa0e0", 0.3);
          }
        }
      }
    }, {
      nombre: "estrellas", ancho: 128, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 46; i++) {
          const x = Math.floor(azar() * 128);
          const y = Math.floor(azar() * 128);
          const color = ["#ffffff", "#c9d4ff", "#ffe0a0", "#ffb0c8"][i % 4];
          l.poner(x, y, color, i % 3 ? 0.55 : 0.95);
          if (i % 9 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, color, 0.55);
        }
      }
    }]
  },

  rocket: {
    comentario: "Guarida Rocket: paredes de metal con tuberías, estandartes con la R, cajas, una pantalla, suelo con franjas de peligro, alarmas rojas que parpadean y Wobbuffet, que sale de su caja, saluda meneándose y se vuelve a meter",
    tinte: ["linear-gradient(to bottom, rgba(120, 20, 30, 0.3), rgba(20, 20, 30, 0.3) 70%)"],
    // Las alarmas (encendidas y apagadas) se turnan cada 0,6 s sin moverse. Wobbuffet: la caja
    // cerrada, se asoma, sale, saluda meneándose y se vuelve a meter (WOBBUFFET)
    animacion: { duracion: 4.8, paradas: [0, ...saltos(8), ...WOBBUFFET.paradas, 1] },
    capas: [{
      nombre: "wobbuffet", ancho: 1280, alto: 72, repetir: "x", sitio: { y: 0, desde: "abajo" },
      mueve: WOBBUFFET.mueve,
      pintar(l) {
        for (let dibujo = 0; dibujo < 5; dibujo++) pintarWobbuffet(l, dibujo * 256, dibujo);
      }
    }, {
      nombre: "alarmas", ancho: 512, alto: 30, repetir: "x", sitio: { y: 44, desde: "abajo" },
      mueve: (t) => [turno(t, 8) * 256, 0],
      pintar(l) {
        for (const encendida of [true, false]) {
          for (const x of [64, 192]) {
            const cx = x + (encendida ? 0 : 256);
            if (encendida) {
              brillo(l, cx, 6, 16, "#ff3030", 0.55, 0.4);
              for (let y = 8; y < 30; y++) {
                const media = Math.round((y - 8) * 0.55);
                for (let dx = -media; dx <= media; dx++) if (umbral(cx + dx, y) < 0.22 * (1 - (y - 8) / 22)) l.poner(cx + dx, y, "#ff5050", 0.35);
              }
            }
            rect(l, cx - 3, 2, 7, 2, "#2a2a30", 0.95);
            rect(l, cx - 2, 4, 5, 4, encendida ? "#ff3a3a" : "#6a1818", 0.95);
            l.poner(cx - 1, 5, encendida ? "#ffd0d0" : "#8a2a2a", 0.95);
          }
        }
      }
    }, {
      nombre: "guarida", ancho: 256, alto: 72, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l) {
        // La pared: paneles con remaches
        for (let y = 0; y < 62; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const borde = x % 32 === 0 || y % 20 === 0;
            const remache = (x % 32 === 3 || x % 32 === 29) && (y % 20 === 3 || y % 20 === 17);
            l.poner(x, y, remache ? "#7a7e8a" : borde ? "#1c1e24" : (x % 32) < 2 ? "#3a3e48" : "#2c2f37", 0.72);
          }
        }
        // Tuberías
        for (let x = 0; x < l.ancho; x++) {
          rect(l, x, 6, 1, 3, "#5a5e6a", 0.85);
          l.poner(x, 6, "#8a8e9a", 0.85);
          if (x % 24 === 0) rect(l, x, 5, 2, 5, "#3a3e48", 0.85);
        }
        for (const x of [108, 236]) {
          rect(l, x, 9, 3, 53, "#5a5e6a", 0.85);
          rect(l, x, 9, 1, 53, "#8a8e9a", 0.85);
        }
        // Los estandartes con la R
        const R = [
          "######.",
          "##...##",
          "##...##",
          "######.",
          "##.##..",
          "##..##.",
          "##...##"
        ];
        for (const x of [24, 152]) {
          rect(l, x, 12, 22, 30, "#141418", 0.92);
          rect(l, x + 1, 13, 20, 28, "#1e1e24", 0.92);
          for (let k = 0; k < 22; k += 2) l.poner(x + k, 42, "#141418", 0.92);
          mapa(l, x + 8, 21, R, { "#": "#a01820" }, 0.95);
          mapa(l, x + 7, 20, R, { "#": "#e8242e" }, 0.95);
        }
        // Una pantalla con letras verdes
        rect(l, 66, 22, 18, 12, "#141418", 0.92);
        rect(l, 67, 23, 16, 10, "#0e2a1a", 0.92);
        for (let y = 24; y < 32; y += 2) for (let x = 68; x < 68 + 4 + ((y * 7) % 10); x++) l.poner(x, y, "#4aff7a", 0.92);
        rect(l, 73, 34, 4, 4, "#2a2a30", 0.92);
        // Cajas
        const caja = (x, y) => {
          rect(l, x, y, 16, 13, "#8a5a30", 0.92);
          rect(l, x, y, 16, 1, "#b07a44", 0.92);
          rect(l, x, y + 6, 16, 1, "#6a4424", 0.92);
          rect(l, x + 15, y, 1, 13, "#6a4424", 0.92);
          mapa(l, x + 6, y + 2, ["##.", "#.#", "##.", "#.#"], { "#": "#a01820" }, 0.92);
        };
        caja(186, 49);
        caja(203, 49);
        caja(194, 36);
        // El suelo con franjas de peligro
        for (let y = 62; y < 72; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const franja = y < 65;
            l.poner(x, y, franja ? ((x + y) % 8 < 4 ? "#f0c020" : "#1a1a1e") : (x + y) % 5 ? "#3a3c44" : "#4a4c56", 0.88);
          }
        }
      }
    }]
  },

  cementerio: {
    comentario: "Cementerio: lápidas (con flores en alguna), un árbol seco, una verja, la luna llena, niebla que pasa y fantasmitas que flotan",
    tinte: ["linear-gradient(to bottom, rgba(60, 50, 110, 0.34), rgba(30, 40, 60, 0.2) 70%)"],
    // Dos animaciones: de lado, despacio (los fantasmas, unos a un lado y otros al otro, y la
    // niebla), y arriba y abajo, más deprisa (los fantasmas flotando)
    animacion: [
      { nombre: "deriva", eje: "x", duracion: 60, mueve: { "fantasmas-cerca": [256, 0], "fantasmas-lejos": [-256, 0], niebla: [448, 0] } },
      {
        nombre: "flota", eje: "y", duracion: 4, paradas: Array.from({ length: 17 }, (_, i) => i / 16),
        mueve: { "fantasmas-cerca": (t) => [0, Math.sin(2 * Math.PI * t) * 3], "fantasmas-lejos": (t) => [0, Math.cos(2 * Math.PI * t) * 2.5] }
      }
    ],
    capas: [{
      nombre: "fantasmas-cerca", ancho: 256, alto: 40, repetir: "x", sitio: { y: 16, desde: "abajo" },
      pintar(l) { for (const [x, y] of [[40, 10], [168, 20]]) fantasma(l, x, y, 0.85); }
    }, {
      nombre: "fantasmas-lejos", ancho: 256, alto: 40, repetir: "x", sitio: { y: 26, desde: "abajo" },
      pintar(l) { for (const [x, y] of [[104, 14], [226, 6]]) fantasma(l, x, y, 0.55); }
    }, {
      nombre: "niebla", ancho: 64, alto: 18, repetir: "x", sitio: { y: 4, desde: "abajo" },
      pintar(l) {
        for (let y = 0; y < 18; y++) {
          for (let x = 0; x < 64; x++) {
            const densidad = 0.4 * (1 - Math.abs(y - 9) / 9) * (0.6 + 0.4 * Math.sin((x * 2 * Math.PI) / 64));
            if (umbral(x, y) < densidad) l.poner(x, y, "#c8c4dc", 0.32);
          }
        }
      }
    }, {
      nombre: "luna", ancho: 28, alto: 28, repetir: "no", sitio: { x: 34, lado: "derecha", y: 8, desde: "arriba" },
      pintar(l) {
        brillo(l, 14, 14, 14, "#dfe8c0", 0.45, 0.25);
        disco(l, 14, 14, 8, "#eef0d8", 0.95);
        for (const [x, y, r] of [[11, 11, 2], [17, 16, 1], [15, 10, 1]]) disco(l, x, y, r, "#cfd2b8", 0.95);
      }
    }, {
      nombre: "tumbas", ancho: 256, alto: 60, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // La verja del fondo
        for (let x = 0; x < l.ancho; x++) {
          for (const y of [30, 38]) l.poner(x, y, "#1e1e2a", 0.6);
          if (x % 4 === 0) {
            rect(l, x, 27, 1, 16, "#1e1e2a", 0.6);
            l.poner(x, 26, "#2e2e3e", 0.6);
          }
        }
        const tope = monte(l, azar, { base: 46, alto: 10, ondas: [[1, 0.3], [3, 0.15]], color: "#2e3e30", claro: "#3e5040", a: 0.8 });
        // El árbol seco
        const rama = (x, y, largo, dx, grosor) => {
          for (let k = 0; k < largo; k++) {
            x += dx * (k % 2 ? 1 : 0.6);
            y -= 1;
            rect(l, Math.round(x), y, grosor, 1, "#2a2228", 0.88);
            if (grosor > 1 && k === Math.floor(largo / 2)) rama(x, y, largo * 0.6, -dx, grosor - 1);
          }
          return [x, y];
        };
        const pie = tope[200];
        rect(l, 199, pie - 22, 3, 22, "#2a2228", 0.88);
        rama(200, pie - 20, 12, -0.7, 2);
        rama(201, pie - 22, 14, 0.6, 2);
        rama(200, pie - 14, 8, 1, 1);
        // Las lápidas
        const lapida = (x, alto, forma, flores) => {
          const base = tope[vuelta(x + 4, 256)] + 3;
          if (forma === "cruz") {
            rect(l, x + 3, base - alto, 3, alto, "#8a8a96", 0.92);
            rect(l, x, base - alto + 3, 9, 3, "#8a8a96", 0.92);
            rect(l, x + 3, base - alto, 1, alto, "#a8a8b4", 0.92);
            rect(l, x + 5, base - alto, 1, alto, "#5a5a66", 0.92);
          } else {
            for (let y = 0; y < alto; y++) {
              const media = y < 3 ? [2, 3, 4][y] : 4;
              for (let dx = -media; dx <= media; dx++) l.poner(x + 4 + dx, base - alto + y, dx === -media ? "#a8a8b4" : dx === media ? "#5a5a66" : "#8a8a96", 0.92);
            }
            rect(l, x + 4, base - alto + 4, 1, 4, "#4a4a56", 0.92);
            rect(l, x + 3, base - alto + 5, 3, 1, "#4a4a56", 0.92);
          }
          rect(l, x - 1, base, 11, 1, "#3a3a46", 0.92);
          if (flores) {
            l.poner(x + 1, base - 1, "#e83a4a", 0.95);
            l.poner(x + 2, base - 2, "#ffffff", 0.95);
            l.poner(x + 7, base - 1, "#f0c040", 0.95);
          }
        };
        [[14, 12, "redonda", true], [40, 15, "cruz", false], [66, 10, "redonda", false], [96, 13, "redonda", true],
          [124, 16, "cruz", true], [150, 11, "redonda", false], [176, 14, "redonda", true], [226, 12, "cruz", false]]
          .forEach(([x, alto, forma, flores]) => lapida(x, alto, forma, flores));
        suelo(l, 56, ["#26342a", "#1e2a22"], 0.88);
        for (let i = 0; i < 24; i++) {
          const x = Math.floor(azar() * l.ancho);
          l.poner(x, 55, "#3e5040", 0.88);
          l.poner(x + 1, 54, "#3e5040", 0.88);
        }
      }
    }]
  },

  marino: {
    comentario: "Fondo marino: luz que ondea arriba, algas, corales, una estrella de mar, un cofre, peces que pasan y burbujas que suben",
    tinte: ["linear-gradient(to bottom, rgba(40, 150, 200, 0.32), rgba(20, 70, 130, 0.3) 80%)"],
    animacion: { duracion: 16, pasos: 256 },
    capas: [{
      nombre: "burbujas", ancho: 64, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: [0, -256],
      pintar(l, azar) {
        for (let i = 0; i < 8; i++) {
          const x = Math.floor(azar() * 64);
          const y = Math.floor(azar() * 128);
          if (i % 3) {
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) l.poner(x + dx, y + dy, "#d8f6ff", 0.75);
          } else {
            for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-2, -1]]) l.poner(x + dx, y + dy, "#d8f6ff", 0.75);
            l.poner(x - 1, y - 1, "#ffffff", 0.9);
          }
        }
      }
    }, {
      nombre: "peces", ancho: 128, alto: 40, repetir: "x", sitio: { y: 26, desde: "abajo" }, mueve: [256, 0],
      pintar(l) {
        const pez = (x, y, cuerpo, aleta) => mapa(l, x, y, ["a.bbb.", ".abbbo", "a.bbb."], { a: aleta, b: cuerpo, o: "#1a1a24" }, 0.9);
        for (const [dx, dy] of [[0, 0], [8, -3], [9, 4], [17, 1], [16, -6]]) pez(10 + dx, 18 + dy, "#ffd040", "#f0a020");
        for (const [dx, dy] of [[0, 0], [9, 3], [7, -4]]) pez(80 + dx, 8 + dy, "#5ab0ff", "#2a70d0");
        pez(110, 30, "#ff7a6a", "#d04a3a");
      }
    }, {
      nombre: "superficie", ancho: 256, alto: 12, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        for (let x = 0; x < l.ancho; x++) {
          const y = 3 + Math.round(Math.sin((x * 2 * Math.PI * 8) / 256) * 1.5 + Math.sin((x * 2 * Math.PI * 3) / 256));
          l.poner(x, y, "#e8fbff", 0.55);
          for (let k = 1; k < 8; k++) if (umbral(x, y + k) < 0.3 * (1 - k / 8)) l.poner(x, y + k, "#9ae0f6", 0.35);
        }
      }
    }, {
      nombre: "arrecife", ancho: 256, alto: 58, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // Algas largas que ondean
        for (const x of [20, 34, 112, 160, 172, 236]) {
          const alto = 30 + Math.floor(azar() * 22);
          for (let k = 0; k < alto; k++) {
            const px = x + Math.round(Math.sin(k / 4 + x) * 1.6);
            rect(l, px, 50 - k, 2, 1, k % 5 ? "#3a8a5a" : "#5ab070", 0.75);
            if (k % 6 === 3) l.poner(px + 2, 50 - k, "#5ab070", 0.75);
          }
        }
        monte(l, azar, { base: 50, alto: 6, ondas: [[2, 0.3], [5, 0.15]], color: "#e6d29a", claro: "#f6e6b8", a: 0.8 });
        for (let i = 0; i < 40; i++) rect(l, Math.floor(azar() * l.ancho), 50 + Math.floor(azar() * 8), 2, 1, "#c8b07a", 0.8);
        // Rocas
        for (const [x, r] of [[60, 6], [200, 7]]) {
          disco(l, x, 52, r, "#4a6a8a", 0.85);
          disco(l, x - 2, 50, r - 2, "#6a8aa8", 0.85);
        }
        // Corales que se ramifican
        const coral = (x, y, largo, dx, color) => {
          for (let k = 0; k < largo; k++) {
            x += dx * (k % 3 === 0 ? 1 : 0);
            l.poner(x, y - k, color, 0.92);
            l.poner(x + 1, y - k, color, 0.92);
            if (k === Math.floor(largo / 2) && largo > 4) coral(x, y - k, Math.floor(largo * 0.6), -dx || 1, color);
          }
          l.poner(x, y - largo, "#ffffff", 0.6);
        };
        for (const [x, color] of [[48, "#ff7aa0"], [88, "#ff9a50"], [136, "#c87aff"], [188, "#ff7aa0"], [222, "#ff9a50"]]) {
          coral(x, 50, 12, -1, color);
          coral(x + 3, 50, 9, 1, color);
        }
        // Una estrella de mar, conchas y un cofre
        mapa(l, 100, 52, ["..a..", "aaaaa", ".aaa.", "a...a"], { a: "#ff8a3a" }, 0.95);
        mapa(l, 150, 54, [".aa.", "abba"], { a: "#ffd8e0", b: "#e8a8b8" }, 0.95);
        mapa(l, 244, 46, [
          ".bbbbbbbb.",
          "baaaaaaaab",
          "bbbbybbbbb",
          "baaaaaaaab",
          "baaaaaaaab",
          "bbbbbbbbbb"
        ], { a: "#8a5a30", b: "#5a3a1a", y: "#f0c040" }, 0.92);
        for (const [x, y] of [[243, 45], [254, 44]]) l.poner(x, y, "#ffe080", 0.9);
      }
    }]
  },

  tormenta: {
    comentario: "Tormenta: nubes negras, lluvia que cae de lado, charcos y, de vez en cuando, un relámpago (dos destellos) que lo ilumina todo",
    tinte: ["linear-gradient(to bottom, rgba(40, 50, 70, 0.42), rgba(40, 60, 80, 0.2) 75%)"],
    // La lluvia cae sin parar; el relámpago y el destello aparecen dos veces, un momento
    animacion: { duracion: 6.4, paradas: [0, 0.7 - 0.0001, 0.7, 0.72 - 0.0001, 0.72, 0.75 - 0.0001, 0.75, 0.76 - 0.0001, 0.76, 1] },
    capas: [{
      nombre: "destello", ancho: 4, alto: 4, tamano: "100% 100%", repetir: "no", sitio: { y: -4000, desde: "arriba" },
      mueve: (t) => [0, (t >= 0.7 && t < 0.72) || (t >= 0.75 && t < 0.76) ? 4000 : 0],
      pintar(l) { rect(l, 0, 0, 4, 4, "#e8f0ff", 0.22); }
    }, {
      nombre: "rayo", ancho: 40, alto: 84, repetir: "no", sitio: { x: 60, y: -200, desde: "arriba" },
      mueve: (t) => [0, (t >= 0.7 && t < 0.72) || (t >= 0.75 && t < 0.76) ? 200 : 0],
      pintar(l, azar) {
        // Tramos en zigzag (de un punto al siguiente, en línea) y una rama a media altura
        const puntos = [];
        const linea = ([x0, y0], [x1, y1]) => {
          const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let k = 0; k <= pasos; k++) puntos.push([Math.round(x0 + ((x1 - x0) * k) / pasos), Math.round(y0 + ((y1 - y0) * k) / pasos)]);
        };
        let antes = [20, 0];
        for (let y = 7, lado = 1; y < 84; y += 7 + Math.floor(azar() * 4), lado = -lado) {
          const ahora = [Math.max(4, Math.min(34, antes[0] + lado * (5 + Math.floor(azar() * 5)))), Math.min(83, y)];
          linea(antes, ahora);
          if (y > 30 && y < 40) linea(ahora, [ahora[0] + 12, ahora[1] + 10]), linea([ahora[0] + 12, ahora[1] + 10], [ahora[0] + 10, ahora[1] + 18]);
          antes = ahora;
        }
        for (const [px, py] of puntos) brillo(l, px, py, 3, "#a8c8ff", 0.5, 0.5);
        for (const [px, py] of puntos) {
          l.poner(px, py, "#ffffff", 1);
          l.poner(px + 1, py, "#fff6c0", 0.9);
        }
      }
    }, {
      nombre: "lluvia", ancho: 64, alto: 64, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: (t) => [-256 * t, 1024 * t],
      pintar(l, azar) {
        for (let i = 0; i < 22; i++) {
          const x = Math.floor(azar() * 64);
          const y = Math.floor(azar() * 64);
          for (let k = 0; k < 4; k++) l.poner(x - Math.floor(k / 2), y + k, k ? "#a8c0dc" : "#e0ecf8", 0.55);
        }
      }
    }, {
      nombre: "nubes", ancho: 256, alto: 30, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let x = 0; x < l.ancho; x++) {
          const bajo = 14 + Math.round(Math.sin((x * 2 * Math.PI * 5) / 256) * 4 + Math.abs(Math.sin((x * 2 * Math.PI * 16) / 256 + 1)) * 4);
          for (let y = 0; y <= bajo; y++) l.poner(x, y, bajo - y < 2 ? "#5a6478" : (x * 3 + y * 5) % 13 ? "#2e3444" : "#3a4254", 0.72);
        }

      }
    }, {
      nombre: "suelo", ancho: 256, alto: 26, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 12, alto: 8, ondas: [[2, 0.3], [5, 0.12]], color: "#26302e", claro: "#34403c", a: 0.8 });
        // Hierba doblada por el viento
        for (let i = 0; i < 30; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 14 + Math.floor(azar() * 10);
          for (let k = 0; k < 3; k++) l.poner(x - k, y - k, "#46564e", 0.88);
        }
        // Charcos con salpicaduras
        for (const x of [40, 120, 220]) {
          rect(l, x, 20, 16, 2, "#5a7a9a", 0.85);
          rect(l, x + 2, 20, 4, 1, "#a8c0dc", 0.85);
          for (const dx of [3, 9, 13]) {
            l.poner(x + dx - 1, 18, "#c8dcf0", 0.85);
            l.poner(x + dx + 1, 18, "#c8dcf0", 0.85);
          }
        }
      }
    }]
  }
};

// ---------- Los de Eevee ----------
//
// Los que dan los logros de registrar a Eevee y a cada Eeveelution (js/comun/fondos.js,
// FONDOS_EEVEE): un paisaje de lo suyo. Sin movimiento, como los de región.

// Una cinta que ondula a lo ancho (las de Sylveon), con el borde de arriba más claro
function cinta(l, y0, alto, vueltas, fase, grueso, [color, claro], a) {
  for (let x = 0; x < l.ancho; x++) {
    const y = Math.round(y0 + Math.sin((2 * Math.PI * vueltas * x) / l.ancho + fase) * alto);
    for (let k = 0; k < grueso; k++) l.poner(x, y + k, k === 0 ? claro : color, a);
  }
}

const CORAZON = [".a.a.", "aaaaa", "aaaaa", ".aaa.", "..a.."];
const DESTELLO = [".a.", "aba", ".a."];

const EEVEE = {
  eevee: {
    comentario: "Eevee: una pradera dorada al atardecer, con dientes de león y sus vilanos volando",
    tinte: ["linear-gradient(to bottom, rgba(250, 190, 120, 0.55), rgba(255, 225, 170, 0.5) 60%, rgba(220, 170, 110, 0.4))"],
    capas: [{
      nombre: "pradera", ancho: 256, alto: 60, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = Math.floor(azar() * 30);
          l.poner(x, y, "#fffaf0", 0.85);
          l.poner(x + 1, y - 1, "#fffaf0", 0.6);
          l.poner(x - 1, y - 1, "#fffaf0", 0.6);
        }
        monte(l, azar, { base: 38, alto: 10, ondas: [[1, 0.3], [3, 0.12]], color: "#d8b07a", claro: "#ecc898", a: 0.7 });
        monte(l, azar, { base: 50, alto: 8, ondas: [[2, 0.3], [5, 0.12]], color: "#c4955a", claro: "#dcb070", a: 0.9 });
        for (let i = 0; i < 40; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 50 + Math.floor(azar() * 10);
          mapa(l, x, y - 2, ["a.a", ".a."], { a: "#a87a40" }, 0.92);
        }
        // Dientes de león: el tallo y la bola de vilanos
        for (const [x, alto] of [[20, 14], [70, 10], [118, 16], [170, 12], [222, 15], [245, 9]]) {
          const base = 54;
          rect(l, x, base - alto, 1, alto, "#7a9a40", 0.95);
          disco(l, x, base - alto - 3, 3, "#fffaf0", 0.95);
          for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [-3, -3], [3, -3]]) l.poner(x + dx, base - alto - 3 + dy, "#f0e6d0", 0.9);
          l.poner(x - 1, base - alto - 4, "#ffffff", 1);
        }
        for (const x of [44, 96, 144, 196]) mapa(l, x, 50, [".a.", "aba", ".a."], { a: "#fff0a0", b: "#e8a040" }, 0.95);
      }
    }]
  },

  vaporeon: {
    comentario: "Vaporeon: una cascada que cae entre rocas a una laguna, con espuma, bruma y burbujas",
    tinte: ["linear-gradient(to bottom, rgba(90, 170, 230, 0.6), rgba(120, 200, 235, 0.5) 60%, rgba(40, 120, 190, 0.5))"],
    capas: [{
      nombre: "cascada", ancho: 256, alto: 66, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // Las rocas a los lados de la cascada (que cae entre x 104 y 152)
        for (let x = 0; x < l.ancho; x++) {
          const dentro = x >= 104 && x <= 152;
          if (dentro) continue;
          const lejos = Math.min(Math.abs(x - 104), Math.abs(x - 152));
          const top = Math.max(4, 26 - lejos * 0.5 + Math.round(Math.sin(x / 5) * 2));
          for (let y = Math.round(top); y < 50; y++) l.poner(x, y, y - top < 2 ? "#8aa0b8" : (x + y) % 9 ? "#5a6e88" : "#4a5c74", 0.85);
        }
        // La cascada: franjas claras y oscuras con trama
        for (let x = 104; x <= 152; x++) {
          for (let y = 6; y < 52; y++) {
            const franja = (x * 7 + Math.floor(y / 3)) % 5;
            l.poner(x, y, franja === 0 ? "#ffffff" : franja < 3 ? "#9ad8f6" : "#5ab0e6", 0.85);
          }
          rect(l, x, 5, 1, 2, "#e8f8ff", 0.9);
        }
        // La laguna, la espuma y la bruma
        for (let y = 50; y < l.alto; y++) for (let x = 0; x < l.ancho; x++) l.poner(x, y, (y - 50) / 16 + umbral(x, y) - 0.5 > 0.5 ? "#2a7cb8" : "#4aa2d8", 0.88);
        for (let x = 96; x <= 160; x++) for (let y = 46; y < 56; y++) if (umbral(x, y) < 0.6 * (1 - Math.abs(x - 128) / 34) * (1 - Math.abs(y - 51) / 6)) l.poner(x, y, "#ffffff", 0.85);
        for (let i = 0; i < 24; i++) rect(l, Math.floor(azar() * l.ancho), 56 + Math.floor(azar() * 9), 3, 1, "#d8f2ff", 0.85);
        for (let i = 0; i < 10; i++) {
          const [x, y] = [Math.floor(azar() * l.ancho), 20 + Math.floor(azar() * 28)];
          mapa(l, x, y, [".a.", "a.a", ".a."], { a: "#d8f6ff" }, 0.8);
        }
        for (const x of [20, 66, 196, 236]) {
          rect(l, x, 50, 2, 3, "#3a8a5a", 0.9);
          l.poner(x - 1, 49, "#5ab070", 0.9);
          l.poner(x + 2, 48, "#5ab070", 0.9);
        }
      }
    }]
  },

  jolteon: {
    comentario: "Jolteon: una pradera de noche con hierba de pinchos amarilla, rayos en el cielo, chispas y postes de la luz",
    tinte: ["linear-gradient(to bottom, rgba(30, 40, 90, 0.6), rgba(60, 60, 110, 0.45) 70%, rgba(80, 70, 40, 0.4))"],
    capas: [{
      nombre: "pradera", ancho: 256, alto: 70, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // Rayos en zigzag, con su resplandor
        for (const [x0, largo] of [[40, 40], [180, 32]]) {
          let [x, y] = [x0, 0];
          const puntos = [];
          for (let lado = 1; y < largo; lado = -lado) {
            for (let k = 0; k < 5 && y < largo; k++) puntos.push([(x += lado), (y += 1)]);
          }
          for (const [px, py] of puntos) brillo(l, px, py, 4, "#fff3a0", 0.55, 0.5);
          for (const [px, py] of puntos) {
            l.poner(px, py, "#ffffff", 1);
            l.poner(px + 1, py, "#fff38a", 1);
          }
        }
        // Los postes y los cables
        for (const x of [88, 216]) {
          rect(l, x, 30, 2, 26, "#3a3040", 0.92);
          rect(l, x - 5, 31, 12, 1, "#3a3040", 0.92);
        }
        for (let x = 0; x < l.ancho; x++) {
          const t = ((x - 88 + 256) % 128) / 128;
          l.poner(x, 31 + Math.round(Math.sin(t * Math.PI) * 6), "#2a2430", 0.85);
        }
        monte(l, azar, { base: 54, alto: 6, ondas: [[2, 0.3], [5, 0.12]], color: "#5a5228", claro: "#6e6430", a: 0.9 });
        // Hierba de pinchos amarilla
        for (let x = 0; x < l.ancho; x += 3) {
          const alto = 5 + Math.floor(azar() * 6);
          const base = 58 + Math.floor(azar() * 10);
          for (let k = 0; k < alto; k++) l.poner(x + (k > alto / 2 ? 1 : 0), base - k, k > alto - 3 ? "#fff38a" : "#e8c020", 0.95);
        }
        for (let i = 0; i < 16; i++) mapa(l, Math.floor(azar() * l.ancho), 36 + Math.floor(azar() * 22), ["#.", ".#", "#."], { "#": "#fff080" }, 0.9);
      }
    }]
  },

  flareon: {
    comentario: "Flareon: una hoguera de noche con sus troncos y piedras, chispas que suben y árboles de otoño a contraluz",
    tinte: ["linear-gradient(to bottom, rgba(70, 30, 40, 0.55), rgba(150, 60, 40, 0.45) 70%, rgba(230, 110, 40, 0.4))"],
    capas: [{
      nombre: "hoguera", ancho: 256, alto: 64, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 40, alto: 12, ondas: [[1, 0.3], [3, 0.12]], color: "#5a2a2a", claro: "#6e3430", a: 0.7 });
        for (const [x, alto] of [[16, 20], [34, 26], [52, 18], [196, 22], [214, 28], [236, 20]]) pino(l, x, 48, alto, ["#2e1418", "#3a1a1c", "#3a1a1c"], 0.9);
        suelo(l, 50, ["#6a3424", "#54281c"], 0.9);
        // La hoguera
        const cx = 128;
        brillo(l, cx, 44, 30, "#ff9a3a", 0.5, 0.4);
        for (let y = 0; y < 30; y++) {
          const t = y / 30;
          const media = Math.round(13 * Math.sin(t * Math.PI * 0.9 + 0.2) * (1 - t * 0.4));
          for (let dx = -media; dx <= media; dx++) {
            const borde = Math.abs(dx) > media - 2;
            const centro = Math.abs(dx) < media * 0.4;
            l.poner(cx + dx + Math.round(Math.sin(y / 2) * 2 * t), 52 - y, centro && y < 18 ? "#fff3a0" : borde ? "#e8401c" : "#ff9a2a", 0.95);
          }
        }
        for (const [dx, dy] of [[-12, 0], [12, 0], [-8, 1], [8, 1], [0, 2], [-14, 2], [14, 2]]) disco(l, cx + dx, 54 + dy, 2, "#8a8a92", 0.95);
        rect(l, cx - 12, 52, 24, 2, "#6a4428", 0.95);
        for (let k = 0; k < 20; k++) l.poner(cx - 10 + k, 50 + Math.floor(k / 4) % 2, "#5a3820", 0.95);
        for (let i = 0; i < 18; i++) {
          const x = cx - 20 + Math.floor(azar() * 40);
          const y = 6 + Math.floor(azar() * 26);
          l.poner(x, y, ["#ffd060", "#ff8a2a", "#fff3a0"][i % 3], 0.9);
        }
      }
    }]
  },

  espeon: {
    comentario: "Espeon: el amanecer, con un sol enorme saliendo detrás de montañas lilas, nubes rosas y destellos",
    tinte: ["linear-gradient(to bottom, rgba(150, 110, 200, 0.55), rgba(250, 150, 180, 0.5) 55%, rgba(255, 200, 140, 0.5))"],
    capas: [{
      nombre: "sol", ancho: 70, alto: 40, repetir: "no", sitio: { x: 40, lado: "derecha", y: 16, desde: "abajo" },
      pintar(l) {
        for (let y = 0; y < 40; y++) {
          for (let x = 0; x < 70; x++) {
            const d = Math.hypot(x - 35, y - 38);
            if (d <= 22) l.poner(x, y, d < 14 ? "#fff3c8" : d < 19 || umbral(x, y) < 0.5 ? "#ffd27a" : "#ff9ab0", 0.95);
            else if (d < 34 && umbral(x, y) < 0.45 * (1 - (d - 22) / 12)) l.poner(x, y, "#ffc8d8", 0.5);
          }
        }
      }
    }, {
      nombre: "montanas", ancho: 256, alto: 50, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (let i = 0; i < 5; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 2 + Math.floor(azar() * 10);
          const largo = 20 + Math.floor(azar() * 20);
          for (let k = 0; k < largo; k++) l.poner(x + k, y + (k > 3 && k < largo - 3 ? 0 : 1), "#ffd0e0", 0.7);
          for (let k = 3; k < largo - 6; k++) l.poner(x + k + 2, y - 1, "#fff0f6", 0.7);
        }
        monte(l, azar, { base: 36, alto: 22, ondas: [[2, 0.35], [5, 0.12], [11, 0.04]], color: "#a080c8", claro: "#c0a0e0", a: 0.8, nieve: 18 });
        monte(l, azar, { base: 46, alto: 10, ondas: [[3, 0.3], [7, 0.1]], color: "#7a5aa8", claro: "#9474c0", a: 0.92 });
        for (let i = 0; i < 8; i++) mapa(l, Math.floor(azar() * l.ancho), 14 + Math.floor(azar() * 18), DESTELLO, { a: "#ffd0f0", b: "#ffffff" }, 0.9);
      }
    }]
  },

  umbreon: {
    comentario: "Umbreon: la luna llena sobre un bosque oscuro, su reflejo en el estanque y luces amarillas en forma de anillo",
    tinte: ["linear-gradient(to bottom, rgba(20, 22, 50, 0.6), rgba(40, 40, 80, 0.45) 70%)"],
    capas: [{
      nombre: "luna", ancho: 40, alto: 40, repetir: "no", sitio: { x: 36, lado: "derecha", y: 6, desde: "arriba" },
      pintar(l) {
        brillo(l, 20, 20, 19, "#fff0a0", 0.5, 0.35);
        disco(l, 20, 20, 10, "#ffe680", 1);
        disco(l, 18, 18, 7, "#fff4b8", 1);
        for (const [x, y, r] of [[23, 23, 2], [16, 22, 1], [22, 15, 1]]) disco(l, x, y, r, "#f0d468", 1);
      }
    }, {
      nombre: "bosque", ancho: 256, alto: 56, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) pino(l, Math.floor((i * l.ancho) / 14 + azar() * 8), 40, 14 + Math.floor(azar() * 10), ["#14182c", "#1c2238", "#1c2238"], 0.9);
        suelo(l, 40, ["#1c2034"], 0.9);
        // El estanque con el reflejo de la luna
        for (let y = 44; y < 54; y++) {
          const media = Math.round(40 * Math.sqrt(1 - ((y - 49) / 5.5) ** 2));
          for (let dx = -media; dx <= media; dx++) l.poner(128 + dx, y, "#2a3460", 0.92);
        }
        for (let y = 45; y < 53; y += 2) rect(l, 120 + (y % 4), y, 14 - (y - 45), 1, "#ffe680", 0.85);
        // Luces en forma de anillo, como las de Umbreon
        for (const [x, y] of [[30, 20], [70, 30], [100, 14], [168, 26], [200, 16], [240, 32]]) {
          brillo(l, x + 1, y + 1, 5, "#ffe680", 0.45, 0.5);
          mapa(l, x, y, ["aaa", "a.a", "aaa"], { a: "#ffd84a" }, 0.95);
        }
      }
    }]
  },

  leafeon: {
    comentario: "Leafeon: un bosque frondoso con las copas juntas arriba, troncos, helechos y hojas que caen",
    tinte: ["linear-gradient(to bottom, rgba(120, 190, 110, 0.55), rgba(180, 220, 140, 0.45) 60%, rgba(60, 120, 60, 0.45))"],
    capas: [{
      nombre: "bosque", ancho: 256, alto: 60, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (const x of [18, 82, 150, 214]) {
          rect(l, x - 3, 10, 7, 44, "#6a4a2a", 0.9);
          rect(l, x - 3, 10, 2, 44, "#8a6640", 0.9);
        }
        // El dosel: muchas copas que se solapan, más claras arriba a la izquierda
        for (let x = 0; x < l.ancho; x += 10) {
          const y = 8 + Math.round(Math.sin(x / 13) * 3);
          disco(l, x, y, 9, "#3a8a3a", 0.88);
          disco(l, x - 3, y - 3, 5, "#5aac4a", 0.88);
          l.poner(x - 4, y - 5, "#9ad870", 0.88);
        }
        suelo(l, 52, ["#4a8a3a", "#3a7430"], 0.92);
        for (let i = 0; i < 16; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 54 + Math.floor(azar() * 5);
          for (let k = 1; k <= 4; k++) {
            l.poner(x - k, y - k + 1, "#6ac060", 0.95);
            l.poner(x + k, y - k + 1, "#58ac50", 0.95);
          }
          l.poner(x, y - 3, "#7ad070", 0.95);
        }
        for (let i = 0; i < 12; i++) mapa(l, Math.floor(azar() * l.ancho), 22 + Math.floor(azar() * 26), ["..a", ".ab", "ab."], { a: "#9ae070", b: "#4a8a3a" }, 0.95);
      }
    }]
  },

  glaceon: {
    comentario: "Glaceon: un glaciar con acantilados de hielo, cristales, nieve y polvo de diamante que brilla en el aire",
    tinte: ["linear-gradient(to bottom, rgba(150, 210, 240, 0.6), rgba(210, 240, 255, 0.55) 60%, rgba(160, 210, 235, 0.5))"],
    capas: [{
      nombre: "glaciar", ancho: 256, alto: 56, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // Acantilados de hielo: bloques con caras en ángulo
        let x = 0;
        while (x < l.ancho) {
          const ancho = 12 + Math.floor(azar() * 16);
          const alto = 16 + Math.floor(azar() * 20);
          for (let dx = 0; dx < ancho; dx++) {
            const pico = Math.round(alto - Math.abs(dx - ancho / 2) * 0.8);
            for (let y = 44 - pico; y < 46; y++) l.poner(x + dx, y, dx < ancho / 2 ? "#d8f4ff" : (dx + y) % 7 ? "#8ac8e8" : "#a8dcf4", 0.88);
          }
          x += ancho - 2;
        }
        suelo(l, 44, ["#f4fbff", "#e0f0fa", "#cce4f2"], 0.92);
        for (const cx of [40, 120, 200]) {
          for (const [dx, alto] of [[-3, 6], [0, 10], [3, 7]]) {
            for (let k = 0; k < alto; k++) {
              l.poner(cx + dx, 50 - k, k >= alto - 1 ? "#ffffff" : "#bff0ff", 0.95);
              if (k < alto - 2) l.poner(cx + dx + 1, 50 - k, "#6ad0e8", 0.95);
            }
          }
        }
      }
    }, {
      nombre: "diamantes", ancho: 96, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) {
          const [x, y] = [Math.floor(azar() * 96), Math.floor(azar() * 96)];
          if (i % 3) l.poner(x, y, "#ffffff", 0.9);
          else mapa(l, x, y, DESTELLO, { a: "#bff0ff", b: "#ffffff" }, 0.9);
        }
      }
    }]
  },

  sylveon: {
    comentario: "Sylveon: un cielo pastel con cintas rosas y azules que ondean, nubes esponjosas, corazones y destellos",
    tinte: ["linear-gradient(to bottom, rgba(250, 190, 220, 0.55), rgba(200, 220, 255, 0.5) 60%, rgba(255, 210, 230, 0.5))"],
    capas: [{
      nombre: "cintas", ancho: 256, alto: 60, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        cinta(l, 24, 6, 2, 0, 4, ["#ff8ac0", "#ffc8e0"], 0.85);
        cinta(l, 32, 5, 3, 1.5, 3, ["#6ab0ff", "#b8d8ff"], 0.85);
        // Nubes esponjosas abajo
        for (let x = 0; x < l.ancho; x += 12) disco(l, x + Math.floor(azar() * 4), 52 + Math.floor(azar() * 3), 8 + Math.floor(azar() * 3), "#ffe4f2", 0.92);
        for (let x = 6; x < l.ancho; x += 12) disco(l, x, 56, 7, "#fff4fa", 0.92);
        rect(l, 0, 56, l.ancho, 4, "#fff4fa", 0.92);
        for (let i = 0; i < 8; i++) mapa(l, Math.floor(azar() * l.ancho), 4 + Math.floor(azar() * 30), CORAZON, { a: i % 2 ? "#ff8ac0" : "#ffb0d8" }, 0.9);
        for (let i = 0; i < 8; i++) mapa(l, Math.floor(azar() * l.ancho), 2 + Math.floor(azar() * 36), DESTELLO, { a: "#ffd8f0", b: "#ffffff" }, 0.9);
      }
    }]
  }
};

// ---------- A pintar ----------
//
// Todos los fondos en una lista: { id (el de js/comun/fondos.js), comentario, tinte, capas, animacion }

const NUBES_DE_DIA = { nombre: "nubes", ancho: 256, alto: 36, repetir: "x", sitio: { y: 4, desde: "arriba" }, pintar: nubesDeDia };

const FONDOS = [
  ...Object.entries(REGIONES).map(([id, pintar]) => ({
    id: `region-${id}`,
    comentario: CIELOS_REGION[id][0],
    tinte: [CIELOS_REGION[id][1]],
    capas: [{ archivo: `region-${id}`, ancho: W, alto: H, repetir: "x", sitio: { y: 0, desde: "abajo" }, pintar: (l) => pintar(l, azarFijo(id)) }]
  })),
  ...Object.entries(EEVEE).map(([id, fondo]) => ({
    ...fondo,
    id: `eevee-${id}`,
    capas: fondo.capas.map((capa) => ({ ...capa, archivo: `eevee-${id}-${capa.archivo || capa.nombre}` }))
  })),
  ...Object.entries(TIENDA).map(([id, fondo]) => ({
    ...fondo,
    id: `tienda-${id}`,
    capas: [...fondo.capas, ...(fondo.cieloDeDia ? [NUBES_DE_DIA] : [])]
      .map((capa) => ({ ...capa, archivo: `tienda-${id}-${capa.archivo || capa.nombre}` }))
  }))
];

// Cada capa, pintada una vez (dos capas pueden usar el mismo dibujo: las bombillas del casino)
const dibujos = new Map();
for (const fondo of FONDOS) {
  for (const capa of fondo.capas) {
    if (!capa.pintar) continue;
    const l = lienzo(capa.ancho, capa.alto, capa.repetir === "xy");
    capa.pintar(l, azarFijo(capa.archivo));
    dibujos.set(capa.archivo, l.datos);
    writeFileSync(join(CARPETA, `${capa.archivo}.png`), png(capa.ancho, capa.alto, l.datos));
  }
}
console.log(`${dibujos.size} dibujos en ${CARPETA}`);

// ---------- El CSS ----------

const QUIEN = ":is(.ficha-jugador, .perfil-fondo, .perfil-cabeza, .logro-premio, .tienda-muestra, .lleva-fondo)";
const px = (n) => (n === 0 ? "0" : `calc(${Math.round(n * 100) / 100} * var(--px))`);
const REPETIR = { x: "repeat-x", xy: "repeat", no: "no-repeat" };

// Las animaciones de un fondo («animacion»: una o una lista). Cada una con su duración, cómo avanza
// (pasos: a saltos iguales; si no, en línea entre sus paradas) y el eje que mueve ("x", "y" o, si no
// lo dice, los dos). Con dos (una en "x" y otra en "y") cada eje lleva su ritmo: los fantasmas van
// de lado despacio mientras suben y bajan más deprisa. Lo que desplaza a cada capa es su «mueve» o,
// si la animación trae el suyo, el de ahí (por el nombre de la capa).
const animacionesDe = (fondo) => (fondo.animacion ? [].concat(fondo.animacion) : []);

// Lo que se ha desplazado una capa en ese momento de la vuelta (0…1) de esa animación
function desplazado(capa, t, animacion) {
  const mueve = animacion.mueve ? animacion.mueve[capa.nombre] : capa.mueve;
  if (!mueve) return [0, 0];
  if (typeof mueve === "function") return mueve(t);
  return [mueve[0] * t, mueve[1] * t];
}

// Dónde va una capa, ya desplazada: [derecha, abajo] en píxeles del dibujo (o solo un eje)
function sitioDe(capa, [dx, dy], eje = "xy") {
  const { x = 0, y = 0, lado = "izquierda", desde = "arriba" } = capa.sitio;
  const horizontal = lado === "derecha" ? `right ${px(x - dx)}` : `left ${px(x + dx)}`;
  const vertical = desde === "abajo" ? `bottom ${px(y - dy)}` : `top ${px(y + dy)}`;
  return eje === "x" ? horizontal : eje === "y" ? vertical : `${horizontal} ${vertical}`;
}

function posiciones(fondo, t, animacion = null, eje = "xy") {
  const capas = fondo.capas.map((capa) => sitioDe(capa, animacion ? desplazado(capa, t, animacion) : [0, 0], eje));
  return [...capas, ...fondo.tinte.map(() => (eje === "xy" ? "0 0" : "0"))].join(", ");
}

const css = [
  `/* Fondos en pixel art de la tarjeta de jugador: los de región y los de la Tienda.
   GENERADO por herramientas/generar-fondos-pixel.mjs: no se toca a mano, se cambia allí y se
   vuelve a ejecutar. Los dibujos están en img/fondos/ (region-*.png, tienda-*.png).

   Cada píxel del dibujo mide --px: 2px en las tarjetas grandes y 1px en las muestras y franjas
   (así caben enteros). Se amplían sin suavizar, como el escenario de «Combates». Lo que se mueve
   desplaza sus capas a saltos de un píxel. */

.fondo-pixel {
  --px: 2px;
  image-rendering: pixelated;
  /* Con tanto dibujo detrás, la letra lleva sombra para que se lea bien (la sombra se hereda:
     vale para todo lo que va escrito en la tarjeta) */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.6);
}

/* En el tema claro la letra es oscura: un halo claro en vez de sombra */
:root[data-tema="claro"] .fondo-pixel {
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.95), 0 0 6px rgba(255, 255, 255, 0.8);
}

:is(.tienda-muestra, .perfil-fondo, .logro-premio, .lleva-fondo).fondo-pixel {
  --px: 1px;
}

/* image-rendering se hereda: que no pase a las fotos de dentro (sin especificidad, así lo que
   ya diga cada foto sigue mandando) */
:where(.fondo-pixel) * {
  image-rendering: auto;
}

/* Ni en los botones, campos y plaquitas de título, que ya llevan su propio fondo */
:where(.fondo-pixel) :where(button, input, select, textarea, .perfil-titulo) {
  text-shadow: none;
}
`
];

for (const fondo of FONDOS) {
  const imagenes = [...fondo.capas.map((capa) => `url("../img/fondos/${capa.archivo}.png")`), ...fondo.tinte];
  const tamanos = [...fondo.capas.map((capa) => capa.tamano || `${px(capa.ancho)} ${px(capa.alto)}`), ...fondo.tinte.map(() => "auto")];
  const repetir = [...fondo.capas.map((capa) => REPETIR[capa.repetir]), ...fondo.tinte.map(() => "no-repeat")];
  const reglas = [
    `  background-image:\n    ${imagenes.join(",\n    ")};`,
    `  background-size: ${tamanos.join(", ")};`,
    `  background-position: ${posiciones(fondo, 0)};`,
    `  background-repeat: ${repetir.join(", ")};`
  ];
  const animaciones = animacionesDe(fondo);
  let fotogramas = "";
  if (animaciones.length) {
    const nombre = (animacion) => `fondo-${fondo.id}${animacion.nombre ? `-${animacion.nombre}` : ""}`;
    const PROPIEDAD = { x: "background-position-x", y: "background-position-y", xy: "background-position" };
    reglas.push(`  animation: ${animaciones
      .map((animacion) => `${nombre(animacion)} ${animacion.duracion}s ${animacion.pasos ? `steps(${animacion.pasos})` : "linear"} infinite`)
      .join(", ")};`);
    fotogramas = animaciones.map((animacion) => {
      const eje = animacion.eje || "xy";
      const paradas = [...new Set(animacion.paradas || [0, 1])].sort((a, b) => a - b);
      return `\n@keyframes ${nombre(animacion)} {\n${paradas
        .map((t) => `  ${Math.round(t * 1e6) / 1e4}% { ${PROPIEDAD[eje]}: ${posiciones(fondo, t, animacion, eje)}; }`)
        .join("\n")}\n}\n`;
    }).join("");
  }
  css.push(`/* ${fondo.comentario} */\n${QUIEN}.fondo-${fondo.id} {\n${reglas.join("\n")}\n}\n${fotogramas}`);
}

const animados = FONDOS.filter((fondo) => animacionesDe(fondo).length).map((fondo) => `.fondo-${fondo.id}`);
css.push(`@media (prefers-reduced-motion: reduce) {\n  ${QUIEN}:is(${animados.join(", ")}) {\n    animation: none;\n  }\n}\n`);
writeFileSync(ARCHIVO_CSS, css.join("\n"));
console.log(`CSS en ${ARCHIVO_CSS}`);

// ---------- La muestra ----------
//
// Cada fondo en una tarjeta de 320×100 píxeles del dibujo (como una de «Amigos» a ×2), con los
// tintes de arriba abajo (los demás no), sobre el color de las tarjetas de los temas Atardecer y Claro, y ampliada a ×2

// Un degradado de arriba abajo («to bottom» o «to top») como función de la altura (0…1) que
// devuelve [r, g, b, a]; los demás (radiales, en diagonal), null: la muestra no los pinta
function tinteEn(tinte) {
  const partes = /^linear-gradient\(to (bottom|top), (.*)\)$/.exec(tinte);
  if (!partes) return null;
  const paradas = partes[2].split(/,\s*(?=rgba|transparent)/).map((trozo) => {
    const color = /rgba\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/.exec(trozo);
    const donde = /([\d.]+)(%|px)\s*$/.exec(trozo);
    return {
      color: color ? color.slice(1).map(Number) : [0, 0, 0, 0],
      donde: donde && donde[2] === "%" ? Number(donde[1]) / 100 : null
    };
  });
  paradas.forEach((parada, i) => { if (parada.donde === null) parada.donde = i === 0 ? 0 : i === paradas.length - 1 ? 1 : null; });
  paradas.forEach((parada, i) => {
    if (parada.donde !== null) return;
    const antes = paradas.slice(0, i).reverse().find((p) => p.donde !== null);
    const despues = paradas.slice(i + 1).find((p) => p.donde !== null);
    parada.donde = (antes.donde + despues.donde) / 2;
  });
  return (h) => {
    const t = partes[1] === "top" ? 1 - h : h;
    const i = paradas.findIndex((p) => p.donde >= t);
    if (i <= 0) return paradas[Math.max(0, i)].color;
    const [a, b] = [paradas[i - 1], paradas[i]];
    const k = (t - a.donde) / Math.max(1e-6, b.donde - a.donde);
    return a.color.map((v, n) => v + (b.color[n] - v) * k);
  };
}

const carpetaMuestra = process.argv[2];
if (carpetaMuestra) {
  const soloEstos = process.argv[3] ? process.argv[3].split(",") : null;
  const momento = Number(process.argv[4]) || 0;
  const elegidos = FONDOS.filter((fondo) => !soloEstos || soloEstos.some((parte) => fondo.id.includes(parte)));
  const [TW, TH, ESCALA, HUECO] = [320, 100, 2, 4];
  const TEMAS = ["#32302f", "#ffffff"];
  const ancho = (TW * TEMAS.length + HUECO) * ESCALA;
  const alto = (TH + HUECO) * ESCALA * elegidos.length;
  const muestra = new Uint8Array(ancho * alto * 4);
  elegidos.forEach((fondo, fila) => {
    TEMAS.forEach((tema, columna) => {
      const tarjeta = Array.from({ length: TW * TH }, () => rgb(tema));
      for (const tinte of [...fondo.tinte].reverse()) {
        const color = tinteEn(tinte);
        if (!color) continue;
        for (let ty = 0; ty < TH; ty++) {
          const [r, g, b, a] = color(ty / (TH - 1));
          for (let tx = 0; tx < TW; tx++) {
            const c = tarjeta[ty * TW + tx];
            tarjeta[ty * TW + tx] = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)];
          }
        }
      }
      for (const capa of [...fondo.capas].reverse()) {
        const datos = dibujos.get(capa.archivo);
        const { x = 0, y = 0, lado = "izquierda", desde = "arriba" } = capa.sitio;
        const [dx, dy] = animacionesDe(fondo).reduce(([sx, sy], animacion) => {
          const [ax, ay] = desplazado(capa, momento, animacion);
          return [sx + (animacion.eje === "y" ? 0 : ax), sy + (animacion.eje === "x" ? 0 : ay)];
        }, [0, 0]);
        // Las que ocupan toda la tarjeta (el destello de la tormenta): su color, si está a la vista
        if (capa.tamano) {
          if (y + dy !== 0) continue;
          const a = datos[3] / 255;
          for (let k = 0; k < TW * TH; k++) tarjeta[k] = [0, 1, 2].map((c) => datos[c] * a + tarjeta[k][c] * (1 - a));
          continue;
        }
        const x0 = Math.round(lado === "derecha" ? TW - capa.ancho - (x - dx) : x + dx);
        const y0 = Math.round(desde === "abajo" ? TH - capa.alto - (y - dy) : y + dy);
        for (let ty = 0; ty < TH; ty++) {
          for (let tx = 0; tx < TW; tx++) {
            let sx = tx - x0;
            let sy = ty - y0;
            if (capa.repetir !== "no") sx = vuelta(sx, capa.ancho);
            if (capa.repetir === "xy") sy = vuelta(sy, capa.alto);
            if (sx < 0 || sy < 0 || sx >= capa.ancho || sy >= capa.alto) continue;
            const j = (sy * capa.ancho + sx) * 4;
            const a = datos[j + 3] / 255;
            if (!a) continue;
            const c = tarjeta[ty * TW + tx];
            tarjeta[ty * TW + tx] = [0, 1, 2].map((k) => datos[j + k] * a + c[k] * (1 - a));
          }
        }
      }
      for (let ty = 0; ty < TH * ESCALA; ty++) {
        for (let tx = 0; tx < TW * ESCALA; tx++) {
          const c = tarjeta[Math.floor(ty / ESCALA) * TW + Math.floor(tx / ESCALA)];
          const k = ((fila * (TH + HUECO) * ESCALA + ty) * ancho + columna * (TW + HUECO) * ESCALA + tx) * 4;
          muestra.set([...c.map(Math.round), 255], k);
        }
      }
    });
  });
  writeFileSync(join(carpetaMuestra, "muestra-fondos-pixel.png"), png(ancho, alto, muestra));
  console.log(`Muestra en ${join(carpetaMuestra, "muestra-fondos-pixel.png")}`);
}

