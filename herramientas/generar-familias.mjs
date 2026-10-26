// Genera datos/familias.json: de qué Pokémon viene cada uno por evolución (Raichu -> Pikachu,
// Pikachu -> Pichu), para que el árbitro de normas (js/partida/arbitro.js) sepa las líneas
// evolutivas, sus ramas (Eevee) y en qué puede acabar cada Pokémon. Los que no vienen de
// ningún otro no salen.
//
//   { "26": 25, "25": 172, ... }   (especie: especie de la que evoluciona)
//
// Sale de pokemon_species.csv de PokeAPI (evolves_from_species_id). Se rehace con:
//   node herramientas/generar-familias.mjs
// solo hace falta cuando salen Pokémon nuevos.

import { writeFileSync } from "node:fs";

const URL_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv";

const respuesta = await fetch(URL_CSV);
if (!respuesta.ok) throw new Error(`No se ha podido bajar pokemon_species.csv (${respuesta.status})`);
const filas = (await respuesta.text()).split("\n").slice(1).map((linea) => linea.trim().split(",")).filter((p) => p[0]);

// id, identifier, generation_id, evolves_from_species_id, evolution_chain_id...
const padres = {};
for (const p of filas) if (p[3]) padres[Number(p[0])] = Number(p[3]);

writeFileSync(new URL("../datos/familias.json", import.meta.url), JSON.stringify(padres));
console.log(`datos/familias.json: ${Object.keys(padres).length} especies`);
