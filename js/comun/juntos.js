// ---------- Juegos con amigos (sección «Juegos», js/juegos/amigos.js) ----------
//
// Partidas entre dos amigos a la vez (pensadas para jugar en llamada): «¿Quién es quién?», «Cromos de
// estadísticas», «Duelo de siluetas» y «Dibuja ese Pokémon». Como los combates, sin servidor: el documento
// lleva lo que se ve en común y cada navegador pinta lo suyo a partir de ahí.
//
//   juntos/{id}  { juego, jugadores: [quien reta, retado], nombres, fotos, estado: "reto" | "jugando" | "fin",
//                  semilla (de ella sale lo mismo en los dos: el tablero, las cartas, las siluetas...),
//                  turno (uid; "" si juegan a la vez), datos (lo de cada juego), ganador (uid | "empate" | ""),
//                  creado, actualizado }
//   juntos/{id}/secretos/{uid}  { valor }  lo que solo sabe uno (el Pokémon de «¿Quién es quién?»). Lo lee
//                  solo su dueño hasta que se termina la partida.
//   juntos/{id}/trazos/{n}      { uid, ronda, puntos, creado }  lo que se dibuja en «Dibuja ese Pokémon».
//
// Premio: la primera partida que ganas cada día da PREMIO_DIA Pokédólares (una jugada «amigos» del día, como
// las de los retos: js/comun/fichas.js; las reglas no dejan dos el mismo día).
//
// Reglas en firestore.rules («Juegos con amigos»): solo los dos leen y escriben, solo a un amigo, y la
// semilla, el juego y los jugadores no cambian.

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { miPerfil, amigosAceptados } from "./perfiles.js";
import { guardarJugada } from "./fichas.js";
import { t } from "./idioma.js";

export const PREMIO_DIA = 60;

const NOMBRES = {
  quien: () => t("¿Quién es quién?"),
  cromos: () => t("Cromos de estadísticas"),
  siluetas: () => t("Duelo de siluetas"),
  dibujo: () => t("Dibuja ese Pokémon")
};

export function nombreJuegoJuntos(juego) {
  return NOMBRES[juego] ? NOMBRES[juego]() : juego;
}

let todas = [];
let dejarDeEscuchar = null;
let fallo = "";
const oyentes = new Set();

function acceso() {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  return base && usuario ? { ...base, usuario } : null;
}

export function partidasJuntos() {
  return todas;
}

export function partidaJuntos(id) {
  return todas.find((partida) => partida.id === id) || null;
}

export function fallanJuntos() {
  return fallo;
}

export function alCambiarJuntos(funcion) {
  oyentes.add(funcion);
  funcion(todas);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(todas);
}

export const otroDe = (partida, uid) => (partida.jugadores[0] === uid ? partida.jugadores[1] : partida.jugadores[0]);

// Las invitaciones que me han mandado (de amigos de ahora) y las partidas en las que me toca
export function invitacionesJuntos() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  const amigos = new Set(amigosAceptados().map((amistad) => amistad.otro));
  return todas.filter((p) => p.estado === "reto" && p.jugadores[1] === usuario.uid && amigos.has(p.jugadores[0]));
}

export function juntosEnLosQueMeToca() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return todas.filter((p) => p.estado === "jugando" && p.turno === usuario.uid);
}

function escuchar(usuario) {
  const { bd, fn } = baseDeDatos();
  dejarDeEscuchar = fn.onSnapshot(
    fn.query(fn.collection(bd, "juntos"), fn.where("jugadores", "array-contains", usuario.uid)),
    (instantanea) => {
      fallo = "";
      todas = instantanea.docs
        .map((documento) => ({ id: documento.id, ...documento.data() }))
        .sort((una, otra) => (otra.actualizado || 0) - (una.actualizado || 0));
      avisar();
      cobrarPremios();
    },
    (error) => {
      console.error("No se pueden leer las partidas con amigos", error);
      fallo = error.code === "permission-denied" ? "permisos" : "otro";
      todas = [];
      avisar();
    }
  );
}

export function iniciarJuntos() {
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = null;
    todas = [];
    fallo = "";
    if (usuario && baseDeDatos()) escuchar(usuario);
    avisar();
  });
}

// ---------- Retar, aceptar, jugar ----------

function semillaNueva() {
  return [...crypto.getRandomValues(new Uint32Array(2))].map((n) => n.toString(36)).join("");
}

// datos: lo del principio de cada juego (js/juegos/amigos-*.js, datosIniciales)
export async function retarJuntos(juego, rival, nombreRival, fotoRival, datos = {}) {
  const { bd, fn, usuario } = acceso();
  const perfil = miPerfil() || {};
  const referencia = await fn.addDoc(fn.collection(bd, "juntos"), {
    juego,
    jugadores: [usuario.uid, rival],
    nombres: { [usuario.uid]: perfil.nombre || "", [rival]: nombreRival || "" },
    fotos: { [usuario.uid]: perfil.foto || "", [rival]: fotoRival || "" },
    estado: "reto",
    semilla: semillaNueva(),
    turno: "",
    datos,
    ganador: "",
    creado: Date.now(),
    actualizado: Date.now()
  });
  return referencia.id;
}

// Al aceptar empieza quien fue retado (turno), salvo que el juego diga otra cosa
export async function aceptarJuntos(id, cambios = {}) {
  const { bd, fn, usuario } = acceso();
  await fn.updateDoc(fn.doc(bd, "juntos", id), { estado: "jugando", turno: usuario.uid, actualizado: Date.now(), ...cambios });
}

// Cambia la partida: cambios con rutas de Firestore («datos.tachados.uid»...)
export async function cambiarJuntos(id, cambios) {
  const { bd, fn } = acceso();
  await fn.updateDoc(fn.doc(bd, "juntos", id), { ...cambios, actualizado: Date.now() });
}

// Lo mismo, leyendo antes lo que hay (para que dos navegadores no se pisen): hacer(partida) -> cambios | null
export async function cambiarJuntosSeguro(id, hacer) {
  const { bd, fn } = acceso();
  const referencia = fn.doc(bd, "juntos", id);
  return fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists()) return null;
    const cambios = hacer({ id, ...actual.data() });
    if (!cambios) return null;
    transaccion.update(referencia, { ...cambios, actualizado: Date.now() });
    return cambios;
  });
}

export async function terminarJuntos(id, ganador, cambios = {}) {
  return cambiarJuntosSeguro(id, (partida) => (partida.estado === "jugando" ? { ...cambios, estado: "fin", ganador } : null));
}

export async function borrarJuntos(id) {
  const { bd, fn } = acceso();
  // Lo que cuelga de ella primero (mientras la partida existe, que es lo que miran las reglas)
  for (const sub of ["secretos", "trazos"]) {
    try {
      const docs = await fn.getDocs(fn.collection(bd, "juntos", id, sub));
      await Promise.all(docs.docs.map((documento) => fn.deleteDoc(documento.ref)));
    } catch (error) {
      // (los secretos del otro no se pueden leer mientras se juega: se quedan; no molestan)
    }
  }
  await fn.deleteDoc(fn.doc(bd, "juntos", id));
}

// Al borrar la cuenta: todas las mías
export async function borrarMisJuntos() {
  await Promise.all(todas.map((partida) => borrarJuntos(partida.id).catch((error) => console.error(error))));
}

// Rendirse: gana el otro
export async function rendirseJuntos(id) {
  const { usuario } = acceso();
  const partida = partidaJuntos(id);
  if (!partida) return;
  await terminarJuntos(id, otroDe(partida, usuario.uid), { "datos.rendido": usuario.uid });
}

// ---------- Secretos ----------

export async function guardarSecreto(id, valor) {
  const { bd, fn, usuario } = acceso();
  await fn.setDoc(fn.doc(bd, "juntos", id, "secretos", usuario.uid), { valor: String(valor) });
}

// El mío (o el del otro, si ya ha terminado). null si no hay
export async function leerSecreto(id, uid) {
  const { bd, fn } = acceso();
  try {
    const documento = await fn.getDoc(fn.doc(bd, "juntos", id, "secretos", uid));
    return documento.exists() ? documento.data().valor : null;
  } catch (error) {
    return null;
  }
}

// ---------- Trazos (Dibuja ese Pokémon) ----------

export async function mandarTrazo(id, ronda, puntos) {
  const { bd, fn, usuario } = acceso();
  await fn.addDoc(fn.collection(bd, "juntos", id, "trazos"), { uid: usuario.uid, ronda, puntos, creado: Date.now() });
}

export function escucharTrazos(id, alLlegar) {
  const { bd, fn } = acceso();
  return fn.onSnapshot(fn.collection(bd, "juntos", id, "trazos"), (instantanea) => {
    alLlegar(instantanea.docs.map((documento) => documento.data()).sort((a, b) => a.creado - b.creado));
  }, (error) => console.error("No se pueden leer los trazos", error));
}

// ---------- Premio del día ----------
//
// La primera partida que gano cada día: una jugada «amigos» (si ya hay una hoy, las reglas no dejan otra y no
// pasa nada). Se intenta una vez por partida.

const COBRADAS = "nuzthelocke-juntos-premios";
const intentadas = new Set();
let premioOyente = null;

export function alCobrarPremio(funcion) {
  premioOyente = funcion;
}

function cobrarPremios() {
  const usuario = usuarioActual();
  if (!usuario || !miPerfil()) return;
  let cobradas = [];
  try {
    cobradas = JSON.parse(localStorage.getItem(COBRADAS) || "[]");
  } catch (error) {
    cobradas = [];
  }
  for (const partida of todas) {
    if (partida.estado !== "fin" || partida.ganador !== usuario.uid || intentadas.has(partida.id) || cobradas.includes(partida.id)) continue;
    intentadas.add(partida.id);
    guardarJugada("amigos", { puntos: PREMIO_DIA, intentos: 1, acierto: true })
      .then((resultado) => {
        if (resultado && premioOyente) premioOyente(partida.id, resultado.puntos);
      })
      .catch(() => {}) // ya cobrado hoy (o sin reglas): nada
      .finally(() => {
        try {
          localStorage.setItem(COBRADAS, JSON.stringify([...cobradas, partida.id].slice(-200)));
        } catch (error) {
          // sin sitio: se volverá a intentar (y las reglas dirán que no)
        }
      });
  }
}
