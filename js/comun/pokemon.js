import { datos } from "./datos.js";
import { esPropio, descripcionPropia } from "./propios.js";
import { pedirJSON, URL_API } from "./api.js";
import { etiquetaForma, obtenerVariedades, formaDeTipo } from "./formas.js";
import { indicePMD } from "./formas-pmd.js";
import { t, enIngles } from "./idioma.js";
import { TIPOS_EN } from "./tipos.js";

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";

// Datos de PokeAPI de una variedad por su nombre ("persian-alola", "arceus-fire"...).
// Las formas de tipo de Arceus y Silvally no existen como Pokémon en PokeAPI: se pide el
// Pokémon base y se le cambia el tipo, que es lo único que cambia (las estadísticas no).
export async function pedirVariedad(slug) {
  const deTipo = formaDeTipo(slug);
  if (!deTipo) return pedirJSON(`${URL_API}pokemon/${slug}`);

  const base = await pedirJSON(`${URL_API}pokemon/${deTipo.especie}`);
  return {
    ...base,
    name: slug,
    types: [{ slot: 1, type: { name: deTipo.tipo } }],
    formaDeTipo: deTipo
  };
}

// Icono estilo HOME/Switch (el mismo que se usa en Espada/Escudo y versiones posteriores)
function obtenerSpriteIcono(p) {
  const v = p.sprites.versions || {};
  const gen8 = v["generation-viii"] && v["generation-viii"].icons && v["generation-viii"].icons.front_default;
  const gen7 = v["generation-vii"] && v["generation-vii"].icons && v["generation-vii"].icons.front_default;
  return gen8 || gen7 || p.sprites.front_default;
}

// La de un ataque: en español (si no hay, la de inglés) o en inglés
function extraerDescripcion(m, idioma = "es") {
  const limpio = (texto) => (texto || "").replace(/[\n\f\r]+/g, " ").trim();
  if (idioma === "es") {
    const es = (m.flavor_text_entries || []).find((e) => e.language.name === "es");
    if (es) return limpio(es.flavor_text);
  } else {
    const textos = (m.flavor_text_entries || []).filter((e) => e.language.name === "en");
    if (textos.length) return limpio(textos[textos.length - 1].flavor_text);
  }

  const en = (m.effect_entries || []).find((e) => e.language.name === "en");
  if (en) return limpio(en.short_effect || en.effect);

  return "";
}

// Las descripciones de habilidades y objetos se guardan en el equipo, cada idioma en su campo
export const CAMPO_DESCRIPCION = enIngles ? "descripcionEn" : "descripcion";

// Texto más reciente de una lista de PokeAPI (objetos usan «text»; el resto, «flavor_text»).
// En el idioma de la web; si no lo hay (objetos y habilidades muy nuevos), en inglés.
function textoReciente(entradas, idiomas = enIngles ? ["en"] : ["es", "en"]) {
  for (const idioma of idiomas) {
    const textos = (entradas || []).filter((e) => e.language.name === idioma);
    const ultima = textos[textos.length - 1];
    if (ultima) return (ultima.text || ultima.flavor_text || "").replace(/[\n\f\r]+/g, " ").trim();
  }
  return "";
}

// Habilidades: PokeAPI no tiene texto en español de las de 9.ª generación en adelante
// (Hospitalidad, Paleosíntesis...). Para esas, el «Efecto» de su página de WikiDex, resumido
// (datos/descripciones-habilidades.json: { id: texto }).
const URL_HABILIDADES_ES = new URL("../../datos/descripciones-habilidades.json", import.meta.url);
let habilidadesEs = null; // se descarga una sola vez y solo si hace falta

export async function descripcionHabilidad(id) {
  if (esPropio(id)) return descripcionPropia(datos && datos.habilidades, id);
  const entradas = (await pedirJSON(`${URL_API}ability/${id}`)).flavor_text_entries;
  if (!enIngles && !(entradas || []).some((e) => e.language.name === "es")) {
    if (!habilidadesEs) {
      habilidadesEs = fetch(URL_HABILIDADES_ES)
        .then((respuesta) => (respuesta.ok ? respuesta.json() : {}))
        .catch(() => ({}));
    }
    const texto = (await habilidadesEs)[id];
    if (texto) return texto;
  }
  return textoReciente(entradas);
}

// Objetos: PokeAPI no tiene texto en español de muchos objetos de los juegos de Switch
// (Dado Trucado, Energía Potenciadora...). Para esos se usan las descripciones de WikiDex
// (datos/descripciones-objetos.json, sacado de su «Lista de objetos»). Si tampoco está ahí,
// la de PokeAPI o Pokémon Showdown en inglés.
const URL_WIKIDEX = new URL("../../datos/descripciones-objetos.json", import.meta.url);
let textosWikidex = null; // se descarga una sola vez y solo si hace falta

async function descripcionWikidex(nombreIngles) {
  if (!textosWikidex) {
    textosWikidex = fetch(URL_WIKIDEX)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  const clave = nombreIngles.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (await textosWikidex)[clave] || "";
}

const URL_TEXTOS_SHOWDOWN = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/items.ts";
let textosShowdown = null; // se descarga una sola vez y solo si hace falta

async function descripcionShowdown(nombreIngles) {
  if (!textosShowdown) {
    textosShowdown = fetch(URL_TEXTOS_SHOWDOWN)
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
  }
  const texto = await textosShowdown;

  // Cada objeto es un bloque "\tloadeddice: { ... \t}," con su shortDesc (o desc)
  const clave = nombreIngles.toLowerCase().replace(/[^a-z0-9]/g, "");
  const inicio = texto.indexOf(`\n\t${clave}: {`);
  if (inicio < 0) return "";
  const bloque = texto.slice(inicio, texto.indexOf("\n\t},", inicio));
  const encontrado = bloque.match(/shortDesc: "((?:[^"\\]|\\.)*)"/) || bloque.match(/desc: "((?:[^"\\]|\\.)*)"/);
  return encontrado ? encontrado[1].replace(/\\(.)/g, "$1") : "";
}

export async function descripcionObjeto(objeto) {
  const entradas = (await pedirJSON(`${URL_API}item/${objeto.id}`)).flavor_text_entries;
  if (enIngles) return textoReciente(entradas, ["en"]) || descripcionShowdown(objeto.en);
  return (
    textoReciente(entradas, ["es"]) ||
    (await descripcionWikidex(objeto.en)) ||
    textoReciente(entradas, ["en"]) ||
    descripcionShowdown(objeto.en)
  );
}

// La descripción de un ataque en el idioma de la web (para los guardados antes de tenerla)
export async function descripcionAtaque(id) {
  if (esPropio(id)) return descripcionPropia(datos && datos.ataques, id);
  return extraerDescripcion(await pedirJSON(`${URL_API}move/${id}`), enIngles ? "en" : "es");
}

// Se guardan en español; para enseñarlas, t(categoria)
const CATEGORIAS = { physical: "Físico", special: "Especial", status: "Estado" };

function datosCombate(m) {
  return {
    potencia: m.power || null,
    precision: m.accuracy || null,
    categoria: CATEGORIAS[m.damage_class && m.damage_class.name] || ""
  };
}

// Potencia, precisión y categoría (para los ataques añadidos antes de guardarlas)
export async function obtenerDatosCombate(ataque) {
  return datosCombate(await pedirJSON(`${URL_API}move/${ataque.id}`));
}

// Forma para mostrar junto al nombre: nada si es la forma normal. Se guarda en español
// («Forma Alola», «Tipo Fuego»); en inglés se saca del slug de la forma.
export function textoForma(poke) {
  if (!poke.forma || poke.forma === "Forma Normal") return null;
  if (!enIngles || !poke.formaSlug) return poke.forma;
  if (poke.imagenForma) return t("Tipo {tipo}", { tipo: TIPOS_EN[poke.formaSlug] || poke.formaSlug });
  const especie = String(poke.en || "x").toLowerCase();
  return t("Forma {forma}", { forma: etiquetaForma(`${especie}-${poke.formaSlug}`, especie, "en") });
}

// Stats base en este orden: PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad
const ORDEN_STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

function statsBase(p) {
  return ORDEN_STATS.map((nombre) => {
    const s = p.stats.find((x) => x.stat.name === nombre);
    return s ? s.base_stat : 0;
  });
}

// Stats base de un Pokémon del equipo (para los que se añadieron antes de guardarlas)
export async function obtenerStats(poke) {
  const p = await pedirJSON(`${URL_API}pokemon/${poke.idForma || poke.id}`);
  return statsBase(p);
}

// ---------- Género ----------
//
// Cada Pokémon del equipo puede llevar «genero»: "M", "F" o "" (sin decir). De la especie se
// apuntan «generoRatio» (el gender_rate de PokeAPI: -1 sin género, 0 siempre macho, 8 siempre
// hembra, lo demás de los dos) y «difGenero» (si la hembra se ve distinta: entonces sus
// imágenes son las de hembra, ver imagenes.js).

export async function datosDeGenero(idEspecie) {
  const sp = await pedirJSON(`${URL_API}pokemon-species/${idEspecie}`);
  return { generoRatio: sp.gender_rate, difGenero: Boolean(sp.has_gender_differences) };
}

// Los géneros que puede tener: [], ["M"], ["F"] o ["M", "F"]. Las formas que son de un
// género (Meowstic hembra, «female-mega»...) solo pueden ser de ese.
export function generosPosibles(poke) {
  const trozos = String(poke.formaSlug || "").split("-");
  if (trozos.includes("female")) return ["F"];
  // Pyroar es la excepción: PokeAPI solo tiene «pyroar-male», pero también hay hembras
  if (trozos.includes("male") && poke.id !== 668) return ["M"];
  const ratio = poke.generoRatio;
  if (ratio === undefined || ratio === null) return ["M", "F"];
  if (ratio < 0) return [];
  if (ratio === 0) return ["M"];
  if (ratio === 8) return ["F"];
  return ["M", "F"];
}

// El que tiene de verdad: si solo puede ser uno, ese, aunque no se haya elegido
export function generoDe(poke) {
  const posibles = generosPosibles(poke);
  if (posibles.length === 1) return posibles[0];
  return posibles.includes(poke.genero) ? poke.genero : "";
}

// Icono de js/comun/iconos.js (los caracteres ♂ y ♀ salen muy finos)
export const ICONO_GENERO = { M: "macho", F: "hembra" };
export const NOMBRE_GENERO = { M: t("Macho"), F: t("Hembra") };

// Lo justo de un Pokémon para pintarlo en otra parte (Versus, el perfil...). JSON de ida y
// vuelta en quien lo guarde: Firestore no acepta «undefined».
export function pokemonParaCopia(p) {
  return {
    id: p.id, idForma: p.idForma, formaPMD: p.formaPMD, imagenForma: p.imagenForma,
    shiny: Boolean(p.shiny), es: p.es, en: p.en || "", mote: p.mote || "", sprite: p.sprite || "",
    genero: generoDe(p), difGenero: Boolean(p.difGenero)
  };
}

// Crea el Pokémon del equipo a partir de los datos de PokeAPI
export async function pokemonDesdeAPI(p, entrada) {
  const genero = await datosDeGenero(entrada.id).catch(() => ({}));
  if (p.formaDeTipo) return { ...pokemonDeTipo(p, entrada), ...genero, genero: "" };

  const imagen =
    (p.sprites.other &&
      p.sprites.other["official-artwork"] &&
      p.sprites.other["official-artwork"].front_default) ||
    p.sprites.front_default ||
    "";

  let info = { especie: "", lista: [] };
  try {
    info = await obtenerVariedades(entrada.id);
  } catch (error) {
    // sin información de formas: se trata como forma normal
  }
  const posicion = info.lista.indexOf(p.name);
  // Solo se guarda la forma si no es la normal (Alola, Mega, Galar...)
  const etiqueta = info.lista.length > 1 && posicion >= 0 ? etiquetaForma(p.name, info.especie, "es") : "Normal";

  // Lo que PokeAPI le añade al nombre de la especie ("meowstic-female-mega" -> "female-mega").
  // Hace falta para exportar el equipo con el nombre que entiende Showdown.
  const sufijoForma =
    info.especie && p.name.startsWith(info.especie + "-") ? p.name.slice(info.especie.length + 1) : "";

  return {
    id: entrada.id,
    idForma: p.id,
    formaSlug: sufijoForma,
    es: entrada.es,
    en: entrada.en,
    mote: null,
    imagen: imagen,
    sprite: obtenerSpriteIcono(p) || imagen,
    shiny: false,
    genero: "",
    ...genero,
    forma: etiqueta === "Normal" ? null : "Forma " + etiqueta,
    formaPMD: indicePMD(p.id, posicion > 0 ? posicion : 0),
    tipos: p.types.map((t) => t.type.name),
    stats: statsBase(p),
    habilidad: null,
    objeto: null,
    ataques: [null, null, null, null]
  };
}

// Arceus Fuego, Silvally Agua...: el mismo Pokémon con otro tipo y otras imágenes.
// «imagenForma» ("493-fire") es el nombre de archivo de sus sprites; lo usa imagenes.js.
function pokemonDeTipo(p, entrada) {
  const { tipo, dex, pmd } = p.formaDeTipo;
  const archivo = `${dex}-${tipo}`;

  return {
    id: entrada.id,
    idForma: p.id,
    imagenForma: archivo,
    formaSlug: tipo, // Showdown: "Arceus" + "fire" -> "Arceus-Fire"
    es: entrada.es,
    en: entrada.en,
    mote: null,
    imagen: `${URL_SPRITES}other/official-artwork/${archivo}.png`,
    sprite: `${URL_SPRITES}versions/generation-viii/icons/${archivo}.png`,
    shiny: false,
    forma: `Tipo ${etiquetaForma(p.name, "", "es")}`,
    formaPMD: pmd,
    tipos: [tipo],
    stats: statsBase(p),
    habilidad: null,
    objeto: null,
    ataques: [null, null, null, null]
  };
}

// Slug de la variedad que es ahora mismo un Pokémon del equipo ("persian-alola",
// "arceus-fire"...), para marcarla en el selector de forma.
export function variedadActual(poke, info) {
  if (poke.imagenForma) return `${info.especie}-${poke.formaSlug}`;

  const porSlug = poke.formaSlug && info.lista.find((slug) => slug === `${info.especie}-${poke.formaSlug}`);
  if (porSlug) return porSlug;

  // Los guardados antes de que se apuntara el slug solo tienen el texto («Forma Alola»)
  const porTexto = poke.forma && info.lista.find((slug) => `Forma ${etiquetaForma(slug, info.especie, "es")}` === poke.forma);
  return porTexto || info.lista[0];
}

// Lo que el jugador ha elegido y que se conserva al cambiar de forma
const CAMPOS_DEL_JUGADOR = ["mote", "shiny", "genero", "habilidad", "objeto", "ataques", "entreno"];

// Cambia la forma de un Pokémon del equipo sin perder su mote, shiny, habilidad, objeto,
// ataques ni su nivel, naturaleza, EVs e IVs (js/equipos/entreno.js). Devuelve un Pokémon nuevo: el que llama decide dónde ponerlo.
export async function cambiarForma(poke, slug) {
  const p = await pedirVariedad(slug);
  const nuevo = await pokemonDesdeAPI(p, { id: poke.id, es: poke.es, en: poke.en });
  for (const campo of CAMPOS_DEL_JUGADOR) nuevo[campo] = poke[campo];
  return nuevo;
}

// Crea el ataque a partir de su entrada en la lista de nombres
export async function ataqueDesdeAPI(entrada) {
  const m = await pedirJSON(`${URL_API}move/${entrada.id}`);
  const ppMax = m.pp || 1;

  return {
    id: entrada.id,
    es: entrada.es,
    en: entrada.en,
    tipo: m.type.name,
    ppMax: ppMax,
    pp: ppMax,
    descripcion: extraerDescripcion(m),
    descripcionEn: extraerDescripcion(m, "en"),
    ...datosCombate(m)
  };
}
