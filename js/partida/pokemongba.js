// ---------- Un Pokémon de una partida de GBA (Rojo Fuego / Verde Hoja), para editarlo ----------
//
// Lo mismo que ./pokemonds.js (mismos nombres y mismo objeto «editable»), con el crudo de ./escribirgba.js:
//
//   cabecera   0 PID, 4 ID del entrenador (TID | SID << 16), 8 mote (10 letras del juego), 18 idioma,
//              19 marcas (bit 2: huevo), 20 entrenador (7), 28 suma
//   G (32)     especie (la del juego: las de Hoenn van en otro orden), objeto (el del juego), experiencia,
//              más PP (2 bits por ataque), amistad
//   A (44)     cuatro ataques y sus PP
//   E (56)     EVs (PS, Ata, Def, Vel, AtE, DfE) y lo de los concursos
//   M (68)     Pokérus, dónde se conoció, origen (nivel, juego, ball, entrenadora), IVs (y huevo, habilidad),
//              cintas
//   equipo     80 estado, 84 nivel, 86 PS, 88 PS máx., 90 Ata, Def, Vel, AtE, DfE
//
// Como en la 4.ª generación, el PID decide el género (su byte bajo), si es shiny y la naturaleza (PID % 25); y,
// además, la letra de Unown y cómo evoluciona Wurmple. Si se cambia algo de eso, se busca otro PID que cuadre con
// todo (para la web, otro Pokémon: el editor lo apunta como metido). La habilidad va aparte (un bit de los IV).
// Los huevos, como los del juego: con el nombre japonés («タマゴ») e idioma japonés hasta que nacen.

import { ESPECIES_GEN3, objetoWebGen3, objetoJuegoGen3, codigosGen3 } from "./datos-gba.js";
import { especieNacional, generoGen3, habilidadGen3, sinMoteGen3, textoGen3, TAM_POKEMON_GBA, TAM_EQUIPO_GBA } from "./gba.js";
import { estadisticas } from "./pokemon3ds.js";
import { ritmoDe, experienciaPara, nivelDe } from "./convertir.js";

export const MAX_MOTE_GBA = 10;
export const MAX_ENTRENADOR_GBA = 7;
export const LUGAR_INTERCAMBIO_GBA = 0xfe; // «de un intercambio dentro del juego»: así no es captura de ninguna ruta

const POKE_BALL = 4;
const JAPONES = 1;
const NOMBRE_HUEVO = [0x60, 0x6f, 0x8b]; // タマゴ
const UNOWN = 201;
const WURMPLE = 265;

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
function poner16(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >> 8) & 0xff;
}
function poner32(b, i, v) {
  poner16(b, i, v & 0xffff);
  poner16(b, i + 2, (v >>> 16) & 0xffff);
}

const INTERNA = new Map(ESPECIES_GEN3.map((nacional, k) => [nacional, 277 + k]));
const especieJuego = (nacional) => (nacional <= 251 ? nacional : INTERNA.get(nacional) || 0);

// Orden de la web (PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad) -> sitio en el Pokémon
const EVS = [56, 57, 58, 60, 61, 59];
const BITS_IV = [0, 5, 10, 20, 25, 15];

function azar16() {
  const n = new Uint16Array(1);
  crypto.getRandomValues(n);
  return n[0];
}

// La letra de Unown (de 2 bits de cada byte del PID) y si Wurmple evoluciona a Silcoon
export const letraUnown = (pid) => (((pid >>> 18) & 0xc0) | ((pid >>> 12) & 0x30) | ((pid >>> 6) & 0x0c) | (pid & 0x03)) % 28;
export const wurmpleSilcoon = (pid) => (pid >>> 16) % 10 <= 4;

const esShinyPid = (pid, otid) => ((otid & 0xffff) ^ (otid >>> 16) ^ (pid >>> 16) ^ (pid & 0xffff)) < 8;

// Un PID que cumpla lo pedido: { shiny, naturaleza?, especie, unown?, wurmple?, generoRatio?, genero?, bajo? }
// (bajo: el byte bajo, que da el género, fijo)
function buscarPid(otid, req) {
  for (let intento = 0; intento < 4000000; intento++) {
    let bajo = azar16();
    if (req.bajo !== undefined) bajo = (bajo & 0xff00) | req.bajo;
    if (req.generoRatio !== undefined && generoGen3(req.especie, bajo, req.generoRatio) !== req.genero) continue;
    const ids = (otid & 0xffff) ^ (otid >>> 16);
    const alto = req.shiny ? (ids ^ bajo ^ (azar16() & 7)) & 0xffff : azar16();
    const pid = ((alto << 16) | bajo) >>> 0;
    if (esShinyPid(pid, otid) !== Boolean(req.shiny)) continue;
    if (req.naturaleza !== undefined && pid % 25 !== req.naturaleza) continue;
    if (req.unown !== undefined && letraUnown(pid) !== req.unown) continue;
    if (req.wurmple !== undefined && wurmpleSilcoon(pid) !== req.wurmple) continue;
    return pid;
  }
  throw new Error("No se ha encontrado un PID que cuadre.");
}

// Lo que depende del PID y no se quiere cambiar: la letra de Unown y la evolución de Wurmple
function fijosDe(especie, pid) {
  return {
    unown: especie === UNOWN ? letraUnown(pid) : undefined,
    wurmple: especie === WURMPLE ? wurmpleSilcoon(pid) : undefined
  };
}

// Un texto en el campo (hasta «maximo» letras y el 0xFF del final; lo que sobra del campo, 0xFF)
function escribirTexto(datos, inicio, cadena, campo) {
  const codigos = codigosGen3(cadena).slice(0, campo);
  for (let i = 0; i < campo; i++) datos[inicio + i] = i < codigos.length ? codigos[i] : 0xff;
}

// El nombre de la especie como lo pone el juego: en mayúsculas
function nombreDeEspecie(nombre) {
  return String(nombre).toLocaleUpperCase("es");
}

function leerEditable(crudo) {
  const pid = u32(crudo, 0);
  const otid = u32(crudo, 4);
  const especie = especieNacional(u16(crudo, 32));
  const experiencia = u32(crudo, 36);
  const ivs = u32(crudo, 72);
  const origen = u16(crudo, 70);
  const huevo = Boolean((crudo[19] & 4) || (ivs >>> 30) & 1);
  const mote = huevo ? "" : textoGen3(crudo, 8, 10);
  const apodado = !huevo && !sinMoteGen3(especie, mote);
  const masPP = crudo[40];
  return {
    especie,
    forma: 0,
    genero: generoGen3(especie, pid),
    apodado,
    mote: apodado ? mote : "",
    shiny: esShinyPid(pid, otid),
    objeto: objetoWebGen3(u16(crudo, 34)),
    habilidad: habilidadGen3(especie, ivs >>> 31),
    numHabilidad: ivs >>> 31 ? 2 : 1,
    naturaleza: pid % 25,
    experiencia,
    nivel: nivelDe(especie, experiencia),
    evs: EVS.map((o) => crudo[o]),
    ivs: BITS_IV.map((b) => (ivs >>> b) & 31),
    amistad: crudo[41],
    ataques: [0, 1, 2, 3].map((i) => ({ id: u16(crudo, 44 + i * 2), pp: crudo[52 + i], masPP: (masPP >> (i * 2)) & 3 })),
    huevo,
    ball: (origen >> 11) & 15,
    lugar: crudo[69],
    version: (origen >> 7) & 15,
    entrenador: textoGen3(crudo, 20, 7),
    idioma: crudo[18],
    enEquipo: crudo.length > TAM_POKEMON_GBA
  };
}

// Copia con los cambios. opciones: { base, nombreEspecie, generoRatio, idioma } (sin generoRatio, el género no se
// toca; idioma: el de la partida, para el que nace de un huevo)
function aplicarEditable(crudo, editable, { base, nombreEspecie, generoRatio, idioma = 7 }) {
  const antes = leerEditable(crudo);
  const datos = new Uint8Array(crudo);
  const e = editable;
  const huevo = e.huevo === undefined ? antes.huevo : Boolean(e.huevo);
  const especie = especieJuego(e.especie);
  if (!especie) throw new Error("Esa especie no está en este juego.");

  poner16(datos, 32, especie);
  poner16(datos, 34, e.objeto ? objetoJuegoGen3(e.objeto) : 0);
  if (e.objeto && !objetoJuegoGen3(e.objeto)) throw new Error("Ese objeto no está en este juego.");
  datos[19] = (datos[19] & ~0x07) | 0x02 | (huevo ? 0x04 : 0); // tiene especie; huevo

  let origen = u16(datos, 70);
  const nivel = Math.max(1, Math.min(100, e.nivel));
  if (e.especie !== antes.especie || nivel !== antes.nivel) poner32(datos, 36, experienciaPara(ritmoDe(e.especie), nivel));
  if (e.ball) origen = (origen & ~(15 << 11)) | ((e.ball & 15) << 11);
  if (e.version) origen = (origen & ~(15 << 7)) | ((e.version & 15) << 7);

  // Huevo: como los de la guardería (nombre e idioma japoneses, conocido a nivel 0). Al nacer, del idioma de la
  // partida y con el nombre de su especie
  if (huevo && !antes.huevo) {
    datos.fill(0xff, 8, 18);
    datos.set(NOMBRE_HUEVO, 8);
    datos[18] = JAPONES;
    origen &= ~0x7f;
  } else if (!huevo && antes.huevo) {
    datos[18] = idioma;
    origen &= ~0x7f; // los que nacen se conocen a nivel 0
  }
  poner16(datos, 70, origen);
  if (e.lugar !== undefined && !huevo) datos[69] = e.lugar & 0xff;

  const entrenador = String(e.entrenador ?? antes.entrenador).trim();
  if (entrenador && entrenador !== antes.entrenador) escribirTexto(datos, 20, entrenador, 7);

  EVS.forEach((o, i) => (datos[o] = Math.max(0, Math.min(255, e.evs[i]))));
  let ivs = 0;
  BITS_IV.forEach((b, i) => (ivs |= (Math.max(0, Math.min(31, e.ivs[i])) & 31) << b));
  if (huevo) ivs |= 1 << 30;
  if (e.numHabilidad === 2) ivs |= 1 << 31;
  poner32(datos, 72, ivs >>> 0);

  // El nombre: el mote o, sin él, el de la especie (los huevos, el suyo)
  const mote = huevo ? "" : String(e.mote || "").trim();
  if (!huevo && (antes.huevo || mote !== antes.mote || e.especie !== antes.especie)) {
    escribirTexto(datos, 8, mote || nombreDeEspecie(nombreEspecie), 10);
  }

  datos[41] = Math.max(0, Math.min(255, e.amistad));
  let masPP = 0;
  e.ataques.forEach((ataque, i) => {
    const id = (ataque && ataque.id) || 0;
    poner16(datos, 44 + i * 2, id);
    datos[52 + i] = id ? ataque.pp : 0;
    if (id) masPP |= (ataque.masPP & 3) << (i * 2);
  });
  datos[40] = masPP;

  // El PID: solo cambia si lo que depende de él ya no cuadra
  const pid = u32(datos, 0);
  const otid = u32(datos, 4);
  const genero = generoRatio === undefined ? antes.genero : e.genero;
  const conGenero = generoRatio !== undefined && (genero !== antes.genero || e.especie !== antes.especie);
  const fijos = fijosDe(e.especie, pid);
  const cuadra =
    esShinyPid(pid, otid) === Boolean(e.shiny) &&
    pid % 25 === e.naturaleza &&
    (!conGenero || generoGen3(e.especie, pid, generoRatio) === genero);
  if (!cuadra) {
    poner32(datos, 0, buscarPid(otid, {
      shiny: Boolean(e.shiny),
      naturaleza: e.naturaleza,
      especie: e.especie,
      ...fijos,
      ...(conGenero ? { generoRatio, genero } : { bajo: pid & 0xff })
    }));
  }

  if (datos.length > TAM_POKEMON_GBA && base) ponerDatosDeEquipo(datos, base);
  return datos;
}

// Nivel, PS (llenos) y estadísticas, que en el equipo van guardados (sin estados)
function ponerDatosDeEquipo(datos, base) {
  const e = leerEditable(datos);
  const [ps, ataque, defensa, ataqueEsp, defensaEsp, velocidad] = estadisticas(base, e.nivel, e.naturaleza, e.evs, e.ivs, e.especie);
  poner32(datos, 80, 0);
  datos[84] = e.nivel;
  [ps, ps, ataque, defensa, velocidad, ataqueEsp, defensaEsp].forEach((valor, i) => poner16(datos, 86 + i * 2, valor));
}

// De la caja al equipo (sin carta: 0xFF)
function paraEquipo(crudo, base) {
  if (crudo.length > TAM_POKEMON_GBA) return crudo;
  const datos = new Uint8Array(TAM_EQUIPO_GBA);
  datos.set(crudo);
  datos[85] = 0xff;
  ponerDatosDeEquipo(datos, base);
  return datos;
}

function paraCaja(crudo) {
  return crudo.slice(0, TAM_POKEMON_GBA);
}

// Copia con otro PID (para la web, otro Pokémon) y todo lo que depende de él igual
function conLlaveNueva(crudo) {
  const datos = paraCaja(crudo);
  const pid = u32(datos, 0);
  const otid = u32(datos, 4);
  const especie = especieNacional(u16(datos, 32));
  let nuevo = pid;
  for (let intento = 0; intento < 20 && nuevo === pid; intento++) {
    nuevo = buscarPid(otid, { shiny: esShinyPid(pid, otid), naturaleza: pid % 25, especie, ...fijosDe(especie, pid), bajo: pid & 0xff });
  }
  if (nuevo === pid) throw new Error("No se ha encontrado un PID que cuadre.");
  poner32(datos, 0, nuevo);
  return datos;
}

// Uno nuevo, de la caja, como si lo hubiera conseguido el entrenador de la partida (de entrenadorGBA en
// ./escribirgba.js) en un intercambio del juego
function crearPokemon(entrenador, editable, opciones) {
  const datos = new Uint8Array(TAM_POKEMON_GBA);
  poner32(datos, 0, ((azar16() << 16) | azar16()) >>> 0);
  poner16(datos, 4, entrenador.tid);
  poner16(datos, 6, entrenador.sid);
  datos.fill(0xff, 8, 18);
  datos[18] = entrenador.idioma;
  datos.fill(0xff, 20, 27);
  datos.set(entrenador.nombre.subarray(0, 7), 20);
  datos[69] = LUGAR_INTERCAMBIO_GBA;
  const nivel = Math.max(1, Math.min(100, editable.nivel));
  poner16(datos, 70, nivel | ((entrenador.version & 15) << 7) | (POKE_BALL << 11) | (entrenador.genero ? 0x8000 : 0));
  return aplicarEditable(datos, { ...editable, version: editable.version || entrenador.version }, { idioma: entrenador.idioma, ...opciones });
}

function esHuevo(crudo) {
  return Boolean((crudo[19] & 4) || (u32(crudo, 72) >>> 30) & 1);
}

function especieDe(crudo) {
  return especieNacional(u16(crudo, 32));
}

export const POKEMON_GBA = {
  leerEditable,
  aplicarEditable,
  crearPokemon,
  conLlaveNueva,
  paraEquipo,
  paraCaja,
  esHuevo,
  especieDe,
  formaDe: () => 0,
  lugarIntercambio: LUGAR_INTERCAMBIO_GBA,
  maxMote: MAX_MOTE_GBA,
  maxEntrenador: MAX_ENTRENADOR_GBA
};
