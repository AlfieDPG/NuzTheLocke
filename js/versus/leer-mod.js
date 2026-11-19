// «Leer las MT de mi mod» (bolsillo de MT de la ventana «Partida», ver ./bolsa.js): para quien randomizó fuera del
// locke (sin su semilla, la web no sabe cómo quedó su ROM). Se elige el mod que ya tiene puesto en el emulador —el
// .zip que dio el randomizer o el archivo personal_masterdatas de su carpeta— y se apunta en el locke lo mismo que
// al randomizar desde él (js/comun/randomizados.js): qué enseña cada MT, quién la aprende, y los tipos y las
// estadísticas (para los combates). De momento, solo Diamante Brillante / Perla Reluciente.

import { guardarRandomizados, recordarMTEnEsteNavegador } from "../comun/randomizados.js";

export const JUEGOS_CON_MOD = new Set(["bdsp"]);

// ---------- .zip ----------

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

// Un archivo de dentro de un .zip cuyo nombre acaba en «final» (sin comprimir o con deflate), o null
export async function archivoDelZip(bytes, final) {
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 0x10000 - 22); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("Ese archivo no es un .zip válido.");
  const cuantos = u16(bytes, fin + 10);
  let p = u32(bytes, fin + 16);
  for (let n = 0; n < cuantos && u32(bytes, p) === 0x02014b50; n++) {
    const metodo = u16(bytes, p + 10);
    const comprimido = u32(bytes, p + 20);
    const largoNombre = u16(bytes, p + 28);
    const largoExtra = u16(bytes, p + 30);
    const largoComentario = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const nombre = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + largoNombre)).replace(/\\/g, "/");
    p += 46 + largoNombre + largoExtra + largoComentario;
    if (!nombre.toLowerCase().endsWith(final.toLowerCase())) continue;
    const inicio = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const datos = bytes.subarray(inicio, inicio + comprimido);
    if (metodo === 0) return datos.slice();
    if (metodo === 8) {
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(flujo).arrayBuffer());
    }
    throw new Error("El .zip está comprimido de una forma que no sé leer. Elige el archivo personal_masterdatas de la carpeta del mod.");
  }
  return null;
}

// ---------- Leer y apuntar ----------

// archivo: el File elegido (.zip del mod o personal_masterdatas).
//   -> { cuantas, tabla (como mtDelLocke), guardado (si se ha podido apuntar en el locke) }
// Aunque no se pueda apuntar en el locke (sin conexión, reglas sin publicar), se queda en este navegador.
export async function leerMTDelMod(idLocke, juego, archivo) {
  if (!JUEGOS_CON_MOD.has(juego)) throw new Error("Con este juego todavía no se pueden leer las MT del mod.");
  const motor = await import("../randomizer/juego-bdsp.js");
  let bytes = new Uint8Array(await archivo.arrayBuffer());
  if (u32(bytes, 0) === 0x04034b50) {
    bytes = await archivoDelZip(bytes, "Pml/personal_masterdatas");
    if (!bytes) throw new Error("En ese .zip no está personal_masterdatas: ¿es el del randomizer?");
  }
  let datos;
  try {
    datos = motor.datosDeMod(bytes);
  } catch (error) {
    console.error(error);
    throw new Error("No he podido leer las MT de ese archivo. Elige el .zip del randomizer o el archivo personal_masterdatas (en romfs/Data/StreamingAssets/AssetAssistant/Pml).");
  }
  const tabla = recordarMTEnEsteNavegador(idLocke, datos.mt);
  let guardado = true;
  try {
    await guardarRandomizados(idLocke, juego, datos.especies, datos.mt);
  } catch (error) {
    console.error("No se han podido apuntar en el locke las MT del mod", error);
    guardado = false;
  }
  return { cuantas: datos.mt.objetos.length, tabla, guardado };
}
