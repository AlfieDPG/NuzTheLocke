// ---------- Textos de gen 5 (Negro / Blanco, Negro 2 / Blanco 2) ----------
//
// Cada archivo de texto (dentro de a/0/0/2, los del sistema, y a/0/0/3, los de la historia):
//   u16 secciones, u16 entradas, u32 tamaño, u32 (nada), u32 dónde empieza cada sección
//   cada sección: u32 tamaño y, por entrada, [u32 dónde, u16 cuántos caracteres, u16 (algo)];
//   luego los caracteres (u16) de cada entrada.
// Cada entrada va cifrada: XOR con una clave que, de un carácter al siguiente, rota 3 bits a la
// izquierda. El último carácter siempre es 0xFFFF, así que se descifra desde el final. Si el
// primero es 0xF100, el resto va comprimido (caracteres de 9 bits).
//
// Aquí los textos van como cadenas de JavaScript con cada u16 tal cual (los códigos de control,
// 0xF000 y siguientes, se quedan como caracteres raros): así se puede buscar y sustituir sin
// estropearlos. 0xFFFE es el salto de línea.

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

const rotarIzq = (k) => ((k << 3) | (k >>> 13)) & 0xffff;
const rotarDer = (k) => ((k >>> 3) | (k << 13)) & 0xffff;

// Los caracteres de 9 bits de los textos comprimidos (detrás del 0xF100)
function descomprimir(codigos) {
  const salida = [];
  let bits = 0;
  let cuantos = 0;
  for (let i = 1; i < codigos.length; i++) {
    bits |= codigos[i] << cuantos;
    cuantos += 16;
    while (cuantos >= 9) {
      const c = bits & 0x1ff;
      if ((c & 0xff) === 0xff) return salida;
      if (c > 1) salida.push(c);
      bits >>>= 9;
      cuantos -= 9;
    }
  }
  return salida;
}

// { cabecera, secciones, entradas: [{ texto, clave, algo }] } (solo la primera sección, la del
// idioma del juego; las demás se dejan como están)
export function leerTextos(datos) {
  const secciones = u16(datos, 0);
  const cuantas = u16(datos, 2);
  const inicio = u32(datos, 12);
  const entradas = [];
  for (let j = 0; j < cuantas; j++) {
    const fila = inicio + 4 + j * 8;
    const donde = inicio + u32(datos, fila);
    const largo = u16(datos, fila + 4);
    const algo = u16(datos, fila + 6);
    const codigos = [];
    for (let k = 0; k < largo; k++) codigos.push(u16(datos, donde + k * 2));
    let clave = codigos[largo - 1] ^ 0xffff;
    for (let k = largo - 1; k >= 0; k--) {
      codigos[k] ^= clave;
      if (k > 0) clave = rotarDer(clave);
    }
    let claros = codigos;
    const comprimido = claros[0] === 0xf100;
    if (comprimido) claros = descomprimir(claros);
    // Sin los 0xFFFF del final
    while (claros.length && claros[claros.length - 1] === 0xffff) claros = claros.slice(0, -1);
    // crudo: tal cual está en el archivo (cifrado), para dejar igual lo que no cambia
    const crudo = datos.slice(donde, donde + largo * 2);
    entradas.push({ texto: String.fromCharCode(...claros), clave, algo, comprimido, crudo });
  }
  return { secciones, entradas };
}

// Lo contrario de descomprimir: 0xF100 y los caracteres de 9 bits, acabados en 0x1FF. null si
// alguno no cabe en 9 bits (o acaba en 0xFF, que es la marca de fin).
function comprimir(codigos) {
  if (codigos.some((c) => c > 0x1ff || (c & 0xff) === 0xff || c < 2)) return null;
  const salida = [0xf100];
  let bits = 0;
  let cuantos = 0;
  for (const c of [...codigos, 0x1ff]) {
    bits |= c << cuantos;
    cuantos += 9;
    while (cuantos >= 16) {
      salida.push(bits & 0xffff);
      bits >>>= 16;
      cuantos -= 16;
    }
  }
  if (cuantos) salida.push((bits | (0xffff << cuantos)) & 0xffff);
  return salida;
}

// La clave con la que empieza cada entrada (de una a la siguiente, + 0x2983)
const claveDeEntrada = (j) => (0x7c89 + j * 0x2983) & 0xffff;

// El archivo con los textos nuevos (una cadena por entrada, como las de leerTextos). Lo que no
// cambia se queda igual; lo que cambia se comprime si lo estaba (así el archivo no crece). Si hay
// más textos que entradas, se añaden al final (los mensajes de las mentas: ./mentas-gen5.js; solo
// en los archivos de una sección, que son los de todos los idiomas salvo el japonés)
export function escribirTextos(original, textos) {
  const leido = leerTextos(original);
  if (textos.length > leido.entradas.length && leido.secciones !== 1) throw new Error("No se pueden añadir textos a este archivo.");
  for (let j = leido.entradas.length; j < textos.length; j++) {
    leido.entradas.push({ texto: null, clave: claveDeEntrada(j), algo: 0, comprimido: false, crudo: new Uint8Array(0) });
  }
  const cuantas = leido.entradas.length;
  const inicio = u32(original, 12);
  const tamOriginal = u32(original, inicio);

  const cifradas = leido.entradas.map((e, j) => {
    const texto = textos[j] ?? e.texto ?? "";
    if (texto === e.texto) return Array.from({ length: e.crudo.length / 2 }, (_, k) => u16(e.crudo, k * 2));
    let codigos = [...texto].map((c) => c.charCodeAt(0));
    if (e.comprimido) codigos = comprimir(codigos) || codigos;
    codigos.push(0xffff);
    let clave = e.clave;
    return codigos.map((c) => {
      const cifrado = (c ^ clave) & 0xffff;
      clave = rotarIzq(clave);
      return cifrado;
    });
  });
  // La sección tiene que medir múltiplo de 4: un 0xFFFF más a la última si hace falta
  let caracteres = cifradas.reduce((t, c) => t + c.length, 0);
  if (caracteres % 2) {
    const ultima = cifradas[cuantas - 1];
    let clave = leido.entradas[cuantas - 1].clave;
    for (let k = 0; k < ultima.length; k++) clave = rotarIzq(clave);
    ultima.push(0xffff ^ clave);
    caracteres++;
  }

  const tamSeccion = 4 + cuantas * 8 + caracteres * 2;
  const seccion = new Uint8Array(tamSeccion);
  poner32(seccion, 0, tamSeccion);
  let donde = 4 + cuantas * 8;
  cifradas.forEach((c, j) => {
    poner32(seccion, 4 + j * 8, donde);
    poner16(seccion, 4 + j * 8 + 4, c.length);
    poner16(seccion, 4 + j * 8 + 6, leido.entradas[j].algo);
    c.forEach((v, k) => poner16(seccion, donde + k * 2, v));
    donde += c.length * 2;
  });

  const salida = new Uint8Array(original.length - tamOriginal + tamSeccion);
  salida.set(original.subarray(0, inicio));
  salida.set(seccion, inicio);
  salida.set(original.subarray(inicio + tamOriginal), inicio + tamSeccion);
  poner16(salida, 2, cuantas);
  poner32(salida, 4, tamSeccion);
  if (leido.secciones === 2) poner32(salida, 16, u32(original, 16) - tamOriginal + tamSeccion);
  return salida;
}

// Para leer en pruebas: los códigos de control, visibles
export function legible(texto) {
  return texto.replace(/[-￿]/g, (c) => (c === "￾" ? "\n" : `[${c.charCodeAt(0).toString(16)}]`));
}
