// ---------- Quién tiene la web abierta ----------
//
// Mientras tienes la web a la vista, cada CADA se apunta la hora en presencia/{tu uid}. Un
// amigo sale como conectado si su última marca es de hace menos de LIMITE. Al cerrar la
// pestaña se avisa de que te vas (si al navegador le da tiempo; si no, a los pocos minutos
// deja de salir conectado igual).
//
// Sin Realtime Database a propósito: con Firestore basta y no hay que activar nada más en
// la consola. Cada marca es una escritura, y el plan gratis da 20.000 al día para todo:
// por eso solo se apunta cada 3 minutos y no con la pestaña escondida (una pestaña
// olvidada abierta todo el día gastaría casi 500).
//
//   presencia/{uid}  { visto: hora del servidor, conectado: true | false, directo?: a qué juegas en directo }
//
// «directo»: mientras emites tu partida de «Jugar» para tus amigos (js/jugar/directo.js), el juego. Va aquí y
// no en otro documento para no escuchar uno más por amigo: sus fichas de «Amigos» ya escuchan este.

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { alCambiarAmistades, amigosAceptados } from "./perfiles.js";

const CADA = 3 * 60 * 1000;      // cada cuánto se apunta la hora
const LIMITE = 7 * 60 * 1000;    // sin marca desde hace más de esto: ya no está

let temporizador = null;
let latido = null;
let borrando = false;            // borrando la cuenta: ya no se apunta nada (ni al irse)
let ultimaMarca = 0;             // cuándo se apuntó «conectado» por última vez
let miDirecto = "";              // a qué juego en directo (vacío: a nada)

const presencias = new Map();    // uid -> { visto (ms), conectado }
const escuchas = new Map();      // uid -> función para dejar de escuchar
const oyentes = new Set();

// ---------- Para la pantalla ----------

export function estaConectado(uid) {
  const presencia = presencias.get(uid);
  return Boolean(presencia && presencia.conectado && Date.now() - presencia.visto < LIMITE);
}

// A qué juega en directo (vacío si no emite)
export function directoDe(uid) {
  return estaConectado(uid) ? presencias.get(uid).directo : "";
}

export function alCambiarPresencia(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion();
}

// ---------- Lo mío ----------

function apuntar(conectado) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso || borrando) return;
  const { bd, fn } = acceso;
  ultimaMarca = conectado ? Date.now() : 0;
  const datos = { visto: fn.serverTimestamp(), conectado };
  if (conectado && miDirecto) datos.directo = miDirecto;
  fn.setDoc(fn.doc(bd, "presencia", usuario.uid), datos)
    .catch((error) => console.error("No se ha podido apuntar la conexión", error));
}

// Empiezas o dejas de emitir (texto: el juego; vacío: ya no): se apunta enseguida
export function ponerMiDirecto(texto) {
  miDirecto = String(texto || "").slice(0, 60);
  apuntar(true);
}

function empezarAApuntar() {
  clearInterval(temporizador);
  apuntar(true);
  temporizador = setInterval(() => {
    if (document.visibilityState === "visible") apuntar(true);
  }, CADA);
}

function dejarDeApuntar() {
  clearInterval(temporizador);
  temporizador = null;
}

// Al borrar la cuenta: se deja de apuntar y se borra la marca
export async function borrarMiPresencia() {
  borrando = true;
  dejarDeApuntar();
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  await fn.deleteDoc(fn.doc(bd, "presencia", usuario.uid));
}

// ---------- Lo de mis amigos ----------

function escucharAmigos() {
  const acceso = baseDeDatos();
  const quedan = new Set(usuarioActual() ? amigosAceptados().map((amistad) => amistad.otro) : []);

  for (const [uid, dejar] of escuchas) {
    if (quedan.has(uid)) continue;
    dejar();
    escuchas.delete(uid);
    presencias.delete(uid);
  }

  if (!acceso) return;
  const { bd, fn } = acceso;

  for (const uid of quedan) {
    if (escuchas.has(uid)) continue;
    escuchas.set(
      uid,
      fn.onSnapshot(
        fn.doc(bd, "presencia", uid),
        (documento) => {
          const datos = documento.data();
          if (datos && datos.visto) {
            presencias.set(uid, {
              visto: datos.visto.toMillis(),
              conectado: Boolean(datos.conectado),
              directo: typeof datos.directo === "string" ? datos.directo : ""
            });
          } else {
            presencias.delete(uid);
          }
          avisar();
        },
        (error) => console.error("No se ha podido leer la conexión de un amigo", error)
      )
    );
  }
}

function dejarDeEscucharAmigos() {
  for (const dejar of escuchas.values()) dejar();
  escuchas.clear();
  presencias.clear();
}

// ---------- Arranque ----------

export function iniciarPresencia() {
  alCambiarSesion((usuario) => {
    dejarDeEscucharAmigos();
    if (usuario) {
      empezarAApuntar();
      escucharAmigos();
    } else {
      dejarDeApuntar();
    }
    avisar();
  });

  alCambiarAmistades(() => escucharAmigos());

  // Al volver a la pestaña se apunta enseguida si la última marca ya es vieja (escondida no
  // se apunta) y al cerrarla se avisa de que te vas
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && temporizador && Date.now() - ultimaMarca > CADA) {
      apuntar(true);
    }
  });
  window.addEventListener("pagehide", () => apuntar(false));

  // Alguien deja de estar conectado cuando pasa el tiempo sin marca, sin que llegue nada:
  // se vuelve a mirar cada medio minuto
  clearInterval(latido);
  latido = setInterval(avisar, 30 * 1000);
}
