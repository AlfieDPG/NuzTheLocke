// Genera datos/habilidades.json: la nota de cada habilidad según Pokémon Showdown (licencia
// MIT), para el análisis de equipos (js/equipos/analisis.js).
//
//   { "1": 1.5, "2": 4, ... }   (número de la habilidad, el mismo que en PokeAPI: nota)
//
// La nota va de -1 (perjudica: Ausente, Inicio Lento) a 5 (Potencia, Superguarda); 2 es
// «útil en general». Sale del campo «rating» de data/abilities.ts. Se rehace con:
//   node herramientas/generar-habilidades.mjs
// solo hace falta cuando salen habilidades nuevas.

import { writeFileSync } from "node:fs";

const URL_TS = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/abilities.ts";

const respuesta = await fetch(URL_TS);
if (!respuesta.ok) throw new Error(`No se ha podido bajar abilities.ts (${respuesta.status})`);
const texto = await respuesta.text();

// Cada habilidad es un bloque «\tclave: {» ... «\t},» con su «rating: N» y su «num: N»
const notas = {};
for (const bloque of texto.split(/\n\t(?=[a-z0-9]+: \{)/).slice(1)) {
  const fin = bloque.indexOf("\n\t},");
  const cuerpo = fin < 0 ? bloque : bloque.slice(0, fin);
  const nota = cuerpo.match(/\n\t\trating: (-?[\d.]+),/);
  const num = cuerpo.match(/\n\t\tnum: (\d+),/);
  if (nota && num && Number(num[1]) > 0) notas[Number(num[1])] = Number(nota[1]);
}

writeFileSync(new URL("../datos/habilidades.json", import.meta.url), JSON.stringify(notas));
console.log(`datos/habilidades.json: ${Object.keys(notas).length} habilidades`);
