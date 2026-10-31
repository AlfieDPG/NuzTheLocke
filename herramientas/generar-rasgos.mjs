// Genera datos/rasgos.json: lo que hace falta de cada especie para «El intruso»
// (js/juegos/intruso.js) y que no está en datos/pokedex.json. Una fila por especie:
//
//   { "1": ["green", 1, [1, 7], 7, 69, 1, 0], ... }
//   [color, sexo, grupos huevo, altura, peso, mega, regional]
//
//   color      -> el de la Pokédex: black, blue, brown, gray, green, pink, purple, red, white, yellow
//   sexo       -> gender_rate de PokeAPI: -1 sin sexo, 0 solo machos, 8 solo hembras, 1-7 las dos
//                 (en octavos de hembras)
//   huevos     -> egg_group_id: 1 Monstruo, 2 Agua 1, 3 Bicho, 4 Volador, 5 Campo, 6 Hada,
//                 7 Planta, 8 Humanoide, 9 Agua 3, 10 Mineral, 11 Amorfo, 12 Agua 2, 13 Ditto,
//                 14 Dragón, 15 Desconocido (no cría)
//   altura     -> en decímetros; peso -> en hectogramos (como en los juegos)
//   mega       -> 1 si alguna de sus formas es una megaevolución
//   regional   -> 1 si tiene forma de Alola, Galar, Hisui o Paldea
//
// Sale de pokemon_species.csv, pokemon.csv y pokemon_egg_groups.csv de PokeAPI. Se rehace con:
//   node herramientas/generar-rasgos.mjs
// solo hace falta cuando salen Pokémon nuevos.

import { writeFileSync } from "node:fs";

const URL_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const COLORES = ["", "black", "blue", "brown", "gray", "green", "pink", "purple", "red", "white", "yellow"];
const ULTIMA_ESPECIE = 1025;

async function csv(nombre) {
  const respuesta = await fetch(`${URL_CSV}${nombre}.csv`);
  if (!respuesta.ok) throw new Error(`No se ha podido bajar ${nombre}.csv (${respuesta.status})`);
  return (await respuesta.text()).split("\n").slice(1).map((linea) => linea.trim().split(",")).filter((p) => p[0]);
}

const [especies, pokemon, huevos] = await Promise.all([csv("pokemon_species"), csv("pokemon"), csv("pokemon_egg_groups")]);

const rasgos = {};
// pokemon_species.csv: id, identifier, generation_id, evolves_from_species_id, evolution_chain_id,
// color_id (5), shape_id, habitat_id, gender_rate (8), ...
for (const p of especies) {
  const id = Number(p[0]);
  if (id > ULTIMA_ESPECIE) continue;
  rasgos[id] = [COLORES[Number(p[5])] || "", Number(p[8]), [], 0, 0, 0, 0];
}
// pokemon_egg_groups.csv: species_id, egg_group_id
for (const [especie, grupo] of huevos) if (rasgos[especie]) rasgos[especie][2].push(Number(grupo));
// pokemon.csv: id, identifier, species_id, height, weight, base_experience, order, is_default
for (const [, slug, especie, altura, peso, , , porDefecto] of pokemon) {
  const fila = rasgos[especie];
  if (!fila) continue;
  if (porDefecto === "1") {
    fila[3] = Number(altura);
    fila[4] = Number(peso);
  }
  if (/-mega(-[xyz])?$/.test(slug)) fila[5] = 1;
  if (/-(alola|galar|hisui|paldea)(-|$)/.test(slug) && !slug.endsWith("-cap")) fila[6] = 1; // no las gorras de Pikachu
}

writeFileSync(new URL("../datos/rasgos.json", import.meta.url), JSON.stringify(rasgos));
console.log(`datos/rasgos.json: ${Object.keys(rasgos).length} especies`);
