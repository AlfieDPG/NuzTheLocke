// ---------- Rojo Fuego y Verde Hoja ----------
//
// Todo va en la ROM (./rom-gba.js), en tablas fijas. Unas se encuentran por los punteros de la cabecera (0x144
// nombres, 0x1BC estadísticas, 0x1C8 objetos, 0x1CC ataques), otras por un trozo de código que las apunta (los
// salvajes y los mapas) y las demás por su dirección en cada versión (./versiones-gba.js). Como en el Universal
// Pokemon Randomizer (github.com/Ajarmar/universal-pokemon-randomizer-zx, Gen3RomHandler.java).
//
// La web numera como los juegos de después: especies por la Pokédex Nacional (el juego tiene las de Hoenn en otro
// orden), objetos por su número en la 4.ª y 5.ª generación y métodos de evolución como en la 5.ª. Aquí se pasa de
// unos a otros al leer y al escribir.
//
//   Especie (28 bytes): PS, Ata, Def, Vel, AtE, DfE, tipos (2), ratio de captura, ..., objetos (+12, +14), género
//     (+16), ..., habilidades (+22, +23)
//   Evoluciones: 5 por especie, de 8 bytes: método, dato (nivel u objeto), especie, relleno
//   Ataques que aprende: un puntero por especie a una lista de (nivel << 9 | ataque), acabada en 0xFFFF
//   Entrenador (40 bytes): tipo de datos (+0: 1 con ataques, 2 con objeto), clase, música, dibujo, nombre (+4, 12),
//     objetos, combate doble (+24), IA, cuántos Pokémon (+32) y puntero a ellos (+36): de 8 bytes (IV, nivel,
//     especie y objeto) o de 16 (con los cuatro ataques)
//   Salvajes: cabeceras de 20 bytes (banco, mapa y punteros a hierba, agua, Golpe Roca y pesca) hasta 0xFFFF; cada
//     una apunta a su ratio y a sus huecos (nivel mínimo, máximo y especie)

import { ESPECIES_GEN3, OBJETOS_GEN3, LETRAS_GEN3 } from "../partida/datos-gba.js";

export const ULTIMA_ESPECIE = 386;
export const ULTIMO_ATAQUE = 354;
export const ULTIMA_HABILIDAD = 76;

// Los tipos por su número en el juego (el 9 es «???», el de Maldición)
const TIPOS_JUEGO = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel", null,
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"
];
export const TIPOS = TIPOS_JUEGO.filter(Boolean);

// Métodos de evolución del juego (del 1 al 15) y los de la web (los de 5.ª): del 7 en adelante, uno más
const metodoWeb = (m) => (m <= 6 ? m : m + 1);
const metodoJuego = (m) => (m <= 6 ? m : m >= 8 && m <= 16 ? m - 1 : 0);
// Los del juego en los que el dato es un objeto: intercambio llevándolo y piedra
const CON_OBJETO = new Set([6, 7]);

// Entrenadores (por su número en la tabla). Rivales: los tres de cada combate (uno por inicial), Giovanni en el
// Escondite Rocket y en Silph. Líderes: los ocho de gimnasio, el Alto Mando (las dos veces) y el campeón
const RIVALES = [0x146, 0x147, 0x148, 0x149, 0x14a, 0x14b, 0x14c, 0x14d, 0x14e, 0x1aa, 0x1ab, 0x1ac, 0x1ad, 0x1ae, 0x1af, 0x1b0, 0x1b1, 0x1b2, 0x1b3, 0x1b4, 0x1b5, 0x15c, 0x15d];
const LIDERES = [0x19e, 0x19f, 0x1a0, 0x1a1, 0x1a2, 0x1a4, 0x1a3, 0x15e, 0x19a, 0x19b, 0x19c, 0x19d, 0x2df, 0x2e0, 0x2e1, 0x2e2, 0x1b6, 0x1b7, 0x1b8, 0x2e3, 0x2e4, 0x2e5];
// Los de un mismo tipo: cada gimnasio y cada uno del Alto Mando (sus dos combates)
const GRUPOS = [[0x19e], [0x19f], [0x1a0], [0x1a1], [0x1a2], [0x1a4], [0x1a3], [0x15e], [0x19a, 0x2df], [0x19b, 0x2e0], [0x19c, 0x2e1], [0x19d, 0x2e2]];
// El primer combate contra el rival: solo tienes la inicial (nunca doble)
const SIN_DOBLES = [0x146, 0x147, 0x148];

// Las tiendas (ver ./versiones-gba.js): las Tiendas Pokémon, las especiales (el puesto de Isla Secunda y el Centro
// Comercial de Azulona) y la de Ciudad Verde, la primera (ahí van los Caramelos Raros)
const TIENDAS_NORMALES = [0, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22];
const TIENDAS_ESPECIALES = [1, 2, 3, 4, 10, 11, 12, 13, 14];
const TIENDA_VERDE = 5;
// Huecos libres al final de cada tienda (para añadir sin quitar nada): la lista se lleva al espacio libre
const HUECOS_LIBRES = 2;

const ZONAS = [["hierba", 12], ["agua", 5], ["golpe-roca", 5], ["pesca", 10]];
const ZONA_SAFARI = 0x88; // el lugar de la Zona Safari (en la cabecera del mapa)
// Ahí no se puede huir de un Pokémon con Sombratrampa ni con Trampa Arena (como en el UPR)
const ATRAPAN = new Set([23, 71]);
const BOLA_OBJETO = 92; // el dibujo de las Poké Ball de objeto del suelo
const OBJETO_MT = 289; // MT01 en el juego (las 50 seguidas)
const MT = 50;
const MO = 8;
const TUTORES = 15;

// Trozos de código que apuntan a las tablas (y qué hay que cambiar en los parches), como en el UPR
const BUSCAR_SALVAJES = "0348048009E00000FFFF0000";
const BUSCAR_MAPAS = "80180068890B091808687047";
const OBEDIENCIA = "CD21490088420FD0"; // Mew y Deoxys solo obedecen si son de un evento
const EVO_NIVEL_KANTO = "972814DD"; // antes de la Pokédex Nacional, solo evolucionan los de Kanto
const EVO_PIEDRA_KANTO = "972808D9";
const POKEDEX = {
  guion: "292908258101", nuevo: "292908258101256F0103",
  bandera: "260D809301210D800100", alto: "2B2C0800000000000000",
  laboratorio: "257D011604800000260D80D400", laboratorioBien: "257D011604800100",
  casa: "1604800000260D80D4001908800580190980068083000880830109802109803C", casaBien: "1604800100",
  ayudantes: "00B5064800880028"
};

// ---------- Bytes ----------

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
const puntero = (b, i) => u32(b, i) - 0x08000000;
const ponerPuntero = (b, i, sitio) => poner32(b, i, sitio + 0x08000000);
const valePuntero = (b, i) => {
  const p = u32(b, i);
  return p >= 0x08000000 && p - 0x08000000 < b.length;
};
const deHex = (texto) => Uint8Array.from(texto.match(/../g).map((x) => parseInt(x, 16)));

function buscar(b, aguja, desde = 0) {
  const lista = typeof aguja === "string" ? deHex(aguja) : aguja;
  const salida = [];
  for (let i = desde; i <= b.length - lista.length; i++) {
    if (b[i] !== lista[0]) continue;
    let k = 1;
    while (k < lista.length && b[i + k] === lista[k]) k++;
    if (k === lista.length) salida.push(i);
  }
  return salida;
}

// ---------- Especies y objetos ----------

const INTERNA = new Map(); // nacional -> número en el juego
ESPECIES_GEN3.forEach((nacional, k) => INTERNA.set(nacional, 277 + k));
const internaDe = (nacional) => (nacional <= 251 ? nacional : INTERNA.get(nacional) || 0);
const nacionalDe = (interna) => (interna <= 251 ? interna : ESPECIES_GEN3[interna - 277] || 0);

const AL_JUEGO = new Map(); // objeto de la web -> el del juego
OBJETOS_GEN3.forEach((web, juego) => web && !AL_JUEGO.has(web) && AL_JUEGO.set(web, juego));
const objetoWeb = (juego) => OBJETOS_GEN3[juego] || 0;
const objetoJuego = (web) => AL_JUEGO.get(web) || 0;

// ---------- Textos ----------

const CODIGO = new Map(LETRAS_GEN3.map((letra, i) => [letra, i]).filter(([letra]) => letra).reverse());
const SALTO = 0xfe; // nueva línea
const PARRAFO = 0xfb; // la flecha y el texto siguiente en limpio
const aCodigos = (texto) => [...texto].map((c) => CODIGO.get(c) ?? CODIGO.get(" "));

function leerTexto(b, i, maximo) {
  let salida = "";
  for (let k = 0; k < maximo && b[i + k] !== 0xff; k++) salida += LETRAS_GEN3[b[i + k]] || "";
  return salida;
}

// ---------- El juego ----------

function tablas(rom) {
  if (!rom.tablas) {
    const b = rom.bytes;
    rom.tablas = {
      nombres: puntero(b, 0x144),
      stats: puntero(b, 0x1bc),
      objetos: puntero(b, 0x1c8),
      ataques: puntero(b, 0x1cc),
      salvajes: puntero(b, buscar(b, BUSCAR_SALVAJES)[0] + 12),
      mapas: puntero(b, buscar(b, BUSCAR_MAPAS)[0] + 12)
    };
  }
  return rom.tablas;
}

export function perfilDe(rom) {
  return {
    id: "frlg", gen: 3, nombre: rom.titulo,
    ultimaEspecie: ULTIMA_ESPECIE, ultimoAtaque: ULTIMO_ATAQUE, ultimaHabilidad: ULTIMA_HABILIDAD,
    ultimoObjeto: 467, objetosGen: 5,
    tipos: TIPOS,
    habilidadesNunca: [],
    legendarios: [],
    maxEvoluciones: 5,
    // Las evoluciones que no existen en la 3.ª generación: llevando un objeto de día o de noche (para las de
    // intercambio con objeto, ver randomizar.js) y por nivel solo los machos o solo las hembras
    evoSinObjetoHora: true, evoSinNivelGenero: true,
    sinMT: false, bitsMT: { tm: MT, hm: MO, extra: 0 }, bloquesMT: 8,
    mtItems: Array.from({ length: MT }, (_, k) => objetoWeb(OBJETO_MT + k)),
    tutores: true, tutorInfo: { cuantos: TUTORES, bytes: 2, fijos: [] },
    claros: false, iniciales: true, primerosCombates: [],
    lideres: LIDERES, rivales: RIVALES, grupos: GRUPOS, importantes: new Set([...LIDERES, ...RIVALES]),
    sinDobles: SIN_DOBLES,
    // Unown solo sale bien en las Ruinas Sete (como en el UPR)
    sinSalvajes: [201],
    preciosEnDecenas: false,
    tiendas: { normales: TIENDAS_NORMALES, mt: [11], historia: TIENDAS_ESPECIALES, primera: TIENDA_VERDE, saltar: [], cuantas: 23 },
    objetosInexistentes: (id) => !AL_JUEGO.has(id)
  };
}

export function nombresPokemon() {
  return []; // los diálogos de los intercambios ponen el nombre solos
}

// ---------- Leer ----------

function leerEspecies(rom) {
  const b = rom.bytes;
  const t = tablas(rom);
  const v = rom.version;
  const especies = [];
  for (let interna = 1; interna <= 411; interna++) {
    const id = nacionalDe(interna);
    if (!id) continue;
    const o = t.stats + interna * 28;
    const stats = [b[o], b[o + 1], b[o + 2], b[o + 4], b[o + 5], b[o + 3]];
    const total = stats.reduce((x, y) => x + y, 0);
    const evos = [];
    for (let k = 0; k < 5; k++) {
      const e = v.evoluciones + interna * 40 + k * 8;
      const metodo = u16(b, e);
      const especie = nacionalDe(u16(b, e + 4));
      if (!metodo || !especie) continue;
      const dato = CON_OBJETO.has(metodo) ? objetoWeb(u16(b, e + 2)) : u16(b, e + 2);
      evos.push({ metodo: metodoWeb(metodo), dato, especie, forma: 0 });
    }
    const tutor = v.tutores + TUTORES * 2 + interna * 2;
    especies[id] = {
      id, interna, stats, total, totalOriginal: total,
      tipos: [...new Set([TIPOS_JUEGO[b[o + 6]], TIPOS_JUEGO[b[o + 7]]])].filter(Boolean),
      habilidades: [b[o + 22], b[o + 23] !== b[o + 22] ? b[o + 23] : 0, 0],
      objetos: [objetoWeb(u16(b, o + 12)), objetoWeb(u16(b, o + 14)), 0],
      genero: b[o + 16],
      mt: b.slice(v.mt + interna * 8, v.mt + interna * 8 + 8),
      tutor: b.slice(tutor, tutor + 2),
      evoluciones: evos, previa: 0
    };
  }
  for (const e of especies) if (e) for (const evo of e.evoluciones) if (especies[evo.especie]) especies[evo.especie].previa = e.id;
  return especies;
}

function leerAprende(rom, especies) {
  const b = rom.bytes;
  const aprende = [];
  const sitios = [];
  for (const e of especies) {
    if (!e) continue;
    const sitio = puntero(b, rom.version.aprende + e.interna * 4);
    const lista = [];
    for (let i = sitio; u16(b, i) !== 0xffff; i += 2) lista.push([u16(b, i) & 0x1ff, u16(b, i) >> 9]);
    aprende[e.id] = lista;
    sitios[e.id] = { sitio, cuantos: lista.length };
  }
  return { aprende, sitios };
}

function leerAtaques(rom) {
  const b = rom.bytes;
  const t = tablas(rom);
  const ataques = [];
  for (let id = 1; id <= ULTIMO_ATAQUE; id++) {
    const o = t.ataques + id * 12;
    const tipo = TIPOS_JUEGO[b[o + 2]];
    // En la 3.ª generación, físico o especial va por el tipo
    const fisico = ["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"].includes(tipo);
    ataques[id] = { id, tipo, categoria: b[o + 1] ? (fisico ? 1 : 2) : 0, potencia: b[o + 1], precision: b[o + 3], pp: b[o + 4] };
  }
  return ataques;
}

function leerEntrenadores(rom, perfil) {
  const b = rom.bytes;
  const v = rom.version;
  const entrenadores = [];
  for (let i = 1; i < v.cuantosEntrenadores; i++) {
    const o = v.entrenadores + i * 40;
    const tipo = b[o];
    const cuantos = b[o + 32];
    if (!cuantos || !valePuntero(b, o + 36)) continue;
    const p = puntero(b, o + 36);
    const largo = tipo & 1 ? 16 : 8;
    const pokemon = [];
    for (let k = 0; k < cuantos; k++) {
      const x = p + k * largo;
      const desde = tipo & 2 ? 8 : 6;
      pokemon.push({
        iv: u16(b, x), nivel: u16(b, x + 2), especie: nacionalDe(u16(b, x + 4)), forma: 0, habilidad: 0,
        objeto: tipo & 2 ? objetoWeb(u16(b, x + 6)) : 0,
        ataques: tipo & 1 ? [0, 2, 4, 6].map((m) => u16(b, x + desde + m)) : [0, 0, 0, 0]
      });
    }
    entrenadores.push({
      indice: i, clase: b[o + 1], combate: b[o + 24], conAtaques: Boolean(tipo & 1), conObjetos: Boolean(tipo & 2),
      importante: perfil.importantes.has(i), pokemon, tamOriginal: cuantos * largo
    });
  }
  return entrenadores;
}

// Las cabeceras de los mapas de cada banco (como en el UPR: un banco acaba donde empieza el siguiente)
function cabecerasDeMapas(rom) {
  const b = rom.bytes;
  const inicio = tablas(rom).mapas;
  const bancos = [];
  for (let o = inicio; valePuntero(b, o) && !bancos.some((x) => inicio < x && o >= x); o += 4) bancos.push(puntero(b, o));
  return bancos.map((banco) => {
    const mapas = [];
    for (let o = banco; valePuntero(b, o); o += 4) {
      if (bancos.some((x) => banco < x && o >= x) || (banco < inicio && o >= inicio)) break;
      mapas.push(puntero(b, o));
    }
    return mapas;
  });
}

function leerSalvajes(rom, mapas) {
  const b = rom.bytes;
  const salvajes = [];
  const vistos = new Set();
  for (let o = tablas(rom).salvajes; !(b[o] === 0xff && b[o + 1] === 0xff); o += 20) {
    const [banco, mapa] = [b[o], b[o + 1]];
    const cabecera = (mapas[banco] || [])[mapa];
    const zonas = [];
    ZONAS.forEach(([zona, huecos], k) => {
      if (!u32(b, o + 4 + k * 4) || !valePuntero(b, o + 4 + k * 4)) return;
      const area = puntero(b, o + 4 + k * 4);
      if (!b[area] || !valePuntero(b, area + 4)) return;
      const datos = puntero(b, area + 4);
      if (vistos.has(datos)) return;
      vistos.add(datos);
      zonas.push({
        zona,
        huecos: Array.from({ length: huecos }, (_, h) => {
          const x = datos + h * 4;
          return { especie: nacionalDe(u16(b, x + 2)), forma: 0, min: b[x], max: b[x + 1], vacio: false, sitio: x };
        })
      });
    });
    if (!zonas.length) continue;
    const area = { archivo: `${banco}.${mapa}`, estaciones: [zonas] };
    if (cabecera !== undefined && b[cabecera + 0x14] === ZONA_SAFARI) area.prohibir = (e) => e.habilidades.some((h) => ATRAPAN.has(h));
    salvajes.push(area);
  }
  return salvajes;
}

// Las Poké Ball del suelo (su guion da el objeto: «setvar 0x8000 objeto; setvar 0x8001 cuántos; callstd») y los
// objetos ocultos (carteles de tipo 5 a 7, con el objeto en +8)
function leerObjetosSuelo(rom, mapas) {
  const b = rom.bytes;
  const sitios = new Set();
  for (const banco of mapas) {
    for (const cabecera of banco) {
      if (!valePuntero(b, cabecera + 4)) continue;
      const eventos = puntero(b, cabecera + 4);
      const personas = b[eventos];
      const carteles = b[eventos + 3];
      if (personas && valePuntero(b, eventos + 4)) {
        const p = puntero(b, eventos + 4);
        for (let k = 0; k < personas; k++) {
          const x = p + k * 24;
          if (b[x + 1] !== BOLA_OBJETO || !valePuntero(b, x + 16)) continue;
          const s = puntero(b, x + 16);
          if (b[s] === 0x1a && b[s + 1] === 0 && b[s + 2] === 0x80 && b[s + 5] === 0x1a && b[s + 6] === 1 && b[s + 7] === 0x80 &&
            b[s + 10] === 9 && (b[s + 11] === 0 || b[s + 11] === 1)) sitios.add(s + 3);
        }
      }
      if (carteles && valePuntero(b, eventos + 16)) {
        const p = puntero(b, eventos + 16);
        for (let k = 0; k < carteles; k++) {
          const x = p + k * 12;
          if (b[x + 5] >= 5 && b[x + 5] <= 7 && u16(b, x + 8)) sitios.add(x + 8);
        }
      }
    }
  }
  // Los que existen en la web (si no, se quedan como están)
  return [...sitios].map((sitio) => ({ objeto: objetoWeb(u16(b, sitio)), sitio })).filter((o) => o.objeto);
}

// Cada tienda, con dónde está su puntero (para llevarla al espacio libre si crece)
function leerTiendas(rom) {
  const b = rom.bytes;
  return rom.version.tiendas.map((sitio, indice) => {
    const originales = [];
    for (let i = sitio; u16(b, i); i += 2) originales.push(u16(b, i));
    const aguja = new Uint8Array(4);
    ponerPuntero(aguja, 0, sitio);
    // (el guion que la abre va justo antes: se busca cerca)
    const zona = b.subarray(Math.max(0, sitio - 0x4000), sitio + 0x4000);
    const punteros = buscar(zona, aguja).map((x) => x + Math.max(0, sitio - 0x4000));
    const libres = punteros.length === 1 ? HUECOS_LIBRES : 0;
    return {
      indice, sitio, puntero: punteros.length === 1 ? punteros[0] : -1, cuantos: originales.length,
      objetos: [...originales.map(objetoWeb), ...new Array(libres).fill(0)]
    };
  });
}

function leerIntercambios(rom) {
  const b = rom.bytes;
  const v = rom.version;
  return Array.from({ length: v.cuantosIntercambios }, (_, k) => {
    const o = v.intercambios + k * 60;
    return { da: nacionalDe(u16(b, o + 12)), pide: nacionalDe(u16(b, o + 56)), objeto: objetoWeb(u16(b, o + 40)), ivs: [...b.subarray(o + 14, o + 20)], sitio: o };
  });
}

function leerPrecios(rom) {
  const b = rom.bytes;
  const t = tablas(rom);
  const precios = [];
  for (let id = 1; id < OBJETOS_GEN3.length; id++) {
    const web = objetoWeb(id);
    if (web) precios[web] = u16(b, t.objetos + id * 44 + 16);
  }
  return precios;
}

export function leerBW2(rom) {
  const b = rom.bytes;
  const v = rom.version;
  const perfil = perfilDe(rom);
  const especies = leerEspecies(rom);
  const { aprende, sitios } = leerAprende(rom, especies);
  const mapas = cabecerasDeMapas(rom);
  const iniciales = [v.iniciales, v.iniciales + 515, v.iniciales + 461].map((o) => nacionalDe(u16(b, o)));
  const estaticos = v.estaticos.map(([lugares, niveles]) => ({ actual: nacionalDe(u16(b, lugares[0])), nivelActual: niveles.length ? b[niveles[0]] : 0, lugares }));
  return {
    perfil, especies, aprende, ataques: leerAtaques(rom), salvajes: leerSalvajes(rom, mapas), entrenadores: leerEntrenadores(rom, perfil),
    iniciales, inicialesOriginales: iniciales.slice(), estaticos, intercambios: leerIntercambios(rom), totems: [],
    precios: leerPrecios(rom), tiendas: leerTiendas(rom), objetosSuelo: leerObjetosSuelo(rom, mapas), claros: null,
    bd: { sitiosAprende: sitios, pokedex: false }
  };
}

// ---------- Escribir ----------

function escribirEspecies(rom, datos) {
  const b = rom.bytes;
  const t = tablas(rom);
  const v = rom.version;
  for (const e of datos.especies) {
    if (!e) continue;
    const o = t.stats + e.interna * 28;
    [b[o], b[o + 1], b[o + 2], b[o + 4], b[o + 5], b[o + 3]] = e.stats;
    b[o + 6] = TIPOS_JUEGO.indexOf(e.tipos[0]);
    b[o + 7] = TIPOS_JUEGO.indexOf(e.tipos[1] || e.tipos[0]);
    b[o + 22] = e.habilidades[0];
    b[o + 23] = e.habilidades[1] || e.habilidades[0]; // sin segunda, la misma (si no, falla al evolucionar)
    poner16(b, o + 12, objetoJuego(e.objetos[0]));
    poner16(b, o + 14, objetoJuego(e.objetos[1]));
    // Las MT y MO (58 de los 64 bits) y los tutores (15 de 16)
    const mt = v.mt + e.interna * 8;
    for (let k = 0; k < 8; k++) b[mt + k] = (e.mt[k] || 0) & (k === 7 ? 0x03 : 0xff);
    const tutor = v.tutores + TUTORES * 2 + e.interna * 2;
    b[tutor] = e.tutor[0] || 0;
    b[tutor + 1] = (e.tutor[1] || 0) & 0x7f;
    // Evoluciones: las que el juego no tiene se quedan fuera
    const evos = e.evoluciones
      .map((evo) => ({ ...evo, metodo: metodoJuego(evo.metodo) }))
      .filter((evo) => evo.metodo && internaDe(evo.especie))
      .slice(0, 5);
    for (let k = 0; k < 5; k++) {
      const x = v.evoluciones + e.interna * 40 + k * 8;
      const evo = evos[k];
      poner16(b, x, evo ? evo.metodo : 0);
      poner16(b, x + 2, evo ? (CON_OBJETO.has(evo.metodo) ? objetoJuego(evo.dato) : evo.dato) : 0);
      poner16(b, x + 4, evo ? internaDe(evo.especie) : 0);
      poner16(b, x + 6, 0);
    }
  }
  rom.cambiados.add("especies");
}

function escribirAprende(rom, datos) {
  const b = rom.bytes;
  for (const e of datos.especies) {
    if (!e) continue;
    const lista = datos.aprende[e.id] || [];
    const antes = datos.bd.sitiosAprende[e.id];
    let sitio = antes.sitio;
    // Más que antes: a otro sitio (la lista vieja se queda donde estaba, sin usar)
    if (lista.length > antes.cuantos) {
      sitio = rom.reservar(lista.length * 2 + 2);
      ponerPuntero(b, rom.version.aprende + e.interna * 4, sitio);
    }
    lista.forEach(([ataque, nivel], k) => poner16(b, sitio + k * 2, (Math.min(100, nivel) << 9) | ataque));
    poner16(b, sitio + lista.length * 2, 0xffff);
  }
  rom.cambiados.add("ataques que aprenden");
}

function escribirAtaques(rom, datos) {
  const b = rom.bytes;
  const t = tablas(rom);
  for (const a of datos.ataques) {
    if (!a) continue;
    const o = t.ataques + a.id * 12;
    b[o + 1] = a.potencia;
    b[o + 2] = TIPOS_JUEGO.indexOf(a.tipo);
    b[o + 3] = a.precision;
    b[o + 4] = a.pp;
  }
}

function escribirEntrenadores(rom, datos) {
  const b = rom.bytes;
  const v = rom.version;
  for (const t of datos.entrenadores) {
    const o = v.entrenadores + t.indice * 40;
    const tipo = (t.conAtaques ? 1 : 0) | (t.conObjetos ? 2 : 0);
    const largo = tipo & 1 ? 16 : 8;
    const tam = t.pokemon.length * largo;
    let p = puntero(b, o + 36);
    if (tam > t.tamOriginal) {
      p = rom.reservar(tam);
      ponerPuntero(b, o + 36, p);
    }
    b[o] = tipo;
    b[o + 24] = t.combate ? 1 : 0;
    b[o + 32] = t.pokemon.length;
    t.pokemon.forEach((poke, k) => {
      const x = p + k * largo;
      b.fill(0, x, x + largo);
      poner16(b, x, poke.iv || 0);
      poner16(b, x + 2, poke.nivel);
      poner16(b, x + 4, internaDe(poke.especie));
      if (tipo & 2) poner16(b, x + 6, objetoJuego(poke.objeto));
      if (tipo & 1) (poke.ataques || [0, 0, 0, 0]).forEach((m, n) => poner16(b, x + (tipo & 2 ? 8 : 6) + n * 2, m));
    });
  }
  rom.cambiados.add("entrenadores");
}

function escribirSalvajes(rom, datos) {
  const b = rom.bytes;
  for (const area of datos.salvajes) {
    for (const z of area.estaciones[0]) {
      for (const h of z.huecos) {
        b[h.sitio] = h.min;
        b[h.sitio + 1] = Math.max(h.min, h.max);
        poner16(b, h.sitio + 2, internaDe(h.especie));
      }
    }
  }
  rom.cambiados.add("salvajes");
}

function escribirTiendas(rom, datos) {
  const b = rom.bytes;
  for (const t of datos.tiendas) {
    const objetos = t.objetos.map(objetoJuego).filter(Boolean);
    let sitio = t.sitio;
    if (objetos.length > t.cuantos) {
      if (t.puntero < 0) objetos.length = t.cuantos;
      else {
        sitio = rom.reservar(objetos.length * 2 + 2);
        ponerPuntero(b, t.puntero, sitio);
      }
    }
    objetos.forEach((id, k) => poner16(b, sitio + k * 2, id));
    poner16(b, sitio + objetos.length * 2, 0);
  }
}

// Las iniciales, en el guion del laboratorio: la de cada Poké Ball y la que se lleva el rival (la que tiene ventaja)
function escribirIniciales(rom, [planta, fuego, agua]) {
  const b = rom.bytes;
  const s = rom.version.iniciales;
  const [p, f, a] = [planta, fuego, agua].map(internaDe);
  poner16(b, s, p);
  poner16(b, s + 5, f);
  poner16(b, s + 515, f);
  poner16(b, s + 520, a);
  poner16(b, s + 461, a);
  poner16(b, s + 466, p);
}

// Mew y Deoxys obedecen siempre, y los de fuera de Kanto evolucionan sin la Pokédex Nacional
function parchesDeEspecies(rom) {
  const b = rom.bytes;
  const obediencia = buscar(b, OBEDIENCIA)[0];
  if (obediencia !== undefined) {
    // «movs r1, #0» dos veces en lugar de la comparación con Deoxys, y la de Mew (22 bytes después) con 0
    b.set([0x00, 0x21, 0x00, 0x21], obediencia);
    if (u16(b, obediencia + 0x16) === ((0x28 << 8) | 151)) poner16(b, obediencia + 0x16, 0x28 << 8);
  }
  for (const [codigo, salto] of [[EVO_NIVEL_KANTO, 0x14], [EVO_PIEDRA_KANTO, 0x08]]) {
    const sitio = buscar(b, codigo)[0];
    if (sitio === undefined) continue;
    poner16(b, sitio, 0x46c0); // nop
    poner16(b, sitio + 2, (0xe0 << 8) | salto); // salto incondicional
  }
}

// La Pokédex Nacional desde el principio (el parche del UPR)
function parchePokedex(rom) {
  const b = rom.bytes;
  const guion = buscar(b, POKEDEX.guion)[0];
  if (guion === undefined) return;
  const nuevo = deHex(POKEDEX.nuevo);
  const sitio = rom.reservar(nuevo.length);
  b[guion] = 4; // call
  ponerPuntero(b, guion + 1, sitio);
  b[guion + 5] = 0; // nop
  b.set(nuevo, sitio);
  for (const x of buscar(b, POKEDEX.bandera)) b.set(deHex(POKEDEX.alto), x);
  const laboratorio = buscar(b, POKEDEX.laboratorio)[0];
  if (laboratorio !== undefined) b.set(deHex(POKEDEX.laboratorioBien), laboratorio);
  const casa = buscar(b, POKEDEX.casa)[0];
  if (casa !== undefined) b.set(deHex(POKEDEX.casaBien), casa);
  const ayudantes = buscar(b, POKEDEX.ayudantes)[0];
  if (ayudantes !== undefined) b[ayudantes + POKEDEX.ayudantes.length / 2 + 1] = 0xe0;
}

export function escribirBW2(rom, datos) {
  const b = rom.bytes;
  const t = tablas(rom);
  escribirEspecies(rom, datos);
  escribirAprende(rom, datos);
  escribirAtaques(rom, datos);
  escribirEntrenadores(rom, datos);
  escribirSalvajes(rom, datos);
  for (const e of datos.estaticos) {
    if (e.nueva === undefined || e.nueva === e.actual) continue;
    for (const lugar of e.lugares) poner16(b, lugar, internaDe(e.nueva));
    rom.cambiados.add("estáticos");
  }
  if (datos.iniciales.some((id, k) => id !== datos.inicialesOriginales[k])) escribirIniciales(rom, datos.iniciales);
  for (const x of datos.intercambios) {
    poner16(b, x.sitio + 12, internaDe(x.da));
    poner16(b, x.sitio + 56, internaDe(x.pide));
    poner16(b, x.sitio + 40, objetoJuego(x.objeto));
    b.set(x.ivs.map((iv) => Math.min(31, iv)), x.sitio + 14);
  }
  for (let id = 1; id < OBJETOS_GEN3.length; id++) {
    const precio = datos.precios[objetoWeb(id)];
    if (objetoWeb(id) && precio !== undefined) poner16(b, t.objetos + id * 44 + 16, Math.max(0, Math.min(0xffff, Math.round(precio))));
  }
  escribirTiendas(rom, datos);
  for (const o of datos.objetosSuelo) {
    const id = objetoJuego(o.objeto);
    if (id) poner16(b, o.sitio, id);
  }
  parchesDeEspecies(rom);
  if (datos.bd.pokedex) parchePokedex(rom);
}

// ---------- MT, tutores y textos ----------

export function leerMovimientos(rom) {
  const b = rom.bytes;
  const v = rom.version;
  return {
    mt: Array.from({ length: MT }, (_, k) => u16(b, v.ataquesMT + k * 2)),
    tutor: Array.from({ length: TUTORES }, (_, k) => u16(b, v.tutores + k * 2))
  };
}

export function escribirMovimientos(rom, m, ataques) {
  const b = rom.bytes;
  const v = rom.version;
  const t = tablas(rom);
  m.mt.forEach((ataque, k) => {
    poner16(b, v.ataquesMT + k * 2, ataque);
    if (v.ataquesMT2) poner16(b, v.ataquesMT2 + k * 2, ataque);
    const objeto = t.objetos + (OBJETO_MT + k) * 44;
    // La descripción de la MT en la Mochila: la del ataque nuevo; y el color del disco, el de su tipo
    if (v.descripciones) poner32(b, objeto + 20, u32(b, v.descripciones + (ataque - 1) * 4));
    const tipo = TIPOS_JUEGO.indexOf(ataques[ataque] ? ataques[ataque].tipo : null);
    if (v.dibujos && v.paletasMT[tipo]) ponerPuntero(b, v.dibujos + (OBJETO_MT + k) * 8 + 4, v.paletasMT[tipo]);
  });
  m.tutor.forEach((ataque, k) => poner16(b, v.tutores + k * 2, ataque));
  rom.cambiados.add("MT");
}

// Los nombres de los entrenadores: se barajan tal cual (los bytes de cada uno)
export function leerNombresEntrenadores(rom) {
  const b = rom.bytes;
  const v = rom.version;
  const nombres = [];
  for (let i = 1; i < v.cuantosEntrenadores; i++) nombres[i] = [...b.subarray(v.entrenadores + i * 40 + 4, v.entrenadores + i * 40 + 16)];
  return { nombres, clases: {} };
}

// Lo que dice Oak al elegir inicial (solo en español): «¡Así que BULBASAUR! … ¿quieres el POKéMON tipo PLANTA
// BULBASAUR?», con la nueva y su tipo (sin la frase de en medio, que es de cada una)
function textoIniciales(rom, { antes, ahora }, tipos) {
  const b = rom.bytes;
  const t = tablas(rom);
  const nombre = (id) => leerTexto(b, t.nombres + internaDe(id) * 11, 11);
  antes.forEach((viejo, k) => {
    if (viejo === ahora[k]) return;
    const sitio = buscar(b, aCodigos(`¡Así que ${nombre(viejo)}!`))[0];
    if (sitio === undefined) return;
    let largo = 0;
    while (b[sitio + largo] !== 0xff) largo++;
    const nueva = nombre(ahora[k]);
    const bytes = [
      ...aCodigos(`¡Así que ${nueva}!`), PARRAFO,
      ...aCodigos("Bueno, "), 0xfd, 0x01, ...aCodigos(", entonces ¿quieres"), SALTO,
      ...aCodigos(`el POKéMON tipo ${tipos[k].toUpperCase()} ${nueva}?`)
    ];
    if (bytes.length > largo) return;
    b.set([...bytes, 0xff], sitio);
  });
}

export function actualizarTextos(rom, { iniciales, entrenadores }) {
  const b = rom.bytes;
  const v = rom.version;
  if (entrenadores) {
    entrenadores.nombres.forEach((nombre, i) => nombre && b.set(nombre, v.entrenadores + i * 40 + 4));
  }
  if (iniciales && iniciales.antes) textoIniciales(rom, iniciales, iniciales.map((x) => x.tipo));
}

export function ponerTextoRapido(rom) {
  const sitio = rom.version.velocidadTexto;
  if (sitio) rom.bytes.set([4, 1, 0], sitio); // lento = medio, medio = rápido, rápido = al instante
}

// Se pone al escribir (necesita espacio libre)
export function ponerPokedexNacional(datos) {
  datos.bd.pokedex = true;
}

export function ponerAspectoIniciales() {} // el dibujo y el grito salen solos de la especie
export function ponerCombatesDobles() {} // va con cada entrenador
