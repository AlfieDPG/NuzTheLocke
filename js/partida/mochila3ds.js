// ---------- La bolsa de una partida de 3DS ----------
//
// Gen 6: en el bloque 1. Cada bolsillo es una lista de [objeto (u16), cantidad (u16)] seguida,
// sin huecos, que acaba en el primer objeto 0; lo que sobra, a ceros.
// Gen 7: en el bloque 0, y cada objeto en un u32: el número en los 10 bits de abajo, la cantidad
// en los 10 siguientes y, encima, su sitio al ordenar y si es nuevo (se conservan). Los que se
// gastan se quedan con cantidad 0: al leer no cuentan, y al escribir se quitan.
// Comprobado con partidas de X / Y, Rubí Omega / Zafiro Alfa, Sol y Ultrasol: dónde empieza cada
// bolsillo dentro del bloque y cuántos caben (de un bolsillo al siguiente; en gen 7 llenan el
// bloque justo).
//
// Como en ./escribir3ds.js, nada se da por bueno: se vuelve a leer y fuera de los bolsillos (y
// de los checksums de la tabla) no puede haber cambiado nada.

import { JUEGOS, bloques, leerPartida3DS, objetoWeb3DS, objetoJuego3DS } from "./tresds.js";
import { sePuedeEditar, checksumsBien, arreglarChecksums, zonasDeChecksums } from "./escribir3ds.js";

// id, dónde empieza, cuántos caben y cuántos de cada objeto como mucho
export const BOLSILLOS = {
  xy: [
    { id: "objetos", inicio: 0x000, caben: 400, maximo: 999 },
    { id: "medicinas", inicio: 0x968, caben: 64, maximo: 999 },
    { id: "mt", inicio: 0x7c0, caben: 106, maximo: 1 },
    { id: "bayas", inicio: 0xa68, caben: 72, maximo: 999 },
    { id: "clave", inicio: 0x640, caben: 96, maximo: 1 }
  ],
  oras: [
    { id: "objetos", inicio: 0x000, caben: 400, maximo: 999 },
    { id: "medicinas", inicio: 0x970, caben: 64, maximo: 999 },
    { id: "mt", inicio: 0x7c0, caben: 108, maximo: 1 },
    { id: "bayas", inicio: 0xa70, caben: 72, maximo: 999 },
    { id: "clave", inicio: 0x640, caben: 96, maximo: 1 }
  ],
  sm: [
    { id: "objetos", inicio: 0x000, caben: 430, maximo: 999 },
    { id: "medicinas", inicio: 0xb48, caben: 64, maximo: 999 },
    { id: "mt", inicio: 0x998, caben: 108, maximo: 1 },
    { id: "bayas", inicio: 0xc48, caben: 72, maximo: 999 },
    { id: "cristales", inicio: 0xd68, caben: 30, maximo: 1 },
    { id: "clave", inicio: 0x6b8, caben: 184, maximo: 1 }
  ],
  usum: [
    { id: "objetos", inicio: 0x000, caben: 427, maximo: 999 },
    { id: "medicinas", inicio: 0xb74, caben: 60, maximo: 999 },
    { id: "mt", inicio: 0x9c4, caben: 108, maximo: 1 },
    { id: "bayas", inicio: 0xc64, caben: 67, maximo: 999 },
    { id: "cristales", inicio: 0xd70, caben: 35, maximo: 1 },
    { id: "roto", inicio: 0xdfc, caben: 11, maximo: 999 },
    { id: "clave", inicio: 0x6ac, caben: 198, maximo: 1 }
  ]
};

export const CARAMELO_RARO = 50;

export function bolsillosDe(bytes) {
  const juego = JUEGOS[bytes.length];
  const bolsillos = juego && BOLSILLOS[juego.id];
  if (!bolsillos) throw new Error("Todavía no se puede tocar la bolsa en este juego.");
  return bolsillos;
}

function inicioBloque(bytes) {
  return bloques(bytes)[JUEGOS[bytes.length].gen === 7 ? 0 : 1].inicio;
}

// Cada hueco: { objeto, cantidad, resto } (resto: los bits de encima, solo en gen 7)
function leerHueco(vista, posicion, gen) {
  if (gen !== 7) return { objeto: objetoWeb3DS(vista.getUint16(posicion, true)), cantidad: vista.getUint16(posicion + 2, true), resto: 0 };
  const x = vista.getUint32(posicion, true);
  return { objeto: objetoWeb3DS(x & 0x3ff), cantidad: (x >>> 10) & 0x3ff, resto: x & 0xfff00000 };
}

function ponerHueco(vista, posicion, gen, { objeto, cantidad, resto = 0 }) {
  if (gen !== 7) {
    vista.setUint16(posicion, objetoJuego3DS(objeto), true);
    vista.setUint16(posicion + 2, cantidad, true);
  } else vista.setUint32(posicion, objeto ? (objetoJuego3DS(objeto) | (cantidad << 10) | resto) >>> 0 : 0, true);
}

// { objetos: [{ objeto, cantidad }], medicinas: [...], ... } en el orden en que están
export function leerMochila(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const base = inicioBloque(bytes);
  const gen = JUEGOS[bytes.length].gen;
  const mochila = {};
  for (const b of bolsillosDe(bytes)) {
    const lista = [];
    for (let i = 0; i < b.caben; i++) {
      const { objeto, cantidad } = leerHueco(vista, base + b.inicio + i * 4, gen);
      if (gen !== 7 && !objeto) break;
      if (objeto && cantidad) lista.push({ objeto, cantidad });
    }
    mochila[b.id] = lista;
  }
  return mochila;
}

// Escribe la bolsa entera (lo de leerMochila, cambiado). Devuelve una partida nueva, comprobada.
export function escribirMochila(original, mochila) {
  const permiso = sePuedeEditar(original);
  if (!permiso.ok) throw new Error(permiso.motivo);

  const nuevo = original.slice();
  const vista = new DataView(nuevo.buffer);
  const base = inicioBloque(nuevo);
  const gen = JUEGOS[nuevo.length].gen;
  const permitidos = [];
  const limpia = {};
  for (const b of bolsillosDe(nuevo)) {
    const lista = (mochila[b.id] || [])
      .filter((e) => e.objeto > 0 && e.cantidad > 0)
      // El máximo de cada bolsillo lo pone la web al escribir; aquí solo el que cabe en el número
      .map((e) => ({ objeto: e.objeto, cantidad: Math.min(gen === 7 ? 0x3ff : 0xffff, Math.floor(e.cantidad)) }));
    if (lista.length > b.caben) throw new Error("No cabe tanto en ese bolsillo.");
    // Lo de encima de cada objeto que ya estaba (gen 7), tal cual
    const restos = new Map();
    for (let i = 0; i < b.caben; i++) {
      const h = leerHueco(vista, base + b.inicio + i * 4, gen);
      if (h.objeto && !restos.has(h.objeto)) restos.set(h.objeto, h.resto);
    }
    for (let i = 0; i < b.caben; i++) {
      const e = lista[i] || { objeto: 0, cantidad: 0 };
      ponerHueco(vista, base + b.inicio + i * 4, gen, { ...e, resto: restos.get(e.objeto) || 0 });
    }
    limpia[b.id] = lista;
    permitidos.push({ inicio: base + b.inicio, fin: base + b.inicio + b.caben * 4 });
  }
  arreglarChecksums(nuevo);

  // ---------- Comprobaciones ----------
  if (!checksumsBien(nuevo)) throw new Error("Los checksums no han quedado bien.");
  if (JSON.stringify(leerMochila(nuevo)) !== JSON.stringify(limpia)) throw new Error("La bolsa no se ha guardado bien.");
  permitidos.push(...zonasDeChecksums(nuevo));
  for (let i = 0; i < nuevo.length; i++) {
    if (nuevo[i] !== original[i] && !permitidos.some((r) => i >= r.inicio && i < r.fin)) throw new Error("Ha cambiado algo que no debía.");
  }
  leerPartida3DS(nuevo);
  return nuevo;
}
