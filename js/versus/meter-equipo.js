// «Meter equipo» de la ventana «Partida» (js/versus/partida.js): un equipo de «Mis equipos» o
// un paste de Showdown, metido en la partida como Pokémon del entrenador. A las cajas (a los
// primeros huecos libres) o al equipo, y entonces el de ahora pasa a las cajas.
//
// Lo que no existe en el juego (objetos, ataques o formas de después) se queda fuera, y se
// avisa antes de meterlo. Se apunta en la actividad del locke, como el resto de ediciones.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { carasDeEquipo, elegirEquipo } from "../comun/elegir-equipo.js";
import { poner, huecoLibre, llaveDe } from "../partida/huecos.js";
import { formatoDeSeguro } from "../partida/formato.js";
import { prepararDatos, nombreEspecie, nombreHuevo, editableDeEquipo, cambiarHuecos, partidaDeTrabajo } from "./editor-comun.js";
import { confirmar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";

let dialogo = null;
let idLocke = null;
let elegido = null; // el equipo de «Mis equipos», si se ha elegido uno

function pintarElegido() {
  const sitio = dialogo.querySelector(".meter-elegido");
  sitio.innerHTML = elegido
    ? `<div class="meter-equipo">
         ${carasDeEquipo(elegido)}
         <strong>${escaparHTML(elegido.nombre || t("Equipo"))}</strong>
         <button type="button" class="meter-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
       </div>`
    : "";
  dialogo.querySelector(".meter-paste").hidden = Boolean(elegido);
}

export function abrirMeter(id) {
  idLocke = id;
  elegido = null;
  dialogo.querySelector(".meter-paste").value = "";
  dialogo.querySelector(".meter-error").textContent = "";
  pintarElegido();
  dialogo.showModal();
}

// Los Pokémon que se van a meter: { nombre, pokemon, problemas }
async function leerEquipo() {
  if (elegido) return { nombre: elegido.nombre, pokemon: elegido.pokemon.filter(Boolean), problemas: [] };
  const texto = dialogo.querySelector(".meter-paste").value.trim();
  if (!texto) throw new Error(t("Pega un equipo o elige uno de «Mis equipos»."));
  const { pokemonDePaste } = await import("../equipos/importar.js");
  const leido = await pokemonDePaste(texto);
  if (!leido.pokemon.length) throw new Error(t("No se ha reconocido ningún Pokémon."));
  return leido;
}

async function meter() {
  await prepararDatos();
  const juego = formatoDeSeguro(await partidaDeTrabajo(idLocke)).id;
  const equipo = await leerEquipo();
  const problemas = [...equipo.problemas];
  const listos = [];
  for (const p of equipo.pokemon) {
    try {
      const convertido = await editableDeEquipo(p, juego);
      problemas.push(...convertido.problemas);
      listos.push(convertido);
    } catch (fallo) {
      problemas.push(fallo.message);
    }
  }
  if (!listos.length) throw new Error(problemas.join(" ") || t("No hay nada que meter."));
  if (problemas.length && !(await confirmar(`${t("Algunas cosas no van en este juego:")}\n\n• ${problemas.join("\n• ")}\n\n${t("¿Meterlo igual?")}`, { aceptar: t("Meterlo igual") }))) return;

  const alEquipo = dialogo.querySelector('input[name="meter-destino"]:checked').value === "equipo";
  // En la actividad, sin especies ni motes (los demás no tienen por qué saber cuáles)
  const nombres = `${listos.length} Pokémon`;
  const cual = equipo.nombre ? ` (${t("equipo «{nombre}»", { nombre: equipo.nombre })})` : "";
  await cambiarHuecos(idLocke, (h) => {
    const entrenador = h.formato.entrenadorDe(h.bytes);
    const crudos = listos.map(({ editable, base, generoRatio }) =>
      h.formato.pokemon.crearPokemon(entrenador, editable, {
        base, generoRatio, nombreEspecie: nombreEspecie(editable.especie, entrenador.idioma), nombreHuevo: nombreHuevo(entrenador.idioma)
      })
    );
    const aLasCajas = (crudo) => {
      const libre = huecoLibre(h);
      if (!libre) throw new Error(t("No cabe en las cajas."));
      poner(h, libre, crudo);
    };
    if (alEquipo) {
      // El de ahora, a las cajas; los nuevos, al equipo (lo que no quepa, a las cajas)
      while (h.equipo.length) {
        aLasCajas(h.equipo[0]);
        poner(h, { equipo: 0 }, null);
      }
      crudos.forEach((crudo, i) => (i < 6 ? poner(h, { equipo: i }, crudo) : aLasCajas(crudo)));
    } else crudos.forEach(aLasCajas);
    const llaves = crudos.map(llaveDe);
    return { metidos: llaves, creados: llaves };
  }, `${alEquipo ? t("metidos al equipo") : t("metidos en las cajas")}${cual}: ${nombres}`);

  dialogo.close();
}

export function iniciarMeter() {
  dialogo = document.querySelector("#dialogo-meter");
  const ok = dialogo.querySelector(".meter-ok");
  const error = dialogo.querySelector(".meter-error");

  dialogo.querySelector(".meter-cancelar").addEventListener("click", () => dialogo.close());
  dialogo.querySelector(".meter-mis-equipos").addEventListener("click", async (e) => {
    const equipo = await elegirEquipo(e.currentTarget, { completo: true });
    if (!equipo) return;
    elegido = equipo;
    pintarElegido();
  });
  dialogo.querySelector(".meter-elegido").addEventListener("click", (e) => {
    if (!e.target.closest(".meter-quitar")) return;
    elegido = null;
    pintarElegido();
    dialogo.querySelector(".meter-paste").focus();
  });

  ok.addEventListener("click", () => {
    ok.disabled = true;
    ok.textContent = t("Metiendo...");
    error.textContent = "";
    meter()
      .catch((fallo) => {
        console.error(fallo);
        error.textContent = fallo && fallo.name === "AbortError" ? "" : t(fallo.message || "No se ha podido meter.");
      })
      .finally(() => {
        ok.disabled = false;
        ok.textContent = t("Meter");
      });
  });
}
