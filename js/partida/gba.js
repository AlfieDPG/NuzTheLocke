// ---------- Partidas de GBA (Rojo Fuego / Verde Hoja) ----------
//
// Lee la partida (128 KB, la .sav del emulador) y devuelve lo mismo que leerPartidaDS
// (./nds.js). También lee el equipo de la memoria del juego mientras se juega en la web
// (js/jugar), para enterarse al momento de lo que pasa.
//
// La partida está dos veces (en 0x0 y en 0xE000), cada una en 14 sectores de 4 KB que se
// guardan desordenados: el pie de cada uno (en 0xFF4) dice qué trozo es, su suma, una firma y un
// contador (vale la copia de contador más alto). Trozo 0: el entrenador; 1-4: el equipo, la
// bolsa, las medallas...; 5-13: las cajas. De cada sector solo valen los primeros 0xF80 bytes.
//
// Cada Pokémon ocupa 80 bytes (100 en el equipo, con nivel y PS): la cabecera (PID, ID del
// entrenador, mote...) y 48 bytes en cuatro trozos de 12, barajados según el PID % 24 y
// cifrados con PID ^ ID (de 4 en 4 bytes).
// Comprobado contra PKHeX; sin partidas reales a mano (falta probarlo con una).

import { cargarDatos, datos } from "../comun/datos.js";
import { quitarAcentos } from "../comun/utilidades.js";
import { cargarDatosEditor } from "./datos-editor.js";
import { VERSIONES } from "./nds.js";
import { LETRAS_GEN3, ESPECIES_GEN3, OBJETOS_GEN3 } from "./datos-gba.js";

const SECTOR = 0x1000;
const USADO = 0xf80;
const SECTORES = 14;
const FIRMA = 0x08012025;
const COPIAS = [0, SECTORES * SECTOR];

export const TAM_POKEMON_GBA = 80;
export const TAM_EQUIPO_GBA = 100;
export const CAJAS_GBA = 14;
const POR_CAJA = 30;

// Dentro de cada trozo (Rojo Fuego / Verde Hoja)
const JUEGO_FRLG = 0xac; // en el del entrenador: 1 en Rojo Fuego / Verde Hoja
const CUANTOS = 0x34; // en el grande: cuántos hay en el equipo
const EQUIPO = 0x38;
const MEDALLAS = 0xee0 + (0x820 >> 3); // las banderas de las medallas (0x820-0x827)
const NOMBRES_CAJAS = 4 + CAJAS_GBA * POR_CAJA * TAM_POKEMON_GBA; // en el de las cajas, detrás de los Pokémon

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

// ---------- Lo que hace falta tener cargado ----------

let tablas = null; // { especies (género), habilidades, nombres (de cada especie, en mayúsculas) }

// Antes de leer: los géneros y habilidades de cada especie (datos/partida-3ds.json) y los nombres
export async function prepararGBA() {
  if (tablas) return;
  const [editor] = await Promise.all([cargarDatosEditor(), cargarDatos()]);
  const nombres = new Map();
  for (const p of datos.pokemon) {
    nombres.set(p.id, new Set([p.es, p.en].filter(Boolean).map((n) => quitarAcentos(n).toUpperCase())));
  }
  tablas = { especies: editor.especies, habilidades: editor.habilidades, nombres };
}

// ---------- Textos ----------

export function textoGen3(b, inicio, maximo) {
  let salida = "";
  for (let i = 0; i < maximo; i++) {
    const c = b[inicio + i];
    if (c === 0xff) break;
    salida += LETRAS_GEN3[c] || "";
  }
  return salida.trim();
}

// ---------- Pokémon ----------

const ORDEN = [
  "GAEM", "GAME", "GEAM", "GEMA", "GMAE", "GMEA", "AGEM", "AGME", "AEGM", "AEMG", "AMGE", "AMEG",
  "EGAM", "EGMA", "EAGM", "EAMG", "EMGA", "EMAG", "MGAE", "MGEA", "MAGE", "MAEG", "MEGA", "MEAG"
];

export function especieNacional(interna) {
  if (interna < 252) return interna;
  return ESPECIES_GEN3[interna - 277] || 0;
}

// gender_rate de PokeAPI (octavos de hembra) -> el límite del juego: hembra si PID & 0xFF es menor
const LIMITE_HEMBRA = { 1: 31, 2: 63, 4: 127, 6: 191 };

function generoDe(especie, pid) {
  const tasa = tablas ? (tablas.especies[especie] || [])[0] : undefined;
  if (tasa === undefined || tasa < 0) return "";
  if (tasa === 0) return "M";
  if (tasa === 8) return "F";
  return (pid & 0xff) < (LIMITE_HEMBRA[tasa] ?? tasa * 32) ? "F" : "M";
}

// La primera o la segunda habilidad de la especie (las de ahora: casi siempre las mismas)
function habilidadDe(especie, segunda) {
  const lista = (tablas && tablas.habilidades[especie]) || [];
  const hueco = (n) => (lista.find(([, h]) => h === n) || [])[0];
  return (segunda && hueco(2)) || hueco(1) || 0;
}

// Los 48 bytes de datos descifrados y en orden (G, A, E, M), o null si la suma no cuadra
function descifrar(b, o) {
  const pid = u32(b, o);
  const llave = (pid ^ u32(b, o + 4)) >>> 0;
  const cifrado = new Uint8Array(48);
  let suma = 0;
  for (let i = 0; i < 48; i += 4) {
    const palabra = (u32(b, o + 32 + i) ^ llave) >>> 0;
    cifrado[i] = palabra & 0xff;
    cifrado[i + 1] = (palabra >>> 8) & 0xff;
    cifrado[i + 2] = (palabra >>> 16) & 0xff;
    cifrado[i + 3] = palabra >>> 24;
    suma += (palabra & 0xffff) + (palabra >>> 16);
  }
  if ((suma & 0xffff) !== u16(b, o + 28)) return null;
  const orden = ORDEN[pid % 24];
  const datos = new Uint8Array(48);
  for (const [destino, trozo] of [..."GAEM"].entries()) {
    const origen = orden.indexOf(trozo) * 12;
    datos.set(cifrado.subarray(origen, origen + 12), destino * 12);
  }
  return datos;
}

// Un Pokémon (en la posición o de b), como los de interpretarDS (./nds.js); null si el hueco
// está vacío o no se puede leer
export function pokemonGBA(b, o, enEquipo) {
  const d = descifrar(b, o);
  if (!d) return null;
  const especie = especieNacional(u16(d, 0));
  if (!especie) return null;

  const pid = u32(b, o);
  const tid = u16(b, o + 4);
  const sid = u16(b, o + 6);
  const ivs = u32(d, 36 + 4);
  const origen = u16(d, 36 + 2);
  const huevo = Boolean((b[o + 19] & 4) || (ivs >>> 30) & 1);
  const mote = textoGen3(b, o + 8, 10);
  // El juego no apunta si tiene mote: lo tiene si no se llama como la especie
  const sinMote = !mote || (tablas && (tablas.nombres.get(especie) || new Set()).has(quitarAcentos(mote).toUpperCase()));
  const nivelCaptura = origen & 0x7f;

  const p = {
    especie,
    forma: 0,
    genero: generoDe(especie, pid),
    mote: huevo || sinMote ? "" : mote,
    huevo,
    shiny: (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8,
    objeto: OBJETOS_GEN3[u16(d, 2)] || 0,
    habilidad: habilidadDe(especie, ivs >>> 31),
    naturaleza: pid % 25,
    experiencia: u32(d, 4),
    ataques: [0, 2, 4, 6].map((i) => u16(d, 12 + i)).filter(Boolean),
    ivs: [0, 5, 10, 20, 25, 15].map((bit) => (ivs >>> bit) & 31), // PS, Ata, Def, AtE, DfE, Vel
    evs: [0, 1, 2, 4, 5, 3].map((i) => d[24 + i]),
    lugar: d[36 + 1],
    lugarHuevo: nivelCaptura ? 0 : 1, // los de huevo se «capturan» a nivel 0 donde nacen
    nivelCaptura,
    fechaCaptura: "", // el juego no la apunta
    ball: (origen >> 11) & 15,
    origen: VERSIONES[(origen >> 7) & 15] || "",
    entrenador: textoGen3(b, o + 20, 7),
    idEntrenador: (tid | (sid << 16)) >>> 0,
    llave: pid
  };
  if (enEquipo) {
    p.nivel = b[o + 84];
    p.ps = u16(b, o + 86);
    p.psMax = u16(b, o + 88);
  }
  return p;
}

// ---------- Partida ----------

function sumaSector(b, inicio) {
  let suma = 0;
  for (let i = 0; i < USADO; i += 4) suma = (suma + u32(b, inicio + i)) >>> 0;
  return ((suma >>> 16) + (suma & 0xffff)) & 0xffff;
}

// Los tres bloques de la copia buena ({ pequeno, grande, cajas, contador }), o null
function bloques(b) {
  let mejor = null;
  for (const copia of COPIAS) {
    if (b.length < copia + SECTORES * SECTOR) continue;
    const trozos = new Array(SECTORES);
    let contador = 0;
    for (let s = 0; s < SECTORES; s++) {
      const inicio = copia + s * SECTOR;
      const id = u16(b, inicio + 0xff4);
      if (u32(b, inicio + 0xff8) !== FIRMA || id >= SECTORES || trozos[id] !== undefined) break;
      if (sumaSector(b, inicio) !== u16(b, inicio + 0xff6)) break;
      trozos[id] = inicio;
      contador = u32(b, inicio + 0xffc);
    }
    if (trozos.includes(undefined)) continue;
    if (mejor && mejor.contador >= contador) continue;
    const juntar = (desde, hasta) => {
      const salida = new Uint8Array((hasta - desde) * USADO);
      for (let id = desde; id < hasta; id++) salida.set(b.subarray(trozos[id], trozos[id] + USADO), (id - desde) * USADO);
      return salida;
    };
    mejor = { pequeno: juntar(0, 1), grande: juntar(1, 5), cajas: juntar(5, SECTORES), contador };
  }
  return mejor;
}

export function esPartidaGBA(bytes) {
  if (bytes.length < SECTORES * SECTOR || bytes.length > 0x20100) return false;
  const partida = bloques(bytes);
  return Boolean(partida && u32(partida.pequeno, JUEGO_FRLG) === 1);
}

// Necesita prepararGBA() antes (sin eso, sin géneros, habilidades ni motes bien puestos)
export function leerPartidaGBA(bytes) {
  const partida = bloques(bytes);
  if (!partida || u32(partida.pequeno, JUEGO_FRLG) !== 1) throw new Error("No parece una partida de Rojo Fuego / Verde Hoja.");
  const { pequeno, grande, cajas: almacen } = partida;

  const equipo = [];
  for (let i = 0; i < Math.min(6, grande[CUANTOS]); i++) {
    const p = pokemonGBA(grande, EQUIPO + i * TAM_EQUIPO_GBA, true);
    if (p) equipo.push(p);
  }

  const cajas = [];
  for (let c = 0; c < CAJAS_GBA; c++) {
    const pokemon = [];
    for (let s = 0; s < POR_CAJA; s++) {
      const p = pokemonGBA(almacen, 4 + (c * POR_CAJA + s) * TAM_POKEMON_GBA, false);
      if (p) pokemon.push({ ...p, hueco: s });
    }
    cajas.push({ nombre: textoGen3(almacen, NOMBRES_CAJAS + c * 9, 9) || `Caja ${c + 1}`, pokemon });
  }

  // Rojo Fuego o Verde Hoja: la partida no lo dice; sí sus Pokémon (los del propio entrenador)
  const id = u32(pequeno, 0x0a);
  const suyo = [...equipo, ...cajas.flatMap((caja) => caja.pokemon)].find(
    (p) => ["Rojo Fuego", "Verde Hoja"].includes(p.origen) && p.idEntrenador === id
  );

  return {
    juego: "frlg",
    version: suyo ? suyo.origen : "",
    gen: 3,
    entrenador: textoGen3(pequeno, 0, 7),
    medallas: Array.from({ length: 8 }, (_, i) => Boolean((grande[MEDALLAS] >> i) & 1)),
    abiertas: CAJAS_GBA,
    equipo,
    cajas
  };
}

// ---------- En la memoria, mientras se juega ----------
//
// La memoria grande de la GBA (256 KB) tal y como la da el emulador. El equipo no está en el
// mismo sitio en todos los idiomas: se busca la primera fila de Pokémon de equipo válidos (el de
// tu equipo va antes que el del rival y que la copia de la partida guardada) y se recuerda dónde
// estaba.

function valeEnEquipo(b, o) {
  if (o + TAM_EQUIPO_GBA > b.length) return false;
  const nivel = b[o + 84];
  const ps = u16(b, o + 86);
  const psMax = u16(b, o + 88);
  if (!nivel || nivel > 100 || !psMax || ps > psMax) return false;
  const d = descifrar(b, o);
  return Boolean(d && especieNacional(u16(d, 0)));
}

// Dónde empieza el equipo en la memoria, o -1 si no hay (todavía no tienes Pokémon)
export function buscarEquipo(memoria) {
  for (let o = 0; o + TAM_EQUIPO_GBA <= memoria.length; o += 4) {
    if (valeEnEquipo(memoria, o)) return o;
  }
  return -1;
}

// El equipo que hay ahora en la memoria, empezando en inicio (de buscarEquipo). null si ahí ya
// no hay un equipo (hay que volver a buscarlo).
export function equipoEnMemoria(memoria, inicio) {
  if (inicio < 0 || !valeEnEquipo(memoria, inicio)) return null;
  const equipo = [];
  for (let i = 0; i < 6; i++) {
    const o = inicio + i * TAM_EQUIPO_GBA;
    if (!valeEnEquipo(memoria, o)) break;
    equipo.push(pokemonGBA(memoria, o, true));
  }
  return equipo;
}
