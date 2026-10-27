// Lo común de los retos tipo test (grito.js, evolucion.js): unas cuantas rondas, cada una con
// una pregunta y cuatro Pokémon para elegir. Al responder se marca la buena (y la tuya, si no
// lo era) y al poco se pasa a la siguiente. Al final, la lista de todas las rondas.
//
//   crearTest({
//     juego, titulo, explicacion, porAcierto,
//     armar(especies, azar)  -> [{ buena: especie, opciones: [especie x4] }] (las rondas del día)
//     pregunta(ronda, i)     -> HTML de lo que se pregunta en esa ronda
//     alEntrar(ronda, caja)  -> (opcional) algo al enseñar la ronda (el grito: que suene)
//   }) -> la función montar(contenedor) de ese reto
//
//   estado: { respuestas: [id], fin, ... } (ver comun.js)

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { hoy, azarDelDia } from "../comun/fichas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin } from "./comun.js";

const PAUSA = 900; // ms con la respuesta a la vista antes de pasar a la siguiente

// Mezcla una lista con el azar del día
export function mezclar(lista, azar) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function crearTest(config) {
  let caja = null;
  let rondas = [];
  let estado = null;
  let mostrando = null; // la respuesta recién dada, mientras se ve

  const aciertos = () => estado.respuestas.filter((id, i) => rondas[i] && id === rondas[i].buena.id).length;

  function plantillaOpcion(especie, ronda, respuesta) {
    let clase = "";
    if (respuesta != null) {
      if (especie.id === ronda.buena.id) clase = "buena";
      else if (especie.id === respuesta) clase = "mala";
    }
    return `
      <button class="test-opcion ${clase}" data-id="${especie.id}" ${respuesta != null ? "disabled" : ""}>
        ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" data-quitar-si-falla`)}
        <span>${escaparHTML(nombreDe(especie))}</span>
      </button>`;
  }

  function plantillaResumen() {
    return `<ol class="test-resumen">${rondas
      .map((ronda, i) => {
        const bien = estado.respuestas[i] === ronda.buena.id;
        return `
          <li class="${bien ? "bien" : "mal"}">
            ${imagenConRespaldo(urlsRetrato({ id: ronda.buena.id }), `alt="" data-quitar-si-falla`)}
            <span>${escaparHTML(nombreDe(ronda.buena))}</span>
            ${icono(bien ? "visto" : "aspa")}
          </li>`;
      })
      .join("")}</ol>`;
  }

  function pintar() {
    const marcador = rondas.map((ronda, i) => {
      const id = estado.respuestas[i];
      const clase = id == null ? "" : id === ronda.buena.id ? "acierto" : "fallo";
      return `<span class="juego-intento ${clase}"></span>`;
    }).join("");

    let medio;
    if (estado.otroSitio) medio = plantillaFin(estado, t("Ya lo jugaste hoy."));
    else if (estado.fin && !mostrando) {
      medio = plantillaResumen() + plantillaFin(estado, t("{n} de {total} aciertos.", { n: aciertos(), total: rondas.length }));
    } else {
      // La ronda en juego o, un momento, la recién respondida
      const i = mostrando ? mostrando.ronda : estado.respuestas.length;
      const ronda = rondas[i];
      const respuesta = mostrando ? mostrando.id : null;
      medio = `
        <div class="test-cuerpo">
          <div class="test-pregunta">
            <span class="test-ronda">${t("Pregunta {n} de {total}", { n: i + 1, total: rondas.length })}</span>
            ${config.pregunta(ronda, i)}
          </div>
          <div class="test-opciones">${ronda.opciones.map((especie) => plantillaOpcion(especie, ronda, respuesta)).join("")}</div>
        </div>`;
    }

    caja.innerHTML = `
      <header class="juego-cabeza">
        <h2>${config.titulo}</h2>
        <span class="juego-intentos">${marcador}</span>
      </header>
      ${estado.fin && !mostrando ? "" : `<p class="juego-explicacion">${config.explicacion}</p>`}
      ${medio}`;

    for (const boton of caja.querySelectorAll(".test-opcion:not(:disabled)")) {
      boton.addEventListener("click", () => responder(Number(boton.dataset.id)));
    }
    if (!estado.fin && !mostrando && config.alEntrar) config.alEntrar(rondas[estado.respuestas.length], caja);
  }

  async function responder(id) {
    if (estado.fin || mostrando) return;
    const i = estado.respuestas.length;
    estado.respuestas.push(id);
    mostrando = { ronda: i, id };
    const terminado = estado.respuestas.length >= rondas.length;
    let apuntando = null;
    if (terminado) {
      const bien = aciertos();
      estado.intentos = estado.respuestas.slice();
      estado.acierto = bien === rondas.length;
      const cuadros = rondas.map((ronda, k) => (estado.respuestas[k] === ronda.buena.id ? "🟩" : "🟥")).join("");
      estado.resumen = `${config.titulo} ${cuadros} ${bien}/${rondas.length}`;
      apuntando = terminar(config.juego, estado, bien * config.porAcierto);
    } else {
      guardarEstado(config.juego, estado);
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

  return async function montar(contenedor) {
    caja = contenedor;
    mostrando = null;
    caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
    rondas = config.armar(await cargarEspecies(), azarDelDia(`${hoy()}|${config.juego}`));
    estado = estadoDe(config.juego);
    if (!estado.respuestas) estado.respuestas = [];
    pintar();
    if (await mirarSiYaJugado(config.juego, estado).catch(() => false)) pintar();
  };
}
