// «Supereficaz»: contrarreloj de tipos. Salen RONDAS rivales seguidos y, para cada uno, cuatro
// tipos de ataque: hay que elegir el que más daño le hace (solo uno es el mejor). Hay SEGUNDOS
// para todos; el reloj empieza al pulsar «Empezar» y sigue corriendo aunque recargues.
//
// Las rondas son las mismas para todo el mundo (salen del día). Pokédólares: 5 por acierto (50 si
// aciertas todas), más lo de la racha.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { tiposEs, iconoTipo, coloresTipo } from "../comun/tipos.js";
import { TIPOS, multiplicador } from "../comun/efectividad.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";

const JUEGO = "eficaz";
const RONDAS = 10;
const SEGUNDOS = 45;
const POR_ACIERTO = 10;

let caja = null;
let rondas = [];
let estado = null;
let reloj = null;
let ultima = ""; // «bien» o «mal»: cómo fue la que se acaba de responder (un destello en el siguiente rival)

export async function montarEficaz(contenedor) {
  caja = contenedor;
  clearInterval(reloj);
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  rondas = armarRondas(await cargarEspecies());
  estado = estadoDe(JUEGO);
  if (!estado.respuestas) estado.respuestas = [];
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
  else if (estado.inicio && !estado.fin) seguir();
}

// Cada ronda: { rival, opciones: [tipo x4], buena }. Los otros tres hacen menos daño que la buena.
function armarRondas(especies) {
  const azar = azarDelDia(`${hoy()}|${JUEGO}`);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  return Array.from({ length: RONDAS }, () => {
    const rival = elegir(especies);
    const danos = Object.fromEntries(TIPOS.map((tipo) => [tipo, multiplicador(tipo, rival.tipos)]));
    const maximo = Math.max(...Object.values(danos));
    const buena = elegir(TIPOS.filter((tipo) => danos[tipo] === maximo));
    const peores = TIPOS.filter((tipo) => danos[tipo] < maximo);
    const otras = [];
    while (otras.length < 3) {
      const tipo = elegir(peores);
      if (!otras.includes(tipo)) otras.push(tipo);
    }
    const opciones = [buena, ...otras];
    for (let i = opciones.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
    }
    return { rival, opciones, buena };
  });
}

const aciertos = () => estado.respuestas.filter((tipo, i) => rondas[i] && tipo === rondas[i].buena).length;
const quedaTiempo = () => Math.max(0, SEGUNDOS * 1000 - (Date.now() - estado.inicio));

function plantillaMarcador() {
  return Array.from({ length: RONDAS }, (_, i) => {
    const tipo = estado.respuestas[i];
    const clase = tipo == null ? "" : tipo === rondas[i].buena ? "acierto" : "fallo";
    const nuevo = ultima && i === estado.respuestas.length - 1 ? "nuevo" : "";
    return `<span class="juego-intento ${clase} ${nuevo}"></span>`;
  }).join("");
}

// Al terminar: cada rival con el tipo que elegiste (y el bueno, si fallaste); los que se quedaron sin
// responder por el tiempo, como fallo
function plantillaResumen() {
  const chapa = (tipo) => `<span class="eficaz-tipo" style="--color-tipo: ${coloresTipo[tipo]}">${iconoTipo(tipo)}${escaparHTML(tiposEs[tipo])}</span>`;
  return `<ol class="test-resumen eficaz-resumen">${rondas
    .map((ronda, i) => {
      const elegido = estado.respuestas[i];
      const bien = elegido === ronda.buena;
      return `
        <li class="${bien ? "bien" : "mal"}">
          ${imagenConRespaldo(urlsRetrato({ id: ronda.rival.id }), `alt="" data-quitar-si-falla`)}
          <span>${escaparHTML(nombreDe(ronda.rival))}<small>${bien ? chapa(ronda.buena) : `${elegido ? chapa(elegido) : t("Sin tiempo")} → ${chapa(ronda.buena)}`}</small></span>
          ${icono(bien ? "visto" : "aspa")}
        </li>`;
    })
    .join("")}</ol>`;
}

function pintar() {
  let medio;
  if (estado.fin) {
    const titulo = estado.otroSitio ? t("Ya lo jugaste hoy.") : t("{n} de {total} aciertos.", { n: aciertos(), total: RONDAS });
    medio = estado.otroSitio ? plantillaFin(estado, titulo) : plantillaResumen() + plantillaFin(estado, titulo);
  } else if (!estado.inicio) {
    // Antes de empezar: la explicación en grande, en medio del reto (no un renglón arriba del todo)
    medio = `
      <div class="juego-intro">
        ${icono("rayo")}
        <p class="juego-explicacion">${t("{rondas} rivales y {segundos} segundos. Elige el tipo de ataque que más daño le hace a cada uno.", { rondas: RONDAS, segundos: SEGUNDOS })}</p>
        <button class="juego-empezar">${t("Empezar")}</button>
      </div>`;
  } else {
    const ronda = rondas[estado.respuestas.length];
    medio = `
      <div class="eficaz-reloj"><span style="width:${(quedaTiempo() / (SEGUNDOS * 1000)) * 100}%"></span></div>
      <div class="eficaz-cuerpo ${ultima ? `tras-${ultima}` : ""}">
      <div class="eficaz-rival">
        ${imagenConRespaldo(urlsRetrato({ id: ronda.rival.id }), `alt="" data-quitar-si-falla`)}
        <div>
          <strong>${escaparHTML(nombreDe(ronda.rival))}</strong>
          <span class="eficaz-tipos">${ronda.rival.tipos.map((tipo) => `<span class="eficaz-tipo" style="--color-tipo: ${coloresTipo[tipo]}">${iconoTipo(tipo)}${escaparHTML(tiposEs[tipo])}</span>`).join("")}</span>
        </div>
        <span class="eficaz-ronda">${estado.respuestas.length + 1}/${RONDAS}</span>
      </div>
      <div class="eficaz-opciones">
        ${ronda.opciones.map((tipo) => `<button data-tipo="${tipo}" style="--color-tipo: ${coloresTipo[tipo]}">${iconoTipo(tipo)}${escaparHTML(tiposEs[tipo])}</button>`).join("")}
      </div>
      </div>`;
  }

  caja.innerHTML = `
    <header class="juego-cabeza">
      <h2>${t("Supereficaz")}</h2>
      <span class="juego-intentos">${plantillaMarcador()}</span>
    </header>
    ${medio}`;

  ultima = "";
  const empezar = caja.querySelector(".juego-empezar");
  if (empezar) {
    empezar.addEventListener("click", () => {
      estado.inicio = Date.now();
      guardarEstado(JUEGO, estado);
      seguir();
    });
  }
  for (const boton of caja.querySelectorAll(".eficaz-opciones button")) {
    boton.addEventListener("click", () => responder(boton.dataset.tipo));
  }
}

// El reloj: la barra baja y, al acabarse, se termina con lo que haya
function seguir() {
  clearInterval(reloj);
  if (!quedaTiempo()) {
    acabar();
    return;
  }
  pintar();
  reloj = setInterval(() => {
    if (!caja.isConnected) {
      clearInterval(reloj);
      return;
    }
    const barra = caja.querySelector(".eficaz-reloj span");
    if (barra) barra.style.width = `${(quedaTiempo() / (SEGUNDOS * 1000)) * 100}%`;
    if (!quedaTiempo()) acabar();
  }, 200);
}

function responder(tipo) {
  if (estado.fin || !estado.inicio) return;
  if (!quedaTiempo()) {
    acabar();
    return;
  }
  ultima = tipo === rondas[estado.respuestas.length].buena ? "bien" : "mal";
  estado.respuestas.push(tipo);
  if (estado.respuestas.length >= RONDAS) acabar();
  else {
    guardarEstado(JUEGO, estado);
    pintar();
  }
}

async function acabar() {
  if (estado.fin) return;
  clearInterval(reloj);
  const bien = aciertos();
  // intentos = respondidas; las que quedaron sin responder cuentan como falladas
  estado.acierto = bien === RONDAS;
  estado.intentos = estado.respuestas.slice();
  const cuadros = Array.from({ length: RONDAS }, (_, i) => (estado.respuestas[i] === rondas[i].buena ? "🟩" : "🟥")).join("");
  estado.resumen = `${t("Supereficaz")} ${cuadros} ${bien}/${RONDAS}`;
  const apuntando = terminar(JUEGO, estado, bien * POR_ACIERTO);
  pintar();
  await apuntando;
  pintar();
}
