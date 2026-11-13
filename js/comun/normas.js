// ---------- Normas ----------
//
//   · Normas generales: las básicas de cualquier Nuzlocke. Fijas, iguales para todos.
//   · Conjuntos: cada uno puede crear los suyos (p. ej. «Randomlocke del grupo»), con un
//     nombre y sus normas: las que se marcan de un catálogo (generales, variantes y cláusulas,
//     que se guardan con el id del catálogo) y las que se escriben a mano. Se guardan como los
//     equipos (en el navegador y, con sesión, en tu cuenta).
//     Los conjuntos de antes llevan «conGenerales»: las generales no estaban en la lista sino
//     detrás de esa casilla; al tocar una general se pasan a la lista (conGeneralesComoNormas).
//
// Al crear o editar un locke se elige qué normas usa: las generales o uno de tus conjuntos.
// Se guarda una COPIA dentro del locke (locke.normas), igual que el tipo: así cambiar luego
// tu conjunto no cambia las reglas de un locke que ya se está jugando, y tus amigos las
// pueden leer aunque no lo tengan.
//
//   locke.normas: { id, nombre, conGenerales, lista: [{ id, nombre, texto }] }
//                 (id "generales" y lista vacía: solo las generales)
//
// Los conjuntos son de quien los crea: al aceptar un locke de otro, su conjunto NO pasa a los
// tuyos (lo ves desde el botón «Normas» del locke). Antes sí pasaba: los que llegaron así se
// quitan solos (quitarConjuntosAjenos, desde lockes.js).
//
//   localStorage «poketeams-normas-v2»:
//     { conjuntos: [{ id, nombre, conGenerales, normas: [{ id, nombre, texto }] }], quitados: [id] }

import { leer, escribir } from "./almacen.js";
import { t } from "./idioma.js";

const CLAVE_NORMAS = "poketeams-normas-v2";
export const ID_GENERALES = "generales";
export const NOMBRE_GENERALES = t("Normas generales");

// grupo: «basica» (las de cualquier Nuzlocke) o «extra» (muy habituales, pero no en todos)
export const NORMAS_GENERALES = [
  {
    id: "general-captura",
    grupo: "basica",
    nombre: "Una captura por zona",
    texto: "Solo puedes capturar el primer Pokémon salvaje que encuentres en cada ruta, ciudad o zona. Si se debilita o huye, pierdes la captura de esa zona. Si es de una especie que ya tienes (duplicado), puedes saltártelo y probar con el siguiente."
  },
  {
    id: "general-muerto",
    grupo: "basica",
    nombre: "Debilitado = muerto",
    texto: "Si un Pokémon se debilita, está muerto para siempre: no puedes volver a usarlo. Libéralo o déjalo en una caja «cementerio»."
  },
  {
    id: "general-motes",
    grupo: "basica",
    nombre: "Motes obligatorios",
    texto: "Pon mote a todos tus Pokémon."
  },
  {
    id: "general-fin",
    grupo: "basica",
    nombre: "Fin de la partida",
    texto: "Pierdes cuando te quedas sin Pokémon que puedas usar, ni en el equipo ni en la caja, o cuando te quedas sin vidas."
  },
  {
    id: "general-variocolor",
    grupo: "extra",
    nombre: "Variocolor",
    texto: "Si te sale un Pokémon variocolor (shiny), puedes capturarlo aunque no sea el Pokémon de la ruta."
  },
  {
    id: "general-curas",
    grupo: "extra",
    nombre: "Sin comprar curas",
    texto: "No se pueden comprar objetos curativos."
  }
].map((norma) => ({ ...norma, nombre: t(norma.nombre), texto: t(norma.texto) }));

// Variantes de Nuzlocke (se marcan de un clic en la sección «Normas»; la «i» enseña el texto)
export const NORMAS_VARIANTES = [
  {
    id: "variante-hardcore",
    nombre: "Hardcore",
    resumen: "Sin objetos en combate, modo fijo y level caps",
    texto: "Modo Hardcore: no se pueden usar objetos en combate, el modo de combate es fijo (sin cambiar de Pokémon gratis cuando se debilita un rival) y se respetan los level caps: ningún Pokémon supera el nivel del Pokémon más alto del siguiente líder."
  },
  {
    id: "variante-monotipo",
    nombre: "Monotipo",
    resumen: "Todo el equipo de un tipo",
    texto: "Todo el equipo es de un único tipo, elegido al empezar. Solo se capturan Pokémon que tengan ese tipo (como uno de sus dos tipos)."
  },
  {
    id: "variante-wedlocke",
    nombre: "Wedlocke",
    resumen: "Parejas: solo combate uno de cada",
    texto: "Los Pokémon capturados se emparejan. Si uno de la pareja muere, el otro también. En el equipo van las parejas completas y en combate solo lucha uno de cada pareja."
  },
  {
    id: "variante-egglocke",
    nombre: "Egglocke",
    resumen: "Capturas cambiadas por huevos",
    texto: "En vez de capturar el Pokémon de cada zona, recibes un huevo con un Pokémon aleatorio. Se eclosiona antes de seguir."
  },
  {
    id: "variante-wonderlocke",
    nombre: "Wonderlocke",
    resumen: "Capturas al Intercambio Prodigioso",
    texto: "Cada captura se envía al Intercambio Prodigioso y el Pokémon que llega a cambio es el que se usa."
  },
  {
    id: "variante-randomlocke",
    nombre: "Randomlocke",
    resumen: "ROM preparada en el Randomizer",
    texto: "Se juega con una ROM randomizada. Las normas del Randomizer se eligen en su sección y se comparten con el locke."
  }
].map((norma) => ({ ...norma, grupo: "variante", nombre: t(norma.nombre), resumen: t(norma.resumen), texto: t(norma.texto) }));

// Cláusulas para afinar
export const NORMAS_CLAUSULAS = [
  {
    id: "clausula-duplicados",
    nombre: "Cláusula de duplicados",
    texto: "Si el primer Pokémon que encuentras en una zona es de una especie (o de una línea evolutiva) que ya tienes, no cuenta: puedes probar con el siguiente."
  },
  {
    id: "clausula-niveles",
    nombre: "Level caps: no pasar del nivel del líder",
    texto: "Ningún Pokémon puede superar el nivel del Pokémon más alto del siguiente líder o combate importante."
  },
  {
    id: "clausula-regalos",
    nombre: "Los regalos cuentan como captura",
    texto: "Los Pokémon que te regalan (el inicial y los de la historia) cuentan como la captura de esa zona."
  },
  {
    id: "clausula-estaticos",
    nombre: "Los estáticos cuentan como captura",
    texto: "Los Pokémon estáticos (legendarios y otros que esperan quietos en el mapa) cuentan como la captura de esa zona."
  }
].map((norma) => ({ ...norma, grupo: "clausula", nombre: t(norma.nombre), texto: t(norma.texto) }));

// Qué normas del catálogo puede vigilar el árbitro (js/partida/arbitro.js: nivel, captura, motes, repetidos)
export const ARBITRO_DE = {
  "general-captura": "captura",
  "general-motes": "motes",
  "clausula-duplicados": "repetidos",
  "clausula-niveles": "nivel"
};

export const CATALOGO = [...NORMAS_GENERALES, ...NORMAS_VARIANTES, ...NORMAS_CLAUSULAS];

export function normaDelCatalogo(id) {
  return CATALOGO.find((norma) => norma.id === id) || null;
}

const oyentes = new Set();

function guardado() {
  const valor = leer(CLAVE_NORMAS, null);
  return {
    conjuntos: (valor && Array.isArray(valor.conjuntos) && valor.conjuntos) || [],
    quitados: (valor && valor.quitados) || []
  };
}

function guardar(estado) {
  escribir(CLAVE_NORMAS, estado);
  for (const funcion of oyentes) funcion();
}

function nuevoId(prefijo) {
  return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Avisa al cambiar tus conjuntos (también si llega uno de un locke)
export function alCambiarNormas(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

// ---------- Leer ----------

export function conjuntos() {
  return guardado().conjuntos;
}

export function conjuntoPorId(id) {
  return conjuntos().find((conjunto) => conjunto.id === id) || null;
}

// Todas las normas de un conjunto (o de la copia de un locke): las suyas y, si las lleva,
// las generales delante
export function normasCompletas(conjunto) {
  if (!conjunto) return [];
  const propias = conjunto.lista || conjunto.normas || [];
  return [...(conjunto.conGenerales ? NORMAS_GENERALES : []), ...propias];
}

// Las normas de un locke, o null si no tiene. Los lockes de la primera versión guardaban
// una lista suelta de normas: se leen como un conjunto sin nombre.
export function normasDeLocke(locke) {
  const normas = locke && locke.normas;
  if (!normas) return null;
  if (Array.isArray(normas)) {
    return normas.length ? { id: "", nombre: t("Normas del locke"), conGenerales: false, lista: normas } : null;
  }
  return normas;
}

// La copia que se guarda en un locke
export function copiaParaLocke(id) {
  if (id === ID_GENERALES) return { id: ID_GENERALES, nombre: NOMBRE_GENERALES, conGenerales: true, lista: [] };
  const conjunto = conjuntoPorId(id);
  if (!conjunto) return null;
  return {
    id: conjunto.id,
    nombre: conjunto.nombre,
    conGenerales: Boolean(conjunto.conGenerales),
    lista: conjunto.normas.map(({ id: idNorma, nombre, texto }) => ({ id: idNorma, nombre, texto: texto || "" }))
  };
}

// ---------- Conjuntos ----------

export function nombreDeConjuntoLibre(nombre, salvoId = null) {
  const clave = nombre.trim().toLowerCase();
  if (clave === NOMBRE_GENERALES.toLowerCase()) return false;
  return !conjuntos().some((conjunto) => conjunto.id !== salvoId && conjunto.nombre.trim().toLowerCase() === clave);
}

export function crearConjunto(nombre, conGenerales) {
  const estado = guardado();
  const conjunto = { id: nuevoId("c"), nombre: nombre.trim(), conGenerales: Boolean(conGenerales), normas: [] };
  estado.conjuntos.push(conjunto);
  guardar(estado);
  return conjunto;
}

// cambios: { nombre?, conGenerales? }
export function cambiarConjunto(id, cambios) {
  const estado = guardado();
  const conjunto = estado.conjuntos.find((cada) => cada.id === id);
  if (!conjunto) return;
  if (cambios.nombre !== undefined) conjunto.nombre = cambios.nombre.trim();
  if (cambios.conGenerales !== undefined) conjunto.conGenerales = Boolean(cambios.conGenerales);
  guardar(estado);
}

export function borrarConjunto(id) {
  const estado = guardado();
  estado.conjuntos = estado.conjuntos.filter((conjunto) => conjunto.id !== id);
  if (!estado.quitados.includes(id)) estado.quitados.push(id);
  guardar(estado);
}

// ---------- Normas de un conjunto ----------

// Los conjuntos de antes llevaban las generales detrás de una casilla (conGenerales): se pasan a la
// lista, normas sueltas que se pueden quitar de una en una
export function conGeneralesComoNormas(idConjunto) {
  const estado = guardado();
  const conjunto = estado.conjuntos.find((cada) => cada.id === idConjunto);
  if (!conjunto || !conjunto.conGenerales) return;
  const ya = new Set(conjunto.normas.map((norma) => norma.id));
  conjunto.normas = [
    ...NORMAS_GENERALES.filter((norma) => !ya.has(norma.id)).map(({ id, nombre, texto }) => ({ id, nombre, texto })),
    ...conjunto.normas
  ];
  conjunto.conGenerales = false;
  guardar(estado);
}

// Marcar o quitar una norma del catálogo en un conjunto
export function alternarNormaDelCatalogo(idConjunto, id) {
  const norma = normaDelCatalogo(id);
  if (!norma) return;
  conGeneralesComoNormas(idConjunto);
  const conjunto = conjuntoPorId(idConjunto);
  if (!conjunto) return;
  if (conjunto.normas.some((cada) => cada.id === id)) quitarNorma(idConjunto, id);
  else guardarNorma(idConjunto, { id, nombre: norma.nombre, texto: norma.texto });
}

// Crea o, si ya existe ese id, cambia
export function guardarNorma(idConjunto, norma) {
  const estado = guardado();
  const conjunto = estado.conjuntos.find((cada) => cada.id === idConjunto);
  if (!conjunto) return null;

  const limpia = { id: norma.id || nuevoId("n"), nombre: norma.nombre.trim(), texto: norma.texto.trim() };
  const posicion = conjunto.normas.findIndex((cada) => cada.id === limpia.id);
  if (posicion >= 0) conjunto.normas[posicion] = limpia;
  else conjunto.normas.push(limpia);
  guardar(estado);
  return limpia;
}

export function quitarNorma(idConjunto, idNorma) {
  const estado = guardado();
  const conjunto = estado.conjuntos.find((cada) => cada.id === idConjunto);
  if (!conjunto) return;
  conjunto.normas = conjunto.normas.filter((norma) => norma.id !== idNorma);
  guardar(estado);
}

// ---------- Los que llegaron de lockes de otros (versiones de antes) ----------

// Quita de los tuyos estos conjuntos (ids). No van a «quitados»: no hay nada que los vuelva a traer.
export function quitarConjuntosAjenos(ids) {
  if (!ids.length) return;
  const estado = guardado();
  const quedan = estado.conjuntos.filter((conjunto) => !ids.includes(conjunto.id));
  if (quedan.length === estado.conjuntos.length) return;
  estado.conjuntos = quedan;
  guardar(estado);
}
