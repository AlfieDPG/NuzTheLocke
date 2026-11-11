// ---------- Textos de 4.ª generación (Diamante, Perla, Platino, HeartGold, SoulSilver) ----------
//
// Cada archivo de texto (una entrada del NARC de textos):
//   u16 cuántas entradas, u16 clave; luego, por entrada, [u32 dónde empieza, u32 cuántos caracteres],
//   y los caracteres (u16).
// Todo va cifrado: la tabla de entradas, con una clave que sale de la del archivo y del número de
// entrada (x 0x2FD, y luego por i + 1), y los caracteres de cada entrada con otra (0x91BD3 por el
// número de entrada, sumando 0x493D en cada carácter). Si el primero es 0xF100, el resto son
// caracteres de 9 bits (de 15 bits en cada u16).
//
// Aquí los textos van como cadenas de JavaScript con cada u16 tal cual (sin el 0xFFFF del final):
// así se busca y se cambia sin estropear los códigos de control (0xE000 es el salto de línea;
// 0xFFFE y lo que le sigue, una variable). aCodigos y deCodigos pasan de letras a códigos y vuelta.

import { TABLA_GEN4 } from "./tabla-gen4.js";

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

// ---------- Letras <-> códigos ----------

const DE_CODIGO = new Map();
const A_CODIGO = new Map();
for (const [codigo, texto] of TABLA_GEN4) {
  if (!DE_CODIGO.has(codigo)) DE_CODIGO.set(codigo, texto);
  if (!A_CODIGO.has(texto)) A_CODIGO.set(texto, codigo);
}
const LARGO_MAXIMO = Math.max(...[...A_CODIGO.keys()].map((t) => t.length));

// De un texto normal («Turtwig», «¡Hola!») a los códigos del juego (lo que no está, se deja fuera)
export function aCodigos(texto) {
  let salida = "";
  for (let i = 0; i < texto.length; ) {
    if (texto[i] === "\n") {
      salida += String.fromCharCode(0xe000);
      i++;
      continue;
    }
    let encontrado = false;
    for (let largo = Math.min(LARGO_MAXIMO, texto.length - i); largo > 0 && !encontrado; largo--) {
      const codigo = A_CODIGO.get(texto.substr(i, largo));
      if (codigo !== undefined) {
        salida += String.fromCharCode(codigo);
        i += largo;
        encontrado = true;
      }
    }
    if (!encontrado) i++;
  }
  return salida;
}

// De los códigos a un texto normal (los saltos de línea, «\n»; lo demás que no es letra, fuera)
export function deCodigos(texto) {
  let salida = "";
  for (const c of texto) {
    const codigo = c.charCodeAt(0);
    if (codigo === 0xe000 || codigo === 0x25bc || codigo === 0x25bd) salida += "\n"; // salto de línea, de página o de párrafo
    else if (DE_CODIGO.has(codigo)) salida += DE_CODIGO.get(codigo);
  }
  return salida;
}

// ---------- Leer y escribir ----------

// Los u16 de una entrada comprimida (de 15 bits en cada u16 a caracteres de 9 bits)
function descomprimir(codigos) {
  const salida = [];
  let bits = 0;
  let cuantos = 0;
  for (let i = 1; i < codigos.length; i++) {
    bits |= codigos[i] << cuantos;
    cuantos += 15;
    while (cuantos >= 9) {
      const c = bits & 0x1ff;
      if (c === 0x1ff) return salida;
      salida.push(c);
      bits >>>= 9;
      cuantos -= 9;
    }
  }
  return salida;
}

// { entradas: [cadena], clave } (cada entrada, sus códigos como caracteres)
export function leerTextos4(datos) {
  const cuantas = u16(datos, 0);
  const clave = u16(datos, 2);
  const base = (clave * 0x2fd) & 0xffff;
  const entradas = [];
  for (let i = 0; i < cuantas; i++) {
    const k2 = (base * (i + 1)) & 0xffff;
    const real = (k2 | (k2 << 16)) >>> 0;
    const donde = (u32(datos, 4 + i * 8) ^ real) >>> 0;
    const largo = (u32(datos, 8 + i * 8) ^ real) >>> 0;
    let k = (0x91bd3 * (i + 1)) & 0xffff;
    let codigos = [];
    for (let j = 0; j < largo; j++) {
      codigos.push(u16(datos, donde + j * 2) ^ k);
      k = (k + 0x493d) & 0xffff;
    }
    if (codigos[0] === 0xf100) codigos = descomprimir(codigos);
    while (codigos.length && codigos[codigos.length - 1] === 0xffff) codigos.pop();
    entradas.push(String.fromCharCode(...codigos));
  }
  return { entradas, clave };
}

// El archivo con los textos nuevos: una cadena por entrada (como las de leerTextos4). Nunca comprime. Si hay más
// textos que entradas tenía, se añaden al final (los mensajes de las mentas: ./mentas-gen4.js)
export function escribirTextos4(original, textos) {
  const cuantas = Math.max(u16(original, 0), textos.length);
  const todos = Array.from({ length: cuantas }, (_, i) => {
    const codigos = [...(textos[i] ?? "")].map((c) => c.charCodeAt(0));
    codigos.push(0xffff);
    return codigos;
  });
  const total = 4 + cuantas * 8 + todos.reduce((t, c) => t + c.length * 2, 0);
  const salida = new Uint8Array(total);
  poner16(salida, 0, cuantas);
  const clave = 0xd00e;
  poner16(salida, 2, clave);
  const base = (clave * 0x2fd) & 0xffff;
  let donde = 4 + cuantas * 8;
  todos.forEach((codigos, i) => {
    const k2 = (base * (i + 1)) & 0xffff;
    const real = (k2 | (k2 << 16)) >>> 0;
    poner32(salida, 4 + i * 8, (donde ^ real) >>> 0);
    poner32(salida, 8 + i * 8, (codigos.length ^ real) >>> 0);
    let k = (0x91bd3 * (i + 1)) & 0xffff;
    codigos.forEach((c, j) => {
      poner16(salida, donde + j * 2, c ^ k);
      k = (k + 0x493d) & 0xffff;
    });
    donde += codigos.length * 2;
  });
  return salida;
}
