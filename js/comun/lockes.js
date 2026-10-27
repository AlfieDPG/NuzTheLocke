// ---------- Lockes compartidos (sección «Lockes») ----------
//
// Un locke es una partida entre varios: su marcador, sus vidas y quién acabó ganando.
// Vive entero en Firestore porque es un dato de dos personas a la vez; si cada navegador
// guardase su copia volvería el problema de quién pisa a quién.
//
// Está escuchado en vivo (onSnapshot): si tu rival quita una vida desde su móvil, a ti te
// cambia en pantalla al momento.
//
// Documento (lockes/{id}), reglas en firestore.rules:
//
//   { nombre, descripcion, tipo: {id,nombre,color}, juego, juegoOtro,
//     juegoPropio,                 // solo lockes de antes: copia de un «juego propio» (ver campo-juego.js)
//     jugadores: [uid],            // todos los metidos, invitados incluidos
//     estados: {uid: "aceptado"|"pendiente"},
//     nombres: {uid}, fotos: {uid}, creador,
//     vidasIniciales, vidasIlimitadas, vidas: {uid:n}, marcador: {uid:n},
//                                  // vidas -1 (ELIMINADO): perdió también la vida cero, está fuera
//     normas: { id, nombre, conGenerales, lista },  // copia del conjunto elegido (normas.js)
//     rutasPropias, capsPropios,   // copias de unas rutas / level caps personalizados (personalizados.js)
//     muertos: {uid: [muerto]},    // cementerio de cada uno (ver Cementerio, abajo)
//     reacciones: {idMuerto: {uid: emoji}},
//     combates, resultados, rom, salon,  // ver «Combates, ROM y salón de la fama»
//     arbitro,                     // qué normas vigila la web (js/partida/arbitro.js)
//     publico,                     // true: cualquiera con el enlace (seguir.html) lo mira, sin sesión
//     cadena,                      // si es una etapa de una cadena de lockes (ver Cadenas de lockes)
//     estado: "abierto"|"cerrado", ganador, fechaFin: "2025-06-01",
//     contado: [uid], creado, actualizado }
//
// Quién puede tocar qué (lo hacen cumplir las reglas, no solo la pantalla):
//   · tus vidas, tus victorias y tu estado: solo tú
//   · nombre, tipo, juego, ganador y cerrarlo: solo quien lo creó
//   · invitar: cualquiera de dentro
//
// Los nombres y las fotos se copian dentro del locke a propósito: así se pinta de una sola
// lectura y sigue saliendo bien aunque luego dejéis de ser amigos.
//
// «jugadores» lleva también a los invitados que no han contestado: si no, las reglas no les
// dejarían ni leer la invitación. Quién ha aceptado está en «estados».

import { usuarioActual, baseDeDatos, alCambiarSesion, cuandoEsteSincronizado } from "./nube.js";
import { apuntarLockesGanados, hayLockesSinApuntar, miPerfil, alCambiarMiPerfil, guardarMiPerfil } from "./perfiles.js";
import { borrarChatDeLocke, borrarMisMensajesDeLocke } from "./chat.js";
import { quitarConjuntosAjenos, normasDeLocke } from "./normas.js";
import { hoyComoTexto } from "./utilidades.js";
import { leer, escribir } from "./almacen.js";
import { JUEGOS } from "./juegos.js";
import { t } from "./idioma.js";

// «usum» -> «alola» ("" si no es un juego de la web)
function regionDe(idJuego) {
  const juego = JUEGOS.find((cada) => cada.id === idJuego);
  return juego ? juego.region : "";
}

let todos = [];
let delServidor = false; // la última lista llegó del servidor (no solo de la caché del navegador)
let dejarDeEscuchar = null;
let fallo = "";
const oyentes = new Set();

// ---------- Leer ----------

export function lockes() {
  return todos;
}

// La vida cero: con 0 vidas se sigue jugando; perder una más deja las vidas en -1, y eso es
// haber perdido el locke. Con el «+» se vuelve a 0 (por si fue sin querer).
export const ELIMINADO = -1;

export function estaEliminado(locke, uid) {
  return Boolean(locke) && !locke.vidasIlimitadas && ((locke.vidas || {})[uid] || 0) <= ELIMINADO;
}

// Los que ya has aceptado: los que se enseñan en «Lockes»
export function misLockes() {
  return todos.filter((locke) => miEstado(locke) === "aceptado");
}

// Los que te han propuesto y no has contestado
export function invitacionesALockes() {
  return todos.filter((locke) => miEstado(locke) === "pendiente");
}

export function miEstado(locke) {
  const usuario = usuarioActual();
  if (!usuario) return "";
  // Los lockes creados antes de que hubiera invitaciones no tienen «estados»
  return (locke.estados || {})[usuario.uid] || "aceptado";
}

export function estadoDe(locke, uid) {
  return (locke.estados || {})[uid] || "aceptado";
}

export function fallaLosLockes() {
  return fallo;
}

export function alCambiarLockes(funcion) {
  oyentes.add(funcion);
  funcion(todos);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(todos);
}

// ---------- Arranque ----------

export function iniciarLockes() {
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) {
      dejarDeEscuchar();
      dejarDeEscuchar = null;
    }

    todos = [];
    fallo = "";

    if (!usuario) {
      avisar();
      return;
    }

    escuchar(usuario);
  });

  alCambiarMiPerfil(ponerMiNombre);
}

// Cada locke guarda una copia del nombre y la foto de cada jugador. Si en alguno los míos no
// son los de mi perfil (me he cambiado el mote o la foto), los pongo al día.
// Se mira al llegar los lockes y al llegar mi perfil.
const renombrando = new Set(); // ids de lockes en los que ya se está escribiendo

function ponerMiNombre() {
  const usuario = usuarioActual();
  const perfil = miPerfil();
  const acceso = baseDeDatos();
  if (!usuario || !perfil || !perfil.mote || !acceso) return;

  const { bd, fn } = acceso;
  const foto = perfil.foto || "";
  for (const locke of todos) {
    const bien = (locke.nombres || {})[usuario.uid] === perfil.mote && ((locke.fotos || {})[usuario.uid] || "") === foto;
    if (bien || renombrando.has(locke.id)) continue;
    renombrando.add(locke.id);
    fn.updateDoc(fn.doc(bd, "lockes", locke.id), { [`nombres.${usuario.uid}`]: perfil.mote, [`fotos.${usuario.uid}`]: foto })
      .catch((error) => console.error("No se ha podido poner mi nombre en un locke", error))
      .finally(() => renombrando.delete(locke.id));
  }
}

// Las normas de cada uno son suyas: las de un locke de otro NO se copian en las tuyas (se ven
// desde el botón «Normas» del locke, que lee la copia que lleva el locke).
//
// Antes sí se copiaban, y las que llegaron así se quitan aquí, una sola vez por cuenta en cada
// navegador. Un conjunto se da por ajeno si lo usa un locke de otro y ninguno tuyo: el dueño
// siempre tiene el locke con el que lo compartió, así que el suyo no se toca. Después de
// juntar con la nube: ver cuandoEsteSincronizado.
const CLAVE_NORMAS_LIMPIAS = "poketeams-normas-ajenas-quitadas-v1"; // [uid]

function quitarNormasQueLlegaronDeOtros(usuario) {
  const hechas = leer(CLAVE_NORMAS_LIMPIAS, []);
  // Solo con la lista de verdad del servidor: la de la caché puede estar a medias
  if (hechas.includes(usuario.uid) || !delServidor) return;

  const idDe = (locke) => {
    const normas = normasDeLocke(locke);
    return normas && normas.id;
  };
  const mias = new Set(todos.filter((locke) => locke.creador === usuario.uid).map(idDe).filter(Boolean));
  const ajenas = todos
    .filter((locke) => locke.creador !== usuario.uid)
    .map(idDe)
    .filter((id) => id && !mias.has(id));
  quitarConjuntosAjenos(ajenas);
  escribir(CLAVE_NORMAS_LIMPIAS, [...hechas, usuario.uid]);
}

// Al cerrarse un locke tuyo, «Rutas» de su juego se queda limpio (lo marcado y lo capturado en
// cada sitio), salvo que tengas otro locke abierto del mismo juego. Cada locke, una sola vez por
// cuenta en cada navegador; los que ya estaban cerrados la primera vez no se tocan.
const CLAVE_RUTAS_LIMPIAS = "poketeams-rutas-limpias-v1"; // { uid: [idLocke] }
const CLAVE_RUTAS = "poketeams-rutas-v2"; // las de js/rutas/index.js
const CLAVE_CAPTURAS = "poketeams-capturas-v1"; // las de js/rutas/capturas.js

function limpiarRutasDeCerrados(usuario) {
  if (!delServidor) return;
  const hechas = leer(CLAVE_RUTAS_LIMPIAS, {}) || {};
  const mios = misLockes();
  const cerrados = mios.filter((locke) => locke.estado === "cerrado").map((locke) => locke.id);
  if (!hechas[usuario.uid]) {
    escribir(CLAVE_RUTAS_LIMPIAS, { ...hechas, [usuario.uid]: cerrados });
    return;
  }
  const nuevos = mios.filter((locke) => locke.estado === "cerrado" && !hechas[usuario.uid].includes(locke.id));
  if (!nuevos.length) return;

  const abiertos = new Set(mios.filter((locke) => locke.estado !== "cerrado" && !estaEliminado(locke, usuario.uid)).map((locke) => locke.juego));
  const marcadas = leer(CLAVE_RUTAS, {}) || {};
  const capturas = leer(CLAVE_CAPTURAS, {}) || {};
  for (const locke of nuevos) {
    if (!locke.juego || abiertos.has(locke.juego)) continue;
    delete marcadas[locke.juego];
    delete capturas[locke.juego];
  }
  escribir(CLAVE_RUTAS, marcadas);
  escribir(CLAVE_CAPTURAS, capturas);
  escribir(CLAVE_RUTAS_LIMPIAS, { ...hechas, [usuario.uid]: [...hechas[usuario.uid], ...nuevos.map((locke) => locke.id)] });
}

async function recibirNormasDeMisLockes() {
  await cuandoEsteSincronizado();
  const usuario = usuarioActual();
  if (!usuario) return;
  quitarNormasQueLlegaronDeOtros(usuario);

  // Las rutas y level caps personalizados de un locke solo llegan a los tuyos si los abres
  // desde su botón; aquí solo se ponen al día los que ya te llegaron. El módulo solo se
  // descarga si algún locke los lleva.
  const conPropios = misLockes().filter((locke) => locke.rutasPropias || locke.capsPropios);
  if (!conPropios.length) return;
  const { rutasPropias, capsPropios } = await import("./personalizados.js");
  for (const locke of conPropios) {
    if (locke.rutasPropias) rutasPropias.recibirDeLocke(locke.rutasPropias);
    if (locke.capsPropios) capsPropios.recibirDeLocke(locke.capsPropios);
  }
}

// Al cambiar tus rutas o level caps personalizados: los lockes que has creado con ellos se
// quedan con la copia nueva (y a los demás les llega por recibirNormasDeMisLockes).
// campo: "rutasPropias" o "capsPropios"
export async function actualizarPersonalizadoEnMisLockes(campo, copia) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;
  await Promise.all(
    todos
      .filter((locke) => locke.creador === usuario.uid && locke[campo] && locke[campo].id === copia.id)
      .filter((locke) => locke[campo].actualizado !== copia.actualizado)
      .map((locke) => fn.updateDoc(fn.doc(bd, "lockes", locke.id), { [campo]: copia, actualizado: Date.now() }))
  );
}

function escuchar(usuario) {
  const { bd, fn } = baseDeDatos();

  // includeMetadataChanges: avisa también cuando lo de la caché queda confirmado por el
  // servidor aunque no cambie nada (hace falta para delServidor; no cuesta lecturas)
  dejarDeEscuchar = fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes"), fn.where("jugadores", "array-contains", usuario.uid)),
    { includeMetadataChanges: true },
    (instantanea) => {
      fallo = "";
      delServidor = !instantanea.metadata.fromCache;
      todos = instantanea.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
      avisar();

      // Si alguien ha cerrado un locke en el que juego, lo apunto yo en mi perfil (ganado o
      // perdido). Se mira aquí antes de llamar para no lanzar una consulta en cada clic del marcador.
      if (hayLockesSinApuntar(todos)) apuntarLockesGanados().catch((error) => console.error(error));

      ponerMiNombre();
      recibirNormasDeMisLockes();
      // Después de juntar con la nube, para que lo de la nube no lo vuelva a traer
      cuandoEsteSincronizado()
        .then(() => usuarioActual() && limpiarRutasDeCerrados(usuarioActual()))
        .catch((error) => console.error(error));
    },
    (error) => {
      console.error("No se han podido leer los lockes", error);
      fallo =
        error.code === "permission-denied"
          ? t("Firebase no deja leer los lockes. Falta publicar las reglas de Firestore.")
          : t("No se han podido cargar los lockes.");
      avisar();
    }
  );
}

// ---------- Escribir ----------

function referencia(id) {
  const { bd, fn } = baseDeDatos();
  return { fn, ref: fn.doc(bd, "lockes", id) };
}

export function lockePorId(id) {
  return todos.find((locke) => locke.id === id) || null;
}

// «invitados» puede venir vacío: un locke para ti solo es perfectamente válido, y luego
// siempre se puede meter gente.
// Los combates del locke a partir de sus nombres (uno por combate; "" = sin nombre). Los que
// ya había conservan su id, y con él su resultado.
function combatesNuevos(nombres, anteriores = []) {
  return (nombres || []).map((nombre, i) => ({
    id: (anteriores[i] && anteriores[i].id) || `c${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 5)}`,
    nombre: String(nombre || "").trim().slice(0, 30)
  }));
}

export async function crearLocke({
  nombre, descripcion, tipo, juego, juegoOtro, vidas, vidasIlimitadas, normas, rutasPropias, capsPropios, randomizer,
  arbitro, publico, cadena, combates, invitados, nombres, fotos,
  vidasPorJugador, aceptados = []
}) {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();

  const jugadores = [usuario.uid, ...invitados];
  const estados = { [usuario.uid]: "aceptado" };
  const porJugador = { vidas: {}, marcador: {} };

  // aceptados: los que ya están dentro de antes (los de una cadena) y no tienen que volver a aceptar
  for (const uid of invitados) estados[uid] = aceptados.includes(uid) ? "aceptado" : "pendiente";
  for (const uid of jugadores) {
    // vidasPorJugador: con otras vidas que las de partida (la siguiente etapa de una cadena)
    porJugador.vidas[uid] = vidasPorJugador && uid in vidasPorJugador ? vidasPorJugador[uid] : vidasIlimitadas ? 0 : vidas;
    porJugador.marcador[uid] = 0;
  }

  const nuevo = await fn.addDoc(fn.collection(bd, "lockes"), {
    nombre,
    descripcion: descripcion || "",
    tipo,
    juego: juego || "",
    juegoOtro: juegoOtro || "",
    juegoPropio: null,
    jugadores,
    estados,
    nombres,
    fotos,
    creador: usuario.uid,
    vidasIniciales: vidasIlimitadas ? 0 : vidas,
    vidasIlimitadas: Boolean(vidasIlimitadas),
    vidas: porJugador.vidas,
    marcador: porJugador.marcador,
    normas: normas || null,
    rutasPropias: rutasPropias || null,
    capsPropios: capsPropios || null,
    randomizer: randomizer || null,
    arbitro: arbitro || null,
    publico: Boolean(publico),
    cadena: cadena || null,
    combates: combatesNuevos(combates),
    resultados: {},
    rom: {},
    estado: "abierto",
    ganador: "",
    fechaFin: "",
    contado: [],
    creado: Date.now(),
    actualizado: Date.now()
  });
  await apuntarSuceso(nuevo.id, "creado");
}

// Solo tus propias vidas y victorias: las de los demás las cambia cada uno desde su cuenta
// (y las reglas de Firestore rechazarían lo contrario).
export async function cambiarNumero(id, uid, campo, cuanto) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || locke.estado === "cerrado" || !usuario || uid !== usuario.uid) return;

  const vidas = campo === "vidas" && !locke.vidasIlimitadas;
  const actual = (locke[campo] || {})[uid] || 0;
  const nuevo = Math.max(vidas ? ELIMINADO : 0, Math.min(999, actual + cuanto));
  if (nuevo === actual) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, { [`${campo}.${uid}`]: nuevo, actualizado: Date.now() });
  // Entrar o salir de la vida cero se apunta aparte: «X ha perdido el locke»
  const tipo = !vidas ? "victoria" : Math.min(actual, nuevo) === ELIMINADO ? "eliminado" : "vida";
  await apuntarCambio(id, tipo, Math.sign(cuanto));
}

// Solo quien creó el locke lo cierra, con su ganador o sin ninguno (uid vacío: nadie se pasó
// la ROM). Se apunta el día, que luego sale en la ficha.
export async function elegirGanador(id, uid) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.creador !== usuario.uid) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    estado: "cerrado",
    ganador: uid || "",
    fechaFin: hoyComoTexto(),
    actualizado: Date.now()
  });
  await apuntarSuceso(id, "ganador", { ganador: uid || "" });
  if (uid) await apuntarLockesGanados();
}

// ---------- Cadenas de lockes ----------
//
// Varios lockes seguidos, uno por etapa (un juego por etapa, por ejemplo), pasando de una a la
// siguiente las vidas y unos cuantos Pokémon. Cada etapa es un locke de los de siempre; lo que
// las junta es locke.cadena, una copia en cada etapa (como las normas):
//
//   cadena: { id, nombre, etapa (1, 2...), total (las que se piensan hacer; 0 = sin decir),
//             vidasExtra (las que suma pasarse la ROM de una etapa), pasan (cuántos Pokémon
//             pasan a la siguiente, de 0 a 6) }
//
// Cada grupo se monta la suya: los números los pone quien crea la primera etapa y se pueden
// cambiar en la última. Al terminar una etapa, quien creó la cadena crea la siguiente con
// «Siguiente etapa»: empiezan los que no están eliminados (y no tienen que volver a aceptar),
// cada uno con las vidas que le quedaban más las extra si se pasó la ROM, y los Pokémon que
// marcó en su equipo final como «pasan» (salon[uid].pasan: posiciones de su equipo).

export function nuevoIdCadena() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Las etapas de una cadena, de la primera a la última
export function etapasDeCadena(idCadena, lockes = todos) {
  return lockes
    .filter((locke) => locke.cadena && locke.cadena.id === idCadena)
    .sort((uno, otro) => uno.cadena.etapa - otro.cadena.etapa);
}

// Quién sigue en la cadena tras esta etapa: los que han aceptado y no están eliminados
export function siguenEnLaCadena(locke) {
  return (locke.jugadores || []).filter((uid) => estadoDe(locke, uid) === "aceptado" && !estaEliminado(locke, uid));
}

// Con cuántas vidas empieza cada uno la siguiente etapa: { uid: { quedan, suma, total } }
export function vidasDeLaSiguienteEtapa(locke) {
  const extra = (locke.cadena && locke.cadena.vidasExtra) || 0;
  return Object.fromEntries(
    siguenEnLaCadena(locke).map((uid) => {
      const quedan = Math.max(0, (locke.vidas || {})[uid] || 0);
      const suma = seHaPasadoLaRom(locke, uid) ? extra : 0;
      return [uid, { quedan, suma, total: quedan + suma }];
    })
  );
}

// Los Pokémon que pasan a la siguiente etapa: { uid: [pokemon] }, los que marcó en su equipo
// final (hasta los que deje pasar la cadena)
export function pokemonQuePasan(locke) {
  const limite = (locke.cadena && locke.cadena.pasan) || 0;
  const salida = {};
  for (const uid of siguenEnLaCadena(locke)) {
    const salon = (locke.salon || {})[uid];
    if (!salon) continue;
    const pokemon = (salon.pasan || []).filter((i) => (salon.pokemon || [])[i]).slice(0, limite).map((i) => salon.pokemon[i]);
    if (pokemon.length) salida[uid] = pokemon;
  }
  return salida;
}

// Si esta etapa ya está terminada y hay una siguiente que hacer
export function hayEtapaSiguiente(locke) {
  const cadena = locke && locke.cadena;
  return Boolean(cadena) && locke.estado === "cerrado" && siguenEnLaCadena(locke).length > 0 && (!cadena.total || cadena.etapa < cadena.total);
}

// Crea la siguiente etapa (solo quien creó la cadena)
export async function crearSiguienteEtapa(idPrevio, { nombre, juego, juegoOtro }) {
  const previo = lockePorId(idPrevio);
  const usuario = usuarioActual();
  if (!previo || !usuario || previo.creador !== usuario.uid || !hayEtapaSiguiente(previo)) return;

  const siguen = siguenEnLaCadena(previo);
  if (!siguen.includes(usuario.uid)) return;
  const vidas = vidasDeLaSiguienteEtapa(previo);
  const porJugador = Object.fromEntries(siguen.map((uid) => [uid, vidas[uid].total]));
  const invitados = siguen.filter((uid) => uid !== usuario.uid);

  await crearLocke({
    nombre,
    descripcion: previo.descripcion,
    tipo: previo.tipo,
    juego,
    juegoOtro,
    vidas: Math.max(0, ...Object.values(porJugador)),
    vidasIlimitadas: previo.vidasIlimitadas,
    vidasPorJugador: porJugador,
    normas: previo.normas,
    arbitro: previo.arbitro,
    publico: previo.publico,
    combates: combatesDe(previo).map((combate) => combate.nombre),
    invitados,
    aceptados: invitados,
    nombres: Object.fromEntries(siguen.map((uid) => [uid, (previo.nombres || {})[uid] || ""])),
    fotos: Object.fromEntries(siguen.map((uid) => [uid, (previo.fotos || {})[uid] || ""])),
    cadena: { ...previo.cadena, etapa: previo.cadena.etapa + 1 }
  });
}

// ---------- Combates, ROM y salón de la fama ----------
//
//   combates: [{ id, nombre }]   // los que tendrá el locke (los pone quien lo crea; el nombre,
//                                // opcional: «Tras la 3ª medalla», «Liga»...)
//   resultados: { idCombate: { ganador: uid, marcador: "2-1" } }  // los apunta cualquiera de dentro
//   equipos: { uid: { idCombate: { nombre, pokemon } } }  // con qué equipo jugó cada uno cada combate
//   rom: { uid: true }           // se ha pasado la ROM (cada uno la suya)
//   salon: { uid: { nombre, pokemon, mvp } }   // equipo final y MVP, ya con el locke cerrado
//
// Quién gana el locke (ganadorPropuesto): para ganar hay que pasarse la ROM. Si no se la pasa
// nadie, no gana nadie; si solo uno, ese, vaya como vaya en los combates; si varios, el que
// más combates ha ganado (o más victorias, en los lockes sin combates). Si empatan, lo decide
// quien lo creó.

export function combatesDe(locke) {
  return (locke && Array.isArray(locke.combates) && locke.combates) || [];
}

export function nombreCombate(locke, idCombate) {
  const posicion = combatesDe(locke).findIndex((combate) => combate.id === idCombate);
  const combate = combatesDe(locke)[posicion];
  return (combate && combate.nombre) || t("Combate {n}", { n: posicion + 1 });
}

// Victorias de alguien: con combates, los que ha ganado; sin ellos, las que se ha sumado
export function victoriasDe(locke, uid) {
  const combates = combatesDe(locke);
  if (!combates.length) return (locke.marcador || {})[uid] || 0;
  const resultados = locke.resultados || {};
  return combates.filter((combate) => (resultados[combate.id] || {}).ganador === uid).length;
}

export function seHaPasadoLaRom(locke, uid) {
  return Boolean((locke.rom || {})[uid]);
}

// Las medallas de alguien: { tiene: [índices, en el orden de la partida], version } (ver
// js/comun/medallas.js). La versión, para las que cambian con ella (Espada / Escudo).
export function medallasDe(locke, uid) {
  const m = (locke.medallas || {})[uid];
  return { tiene: (m && m.tiene) || [], version: (m && m.version) || "" };
}

// { ganadores: [uid] } (uno, varios si empatan o ninguno)
export function ganadorPropuesto(locke) {
  const pasados = (locke.jugadores || []).filter(
    (uid) => estadoDe(locke, uid) === "aceptado" && seHaPasadoLaRom(locke, uid) && !estaEliminado(locke, uid)
  );
  if (pasados.length <= 1) return { ganadores: pasados };
  const mejor = Math.max(...pasados.map((uid) => victoriasDe(locke, uid)));
  return { ganadores: pasados.filter((uid) => victoriasDe(locke, uid) === mejor) };
}

// Sin ganador: se borra el resultado
// puntos: { uid: combates que ha ganado cada uno } (con más de dos jugadores no vale un «2-1»)
export async function apuntarResultado(id, idCombate, ganador, marcador, puntos = null) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado === "cerrado") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`resultados.${idCombate}`]: ganador
      ? { ganador, marcador: marcador || "", ...(puntos ? { puntos } : {}) }
      : fn.deleteField(),
    actualizado: Date.now()
  });
  if (ganador) {
    const detalle = `${nombreCombate(locke, idCombate)}${marcador ? ` (${marcador})` : ""}`;
    await apuntarSuceso(id, "combate", { ganador, detalle });
  }
}

// El equipo con el que juegas un combate (cada uno pone el suyo): equipos: { uid: { idCombate:
// { nombre, pokemon } } }. equipo null: se quita.
export function equipoDeCombate(locke, uid, idCombate) {
  return ((locke.equipos || {})[uid] || {})[idCombate] || null;
}

export async function guardarEquipoCombate(id, idCombate, equipo) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado === "cerrado") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`equipos.${usuario.uid}.${idCombate}`]: equipo || fn.deleteField(),
    actualizado: Date.now()
  });
}

// Las tuyas, enteras (las de la partida o las marcadas a mano en la tarjeta)
export async function cambiarMedallas(id, tiene, version = "") {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado === "cerrado") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`medallas.${usuario.uid}`]: { tiene: [...new Set(tiene)].sort((a, b) => a - b), version },
    actualizado: Date.now()
  });
}

export async function cambiarRom(id, pasada) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado === "cerrado") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`rom.${usuario.uid}`]: pasada ? true : fn.deleteField(),
    actualizado: Date.now()
  });
  await apuntarCambio(id, "rom", pasada ? 1 : -1);
}

// Tu equipo final y tu MVP (posición en el equipo, o -1) de un locke ya cerrado. Va en el
// locke (lo ven los que jugaron) y una copia en tu perfil (tu salón de la fama, que ven tus
// amigos). equipo null: se quita.
const MAX_SALON = 50;

// pasan: posiciones del equipo que pasan a la siguiente etapa de una cadena
export async function guardarSalon(id, equipo, mvp = -1, pasan = []) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado !== "cerrado") return;

  const entrada = equipo ? { nombre: equipo.nombre || "", pokemon: equipo.pokemon, mvp, ...(pasan.length ? { pasan } : {}) } : null;
  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, { [`salon.${usuario.uid}`]: entrada || fn.deleteField(), actualizado: Date.now() });

  const salon = ((miPerfil() || {}).salon || []).filter((cada) => cada.id !== id);
  if (entrada) {
    salon.unshift({
      id,
      locke: locke.nombre,
      tipo: locke.tipo || null,
      fechaFin: locke.fechaFin || "",
      gano: locke.ganador === usuario.uid,
      nombre: entrada.nombre,
      pokemon: entrada.pokemon,
      mvp: entrada.mvp
    });
  }
  await guardarMiPerfil({ salon: salon.slice(0, MAX_SALON) });
}

// ---------- Reacciones en el cementerio ----------
//
//   reacciones: { idMuerto: { uid: "💀" } }   // una por persona; la misma otra vez la quita

export const REACCIONES = ["🙏", "💀", "😭", "😂", "🫡"];

export async function reaccionar(id, idMuerto, reaccion) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || !REACCIONES.includes(reaccion)) return;

  const actual = ((locke.reacciones || {})[idMuerto] || {})[usuario.uid];
  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`reacciones.${idMuerto}.${usuario.uid}`]: actual === reaccion ? fn.deleteField() : reaccion
  });
}

// ---------- Lo que pasa en Rutas y Level caps ----------
//
// Al marcar un lugar en «Rutas» o un combate en «Level caps», se apunta en la actividad de tus
// lockes abiertos de ese juego: «Alfie ha capturado en la Ruta 3», «Alfie ha vencido a Brock».
// Sin decir qué Pokémon: en un randomlocke eso no lo tiene que saber el rival. Si lo desmarcas
// enseguida (sin querer), se borra.
//   campoPropio: "rutasPropias" o "capsPropios" · tipo: "ruta" o "cap"

export async function apuntarEnLockesDelJuego(campoPropio, idJuego, tipo, detalle, marcado) {
  const usuario = usuarioActual();
  if (!usuario || !baseDeDatos()) return;

  // Vale tanto su lista propia (si la lleva) como el juego de la web: un locke de Alola con
  // unas rutas propias sigue siendo de Alola si marcas en las de la web. Si no hay ninguno de
  // ese juego exacto, uno de la misma región: Sol / Luna y Ultrasol / Ultraluna comparten casi
  // todo, y es fácil tener abierto en «Rutas» el otro.
  const abiertos = misLockes().filter((locke) => locke.estado !== "cerrado" && !estaEliminado(locke, usuario.uid));
  const exactos = abiertos.filter((locke) => {
    const propio = locke[campoPropio];
    return (propio && propio.id === idJuego) || locke.juego === idJuego;
  });
  const region = regionDe(idJuego);
  const delJuego = exactos.length ? exactos : abiertos.filter((locke) => region && regionDe(locke.juego) === region);

  await Promise.all(
    delJuego.map(async (locke) => {
      const ultimo = ultimoSuceso.get(locke.id);
      if (!marcado) {
        if (ultimo && ultimo.tipo === tipo && ultimo.detalle === detalle && Date.now() - ultimo.cuando < PARA_DESHACER) {
          ultimoSuceso.delete(locke.id);
          const { fn } = baseDeDatos();
          await fn.deleteDoc(ultimo.referencia).catch((error) => console.error(error));
        }
        return;
      }
      await apuntarSuceso(locke.id, tipo, { detalle });
    })
  );
}

// ---------- Cementerio ----------
//
// Los muertos de cada uno van en el propio locke, como sus vidas: muertos: { uid: [muerto] }.
// Cada uno solo toca su lista (lo comprueban las reglas).
//
//   muerto: { id, especie (número de la Pokédex), nombre (de la especie, con su forma), mote,
//             idForma?, formaPMD?, imagenForma? (si es una forma: para su retrato), fecha }
//   Los de antes pueden llevar «causa» (contra quién): ya no se pregunta, pero se sigue enseñando.

function nuevoIdMuerto() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function muertosDe(locke, uid) {
  return ((locke && locke.muertos) || {})[uid] || [];
}

// quitarVida: además se resta una vida (lo normal al darle a «−» en las vidas). Y a la
// actividad, como un solo suceso: «X ha perdido una vida: Charizard».
export async function apuntarMuerto(id, muerto, quitarVida) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;

  const nuevo = {
    id: nuevoIdMuerto(),
    especie: muerto.especie,
    nombre: muerto.nombre,
    ...(muerto.en ? { en: muerto.en } : {}), // en inglés (ver nombreMuerto en js/versus/cementerio.js)
    mote: muerto.mote || "",
    ...formaDelMuerto(muerto),
    fecha: Date.now()
  };
  const cambios = {
    [`muertos.${usuario.uid}`]: [...muertosDe(locke, usuario.uid), nuevo],
    actualizado: Date.now()
  };
  const vidas = (locke.vidas || {})[usuario.uid] || 0;
  const restaVida = quitarVida && !locke.vidasIlimitadas && vidas > ELIMINADO;
  if (restaVida) cambios[`vidas.${usuario.uid}`] = vidas - 1;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, cambios);

  const { especie, nombre, mote } = nuevo;
  const en = nuevo.en ? { en: nuevo.en } : {};
  const tipo = !restaVida ? "muerte" : vidas - 1 === ELIMINADO ? "eliminado" : "vida";
  await apuntarSuceso(id, tipo, {
    ...(restaVida ? { delta: -1 } : {}),
    muerto: { especie, nombre, ...en, mote, ...formaDelMuerto(nuevo) }
  });
}

// Si es una forma (Alola, Mega...), lo que hace falta para su retrato. Solo lo que haya:
// Firestore no acepta «undefined».
function formaDelMuerto(muerto) {
  const forma = {};
  for (const campo of ["idForma", "formaPMD", "imagenForma"]) {
    if (muerto[campo] !== undefined && muerto[campo] !== null) forma[campo] = muerto[campo];
  }
  return forma;
}

// Por si se apuntó mal. No devuelve la vida: eso se hace con el «+».
export async function borrarMuerto(id, idMuerto) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`muertos.${usuario.uid}`]: muertosDe(locke, usuario.uid).filter((muerto) => muerto.id !== idMuerto),
    actualizado: Date.now()
  });
}

// Cambia de sitio tus muertos: ids en el orden nuevo (del primero al último). Si alguno no
// está en la lista (se ha borrado entretanto), se queda donde estaba, al final.
export async function reordenarMuertos(id, ids) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;

  const muertos = muertosDe(locke, usuario.uid);
  const posicion = new Map(ids.map((idMuerto, i) => [idMuerto, i]));
  const ordenados = [...muertos].sort(
    (uno, otro) => (posicion.get(uno.id) ?? Infinity) - (posicion.get(otro.id) ?? Infinity)
  );
  if (ordenados.every((muerto, i) => muerto === muertos[i])) return; // no ha cambiado nada

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, { [`muertos.${usuario.uid}`]: ordenados, actualizado: Date.now() });
}

// ---------- Actividad ----------
//
// Lo que va pasando en un locke, para verlo en orden: lockes/{id}/actividad/{suceso}.
// Cada uno apunta solo lo suyo. Los nombres no se copian: se leen de locke.nombres al pintar.
//
//   { uid, tipo, cuando (hora del servidor), delta?, muerto?, ganador?, detalle?,
//     reacciones?: { uid: "💀" } }   (las ponen los demás, ver «reaccionarASuceso»)
//   tipo: "creado" | "entra" | "vida" | "eliminado" (la vida cero) | "victoria" | "muerte" |
//         "ganador" | "combate" | "rom" | "ruta" | "cap" | "edicion" (editar la partida vinculada) |
//         "infraccion" (la ve el árbitro de normas, ver js/partida/arbitro.js: detalle «regla|datos»)
//
// Si apuntar falla (p. ej. faltan reglas por publicar), lo de verdad ya está hecho: solo se
// avisa en la consola.

const ultimoSuceso = new Map(); // id del locke -> { referencia, tipo, delta, cuando }

export async function apuntarSuceso(idLocke, tipo, datos = {}) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;

  try {
    const referencia = await fn.addDoc(fn.collection(bd, "lockes", idLocke, "actividad"), {
      uid: usuario.uid,
      tipo,
      ...datos,
      cuando: fn.serverTimestamp()
    });
    ultimoSuceso.set(idLocke, {
      referencia, tipo, delta: datos.delta || 0, muerto: Boolean(datos.muerto), detalle: datos.detalle || "", cuando: Date.now()
    });
  } catch (error) {
    console.error("No se ha podido apuntar en la actividad", error);
  }
}

// Quitar un suceso tuyo de la actividad (el aviso del árbitro que se ha equivocado)
export async function retirarSuceso(idLocke, idSuceso) {
  const acceso = baseDeDatos();
  if (!acceso) return;
  const { bd, fn } = acceso;
  await fn.deleteDoc(fn.doc(bd, "lockes", idLocke, "actividad", idSuceso));
}

// Reaccionar a un suceso de la actividad: una por persona, y la misma otra vez la quita.
// «actual» es la reacción que ya tenías puesta (la ventana la tiene a mano).
export async function reaccionarASuceso(idLocke, idSuceso, reaccion, actual) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso || !REACCIONES.includes(reaccion)) return;
  const { bd, fn } = acceso;
  await fn.updateDoc(fn.doc(bd, "lockes", idLocke, "actividad", idSuceso), {
    [`reacciones.${usuario.uid}`]: actual === reaccion ? fn.deleteField() : reaccion
  });
}

// Un +1 o −1 de vidas o victorias. Si deshace lo último que hiciste hace nada (le diste sin
// querer), en vez de apuntar otro se borra aquel: así la actividad no se llena de idas y vueltas.
const PARA_DESHACER = 60 * 1000;

async function apuntarCambio(idLocke, tipo, delta) {
  const ultimo = ultimoSuceso.get(idLocke);
  const deshace =
    ultimo && ultimo.tipo === tipo && ultimo.delta === -delta && !ultimo.muerto &&
    Date.now() - ultimo.cuando < PARA_DESHACER;

  if (!deshace) {
    await apuntarSuceso(idLocke, tipo, { delta });
    return;
  }

  ultimoSuceso.delete(idLocke);
  const { fn } = baseDeDatos();
  await fn.deleteDoc(ultimo.referencia).catch((error) => console.error(error));
}

// Los últimos sucesos de un locke, en vivo, del más nuevo al más viejo. Devuelve la función
// para dejar de escuchar (se escucha solo mientras está abierta la ventana).
export function escucharActividad(idLocke, alLlegar, cuantos = 60) {
  const { bd, fn } = baseDeDatos();
  return fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes", idLocke, "actividad"), fn.orderBy("cuando", "desc"), fn.limit(cuantos)),
    (instantanea) => {
      alLlegar(
        instantanea.docs.map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return { id: documento.id, ...datos, cuando: datos.cuando ? datos.cuando.toMillis() : Date.now() };
        })
      );
    },
    (error) => {
      console.error("No se ha podido leer la actividad", error);
      alLlegar(null);
    }
  );
}

// Todo lo que ha pasado en un locke, del más viejo al más nuevo (para la crónica, js/versus/cronica.js).
// null si no se ha podido leer.
export async function leerActividad(idLocke, maximo = 1000) {
  const acceso = baseDeDatos();
  if (!acceso) return null;
  const { bd, fn } = acceso;
  try {
    const instantanea = await fn.getDocs(
      fn.query(fn.collection(bd, "lockes", idLocke, "actividad"), fn.orderBy("cuando", "asc"), fn.limit(maximo))
    );
    return instantanea.docs.map((documento) => {
      const datos = documento.data();
      return { id: documento.id, ...datos, cuando: datos.cuando ? datos.cuando.toMillis() : Date.now() };
    });
  } catch (error) {
    console.error("No se ha podido leer la actividad", error);
    return null;
  }
}

// Los avisos del árbitro de un locke, en vivo, para la campana (js/avisos.js). Sin «orderBy» a
// propósito: un «where» con otro orden pide un índice propio en Firestore. Quien los recibe los
// ordena. Devuelve la función para dejar de escuchar.
export function escucharInfracciones(idLocke, alLlegar) {
  const acceso = baseDeDatos();
  if (!acceso) return () => {};
  const { bd, fn } = acceso;
  return fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes", idLocke, "actividad"), fn.where("tipo", "==", "infraccion"), fn.limit(100)),
    (instantanea) => {
      alLlegar(
        instantanea.docs.map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return { id: documento.id, uid: datos.uid, detalle: datos.detalle || "", cuando: datos.cuando ? datos.cuando.toMillis() : Date.now() };
        })
      );
    },
    (error) => {
      console.error("No se han podido leer los avisos del árbitro", error);
      alLlegar([]);
    }
  );
}

// El enlace para seguir un locke público (seguir.html, junto a la página de la web)
export function enlaceParaSeguir(id) {
  return new URL(`seguir.html?c=${encodeURIComponent(id)}`, location.href).href;
}

export function soyCreador(locke) {
  const usuario = usuarioActual();
  return Boolean(usuario && locke && locke.creador === usuario.uid);
}

// Mete a más gente en un locke que ya está en marcha. Entran como «pendiente», con las
// mismas vidas con las que empezó el locke y el marcador a 0, y les llega al buzón.
// «vidasDePartida»: solo si se acaban de cambiar en la misma ventana y el locke que tenemos
// en memoria todavía no lo refleja.
export async function invitarALocke(id, perfiles, vidasDePartida) {
  const locke = lockePorId(id);
  if (!locke || locke.estado === "cerrado" || !perfiles.length) return;

  const { fn, ref } = referencia(id);
  const vidas =
    vidasDePartida !== undefined ? vidasDePartida : locke.vidasIlimitadas ? 0 : locke.vidasIniciales || 0;

  const cambios = {
    jugadores: fn.arrayUnion(...perfiles.map((perfil) => perfil.uid)),
    actualizado: Date.now()
  };

  for (const perfil of perfiles) {
    cambios[`estados.${perfil.uid}`] = "pendiente";
    cambios[`nombres.${perfil.uid}`] = perfil.nombre;
    cambios[`fotos.${perfil.uid}`] = perfil.foto || "";
    cambios[`vidas.${perfil.uid}`] = vidas;
    cambios[`marcador.${perfil.uid}`] = 0;
  }

  await fn.updateDoc(ref, cambios);
}

// Firestore no borra solo lo que cuelga de un documento: la actividad se borra antes, a mano
// (mientras el locke existe, que es lo que miran las reglas para dejar)
export async function borrarLocke(id) {
  const { fn, ref } = referencia(id);
  const { bd } = baseDeDatos();
  try {
    const sucesos = await fn.getDocs(fn.collection(bd, "lockes", id, "actividad"));
    await Promise.all(sucesos.docs.map((suceso) => fn.deleteDoc(suceso.ref)));
  } catch (error) {
    console.error("No se ha podido borrar la actividad del locke", error);
  }
  // Su chat (mensajes y marcas de ritmo), por lo mismo
  await borrarChatDeLocke(id).catch((error) => console.error("No se ha podido borrar el chat del locke", error));
  await fn.deleteDoc(ref);
}

// Al entrar, tus vidas son las que tenga el locke AHORA: el creador puede haberlas cambiado
// desde que te invitó (mientras nadie más haya empezado a jugar).
export async function aceptarLocke(id) {
  const usuario = usuarioActual();
  const locke = lockePorId(id);
  const { fn, ref } = referencia(id);

  const cambios = {
    [`estados.${usuario.uid}`]: "aceptado",
    actualizado: Date.now()
  };
  if (locke) cambios[`vidas.${usuario.uid}`] = locke.vidasIlimitadas ? 0 : locke.vidasIniciales || 0;

  await fn.updateDoc(ref, cambios);
  await apuntarSuceso(id, "entra");
}

// Las vidas de partida solo se pueden cambiar mientras nadie más haya aceptado: después ya
// hay gente jugando con las suyas, y sus vidas solo las toca cada uno.
export function sePuedenCambiarVidas(locke) {
  const usuario = usuarioActual();
  return (locke.jugadores || []).every(
    (uid) => uid === usuario.uid || estadoDe(locke, uid) === "pendiente"
  );
}

// Solo quien lo creó. Cambia los datos del principio (nombre, tipo, juego, descripción,
// normas y, si todavía se puede, las vidas); las suyas propias se ponen a las nuevas de
// partida. Las normas se pueden cambiar siempre, también con el locke ya terminado.
export async function editarLocke(id, datos) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.creador !== usuario.uid) return;

  const cambios = {
    nombre: datos.nombre,
    descripcion: datos.descripcion || "",
    tipo: datos.tipo,
    juego: datos.juego || "",
    juegoOtro: datos.juegoOtro || "",
    // Un locke de antes con un juego propio lo conserva mientras no se cambie de juego
    juegoPropio: locke.juegoPropio && locke.juegoPropio.id === datos.juego ? locke.juegoPropio : null,
    normas: datos.normas || null,
    rutasPropias: datos.rutasPropias || null,
    capsPropios: datos.capsPropios || null,
    randomizer: datos.randomizer || null,
    arbitro: datos.arbitro || null,
    publico: Boolean(datos.publico),
    cadena: datos.cadena || null,
    actualizado: Date.now()
  };
  // Con el locke cerrado los combates ya no se tocan (el resultado ya está)
  if (datos.combates && locke.estado !== "cerrado") cambios.combates = combatesNuevos(datos.combates, combatesDe(locke));

  const vidasCambian =
    Boolean(datos.vidasIlimitadas) !== Boolean(locke.vidasIlimitadas) ||
    (!datos.vidasIlimitadas && datos.vidas !== locke.vidasIniciales);

  if (vidasCambian && sePuedenCambiarVidas(locke)) {
    cambios.vidasIlimitadas = Boolean(datos.vidasIlimitadas);
    cambios.vidasIniciales = datos.vidasIlimitadas ? 0 : datos.vidas;
    cambios[`vidas.${usuario.uid}`] = cambios.vidasIniciales;
  }

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, cambios);
}

// Rechazar es salirse: se quita el uid de «jugadores» y, en cuanto deja de estar, el
// documento ya no aparece en tu consulta ni te deja leerlo (así lo dicen las reglas).
// Echar a alguien del locke: quien lo creó, a cualquiera menos a sí mismo; los demás, solo a
// quien todavía no ha contestado. «quitado» va en la misma escritura para que las reglas
// sepan a quién se quita y lo comprueben. Al salir de «jugadores» deja de ver el locke, y con
// él su notificación.
export async function quitarDeLocke(id, uid) {
  const locke = lockePorId(id);
  if (!locke || uid === locke.creador || locke.estado === "cerrado") return;
  if (!soyCreador(locke) && estadoDe(locke, uid) !== "pendiente") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    jugadores: fn.arrayRemove(uid),
    quitado: uid,
    [`estados.${uid}`]: fn.deleteField(),
    [`vidas.${uid}`]: fn.deleteField(),
    [`marcador.${uid}`]: fn.deleteField(),
    [`muertos.${uid}`]: fn.deleteField(),
    [`rom.${uid}`]: fn.deleteField(),
    actualizado: Date.now()
  });
}

// Al borrar la cuenta: de cada locke se sale uno con todo lo suyo (nombre y foto incluidos).
// Los que creó y en los que no queda nadie más que haya aceptado, se borran enteros.
export async function salirDeTodosMisLockes() {
  const usuario = usuarioActual();
  if (!usuario) return;

  await Promise.all(
    todos.map((locke) => {
      const quedanOtros = (locke.jugadores || []).some(
        (uid) => uid !== usuario.uid && estadoDe(locke, uid) === "aceptado"
      );
      if (locke.creador === usuario.uid && !quedanOtros) return borrarLocke(locke.id);

      const { fn, ref } = referencia(locke.id);
      // Mis mensajes del chat del locke, antes de salir (si falla, que no impida borrar la cuenta)
      return borrarMisMensajesDeLocke(locke.id).catch((error) => console.error(error)).then(() => fn.updateDoc(ref, {
        jugadores: fn.arrayRemove(usuario.uid),
        [`estados.${usuario.uid}`]: fn.deleteField(),
        [`vidas.${usuario.uid}`]: fn.deleteField(),
        [`marcador.${usuario.uid}`]: fn.deleteField(),
        [`nombres.${usuario.uid}`]: fn.deleteField(),
        [`fotos.${usuario.uid}`]: fn.deleteField(),
        [`muertos.${usuario.uid}`]: fn.deleteField(),
        [`rom.${usuario.uid}`]: fn.deleteField(),
        [`salon.${usuario.uid}`]: fn.deleteField(),
        actualizado: Date.now()
      }));
    })
  );
}

export async function rechazarLocke(id) {
  const usuario = usuarioActual();
  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    jugadores: fn.arrayRemove(usuario.uid),
    [`estados.${usuario.uid}`]: fn.deleteField(),
    [`vidas.${usuario.uid}`]: fn.deleteField(),
    [`marcador.${usuario.uid}`]: fn.deleteField(),
    actualizado: Date.now()
  });
}
