// ---------- Combates: efectos que se ven y se oyen ----------
//
// Lo que pasa en el campo además de moverse los sprites:
//   · Ataques: según su categoría (físico: el golpe en el rival; especial: algo que vuela hasta él;
//     de estado: un aura) y con partículas del estilo de su tipo (llamas, burbujas, hojas, rayos...).
//   · Golpes: destello en el que lo recibe, el campo tiembla si es muy eficaz o crítico, y el daño
//     flota sobre él («−23 %»).
//   · Sonidos hechos aquí mismo con el sintetizador del navegador (Web Audio): nada de sonidos de
//     los juegos ni de otras webs. Los gritos de los Pokémon, de PokeAPI (como en «Juegos»).
//
// Todo con elementos sueltos que se quitan solos al acabar su animación (css/lucha.css).

const CLAVE_SONIDO = "poketeams-lucha-sonido-v1";
const URL_GRITOS = "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/";

// ---------- El estilo de cada tipo ----------

export const ESTILOS = {
  normal: { colores: ["#ffffff", "#e8e4cf"], forma: "estrella" },
  fire: { colores: ["#ff9b3d", "#ffd23f", "#ff5a1f"], forma: "llama" },
  water: { colores: ["#58a8ff", "#bfe3ff"], forma: "burbuja" },
  electric: { colores: ["#ffe14d", "#fff8c4"], forma: "chispa" },
  grass: { colores: ["#63b844", "#b2e58a"], forma: "hoja" },
  ice: { colores: ["#9fe6f2", "#effdff"], forma: "cristal" },
  fighting: { colores: ["#e0533d", "#ffc0a8"], forma: "estrella" },
  poison: { colores: ["#b45ad1", "#e6b1f2"], forma: "burbuja" },
  ground: { colores: ["#c9a35a", "#8a6a35"], forma: "roca" },
  flying: { colores: ["#d8e8ff", "#ffffff"], forma: "viento" },
  psychic: { colores: ["#ff6fa8", "#ffc8df"], forma: "anillo" },
  bug: { colores: ["#a8c52a", "#e0ec98"], forma: "punto" },
  rock: { colores: ["#b59a5a", "#7d6a3c"], forma: "roca" },
  ghost: { colores: ["#8d6fc4", "#3a2a5c"], forma: "humo" },
  dragon: { colores: ["#7b5cff", "#c9bcff"], forma: "llama" },
  dark: { colores: ["#6b5643", "#241a14"], forma: "humo" },
  steel: { colores: ["#dfe2ee", "#9aa0b8"], forma: "cristal" },
  fairy: { colores: ["#ffa8d8", "#fff0f8"], forma: "estrella" },
  stellar: { colores: ["#7fd8ff", "#ffe6a6", "#ff9be0"], forma: "estrella" }
};

function estiloDe(tipo) {
  return ESTILOS[String(tipo || "normal").toLowerCase()] || ESTILOS.normal;
}

const azar = (min, max) => min + Math.random() * (max - min);
const esperar = (ms) => new Promise((cumplir) => setTimeout(cumplir, ms));

// ---------- Sonido ----------

let contexto = null;
let salida = null;
let conSonido = (() => {
  try {
    return localStorage.getItem(CLAVE_SONIDO) !== "no";
  } catch (error) {
    return true;
  }
})();

export function haySonido() {
  return conSonido;
}

export function ponerSonido(si) {
  conSonido = si;
  try {
    localStorage.setItem(CLAVE_SONIDO, si ? "si" : "no");
  } catch (error) {
    // sin sitio: vale solo para esta vez
  }
}

function audio() {
  if (!conSonido) return null;
  try {
    if (!contexto) {
      contexto = new AudioContext();
      salida = contexto.createGain();
      salida.gain.value = 0.35;
      salida.connect(contexto.destination);
    }
    if (contexto.state === "suspended") contexto.resume();
    return contexto;
  } catch (error) {
    return null;
  }
}

// Una nota: de una frecuencia a otra, con subida rápida y caída suave
function tono({ frec, hasta = frec, dur = 0.15, forma = "sine", vol = 0.3, retraso = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + retraso;
  const osc = ac.createOscillator();
  const gan = ac.createGain();
  osc.type = forma;
  osc.frequency.setValueAtTime(frec, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, hasta), t0 + dur);
  gan.gain.setValueAtTime(0.0001, t0);
  gan.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gan).connect(salida);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Ruido filtrado: golpes, soplidos, chisporroteos
function ruido({ dur = 0.2, filtro = "lowpass", frec = 900, hasta = frec, vol = 0.4, retraso = 0, q = 1 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + retraso;
  const muestras = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, muestras, ac.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = ac.createBufferSource();
  fuente.buffer = buffer;
  const bq = ac.createBiquadFilter();
  bq.type = filtro;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(frec, t0);
  bq.frequency.exponentialRampToValueAtTime(Math.max(30, hasta), t0 + dur);
  const gan = ac.createGain();
  gan.gain.setValueAtTime(vol, t0);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  fuente.connect(bq).connect(gan).connect(salida);
  fuente.start(t0);
}

export const sonidos = {
  // El golpe en el que lo recibe: más fuerte y más brillante si es muy eficaz o crítico
  golpe(fuerza = "normal") {
    const fuerte = fuerza === "muy" || fuerza === "critico";
    const flojo = fuerza === "poco";
    ruido({ dur: fuerte ? 0.28 : 0.18, frec: flojo ? 500 : fuerte ? 2600 : 1400, hasta: 120, vol: flojo ? 0.25 : fuerte ? 0.6 : 0.45 });
    tono({ frec: flojo ? 110 : 150, hasta: 45, dur: 0.18, vol: flojo ? 0.25 : 0.45 });
    if (fuerte) ruido({ dur: 0.22, frec: 3200, hasta: 300, vol: 0.35, retraso: 0.09 });
    if (fuerza === "critico") tono({ frec: 1800, hasta: 2400, dur: 0.12, forma: "triangle", vol: 0.15, retraso: 0.05 });
  },
  // Un ataque físico que sale disparado
  latigazo() {
    ruido({ dur: 0.22, filtro: "bandpass", frec: 600, hasta: 2400, vol: 0.3, q: 1.4 });
  },
  // Un ataque especial que se carga y sale
  carga(tipo) {
    if (tipo === "electric") {
      for (let i = 0; i < 4; i++) tono({ frec: azar(700, 1400), hasta: azar(300, 600), dur: 0.05, forma: "square", vol: 0.08, retraso: i * 0.05 });
    } else if (tipo === "fire") {
      ruido({ dur: 0.35, frec: 300, hasta: 1600, vol: 0.3 });
    } else if (tipo === "water") {
      for (let i = 0; i < 3; i++) tono({ frec: azar(300, 500), hasta: azar(800, 1100), dur: 0.08, vol: 0.12, retraso: i * 0.07 });
    } else {
      tono({ frec: 220, hasta: 880, dur: 0.3, forma: "sawtooth", vol: 0.08 });
    }
  },
  // Un ataque de estado (o algo que brilla: mega, tera)
  brillo() {
    [1320, 1760, 2093, 2637].forEach((frec, i) => tono({ frec, dur: 0.18, forma: "triangle", vol: 0.09, retraso: i * 0.06 }));
  },
  sube() {
    [523, 659, 784, 1047].forEach((frec, i) => tono({ frec, dur: 0.12, forma: "square", vol: 0.06, retraso: i * 0.06 }));
  },
  baja() {
    [784, 659, 523, 392].forEach((frec, i) => tono({ frec, dur: 0.12, forma: "square", vol: 0.06, retraso: i * 0.06 }));
  },
  cura() {
    [659, 880, 1175].forEach((frec, i) => tono({ frec, dur: 0.25, vol: 0.12, retraso: i * 0.08 }));
  },
  estado() {
    tono({ frec: 300, hasta: 200, dur: 0.25, forma: "sawtooth", vol: 0.08 });
    tono({ frec: 310, hasta: 190, dur: 0.25, forma: "sawtooth", vol: 0.08 });
  },
  debilitado() {
    tono({ frec: 440, hasta: 70, dur: 0.6, forma: "triangle", vol: 0.2 });
  },
  transformacion() {
    tono({ frec: 200, hasta: 1600, dur: 0.6, forma: "sine", vol: 0.15 });
    tono({ frec: 205, hasta: 1640, dur: 0.6, forma: "sine", vol: 0.1 });
    ruido({ dur: 0.6, filtro: "highpass", frec: 2000, hasta: 6000, vol: 0.12 });
  },
  victoria() {
    [523, 659, 784, 1047, 784, 1047].forEach((frec, i) => tono({ frec, dur: i === 5 ? 0.5 : 0.16, forma: "square", vol: 0.07, retraso: i * 0.13 }));
  },
  derrota() {
    [392, 349, 311, 262].forEach((frec, i) => tono({ frec, dur: i === 3 ? 0.6 : 0.22, forma: "triangle", vol: 0.12, retraso: i * 0.2 }));
  }
};

// El grito del Pokémon (de PokeAPI). Al debilitarse, más grave y lento.
export function grito(num, { grave = false } = {}) {
  if (!conSonido || !num) return;
  const sonido = new Audio(`${URL_GRITOS}${num}.ogg`);
  sonido.volume = 0.35;
  if (grave) {
    sonido.preservesPitch = false;
    sonido.playbackRate = 0.75;
  }
  sonido.play().catch(() => {});
}

// ---------- Lo que se ve ----------

export function crearEfectos(arena) {
  const capa = arena.querySelector(".lucha-efectos");

  // Centro del sprite de un lado, en píxeles dentro del campo
  function centro(lado) {
    const caja = arena.querySelector(`.lucha-sprite[data-lado="${lado}"]`);
    const img = caja && (caja.querySelector("img") || caja);
    const r = img.getBoundingClientRect();
    const base = arena.getBoundingClientRect();
    return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height * 0.55, ancho: Math.max(40, r.width) };
  }

  function poner(clase, estilo, vida = 1200) {
    const el = document.createElement("span");
    el.className = clase;
    Object.assign(el.style, estilo);
    capa.appendChild(el);
    setTimeout(() => el.remove(), vida);
    return el;
  }

  // Partículas que salen de un punto hacia fuera
  function estallido(punto, tipo, { cuantas = 10, radio = 70, retraso = 0 } = {}) {
    const { colores, forma } = estiloDe(tipo);
    for (let i = 0; i < cuantas; i++) {
      const angulo = (i / cuantas) * Math.PI * 2 + azar(-0.3, 0.3);
      const lejos = azar(radio * 0.5, radio);
      poner(`lucha-particula forma-${forma} estalla`, {
        left: `${punto.x}px`, top: `${punto.y}px`,
        "--dx": `${Math.cos(angulo) * lejos}px`, "--dy": `${Math.sin(angulo) * lejos}px`,
        "--c": colores[i % colores.length], "--s": `${azar(8, 16)}px`, "--r": `${azar(-180, 180)}deg`,
        animationDelay: `${retraso + azar(0, 60)}ms`
      });
    }
    // El fogonazo del centro
    poner("lucha-fogonazo", { left: `${punto.x}px`, top: `${punto.y}px`, "--c": colores[0], animationDelay: `${retraso}ms` }, 900);
  }

  // Algo que vuela de un lado al otro (una bola, un rayo, una hoja...), con estela
  function proyectil(desde, hasta, tipo, dur = 420) {
    const { colores, forma } = estiloDe(tipo);
    const dx = hasta.x - desde.x;
    const dy = hasta.y - desde.y;
    if (forma === "chispa") {
      // Un rayo en zigzag dibujado de punta a punta
      const pasos = 7;
      const puntos = [];
      for (let i = 0; i <= pasos; i++) {
        const t = i / pasos;
        const desvio = i === 0 || i === pasos ? 0 : azar(-18, 18);
        puntos.push(`${desde.x + dx * t + (-dy / Math.hypot(dx, dy)) * desvio},${desde.y + dy * t + (dx / Math.hypot(dx, dy)) * desvio}`);
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "lucha-rayo");
      svg.innerHTML = `<polyline points="${puntos.join(" ")}" stroke="${colores[0]}" /><polyline points="${puntos.join(" ")}" stroke="#fff" class="nucleo" />`;
      capa.appendChild(svg);
      setTimeout(() => svg.remove(), 600);
      return;
    }
    poner("lucha-proyectil", {
      left: `${desde.x}px`, top: `${desde.y}px`, "--dx": `${dx}px`, "--dy": `${dy}px`,
      "--c": colores[0], "--c2": colores[1] || colores[0], animationDuration: `${dur}ms`
    }, dur + 100);
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      poner(`lucha-particula forma-${forma} estela`, {
        left: `${desde.x + dx * t}px`, top: `${desde.y + dy * t + azar(-10, 10)}px`,
        "--c": colores[i % colores.length], "--s": `${azar(6, 12)}px`, "--r": `${azar(-90, 90)}deg`,
        "--dx": `${azar(-14, 14)}px`, "--dy": `${azar(-20, 6)}px`,
        animationDelay: `${t * dur}ms`
      }, dur + 700);
    }
  }

  // Anillos que se abren alrededor de uno (estado, subidas, curas)
  function aura(lado, color, { anillos = 3, sube = true } = {}) {
    const punto = centro(lado);
    for (let i = 0; i < anillos; i++) {
      poner("lucha-anillo", { left: `${punto.x}px`, top: `${punto.y}px`, "--c": color, "--tam": `${punto.ancho * 1.3}px`, animationDelay: `${i * 140}ms` }, 1200);
    }
    for (let i = 0; i < 8; i++) {
      poner(`lucha-chispita ${sube ? "sube" : "baja"}`, {
        left: `${punto.x + azar(-punto.ancho / 2, punto.ancho / 2)}px`, top: `${punto.y + azar(-20, 30)}px`,
        "--c": color, animationDelay: `${azar(0, 300)}ms`
      }, 1300);
    }
  }

  return {
    // El ataque de un lado: según su categoría y su tipo. Devuelve cuánto tarda.
    async ataque({ lado, objetivo, tipo, categoria, contacto, aSiMismo }) {
      const estilo = estiloDe(tipo);
      if (aSiMismo || !objetivo || objetivo === lado) {
        sonidos.brillo();
        aura(lado, estilo.colores[0]);
        await esperar(450);
        return;
      }
      const desde = centro(lado);
      const hasta = centro(objetivo);
      if (categoria === "Status") {
        sonidos.brillo();
        proyectil(desde, hasta, tipo, 380);
        await esperar(380);
        aura(objetivo, estilo.colores[0], { anillos: 2, sube: false });
        await esperar(250);
        return;
      }
      if (categoria === "Physical" && contacto) {
        sonidos.latigazo();
        await esperar(230); // lo que tarda en llegar el que ataca (la animación «ataca»)
        estallido(hasta, tipo, { cuantas: 9, radio: 60 });
        return;
      }
      // Especial (o físico a distancia: Terremoto, Avalancha...)
      if (tipo === "ground" && categoria === "Physical") {
        arena.classList.remove("tiembla");
        void arena.offsetWidth;
        arena.classList.add("tiembla");
        estallido({ x: hasta.x, y: hasta.y + 30 }, tipo, { cuantas: 12, radio: 90 });
        await esperar(350);
        return;
      }
      sonidos.carga(tipo);
      proyectil(desde, hasta, tipo);
      await esperar(400);
      estallido(hasta, tipo, { cuantas: 10, radio: 70 });
    },

    // El que recibe: destello, sonido y, si es fuerte, que tiemble el campo
    golpe(lado, fuerza = "normal") {
      sonidos.golpe(fuerza);
      if (fuerza === "muy" || fuerza === "critico") {
        arena.classList.remove("tiembla");
        void arena.offsetWidth;
        arena.classList.add("tiembla");
      }
    },

    // Un número que sube y se desvanece sobre el Pokémon («−23 %», «+10 %», «¡Crítico!»)
    numero(lado, texto, clase = "") {
      const punto = centro(lado);
      poner(`lucha-numero ${clase}`, { left: `${punto.x}px`, top: `${punto.y - punto.ancho * 0.45}px` }, 1400).textContent = texto;
    },

    aura,

    // Un destello grande sobre uno (megaevolución, teracristalización, transformación)
    destello(lado, color) {
      const punto = centro(lado);
      poner("lucha-destello", { left: `${punto.x}px`, top: `${punto.y}px`, "--c": color, "--tam": `${punto.ancho * 2.4}px` }, 1100);
      estallido(punto, "stellar", { cuantas: 14, radio: punto.ancho });
    },

    // Cristales que saltan (teracristalización)
    cristales(lado, color) {
      const punto = centro(lado);
      for (let i = 0; i < 12; i++) {
        const angulo = (i / 12) * Math.PI * 2;
        poner("lucha-particula forma-cristal estalla", {
          left: `${punto.x}px`, top: `${punto.y}px`,
          "--dx": `${Math.cos(angulo) * punto.ancho * 0.9}px`, "--dy": `${Math.sin(angulo) * punto.ancho * 0.9}px`,
          "--c": i % 2 ? "#ffffff" : color, "--s": `${azar(12, 20)}px`, "--r": `${azar(0, 360)}deg`
        });
      }
    },

    // El nombre del ataque, en una franja de su color que entra y sale
    rotulo(texto, tipo) {
      const el = poner("lucha-rotulo", { "--c": estiloDe(tipo).colores[0] }, 1500);
      el.textContent = texto;
    }
  };
}
