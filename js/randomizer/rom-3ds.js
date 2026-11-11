import { descomprimirBLZ } from "./blz.js";
// ---------- Juegos de 3DS (.3ds ya descifrados) ----------
//
// Un .3ds es de 2 a 4 GB: no se carga entero. Se lee por trozos (un «lector» con leer(desde, cuantos))
// y solo se sacan los archivos que hacen falta. Dentro hay una partición NCCH (la primera) con
//   - el ExeFS (el programa: code.bin...) y
//   - el RomFS (los datos: GARC con los Pokémon, los entrenadores, los textos...).
// Lo que se cambia no se vuelve a meter en el .3ds: sale como archivos sueltos (LayeredFS) para
// ponerlos en la carpeta de mods del emulador o de la consola.

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u64 = (b, i) => u32(b, i) + u32(b, i + 4) * 4294967296;
const texto = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n)).replace(/\0+$/, "");

// Un lector de un File del navegador
export function lectorDeArchivo(archivo) {
  return {
    tam: archivo.size,
    leer: async (desde, cuantos) => new Uint8Array(await archivo.slice(desde, desde + cuantos).arrayBuffer()),
    // Un trozo sin leerlo (para los archivos grandes del .zip)
    blob: (desde, fin) => archivo.slice(desde, fin)
  };
}

export class Rom3DS {
  constructor(lector) {
    this.lector = lector;
  }

  // Lee la cabecera, el ExeFS y el árbol de archivos del RomFS
  async abrir() {
    const { lector } = this;
    const cab = await lector.leer(0, 0x200);
    if (texto(cab, 0x100, 4) !== "NCSD") throw new Error("No es un .3ds");
    this.ncch = u32(cab, 0x120) * 0x200; // dónde empieza la primera partición (la del juego)
    const c = await lector.leer(this.ncch, 0x200);
    if (texto(c, 0x100, 4) !== "NCCH") throw new Error("Partición sin NCCH");
    if (!(c[0x188 + 7] & 4)) throw new Error("Este .3ds está cifrado: hace falta descifrado");
    this.codigo = texto(c, 0x150, 16); // «CTR-P-ECRA»
    this.idTitulo = Array.from(c.subarray(0x108, 0x110)).reverse().map((x) => x.toString(16).padStart(2, "0")).join("");
    this.exefs = { desde: this.ncch + u32(c, 0x1a0) * 0x200, tam: u32(c, 0x1a4) * 0x200 };
    this.romfs = { desde: this.ncch + u32(c, 0x1b0) * 0x200, tam: u32(c, 0x1b4) * 0x200 };
    await this.leerRomfs();
    return this;
  }

  async leerRomfs() {
    const { lector } = this;
    const base = this.romfs.desde;
    const ivfc = await lector.leer(base, 0x60);
    if (texto(ivfc, 0, 4) !== "IVFC") throw new Error("RomFS sin IVFC");
    // La cabecera del nivel 3 empieza tras la del IVFC, alineada a 0x1000
    const nivel3 = base + Math.ceil((0x60 + u32(ivfc, 8)) / 0x1000) * 0x1000;
    const h = await lector.leer(nivel3, 0x28);
    const dirTabla = { desde: u32(h, 0x0c), tam: u32(h, 0x10) };
    const arcTabla = { desde: u32(h, 0x1c), tam: u32(h, 0x20) };
    const datos = u32(h, 0x24);
    this.baseRomfs = base;
    this.nivel3 = nivel3;
    this.datosRomfs = nivel3 + datos;
    this.finNivel3 = nivel3 + u64(await lector.leer(base + 0x44, 8), 0); // el tamaño del nivel 3, en la cabecera IVFC
    const dirs = await lector.leer(nivel3 + dirTabla.desde, dirTabla.tam);
    const archs = await lector.leer(nivel3 + arcTabla.desde, arcTabla.tam);
    const nombreU16 = (b, i, n) => {
      let s = "";
      for (let k = 0; k < n; k += 2) s += String.fromCharCode(u16(b, i + k));
      return s;
    };
    // Las rutas de las carpetas (cada una conoce a su padre)
    const rutas = new Map();
    const rutaDir = (i) => {
      if (rutas.has(i)) return rutas.get(i);
      const padre = u32(dirs, i);
      const largo = u32(dirs, i + 0x14);
      const nombre = nombreU16(dirs, i + 0x18, largo);
      const r = i === 0 ? "" : (rutaDir(padre) ? rutaDir(padre) + "/" : "") + nombre;
      rutas.set(i, r);
      return r;
    };
    this.archivos = new Map();
    for (let i = 0; i < archs.length; ) {
      const padre = u32(archs, i);
      const desde = u64(archs, i + 0x08);
      const tam = u64(archs, i + 0x10);
      const largo = u32(archs, i + 0x1c);
      const nombre = nombreU16(archs, i + 0x20, largo);
      const dir = rutaDir(padre);
      this.archivos.set(dir ? dir + "/" + nombre : nombre, { desde: this.datosRomfs + desde, tam, meta: nivel3 + arcTabla.desde + i });
      i += 0x20 + Math.ceil(largo / 4) * 4;
    }
  }

  // Un archivo del RomFS entero («a/1/9/5»)
  async archivo(ruta) {
    const a = this.archivos.get(ruta);
    if (!a) throw new Error("No está en el RomFS: " + ruta);
    return this.lector.leer(a.desde, a.tam);
  }

  // El programa (.code), ya descomprimido (en X, Y, Rubí Omega y Zafiro Alfa viene comprimido)
  async leerCodigo() {
    const lista = await this.listaExefs();
    const c = lista[".code"];
    const bytes = await this.lector.leer(c.desde, c.tam);
    const exheader = await this.lector.leer(this.ncch + 0x200, 0x10);
    return exheader[0x0d] & 1 ? descomprimirBLZ(bytes) : bytes;
  }

  // Los archivos del ExeFS: { nombre: { desde, tam } }
  async listaExefs() {
    const h = await this.lector.leer(this.exefs.desde, 0x200);
    const lista = {};
    for (let i = 0; i < 10; i++) {
      const nombre = texto(h, i * 16, 8);
      if (nombre) lista[nombre] = { desde: this.exefs.desde + 0x200 + u32(h, i * 16 + 8), tam: u32(h, i * 16 + 12) };
    }
    return lista;
  }
}

// ---------- GARC (los paquetes de archivos de los juegos de 3DS) ----------

// Devuelve { version, archivos: [Uint8Array] } (los subarchivos; si hay varios en una entrada, el primero)
export function leerGarc(b) {
  if (texto(b, 0, 4) !== "CRAG") throw new Error("No es un GARC");
  const version = u16(b, 0x0a);
  const datos = u32(b, 0x10);
  let p = u32(b, 4); // tras la cabecera
  const fato = p;
  if (texto(b, fato, 4) !== "OTAF") throw new Error("GARC sin FATO");
  const cuantos = u16(b, fato + 8);
  p = fato + u32(b, fato + 4);
  const fatb = p;
  if (texto(b, fatb, 4) !== "BTAF") throw new Error("GARC sin FATB");
  p = fatb + 12;
  const entradas = [];
  for (let i = 0; i < cuantos; i++) {
    const bits = u32(b, p);
    p += 4;
    const subs = [];
    for (let k = 0; k < 32; k++) {
      if (!(bits & (1 << k))) continue;
      subs.push({ desde: datos + u32(b, p), fin: datos + u32(b, p + 4), largo: u32(b, p + 8) });
      p += 12;
    }
    entradas.push(subs);
  }
  return { version, entradas, archivos: entradas.map((s) => b.subarray(s[0].desde, s[0].desde + s[0].largo)) };
}

// ---------- LZ11 (los archivos comprimidos de algunos GARC: salvajes, textos...) ----------

export function descomprimirLZ11(b) {
  if (b[0] !== 0x11) throw new Error("No es LZ11 (" + b[0] + ")");
  let tam = b[1] | (b[2] << 8) | (b[3] << 16);
  let p = 4;
  if (tam === 0) {
    tam = u32(b, 4);
    p = 8;
  }
  const s = new Uint8Array(tam);
  let q = 0;
  while (q < tam && p < b.length) {
    const flags = b[p++];
    for (let k = 7; k >= 0 && q < tam; k--) {
      if (!(flags & (1 << k))) {
        s[q++] = b[p++];
        continue;
      }
      const b0 = b[p++];
      let largo;
      let desp;
      const tipo = b0 >> 4;
      if (tipo === 0) {
        const b1 = b[p++];
        const b2 = b[p++];
        largo = (((b0 & 0xf) << 4) | (b1 >> 4)) + 0x11;
        desp = (((b1 & 0xf) << 8) | b2) + 1;
      } else if (tipo === 1) {
        const b1 = b[p++];
        const b2 = b[p++];
        const b3 = b[p++];
        largo = (((b0 & 0xf) << 12) | (b1 << 4) | (b2 >> 4)) + 0x111;
        desp = (((b2 & 0xf) << 8) | b3) + 1;
      } else {
        const b1 = b[p++];
        largo = tipo + 1;
        desp = (((b0 & 0xf) << 8) | b1) + 1;
      }
      for (let i = 0; i < largo && q < tam; i++, q++) s[q] = s[q - desp];
    }
  }
  return s;
}

// Comprime de verdad: el juego reserva poca memoria para estos archivos y, sin comprimir (más del doble de grandes en las
// zonas), se puede colgar al cargar algunas. Como en los archivos del juego, nunca copia desde 1 byte atrás
const LZ11_DESP_MIN = 2;
const LZ11_DESP_MAX = 0x1000;
const LZ11_LARGO_MIN = 3;
const LZ11_LARGO_MAX = 0x10110;
const LZ11_VUELTAS = 512; // cuántos candidatos mira como mucho en cada posición

export function comprimirLZ11(b) {
  const n = b.length;
  const s = new Uint8Array(8 + n + Math.ceil(n / 8) + 8);
  s[0] = 0x11;
  let p = 4;
  if (n < 0x1000000) {
    s[1] = n & 0xff;
    s[2] = (n >> 8) & 0xff;
    s[3] = (n >> 16) & 0xff;
  } else {
    poner32(s, 4, n);
    p = 8;
  }
  // Las posiciones anteriores con los mismos tres primeros bytes
  const cabezas = new Int32Array(0x8000).fill(-1);
  const previos = new Int32Array(n);
  const clave = (i) => ((b[i] << 10) ^ (b[i + 1] << 5) ^ b[i + 2]) & 0x7fff;
  const apuntar = (i) => {
    if (i + 2 >= n) return;
    const h = clave(i);
    previos[i] = cabezas[h];
    cabezas[h] = i;
  };
  let i = 0;
  while (i < n) {
    const banderas = p++;
    let bits = 0;
    for (let k = 7; k >= 0 && i < n; k--) {
      let largo = 0;
      let desp = 0;
      if (i + 2 < n) {
        const tope = Math.min(LZ11_LARGO_MAX, n - i);
        let c = cabezas[clave(i)];
        for (let vueltas = LZ11_VUELTAS; c >= 0 && i - c <= LZ11_DESP_MAX && vueltas > 0 && largo < tope; vueltas--, c = previos[c]) {
          if (i - c < LZ11_DESP_MIN) continue;
          let l = 0;
          while (l < tope && b[c + l] === b[i + l]) l++;
          if (l > largo) {
            largo = l;
            desp = i - c;
          }
        }
      }
      if (largo < LZ11_LARGO_MIN) {
        apuntar(i);
        s[p++] = b[i++];
        continue;
      }
      bits |= 1 << k;
      const d = desp - 1;
      if (largo <= 0x10) {
        s[p++] = ((largo - 1) << 4) | (d >> 8);
      } else if (largo <= 0x110) {
        const l = largo - 0x11;
        s[p++] = l >> 4;
        s[p++] = ((l & 0xf) << 4) | (d >> 8);
      } else {
        const l = largo - 0x111;
        s[p++] = 0x10 | (l >> 12);
        s[p++] = (l >> 4) & 0xff;
        s[p++] = ((l & 0xf) << 4) | (d >> 8);
      }
      s[p++] = d & 0xff;
      for (let q = 0; q < largo; q++) apuntar(i + q);
      i += largo;
    }
    s[banderas] = bits;
  }
  return s.subarray(0, p);
}

// A cuántos bytes va alineado cada archivo de un GARC: en la versión 6 (Sol y Luna), lo dice su cabecera (en 0x20: casi
// siempre 4, pero 128 en algunos, como el de las zonas: si no se respeta, el juego se queda colgado al cargar el mapa);
// en la 4, a 4
function alineacionGarc(b) {
  return (u16(b, 0x0a) >= 0x0600 && u32(b, 0x20)) || 4;
}

// Un GARC nuevo a partir del original, con otros archivos (nuevos[i] sustituye al primer subarchivo de la
// entrada i; el resto de entradas y subarchivos se quedan; un i de más, una entrada nueva al final: los iconos de las
// mentas, ./mentas-xy.js). Cada archivo, alineado como diga el GARC (alineacionGarc).
export function crearGarc(b, nuevos) {
  const g = leerGarc(b);
  const fato = u32(b, 4);
  const fatb = fato + u32(b, fato + 4);
  const fimb = fatb + u32(b, fatb + 4);
  const original = g.entradas.length;
  const extra = Object.keys(nuevos).map(Number).filter((i) => i >= original);
  const cuantos = extra.length ? Math.max(...extra) + 1 : original;
  if (extra.some((i) => !nuevos[i]) || (extra.length && extra.length !== cuantos - original)) throw new Error("Las entradas nuevas del GARC tienen que ir seguidas.");
  // Los archivos de cada entrada, ya con los cambios (y los bits de qué subarchivos tiene)
  const lista = [];
  const bitsDe = [];
  let q = fatb + 12;
  g.entradas.forEach((subs, i) => {
    bitsDe.push(u32(b, q));
    q += 4 + subs.length * 12;
    lista.push(subs.map((x, k) => (k === 0 && nuevos[i] ? nuevos[i] : b.subarray(x.desde, x.desde + x.largo))));
  });
  for (let i = original; i < cuantos; i++) {
    bitsDe.push(1);
    lista.push([nuevos[i]]);
  }
  const alinear = alineacionGarc(b);
  let datos = 0;
  let mayor = 0;
  const posiciones = lista.map((subs) =>
    subs.map((x) => {
      const p = { desde: datos, fin: datos + Math.ceil(x.length / alinear) * alinear, largo: x.length }; // (el fin, con el relleno, como en los del juego)
      datos += Math.ceil(x.length / alinear) * alinear;
      mayor = Math.max(mayor, Math.ceil(x.length / alinear) * alinear);
      return p;
    })
  );
  const tamFato = 12 + cuantos * 4;
  const tamFatb = 12 + lista.reduce((t, subs) => t + 4 + subs.length * 12, 0);
  const nuevoFatb = fato + tamFato;
  const nuevoFimb = nuevoFatb + tamFatb;
  const dataOffset = nuevoFimb + 12;
  const total = dataOffset + datos;
  const s = new Uint8Array(total);
  s.fill(0xff, dataOffset); // el relleno entre archivos, como en los del juego
  s.set(b.subarray(0, fato)); // la cabecera
  poner32(s, 0x10, dataOffset);
  poner32(s, 0x14, total);
  // El archivo más grande: en la versión 4, sin relleno; en la 6, con relleno (y en 0x1c, sin él)
  const mayorSinRelleno = Math.max(0, ...lista.flat().map((x) => x.length));
  if (u16(b, 0x0a) >= 0x0600) {
    poner32(s, 0x18, mayor);
    poner32(s, 0x1c, mayorSinRelleno);
  } else poner32(s, 0x18, mayorSinRelleno);
  // FATO: dónde empieza cada entrada (dentro del FATB)
  s.set(b.subarray(fato, fato + 12), fato);
  poner32(s, fato + 4, tamFato);
  poner16(s, fato + 8, cuantos);
  let rel = 0;
  lista.forEach((subs, i) => {
    poner32(s, fato + 12 + i * 4, rel);
    rel += 4 + subs.length * 12;
  });
  // FATB
  s.set(b.subarray(fatb, fatb + 4), nuevoFatb);
  poner32(s, nuevoFatb + 4, tamFatb);
  poner32(s, nuevoFatb + 8, cuantos);
  let p = nuevoFatb + 12;
  lista.forEach((subs, i) => {
    poner32(s, p, bitsDe[i]);
    p += 4;
    posiciones[i].forEach((pos) => {
      poner32(s, p, pos.desde);
      poner32(s, p + 4, pos.fin);
      poner32(s, p + 8, pos.largo);
      p += 12;
    });
  });
  // FIMB
  s.set(b.subarray(fimb, fimb + 4), nuevoFimb);
  poner32(s, nuevoFimb + 4, 12);
  poner32(s, nuevoFimb + 8, datos);
  lista.forEach((subs, i) =>
    subs.forEach((x, k) => {
      s.set(x, dataOffset + posiciones[i][k].desde);
    })
  );
  return s;
}

function poner16(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >> 8) & 0xff;
}
function poner32(b, i, v) {
  poner16(b, i, v & 0xffff);
  poner16(b, i + 2, (v >>> 16) & 0xffff);
}

// ---------- «Mini» (paquetes pequeños: «WD», «BL»...): u16 marca, u16 cuántos, u32 desde[cuántos + 1] ----------
export function leerMini(b) {
  const n = u16(b, 2);
  return Array.from({ length: n }, (_, i) => b.subarray(u32(b, 4 + i * 4), u32(b, 8 + i * 4)));
}

export function crearMini(b, nuevos) {
  const n = u16(b, 2);
  const partes = leerMini(b).map((x, i) => nuevos[i] || x);
  const cabeza = 4 + (n + 1) * 4;
  let pos = Math.ceil(cabeza / 4) * 4;
  const salida = [];
  const desde = [];
  for (const x of partes) {
    desde.push(pos);
    salida.push([pos, x]);
    pos = Math.ceil((pos + x.length) / 4) * 4;
  }
  desde.push(pos);
  const s = new Uint8Array(pos);
  s.set(b.subarray(0, 4));
  desde.forEach((d, i) => poner32(s, 4 + i * 4, d));
  for (const [d, x] of salida) s.set(x, d);
  return s;
}

// ---------- Zip (sin comprimir) ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
// El CRC por trozos: empieza con 0xffffffff, sigue con cada trozo y se cierra con acabarCrc
const seguirCrc = (c, b) => {
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return c;
};
const acabarCrc = (c) => (c ^ 0xffffffff) >>> 0;
const crc32 = (b) => acabarCrc(seguirCrc(0xffffffff, b));

// archivos: [[ruta, Uint8Array]] -> un .zip (Uint8Array)
export function crearZip(archivos) {
  const partes = [];
  const central = [];
  let pos = 0;
  const hoy = new Date();
  const hora = (hoy.getHours() << 11) | (hoy.getMinutes() << 5) | (hoy.getSeconds() >> 1);
  const fecha = ((hoy.getFullYear() - 1980) << 9) | ((hoy.getMonth() + 1) << 5) | hoy.getDate();
  for (const [ruta, datos] of archivos) {
    const nombre = new TextEncoder().encode(ruta);
    const crc = crc32(datos);
    const l = new Uint8Array(30 + nombre.length);
    poner32(l, 0, 0x04034b50);
    poner16(l, 4, 20);
    poner16(l, 6, 0x0800);
    poner16(l, 10, hora);
    poner16(l, 12, fecha);
    poner32(l, 14, crc);
    poner32(l, 18, datos.length);
    poner32(l, 22, datos.length);
    poner16(l, 26, nombre.length);
    l.set(nombre, 30);
    const c = new Uint8Array(46 + nombre.length);
    poner32(c, 0, 0x02014b50);
    poner16(c, 4, 20);
    poner16(c, 6, 20);
    poner16(c, 8, 0x0800);
    poner16(c, 12, hora);
    poner16(c, 14, fecha);
    poner32(c, 16, crc);
    poner32(c, 20, datos.length);
    poner32(c, 24, datos.length);
    poner16(c, 28, nombre.length);
    poner32(c, 42, pos);
    c.set(nombre, 46);
    partes.push(l, datos);
    central.push(c);
    pos += l.length + datos.length;
  }
  const tamCentral = central.reduce((t, x) => t + x.length, 0);
  const fin = new Uint8Array(22);
  poner32(fin, 0, 0x06054b50);
  poner16(fin, 8, archivos.length);
  poner16(fin, 10, archivos.length);
  poner32(fin, 12, tamCentral);
  poner32(fin, 16, pos);
  const total = pos + tamCentral + 22;
  const s = new Uint8Array(total);
  let p = 0;
  for (const x of [...partes, ...central, fin]) {
    s.set(x, p);
    p += x.length;
  }
  return s;
}

// Un parche IPS con lo que cambia entre dos versiones de un archivo (del mismo tamaño)
export function crearIPS(a, b) {
  const trozos = [];
  let i = 0;
  while (i < a.length) {
    if (a[i] === b[i]) {
      i++;
      continue;
    }
    let desde = i;
    let fin = i + 1;
    // Lo que cambia con menos de 8 bytes de por medio, junto
    for (let j = i + 1; j < a.length && j - fin < 8; j++) if (a[j] !== b[j]) fin = j + 1;
    i = fin;
    // Que no empiece justo donde estaría «EOF»
    if (desde === 0x454f46) desde--;
    while (desde < fin) {
      const largo = Math.min(0xffff, fin - desde);
      trozos.push([desde, b.subarray(desde, desde + largo)]);
      desde += largo;
    }
  }
  const total = 5 + trozos.reduce((t, [, x]) => t + 5 + x.length, 0) + 3;
  const s = new Uint8Array(total);
  s.set([0x50, 0x41, 0x54, 0x43, 0x48]);
  let p = 5;
  for (const [desde, x] of trozos) {
    s[p++] = (desde >> 16) & 0xff;
    s[p++] = (desde >> 8) & 0xff;
    s[p++] = desde & 0xff;
    s[p++] = (x.length >> 8) & 0xff;
    s[p++] = x.length & 0xff;
    s.set(x, p);
    p += x.length;
  }
  s.set([0x45, 0x4f, 0x46], p);
  return s;
}

// ---------- GARC grandes (que no caben en memoria): solo se leen y se cambian unas pocas entradas ----------

// La cabecera y las entradas que se piden (quiere(i)) de un GARC de «tam» bytes que empieza en «desde»
export async function leerGarcParcial(lector, desde, tam, quiere) {
  const ini = await lector.leer(desde, 0x40);
  const dataOffset = u32(ini, 0x10);
  const cab = await lector.leer(desde, dataOffset);
  const g = leerGarc(cab);
  const archivos = [];
  for (let i = 0; i < g.entradas.length; i++) {
    if (!quiere(i)) continue;
    const s = g.entradas[i][0];
    archivos[i] = await lector.leer(desde + s.desde, s.largo);
  }
  return { cab, desde, tam, dataOffset, entradas: g.entradas, archivos, version: g.version };
}

// El plan de un GARC nuevo a partir de uno parcial: la cabecera nueva y, entrada por entrada, o bien lo
// nuevo (bytes) o bien un trozo del archivo original (rango). nuevos: { i: Uint8Array }
export function planGarc(p, nuevos) {
  const b = p.cab;
  const fato = u32(b, 4);
  const cuantos = u16(b, fato + 8);
  const fatb = fato + u32(b, fato + 4);
  const subsPorEntrada = p.entradas.map((subs) => subs.length);
  const alinear = alineacionGarc(b);
  const partes = [];
  let datos = 0;
  let mayor = 0;
  let mayorSinRelleno = 0;
  const posiciones = p.entradas.map((subs, i) =>
    subs.map((s, k) => {
      const nuevo = k === 0 && nuevos[i];
      const largo = nuevo ? nuevo.length : s.largo;
      const pos = { desde: datos, fin: datos + Math.ceil(largo / alinear) * alinear, largo }; // (el fin, con el relleno, como en los del juego)
      partes.push(nuevo ? { bytes: nuevo } : { rango: { desde: p.desde + s.desde, tam: s.largo } });
      const relleno = Math.ceil(largo / alinear) * alinear - largo;
      if (relleno) partes.push({ bytes: new Uint8Array(relleno).fill(0xff) }); // (relleno con 0xFF, como en los del juego)
      datos += largo + relleno;
      mayor = Math.max(mayor, largo + relleno);
      mayorSinRelleno = Math.max(mayorSinRelleno, largo);
      return pos;
    })
  );
  const tamEntradas = subsPorEntrada.reduce((t, n) => t + 4 + n * 12, 0);
  const nuevoTamFatb = 12 + tamEntradas;
  const dataOffset = fatb + nuevoTamFatb + 12;
  const total = dataOffset + datos;
  const s = new Uint8Array(dataOffset);
  s.set(b.subarray(0, fatb + 12));
  poner32(s, 0x10, dataOffset);
  poner32(s, 0x14, total);
  // El archivo más grande: en la versión 4, sin relleno; en la 6, con relleno (y en 0x1c, sin él)
  if (p.version >= 0x0600) {
    poner32(s, 0x18, mayor);
    poner32(s, 0x1c, mayorSinRelleno);
  } else poner32(s, 0x18, mayorSinRelleno);
  let rel = 0;
  subsPorEntrada.forEach((n, i) => {
    poner32(s, fato + 12 + i * 4, rel);
    rel += 4 + n * 12;
  });
  s.set(b.subarray(fatb, fatb + 8), fatb);
  poner32(s, fatb + 4, nuevoTamFatb);
  poner32(s, fatb + 8, cuantos);
  let q = fatb + 12;
  let qo = fatb + 12;
  subsPorEntrada.forEach((n, i) => {
    poner32(s, q, u32(b, qo));
    qo += 4 + n * 12;
    q += 4;
    posiciones[i].forEach((pos) => {
      poner32(s, q, pos.desde);
      poner32(s, q + 4, pos.fin);
      poner32(s, q + 8, pos.largo);
      q += 12;
    });
  });
  // La cabecera del FIMB (la última de la cabecera)
  const fimb = fatb + nuevoTamFatb;
  s.set([0x42, 0x4d, 0x49, 0x46], fimb); // «BMIF»
  poner32(s, fimb + 4, 12);
  poner32(s, fimb + 8, datos);
  return { cabecera: s, partes, tam: total };
}

// ---------- Lo que ve randomizar.js: archivos del RomFS ya leídos, y los que cambian ----------
export class Sesion3DS {
  constructor(rom) {
    this.rom = rom;
    this.es3DS = true;
    this.cache = new Map();
    this.cambios = new Map(); // ruta -> Uint8Array
    this.parciales = new Map(); // ruta -> GARC parcial
    this.grandes = new Map(); // ruta -> plan de un GARC nuevo (cabecera y partes)
    this.titulo = rom.codigo;
    this.codigo = rom.codigo;
  }

  // Lee de antemano los archivos que se van a necesitar (el randomizador es síncrono)
  async cargar(rutas) {
    for (const r of rutas) if (!this.cache.has(r)) this.cache.set(r, await this.rom.archivo(r));
  }

  // Lo mismo, pero de un GARC grande solo las entradas que se piden
  async cargarParcial(ruta, quiere) {
    const a = this.rom.archivos.get(ruta);
    if (!a) throw new Error("No está en el RomFS: " + ruta);
    this.parciales.set(ruta, await leerGarcParcial(this.rom.lector, a.desde, a.tam, quiere));
  }

  parcial(ruta) {
    return this.parciales.get(ruta);
  }

  // El programa (.code) descomprimido, para cambiarlo: sale como un parche IPS (exefs/code.ips)
  async cargarCodigo() {
    this.codigoOriginal = await this.rom.leerCodigo();
    this.code = this.codigoOriginal.slice();
  }

  archivo(ruta) {
    const a = this.cambios.get(ruta) || this.cache.get(ruta);
    if (!a) throw new Error("No cargado: " + ruta);
    return a.slice();
  }

  cambiar(ruta, bytes) {
    this.cambios.set(ruta, bytes);
  }

  cambiarParcial(ruta, nuevos) {
    if (Object.keys(nuevos).length) this.grandes.set(ruta, planGarc(this.parcial(ruta), nuevos));
  }

  get cambiados() {
    return new Set([...this.cambios.keys(), ...this.grandes.keys()]);
  }

  // El .3ds nuevo, como partes (Uint8Array o trozos del original): { partes, tam }
  async construirRom() {
    return construirRom3DS(this);
  }

  // ¿Ha cambiado el programa?
  get codigoCambiado() {
    return Boolean(this.code && this.code.some((v, i) => v !== this.codigoOriginal[i]));
  }

  // Un .zip con la carpeta de mods (LayeredFS) para el emulador o la consola. Es un Blob: los archivos
  // grandes se componen con trozos del original, sin cargarlos.
  async empaquetar() {
    // La carpeta del título (el emulador usa la del juego base también con la actualización; en una consola con
    // la actualización puesta, la carpeta se llama 0004000E... en vez de 00040000...)
    const ids = [this.rom.idTitulo.toUpperCase()];
    const archivos = [];
    for (const id of ids) {
      for (const [ruta, bytes] of this.cambios) archivos.push({ ruta: `${id}/romfs/${ruta}`, partes: [{ bytes }], tam: bytes.length });
      for (const [ruta, plan] of this.grandes) archivos.push({ ruta: `${id}/romfs/${ruta}`, partes: [{ bytes: plan.cabecera }, ...plan.partes], tam: plan.tam });
      if (this.code && this.code.some((v, i) => v !== this.codigoOriginal[i])) {
        const ips = crearIPS(this.codigoOriginal, this.code);
        archivos.push({ ruta: `${id}/exefs/code.ips`, partes: [{ bytes: ips }], tam: ips.length });
      }
    }
    return crearZipPorPartes(archivos, this.rom.lector);
  }
}

// Un .zip (Blob) de archivos hechos de partes: { bytes } o { rango: { desde, tam } } del .3ds
async function crearZipPorPartes(archivos, lector) {
  const hoy = new Date();
  const hora = (hoy.getHours() << 11) | (hoy.getMinutes() << 5) | (hoy.getSeconds() >> 1);
  const fecha = ((hoy.getFullYear() - 1980) << 9) | ((hoy.getMonth() + 1) << 5) | hoy.getDate();
  const salida = [];
  const central = [];
  let pos = 0;
  const cacheCrc = new Map(); // los mismos archivos, para el otro título, no se calculan dos veces
  for (const a of archivos) {
    const nombre = new TextEncoder().encode(a.ruta);
    const clave = a.ruta.split("/").slice(1).join("/");
    let crc = cacheCrc.get(clave);
    if (crc === undefined) {
      let c = 0xffffffff;
      for (const p of a.partes) {
        if (p.bytes) c = seguirCrc(c, p.bytes);
        else {
          // De trozo en trozo (8 MB)
          for (let d = 0; d < p.rango.tam; d += 8 << 20) c = seguirCrc(c, await lector.leer(p.rango.desde + d, Math.min(8 << 20, p.rango.tam - d)));
        }
      }
      crc = acabarCrc(c);
      cacheCrc.set(clave, crc);
    }
    const l = new Uint8Array(30 + nombre.length);
    poner32(l, 0, 0x04034b50);
    poner16(l, 4, 20);
    poner16(l, 6, 0x0800);
    poner16(l, 10, hora);
    poner16(l, 12, fecha);
    poner32(l, 14, crc);
    poner32(l, 18, a.tam);
    poner32(l, 22, a.tam);
    poner16(l, 26, nombre.length);
    l.set(nombre, 30);
    const c = new Uint8Array(46 + nombre.length);
    poner32(c, 0, 0x02014b50);
    poner16(c, 4, 20);
    poner16(c, 6, 20);
    poner16(c, 8, 0x0800);
    poner16(c, 12, hora);
    poner16(c, 14, fecha);
    poner32(c, 16, crc);
    poner32(c, 20, a.tam);
    poner32(c, 24, a.tam);
    poner16(c, 28, nombre.length);
    poner32(c, 42, pos);
    c.set(nombre, 46);
    salida.push(l);
    for (const p of a.partes) {
      if (p.bytes) salida.push(p.bytes);
      else salida.push(lector.blob ? lector.blob(p.rango.desde, p.rango.desde + p.rango.tam) : await lector.leer(p.rango.desde, p.rango.tam));
    }
    central.push(c);
    pos += l.length + a.tam;
  }
  const tamCentral = central.reduce((t, x) => t + x.length, 0);
  const fin = new Uint8Array(22);
  poner32(fin, 0, 0x06054b50);
  poner16(fin, 8, archivos.length);
  poner16(fin, 10, archivos.length);
  poner32(fin, 12, tamCentral);
  poner32(fin, 16, pos);
  return new Blob([...salida, ...central, fin], { type: "application/zip" });
}
// ---------- Un .3ds nuevo ----------
//
// Se parte del original: lo que no cambia se queda donde estaba (son trozos del archivo, sin leerlos);
// los archivos del RomFS que han cambiado se ponen detrás del último y su entrada en la tabla apunta
// a ellos; si el programa ha cambiado, un ExeFS nuevo (con el .code ya descomprimido) va al final.
// Se quitan las demás particiones (manual, actualización...) y los hashes (el emulador no los mira).
export async function construirRom3DS(sesion) {
  const rom = sesion.rom;
  const lector = rom.lector;
  const alinear = (n, a) => Math.ceil(n / a) * a;
  const parches = []; // [posición en el .3ds, bytes]
  const p16 = (pos, v) => parches.push([pos, Uint8Array.of(v & 0xff, (v >> 8) & 0xff)]);
  const p32 = (pos, v) => parches.push([pos, Uint8Array.of(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff)]);
  const p64 = (pos, v) => {
    p32(pos, v % 4294967296);
    p32(pos + 4, Math.floor(v / 4294967296));
  };

  // Los archivos del RomFS que cambian
  const nuevos = [];
  for (const [ruta, bytes] of sesion.cambios) nuevos.push({ ruta, partes: [bytes], tam: bytes.length });
  for (const [ruta, plan] of sesion.grandes) {
    nuevos.push({ ruta, partes: [plan.cabecera, ...plan.partes.map((x) => x.bytes || { rango: x.rango })], tam: plan.tam });
  }
  const salida = []; // trozos: Uint8Array o { rango: { desde, tam } } del original
  let cursor = rom.finNivel3 - rom.datosRomfs; // dónde acaban los datos, desde el inicio de los datos del RomFS
  const extra = [];
  for (const n of nuevos) {
    const a = rom.archivos.get(n.ruta);
    if (!a) throw new Error("No está en el RomFS: " + n.ruta);
    const rel = alinear(cursor, 16);
    if (rel > cursor) extra.push(new Uint8Array(rel - cursor));
    p64(a.meta + 8, rel);
    p64(a.meta + 0x10, n.tam);
    extra.push(...n.partes);
    cursor = rel + n.tam;
  }
  const tamNivel3 = rom.datosRomfs - rom.nivel3 + cursor;
  p64(rom.baseRomfs + 0x44, tamNivel3);
  const finRomfs = rom.nivel3 + tamNivel3;
  const tamRomfs = alinear(finRomfs - rom.romfs.desde, 0x200);
  const finArchivo = rom.romfs.desde + tamRomfs;
  let total = finArchivo;

  // El ExeFS nuevo, si el programa ha cambiado
  let exefs = null;
  if (sesion.codigoCambiado) {
    const lista = await rom.listaExefs();
    const archivos = [[".code", sesion.code]];
    for (const nombre of Object.keys(lista)) if (nombre !== ".code") archivos.push([nombre, await lector.leer(lista[nombre].desde, lista[nombre].tam)]);
    const cabeza = new Uint8Array(0x200);
    let pos = 0;
    archivos.forEach(([nombre, datos], i) => {
      cabeza.set(new TextEncoder().encode(nombre).subarray(0, 8), i * 16);
      cabeza[i * 16 + 8] = pos & 0xff;
      cabeza[i * 16 + 9] = (pos >> 8) & 0xff;
      cabeza[i * 16 + 10] = (pos >> 16) & 0xff;
      cabeza[i * 16 + 11] = (pos >>> 24) & 0xff;
      cabeza[i * 16 + 12] = datos.length & 0xff;
      cabeza[i * 16 + 13] = (datos.length >> 8) & 0xff;
      cabeza[i * 16 + 14] = (datos.length >> 16) & 0xff;
      cabeza[i * 16 + 15] = (datos.length >>> 24) & 0xff;
      pos += alinear(datos.length, 0x200);
    });
    exefs = [cabeza, ...archivos.flatMap(([, datos]) => [datos, new Uint8Array(alinear(datos.length, 0x200) - datos.length)])];
    const tamExefs = 0x200 + pos;
    p32(rom.ncch + 0x1a0, (total - rom.ncch) / 0x200);
    p32(rom.ncch + 0x1a4, tamExefs / 0x200);
    // El programa ya no va comprimido
    parches.push([rom.ncch + 0x200 + 0x0d, Uint8Array.of((await lector.leer(rom.ncch + 0x200 + 0x0d, 1))[0] & ~1)]);
    total += tamExefs;
  }
  p32(rom.ncch + 0x104, (total - rom.ncch) / 0x200);
  p32(rom.ncch + 0x1b4, tamRomfs / 0x200);
  // La cabecera del .3ds: tamaño de la imagen y de la primera partición; las demás, fuera
  p32(0x104, total / 0x200);
  p32(0x124, (total - rom.ncch) / 0x200);
  for (let i = 1; i < 8; i++) {
    p32(0x120 + i * 8, 0);
    p32(0x124 + i * 8, 0);
  }

  // El original con los parches, hasta el final de los datos del RomFS
  parches.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  const original = (desde, fin) => {
    if (fin > desde) salida.push({ rango: { desde, tam: fin - desde } });
  };
  for (const [donde, bytes] of parches) {
    original(pos, donde);
    salida.push(bytes);
    pos = donde + bytes.length;
  }
  original(pos, rom.finNivel3);
  salida.push(...extra);
  if (finArchivo > finRomfs) salida.push(new Uint8Array(finArchivo - finRomfs));
  if (exefs) salida.push(...exefs);
  return { partes: salida, tam: total };
}