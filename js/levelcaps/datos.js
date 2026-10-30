// Level caps: nivel del Pokémon más alto de cada combate importante (primer combate, no revanchas).
// Fuentes: nuzlockeuniversity.ca (niveles) y WikiDex (nombres en español).
// aprox: true -> nivel sin verificar del todo (se muestra con «≈»).
// seccion: "..." -> el combate sale aparte, al final, bajo ese título (no cuenta para el level cap actual).
//
// Tipos: gimnasio, prueba (las de Alola, en lugar de gimnasios), alto-mando, campeon, historia (rival, jefes...),
// extra (después de la Liga)

import { TEXTOS_EN } from "./textos-en.js";
import { LUGARES_EN } from "../rutas/lugares-en.js";
import { enIngles } from "../comun/idioma.js";

// Un nombre, lugar, etiqueta o apartado de un combate en el idioma de la web. Se guarda y se
// compara en español (las marcas, los retratos). Los escritos a mano salen tal cual.
export function textoDeCombate(texto) {
  return (enIngles && texto && (TEXTOS_EN[texto] || LUGARES_EN[texto])) || texto;
}

// Identifica el combate aunque se añadan otros a la lista más adelante.
// Incluye el lugar porque hay rivales que se repiten (Azul en la Ruta 22, en Ciudad Celeste...).
// Los personalizados llevan su propio id: así se pueden cambiar sin perder la marca.
export function claveCombate(c) {
  return c.id || `${c.etiqueta}|${c.nombre}|${c.lugar || ""}`;
}

const gim = (n, nombre, lugar, nivel) => ({ tipo: "gimnasio", etiqueta: `Gimnasio ${n}`, nombre, lugar, nivel });
const am = (nombre, nivel, extra = {}) => ({ tipo: "alto-mando", etiqueta: "Alto Mando", nombre, nivel, ...extra });
const campeon = (nombre, nivel, extra = {}) => ({ tipo: "campeon", etiqueta: "Campeón", nombre, nivel, ...extra });
const historia = (etiqueta, nombre, nivel, extra = {}) => ({ tipo: "historia", etiqueta, nombre, nivel, ...extra });
const prueba = (etiqueta, nombre, nivel) => ({ tipo: "prueba", etiqueta, nombre, nivel });
const extra = (etiqueta, nombre, nivel, lugar) => ({ tipo: "extra", etiqueta, nombre, nivel, lugar });

// Diamante / Perla (en este orden de gimnasios: Brega y Mananti antes que Fantina)
const COMBATES_DP = [
  gim(1, "Roco", "Ciudad Pirita", 14),
  gim(2, "Gardenia", "Ciudad Vetusta", 22),
  gim(3, "Brega", "Ciudad Rocavelo", 30),
  gim(4, "Mananti", "Ciudad Pradera", 30),
  gim(5, "Fantina", "Ciudad Corazón", 36),
  gim(6, "Acerón", "Ciudad Canal", 39),
  gim(7, "Inverna", "Ciudad Puntaneva", 42),
  gim(8, "Lectro", "Ciudad Marina", 49),
  am("Alecrán", 57), am("Gaia", 59), am("Fausto", 61), am("Delos", 63),
  campeon("Cintia", 66)
];

// ---------- Juegos ----------

const DATOS = [
  {
    id: "frlg",
    combates: [
      gim(1, "Brock", "Ciudad Plateada", 14),
      gim(2, "Misty", "Ciudad Celeste", 21),
      gim(3, "Teniente Surge", "Ciudad Carmín", 24),
      gim(4, "Erika", "Ciudad Azulona", 29),
      gim(5, "Koga", "Ciudad Fucsia", 43),
      gim(6, "Sabrina", "Ciudad Azafrán", 43),
      gim(7, "Blaine", "Isla Canela", 47),
      gim(8, "Giovanni", "Ciudad Verde", 50),
      am("Lorelei", 54), am("Bruno", 56), am("Agatha", 58), am("Lance", 60),
      campeon("Azul", 63)
    ]
  },
  {
    // Pokémon Añil (fangame), dificultad Clásico. Fuente: guianil.pages.dev/combates
    id: "anil",
    combates: [
      gim(1, "Brock", "Ciudad Plateada", 14),
      gim(2, "Misty", "Ciudad Celeste", 23),
      gim(3, "Teniente Surge", "Ciudad Carmín", 30),
      gim(4, "Erika", "Ciudad Azulona", 39),
      gim(5, "Koga y Sachiko", "Ciudad Fucsia", 49),
      gim(6, "Sabrina", "Ciudad Azafrán", 54),
      gim(7, "Blaine", "Isla Canela", 59),
      gim(8, "Urano", "Ciudad Verde", 66),
      am("Lorelei", 70), am("Bruno", 71), am("Agatha", 72), am("Lance", 73),
      campeon("Azul", 75),
      // Líderes de gimnasio de otros juegos que aparecen por Kanto (salen aparte, al final)
      ...[
        historia("Hoenn", "Norman", 12, { lugar: "Museo de Ciudad Plateada" }),
        historia("Hoenn", "Candela", 22, { lugar: "Ruta 21" }),
        historia("Hoenn", "Alana", 27, { lugar: "Ruta 15" }),
        historia("Hoenn", "Erico", 37, { lugar: "Ciudad Azulona" }),
        historia("Hoenn", "Petra", 47, { lugar: "Ciudad Fucsia" }),
        historia("Hoenn", "Marcial", 52, { lugar: "Ciudad Azafrán" }),
        historia("Hoenn", "Plubio", 57, { lugar: "Isla Canela" }),
        historia("Hoenn", "Vito y Leti", 68, { lugar: "Ruta 25 Sur" })
      ].map((c) => ({ ...c, seccion: "Líderes de otras regiones" }))
    ]
  },
  {
    id: "hgss",
    combates: [
      gim(1, "Pegaso", "Ciudad Malva", 13),
      gim(2, "Antón", "Pueblo Azalea", 17),
      gim(3, "Blanca", "Ciudad Trigal", 19),
      gim(4, "Morti", "Ciudad Iris", 25),
      gim(5, "Aníbal", "Ciudad Orquídea", 31),
      gim(6, "Yasmina", "Ciudad Olivo", 35),
      gim(7, "Fredo", "Pueblo Caoba", 34),
      gim(8, "Débora", "Ciudad Endrino", 41),
      am("Mento", 42), am("Koga", 44), am("Bruno", 46), am("Karen", 47),
      campeon("Lance", 50)
    ]
  },
  {
    id: "oras",
    combates: [
      gim(1, "Petra", "Ciudad Férrica", 14),
      gim(2, "Marcial", "Pueblo Azuliza", 16),
      gim(3, "Erico", "Ciudad Malvalona", 21),
      gim(4, "Candela", "Pueblo Lavacalda", 28),
      gim(5, "Norman", "Ciudad Petalia", 30),
      gim(6, "Alana", "Ciudad Arborada", 35),
      gim(7, "Vito y Leti", "Ciudad Algaria", 45),
      gim(8, "Plubio", "Arrecípolis", 46),
      am("Sixto", 52), am("Fátima", 53), am("Nívea", 54), am("Dracón", 55),
      campeon("Máximo", 59)
    ]
  },
  // Diamante Brillante / Perla Reluciente tienen los mismos niveles que Diamante / Perla
  { id: "dp", combates: COMBATES_DP },
  { id: "bdsp", combates: COMBATES_DP },
  {
    id: "platino",
    combates: [
      gim(1, "Roco", "Ciudad Pirita", 14),
      gim(2, "Gardenia", "Ciudad Vetusta", 22),
      gim(3, "Fantina", "Ciudad Corazón", 26),
      gim(4, "Brega", "Ciudad Rocavelo", 32),
      gim(5, "Mananti", "Ciudad Pradera", 37),
      gim(6, "Acerón", "Ciudad Canal", 41),
      gim(7, "Inverna", "Ciudad Puntaneva", 44),
      gim(8, "Lectro", "Ciudad Marina", 50),
      am("Alecrán", 53), am("Gaia", 55), am("Fausto", 57), am("Delos", 59),
      campeon("Cintia", 62)
    ]
  },
  {
    id: "bw",
    combates: [
      gim(1, "Millo / Maíz / Zeo", "Ciudad Gres", 14),
      gim(2, "Aloe", "Ciudad Esmalte", 20),
      gim(3, "Camus", "Ciudad Porcelana", 23),
      gim(4, "Camila", "Ciudad Mayólica", 27),
      gim(5, "Yakón", "Ciudad Fayenza", 31),
      gim(6, "Gerania", "Ciudad Loza", 35),
      gim(7, "Junco", "Ciudad Teja", 39),
      gim(8, "Lirio / Iris", "Ciudad Caolín", 43),
      am("Anís", 50), am("Lotto", 50), am("Catleya", 50), am("Marshal", 50),
      historia("Castillo de N", "N", 52),
      historia("Castillo de N", "Ghechis", 54),
      extra("Después de la Liga", "Mirto (Campeón)", 77, "Liga Pokémon")
    ]
  },
  {
    id: "b2w2",
    combates: [
      gim(1, "Cheren", "Ciudad Engobe", 13),
      gim(2, "Hiedra", "Ciudad Hormigón", 18),
      gim(3, "Camus", "Ciudad Porcelana", 24),
      gim(4, "Camila", "Ciudad Mayólica", 30),
      gim(5, "Yakón", "Ciudad Fayenza", 33),
      gim(6, "Gerania", "Ciudad Loza", 39),
      gim(7, "Lirio", "Ciudad Caolín", 48),
      gim(8, "Ciprián", "Ciudad Marga", 51),
      am("Anís", 58), am("Lotto", 58), am("Catleya", 58), am("Marshal", 58),
      campeon("Iris", 59)
    ]
  },
  {
    id: "xy",
    combates: [
      gim(1, "Violeta", "Ciudad Novarte", 12),
      gim(2, "Lino", "Ciudad Relieve", 25),
      gim(3, "Corelia", "Ciudad Yantra", 32),
      gim(4, "Amaro", "Ciudad Romantis", 34),
      gim(5, "Lem", "Ciudad Luminalia", 37),
      gim(6, "Valeria", "Ciudad Fluxus", 42),
      gim(7, "Ástrid", "Ciudad Témpera", 48),
      gim(8, "Édel", "Ciudad Fractal", 59),
      am("Malva", 65), am("Tileo", 65), am("Narciso", 65), am("Drácena", 65),
      campeon("Dianta", 68)
    ]
  },
  {
    id: "sm",
    combates: [
      prueba("Prueba de Liam", "Gumshoos / Raticate dominante", 12),
      prueba("Gran prueba (Melemele)", "Kahuna Hala", 15),
      prueba("Prueba de Nereida", "Wishiwashi dominante", 20),
      prueba("Prueba de Kiawe", "Salazzle / Marowak dominante", 22),
      prueba("Prueba de Lulú", "Lurantis dominante", 24),
      prueba("Gran prueba (Akala)", "Kahuna Mayla", 27),
      prueba("Prueba de Chris", "Vikavolt dominante", 29),
      prueba("Prueba de Zarala", "Mimikyu dominante", 33),
      prueba("Gran prueba (Ula-Ula)", "Kahuna Denio", 39),
      prueba("Cañón de Poni", "Kommo-o dominante", 45),
      prueba("Gran prueba (Poni)", "Kahuna Hela", 54),
      am("Hala", 55, { aprox: true }), am("Mayla", 55, { aprox: true }),
      am("Zarala", 55, { aprox: true }), am("Kahili", 55, { aprox: true }),
      campeon("Kukui", 58, { aprox: true })
    ]
  },
  {
    id: "usum",
    combates: [
      historia("Escuela de Entrenadores", "Profesora Emily", 10),
      prueba("Prueba de Liam", "Gumshoos / Raticate dominante", 12),
      prueba("Gran prueba (Melemele)", "Kahuna Hala", 16),
      prueba("Prueba de Nereida", "Araquanid dominante", 20),
      prueba("Prueba de Kiawe", "Marowak dominante", 22),
      prueba("Prueba de Lulú", "Lurantis dominante", 24),
      prueba("Gran prueba (Akala)", "Kahuna Mayla", 28),
      prueba("Prueba de Chris", "Togedemaru dominante", 33),
      prueba("Prueba de Zarala", "Mimikyu dominante", 35),
      prueba("Gran prueba (Ula-Ula)", "Kahuna Denio", 44),
      prueba("Cañón de Poni", "Kommo-o dominante", 49),
      prueba("Gran prueba (Poni)", "Kahuna Hela", 54),
      prueba("Prueba de Mina", "Ribombee dominante", 55),
      historia("Ultrópolis", "Ultra Necrozma", 60),
      am("Hala", 57), am("Mayla", 57), am("Zarala", 57), am("Kahili", 57),
      campeon("Tilo", 60)
    ]
  },
  {
    id: "swsh",
    combates: [
      gim(1, "Percy", "Pueblo Hoyuelo", 20),
      gim(2, "Cathy", "Pueblo Amura", 24),
      gim(3, "Naboru", "Ciudad Pistón", 27),
      gim(4, "Judith / Alistair", "Pueblo Ladera", 36),
      gim(5, "Sally", "Pueblo Plié", 38),
      gim(6, "Morris / Mel", "Pueblo Auriga", 42),
      gim(7, "Nerio", "Pueblo Crampón", 46),
      gim(8, "Roy", "Ciudad Artejo", 48),
      historia("Copa de Campeones", "Roxy", 49),
      historia("Copa de Campeones", "Paul", 49),
      historia("Copa de Campeones", "Berto", 53),
      historia("Copa de Campeones", "Cathy", 53),
      historia("Copa de Campeones", "Judith / Alistair", 54),
      historia("Copa de Campeones", "Roy", 55),
      campeon("Lionel", 65)
    ]
  }
];

// Combates de cada juego por id (el mismo de js/comun/juegos.js)
export const COMBATES = Object.fromEntries(DATOS.map((j) => [j.id, j.combates]));