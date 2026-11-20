// «Duelo de siluetas» con un amigo (ver js/juegos/amigos.js): las mismas RONDAS siluetas para los dos (salen de
// la semilla), cada una con cuatro nombres para elegir. Se juega a la vez, cada uno a su ritmo: gana quien más
// acierte y, si empatan, quien haya tardado menos en total. Se ve cómo va el otro.
// Para que nadie salga con desventaja, se empieza a la vez: cada uno, al entrar, se apunta en «listos»; cuando
// están los dos, a cada uno le sale una cuenta atrás (3, 2, 1) y entonces empieza a contar su tiempo.
//
//   datos: { respuestas: { uid: [{ ok, ms }] }, listos: { uid: true } }

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { urlArte } from "../comun/imagenes.js";
import { avisar } from "../comun/ventanas.js";
import { t, nombre as nombreDe, LOCALE } from "../comun/idioma.js";

export const NOMBRE = () => t("Duelo de siluetas");
export const COMO = () => t("Las mismas 10 siluetas para los dos, con cuatro nombres para elegir. Jugáis a la vez: gana quien más acierte y, si empatáis, quien haya tardado menos.");
const RONDAS = 10;
const OPCIONES = 4;
const REVELAR = 1100; // ms con la silueta en color tras responder
const CUENTA = 3; // segundos de la cuenta atrás

let caja = null;
let actual = null;
let ctxActual = null;
let mostradaDesde = 0; // cuándo se enseñó la silueta que toca (para el tiempo)
let mostradaRonda = -1;
let revelando = null; // { ronda, elegida, ok }
let cuenta = null; // { id, desde } la cuenta atrás de esta partida (null: aún no / ya acabó)
const cuentaHecha = new Set(); // partidas en las que ya se ha hecho
const apuntado = new Set(); // partidas en las que ya me he apuntado como listo
const terminando = new Set();

export function datosIniciales() {
  return { respuestas: {} };
}

// Se juega a la vez: sin turno
export function alAceptar() {
  return { turno: "" };
}

export function soltar() {
  caja = null;
  mostradaRonda = -1;
  revelando = null;
  cuenta = null;
}

function rondas(ctx) {
  const azar = ctx.azar();
  const usadas = new Set();
  const lista = [];
  const todas = ctx.especies;
  while (lista.length < RONDAS) {
    const objetivo = todas[Math.floor(azar() * todas.length)];
    if (usadas.has(objetivo.id)) continue;
    usadas.add(objetivo.id);
    // Tres más, mejor de la misma generación (que no sea tan fácil)
    const parecidas = todas.filter((e) => e.gen === objetivo.gen && e.id !== objetivo.id);
    const opciones = [objetivo];
    while (opciones.length < OPCIONES) {
      const otra = parecidas[Math.floor(azar() * parecidas.length)];
      if (!opciones.includes(otra)) opciones.push(otra);
    }
    // Barajadas
    for (let i = opciones.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
    }
    lista.push({ objetivo, opciones });
  }
  return lista;
}

const segundos = (ms) => (ms / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 });

function resumen(respuestas = []) {
  return { aciertos: respuestas.filter((r) => r.ok).length, ms: respuestas.reduce((s, r) => s + (r.ms || 0), 0), hechas: respuestas.length };
}

export function montar(contenedor, partida, ctx) {
  caja = contenedor;
  actual = partida;
  ctxActual = ctx;
  const lista = rondas(ctx);
  const respuestas = ((partida.datos || {}).respuestas) || {};
  const mias = respuestas[ctx.yo] || [];
  const suyas = respuestas[ctx.otro] || [];
  const yo = resumen(mias);
  const el = resumen(suyas);
  const fin = partida.estado === "fin";

  // Los dos han acabado: el final (lo apunta el primero que lo ve)
  if (partida.estado === "jugando" && yo.hechas >= RONDAS && el.hechas >= RONDAS && !terminando.has(partida.id)) {
    terminando.add(partida.id);
    const ganador = yo.aciertos !== el.aciertos ? (yo.aciertos > el.aciertos ? ctx.yo : ctx.otro) : yo.ms !== el.ms ? (yo.ms < el.ms ? ctx.yo : ctx.otro) : "empate";
    ctx.terminar(ganador).catch((error) => {
      console.error(error);
      terminando.delete(partida.id);
    });
  }

  const marcador = `
    <div class="cromos-marcador">
      <span><b>${yo.aciertos}</b> ${t("Tú")} <small>${yo.hechas}/${RONDAS} · ${segundos(yo.ms)} s</small></span>
      <span class="cromos-ronda">${fin ? t("Final") : yo.hechas < RONDAS ? t("Silueta {n} de {total}", { n: yo.hechas + 1, total: RONDAS }) : t("Esperando a {quien}", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</span>
      <span>${escaparHTML(ctx.nombreDe(ctx.otro))} <b>${el.aciertos}</b> <small>${el.hechas}/${RONDAS} · ${segundos(el.ms)} s</small></span>
    </div>`;

  // Antes de la primera: los dos dentro y la cuenta atrás (si ya se ha empezado a jugar, no hace falta)
  const listos = ((partida.datos || {}).listos) || {};
  if (partida.estado === "jugando" && !listos[ctx.yo] && !apuntado.has(partida.id)) {
    apuntado.add(partida.id);
    ctx.cambiar({ [`datos.listos.${ctx.yo}`]: true }).catch((error) => {
      console.error(error);
      apuntado.delete(partida.id);
    });
  }
  if (!fin && yo.hechas === 0 && !cuentaHecha.has(partida.id)) {
    if (!(listos[ctx.yo] && listos[ctx.otro]) && !suyas.length) {
      caja.innerHTML = `
        <div class="siluetas">
          ${marcador}
          <div class="siluetas-espera">${icono("persona")}<b>${t("Esperando a que entre {quien}...", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</b><small>${t("Empezáis a la vez, con una cuenta atrás.")}</small></div>
        </div>`;
      return;
    }
    if (!cuenta || cuenta.id !== partida.id) {
      cuenta = { id: partida.id, desde: performance.now() };
      const tic = () => {
        if (!cuenta || cuenta.id !== partida.id) return;
        const quedan = CUENTA - Math.floor((performance.now() - cuenta.desde) / 1000);
        if (quedan <= 0) {
          cuentaHecha.add(partida.id);
          cuenta = null;
          mostradaRonda = -1; // el tiempo de la primera, desde ahora
        } else setTimeout(tic, 1000 - ((performance.now() - cuenta.desde) % 1000));
        if (caja && actual) montar(caja, actual, ctxActual);
      };
      setTimeout(tic, 1000);
    }
    const quedan = Math.max(1, CUENTA - Math.floor((performance.now() - cuenta.desde) / 1000));
    caja.innerHTML = `
      <div class="siluetas">
        ${marcador}
        <div class="siluetas-espera siluetas-cuenta"><span class="siluetas-numero" data-n="${quedan}">${quedan}</span><small>${t("¡Preparados!")}</small></div>
      </div>`;
    return;
  }

  // Ya he acabado (o se ha terminado): cómo me ha ido en cada una
  if (fin || (yo.hechas >= RONDAS && !revelando)) {
    caja.innerHTML = `
      <div class="siluetas">
        ${marcador}
        <ol class="siluetas-repaso siluetas-final">${lista.map((ronda, i) => {
          // El más rápido de los que la han acertado, con su rayo
          const m = mias[i];
          const s2 = suyas[i];
          const rapido = m && m.ok && (!s2 || !s2.ok || m.ms < s2.ms) ? "yo" : s2 && s2.ok && (!m || !m.ok || s2.ms < m.ms) ? "otro" : "";
          const fila = (r, quien, nombre, pendiente) => `
            <small class="${r && r.ok ? "bien" : "mal"} ${rapido === quien ? "rapido" : ""}" ${rapido === quien ? `title="${t("El más rápido")}"` : ""}>
              ${r ? (r.ok ? icono("visto") : icono("aspa")) : pendiente} ${nombre}${r && r.ok ? ` · ${segundos(r.ms)} s` : ""}${rapido === quien ? ` ${icono("rayo")}` : ""}
            </small>`;
          return `
          <li>
            <img src="${escaparHTML(urlArte({ id: ronda.objetivo.id }))}" alt="" draggable="false" loading="lazy">
            <span>${escaparHTML(nombreDe(ronda.objetivo))}</span>
            ${fila(m, "yo", t("tú"), "–")}
            ${fila(s2, "otro", escaparHTML(ctx.nombreDe(ctx.otro)), "…")}
          </li>`;
        }).join("")}</ol>
      </div>`;
    return;
  }

  const i = revelando ? revelando.ronda : yo.hechas;
  const ronda = lista[i];
  if (mostradaRonda !== i) {
    mostradaRonda = i;
    mostradaDesde = performance.now();
  }
  caja.innerHTML = `
    <div class="siluetas">
      ${marcador}
      <div class="silueta-pantalla ${revelando ? `revelando ${revelando.ok ? "bien" : "mal"}` : ""}">
        <img class="silueta-imagen ${revelando ? "revelada" : ""}" src="${escaparHTML(urlArte({ id: ronda.objetivo.id }))}" alt="" draggable="false">
        ${revelando ? `<span class="silueta-nombre">${escaparHTML(nombreDe(ronda.objetivo))}</span>` : ""}
      </div>
      <div class="siluetas-opciones">
        ${ronda.opciones.map((opcion) => {
          const clase = revelando ? (opcion === ronda.objetivo ? "buena" : opcion.id === revelando.elegida ? "mala" : "apagada") : "";
          return `<button class="siluetas-opcion ${clase}" data-especie="${opcion.id}" ${revelando ? "disabled" : ""}>${escaparHTML(nombreDe(opcion))}</button>`;
        }).join("")}
      </div>
    </div>`;

  if (!caja.dataset.activo) {
    caja.dataset.activo = "1";
    caja.addEventListener("click", alPulsar);
  }
}

async function alPulsar(e) {
  const boton = e.target.closest(".siluetas-opcion");
  if (!boton || revelando || !actual || actual.estado !== "jugando") return;
  const partida = actual;
  const ctx = ctxActual;
  const lista = rondas(ctx);
  const mias = [...((((partida.datos || {}).respuestas) || {})[ctx.yo] || [])];
  const i = mias.length;
  if (i >= RONDAS) return;
  const especie = Number(boton.dataset.especie);
  const ms = Math.round(performance.now() - mostradaDesde);
  const ok = especie === lista[i].objetivo.id;
  mias.push({ ok, ms });
  revelando = { ronda: i, elegida: especie, ok };
  montar(caja, partida, ctx);
  try {
    await ctx.cambiar({ [`datos.respuestas.${ctx.yo}`]: mias });
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido guardar. Revisa la conexión y vuelve a probar."));
  }
  setTimeout(() => {
    revelando = null;
    if (caja && actual) montar(caja, actual, ctxActual);
  }, REVELAR);
}
