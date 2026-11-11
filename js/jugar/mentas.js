// ---------- Las mentas en las partidas de «Jugar» ----------
//
// Las mentas (js/randomizer/mentas-gba.js en Rojo Fuego / Verde Hoja, mentas-gen4.js y mentas-gen5.js en DS) solo
// funcionan si la ROM las tiene. Desde «Editar» se pueden meter en cualquier partida, así que si la partida lleva alguna
// y su ROM no las tiene (sin randomizar, o randomizada sin «Mentas»), se le ponen a la ROM guardada: solo se rellenan
// huecos sin usar de la tabla de objetos, espacio libre y, en DS, el final de la ITCM, así que la partida sigue valiendo
// igual. (No se venden ni salen por el camino: solo las que metas.)
//
// consola: «gba» o «nds» (en DS, la 4.ª y la 5.ª generación)

import { PRIMERA_MENTA_GEN3, PRIMERA_MENTA_WEB, MENTAS } from "../partida/datos-gba.js";

const TAM_OBJETO = 44;
const HUECO_SIN_USAR = 52; // uno de los objetos que no existen en Rojo Fuego (las mentas no van ahí)

const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const esMenta = (id) => id >= PRIMERA_MENTA_WEB && id < PRIMERA_MENTA_WEB + MENTAS;

// ¿Tiene ya la ROM las mentas?
export async function romConMentas(bytes, consola) {
  if (consola === "nds") {
    const [{ RomNDS }, { mentasYaPuestasGen4 }, { mentasYaPuestasGen5 }] = await Promise.all([
      import("../randomizer/rom-nds.js"), import("../randomizer/mentas-gen4.js"), import("../randomizer/mentas-gen5.js")
    ]);
    try {
      const rom = new RomNDS(bytes.slice());
      return mentasYaPuestasGen4(rom) || mentasYaPuestasGen5(rom);
    } catch (error) {
      return false;
    }
  }
  // Rojo Fuego: si no las tiene, su hueco es igual que uno sin usar
  const tabla = u32(bytes, 0x1c8) - 0x08000000;
  const menta = tabla + PRIMERA_MENTA_GEN3 * TAM_OBJETO;
  const vacio = tabla + HUECO_SIN_USAR * TAM_OBJETO;
  if (tabla < 0 || menta + TAM_OBJETO > bytes.length) return false;
  for (let k = 0; k < TAM_OBJETO; k++) if (bytes[menta + k] !== bytes[vacio + k]) return true;
  return false;
}

// ¿Lleva la partida alguna menta (en la bolsa o equipada a un Pokémon)?
export async function partidaConMentas(sav, consola) {
  try {
    let bolsa;
    let partida;
    if (consola === "nds") {
      const [{ leerMochilaDS }, { leerPartidaDS }] = await Promise.all([import("../partida/mochilads.js"), import("../partida/nds.js")]);
      bolsa = leerMochilaDS(sav);
      partida = leerPartidaDS(sav);
    } else {
      const [{ leerMochilaGBA }, { leerPartidaGBA }] = await Promise.all([import("../partida/mochilagba.js"), import("../partida/gba.js")]);
      bolsa = leerMochilaGBA(sav);
      partida = leerPartidaGBA(sav);
    }
    if (Object.values(bolsa).some((lista) => lista.some((e) => esMenta(e.objeto)))) return true;
    return [...partida.equipo, ...partida.cajas.flatMap((caja) => caja.pokemon)].some((p) => esMenta(p.objeto));
  } catch (error) {
    return false; // todavía sin partida guardada (o un juego sin bolsa que se sepa leer)
  }
}

// La ROM con las mentas (otra copia), o null si no se pueden poner (otra versión)
export async function ponerMentasEnRom(bytes, consola) {
  try {
    if (consola === "nds") {
      const [{ RomNDS }, { esGen4 }] = await Promise.all([import("../randomizer/rom-nds.js"), import("../randomizer/juego-gen4-ident.js")]);
      const rom = new RomNDS(bytes.slice());
      if (esGen4(rom)) {
        const gen4 = await import("../randomizer/juego-gen4.js");
        if (!gen4.perfilDe(rom) || !gen4.ponerMentas(rom)) return null;
      } else {
        const [gen5, { perfilDe }] = await Promise.all([import("../randomizer/juego-gen5.js"), import("../randomizer/perfiles-gen5.js")]);
        if (!perfilDe(rom) || !gen5.ponerMentas(rom)) return null;
      }
      return rom.bytes;
    }
    const [{ RomGBA }, { ponerMentas }] = await Promise.all([import("../randomizer/rom-gba.js"), import("../randomizer/juego-gba.js")]);
    const copia = bytes.slice();
    return ponerMentas(new RomGBA(copia)) ? copia : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
