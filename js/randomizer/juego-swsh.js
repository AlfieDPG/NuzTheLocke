// ---------- Espada y Escudo ----------
//
// Los datos salen de la carpeta «romfs» (ver ./rom-switch.js). Se preparan con prepararRom(sesion),
// que lee de antemano lo que hace falta; después todo es síncrono, como en los demás motores
// (leerBW2, escribirBW2...). Lo cambiado sale como archivos sueltos de un mod (LayeredFS).
//
//   pml/personal/personal_total.bin   0xB0 bytes por entrada (las formas, desde la 899): PS, Ata, Def, Vel,
//                                     AtE, DfE (0-5), tipos (6, 7), objetos u16 (0x0C, 0x0E, 0x10), género
//                                     (0x12), habilidades u16 (0x18-0x1D), «está en el juego» (bit 6 de 0x21),
//                                     MT (0x28, 100 bits), tutores de tipo (0x38, 8 bits), DT (0x3C, 100 bits)
//                                     y tutores de la Isla de la Armadura (0xA8, 18 bits)
//   pml/evolution/evo_NNN.bin         9 de [método u16, dato u16, especie u16, forma s8, nivel u8]
//   pml/waza_oboe/wazaoboe_total.bin  0x104 bytes por entrada: [ataque u16, nivel u16]... y 0xFFFF
//   pml/waza/wazaNNNN.wazabin         cada ataque (FlatBuffers)
//   trainer/trainer_data, trainer_poke  0x14 bytes por entrenador y 0x20 por Pokémon
//   archive/field/resident/data_table.gfpak   los salvajes (FlatBuffers dentro de un GFPAK)
//   script_event_data/*.bin           estáticos, regalos (con las iniciales) e intercambios (FlatBuffers)
//   appli/shop/bin/shop_data.bin      las tiendas (FlatBuffers)
//   pml/item/item.dat                 los objetos (el precio, u32 al principio de cada uno)

import { leerFB, escribirFB, raizFB, campoFB, refFB, tablasFB } from "./flatbuffers.js";
import { leerGfpak, escribirGfpak } from "./gfpak.js";
import { SALVAJES, ESTATICOS, REGALOS, INTERCAMBIOS, TIENDAS, ATAQUE } from "./esquemas-swsh.js";
import { leerTextos6, escribirTextos6, aTexto } from "./textos-3ds.js";

export const ULTIMA_ESPECIE = 898;
export const ULTIMO_ATAQUE = 826;
export const ULTIMA_HABILIDAD = 267;

export const TIPOS = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
];
// Los métodos de evolución en los que el dato es un nivel (va en un byte aparte): los de 7.ª y los de Toxtricity
const EVO_CON_NIVEL = new Set([4, 9, 10, 11, 12, 13, 14, 15, 23, 24, 28, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 46, 47]);

const TAM_PERSONAL = 0xb0;
const TAM_APRENDE = 0x104;
const TAM_ENTRENADOR = 0x20;
const IDIOMAS = ["JPN", "JPN_KANJI", "English", "French", "Italian", "German", "Spanish", "Korean", "Simp_Chinese", "Trad_Chinese"];

const RUTAS = {
  personal: "bin/pml/personal/personal_total.bin",
  aprende: "bin/pml/waza_oboe/wazaoboe_total.bin",
  objetos: "bin/pml/item/item.dat",
  hashObjetos: "bin/pml/item/item_hash_to_index.dat",
  salvajes: "bin/archive/field/resident/data_table.gfpak",
  colocacion: "bin/archive/field/resident/placement.gfpak",
  estaticos: "bin/script_event_data/event_encount_data.bin",
  regalos: "bin/script_event_data/add_poke.bin",
  intercambios: "bin/script_event_data/field_trade.bin",
  tiendas: "bin/appli/shop/bin/shop_data.bin"
};
const rutaEvo = (i) => `bin/pml/evolution/evo_${String(i).padStart(3, "0")}.bin`;
const rutaAtaque = (i) => `bin/pml/waza/waza${String(i).padStart(4, "0")}.wazabin`;
const rutaEntrenador = (i) => `bin/trainer/trainer_data/trainer_data_${String(i).padStart(3, "0")}.bin`;
const rutaEquipo = (i) => `bin/trainer/trainer_poke/trainer_poke_${String(i).padStart(3, "0")}.bin`;
const rutaTexto = (idioma, archivo) => `bin/message/${idioma}/common/${archivo}.dat`;
const rutaHistoria = (idioma, archivo) => `bin/message/${idioma}/script/${archivo}.dat`;

// Las MT (TM00 a TM99) y los DT (TR00 a TR99): qué ataque enseña cada uno (van en el programa, que no se toca)
const MT = [
  5, 25, 6, 7, 8, 9, 19, 42, 63, 416, 345, 76, 669, 83, 86, 91, 103, 113, 115, 219,
  120, 156, 157, 168, 173, 182, 184, 196, 202, 204, 211, 213, 201, 240, 241, 258, 250, 251, 261, 263,
  129, 270, 279, 280, 286, 291, 311, 313, 317, 328, 331, 333, 340, 341, 350, 362, 369, 371, 372, 374,
  384, 385, 683, 409, 419, 421, 422, 423, 424, 427, 433, 472, 478, 440, 474, 490, 496, 506, 512, 514,
  521, 523, 527, 534, 541, 555, 566, 577, 580, 581, 604, 678, 595, 598, 206, 403, 684, 693, 707, 784
];
const DT = [
  14, 34, 53, 56, 57, 58, 59, 67, 85, 87, 89, 94, 97, 116, 118, 126, 127, 133, 141, 161,
  164, 179, 188, 191, 200, 473, 203, 214, 224, 226, 227, 231, 242, 247, 248, 253, 257, 269, 271, 276,
  285, 299, 304, 315, 322, 330, 334, 337, 339, 347, 348, 349, 360, 370, 390, 394, 396, 398, 399, 402,
  404, 405, 406, 408, 411, 412, 413, 414, 417, 428, 430, 437, 438, 441, 442, 444, 446, 447, 482, 484,
  486, 492, 500, 502, 503, 526, 528, 529, 535, 542, 583, 599, 605, 663, 667, 675, 676, 706, 710, 776
];
// Los objetos de las MT (TM00 es el 1230)
const OBJETOS_MT = [
  ...Array.from({ length: 92 }, (_, k) => 328 + k), 618, 619, 620, 690, 691, 692, 693, 1230
];
// Tutores: los de tipo (los ocho de 0x38) y los de la Isla de la Armadura (los 18 de 0xA8)
const TUTORES = [520, 519, 518, 338, 307, 308, 434, 796, 805, 807, 812, 804, 803, 813, 811, 810, 815, 814, 797, 806, 800, 809, 799, 808, 798, 802];
// Los que no pueden dinamaxizarse (Zacian, Zamazenta y Eternatus)
const SIN_DINAMAX = new Set([888, 889, 890]);
// Los que pueden gigantamaxizarse
const GIGAMAX = new Set([3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809, 812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851, 858, 861, 869, 879, 884, 892]);

// Los entrenadores. Paul (los tres de cada combate, uno por inicial), Berto, Roxy, Olivia, Rose, Dreo, Sófora,
// Tizonio y Dargo, Mostaz y Peony
const PAUL = [
  4, 5, 6, 7, 8, 9, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 153, 154, 155, 156, 157, 158,
  191, 192, 193, 197, 198, 199, 202, 203, 204, 214, 215, 216, 225, 226, 227, 228, 229, 230, 234, 235, 236, 237,
  238, 239, 252, 253, 254, 255, 256, 257, 312, 313, 314
];
const RIVALES = [
  ...PAUL, 133, 195, 240, 138, 145, 196, 248, 143, 175, 315, 316, 317, 318, 319, 320, 221, 222, 223, 224, 232, 233,
  321, 322, 323, 330
];
// Los líderes de la historia, la Copa de Campeones y Lionel
const LIDERES = [32, 36, 37, 77, 78, 108, 107, 135, 136, 144, 210, 211, 212, 213, 149, 189, 190];
// Cada gimnasio (sus entrenadores y su líder) y Lionel
const GRUPOS = [
  [29, 30, 31, 32], [45, 46, 47, 36], [161, 162, 163, 37], [62, 63, 64, 77], [65, 66, 67, 78], [113, 114, 115, 108],
  [79, 80, 81, 82, 135], [83, 84, 85, 86, 136], [106, 107], [150, 151, 152, 144], [149, 189, 190]
];

// Las tiendas por su hash: las normales (la de los Centros Pokémon, que crece con las medallas, y la de antes del
// tutorial de captura), las de MT y las especiales de la historia (hierbas, inciensos, bayas y las de varios)
const TIENDA_NORMAL_0 = 0x1f3ff031a3a24490n;
const TIENDA_CENTRO = 0x66ca73b2966bb871n;
const TIENDAS_MT = [0x8e308f85b43038b4n, 0x8e309085b4303a67n, 0x8e309185b4303c1an, 0x8e309285b4303dcdn, 0x8e308b85b43031e8n];
const TIENDAS_HISTORIA = [0xcbd67969d873539bn, 0xcbd67869d87351e8n, 0x00cbd669d8735701n, 0x04d7046da09d3c78n, 0x4b2f9e98ddcb0707n, 0xe379cdf67a297070n];
// Huecos libres al final de las especiales (para añadir sin quitar nada: piedras, Caramelos Raros...)
const HUECOS_LIBRES = 4;

// Estáticos que no se tocan: los de escenas especiales (Eternatus, la niebla, los combates de Zacian y Zamazenta,
// Calyrex y sus corceles) y las incursiones
const ESCENARIOS_NO = new Set([4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19]);
const ESPECIES_NO = new Set([888, 889, 890]);
// Regalos que no se tocan: Kubfu (las torres) y los corceles de Calyrex
const REGALOS_NO = new Set([891, 896, 897]);
// Las iniciales: los regalos 0, 3 y 4 (Grookey, Scorbunny y Sobble); en la mesa del principio, los Pokémon 3, 1 y 2
const INICIALES = [0, 3, 4];
const INICIALES_MESA = { archivo: "a_0101.bin", pokemon: [3, 1, 2] };

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
const igual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------- El juego ----------

export function perfilDe(sesion) {
  return {
    id: "swsh", gen: 8, nombre: sesion.titulo,
    ultimaEspecie: ULTIMA_ESPECIE, ultimoAtaque: ULTIMO_ATAQUE, ultimaHabilidad: ULTIMA_HABILIDAD,
    // Los objetos se clasifican con la tabla de 7.ª generación (los números no han cambiado; los nuevos no salen)
    ultimoObjeto: 959, objetosGen: 7,
    tipos: TIPOS,
    // Cambio de Táctica, Disfraz, Unión, Escudo Limitado, Dominio de Poder, Sistema Alfa, Tragamisil, Cara de Hielo,
    // Mutapetito y Unidad Ecuestre
    habilidadesNunca: [176, 197, 208, 209, 210, 211, 225, 241, 248, 258, 266, 267],
    legendarios: [716, 717, 718, 719, 720, 721, 772, 773, ...Array.from({ length: 25 }, (_, k) => 785 + k), ...Array.from({ length: 11 }, (_, k) => 888 + k)],
    maxEvoluciones: 9,
    // MT y DT: qué ataque enseña cada uno no se puede cambiar (está en el programa), quién lo aprende sí
    sinMT: false, mtFijas: true, mtItems: OBJETOS_MT,
    bitsMT: { tm: 256, hm: 0, extra: 0 }, bloquesMT: 32,
    tutores: true, tutorInfo: { cuantos: TUTORES.length, bytes: Math.ceil(TUTORES.length / 8), fijos: [] }, tutoresFijos: true,
    claros: false, iniciales: true,
    lideres: LIDERES, rivales: RIVALES, grupos: GRUPOS, importantes: new Set([...LIDERES, ...RIVALES]),
    // Los de los entrenadores que se gigamaxizan se cambian por otros que también puedan
    gigamax: GIGAMAX,
    // El primer combate con Paul (uno por inicial): solo llevas un Pokémon
    sinDobles: PAUL.slice(0, 3),
    preciosEnDecenas: false
  };
}

export async function prepararRom(sesion) {
  const rutas = [...Object.values(RUTAS)];
  for (let i = 0; i < 1192; i++) if (sesion.tiene(rutaEvo(i))) rutas.push(rutaEvo(i));
  for (let i = 0; i <= ULTIMO_ATAQUE; i++) rutas.push(rutaAtaque(i));
  for (const r of sesion.listar("bin/trainer/trainer_data/")) rutas.push(r, r.replace("trainer_data/trainer_data_", "trainer_poke/trainer_poke_"));
  for (const idioma of IDIOMAS) {
    rutas.push(rutaTexto(idioma, "monsname"), rutaTexto(idioma, "trname"), rutaTexto(idioma, "trtype"), rutaHistoria(idioma, "field_trade"), ...Object.keys(TEXTOS_INICIALES).map((a) => rutaHistoria(idioma, a)));
  }
  await sesion.cargar(rutas.filter((r) => sesion.tiene(r)));
  return perfilDe(sesion);
}

// ---------- Leer ----------

function nombres(sesion, idioma, archivo) {
  return leerTextos6(sesion.archivo(rutaTexto(idioma, archivo))).lineas.map(aTexto);
}

export function nombresPokemon(sesion) {
  return nombres(sesion, "Spanish", "monsname");
}

// La compatibilidad con los tutores como una fila de bits seguidos (los de tipo y luego los de la isla)
function leerTutores(d) {
  const bits = new Uint8Array(Math.ceil(TUTORES.length / 8));
  for (let k = 0; k < TUTORES.length; k++) {
    const si = k < 8 ? d[0x38] & (1 << k) : d[0xa8 + ((k - 8) >> 3)] & (1 << ((k - 8) & 7));
    if (si) bits[k >> 3] |= 1 << (k & 7);
  }
  return bits;
}

function escribirTutores(d, bits) {
  for (let k = 0; k < TUTORES.length; k++) {
    const si = Boolean(bits[k >> 3] & (1 << (k & 7)));
    const [byte, bit] = k < 8 ? [0x38, k] : [0xa8 + ((k - 8) >> 3), (k - 8) & 7];
    d[byte] = si ? d[byte] | (1 << bit) : d[byte] & ~(1 << bit);
  }
}

function leerEspecies(sesion, personal) {
  const especies = [];
  for (let id = 1; id <= ULTIMA_ESPECIE; id++) {
    const d = personal.subarray(id * TAM_PERSONAL, (id + 1) * TAM_PERSONAL);
    // Las que no están en el juego (las que se quedaron fuera de Galar) no salen nunca
    if (!((d[0x21] >> 6) & 1)) continue;
    const stats = [d[0], d[1], d[2], d[4], d[5], d[3]]; // PS, Ata, Def, AtE, DfE, Vel
    const suma = stats.reduce((a, b) => a + b, 0);
    const e = sesion.archivo(rutaEvo(id));
    const evoluciones = [];
    for (let k = 0; k < 9; k++) {
      const o = k * 8;
      const metodo = u16(e, o);
      const especie = u16(e, o + 4);
      if (!metodo || !especie) continue;
      const evo = { metodo, dato: u16(e, o + 2), especie, forma: e[o + 6], nivelOriginal: e[o + 7], especieOriginal: especie, metodoOriginal: metodo };
      evo.paramOriginal = evo.dato;
      if (EVO_CON_NIVEL.has(metodo)) evo.dato = e[o + 7];
      evoluciones.push(evo);
    }
    // Las MT (16 bytes) y los DT (otros 16): 32 bytes, en ese orden
    const mt = new Uint8Array(32);
    mt.set(d.subarray(0x28, 0x38), 0);
    mt.set(d.subarray(0x3c, 0x4c), 16);
    especies[id] = {
      id, stats, total: suma, totalOriginal: suma,
      tipos: [...new Set([TIPOS[d[6]], TIPOS[d[7]]])].filter(Boolean),
      habilidades: [u16(d, 0x18), u16(d, 0x1a) === u16(d, 0x18) ? 0 : u16(d, 0x1a), u16(d, 0x1c)],
      objetos: [u16(d, 0x0c), u16(d, 0x0e), u16(d, 0x10)],
      genero: d[0x12],
      mt, tutor: leerTutores(d),
      evoluciones, previa: 0
    };
  }
  for (const e of especies) if (e) for (const evo of e.evoluciones) if (especies[evo.especie]) especies[evo.especie].previa = e.id;
  return especies;
}

function leerAprende(aprendeTotal, especies) {
  const aprende = [];
  for (const e of especies) {
    if (!e) continue;
    const a = aprendeTotal.subarray(e.id * TAM_APRENDE, (e.id + 1) * TAM_APRENDE);
    const lista = [];
    for (let i = 0; i + 3 < a.length; i += 4) {
      if (u16(a, i) === 0xffff) break;
      lista.push([u16(a, i), u16(a, i + 2)]);
    }
    aprende[e.id] = lista;
  }
  return aprende;
}

// Solo los ataques que se pueden usar en el juego (los demás se quedaron fuera)
function leerAtaques(sesion) {
  const ataques = [];
  const fb = [];
  for (let id = 1; id <= ULTIMO_ATAQUE; id++) {
    const w = leerFB(sesion.archivo(rutaAtaque(id)), ATAQUE);
    fb[id] = w;
    if (!w.CanUseMove) continue;
    ataques[id] = { id, tipo: TIPOS[w.Type], categoria: w.Category, potencia: w.Power, precision: w.Accuracy, pp: w.PP };
  }
  return { ataques, fb };
}

function leerEntrenadores(sesion, perfil) {
  const entrenadores = [];
  for (const ruta of sesion.listar("bin/trainer/trainer_data/")) {
    const indice = Number(ruta.match(/(\d+)\.bin$/)[1]);
    const t = sesion.archivo(ruta);
    const p = sesion.archivo(rutaEquipo(indice));
    const pokemon = [];
    for (let k = 0; k < t[3] && (k + 1) * TAM_ENTRENADOR <= p.length; k++) {
      const o = k * TAM_ENTRENADOR;
      pokemon.push({
        habilidad: (p[o] >> 4) & 3, nivel: u16(p, o + 0x0a), especie: u16(p, o + 0x0c), forma: u16(p, o + 0x0e),
        objeto: u16(p, o + 0x10), ataques: [0, 1, 2, 3].map((m) => u16(p, o + 0x12 + m * 2)), gigamax: Boolean(p[o + 9])
      });
    }
    if (!pokemon.length) continue;
    entrenadores.push({ indice, clase: u16(t, 0), combate: t[2], conAtaques: true, conObjetos: true, importante: perfil.importantes.has(indice), pokemon });
  }
  return entrenadores;
}

// Los salvajes: los de la hierba y los que se ven por el campo, de Espada (k) y de Escudo (t). Cada zona es un
// área (la misma especie pasa a ser la misma otra en todo el área); cada clima, una tabla de 10 huecos
function leerSalvajes(sesion) {
  const pack = leerGfpak(sesion.archivo(RUTAS.salvajes));
  const archivos = {};
  const salvajes = [];
  for (const nombre of ["encount_k.bin", "encount_symbol_k.bin", "encount_t.bin", "encount_symbol_t.bin"]) {
    const fb = leerFB(pack.porNombre(nombre), SALVAJES);
    archivos[nombre] = fb;
    fb.EncounterTables.forEach((tabla, z) => {
      const zonas = tabla.SubTables.map((sub, k) => ({
        zona: `clima${k}`, sub,
        huecos: sub.Slots.map((s) => ({ especie: s.Species, forma: s.Form, min: sub.LevelMin, max: sub.LevelMax, vacio: !s.Species, slot: s }))
      })).filter((zona) => zona.huecos.some((h) => h.especie));
      // (los que se ven por el campo van aparte: con «un solo Pokémon por zona», todos iguales)
      if (zonas.length) salvajes.push({ archivo: `${nombre}:${z}`, estaciones: [zonas], campo: nombre.includes("symbol") });
    });
  }
  return { pack, archivos, salvajes };
}

function leerEstaticos(sesion) {
  const fijos = leerFB(sesion.archivo(RUTAS.estaticos), ESTATICOS);
  const regalos = leerFB(sesion.archivo(RUTAS.regalos), REGALOS);
  const trueques = leerFB(sesion.archivo(RUTAS.intercambios), INTERCAMBIOS);
  const estaticos = [];
  const fuera = (id) => !id || id > ULTIMA_ESPECIE;
  regalos.Table.forEach((r, i) => {
    if (INICIALES.includes(i)) return;
    estaticos.push({ tabla: "regalo", fb: r, actual: r.Species, nivelActual: r.Level, huevo: Boolean(r.IsEgg), ignorar: fuera(r.Species) || REGALOS_NO.has(r.Species) });
  });
  fijos.Table.forEach((f) => {
    estaticos.push({
      tabla: "fijo", fb: f, actual: f.Species, nivelActual: f.Level,
      ignorar: fuera(f.Species) || ESPECIES_NO.has(f.Species) || ESCENARIOS_NO.has(f.EncounterScenario)
    });
  });
  const intercambios = trueques.Table.map((t, indice) => {
    const ivs = [t.IV_HP, t.IV_ATK, t.IV_DEF, t.IV_SPA, t.IV_SPD, t.IV_SPE];
    return {
      indice, fb: t, da: t.Species, daOriginal: t.Species, pide: t.RequiredSpecies, pideOriginal: t.RequiredSpecies,
      objeto: t.HeldItem, objetoOriginal: t.HeldItem, ivs, ivsOriginal: ivs.slice()
    };
  // Los de formas regionales (un Meowth por un Meowth de Galar) se quedan como están: su diálogo no cuadraría
  }).filter((t) => !fuera(t.da) && !fuera(t.pide) && t.da !== t.pide);
  const iniciales = INICIALES.map((i) => regalos.Table[i].Species);
  return { fijos, regalos, trueques, estaticos, intercambios, iniciales };
}

// Los objetos: el precio de cada uno (los que no están en el juego van todos a la entrada 0)
function leerPrecios(sesion) {
  const b = sesion.archivo(RUTAS.objetos);
  const cuantos = u16(b, 0);
  const desde = u32(b, 0x40);
  const entrada = (id) => u16(b, 0x44 + id * 2);
  const usos = new Map();
  for (let id = 0; id < cuantos; id++) usos.set(entrada(id), (usos.get(entrada(id)) || 0) + 1);
  const precios = [];
  const sitio = [];
  for (let id = 1; id < cuantos; id++) {
    const e = entrada(id);
    if (!e || usos.get(e) > 1) continue;
    sitio[id] = desde + e * 0x30;
    precios[id] = u32(b, sitio[id]);
  }
  return { precios, sitioPrecio: sitio };
}

// Los objetos van por un hash (FNV de su nombre interno): item_hash_to_index.dat los traduce. u32 cuántos y, de 16 en 16
// bytes, [u64 hash, u32 número, u32]
function leerHashes(sesion) {
  const b = sesion.archivo(RUTAS.hashObjetos);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const aObjeto = new Map();
  const aHash = new Map();
  for (let k = 0, n = v.getUint32(0, true); k < n && 4 + k * 16 + 12 <= b.length; k++) {
    const hash = v.getBigUint64(4 + k * 16, true);
    const id = v.getUint32(4 + k * 16 + 8, true);
    aObjeto.set(hash, id);
    if (!aHash.has(id)) aHash.set(id, hash);
  }
  return { aObjeto, aHash };
}

// Los objetos del suelo y los escondidos (los brillos): en cada zona de placement.gfpak. Los del suelo llevan hasta 8
// objetos (campo 6 de cada uno, sus hashes) con su cantidad (campo 7); los escondidos, una lista de posibles [hash,
// probabilidad, cantidad]. Cada objeto, con su archivo y dónde está su hash, para cambiarlo ahí mismo
function leerObjetosSuelo(sesion) {
  const { aObjeto } = leerHashes(sesion);
  const pack = leerGfpak(sesion.archivo(RUTAS.colocacion));
  const lista = [];
  for (let i = 0; i < pack.entradas.length; i++) {
    const b = pack.archivo(i);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let zonas;
    try {
      zonas = tablasFB(b, raizFB(b), 0);
    } catch (e) {
      continue; // no es un archivo de zona
    }
    const anadir = (pos) => {
      const id = aObjeto.get(v.getBigUint64(pos, true));
      if (id) lista.push({ objeto: id, archivo: i, pos });
    };
    for (const z of zonas) {
      for (const h of tablasFB(b, z, 6)) {
        const objeto = refFB(b, h, 0);
        const hashes = objeto && refFB(b, objeto, 6);
        if (hashes) for (let k = 0; k < v.getUint32(hashes, true); k++) anadir(hashes + 4 + k * 8);
      }
      for (const h of tablasFB(b, z, 19)) {
        const escondido = refFB(b, h, 0);
        for (const posible of escondido ? tablasFB(b, escondido, 2) : []) {
          const pos = campoFB(b, posible, 0);
          if (pos) anadir(pos);
        }
      }
    }
  }
  return lista;
}

function escribirObjetosSuelo(sesion, datos) {
  if (!datos.objetosSuelo.length) return;
  const { aHash, aObjeto } = leerHashes(sesion);
  const pack = leerGfpak(sesion.archivo(RUTAS.colocacion));
  const nuevos = {};
  for (const o of datos.objetosSuelo) {
    const hash = aHash.get(o.objeto);
    const b = nuevos[o.archivo] || pack.archivo(o.archivo);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (hash === undefined || aObjeto.get(v.getBigUint64(o.pos, true)) === o.objeto) continue;
    v.setBigUint64(o.pos, hash, true);
    nuevos[o.archivo] = b;
  }
  if (Object.keys(nuevos).length) sesion.cambiar(RUTAS.colocacion, escribirGfpak(pack, nuevos));
}

// Las tiendas: una por lista; la de los Centros Pokémon (una lista por medallas), como una sola con todo lo que
// llega a vender. Las especiales, con huecos libres al final (0) para lo que se añada
function leerTiendas(sesion) {
  const fb = leerFB(sesion.archivo(RUTAS.tiendas), TIENDAS);
  const tiendas = [];
  const tipo = { normales: [], mt: [], historia: [] };
  fb.Single.forEach((s, i) => {
    const conHuecos = TIENDAS_HISTORIA.includes(s.Hash);
    tiendas.push({ indice: i, objetos: [...s.Inventories.Items, ...(conHuecos ? new Array(HUECOS_LIBRES).fill(0) : [])], fb: s });
    if (s.Hash === TIENDA_NORMAL_0) tipo.normales.push(i);
    else if (TIENDAS_MT.includes(s.Hash)) tipo.mt.push(i);
    else if (conHuecos) tipo.historia.push(i);
    else tipo.normales.push(i); // las demás (vatios, PB, caramelos...) no se tocan
  });
  let primera = -1;
  fb.Multi.forEach((m, k) => {
    const i = fb.Single.length + k;
    const todo = [...new Set(m.Inventories.flatMap((inv) => inv.Items))];
    tiendas.push({ indice: i, objetos: [...todo, 0], fb: m, varias: true, originales: todo });
    tipo.normales.push(i);
    // En la de los Centros solo se añaden los Caramelos Raros (es la «primera»); las piedras van a las especiales
    if (m.Hash === TIENDA_CENTRO) primera = i;
  });
  return { fb, tiendas, tipoTiendas: { ...tipo, primera, saltar: [], cuantas: tiendas.length } };
}

export function leerBW2(sesion) {
  const perfil = perfilDe(sesion);
  const personal = sesion.archivo(RUTAS.personal);
  const especies = leerEspecies(sesion, personal);
  const { ataques, fb: ataquesFB } = leerAtaques(sesion);
  const est = leerEstaticos(sesion);
  const salvajes = leerSalvajes(sesion);
  const tiendas = leerTiendas(sesion);
  const { precios, sitioPrecio } = leerPrecios(sesion);
  perfil.tiendas = tiendas.tipoTiendas;
  perfil.objetosInexistentes = (id) => !sitioPrecio[id];
  return {
    perfil, especies, ataques, aprende: leerAprende(sesion.archivo(RUTAS.aprende), especies),
    salvajes: salvajes.salvajes, entrenadores: leerEntrenadores(sesion, perfil),
    iniciales: est.iniciales.slice(), inicialesOriginales: est.iniciales.slice(),
    estaticos: est.estaticos, intercambios: est.intercambios, totems: [],
    precios, tiendas: tiendas.tiendas, objetosSuelo: leerObjetosSuelo(sesion), claros: null,
    sw: { personal, ataquesFB, est, salvajes, tiendas, sitioPrecio }
  };
}

// ---------- Escribir ----------

export function escribirBW2(sesion, datos) {
  const { sw } = datos;
  escribirEspecies(sesion, datos);
  escribirAtaques(sesion, datos);
  escribirEntrenadores(sesion, datos);
  escribirSalvajes(sesion, datos);
  escribirEstaticos(sesion, datos);
  escribirTiendas(sesion, datos);
  escribirObjetosSuelo(sesion, datos);
  // Precios
  const objetos = sesion.archivo(RUTAS.objetos);
  const antes = objetos.slice();
  datos.precios.forEach((precio, id) => {
    if (sw.sitioPrecio[id] !== undefined && precio !== undefined) poner32(objetos, sw.sitioPrecio[id], Math.max(0, Math.round(precio)));
  });
  if (!igual(objetos, antes)) sesion.cambiar(RUTAS.objetos, objetos);
}

function escribirEspecies(sesion, datos) {
  const personal = datos.sw.personal.slice();
  const aprende = sesion.archivo(RUTAS.aprende);
  const aprendeAntes = aprende.slice();
  for (const e of datos.especies) {
    if (!e) continue;
    const d = personal.subarray(e.id * TAM_PERSONAL, (e.id + 1) * TAM_PERSONAL);
    [d[0], d[1], d[2], d[3], d[4], d[5]] = [e.stats[0], e.stats[1], e.stats[2], e.stats[5], e.stats[3], e.stats[4]];
    d[6] = TIPOS.indexOf(e.tipos[0]);
    d[7] = TIPOS.indexOf(e.tipos[1] || e.tipos[0]);
    poner16(d, 0x18, e.habilidades[0]);
    poner16(d, 0x1a, e.habilidades[1] || e.habilidades[0]);
    poner16(d, 0x1c, e.habilidades[2] || e.habilidades[0]);
    poner16(d, 0x0c, e.objetos[0]);
    poner16(d, 0x0e, e.objetos[1]);
    poner16(d, 0x10, e.objetos[2]);
    // MT y DT: solo los 100 primeros bits de cada bloque (los demás no son de nada)
    for (const [bloque, sitio] of [[0, 0x28], [16, 0x3c]]) {
      for (let i = 0; i < 100; i++) {
        const si = Boolean(e.mt[bloque + (i >> 3)] & (1 << (i & 7)));
        d[sitio + (i >> 3)] = si ? d[sitio + (i >> 3)] | (1 << (i & 7)) : d[sitio + (i >> 3)] & ~(1 << (i & 7));
      }
    }
    escribirTutores(d, e.tutor);

    // Evoluciones
    const ruta = rutaEvo(e.id);
    const ev = sesion.archivo(ruta);
    const evAntes = ev.slice();
    for (let k = 0; k < 9; k++) {
      const evo = e.evoluciones[k];
      const o = k * 8;
      if (!evo && !u16(evAntes, o)) continue;
      poner16(ev, o, evo ? evo.metodo : 0);
      poner16(ev, o + 4, evo ? evo.especie : 0);
      const conNivel = evo && EVO_CON_NIVEL.has(evo.metodo);
      poner16(ev, o + 2, evo && !conNivel ? evo.dato : evo && evo.metodo === evo.metodoOriginal ? evo.paramOriginal : 0);
      ev[o + 6] = evo && evo.especie === evo.especieOriginal ? evo.forma || 0 : 0;
      ev[o + 7] = evo ? (conNivel ? evo.dato : evo.nivelOriginal || 0) : 0;
    }
    if (!igual(ev, evAntes)) sesion.cambiar(ruta, ev);

    // Ataques que aprende (65 como mucho)
    const lista = (datos.aprende[e.id] || []).slice(0, TAM_APRENDE / 4 - 1);
    const a = aprende.subarray(e.id * TAM_APRENDE, (e.id + 1) * TAM_APRENDE);
    a.fill(0xff);
    lista.forEach(([ataque, nivel], k) => {
      poner16(a, k * 4, ataque);
      poner16(a, k * 4 + 2, nivel);
    });
  }
  if (!igual(personal, datos.sw.personal)) sesion.cambiar(RUTAS.personal, personal);
  if (!igual(aprende, aprendeAntes)) sesion.cambiar(RUTAS.aprende, aprende);
}

function escribirAtaques(sesion, datos) {
  for (const a of datos.ataques) {
    if (!a) continue;
    const w = datos.sw.ataquesFB[a.id];
    const nuevo = { ...w, Type: TIPOS.indexOf(a.tipo), Power: a.potencia, Accuracy: a.precision, PP: a.pp };
    if (nuevo.Type !== w.Type || nuevo.Power !== w.Power || nuevo.Accuracy !== w.Accuracy || nuevo.PP !== w.PP) {
      sesion.cambiar(rutaAtaque(a.id), escribirFB(nuevo, ATAQUE));
    }
  }
}

function escribirEntrenadores(sesion, datos) {
  for (const t of datos.entrenadores) {
    const rutaT = rutaEntrenador(t.indice);
    const rutaP = rutaEquipo(t.indice);
    const td = sesion.archivo(rutaT);
    const tdAntes = td.slice();
    // Si pasa a ser doble, la IA tiene que saberlo (que no ataque a los suyos)
    if (t.combate === 1 && td[2] === 0) td[12] |= 0x08;
    td[2] = t.combate;
    td[3] = t.pokemon.length;
    const original = sesion.archivo(rutaP);
    const p = new Uint8Array(t.pokemon.length * TAM_ENTRENADOR);
    t.pokemon.forEach((poke, k) => {
      const o = k * TAM_ENTRENADOR;
      // Lo que no se toca (naturaleza, EVs, IVs...), como estaba; si es nuevo, como el último
      if (original.length >= o + TAM_ENTRENADOR) p.set(original.subarray(o, o + TAM_ENTRENADOR), o);
      else if (k) {
        p.set(p.subarray(o - TAM_ENTRENADOR, o), o);
        // (sin el Dinamax del que se copia: solo se dinamaxiza uno por equipo)
        p[o + 8] = 0;
        p[o + 9] = 0;
        p[o + 0x1f] &= 0x7f;
      }
      const especieAntes = u16(p, o + 0x0c);
      if (poke.especie !== especieAntes || o >= original.length) {
        p[o] &= 0xfc; // género al azar
        if (!GIGAMAX.has(poke.especie)) p[o + 9] = 0;
      }
      if (SIN_DINAMAX.has(poke.especie)) p[o + 0x1f] &= 0x7f;
      p[o] = (p[o] & 0xcf) | ((poke.habilidad & 3) << 4);
      poner16(p, o + 0x0a, poke.nivel);
      poner16(p, o + 0x0c, poke.especie);
      poner16(p, o + 0x0e, poke.forma || 0);
      poner16(p, o + 0x10, poke.objeto || 0);
      (poke.ataques || [0, 0, 0, 0]).forEach((m, j) => poner16(p, o + 0x12 + j * 2, m));
    });
    // El que se dinamaxiza (el as), detrás de los Pokémon añadidos, que se habían puesto después de él
    const as = t.pokemon.findIndex((_, k) => p[k * TAM_ENTRENADOR + 0x1f] & 0x80);
    if (as >= 0 && as < t.pokemon.length - 1 && (as + 1) * TAM_ENTRENADOR >= original.length) {
      const suyo = p.slice(as * TAM_ENTRENADOR, (as + 1) * TAM_ENTRENADOR);
      p.copyWithin(as * TAM_ENTRENADOR, (as + 1) * TAM_ENTRENADOR);
      p.set(suyo, p.length - TAM_ENTRENADOR);
    }
    if (!igual(td, tdAntes)) sesion.cambiar(rutaT, td);
    if (!igual(p, original)) sesion.cambiar(rutaP, p);
  }
}

function escribirSalvajes(sesion, datos) {
  const { pack, archivos } = datos.sw.salvajes;
  // Lo de cada hueco y cada tabla, de vuelta a los FlatBuffers (el nivel de la tabla, el del primer hueco)
  for (const area of datos.salvajes) {
    for (const z of area.estaciones[0]) {
      const vivo = z.huecos.find((h) => !h.vacio);
      if (vivo) {
        z.sub.LevelMin = vivo.min;
        z.sub.LevelMax = vivo.max;
      }
      for (const h of z.huecos) {
        if (h.vacio) continue;
        h.slot.Species = h.especie;
        h.slot.Form = h.forma || 0;
      }
    }
  }
  const nuevos = {};
  for (const [nombre, fb] of Object.entries(archivos)) {
    const i = pack.indice(nombre);
    const bytes = escribirFB(fb, SALVAJES);
    if (!igual(bytes, escribirFB(leerFB(pack.archivo(i), SALVAJES), SALVAJES))) nuevos[i] = bytes;
  }
  if (Object.keys(nuevos).length) sesion.cambiar(RUTAS.salvajes, escribirGfpak(pack, nuevos));
}

function escribirEstaticos(sesion, datos) {
  const { est } = datos.sw;
  const cambio = { fijos: false, regalos: false, trueques: false };
  for (const e of datos.estaticos) {
    if (e.nueva === undefined || e.nueva === e.actual || e.ignorar || e.huevo) continue;
    const f = e.fb;
    f.Species = e.nueva;
    f.Form = 0;
    f.Gender = 0;
    if (!GIGAMAX.has(e.nueva)) f.CanGigantamax = false;
    // Los ataques que traían ya no valen: que use los suyos
    if (e.tabla === "fijo") {
      f.Move0 = f.Move1 = f.Move2 = f.Move3 = 0;
      cambio.fijos = true;
    } else {
      f.SpecialMove = 0;
      cambio.regalos = true;
    }
  }
  // Las iniciales
  datos.iniciales.forEach((id, k) => {
    const r = est.regalos.Table[INICIALES[k]];
    if (id === r.Species) return;
    r.Species = id;
    r.Form = 0;
    r.Gender = 0;
    if (!GIGAMAX.has(id)) r.CanGigantamax = false;
    cambio.regalos = true;
  });
  for (const t of datos.intercambios) {
    const f = t.fb;
    if (t.da !== t.daOriginal) {
      f.Species = t.da;
      f.Form = 0;
      f.Gender = 0;
      f.Relearn1 = f.Relearn2 = f.Relearn3 = f.Relearn4 = 0;
      if (!GIGAMAX.has(t.da)) f.CanGigantamax = false;
    }
    if (t.pide !== t.pideOriginal) {
      f.RequiredSpecies = t.pide;
      f.RequiredForm = 0;
    }
    f.HeldItem = t.objeto;
    [f.IV_HP, f.IV_ATK, f.IV_DEF, f.IV_SPA, f.IV_SPD, f.IV_SPE] = t.ivs;
    if (t.da !== t.daOriginal || t.pide !== t.pideOriginal || t.objeto !== t.objetoOriginal || !igual(t.ivs, t.ivsOriginal)) cambio.trueques = true;
  }
  if (cambio.fijos) sesion.cambiar(RUTAS.estaticos, escribirFB(est.fijos, ESTATICOS));
  if (cambio.regalos) sesion.cambiar(RUTAS.regalos, escribirFB(est.regalos, REGALOS));
  if (cambio.trueques) {
    sesion.cambiar(RUTAS.intercambios, escribirFB(est.trueques, INTERCAMBIOS));
    escribirTextosIntercambios(sesion, datos);
  }
}

// Los diálogos de los intercambios: en cada idioma, el nombre de antes por el de ahora. Desde el intercambio 12,
// cada uno tiene sus 8 líneas seguidas (desde la 0); los de antes son los de formas regionales, que no se tocan
const lineasIntercambio = (indice) => (indice >= 12 ? Array.from({ length: 8 }, (_, k) => (indice - 12) * 8 + k) : []);

function escribirTextosIntercambios(sesion, datos) {
  const cambiados = datos.intercambios.filter((t) => t.da !== t.daOriginal || t.pide !== t.pideOriginal);
  for (const idioma of IDIOMAS) {
    const ruta = rutaHistoria(idioma, "field_trade");
    if (!sesion.tiene(ruta)) continue;
    const especies = leerTextos6(sesion.archivo(rutaTexto(idioma, "monsname"))).lineas;
    const original = sesion.archivo(ruta);
    const lineas = leerTextos6(original).lineas;
    for (const t of cambiados) {
      const cambios = [];
      if (t.da !== t.daOriginal) cambios.push([especies[t.daOriginal], especies[t.da]]);
      if (t.pide !== t.pideOriginal) cambios.push([especies[t.pideOriginal], especies[t.pide]]);
      const validos = cambios.filter(([viejo, nuevo]) => viejo && nuevo && viejo !== nuevo);
      for (const i of lineasIntercambio(t.indice)) {
        if (lineas[i] === undefined) continue;
        // El nombre de antes por una marca y la marca por el de ahora, para que no se pisen entre ellos
        let texto = lineas[i];
        validos.forEach(([viejo], k) => (texto = texto.split(viejo).join(`\u0001${k}\u0001`)));
        validos.forEach(([, nuevo], k) => (texto = texto.split(`\u0001${k}\u0001`).join(nuevo)));
        lineas[i] = texto;
      }
    }
    const nuevo = escribirTextos6(original, lineas);
    if (!igual(nuevo, original)) sesion.cambiar(ruta, nuevo);
  }
}

function escribirTiendas(sesion, datos) {
  const { fb } = datos.sw.tiendas;
  let cambio = false;
  for (const t of datos.tiendas) {
    const objetos = t.objetos.filter(Boolean);
    if (t.varias) {
      // Lo añadido (Caramelos Raros...), en todas las listas de la tienda
      const nuevos = objetos.filter((id) => !t.originales.includes(id));
      if (!nuevos.length) continue;
      for (const inv of t.fb.Inventories) inv.Items.push(...nuevos);
      cambio = true;
      continue;
    }
    if (igual(objetos, t.fb.Inventories.Items)) continue;
    t.fb.Inventories.Items = objetos;
    cambio = true;
  }
  if (cambio) sesion.cambiar(RUTAS.tiendas, escribirFB(fb, TIENDAS));
}

// ---------- MT, tutores y textos ----------

// Qué ataque es cada bit de compatibilidad: las MT en los 128 primeros (100 de verdad), los DT detrás
export function leerMovimientos() {
  const mt = new Array(256).fill(0);
  MT.forEach((id, k) => (mt[k] = id));
  DT.forEach((id, k) => (mt[128 + k] = id));
  return { mt, tutor: TUTORES.slice() };
}

// No se pueden cambiar (están en el programa)
export function escribirMovimientos() {}

// Lo que se baraja son los números de cada nombre (el del entrenador n está en la línea n; el de cada clase, en
// su número): así vale para todos los idiomas
export function leerNombresEntrenadores(sesion) {
  return {
    nombres: Array.from({ length: nombres(sesion, "Spanish", "trname").length }, (_, i) => i),
    clases: Array.from({ length: nombres(sesion, "Spanish", "trtype").length }, (_, i) => i)
  };
}

// Lo que dicen de las iniciales: Lionel al presentarlas (main_event_0070) y al elegir (main_event_0080). En cada línea,
// de qué inicial habla (0 Grookey, 1 Scorbunny, 2 Sobble) y, en español, el tipo que dice (para cambiarlo)
const TEXTOS_INICIALES = {
  main_event_0070: { 4: 0, 5: 1, 6: 2, 14: 1, 15: 2, 16: 0 },
  main_event_0080: { 3: 1, 4: 2, 5: 0, 12: 1, 13: 2, 14: 0 }
};
// Las de cómo es cada una (su carácter), que con otra especie no valen: se cambian por una frase con su tipo
const DESCRIPCIONES = { 3: 1, 4: 2, 5: 0 };
const TIPOS_ANTES = ["Planta", "Fuego", "Agua"];

function textosIniciales(sesion, iniciales) {
  for (const idioma of IDIOMAS) {
    const especies = leerTextos6(sesion.archivo(rutaTexto(idioma, "monsname"))).lineas;
    for (const [archivo, lineasDe] of Object.entries(TEXTOS_INICIALES)) {
      const ruta = rutaHistoria(idioma, archivo);
      if (!sesion.tiene(ruta)) continue;
      const original = sesion.archivo(ruta);
      const lineas = leerTextos6(original).lineas;
      for (const [i, cual] of Object.entries(lineasDe)) {
        const antes = iniciales.antes[cual];
        const ahora = iniciales.ahora[cual];
        // (con la misma especie, puede haber cambiado su tipo)
        if (lineas[i] === undefined || (antes === ahora && iniciales[cual].tipo === TIPOS_ANTES[cual])) continue;
        if (idioma === "Spanish" && archivo === "main_event_0080" && DESCRIPCIONES[i] !== undefined) {
          lineas[i] = `¡${especies[ahora]} es de tipo ${iniciales[cual].tipo}!`;
          continue;
        }
        let texto = lineas[i].split(especies[antes]).join(especies[ahora]);
        if (idioma === "Spanish") texto = texto.replace(`tipo ${TIPOS_ANTES[cual]}`, `tipo ${iniciales[cual].tipo}`).replace(`tipo\n${TIPOS_ANTES[cual]}`, `tipo\n${iniciales[cual].tipo}`);
        lineas[i] = texto;
      }
      const nuevo = escribirTextos6(original, lineas);
      if (!igual(nuevo, original)) sesion.cambiar(ruta, nuevo);
    }
  }
}

export function actualizarTextos(sesion, { entrenadores, iniciales }) {
  if (iniciales && iniciales.antes && iniciales.ahora) textosIniciales(sesion, iniciales);
  if (!entrenadores) return;
  for (const idioma of IDIOMAS) {
    for (const [archivo, orden] of [["trname", entrenadores.nombres], ["trtype", entrenadores.clases]]) {
      const ruta = rutaTexto(idioma, archivo);
      if (!sesion.tiene(ruta)) continue;
      const original = sesion.archivo(ruta);
      const lineas = leerTextos6(original).lineas;
      const nuevas = lineas.map((x, i) => (orden[i] !== undefined && lineas[orden[i]] !== undefined ? lineas[orden[i]] : x));
      sesion.cambiar(ruta, escribirTextos6(original, nuevas));
    }
  }
}

// Las iniciales que se ven en la mesa del principio (la especie de cada una, en su sitio del archivo de la zona)
export function ponerAspectoIniciales(sesion, iniciales) {
  const pack = leerGfpak(sesion.archivo(RUTAS.colocacion));
  const i = pack.indice(INICIALES_MESA.archivo);
  const a = pack.archivo(i);
  const zona = tablasFB(a, raizFB(a), 0)[0];
  const pokemon = tablasFB(a, zona, 2);
  let cambio = false;
  INICIALES_MESA.pokemon.forEach((k, cual) => {
    const especie = campoFB(a, pokemon[k], 2);
    if (!especie || !iniciales[cual] || u32(a, especie) === iniciales[cual]) return;
    poner32(a, especie, iniciales[cual]);
    const forma = campoFB(a, pokemon[k], 3);
    if (forma) poner32(a, forma, 0);
    cambio = true;
  });
  if (cambio) sesion.cambiar(RUTAS.colocacion, escribirGfpak(pack, { [i]: a }));
}

export function ponerCombatesDobles() {}
export function ponerTextoRapido() {}
export function ponerPokedexNacional() {}
