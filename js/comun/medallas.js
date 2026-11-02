// ---------- Medallas de gimnasio ----------
//
// Las de cada juego, en el orden en que las guarda la partida (cada una, un bit; en Diamante
// Brillante / Perla Reluciente solo hay cuántas, y se ganan en este orden). Cada una con su
// imagen de PokeAPI (badges/N.png): cada región tiene su estilo, pero las de un juego son todas
// del mismo. Y el gimnasio de «Level caps» que se vence al ganarla.
//
// Al leer una medalla nueva de la partida, su gimnasio se marca como superado en «Level caps»
// (y se apunta en la actividad de tus lockes, como al marcarlo a mano). Cada medalla se mira una
// sola vez: si desmarcas el gimnasio, no vuelve a marcarse solo.

import { COMBATES, claveCombate } from "../levelcaps/datos.js";
import { leer, escribir } from "./almacen.js";
import { apuntarEnLockesDelJuego, conKanto } from "./lockes.js";
import { enIngles } from "./idioma.js";

const URL_MEDALLAS = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/";

// La misma clave que js/levelcaps/index.js (los combates superados de cada juego)
const CLAVE_SUPERADOS = "poketeams-levelcaps-v2";

// [imagen, español, inglés]
const KANTO = [
  [1, "Roca", "Boulder"], [2, "Cascada", "Cascade"], [3, "Trueno", "Thunder"], [4, "Arcoíris", "Rainbow"],
  [5, "Alma", "Soul"], [6, "Pantano", "Marsh"], [7, "Volcán", "Volcano"], [8, "Tierra", "Earth"]
];
const JOHTO = [
  [9, "Céfiro", "Zephyr"], [10, "Colmena", "Hive"], [11, "Planicie", "Plain"], [12, "Niebla", "Fog"],
  [13, "Tormenta", "Storm"], [14, "Mineral", "Mineral"], [15, "Glaciar", "Glacier"], [16, "Dragón", "Rising"]
];
const HOENN = [
  [17, "Piedra", "Stone"], [18, "Puño", "Knuckle"], [19, "Dinamo", "Dynamo"], [20, "Calor", "Heat"],
  [21, "Equilibrio", "Balance"], [22, "Pluma", "Feather"], [23, "Mente", "Mind"], [24, "Lluvia", "Rain"]
];
const SINNOH = [
  [25, "Lignito", "Coal"], [26, "Bosque", "Forest"], [27, "Adoquín", "Cobble"], [28, "Ciénaga", "Fen"],
  [29, "Reliquia", "Relic"], [30, "Mina", "Mine"], [31, "Carámbano", "Icicle"], [32, "Faro", "Beacon"]
];
const TESELIA = {
  trio: [33, "Trío", "Trio"], basica: [34, "Básica", "Basic"], elitro: [35, "Élitro", "Insect"], toxi: [36, "Toxi", "Toxic"],
  voltio: [37, "Voltio", "Bolt"], temblor: [38, "Temblor", "Quake"], jet: [39, "Jet", "Jet"], tempano: [40, "Témpano", "Freeze"],
  leyenda: [41, "Leyenda", "Legend"], ola: [42, "Ola", "Wave"]
};
const KALOS = [
  [43, "Insecto", "Bug"], [44, "Muro", "Cliff"], [45, "Lucha", "Rumble"], [46, "Planta", "Plant"],
  [47, "Voltio", "Voltage"], [48, "Hada", "Fairy"], [49, "Psique", "Psychic"], [50, "Iceberg", "Iceberg"]
];
// Galar: el 4.º y el 6.º gimnasio cambian con la versión (Espada / Escudo)
const GALAR = [
  [51, "Planta", "Grass"], [52, "Agua", "Water"], [53, "Fuego", "Fire"], [[54, "Lucha", "Fighting"], [55, "Fantasma", "Ghost"]],
  [56, "Hada", "Fairy"], [[57, "Roca", "Rock"], [58, "Hielo", "Ice"]], [59, "Siniestra", "Dark"], [60, "Dragón", "Dragon"]
];

// Por juego: las medallas en el orden de la partida y, si no es el mismo, el gimnasio de cada una
// (su posición entre los gimnasios de «Level caps»; -1 si no tiene)
const JUEGOS = {
  frlg: { medallas: KANTO },
  anil: { medallas: KANTO },
  // Los gimnasios de Kanto van en «Level caps» en otro orden (Surge, Sabrina, Misty, Erika, Janine,
  // Brock, Blaine y Azul) que sus medallas (Roca, Cascada, Trueno...)
  hgss: { medallas: [...JOHTO, ...KANTO], gimnasios: [0, 1, 2, 3, 4, 5, 6, 7, 13, 10, 8, 11, 12, 9, 14, 15] },
  // Gimnasios en cualquier orden, pero cada medalla es de su líder, como en HGSS
  vitro: { medallas: JOHTO },
  oras: { medallas: HOENN },
  dp: { medallas: SINNOH },
  // En Platino, Fantina es el 3.er gimnasio, pero su medalla sigue siendo la 5.ª
  platino: { medallas: SINNOH, gimnasios: [0, 1, 3, 4, 2, 5, 6, 7] },
  bdsp: { medallas: SINNOH },
  bw: { medallas: ["trio", "basica", "elitro", "voltio", "temblor", "jet", "tempano", "leyenda"].map((m) => TESELIA[m]) },
  b2w2: { medallas: ["basica", "toxi", "elitro", "voltio", "temblor", "jet", "leyenda", "ola"].map((m) => TESELIA[m]) },
  xy: { medallas: KALOS },
  swsh: { medallas: GALAR }
};

// Las de un locke: las de su juego, salvo HeartGold / SoulSilver sin Kanto (las 8 de Johto)
export function medallasDelLocke(locke, version = "") {
  const lista = medallasDelJuego(locke.juego, version);
  return locke.juego === "hgss" && !conKanto(locke) ? lista.slice(0, 8) : lista;
}

export function tieneMedallas(idJuego) {
  return Boolean(JUEGOS[idJuego]);
}

// [{ imagen, nombre, gimnasio }] en el orden de la partida, o [] si el juego no tiene.
// version: la de la partida («Escudo»...), para las que cambian.
export function medallasDelJuego(idJuego, version = "") {
  const juego = JUEGOS[idJuego];
  if (!juego) return [];
  const escudo = /escudo|shield/i.test(version);
  return juego.medallas.map((m, i) => {
    const [numero, es, en] = Array.isArray(m[0]) ? m[escudo ? 1 : 0] : m;
    return {
      imagen: `${URL_MEDALLAS}${numero}.png`,
      nombre: enIngles ? `${en} Badge` : `Medalla ${es}`,
      gimnasio: juego.gimnasios ? juego.gimnasios[i] : i
    };
  });
}

// El combate de «Level caps» de esa medalla, o null
function combateDe(idJuego, indice) {
  const juego = JUEGOS[idJuego];
  const posicion = juego ? (juego.gimnasios ? juego.gimnasios[indice] : indice) : -1;
  if (posicion < 0) return null;
  const gimnasios = (COMBATES[idJuego] || []).filter((c) => c.tipo === "gimnasio" && !c.seccion);
  return gimnasios[posicion] || null;
}

// Marca (o desmarca) en «Level caps» los gimnasios de esas medallas, como al hacerlo a mano
export function marcarGimnasios(idJuego, indices, marcado = true) {
  const guardados = leer(CLAVE_SUPERADOS, {}) || {};
  const superados = new Set(guardados[idJuego] || []);
  const cambiados = [];
  for (const indice of indices) {
    const combate = combateDe(idJuego, indice);
    if (!combate || superados.has(claveCombate(combate)) === marcado) continue;
    if (marcado) superados.add(claveCombate(combate));
    else superados.delete(claveCombate(combate));
    cambiados.push(combate);
  }
  if (!cambiados.length) return;
  guardados[idJuego] = [...superados];
  escribir(CLAVE_SUPERADOS, guardados);
  for (const combate of cambiados) {
    const quien = combate.nombre || combate.etiqueta;
    apuntarEnLockesDelJuego("capsPropios", idJuego, "cap", quien, marcado).catch((error) => console.error(error));
  }
}

// Las medallas de la partida que no se habían visto: marca sus gimnasios y las apunta en
// «vistas» (índices). medallas: [sí/no] de la partida.
export function marcarMedallasNuevas(idJuego, medallas, vistas) {
  if (!medallas || !tieneMedallas(idJuego)) return;
  const nuevas = medallas.flatMap((tiene, i) => (tiene && !vistas.has(i) ? [i] : []));
  for (const i of nuevas) vistas.add(i);
  marcarGimnasios(idJuego, nuevas);
}
