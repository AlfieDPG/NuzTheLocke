// ---------- Retratos de los entrenadores ----------
//
// Sprites de Pokémon Showdown. Se usa el nombre «a secas», que es el dibujo más reciente
// que tienen de cada uno (en los juegos nuevos ya es en alta resolución). Solo se pone el
// sufijo de generación en los que no existe sin él.
//
// Un combate sin entrada aquí simplemente sale sin foto: pasa con los Pokémon dominantes
// de Alola, con los campeones genéricos y con los personajes inventados de Pokémon Añil.
//
// Lo usan «Level caps» (los juegos de la web) y el editor de los personalizados, que deja
// elegir cualquiera de estos personajes como imagen de un combate.

import { COMBATES, textoDeCombate } from "./datos.js";
import { JUEGOS } from "../comun/juegos.js";
import { urlSpritePixel } from "../comun/imagenes.js";

const URL_ENTRENADORES = "https://play.pokemonshowdown.com/sprites/trainers/";

const KANTO = {
  "Brock": "brock", "Misty": "misty", "Teniente Surge": "ltsurge", "Erika": "erika",
  "Koga": "koga", "Sabrina": "sabrina", "Blaine": "blaine", "Giovanni": "giovanni",
  "Lorelei": "lorelei-gen3", "Bruno": "bruno", "Agatha": "agatha-gen3",
  "Lance": "lance", "Azul": "blue"
};

const JOHTO = {
  "Pegaso": "falkner", "Antón": "bugsy", "Blanca": "whitney", "Morti": "morty",
  "Aníbal": "chuck", "Yasmina": "jasmine", "Fredo": "pryce", "Débora": "clair",
  "Mento": "will", "Koga": "koga", "Bruno": "bruno", "Karen": "karen", "Lance": "lance"
};

const SINNOH = {
  "Roco": "roark", "Gardenia": "gardenia", "Brega": "maylene", "Mananti": "crasherwake",
  "Fantina": "fantina", "Acerón": "byron", "Inverna": "candice", "Lectro": "volkner",
  "Alecrán": "aaron", "Gaia": "bertha", "Fausto": "flint", "Delos": "lucian",
  "Cintia": "cynthia"
};

const UNOVA_ALTO_MANDO = {
  "Anís": "shauntal", "Lotto": "grimsley", "Catleya": "caitlin", "Marshal": "marshal"
};

// Los Pokémon dominantes no son entrenadores: se usa su sprite de la forma dominante
// («pokemon:10121» es gumshoos-totem). Cuando la prueba cambia según la versión
// (Sol/Luna) se pone el de la primera.
const ALOLA = {
  "Kahuna Hala": "hala", "Kahuna Mayla": "olivia", "Kahuna Denio": "nanu",
  "Kahuna Hela": "hapu", "Kukui": "kukui",

  // Alto Mando (Hala y Mayla salen también antes como kahunas, con otro nombre)
  "Hala": "hala", "Mayla": "olivia", "Zarala": "acerola", "Kahili": "kahili",

  "Gumshoos / Raticate dominante": "pokemon:10121",
  "Lurantis dominante": "pokemon:10128",
  "Mimikyu dominante": "pokemon:10144",
  "Kommo-o dominante": "pokemon:10146"
};

const RETRATOS = {
  frlg: KANTO,

  // Fangame: los líderes de Kanto y los de Hoenn que aparecen de visita.
  // Urano y Sachiko son personajes propios y no tienen sprite.
  anil: {
    ...KANTO,
    "Koga y Sachiko": "koga",
    "Urano": "local:urano", // personaje propio de Añil: hay que poner la imagen a mano
    "Norman": "norman", "Candela": "flannery", "Alana": "winona", "Erico": "wattson",
    "Petra": "roxanne", "Marcial": "brawly", "Plubio": "wallace", "Vito y Leti": "tateandliza-gen6"
  },

  // Kanto (opcional, después de la Liga) y Rojo en el Monte Plateado
  hgss: {
    ...JOHTO,
    "Teniente Surge": "ltsurge", "Sabrina": "sabrina", "Misty": "misty", "Erika": "erika",
    "Sachiko": "janine", "Brock": "brock", "Blaine": "blaine", "Azul": "blue", "Rojo": "red"
  },

  // Fangame de Johto: los mismos líderes que HeartGold / SoulSilver
  vitro: JOHTO,

  oras: {
    "Petra": "roxanne", "Marcial": "brawly", "Erico": "wattson", "Candela": "flannery",
    "Norman": "norman", "Alana": "winona", "Vito y Leti": "tateandliza-gen6", "Plubio": "wallace",
    "Sixto": "sidney", "Fátima": "phoebe-gen6", "Nívea": "glacia", "Dracón": "drake-gen3",
    "Máximo": "steven"
  },

  dp: SINNOH,
  bdsp: SINNOH,
  platino: SINNOH,

  bw: {
    "Millo / Maíz / Zeo": "cilan", "Aloe": "lenora", "Camus": "burgh", "Camila": "elesa",
    "Yakón": "clay", "Gerania": "skyla", "Junco": "brycen", "Lirio / Iris": "drayden",
    ...UNOVA_ALTO_MANDO,
    "N": "n", "Ghechis": "ghetsis", "Mirto (Campeón)": "alder"
  },

  b2w2: {
    "Cheren": "cheren", "Hiedra": "roxie", "Camus": "burgh", "Camila": "elesa",
    "Yakón": "clay", "Gerania": "skyla", "Lirio": "drayden", "Ciprián": "marlon",
    ...UNOVA_ALTO_MANDO,
    "Iris": "iris"
  },

  xy: {
    "Violeta": "viola", "Lino": "grant", "Corelia": "korrina", "Amaro": "ramos",
    "Lem": "clemont", "Valeria": "valerie", "Ástrid": "olympia", "Édel": "wulfric",
    "Malva": "malva", "Tileo": "siebold", "Narciso": "wikstrom", "Drácena": "drasna",
    "Dianta": "diantha"
  },

  sm: {
    ...ALOLA,
    "Wishiwashi dominante": "pokemon:10127",
    "Salazzle / Marowak dominante": "pokemon:10129",
    "Vikavolt dominante": "pokemon:10122"
  },

  usum: {
    ...ALOLA,
    "Profesora Emily": "teacher",
    "Tilo": "hau",
    "Araquanid dominante": "pokemon:10153",
    "Marowak dominante": "pokemon:10149",
    "Togedemaru dominante": "pokemon:10154",
    "Ribombee dominante": "pokemon:10150",
    "Ultra Necrozma": "pokemon:10157"
  },

  swsh: {
    "Percy": "milo", "Cathy": "nessa", "Naboru": "kabu", "Judith / Alistair": "bea",
    "Sally": "opal", "Morris / Mel": "gordie", "Nerio": "piers", "Roy": "raihan",
    "Roxy": "marnie", "Paul": "hop", "Berto": "bede", "Lionel": "leon"
  }
};

// Tres orígenes según cómo empiece el valor del mapa:
//   "local:urano"   -> img/entrenadores/urano.png (personajes propios de los fangames)
//   "pokemon:10121" -> sprite de ese Pokémon (los dominantes de Alola)
//   lo demás        -> sprite de entrenador de Showdown
function urlRetrato(archivo) {
  if (archivo.startsWith("local:")) return `img/entrenadores/${archivo.slice("local:".length)}.png`;
  if (archivo.startsWith("pokemon:")) return urlSpritePixel(archivo.slice("pokemon:".length));
  return `${URL_ENTRENADORES}${archivo}.png`;
}

// Dirección del retrato de un combate de un juego de la web, o "" si no tiene
export function retratoDeLaWeb(idJuego, nombre) {
  const archivo = (RETRATOS[idJuego] || {})[nombre];
  return archivo ? urlRetrato(archivo) : "";
}

// Todos los personajes con retrato, sin repetir, en el orden de los juegos:
// [{ nombre, imagen, buscar }] (nombre: en el idioma de la web; buscar: en los dos, en
// minúsculas y sin acentos)
let personajes = null;

export function personajesDeLaWeb() {
  if (personajes) return personajes;
  const vistos = new Set();
  personajes = [];
  for (const juego of JUEGOS) {
    for (const combate of COMBATES[juego.id] || []) {
      const imagen = retratoDeLaWeb(juego.id, combate.nombre);
      if (!imagen || vistos.has(imagen)) continue;
      vistos.add(imagen);
      const nombre = textoDeCombate(combate.nombre);
      personajes.push({
        nombre,
        imagen,
        buscar: `${combate.nombre} ${nombre}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      });
    }
  }
  return personajes;
}
