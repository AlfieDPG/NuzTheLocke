// Pestaña «Eventos» de la ventana «Partida» (js/versus/partida.js): lo que no son Pokémon ni objetos, como
// en PKHeX (dinero, PB, fichas, Pokédex Nacional, Pokédex completa...). Cada juego, su lista
// (js/partida/eventos.js). Como la bolsa, va a la copia en memoria de la partida y se guarda al cerrar la ventana.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { campoNumero } from "../comun/numero.js";
import { avisar } from "../comun/ventanas.js";
import { t, LOCALE } from "../comun/idioma.js";
import { formatoDeSeguro } from "../partida/formato.js";
import { leerEventos, aplicarEvento } from "../partida/eventos.js";
import { cargarDatosEditor } from "../partida/datos-editor.js";
import { prepararDatos, partidaDeTrabajo, cambiarPartida } from "./editor-comun.js";

const GRUPOS = [
  ["entrenador", t("Entrenador"), "persona"],
  ["pokedex", t("Pokédex"), "pokedex"]
];

const numero = (n) => Number(n).toLocaleString(LOCALE);

function control(e) {
  if (e.tipo === "numero") {
    return campoNumero(`<input class="eventos-numero" type="number" min="0" max="${e.maximo}" value="${e.valor}" aria-label="${escaparHTML(t(e.nombre))}">`);
  }
  if (e.tipo === "pokedex") {
    const llena = e.valor >= e.total;
    return `
      <span class="eventos-cuenta">${t("{n} de {total} capturados", { n: numero(e.valor), total: numero(e.total) })}</span>
      <button class="eventos-completar" ${llena ? "disabled" : ""}>${icono(llena ? "visto" : "pokedex")} ${llena ? t("Completa") : t("Completarla")}</button>`;
  }
  // Casilla
  return `
    <label class="eventos-interruptor">
      <input class="eventos-casilla" type="checkbox" ${e.valor ? "checked" : ""}>
      <span>${e.valor ? t("Sí") : t("No")}</span>
    </label>`;
}

function fila(e) {
  return `
    <div class="eventos-fila" data-evento="${e.id}">
      <div class="eventos-texto">
        <strong>${escaparHTML(t(e.nombre))}</strong>
        ${e.ayuda ? `<small>${escaparHTML(t(e.ayuda))}</small>` : ""}
      </div>
      <div class="eventos-control">${control(e)}</div>
    </div>`;
}

export async function pintarEventos(contenedor, idLocke) {
  await prepararDatos();
  const bytes = await partidaDeTrabajo(idLocke);
  const juego = formatoDeSeguro(bytes).id;
  const eventos = leerEventos(bytes);
  if (!eventos.length) {
    contenedor.innerHTML = `<p class="bolsa-vacio">${t("En este juego todavía no hay eventos que cambiar.")}</p>`;
    return;
  }
  contenedor.innerHTML = `
    <div class="eventos" data-juego="${juego}">
      <p class="eventos-aviso">${icono("aviso")} ${t("Como lo demás, se guarda al cerrar la ventana, con el juego cerrado. La partida de antes queda en «Copias».")}</p>
      ${GRUPOS.filter(([id]) => eventos.some((e) => e.grupo === id))
        .map(([id, nombre, dibujo]) => `
          <section class="eventos-grupo">
            <h3>${icono(dibujo)} ${nombre}</h3>
            <div class="eventos-lista">${eventos.filter((e) => e.grupo === id).map(fila).join("")}</div>
          </section>`)
        .join("")}
    </div>`;
}

const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Cambia un evento en la copia en memoria (con lo que sale en la actividad)
async function cambiar(contenedor, idLocke, id, valor) {
  const bytes = await partidaDeTrabajo(idLocke);
  const evento = leerEventos(bytes).find((e) => e.id === id);
  if (!evento) return;
  const nombre = t(evento.nombre);
  const generos = evento.tipo === "pokedex"
    ? Object.fromEntries(Object.entries((await cargarDatosEditor()).especies).map(([e, datos]) => [e, datos[0]]))
    : {};
  const detalle = evento.tipo === "pokedex"
    ? t("Pokédex completa")
    : evento.tipo === "numero"
      ? `${nombre}: ${numero(Math.min(evento.maximo, Math.max(0, Math.floor(Number(valor) || 0))))}`
      : `${nombre}: ${valor ? t("sí") : t("no")}`;
  try {
    await cambiarPartida(idLocke, (original) => {
      const nuevo = aplicarEvento(original, id, valor, generos);
      if (iguales(nuevo, original)) throw new Error(""); // nada que cambiar
      return { nuevo };
    }, detalle);
  } catch (error) {
    if (!error.message) return;
    console.error(error);
    avisar(t(error.message || "No se ha podido cambiar."));
    pintarEventos(contenedor, idLocke).catch((otro) => console.error(otro));
  }
}

export function activarEventos(contenedor, idDe) {
  contenedor.addEventListener("click", (e) => {
    if (!contenedor.querySelector(".eventos")) return;
    const boton = e.target.closest(".eventos-completar");
    if (boton) {
      boton.disabled = true;
      cambiar(contenedor, idDe(), boton.closest(".eventos-fila").dataset.evento, true);
    }
  });
  contenedor.addEventListener("change", (e) => {
    if (!contenedor.querySelector(".eventos")) return;
    const filaEvento = e.target.closest(".eventos-fila");
    if (!filaEvento) return;
    if (e.target.matches(".eventos-numero")) cambiar(contenedor, idDe(), filaEvento.dataset.evento, e.target.value);
    else if (e.target.matches(".eventos-casilla")) cambiar(contenedor, idDe(), filaEvento.dataset.evento, e.target.checked);
  });
}
