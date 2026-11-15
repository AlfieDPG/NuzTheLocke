// Estadísticas base de todos los Pokémon, incluidas las megaevoluciones y las formas
// alternativas (Palafin Héroe, Necrozma Ultra, Deoxys Ataque, las de Alola...).
//
// Solo entran las formas que CAMBIAN las estadísticas o el tipo: con esa regla se quedan
// fuera solas las puramente estéticas (Gigamax, gorras de Pikachu, Vivillon, Unown...), que
// son iguales que la forma normal. Ojo con mirar solo las estadísticas: Vulpix de Alola,
// Marowak de Alola o los Rotom tienen las mismas que la normal y solo cambian de tipo. Si
// varias formas comparten estadísticas y tipo (los siete colores del núcleo de Minior, los
// tres Tatsugiri Mega...) solo sale una, porque serían filas repetidas.
//
// Todo sale de los CSV de PokeAPI, igual que el resto de datos de la web:
//   pokemon_stats.csv    -> las estadísticas de cada forma
//   pokemon.csv          -> qué formas hay, de qué especie y cuál es la normal
//   pokemon_species.csv  -> el nombre interno de la especie, que hace falta para la etiqueta
// La web no lee los CSV: lleva la tabla ya montada en datos/pokedex.json (la rehace
// herramientas/generar-datos.html), y la primera vez se la guarda en el navegador.

import { descargarCSV, cargarDatos, datos } from "../comun/datos.js";
import { etiquetaForma, formaVisible, nombreConFormaEnIngles } from "../comun/formas.js";
import { enIngles } from "../comun/idioma.js";
import { indicePMD } from "../comun/formas-pmd.js";
import { leer, escribir } from "../comun/almacen.js";
import { imagenConRespaldo, urlsPMD } from "../comun/imagenes.js";

// NO cambiar esta clave sin motivo: si se cambia, se vuelve a descargar todo. Sí hay que
// subirla al rehacer datos/pokedex.json, para que los navegadores dejen la copia vieja.
const CLAVE_POKEDEX = "poketeams-pokedex-v8";

// Formas que no salen aunque sus estadísticas cambien un poco. Los tamaños de Pumpkaboo y
// Gourgeist solo se mueven unos puntos de PS y Velocidad y llenaban la tabla de filas casi
// iguales. Se queda la de tamaño normal, que es la que PokeAPI da por defecto.
const FORMAS_FUERA = /^(pumpkaboo|gourgeist)-(small|large|super)$/;

// Los tipos van por número en pokemon_types.csv y esta numeración no cambia nunca
// (el 19, Estelar, no es un tipo de Pokémon, así que no entra).
const TIPOS_POR_ID = {
  1: "normal", 2: "fighting", 3: "flying", 4: "poison", 5: "ground", 6: "rock",
  7: "bug", 8: "ghost", 9: "steel", 10: "fire", 11: "water", 12: "grass",
  13: "electric", 14: "psychic", 15: "ice", 16: "dragon", 17: "dark", 18: "fairy"
};


// PokeAPI numera las estadísticas del 1 al 6 y en este orden:
// PS, Ataque, Defensa, Ataque especial, Defensa especial, Velocidad.
const TOTAL_ESTADISTICAS = 6;

// Se quita el salto de línea sobrante antes de partir: hay campos (is_default) que van
// los últimos de la línea y un "\r" pegado los dejaría inservibles.
function filasCSV(csv) {
  return csv.split("\n").slice(1).map((linea) => linea.trim().split(","));
}

// pokemon_stats.csv: pokemon_id,stat_id,base_stat,effort -> { idForma: [PS, At, Def, AtEsp, DefEsp, Vel] }
function leerEstadisticas(csv) {
  const bases = {};

  for (const [idTexto, estadisticaTexto, baseTexto] of filasCSV(csv)) {
    const id = Number(idTexto);
    const estadistica = Number(estadisticaTexto);
    if (!id || !estadistica || estadistica > TOTAL_ESTADISTICAS) continue;

    if (!bases[id]) bases[id] = [];
    bases[id][estadistica - 1] = Number(baseTexto);
  }

  return bases;
}

// pokemon.csv: id,identifier,species_id,...,is_default -> una entrada por forma
function leerVariedades(csv) {
  const variedades = [];

  for (const partes of filasCSV(csv)) {
    const id = Number(partes[0]);
    const especie = Number(partes[2]);
    if (!id || !especie) continue;

    variedades.push({ id, slug: partes[1], especie, porDefecto: partes[7] === "1" });
  }

  return variedades;
}

// pokemon_species.csv: id,identifier,generation_id,...,is_baby (11),...,is_legendary (16),
// is_mythical (17),... -> { idEspecie: { slug: "deoxys", gen: 3, clase: "singular" } }
// El nombre hace falta porque el de la forma normal no siempre es el de la especie
// ("deoxys-normal" es la forma; "deoxys" es la especie) y etiquetaForma espera el segundo.
// La generación y la clase (legendario, singular, bebé), para los filtros de la tabla.
function leerEspecies(csv) {
  const especies = {};

  for (const partes of filasCSV(csv)) {
    const id = Number(partes[0]);
    if (!id) continue;
    const clase = partes[17] === "1" ? "singular" : partes[16] === "1" ? "legendario" : partes[11] === "1" ? "bebe" : "";
    especies[id] = { slug: partes[1], gen: Number(partes[2]) || 0, clase };
  }

  return especies;
}

// pokemon_types.csv: pokemon_id,type_id,slot -> { idForma: ["grass", "poison"] }
function leerTipos(csv) {
  const tipos = {};

  for (const [idTexto, tipoTexto, ranuraTexto] of filasCSV(csv)) {
    const id = Number(idTexto);
    const tipo = TIPOS_POR_ID[Number(tipoTexto)];
    if (!id || !tipo) continue;

    if (!tipos[id]) tipos[id] = [];
    tipos[id][Number(ranuraTexto) - 1] = tipo; // la ranura 1 es el tipo principal
  }

  return tipos;
}

function completo(bases) {
  return (bases || []).length === TOTAL_ESTADISTICAS && bases.every(Number.isFinite);
}

function suma(numeros) {
  return numeros.reduce((total, n) => total + n, 0);
}

// Formas de una especie que salen en la tabla: la normal primero y después las que
// tengan unas estadísticas o un tipo que no se hayan visto ya.
function formasDistintas(variedades, bases, tipos) {
  const normal = variedades.find((v) => v.porDefecto);
  if (!normal || !completo(bases[normal.id])) return [];

  const huella = (v) => `${bases[v.id]}|${(tipos[v.id] || []).filter(Boolean)}`;
  const vistas = new Set([huella(normal)]);
  const elegidas = [];

  // Cuando varias formas comparten estadísticas hay que quedarse con una sola. Se prefiere
  // la que el resto de la web da por buena (formaVisible deja fuera Gigamax, tótems...) y,
  // entre esas, la de nombre más corto: así sale "zygarde-10" y no "zygarde-10-power-construct".
  const candidatas = variedades
    .filter((v) => !v.porDefecto && completo(bases[v.id]) && !FORMAS_FUERA.test(v.slug))
    .sort(
      (a, b) =>
        Number(!formaVisible(a.slug)) - Number(!formaVisible(b.slug)) ||
        a.slug.length - b.slug.length ||
        a.id - b.id
    );

  for (const variedad of candidatas) {
    const linea = huella(variedad);
    if (vistas.has(linea)) continue;
    vistas.add(linea);
    elegidas.push(variedad);
  }

  // Ya elegidas, se muestran en el orden de PokeAPI (que es el de los juegos)
  return [normal, ...elegidas.sort((a, b) => a.id - b.id)];
}

// Número de subcarpeta del retrato de cada forma (ver CORRECCIONES_PMD)
function indicesPMD(variedades) {
  const indices = new Map();

  variedades
    .filter((v) => !v.porDefecto)
    .sort((a, b) => a.id - b.id)
    .forEach((v, posicion) => indices.set(v.id, posicion + 1));

  return indices;
}

function formaPMD(variedad, indices) {
  return indicePMD(variedad.id, variedad.porDefecto ? 0 : indices.get(variedad.id) || 0);
}

function montarTabla(bases, variedades, especies, tipos, nombresEspecies) {
  const porEspecie = new Map();
  for (const variedad of variedades) {
    if (!porEspecie.has(variedad.especie)) porEspecie.set(variedad.especie, []);
    porEspecie.get(variedad.especie).push(variedad);
  }

  const nombres = new Map(nombresEspecies.map((p) => [p.id, p.es]));
  const filas = [];

  for (const especie of [...porEspecie.keys()].sort((a, b) => a - b)) {
    const nombre = nombres.get(especie);
    if (!nombre) continue; // especie sin nombre: no se puede mostrar

    const indices = indicesPMD(porEspecie.get(especie));

    for (const variedad of formasDistintas(porEspecie.get(especie), bases, tipos)) {
      const datosEspecie = especies[especie] || {};
      const etiqueta = variedad.porDefecto ? "" : etiquetaForma(variedad.slug, datosEspecie.slug, "es");

      filas.push({
        clave: variedad.id,   // id de PokeAPI: único, también para las formas
        numero: especie,      // número de la Pokédex: la forma comparte el de su especie
        forma: formaPMD(variedad, indices), // subcarpeta del retrato de Mundo Misterioso
        tipos: (tipos[variedad.id] || []).filter(Boolean),
        nombre: etiqueta && etiqueta !== "Normal" ? `${nombre} (${etiqueta})` : nombre,
        bases: bases[variedad.id],
        total: suma(bases[variedad.id]),
        normal: variedad.porDefecto,   // la forma normal de su especie (las demás: Alola, Mega...)
        gen: datosEspecie.gen || 0,    // generación de la especie
        clase: datosEspecie.clase || "" // "legendario", "singular", "bebe" o ""
      });
    }
  }

  return filas;
}

// La tabla sacada de los CSV de PokeAPI. Como con los nombres, la web no lo hace: lleva el
// resultado en datos/pokedex.json. Esto lo usa herramientas/generar-datos.html para rehacer
// ese archivo (y la web si faltase). nombresEspecies: [{ id, es }] (datos.pokemon).
export async function montarPokedexDePokeAPI(nombresEspecies) {
  const [csvEstadisticas, csvPokemon, csvEspecies, csvTipos] = await Promise.all([
    descargarCSV("pokemon_stats.csv"),
    descargarCSV("pokemon.csv"),
    descargarCSV("pokemon_species.csv"),
    descargarCSV("pokemon_types.csv")
  ]);

  return montarTabla(
    leerEstadisticas(csvEstadisticas),
    leerVariedades(csvPokemon),
    leerEspecies(csvEspecies),
    leerTipos(csvTipos),
    nombresEspecies
  );
}

// ---------- Retratos ----------
//
// Los 1.200 retratos de la tabla van juntos en unas pocas imágenes (como hojas de pegatinas)
// en vez de pedirse uno a uno a GitHub: así salen todos de golpe con media docena de
// descargas. Son varias hojas y no una para que las primeras filas no esperen a la última.
// Cada fila lleva en «retrato» su casilla contando desde la primera hoja (o -1 si Mundo
// Misterioso no tiene ninguno). Las genera herramientas/generar-datos.html.
//
// WebP sin pérdida: los mismos píxeles que los originales y algo menos que en PNG.
export const RETRATOS = {
  columnas: 40,   // casillas por fila de cada hoja
  filasPorHoja: 5, // 200 retratos por hoja
  lado: 40        // px de cada retrato (los de Mundo Misterioso son de 40x40)
};

export function archivoHoja(numero) {
  return `img/pokedex/retratos-${numero}.webp`;
}

// Retrato de Mundo Misterioso de una fila: el de la forma concreta (Mega-Charizard X, Palafin
// Héroe...) y, si Mundo Misterioso no tiene esa forma, el de la especie. Aquí NUNCA se cae a un
// sprite de PokeAPI: en las formas modernas esos son renders 3D y desentonan en la tabla.
//
// A día de hoy solo dos formas no tienen retrato propio y salen con el de su especie:
// Mega Kangaskhan (Mundo Misterioso solo dibujó a la cría) y Calyrex Jinete Espectral.
// El tamaño lo pone el CSS (.pokedex-foto); las medidas de la hoja, --hoja-columnas y
// --hoja-filas en la sección.
export function fotoDeFila(p) {
  // Lo normal: su casilla de la hoja de retratos
  if (p.retrato >= 0) {
    const porHoja = RETRATOS.columnas * RETRATOS.filasPorHoja;
    const dentro = p.retrato % porHoja;
    const columna = dentro % RETRATOS.columnas;
    const fila = Math.floor(dentro / RETRATOS.columnas);
    const hoja = archivoHoja(Math.floor(p.retrato / porHoja));
    return `<span class="pokedex-foto en-hoja" style="background-image:url(${hoja});--columna:${columna};--fila:${fila}"></span>`;
  }
  if (p.retrato === -1) return ""; // Mundo Misterioso no tiene ninguno

  // Tabla montada sin hoja (desde PokeAPI): uno a uno
  const urls = [
    ...urlsPMD({ id: p.numero, formaPMD: p.forma }),
    ...(p.forma ? urlsPMD({ id: p.numero, formaPMD: 0 }) : [])
  ];
  return imagenConRespaldo(urls, `class="pokedex-foto" alt="" loading="lazy" data-quitar-si-falla`);
}

const URL_POKEDEX = new URL("../../datos/pokedex.json", import.meta.url);

// El nombre de una fila («Raticate (Alola)») en el idioma de la web. La tabla va en español;
// en inglés, con el nombre inglés de la especie (si ya están cargados los nombres) y la forma.
export function nombreDeFila(fila, idioma = enIngles ? "en" : "es") {
  if (!fila || idioma !== "en") return fila ? fila.nombre : "";
  const especie = datos && datos.pokemon.find((p) => p.id === fila.numero);
  return nombreConFormaEnIngles(fila.nombre, especie && especie.en);
}

// Lista ordenada por número de Pokédex (y cada especie seguida de sus formas):
// { clave, numero, forma, tipos, nombre, bases: [PS, At, Def, AtEsp, DefEsp, Vel], total, retrato }
export async function cargarPokedex() {
  try {
    localStorage.removeItem("poketeams-pokedex-v1"); // versión antigua (sin formas alternativas)
    localStorage.removeItem("poketeams-pokedex-v2"); // versión antigua (sin el retrato de cada forma)
    localStorage.removeItem("poketeams-pokedex-v3"); // versión antigua (sin los tipos)
    localStorage.removeItem("poketeams-pokedex-v4"); // versión antigua (con los tamaños de Pumpkaboo)
    localStorage.removeItem("poketeams-pokedex-v5"); // versión antigua (sin la hoja de retratos)
    localStorage.removeItem("poketeams-pokedex-v6"); // versión antigua (sin las formas que solo cambian de tipo)
    localStorage.removeItem("poketeams-pokedex-v7"); // versión antigua (sin generación ni legendarios)
  } catch (error) {
    // si el navegador no deja tocar el almacén, da igual: solo es limpieza
  }

  const guardada = leer(CLAVE_POKEDEX, null);
  if (guardada) return guardada;

  let tabla = null;
  try {
    const respuesta = await fetch(URL_POKEDEX);
    if (respuesta.ok) tabla = await respuesta.json();
  } catch (error) {
    // sin el archivo, se monta desde PokeAPI (sin hoja de retratos: van uno a uno)
  }

  if (!tabla) {
    await cargarDatos(); // nombres en español de las especies
    tabla = await montarPokedexDePokeAPI(datos.pokemon);
  }

  escribir(CLAVE_POKEDEX, tabla);
  return tabla;
}
