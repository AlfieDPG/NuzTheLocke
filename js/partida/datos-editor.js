// ---------- Lo que necesita el editor de partidas, ya preparado ----------
//
// Para que abrir un Pokémon sea al momento, sin esperar a PokeAPI. La web lo lleva montado en
// datos/partida-3ds.json (lo rehace herramientas/generar-datos.html con montarDatosEditor):
//
//   ataques:     [tipo, pp] por número de ataque (null los que no hay)
//   especies:    { especie: [gender_rate, base_happiness, hatch_counter, diferencias de hembra 0/1] }
//   habilidades: { pokemon (id de PokeAPI, formas incluidas): [[habilidad, hueco 1-3], ...] }
//   aprende:     { juego: { pokemon: [[ataque, nivel], ...] } } (subiendo de nivel; juegos de GRUPOS)
//   bolsillos:   { objeto (número en el juego): bolsillo de PokeAPI (1-8) }
//   maquinas:    { juego: { objeto: ataque } } (qué enseña cada MT / MO / DT)
//   disponibles: { juego: [especie, ...] } (solo los de Switch: no todas las especies están en el juego)
//
// Sale de los CSV de PokeAPI (moves, pokemon_species, pokemon, pokemon_abilities, version_groups,
// pokemon_moves, items, item_categories, item_game_indices y machines). Hasta la gen 8.

import { descargarCSV } from "../comun/datos.js";
import { TIPOS_POR_ID } from "../calculadora/ataques.js";

const ULTIMA_ESPECIE = 898;
// Los juegos que se editan y su grupo de versiones en PokeAPI
export const GRUPOS = {
  frlg: "firered-leafgreen", dp: "diamond-pearl", platino: "platinum", hgss: "heartgold-soulsilver", bw: "black-white", b2w2: "black-2-white-2",
  xy: "x-y", oras: "omega-ruby-alpha-sapphire", sm: "sun-moon", usum: "ultra-sun-ultra-moon",
  swsh: "sword-shield", bdsp: "brilliant-diamond-shining-pearl"
};
// Los DLC de Espada / Escudo van aparte en PokeAPI: lo que no esté en el juego base, de ahí
const DLC = { "the-isle-of-armor": "swsh", "the-crown-tundra": "swsh" };
// Los juegos en los que no están todas las especies (en Perla Reluciente están las 493)
const CON_DISPONIBLES = ["swsh"];
// Las MT de Perla Reluciente (objetos 328 a 427, por orden): PokeAPI no las tiene casi ninguna.
// De PersonalInfo8BDSP de PKHeX (github.com/kwsch/PKHeX)
const MT_BDSP = [
  264, 337, 352, 347, 46, 92, 258, 339, 331, 526, 241, 269, 58, 59, 63, 113, 182, 240, 202, 219,
  605, 76, 231, 85, 87, 89, 490, 91, 94, 247, 280, 104, 115, 351, 53, 188, 201, 126, 317, 332,
  259, 263, 521, 156, 213, 168, 211, 285, 503, 315, 355, 411, 412, 206, 362, 374, 451, 203, 406, 409,
  261, 405, 417, 153, 421, 371, 278, 416, 397, 148, 444, 419, 86, 360, 14, 446, 244, 555, 399, 157,
  404, 214, 523, 398, 138, 447, 207, 365, 369, 164, 430, 433, 15, 19, 57, 70, 432, 249, 127, 431
];
const SUBIENDO_DE_NIVEL = 1; // pokemon_move_methods.csv

function filas(csv) {
  return csv.split("\n").slice(1).map((linea) => linea.trim().split(",")).filter((partes) => partes[0]);
}

export async function montarDatosEditor() {
  const [moves, species, pokemon, abilities, groups, learnset, items, categories, indices, machines] = await Promise.all(
    [
      "moves.csv", "pokemon_species.csv", "pokemon.csv", "pokemon_abilities.csv", "version_groups.csv", "pokemon_moves.csv",
      "items.csv", "item_categories.csv", "item_game_indices.csv", "machines.csv"
    ].map(descargarCSV)
  );

  const ataques = [];
  for (const [id, , , tipo, , pp] of filas(moves)) {
    if (Number(id) < 10000 && TIPOS_POR_ID[Number(tipo)]) ataques[Number(id)] = [TIPOS_POR_ID[Number(tipo)], Number(pp) || 1];
  }
  for (let i = 0; i < ataques.length; i++) if (!ataques[i]) ataques[i] = null;

  // id, identifier, generation_id, evolves_from, chain, color, shape, habitat, gender_rate,
  // capture_rate, base_happiness, is_baby, hatch_counter, has_gender_differences...
  const especies = {};
  for (const p of filas(species)) {
    const id = Number(p[0]);
    if (id > ULTIMA_ESPECIE) continue;
    especies[id] = [Number(p[8]), p[10] === "" ? 70 : Number(p[10]), Number(p[12]) || 20, Number(p[13]) ? 1 : 0];
  }

  // Los Pokémon (formas incluidas) de las especies de hasta gen 7
  const especieDe = new Map(filas(pokemon).map((p) => [Number(p[0]), Number(p[2])]));
  const vale = (id) => (especieDe.get(id) || Infinity) <= ULTIMA_ESPECIE;

  const habilidades = {};
  for (const [id, habilidad, , hueco] of filas(abilities)) {
    if (!vale(Number(id))) continue;
    (habilidades[id] = habilidades[id] || []).push([Number(habilidad), Number(hueco)]);
  }

  const idGrupo = new Map(filas(groups).map((p) => [p[1], Number(p[0])]));
  const deGrupo = new Map(Object.entries(GRUPOS).map(([juego, nombre]) => [idGrupo.get(nombre), juego]));
  const deDLC = new Map(Object.entries(DLC).map(([nombre, juego]) => [idGrupo.get(nombre), juego]));
  const aprende = Object.fromEntries(Object.keys(GRUPOS).map((juego) => [juego, {}]));
  const deLosDLC = {}; // juego -> pokemon -> lista (solo se usa si en el juego base no tiene)
  const disponibles = Object.fromEntries(CON_DISPONIBLES.map((juego) => [juego, new Set()]));
  for (const [id, grupo, ataque, metodo, nivel] of filas(learnset)) {
    const juego = deGrupo.get(Number(grupo)) || deDLC.get(Number(grupo));
    if (!juego || !vale(Number(id))) continue;
    // Si aprende algo (como sea) en ese juego, es que está
    if (disponibles[juego]) disponibles[juego].add(especieDe.get(Number(id)));
    if (Number(metodo) !== SUBIENDO_DE_NIVEL) continue;
    const destino = deGrupo.has(Number(grupo)) ? aprende[juego] : ((deLosDLC[juego] = deLosDLC[juego] || {}));
    (destino[id] = destino[id] || []).push([Number(ataque), Number(nivel) || 1]);
  }
  for (const [juego, porPokemon] of Object.entries(deLosDLC)) {
    for (const [id, lista] of Object.entries(porPokemon)) if (!aprende[juego][id]) aprende[juego][id] = lista;
  }
  for (const delJuego of Object.values(aprende)) {
    for (const lista of Object.values(delJuego)) {
      // Sin repetidos (el mismo ataque al mismo nivel puede venir del juego y de un DLC)
      const vistos = new Set();
      lista.splice(0, lista.length, ...lista.filter(([a, n]) => !vistos.has(`${a}-${n}`) && vistos.add(`${a}-${n}`)));
      lista.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    }
  }

  // Objetos por su número en el juego (item_game_indices; el de gen 6 y, los que no están
  // ahí, el de gen 8: los números no cambian de una a otra): en qué bolsillo de PokeAPI van
  // (item_pockets: 1 objetos, 2 medicinas, 3 balls, 4 máquinas, 5 bayas, 6 cartas, 7 de
  // combate, 8 clave)
  const bolsilloDeCategoria = new Map(filas(categories).map((p) => [Number(p[0]), Number(p[1])]));
  const categoriaDe = new Map(filas(items).map((p) => [Number(p[0]), Number(p[2])]));
  const enJuego = new Map(); // id de PokeAPI -> número en el juego
  const bolsillos = {};
  for (const gen of [6, 8]) {
    for (const [item, generacion, indice] of filas(indices)) {
      if (Number(generacion) !== gen || enJuego.has(Number(item))) continue;
      enJuego.set(Number(item), Number(indice));
      const bolsillo = bolsilloDeCategoria.get(categoriaDe.get(Number(item)));
      if (bolsillo && !bolsillos[indice]) bolsillos[indice] = bolsillo;
    }
  }

  // Qué ataque enseña cada MT / MO / DT, por su número en el juego
  const maquinas = Object.fromEntries(Object.keys(GRUPOS).map((juego) => [juego, {}]));
  for (const [, grupo, item, ataque] of filas(machines)) {
    const juego = deGrupo.get(Number(grupo));
    const indice = enJuego.get(Number(item));
    if (juego && indice) maquinas[juego][indice] = Number(ataque);
  }
  maquinas.bdsp = Object.fromEntries(MT_BDSP.map((ataque, i) => [328 + i, ataque]));

  const listas = Object.fromEntries(Object.entries(disponibles).map(([juego, s]) => [juego, [...s].sort((a, b) => a - b)]));
  return { ataques, especies, habilidades, aprende, bolsillos, maquinas, disponibles: listas };
}

const URL_DATOS = new URL("../../datos/partida-3ds.json", import.meta.url);
let promesa = null;

// Lo de datos/partida-3ds.json (o, sin el archivo, montado ahora desde PokeAPI)
export function cargarDatosEditor() {
  if (!promesa) {
    promesa = (async () => {
      try {
        const respuesta = await fetch(URL_DATOS);
        if (respuesta.ok) return await respuesta.json();
      } catch (error) {
        // sin el archivo, se monta desde PokeAPI
      }
      return montarDatosEditor();
    })();
    promesa.catch(() => (promesa = null));
  }
  return promesa;
}
