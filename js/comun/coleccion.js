// ---------- Colección (huevos) ----------
//
// Otro uso para los Pokédólares, que no se acaba: en «Juegos» → «Colección» se compran huevos
// y de cada uno sale una especie al azar (1 de cada PROB_SHINY, shiny). Se van juntando hasta
// completar la Pokédex. Los repetidos se cambian solos por Pokédólares (DEVOLUCION).
//
//   colecciones/{uid}        { especies: { numero: veces }, shiny: { numero: veces },
//                              aspecto: { numero: { cara, shiny } } }
//                            (aspecto: cómo quieres ver a cada uno en la colección: una cara de
//                            Mundo Misterioso y, si lo tienes shiny, en shiny o no)
//                            recientes: [{ id, shiny }] los últimos nuevos (MAX_RECIENTES)
//                            destacados: [id] los que eliges enseñar en tu perfil (MAX_DESTACADOS)
//                            (el perfil enseña los destacados o, si no hay, los recientes)
//                            (aparte del perfil: así los amigos no se bajan la colección entera
//                            cada vez que cambia algo de tu perfil)
//   perfiles/{uid}.huevos    { gastados, devueltos }: los Pokédólares que se han ido en huevos
//                            y los que han vuelto por repetidos (cuentan en el saldo: fichas.js)
//
// Las dos cosas se escriben en el mismo lote, con increment (así no se pisan dos pestañas).
// Como el resto de la Tienda, el sorteo lo hace la web: las reglas solo ponen topes.

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { miPerfil } from "./perfiles.js";
import { saldo } from "./fichas.js";
import { sumarContador } from "./contadores.js";

export const PRECIO_HUEVO = 100;
export const PRECIO_DIEZ = 900; // diez de golpe: uno sale gratis
export const DEVOLUCION = { normal: 25, shiny: 75 };
export const PROB_SHINY = 50;   // 1 de cada 50
export const MAX_RECIENTES = 12;
export const MAX_DESTACADOS = 6;

// Lo difícil que es que salga cada especie, según su clase (la de la Pokédex)
const PESO = { "": 1, bebe: 1, legendario: 0.12, singular: 0.06 };

let mia = null; // { especies, shiny } o null mientras no ha llegado
let dejarDeEscuchar = null;
const oyentes = new Set();

export function miColeccion() {
  return mia;
}

export function alCambiarColeccion(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(mia);
}

// Se escucha la primera vez que se pide (al abrir «Colección») y se sigue al cambiar de cuenta
export function escucharColeccion() {
  if (dejarDeEscuchar !== null) return;
  const empezar = () => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = () => {};
    mia = null;
    const usuario = usuarioActual();
    const acceso = baseDeDatos();
    if (!usuario || !acceso) {
      avisar();
      return;
    }
    const { bd, fn } = acceso;
    dejarDeEscuchar = fn.onSnapshot(
      fn.doc(bd, "colecciones", usuario.uid),
      (documento) => {
        const datos = documento.data() || {};
        mia = deDocumento(datos);
        avisar();
      },
      (error) => console.error("No se ha podido leer la colección", error)
    );
  };
  empezar();
  alCambiarSesion(empezar);
}

function deDocumento(datos) {
  return {
    especies: datos.especies || {}, shiny: datos.shiny || {}, aspecto: datos.aspecto || {},
    recientes: datos.recientes || [], destacados: datos.destacados || []
  };
}

// La de otra persona (para su perfil): se pide una vez y se guarda aquí. null si no tiene.
const deOtros = new Map(); // uid -> promesa

export function coleccionDe(uid) {
  if (!deOtros.has(uid)) {
    const acceso = baseDeDatos();
    deOtros.set(uid, acceso
      ? acceso.fn.getDoc(acceso.fn.doc(acceso.bd, "colecciones", uid)).then((documento) => (documento.exists() ? deDocumento(documento.data()) : null))
      : Promise.resolve(null));
    deOtros.get(uid).catch(() => deOtros.delete(uid));
  }
  return deOtros.get(uid);
}

// Los que se enseñan en el perfil: los destacados o, si no ha elegido, los últimos nuevos
export function escaparate(coleccion) {
  if (!coleccion) return [];
  if (coleccion.destacados.length) return coleccion.destacados.map((id) => ({ id: Number(id) }));
  return coleccion.recientes.slice(0, MAX_DESTACADOS).map((cada) => ({ id: Number(cada.id) }));
}

// Poner o quitar uno de los destacados de tu perfil (como mucho MAX_DESTACADOS)
export async function alternarDestacado(id) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso || !mia) return;
  const ahora = mia.destacados.map(Number);
  const nuevos = ahora.includes(id) ? ahora.filter((cada) => cada !== id) : [...ahora, id].slice(-MAX_DESTACADOS);
  const { bd, fn } = acceso;
  await fn.setDoc(fn.doc(bd, "colecciones", usuario.uid), { destacados: nuevos }, { merge: true });
}

// Si la tienes: normal o shiny (con la shiny también cuenta como tuya)
export function laTengo(coleccion, id) {
  return Boolean(coleccion && (coleccion.especies[id] || coleccion.shiny[id]));
}

// Cómo se ve en la colección: la cara elegida y si en shiny. Sin elegir, la normal; y si solo
// la tienes shiny, en shiny.
export function aspectoDe(coleccion, id) {
  const elegido = (coleccion && coleccion.aspecto[id]) || {};
  const tieneShiny = Boolean(coleccion && coleccion.shiny[id]);
  const soloShiny = tieneShiny && !coleccion.especies[id];
  return {
    cara: elegido.cara || "Normal",
    shiny: tieneShiny && (elegido.shiny ?? soloShiny)
  };
}

async function guardarAspectos(cambios) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;
  await fn.setDoc(fn.doc(bd, "colecciones", usuario.uid), { aspecto: cambios }, { merge: true });
}

export function elegirAspecto(id, cara, shiny) {
  return guardarAspectos({ [id]: { cara, shiny: Boolean(shiny) } });
}

// Todas las que tienes shiny, en shiny (o todas en normal), sin tocar la cara de cada una
export function todasEnShiny(activar) {
  const cambios = {};
  for (const id of Object.keys(mia.shiny)) cambios[id] = { cara: aspectoDe(mia, id).cara, shiny: activar };
  return guardarAspectos(cambios);
}

// ---------- Sorteo ----------

function azar() {
  const numero = new Uint32Array(1);
  crypto.getRandomValues(numero);
  return numero[0] / 4294967296;
}

function sortear(especies) {
  const pesos = especies.map((especie) => PESO[especie.clase] ?? 1);
  const total = pesos.reduce((suma, peso) => suma + peso, 0);
  let tirada = azar() * total;
  for (let i = 0; i < especies.length; i++) {
    tirada -= pesos[i];
    if (tirada < 0) return especies[i];
  }
  return especies[especies.length - 1];
}

// Abre «cuantos» huevos (1 o 10). especies: las de js/juegos/comun.js (cargarEspecies).
// Devuelve [{ especie, shiny, nuevo, devuelve }] o lanza un Error con el motivo.
export async function abrirHuevos(cuantos, especies) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  const perfil = miPerfil();
  if (!usuario || !acceso || !perfil || !mia) throw new Error("sin-sesion");
  const coste = cuantos === 10 ? PRECIO_DIEZ : PRECIO_HUEVO * cuantos;
  if (saldo(perfil) < coste) throw new Error("sin-saldo");

  const tengo = { especies: { ...mia.especies }, shiny: { ...mia.shiny } };
  const resultados = [];
  for (let i = 0; i < cuantos; i++) {
    const especie = sortear(especies);
    const shiny = azar() < 1 / PROB_SHINY;
    const grupo = shiny ? "shiny" : "especies";
    const nuevo = !tengo[grupo][especie.id];
    tengo[grupo][especie.id] = (tengo[grupo][especie.id] || 0) + 1;
    resultados.push({ especie, shiny, nuevo, devuelve: nuevo ? 0 : DEVOLUCION[shiny ? "shiny" : "normal"] });
  }

  const { bd, fn } = acceso;
  const suma = (grupo) => {
    const veces = {};
    for (const r of resultados.filter((cada) => (cada.shiny ? "shiny" : "especies") === grupo)) {
      veces[r.especie.id] = (veces[r.especie.id] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(veces).map(([id, n]) => [id, fn.increment(n)]));
  };
  const devueltos = resultados.reduce((total, r) => total + r.devuelve, 0);

  const lote = fn.writeBatch(bd);
  // Los nuevos, delante en «recientes» (sin repetir)
  const nuevos = resultados.filter((r) => r.nuevo).reverse().map((r) => ({ id: r.especie.id, shiny: r.shiny }));
  const recientes = [...nuevos, ...mia.recientes.filter((cada) => !nuevos.some((n) => n.id === cada.id && n.shiny === cada.shiny))].slice(0, MAX_RECIENTES);
  lote.set(fn.doc(bd, "colecciones", usuario.uid), { especies: suma("especies"), shiny: suma("shiny"), recientes }, { merge: true });
  lote.update(fn.doc(bd, "perfiles", usuario.uid), {
    "huevos.gastados": fn.increment(coste),
    "huevos.devueltos": fn.increment(devueltos)
  });
  await lote.commit();
  for (let i = 0; i < cuantos; i++) sumarContador("huevos"); // para los logros
  if (cuantos === 10) sumarContador("huevos-diez");
  return resultados;
}

// Al borrar la cuenta
export async function borrarMiColeccion() {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  await fn.deleteDoc(fn.doc(bd, "colecciones", usuario.uid));
}
