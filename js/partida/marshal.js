// ---------- Marshal de Ruby (formato 4.8) ----------
//
// Las partidas de los juegos hechos con Pokémon Essentials (GS Vitro: ./vitro.js) son objetos de
// Ruby guardados con Marshal.dump, uno detrás de otro. Esto los lee tal cual, sin saber nada del
// juego. Solo lee: no hace falta escribir.
//
// Cómo sale cada cosa:
//   nil, true, false, enteros y decimales -> null, true, false, number
//   textos -> string (sin codificación dicha, como UTF-8: Ruby 1.8 los guarda así)
//   símbolos -> { simbolo: "nombre" }
//   listas -> Array; tablas (Hash) -> Map
//   objetos -> { clase: "PokeBattle_Pokemon", "@species": 25, ... } (las variables, con su @)
//   los que se guardan a su manera (_dump, como Time) -> { clase, bytes }
// Si un objeto sale varias veces, es el mismo (como en Ruby).

const texto = new TextDecoder("utf-8");
const latin = new TextDecoder("latin1");

// Lee el valor que empieza en «desde». Devuelve { valor, fin }
export function leerMarshal(b, desde = 0) {
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
    const trozo = b.subarray(p, p + n);
    p += n;
    return trozo;
  };
  const simbolo = () => {
    const tipo = String.fromCharCode(b[p++]);
    if (tipo === ":") {
      const s = latin.decode(bytes());
      simbolos.push(s);
      return s;
    }
    if (tipo === ";") return simbolos[entero()];
    throw new Error(`Marshal: se esperaba un símbolo en ${p - 1}`);
  };

  function leer() {
    const tipo = String.fromCharCode(b[p++]);
    switch (tipo) {
      case "0": return null;
      case "T": return true;
      case "F": return false;
      case "i": return entero();
      case ":": p--; return { simbolo: simbolo() };
      case ";": p--; return { simbolo: simbolo() };
      case "@": return objetos[entero()];
      case "I": {
        // Un texto con su codificación detrás (E: true, UTF-8; false, latin1)
        if (b[p] === 0x22) {
          p++;
          const indice = objetos.length;
          objetos.push("");
          const trozo = bytes();
          let latin1 = false;
          const n = entero();
          for (let i = 0; i < n; i++) {
            const nombre = simbolo();
            const v = leer();
            if (nombre === "E") latin1 = !v;
          }
          objetos[indice] = (latin1 ? latin : texto).decode(trozo);
          return objetos[indice];
        }
        const valor = leer();
        const n = entero();
        for (let i = 0; i < n; i++) {
          const nombre = simbolo();
          const v = leer();
          if (valor && typeof valor === "object") valor[nombre] = v;
        }
        return valor;
      }
      case '"': {
        const s = texto.decode(bytes());
        objetos.push(s);
        return s;
      }
      case "[": {
        const lista = [];
        objetos.push(lista);
        const n = entero();
        for (let i = 0; i < n; i++) lista.push(leer());
        return lista;
      }
      case "{":
      case "}": {
        const tabla = new Map();
        objetos.push(tabla);
        const n = entero();
        for (let i = 0; i < n; i++) {
          let clave = leer();
          if (clave && clave.simbolo !== undefined) clave = `:${clave.simbolo}`;
          tabla.set(clave, leer());
        }
        if (tipo === "}") tabla.porDefecto = leer();
        return tabla;
      }
      case "f": {
        const s = latin.decode(bytes());
        const v = s === "inf" ? Infinity : s === "-inf" ? -Infinity : s === "nan" ? NaN : parseFloat(s);
        objetos.push(v);
        return v;
      }
      case "l": {
        const signo = b[p++] === 0x2d ? -1 : 1;
        const n = entero() * 2;
        let x = 0;
        for (let i = 0; i < n; i++) x += b[p++] * 2 ** (8 * i);
        objetos.push(signo * x);
        return signo * x;
      }
      case "o": {
        const objeto = { clase: simbolo() };
        objetos.push(objeto);
        const n = entero();
        for (let i = 0; i < n; i++) {
          const nombre = simbolo();
          objeto[nombre] = leer();
        }
        return objeto;
      }
      case "u": {
        const clase = simbolo();
        const objeto = { clase, bytes: bytes() };
        objetos.push(objeto);
        return objeto;
      }
      case "U": {
        const objeto = { clase: simbolo() };
        objetos.push(objeto);
        objeto.datos = leer();
        return objeto;
      }
      case "S": {
        const objeto = { clase: simbolo() };
        objetos.push(objeto);
        const n = entero();
        for (let i = 0; i < n; i++) {
          const nombre = simbolo();
          objeto[nombre] = leer();
        }
        return objeto;
      }
      case "e": simbolo(); return leer();
      case "C": {
        const clase = simbolo();
        const valor = leer();
        if (valor && typeof valor === "object") valor.clase = clase;
        return valor;
      }
      case "c":
      case "m": {
        const nombre = latin.decode(bytes());
        objetos.push(nombre);
        return { modulo: nombre };
      }
      case "/": {
        const s = latin.decode(bytes());
        p++; // opciones
        const objeto = { regex: s };
        objetos.push(objeto);
        return objeto;
      }
      default:
        throw new Error(`Marshal: tipo «${tipo}» desconocido en ${p - 1}`);
    }
  }

  if (b[p] !== 4 || b[p + 1] !== 8) throw new Error("No es Marshal 4.8");
  p += 2;
  const valor = leer();
  return { valor, fin: p };
}

// Todos los valores seguidos de un archivo
export function leerTodosMarshal(b) {
  const valores = [];
  let p = 0;
  while (p < b.length) {
    const { valor, fin } = leerMarshal(b, p);
    valores.push(valor);
    p = fin;
  }
  return valores;
}
