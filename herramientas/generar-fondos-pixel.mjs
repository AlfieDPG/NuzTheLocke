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

import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { png } from "./png.mjs";
import { pintarFigura } from "./figuras-pixel.mjs";
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

// A lo ancho siempre da la vuelta; a lo alto, solo en las capas que se repiten también hacia abajo
function lienzo(ancho = W, alto = H, envolverAlto = false) {
  const datos = new Uint8Array(ancho * alto * 4);
  // alfa: lo opaco que queda (0…1; si no se dice, del todo). Lo que se pinta encima tapa lo de debajo.
  const poner = (x, y, color, alfa = 1) => {
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

const TIENDA = {
  hierba: {
    comentario: "Hierba alta: filas de matas, de lejos (claras) a cerca (oscuras), con flores, rocío y dos mariposas",
    cieloDeDia: true,
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
    cielo: "linear-gradient(to bottom, #3e3029, #2b231f 50%, #3a2e27)",
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
    cielo: "linear-gradient(to top, #ff9d55, #ee6f5c 30%, #9a4f9a 65%, #4a3478)",
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

  olas: {
    comentario: "Surf: tres filas de olas que avanzan, cada una a su velocidad (las de delante, más deprisa y con espuma)",
    cieloDeDia: true,
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
    cielo: "linear-gradient(to bottom, #4f73ad, #7d9fcf 55%, #a9c4e6)",
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
    cielo: "linear-gradient(170deg, #263184, #171a4a 70%, #12143a)",
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
    cielo: "linear-gradient(160deg, #7a2470, #4a1d6a 60%, #2e1846)",
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
    comentario: "Desierto: el cielo de día, el sol que aprieta, dunas con su borde al sol, cactus y las columnas de unas ruinas antiguas",
    cielo: "linear-gradient(to bottom, rgb(80, 160, 240), rgb(150, 205, 250) 45%, rgb(255, 220, 160) 75%, rgb(245, 190, 120))",
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
    comentario: "Espacio: nebulosas de colores, estrellas, un planeta con anillos, una luna, un cometa y el suelo lleno de cráteres de una luna",
    cielo: "linear-gradient(to bottom, #1d1050, #151c4c)",
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
    cielo: "linear-gradient(to bottom, #4a1c24, #262229 60%, #1f1d24)",
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
    cielo: "linear-gradient(to bottom, #2f2a62, #262b44 65%, #20263a)",
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

  tormenta: {
    comentario: "Tormenta: nubes negras, lluvia que cae de lado, charcos y, de vez en cuando, un relámpago (dos destellos) que lo ilumina todo",
    cielo: "linear-gradient(to bottom, #333c50, #3f4c60 60%, #4a5a6c)",
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

// ---------- Los de Eevee ----------
//
// Los que dan los logros de registrar a Eevee y a cada Eeveelution (js/comun/fondos.js,
// FONDOS_EEVEE): el Pokémon sentado a la derecha, como en un retrato, en un paisaje suyo
// (herramientas/pokemon-pixel.mjs). Las tiras miden ALTO y van pegadas abajo; el Pokémon se sienta
// en la fila SUELO, que es lo que se ve en todas partes: en «Amigos», junto al nombre (lo de debajo
// lo tapa la franja de los contadores) y en el perfil, entre las cifras y el botón. Parpadea y
// mueve la cola de vez en cuando, y en su paisaje hay algo que se mueve (agua, fuego, destellos).

const ALTO = 92;
const SUELO = 52;
const A_LA_DERECHA = 8;
const VUELTA_EEVEE = 8; // segundos

// El Pokémon: su sello de una tinta (herramientas/sellos-pixel.mjs, hecho a partir de su arte
// oficial), quieto, en una capa. Se coloca por lo que ocupa de verdad el dibujo: su centro, a
// «centro» píxeles del borde derecho (el centro de su roca, tocón o nube), y lo más bajo (las
// patas), en la fila «suelo»
function capasPokemon(nombre, { centro = 31, suelo = SUELO + 1 } = {}) {
  const fig = sello(nombre);
  let [x0, x1, y1] = [fig.ancho, 0, 0];
  fig.pixeles.forEach((c, k) => {
    if (!c) return;
    const [x, y] = [k % fig.ancho, Math.floor(k / fig.ancho)];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  });
  const derecha = Math.round(centro - fig.ancho + (x0 + x1 + 1) / 2);
  const abajo = ALTO - 1 - (suelo - y1 + fig.alto - 1);
  return [{
    nombre: "pokemon", ancho: fig.ancho, alto: fig.alto, repetir: "no",
    sitio: { x: derecha, lado: "derecha", y: abajo, desde: "abajo" },
    pintar: (l) => pintarFigura(l, fig, 0, 0)
  }];
}

// Un fondo de Eevee: el Pokémon delante de todo (salvo «delante»), luego las capas del paisaje.
// turnosEscena: grupos de dibujos que se turnan (agua, fuego...); deriva: lo que se desplaza
// despacio de lado (nubes, vilanos), { capa: [cuánto en una vuelta, 0] }, con su duración.
function fondoEevee({ comentario, cielo, pokemon, sitio = {}, delante = [], capas, turnosEscena = [], deriva = null }) {
  const animacion = turnosEscena.length ? [turnos(VUELTA_EEVEE, turnosEscena)] : [];
  // Lo que se desliza va suave (sin saltos de un píxel, como la lluvia de «Tormenta») y al doble
  if (deriva) animacion.push({ nombre: "deriva", eje: "x", duracion: deriva.duracion / 2, mueve: deriva.mueve });
  return { comentario, cielo, capas: [...delante, ...capasPokemon(pokemon, sitio), ...capas], animacion: animacion.length ? animacion : undefined };
}

// Una capa que se repite a lo ancho, pegada abajo, del alto de la tira (o el que se diga)
const tira = (nombre, pintar, alto = ALTO, y = 0) => ({ nombre, ancho: 256, alto, repetir: "x", sitio: { y, desde: "abajo" }, pintar });
// Una capa que va una vez, pegada a la derecha y abajo (x: lo que la separa del borde derecho)
const aLaDerecha = (nombre, ancho, alto, x, y, pintar) => ({ nombre, ancho, alto, repetir: "no", sitio: { x, lado: "derecha", y, desde: "abajo" }, pintar });

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

// Una peña: arriba casi llana (donde se sienta el Pokémon, en la fila top) y los lados que caen
// hasta abajo; la cara de la izquierda al sol, la de la derecha en sombra, con grietas
function pena(l, azar, cx, ancho, top, [luz, base, sombra, grieta], llana = 0.5, hasta = l.alto) {
  const media = ancho / 2;
  const arriba = [];
  for (let x = Math.floor(cx - media); x <= Math.ceil(cx + media); x++) {
    const d = Math.abs(x + 0.5 - cx) / media;
    if (d > 1) continue;
    const caida = Math.max(0, (d - llana) / (1 - llana));
    arriba.push([x, top + Math.round(caida ** 1.5 * (l.alto - top + 2)) + (azar() < 0.2 ? 1 : 0)]);
  }
  for (const [x, y0] of arriba) {
    const lado = (x + 0.5 - cx) / media;
    for (let y = y0; y < hasta; y++) {
      let c = lado < -0.25 ? luz : lado > 0.4 ? sombra : base;
      if (Math.abs(lado + 0.25) < 0.08 && umbral(x, y) < 0.5) c = base;
      if (Math.abs(lado - 0.4) < 0.08 && umbral(x, y) < 0.5) c = base;
      if (y - y0 < 1) c = lado > 0.4 ? base : "#ffffff";
      else if (y - y0 < 3 && lado <= 0.4) c = luz;
      l.poner(x, y, c);
    }
  }
  // Grietas: rayitas en diagonal
  for (let i = 0; i < Math.round(ancho / 6); i++) {
    let x = Math.round(cx - media * 0.7 + azar() * media * 1.4);
    let y = top + 5 + Math.floor(azar() * (l.alto - top - 6));
    for (let k = 0; k < 3 + Math.floor(azar() * 4); k++) {
      const [, y0] = arriba.find(([px]) => px === x) || [0, 999];
      if (y > y0 + 1 && y < hasta) l.poner(x, y, grieta);
      x += azar() < 0.5 ? 1 : 0;
      y += 1;
    }
  }
}

// Un árbol frondoso: el tronco y la copa hecha de bultos, con luz arriba a la izquierda
function arbolFrondoso(l, azar, x, base, alto, [oscuro, medio, claro, brillo], tronco = ["#6a4a2a", "#8a6640"]) {
  const copa = Math.round(alto * 0.62);
  const r = Math.max(3, Math.round(copa / 2.3));
  rect(l, x - 1, base - alto + copa - 2, 3, alto - copa + 2, tronco[0]);
  rect(l, x - 1, base - alto + copa - 2, 1, alto - copa + 2, tronco[1]);
  const cy = base - alto + r + 1;
  const bultos = [[0, 0, r], [-r * 0.8, r * 0.45, r * 0.75], [r * 0.8, r * 0.4, r * 0.8], [-r * 0.3, -r * 0.55, r * 0.7], [r * 0.45, -r * 0.35, r * 0.65]]
    .map(([dx, dy, rr]) => [Math.round(x + dx + (azar() - 0.5)), Math.round(cy + dy), Math.max(2, Math.round(rr))]);
  for (const [bx, by, br] of bultos) disco(l, bx, by, br, oscuro);
  for (const [bx, by, br] of bultos) disco(l, bx - 1, by - 1, br - 1, medio);
  for (const [bx, by, br] of bultos) if (br > 2) disco(l, bx - Math.ceil(br / 2), by - Math.ceil(br / 2), Math.max(1, Math.floor(br / 2.5)), claro);
  for (const [bx, by, br] of bultos) if (br > 3) l.poner(bx - br + 2, by - br + 2, brillo);
}

// Un destello de cuatro puntas (grande: con las puntas largas)
function destello(l, x, y, [color, centro], grande = false, a = 1) {
  mapa(l, x - (grande ? 2 : 1), y - (grande ? 2 : 1), grande
    ? ["..a..", "..a..", "aabaa", "..a..", "..a.."]
    : [".a.", "aba", ".a."], { a: color, b: centro }, a);
}

// Una pared de roca: la parte de la izquierda al sol y la de la derecha en sombra (pasando de una a
// otra con trama), con vetas en horizontal y alguna grieta; top: la fila de arriba en cada columna
function roca(l, desde, hasta, top, abajo, [luz, base, sombra, oscuro]) {
  const azar = azarFijo(`roca-${desde}-${hasta}`);
  const vetas = Array.from({ length: 12 }, () => [Math.floor(azar() * 8), 3 + Math.floor(azar() * 9)]);
  for (let x = desde; x <= hasta; x++) {
    const y0 = Math.round(top(x));
    const t = (x - desde) / Math.max(1, hasta - desde) + (umbral(x, 0) - 0.5) * 0.12;
    for (let y = y0; y < abajo; y++) {
      let c = t < 0.3 ? luz : t < 0.7 ? base : sombra;
      const [fase, largo] = vetas[Math.floor(y / 6) % vetas.length];
      if (y % 6 === 0 && (x + fase) % (largo + 4) < largo) c = t < 0.7 ? sombra : oscuro;
      if (y - y0 < 1) c = t < 0.7 ? "#ffffff" : luz;
      else if (y - y0 < 2 && t < 0.7) c = luz;
      l.poner(x, y, c);
    }
  }
}

// Una mata de hierba alta con la punta clara
function hierbas(l, x, base, alto, [oscuro, medio, claro]) {
  for (const [dx, h, lado] of [[0, alto, -1], [2, alto + 2, 0], [4, alto, 1], [1, alto - 2, -1], [3, alto - 1, 1]]) {
    for (let k = 0; k < h; k++) {
      const px = x + dx + (k > h * 0.6 ? lado : 0);
      l.poner(px, base - k, k > h - 3 ? claro : k > h / 2 ? medio : oscuro);
    }
  }
}

// Un diente de león: el tallo y la bola de vilanos
function dienteDeLeon(l, x, base, alto) {
  rect(l, x, base - alto, 1, alto, "#6e9a3a");
  l.poner(x - 1, base - 2, "#86b048");
  disco(l, x, base - alto - 3, 3, "#f4f1e6");
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [-3, -3], [3, -3], [-3, 2], [3, 2]]) l.poner(x + dx, base - alto - 3 + dy, "#ffffff");
  l.poner(x - 1, base - alto - 4, "#ffffff");
  l.poner(x + 1, base - alto - 2, "#d8d4c4");
}

const EEVEE = {
  // ---------- Eevee: una pradera dorada a media tarde, con dientes de león y sus vilanos volando ----------
  eevee: (() => {
    const VERDES = ["#4f8f2e", "#6aa83a", "#8cc44a", "#b6dc6a"];
    return fondoEevee({
      comentario: "Eevee: sentado entre la hierba de una pradera dorada a media tarde, con dientes de león, flores y vilanos que vuelan",
      cielo: "linear-gradient(to bottom, #5fb0ec, #9dd4f6 42%, #ffe2b0 80%, #ffcf8c)",
      pokemon: "eevee",
      sitio: { centro: 31, suelo: 54 },
      capas: [
        tira("vilanos", (l, azar) => {
          // Vilanos sueltos: una bolita blanca con su hilo
          for (let i = 0; i < 18; i++) {
            const [x, y] = [Math.floor(azar() * l.ancho), 4 + Math.floor(azar() * 44)];
            l.poner(x, y, "#ffffff");
            l.poner(x + 1, y, "#f2efe2");
            l.poner(x, y - 1, "#f2efe2");
            l.poner(x + 1, y + 1, "#c8c0a8");
          }
        }, 60, 26),
        tira("pradera", (l, azar) => {
          suelo(l, 50, ["#a6d05a", "#94c24e", "#80b244", "#6aa03a", "#5a8e30"], 1);
          for (let i = 0; i < 70; i++) {
            const x = Math.floor(azar() * l.ancho);
            const y = 52 + Math.floor(azar() * 40);
            hierbas(l, x, y, 3 + Math.floor((y - 50) / 9), VERDES);
          }
          for (const [x, alto] of [[14, 13], [46, 9], [92, 15], [128, 11], [168, 14], [206, 10], [238, 16]]) dienteDeLeon(l, x, 54 + (x % 5), alto);
          for (let i = 0; i < 40; i++) {
            const [x, y] = [Math.floor(azar() * l.ancho), 52 + Math.floor(azar() * 38)];
            const c = ["#ffe066", "#ffffff", "#ff9ab8", "#ffd23a"][i % 4];
            l.poner(x, y, c);
            if (i % 3 === 0) { l.poner(x - 1, y + 1, c); l.poner(x + 1, y + 1, c); l.poner(x, y + 1, "#f0a030"); }
          }
        }),
        tira("colinas", (l, azar) => {
          monte(l, azar, { base: 46, alto: 14, ondas: [[1, 0.3], [3, 0.12]], color: "#86b8a4", claro: "#a6d0bc", a: 1, hasta: 52 });
          const loma = monte(l, azar, { base: 52, alto: 9, ondas: [[2, 0.35], [5, 0.12]], color: "#8cbc52", claro: "#a8d264", a: 1, hasta: 54 });
          for (const x of [20, 58, 64, 150, 196, 202]) arbol(l, x, loma[x] + 1, 7 + (x % 4), ["#3e7a36", "#5a9a44", "#9ad070"], 1);
        }),
        { nombre: "nubes", ancho: 256, alto: 40, repetir: "x", sitio: { y: 6, desde: "arriba" }, pintar(l, azar) {
          for (let i = 0; i < 3; i++) nubeEsponjosa(l, 30 + i * 86 + Math.floor(azar() * 20), 18 + Math.floor(azar() * 12), 10 + Math.floor(azar() * 6), ["#ffffff", "#fff4e6", "#f2cfb4"]);
        } }
      ],
      deriva: { duracion: 128, pasos: 256, mueve: { nubes: [-256, 0], vilanos: [-512, 0] } }
    });
  })(),

  // ---------- Vaporeon: en una roca de la laguna, junto a una cascada que cae entre rocas ----------
  vaporeon: (() => {
    const ROCA = ["#b4c2d6", "#8a9cb8", "#64789a", "#4a5a7c"];
    // La cascada: franjas que bajan (cada dibujo, un poco más abajo) y la espuma de abajo
    const cascada = (k) => aLaDerecha(`cascada-${k}`, 28, 50, 66, 30, (l) => {
      for (let x = 0; x < l.ancho; x++) {
        for (let y = 0; y < 44; y++) {
          const franja = (x * 7 + Math.floor((y - k * 3 + 60) / 3)) % 6;
          const borde = x < 2 || x > l.ancho - 3;
          l.poner(x, y, borde ? "#7ac4ec" : franja === 0 ? "#ffffff" : franja < 3 ? "#bfe8fb" : "#86cdf2");
        }
        l.poner(x, 0, "#e8f8ff");
      }
      for (let i = 0; i < 26; i++) {
        const x = ((i * 11 + k * 5) % (l.ancho + 6)) - 3;
        const y = 42 + ((i * 7 + k * 3) % 7);
        disco(l, x, y, 1 + ((i + k) % 2), "#ffffff");
      }
    });
    const cascadas = [0, 1, 2].map(cascada);
    // Brillos en el agua: dos dibujos que se turnan
    const brillos = [0, 1].map((k) => tira(`brillos-${k}`, (l, azar) => {
      for (let i = 0; i < 26; i++) {
        const [x, y] = [Math.floor(azar() * l.ancho), 4 + Math.floor(azar() * 30)];
        rect(l, x + k * 3, y, 2 + (i % 3), 1, i % 4 ? "#d4f2ff" : "#ffffff");
      }
    }, 36));
    return fondoEevee({
      comentario: "Vaporeon: en una roca de la laguna, junto a una cascada que cae entre rocas con musgo, con espuma y brillos en el agua",
      cielo: "linear-gradient(to bottom, #4cacf0, #8ad2fa 55%, #c4ecff)",
      pokemon: "vaporeon",
      sitio: { centro: 26, suelo: 54 },
      capas: [
        ...cascadas,
        aLaDerecha("orilla", 60, 8, 4, ALTO - 66, (l) => {
          // El agua que rodea la roca, con espuma: va delante de la roca
          for (let x = 0; x < l.ancho; x++) for (let y = 2; y < l.alto; y++) l.poner(x, y, y < 4 ? "#a8e0fa" : "#4aa6e0");
          for (let x = 2; x < l.ancho - 2; x += 1) if ((x * 5) % 7 < 4) l.poner(x, 2 + (x % 2), "#ffffff");
        }),
        aLaDerecha("rocas", 124, ALTO, 0, 0, (l, azar) => {
          // Las paredes de roca a los dos lados de la cascada (que cae entre la columna 66 y la 94
          // contando desde la derecha: aquí, de 30 a 58), con musgo arriba
          const top = (x) => (x < 30 ? 14 + ((29 - x) / 29) ** 1.4 * 44 + Math.sin(x / 3) : x > 58 ? 14 + (x - 59) * 0.25 + Math.sin(x / 4) * 1.5 : 99);
          roca(l, 0, 29, top, 62, ROCA);
          roca(l, 59, 123, top, 62, ROCA);
          for (let x = 0; x < l.ancho; x++) {
            if (x >= 30 && x <= 58) continue;
            const y0 = Math.round(top(x));
            for (let k = -2; k < 1; k++) l.poner(x, y0 + k, k === -2 ? "#9ad86a" : (x + k) % 3 ? "#5aa83e" : "#3e8a32");
            if (x % 9 === 3) mata(l, x - 4, y0 - 1, 6, ["#3e8a32", "#7ac456", "#2e6e2a"], 1);
          }
          // La roca de Vaporeon, en el agua (lo de abajo lo tapa la laguna, que va delante)
          pena(l, azar, 92, 56, 53, ["#d2dcea", "#a2b2c8", "#76889e", "#56647e"], 0.55, 64);
        }),
        ...brillos,
        tira("laguna", (l) => {
          for (let y = 56; y < l.alto; y++) {
            const t = (y - 56) / (l.alto - 56);
            for (let x = 0; x < l.ancho; x++) l.poner(x, y, t + umbral(x, y) * 0.5 - 0.25 < 0.35 ? "#4aa6e0" : t + umbral(x, y) * 0.5 - 0.25 < 0.7 ? "#3290d0" : "#2378bc");
          }
          for (let x = 0; x < l.ancho; x++) l.poner(x, 56, "#a8e0fa");
        }),
        tira("lejos", (l, azar) => {
          monte(l, azar, { base: 46, alto: 22, ondas: [[1, 0.35], [3, 0.12], [7, 0.04]], color: "#7c9ad0", claro: "#a2bce4", a: 1, hasta: 58, nieve: 30 });
          for (let i = 0; i < 26; i++) {
            const x = Math.floor((i * l.ancho) / 26 + azar() * 6);
            abeto(l, x, 57, 10 + Math.floor(azar() * 9), ["#2e6a4a", "#3e845a", "#5aa070"], 1);
          }
          rect(l, 0, 56, l.ancho, 2, "#2e6a4a");
        }),
        NUBES_DE_DIA
      ],
      turnosEscena: [{ capas: cascadas, pasos: ciclo(64, 3) }, { capas: brillos, pasos: ciclo(8, 2) }],
      deriva: { duracion: 128, pasos: 256, mueve: { nubes: [-256, 0] } }
    });
  })(),

  // ---------- Jolteon: en un peñasco de un prado, con tormenta al atardecer, rayos y chispas ----------
  jolteon: (() => {
    const chispas = [0, 1, 2].map((k) => aLaDerecha(`chispas-${k}`, 60, 56, 0, ALTO - SUELO - 4, (l) => {
      if (k === 0) return;
      const sitios = k === 1 ? [[8, 14], [52, 8], [44, 40], [14, 44]] : [[4, 30], [56, 26], [30, 2], [50, 50]];
      for (const [x, y] of sitios) {
        mapa(l, x - 2, y - 2, k === 1 ? ["a...", ".ab.", "..ba", "...a"] : ["...a", ".ba.", ".ab.", "a..."], { a: "#fff36a", b: "#ffffff" });
      }
    }));
    const rayos = [0, 1].map((k) => ({ nombre: `rayo-${k}`, ancho: 256, alto: 50, repetir: "x", sitio: { y: 6, desde: "arriba" }, pintar(l) {
      if (k === 0) return;
      for (const [x0, largo] of [[60, 44], [196, 34]]) {
        let [x, y] = [x0, 0];
        for (let lado = 1; y < largo; lado = -lado) {
          for (let n = 0; n < 4 && y < largo; n++) {
            x += lado;
            y += 1;
            brillo(l, x, y, 3, "#fff6b0", 0.5, 0.45);
            l.poner(x, y, "#ffffff");
            l.poner(x + 1, y, "#fff36a");
          }
        }
      }
    } }));
    return fondoEevee({
      comentario: "Jolteon: en un peñasco de un prado de hierba amarilla, con una tormenta al atardecer, rayos y chispas a su alrededor",
      cielo: "linear-gradient(to bottom, #2c2266, #5c3c96 38%, #c86494 72%, #ffa070)",
      pokemon: "jolteon",
      sitio: { centro: 37, suelo: 54 },
      delante: chispas,
      capas: [
        aLaDerecha("pena", 76, 40, 0, 0, (l, azar) => {
          pena(l, azar, 39, 66, 1, ["#b8a2d2", "#8672aa", "#5e4e84", "#3e3460"]);
        }),
        tira("prado", (l, azar) => {
          suelo(l, 52, ["#c8b040", "#a89434", "#8a7a2c", "#6e6226"], 1);
          for (let x = 0; x < l.ancho; x += 2) {
            const alto = 4 + Math.floor(azar() * 6);
            const base = 54 + Math.floor(azar() * 38);
            for (let k = 0; k < alto; k++) l.poner(x + (k > alto / 2 ? 1 : 0), base - k, k > alto - 3 ? "#fff07a" : "#e0c030");
          }
        }),
        tira("lejos", (l, azar) => {
          monte(l, azar, { base: 46, alto: 12, ondas: [[1, 0.3], [4, 0.1]], color: "#6a4a8a", claro: "#8a64a6", a: 1, hasta: 54 });
          monte(l, azar, { base: 52, alto: 5, ondas: [[3, 0.3], [7, 0.1]], color: "#8a6a5a", claro: "#a8806a", a: 1, hasta: 54 });
          for (const x of [40, 168]) {
            rect(l, x, 26, 2, 26, "#3a2c4a");
            rect(l, x - 5, 27, 12, 1, "#3a2c4a");
          }
          for (let x = 0; x < l.ancho; x++) {
            const t = ((x - 40 + 256) % 128) / 128;
            l.poner(x, 27 + Math.round(Math.sin(t * Math.PI) * 6), "#2a2038");
          }
        }),
        ...rayos,
        { nombre: "nubes", ancho: 256, alto: 30, repetir: "x", sitio: { y: 0, desde: "arriba" }, pintar(l, azar) {
          // El techo de nubes: oscuro arriba y, abajo, bultos más claros por donde les da la luz
          const fases = [0, 1, 2].map(() => azar() * Math.PI * 2);
          for (let x = 0; x < l.ancho; x++) {
            const borde = 9 + Math.sin((2 * Math.PI * 4 * x) / l.ancho + fases[0]) * 3 + Math.sin((2 * Math.PI * 9 * x) / l.ancho + fases[1]) * 2
              + Math.abs(Math.sin((2 * Math.PI * 16 * x) / l.ancho + fases[2])) * 3;
            for (let y = 0; y < borde; y++) {
              const hondo = borde - y;
              l.poner(x, y, hondo < 2 ? "#9a86c0" : hondo < 4 && umbral(x, y) < 0.6 ? "#7a68a6" : y < 3 ? "#3a2e62" : "#56478a");
            }
          }
          for (let i = 0; i < 4; i++) nubeEsponjosa(l, 20 + i * 64 + Math.floor(azar() * 20), 18 + Math.floor(azar() * 6), 9 + Math.floor(azar() * 5), ["#a490c8", "#7a68a6", "#56478a"]);
        } }
      ],
      turnosEscena: [
        { capas: chispas, pasos: ciclo(16, 3) },
        { capas: rayos, pasos: [[0, 0], [0.3, 1], [0.32, 0], [0.34, 1], [0.37, 0], [0.75, 1], [0.78, 0]] }
      ],
      deriva: { duracion: 96, pasos: 256, mueve: { nubes: [-256, 0] } }
    });
  })(),

  // ---------- Flareon: junto a una hoguera al atardecer, con chispas que suben y árboles de otoño ----------
  flareon: (() => {
    const FUEGO = (k) => aLaDerecha(`fuego-${k}`, 22, 26, 58, ALTO - 58, (l) => {
      // Una llama grande en medio y dos pequeñas a los lados: anchas abajo, en punta arriba y
      // ladeadas por el aire, con el corazón amarillo; en cada dibujo, de otro alto y otro vaivén
      const llamas = [[11, [22, 25, 20][k], 6, [0, 1, -1][k]], [5, [11, 8, 12][k], 3.4, [-1, 0, 1][k]], [17, [9, 12, 8][k], 3.4, [1, -1, 0][k]]];
      for (const [cx, h, ancho, vaiven] of llamas) {
        for (let y = 0; y < h; y++) {
          const t = y / h;
          // Ancha abajo (lo más ancho, a un tercio) y en punta arriba
          const media = (ancho / 2) * (t < 0.3 ? 0.75 + (t / 0.3) * 0.25 : (1 - (t - 0.3) / 0.7) ** 1.2);
          const centro = cx + Math.round(vaiven * Math.sin(t * Math.PI) * 1.6 + vaiven * t * t * 2);
          for (let dx = -Math.round(media); dx <= Math.round(media); dx++) {
            const r = Math.abs(dx) / Math.max(0.5, media);
            const c = r > 0.75 || t > 0.8 ? "#e8441e" : r > 0.4 || t > 0.55 ? "#ff8a2a" : t < 0.3 && r < 0.25 ? "#fffbe0" : "#ffd84a";
            l.poner(centro + dx, l.alto - 1 - y, c);
          }
        }
      }
    });
    const fuegos = [0, 1, 2].map(FUEGO);
    const chispas = [0, 1, 2].map((k) => aLaDerecha(`chispas-${k}`, 30, 40, 54, ALTO - SUELO + 18, (l) => {
      for (let i = 0; i < 7; i++) {
        const x = (i * 9 + k * 4) % 30;
        const y = (i * 13 + k * 9) % 40;
        l.poner(x, y, ["#ffd060", "#ff8a2a", "#fff3a0"][(i + k) % 3]);
      }
    }));
    return fondoEevee({
      comentario: "Flareon: junto a una hoguera al atardecer, con la llama que baila, chispas que suben y árboles de otoño",
      cielo: "linear-gradient(to bottom, #3c2a70, #8c3c82 38%, #f0684e 72%, #ffb464)",
      pokemon: "flareon",
      sitio: { centro: 31, suelo: 55 },
      delante: [...fuegos, ...chispas],
      capas: [
        aLaDerecha("hoguera", 100, 46, 0, 0, (l) => {
          // El resplandor en el suelo, las piedras y los troncos
          brillo(l, 31, 12, 26, "#ffb050", 0.6, 1);
          for (const [dx, dy] of [[-12, 1], [12, 1], [-8, 3], [8, 3], [0, 4], [-14, 3], [14, 3]]) disco(l, 31 + dx, 14 + dy, 2, dx < 0 ? "#a8a0a8" : "#7a727e");
          rect(l, 19, 13, 24, 2, "#6a4428");
          for (let k = 0; k < 20; k++) l.poner(21 + k, 11 + (Math.floor(k / 4) % 2), "#5a3820");
        }),
        tira("suelo", (l, azar) => {
          suelo(l, 52, ["#8a5a3a", "#76482e", "#623a26", "#4e2e20"], 1);
          for (let i = 0; i < 70; i++) {
            const [x, y] = [Math.floor(azar() * l.ancho), 54 + Math.floor(azar() * 38)];
            l.poner(x, y, ["#e0782c", "#c8462a", "#f0b040", "#a8401e"][i % 4]);
            if (i % 2) l.poner(x + 1, y, ["#e0782c", "#c8462a", "#f0b040", "#a8401e"][(i + 1) % 4]);
          }
        }),
        tira("bosque", (l, azar) => {
          monte(l, azar, { base: 40, alto: 14, ondas: [[1, 0.3], [3, 0.12]], color: "#8a4a7a", claro: "#a85e8e", a: 1, hasta: 54 });
          const colores = [["#8e2a20", "#c0442a", "#e8743c", "#ffb070"], ["#9a5a10", "#d08a20", "#f2b440", "#ffe08a"], ["#7a2a3a", "#a83a3c", "#d85a4a", "#ff9a7a"]];
          for (let i = 0; i < 11; i++) {
            const x = Math.floor((i * l.ancho) / 11 + azar() * 10);
            arbolFrondoso(l, azar, x, 54, 16 + Math.floor(azar() * 9), colores[i % 3], ["#4a2a20", "#6a3e2a"]);
          }
          rect(l, 0, 52, l.ancho, 2, "#6a3a26");
        })
      ],
      turnosEscena: [{ capas: fuegos, pasos: ciclo(32, 3) }, { capas: chispas, pasos: ciclo(16, 3) }]
    });
  })(),

  // ---------- Espeon: en un risco, al amanecer, con el sol saliendo tras montañas lilas ----------
  espeon: (() => {
    const destellos = [0, 1].map((k) => ({ nombre: `destellos-${k}`, ancho: 256, alto: 60, repetir: "x", sitio: { y: 4, desde: "arriba" }, pintar(l, azar) {
      for (let i = 0; i < 9; i++) {
        const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * 56)];
        destello(l, (x + k * 97) % l.ancho, y, ["#ffd8f6", "#ffffff"], i % 3 === 0);
      }
    } }));
    return fondoEevee({
      comentario: "Espeon: en un risco al amanecer, con el sol saliendo detrás de montañas lilas, nubes rosas y destellos que titilan",
      cielo: "linear-gradient(to bottom, #7e62cc, #c884d2 38%, #ff9eb8 68%, #ffd29c)",
      pokemon: "espeon",
      sitio: { centro: 37, suelo: 54 },
      capas: [
        aLaDerecha("risco", 76, 40, 0, 0, (l, azar) => {
          pena(l, azar, 39, 70, 1, ["#e0cdf0", "#ae96cc", "#806aa6", "#5c4a80"], 0.45);
          for (const x of [14, 22, 58]) mapa(l, x, 0, [".a.", "aba"], { a: "#ff9ac8", b: "#ffe070" });
        }),
        aLaDerecha("sol", 64, 36, 58, ALTO - 50, (l) => {
          for (let y = 0; y < l.alto; y++) {
            for (let x = 0; x < l.ancho; x++) {
              const d = Math.hypot(x - 32, y - 34);
              if (d <= 20) l.poner(x, y, d < 13 ? "#fff6d0" : d < 17 || umbral(x, y) < 0.5 ? "#ffd27a" : "#ffa0b0");
              else if (d < 31 && umbral(x, y) < 0.5 * (1 - (d - 20) / 11)) l.poner(x, y, "#ffd0dc");
            }
          }
        }),
        tira("montanas", (l, azar) => {
          monte(l, azar, { base: 50, alto: 26, ondas: [[2, 0.35], [5, 0.12], [11, 0.04]], color: "#a080c8", claro: "#c4a6e4", a: 1, hasta: 60, nieve: 30 });
          monte(l, azar, { base: 56, alto: 10, ondas: [[3, 0.3], [7, 0.1]], color: "#7a5aa8", claro: "#9474c0", a: 1, hasta: 62 });
          suelo(l, 58, ["#7a5aa8", "#6a4c96", "#5a3e84", "#4c3474"], 1);
          for (let i = 0; i < 30; i++) l.poner(Math.floor(azar() * l.ancho), 60 + Math.floor(azar() * 30), i % 2 ? "#c8a2e8" : "#ff9ac8");
        }),
        ...destellos,
        { nombre: "nubes", ancho: 256, alto: 40, repetir: "x", sitio: { y: 4, desde: "arriba" }, pintar(l, azar) {
          for (let i = 0; i < 5; i++) {
            const x = Math.floor(azar() * l.ancho);
            const y = 6 + Math.floor(azar() * 26);
            const largo = 22 + Math.floor(azar() * 22);
            for (let k = 0; k < largo; k++) l.poner(x + k, y + (k > 3 && k < largo - 3 ? 0 : 1), "#ffc4dc");
            for (let k = 3; k < largo - 6; k++) l.poner(x + k + 2, y - 1, "#ffe8f2");
          }
        } }
      ],
      turnosEscena: [{ capas: destellos, pasos: ciclo(6, 2) }],
      deriva: { duracion: 160, pasos: 256, mueve: { nubes: [-256, 0] } }
    });
  })(),

  // ---------- Umbreon: en una roca bajo la luna llena, con el bosque de noche y luces de anillo ----------
  umbreon: (() => {
    const estrellas = [0, 1].map((k) => ({ nombre: `estrellas-${k}`, ancho: 128, alto: 64, repetir: "xy", sitio: { y: 2, desde: "arriba" }, pintar(l, azar) {
      for (let i = 0; i < 16; i++) {
        const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * l.alto)];
        if (i % 4 === k * 2) destello(l, x, y, ["#c8d0ff", "#ffffff"]);
        else l.poner(x, y, i % 3 ? "#e8ecff" : "#ffffff");
      }
    } }));
    const luces = [0, 1].map((k) => tira(`luces-${k}`, (l) => {
      for (const [x, y] of [[18, 26], [62, 36], [100, 20], [150, 32], [196, 24], [236, 38]]) {
        const [px, py] = [(x + k * 9) % 256, y + (k ? -3 : 0)];
        brillo(l, px + 1, py + 1, 5, "#ffe680", 0.5, 1);
        mapa(l, px, py, ["aaa", "a.a", "aaa"], { a: k ? "#fff07a" : "#ffd84a" });
      }
    }, 60, 30));
    return fondoEevee({
      comentario: "Umbreon: en una roca bajo la luna llena, con el bosque de noche, estrellas que titilan, luces en forma de anillo y sus anillos que brillan",
      cielo: "linear-gradient(to bottom, #141a4c, #22307a 50%, #33489a)",
      pokemon: "umbreon",
      sitio: { centro: 37, suelo: 54 },
      capas: [
        ...luces,
        aLaDerecha("roca", 76, 40, 0, 0, (l, azar) => {
          pena(l, azar, 39, 66, 1, ["#8692c4", "#56629a", "#3a4472", "#262c50"]);
        }),
        aLaDerecha("luna", 44, 44, 60, ALTO - 56, (l) => {
          brillo(l, 22, 22, 21, "#fff6c0", 0.55, 1);
          disco(l, 22, 22, 12, "#ffe680");
          disco(l, 20, 20, 9, "#fff4b8");
          for (const [x, y, r] of [[26, 25, 2], [17, 24, 1], [24, 16, 1], [19, 27, 1]]) disco(l, x, y, r, "#f0d468");
        }),
        tira("bosque", (l, azar) => {
          for (let i = 0; i < 22; i++) abeto(l, Math.floor((i * l.ancho) / 22 + azar() * 6), 54, 14 + Math.floor(azar() * 14), ["#141a3a", "#1e2650", "#2c3868"], 1);
          suelo(l, 53, ["#1e2a52", "#1a2448", "#161f3e", "#121a34"], 1);
          for (let y = 60; y < 70; y++) {
            const media = Math.round(34 * Math.sqrt(Math.max(0, 1 - ((y - 65) / 5.5) ** 2)));
            for (let dx = -media; dx <= media; dx++) l.poner(70 + dx, y, (dx + y) % 7 ? "#2c3c7a" : "#3a4c90");
          }
          for (let y = 61; y < 69; y += 2) rect(l, 64 + (y % 4), y, 12 - (y - 61), 1, "#ffe680");
        }),
        ...estrellas
      ],
      turnosEscena: [{ capas: estrellas, pasos: ciclo(8, 2) }, { capas: luces, pasos: ciclo(4, 2) }]
    });
  })(),

  // ---------- Leafeon: en el tocón musgoso de un bosque soleado, con helechos y hojas que vuelan ----------
  leafeon: (() => {
    // Mariposas que abren y cierran las alas, y motas de luz que titilan entre los árboles
    const mariposas = [0, 1].map((k) => tira(`mariposas-${k}`, (l) => {
      for (const [x, y, ala] of [[24, 10, "#ffe066"], [70, 22, "#ffffff"], [118, 8, "#ff9ac8"], [168, 18, "#9ad0ff"], [214, 12, "#ffe066"]]) {
        mapa(l, x - 2, y - 1, k ? ["a.a", ".k.", "a.a"] : ["aa.aa", "aakaa", ".a.a."], { a: ala, k: "#3a2e2a" });
      }
    }, 40, 44));
    const motas = [0, 1].map((k) => tira(`motas-${k}`, (l, azar) => {
      for (let i = 0; i < 16; i++) {
        const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * 44)];
        if ((i + k) % 2) destello(l, x, y, ["#fff6b0", "#ffffff"]);
        else l.poner(x, y, "#fffbd8");
      }
    }, 48, 40));
    return fondoEevee({
      comentario: "Leafeon: en un tocón con musgo en un bosque soleado, con rayos de luz, helechos, setas, flores, mariposas, motas de luz y hojas que vuelan",
      cielo: "linear-gradient(to bottom, #6cc8f2, #b4e6cc 52%, #e6f6bc)",
      pokemon: "leafeon",
      sitio: { centro: 38, suelo: 54 },
      capas: [
        ...mariposas,
        ...motas,
        aLaDerecha("tocon", 76, 40, 0, 0, (l) => {
          // El tocón: el corte de arriba (claro, con sus anillos), la corteza que se ensancha abajo en
          // raíces y el musgo que cae por los lados
          for (let y = 1; y < l.alto; y++) {
            const abre = y > 12 ? Math.round(((y - 12) / (l.alto - 12)) ** 1.6 * 12) : 0;
            for (let x = 12 - abre; x < 64 + abre; x++) {
              const t = (x - (12 - abre)) / (52 + abre * 2);
              l.poner(x, y, t < 0.08 || t > 0.92 ? "#4a2e18" : t < 0.3 ? "#9a6e40" : t < 0.7 ? "#7e5630" : "#5e3e22");
              if (x % 5 === 0 && y > 4 && umbral(x, y) < 0.6) l.poner(x, y, "#4e3420");
            }
          }
          for (let x = 12; x < 64; x++) {
            l.poner(x, 0, "#e0bc86");
            l.poner(x, 1, (x - 38) % 7 === 0 ? "#b08a58" : "#d4ae76");
            l.poner(x, 2, "#b08a58");
          }
          for (let x = 10; x < 66; x++) if ((x * 7) % 5 < 3) rect(l, x, 1 + ((x * 3) % 3), 1, 2 + ((x * 5) % 7), x % 2 ? "#5aa83e" : "#7ac456");
          for (const x of [0, 64]) mata(l, x, l.alto - 1, 10, ["#3e8a32", "#7ac456", "#2e6e2a"], 1);
        }),
        tira("hojas", (l, azar) => {
          for (let i = 0; i < 12; i++) {
            const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * 50)];
            mapa(l, x, y, i % 2 ? ["..a", ".ab", "ab."] : ["a..", "ba.", ".ba"], { a: "#9ae070", b: "#4a8a3a" });
          }
        }, 56, 30),
        tira("helechos", (l, azar) => {
          suelo(l, 52, ["#6aae46", "#5a9c3c", "#4a8a34", "#3c782c"], 1);
          for (let i = 0; i < 20; i++) {
            const x = Math.floor(azar() * l.ancho);
            const y = 56 + Math.floor(azar() * 34);
            for (let k = 1; k <= 5; k++) {
              l.poner(x - k, y - k + 1, "#7ad060");
              l.poner(x + k, y - k + 1, "#5ab048");
              l.poner(x - k, y - k + 2, "#3e8a32");
            }
            l.poner(x, y - 4, "#9ae070");
          }
          for (let i = 0; i < 26; i++) {
            const [x, y] = [Math.floor(azar() * l.ancho), 54 + Math.floor(azar() * 36)];
            mapa(l, x, y, [".a.", "aba"], { a: ["#ffffff", "#ffe066", "#ff9ab8"][i % 3], b: "#f0a030" });
          }
          // Setas rojas con puntos blancos y arbustos con bayas
          for (const [x, y] of [[30, 58], [36, 60], [104, 57], [176, 59], [182, 61], [236, 58]]) {
            mapa(l, x - 2, y - 3, [".rrr.", "rwrwr", "rrrrr", "..c..", "..c.."], { r: "#d8382a", w: "#ffffff", c: "#f2e6cc" });
          }
          for (const x of [60, 150, 222]) {
            disco(l, x, 60, 5, "#3e8a32");
            disco(l, x - 1, 59, 4, "#5aac44");
            for (const [dx, dy] of [[-2, -1], [2, 0], [0, 2], [-3, 2], [3, -2]]) l.poner(x + dx, 60 + dy, "#e83a5a");
          }
        }),
        tira("bosque", (l, azar) => {
          // Rayos de luz entre los árboles
          for (const x0 of [30, 110, 190]) {
            for (let y = 0; y < 52; y++) for (let k = 0; k < 10; k++) if (umbral(x0 + k + y * 0.5, y) < 0.22) l.poner(x0 + k + Math.round(y * 0.5), y, "#fff8c8");
          }
          // Dos filas de árboles: los de atrás más pequeños y azulados, los de delante más vivos
          for (let i = 0; i < 12; i++) {
            arbolFrondoso(l, azar, Math.floor((i * l.ancho) / 12 + azar() * 8), 50, 24 + Math.floor(azar() * 8), ["#4a8a6a", "#5ea07a", "#7cbc90", "#a8dcb4"], ["#5a5a4a", "#6e6e5a"]);
          }
          for (let i = 0; i < 8; i++) {
            arbolFrondoso(l, azar, Math.floor((i * l.ancho) / 8 + 14 + azar() * 10), 55, 34 + Math.floor(azar() * 10), ["#2e7a2e", "#46983a", "#6cbc4a", "#a6e070"]);
          }
          monte(l, azar, { base: 55, alto: 4, ondas: [[3, 0.3], [6, 0.1]], color: "#4a9a40", claro: "#6ab852", a: 1, hasta: 57 });
        })
      ],
      turnosEscena: [{ capas: mariposas, pasos: ciclo(16, 2) }, { capas: motas, pasos: ciclo(6, 2) }],
      deriva: { duracion: 64, pasos: 256, mueve: { hojas: [-256, 0] } }
    });
  })(),

  // ---------- Glaceon: en un bloque de hielo de un glaciar, con polvo de diamante que brilla ----------
  glaceon: (() => {
    const polvo = [0, 1, 2].map((k) => ({ nombre: `polvo-${k}`, ancho: 96, alto: 96, repetir: "xy", sitio: { y: 0, desde: "arriba" }, pintar(l, azar) {
      for (let i = 0; i < 14; i++) {
        const [x, y] = [Math.floor(azar() * 96), Math.floor(azar() * 96)];
        if ((i + k) % 3 === 0) destello(l, x, y, ["#c4f2ff", "#ffffff"], i % 2 === 0);
        else l.poner(x, y, "#ffffff");
      }
    } }));
    return fondoEevee({
      comentario: "Glaceon: en un bloque de hielo de un glaciar, con montañas nevadas, acantilados de hielo y polvo de diamante que brilla",
      cielo: "linear-gradient(to bottom, #4aa6ea, #8ed0f6 50%, #d6f2ff)",
      pokemon: "glaceon",
      sitio: { centro: 38, suelo: 54 },
      capas: [
        ...polvo,
        aLaDerecha("bloque", 76, 40, 0, 0, (l) => {
          // Un bloque de hielo con la cara de arriba llana y las de los lados en ángulo, más anchas
          // abajo; brillos en diagonal
          for (let y = 1; y < l.alto; y++) {
            const abre = Math.round(y * 0.3);
            for (let x = 10 - abre; x < 66 + abre; x++) {
              const t = (x - (10 - abre)) / (56 + abre * 2);
              let c = t < 0.22 ? "#ecfbff" : t < 0.72 ? "#a6e2f6" : "#6eb8de";
              if (y < 3) c = "#ffffff";
              if ((x + y) % 17 === 0 && t < 0.72) c = "#ffffff";
              if (Math.abs(t - 0.22) < 0.012 || Math.abs(t - 0.72) < 0.012) c = "#d6f6ff";
              l.poner(x, y, c);
            }
          }
        }),
        tira("glaciar", (l, azar) => {
          let x = 0;
          while (x < l.ancho) {
            const ancho = 12 + Math.floor(azar() * 14);
            const alto = 12 + Math.floor(azar() * 16);
            for (let dx = 0; dx < ancho; dx++) {
              const pico = Math.round(alto - Math.abs(dx - ancho / 2) * 0.9);
              for (let y = 54 - pico; y < 56; y++) l.poner(x + dx, y, dx < ancho / 2 ? "#e2f8ff" : (dx + y) % 6 ? "#9ad8f0" : "#b8e6f8");
            }
            x += ancho - 2;
          }
          suelo(l, 54, ["#f6fcff", "#e2f2fc", "#cce4f4", "#b6d6ee"], 1);
          for (let i = 0; i < 40; i++) l.poner(Math.floor(azar() * l.ancho), 58 + Math.floor(azar() * 32), "#ffffff");
        }),
        tira("montanas", (l, azar) => {
          monte(l, azar, { base: 44, alto: 26, ondas: [[1, 0.4], [3, 0.14], [8, 0.04]], color: "#8ab0dc", claro: "#aecaec", a: 1, hasta: 56, nieve: 40 });
        })
      ],
      turnosEscena: [{ capas: polvo, pasos: ciclo(12, 3) }]
    });
  })(),

  // ---------- Sylveon: sentado en una nube, con cintas rosas y azules que ondean, corazones y destellos ----------
  sylveon: (() => {
    const CINTAS = [["#ff8ac0", "#ffc8e0"], ["#6ab0ff", "#c4dcff"]];
    const cintas = [0, 1].map((k) => tira(`cintas-${k}`, (l) => {
      // Dos cintas que ondulan (cada dibujo, con la onda algo más adelante)
      [[20, 6, 2, 0, 4], [30, 5, 3, 1.5, 3]].forEach(([y0, alto, vueltas, fase, grueso], i) => {
        for (let x = 0; x < l.ancho; x++) {
          const y = Math.round(y0 + Math.sin((2 * Math.PI * vueltas * x) / l.ancho + fase + k * 0.8) * alto);
          for (let n = 0; n < grueso; n++) l.poner(x, y + n, n === 0 ? CINTAS[i][1] : CINTAS[i][0]);
        }
      });
    }, 44, 36));
    const corazones = [0, 1].map((k) => tira(`corazones-${k}`, (l, azar) => {
      for (let i = 0; i < 7; i++) {
        const [x, y] = [Math.floor(azar() * l.ancho), Math.floor(azar() * 40)];
        if ((i + k) % 2) mapa(l, x, y, [".a.a.", "aaaaa", "aaaaa", ".aaa.", "..a.."], { a: i % 3 ? "#ff8ac0" : "#ffb0d8" });
        else destello(l, x + 2, y + 2, ["#ffd8f0", "#ffffff"], true);
      }
    }, 50, 40));
    return fondoEevee({
      comentario: "Sylveon: sentado en una nube de un cielo pastel, con cintas rosas y azules que ondean, corazones y destellos que titilan",
      cielo: "linear-gradient(to bottom, #9cc0ff, #e6c2f0 52%, #ffd6e6)",
      pokemon: "sylveon",
      sitio: { centro: 40, suelo: 55 },
      capas: [
        aLaDerecha("nube", 80, 40, 0, 0, (l) => {
          // Una nube grande y esponjosa: bultos arriba (donde se sienta) y más abajo
          nubeEsponjosa(l, 40, 16, 34, ["#ffffff", "#fff0f6", "#f2c6dc"], 1, 3);
          nubeEsponjosa(l, 36, 30, 36, ["#ffffff", "#fff4fa", "#f0c8dc"], 1, 5);
          for (let y = 30; y < l.alto; y++) for (let x = 2; x < 76; x++) l.poner(x, y, "#fff4fa");
        }),
        ...corazones,
        ...cintas,
        tira("nubes", (l, azar) => {
          for (let i = 0; i < 7; i++) nubeEsponjosa(l, i * 37 + Math.floor(azar() * 10), 50 + Math.floor(azar() * 4), 12 + Math.floor(azar() * 5), ["#ffffff", "#ffe4f2", "#f0c0d8"]);
          rect(l, 0, 52, l.ancho, l.alto - 52, "#ffe4f2");
          for (let i = 0; i < 9; i++) nubeEsponjosa(l, i * 29 + Math.floor(azar() * 8), 64 + Math.floor(azar() * 12), 10 + Math.floor(azar() * 6), ["#ffffff", "#fff4fa", "#f0c8dc"]);
        })
      ],
      turnosEscena: [{ capas: cintas, pasos: ciclo(8, 2) }, { capas: corazones, pasos: ciclo(6, 2) }]
    });
  })()
};

// ---------- Las regiones ----------
//
// Las que dan los logros de completar cada generación en la colección de «Juegos» (FONDOS_REGION,
// js/comun/fondos.js). Todas con el mismo formato, sencillo, como una página del Pasaporte de
// Entrenador de Sol y Luna:
//   · el papel: un degradado suave entre los colores de los legendarios;
//   · una banda pegada al borde de arriba y otra al de abajo (en todos los sitios), con un dibujo
//     que es de esa región (Poké Balls en Kanto, hojas de arce en Johto, olas en Hoenn...);
//   · los sellos de sus legendarios de carátula (herramientas/sellos-pixel.mjs), a la derecha y del
//     mismo tamaño, a un píxel de pantalla por píxel (capas finas).

const ALTO_BANDA = 8;
const LADO_SELLO = 64;
// En la ficha del perfil (la vista vertical), los sellos al doble y pegados a los lados, con lo de
// abajo por detrás del botón: lo de abajo a 32 px del borde (el botón acaba a 16)
const SELLO_VERTICAL_ABAJO = 32;

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

// Un fondo de región: papel, bandas y sellos (de izquierda a derecha). Los sellos, en cada vista:
//   · normal (la tarjeta de «Amigos»): a un píxel de pantalla por píxel, a la derecha, junto al nombre;
//   · horizontal (las muestras pequeñas): igual de tamaño, centrados entre las dos bandas (--sello-y);
//   · vertical (la ficha del perfil): al doble, el primero pegado a la izquierda y el último a la
//     derecha (con tres, el de en medio centrado y más arriba), con lo de abajo detrás del botón.
function fondoDeSellos({ comentario, papel, sellos, dibujo, colores }) {
  const n = sellos.length;
  const capas = sellos.map((nombre, i) => {
    const derecha = 4 + (n - 1 - i) * (LADO_SELLO + 6);
    const fig = sello(nombre);
    const LADO_V = fig.ancho * 2;
    const medio = n === 3 && i === 1;
    const subeV = medio ? 30 : 0;
    const xV = i === 0 ? "left 2px" : i === n - 1 ? "right 2px" : "center";
    return {
      nombre: `sello-${nombre}`, ancho: fig.ancho, alto: fig.alto, repetir: "no", fino: true,
      sitio: { x: derecha, lado: "derecha", y: 0, desde: "abajo" },
      donde: {
        x: `right ${derecha}px`, y: "top var(--sello-y)",
        muestra: (vista, TW, TH) => {
          if (vista === "vertical") {
            const x = i === 0 ? 2 : i === n - 1 ? TW - LADO_V - 2 : Math.round((TW - LADO_V) / 2);
            return [x, TH - LADO_V - SELLO_VERTICAL_ABAJO - subeV, 2];
          }
          return [TW - fig.ancho - derecha, vista === "horizontal" ? Math.round((TH - fig.alto) / 2) : TH - fig.alto - 92, 1];
        }
      },
      vertical: { tamano: `${LADO_V}px ${LADO_V}px`, css: `${xV} bottom ${SELLO_VERTICAL_ABAJO + subeV}px` },
      pintar: (l) => pintarFigura(l, fig, 0, 0)
    };
  });
  return {
    comentario,
    cielo: papel,
    vertical: true,
    capas: [...capas, banda("banda-arriba", DIBUJOS_BANDA[dibujo], colores, false), banda("banda-abajo", DIBUJOS_BANDA[dibujo], colores, true)]
  };
}

const REGIONES = {
  kanto: fondoDeSellos({
    comentario: "Kanto: los sellos de Articuno, Zapdos y Moltres, con bandas de Poké Balls",
    papel: "linear-gradient(105deg, #e8eef8, #f3ede6 50%, #f8e8dc)",
    sellos: ["articuno", "zapdos", "moltres"], dibujo: "pokeballs", colores: { fondo: "#f0e2d6", raya: "#c88a7a" }
  }),
  johto: fondoDeSellos({
    comentario: "Johto: los sellos de Ho-Oh y Lugia, con bandas de hojas de arce",
    papel: "linear-gradient(105deg, #f8e6cc, #f4ead8 50%, #e6eaf2)",
    sellos: ["hoOh", "lugia"], dibujo: "hojas", colores: { fondo: "#f2e2c6", raya: "#c89a62" }
  }),
  hoenn: fondoDeSellos({
    comentario: "Hoenn: los sellos de Groudon y Kyogre, con bandas de olas",
    papel: "linear-gradient(105deg, #f6e0d6, #f0ebe6 50%, #dde8f6)",
    sellos: ["groudon", "kyogre"], dibujo: "olas", colores: { fondo: "#a8d4f0", raya: "#3a84c8" }
  }),
  sinnoh: fondoDeSellos({
    comentario: "Sinnoh: los sellos de Dialga y Palkia, con bandas de diamantes y perlas",
    papel: "linear-gradient(105deg, #e0e6f6, #ede9f2 50%, #f4e4ee)",
    sellos: ["dialga", "palkia"], dibujo: "diamantes", colores: { fondo: "#e6e4f2", raya: "#9a9ac8" }
  }),
  teselia: fondoDeSellos({
    comentario: "Teselia: los sellos de Reshiram y Zekrom, con bandas en blanco y negro",
    papel: "linear-gradient(105deg, #f4f4f6, #ebebee 50%, #dadae2)",
    sellos: ["reshiram", "zekrom"], dibujo: "blancoNegro", colores: { fondo: "#f6f6f8", raya: "#2a2a32" }
  }),
  kalos: fondoDeSellos({
    comentario: "Kalos: los sellos de Xerneas e Yveltal, con bandas de la celosía de la Torre Prisma",
    papel: "linear-gradient(105deg, #dfe6f6, #ebe8f0 50%, #f4e0e2)",
    sellos: ["xerneas", "yveltal"], dibujo: "celosia", colores: { fondo: "#e4e6f4", raya: "#6a72b8" }
  }),
  alola: fondoDeSellos({
    comentario: "Alola: los sellos de Solgaleo y Lunala, con bandas de triángulos como las del Pasaporte",
    papel: "linear-gradient(105deg, #f7e8c8, #f4e8da 50%, #e4e2f4)",
    sellos: ["solgaleo", "lunala"], dibujo: "triangulos", colores: { fondo: "#efe0c2", raya: "#c8b080" }
  }),
  galar: fondoDeSellos({
    comentario: "Galar: los sellos de Zacian y Zamazenta, con bandas de tartán",
    papel: "linear-gradient(105deg, #dfe6f6, #ebe8ee 50%, #f4e0e0)",
    sellos: ["zacian", "zamazenta"], dibujo: "tartan", colores: { fondo: "#b8343e", raya: "#5a1a20" }
  }),
  paldea: fondoDeSellos({
    comentario: "Paldea: los sellos de Koraidon y Miraidon, con bandas de azulejos",
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
    const l = lienzo(capa.ancho, capa.alto, capa.repetir === "xy");
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

const QUIEN = ":is(.ficha-jugador, .perfil-fondo, .perfil-cabeza, .logro-premio, .tienda-muestra, .lleva-fondo)";
const px = (n) => (n === 0 ? "0" : `calc(${Math.round(n * 100) / 100} * var(--px))`);
const REPETIR = { x: "repeat-x", xy: "repeat", no: "no-repeat" };

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
  const horizontal = lado === "derecha" ? `right ${px(x - dx)}` : `left ${px(x + dx)}`;
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
  const imagenes = [...fondo.capas.map((capa) => `url("../img/fondos/${capa.archivo}.png")`), ...debajoDe(fondo)];
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
    const x0 = Math.round(lado === "derecha" ? TW0 - capa.ancho - (x - dx) : x + dx);
    const y0 = Math.round(desde === "abajo" ? TH0 - capa.alto - (y - dy) : y + dy);
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        let sx = Math.floor(tx / k) - x0;
        let sy = Math.floor(ty / k) - y0;
        if (capa.repetir !== "no") sx = vuelta(sx, capa.ancho);
        if (capa.repetir === "xy") sy = vuelta(sy, capa.alto);
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
  { vista: "horizontal", ancho: 260, alto: 80, px: 1, encima: [] }
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
