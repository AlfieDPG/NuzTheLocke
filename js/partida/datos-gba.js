// ---------- Datos de las partidas de GBA (Rojo Fuego / Verde Hoja) ----------
//
// Sacados de PKHeX (github.com/kwsch/PKHeX) y del decomp de Rojo Fuego (github.com/pret/pokefirered).

// Las letras del juego (las de Europa y América; 0xFF acaba el texto)
export const LETRAS_GEN3 = [
  " ", "À", "Á", "Â", "Ç", "È", "É", "Ê", "Ë", "Ì", "", "Î", "Ï", "Ò", "Ó", "Ô",
  "Œ", "Ù", "Ú", "Û", "Ñ", "ß", "à", "á", "", "ç", "è", "é", "ê", "ë", "ì", "",
  "î", "ï", "ò", "ó", "ô", "œ", "ù", "ú", "û", "ñ", "º", "ª", "", "&", "+", "",
  "", "", "", "", "", "=", ";", "", "", "", "", "", "", "", "", "",
  "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  "", "¿", "¡", "", "", "", "", "", "", "", "Í", "%", "(", ")", "", "",
  "", "", "", "", "", "", "", "", "â", "", "", "", "", "", "", "í",
  "", "", "", "", "", "", "", "", "", "↑", "↓", "←", "+", "", "", "",
  "", "", "", "", "", "<", ">", "", "", "", "", "", "", "", "", "",
  "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  "", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "!", "?", ".", "-", "·",
  "…", "“", "”", "‘", "'", "♂", "♀", "$", ",", "×", "/", "A", "B", "C", "D", "E",
  "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
  "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k",
  "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "►",
  ":", "Ä", "Ö", "Ü", "ä", "ö", "ü"
];

// Las especies de Hoenn van en otro orden dentro del juego: el número de la Pokédex Nacional de
// las que el juego numera del 277 al 411 (de la 1 a la 251 es el mismo; del 252 al 276, nada)
export const ESPECIES_GEN3 = [
  252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271,
  272, 273, 274, 275, 290, 291, 292, 276, 277, 285, 286, 327, 278, 279, 283, 284, 320, 321, 300, 301,
  352, 343, 344, 299, 324, 302, 339, 340, 370, 341, 342, 349, 350, 318, 319, 328, 329, 330, 296, 297,
  309, 310, 322, 323, 363, 364, 365, 331, 332, 361, 362, 337, 338, 298, 325, 326, 311, 312, 303, 307,
  308, 333, 334, 360, 355, 356, 315, 287, 288, 289, 316, 317, 357, 293, 294, 295, 366, 367, 368, 359,
  353, 354, 336, 335, 369, 304, 305, 306, 351, 313, 314, 345, 346, 347, 348, 280, 281, 282, 371, 372,
  373, 374, 375, 376, 377, 378, 379, 382, 383, 384, 380, 381, 385, 386, 358
];

// Los objetos también van numerados de otra forma: su número desde la 4.ª generación (el que
// usa la web), por el del juego; 0 los que no existen después
export const OBJETOS_GEN3 = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 65,
  66, 67, 68, 69, 43, 44, 70, 71, 72, 73, 74, 75, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 45, 46, 47, 48, 49, 50, 51, 52, 53, 0, 55, 56, 57, 58, 59, 60, 61,
  63, 64, 0, 76, 77, 78, 79, 0, 0, 0, 0, 0, 0, 80, 81, 82, 83, 84, 85, 0,
  0, 0, 0, 86, 87, 0, 88, 89, 90, 91, 92, 93, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 149, 150, 151, 152, 153, 154, 155,
  156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
  176, 177, 178, 179, 180, 181, 182, 183, 201, 202, 203, 204, 205, 206, 207, 208, 0, 0, 0, 213,
  214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233,
  234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253,
  254, 255, 256, 257, 258, 259, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 260, 261, 262, 263, 264, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338,
  339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358,
  359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377
];

// Dónde se capturó: los lugares de Kanto y las Islas Sete, del 0x58 en adelante ([español,
// inglés]). Los nombres en español son los de «Rutas» (js/rutas/datos.js) cuando el sitio sale
// ahí, para que las capturas se marquen solas.
const KANTO = [
  ["Pueblo Paleta", "Pallet Town"], ["Ciudad Verde", "Viridian City"], ["Ciudad Plateada", "Pewter City"],
  ["Ciudad Celeste", "Cerulean City"], ["Pueblo Lavanda", "Lavender Town"], ["Ciudad Carmín", "Vermilion City"],
  ["Ciudad Azulona", "Celadon City"], ["Ciudad Fucsia", "Fuchsia City"], ["Isla Canela", "Cinnabar Island"],
  ["Meseta Añil", "Indigo Plateau"], ["Ciudad Azafrán", "Saffron City"],
  ["Ruta 4", "Route 4"], ["Ruta 10", "Route 10"], // los Centros Pokémon de las rutas 4 y 10
  ...Array.from({ length: 25 }, (_, i) => [`Ruta ${i + 1}`, `Route ${i + 1}`]),
  ["Bosque Verde", "Viridian Forest"], ["Monte Moon", "Mt. Moon"], ["Muelle del S.S. Anne", "S.S. Anne"],
  ["Paso Subterráneo", "Underground Path"], ["Paso Subterráneo", "Underground Path"], ["Cueva Diglett", "Diglett's Cave"],
  ["Calle Victoria", "Victory Road"], ["Escondite Rocket", "Rocket Hideout"], ["Silph S.A. (Ciudad Azafrán)", "Silph Co."],
  ["Mansión Pokémon", "Pokémon Mansion"], ["Zona Safari", "Safari Zone"], ["Liga Pokémon", "Pokémon League"],
  ["Túnel Roca", "Rock Tunnel"], ["Islas Espuma", "Seafoam Islands"], ["Torre Pokémon", "Pokémon Tower"],
  ["Cueva Celeste", "Cerulean Cave"], ["Central Energía", "Power Plant"],
  ["Isla Prima", "One Island"], ["Isla Secunda", "Two Island"], ["Isla Tera", "Three Island"], ["Isla Quarta", "Four Island"],
  ["Isla Inta", "Five Island"], ["Isla Sétima", "Seven Island"], ["Isla Exta", "Six Island"],
  ["Camino Candente (Isla Prima)", "Kindle Road"], ["Playa Tesoro (Isla Prima)", "Treasure Beach"],
  ["Cabo Extremo (Isla Secunda)", "Cape Brink"], ["Puente Unión (Isla Tera)", "Bond Bridge"],
  ["Puerto Isla Tera (Isla Tera)", "Three Isle Port"], ["", ""], ["", ""], ["", ""], ["", ""],
  ["Lugar de Recreo (Isla Inta)", "Resort Gorgeous"], ["Aquarinto (Isla Inta)", "Water Labyrinth"],
  ["Prado Isla Inta (Isla Inta)", "Five Isle Meadow"], ["Pilar Recuerdo (Isla Inta)", "Memorial Pillar"],
  ["Isla Aislada (Isla Exta)", "Outcast Island"], ["Vía Verde (Isla Exta)", "Green Path"], ["Vía Acuática (Isla Exta)", "Water Path"],
  ["Valle Ruinas (Isla Exta)", "Ruin Valley"], ["Torre Desafío (Isla Sétima)", "Trainer Tower"],
  ["Entrada al Cañón (Isla Sétima)", "Canyon Entrance"], ["Cañón Sétano (Isla Sétima)", "Sevault Canyon"],
  ["Ruinas Sete (Isla Sétima)", "Tanoby Ruins"], ["", ""], ["", ""], ["", ""], ["Roca Ombligo", "Navel Rock"],
  ["Monte Ascuas (Isla Prima)", "Mt. Ember"], ["Bosque Baya (Isla Tera)", "Berry Forest"],
  ["Cueva Glaciada (Isla Quarta)", "Icefall Cave"], ["Almacén Rocket", "Rocket Warehouse"],
  ["Torre Desafío (Isla Sétima)", "Trainer Tower"], ["Cueva Punteada (Isla Exta)", "Dotted Hole"],
  ["Cueva Perdida (Isla Inta)", "Lost Cave"], ["Bosquejo (Isla Exta)", "Pattern Bush"],
  ["Cueva Cambiante (Isla Exta)", "Altering Cave"], ["Cámaras Sete (Isla Sétima)", "Tanoby Chambers"],
  ["Paso Isla Tera (Isla Tera)", "Three Isle Path"], ["Llave Sete (Isla Sétima)", "Tanoby Key"], ["Isla Origen", "Birth Island"],
  // Las siete cámaras de las Ruinas Sete (los Unown)
  ...Array.from({ length: 7 }, () => ["Cámaras Sete (Isla Sétima)", "Tanoby Chambers"]),
  ["Balneario Ascuas (Isla Prima)", "Ember Spa"], ["Centro Comercial Azulona", "Celadon Dept."]
];

const PRIMER_LUGAR = 0x58;
const INTERCAMBIO = 0xfe; // de un intercambio dentro del juego

export const LUGARES_GEN3 = {
  ...Object.fromEntries(KANTO.map(([es], i) => [PRIMER_LUGAR + i, es]).filter(([, es]) => es)),
  [INTERCAMBIO]: "Intercambio"
};

export const LUGARES_GEN3_EN = Object.fromEntries(KANTO.filter(([es]) => es));
