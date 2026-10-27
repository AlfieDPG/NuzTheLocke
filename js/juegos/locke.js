// «Locke del día»: un líder de un tipo con tres Pokémon (se ven antes de elegir) y seis
// Pokémon para ti. Eliges tres, en el orden en que saldrán, y el combate se juega solo. De
// tus seis, siempre hay UN trío (y solo uno) que puede ganar, en el orden bueno.
// Lo que cae, cae (como en un Nuzlocke): solo hay un intento.
//
// El combate es sencillo a propósito, para poder pensarlo antes:
//   · Todos a nivel 50, con sus estadísticas base (PS = base + 60; el resto, base + 5).
//   · Cada uno pega con el tipo suyo que más daño haga al rival (con STAB, ×1,5), físico o
//     especial según le salga mejor, con potencia 70. Sin azar.
//   · Pega primero el más rápido (si empatan, el tuyo). Al caer uno, sale el siguiente de su
//     lado; el que gana se queda con los PS que tenga.
//
// Se ve en una «arena»: los dos que luchan frente a frente con su barra de PS y, encima, los
// tres de cada lado (los caídos en gris). El que pega embiste, el que recibe se agita y el que
// cae se apaga; debajo, una sola línea con lo que pasa. El combate entero, línea a línea, queda
// plegado debajo («Ver el combate»).
//
// Pokédólares: si ganas, 30 y 10 por cada Pokémon que te quede en pie (60 como mucho); si pierdes,
// 5 por cada Pokémon del líder que hayas derrotado. Más lo de la racha.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { tiposEs, iconoTipo, coloresTipo } from "../comun/tipos.js";
import { TIPOS, multiplicador } from "../comun/efectividad.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";

const JUEGO = "locke";
const OPCIONES = 6;
const EQUIPO = 3;
const POTENCIA = 70;
const PAUSA = 1100; // ms entre momentos del combate

let caja = null;
let lider = null;      // { tipo, equipo: [especie x3] }
let opciones = [];     // [especie x6]
let estado = null;
let elegidos = [];     // ids, en orden (mientras eliges)
let animando = null;

export async function montarLocke(contenedor) {
  caja = contenedor;
  clearTimeout(animando);
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  armar(await cargarEspecies());
  estado = estadoDe(JUEGO);
  elegidos = [];
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
  // Se recargó a mitad del combate: ya estaba elegido, no se puede cambiar
  else if (estado.elegidos && !estado.fin) await cerrar(combatir(misElegidos()));
}

const misElegidos = () => (estado.elegidos || []).map((id) => opciones.find((especie) => especie.id === id)).filter(Boolean);

// El líder y tus seis: totales parecidos, sin legendarios, y ninguno repetido
function armar(especies) {
  const azar = azarDelDia(`${hoy()}|${JUEGO}`);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const sacar = (lista, cuantos, usados) => {
    const salen = [];
    const quedan = lista.filter((especie) => !usados.has(especie.id));
    while (salen.length < cuantos && quedan.length) {
      const especie = quedan.splice(Math.floor(azar() * quedan.length), 1)[0];
      salen.push(especie);
      usados.add(especie.id);
    }
    return salen;
  };
  const normales = especies.filter((especie) => !especie.clase && Array.isArray(especie.bases));
  const candidatos = normales.filter((especie) => especie.total >= 380 && especie.total <= 560);

  // Se prueba hasta dar con un reto en el que SOLO UN trío de tus seis puede ganar (en algún
  // orden). Si en INTENTOS_ARMAR no sale, el que menos tríos ganadores tenga (pero alguno).
  let mejor = null;
  let ultimo = null;
  for (let intento = 0; intento < INTENTOS_ARMAR; intento++) {
    const tipo = elegir(TIPOS);
    const usados = new Set();
    const equipo = sacar(normales.filter((especie) => especie.tipos.includes(tipo) && especie.total >= 420 && especie.total <= 540), EQUIPO, usados);
    const suyas = sacar(candidatos, OPCIONES, usados);
    if (equipo.length < EQUIPO || suyas.length < OPCIONES) continue;
    const ganadores = triosGanadores(suyas, equipo);
    ultimo = { tipo, equipo, suyas, ganadores };
    if (ganadores && (!mejor || ganadores < mejor.ganadores)) mejor = ultimo;
    if (ganadores === 1) break;
  }
  mejor ||= ultimo; // (no debería pasar: siempre sale alguno con un trío ganador)
  lider = { tipo: mejor.tipo, equipo: mejor.equipo };
  opciones = mejor.suyas;
}

const INTENTOS_ARMAR = 400;

// Cuántos tríos de «suyas» ganan a «equipo» en alguno de sus órdenes
function triosGanadores(suyas, equipo) {
  let cuantos = 0;
  for (let a = 0; a < suyas.length; a++) {
    for (let b = a + 1; b < suyas.length; b++) {
      for (let c = b + 1; c < suyas.length; c++) {
        const trio = [suyas[a], suyas[b], suyas[c]];
        const ordenes = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        if (ordenes.some((orden) => gana(orden.map((k) => trio[k]), equipo))) cuantos++;
      }
    }
  }
  return cuantos;
}

// El mismo combate que combatir(), solo para saber si se gana (sin textos: se hace miles de veces)
function gana(mios, equipo) {
  const ps = { yo: mios.map((especie) => stats(especie).ps), el: equipo.map((especie) => stats(especie).ps) };
  let i = 0;
  let j = 0;
  while (i < mios.length && j < equipo.length) {
    const golpeMio = golpe(mios[i], equipo[j]);
    const golpeSuyo = golpe(equipo[j], mios[i]);
    if (!golpeMio.dano && !golpeSuyo.dano) {
      i++;
      j++;
      continue;
    }
    for (const quien of stats(mios[i]).vel >= stats(equipo[j]).vel ? ["yo", "el"] : ["el", "yo"]) {
      const lado = quien === "yo" ? "el" : "yo";
      const indice = quien === "yo" ? j : i;
      ps[lado][indice] = Math.max(0, ps[lado][indice] - (quien === "yo" ? golpeMio : golpeSuyo).dano);
      if (!ps[lado][indice]) {
        if (lado === "el") j++;
        else i++;
        break;
      }
    }
  }
  return j >= equipo.length && i < mios.length;
}

// ---------- Combate ----------

const stats = (especie) => {
  const [ps, at, df, ate, dfe, vel] = especie.bases;
  return { ps: ps + 60, at: at + 5, df: df + 5, ate: ate + 5, dfe: dfe + 5, vel: vel + 5 };
};

// El mejor golpe de «atacante» a «defensor»: { dano, tipo, mult }
function golpe(atacante, defensor) {
  const a = stats(atacante);
  const d = stats(defensor);
  const razon = Math.max(a.at / d.df, a.ate / d.dfe);
  let mejor = null;
  for (const tipo of atacante.tipos) {
    const mult = multiplicador(tipo, defensor.tipos);
    const dano = mult ? Math.max(1, Math.floor(Math.floor((22 * POTENCIA * razon) / 50 + 2) * 1.5 * mult)) : 0;
    if (!mejor || dano > mejor.dano) mejor = { dano, tipo, mult };
  }
  return mejor;
}

// El combate entero, en momentos. Cada momento: { texto, clase, i, j, ps: { yo, el }, ataca, cae }
// (i, j: quién lucha de cada lado; ps: cómo quedan los PS de todos después de ese momento;
// ataca: "yo" o "el" si alguien pega; cae: el lado del que cae). Devuelve también
// { gana, vivos, derrotados, ps } para el final.
function combatir(mios) {
  const momentos = [];
  const ps = { yo: mios.map((especie) => stats(especie).ps), el: lider.equipo.map((especie) => stats(especie).ps) };
  let i = 0;
  let j = 0;
  const nombre = (especie) => escaparHTML(nombreDe(especie));
  const efecto = (mult) => (mult >= 2 ? t("¡Es supereficaz!") : mult === 0 ? t("No le afecta...") : mult < 1 ? t("No es muy eficaz...") : "");
  const apuntar = (texto, clase, extra = {}) =>
    momentos.push({ texto, clase, i, j, ps: { yo: [...ps.yo], el: [...ps.el] }, ataca: null, cae: null, ...extra });

  apuntar(t("¡Empieza el combate! {a} contra {b}.", { a: nombre(mios[0]), b: nombre(lider.equipo[0]) }), "neutro");

  while (i < mios.length && j < lider.equipo.length) {
    const mio = mios[i];
    const suyo = lider.equipo[j];
    const golpeMio = golpe(mio, suyo);
    const golpeSuyo = golpe(suyo, mio);
    if (!golpeMio.dano && !golpeSuyo.dano) {
      apuntar(t("{a} y {b} no pueden hacerse daño: los dos se retiran.", { a: nombre(mio), b: nombre(suyo) }), "neutro");
      i++;
      j++;
      continue;
    }
    const primeroYo = stats(mio).vel >= stats(suyo).vel;
    for (const quien of primeroYo ? ["yo", "el"] : ["el", "yo"]) {
      const atacante = quien === "yo" ? mio : suyo;
      const defensor = quien === "yo" ? suyo : mio;
      const lado = quien === "yo" ? "el" : "yo";
      const indice = quien === "yo" ? j : i;
      const g = quien === "yo" ? golpeMio : golpeSuyo;
      ps[lado][indice] = Math.max(0, ps[lado][indice] - g.dano);
      apuntar(
        `${t("{a} ataca con un golpe de tipo {tipo}.", { a: nombre(atacante), tipo: escaparHTML(tiposEs[g.tipo]) })} ${efecto(g.mult)}`,
        quien === "yo" ? "mio" : "suyo",
        { ataca: quien }
      );
      if (!ps[lado][indice]) {
        apuntar(
          lado === "el" ? t("¡{b} del líder se ha debilitado!", { b: nombre(defensor) }) : t("{b} ha caído...", { b: nombre(defensor) }),
          lado === "el" ? "cae-suyo" : "cae-mio",
          { cae: lado }
        );
        if (lado === "el") j++;
        else i++;
        const siguiente = lado === "el" ? lider.equipo[j] : mios[i];
        if (siguiente && i < mios.length && j < lider.equipo.length) {
          apuntar(lado === "el" ? t("El líder saca a {b}.", { b: nombre(siguiente) }) : t("¡Adelante, {b}!", { b: nombre(siguiente) }), "neutro");
        }
        break; // el que cae ya no pega
      }
    }
  }
  const gana = j >= lider.equipo.length && i < mios.length;
  return { momentos, gana, vivos: ps.yo.filter(Boolean).length, derrotados: j, ps: ps.yo };
}

// ---------- Arena ----------

// Un lado de la arena en un momento. «antes»: los PS del momento anterior (la barra baja desde ahí)
function plantillaLado(quien, mios, momento, antes) {
  const equipo = quien === "yo" ? mios : lider.equipo;
  const indice = Math.min(quien === "yo" ? momento.i : momento.j, equipo.length - 1);
  const luchador = equipo[indice];
  const maximo = stats(luchador).ps;
  const ahora = momento.ps[quien][indice];
  const previo = antes ? antes[quien][indice] : ahora;
  const animacion = momento.ataca === quien ? "embiste" : momento.ataca && momento.ataca !== quien ? "sacude" : "";
  const banca = equipo
    .map((especie, k) => `
      <span class="lockedia-banca-poke ${momento.ps[quien][k] ? "" : "caido"} ${k === indice ? "activo" : ""}" title="${escaparHTML(nombreDe(especie))}">
        ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" data-quitar-si-falla`)}
      </span>`)
    .join("");
  const porcentaje = (valor) => Math.round((valor / maximo) * 100);
  return `
    <div class="lockedia-lado ${quien}">
      <div class="lockedia-banca">${banca}</div>
      <div class="lockedia-luchador ${animacion} ${ahora ? "" : "debilitado"}">
        ${imagenConRespaldo(urlsRetrato({ id: luchador.id }), `alt="" data-quitar-si-falla`)}
      </div>
      <strong>${escaparHTML(nombreDe(luchador))}</strong>
      <div class="lockedia-ps" title="${ahora}/${maximo}">
        <span style="width: ${porcentaje(previo)}%" data-hasta="${porcentaje(ahora)}" class="${porcentaje(ahora) <= 25 ? "rojo" : porcentaje(ahora) <= 50 ? "amarillo" : ""}"></span>
      </div>
      <small>${ahora}/${maximo} ${t("PS")}</small>
    </div>`;
}

function plantillaArena(mios, momento, antes) {
  return `
    <div class="lockedia-arena">
      ${plantillaLado("yo", mios, momento, antes)}
      <span class="lockedia-contra">${icono("espadas")}</span>
      ${plantillaLado("el", mios, momento, antes)}
    </div>
    <p class="lockedia-mensaje ${momento.clase}">${momento.texto}</p>`;
}

// Las barras de PS, del valor de antes al de ahora (con su transición)
function bajarBarras(contenedor) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const barra of contenedor.querySelectorAll(".lockedia-ps span[data-hasta]")) barra.style.width = `${barra.dataset.hasta}%`;
  }));
}

function plantillaRegistro(momentos) {
  return `
    <details class="lockedia-registro">
      <summary>${t("Ver el combate")}</summary>
      <ol>${momentos.map((momento) => `<li class="${momento.clase}">${momento.texto}</li>`).join("")}</ol>
    </details>`;
}

// ---------- Pintar ----------

function plantillaPokemon(especie, { boton = false, orden = 0, caido = false } = {}) {
  const etiqueta = boton ? "button" : "div";
  return `
    <${etiqueta} class="lockedia-poke ${orden ? "elegido" : ""} ${caido ? "caido" : ""}" ${boton ? `data-id="${especie.id}"` : ""}>
      ${orden ? `<span class="lockedia-orden">${orden}</span>` : ""}
      ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" data-quitar-si-falla`)}
      <strong>${escaparHTML(nombreDe(especie))}</strong>
      <span class="lockedia-tipos">${especie.tipos.map((tipo) => `<span style="--color-tipo: ${coloresTipo[tipo]}">${iconoTipo(tipo)}</span>`).join("")}</span>
      <small>${t("Total {n}", { n: especie.total })} · ${t("Vel. {n}", { n: especie.bases[5] })}</small>
    </${etiqueta}>`;
}

function plantillaLider() {
  return `
    <div class="lockedia-lider" style="--color-tipo: ${coloresTipo[lider.tipo]}">
      <span class="lockedia-lider-titulo">${iconoTipo(lider.tipo)} ${t("Líder de tipo {tipo}", { tipo: escaparHTML(tiposEs[lider.tipo]) })}</span>
      <div class="lockedia-equipo">${lider.equipo.map((especie) => plantillaPokemon(especie)).join("")}</div>
    </div>`;
}

const cabeza = () => `
  <header class="juego-cabeza">
    <h2>${t("Locke del día")}</h2>
  </header>`;

function pintar() {
  if (estado.otroSitio) {
    caja.innerHTML = cabeza() + plantillaFin(estado, t("Ya lo jugaste hoy."));
    return;
  }

  // Terminado: la arena como quedó, el final y el combate plegado
  if (estado.fin && estado.elegidos) {
    const mios = misElegidos();
    const resultado = combatir(mios);
    const ultimo = resultado.momentos[resultado.momentos.length - 1];
    const titulo = resultado.gana
      ? t("¡Has ganado! Te quedan {n} en pie.", { n: resultado.vivos })
      : t("Has perdido. Derrotaste a {n} del líder.", { n: resultado.derrotados });
    caja.innerHTML = `
      ${cabeza()}
      ${plantillaArena(mios, { ...ultimo, ataca: null }, null)}
      ${plantillaFin(estado, titulo)}
      ${plantillaRegistro(resultado.momentos)}`;
    return;
  }

  caja.innerHTML = `
    ${cabeza()}
    ${plantillaLider()}
    <p class="juego-explicacion">${t("Elige 3 de los tuyos, en el orden en que saldrán. Pega primero el más rápido; cada uno usa el tipo suyo que más daño haga. Lo que cae, cae.")}</p>
    <div class="lockedia-opciones">
      ${opciones.map((especie) => plantillaPokemon(especie, { boton: true, orden: elegidos.indexOf(especie.id) + 1 })).join("")}
    </div>
    <button class="juego-empezar lockedia-combatir" ${elegidos.length === EQUIPO ? "" : "disabled"}>
      ${icono("espadas")} ${t("¡Al combate!")} <small>(${elegidos.length}/${EQUIPO})</small>
    </button>`;

  for (const boton of caja.querySelectorAll(".lockedia-opciones [data-id]")) {
    boton.addEventListener("click", () => {
      const id = Number(boton.dataset.id);
      if (elegidos.includes(id)) elegidos = elegidos.filter((cada) => cada !== id);
      else if (elegidos.length < EQUIPO) elegidos.push(id);
      pintar();
    });
  }
  caja.querySelector(".lockedia-combatir").addEventListener("click", combatirYa);
}

// El combate, momento a momento en la arena; al acabar, se apunta
async function combatirYa() {
  if (estado.fin || elegidos.length !== EQUIPO) return;
  estado.elegidos = elegidos.slice();
  const mios = misElegidos();
  const resultado = combatir(mios);
  estado.intentos = [1];
  estado.acierto = resultado.gana;
  guardarEstado(JUEGO, estado); // si se recarga a mitad, el combate ya está elegido

  caja.innerHTML = `${cabeza()}<div class="lockedia-escena"></div>`;
  const escena = caja.querySelector(".lockedia-escena");
  let antes = null;
  for (const momento of resultado.momentos) {
    if (!escena.isConnected) break;
    escena.innerHTML = plantillaArena(mios, momento, antes);
    bajarBarras(escena);
    antes = momento.ps;
    await new Promise((listo) => (animando = setTimeout(listo, PAUSA)));
  }

  await cerrar(resultado);
}

async function cerrar(resultado) {
  const cuadros = resultado.ps.map((vivo) => (vivo ? "🟩" : "🟥")).join("");
  estado.resumen = `${t("Locke del día")} (${tiposEs[lider.tipo]}) ${cuadros} ${resultado.gana ? "🏆" : "💀"}`;
  const puntos = resultado.gana ? 30 + 10 * resultado.vivos : 5 * resultado.derrotados;
  const apuntando = terminar(JUEGO, estado, puntos);
  pintar();
  await apuntando;
  pintar();
}
