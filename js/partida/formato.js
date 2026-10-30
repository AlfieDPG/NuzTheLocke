// ---------- 3DS, DS o Switch: las mismas funciones para todas ----------
//
// El editor (js/versus/editor*.js, partida.js, bolsa.js...) no sabe de qué consola es la
// partida: pide aquí las piezas con formatoDe(bytes) y usa siempre los mismos nombres.
//
//   { id, gen, cajas, cajasAbiertas, leer, sePuedeEditar, leerHueco, huecoVacio, editarHuecos,
//     cuantosEquipo, entrenadorDe, pokemon: { leerEditable, aplicarEditable, crearPokemon, conLlaveNueva,
//     paraEquipo, paraCaja, esHuevo, especieDe, formaDe, lugarIntercambio, maxMote,
//     maxEntrenador }, mochila: { bolsillosDe, leerMochila, escribirMochila } }

import { JUEGOS, leerPartida3DS, posicionCuantos, entrenadorDe, cajasAbiertas } from "./tresds.js";
import { JUEGOS_EDITABLES, sePuedeEditar, leerHueco, huecoVacio, editarHuecos } from "./escribir3ds.js";
import * as pk3ds from "./pokemon3ds.js";
import { bolsillosDe, leerMochila, escribirMochila } from "./mochila3ds.js";
import { mapaDS, leerPartidaDS, entrenadorDS } from "./nds.js";
import { esPartidaGBA, leerPartidaGBA, CAJAS_GBA } from "./gba.js";
import { JUEGOS_EDITABLES_DS, sePuedeEditarDS, leerHuecoDS, huecoVacioDS, editarHuecosDS, cuantosEquipoDS } from "./escribirds.js";
import { pokemonDS } from "./pokemonds.js";
import { bolsillosDS, leerMochilaDS, escribirMochilaDS } from "./mochilads.js";
import { abrirSwSh, leerPartidaSwSh, entrenadorSwSh, cajasAbiertasSwSh, CAJAS as CAJAS_SWSH } from "./switch.js";
import {
  JUEGOS_EDITABLES_SWITCH, sePuedeEditarSwitch, leerHuecoSwitch, huecoVacioSwitch, editarHuecosSwitch, cuantosEquipoSwitch
} from "./escribirswitch.js";
import { pokemonGen8, LUGARES_SWSH, LUGARES_BDSP } from "./pokemonswitch.js";
import { bolsillosSwitch, leerMochilaSwitch, escribirMochilaSwitch } from "./mochilaswitch.js";
import {
  CAJAS_BDSP, esPartidaBDSP, leerPartidaBDSP, entrenadorBDSP, cajasAbiertasBDSP, sePuedeEditarBDSP, leerHuecoBDSP, huecoVacioBDSP,
  editarHuecosBDSP, cuantosEquipoBDSP, bolsillosBDSP, leerMochilaBDSP, escribirMochilaBDSP
} from "./bdsp.js";

// Los juegos en los que se puede editar la partida (ids de js/comun/juegos.js)
export const EDITABLES = [...JUEGOS_EDITABLES, ...JUEGOS_EDITABLES_DS, ...JUEGOS_EDITABLES_SWITCH, "bdsp"];

export const CARAMELO_RARO = 50;

const POKEMON_3DS = {
  ...pk3ds,
  especieDe: (crudo) => crudo[0x08] | (crudo[0x09] << 8),
  formaDe: (crudo) => crudo[0x1d] >> 3,
  lugarIntercambio: 30001,
  maxMote: 12,
  maxEntrenador: 12
};

// Espada / Escudo y Perla Reluciente guardan igual a los Pokémon (salvo dos lugares especiales)
const POKEMON_SWSH = { ...pokemonGen8(LUGARES_SWSH), lugarIntercambio: 30001, maxMote: 12, maxEntrenador: 12 };
const POKEMON_BDSP = { ...pokemonGen8(LUGARES_BDSP), lugarIntercambio: 30001, maxMote: 12, maxEntrenador: 12 };

const deDS = new Map(); // id -> pokemonDS(juego), ya montado

export function formatoDe(bytes) {
  const tres = JUEGOS[bytes.length];
  if (tres) {
    return {
      id: tres.id,
      gen: tres.gen,
      cajas: tres.cajas,
      cajasAbiertas,
      leer: leerPartida3DS,
      sePuedeEditar,
      leerHueco,
      huecoVacio: (b, sitio) => huecoVacio(sitio),
      editarHuecos,
      cuantosEquipo: (b) => Math.min(6, b[posicionCuantos(b)]),
      entrenadorDe,
      pokemon: POKEMON_3DS,
      mochila: { bolsillosDe, leerMochila, escribirMochila }
    };
  }
  if (abrirSwSh(bytes)) {
    return {
      id: "swsh",
      gen: 8,
      cajas: CAJAS_SWSH,
      cajasAbiertas: cajasAbiertasSwSh,
      leer: leerPartidaSwSh,
      sePuedeEditar: sePuedeEditarSwitch,
      leerHueco: leerHuecoSwitch,
      huecoVacio: huecoVacioSwitch,
      editarHuecos: editarHuecosSwitch,
      cuantosEquipo: cuantosEquipoSwitch,
      entrenadorDe: entrenadorSwSh,
      pokemon: POKEMON_SWSH,
      mochila: { bolsillosDe: bolsillosSwitch, leerMochila: leerMochilaSwitch, escribirMochila: escribirMochilaSwitch }
    };
  }
  if (esPartidaBDSP(bytes)) {
    return {
      id: "bdsp",
      gen: 8,
      cajas: CAJAS_BDSP,
      cajasAbiertas: cajasAbiertasBDSP,
      leer: leerPartidaBDSP,
      sePuedeEditar: sePuedeEditarBDSP,
      leerHueco: leerHuecoBDSP,
      huecoVacio: huecoVacioBDSP,
      editarHuecos: editarHuecosBDSP,
      cuantosEquipo: cuantosEquipoBDSP,
      entrenadorDe: entrenadorBDSP,
      pokemon: POKEMON_BDSP,
      mochila: { bolsillosDe: bolsillosBDSP, leerMochila: leerMochilaBDSP, escribirMochila: escribirMochilaBDSP }
    };
  }
  // GBA: solo leer (la ventana «Partida» exporta las cajas desde aquí)
  if (esPartidaGBA(bytes)) {
    return { id: "frlg", gen: 3, cajas: CAJAS_GBA, cajasAbiertas: () => CAJAS_GBA, leer: leerPartidaGBA, sePuedeEditar: () => false };
  }
  const mapa = mapaDS(bytes);
  if (!mapa) return null;
  if (!deDS.has(mapa.id)) deDS.set(mapa.id, pokemonDS({ id: mapa.id, gen: mapa.gen }));
  return {
    id: mapa.id,
    gen: mapa.gen,
    cajas: mapa.numCajas,
    cajasAbiertas: () => mapa.numCajas,
    leer: leerPartidaDS,
    sePuedeEditar: sePuedeEditarDS,
    leerHueco: leerHuecoDS,
    huecoVacio: huecoVacioDS,
    editarHuecos: editarHuecosDS,
    cuantosEquipo: cuantosEquipoDS,
    entrenadorDe: entrenadorDS,
    pokemon: deDS.get(mapa.id),
    mochila: { bolsillosDe: bolsillosDS, leerMochila: leerMochilaDS, escribirMochila: escribirMochilaDS }
  };
}

// Como formatoDe, pero con error si no es una partida que se sepa leer
export function formatoDeSeguro(bytes) {
  const formato = formatoDe(bytes);
  if (!formato) throw new Error("Ese archivo no es una partida que se sepa leer.");
  return formato;
}
