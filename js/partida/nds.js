// ---------- Partidas de DS (Diamante / Perla, Platino, HeartGold / SoulSilver, Negro / Blanco, Negro 2 / Blanco 2) ----------
//
// Lee la partida (512 KB) tal cual o con el pie que le añade DeSmuME (.dsv), que se deja como
// está. Devuelve lo mismo que leerPartida3DS (./tresds.js). Escribir está en ./escribirds.js.
//
// Gen 4: la partida está dos veces (en 0x0 y en 0x40000), cada una con un bloque general (el
// entrenador, el equipo y la bolsa) y otro de cajas. Al final de cada bloque hay un pie con un
// contador (vale el más alto de las dos copias), el tamaño y un CRC16-CCITT: de 0x14 bytes en
// Diamante / Perla y Platino, y de 0x10 en HGSS (sin el hueco de delante del tamaño).
// Gen 5: cada caja va en su bloque de 0x1000, y el equipo y la bolsa en el suyo, cada uno con
// su CRC detrás. Una tabla repite todos esos CRC (y lleva el suyo), y todo está dos veces: la
// copia de seguridad empieza en 0x24000 (Negro / Blanco) o 0x26000 (Negro 2 / Blanco 2).
// Comprobado con partidas reales de Diamante, Platino, HeartGold, Blanco y Blanco 2.

import { ORDEN } from "./tresds.js";
import { LETRAS_GEN4 } from "./datos-ds.js";

export const TAM_PARTIDA = 0x80000;
const MARCA_DESMUME = "|-DESMUME SAVE-|";

export const TAM_POKEMON = 0x88; // en las cajas
export const TROZO = 0x20; // los cuatro trozos barajados
export const POR_CAJA = 30;

// Gen 4: [inicio, tamaño] de los bloques; dentro del general, el entrenador, el equipo y la
// bolsa; dentro del de cajas, dónde empiezan, cada cuánto y sus nombres
const GEN4 = {
  dp: {
    general: [0, 0xc100], cajas: [0xc100, 0x121e0], nombre: 0x64, tid: 0x74, generoEntrenador: 0x7c, idioma: 0x7d,
    cuantos: 0x94, equipo: 0x98, primeraCaja: 4, paso: 0xff0, nombres: 0x11ee4, bolsa: 0x624, version: 10, pie: 0x14
  },
  platino: {
    general: [0, 0xcf2c], cajas: [0xcf2c, 0x121e4], nombre: 0x68, tid: 0x78, generoEntrenador: 0x80, idioma: 0x81,
    cuantos: 0x9c, equipo: 0xa0, primeraCaja: 4, paso: 0xff0, nombres: 0x11ee4, bolsa: 0x630, version: 12, pie: 0x14
  },
  hgss: {
    general: [0, 0xf628], cajas: [0xf700, 0x12310], nombre: 0x64, tid: 0x74, generoEntrenador: 0x7c, idioma: 0x7d,
    cuantos: 0x94, equipo: 0x98, primeraCaja: 0, paso: 0x1000, nombres: 0x12008, bolsa: 0x644, version: 7, pie: 0x10
  }
};
const TAM_EQUIPO_GEN4 = 0xec;

// Gen 5: la tabla de los CRC (su largo; su propio CRC va 0xE bytes detrás), el largo del bloque
// de la bolsa y dónde empieza la copia de seguridad
const GEN5 = {
  bw: { tabla: 0x23f00, largoTabla: 0x8c, largoBolsa: 0x9c0, copia: 0x24000 },
  b2w2: { tabla: 0x25f00, largoTabla: 0x94, largoBolsa: 0x9ec, copia: 0x26000 }
};
const TAM_EQUIPO_GEN5 = 0xdc;
const EQUIPO_GEN5 = 0x18e00; // bloque del equipo: el número en +4 y los Pokémon desde +8
const LARGO_EQUIPO_GEN5 = 0x534;
const BOLSA_GEN5 = 0x18400;
const ENTRENADOR_GEN5 = 0x19400;
// Las medallas (un bit cada una): en gen 4, en el entrenador (+0x1A; las de Kanto de HGSS, en
// +0x1F); en gen 5, en el bloque de varios (dinero, medallas...), en +4
const MEDALLAS_GEN5 = { bw: 0x21204, b2w2: 0x21104 };

export const VERSIONES = {
  1: "Zafiro", 2: "Rubí", 3: "Esmeralda", 4: "Rojo Fuego", 5: "Verde Hoja", 7: "HeartGold", 8: "SoulSilver",
  10: "Diamante", 11: "Perla", 12: "Platino", 15: "Colosseum",
  20: "Blanco", 21: "Negro", 22: "Blanco 2", 23: "Negro 2"
};

// ---------- Checksum ----------

export function crc16(bytes, inicio, largo) {
  let c = 0xffff;
  for (let i = inicio; i < inicio + largo; i++) {
    c ^= bytes[i] << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

// ---------- Qué juego es y dónde está cada cosa ----------

// Los 512 KB de la partida, sin el pie de DeSmuME (si lo hay)
export function sinPie(bytes) {
  if (bytes.length === TAM_PARTIDA) return bytes;
  if (bytes.length > TAM_PARTIDA && bytes.length < TAM_PARTIDA + 0x100) {
    const pie = new TextDecoder("latin1").decode(bytes.subarray(TAM_PARTIDA));
    if (pie.includes(MARCA_DESMUME)) return bytes.subarray(0, TAM_PARTIDA);
  }
  return null;
}

// Un bloque de gen 4 en una de las dos copias: { inicio, datos, crc, contador } o null si no cuadra.
// largoPie: 0x14 (el tamaño va en +8) o 0x10 (en +4).
function bloqueGen4(b, copia, [inicio, tam], largoPie) {
  const i = copia + inicio;
  const pie = i + tam - largoPie;
  if (u32(b, pie + largoPie - 0xc) !== tam) return null;
  if (crc16(b, i, tam - largoPie) !== u16(b, i + tam - 2)) return null;
  return { inicio: i, datos: tam - largoPie, crc: i + tam - 2, contador: u32(b, pie) };
}

// El de las dos copias que vale (el de contador más alto)
function mejorBloque(b, datos, largoPie) {
  const validos = [0, 0x40000].map((copia) => bloqueGen4(b, copia, datos, largoPie)).filter(Boolean);
  return validos.sort((x, y) => y.contador - x.contador)[0] || null;
}

// Dónde está todo (posiciones dentro del archivo), o null si no es una partida de DS que se
// sepa leer:
//   { id, gen, numCajas, equipo, tamEquipo, cuantos, caja(c), nombreCaja(c), bolsa,
//     bloques: [{ nombre, inicio, datos, crc, entrada? }] (con su CRC en «crc» y, en gen 5,
//     repetido en la tabla, en «entrada»), tabla?, copia? }
export function mapaDS(bytes) {
  const b = sinPie(bytes);
  if (!b) return null;

  for (const [id, j] of Object.entries(GEN4)) {
    const general = mejorBloque(b, j.general, j.pie);
    const cajas = mejorBloque(b, j.cajas, j.pie);
    if (!general || !cajas) continue;
    return {
      id, gen: 4, datos: j, numCajas: 18,
      general: general.inicio,
      equipo: general.inicio + j.equipo, tamEquipo: TAM_EQUIPO_GEN4, cuantos: general.inicio + j.cuantos,
      caja: (c) => cajas.inicio + j.primeraCaja + c * j.paso,
      nombreCaja: (c) => cajas.inicio + j.nombres + c * 0x28,
      bolsa: general.inicio + j.bolsa,
      bloques: [{ nombre: "general", ...general }, { nombre: "cajas", ...cajas }]
    };
  }

  const crcEquipo = crc16(b, EQUIPO_GEN5, LARGO_EQUIPO_GEN5);
  for (const [id, j] of Object.entries(GEN5)) {
    if (u16(b, j.tabla + 26 * 2) !== crcEquipo || u16(b, EQUIPO_GEN5 + LARGO_EQUIPO_GEN5 + 2) !== crcEquipo) continue;
    const bloques = Array.from({ length: 24 }, (_, c) => ({
      nombre: `caja${c}`, inicio: 0x400 + c * 0x1000, datos: 0xff0, crc: 0x400 + c * 0x1000 + 0xff2, entrada: j.tabla + (c + 1) * 2
    }));
    bloques.push({ nombre: "bolsa", inicio: BOLSA_GEN5, datos: j.largoBolsa, crc: BOLSA_GEN5 + j.largoBolsa + 2, entrada: j.tabla + 25 * 2 });
    bloques.push({ nombre: "equipo", inicio: EQUIPO_GEN5, datos: LARGO_EQUIPO_GEN5, crc: EQUIPO_GEN5 + LARGO_EQUIPO_GEN5 + 2, entrada: j.tabla + 26 * 2 });
    return {
      id, gen: 5, datos: j, numCajas: 24,
      equipo: EQUIPO_GEN5 + 8, tamEquipo: TAM_EQUIPO_GEN5, cuantos: EQUIPO_GEN5 + 4,
      caja: (c) => 0x400 + c * 0x1000,
      nombreCaja: (c) => 4 + c * 0x28,
      bolsa: BOLSA_GEN5,
      bloques,
      tabla: { inicio: j.tabla, datos: j.largoTabla, crc: j.tabla + j.largoTabla + 0xe },
      copia: j.copia
    };
  }
  return null;
}

export function esPartidaDS(bytes) {
  return Boolean(mapaDS(bytes));
}

// Dónde está un hueco dentro del archivo. sitio: { equipo: 0..5 } o { caja, hueco }
export function posicionHuecoDS(mapa, sitio) {
  if (sitio.equipo !== undefined) return { inicio: mapa.equipo + sitio.equipo * mapa.tamEquipo, largo: mapa.tamEquipo };
  return { inicio: mapa.caja(sitio.caja) + sitio.hueco * TAM_POKEMON, largo: TAM_POKEMON };
}

// ---------- Pokémon ----------

// XOR con el generador de siempre: los datos de caja con la suma (0x06) y los de equipo con el
// PID. Cifra y descifra igual.
export function xorDS(v) {
  const pid = v.getUint32(0, true);
  const tramo = (desde, hasta, llave) => {
    let semilla = llave;
    for (let i = desde; i < hasta; i += 2) {
      semilla = (Math.imul(semilla, 0x41c64e6d) + 0x6073) >>> 0;
      v.setUint16(i, v.getUint16(i, true) ^ (semilla >>> 16), true);
    }
  };
  tramo(8, TAM_POKEMON, v.getUint16(6, true));
  if (v.byteLength > TAM_POKEMON) tramo(TAM_POKEMON, v.byteLength, pid);
}

export function sumaDS(v) {
  let total = 0;
  for (let i = 8; i < TAM_POKEMON; i += 2) total = (total + v.getUint16(i, true)) & 0xffff;
  return total;
}

export function ordenDS(pid) {
  return ORDEN[((pid >>> 13) & 31) % 24];
}

// Descifra un Pokémon de gen 4 o 5 (136 bytes, o más si es del equipo). null si no cuadra.
export function descifrarDS(cifrado) {
  const datos = new Uint8Array(cifrado);
  const v = new DataView(datos.buffer);
  xorDS(v);
  const copia = datos.slice(8, 8 + TROZO * 4);
  ordenDS(v.getUint32(0, true)).forEach((origen, destino) => datos.set(copia.subarray(origen * TROZO, (origen + 1) * TROZO), 8 + destino * TROZO));
  if (sumaDS(v) !== v.getUint16(6, true)) return null;
  return v;
}

// Texto de gen 4: cada letra, un código de la tabla; 0xFFFF termina
const RAROS_GEN4 = { 0x1de: " ", 0x1bc: "♂", 0x1bd: "♀" };
export function textoGen4(v, inicio, maximo) {
  let salida = "";
  for (let i = 0; i < maximo; i++) {
    const c = v.getUint16(inicio + i * 2, true);
    if (c === 0xffff || !c) break;
    salida += RAROS_GEN4[c] || (c >= 0x120 ? LETRAS_GEN4[c - 0x120] || "" : "");
  }
  return salida.trim();
}

// Texto de gen 5: UTF-16 terminado en 0xFFFF, con ♂ y ♀ propios
const RAROS_GEN5 = { 0x246d: "♂", 0x246e: "♀" };
export function textoGen5(v, inicio, maximo) {
  let salida = "";
  for (let i = 0; i < maximo; i++) {
    const c = v.getUint16(inicio + i * 2, true);
    if (c === 0xffff || !c) break;
    salida += RAROS_GEN5[c] || String.fromCharCode(c);
  }
  return salida;
}

// Lo contrario: los códigos de cada letra (las que no existen, fuera)
const DE_LETRA_GEN4 = new Map([...LETRAS_GEN4].map((letra, i) => [letra, i + 0x120]).filter(([letra]) => letra !== " ").reverse());
for (const [codigo, letra] of Object.entries(RAROS_GEN4)) DE_LETRA_GEN4.set(letra, Number(codigo));
const DE_LETRA_GEN5 = new Map(Object.entries(RAROS_GEN5).map(([codigo, letra]) => [letra, Number(codigo)]));

export function codigosTexto(gen, cadena) {
  return [...cadena].map((letra) => (gen === 4 ? DE_LETRA_GEN4.get(letra) : DE_LETRA_GEN5.get(letra) || letra.charCodeAt(0))).filter(Boolean);
}

// Arceus: en gen 4 y 5 su forma 9 es el tipo «???», que ya no existe; la web cuenta sin él
export function formaWeb(especie, forma) {
  if (especie !== 493 || forma < 9) return forma;
  return forma === 9 ? 0 : forma - 1;
}
export function formaJuego(especie, forma) {
  return especie === 493 && forma >= 9 ? forma + 1 : forma;
}

// Lo que se usa de un Pokémon descifrado (como interpretar en tresds.js)
export function interpretarDS(v, gen, enEquipo) {
  const especie = v.getUint16(0x08, true);
  if (!especie) return null;
  const texto = gen === 4 ? textoGen4 : textoGen5;

  const pid = v.getUint32(0, true);
  const tid = v.getUint16(0x0c, true);
  const sid = v.getUint16(0x0e, true);
  const ivs = v.getUint32(0x38, true);
  const genero = v.getUint8(0x40);
  // Platino y HGSS guardan aparte los lugares nuevos (0x44 / 0x46); si no, van en 0x7E / 0x80
  const lugar = (gen === 4 && v.getUint16(0x46, true)) || v.getUint16(0x80, true);
  const lugarHuevo = (gen === 4 && v.getUint16(0x44, true)) || v.getUint16(0x7e, true);
  const fecha = (o) => `20${String(v.getUint8(o)).padStart(2, "0")}-${String(v.getUint8(o + 1)).padStart(2, "0")}-${String(v.getUint8(o + 2)).padStart(2, "0")}`;

  const p = {
    especie,
    forma: formaWeb(especie, genero >> 3),
    genero: genero & 4 ? "" : genero & 2 ? "F" : "M",
    mote: (ivs >>> 31) ? texto(v, 0x48, 11) : "",
    huevo: Boolean((ivs >>> 30) & 1),
    shiny: (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8,
    objeto: v.getUint16(0x0a, true),
    habilidad: v.getUint8(0x15),
    naturaleza: gen === 4 ? pid % 25 : v.getUint8(0x41),
    experiencia: v.getUint32(0x10, true),
    ataques: [0x28, 0x2a, 0x2c, 0x2e].map((o) => v.getUint16(o, true)).filter(Boolean),
    ivs: [0, 5, 10, 20, 25, 15].map((b) => (ivs >>> b) & 31), // PS, Ata, Def, AtE, DfE, Vel
    evs: [0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1b].map((o) => v.getUint8(o)),
    lugar,
    lugarHuevo,
    nivelCaptura: v.getUint8(0x84) & 0x7f,
    fechaCaptura: fecha(0x7b),
    ball: v.getUint8(0x86) || v.getUint8(0x83),
    origen: VERSIONES[v.getUint8(0x5f)] || "",
    entrenador: texto(v, 0x68, 8),
    llave: pid
  };
  if (enEquipo) {
    p.nivel = v.getUint8(0x8c);
    p.ps = v.getUint16(0x8e, true);
    p.psMax = v.getUint16(0x90, true);
  }
  return p;
}

function leerPokemon(b, { inicio, largo }, gen, enEquipo) {
  const v = descifrarDS(b.buffer.slice(b.byteOffset + inicio, b.byteOffset + inicio + largo));
  return v ? interpretarDS(v, gen, enEquipo) : null;
}

// ---------- Entrenador ----------

// Lo del entrenador que llevan los Pokémon que se crean. nombre: los 16 bytes tal cual (como
// van en el Pokémon). version: la de la partida (en Diamante / Perla y HGSS, la de sus Pokémon).
export function entrenadorDS(bytes) {
  const mapa = mapaDS(bytes);
  if (!mapa) throw new Error("No parece una partida de DS.");
  const b = sinPie(bytes);
  let e;
  if (mapa.gen === 4) {
    const j = mapa.datos;
    const g = mapa.general;
    e = {
      tid: u16(b, g + j.tid), sid: u16(b, g + j.tid + 2), genero: b[g + j.generoEntrenador], idioma: b[g + j.idioma],
      nombre: b.slice(g + j.nombre, g + j.nombre + 16), version: j.version
    };
  } else {
    const t = ENTRENADOR_GEN5;
    e = { tid: u16(b, t + 0x14), sid: u16(b, t + 0x16), idioma: b[t + 0x1e], version: b[t + 0x1f], genero: b[t + 0x21], nombre: b.slice(t + 4, t + 20) };
  }
  // DP y HGSS no dicen cuál de los dos es: el de un Pokémon suyo del equipo
  if (mapa.id !== "platino" && mapa.gen === 4) {
    for (let i = 0; i < Math.min(6, b[mapa.cuantos]); i++) {
      const v = descifrarDS(b.buffer.slice(b.byteOffset + mapa.equipo + i * mapa.tamEquipo, b.byteOffset + mapa.equipo + (i + 1) * mapa.tamEquipo));
      const version = v && v.getUint8(0x5f);
      if (v && v.getUint16(0x0c, true) === e.tid && v.getUint16(0x0e, true) === e.sid && [7, 8, 10, 11].includes(version)) {
        e.version = version;
        break;
      }
    }
  }
  return e;
}

// ---------- Partida ----------

export function leerPartidaDS(bytes) {
  const mapa = mapaDS(bytes);
  if (!mapa) throw new Error("No parece una partida de DS.");
  const b = sinPie(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const gen = mapa.gen;
  const texto = gen === 4 ? textoGen4 : textoGen5;
  const ent = entrenadorDS(bytes);

  const equipo = [];
  for (let i = 0; i < Math.min(6, b[mapa.cuantos]); i++) {
    const p = leerPokemon(b, posicionHuecoDS(mapa, { equipo: i }), gen, true);
    if (p) equipo.push(p);
  }

  const cajas = [];
  for (let c = 0; c < mapa.numCajas; c++) {
    const pokemon = [];
    for (let s = 0; s < POR_CAJA; s++) {
      const p = leerPokemon(b, posicionHuecoDS(mapa, { caja: c, hueco: s }), gen, false);
      if (p) pokemon.push({ ...p, hueco: s });
    }
    cajas.push({ nombre: texto(v, mapa.nombreCaja(c), 20) || `Caja ${c + 1}`, pokemon });
  }

  const bits = (n) => Array.from({ length: 8 }, (_, i) => Boolean((n >> i) & 1));
  const medallas = gen === 5
    ? bits(b[MEDALLAS_GEN5[mapa.id]])
    : bits(b[mapa.general + mapa.datos.nombre + 0x1a]).concat(mapa.id === "hgss" ? bits(b[mapa.general + mapa.datos.nombre + 0x1f]) : []);

  return {
    juego: mapa.id,
    version: VERSIONES[ent.version] || "",
    gen,
    entrenador: texto(new DataView(ent.nombre.buffer), 0, 8),
    medallas,
    abiertas: mapa.numCajas,
    equipo,
    cajas
  };
}

// ---------- En la memoria, mientras se juega (js/jugar) ----------
//
// El juego tiene el equipo como { cuántos caben, cuántos hay, los seis Pokémon }, con el mismo formato que en la
// partida guardada (cifrado y con su suma). En la memoria del emulador puede haber más de una lista así (en combate, el
// juego copia los equipos; y está la copia de la partida guardada): buscarEquiposDS las da todas y quien llama elige.

const TAM_EN_EQUIPO = { 4: TAM_EQUIPO_GEN4, 5: TAM_EQUIPO_GEN5 };

// El equipo que empieza en «inicio» (en los bytes «b»), o null si ahí no hay uno
export function equipoEnEstadoDS(b, inicio, gen) {
  const tam = TAM_EN_EQUIPO[gen];
  if (!tam || inicio < 0 || inicio + 8 + 6 * tam > b.length) return null;
  const cuantos = u32(b, inicio + 4);
  if (cuantos < 1 || cuantos > 6) return null;
  const equipo = [];
  for (let k = 0; k < cuantos; k++) {
    const o = inicio + 8 + k * tam;
    const v = descifrarDS(b.slice(o, o + tam).buffer);
    if (!v) return null;
    const p = interpretarDS(v, gen, true);
    if (!p || p.especie > 649 || !p.nivel || p.nivel > 100 || !p.psMax || p.ps > p.psMax) return null;
    equipo.push(p);
  }
  return equipo;
}

// Dónde empiezan todos los equipos que hay en «b» (o entre «desde» y «hasta», para buscar a trozos)
export function buscarEquiposDS(b, gen, desde = 0, hasta = b.length) {
  const salida = [];
  for (let i = desde; i < hasta && i + 16 <= b.length; i += 4) {
    // Lo primero que se mira, lo más barato: cuántos hay (de 1 a 6)
    if (b[i + 4] < 1 || b[i + 4] > 6 || b[i + 5] || b[i + 6] || b[i + 7]) continue;
    if (equipoEnEstadoDS(b, i, gen)) salida.push(i);
  }
  return salida;
}
