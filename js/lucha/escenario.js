// ---------- Combates: el escenario del campo ----------
//
// Un paisaje dibujado aquí en SVG (cielo, sol o luna, nubes, montes, árboles y suelo), uno de seis:
// pradera, atardecer, noche, nieve, playa y cueva. Sale siempre el mismo para cada combate (se
// elige con su id) y con sus detalles colocados al azar, pero con un azar fijo: los dos jugadores
// lo ven igual. Las plataformas donde están los Pokémon no van aquí: van bajo cada sprite (css).
//
// Lo dibuja todo el código: nada de imágenes de otros.

const ANCHO = 1600;
const ALTO = 900;
const HORIZONTE = 410; // donde empieza el suelo (la plataforma del rival está un poco más abajo)

const ESCENAS = {
  pradera: {
    cielo: ["#6fb7e8", "#cdeaf7"], astro: { tipo: "sol", color: "#fff4c2", brillo: "#ffe58a", x: 1260, y: 120, r: 48 },
    montes: "#a9c7d6", colinas: "#7fb36a", arboles: { color: "#4f8a45", forma: "redondo" },
    suelo: ["#8cc46a", "#5f9a48"], franja: "rgba(255,255,255,0.07)", detalle: "flores", nubes: "#ffffff"
  },
  atardecer: {
    cielo: ["#f2a65a", "#f7d9a6"], astro: { tipo: "sol", color: "#ffd7a1", brillo: "#ff9e5e", x: 380, y: 300, r: 70 },
    montes: "#c9877a", colinas: "#9a6a5a", arboles: { color: "#5a3f3a", forma: "pino" },
    suelo: ["#b3895f", "#7d5c40"], franja: "rgba(255,230,190,0.08)", detalle: "hierba", nubes: "#ffe0c4"
  },
  noche: {
    cielo: ["#141c3a", "#3b4778"], astro: { tipo: "luna", color: "#f3f1e2", brillo: "#9fb0e8", x: 1220, y: 130, r: 40 },
    montes: "#2c3560", colinas: "#253a4a", arboles: { color: "#16263a", forma: "pino" },
    suelo: ["#2f5248", "#1d3530"], franja: "rgba(180,210,255,0.05)", detalle: "hierba", nubes: "#4b5a8c", estrellas: true
  },
  nieve: {
    cielo: ["#a9c4dc", "#e8f1f8"], astro: { tipo: "sol", color: "#fffbe8", brillo: "#ffffff", x: 300, y: 110, r: 38 },
    montes: "#c3d3e2", colinas: "#e9f0f6", arboles: { color: "#5b7d78", forma: "pino", nevado: true },
    suelo: ["#f4f8fb", "#cfdbe6"], franja: "rgba(140,170,200,0.10)", detalle: "brillos", nubes: "#ffffff", cumbres: true
  },
  playa: {
    cielo: ["#5cc2ea", "#d6f3fb"], astro: { tipo: "sol", color: "#fffbe0", brillo: "#ffe98a", x: 1300, y: 100, r: 44 },
    mar: ["#2e9ccc", "#7fd3ea"], arboles: { color: "#3d8a52", forma: "palmera" },
    suelo: ["#f2dfaa", "#d8bc7c"], franja: "rgba(255,255,255,0.10)", detalle: "conchas", nubes: "#ffffff"
  },
  cueva: {
    cielo: ["#1d1a22", "#3a3340"], montes: "#2b2630", colinas: "#38303c",
    suelo: ["#5a4d52", "#352c31"], franja: "rgba(255,220,180,0.04)", detalle: "cristales", estalactitas: true
  }
};

export const NOMBRES_ESCENAS = Object.keys(ESCENAS);

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
  const azar = azarFijo(id);
  return NOMBRES_ESCENAS[Math.floor(azar() * NOMBRES_ESCENAS.length)];
}

// Una cordillera: picos al azar entre dos alturas
function cordillera(azar, color, alto, bajo, picos, { cumbres = false } = {}) {
  const paso = ANCHO / picos;
  let d = `M0 ${HORIZONTE + 20}`;
  const nieve = [];
  for (let i = 0; i <= picos; i++) {
    const x = i * paso + azar() * paso * 0.4;
    const y = alto + azar() * (bajo - alto);
    d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
    if (cumbres && y < alto + (bajo - alto) * 0.6) {
      nieve.push(`<path d="M${x - 34} ${y + 40} L${x} ${y} L${x + 34} ${y + 40} L${x + 14} ${y + 32} L${x} ${y + 44} L${x - 12} ${y + 30} Z" fill="#ffffff" opacity="0.9"/>`);
    }
    d += ` L${(x + paso / 2).toFixed(0)} ${(bajo + 20 + azar() * 30).toFixed(0)}`;
  }
  d += ` L${ANCHO} ${HORIZONTE + 20} Z`;
  return `<path d="${d}" fill="${color}"/>${nieve.join("")}`;
}

// Colinas suaves por delante de los montes
function colinas(azar, color) {
  let d = `M0 ${HORIZONTE + 10}`;
  let x = 0;
  while (x < ANCHO) {
    const ancho = 220 + azar() * 260;
    const alto = HORIZONTE - 30 - azar() * 60;
    d += ` Q${(x + ancho / 2).toFixed(0)} ${alto.toFixed(0)} ${(x + ancho).toFixed(0)} ${HORIZONTE - 5}`;
    x += ancho;
  }
  d += ` L${ANCHO} ${HORIZONTE + 10} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

function arbol(x, y, tam, { color, forma, nevado }) {
  if (forma === "pino") {
    const nieve = nevado ? `<path d="M${x} ${y - tam * 1.6} L${x - tam * 0.35} ${y - tam * 1.05} L${x + tam * 0.35} ${y - tam * 1.05} Z" fill="#ffffff"/>` : "";
    return `<path d="M${x} ${y - tam * 1.6} L${x - tam * 0.55} ${y - tam * 0.5} L${x - tam * 0.25} ${y - tam * 0.5} L${x - tam * 0.7} ${y} L${x + tam * 0.7} ${y} L${x + tam * 0.25} ${y - tam * 0.5} L${x + tam * 0.55} ${y - tam * 0.5} Z" fill="${color}"/>${nieve}`;
  }
  if (forma === "palmera") {
    const hojas = [-60, -25, 10, 45, 80].map((g) => {
      const rad = ((g - 90) * Math.PI) / 180;
      const fx = x + 6 + Math.cos(rad) * tam * 1.1;
      const fy = y - tam * 1.8 + Math.sin(rad) * tam * 0.6 + tam * 0.3;
      return `<path d="M${x + 6} ${y - tam * 1.8} Q${(x + fx) / 2} ${y - tam * 2.2} ${fx} ${fy}" stroke="${color}" stroke-width="${tam * 0.22}" fill="none" stroke-linecap="round"/>`;
    }).join("");
    return `<path d="M${x} ${y} Q${x - 4} ${y - tam} ${x + 6} ${y - tam * 1.8}" stroke="#8a6a45" stroke-width="${tam * 0.16}" fill="none"/>${hojas}`;
  }
  // Redondo: copa de tres círculos y tronco
  return `<rect x="${x - tam * 0.08}" y="${y - tam * 0.6}" width="${tam * 0.16}" height="${tam * 0.6}" fill="#6b4f35"/>
    <circle cx="${x}" cy="${y - tam * 0.95}" r="${tam * 0.5}" fill="${color}"/>
    <circle cx="${x - tam * 0.32}" cy="${y - tam * 0.7}" r="${tam * 0.36}" fill="${color}"/>
    <circle cx="${x + tam * 0.34}" cy="${y - tam * 0.72}" r="${tam * 0.38}" fill="${color}"/>`;
}

function nube(x, y, escala, color) {
  return `<g class="nube" style="--viaje: ${(60 + escala * 40).toFixed(0)}s" opacity="0.85" transform="translate(${x} ${y}) scale(${escala.toFixed(2)})">
    <ellipse cx="0" cy="0" rx="70" ry="26" fill="${color}"/>
    <ellipse cx="-40" cy="8" rx="46" ry="20" fill="${color}"/>
    <ellipse cx="45" cy="6" rx="52" ry="22" fill="${color}"/>
    <ellipse cx="5" cy="-18" rx="40" ry="24" fill="${color}"/>
  </g>`;
}

// Lo pequeño del suelo: flores, hierba, conchas, brillos de nieve, cristales de cueva
function detalles(azar, tipo, suelo) {
  const piezas = [];
  for (let i = 0; i < 70; i++) {
    const y = HORIZONTE + 20 + azar() ** 1.4 * (ALTO - HORIZONTE - 20);
    const x = azar() * ANCHO;
    const tam = 3 + ((y - HORIZONTE) / (ALTO - HORIZONTE)) * 9;
    if (tipo === "flores") {
      const color = ["#ffffff", "#ffe066", "#ff8fb1", "#c9a2ff"][i % 4];
      piezas.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(tam * 0.45).toFixed(1)}" fill="${color}" opacity="0.9"/>`);
    } else if (tipo === "hierba") {
      piezas.push(`<path d="M${x} ${y} l${-tam * 0.4} ${-tam * 1.4} M${x} ${y} l0 ${-tam * 1.7} M${x} ${y} l${tam * 0.4} ${-tam * 1.4}" stroke="${suelo[1]}" stroke-width="${(tam * 0.22).toFixed(1)}" stroke-linecap="round" opacity="0.7"/>`);
    } else if (tipo === "conchas") {
      if (i % 3) continue;
      piezas.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(tam * 0.7).toFixed(1)}" ry="${(tam * 0.45).toFixed(1)}" fill="#fff3e3" opacity="0.8"/>`);
    } else if (tipo === "brillos") {
      piezas.push(`<path d="M${x} ${y - tam * 0.6} L${x + tam * 0.15} ${y} L${x} ${y + tam * 0.6} L${x - tam * 0.15} ${y} Z" fill="#ffffff" opacity="0.8"/>`);
    } else if (tipo === "cristales") {
      if (i % 4) continue;
      const color = ["#8ad7ff", "#c79bff", "#7fffd4"][i % 3];
      piezas.push(`<path d="M${x} ${y} l${tam * 0.5} ${-tam * 2} l${tam * 0.5} ${tam * 2} Z" fill="${color}" opacity="0.55"/>`);
    }
  }
  return piezas.join("");
}

// Franjas de césped segado que se abren desde el horizonte (da profundidad al suelo)
function franjas(color) {
  const piezas = [];
  const fuga = { x: ANCHO / 2, y: HORIZONTE - 200 };
  for (let i = -8; i < 9; i += 2) {
    const x1 = ANCHO / 2 + i * 240;
    const x2 = x1 + 240;
    const corte = (x) => fuga.x + (x - fuga.x) * ((HORIZONTE - fuga.y) / (ALTO - fuga.y));
    piezas.push(`<path d="M${corte(x1)} ${HORIZONTE} L${corte(x2)} ${HORIZONTE} L${x2} ${ALTO} L${x1} ${ALTO} Z" fill="${color}"/>`);
  }
  return piezas.join("");
}

export function dibujarEscena(id) {
  const nombre = escenaDe(id);
  const e = ESCENAS[nombre];
  const azar = azarFijo(`${id}-detalles`);
  const partes = [];

  partes.push(`<defs>
    <linearGradient id="cielo-${nombre}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.cielo[0]}"/><stop offset="1" stop-color="${e.cielo[1]}"/></linearGradient>
    <linearGradient id="suelo-${nombre}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.suelo[0]}"/><stop offset="1" stop-color="${e.suelo[1]}"/></linearGradient>
    ${e.astro ? `<radialGradient id="brillo-${nombre}"><stop offset="0" stop-color="${e.astro.brillo}" stop-opacity="0.75"/><stop offset="1" stop-color="${e.astro.brillo}" stop-opacity="0"/></radialGradient>` : ""}
    ${e.mar ? `<linearGradient id="mar-${nombre}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.mar[0]}"/><stop offset="1" stop-color="${e.mar[1]}"/></linearGradient>` : ""}
  </defs>`);
  partes.push(`<rect width="${ANCHO}" height="${ALTO}" fill="url(#cielo-${nombre})"/>`);

  if (e.estrellas) {
    for (let i = 0; i < 90; i++) {
      partes.push(`<circle class="estrella" style="--brillo: ${(2 + azar() * 4).toFixed(1)}s" cx="${(azar() * ANCHO).toFixed(0)}" cy="${(azar() * (HORIZONTE - 80)).toFixed(0)}" r="${(0.8 + azar() * 1.8).toFixed(1)}" fill="#ffffff"/>`);
    }
  }
  if (e.astro) {
    const { x, y, r, color, tipo } = e.astro;
    partes.push(`<circle cx="${x}" cy="${y}" r="${r * 3.2}" fill="url(#brillo-${nombre})"/>`);
    partes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`);
    if (tipo === "luna") partes.push(`<circle cx="${x + r * 0.42}" cy="${y - r * 0.2}" r="${r * 0.9}" fill="${e.cielo[0]}"/>`);
  }
  if (e.nubes) {
    for (let i = 0; i < 5; i++) partes.push(nube(azar() * ANCHO, 60 + azar() * 200, 0.6 + azar() * 0.9, e.nubes));
  }
  if (e.estalactitas) {
    let x = 0;
    let d = "M0 0";
    while (x < ANCHO) {
      const ancho = 30 + azar() * 70;
      d += ` L${x + ancho / 2} ${40 + azar() * 140} L${x + ancho} 0`;
      x += ancho;
    }
    partes.push(`<path d="${d} Z" fill="#141118"/>`);
  }
  if (e.mar) {
    partes.push(`<rect y="${HORIZONTE - 70}" width="${ANCHO}" height="90" fill="url(#mar-${nombre})"/>`);
    for (let i = 0; i < 14; i++) {
      const y = HORIZONTE - 60 + azar() * 70;
      partes.push(`<path class="ola" d="M${(azar() * ANCHO).toFixed(0)} ${y.toFixed(0)} q20 -6 40 0 q20 6 40 0" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.6"/>`);
    }
  }
  if (e.montes) partes.push(cordillera(azar, e.montes, 170, 330, 9, { cumbres: e.cumbres }));
  if (e.colinas) partes.push(colinas(azar, e.colinas));
  if (e.arboles) {
    for (let i = 0; i < 16; i++) {
      const x = azar() * ANCHO;
      // No delante del Pokémon del rival (hacia el 67 % del ancho)
      if (Math.abs(x - ANCHO * 0.67) < 170) continue;
      partes.push(arbol(x, HORIZONTE + 6 + azar() * 10, 34 + azar() * 30, e.arboles));
    }
  }
  partes.push(`<rect y="${HORIZONTE}" width="${ANCHO}" height="${ALTO - HORIZONTE}" fill="url(#suelo-${nombre})"/>`);
  partes.push(franjas(e.franja));
  partes.push(detalles(azar, e.detalle, e.suelo));

  return `<svg class="lucha-escena escena-${nombre}" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${partes.join("")}</svg>`;
}
