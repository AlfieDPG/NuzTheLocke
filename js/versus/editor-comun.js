// Lo que comparten el editor de Pokémon (./editor.js), «Meter equipo» (./meter-equipo.js) y
// mover Pokémon en la ventana «Partida» (./partida.js): los datos de cada juego (especies,
// formas, objetos, balls...) y los cambios en la partida, que se guardan todos juntos.

import { quitarAcentos, normalizarNombre } from "../comun/utilidades.js";
import { imagenConRespaldo, urlsIconoObjeto } from "../comun/imagenes.js";
import { tiposEs } from "../comun/tipos.js";
import { cargarDatos, datos, buscarPorNombreIngles } from "../comun/datos.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { formasDeTipoDe, etiquetaEnIngles } from "../comun/formas.js";
import { generoDe, generosPosibles } from "../comun/pokemon.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { NATURALEZAS, entrenoDe } from "../equipos/entreno.js";
import { apuntarSuceso } from "../comun/lockes.js";
import { sumarContador } from "../comun/contadores.js";
import { leerArchivo, escribirPartida } from "../partida/vinculo.js";
import { abrirHuecos, escribirHuecos, mirar, llaveDe } from "../partida/huecos.js";
import { formatoDeSeguro } from "../partida/formato.js";
import { marcarMetidos, marcarCreados, esCreado } from "../partida/partidas.js";
import { FORMAS, convertirPartida, lugarEnIngles } from "../partida/convertir.js";
import { t, enIngles, nombre as nombreDe } from "../comun/idioma.js";
import { OBJETOS_EN, LUGARES_GEN6, LUGARES_GEN7 } from "../partida/datos-3ds.js";
import { LUGARES_GEN4, LUGARES_GEN4_OTROS, LUGARES_GEN5, LUGARES_GEN5_OTROS } from "../partida/datos-ds.js";
import { LUGARES_GEN8, LUGARES_BDSP, LUGARES_BDSP_OTROS } from "../partida/datos-switch.js";
import { bolsilloSwSh } from "../partida/mochilaswitch.js";
import { bolsilloBDSP } from "../partida/bdsp.js";
import { cargarDatosEditor, GRUPOS } from "../partida/datos-editor.js";

// Cada juego que se edita: su generación y lo último que existe en él (números de especie,
// objeto, ataque, habilidad y ball). lugares: hasta qué número de lugar es suyo (gen 4 y 5).
export const LIMITES = {
  dp: { gen: 4, especies: 493, objetos: 464, ataques: 467, habilidades: 123, balls: 16, lugares: 111 },
  platino: { gen: 4, especies: 493, objetos: 467, ataques: 467, habilidades: 123, balls: 16, lugares: 125 },
  hgss: { gen: 4, especies: 493, objetos: 536, ataques: 467, habilidades: 123, balls: 24, lugares: Infinity },
  bw: { gen: 5, especies: 649, objetos: 632, ataques: 559, habilidades: 164, balls: 25, lugares: 116 },
  b2w2: { gen: 5, especies: 649, objetos: 638, ataques: 559, habilidades: 164, balls: 25, lugares: Infinity },
  xy: { gen: 6, especies: 721, objetos: 717, ataques: 617, habilidades: 188, balls: 25 },
  oras: { gen: 6, especies: 721, objetos: 775, ataques: 621, habilidades: 191, balls: 25 },
  sm: { gen: 7, especies: 802, objetos: 920, ataques: 719, habilidades: 232, balls: 26 },
  usum: { gen: 7, especies: 807, objetos: 959, ataques: 728, habilidades: 233, balls: 26 },
  // Con los dos DLC. No están todas las especies hasta la 898: las que hay, en datos/partida-3ds.json
  // (disponibles). Los objetos, solo los que tienen bolsillo (partida/mochilaswitch.js)
  swsh: { gen: 8, especies: 898, objetos: 1607, ataques: 826, habilidades: 267, balls: 26 },
  // Las 493 de Sinnoh, con los ataques y habilidades de gen 8. Los objetos, como en Espada / Escudo:
  // solo los que tienen bolsillo (partida/bdsp.js)
  bdsp: { gen: 8, especies: 493, objetos: 1822, ataques: 826, habilidades: 267, balls: 26 }
};

// Los dos de Switch numeran los lugares y guardan la bolsa cada uno a su manera
const BOLSILLO_SWITCH = { swsh: bolsilloSwSh, bdsp: bolsilloBDSP };

function genDe(juego) {
  return (LIMITES[juego] || {}).gen || 6;
}

// Los lugares especiales «intercambio» de cada generación (los creados en la web)
const INTERCAMBIO = { 4: 2002, 5: 30003, 6: 30001, 7: 30001, 8: 30001 };

// Hasta gen 6 no se pueden elegir las formas de Alola ni las de gen 7
const ULTIMA_FORMA_GEN6 = 10090;
// Las de Espada / Escudo (la 10181, Zygarde 10 %, es de antes)
const esFormaGen8 = (idForma) => idForma >= 10161 && idForma <= 10194 && idForma !== 10181;

export const ESPAÑOL = 7; // idioma de la partida
const HUEVO = { 1: "タマゴ", 2: "Egg", 3: "Œuf", 4: "Uovo", 5: "Ei", 7: "Huevo", 8: "알" };

// Estadísticas base que cambiaron después de gen 7 (la Pokédex trae las de ahora)
const BASES_ANTIGUAS = { 681: [60, 50, 150, 50, 150, 60] }; // Aegislash

// Las balls, por su número en el juego (del 1 al 26)
const BALLS = [
  "Master Ball", "Ultra Ball", "Great Ball", "Poke Ball", "Safari Ball", "Net Ball", "Dive Ball", "Nest Ball",
  "Repeat Ball", "Timer Ball", "Luxury Ball", "Premier Ball", "Dusk Ball", "Heal Ball", "Quick Ball", "Cherish Ball",
  "Fast Ball", "Level Ball", "Lure Ball", "Heavy Ball", "Love Ball", "Friend Ball", "Moon Ball", "Sport Ball", "Dream Ball", "Beast Ball"
];

// ---------- Datos ----------

let filasPokedex = null; // clave de la Pokédex -> fila
export const infoAtaques = new Map(); // id -> { tipo, pp }
const listas = new Map(); // "objetos-xy"... -> lista para el autocompletado

let delEditor = null; // datos/partida-3ds.json (js/partida/datos-editor.js)

// Todo lo que hace falta para abrir un Pokémon sin esperar a nada más. La ventana «Partida» lo
// pide al abrirse, así que al pulsar el primero ya está.
export async function prepararDatos() {
  const [pokedex, , editor] = await Promise.all([cargarPokedex(), cargarDatos(), cargarDatosEditor()]);
  if (!filasPokedex) filasPokedex = new Map(pokedex.map((fila) => [fila.clave, fila]));
  delEditor = editor;
}

export function nombreEspecie(id, idioma = ESPAÑOL) {
  const entrada = datos.pokemon.find((p) => p.id === id);
  if (!entrada) return `#${id}`;
  return idioma === ESPAÑOL ? entrada.es : entrada.en;
}

export function nombreHuevo(idioma) {
  return HUEVO[idioma] || HUEVO[2];
}

function filaNormal(especie) {
  return filasPokedex.get(especie) || [...filasPokedex.values()].find((fila) => fila.numero === especie && fila.normal);
}

// Los objetos van por su número en el juego (OBJETOS_EN): el nombre en español, por el inglés
export function objetosDe(juego) {
  const clave = `objetos-${juego}`;
  if (!listas.has(clave)) {
    const vistos = new Set();
    const lista = [];
    // En Espada / Escudo no están todos los de antes (los cristales Z, por ejemplo)
    const existe = BOLSILLO_SWITCH[juego] ? (id) => Boolean(BOLSILLO_SWITCH[juego](id)) : () => true;
    OBJETOS_EN.slice(0, LIMITES[juego].objetos + 1).forEach((en, id) => {
      if (!id || !en || vistos.has(en) || !existe(id)) return;
      vistos.add(en);
      const es = (buscarPorNombreIngles(datos.objetos, en) || {}).es || en;
      lista.push({ id, es, en, buscar: quitarAcentos(`${es} ${en}`) });
    });
    listas.set(clave, lista);
  }
  return listas.get(clave);
}

export function hastaLimite(nombre, juego) {
  const clave = `${nombre}-${juego}`;
  if (!listas.has(clave)) {
    // Las especies que hay en el juego, si no están todas (Espada / Escudo)
    const disponibles = nombre === "pokemon" && delEditor && delEditor.disponibles && delEditor.disponibles[juego];
    const hay = disponibles ? new Set(disponibles) : null;
    listas.set(clave, datos[nombre].filter((entrada) => entrada.id <= LIMITES[juego][nombre === "pokemon" ? "especies" : nombre] && (!hay || hay.has(entrada.id))));
  }
  return listas.get(clave);
}

// ¿Está esa especie en el juego?
export function especieEnJuego(especie, juego) {
  const disponibles = delEditor && delEditor.disponibles && delEditor.disponibles[juego];
  return especie <= LIMITES[juego].especies && (!disponibles || disponibles.includes(especie));
}

export function objeto(id, juego) {
  return id ? objetosDe(juego).find((o) => o.id === id) || { id, es: t("Objeto {n}", { n: id }), en: "" } : null;
}

export function habilidad(id) {
  return datos.habilidades.find((h) => h.id === id) || { id, es: t("Habilidad {n}", { n: id }), en: "" };
}

export function ataque(id) {
  return datos.ataques.find((a) => a.id === id) || { id, es: t("Ataque {n}", { n: id }), en: "" };
}

// ---------- Origen: dónde se conoció, juego y entrenador ----------

// Los juegos de origen que puede llevar un Pokémon (número en el juego), con la generación
// en que salieron
// (es: en español; en: en inglés; nombre: el del idioma de la web)
export const VERSIONES = [
  [48, "Diamante Brillante", "Brilliant Diamond", 8], [49, "Perla Reluciente", "Shining Pearl", 8], [44, "Espada", "Sword", 8], [45, "Escudo", "Shield", 8],
  [42, "Let's Go, Pikachu!", "Let's Go, Pikachu!", 8], [43, "Let's Go, Eevee!", "Let's Go, Eevee!", 8], [34, "Pokémon GO", "Pokémon GO", 8],
  [30, "Sol", "Sun", 7], [31, "Luna", "Moon", 7], [32, "Ultrasol", "Ultra Sun", 7], [33, "Ultraluna", "Ultra Moon", 7],
  [35, "Rojo (Consola Virtual)", "Red (Virtual Console)", 7], [36, "Verde (Consola Virtual)", "Green (Virtual Console)", 7], [37, "Azul (Consola Virtual)", "Blue (Virtual Console)", 7],
  [38, "Amarillo (Consola Virtual)", "Yellow (Virtual Console)", 7], [39, "Oro (Consola Virtual)", "Gold (Virtual Console)", 7], [40, "Plata (Consola Virtual)", "Silver (Virtual Console)", 7],
  [41, "Cristal (Consola Virtual)", "Crystal (Virtual Console)", 7],
  [24, "X", "X", 6], [25, "Y", "Y", 6], [27, "Rubí Omega", "Omega Ruby", 6], [26, "Zafiro Alfa", "Alpha Sapphire", 6],
  [21, "Negro", "Black", 5], [20, "Blanco", "White", 5], [23, "Negro 2", "Black 2", 5], [22, "Blanco 2", "White 2", 5],
  [10, "Diamante", "Diamond", 4], [11, "Perla", "Pearl", 4], [12, "Platino", "Platinum", 4], [7, "Oro HeartGold", "HeartGold", 4], [8, "Plata SoulSilver", "SoulSilver", 4],
  [2, "Rubí", "Ruby", 3], [1, "Zafiro", "Sapphire", 3], [3, "Esmeralda", "Emerald", 3], [4, "Rojo Fuego", "FireRed", 3], [5, "Verde Hoja", "LeafGreen", 3], [15, "Colosseum / XD", "Colosseum / XD", 3]
].map(([id, es, en, gen]) => ({ id, es, en, nombre: enIngles ? en : es, gen }));

// Los que caben en una partida de ese juego (los de su generación o de antes)
export function versionesDe(juego) {
  return VERSIONES.filter((v) => v.gen <= genDe(juego));
}

export function lugarIntercambio(juego) {
  return INTERCAMBIO[genDe(juego)];
}

// Los lugares del juego, sin repetir nombre. En 3DS, el N está en la posición N / 2; en gen 4
// y 5, en la N (y los especiales, aparte).
export function lugaresDe(juego) {
  const clave = `lugares-${juego}`;
  if (!listas.has(clave)) {
    const gen = genDe(juego);
    const tabla = juego === "bdsp" ? LUGARES_BDSP : { 4: LUGARES_GEN4, 5: LUGARES_GEN5, 6: LUGARES_GEN6, 7: LUGARES_GEN7, 8: LUGARES_GEN8 }[gen];
    const hasta = (LIMITES[juego] || {}).lugares ?? Infinity;
    const vistos = new Set();
    const lista = [];
    tabla.forEach((es, i) => {
      if (!es || vistos.has(es) || !i || i > hasta) return;
      vistos.add(es);
      const en = lugarEnIngles(es, juego);
      lista.push({ id: gen === 6 || gen === 7 ? i * 2 : i, es, en, buscar: quitarAcentos(`${es} ${en}`) });
    });
    lista.push({ id: INTERCAMBIO[gen], es: "Intercambio", en: "Link Trade", buscar: "intercambio link trade" });
    listas.set(clave, lista);
  }
  return listas.get(clave);
}

// En el idioma de la web
export function nombreLugar(numero, creado = false, juego = "xy") {
  const nombre = nombreLugarEs(numero, creado, juego);
  const lugar = /^Lugar (\d+)$/.exec(nombre);
  if (lugar) return t("Lugar {n}", { n: lugar[1] });
  return enIngles ? lugarEnIngles(nombre, juego) : nombre;
}

function nombreLugarEs(numero, creado = false, juego = "xy") {
  const gen = genDe(juego);
  if (creado && numero === INTERCAMBIO[gen]) return "NuzTheLocke";
  if (gen === 4) return LUGARES_GEN4[numero] || LUGARES_GEN4_OTROS[numero] || (numero ? `Lugar ${numero}` : "");
  if (gen === 5) return LUGARES_GEN5[numero] || LUGARES_GEN5_OTROS[numero] || (numero ? `Lugar ${numero}` : "");
  if (numero === INTERCAMBIO[6] || numero === 30002) return "Intercambio";
  if (juego === "bdsp") return LUGARES_BDSP[numero] || LUGARES_BDSP_OTROS[numero] || (numero && numero !== 65535 ? `Lugar ${numero}` : "");
  if (gen === 8) return LUGARES_GEN8[numero] || (numero ? `Lugar ${numero}` : "");
  const tabla = gen === 7 ? LUGARES_GEN7 : LUGARES_GEN6;
  return (numero % 2 === 0 && tabla[numero / 2]) || (numero ? `Lugar ${numero}` : "");
}

// ¿Creado de cero en la web? (también los de los cambios sin guardar)
export function creadoEnWeb(idLocke, llave) {
  const b = borrador && borrador.idLocke === idLocke ? borrador : null;
  if (b && b.noCreados.includes(llave)) return false;
  return Boolean((b && b.creados.includes(llave)) || esCreado(idLocke, llave));
}

// ---------- Bolsa ----------

// Bolsillo de PokeAPI -> el de la bolsa (js/partida/mochila3ds.js y mochilads.js). Gen 4 tiene
// además bolsillos para las balls, las cartas y los objetos de combate; gen 7, para los cristales
// Z y los Rotoprodigios (que PokeAPI no separa: van por el nombre).
const BOLSILLO_POKEAPI = { 1: "objetos", 2: "medicinas", 3: "objetos", 4: "mt", 5: "bayas", 6: "objetos", 7: "objetos", 8: "clave" };
const BOLSILLO_GEN4 = { 3: "balls", 6: "cartas", 7: "combate" };
// Los que en gen 6 van en otro: Repartir Experiencia (clave) y Caramelo Furia (medicinas)
const BOLSILLO_EN_GEN6 = { 216: "clave", 504: "medicinas" };

export function bolsilloDe(objetoId, juego = "xy") {
  const gen = genDe(juego);
  if (BOLSILLO_SWITCH[juego]) return BOLSILLO_SWITCH[juego](objetoId) || "objetos";
  const dePokeAPI = ((delEditor && delEditor.bolsillos) || {})[objetoId];
  if (gen === 7 && /ium Z$/.test(OBJETOS_EN[objetoId] || "")) return "cristales";
  if (gen === 7 && /^Roto /.test(OBJETOS_EN[objetoId] || "")) return "roto";
  if (gen >= 6 && BOLSILLO_EN_GEN6[objetoId]) return BOLSILLO_EN_GEN6[objetoId];
  return (gen === 4 && BOLSILLO_GEN4[dePokeAPI]) || BOLSILLO_POKEAPI[dePokeAPI] || "objetos";
}

// El nombre, y en las MT y MO el ataque que enseñan: «MT26 Terremoto»
export function nombreObjeto(id, juego) {
  const enseña = (((delEditor && delEditor.maquinas) || {})[juego] || {})[id];
  const o = objeto(id, juego);
  return enseña ? `${nombreDe(o)} ${nombreDe(ataque(enseña))}` : nombreDe(o);
}

// El icono: el de siempre (js/comun/imagenes.js) y, en las MT y MO, todas con el mismo disco
// de su tipo (los de PokeAPI, pixelados como en los juegos de 3DS)
const URL_DISCOS = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/";

export function urlsIconoDe(id, juego) {
  const o = objeto(id, juego);
  const enseña = (((delEditor && delEditor.maquinas) || {})[juego] || {})[id];
  const tipo = enseña && delEditor.ataques[enseña] && delEditor.ataques[enseña][0];
  if (tipo) return [`${URL_DISCOS}${/^HM/i.test((o && o.en) || "") ? "hm" : "tm"}-${tipo}.png`];
  return o && o.en ? urlsIconoObjeto(o.en) : [];
}

// Lo mismo, como el icono de las sugerencias del buscador (iconoObjeto de autocompletado.js)
export function iconoDe(id, juego) {
  const urls = urlsIconoDe(id, juego);
  return urls.length ? imagenConRespaldo(urls, `alt="" loading="lazy" class="objeto" data-quitar-si-falla`) : "";
}

// Lo que ha cambiado en la bolsa, para la actividad: «bolsa: +Master Ball ×99, Poción 5 → 12»
function resumenMochila(antes, despues, juego) {
  const total = (mochila) => {
    const cuantos = new Map();
    for (const lista of Object.values(mochila)) for (const e of lista) cuantos.set(e.objeto, (cuantos.get(e.objeto) || 0) + e.cantidad);
    return cuantos;
  };
  const [a, d] = [total(antes), total(despues)];
  const partes = [];
  for (const id of new Set([...a.keys(), ...d.keys()])) {
    const [x, y] = [a.get(id) || 0, d.get(id) || 0];
    if (x === y) continue;
    const nombre = nombreObjeto(id, juego);
    partes.push(!x ? `+${nombre} ×${y}` : !y ? `−${nombre}` : `${nombre} ${x} → ${y}`);
  }
  return partes.length ? `${t("bolsa")}: ${partes.join(", ")}` : "";
}

export function balls(juego = "xy") {
  if (!listas.has("balls")) {
    listas.set("balls", BALLS.map((en, i) => ({ id: i + 1, en, es: (buscarPorNombreIngles(datos.objetos, en) || {}).es || en })));
  }
  return listas.get("balls").slice(0, (LIMITES[juego] || {}).balls || BALLS.length);
}

export async function cargarInfoAtaque(id) {
  if (!id || infoAtaques.has(id)) return;
  const local = delEditor && delEditor.ataques[id];
  if (local) {
    infoAtaques.set(id, { tipo: local[0], pp: local[1] });
    return;
  }
  const m = await pedirJSON(`${URL_API}move/${id}`);
  infoAtaques.set(id, { tipo: m.type.name, pp: m.pp || 1 });
}

function idDeUrl(url) {
  return Number((url.match(/\/(\d+)\/?$/) || [])[1]);
}

// ---------- Especies y formas ----------

function nombreDeForma(fila) {
  const dentro = fila.nombre.match(/\((.*)\)$/);
  return dentro ? dentro[1] : fila.nombre;
}

// [{ forma (número en el juego), texto, idForma?, formaPMD?, imagenForma? }]
// juego: el de la partida (sin él, todas: para las estadísticas de lo que ya está en ella)
export function formasDe(especie, juego) {
  const lista = [{ forma: 0, texto: "Normal" }];
  if (especie === 493) {
    lista[0].texto = t("Tipo {tipo}", { tipo: tiposEs.normal });
    formasDeTipoDe(493).forEach((f, i) =>
      lista.push({ forma: i + 1, texto: t("Tipo {tipo}", { tipo: tiposEs[f.tipo] }), formaPMD: f.pmd, imagenForma: f.imagenForma })
    );
  }
  for (const [numero, [idForma, showdown]] of Object.entries(FORMAS[especie] || {})) {
    if (juego && genDe(juego) < 7 && idForma > ULTIMA_FORMA_GEN6) continue;
    if (juego && genDe(juego) < 8 && esFormaGen8(idForma)) continue;
    // Perla Reluciente no tiene formas regionales (ni las de Alola ni las de Galar)
    if (juego === "bdsp" && idForma > ULTIMA_FORMA_GEN6) continue;
    const fila = filasPokedex.get(idForma);
    lista.push({ forma: Number(numero), texto: fila ? (enIngles ? etiquetaEnIngles(nombreDeForma(fila)) : nombreDeForma(fila)) : showdown, idForma, formaPMD: fila ? fila.forma : 0 });
  }
  return lista;
}

export function basesDe(especie, forma) {
  const opcion = formasDe(especie).find((f) => f.forma === forma) || {};
  return (!opcion.idForma && BASES_ANTIGUAS[especie]) ||
    ((opcion.idForma && filasPokedex.get(opcion.idForma)) || filaNormal(especie) || {}).bases || [1, 1, 1, 1, 1, 1];
}

// Lo de la especie (y su forma) que hace falta para editarla o crearla: habilidades posibles
// (num: 1, 2 o 4 la oculta), género, amistad de base, ciclos del huevo y ataques por nivel
export async function datosEspecie(especie, forma, juego) {
  const opcion = formasDe(especie).find((f) => f.forma === forma) || {};
  const id = opcion.idForma || especie;
  const numero = { 1: 1, 2: 2, 3: 4 };

  // Lo normal: de datos/partida-3ds.json, al momento
  const local = delEditor && delEditor.especies[especie] && (delEditor.habilidades[id] || delEditor.habilidades[especie]);
  if (local) {
    const [generoRatio, felicidad, ciclos, diferencias] = delEditor.especies[especie];
    const delJuego = delEditor.aprende[juego] || {};
    return {
      opcion,
      bases: basesDe(especie, forma),
      habilidades: (delEditor.habilidades[id] || delEditor.habilidades[especie])
        .map(([hab, hueco]) => ({ num: numero[hueco], ...habilidad(hab) }))
        .filter((h) => h.id <= LIMITES[juego].habilidades && (h.num !== 4 || genDe(juego) >= 5))
        .sort((a, b) => a.num - b.num),
      generoRatio,
      difGenero: Boolean(diferencias),
      felicidad,
      ciclos,
      aprende: (delJuego[id] || delJuego[especie] || [])
        .filter(([ataqueId]) => ataqueId <= LIMITES[juego].ataques)
        .map(([ataqueId, nivel]) => ({ id: ataqueId, nivel }))
    };
  }

  // Si no está en el archivo, de PokeAPI
  const [p, sp] = await Promise.all([
    pedirJSON(`${URL_API}pokemon/${id}`),
    pedirJSON(`${URL_API}pokemon-species/${especie}`)
  ]);
  const habilidades = p.abilities
    .map((h) => ({ num: numero[h.slot], ...habilidad(idDeUrl(h.ability.url)) }))
    .filter((h) => h.id <= LIMITES[juego].habilidades && (h.num !== 4 || genDe(juego) >= 5))
    .sort((a, b) => a.num - b.num);
  const aprende = p.moves
    .flatMap((m) =>
      m.version_group_details
        .filter((d) => d.version_group.name === GRUPOS[juego] && d.move_learn_method.name === "level-up")
        .map((d) => ({ id: idDeUrl(m.move.url), nivel: d.level_learned_at }))
    )
    .filter((a) => a.id <= LIMITES[juego].ataques)
    .sort((a, b) => a.nivel - b.nivel);
  return {
    opcion,
    bases: basesDe(especie, forma),
    habilidades,
    generoRatio: sp.gender_rate,
    difGenero: Boolean(sp.has_gender_differences),
    felicidad: sp.base_happiness ?? 70,
    ciclos: sp.hatch_counter ?? 20,
    aprende
  };
}

// Los cuatro últimos que aprende hasta ese nivel, como los salvajes
export function ataquesDeNivel(aprende, nivel) {
  const ids = [];
  for (const a of aprende) {
    if (a.nivel > nivel) break;
    if (ids.includes(a.id)) ids.splice(ids.indexOf(a.id), 1);
    ids.push(a.id);
  }
  return ids.slice(-4);
}

export function generoAlAzar(generoRatio) {
  if (generoRatio < 0) return "";
  return Math.random() * 8 < generoRatio ? "F" : "M";
}

// ---------- De un Pokémon de «Mis equipos» a uno de la partida ----------

// p: como los de «Mis equipos» (o de un paste ya leído). Devuelve { editable, base,
// nombreEspecie, problemas } (lo que no existe en el juego se queda fuera).
export async function editableDeEquipo(p, juego) {
  const problemas = [];
  const limites = LIMITES[juego];
  const quien = p.mote || nombreDe(p);
  if (!especieEnJuego(p.id, juego)) throw new Error(t("{nombre} no está en este juego.", { nombre: nombreDe(p) }));

  const formas = formasDe(p.id, juego);
  const suya = formas.find((f) => (p.imagenForma ? f.imagenForma === p.imagenForma : f.idForma && f.idForma === p.idForma));
  if (!suya && p.idForma && p.idForma !== p.id && !/mega|primal/.test(p.formaSlug || "")) problemas.push(`${quien}: ${t("va con la forma normal")}`);
  const forma = suya ? suya.forma : 0;
  const especie = await datosEspecie(p.id, forma, juego);

  let hab = especie.habilidades[0] || { id: 0, num: 1 };
  if (p.habilidad) {
    const propia = especie.habilidades.find((h) => h.id === p.habilidad.id);
    if (propia) hab = propia;
    else if (p.habilidad.id <= limites.habilidades) hab = { id: p.habilidad.id, num: 1 };
    else problemas.push(`${quien}: ${t("{nombre} no está en este juego", { nombre: nombreDe(p.habilidad) })}`);
  }

  let idObjeto = 0;
  if (p.objeto) {
    const nombre = normalizarNombre(p.objeto.en || "");
    const delJuego = objetosDe(juego).find((o) => normalizarNombre(o.en) === nombre || o.es === p.objeto.es);
    if (delJuego) idObjeto = delJuego.id;
    else problemas.push(`${quien}: ${t("{nombre} no está en este juego", { nombre: nombreDe(p.objeto) })}`);
  }

  const ataques = [];
  for (const a of (p.ataques || []).filter(Boolean)) {
    if (a.id > limites.ataques) {
      problemas.push(`${quien}: ${t("{nombre} no está en este juego", { nombre: nombreDe(a) })}`);
      continue;
    }
    await cargarInfoAtaque(a.id);
    ataques.push({ id: a.id, pp: infoAtaques.get(a.id).pp, masPP: 0 });
  }
  while (ataques.length < 4) ataques.push({ id: 0, pp: 0, masPP: 0 });

  const entreno = entrenoDe(p);
  const conGenero = { ...p, generoRatio: especie.generoRatio };
  const genero = generoDe(conGenero) || generosPosibles(conGenero)[0] || "";
  return {
    editable: {
      especie: p.id,
      forma,
      genero,
      mote: String(p.mote || "").slice(0, genDe(juego) >= 6 ? 12 : 10),
      shiny: Boolean(p.shiny),
      objeto: idObjeto,
      habilidad: hab.id,
      numHabilidad: hab.num,
      naturaleza: Math.max(0, NATURALEZAS.findIndex((n) => n.id === entreno.naturaleza)),
      nivel: entreno.nivel,
      evs: entreno.evs,
      ivs: entreno.ivs,
      amistad: 255,
      ataques
    },
    base: especie.bases,
    generoRatio: especie.generoRatio,
    problemas
  };
}

// ---------- Cambios sin guardar ----------
//
// Los cambios no se escriben uno a uno: se hacen sobre una copia en memoria de la partida (el
// borrador) y se guardan todos juntos al cerrar la ventana «Partida» (guardarCambios), con
// una sola copia de seguridad y una sola línea en la actividad. Si mientras tanto la partida
// del disco cambia (se ha guardado en el juego), no se escribe.
//
//   borrador: { idLocke, base (la del disco al empezar), bytes (con los cambios), vista (para
//               pintarla, como las de js/partida/partidas.js), metidos: [llaves], detalles: [] }

// Marcas de los detalles (no se enseñan tal cual: los de la bolsa se resumen al guardar)
const CAMBIOS_DE_SITIO = "cambios de sitio";
export const BOLSA = "bolsa";

let borrador = null;
let alCambiar = () => {};

// Lo que se hace cada vez que cambia el borrador (repintar la ventana «Partida»)
export function alCambiarBorrador(funcion) {
  alCambiar = funcion;
}

export function hayCambios(idLocke) {
  return Boolean(borrador && borrador.idLocke === idLocke && borrador.detalles.length);
}

export function cuantosCambios(idLocke) {
  return hayCambios(idLocke) ? borrador.detalles.length : 0;
}

// La partida con los cambios sin guardar, como la guardada en partidas.js (null si no hay)
export function vistaConCambios(idLocke) {
  return hayCambios(idLocke) ? borrador.vista : null;
}

// Los bytes de la partida tal y como se ve en la ventana (para exportar una caja): con los cambios
// sin guardar, si hay. A diferencia de partidaDeTrabajo, no empieza un borrador.
export async function bytesComoSeVen(idLocke) {
  return hayCambios(idLocke) ? borrador.bytes : leerArchivo(idLocke);
}

// La partida sobre la que se trabaja: la del borrador o, sin cambios, la del disco
export async function partidaDeTrabajo(idLocke) {
  if (hayCambios(idLocke)) return borrador.bytes;
  const bytes = await leerArchivo(idLocke);
  borrador = { idLocke, base: bytes, bytes, vista: null, metidos: [], creados: [], noCreados: [], detalles: [] };
  return bytes;
}

export function descartarCambios() {
  borrador = null;
  alCambiar();
}

// Que en ese sitio siga el mismo Pokémon (llave 0: que siga vacío)
export function comprobarSitio(h, sitio, llave) {
  if (llaveDe(mirar(h, sitio)) !== llave) throw new Error(t("La partida ha cambiado. Ciérrala y vuelve a abrirla."));
}

// Mover, borrar, meter...: hacer(h) cambia los huecos (js/partida/huecos.js) y devuelve las
// llaves de los Pokémon que mete (no cuentan como capturas ni como muertos). detalle: lo que
// se apunta en la actividad al guardar (mover no apunta nada).
// hacer(h) puede devolver también { metidos, creados, noCreados }: los creados de cero en la
// web (su juego de origen sale como «NuzTheLocke») y los que dejan de serlo
export function cambiarHuecos(idLocke, hacer, detalle = "") {
  return cambiarPartida(idLocke, (original) => {
    const h = abrirHuecos(original, basesDe);
    const r = hacer(h) || [];
    return { nuevo: escribirHuecos(h), ...(Array.isArray(r) ? { metidos: r } : r) };
  }, detalle);
}

// Cualquier otro cambio: transformar(partida) devuelve { nuevo, metidos?, creados?, noCreados? }
export async function cambiarPartida(idLocke, transformar, detalle = "") {
  await prepararDatos();
  const original = await partidaDeTrabajo(idLocke);
  const { nuevo, metidos = [], creados = [], noCreados = [] } = transformar(original);
  const vista = await convertirPartida(formatoDeSeguro(nuevo).leer(nuevo));
  borrador.bytes = nuevo;
  borrador.vista = vista;
  borrador.metidos.push(...metidos);
  borrador.creados.push(...creados);
  borrador.noCreados.push(...noCreados);
  borrador.detalles.push(detalle || CAMBIOS_DE_SITIO);
  alCambiar();
}

// Escribe todos los cambios en el archivo. Tiene que ser con un clic (el permiso).
export async function guardarCambios(idLocke) {
  if (!hayCambios(idLocke)) return;
  const b = borrador;
  await escribirPartida(idLocke, (enDisco) => {
    if (enDisco.length !== b.base.length || enDisco.some((byte, i) => byte !== b.base[i])) {
      throw new Error(t("La partida del disco ha cambiado desde que empezaste (¿has guardado en el juego?). Descarta los cambios y vuelve a hacerlos con el juego cerrado."));
    }
    if (b.metidos.length) marcarMetidos(idLocke, b.metidos);
    if (b.creados.length) marcarCreados(idLocke, b.creados);
    if (b.noCreados.length) marcarCreados(idLocke, b.noCreados, false);
    return b.bytes;
  });
  if (borrador === b) borrador = null;
  sumarContador("editar-partida"); // para los logros
  if (b.detalles.includes(BOLSA)) sumarContador("bolsa-partida");
  alCambiar();
  // En la actividad, una sola línea (los cambios de sitio no cuentan, salvo si no hay más). Lo
  // de la bolsa, como ha quedado al final.
  const formato = formatoDeSeguro(b.bytes);
  const { leerMochila } = formato.mochila;
  const bolsa = b.detalles.includes(BOLSA) ? resumenMochila(leerMochila(b.base), leerMochila(b.bytes), formato.id) : "";
  const detalles = [...new Set(b.detalles.filter((d) => d !== CAMBIOS_DE_SITIO && d !== BOLSA)), ...(bolsa ? [bolsa] : [])];
  await apuntarSuceso(idLocke, "edicion", { detalle: detalles.length ? detalles.join("; ") : t(CAMBIOS_DE_SITIO) });
}
