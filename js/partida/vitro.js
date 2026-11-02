// ---------- Pokémon GS Vitro (fangame de PC) ----------
//
// Hecho con RPG Maker XP y Pokémon Essentials. La partida es «Game.rxdata», en la carpeta
// «Partidas guardadas» de Windows (C:\Users\<tú>\Saved Games\Pokemon GS Vitro). Son objetos de
// Ruby uno detrás de otro (./marshal.js), en este orden: el entrenador ($Trainer, con el equipo y
// las medallas), el tiempo, el sistema, las opciones, el mapa, los interruptores, las variables,
// ..., la mochila ($PokemonBag) y las cajas ($PokemonStorage). Esto solo lee; editar, en
// ./escribirvitro.js.
//
// El juego numera los ataques, objetos y habilidades a su manera. datos/partida-vitro.json (sacado
// de los archivos del juego 1.0) los pasa a los de la web, y trae lo de cada especie que hace falta
// para saber su habilidad, su género y su nivel, más el lugar de la web de cada mapa:
//   { ataques: [id web], habilidades: [id web], objetos: [número en OBJETOS_EN],
//     especies: [[hab. 1, hab. 2, ocultas x4, byte de género, ritmo de crecimiento]] (posición = número - 1),
//     lugares: { mapa: "Ruta 29" },
//     y para editar: pp (de cada ataque del juego), bolsillos (de cada objeto), balls (las del editor) }
// Las especies llevan además la felicidad de base y las estadísticas base (posiciones 8 a 14).
// Se saca con los scripts de Node de la carpeta de trabajo (ver la memoria del proyecto).
// Las especies sí van con el número de la Pokédex Nacional.

import { leerTodosMarshal } from "./marshal.js";
import { experienciaPara } from "./convertir.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { quitarAcentos } from "../comun/utilidades.js";

const URL_TABLAS = new URL("../../datos/partida-vitro.json", import.meta.url);

// Lo que va en cada posición del archivo
const ENTRENADOR = 0;
const CAJAS = 14;

export const CAJAS_VITRO = 40;
const PROBABILIDAD_SHINY = 16; // SHINYPOKEMONCHANCE de sus ajustes (de 65536)
const SIN_GENERO = 255;
const SOLO_HEMBRA = 254;

// Cómo se consiguió (obtainMode): conocido, de huevo, intercambiado, de evento
const DE_HUEVO = 1;
const INTERCAMBIADO = 2;

let tablas = null;

// Hay que llamarla antes de leer (las tablas del juego y los nombres de las especies, para los motes)
export async function prepararVitro() {
  if (tablas) return;
  const [respuesta] = await Promise.all([fetch(URL_TABLAS), cargarDatos()]);
  if (!respuesta.ok) throw new Error("No se han podido cargar los datos de GS Vitro.");
  tablas = await respuesta.json();
}

// El archivo empieza por el entrenador de Essentials (Marshal 4.8, objeto «PokeBattle_Trainer»)
export function esPartidaVitro(bytes) {
  if (bytes.length < 64 || bytes[0] !== 4 || bytes[1] !== 8 || bytes[2] !== 0x6f) return false;
  return new TextDecoder("latin1").decode(bytes.subarray(3, 40)).includes("PokeBattle_Trainer");
}

// Los Pokémon de Essentials guardan sus PS, ataque, defensa, velocidad, at. esp. y def. esp.;
// la web, la velocidad al final
const ORDEN_STATS = [0, 1, 2, 4, 5, 3];

function generoDe(byte, pid, forzado) {
  if (forzado === 0) return "M";
  if (forzado === 1) return "F";
  if (forzado === 2 || byte === SIN_GENERO || byte === undefined) return "";
  if (byte === SOLO_HEMBRA) return "F";
  if (byte === 0) return "M";
  return (pid & 0xff) < byte ? "F" : "M";
}

// Como Essentials: la del hueco que diga (o la 1.ª / 2.ª según el PID); si no la tiene, la normal
function habilidadDe(lista, pid, forzada) {
  let hueco = forzada !== null && forzada !== undefined ? forzada : pid & 1;
  if (lista[hueco]) return lista[hueco];
  if (hueco >= 2) hueco = pid & 1;
  return (hueco === 1 && lista[1]) || lista[0] || 0;
}

function nivelDe(ritmo, experiencia) {
  let nivel = 1;
  while (nivel < 100 && experienciaPara(ritmo, nivel + 1) <= experiencia) nivel++;
  return nivel;
}

// Sin mote, el juego guarda el nombre de la especie (entonces, "")
export function moteDe(nombre, especie) {
  if (!nombre) return "";
  const suya = datos && datos.pokemon.find((p) => p.id === especie);
  if (!suya) return nombre;
  const igual = (otro) => otro && quitarAcentos(otro).toLowerCase() === quitarAcentos(nombre).toLowerCase();
  return igual(suya.es) || igual(suya.en) ? "" : nombre;
}

function fechaDe(valor) {
  if (typeof valor === "number" && valor > 0) return new Date(valor * 1000).toISOString();
  return "";
}

function pokemonVitro(o, enEquipo) {
  if (!o || o.clase !== "PokeBattle_Pokemon") return null;
  const especie = o["@species"] || 0;
  if (!especie) return null;
  const [h1 = 0, h2 = 0, h3 = 0, h4 = 0, h5 = 0, h6 = 0, byteGenero, ritmo = 2] = tablas.especies[especie - 1] || [];
  const pid = (o["@personalID"] || 0) >>> 0;
  const idEntrenador = (o["@trainerID"] || 0) >>> 0;
  const mezcla = (pid ^ idEntrenador) >>> 0;
  const huevo = (o["@eggsteps"] || 0) > 0;
  const modo = o["@obtainMode"];
  const stats = (lista) => (Array.isArray(lista) && lista.length >= 6 ? ORDEN_STATS.map((i) => Number(lista[i]) || 0) : null);

  const p = {
    especie,
    forma: o["@form"] || 0,
    mote: huevo ? "" : moteDe(o["@name"], especie),
    genero: generoDe(byteGenero, pid, o["@genderflag"]),
    shiny: o["@shinyflag"] !== undefined && o["@shinyflag"] !== null
      ? Boolean(o["@shinyflag"])
      : ((mezcla & 0xffff) ^ (mezcla >>> 16)) < PROBABILIDAD_SHINY,
    objeto: tablas.objetos[o["@item"]] || 0,
    habilidad: habilidadDe([h1, h2, h3, h4, h5, h6], pid, o["@abilityflag"]),
    naturaleza: o["@natureflag"] !== undefined && o["@natureflag"] !== null ? o["@natureflag"] : pid % 25,
    experiencia: o["@exp"] || 0,
    nivel: nivelDe(ritmo, o["@exp"] || 0),
    ataques: (o["@moves"] || []).map((m) => (m && tablas.ataques[m["@id"]]) || 0).filter(Boolean),
    ivs: stats(o["@iv"]),
    evs: stats(o["@ev"]),
    // Los de huevo no cuentan para «Rutas» (convertir.js mira lugarHuevo); los intercambiados, tampoco
    lugar: modo === INTERCAMBIADO ? 0 : o["@obtainMap"] || 0,
    lugarHuevo: modo === DE_HUEVO ? 1 : 0,
    nivelCaptura: o["@obtainLevel"] || 0,
    fechaCaptura: fechaDe(o["@timeReceived"]),
    entrenador: o["@ot"] || "",
    idEntrenador,
    llave: pid
  };
  if (huevo) p.huevo = true;
  if (enEquipo) {
    p.ps = o["@hp"] || 0;
    p.psMax = o["@totalhp"] || 0;
  }
  return p;
}

function abrir(bytes) {
  const partes = leerTodosMarshal(bytes);
  const entrenador = partes[ENTRENADOR];
  if (!entrenador || entrenador.clase !== "PokeBattle_Trainer") throw new Error("No parece una partida de GS Vitro.");
  return partes;
}

// Necesita prepararVitro() antes
export function leerPartidaVitro(bytes) {
  if (!tablas) throw new Error("Faltan los datos de GS Vitro (prepararVitro).");
  const partes = abrir(bytes);
  const entrenador = partes[ENTRENADOR];
  const almacen = partes[CAJAS];

  const equipo = (entrenador["@party"] || []).map((o) => pokemonVitro(o, true)).filter(Boolean);
  const cajas = ((almacen && almacen["@boxes"]) || []).map((caja, c) => ({
    nombre: (caja && caja["@name"]) || `Caja ${c + 1}`,
    pokemon: ((caja && caja["@pokemon"]) || []).flatMap((o, hueco) => {
      const p = pokemonVitro(o, false);
      return p ? [{ ...p, hueco }] : [];
    })
  }));

  return {
    juego: "vitro",
    version: "",
    gen: 0,
    entrenador: entrenador["@name"] || "",
    medallas: Array.from({ length: 8 }, (_, i) => Boolean((entrenador["@badges"] || [])[i])),
    abiertas: cajas.length,
    equipo,
    cajas
  };
}

// Las tablas de datos/partida-vitro.json (null hasta prepararVitro), para ./escribirvitro.js
export function tablasVitro() {
  return tablas;
}

// El lugar de la web («Ruta 29») del mapa del juego donde se conoció, o ""
export function lugarVitro(mapa) {
  return (tablas && tablas.lugares[mapa]) || "";
}
