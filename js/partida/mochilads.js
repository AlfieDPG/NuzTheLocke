// ---------- La bolsa de una partida de DS (gen 4 y 5) ----------
//
// Como ./mochila3ds.js: cada bolsillo es una lista de [objeto (u16), cantidad (u16)] seguida,
// que acaba en el primer objeto 0. En gen 4 va en el bloque general; en gen 5, en su bloque.
// Comprobado con partidas de Platino, HeartGold, Blanco y Blanco 2 (dónde empieza cada bolsillo;
// en HGSS, desde las MT, todo va 4 bytes más adelante que en Platino). Diamante / Perla, como
// Platino (lo dice PKHeX). Los números de los objetos son los mismos que en gen 6.

import { mapaDS, objetoWebDS, objetoJuegoDS } from "./nds.js";
import { sePuedeEditarDS, cerrarCambiosDS } from "./escribirds.js";

// id, dónde empieza (desde el principio de la bolsa), cuántos caben y cuántos de cada objeto
// d: lo que va de más desde las MT (HGSS: 4); balls: cuántas caben
const GEN4 = (d, balls) => [
  { id: "objetos", inicio: 0x000, caben: 165, maximo: 999 },
  { id: "medicinas", inicio: 0x51c + d, caben: 40, maximo: 999 },
  { id: "balls", inicio: 0x6bc + d, caben: balls, maximo: 999 },
  { id: "mt", inicio: 0x35c + d, caben: 100, maximo: 99 },
  { id: "bayas", inicio: 0x5bc + d, caben: 64, maximo: 999 },
  { id: "cartas", inicio: 0x4ec + d, caben: 12, maximo: 999 },
  { id: "combate", inicio: 0x6bc + d + balls * 4, caben: 30, maximo: 999 },
  { id: "clave", inicio: 0x294, caben: 50, maximo: 1 }
];
const GEN5 = [
  { id: "objetos", inicio: 0x000, caben: 310, maximo: 999 },
  { id: "medicinas", inicio: 0x7d8, caben: 48, maximo: 999 },
  { id: "mt", inicio: 0x624, caben: 109, maximo: 1 },
  { id: "bayas", inicio: 0x898, caben: 64, maximo: 999 },
  { id: "clave", inicio: 0x4d8, caben: 83, maximo: 1 }
];
// HGSS tiene sitio para 24 balls (las de Bonguri)
const BOLSILLOS = { dp: GEN4(0, 15), platino: GEN4(0, 15), hgss: GEN4(4, 24), bw: GEN5, b2w2: GEN5 };

export function bolsillosDS(bytes) {
  const mapa = mapaDS(bytes);
  const bolsillos = mapa && BOLSILLOS[mapa.id];
  if (!bolsillos) throw new Error("Todavía no se puede tocar la bolsa en este juego.");
  return bolsillos;
}

export function leerMochilaDS(bytes) {
  const { bolsa: base, gen } = mapaDS(bytes);
  const mochila = {};
  for (const b of bolsillosDS(bytes)) {
    const lista = [];
    for (let i = 0; i < b.caben; i++) {
      const o = base + b.inicio + i * 4;
      const objeto = bytes[o] | (bytes[o + 1] << 8);
      if (!objeto) break;
      lista.push({ objeto: objetoWebDS(gen, objeto), cantidad: bytes[o + 2] | (bytes[o + 3] << 8) });
    }
    mochila[b.id] = lista;
  }
  return mochila;
}

export function escribirMochilaDS(original, mochila) {
  const permiso = sePuedeEditarDS(original);
  if (!permiso.ok) throw new Error(permiso.motivo);

  const nuevo = original.slice();
  const vista = new DataView(nuevo.buffer, nuevo.byteOffset, nuevo.byteLength);
  // El mapa, antes de tocar nada (en cuanto cambia un bolsillo, el checksum ya no cuadra hasta cerrarCambiosDS)
  const { bolsa: base, gen } = mapaDS(nuevo);
  const tocados = [];
  const limpia = {};
  for (const b of bolsillosDS(nuevo)) {
    const lista = (mochila[b.id] || [])
      .filter((e) => e.objeto > 0 && e.cantidad > 0)
      // El máximo de cada bolsillo lo pone la web al escribir; aquí solo el que cabe en el número
      .map((e) => ({ objeto: e.objeto, cantidad: Math.min(0xffff, Math.floor(e.cantidad)) }));
    if (lista.length > b.caben) throw new Error("No cabe tanto en ese bolsillo.");
    for (let i = 0; i < b.caben; i++) {
      const e = lista[i] || { objeto: 0, cantidad: 0 };
      vista.setUint16(base + b.inicio + i * 4, objetoJuegoDS(gen, e.objeto), true);
      vista.setUint16(base + b.inicio + i * 4 + 2, e.cantidad, true);
    }
    limpia[b.id] = lista;
    tocados.push({ inicio: base + b.inicio, fin: base + b.inicio + b.caben * 4 });
  }
  cerrarCambiosDS(original, nuevo, tocados);
  if (JSON.stringify(leerMochilaDS(nuevo)) !== JSON.stringify(limpia)) throw new Error("La bolsa no se ha guardado bien.");
  return nuevo;
}
