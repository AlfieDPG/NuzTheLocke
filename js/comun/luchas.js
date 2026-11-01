// ---------- Lucha: combates entre amigos (datos) ----------
//
// Como los lockes y el chat, esto no pasa por localStorage: se lee y se escribe directamente en
// Firestore. La pantalla está en js/lucha/; las reglas, en firestore.rules («Lucha»).
//
//   luchas/{id}
//     jugadores: [retador, retado]   // en el combate, p1 y p2 (en ese orden)
//     nombres, fotos: { uid: ... }   // copia para pintar la lista sin leer perfiles
//     estado: "reto" | "jugando" | "fin"
//     formato: "gen4customgame@@@Team Preview"..., nivel: "tal" | "50", motor: versión del motor
//     semilla: { a: [4 números], b: [4 números] }   // a, de quien reta; b, de quien acepta
//     equipos: { uid: paste }        // el equipo de cada uno, como paste de Showdown
//     caras: { uid: [Pokémon] }      // lo justo para pintar sus retratos (pokemonParaCopia)
//     locke: { id, combate } | null  // si es un combate de un locke de «Lockes»
//     espera: [uid]                  // a quién le toca elegir (lo apunta la pantalla del combate)
//     ganador: uid | "empate", rendido: uid   // al terminar
//     creado, actualizado: milisegundos
//   luchas/{id}/turnos/{n}           // n = "0000", "0001"...: cada vez que alguien tiene que elegir
//     s1, s2: sellos (el resumen SHA-256 de la elección, para no poder verla antes de elegir)
//     e1, e2: elecciones ("move 1|sal", "switch 3|sal", "team 213456|sal")
//
// Cosas que parecen raras y tienen su razón:
//
//   · No hay servidor: cada navegador calcula el combate entero con el motor de Showdown y la
//     misma semilla, y solo se apuntan las elecciones. Con las mismas elecciones sale el mismo
//     combate en los dos (el motor es determinista), así que basta con eso, y al volver a entrar
//     se rehace desde el principio.
//   · El sello: cuando los dos eligen a la vez, cada uno apunta primero el resumen de su elección
//     (s1/s2) y solo cuando están los dos, la elección de verdad (e1/e2). Así nadie puede esperar
//     a ver la del otro. Lo comprueba cada navegador (las reglas no saben hacer SHA-256): si la
//     elección no casa con su sello, se avisa de trampa. Lo que se elige solo (un cambio tras un
//     debilitado) va sin sello.
//   · La semilla son dos mitades, una de cada jugador: quien reta no sabe la de quien acepta.
//   · Ganador: lo apunta el navegador del que antes vea el final; las reglas solo dejan pasar de
//     «jugando» a «fin» una vez.
//   · Borrar una lucha: sus turnos primero (Firestore no borra lo de dentro solo).

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { miPerfil, perfilesDeAmigos } from "./perfiles.js";

export const MAX_PASTE = 8000;

// Elecciones que esperan el sello del otro para destaparse: { "idLucha/n": "move 1|sal" }.
// En el navegador, por si se recarga entre sellar y destapar.
const CLAVE_PENDIENTES = "poketeams-luchas-pendientes-v1";

function acceso() {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  if (!base || !usuario) throw new Error("sin-sesion");
  return { ...base, usuario };
}

// ---------- Mis luchas, en vivo ----------

let todas = [];
let fallo = "";
let dejarDeEscuchar = null;
const oyentes = new Set();

function avisar() {
  for (const funcion of oyentes) funcion();
}

export function alCambiarLuchas(funcion) {
  oyentes.add(funcion);
  funcion();
  return () => oyentes.delete(funcion);
}

export function misLuchas() {
  return todas;
}

export function fallanLasLuchas() {
  return fallo;
}

export function luchaPorId(id) {
  return todas.find((lucha) => lucha.id === id) || null;
}

// Lado de cada uno en el combate: "p1" quien reta, "p2" quien acepta
export function ladoDe(lucha, uid) {
  return lucha.jugadores[0] === uid ? "p1" : lucha.jugadores[1] === uid ? "p2" : null;
}

export function rivalDe(lucha, uid) {
  return lucha.jugadores[0] === uid ? lucha.jugadores[1] : lucha.jugadores[0];
}

// Retos que me han mandado y aún no he contestado (para la campana), solo de amigos de ahora
export function retosRecibidos() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  const amigos = perfilesDeAmigos();
  return todas.filter((lucha) => lucha.estado === "reto" && lucha.jugadores[1] === usuario.uid && amigos.has(lucha.jugadores[0]));
}

// ¿A quién le toca elegir? Solo lo sabe quien rehace el combate (js/lucha/index.js), que lo apunta
// en «espera» (los uid que tienen que elegir) cada vez que cambia. Así la lista y la campana lo
// saben sin abrir el combate. Lo pueden apuntar los dos navegadores: los dos calculan lo mismo.
export function meToca(lucha) {
  const usuario = usuarioActual();
  return Boolean(usuario && lucha.estado === "jugando" && (lucha.espera || []).includes(usuario.uid));
}

export function luchasEnLasQueMeToca() {
  return todas.filter(meToca);
}

export async function ponerEspera(id, uids) {
  const { bd, fn } = acceso();
  const lucha = luchaPorId(id);
  const ahora = [...uids].sort();
  if (!lucha || lucha.estado !== "jugando" || JSON.stringify([...(lucha.espera || [])].sort()) === JSON.stringify(ahora)) return;
  await fn.updateDoc(fn.doc(bd, "luchas", id), { espera: ahora, actualizado: Date.now() });
}

function escuchar(usuario) {
  const { bd, fn } = baseDeDatos();
  const consulta = fn.query(fn.collection(bd, "luchas"), fn.where("jugadores", "array-contains", usuario.uid));
  dejarDeEscuchar = fn.onSnapshot(
    consulta,
    (instantanea) => {
      fallo = "";
      todas = instantanea.docs
        .map((documento) => ({ id: documento.id, ...documento.data() }))
        .sort((una, otra) => (otra.actualizado || 0) - (una.actualizado || 0));
      avisar();
    },
    (error) => {
      console.error("No se pueden leer las luchas", error);
      fallo = error.code === "permission-denied" ? "permisos" : "otro";
      todas = [];
      avisar();
    }
  );
}

export function iniciarLuchas() {
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = null;
    todas = [];
    fallo = "";
    if (usuario && baseDeDatos()) escuchar(usuario);
    avisar();
  });
}

// ---------- Retar, aceptar, rechazar ----------

// Cuatro números al azar de 16 bits: media semilla del motor (se juntan en js/lucha/combate.js)
function mediaSemilla() {
  return [...crypto.getRandomValues(new Uint16Array(4))];
}

function miNombreYFoto() {
  const perfil = miPerfil() || {};
  return { nombre: perfil.mote || perfil.nombre || "", foto: perfil.foto || "" };
}

// equipo: { paste, caras }; locke: { id, combate } o null
export async function retar({ rival, nombreRival, fotoRival, equipo, formato, nivel, motor, locke = null }) {
  const { bd, fn, usuario } = acceso();
  const yo = miNombreYFoto();
  const ahora = Date.now();
  const referencia = fn.doc(fn.collection(bd, "luchas"));
  await fn.setDoc(referencia, {
    jugadores: [usuario.uid, rival],
    nombres: { [usuario.uid]: yo.nombre, [rival]: nombreRival || "" },
    fotos: { [usuario.uid]: yo.foto, [rival]: fotoRival || "" },
    estado: "reto",
    formato,
    nivel,
    motor,
    semilla: { a: mediaSemilla() },
    equipos: { [usuario.uid]: equipo.paste },
    caras: { [usuario.uid]: equipo.caras },
    locke: locke || null,
    creado: ahora,
    actualizado: ahora
  });
  return referencia.id;
}

export async function aceptarReto(id, equipo) {
  const { bd, fn, usuario } = acceso();
  const yo = miNombreYFoto();
  await fn.updateDoc(fn.doc(bd, "luchas", id), {
    estado: "jugando",
    "semilla.b": mediaSemilla(),
    [`equipos.${usuario.uid}`]: equipo.paste,
    [`caras.${usuario.uid}`]: equipo.caras,
    [`nombres.${usuario.uid}`]: yo.nombre,
    [`fotos.${usuario.uid}`]: yo.foto,
    actualizado: Date.now()
  });
}

// Rechazar un reto, retirarlo o quitar una ya terminada de la lista (de los dos)
export async function borrarLucha(id) {
  const { bd, fn } = acceso();
  const turnos = await fn.getDocs(fn.collection(bd, "luchas", id, "turnos"));
  await Promise.all(turnos.docs.map((documento) => fn.deleteDoc(documento.ref)));
  await fn.deleteDoc(fn.doc(bd, "luchas", id));
  olvidarPendientes(id);
}

// Al borrar la cuenta: las mías, fuera (las que están a medias se dan por perdidas antes)
export async function borrarMisLuchas() {
  const usuario = usuarioActual();
  if (!usuario) return;
  for (const lucha of [...todas]) {
    try {
      if (lucha.estado === "jugando") await rendirse(lucha.id);
      await borrarLucha(lucha.id);
    } catch (error) {
      console.error("No se ha podido borrar una lucha", error);
    }
  }
}

// ---------- El final ----------

// ganador: uid o "empate". Devuelve true si ha sido este navegador el que lo ha apuntado (el otro
// ya lo habrá visto terminado): así solo uno de los dos lo apunta también en el locke.
export async function terminar(id, ganador) {
  const { bd, fn } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const apuntado = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return false;
    transaccion.update(referencia, { estado: "fin", ganador, actualizado: Date.now() });
    return true;
  });
  olvidarPendientes(id);
  return apuntado;
}

// Como terminar, pero ganando el otro. Devuelve el uid del que gana (o null si ya había terminado).
export async function rendirse(id) {
  const { bd, fn, usuario } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const ganador = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return null;
    const otro = rivalDe(actual.data(), usuario.uid);
    transaccion.update(referencia, { estado: "fin", ganador: otro, rendido: usuario.uid, actualizado: Date.now() });
    return otro;
  });
  olvidarPendientes(id);
  return ganador;
}

// ---------- Turnos ----------

export function idTurno(n) {
  return String(n).padStart(4, "0");
}

// Todos los turnos de una lucha, en orden, cada vez que cambia alguno: alLlegar([{ n, s1, s2, e1, e2 }])
export function escucharTurnos(id, alLlegar, alFallar) {
  const { bd, fn } = acceso();
  return fn.onSnapshot(
    fn.collection(bd, "luchas", id, "turnos"),
    (instantanea) => {
      const turnos = [];
      for (const documento of instantanea.docs) turnos[Number(documento.id)] = documento.data();
      alLlegar(turnos);
    },
    alFallar
  );
}

// El resumen con el que se sella una elección (texto hexadecimal)
export async function sello(eleccion) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(eleccion));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function conSal(eleccion) {
  const sal = [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${eleccion}|${sal}`;
}

// "move 1|a1b2..." -> "move 1"
export function sinSal(texto) {
  return String(texto || "").replace(/\|[0-9a-f]*$/, "");
}

// Apunta mi sello (s1/s2) o mi elección (e1/e2) en el turno n. La lucha sube arriba de la lista
// cuando cambia «espera» (ponerEspera), no aquí: una escritura menos por turno.
export async function apuntarEnTurno(id, n, campo, valor) {
  const { bd, fn } = acceso();
  await fn.setDoc(fn.doc(bd, "luchas", id, "turnos", idTurno(n)), { [campo]: valor }, { merge: true });
}

// ---------- Elecciones selladas que aún no se han destapado ----------

function leerPendientes() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function escribirPendientes(pendientes) {
  try {
    localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(pendientes));
  } catch (error) {
    // sin sitio: si se recarga antes de destapar, habrá que volver a elegir (no se puede: queda
    // el sello). Muy raro; la pantalla lo explica si pasa.
  }
}

export function pendienteDe(id, n) {
  return leerPendientes()[`${id}/${n}`] || null;
}

export function guardarPendiente(id, n, eleccion) {
  const pendientes = leerPendientes();
  pendientes[`${id}/${n}`] = eleccion;
  escribirPendientes(pendientes);
}

export function olvidarPendientes(id) {
  const pendientes = leerPendientes();
  for (const clave of Object.keys(pendientes)) if (clave.startsWith(`${id}/`)) delete pendientes[clave];
  escribirPendientes(pendientes);
}
