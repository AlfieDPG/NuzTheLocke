// ---------- Textos de 3DS (6.ª y 7.ª generación) ----------
//
// Cada archivo de texto (una entrada de un GARC):
//   0x00 u16 secciones (1)   0x02 u16 líneas   0x04 u32 tamaño total   0x08 u32 (0)   0x0c u32 dónde empieza la sección
//   la sección: u32 tamaño; luego, por línea, [s32 dónde empieza (desde el inicio de la sección), u16 caracteres, u16 sin uso conocido];
//   luego los caracteres (u16), cifrados: la clave de la línea i es 0x7C89 + i * 0x2983 y, tras cada carácter,
//   se gira 3 bits a la izquierda.
// Las variables (nombres, números...) empiezan por 0x0010: [0x0010, cuántos u16 van detrás, código, argumentos...].
//
// Aquí cada línea es una cadena de JS con los u16 tal cual (sin el 0 del final).

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const s32 = (b, i) => u32(b, i) | 0;
function poner16(b, i, v) {
  b[i] = v & 0xff;
  b[i + 1] = (v >> 8) & 0xff;
}
function poner32(b, i, v) {
  poner16(b, i, v & 0xffff);
  poner16(b, i + 2, (v >>> 16) & 0xffff);
}
const girar = (k) => ((k << 3) | (k >> 13)) & 0xffff;

// { lineas: [cadena] }
export function leerTextos6(b) {
  const cuantas = u16(b, 2);
  const seccion = u32(b, 0x0c);
  const lineas = [];
  for (let i = 0; i < cuantas; i++) {
    const donde = seccion + s32(b, seccion + 4 + i * 8);
    const largo = u16(b, seccion + 8 + i * 8);
    let clave = (0x7c89 + i * 0x2983) & 0xffff;
    const c = [];
    for (let j = 0; j < largo; j++) {
      c.push(u16(b, donde + j * 2) ^ clave);
      clave = girar(clave);
    }
    while (c.length && c[c.length - 1] === 0) c.pop();
    lineas.push(String.fromCharCode(...c));
  }
  return { lineas };
}

// El archivo con las líneas nuevas (una cadena por línea, como las de leerTextos6). Si hay más textos que líneas, se
// añaden al final (los mensajes de las mentas: ./mentas-xy.js)
export function escribirTextos6(original, textos) {
  const antes = u16(original, 2);
  const cuantas = Math.max(antes, textos.length);
  const todas = Array.from({ length: cuantas }, (_, i) => {
    const c = [...(textos[i] ?? "")].map((x) => x.charCodeAt(0));
    c.push(0);
    return c;
  });
  const cabeza = 4 + cuantas * 8;
  // Cada línea empieza alineada a 4 bytes, como en los archivos del juego
  const ocupa = (c) => (c.length * 2 + 3) & ~3;
  const tam = cabeza + todas.reduce((t, c) => t + ocupa(c), 0);
  const salida = new Uint8Array(0x10 + tam);
  poner16(salida, 0, 1);
  poner16(salida, 2, cuantas);
  poner32(salida, 4, tam);
  poner32(salida, 0x0c, 0x10);
  poner32(salida, 0x10, tam);
  let donde = cabeza;
  todas.forEach((c, i) => {
    poner32(salida, 0x10 + 4 + i * 8, donde);
    poner16(salida, 0x10 + 8 + i * 8, c.length);
    poner16(salida, 0x10 + 10 + i * 8, i < antes ? u16(original, u32(original, 0x0c) + 10 + i * 8) : 0); // lo que venga detrás, como estaba
    let clave = (0x7c89 + i * 0x2983) & 0xffff;
    c.forEach((x, j) => {
      poner16(salida, 0x10 + donde + j * 2, x ^ clave);
      clave = girar(clave);
    });
    donde += ocupa(c);
  });
  return salida;
}

// Para buscar y leer: sin las variables ni los códigos de control (los saltos de línea, «\n»)
export function aTexto(linea) {
  let s = "";
  for (let i = 0; i < linea.length; i++) {
    const c = linea.charCodeAt(i);
    if (c === 0x10) {
      i += 1 + linea.charCodeAt(i + 1);
      continue;
    }
    if (c === 0xe000 || c === 0xe001 || c === 0xe002) s += "\n";
    else if (c >= 0x20 || c === 0x0a) s += linea[i];
  }
  return s;
}
