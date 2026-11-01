// Genera js/lucha/motor.js: el motor de combate de Pokémon Showdown (licencia MIT), empaquetado
// en un solo archivo para el navegador. Es solo el que calcula los combates (daño, habilidades,
// objetos, turnos); la pantalla de «Lucha» es nuestra (js/lucha/). No se usa nada de la web de
// Showdown (su cliente, AGPL) ni sus imágenes ni sus sonidos.
//
// Se rehace solo para cambiar de versión del motor (por ataques o Pokémon nuevos):
//
//   1) En una carpeta cualquiera FUERA de la web:  npm init -y  y  npm i @pkmn/sim esbuild
//   2) Desde la carpeta de la web:  node herramientas/generar-motor-lucha.mjs <esa carpeta>
//
// OJO: los dos jugadores de un combate tienen que usar el mismo motor (cada navegador calcula el
// combate entero y solo se mandan las elecciones). Cada lucha guarda la versión con la que
// empezó (js/comun/luchas.js, «motor») y la web avisa si no coincide: al cambiar de versión, las
// luchas a medias de antes ya no se pueden seguir.

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const carpeta = process.argv[2];
if (!carpeta) throw new Error("Falta la carpeta con node_modules (@pkmn/sim y esbuild)");

const requerir = createRequire(join(resolve(carpeta), "package.json"));
const esbuild = requerir("esbuild");
const raiz = join(resolve(carpeta), "node_modules", "@pkmn", "sim");
const version = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")).version;
const licencia = readFileSync(join(raiz, "LICENSE"), "utf8").trim();

const entrada = join(resolve(carpeta), "entrada-lucha.mjs");
writeFileSync(entrada, `export { Battle, Teams, Dex, toID } from "@pkmn/sim";\nexport const VERSION = ${JSON.stringify(version)};\n`);

const resultado = await esbuild.build({
  entryPoints: [entrada],
  absWorkingDir: resolve(carpeta),
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
  write: false,
  legalComments: "none"
});

const cabecera = `/* Motor de combate de Pokémon Showdown (@pkmn/sim ${version}), empaquetado para «Lucha».
   Generado con herramientas/generar-motor-lucha.mjs: no se edita a mano.

${licencia}
*/
`;

mkdirSync("js/lucha", { recursive: true });
writeFileSync("js/lucha/motor.js", cabecera + resultado.outputFiles[0].text);
console.log(`js/lucha/motor.js: @pkmn/sim ${version}, ${(resultado.outputFiles[0].text.length / 1048576).toFixed(1)} MB`);
