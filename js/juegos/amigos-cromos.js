// «Cromos de estadísticas» con un amigo (ver js/juegos/amigos.js), como el juego de cartas de toda la vida:
//   · De la semilla salen RONDAS cartas para cada uno (Pokémon distintos). En cada ronda se enfrentan las dos de
//     arriba, de totales parecidos (que ninguna gane por ser mucho más fuerte): la tuya la ves; la del otro, boca
//     abajo.
//   · Quien tiene el turno elige una estadística de su carta (PS, Ataque... o el total). Gana la ronda la carta con
//     más; en la siguiente elige el que ha perdido (quien elige tiene ventaja: así no se la queda siempre el mismo).
//     En un empate, elige el otro.
//   · Las partidas de antes (sin datos.v) siguen con lo de entonces: cartas al azar y elige el que gana.
//   · Tras las RONDAS, gana quien más rondas se ha llevado.
//
//   datos: { v: 2, elecciones: [índice de la estadística en cada ronda] }   (todo lo demás sale de la semilla)

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { avisar } from "../comun/ventanas.js";
import { tiposEs, coloresTipo } from "../comun/tipos.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";

export const NOMBRE = () => t("Cromos de estadísticas");
export const COMO = () => t("Cada uno tiene 10 cartas de Pokémon, y en cada ronda se enfrentan dos de fuerza parecida. Quien tiene el turno elige una estadística de su carta y gana la carta con más. Quien pierde la ronda elige en la siguiente. Gana quien se lleve más rondas.");
const PARECIDO = 30; // diferencia máxima de total entre las dos cartas de una ronda
const RONDAS = 10;
const STATS = [
  { nombre: () => t("PS"), valor: (e) => e.bases[0] },
  { nombre: () => t("Ataque"), valor: (e) => e.bases[1] },
  { nombre: () => t("Defensa"), valor: (e) => e.bases[2] },
  { nombre: () => t("At. Esp."), valor: (e) => e.bases[3] },
  { nombre: () => t("Def. Esp."), valor: (e) => e.bases[4] },
  { nombre: () => t("Velocidad"), valor: (e) => e.bases[5] },
  { nombre: () => t("Total"), valor: (e) => e.total }
];

const REVELAR = 2600; // ms con las dos cartas boca arriba tras cada elección

let caja = null;
let actual = null;
let ctxActual = null;
let vistas = { id: "", n: -1 }; // cuántas rondas había la última vez (para saber cuándo revelar)
let revelando = null; // { id, ronda } mientras se enseña cómo acabó una ronda
const terminando = new Set();

export function datosIniciales() {
  return { v: 2, elecciones: [] };
}

export function soltar() {
  caja = null;
  vistas = { id: "", n: -1 };
  revelando = null;
}

// Las cartas de cada uno: [las de jugadores[0], las de jugadores[1]]
function mazos(partida, ctx) {
  const azar = ctx.azar();
  const usadas = new Set();
  const cartas = [];
  const validas = ctx.especies.filter((e) => e.bases && e.bases.length === 6);
  if (((partida.datos || {}).v || 1) >= 2) {
    // Por parejas: una al azar y, contra ella, otra de total parecido (si no hay, la más parecida)
    const a = [];
    const b = [];
    while (a.length < RONDAS) {
      const una = validas[Math.floor(azar() * validas.length)];
      if (usadas.has(una.id)) continue;
      usadas.add(una.id);
      const libres = validas.filter((e) => !usadas.has(e.id));
      let cerca = libres.filter((e) => Math.abs(e.total - una.total) <= PARECIDO);
      if (!cerca.length) {
        const menor = Math.min(...libres.map((e) => Math.abs(e.total - una.total)));
        cerca = libres.filter((e) => Math.abs(e.total - una.total) === menor);
      }
      const otra = cerca[Math.floor(azar() * cerca.length)];
      usadas.add(otra.id);
      // Quién se lleva cada una, también al azar
      if (azar() < 0.5) {
        a.push(una);
        b.push(otra);
      } else {
        a.push(otra);
        b.push(una);
      }
    }
    return [a, b];
  }
  while (cartas.length < RONDAS * 2) {
    const especie = validas[Math.floor(azar() * validas.length)];
    if (usadas.has(especie.id)) continue;
    usadas.add(especie.id);
    cartas.push(especie);
  }
  return [cartas.slice(0, RONDAS), cartas.slice(RONDAS)];
}

// Cómo va: quién elige en cada ronda, quién ganó cada una y los puntos
function cuentas(partida, ctx) {
  const [a, b] = mazos(partida, ctx);
  const nueva = ((partida.datos || {}).v || 1) >= 2;
  const [uno, dos] = partida.jugadores;
  const elecciones = (partida.datos || {}).elecciones || [];
  // Elige primero el retado (el que aceptó); luego, el que pierde cada ronda (en las de antes, el que gana)
  let elige = dos;
  const rondas = [];
  const puntos = { [uno]: 0, [dos]: 0 };
  elecciones.forEach((stat, r) => {
    const va = STATS[stat].valor(a[r]);
    const vb = STATS[stat].valor(b[r]);
    const gana = va > vb ? uno : vb > va ? dos : "";
    if (gana) puntos[gana]++;
    rondas.push({ stat, elige, gana, cartas: { [uno]: a[r], [dos]: b[r] } });
    const otroQue = (quien) => (quien === uno ? dos : uno);
    if (nueva) elige = gana ? otroQue(gana) : otroQue(elige);
    else if (gana) elige = gana;
  });
  return { rondas, puntos, elige, siguiente: elecciones.length, cartas: { [uno]: a, [dos]: b } };
}

function carta(especie, { boca = "arriba", elegible = false, marcada = -1, rival = null, clase: extra = "" } = {}) {
  if (boca === "abajo") {
    return `<div class="cromo boca-abajo"><span>${icono("dados")}</span><small>${t("Boca abajo")}</small></div>`;
  }
  const color = coloresTipo[especie.tipos[0]] || "#888";
  return `
    <div class="cromo ${extra}" style="--color-tipo:${color}">
      <div class="cromo-cabeza"><strong>${escaparHTML(nombreDe(especie))}</strong><small>${especie.tipos.map((tipo) => tiposEs[tipo]).join(" / ")}</small></div>
      ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `class="cromo-retrato" alt="" draggable="false"`)}
      <ul class="cromo-stats">
        ${STATS.map((stat, i) => {
          const valor = stat.valor(especie);
          const contra = rival ? stat.valor(rival) : null;
          const clase = [i === marcada ? "marcada" : "", i === marcada && contra != null ? (valor > contra ? "gana" : valor < contra ? "pierde" : "empata") : ""].join(" ");
          return elegible
            ? `<li><button class="cromo-stat ${clase}" data-stat="${i}"><span>${stat.nombre()}</span><b>${valor}</b></button></li>`
            : `<li class="${clase}"><span>${stat.nombre()}</span><b>${valor}</b></li>`;
        }).join("")}
      </ul>
    </div>`;
}

export function montar(contenedor, partida, ctx) {
  caja = contenedor;
  actual = partida;
  ctxActual = ctx;
  const c = cuentas(partida, ctx);
  const fin = partida.estado === "fin";
  const acabadas = c.siguiente >= RONDAS;

  // Ya están las diez: se apunta el final (lo hace el primero que lo vea; los dos calculan lo mismo)
  if (partida.estado === "jugando" && acabadas && !terminando.has(partida.id)) {
    terminando.add(partida.id);
    const [uno, dos] = partida.jugadores;
    const ganador = c.puntos[uno] > c.puntos[dos] ? uno : c.puntos[dos] > c.puntos[uno] ? dos : "empate";
    ctx.terminar(ganador).catch((error) => {
      console.error(error);
      terminando.delete(partida.id);
    });
  }

  // Ha llegado una elección nueva (mía o suya): se enseñan las dos cartas un rato, con quién gana
  if (vistas.id === partida.id && c.rondas.length > vistas.n && c.rondas.length > 0) {
    revelando = { id: partida.id, ronda: c.rondas.length - 1 };
    const esta = revelando;
    setTimeout(() => {
      if (revelando !== esta) return;
      revelando = null;
      if (caja && actual) montar(caja, actual, ctxActual);
    }, REVELAR);
  }
  vistas = { id: partida.id, n: c.rondas.length };
  const revela = revelando && revelando.id === partida.id ? c.rondas[revelando.ronda] : null;

  const meToca = partida.estado === "jugando" && !acabadas && c.elige === ctx.yo && !revela;
  const r = Math.min(c.siguiente, RONDAS - 1);
  const mia = c.cartas[ctx.yo][r];
  const suya = c.cartas[ctx.otro][r];

  // La mesa: tu carta arriba, la suya abajo y el «VS» en medio (al revelar, con quién se lleva la ronda)
  const mesa = (cartaMia, cartaSuya, ronda) => {
    const gano = ronda && ronda.gana === ctx.yo;
    const perdi = ronda && ronda.gana === ctx.otro;
    return `
      <div class="cromos-mesa ${ronda ? "revelando" : ""}">
        <div class="cromos-lado"><span class="cromos-quien">${t("Tu carta")}</span>${ronda
          ? carta(cartaMia, { marcada: ronda.stat, rival: cartaSuya })
          : carta(cartaMia, { elegible: meToca })}</div>
        <div class="cromos-vs ${gano ? "bien" : perdi ? "mal" : ronda ? "empate" : ""}">${ronda
          ? `<b>${gano ? t("¡Ganas la ronda!") : perdi ? t("Pierdes la ronda") : t("Empate")}</b><small>${STATS[ronda.stat].nombre()}</small>`
          : "<b>VS</b>"}</div>
        <div class="cromos-lado"><span class="cromos-quien">${escaparHTML(ctx.nombreDe(ctx.otro))}</span>${ronda
          ? carta(cartaSuya, { marcada: ronda.stat, rival: cartaMia, clase: "volteada" })
          : carta(cartaSuya, { boca: "abajo" })}</div>
      </div>`;
  };

  caja.innerHTML = `
    <div class="cromos">
      <div class="cromos-marcador">
        <span><b>${c.puntos[ctx.yo]}</b> ${t("Tú")}</span>
        <span class="cromos-ronda">${(fin || acabadas) && !revela ? t("Final") : t("Ronda {n} de {total}", { n: revela ? revelando.ronda + 1 : c.siguiente + 1, total: RONDAS })}</span>
        <span>${escaparHTML(ctx.nombreDe(ctx.otro))} <b>${c.puntos[ctx.otro]}</b></span>
      </div>
      ${revela
        ? mesa(revela.cartas[ctx.yo], revela.cartas[ctx.otro], revela)
        : fin || acabadas
        ? `<ol class="cromos-historial">${c.rondas.map((ronda, i) => {
            const mia = ronda.cartas[ctx.yo];
            const suya = ronda.cartas[ctx.otro];
            const lado = (especie, gana) => `
              <span class="cromos-h-carta ${gana ? "gana" : ""}">
                ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" draggable="false" loading="lazy"`)}
                <span class="cromos-h-nombre">${escaparHTML(nombreDe(especie))}</span>
                <b>${STATS[ronda.stat].valor(especie)}</b>
              </span>`;
            return `
            <li class="${ronda.gana === ctx.yo ? "bien" : ronda.gana ? "mal" : ""}">
              ${lado(mia, ronda.gana === ctx.yo)}
              <span class="cromos-h-stat"><small>${i + 1}</small>${STATS[ronda.stat].nombre()}</span>
              ${lado(suya, ronda.gana === ctx.otro)}
            </li>`;
          }).join("")}</ol>`
        : `<p class="quien-aviso ${meToca ? "destacado" : ""}">${meToca
            ? t("Te toca: elige la estadística de tu carta con la que crees que ganas.")
            : t("Elige {quien}. Tu carta, mientras:", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>
          ${mesa(mia, suya, null)}`}
    </div>`;

  if (!caja.dataset.activo) {
    caja.dataset.activo = "1";
    caja.addEventListener("click", alPulsar);
  }
}

async function alPulsar(e) {
  const boton = e.target.closest(".cromo-stat");
  if (!boton || !actual || actual.estado !== "jugando") return;
  const partida = actual;
  const ctx = ctxActual;
  const stat = Number(boton.dataset.stat);
  for (const cada of caja.querySelectorAll(".cromo-stat")) cada.disabled = true;
  try {
    // Leyendo lo de ahora: que nadie elija dos veces la misma ronda
    await ctx.seguro((ahora) => {
      const c = cuentas(ahora, ctx);
      if (ahora.estado !== "jugando" || c.siguiente >= RONDAS || c.elige !== ctx.yo) return null;
      const elecciones = [...((ahora.datos || {}).elecciones || []), stat];
      const despues = cuentas({ ...ahora, datos: { ...ahora.datos, elecciones } }, ctx);
      return { "datos.elecciones": elecciones, turno: despues.siguiente >= RONDAS ? "" : despues.elige };
    });
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido guardar. Revisa la conexión y vuelve a probar."));
    for (const cada of caja.querySelectorAll(".cromo-stat")) cada.disabled = false;
  }
}

// Al aceptar, elige el retado (como dice cuentas)
export function alAceptar() {
  return {};
}
