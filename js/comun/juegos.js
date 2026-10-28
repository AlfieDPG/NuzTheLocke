// Juegos de las secciones «Rutas» y «Level caps». Salen agrupados por región en la barra de arriba.
// Los datos de cada uno están en js/rutas/datos.js y js/levelcaps/datos.js (con el mismo id).
// «nombre» es el del idioma de la web (es: en español; en: en inglés).

import { enIngles } from "./idioma.js";

const conNombre = (lista) => lista.map((cada) => ({ ...cada, nombre: enIngles ? cada.en : cada.es }));

export const REGIONES = conNombre([
  { id: "kanto", es: "Kanto", en: "Kanto" },
  { id: "johto", es: "Johto", en: "Johto" },
  { id: "hoenn", es: "Hoenn", en: "Hoenn" },
  { id: "sinnoh", es: "Sinnoh", en: "Sinnoh" },
  { id: "teselia", es: "Teselia", en: "Unova" },
  { id: "kalos", es: "Kalos", en: "Kalos" },
  { id: "alola", es: "Alola", en: "Alola" },
  { id: "galar", es: "Galar", en: "Galar" },
  { id: "paldea", es: "Paldea", en: "Paldea" }
]);

export const JUEGOS = conNombre([
  { id: "frlg", es: "Rojo Fuego / Verde Hoja", en: "FireRed / LeafGreen", region: "kanto" },
  { id: "anil", es: "Pokémon Añil", en: "Pokémon Añil", region: "kanto" },
  { id: "hgss", es: "HeartGold / SoulSilver", en: "HeartGold / SoulSilver", region: "johto" },
  { id: "oras", es: "Rubí Omega / Zafiro Alfa", en: "Omega Ruby / Alpha Sapphire", region: "hoenn" },
  { id: "dp", es: "Diamante / Perla", en: "Diamond / Pearl", region: "sinnoh" },
  { id: "platino", es: "Platino", en: "Platinum", region: "sinnoh" },
  { id: "bdsp", es: "Diamante Brillante / Perla Reluciente", en: "Brilliant Diamond / Shining Pearl", region: "sinnoh" },
  { id: "bw", es: "Negro / Blanco", en: "Black / White", region: "teselia" },
  { id: "b2w2", es: "Negro 2 / Blanco 2", en: "Black 2 / White 2", region: "teselia" },
  { id: "xy", es: "X / Y", en: "X / Y", region: "kalos" },
  { id: "sm", es: "Sol / Luna", en: "Sun / Moon", region: "alola" },
  { id: "usum", es: "Ultrasol / Ultraluna", en: "Ultra Sun / Ultra Moon", region: "alola" },
  { id: "swsh", es: "Espada / Escudo", en: "Sword / Shield", region: "galar" }
]);

// La generación de cada juego, para lo que cambia de una a otra (Brecha Negra en el análisis).
// Añil, que no es oficial, sin generación.
const GENERACIONES = {
  frlg: 3, hgss: 4, dp: 4, platino: 4, bw: 5, b2w2: 5, xy: 6, oras: 6, sm: 7, usum: 7, swsh: 8, bdsp: 8
};

// null si no se sabe
export function generacionDeJuego(id) {
  return GENERACIONES[id] || null;
}

// Nombre de un juego por su id (o el id, si no es uno de la web)
export function nombreDeJuego(id) {
  const juego = JUEGOS.find((cada) => cada.id === id);
  return juego ? juego.nombre : id;
}
