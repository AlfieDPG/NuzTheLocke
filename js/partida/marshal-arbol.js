// ---------- Marshal de Ruby, para leer y volver a escribir ----------
//
// ./marshal.js lee una partida de Essentials (GS Vitro) para enseñarla. Para editarla hace falta
// más: guardar de vuelta todo lo que había, igual que lo dejó el juego. Aquí cada valor es un
// «nodo» que recuerda cómo venía escrito, y escribirNodos lo vuelve a dejar byte a byte igual
// (lo que no se haya tocado).
//
// Nodos:
//   { t: "nil" | "true" | "false" }, { t: "int", v }, { t: "sym", v }
//   { t: "str", bytes }                 texto (bytes tal cual)
//   { t: "arr", items: [nodo] }
//   { t: "hash", pares: [[nodo, nodo]], defecto?: nodo }
//   { t: "float", texto }, { t: "big", signo: "+" | "-", bytes }
//   { t: "obj", clase, iv: [[nombre, nodo]] }        objetos («@species»...)
//   { t: "user", clase, bytes }                       guardados con _dump (Table, Color...)
//   { t: "umarshal", clase, datos: nodo }             guardados con marshal_dump
//   { t: "struct", clase, campos: [[nombre, nodo]] }
//   { t: "class" | "module", bytes }, { t: "regex", bytes, opciones }
// Además, cualquiera puede llevar:
//   extra: [[nombre, nodo]]   las variables de «I» (la codificación de un texto: ["E", true])
//   extiende: [módulo]         «e»
//   claseUsuario: nombre       «C» (una subclase de String, Array o Hash)
//
// Si un mismo nodo sale dos veces, se escribe la segunda como enlace («@»), como hace Ruby.

const latin = new TextDecoder("latin1");
const latinBytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

// Los nodos sin identidad propia (no se enlazan con «@»)
const INMEDIATOS = new Set(["nil", "true", "false", "int", "sym"]);

export function leerNodos(b) {
  const nodos = [];
  let p = 0;
  while (p < b.length) {
    const { nodo, fin } = leerUno(b, p);
    nodos.push(nodo);
    p = fin;
  }
  return nodos;
}

function leerUno(b, desde) {
  let p = desde;
  const simbolos = [];
  const objetos = [];

  const entero = () => {
    const c = (b[p++] << 24) >> 24;
    if (c === 0) return 0;
    if (c >= 5) return c - 5;
    if (c <= -5) return c + 5;
    let x = 0;
    if (c > 0) {
      for (let i = 0; i < c; i++) x += b[p++] * 2 ** (8 * i);
      return x;
    }
    for (let i = 0; i < -c; i++) x += b[p++] * 2 ** (8 * i);
    return x - 2 ** (8 * -c);
  };
  const bytes = () => {
    const n = entero();
    const trozo = b.slice(p, p + n);
    p += n;
    return trozo;
  };
  const simbolo = () => {
    const tipo = b[p++];
    if (tipo === 0x3a) {
      const s = latin.decode(bytes());
      simbolos.push(s);
      return s;
    }
    if (tipo === 0x3b) return simbolos[entero()];
    throw new Error(`Marshal: se esperaba un símbolo en ${p - 1}`);
  };
  const variables = () => {
    const n = entero();
    const lista = [];
    for (let i = 0; i < n; i++) {
      const nombre = simbolo();
      lista.push([nombre, leer()]);
    }
    return lista;
  };
  const registrar = (nodo) => {
    objetos.push(nodo);
    return nodo;
  };

  function leer() {
    const tipo = String.fromCharCode(b[p++]);
    switch (tipo) {
      case "0": return { t: "nil" };
      case "T": return { t: "true" };
      case "F": return { t: "false" };
      case "i": return { t: "int", v: entero() };
      case ":": p--; return { t: "sym", v: simbolo() };
      case ";": p--; return { t: "sym", v: simbolo() };
      case "@": {
        const nodo = objetos[entero()];
        if (!nodo) throw new Error("Marshal: enlace a un objeto que no existe");
        return nodo;
      }
      case "I": {
        const nodo = leer();
        nodo.extra = variables();
        return nodo;
      }
      case "e": {
        const modulo = simbolo();
        const nodo = leer();
        nodo.extiende = [modulo, ...(nodo.extiende || [])];
        return nodo;
      }
      case "C": {
        const clase = simbolo();
        const nodo = leer();
        nodo.claseUsuario = clase;
        return nodo;
      }
      case '"': {
        const nodo = registrar({ t: "str" });
        nodo.bytes = bytes();
        return nodo;
      }
      case "[": {
        const nodo = registrar({ t: "arr", items: [] });
        const n = entero();
        for (let i = 0; i < n; i++) nodo.items.push(leer());
        return nodo;
      }
      case "{":
      case "}": {
        const nodo = registrar({ t: "hash", pares: [] });
        const n = entero();
        for (let i = 0; i < n; i++) {
          const clave = leer();
          nodo.pares.push([clave, leer()]);
        }
        if (tipo === "}") nodo.defecto = leer();
        return nodo;
      }
      case "f": {
        const nodo = registrar({ t: "float" });
        nodo.texto = bytes();
        return nodo;
      }
      case "l": {
        const nodo = registrar({ t: "big", signo: String.fromCharCode(b[p++]) });
        const n = entero() * 2;
        nodo.bytes = b.slice(p, p + n);
        p += n;
        return nodo;
      }
      case "o": {
        const nodo = registrar({ t: "obj" });
        nodo.clase = simbolo();
        nodo.iv = variables();
        return nodo;
      }
      case "u": {
        const clase = simbolo();
        return registrar({ t: "user", clase, bytes: bytes() });
      }
      case "U": {
        const nodo = registrar({ t: "umarshal" });
        nodo.clase = simbolo();
        nodo.datos = leer();
        return nodo;
      }
      case "S": {
        const nodo = registrar({ t: "struct" });
        nodo.clase = simbolo();
        nodo.campos = variables();
        return nodo;
      }
      case "c":
      case "m": {
        return registrar({ t: tipo === "c" ? "class" : "module", bytes: bytes() });
      }
      case "/": {
        const nodo = registrar({ t: "regex" });
        nodo.bytes = bytes();
        nodo.opciones = b[p++];
        return nodo;
      }
      default:
        throw new Error(`Marshal: tipo «${tipo}» desconocido en ${p - 1}`);
    }
  }

  if (b[p] !== 4 || b[p + 1] !== 8) throw new Error("No es Marshal 4.8");
  p += 2;
  const nodo = leer();
  return { nodo, fin: p };
}

// ---------- Escribir ----------

class Salida {
  constructor() {
    this.trozos = [];
    this.largo = 0;
    this.simbolos = new Map();
    this.objetos = new Map();
  }
  byte(x) {
    this.trozos.push(Uint8Array.of(x & 0xff));
    this.largo++;
  }
  bytesSueltos(arr) {
    this.trozos.push(arr);
    this.largo += arr.length;
  }
  entero(n) {
    if (n === 0) return this.byte(0);
    if (n > 0 && n < 123) return this.byte(n + 5);
    if (n < 0 && n > -124) return this.byte(n - 5);
    const salida = [];
    let x = n;
    for (let i = 0; i < 4; i++) {
      salida.push(((x % 256) + 256) % 256);
      x = Math.floor(x / 256);
      if ((n >= 0 && x === 0) || (n < 0 && x === -1)) break;
    }
    this.byte(n >= 0 ? salida.length : -salida.length);
    for (const v of salida) this.byte(v);
  }
  conLargo(arr) {
    this.entero(arr.length);
    this.bytesSueltos(arr);
  }
  simbolo(nombre) {
    if (this.simbolos.has(nombre)) {
      this.byte(0x3b);
      this.entero(this.simbolos.get(nombre));
      return;
    }
    this.simbolos.set(nombre, this.simbolos.size);
    this.byte(0x3a);
    this.conLargo(latinBytes(nombre));
  }
  resultado() {
    const salida = new Uint8Array(this.largo);
    let p = 0;
    for (const trozo of this.trozos) {
      salida.set(trozo, p);
      p += trozo.length;
    }
    return salida;
  }
}

function escribirUno(s, nodo) {
  if (INMEDIATOS.has(nodo.t)) {
    if (nodo.t === "nil") s.byte(0x30);
    else if (nodo.t === "true") s.byte(0x54);
    else if (nodo.t === "false") s.byte(0x46);
    else if (nodo.t === "int") {
      // Los que no caben en 31 bits con signo, Ruby los guarda como bignum
      if (nodo.v >= 2 ** 30 || nodo.v < -(2 ** 30)) return escribirUno(s, enteroGrande(nodo.v));
      s.byte(0x69);
      s.entero(nodo.v);
    } else s.simbolo(nodo.v);
    return;
  }
  if (s.objetos.has(nodo)) {
    s.byte(0x40);
    s.entero(s.objetos.get(nodo));
    return;
  }
  if (nodo.extra) s.byte(0x49);
  for (const modulo of nodo.extiende || []) {
    s.byte(0x65);
    s.simbolo(modulo);
  }
  if (nodo.claseUsuario) {
    s.byte(0x43);
    s.simbolo(nodo.claseUsuario);
  }
  s.objetos.set(nodo, s.objetos.size);
  const variables = (lista) => {
    s.entero(lista.length);
    for (const [nombre, valor] of lista) {
      s.simbolo(nombre);
      escribirUno(s, valor);
    }
  };
  switch (nodo.t) {
    case "str": s.byte(0x22); s.conLargo(nodo.bytes); break;
    case "arr":
      s.byte(0x5b);
      s.entero(nodo.items.length);
      for (const item of nodo.items) escribirUno(s, item);
      break;
    case "hash":
      s.byte(nodo.defecto ? 0x7d : 0x7b);
      s.entero(nodo.pares.length);
      for (const [clave, valor] of nodo.pares) {
        escribirUno(s, clave);
        escribirUno(s, valor);
      }
      if (nodo.defecto) escribirUno(s, nodo.defecto);
      break;
    case "float": s.byte(0x66); s.conLargo(nodo.texto); break;
    case "big":
      s.byte(0x6c);
      s.byte(nodo.signo.charCodeAt(0));
      s.entero(nodo.bytes.length / 2);
      s.bytesSueltos(nodo.bytes);
      break;
    case "obj": s.byte(0x6f); s.simbolo(nodo.clase); variables(nodo.iv); break;
    case "user": s.byte(0x75); s.simbolo(nodo.clase); s.conLargo(nodo.bytes); break;
    case "umarshal": s.byte(0x55); s.simbolo(nodo.clase); escribirUno(s, nodo.datos); break;
    case "struct": s.byte(0x53); s.simbolo(nodo.clase); variables(nodo.campos); break;
    case "class": s.byte(0x63); s.conLargo(nodo.bytes); break;
    case "module": s.byte(0x6d); s.conLargo(nodo.bytes); break;
    case "regex": s.byte(0x2f); s.conLargo(nodo.bytes); s.byte(nodo.opciones); break;
    default: throw new Error(`Marshal: no sé escribir «${nodo.t}»`);
  }
  if (nodo.extra) variables(nodo.extra);
}

// Un entero que no cabe en un Fixnum, como lo guarda Ruby (bignum, en trozos de 16 bits)
function enteroGrande(v) {
  let x = Math.abs(v);
  const bytes = [];
  while (x > 0) {
    bytes.push(x % 256);
    x = Math.floor(x / 256);
  }
  if (bytes.length % 2) bytes.push(0);
  return { t: "big", signo: v < 0 ? "-" : "+", bytes: Uint8Array.from(bytes) };
}

// Cada nodo, con su «04 08» delante, uno detrás de otro (como los Marshal.dump seguidos del juego)
export function escribirNodos(nodos) {
  const partes = nodos.map((nodo) => {
    const s = new Salida();
    s.byte(4);
    s.byte(8);
    escribirUno(s, nodo);
    return s.resultado();
  });
  const total = new Uint8Array(partes.reduce((suma, parte) => suma + parte.length, 0));
  let p = 0;
  for (const parte of partes) {
    total.set(parte, p);
    p += parte.length;
  }
  return total;
}

// ---------- Ayudas para tocar nodos ----------

// Una variable de un objeto («@species»), o undefined
export function variable(nodo, nombre) {
  const par = nodo && nodo.iv && nodo.iv.find(([n]) => n === nombre);
  return par ? par[1] : undefined;
}

// Pone una variable (la añade al final si no estaba)
export function ponerVariable(nodo, nombre, valor) {
  const par = nodo.iv.find(([n]) => n === nombre);
  if (par) par[1] = valor;
  else nodo.iv.push([nombre, valor]);
}

// Un nodo -> valor de JavaScript sencillo (enteros, textos, true/false/null; lo demás, tal cual)
export function valorDe(nodo) {
  if (!nodo) return undefined;
  switch (nodo.t) {
    case "nil": return null;
    case "true": return true;
    case "false": return false;
    case "int": return nodo.v;
    case "sym": return nodo.v;
    case "str": return new TextDecoder(esLatin(nodo) ? "latin1" : "utf-8").decode(nodo.bytes);
    case "float": return parseFloat(latin.decode(nodo.texto));
    case "big": {
      let x = 0;
      for (let i = nodo.bytes.length - 1; i >= 0; i--) x = x * 256 + nodo.bytes[i];
      return nodo.signo === "-" ? -x : x;
    }
    default: return nodo;
  }
}

function esLatin(nodo) {
  const e = nodo.extra && nodo.extra.find(([n]) => n === "E");
  return Boolean(e && e[1].t === "false");
}

// Nodos nuevos
export const nodoEntero = (v) => ({ t: "int", v });
export const nodoBool = (v) => ({ t: v ? "true" : "false" });
export const nodoNil = () => ({ t: "nil" });
// Un texto en UTF-8, como los guarda el juego (sin la marca de codificación de Ruby 1.9+: en
// Ruby 1.8, que es el del juego, los textos no la llevan)
export const nodoTexto = (texto) => ({ t: "str", bytes: new TextEncoder().encode(texto) });

// Copia profunda de un nodo (los enlaces internos se mantienen dentro de la copia)
export function copiarNodo(nodo, vistos = new Map()) {
  if (!nodo || typeof nodo !== "object") return nodo;
  if (INMEDIATOS.has(nodo.t)) return { ...nodo };
  if (vistos.has(nodo)) return vistos.get(nodo);
  const copia = { ...nodo };
  vistos.set(nodo, copia);
  const lista = (l) => l.map(([n, v]) => [n, copiarNodo(v, vistos)]);
  if (nodo.items) copia.items = nodo.items.map((item) => copiarNodo(item, vistos));
  if (nodo.pares) copia.pares = nodo.pares.map(([k, v]) => [copiarNodo(k, vistos), copiarNodo(v, vistos)]);
  if (nodo.iv) copia.iv = lista(nodo.iv);
  if (nodo.campos) copia.campos = lista(nodo.campos);
  if (nodo.extra) copia.extra = lista(nodo.extra);
  if (nodo.datos) copia.datos = copiarNodo(nodo.datos, vistos);
  if (nodo.defecto) copia.defecto = copiarNodo(nodo.defecto, vistos);
  if (nodo.bytes) copia.bytes = nodo.bytes.slice();
  if (nodo.texto) copia.texto = nodo.texto.slice();
  return copia;
}
