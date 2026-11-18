// ---------- Elegir en qué juego es un locke ----------
//
// Un desplegable con los juegos que tienen Rutas y Level caps en la web (agrupados por
// región, igual que en esas secciones) y, al final, «Otro (fan game)», que abre una casilla
// de texto para escribirlo a mano.
//
// Se guarda así:
//   { juego: "frlg", juegoOtro: "" }                  un juego de la web
//   { juego: "", juegoOtro: "Pokémon Añil Fusión" }   otro escrito a mano
//   { juego: "", juegoOtro: "" }                      sin decir
//
// Los lockes de antes pueden ser de un «juego propio» (juego: "propio-...", con su copia en
// juegoPropio). Ya no se pueden elegir, pero se respetan: salen con su nombre y, al editar
// el locke, se pueden dejar como estaban.

import { REGIONES, JUEGOS } from "./juegos.js";
import { escaparHTML } from "./utilidades.js";
import { t } from "./idioma.js";

const OTRO = "__otro";

export function juegoRegistrado(id) {
  return JUEGOS.find((juego) => juego.id === id) || null;
}

// Si tiene Rutas y Level caps en la web
export function juegoConDatos(datos) {
  return Boolean(datos && juegoRegistrado(datos.juego));
}

// Nombre para enseñar, o "" si no se dijo
export function nombreJuego(datos) {
  if (!datos) return "";
  const registrado = juegoRegistrado(datos.juego);
  if (registrado) return `Pokémon ${registrado.nombre}`.replace("Pokémon Pokémon", "Pokémon");
  if (datos.juegoPropio) return datos.juegoPropio.nombre;
  return datos.juegoOtro || "";
}

// Solo la versión que se juega («Pokémon Espada», no «Pokémon Espada / Escudo») si se sabe: la que
// apunta la partida vinculada de alguno de sus jugadores en el locke (locke.medallas[uid].version).
// Primero la de «preferido» (tú) y, si no la tiene, la de cualquier otro. Si no, el nombre entero.
export function nombreJuegoJugado(locke, preferido = "") {
  const completo = nombreJuego(locke);
  const medallas = (locke && locke.medallas) || {};
  const versiones = [preferido && medallas[preferido], ...Object.values(medallas)]
    .map((cada) => cada && cada.version)
    .filter((version) => typeof version === "string" && version);
  const version = versiones.find((cada) => completo.includes(cada));
  return version ? `Pokémon ${version}` : completo;
}

function opcion(id, nombre, elegido) {
  return `<option value="${escaparHTML(id)}" ${id === elegido ? "selected" : ""}>${escaparHTML(nombre)}</option>`;
}

// HTML del desplegable y la casilla de «otro». «clase» distingue un campo de otro cuando
// hay varios en la misma ventana (una fila por locke).
export function plantillaCampoJuego(datos = {}, clase = "") {
  // Un juego que ya no está en la lista (un juego propio de antes) sale como «Otro» con su nombre
  const conocido = juegoRegistrado(datos.juego) || (datos.juegoPropio && datos.juegoPropio.id === datos.juego);
  const elegido = conocido ? datos.juego : datos.juegoOtro ? OTRO : "";

  const grupos = REGIONES.filter((region) => JUEGOS.some((juego) => juego.region === region.id))
    .map(
      (region) => `
        <optgroup label="${escaparHTML(region.nombre)}">
          ${JUEGOS.filter((juego) => juego.region === region.id).map((juego) => opcion(juego.id, juego.nombre, elegido)).join("")}
        </optgroup>`
    )
    .join("");

  const antiguo = datos.juegoPropio && datos.juegoPropio.id === datos.juego ? opcion(datos.juego, datos.juegoPropio.nombre, elegido) : "";

  return `
    <span class="campo-juego ${clase}">
      <select class="juego-select">
        <option value="" ${elegido ? "" : "selected"}>${t("Sin decir")}</option>
        ${grupos}
        ${antiguo}
        <option value="${OTRO}" ${elegido === OTRO ? "selected" : ""}>${t("Otro (fan game...)")}</option>
      </select>
      <input class="juego-otro" type="text" placeholder="${t("¿Qué juego?")}"
        value="${escaparHTML(datos.juegoOtro || "")}" ${elegido === OTRO ? "" : "hidden"}>
    </span>`;
}

// La casilla de texto solo se ve con «Otro». Un oyente en el contenedor sirve para todos
// los campos de juego que tenga dentro, aunque se vuelvan a pintar.
export function activarCamposJuego(contenedor) {
  contenedor.addEventListener("change", (e) => {
    const select = e.target.closest(".juego-select");
    if (!select) return;
    const otro = select.parentElement.querySelector(".juego-otro");
    otro.hidden = select.value !== OTRO;
    if (!otro.hidden) otro.focus();
  });
}

export function leerCampoJuego(campo) {
  const valor = campo.querySelector(".juego-select").value;
  if (valor === OTRO) return { juego: "", juegoOtro: campo.querySelector(".juego-otro").value.trim() };
  return { juego: valor, juegoOtro: "" };
}
