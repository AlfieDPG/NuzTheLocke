// ---------- Blanco / Negro y Blanco 2 / Negro 2: los datos que se randomizan ----------
//
// Dónde está cada cosa (rutas de NitroFS, comprobadas con las ROM españolas de Blanco y Blanco 2;
// lo que cambia de un juego a otro está en ./perfiles-gen5.js):
//   datos       datos de cada Pokémon (76 bytes en Negro 2 y Blanco 2; 60 en Negro y Blanco):
//               estadísticas base 0-5, tipos 6-7, objetos que llevan los salvajes 12/14/16 (u16),
//               habilidades 24-26, compatibilidad con las MT 40-52 (bits) y, solo en los de 76,
//               con los tutores 60-75 (bits)
//   aprende     ataques por nivel: [ataque u16, nivel u16] hasta 0xFFFF 0xFFFF
//   evoluciones 7 de [método u16, dato u16, especie u16]
//   ataques     tipo 0, categoría 2, potencia 3, precisión 4, PP 5
//   objetos     precio u16 en 0
//   entrenadores (byte 0: 1 = ataques propios, 2 = objetos; byte 2: tipo de combate;
//               byte 3: cuántos Pokémon; byte 12: marcas de la IA)
//   equipos     sus Pokémon: [dificultad, habilidad/género, nivel u16, especie u16, forma u16],
//               luego el objeto (u16) y los 4 ataques (u16) si los lleva
//   salvajes    por estación (1 o 4), 232 bytes: 7 probabilidades (una por tipo de zona) y
//               8 bytes, y los huecos de 4 bytes [especie | forma << 11 (u16), nivel mín., nivel máx.]
//   intercambios da (u32 en 4), forma (8), IVs (6 × u32 en 0x10), naturaleza (0x2C),
//               objeto (u32 en 0x4C), pide (u32 en 0x5C)
//   tiendas     lista de objetos (u16): un archivo por tienda en Negro 2 y Blanco 2; en Negro y
//               Blanco, listas seguidas en el overlay 21
//   scripts     las iniciales, los objetos del suelo y los escondidos, y los estáticos, cada uno en
//               los suyos (./estaticos-bw1.js y ./estaticos-bw2.js)

import { leerNarc, crearNarc } from "./rom-nds.js";
import { leerTextos, escribirTextos } from "./textos-bw.js";
import { descomprimirLZ } from "./lz.js";
import { perfilDe, JUEGOS_GEN5 } from "./perfiles-gen5.js";
import { IPS, aplicarIPS } from "./parches-gen5.js";
import { ponerHierbaEnPueblos as hierbaEnPueblos } from "./hierba-gen5.js";

export const ULTIMA_ESPECIE = 649;
export const ULTIMO_ATAQUE = 559;
export const ULTIMA_HABILIDAD = 164;

const FIN_LISTA_SCRIPTS = 0xfd13;
// Los claros ocultos (solo Negro 2 y Blanco 2): la parte de cada versión va en un sitio
const CLAROS = "a/2/7/3";
const claroDeVersion = (rom) => (rom.codigo.startsWith("IRD") ? 0 : 1);
// Tipos por su número en el juego (como en js/comun/tipos.js)
export const TIPOS = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"
];

// Métodos de evolución (gen 5)
export const EVO = {
  amistad: 1, amistadDia: 2, amistadNoche: 3, nivel: 4, intercambio: 5, intercambioObjeto: 6, intercambioEspecial: 7,
  piedra: 8, belleza: 16, piedraMacho: 17, piedraHembra: 18, objetoDia: 19, objetoNoche: 20, ataque: 21,
  otroEnEquipo: 22, nivelMacho: 23, nivelHembra: 24
};

// Zonas de los salvajes: hierba, hierba alta (dobles), hierba que se mueve, surf, surf con
// burbujas, pesca y pesca con burbujas
export const ZONAS = [
  { id: "hierba", huecos: 12 }, { id: "hierba-doble", huecos: 12 }, { id: "hierba-especial", huecos: 12 },
  { id: "surf", huecos: 5 }, { id: "surf-especial", huecos: 5 }, { id: "pesca", huecos: 5 }, { id: "pesca-especial", huecos: 5 }
];
const POR_ESTACION = 232;
const ORDEN_STATS = [0, 1, 2, 4, 5, 3]; // dónde va cada estadística (PS, Ata, Def, AtE, DfE, Vel)

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

// ---------- Leer ----------

function leerEspecies(narcs) {
  const especies = [];
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const d = narcs.datos.archivos[id];
    const stats = ORDEN_STATS.map((o) => d[o]); // PS, Ata, Def, AtE, DfE, Vel
    const e = narcs.evoluciones.archivos[id];
    const evoluciones = [];
    for (let k = 0; k < 7; k++) {
      const metodo = u16(e, k * 6);
      const especie = u16(e, k * 6 + 4);
      if (metodo && especie) evoluciones.push({ metodo, dato: u16(e, k * 6 + 2), especie });
    }
    especies[id] = {
      id, stats, total: stats.reduce((a, b) => a + b, 0), totalOriginal: stats.reduce((a, b) => a + b, 0),
      tipos: [...new Set([TIPOS[d[6]], TIPOS[d[7]]])].filter(Boolean),
      habilidades: [d[24], d[25], d[26]],
      objetos: [u16(d, 12), u16(d, 14), u16(d, 16)],
      genero: d[18],
      mt: d.slice(40, 53),
      tutor: d.length >= 76 ? d.slice(60, 76) : new Uint8Array(0),
      evoluciones,
      previa: 0
    };
  }
  for (const e of especies) if (e) for (const evo of e.evoluciones) if (especies[evo.especie]) especies[evo.especie].previa = e.id;
  return especies;
}

function leerAprende(narcs) {
  const aprende = [];
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const a = narcs.aprende.archivos[id];
    const lista = [];
    for (let i = 0; i + 3 < a.length; i += 4) {
      if (u16(a, i) === 0xffff && u16(a, i + 2) === 0xffff) break;
      lista.push([u16(a, i), u16(a, i + 2)]);
    }
    aprende[id] = lista;
  }
  return aprende;
}

function leerSalvajes(narcs) {
  return narcs.salvajes.archivos.map((a, archivo) => {
    const estaciones = [];
    for (let base = 0; base + POR_ESTACION <= a.length; base += POR_ESTACION) {
      const zonas = [];
      let pos = base + 8;
      ZONAS.forEach((zona, z) => {
        const huecos = [];
        for (let h = 0; h < zona.huecos; h++, pos += 4) {
          huecos.push({ especie: u16(a, pos) & 0x7ff, forma: u16(a, pos) >> 11, min: a[pos + 2], max: a[pos + 3] });
        }
        if (a[base + z]) zonas.push({ zona: zona.id, z, huecos });
      });
      estaciones.push(zonas);
    }
    return { archivo, estaciones };
  });
}

function leerEntrenadores(narcs, importantes) {
  const entrenadores = [];
  for (let i = 1; i < narcs.entrenadores.archivos.length; i++) {
    const t = narcs.entrenadores.archivos[i];
    const p = narcs.equipos.archivos[i];
    const conAtaques = Boolean(t[0] & 1);
    const conObjetos = Boolean(t[0] & 2);
    const pokemon = [];
    let pos = 0;
    for (let k = 0; k < t[3]; k++) {
      const poke = { dificultad: p[pos], habilidad: p[pos + 1], nivel: u16(p, pos + 2), especie: u16(p, pos + 4), forma: u16(p, pos + 6), objeto: 0 };
      pos += 8;
      if (conObjetos) {
        poke.objeto = u16(p, pos);
        pos += 2;
      }
      if (conAtaques) {
        poke.ataques = [0, 1, 2, 3].map((m) => u16(p, pos + m * 2));
        pos += 8;
      }
      pokemon.push(poke);
    }
    // combate: 0 individual, 1 doble, 2 triple, 3 rotatorio
    entrenadores.push({ indice: i, clase: t[1], combate: t[2], conAtaques, conObjetos, importante: importantes.has(i), pokemon });
  }
  return entrenadores;
}

// Los objetos del suelo y escondidos: una lista de punteros (relativos) a trozos de script que
// empiezan por «fijar variable, objeto»
function leerObjetosSuelo(narcs, perfil) {
  const lista = [];
  for (const [archivo, orden, variable] of perfil.scriptsObjetos) {
    const s = narcs.scripts.archivos[archivo];
    for (let pos = 0; pos + 4 <= s.length && u16(s, pos) !== FIN_LISTA_SCRIPTS; pos += 4) {
      const destino = pos + 4 + new DataView(s.buffer, s.byteOffset).getInt32(pos, true);
      if (destino < 0 || destino + 8 > s.length) break;
      if (u16(s, destino + 2) === orden && u16(s, destino + 4) === variable) lista.push({ archivo, pos: destino + 6, objeto: u16(s, destino + 6) });
    }
  }
  return lista;
}

// ---------- MT y tutores (el programa principal y el overlay 36, descomprimidos) ----------
//
// Las 95 MT: una lista de u16 detrás de la marca «87 03 88 03» (TM01-92, luego 6 MO y TM93-95).
// Los 60 ataques de los tutores: u16 cada 12 bytes en el overlay 36, en un sitio que cambia de
// una versión a otra (se busca el que tiene sentido).
const PREFIJO_MT = [0x87, 0x03, 0x88, 0x03];
const SITIOS_TUTOR = [0x51538, 0x5152c, 0x51530];
const TUTORES = 60;
const OVERLAY_TUTORES = 36;

export function leerMovimientos(rom) {
  const arm9 = rom.leerArm9();
  let marca = -1;
  for (let i = 0; i + 4 <= arm9.length && marca < 0; i++) if (PREFIJO_MT.every((b, k) => arm9[i + k] === b)) marca = i + 4;
  if (marca < 0) throw new Error("No se han encontrado las MT.");
  const lista = (inicio, cuantos) => Array.from({ length: cuantos }, (_, k) => u16(arm9, inicio + k * 2));
  const mt = [...lista(marca, 92), ...lista(marca + 98 * 2, 3)]; // las 95 MT, sin las MO
  const mo = lista(marca + 92 * 2, 6);

  // Negro y Blanco no tienen tutores de ataques
  if (!perfilDe(rom).tutores) return { arm9, overlay: null, marca, sitio: -1, mt, mo, tutor: [], cambiados: false };

  const overlay = rom.leerOverlay(OVERLAY_TUTORES);
  const sitio = SITIOS_TUTOR.find((base) => {
    const ids = Array.from({ length: TUTORES }, (_, k) => u16(overlay, base + k * 12));
    return ids.every((id) => id > 0 && id <= ULTIMO_ATAQUE) && new Set(ids).size === TUTORES;
  });
  if (sitio === undefined) throw new Error("No se han encontrado los tutores.");
  const tutor = Array.from({ length: TUTORES }, (_, k) => u16(overlay, sitio + k * 12));
  return { arm9, overlay, marca, sitio, mt, mo, tutor, cambiados: false };
}

// El color del disco de cada MT: una tabla en el programa principal (detrás de esta marca), con
// la paleta de cada objeto en (objeto × 4 + 2)
const PALETA_DE_TIPO = {
  fighting: 398, dragon: 399, water: 400, psychic: 401, normal: 402, poison: 403, ice: 404, grass: 405, fire: 406,
  dark: 407, steel: 408, electric: 409, ground: 410, ghost: 411, rock: 412, flying: 413, bug: 610
};
const MT01 = 328;
const MT93 = 618;

// ataques: los de leerBW2 (para el tipo de cada uno)
export function escribirMovimientos(rom, m, ataques) {
  const prefijo = perfilDe(rom).paletasMT;
  let paletas = -1;
  for (let i = 0; i + prefijo.length <= m.arm9.length && paletas < 0; i++) {
    if (prefijo.every((b, k) => m.arm9[i + k] === b)) paletas = i;
  }
  if (paletas >= 0) {
    m.mt.forEach((id, k) => {
      const objeto = k < 92 ? MT01 + k : MT93 + (k - 92);
      const tipo = ataques[id] && ataques[id].tipo;
      poner16(m.arm9, paletas + objeto * 4 + 2, PALETA_DE_TIPO[tipo] || PALETA_DE_TIPO.ghost);
    });
  }
  m.mt.slice(0, 92).forEach((id, k) => poner16(m.arm9, m.marca + k * 2, id));
  m.mt.slice(92).forEach((id, k) => poner16(m.arm9, m.marca + (98 + k) * 2, id));
  rom.escribirArm9(m.arm9);
  if (m.overlay) {
    m.tutor.forEach((id, k) => poner16(m.overlay, m.sitio + k * 12, id));
    rom.escribirOverlay(OVERLAY_TUTORES, m.overlay);
  }
}

// Los de los entrenadores que importan: líderes, Alto Mando... y el rival, con sus tres equipos
// (uno por inicial)
function importantesDe(perfil) {
  return new Set([...perfil.lideres, ...perfil.rivales.flatMap((i) => [i, i + 1, i + 2])]);
}

// Las tiendas de Negro y Blanco: listas de objetos seguidas, en el overlay 21
function leerTiendasOverlay(rom, perfil) {
  const overlay = rom.leerOverlay(perfil.tiendas.overlay);
  const offsets = perfil.tiendas.offsets(rom);
  if (offsets.length !== perfil.tiendas.tamanos.length) throw new Error("No se conocen las tiendas de esta versión.");
  return { overlay, tiendas: offsets.map((inicio, indice) => ({ indice, objetos: Array.from({ length: perfil.tiendas.tamanos[indice] }, (_, k) => u16(overlay, inicio + k * 2)) })) };
}

export function leerBW2(rom) {
  const perfil = perfilDe(rom);
  if (!perfil) throw new Error("Esta ROM no es de Negro, Blanco, Negro 2 ni Blanco 2.");
  const narcs = Object.fromEntries(
    Object.entries(perfil.rutas).filter(([, ruta]) => ruta).map(([nombre, ruta]) => [nombre, leerNarc(rom.archivo(ruta))])
  );

  const ataques = narcs.ataques.archivos.map((a, id) =>
    id && id <= ULTIMO_ATAQUE ? { id, tipo: TIPOS[a[0]], categoria: a[2], potencia: a[3], precision: a[4], pp: a[5] } : null
  );

  const estaticos = perfil.estaticos.map((e) => {
    const [archivo, pos] = e.especie[0];
    const nivel = e.nivel[0] ? narcs.scripts.archivos[e.nivel[0][0]][e.nivel[0][1]] : 0;
    return { ...e, actual: u16(narcs.scripts.archivos[archivo], pos), nivelActual: nivel };
  });
  // Los que no se tocan (ninguno: también el de la caja de Negro y Blanco, con todos sus sitios, como en UPR-ZX)
  const fijos = typeof perfil.estaticosFijos === "function" ? perfil.estaticosFijos(rom) : perfil.estaticosFijos;
  fijos.forEach((i) => (estaticos[i].ignorar = true));
  estaticos.push(...leerErrantesBW(rom, perfil));

  const usados = new Set(perfil.intercambiosUsados(rom, narcs.intercambios.archivos.length));
  const intercambios = narcs.intercambios.archivos
    .map((t, archivo) => ({
      archivo, da: u32(t, 4), pide: u32(t, 0x5c), objeto: u32(t, 0x4c), daOriginal: u32(t, 4), pideOriginal: u32(t, 0x5c),
      ivs: [0, 1, 2, 3, 4, 5].map((k) => u32(t, 0x10 + k * 4))
    }))
    .filter((t) => usados.has(t.archivo) && t.da && t.da <= ULTIMA_ESPECIE);

  // Claros ocultos (solo en Negro 2 y Blanco 2): por claro, en la parte de esta versión, 3 rarezas
  // x 4 grupos: especie (u16), nivel máximo (+8), nivel (+12), género (+16) y forma (+20)
  let claros = null;
  const huecosClaros = [];
  if (perfil.claros) {
    claros = leerNarc(rom.archivo(CLAROS));
    const version = claroDeVersion(rom);
    claros.archivos.forEach((a, archivo) => {
      for (let rareza = 0; rareza < 3; rareza++) {
        for (let grupo = 0; grupo < 4; grupo++) {
          const base = version * 78 + rareza * 26;
          if (base + 26 > a.length) continue;
          huecosClaros.push({ archivo, pos: base + grupo * 2, forma: base + 20 + grupo, especie: u16(a, base + grupo * 2) });
        }
      }
    });
  }

  let tiendas;
  let overlayTiendas = null;
  if (perfil.tiendas.narc) {
    tiendas = narcs.tiendas.archivos.map((t, indice) => ({ indice, objetos: Array.from({ length: t.length / 2 }, (_, k) => u16(t, k * 2)) }));
  } else {
    ({ tiendas, overlay: overlayTiendas } = leerTiendasOverlay(rom, perfil));
  }
  const precios = narcs.objetos.archivos.map((o) => (o.length >= 2 ? u16(o, 0) : 0));

  return {
    perfil,
    narcs,
    especies: leerEspecies(narcs),
    aprende: leerAprende(narcs),
    ataques,
    salvajes: [...leerSalvajes(narcs), ...leerEnjambres(rom, perfil)],
    entrenadores: leerEntrenadores(narcs, importantesDe(perfil)),
    iniciales: perfil.iniciales.map((sitios) => u16(narcs.scripts.archivos[sitios[0][0]], sitios[0][1])),
    estaticos,
    intercambios,
    objetosSuelo: leerObjetosSuelo(narcs, perfil),
    tiendas,
    overlayTiendas,
    overlayTiendasOriginal: overlayTiendas && overlayTiendas.slice(),
    precios,
    claros: claros ? { narc: claros, huecos: huecosClaros } : { narc: null, huecos: [] }
  };
}

// ---------- Los enjambres ----------
//
// En el overlay del campo (el 21 en Negro y Blanco, el 36 en Negro 2 y Blanco 2), una fila de 8 bytes por ruta: [55 u16,
// zona u16, especie u16, forma, otro byte (igual en todas)]. Cada versión tiene la suya. Se busca por su forma (ningún
// randomizer los toca: localizado a mano con la lista de Serebii)
function filasEnjambres(c) {
  const vale = (k) => u16(c, k) === 55 && u16(c, k + 4) >= 1 && u16(c, k + 4) <= ULTIMA_ESPECIE && c[k + 6] === 0;
  for (let k = 0; k + 64 < c.length; k += 2) {
    if (![0, 1, 2, 3, 4, 5, 6, 7].every((n) => vale(k + n * 8) && c[k + n * 8 + 7] === c[k + 7])) continue;
    const filas = [];
    for (let i = k; vale(i) && c[i + 7] === c[k + 7]; i += 8) filas.push(i);
    return filas;
  }
  return [];
}

function leerEnjambres(rom, perfil) {
  const c = rom.leerOverlay(perfil.dobles.overlay);
  return filasEnjambres(c).map((pos) => ({
    archivo: `enjambre:${u16(c, pos + 2)}`, enjambre: true,
    estaciones: [[{ zona: "enjambre", huecos: [{ especie: u16(c, pos + 4), forma: 0, min: 0, max: 0, vacio: false, pos }] }]]
  }));
}

function escribirEnjambres(rom, perfil, areas) {
  if (!areas.length) return;
  const c = rom.leerOverlay(perfil.dobles.overlay);
  const antes = c.slice();
  for (const a of areas) for (const h of a.estaciones[0][0].huecos) {
    poner16(c, h.pos + 4, h.especie);
    c[h.pos + 6] = 0;
  }
  if (c.some((v, i) => v !== antes[i])) rom.escribirOverlay(perfil.dobles.overlay, c);
}

// ---------- Los errantes de Negro y Blanco ----------
//
// Tornadus (Negro) y Thundurus (Blanco), en el overlay 10: la especie de cada uno en una pareja de u32 y en la función que
// da su marca (que calcula Thundurus como Tornadus + 1: se cambia como en UPR-ZX, applyBlackWhiteRoamerPatch, para que lo
// lea de una palabra propia); el nivel (un «movs r0, #40»), 0xFE bytes antes de la pareja; y en el script 674. Se busca
// todo por su forma (en las ROM españolas está 16 bytes antes que en las de UPR-ZX)
const OVERLAY_ERRANTES = 10;
const MARCA_ERRANTES = "0549884204d0491c884203d1";
const MARCA_ERRANTES_HECHO = "0549884204d00349884200d1";
const SCRIPT_ERRANTES = { 642: [[674, 0x57e], [674, 0x5f1]], 641: [[674, 0x572], [674, 0x5dc]] };

function leerErrantesBW(rom, perfil) {
  if (perfil.id !== "bw1") return [];
  const ov = rom.leerOverlay(OVERLAY_ERRANTES);
  const sinTocar = buscar(ov, hex(MARCA_ERRANTES));
  const tocada = buscar(ov, hex(MARCA_ERRANTES_HECHO));
  const funcion = sinTocar >= 0 ? sinTocar : tocada;
  if (funcion < 0) return [];
  const u32 = (i) => (ov[i] | (ov[i + 1] << 8) | (ov[i + 2] << 16) | (ov[i + 3] << 24)) >>> 0;
  const tornadus = u32(funcion + 24);
  const thundurus = sinTocar >= 0 ? tornadus + 1 : u32(funcion + 20);
  const parejas = [];
  // (sin contar la de la función, que tras el cambio es igual)
  for (let i = 0; i + 8 <= ov.length; i += 4) if (u32(i) === thundurus && u32(i + 4) === tornadus && i !== funcion + 20) parejas.push(i);
  if (parejas.length !== 1 || ov[parejas[0] - 0xfe + 1] !== 0x20) return [];
  const pareja = parejas[0];
  return [[thundurus, 642, 0], [tornadus, 641, 4]].map(([actual, delJuego, k]) => ({
    nombre: delJuego === 642 ? "Thundurus (errante)" : "Tornadus (errante)", tabla: "erranteBW", funcion, ya: sinTocar < 0,
    k, pareja, actual, nivelActual: ov[pareja - 0xfe], especie: [], nivel: [], forma: [], scripts: SCRIPT_ERRANTES[delJuego]
  }));
}

function escribirErrantesBW(rom, narcs, errantes) {
  if (!errantes.length || errantes.every((e) => e.nueva === undefined || e.nueva === e.actual)) return;
  const ov = rom.leerOverlay(OVERLAY_ERRANTES);
  const poner32 = (i, v) => { ov[i] = v & 0xff; ov[i + 1] = (v >> 8) & 0xff; ov[i + 2] = (v >> 16) & 0xff; ov[i + 3] = (v >>> 24) & 0xff; };
  const f = errantes[0].funcion;
  if (!errantes[0].ya) {
    ov[f + 10] = 0x00; // «bne» al caso que no se usa: vuelve sin más
    ov[f + 6] = 0x03; // y Thundurus, de su palabra (ldr r1, [pc, #12])
    ov[f + 7] = 0x49;
  }
  for (const e of errantes) {
    const especie = e.nueva !== undefined ? e.nueva : e.actual;
    poner32(e.k ? f + 24 : f + 20, especie);
    poner32(e.pareja + e.k, especie);
    for (const [archivo, pos] of e.scripts) poner16(narcs.scripts.archivos[archivo], pos, especie);
  }
  rom.escribirOverlay(OVERLAY_ERRANTES, ov);
}

// ---------- Escribir ----------

// La orden que da las iniciales (o, en Negro y Blanco, la de la Pokédex) se cambia por un salto
// (o una llamada) de 4 bytes a un trozo nuevo al final del script que la repite y sigue como
// debe. Es el arreglo de UPR-ZX al cambiar las iniciales: sin él, un evento de después falla.
function arreglarScriptIniciales(script, { orden, trozo, salto }) {
  const yaEsta = trozo.every((b, k) => script[script.length - trozo.length + k] === b);
  if (yaEsta) return script;
  let sitio = -1;
  for (let i = 0; i + orden.length <= script.length && sitio < 0; i++) {
    if (orden.every((b, k) => script[i + k] === b)) sitio = i;
  }
  if (sitio <= 0) return script; // un script distinto: se deja
  const nuevo = new Uint8Array(script.length + trozo.length);
  nuevo.set(script);
  nuevo.set(trozo, script.length);
  nuevo[sitio] = salto;
  nuevo[sitio + 1] = 0x00;
  new DataView(nuevo.buffer).setInt32(sitio + 2, script.length - (sitio + 6), true);
  return nuevo;
}
function escribirEspecies(narcs, especies) {
  for (const e of especies) {
    if (!e) continue;
    const d = narcs.datos.archivos[e.id];
    e.stats.forEach((s, k) => (d[ORDEN_STATS[k]] = s));
    d[6] = TIPOS.indexOf(e.tipos[0]);
    d[7] = TIPOS.indexOf(e.tipos[1] || e.tipos[0]);
    e.habilidades.forEach((h, k) => (d[24 + k] = h));
    e.objetos.forEach((o, k) => poner16(d, 12 + k * 2, o));
    d.set(e.mt, 40);
    if (e.tutor.length && d.length >= 76) d.set(e.tutor, 60);
    const v = narcs.evoluciones.archivos[e.id];
    v.fill(0);
    e.evoluciones.slice(0, 7).forEach((evo, k) => {
      poner16(v, k * 6, evo.metodo);
      poner16(v, k * 6 + 2, evo.dato);
      poner16(v, k * 6 + 4, evo.especie);
    });
  }
}

function escribirAprende(narcs, aprende) {
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const lista = aprende[id] || [];
    const a = new Uint8Array(lista.length * 4 + 4);
    lista.forEach(([ataque, nivel], k) => {
      poner16(a, k * 4, ataque);
      poner16(a, k * 4 + 2, nivel);
    });
    poner16(a, lista.length * 4, 0xffff);
    poner16(a, lista.length * 4 + 2, 0xffff);
    narcs.aprende.archivos[id] = a;
  }
}

function escribirSalvajes(narcs, salvajes) {
  for (const { archivo, estaciones } of salvajes) {
    const a = narcs.salvajes.archivos[archivo];
    estaciones.forEach((zonas, e) => {
      for (const { z, huecos } of zonas) {
        let pos = e * POR_ESTACION + 8 + ZONAS.slice(0, z).reduce((t, zona) => t + zona.huecos * 4, 0);
        for (const h of huecos) {
          poner16(a, pos, (h.especie & 0x7ff) | (h.forma << 11));
          a[pos + 2] = h.min;
          a[pos + 3] = h.max;
          pos += 4;
        }
      }
    });
  }
}

// Cada equipo se vuelve a montar: puede tener más Pokémon, objetos o ataques que antes
function escribirEntrenadores(narcs, entrenadores) {
  for (const t of entrenadores) {
    const cabecera = narcs.entrenadores.archivos[t.indice];
    cabecera[0] = (cabecera[0] & ~3) | (t.conAtaques ? 1 : 0) | (t.conObjetos ? 2 : 0);
    cabecera[3] = t.pokemon.length;
    // Uno que pasa a combate doble: sin esa marca de la IA, se atacaría a su propio Pokémon
    if (cabecera[2] === 0 && t.combate === 1) {
      cabecera[2] = 1;
      cabecera[12] |= 0x80;
    }
    const tam = 8 + (t.conObjetos ? 2 : 0) + (t.conAtaques ? 8 : 0);
    const p = new Uint8Array(tam * t.pokemon.length);
    let pos = 0;
    for (const poke of t.pokemon) {
      p[pos] = poke.dificultad;
      p[pos + 1] = poke.habilidad;
      poner16(p, pos + 2, poke.nivel);
      poner16(p, pos + 4, poke.especie);
      poner16(p, pos + 6, poke.forma);
      pos += 8;
      if (t.conObjetos) {
        poner16(p, pos, poke.objeto || 0);
        pos += 2;
      }
      if (t.conAtaques) {
        (poke.ataques || [0, 0, 0, 0]).forEach((m, k) => poner16(p, pos + k * 2, m));
        pos += 8;
      }
    }
    narcs.equipos.archivos[t.indice] = p;
  }
}

export function escribirBW2(rom, datos) {
  const { narcs, perfil } = datos;
  escribirEspecies(narcs, datos.especies);
  escribirAprende(narcs, datos.aprende);
  escribirSalvajes(narcs, datos.salvajes.filter((a) => !a.enjambre));
  escribirEntrenadores(narcs, datos.entrenadores);

  // Datos de los ataques
  for (const a of datos.ataques) {
    if (!a) continue;
    const d = narcs.ataques.archivos[a.id];
    d[0] = TIPOS.indexOf(a.tipo);
    d[2] = a.categoria;
    d[3] = a.potencia;
    d[4] = a.precision;
    d[5] = a.pp;
  }

  // Iniciales (y el arreglo del script si cambian)
  const cambianIniciales = perfil.iniciales.some((sitios, i) => u16(narcs.scripts.archivos[sitios[0][0]], sitios[0][1]) !== datos.iniciales[i]);
  perfil.iniciales.forEach((sitios, i) => sitios.forEach(([archivo, pos]) => poner16(narcs.scripts.archivos[archivo], pos, datos.iniciales[i])));
  if (cambianIniciales) {
    const donde = perfil.arregloIniciales.script || perfil.scriptIniciales;
    narcs.scripts.archivos[donde] = arreglarScriptIniciales(narcs.scripts.archivos[donde], perfil.arregloIniciales);
  }

  // Estáticos: la especie en todos sus sitios y la forma a 0
  for (const e of datos.estaticos) {
    if (e.nueva === undefined || e.tabla) continue;
    for (const [archivo, pos] of e.especie) poner16(narcs.scripts.archivos[archivo], pos, e.nueva);
    for (const [archivo, pos] of e.forma) narcs.scripts.archivos[archivo][pos] = 0;
  }
  escribirErrantesBW(rom, narcs, datos.estaticos.filter((e) => e.tabla === "erranteBW"));

  // Intercambios (la naturaleza, al azar del juego; la forma, la normal)
  for (const t of datos.intercambios) {
    const a = narcs.intercambios.archivos[t.archivo];
    // Si el Pokémon cambia, la forma pasa a ser la normal (si no, se deja: Basculin la tiene)
    if (t.da !== t.daOriginal) {
      poner32(a, 4, t.da);
      poner32(a, 8, 0);
      poner32(a, 0x2c, 0xff); // naturaleza al azar (como en UPR-ZX)
    }
    t.ivs.forEach((iv, k) => poner32(a, 0x10 + k * 4, iv));
    poner32(a, 0x4c, t.objeto);
    if (t.pide !== t.pideOriginal) poner32(a, 0x5c, t.pide);
  }
  // En Negro y Blanco, los scripts de los intercambios también comprueban qué Pokémon se pide y
  // se da (el orden es el de los intercambios que se usan)
  perfil.scriptsIntercambio.forEach(([archivo, sitios], k) => {
    const t = datos.intercambios[k];
    if (!t || (t.da === t.daOriginal && t.pide === t.pideOriginal)) return;
    for (const [pide, da] of sitios) {
      poner16(narcs.scripts.archivos[archivo], pide, t.pide);
      poner16(narcs.scripts.archivos[archivo], da, t.da);
    }
  });

  for (const o of datos.objetosSuelo) poner16(narcs.scripts.archivos[o.archivo], o.pos, o.objeto);

  // Claros ocultos (solo Negro 2 y Blanco 2)
  let clarosCambian = false;
  for (const h of datos.claros.huecos) {
    const a = datos.claros.narc.archivos[h.archivo];
    if (u16(a, h.pos) === h.especie) continue;
    poner16(a, h.pos, h.especie);
    a[h.forma] = 0;
    clarosCambian = true;
  }
  if (clarosCambian) rom.cambiar(CLAROS, crearNarc(datos.claros.narc));

  if (perfil.tiendas.narc) {
    for (const t of datos.tiendas) {
      const a = new Uint8Array(t.objetos.length * 2);
      t.objetos.forEach((o, k) => poner16(a, k * 2, o));
      narcs.tiendas.archivos[t.indice] = a;
    }
  } else {
    // Negro y Blanco: en el overlay (el del campo), una lista detrás de otra
    const offsets = perfil.tiendas.offsets(rom);
    for (const t of datos.tiendas) t.objetos.forEach((o, k) => poner16(datos.overlayTiendas, offsets[t.indice] + k * 2, o));
    if (datos.overlayTiendas.some((b, i) => b !== datos.overlayTiendasOriginal[i])) rom.escribirOverlay(perfil.tiendas.overlay, datos.overlayTiendas);
  }

  datos.precios.forEach((precio, id) => {
    const o = narcs.objetos.archivos[id];
    if (o && o.length >= 2) poner16(o, 0, precio);
  });
  // (después de las tiendas: en Negro y Blanco van en el mismo overlay)
  escribirEnjambres(rom, perfil, datos.salvajes.filter((a) => a.enjambre));

  for (const [nombre, ruta] of Object.entries(perfil.rutas)) {
    if (!ruta) continue;
    const nuevo = crearNarc(narcs[nombre]);
    const viejo = rom.archivo(ruta);
    if (nuevo.length !== viejo.length || nuevo.some((b, i) => b !== viejo[i])) rom.cambiar(ruta, nuevo);
  }
}

// ---------- Textos ----------
//
// Lo que se cambia para que lo que se lee cuadre con lo randomizado:
//   · la descripción de cada MT (en a/0/0/2, el 63 en Negro 2 y Blanco 2, el 53 en Negro y Blanco), la
//     de su ataque nuevo (el 402 / el 202)
//   · el tipo de cada inicial en la pantalla de elegir (a/0/0/3, el 169 / el 430)
//   · los nombres de los Pokémon en lo que dicen los de los intercambios (a/0/0/3)
//   · los nombres de los entrenadores y de sus clases (a/0/0/2, el 382 y el 383 / el 190 y el 191)
// Los números de cada juego, en ./perfiles-gen5.js.
// Todo lo de un archivo, de una vez: los textos del sistema son enormes (5 MB) y, si crecen,
// moverlos puede no caber.
const TEXTOS_SISTEMA = "a/0/0/2";
const TEXTOS_HISTORIA = "a/0/0/3";
export function nombresPokemon(rom) {
  return leerTextos(leerNarc(rom.archivo(TEXTOS_SISTEMA)).archivos[perfilDe(rom).textos.pokemon]).entradas.map((e) => e.texto);
}

// cambios: { mt (los 95 ataques nuevos), iniciales: [{ tipo }] (en español), intercambios: Map
// (nombre viejo -> nuevo) }
export function actualizarTextos(rom, { mt, iniciales, intercambios, entrenadores }) {
  const perfil = perfilDe(rom);
  const textos = perfil.textos;
  const sistema = leerNarc(rom.archivo(TEXTOS_SISTEMA));
  const historia = leerNarc(rom.archivo(TEXTOS_HISTORIA));
  const leer = (narc, n) => leerTextos(narc.archivos[n]).entradas.map((e) => e.texto);
  const poner = (narc, n, textos) => (narc.archivos[n] = escribirTextos(narc.archivos[n], textos));
  let cambiaSistema = false;
  let cambiaHistoria = false;

  if (mt) {
    const descripciones = leer(sistema, textos.descripcionObjetos);
    const deAtaques = leer(sistema, textos.descripcionAtaques);
    mt.forEach((id, k) => (descripciones[k < 92 ? MT01 + k : MT93 + (k - 92)] = deAtaques[id] || ""));
    poner(sistema, textos.descripcionObjetos, descripciones);
    cambiaSistema = true;
  }

  // Nombres de entrenadores y de sus clases (los de leerNombresEntrenadores, ya cambiados)
  if (entrenadores) {
    poner(sistema, textos.nombresEntrenadores, entrenadores.nombres);
    poner(sistema, textos.clasesEntrenadores, entrenadores.clases);
    cambiaSistema = true;
  }

  if (iniciales) {
    const lineas = leer(historia, textos.iniciales);
    iniciales.forEach(({ tipo }, i) => {
      const n = textos.entradasIniciales[i];
      lineas[n] = lineas[n].replace(/tipo [^.-￿]+\./, `tipo ${tipo}.`);
    });
    poner(historia, textos.iniciales, lineas);
    cambiaHistoria = true;
  }

  if (intercambios && intercambios.size) {
    // Todos a la vez (un nombre nuevo puede ser el viejo de otro intercambio)
    const patron = new RegExp([...intercambios.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    for (const n of perfil.textosIntercambios(rom)) {
      poner(historia, n, leer(historia, n).map((t) => t.replace(patron, (viejo) => intercambios.get(viejo))));
    }
    cambiaHistoria = true;
  }

  if (cambiaSistema) rom.cambiar(TEXTOS_SISTEMA, crearNarc(sistema));
  if (cambiaHistoria) rom.cambiar(TEXTOS_HISTORIA, crearNarc(historia));
}
// ---------- Cómo se ven y suenan las iniciales al elegir ----------
//
// a/2/0/2 (a/2/0/5 en Negro y Blanco) lleva lo de la pantalla de elegir: la paleta de cada inicial (archivos 0, 2 y 4) y su
// dibujo sin comprimir (12, 13 y 14). Se copian de los dibujos de cada Pokémon (a/0/0/4, 20
// archivos por especie: el 0, el dibujo comprimido con LZ; el 18, la paleta). Los gritos van en
// el overlay 316 (el 223 en Negro y Blanco), tres u16 detrás de una marca.
const DIBUJOS_POKEMON = "a/0/0/4";

export function ponerAspectoIniciales(rom, iniciales) {
  const { dibujos: DIBUJOS_INICIALES, overlay: OVERLAY_GRITOS, prefijo: PREFIJO_GRITOS } = perfilDe(rom).aspectoIniciales;
  const pantalla = leerNarc(rom.archivo(DIBUJOS_INICIALES));
  const dibujos = leerNarc(rom.archivo(DIBUJOS_POKEMON));
  iniciales.forEach((id, i) => {
    const dibujo = descomprimirLZ(dibujos.archivos[id * 20]);
    if (!dibujo) return;
    pantalla.archivos[i * 2] = dibujos.archivos[id * 20 + 18].slice();
    pantalla.archivos[12 + i] = dibujo;
  });
  rom.cambiar(DIBUJOS_INICIALES, crearNarc(pantalla));

  const overlay = rom.leerOverlay(OVERLAY_GRITOS);
  let sitio = -1;
  for (let i = 0; i + PREFIJO_GRITOS.length <= overlay.length && sitio < 0; i++) {
    if (PREFIJO_GRITOS.every((b, k) => overlay[i + k] === b)) sitio = i + PREFIJO_GRITOS.length;
  }
  if (sitio < 0) return;
  iniciales.forEach((id, i) => poner16(overlay, sitio + i * 2, id));
  rom.escribirOverlay(OVERLAY_GRITOS, overlay);
}

// ---------- Nombres de los entrenadores ----------
//
// En a/0/0/2: el nombre de cada entrenador (la entrada n, el entrenador n) y el de cada clase
// («Dama», «Pescador»...).
export function leerNombresEntrenadores(rom) {
  const textos = perfilDe(rom).textos;
  const narc = leerNarc(rom.archivo(TEXTOS_SISTEMA));
  const leer = (n) => leerTextos(narc.archivos[n]).entradas.map((e) => e.texto);
  return { nombres: leer(textos.nombresEntrenadores), clases: leer(textos.clasesEntrenadores) };
}

// ---------- Retoques del juego ----------

// Dónde está el patrón, si está una sola vez (si no, -1)
function buscar(bytes, patron) {
  let sitio = -1;
  for (let i = 0; i + patron.length <= bytes.length; i++) {
    if (bytes[i] !== patron[0] || !patron.every((b, k) => bytes[i + k] === b)) continue;
    if (sitio >= 0) return -1;
    sitio = i;
  }
  return sitio;
}
const hex = (texto) => texto.match(/../g).map((x) => parseInt(x, 16));

// Pokédex Nacional desde el principio: el parche de UPR-ZX (IPS) cambia el script donde te dan la
// Pokédex y lo alarga 4 bytes (la orden que activa la nacional). Se aplica a los scripts que ya
// están leídos (datos), ANTES de escribirBW2: así el arreglo de las iniciales, que añade un trozo
// al final de ese script en Negro y Blanco, se calcula sobre el script ya alargado.
export function ponerPokedexNacional(datos) {
  const perfil = datos.perfil;
  const original = datos.narcs.scripts.archivos[perfil.scriptPokedex];
  const ampliado = new Uint8Array(original.length + 4);
  ampliado.set(original);
  datos.narcs.scripts.archivos[perfil.scriptPokedex] = aplicarIPS(ampliado, IPS[perfil.parcheNacional]);
}
// Hierba en los pueblos que no tienen (ver ./hierba-gen5.js). Antes de leerBW2: así los Pokémon
// nuevos se randomizan con los demás salvajes. Devuelve las zonas que la llevan.
export function ponerHierbaEnPueblos(rom) {
  return hierbaEnPueblos(rom, perfilDe(rom), { leerNarc, crearNarc });
}

// Texto instantáneo (lo mismo que UPR-ZX, buscado por su forma): en la rutina que escribe los
// textos, fuera la espera entre letra y letra («beq; b» → nada) y, al acabar una letra, a por la
// siguiente sin esperar al próximo fotograma (el «bne» de 0xB8 bytes más allá salta atrás).
const ESPERA_TEXTO = hex("a87f002800d081e0");
const DE_ESPERA_A_SIGUIENTE = 0xb8;

export function ponerTextoRapido(rom) {
  const arm9 = rom.leerArm9();
  if (!perfilDe(rom).textoRapido) return;
  // (una ROM ya randomizada con el texto instantáneo)
  if (buscar(arm9, hex("a87f0028c046c046")) >= 0) return;
  const sitio = buscar(arm9, ESPERA_TEXTO) + 4;
  const salto = sitio + DE_ESPERA_A_SIGUIENTE;
  if (sitio < 4 || arm9[salto] !== 0x02 || arm9[salto + 1] !== 0xd1) throw new Error("No se ha encontrado la rutina del texto.");
  arm9.set([0xc0, 0x46, 0xc0, 0x46], sitio);
  arm9.set([0xc5, 0xd1], salto);
  rom.escribirArm9(arm9);
}

// Todos los combates dobles (como UPR-ZX): los entrenadores ya van marcados como dobles (en
// escribirBW2); aquí, que el juego lo lleve bien. Los que ya eran dobles cambian de caja de texto
// (a/0/8/9, o a/0/9/0 en Negro y Blanco); en el overlay 36 (el 21), que un entrenador doble suelto use las cajas de uno normal, te vea
// aunque lleves un solo Pokémon y no busque a su pareja si no la tiene; en el programa principal,
// que solo mire al entrenador que toca al elegir la caja de texto.
export function ponerCombatesDobles(rom, yaDobles) {
  const { cajas: CAJAS_ENTRENADORES, overlay: OVERLAY_CAMPO, ...prefijos } = perfilDe(rom).dobles;
  // Una ROM ya randomizada con combates dobles: ya está todo hecho (las marcas son parte de lo que se cambia)
  if (buscar(rom.leerArm9(), hex(prefijos.textoCaja)) < 0 && buscar(rom.leerOverlay(OVERLAY_CAMPO), hex(prefijos.caja)) < 0) return;
  const cajas = leerNarc(rom.archivo(CAJAS_ENTRENADORES));
  const lista = cajas.archivos[0];
  const CAMBIO = { 3: 0, 5: 2, 6: 0x18 };
  for (let i = 0; i + 4 <= lista.length; i += 4) {
    const caja = u16(lista, i + 2);
    if (yaDobles.has(u16(lista, i)) && CAMBIO[caja] !== undefined) poner16(lista, i + 2, CAMBIO[caja]);
  }
  rom.cambiar(CAJAS_ENTRENADORES, crearNarc(cajas));

  const campo = rom.leerOverlay(OVERLAY_CAMPO);
  const tras = (patron) => {
    const i = buscar(campo, hex(patron));
    if (i < 0) throw new Error("Este juego no admite los combates dobles.");
    return i + 8;
  };
  let o = tras(prefijos.caja);
  campo[o - 2] = 0;
  campo[o] = 2;
  campo[o + 2] = 0x18;
  o = tras(prefijos.limite);
  poner16(campo, o, 0x46c0); // nop
  poner16(campo, o + 2, 0x46c0);
  o = tras(prefijos.puntero);
  poner16(campo, o + 0x10, u16(campo, o + 0x0e));
  poner16(campo, o + 0x0e, u16(campo, o + 0x0c));
  poner16(campo, o + 0x0c, u16(campo, o + 0x0a));
  poner16(campo, o + 0x0a, prefijos.beq); // beq al caso de un entrenador solo
  poner16(campo, o + 0x08, 0x2800); // cmp r0, #0
  rom.escribirOverlay(OVERLAY_CAMPO, campo);

  const arm9 = rom.leerArm9();
  const i = buscar(arm9, hex(prefijos.textoCaja));
  if (i < 0) throw new Error("Este juego no admite los combates dobles.");
  arm9[i + 4] = 2;
  rom.escribirArm9(arm9);
}