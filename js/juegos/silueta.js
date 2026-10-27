// «¿Quién es ese Pokémon?»: tres siluetas al día (su arte oficial, en negro), de menos a más
// difícil: una de las generaciones 1 a 3, otra de la 4 a la 6 y otra de la 7 a la 9. Cada una
// tiene tres intentos, y cada fallo da una pista: primero sus tipos, luego su generación y su
// inicial. Al acertar (o al gastar los intentos) se ve en color y se pasa a la siguiente.
//
// A la izquierda, la silueta (grande); a la derecha, las tres rondas, la casilla y las pistas.
//
// Pokédólares: 10, 7 o 4 por cada silueta según el intento en que la aciertes (30 como mucho),
// más lo de la racha.
//
//   estado: { rondas: [{ intentos: [numero], acierto }], fin, ... } (ver comun.js)

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { urlArte, imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { tiposEs } from "../comun/tipos.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";

const JUEGO = "silueta";
const INTENTOS = 3;
const PUNTOS = [10, 7, 4];
const RONDAS = [
  { nombre: t("Fácil"), gens: [1, 2, 3] },
  { nombre: t("Media"), gens: [4, 5, 6] },
  { nombre: t("Difícil"), gens: [7, 8, 9] }
];

let caja = null;
let especies = [];
let objetivos = [];
let estado = null;
let ocupado = false;

export async function montarSilueta(contenedor) {
  caja = contenedor;
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  especies = await cargarEspecies();
  const azar = azarDelDia(`${hoy()}|${JUEGO}`);
  objetivos = RONDAS.map((ronda) => {
    const lista = especies.filter((especie) => ronda.gens.includes(especie.gen));
    return lista[Math.floor(azar() * lista.length)];
  });
  estado = estadoDe(JUEGO);
  // Lo guardado por la versión de una sola silueta (sin rondas): si ya estaba terminado, se
  // da por jugado; si no, se empieza con las tres
  if (!Array.isArray(estado.rondas)) {
    if (estado.fin) estado.antiguo = true;
    else estado.intentos = [];
    estado.rondas = [];
  }
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
}

// La ronda en juego (la primera sin terminar), o -1 si están todas
function rondaActual() {
  for (let i = 0; i < RONDAS.length; i++) {
    const ronda = estado.rondas[i];
    if (!ronda || (!ronda.acierto && ronda.intentos.length < INTENTOS)) return i;
  }
  return -1;
}

const nombreDeNumero = (numero) => nombreDe(especies.find((especie) => especie.id === numero) || {});

function pistas(i) {
  const ronda = estado.rondas[i] || { intentos: [] };
  const objetivo = objetivos[i];
  const fallos = ronda.intentos.length - (ronda.acierto ? 1 : 0);
  return [
    { abierta: fallos >= 1, texto: t("Tipo: {tipos}", { tipos: objetivo.tipos.map((tipo) => tiposEs[tipo]).join(" / ") }) },
    { abierta: fallos >= 2, texto: t("Generación {n}, empieza por «{letra}»", { n: objetivo.gen, letra: nombreDe(objetivo).charAt(0) }) }
  ];
}

// Las tres rondas, una debajo de otra: la jugada con el Pokémon (o el fallo), la actual
// marcada, las que faltan esperando
function plantillaRondas(actual) {
  return RONDAS.map((ronda, i) => {
    const suya = estado.rondas[i];
    const hecha = suya && (suya.acierto || suya.intentos.length >= INTENTOS);
    let detalle;
    if (hecha) {
      detalle = `
        ${imagenConRespaldo(urlsRetrato({ id: objetivos[i].id }), `alt="" data-quitar-si-falla`)}
        <span>${escaparHTML(nombreDe(objetivos[i]))}</span>
        <small class="${suya.acierto ? "bien" : "mal"}">${suya.acierto ? `${icono("visto")} +${PUNTOS[suya.intentos.length - 1]}` : icono("aspa")}</small>`;
    } else if (i === actual) {
      detalle = `<span>${t("Ahora")}</span><small>${t("{n} intentos", { n: INTENTOS - ((suya && suya.intentos.length) || 0) })}</small>`;
    } else {
      detalle = `<span class="apagado">${t("Por jugar")}</span>`;
    }
    return `
      <li class="silueta-ronda ${i === actual ? "actual" : ""} ${hecha ? "hecha" : ""}">
        <strong>${ronda.nombre}<small>${t("Gen. {desde}-{hasta}", { desde: ronda.gens[0], hasta: ronda.gens[2] })}</small></strong>
        <span class="silueta-ronda-detalle">${detalle}</span>
      </li>`;
  }).join("");
}

function pintar() {
  if (estado.otroSitio || estado.antiguo) {
    caja.innerHTML = `
      <header class="juego-cabeza"><h2>${t("¿Quién es ese Pokémon?")}</h2></header>
      ${plantillaFin(estado, t("Ya lo jugaste hoy."))}`;
    return;
  }

  const actual = rondaActual();
  // La que se ve: la actual o, al terminar, la última
  const vista = actual >= 0 ? actual : RONDAS.length - 1;
  const ronda = estado.rondas[vista] || { intentos: [] };
  const revelada = actual < 0 || ronda.acierto || ronda.intentos.length >= INTENTOS;
  const fallos = ronda.intentos.filter((numero) => numero !== objetivos[vista].id);
  const marcador = Array.from({ length: INTENTOS }, (_, i) => {
    const numero = ronda.intentos[i];
    const clase = numero == null ? "" : numero === objetivos[vista].id ? "acierto" : "fallo";
    return `<span class="juego-intento ${clase}"></span>`;
  }).join("");
  const aciertos = estado.rondas.filter((cada) => cada && cada.acierto).length;

  caja.innerHTML = `
    <header class="juego-cabeza">
      <h2>${t("¿Quién es ese Pokémon?")}</h2>
      <span class="juego-intentos" title="${t("Intentos")}">${marcador}</span>
    </header>
    <div class="silueta-cuerpo">
      <div class="silueta-pantalla">
        <span class="silueta-numero">${t("Silueta {n} de {total}", { n: vista + 1, total: RONDAS.length })}</span>
        <img class="silueta-imagen ${revelada ? "revelada" : ""}" src="${escaparHTML(urlArte({ id: objetivos[vista].id }))}"
             alt="" draggable="false">
        ${revelada ? `<span class="silueta-nombre">${escaparHTML(nombreDe(objetivos[vista]))}</span>` : ""}
      </div>
      <div class="silueta-lado">
        <ol class="silueta-rondas">${plantillaRondas(actual)}</ol>
        ${estado.fin
          ? plantillaFin(estado, t("{n} de {total} siluetas.", { n: aciertos, total: RONDAS.length }))
          : `<form class="juego-form">
              <span class="juego-campo"><input type="text" autocomplete="off" placeholder="${t("Escribe un Pokémon...")}"
                     aria-label="${t("Pokémon")}"></span>
              <button type="submit">${t("Probar")}</button>
            </form>
            <ul class="silueta-pistas">
              ${pistas(vista)
                .map((pista) => `<li class="${pista.abierta ? "" : "cerrada"}">${icono(pista.abierta ? "lupa" : "candado")} ${pista.abierta ? escaparHTML(pista.texto) : t("Pista al fallar")}</li>`)
                .join("")}
            </ul>
            ${fallos.length
              ? `<ul class="silueta-fallos">${fallos.map((numero) => `<li>${icono("aspa")} ${escaparHTML(nombreDeNumero(numero))}</li>`).join("")}</ul>`
              : ""}`}
      </div>
    </div>`;

  const formulario = caja.querySelector(".juego-form");
  if (!formulario) return;
  const campo = formulario.querySelector("input");
  const sugerencias = activarAutocompletado(campo, especies, probar, { icono: iconoPokemon });
  formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    sugerencias.elegirPrimera();
  });
}

async function probar(especie) {
  const i = rondaActual();
  if (ocupado || estado.fin || i < 0) return;
  const ronda = (estado.rondas[i] ||= { intentos: [], acierto: false });
  if (ronda.intentos.includes(especie.id)) return;
  ocupado = true;
  try {
    ronda.intentos.push(especie.id);
    ronda.acierto = especie.id === objetivos[i].id;

    if (rondaActual() < 0) {
      // Las tres hechas: se apunta todo junto
      estado.intentos = estado.rondas.flatMap((cada) => cada.intentos);
      estado.acierto = estado.rondas.every((cada) => cada.acierto);
      const puntos = estado.rondas.reduce((suma, cada) => suma + (cada.acierto ? PUNTOS[cada.intentos.length - 1] : 0), 0);
      const cuadros = estado.rondas
        .map((cada) => cada.intentos.map((numero, k) => (cada.acierto && k === cada.intentos.length - 1 ? "🟩" : "🟥")).join(""))
        .join(" ");
      estado.resumen = `${t("¿Quién es ese Pokémon?")} ${cuadros} ${estado.rondas.filter((cada) => cada.acierto).length}/${RONDAS.length}`;
      const apuntando = terminar(JUEGO, estado, puntos);
      pintar(); // ya terminado, mientras se apuntan los Pokédólares
      await apuntando;
    } else {
      guardarEstado(JUEGO, estado);
    }
    pintar();
    if (!estado.fin) caja.querySelector(".juego-form input").focus();
  } finally {
    ocupado = false;
  }
}
