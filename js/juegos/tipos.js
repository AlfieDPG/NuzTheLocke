// «¿De qué tipo es?»: sale un Pokémon y hay que marcar su tipo, o sus dos tipos, entre los 18 y
// pulsar «Comprobar». Solo vale si aciertas todos, ni uno más ni uno menos (no se dice si tiene
// uno o dos). RONDAS rondas al día, las mismas para todo el mundo: DOBLES de ellas con dos tipos.
// Al comprobar se marcan los buenos (también los que te faltaron) y al poco se pasa al siguiente.
//
// Pokédólares: 8 por acierto (48 si aciertas todos), más lo de la racha.
//
//   estado: { respuestas: [[tipo]], fin, ... } (ver comun.js)

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { tiposEs, iconoTipo, coloresTipo } from "../comun/tipos.js";
import { TIPOS } from "../comun/efectividad.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";
import { mezclar } from "./test.js";

const JUEGO = "tipos";
const RONDAS = 6;
const DOBLES = 4;
const POR_ACIERTO = 8;
const PAUSA = 1600; // ms con la respuesta a la vista

let caja = null;
let rondas = [];
let estado = null;
let elegidos = []; // los marcados en la ronda en juego (no se guardan)
let mostrando = null; // { ronda, tipos }: la recién comprobada, mientras se ve

export async function montarTipos(contenedor) {
  caja = contenedor;
  mostrando = null;
  elegidos = [];
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  rondas = armarRondas(await cargarEspecies());
  estado = estadoDe(JUEGO);
  if (!estado.respuestas) estado.respuestas = [];
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
}

// Cada ronda: { especie }. DOBLES con dos tipos y el resto con uno, mezclados.
function armarRondas(especies) {
  const azar = azarDelDia(`${hoy()}|${JUEGO}`);
  const mezcladas = mezclar(especies, azar);
  const dobles = mezcladas.filter((especie) => especie.tipos.length === 2).slice(0, DOBLES);
  const sencillos = mezcladas.filter((especie) => especie.tipos.length === 1).slice(0, RONDAS - DOBLES);
  return mezclar([...dobles, ...sencillos], azar).map((especie) => ({ especie }));
}

const esBuena = (ronda, tipos) =>
  Boolean(tipos) && tipos.length === ronda.especie.tipos.length && tipos.every((tipo) => ronda.especie.tipos.includes(tipo));
const aciertos = () => rondas.filter((ronda, i) => esBuena(ronda, estado.respuestas[i])).length;

function plantillaTipo(tipo, ronda, respuesta) {
  let clase = "";
  if (respuesta) {
    const suyo = ronda.especie.tipos.includes(tipo);
    const marcado = respuesta.includes(tipo);
    if (suyo) clase = marcado ? "buena" : "faltaba";
    else if (marcado) clase = "mala";
  } else if (elegidos.includes(tipo)) clase = "elegido";
  return `
    <button class="${clase}" data-tipo="${tipo}" style="--color-tipo: ${coloresTipo[tipo]}" ${respuesta ? "disabled" : ""}
      aria-pressed="${elegidos.includes(tipo) || (respuesta || []).includes(tipo)}">
      ${iconoTipo(tipo)}<span>${escaparHTML(tiposEs[tipo])}</span>
    </button>`;
}

function plantillaResumen() {
  return `<ol class="test-resumen">${rondas
    .map((ronda, i) => {
      const bien = esBuena(ronda, estado.respuestas[i]);
      return `
        <li class="${bien ? "bien" : "mal"}">
          ${imagenConRespaldo(urlsRetrato({ id: ronda.especie.id }), `alt="" data-quitar-si-falla`)}
          <span>${escaparHTML(nombreDe(ronda.especie))}</span>
          <span class="tipos-resumen">${ronda.especie.tipos.map((tipo) => `<span style="--color-tipo: ${coloresTipo[tipo]}" title="${escaparHTML(tiposEs[tipo])}">${iconoTipo(tipo)}</span>`).join("")}</span>
          ${icono(bien ? "visto" : "aspa")}
        </li>`;
    })
    .join("")}</ol>`;
}

function pintar() {
  const marcador = rondas.map((ronda, i) => {
    const tipos = estado.respuestas[i];
    const clase = tipos == null ? "" : esBuena(ronda, tipos) ? "acierto" : "fallo";
    return `<span class="juego-intento ${clase}"></span>`;
  }).join("");

  let medio;
  if (estado.otroSitio) medio = plantillaFin(estado, t("Ya lo jugaste hoy."));
  else if (estado.fin && !mostrando) {
    medio = plantillaResumen() + plantillaFin(estado, t("{n} de {total} aciertos.", { n: aciertos(), total: rondas.length }));
  } else {
    const i = mostrando ? mostrando.ronda : estado.respuestas.length;
    const ronda = rondas[i];
    const respuesta = mostrando ? mostrando.tipos : null;
    medio = `
      <div class="test-cuerpo">
        <div class="test-pregunta">
          <span class="test-ronda">${t("Pregunta {n} de {total}", { n: i + 1, total: rondas.length })}</span>
          <div class="evolucion-padre">
            ${imagenConRespaldo(urlsRetrato({ id: ronda.especie.id }), `alt="" data-quitar-si-falla`)}
            <strong>${escaparHTML(nombreDe(ronda.especie))}</strong>
          </div>
        </div>
        <div class="tipos-lado">
          <div class="tipos-opciones">${TIPOS.map((tipo) => plantillaTipo(tipo, ronda, respuesta)).join("")}</div>
          <button class="juego-empezar tipos-comprobar" ${respuesta || !elegidos.length ? "disabled" : ""}>${t("Comprobar")}</button>
        </div>
      </div>`;
  }

  caja.innerHTML = `
    <header class="juego-cabeza">
      <h2>${t("¿De qué tipo es?")}</h2>
      <span class="juego-intentos">${marcador}</span>
    </header>
    ${estado.fin && !mostrando ? "" : `<p class="juego-explicacion">${t("Marca su tipo, o sus dos tipos, y pulsa «Comprobar». Solo vale si aciertas todos.")}</p>`}
    ${medio}`;

  for (const boton of caja.querySelectorAll(".tipos-opciones button:not(:disabled)")) {
    boton.addEventListener("click", () => marcar(boton.dataset.tipo));
  }
  const comprobar = caja.querySelector(".tipos-comprobar");
  if (comprobar) comprobar.addEventListener("click", responder);
}

// Como mucho dos: al marcar un tercero, se quita el primero que marcaste
function marcar(tipo) {
  if (estado.fin || mostrando) return;
  if (elegidos.includes(tipo)) elegidos = elegidos.filter((cada) => cada !== tipo);
  else elegidos = [...elegidos, tipo].slice(-2);
  pintar();
}

async function responder() {
  if (estado.fin || mostrando || !elegidos.length) return;
  const i = estado.respuestas.length;
  estado.respuestas.push(elegidos);
  mostrando = { ronda: i, tipos: elegidos };
  elegidos = [];
  let apuntando = null;
  if (estado.respuestas.length >= rondas.length) {
    const bien = aciertos();
    estado.intentos = estado.respuestas.slice();
    estado.acierto = bien === rondas.length;
    const cuadros = rondas.map((ronda, k) => (esBuena(ronda, estado.respuestas[k]) ? "🟩" : "🟥")).join("");
    estado.resumen = `${t("¿De qué tipo es?")} ${cuadros} ${bien}/${rondas.length}`;
    apuntando = terminar(JUEGO, estado, bien * POR_ACIERTO);
  } else {
    guardarEstado(JUEGO, estado);
  }
  pintar();
  await new Promise((listo) => setTimeout(listo, PAUSA));
  mostrando = null;
  if (!caja.isConnected) return;
  pintar();
  if (apuntando) {
    await apuntando;
    if (caja.isConnected) pintar();
  }
}
