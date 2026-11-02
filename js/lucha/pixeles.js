// ---------- Combates: dibujitos en pixel art (púas, rocas, telaraña, joya tera, escudo...) ----------
//
// Hechos aquí, píxel a píxel: unos con un mapa de letras (cada letra, un color de su paleta) y otros
// calculados (la telaraña, el escudo). Salen como imágenes (data:) que el css amplía sin suavizar al
// mismo tamaño de píxel que el escenario (--px, que pone js/lucha/index.js), para que casen con él.
// Cada uno se dibuja una vez y se guarda.

const guardadas = new Map();

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const hex = ([r, g, b]) => `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
const mezcla = (a, b, t) => hex(rgb(a).map((n, i) => n + (rgb(b)[i] - n) * t));

// Un lienzo de ancho×alto; pinta(poner) dibuja en él; devuelve la imagen como data:
function dibujo(clave, ancho, alto, pinta) {
  if (guardadas.has(clave)) return guardadas.get(clave);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  const datos = ctx.createImageData(ancho, alto);
  const poner = (x, y, color, alfa = 255) => {
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
    const i = (y * ancho + x) * 4;
    const [r, g, b] = rgb(color);
    datos.data.set([r, g, b, alfa], i);
  };
  pinta(poner);
  ctx.putImageData(datos, 0, 0);
  const url = canvas.toDataURL();
  guardadas.set(clave, url);
  return url;
}

// Con un mapa: cada fila, un texto; cada letra, un color de la paleta («.» es transparente)
function deMapa(clave, mapa, paleta) {
  return dibujo(clave, mapa[0].length, mapa.length, (poner) => {
    mapa.forEach((fila, y) => [...fila].forEach((letra, x) => {
      if (paleta[letra]) poner(x, y, paleta[letra]);
    }));
  });
}

// ---------- Púas (y Púas Tóxicas) ----------

const PUA = [
  "....o....",
  "...olo...",
  "...lbo...",
  "..olbdo..",
  "..lbbdo..",
  ".olbbddo.",
  "olbbbbddo",
  ".ooooooo."
];

export function urlPua(toxica = false) {
  const paleta = toxica
    ? { o: "#3a1450", l: "#f1c4ff", b: "#b04ed6", d: "#6e2390" }
    : { o: "#2e2f38", l: "#f0f0f5", b: "#9a9ca8", d: "#5e6070" };
  return deMapa(`pua-${toxica}`, PUA, paleta);
}

// ---------- Trampa Rocas (y Aceroaracnoide) ----------

const ROCA = [
  "....o.....",
  "...olo....",
  "..ollbo...",
  "..olbbbo..",
  ".ollbbbdo.",
  "olllbbddo.",
  "olbbbbdddo",
  ".obbbddoo.",
  "..ooooo..."
];

export function urlRoca(acero = false) {
  const paleta = acero
    ? { o: "#2c2f3a", l: "#ffffff", b: "#b6bccc", d: "#6f7488" }
    : { o: "#3b2a17", l: "#e8cf96", b: "#a8834a", d: "#6b5230" };
  return deMapa(`roca-${acero}`, ROCA, paleta);
}

// ---------- Red Viscosa: anillos y radios en una elipse ----------

export function urlTelarana() {
  const ancho = 37;
  const alto = 15;
  return dibujo("telarana", ancho, alto, (poner) => {
    const cx = (ancho - 1) / 2;
    const cy = (alto - 1) / 2;
    // Una línea de píxeles de un punto a otro
    const linea = (x0, y0, x1, y1) => {
      const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= pasos; i++) poner(Math.round(x0 + ((x1 - x0) * i) / pasos), Math.round(y0 + ((y1 - y0) * i) / pasos), "#ffffff", 220);
    };
    const radios = 8;
    const punto = (k, r) => {
      const a = (k / radios) * Math.PI * 2;
      return [cx + Math.cos(a) * cx * r, cy + Math.sin(a) * cy * r];
    };
    // Los radios, de cerca del centro al borde (sin llegar al centro: ahí se amontonarían)
    for (let k = 0; k < radios; k++) linea(...punto(k, 0.15), ...punto(k, 1));
    // Los anillos: rectas de un radio al siguiente, como en una telaraña de verdad
    for (const r of [0.42, 0.75, 1]) {
      for (let k = 0; k < radios; k++) linea(...punto(k, r), ...punto(k + 1, r));
    }
  });
}

// ---------- La joya de la teracristalización, del color de su teratipo ----------

const JOYA = [
  "....o....",
  "...owo...",
  "..owlbo..",
  ".owllbbo.",
  "olllbbbdo",
  "ollbbbddo",
  "ollbbbddo",
  ".olbbddo.",
  "..obddo..",
  "...odo...",
  "....o...."
];

export function urlJoya(color) {
  return deMapa(`joya-${color}`, JOYA, {
    o: mezcla(color, "#000000", 0.55),
    w: "#ffffff",
    l: mezcla(color, "#ffffff", 0.6),
    b: color,
    d: mezcla(color, "#000000", 0.25)
  });
}

// ---------- El escudo de Protección (y los de su familia), del color de cada uno ----------

export function urlEscudo(color) {
  const lado = 34;
  const c = (lado - 1) / 2;
  return dibujo(`escudo-${color}`, lado, lado, (poner) => {
    const borde = mezcla(color, "#ffffff", 0.35);
    const oscuro = mezcla(color, "#000000", 0.3);
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        const r = Math.hypot(x - c, y - c);
        if (r > 16.5) continue;
        if (r > 15) poner(x, y, oscuro);
        else if (r > 13.6) poner(x, y, borde);
        // Por dentro, una trama suave (uno sí y otro no) y un brillo arriba a la izquierda
        else if ((x + y) % 2 === 0) poner(x, y, color, 90);
        if (r > 9 && r < 12 && x < c - 3 && y < c - 3 && (x + y) % 2 === 0) poner(x, y, "#ffffff", 200);
      }
    }
  });
}

// ---------- Las flechas de las subidas (azul, hacia arriba) y bajadas (roja, hacia abajo) ----------

const FLECHA = [
  "...o...",
  "..olo..",
  ".ollbo.",
  "ollbbbo",
  "oolbboo",
  "..lbo..",
  "..lbo..",
  "..lbo..",
  "..ooo.."
];

export function urlFlecha(sube) {
  const mapa = sube ? FLECHA : [...FLECHA].reverse();
  const paleta = sube
    ? { o: "#1d4f8a", l: "#cfeaff", b: "#4aa3ff" }
    : { o: "#8a1d1d", l: "#ffd0d0", b: "#ff5a5a" };
  return deMapa(`flecha-${sube}`, mapa, paleta);
}

// ---------- La trama de las pantallas (Reflejo, Pantalla de Luz...) ----------

export function urlTrama(color) {
  return dibujo(`trama-${color}`, 4, 4, (poner) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) poner(x, y, color, x === 0 && y === 0 ? 150 : 70);
  });
}
