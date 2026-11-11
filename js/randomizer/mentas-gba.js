// ---------- Las mentas en Rojo Fuego / Verde Hoja ----------
//
// Objetos de la 8.ª generación que el juego no tiene: cambian la naturaleza de un Pokémon del equipo (desde la
// Mochila, como el Caramelo Raro). Van en 21 huecos sin usar de la tabla de objetos (del 226 al 246: ver
// ../partida/datos-gba.js), con su nombre, descripción, dibujo (./dibujos-mentas.js) y un programa nuevo en el
// espacio libre (./codigo-mentas-gba.js, montado de herramientas/mentas-gba.s), que necesita las direcciones de
// algunas funciones del juego. Esas direcciones cambian en cada versión: se sacan del propio código del Caramelo
// Raro (su objeto apunta a su función de campo, que apunta a la de usarlo, que apunta a la del paso siguiente),
// comprobando que esas funciones son byte a byte como en la ROM española (salvo las direcciones). Si en una
// versión no lo son, no se ponen.
//
// En el juego, la naturaleza es el PID % 25: la menta le busca otro PID que solo cambie eso (ver el .s), y la web
// lo reconoce después por su huella (js/partida/partidas.js).

import { CODIGO, SITIOS } from "./codigo-mentas-gba.js";
import { DIBUJO_MENTA, PALETAS_MENTA } from "./dibujos-mentas.js";
import { codigosGen3, ESPECIES_GEN3, PRIMERA_MENTA_GEN3, PRIMERA_MENTA_WEB, MENTAS } from "../partida/datos-gba.js";

export { PRIMERA_MENTA_WEB, MENTAS };

// La naturaleza de cada menta, en el orden de la web (1231 Huraña, 1232 Firme... 1251 Seria)
export const NATURALEZA_MENTA = [1, 3, 4, 2, 5, 8, 9, 7, 15, 16, 19, 17, 20, 21, 23, 22, 10, 11, 13, 14, 12];
// Su color (./dibujos-mentas.js), por la estadística que sube: la naturaleza / 5 es la que sube (Ataque,
// Defensa, Velocidad, At. Esp., Def. Esp.); la Seria, que no sube nada, aparte
const COLOR_DE_ESTADISTICA = [0, 1, 4, 2, 3];
const colorDe = (naturaleza) => (naturaleza % 6 === 0 ? 5 : COLOR_DE_ESTADISTICA[Math.floor(naturaleza / 5)]);

export const PRECIO_MENTA = 20000; // como en Escarlata y Púrpura
export const TIENDA_MENTAS = 14; // el mostrador de las vitaminas, en la 5.ª planta del Centro Comercial de Azulona

const CARAMELO_RARO = 68; // su número en el juego
const TAM_OBJETO = 44;
const WURMPLE = 277 + ESPECIES_GEN3.indexOf(265);

// ---------- Textos ----------
//
// Por idioma (la última letra del código del juego: BPRS, Rojo Fuego en español): las 25 naturalezas como las
// escribe el juego, el nombre de la menta (13 letras como mucho), su descripción en la Mochila (dos líneas) y lo que
// dice al usarla ({V} es el mote del Pokémon)

const NATURALEZAS = {
  S: "FUERTE HURAÑA AUDAZ FIRME PÍCARA OSADA DÓCIL PLÁCIDA AGITADA FLOJA MIEDOSA ACTIVA SERIA ALEGRE INGENUA MODESTA AFABLE MANSA TÍMIDA ALOCADA SERENA AMABLE GROSERA CAUTA RARA",
  E: "HARDY LONELY BRAVE ADAMANT NAUGHTY BOLD DOCILE RELAXED IMPISH LAX TIMID HASTY SERIOUS JOLLY NAIVE MODEST MILD QUIET BASHFUL RASH CALM GENTLE SASSY CAREFUL QUIRKY",
  F: "HARDI SOLO BRAVE RIGIDE MAUVAIS ASSURÉ DOCILE RELAX MALIN LÂCHE TIMIDE PRESSÉ SÉRIEUX JOVIAL NAÏF MODESTE DOUX DISCRET PUDIQUE FOUFOU CALME GENTIL MALPOLI PRUDENT BIZARRE",
  D: "ROBUST SOLO MUTIG HART FRECH KÜHN SANFT LOCKER PFIFFIG LASCH SCHEU HASTIG ERNST FROH NAIV MÄSSIG MILD RUHIG ZAGHAFT HITZIG STILL ZART FORSCH SACHT KAUZIG",
  I: "ARDITA SCHIVA AUDACE DECISA BIRBONA SICURA DOCILE PLACIDA SCALTRA FIACCA TIMIDA LESTA SERIA ALLEGRA INGENUA MODESTA MITE QUIETA RITROSA ARDENTE CALMA GENTILE VIVACE CAUTA FURBA"
};

const TEXTOS = {
  S: {
    nombre: (n) => `MENTA ${n}`,
    descripcion: (n) => `Su aroma cambia la naturaleza\nde un POKéMON a ${n}.`,
    mensaje: (n) => `¡{V} tiene ahora\nnaturaleza ${n}!`
  },
  E: {
    nombre: (n) => `${n} MINT`,
    descripcion: (n) => `Its scent changes a POKéMON's\nnature to ${n}.`,
    mensaje: (n) => `{V}'s nature\nbecame ${n}!`
  },
  F: {
    nombre: (n) => (`MENTHE ${n}`.length <= 13 ? `MENTHE ${n}` : `MENTH.${n}`),
    descripcion: (n) => `Son parfum change le naturel\nd'un POKéMON en ${n}.`,
    mensaje: (n) => `{V} a maintenant\nle naturel ${n} !`
  },
  D: {
    nombre: (n) => `${n}-MINZE`,
    descripcion: (n) => `Ihr Duft ändert das Wesen\neines POKéMON zu ${n}.`,
    mensaje: (n) => `{V}s Wesen ist\njetzt ${n}!`
  },
  I: {
    nombre: (n) => `MENTA ${n}`,
    descripcion: (n) => `Il suo aroma cambia la natura\ndi un POKéMON in ${n}.`,
    mensaje: (n) => `La natura di {V}\nora è ${n}!`
  }
};

// Un texto del juego: saltos de línea (0xFE), el mote ({V}: {STR_VAR_1}, 0xFD 0x02) y el final (0xFF)
function aBytes(texto) {
  const salida = [];
  for (const [i, trozo] of texto.split("{V}").entries()) {
    if (i) salida.push(0xfd, 0x02);
    for (const [k, linea] of trozo.split("\n").entries()) {
      if (k) salida.push(0xfe);
      salida.push(...codigosGen3(linea));
    }
  }
  salida.push(0xff);
  return Uint8Array.from(salida);
}

// ---------- Bytes ----------

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
function poner32(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >>> 8) & 0xff;
  b[i + 2] = (v >>> 16) & 0xff;
  b[i + 3] = (v >>> 24) & 0xff;
}
const ROM = 0x08000000;
const deHex = (texto) => Uint8Array.from(texto.match(/../g).map((x) => parseInt(x, 16)));

// ---------- Las direcciones del juego ----------
//
// Las tres funciones del Caramelo Raro (FieldUseFunc_RareCandy, ItemUseCB_RareCandy e ItemUseCB_RareCandyStep), tal
// cual en la ROM española: «..» es lo que cambia de una versión a otra (las llamadas y las palabras con direcciones).
// palabras / llamadas: dónde está cada dirección que hace falta (desde el principio de la función)
const PLANTILLAS = {
  campo: {
    hex: "00b50006000e034a03491160........01bc0047................",
    palabras: { gItemUseCB: 0x14, usar: 0x18 },
    llamadas: { DoSetUpItemUseCallback: 0x0c }
  },
  usar: {
    hex: "f0b5474680b488460006060e0b4f09217956642041430a480c180a480588201c3821........64280ed07a7a201c291c0023........0006040e06e0........................01240520........002c17d008490020087008480121........0220........0549b0008019c0004018414601600be0........................301c........04490448086008bc9846f0bc01bc00470000................",
    palabras: { gPartyMenu: 0x3c, gPlayerParty: 0x40, gSpecialVar_ItemId: 0x44, gPartyMenuUseExitCallback: 0x78, gText_WontHaveEffect: 0x7c, gTasks: 0x80, gItemUseCB: 0x9c, paso: 0xa0 },
    llamadas: { GetMonData: 0x22, PlaySE: 0x4c, DisplayPartyMenuMessage: 0x5e, ScheduleBgCopyTilemapToVram: 0x64, Task_DoUseItemAnim: 0x86 }
  },
  paso: {
    hex: "f0b5474680b480460006000e80462c4e0921715664200c1c44432a4824182a48076886229200b918201c........707a264d29880022........892080003918201c........2249012008702a88214b0420211c........0020........707a211c........28880121........1a49201c........201c3821........011c0906090e154800220323........144c1449201c........201c0121........0220........1049424690004044c00040180e49016008bc9846f0bc01bc0047................................................................................................",
    palabras: { gStringVar1: 0xd8, gStringVar4: 0xe0 },
    llamadas: { RemoveBagItem: 0x6a, GetMonNickname: 0x72, GetMonData: 0x7a, StringExpandPlaceholders: 0x94, DisplayPartyMenuMessage: 0x9c }
  }
};
// El principio de CalculateMonStats (push; mov r7, sl... ; sub sp, #0x40; adds r5, r0, #0; movs r1, #MAX_HP; movs
// r2, #0) y, detrás, la llamada a GetMonData
const CALCULAR_ESTADISTICAS = "f0b557464e464546e0b490b0051c3a210022";

function encaja(b, sitio, hex) {
  if (sitio < 0 || sitio + hex.length / 2 > b.length) return false;
  for (let k = 0; k < hex.length; k += 2) {
    if (hex[k] === "." || hex.slice(k, k + 2) === "..") continue;
    if (b[sitio + k / 2] !== parseInt(hex.slice(k, k + 2), 16)) return false;
  }
  return true;
}

// A dónde llama el «bl» que hay en «sitio» (la dirección de la GBA, con el bit de Thumb)
function destinoBL(b, sitio) {
  const alto = u16(b, sitio);
  const bajo = u16(b, sitio + 2);
  if ((alto & 0xf800) !== 0xf000 || (bajo & 0xf800) !== 0xf800) return 0;
  const desplazamiento = (((alto & 0x7ff) << 21) >> 9) | ((bajo & 0x7ff) << 1); // con signo
  return (ROM + sitio + 4 + desplazamiento) | 1;
}

function leerPlantilla(b, sitio, plantilla) {
  if (!encaja(b, sitio, plantilla.hex)) return null;
  const salida = {};
  for (const [nombre, o] of Object.entries(plantilla.palabras)) salida[nombre] = u32(b, sitio + o);
  for (const [nombre, o] of Object.entries(plantilla.llamadas)) salida[nombre] = destinoBL(b, sitio + o);
  return salida;
}

const enRom = (direccion) => (direccion >>> 0) - ROM;
const esRom = (direccion, b) => direccion >= ROM && enRom(direccion) < b.length;

// La tabla de dibujos de los objetos: [dibujo, paleta] por objeto (los 375 y la flecha de volver). El 0
// («????????») y los huecos sin usar del 52 al 62 (que nunca se tocan: las mentas van en otros), iguales; el 1 (la
// Master Ball), otro; y cada dibujo, uno de verdad: comprimido (0x10) y de 24 × 24 a 4 bits (0x120 bytes), con su
// paleta de 16 colores (0x20)
function tablaDibujos(b) {
  const esDibujo = (p, tam) => p >>> 24 === 8 && (p & 0xffffff) + 4 <= b.length && u32(b, p & 0xffffff) === ((tam << 8) | 0x10) >>> 0;
  for (let o = 0; o + 8 * 376 <= b.length; o += 4) {
    const [dibujo, paleta] = [u32(b, o), u32(b, o + 4)];
    if (!esDibujo(dibujo, 0x120) || !esDibujo(paleta, 0x20) || u32(b, o + 8) === dibujo) continue;
    let vale = true;
    for (let id = 52; id <= 62 && vale; id++) vale = u32(b, o + id * 8) === dibujo && u32(b, o + id * 8 + 4) === paleta;
    for (let id = 1; id < 376 && vale; id++) vale = esDibujo(u32(b, o + id * 8), 0x120) && esDibujo(u32(b, o + id * 8 + 4), 0x20);
    if (vale) return o;
  }
  return -1;
}

// Todo lo que hace falta del juego, o null si esta versión no es como la española (se guarda en la ROM)
export function direccionesMentas(rom, tablaObjetos) {
  if (rom.direccionesMentas !== undefined) return rom.direccionesMentas;
  rom.direccionesMentas = null;
  const b = rom.bytes;
  const campoCaramelo = u32(b, tablaObjetos + CARAMELO_RARO * TAM_OBJETO + 28);
  if (!esRom(campoCaramelo, b)) return null;
  const campo = leerPlantilla(b, enRom(campoCaramelo) & ~1, PLANTILLAS.campo);
  if (!campo || !esRom(campo.usar, b)) return null;
  const usar = leerPlantilla(b, enRom(campo.usar) & ~1, PLANTILLAS.usar);
  if (!usar || !esRom(usar.paso, b) || usar.gItemUseCB !== campo.gItemUseCB) return null;
  const paso = leerPlantilla(b, enRom(usar.paso) & ~1, PLANTILLAS.paso);
  if (!paso || paso.GetMonData !== usar.GetMonData || paso.DisplayPartyMenuMessage !== usar.DisplayPartyMenuMessage) return null;
  // CalculateMonStats: la única función que empieza así y llama a GetMonData justo después
  const deHexCalc = deHex(CALCULAR_ESTADISTICAS);
  const calcular = [];
  for (let o = 0; o + deHexCalc.length + 4 <= b.length && calcular.length < 2; o += 2) {
    if (b[o] !== deHexCalc[0] || !encaja(b, o, CALCULAR_ESTADISTICAS)) continue;
    if (destinoBL(b, o + deHexCalc.length) === usar.GetMonData) calcular.push(o);
  }
  const dibujos = tablaDibujos(b);
  if (calcular.length !== 1 || dibujos < 0) return null;
  const direcciones = { ...campo, ...usar, ...paso, CalculateMonStats: (ROM + calcular[0]) | 1, dibujos };
  // Que todo apunte a donde debe: las funciones a la ROM (en Thumb), lo demás a la RAM (o el texto, a la ROM)
  const funciones = ["DoSetUpItemUseCallback", "PlaySE", "Task_DoUseItemAnim", "CalculateMonStats", "RemoveBagItem", "GetMonNickname",
    "StringExpandPlaceholders", "DisplayPartyMenuMessage", "ScheduleBgCopyTilemapToVram", "GetMonData"];
  const ram = ["gItemUseCB", "gPartyMenu", "gPlayerParty", "gSpecialVar_ItemId", "gPartyMenuUseExitCallback", "gTasks", "gStringVar1", "gStringVar4"];
  if (!funciones.every((f) => esRom(direcciones[f], b) && direcciones[f] & 1)) return null;
  if (!ram.every((r) => direcciones[r] >= 0x02000000 && direcciones[r] < 0x03008000)) return null;
  if (!esRom(direcciones.gText_WontHaveEffect, b)) return null;
  rom.direccionesMentas = direcciones;
  return direcciones;
}

// ---------- Ponerlas ----------

// Como la compresión LZ77 de la GBA, pero sin comprimir nada (todo literal): así la descomprime el juego tal cual
function lzSinComprimir(datos) {
  const salida = [0x10, datos.length & 0xff, (datos.length >> 8) & 0xff, (datos.length >> 16) & 0xff];
  for (let i = 0; i < datos.length; i += 8) {
    salida.push(0);
    for (let k = i; k < Math.min(i + 8, datos.length); k++) salida.push(datos[k]);
  }
  return Uint8Array.from(salida);
}

function guardar(rom, bytes) {
  const sitio = rom.reservar(bytes.length);
  rom.bytes.set(bytes, sitio);
  return sitio;
}

// Las 21 mentas, en la tabla de objetos (tablaObjetos: dónde empieza) con su precio, su dibujo y su programa.
// Devuelve false si no se pueden poner en esta versión
export function ponerMentas(rom, tablaObjetos, precio = PRECIO_MENTA) {
  const d = direccionesMentas(rom, tablaObjetos);
  if (!d) return false;
  const b = rom.bytes;
  const idioma = TEXTOS[rom.codigo[3]] ? rom.codigo[3] : "E";
  const textos = TEXTOS[idioma];
  const naturalezas = NATURALEZAS[idioma].split(" ");

  // El programa, con las direcciones de esta versión
  const codigo = deHex(CODIGO);
  const base = rom.reservar(codigo.length);
  const mensajes = rom.reservar(25 * 4);
  const rellenar = {
    gItemUseCB: d.gItemUseCB, DoSetUpItemUseCallback: d.DoSetUpItemUseCallback,
    usar1: (ROM + base + SITIOS.usar1) | 1, usar2: (ROM + base + SITIOS.usar2) | 1,
    PlaySE: d.PlaySE, Task_DoUseItemAnim: d.Task_DoUseItemAnim, CalculateMonStats: d.CalculateMonStats,
    gPartyMenuUseExitCallback: d.gPartyMenuUseExitCallback, gSpecialVar_ItemId: d.gSpecialVar_ItemId, RemoveBagItem: d.RemoveBagItem,
    gStringVar1: d.gStringVar1, GetMonNickname: d.GetMonNickname, mensajes: ROM + mensajes, gStringVar4: d.gStringVar4,
    StringExpandPlaceholders: d.StringExpandPlaceholders, DisplayPartyMenuMessage: d.DisplayPartyMenuMessage,
    ScheduleBgCopyTilemapToVram: d.ScheduleBgCopyTilemapToVram, gText_WontHaveEffect: d.gText_WontHaveEffect, gTasks: d.gTasks,
    gPartyMenu: d.gPartyMenu, gPlayerParty: d.gPlayerParty, naturalezas: ROM + tablaObjetos + 19, GetMonData: d.GetMonData,
    wurmple: WURMPLE, orden: ROM + base + SITIOS.tabla_orden
  };
  for (const [nombre, valor] of Object.entries(rellenar)) {
    if (SITIOS[`L_${nombre}`] === undefined) throw new Error(`Falta ${nombre} en el programa de las mentas.`);
    poner32(codigo, SITIOS[`L_${nombre}`], valor);
  }
  b.set(codigo, base);
  const campo = (ROM + base + SITIOS.campo) | 1;

  // Los mensajes (por naturaleza; las que no tienen menta, «No tendrá ningún efecto», que no sale nunca)
  for (let n = 0; n < 25; n++) poner32(b, mensajes + n * 4, d.gText_WontHaveEffect);

  // El dibujo (uno para todas) y una paleta por color
  const dibujo = guardar(rom, lzSinComprimir(deHex(DIBUJO_MENTA)));
  const paletas = PALETAS_MENTA.map((p) => guardar(rom, lzSinComprimir(deHex(p))));

  const caramelo = b.slice(tablaObjetos + CARAMELO_RARO * TAM_OBJETO, tablaObjetos + (CARAMELO_RARO + 1) * TAM_OBJETO);
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    const id = PRIMERA_MENTA_GEN3 + k;
    const nombre = naturalezas[naturaleza];
    const o = tablaObjetos + id * TAM_OBJETO;
    // Como el Caramelo Raro (bolsillo de objetos, se usa en el equipo, no en combate), con lo suyo
    b.set(caramelo, o);
    const letras = codigosGen3(textos.nombre(nombre)).slice(0, 13);
    b.fill(0xff, o, o + 14);
    b.set(letras, o);
    b[o + 14] = id & 0xff;
    b[o + 15] = id >> 8;
    b[o + 16] = precio & 0xff;
    b[o + 17] = (precio >> 8) & 0xff;
    b[o + 18] = 0; // sin efecto al llevarla
    b[o + 19] = naturaleza;
    poner32(b, o + 20, ROM + guardar(rom, aBytes(textos.descripcion(nombre))));
    poner32(b, o + 28, campo);
    poner32(b, mensajes + naturaleza * 4, ROM + guardar(rom, aBytes(textos.mensaje(nombre))));
    poner32(b, d.dibujos + id * 8, ROM + dibujo);
    poner32(b, d.dibujos + id * 8 + 4, ROM + paletas[colorDe(naturaleza)]);
  });
  rom.cambiados.add("mentas");
  return true;
}
