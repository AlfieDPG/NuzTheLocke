// ---------- Diamante / Perla / Platino / HeartGold / SoulSilver: los datos que se randomizan ----------
//
// Hace lo mismo que ./juego-gen5.js (devuelve y escribe los mismos «datos»), pero con los archivos
// de 4.ª generación (con nombre, en carpetas: «poketool/personal/personal.narc»; en HeartGold y
// SoulSilver, «a/0/0/2»...). Dónde está cada cosa en cada versión e idioma: ./datos-gen4.js.
//
//   PokemonStats   datos de cada Pokémon (44 bytes): estadísticas base 0-5 (PS, Ata, Def, Vel, AtE,
//                  DfE), tipos 6-7, objetos que llevan 12 y 14 (u16), habilidades 22 y 23,
//                  compatibilidad con las MT y MO 28-40 (bits: 92 MT y 8 MO)
//   PokemonMovesets ataques por nivel: u16 cada uno (ataque en 9 bits y nivel en 7: nivel << 9)
//                  hasta 0xFFFF
//   PokemonEvolutions 7 de [método u16, dato u16, especie u16]
//   MoveData       efecto u16 0, categoría 2, potencia 3, tipo 4, precisión 5, PP 6
//   ItemData       precio u16 en 0
//   TrainerData    entrenadores, 20 bytes (byte 0: 1 = ataques propios, 2 = objetos; byte 3: cuántos
//                  Pokémon; byte 16: tipo de combate)
//   TrainerPokemon sus Pokémon: [dificultad, habilidad/género, nivel u16, especie y forma u16], 2 bytes
//                  más en Platino y HG/SS, luego el objeto (u16) y los 4 ataques (u16) si los lleva
//   InGameTrades   un archivo por intercambio: da (u32 en 0), IVs (6 × u32 en 4), objeto (u32 en 0x3C),
//                  pide (u32 en 0x4C)
//   Scripts        las iniciales (en el overlay, no aquí), los objetos del suelo, los estáticos...

import { leerNarc, crearNarc } from "./rom-nds.js";
import { IPS, aplicarIPS, largoConIPS } from "./parches-gen5.js";
import { ENTRADAS_GEN4 } from "./datos-gen4.js";
import { leerTextos4, escribirTextos4, aCodigos, deCodigos } from "./textos-gen4.js";
import { ponerHierbaEnPueblos as hierbaEnPueblos } from "./hierba-gen4.js";
import { ponerMentasGen4, mentasPosiblesGen4, mentasYaPuestasGen4, PRIMERA_MENTA_GEN4, MENTAS_GEN4 } from "./mentas-gen4.js";

// Las mentas (./mentas-gen4.js): en la web, 1231-1251; en el juego, en los huecos del 113 al 133
const PRIMERA_MENTA_WEB = 1231;
const objetoAlJuego = (id) => (id >= PRIMERA_MENTA_WEB && id < PRIMERA_MENTA_WEB + MENTAS_GEN4 ? PRIMERA_MENTA_GEN4 + id - PRIMERA_MENTA_WEB : id);

export const ULTIMA_ESPECIE = 493;
export const ULTIMO_ATAQUE = 467;
export const ULTIMA_HABILIDAD = 123;

// Los tipos por su número en el juego (el 9 es «???»)
export const TIPOS = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel", null,
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"
];
const numeroDeTipo = (tipo) => (tipo ? TIPOS.indexOf(tipo) : 9);

// Métodos de evolución: del juego a los de 5.ª generación (los que usa randomizar.js) y vuelta.
// Del 7 en adelante, los de 4.ª generación van uno por debajo (la piedra es el 7, no el 8).
export const EVO = {
  amistad: 1, amistadDia: 2, amistadNoche: 3, nivel: 4, intercambio: 5, intercambioObjeto: 6, intercambioEspecial: 7,
  piedra: 8, belleza: 16, piedraMacho: 17, piedraHembra: 18, objetoDia: 19, objetoNoche: 20, ataque: 21,
  otroEnEquipo: 22, nivelMacho: 23, nivelHembra: 24
};
const metodoAbstracto = (m) => (m >= 7 ? m + 1 : m);
const metodoDelJuego = (m) => (m >= 8 ? m - 1 : m);

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

// ---------- Qué juego es ----------

const tabla = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  tabla[i] = c >>> 0;
}
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = tabla[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

const memoria = new WeakMap();

// La entrada de la tabla de esta ROM: por código (y, si hay varias con el mismo, por el CRC32 del
// programa principal)
export function entradaDe(rom) {
  if (memoria.has(rom)) return memoria.get(rom);
  const mismas = ENTRADAS_GEN4.filter((e) => e.codigo === rom.codigo);
  let entrada = mismas.length === 1 ? mismas[0] : null;
  if (!entrada && mismas.length) {
    const crc = crc32(rom.leerArm9());
    // (una ROM ya randomizada tiene otro programa: las entradas del mismo código solo se distinguen por la región)
    entrada = mismas.find((e) => e.crc === crc) || mismas[0];
  }
  memoria.set(rom, entrada);
  return entrada;
}

export { esGen4 } from "./juego-gen4-ident.js";

export const esDP = (entrada) => entrada.tipo === "DP";
export const esPt = (entrada) => entrada.tipo === "Plat";
export const esHGSS = (entrada) => entrada.tipo === "HGSS";

// ---------- Entrenadores importantes ----------
//
// De Gen4Constants.java de UPR-ZX (tagTrainers…). Los números son los del archivo de cada
// entrenador. Los rivales (y los amigos) van de tres en tres: uno por inicial.

const tres = (x) => [x - 1, x, x + 1]; // tagRivalConsecutive
const tresDesde = (x) => [x, x + 1, x + 2]; // tagFriendConsecutive

// Los entrenadores que combaten a tu lado en las dobles (tagFriendConsecutive)
// Y los que te acompañan por el camino (Cheryl, Mira, Riley, Marley y Buck): marcados como dobles, los combates salvajes
// a su lado se convierten en combates contra entrenadores rotos (Gen4Constants.partnerTrainerIndices)
const AMIGOS_DPPT = [...[0x265, 0x268, 0x26d, 0x270].flatMap((x) => [x, x + 1, x + 2]), 608, 609, 610, 611, 612];

const DP = {
  amigos: AMIGOS_DPPT,
  lideres: [0xf6, 0x13b, 0x13d, 0x13c, 0x13e, 0xfa, 0x13f, 0x140, 0x105, 0x106, 0x107, 0x108, 0x10b, 0x193, 0x194],
  rivales: [...tres(0xf8), ...tres(0x1d7), ...tres(0x1da), ...tres(0x1dd), 0x26b, 0x26c, 0x25f, ...tres(0x1e0), ...tres(0x346), ...tres(0x349), ...tresDesde(0x265), ...tresDesde(0x268), ...tresDesde(0x26d), ...tresDesde(0x270)],
  grupos: [
    [0xf4, 0xf5, 0xf6],
    [0x144, 0x103, 0x104, 0x15c, 0x13b],
    [0x135, 0x136, 0x137, 0x138, 0x13d],
    [0x1f1, 0x1f2, 0x191, 0x153, 0x125, 0x1e3, 0x13c],
    [0x165, 0x145, 0x10a, 0x14a, 0x154, 0x157, 0x118, 0x11c, 0x13e],
    [0x13a, 0x100, 0x101, 0x117, 0x16f, 0xe8, 0x11b, 0xfa],
    [0x10c, 0x10d, 0x10e, 0x10f, 0x33b, 0x33c, 0x13f],
    [0x158, 0x155, 0x12d, 0x12e, 0x12f, 0x11d, 0x119, 0x140],
    [0x105], [0x106], [0x107], [0x108], [0x10b]
  ]
};

const PT = {
  amigos: AMIGOS_DPPT,
  lideres: [0xf6, 0x13b, 0x13e, 0x13d, 0x13c, 0xfa, 0x13f, 0x140, 0x105, 0x106, 0x107, 0x108, 0x10b, 0x362, 0x363, 0x364, 0x365, 0x366, 0x391, 0x193, 0x194],
  rivales: [...tres(0x353), ...tres(0xf8), ...tres(0x1d7), ...tres(0x1da), ...tres(0x1dd), 0x26b, 0x26c, 0x25f, ...tres(0x1e0), ...tres(0x346), ...tres(0x349), ...tres(0x368), ...tresDesde(0x265), ...tresDesde(0x268), ...tresDesde(0x26d), ...tresDesde(0x270)],
  grupos: [
    [0xf4, 0xf5, 0xf6, 0x35a],
    [0x144, 0x103, 0x104, 0x15c, 0x13b, 0x359],
    [0x165, 0x145, 0x154, 0x157, 0x118, 0x11c, 0x13e, 0x35c],
    [0x135, 0x136, 0x137, 0x138, 0x13d, 0x356],
    [0x1f1, 0x1f2, 0x191, 0x153, 0x125, 0x1e3, 0x13c, 0x35b],
    [0x13a, 0x100, 0x101, 0x117, 0x16f, 0xe8, 0x11b, 0xfa, 0x358],
    [0x10c, 0x10d, 0x10e, 0x10f, 0x33b, 0x33c, 0x13f, 0x355],
    [0x158, 0x155, 0x12d, 0x12e, 0x12f, 0x11d, 0x119, 0x14b, 0x140, 0x357, 0x399],
    [0x105, 0x362], [0x106, 0x363], [0x107, 0x364, 0x39a], [0x108, 0x365], [0x10b, 0x366]
  ]
};

// De HeartGold y SoulSilver, los dos de cada tipo (gimnasios de Johto y de Kanto)
const HGSS = {
  lideres: [0x14, 0x15, 0x1e, 0x1f, 0x22, 0x21, 0x20, 0x23, 0xfd, 0xfe, 0xff, 0x100, 0x101, 0x102, 0x103, 0x105, 0xf5, 0xf7, 0x1a2, 0xf6, 0xf4, 0x104,
    0x2c8, 0x2c9, 0x2ca, 0x2cb, 0x2ce, 0x2cd, 0x2cc, 0x2cf, 0x2d0, 0x2d1, 0x2d2, 0x2d3, 0x2d4, 0x2d5, 0x2d6, 0x2d7, 0x2be, 0x2bf, 0x2c0, 0x2c1, 0x2bd],
  rivales: [...tres(0x1f0), 0x10a, 0x10d, 0x1, 0x10b, 0x10e, 0x107, 0x121, 0x10f, 0x120, 0x10c, 0x110, 0x108, ...tres(0x11e), ...tres(0x2e0), ...tres(0x1ea)],
  grupos: [
    [0x14, 0x32, 0x1d], [0x15, 0x43, 0x44, 0x45, 0x0a], [0x1e, 0x05, 0x46, 0x47, 0x16], [0x1f, 0x1ed, 0x1ee, 0x59, 0x2e],
    [0x22, 0x9c, 0x9d, 0x9f, 0xfb], [0x21], [0x20, 0x1e0, 0x1e1, 0x1e2, 0x1e3, 0x1e4], [0x23, 0x6e, 0x6f, 0x70, 0x75, 0x77],
    [0xfd, 0x134, 0x2ad], [0xfe, 0x2a4, 0x2a5, 0x2a6, 0x129, 0x12a], [0xff, 0x18c, 0xe8, 0x151], [0x100, 0x150, 0x146, 0x164, 0x15a],
    [0x101, 0x53, 0x54, 0xb7, 0x88], [0x102, 0x170, 0x171, 0xe6, 0x19f], [0x103, 0x2b1, 0x2b2, 0x2b3, 0x2b4, 0x2b5, 0x2b6], [0x105, 0x2a9, 0x2aa, 0x2ab, 0x2ac],
    [0xf5, 0x2be], [0xf7, 0x2bf], [0x1a2, 0x2c0], [0xf6, 0x2c1], [0xf4, 0x2bd]
  ]
};

// Los premios del Casino de HG/SS (como en UPR-ZX, StaticPokemonGameCorner): la especie en el script, el nivel y el nombre en
// la lista de premios (archivo de texto y línea). Iguales en todos los idiomas de fuera de Japón y Corea
const CASINO_HGSS = [
  { nombre: "Abra (Casino)", especie: [[910, 0x9a9], [910, 0xa38], [910, 0xad8]], nivel: [[910, 0xabc]], texto: [603, 0x18] },
  { nombre: "Ekans (Casino)", especie: [[910, 0x9b5], [910, 0xa5c], [910, 0xaef]], nivel: [[910, 0xabc]], texto: [603, 0x19] },
  { nombre: "Sandshrew (Casino)", especie: [[910, 0x9cd], [910, 0xa80], [910, 0xb06]], nivel: [[910, 0xabc]], texto: [603, 0x1b] },
  { nombre: "Dratini (Casino)", especie: [[910, 0x9c1]], nivel: [[910, 0xabc]], texto: [603, 0x1a] },
  { nombre: "Mr. Mime (Casino)", especie: [[804, 0x875], [804, 0x8db], [804, 0x957]], nivel: [[804, 0x93b]], texto: [509, 0x21] },
  { nombre: "Eevee (Casino)", especie: [[804, 0x881], [804, 0x8ff], [804, 0x96e]], nivel: [[804, 0x93b]], texto: [509, 0x22] },
  { nombre: "Porygon (Casino)", especie: [[804, 0x88d]], nivel: [[804, 0x93b]], texto: [509, 0x23] }
];
// El Mundo Distorsión de Platino: con otro Pokémon en lugar de Giratina el juego se cuelga al empezar el combate (el tipo de
// suelo 23 no prepara la entrada). Se le da la de la hierba, como en UPR-ZX (patchDistortionWorldGroundCheck)
const MARCA_SUELO_DISTORSION = "23D849187944C988090409148F44";
const SIETE_FOSILES = 7;

// Los estáticos que no van en la lista de cada juego: fósiles, premios del Casino, el huevo misterioso de HG/SS (un byte: hasta
// el 255) y Kenya y Shuckie (van en los intercambios: no se cambian por otro, se regalan)
function estaticosExtra(rom, perfil, narcs, arm9) {
  const extra = [];
  const n = perfil.num;
  const hgss = esHGSS(perfil.entrada);
  if (esDP(perfil.entrada)) {
    const f = erranteDP(arm9);
    if (f) {
      [0xf0, 0xf4].forEach((d, k) => {
        const actual = u32(arm9, f.inicio + d);
        extra.push({ nombre: k ? "Cresselia (errante)" : "Mesprit (errante)", tabla: "erranteDP", k, ...f, actual: f.ya || !k ? actual : 488, nivelActual: arm9[f.inicio + (k ? 0x2e : 0x26)] });
      });
    }
  }
  if (n.FossilTableOffset) {
    const tabla = hgss ? rom.leerOverlay(n.FossilTableOvlNumber) : arm9;
    const nivel = narcs.scripts.archivos[n.FossilLevelScriptNumber][n.FossilLevelOffset];
    for (let f = 0; f < SIETE_FOSILES; f++) {
      const pos = n.FossilTableOffset + 2 + f * 4;
      extra.push({ nombre: `Fósil ${f + 1}`, tabla: "fosil", pos, actual: u16(tabla, pos), nivelActual: nivel });
    }
  }
  if (hgss && !["J", "K"].includes(rom.codigo[3])) {
    for (const c of CASINO_HGSS) {
      const [archivo, pos] = c.especie[0];
      extra.push({ ...c, forma: [], actual: u16(narcs.scripts.archivos[archivo], pos), nivelActual: narcs.scripts.archivos[c.nivel[0][0]][c.nivel[0][1]] });
    }
  }
  if (n.MysteryEggOffset) {
    const campo = rom.leerOverlay(n.FieldOvlNumber);
    extra.push({ nombre: "Huevo misterioso", tabla: "huevoMisterio", pos: n.MysteryEggOffset, actual: campo[n.MysteryEggOffset], nivelActual: 1, soloBase: true, maximo: 255 });
  }
  (perfil.lis.StaticPokemonTrades || []).forEach((archivo, k) => {
    const t = narcs.intercambios.archivos[archivo];
    extra.push({
      nombre: k ? "Kenya" : "Shuckie", tabla: "regaloTrueque", archivo, script: perfil.lis.StaticPokemonTradeScripts[k],
      posNivel: perfil.lis.StaticPokemonTradeLevelOffsets[k], actual: u32(t, 0), nivelActual: 0, kenya: k === 1
    });
  });
  return extra.filter((e) => e.actual && e.actual <= ULTIMA_ESPECIE);
}

// Los errantes de Diamante y Perla (Mesprit y Cresselia): sus especies, en la función que los crea (Mesprit cargado de una
// palabra; Cresselia, como 0x7A << 2: se cambia para que la cargue de la palabra de Darkrai, que no se usa, como en UPR-ZX,
// applyDiamondPearlRoamerPatch), y en dos scripts (especie y género). Se busca la función por su forma
const ERRANTES_DP = { original: "324F32260AE07A27BF003226", hecho: "324F32260AE0324F00003226", desde: 0x24 };
const SCRIPTS_ERRANTES_DP = [{ especie: [[344, 0x1a], [344, 0x24]], genero: [344, 0x1c] }, { especie: [[274, 0x18], [274, 0x22]], genero: [274, 0x1a] }];

function erranteDP(arm9) {
  for (const [clave, ya] of [["original", false], ["hecho", true]]) {
    const i = buscar(arm9, ERRANTES_DP[clave]);
    if (i >= 0) return { inicio: i - ERRANTES_DP.desde, ya };
  }
  return null;
}

function escribirEstaticosExtra(rom, perfil, datos, arm9) {
  const n = perfil.num;
  const hgss = esHGSS(perfil.entrada);
  const nuevos = datos.estaticos.filter((e) => e.nueva !== undefined && e.nueva !== e.actual);
  const errantes = datos.estaticos.filter((e) => e.tabla === "erranteDP");
  if (errantes.some((e) => e.nueva !== undefined && e.nueva !== e.actual)) {
    const f = errantes[0];
    if (!f.ya) {
      poner32(arm9, f.inicio + 0xf4, 488);
      arm9.set([0x32, 0x4f, 0x00, 0x00], f.inicio + 42);
    }
    for (const e of errantes) {
      const especie = e.nueva !== undefined ? e.nueva : e.actual;
      poner32(arm9, e.inicio + (e.k ? 0xf4 : 0xf0), especie);
      const sc = SCRIPTS_ERRANTES_DP[e.k];
      for (const [archivo, pos] of sc.especie) poner16(datos.narcs.scripts.archivos[archivo], pos, especie);
      // Macho (sirve también para los que no tienen) salvo si solo hay hembras
      poner16(datos.narcs.scripts.archivos[sc.genero[0]], sc.genero[1], datos.especies[especie]?.genero === 254 ? 1 : 0);
    }
  }
  const fosiles = nuevos.filter((e) => e.tabla === "fosil");
  if (fosiles.length) {
    const tabla = hgss ? rom.leerOverlay(n.FossilTableOvlNumber) : arm9;
    for (const e of fosiles) poner16(tabla, e.pos, e.nueva);
    if (hgss) rom.escribirOverlay(n.FossilTableOvlNumber, tabla);
  }
  const huevo = nuevos.find((e) => e.tabla === "huevoMisterio");
  if (huevo) {
    const campo = rom.leerOverlay(n.FieldOvlNumber);
    campo[huevo.pos] = huevo.nueva;
    rom.escribirOverlay(n.FieldOvlNumber, campo);
  }
  for (const e of nuevos.filter((x) => x.tabla === "regaloTrueque")) {
    const t = datos.narcs.intercambios.archivos[e.archivo];
    poner32(t, 0, e.nueva);
    // Una habilidad que tenga (la del juego era la de la especie de antes)
    poner32(t, 0x1c, datos.especies[e.nueva]?.habilidades[0] || u32(t, 0x1c));
    if (t.length > 0x50) poner32(t, 0x50, 0);
  }
  // Los nombres que se leen: los premios del Casino y Kenya (a quien el cartero llama por su especie)
  const textos = nuevos.filter((e) => e.texto || e.kenya);
  if (textos.length) {
    const t = textosDe(rom);
    const nombres = t.leer(n.PokemonNamesTextOffset);
    for (const e of textos) {
      const [archivo, linea] = e.texto || [n.KenyaTextOffset, -1];
      const lineas = t.leer(archivo);
      const cambia = (k) => (lineas[k] = sustituir(lineas[k], nombres[e.actual], nombres[e.nueva]));
      if (linea >= 0) cambia(linea);
      else lineas.forEach((_, k) => cambia(k));
      t.poner(archivo, lineas);
    }
    rom.cambiar(perfil.archivos.Text, crearNarc(t.narc));
  }
  // Giratina en el Mundo Distorsión
  if (esPt(perfil.entrada) && datos.estaticos.some((e) => e.nueva !== undefined && e.nueva !== e.actual)) {
    const campo = rom.leerOverlay(n.FieldOvlNumber);
    const i = buscar(campo, MARCA_SUELO_DISTORSION);
    if (i >= 0 && campo[i + MARCA_SUELO_DISTORSION.length / 2 + 46] !== 0x30) {
      campo[i + MARCA_SUELO_DISTORSION.length / 2 + 46] = 0x30;
      rom.escribirOverlay(n.FieldOvlNumber, campo);
    }
  }
}

// Ultra, Super y Poké Ball; Poción, Antídoto, Antiquemar, Antihielo, Despertar, Antiparaliz, Restaurar Todo, Poción Máxima,
// Hiperpoción, Superpoción, Cura Total y Revivir; Superrepelente, Máximo Repelente, Cuerda Huida y Repelente
const OBJETOS_TIENDA_NORMAL = [2, 3, 4, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 76, 77, 78, 79];

// El perfil que usa randomizar.js (lo mismo que los de ./perfiles-gen5.js, con lo que cambia)
export function perfilDe(rom) {
  const entrada = entradaDe(rom);
  if (!entrada) return null;
  const tipo = esDP(entrada) ? "dp" : esPt(entrada) ? "pt" : "hgss";
  const fijos = tipo === "dp" ? DP : tipo === "pt" ? PT : HGSS;
  const num = entrada.numeros;
  const lis = entrada.listas;
  return {
    id: tipo, gen: 4, entrada,
    nombre: entrada.nombre,
    ultimaEspecie: ULTIMA_ESPECIE, ultimoAtaque: ULTIMO_ATAQUE, ultimaHabilidad: ULTIMA_HABILIDAD, ultimoObjeto: 464,
    preciosEnDecenas: false,
    // Los objetos que no existen en cada juego
    objetosInexistentes: tipo === "dp" ? (id) => id >= 112 && id <= 134 : () => false,
    lideres: fijos.lideres, rivales: fijos.rivales, grupos: fijos.grupos,
    sinDobles: [],
    amigos: fijos.amigos || [],
    // MT y MO: 92 MT y 8 MO, en el mismo sitio
    bitsMT: { tm: 92, hm: 8, extra: 0 },
    // Los tutores de ataques (Platino y HeartGold/SoulSilver): cuántos, y cuántos bytes de compatibilidad
    // por Pokémon. El último de HeartGold y SoulSilver (Golpe Cabeza) lo da un script: no se toca.
    tutores: tipo !== "dp",
    tutorInfo: tipo === "dp" ? null : { cuantos: num.MoveTutorCount, bytes: num.MoveTutorCompatBytesCount, fijos: tipo === "hgss" ? [num.MoveTutorCount - 1] : [] },
    claros: false,
    estaticos: entrada.estaticos.map((e) => ({ ...e })),
    estaticosFijos: [],
    // Unown no sale en la hierba: en DP y Pt solo existe con sus letras en las Ruinas Sosiego y en HG/SS no aparece hasta
    // resolver un puzle en las Ruinas Alfa
    sinSalvajes: [201],
    tiendas: {
      mt: [], normales: [], historia: lis.MainGameShops || [], primera: tipo === "dp" ? 1 : 0,
      // Lo que vende la Tienda Pokémon normal (va en otra tabla, por medallas): Balls, pociones, curas y repelentes
      objetosNormales: OBJETOS_TIENDA_NORMAL,
      saltar: lis.SkipShops || [], cuantas: num.ShopCount || 0
    },
    num, lis, textos: entrada.textos, archivos: entrada.archivos,
    // Las mentas, si en esta versión se pueden poner: por el suelo (las tiendas no tienen sitio para más)
    mentas: mentasYaPuestasGen4(rom) || mentasPosiblesGen4(rom) ? Array.from({ length: MENTAS_GEN4 }, (_, k) => PRIMERA_MENTA_WEB + k) : null,
    mentasEnSuelo: true
  };
}

// Las mentas en la ROM (si la versión lo permite: perfil.mentas)
export function ponerMentas(rom) {
  const perfil = perfilDe(rom);
  return ponerMentasGen4(rom, {
    tipo: perfil.id,
    rutas: { datos: perfil.archivos.ItemData, textos: perfil.archivos.Text },
    bancos: { nombres: perfil.num.ItemNamesTextOffset, descripciones: perfil.num.ItemDescriptionsTextOffset }
  }, { leerNarc, crearNarc, leerTextos4, escribirTextos4, aCodigos });
}

// ---------- Leer ----------

function leerEspecies(narcs) {
  const especies = [];
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const d = narcs.datos.archivos[id];
    const stats = [d[0], d[1], d[2], d[4], d[5], d[3]]; // PS, Ata, Def, AtE, DfE, Vel
    const total = stats.reduce((a, b) => a + b, 0);
    const e = narcs.evoluciones.archivos[id];
    const evoluciones = [];
    for (let k = 0; k < 7; k++) {
      const metodo = u16(e, k * 6);
      const especie = u16(e, k * 6 + 4);
      if (metodo && especie) evoluciones.push({ metodo: metodoAbstracto(metodo), dato: u16(e, k * 6 + 2), especie });
    }
    especies[id] = {
      id, stats, total, totalOriginal: total,
      tipos: [...new Set([TIPOS[d[6]], TIPOS[d[7]]])].filter(Boolean),
      habilidades: [d[22], d[23], 0],
      objetos: [u16(d, 12), u16(d, 14), 0],
      genero: d[16],
      mt: d.slice(28, 41),
      tutor: new Uint8Array(0),
      evoluciones,
      previa: 0
    };
  }
  for (const e of especies) if (e) for (const evo of e.evoluciones) if (especies[evo.especie]) especies[evo.especie].previa = e.id;
  return especies;
}

function leerAprende(narcs) {
  const aprende = [];
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const a = narcs.aprende.archivos[id];
    const lista = [];
    for (let i = 0; i + 1 < a.length; i += 2) {
      if (a[i] === 0xff && a[i + 1] === 0xff) break;
      lista.push([a[i] + ((a[i + 1] & 1) << 8), a[i + 1] >> 1]);
    }
    aprende[id] = lista;
  }
  return aprende;
}

// Los entrenadores de Platino y HeartGold/SoulSilver llevan 2 bytes más por Pokémon
function leerEntrenadores(narcs, importantes, relleno) {
  const entrenadores = [];
  for (let i = 1; i < narcs.entrenadores.archivos.length; i++) {
    const t = narcs.entrenadores.archivos[i];
    const p = narcs.equipos.archivos[i];
    const conAtaques = Boolean(t[0] & 1);
    const conObjetos = Boolean(t[0] & 2);
    const pokemon = [];
    let pos = 0;
    for (let k = 0; k < t[3]; k++) {
      const poke = {
        dificultad: p[pos], habilidad: p[pos + 1], nivel: u16(p, pos + 2),
        especie: p[pos + 4] + ((p[pos + 5] & 1) << 8), forma: p[pos + 5] >> 2, objeto: 0
      };
      pos += 6;
      if (conObjetos) {
        poke.objeto = u16(p, pos);
        pos += 2;
      }
      if (conAtaques) {
        poke.ataques = [0, 1, 2, 3].map((m) => u16(p, pos + m * 2));
        pos += 8;
      }
      if (relleno) {
        poke.relleno = u16(p, pos);
        pos += 2;
      }
      pokemon.push(poke);
    }
    entrenadores.push({ indice: i, clase: t[1], combate: t[16] ? 1 : 0, conAtaques, conObjetos, importante: importantes.has(i), pokemon });
  }
  return entrenadores;
}

// Los salvajes de Diamante, Perla y Platino (un archivo por zona):
//   0     probabilidad de la hierba (u32); 4: 12 huecos de [nivel u32, especie u32]
//   100   20 especies que sustituyen a otras según la hora, el rastreador, un enjambre o un juego de
//         GBA (u32; las 10 últimas, desde 148); su nivel es el del hueco de la hierba al que sustituyen
//   204   5 grupos de [probabilidad u32, 5 huecos de [nivel (mínimo << 8 | máximo) u32, especie u32]]:
//         surf, (relleno), caña vieja, buena y súper
const SUSTITUTOS_DE = [0, 1, 2, 3, 2, 3, 4, 5, 10, 11, 8, 9, 8, 9, 8, 9, 8, 9, 8, 9]; // dpptAlternateSlots
const posSustituto = (i) => 100 + i * 4 + (i >= 10 ? 24 : 0);

function leerSalvajesDPPt(narcs) {
  return narcs.salvajes.archivos.map((a, archivo) => {
    const zonas = [];
    if (u32(a, 0) !== 0) {
      const hierba = [];
      for (let i = 0; i < 12; i++) hierba.push({ especie: u32(a, 8 + i * 8), forma: 0, min: u32(a, 4 + i * 8), max: u32(a, 4 + i * 8) });
      zonas.push({ zona: "hierba", clase: "hierba", huecos: hierba });
      const otros = [];
      for (let i = 0; i < 20; i++) {
        const nivel = hierba[SUSTITUTOS_DE[i]].min;
        otros.push({ especie: u32(a, posSustituto(i)), forma: 0, min: nivel, max: nivel, sustituto: true });
      }
      zonas.push({ zona: "hierba-otros", clase: "sustitutos", huecos: otros });
    }
    for (let g = 0; g < 5; g++) {
      const base = 204 + g * 44;
      if (u32(a, base) === 0 || g === 1) continue;
      const huecos = [];
      for (let i = 0; i < 5; i++) {
        const nivel = u32(a, base + 4 + i * 8);
        huecos.push({ especie: u32(a, base + 8 + i * 8), forma: 0, min: nivel >> 8, max: nivel & 0xff });
      }
      zonas.push({ zona: `agua-${g}`, clase: "agua", grupo: g, huecos });
    }
    return { archivo, estaciones: [zonas] };
  });
}

function escribirSalvajesDPPt(narcs, salvajes) {
  for (const { archivo, estaciones } of salvajes) {
    const a = narcs.salvajes.archivos[archivo];
    let hierba = null;
    for (const z of estaciones[0]) {
      if (z.clase === "hierba") {
        hierba = z;
        z.huecos.forEach((h, i) => {
          poner32(a, 4 + i * 8, h.min);
          poner32(a, 8 + i * 8, h.especie);
        });
      } else if (z.clase === "sustitutos") {
        z.huecos.forEach((h, i) => poner32(a, posSustituto(i), h.especie));
      } else if (z.clase === "agua") {
        const base = 204 + z.grupo * 44;
        z.huecos.forEach((h, i) => {
          poner32(a, base + 4 + i * 8, (h.min << 8) | h.max);
          poner32(a, base + 8 + i * 8, h.especie);
        });
      }
    }
  }
}

// Los de HeartGold y SoulSilver (un archivo por zona):
//   0-5    probabilidades: hierba, surf, golpe roca, caña vieja, buena y súper (u8)
//   8      niveles de los 12 huecos de la hierba (u8; los mismos para las tres horas)
//   20     las 12 especies de la hierba por la mañana, 44 de día y 68 de noche (u16)
//   92     4 especies de la radio (de Hoenn y de Sinnoh) (u16)
//   100    surf (5), golpe roca (2), caña vieja (5), buena (5) y súper (5): de [nivel (mínimo | máximo << 8)
//          u16, especie u16]
//   188    2 especies de enjambre, 1 que sustituye a la de la caña de noche y 1 de enjambre de pesca (u16;
//          en 188, 190, 192 y 194)
// (Los de Golpe Cabeza y el concurso de bichos, más abajo: leerSalvajesExtra.)
const GRUPOS_AGUA_HGSS = [["surf", 5], ["golpe-roca", 2], ["vieja", 5], ["buena", 5], ["super", 5]];

function leerSalvajesHGSS(narcs) {
  return narcs.salvajes.archivos.map((a, archivo) => {
    const zonas = [];
    const niveles = Array.from({ length: 12 }, (_, i) => a[8 + i]);
    if (a[0] !== 0) {
      [20, 44, 68].forEach((base, hora) => {
        zonas.push({
          zona: `hierba-${hora}`, clase: "hierba", base,
          huecos: Array.from({ length: 12 }, (_, i) => ({ especie: u16(a, base + i * 2), forma: 0, min: niveles[i], max: niveles[i] }))
        });
      });
    }
    const solo = (base, cuantos) => Array.from({ length: cuantos }, (_, i) => ({ especie: u16(a, base + i * 2), forma: 0, min: 1, max: 1 }));
    if (solo(92, 4).some((h) => h.especie)) zonas.push({ zona: "radio", clase: "solo", base: 92, huecos: solo(92, 4) });
    let pos = 100;
    GRUPOS_AGUA_HGSS.forEach(([nombre, cuantos], g) => {
      const huecos = Array.from({ length: cuantos }, (_, i) => {
        const nivel = u16(a, pos + i * 4);
        return { especie: u16(a, pos + 2 + i * 4), forma: 0, min: nivel & 0xff, max: nivel >> 8 };
      });
      if (a[g + 1] !== 0) zonas.push({ zona: nombre, clase: "agua", base: pos, huecos });
      pos += cuantos * 4;
    });
    for (const [nombre, base, cuantos] of [["enjambre", pos, 2], ["noche-pesca", pos + 4, 1], ["enjambre-pesca", pos + 6, 1]]) {
      const huecos = solo(base, cuantos);
      if (huecos.some((h) => h.especie)) zonas.push({ zona: nombre, clase: "solo", base, huecos });
    }
    return { archivo, estaciones: [zonas] };
  });
}

function escribirSalvajesHGSS(narcs, salvajes) {
  for (const { archivo, estaciones } of salvajes) {
    const a = narcs.salvajes.archivos[archivo];
    let niveles = false;
    for (const z of estaciones[0]) {
      if (z.clase === "hierba") {
        z.huecos.forEach((h, i) => {
          poner16(a, z.base + i * 2, h.especie);
          if (!niveles) a[8 + i] = h.min;
        });
        niveles = true;
      } else if (z.clase === "solo") {
        z.huecos.forEach((h, i) => poner16(a, z.base + i * 2, h.especie));
      } else {
        z.huecos.forEach((h, i) => {
          poner16(a, z.base + i * 4, h.min | (h.max << 8));
          poner16(a, z.base + 2 + i * 4, h.especie);
        });
      }
    }
  }
}

// ---------- Los salvajes que no están en las tablas de cada zona ----------
//
// DP y Pt (ExtraEncounters, un NARC; u32 por especie): Feebas en el Monte Corona (archivo 0, 1), los árboles de miel
// (HoneyTreeOffsets, 6 cada uno), los del Jardín Trofeo que trae el señor de la mansión (archivo 8, 16) y los del Gran
// Pantano que cambian cada día (9 y 10, 32). Sus niveles: los de Feebas y la miel, en el overlay de los encuentros
// (detrás de estas marcas); los otros dos usan los de la hierba de su zona.
// HG/SS: Golpe Cabeza (HeadbuttPokemon, un archivo por mapa: 4 bytes y 18 huecos de [especie u16, nivel mín., máx.]; los de 4
// bytes no tienen, el 24 es una Ruta 16 sin usar) y el concurso de bichos (BCCWilds: 4 tandas de 10 huecos de 8 bytes,
// [especie u16, nivel mín., máx., ...], desde 0, 80, 160 y 240). Como en UPR-ZX (Gen4RomHandler).
const MARCA_NIVEL_FEEBAS = "019813B0F0BD";
const MARCA_NIVEL_MIEL = "F0BDF0B589B0051C0C1C";
const MAPA_SIN_USO_HGSS = 24;
const SAFARI_HGSS = "a/2/3/0";

function leerSalvajesExtra(rom, perfil) {
  const areas = [];
  const zona = (archivo, nombre, huecos, extra) => areas.push({ archivo, extra, estaciones: [[{ zona: nombre, clase: "extra", huecos }]] });
  if (esHGSS(perfil.entrada)) {
    const cabezas = leerNarc(rom.archivo(perfil.archivos.HeadbuttPokemon));
    cabezas.archivos.forEach((b, mapa) => {
      if (b.length <= 4 || mapa === MAPA_SIN_USO_HGSS) return;
      const huecos = [];
      for (let i = 0; i < 18 && 4 + i * 4 + 4 <= b.length; i++) {
        const p = 4 + i * 4;
        huecos.push({ especie: u16(b, p), forma: 0, min: b[p + 2], max: b[p + 3], vacio: !u16(b, p), pos: p });
      }
      if (huecos.some((h) => !h.vacio)) zona(`cabeza-${mapa}`, "golpe-cabeza", huecos, { tipo: "cabeza", mapa });
    });
    const bichos = rom.archivo(perfil.archivos.BCCWilds);
    [0, 80, 160, 240].forEach((desde, tanda) => {
      const huecos = Array.from({ length: 10 }, (_, i) => {
        const p = desde + i * 8;
        return { especie: u16(bichos, p), forma: 0, min: bichos[p + 2], max: bichos[p + 3], vacio: !u16(bichos, p), pos: p };
      });
      if (huecos.some((h) => !h.vacio)) zona(`bichos-${tanda}`, "concurso", huecos, { tipo: "bichos" });
    });
    // La Zona Safari (a/2/3/0, un archivo de 912 bytes por zona; como en pret/pokeheartgold, safari_enc): cuántos extra
    // lleva cada modo (hierba, surf y las tres cañas: 5 bytes y 3 de relleno); y en cada modo, 10 huecos por hora (mañana,
    // día y noche) de [especie u16, nivel u16], los extra (los que salen según los objetos puestos) de las tres horas y sus
    // condiciones (4 bytes cada uno). Ahí, nada que no deje huir (Sombratrampa, Trampa Arena)
    if (rom.rutas.has(SAFARI_HGSS)) {
      const safari = leerNarc(rom.archivo(SAFARI_HGSS));
      safari.archivos.forEach((b, n) => {
        const extra = [...b.subarray(0, 5)];
        let pos = 8;
        const huecos = [];
        for (const cuantos of extra) {
          for (let k = 0; k < 30 + cuantos * 3; k++, pos += 4) huecos.push({ especie: u16(b, pos), forma: 0, min: u16(b, pos + 2), max: u16(b, pos + 2), vacio: !u16(b, pos) || u16(b, pos) > ULTIMA_ESPECIE, pos });
          pos += cuantos * 4;
        }
        if (pos !== b.length) return; // (no es lo que se espera)
        zona(`safari-${n}`, "safari", huecos, { tipo: "safari", archivo: n });
        areas[areas.length - 1].prohibir = (e) => e.habilidades.some((h) => h === 23 || h === 71);
      });
    }
    return areas;
  }
  const narc = leerNarc(rom.archivo(perfil.archivos.ExtraEncounters));
  const overlay = rom.leerOverlay(perfil.num.EncounterOvlNumber);
  const lista = (archivo, cuantos, min, max) =>
    Array.from({ length: cuantos }, (_, i) => ({ especie: u32(narc.archivos[archivo], i * 4), forma: 0, min, max, vacio: !u32(narc.archivos[archivo], i * 4), pos: i * 4 }));
  const feebas = buscar(overlay, MARCA_NIVEL_FEEBAS);
  const nivelFeebas = feebas >= 0 ? [overlay[feebas + 6 + 4], overlay[feebas + 6]] : [0, 0];
  zona("feebas", "feebas", lista(0, 1, ...nivelFeebas), { tipo: "lista", archivo: 0, nivel: "feebas" });
  const miel = buscar(overlay, MARCA_NIVEL_MIEL);
  const m = miel + MARCA_NIVEL_MIEL.length / 2;
  // (si el código es el del juego, el mínimo es 5: va escrito de otra forma)
  const nivelMiel = miel >= 0 ? [overlay[m + 46] === 0x0b && overlay[m + 47] === 0x2e ? 5 : overlay[m + 46], overlay[m + 102]] : [0, 0];
  (perfil.lis.HoneyTreeOffsets || []).forEach((archivo, k) => zona(`miel-${k}`, "miel", lista(archivo, 6, ...nivelMiel), { tipo: "lista", archivo, nivel: "miel" }));
  zona("jardin-trofeo", "jardin-trofeo", lista(8, 16, 0, 0), { tipo: "lista", archivo: 8 });
  zona("gran-pantano-0", "gran-pantano", lista(9, 32, 0, 0), { tipo: "lista", archivo: 9 });
  zona("gran-pantano-1", "gran-pantano", lista(10, 32, 0, 0), { tipo: "lista", archivo: 10 });
  return areas;
}

function escribirSalvajesExtra(rom, perfil, areas) {
  if (!areas.length) return;
  if (esHGSS(perfil.entrada)) {
    const cabezas = leerNarc(rom.archivo(perfil.archivos.HeadbuttPokemon));
    const bichos = rom.archivo(perfil.archivos.BCCWilds);
    const safari = rom.rutas.has(SAFARI_HGSS) ? leerNarc(rom.archivo(SAFARI_HGSS)) : null;
    for (const a of areas) {
      if (a.extra.tipo === "safari") {
        const b = safari.archivos[a.extra.archivo];
        for (const h of a.estaciones[0][0].huecos) {
          if (h.vacio) continue;
          poner16(b, h.pos, h.especie);
          poner16(b, h.pos + 2, Math.max(1, Math.min(100, h.min)));
        }
        continue;
      }
      const b = a.extra.tipo === "cabeza" ? cabezas.archivos[a.extra.mapa] : bichos;
      for (const h of a.estaciones[0][0].huecos) {
        if (h.vacio) continue;
        poner16(b, h.pos, h.especie);
        b[h.pos + 2] = h.min;
        b[h.pos + 3] = Math.max(h.min, h.max);
      }
    }
    rom.cambiar(perfil.archivos.HeadbuttPokemon, crearNarc(cabezas));
    rom.cambiar(perfil.archivos.BCCWilds, bichos);
    if (safari) rom.cambiar(SAFARI_HGSS, crearNarc(safari));
    return;
  }
  const narc = leerNarc(rom.archivo(perfil.archivos.ExtraEncounters));
  const overlay = rom.leerOverlay(perfil.num.EncounterOvlNumber);
  const antes = overlay.slice();
  for (const a of areas) {
    const huecos = a.estaciones[0][0].huecos;
    // En el Jardín Trofeo, si todos fueran el mismo, el juego se queda colgado
    if (a.archivo === "jardin-trofeo" && huecos.every((h) => h.especie === huecos[0].especie)) huecos[0].especie = huecos[0].especie === 1 ? 4 : 1;
    for (const h of huecos) if (!h.vacio) poner32(narc.archivos[a.extra.archivo], h.pos, h.especie);
  }
  const primero = (nivel) => areas.find((a) => a.extra.nivel === nivel)?.estaciones[0][0].huecos[0];
  const feebas = primero("feebas");
  const i = buscar(overlay, MARCA_NIVEL_FEEBAS);
  if (feebas && i >= 0) {
    overlay[i + 6] = Math.max(feebas.min, feebas.max);
    overlay[i + 6 + 4] = feebas.min;
  }
  // La miel: el mismo cambio que UPR-ZX (el mínimo, con un «mov»; y el divisor que da el nivel al azar, para el nuevo margen)
  const miel = primero("miel");
  const j = buscar(overlay, MARCA_NIVEL_MIEL);
  if (miel && j >= 0) {
    const m = j + MARCA_NIVEL_MIEL.length / 2;
    const original = [overlay[m + 46] === 0x0b && overlay[m + 47] === 0x2e ? 5 : overlay[m + 46], overlay[m + 102]];
    const max = Math.max(miel.min, miel.max);
    if (miel.min !== original[0] || max !== original[1]) {
      overlay.set([miel.min, 0x20, 0, 0, 0, 0, 0, 0, 0x80, 0x19], m + 46);
      overlay[m + 102] = max;
      poner32(overlay, m + 148, Math.floor(0xffff / (max - miel.min + 1)) + 1);
    }
  }
  rom.cambiar(perfil.archivos.ExtraEncounters, crearNarc(narc));
  if (overlay.some((v, k) => v !== antes[k])) rom.escribirOverlay(perfil.num.EncounterOvlNumber, overlay);
}

// Los objetos del suelo: una lista de punteros (relativos) a trozos de script que empiezan por
// «fijar variable, objeto». Los escondidos, en una tabla del programa principal (8 bytes cada uno).
const FIN_LISTA_SCRIPTS = 0xfd13;
const VARIABLE_OBJETO = 0x8008;

function leerObjetosSuelo(narcs, perfil, arm9) {
  const lista = [];
  const orden = esHGSS(perfil.entrada) ? 0x29 : 0x28;
  const archivo = perfil.num.ItemBallsScriptOffset;
  const s = narcs.scripts.archivos[archivo];
  const saltar = perfil.lis.ItemBallsSkip || [];
  const vista = new DataView(s.buffer, s.byteOffset, s.byteLength);
  for (let pos = 0, n = 0; pos + 4 <= s.length && u16(s, pos) !== FIN_LISTA_SCRIPTS; pos += 4, n++) {
    if (saltar.includes(n)) continue;
    const destino = pos + 4 + vista.getInt32(pos, true);
    if (destino < 0 || destino + 6 > s.length) break;
    if (u16(s, destino) === orden && u16(s, destino + 2) === VARIABLE_OBJETO) lista.push({ archivo, pos: destino + 4, objeto: u16(s, destino + 4) });
  }
  const tabla = perfil.num.HiddenItemTableOffset;
  for (let i = 0; i < perfil.num.HiddenItemCount; i++) lista.push({ arm9: true, pos: tabla + i * 8, objeto: u16(arm9, tabla + i * 8) });
  return lista;
}

// Las tiendas: en el programa principal, detrás de un prefijo, una lista de u16 por tienda (acaba en
// 0xFFFF). Algunas no se tocan («SkipShops»).
function buscar(bytes, hex) {
  const patron = hex.match(/../g).map((x) => parseInt(x, 16));
  let sitio = -1;
  for (let i = 0; i + patron.length <= bytes.length; i++) {
    if (bytes[i] !== patron[0] || !patron.every((b, k) => bytes[i + k] === b)) continue;
    if (sitio >= 0) return -1;
    sitio = i;
  }
  return sitio;
}

function leerTiendas(perfil, arm9) {
  const prefijo = perfil.textos.ShopDataPrefix;
  const inicio = buscar(arm9, prefijo);
  if (inicio < 0) return [];
  let pos = inicio + prefijo.length / 2;
  const tiendas = [];
  for (let i = 0; i < perfil.tiendas.cuantas; i++) {
    const huecos = [];
    const objetos = [];
    for (; u16(arm9, pos) !== 0xffff; pos += 2) {
      if (u16(arm9, pos) !== 0) {
        huecos.push(pos);
        objetos.push(u16(arm9, pos));
      }
    }
    pos += 2;
    // Las que se saltan, vacías (no se tocan)
    tiendas.push({ indice: i, objetos: perfil.tiendas.saltar.includes(i) ? [] : objetos, huecos: perfil.tiendas.saltar.includes(i) ? [] : huecos });
  }
  return tiendas;
}

// La compatibilidad con los tutores: en Platino, en un overlay; en HeartGold y SoulSilver, en un archivo
function archivoDeCompatTutores(rom, perfil) {
  return esHGSS(perfil.entrada) ? rom.archivo(perfil.archivos.MoveTutorCompat) : rom.leerOverlay(perfil.num.MoveTutorCompatOvlNumber);
}

function guardarCompatTutores(rom, perfil, bytes) {
  if (esHGSS(perfil.entrada)) rom.cambiar(perfil.archivos.MoveTutorCompat, bytes);
  else rom.escribirOverlay(perfil.num.MoveTutorCompatOvlNumber, bytes);
}

export function leerBW2(rom) {
  const perfil = perfilDe(rom);
  if (!perfil) throw new Error("Esta ROM no es de ningún juego de 4.ª generación que se sepa randomizar.");
  const a = perfil.archivos;
  const rutas = {
    datos: a.PokemonStats, aprende: a.PokemonMovesets, evoluciones: a.PokemonEvolutions, ataques: a.MoveData, objetos: a.ItemData,
    entrenadores: a.TrainerData, equipos: a.TrainerPokemon, salvajes: a.WildPokemon, intercambios: a.InGameTrades, scripts: a.Scripts
  };
  perfil.rutas = rutas;
  const narcs = Object.fromEntries(Object.entries(rutas).filter(([, r]) => r).map(([nombre, ruta]) => [nombre, leerNarc(rom.archivo(ruta))]));
  const arm9 = rom.leerArm9();

  const ataques = narcs.ataques.archivos.map((d, id) =>
    id && id <= ULTIMO_ATAQUE ? { id, tipo: TIPOS[d[4]], categoria: d[2], potencia: d[3], precision: d[5], pp: d[6] } : null
  );

  const huevos = perfil.lis.StaticEggPokemonOffsets || [];
  const estaticos = perfil.estaticos.map((e, i) => {
    const [archivo, pos] = e.especie[0];
    const nivel = e.nivel[0] ? narcs.scripts.archivos[e.nivel[0][0]][e.nivel[0][1]] : 0;
    // (los huevos que se regalan, de una que no venga de otra)
    return { ...e, actual: u16(narcs.scripts.archivos[archivo], pos), nivelActual: nivel, soloBase: /egg/i.test(e.nombre || "") };
  });
  estaticos.push(...estaticosExtra(rom, perfil, narcs, arm9));
  const regalos = new Set(perfil.lis.StaticPokemonTrades || []);

  const intercambios = narcs.intercambios.archivos
    .map((t, archivo) => ({
      archivo, da: u32(t, 0), pide: u32(t, 0x4c), objeto: u32(t, 0x3c), daOriginal: u32(t, 0), pideOriginal: u32(t, 0x4c),
      ivs: [0, 1, 2, 3, 4, 5].map((k) => u32(t, 4 + k * 4))
    }))
    .filter((t) => t.da && t.da <= ULTIMA_ESPECIE && !regalos.has(t.archivo));

  // Las iniciales: tres u16, cada 4 bytes, en el overlay de las iniciales (Diamante, Perla, Platino)
  // (en HeartGold y SoulSilver, en el programa principal, detrás de una marca)
  let iniciales;
  if (esHGSS(perfil.entrada)) {
    const colas = todas(arm9, FINAL_INICIALES_HGSS);
    iniciales = colas.length === 1 ? [0, 1, 2].map((i) => u16(arm9, colas[0] - 13 + i * 4)) : [152, 155, 158];
  } else {
    const overlay = rom.leerOverlay(perfil.num.StarterPokemonOvlNumber);
    iniciales = [0, 1, 2].map((i) => u16(overlay, perfil.num.StarterPokemonOffset + i * 4));
  }

  const precios = narcs.objetos.archivos.map((o) => (o.length >= 2 ? u16(o, 0) : 0));
  const tiendas = leerTiendas(perfil, arm9);

  const especies = leerEspecies(narcs);
  if (perfil.tutores) {
    const compat = archivoDeCompatTutores(rom, perfil);
    const { bytes } = perfil.tutorInfo;
    const base = esHGSS(perfil.entrada) ? 0 : perfil.num.MoveTutorCompatOffset;
    for (let id = 1; id <= ULTIMA_ESPECIE; id++) especies[id].tutor = compat.slice(base + (id - 1) * bytes, base + id * bytes);
  }
  const relleno = !esDP(perfil.entrada);
  const importantes = new Set([...perfil.lideres, ...perfil.rivales]);
  const entrenadores = leerEntrenadores(narcs, importantes, relleno);
  // Los que no pasan a combate doble: los amigos que combaten a tu lado y los rivales con uno o dos Pokémon (los de
  // los primeros combates, cuando solo llevas uno o dos)
  const rivales = new Set(perfil.rivales);
  perfil.sinDobles = entrenadores.filter((t) => perfil.amigos.includes(t.indice) || (rivales.has(t.indice) && t.pokemon.length <= 2)).map((t) => t.indice);
  return {
    perfil,
    narcs,
    especies,
    aprende: leerAprende(narcs),
    ataques,
    salvajes: [...(esHGSS(perfil.entrada) ? leerSalvajesHGSS(narcs) : leerSalvajesDPPt(narcs)), ...leerSalvajesExtra(rom, perfil)],
    entrenadores,
    iniciales,
    inicialesOriginales: iniciales.slice(),
    estaticos,
    intercambios,
    objetosSuelo: leerObjetosSuelo(narcs, perfil, arm9),
    tiendas,
    precios,
    claros: { narc: null, huecos: [] }
  };
}

// ---------- Escribir ----------

function escribirEspecies(narcs, especies) {
  for (const e of especies) {
    if (!e) continue;
    const d = narcs.datos.archivos[e.id];
    [0, 1, 2, 4, 5, 3].forEach((pos, k) => (d[pos] = e.stats[k]));
    d[6] = numeroDeTipo(e.tipos[0]);
    d[7] = numeroDeTipo(e.tipos[1] || e.tipos[0]);
    d[22] = e.habilidades[0];
    d[23] = e.habilidades[1];
    poner16(d, 12, e.objetos[0]);
    poner16(d, 14, e.objetos[1]);
    d.set(e.mt, 28);
    const v = narcs.evoluciones.archivos[e.id];
    for (let k = 0; k < 7; k++) {
      const evo = e.evoluciones[k];
      poner16(v, k * 6, evo ? metodoDelJuego(evo.metodo) : 0);
      poner16(v, k * 6 + 2, evo ? evo.dato : 0);
      poner16(v, k * 6 + 4, evo ? evo.especie : 0);
    }
  }
}

function escribirAprende(narcs, aprende) {
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const lista = aprende[id] || [];
    let tam = lista.length * 2 + 2;
    if (tam % 4) tam += 2;
    const a = new Uint8Array(tam);
    lista.forEach(([ataque, nivel], k) => {
      a[k * 2] = ataque & 0xff;
      a[k * 2 + 1] = (nivel << 1) | (ataque > 255 ? 1 : 0);
    });
    a[lista.length * 2] = 0xff;
    a[lista.length * 2 + 1] = 0xff;
    narcs.aprende.archivos[id] = a;
  }
}

function escribirEntrenadores(narcs, entrenadores, relleno) {
  for (const t of entrenadores) {
    const cabecera = narcs.entrenadores.archivos[t.indice];
    cabecera[0] = (cabecera[0] & ~3) | (t.conAtaques ? 1 : 0) | (t.conObjetos ? 2 : 0);
    cabecera[3] = t.pokemon.length;
    // Combate doble: 2 es el de una pareja de entrenadores y 3, el de uno solo que pasa a doble (ver ponerCombatesDobles)
    if ((cabecera[16] ? 1 : 0) !== t.combate) cabecera[16] = t.combate ? 3 : 0;
    const tam = 6 + (t.conObjetos ? 2 : 0) + (t.conAtaques ? 8 : 0) + (relleno ? 2 : 0);
    const p = new Uint8Array(tam * t.pokemon.length);
    let pos = 0;
    for (const poke of t.pokemon) {
      p[pos] = poke.dificultad;
      p[pos + 1] = poke.habilidad;
      poner16(p, pos + 2, poke.nivel);
      p[pos + 4] = poke.especie & 0xff;
      p[pos + 5] = ((poke.especie >> 8) & 1) | (poke.forma << 2);
      pos += 6;
      if (t.conObjetos) {
        poner16(p, pos, poke.objeto || 0);
        pos += 2;
      }
      if (t.conAtaques) {
        (poke.ataques || [0, 0, 0, 0]).forEach((m, k) => poner16(p, pos + k * 2, m));
        pos += 8;
      }
      if (relleno) {
        poner16(p, pos, poke.relleno || 0);
        pos += 2;
      }
    }
    // Los archivos de un NARC van alineados a 4 bytes: si solo cambia ese relleno, se deja igual
    const viejo = narcs.equipos.archivos[t.indice];
    if (viejo.length === Math.ceil(p.length / 4) * 4 && p.every((x, i) => x === viejo[i])) continue;
    narcs.equipos.archivos[t.indice] = p;
  }
}

export function escribirBW2(rom, datos) {
  const { narcs, perfil } = datos;
  // El programa principal y el overlay de las iniciales, tal como están ahora (otras partes
  // pueden haberlos cambiado ya)
  const arm9 = rom.leerArm9();
  const arm9Antes = arm9.slice();
  escribirEspecies(narcs, datos.especies);
  escribirAprende(narcs, datos.aprende);
  const deZonas = datos.salvajes.filter((a) => !a.extra);
  if (esHGSS(perfil.entrada)) escribirSalvajesHGSS(narcs, deZonas);
  else escribirSalvajesDPPt(narcs, deZonas);
  escribirSalvajesExtra(rom, perfil, datos.salvajes.filter((a) => a.extra));
  escribirEntrenadores(narcs, datos.entrenadores, !esDP(perfil.entrada));

  for (const a of datos.ataques) {
    if (!a) continue;
    const d = narcs.ataques.archivos[a.id];
    d[2] = a.categoria;
    d[3] = a.potencia;
    d[4] = numeroDeTipo(a.tipo);
    d[5] = Math.max(0, Math.min(100, a.precision));
    d[6] = a.pp;
  }

  // Iniciales: el overlay (Diamante, Perla y Platino) o el programa principal (HeartGold y SoulSilver),
  // y los scripts del rival y los amigos
  let overlayIniciales = null;
  if (datos.iniciales.some((id, i) => id !== datos.inicialesOriginales[i])) {
    datos.inicialesCambian = true;
    if (!esHGSS(perfil.entrada)) {
      overlayIniciales = rom.leerOverlay(perfil.num.StarterPokemonOvlNumber);
      datos.iniciales.forEach((id, i) => poner16(overlayIniciales, perfil.num.StarterPokemonOffset + i * 4, id));
    }
    cambiarScriptsIniciales(rom, perfil, narcs, arm9, datos.iniciales);
  }

  // Estáticos: la especie en todos sus sitios (y la forma a 0)
  for (const e of datos.estaticos) {
    if (e.nueva === undefined) continue;
    if (e.tabla) continue; // (fósiles, huevo misterioso, Kenya y Shuckie: en escribirEstaticosExtra)
    for (const [archivo, pos] of e.especie) poner16(narcs.scripts.archivos[archivo], pos, e.nueva);
    for (const [archivo, pos] of e.forma) narcs.scripts.archivos[archivo][pos] = 0;
  }
  escribirEstaticosExtra(rom, perfil, datos, arm9);

  // Intercambios
  for (const t of datos.intercambios) {
    const a = narcs.intercambios.archivos[t.archivo];
    if (t.da !== t.daOriginal) {
      poner32(a, 0, t.da);
      if (a.length > 0x50) poner32(a, 0x50, 0); // sin género fijo (el de antes puede no existir en la nueva)
    }
    t.ivs.forEach((iv, k) => poner32(a, 4 + k * 4, iv));
    poner32(a, 0x3c, t.objeto);
    if (t.pide !== t.pideOriginal) poner32(a, 0x4c, t.pide);
  }

  for (const o of datos.objetosSuelo) {
    if (o.arm9) poner16(arm9, o.pos, objetoAlJuego(o.objeto));
    else poner16(narcs.scripts.archivos[o.archivo], o.pos, objetoAlJuego(o.objeto));
  }

  for (const t of datos.tiendas) t.huecos.forEach((pos, k) => poner16(arm9, pos, t.objetos[k]));

  datos.precios.forEach((precio, id) => {
    const o = narcs.objetos.archivos[id];
    if (o && o.length >= 2) poner16(o, 0, precio);
  });

  // Compatibilidad con los tutores (fuera de los datos de los Pokémon)
  if (perfil.tutores) {
    const compat = archivoDeCompatTutores(rom, perfil);
    const { bytes } = perfil.tutorInfo;
    const base = esHGSS(perfil.entrada) ? 0 : perfil.num.MoveTutorCompatOffset;
    const antes = compat.slice();
    for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
      const e = datos.especies[id];
      if (e.tutor && e.tutor.length === bytes) compat.set(e.tutor, base + (id - 1) * bytes);
    }
    if (compat.some((b, i) => b !== antes[i])) guardarCompatTutores(rom, perfil, compat);
  }

  for (const [nombre, ruta] of Object.entries(perfil.rutas)) {
    if (!ruta) continue;
    const nuevo = crearNarc(narcs[nombre]);
    const viejo = rom.archivo(ruta);
    if (nuevo.length !== viejo.length || nuevo.some((b, i) => b !== viejo[i])) rom.cambiar(ruta, nuevo);
  }
  if (overlayIniciales && datos.inicialesCambian) rom.escribirOverlay(perfil.num.StarterPokemonOvlNumber, overlayIniciales);
  if (arm9.some((b, i) => b !== arm9Antes[i])) rom.escribirArm9(arm9);
}

// ---------- MT y MO ----------
//
// Las 92 MT y las 8 MO: una lista de u16 en el programa principal, detrás de un prefijo. El color
// del disco de cada MT (en Diamante, Perla, Platino y HG/SS, un trozo de tabla: 8 bytes por MT,
// con la paleta en el segundo u16).
const PREFIJO_MT = { dp: "d100d200d300d400", pt: "d100d200d300d400", hgss: "1e003200" };
const PREFIJO_PALETAS = { dp: "8d018e01210132018d018f0122013301", pt: "8d018e01210133018d018f0122013401", hgss: "8d018e01210133018d018f0122013401" };
const PALETA_DE_TIPO = {
  fighting: 398, dragon: 399, water: 400, psychic: 401, normal: 402, poison: 403, ice: 404, grass: 405, fire: 406,
  dark: 407, steel: 408, electric: 409, ground: 410, ghost: 411, rock: 412, flying: 413, bug: 610
};

function buscarPrimero(bytes, hex) {
  const patron = hex.match(/../g).map((x) => parseInt(x, 16));
  for (let i = 0; i + patron.length <= bytes.length; i++) {
    if (bytes[i] === patron[0] && patron.every((b, k) => bytes[i + k] === b)) return i;
  }
  return -1;
}

export function leerMovimientos(rom) {
  const perfil = perfilDe(rom);
  const arm9 = rom.leerArm9();
  const prefijo = PREFIJO_MT[perfil.id];
  const inicio = buscarPrimero(arm9, prefijo);
  if (inicio < 0) throw new Error("No se han encontrado las MT.");
  const marca = inicio + prefijo.length / 2;
  const lista = (desde, cuantos) => Array.from({ length: cuantos }, (_, k) => u16(arm9, desde + k * 2));
  const m = { arm9, overlay: null, marca, sitio: -1, mt: lista(marca, 92), mo: lista(marca + 92 * 2, 8), tutor: [], tutorFijos: [], cambiados: false };
  if (perfil.tutores) {
    // Los ataques de los tutores: u16 en el overlay del campo (cada 12 bytes en Platino, cada 4 en HG/SS)
    const campo = rom.leerOverlay(perfil.num.FieldOvlNumber);
    const salto = perfil.num.MoveTutorBytesCount;
    m.tutor = Array.from({ length: perfil.tutorInfo.cuantos }, (_, k) => u16(campo, perfil.num.MoveTutorMovesOffset + k * salto));
    m.tutorFijos = perfil.tutorInfo.fijos;
  }
  return m;
}

export function escribirMovimientos(rom, m, ataques) {
  const perfil = perfilDe(rom);
  const paletas = buscarPrimero(m.arm9, PREFIJO_PALETAS[perfil.id]);
  if (paletas >= 0) {
    m.mt.forEach((id, k) => {
      const tipo = ataques[id] && ataques[id].tipo;
      poner16(m.arm9, paletas + k * 8 + 2, PALETA_DE_TIPO[tipo] || PALETA_DE_TIPO.ghost);
    });
  }
  m.mt.forEach((id, k) => poner16(m.arm9, m.marca + k * 2, id));
  rom.escribirArm9(m.arm9);
  if (perfil.tutores && m.tutor.length) {
    const campo = rom.leerOverlay(perfil.num.FieldOvlNumber);
    const salto = perfil.num.MoveTutorBytesCount;
    m.tutor.forEach((id, k) => poner16(campo, perfil.num.MoveTutorMovesOffset + k * salto, id));
    rom.escribirOverlay(perfil.num.FieldOvlNumber, campo);
  }
}

// ---------- Las iniciales: sus scripts y su pantalla ----------
//
// En Diamante, Perla y Platino van en el overlay de las iniciales (ya escrito en escribirBW2) y el
// rival y los amigos las llevan en scripts (donde se busca «las dos iniciales» por su forma). En HeartGold
// y SoulSilver, tres u16 en el programa principal (se busca por lo que hay detrás). Todo, como
// UPR-ZX (Gen4RomHandler.setStarters).

const DP_RIVAL = { archivos: [34, 90, 118, 180, 195, 394], tag: [2, 131, 230] };
const PT_RIVAL = { archivos: [31, 36, 112, 123, 186, 427, 429, 1096], tag: [2, 136, 201, 236] };
const HGSS_RIVAL = [7, 23, 96, 110, 819, 850, 866];
const MAGIA_RIVAL_DPPT = [0xde, 0x00, 0x0c, 0x80, 0x11, 0x00, 0x0c, 0x80, 0x83, 0x01, 0x1c, 0x00, 0x01];
const MAGIA_TAG_1 = [0xde, 0x00, 0x0c, 0x80, 0x28, 0x00, 0x04, 0x80];
const MAGIA_TAG_2 = [0x11, 0x00, 0x0c, 0x80, 0x86, 0x01, 0x1c, 0x00, 0x01];
const MAGIA_RIVAL_HGSS = [0xce, 0x00, 0x0c, 0x80, 0x11, 0x00, 0x0c, 0x80, 152, 0, 0x1c, 0x00, 0x05];
const FINAL_INICIALES_HGSS = [0x03, 0x03, 0x1a, 0x12, 0x01, 0x23, 0x00, 0x00];
const TURTWIG = 387;
const CYNDAQUIL = 155;

function todas(bytes, patron) {
  const sitios = [];
  for (let i = 0; i + patron.length <= bytes.length; i++) {
    if (bytes[i] === patron[0] && patron.every((b, k) => bytes[i + k] === b)) sitios.push(i);
  }
  return sitios;
}
const i32 = (b, i) => u32(b, i) | 0;

// Lo que cambia en los scripts y el programa principal al cambiar las iniciales (nuevas: 3 especies)
function cambiarScriptsIniciales(rom, perfil, narcs, arm9, nuevas) {
  const scripts = narcs.scripts.archivos;
  if (esHGSS(perfil.entrada)) {
    const colas = todas(arm9, FINAL_INICIALES_HGSS);
    if (colas.length !== 1) return;
    const inicio = colas[0] - 13;
    nuevas.forEach((id, i) => poner16(arm9, inicio + i * 4, id));
    for (const archivo of HGSS_RIVAL) {
      const f = scripts[archivo];
      const sitios = todas(f, MAGIA_RIVAL_HGSS);
      if (sitios.length !== 1) continue;
      const base = sitios[0];
      poner16(f, base + 8, nuevas[0]);
      const segunda = i32(f, base + 13) + base + 17;
      if (f[segunda] === 0x11 && f[segunda + 4] === CYNDAQUIL) poner16(f, segunda + 4, nuevas[1]);
    }
    return;
  }
  const rival = esPt(perfil.entrada) ? PT_RIVAL : DP_RIVAL;
  for (const archivo of rival.archivos) {
    const f = scripts[archivo];
    for (const base of todas(f, MAGIA_RIVAL_DPPT)) {
      const salto = base + MAGIA_RIVAL_DPPT.length;
      const destino = i32(f, salto) + salto + 4;
      const orden = u16(f, destino);
      if (orden !== 0xe5 && orden !== 0x28f && !(orden === 0x125 && esPt(perfil.entrada))) continue;
      poner16(f, base + 0x8, nuevas[0]);
      poner16(f, base + 0x15, nuevas[1]);
    }
  }
  // Los combates con el rival o un amigo a tu lado
  for (const archivo of rival.tag) {
    const f = scripts[archivo];
    for (const base of todas(f, MAGIA_TAG_1)) {
      const segunda = base + MAGIA_TAG_1.length + 2;
      if (segunda + MAGIA_TAG_2.length > f.length || !MAGIA_TAG_2.every((b, k) => f[segunda + k] === b)) continue;
      const salto = segunda + MAGIA_TAG_2.length;
      if (u16(f, i32(f, salto) + salto + 4) !== 0x1b) continue;
      poner16(f, base + 0x21, u16(f, base + 0x21) === TURTWIG ? nuevas[0] : nuevas[2]);
      poner16(f, base + 0xe, nuevas[1]);
    }
  }
}

// Cómo se ven al elegir (Diamante, Perla y Platino): la subrutina que carga los dibujos usa un
// número fijo; se reescribe (el truco de UPR-ZX) para que use cualquiera. En HeartGold y SoulSilver,
// el grito.
const GRITOS_HGSS = "0004000c10bd0000000000000000000000e000000000000000e0000000000200";

export function ponerAspectoIniciales(rom, iniciales) {
  const perfil = perfilDe(rom);
  const overlay = rom.leerOverlay(perfil.num.StarterPokemonOvlNumber);
  if (esHGSS(perfil.entrada)) {
    let sitio = buscarPrimero(overlay, GRITOS_HGSS);
    if (sitio < 0) return;
    sitio += GRITOS_HGSS.length / 2;
    iniciales.forEach((id, i) => poner32(overlay, sitio + i * 4, id));
    rom.escribirOverlay(perfil.num.StarterPokemonOvlNumber, overlay);
    return;
  }
  const prefijo = perfil.textos.StarterPokemonGraphicsPrefix;
  let o = buscarPrimero(overlay, prefijo);
  if (o < 0) return;
  o += prefijo.length / 2;
  const palabra = (i) => u16(overlay, i);
  poner16(overlay, o + 0xc, palabra(o + 0xa));
  if (o % 4 === 0) overlay[o + 0xc] = (overlay[o + 0xc] - 1) & 0xff;
  poner16(overlay, o + 0xa, palabra(o + 0x8));
  overlay[o + 0xa] = (overlay[o + 0xa] - 1) & 0xff;
  poner16(overlay, o + 0x8, palabra(o + 0x6));
  poner16(overlay, o + 0x6, palabra(o + 0x4));
  poner16(overlay, o + 0x4, palabra(o + 0x2));
  poner16(overlay, o + 0x2, 0x6828);
  poner16(overlay, o, 0x182d);
  o += 0x16;
  poner16(overlay, o, 0x6828);
  o += 0xa;
  iniciales.forEach((id, i) => {
    let diferencia = id - 4 * (i + 1);
    let instr1 = 0x3200;
    let instr2 = 0x3200;
    if (diferencia < 0) {
      instr1 |= 0x800;
      diferencia = Math.abs(diferencia);
    } else if (diferencia > 255) {
      instr2 |= 0xff;
      diferencia -= 255;
    }
    instr1 |= diferencia & 0xff;
    overlay[o] = 4 * (i + 1);
    poner16(overlay, o + 2, palabra(o + 4));
    poner16(overlay, o + 4, instr1);
    poner16(overlay, o + 8, instr2);
    o += 0xe;
  });
  overlay[o] = 1;
  const interior = buscarPrimero(overlay, perfil.textos.StarterPokemonGraphicsPrefixInner);
  if (interior >= 0) overlay[interior + perfil.textos.StarterPokemonGraphicsPrefixInner.length / 2 + 1] = 0x68;
  rom.escribirOverlay(perfil.num.StarterPokemonOvlNumber, overlay);
}

// ---------- Textos ----------
//
// Lo que se cambia para que lo que se lee cuadre con lo randomizado:
//   · la descripción de cada MT (la del ataque nuevo, ajustada al ancho de las de los objetos)
//   · lo que dice la pantalla de elegir inicial (el nombre y la especie de cada una)
//   · los nombres de los Pokémon en lo que dicen los de los intercambios
//   · los nombres de los entrenadores y de sus clases
// Los nombres de los Pokémon van en mayúsculas en estos textos (como en la lista de nombres).

const MT01 = 328; // el primer objeto de las MT
const CARACTERES_POR_LINEA = { dp: 38, pt: 38, hgss: 36 };

function textosDe(rom) {
  const perfil = perfilDe(rom);
  const narc = leerNarc(rom.archivo(perfil.archivos.Text));
  return { perfil, narc, leer: (n) => leerTextos4(narc.archivos[n]).entradas, poner: (n, entradas) => (narc.archivos[n] = escribirTextos4(narc.archivos[n], entradas)) };
}

export function nombresPokemon(rom) {
  const { perfil, leer } = textosDe(rom);
  return leer(perfil.num.PokemonNamesTextOffset).map(deCodigos);
}

export function leerNombresEntrenadores(rom) {
  const { perfil, leer } = textosDe(rom);
  return { nombres: leer(perfil.num.TrainerNamesTextOffset), clases: leer(perfil.num.TrainerClassesTextOffset) };
}

// Un texto en líneas de como mucho «ancho» caracteres (palabras enteras)
function ajustar(texto, ancho) {
  const lineas = [];
  let linea = "";
  for (const palabra of texto.replace(/\s+/g, " ").trim().split(" ")) {
    if (linea && linea.length + 1 + palabra.length > ancho) {
      lineas.push(linea);
      linea = palabra;
    } else linea = linea ? `${linea} ${palabra}` : palabra;
  }
  if (linea) lineas.push(linea);
  return lineas.join("\n");
}

const sustituir = (texto, de, a) => texto.split(de).join(a);

// cambios: { mt (los 92 ataques nuevos), iniciales: [{ especie }] (las nuevas), inicialesAntes (las de
// antes), intercambios: Map (nombre viejo -> nuevo), entrenadores: { nombres, clases } }
export function actualizarTextos(rom, { mt, iniciales, intercambios, entrenadores }) {
  const { perfil, narc, leer, poner } = textosDe(rom);
  let cambia = false;

  if (mt) {
    const descripciones = leer(perfil.num.ItemDescriptionsTextOffset);
    const deAtaques = leer(perfil.num.MoveDescriptionsTextOffset);
    mt.forEach((id, k) => {
      if (deAtaques[id] !== undefined) descripciones[MT01 + k] = aCodigos(ajustar(deCodigos(deAtaques[id]), CARACTERES_POR_LINEA[perfil.id]));
    });
    poner(perfil.num.ItemDescriptionsTextOffset, descripciones);
    cambia = true;
  }

  if (entrenadores) {
    poner(perfil.num.TrainerNamesTextOffset, entrenadores.nombres);
    poner(perfil.num.TrainerClassesTextOffset, entrenadores.clases);
    cambia = true;
  }

  if (iniciales) {
    const nombres = leer(perfil.num.PokemonNamesTextOffset);
    const { antes, ahora } = iniciales;
    if (esHGSS(perfil.entrada)) {
      // «Elm: ¿Quieres a X, el Pokémon de tipo Planta?»: el nombre y el tipo de cada una (el de las
      // de antes: Planta, Fuego y Agua; en español)
      const lineas = leer(perfil.num.StarterScreenTextOffset);
      const TIPOS_DE_ANTES = ["Planta", "Fuego", "Agua"];
      for (let n = 0; n < lineas.length; n++) {
        for (let i = 0; i < 3; i++) {
          lineas[n] = sustituir(lineas[n], nombres[antes[i]], `\u0000${i}\u0000`);
          lineas[n] = sustituir(lineas[n], aCodigos(`tipo ${TIPOS_DE_ANTES[i]}`), `\u0001${i}\u0001`);
        }
        for (let i = 0; i < 3; i++) {
          lineas[n] = sustituir(lineas[n], `\u0000${i}\u0000`, nombres[ahora[i]]);
          lineas[n] = sustituir(lineas[n], `\u0001${i}\u0001`, aCodigos(`tipo ${iniciales[i].tipo}`));
        }
      }
      poner(perfil.num.StarterScreenTextOffset, lineas);
    } else {
      // «¡Pokémon Hojita TURTWIG! ¿Quieres este Pokémon?»: la especie (de la Pokédex) y el nombre
      const lineas = leer(perfil.num.StarterScreenTextOffset);
      const especies = leer(perfil.num.PokedexSpeciesTextOffset);
      for (let i = 0; i < 3; i++) {
        const viejo = `${especies[antes[i]]}${aCodigos(" ")}${nombres[antes[i]]}`;
        lineas[i + 1] = sustituir(lineas[i + 1], viejo, `${especies[ahora[i]]}${aCodigos(" ")}${nombres[ahora[i]]}`);
      }
      poner(perfil.num.StarterScreenTextOffset, lineas);
    }
    cambia = true;
  }

  if (intercambios && intercambios.size) {
    const nombres = leer(perfil.num.PokemonNamesTextOffset);
    // Todos a la vez (un nombre nuevo puede ser el viejo de otro intercambio): por un marcador
    const viejos = [...intercambios.keys()].sort((a, b) => b.length - a.length);
    for (const n of new Set(perfil.lis.IngameTradePersonTextOffsets || [])) {
      if (!n) continue;
      for (const extra of [n, ...(esHGSS(perfil.entrada) ? [n + 1] : [])]) {
        if (extra >= narc.archivos.length) continue;
        const lineas = leer(extra);
        const nuevas = lineas.map((linea) => {
          let t = linea;
          viejos.forEach((viejo, k) => (t = sustituir(t, aCodigos(viejo), `\u0001${k}\u0001`)));
          viejos.forEach((viejo, k) => (t = sustituir(t, `\u0001${k}\u0001`, aCodigos(intercambios.get(viejo)))));
          return t;
        });
        if (nuevas.some((t, i) => t !== lineas[i])) poner(extra, nuevas);
      }
    }
    void nombres;
    cambia = true;
  }

  if (cambia) rom.cambiar(perfil.archivos.Text, crearNarc(narc));
}
// Pokédex Nacional desde el principio: el script donde te dan la Pokédex, con el parche de UPR-ZX
// (el mismo para todos los idiomas; si el script no es el esperado, no se toca)
export function ponerPokedexNacional(datos) {
  const { perfil } = datos;
  const ips = IPS["nacional4" + (esDP(perfil.entrada) ? "dp" : esHGSS(perfil.entrada) ? "hgss" : "plat")];
  const original = datos.narcs.scripts.archivos[perfil.num.NationalDexScriptOffset];
  const ampliado = new Uint8Array(largoConIPS(ips, original.length));
  ampliado.set(original);
  datos.narcs.scripts.archivos[perfil.num.NationalDexScriptOffset] = aplicarIPS(ampliado, ips);
}

// Sin hacer en 4.ª generación
// Hierba en los pueblos que no tienen (ver ./hierba-gen4.js). Antes de leerBW2. Devuelve las zonas
export function ponerHierbaEnPueblos(rom) {
  return hierbaEnPueblos(rom, perfilDe(rom), { leerNarc, crearNarc });
}

export function ponerTextoRapido() {}

// Todos los combates dobles (como UPR-ZX): los entrenadores que pasan a doble ya llevan un 3 (en escribirBW2). Aquí, que el
// juego trate el 3 como a un entrenador solo: el aviso y la música de siempre, que no busque a una pareja que no tiene y
// la caja de texto del final. (Lo que se cambia va detrás de cada marca: no pasa nada por aplicarlo dos veces)
const ARREGLO_DOBLES = { dp: "022912D90221214201", pt: "022919D90221214205", hgss: "2C2815D00221214201" };

export function ponerCombatesDobles(rom) {
  const perfil = perfilDe(rom);
  const arm9 = rom.leerArm9();
  const tras = (marca) => {
    const i = buscar(arm9, marca);
    if (i < 0) throw new Error("Este juego no admite los combates dobles.");
    return i + marca.length / 2;
  };
  arm9[tras(ARREGLO_DOBLES[perfil.id])] = 0xe0; // el aviso especial de los dobles, nunca
  poner16(arm9, tras(perfil.textos.DoubleBattleFlagReturnPrefix), 0xbd08); // devolver el valor tal cual, no 0 o 1
  const andar = tras(perfil.textos.DoubleBattleWalkingPrefix1); // que anden los dos solo con el 2
  arm9[andar] = 2;
  arm9[andar + 3] = 0xd0;
  arm9[tras(perfil.textos.DoubleBattleWalkingPrefix2)] = 2;
  const caja = tras(perfil.textos.DoubleBattleTextBoxPrefix);
  poner16(arm9, caja, 0x46c0);
  poner16(arm9, caja + 2, 0x2802);
  arm9[caja + 5] = 0xd0;
  rom.escribirArm9(arm9);
  // Al acabar: mirar si es exactamente 2 (de 4 a 0 en esta secuencia de combate)
  const ruta = perfil.archivos.BattleSkillSubSeq;
  const secuencias = leerNarc(rom.archivo(ruta));
  secuencias.archivos[perfil.num.TrainerEndFileNumber][perfil.num.TrainerEndTextBoxOffset] = 0;
  rom.cambiar(ruta, crearNarc(secuencias));
}
