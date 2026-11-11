// ---------- Las mentas en la 5.ª generación (Negro, Blanco, Negro 2, Blanco 2) ----------
//
// Como ./mentas-gen4.js: 21 objetos nuevos que cambian la naturaleza de un Pokémon del equipo. Van en los huecos sin
// usar del 505 al 525 (eran las Tarjetas de datos de HeartGold y SoulSilver: en los cuatro juegos apuntan a un objeto
// vacío con el dibujo de «?»):
//   · sus datos (a/0/2/4, un archivo por objeto: los del Caramelo Raro, con su precio y sin efectos), su dibujo y
//     paletas (al final de a/0/2/5) y su fila en la tabla del ARM9 que dice qué dibujo y qué paleta usa cada objeto;
//   · en Negro 2 y Blanco 2, su bolsillo en la tabla del ARM9 que dice en cuál va cada objeto (PML_ItemGetType: la
//     Bolsa lo busca ahí; sin esto, al usarla dice «Ya no tienes...»). Negro y Blanco lo miran en los datos del objeto;
//   · su nombre y descripción, y un mensaje por menta en el archivo de textos del menú del equipo (al final);
//   · el programa (./codigo-mentas-gen5.js, de herramientas/mentas-gen5.s), al final de la ITCM (como en la 4.ª
//     generación), y tres llamadas del menú del equipo (en su overlay) cambiadas para que pasen por él.
//
// En la 5.ª generación la naturaleza es un dato aparte (no sale del PID): el programa usa la función del juego que la
// cambia y recalcula las estadísticas. Las direcciones se sacan del ARM9 y del overlay del menú leyendo el código por
// su forma (los cuatro juegos lo tienen igual, con otras direcciones): ver direccionesMentasGen5.

import { CODIGO, SITIOS } from "./codigo-mentas-gen5.js";
import { DIBUJO_MENTA_DS, PALETAS_MENTA } from "./dibujos-mentas.js";
import { NATURALEZAS, TEXTOS, NATURALEZA_MENTA, colorDe, alargarItcm, PRECIO_MENTA_GEN4 } from "./mentas-gen4.js";

export const PRIMERA_MENTA_GEN5 = 505;
export const MENTAS_GEN5 = 21;

const ARM9 = 0x02004000; // dónde se carga el programa principal en la 5.ª generación
const CARAMELO_RARO = 50;
const DATOS = "a/0/2/4";
const ICONOS = "a/0/2/5";
const TEXTOS_SISTEMA = "a/0/0/2";

// Por juego: el overlay del menú del equipo (se mira primero; si no es ese, se buscan todos) y sus archivos de textos
const JUEGO = {
  bw: { overlay: 91, menu: 157, nombres: 54, descripciones: 53 },
  b2w2: { overlay: 165, menu: 178, nombres: 64, descripciones: 63 }
};
const tipoDe = (rom) => (/^IR[BA]/.test(rom.codigo) ? "bw" : /^IR[ED]/.test(rom.codigo) ? "b2w2" : null);

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
function poner16(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >> 8) & 0xff;
}
function poner32(b, i, v) {
  poner16(b, i, v & 0xffff);
  poner16(b, i + 2, (v >>> 16) & 0xffff);
}
const deHex = (texto) => Uint8Array.from(texto.match(/../g).map((x) => parseInt(x, 16)));

// ---------- Leer el código (Thumb) ----------

// A dónde llama el «bl» que hay en «o» (b se carga en «base»), o 0
function bl(b, o, base) {
  if (o + 4 > b.length) return 0;
  const alto = u16(b, o);
  const bajo = u16(b, o + 2);
  if ((alto & 0xf800) !== 0xf000 || (bajo & 0xf800) !== 0xf800) return 0;
  return (base + o + 4 + ((((alto & 0x7ff) << 21) >> 9) | ((bajo & 0x7ff) << 1))) >>> 0;
}

// Un «bl» en «o» que llama a «destino»
function ponerBL(b, o, base, destino) {
  const salto = destino - (base + o + 4);
  if (salto < -0x400000 || salto >= 0x400000) throw new Error("El salto a las mentas no llega.");
  poner16(b, o, 0xf000 | ((salto >> 12) & 0x7ff));
  poner16(b, o + 2, 0xf800 | ((salto >> 1) & 0x7ff));
}

// ¿Está esta serie de bytes en «o»? (cada «??», cualquiera)
function encaja(b, o, patron) {
  const partes = patron.match(/../g);
  if (o + partes.length > b.length) return false;
  return partes.every((p, k) => p === "??" || b[o + k] === parseInt(p, 16));
}
function buscarTodos(b, patron, paso = 2) {
  const sitios = [];
  const primero = parseInt(patron.slice(0, 2), 16);
  for (let o = 0; o < b.length; o += paso) if (b[o] === primero && encaja(b, o, patron)) sitios.push(o);
  return sitios;
}

// El principio de la función en la que está «o»: el «push {..., lr}» de antes
function inicio(b, o) {
  for (let k = o & ~1; k >= 0 && o - k < 0x800; k -= 2) if ((u16(b, k) & 0xff00) === 0xb500) return k;
  return -1;
}

// ---------- Las direcciones de cada versión ----------

// Negro 2 y Blanco 2: la tabla del bolsillo de cada objeto (un byte por objeto: 0 objetos, 1 medicinas, 2 MT, 3 bayas, 4
// clave), la de PML_ItemGetType («ldr r1, =tabla; ldrb r0, [r1, r0]; bx lr»). -1 si no la hay (Negro y Blanco)
function tablaBolsillos(a) {
  for (const o of buscarTodos(a, "0149085c7047")) {
    const t = u32(a, ((o + 4) & ~3) + 4) - ARM9;
    if (t > 0 && t + PRIMERA_MENTA_GEN5 + MENTAS_GEN5 <= a.length && a[t + 17] === 1 && a[t + CARAMELO_RARO] === 1 && a[t + 328] === 2) return t;
  }
  return -1;
}
// ¿Van ya las mentas en el bolsillo del Caramelo Raro? (o no hay tabla)
function bolsillosBien(a) {
  const t = tablaBolsillos(a);
  for (let k = 0; t >= 0 && k < MENTAS_GEN5; k++) if (a[t + PRIMERA_MENTA_GEN5 + k] !== a[t + CARAMELO_RARO]) return false;
  return true;
}
function ponerBolsillos(a) {
  const t = tablaBolsillos(a);
  if (t >= 0) a.fill(a[t + CARAMELO_RARO], t + PRIMERA_MENTA_GEN5, t + PRIMERA_MENTA_GEN5 + MENTAS_GEN5);
}

// Del ARM9: la que lee un dato de un objeto (Item_Get), PokeParty_SetNature (y PokeParty_GetParam, la de antes de
// PokeParty_SetParam) y la tabla de dibujos y paletas de los objetos
function delArm9(a) {
  const gip = buscarTodos(a, "08b51129??d84a187a44");
  const sn = buscarTodos(a, "10b50a1c041c7021????????201c????????10bd");
  if (gip.length !== 1 || sn.length !== 1) return null;
  const setParam = bl(a, sn[0] + 8, ARM9);
  const getParam = setParam - 0x24;
  // (las dos empiezan igual: push {r4-r6, lr}; r5 = r0; r4 = r1; r6 = r2)
  if (!encaja(a, setParam - ARM9, "70b5051c0c1c161c") || !encaja(a, getParam - ARM9, "70b5051c0c1c161c")) return null;
  // La tabla: [dibujo, paleta] por objeto; la fila 0 es la del objeto vacío, las de 1 a 3 son 2-3, 4-5 y 6-7, y los
  // huecos de las mentas (del 505 al 531) apuntan al vacío
  let tabla = -1;
  for (let t = 0; t + 532 * 4 <= a.length && tabla < 0; t += 4) {
    if (u32(a, t + 4) !== 0x30002 || u32(a, t + 8) !== 0x50004 || u32(a, t + 12) !== 0x70006) continue;
    let vacios = true;
    for (let id = 505; id <= 531 && vacios; id++) vacios = u32(a, t + id * 4) === u32(a, t);
    if (vacios && u32(a, t + 113 * 4) === u32(a, t)) tabla = t;
  }
  if (tabla < 0) return null;
  return { getItem: gip[0] + ARM9, getParam, setNature: sn[0] + ARM9, tablaObjetos: tabla };
}

// Del overlay del menú del equipo (b, cargado en «base»):
//   comprobar   la función que mira si un objeto hace algo: lee los datos del objeto «e 12 13 14 15 16 1a 1b 1c 29...»
//   aplicar     la que lo aplica: «e 12 13 14 15 16 1a 1b 1c 3a...»
//   los tres sitios del menú: «bl comprobar; cmp r0, #1; bne; r0 = menú; r1 = 0; bl preparar» y el «bl aplicar» de
//   detrás; «preparar» acaba en «bl mensaje; ldr r0, [sp, #4]; add sp, #8; pop {r3-r7, pc}»: «mensaje» pone en el menú
//   un mensaje con el mote del Pokémon
function delOverlay(b, base, getItem) {
  const datosDe = new Map(); // función -> los datos que lee, en orden
  for (let o = 0; o + 4 <= b.length; o += 2) {
    if (bl(b, o, base) !== getItem) continue;
    let dato = "?";
    for (let k = 2; k <= 12; k += 2) {
      if (o - k >= 0 && b[o - k + 1] === 0x21) {
        dato = b[o - k].toString(16);
        break;
      }
    }
    const f = inicio(b, o);
    if (f < 0) continue;
    if (!datosDe.has(f)) datosDe.set(f, []);
    datosDe.get(f).push(dato);
  }
  const conDatos = (prefijo) => [...datosDe].filter(([, lista]) => lista.join(" ").startsWith(prefijo)).map(([f]) => f);
  const comprobar = conDatos("e 12 13 14 15 16 1a 1b 1c 29 ");
  const aplicar = conDatos("e 12 13 14 15 16 1a 1b 1c 3a ");
  if (comprobar.length !== 1 || aplicar.length !== 1) return null;
  const dirComprobar = base + comprobar[0];
  const dirAplicar = base + aplicar[0];

  const sitios = [];
  for (let o = 0; o + 4 <= b.length; o += 2) {
    if (bl(b, o, base) !== dirComprobar || !encaja(b, o + 4, "0128??d1201c391c")) continue;
    const preparar = bl(b, o + 12, base);
    if (!preparar) continue;
    let aplicarEn = -1;
    for (let k = o + 16; k < o + 16 + 0x30 && aplicarEn < 0; k += 2) if (bl(b, k, base) === dirAplicar) aplicarEn = k;
    if (aplicarEn >= 0) sitios.push({ comprobar: o, preparar: o + 12, aplicar: aplicarEn, dirPreparar: preparar });
  }
  if (sitios.length !== 1) return null;
  const s = sitios[0];
  const fp = s.dirPreparar - base;
  if (fp < 0 || fp >= b.length || (u16(b, fp) & 0xff00) !== 0xb500) return null;
  let fin = -1;
  for (let o = fp; o < fp + 0x400 && fin < 0; o += 2) if (encaja(b, o, "019802b0f8bd")) fin = o;
  const mensaje = fin > 4 ? bl(b, fin - 4, base) : 0;
  if (!mensaje) return null;
  return {
    comprobacion: dirComprobar, aplicacion: dirAplicar, preparacion: s.dirPreparar, mensaje,
    sitioComprobar: s.comprobar, sitioPreparar: s.preparar, sitioAplicar: s.aplicar
  };
}

// Dónde se carga el overlay «n» (de su fila en la tabla de overlays del ARM9)
const baseOverlay = (rom, n) => u32(rom.bytes, u32(rom.bytes, 0x50) + n * 32 + 4);

// Todas las direcciones (null si esta versión no es como las conocidas). Con las mentas ya puestas ya no se pueden
// sacar (las llamadas del menú van al programa de las mentas): para eso, mentasYaPuestasGen5
export function direccionesMentasGen5(rom) {
  const tipo = tipoDe(rom);
  if (!tipo) return null;
  const a = rom.leerArm9();
  const d = delArm9(a);
  if (!d) return null;
  const cuantos = u32(rom.bytes, 0x54) / 32;
  const probar = [JUEGO[tipo].overlay, ...Array.from({ length: cuantos }, (_, n) => n).filter((n) => n !== JUEGO[tipo].overlay)];
  for (const n of probar) {
    const ov = delOverlay(rom.leerOverlay(n), baseOverlay(rom, n), d.getItem);
    if (ov) return { tipo, ...d, overlay: n, ...ov };
  }
  return null;
}

export function mentasPosiblesGen5(rom) {
  if (rom.direccionesMentasGen5 === undefined) {
    try {
      rom.direccionesMentasGen5 = direccionesMentasGen5(rom);
    } catch (error) {
      rom.direccionesMentasGen5 = null;
    }
  }
  return rom.direccionesMentasGen5;
}

// ¿Está ya su programa en el ARM9? (el principio de «comprobar»)
const programaPuesto = (a) => buscarTodos(a, CODIGO.slice(SITIOS.comprobar * 2, (SITIOS.comprobar + 20) * 2)).length > 0;

// ¿Tiene ya la ROM las mentas? (su programa y, en Negro 2 y Blanco 2, su bolsillo: las primeras versiones no lo ponían)
export function mentasYaPuestasGen5(rom) {
  if (rom.mentasYaPuestasGen5 === undefined) {
    const a = rom.leerArm9();
    rom.mentasYaPuestasGen5 = programaPuesto(a) && bolsillosBien(a);
  }
  return rom.mentasYaPuestasGen5;
}

// ---------- Ponerlas ----------

// Del texto normal a los caracteres de la 5.ª generación (los mismos de Unicode; el salto de línea, 0xFFFE; el
// apóstrofo, «’»)
const aJuego = (texto) => texto.replace(/'/g, "’").replace(/\n/g, "￾");

// Pone las 21 mentas. h: leerNarc, crearNarc, leerTextos y escribirTextos (los de ./rom-nds.js y ./textos-bw.js, que
// los pasa ./juego-gen5.js). Devuelve false si no se pueden poner aquí.
export function ponerMentasGen5(rom, h, precio = PRECIO_MENTA_GEN4) {
  if (mentasYaPuestasGen5(rom)) return true;
  // Puestas con una versión de antes, sin su bolsillo: solo eso
  const antes = rom.leerArm9();
  if (programaPuesto(antes)) {
    ponerBolsillos(antes);
    rom.escribirArm9(antes);
    rom.cambiados.add("mentas");
    rom.mentasYaPuestasGen5 = true;
    return true;
  }
  const d = mentasPosiblesGen5(rom);
  if (!d) return false;
  const j = JUEGO[d.tipo];
  const idioma = TEXTOS[rom.codigo[3]] ? rom.codigo[3] : "E";
  const textos = TEXTOS[idioma];
  const naturalezas = NATURALEZAS[idioma].split(" ");

  // Los textos: nombres, descripciones y, al final del archivo del menú, un mensaje por menta (con el mote como lo
  // pone el juego en sus mensajes: lo copia de «se ha curado de...»)
  const narcTextos = h.leerNarc(rom.archivo(rom.id(TEXTOS_SISTEMA)));
  const leidos = [j.menu, j.nombres, j.descripciones].map((n) => h.leerTextos(narcTextos.archivos[n]));
  if (leidos.some((t) => t.secciones !== 1)) return false;
  const [menu, nombres, descripciones] = leidos.map((t) => t.entradas.map((e) => e.texto));
  const modelo = menu[0x2e] || "";
  const variable = modelo.indexOf("");
  if (variable < 0 || nombres.length <= PRIMERA_MENTA_GEN5 + MENTAS_GEN5 || descripciones.length <= PRIMERA_MENTA_GEN5 + MENTAS_GEN5) return false;
  const mote = modelo.slice(variable, variable + 3 + modelo.charCodeAt(variable + 2));
  const primerMensaje = menu.length;
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    const n = naturalezas[naturaleza];
    nombres[PRIMERA_MENTA_GEN5 + k] = aJuego(textos.nombre(n));
    descripciones[PRIMERA_MENTA_GEN5 + k] = aJuego(textos.descripcion(n));
    menu.push(textos.mensaje(n).split("{V}").map(aJuego).join(mote));
  });

  // Los datos: como los del Caramelo Raro (se usan en el equipo desde la Bolsa y van en Medicinas), con su precio (en
  // decenas) y sin efectos (desde el byte 0x10: lo hace el programa); la naturaleza, en el dato del objeto
  const narcDatos = h.leerNarc(rom.archivo(rom.id(DATOS)));
  const caramelo = narcDatos.archivos[CARAMELO_RARO];
  if (!caramelo || caramelo.length < 0x10 || narcDatos.archivos.length <= PRIMERA_MENTA_GEN5 + MENTAS_GEN5) return false;
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    const dato = caramelo.slice();
    poner16(dato, 0, Math.round(precio / 10));
    dato[3] = naturaleza;
    dato.fill(0, 0x10);
    narcDatos.archivos[PRIMERA_MENTA_GEN5 + k] = dato;
  });

  // El dibujo (uno) y las paletas (una por color), como los del Caramelo Raro (el mismo formato que en la 4.ª)
  const arm9 = rom.leerArm9();
  const fila = (id) => d.tablaObjetos + id * 4;
  const narcIconos = h.leerNarc(rom.archivo(rom.id(ICONOS)));
  const dibujo = narcIconos.archivos[u16(arm9, fila(CARAMELO_RARO))].slice();
  const paleta = narcIconos.archivos[u16(arm9, fila(CARAMELO_RARO) + 2)];
  const trozo = (b, nombre) => {
    for (let i = 0x10; i + 8 <= b.length; i++) if (String.fromCharCode(...b.subarray(i, i + 4)) === nombre) return i;
    return -1;
  };
  const enDibujo = trozo(dibujo, "RAHC");
  const enPaleta = trozo(paleta, "TTLP");
  const pixeles = deHex(DIBUJO_MENTA_DS);
  if (enDibujo < 0 || enPaleta < 0 || dibujo.length < enDibujo + 0x20 + pixeles.length) return false;
  dibujo.set(pixeles, enDibujo + 0x20);
  const primerIcono = narcIconos.archivos.length;
  narcIconos.archivos.push(dibujo);
  for (const colores of PALETAS_MENTA) {
    const nueva = paleta.slice();
    nueva.set(deHex(colores), enPaleta + 0x18);
    narcIconos.archivos.push(nueva);
  }
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    poner16(arm9, fila(PRIMERA_MENTA_GEN5 + k), primerIcono);
    poner16(arm9, fila(PRIMERA_MENTA_GEN5 + k) + 2, primerIcono + 1 + colorDe(naturaleza));
  });
  ponerBolsillos(arm9);

  // El programa, en la ITCM, con las direcciones de este juego
  const codigo = new Uint8Array((deHex(CODIGO).length + 31) & ~31);
  codigo.set(deHex(CODIGO));
  const itcm = alargarItcm(arm9, codigo, ARM9);
  if (!itcm) return false;
  const base = itcm.direccion;
  const rellenar = {
    primeraMenta: PRIMERA_MENTA_GEN5, ultima: base + SITIOS.variable_ultima, naturalezas: base + SITIOS.tabla_naturalezas,
    GetParam: d.getParam | 1, SetNature: d.setNature | 1, comprobacion: d.comprobacion | 1, preparacion: d.preparacion | 1,
    aplicacion: d.aplicacion | 1, mensaje: d.mensaje | 1, primerMensaje
  };
  const nuevo = itcm.arm9;
  for (const [nombre, valor] of Object.entries(rellenar)) {
    if (SITIOS[`L_${nombre}`] === undefined) throw new Error(`Falta ${nombre} en el programa de las mentas.`);
    poner32(nuevo, itcm.enArm9 + SITIOS[`L_${nombre}`], valor >>> 0);
  }

  // Las tres llamadas del menú del equipo
  const ov = rom.leerOverlay(d.overlay);
  const enOverlay = baseOverlay(rom, d.overlay);
  ponerBL(ov, d.sitioComprobar, enOverlay, base + SITIOS.comprobar);
  ponerBL(ov, d.sitioPreparar, enOverlay, base + SITIOS.preparar);
  ponerBL(ov, d.sitioAplicar, enOverlay, base + SITIOS.aplicar);

  narcTextos.archivos[j.menu] = h.escribirTextos(narcTextos.archivos[j.menu], menu);
  narcTextos.archivos[j.nombres] = h.escribirTextos(narcTextos.archivos[j.nombres], nombres);
  narcTextos.archivos[j.descripciones] = h.escribirTextos(narcTextos.archivos[j.descripciones], descripciones);
  rom.escribirArm9(nuevo);
  rom.escribirOverlay(d.overlay, ov);
  rom.cambiar(rom.id(TEXTOS_SISTEMA), h.crearNarc(narcTextos));
  rom.cambiar(rom.id(DATOS), h.crearNarc(narcDatos));
  rom.cambiar(rom.id(ICONOS), h.crearNarc(narcIconos));
  rom.cambiados.add("mentas");
  rom.mentasYaPuestasGen5 = true;
  return true;
}
