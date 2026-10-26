// Lugares de captura de cada juego para la sección «Rutas».
// Solo están los lugares donde se puede capturar al menos un Pokémon salvaje
// (hierba, cuevas, surf, pesca, golpe roca, cabezazo...). Comprobado con los datos de
// encuentros de PokeAPI y WikiDex; Pokémon Añil con Fakedex (fakedex.es/anil).
//
// Cada juego (mismo id que en js/comun/juegos.js) tiene estos apartados:
//   rutas:    rutas y zonas naturales
//   ciudades: ciudades y pueblos
//   postgame: (opcional) lugares a los que solo se llega después de la Liga
//   eventos:  Pokémon de evento, regalo y estáticos. Formato "Lugar: detalle" (el lugar sale en negrita).
// Un juego puede usar otros apartados indicándolos en «apartados» (Alola va por islas).
// Si se cambia el nombre de un lugar, se pierde su marca (se guarda por nombre).

import { LUGARES_EN } from "./lugares-en.js";
import { enIngles } from "../comun/idioma.js";

// Un lugar en el idioma de la web («Ruta 3» -> «Route 3»). Se guarda y se compara en español;
// los que no están en LUGARES_EN (los escritos a mano) salen tal cual.
export function nombreDeLugar(texto) {
  return (enIngles && LUGARES_EN[texto]) || texto;
}

// "Ruta 101" ... "Ruta 134"
function rango(desde, hasta) {
  return Array.from({ length: hasta - desde + 1 }, (_, i) => `Ruta ${desde + i}`);
}

// ---------- Alola (Sol / Luna y Ultrasol / Ultraluna comparten mapa) ----------
// En Alola los lugares van por islas (rutas y ciudades juntas) en vez de por tipo.

const APARTADOS_ALOLA = [
  { clave: "melemele", titulo: "Melemele" },
  { clave: "akala", titulo: "Akala" },
  { clave: "ulaula", titulo: "Ula-Ula" },
  { clave: "poni", titulo: "Poni" },
  { clave: "eventos", titulo: "Pokémon de evento" }
];

const ISLAS_ALOLA = {
  apartados: APARTADOS_ALOLA,
  melemele: [
    "Ruta 1", "Ruta 1 (Afueras de Hauoli)", "Ruta 1 (Escuela de Entrenadores)",
    "Ciudad Hauoli (Paseo Marítimo)", "Ciudad Hauoli (Zona Comercial)", "Ruta 2", "Cementerio de Hauoli",
    "Ruta 3", "Cueva Sotobosque", "Jardines de Melemele", "Bahía Kalae", "Cueva Costera", "Mar de Melemele", "Gruta Unemar",
    "Colina Dequilate", "Colina Dequilate (Caldera Remota)"
  ],
  akala: [
    "Ruta 4", "Pueblo Ohana", "Rancho Ohana", "Ruta 5", "Colina Saltagua", "Ruta 6", "Ruta 7",
    "Área Volcánica del Wela", "Ruta 8", "Jungla Umbría", "Túnel Diglett", "Ruta 9", "Colina del Recuerdo",
    "Afueras de Akala", "Playa de Hanohano"
  ],
  ulaula: [
    "Ruta 10", "Pico Hokulani", "Ciudad Malíe (Cabo de las Afueras)", "Parque de Malíe", "Ruta 11", "Ruta 12",
    "Monte Rubor", "Ruta 13", "Desierto de Haina", "Aldea Tapu", "Ruta 14", "Supermercado Ultraganga",
    "Ruta 15", "Ruta 16", "Jardines de Ula-Ula", "Ruta 17", "Playa Menor", "Monte Lanakila"
  ],
  poni: [
    "Aldea Marina", "Isla Exeggutor", "Cañón de Poni", "Antiguo Paso de Poni", "Arrecife de Poni",
    "Llanura de Poni", "Bosque de Poni", "Prado de Poni", "Jardines de Poni", "Pendiente de Poni",
    "Costa de Poni", "Gruta Desenlace"
  ]
};

// ---------- Sinnoh (Diamante / Perla y Platino tienen los mismos lugares con Pokémon salvajes) ----------

const RUTAS_SINNOH = [
  ...rango(201, 230),
  "Orilla Valor", "Orilla Agudeza", "Puerta Pirita", "Mina Pirita", "Prado Aromaflor", "Valle Eólico",
  "Bosque Vetusto", "Vieja Mansión", "Cueva Extravío", "Monte Corona", "Torre Perdida", "Ruinas Sosiego",
  "Mina Ruinamaníaco", "Gran Pantano", "Jardín Trofeo", "Senda Desolada", "Fuente Despedida",
  "Cueva Retorno", "Isla Hierro", "Lago Valor", "Lago Agudeza", "Lago Veraz", "Templo Puntaneva",
  "Calle Victoria", "Liga Pokémon", "Forja Fuego", "Montaña Dura"
];

const CIUDADES_SINNOH = [
  "Pueblo Hojaverde", "Ciudad Vetusta", "Ciudad Pradera", "Pueblo Caelestis", "Ciudad Canal",
  "Ciudad Marina", "Zona Descanso"
];

// Los eventos de Sinnoh, comprobados con los regalos y estáticos de cada juego (sus scripts). Cada uno tiene los suyos:
// el Huevo de Togepi y Porygon son de Platino; el Huevo de Happiny, de Diamante / Perla y los remakes; Eevee, de
// Diamante / Perla y Platino. El fósil del Museo de Ciudad Pirita no: depende de que salga uno en el Subsuelo (y en la
// partida se apunta en Ciudad Pirita, que no es ruta). Darkrai, Shaymin y Arceus tampoco: solo con objetos de evento
const ESTATICOS_SINNOH = [
  "Valle Eólico: Drifloon (estático los viernes)",
  "Vieja Mansión: Rotom (estático en el televisor, de noche)",
  "Ruta 209: Spiritomb (Torre Sagrada activada)"
];
const LAGOS_SINNOH = [
  "Lago Agudeza: Uxie (estático)",
  "Lago Valor: Azelf (estático)",
  "Mesprit: errante por Sinnoh",
  "Cresselia: errante por Sinnoh (después de verla en la Isla Plenilunio)"
];
const EVENTOS_DP = [
  "Ruta 201: Pokémon inicial",
  "Ciudad Corazón: Eevee (regalo de Teo)",
  "Ciudad Corazón: Huevo de Happiny (regalo)",
  "Isla Hierro: Huevo de Riolu (regalo de Quinoa)",
  ...ESTATICOS_SINNOH,
  "Columna Lanza: Dialga o Palkia (estático obligatorio)",
  ...LAGOS_SINNOH,
  "Cueva Retorno: Giratina (estático)",
  "Montaña Dura: Heatran (estático)",
  "Templo Puntaneva: Regigigas (estático)"
];

// ---------- Kanto (Pokémon Añil tiene los mismos eventos que Rojo Fuego / Verde Hoja) ----------

const EVENTOS_KANTO = [
  "Pueblo Paleta: Pokémon inicial",
  "Ruta 4: Magikarp (comprado en el Centro Pokémon)",
  "Silph S.A. (Ciudad Azafrán): Lapras (regalo en el piso 7)",
  "Dojo Lucha (Ciudad Azafrán): Hitmonlee o Hitmonchan",
  "Mansión Azulona (Ciudad Azulona): Eevee",
  "Casino de Ciudad Azulona: Comprándolos",
  "Ruta 12 o Ruta 16: Snorlax (estático)",
  "Central Energía: Zapdos (estático)",
  "Islas Espuma: Articuno (estático)",
  "Monte Ascuas (Isla Prima): Moltres (estático)",
  "Cueva Celeste: Mewtwo (estático)",
  "Perro legendario errante: Raikou / Entei / Suicune (según tu inicial)"
];

// ---------- Juegos ----------
// postgame: lugares a los que solo se llega después de la Liga (rutas y ciudades juntas)

export const LUGARES = {
  frlg: {
    rutas: [
      ...rango(1, 25),
      "Bosque Verde", "Monte Moon", "Cueva Diglett", "Muelle del S.S. Anne", "Túnel Roca", "Torre Pokémon",
      "Central Energía", "Zona Safari", "Mansión Pokémon", "Islas Espuma", "Calle Victoria",
      "Camino Candente (Isla Prima)", "Playa Tesoro (Isla Prima)", "Monte Ascuas (Isla Prima)",
      "Cabo Extremo (Isla Secunda)", "Puente Unión (Isla Tera)", "Puerto Isla Tera (Isla Tera)",
      "Bosque Baya (Isla Tera)"
    ],
    ciudades: [
      "Pueblo Paleta", "Ciudad Verde", "Ciudad Celeste", "Ciudad Carmín", "Ciudad Azulona", "Ciudad Fucsia",
      "Isla Canela", "Isla Prima"
    ],
    // Islas Sete 4 a 7 (se abren con el Multipase después de la Liga) y Cueva Celeste
    postgame: [
      "Cueva Celeste",
      "Isla Quarta", "Cueva Glaciada (Isla Quarta)",
      "Isla Inta", "Prado Isla Inta (Isla Inta)", "Lugar de Recreo (Isla Inta)", "Aquarinto (Isla Inta)",
      "Pilar Recuerdo (Isla Inta)", "Cueva Perdida (Isla Inta)",
      "Vía Verde (Isla Exta)", "Vía Acuática (Isla Exta)", "Bosquejo (Isla Exta)", "Valle Ruinas (Isla Exta)",
      "Isla Aislada (Isla Exta)", "Cueva Cambiante (Isla Exta)",
      "Entrada al Cañón (Isla Sétima)", "Cañón Sétano (Isla Sétima)", "Ruinas Sete (Isla Sétima)",
      "Cámaras Sete (Isla Sétima)", "Torre Desafío (Isla Sétima)"
    ],
    eventos: EVENTOS_KANTO
  },

  // Pokémon Añil (fangame). Lugares y encuentros: fakedex.es/anil
  anil: {
    rutas: [
      "Ruta 1", "Ruta 2 Sur", "Ruta 2 Norte", "Ruta 3", "Ruta 4", "Ruta 5", "Ruta 6", "Ruta 7", "Ruta 8",
      "Ruta 9", "Ruta 10 Norte", "Ruta 10 Sur", "Ruta 11", "Ruta 12 Norte", "Ruta 12 Sur", "Ruta 13",
      "Ruta 14", "Ruta 15", "Ruta 16", "Ruta 17", "Ruta 18", "Ruta 19", "Ruta 20", "Ruta 21", "Ruta 22",
      "Ruta 23", "Ruta 25",
      "Bosque Verde", "Monte Moon Exterior", "Monte Moon", "Túnel Diglett", "Túnel Roca", "Torre Pokémon",
      "Camino de Bicis", "Zona Safari 1", "Zona Safari 2", "Zona Safari 3", "Zona Safari 4",
      "Central Eléctrica", "Islas Espuma", "Mansión Quemada", "Volcán Canela", "Cataratas Tohjo",
      "Bosque Celeste", "Cueva Celeste", "Monte Plateado", "Claro Oculto"
    ],
    ciudades: [
      "Pueblo Paleta", "Ciudad Verde", "Ciudad Plateada", "Ciudad Celeste", "Pueblo Lavanda", "Ciudad Carmín",
      "Ciudad Azulona", "Pueblo Marengo", "Ciudad Fucsia", "Ciudad Azafrán", "Isla Canela", "Ciudad Añil"
    ],
    // Islas del final (al este del mapa)
    postgame: [
      "Ruta 26", "Villa Azabache", "Cabo Azabache", "Ruta 27", "Islote Recuerdo", "Almacén Secreto",
      "Ruta 28", "Villa Magenta", "Cabo Magenta", "Villa Ámbar", "Ruta 29", "Ruta 30", "Cueva Glaciada",
      "Bosque Arcoíris"
    ],
    eventos: EVENTOS_KANTO
  },

  hgss: {
    rutas: [
      "Ruta 29", "Ruta 30", "Ruta 31", "Cueva Oscura", "Torre Bellsprout", "Ruta 32", "Cueva Unión",
      "Ruinas Alfa", "Ruta 33", "Pozo Slowpoke", "Encinar", "Ruta 34", "Ruta 35", "Parque Nacional",
      "Ruta 36", "Ruta 37", "Torre Quemada", "Torre Campana (Torre Hojalata)", "Ruta 38", "Ruta 39",
      "Ruta 40", "Ruta 41", "Islas Remolino", "Ruta 42", "Monte Mortero", "Ruta 43", "Lago de la Furia",
      "Ruta 44", "Ruta Helada", "Guarida Dragón", "Ruta 45", "Ruta 46", "Ruta 47", "Cueva Acantilado",
      "Ruta 48", "Entrada Zona Safari", "Zona Safari", "Cataratas Tohjo", "Monte Plateado"
    ],
    ciudades: [
      "Pueblo Primavera", "Ciudad Cerezo", "Ciudad Malva", "Pueblo Azalea", "Ciudad Iris", "Ciudad Olivo",
      "Ciudad Orquídea", "Ciudad Endrino"
    ],
    eventos: [
      "Pueblo Primavera: Pokémon inicial",
      "Ciudad Malva: Huevo de Togepi (entregado por el ayudante del Prof. Elm)",
      "Ciudad Malva: Huevos especiales de Primo (Mareep / Wooper / Slugma)",
      "Ruta 35: Spearow «Kenya» (entregado por el guardia de la puerta)",
      "Ciudad Trigal: Eevee (regalo de Bill en su casa)",
      "Casino de Ciudad Trigal: Comprándolos",
      "Ruta 36: Sudowoodo (estático)",
      "Cueva Unión: Lapras (estático los viernes)",
      "Ciudad Orquídea: Shuckle (regalo de un personaje)",
      "Monte Mortero: Tyrogue (regalo del Rey del Kárate)",
      "Lago de la Furia: Gyarados rojo (estático)",
      "Escondite del Team Rocket: Voltorb, Koffing, Geodude y Electrode (Poké Balls trampa, en Pueblo Caoba)",
      "Guarida Dragón: Dratini (regalo tras la prueba del anciano)",
      "Torre Campana (Torre Hojalata): Ho-Oh (estático)",
      "Islas Remolino: Lugia (estático)",
      "Raikou y Entei: errantes por Johto (después de la Torre Quemada)",
      "Ruta 25: Suicune (estático)",
      "Torre Oculta: Groudon o Kyogre (según la versión) y Rayquaza (estáticos después de la Liga)",
      "Pueblo Paleta: Bulbasaur, Charmander o Squirtle (regalo del Prof. Oak después de vencer a Rojo)",
      "Ciudad Azafrán: Treecko, Torchic o Mudkip (regalo de Máximo)",
      "Ruta 11 / Ruta 12: Snorlax (estático)",
      "Ruta 10: Zapdos (estático)",
      "Islas Espuma: Articuno (estático)",
      "Cueva del Monte Plateado: Moltres (estático)",
      "Cueva Celeste: Mewtwo (estático)"
    ]
  },

  oras: {
    rutas: [
      ...rango(101, 134),
      "Bosque Petalia", "Túnel Fervergal", "Cueva Granito", "Malvamar", "Senda Ígnea", "Desfiladero",
      "Cascada Meteoro", "Zona Safari", "Monte Pírico", "Cueva Cardumen", "Caverna Abisal", "Cueva Ancestral",
      "Calle Victoria", "Pilar Celeste", "Malvalanova", "Gruta Solar",
      "Bosque Espejismo", "Cueva Espejismo", "Isla Espejismo", "Monte Espejismo"
    ],
    ciudades: [
      "Ciudad Petalia", "Pueblo Azuliza", "Ciudad Portual", "Ciudad Calagua", "Ciudad Algaria", "Arrecípolis",
      "Pueblo Oromar", "Ciudad Colosalia"
    ],
    eventos: [
      "Villa Raíz / Ruta 101: Pokémon inicial",
      "Ciudad Portual: Pikachu Coqueta",
      "Pueblo Lavacalda: Huevo de Wynaut (anciana junto a los baños termales)",
      "Ruta 119: Castform (regalo en el Instituto Meteorológico)",
      "Ruta 118 / Isla del Sur: Latios o Latias (se une a tu equipo)",
      "Ruta 119 / Ruta 120: Kecleon (estáticos)",
      "Malvamar: Spiritomb (estático)",
      "Casa de Máximo (Ciudad Algaria): Beldum",
      "Ruinas del Desierto (Ruta 111): Regirock (estático)",
      "Cueva Insular (Ruta 105): Regice (estático)",
      "Tumba Antigua (Ruta 120): Registeel (estático)",
      "Cueva Ancestral: Groudon o Kyogre (estático)",
      "Pilar Celeste: Rayquaza y Deoxys (estáticos durante el Episodio Delta)"
    ]
  },

  dp: {
    rutas: RUTAS_SINNOH,
    ciudades: CIUDADES_SINNOH,
    eventos: EVENTOS_DP
  },

  // Diamante Brillante / Perla Reluciente: mismo mapa que Diamante / Perla más las Grutas del Subsuelo
  bdsp: {
    rutas: [...RUTAS_SINNOH, "Grutas del Subsuelo"],
    ciudades: CIUDADES_SINNOH,
    eventos: [
      "Ruta 201: Pokémon inicial",
      "Ciudad Corazón: Huevo de Happiny (regalo)",
      "Isla Hierro: Huevo de Riolu (regalo de Quinoa)",
      ...ESTATICOS_SINNOH,
      "Columna Lanza: Dialga o Palkia (estático obligatorio)",
      ...LAGOS_SINNOH,
      "Cueva Retorno: Giratina (estático)",
      "Montaña Dura: Heatran (estático)",
      "Templo Puntaneva: Regigigas (estático)",
      "Parque Hansa: Legendarios de otras regiones (estáticos después de la Liga)"
    ]
  },

  platino: {
    rutas: RUTAS_SINNOH,
    ciudades: CIUDADES_SINNOH,
    eventos: [
      "Ruta 201: Pokémon inicial",
      "Ciudad Vetusta: Huevo de Togepi (regalo de Cintia)",
      "Ciudad Corazón: Eevee (regalo de Teo)",
      "Ciudad Rocavelo: Porygon (regalo en una casa)",
      "Isla Hierro: Huevo de Riolu (regalo de Quinoa)",
      ...ESTATICOS_SINNOH,
      "Mundo Distorsión: Giratina (estático)",
      ...LAGOS_SINNOH,
      "Columna Lanza: Dialga / Palkia (estáticos después de la Liga)",
      "Montaña Dura: Heatran (estático)",
      "Templo Puntaneva: Regigigas (estático)",
      "Ruinas Pico Roca: Regirock (estático, con Regigigas en el equipo)",
      "Ruinas Iceberg: Regice (estático, con Regigigas en el equipo)",
      "Ruinas Hierro: Registeel (estático, con Regigigas en el equipo)"
    ]
  },

  bw: {
    rutas: [
      ...rango(1, 18),
      "Cueva Manantial", "Solar de los Sueños", "Bosque Perdidos", "Bosque Azulejo", "Zona Desierto",
      "Castillo Ancestral", "Almacenes Frigoríficos", "Puente de Fayenza", "Cueva Electrorroca", "Cueva Loza",
      "Torre de los Cielos", "Monte Tuerca", "Torre Dracoespiral", "Pantano Teja", "Puente Aldea",
      "Bahía Arenisca", "Calle Victoria", "Cámara Orientación", "Cámara de Pruebas", "Boquete Gigante",
      "Gruta Superación", "Puente Maravilla", "Santuario Abundancia", "Laboratorio P2",
      "Bosque Blanco (solo Edición Blanca)"
    ],
    ciudades: ["Ciudad Gres", "Ciudad Fayenza", "Ciudad Teja", "Pueblo Arenisca"],
    eventos: [
      "Pueblo Arcilla: Pokémon inicial",
      "Solar de los Sueños: Mono elemental (Pansage / Pansear / Panpour según tu inicial)",
      "Solar de los Sueños: Musharna (estático)",
      "Puente Maravilla: Magikarp (de un personaje)",
      "Ruta 18: Huevo de Larvesta (regalo en la casa de la playa)",
      "Zona Desierto: Darmanitan (estáticos en las estatuas)",
      "Castillo Ancestral: Volcarona (estático en el nivel más profundo)",
      "Cámara Orientación: Cobalion (estático, en la Cueva Loza)",
      "Claro Filosofía: Virizion (estático, en el Bosque Azulejo)",
      "Cámara de Pruebas: Terrakion (estático, en la Calle Victoria)",
      "Palacio de N: Reshiram o Zekrom (estático obligatorio)",
      "Boquete Gigante: Kyurem (estático)",
      "Tornadus o Thundurus: errante por Teselia (según la versión)",
      "Santuario Abundancia: Landorus (estático, con Tornadus y Thundurus en el equipo)"
    ]
  },

  b2w2: {
    rutas: [
      ...rango(1, 9), ...rango(11, 23),
      "Rancho Ocre", "Polígono Hormigón", "Cloacas Porcelana", "Pasadizo Ancestral", "Castillo Ancestral",
      "Zona Desierto", "Gruta Marina", "Montaña Reversia", "Quinta Horroris", "Bosque Azulejo",
      "Solar de los Sueños", "Cueva Manantial", "Puente de Fayenza", "Cueva Electrorroca", "Cueva Loza",
      "Torre de los Cielos", "Monte Tuerca", "Torre Dracoespiral", "Pantano Teja", "Puente Aldea",
      "Bosque Perdidos", "Santuario Abundancia", "Bahía Arenisca", "Túnel Yakón", "Ruinas Subterráneas",
      "Puente Maravilla", "Reserva Natural", "Laboratorio P2", "Boquete Gigante", "Calle Victoria",
      "Cámara Orientación"
    ],
    ciudades: [
      "Ciudad Engobe", "Ciudad Hormigón", "Ciudad Gres", "Ciudad Porcelana", "Ciudad Teja",
      "Pueblo Arenisca", "Ciudad Marga"
    ],
    eventos: [
      "Ciudad Engobe: Pokémon inicial",
      "Ciudad Fayenza: Zorua de N (regalo de Rodo)",
      "Ruta 6: Deerling (regalo en el Instituto Meteorológico)",
      "Ciudad Porcelana: Eevee (regalo de Aroma en su edificio)",
      "Acceso Esmalte: Huevo de Happiny (regalo)",
      "Puente Maravilla: Magikarp (de un personaje)",
      "Pueblo Ocre: Gible o Dratini variocolor (regalo tras superar la Torre Negra / el Árbol Blanco)",
      "Reserva Natural: Haxorus variocolor (estático)",
      "Castillo Ancestral: Volcarona (estático, nivel 35)",
      "Ruta 4: Braviary o Mandibuzz (estático, según la versión)",
      "Gruta Marina: Crustle (estático)",
      "Bahía Arenisca: Jellicent (estático)",
      "Ruta 13: Cobalion (estático)",
      "Ruta 11: Virizion (estático)",
      "Ruta 22: Terrakion (estático)",
      "Ciudad Esmalte: Uxie (estático, después de la Cueva Psique)",
      "Torre de los Cielos: Mesprit (estático, después de la Cueva Psique)",
      "Ruta 23: Azelf (estático, después de la Cueva Psique)",
      "Puente Maravilla: Cresselia (estático)",
      "Montaña Reversia: Heatran (estático)",
      "Sala Pico Roca: Regirock (estático)",
      "Sala Iceberg: Regice (estático)",
      "Sala Hierro: Registeel (estático)",
      "Monte Tuerca: Regigigas (estático, con Regirock, Regice y Registeel en el equipo)",
      "Solar de los Sueños: Latias o Latios (estático después de la Liga, según la versión)",
      "Torre Dracoespiral: Reshiram o Zekrom (estático después de la Liga, según la versión)",
      "Boquete Gigante: Kyurem (estático después de la Liga)"
    ]
  },

  xy: {
    rutas: [
      ...rango(2, 22),
      "Bosque de Novarte", "Palacio Cénit", "Gruta Tierraunida", "Cueva Brillante", "Cueva Reflejos",
      "Bahía Azul", "Hotel Desolación", "Gruta Helada", "Cueva Desenlace", "Villa Pokémon", "Calle Victoria",
      "Safari Amistad"
    ],
    ciudades: ["Pueblo Petroglifo", "Ciudad Relieve", "Ciudad Yantra", "Ciudad Romantis", "Pueblo Mosaico"],
    eventos: [
      "Pueblo Acuarela: Inicial de Kalos",
      "Ciudad Luminalia: Inicial de Kanto",
      "Ruta 7: Snorlax (estático)",
      "Ciudad Yantra: Lucario (regalo de Corelia en la Torre Maestra)",
      "Ruta 12: Lapras (regalo de un personaje en el puente)",
      "Guarida del Team Flare: Xerneas o Yveltal (estático obligatorio)",
      "Cueva Desenlace: Zygarde (estático)",
      "Mazmorra Rara: Mewtwo (estático)",
      "Cueva Talasia: Ave legendaria errante"
    ]
  },

  sm: {
    ...ISLAS_ALOLA,
    eventos: [
      "Pueblo Lilii: Pokémon inicial",
      "Casa Æther (Ruta 15): Porygon (regalo de un personaje)",
      "Aldea Marina: Aerodactyl (regalo en el restaurante)",
      "Paraíso Æther: Código Cero (regalo después de la Liga)",
      "Altar del Sol / Altar de la Luna: Solgaleo o Lunala (estático)",
      "Ruinas de la Guerra: Tapu Koko (estático)",
      "Ruinas de la Vida: Tapu Lele (estático)",
      "Ruinas de la Cosecha: Tapu Bulu (estático)",
      "Ruinas del Tránsito: Tapu Fini (estático)",
      "Ruta 5: Huevo de Eevee (regalo en la guardería)",
      "Lago del Sol / Lago de la Luna: Cosmog (regalo después de la Liga)",
      "Colina Dequilate (Caldera Remota): Necrozma (estático después de la Liga)",
      "Ruta 16: Zygarde (con el Cubo Zygarde y sus células)",
      "Ultraentes: en sus zonas (misiones después de la Liga)"
    ]
  },

  usum: {
    ...ISLAS_ALOLA,
    // En Ultrasol / Ultraluna Akala tiene dos lugares más: la sala del dominante de la Colina
    // Saltagua y el Túnel del Volcán, justo después del Área Volcánica
    akala: ISLAS_ALOLA.akala.flatMap((lugar) => {
      if (lugar === "Colina Saltagua") return [lugar, "Colina Saltagua (Sala del dominante)"];
      if (lugar === "Área Volcánica del Wela") return [lugar, "Túnel del Volcán"];
      return [lugar];
    }),
    eventos: [
      "Ruta 1: Pokémon inicial",
      "Ultrópolis: Poipole (regalo de los Ultraguardianes)",
      "Monte Lanakila: Necrozma (estático)",
      "Casa Æther (Ruta 15): Porygon",
      "Aldea Marina: Aerodactyl",
      "Paraíso Æther: Código Cero",
      "Ultraespacio Cero: Legendarios y Ultraentes en sus dimensiones"
    ]
  },

  swsh: {
    rutas: [
      ...rango(1, 10),
      "Túnel de la Ruta 9", "Bosque Oniria", "Bosque Lumirinto", "Mina de Galar", "Mina de Galar n.º 2",
      "Afueras de Pistón",
      // Área Silvestre
      "Pradera Radiante", "Arboleda Claroscuro", "Lago Axew (oeste)", "Lago Axew (este)", "Ojo de Axew",
      "Lago Milotic (norte)", "Lago Milotic (sur)", "Silla del Gigante", "Antigua Atalaya", "Ribera de Pistón",
      "Valle Entrepuentes", "Llanura Pétrea", "Espejo del Gigante", "Cuenca Polvorienta", "Gorro del Gigante",
      "Lago del Enfado", "Cornisa de Artejo"
    ],
    ciudades: ["Ciudad Pistón", "Pueblo Amura"],
    eventos: [
      "Pueblo Yarda: Pokémon inicial",
      "Guardería de la Ruta 5: Toxel (regalo de un personaje)",
      "Torre Rose (Ciudad Puntera): Eternatus (estático obligatorio)",
      "Bosque Oniria: Zacian o Zamazenta (estático)",
      "Torre Batalla (Ciudad Puntera): Código Cero (regalo de la encargada)"
    ]
  }
};

// ---------- Pueblos con hierba (randomizer) ----------
// Con «Hierba en los pueblos» (js/randomizer/hierba-gen4.js, hierba-gen5.js y hierba-3ds.js) estos pueblos,
// donde no se podía capturar nada, tienen Pokémon de hierba. Un locke con esa norma los ve en
// «Ciudades y pueblos», junto a los demás y en el orden de la historia.

const PUEBLOS_HIERBA_SINNOH = [
  "Pueblo Arena", "Ciudad Jubileo", "Ciudad Pirita", "Pueblo Aromaflor", "Ciudad Corazón", "Pueblo Sosiego",
  "Ciudad Rocavelo", "Ciudad Puntaneva", "Zona de Combate", "Zona Sobrevivir"
];
const ORDEN_SINNOH = [
  "Pueblo Hojaverde", "Pueblo Arena", "Ciudad Jubileo", "Ciudad Pirita", "Pueblo Aromaflor", "Ciudad Vetusta",
  "Ciudad Corazón", "Pueblo Sosiego", "Pueblo Caelestis", "Ciudad Rocavelo", "Ciudad Pradera", "Ciudad Canal",
  "Ciudad Puntaneva", "Ciudad Marina", "Zona de Combate", "Zona Sobrevivir", "Zona Descanso"
];

const PUEBLOS_HIERBA = {
  xy: {
    nuevos: ["Pueblo Vánitas", "Ciudad Novarte", "Pueblo Crómlech", "Ciudad Témpera", "Pueblo Fresco", "Ciudad Fluxus", "Ciudad Batik", "Ciudad Fractal"],
    orden: [
      "Pueblo Vánitas", "Ciudad Novarte", "Pueblo Petroglifo", "Ciudad Relieve", "Pueblo Crómlech", "Ciudad Yantra", "Ciudad Romantis",
      "Ciudad Témpera", "Pueblo Fresco", "Ciudad Fluxus", "Ciudad Batik", "Ciudad Fractal", "Pueblo Mosaico"
    ]
  },
  oras: {
    nuevos: ["Pueblo Escaso", "Ciudad Férrica", "Ciudad Malvalona", "Pueblo Verdegal", "Pueblo Pardal", "Pueblo Lavacalda", "Ciudad Arborada"],
    orden: [
      "Pueblo Escaso", "Ciudad Petalia", "Ciudad Férrica", "Pueblo Azuliza", "Ciudad Portual", "Ciudad Malvalona", "Pueblo Verdegal",
      "Pueblo Pardal", "Pueblo Lavacalda", "Ciudad Arborada", "Ciudad Calagua", "Ciudad Algaria", "Arrecípolis", "Pueblo Oromar",
      "Ciudad Colosalia"
    ]
  },
  dp: { nuevos: PUEBLOS_HIERBA_SINNOH, orden: ORDEN_SINNOH },
  platino: { nuevos: PUEBLOS_HIERBA_SINNOH, orden: ORDEN_SINNOH },
  hgss: {
    nuevos: ["Ciudad Trigal", "Pueblo Caoba", "Pueblo Lavanda", "Ciudad Azafrán"],
    orden: [
      "Pueblo Primavera", "Ciudad Cerezo", "Ciudad Malva", "Pueblo Azalea", "Ciudad Trigal", "Ciudad Iris",
      "Ciudad Olivo", "Ciudad Orquídea", "Pueblo Caoba", "Ciudad Endrino", "Pueblo Lavanda", "Ciudad Azafrán"
    ]
  },
  bw: {
    nuevos: ["Pueblo Arcilla", "Pueblo Terracota", "Ciudad Esmalte", "Ciudad Mayólica", "Ciudad Loza", "Ciudad Caolín", "Pueblo Ladrillo"],
    orden: [
      "Pueblo Arcilla", "Ciudad Gres", "Pueblo Terracota", "Ciudad Esmalte", "Ciudad Mayólica", "Ciudad Fayenza",
      "Ciudad Loza", "Ciudad Teja", "Ciudad Caolín", "Pueblo Ladrillo", "Pueblo Arenisca"
    ]
  },
  b2w2: {
    nuevos: [
      "Pueblo Ocre", "Ciudad Mayólica", "Ciudad Fayenza", "Ciudad Loza", "Pueblo Chamota", "Pueblo Ladrillo",
      "Ciudad Caolín", "Pueblo Terracota", "Ciudad Esmalte", "Pueblo Arcilla"
    ],
    orden: [
      "Ciudad Engobe", "Pueblo Ocre", "Ciudad Hormigón", "Ciudad Porcelana", "Ciudad Mayólica", "Ciudad Fayenza",
      "Ciudad Loza", "Pueblo Chamota", "Pueblo Arenisca", "Pueblo Ladrillo", "Ciudad Caolín", "Ciudad Marga",
      "Ciudad Teja", "Ciudad Gres", "Pueblo Terracota", "Ciudad Esmalte", "Pueblo Arcilla"
    ]
  }
};

// Los lugares de un juego de la web; con hierba, sus ciudades llevan además las de la hierba
export function lugaresDelJuego(idJuego, conHierba = false) {
  const lugares = LUGARES[idJuego];
  const extra = PUEBLOS_HIERBA[idJuego];
  if (!lugares || !conHierba || !extra) return lugares;
  const todas = new Set([...(lugares.ciudades || []), ...extra.nuevos]);
  const enOrden = extra.orden.filter((pueblo) => todas.has(pueblo));
  return { ...lugares, ciudades: [...enOrden, ...[...todas].filter((pueblo) => !extra.orden.includes(pueblo))] };
}
