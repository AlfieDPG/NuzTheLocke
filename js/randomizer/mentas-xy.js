// ---------- Las mentas en 3DS: X e Y, Rubí Omega y Zafiro Alfa, Sol y Luna, Ultrasol y Ultraluna ----------
//
// Como ./mentas-gen5.js para la 3DS: 21 objetos nuevos que cambian la naturaleza de un Pokémon del equipo, en los
// huecos sin usar del 505 al 525 (las Tarjetas de datos de HeartGold y SoulSilver: en X e Y, objetos vacíos con el
// icono de «?»). En X e Y los objetos se usan en el equipo desde la propia Bolsa (DllBag.cro), así que:
//   · sus datos (a/2/2/0: los del Caramelo Raro, con su precio y sin efectos), su nombre (los cuatro archivos de
//     nombres) y su descripción en todos los idiomas del cartucho, y un mensaje por menta al final del archivo de
//     textos de la Bolsa;
//   · sus iconos: seis nuevos al final de a/0/9/4 (uno por color; cada icono lleva su paleta) y su fila en la tabla
//     del programa que dice qué icono usa cada objeto (eso va en el parche del programa, exefs/code.ips);
//   · el programa (./codigo-mentas-xy.js, de herramientas/mentas-xy.s), en el hueco libre del final del código de la
//     Bolsa: se cambian sus llamadas a comprobar, clasificar y aplicar un objeto (a los trampolines del programa) y el
//     caso 9 de los mensajes (una reubicación del módulo: la tabla de saltos la rellena el juego al cargarlo).
// En 6.ª generación la naturaleza es un dato aparte: el programa usa la función del juego que la cambia y recalcula las
// estadísticas. Las direcciones salen del programa y de la Bolsa leyendo el código por su forma (ver direccionesMentasXY).
// Rubí Omega y Zafiro Alfa son casi iguales: otros archivos (ARCHIVOS_MENTAS), un dato más en los objetos antes de los
// efectos y, en el mensaje, los registros cambiados.

import { CODIGO, SITIOS } from "./codigo-mentas-xy.js";
import { DIBUJO_MENTA_DS, PALETAS_MENTA } from "./dibujos-mentas.js";
import { NATURALEZAS, TEXTOS, NATURALEZA_MENTA, colorDe, PRECIO_MENTA_GEN4 } from "./mentas-gen4.js";
import { leerGarc, crearGarc, descomprimirLZ11, comprimirLZ11 } from "./rom-3ds.js";
import { leerTextos6, escribirTextos6 } from "./textos-3ds.js";

export const PRIMERA_MENTA_XY = 505;
export const MENTAS_XY = 21;

const CODE = 0x100000; // dónde se carga el programa
const CARAMELO_RARO = 50;
const TIPO_MENTA = 9; // el tipo que la Bolsa ve en las mentas (herramientas/mentas-xy.s)
export const ESTATICO = "static.crs";
// Por juego: el módulo de la Bolsa, los datos de los objetos, sus iconos (en Sol y Luna, en otro formato: flim) y los
// archivos de texto (en cada idioma): nombres (los singulares y los plurales), descripciones y la Bolsa (y la línea que
// se copia para el mote: «X se ha despertado.»)
export const ARCHIVOS_MENTAS = {
  xy: { modulo: "DllBag.cro", datos: "a/2/2/0", iconos: "a/0/9/4", nombres: [95, 96, 97, 98], descripcion: 99, bolsa: 140, modelo: 120 },
  oras: { modulo: "DllBag.cro", datos: "a/1/9/7", iconos: "a/0/9/2", nombres: [113, 114, 115, 116], descripcion: 117, bolsa: 164, modelo: 120 },
  // (en Sol y Luna, además, la tabla del bolsillo de cada objeto: medio byte por objeto; la Bolsa busca ahí el objeto para
  // quitarlo al usarlo: sin esto, la menta no se gasta)
  sm: { modulo: "Bag.cro", datos: "a/0/1/9", iconos: "a/0/6/1", nombres: [36, 37, 38], descripcion: 35, bolsa: 1, modelo: 71, flim: true, bolsillos: "a/1/0/2" },
  usum: { modulo: "Bag.cro", datos: "a/0/1/9", iconos: "a/0/6/1", nombres: [40, 41, 42], descripcion: 39, bolsa: 1, modelo: 71, flim: true, bolsillos: "a/1/0/3" }
};
// Los GARC de textos, por idioma (como textoRutas en ./juego-3ds.js): japonés (dos), inglés, francés, italiano, alemán,
// español, coreano y, en Sol y Luna, chino (dos)
const IDIOMAS_XY = ["E", "E", "E", "F", "I", "D", "S", "E", "E", "E"];

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
const deHex = (texto) => Uint8Array.from(texto.match(/../g).map((x) => parseInt(x, 16)));

// ---------- Leer el código (ARM) ----------

// A dónde salta el «b» o «bl» (con cualquier condición) que hay en «o» (b se carga en «base»), o -1
function salto(b, o, base) {
  const w = u32(b, o);
  if (((w >>> 25) & 7) !== 5 || w >>> 28 === 0xf) return -1;
  return base + o + 8 + (((w & 0xffffff) << 8) >> 6);
}
const esBL = (b, o) => u32(b, o) >>> 28 !== 0xf && ((u32(b, o) >>> 24) & 0xf) === 0xb;

// Un salto en «o» a «destino», con la condición y el tipo (b o bl) que ya tenía
function ponerSalto(b, o, destino) {
  const w = u32(b, o);
  const d = (destino - (o + 8)) >> 2;
  if (d < -0x800000 || d >= 0x800000) throw new Error("El salto a las mentas no llega.");
  poner32(b, o, ((w & 0xff000000) | (d & 0xffffff)) >>> 0);
}

// ¿Están estos bytes en «o»? (cada «??», cualquiera)
function encaja(b, o, patron) {
  const partes = patron.replace(/ /g, "").match(/../g);
  if (o + partes.length > b.length) return false;
  return partes.every((p, k) => p === "??" || b[o + k] === parseInt(p, 16));
}
function buscarTodos(b, patron) {
  const sitios = [];
  const primero = parseInt(patron.slice(0, 2), 16);
  for (let o = 0; o + 4 <= b.length; o += 4) if (b[o] === primero && encaja(b, o, patron)) sitios.push(o);
  return sitios;
}
const esPush = (w) => (w & 0xffff4000) >>> 0 === 0xe92d4000;

// ---------- Los módulos (CRO) ----------

// Sus segmentos: [{ desde, tam }] (en el archivo)
function segmentos(c) {
  const t = u32(c, 0xc8);
  return Array.from({ length: u32(c, 0xcc) }, (_, i) => ({ desde: u32(c, t + i * 12), tam: u32(c, t + i * 12 + 4) }));
}
// Lo que importa del programa: dirección de la función -> los sitios del módulo que el juego rellena con ella
function importados(c, estatico) {
  const ss = segmentos(estatico);
  const cs = segmentos(c);
  const t = u32(c, 0x110);
  const r = new Map();
  for (let i = 0; i < u32(c, 0x114); i++) {
    const so = u32(c, t + i * 8);
    const destino = ss[so & 0xf].desde + (so >>> 4);
    for (let o = u32(c, t + i * 8 + 4); ; o += 12) {
      const sitio = u32(c, o);
      if (!r.has(destino)) r.set(destino, []);
      r.get(destino).push(cs[sitio & 0xf].desde + (sitio >>> 4));
      if (c[o + 5]) break;
    }
  }
  return r;
}
// Sus reubicaciones (las de dentro del módulo): sitio -> { fila (dónde está la reubicación), destino }
function reubicaciones(c) {
  const cs = segmentos(c);
  const t = u32(c, 0x128);
  const r = new Map();
  for (let i = 0; i < u32(c, 0x12c); i++) {
    const o = t + i * 12;
    const sitio = u32(c, o);
    r.set(cs[sitio & 0xf].desde + (sitio >>> 4), { fila: o, destino: cs[c[o + 5]].desde + u32(c, o + 8) });
  }
  return r;
}

// ---------- Las direcciones ----------

// Del programa (code.bin)
function delPrograma(code) {
  const enCode = (o) => CODE + o;
  // La que lee un dato de un objeto: «cmp r1, #0x13; ldrlo pc, [pc, r1, lsl #2]» (hay más con esa forma: es la que
  // llaman comprobar, aplicar y clasificar). Las que la llaman, con los datos que leen en orden («mov r1, #dato» antes
  // de cada llamada). En Rubí Omega y Zafiro Alfa hay un dato más antes de los efectos («cmp r1, #0x14»): los de los
  // efectos van uno más arriba (d)
  const funcionesDe = (leer) => {
    const datosDe = new Map();
    for (let o = 0; o + 4 <= code.length; o += 4) {
      if (!esBL(code, o) || salto(code, o, CODE) !== leer) continue;
      let dato = "?";
      for (let k = 4; k <= 24; k += 4) {
        const w = u32(code, o - k);
        if ((w & 0xfffff000) >>> 0 === 0xe3a01000) {
          dato = (w & 0xff).toString(16);
          break;
        }
      }
      let f = o;
      while (f > 0 && o - f < 0x2000 && !esPush(u32(code, f))) f -= 4;
      if (!datosDe.has(f)) datosDe.set(f, []);
      datosDe.get(f).push(dato);
    }
    // (los datos, como en X e Y; los de los efectos, del 0x13 en adelante, + d)
    const conDatos = (prefijo) => {
      const buscado = prefijo.split(" ").map((x) => (parseInt(x, 16) >= 0x13 ? (parseInt(x, 16) + d).toString(16) : x)).join(" ") + " ";
      return [...datosDe].filter(([, l]) => (l.join(" ") + " ").startsWith(buscado)).map(([f]) => enCode(f));
    };
    return {
      comprobar: conDatos("f 13 14 15 16 17 1b 1c 1d 2a 1d"),
      aplicar: conDatos("f 13 14 15 16 17 1b 1c 1d 2a 3b"),
      clasificar: conDatos("f 1c 1d 13 14 15 16 17 18 19 2a")
    };
  };
  let d = 0;
  let halladas = [];
  for (d = 0; d <= 1 && !halladas.length; d++) {
    halladas = buscarTodos(code, `1${3 + d}0051e3 01f19f37`).map((o) => funcionesDe(enCode(o))).filter((f) => f.comprobar.length || f.aplicar.length);
  }
  if (halladas.length !== 1) return null;
  const { comprobar, aplicar, clasificar } = halladas[0];
  if (comprobar.length !== 1 || aplicar.length !== 1 || clasificar.length !== 1) return null;
  // De los datos del Pokémon (CoreParam): la naturaleza (bloque A + 0x14) y si es un huevo (bit 30 de los IV)
  const naturaleza = buscarTodos(code, "70402de9 0050a0e1 ???????? 0010a0e3 0500a0e1 ???????? 1440d0e5 0500a0e1 ???????? 0400a0e1 7080bde8");
  const huevo = buscarTodos(code, "70402de9 0050a0e1 ???????? 0010a0e3 0500a0e1 ???????? 340090e5 010100e2 204fa0e1");
  // Cambiar la naturaleza (PokemonParam): la pone en sus datos y recalcula las estadísticas
  const cambiar = buscarTodos(code, "10402de9 0040a0e1 0c0090e5 ???????? 0400a0e1 1040bde8 0110a0e3").filter((o) => {
    const d = salto(code, o + 12, CODE) - CODE;
    return d > 0 && encaja(code, d, "70402de9 0140a0e1 0050a0e1 ???????? 0110a0e3 0500a0e1 ???????? 1440c0e5");
  });
  if (naturaleza.length !== 1 || huevo.length !== 1 || cambiar.length !== 1) return null;
  // La tabla de iconos (u32 por objeto): los primeros, 0, 1, 2...; el vacío (0) y los huecos de las mentas, el de «?»
  let iconos = -1;
  for (let t = 0; t + 532 * 4 <= code.length && iconos < 0; t += 4) {
    if (u32(code, t + 4) !== 0 || u32(code, t + 8) !== 1 || u32(code, t + 12) !== 2) continue;
    const vacio = u32(code, t);
    let bien = vacio > 2 && u32(code, t + 113 * 4) === vacio;
    for (let id = 505; id <= 531 && bien; id++) bien = u32(code, t + id * 4) === vacio;
    if (bien) iconos = t;
  }
  if (iconos < 0) return null;
  return {
    comprobar: comprobar[0], aplicar: aplicar[0], clasificar: clasificar[0],
    naturaleza: enCode(naturaleza[0]), esHuevo: enCode(huevo[0]), cambiarNaturaleza: enCode(cambiar[0]), tablaIconos: iconos
  };
}

// Lo que importa por su nombre (Sol y Luna): nombre -> los sitios del módulo que el juego rellena con esa función
function importadosPorNombre(c) {
  const cs = segmentos(c);
  const t = u32(c, 0x100);
  const r = new Map();
  for (let i = 0; i < u32(c, 0x104); i++) {
    let nombre = "";
    for (let k = u32(c, t + i * 8); c[k]; k++) nombre += String.fromCharCode(c[k]);
    for (let o = u32(c, t + i * 8 + 4); ; o += 12) {
      const sitio = u32(c, o);
      if (!r.has(nombre)) r.set(nombre, []);
      r.get(nombre).push(cs[sitio & 0xf].desde + (sitio >>> 4));
      if (c[o + 5]) break;
    }
  }
  return r;
}

// Las tablas de los «switch» por tipo de objeto: «cmp rX, #0x1c» y, enseguida, «ldrlo pc, [pc, rX, lsl #2]»
function tablasDeTipos(c) {
  const tablas = [];
  for (let o = 8; o + 4 <= c.length; o += 4) {
    const w = u32(c, o);
    if ((w & 0xfffffff0) >>> 0 !== 0x379ff100) continue;
    const cmp = (0xe350001c | ((w & 0xf) << 16)) >>> 0;
    if (u32(c, o - 4) === cmp || u32(c, o - 8) === cmp) tablas.push(o + 8);
  }
  return tablas;
}

// De la Bolsa (DllBag.cro; Bag.cro en Sol y Luna), con lo que importa del programa (static.crs). En X / Y y Rubí Omega /
// Zafiro Alfa importa comprobar, aplicar y clasificar por su dirección; en Sol y Luna, por su nombre (y las dos primeras
// son otras que envuelven a esas, con los mismos argumentos)
function deLaBolsa(c, estatico, p) {
  const imp = importados(c, estatico);
  const conNombre = importadosPorNombre(c);
  // «ldr pc, [pc, #-4]» y la dirección detrás
  const trampolinEn = (sitios) => (sitios.length === 1 && u32(c, sitios[0] - 4) === 0xe51ff004 ? sitios[0] - 4 : -1);
  const trampolin = (destino, nombre) => {
    const t = trampolinEn(imp.get(destino) || []);
    if (t >= 0) return t;
    const n = [...conNombre.keys()].filter((k) => k.includes(nombre));
    return n.length === 1 ? trampolinEn(conNombre.get(n[0])) : -1;
  };
  const tComprobar = trampolin(p.comprobar, "21ITEM_RCV_RecoverCheck");
  const tAplicar = trampolin(p.aplicar, "16ITEM_RCV_Recover");
  const tClasificar = trampolin(p.clasificar, "ITEM_UTIL_GetHealingItemType");
  if (tComprobar < 0 || tAplicar < 0 || tClasificar < 0) return null;
  const codigo = segmentos(c)[0];
  const llamadasA = (t) => {
    const l = [];
    for (let o = codigo.desde; o < codigo.desde + codigo.tam; o += 4) if (esBL(c, o) && salto(c, o, 0) === t) l.push(o);
    return l;
  };
  const reub = reubicaciones(c);
  const caso = (t, k) => (reub.get(t + k * 4) || {}).destino;
  const tablas = tablasDeTipos(c);
  // La que hace lo que toca según el tipo: justo después de clasificar. Con el tipo de las mentas tiene que hacer lo mismo
  // que con el 2 (suena, aplica y pone el mensaje)
  const usos = tablas.filter((t) => {
    for (let k = 12; k <= 0x40; k += 4) if (esBL(c, t - k) && salto(c, t - k, 0) === tClasificar) return true;
    return false;
  });
  if (usos.length !== 1 || caso(usos[0], TIPO_MENTA) === undefined || caso(usos[0], TIPO_MENTA) !== caso(usos[0], 2)) return null;
  // La de los mensajes, por cómo pone el del tipo 2 («se ha despertado»):
  //   X / Y y Rubí Omega / Zafiro Alfa: poner el mote, coger el texto, formarlo y ponerlo; y el final común (el número del
  //     texto y el texto van en r5 y r6, o al revés en Rubí Omega y Zafiro Alfa: da igual, la función los guarda)
  //   Sol y Luna: poner el mote y formar el texto con su número; y el final común
  const MENSAJE6 = "080094e5 0720a0e1 0010a0e3 ???????? 080094e5 ????a0e3 0110a0e3 ???????? 00??a0e1 080094e5 ??20a0e1 ??10a0e1 ???????? 080094e5 ??10a0e1 ????????";
  const MENSAJE7 = "0720a0e1 0010a0e3 0900a0e1 ???????? ??20a0e3 0810a0e1 0900a0e1 ????????";
  const mensajes = tablas.filter((t) => caso(t, 2) !== undefined && (encaja(c, caso(t, 2), MENSAJE6) || encaja(c, caso(t, 2), MENSAJE7)));
  if (mensajes.length !== 1) return null;
  const fila9 = reub.get(mensajes[0] + TIPO_MENTA * 4);
  const m = caso(mensajes[0], 2);
  if (!fila9) return null;
  let mensaje;
  if (encaja(c, m, MENSAJE6)) {
    const saltos = [12, 28, 48, 60].map((k) => (esBL(c, m + k) ? salto(c, m + k, 0) : -1));
    if (saltos.some((s) => s < 0)) return null;
    mensaje = { variante: 6, mote: saltos[0], texto: saltos[1], formar: saltos[2], poner: saltos[3], finMensaje: m + 64 };
  } else {
    // (el objeto va en el r5 de quien la llama, que la función guarda en [sp + 0x10]: «push {r4-r9, lr}; ...; sub sp, #0xc»)
    let f = m;
    while (f > 0 && m - f < 0x800 && !esPush(u32(c, f))) f -= 4;
    if (!encaja(c, f, "f0432de9 ???????? 0cd04de2")) return null;
    let fin = -1;
    for (let k = 32; k <= 48 && fin < 0; k += 4) if (u32(c, m + k) >>> 24 === 0xea) fin = salto(c, m + k, 0);
    if (fin < 0 || !esBL(c, m + 12) || !esBL(c, m + 28)) return null;
    mensaje = { variante: 7, mote: salto(c, m + 12, 0), formar: salto(c, m + 28, 0), finMensaje: fin };
  }
  // El hueco libre tras el código (hasta el siguiente segmento)
  const fin = (codigo.desde + codigo.tam + 3) & ~3;
  const siguiente = Math.min(...segmentos(c).map((s) => s.desde).filter((d) => d > codigo.desde));
  if (siguiente - fin < CODIGO.length / 2) return null;
  return {
    tComprobar, tAplicar, tClasificar,
    llamadasComprobar: llamadasA(tComprobar), llamadasAplicar: llamadasA(tAplicar), llamadasClasificar: llamadasA(tClasificar),
    filaMensaje: fila9.fila, ...mensaje, hueco: fin
  };
}

// Todas (null si esta versión no es como las conocidas). code: el programa; bolsa y estatico, los módulos
export function direccionesMentasXY(code, bolsa, estatico) {
  const p = delPrograma(code);
  if (!p) return null;
  const b = deLaBolsa(bolsa, estatico, p);
  return b ? { ...p, ...b } : null;
}

// ¿Están ya? (el programa, en la Bolsa)
export function mentasYaPuestasXY(bolsa) {
  const firma = CODIGO.slice(SITIOS.comprobar * 2, (SITIOS.comprobar + 12) * 2);
  return buscarTodos(bolsa, firma).length > 0;
}

// ---------- Los iconos ----------

// El icono de una menta (como los de X e Y: u16 2, u16 colores, la paleta en RGBA5551 y los píxeles a 4 bits en cuadros
// de 8 × 8 con el orden en Z, el de la izquierda en los 4 bits altos; detrás, la cola «CLIM» del icono de modelo)
function iconoMenta(colores, modelo) {
  const ds = deHex(DIBUJO_MENTA_DS);
  const paleta = deHex(colores);
  const pixel = (x, y) => {
    const byte = ds[((y >> 3) * 4 + (x >> 3)) * 32 + (y & 7) * 4 + ((x & 7) >> 1)];
    return x & 1 ? byte >> 4 : byte & 15;
  };
  const salida = new Uint8Array(modelo.length);
  salida.set(modelo.subarray(modelo.length - 0x28), modelo.length - 0x28);
  poner16(salida, 0, 2);
  poner16(salida, 2, 16);
  for (let k = 0; k < 16; k++) {
    const c = u16(paleta, k * 2);
    const rgba = k === 0 ? 0xfffe : ((c & 31) << 11) | (((c >> 5) & 31) << 6) | (((c >> 10) & 31) << 1) | 1;
    poner16(salida, 4 + k * 2, rgba);
  }
  const datos = 4 + 32;
  for (let t = 0; t < 16; t++) {
    for (let i = 0; i < 64; i++) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < 3; k++) {
        x |= ((i >> (2 * k)) & 1) << k;
        y |= ((i >> (2 * k + 1)) & 1) << k;
      }
      const v = pixel((t % 4) * 8 + x, Math.floor(t / 4) * 8 + y);
      const o = datos + ((t * 64 + i) >> 1);
      salida[o] |= i & 1 ? v : v << 4;
    }
  }
  return salida;
}

// En Sol y Luna, los iconos son FLIM de verdad: 32 × 32 en RGBA5551 (sin paleta), en cuadros de 8 × 8 con el orden en Z y
// girados (lo que se ve en x, y va guardado en y, x); detrás, la cola «FLIM» del icono de modelo
function iconoMentaFlim(colores, modelo) {
  const ds = deHex(DIBUJO_MENTA_DS);
  const paleta = deHex(colores);
  const pixel = (x, y) => {
    const byte = ds[((y >> 3) * 4 + (x >> 3)) * 32 + (y & 7) * 4 + ((x & 7) >> 1)];
    return x & 1 ? byte >> 4 : byte & 15;
  };
  const salida = new Uint8Array(modelo.length);
  salida.set(modelo.subarray(modelo.length - 0x28), modelo.length - 0x28);
  for (let t = 0; t < 16; t++) {
    for (let i = 0; i < 64; i++) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < 3; k++) {
        x |= ((i >> (2 * k)) & 1) << k;
        y |= ((i >> (2 * k + 1)) & 1) << k;
      }
      const v = pixel(Math.floor(t / 4) * 8 + y, (t % 4) * 8 + x);
      const c = u16(paleta, v * 2);
      poner16(salida, (t * 64 + i) * 2, v === 0 ? 0 : ((c & 31) << 11) | (((c >> 5) & 31) << 6) | (((c >> 10) & 31) << 1) | 1);
    }
  }
  return salida;
}

// ---------- Ponerlas ----------

// En la sesión (./rom-3ds.js: Sesion3DS, con el programa y los archivos ya cargados). juego: «xy», «oras», «sm» o «usum». Devuelve
// false si no se puede
export function ponerMentasXY(sesion, juego, textoRutas, precio = PRECIO_MENTA_GEN4) {
  const A = ARCHIVOS_MENTAS[juego];
  if (!A) return false;
  const bolsa = sesion.archivo(A.modulo);
  if (mentasYaPuestasXY(bolsa)) return true;
  const d = direccionesMentasXY(sesion.code, bolsa, sesion.archivo(ESTATICO));
  if (!d) return false;

  // Los textos, en todos los idiomas: nombres, descripción y el mensaje de la Bolsa (con el mote como lo pone el juego)
  const cambiosTextos = new Map();
  let primerMensaje = -1;
  for (const [n, ruta] of textoRutas.entries()) {
    const idioma = IDIOMAS_XY[n] || "E";
    const textos = TEXTOS[idioma];
    const naturalezas = NATURALEZAS[idioma].split(" ");
    const aJuego = (t) => (idioma === "E" ? t.replace(/'/g, "’") : t);
    const garc = leerGarc(sesion.archivo(ruta));
    const leer = (i) => leerTextos6(garc.archivos[i]).lineas;
    const mensajes = leer(A.bolsa);
    const modelo = mensajes[A.modelo] || "";
    const v = modelo.indexOf("\u0010");
    if (v < 0) return false;
    const mote = modelo.slice(v, v + 2 + modelo.charCodeAt(v + 1));
    if (primerMensaje < 0) primerMensaje = mensajes.length;
    if (mensajes.length !== primerMensaje) return false;
    const nuevos = {};
    for (const i of A.nombres) {
      const lineas = leer(i);
      NATURALEZA_MENTA.forEach((nat, k) => (lineas[PRIMERA_MENTA_XY + k] = aJuego(textos.nombre(naturalezas[nat]))));
      nuevos[i] = escribirTextos6(garc.archivos[i], lineas);
    }
    const desc = leer(A.descripcion);
    NATURALEZA_MENTA.forEach((nat, k) => (desc[PRIMERA_MENTA_XY + k] = aJuego(textos.descripcion(naturalezas[nat]))));
    nuevos[A.descripcion] = escribirTextos6(garc.archivos[A.descripcion], desc);
    NATURALEZA_MENTA.forEach((nat) => mensajes.push(textos.mensaje(naturalezas[nat]).split("{V}").map(aJuego).join(mote)));
    nuevos[A.bolsa] = escribirTextos6(garc.archivos[A.bolsa], mensajes);
    cambiosTextos.set(ruta, crearGarc(sesion.archivo(ruta), nuevos));
  }

  // Los datos: como los del Caramelo Raro (se usan en el equipo desde la Bolsa y van en Medicinas), con su precio (en
  // decenas) y sin efectos (desde el byte 0x10: lo hace el programa); la naturaleza, en el dato del objeto
  const datos = leerGarc(sesion.archivo(A.datos));
  const caramelo = datos.archivos[CARAMELO_RARO];
  if (!caramelo || datos.archivos.length <= PRIMERA_MENTA_XY + MENTAS_XY) return false;
  const nuevosDatos = {};
  NATURALEZA_MENTA.forEach((nat, k) => {
    const dato = caramelo.slice();
    poner16(dato, 0, Math.round(precio / 10));
    dato[3] = nat;
    dato.fill(0, 0x10);
    nuevosDatos[PRIMERA_MENTA_XY + k] = dato;
  });

  // Los iconos: seis nuevos (uno por color), comprimidos como los demás; y su fila en la tabla del programa
  const iconos = leerGarc(sesion.archivo(A.iconos));
  const iconoCaramelo = u32(sesion.code, d.tablaIconos + CARAMELO_RARO * 4);
  const modelo = iconos.archivos[iconoCaramelo][0] === 0x11 ? descomprimirLZ11(iconos.archivos[iconoCaramelo]) : iconos.archivos[iconoCaramelo];
  const cola = String.fromCharCode(...modelo.subarray(modelo.length - 0x28, modelo.length - 0x24));
  if (A.flim ? cola !== "FLIM" || modelo.length < 0x28 + 2048 : modelo.length < 0x28 + 4 + 32 + 512 || u16(modelo, 0) !== 2) return false;
  const primerIcono = iconos.archivos.length;
  const nuevosIconos = {};
  PALETAS_MENTA.forEach((colores, k) => (nuevosIconos[primerIcono + k] = comprimirLZ11((A.flim ? iconoMentaFlim : iconoMenta)(colores, modelo))));
  const code = sesion.code;
  NATURALEZA_MENTA.forEach((nat, k) => poner32(code, d.tablaIconos + (PRIMERA_MENTA_XY + k) * 4, primerIcono + colorDe(nat)));

  // El programa, en el hueco de la Bolsa (que pasa a ser parte de su código), con las direcciones de este juego
  const nueva = bolsa.slice();
  const codigo = deHex(CODIGO);
  const h = d.hueco;
  nueva.set(codigo, h);
  const rellenar = {
    EsHuevo: d.esHuevo, Naturaleza: d.naturaleza, CambiarNaturaleza: d.cambiarNaturaleza, primerMensaje, tipo: TIPO_MENTA
  };
  for (const [nombre, valor] of Object.entries(rellenar)) poner32(nueva, h + SITIOS[`L_${nombre}`], valor >>> 0);
  ponerSalto(nueva, h + SITIOS.salto_comprobar, d.tComprobar);
  ponerSalto(nueva, h + SITIOS.salto_clasificar, d.tClasificar);
  ponerSalto(nueva, h + SITIOS.salto_aplicar, d.tAplicar);
  // (el mensaje, como lo pone cada Bolsa: ver deLaBolsa)
  if (d.variante === 6) {
    ponerSalto(nueva, h + SITIOS.salto_mote, d.mote);
    ponerSalto(nueva, h + SITIOS.salto_texto, d.texto);
    ponerSalto(nueva, h + SITIOS.salto_formar, d.formar);
    ponerSalto(nueva, h + SITIOS.salto_poner, d.poner);
    ponerSalto(nueva, h + SITIOS.salto_fin, d.finMensaje);
  } else {
    ponerSalto(nueva, h + SITIOS.salto7_mote, d.mote);
    ponerSalto(nueva, h + SITIOS.salto7_formar, d.formar);
    ponerSalto(nueva, h + SITIOS.salto7_fin, d.finMensaje);
  }
  for (const o of d.llamadasComprobar) ponerSalto(nueva, o, h + SITIOS.comprobar);
  for (const o of d.llamadasClasificar) ponerSalto(nueva, o, h + SITIOS.clasificar);
  for (const o of d.llamadasAplicar) ponerSalto(nueva, o, h + SITIOS.aplicar);
  // El caso 9 de los mensajes, al nuestro (la reubicación: su destino es el inicio del segmento de código + el desplazamiento)
  const cs = segmentos(nueva);
  const nuestro = d.variante === 6 ? SITIOS.mensaje : SITIOS.mensaje7;
  poner32(nueva, d.filaMensaje + 8, h + nuestro - cs[nueva[d.filaMensaje + 5]].desde);
  // El segmento de código y el tamaño del código, hasta el final del nuestro
  const tam = h + codigo.length - cs[0].desde;
  poner32(nueva, u32(nueva, 0xc8) + 4, tam);
  poner32(nueva, 0xb4, tam);

  sesion.cambiar(A.modulo, nueva);
  for (const [ruta, bytes] of cambiosTextos) sesion.cambiar(ruta, bytes);
  sesion.cambiar(A.datos, crearGarc(sesion.archivo(A.datos), nuevosDatos));
  // El bolsillo, el del Caramelo Raro (medio byte por objeto: el de número par, en los 4 bits altos)
  if (A.bolsillos) {
    const tabla = leerGarc(sesion.archivo(A.bolsillos)).archivos[0].slice();
    const medio = (id) => (id % 2 ? tabla[id >> 1] & 15 : tabla[id >> 1] >> 4);
    const bolsillo = medio(CARAMELO_RARO);
    for (let k = 0; k < MENTAS_XY; k++) {
      const id = PRIMERA_MENTA_XY + k;
      tabla[id >> 1] = id % 2 ? (tabla[id >> 1] & 0xf0) | bolsillo : (tabla[id >> 1] & 0x0f) | (bolsillo << 4);
    }
    sesion.cambiar(A.bolsillos, crearGarc(sesion.archivo(A.bolsillos), { 0: tabla }));
  }
  sesion.cambiar(A.iconos, crearGarc(sesion.archivo(A.iconos), nuevosIconos));
  return true;
}
