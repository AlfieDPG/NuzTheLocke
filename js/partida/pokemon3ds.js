// ---------- Un Pokémon de una partida de 3DS, para editarlo ----------
//
// leerEditable: del Pokémon descifrado (js/partida/escribir3ds.js, leerHueco) a un objeto con
// lo que se puede cambiar. aplicarEditable: al revés, sobre una copia. Lo que no se toca aquí
// (entrenador original, recuerdos, cintas, fechas...) se queda tal cual estaba. crearPokemon:
// uno nuevo, del entrenador de la partida.
//
// Los offsets son los de los Pokémon de gen 6 y 7 (232 bytes en caja y 260 en el equipo), los
// mismos que ya lee js/partida/tresds.js.

import { TAM_POKEMON, TAM_POKEMON_EQUIPO, objetoWeb3DS, objetoJuego3DS } from "./tresds.js";
import { ritmoDe, experienciaPara, nivelDe } from "./convertir.js";

// Orden de la web (PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad) -> sitio en el Pokémon
const EVS = [0x1e, 0x1f, 0x20, 0x22, 0x23, 0x21];
const BITS_IV = [0, 5, 10, 20, 25, 15];

// La naturaleza n sube la estadística n / 5 y baja la n % 5, contando en el orden del juego
// (Ataque, Defensa, Velocidad, At. Esp., Def. Esp.). Aquí, en el orden de la web.
const DEL_JUEGO = [1, 2, 5, 3, 4];

const MAX_MOTE = 12;
const GENEROS = ["M", "F", ""];

// Los 3DS usan unos pocos caracteres propios
const PROPIOS = { 0xe08e: "♂", 0xe08f: "♀" };
const A_PROPIOS = Object.fromEntries(Object.entries(PROPIOS).map(([codigo, letra]) => [letra, Number(codigo)]));

function texto(vista, inicio, maximo) {
  let salida = "";
  for (let i = 0; i < maximo; i++) {
    const c = vista.getUint16(inicio + i * 2, true);
    if (!c) break;
    salida += PROPIOS[c] || String.fromCharCode(c);
  }
  return salida;
}

// 12 letras y el 0 del final; lo que sobra, a ceros
function escribirTexto(vista, inicio, cadena) {
  const letras = [...cadena].slice(0, MAX_MOTE);
  for (let i = 0; i <= MAX_MOTE; i++) {
    const letra = letras[i];
    vista.setUint16(inicio + i * 2, letra ? A_PROPIOS[letra] || letra.charCodeAt(0) : 0, true);
  }
}

function esShiny(vista) {
  const pid = vista.getUint32(0x18, true);
  return (vista.getUint16(0x0c, true) ^ vista.getUint16(0x0e, true) ^ (pid >>> 16) ^ (pid & 0xffff)) < 16;
}

// Dónde está la amistad que cuenta: la del entrenador original o, si lo tiene otro, la suya
function sitioAmistad(datos) {
  return datos[0x93] === 1 ? 0xa2 : 0xca;
}

// Lugares especiales de gen 6 (0xDA dónde se conoció, 0xD8 dónde se recibió el huevo)
const LUGAR_INTERCAMBIO = 30001; // los creados aquí: así no cuentan como captura de ninguna ruta
const LUGAR_GUARDERIA = 60002;
const POKE_BALL = 4;

function ponerFecha(datos, inicio, fecha) {
  datos[inicio] = fecha.getFullYear() % 100;
  datos[inicio + 1] = fecha.getMonth() + 1;
  datos[inicio + 2] = fecha.getDate();
}

export function leerEditable(crudo) {
  const v = new DataView(crudo.buffer, crudo.byteOffset, crudo.byteLength);
  const iv32 = v.getUint32(0x74, true);
  const especie = v.getUint16(0x08, true);
  const experiencia = v.getUint32(0x10, true);
  const huevo = Boolean((iv32 >>> 30) & 1);
  const apodado = Boolean(iv32 >>> 31);
  return {
    especie,
    forma: crudo[0x1d] >> 3,
    genero: GENEROS[(crudo[0x1d] >> 1) & 3] || "",
    apodado,
    mote: apodado && !huevo ? texto(v, 0x40, MAX_MOTE) : "", // el de los huevos es «Huevo»
    shiny: esShiny(v),
    objeto: objetoWeb3DS(v.getUint16(0x0a, true)),
    habilidad: crudo[0x14],
    numHabilidad: crudo[0x15] & 7, // 1, 2 o 4 (la oculta)
    naturaleza: crudo[0x1c],
    experiencia,
    nivel: nivelDe(especie, experiencia),
    evs: EVS.map((o) => crudo[o]),
    ivs: BITS_IV.map((b) => (iv32 >>> b) & 31),
    amistad: crudo[sitioAmistad(crudo)],
    ataques: [0, 1, 2, 3].map((i) => ({ id: v.getUint16(0x5a + i * 2, true), pp: crudo[0x62 + i], masPP: crudo[0x66 + i] })),
    huevo,
    ball: crudo[0xdc],
    lugar: v.getUint16(0xda, true), // dónde se conoció (0 en los huevos)
    version: crudo[0xdf], // juego de origen
    entrenador: texto(v, 0xb0, MAX_MOTE), // entrenador original
    idioma: crudo[0xe3],
    enEquipo: crudo.length > TAM_POKEMON
  };
}

// Las estadísticas de verdad (orden de la web), con la fórmula de los juegos. Shedinja, 1 PS.
export function estadisticas(base, nivel, naturaleza, evs, ivs, especie) {
  const sube = Math.floor(naturaleza / 5) === naturaleza % 5 ? -1 : DEL_JUEGO[Math.floor(naturaleza / 5)];
  const baja = sube < 0 ? -1 : DEL_JUEGO[naturaleza % 5];
  return base.map((b, i) => {
    const dentro = Math.floor(((2 * b + ivs[i] + Math.floor(evs[i] / 4)) * nivel) / 100);
    if (i === 0) return especie === 292 ? 1 : dentro + nivel + 10;
    return Math.floor((dentro + 5) * (i === sube ? 1.1 : i === baja ? 0.9 : 1));
  });
}

// Copia del Pokémon con los cambios. editable: lo de leerEditable, cambiado (huevo, ball,
// lugar, versión y entrenador, si no vienen, se quedan como estaban). Además:
//   base: sus estadísticas base (para las del equipo, que van guardadas)
//   nombreEspecie: el nombre que lleva si no tiene mote (en el idioma de la partida)
//   nombreHuevo: el que llevan los huevos («Huevo», en el idioma de la partida)
export function aplicarEditable(crudo, editable, { base, nombreEspecie, nombreHuevo = "Huevo" }) {
  const antes = leerEditable(crudo);
  const datos = new Uint8Array(crudo);
  const v = new DataView(datos.buffer);
  const e = editable;
  const huevo = e.huevo === undefined ? antes.huevo : Boolean(e.huevo);
  const hoy = new Date();

  v.setUint16(0x08, e.especie, true);
  v.setUint16(0x0a, objetoJuego3DS(e.objeto || 0), true);
  datos[0x14] = e.habilidad;
  datos[0x15] = (datos[0x15] & ~7) | e.numHabilidad;
  datos[0x1c] = e.naturaleza;
  datos[0x1d] = (datos[0x1d] & 1) | (Math.max(0, GENEROS.indexOf(e.genero)) << 1) | (e.forma << 3);
  if (e.ball) datos[0xdc] = e.ball;

  // La experiencia solo se cambia si cambia el nivel o la especie (que puede crecer a otro
  // ritmo): así no se pierde lo que llevaba hacia el siguiente nivel
  const nivel = Math.max(1, Math.min(100, e.nivel));
  if (e.especie !== antes.especie || nivel !== antes.nivel) {
    v.setUint32(0x10, experienciaPara(ritmoDe(e.especie), nivel), true);
  }

  // Huevo: como los de la guardería (sin lugar ni fecha de conocerse hasta que eclosione).
  // Al dejar de serlo, se ha conocido hoy.
  if (huevo && !antes.huevo) {
    v.setUint16(0xd8, LUGAR_GUARDERIA, true);
    ponerFecha(datos, 0xd1, hoy);
    v.setUint16(0xda, 0, true);
    datos.fill(0, 0xd4, 0xd7);
    datos[0xdd] &= 0x80;
  } else if (!huevo && antes.huevo) {
    if (!datos[0xd4]) ponerFecha(datos, 0xd4, hoy);
    datos[0xdd] = (datos[0xdd] & 0x80) | nivel;
  }

  // Origen: dónde se conoció (los huevos no tienen), el juego y el entrenador original
  if (e.lugar !== undefined && !huevo) v.setUint16(0xda, e.lugar, true);
  if (e.version) datos[0xdf] = e.version;
  const entrenador = String(e.entrenador ?? antes.entrenador).trim();
  if (entrenador && entrenador !== antes.entrenador) escribirTexto(v, 0xb0, entrenador);

  EVS.forEach((o, i) => (datos[o] = Math.max(0, Math.min(252, e.evs[i]))));
  let iv32 = 0;
  BITS_IV.forEach((b, i) => (iv32 |= (Math.max(0, Math.min(31, e.ivs[i])) & 31) << b));
  const mote = huevo ? "" : String(e.mote || "").trim();
  if (huevo) iv32 |= 3 << 30; // los huevos llevan el nombre «Huevo» como mote
  else if (mote) iv32 |= 1 << 31;
  v.setUint32(0x74, iv32 >>> 0, true);

  // El nombre: el mote o, sin él, el de la especie. Solo si cambia algo (el que trae la partida
  // es el bueno, con sus mayúsculas y en su idioma)
  if (huevo !== antes.huevo || mote !== antes.mote || e.especie !== antes.especie) {
    escribirTexto(v, 0x40, huevo ? nombreHuevo : mote || nombreEspecie);
  }

  // Shiny: la mitad alta del PID se ajusta a la ID y la SID del entrenador
  if (e.shiny !== antes.shiny) {
    const pid = v.getUint32(0x18, true);
    const bajo = pid & 0xffff;
    const ids = v.getUint16(0x0c, true) ^ v.getUint16(0x0e, true);
    const alto = e.shiny ? ids ^ bajo : (ids ^ bajo ^ 0x8000) & 0xffff;
    v.setUint32(0x18, ((alto << 16) | bajo) >>> 0, true);
  }

  datos[sitioAmistad(datos)] = Math.max(0, Math.min(255, e.amistad));

  e.ataques.forEach((ataque, i) => {
    v.setUint16(0x5a + i * 2, (ataque && ataque.id) || 0, true);
    datos[0x62 + i] = ataque && ataque.id ? ataque.pp : 0;
    datos[0x66 + i] = ataque && ataque.id ? ataque.masPP : 0;
  });

  // En el equipo van guardados el nivel y las estadísticas: se vuelven a calcular (y se cura)
  if (datos.length > TAM_POKEMON && base) ponerDatosDeEquipo(datos, base);
  return datos;
}

// Nivel, PS (llenos) y estadísticas, que en el equipo van guardados
function ponerDatosDeEquipo(datos, base) {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const e = leerEditable(datos);
  const [ps, ataque, defensa, ataqueEsp, defensaEsp, velocidad] = estadisticas(base, e.nivel, e.naturaleza, e.evs, e.ivs, e.especie);
  datos[0xec] = e.nivel;
  [ps, ps, ataque, defensa, velocidad, ataqueEsp, defensaEsp].forEach((valor, i) => v.setUint16(0xf0 + i * 2, valor, true));
}

// De la caja al equipo: lo mismo con lo del equipo (sin estados, curado)
export function paraEquipo(crudo, base) {
  if (crudo.length > TAM_POKEMON) return crudo;
  const datos = new Uint8Array(TAM_POKEMON_EQUIPO);
  datos.set(crudo);
  ponerDatosDeEquipo(datos, base);
  return datos;
}

// Del equipo a la caja: sin lo del equipo
export function paraCaja(crudo) {
  return crudo.slice(0, TAM_POKEMON);
}

function alAzar() {
  const numero = new Uint32Array(1);
  crypto.getRandomValues(numero);
  return numero[0];
}

// Copia con otra llave: para la web es otro Pokémon (la llave es lo que los distingue)
export function conLlaveNueva(crudo) {
  const datos = paraCaja(crudo);
  new DataView(datos.buffer).setUint32(0, alAzar() || 1, true);
  return datos;
}

// Un Pokémon nuevo, de la caja (232 bytes), como si lo hubiera conseguido el entrenador de la
// partida (js/partida/tresds.js, entrenadorDe) por intercambio hoy. editable y opciones, como
// en aplicarEditable.
export function crearPokemon(entrenador, editable, opciones) {
  const datos = new Uint8Array(TAM_POKEMON);
  const v = new DataView(datos.buffer);
  v.setUint32(0x00, alAzar() || 1, true);
  v.setUint32(0x18, alAzar(), true);
  v.setUint16(0x0c, entrenador.tid, true);
  v.setUint16(0x0e, entrenador.sid, true);
  datos.set(entrenador.nombre, 0xb0);
  ponerFecha(datos, 0xd4, new Date());
  v.setUint16(0xda, LUGAR_INTERCAMBIO, true);
  datos[0xdc] = POKE_BALL;
  datos[0xdd] = (entrenador.genero ? 0x80 : 0) | Math.max(1, Math.min(100, editable.nivel));
  datos[0xdf] = entrenador.version;
  datos[0xe0] = entrenador.pais;
  datos[0xe1] = entrenador.region;
  datos[0xe2] = entrenador.consola;
  datos[0xe3] = entrenador.idioma;
  return aplicarEditable(datos, editable, opciones);
}

// true si es un huevo
export function esHuevo(crudo) {
  return Boolean((new DataView(crudo.buffer, crudo.byteOffset, crudo.byteLength).getUint32(0x74, true) >>> 30) & 1);
}

// PP de un ataque con sus Más PP
export function ppMaximos(ppBase, masPP) {
  return Math.floor((ppBase * (5 + masPP)) / 5);
}
