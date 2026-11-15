// ---------- Pokémon, ataques y habilidades propios de un fangame ----------
//
// Pokémon Añil tiene dos Pokémon que no existen en los juegos (Royaleon y Cefireon, evoluciones de
// Eevee), 5 ataques (Escalofrío...) y 18 habilidades (Acometida...). Para que se vean y se puedan
// usar en la web van en las mismas listas de nombres que los demás (datos.pokemon, datos.ataques y
// datos.habilidades, de ./datos.js), con:
//   · un número propio: los Pokémon desde el 20001 y los ataques y habilidades desde el 30001;
//   · propio: "anil" (de qué juego son) y lo que trae su juego (descripcion; los ataques, tipo,
//     clase, potencia, precision y pp; los Pokémon, tipos, estadísticas, habilidades...).
// Salen de datos/propios-anil.json (lo hace herramientas/generar-anil.mjs).
//
// Como no están en PokeAPI, pedirJSON (./api.js) no los pide fuera: pokeapiPropio() responde lo
// mismo que respondería PokeAPI (pokemon/20001, pokemon-species/20001, move/30001, ability/30001),
// sacado de ese archivo. Así el creador de equipos y lo demás los tratan como a cualquier otro.
// Sus imágenes son los dibujos del juego (img/anil/, acreditados en legal.html): no tienen retrato
// de Mundo Misterioso ni arte oficial (./imagenes.js los usa en su lugar).
//
// En «Combates» hacen lo mismo que en el juego (js/lucha/propios.js). Fuera de la web (Showdown) no
// existen: los ataques y habilidades no salen en el paste de una partida (salvo para «Combates»).
// En la Pokédex no salen (no tienen retrato de Mundo Misterioso).
//
// OJO: el número de cada uno sale del orden de los archivos del juego; si se regenera con otra
// versión de Añil, comprobar que no cambian (los guardados en las partidas y los equipos los usan).

import { quitarAcentos } from "./utilidades.js";

export const PRIMER_PROPIO = 30001;
export const PRIMERA_ESPECIE_PROPIA = 20001;

const JUEGOS = { anil: "Pokémon Añil" };
const URL_ANIL = new URL("../../datos/propios-anil.json", import.meta.url);
const URL_API = "https://pokeapi.co/api/v2/";

// Los dibujos de cada Pokémon propio (img/anil/<nombre>.png, -shiny, -espalda, -icono; .webp, animados)
const IMAGENES = { 20001: "royaleon", 20002: "cefireon" };

export function esPropio(id) {
  return Number(id) >= PRIMER_PROPIO;
}

export function esEspeciePropia(id) {
  return Number(id) >= PRIMERA_ESPECIE_PROPIA && Number(id) < PRIMER_PROPIO;
}

// Una imagen de un Pokémon propio: tipo "" (de frente), "espalda" o "icono"; animada: la .webp
export function imagenPropia(id, { shiny = false, tipo = "", animada = false } = {}) {
  const nombre = IMAGENES[id];
  if (!nombre) return "";
  const archivo = `${nombre}${tipo ? `-${tipo}` : ""}${shiny ? "-shiny" : ""}.${animada ? "webp" : "png"}`;
  return new URL(`../../img/anil/${archivo}`, import.meta.url).href;
}

// El nombre del juego del que es («Pokémon Añil»), o ""
export function juegoDelPropio(entrada) {
  return (entrada && JUEGOS[entrada.propio]) || "";
}

let archivo = null; // promesa con datos/propios-anil.json (o null si falta)

function cargarArchivo() {
  if (!archivo) {
    archivo = fetch(URL_ANIL)
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .catch(() => null); // sin conexión: no se ven, como antes
  }
  return archivo;
}

// Los mete en las listas de nombres (las de ./datos.js, ya cargadas). Si falta el archivo, nada.
export async function anadirPropios(datos) {
  const propios = await cargarArchivo();
  if (!propios) return;
  const meter = (lista, nuevos) => {
    const ya = new Set(lista.map((entrada) => entrada.id));
    for (const nuevo of nuevos) {
      if (ya.has(nuevo.id)) continue;
      lista.push({ ...nuevo, en: nuevo.es, propio: "anil", buscar: quitarAcentos(nuevo.es) });
    }
  };
  meter(datos.ataques, propios.ataques || []);
  meter(datos.habilidades, propios.habilidades || []);
  meter(datos.pokemon, propios.pokemon || []);
}

// La descripción del juego de un ataque o habilidad propio (lista: datos.ataques o datos.habilidades)
export function descripcionPropia(lista, id) {
  const entrada = (lista || []).find((cada) => cada.id === id);
  return (entrada && entrada.descripcion) || "";
}

// ---------- Lo que respondería PokeAPI ----------

const RECURSO = /\/api\/v2\/(pokemon|pokemon-species|move|ability)\/([^/?#]+)\/?$/;

// ¿Es una dirección de PokeAPI de algo propio? (para que ./api.js no la pida fuera)
export function esUrlPropia(url) {
  const partes = RECURSO.exec(String(url));
  if (!partes) return false;
  const [, recurso, clave] = partes;
  if (recurso === "pokemon" || recurso === "pokemon-species") return esEspeciePropia(clave) || Object.values(IMAGENES).includes(clave);
  return esPropio(clave);
}

const slug = (texto) => quitarAcentos(String(texto)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const CLASES = { fisico: "physical", especial: "special", estado: "status" };
const texto = (descripcion) => [{ flavor_text: descripcion, language: { name: "es" }, version_group: { name: "scarlet-violet" } }];

export async function pokeapiPropio(url) {
  const propios = await cargarArchivo();
  const [, recurso, clave] = RECURSO.exec(String(url));
  if (!propios) throw new Error("Error 404");
  const { datos } = await import("./datos.js");
  const nombreDe = (lista, id) => ((datos && datos[lista].find((cada) => cada.id === id)) || {}).en || String(id);

  if (recurso === "move" || recurso === "ability") {
    const lista = recurso === "move" ? propios.ataques : propios.habilidades;
    const p = (lista || []).find((cada) => cada.id === Number(clave));
    if (!p) throw new Error("Error 404");
    const comun = { id: p.id, name: slug(p.es), names: [{ name: p.es, language: { name: "es" } }], flavor_text_entries: texto(p.descripcion), effect_entries: [] };
    if (recurso === "ability") return comun;
    return {
      ...comun, type: { name: p.tipo }, power: p.potencia || null, accuracy: p.precision || null, pp: p.pp || 1, priority: 0,
      damage_class: { name: CLASES[p.clase] || "status" }, target: { name: "selected-pokemon" }, meta: null
    };
  }

  const p = (propios.pokemon || []).find((cada) => cada.id === Number(clave) || IMAGENES[cada.id] === clave);
  if (!p) throw new Error("Error 404");
  const nombre = IMAGENES[p.id] || slug(p.es);
  if (recurso === "pokemon-species") {
    return {
      id: p.id, name: nombre, names: [{ name: p.es, language: { name: "es" } }],
      gender_rate: p.hembra === 255 ? -1 : Math.round((p.hembra * 8) / 254),
      has_gender_differences: false, base_happiness: p.felicidad, hatch_counter: p.ciclos,
      is_baby: false, is_legendary: false, is_mythical: false, generation: { name: "generation-ix" },
      genera: [{ genus: p.categoria, language: { name: "es" } }],
      flavor_text_entries: texto(p.pokedex),
      evolves_from_species: p.evoluciona[0] ? { name: "eevee", url: `${URL_API}pokemon-species/${p.evoluciona[0]}/` } : null,
      varieties: [{ is_default: true, pokemon: { name: nombre, url: `${URL_API}pokemon/${p.id}/` } }]
    };
  }
  const imagen = (opciones) => imagenPropia(p.id, opciones);
  const habilidad = (id, oculta, slot) => ({ ability: { name: slug(nombreDe("habilidades", id)), url: `${URL_API}ability/${id}/` }, is_hidden: oculta, slot });
  const ataque = (id, nivel, metodo) => ({
    move: { name: slug(nombreDe("ataques", id)), url: `${URL_API}move/${id}/` },
    version_group_details: [{ level_learned_at: nivel, move_learn_method: { name: metodo }, version_group: { name: "scarlet-violet" } }]
  });
  return {
    id: p.id, name: nombre, height: Math.round(p.altura * 10), weight: Math.round(p.peso * 10), is_default: true,
    species: { name: nombre, url: `${URL_API}pokemon-species/${p.id}/` },
    types: p.tipos.map((tipo, i) => ({ slot: i + 1, type: { name: tipo } })),
    stats: STATS.map((stat, i) => ({ base_stat: p.bases[i], effort: 0, stat: { name: stat } })),
    abilities: [...p.habilidades.map((id, i) => habilidad(id, false, i + 1)), ...p.ocultas.map((id) => habilidad(id, true, 3))],
    moves: [...p.nivel.map(([nivel, id]) => ataque(id, nivel, "level-up")), ...p.mt.map((id) => ataque(id, 0, "machine"))],
    sprites: {
      front_default: imagen(), front_shiny: imagen({ shiny: true }),
      back_default: imagen({ tipo: "espalda" }), back_shiny: imagen({ tipo: "espalda", shiny: true }),
      other: {
        "official-artwork": { front_default: imagen(), front_shiny: imagen({ shiny: true }) },
        showdown: { front_default: imagen({ animada: true }), front_shiny: imagen({ animada: true, shiny: true }) }
      },
      versions: { "generation-viii": { icons: { front_default: imagen({ tipo: "icono" }) } } }
    }
  };
}
