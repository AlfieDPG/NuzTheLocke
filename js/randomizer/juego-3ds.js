// ---------- Juegos de 3DS (6.ª y 7.ª generación) ----------
//
// Pokémon X, Y, Rubí Omega, Zafiro Alfa, Sol, Luna, Ultrasol y Ultraluna. Los datos están en GARC del RomFS (se leen de un
// .3ds ya descifrado, ver ./rom-3ds.js). Cada juego se prepara con prepararRom(sesion), que lee de
// antemano los GARC que hacen falta; después todo es síncrono, como en los motores de DS (leerBW2,
// escribirBW2...). Lo que cambia no vuelve al .3ds: sale como archivos sueltos (LayeredFS).
//
//   personal      una entrada por especie: 0x40 (XY), 0x50 (ORAS) o 0x54 (SM) bytes; la última es la suma de todas
//   evoluciones   8 de [método u16, dato u16, especie u16] (6.ª) o [método, dato, especie, forma u8, nivel u8] (7.ª)
//   ataques que aprende   [ataque u16, nivel u16]... y [0xFFFF, 0xFFFF]
//   ataques       36 bytes: uno por archivo (XY) o un «mini» «WD» en el primero (ORAS y SM)
//   entrenadores  un archivo de datos y otro con sus Pokémon
//   salvajes      huecos de [especie | forma << 11 u16, nivel, nivel máx.] (6.ª), comprimidos (LZ11)

import { leerGarc, crearGarc, leerMini, crearMini, descomprimirLZ11, comprimirLZ11 } from "./rom-3ds.js";
import { leerTextos6, escribirTextos6, aTexto } from "./textos-3ds.js";
import { leerAmx, escribirAmx, leer16, poner16 as poner16Amx } from "./amx.js";
import { ponerHierbaEnPueblos as hierbaEnPueblos } from "./hierba-3ds.js";

export const ULTIMA_ESPECIE = 802;
export const ULTIMO_ATAQUE = 719;
export const ULTIMA_HABILIDAD = 232;

export const TIPOS = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
];

// Los métodos de evolución de 6.ª y 7.ª generación son los de la 5.ª (con alguno más al final)
export const EVO = {
  amistad: 1, amistadDia: 2, amistadNoche: 3, nivel: 4, intercambio: 5, intercambioObjeto: 6, intercambioEspecial: 7,
  piedra: 8, belleza: 16, piedraMacho: 17, piedraHembra: 18, objetoDia: 19, objetoNoche: 20, ataque: 21,
  otroEnEquipo: 22, nivelMacho: 23, nivelHembra: 24
};
// Los métodos de 7.ª generación en los que el dato es un nivel (va en un byte aparte)
const EVO_CON_NIVEL = new Set([4, 9, 10, 11, 12, 13, 14, 15, 23, 24, 28, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41]);

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
function poner16(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >> 8) & 0xff;
}

// ---------- Cada juego ----------

const tres = (x) => [x - 1, x, x + 1]; // los rivales van de tres en tres: uno por inicial

const XY = {
  id: "xy", gen: 6,
  rutas: {
    salvajes: "a/0/1/2", entrenadores: "a/0/3/8", equipos: "a/0/4/0", textoEs: "a/0/7/8",
    ataques: "a/2/1/2", aprende: "a/2/1/4", evoluciones: "a/2/1/5", datos: "a/2/1/8"
  },
  // Los textos de todos los idiomas (japonés, japonés, inglés, francés, italiano, alemán, español, coreano)
  textoRutas: ["a/0/7/2", "a/0/7/3", "a/0/7/4", "a/0/7/5", "a/0/7/6", "a/0/7/7", "a/0/7/8", "a/0/7/9"],
  ultimaEspecie: 721, tamDatos: 0x40, ultimoAtaque: 617, ultimaHabilidad: 188, ultimoObjeto: 717,
  textos: { especies: 80, ataques: 13, habilidades: 34, entrenadores: 21, clases: 20, objetos: 96 },
  lideres: [6, 76, 21, 22, 23, 24, 25, 26, 269, 271, 187, 270, 276, 303, 525, 526],
  rivales: [...[596, 575, 581, 578, 584, 607, 587, 590, 593, 599, 435, 130, 329, 184, 332, 604, 335, 338, 341, 519, 137, 321].flatMap(tres)],
  grupos: [
    [6, 39, 40, 48], [76, 64, 63, 106, 105], [21, 83, 84, 146, 147], [22, 121, 122, 123, 124],
    [23, 461, 462, 463, 464, 465, 466, 467, 468, 469, 28, 29, 30], [24, 245, 250, 248, 243], [25, 170, 171, 172, 365, 366],
    [26, 168, 169, 31, 32], [269], [271], [187], [270]
  ],
  extras: [174, 175, 304, 344, 345, 346, 347, 348, 349, 350, 351, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 324, 325, 438, 439, 573, 327, 328],
  legendarios: [716, 717, 718, 719, 720, 721],
  habilidadesNunca: [176],
  // Las iniciales: los regalos del DllField.cro (cada 0x18 bytes: especie u16, forma +4, nivel +5) y lo que se ve al elegir (DllPoke3Select.cro)
  iniciales: { cro: "DllField.cro", desde: 0xf805c, tam: 0x18, forma: 4, pantalla: "DllPoke3Select.cro", extra: 0x10, texto: 63 },
  // Los estáticos y los regalos, en el DllField.cro (ver leerEstaticos6); los intercambios, en el programa. Los legendarios
  // de la caja, los errantes y los de los cubos de basura llevan además código y scripts (ver «especiales»)
  estaticos6: {
    cro: "DllField.cro", fijos: { desde: 0xee46c, cuantos: 13 }, ignorar: [], enlazados: [[1, 3], [2, 12]],
    especiales: {
      // El legendario de la caja (Xerneas en X, Yveltal en Y): dos entradas enlazadas, un script de la zona (archivo 341 de los
      // salvajes, el AMX en 0x6e0) y tres comparaciones del DllField.cro. La otra pareja no se usa
      caja: {
        X: { entradas: [2, 12], otra: [1, 3], offsets: [4658, 5430, 16798] }, Y: { entradas: [1, 3], otra: [2, 12], offsets: [4670, 5456, 17266] },
        archivo: 341, desde: 0x6e0, funcion: "14D08DE20900A0E1", codigo: [144, 300, 584]
      },
      // Los tres errantes: sus especies, en el programa; y el script de la Guarida Espíritu Marino (archivo 351, AMX en 0x1c0)
      errantes: {
        entradas: [6, 7, 8], localizador: "9040A0030400000A", libre: "540095E50220A0E30810A0E1",
        archivo: 351, desde: 0x1c0, offsets: [0x500, 0x508, 0x510]
      },
      // Los de los cubos de basura: 24 de 16 bytes en el programa (especie, forma, nivel); [desde, cuántos, juntar los de la misma especie]
      basuras: { marca: "4028100000", conjuntos: [[0, 6, true], [6, 6, true], [12, 3, true], [15, 3, true], [18, 6, false]] }
    },
    regalos: { desde: 0xf805c, tam: 0x18, cuantos: 19, saltar: [0, 1, 2, 3, 4, 5] },
    trueques: { prefijo: "BA0A02015E000100BC0A150069000100", cuantos: 9, texto: 113, extra: 0 },
    historia: ["a/0/8/0", "a/0/8/1", "a/0/8/2", "a/0/8/3", "a/0/8/4", "a/0/8/5", "a/0/8/6", "a/0/8/7"], dialogos: { 1: 129, 8: 349 }
  },
  // Las MT: en el programa, tras esta marca, 92 ataques y 5 MO; y las MT 93 a 100, 97 u16 más allá del inicio
  tm: { prefijo: "D400AE02AF02B002", dos: 97, hm: 5, objetos: 99, ataquesTexto: 15, descObjetos: 99, descAtaques: 15 },
  // Los objetos: los datos de cada uno (el precio, en el primer u16) y las tiendas, en el programa: listas de u16 una tras otra
  objetos: {
    datos: "a/2/2/0", localizador: "0400110004000300",
    // Los objetos del suelo (visibles y escondidos), en los scripts: de 12 en 12 bytes desde la posición del primero. Detrás
    // de los de verdad vienen muchas Pociones de relleno
    amx: { scripts: "a/0/3/1", secciones: [{ archivo: 17, desde: 0xb04, recortar: true }, { archivo: 26, desde: 0xb18 }] },
    tamanos: [2, 11, 14, 17, 18, 19, 19, 19, 19, 1, 4, 10, 3, 9, 1, 1, 3, 3, 5, 5, 6, 7, 5, 5, 8, 3],
    mt: [18, 19, 22, 23], normales: [0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15], historia: [10, 11, 12, 13, 16, 17, 20, 21, 24, 25],
    // Sin medallas la tienda solo tiene Poké Ball y Poción: hasta la primera, en el segundo mostrador de Ciudad Vánitas (24)
    caramelos: [24, 1, 2, 3, 4, 5, 6, 7, 8]
  }
};

const ORAS = {
  id: "oras", gen: 6, miniAtaques: true,
  rutas: {
    salvajes: "a/0/1/3", entrenadores: "a/0/3/6", equipos: "a/0/3/8", textoEs: "a/0/7/7",
    ataques: "a/1/8/9", aprende: "a/1/9/1", evoluciones: "a/1/9/2", datos: "a/1/9/5"
  },
  textoRutas: ["a/0/7/1", "a/0/7/2", "a/0/7/3", "a/0/7/4", "a/0/7/5", "a/0/7/6", "a/0/7/7", "a/0/7/8"],
  ultimaEspecie: 721, tamDatos: 0x50, ultimoAtaque: 621, ultimaHabilidad: 191, ultimoObjeto: 775,
  textos: { especies: 98, ataques: 14, habilidades: 37, entrenadores: 22, clases: 21, objetos: 114 },
  lideres: [561, 563, 567, 569, 570, 571, 552, 572, 943, 553, 554, 555, 556, 557, 909, 910, 911, 912, 913, 680, 942, 235, 236, 271, 178, 231, 266],
  rivales: [1, 289, 674, 292, 527, 699, 4, 295, 677, 298, 530, 906].flatMap(tres),
  grupos: [
    [561, 562, 22, 667], [563, 60, 56, 59], [567, 34, 568, 614, 35], [569, 81, 824, 83, 615, 823, 613, 85],
    [570, 63, 64, 65, 66, 67, 68, 69], [571, 115, 517, 516, 118, 730], [552, 157, 158, 159, 226, 320, 225],
    [572, 943, 647, 342, 594, 646, 338, 339, 340, 341], [553, 909], [554, 910], [555, 911], [556, 912]
  ],
  extras: [683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 518, 583, 944, 946],
  legendarios: [716, 717, 718, 719, 720, 721],
  // Las del clima primigenio (solo Groudon, Kyogre y Rayquaza) y Cambio de Táctica
  habilidadesNunca: [176, 189, 190, 191],
  // El Poochyena del principio y el Zigzagoon y el Ralts del tutorial de captura de Blasco: siguen aleatorios, pero sin lo que
  // acaba el combate antes de tiempo (ver randomizar.js)
  primerosCombates: [261, 263, 280],
  iniciales: { cro: "DllField.cro", desde: 0xf906c, tam: 0x24, forma: 4, pantalla: "DllPoke3Select.cro", extra: 0, texto: 77 },
  // Rayquaza (28) lleva además código y scripts: se deja como está
  estaticos6: {
    cro: "DllField.cro", fijos: { desde: 0xf1b20, cuantos: 0x3b }, ignorar: [],
    // Rayquaza: su script (el 31 de los scripts) y tres comparaciones del DllField.cro
    especiales: { rayquaza: { entrada: 28, ruta: "a/0/2/9", archivo: 31, offsets: [3334, 14734], funcion: "0900A0E1F08FBDE8", codigo: [136, 292, 576] } },
    enlazados: [[26, 49], [27, 50], [29, 58], [80, 56], [81, 57], [75, 76]],
    regalos: { desde: 0xf906c, tam: 0x24, cuantos: 0x25, saltar: [0, 1, 2, 28, 29, 30, 31, 32, 33, 34, 35, 36], huevo: 18 },
    trueques: { prefijo: "810B7A0097000A00000047006B000A00", cuantos: 3, texto: 132, extra: 18 },
    historia: ["a/0/7/9", "a/0/8/0", "a/0/8/1", "a/0/8/2", "a/0/8/3", "a/0/8/4", "a/0/8/5", "a/0/8/6"], dialogos: {}
  },
  // Los tutores: la lista de ataques en el programa (con un 0x26E que separa los cuatro grupos) y la tienda de PB, igual,
  // con 8 bytes por ataque; en los datos de cada especie, 4 bytes por grupo desde el 64
  tutores: {
    lista: { localizador: "C2015701A20012024401BA01", desde: 0, separador: 0x26e },
    tienda: { prefijo: "8A02000030000000", paso: 8, cuantas: 64 }, grupos: [15, 17, 16, 15], compat: 64
  },
  // Igual, con dos MO más (Golpe Roca y Buceo, en otro sitio de la lista de MO)
  tm: { prefijo: "D400AE02AF02B002", dos: 98, hm: 5, hmExtra: [10, 28], descObjetos: 117, descAtaques: 16 },
  objetos: {
    // (la segunda marca: la misma con el Caramelo Raro en la primera lista, por si se randomiza una ROM ya randomizada)
    datos: "a/1/9/7", localizador: "04001100120004000300", localizadorRandom: "04001100320004000300",
    // y las Megapiedras que se encuentran por el camino (27, de 0x20 en 0x20 desde 0xaba, en otro script)
    amx: { scripts: "a/0/2/9", secciones: [{ archivo: 39, desde: 0xb64, recortar: true }, { archivo: 57, desde: 0xaba, paso: 0x20, cuantos: 27 }] },
    tamanos: [3, 10, 14, 17, 18, 19, 19, 19, 19, 1, 9, 6, 4, 3, 8, 8, 3, 3, 4, 3, 6, 8, 7, 4],
    mt: [12, 15, 22, 23], normales: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], historia: [10, 11, 13, 14, 16, 17, 18, 19, 20, 21],
    // La lista de la Tienda Pokémon de cada número de medallas (la 9, antes de tener la Pokédex, solo tiene Poción)
    caramelos: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    // Los escondidos: 170 entradas de 14 bytes tras esta marca (el objeto, 2 bytes más allá)
    ocultos: { prefijo: "A100A200A300A400A5001400010053004A0084000900", cuantos: 170, salto: 0xe, desfase: 2 }
  }
};

// Los textos de la historia de Sol, Luna, Ultrasol y Ultraluna (un archivo por idioma, como los otros textos)
const STORY7 = Array.from({ length: 10 }, (_, i) => `a/0/4/${i}`);

// Sol y Luna (en Luna, los salvajes están en a/0/8/3)
const SM = {
  id: "sm", gen: 7, miniAtaques: true,
  rutas: {
    entrenadores: "a/1/0/5", equipos: "a/1/0/6", textoEs: "a/0/3/6",
    ataques: "a/0/1/1", aprende: "a/0/1/3", evoluciones: "a/0/1/4", datos: "a/0/1/7"
  },
  textoRutas: ["a/0/3/0", "a/0/3/1", "a/0/3/2", "a/0/3/3", "a/0/3/4", "a/0/3/5", "a/0/3/6", "a/0/3/7", "a/0/3/8", "a/0/3/9"],
  ultimaEspecie: 802, tamDatos: 0x54, ultimoAtaque: 719, ultimaHabilidad: 232, ultimoObjeto: 920, salvajesGrande: "a/0/8/3",
  textos: { especies: 55, ataques: 113, habilidades: 96, entrenadores: 105, clases: 106, objetos: 36 },
  lideres: [23, 152, 349, 90, 153, 351, 154, 403, 155, 359, 149, 350, 156, 352, 129, 413, 414, 138, 235, 236, 400, 131, 158],
  rivales: [477, 6, 9, 12, 76, 82, 438, 217, 220, 447, 450, 482, 356].flatMap(tres),
  grupos: [[23, 152, 349], [90, 153, 351], [154, 403], [155, 359], [149, 350], [156, 352]],
  extras: [79, 185, 239, 240, 415, 416, 417, 418, 419, 441, 52, 215, 216, 396, 144, 398, 146, 405, 167, 481, 435, 467, 89, 238, 401, 75, 74, 412, 132, 241, 360, 410],
  // Tipo Nulo y Silvally, los Ultraentes, los Tapus, Cosmog y sus evoluciones, Necrozma, Magearna y Marshadow
  legendarios: [772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802],
  // Las iniciales: los tres primeros regalos del GARC de estáticos (cada 0x14 bytes: especie u16, forma +2, nivel +3)
  inicialesGarc: { ruta: "a/1/5/5", tam: 0x14, forma: 2, textoHistoria: "a/0/4/6", texto: 41 },
  // Los estáticos, en el mismo GARC: los regalos (0x14 bytes cada uno; los tres primeros son las iniciales), los
  // encuentros (0x38) sin los tótems ni los aliados, y los intercambios (0x34). «enlazados»: [base, copia] en la
  // lista (regalos y encuentros seguidos), dos entradas que son el mismo Pokémon
  estaticos: {
    ruta: "a/1/5/5", textoIntercambios: 12, historia: STORY7,
    saltar: [1, 4, 9, 14, 19, 24, 33, 39, 45, 8, 13, 17, 18, 23, 31, 32, 37, 38, 43, 44, 48, 49],
    // Los tótems (cada uno trae su aura en el byte 0x25 y la lista de aliados: cuántos en el 0x27 y, desde el 0x28, de 4 en 4
    // bytes, el número del aliado más uno); los que no se usan en el juego
    totems: [1, 4, 9, 14, 19, 24, 33, 39, 45], totemsSinUso: [],
    // El Zygarde de la Ruta 16: no está en la tabla sino en el programa (la especie, detrás de una marca, y la forma, que
    // se carga de la pila)
    zygarde: { especie: "FBEB4CD08DE20400A0E1F08FBDE8", forma: "BC21CDE1B801CDE1" },
    enlazados: [[112, 113], [120, 131], [124, 130]],
    // Las líneas con el diálogo escrito a mano de cada intercambio
    dialogos: { 1: [26, 28, 30], 2: [32, 33, 34, 36], 3: [38, 39, 40, 42], 4: [44, 45, 46, 48], 5: [50, 51, 52, 54], 6: [56, 57, 58, 60] }
  },
  // Lusamine bestia: en Sol y Luna, la mejora de estadística de cada uno de sus cinco primeros Pokémon (especie en el byte 0, número
  // de estadística en el 2, de 0x10 en 0x10) está en el Battle.cro, detrás de esta marca
  lusamina: { cro: "Battle.cro", prefijo: "1D14FFFF", entrenador: 158, cuantos: 5 },
  // Los objetos: las tiendas, una tras otra desde un sitio fijo del Shop.cro; los del suelo, en los salvajes (entrada 0 de cada 11)
  objetos: {
    datos: "a/0/1/9", cro: "Shop.cro", desde: 0x50a8, campo: true,
    tamanos: [9, 11, 13, 15, 17, 19, 20, 21, 9, 4, 8, 12, 5, 4, 11, 3, 10, 6, 10, 6, 4, 5, 7, 1],
    mt: [12, 13, 16, 18, 19], normales: [0, 1, 2, 3, 4, 5, 6, 7], historia: [8, 9, 10, 11, 14, 15, 17, 20, 21, 22, 23],
    caramelos: [0, 1, 2, 3, 4, 5, 6, 7]
  },
  // Las 100 MT, seguidas, tras esta marca del programa (que en Sol y Luna viene sin comprimir)
  tm: { prefijo: "034003410342034303", dos: 92, hm: 0, descObjetos: 35, descAtaques: 112 },
  // Cambio de Táctica, Disfraz, Unión (Greninja), Escudo Limitado, Dominio de Poder, Sistema Alfa
  habilidadesNunca: [176, 197, 208, 209, 210, 211, 225]
};

// Ultrasol y Ultraluna: casi igual que Sol y Luna, con otros números de archivo, de línea de texto y de entrenador
const USUM = {
  ...SM,
  id: "usum",
  rutas: {
    entrenadores: "a/1/0/6", equipos: "a/1/0/7", textoEs: "a/0/3/6",
    ataques: "a/0/1/1", aprende: "a/0/1/3", evoluciones: "a/0/1/4", datos: "a/0/1/7"
  },
  ultimaEspecie: 807, ultimoAtaque: 728, ultimaHabilidad: 233, ultimoObjeto: 959, lusamina: null,
  textos: { especies: 60, ataques: 118, habilidades: 101, entrenadores: 110, clases: 111, objetos: 40 },
  lideres: [23, 650, 90, 153, 351, 154, 508, 359, 497, 489, 490, 149, 350, 156, 352, 138, 235, 236, 558, 647, 131, 644],
  rivales: [491, 9, 12, 76, 82, 438, 217, 220, 447, 450, 494, 356, 477].flatMap(tres),
  grupos: [[23, 650], [90, 153, 351], [154, 508], [359, 497], [489, 490], [149, 350], [156, 352]],
  extras: [
    79, 185, 239, 240, 415, 416, 417, 418, 419, 441, 52, 215, 216, 396, 502, 144, 503, 398, 504, 146, 505, 405, 506, 507,
    89, 238, 401, 75, 74, 412, 623, 132, 241, 410, 561, 498, 499, 648, 651, 500, 501, 649, 652
  ],
  // Los de Sol y Luna y Poipole, Naganadel, Stakataka, Blacephalon y Zeraora
  legendarios: [...SM.legendarios, 803, 804, 805, 806, 807],
  habilidadesNunca: [...SM.habilidadesNunca, 232, 233],
  inicialesGarc: { ruta: "a/1/5/9", tam: 0x14, forma: 2, textoHistoria: "a/0/4/6", texto: 39, lineas: { grito: 4, confirmar: 7, nombre: 14 } },
  estaticos: {
    ruta: "a/1/5/9", textoIntercambios: 14, historia: STORY7,
    saltar: [
      1, 4, 9, 14, 19, 24, 33, 39, 45, 137, 146, 158, 159, 160, 162, 229, 231, 249,
      8, 13, 17, 18, 23, 31, 32, 37, 38, 43, 44, 48, 49, 140, 141, 147, 148, 163, 164, 230, 232, 250
    ],
    totems: [1, 4, 9, 14, 19, 24, 33, 39, 45, 137, 146, 158, 159, 160, 162, 229, 231, 249], totemsSinUso: [14, 19, 33],
    zygarde: SM.estaticos.zygarde,
    enlazados: [[127, 128], [135, 146], [139, 145]],
    dialogos: { ...SM.estaticos.dialogos, 0: [20, 21, 22] }
  },
  objetos: {
    datos: "a/0/1/9", cro: "Shop.cro", desde: 0x50bc, campo: true,
    tamanos: [9, 12, 14, 16, 18, 20, 21, 22, 9, 4, 8, 12, 5, 4, 11, 3, 5, 6, 10, 5, 4, 5, 7, 5, 8, 8, 8, 8],
    mt: [12, 13, 16, 18, 19], normales: [0, 1, 2, 3, 4, 5, 6, 7], historia: [8, 9, 10, 11, 14, 15, 17, 20, 21, 22, 23, 24, 25, 26, 27],
    caramelos: [0, 1, 2, 3, 4, 5, 6, 7]
  },
  // Solo en Ultrasol y Ultraluna: la lista de ataques detrás de esta marca del programa y la tienda, en el Shop.cro; en los
  // datos de cada especie, 67 bits desde el 60
  tutores: {
    lista: { localizador: "5F6F6E5F6F6666FF", desde: 8 }, tienda: { cro: "Shop.cro", desde: 0x54de, paso: 4, cuantas: 67 },
    cuantos: 67, compat: 60
  },
  tm: { prefijo: "03BC03BD03BE03BF03", dos: 92, hm: 0, descObjetos: 39, descAtaques: 117 }
};

// Lo que nunca deja de venderse para hacer sitio a otro objeto: Ultra, Super y Poké Ball, y Restaurar Todo, Poción Máxima,
// Hiperpoción, Superpoción, Poción, Cura Total y Revivir
const OBJETOS_BASICOS = new Set([2, 3, 4, 17, 23, 24, 25, 26, 27, 28]);

// Cuántos ataques de tutor hay en total
const totalTutores = (base) => base.tutores.cuantos || base.tutores.grupos.reduce((a, b) => a + b, 0);

export function perfilDe(sesion) {
  const codigo = sesion.codigo || "";
  let base = codigo.startsWith("CTR-P-EK") ? XY : codigo.startsWith("CTR-P-EC") ? ORAS : codigo.startsWith("CTR-P-BN") ? SM : codigo.startsWith("CTR-P-A2") ? USUM : null;
  if (!base) return null;
  // Los salvajes de Sol y Ultrasol están en el archivo 2 y los de Luna y Ultraluna, en el 3
  if (base.salvajesGrande) base = { ...base, salvajesGrande: codigo[8] === "A" || codigo[8] === "D" ? "a/0/8/2" : "a/0/8/3" };
  const importantes = [...base.lideres, ...base.rivales, ...base.extras];
  const iniciales = Boolean(base.iniciales || base.inicialesGarc);
  return {
    id: base.id, gen: base.gen, base,
    nombre: sesion.nombreJuego || codigo,
    ultimaEspecie: base.ultimaEspecie, ultimoAtaque: base.ultimoAtaque, ultimaHabilidad: base.ultimaHabilidad, ultimoObjeto: base.ultimoObjeto,
    tipos: TIPOS, habilidadesNunca: base.habilidadesNunca, legendarios: base.legendarios, primerosCombates: base.primerosCombates,
    // Lo que todavía no se hace en 3DS
    sinObjetos: !base.objetos, sinMT: !base.tm, tutores: Boolean(base.tutores), tutorInfo: base.tutores ? { cuantos: totalTutores(base), bytes: Math.ceil(totalTutores(base) / 8), fijos: [] } : null, claros: false, iniciales,
    // Los objetos de las MT: 92 desde el 328, 3 desde el 618 y 5 desde el 690
    mtItems: [...Array.from({ length: 92 }, (_, k) => 328 + k), 618, 619, 620, 690, 691, 692, 693, 694],
    bitsMT: { tm: 100, hm: base.tm ? base.tm.hm + (base.tm.hmExtra ? base.tm.hmExtra.length : 0) : 0, extra: 0 },
    bloquesMT: 14,
    lideres: base.lideres, rivales: base.rivales, grupos: base.grupos, importantes: new Set(importantes),
    sinDobles: [],
    // Los precios van en decenas (la Poción, 30 = 300), como en la 5.ª generación
    preciosEnDecenas: true,
    tiendas: {
      mt: base.objetos ? base.objetos.mt : [], normales: base.objetos ? base.objetos.normales : [], historia: base.objetos ? base.objetos.historia : [],
      // La Tienda Pokémon no tiene una lista sino una por cada número de medallas (o sellos): el Caramelo Raro, en todas.
      // Va en el sitio del Antihielo o, si no lo hay, del Antídoto; nunca en el de una Ball o una poción
      primera: base.objetos ? base.objetos.caramelos : -1, sacrificables: [20, 18], protegidos: OBJETOS_BASICOS, saltar: [], cuantas: 0
    },
    rutas: base.rutas
  };
}

// Los GARC que hay que leer de antemano
export async function prepararRom(sesion) {
  const perfil = perfilDe(sesion);
  if (!perfil) throw new Error("Este .3ds no es de ningún juego de 6.ª ni 7.ª generación que se sepa randomizar.");
  await sesion.cargar(Object.values(perfil.rutas));
  const ini = perfil.base.iniciales;
  if (ini) await sesion.cargar([ini.cro, ini.pantalla]);
  if (perfil.base.tm || perfil.base.estaticos6) await sesion.cargarCodigo();
  if (perfil.base.objetos) await sesion.cargar([perfil.base.objetos.datos, ...(perfil.base.objetos.cro ? [perfil.base.objetos.cro] : []), ...(perfil.base.objetos.amx ? [perfil.base.objetos.amx.scripts] : [])]);
  // Los textos de todos los idiomas (para los nombres de los entrenadores)
  await sesion.cargar(perfil.base.textoRutas);
  if (perfil.base.inicialesGarc) await sesion.cargar([perfil.base.inicialesGarc.ruta, perfil.base.inicialesGarc.textoHistoria]);
  if (perfil.base.estaticos) await sesion.cargar([perfil.base.estaticos.ruta, ...perfil.base.estaticos.historia]);
  if (perfil.base.lusamina) await sesion.cargar([perfil.base.lusamina.cro]);
  if (perfil.base.estaticos6) await sesion.cargar([perfil.base.estaticos6.cro, ...perfil.base.estaticos6.historia]);
  // Los salvajes de Sol y Luna: un GARC de 350 MB del que solo hacen falta unas pocas entradas (la 9 de cada 11)
  if (perfil.base.salvajesGrande) await sesion.cargarParcial(perfil.base.salvajesGrande, (i) => i % 11 === 9 || (perfil.base.objetos?.campo && i % 11 === 0));
  return perfil;
}

// ---------- Leer ----------

function nombresDe(sesion, perfil, cual) {
  const g = leerGarc(sesion.archivo(perfil.rutas.textoEs));
  return leerTextos6(g.archivos[perfil.base.textos[cual]]).lineas.map(aTexto);
}

export function nombresPokemon(sesion) {
  return nombresDe(sesion, perfilDe(sesion), "especies");
}

function leerEspecies(garcDatos, garcEvo, perfil) {
  const especies = [];
  const gen7 = perfil.gen === 7;
  const tamEvo = gen7 ? 8 : 6;
  for (let id = 1; id <= perfil.ultimaEspecie; id++) {
    const d = garcDatos.archivos[id];
    const stats = [d[0], d[1], d[2], d[4], d[5], d[3]]; // PS, Ata, Def, AtE, DfE, Vel
    const suma = stats.reduce((a, b) => a + b, 0);
    const e = garcEvo.archivos[id];
    const evoluciones = [];
    for (let k = 0; k < 8; k++) {
      const metodo = u16(e, k * tamEvo);
      const especie = u16(e, k * tamEvo + 4);
      if (!metodo || !especie) continue;
      const evo = { metodo, dato: u16(e, k * tamEvo + 2), especie };
      if (gen7) {
        // El nivel va en su propio byte; la forma, en otro
        const nivel = e[k * 8 + 7];
        evo.forma = e[k * 8 + 6];
        evo.nivelOriginal = nivel;
        evo.especieOriginal = especie;
        evo.metodoOriginal = metodo;
        evo.paramOriginal = evo.dato;
        if (EVO_CON_NIVEL.has(metodo)) evo.dato = nivel;
      }
      evoluciones.push(evo);
    }
    especies[id] = {
      id, stats, total: suma, totalOriginal: suma,
      tipos: [...new Set([TIPOS[d[6]], TIPOS[d[7]]])].filter(Boolean),
      habilidades: [d[24], d[25] === d[24] ? 0 : d[25], d[26]],
      objetos: [u16(d, 12), u16(d, 14), 0],
      genero: d[18],
      mt: d.slice(40, 54),
      tutor: leerCompatTutor(d, perfil),
      evoluciones,
      previa: 0
    };
  }
  for (const e of especies) if (e) for (const evo of e.evoluciones) if (especies[evo.especie]) especies[evo.especie].previa = e.id;
  return especies;
}

function leerAprende(garc, perfil) {
  const aprende = [];
  for (let id = 1; id <= perfil.ultimaEspecie; id++) {
    const a = garc.archivos[id];
    const lista = [];
    for (let i = 0; i + 3 < a.length; i += 4) {
      if (u16(a, i) === 0xffff && u16(a, i + 2) === 0xffff) break;
      lista.push([u16(a, i), u16(a, i + 2)]);
    }
    aprende[id] = lista;
  }
  return aprende;
}

// La compatibilidad con los tutores como una fila de bits seguidos, uno por ataque de la lista (en ORAS van en cuatro
// grupos de 4 bytes; en Ultrasol y Ultraluna, seguidos)
function leerCompatTutor(d, perfil) {
  const t = perfil.base.tutores;
  if (!t) return new Uint8Array(0);
  const total = totalTutores(perfil.base);
  const bits = new Uint8Array(Math.ceil(total / 8));
  let k = 0;
  (t.grupos || [total]).forEach((n, g) => {
    for (let j = 0; j < n; j++, k++) if (d[t.compat + (t.grupos ? g * 4 : 0) + (j >> 3)] & (1 << (j & 7))) bits[k >> 3] |= 1 << (k & 7);
  });
  return bits;
}

function escribirCompatTutor(d, bits, perfil) {
  const t = perfil.base.tutores;
  const total = totalTutores(perfil.base);
  if (!bits || bits.length !== Math.ceil(total / 8)) return;
  let k = 0;
  (t.grupos || [total]).forEach((n, g) => {
    const desde = t.compat + (t.grupos ? g * 4 : 0);
    for (let b = 0; b < (t.grupos ? 4 : Math.ceil(n / 8)); b++) d[desde + b] = 0;
    for (let j = 0; j < n; j++, k++) if (bits[k >> 3] & (1 << (k & 7))) d[desde + (j >> 3)] |= 1 << (j & 7);
  });
}

// Los datos de un ataque (en ORAS y SM, un paquete «WD» en el primer archivo)
function datosDeAtaque(garc, perfil, id) {
  return perfil.base.miniAtaques ? leerMini(garc.archivos[0])[id] : garc.archivos[id];
}

function leerEntrenadores(garcDatos, garcEquipos, perfil) {
  const oras = perfil.id === "oras";
  const gen7 = perfil.gen === 7;
  const entrenadores = [];
  for (let i = 1; i < garcDatos.archivos.length; i++) {
    const t = garcDatos.archivos[i];
    const p = garcEquipos.archivos[i];
    const pokemon = [];
    let conAtaques = true;
    let conObjetos = true;
    let combate;
    let clase;
    if (gen7) {
      // 20 bytes: clase, ..., tipo de combate (2), cuántos (3); cada Pokémon, 32 bytes
      clase = t[0];
      combate = t[2];
      for (let k = 0; k < t[3]; k++) {
        const o = k * 32;
        pokemon.push({
          habilidad: p[o], dificultad: p[o + 1], nivel: u16(p, o + 14), especie: u16(p, o + 16), forma: u16(p, o + 18),
          objeto: u16(p, o + 20), ataques: [0, 1, 2, 3].map((m) => u16(p, o + 24 + m * 2))
        });
      }
    } else {
      const formato = oras ? u16(t, 0) : t[0];
      const desde = oras ? 6 : 2;
      conAtaques = Boolean(formato & 1);
      conObjetos = Boolean(formato & 2);
      combate = t[desde];
      clase = oras ? u16(t, 2) : t[1];
      let pos = 0;
      for (let k = 0; k < t[desde + 1]; k++) {
        const poke = { dificultad: p[pos], habilidad: p[pos + 1], nivel: u16(p, pos + 2), especie: u16(p, pos + 4), forma: u16(p, pos + 6), objeto: 0 };
        pos += 8;
        if (conObjetos) {
          poke.objeto = u16(p, pos);
          pos += 2;
        }
        if (conAtaques) {
          poke.ataques = [0, 1, 2, 3].map((m) => u16(p, pos + m * 2));
          pos += 8;
        }
        pokemon.push(poke);
      }
    }
    entrenadores.push({ indice: i, clase, combate, conAtaques, conObjetos, importante: perfil.importantes.has(i), pokemon });
  }
  return entrenadores;
}

// Los salvajes de cada archivo (6.ª): [nombre, dónde empiezan, cuántos huecos] (XY / ORAS)
const BLOQUES_XY = [
  ["hierba", 0, 12], ["flores-amarillas", 48, 12], ["flores-moradas", 96, 12], ["flores-rojas", 144, 12], ["hierba-alta", 192, 12],
  ["surf", 240, 5], ["romperrocas", 260, 5], ["vieja", 280, 3], ["buena", 292, 3], ["super", 304, 3],
  ["horda-comun", 316, 5], ["horda-rara", 336, 5], ["horda-muy-rara", 356, 5]
];
const BLOQUES_ORAS = [
  ["hierba", 0, 12], ["hierba-alta", 48, 12], ["dexnav", 96, 3], ["surf", 108, 5], ["romperrocas", 128, 5],
  ["vieja", 148, 3], ["buena", 160, 3], ["super", 172, 3], ["horda-comun", 184, 5], ["horda-rara", 204, 5], ["horda-muy-rara", 224, 5]
];

// Dónde empiezan los datos de un archivo de salvajes (y cuánto ocupan), o null si no tiene
function sitioSalvajes(b, perfil) {
  const oras = perfil.id === "oras";
  const desde = u32(b, 0x10) + (oras ? 0x0e : 0x10);
  const tam = oras ? 0xf6 : 0x178;
  const fin = oras ? u32(b, 0x14) : b.length;
  return fin - desde >= tam ? { desde, tam } : null;
}

function leerSalvajes(garc, perfil) {
  if (perfil.gen !== 6) return [];
  const oras = perfil.id === "oras";
  const bloques = oras ? BLOQUES_ORAS : BLOQUES_XY;
  const cuantos = garc.archivos.length - (oras ? 2 : 1);
  const salvajes = [];
  for (let archivo = 0; archivo < cuantos; archivo++) {
    const b = garc.archivos[archivo];
    const sitio = sitioSalvajes(b, perfil);
    if (!sitio) continue;
    const zonas = [];
    for (const [nombre, base, n] of bloques) {
      const huecos = [];
      for (let i = 0; i < n; i++) {
        const p = sitio.desde + base + i * 4;
        const v = u16(b, p);
        huecos.push({ especie: v & 0x7ff, forma: v >> 11, min: b[p + 2], max: b[p + 3], vacio: (v & 0x7ff) === 0 });
      }
      if (huecos.some((h) => h.especie)) zonas.push({ zona: nombre, clase: nombre, base, huecos });
    }
    if (zonas.length) salvajes.push({ archivo, estaciones: [zonas] });
  }
  return salvajes;
}

// Los salvajes de 7.ª generación: en cada entrada 9 + 11 × zona, un paquete «EA» de tablas; cada tabla, dos mitades
// (día y noche) de 0x164 bytes: nivel mínimo y máximo (0 y 1), 10 huecos de [especie | forma << 11 u16, u16] desde 0xC,
// otros 7 grupos de 10 detrás (los que acuden en una llamada de ayuda, 40 bytes más allá cada uno) y 6 de ayuda por clima (0x14C)
const TABLA_SM = 0x164;
const huecosSM = (base) => [
  ...Array.from({ length: 80 }, (_, k) => base + 0xc + (k % 10) * 4 + Math.floor(k / 10) * 40),
  ...Array.from({ length: 6 }, (_, k) => base + 0x14c + k * 4)
];

function leerSalvajesSM(sesion, perfil) {
  const p = sesion.parcial(perfil.base.salvajesGrande);
  const salvajes = [];
  const entradas = new Map();
  p.archivos.forEach((comprimido, archivo) => {
    if (!comprimido || comprimido.length < 5 || comprimido[0] !== 0x11) return;
    const e = descomprimirLZ11(comprimido);
    if (!e.length) return;
    entradas.set(archivo, e);
    const zonas = [];
    const piezas = leerMini(e);
    piezas.forEach((pieza, t) => {
      if (!pieza.length) return;
      const desde = pieza.byteOffset - e.byteOffset + 4;
      [["dia", 0], ["noche", TABLA_SM]].forEach(([nombre, mitad]) => {
        const base = desde + mitad;
        const min = e[base];
        const max = e[base + 1];
        const huecos = huecosSM(base).map((pos) => {
          const v = u16(e, pos);
          return { especie: v & 0x7ff, forma: v >> 11, min, max, vacio: (v & 0x7ff) === 0, pos };
        });
        if (huecos.some((h) => h.especie)) zonas.push({ zona: `tabla${t}-${nombre}`, clase: "sm", base, huecos });
      });
    });
    if (zonas.length) salvajes.push({ archivo, estaciones: [zonas] });
  });
  return { salvajes, entradas };
}

// Las tres iniciales
function leerIniciales(sesion, perfil) {
  const b = perfil.base;
  if (b.iniciales) {
    const cro = sesion.archivo(b.iniciales.cro);
    return [0, 1, 2].map((i) => u16(cro, b.iniciales.desde + i * b.iniciales.tam));
  }
  if (b.inicialesGarc) {
    const f = leerGarc(sesion.archivo(b.inicialesGarc.ruta)).archivos[0];
    return [0, 1, 2].map((i) => u16(f, i * b.inicialesGarc.tam));
  }
  return [];
}

// Los estáticos (regalos y encuentros) y los intercambios; cada uno con su sitio para escribirlo
function leerEstaticos(sesion, perfil) {
  if (perfil.base.estaticos6) return leerEstaticos6(sesion, perfil);
  const est = perfil.base.estaticos;
  if (!est) return {};
  const garc = leerGarc(sesion.archivo(est.ruta));
  const regalos = garc.archivos[0];
  const fijos = garc.archivos[1];
  const trueques = garc.archivos[4];
  const estaticos = [];
  const anadir = (tabla, pos, huevo) => {
    const datos = tabla === "regalo" ? regalos : fijos;
    const actual = u16(datos, pos);
    estaticos.push({ tabla, pos, actual, nivelActual: datos[pos + 3], huevo, ignorar: !actual || actual > perfil.ultimaEspecie });
  };
  // Los tres primeros regalos son las iniciales
  for (let pos = 3 * 0x14; pos + 0x14 <= regalos.length; pos += 0x14) anadir("regalo", pos, regalos[pos + 10] === 1);
  for (let i = 0; (i + 1) * 0x38 <= fijos.length; i++) if (!est.saltar.includes(i)) anadir("fijo", i * 0x38, false);
  for (const [base, copia] of est.enlazados) if (estaticos[copia]) estaticos[copia].copiaDe = base;
  // El Zygarde del programa (detrás de los demás, como en UPR)
  if (est.zygarde) {
    const marcaEspecie = buscarCodigo(sesion.code, est.zygarde.especie);
    const marcaForma = buscarCodigo(sesion.code, est.zygarde.forma);
    if (marcaEspecie >= 0 && marcaForma >= 0) {
      const pos = marcaEspecie + est.zygarde.especie.length / 2;
      const actual = u16(sesion.code, pos);
      estaticos.push({ tabla: "zygarde", pos, posForma: marcaForma + est.zygarde.forma.length / 2, actual, nivelActual: 0, ignorar: !actual || actual > perfil.ultimaEspecie });
    }
  }
  // Los tótems con su aura y sus aliados
  const totems = [];
  for (const i of est.totems) {
    const pos = i * 0x38;
    if (pos + 0x38 > fijos.length) continue;
    const actual = u16(fijos, pos);
    const aliados = [];
    for (let j = 0; j < fijos[pos + 0x27]; j++) {
      const a = (fijos[pos + 0x28 + 4 * j] - 1) & 0xff;
      const posA = a * 0x38;
      aliados.push({ indice: a, pos: posA, actual: u16(fijos, posA), nivelActual: fijos[posA + 3] });
    }
    totems.push({ indice: i, pos, actual, nivelActual: fijos[pos + 3], aura: fijos[pos + 0x25], auraOriginal: fijos[pos + 0x25], aliados, sinUso: est.totemsSinUso.includes(i) || !actual || actual > perfil.ultimaEspecie });
  }
  const intercambios = [];
  for (let i = 0; (i + 1) * 0x34 <= trueques.length; i++) {
    const pos = i * 0x34;
    const da = u16(trueques, pos);
    if (!da || da > perfil.ultimaEspecie) continue;
    const ivs = [0, 1, 2, 3, 4, 5].map((k) => trueques[pos + 6 + k]);
    intercambios.push({
      indice: i, pos, da, daOriginal: da, pide: u16(trueques, pos + 0x2c), pideOriginal: u16(trueques, pos + 0x2c),
      objeto: u16(trueques, pos + 0x14), objetoOriginal: u16(trueques, pos + 0x14), ivs, ivsOriginal: ivs.slice(), apodo: u16(trueques, pos + 2)
    });
  }
  return { estaticos, intercambios, totems };
}
// Los objetos del suelo y los montones de bayas de Sol, Luna, Ultrasol y Ultraluna: la primera entrada de cada área del
// GARC de salvajes («ED»), con los objetos sueltos (grupo 10, 64 bytes cada uno; el objeto, en el 52) y los montones
// de bayas (grupo 11, 68 bytes cada uno desde el 4; siete objetos desde el 54)
function leerObjetosCampo(sesion, perfil) {
  const p = sesion.parcial(perfil.base.salvajesGrande);
  const objetos = [];
  const entradas = new Map();
  p.archivos.forEach((crudo, archivo) => {
    if (archivo % 11 !== 0 || !crudo || crudo.length < 8) return;
    const comprimido = crudo[0] === 0x11;
    const e = comprimido ? descomprimirLZ11(crudo) : crudo.slice();
    entradas.set(archivo, { e, comprimido });
    if (e[0] !== 0x45 || e[1] !== 0x44) return;
    const grupos = leerMini(e);
    if (grupos.length < 12) return;
    // Cada grupo es otro paquete («EI» los sueltos, «EB» las bayas)
    const piezas = (g, a, b) => (g.length > 8 && g[0] === a && g[1] === b ? leerMini(g) : []);
    const sitio = (x) => x.byteOffset - e.byteOffset;
    for (const pieza of piezas(grupos[10], 0x45, 0x49)) {
      for (let j = 0; pieza.length && j < pieza[0]; j++) {
        const pos = sitio(pieza) + j * 64 + 52;
        if (pos + 2 <= e.length) objetos.push({ entrada: archivo, pos, objeto: u16(e, pos) });
      }
    }
    for (const pieza of piezas(grupos[11], 0x45, 0x42)) {
      for (let j = 0; pieza.length && j < pieza[0]; j++) {
        for (let k = 0; k < 7; k++) {
          const pos = sitio(pieza) + 4 + j * 68 + 54 + k * 2;
          if (pos + 2 <= e.length) objetos.push({ entrada: archivo, pos, objeto: u16(e, pos) });
        }
      }
    }
  });
  return { objetos, entradas };
}
// Los objetos: precios (un u16 al principio de los datos de cada uno), tiendas y objetos escondidos (ORAS)
function leerObjetos(sesion, perfil) {
  const ob = perfil.base.objetos;
  const vacio = { precios: [], tiendas: [], objetosSuelo: [] };
  if (!ob) return vacio;
  const garc = leerGarc(sesion.archivo(ob.datos));
  const precios = [0];
  for (let id = 1; id < garc.archivos.length; id++) precios[id] = u16(garc.archivos[id], 0);
  const tiendas = [];
  // Las tiendas van seguidas: en el programa, tras una marca, o en el Shop.cro, desde un sitio fijo
  const fuente = ob.cro ? sesion.archivo(ob.cro) : sesion.code;
  let pos = ob.cro ? ob.desde : buscarCodigo(sesion.code, ob.localizador);
  if (pos < 0 && ob.localizadorRandom) pos = buscarCodigo(sesion.code, ob.localizadorRandom);
  if (pos >= 0) {
    ob.tamanos.forEach((n, indice) => {
      const objetos = [];
      const huecos = [];
      for (let k = 0; k < n; k++, pos += 2) {
        objetos.push(u16(fuente, pos));
        huecos.push(pos);
      }
      tiendas.push({ indice, objetos, huecos });
    });
  }
  const objetosSuelo = [];
  let campo = null;
  if (ob.campo) {
    campo = leerObjetosCampo(sesion, perfil);
    objetosSuelo.push(...campo.objetos);
  }
  let scripts = null;
  if (ob.amx) {
    scripts = new Map();
    const garc = leerGarc(sesion.archivo(ob.amx.scripts));
    for (const { archivo, desde, recortar, paso = 12, cuantos } of ob.amx.secciones) {
      const amx = leerAmx(garc.archivos[archivo]);
      if (!amx) continue;
      scripts.set(archivo, amx);
      const sitios = [];
      for (let p = desde; p + 2 <= amx.celdas.length * 4 && (cuantos === undefined || sitios.length < cuantos); p += paso) sitios.push(p);
      // Sin el relleno del final (la última Poción repetida)
      let n = sitios.length;
      while (recortar && n > 1 && leer16(amx, sitios[n - 1]) === leer16(amx, sitios[n - 2])) n--;
      for (const pos of sitios.slice(0, n)) objetosSuelo.push({ script: archivo, pos, objeto: leer16(amx, pos) });
    }
  }
  if (ob.ocultos) {
    const marca = buscarCodigo(sesion.code, ob.ocultos.prefijo);
    if (marca >= 0) {
      const inicio = marca + ob.ocultos.prefijo.length / 2;
      for (let i = 0; i < ob.ocultos.cuantos; i++) {
        const p = inicio + i * ob.ocultos.salto + ob.ocultos.desfase;
        objetosSuelo.push({ codigo: true, pos: p, objeto: u16(sesion.code, p) });
      }
    }
  }
  return { precios, tiendas, objetosSuelo, campo, scripts };
}

export function leerBW2(sesion) {
  const perfil = perfilDe(sesion);
  if (!perfil) throw new Error("Este .3ds no es de ningún juego de 6.ª ni 7.ª generación que se sepa randomizar.");
  const r = perfil.rutas;
  const garcs = {
    datos: leerGarc(sesion.archivo(r.datos)), aprende: leerGarc(sesion.archivo(r.aprende)), evoluciones: leerGarc(sesion.archivo(r.evoluciones)),
    ataques: leerGarc(sesion.archivo(r.ataques)), entrenadores: leerGarc(sesion.archivo(r.entrenadores)), equipos: leerGarc(sesion.archivo(r.equipos))
  };
  if (r.salvajes) {
    garcs.salvajes = leerGarc(sesion.archivo(r.salvajes));
    // Los salvajes van comprimidos (LZ11), salvo el último (o los dos últimos, en ORAS)
    const sinComprimir = perfil.id === "oras" ? 2 : 1;
    garcs.salvajes = { ...garcs.salvajes, archivos: garcs.salvajes.archivos.map((x, i) => (i < garcs.salvajes.archivos.length - sinComprimir ? descomprimirLZ11(x) : x)) };
  }
  let salvajesSM = null;
  if (perfil.base.salvajesGrande) {
    salvajesSM = leerSalvajesSM(sesion, perfil);
    garcs.salvajesSM = salvajesSM.entradas;
  }
  const especies = leerEspecies(garcs.datos, garcs.evoluciones, perfil);
  const aprende = leerAprende(garcs.aprende, perfil);
  const ataques = [];
  for (let id = 1; id <= perfil.ultimoAtaque; id++) {
    const d = datosDeAtaque(garcs.ataques, perfil, id);
    ataques[id] = { id, tipo: TIPOS[d[0]], categoria: d[2], potencia: d[3], precision: d[4], pp: d[5] };
  }
  return {
    perfil, garcs, especies, aprende, ataques,
    salvajes: salvajesSM ? salvajesSM.salvajes : garcs.salvajes ? leerSalvajes(garcs.salvajes, perfil) : [],
    entrenadores: leerEntrenadores(garcs.entrenadores, garcs.equipos, perfil),
    iniciales: leerIniciales(sesion, perfil), inicialesOriginales: leerIniciales(sesion, perfil),
    estaticos: [], intercambios: [], ...leerEstaticos(sesion, perfil), ...leerObjetos(sesion, perfil), claros: null
  };
}

// ---------- Escribir ----------

export function escribirBW2(sesion, datos) {
  const { perfil, garcs } = datos;
  const r = perfil.rutas;
  const gen7 = perfil.gen === 7;
  const guardar = (ruta, nuevos) => {
    if (!Object.keys(nuevos).length) return;
    sesion.cambiar(ruta, crearGarc(sesion.archivo(ruta), nuevos));
  };

  // Datos de las especies
  const nuevosDatos = {};
  const tam = perfil.base.tamDatos;
  for (let id = 1; id <= perfil.ultimaEspecie; id++) {
    const e = datos.especies[id];
    const d = garcs.datos.archivos[id].slice();
    const antes = d.slice();
    [d[0], d[1], d[2], d[3], d[4], d[5]] = [e.stats[0], e.stats[1], e.stats[2], e.stats[5], e.stats[3], e.stats[4]];
    d[6] = TIPOS.indexOf(e.tipos[0]);
    d[7] = TIPOS.indexOf(e.tipos[1] || e.tipos[0]);
    d[24] = e.habilidades[0];
    d[25] = e.habilidades[1] || e.habilidades[0];
    d[26] = e.habilidades[2];
    poner16(d, 12, e.objetos[0]);
    poner16(d, 14, e.objetos[1]);
    if (e.mt && e.mt.length === 14) d.set(e.mt, 40);
    if (perfil.base.tutores) escribirCompatTutor(d, e.tutor, perfil);
    if (d.some((v, i) => v !== antes[i])) nuevosDatos[id] = d;
  }
  if (Object.keys(nuevosDatos).length) {
    // El último archivo es la suma de todos los demás: se actualiza también
    const n = garcs.datos.archivos.length;
    const todo = garcs.datos.archivos[n - 1].slice();
    for (let i = 1; i < n - 1; i++) todo.set(nuevosDatos[i] || garcs.datos.archivos[i], tam * i);
    nuevosDatos[n - 1] = todo;
    guardar(r.datos, nuevosDatos);
  }

  // Evoluciones
  const nuevasEvo = {};
  const tamEvo = gen7 ? 8 : 6;
  for (let id = 1; id <= perfil.ultimaEspecie; id++) {
    const e = datos.especies[id];
    const d = garcs.evoluciones.archivos[id].slice();
    const antes = d.slice();
    for (let k = 0; k < 8; k++) {
      const evo = e.evoluciones[k];
      const o = k * tamEvo;
      // Un hueco que ya estaba vacío se queda como estaba
      if (!evo && !u16(antes, o)) continue;
      poner16(d, o, evo ? evo.metodo : 0);
      poner16(d, o + 4, evo ? evo.especie : 0);
      if (!gen7) {
        poner16(d, o + 2, evo ? evo.dato : 0);
        continue;
      }
      const conNivel = evo && EVO_CON_NIVEL.has(evo.metodo);
      // En los de nivel, el dato de antes se queda si el método no ha cambiado
      poner16(d, o + 2, evo && !conNivel ? evo.dato : evo && evo.metodo === evo.metodoOriginal ? evo.paramOriginal : 0);
      // Si la especie ha cambiado, la forma de antes ya no vale
      d[o + 6] = evo && evo.especie === evo.especieOriginal ? evo.forma || 0 : 0;
      d[o + 7] = evo ? (conNivel ? evo.dato : evo.nivelOriginal || 0) : 0;
    }
    if (d.some((v, i) => v !== antes[i])) nuevasEvo[id] = d;
  }
  guardar(r.evoluciones, nuevasEvo);

  // Ataques que aprenden
  const nuevosAprende = {};
  for (let id = 1; id <= perfil.ultimaEspecie; id++) {
    const lista = datos.aprende[id];
    const d = new Uint8Array(lista.length * 4 + 4);
    lista.forEach(([ataque, nivel], k) => {
      poner16(d, k * 4, ataque);
      poner16(d, k * 4 + 2, nivel);
    });
    poner16(d, lista.length * 4, 0xffff);
    poner16(d, lista.length * 4 + 2, 0xffff);
    const o = garcs.aprende.archivos[id];
    if (d.length !== o.length || d.some((v, i) => v !== o[i])) nuevosAprende[id] = d;
  }
  guardar(r.aprende, nuevosAprende);

  // Datos de los ataques
  const cambiadoAtaque = new Map();
  for (let id = 1; id <= perfil.ultimoAtaque; id++) {
    const a = datos.ataques[id];
    const d = datosDeAtaque(garcs.ataques, perfil, id).slice();
    const antes = d.slice();
    d[0] = TIPOS.indexOf(a.tipo);
    d[3] = a.potencia;
    d[4] = a.precision;
    d[5] = a.pp;
    if (d.some((v, i) => v !== antes[i])) cambiadoAtaque.set(id, d);
  }
  if (cambiadoAtaque.size) {
    const nuevosAtaques = {};
    if (perfil.base.miniAtaques) {
      const nuevos = [];
      for (const [id, d] of cambiadoAtaque) nuevos[id] = d;
      nuevosAtaques[0] = crearMini(garcs.ataques.archivos[0], nuevos);
    } else {
      for (const [id, d] of cambiadoAtaque) nuevosAtaques[id] = d;
    }
    guardar(r.ataques, nuevosAtaques);
  }

  // Entrenadores
  const oras = perfil.id === "oras";
  const desde = oras ? 6 : 2;
  const nuevosEntr = {};
  const nuevosEquipos = {};
  for (const t of datos.entrenadores) {
    const td = garcs.entrenadores.archivos[t.indice].slice();
    let p;
    // Si pasa a ser doble, la IA tiene que saberlo (que no ataque a los suyos)
    const eraSimple = (oras ? td[6] : gen7 ? td[2] : td[2]) === 0;
    const bandera = () => {
      if (!(t.combate === 1 && eraSimple)) return;
      if (gen7) td[12] |= 0x08;
      else if (oras) td[16] |= 0x80;
      else td[12] |= 0x80;
    };
    if (gen7) {
      bandera();
      td[2] = t.combate;
      td[3] = t.pokemon.length;
      p = new Uint8Array(t.pokemon.length * 32);
      const original = garcs.equipos.archivos[t.indice];
      t.pokemon.forEach((poke, k) => {
        const o = k * 32;
        // Lo que no se toca (naturaleza, EVs, IVs...), como estaba; si es nuevo, como el último
        if (original.length >= o + 32) p.set(original.subarray(o, o + 32), o);
        else if (k) p.set(p.subarray(o - 32, o), o);
        p[o] = poke.habilidad;
        p[o + 1] = poke.dificultad;
        poner16(p, o + 14, poke.nivel);
        poner16(p, o + 16, poke.especie);
        poner16(p, o + 18, poke.forma);
        poner16(p, o + 20, poke.objeto || 0);
        (poke.ataques || [0, 0, 0, 0]).forEach((m, j) => poner16(p, o + 24 + j * 2, m));
      });
    } else {
      const formatoAntes = oras ? u16(td, 0) : td[0];
      const formato = (formatoAntes & ~3) | (t.conAtaques ? 1 : 0) | (t.conObjetos ? 2 : 0);
      if (oras) poner16(td, 0, formato);
      else td[0] = formato;
      bandera();
      td[desde] = t.combate;
      td[desde + 1] = t.pokemon.length;
      p = new Uint8Array(t.pokemon.length * (8 + (t.conObjetos ? 2 : 0) + (t.conAtaques ? 8 : 0)));
      let pos = 0;
      for (const poke of t.pokemon) {
        p[pos] = poke.dificultad;
        p[pos + 1] = poke.habilidad;
        poner16(p, pos + 2, poke.nivel);
        poner16(p, pos + 4, poke.especie);
        poner16(p, pos + 6, poke.forma);
        pos += 8;
        if (t.conObjetos) {
          poner16(p, pos, poke.objeto || 0);
          pos += 2;
        }
        if (t.conAtaques) {
          (poke.ataques || [0, 0, 0, 0]).forEach((m, k) => poner16(p, pos + k * 2, m));
          pos += 8;
        }
      }
    }
    const to = garcs.entrenadores.archivos[t.indice];
    const po = garcs.equipos.archivos[t.indice];
    if (td.some((v, i) => v !== to[i])) nuevosEntr[t.indice] = td;
    if (p.length !== po.length || p.some((v, i) => v !== po[i])) nuevosEquipos[t.indice] = p;
  }
  guardar(r.entrenadores, nuevosEntr);
  guardar(r.equipos, nuevosEquipos);

  // Objetos: precios, tiendas y escondidos (en el programa)
  const b = perfil.base;
  if (b.objetos) {
    if (b.objetos.cro) {
      const cro = sesion.archivo(b.objetos.cro);
      const antes = cro.slice();
      for (const t of datos.tiendas) t.huecos.forEach((pos, k) => poner16(cro, pos, t.objetos[k]));
      if (cro.some((v, i) => v !== antes[i])) sesion.cambiar(b.objetos.cro, cro);
    } else {
      for (const t of datos.tiendas) t.huecos.forEach((pos, k) => poner16(sesion.code, pos, t.objetos[k]));
    }
    const cambiosScripts = {};
    for (const o of datos.objetosSuelo) {
      if (o.script !== undefined) {
        if (leer16(datos.scripts.get(o.script), o.pos) !== o.objeto) {
          poner16Amx(datos.scripts.get(o.script), o.pos, o.objeto);
          cambiosScripts[o.script] = true;
        }
      } else if (o.entrada === undefined) poner16(sesion.code, o.pos, o.objeto);
      else poner16(datos.campo.entradas.get(o.entrada).e, o.pos, o.objeto);
    }
    const nuevosScripts = {};
    for (const archivo of Object.keys(cambiosScripts)) nuevosScripts[archivo] = escribirAmx(datos.scripts.get(Number(archivo)));
    if (b.objetos.amx) guardar(b.objetos.amx.scripts, nuevosScripts);
    const garc = leerGarc(sesion.archivo(b.objetos.datos));
    const nuevos = {};
    datos.precios.forEach((precio, id) => {
      if (id && garc.archivos[id] && u16(garc.archivos[id], 0) !== precio) {
        const d = garc.archivos[id].slice();
        poner16(d, 0, precio);
        nuevos[id] = d;
      }
    });
    guardar(b.objetos.datos, nuevos);
  }

  // Iniciales (el dibujo, el nombre y el grito salen de la especie)
  if (datos.iniciales.length && datos.iniciales.some((id, i) => id !== datos.inicialesOriginales[i])) {
    if (b.iniciales) {
      const cro = sesion.archivo(b.iniciales.cro);
      datos.iniciales.forEach((id, i) => {
        poner16(cro, b.iniciales.desde + i * b.iniciales.tam, id);
        cro[b.iniciales.desde + i * b.iniciales.tam + b.iniciales.forma] = 0;
      });
      sesion.cambiar(b.iniciales.cro, cro);
      const pantalla = sesion.archivo(b.iniciales.pantalla);
      const o = u16(pantalla, 0xb8) + b.iniciales.extra;
      datos.iniciales.forEach((id, i) => {
        poner16(pantalla, o + i * 0x54, id);
        pantalla[o + i * 0x54 + 2] = 0;
      });
      sesion.cambiar(b.iniciales.pantalla, pantalla);
    } else if (b.inicialesGarc) {
      const f = leerGarc(sesion.archivo(b.inicialesGarc.ruta)).archivos[0].slice();
      datos.iniciales.forEach((id, i) => {
        poner16(f, i * b.inicialesGarc.tam, id);
        f[i * b.inicialesGarc.tam + b.inicialesGarc.forma] = 0;
      });
      sesion.cambiar(b.inicialesGarc.ruta, crearGarc(sesion.archivo(b.inicialesGarc.ruta), { 0: f }));
    }
  }

  if (datos.pokedexNacional && perfil.gen === 6) parchePokedexNacional(sesion, perfil);
  if (b.lusamina) escribirLusamina(sesion, datos);

  // Estáticos e intercambios
  if (b.estaticos || b.estaticos6) {
    if (b.estaticos) escribirEstaticos(sesion, datos);
    else escribirEstaticos6(sesion, datos);
    escribirTextosIntercambios(sesion, datos);
  }

  // Salvajes de Sol y Luna
  if (perfil.base.salvajesGrande) {
    const nuevos = {};
    for (const { archivo, estaciones } of datos.salvajes) {
      const e = garcs.salvajesSM.get(archivo).slice();
      const antes = e.slice();
      for (const z of estaciones[0]) {
        const vivo = z.huecos.find((h) => !h.vacio);
        if (vivo) {
          e[z.base] = vivo.min;
          e[z.base + 1] = vivo.max;
        }
        for (const h of z.huecos) if (!h.vacio) poner16(e, h.pos, h.especie | (h.forma << 11));
      }
      if (e.some((v, i) => v !== antes[i])) nuevos[archivo] = comprimirLZ11(e);
    }
    // Los objetos del suelo cambiados (otras entradas del mismo GARC)
    if (datos.campo) {
      for (const [archivo, { e, comprimido }] of datos.campo.entradas) {
        const original = sesion.parcial(perfil.base.salvajesGrande).archivos[archivo];
        const antes = comprimido ? descomprimirLZ11(original) : original;
        if (e.some((v, i) => v !== antes[i])) nuevos[archivo] = comprimido ? comprimirLZ11(e) : e;
      }
    }
    sesion.cambiarParcial(perfil.base.salvajesGrande, nuevos);
  }

  // Salvajes (6.ª)
  if (perfil.gen === 6) {
    const nuevosSalvajes = {};
    const almacen = perfil.id === "oras" ? garcs.salvajes.archivos[garcs.salvajes.archivos.length - 1].slice() : null;
    for (const { archivo, estaciones } of datos.salvajes) {
      const b = garcs.salvajes.archivos[archivo].slice();
      const antes = b.slice();
      const sitio = sitioSalvajes(b, perfil);
      for (const z of estaciones[0]) {
        z.huecos.forEach((h, i) => {
          if (h.vacio) return;
          const p = sitio.desde + z.base + i * 4;
          poner16(b, p, h.especie | (h.forma << 11));
          b[p + 2] = h.min;
          b[p + 3] = h.max;
        });
      }
      if (b.some((v, i) => v !== antes[i])) {
        nuevosSalvajes[archivo] = comprimirLZ11(b);
        if (almacen) copiarAlDexNav(almacen, archivo, b, sitio);
      }
    }
    if (almacen && Object.keys(nuevosSalvajes).length) nuevosSalvajes[garcs.salvajes.archivos.length - 1] = almacen;
    guardar(r.salvajes, nuevosSalvajes);
  }
}

// Rubí Omega y Zafiro Alfa: el último archivo de los salvajes («EN») repite los de cada zona, y de ahí lee el DexNav. La
// zona i, en el desplazamiento guardado en (i + 1) * 4, con la misma cabecera; los pueblos sin Pokémon no tienen sitio
function copiarAlDexNav(almacen, archivo, zona, sitio) {
  const cabecera = 0x0e;
  const copiados = 0xf4;
  const desde = u32(almacen, (archivo + 1) * 4);
  if (u32(almacen, (archivo + 2) * 4) - desde < cabecera + copiados) return;
  almacen.set(zona.subarray(sitio.desde, sitio.desde + copiados), desde + cabecera);
}

// X, Y, Rubí Omega y Zafiro Alfa: los estáticos (12 bytes cada uno: especie u16, forma, nivel, objeto) y los regalos
// (especie u16, forma +4, nivel +5) están en el DllField.cro; los intercambios, en el programa (0x24 bytes cada uno:
// especie u16, IVs desde +5, objeto +0x10, la que piden +0x20)
function leerEstaticos6(sesion, perfil) {
  const est = perfil.base.estaticos6;
  const cro = sesion.archivo(est.cro);
  const estaticos = [];
  const valida = (especie) => especie > 0 && especie <= perfil.ultimaEspecie;
  const esp = est.especiales || {};
  // Lo que no se puede cambiar con seguridad (por faltar algo que hace falta) se queda como está
  const fijas = new Set(est.ignorar);
  const juntas = [];
  if (esp.caja) {
    const c = esp.caja;
    const version = sesion.codigo[8] === "J" ? "X" : "Y";
    c.version = version;
    c.activa = c[version];
    c.otra = c.activa.otra;
    c.otra.forEach((i) => fijas.add(i));
    if (buscarCodigo(cro, c.funcion) < 0 || !scriptDeSalvajes(sesion, perfil, c.archivo, c.desde)) c.activa.entradas.forEach((i) => fijas.add(i));
  }
  if (esp.errantes) {
    const e = esp.errantes;
    if (buscarCodigo(sesion.code, e.localizador) < 0 || buscarCodigo(sesion.code, e.libre) < 0 || !scriptDeSalvajes(sesion, perfil, e.archivo, e.desde)) e.entradas.forEach((i) => fijas.add(i));
  }
  if (esp.rayquaza) {
    const r = esp.rayquaza;
    const garc = leerGarc(sesion.archivo(r.ruta));
    if (buscarCodigo(cro, r.funcion) < 0 || !leerAmx(garc.archivos[r.archivo])) fijas.add(r.entrada);
  }
  for (let i = 0; i < est.fijos.cuantos; i++) {
    const pos = est.fijos.desde + i * 12;
    const actual = u16(cro, pos);
    estaticos.push({ tabla: "fijo6", pos, actual, nivelActual: cro[pos + 3], ignorar: !valida(actual) || fijas.has(i) });
  }
  for (let i = 0; i < est.regalos.cuantos; i++) {
    if (est.regalos.saltar.includes(i)) continue;
    const pos = est.regalos.desde + i * est.regalos.tam;
    const actual = u16(cro, pos);
    const huevo = est.regalos.huevo !== undefined && u16(cro, pos + est.regalos.huevo) === 0xea64;
    estaticos.push({ tabla: "regalo6", pos, actual, nivelActual: cro[pos + 5], huevo, ignorar: !valida(actual) });
  }
  for (const [base, copia] of est.enlazados) if (estaticos[copia]) estaticos[copia].copiaDe = base;
  // Los cubos de basura de X e Y: los de la misma especie de cada sitio, juntos
  if (esp.basuras) {
    const marca = buscarCodigo(sesion.code, esp.basuras.marca);
    if (marca >= 0) {
      const tabla = marca + esp.basuras.marca.length / 2;
      for (const [desde, cuantos, juntar] of esp.basuras.conjuntos) {
        const primera = new Map();
        for (let i = desde; i < desde + cuantos; i++) {
          const pos = tabla + i * 16;
          const actual = u32(sesion.code, pos);
          const e = { tabla: "basura", pos, actual, nivelActual: u32(sesion.code, pos + 8), ignorar: !valida(actual) };
          if (juntar && primera.has(actual)) e.copiaDe = primera.get(actual);
          else primera.set(actual, estaticos.length);
          estaticos.push(e);
        }
      }
    }
  }
  const intercambios = [];
  const marca = buscarCodigo(sesion.code, est.trueques.prefijo);
  if (marca >= 0) {
    const inicio = marca + est.trueques.prefijo.length / 2;
    for (let i = 0; i < est.trueques.cuantos; i++) {
      const pos = inicio + i * 0x24;
      const da = u16(sesion.code, pos);
      if (!valida(da)) continue;
      const ivs = [0, 1, 2, 3, 4, 5].map((k) => sesion.code[pos + 5 + k]);
      intercambios.push({
        indice: i, pos, enCodigo: true, da, daOriginal: da, pide: u16(sesion.code, pos + 0x20), pideOriginal: u16(sesion.code, pos + 0x20),
        objeto: u16(sesion.code, pos + 0x10), objetoOriginal: u16(sesion.code, pos + 0x10), ivs, ivsOriginal: ivs.slice(), apodo: est.trueques.extra + i
      });
    }
  }
  return { estaticos, intercambios };
}

// El script (AMX) que hay en una entrada de los salvajes de X e Y, ya descomprimida: { entrada, amx, desde, tam } o null
function scriptDeSalvajes(sesion, perfil, archivo, desde) {
  try {
    const entrada = descomprimirLZ11(leerGarc(sesion.archivo(perfil.rutas.salvajes)).archivos[archivo]);
    const tam = u32(entrada, desde) & 0xffffff;
    const amx = leerAmx(entrada.subarray(desde, desde + tam));
    return amx ? { entrada, amx, desde, tam } : null;
  } catch (error) {
    return null;
  }
}

function poner32(b, i, v) {
  poner16(b, i, v & 0xffff);
  poner16(b, i + 2, (v >>> 16) & 0xffff);
}

// Las comparaciones con la especie en el DllField.cro (de «cmp r0, #especie» a «sub r0, r0, #alta; subs r0, r0, #baja»,
// que vale para cualquier especie)
function parcheComparaciones(cro, funcion, desplazos, especie) {
  const base = buscarCodigo(cro, funcion);
  if (base < 0) return;
  for (const d of desplazos) {
    const pos = base + funcion.length / 2 + d;
    cro.set([(especie >> 8) & 0xff, 0x0c, 0x40, 0xe2, especie & 0xff, 0x00, 0x50, 0xe2], pos);
  }
}

// Lo que además de la tabla hay que cambiar para los estáticos con código y scripts propios
function escribirEspeciales6(sesion, datos, cro) {
  const est = datos.perfil.base.estaticos6;
  const esp = est.especiales || {};
  const nuevaDe = (i) => {
    const e = datos.estaticos[i];
    return e && !e.ignorar && e.nueva !== undefined ? e.nueva : null;
  };
  const guardar = (ruta, nuevos) => sesion.cambiar(ruta, crearGarc(sesion.archivo(ruta), nuevos));
  // Cambia especies de un AMX dentro de una entrada de los salvajes (comprimida) y la devuelve comprimida
  const reescribirScript = (s, offsets, especies) => {
    especies.forEach((especie, k) => poner16Amx(s.amx, offsets[k], especie));
    const nuevo = escribirAmx(s.amx);
    const entrada = s.entrada.slice();
    entrada.fill(0, s.desde, s.desde + s.tam);
    entrada.set(nuevo, s.desde);
    return comprimirLZ11(entrada);
  };
  const salvajes = datos.perfil.rutas.salvajes;
  if (esp.caja) {
    const c = esp.caja;
    const especie = nuevaDe(c.activa.entradas[0]);
    const s = especie && scriptDeSalvajes(sesion, datos.perfil, c.archivo, c.desde);
    if (s) {
      guardar(salvajes, { [c.archivo]: reescribirScript(s, c.activa.offsets, c.activa.offsets.map(() => especie)) });
      parcheComparaciones(cro, c.funcion, c.codigo, especie);
    }
  }
  if (esp.errantes) {
    const e = esp.errantes;
    const especies = e.entradas.map(nuevaDe);
    if (especies.every(Boolean) || especies.some(Boolean)) {
      const originales = e.entradas.map((i) => datos.estaticos[i].actual);
      const finales = especies.map((x, k) => x || originales[k]);
      const s = scriptDeSalvajes(sesion, datos.perfil, e.archivo, e.desde);
      const sitioLocalizador = buscarCodigo(sesion.code, e.localizador);
      const sitioLibre = buscarCodigo(sesion.code, e.libre);
      if (s && sitioLocalizador >= 0 && sitioLibre >= 0) {
        const code = sesion.code;
        // El hueco: tres instrucciones de relleno detrás de otras cinco; se suben los dos saltos para tener 12 bytes libres
        const libre = sitioLibre - 20;
        code[libre] = code[libre + 4] + 1;
        code.copyWithin(libre + 1, libre + 5, libre + 8);
        code[libre + 4] = code[libre + 16] + 3;
        code.copyWithin(libre + 5, libre + 17, libre + 20);
        finales.forEach((especie, k) => poner32(code, libre + 8 + k * 4, especie));
        // Donde el juego pone la especie del errante (moveq r4, #n), que la cargue de lo escrito
        finales.forEach((_, k) => code.set([0xac - 8 * k, 0x41, 0x9f, 0xe5], sitioLocalizador + k * 12));
        guardar(salvajes, { [e.archivo]: reescribirScript(s, e.offsets, finales) });
      }
    }
  }
  if (esp.rayquaza) {
    const r = esp.rayquaza;
    const especie = nuevaDe(r.entrada);
    if (especie) {
      const garc = leerGarc(sesion.archivo(r.ruta));
      const amx = leerAmx(garc.archivos[r.archivo]);
      r.offsets.forEach((o) => poner16Amx(amx, o, especie));
      guardar(r.ruta, { [r.archivo]: escribirAmx(amx) });
      parcheComparaciones(cro, r.funcion, r.codigo, especie);
    }
  }
}

function escribirEstaticos6(sesion, datos) {
  const est = datos.perfil.base.estaticos6;
  const cro = sesion.archivo(est.cro);
  let cambiado = false;
  datos.estaticos.forEach((e) => {
    const nueva = e.copiaDe !== undefined ? datos.estaticos[e.copiaDe].nueva : e.nueva;
    if (nueva === undefined || nueva === e.actual || e.ignorar || e.huevo) return;
    if (e.tabla === "basura") {
      poner32(sesion.code, e.pos, nueva);
      poner32(sesion.code, e.pos + 4, 0);
      return;
    }
    poner16(cro, e.pos, nueva);
    cro[e.pos + (e.tabla === "fijo6" ? 2 : 4)] = 0; // sin forma especial
    cambiado = true;
  });
  const antes = cro.slice();
  escribirEspeciales6(sesion, datos, cro);
  if (cambiado || cro.some((v, i) => v !== antes[i])) sesion.cambiar(est.cro, cro);
  const code = sesion.code;
  for (const t of datos.intercambios) {
    if (t.da !== t.daOriginal) {
      poner16(code, t.pos, t.da);
    }
    if (t.pide !== t.pideOriginal) poner16(code, t.pos + 0x20, t.pide);
    if (t.objeto !== t.objetoOriginal) poner16(code, t.pos + 0x10, t.objeto);
    t.ivs.forEach((v, k) => (code[t.pos + 5 + k] = v));
  }
}// Los estáticos y los intercambios nuevos en el GARC de estáticos
function escribirEstaticos(sesion, datos) {
  const est = datos.perfil.base.estaticos;
  const garc = leerGarc(sesion.archivo(est.ruta));
  const nuevos = {};
  const archivo = (i) => nuevos[i] || (nuevos[i] = garc.archivos[i].slice());
  datos.estaticos.forEach((e) => {
    const nueva = e.copiaDe !== undefined ? datos.estaticos[e.copiaDe].nueva : e.nueva;
    if (nueva === undefined || nueva === e.actual || e.ignorar || e.huevo) return;
    if (e.tabla === "zygarde") {
      // La especie, y la forma como «mov r0, #0»
      poner16(sesion.code, e.pos, nueva);
      sesion.code.set([0x00, 0x00, 0xa0, 0xe3], e.posForma);
      return;
    }
    const d = archivo(e.tabla === "regalo" ? 0 : 1);
    poner16(d, e.pos, nueva);
    d[e.pos + 2] = 0; // sin forma especial
    // Los ataques que traían (en los encuentros) ya no valen: que use los suyos
    if (e.tabla === "fijo") for (let k = 12; k < 20; k++) d[e.pos + k] = 0;
  });
  // Los tótems (su especie, su aura) y sus aliados; los ataques que traían ya no valen
  const poner = (e, nueva) => {
    if (nueva === undefined || nueva === e.actual) return;
    const d = archivo(1);
    poner16(d, e.pos, nueva);
    d[e.pos + 2] = 0;
    for (let k = 12; k < 20; k++) d[e.pos + k] = 0;
  };
  for (const t of datos.totems || []) {
    if (t.sinUso) continue;
    poner(t, t.nueva);
    if (t.aura !== t.auraOriginal) archivo(1)[t.pos + 0x25] = t.aura;
    for (const a of t.aliados) poner(a, a.nueva);
  }
  for (const t of datos.intercambios) {
    if (t.da === t.daOriginal && t.pide === t.pideOriginal && t.objeto === t.objetoOriginal && t.ivs.every((v, k) => v === t.ivsOriginal[k])) continue;
    const d = archivo(4);
    if (t.da !== t.daOriginal) {
      poner16(d, t.pos, t.da);
      d[t.pos + 4] = 0;
    }
    if (t.pide !== t.pideOriginal) poner16(d, t.pos + 0x2c, t.pide);
    if (t.objeto !== t.objetoOriginal) poner16(d, t.pos + 0x14, t.objeto);
    t.ivs.forEach((v, k) => (d[t.pos + 6 + k] = v));
  }
  if (Object.keys(nuevos).length) sesion.cambiar(est.ruta, crearGarc(sesion.archivo(est.ruta), nuevos));
}

// Lusamine bestia (Sol y Luna): la mejora de estadística de sus Pokémon va por especie, así que con otro equipo hay que ponerla a
// cada uno (en la estadística más alta que tenga, como en UPR). Solo si su equipo ha cambiado.
function escribirLusamina(sesion, datos) {
  const l = datos.perfil.base.lusamina;
  const t = datos.entrenadores.find((x) => x.indice === l.entrenador);
  if (!t) return;
  const cro = sesion.archivo(l.cro);
  const marca = buscarCodigo(cro, l.prefijo);
  if (marca < 0) return;
  const base = marca + l.prefijo.length / 2;
  const especies = [];
  for (const p of t.pokemon) if (!especies.includes(p.especie)) especies.push(p.especie);
  const n = Math.min(especies.length, l.cuantos);
  if (especies.slice(0, n).every((e, i) => u16(cro, base + i * 0x10) === e)) return;
  especies.slice(0, n).forEach((especie, i) => {
    const stats = datos.especies[especie].stats; // PS, Ataque, Defensa, Ataque Esp., Defensa Esp., Velocidad
    let mejor = 1;
    for (let k = 2; k <= 5; k++) if (stats[k] > stats[mejor]) mejor = k;
    poner16(cro, base + i * 0x10, especie);
    cro[base + i * 0x10 + 2] = mejor; // 1 ataque, 2 defensa, 3 ataque especial, 4 defensa especial, 5 velocidad
  });
  sesion.cambiar(l.cro, cro);
}

// En cada idioma: el apodo del Pokémon que dan y lo que dicen (a mano) los que lo ofrecen
function escribirTextosIntercambios(sesion, datos) {
  const b = datos.perfil.base;
  const est = b.estaticos || b.estaticos6;
  const cambiados = datos.intercambios.filter((t) => t.da !== t.daOriginal || t.pide !== t.pideOriginal);
  if (!cambiados.length) return;
  b.textoRutas.forEach((rutaTexto, idioma) => {
    const nombres = leerTextos6(leerGarc(sesion.archivo(rutaTexto)).archivos[b.textos.especies]).lineas;
    const editar = (ruta, indice, cambio) => {
      const garc = leerGarc(sesion.archivo(ruta));
      const lineas = leerTextos6(garc.archivos[indice]).lineas;
      cambio(lineas);
      sesion.cambiar(ruta, crearGarc(sesion.archivo(ruta), { [indice]: escribirTextos6(garc.archivos[indice], lineas) }));
    };
    // El nombre de antes por una marca y la marca por el de ahora, para que no se pisen entre ellos
    const sustituir = (texto, t) => {
      const cambios = [];
      if (t.da !== t.daOriginal) cambios.push([nombres[t.daOriginal], nombres[t.da]]);
      if (t.pide !== t.pideOriginal) cambios.push([nombres[t.pideOriginal], nombres[t.pide]]);
      const validos = cambios.filter(([viejo, nuevo]) => viejo && nuevo && viejo !== nuevo);
      validos.forEach(([viejo], k) => (texto = texto.split(viejo).join(`\u0001${k}\u0001`)));
      validos.forEach(([, nuevo], k) => (texto = texto.split(`\u0001${k}\u0001`).join(nuevo)));
      return texto;
    };
    const apodos = (lineas) => {
      for (const t of cambiados) if (t.da !== t.daOriginal && nombres[t.da] && lineas[t.apodo] !== undefined) lineas[t.apodo] = nombres[t.da];
    };
    if (b.estaticos) {
      // 7.ª: los apodos y los diálogos, en el mismo archivo de la historia
      editar(est.historia[idioma], est.textoIntercambios, (lineas) => {
        apodos(lineas);
        for (const t of cambiados) for (const linea of est.dialogos[t.indice] || []) if (lineas[linea] !== undefined) lineas[linea] = sustituir(lineas[linea], t);
      });
      return;
    }
    // 6.ª: los apodos, con los textos del juego; los diálogos a mano (solo en X e Y), en un archivo entero de la historia
    editar(rutaTexto, est.trueques.texto, apodos);
    for (const t of cambiados) {
      const archivo = est.dialogos[t.indice];
      if (archivo !== undefined) editar(est.historia[idioma], archivo, (lineas) => lineas.forEach((l, i) => (lineas[i] = sustituir(l, t))));
    }
  });
}
// ---------- Lo que todavía no se hace en 3DS ----------

// ---------- MT ----------

function buscarCodigo(code, hex) {
  const patron = hex.match(/../g).map((x) => parseInt(x, 16));
  let sitio = -1;
  for (let i = 0; i + patron.length <= code.length; i++) {
    if (code[i] !== patron[0] || !patron.every((b, k) => code[i + k] === b)) continue;
    if (sitio >= 0) return -1; // dos veces: no vale
    sitio = i;
  }
  return sitio;
}

// Los ataques de las 100 MT (92 seguidas y las 8 últimas, más allá) y de las MO
export function leerMovimientos(sesion) {
  const perfil = perfilDe(sesion);
  const { tm } = perfil.base;
  const marca = buscarCodigo(sesion.code, tm.prefijo);
  if (marca < 0) throw new Error("No se han encontrado las MT.");
  const inicio = marca + tm.prefijo.length / 2;
  const lista = (desde, cuantos) => Array.from({ length: cuantos }, (_, k) => u16(sesion.code, desde + k * 2));
  const mt = [...lista(inicio, 92), ...lista(inicio + tm.dos * 2, 8)];
  const mo = lista(inicio + 92 * 2, tm.hm);
  for (const extra of tm.hmExtra || []) mo.push(u16(sesion.code, inicio + 92 * 2 + extra));
  return { mt, mo, ...leerTutores(sesion, perfil), inicio };
}

// Los ataques de los tutores (ORAS, Ultrasol y Ultraluna): la lista del programa, con dónde está cada uno
function leerTutores(sesion, perfil) {
  const t = perfil.base.tutores;
  if (!t) return { tutor: [] };
  const marca = buscarCodigo(sesion.code, t.lista.localizador);
  if (marca < 0) throw new Error("No se han encontrado los tutores.");
  const tutor = [];
  const tutorPos = [];
  for (let pos = marca + t.lista.desde; ; pos += 2) {
    const v = u16(sesion.code, pos);
    if (v === 0xffff) break;
    if (v === t.lista.separador) continue;
    tutor.push(v);
    tutorPos.push(pos);
  }
  return { tutor, tutorPos, tutorOriginal: tutor.slice() };
}

export function escribirMovimientos(sesion, m) {
  const { tm } = perfilDe(sesion).base;
  m.mt.slice(0, 92).forEach((id, k) => poner16(sesion.code, m.inicio + k * 2, id));
  m.mt.slice(92).forEach((id, k) => poner16(sesion.code, m.inicio + (tm.dos + k) * 2, id));
  const t = perfilDe(sesion).base.tutores;
  if (!t || !m.tutorPos) return;
  m.tutorPos.forEach((pos, k) => poner16(sesion.code, pos, m.tutor[k]));
  // La tienda de PB: cada ataque de antes, por el que lo sustituye (por su valor: el orden de la tienda no es el de la lista)
  const fuente = t.tienda.cro ? sesion.archivo(t.tienda.cro) : sesion.code;
  const inicio = t.tienda.cro ? t.tienda.desde : buscarCodigo(sesion.code, t.tienda.prefijo) + t.tienda.prefijo.length / 2;
  for (let i = 0; i < t.tienda.cuantas; i++) {
    const pos = inicio + i * t.tienda.paso;
    const k = m.tutorOriginal.indexOf(u16(fuente, pos));
    if (k >= 0) poner16(fuente, pos, m.tutor[k]);
  }
  if (t.tienda.cro) sesion.cambiar(t.tienda.cro, fuente);
}
// Lo que se baraja son los números de cada nombre (el del entrenador n está en la línea n - 1; el de cada clase,
// en su número), no los textos: así vale para todos los idiomas
export function leerNombresEntrenadores(sesion) {
  const perfil = perfilDe(sesion);
  const n = nombresDe(sesion, perfil, "entrenadores").length;
  return { nombres: Array.from({ length: n + 1 }, (_, i) => i), clases: Array.from({ length: nombresDe(sesion, perfil, "clases").length }, (_, i) => i) };
}
// Cambia unas líneas de un archivo de texto (en español) de un GARC de textos: cambios(lineas) las modifica
function cambiarTexto(sesion, ruta, indice, cambios) {
  const garc = leerGarc(sesion.archivo(ruta));
  const lineas = leerTextos6(garc.archivos[indice]).lineas;
  cambios(lineas);
  sesion.cambiar(ruta, crearGarc(sesion.archivo(ruta), { [indice]: escribirTextos6(garc.archivos[indice], lineas) }));
}

// Que lo que se lee cuadre: las iniciales (nombre y tipo, en la pantalla de elegir) y la descripción de cada MT
export function actualizarTextos(sesion, { iniciales, mt, entrenadores }) {
  const perfil = perfilDe(sesion);
  const b = perfil.base;
  if (entrenadores) {
    // Los nombres y las clases barajados, en todos los idiomas: cada uno coge el texto del que le toca
    for (const ruta of b.textoRutas) {
      const garc = leerGarc(sesion.archivo(ruta));
      const nombres = leerTextos6(garc.archivos[b.textos.entrenadores]).lineas;
      const clases = leerTextos6(garc.archivos[b.textos.clases]).lineas;
      const nuevosNombres = nombres.slice();
      entrenadores.nombres.forEach((de, i) => {
        if (i >= 1 && de >= 1 && nombres[de - 1] !== undefined) nuevosNombres[i - 1] = nombres[de - 1];
      });
      const nuevasClases = clases.map((x, i) => (entrenadores.clases[i] !== undefined && clases[entrenadores.clases[i]] !== undefined ? clases[entrenadores.clases[i]] : x));
      sesion.cambiar(ruta, crearGarc(sesion.archivo(ruta), {
        [b.textos.entrenadores]: escribirTextos6(garc.archivos[b.textos.entrenadores], nuevosNombres),
        [b.textos.clases]: escribirTextos6(garc.archivos[b.textos.clases], nuevasClases)
      }));
    }
  }
  if (mt && b.tm) {
    // MT01 a 92 son los objetos 328 en adelante; MT93 a 95, del 618; MT96 a 100, del 690
    const garc = leerGarc(sesion.archivo(b.rutas.textoEs));
    const descObjetos = leerTextos6(garc.archivos[b.tm.descObjetos]).lineas;
    const descAtaques = leerTextos6(garc.archivos[b.tm.descAtaques]).lineas;
    mt.forEach((ataque, k) => {
      const objeto = k < 92 ? 328 + k : k < 95 ? 618 + (k - 92) : 690 + (k - 95);
      if (descAtaques[ataque] !== undefined) descObjetos[objeto] = descAtaques[ataque];
    });
    sesion.cambiar(b.rutas.textoEs, crearGarc(sesion.archivo(b.rutas.textoEs), {
      [b.tm.descObjetos]: escribirTextos6(garc.archivos[b.tm.descObjetos], descObjetos)
    }));
  }
  if (!iniciales || !iniciales.length || !(b.iniciales || b.inicialesGarc)) return;
  const nombres = nombresPokemon(sesion);
  const nuevas = iniciales.ahora.map((id) => nombres[id] || "");
  if (b.iniciales) {
    // «Nombre, Pokémon de tipo Planta» (el nombre va como variable; solo cambia el tipo)
    cambiarTexto(sesion, b.rutas.textoEs, b.iniciales.texto, (t) => {
      for (let k = 0; k < 3; k++) t[1 + k] = t[1 + k].replace(/tipo \S+$/, `tipo ${iniciales[k].tipo}`);
    });
  } else {
    const hist = b.inicialesGarc;
    cambiarTexto(sesion, hist.textoHistoria, hist.texto, (t) => {
      for (let k = 0; k < 3; k++) {
        t[1 + k] = `${nuevas[k]}, de tipo ${iniciales[k].tipo}`;
        if (hist.lineas) {
          // Ultrasol y Ultraluna: gritos, confirmaciones y nombres en otras líneas
          t[hist.lineas.grito + k] = `¡${nuevas[k]}!`;
          t[hist.lineas.confirmar + k] = t[hist.lineas.confirmar + k].replace(/de tipo [^\u0000-\u001f?]+\?/, `de tipo ${iniciales[k].tipo}?`);
          t[hist.lineas.nombre + k] = nuevas[k];
          continue;
        }
        t[4 + k] = t[4 + k].replace(/de tipo [^\u0000-\u001f?]+\?/, `de tipo ${iniciales[k].tipo}?`);
        t[11 + k] = `¡${nuevas[k]} te está mirando fijamente!`;
        t[14 + k] = `${nuevas[k].slice(0, 3)}...`;
        t[17 + k] = `¡${nuevas[k]}!`;
      }
    });
  }
}
export function ponerAspectoIniciales() {}
export function ponerCombatesDobles() {}

// Hierba en los pueblos que no tienen (ver ./hierba-3ds.js). Antes de leerBW2 (carga lo que le hace falta).
// Devuelve las zonas que la llevan.
export function ponerHierbaEnPueblos(sesion) {
  return hierbaEnPueblos(sesion, perfilDe(sesion), { leerGarc, crearGarc, descomprimirLZ11, comprimirLZ11 });
}

// Texto instantáneo: dos instrucciones del programa que cargan la velocidad del texto, detrás de unas marcas
const MARCAS_TEXTO = {
  6: ["1080BDE80000A0E31080BDE8F0412DE9", "485080E59C4040E24C50C0E5EC009FE5"],
  7: ["1080BDE80E000500F0412DE9", "34019FE50060A0E3"]
};
export function ponerTextoRapido(sesion) {
  const perfil = perfilDe(sesion);
  MARCAS_TEXTO[perfil.gen].forEach((marca, k) => {
    const sitio = buscarCodigo(sesion.code, marca);
    if (sitio < 0) return;
    // mov r4, #3 (la primera) y mov r5, #3 (la segunda)
    sesion.code.set([0x03, k ? 0x50 : 0x40, 0xa0, 0xe3], sitio + marca.length / 2);
  });
}

// Pokédex Nacional (solo 6.ª generación): se aplica al escribir, junto con lo demás
export function ponerPokedexNacional(datos) {
  datos.pokedexNacional = true;
}

function parchePokedexNacional(sesion, perfil) {
  const code = sesion.code;
  const poner = (pos, bytes) => code.set(bytes, pos);
  // Savedata::ZukanData::GetZenkokuZukanFlag: en vez de leer la marca, «mov r0, #1»
  const flag = buscarCodigo(code, "080094E5010000E21080BDE8170F122F");
  if (flag >= 0) poner(flag, [0x01, 0x00, 0xa0, 0xe3]);
  if (perfil.id === "xy") {
    // GetDexFlag(int): sin la comparación con 0 y con el salto siempre, para que estén todas las Pokédex
    const f = buscarCodigo(code, "000055E30100A0030A00000A");
    if (f >= 0) {
      poner(f, [0, 0, 0, 0]);
      code[f + 7] = 0xe3;
      code[f + 11] = 0xea;
    }
    return;
  }
  // ORAS: que la función de los capturados de Hoenn dé 1 si no se ha capturado ninguno (si no, no deja abrir la Pokédex)
  const marca = "170F122F1CC15800";
  const m = buscarCodigo(code, marca);
  if (m < 0) return;
  const o = m + marca.length / 2;
  code[o + 31] = 0xea;
  poner(o + 32, [0x07, 0x00, 0xa0, 0xe1]);
  poner(o + 36, [0x00, 0x00, 0x50, 0xe3]);
  poner(o + 40, [0x01, 0x00, 0xa0, 0x03]);
  poner(o + 44, [0xf0, 0x9f, 0xbd, 0xe8]);
  poner(o + 208, [0xd2, 0xff, 0xff, 0xea]);
}
