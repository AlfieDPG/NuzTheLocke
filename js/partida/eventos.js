// ---------- Eventos de una partida (pestaña «Eventos» de la ventana «Partida») ----------
//
// Lo que no son Pokémon ni objetos, como en PKHeX: el dinero, los PB, las fichas, la Pokédex Nacional,
// la Pokédex completa... Cada juego tiene su lista (dónde está cada cosa, de PKHeX: github.com/kwsch/PKHeX,
// PKHeX.Core/Saves). Los objetos (Megaaro, Amuleto Iris...) no: van en la bolsa.
//
//   leerEventos(bytes) -> [{ id, grupo, tipo, nombre, ayuda?, valor, maximo?, total? }]
//     tipo: "numero" (valor, maximo), "casilla" (valor sí/no) o "pokedex" (valor: capturados, total)
//   aplicarEvento(bytes, id, valor, generos) -> la partida nueva, comprobada
//
// generos: { especie: gender_rate de PokeAPI } (-1 sin género, 0 solo machos, 8 solo hembras), para la
// Pokédex: qué géneros se marcan como vistos.

import { formatoDeSeguro } from "./formato.js";
import { JUEGOS as JUEGOS_3DS, bloques as bloques3DS, leerPartida3DS } from "./tresds.js";
import { sePuedeEditar, arreglarChecksums, checksumsBien, zonasDeChecksums } from "./escribir3ds.js";
import { mapaDS } from "./nds.js";
import { sePuedeEditarDS, cerrarCambiosDS } from "./escribirds.js";
import { mapaGBA } from "./gba.js";
import { escribirBloquesGBA } from "./escribirgba.js";
import { abrirSwSh, LLAVES } from "./switch.js";
import { escribirBloques, sePuedeEditarSwitch } from "./escribirswitch.js";
import { escribirTrozosBDSP, entrenadorBDSP } from "./bdsp.js";

// ---------- Bits y números ----------

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
function poner16(b, o, v) {
  b[o] = v & 0xff;
  b[o + 1] = (v >> 8) & 0xff;
}
function poner32(b, o, v) {
  for (let i = 0; i < 4; i++) b[o + i] = (v >>> (i * 8)) & 0xff;
}
const bit = (b, o, n) => (b[o + (n >> 3)] >> (n & 7)) & 1;
function ponerBit(b, o, n, si = true) {
  if (si) b[o + (n >> 3)] |= 1 << (n & 7);
  else b[o + (n >> 3)] &= ~(1 << (n & 7));
}

const SOLO_MACHOS = 0;
const SOLO_HEMBRAS = 8;
const SIN_GENERO = -1;
// Qué géneros se ven de cada especie (los sin género cuentan como machos, igual que en los juegos)
function generosDe(generos, especie) {
  const tasa = generos[especie] ?? 4;
  return { macho: tasa !== SOLO_HEMBRAS, hembra: tasa !== SOLO_MACHOS && tasa !== SIN_GENERO };
}

// ---------- Cada juego ----------
//
// Cada evento: { id, grupo, tipo, nombre, ayuda, maximo, leer(z), poner(z, valor) }. «z» da las zonas de la
// partida (z.zona(nombre): sus bytes, en una copia que se puede cambiar).

const dinero = (zona, o, maximo, xor = () => 0) => ({
  id: "dinero", grupo: "entrenador", tipo: "numero", nombre: "Dinero", maximo,
  leer: (z) => (u32(z.zona(zona), o) ^ xor(z)) >>> 0,
  poner: (z, v) => poner32(z.zona(zona), o, (v ^ xor(z)) >>> 0)
});
const numero16 = (id, nombre, zona, o, maximo, ayuda = "") => ({
  id, grupo: "entrenador", tipo: "numero", nombre, maximo, ayuda,
  leer: (z) => u16(z.zona(zona), o),
  poner: (z, v) => poner16(z.zona(zona), o, v)
});
const numero32 = (id, nombre, zona, o, maximo, ayuda = "") => ({
  id, grupo: "entrenador", tipo: "numero", nombre, maximo, ayuda,
  leer: (z) => u32(z.zona(zona), o),
  poner: (z, v) => poner32(z.zona(zona), o, v)
});
const PB = "Los Puntos de Batalla: se cambian por objetos en la zona de combates (Torre, Frente, Metro, Maison o Árbol Batalla).";
const nacional = (leer, poner) => ({
  id: "nacional", grupo: "pokedex", tipo: "casilla", nombre: "Pokédex Nacional",
  ayuda: "La que tiene a todos los Pokémon (normalmente llega al acabar la Liga). Con ella, también los de fuera de la región evolucionan.",
  leer, poner
});
const pokedex = (total, leer, completar) => ({
  id: "pokedex", grupo: "pokedex", tipo: "pokedex", nombre: "Pokédex completa", total,
  ayuda: "Marca a todos como vistos y capturados (sin formas ni idiomas). Sirve para el diploma y lo que dan por completarla, como el Amuleto Iris.",
  leer, poner: completar
});

// Rojo Fuego / Verde Hoja: bloque pequeño (entrenador) y grande; el dinero y las fichas van cifrados
// con la llave del pequeño (+0xF20)
const LLAVE_GBA = (z) => u32(z.zona("pequeno"), 0xf20);
const FRLG = [
  dinero("grande", 0x290, 999999, LLAVE_GBA),
  {
    id: "fichas", grupo: "entrenador", tipo: "numero", nombre: "Fichas del Casino", maximo: 9999,
    leer: (z) => (u16(z.zona("grande"), 0x294) ^ LLAVE_GBA(z)) & 0xffff,
    poner: (z, v) => poner16(z.zona("grande"), 0x294, (v ^ LLAVE_GBA(z)) & 0xffff)
  },
  nacional(
    (z) => z.zona("pequeno")[0x1b] === 0xb9,
    (z, si) => {
      z.zona("pequeno")[0x1b] = si ? 0xb9 : 0;
      ponerBit(z.zona("grande"), 0xee0, 0x840, si); // la bandera 0x840
      poner16(z.zona("grande"), 0x1000 + 0x4e * 2, si ? 0x6258 : 0); // y la variable 0x4E
    }
  ),
  pokedex(
    386,
    (z) => contarBits(z.zona("pequeno"), 0x28, 386),
    (z) => {
      for (let n = 0; n < 386; n++) {
        ponerBit(z.zona("pequeno"), 0x28, n); // capturados
        ponerBit(z.zona("pequeno"), 0x5c, n); // vistos (y sus dos copias en el grande)
        ponerBit(z.zona("grande"), 0x5f8, n);
        ponerBit(z.zona("grande"), 0x3a18, n);
      }
    }
  )
];

function contarBits(b, o, cuantos) {
  let n = 0;
  for (let i = 0; i < cuantos; i++) n += bit(b, o, i);
  return n;
}

// 4.ª gen: todo en el bloque general. t: el entrenador; pb: los PB; dex: la Pokédex (u32 y 4 tiras de
// 0x40 bytes: capturados, vistos, primer género visto y segundo)
function gen4({ t, pb, dex }) {
  const G = "general";
  return [
    dinero(G, t + 0x14, 999999),
    numero16("fichas", "Fichas del Casino", G, t + 0x20, 50000),
    numero16("pb", "Puntos de Batalla (PB)", G, pb, 9999, PB),
    nacional(
      (z) => Boolean(z.zona(G)[t + 0x1d] & 2),
      (z, si) => (z.zona(G)[t + 0x1d] = (z.zona(G)[t + 0x1d] & ~2) | (si ? 2 : 0))
    ),
    pokedex(
      493,
      (z) => contarBits(z.zona(G), dex + 4, 493),
      (z, _v, generos) => {
        const b = z.zona(G);
        for (let e = 1; e <= 493; e++) {
          const { macho, hembra } = generosDe(generos, e);
          ponerBit(b, dex + 4, e - 1);
          ponerBit(b, dex + 0x44, e - 1);
          // Los dos géneros: el primero visto y el segundo (iguales si solo tiene uno)
          ponerBit(b, dex + 0x84, e - 1, !macho);
          ponerBit(b, dex + 0xc4, e - 1, hembra);
        }
      }
    )
  ];
}

// 5.ª, 6.ª y 7.ª gen: capturados, 4 tiras de vistos (macho, hembra, macho shiny, hembra shiny) y 4 de
// «el que se enseña» (solo uno por especie). Se marca el normal de cada género que tenga.
function completarPorTiras(b, { capturados, vistos, tira, total, generos }) {
  for (let e = 1; e <= total; e++) {
    const n = e - 1;
    const { macho, hembra } = generosDe(generos, e);
    ponerBit(b, capturados, n);
    if (macho) ponerBit(b, vistos, n);
    if (hembra) ponerBit(b, vistos + tira, n);
    let enseñado = false;
    for (let r = 0; r < 4; r++) if (bit(b, vistos + (4 + r) * tira, n)) enseñado = true;
    if (!enseñado) ponerBit(b, vistos + (macho ? 4 : 5) * tira, n);
  }
}

function pokedexPorTiras(zona, { capturados, vistos, tira }, total) {
  return pokedex(
    total,
    (z) => contarBits(z.zona(zona), capturados, total),
    (z, _v, generos) => completarPorTiras(z.zona(zona), { capturados, vistos, tira, total, generos })
  );
}

const nacionalBit0 = (zona, o) =>
  nacional((z) => Boolean(z.zona(zona)[o] & 1), (z, si) => (z.zona(zona)[o] = (z.zona(zona)[o] & ~1) | (si ? 1 : 0)));

const GEN5 = [
  dinero("varios", 0, 999999),
  numero16("pb", "Puntos de Batalla (PB)", "metro", 0, 9999, PB),
  nacionalBit0("pokedex", 4),
  pokedexPorTiras("pokedex", { capturados: 0x8, vistos: 0x5c, tira: 0x54 }, 649)
];

// 3DS: las zonas son los bloques de la partida, por su número
const GEN6 = (pb) => [
  dinero(11, 0x8, 9999999),
  numero16("pb", "Puntos de Batalla (PB)", 11, pb, 9999, PB),
  nacionalBit0(20, 4),
  pokedexPorTiras(20, { capturados: 0x8, vistos: 0x68, tira: 0x60 }, 721)
];
const GEN7 = (total) => [
  dinero(9, 0x4, 9999999),
  numero32("pb", "Puntos de Batalla (PB)", 9, 0x11c, 9999, PB),
  {
    id: "festival", grupo: "entrenador", tipo: "numero", nombre: "Monedas del Festival", maximo: 9999999,
    ayuda: "Las del Festi Plaza (se gastan en sus puestos).",
    leer: (z) => u32(z.zona(21), 0x508),
    // El total ganado sube lo mismo (el juego lo lleva aparte)
    poner: (z, v) => {
      const b = z.zona(21);
      const antes = u32(b, 0x508);
      poner32(b, 0x508, v);
      poner32(b, 0x50c, Math.min(9999999, Math.max(0, u32(b, 0x50c) + v - antes)));
    }
  },
  pokedexPorTiras(6, { capturados: 0x88, vistos: 0xf0, tira: 0x8c }, total)
];

const SWSH = [
  dinero(LLAVES.varios, 0x4, 9999999),
  numero16("pb", "Puntos de Batalla (PB)", LLAVES.varios, 0x11c, 9999, "Los Puntos de Batalla: se cambian por objetos en la Torre Batalla."),
  numero32("vatios", "Vatios", LLAVES.entrenador, 0xd0, 9999999, "Los de las guaridas: para el Bazar de los vatios y las MT/DT de la Zona Silvestre.")
];

// Perla Reluciente / Diamante Brillante: todo en el archivo, sin bloques (su MD5 al final)
const ZUKAN = 0x7a328;
const BDSP_DEX = { estado: 0, machos: 0x171c, hembras: 0x1ed0, idiomas: 0x28fc, nacional: 0x30b4 };
const CAPTURADO = 3;
const BDSP = [
  dinero("todo", 0x79bb4 + 0x20, 999999),
  numero32("pb", "Puntos de Batalla (PB)", "todo", 0x95bf4 + 0xc, 9999, "Los Puntos de Batalla de la Torre Batalla (en la Zona de Combate, pasada la Liga): se cambian por objetos."),
  nacional(
    (z) => u32(z.zona("todo"), ZUKAN + BDSP_DEX.nacional) === 1,
    (z, si) => poner32(z.zona("todo"), ZUKAN + BDSP_DEX.nacional, si ? 1 : 0)
  ),
  pokedex(
    493,
    (z) => {
      let n = 0;
      for (let e = 0; e < 493; e++) if (u32(z.zona("todo"), ZUKAN + e * 4) === CAPTURADO) n++;
      return n;
    },
    (z, _v, generos) => {
      const b = z.zona("todo");
      // El idioma de la partida, como lo marca el juego (sin el 6, que no se usa)
      const idioma = z.idioma || 7;
      const bitIdioma = 1 << (idioma < 6 ? idioma - 1 : idioma - 2);
      for (let e = 1; e <= 493; e++) {
        const { macho, hembra } = generosDe(generos, e);
        const i = (e - 1) * 4;
        poner32(b, ZUKAN + BDSP_DEX.estado + i, CAPTURADO);
        if (macho) poner32(b, ZUKAN + BDSP_DEX.machos + i, 1);
        if (hembra) poner32(b, ZUKAN + BDSP_DEX.hembras + i, 1);
        poner32(b, ZUKAN + BDSP_DEX.idiomas + i, (u32(b, ZUKAN + BDSP_DEX.idiomas + i) | bitIdioma) >>> 0);
      }
    }
  )
];

const DE_CADA = {
  frlg: FRLG,
  dp: gen4({ t: 0x64, pb: 0x65f8, dex: 0x12dc }),
  platino: gen4({ t: 0x68, pb: 0x7234, dex: 0x1328 }),
  hgss: gen4({ t: 0x64, pb: 0x5bb8, dex: 0x12b8 }),
  bw: GEN5,
  b2w2: GEN5,
  xy: GEN6(0x3c),
  oras: GEN6(0x30),
  sm: GEN7(802),
  usum: GEN7(807),
  swsh: SWSH,
  bdsp: BDSP
};

// ---------- Abrir y cerrar las zonas de cada consola ----------
//
// abrir(bytes) -> { zona(nombre), cerrar() -> partida nueva comprobada }

function zonasGBA(original) {
  const mapa = mapaGBA(original);
  if (!mapa) throw new Error("Ese archivo no es una partida que se sepa leer.");
  const copias = { pequeno: mapa.pequeno.slice(), grande: mapa.grande.slice() };
  return {
    zona: (nombre) => copias[nombre],
    cerrar() {
      const trozos = [];
      for (const bloque of ["pequeno", "grande"]) {
        const antes = mapa[bloque];
        const ahora = copias[bloque];
        for (let i = 0; i < ahora.length; i++) if (ahora[i] !== antes[i]) trozos.push({ bloque, o: i, datos: [ahora[i]] });
      }
      return escribirBloquesGBA(original, trozos);
    }
  };
}

function zonasDS(original) {
  const permiso = sePuedeEditarDS(original);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const mapa = mapaDS(original);
  const nuevo = original.slice();
  const usadas = new Map();
  return {
    zona(nombre) {
      const b = mapa.bloques.find((x) => x.nombre === nombre);
      if (!b) throw new Error("Esa parte de la partida no está.");
      usadas.set(nombre, b);
      return nuevo.subarray(b.inicio, b.inicio + b.datos);
    },
    cerrar() {
      const tocados = [...usadas.values()].map((b) => ({ inicio: b.inicio, fin: b.inicio + b.datos }));
      cerrarCambiosDS(original, nuevo, tocados);
      return nuevo;
    }
  };
}

function zonas3DS(original) {
  const permiso = sePuedeEditar(original);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const nuevo = original.slice();
  const lista = bloques3DS(nuevo);
  const usadas = new Set();
  return {
    zona(n) {
      usadas.add(n);
      return nuevo.subarray(lista[n].inicio, lista[n].inicio + lista[n].largo);
    },
    cerrar() {
      arreglarChecksums(nuevo);
      if (!checksumsBien(nuevo)) throw new Error("Los checksums no han quedado bien.");
      const permitidos = [...[...usadas].map((n) => ({ inicio: lista[n].inicio, fin: lista[n].inicio + lista[n].largo })), ...zonasDeChecksums(nuevo)];
      for (let i = 0; i < nuevo.length; i++) {
        if (nuevo[i] !== original[i] && !permitidos.some((r) => i >= r.inicio && i < r.fin)) throw new Error("Ha cambiado algo que no debía.");
      }
      leerPartida3DS(nuevo);
      return nuevo;
    }
  };
}

function zonasSwSh(original) {
  const permiso = sePuedeEditarSwitch(original);
  if (!permiso.ok) throw new Error(permiso.motivo);
  const mapa = abrirSwSh(original);
  const copias = new Map();
  return {
    zona(llave) {
      if (!copias.has(llave)) {
        const bloque = mapa.get(llave);
        if (!bloque) throw new Error("Esa parte de la partida no está.");
        copias.set(llave, bloque.datos.slice());
      }
      return copias.get(llave);
    },
    cerrar: () => escribirBloques(original, copias)
  };
}

function zonasBDSP(original) {
  const copia = original.slice();
  return {
    zona: () => copia,
    idioma: entrenadorBDSP(original).idioma,
    cerrar() {
      // Solo lo que cambia, en trozos seguidos
      const trozos = [];
      for (let i = 0; i < copia.length; i++) {
        if (copia[i] === original[i]) continue;
        let fin = i;
        while (fin + 1 < copia.length && copia[fin + 1] !== original[fin + 1]) fin++;
        trozos.push({ inicio: i, datos: copia.slice(i, fin + 1) });
        i = fin;
      }
      return escribirTrozosBDSP(original, trozos);
    }
  };
}

function abrir(bytes, juego) {
  if (juego === "frlg") return zonasGBA(bytes);
  if (juego === "swsh") return zonasSwSh(bytes);
  if (juego === "bdsp") return zonasBDSP(bytes);
  if (JUEGOS_3DS[bytes.length]) return zonas3DS(bytes);
  return zonasDS(bytes);
}

// ---------- Lo de fuera ----------

export function hayEventos(juego) {
  return Boolean(DE_CADA[juego]);
}

export function leerEventos(bytes) {
  const juego = formatoDeSeguro(bytes).id;
  const lista = DE_CADA[juego];
  if (!lista) return [];
  const z = abrir(bytes, juego);
  return lista.map(({ leer, poner, ...e }) => ({ ...e, valor: leer ? leer(z) : undefined }));
}

export function aplicarEvento(bytes, id, valor, generos = {}) {
  const juego = formatoDeSeguro(bytes).id;
  const evento = (DE_CADA[juego] || []).find((e) => e.id === id);
  if (!evento || !evento.poner) throw new Error("Ese evento no está en este juego.");
  if (evento.tipo === "numero") valor = Math.max(0, Math.min(evento.maximo, Math.floor(Number(valor) || 0)));
  const z = abrir(bytes, juego);
  evento.poner(z, valor, generos);
  const nuevo = z.cerrar();
  // Que se lea como se ha dejado
  const releido = abrir(nuevo, juego);
  const ahora = evento.leer(releido);
  const esperado = evento.tipo === "pokedex" ? evento.total : evento.tipo === "casilla" ? Boolean(valor) : valor;
  if (ahora !== esperado) throw new Error("El evento no se ha guardado bien.");
  return nuevo;
}
