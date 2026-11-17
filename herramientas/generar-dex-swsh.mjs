// Saca de personal_swsh (PKHeX.Core/Resources/byte/personal) en qué hueco de cada Pokédex de Espada/Escudo
// va cada especie (Galar, Isla de la Armadura, Corona Nieve) y su género, y escribe js/partida/dex-swsh.js.
//   node herramientas/generar-dex-swsh.mjs ruta/a/personal_swsh
import { readFileSync, writeFileSync } from "node:fs";

const TAM = 0xb0;
const b = readFileSync(process.argv[2]);
const u16 = (o) => b[o] | (b[o + 1] << 8);
const huecos = { galar: [], armadura: [], corona: [] };
const usada = new Set();
for (const [dex, o, cuantos] of [["galar", 0x5c, 400], ["armadura", 0xac, 211], ["corona", 0xae, 210]]) {
  huecos[dex] = new Array(cuantos).fill(0);
  for (let e = 1; e <= 898; e++) {
    const i = u16(e * TAM + o);
    if (!i || usada.has(e)) continue;
    if (i > cuantos) throw new Error(`${dex} ${e} ${i}`);
    huecos[dex][i - 1] = e;
  }
  for (const e of huecos[dex]) if (e) usada.add(e);
}
const genero = {};
for (const e of usada) {
  const g = b[e * TAM + 0x12];
  if (g === 255 || g === 254 || g === 0) genero[e] = g;
}
const texto = `// Generado por herramientas/generar-dex-swsh.mjs (de personal_swsh de PKHeX). No tocar a mano.
// Cada Pokédex de Espada/Escudo: la especie de cada hueco (0 = vacío). Una especie va solo en la primera
// en la que sale (Galar, luego Armadura, luego Corona), como en el juego.
export const DEX_SWSH = ${JSON.stringify(huecos)};
// Género de las que no tienen los dos (255 sin género, 254 solo hembras, 0 solo machos)
export const GENERO_SWSH = ${JSON.stringify(genero)};
`;
writeFileSync(new URL("../js/partida/dex-swsh.js", import.meta.url), texto);
console.log(Object.entries(huecos).map(([k, v]) => `${k}: ${v.filter(Boolean).length}/${v.length}`).join(", "));
