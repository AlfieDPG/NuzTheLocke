// ---------- Combates: el escenario del campo, en pixel art ----------
//
// Un paisaje pintado píxel a píxel en un lienzo pequeño (180 de alto y el ancho que pida la forma del
// campo: 320 si es 16:9) y ampliado sin suavizar (css:
// image-rendering: pixelated), para que case con los sprites. Uno de seis: pradera, atardecer,
// noche, nieve, playa y cueva. Quien reta puede elegirlo (lucha.escena); si no, sale uno al azar, siempre
// el mismo en cada combate (se elige con su id). Sus
// detalles colocados con un azar fijo: los dos jugadores lo ven igual. Las nubes van en otra capa,
// que se desplaza despacio.
//
// Lo dibuja todo el código: nada de imágenes de otros ni hechas con IA.
//
// Las dos plataformas están en PUESTOS, y la pantalla (js/lucha/index.js) coloca con esos mismos números
// los pies de cada Pokémon, sus púas y sus pantallas: así siempre están encima de su plataforma.

// El ancho cambia con la forma del campo (se pone antes de pintar); el alto, no
let W = 320;
const H = 180;
const HORIZONTE = 74;

const ESCENAS = {
  pradera: {
    cielo: ["#5aa6e0", "#7cbfea", "#a8d8f2", "#d4eef8"], astro: { tipo: "sol", x: 252, y: 22, r: 9, color: "#fff6c8", halo: "#ffe58a" },
    montes: ["#8fb4c8", "#a9c9d8"], colinas: ["#6fa75c", "#86bb6c"], arboles: { forma: "redondo", color: ["#3f7a3a", "#56954a", "#7cb860"] },
    suelo: ["#86c064", "#74b257", "#62a049"], franja: "#93ca70", detalle: "flores",
    plataforma: { cara: "#a3d27c", borde: "#5b8f40", brillo: "#c1e49a" }, nubes: ["#ffffff", "#dceaf3"]
  },
  atardecer: {
    cielo: ["#e07a52", "#f0a060", "#f6c584", "#f9e0b0"], astro: { tipo: "sol", x: 70, y: 58, r: 14, color: "#ffd9a0", halo: "#ff9e5e" },
    montes: ["#b07068", "#c98a78"], colinas: ["#8a5a4e", "#a06a58"], arboles: { forma: "pino", color: ["#4a302c", "#5e3c36", "#6e4a40"] },
    suelo: ["#b08458", "#9a7048", "#84603c"], franja: "#bc9264", detalle: "hierba",
    plataforma: { cara: "#c9a070", borde: "#6e5034", brillo: "#e0bd8c" }, nubes: ["#ffd8b8", "#f0b090"]
  },
  noche: {
    cielo: ["#0d1330", "#18224a", "#26346a", "#3a4a86"], astro: { tipo: "luna", x: 246, y: 26, r: 8, color: "#f3f1e2", halo: "#7f90d0" },
    montes: ["#202a52", "#2c3868"], colinas: ["#1c3040", "#24404e"], arboles: { forma: "pino", color: ["#0e1c2c", "#152838", "#1d3446"] },
    suelo: ["#2c4c44", "#24403a", "#1c3430"], franja: "#335a50", detalle: "hierba", estrellas: true,
    plataforma: { cara: "#3c645a", borde: "#16302a", brillo: "#4e7e70" }, nubes: ["#3a4880", "#2c386a"]
  },
  nieve: {
    cielo: ["#94b6d4", "#adc8de", "#cadced", "#e6f0f8"], astro: { tipo: "sol", x: 60, y: 20, r: 8, color: "#fffbe8", halo: "#ffffff" },
    montes: ["#a9bed2", "#c4d4e2"], colinas: ["#dbe6ef", "#eaf1f6"], cumbres: true, arboles: { forma: "pino", color: ["#3e5e5a", "#4e7370", "#ffffff"], nevado: true },
    suelo: ["#f2f7fb", "#e2ecf4", "#cddbe7"], franja: "#ffffff", detalle: "brillos",
    plataforma: { cara: "#ffffff", borde: "#9fb6cc", brillo: "#ffffff" }, nubes: ["#ffffff", "#e4edf4"]
  },
  playa: {
    cielo: ["#3fb0e2", "#64c4ec", "#98daf2", "#cdeef9"], astro: { tipo: "sol", x: 262, y: 18, r: 9, color: "#fffbe0", halo: "#ffe98a" },
    mar: ["#1f86b8", "#2e9ccc", "#5cc0e0"], arboles: { forma: "palmera", color: ["#2f7a44", "#3f9454", "#7a5a38"] },
    suelo: ["#f0dca4", "#e6cc8c", "#d6b874"], franja: "#f6e6b8", detalle: "conchas",
    plataforma: { cara: "#f8ecc4", borde: "#b8975a", brillo: "#fff8e0" }, nubes: ["#ffffff", "#dff2fa"]
  },
  cueva: {
    cielo: ["#141118", "#1d1922", "#28222e", "#332b3a"], montes: ["#231e28", "#2c2532"], colinas: ["#30293a", "#3a3244"],
    suelo: ["#4e4248", "#43383e", "#382e34"], franja: "#574a51", detalle: "cristales", estalactitas: true,
    plataforma: { cara: "#6a5c62", borde: "#2a2226", brillo: "#83747a" }
  }
};

export const NOMBRES_ESCENAS = Object.keys(ESCENAS);

// Dónde está la plataforma de cada uno, en partes del campo: el centro (x, y) y el radio (rx, del ancho;
// ry, del alto). «pies»: dónde van los pies del Pokémon (un poco por debajo del centro de la plataforma).
export const PUESTOS = {
  suyo: { x: 0.7, y: 0.53, rx: 0.135, ry: 0.045 },
  mio: { x: 0.27, y: 0.86, rx: 0.19, ry: 0.075 }
};
for (const puesto of Object.values(PUESTOS)) puesto.pies = puesto.y + puesto.ry * 0.3;

// Un azar fijo a partir de un texto (el id del combate)
function azarFijo(texto) {
  let h = 2166136261;
  for (const letra of String(texto)) h = Math.imul(h ^ letra.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let x = h;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function escenaDe(id) {
  return NOMBRES_ESCENAS[Math.floor(azarFijo(id)() * NOMBRES_ESCENAS.length)];
}

// Trama de Bayer 4×4: para pasar de un color a otro sin degradado suave (como en los juegos)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
const umbral = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

// Un lienzo de píxeles: poner uno, rellenar trozos y pasarlo al <canvas>
function lienzo(ancho, alto) {
  const datos = new Uint8ClampedArray(ancho * alto * 4);
  const poner = (x, y, color, alfa = 255) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
    const i = (y * ancho + x) * 4;
    const [r, g, b] = typeof color === "string" ? rgb(color) : color;
    datos[i] = r;
    datos[i + 1] = g;
    datos[i + 2] = b;
    datos[i + 3] = alfa;
  };
  return { datos, poner, ancho, alto };
}

// Degradado vertical por bandas con trama entre una y otra
function degradado(l, y0, y1, colores) {
  const lista = colores.map(rgb);
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (lista.length - 1);
    const banda = Math.min(lista.length - 2, Math.floor(t));
    const parte = t - banda;
    for (let x = 0; x < l.ancho; x++) l.poner(x, y, parte > umbral(x, y) ? lista[banda + 1] : lista[banda]);
  }
}

function disco(l, cx, cy, r, color, alfa = 255) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) l.poner(cx + x, cy + y, color, alfa);
}

// Una silueta de montes: alto de cada columna con ondas y un poco de azar; la cara que mira a la
// izquierda, más clara (la luz viene de ahí)
function siluetas(l, azar, colores, base, alto, ondas, { cumbres = false } = {}) {
  const fases = ondas.map(() => azar() * Math.PI * 2);
  const altura = (x) => base - alto * (0.55 + ondas.reduce((suma, [frecuencia, peso], i) => suma + Math.sin(x * frecuencia + fases[i]) * peso, 0));
  for (let x = 0; x < W; x++) {
    const y0 = Math.round(altura(x));
    const subiendo = altura(x + 1) < altura(x - 1);
    for (let y = y0; y <= HORIZONTE + 2; y++) {
      let color = y - y0 < 2 && subiendo ? colores[1] : colores[0];
      if (cumbres && y < base - alto * 0.9 && y - y0 < 6) color = (y - y0 + x) % 5 ? "#ffffff" : "#e2ecf4";
      l.poner(x, y, color);
    }
  }
}

function pino(l, x, y, tam, [oscuro, claro, punta], nevado) {
  const alto = tam;
  for (let fila = 0; fila < alto; fila++) {
    const ancho = Math.floor((fila % Math.ceil(alto / 3)) * 0.8 + fila / 3) + 1;
    for (let dx = -ancho; dx <= ancho; dx++) l.poner(x + dx, y - alto + fila, dx < 0 ? claro : oscuro);
    if (nevado && fila % Math.ceil(alto / 3) === 0) for (let dx = -ancho; dx <= ancho; dx++) l.poner(x + dx, y - alto + fila, punta);
  }
  l.poner(x, y, "#4a3424");
  l.poner(x, y + 1, "#4a3424");
}

function redondo(l, x, y, tam, [oscuro, claro, brillo]) {
  const r = Math.max(3, Math.round(tam / 2));
  l.poner(x, y, "#5a3e28");
  l.poner(x, y - 1, "#5a3e28");
  disco(l, x, y - r - 1, r, oscuro);
  disco(l, x - 1, y - r - 2, r - 1, claro);
  l.poner(x - Math.ceil(r / 2), y - r - Math.ceil(r / 2) - 1, brillo);
  l.poner(x - Math.ceil(r / 2) + 1, y - r - Math.ceil(r / 2) - 1, brillo);
}

function palmera(l, x, y, tam, [oscuro, claro, tronco]) {
  for (let i = 0; i < tam; i++) {
    const tx = x + Math.round(Math.sin(i / tam) * 3);
    l.poner(tx, y - i, i % 3 ? tronco : "#5e4428");
    l.poner(tx + 1, y - i, "#5e4428");
  }
  const cx = x + 3;
  const cy = y - tam;
  for (const [dx, dy] of [[-1, 0.4], [1, 0.4], [-0.7, -0.3], [0.7, -0.3], [0, -0.7]]) {
    for (let k = 1; k <= tam * 0.6; k++) {
      const caida = (k * k) / (tam * 1.2);
      l.poner(cx + dx * k, cy + dy * k + caida, k % 2 ? oscuro : claro);
    }
  }
}

// Una plataforma: elipse con la cara clara, el borde oscuro abajo y un brillo arriba
function plataforma(l, cx, cy, rx, ry, { cara, borde, brillo }) {
  for (let y = -ry - 1; y <= ry + 2; y++) {
    for (let x = -rx - 1; x <= rx + 1; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d <= 1) {
        const color = y > ry * 0.45 && d > 0.55 ? borde : y < -ry * 0.55 && d > 0.62 ? brillo : cara;
        l.poner(cx + x, cy + y, color);
      } else if (y > 0 && (x * x) / (rx * rx) + ((y - 2) * (y - 2)) / (ry * ry) <= 1) {
        l.poner(cx + x, cy + y, borde); // el canto de la plataforma
      }
    }
  }
}

// Lo pequeño del suelo: flores, hierba, conchas, brillos de nieve, cristales de cueva
function detalles(l, azar, tipo, escena) {
  const evita = (x, y) => Object.values(PUESTOS).some((p) => Math.abs(x - W * p.x) < W * p.rx + 4 && Math.abs(y - H * p.y) < H * p.ry + 3);
  for (let i = 0; i < 140; i++) {
    const y = HORIZONTE + 4 + Math.floor(azar() ** 1.3 * (H - HORIZONTE - 4));
    const x = Math.floor(azar() * W);
    if (evita(x, y)) continue;
    const cerca = (y - HORIZONTE) / (H - HORIZONTE);
    if (tipo === "flores") {
      if (i % 3) {
        l.poner(x, y, escena.suelo[2]);
        l.poner(x - 1, y - 1, escena.suelo[2]);
        l.poner(x + 1, y - 1, escena.suelo[2]);
      } else {
        const color = ["#ffffff", "#ffe066", "#ff8fb1", "#c9a2ff"][i % 4];
        l.poner(x, y, color);
        if (cerca > 0.5) {
          l.poner(x - 1, y, color);
          l.poner(x + 1, y, color);
          l.poner(x, y - 1, color);
          l.poner(x, y + 1, "#ffe066");
        }
      }
    } else if (tipo === "hierba") {
      l.poner(x, y, escena.suelo[2]);
      l.poner(x - 1, y - 1, escena.suelo[2]);
      l.poner(x + 1, y - 1, escena.suelo[2]);
      if (cerca > 0.5) l.poner(x, y - 2, escena.suelo[2]);
    } else if (tipo === "conchas") {
      if (i % 4) continue;
      l.poner(x, y, "#fff3e3");
      l.poner(x + 1, y, "#f2c6b0");
    } else if (tipo === "brillos") {
      if (i % 2) continue;
      l.poner(x, y, "#ffffff");
      l.poner(x, y - 1, "#cfe4f6");
    } else if (tipo === "cristales") {
      if (i % 5) continue;
      const color = ["#8ad7ff", "#c79bff", "#7fffd4"][i % 3];
      for (let k = 0; k < 4; k++) {
        l.poner(x, y - k, color);
        if (k < 2) l.poner(x + 1, y - k, "#ffffff");
      }
    }
  }
}

function pintarFondo(id, nombre) {
  const e = ESCENAS[nombre];
  const azar = azarFijo(`${id}-detalles`);
  const l = lienzo(W, H);

  degradado(l, 0, HORIZONTE + 2, e.cielo);
  if (e.estrellas) {
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(azar() * W);
      const y = Math.floor(azar() * (HORIZONTE - 20));
      l.poner(x, y, i % 4 ? "#c9d4ff" : "#ffffff");
      if (i % 9 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) l.poner(x + dx, y + dy, "#8a9ad8");
    }
  }
  if (e.astro) {
    const { y, r, color, halo, tipo } = e.astro;
    const x = Math.round((e.astro.x * W) / 320); // en el mismo sitio aunque el lienzo sea más ancho
    // El halo con trama: más denso cerca del astro
    for (let dy = -r * 3; dy <= r * 3; dy++) {
      for (let dx = -r * 3; dx <= r * 3; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r && d < r * 2.6 && (1 - (d - r) / (r * 1.6)) * 0.55 > umbral(x + dx, y + dy)) l.poner(x + dx, y + dy, halo);
      }
    }
    disco(l, x, y, r, color);
    if (tipo === "luna") disco(l, x + Math.round(r * 0.45), y - Math.round(r * 0.25), r - 1, e.cielo[0]);
  }
  if (e.estalactitas) {
    let x = 0;
    while (x < W) {
      const ancho = 4 + Math.floor(azar() * 10);
      const largo = 6 + Math.floor(azar() * 26);
      for (let fila = 0; fila < largo; fila++) {
        const media = Math.floor((ancho / 2) * (1 - fila / largo));
        for (let dx = -media; dx <= media; dx++) l.poner(x + ancho / 2 + dx, fila, dx < 0 ? "#2a2430" : "#0e0b12");
      }
      x += ancho;
    }
  }
  if (e.mar) {
    degradado(l, HORIZONTE - 12, HORIZONTE + 2, e.mar);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(azar() * W);
      const y = HORIZONTE - 10 + Math.floor(azar() * 11);
      for (let k = 0; k < 3; k++) l.poner(x + k, y, "#e6f7ff");
    }
  }
  if (e.montes) siluetas(l, azar, e.montes, HORIZONTE - 8, 30, [[0.03, 0.35], [0.071, 0.2], [0.17, 0.06]], { cumbres: e.cumbres });
  if (e.colinas) siluetas(l, azar, e.colinas, HORIZONTE + 2, 12, [[0.02, 0.4], [0.05, 0.25]]);
  if (e.arboles) {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(azar() * W);
      if (e.arboles.forma === "palmera" && i % 3) continue; // pocas palmeras, y más grandes
      if (Math.abs(x - W * PUESTOS.suyo.x) < W * PUESTOS.suyo.rx + 4) continue; // no detrás del Pokémon del rival
      const tam = 7 + Math.floor(azar() * 7);
      const y = HORIZONTE + Math.floor(azar() * 3);
      if (e.arboles.forma === "pino") pino(l, x, y, tam + 3, e.arboles.color, e.arboles.nevado);
      else if (e.arboles.forma === "palmera") palmera(l, x, y, tam + 12, e.arboles.color);
      else redondo(l, x, y, tam, e.arboles.color);
    }
  }

  // El suelo: de lejos más claro, con trama entre tono y tono, y (en los de hierba) franjas suaves de
  // césped segado que se abren desde lejos. En la cueva y la playa, motas en vez de franjas.
  const suelo = e.suelo.map(rgb);
  const franja = rgb(e.franja);
  const fuga = HORIZONTE - 50;
  const conFranjas = !e.estalactitas && !e.mar;
  for (let y = HORIZONTE + 2; y < H; y++) {
    const t = (y - HORIZONTE) / (H - HORIZONTE);
    for (let x = 0; x < W; x++) {
      const tono = Math.max(0, Math.min(2, Math.floor(t * 2.2 + umbral(x, y) - 0.4)));
      const u = (x - W / 2) / (y - fuga);
      const enFranja = conFranjas && Math.floor(u * 2.4 + 100) % 2 === 0 && (x + y) % 2 === 0;
      l.poner(x, y, enFranja ? franja : suelo[tono]);
    }
  }
  if (!conFranjas) {
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(azar() * W);
      const y = HORIZONTE + 3 + Math.floor(azar() * (H - HORIZONTE - 3));
      l.poner(x, y, i % 3 ? suelo[2] : franja);
    }
  }
  detalles(l, azar, e.detalle, e);

  // Las plataformas de los dos Pokémon
  for (const p of [PUESTOS.suyo, PUESTOS.mio]) {
    plataforma(l, Math.round(W * p.x), Math.round(H * p.y), Math.round(W * p.rx), Math.round(H * p.ry), e.plataforma);
  }
  return l;
}

// Las nubes: una tira el doble de ancha (dos veces lo mismo) que se desplaza sin que se note el corte
function pintarNubes(id, nombre) {
  const e = ESCENAS[nombre];
  const l = lienzo(W * 2, 60);
  if (!e.nubes) return l;
  const azar = azarFijo(`${id}-nubes`);
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(azar() * W);
    const cy = 10 + Math.floor(azar() * 36);
    const ancho = 10 + Math.floor(azar() * 14);
    for (let copia = 0; copia < 2; copia++) {
      const x0 = cx + copia * W;
      for (let k = -2; k <= 2; k++) disco(l, x0 + k * (ancho / 3), cy - (2 - Math.abs(k)) * 2, 4 + (2 - Math.abs(k)), e.nubes[0]);
      for (let x = -ancho; x <= ancho; x++) l.poner(x0 + x, cy + 5, e.nubes[1]);
    }
  }
  return l;
}

// Una miniatura de cada escenario, para elegirlo al retar (data:, se pinta una vez)
const miniaturas = new Map();

export function miniaturaEscena(nombre) {
  if (!miniaturas.has(nombre)) {
    const canvas = document.createElement("canvas");
    volcar(canvas, pixelesDeEscena("muestra", nombre, 320).fondo);
    miniaturas.set(nombre, canvas.toDataURL());
  }
  return miniaturas.get(nombre);
}

function volcar(canvas, l) {
  canvas.width = l.ancho;
  canvas.height = l.alto;
  canvas.getContext("2d").putImageData(new ImageData(l.datos, l.ancho, l.alto), 0, 0);
}

// Los píxeles de un escenario, sin pintarlos (también para probarlo fuera del navegador)
export function pixelesDeEscena(id, nombre = escenaDe(id), ancho = 320) {
  W = ancho;
  return { fondo: pintarFondo(id, nombre), nubes: pintarNubes(id, nombre) };
}

// Pinta el escenario en los dos lienzos del campo (.lucha-escena y .lucha-nubes)
// con el ancho que pida la forma del campo (si no ha cambiado desde la última vez, no hace nada).
// elegida: la que eligió quien retó ("" o nada: una al azar)
export function pintarEscena(arena, id, elegida = "") {
  const nombre = ESCENAS[elegida] ? elegida : escenaDe(id);
  const ancho = arena.clientHeight ? Math.max(200, Math.min(900, Math.round((H * arena.clientWidth) / arena.clientHeight))) : 320;
  if (arena.dataset.escena === nombre && Number(arena.dataset.anchoEscena) === ancho) return;
  arena.dataset.escena = nombre;
  arena.dataset.anchoEscena = String(ancho);
  const { fondo, nubes } = pixelesDeEscena(id, nombre, ancho);
  const lienzoFondo = arena.querySelector(".lucha-escena");
  const lienzoNubes = arena.querySelector(".lucha-nubes");
  if (lienzoFondo) volcar(lienzoFondo, fondo);
  if (lienzoNubes) {
    volcar(lienzoNubes, nubes);
    lienzoNubes.hidden = !ESCENAS[nombre].nubes;
  }
}
