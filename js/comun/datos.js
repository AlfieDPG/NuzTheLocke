import { quitarAcentos, normalizarNombre } from "./utilidades.js";
import { anadirPropios } from "./propios.js";

// ---------- Carga de datos (nombres en español e inglés) ----------

// NO cambiar esta clave sin motivo: si se cambia, se vuelven a descargar los datos. Sí hay
// que subirla al rehacer datos/nombres.json, para que los navegadores dejen la copia vieja.
const CLAVE_DATOS = "poketeams-datos-v8";

// Nombres que en español salen repetidos y hay que distinguir (id -> nombre)
const NOMBRES_CORREGIDOS = {
  habilidades: { 266: "Unidad Ecuestre (Glastrier)", 267: "Unidad Ecuestre (Spectrier)" }
};

function corregirNombres(lista, correcciones) {
  for (const entrada of lista) {
    if (correcciones[entrada.id]) entrada.es = correcciones[entrada.id];
  }
  return lista;
}

const URLS_BASE = [
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/",
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/main/data/v2/csv/"
];

// Nombres de Pokémon, ataques, habilidades y objetos. Vale null hasta que termina cargarDatos().
export let datos = null;

export async function descargarCSV(archivo) {
  for (const base of URLS_BASE) {
    try {
      const respuesta = await fetch(base + archivo);
      if (respuesta.ok) return await respuesta.text();
    } catch (error) {
      // probamos con la siguiente dirección
    }
  }
  throw new Error("No se pudo descargar " + archivo);
}

// Convierte el CSV en una lista de { id, es, en }
// Idioma 7 = español, idioma 9 = inglés
function leerNombres(csv) {
  const nombres = {};
  const lineas = csv.split("\n").slice(1);

  for (const linea of lineas) {
    const partes = linea.split(",");
    const id = Number(partes[0]);
    const idioma = partes[1];
    const nombre = (partes[2] || "").replace(/"/g, "").trim();

    if (!nombre || !id || id >= 10000) continue;
    if (!nombres[id]) nombres[id] = {};
    if (idioma === "7") nombres[id].es = nombre;
    if (idioma === "9") nombres[id].en = nombre;
  }

  return Object.entries(nombres)
    .filter(([id, n]) => n.en)
    .map(([id, n]) => ({ id: Number(id), en: n.en, es: n.es || n.en }));
}

function prepararBusqueda(lista) {
  for (const entrada of lista) {
    entrada.buscar = quitarAcentos(entrada.es + " " + entrada.en);
  }
}

// Los nombres sacados de los CSV de PokeAPI. Son ~1,5 MB de descarga, así que la web no
// lo hace: lleva el resultado ya preparado en datos/nombres.json. Esto solo lo usa
// herramientas/generar-datos.html para rehacer ese archivo (y la web si faltase).
export async function descargarNombresDePokeAPI() {
  const [csvAtaques, csvHabilidades, csvPokemon, csvObjetos] = await Promise.all([
    descargarCSV("move_names.csv"),
    descargarCSV("ability_names.csv"),
    descargarCSV("pokemon_species_names.csv"),
    descargarCSV("item_names.csv")
  ]);

  return {
    ataques: leerNombres(csvAtaques),
    habilidades: corregirNombres(leerNombres(csvHabilidades), NOMBRES_CORREGIDOS.habilidades),
    pokemon: leerNombres(csvPokemon),
    objetos: leerNombres(csvObjetos)
  };
}

// Va al lado de index.html y pesa ~60 KB comprimido: llega en un momento
const URL_NOMBRES = new URL("../../datos/nombres.json", import.meta.url);

async function nombresPreparados() {
  try {
    const respuesta = await fetch(URL_NOMBRES);
    if (respuesta.ok) return await respuesta.json();
  } catch (error) {
    // sin el archivo, se tira de PokeAPI
  }
  return descargarNombresDePokeAPI();
}

async function leerODescargar() {
  try {
    localStorage.removeItem("poketeams-datos-v1"); // versión antigua
    localStorage.removeItem("poketeams-datos-v2"); // versión antigua
    localStorage.removeItem("poketeams-datos-v3"); // versión antigua
    localStorage.removeItem("poketeams-datos-v4"); // versión antigua
    localStorage.removeItem("poketeams-datos-v5"); // versión antigua (con formas en el buscador)
    localStorage.removeItem("poketeams-datos-v6"); // versión antigua (Unidad Ecuestre repetida)
    localStorage.removeItem("poketeams-datos-v7"); // versión antigua (sin las megapiedras de Leyendas Z-A)
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (guardado) return JSON.parse(guardado);
  } catch (error) {
    // si falla la lectura, descargamos de nuevo
  }

  const nuevos = await nombresPreparados();

  prepararBusqueda(nuevos.ataques);
  prepararBusqueda(nuevos.habilidades);
  prepararBusqueda(nuevos.pokemon);
  prepararBusqueda(nuevos.objetos);

  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(nuevos));
  } catch (error) {
    // si no se puede guardar, no pasa nada: se descargará la próxima vez
  }

  return nuevos;
}

// Se puede llamar desde cualquier sección: solo carga los datos la primera vez
let promesaDatos = null;

export function cargarDatos() {
  if (!promesaDatos) {
    promesaDatos = leerODescargar().then(async (d) => {
      // En inglés las dos «As One» se llaman igual: como en español, con el Pokémon detrás
      for (const h of d.habilidades) if (h.id === 266 || h.id === 267) h.en = `As One (${h.id === 266 ? "Glastrier" : "Spectrier"})`;
      // Los ataques y habilidades propios de Pokémon Añil (./propios.js)
      await anadirPropios(d);
      return (datos = d);
    });
    promesaDatos.catch(() => (promesaDatos = null));
  }
  return promesaDatos;
}

// Una lista de nombres sin lo propio de Pokémon Añil (./propios.js): para elegir donde no se puede
// usar (la calculadora, el randomizer)
const sinPropiosHechas = new WeakMap();
export function sinPropios(lista) {
  if (!sinPropiosHechas.has(lista)) sinPropiosHechas.set(lista, lista.filter((entrada) => !entrada.propio));
  return sinPropiosHechas.get(lista);
}

// Índice nombre inglés normalizado -> entrada, creado la primera vez que se busca en cada lista
const indicesIngles = new WeakMap();

export function buscarPorNombreIngles(lista, nombre) {
  let indice = indicesIngles.get(lista);
  if (!indice) {
    indice = new Map();
    for (const entrada of lista) {
      const clave = normalizarNombre(entrada.en);
      if (!indice.has(clave)) indice.set(clave, entrada);
    }
    indicesIngles.set(lista, indice);
  }
  return indice.get(normalizarNombre(nombre)) || null;
}
