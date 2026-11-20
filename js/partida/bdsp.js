// ---------- Partidas de Switch (Diamante Brillante / Perla Reluciente) ----------
//
// Lee y escribe el archivo «SaveData.bin» de la partida (el de la carpeta de guardado de Eden,
// Ryujinx, yuzu... o el que saca JKSV de la consola).
//
// Aquí no hay bloques ni cifrado del archivo, como en Espada / Escudo: todo va en su sitio fijo
// (SAV8BS de PKHeX, github.com/kwsch/PKHeX). Solo lleva un MD5 de todo el archivo en 0xE9818,
// calculado con esos 16 bytes a ceros. Los Pokémon van cifrados igual que en Espada / Escudo
// (./switch.js) y también con el nivel y las estadísticas en las cajas (0x158 bytes cada uno).
//
// El tamaño cambia con las actualizaciones del juego (1.0 a 1.3), y los cuatro primeros bytes
// dicen cuál es. Lo que se usa aquí está en la misma posición en todas.
//
// Al escribir, nada se da por bueno: se vuelve a leer y se mira que el MD5 cuadra, que cada hueco
// tiene lo que se ha metido y que fuera de lo tocado y del MD5 no ha cambiado ni un byte.

import { TAM_HUECO, POR_CAJA, descifrar, interpretar, texto } from "./switch.js";
import { cifrarPokemon } from "./escribirswitch.js";

export const CAJAS_BDSP = 40;

// Tamaño -> número de la versión de la partida (los cuatro primeros bytes)
const TAMANOS = { 0xe9828: 0x25, 0xedc20: 0x2c, 0xeed8c: 0x32, 0xef0a4: 0x34 };

const MD5 = 0xe9818;
const BOLSA = 0x563c;     // 3000 objetos de 16 bytes, por su número
const EQUIPO = 0x14098;   // 6 huecos y detrás cuántos hay
const NOMBRES = 0x148aa;  // nombres de las cajas (0x22 bytes cada uno) y cuántas hay abiertas
const CAJAS = 0x14ef4;    // 40 cajas de 30
const CONFIG = 0x79b74;   // el idioma, en 4
const ENTRENADOR = 0x79bb4;

const VERSION_DE_ROM = { 0: 48, 1: 49 }; // Diamante Brillante, Perla Reluciente
const NOMBRE_VERSION = { 48: "Diamante Brillante", 49: "Perla Reluciente" };

// ---------- MD5 ----------
//
// Síncrono, como el SHA-256 de ./firma7.js (WebCrypto no tiene MD5, y el editor no espera a nada)

const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

export function md5(datos) {
  const largo = datos.length;
  const total = Math.ceil((largo + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(datos);
  m[largo] = 0x80;
  const vm = new DataView(m.buffer);
  vm.setUint32(total - 8, (largo * 8) >>> 0, true);
  vm.setUint32(total - 4, Math.floor((largo * 8) / 0x100000000), true);

  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const x = new Uint32Array(16);
  for (let bloque = 0; bloque < total; bloque += 64) {
    for (let i = 0; i < 16; i++) x[i] = vm.getUint32(bloque + i * 4, true);
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) [f, g] = [(b & c) | (~b & d), i];
      else if (i < 32) [f, g] = [(d & b) | (~d & c), (5 * i + 1) % 16];
      else if (i < 48) [f, g] = [b ^ c ^ d, (3 * i + 5) % 16];
      else [f, g] = [c ^ (b | ~d), (7 * i) % 16];
      const s = S[(i >> 4) * 4 + (i % 4)];
      const suma = (a + f + T[i] + x[g]) >>> 0;
      [a, d, c] = [d, c, b];
      b = (b + ((suma << s) | (suma >>> (32 - s)))) >>> 0;
    }
    [a0, b0, c0, d0] = [(a0 + a) >>> 0, (b0 + b) >>> 0, (c0 + c) >>> 0, (d0 + d) >>> 0];
  }
  const salida = new Uint8Array(16);
  const vs = new DataView(salida.buffer);
  [a0, b0, c0, d0].forEach((n, i) => vs.setUint32(i * 4, n, true));
  return salida;
}

function md5DeLaPartida(bytes) {
  const copia = bytes.slice();
  copia.fill(0, MD5, MD5 + 16);
  return md5(copia);
}

export function md5Bien(bytes) {
  const calculado = md5DeLaPartida(bytes);
  return calculado.every((b, i) => b === bytes[MD5 + i]);
}

// ---------- Leer ----------

const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

export function esPartidaBDSP(bytes) {
  return TAMANOS[bytes.length] !== undefined && u32(bytes, 0) === TAMANOS[bytes.length];
}

function vistaDe(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// Dónde está un hueco dentro del archivo. sitio: { equipo: 0..5 } o { caja, hueco }
function posicion(sitio) {
  if (sitio.equipo !== undefined) {
    if (sitio.equipo < 0 || sitio.equipo >= 6) throw new Error("Ese hueco del equipo no existe.");
    return EQUIPO + sitio.equipo * TAM_HUECO;
  }
  if (sitio.caja < 0 || sitio.caja >= CAJAS_BDSP || sitio.hueco < 0 || sitio.hueco >= POR_CAJA) throw new Error("Ese hueco no existe.");
  return CAJAS + (sitio.caja * POR_CAJA + sitio.hueco) * TAM_HUECO;
}

function descifrarHueco(bytes, sitio) {
  const inicio = posicion(sitio);
  const vista = descifrar(bytes.buffer.slice(bytes.byteOffset + inicio, bytes.byteOffset + inicio + TAM_HUECO));
  return vista ? new Uint8Array(vista.buffer) : null;
}

// Descifrado (0x158 bytes), o null si el hueco está vacío o no cuadra. Es lo que se cambia y se
// devuelve a editarHuecosBDSP.
export function leerHuecoBDSP(bytes, sitio) {
  const crudo = descifrarHueco(bytes, sitio);
  return crudo && new DataView(crudo.buffer).getUint16(0x08, true) ? crudo : null;
}

export function cuantosEquipoBDSP(bytes) {
  return Math.min(6, bytes[EQUIPO + 6 * TAM_HUECO]);
}

// Todas (40) están desde el principio; la partida dice 0 hasta que se cambia algo en ellas
export function cajasAbiertasBDSP(bytes) {
  const n = bytes[NOMBRES + 0x61c];
  return n ? Math.min(CAJAS_BDSP, n) : CAJAS_BDSP;
}

function idiomaDe(bytes) {
  return vistaDe(bytes).getInt32(CONFIG + 4, true);
}

// Lo del entrenador que hace falta para crear un Pokémon suyo (pokemonswitch.js, crearPokemon)
export function entrenadorBDSP(bytes) {
  const v = vistaDe(bytes);
  return {
    tid: v.getUint16(ENTRENADOR + 0x1c, true),
    sid: v.getUint16(ENTRENADOR + 0x1e, true),
    version: VERSION_DE_ROM[bytes[ENTRENADOR + 0x2b]] || 49,
    genero: bytes[ENTRENADOR + 0x24] === 1 ? 0 : 1, // la partida dice si es chico
    idioma: idiomaDe(bytes),
    nombre: bytes.slice(ENTRENADOR, ENTRENADOR + 0x1a)
  };
}

export function leerPartidaBDSP(bytes) {
  if (!esPartidaBDSP(bytes)) throw new Error("No parece una partida de Diamante Brillante / Perla Reluciente.");
  const v = vistaDe(bytes);
  const leer = (inicio, enEquipo) => {
    const p = descifrar(bytes.buffer.slice(bytes.byteOffset + inicio, bytes.byteOffset + inicio + TAM_HUECO));
    return p ? interpretar(p, enEquipo) : null;
  };

  const equipo = [];
  for (let i = 0; i < cuantosEquipoBDSP(bytes); i++) {
    const p = leer(EQUIPO + i * TAM_HUECO, true);
    if (p) equipo.push(p);
  }
  const cajas = [];
  for (let c = 0; c < CAJAS_BDSP; c++) {
    const pokemon = [];
    for (let s = 0; s < POR_CAJA; s++) {
      const p = leer(posicion({ caja: c, hueco: s }), false);
      if (p) pokemon.push({ ...p, hueco: s });
    }
    cajas.push({ nombre: texto(v, NOMBRES + c * 0x22, 16) || `Caja ${c + 1}`, pokemon });
  }
  const entrenador = entrenadorBDSP(bytes);
  // Las medallas: solo cuántas (se ganan en orden)
  const cuantasMedallas = bytes[ENTRENADOR + 0x29];
  return {
    juego: "bdsp",
    version: NOMBRE_VERSION[entrenador.version] || "",
    gen: 8,
    entrenador: texto(v, ENTRENADOR, 12),
    medallas: Array.from({ length: 8 }, (_, i) => i < cuantasMedallas),
    abiertas: cajasAbiertasBDSP(bytes),
    equipo,
    cajas
  };
}

// ---------- Escribir ----------

export function sePuedeEditarBDSP(bytes) {
  if (!esPartidaBDSP(bytes)) return { ok: false, motivo: "Ese archivo no es una partida que se sepa leer." };
  if (!md5Bien(bytes)) return { ok: false, motivo: "El MD5 de la partida no cuadra: mejor no tocarla." };
  return { ok: true, motivo: "" };
}

// Lo que el juego deja en un hueco vacío (comprobado con partidas reales): en las cajas, un
// Pokémon a ceros, cifrado, y los 16 bytes del equipo a ceros sin cifrar; en el equipo, uno
// «en blanco» de nivel 1 con el idioma de la partida, cifrado entero. Aquí, descifrados (lo de
// las cajas, todo a ceros: crudoAlArchivo sabe que va así).
export function huecoVacioBDSP(bytes, sitio) {
  const datos = new Uint8Array(TAM_HUECO);
  if (sitio.equipo !== undefined) {
    const blanco = { 0x8a: 0x0b, 0xe2: idiomaDe(bytes), 0x148: 1, 0x14a: 0x0b, 0x14c: 5, 0x14e: 5, 0x150: 5, 0x152: 5, 0x154: 5 };
    for (const [o, valor] of Object.entries(blanco)) datos[Number(o)] = valor;
  }
  return datos;
}

// Lo que va en el archivo para ese Pokémon descifrado
function crudoAlArchivo(crudo, sitio) {
  const cifrado = cifrarPokemon(crudo);
  if (sitio.equipo === undefined && crudo.every((b) => !b)) cifrado.fill(0, 0x148);
  return cifrado;
}

function igualesSalvoSuma(uno, otro) {
  return uno.length === otro.length && uno.every((byte, i) => i === 6 || i === 7 || byte === otro[i]);
}

// trozos: [{ inicio, datos }] (lo que se escribe tal cual). Devuelve la partida nueva con el MD5
// al día, comprobada: que fuera de los trozos y del MD5 no cambia nada.
export function escribirTrozosBDSP(original, trozos) {
  const permiso = sePuedeEditarBDSP(original);
  if (!permiso.ok) throw new Error(permiso.motivo);
  return escribirTrozos(original, trozos);
}

function escribirTrozos(original, trozos) {
  const nuevo = original.slice();
  for (const { inicio, datos } of trozos) nuevo.set(datos, inicio);
  nuevo.set(md5DeLaPartida(nuevo), MD5);

  if (!md5Bien(nuevo)) throw new Error("El MD5 no ha quedado bien.");
  const permitidos = [...trozos.map((t) => ({ inicio: t.inicio, fin: t.inicio + t.datos.length })), { inicio: MD5, fin: MD5 + 16 }];
  for (let i = 0; i < nuevo.length; i++) {
    if (nuevo[i] !== original[i] && !permitidos.some((r) => i >= r.inicio && i < r.fin)) throw new Error("Ha cambiado algo que no debía.");
  }
  leerPartidaBDSP(nuevo); // que se siga pudiendo leer entera
  return nuevo;
}

// Como editarHuecos de ./escribir3ds.js
export function editarHuecosBDSP(original, cambios, cuantosEquipo) {
  const permiso = sePuedeEditarBDSP(original);
  if (!permiso.ok) throw new Error(permiso.motivo);

  const trozos = [];
  for (const { sitio, crudo } of cambios) {
    if (crudo.length !== TAM_HUECO) throw new Error("El Pokémon no tiene el tamaño de ese hueco.");
    trozos.push({ inicio: posicion(sitio), datos: crudoAlArchivo(crudo, sitio) });
  }
  if (cuantosEquipo !== undefined) {
    if (cuantosEquipo < 1 || cuantosEquipo > 6) throw new Error("El equipo tiene que tener de 1 a 6 Pokémon.");
    trozos.push({ inicio: EQUIPO + 6 * TAM_HUECO, datos: Uint8Array.of(cuantosEquipo) });
  }
  const nuevo = escribirTrozos(original, trozos);

  for (const { sitio, crudo } of cambios) {
    const inicio = posicion(sitio);
    const escrito = nuevo.subarray(inicio, inicio + TAM_HUECO);
    const esperado = crudoAlArchivo(crudo, sitio);
    if (escrito.some((b, i) => b !== esperado[i])) throw new Error("Un Pokémon no se ha guardado bien.");
    const releido = descifrarHueco(nuevo, sitio);
    if (crudo.some(Boolean) && (!releido || !igualesSalvoSuma(releido, crudo))) throw new Error("Un Pokémon no se ha guardado bien.");
  }
  return nuevo;
}

// ---------- La bolsa ----------
//
// Un hueco de 16 bytes por cada objeto que existe, en su número: cantidad (u32), si NO es nuevo
// (u32), si es favorito (u32) y su sitio al ordenar el bolsillo (u16; 0 si no se tiene). El
// bolsillo de cada objeto no va en la partida: lo dice ItemStorage8BDSP de PKHeX (aquí abajo).

const desde = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const DE_CADA = {
  objetos: [
    ...desde(45, 53), ...desde(72, 85), 93, 94, ...desde(107, 112), 135, 136, 213, 214, 215, ...desde(217, 327), 537,
    ...desde(565, 570), 644, 645, 849, ...desde(1231, 1251), 1606
  ],
  medicinas: [...desde(17, 44), 54],
  balls: [...desde(1, 16), ...desde(492, 500), 576, 851],
  mt: desde(328, 427),
  bayas: [...desde(149, 212), 686],
  combate: desde(55, 63),
  tesoros: [...desde(86, 92), ...desde(99, 106), 795, 796, ...desde(1808, 1821)],
  clave: [
    428, 431, 432, 433, ...desde(438, 440), 443, ...desde(445, 455), ...desde(459, 464), 466, 467, 631, 632, 1267, 1278, 1822
  ]
};

export const BOLSILLOS_BDSP = Object.entries(DE_CADA).map(([id, lista]) => ({
  id, caben: lista.length, maximo: id === "clave" ? 1 : 999
}));

const BOLSILLO_DE = new Map(Object.entries(DE_CADA).flatMap(([bolsillo, lista]) => lista.map((objeto) => [objeto, bolsillo])));

// El bolsillo en el que va ese objeto, o null si no existe en el juego
export function bolsilloBDSP(objeto) {
  return BOLSILLO_DE.get(objeto) || null;
}

export function bolsillosBDSP() {
  return BOLSILLOS_BDSP;
}

function hueco(v, objeto) {
  const o = BOLSA + objeto * 16;
  return { cantidad: v.getInt32(o, true), visto: v.getUint32(o + 4, true), favorito: v.getUint32(o + 8, true), orden: v.getUint16(o + 12, true) };
}

// { objetos: [{ objeto, cantidad }], medicinas: [...], ... } en el orden del bolsillo
export function leerMochilaBDSP(bytes) {
  const v = vistaDe(bytes);
  const mochila = {};
  for (const [bolsillo, lista] of Object.entries(DE_CADA)) {
    mochila[bolsillo] = lista
      .map((objeto) => ({ objeto, ...hueco(v, objeto) }))
      .filter((e) => e.orden && e.cantidad > 0)
      .sort((x, y) => x.orden - y.orden)
      .map(({ objeto, cantidad }) => ({ objeto, cantidad }));
  }
  return mochila;
}

// Escribe la bolsa entera (lo de leerMochilaBDSP, cambiado). Devuelve una partida nueva, comprobada.
export function escribirMochilaBDSP(original, mochila) {
  const permiso = sePuedeEditarBDSP(original);
  if (!permiso.ok) throw new Error(permiso.motivo);

  const bolsa = original.slice(BOLSA, BOLSA + 3000 * 16);
  const v = new DataView(bolsa.buffer);
  const limpia = {};
  for (const [bolsillo, legales] of Object.entries(DE_CADA)) {
    const b = BOLSILLOS_BDSP.find((x) => x.id === bolsillo);
    const vistos = new Set();
    const lista = (mochila[bolsillo] || [])
      .filter((e) => e.objeto > 0 && e.cantidad > 0 && BOLSILLO_DE.get(e.objeto) === bolsillo && !vistos.has(e.objeto) && vistos.add(e.objeto))
      .map((e) => ({ objeto: e.objeto, cantidad: Math.min(b.maximo, Math.floor(e.cantidad)) }));
    lista.forEach((e, i) => {
      const o = e.objeto * 16;
      const yaEstaba = v.getUint16(o + 12, true) !== 0;
      v.setInt32(o, e.cantidad, true);
      if (!yaEstaba) {
        v.setUint32(o + 4, 0, true); // nuevo
        v.setUint32(o + 8, 0, true);
      }
      v.setUint16(o + 12, i + 1, true);
      v.setUint16(o + 14, 0, true);
    });
    // Los de este bolsillo que ya no están, fuera (como PKHeX)
    for (const objeto of legales) if (!vistos.has(objeto)) bolsa.fill(0, objeto * 16, objeto * 16 + 16);
    limpia[bolsillo] = lista;
  }
  // Los objetos que no existen en el juego (los repartió un randomizer antiguo: salen «desconocidos») no se ven aquí
  // y conservan su sitio al ordenar el bolsillo, que choca con el de los nuevos: el juego deja de poder salir de la
  // bolsa. Fuera
  for (let objeto = 0; objeto < 3000; objeto++) if (!BOLSILLO_DE.has(objeto)) bolsa.fill(0, objeto * 16, objeto * 16 + 16);

  const nuevo = escribirTrozos(original, [{ inicio: BOLSA, datos: bolsa }]);
  if (JSON.stringify(leerMochilaBDSP(nuevo)) !== JSON.stringify(limpia)) throw new Error("La bolsa no se ha guardado bien.");
  return nuevo;
}
