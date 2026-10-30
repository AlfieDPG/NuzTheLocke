// ---------- De la partida a la web ----------
//
// Pasa lo leído de una partida (js/partida/tresds.js) a como lo usa la web: cada Pokémon con
// su especie, su forma (para el retrato de Mundo Misterioso), su nombre en español, su nivel
// y el lugar donde se capturó.

import { cargarPokedex, nombreDeFila } from "../pokedex/datos.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { formasDeTipoDe } from "../comun/formas.js";
import { LUGARES_GEN6, LUGARES_GEN7, OBJETOS_EN, CRECIMIENTO } from "./datos-3ds.js";
import { LUGARES_GEN4, LUGARES_GEN4_OTROS, LUGARES_GEN5, LUGARES_GEN5_OTROS } from "./datos-ds.js";
import { LUGARES_GEN8, LUGARES_BDSP, LUGARES_BDSP_OTROS } from "./datos-switch.js";
import { LUGARES_GEN3, LUGARES_GEN3_EN } from "./datos-gba.js";
import { LUGARES_EN } from "./lugares-en.js";

// Formas que importan (las que cambian el aspecto o los tipos), por el número que les da el
// juego: [id de PokeAPI, nombre en Showdown]. Las que no están (Vivillon, Pikachu con gorra,
// los dominantes...) salen como la normal.
const ALOLA = (id, ...otras) => Object.fromEntries([1, ...otras].map((n) => [n, [id, "Alola"]]));
const GALAR = (id) => ({ 1: [id, "Galar"] });
export const FORMAS = {
  19: ALOLA(10091), 20: ALOLA(10092, 2), 26: ALOLA(10100), 27: ALOLA(10101), 28: ALOLA(10102),
  37: ALOLA(10103), 38: ALOLA(10104), 50: ALOLA(10105), 51: ALOLA(10106), 52: { ...ALOLA(10107), 2: [10161, "Galar"] },
  53: ALOLA(10108), 74: ALOLA(10109), 75: ALOLA(10110), 76: ALOLA(10111), 88: ALOLA(10112),
  89: ALOLA(10113), 103: ALOLA(10114), 105: ALOLA(10115, 2),
  // Galar (Espada / Escudo)
  77: GALAR(10162), 78: GALAR(10163), 79: GALAR(10164), 80: { 2: [10165, "Galar"] }, 83: GALAR(10166),
  110: GALAR(10167), 122: GALAR(10168), 144: GALAR(10169), 145: GALAR(10170), 146: GALAR(10171),
  199: GALAR(10172), 222: GALAR(10173), 263: GALAR(10174), 264: GALAR(10175), 554: GALAR(10176),
  555: { 2: [10177, "Galar"], 3: [10178, "Galar-Zen"] }, 562: GALAR(10179), 618: GALAR(10180),
  849: { 1: [10184, "Low-Key"] },
  875: { 1: [10185, "Noice"] },
  876: { 1: [10186, "F"] },
  888: { 1: [10188, "Crowned"] },
  889: { 1: [10189, "Crowned"] },
  892: { 1: [10191, "Rapid-Strike"] },
  898: { 1: [10193, "Ice"], 2: [10194, "Shadow"] },
  386: { 1: [10001, "Attack"], 2: [10002, "Defense"], 3: [10003, "Speed"] },
  413: { 1: [10004, "Sandy"], 2: [10005, "Trash"] },
  479: { 1: [10008, "Heat"], 2: [10009, "Wash"], 3: [10010, "Frost"], 4: [10011, "Fan"], 5: [10012, "Mow"] },
  487: { 1: [10007, "Origin"] },
  492: { 1: [10006, "Sky"] },
  550: { 1: [10016, "Blue-Striped"] },
  641: { 1: [10019, "Therian"] },
  642: { 1: [10020, "Therian"] },
  645: { 1: [10021, "Therian"] },
  646: { 1: [10022, "White"], 2: [10023, "Black"] },
  647: { 1: [10024, "Resolute"] },
  670: { 5: [10061, "Eternal"] },
  678: { 1: [10025, "F"] },
  718: { 1: [10181, "10%"], 3: [10181, "10%"] },
  720: { 1: [10086, "Unbound"] },
  741: { 1: [10123, "Pom-Pom"], 2: [10124, "Pa'u"], 3: [10125, "Sensu"] },
  745: { 1: [10126, "Midnight"], 2: [10152, "Dusk"] },
  800: { 1: [10155, "Dusk-Mane"], 2: [10156, "Dawn-Wings"] }
};

// Arceus y Silvally: el juego numera sus tipos en el mismo orden que formas.js
const DE_TIPO = { 493: true, 773: true };

const NATURALEZAS = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky"
];

// ---------- Nivel ----------

export function experienciaPara(ritmo, n) {
  // A nivel 1 siempre es 0 (la fórmula del ritmo medio-lento daría -54, que guardado sin signo
  // sería un número enorme: nivel 100)
  if (n <= 1) return 0;
  const cubo = n ** 3;
  switch (ritmo) {
    case 1: return Math.floor((5 * cubo) / 4);
    case 3: return Math.floor((4 * cubo) / 5);
    case 4: return Math.floor((6 * cubo) / 5 - 15 * n * n + 100 * n - 140);
    case 5:
      if (n < 50) return Math.floor((cubo * (100 - n)) / 50);
      if (n < 68) return Math.floor((cubo * (150 - n)) / 100);
      if (n < 98) return Math.floor((cubo * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((cubo * (160 - n)) / 100);
    case 6:
      if (n < 15) return Math.floor((cubo * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((cubo * (n + 14)) / 50);
      return Math.floor((cubo * (Math.floor(n / 2) + 32)) / 50);
    default: return cubo;
  }
}

export function ritmoDe(especie) {
  return Number(CRECIMIENTO[especie - 1]) || 2;
}

export function nivelDe(especie, experiencia) {
  const ritmo = ritmoDe(especie);
  let nivel = 1;
  while (nivel < 100 && experienciaPara(ritmo, nivel + 1) <= experiencia) nivel++;
  return nivel;
}

// ---------- Pokémon ----------

let tablas = null;

// Lo que hace falta tener cargado para convertir: la Pokédex (formas y retratos) y los nombres
export async function prepararConversion() {
  if (!tablas) {
    const [pokedex] = await Promise.all([cargarPokedex(), cargarDatos()]);
    tablas = {
      formas: new Map(pokedex.map((fila) => [fila.clave, fila])),
      especies: new Map(datos.pokemon.map((p) => [p.id, p]))
    };
  }
  return tablas;
}

// Un lugar (en español, como en datos-*.js) en inglés; si no se sabe, el mismo
const GEN_DE = { frlg: 3, dp: 4, platino: 4, hgss: 4, bw: 5, b2w2: 5, xy: 6, oras: 6, sm: 7, usum: 7, swsh: 8 };

export function lugarEnIngles(nombre, juego) {
  if (nombre === "Intercambio") return "Link Trade";
  const tabla = GEN_DE[juego] === 3 ? LUGARES_GEN3_EN : LUGARES_EN[juego === "bdsp" ? "bdsp" : `gen${GEN_DE[juego] || 6}`] || {};
  return tabla[nombre] || nombre;
}

function nombreLugar(gen, numero, juego) {
  if (juego === "bdsp") return numero === 65535 ? "" : LUGARES_BDSP[numero] || LUGARES_BDSP_OTROS[numero] || "";
  if (gen === 3) return LUGARES_GEN3[numero] || "";
  if (gen === 4) return LUGARES_GEN4[numero] || LUGARES_GEN4_OTROS[numero] || "";
  if (gen === 5) return LUGARES_GEN5[numero] || LUGARES_GEN5_OTROS[numero] || "";
  if (numero === 30001 || numero === 30002) return "Intercambio";
  if (gen === 8) return LUGARES_GEN8[numero] || "";
  return (gen === 7 ? LUGARES_GEN7 : LUGARES_GEN6)[numero / 2] || "";
}

// Un Pokémon de la partida tal y como se guarda (sin «undefined»: va a la nube)
function convertir(p, gen, conDetalle, juego) {
  const { formas, especies } = tablas;
  const especie = especies.get(p.especie) || { es: `#${p.especie}`, en: "" };
  const salida = {
    id: p.especie,
    es: especie.es,
    en: especie.en,
    nombre: especie.es,
    mote: p.mote || "",
    genero: p.genero,
    shiny: p.shiny,
    nivel: p.nivel || nivelDe(p.especie, p.experiencia),
    llave: p.llave
  };

  const forma = (FORMAS[p.especie] || {})[p.forma];
  const fila = forma && formas.get(forma[0]);
  if (fila) {
    Object.assign(salida, { idForma: fila.clave, formaPMD: fila.forma, nombre: fila.nombre, nombreEn: nombreDeFila(fila, "en"), showdown: forma[1] });
  } else if (forma) {
    // Una forma que no está en la Pokédex de la web (Meowstic hembra): al menos su nombre
    Object.assign(salida, { idForma: forma[0], showdown: forma[1] });
  } else if (DE_TIPO[p.especie] && p.forma) {
    const deTipo = formasDeTipoDe(p.especie)[p.forma - 1];
    if (deTipo) Object.assign(salida, { formaPMD: deTipo.pmd, imagenForma: deTipo.imagenForma, showdown: deTipo.tipo });
  }

  // De dónde viene: los huevos, de donde se recibieron; los demás, de donde se capturaron
  // (en Perla Reluciente, «sin huevo» es 65535)
  const deHuevo = p.lugarHuevo && !(juego === "bdsp" && p.lugarHuevo === 65535);
  if (!p.huevo && !deHuevo && p.lugar && nombreLugar(gen, p.lugar, juego)) {
    salida.lugar = nombreLugar(gen, p.lugar, juego);
    salida.lugarEn = lugarEnIngles(salida.lugar, juego);
    salida.lugarN = p.lugar;
  }
  if (p.origen) salida.origen = p.origen;
  salida.fecha = p.fechaCaptura;
  if (p.nivelCaptura) salida.nivelCaptura = p.nivelCaptura; // a qué nivel se conoció (la inicial, a 5: ver ./rutas.js)
  if (p.huevo) salida.huevo = true;

  if (conDetalle) {
    Object.assign(salida, {
      ataques: p.ataques, habilidad: p.habilidad, objeto: p.objeto, naturaleza: p.naturaleza,
      evs: p.evs, ivs: p.ivs
    });
  }
  return salida;
}

// La partida entera, lista para guardar: el equipo con todo y las cajas con lo justo
export async function convertirPartida(leida) {
  await prepararConversion();
  return {
    juego: leida.juego,
    version: leida.version,
    entrenador: leida.entrenador,
    medallas: leida.medallas || null,
    abiertas: leida.abiertas,
    equipo: leida.equipo.map((p) => convertir(p, leida.gen, true, leida.juego)),
    cajas: leida.cajas.map((caja) => ({
      nombre: caja.nombre,
      pokemon: caja.pokemon.map((p) => ({ ...convertir(p, leida.gen, false, leida.juego), hueco: p.hueco }))
    }))
  };
}

// Una caja con todo, como el equipo (lo guardado de las cajas va con lo justo): para exportarla.
// leida: la partida recién leída del archivo (formatoDe(bytes).leer(bytes))
export async function cajaConDetalle(leida, posicion) {
  await prepararConversion();
  const caja = leida.cajas[posicion];
  return caja ? caja.pokemon.map((p) => convertir(p, leida.gen, true, leida.juego)) : [];
}

// Todos los Pokémon de la partida con todo, el equipo y cada caja (para «Buscar equipo»)
export async function todoConDetalle(leida) {
  await prepararConversion();
  return {
    equipo: leida.equipo.map((p) => convertir(p, leida.gen, true, leida.juego)),
    cajas: leida.cajas.map((caja) => caja.pokemon.map((p) => convertir(p, leida.gen, true, leida.juego)))
  };
}

// ---------- Paste de Showdown (para «Copiar a Mis equipos» y exportar una caja) ----------
//
// Los de las cajas guardadas no llevan ataques, habilidad, naturaleza, EVs ni IVs: salen sin
// esas líneas (Showdown pone las de siempre).

const STATS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];

export function pasteDeEquipo(equipo) {
  const { especies } = tablas;
  const habilidad = (id) => (datos.habilidades.find((h) => h.id === id) || {}).en || "";
  const ataque = (id) => (datos.ataques.find((a) => a.id === id) || {}).en || "";

  return equipo
    .filter((p) => !p.huevo)
    .map((p) => {
      const en = (especies.get(p.id) || {}).en || "";
      const nombre = p.showdown ? `${en}-${p.showdown.charAt(0).toUpperCase()}${p.showdown.slice(1)}` : en;
      const objeto = OBJETOS_EN[p.objeto] || "";
      const lineas = [
        `${p.mote ? `${p.mote} (${nombre})` : nombre}${p.genero ? ` (${p.genero})` : ""}${objeto ? ` @ ${objeto}` : ""}`,
        habilidad(p.habilidad) && `Ability: ${habilidad(p.habilidad)}`,
        `Level: ${p.nivel}`,
        p.shiny && "Shiny: Yes",
        (p.evs || []).some(Boolean) && `EVs: ${p.evs.map((v, i) => v && `${v} ${STATS[i]}`).filter(Boolean).join(" / ")}`,
        NATURALEZAS[p.naturaleza] && `${NATURALEZAS[p.naturaleza]} Nature`,
        p.ivs && `IVs: ${p.ivs.map((v, i) => `${v} ${STATS[i]}`).join(" / ")}`,
        ...(p.ataques || []).map((id) => ataque(id) && `- ${ataque(id)}`)
      ];
      return lineas.filter(Boolean).join("\n");
    })
    .join("\n\n");
}
