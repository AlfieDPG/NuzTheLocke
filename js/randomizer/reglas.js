// ---------- Normas del randomizer ----------
//
// Lo que se comparte en un locke: las normas, nunca la semilla ni la ROM. Cada jugador las
// aplica con su propia semilla y le sale una ROM distinta que sigue las mismas normas.
//
// Todo empieza «como en el juego»: lo que no se toca se queda como está. Modos de elegir
// Pokémon: «cualquiera» (sin límite) o «parecida» (de fuerza parecida: estadísticas base
// totales cerca de las del original).
//
//   localStorage «poketeams-randomizer-v1»: { reglas } (las tuyas, las de la sección)

import { leer, escribir } from "../comun/almacen.js";
import { t } from "../comun/idioma.js";

export const CLAVE_MIAS = "poketeams-randomizer-v1";
const VERSION = 3;

export const REGLAS_VACIAS = {
  version: VERSION,
  stats: { modo: "no", generacion: 0 },
  tipos: { modo: "no", familia: false },
  habilidades: { modo: "no", dos: false, familia: false, sinMalas: false },
  evoluciones: { modo: "no", dificiles: false, objetos: false, niveles: false },
  iniciales: { modo: "no", rivalInicial: true, elegidas: [0, 0, 0] },
  estaticos: { modo: "no", totems: "no", aliados: "no", aura: "no" },
  intercambios: { modo: "no", objetos: false, ivs: false },
  movimientos: { generacion: 0 },
  // deSuTipo: más fácil que sean de sus tipos («tipo» %); si no, todos igual de probables
  ataques: { modo: "no", deSuTipo: false, tipo: 50, inicio: 0, orden: false },
  entrenadores: {
    // extras y objetos: a quién, cualquiera de «lideres», «rivales» y «normales» (vacío: a nadie)
    modo: "no", sinLegendarios: true, lideresTipo: false, extras: [], cuantos: 1, objetos: [], evolucionados: false,
    nivelEvolucionados: 40, nivel: 0, dobles: false, nombres: false
  },
  // pueblos: hierba en los pueblos que no tienen (DS, X/Y y ROZA; Sol/Luna no). unico: en Espada y Escudo, todos los
  // que se ven por el campo de una zona, la misma especie
  salvajes: { modo: "no", sinLegendarios: true, nivel: 0, objetos: false, pueblos: false, unico: false, variedad: false },
  // compat «aleatoria»: cada uno, cara o cruz (50 %); con deSuTipo, los de su tipo con «tipo» %
  mt: { ataques: false, compat: "no", deSuTipo: false, tipo: 90, mo: false },
  tutores: { ataques: false, compat: "no", deSuTipo: false, tipo: 90 },
  // mentas: objetos de otra generación que el juego no tiene (de momento, en Rojo Fuego / Verde Hoja, la 4.ª y la 5.ª generación)
  objetos: { suelo: false, sinMalos: false, tiendas: false, sinNormales: false, piedras: false, caramelos: false, precios: false, mentas: false },
  varios: { pokedex: false, texto: false }
};

const QUIENES_ANTES = { lideres: ["lideres", "rivales"], normales: ["normales"], todos: ["lideres", "rivales", "normales"] };

// Unas normas que vienen de fuera (un locke, un código): lo que falte, como en las vacías; lo
// que se guardó con otra forma, pasado a la de ahora
export function completarReglas(reglas = {}) {
  const salida = { version: VERSION };
  for (const [apartado, valores] of Object.entries(REGLAS_VACIAS)) {
    if (apartado === "version") continue;
    const suyas = { ...((reglas && reglas[apartado]) || {}) };
    salida[apartado] = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, k in suyas ? suyas[k] : v]));
    // Antes: «las de los juegos de hoy» (sí o no) en vez de la generación
    if (suyas.moderna && !suyas.generacion) salida[apartado].generacion = 9;
  }
  // Antes, tipos «familia» o «cualquiera»: ahora aleatorio, y lo de la familia aparte
  if (salida.tipos.modo === "familia") Object.assign(salida.tipos, { modo: "azar", familia: true });
  if (salida.tipos.modo === "cualquiera") salida.tipos.modo = "azar";
  // Antes, «preferiblemente de su tipo» era otro modo de los ataques
  if (salida.ataques.modo === "tipo") Object.assign(salida.ataques, { modo: "azar", deSuTipo: true });
  // Antes, «piedras» en vez de «objetos» en las evoluciones
  if (reglas && reglas.evoluciones && reglas.evoluciones.piedras && !("objetos" in reglas.evoluciones)) salida.evoluciones.objetos = true;
  // Antes, extras y objetos eran una sola opción, y «líderes» llevaba también a los rivales
  for (const k of ["extras", "objetos"]) {
    const valor = salida.entrenadores[k];
    if (!Array.isArray(valor)) salida.entrenadores[k] = QUIENES_ANTES[valor] || [];
  }
  return salida;
}

// ¿Las normas de este locke ponen hierba en los pueblos? (entonces esos pueblos salen en Rutas)
export function hierbaEnPueblos(locke) {
  return Boolean(locke && locke.randomizer && completarReglas(locke.randomizer.reglas).salvajes.pueblos);
}

// ¿Hay algo distinto de «como en el juego»?
export function hayAlgo(reglas) {
  return JSON.stringify(completarReglas(reglas)) !== JSON.stringify(REGLAS_VACIAS);
}

// Qué apartados cambian, en palabras: «estadísticas, tipos, entrenadores»
const NOMBRES_APARTADOS = {
  stats: "estadísticas", tipos: "tipos", habilidades: "habilidades", evoluciones: "evoluciones", iniciales: "iniciales",
  estaticos: "estáticos", intercambios: "intercambios", movimientos: "datos de los ataques", ataques: "ataques que aprenden",
  entrenadores: "entrenadores", salvajes: "salvajes", mt: "MT", tutores: "tutores", objetos: "objetos", varios: "varios"
};

export function resumenNormas(reglas) {
  const r = completarReglas(reglas);
  return Object.entries(NOMBRES_APARTADOS)
    .filter(([apartado]) => JSON.stringify(r[apartado]) !== JSON.stringify(REGLAS_VACIAS[apartado]))
    .map(([, nombre]) => t(nombre))
    .join(", ");
}

// ---------- Normas guardadas con nombre ----------
//
//   localStorage «poketeams-randomizer-guardadas-v1»: [{ id, nombre, reglas }]
// Se eligen en la sección «Randomizer» (y lo que se cambia se guarda en ellas) y al crear un locke.

export const CLAVE_GUARDADAS = "poketeams-randomizer-guardadas-v1";

export function normasGuardadas() {
  const lista = leer(CLAVE_GUARDADAS, []);
  return Array.isArray(lista) ? lista.filter((n) => n && n.id && n.nombre) : [];
}

export function guardarNormas(nombre, reglas, id = null) {
  const lista = normasGuardadas();
  const actual = id && lista.find((n) => n.id === id);
  const copia = JSON.parse(JSON.stringify(completarReglas(reglas)));
  if (actual) {
    actual.reglas = copia;
    if (nombre) actual.nombre = nombre;
  } else {
    id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    lista.push({ id, nombre, reglas: copia });
  }
  escribir(CLAVE_GUARDADAS, lista);
  return id;
}

export function borrarNormas(id) {
  escribir(CLAVE_GUARDADAS, normasGuardadas().filter((n) => n.id !== id));
}

// Las tuyas (las de la sección «Randomizer»), o null si nunca las has tocado
export function misReglas() {
  const guardadas = leer(CLAVE_MIAS, null);
  return guardadas && guardadas.reglas && guardadas.reglas.version === VERSION ? completarReglas(guardadas.reglas) : null;
}
