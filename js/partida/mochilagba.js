// ---------- La bolsa de una partida de GBA (Rojo Fuego / Verde Hoja) ----------
//
// Como ./mochilads.js: cada bolsillo es una lista de [objeto (u16), cantidad (u16)] seguida, que acaba en el
// primer objeto 0, en el bloque grande (del decomp de Rojo Fuego, github.com/pret/pokefirered: SaveBlock1).
// Las cantidades van cifradas con los 16 bits bajos de la llave de la partida (en +0xF20 del bloque del
// entrenador); los objetos van con el número del juego (./datos-gba.js). Los que la web no conoce (los objetos
// clave propios de Rojo Fuego, como el Té o el Pokéflauta) se quedan como están, detrás de los demás.

import { mapaGBA } from "./gba.js";
import { sePuedeEditarGBA, escribirGrandeGBA } from "./escribirgba.js";
import { objetoWebGen3, objetoJuegoGen3 } from "./datos-gba.js";

const LLAVE = 0xf20;

const BOLSILLOS = [
  { id: "objetos", inicio: 0x310, caben: 42, maximo: 999 },
  { id: "balls", inicio: 0x430, caben: 13, maximo: 999 },
  { id: "mt", inicio: 0x464, caben: 58, maximo: 999 },
  { id: "bayas", inicio: 0x54c, caben: 43, maximo: 999 },
  { id: "clave", inicio: 0x3b8, caben: 30, maximo: 1 }
];

const u16 = (b, i) => b[i] | (b[i + 1] << 8);

export function bolsillosGBA() {
  return BOLSILLOS;
}

// Todo lo de cada bolsillo, con el número del juego: { bolsillo: [{ juego, cantidad }] }
function leerTodo(bytes) {
  const mapa = mapaGBA(bytes);
  if (!mapa) throw new Error("Ese archivo no es una partida que se sepa leer.");
  const llave = u16(mapa.pequeno, LLAVE);
  const todo = {};
  for (const b of BOLSILLOS) {
    const lista = [];
    for (let i = 0; i < b.caben; i++) {
      const o = b.inicio + i * 4;
      const juego = u16(mapa.grande, o);
      if (!juego) break;
      lista.push({ juego, cantidad: u16(mapa.grande, o + 2) ^ llave });
    }
    todo[b.id] = lista;
  }
  return { todo, llave };
}

export function leerMochilaGBA(bytes) {
  const { todo } = leerTodo(bytes);
  const mochila = {};
  for (const b of BOLSILLOS) {
    mochila[b.id] = todo[b.id].map((e) => ({ objeto: objetoWebGen3(e.juego), cantidad: e.cantidad })).filter((e) => e.objeto);
  }
  return mochila;
}

export function escribirMochilaGBA(original, mochila) {
  const permiso = sePuedeEditarGBA(original);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const { todo, llave } = leerTodo(original);
  const trozos = [];
  const limpia = {};
  for (const b of BOLSILLOS) {
    const lista = (mochila[b.id] || [])
      .filter((e) => e.objeto > 0 && e.cantidad > 0)
      .map((e) => ({ objeto: e.objeto, cantidad: Math.min(b.maximo, Math.floor(e.cantidad)) }));
    for (const e of lista) if (!objetoJuegoGen3(e.objeto)) throw new Error("Ese objeto no está en este juego.");
    // Los que la web no conoce, detrás
    const desconocidos = todo[b.id].filter((e) => !objetoWebGen3(e.juego));
    if (lista.length + desconocidos.length > b.caben) throw new Error("No cabe tanto en ese bolsillo.");
    const filas = [...lista.map((e) => ({ juego: objetoJuegoGen3(e.objeto), cantidad: e.cantidad })), ...desconocidos];
    const datos = new Uint8Array(b.caben * 4);
    filas.forEach((e, i) => {
      const cifrada = (e.cantidad ^ llave) & 0xffff;
      datos.set([e.juego & 0xff, e.juego >> 8, cifrada & 0xff, cifrada >> 8], i * 4);
    });
    // Los huecos vacíos: objeto 0 y cantidad 0 cifrada (como los deja el juego)
    for (let i = filas.length; i < b.caben; i++) datos.set([0, 0, llave & 0xff, llave >> 8], i * 4);
    trozos.push({ o: b.inicio, datos });
    limpia[b.id] = lista;
  }
  const nuevo = escribirGrandeGBA(original, trozos);
  if (JSON.stringify(leerMochilaGBA(nuevo)) !== JSON.stringify(limpia)) throw new Error("La bolsa no se ha guardado bien.");
  return nuevo;
}
