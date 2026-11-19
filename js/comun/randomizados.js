// ---------- Tipos y estadísticas del randomizer de cada jugador de un locke ----------
//
// Al randomizar desde un locke («Randomizar mi ROM»), cada uno apunta aquí cómo han quedado los
// Pokémon de SU ROM (cada uno tiene su semilla, así que los de cada jugador son distintos). Los
// combates de ese locke (js/lucha/) los usan para que cada Pokémon luche con sus tipos y sus
// estadísticas de verdad, y no con los del juego original.
//
//   lockes/{id}/randomizados/{uid}   { especies: { "6": "fire/water|78,84,78,109,85,100", ... }, juego, creado }
//     tipos en inglés y en minúsculas, y las estadísticas en este orden: PS, Ata, Def, AtE, DfE, Vel.
//     Solo las especies (sin formas): las formas y las megas luchan con las del juego.

//   y, si se pudo leer, mt: { objetos: [nº de objeto de cada MT], ataques: [lo que enseña cada una],
//     compat: base64, por especie (1..n) ceil(MT/8) bytes con un bit por MT } (randomizar.js, tablaMT):
//     la bolsa de la web enseña la MT de verdad y el analizador sugiere las que tienes y puede aprender.

import { usuarioActual, baseDeDatos } from "./nube.js";

export async function guardarRandomizados(idLocke, juego, especies, mt = null) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  const hayEspecies = especies && Object.keys(especies).length;
  if (!usuario || !acceso || !idLocke || (!hayEspecies && !mt)) return;
  const { bd, fn } = acceso;
  // Las MT, también en este navegador: así valen aunque falle lo de la nube (reglas sin publicar...)
  if (mt) recordarMTEnEsteNavegador(idLocke, mt);
  const documento = { especies: especies || {}, juego: juego || "", creado: Date.now() };
  if (mt) documento.mt = mt;
  await fn.setDoc(fn.doc(bd, "lockes", idLocke, "randomizados", usuario.uid), documento);
}

// ---------- Las MT de tu ROM ----------

const deMT = {}; // idLocke -> promesa de la tabla (una lectura por locke)

const claveLocal = (uid, idLocke) => `nuzthelocke-mt-${uid}-${idLocke}`;

// Apunta la tabla en este navegador (y como la de ahora del locke). -> la tabla, como la da mtDelLocke
export function recordarMTEnEsteNavegador(idLocke, mt) {
  const usuario = usuarioActual();
  const tabla = leerMT(mt);
  if (!usuario || !idLocke || !tabla) return tabla;
  try {
    localStorage.setItem(claveLocal(usuario.uid, idLocke), JSON.stringify(mt));
  } catch (error) {
    // sin sitio o sin permiso: vale para esta visita
  }
  deMT[idLocke] = Promise.resolve(tabla);
  return tabla;
}

function mtDeEsteNavegador(uid, idLocke) {
  try {
    return leerMT(JSON.parse(localStorage.getItem(claveLocal(uid, idLocke)) || "null"));
  } catch (error) {
    return null;
  }
}

// Las MT de la ROM del usuario para un locke, o null si no se apuntaron (de la nube o, si no, de este navegador):
//   { ataqueDe(objeto) -> nº de ataque | 0, aprende(especie, objeto) -> bool, objetos: [nº] }
export function mtDelLocke(idLocke) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !idLocke) return Promise.resolve(null);
  if (!acceso) return Promise.resolve(mtDeEsteNavegador(usuario.uid, idLocke));
  if (!deMT[idLocke]) {
    const { bd, fn } = acceso;
    deMT[idLocke] = fn.getDoc(fn.doc(bd, "lockes", idLocke, "randomizados", usuario.uid))
      .then((documento) => (documento.exists() && leerMT(documento.data().mt)) || mtDeEsteNavegador(usuario.uid, idLocke))
      .catch(() => {
        delete deMT[idLocke];
        return mtDeEsteNavegador(usuario.uid, idLocke);
      });
  }
  return deMT[idLocke];
}

export function leerMT(mt) {
  if (!mt || !Array.isArray(mt.objetos) || !Array.isArray(mt.ataques) || typeof mt.compat !== "string") return null;
  let bits;
  try {
    bits = Uint8Array.from(atob(mt.compat), (c) => c.charCodeAt(0));
  } catch (error) {
    return null;
  }
  const ancho = Math.ceil(mt.objetos.length / 8);
  const indice = new Map(mt.objetos.map((objeto, k) => [Number(objeto), k]));
  return {
    objetos: mt.objetos.map(Number),
    ataqueDe: (objeto) => (indice.has(Number(objeto)) ? Number(mt.ataques[indice.get(Number(objeto))]) || 0 : 0),
    aprende(especie, objeto) {
      const k = indice.get(Number(objeto));
      if (k === undefined || !especie) return false;
      const byte = bits[(especie - 1) * ancho + (k >> 3)];
      return Boolean(byte & (1 << (k & 7)));
    }
  };
}

// { numero: { tipos: ["fire", "water"], stats: [6 números] } } o null si no hay
export async function leerRandomizados(idLocke, uid) {
  const acceso = baseDeDatos();
  if (!acceso || !idLocke || !uid) return null;
  const { bd, fn } = acceso;
  const documento = await fn.getDoc(fn.doc(bd, "lockes", idLocke, "randomizados", uid));
  if (!documento.exists()) return null;
  const especies = {};
  for (const [numero, texto] of Object.entries(documento.data().especies || {})) {
    const dato = leerUna(texto);
    if (dato) especies[numero] = dato;
  }
  return especies;
}

// "fire/water|78,84,78,109,85,100" -> { tipos, stats }
export function leerUna(texto) {
  const [tipos, stats] = String(texto || "").split("|");
  const numeros = (stats || "").split(",").map(Number);
  if (!tipos || numeros.length !== 6 || numeros.some((n) => !Number.isInteger(n) || n < 1 || n > 255)) return null;
  return { tipos: tipos.split("/").filter(Boolean).slice(0, 2), stats: numeros };
}

// Al borrar el locke
export async function borrarRandomizados(idLocke) {
  const acceso = baseDeDatos();
  if (!acceso) return;
  const { bd, fn } = acceso;
  const todos = await fn.getDocs(fn.collection(bd, "lockes", idLocke, "randomizados"));
  await Promise.all(todos.docs.map((documento) => fn.deleteDoc(documento.ref)));
}
