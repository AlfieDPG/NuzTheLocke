// ---------- ROM de GBA ----------
//
// La ROM entera (16 MB) se cambia ahí mismo: lo que crece (los entrenadores con más Pokémon, los ataques que
// aprenden, las tiendas) va al espacio libre del final, que en Rojo Fuego y Verde Hoja son bytes 0xFF.

import { VERSIONES_GBA } from "./versiones-gba.js";

// En la cabecera de toda ROM de GBA, 0xB2 vale siempre 0x96
export const esRomGBA = (bytes) => bytes instanceof Uint8Array && bytes.length >= 0x200 && bytes[0xb2] === 0x96;

// El código del juego (BPRS: Rojo Fuego en español) y la versión
export function codigoGBA(bytes) {
  return String.fromCharCode(...bytes.subarray(0xac, 0xb0));
}

export class RomGBA {
  constructor(bytes) {
    this.bytes = bytes;
    this.esGBA = true;
    this.juego = "frlg";
    this.codigo = codigoGBA(bytes);
    this.version = VERSIONES_GBA[`${this.codigo}${bytes[0xbc]}`];
    if (!this.version) throw new Error("Esta versión de Rojo Fuego / Verde Hoja todavía no se puede randomizar.");
    this.titulo = this.codigo.startsWith("BPG") ? "Verde Hoja" : "Rojo Fuego";
    this.cambiados = new Set(); // qué partes se han tocado (para el resumen)
    this.libre = 0x800000; // por dónde va el espacio libre
  }

  // Un hueco de «tam» bytes en el espacio libre (alineado a 4, con 4 bytes de margen detrás)
  reservar(tam) {
    const b = this.bytes;
    let i = this.libre;
    while (i + tam + 4 <= b.length) {
      let malo = -1;
      for (let k = i; k < i + tam + 4; k++) {
        if (b[k] !== 0xff) {
          malo = k;
          break;
        }
      }
      if (malo < 0) {
        this.libre = (i + tam + 4 + 3) & ~3;
        return i;
      }
      i = (malo + 4) & ~3;
    }
    throw new Error("No queda sitio en la ROM para lo que hay que añadir.");
  }
}
