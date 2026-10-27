// La caja de la partida de un locke para «Buscar equipo» (./buscar.js): sus Pokémon vivos como
// los de «Crear equipo», con lo justo para analizarlos, y los objetos de su mochila. Sin pedir
// nada a PokeAPI (pueden ser cientos): con la Pokédex, los nombres y los ataques que lleva la web.
//
// Con el archivo de la partida sale todo (habilidad, ataques, objeto, naturaleza, EVs e IVs) y
// la mochila. Sin él, lo guardado de la partida: el equipo con todo y, de las cajas, solo la
// especie y el nivel (js/partida/convertir.js).

import { cargarPokedex } from "../pokedex/datos.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { cargarAtaques } from "../calculadora/ataques.js";
import { clave } from "../calculadora/danio.js";
import { partidaDe, cajasMuertosDe } from "../partida/partidas.js";
import { formatoDeSeguro } from "../partida/formato.js";
import { todoConDetalle } from "../partida/convertir.js";
import { OBJETOS_EN } from "../partida/datos-3ds.js";
import { NATURALEZAS } from "./entreno.js";

const CATEGORIAS = { fisico: "Físico", especial: "Especial" };

let tablas = null;

async function prepararTablas() {
  if (!tablas) {
    const [pokedex, ataques] = await Promise.all([cargarPokedex(), cargarAtaques(), cargarDatos()]);
    tablas = {
      pokedex: new Map(pokedex.map((fila) => [fila.clave, fila])),
      ataques,
      nombresAtaques: new Map(datos.ataques.map((a) => [a.id, a])),
      habilidades: new Map(datos.habilidades.map((h) => [h.id, h])),
      objetos: new Map(datos.objetos.map((o) => [clave(o.en), o]))
    };
  }
  return tablas;
}

// Un objeto de la partida (su número en el juego) como los de la web: { id, es, en }
function objetoDe(numero) {
  const en = numero && OBJETOS_EN[numero];
  if (!en) return null;
  return tablas.objetos.get(clave(en)) || { id: 0, es: en, en };
}

// Un Pokémon de la partida (como los deja js/partida/convertir.js) como los de «Crear equipo».
// En «partida» va tal cual, para pasarlo luego a «Crear equipo» con todo (pasteDeEquipo).
function pokemonDe(p) {
  const fila = tablas.pokedex.get(p.idForma) || tablas.pokedex.get(p.id);
  if (!fila || p.huevo) return null;
  const ataques = [0, 1, 2, 3].map((i) => {
    const id = (p.ataques || [])[i];
    if (!id) return null;
    const nombres = tablas.nombresAtaques.get(id) || { es: `#${id}`, en: "" };
    const suyo = tablas.ataques.get(id);
    return { id, es: nombres.es, en: nombres.en, tipo: suyo ? suyo.tipo : "", categoria: suyo ? CATEGORIAS[suyo.clase] : "" };
  });
  const naturaleza = NATURALEZAS[p.naturaleza];
  return {
    id: p.id,
    idForma: p.idForma,
    formaPMD: p.formaPMD,
    imagenForma: p.imagenForma,
    es: p.nombre || p.es,
    en: p.nombreEn || p.en,
    mote: p.mote || null,
    shiny: Boolean(p.shiny),
    genero: p.genero || "",
    tipos: fila.tipos,
    stats: fila.bases,
    habilidad: (p.habilidad && tablas.habilidades.get(p.habilidad)) || null,
    objeto: objetoDe(p.objeto),
    ataques,
    entreno: {
      nivel: p.nivel || 50,
      ...(naturaleza ? { naturaleza: naturaleza.id } : {}),
      ...(p.evs ? { evs: p.evs } : {}),
      ...(p.ivs ? { ivs: p.ivs } : {})
    },
    conDetalle: Boolean(p.ataques), // sin él, de las cajas guardadas: solo especie y nivel
    partida: p
  };
}

// Lo que hay en la mochila, como lo quiere sugerirMejoras: [{ objeto, cantidad, mochila: true }]
function objetosDeLaMochila(mochila) {
  const juntos = new Map();
  for (const lista of Object.values(mochila)) {
    for (const { objeto, cantidad } of lista) {
      const suyo = objetoDe(objeto);
      if (!suyo) continue;
      const k = clave(suyo.en);
      juntos.set(k, { objeto: suyo, cantidad: ((juntos.get(k) || {}).cantidad || 0) + cantidad, mochila: true });
    }
  }
  return [...juntos.values()];
}

// Los Pokémon vivos de la partida de un locke (el equipo y las cajas, menos las de los muertos y
// los huevos) y su mochila. bytes: el archivo de la partida (null: lo guardado de ella).
//   -> { pokemon, conDetalle (si salen con todo), mochila: [{ objeto, cantidad, mochila }] | null }
export async function cajaDeLaPartida(idLocke, bytes) {
  await prepararTablas();
  const guardada = partidaDe(idLocke);
  const muertos = new Set(cajasMuertosDe(guardada));
  let equipo;
  let cajas;
  let mochila = null;
  if (bytes) {
    const formato = formatoDeSeguro(bytes);
    ({ equipo, cajas } = await todoConDetalle(formato.leer(bytes)));
    try {
      mochila = objetosDeLaMochila(formato.mochila.leerMochila(bytes));
    } catch (error) {
      // un juego en el que todavía no se lee la mochila: se sugieren los objetos habituales
    }
  } else {
    equipo = guardada ? guardada.equipo : [];
    cajas = guardada ? guardada.cajas.map((caja) => caja.pokemon) : [];
  }
  const vivos = [...equipo, ...cajas.filter((_, i) => !muertos.has(i)).flat()];
  return { pokemon: vivos.map(pokemonDe).filter(Boolean), conDetalle: Boolean(bytes), mochila };
}
