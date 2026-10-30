// ---------- Cómo se ve cada partida en «Jugar»: su portada, su color y su resumen ----------
//
// La portada es el Pokémon de la carátula del juego (en retrato de Mundo Misterioso, como en el resto de la web) y el
// color, uno por juego: así se distinguen de un vistazo. La versión exacta (Rojo Fuego o Verde Hoja, Negro o Blanco...)
// sale de la partida guardada; sin ella, la del juego.
//
// El resumen (equipo y medallas) también sale de la partida guardada de cada una, y se guarda mientras no cambie.

import { savDe } from "./partidas.js";
import { prepararGBA, esPartidaGBA, leerPartidaGBA } from "../partida/gba.js";
import { esPartidaDS, leerPartidaDS } from "../partida/nds.js";
import { convertirPartida } from "../partida/convertir.js";

// Versión -> [Pokémon de la carátula, color]
const DE_VERSION = {
  "Rojo Fuego": [6, "#e8743b"], "Verde Hoja": [3, "#6fb35a"],
  Diamante: [483, "#6f93d8"], Perla: [484, "#d98fb0"], Platino: [487, "#a7b0c2"],
  HeartGold: [250, "#d9a93a"], SoulSilver: [249, "#aab6c8"],
  Negro: [643, "#8d93a3"], Blanco: [644, "#d6d6d6"], "Negro 2": [646, "#6f86c0"], "Blanco 2": [646, "#d3a4ae"]
};
const DE_JUEGO = { frlg: "Rojo Fuego", dp: "Diamante", platino: "Platino", hgss: "HeartGold", bw: "Negro", b2w2: "Negro 2" };
const GEN_DE = { frlg: 3, dp: 4, platino: 4, hgss: 4, bw: 5, b2w2: 5 };

// { especie, color } de una partida (de la lista) con su resumen, si lo hay
export function portadaDe(p, resumen) {
  const [especie, color] = DE_VERSION[resumen && resumen.version] || DE_VERSION[DE_JUEGO[p.juego || "frlg"]];
  return { especie, color };
}

const resumenes = new Map(); // id -> { cuando (la partida guardada que se leyó), resumen }

// { version, medallas: [bool], equipo: [convertidos, con ps y psMax] } de la última partida guardada, o null
export async function resumenDe(p) {
  const guardado = resumenes.get(p.id);
  if (guardado && guardado.cuando === (p.guardada || p.jugada || 0)) return guardado.resumen;
  let resumen = null;
  try {
    const sav = await savDe(p.id);
    const consola = p.consola || "gba";
    if (sav && (consola === "nds" ? esPartidaDS(sav) : esPartidaGBA(sav))) {
      if (consola === "gba") await prepararGBA();
      const leida = consola === "nds" ? leerPartidaDS(sav) : leerPartidaGBA(sav);
      const { equipo } = await convertirPartida({ juego: leida.juego, gen: GEN_DE[leida.juego], equipo: leida.equipo, cajas: [] });
      resumen = {
        version: leida.version,
        medallas: leida.medallas || [],
        equipo: equipo.map((x, i) => ({ ...x, ps: leida.equipo[i].ps, psMax: leida.equipo[i].psMax }))
      };
    }
  } catch (error) {
    console.error(error);
  }
  resumenes.set(p.id, { cuando: p.guardada || p.jugada || 0, resumen });
  return resumen;
}

export const olvidarResumen = (id) => resumenes.delete(id);
