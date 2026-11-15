// ---------- Pokémon Añil (fangame de PC) ----------
//
// Hecho con Pokémon Essentials 21 (mkxp-z). La partida es «Partida 1.rxdata» (o 2, 3...), en
// %APPDATA%\Pokemon Anil. A diferencia de GS Vitro (./vitro.js, un Essentials antiguo), es UN solo
// objeto de Ruby (./marshal.js): una tabla con :player (el entrenador, con el equipo y las
// medallas), :bag (la mochila), :storage_system (las cajas) y lo demás de la partida. Esto solo lee.
//
// Essentials 21 lo guarda todo por su nombre interno (:FENNEKIN, :SCRATCH, :POKEBALL, :BLAZE,
// :DOCILE...) y el nivel, el género, la habilidad y la naturaleza ya vienen puestos.
// datos/partida-anil.json (sacado de los archivos del juego 4.1.1) pasa esos nombres a los de la web:
//   { especies: { FENNEKIN: 653 }, ataques: { SCRATCH: 10 }, habilidades: { BLAZE: 66 },
//     objetos: { POKEBALL: número en OBJETOS_EN }, lugares: { mapa: "Ruta 1" } }
//     y para editar: filas (lo de cada especie y forma), pp, bolsillos (./escribiranil.js)
// Los ataques y habilidades propios de Añil van con números desde el 30001 (js/comun/propios.js:
// se ven con su nombre y su descripción del juego, pero no se exportan). Royaleon y Cefireon, sus
// dos Pokémon nuevos, no están en la Pokédex de la web: esos no salen.

import { leerTodosMarshal } from "./marshal.js";
import { moteDe } from "./vitro.js";
export { moteDe as moteDeAnil };
import { experienciaPara } from "./convertir.js";
import { cargarDatos } from "../comun/datos.js";

const URL_TABLAS = new URL("../../datos/partida-anil.json", import.meta.url);

export const CAJAS_ANIL = 50;

// Cómo se consiguió (obtain_method): conocido, de huevo, intercambiado, de evento
const DE_HUEVO = 1;
const INTERCAMBIADO = 2;

// Las naturalezas por su número (el de los juegos)
const NATURALEZAS = [
  "HARDY", "LONELY", "BRAVE", "ADAMANT", "NAUGHTY", "BOLD", "DOCILE", "RELAXED", "IMPISH", "LAX", "TIMID", "HASTY",
  "SERIOUS", "JOLLY", "NAIVE", "MODEST", "MILD", "QUIET", "BASHFUL", "RASH", "CALM", "GENTLE", "SASSY", "CAREFUL", "QUIRKY"
];

// Las estadísticas, en el orden de la web (la velocidad al final)
const STATS = ["HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED"];

let tablas = null;

// Hay que llamarla antes de leer (las tablas del juego y los nombres de las especies, para los motes)
export async function prepararAnil() {
  if (tablas) return;
  const [respuesta] = await Promise.all([fetch(URL_TABLAS), cargarDatos()]);
  if (!respuesta.ok) throw new Error("No se han podido cargar los datos de Pokémon Añil.");
  tablas = await respuesta.json();
}

// El archivo es una tabla (Hash) que empieza por :player, un objeto «Player» de Essentials 21
export function esPartidaAnil(bytes) {
  if (bytes.length < 64 || bytes[0] !== 4 || bytes[1] !== 8 || bytes[2] !== 0x7b) return false;
  const inicio = new TextDecoder("latin1").decode(bytes.subarray(3, 40));
  return inicio.includes("player") && inicio.includes("Player");
}

// :FENNEKIN -> "FENNEKIN"; las claves de las tablas llegan como ":HP"
const nombreDe = (valor) => (valor && valor.simbolo) || (typeof valor === "string" ? valor.replace(/^:/, "") : "");

function campo(tabla, nombre) {
  if (!(tabla instanceof Map)) return undefined;
  for (const [clave, valor] of tabla) if (nombreDe(clave) === nombre) return valor;
  return undefined;
}

function stats(tabla) {
  if (!(tabla instanceof Map)) return null;
  return STATS.map((stat) => Number(campo(tabla, stat)) || 0);
}

export function nivelPorExperiencia(ritmo, experiencia) {
  let nivel = 1;
  while (nivel < 100 && experienciaPara(ritmo, nivel + 1) <= experiencia) nivel++;
  return nivel;
}

function fechaDe(valor) {
  if (typeof valor === "number" && valor > 0) return new Date(valor * 1000).toISOString();
  return "";
}

// Lo de su especie y forma (datos/partida-anil.json: filas)
export function filaAnil(simbolo, forma) {
  return (forma && tablas.filas[`${simbolo}_${forma}`]) || tablas.filas[simbolo] || { h: [], o: [], g: 128, r: 2, f: 70, b: [1, 1, 1, 1, 1, 1], c: 20 };
}

// Lo que Essentials saca del PID si no está guardado (como Pokemon#gender, #shiny?, #nature y #ability_id)
export function generoAnil(guardado, pid, fila) {
  const g = guardado ?? (fila.g === 255 ? 2 : fila.g === 254 ? 1 : fila.g === 0 ? 0 : (pid & 0xff) < fila.g ? 1 : 0);
  return g === 0 ? "M" : g === 1 ? "F" : "";
}

export function shinyAnil(guardado, pid, idDueno) {
  if (guardado !== null && guardado !== undefined) return Boolean(guardado);
  const a = (pid ^ idDueno) >>> 0;
  return ((a & 0xffff) ^ (a >>> 16)) < PROBABILIDAD_SHINY;
}

export function naturalezaAnil(guardada, pid) {
  const i = NATURALEZAS.indexOf(guardada || "");
  return i >= 0 ? i : (pid >>> 0) % 25;
}

export function huecoHabilidadAnil(guardado, pid) {
  return guardado ?? (pid & 1);
}

export function habilidadPorHueco(fila, hueco, pid) {
  if (hueco >= 2) {
    const oculta = fila.o[hueco - 2];
    if (oculta) return oculta;
    hueco = pid & 1;
  }
  return fila.h[hueco] || fila.h[0] || 0;
}

const PROBABILIDAD_SHINY = 65; // SHINY_POKEMON_CHANCE de sus ajustes (de 65536)
export { NATURALEZAS as NATURALEZAS_ANIL };

function pokemonAnil(o, enEquipo) {
  if (!o || o.clase !== "Pokemon") return null;
  const simbolo = nombreDe(o["@species"]);
  const especie = tablas.especies[simbolo] || 0;
  if (!especie) return null;
  const huevo = (o["@steps_to_hatch"] || 0) > 0;
  const modo = o["@obtain_method"];
  const dueno = o["@owner"] || {};
  const pid = (o["@personalID"] || 0) >>> 0;
  const fila = filaAnil(simbolo, o["@form"] || 0);
  const hueco = huecoHabilidadAnil(o["@ability_index"], pid);

  const p = {
    especie,
    forma: o["@form"] || 0,
    mote: huevo ? "" : moteDe(o["@name"], especie),
    genero: generoAnil(o["@gender"], pid, fila),
    shiny: shinyAnil(o["@shiny"], pid, (dueno["@id"] || 0) >>> 0) || Boolean(o["@super_shiny"]),
    objeto: tablas.objetos[nombreDe(o["@item"])] || 0,
    habilidad: tablas.habilidades[nombreDe(o["@ability"])] || habilidadPorHueco(fila, hueco, pid),
    naturaleza: naturalezaAnil(nombreDe(o["@nature"]), pid),
    experiencia: o["@exp"] || 0,
    nivel: o["@level"] || nivelPorExperiencia(fila.r, o["@exp"] || 0),
    ataques: (o["@moves"] || []).map((m) => (m && tablas.ataques[nombreDe(m["@id"])]) || 0).filter(Boolean),
    ivs: stats(o["@iv"]),
    evs: stats(o["@ev"]),
    // Los de huevo no cuentan para «Rutas» (convertir.js mira lugarHuevo); los intercambiados, tampoco
    lugar: modo === INTERCAMBIADO ? 0 : o["@obtain_map"] || 0,
    lugarHuevo: modo === DE_HUEVO ? 1 : 0,
    nivelCaptura: o["@obtain_level"] || 0,
    fechaCaptura: fechaDe(o["@timeReceived"]),
    entrenador: dueno["@name"] || "",
    idEntrenador: (dueno["@id"] || 0) >>> 0,
    llave: (o["@personalID"] || 0) >>> 0
  };
  if (huevo) p.huevo = true;
  if (enEquipo) {
    p.ps = o["@hp"] || 0;
    p.psMax = o["@totalhp"] || 0;
  }
  return p;
}

// Necesita prepararAnil() antes
export function leerPartidaAnil(bytes) {
  if (!tablas) throw new Error("Faltan los datos de Pokémon Añil (prepararAnil).");
  const todo = leerTodosMarshal(bytes)[0];
  const entrenador = campo(todo, "player");
  if (!entrenador || entrenador.clase !== "Player") throw new Error("No parece una partida de Pokémon Añil.");
  const almacen = campo(todo, "storage_system");

  const equipo = (entrenador["@party"] || []).map((o) => pokemonAnil(o, true)).filter(Boolean);
  const cajas = ((almacen && almacen["@boxes"]) || []).map((caja, c) => ({
    nombre: (caja && caja["@name"]) || `Caja ${c + 1}`,
    pokemon: ((caja && caja["@pokemon"]) || []).flatMap((o, hueco) => {
      const p = pokemonAnil(o, false);
      return p ? [{ ...p, hueco }] : [];
    })
  }));

  return {
    juego: "anil",
    version: "",
    gen: 0,
    entrenador: entrenador["@name"] || "",
    medallas: Array.from({ length: 8 }, (_, i) => Boolean((entrenador["@badges"] || [])[i])),
    abiertas: cajas.length,
    equipo,
    cajas
  };
}

// El lugar de la web («Ruta 1») del mapa del juego donde se conoció, o ""
export function lugarAnil(mapa) {
  return (tablas && tablas.lugares[mapa]) || "";
}

// Las tablas de datos/partida-anil.json (null hasta prepararAnil), para ./escribiranil.js
export function tablasAnil() {
  return tablas;
}

const URL_APRENDE = new URL("../../datos/partida-anil-aprende.json", import.meta.url);
let aprende = null;

// Los ataques que aprende por nivel en Añil: [{ id (de la web), nivel }]
export async function aprendeAnil(especie) {
  if (!aprende) {
    const respuesta = await fetch(URL_APRENDE);
    aprende = respuesta.ok ? await respuesta.json() : {};
  }
  const lista = aprende[especie] || [];
  const salida = [];
  for (let i = 0; i < lista.length; i += 2) salida.push({ nivel: lista[i], id: lista[i + 1] });
  return salida;
}
