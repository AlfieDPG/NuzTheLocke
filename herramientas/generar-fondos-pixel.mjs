// Dibuja en pixel art los fondos de la tarjeta de jugador: los de metal (plata, oro y platino, con
// los logros de conseguir logros: la chapa lisa con su brillo), los de región (se ganan completando cada
// generación en la colección de «Juegos»), los de Eevee (con los logros de registrarlas) y los de
// la Tienda.
// Guarda las capas en img/fondos/ (metal-<id>-<capa>.png, region-<id>-<capa>.png,
// eevee-<id>-<capa>.png, tienda-<id>-<capa>.png)
// y escribe su CSS en
// css/fondos-pixel.css (ese archivo no se toca a mano: se cambia aquí y se vuelve a ejecutar).
//
//   node herramientas/generar-fondos-pixel.mjs [carpeta-para-la-muestra] [solo,estos] [momento]
//
// Cada fondo son una o varias capas que se repiten (a lo ancho, o a lo ancho y a lo alto) sin que
// se note el corte, encima de su cielo: un degradado OPACO, para que el fondo se vea igual con
// cualquier tema (no deja ver el color de la tarjeta, que cambia con el tema). La web los amplía
// sin suavizar: cada píxel mide --px (2px en las tarjetas grandes, 1px en las muestras pequeñas).
// Lo que se mueve lo hace desplazando sus capas (background-position), a saltos de un píxel o
// cambiando de dibujo de golpe, como en los juegos.
// Mismas mañas que el escenario de «Combates» (js/lucha/escenario.js): trama de Bayer, siluetas
// con ondas y un azar fijo. Todo dibujado por código: nada de imágenes de otros ni de IA.
//
// Con una carpeta, deja además allí muestra-fondos-pixel.png: cada fondo como se ve en la tarjeta
// de «Amigos», en la ficha del perfil y en la Tienda, para mirarlos sin abrir la web. Detrás se
// pueden poner solo algunos (kanto,tienda-bosque), el momento de la animación que se quiere ver
// (de 0 a 1) y a cuánto se amplía (2 si no se dice).

import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { png } from "./png.mjs";
import { sello } from "./sellos-pixel.mjs";

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

// A lo ancho da la vuelta (menos en las capas con «recortar», las esquinas: ahí lo que se sale se
// pierde); a lo alto, solo en las capas que se repiten también hacia abajo
function lienzo(ancho = W, alto = H, envolverAlto = false, envolverAncho = true) {
  const datos = new Uint8Array(ancho * alto * 4);
  // alfa: lo opaco que queda (0…1; si no se dice, del todo). Lo que se pinta encima tapa lo de debajo.
  const poner = (x, y, color, alfa = 1) => {
    y = envolverAlto ? vuelta(y, alto) : Math.round(y);
    if (y < 0 || y >= alto) return;
    if (!envolverAncho && (Math.round(x) < 0 || Math.round(x) >= ancho)) return;
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

// El cielo de los fondos de día (cieloDeDia): azul, más claro hacia el horizonte
const CIELO_DE_DIA = "linear-gradient(to bottom, rgb(80, 167, 248), rgb(116, 189, 255) 50%, rgb(150, 212, 255))";
const NUBES_DE_DIA = { nombre: "nubes", ancho: 256, alto: 36, repetir: "x", sitio: { y: 4, desde: "arriba" }, pintar: nubesDeDia };

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

// ---------- Piezas de los fondos claros (pompas, cerezos, girasoles, playa, globos, Centro) ----------

// Una pompa de jabón: el borde tornasolado (cada tramo de un color, según hacia dónde mira), por
// dentro casi transparente y el brillo arriba a la izquierda
const TORNASOL = ["#ff9ad0", "#ffd27a", "#9af0c8", "#8ad0ff", "#c8a8ff"];
function pompa(l, cx, cy, r, a) {
  const giro = (cx * 3 + cy * 5) % TORNASOL.length;
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.5) continue;
      if (d > r - 0.5) {
        const angulo = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
        l.poner(cx + x, cy + y, TORNASOL[(Math.floor(angulo * TORNASOL.length) + giro) % TORNASOL.length], a);
      } else if (r > 2) l.poner(cx + x, cy + y, "#ffffff", a * 0.16);
    }
  }
  if (r < 2) return;
  const b = Math.round(r * 0.45);
  l.poner(cx - b, cy - b, "#ffffff", 1);
  if (r > 3) {
    l.poner(cx - b + 1, cy - b, "#ffffff", 0.8);
    l.poner(cx - b, cy - b + 1, "#ffffff", 0.8);
  }
  if (r > 4) for (const [dx, dy] of [[0.6, 0.35], [0.4, 0.6]]) l.poner(cx + Math.round(r * dx), cy + Math.round(r * dy), "#ffffff", 0.6);
}

// Un pétalo de cerezo (de dos o tres píxeles), en una de cuatro posturas
function petalo(l, x, y, postura, a) {
  const formas = [[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0]], [[0, 0], [1, 1], [2, 1]]];
  formas[postura % 4].forEach(([dx, dy], i) => l.poner(x + dx, y + dy, i ? "#ffb4cc" : "#ffe4ee", a));
}

// Un racimo de flores de cerezo: la sombra abajo, el rosa y la luz arriba a la izquierda
function racimo(l, x, y, r, a = 1) {
  disco(l, x, y, r, "#e07ea2", a);
  disco(l, x - 1, y - 1, Math.max(1, r - 1), "#f6a8c4", a);
  if (r > 2) l.poner(x - 1, y - 2, "#ffd8e6", a);
  l.poner(x - r + 1, y - 1, "#fff4f8", a);
}

// Un girasol: el tallo (con hojas, si es grande) y la cabeza de cara, con los pétalos alrededor
// (más claros arriba a la izquierda) y el centro marrón con trama
// Una hoja ancha en diagonal (hacia lado), con el nervio claro
function hoja(l, x, y, largo, lado) {
  for (let k = 0; k < largo; k++) {
    const ancho = Math.round(Math.sin((Math.PI * (k + 0.5)) / largo) * largo * 0.28);
    const [px, py] = [x + lado * k, y - Math.round(k * 0.45)];
    for (let j = -ancho; j <= ancho; j++) l.poner(px, py + j, j < 0 ? "#5cb844" : "#3c8a2c");
    if (k > 0 && k < largo - 1) l.poner(px, py, "#86d060");
  }
}

function girasol(l, x, base, alto, tam) {
  const cy = base - alto - tam;
  for (let k = 0; k <= alto; k++) {
    l.poner(x, base - k, k % 5 ? "#3c8a2c" : "#4ca23a");
    if (tam > 2) l.poner(x + 1, base - k, "#2e7222");
  }
  if (tam > 1) {
    for (const [ky, lado] of [[0.3, -1], [0.55, 1], [0.8, -1]]) {
      if (tam < 3 && ky > 0.7) continue;
      hoja(l, lado < 0 ? x - 1 : x + (tam > 2 ? 2 : 1), base - Math.round(alto * ky), tam * 2 + 2, lado);
    }
  }
  const R = tam * 2.1 + 1;
  const n = tam > 2 ? 14 : 9;
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) {
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= tam + 0.3) {
        l.poner(x + dx, cy + dy, dx + dy < -tam * 0.7 ? "#a0662e" : (dx + dy) % 2 ? "#8a5426" : "#5e3416");
      } else if (d <= R) {
        const punta = (d - tam) / (R - tam);
        if (Math.cos(Math.atan2(dy, dx) * n) < punta * 2.2 - 1.4) continue;
        l.poner(x + dx, cy + dy, dx + dy < -R * 0.3 ? "#ffe866" : dx + dy > R * 0.6 ? "#f0a018" : "#ffc928");
      }
    }
  }
}

// Una abeja de lado (mirando a la derecha): alas claras, rayas amarillas y negras
function abeja(l, x, y) {
  mapa(l, x, y, [
    "..aa...",
    ".aaaa..",
    ".ybyby.",
    "bybybyk",
    ".ybyby."
  ], { a: "#eef8ff", y: "#ffd23a", b: "#2a2220", k: "#2a2220" }, 1);
}

// Una gaviota de frente, con las alas en uve
function gaviota(l, x, y, a) {
  mapa(l, x, y, [".ww...ww.", "g..wkw..g"], { w: "#ffffff", g: "#9aa8b8", k: "#f0b030" }, a);
}

// Un globo aerostático: la tela a gajos de dos colores (curvos, como si fuera redonda), más estrecha
// hacia la boca, con sombra a la derecha y un brillo; las cuerdas y la cesta.
// colores: [uno, su sombra, otro, su sombra]
function globo(l, cx, top, r, [c1, s1, c2, s2], a = 1) {
  const alto = Math.round(r * 2.2);
  let boca = 1;
  for (let y = 0; y <= alto; y++) {
    const hw = y <= r ? Math.sqrt(Math.max(0, r * r - (y - r) ** 2)) : r - ((y - r) / (alto - r)) * r * 0.7;
    boca = hw;
    for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
      const u = x / Math.max(1, hw);
      const gajo = Math.floor((u + 1) * 3) % 2;
      let c = gajo ? c2 : c1;
      if (u > 0.4 && umbral(cx + x, top + y) < (u - 0.4) * 1.8) c = gajo ? s2 : s1;
      l.poner(cx + x, top + y, c, a);
    }
  }
  const b = Math.round(boca);
  rect(l, cx - b, top + alto, b * 2 + 1, 1, "#8a4a2a", a);
  for (const [dx, dy] of [[-0.55, 0.4], [-0.45, 0.3], [-0.6, 0.55]]) l.poner(cx + Math.round(r * dx), top + Math.round(r * dy), "#ffffff", a * 0.75);
  const yb = top + alto + 1;
  const cuerdas = Math.max(2, Math.round(r * 0.3));
  for (let k = 0; k < cuerdas; k++) {
    l.poner(cx - b + Math.round((k * (b - 1)) / cuerdas), yb + k, "#6a5040", a);
    l.poner(cx + b - Math.round((k * (b - 1)) / cuerdas), yb + k, "#6a5040", a);
  }
  const ancho = Math.max(3, Math.round(r * 0.5));
  const yc = yb + cuerdas;
  rect(l, cx - Math.floor(ancho / 2), yc, ancho, Math.max(2, Math.round(r * 0.35)), "#a0703a", a);
  rect(l, cx - Math.floor(ancho / 2), yc, ancho, 1, "#c89050", a);
}

// Una flor de cerezo de cara: cinco pétalos con la muesca en la punta, el borde algo más oscuro
// (para que se vea sobre el rosa), la luz arriba a la izquierda, el centro fucsia y estambres
function florCerezo(l, cx, cy, r, giro = 0) {
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.sqrt(x * x + y * y);
      const angulo = Math.atan2(y, x) - giro;
      const borde = r * (0.6 + 0.4 * Math.abs(Math.cos(2.5 * angulo)));
      if (d > borde + 0.5) continue;
      if (d > r * 0.7 && Math.abs(Math.sin(2.5 * angulo)) < 0.12) continue; // la muesca
      let c = x + y < -r * 0.4 ? "#ffe2ec" : "#ffc4d8";
      if (d > borde - 0.6) c = "#e888a8";
      else if (d < r * 0.28) c = "#e0507a";
      else if (d < r * 0.5) c = "#f590b0";
      l.poner(cx + x, cy + y, c);
    }
  }
  if (r < 3) return;
  for (let k = 0; k < 5; k++) {
    const a = giro + (k * 2 * Math.PI) / 5 + Math.PI / 5;
    l.poner(cx + Math.round(Math.cos(a) * r * 0.45), cy + Math.round(Math.sin(a) * r * 0.45), "#ffe066");
  }
}

// Una rama florida que entra por una esquina (dibujada para la de arriba a la derecha; espejoX y
// espejoY le dan la vuelta para las otras): la rama con ramitas, flores grandes y pequeñas y capullos
function esquinaFlorida(l, azar, espejoX, espejoY) {
  const lienzoEspejo = { ...l, poner: (x, y, c, a) => l.poner(espejoX ? l.ancho - 1 - x : x, espejoY ? l.alto - 1 - y : y, c, a) };
  const e = lienzoEspejo;
  const [W0, H0] = [l.ancho, l.alto];
  const flores = [];
  const trazo = (x0, y0, x1, y1, grueso, ramas) => {
    const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= pasos; k++) {
      const t = k / pasos;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI * 2) * 2);
      const g = Math.max(1, Math.round(grueso * (1 - t * 0.6)));
      for (let j = 0; j < g; j++) e.poner(x, y + j, j === 0 ? "#7a5250" : "#4e3232");
      if (ramas && k > 6 && k % 9 === 0) {
        const largo = 6 + Math.floor(azar() * 6);
        const abajo = azar() < 0.6 ? 1 : -1;
        for (let j = 1; j <= largo; j++) e.poner(x - Math.round(j * 0.6), y + abajo * j, "#5e3e3c");
        flores.push([x - Math.round(largo * 0.6), y + abajo * largo, 3 + Math.floor(azar() * 2)]);
      }
      if (k % 6 === 3) flores.push([x + Math.round((azar() - 0.5) * 6), y + (azar() < 0.5 ? -3 : 4), 2 + Math.floor(azar() * 3)]);
    }
  };
  trazo(W0 + 2, -2, Math.round(W0 * 0.12), Math.round(H0 * 0.45), 3, true);
  trazo(W0 - 4, Math.round(H0 * 0.1), Math.round(W0 * 0.55), Math.round(H0 * 0.85), 2, false);
  flores.sort((uno, otro) => uno[2] - otro[2]);
  for (const [x, y, r] of flores) {
    if (r <= 2 && azar() < 0.35) {
      disco(e, x, y, 1, "#e8608a");
      e.poner(x - 1, y - 1, "#ff9ab8");
    } else {
      const giro = azar() * Math.PI;
      // Las flores, en el lienzo de verdad (el dibujo de la flor no tiene lado)
      florCerezo(l, espejoX ? W0 - 1 - x : x, espejoY ? H0 - 1 - y : y, r, giro);
    }
  }
}

// Una enfermera de Centro Pokémon, de cintura para arriba (detrás del mostrador): pelo rosa con
// sus dos aros a los lados, cofia blanca con la cruz roja, uniforme rosa con delantal blanco.
// (cx: el centro; y0: lo de más arriba, la cofia)
function enfermera(l, cx, y0) {
  const [pelo, peloSombra, piel, pielSombra] = ["#ff8ab4", "#e0608e", "#ffe2cc", "#f4c4aa"];
  // Los aros del pelo, a los lados (con su hueco)
  for (const lado of [-1, 1]) {
    disco(l, cx + lado * 7, y0 + 13, 3, lado < 0 ? pelo : peloSombra);
    l.poner(cx + lado * 7, y0 + 13, "#000000", 0);
    rect(l, cx + lado * 6 - (lado > 0 ? 1 : 0), y0 + 8, 2, 4, lado < 0 ? pelo : peloSombra);
  }
  // El uniforme
  rect(l, cx - 6, y0 + 18, 13, 6, "#ff9cc2");
  rect(l, cx + 3, y0 + 18, 4, 6, "#e87aa6");
  rect(l, cx - 6, y0 + 18, 1, 6, "#e87aa6");
  rect(l, cx - 5, y0 + 17, 11, 1, "#ff9cc2");
  rect(l, cx - 2, y0 + 17, 5, 2, "#ffffff");
  l.poner(cx, y0 + 18, "#ff9cc2");
  rect(l, cx - 3, y0 + 20, 7, 4, "#ffffff");
  rect(l, cx + 2, y0 + 20, 2, 4, "#ece4ee");
  // El cuello y la cara
  rect(l, cx - 1, y0 + 16, 3, 1, pielSombra);
  rect(l, cx - 4, y0 + 9, 9, 5, piel);
  rect(l, cx - 3, y0 + 14, 7, 1, piel);
  rect(l, cx - 2, y0 + 15, 5, 1, pielSombra);
  rect(l, cx + 4, y0 + 10, 1, 4, pielSombra);
  for (const dx of [-2, 2]) rect(l, cx + dx, y0 + 11, 1, 2, "#3a5ab0");
  for (const dx of [-2, 2]) l.poner(cx + dx, y0 + 11, "#8ab0f0");
  for (const dx of [-3, 3]) l.poner(cx + dx, y0 + 13, "#ffaab8");
  rect(l, cx - 1, y0 + 14, 3, 1, "#e0607a");
  // El pelo de arriba y el flequillo
  rect(l, cx - 5, y0 + 4, 11, 4, pelo);
  rect(l, cx - 4, y0 + 3, 9, 1, pelo);
  rect(l, cx + 3, y0 + 4, 3, 4, peloSombra);
  for (const dx of [-5, -4, -1, 0, 3, 5]) l.poner(cx + dx, y0 + 8, dx > 2 ? peloSombra : pelo);
  rect(l, cx - 5, y0 + 9, 1, 3, pelo);
  rect(l, cx + 5, y0 + 9, 1, 3, peloSombra);
  // La cofia con la cruz
  rect(l, cx - 3, y0, 7, 4, "#ffffff");
  rect(l, cx - 2, y0 - 1, 5, 1, "#ffffff");
  rect(l, cx + 3, y0, 1, 4, "#e2dae6");
  rect(l, cx, y0, 1, 3, "#ee3a4c");
  rect(l, cx - 1, y0 + 1, 3, 1, "#ee3a4c");
}

// Una sombrilla de playa a gajos (el palo, de pie en y + 15) con su toalla de rayas al lado
function sombrilla(l, x, y, [uno, otro, borde], [toalla, toalla2]) {
  rect(l, x, y, 1, 16, "#8a6a4a");
  for (let dy = -8; dy <= 0; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (dx * dx + (dy * 1.25) ** 2 > 100) continue;
      l.poner(x + dx, y + dy, Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 6)) % 2 ? otro : uno);
    }
  }
  for (let dx = -10; dx <= 10; dx += 2) l.poner(x + dx, y + 1, borde);
  for (let dy = 12; dy < 16; dy++) for (let dx = 5; dx < 19; dx++) l.poner(x + dx, y + dy, (dx >> 1) % 2 ? toalla2 : toalla);
}

// Una estrella pequeña: un punto (0), en cruz (1) o de cinco puntas (2)
function estrellita(l, x, y, tam, color, a = 1) {
  if (tam === 0) return l.poner(x, y, color, a);
  if (tam === 1) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, color, dx || dy ? a * 0.7 : a);
    return undefined;
  }
  mapa(l, x - 2, y - 2, ["..a..", "aaaaa", ".aaa.", ".a.a.", "a...a"], { a: color }, a);
  l.poner(x, y, "#ffffff", a);
  return undefined;
}

// Las nubes de «Noche estrellada»: lilas, con la luz de la luna arriba
const NUBES_DE_NOCHE = ["#dcd8fa", "#aaa6e0", "#7e7ac0"];

// Una luna creciente con su resplandor
function lunaCreciente(l, cx, cy, r) {
  brillo(l, cx, cy, r + 9, "#fff4c0", 0.45, 0.35);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const [cxCorte, cyCorte, rCorte] = [r * 0.5, -r * 0.3, r * 0.85];
      if ((x - cxCorte) ** 2 + (y - cyCorte) ** 2 <= rCorte * rCorte) continue;
      l.poner(cx + x, cy + y, x + y > r * 0.2 && umbral(cx + x, cy + y) < 0.5 ? "#f0d880" : "#fff2b0");
    }
  }
}

// Las estrellas fugaces de «Espacio exterior»: [empieza, acaba] (en la vuelta) y de dónde sale
const FUGACES_ESPACIO = [[0.3, 0.35, 40], [0.78, 0.83, 150]];

// Los palos de la baraja (5×5) y las letras de los naipes (3×5)
const PALOS = {
  corazon: [".a.a.", "aaaaa", "aaaaa", ".aaa.", "..a.."],
  diamante: ["..a..", ".aaa.", "aaaaa", ".aaa.", "..a.."],
  pica: ["..a..", ".aaa.", "aaaaa", "aaaaa", ".a.a."],
  trebol: ["..a..", ".aaa.", "aa.aa", "aaaaa", "..a.."]
};
const LETRAS_NAIPE = {
  A: [".a.", "a.a", "aaa", "a.a", "a.a"], K: ["a.a", "aa.", "a..", "aa.", "a.a"],
  Q: [".a.", "a.a", "a.a", "aa.", ".aa"], J: ["..a", "..a", "..a", "a.a", ".a."]
};

// Un naipe de 11×15: el borde, la letra en la esquina y el palo en medio (rojo o negro)
function naipe(l, x, y, letra, palo) {
  const color = palo === "corazon" || palo === "diamante" ? "#d8283a" : "#2a2228";
  rect(l, x, y, 11, 15, "#4a3a48");
  rect(l, x + 1, y + 1, 9, 13, "#fffaf0");
  rect(l, x + 9, y + 1, 1, 13, "#e8e0d8");
  mapa(l, x + 2, y + 2, LETRAS_NAIPE[letra], { a: color }, 1);
  mapa(l, x + 3, y + 8, PALOS[palo], { a: color }, 1);
}

// Una ficha de póquer vista desde arriba, con las muescas blancas del borde
function fichaPoker(l, x, y, color) {
  disco(l, x, y, 3, color);
  for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) l.poner(x + dx, y + dy, "#ffffff");
  disco(l, x, y, 1, "#ffffff");
  l.poner(x, y, color);
}

// Una pila de fichas de lado (n fichas), de pie en base
function pilaDeFichas(l, x, base, n, color) {
  for (let k = 0; k < n; k++) {
    const y = base - k * 2;
    rect(l, x - 3, y - 1, 7, 2, color);
    l.poner(x - 2, y - 1, "#ffffff");
    l.poner(x + 1, y - 1, "#ffffff");
    l.poner(x + 3, y, "#000000", 0.3);
  }
  rect(l, x - 2, base - n * 2 - 1, 5, 1, color);
  l.poner(x, base - n * 2 - 1, "#ffffff");
}

// Un dado de 7×7 con n puntos
function dado(l, x, y, n) {
  rect(l, x, y, 7, 7, "#c8c0c8");
  rect(l, x, y, 6, 6, "#fffaf0");
  const p = { tl: [1, 1], tr: [4, 1], ml: [1, 3], c: [3, 3], mr: [4, 3], bl: [1, 4], br: [4, 4] };
  const puntos = { 1: ["c"], 2: ["tl", "br"], 3: ["tl", "c", "br"], 4: ["tl", "tr", "bl", "br"], 5: ["tl", "tr", "c", "bl", "br"], 6: ["tl", "tr", "ml", "mr", "bl", "br"] }[n];
  for (const cual of puntos) l.poner(x + p[cual][0], y + p[cual][1], n === 1 ? "#d8283a" : "#2a2228");
}

// Los colores de las hojas de otoño: [la hoja, su sombra]
const COLORES_OTONO = [["#e8642a", "#b8441a"], ["#d23c2a", "#9a2a20"], ["#f0b030", "#c88418"], ["#c87a3a", "#8a5224"]];

// Una hoja de arce de 7×7 (con el rabito), la mitad derecha en sombra; ladeada: la otra postura
function hojaArce(l, x, y, [color, sombra], ladeada = false) {
  const dibujo = ladeada
    ? ["..a....", ".aaa.a.", "aaaaaa.", ".aaaaab", "aaaab..", "...b...", "..b...."]
    : ["...a...", ".a.a.a.", "aaaaaaa", ".aaaaa.", "aaaaaaa", "...b...", "...b..."];
  dibujo.forEach((fila, dy) => [...fila].forEach((c, dx) => {
    if (c === "a") l.poner(x + dx, y + dy, dx > 3 ? sombra : color);
    if (c === "b") l.poner(x + dx, y + dy, "#6a4424");
  }));
}

// Un montón de hojas de otoño, de pie en base (cx: el centro; ancho y alto: lo que abulta)
function montonDeHojas(l, azar, cx, base, ancho, alto) {
  for (let k = 0; k < ancho * alto * 0.12; k++) {
    const dx = (azar() * 2 - 1) * ancho;
    const sube = (1 - Math.abs(dx) / ancho) * alto * azar();
    hojaArce(l, Math.round(cx + dx - 3), Math.round(base - 5 - sube), COLORES_OTONO[Math.floor(azar() * COLORES_OTONO.length)], azar() < 0.5);
  }
}

// Una calabaza de pie en base (cx: el centro; r: medio ancho): gajos redondos que se solapan (los
// de los lados, más oscuros), el borde de cada uno marcado, la luz arriba a la izquierda, el rabo y
// una hoja
function calabaza(l, cx, base, r) {
  const alto = Math.round(r * 1.45);
  const cy = base - alto / 2;
  const gajos = [[-0.5, 0.55, "#d8681e"], [0.5, 0.55, "#d8681e"], [-0.24, 0.6, "#f08028"], [0.24, 0.6, "#f08028"], [0, 0.5, "#ff9634"]];
  for (const [dx, ancho, color] of gajos) {
    const [ex, rx, ry] = [cx + dx * r, r * ancho, alto / 2];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(ex - rx); x <= Math.ceil(ex + rx); x++) {
        const d = ((x - ex) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) continue;
        let c = color;
        if (d > 0.78) c = "#b8501a";
        else if (dx <= 0 && x < ex - rx * 0.3 && y < cy - ry * 0.2 && umbral(x, y) < 0.6) c = "#ffb860";
        l.poner(x, y, c);
      }
    }
  }
  const arriba = Math.round(cy - alto / 2);
  rect(l, cx - 1, arriba - 4, 3, 6, "#6a5a2a");
  rect(l, cx - 1, arriba - 4, 1, 6, "#8a7a3a");
  hojaOval(l, cx + 2, arriba - 1, 7, -0.5, ["#3e7a2a", "#5a9a3a", "#9ad06a"]);
  for (const [dx, dy] of [[-2, -5], [-3, -6], [-4, -6], [-5, -5]]) l.poner(cx + dx, arriba + dy, "#5a8a2a");
}

// Una bellota (5 de ancho): el sombrerito con trama y el fruto
function bellota(l, x, y) {
  mapa(l, x - 2, y, [".ccc.", "ccccc", ".bbb.", ".bbb.", "..b.."], { c: "#8a5a2a", b: "#c8884a" }, 1);
}

// Una liana que cuelga desde arriba (x, y0), ondulando, con hojitas a los dos lados
function liana(l, x, y0, largo, hojas) {
  for (let k = 0; k < largo; k++) {
    const px = x + Math.round(Math.sin(k / 4) * 1.5);
    l.poner(px, y0 + k, "#5a7a3a");
    if (k % 5 === 3) hojaOval(l, px, y0 + k, 4, Math.PI / 2 + (k % 10 < 5 ? 0.9 : -0.9), hojas[k % hojas.length]);
  }
  hojaOval(l, x + Math.round(Math.sin(largo / 4) * 1.5), y0 + largo - 1, 5, Math.PI / 2, hojas[0]);
}

// Un naipe boca abajo (11×15): rojo con un enrejado blanco
function naipeReves(l, x, y) {
  rect(l, x, y, 11, 15, "#4a3a48");
  rect(l, x + 1, y + 1, 9, 13, "#ffffff");
  for (let dy = 2; dy < 13; dy++) for (let dx = 2; dx < 9; dx++) l.poner(x + dx, y + dy, (dx + dy) % 3 ? "#c8283a" : "#ff8a96");
}

// Un montoncito de nieve que baja hasta abajo del todo (para que lo de encima no flote), con su luz
function montoncitoDeNieve(l, cx, arriba, media) {
  for (let y = arriba; y < l.alto; y++) {
    const ancho = Math.round(media * Math.min(1, 0.55 + ((y - arriba) / 6) * 0.45));
    for (let dx = -ancho; dx <= ancho; dx++) l.poner(cx + dx, y, y === arriba ? "#ffffff" : dx < -ancho / 2 ? "#ffffff" : (dx + y) % 7 ? "#eef4fa" : "#d8e4f0");
  }
}

// Una maceta con su planta, de pie en base
function maceta(l, x, base) {
  rect(l, x - 4, base - 8, 9, 8, "#d0805a");
  rect(l, x - 4, base - 8, 9, 1, "#e8a07a");
  rect(l, x + 3, base - 7, 1, 7, "#a8603e");
  for (const [dx, dy, rr] of [[0, -16, 5], [-3, -13, 3], [3, -13, 3], [0, -21, 3]]) disco(l, x + dx, base + dy, rr, "#3e9a4a");
  for (const [dx, dy] of [[-2, -19], [1, -22], [-4, -14], [2, -16]]) rect(l, x + dx, base + dy, 2, 1, "#6cc070");
}

// Una poción (un frasco de espray con tapón blanco), de pie en base
function pocion(l, x, base, color) {
  rect(l, x - 1, base - 11, 3, 2, "#f0f0f4");
  rect(l, x, base - 12, 1, 1, "#c8c8d4");
  rect(l, x - 2, base - 9, 5, 9, color);
  rect(l, x - 2, base - 6, 5, 2, "#ffffff");
  rect(l, x - 2, base - 9, 1, 9, "#ffffff", 0.45);
  rect(l, x + 2, base - 9, 1, 9, "#000000", 0.2);
}

// La franja del Centro Pokémon (para la de arriba; dada la vuelta, la de abajo): rojo y un filo blanco
function franjaDelCentro(l) {
  for (let x = 0; x < l.ancho; x++) {
    rect(l, x, 0, 1, 3, "#ee5a72");
    l.poner(x, 3, "#c83c56");
    l.poner(x, 4, "#ffffff");
    if (x % 8 === 0) l.poner(x, 1, "#ff9aac");
  }
}

// Las franjas de peligro (para la de arriba; dada la vuelta, la de abajo): amarillo y negro en diagonal
function franjaDePeligro(l) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < l.ancho; x++) {
      l.poner(x, y, y < 6 ? ((x + y) % 8 < 4 ? "#f0c020" : "#1a1a1e") : y === 6 ? "#5a5e6a" : "#2a2a30");
    }
  }
}

// Una alarma roja (cx: el centro): la caja, la luz y, si está encendida, el resplandor y el haz
function alarma(l, cx, encendida) {
  if (encendida) {
    brillo(l, cx, 6, 16, "#ff3030", 0.55, 0.4);
    for (let y = 8; y < 34; y++) {
      const media = Math.round((y - 8) * 0.55);
      for (let dx = -media; dx <= media; dx++) if (umbral(cx + dx, y) < 0.22 * (1 - (y - 8) / 26)) l.poner(cx + dx, y, "#ff5050", 0.35);
    }
  }
  rect(l, cx - 3, 2, 7, 2, "#2a2a30");
  rect(l, cx - 2, 4, 5, 4, encendida ? "#ff3a3a" : "#6a1818");
  l.poner(cx - 1, 5, encendida ? "#ffd0d0" : "#8a2a2a");
}

// Una caja de madera con la R (16×13, esquina de arriba a la izquierda en x, y)
function cajaRocket(l, x, y) {
  rect(l, x, y, 16, 13, "#8a5a30");
  rect(l, x, y, 16, 1, "#b07a44");
  rect(l, x, y + 6, 16, 1, "#6a4424");
  rect(l, x + 15, y, 1, 13, "#6a4424");
  mapa(l, x + 6, y + 2, ["##.", "#.#", "##.", "#.#"], { "#": "#a01820" }, 1);
}

// Un barril de metal de pie en base
function barril(l, cx, base) {
  for (let y = 0; y < 14; y++) {
    for (let dx = -5; dx <= 5; dx++) l.poner(cx + dx, base - y, y % 5 === 1 ? "#3a3e48" : dx < -2 ? "#8a8e9a" : dx > 2 ? "#4a4e58" : "#6a6e7a");
  }
  rect(l, cx - 4, base - 14, 9, 1, "#9a9eaa");
  mapa(l, cx - 2, base - 10, [".a.", "aaa", "a.a"], { a: "#f0c020" }, 1);
}

// Una noria (cx, cy: el eje; giro: cuánto ha girado): las patas, el aro, los radios y las cabinas,
// que cuelgan siempre derechas
const COLORES_CABINA = ["#ff5a6a", "#ffd23a", "#4aa8ff", "#7ad05a"];
function noria(l, cx, cy, r, giro) {
  for (let k = 0; k <= 36; k++) {
    for (const lado of [-1, 1]) l.poner(cx + Math.round((lado * k * 14) / 36), cy + k, k % 6 ? "#5a6ab8" : "#8a9ad8");
  }
  rect(l, cx - 16, cy + 36, 33, 2, "#5a6ab8");
  for (let i = 0; i < 8; i++) {
    const a = giro + (i * Math.PI) / 4;
    for (let k = 2; k < r; k++) l.poner(cx + Math.round(Math.cos(a) * k), cy + Math.round(Math.sin(a) * k), "#c8c8e0");
  }
  for (let k = 0; k < 220; k++) {
    const a = (k / 220) * 2 * Math.PI;
    l.poner(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), "#ff7aa0");
    l.poner(cx + Math.round(Math.cos(a) * (r - 1)), cy + Math.round(Math.sin(a) * (r - 1)), "#ffb0c8");
  }
  disco(l, cx, cy, 2, "#ff7aa0");
  l.poner(cx, cy, "#ffffff");
  for (let i = 0; i < 8; i++) {
    const a = giro + (i * Math.PI) / 4;
    const [x, y] = [cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r)];
    l.poner(x, y + 1, "#5a6ab8");
    rect(l, x - 2, y + 2, 5, 4, COLORES_CABINA[i % 4]);
    rect(l, x - 1, y + 3, 3, 1, "#ffffff");
  }
}

// Los banderines de una tira (dibujo 0 o 1: mecidos a un lado o al otro), colgando de un cordel
function tiraDeBanderines(l, dibujo) {
  const colores = ["#ff5a6a", "#ffd23a", "#4aa8ff", "#7ad05a", "#c07aff", "#ff9a3a"];
  const cordel = (x) => 1 + Math.round(Math.sin((Math.PI * (x % 64)) / 64) * 5);
  for (let x = 0; x < l.ancho; x++) l.poner(x, cordel(x), "#8a6a5a");
  for (let i = 0; i < l.ancho / 8; i++) {
    const x0 = i * 8 + 1;
    const y0 = cordel(x0 + 3) + 1;
    const ladeo = (i + dibujo) % 2 ? 1 : -1;
    for (let k = 0; k < 7; k++) {
      const media = Math.round(3 * (1 - k / 7));
      for (let dx = -media; dx <= media; dx++) l.poner(x0 + 3 + dx + Math.round((ladeo * k) / 4), y0 + k, colores[i % colores.length]);
    }
  }
}

// La montaña rusa de la Feria: la altura de la vía en cada columna (la fila de arriba del raíl), con
// sus subidas y bajadas suavizadas entre unos puntos (la subida grande, la caída, dos lomas)
const MONTANA_ANCHO = 110;
const MONTANA_ALTO = 54;
const PUNTOS_VIA = [[0, 46], [10, 46], [30, 6], [50, 44], [66, 22], [80, 42], [94, 32], [104, 46], [109, 46]];
function alturaVia(x) {
  const i = Math.max(0, PUNTOS_VIA.findIndex(([px], k) => x >= px && x <= (PUNTOS_VIA[k + 1] || [Infinity])[0]));
  const [[x0, y0], [x1, y1]] = [PUNTOS_VIA[i], PUNTOS_VIA[Math.min(i + 1, PUNTOS_VIA.length - 1)]];
  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return Math.round(y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(Math.PI * t)));
}

// La vía (raíl rojo con traviesas) sobre sus postes, con tirantes en cruz, y la caseta de salida
function montanaRusa(l) {
  for (let x = 2; x < l.ancho - 2; x += 6) {
    const y = alturaVia(x);
    rect(l, x, y + 2, 1, l.alto - y - 2, "#6a7ac0");
    const siguiente = alturaVia(x + 6);
    if (x + 6 < l.ancho - 2) {
      for (let k = 0; k <= 6; k++) {
        const ya = Math.round(y + 3 + ((l.alto - y - 3) * k) / 6);
        if (ya > Math.max(y, siguiente) + 2) l.poner(x + k, ya, "#9aa8e0");
      }
    }
  }
  for (let x = 0; x < l.ancho; x++) {
    const y = alturaVia(x);
    l.poner(x, y, "#e8383a");
    l.poner(x, y + 1, x % 3 ? "#b82830" : "#fff4f0");
  }
  // La caseta de salida, a la izquierda
  // (azul, con el tejadillo a rayas turquesa y blancas: en rojo y amarillo parecía una bandera)
  rect(l, 0, 40, 12, 6, "#5aa8e8");
  rect(l, 11, 40, 1, 6, "#3a7ac0");
  for (let x = 0; x < 12; x++) rect(l, x, 38, 1, 2, Math.floor(x / 2) % 2 ? "#ffffff" : "#3ac0b0");
  rect(l, 2, 42, 3, 4, "#2a4a7a");
  rect(l, 7, 41, 3, 2, "#d8f0ff");
  for (let x = 0; x < 12; x += 2) l.poner(x, 37, "#ffffff");
}

// Una carpa de feria a rayas, de pie en base (cx: el centro), con su banderita
function carpa(l, cx, base) {
  const [ancho, alto] = [32, 16];
  for (let y = 0; y < alto; y++) {
    const media = Math.round(ancho / 2 - 1);
    for (let dx = -media; dx <= media; dx++) l.poner(cx + dx, base - y, Math.floor((dx + 40) / 4) % 2 ? "#ff5a6a" : "#ffffff");
  }
  rect(l, cx - 3, base - 9, 7, 10, "#5a2a3a");
  for (let k = 0; k < 14; k++) {
    const media = Math.round(((ancho / 2 + 2) * k) / 14);
    for (let dx = -media; dx <= media; dx++) l.poner(cx + dx, base - alto - 14 + k, Math.floor((dx + 40) / 4) % 2 ? "#e8383a" : "#ffeaea");
  }
  for (let dx = -ancho / 2 - 1; dx <= ancho / 2 + 1; dx += 2) l.poner(cx + dx, base - alto, "#ffd23a");
  rect(l, cx, base - alto - 20, 1, 6, "#6a4a3a");
  rect(l, cx + 1, base - alto - 20, 4, 2, "#4aa8ff");
}

// Los globitos que suben (un globo con su cordel) y el ramo de la esquina
const COLORES_GLOBITO = [["#ff5a6a", "#c83a4a"], ["#4aa8ff", "#2a78d0"], ["#ffd23a", "#d8a020"], ["#7ad05a", "#4a9a3a"], ["#c07aff", "#8a4ad0"]];
function globito(l, x, y, [color, sombra]) {
  disco(l, x, y, 3, sombra);
  disco(l, x - 1, y - 1, 2, color);
  l.poner(x - 1, y - 2, "#ffffff");
  l.poner(x, y + 4, sombra);
  for (let k = 5; k < 11; k++) l.poner(x + (k % 3 === 0 ? 1 : 0), y + k, "#8a7a6a");
}
function ramoDeGlobos(l, cx, base) {
  const puntos = [[-6, -30], [0, -34], [6, -29], [-3, -24], [4, -22]];
  for (const [dx, dy] of puntos) {
    for (let k = 0; k <= 10; k++) l.poner(cx + Math.round((dx * (10 - k)) / 10), base + dy + 4 + Math.round(((-dy - 4) * k) / 10), "#8a7a6a");
  }
  puntos.forEach(([dx, dy], i) => globito(l, cx + dx, base + dy, COLORES_GLOBITO[i % COLORES_GLOBITO.length]));
  rect(l, cx - 1, base - 1, 3, 2, "#e8383a");
}

// Un planeta pequeño, con luz arriba a la izquierda; colores: [luz, medio, sombra]
function planetaChico(l, cx, cy, r, [luz, medio, sombra]) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + r * 0.5) continue;
      const k = (-x - y) / (r * 1.5);
      l.poner(cx + x, cy + y, k > 0.3 ? luz : k > -0.3 || umbral(cx + x, cy + y) < k + 0.6 ? medio : sombra);
    }
  }
}

// ---------- Piezas de los diseños de tarjeta (los sencillos de la Tienda) ----------
//
// No son paisajes: un fondo con estampado y la decoración en las esquinas y los bordes, alrededor
// de la foto y el nombre. Cada esquina se dibuja como la de arriba a la derecha (la que siempre se
// ve en «Amigos»); las de la izquierda son la misma dada la vuelta.

// El lienzo dado la vuelta (de lado, de arriba abajo o las dos)
const espejado = (l, espejoX, espejoY) => ({ ...l, poner: (x, y, c, a) => l.poner(espejoX ? l.ancho - 1 - x : x, espejoY ? l.alto - 1 - y : y, c, a) });

// La franja de abajo del bosque: musgo, hierbas, helechos pequeños y setas, cada una a su aire
function bordeDeBosque(l, azar) {
  for (let x = 0; x < l.ancho; x++) for (let y = l.alto - 3 + Math.round(Math.sin(x / 5)); y < l.alto; y++) l.poner(x, y, (x + y) % 3 ? "#5a9a3a" : "#78b44a");
  for (let x = 4; x < l.ancho; x += 6 + Math.floor(azar() * 6)) {
    const que = azar();
    if (que < 0.25) helecho(l, x, l.alto - 1, 8 + Math.floor(azar() * 6), azar() < 0.5 ? -1 : 1, ["#2e6e34", "#4a9a42", "#8cd070"]);
    else if (que < 0.42) seta(l, x, l.alto - 1, 2 + Math.floor(azar() * 2));
    else brizna(l, x, l.alto, 4 + Math.floor(azar() * 6), [(azar() - 0.5) * 0.8, -1], 0.2, ["#2e6e34", "#4a9a42", "#8cd070"], 2);
  }
}

// Capas para las esquinas que se digan, de ancho × alto. pintar(l, azar, abajo): l ya está dado la
// vuelta de lado si va a la izquierda (la esquina siempre queda a la derecha); abajo dice si va
// abajo (allí lo que está de pie va con la base en l.alto, y lo que cuelga se da la vuelta con espejado)
function esquinas(ancho, alto, pintar, cuales = ["arriba-derecha", "arriba-izquierda", "abajo-derecha", "abajo-izquierda"]) {
  return cuales.map((nombre) => {
    const izquierda = nombre.endsWith("izquierda");
    const abajo = nombre.startsWith("abajo");
    return {
      nombre: `esquina-${nombre}`, ancho, alto, repetir: "no", recortar: true,
      sitio: { x: 0, lado: izquierda ? "izquierda" : "derecha", y: 0, desde: abajo ? "abajo" : "arriba" },
      pintar(l, azar) { pintar(espejado(l, izquierda, false), azar, abajo); }
    };
  });
}

// Una brizna larga y curva (hierba, junco): desde (x, y) hacia (dx, dy), torciéndose (curva: hacia
// qué lado y cuánto), gruesa al principio y en punta; el filo de un lado, claro
function brizna(l, x, y, largo, [dx, dy], curva, [oscuro, medio, claro], grueso = 3) {
  const n = Math.hypot(dx, dy);
  const [ux, uy] = [dx / n, dy / n];
  const [px, py] = [-uy, ux];
  for (let k = 0; k <= largo * 1.5; k++) {
    const t = k / (largo * 1.5);
    const cx = x + ux * t * largo + px * curva * t * t * largo;
    const cy = y + uy * t * largo + py * curva * t * t * largo;
    const g = Math.max(1, Math.round(grueso * (1 - t * 0.85)));
    for (let j = 0; j < g; j++) l.poner(Math.round(cx + px * j), Math.round(cy + py * j), j === 0 ? claro : j === g - 1 ? oscuro : medio);
  }
}

// Una hoja ovalada en cualquier dirección (ángulo en radianes), con el nervio claro
function hojaOval(l, x, y, largo, angulo, [oscuro, medio, claro]) {
  const [ux, uy] = [Math.cos(angulo), Math.sin(angulo)];
  const R = Math.ceil(largo) + 1;
  for (let yy = -R; yy <= R; yy++) {
    for (let xx = -R; xx <= R; xx++) {
      const a = xx * ux + yy * uy;
      const b = -xx * uy + yy * ux;
      if (a < 0 || a > largo) continue;
      if (Math.abs(b) > Math.sin((Math.PI * a) / largo) * largo * 0.34 + 0.3) continue;
      l.poner(x + xx, y + yy, Math.abs(b) < 0.5 && a > 1 && a < largo - 1 ? claro : b < 0 ? medio : oscuro);
    }
  }
}

// Una rama con hojas que entra por la esquina de arriba a la derecha y, en algunas ramitas, frutos
// (fruto(l, x, y, azar)); hojas: dos juegos de colores que se alternan
function esquinaFrondosa(l, azar, { hojas, fruto, rama = ["#7a5a3a", "#5a3e26"] }) {
  const [W0, H0] = [l.ancho, l.alto];
  const sitios = [];
  const frutos = [];
  const trazo = (x0, y0, x1, y1, grueso) => {
    const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const angulo = Math.atan2(y1 - y0, x1 - x0);
    for (let k = 0; k <= pasos; k++) {
      const t = k / pasos;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI * 2) * 2);
      const g = Math.max(1, Math.round(grueso * (1 - t * 0.6)));
      for (let j = 0; j < g; j++) l.poner(x, y + j, j === 0 ? rama[0] : rama[1]);
      if (k > 3 && k % 5 === 0) sitios.push([x, y, angulo + (k % 10 ? -1 : 1) * (0.9 + azar() * 0.5), 6 + Math.floor(azar() * 4)]);
      if (fruto && k > 8 && k % 14 === 7) frutos.push([x + Math.round((azar() - 0.5) * 4), y + 4 + Math.floor(azar() * 3)]);
    }
    sitios.push([Math.round(x1), Math.round(y1), angulo, 8]);
  };
  trazo(W0 + 2, -2, Math.round(W0 * 0.15), Math.round(H0 * 0.42), 3);
  trazo(W0 - 4, Math.round(H0 * 0.12), Math.round(W0 * 0.55), Math.round(H0 * 0.85), 2);
  sitios.forEach(([x, y, angulo, largo], i) => hojaOval(l, x, y, largo, angulo, hojas[i % hojas.length]));
  for (const [x, y] of frutos) fruto(l, x, y, azar);
}

// Una seta de sombrero rojo con lunares blancos, de pie en base
function seta(l, x, base, tam) {
  const pie = tam + 1;
  rect(l, x - 1, base - pie, 3, pie, "#f4ecd8");
  rect(l, x + 1, base - pie, 1, pie, "#d8ccb4");
  const top = base - pie;
  for (let y = -tam; y <= 0; y++) {
    for (let dx = -tam - 1; dx <= tam + 1; dx++) {
      if (dx * dx + (y * 1.4) ** 2 > (tam + 1) ** 2) continue;
      l.poner(x + dx, top + y, y === 0 ? "#f0d8c0" : dx + y < -tam * 0.7 ? "#ff7a6a" : dx > tam * 0.4 ? "#b82e2a" : "#e8443a");
    }
  }
  for (const [dx, dy] of [[-Math.round(tam * 0.5), -Math.round(tam * 0.5)], [Math.round(tam * 0.4), -Math.round(tam * 0.3)], [0, -tam + 1]]) {
    l.poner(x + dx, top + dy, "#ffffff");
    if (tam > 4) l.poner(x + dx + 1, top + dy, "#ffffff");
  }
}

// Un helecho: el tallo que sube curvándose y hojitas a los dos lados, más cortas hacia la punta
function helecho(l, x, base, largo, lado, [oscuro, medio, claro]) {
  for (let k = 0; k < largo; k++) {
    const t = k / largo;
    const cx = Math.round(x + lado * t * t * largo * 0.45);
    const cy = base - k;
    l.poner(cx, cy, oscuro);
    if (k % 3 === 1 && t < 0.92) {
      const corta = Math.max(1, Math.round((1 - t) * 6));
      for (let j = 1; j <= corta; j++) {
        l.poner(cx - j, cy - Math.floor(j / 2), j === corta ? claro : medio);
        l.poner(cx + j, cy - Math.floor(j / 2), j === corta ? claro : oscuro);
      }
    }
  }
}

// Un cristal: un prisma que sube inclinado y acaba en punta, con la cara izquierda clara
function cristal(l, x, base, alto, ancho, inclina, [oscuro, medio, claro]) {
  for (let k = 0; k < alto; k++) {
    const w = Math.max(0, Math.round(Math.min(ancho, ((alto - k) * ancho) / Math.max(1, ancho * 1.6))));
    const cx = Math.round(x + inclina * k);
    for (let j = -w; j <= w; j++) l.poner(cx + j, base - k, j < -w / 3 ? claro : j <= w / 3 ? medio : oscuro);
  }
  l.poner(Math.round(x + inclina * (alto - 2)), base - alto + 2, "#ffffff");
}

// Un racimo de cristales con su resplandor (escala: 1, el normal)
function racimoCristales(l, x, base, escala, colores) {
  brillo(l, x, base - Math.round(10 * escala), Math.round(20 * escala), colores[2], 0.5, 0.4);
  for (const [dx, alto, ancho, inclina] of [[-8, 11, 2, -0.4], [7, 13, 2, 0.4], [-3, 19, 3, -0.15], [3, 16, 2, 0.18], [0, 25, 3, 0]]) {
    cristal(l, x + Math.round(dx * escala), base, Math.round(alto * escala), Math.max(1, Math.round(ancho * escala)), inclina, colores);
  }
}

// Una estalactita que cuelga desde arriba (y0), con la cara izquierda clara
function estalactita(l, x, y0, largo, ancho, [oscuro, medio, claro]) {
  for (let k = 0; k < largo; k++) {
    const w = Math.round(ancho * (1 - k / largo) ** 0.8);
    for (let j = -w; j <= w; j++) l.poner(x + j, y0 + k, j < -w / 2 ? claro : j <= w / 3 ? medio : oscuro);
  }
}

// Un cactus de brazos (saguaro), de pie en base, con costillas y espinas
function cactus(l, x, base, alto, [oscuro, medio, claro]) {
  const columna = (cx, y0, y1, ancho) => {
    for (let y = y0; y <= y1; y++) {
      for (let j = 0; j < ancho; j++) l.poner(cx + j, y, j === 0 ? claro : j === ancho - 1 ? oscuro : j === Math.floor(ancho / 2) && y % 2 ? oscuro : medio);
    }
    for (let j = 1; j < ancho - 1; j++) l.poner(cx + j, y0 - 1, medio);
  };
  columna(x - 3, base - alto + 1, base, 7);
  const brazo = (lado, alturaBrazo, sube) => {
    const y = base - alturaBrazo;
    const x0 = lado < 0 ? x - 8 : x + 4;
    for (let j = 0; j < 5; j++) for (let k = 0; k < 4; k++) l.poner(x0 + j, y + k, k === 0 ? claro : k === 3 ? oscuro : medio);
    columna(lado < 0 ? x - 9 : x + 7, y - sube, y + 3, 5);
  };
  brazo(-1, Math.round(alto * 0.45), Math.round(alto * 0.3));
  brazo(1, Math.round(alto * 0.62), Math.round(alto * 0.22));
  for (let k = 3; k < alto; k += 4) for (const dx of [-4, 4]) l.poner(x + dx, base - k, "#fff4c8");
}

// Una baya redonda con brillo y su coronita de hojas; colores: [el suyo, sombra, luz]
const COLORES_BAYA = [
  ["#3a78e0", "#2a54a8", "#a8d0ff"], ["#e8383a", "#a82428", "#ff9a90"], ["#ff9ac0", "#e06a98", "#ffe0ec"],
  ["#ffd23a", "#d8a020", "#fff4b0"], ["#ff8a3a", "#c8542a", "#ffc8a0"]
];
function baya(l, x, y, r, [color, sombra, luz]) {
  disco(l, x, y, r, sombra);
  disco(l, x - 1, y - 1, Math.max(1, r - 1), color);
  const b = Math.ceil(r / 2);
  l.poner(x - b, y - b, luz);
  if (r > 2) l.poner(x - b + 1, y - b, luz);
  l.poner(x, y - r - 1, "#3e8a32");
  l.poner(x - 1, y - r, "#5cb844");
  l.poner(x + 1, y - r, "#5cb844");
}

// Una cesta de mimbre llena de bayas, de pie en base (cx: el centro): primero el asa (entera, de
// tres píxeles de grueso), luego las bayas amontonadas y delante la cesta
function cestaDeBayas(l, cx, base, azar) {
  const [ancho, alto, r] = [40, 15, 18];
  const arriba = base - alto;
  for (let k = 0; k <= 60; k++) {
    const a = Math.PI * (k / 60);
    const [x, y] = [Math.round(cx - Math.cos(a) * r), Math.round(arriba - Math.sin(a) * r)];
    l.poner(x, y - 1, "#f0c888");
    l.poner(x, y, "#c8904a");
    l.poner(x, y + 1, "#8a5424");
  }
  for (let k = 0; k < 28; k++) {
    const dx = -16 + Math.floor(azar() * 33);
    baya(l, cx + dx, arriba - 1 - Math.floor(azar() * (6 - Math.abs(dx) / 5)), 3, COLORES_BAYA[k % COLORES_BAYA.length]);
  }
  for (let y = 0; y < alto; y++) {
    const media = Math.round(ancho / 2 - y * 0.3);
    for (let dx = -media; dx <= media; dx++) {
      const trenza = (Math.floor((dx + 40) / 3) + Math.floor(y / 2)) % 2;
      l.poner(cx + dx, arriba + y, y < 2 ? "#e0b070" : y === 2 ? "#8a5424" : dx > media - 3 ? "#8a5424" : trenza ? "#c8904a" : "#a06a30");
    }
  }
}

// Una Poké Ball pequeña (4×4) para la máquina del Centro Pokémon; si brilla, más clara
function pokeBallChica(l, x, y, brilla) {
  mapa(l, x, y, [".rr.", "rkkr", "wkkw", ".ww."], brilla
    ? { r: "#ff9aa8", k: "#8a7a9a", w: "#ffffff" }
    : { r: "#e83848", k: "#3a3040", w: "#f2eef4" }, 1);
}

// La máquina del Centro Pokémon en cada momento (x0: dónde empieza ese dibujo en la capa): 0 vacía,
// de 1 a 6 con esas Poké Balls puestas (la pantalla, con su barra de carga) y 7 brillando
function maquinaCuracion(l, x0, cuadro) {
  const x = x0 + 64;
  rect(l, x + 18, 0, 14, 9, "#7a8098");
  rect(l, x + 19, 1, 12, 7, cuadro === 7 ? "#d8f8ff" : cuadro ? "#6ad0f0" : "#4a8ab0");
  if (cuadro && cuadro < 7) rect(l, x + 20, 5, Math.max(1, Math.round((10 * cuadro) / 6)), 2, "#e8fbff");
  if (!cuadro) for (const y of [3, 5]) rect(l, x + 20, y, y === 3 ? 7 : 5, 1, "#9ad4ee");
  if (cuadro === 7) brillo(l, x + 16, 11, 16, "#fff6b0", 0.55, 0.5);
  rect(l, x, 8, 32, 7, "#7a8098");
  rect(l, x + 1, 9, 30, 5, "#dfe3ee");
  rect(l, x + 1, 9, 30, 1, "#ffffff");
  for (let i = 0; i < 6; i++) {
    const bx = x + 2 + i * 5;
    rect(l, bx, 10, 4, 4, "#a8afc4");
    if (i < Math.min(cuadro, 6)) pokeBallChica(l, bx, 10, cuadro === 7);
  }
  if (cuadro === 7) for (const [dx, dy] of [[1, 7], [16, 6], [31, 7]]) destello(l, x + dx, dy, ["#fff6b0", "#ffffff"]);
}

// ---------- Dibujos que se turnan ----------
//
// Para que algo cambie de dibujo sin moverse (un Pokémon que parpadea o mueve la cola, el agua de
// una cascada, una llama), cada dibujo va en su capa, en el mismo sitio, y en cada momento solo uno
// está a la vista: los demás se apartan FUERA píxeles (hacia arriba los que van desde abajo, hacia
// abajo los otros), lejos de cualquier tarjeta. De entrada (y sin animación, con «reducir
// movimiento») solo se ve el primero de cada grupo: los demás llevan «apartada».

const FUERA = 2000;
const lejos = (capa) => (capa.sitio.desde === "abajo" ? -FUERA : FUERA);
function apartadaDe(capa) {
  return capa.apartada ? lejos(capa) : 0;
}

// La animación: grupos de capas que se turnan, { capas: [capa, ...] (la primera, la de entrada),
// pasos: [[desde, cual], ...] (en la vuelta, de 0 a 1; cual, el índice en capas) }. Marca las que
// empiezan apartadas y devuelve la animación (en el eje y). Con steps(1) cada fotograma se queda
// quieto hasta el siguiente: basta uno por cambio (no hace falta el de «justo antes»).
function turnos(duracion, grupos) {
  const mueve = {};
  const paradas = new Set([0, 1]);
  for (const { capas, pasos } of grupos) {
    const cualEn = (t) => pasos.reduce((cual, [desde, c]) => (t + 1e-6 >= desde ? c : cual), pasos[0][1]);
    for (const [desde] of pasos.slice(1)) paradas.add(desde);
    capas.forEach((capa, i) => {
      if (i > 0) capa.apartada = true;
      // A la vista: sin apartar (las apartadas, vuelven); si no, apartada
      mueve[capa.nombre] = (t) => [0, cualEn(t) === i ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
    });
  }
  return { nombre: "turnos", eje: "y", duracion, pasos: 1, paradas: [...paradas], mueve };
}

// Cada vez que toca otro dibujo, en una vuelta: n cambios iguales que van pasando por los k dibujos
const ciclo = (n, k, desfase = 0) => Array.from({ length: n }, (_, i) => [i / n, (i + desfase) % k]);

// ---------- La Tienda ----------
//
// Cada fondo: su cielo (un degradado opaco), sus capas (la primera, la de más arriba) y, si se
// mueve, cómo. Con cieloDeDia, el cielo es azul de día y se le añaden detrás unas nubes blancas.
// En cada capa:
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

// La máquina del Centro Pokémon: vacía, va recibiendo las seis Poké Balls, brillan unas veces y se
// vacía (dibujos de maquinaCuracion, que se turnan en el mismo sitio)
const CURACION = [[0, 0], [0.12, 1], [0.18, 2], [0.24, 3], [0.3, 4], [0.36, 5], [0.42, 6], [0.52, 7], [0.58, 6], [0.64, 7], [0.7, 6], [0.76, 7], [0.82, 6], [0.92, 0]];

// Momentos repartidos por la vuelta (para lo que se mueve en curva: flotar, mecerse)
const repartidos = (n) => Array.from({ length: n + 1 }, (_, i) => i / n);

const TIENDA = {
  // ----- Los sencillos: diseños para la tarjeta, no paisajes (estampado, esquinas y bordes) -----

  // El id sigue siendo «hierba» (es el que guardan las compras), pero ahora es «Otoño»
  hierba: {
    comentario: "Otoño: un diseño para la tarjeta: crema con hojas de colores esparcidas por todo el fondo, una guirnalda de hojas colgando arriba, montones de hojas por abajo, una calabaza y bellotas en las esquinas de abajo",
    cielo: "linear-gradient(160deg, #fff4e0, #ffe2c0 55%, #f8cc9c)",
    capas: [
      ...esquinas(72, 46, (l, azar) => {
        montonDeHojas(l, azar, l.ancho - 30, l.alto, 30, 14);
        calabaza(l, l.ancho - 22, l.alto - 2, 14);
        for (const [x, y] of [[l.ancho - 52, l.alto - 6], [l.ancho - 46, l.alto - 4]]) bellota(l, x, y);
      }, ["abajo-derecha"]),
      ...esquinas(72, 46, (l, azar) => {
        montonDeHojas(l, azar, l.ancho - 26, l.alto, 26, 12);
        for (const [x, y] of [[l.ancho - 14, l.alto - 12], [l.ancho - 30, l.alto - 8], [l.ancho - 22, l.alto - 6]]) bellota(l, x, y);
      }, ["abajo-izquierda"]), {
        nombre: "guirnalda", ancho: 512, alto: 24, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l, azar) {
          // Un cordel que cuelga entre clavos a distancias distintas (más o menos combado); de él,
          // hojas a distancias distintas y, de vez en cuando, una bellota o una hoja que cuelga más
          const clavos = [0];
          while (clavos[clavos.length - 1] < l.ancho - 60) clavos.push(clavos[clavos.length - 1] + 40 + Math.floor(azar() * 50));
          clavos.push(l.ancho);
          const comba = clavos.map(() => 3 + Math.floor(azar() * 6));
          const cordel = (x) => {
            const i = clavos.findIndex((c, k) => x >= c && x < clavos[k + 1]);
            const [x0, x1] = [clavos[i], clavos[i + 1]];
            return 1 + Math.round(Math.sin((Math.PI * (x - x0)) / (x1 - x0)) * comba[i]);
          };
          for (let x = 0; x < l.ancho; x++) l.poner(x, cordel(x), "#8a5a3a");
          for (const x of clavos.slice(0, -1)) rect(l, x - 1, 0, 3, 2, "#c8a070");
          for (let x = 3; x < l.ancho - 4; x += 5 + Math.floor(azar() * 7)) {
            const y = cordel(x);
            const que = azar();
            if (que < 0.08) {
              for (let k = 1; k < 4; k++) l.poner(x, y + k, "#8a5a3a");
              bellota(l, x, y + 4);
            } else if (que < 0.2) {
              const largo = 3 + Math.floor(azar() * 5);
              for (let k = 1; k <= largo; k++) l.poner(x + 3, y + k, "#8a5a3a");
              hojaArce(l, x, y + largo + 1, COLORES_OTONO[Math.floor(azar() * COLORES_OTONO.length)], azar() < 0.5);
            } else hojaArce(l, x - 3, y + 1, COLORES_OTONO[Math.floor(azar() * COLORES_OTONO.length)], azar() < 0.5);
          }
        }
      }, {
        nombre: "hojas-abajo", ancho: 256, alto: 14, repetir: "x", sitio: { y: 0, desde: "abajo" },
        pintar(l, azar) {
          for (let x = 0; x < l.ancho; x += 32) montonDeHojas(l, azar, x + Math.floor(azar() * 10), l.alto, 12 + Math.floor(azar() * 8), 5 + Math.floor(azar() * 4));
        }
      }, {
        nombre: "estampado", ancho: 64, alto: 64, repetir: "xy", sitio: { y: 0, desde: "arriba" },
        pintar(l, azar) {
          // Hojas sueltas por todo el fondo (también por el medio), de colores y medio transparentes
          for (const [x, y] of [[6, 8], [38, 4], [22, 30], [54, 26], [10, 50], [42, 48]]) {
            const [color, sombra] = COLORES_OTONO[Math.floor(azar() * COLORES_OTONO.length)];
            mapa(l, x, y, azar() < 0.5 ? ["..a..", "aaaaa", ".aaa.", "..b.."] : [".a.a.", "aaaa.", ".aab.", "...b."], { a: color, b: sombra }, 0.45);
          }
        }
      }
    ]
  },

  bosque: {
    comentario: "Bosque: verde salvia con un estampado de hojitas; ramas con hojas (y bellotas) que entran por las esquinas de arriba, helechos y setas en las de abajo, una hiedra arriba de la que caen lianas y, abajo, musgo con setas, helechos y hierbas de punta a punta",
    cielo: "linear-gradient(160deg, #e2f2da, #c8e6c0 55%, #acd6a6)",
    capas: [
      ...esquinas(76, 50, (l, azar, abajo) => {
        const hojas = [["#2e6e34", "#3e8a42", "#7cc070"], ["#3e8a3a", "#58a84a", "#a0dc80"], ["#5a8a2a", "#78aa3a", "#c0e07a"]];
        if (abajo) {
          const [W0, H0] = [l.ancho, l.alto];
          for (const [x, largo, lado] of [[W0 - 6, 34, -1], [W0 - 16, 26, -1], [W0 - 30, 20, 1], [W0 - 2, 22, -1]]) helecho(l, x, H0, largo, lado, ["#2e6e34", "#4a9a42", "#8cd070"]);
          for (let x = W0 - 50; x < W0; x++) for (let y = H0 - 3 + Math.round(Math.sin(x / 4)); y < H0; y++) l.poner(x, y, (x + y) % 3 ? "#5a9a3a" : "#78b44a");
          seta(l, W0 - 24, H0 - 1, 6);
          seta(l, W0 - 13, H0 - 1, 4);
          seta(l, W0 - 38, H0 - 1, 3);
        } else {
          esquinaFrondosa(l, azar, {
            hojas,
            fruto(l, x, y) {
              mapa(l, x - 2, y, [".ccc.", "ccccc", ".bbb.", ".bbb.", "..b.."], { c: "#8a5a2a", b: "#c8884a" }, 1);
            }
          });
        }
      }), {
        nombre: "franja", ancho: 256, alto: 16, repetir: "x", sitio: { y: 0, desde: "abajo" },
        pintar(l, azar) { bordeDeBosque(l, azar); }
      }, {
        nombre: "lianas", ancho: 256, alto: 40, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          const hojas = [["#2e6e34", "#3e8a42", "#7cc070"], ["#3e8a3a", "#58a84a", "#a0dc80"]];
          for (const [x, largo] of [[30, 18], [92, 30], [140, 14], [196, 26], [236, 20]]) liana(l, x, 2 + Math.round(Math.sin((x * 2 * Math.PI * 8) / 256) * 1.5), largo, hojas);
        }
      }, {
        nombre: "hiedra", ancho: 128, alto: 12, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          for (let x = 0; x < l.ancho; x++) {
            const y = 2 + Math.round(Math.sin((x * 2 * Math.PI * 4) / l.ancho) * 1.5);
            l.poner(x, y, "#5a7a3a");
            if (x % 7 === 0) hojaOval(l, x, y + 1, 5, Math.PI / 2 + (x % 14 ? 0.5 : -0.5), [["#2e6e34", "#3e8a42", "#7cc070"], ["#3e8a3a", "#58a84a", "#a0dc80"]][x % 2]);
          }
        }
      }, {
        nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          for (const [x, y, color, angulo] of [[8, 10, "#f4fcf0", -0.6], [24, 26, "#90c488", 2.5]]) {
            for (let k = 0; k < 5; k++) {
              const [px, py] = [x + Math.round(Math.cos(angulo) * k), y + Math.round(Math.sin(angulo) * k)];
              l.poner(px, py, color, 0.6);
              if (k > 0 && k < 4) l.poner(px + 1, py, color, 0.6);
            }
          }
        }
      }
    ]
  },

  cueva: {
    comentario: "Cueva: piedra lila con un estampado de bloques de roca; racimos de cristales que brillan en las esquinas de abajo, estalactitas y cristales colgando en las de arriba, estalactitas por el borde de arriba y piedras abajo",
    cielo: "linear-gradient(160deg, #aaa6c8, #908cb2 55%, #7a76a0)",
    capas: [
      ...esquinas(72, 50, (l, azar, abajo) => {
        const piedra = ["#4e4a6e", "#6a6690", "#a8a4c8"];
        const amatista = ["#6a3aa8", "#a070e0", "#e8d4ff"];
        const turquesa = ["#2a7aa8", "#50bce8", "#d4f6ff"];
        if (abajo) {
          const [W0, H0] = [l.ancho, l.alto];
          for (let x = W0 - 60; x < W0; x++) {
            const alto = Math.round(4 + Math.max(0, (x - (W0 - 60)) / 6) + Math.sin(x / 3) * 1.5);
            for (let y = H0 - alto; y < H0; y++) l.poner(x, y, y === H0 - alto ? piedra[2] : (x + y) % 5 ? piedra[1] : piedra[0]);
          }
          racimoCristales(l, W0 - 16, H0 - 6, 1.3, amatista);
          racimoCristales(l, W0 - 40, H0 - 3, 0.8, turquesa);
        } else {
          for (const [x, largo, ancho] of [[l.ancho - 3, 30, 4], [l.ancho - 12, 20, 3], [l.ancho - 22, 26, 3], [l.ancho - 34, 14, 2], [l.ancho - 44, 18, 2], [l.ancho - 56, 10, 2]]) estalactita(l, x, 0, largo, ancho, piedra);
          // Unos cristales colgando, al revés
          racimoCristales(espejado(l, false, true), l.ancho - 30, l.alto - 1, 0.6, turquesa);
        }
      }), {
        nombre: "estalactitas", ancho: 96, alto: 14, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l, azar) {
          rect(l, 0, 0, l.ancho, 2, "#6a6690");
          for (let x = 4; x < l.ancho; x += 9 + Math.floor(azar() * 6)) estalactita(l, x, 1, 5 + Math.floor(azar() * 9), 1 + Math.floor(azar() * 2), ["#4e4a6e", "#6a6690", "#a8a4c8"]);
        }
      }, {
        nombre: "piedras", ancho: 96, alto: 8, repetir: "x", sitio: { y: 0, desde: "abajo" },
        pintar(l, azar) {
          for (let x = 0; x < l.ancho; x++) {
            const alto = 3 + Math.round(Math.sin(x / 5) + Math.sin(x / 2.3) * 0.6);
            for (let y = l.alto - alto; y < l.alto; y++) l.poner(x, y, y === l.alto - alto ? "#a8a4c8" : "#5e5a80");
          }
          for (let i = 0; i < 6; i++) {
            const x = Math.floor(azar() * l.ancho);
            disco(l, x, l.alto - 4, 2, "#6a6690");
            l.poner(x - 1, l.alto - 5, "#b8b4d8");
          }
        }
      }, {
        nombre: "estampado", ancho: 32, alto: 24, repetir: "xy", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          // Bloques de roca al tresbolillo: la junta oscura y el borde de arriba con luz
          for (let y = 0; y < l.alto; y++) {
            for (let x = 0; x < l.ancho; x++) {
              const fila = Math.floor(y / 12);
              const xx = (x + (fila % 2) * 16) % 32;
              if ((y % 12 === 11 && umbral(x, y) < 0.7) || (xx === 31 && y % 12 > 1 && y % 12 < 10)) l.poner(x, y, "#5a5680", 0.3);
              else if (y % 12 === 0 && xx > 2 && xx < 28 && umbral(x, y) < 0.6) l.poner(x, y, "#c4c0e0", 0.25);
            }
          }
        }
      }
    ]
  },

  atardecer: {
    comentario: "Atardecer: un sol grande a medio esconder en el mar, cerca del centro, con su reflejo y pájaros; un solo islote con dos palmeras a su derecha; nubes largas y el mar",
    cielo: "linear-gradient(to top, #ff9d55, #ee6f5c 30%, #9a4f9a 65%, #4a3478)",
    capas: [{
      // El horizonte, 26 píxeles por encima de abajo (como en el mar)
      nombre: "islote", ancho: 90, alto: 70, repetir: "no", sitio: { x: 105, lado: "centro", y: 0, desde: "abajo" },
      pintar(l) {
        const horizonte = l.alto - 26;
        for (let x = 6; x <= 84; x++) {
          const t = (x - 6) / 78;
          const alto = Math.round(Math.sin(t * Math.PI) ** 0.7 * 9 + (t > 0.3 && t < 0.6 ? 2 : 0));
          for (let y = horizonte - alto; y <= horizonte + 1; y++) l.poner(x, y, y === horizonte - alto && x < 40 ? "#4a2a54" : "#2a1a3a");
        }
        palmera(l, 50, horizonte - 9, 24, ["#1e1230", "#2a1a40", "#2a1a3a"], 1, -1);
        palmera(l, 30, horizonte - 7, 15, ["#1e1230", "#2a1a40", "#2a1a3a"], 1, 1);
        // Su reflejo en el agua, a rayas
        for (let y = horizonte + 2; y < horizonte + 8; y++) for (let x = 10; x <= 80; x++) if ((x + y * 2) % 4 < 2) l.poner(x, y, "#3a2050", 0.5);
      }
    }, {
      nombre: "sol", ancho: 120, alto: 82, repetir: "no", sitio: { x: -20, lado: "centro", y: 0, desde: "abajo" },
      pintar(l) {
        const [cx, horizonte, r] = [60, l.alto - 26, 27];
        for (let y = 0; y < horizonte; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const d = Math.sqrt((x - cx) ** 2 + (y - horizonte) ** 2);
            if (d <= r) l.poner(x, y, d < r * 0.55 ? "#fff0b0" : d < r * 0.85 || umbral(x, y) < 0.5 ? "#ffd070" : "#ff9a58");
            else if (d < r + 20 && umbral(x, y) < 0.5 * (1 - (d - r) / 20)) l.poner(x, y, "#ffb070", 0.45);
          }
        }
        // El reflejo: rayas que se estrechan hacia abajo
        for (let y = horizonte + 1; y < l.alto; y++) {
          const media = Math.round(r - (y - horizonte) * 0.75);
          for (let dx = -media; dx <= media; dx++) if ((dx + y * 3 + 40) % 5 < 3) l.poner(cx + dx, y, y < horizonte + 6 ? "#ffd080" : "#ff9a60", 0.75);
        }
        // Pájaros
        for (const [x, y] of [[10, 14], [20, 8], [100, 16], [109, 10]]) {
          for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1]]) l.poner(x + dx, y + dy, "#4a2a4a", 0.8);
        }
      }
    }, {
      nombre: "nubes", ancho: 256, alto: 20, repetir: "x", sitio: { y: 40, desde: "abajo" },
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
      // El horizonte, 20 píxeles por debajo de lo alto de la capa
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
      }
    }]
  },

  magma: {
    comentario: "Magma: roca oscura agrietada con la lava brillando por las grietas, un río de lava con burbujas y brasas en el aire",
    cielo: "linear-gradient(to top, #d9521f, #8a2716 40%, #3d1713 80%, #2a1210)",
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

  olas: (() => {
    // Dos peces que saltan, uno detrás de otro (uno cada 3,5 s más o menos), cada uno en su sitio:
    // escondidos (apartados) casi toda la vuelta; en su tramo salen del agua, suben y vuelven a caer
    const VUELTA_SALTOS = 7;
    const peces = [[40, [0.1, 0.28]], [110, [0.6, 0.78]]].map(([x, salto], k) => ({
      salto,
      capa: {
        nombre: `pez-${k}`, archivo: "pez", ancho: 12, alto: 12, repetir: "no", sitio: { x, lado: "centro", y: 6, desde: "abajo" }, apartada: true,
        pintar: k ? undefined : (l) => {
          // Un pez naranja saltando hacia arriba a la derecha, con gotas
          mapa(l, 1, 1, [
            "......aa..",
            ".....abba.",
            "....abbkb.",
            "...abbbbb.",
            "..abbbbb..",
            ".cabbbb...",
            "cc.aab....",
            "c....a...."
          ], { a: "#c84a1a", b: "#ff8a3a", k: "#1a1a24", c: "#ffc040" }, 1);
          for (const [x, y] of [[0, 9], [3, 11], [9, 10]]) l.poner(x, y, "#e6f7ff", 0.9);
        }
      }
    }));
    const mueveSalto = ({ capa, salto: [desde, hasta] }) => (t) => {
      if (t < desde || t > hasta) return [0, lejos(capa) - apartadaDe(capa)];
      return [0, -apartadaDe(capa) - Math.round(Math.sin((Math.PI * (t - desde)) / (hasta - desde)) * 26)];
    };
    return {
      comentario: "Surf: tres filas de olas que avanzan, cada una a su velocidad (las de delante, más deprisa y con espuma), y dos peces que saltan fuera del agua por turnos y vuelven a meterse",
      cieloDeDia: true,
      animacion: [
        { nombre: "olas", eje: "x", duracion: 12, pasos: 128 },
        {
          nombre: "salto", eje: "y", duracion: VUELTA_SALTOS,
          paradas: [0, 1, ...peces.flatMap(({ salto: [desde, hasta] }) => [desde - 0.0001, ...Array.from({ length: 13 }, (_, i) => desde + ((hasta - desde) * i) / 12), hasta + 0.0001])],
          mueve: Object.fromEntries(peces.map((pez) => [pez.capa.nombre, mueveSalto(pez)]))
        }
      ],
      capas: [{
        nombre: "delante", ancho: 128, alto: 16, repetir: "x", sitio: { y: 0, desde: "abajo" }, mueve: [384, 0],
        pintar(l) { olas(l, { base: 11, alto: 8, crestas: 1, color: "#2a7cb8", claro: "#4aa2d8", espuma: "#f2fbff", a: 0.78 }); }
      }, ...peces.map(({ capa }) => capa), {
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
    };
  })(),

  nieve: {
    comentario: "Nevada: copos que caen (los grandes, más deprisa y de lado: están más cerca), montes y pinos nevados que no se repiten en la portada (la tira mide 512), una cabaña con la luz encendida y un muñeco de nieve, cada uno una vez",
    cielo: "linear-gradient(to bottom, #4f73ad, #7d9fcf 55%, #a9c4e6)",
    animacion: { duracion: 12, pasos: 128 },
    capas: [{
      nombre: "copos-cerca", ancho: 128, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: [128, 256],
      pintar(l, azar) {
        for (let i = 0; i < 9; i++) copo(l, Math.floor(azar() * 128), Math.floor(azar() * 128), i % 3 ? 1 : 2, 0.88);
      }
    }, {
      nombre: "cabana", ancho: 34, alto: 36, repetir: "no", sitio: { x: 70, lado: "centro", y: 0, desde: "abajo" },
      pintar(l) {
        const [cx, base] = [8, 28];
        montoncitoDeNieve(l, 17, base - 1, 17);
        rect(l, cx, base - 9, 16, 9, "#7a5236", 0.95);
        for (let y = base - 8; y < base; y += 2) rect(l, cx, y, 16, 1, "#5e3e28", 0.95);
        rect(l, cx + 12, base - 15, 2, 4, "#4a3a34", 0.95);
        for (let r = 0; r < 5; r++) for (let k = -2 + r; k <= 17 - r; k++) l.poner(cx + k, base - 10 - r, r === 0 ? "#dfe8f3" : "#ffffff", 0.95);
        brillo(l, cx + 4, base - 5, 6, "#ffd66b", 0.5, 0.4);
        rect(l, cx + 3, base - 6, 3, 3, "#ffd66b", 0.95);
        rect(l, cx + 9, base - 5, 3, 5, "#3e2a1c", 0.95);
        for (let i = 0; i < 4; i++) disco(l, cx + 13 + i * 2, base - 18 - i * 3, 1 + (i >> 1), "#c8ccd4", 0.35);
      }
    }, {
      nombre: "muneco", ancho: 18, alto: 24, repetir: "no", sitio: { x: 20, lado: "centro", y: 0, desde: "abajo" },
      pintar(lienzo) {
        montoncitoDeNieve(lienzo, 9, 18, 9);
        // El muñeco, dos píxeles a la derecha (centrado sobre su montoncito)
        const l = { ...lienzo, poner: (x, y, c, a) => lienzo.poner(x + 2, y, c, a) };
        // Un muñeco de nieve: tres bolas, ojos de carbón, nariz de zanahoria, bufanda y brazos de rama
        for (const [cy, r] of [[15, 4], [9, 3], [4, 2]]) {
          disco(l, 7, cy, r, "#dfe8f3");
          disco(l, 6, cy - 1, r - 1, "#ffffff");
        }
        l.poner(6, 3, "#2a2a34");
        l.poner(8, 3, "#2a2a34");
        l.poner(9, 4, "#ff8a2a");
        l.poner(10, 4, "#ff8a2a");
        rect(l, 4, 6, 7, 1, "#e8383a");
        rect(l, 8, 7, 2, 3, "#e8383a");
        for (const [x, y] of [[3, 8], [2, 7], [1, 7], [11, 8], [12, 7], [13, 6]]) l.poner(x, y, "#6a4a30");
        for (const y of [9, 11]) l.poner(7, y, "#2a2a34");
      }
    }, {
      nombre: "paisaje", ancho: 512, alto: 40, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 22, alto: 12, ondas: [[2, 0.3], [3, 0.2], [7, 0.1]], color: "#c8d8ea", claro: "#e6eff8", a: 0.45 });
        // Pinos en grupos (bosquecillos y claros), de alturas distintas
        for (let x = 0; x < l.ancho; x += 6 + Math.floor(azar() * 10)) {
          if (Math.sin((x * 2 * Math.PI * 3) / l.ancho + 1) < -0.35) continue;
          pino(l, x, 30 + Math.floor(azar() * 4), 7 + Math.floor(azar() * 11), ["#2e4e4c", "#3e6662", "#ffffff"], 0.72, true);
        }
        monte(l, azar, { base: 37, alto: 7, ondas: [[3, 0.3], [5, 0.15], [11, 0.06]], color: "#eef4fa", claro: "#ffffff", a: 0.85 });
        for (let i = 0; i < 40; i++) l.poner(Math.floor(azar() * l.ancho), 36 + Math.floor(azar() * 4), "#b8cce4", 0.9);
      }
    }, {
      nombre: "copos-lejos", ancho: 64, alto: 64, repetir: "xy", sitio: { y: 0, desde: "arriba" }, mueve: [0, 128],
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) copo(l, Math.floor(azar() * 64), Math.floor(azar() * 64), i % 5 ? 0 : 1, 0.6);
      }
    }]
  },

  noche: {
    comentario: "Noche estrellada: un diseño para la tarjeta: azul de noche con estrellitas y constelaciones, la luna creciente entre nubes en la esquina de arriba, estrellas que cuelgan de hilos por arriba, nubes en las demás esquinas y un borde de nubes abajo",
    cielo: "linear-gradient(160deg, #3c4ca2, #303a8a 55%, #282c70)",
    capas: [
      ...esquinas(72, 50, (l) => {
        lunaCreciente(l, l.ancho - 22, 18, 12);
        nubeEsponjosa(l, l.ancho - 16, 34, 12, NUBES_DE_NOCHE);
        nubeEsponjosa(l, l.ancho - 38, 30, 8, NUBES_DE_NOCHE);
        estrellita(l, l.ancho - 48, 10, 2, "#ffe680");
        estrellita(l, l.ancho - 56, 24, 1, "#ffffff");
      }, ["arriba-derecha"]),
      ...esquinas(72, 50, (l, azar, abajo) => {
        if (abajo) {
          for (const [x, base, ancho] of [[l.ancho - 12, l.alto - 1, 16], [l.ancho - 40, l.alto - 1, 12], [l.ancho - 24, l.alto - 13, 11]]) nubeEsponjosa(l, x, base, ancho, NUBES_DE_NOCHE);
          estrellita(l, l.ancho - 50, l.alto - 22, 2, "#ffe680");
          estrellita(l, l.ancho - 10, l.alto - 32, 1, "#ffffff");
          estrellita(l, l.ancho - 36, l.alto - 30, 0, "#fff6c8");
        } else {
          nubeEsponjosa(l, l.ancho - 14, 14, 13, NUBES_DE_NOCHE);
          estrellita(l, l.ancho - 36, 22, 2, "#ffe680");
          estrellita(l, l.ancho - 10, 30, 1, "#ffffff");
        }
      }, ["arriba-izquierda", "abajo-derecha", "abajo-izquierda"]), {
      nombre: "colgantes", ancho: 256, alto: 26, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        // Estrellas que cuelgan de hilos, cada una a su largo
        for (let x = 30; x < l.ancho - 10; x += 26 + Math.floor(azar() * 18)) {
          const largo = 3 + Math.floor(azar() * 14);
          for (let y = 0; y < largo; y += 2) l.poner(x, y, "#c8ccf0", 0.6);
          if (azar() < 0.7) estrellita(l, x, largo + 2, 2, "#ffe680");
          else estrellita(l, x, largo + 1, 1, "#ffffff");
        }
      }
    }, {
      nombre: "nubes-abajo", ancho: 256, alto: 12, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (let x = 6; x < l.ancho; x += 18 + Math.floor(azar() * 8)) nubeEsponjosa(l, x, 9, 6 + Math.floor(azar() * 3), NUBES_DE_NOCHE);
        rect(l, 0, 10, l.ancho, 2, NUBES_DE_NOCHE[2]);
      }
    }, {
      nombre: "constelaciones", ancho: 200, alto: 150, repetir: "xy", sitio: { x: 60, y: 30, desde: "arriba" },
      pintar(l) {
        for (const puntos of [[[20, 30], [34, 22], [50, 28], [62, 18], [70, 34]], [[120, 96], [132, 110], [150, 104], [158, 120], [140, 128], [132, 110]]]) {
          for (let i = 1; i < puntos.length; i++) {
            const [[x0, y0], [x1, y1]] = [puntos[i - 1], puntos[i]];
            const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let k = 2; k < pasos - 1; k += 2) l.poner(Math.round(x0 + ((x1 - x0) * k) / pasos), Math.round(y0 + ((y1 - y0) * k) / pasos), "#c8d4ff", 0.35);
          }
          for (const [x, y] of puntos) estrellita(l, x, y, 1, "#ffffff", 0.8);
        }
      }
    }, {
      nombre: "estampado", ancho: 24, alto: 24, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        for (const [x, y, color, a] of [[4, 6, "#fff6c8", 0.7], [16, 18, "#c8d4ff", 0.6], [20, 4, "#ffffff", 0.5], [9, 15, "#ffffff", 0.35]]) l.poner(x, y, color, a);
        estrellita(l, 12, 2, 1, "#fff6c8", 0.4);
      }
    }]
  },

  casino: (() => {
    // La pantalla de la tragaperras de la esquina: un dibujo por momento, en el mismo sitio (ver
    // pantallaTragaperras), que se turnan como dice JUGADA
    const dibujoEn = (t) => Math.round(-JUGADA.mueve(t)[0] / 256);
    const pantallas = Array.from({ length: 5 }, (_, dibujo) => {
      const capa = {
        nombre: `pantalla-${dibujo}`, ancho: 72, alto: 50, repetir: "no", recortar: true, sitio: { x: 0, lado: "derecha", y: 0, desde: "abajo" },
        apartada: dibujo > 0,
        pintar(l) { pantallaTragaperras(l, 38, l.alto - 11, dibujo); }
      };
      capa.mueve = (t) => [0, dibujoEn(t) === dibujo ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
      return capa;
    });
    // La mano que se reparte en la mesa, a la derecha del centro (a la izquierda va la foto): las
    // cartas caen boca abajo de una en una, se van volviendo, salen dos más y se recogen
    const MANO = secuencia([[0, 0], [0.04, 1], [0.08, 2], [0.12, 3], [0.2, 4], [0.27, 5], [0.34, 6], [0.44, 7], [0.54, 8], [0.9, 0]], 1);
    const manoEn = (t) => Math.round(-MANO.mueve(t)[0]);
    const cartas = Array.from({ length: 8 }, (_, i) => {
      const dibujo = i + 1;
      const capa = {
        nombre: `cartas-${dibujo}`, ancho: 66, alto: 15, repetir: "no", sitio: { x: 40, lado: "centro", y: 14, desde: "abajo" },
        apartada: true,
        pintar(l) {
          const caras = [["A", "corazon"], ["K", "pica"], ["Q", "diamante"], ["J", "trebol"], ["A", "pica"]];
          const vueltas = Math.max(0, dibujo - 3);
          for (let k = 0; k < Math.min(5, dibujo <= 3 ? dibujo : 3 + Math.max(0, dibujo - 6)); k++) {
            if (k < vueltas) naipe(l, k * 13, 0, ...caras[k]);
            else naipeReves(l, k * 13, 0);
          }
        }
      };
      capa.mueve = (t) => [0, manoEn(t) === dibujo ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
      return capa;
    });
    const luces = (nombre, vertical, sitio, signo) => ({
      nombre, archivo: vertical ? "luces-v" : "luces", ancho: vertical ? 6 : 8, alto: vertical ? 8 : 6, repetir: vertical ? "y" : "x", sitio,
      mueve: (t) => (vertical ? [0, signo * turno(t, 16) * 4] : [signo * turno(t, 16) * 4, 0]),
      pintar(l) {
        for (const [k, color, centro] of [[1, "#ffd040", "#ffffff"], [5, "#7a5a28", "#9a7a40"]]) {
          if (vertical) rect(l, 1, k, 3, 3, color);
          else rect(l, k, 1, 3, 3, color);
          l.poner(vertical ? 2 : k + 1, vertical ? k + 1 : 2, centro);
        }
      }
    });
    const franja = (nombre, vertical, sitio) => ({
      nombre, ancho: vertical ? 9 : 16, alto: vertical ? 16 : 9, repetir: vertical ? "y" : "x", sitio,
      pintar(l) {
        // Dibujada para la de arriba (o la de la izquierda): granate, y por dentro el filo dorado
        const e = sitio.desde === "abajo" ? espejado(l, false, true) : sitio.lado === "derecha" ? espejado(l, true, false) : l;
        for (let a = 0; a < 16; a++) {
          for (let b = 0; b < 9; b++) {
            const [x, y] = vertical ? [b, a] : [a, b];
            e.poner(x, y, b < 7 ? "#6a1424" : b === 7 ? "#b8862a" : "#f0c040");
          }
        }
      }
    });
    return {
      comentario: "Casino: un diseño para la tarjeta: tapete verde con los palos de la baraja, un marco de bombillas que se persiguen alrededor, una mano de cartas que se reparte y se recoge en la mesa, naipes en abanico, fichas y dados en las esquinas y una tragaperras que de vez en cuando se pone en marcha y da premio",
      cielo: "linear-gradient(160deg, #2e9a5e, #23824c 55%, #1a6a3e)",
      // Las bombillas avanzan una cada 0,45 s; la tragaperras, como dice JUGADA
      animacion: { duracion: 7.2, paradas: [0, ...saltos(16), ...JUGADA.paradas, ...MANO.paradas, 1] },
      capas: [
        ...cartas,
        luces("luces-arriba", false, { y: 1, desde: "arriba" }, 1),
        luces("luces-abajo", false, { y: 1, desde: "abajo" }, -1),
        luces("luces-izquierda", true, { x: 1, y: 0, desde: "arriba" }, -1),
        luces("luces-derecha", true, { x: 1, lado: "derecha", y: 0, desde: "arriba" }, 1),
        franja("franja-arriba", false, { y: 0, desde: "arriba" }),
        franja("franja-abajo", false, { y: 0, desde: "abajo" }),
        franja("franja-izquierda", true, { x: 0, y: 0, desde: "arriba" }),
        franja("franja-derecha", true, { x: 0, lado: "derecha", y: 0, desde: "arriba" }),
        ...pantallas,
        ...esquinas(72, 50, (l, azar, abajo) => {
          if (abajo) {
            tragaperras(l, 38, l.alto - 11, ["#b8283a", "#8c1c2c"], [], 1, true);
            pilaDeFichas(l, 28, l.alto - 11, 5, "#2a6ae0");
            pilaDeFichas(l, 20, l.alto - 11, 3, "#e8383a");
            fichaPoker(l, 64, l.alto - 14, "#2a2228");
            return;
          }
          // El abanico de naipes, con dos fichas delante
          [["J", "trebol"], ["Q", "diamante"], ["K", "corazon"], ["A", "pica"]].forEach(([letra, palo], k) => naipe(l, l.ancho - 46 + k * 8, 10 + (3 - k) * 2 + (k === 3 ? 0 : 1), letra, palo));
          fichaPoker(l, l.ancho - 50, 30, "#e8383a");
          fichaPoker(l, l.ancho - 42, 33, "#2a6ae0");
        }, ["arriba-derecha", "abajo-derecha"]),
        ...esquinas(72, 50, (l, azar, abajo) => {
          if (abajo) {
            dado(l, l.ancho - 24, l.alto - 22, 5);
            dado(l, l.ancho - 15, l.alto - 18, 2);
            pilaDeFichas(l, l.ancho - 34, l.alto - 11, 4, "#2a2228");
            fichaPoker(l, l.ancho - 44, l.alto - 14, "#f0c040");
            return;
          }
          pilaDeFichas(l, l.ancho - 16, 30, 6, "#e8383a");
          pilaDeFichas(l, l.ancho - 25, 30, 4, "#2a6ae0");
          dado(l, l.ancho - 40, 16, 6);
        }, ["arriba-izquierda", "abajo-izquierda"]), {
          nombre: "estampado", ancho: 24, alto: 24, repetir: "xy", sitio: { y: 0, desde: "arriba" },
          pintar(l) {
            mapa(l, 3, 3, PALOS.corazon, { a: "#ffffff" }, 0.13);
            mapa(l, 15, 15, PALOS.pica, { a: "#0a3a20" }, 0.28);
            mapa(l, 15, 3, PALOS.diamante, { a: "#0a3a20" }, 0.18);
            mapa(l, 3, 15, PALOS.trebol, { a: "#ffffff" }, 0.1);
          }
        }
      ]
    };
  })(),

  aurora: {
    comentario: "Aurora: dos cortinas de luz (verde y violeta) que ondean una contra otra sobre montañas nevadas, con su reflejo en un lago helado",
    cielo: "linear-gradient(to bottom, #0f1a3c, #12304a 60%, #173e48)",
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
    comentario: "Desierto: arena con un estampado de ondas, un sol que asoma por la esquina de arriba con sus rayos, cactus, piedras y una calavera en las de abajo y una duna por el borde de abajo",
    cielo: "linear-gradient(160deg, #fff0c8, #fbdca0 55%, #f2c880)",
    capas: [{
      nombre: "sol", ancho: 70, alto: 50, repetir: "no", sitio: { x: 0, lado: "derecha", y: 0, desde: "arriba" },
      pintar(l) {
        const [cx, cy] = [l.ancho + 2, -4];
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const d = Math.hypot(x - cx, y - cy);
            const angulo = Math.atan2(y - cy, x - cx);
            if (d < 20) l.poner(x, y, d < 16 ? "#fff8d8" : "#ffe890");
            else if (d < 25 && umbral(x, y) < (25 - d) / 5) l.poner(x, y, "#ffe890", 0.8);
            else if (d > 28 && d < 54 && Math.cos(angulo * 16) > 0.55 + (d - 28) / 60) l.poner(x, y, "#ffd860", 0.75);
          }
        }
      }
    },
    ...esquinas(70, 46, (l, azar, abajo) => {
      if (!abajo) return;
      const [W0, H0] = [l.ancho, l.alto];
      for (let x = W0 - 64; x < W0; x++) {
        const alto = Math.round(3 + Math.max(0, (x - (W0 - 64)) / 10) + Math.sin(x / 7));
        for (let y = H0 - alto; y < H0; y++) l.poner(x, y, y === H0 - alto ? "#fff4d0" : (x + y) % 4 ? "#eabc78" : "#dcaa64");
      }
      cactus(l, W0 - 18, H0 - 3, 34, ["#3e7e34", "#5aa04a", "#8cc86c"]);
      cactus(l, W0 - 46, H0 - 2, 20, ["#4a8a3a", "#66ac52", "#98d478"]);
      // Un cactus redondo con flor, piedras y una calavera
      disco(l, W0 - 30, H0 - 6, 4, "#5aa04a");
      disco(l, W0 - 31, H0 - 7, 2, "#8cc86c");
      for (const [dx, dy] of [[0, -5], [-1, -6], [1, -6]]) l.poner(W0 - 30 + dx, H0 - 6 + dy, "#ff6a8a");
      for (const [x, r] of [[W0 - 58, 3], [W0 - 6, 2]]) {
        disco(l, x, H0 - 3, r, "#b89a7a");
        l.poner(x - 1, H0 - 4, "#e0c8a8");
      }
      mapa(l, W0 - 64, H0 - 8, [".www.", "wkwkw", "wwwww", ".w.w."], { w: "#f4ecdc", k: "#6a5040" }, 1);
    }, ["abajo-derecha", "abajo-izquierda"]), {
      nombre: "duna", ancho: 128, alto: 10, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l) {
        for (let x = 0; x < l.ancho; x++) {
          const alto = 4 + Math.round(Math.sin((x * 2 * Math.PI * 2) / l.ancho) * 2.5 + Math.sin((x * 2 * Math.PI * 5) / l.ancho) * 1);
          for (let y = l.alto - alto; y < l.alto; y++) l.poner(x, y, y === l.alto - alto ? "#fff4d0" : y === l.alto - alto + 1 ? "#f6d498" : "#eabc78");
        }
      }
    }, {
      nombre: "estampado", ancho: 48, alto: 16, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        // Las ondas que deja el viento en la arena: una línea clara y, debajo, su sombra
        for (let x = 0; x < l.ancho; x++) {
          const y = 6 + Math.round(Math.sin((x * 2 * Math.PI) / l.ancho) * 2.5);
          l.poner(x, y, "#fff8e0", 0.7);
          l.poner(x, y + 1, "#e8b878", 0.45);
        }
      }
    }]
  },

  bayas: {
    comentario: "Huerto de bayas: un mantel de picnic de cuadros, ramas con hojas y bayas de colores en las esquinas de arriba y abajo a la izquierda, una cesta llena de bayas abajo a la derecha y un borde de puntilla arriba",
    cielo: "linear-gradient(160deg, #fffaf2, #fff0de 60%, #ffe4cc)",
    capas: [
      ...esquinas(76, 50, (l, azar, abajo) => {
        if (abajo) {
          cestaDeBayas(l, l.ancho - 26, l.alto - 2, azar);
          for (let k = 0; k < 3; k++) baya(l, l.ancho - 54 - k * 7, l.alto - 4, 3, COLORES_BAYA[(k + 2) % COLORES_BAYA.length]);
          hojaOval(l, l.ancho - 50, l.alto - 2, 8, -2.6, ["#2e7424", "#4a9a34", "#a0dc80"]);
          return;
        }
        esquinaFrondosa(l, azar, {
          hojas: [["#2e7424", "#4a9a34", "#a0dc80"], ["#3e8a3a", "#5cb844", "#b4e890"]],
          fruto(l, x, y, azar) { baya(l, x, y + 2, 3, COLORES_BAYA[Math.floor(azar() * COLORES_BAYA.length)]); }
        });
      }, ["arriba-derecha", "arriba-izquierda", "abajo-derecha"]),
      ...esquinas(76, 50, (l, azar) => {
        esquinaFrondosa(espejado(l, false, true), azar, {
          hojas: [["#2e7424", "#4a9a34", "#a0dc80"], ["#3e8a3a", "#5cb844", "#b4e890"]],
          fruto(e, x, y, azar) { baya(l, x, l.alto - 1 - y + 2, 3, COLORES_BAYA[Math.floor(azar() * COLORES_BAYA.length)]); }
        });
      }, ["abajo-izquierda"]), {
        nombre: "puntilla", ancho: 8, alto: 6, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          for (let x = 0; x < 8; x++) {
            const hondo = 2 + Math.round(Math.sqrt(Math.max(0, 12 - (x - 3.5) ** 2)));
            for (let y = 0; y < hondo; y++) l.poner(x, y, y === hondo - 1 ? "#f0d8d0" : "#ffffff");
          }
          l.poner(3, 2, "#000000", 0);
          l.poner(4, 2, "#000000", 0);
        }
      }, {
        nombre: "mantel", ancho: 16, alto: 16, repetir: "xy", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
              const v = x < 8;
              const h = y < 8;
              if (v && h) l.poner(x, y, "#f28e98", 0.42);
              else if (v || h) l.poner(x, y, (x + y) % 2 ? "#f28e98" : "#f6a8b0", 0.22);
            }
          }
        }
      }
    ]
  },

  eevee: {
    comentario: "Eeveelutions: un paisaje con un tramo para cada una (agua, rayo, fuego, sol, luna, hoja, hielo y hada) que va girando despacio; encima, su piedra u objeto sube y baja con un efecto de su tipo, y unas huellas de Eevee lo cruzan",
    cielo: "linear-gradient(to bottom, #e9a96a, #f4cf98 60%, #f0d9b0)",
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
    comentario: "Espacio exterior: nebulosas de colores que pasan despacio, estrellas que titilan, un planeta con anillos y otros tres pequeños (en el centro y a la derecha: a la izquierda va la foto), estrellas fugaces, un cohete que cruza y el suelo de una luna con cráteres",
    cielo: "linear-gradient(160deg, #2c1660, #1e1c56 50%, #10304e)",
    // Una sola vuelta de 32 s: las estrellas cambian de dibujo cada 1,3 s, la nebulosa se desliza,
    // el cohete cruza de izquierda a derecha (meciéndose) y las fugaces pasan cada una en su momento
    animacion: { duracion: 32, paradas: [...repartidos(32), ...saltos(24), ...FUGACES_ESPACIO.flatMap(([desde, hasta]) => [desde, hasta])] },
    capas: [
      ...FUGACES_ESPACIO.map(([desde, hasta, x], k) => ({
        nombre: `fugaz-${k + 1}`, archivo: "fugaz", ancho: 32, alto: 16, repetir: "no", sitio: { x, lado: "derecha", y: -20, desde: "arriba" },
        mueve: (t) => {
          const p = Math.max(0, Math.min(1, (t - desde) / (hasta - desde)));
          return [-p * 300, p * 150];
        },
        pintar: k ? undefined : (l) => {
          for (let n = 0; n < 28; n++) {
            const px = 3 + n;
            const py = 13 - Math.round(n * 0.45);
            if (n < 6 || umbral(px, py) < 1 - n / 28) l.poner(px, py, n < 3 ? "#ffffff" : n < 12 ? "#ffe0f4" : "#c890e0", 0.95 - n * 0.02);
          }
          rect(l, 2, 12, 2, 2, "#ffffff", 1);
        }
      })), {
      nombre: "cohete", ancho: 20, alto: 11, repetir: "no", sitio: { x: -30, y: 34, desde: "arriba" },
      mueve: (t) => [Math.round(t * 900), Math.round(Math.sin(2 * Math.PI * 4 * t) * 2)],
      pintar(l) {
        // De lado, mirando a la derecha: la llama, las aletas, el cuerpo con su ventanilla y la punta
        rect(l, 0, 4, 5, 3, "#ff9a30");
        rect(l, 2, 5, 3, 1, "#fff080");
        for (const [x, y] of [[5, 1], [6, 1], [5, 2], [6, 2], [7, 2], [5, 8], [6, 8], [5, 9], [6, 9], [7, 8]]) l.poner(x, y, "#e8383a");
        rect(l, 6, 3, 10, 5, "#f4f4fa");
        rect(l, 6, 7, 10, 1, "#c8c8d8");
        rect(l, 6, 3, 10, 1, "#ffffff");
        rect(l, 16, 4, 2, 3, "#e8383a");
        l.poner(18, 5, "#e8383a");
        disco(l, 12, 5, 1, "#3a5070");
        l.poner(12, 5, "#7ac8ff");
      }
    }, {
      nombre: "planeta", ancho: 52, alto: 34, repetir: "no", sitio: { x: 60, lado: "centro", y: 4, desde: "arriba" },
      pintar(l) {
        const [cx, cy, r] = [26, 17, 12];
        const anillo = (dx, dy) => Math.abs((dx / 23) ** 2 + (dy / 5) ** 2 - 1) < 0.2;
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const [dx, dy] = [x - cx, y - cy];
            if (dx * dx + dy * dy > r * r) continue;
            if (anillo(dx, dy) && dy < 0) continue; // el anillo pasa por detrás
            const luz = (-dx - dy) / (r * 1.6) + 0.15;
            const banda = Math.floor((dy + r) / 4) % 2;
            const c = luz > 0.35 ? (banda ? "#ffe0b0" : "#ffd29a") : luz > -0.25 || umbral(x, y) < luz + 0.6 ? (banda ? "#f0b070" : "#e09a5a") : banda ? "#c07840" : "#a8643a";
            l.poner(x, y, c);
          }
        }
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const [dx, dy] = [x - cx, y - cy];
            if (anillo(dx, dy) && (dy >= 0 || dx * dx + dy * dy > r * r)) l.poner(x, y, Math.abs(dx) > 18 ? "#a890d8" : dx < 0 ? "#f0e4ff" : "#d0c0f0", 0.95);
          }
        }
      }
    }, {
      nombre: "planetita", ancho: 14, alto: 14, repetir: "no", sitio: { x: 5, lado: "centro", y: 30, desde: "arriba" },
      pintar(l) { planetaChico(l, 7, 7, 5, ["#9af0e0", "#4ac8c0", "#2a8a98"]); }
    }, {
      nombre: "planeta-rojo", ancho: 10, alto: 10, repetir: "no", sitio: { x: 118, lado: "centro", y: 2, desde: "arriba" },
      pintar(l) { planetaChico(l, 5, 5, 3, ["#ffb0a0", "#e8604a", "#a83a2a"]); }
    }, {
      nombre: "planeta-lila", ancho: 20, alto: 12, repetir: "no", sitio: { x: -28, lado: "centro", y: 48, desde: "arriba" },
      pintar(l) {
        planetaChico(l, 10, 6, 4, ["#e8c8ff", "#b07ae8", "#7a4ab8"]);
        for (let x = 1; x < 20; x++) if (Math.abs(x - 10) > 3) l.poner(x, 6 + Math.round((x - 10) * 0.15), "#fff0c8", 0.85);
      }
    }, {
      nombre: "suelo", ancho: 256, alto: 22, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        const tope = monte(l, azar, { base: 10, alto: 6, ondas: [[2, 0.3], [5, 0.15]], color: "#7e7aa2", claro: "#b8b4d8", a: 1 });
        for (let i = 0; i < 9; i++) {
          const cx = Math.floor((i * l.ancho) / 9 + azar() * 14);
          const cy = tope[vuelta(cx, 256)] + 5 + Math.floor(azar() * 8);
          const rx = 3 + Math.floor(azar() * 4);
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -rx; dx <= rx; dx++) {
              const d = (dx / rx) ** 2 + (dy / 2) ** 2;
              if (d <= 1) l.poner(cx + dx, cy + dy, d > 0.55 && dy > 0 ? "#c8c4e0" : d > 0.55 && dy < 0 ? "#4e4a70" : "#625e86");
            }
          }
        }
        for (let i = 0; i < 30; i++) l.poner(Math.floor(azar() * l.ancho), 14 + Math.floor(azar() * 8), i % 2 ? "#9a96bc" : "#6a668e");
      }
    }, {
      nombre: "estrellas", ancho: 384, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      mueve: (t) => [(Math.floor(t * 24 + 1e-6) % 4) * 96, 0],
      pintar(l, azar) {
        for (let i = 0; i < 30; i++) {
          const x = Math.floor(azar() * 96);
          const y = Math.floor(azar() * 96);
          const fase = Math.floor(azar() * 4);
          const color = ["#ffffff", "#c9d4ff", "#ffe0a0", "#ffb0d8"][i % 4];
          for (let dibujo = 0; dibujo < 4; dibujo++) {
            const nivel = i % 3 ? [3, 2, 1, 2][(dibujo + fase) % 4] : 2;
            const px = x + dibujo * 96;
            if (nivel === 1) {
              l.poner(px, y, color, 0.35);
              continue;
            }
            l.poner(px, y, color, nivel === 3 ? 1 : 0.75);
            if (nivel === 3) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(px + dx, y + dy, color, 0.6);
          }
        }
      }
    }, {
      nombre: "nebulosa", ancho: 256, alto: 110, repetir: "x", sitio: { y: 0, desde: "arriba" },
      mueve: (t) => [-256 * t, 0],
      pintar(l, azar) {
        const fases = Array.from({ length: 6 }, () => azar() * Math.PI * 2);
        const s = (x, y, kx, ky, f) => Math.sin((2 * Math.PI * kx * x) / 256 + y * ky + f);
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < 256; x++) {
            const n = s(x, 0, 2, 0, fases[0]) * Math.sin(y * 0.06 + fases[1]) * 0.6 + s(x, 0, 5, 0, fases[2]) * Math.sin(y * 0.13 + fases[4]) * 0.3 + s(x, y, 9, 0.2, fases[5]) * 0.1 - 0.05;
            const tono = s(x, y, 1, 0.03, fases[3]);
            const densidad = Math.max(0, n) * (1 - y / 140);
            if (umbral(x, y) < densidad) l.poner(x, y, tono > 0.3 ? "#e070c8" : tono > -0.3 ? "#8a6af0" : "#40c0d8", 0.38);
            else if (umbral(x, y) < densidad * 2.2) l.poner(x, y, tono > 0.3 ? "#a04a9a" : tono > -0.3 ? "#5a4ab8" : "#2a8aa8", 0.25);
          }
        }
      }
    }, {
      nombre: "polvo", ancho: 64, alto: 64, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) l.poner(Math.floor(azar() * 64), Math.floor(azar() * 64), i % 3 ? "#8a90c8" : "#ffffff", i % 3 ? 0.5 : 0.7);
      }
    }]
  },

  rocket: (() => {
    // Estampado, no una habitación: chapa con la R, franjas de peligro arriba y abajo, alarmas que
    // parpadean en las esquinas de arriba, cajas en las de abajo y, a la derecha del centro (a la
    // izquierda va la foto), Wobbuffet saliendo de su caja (un dibujo por momento, como dice WOBBUFFET)
    const dibujoEn = (t) => Math.round(-WOBBUFFET.mueve(t)[0] / 256);
    const wobbuffets = Array.from({ length: 5 }, (_, dibujo) => {
      const capa = {
        nombre: `wobbuffet-${dibujo}`, ancho: 56, alto: 72, repetir: "no", recortar: true, sitio: { x: 50, lado: "centro", y: -1, desde: "abajo" },
        apartada: dibujo > 0,
        pintar(l) { pintarWobbuffet(l, 28 - 133, dibujo); }
      };
      capa.mueve = (t) => [0, dibujoEn(t) === dibujo ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
      return capa;
    });
    // Las alarmas de las esquinas de arriba: encendida y apagada se turnan (la que no toca, a un lado)
    const alarmas = ["derecha", "izquierda"].flatMap((lado) => [true, false].map((encendida) => ({
      nombre: `alarma-${lado}-${encendida ? "on" : "off"}`, ancho: 32, alto: 34, repetir: "no", sitio: { x: 6, lado, y: 6, desde: "arriba" },
      mueve: (t) => [turno(t, 8) === (encendida ? 0 : 1) ? 0 : FUERA, 0],
      pintar(l) { alarma(l, 16, encendida); }
    })));
    return {
      comentario: "Guarida Rocket: un diseño para la tarjeta: chapa con la R, franjas de peligro arriba y abajo, alarmas rojas que parpadean en las esquinas de arriba, cajas y un barril en las de abajo y, a la derecha del centro, Wobbuffet, que sale de su caja, saluda meneándose y se vuelve a meter",
      cielo: "linear-gradient(160deg, #5a2a36, #3a3240 55%, #2c2a34)",
      animacion: { duracion: 4.8, paradas: [0, ...saltos(8), ...WOBBUFFET.paradas, 1] },
      capas: [...wobbuffets, ...alarmas,
        ...esquinas(60, 44, (l) => {
          cajaRocket(l, l.ancho - 22, l.alto - 21);
          cajaRocket(l, l.ancho - 39, l.alto - 21);
          cajaRocket(l, l.ancho - 30, l.alto - 34);
        }, ["abajo-derecha"]),
        ...esquinas(60, 44, (l) => {
          cajaRocket(l, l.ancho - 26, l.alto - 21);
          barril(l, l.ancho - 36, l.alto - 8);
        }, ["abajo-izquierda"]), {
          // Una tubería bajo la franja de arriba, con válvulas y relojes de presión de vez en cuando
          nombre: "tuberia", ancho: 512, alto: 10, repetir: "x", sitio: { y: 8, desde: "arriba" },
          pintar(l, azar) {
            rect(l, 0, 1, l.ancho, 3, "#5a5e6a");
            rect(l, 0, 1, l.ancho, 1, "#8a8e9a");
            for (let x = 0; x < l.ancho; x += 24) rect(l, x, 0, 2, 5, "#3a3e48");
            for (let x = 20 + Math.floor(azar() * 30); x < l.ancho - 10; x += 40 + Math.floor(azar() * 70)) {
              if (azar() < 0.5) {
                disco(l, x, 6, 3, "#c8ccd4");
                disco(l, x, 6, 2, "#f4f4f8");
                l.poner(x + 1, 5, "#e8242e");
                l.poner(x, 6, "#2a2a30");
              } else {
                rect(l, x - 1, 4, 3, 2, "#3a3e48");
                rect(l, x - 3, 6, 7, 1, "#e8242e");
                l.poner(x, 5, "#a01820");
              }
            }
          }
        }, {
          // Sobre la franja de abajo, de vez en cuando: conos, cajas de herramientas y papeles
          nombre: "cosas", ancho: 512, alto: 12, repetir: "x", sitio: { y: 7, desde: "abajo" },
          pintar(l, azar) {
            for (let x = 40 + Math.floor(azar() * 30); x < l.ancho - 12; x += 50 + Math.floor(azar() * 80)) {
              const que = Math.floor(azar() * 3);
              if (que === 0) mapa(l, x - 3, l.alto - 8, ["...o...", "...o...", "..www..", "..ooo..", ".ooooo.", ".wwwww.", "ooooooo", "kkkkkkk"], { o: "#ff7a2a", w: "#ffffff", k: "#2a2a30" }, 1);
              else if (que === 1) mapa(l, x - 4, l.alto - 6, ["..kkkk...", ".k....k..", "rrrrrrrrr", "rrrryrrrr", "rrrrrrrrr", "ddddddddd"], { k: "#3a3e48", r: "#c8283a", y: "#f0c020", d: "#8a1a24" }, 1);
              else mapa(l, x - 3, l.alto - 2, ["wwwww..", "..wwwww"], { w: "#d8d4c8" }, 1);
            }
          }
        }, {
          // Por el medio, sueltas y medio transparentes: erres grandes
          nombre: "motivos", ancho: 384, alto: 96, repetir: "xy", sitio: { x: 50, y: 22, desde: "arriba" },
          pintar(l) {
            const R = ["######.", "##...##", "##...##", "######.", "##.##..", "##..##.", "##...##"];
            for (const [x, y] of [[40, 16], [170, 62], [290, 26], [100, 86]]) mapa(l, x, y, R, { "#": "#d8283a" }, 0.22);
          }
        }, {
          nombre: "franja-arriba", ancho: 16, alto: 8, repetir: "x", sitio: { y: 0, desde: "arriba" },
          pintar(l) { franjaDePeligro(l); }
        }, {
          nombre: "franja-abajo", ancho: 16, alto: 8, repetir: "x", sitio: { y: 0, desde: "abajo" },
          pintar(l) { franjaDePeligro(espejado(l, false, true)); }
        }, {
          nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" },
          pintar(l) {
            // La R al tresbolillo y remaches
            for (const [x, y] of [[6, 6], [22, 22]]) mapa(l, x, y, ["rrrr.", "r...r", "rrrr.", "r.r..", "r..rr"], { r: "#c8283a" }, 0.3);
            for (const [x, y] of [[22, 6], [6, 22]]) {
              l.poner(x, y, "#8a8e9a", 0.5);
              l.poner(x + 1, y + 1, "#1c1e24", 0.5);
            }
          }
        }]
    };
  })(),

  cementerio: {
    comentario: "Cementerio: lápidas (con flores en alguna), un árbol seco, una verja, la luna llena, niebla que pasa y fantasmitas que flotan",
    cielo: "linear-gradient(to bottom, #48307e, #352d62 55%, #282645)",
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
    cielo: "linear-gradient(to bottom, #2c98c8, #1d6aa0 50%, #12457a)",
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

  // El id sigue siendo «tormenta» (es el que guardan las compras), pero ahora es «Feria»
  tormenta: (() => {
    // Una vuelta de 12 s en 48 tramos: la noria cambia de dibujo en cada uno (6 dibujos: va
    // girando), los banderines se mecen cada dos y los globitos suben sin parar
    const TRAMOS = 48;
    const tramo = (t) => Math.floor(t * TRAMOS + 1e-6);
    const norias = Array.from({ length: 6 }, (_, k) => {
      const capa = {
        nombre: `noria-${k}`, ancho: 64, alto: 66, repetir: "no", recortar: true, sitio: { x: 50, lado: "centro", y: 6, desde: "abajo" },
        apartada: k > 0,
        pintar(l) { noria(l, 32, 27, 24, (k * Math.PI) / 4 / 6); }
      };
      capa.mueve = (t) => [0, tramo(t) % 6 === k ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
      return capa;
    });
    const banderines = [0, 1].map((k) => {
      const capa = {
        nombre: `banderines-${k}`, ancho: 128, alto: 18, repetir: "x", sitio: { y: 0, desde: "arriba" },
        apartada: k > 0,
        pintar(l) { tiraDeBanderines(l, k); }
      };
      capa.mueve = (t) => [0, Math.floor(tramo(t) / 2) % 2 === k ? -apartadaDe(capa) : lejos(capa) - apartadaDe(capa)];
      return capa;
    });
    // La montaña rusa, a la izquierda de la noria: la vía (MONTANA_ANCHO de ancho, sobre el césped) y la
    // vagoneta, que la recorre de ida y vuelta en cada vuelta (rápida en las bajadas, lenta al llegar
    // a los extremos), siempre apoyada en la vía
    const MONTANA = { x: -40, abajo: 6 };
    const vagoneta = {
      nombre: "vagoneta", ancho: 9, alto: 7, repetir: "no", sitio: { x: MONTANA.x - MONTANA_ANCHO / 2, lado: "centro", y: 0, desde: "abajo" },
      mueve: (t) => {
        const x = 6 + (MONTANA_ANCHO - 12) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t));
        return [Math.round(x), -(MONTANA.abajo + MONTANA_ALTO - alturaVia(Math.round(x)))];
      },
      pintar(l) {
        // Dos pasajeros con los brazos arriba y el carro rojo con sus ruedas
        for (const x of [2, 6]) {
          l.poner(x, 0, "#ffd23a");
          l.poner(x, 1, "#ffe0c8");
          l.poner(x - 1, 0, "#ffe0c8");
        }
        rect(l, 0, 2, 9, 3, "#e8383a");
        rect(l, 0, 2, 9, 1, "#ff7a7a");
        rect(l, 0, 4, 9, 1, "#a82428");
        for (const x of [1, 7]) l.poner(x, 5, "#3a3040");
      }
    };
    return {
      comentario: "Feria: un diseño para la tarjeta: crema con confeti, banderines de colores que se mecen arriba, una noria que gira a la derecha del centro y, a su izquierda, una montaña rusa con su vagoneta que sube y baja, una carpa de rayas y un ramo de globos en las esquinas de abajo, globitos que suben y un borde de césped",
      cielo: "linear-gradient(160deg, #fff6dc, #ffe6c4 55%, #ffd4b0)",
      animacion: { duracion: 12, paradas: [0, ...saltos(TRAMOS), 1] },
      capas: [...banderines, ...norias, vagoneta, {
        nombre: "montana-rusa", ancho: MONTANA_ANCHO, alto: MONTANA_ALTO, repetir: "no", sitio: { x: MONTANA.x, lado: "centro", y: MONTANA.abajo, desde: "abajo" },
        pintar(l) { montanaRusa(l); }
      },
        ...esquinas(56, 44, (l) => { carpa(l, l.ancho - 24, l.alto - 6); }, ["abajo-derecha"]),
        ...esquinas(56, 44, (l) => { ramoDeGlobos(l, l.ancho - 18, l.alto - 6); }, ["abajo-izquierda"]), {
          nombre: "globitos", ancho: 96, alto: 128, repetir: "xy", sitio: { x: 40, y: 0, desde: "arriba" },
          mueve: (t) => [0, -128 * t],
          pintar(l) {
            for (const [x, y, k] of [[20, 30, 0], [70, 90, 2], [50, 10, 1]]) globito(l, x, y, COLORES_GLOBITO[k]);
          }
        }, {
          nombre: "cesped", ancho: 64, alto: 8, repetir: "x", sitio: { y: 0, desde: "abajo" },
          pintar(l, azar) {
            rect(l, 0, 4, l.ancho, 4, "#6cbc5a");
            rect(l, 0, 4, l.ancho, 1, "#9ad87a");
            for (let x = 0; x < l.ancho; x += 2) {
              const alto = 1 + Math.floor(azar() * 3);
              rect(l, x, 4 - alto, 1, alto, "#7ac868");
            }
            for (const x of [9, 30, 51]) {
              l.poner(x, 2, ["#ff6a8a", "#ffe066", "#ffffff"][x % 3]);
            }
          }
        }, {
          nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" },
          pintar(l) {
            // Confeti: tiritas de colores en distintas posturas
            for (const [x, y, color, tumbada] of [[4, 6, "#ff6a8a", true], [20, 3, "#4aa8ff", false], [12, 18, "#ffd23a", false], [27, 24, "#7ad05a", true], [6, 27, "#c07aff", false], [24, 13, "#ff9a3a", true]]) {
              l.poner(x, y, color, 0.6);
              l.poner(x + (tumbada ? 1 : 0), y + (tumbada ? 0 : 1), color, 0.6);
            }
          }
        }]
    };
  })(),

  pompas: {
    comentario: "Pompas de jabón: pompas tornasoladas que suben bamboleándose (las grandes, más deprisa: están más cerca) sobre un jardín con valla blanca y nubes de algodón",
    cielo: "linear-gradient(to bottom, #9fd2ff, #c6e3ff 45%, #f4dcf4 80%, #ffe4ec)",
    animacion: [
      { nombre: "sube", eje: "y", duracion: 16, pasos: 128, mueve: { "pompas-cerca": [0, -256], "pompas-lejos": [0, -128] } },
      {
        nombre: "baila", eje: "x", duracion: 4, paradas: repartidos(16),
        mueve: { "pompas-cerca": (t) => [Math.sin(2 * Math.PI * t) * 2.5, 0], "pompas-lejos": (t) => [Math.cos(2 * Math.PI * t) * 1.5, 0] }
      }
    ],
    capas: [{
      nombre: "pompas-cerca", ancho: 128, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        for (const [x, y, r] of [[18, 14, 6], [72, 40, 4], [106, 8, 3], [40, 76, 5], [98, 96, 6], [12, 112, 3], [66, 120, 2]]) pompa(l, x, y, r, 0.92);
      }
    }, {
      nombre: "pompas-lejos", ancho: 96, alto: 96, repetir: "xy", sitio: { x: 30, y: 20, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 9; i++) pompa(l, Math.floor(azar() * 96), Math.floor(azar() * 96), 1 + (i % 3), 0.6);
      }
    }, {
      nombre: "jardin", ancho: 256, alto: 30, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 14, alto: 8, ondas: [[2, 0.3], [5, 0.12]], color: "#b4e6c4", claro: "#d2f4dc", a: 1 });
        for (let i = 0; i < 6; i++) arbol(l, Math.floor((i * l.ancho) / 6 + azar() * 20), 15, 7 + Math.floor(azar() * 3), ["#8ccfa0", "#a8e0b6", "#d4f6de"], 1);
        // La valla blanca
        for (let x = 0; x < l.ancho; x++) {
          for (const y of [18, 21]) l.poner(x, y, x % 6 === 1 ? "#dde4ee" : "#ffffff");
          if (x % 6 === 0) {
            rect(l, x, 16, 2, 9, "#ffffff");
            rect(l, x + 1, 17, 1, 8, "#dde4ee");
            l.poner(x, 15, "#ffffff");
          }
        }
        suelo(l, 24, ["#a6e4ae", "#8ed89a", "#78c888"], 1);
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(azar() * l.ancho);
          const y = 25 + Math.floor(azar() * 4);
          const flor = ["#ffffff", "#ffd6ec", "#fff2a0", "#d8c8ff"][i % 4];
          for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) l.poner(x + dx, y + dy, flor);
          l.poner(x, y, "#ffd23a");
        }
      }
    }, {
      nombre: "nubes", ancho: 256, alto: 36, repetir: "x", sitio: { y: 2, desde: "arriba" },
      pintar(l) {
        for (const [cx, base, ancho] of [[34, 24, 14], [124, 30, 9], [200, 22, 15]]) nubeEsponjosa(l, cx, base, ancho, ["#ffffff", "#f6f2ff", "#e2daf6"]);
      }
    }]
  },

  cerezos: {
    comentario: "Cerezos en flor: no es un paisaje, es un diseño para la tarjeta: rosa con un estampado de florecitas, ramas floridas que entran por las cuatro esquinas, flores sueltas por arriba y pétalos caídos abajo, y pétalos que caen meciéndose con el viento",
    cielo: "linear-gradient(160deg, #ffe8f0, #ffd4e3 55%, #fbc0d6)",
    animacion: [
      { nombre: "cae", eje: "y", duracion: 16, pasos: 128, mueve: { "petalos-cerca": [0, 256], "petalos-lejos": [0, 128] } },
      {
        nombre: "viento", eje: "x", duracion: 16, paradas: repartidos(48),
        mueve: {
          "petalos-cerca": (t) => [-128 * t + Math.sin(2 * Math.PI * 4 * t) * 4, 0],
          "petalos-lejos": (t) => [-64 * t + Math.sin(2 * Math.PI * 3 * t) * 2, 0]
        }
      }
    ],
    capas: [{
      nombre: "petalos-cerca", ancho: 128, alto: 128, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 14; i++) petalo(l, Math.floor(azar() * 128), Math.floor(azar() * 128), i, 1);
      }
    },
    ...[["arriba-derecha", false, false], ["arriba-izquierda", true, false], ["abajo-derecha", false, true], ["abajo-izquierda", true, true]].map(([nombre, espejoX, espejoY]) => ({
      nombre: `esquina-${nombre}`, ancho: 84, alto: 52, repetir: "no", recortar: true,
      sitio: { x: 0, lado: espejoX ? "izquierda" : "derecha", y: 0, desde: espejoY ? "abajo" : "arriba" },
      pintar(l, azar) { esquinaFlorida(l, azar, espejoX, espejoY); }
    })), {
      nombre: "petalos-lejos", ancho: 64, alto: 64, repetir: "xy", sitio: { x: 17, y: 9, desde: "arriba" },
      pintar(l, azar) {
        for (let i = 0; i < 9; i++) {
          const x = Math.floor(azar() * 64);
          const y = Math.floor(azar() * 64);
          l.poner(x, y, "#ffffff", 0.8);
          if (i % 2) l.poner(x + 1, y, "#ffb0c8", 0.8);
        }
      }
    }, {
      nombre: "borde-arriba", ancho: 512, alto: 24, repetir: "x", sitio: { y: 0, desde: "arriba" },
      pintar(l, azar) {
        // Ramitas que cuelgan a distancias y largos distintos (algunas con varias flores o un capullo),
        // con huecos entre medias: nada se ve igual dos veces en la portada
        for (let x = 0; x < l.ancho; x++) if ((x * 7) % 11 < 6 && Math.sin(x / 23) > -0.4) l.poner(x, 0, "#f4a2c0");
        for (let x = 8 + Math.floor(azar() * 10); x < l.ancho - 8; x += 18 + Math.floor(azar() * 44)) {
          const largo = 2 + Math.floor(azar() * 10);
          for (let k = 0; k < largo; k++) l.poner(x + (k > largo / 2 ? 1 : 0), k, "#6e4a48");
          const n = azar() < 0.35 ? 3 : azar() < 0.55 ? 2 : 1;
          for (let f = 0; f < n; f++) florCerezo(l, x + Math.round((f - (n - 1) / 2) * 6), largo + 3 + (f % 2) * 3, f === 0 ? 3 : 2, azar() * Math.PI);
          if (azar() < 0.4) {
            disco(l, x + 5, largo + 1, 1, "#e8608a");
            l.poner(x + 4, largo, "#ff9ab8");
          }
        }
      }
    }, {
      nombre: "borde-abajo", ancho: 512, alto: 12, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // Pétalos amontonados, más altos en unos sitios que en otros, flores caídas sueltas o en grupo
        for (let x = 0; x < l.ancho; x++) {
          const ola = 2.5 + Math.sin((x * 2 * Math.PI * 3) / l.ancho) * 1.8 + Math.sin((x * 2 * Math.PI * 11) / l.ancho + 1) * 1.2 + Math.sin((x * 2 * Math.PI * 29) / l.ancho) * 0.6;
          const alto = Math.max(1, Math.round(ola));
          for (let y = l.alto - alto; y < l.alto; y++) l.poner(x, y, (x + y) % 3 ? "#ffb4cc" : "#ffe4ee");
        }
        for (let x = 6; x < l.ancho - 6; x += 14 + Math.floor(azar() * 40)) {
          const n = azar() < 0.3 ? 3 : azar() < 0.5 ? 2 : 1;
          for (let f = 0; f < n; f++) florCerezo(l, x + f * 5, l.alto - 4 - (f % 2) * 2, azar() < 0.3 ? 3 : 2, azar() * Math.PI);
        }
        for (let i = 0; i < 30; i++) petalo(l, Math.floor(azar() * l.ancho), l.alto - 6 - Math.floor(azar() * 4), i, 1);
      }
    }, {
      nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" },
      pintar(l) {
        // Florecitas de cinco puntos (blancas y rosas, al tresbolillo) y puntitos entre medias
        for (const [cx, cy, color] of [[8, 8, "#ffffff"], [24, 24, "#f7a6c4"]]) {
          for (let k = 0; k < 5; k++) {
            const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
            l.poner(cx + Math.round(Math.cos(a) * 2), cy + Math.round(Math.sin(a) * 2), color, 0.55);
          }
          l.poner(cx, cy, "#f080a8", 0.45);
        }
        for (const [x, y] of [[24, 8], [8, 24]]) l.poner(x, y, "#ffffff", 0.45);
      }
    }]
  },

  girasoles: {
    comentario: "Girasoles: un campo de girasoles de lejos a cerca, abejas (cinco, a varias alturas) que pasan zumbando y nubes que van despacio",
    cielo: "linear-gradient(to bottom, #62b6f4, #9fd6fb 50%, #fff0c2)",
    animacion: [
      { nombre: "vuelo", eje: "x", duracion: 48, pasos: 512, mueve: { abejas: [512, 0], nubes: [-256, 0] } },
      { nombre: "zumbido", eje: "y", duracion: 1.2, paradas: repartidos(4), mueve: { abejas: (t) => [0, Math.round(Math.sin(2 * Math.PI * t) * 1.5)] } }
    ],
    capas: [{
      nombre: "abejas", ancho: 256, alto: 52, repetir: "x", sitio: { y: 6, desde: "arriba" },
      pintar(l) {
        for (const [x, y] of [[20, 8], [96, 24], [150, 40], [196, 12], [236, 32]]) {
          for (let k = 1; k <= 3; k++) l.poner(x - k * 3, y + 3 + (k % 2), "#ffffff", 0.55);
          abeja(l, x, y);
        }
      }
    }, {
      nombre: "nubes", ancho: 256, alto: 36, repetir: "x", sitio: { y: 2, desde: "arriba" }, pintar: nubesDeDia
    }, {
      nombre: "campo", ancho: 256, alto: 72, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        monte(l, azar, { base: 28, alto: 8, ondas: [[2, 0.3], [5, 0.12]], color: "#8cc864", claro: "#a6da7c", a: 1 });
        // A lo lejos, el campo amarillo (puntitos cada vez más grandes)
        for (let y = 27; y < 38; y++) {
          for (let x = 0; x < l.ancho; x++) {
            l.poner(x, y, umbral(x, y) < 0.5 + (y - 27) * 0.03 ? ((x + y) % 3 ? "#ffd23a" : "#f0a818") : "#5ea83a");
          }
        }
        for (let x = 0; x < l.ancho; x += 3) l.poner(x + (x % 2), 27, "#ffe866");
        suelo(l, 46, ["#4a9a32", "#3e8a2a", "#327a24"], 1);
        rect(l, 0, 38, l.ancho, 8, "#5ea83a");
        for (let x = 2; x < l.ancho; x += 7) girasol(l, x + Math.floor(azar() * 3), 46, 6 + Math.floor(azar() * 4), 2);
        for (let x = 12; x < l.ancho; x += 16) girasol(l, x + Math.floor(azar() * 5), 62, 10 + Math.floor(azar() * 6), 3);
        // Matas de hojas entre los de cerca
        for (let x = 0; x < l.ancho; x += 6) hoja(l, x + Math.floor(azar() * 4), 70 - Math.floor(azar() * 4), 6 + Math.floor(azar() * 4), x % 12 ? 1 : -1);
        for (let x = 6; x < l.ancho; x += 26) girasol(l, x + Math.floor(azar() * 8), 72, 22 + Math.floor(azar() * 12), 4);
      }
    }]
  },

  playa: {
    comentario: "Playa tropical: el mar turquesa con destellos que titilan, olas que lamen la orilla, el sol en medio, arena blanca con dos sombrillas, un castillo, una pelota y dos palmeras (cada cosa una vez, en su sitio: en la portada, que es ancha, no se repiten), gaviotas que pasan y un cangrejo que va de lado",
    cielo: "linear-gradient(to bottom, #48b0f0, #86d0fa 55%, #cdeffd)",
    animacion: [
      {
        nombre: "pasan", eje: "x", duracion: 24, paradas: [...repartidos(48), ...saltos(24)],
        mueve: {
          gaviotas: (t) => [-256 * t, 0],
          destellos: (t) => [(Math.floor(t * 24 + 1e-6) % 4) * 64, 0],
          cangrejo: (t) => [Math.round(Math.sin(2 * Math.PI * 3 * t) * 14), 0]
        }
      },
      {
        nombre: "olas", eje: "y", duracion: 4, paradas: repartidos(16),
        mueve: { espuma: (t) => [0, Math.round((0.5 - 0.5 * Math.cos(2 * Math.PI * t)) * 3)], gaviotas: (t) => [0, Math.sin(2 * Math.PI * t) * 1.5] }
      }
    ],
    capas: [{
      nombre: "gaviotas", ancho: 256, alto: 22, repetir: "x", sitio: { y: 6, desde: "arriba" },
      pintar(l) { for (const [x, y] of [[30, 4], [44, 10], [150, 2], [212, 13]]) gaviota(l, x, y, 0.95); }
    }, {
      nombre: "sol", ancho: 40, alto: 40, repetir: "no", sitio: { x: 0, lado: "centro", y: 0, desde: "arriba" },
      pintar(l) {
        brillo(l, 20, 20, 19, "#fff8d0", 0.6, 0.55);
        disco(l, 20, 20, 8, "#ffe680", 1);
        disco(l, 20, 20, 6, "#fffbe0", 1);
      }
    }, {
      nombre: "palmera", ancho: 48, alto: 56, repetir: "no", sitio: { x: 2, lado: "derecha", y: 12, desde: "abajo" },
      pintar(l) { palmera(l, 30, 54, 34, ["#2e8a3a", "#4cb050", "#a07a4a"], 1, -1); }
    }, {
      nombre: "palmera-chica", ancho: 40, alto: 46, repetir: "no", sitio: { x: 105, lado: "centro", y: 13, desde: "abajo" },
      pintar(l) { palmera(l, 12, 44, 26, ["#2e8a3a", "#4cb050", "#a07a4a"], 1, 1); }
    }, {
      nombre: "cangrejo", ancho: 9, alto: 7, repetir: "no", sitio: { x: 40, lado: "derecha", y: 3, desde: "abajo" },
      pintar(l) {
        mapa(l, 0, 0, ["rr.....rr", ".rd...dr.", "..k...k..", ".rrrrrrr.", "rrrrrrrrr", ".ddddddd.", "d.d...d.d"], { r: "#e8503a", d: "#b83426", k: "#2a1a1a" }, 1);
      }
    }, {
      nombre: "sombrilla", ancho: 40, alto: 24, repetir: "no", sitio: { x: 30, lado: "centro", y: 9, desde: "abajo" },
      pintar(l) { sombrilla(l, 12, 8, ["#ff5a6a", "#ffffff", "#d84050"], ["#4aa8ff", "#ffffff"]); }
    }, {
      nombre: "sombrilla-azul", ancho: 40, alto: 24, repetir: "no", sitio: { x: 65, lado: "centro", y: 7, desde: "abajo" },
      pintar(l) { sombrilla(l, 12, 8, ["#3a8ae8", "#fff2a0", "#2a6ac0"], ["#ff9a3a", "#ffffff"]); }
    }, {
      nombre: "castillo", ancho: 9, alto: 10, repetir: "no", sitio: { x: -60, lado: "centro", y: 4, desde: "abajo" },
      pintar(l) {
        mapa(l, 0, 0, [
          "....rr...",
          "....k....",
          "..b.k.b..",
          ".bbbkbbb.",
          ".bab.bab.",
          "bbbbbbbbb",
          "baabbbaab",
          "bbbbdbbbb",
          "bbbbddbbb",
          "bbbbbbbbb"
        ], { b: "#e6c27e", a: "#c89a58", d: "#8a6a40", r: "#e8383a", k: "#6a5040" }, 1);
      }
    }, {
      nombre: "pelota", ancho: 7, alto: 7, repetir: "no", sitio: { x: -20, lado: "centro", y: 4, desde: "abajo" },
      pintar(l) {
        for (let y = -3; y <= 3; y++) {
          for (let x = -3; x <= 3; x++) {
            if (x * x + y * y > 10) continue;
            l.poner(3 + x, 3 + y, ["#ff5a6a", "#ffffff", "#3a8ae8", "#ffe066"][Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 2)) % 4]);
          }
        }
        l.poner(2, 2, "#ffffff");
      }
    }, {
      nombre: "espuma", ancho: 256, alto: 11, repetir: "x", sitio: { y: 14, desde: "abajo" },
      pintar(l) {
        // Arriba, tres filas más de agua: así, cuando la ola baja, sigue tapando la arena mojada
        for (let x = 0; x < l.ancho; x++) {
          const borde = 7 + Math.round(Math.sin((x * 2 * Math.PI * 5) / 256) * 0.8 + Math.sin((x * 2 * Math.PI * 12) / 256 + 1) * 0.5);
          for (let y = 0; y < borde; y++) l.poner(x, y, "#7ee4dc", y < 3 ? 0.5 : 0.75);
          l.poner(x, borde, "#ffffff", 0.95);
          if (umbral(x, borde + 1) < 0.5) l.poner(x, borde + 1, "#ffffff", 0.8);
        }
      }
    }, {
      nombre: "destellos", ancho: 256, alto: 20, repetir: "x", sitio: { y: 24, desde: "abajo" },
      pintar(l, azar) {
        for (let i = 0; i < 7; i++) {
          const x = 4 + Math.floor(azar() * 56);
          const y = 2 + Math.floor(azar() * 16);
          const fase = Math.floor(azar() * 4);
          for (let cuadro = 0; cuadro < 4; cuadro++) {
            const nivel = [3, 2, 1, 0][(cuadro + fase) % 4];
            const px = x + cuadro * 64;
            if (nivel === 3) destello(l, px, y, ["#e8fcff", "#ffffff"], false, 0.95);
            if (nivel === 2) for (const dx of [-1, 0, 1]) l.poner(px + dx, y, dx ? "#d8f8ff" : "#ffffff", dx ? 0.7 : 0.9);
            if (nivel === 1) l.poner(px, y, "#d8f8ff", 0.6);
          }
        }
      }
    }, {
      nombre: "playa", ancho: 256, alto: 46, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        // El mar: más hondo a lo lejos, turquesa cerca de la orilla
        const mar = ["#2e9ed6", "#38b4dc", "#46c8dc", "#62d8da", "#86e6dc"];
        for (let y = 0; y < 26; y++) {
          for (let x = 0; x < l.ancho; x++) l.poner(x, y, mar[Math.max(0, Math.min(4, Math.floor((y / 26) * 4.6 + umbral(x, y) - 0.5)))]);
        }
        rect(l, 0, 0, l.ancho, 1, "#bfe8f8");
        for (let i = 0; i < 30; i++) rect(l, Math.floor(azar() * l.ancho), 2 + Math.floor(azar() * 20), 3, 1, "#bff0f4", 0.7);
        // La arena (mojada junto al agua)
        suelo(l, 26, ["#f8e8bc", "#f4dfac", "#efd49c"], 1);
        rect(l, 0, 26, l.ancho, 2, "#ecd8a4");
        for (let i = 0; i < 50; i++) l.poner(Math.floor(azar() * l.ancho), 29 + Math.floor(azar() * 17), i % 2 ? "#fff6dc" : "#dcc08a");
        // Conchas y una estrella de mar (pequeñas: que se repitan no se nota)
        for (const x of [24, 98, 226]) mapa(l, x, 38 + (x % 5), [".aa.", "abba"], { a: "#ffe0e8", b: "#f0b0c0" }, 1);
        mapa(l, 168, 41, ["..a..", "aaaaa", ".aaa.", "a...a"], { a: "#ff8a3a" }, 1);
      }
    }]
  },

  globos: {
    comentario: "Globos aerostáticos: cinco globos de gajos que suben y bajan sobre un mar de nubes que pasa (las de cerca, más deprisa), un trozo de arcoíris que sale de las nubes y una bandada a lo lejos",
    cielo: "linear-gradient(to bottom, #7cc2f4, #b4dcfa 45%, #fbe4dc 85%, #ffd8c4)",
    animacion: [
      { nombre: "viento", eje: "x", duracion: 48, pasos: 512, mueve: { "nubes-cerca": [-512, 0], "nubes-medio": [-256, 0], "nubes-lejos": [-128, 0], bandada: [256, 0] } },
      {
        nombre: "flota", eje: "y", duracion: 6, paradas: repartidos(16),
        mueve: {
          "globo-grande": (t) => [0, Math.sin(2 * Math.PI * t) * 3],
          "globo-chico": (t) => [0, Math.sin(2 * Math.PI * (t + 0.35)) * 2],
          "globo-lejos": (t) => [0, Math.cos(2 * Math.PI * t) * 1.5],
          "globo-rosa": (t) => [0, Math.sin(2 * Math.PI * (t + 0.6)) * 2.5],
          "globo-morado": (t) => [0, Math.cos(2 * Math.PI * (t + 0.2)) * 2]
        }
      }
    ],
    capas: [{
      nombre: "bandada", ancho: 256, alto: 16, repetir: "x", sitio: { y: 10, desde: "arriba" },
      pintar(l) {
        for (const [x, y] of [[140, 6], [146, 3], [146, 9], [152, 1], [152, 11]]) mapa(l, x, y, ["k.k", ".k."], { k: "#5a6a88" }, 0.65);
      }
    }, {
      nombre: "globo-grande", ancho: 28, alto: 36, repetir: "no", sitio: { x: 70, lado: "centro", y: 4, desde: "arriba" },
      pintar(l) { globo(l, 14, 1, 11, ["#ff5a5a", "#c83a3a", "#ffd23a", "#e0a020"]); }
    }, {
      nombre: "globo-chico", ancho: 16, alto: 22, repetir: "no", sitio: { x: 125, lado: "centro", y: 26, desde: "arriba" },
      pintar(l) { globo(l, 8, 1, 6, ["#4aa8ff", "#2a78d0", "#ffffff", "#c8dcf0"]); }
    }, {
      nombre: "globo-rosa", ancho: 20, alto: 28, repetir: "no", sitio: { x: -60, lado: "centro", y: 22, desde: "arriba" },
      pintar(l) { globo(l, 10, 1, 8, ["#ff8ac0", "#e05a98", "#ffffff", "#f0d4e4"]); }
    }, {
      nombre: "globo-morado", ancho: 14, alto: 19, repetir: "no", sitio: { x: 20, lado: "centro", y: 6, desde: "arriba" },
      pintar(l) { globo(l, 7, 1, 5, ["#a07aff", "#7050d0", "#ffe066", "#d8b040"], 0.9); }
    }, {
      nombre: "nubes-cerca", ancho: 256, alto: 30, repetir: "x", sitio: { y: 0, desde: "abajo" },
      pintar(l, azar) {
        for (let x = 0; x < l.ancho; x += 26) nubeEsponjosa(l, x + Math.floor(azar() * 6), 20, 11 + Math.floor(azar() * 4), ["#ffffff", "#fbf6fa", "#e8deea"]);
        rect(l, 0, 22, l.ancho, 8, "#f6eef4");
        for (let x = 0; x < l.ancho; x++) if (umbral(x, 22) < 0.5) l.poner(x, 22, "#e8deea");
      }
    }, {
      nombre: "nubes-medio", ancho: 256, alto: 36, repetir: "x", sitio: { y: 10, desde: "abajo" },
      pintar(l, azar) {
        for (let x = 10; x < l.ancho; x += 30) nubeEsponjosa(l, x + Math.floor(azar() * 8), 24, 9 + Math.floor(azar() * 4), ["#fff6f0", "#f6e6ea", "#e4d0dc"]);
        rect(l, 0, 26, l.ancho, 10, "#efdfe6");
      }
    }, {
      nombre: "globo-lejos", ancho: 12, alto: 15, repetir: "no", sitio: { x: -18, lado: "centro", y: 24, desde: "arriba" },
      pintar(l) { globo(l, 6, 1, 4, ["#7ad05a", "#4a983a", "#ffe066", "#d8b040"], 0.8); }
    }, {
      nombre: "nubes-lejos", ancho: 128, alto: 28, repetir: "x", sitio: { y: 22, desde: "abajo" },
      pintar(l, azar) {
        for (let x = 4; x < l.ancho; x += 22) nubeEsponjosa(l, x + Math.floor(azar() * 6), 18, 6 + Math.floor(azar() * 3), ["#fbeee8", "#f0dce0", "#e0ccd8"], 0.9);
        rect(l, 0, 20, l.ancho, 8, "#ead8e0", 0.9);
      }
    }, {
      nombre: "arcoiris", ancho: 130, alto: 90, repetir: "no", sitio: { x: -20, lado: "centro", y: 14, desde: "abajo" },
      pintar(l) {
        // Un trozo de un arco muy grande: sale de las nubes por la izquierda y sube hasta salirse por arriba
        const bandas = ["#ff8a8a", "#ffc27a", "#ffe98a", "#9ae29a", "#8ac4ff", "#c2a2ff"];
        for (let y = 0; y < l.alto; y++) {
          for (let x = 0; x < l.ancho; x++) {
            const d = Math.sqrt((x - 140) ** 2 + (y - 124) ** 2);
            const banda = Math.floor((128 - d) / 4);
            if (banda >= 0 && banda < 6) l.poner(x, y, bandas[banda], umbral(x, y) < 0.15 ? 0.4 : 0.55);
          }
        }
      }
    }]
  },

  centro: (() => {
    // Estampado, no una sala: rosa con Poké Balls y cruces, franjas del Centro arriba y abajo,
    // macetas y pociones en las esquinas y, a la derecha del centro (a la izquierda va la foto), la
    // enfermera tras un trozo de mostrador con la máquina que cura, y la Poké Ball grande detrás
    const CENTRO = 40;
    const maquinas = Array.from({ length: 8 }, (_, cuadro) => ({
      nombre: `maquina-${cuadro}`, ancho: 40, alto: 16, repetir: "no", recortar: true, sitio: { x: CENTRO + 22, lado: "centro", y: 19, desde: "abajo" },
      pintar(l) { maquinaCuracion(l, 4 - 64, cuadro); }
    }));
    return {
      comentario: "Centro Pokémon: un diseño para la tarjeta: rosa con Poké Balls y cruces, las franjas del Centro arriba y abajo, macetas y pociones en las esquinas y, a la derecha del centro, la enfermera tras el mostrador con la máquina que va cargando las seis Poké Balls y las hace brillar, y media Poké Ball grande detrás",
      cielo: "linear-gradient(160deg, #fff3f6, #ffe2ea 55%, #ffd4e0)",
      animacion: [turnos(8, [{ capas: maquinas, pasos: CURACION }])],
      capas: [...maquinas, {
        // Encima de la franja de abajo (no la tapa) y bajo: la enfermera, de cintura para arriba
        nombre: "mostrador", ancho: 120, alto: 40, repetir: "no", sitio: { x: CENTRO, lado: "centro", y: 6, desde: "abajo" },
        pintar(l) {
          enfermera(l, 48, 2);
          rect(l, 6, 26, 108, 1, "#ff9aac");
          rect(l, 6, 27, 108, 2, "#ee5a72");
          rect(l, 6, 29, 108, 1, "#c83c56");
          rect(l, 7, 30, 106, 10, "#fbf7fa");
          for (let x = 26; x < 113; x += 20) rect(l, x, 30, 1, 10, "#e6dce4");
          rect(l, 7, 34, 106, 2, "#ee5a72");
          rect(l, 7, 30, 1, 10, "#e6dce4");
          rect(l, 112, 30, 1, 10, "#d8ccd6");
        }
      }, {
        nombre: "pokeball", ancho: 56, alto: 36, repetir: "no", sitio: { x: CENTRO - 12, lado: "centro", y: 5, desde: "arriba" },
        pintar(l) {
          const [cx, cy, r] = [28, 10, 24];
          for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
              const d = Math.sqrt(x * x + y * y);
              if (d > r + 0.3 || cy + y < 0) continue;
              let c = y < 0 ? (x + y < -r * 0.75 ? "#ff94a6" : x > r * 0.45 ? "#d84c62" : "#f06478") : x > r * 0.4 && umbral(cx + x, cy + y) < (x / r - 0.4) * 2 ? "#f6e4ec" : "#fffafc";
              if (d > r - 1.2 || Math.abs(y) <= 2) c = "#b8405a";
              l.poner(cx + x, cy + y, c);
            }
          }
          disco(l, cx, cy, 7, "#b8405a");
          disco(l, cx, cy, 5, "#fffafc");
          disco(l, cx, cy, 3, "#f6e4ec");
          l.poner(cx - 2, cy - 2, "#ffffff");
        }
      },
      ...esquinas(60, 40, (l, azar, abajo) => {
        if (abajo) {
          maceta(l, l.ancho - 12, l.alto - 4);
          pocion(l, l.ancho - 26, l.alto - 4, "#a050d0");
          pocion(l, l.ancho - 33, l.alto - 4, "#3a9ae8");
          return;
        }
        // Un letrero redondo con la cruz
        disco(l, l.ancho - 16, 18, 8, "#c83c56");
        disco(l, l.ancho - 16, 18, 7, "#ee5a72");
        rect(l, l.ancho - 17, 13, 3, 11, "#ffffff");
        rect(l, l.ancho - 21, 17, 11, 3, "#ffffff");
        l.poner(l.ancho - 20, 13, "#ff9aac");
      }), {
        // Colgando de la franja de arriba, de vez en cuando (a distancias distintas): Poké Balls,
        // corazones y cruces
        nombre: "colgantes", ancho: 512, alto: 16, repetir: "x", sitio: { y: 5, desde: "arriba" },
        pintar(l, azar) {
          for (let x = 14 + Math.floor(azar() * 20); x < l.ancho - 10; x += 34 + Math.floor(azar() * 60)) {
            const largo = 2 + Math.floor(azar() * 6);
            for (let y = 0; y < largo; y++) l.poner(x, y, "#d8a0b0");
            const que = Math.floor(azar() * 3);
            if (que === 0) mapa(l, x - 2, largo, [".rrr.", "rrrrr", "kkwkk", "wwwww", ".www."], { r: "#f06478", k: "#b8405a", w: "#ffffff" }, 1);
            else if (que === 1) mapa(l, x - 2, largo, [".a.a.", "aaaaa", "aaaaa", ".aaa.", "..a.."], { a: "#ff7a96" }, 1);
            else mapa(l, x - 2, largo, ["..a..", "..a..", "aaaaa", "..a..", "..a.."], { a: "#ffffff" }, 1);
          }
        }
      }, {
        // Sobre la franja de abajo, de vez en cuando: Poké Balls y pociones
        nombre: "objetos", ancho: 512, alto: 14, repetir: "x", sitio: { y: 5, desde: "abajo" },
        pintar(l, azar) {
          for (let x = 30 + Math.floor(azar() * 30); x < l.ancho - 10; x += 40 + Math.floor(azar() * 70)) {
            if (azar() < 0.5) mapa(l, x - 2, l.alto - 5, [".rrr.", "rrrrr", "kkwkk", "wwwww", ".www."], { r: "#e83848", k: "#3a3040", w: "#ffffff" }, 1);
            else pocion(l, x, l.alto, ["#a050d0", "#3a9ae8", "#ffb030"][Math.floor(azar() * 3)]);
          }
        }
      }, {
        // Por el medio, sueltos y medio transparentes: Poké Balls, cruces y corazones más grandes
        nombre: "motivos", ancho: 384, alto: 96, repetir: "xy", sitio: { x: 50, y: 18, desde: "arriba" },
        pintar(l, azar) {
          for (const [x, y, que] of [[30, 20, 0], [120, 60, 1], [210, 14, 2], [300, 52, 0], [350, 86, 1], [80, 84, 2]]) {
            if (que === 0) mapa(l, x, y, ["..rrr..", ".rrrrr.", "rrrrrrr", "kkkwkkk", "wwwwwww", ".wwwww.", "..www.."], { r: "#f06478", k: "#b8405a", w: "#ffffff" }, 0.35);
            else if (que === 1) mapa(l, x, y, ["..w..", "..w..", "wwwww", "..w..", "..w.."], { w: "#ffffff" }, 0.6);
            else mapa(l, x, y, [".aa.aa.", "aaaaaaa", "aaaaaaa", ".aaaaa.", "..aaa..", "...a..."], { a: "#ff8aa4" }, 0.4);
          }
          for (let i = 0; i < 8; i++) l.poner(Math.floor(azar() * l.ancho), Math.floor(azar() * l.alto), "#ffffff", 0.6);
        }
      }, {
        nombre: "franja-arriba", ancho: 16, alto: 6, repetir: "x", sitio: { y: 0, desde: "arriba" },
        pintar(l) { franjaDelCentro(l); }
      }, {
        nombre: "franja-abajo", ancho: 16, alto: 6, repetir: "x", sitio: { y: 0, desde: "abajo" },
        pintar(l) { franjaDelCentro(espejado(l, false, true)); }
      }, {
        nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" },
        pintar(l) {
          mapa(l, 5, 5, [".rrr.", "rrrrr", "kkwkk", "wwwww", ".www."], { r: "#f06478", k: "#b8405a", w: "#ffffff" }, 0.4);
          mapa(l, 20, 20, [".w.", "www", ".w."], { w: "#ffffff" }, 0.7);
          l.poner(21, 6, "#ffffff", 0.5);
          l.poner(6, 22, "#f6a8bc", 0.6);
        }
      }]
    };
  })()
};

// ---------- Los de Eevee ----------
//
// Los que dan los logros de registrar a Eevee y a cada Eeveelution (js/comun/fondos.js,
// FONDOS_EEVEE). Estampados (ver eeveeEstampado, más abajo): su color, su estampado, bandas arriba y
// abajo y cosas suyas que suben o caen (el Pokémon en sí no sale).



// Una nube esponjosa: bultos de tamaños distintos con la base plana (más grandes hacia el medio),
// la luz arriba a la izquierda y la sombra abajo
function nubeEsponjosa(l, cx, base, ancho, [claro, medio, sombra], a = 1, semilla = cx * 7 + base) {
  const azar = azarFijo(`nube-${semilla}`);
  const bolas = [];
  for (let k = -ancho + 2; k <= ancho - 2; k += 3 + Math.floor(azar() * 3)) {
    const centro = 1 - Math.abs(k) / ancho;
    const r = Math.max(2, Math.round(2 + centro * ancho * 0.42 + azar() * 3));
    bolas.push([cx + k, base - r + 2, r]);
  }
  for (const [x, y, r] of bolas) disco(l, x, y, r, sombra, a);
  for (const [x, y, r] of bolas) disco(l, x - 1, y - 1, r - 1, medio, a);
  for (const [x, y, r] of bolas) if (r > 3) disco(l, x - 2, y - 2, r - 3, claro, a);
  for (let x = cx - ancho; x <= cx + ancho; x++) {
    l.poner(x, base + 1, sombra, a);
    l.poner(x, base, umbral(x, base) < 0.5 ? sombra : medio, a);
  }
}

// Un destello de cuatro puntas (grande: con las puntas largas)
function destello(l, x, y, [color, centro], grande = false, a = 1) {
  mapa(l, x - (grande ? 2 : 1), y - (grande ? 2 : 1), grande
    ? ["..a..", "..a..", "aabaa", "..a..", "..a.."]
    : [".a.", "aba", ".a."], { a: color, b: centro }, a);
}

// Un fondo de Eevee como estampado: el fondo de su color con un estampado de su tema, una banda arriba y
// otra abajo con su motivo (dibujada para la de arriba; la de abajo es la misma dada la vuelta), cosas
// suyas que suben o caen sin parar (burbujas, brasas, hojas...) (ni el Pokémon ni símbolos: solo su color y sus cosas).
const BANDA_EEVEE = 10;
function eeveeEstampado({ comentario, cielo, estampado, banda, particula, sube = true }) {
  return {
    comentario,
    cielo,
    animacion: { duracion: 16, pasos: 128, mueve: { particulas: [0, sube ? -256 : 256] } },
    capas: [
      { nombre: "banda-arriba", archivo: "banda", ancho: 256, alto: BANDA_EEVEE, repetir: "x", sitio: { y: 0, desde: "arriba" }, pintar: banda },
      {
        nombre: "banda-abajo", ancho: 256, alto: BANDA_EEVEE, repetir: "x", sitio: { y: 0, desde: "abajo" },
        pintar: (l, azar) => banda(espejado(l, false, true), azar)
      },
      { nombre: "particulas", ancho: 128, alto: 128, repetir: "xy", sitio: { x: 20, y: 0, desde: "arriba" }, pintar: particula },
      { nombre: "estampado", ancho: 32, alto: 32, repetir: "xy", sitio: { y: 0, desde: "arriba" }, pintar: estampado }
    ]
  };
}

// Unas cuantas cosas sueltas por la tesela de las partículas (dibujar(l, x, y, i))
function esparcir(l, azar, n, dibujar) {
  for (let i = 0; i < n; i++) dibujar(l, Math.floor(azar() * l.ancho), Math.floor(azar() * l.alto), i);
}

const EEVEE = {
  eevee: eeveeEstampado({
    comentario: "Eevee: crema con huellas, bandas de pelo pardo con el collar de pelusa crema, motas de pelusa que suben y Eevee",
    cielo: "linear-gradient(160deg, #fff4e2, #f8e2c6 55%, #f0cea8)",
    estampado(l) {
      for (const [x, y, color, a] of [[6, 8, "#c89a6a", 0.35], [22, 24, "#ffffff", 0.6]]) {
        rect(l, x, y + 2, 3, 2, color, a);
        for (const [dx, dy] of [[-1, 0], [1, -1], [3, 0]]) l.poner(x + dx, y + dy, color, a);
      }
    },
    banda(l, azar) {
      rect(l, 0, 0, l.ancho, 5, "#a8703a");
      rect(l, 0, 0, l.ancho, 1, "#7a4e26");
      for (let x = 0; x < l.ancho; x += 6) {
        const r = 2 + (azar() < 0.3 ? 1 : 0);
        disco(l, x + 3, 5, r, "#f6e6c8");
        l.poner(x + 2, 4, "#ffffff");
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 7, (l, x, y, i) => {
        l.poner(x, y, "#fffaf0", 0.9);
        if (i % 2) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) l.poner(x + dx, y + dy, "#f6e6c8", 0.6);
      });
    }
  }),

  vaporeon: eeveeEstampado({
    comentario: "Vaporeon: azul agua con burbujitas, bandas de olas, burbujas que suben y Vaporeon",
    cielo: "linear-gradient(160deg, #d8f2ff, #a8dcf6 55%, #7cc4ec)",
    estampado(l) {
      for (const [x, y, r, color, a] of [[8, 8, 2, "#ffffff", 0.55], [24, 22, 1, "#3a8ac8", 0.4], [20, 6, 1, "#ffffff", 0.45]]) {
        for (let k = 0; k < 16; k++) l.poner(x + Math.round(Math.cos(k / 2.55) * r), y + Math.round(Math.sin(k / 2.55) * r), color, a);
      }
    },
    banda(l) {
      for (let x = 0; x < l.ancho; x++) {
        const y = 5 + Math.round(Math.sin((2 * Math.PI * x) / 16) * 1.6);
        for (let k = 0; k <= y; k++) l.poner(x, k, k === y ? "#ffffff" : k > y - 2 ? "#6ab4e6" : "#2a74b8");
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 6, (l, x, y, i) => pompa(l, x, y, 1 + (i % 3), 0.8));
    }
  }),

  jolteon: eeveeEstampado({
    comentario: "Jolteon: amarillo con rayitos, bandas de pelo de punta, chispas que caen y Jolteon",
    cielo: "linear-gradient(160deg, #fffbe0, #fff0a8 55%, #ffe070)",
    estampado(l) {
      for (const [x, y, color, a] of [[6, 4, "#e8a818", 0.45], [22, 20, "#ffffff", 0.7]]) {
        mapa(l, x, y, ["..a", ".a.", "aaa", ".a.", "a.."], { a: color }, a);
      }
    },
    banda(l) {
      rect(l, 0, 0, l.ancho, 3, "#f0c020");
      for (let x = 0; x < l.ancho; x += 6) {
        for (let k = 0; k < 6; k++) {
          const media = Math.round(3 * (1 - k / 6));
          for (let dx = -media; dx <= media; dx++) l.poner(x + 3 + dx, 3 + k, k > 3 ? "#ffffff" : "#f0c020");
        }
      }
      rect(l, 0, 0, l.ancho, 1, "#b88a10");
    },
    particula(l, azar) {
      esparcir(l, azar, 6, (l, x, y) => {
        destello(l, x, y, ["#fff280", "#ffffff"], false, 0.9);
        l.poner(x + 2, y + 2, "#ffe040", 0.8);
      });
    },
    sube: false
  }),

  flareon: eeveeEstampado({
    comentario: "Flareon: naranja con llamitas, bandas de llamas, brasas que suben y Flareon",
    cielo: "linear-gradient(160deg, #fff0e0, #ffd4b0 55%, #ffb888)",
    estampado(l) {
      for (const [x, y, color, a] of [[6, 6, "#e8642a", 0.4], [22, 22, "#ffd23a", 0.55]]) {
        mapa(l, x, y, [".a.", ".aa", "aaa", "aba", ".a."], { a: color, b: "#fff4c0" }, a);
      }
    },
    banda(l) {
      rect(l, 0, 0, l.ancho, 4, "#d8481e");
      for (let x = 0; x < l.ancho; x++) {
        const largo = 4 + Math.round(Math.abs(Math.sin((Math.PI * x) / 8)) * 4 + Math.sin(x / 3) * 0.8);
        for (let k = 4; k < Math.min(BANDA_EEVEE, largo + 2); k++) l.poner(x, k, k > largo ? "#ffe066" : k > largo - 2 ? "#ffa030" : "#f06a2a");
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 8, (l, x, y, i) => {
        l.poner(x, y, i % 2 ? "#ffd23a" : "#ff7a2a", 0.9);
        if (i % 3 === 0) l.poner(x, y + 1, "#ff9a3a", 0.6);
      });
    }
  }),

  espeon: eeveeEstampado({
    comentario: "Espeon: lila con gemas y estrellitas, bandas con la gema roja, motas psíquicas que suben y Espeon",
    cielo: "linear-gradient(160deg, #f8ecff, #e6ccf6 55%, #d2acea)",
    estampado(l) {
      mapa(l, 6, 6, [".a.", "aba", ".a."], { a: "#e8283a", b: "#ff9aa6" }, 0.5);
      estrellita(l, 22, 22, 1, "#ffffff", 0.7);
      l.poner(22, 6, "#b07ae0", 0.5);
    },
    banda(l, azar) {
      rect(l, 0, 0, l.ancho, 4, "#b07ae0");
      rect(l, 0, 4, l.ancho, 1, "#8a52c0");
      for (let x = 0; x < l.ancho; x += 2) l.poner(x, 6, "#c89ae8");
      for (let x = 8; x < l.ancho; x += 16 + (azar() < 0.3 ? 8 : 0)) {
        mapa(l, x - 2, 1, ["..a..", ".aba.", "aabaa", ".aaa.", "..a.."], { a: "#e8283a", b: "#ffb0b8" }, 1);
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 6, (l, x, y, i) => (i % 2 ? estrellita(l, x, y, 1, "#ffffff", 0.85) : l.poner(x, y, "#f0c8ff", 0.9)));
    }
  }),

  umbreon: eeveeEstampado({
    comentario: "Umbreon: azul de noche con los aros amarillos, bandas negras con aros, motas que suben como luciérnagas y Umbreon",
    cielo: "linear-gradient(160deg, #3c3c78, #2c2c5c 55%, #222248)",
    estampado(l) {
      for (const [x, y, r, a] of [[8, 8, 3, 0.5], [24, 24, 2, 0.35]]) {
        for (let k = 0; k < 24; k++) l.poner(x + Math.round(Math.cos(k / 3.8) * r), y + Math.round(Math.sin(k / 3.8) * r), "#f0c020", a);
      }
      l.poner(24, 8, "#ffffff", 0.4);
    },
    banda(l) {
      rect(l, 0, 0, l.ancho, 6, "#1a1a26");
      rect(l, 0, 6, l.ancho, 1, "#f0c020");
      for (let x = 10; x < l.ancho; x += 20) {
        for (let k = 0; k < 20; k++) l.poner(x + Math.round(Math.cos(k / 3.2) * 2.5), 3 + Math.round(Math.sin(k / 3.2) * 2), "#f0c020");
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 6, (l, x, y) => {
        brillo(l, x, y, 3, "#f0d040", 0.5, 0.5);
        l.poner(x, y, "#fff4a0", 1);
      });
    }
  }),

  leafeon: eeveeEstampado({
    comentario: "Leafeon: verde claro con hojitas, bandas de enredadera, hojas que caen y Leafeon",
    cielo: "linear-gradient(160deg, #f2fbe2, #d8f0b8 55%, #bce496)",
    estampado(l) {
      hojaOval(l, 6, 10, 5, -0.7, ["#5a9a3a", "#7cbc4a", "#c0e890"]);
      for (const [x, y] of [[22, 22], [24, 6]]) l.poner(x, y, "#ffffff", 0.5);
    },
    banda(l, azar) {
      rect(l, 0, 0, l.ancho, 3, "#4a8a2a");
      for (let x = 0; x < l.ancho; x++) l.poner(x, 3 + Math.round(Math.sin(x / 5) * 1.2), "#6a5a2a");
      for (let x = 2; x < l.ancho; x += 6 + Math.floor(azar() * 4)) {
        const y = 3 + Math.round(Math.sin(x / 5) * 1.2);
        hojaOval(l, x, y + 1, 5, Math.PI / 2 + (x % 12 < 6 ? 0.6 : -0.6), [["#3e7a2a", "#5aa03a", "#a6dc78"], ["#5a9a3a", "#7cbc4a", "#c0e890"]][x % 2]);
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 5, (l, x, y, i) => hojaOval(l, x, y, 4, i * 1.3, [["#5a9a3a", "#7cbc4a", "#c0e890"], ["#c8a020", "#e8c040", "#fff0a0"]][i % 2]));
    },
    sube: false
  }),

  glaceon: eeveeEstampado({
    comentario: "Glaceon: azul hielo con copos y rombos, bandas con carámbanos (arriba cuelgan; abajo, cristales que suben), nieve que cae y Glaceon",
    cielo: "linear-gradient(160deg, #f0fbff, #d0eef8 55%, #a8dcf0)",
    estampado(l) {
      copo(l, 8, 8, 2, 0.6);
      mapa(l, 22, 20, [".a.", "aba", ".a."], { a: "#7ac0e0", b: "#ffffff" }, 0.55);
    },
    banda(l, azar) {
      rect(l, 0, 0, l.ancho, 3, "#8ad0ec");
      rect(l, 0, 3, l.ancho, 1, "#ffffff");
      for (let x = 1; x < l.ancho; x += 3 + Math.floor(azar() * 3)) {
        const largo = 2 + Math.floor(azar() * 5);
        for (let k = 0; k < largo; k++) {
          l.poner(x, 4 + k, k === largo - 1 ? "#ffffff" : "#b8e4f6");
          if (k < largo - 2) l.poner(x + 1, 4 + k, "#7ac0e0");
        }
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 7, (l, x, y, i) => copo(l, x, y, i % 3, 0.9));
    },
    sube: false
  }),

  sylveon: eeveeEstampado({
    comentario: "Sylveon: rosa con lazos y corazones, bandas de cinta con lunares y lazos, corazones que suben y Sylveon",
    cielo: "linear-gradient(160deg, #fff2f8, #ffd8ea 55%, #f8bcd8)",
    estampado(l) {
      mapa(l, 4, 6, ["a...a", "aabaa", "a...a"], { a: "#f07aa8", b: "#5ab0e8" }, 0.5);
      mapa(l, 20, 20, [".a.a.", "aaaaa", ".aaa.", "..a.."], { a: "#ffffff" }, 0.7);
    },
    banda(l, azar) {
      rect(l, 0, 0, l.ancho, 6, "#f490bc");
      rect(l, 0, 6, l.ancho, 1, "#d8608e");
      for (let x = 2; x < l.ancho; x += 5) l.poner(x, 2 + ((x / 5) % 2) * 2, "#ffffff");
      for (let x = 20; x < l.ancho; x += 40 + Math.floor(azar() * 20)) {
        mapa(l, x - 4, 1, ["aa...aa", "abaaaba", "aaacaaa", "abaaaba", "aa...aa"], { a: "#ffffff", b: "#5ab0e8", c: "#5ab0e8" }, 1);
      }
    },
    particula(l, azar) {
      esparcir(l, azar, 5, (l, x, y, i) => mapa(l, x, y, [".a.a.", "aaaaa", ".aaa.", "..a.."], { a: i % 2 ? "#ff8ab8" : "#ffffff" }, 0.9));
    }
  })
};

// ---------- Las regiones ----------
//
// Las que dan los logros de completar cada generación en la colección de «Juegos» (FONDOS_REGION,
// js/comun/fondos.js). Todas con el mismo formato, sencillo, como una página del Pasaporte de
// Entrenador de Sol y Luna:
//   · el papel: un degradado suave entre los colores de los legendarios;
//   · una banda pegada al borde de arriba y otra al de abajo (en todos los sitios), con un dibujo
//     que es de esa región (Poké Balls en Kanto, hojas de arce en Johto, olas en Hoenn...);
//   · sus legendarios de carátula (los sellos de herramientas/sellos-pixel.mjs, de una tinta), grandes
//     (a la escala del fondo, como todo lo demás), a la derecha del centro (a la izquierda va la foto)
//     y asomando medio cuerpo desde abajo, por detrás de las bandas.

const ALTO_BANDA = 8;

// Una banda, fina (a un píxel de pantalla por píxel: 8 px en todas partes) y pegada a su borde: el
// fondo, una raya a cada lado y el dibujo de la región entre medias (filas 1 a 6)
function banda(nombre, dibujar, { fondo, raya }, abajo) {
  return {
    nombre, ancho: 256, alto: ALTO_BANDA, repetir: "x", fino: true, sitio: { y: 0, desde: abajo ? "abajo" : "arriba" },
    donde: { x: "left 0", y: abajo ? "bottom 0" : "top 0", muestra: (vista, TW, TH) => [0, abajo ? TH - ALTO_BANDA : 0, 1] },
    pintar(l, azar) {
      rect(l, 0, 0, l.ancho, l.alto, fondo);
      rect(l, 0, 0, l.ancho, 1, raya);
      rect(l, 0, l.alto - 1, l.ancho, 1, raya);
      dibujar(l, azar);
    }
  };
}

// Los dibujos de las bandas (cada uno llena las filas 1 a 6 de la tira de 256)
const DIBUJOS_BANDA = {
  // Kanto: Poké Balls
  pokeballs(l) {
    for (let x = 2; x < l.ancho; x += 10) mapa(l, x, 1, [".rrrr.", "rrrrrr", "kkwwkk", "wwkkww", "wwwwww", ".wwww."], { r: "#d84a3a", k: "#3a3036", w: "#fbf6ee" });
  },
  // Johto: hojas de arce de otoño
  hojas(l) {
    const COLORES = ["#d8642a", "#c03a2a", "#e8a030"];
    for (let x = 2, i = 0; x < l.ancho; x += 8, i++) mapa(l, x, 1, ["..a..", "a.a.a", "aaaaa", ".aaa.", "..b..", "..b.."], { a: COLORES[i % 3], b: "#7a4a2a" });
  },
  // Hoenn: olas
  olas(l) {
    for (let x = 0; x < l.ancho; x++) {
      const y = 3 + Math.round(Math.sin((2 * Math.PI * x) / 16) * 1.6);
      for (let k = y; k < 7; k++) l.poner(x, k, k === y ? "#ffffff" : k < y + 2 ? "#6ab4e6" : "#3a84c8");
    }
  },
  // Sinnoh: diamantes y perlas
  diamantes(l) {
    for (let x = 1, i = 0; x < l.ancho; x += 8, i++) {
      if (i % 2) mapa(l, x, 2, [".pp.", "pPpp", "pppp", ".pp."], { p: "#e8a2c4", P: "#ffffff" });
      else mapa(l, x, 1, ["..d..", ".dDd.", "ddddd", ".ddd.", "..d.."], { d: "#5a7ad0", D: "#c8e0ff" });
    }
  },
  // Teselia: blanco y negro
  blancoNegro(l) {
    for (let x = 0; x < l.ancho; x++) {
      for (let y = 1; y < 7; y++) {
        const t = (x % 12) / 12;
        const arriba = Math.abs(t - 0.5) * 12 < y - 0.5;
        l.poner(x, y, (Math.floor(x / 12) % 2 === 0) === arriba ? "#2a2a32" : "#f6f6f8");
      }
    }
  },
  // Kalos: la celosía de la Torre Prisma, con puntos dorados en los cruces
  celosia(l) {
    for (let x = 0; x < l.ancho; x++) {
      for (let y = 1; y < 7; y++) {
        const d1 = (x + y) % 6;
        const d2 = (x - y + 600) % 6;
        if (d1 === 0 || d2 === 0) l.poner(x, y, "#6a72b8");
      }
    }
    for (let x = 3; x < l.ancho; x += 6) l.poner(x, 3, "#e8c050");
  },
  // Alola: triángulos, como los de las páginas del pasaporte
  triangulos(l) {
    for (let x = 0; x < l.ancho; x += 8) for (let k = 0; k < 4; k++) rect(l, x + k, 2 + k, 7 - k * 2, 1, (x / 8) % 2 ? "#e2d2ae" : "#d2bc90");
  },
  // Galar: tartán
  tartan(l) {
    for (let x = 0; x < l.ancho; x++) {
      for (let y = 1; y < 7; y++) {
        let c = "#b8343e";
        if (x % 12 < 3) c = "#2e4e98";
        if (y === 3 || y === 4) c = x % 12 < 3 ? "#1e2e60" : "#8e2430";
        if (x % 12 === 7 || y === 1) c = "#f2e6d8";
        l.poner(x, y, c);
      }
    }
  },
  // Paldea: azulejos (blancos con una flor azul y el centro amarillo)
  azulejos(l) {
    for (let x = 0; x < l.ancho; x += 7) {
      rect(l, x, 1, 6, 6, "#fbf6ec");
      mapa(l, x, 1, [".a..a.", "aabbaa", ".bycb.", ".bcyb.", "aabbaa", ".a..a."], { a: "#2e6ab8", b: "#5a92d8", y: "#f2c040", c: "#e8a020" });
      rect(l, x + 6, 1, 1, 6, "#c8b8a0");
    }
  }
};

// Un fondo de región: papel, bandas y los legendarios. Las bandas van delante (la de abajo les tapa
// los pies); los legendarios, en fila a la derecha del centro y metidos por abajo: se les ve de medio
// cuerpo para arriba.
// Lo que se aparta del normal cada legendario: escala (2: cada píxel del sello, 2 × 2), oculto (la parte
// de abajo que queda metida, de 0 a 1) y espejo (dado la vuelta de lado: mirando al otro lado). Para que a
// todos se les vea la cara y algo de cuerpo.
const AJUSTE_SELLO = {
  zekrom: { escala: 2.3 },
  zamazenta: { escala: 1.8 },
  lunala: { oculto: 0.3 },
  zacian: { oculto: 0.36 },
  moltres: { oculto: 0.2, espejo: true },
  zapdos: { oculto: 0.38 },
  kyogre: { oculto: 0.28 },
  hoOh: { oculto: 0.3 },
  lugia: { oculto: 0.3 }
};

// separados: los de esa región, algo más apartados entre sí (si no, se montaban demasiado)
function fondoDeSellos({ comentario, papel, sellos, dibujo, colores, separados = false }) {
  // Grandes (al doble, o lo que diga AJUSTE_SELLO). Un poco montados unos sobre otros (el sello deja
  // mucho margen alrededor del Pokémon)
  const centros = sellos.length === 3 ? [-40, 42, 124] : separados ? [-30, 118] : [-16, 104];
  const capas = sellos.map((nombre, i) => {
    const fig = sello(nombre);
    const { escala = 2, oculto = 0.45, espejo = false } = AJUSTE_SELLO[nombre] || {};
    const [ancho, alto] = [Math.round(fig.ancho * escala), Math.round(fig.alto * escala)];
    return {
      nombre: `sello-${nombre}`, ancho, alto, repetir: "no", recortar: true,
      sitio: { x: centros[i], lado: "centro", y: -Math.round(alto * oculto), desde: "abajo" },
      // Ampliado sin suavizar: cada píxel de la capa toma el del sello que le cae debajo
      pintar(l) {
        for (let y = 0; y < alto; y++) {
          for (let x = 0; x < ancho; x++) {
            const xs = Math.floor((espejo ? ancho - 1 - x : x) / escala);
            const c = fig.pixeles[Math.floor(y / escala) * fig.ancho + xs];
            if (c) l.poner(x, y, c);
          }
        }
      }
    };
  });
  return {
    comentario,
    cielo: papel,
    capas: [banda("banda-arriba", DIBUJOS_BANDA[dibujo], colores, false), banda("banda-abajo", DIBUJOS_BANDA[dibujo], colores, true), ...capas]
  };
}

const REGIONES = {
  kanto: fondoDeSellos({
    comentario: "Kanto: Articuno, Zapdos y Moltres asomando, con bandas de Poké Balls",
    papel: "linear-gradient(105deg, #e8eef8, #f3ede6 50%, #f8e8dc)",
    sellos: ["articuno", "zapdos", "moltres"], dibujo: "pokeballs", colores: { fondo: "#f0e2d6", raya: "#c88a7a" }
  }),
  johto: fondoDeSellos({
    comentario: "Johto: Ho-Oh y Lugia asomando, con bandas de hojas de arce",
    papel: "linear-gradient(105deg, #f8e6cc, #f4ead8 50%, #e6eaf2)",
    sellos: ["hoOh", "lugia"], dibujo: "hojas", colores: { fondo: "#f2e2c6", raya: "#c89a62" }
  }),
  hoenn: fondoDeSellos({
    comentario: "Hoenn: Groudon y Kyogre asomando, con bandas de olas",
    papel: "linear-gradient(105deg, #f6e0d6, #f0ebe6 50%, #dde8f6)",
    sellos: ["groudon", "kyogre"], dibujo: "olas", colores: { fondo: "#a8d4f0", raya: "#3a84c8" }
  }),
  sinnoh: fondoDeSellos({
    comentario: "Sinnoh: Dialga y Palkia asomando, con bandas de diamantes y perlas",
    papel: "linear-gradient(105deg, #e0e6f6, #ede9f2 50%, #f4e4ee)",
    sellos: ["dialga", "palkia"], separados: true, dibujo: "diamantes", colores: { fondo: "#e6e4f2", raya: "#9a9ac8" }
  }),
  teselia: fondoDeSellos({
    comentario: "Teselia: Reshiram y Zekrom asomando, con bandas en blanco y negro",
    papel: "linear-gradient(105deg, #f4f4f6, #ebebee 50%, #dadae2)",
    sellos: ["reshiram", "zekrom"], dibujo: "blancoNegro", colores: { fondo: "#f6f6f8", raya: "#2a2a32" }
  }),
  kalos: fondoDeSellos({
    comentario: "Kalos: Xerneas e Yveltal asomando, con bandas de la celosía de la Torre Prisma",
    papel: "linear-gradient(105deg, #dfe6f6, #ebe8f0 50%, #f4e0e2)",
    sellos: ["xerneas", "yveltal"], dibujo: "celosia", colores: { fondo: "#e4e6f4", raya: "#6a72b8" }
  }),
  alola: fondoDeSellos({
    comentario: "Alola: Solgaleo y Lunala asomando, con bandas de triángulos como las del Pasaporte",
    papel: "linear-gradient(105deg, #f7e8c8, #f4e8da 50%, #e4e2f4)",
    sellos: ["solgaleo", "lunala"], separados: true, dibujo: "triangulos", colores: { fondo: "#efe0c2", raya: "#c8b080" }
  }),
  galar: fondoDeSellos({
    comentario: "Galar: Zacian y Zamazenta asomando, con bandas de tartán",
    papel: "linear-gradient(105deg, #dfe6f6, #ebe8ee 50%, #f4e0e0)",
    sellos: ["zacian", "zamazenta"], dibujo: "tartan", colores: { fondo: "#b8343e", raya: "#5a1a20" }
  }),
  paldea: fondoDeSellos({
    comentario: "Paldea: Koraidon y Miraidon asomando, con bandas de azulejos",
    papel: "linear-gradient(105deg, #f6e0da, #f2e9e6 50%, #e4e0f6)",
    sellos: ["koraidon", "miraidon"], dibujo: "azulejos", colores: { fondo: "#fbf6ec", raya: "#2e6ab8" }
  })
};

// ---------- Los de metal ----------
//
// Los que dan los logros de conseguir 25, 50 y todos los logros (FONDOS_METAL, js/comun/fondos.js):
// fondos lisos de su metal, sin dibujos. Solo la superficie (su color, su textura y sus reflejos) y
// el brillo que la cruza de vez en cuando, como una luz que pasa por encima; el oro y el platino,
// además, con destellos que titilan. Cuanto más alto el logro, más luce.

// Una tesela que se repite a lo ancho y a lo alto, desde arriba a la izquierda
const tesela = (nombre, ancho, alto, pintar) => ({ nombre, ancho, alto, repetir: "xy", sitio: { y: 0, desde: "arriba" }, pintar });

// La chapa cepillada: rayitas largas y claras a lo largo, muy suaves
function cepillado(l, azar, color, a, n) {
  for (let i = 0; i < n; i++) {
    const [x, y, largo] = [Math.floor(azar() * l.ancho), Math.floor(azar() * l.alto), 10 + Math.floor(azar() * 40)];
    for (let k = 0; k < largo; k++) l.poner(x + k, y, color, a);
  }
}

// Puntitos en dos rejillas cruzadas (una a medio paso de la otra), como un tejido fino
function puntitos(l, color, a, paso) {
  for (let y = 0; y < l.alto; y += paso / 2) {
    for (let x = (y / (paso / 2)) % 2 ? paso / 2 : 0; x < l.ancho; x += paso) l.poner(x, y, color, a);
  }
}

// Facetas grandes, como las de una gema tallada: triángulos de tonos un poco distintos, con las
// aristas claras. Tesela de 128 × 64 (casa al repetirse)
function facetas(l, azar) {
  const [w, h] = [32, 16];
  const luces = Array.from({ length: 64 }, () => Math.floor(azar() * 4));
  for (let y = 0; y < l.alto; y++) {
    const fila = Math.floor(y / h);
    const v = (y % h) / h;
    for (let x = 0; x < l.ancho; x++) {
      const xx = x + (fila % 2 ? w / 2 : 0);
      const celda = Math.floor(xx / w);
      const f = (xx % w) / w;
      const sube = Math.abs(f - 0.5) <= v / 2;
      const cual = (fila % 4) * 16 + ((celda * 2 + (sube ? 0 : f < 0.5 ? -1 : 1) + 16) % 8);
      const arista = y % h === 0 || Math.abs(Math.abs(f - 0.5) - v / 2) * w < 0.55;
      if (arista) l.poner(x, y, "#ffffff", 0.32);
      else if (luces[cual]) l.poner(x, y, luces[cual] === 3 ? "#8a90c0" : "#ffffff", luces[cual] === 3 ? 0.07 : luces[cual] * 0.08);
    }
  }
}

// Destellos sueltos por la chapa: cada dibujo, la mitad de ellos (k: cuál), para que se turnen
function destellosSueltos(l, azar, k, colores, n) {
  for (let i = 0; i < n; i++) {
    const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * l.alto)];
    const color = colores[i % colores.length];
    if (i % 2 === k) destello(l, x, y, [color, "#ffffff"], i % 5 === 0);
  }
}

// El brillo que cruza la chapa: una franja ancha y otra fina, inclinadas, con trama en los bordes,
// en una tira de 512 que se desliza a lo ancho (como hay una sola franja en 512 píxeles, después
// de pasar tarda en volver). colores: el del centro y, si se dan, los de los bordes (el platino los
// abre en los colores del arcoíris)
const ANCHO_BRILLO = 512;
function brilloQuePasa(nombre, color, a, bordes = null) {
  return {
    nombre, ancho: ANCHO_BRILLO, alto: 320, repetir: "x", sitio: { y: 0, desde: "arriba" },
    pintar(l) {
      for (let y = 0; y < l.alto; y++) {
        for (let x = 0; x < l.ancho; x++) {
          // La franja sube hacia la derecha («/»): en la fila y, su centro está más a la izquierda
          const d = ((((x - (110 - y * 0.55)) % ANCHO_BRILLO) + ANCHO_BRILLO * 1.5) % ANCHO_BRILLO) - ANCHO_BRILLO / 2; // da la vuelta
          for (const [centro, ancho] of [[0, 18], [17, 5]]) {
            const t = (d - centro) / (ancho / 2); // de -1 a 1 dentro de la franja
            const fuerza = 1 - Math.abs(t);
            if (fuerza <= 0 || umbral(x, y) >= fuerza * 1.7) continue;
            let c = color;
            if (bordes && Math.abs(t) > 0.3) c = bordes[Math.min(bordes.length - 1, Math.floor(((t + 1) / 2) * bordes.length))];
            l.poner(x, y, c, a);
          }
        }
      }
    }
  };
}

// La animación del brillo: la tira de 512 se desliza entera en una vuelta (suave, sin saltos)
const pasaElBrillo = (nombre, duracion) => ({ nombre: "brillo", eje: "x", duracion, mueve: { [nombre]: [ANCHO_BRILLO, 0] } });

// El reflejo quieto de la chapa: una franja ancha y suave en diagonal (sin píxeles: va encima del color)
const REFLEJO = (color) => `linear-gradient(115deg, transparent 18%, ${color} 34%, transparent 50%, transparent 62%, ${color} 68%, transparent 74%)`;

const METAL = {
  plata: {
    comentario: "Plata: una chapa de plata cepillada, con un reflejo en diagonal y un brillo que la cruza de vez en cuando",
    cielo: "linear-gradient(160deg, #e6ebf2, #c3cad7 48%, #a2abbd)",
    tinte: [REFLEJO("rgba(255, 255, 255, 0.38)")],
    capas: [
      brilloQuePasa("brillo", "#ffffff", 0.55),
      tesela("cepillado", 128, 64, (l, azar) => cepillado(l, azar, "#f7f9fc", 0.35, 22))
    ],
    animacion: pasaElBrillo("brillo", 9)
  },
  oro: (() => {
    const destellos = [0, 1].map((k) => tesela(`destellos-${k}`, 128, 96, (l) => destellosSueltos(l, azarFijo("destellos-oro"), k, ["#fff6c8"], 12)));
    return {
      comentario: "Oro: una chapa de oro con puntitos, un reflejo en diagonal, un brillo que la cruza de vez en cuando y destellos que titilan",
      cielo: "linear-gradient(160deg, #f8d466, #e6a92e 48%, #c27e1c)",
      tinte: [REFLEJO("rgba(255, 244, 196, 0.32)")],
      capas: [
        ...destellos,
        brilloQuePasa("brillo", "#fff8dc", 0.55),
        tesela("puntitos", 16, 16, (l) => puntitos(l, "#fff0a0", 0.5, 8))
      ],
      animacion: [pasaElBrillo("brillo", 8), turnos(8, [{ capas: destellos, pasos: ciclo(8, 2) }])]
    };
  })(),
  platino: (() => {
    const destellos = [0, 1].map((k) => tesela(`destellos-${k}`, 128, 96, (l) => destellosSueltos(l, azarFijo("destellos-platino"), k, ["#ff9ec0", "#8ad8ff", "#ffe27a", "#c6a8ff"], 14)));
    return {
      comentario: "Platino: una chapa nacarada con facetas de gema, un brillo con los bordes de arcoíris que la cruza de vez en cuando y destellos de colores que titilan",
      cielo: "linear-gradient(160deg, #f6f2fb, #e0e0f0 45%, #c6c9e0)",
      tinte: ["linear-gradient(115deg, rgba(255, 190, 220, 0.22), rgba(190, 236, 255, 0.18) 50%, rgba(255, 236, 170, 0.2))"],
      capas: [
        ...destellos,
        brilloQuePasa("brillo", "#ffffff", 0.6, ["#ff8fb0", "#ffd27a", "#ffffff", "#7ad6f0", "#a890f0"]),
        tesela("facetas", 128, 64, facetas)
      ],
      animacion: [pasaElBrillo("brillo", 7), turnos(8, [{ capas: destellos, pasos: ciclo(8, 2) }])]
    };
  })()
};

// ---------- A pintar ----------
//
// Todos los fondos en una lista: { id (el de js/comun/fondos.js), comentario, cielo (opaco),
// tinte (opcional, encima del cielo), capas, animacion }. Los archivos: <grupo>-<id>-<capa>.png

// Los de metal se llaman como siempre (plata, oro, platino: es lo que guarda el perfil), sin el grupo
const deGrupo = (grupo, lista, conGrupo = true) => Object.entries(lista).map(([id, fondo]) => ({
  ...fondo,
  id: conGrupo ? `${grupo}-${id}` : id,
  cielo: fondo.cielo || (fondo.cieloDeDia ? CIELO_DE_DIA : null),
  capas: [...fondo.capas, ...(fondo.cieloDeDia ? [NUBES_DE_DIA] : [])]
    .map((capa) => ({ ...capa, archivo: `${grupo}-${id}-${capa.archivo || capa.nombre}` }))
}));

const FONDOS = [...deGrupo("metal", METAL, false), ...deGrupo("region", REGIONES), ...deGrupo("eevee", EEVEE), ...deGrupo("tienda", TIENDA)];
for (const fondo of FONDOS) if (!fondo.cielo) throw new Error(`${fondo.id}: le falta el cielo`);

// Cada capa, pintada una vez (dos capas pueden usar el mismo dibujo: las bombillas del casino)
const dibujos = new Map();
for (const fondo of FONDOS) {
  for (const capa of fondo.capas) {
    if (!capa.pintar) continue;
    const l = lienzo(capa.ancho, capa.alto, capa.repetir === "xy" || capa.repetir === "y", !capa.recortar && capa.repetir !== "y");
    capa.pintar(l, azarFijo(capa.archivo));
    dibujos.set(capa.archivo, l.datos);
    writeFileSync(join(CARPETA, `${capa.archivo}.png`), png(capa.ancho, capa.alto, l.datos));
  }
}
console.log(`${dibujos.size} dibujos en ${CARPETA}`);
for (const archivo of readdirSync(CARPETA)) {
  const [, nombre] = /^((?:metal|region|eevee|tienda)-.*)\.png$/.exec(archivo) || [];
  if (nombre && !dibujos.has(nombre)) {
    unlinkSync(join(CARPETA, archivo));
    console.log(`Ya no se usa: ${archivo} (borrado)`);
  }
}

// ---------- El CSS ----------

// Cada imagen lleva detrás una huella de su contenido (?v=...): las imágenes se guardan un día en el
// navegador (_headers), así que al retocar una cambia su dirección y todos ven la nueva al momento.
const huellas = new Map();
const huella = (archivo) => {
  if (!huellas.has(archivo)) huellas.set(archivo, createHash("sha1").update(readFileSync(join(CARPETA, `${archivo}.png`))).digest("hex").slice(0, 8));
  return huellas.get(archivo);
};

const QUIEN = ":is(.ficha-jugador, .perfil-fondo, .perfil-cabeza, .logro-premio, .tienda-muestra, .lleva-fondo)";
const px = (n) => (n === 0 ? "0" : `calc(${Math.round(n * 100) / 100} * var(--px))`);
const REPETIR = { x: "repeat-x", y: "repeat-y", xy: "repeat", no: "no-repeat" };

// Las animaciones de un fondo («animacion»: una o una lista). Cada una con su duración, cómo avanza
// (pasos: a saltos iguales; si no, en línea entre sus paradas) y el eje que mueve ("x", "y" o, si no
// lo dice, los dos). Con dos (una en "x" y otra en "y") cada eje lleva su ritmo: los fantasmas van
// de lado despacio mientras suben y bajan más deprisa. Lo que desplaza a cada capa es su «mueve» o,
// si la animación trae el suyo, el de ahí (por el nombre de la capa).
const animacionesDe = (fondo) => (fondo.animacion ? [].concat(fondo.animacion) : []);

// Lo que va debajo de las capas: los tintes, si los hay, y el cielo (opaco, el último)
const debajoDe = (fondo) => [...(fondo.tinte || []), fondo.cielo];

// Lo que se ha desplazado una capa en ese momento de la vuelta (0…1) de esa animación
function desplazado(capa, t, animacion) {
  const mueve = animacion.mueve ? animacion.mueve[capa.nombre] : capa.mueve;
  if (!mueve) return [0, 0];
  if (typeof mueve === "function") return mueve(t);
  return [mueve[0] * t, mueve[1] * t];
}

// Dónde va una capa, ya desplazada: [derecha, abajo] en píxeles del dibujo (o solo un eje)
function sitioDe(capa, [dx, dy], eje = "xy") {
  // Las finas dicen su sitio en CSS tal cual (no se mueven)
  if (capa.donde) return eje === "x" ? capa.donde.x : eje === "y" ? capa.donde.y : `${capa.donde.x} ${capa.donde.y}`;
  dy += apartadaDe(capa);
  const { x = 0, y = 0, lado = "izquierda", desde = "arriba" } = capa.sitio;
  // lado "centro": centrada (x, lo que se aparta del centro hacia la derecha)
  // (sin «+ 0»: calc(50% + 0) no vale, y entonces el navegador tira la posición de todas las capas)
  const centrada = Math.round((x + dx) * 100) === 0 ? "left 50%" : `left calc(50% + ${px(x + dx)})`;
  const horizontal = lado === "derecha" ? `right ${px(x - dx)}` : lado === "centro" ? centrada : `left ${px(x + dx)}`;
  const vertical = desde === "abajo" ? `bottom ${px(y - dy)}` : `top ${px(y + dy)}`;
  return eje === "x" ? horizontal : eje === "y" ? vertical : `${horizontal} ${vertical}`;
}

function posiciones(fondo, t, animacion = null, eje = "xy") {
  const capas = fondo.capas.map((capa) => sitioDe(capa, animacion ? desplazado(capa, t, animacion) : [0, 0], eje));
  return [...capas, ...debajoDe(fondo).map(() => (eje === "xy" ? "0 0" : "0"))].join(", ");
}

const css = [
  `/* Fondos en pixel art de la tarjeta de jugador: los de metal, de región, de Eevee y de la Tienda.
   GENERADO por herramientas/generar-fondos-pixel.mjs: no se toca a mano, se cambia allí y se
   vuelve a ejecutar. Los dibujos están en img/fondos/ (metal-*.png, region-*.png, tienda-*.png...).

   Cada píxel del dibujo mide --px: 2px en las tarjetas grandes y 1px en las muestras y franjas
   (así caben enteros). Se amplían sin suavizar, como el escenario de «Combates». Lo que se mueve
   desplaza sus capas a saltos de un píxel o cambia de dibujo de golpe. Debajo de todo, el cielo de
   cada uno, opaco: se ven igual con cualquier tema (la letra de encima, en css/amigos.css). */

.fondo-pixel {
  --px: 2px;
  /* Lo fino (los sellos de Alola): un píxel de pantalla por píxel donde --px es 2, y uno donde es 1 */
  --px-fino: max(1px, calc(var(--px) / 2));
  /* Los sellos de los fondos de región, en alto: en la tarjeta de «Amigos», junto al nombre (lo de
     abajo, a 92 px del borde, queda encima de la franja de los contadores) */
  --sello-y: calc(100% - 92px);
  image-rendering: pixelated;
}

:is(.tienda-muestra, .perfil-fondo, .logro-premio, .lleva-fondo).fondo-pixel {
  --px: 1px;
  /* Los sellos de los fondos de región: aquí, centrados entre las dos bandas */
  --sello-y: 50%;
}

/* image-rendering se hereda: que no pase a las fotos de dentro (sin especificidad, así lo que
   ya diga cada foto sigue mandando) */
:where(.fondo-pixel) * {
  image-rendering: auto;
}
`
];

for (const fondo of FONDOS) {
  const imagenes = [...fondo.capas.map((capa) => `url("../img/fondos/${capa.archivo}.png?v=${huella(capa.archivo)}")`), ...debajoDe(fondo)];
  const fino = (n) => `calc(${n} * var(--px-fino))`;
  const tamanos = [...fondo.capas.map((capa) => capa.tamano || (capa.fino ? `${fino(capa.ancho)} ${fino(capa.alto)}` : `${px(capa.ancho)} ${px(capa.alto)}`)), ...debajoDe(fondo).map(() => "auto")];
  const repetir = [...fondo.capas.map((capa) => REPETIR[capa.repetir]), ...debajoDe(fondo).map(() => "no-repeat")];
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
  // En la ficha del perfil, los que lo piden (las regiones) cambian de tamaño y de sitio
  if (fondo.vertical) {
    const dondeV = fondo.capas.map((capa) => (capa.vertical ? capa.vertical.css : sitioDe(capa, [0, 0])));
    const tamV = fondo.capas.map((capa, i) => (capa.vertical ? capa.vertical.tamano : tamanos[i]));
    css.push(`.perfil-ficha.fondo-${fondo.id} {\n  background-size: ${[...tamV, ...debajoDe(fondo).map(() => "auto")].join(", ")};\n  background-position: ${[...dondeV, ...debajoDe(fondo).map(() => "0 0")].join(", ")};\n}\n`);
  }
}

const animados = FONDOS.filter((fondo) => animacionesDe(fondo).length).map((fondo) => `.fondo-${fondo.id}`);
css.push(`@media (prefers-reduced-motion: reduce) {\n  ${QUIEN}:is(${animados.join(", ")}) {\n    animation: none;\n  }\n}\n`);
writeFileSync(ARCHIVO_CSS, css.join("\n"));
console.log(`CSS en ${ARCHIVO_CSS}`);

// ---------- La muestra ----------
//
// Cada fondo como se ve en la web, en píxeles del dibujo: la tarjeta de «Amigos» y la ficha del
// perfil (a 2 px por píxel) y la muestra de la Tienda (a 1 px). Encima, en gris, lo que lo tapa:
// la foto, el nombre y el título, la franja de los contadores, las cifras y el botón.

// Un color de CSS (#rrggbb, rgb(), rgba() o transparent) → [r, g, b, a]
function colorCss(texto) {
  texto = texto.trim();
  if (texto === "transparent") return [0, 0, 0, 0];
  if (texto.startsWith("#")) return [...rgb(texto), 1];
  const [r, g, b, a = 1] = /\(([^)]*)\)/.exec(texto)[1].split(",").map(Number);
  return [r, g, b, a];
}

// Un degradado lineal como función (x, y, ancho, alto) → [r, g, b, a]; los radiales, null (la
// muestra no los pinta)
function degradado(css) {
  const dentro = /^linear-gradient\((.*)\)$/.exec(css.trim());
  if (!dentro) return null;
  const trozos = [];
  let [nivel, actual] = [0, ""];
  for (const c of dentro[1]) {
    if (c === "(") nivel++;
    if (c === ")") nivel--;
    if (c === "," && !nivel) {
      trozos.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  trozos.push(actual.trim());
  const DIRECCIONES = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
  let angulo = 180;
  if (trozos[0] in DIRECCIONES) angulo = DIRECCIONES[trozos.shift()];
  else if (/deg$/.test(trozos[0])) angulo = parseFloat(trozos.shift());
  const paradas = trozos.map((trozo) => {
    const donde = /\s([\d.]+)%$/.exec(trozo);
    return { color: colorCss(donde ? trozo.slice(0, donde.index) : trozo), donde: donde ? Number(donde[1]) / 100 : null };
  });
  paradas[0].donde ??= 0;
  paradas[paradas.length - 1].donde ??= 1;
  paradas.forEach((parada, i) => {
    if (parada.donde !== null) return;
    const a = paradas.findLastIndex((p, k) => k < i && p.donde !== null);
    const b = paradas.findIndex((p, k) => k > i && p.donde !== null);
    parada.donde = paradas[a].donde + ((paradas[b].donde - paradas[a].donde) * (i - a)) / (b - a);
  });
  const rad = (angulo * Math.PI) / 180;
  return (x, y, ancho, alto) => {
    const largo = Math.abs(ancho * Math.sin(rad)) + Math.abs(alto * Math.cos(rad));
    const t = 0.5 + ((x - ancho / 2) * Math.sin(rad) - (y - alto / 2) * Math.cos(rad)) / largo;
    if (t <= paradas[0].donde) return paradas[0].color;
    const k = paradas.findIndex((p) => p.donde >= t);
    if (k < 0) return paradas[paradas.length - 1].color;
    const [p, q] = [paradas[k - 1], paradas[k]];
    const f = (t - p.donde) / Math.max(1e-6, q.donde - p.donde);
    return p.color.map((v, n) => v + (q.color[n] - v) * f);
  };
}

// El fondo pintado en una tarjeta de ancho × alto píxeles del dibujo, en ese momento de su animación.
// Con capas finas, la tarjeta se pinta en píxeles de pantalla (k por cada uno del dibujo; pxCss, lo
// que mide en ella un píxel del dibujo): devuelve también ese k.
function componer(fondo, TW0, TH0, momento, pxCss = 1, vista = "") {
  const k = fondo.capas.some((capa) => capa.fino) ? pxCss : 1;
  const [TW, TH] = [TW0 * k, TH0 * k];
  const tarjeta = Array.from({ length: TW * TH }, () => [0, 0, 0]);
  const mezclar = (k, color, a) => {
    const c = tarjeta[k];
    tarjeta[k] = [0, 1, 2].map((n) => color[n] * a + c[n] * (1 - a));
  };
  for (const css of [...debajoDe(fondo)].reverse()) {
    const color = degradado(css);
    if (!color) continue;
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        const [r, g, b, a] = color((tx + 0.5) / k, (ty + 0.5) / k, TW0, TH0);
        mezclar(ty * TW + tx, [r, g, b], a);
      }
    }
  }
  for (const capa of [...fondo.capas].reverse()) {
    const datos = dibujos.get(capa.archivo);
    const { x = 0, y = 0, lado = "izquierda", desde = "arriba" } = capa.sitio;
    const [dx, dy] = animacionesDe(fondo).reduce(([sx, sy], animacion) => {
      const [ax, ay] = desplazado(capa, momento, animacion);
      return [sx + (animacion.eje === "y" ? 0 : ax), sy + (animacion.eje === "x" ? 0 : ay)];
    }, [0, apartadaDe(capa)]);
    // Las finas: a un píxel de pantalla por píxel (o más, donde --px es más), en su sitio en pantalla
    if (capa.fino) {
      const [fx0, fy0, f] = capa.donde.muestra(vista, TW, TH);
      for (let ty = 0; ty < TH; ty++) {
        for (let tx = 0; tx < TW; tx++) {
          let [sx, sy] = [Math.floor((tx - fx0) / f), Math.floor((ty - fy0) / f)];
          if (capa.repetir === "x") sx = vuelta(sx, capa.ancho);
          if (sx < 0 || sy < 0 || sx >= capa.ancho || sy >= capa.alto) continue;
          const j = (sy * capa.ancho + sx) * 4;
          if (datos[j + 3]) mezclar(ty * TW + tx, [datos[j], datos[j + 1], datos[j + 2]], datos[j + 3] / 255);
        }
      }
      continue;
    }
    // Las que ocupan toda la tarjeta (el destello de la tormenta): su color, si está a la vista
    if (capa.tamano) {
      if (y + dy !== 0) continue;
      for (let k = 0; k < TW * TH; k++) mezclar(k, datos, datos[3] / 255);
      continue;
    }
    const x0 = Math.round(lado === "derecha" ? TW0 - capa.ancho - (x - dx) : lado === "centro" ? (TW0 - capa.ancho) / 2 + x + dx : x + dx);
    const y0 = Math.round(desde === "abajo" ? TH0 - capa.alto - (y - dy) : y + dy);
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        let sx = Math.floor(tx / k) - x0;
        let sy = Math.floor(ty / k) - y0;
        if (capa.repetir === "x" || capa.repetir === "xy") sx = vuelta(sx, capa.ancho);
        if (capa.repetir === "y" || capa.repetir === "xy") sy = vuelta(sy, capa.alto);
        if (sx < 0 || sy < 0 || sx >= capa.ancho || sy >= capa.alto) continue;
        const j = (sy * capa.ancho + sx) * 4;
        if (datos[j + 3]) mezclar(ty * TW + tx, [datos[j], datos[j + 1], datos[j + 2]], datos[j + 3] / 255);
      }
    }
  }
  return { tarjeta, k };
}

// Los sitios (px: lo que mide ahí un píxel del dibujo), con lo que va encima: [forma, x, y, ancho o
// radio, alto, color, opacidad]
const SITIOS = [
  { vista: "normal", ancho: 150, alto: 92, px: 2, encima: [
    ["disco", 27, 27, 19, 0, "#7c818c", 1], ["caja", 53, 9, 46, 10, "#f2f2f2", 0.55], ["caja", 53, 23, 38, 8, "#8a7cc0", 0.8],
    ["caja", 8, 53, 134, 31, "#2a2827", 1]
  ] },
  { vista: "vertical", ancho: 152, alto: 256, px: 2, encima: [
    ["disco", 76, 42, 30, 0, "#7c818c", 1], ["caja", 52, 77, 48, 15, "#f2f2f2", 0.55], ["caja", 56, 96, 40, 10, "#8a7cc0", 0.8],
    ["caja", 8, 114, 136, 51, "#000000", 0.35], ["caja", 8, 227, 136, 21, "#50bed7", 1]
  ] },
  { vista: "horizontal", ancho: 260, alto: 80, px: 1, encima: [] },
  // La portada de tu perfil (y la del probador de la Tienda): ancha, a 2 px (900 × 168 en pantalla);
  // la foto a la izquierda, el nombre y, a la derecha, los tipos de locke y las cifras
  { vista: "portada", ancho: 450, alto: 84, px: 2, encima: [
    ["disco", 38, 42, 28, 0, "#7c818c", 1], ["caja", 75, 22, 110, 11, "#f2f2f2", 0.55], ["caja", 75, 37, 80, 7, "#8a7cc0", 0.8],
    ["caja", 305, 11, 135, 62, "#000000", 0.3]
  ] },
  // Una fila de la lista de amigos: baja y alargada, a 1 px; la foto, el nombre y el marcador
  { vista: "fila", ancho: 340, alto: 67, px: 1, encima: [
    ["disco", 33, 33, 22, 0, "#7c818c", 1], ["caja", 66, 16, 100, 11, "#f2f2f2", 0.55], ["caja", 66, 34, 70, 8, "#8a7cc0", 0.8],
    ["caja", 292, 18, 38, 30, "#f2f2f2", 0.45]
  ] }
];

const carpetaMuestra = process.argv[2];
if (carpetaMuestra) {
  const soloEstos = process.argv[3] ? process.argv[3].split(",") : null;
  const momento = Number(process.argv[4]) || 0;
  const ESCALA = Number(process.argv[5]) || 2;
  const elegidos = FONDOS.filter((fondo) => !soloEstos || soloEstos.some((parte) => fondo.id.includes(parte)));
  const HUECO = 4;
  const ancho = (SITIOS.reduce((suma, sitio) => suma + sitio.ancho + HUECO, 0) - HUECO) * ESCALA;
  const altoFila = Math.max(...SITIOS.map((sitio) => sitio.alto)) + HUECO;
  const alto = altoFila * ESCALA * elegidos.length;
  const muestra = new Uint8Array(ancho * alto * 4).fill(60);
  elegidos.forEach((fondo, fila) => {
    let x0 = 0;
    for (const sitio of SITIOS) {
      const { tarjeta, k: sub } = componer(fondo, sitio.ancho, sitio.alto, momento, sitio.px, sitio.vista);
      const [TWs, THs] = [sitio.ancho * sub, sitio.alto * sub];
      for (const [forma, fx, fy, fa, fh, color, a] of sitio.encima) {
        const c = rgb(color);
        for (let ty = 0; ty < THs; ty++) {
          for (let tx = 0; tx < TWs; tx++) {
            const [ux, uy] = [(tx + 0.5) / sub, (ty + 0.5) / sub];
            const dentro = forma === "disco"
              ? (ux - fx) ** 2 + (uy - fy) ** 2 <= fa * fa
              : ux >= fx && ux < fx + fa && uy >= fy && uy < fy + fh;
            if (!dentro) continue;
            const kk = ty * TWs + tx;
            tarjeta[kk] = tarjeta[kk].map((v, n) => c[n] * a + v * (1 - a));
          }
        }
      }
      for (let ty = 0; ty < sitio.alto * ESCALA; ty++) {
        for (let tx = 0; tx < sitio.ancho * ESCALA; tx++) {
          const c = tarjeta[Math.floor((ty * sub) / ESCALA) * TWs + Math.floor((tx * sub) / ESCALA)];
          const k = ((fila * altoFila * ESCALA + ty) * ancho + x0 * ESCALA + tx) * 4;
          muestra.set([...c.map(Math.round), 255], k);
        }
      }
      x0 += sitio.ancho + HUECO;
    }
  });
  writeFileSync(join(carpetaMuestra, "muestra-fondos-pixel.png"), png(ancho, alto, muestra));
  console.log(`Muestra en ${join(carpetaMuestra, "muestra-fondos-pixel.png")}`);
}
