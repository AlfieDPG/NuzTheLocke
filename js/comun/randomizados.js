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

import { usuarioActual, baseDeDatos } from "./nube.js";

export async function guardarRandomizados(idLocke, juego, especies) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso || !idLocke || !especies || !Object.keys(especies).length) return;
  const { bd, fn } = acceso;
  await fn.setDoc(fn.doc(bd, "lockes", idLocke, "randomizados", usuario.uid), { especies, juego: juego || "", creado: Date.now() });
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
