// ---------- Las mentas en la 4.ª generación (Diamante, Perla, Platino, HeartGold, SoulSilver) ----------
//
// Como ./mentas-gba.js para los de DS: 21 objetos nuevos que cambian la naturaleza de un Pokémon del equipo. Van en
// los huecos sin usar del 113 al 133 (en los tres juegos apuntan a un objeto vacío con el dibujo de «?»):
//   · sus datos (copiados del Caramelo Raro, con su precio y sin efectos), su dibujo y paletas, al final de los
//     archivos de objetos (itemtool/itemdata/*_item_data.narc e item_icon.narc), y la tabla del ARM9 que dice qué
//     archivos usa cada objeto, apuntándolos;
//   · su nombre y descripción, y un mensaje por menta en el archivo de textos del menú del equipo (al final);
//   · el programa (./codigo-mentas-gen4.js, de herramientas/mentas-gen4.s), al final de la ITCM: se alarga el trozo
//     del ARM9 que se copia ahí al arrancar (lo de detrás se corre) y se cambian dos llamadas del menú del equipo.
//
// Las direcciones del juego se sacan del propio ARM9 leyendo el código por su forma (los tres juegos lo tienen casi
// igual, con otras direcciones y otros desplazamientos en las estructuras): ver direccionesMentasGen4.

import { CODIGO, SITIOS } from "./codigo-mentas-gen4.js";
import { DIBUJO_MENTA_DS, PALETAS_MENTA } from "./dibujos-mentas.js";

export const PRIMERA_MENTA_GEN4 = 113;
export const MENTAS_GEN4 = 21;

const RAM = 0x02000000;
const ITCM = 0x01ff8000;
const WURMPLE = 265;

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

// ---------- Leer el código (Thumb) ----------

// A dónde llama el «bl» que hay en «o» (dirección de la DS), o 0
function bl(a, o) {
  const alto = u16(a, o);
  const bajo = u16(a, o + 2);
  if ((alto & 0xf800) !== 0xf000 || (bajo & 0xf800) !== 0xf800) return 0;
  return (RAM + o + 4 + ((((alto & 0x7ff) << 21) >> 9) | ((bajo & 0x7ff) << 1))) >>> 0;
}

// Lo que carga un «ldr rX, [pc, #n]» en «o» ({ registro, valor }), o null
function literal(a, o) {
  const h = u16(a, o);
  if ((h & 0xf800) !== 0x4800) return null;
  const sitio = ((o + 4) & ~3) + (h & 0xff) * 4;
  return sitio + 4 <= a.length ? { registro: (h >> 8) & 7, valor: u32(a, sitio) } : null;
}

// El principio de la función en la que está «o»: el «push {..., lr}» de antes
function inicio(a, o) {
  for (let k = o & ~1; k >= 0 && o - k < 0x400; k -= 2) if ((u16(a, k) & 0xff00) === 0xb500) return k;
  return -1;
}

// Los sitios desde donde se llama a «destino» (dirección de la DS)
function llamadasA(a, destino) {
  const sitios = [];
  for (let o = 0; o + 4 <= a.length; o += 2) if (bl(a, o) === destino) sitios.push(o);
  return sitios;
}

// Las llamadas de una función ([{ sitio, destino }]), de «desde» a «hasta»
function llamadasEn(a, desde, hasta) {
  const lista = [];
  for (let o = desde; o < hasta; o += 2) {
    const d = bl(a, o);
    if (d) {
      lista.push({ sitio: o, destino: d });
      o += 2;
    }
  }
  return lista;
}

// ¿Hay en «o» esta serie de instrucciones? («BL» vale por un bl; «????» por cualquiera; «48??» por un ldr de un literal
// a cualquier registro...). Devuelve los sitios de cada una, o null
function encaja(a, o, patron) {
  const sitios = [];
  for (const parte of patron.split(" ")) {
    if (o + 2 > a.length) return null;
    sitios.push(o);
    if (parte === "BL") {
      if (!bl(a, o)) return null;
      o += 4;
      continue;
    }
    const h = u16(a, o).toString(16).padStart(4, "0");
    for (let k = 0; k < 4; k++) if (parte[k] !== "?" && parte[k] !== h[k]) return null;
    o += 2;
  }
  return sitios;
}

// Sigue una función instrucción a instrucción sabiendo lo justo de cada registro: { k } un número conocido, { campo }
// lo leído de app + campo (la app va en r4: «ldr rD, [r4, rM]» con rM conocido). Devuelve sus llamadas ([{ destino,
// args: [r0, r1, r2] }]); tras una llamada, r0-r3 no se saben
function simular(a, desde, hasta) {
  const r = Array.from({ length: 8 }, () => ({}));
  const llamadas = [];
  for (let o = desde; o < hasta; o += 2) {
    const h = u16(a, o);
    const destino = bl(a, o);
    if (destino) {
      llamadas.push({ destino, args: [r[0], r[1], r[2]] });
      for (let k = 0; k < 4; k++) r[k] = {};
      o += 2;
    } else if ((h & 0xf800) === 0x4800) r[(h >> 8) & 7] = { k: literal(a, o).valor };
    else if ((h & 0xf800) === 0x2000) r[(h >> 8) & 7] = { k: h & 0xff };
    else if ((h & 0xf800) === 0x0000 && r[(h >> 3) & 7].k !== undefined) r[h & 7] = { k: r[(h >> 3) & 7].k << ((h >> 6) & 31) };
    else if ((h & 0xfe00) === 0x1c00) r[h & 7] = r[(h >> 3) & 7].k !== undefined ? { k: r[(h >> 3) & 7].k + ((h >> 6) & 7) } : ((h >> 6) & 7) ? {} : r[(h >> 3) & 7];
    else if ((h & 0xf800) === 0x3000) r[(h >> 8) & 7] = r[(h >> 8) & 7].k !== undefined ? { k: r[(h >> 8) & 7].k + (h & 0xff) } : {};
    else if ((h & 0xfe00) === 0x5800 && ((h >> 3) & 7) === 4 && r[(h >> 6) & 7].k !== undefined) r[h & 7] = { campo: r[(h >> 6) & 7].k };
    // Lo demás que escribe en un registro bajo (los «str» no): se deja de saber
    else if ((h & 0xe000) === 0x0000 || (h & 0xfc00) === 0x4000 || (h & 0xfe00) === 0x5800 || (h & 0xfe00) >= 0x5600 && (h & 0xfe00) <= 0x5e00 && (h & 0xfe00) !== 0x5800) r[h & 7] = {};
    else if ((h & 0xf800) === 0x6800 || (h & 0xf800) === 0x7800 || (h & 0xf800) === 0x8800) r[h & 7] = {};
    else if ((h & 0xf800) === 0x9800 || (h & 0xf000) === 0xa000) r[(h >> 8) & 7] = {};
    else if ((h & 0xff00) === 0x4600) r[(h & 7) | ((h >> 4) & 8)] = {}; // mov rD, rM (con altos)
  }
  return llamadas;
}

function buscarEn(a, desde, hasta, patron) {
  for (let o = desde; o < hasta; o += 2) {
    const s = encaja(a, o, patron);
    if (s) return s;
  }
  return null;
}

// ---------- Las direcciones ----------
//
// Nombres del decomp de Platino (github.com/pret/pokeplatinum):
//   Pokemon_CheckItemEffects: «movs r1, #0xE (ITEM_PARAM_PARTY_USE); adds r4, r0, #0; bl Item_Get; cmp r0, #1» al
//     principio y, poco después, Pokemon_GetValue(mon, MON_DATA_STATUS, 0)
//   Party_CheckItemEffectsOnMember: la que la llama, cortita (saca el Pokémon del hueco y la llama)
//   ApplyItemEffectOnPokemon (el menú del equipo): la que llama a esa y mira ITEM_PARAM_PP_UP («movs r1, #0x22»)
// De ahí y de las funciones a las que llama sale lo demás. Devuelve null si algo no cuadra.
// (por qué no ha cuadrado, para depurar: el número del paso)
export let motivoMentasGen4 = 0;
const no = (paso) => {
  motivoMentasGen4 = paso;
  return null;
};

export function direccionesMentasGen4(a) {
  const d = {};
  // 1) Las tres de arriba
  for (let o = 0; o + 12 <= a.length && !d.aie; o += 2) {
    if (!encaja(a, o, "210e 1c04 BL 2801")) continue;
    const cie = inicio(a, o);
    if (cie < 0 || o - cie > 0x20) continue;
    for (const s of llamadasA(a, RAM + cie)) {
      const pcie = inicio(a, s);
      if (pcie < 0 || s - pcie > 0x16) continue;
      for (const s2 of llamadasA(a, RAM + pcie)) {
        const aie = inicio(a, s2);
        // (la del menú: mira Más PP, PP Máximos, Éter y Elixir seguidos, y dice «No tendrá ningún efecto»)
        if (aie < 0 || ["2122", "2123", "2124", "2125"].some((p) => !buscarEn(a, aie, aie + 0x100, p))) continue;
        if (!buscarEn(a, s2, aie + 0x200, "1c28 21?? 2201 BL")) continue;
        // (y su resultado se compara con 1: así no se confunde con NormalizeItemEffect, que empieza igual)
        if (u16(a, s2 + 4) !== 0x2801) continue;
        Object.assign(d, { cie, pcie, aie, sitioComprobar: s2 });
      }
    }
  }
  if (!d.aie) return no(1);

  // 2) En ApplyItemEffectOnPokemon: dónde está el menú (PartyMenu) en la app y el objeto en él, el hueco elegido, la
  // llamada a PartyMenu_SetItemUseCallback (sola: «adds r0, r5, #0; bl; b») y el «No tendrá ningún efecto»
  // (PartyMenu_PrintLongMessage(app, id, 1)), tras el que se pone el paso siguiente (y así, dónde va: el hueco - k)
  const fin = d.aie + 0x200;
  const primero = literal(a, d.aie + 4);
  if (!primero) return no(2);
  d.offPartyMenu = primero.valor;
  for (let o = d.aie; o < fin && d.offUsado === undefined; o += 2) {
    const h = u16(a, o);
    if ((h & 0xf800) === 0x8800) d.offUsado = ((h >> 6) & 31) * 2; // ldrh rX, [rY, #n]
  }
  for (let o = d.sitioComprobar - 2; o > d.sitioComprobar - 0x14; o -= 2) {
    const l = literal(a, o);
    if (l && l.registro === 2) d.offHueco = l.valor;
  }
  for (let o = d.sitioComprobar; o < fin && !d.sitioElegir; o += 2) {
    if (u16(a, o - 2) === 0x1c28 && bl(a, o) && (u16(a, o + 4) & 0xf800) === 0xe000) d.sitioElegir = o;
  }
  const noEfecto = buscarEn(a, d.sitioComprobar, fin, "1c28 21?? 2201 BL");
  if (!noEfecto || !d.sitioElegir || d.offHueco === undefined || d.offUsado === undefined) return no(3);
  d.PartyMenu_PrintLongMessage = bl(a, noEfecto[3]);
  const tras = encaja(a, noEfecto[3] + 4, "48?? 2107 54?? 49?? 38??");
  if (!tras) return no(4);
  d.PartyMenuCB_PrintThenWaitABPress = literal(a, tras[3]).valor;
  d.offCallback = d.offHueco - (u16(a, tras[4]) & 0xff);
  d.PartyMenu_SetItemUseCallback = bl(a, d.sitioElegir);

  // 3) Party_CheckItemEffectsOnMember: su primera llamada, Party_GetPokemonBySlotIndex. Pokemon_CheckItemEffects:
  // Pokemon_GetValue (la de «movs r1, #MON_DATA_STATUS; movs r2, #0») y, la primera, la que carga el objeto
  d.Party_CheckItemEffectsOnMember = RAM + d.pcie;
  d.Party_GetPokemonBySlotIndex = llamadasEn(a, d.pcie, d.pcie + 0x10)[0]?.destino;
  const estado = buscarEn(a, d.cie, d.cie + 0x40, "21?? 2200 BL");
  if (!estado || !d.Party_GetPokemonBySlotIndex) return no(5);
  d.status = u16(a, estado[0]) & 0xff;
  d.Pokemon_GetValue = bl(a, estado[2]);
  const cargar = llamadasEn(a, d.cie, d.cie + 0x20)[0];
  if (!cargar) return no(6);
  // Item_Load(objeto, tipo, heap): el máximo («ldr r0, =n» o «movs r0, #n; lsls r0, r0, #k») y la tabla de archivos
  // de cada objeto (datos, dibujo, paleta, gen 3)
  const ld = cargar.destino - RAM;
  const maximo = encaja(a, ld + 4, "20?? 0???");
  d.ultimoObjeto = maximo ? (u16(a, maximo[0]) & 0xff) << ((u16(a, maximo[1]) >> 6) & 31) : (literal(a, ld + 4) || {}).valor;
  for (let o = ld; o < ld + 0x30 && !d.tablaObjetos; o += 2) {
    const l = literal(a, o);
    if (l && l.valor >= RAM && l.valor - RAM < a.length) d.tablaObjetos = l.valor;
  }
  if (!d.tablaObjetos || !(d.ultimoObjeto >= 300 && d.ultimoObjeto <= 600)) return no(7);

  // 4) PartyMenu_SetItemUseCallback: los pasos que pone, por orden (Caramelo Raro, el «básico», restar EVs, PS); el
  // básico (PartyMenuCB_UseItem_Basic) da el sonido y la que prepara el mensaje (BufferUsedItemMessage)
  const elegir = d.PartyMenu_SetItemUseCallback - RAM;
  const pasos = [];
  for (let o = elegir; o < elegir + 0x90; o += 2) {
    const l = literal(a, o);
    if (l && l.valor >= RAM && l.valor - RAM < a.length) pasos.push(l.valor);
  }
  if (pasos.length < 2) return no(8);
  const basico = (pasos[1] & ~1) - RAM;
  const imprimir = buscarEn(a, basico, basico + 0xa0, "43c9 2201 BL 48?? BL");
  const preparar = buscarEn(a, basico, basico + 0xa0, "2200 8??? BL");
  if (!imprimir || !preparar || bl(a, imprimir[2]) !== d.PartyMenu_PrintLongMessage) return no(9);
  d.sonido = literal(a, imprimir[3]).valor;
  d.Sound_PlayEffect = bl(a, imprimir[4]);
  const buffer = bl(a, preparar[2]) - RAM;

  // 5) BufferUsedItemMessage (app en r4): las llamadas, con lo que lleva cada registro (ver simular). Por orden:
  // Party_GetPokemonBySlotIndex, Pokemon_GetBoxPokemon, StringTemplate_SetNickname(app->template, 0, ...) y, en el
  // primer caso del switch, MessageLoader_GetNewString(app->messageLoader, id), StringTemplate_Format(app->template,
  // app->tmpString, texto) y String_Free(texto)
  const llamadas = simular(a, buffer, buffer + 0x200);
  const apodo = llamadas.findIndex((c) => c.args[0].campo !== undefined && c.args[1].k === 0);
  const nuevo = llamadas.findIndex((c, i) => i > apodo && c.args[0].campo !== undefined && c.args[1].k !== undefined);
  const formar = llamadas[nuevo + 1];
  const soltar = llamadas[nuevo + 2];
  if (apodo !== 2 || nuevo < 0 || !formar || !soltar || formar.args[0].campo !== llamadas[apodo].args[0].campo) return no(10);
  d.Pokemon_GetBoxPokemon = llamadas[1].destino;
  d.StringTemplate_SetNickname = llamadas[apodo].destino;
  d.offPlantilla = llamadas[apodo].args[0].campo;
  d.MessageLoader_GetNewString = llamadas[nuevo].destino;
  d.offCargador = llamadas[nuevo].args[0].campo;
  d.StringTemplate_Format = formar.destino;
  d.offTexto = formar.args[1].campo;
  d.String_Free = soltar.destino;
  if (d.offTexto === undefined) return no(11);
  d.textoNoEfecto = u16(a, noEfecto[1]) & 0xff;

  // 6) Pokemon_CalcLevelAndStats: la única que al principio pone el nivel (MON_DATA_STATUS + 1) con Pokemon_SetValue
  // entre Pokemon_EnterDecryptionContext y Pokemon_ExitDecryptionContext (cinco llamadas seguidas)
  const nivel = 0x2100 | (d.status + 1);
  const calcular = [];
  for (let o = 0; o + 0x40 <= a.length && calcular.length < 2; o += 2) {
    if (u16(a, o) !== nivel) continue;
    const f = inicio(a, o);
    if (f < 0 || o - f > 0x20) continue;
    const llamadas = llamadasEn(a, f, f + 0x30);
    if (llamadas.length >= 5 && !calcular.some((c) => c.f === f)) calcular.push({ f, llamadas });
  }
  if (calcular.length !== 1) return no(12);
  d.Pokemon_CalcLevelAndStats = RAM + calcular[0].f;
  d.Pokemon_EnterDecryptionContext = calcular[0].llamadas[0].destino;
  d.Pokemon_ExitDecryptionContext = calcular[0].llamadas[4].destino;

  // Las funciones, con el bit de Thumb
  for (const [k, v] of Object.entries(d)) if (/^[A-Z]/.test(k) && k !== "PartyMenuCB_PrintThenWaitABPress") d[k] = (v | 1) >>> 0;
  return d;
}

// ---------- Textos ----------
//
// Por idioma (la última letra del código del juego: CPUS, Platino en español): las naturalezas como en el juego, el
// nombre de la menta, su descripción en la Bolsa y el mensaje al usarla ({V}, el mote del Pokémon)
export const NATURALEZAS = {
  S: "Fuerte Huraña Audaz Firme Pícara Osada Dócil Plácida Agitada Floja Miedosa Activa Seria Alegre Ingenua Modesta Afable Mansa Tímida Alocada Serena Amable Grosera Cauta Rara",
  E: "Hardy Lonely Brave Adamant Naughty Bold Docile Relaxed Impish Lax Timid Hasty Serious Jolly Naive Modest Mild Quiet Bashful Rash Calm Gentle Sassy Careful Quirky",
  F: "Hardi Solo Brave Rigide Mauvais Assuré Docile Relax Malin Lâche Timide Pressé Sérieux Jovial Naïf Modeste Doux Discret Pudique Foufou Calme Gentil Malpoli Prudent Bizarre",
  D: "Robust Solo Mutig Hart Frech Kühn Sanft Locker Pfiffig Lasch Scheu Hastig Ernst Froh Naiv Mäßig Mild Ruhig Zaghaft Hitzig Still Zart Forsch Sacht Kauzig",
  I: "Ardita Schiva Audace Decisa Birbona Sicura Docile Placida Scaltra Fiacca Timida Lesta Seria Allegra Ingenua Modesta Mite Quieta Ritrosa Ardente Calma Gentile Vivace Cauta Furba"
};
export const TEXTOS = {
  S: { nombre: (n) => `Menta ${n}`, descripcion: (n) => `Su aroma cambia la naturaleza de\nun Pokémon a ${n}.`, mensaje: (n) => `¡{V} tiene ahora\nla naturaleza ${n}!` },
  E: { nombre: (n) => `${n} Mint`, descripcion: (n) => `Its scent changes a Pokémon's\nnature to ${n}.`, mensaje: (n) => `{V}'s nature\nbecame ${n}!` },
  F: { nombre: (n) => `Menthe ${n}`, descripcion: (n) => `Son parfum change le naturel\nd'un Pokémon en ${n}.`, mensaje: (n) => `{V} a maintenant\nle naturel ${n} !` },
  D: { nombre: (n) => `${n}-Minze`, descripcion: (n) => `Ihr Duft ändert das Wesen\neines Pokémon zu ${n}.`, mensaje: (n) => `{V}s Wesen ist\njetzt ${n}!` },
  I: { nombre: (n) => `Menta ${n}`, descripcion: (n) => `Il suo aroma cambia la natura\ndi un Pokémon in ${n}.`, mensaje: (n) => `La natura di {V}\nora è ${n}!` }
};
// La naturaleza de cada menta, en el orden de la web (como en herramientas/mentas-gen4.s)
export const NATURALEZA_MENTA = [1, 3, 4, 2, 5, 8, 9, 7, 15, 16, 19, 17, 20, 21, 23, 22, 10, 11, 13, 14, 12];
// Su color (./dibujos-mentas.js): por la estadística que sube (la naturaleza / 5); la Seria, aparte
export const colorDe = (naturaleza) => (naturaleza % 6 === 0 ? 5 : [0, 1, 4, 2, 3][Math.floor(naturaleza / 5)]);

// El archivo de textos del menú del equipo de cada juego (el mismo en todos los idiomas)
const BANCO_MENU = { dp: 402, pt: 453, hgss: 300 };
const CARAMELO_RARO = 50;
export const PRECIO_MENTA_GEN4 = 20000;

// ---------- Ponerlas ----------

const deHex = (texto) => Uint8Array.from(texto.match(/../g).map((x) => parseInt(x, 16)));

// Los parámetros del arranque del ARM9 (justo antes de la marca 0xDEC00621, 0x2106C0DE): dónde están la lista de lo
// que se copia al arrancar (y su final) y de dónde se copia. base: dónde se carga el ARM9 (en la 5.ª generación,
// 0x02004000)
function parametros(a, base) {
  for (let i = 0x1c; i + 8 <= a.length; i += 4) {
    if (u32(a, i) === 0xdec00621 && u32(a, i + 4) === 0x2106c0de) {
      const p = i - 0x1c;
      return { p, lista: u32(a, p) - base, listaFin: u32(a, p + 4) - base, fuente: u32(a, p + 8) - base };
    }
  }
  return null;
}

// Alarga el trozo del ARM9 que se copia a la ITCM al arrancar con «codigo» (lo de detrás se corre). Devuelve el ARM9
// nuevo, dónde queda el código en la ITCM y dónde dentro del ARM9. (En la 5.ª generación cada fila de esa lista mide 16
// bytes y no 12, pero el tamaño va en el mismo sitio)
export function alargarItcm(a, codigo, base = RAM) {
  const m = parametros(a, base);
  if (!m || u32(a, m.lista) !== ITCM) return null; // la ITCM, la primera de la lista
  const tam = u32(a, m.lista + 4);
  const punto = m.fuente + tam;
  if (punto > m.lista || tam + codigo.length > 0x8000) return null;
  const nuevo = new Uint8Array(a.length + codigo.length);
  nuevo.set(a.subarray(0, punto));
  nuevo.set(codigo, punto);
  nuevo.set(a.subarray(punto), punto + codigo.length);
  poner32(nuevo, m.lista + codigo.length + 4, tam + codigo.length);
  poner32(nuevo, m.p, m.lista + codigo.length + base);
  poner32(nuevo, m.p + 4, m.listaFin + codigo.length + base);
  return { arm9: nuevo, direccion: ITCM + tam, enArm9: punto };
}

// Un «bl» en «sitio» (del ARM9) que llama a «destino»
function ponerBL(a, sitio, destino) {
  const salto = destino - (RAM + sitio + 4);
  if (salto < -0x400000 || salto >= 0x400000) throw new Error("El salto a las mentas no llega.");
  poner16(a, sitio, 0xf000 | ((salto >> 12) & 0x7ff));
  poner16(a, sitio + 2, 0xf800 | ((salto >> 1) & 0x7ff));
}

// ¿Ya las tiene? (la fila de la primera menta en la tabla de archivos de objetos ya no es la del objeto vacío)
function yaPuestas(a, d) {
  const t = d.tablaObjetos - RAM;
  return u16(a, t + PRIMERA_MENTA_GEN4 * 8) !== u16(a, t) || u16(a, t + PRIMERA_MENTA_GEN4 * 8 + 2) !== u16(a, t + 2);
}

// ¿Tiene ya la ROM las mentas? (su programa está en el ARM9: el principio de «comprobar», que no cambia de un juego a
// otro. Con ellas puestas, las direcciones ya no se pueden sacar: una de las llamadas del menú va a ese programa)
export function mentasYaPuestasGen4(rom) {
  if (rom.mentasYaPuestasGen4 === undefined) {
    const a = rom.leerArm9();
    const firma = deHex(CODIGO).subarray(SITIOS.comprobar, SITIOS.comprobar + 20);
    let esta = false;
    for (let o = 0; o + firma.length <= a.length && !esta; o += 2) {
      if (a[o] !== firma[0]) continue;
      let k = 1;
      while (k < firma.length && a[o + k] === firma[k]) k++;
      esta = k === firma.length;
    }
    rom.mentasYaPuestasGen4 = esta;
  }
  return rom.mentasYaPuestasGen4;
}

// Las direcciones del juego (guardadas en la ROM), o null si esta versión no es como las conocidas
export function mentasPosiblesGen4(rom) {
  if (rom.direccionesMentasGen4 === undefined) {
    try {
      rom.direccionesMentasGen4 = direccionesMentasGen4(rom.leerArm9());
    } catch (error) {
      rom.direccionesMentasGen4 = null;
    }
  }
  return rom.direccionesMentasGen4;
}

// Pone las 21 mentas. tipo: «dp», «pt» o «hgss»; rutas: { datos (item_data), textos (msg) }; bancos: los de los
// nombres y las descripciones de los objetos. h: leerNarc, crearNarc, leerTextos4, escribirTextos4 y aCodigos (los
// de ./rom-nds.js y ./textos-gen4.js, que los pasa ./juego-gen4.js). Devuelve false si no se pueden poner aquí.
export function ponerMentasGen4(rom, { tipo, rutas, bancos, precio = PRECIO_MENTA_GEN4 }, h) {
  if (mentasYaPuestasGen4(rom)) return true;
  const d = mentasPosiblesGen4(rom);
  if (!d || !BANCO_MENU[tipo]) return false;
  const arm9 = rom.leerArm9();
  if (yaPuestas(arm9, d)) return true;
  const idioma = TEXTOS[rom.codigo[3]] ? rom.codigo[3] : "E";
  const textos = TEXTOS[idioma];
  const naturalezas = NATURALEZAS[idioma].split(" ");
  const fila = (id) => d.tablaObjetos - RAM + id * 8;

  // Los textos: nombres, descripciones y, al final del archivo del menú, un mensaje por menta (con el mote como lo
  // pone el juego en sus mensajes: lo copia de «se ha curado del envenenamiento»)
  const narcTextos = h.leerNarc(rom.archivo(rom.id(rutas.textos)));
  const menu = h.leerTextos4(narcTextos.archivos[BANCO_MENU[tipo]]).entradas;
  const modelo = menu[0x41] || "";
  if (modelo.charCodeAt(0) !== 0xfffe) return false;
  const mote = modelo.slice(0, 3 + modelo.charCodeAt(2));
  const primerMensaje = menu.length;
  const nombres = h.leerTextos4(narcTextos.archivos[bancos.nombres]).entradas;
  const descripciones = h.leerTextos4(narcTextos.archivos[bancos.descripciones]).entradas;
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    const n = naturalezas[naturaleza];
    nombres[PRIMERA_MENTA_GEN4 + k] = h.aCodigos(textos.nombre(n));
    descripciones[PRIMERA_MENTA_GEN4 + k] = h.aCodigos(textos.descripcion(n));
    menu.push(textos.mensaje(n).split("{V}").map(h.aCodigos).join(mote));
  });
  narcTextos.archivos[BANCO_MENU[tipo]] = h.escribirTextos4(narcTextos.archivos[BANCO_MENU[tipo]], menu);
  narcTextos.archivos[bancos.nombres] = h.escribirTextos4(narcTextos.archivos[bancos.nombres], nombres);
  narcTextos.archivos[bancos.descripciones] = h.escribirTextos4(narcTextos.archivos[bancos.descripciones], descripciones);

  // Los datos: como los del Caramelo Raro (se usan en el equipo desde la Bolsa), con su precio y sin efectos (lo hace el
  // programa); la naturaleza, en el dato del objeto
  const narcDatos = h.leerNarc(rom.archivo(rom.id(rutas.datos)));
  const caramelo = narcDatos.archivos[u16(arm9, fila(CARAMELO_RARO))];
  if (!caramelo || caramelo.length < 14) return false;
  const primerDato = narcDatos.archivos.length;
  for (const naturaleza of NATURALEZA_MENTA) {
    const dato = caramelo.slice();
    poner16(dato, 0, precio);
    dato[3] = naturaleza;
    dato.fill(0, 14);
    narcDatos.archivos.push(dato);
  }

  // El dibujo (uno) y las paletas (una por color), como los del Caramelo Raro
  const rutaIconos = rutas.datos.replace(/[^/]*item_data\.narc$/, "item_icon.narc").replace(/^a\/0\/1\/7$/, "a/0/1/8");
  const narcIconos = h.leerNarc(rom.archivo(rom.id(rutaIconos)));
  const dibujo = narcIconos.archivos[u16(arm9, fila(CARAMELO_RARO) + 2)].slice();
  const paleta = narcIconos.archivos[u16(arm9, fila(CARAMELO_RARO) + 4)];
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

  // El programa, en la ITCM, con las direcciones de este juego
  const codigo = new Uint8Array((deHex(CODIGO).length + 31) & ~31);
  codigo.set(deHex(CODIGO));
  const itcm = alargarItcm(arm9, codigo);
  if (!itcm) return false;
  const base = itcm.direccion;
  const rellenar = {
    Party_GetPokemonBySlotIndex: d.Party_GetPokemonBySlotIndex, Party_CheckItemEffectsOnMember: d.Party_CheckItemEffectsOnMember,
    PartyMenu_SetItemUseCallback: d.PartyMenu_SetItemUseCallback, Pokemon_CalcLevelAndStats: d.Pokemon_CalcLevelAndStats,
    Pokemon_GetBoxPokemon: d.Pokemon_GetBoxPokemon, StringTemplate_SetNickname: d.StringTemplate_SetNickname,
    MessageLoader_GetNewString: d.MessageLoader_GetNewString, StringTemplate_Format: d.StringTemplate_Format, String_Free: d.String_Free,
    PartyMenu_PrintLongMessage: d.PartyMenu_PrintLongMessage, Sound_PlayEffect: d.Sound_PlayEffect,
    PartyMenuCB_PrintThenWaitABPress: d.PartyMenuCB_PrintThenWaitABPress, Pokemon_GetValue: d.Pokemon_GetValue,
    Pokemon_EnterDecryptionContext: d.Pokemon_EnterDecryptionContext, Pokemon_ExitDecryptionContext: d.Pokemon_ExitDecryptionContext,
    app_callback: d.offCallback, app_partyMenu: d.offPartyMenu, app_slot: d.offHueco, app_template: d.offPlantilla,
    app_messageLoader: d.offCargador, app_tmpString: d.offTexto, pm_usedItemID: d.offUsado, primerMensaje,
    sonido: d.sonido, usar: (base + SITIOS.usar) | 1, naturalezas: base + SITIOS.tabla_naturalezas, orden: base + SITIOS.tabla_orden,
    wurmple: WURMPLE
  };
  const nuevo = itcm.arm9;
  for (const [nombre, valor] of Object.entries(rellenar)) {
    if (SITIOS[`L_${nombre}`] === undefined || valor === undefined) throw new Error(`Falta ${nombre} en el programa de las mentas.`);
    poner32(nuevo, itcm.enArm9 + SITIOS[`L_${nombre}`], valor >>> 0);
  }
  ponerBL(nuevo, d.sitioComprobar, base + SITIOS.comprobar);
  ponerBL(nuevo, d.sitioElegir, base + SITIOS.elegir);
  // Cada menta, a sus datos, su dibujo y su paleta
  NATURALEZA_MENTA.forEach((naturaleza, k) => {
    const f = fila(PRIMERA_MENTA_GEN4 + k);
    poner16(nuevo, f, primerDato + k);
    poner16(nuevo, f + 2, primerIcono);
    poner16(nuevo, f + 4, primerIcono + 1 + colorDe(naturaleza));
    poner16(nuevo, f + 6, 0);
  });

  rom.escribirArm9(nuevo);
  rom.cambiar(rom.id(rutas.textos), h.crearNarc(narcTextos));
  rom.cambiar(rom.id(rutas.datos), h.crearNarc(narcDatos));
  rom.cambiar(rom.id(rutaIconos), h.crearNarc(narcIconos));
  rom.cambiados.add("mentas");
  rom.mentasYaPuestasGen4 = true;
  return true;
}
