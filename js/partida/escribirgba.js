// ---------- Escribir en una partida de GBA (Rojo Fuego / Verde Hoja) ----------
//
// Lo mismo que ./escribirds.js: meter Pokémon (ya descifrados y cambiados) en huecos del equipo o de las cajas,
// y dejar la partida como la dejaría el juego.
//
//   1) El Pokémon (./gba.js): la suma de sus 48 bytes de datos (en +28), el barajado de sus cuatro trozos
//      (PID % 24) y el XOR con PID ^ ID del entrenador.
//   2) La suma de cada sector tocado (en +0xFF6). Se cambia la copia buena (la de contador más alto), que es la
//      que carga el juego; la otra se queda como estaba (la vieja).
//
// Un Pokémon de las cajas puede quedar partido entre dos sectores (cada uno guarda 0xF80 bytes): se escribe
// cada trozo en el suyo. Nada se da por bueno: se vuelve a leer, se miran las sumas y los huecos, y fuera de lo
// tocado no puede haber cambiado ni un byte.
//
// Un «crudo» aquí: la cabecera (32 bytes), los cuatro trozos ya descifrados y en orden (G, A, E, M) y, en el
// equipo, lo del equipo (nivel, PS, estadísticas): 80 bytes en las cajas y 100 en el equipo.

import {
  mapaGBA, crudoGBA, empaquetarGBA, sumaSectorGBA, descifrarGen3, especieNacional, leerPartidaGBA, SECTOR_GBA, USADO_GBA, TAM_POKEMON_GBA, TAM_EQUIPO_GBA,
  CAJAS_GBA, POR_CAJA_GBA, CUANTOS_GBA, EQUIPO_GBA
} from "./gba.js";

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

const ORDEN = [
  "GAEM", "GAME", "GEAM", "GEMA", "GMAE", "GMEA", "AGEM", "AGME", "AEGM", "AEMG", "AMGE", "AMEG",
  "EGAM", "EGMA", "EAGM", "EAMG", "EMGA", "EMAG", "MGAE", "MGEA", "MAGE", "MAEG", "MEGA", "MEAG"
];

// Los bloques de la partida: el del entrenador (trozo 0), el grande (1-4) y el de las cajas (5-13)
const BLOQUES = { pequeno: 0, grande: 1, cajas: 5 };
const SUMA = 0xff6;

// Dónde está en el archivo el byte «o» del bloque (por sectores de 0xF80 bytes útiles)
function enArchivo(mapa, bloque, o) {
  return mapa.trozos[BLOQUES[bloque] + Math.floor(o / USADO_GBA)] + (o % USADO_GBA);
}

// Escribe «datos» en el bloque desde «o» (repartido entre sectores si hace falta) y apunta los sectores tocados
function escribirEn(nuevo, mapa, bloque, o, datos, tocados) {
  for (let k = 0; k < datos.length; k++) {
    const sitio = enArchivo(mapa, bloque, o + k);
    nuevo[sitio] = datos[k];
    tocados.add(sitio - (sitio % SECTOR_GBA));
  }
}

function leerDe(bytes, mapa, bloque, o, largo) {
  const salida = new Uint8Array(largo);
  for (let k = 0; k < largo; k++) salida[k] = bytes[enArchivo(mapa, bloque, o + k)];
  return salida;
}

// ---------- Permiso ----------

export function sePuedeEditarGBA(bytes) {
  if (!mapaGBA(bytes)) return { ok: false, motivo: "Ese archivo no es una partida que se sepa leer." };
  return { ok: true, motivo: "" };
}

// ---------- Huecos ----------

// sitio: { equipo } o { caja, hueco } -> { bloque, o, largo }
function posicion(sitio) {
  if (sitio.equipo !== undefined) {
    if (sitio.equipo < 0 || sitio.equipo >= 6) throw new Error("Ese hueco del equipo no existe.");
    return { bloque: "grande", o: EQUIPO_GBA + sitio.equipo * TAM_EQUIPO_GBA, largo: TAM_EQUIPO_GBA };
  }
  if (sitio.caja < 0 || sitio.caja >= CAJAS_GBA || sitio.hueco < 0 || sitio.hueco >= POR_CAJA_GBA) throw new Error("Ese hueco no existe.");
  return { bloque: "cajas", o: 4 + (sitio.caja * POR_CAJA_GBA + sitio.hueco) * TAM_POKEMON_GBA, largo: TAM_POKEMON_GBA };
}

// Descifrado y en orden (ver arriba), o null si está vacío (o no se puede leer)
export function leerHuecoGBA(bytes, sitio) {
  bytes = crudoGBA(bytes);
  const mapa = bytes && mapaGBA(bytes);
  if (!mapa) return null;
  const { bloque, o, largo } = posicion(sitio);
  const cifrado = leerDe(bytes, mapa, bloque, o, largo);
  const datos = descifrarGen3(cifrado, 0);
  if (!datos || !especieNacional(u16(datos, 0))) return null;
  const crudo = cifrado.slice();
  crudo.set(datos, 32);
  return crudo;
}

export function huecoVacioGBA(bytes, sitio) {
  return new Uint8Array(posicion(sitio).largo);
}

// La suma de los 48 bytes de datos (de 2 en 2), la que va en +28
export function sumaGen3(crudo) {
  let suma = 0;
  for (let i = 32; i < 80; i += 2) suma += u16(crudo, i);
  return suma & 0xffff;
}

// Lo contrario de descifrar: suma, barajado y XOR. Devuelve una copia. Un hueco vacío (todo ceros) se queda así.
export function cifrarGen3(crudo) {
  const datos = new Uint8Array(crudo);
  if (datos.every((byte) => !byte)) return datos;
  poner16(datos, 28, sumaGen3(datos));
  const pid = u32(datos, 0);
  const llave = (pid ^ u32(datos, 4)) >>> 0;
  const enOrden = datos.slice(32, 80);
  const orden = ORDEN[pid % 24];
  [..."GAEM"].forEach((trozo, k) => datos.set(enOrden.subarray(k * 12, k * 12 + 12), 32 + orden.indexOf(trozo) * 12));
  for (let i = 32; i < 80; i += 4) poner32(datos, i, (u32(datos, i) ^ llave) >>> 0);
  return datos;
}

function iguales(uno, otro) {
  return uno.length === otro.length && uno.every((byte, i) => byte === otro[i]);
}

// Tras cambiar unos bytes: la suma de cada sector tocado y que la partida se siga leyendo igual, de la misma copia
function cerrarCambios(original, nuevo, mapa, tocados) {
  for (const inicio of tocados) poner16(nuevo, inicio + SUMA, sumaSectorGBA(nuevo, inicio));
  const despues = mapaGBA(nuevo);
  if (!despues || despues.trozos.join() !== mapa.trozos.join() || despues.contador !== mapa.contador) {
    throw new Error("Las sumas de la partida no han quedado bien.");
  }
  for (let i = 0; i < nuevo.length; i++) {
    if (nuevo[i] === original[i]) continue;
    const sector = i - (i % SECTOR_GBA);
    if (!tocados.has(sector) || (i - sector >= USADO_GBA && i - sector !== SUMA && i - sector !== SUMA + 1)) throw new Error("Ha cambiado algo que no debía.");
  }
  leerPartidaGBA(nuevo); // que se siga pudiendo leer entera
}

// Como editarHuecosDS de ./escribirds.js: cambios [{ sitio, crudo }], cuantosEquipo si cambia. (Las de No$GBA se
// desempaquetan para cambiarlas y se vuelven a empaquetar igual: ver ./gba.js)
export function editarHuecosGBA(archivo, cambios, cuantosEquipo) {
  const permiso = sePuedeEditarGBA(archivo);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const original = crudoGBA(archivo);
  const mapa = mapaGBA(original);
  const nuevo = original.slice();
  const tocados = new Set();
  for (const { sitio, crudo } of cambios) {
    const { bloque, o, largo } = posicion(sitio);
    if (crudo.length !== largo) throw new Error("El Pokémon no tiene el tamaño de ese hueco.");
    escribirEn(nuevo, mapa, bloque, o, cifrarGen3(crudo), tocados);
  }
  if (cuantosEquipo !== undefined) {
    if (cuantosEquipo < 1 || cuantosEquipo > 6) throw new Error("El equipo tiene que tener de 1 a 6 Pokémon.");
    escribirEn(nuevo, mapa, "grande", CUANTOS_GBA, [cuantosEquipo], tocados);
  }
  cerrarCambios(original, nuevo, mapa, tocados);
  for (const { sitio, crudo } of cambios) {
    const releido = leerHuecoGBA(nuevo, sitio);
    const vacio = crudo.every((byte) => !byte);
    if (vacio ? releido : !releido || !iguales(releido.subarray(32), crudo.subarray(32)) || !iguales(releido.subarray(0, 28), crudo.subarray(0, 28))) {
      throw new Error("Un Pokémon no se ha guardado bien.");
    }
  }
  return empaquetarGBA(archivo, nuevo);
}

export function cuantosEquipoGBA(bytes) {
  return Math.min(6, mapaGBA(bytes).grande[CUANTOS_GBA]);
}

// ---------- La bolsa (./mochilagba.js) ----------

// Cambia esos trozos del bloque grande ([{ o, datos }]) y deja la partida bien
export function escribirGrandeGBA(archivo, trozos) {
  const permiso = sePuedeEditarGBA(archivo);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const original = crudoGBA(archivo);
  const mapa = mapaGBA(original);
  const nuevo = original.slice();
  const tocados = new Set();
  for (const { o, datos } of trozos) escribirEn(nuevo, mapa, "grande", o, datos, tocados);
  cerrarCambios(original, nuevo, mapa, tocados);
  return empaquetarGBA(archivo, nuevo);
}

// ---------- El entrenador ----------

// Lo que hace falta para crear uno como suyo: { tid, sid, nombre (sus 7 letras del juego y el final), idioma,
// genero (1: chica), version (4 Rojo Fuego, 5 Verde Hoja) }. El idioma y la versión no los guarda la partida:
// salen de sus propios Pokémon (si no tiene, Rojo Fuego en español)
export function entrenadorGBA(bytes) {
  const mapa = mapaGBA(bytes);
  const p = mapa.pequeno;
  const tid = u16(p, 0x0a);
  const sid = u16(p, 0x0c);
  let idioma = 7;
  let version = 4;
  const mirar = (b, o) => {
    const datos = descifrarGen3(b, o);
    if (!datos || !especieNacional(u16(datos, 0)) || u32(b, o + 4) !== ((tid | (sid << 16)) >>> 0)) return false;
    const juego = (u16(datos, 38) >> 7) & 15;
    if (juego !== 4 && juego !== 5) return false;
    idioma = b[o + 18];
    version = juego;
    return true;
  };
  let visto = false;
  for (let i = 0; i < Math.min(6, mapa.grande[CUANTOS_GBA]) && !visto; i++) visto = mirar(mapa.grande, EQUIPO_GBA + i * TAM_EQUIPO_GBA);
  for (let i = 0; i < CAJAS_GBA * POR_CAJA_GBA && !visto; i++) visto = mirar(mapa.cajas, 4 + i * TAM_POKEMON_GBA);
  const nombre = new Uint8Array(7).fill(0xff);
  nombre.set(p.subarray(0, 7));
  return { tid, sid, nombre, idioma, genero: p[8] & 1, version };
}
