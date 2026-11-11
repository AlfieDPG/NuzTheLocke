// ---------- Partidas de 3DS (X / Y, Rubí Omega / Zafiro Alfa, Sol / Luna, Ultrasol / Ultraluna) ----------
//
// Lee el archivo «main» que guardan Citra y Lime3DS. Aquí solo se lee; escribir está en
// ./escribir3ds.js, que usa estas mismas piezas.
//
// La partida va por bloques. Al final del archivo hay una tabla con el tamaño de cada uno
// (tras la marca «BEEF»); cada bloque empieza donde acaba el anterior, redondeado a 0x200.

export const TAM_POKEMON = 0xe8; // en las cajas
export const TAM_POKEMON_EQUIPO = 0x104; // en el equipo (con nivel, PS, estado...)
export const POR_CAJA = 30;

// Las mentas del randomizer (js/randomizer/mentas-xy.js): en la web, 1231-1251; en el juego, del 505 al 525 (en 3DS no
// hay nada ahí: eran las Tarjetas de datos de HeartGold y SoulSilver)
export const objetoWeb3DS = (id) => (id >= 505 && id <= 525 ? 1231 + id - 505 : id);
export const objetoJuego3DS = (id) => (id >= 1231 && id <= 1251 ? 505 + id - 1231 : id);

// Juegos por tamaño del archivo (id: el de js/comun/juegos.js). Los bloques, por su número
// en la tabla. firma: dónde va la firma de las partidas de gen 7 (ver escribir3ds.js).
export const JUEGOS = {
  0x65600: { id: "xy", gen: 6, bloques: { entrenador: 0x11, equipo: 0x12, cajasInfo: 0x0c, cajas: 0x35, varios: 0x0b }, cajas: 31 },
  0x76000: { id: "oras", gen: 6, bloques: { entrenador: 0x11, equipo: 0x12, cajasInfo: 0x0c, cajas: 0x38, varios: 0x0b }, cajas: 31 },
  0x6be00: { id: "sm", gen: 7, bloques: { entrenador: 0x03, equipo: 0x04, cajasInfo: 0x0d, cajas: 0x0e }, cajas: 32, firma: 0x6bb00 },
  0x6cc00: { id: "usum", gen: 7, bloques: { entrenador: 0x03, equipo: 0x04, cajasInfo: 0x0d, cajas: 0x0e }, cajas: 32, firma: 0x6c100 }
};

// Edición (byte 0xDF de cada Pokémon y 0x04 del entrenador)
const VERSIONES = { 24: "X", 25: "Y", 26: "Zafiro Alfa", 27: "Rubí Omega", 30: "Sol", 31: "Luna", 32: "Ultrasol", 33: "Ultraluna" };

export function esPartida3DS(bytes) {
  return Boolean(JUEGOS[bytes.length]);
}

// ---------- Bloques ----------

// [{ inicio, largo, entrada }]: entrada es dónde está su fila en la tabla (largo, número y
// checksum, 8 bytes)
export function bloques(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // La marca «BEEF» (0x42454546) está casi al final; la tabla, justo detrás
  let marca = -1;
  for (let i = bytes.length - 4; i >= bytes.length - 0x400; i--) {
    if (vista.getUint32(i, true) === 0x42454546) {
      marca = i;
      break;
    }
  }
  if (marca < 0) throw new Error("No parece una partida de 3DS.");

  const lista = [];
  let inicio = 0;
  for (let i = marca + 4; i + 8 <= bytes.length; i += 8) {
    const largo = vista.getUint32(i, true);
    const id = vista.getUint16(i + 4, true);
    if (!largo || id !== lista.length) break;
    lista.push({ inicio, largo, entrada: i });
    inicio += Math.ceil(largo / 0x200) * 0x200;
  }
  return lista;
}

// ---------- Pokémon ----------

// Orden de los cuatro trozos de 56 bytes según la llave de cifrado
export const ORDEN = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0]
];
export const TROZO = 0x38;

export function ordenDe(llave) {
  return ORDEN[((llave >>> 13) & 31) % 24];
}

// XOR con un generador lineal que empieza en la llave. Cifra y descifra igual.
export function xorPokemon(vista, llave) {
  let semilla = llave;
  for (let i = 8; i < vista.byteLength; i += 2) {
    if (i === TAM_POKEMON) semilla = llave; // los datos de equipo vuelven a empezar
    semilla = (Math.imul(semilla, 0x41c64e6d) + 0x6073) >>> 0;
    vista.setUint16(i, vista.getUint16(i, true) ^ (semilla >>> 16), true);
  }
}

// La suma que va en 0x06: la de los datos de caja, de dos en dos bytes
export function sumaPokemon(vista) {
  let suma = 0;
  for (let i = 8; i < TAM_POKEMON; i += 2) suma = (suma + vista.getUint16(i, true)) & 0xffff;
  return suma;
}

// Descifra un Pokémon (232 o 260 bytes). Devuelve null si el hueco está vacío o no cuadra.
export function descifrar(cifrado) {
  const datos = new Uint8Array(cifrado);
  const vista = new DataView(datos.buffer);
  const llave = vista.getUint32(0, true);

  xorPokemon(vista, llave);

  // Deshacer el barajado
  const copia = datos.slice(8, 8 + TROZO * 4);
  ordenDe(llave).forEach((origen, destino) => datos.set(copia.subarray(origen * TROZO, (origen + 1) * TROZO), 8 + destino * TROZO));

  if (sumaPokemon(vista) !== vista.getUint16(6, true)) return null;
  return vista;
}

// Texto en UTF-16 terminado en 0. Los 3DS usan unos pocos caracteres propios (♂ ♀...).
const PROPIOS = { 0xe08e: "♂", 0xe08f: "♀" };
function texto(vista, inicio, maximo) {
  let salida = "";
  for (let i = 0; i < maximo; i++) {
    const c = vista.getUint16(inicio + i * 2, true);
    if (!c) break;
    salida += PROPIOS[c] || String.fromCharCode(c);
  }
  return salida;
}

function leerPokemon(cifrado, enEquipo) {
  const v = descifrar(cifrado);
  return v ? interpretar(v, enEquipo) : null;
}

// Lo que se usa de un Pokémon ya descifrado (null si el hueco está vacío)
export function interpretar(v, enEquipo) {
  const especie = v.getUint16(0x08, true);
  if (!especie) return null;

  const pid = v.getUint32(0x18, true);
  const tid = v.getUint16(0x0c, true);
  const sid = v.getUint16(0x0e, true);
  const ivs = v.getUint32(0x74, true);
  const p = {
    especie,
    forma: v.getUint8(0x1d) >> 3,
    genero: ["M", "F", ""][(v.getUint8(0x1d) >> 1) & 3] || "",
    mote: (ivs >>> 31) ? texto(v, 0x40, 12) : "",
    huevo: Boolean((ivs >>> 30) & 1),
    shiny: (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 16,
    objeto: objetoWeb3DS(v.getUint16(0x0a, true)),
    habilidad: v.getUint8(0x14),
    naturaleza: v.getUint8(0x1c),
    experiencia: v.getUint32(0x10, true),
    ataques: [0x5a, 0x5c, 0x5e, 0x60].map((o) => v.getUint16(o, true)).filter(Boolean),
    ivs: [0, 5, 10, 20, 25, 15].map((b) => (ivs >>> b) & 31), // PS, Ata, Def, AtE, DfE, Vel
    evs: [0x1e, 0x1f, 0x20, 0x22, 0x23, 0x21].map((o) => v.getUint8(o)),
    lugar: v.getUint16(0xda, true),
    lugarHuevo: v.getUint16(0xd8, true),
    nivelCaptura: v.getUint8(0xdd) & 0x7f,
    fechaCaptura: `20${String(v.getUint8(0xd4)).padStart(2, "0")}-${String(v.getUint8(0xd5)).padStart(2, "0")}-${String(v.getUint8(0xd6)).padStart(2, "0")}`,
    ball: v.getUint8(0xdc),
    origen: VERSIONES[v.getUint8(0xdf)] || "",
    entrenador: texto(v, 0xb0, 12),
    llave: v.getUint32(0, true) // distingue a cada Pokémon aunque cambie de caja
  };
  if (enEquipo) {
    p.nivel = v.getUint8(0xec);
    p.ps = v.getUint16(0xf0, true);
    p.psMax = v.getUint16(0xf2, true);
  }
  return p;
}

// ---------- Partida ----------

// Dónde está un hueco dentro del archivo. sitio: { equipo: 0..5 } o { caja, hueco }
export function posicionHueco(bytes, sitio) {
  const juego = JUEGOS[bytes.length];
  const tabla = bloques(bytes);
  if (sitio.equipo !== undefined) {
    return { inicio: tabla[juego.bloques.equipo].inicio + sitio.equipo * TAM_POKEMON_EQUIPO, largo: TAM_POKEMON_EQUIPO };
  }
  return { inicio: tabla[juego.bloques.cajas].inicio + (sitio.caja * POR_CAJA + sitio.hueco) * TAM_POKEMON, largo: TAM_POKEMON };
}

// Dónde está cuántos Pokémon hay en el equipo (un byte, detrás de los seis huecos)
export function posicionCuantos(bytes) {
  const juego = JUEGOS[bytes.length];
  return bloques(bytes)[juego.bloques.equipo].inicio + 6 * TAM_POKEMON_EQUIPO;
}

// El entrenador, para los Pokémon que se crean. nombre: los bytes tal cual (13 letras de 2
// bytes con el 0 del final), que van igual en el Pokémon. Gen 7 lo tiene todo en otro sitio.
const ENTRENADOR = {
  6: { region: 0x26, pais: 0x27, consola: 0x2c, idioma: 0x2d, nombre: 0x48 },
  7: { region: 0x2e, pais: 0x2f, consola: 0x34, idioma: 0x35, nombre: 0x38 }
};

export function entrenadorDe(bytes) {
  const juego = JUEGOS[bytes.length];
  if (!juego) throw new Error("No parece una partida de 3DS.");
  const o = ENTRENADOR[juego.gen];
  const b = bloques(bytes)[juego.bloques.entrenador];
  const v = new DataView(bytes.buffer, bytes.byteOffset + b.inicio, b.largo);
  return {
    tid: v.getUint16(0x00, true),
    sid: v.getUint16(0x02, true),
    version: v.getUint8(0x04),
    genero: v.getUint8(0x05),
    region: v.getUint8(o.region),
    pais: v.getUint8(o.pais),
    consola: v.getUint8(o.consola),
    idioma: v.getUint8(o.idioma),
    nombre: bytes.slice(b.inicio + o.nombre, b.inicio + o.nombre + 0x1a)
  };
}

// Cajas desbloqueadas: en gen 7 se abren según se llenan (byte 0x5E1 del bloque de las cajas)
export function cajasAbiertas(bytes) {
  const juego = JUEGOS[bytes.length];
  if (juego.gen !== 7) return juego.cajas;
  const n = bytes[bloques(bytes)[juego.bloques.cajasInfo].inicio + 0x5e1];
  return Math.max(1, Math.min(juego.cajas, n || juego.cajas));
}

export function leerPartida3DS(bytes) {
  const juego = JUEGOS[bytes.length];
  if (!juego) throw new Error("No parece una partida de 3DS.");
  const tabla = bloques(bytes);
  const bloque = (nombre) => {
    const b = tabla[juego.bloques[nombre]];
    return new DataView(bytes.buffer, bytes.byteOffset + b.inicio, b.largo);
  };

  const ent = bloque("entrenador");
  const version = VERSIONES[ent.getUint8(0x04)];

  const eq = bloque("equipo");
  const cuantos = Math.min(6, bytes[posicionCuantos(bytes)]);
  const equipo = [];
  for (let i = 0; i < cuantos; i++) {
    const inicio = eq.byteOffset + i * TAM_POKEMON_EQUIPO;
    const p = leerPokemon(bytes.buffer.slice(inicio, inicio + TAM_POKEMON_EQUIPO), true);
    if (p) equipo.push(p);
  }

  const info = bloque("cajasInfo");
  const cj = bloque("cajas");
  const cajas = [];
  for (let c = 0; c < juego.cajas; c++) {
    const pokemon = [];
    for (let s = 0; s < POR_CAJA; s++) {
      const inicio = cj.byteOffset + (c * POR_CAJA + s) * TAM_POKEMON;
      const p = leerPokemon(bytes.buffer.slice(inicio, inicio + TAM_POKEMON), false);
      if (p) pokemon.push({ ...p, hueco: s });
    }
    cajas.push({ nombre: texto(info, c * 0x22, 16) || `Caja ${c + 1}`, pokemon });
  }

  // Las medallas (un bit cada una), en el bloque de varios (dinero, medallas...). En Alola no hay.
  const varios = juego.bloques.varios !== undefined ? bloque("varios") : null;
  const medallas = varios ? Array.from({ length: 8 }, (_, i) => Boolean((varios.getUint8(0xc) >> i) & 1)) : null;

  return {
    juego: juego.id,
    version: version || "",
    gen: juego.gen,
    entrenador: texto(ent, ENTRENADOR[juego.gen].nombre, 12),
    medallas,
    abiertas: cajasAbiertas(bytes),
    equipo,
    cajas
  };
}
