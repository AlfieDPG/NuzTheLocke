// «¿Más o menos?»: a la izquierda un Pokémon con una de sus estadísticas a la vista; a la
// derecha otro, con la misma estadística escondida. ¿Tiene más o menos? Si aciertas, el de la
// derecha pasa a la izquierda y sale otro (y otra estadística). Al primer fallo se acaba; como
// mucho RONDAS seguidas.
//
// La cadena es la misma para todo el mundo (sale del día) y nunca hay empates. Pokédólares: 5 por
// acierto (50 si llegas al final), más lo de la racha.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";

const JUEGO = "masomenos";
const RONDAS = 10;
const POR_ACIERTO = 5;

// índice en «bases» (o «total»)
const ESTADISTICAS = [
  { id: 0, nombre: t("PS") },
  { id: 1, nombre: t("Ataque") },
  { id: 2, nombre: t("Defensa") },
  { id: 3, nombre: t("At. Esp.") },
  { id: 4, nombre: t("Def. Esp.") },
  { id: 5, nombre: t("Velocidad") },
  { id: "total", nombre: t("Total") }
];

let caja = null;
let cadena = [];   // RONDAS + 1 Pokémon
let cuales = [];   // la estadística de cada ronda
let estado = null;
let ocupado = false;

const valor = (especie, estadistica) => (estadistica.id === "total" ? especie.total : especie.bases[estadistica.id]);

export async function montarMasOMenos(contenedor) {
  caja = contenedor;
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  armarCadena(await cargarEspecies());
  estado = estadoDe(JUEGO);
  if (!estado.aciertos) estado.aciertos = 0;
  if (!estado.intentos) estado.intentos = [];
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
}

function armarCadena(especies) {
  const azar = azarDelDia(`${hoy()}|${JUEGO}`);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const conBases = especies.filter((especie) => Array.isArray(especie.bases));
  cadena = [elegir(conBases)];
  cuales = [];
  for (let i = 0; i < RONDAS; i++) {
    const estadistica = elegir(ESTADISTICAS);
    const anterior = cadena[i];
    let siguiente;
    do siguiente = elegir(conBases);
    while (siguiente.id === anterior.id || cadena.includes(siguiente) || valor(siguiente, estadistica) === valor(anterior, estadistica));
    cadena.push(siguiente);
    cuales.push(estadistica);
  }
}

function plantillaLado(especie, estadistica, oculto, botones = "") {
  return `
    <div class="masomenos-lado ${oculto ? "adivinar" : ""}">
      <span class="masomenos-etiqueta">${oculto ? t("¿Cuánto tiene?") : t("Tiene")}</span>
      ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" data-quitar-si-falla`)}
      <strong>${escaparHTML(nombreDe(especie))}</strong>
      <span class="masomenos-valor ${oculto ? "oculto" : ""}">${oculto ? "?" : valor(especie, estadistica)}</span>
      <small>${escaparHTML(estadistica.nombre)}</small>
      ${botones}
    </div>`;
}

function pintar() {
  const ronda = estado.aciertos + (estado.fallo ? 1 : 0);
  const marcador = Array.from({ length: RONDAS }, (_, i) => {
    const clase = i < estado.aciertos ? "acierto" : estado.fallo && i === estado.aciertos ? "fallo" : "";
    return `<span class="juego-intento ${clase}"></span>`;
  }).join("");

  let medio;
  if (estado.otroSitio) {
    medio = plantillaFin(estado, t("Ya lo jugaste hoy."));
  } else if (estado.fin) {
    // Se ve la última comparación, ya con los dos valores
    const i = Math.min(ronda, RONDAS) - 1;
    const ultima = i >= 0
      ? `<div class="masomenos-duelo">
          ${plantillaLado(cadena[i], cuales[i], false)}
          <span class="masomenos-vs">${t("contra")}</span>
          ${plantillaLado(cadena[i + 1], cuales[i], false)}
        </div>`
      : "";
    medio = ultima + plantillaFin(estado, t(estado.aciertos === 1 ? "{n} acierto seguido." : "{n} aciertos seguidos.", { n: estado.aciertos }));
  } else {
    // La pregunta es siempre sobre el de la derecha (el escondido), y los botones van en su
    // tarjeta, con su nombre: «Duskull tiene más» / «Duskull tiene menos»
    const i = estado.aciertos;
    const izquierda = escaparHTML(nombreDe(cadena[i]));
    const derecha = escaparHTML(nombreDe(cadena[i + 1]));
    const estadistica = escaparHTML(cuales[i].nombre);
    const botones = `
      <div class="masomenos-botones">
        <button data-respuesta="mas">${icono("arriba")} ${t("Tiene más")}</button>
        <button data-respuesta="menos">${icono("abajo")} ${t("Tiene menos")}</button>
      </div>`;
    medio = `
      <p class="masomenos-pregunta">${t("¿{derecha} tiene más o menos {estadistica} que {izquierda}?", { derecha: `<strong>${derecha}</strong>`, estadistica, izquierda })}</p>
      <div class="masomenos-duelo">
        ${plantillaLado(cadena[i], cuales[i], false)}
        <span class="masomenos-vs">${t("contra")}</span>
        ${plantillaLado(cadena[i + 1], cuales[i], true, botones)}
      </div>`;
  }

  caja.innerHTML = `
    <header class="juego-cabeza">
      <h2>${t("¿Más o menos?")}</h2>
      <span class="juego-intentos">${marcador}</span>
    </header>
    ${medio}`;

  for (const boton of caja.querySelectorAll("[data-respuesta]")) {
    boton.addEventListener("click", () => responder(boton.dataset.respuesta));
  }
}

async function responder(respuesta) {
  if (ocupado || estado.fin) return;
  ocupado = true;
  try {
    const i = estado.aciertos;
    const mas = valor(cadena[i + 1], cuales[i]) > valor(cadena[i], cuales[i]);
    estado.intentos.push(respuesta);
    if ((respuesta === "mas") === mas) estado.aciertos++;
    else estado.fallo = true;

    if (estado.fallo || estado.aciertos >= RONDAS) {
      estado.acierto = estado.aciertos >= RONDAS;
      const cuadros = "🟩".repeat(estado.aciertos) + (estado.fallo ? "🟥" : "");
      estado.resumen = `${t("¿Más o menos?")} ${cuadros} ${estado.aciertos}/${RONDAS}`;
      const apuntando = terminar(JUEGO, estado, estado.aciertos * POR_ACIERTO);
      pintar();
      await apuntando;
    } else {
      guardarEstado(JUEGO, estado);
    }
    pintar();
  } finally {
    ocupado = false;
  }
}
