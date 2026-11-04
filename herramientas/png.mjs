// Escribe un PNG (RGBA, 8 bits) sin librerías: lo usan los generadores de dibujos de herramientas/
//
//   png(ancho, alto, rgba) -> Buffer con el archivo

import { deflateSync } from "node:zlib";

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

export function png(ancho, alto, rgba) {
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * ancho * 4, ancho * 4).copy(filas, y * (ancho * 4 + 1) + 1);
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", cabecera),
    trozo("IDAT", deflateSync(filas, { level: 9 })),
    trozo("IEND", Buffer.alloc(0))
  ]);
}
