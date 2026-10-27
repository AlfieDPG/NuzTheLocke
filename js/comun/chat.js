// ---------- Chat entre amigos: datos ----------
//
// Igual que perfiles, lockes y foro, esto no pasa por localStorage: se lee y se escribe directamente
// en Firestore. La pantalla está en js/chat.js; las reglas (quién puede qué) están en
// firestore.rules, en «Chat».
//
//   chats/{par}                  { miembros, enviado: {uid: hora}, leido: {uid: hora} }
//                                par = el mismo id que la amistad (los dos uid ordenados)
//   chats/{par}/mensajes/{id}    { uid, texto, creado, expira }
//   bloqueos/{por}_{a}           { por, a, desde }: «por» no quiere que «a» le pida amistad
//
// Cosas que parecen raras y tienen su razón:
//
//   · Solo se chatea con amigos. Las reglas miran que la amistad esté aceptada.
//   · Los mensajes llevan «expira» (a los 90 días). La pantalla ya no enseña los caducados, y se
//     borran del servidor desde la propia web: al abrir una conversación y, una vez por sesión,
//     en todos mis chats (borrarCaducados). No se usa una política TTL de Firestore porque pide
//     el plan de pago (Blaze). Un chat que nadie abra conserva los caducados en el servidor
//     hasta que alguno de los dos vuelva a entrar, pero nadie puede verlos. El documento del
//     chat NO guarda texto de ningún mensaje (si no, esa copia no caducaría).
//   · «enviado» y «leido» son mapas {uid: hora}. Hay mensajes sin leer cuando lo último que
//     envió el otro es posterior a lo último que leí yo. Enviar y leer no necesitan servidor.
//   · «enviado» también es el freno contra el spam: las reglas no dejan una hora nueva hasta 1 s
//     después de la anterior de esa persona.
//   · Quitar a un amigo vacía el chat (borrarAmistad en perfiles.js), y bloquear a alguien
//     también: bloquear = quitar la amistad + apuntar «bloqueos», que las reglas miran al pedir
//     una amistad nueva.

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { amigosAceptados, amistades, borrarAmistad, borrarChat, idAmistad, alCambiarAmistades } from "./perfiles.js";
import { limpiarTexto } from "./foro.js";

export const MAX_MENSAJE = 1000;
export const DIAS_CADUCA = 90;       // las reglas aceptan entre 60 y 120
export const MENSAJES_VISIBLES = 60;
const ESPERA_MS = 1100;              // las reglas piden 1 s entre dos mensajes de la misma persona

// ---------- Utilidades ----------

function acceso() {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  if (!base || !usuario) throw new Error("sin-sesion");
  return { ...base, usuario };
}

// La hora que viene del servidor (null un instante, mientras se escribe) en milisegundos
function milisegundos(marca) {
  return marca && typeof marca.toMillis === "function" ? marca.toMillis() : Date.now();
}

function mapaDeHoras(mapa) {
  const salida = {};
  for (const [uid, marca] of Object.entries(mapa || {})) salida[uid] = milisegundos(marca);
  return salida;
}

// ---------- Mis chats, en vivo ----------

let chatsPorOtro = new Map();   // uid del otro -> { id, otro, enviado, leido }
let dejarDeEscuchar = null;
const oyentes = new Set();

function avisar() {
  barrerCaducados();
  for (const funcion of oyentes) funcion();
}

// Una vez por sesión y chat se quitan del servidor los mensajes caducados. Solo con amigos de
// ahora (las reglas no dejan leer el resto) y en cuanto la lista de amigos ya ha llegado.
let barridos = new Set();

function barrerCaducados() {
  const amigos = new Set(amigosAceptados().map((amistad) => amistad.otro));
  for (const otro of chatsPorOtro.keys()) {
    if (barridos.has(otro) || !amigos.has(otro)) continue;
    barridos.add(otro);
    borrarCaducados(otro).catch((error) => console.error("No se han podido quitar los mensajes caducados", error));
  }
}

// Avisa ahora y cada vez que cambian mis chats, mis amigos o mis bloqueos
export function alCambiarChats(funcion) {
  oyentes.add(funcion);
  funcion();
  return () => oyentes.delete(funcion);
}

// ¿Tengo algo sin leer de este chat? Solo cuentan los de amigos de ahora
function sinLeerEn(chat, yo) {
  if (!amigosAceptados().some((amistad) => amistad.otro === chat.otro)) return false;
  return (chat.enviado[chat.otro] || 0) > (chat.leido[yo] || 0);
}

// Los uid de los amigos que me han escrito y aún no he leído, el más reciente primero
export function chatsSinLeer() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return [...chatsPorOtro.values()]
    .filter((chat) => sinLeerEn(chat, usuario.uid))
    .sort((a, b) => (b.enviado[b.otro] || 0) - (a.enviado[a.otro] || 0))
    .map((chat) => chat.otro);
}

export function haySinLeer(uid) {
  const usuario = usuarioActual();
  const chat = chatsPorOtro.get(uid);
  return Boolean(usuario && chat && sinLeerEn(chat, usuario.uid));
}

// Cuándo se escribió lo último en ese chat (de cualquiera), o 0 si no hay
export function ultimoMensajeEn(uid) {
  const chat = chatsPorOtro.get(uid);
  return chat ? Math.max(0, ...Object.values(chat.enviado)) : 0;
}

// ---------- Mis bloqueos, en vivo ----------

let bloqueadosPorUid = new Set();
let dejarDeEscucharBloqueos = null;

export function estaBloqueado(uid) {
  return bloqueadosPorUid.has(uid);
}

export function misBloqueados() {
  return [...bloqueadosPorUid];
}

// ---------- Arranque ----------

export function iniciarChats() {
  alCambiarAmistades(avisar);

  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    if (dejarDeEscucharBloqueos) dejarDeEscucharBloqueos();
    dejarDeEscuchar = null;
    dejarDeEscucharBloqueos = null;
    chatsPorOtro = new Map();
    bloqueadosPorUid = new Set();
    barridos = new Set();
    avisar();

    const base = baseDeDatos();
    if (!usuario || !base) return;
    const { bd, fn } = base;

    dejarDeEscuchar = fn.onSnapshot(
      fn.query(fn.collection(bd, "chats"), fn.where("miembros", "array-contains", usuario.uid)),
      (instantanea) => {
        chatsPorOtro = new Map();
        for (const documento of instantanea.docs) {
          const datos = documento.data({ serverTimestamps: "estimate" });
          const otro = (datos.miembros || []).find((uid) => uid !== usuario.uid);
          if (!otro) continue;
          chatsPorOtro.set(otro, {
            id: documento.id,
            otro,
            enviado: mapaDeHoras(datos.enviado),
            leido: mapaDeHoras(datos.leido)
          });
        }
        avisar();
      },
      (error) => console.error("No se han podido leer los chats", error)
    );

    dejarDeEscucharBloqueos = fn.onSnapshot(
      fn.query(fn.collection(bd, "bloqueos"), fn.where("por", "==", usuario.uid)),
      (instantanea) => {
        bloqueadosPorUid = new Set(instantanea.docs.map((documento) => documento.data().a));
        avisar();
      },
      (error) => console.error("No se han podido leer los bloqueos", error)
    );
  });
}

// ---------- Mensajes ----------

function mensajeLeido(documento) {
  const datos = documento.data({ serverTimestamps: "estimate" }) || {};
  return {
    id: documento.id,
    uid: datos.uid || "",
    texto: datos.texto || "",
    creado: milisegundos(datos.creado),
    expira: milisegundos(datos.expira),
    enviando: documento.metadata.hasPendingWrites
  };
}

// Los últimos MENSAJES_VISIBLES de la conversación con ese amigo, del más viejo al más nuevo y
// sin los que ya han caducado (el servidor los borra de verdad un tiempo después).
// «hayMas»: true si hay más de los que se piden.
export function escucharMensajes(otro, alCambiar, alFallar) {
  const { bd, fn, usuario } = acceso();
  const par = idAmistad(usuario.uid, otro);
  borrarCaducados(otro).catch((error) => console.error("No se han podido quitar los mensajes caducados", error));
  return fn.onSnapshot(
    fn.query(
      fn.collection(bd, "chats", par, "mensajes"),
      fn.orderBy("creado", "desc"),
      fn.limit(MENSAJES_VISIBLES)
    ),
    (instantanea) => {
      const ahora = Date.now();
      alCambiar(
        instantanea.docs.map(mensajeLeido).filter((mensaje) => mensaje.expira > ahora).reverse(),
        instantanea.docs.length >= MENSAJES_VISIBLES
      );
    },
    alFallar
  );
}

// Quita del servidor los mensajes de esa conversación cuya fecha «expira» ya ha pasado (hasta
// 400 de golpe; si hubiera más, caerán la próxima vez). Las reglas dejan borrar a los dos.
export async function borrarCaducados(otro) {
  const { bd, fn, usuario } = acceso();
  const instantanea = await fn.getDocs(
    fn.query(
      fn.collection(bd, "chats", idAmistad(usuario.uid, otro), "mensajes"),
      fn.where("expira", "<=", fn.Timestamp.now()),
      fn.limit(400)
    )
  );
  if (instantanea.empty) return;
  const lote = fn.writeBatch(bd);
  for (const documento of instantanea.docs) lote.delete(documento.ref);
  await lote.commit();
}

let ultimoEnvio = 0;

// Crea el mensaje y apunta en el chat la hora de lo enviado, todo en un lote (las reglas piden
// que vayan juntos). Si se escribe más deprisa que un mensaje por segundo, espera lo que falte.
export async function enviarMensaje(otro, texto) {
  const { bd, fn, usuario } = acceso();
  const limpio = limpiarTexto(texto).slice(0, MAX_MENSAJE);
  if (!limpio) return;

  const falta = ultimoEnvio + ESPERA_MS - Date.now();
  if (falta > 0) await new Promise((resolver) => setTimeout(resolver, falta));
  ultimoEnvio = Date.now();

  const par = idAmistad(usuario.uid, otro);
  const ahora = fn.serverTimestamp();
  const lote = fn.writeBatch(bd);
  lote.set(
    fn.doc(bd, "chats", par),
    { miembros: [usuario.uid, otro].sort(), enviado: { [usuario.uid]: ahora }, leido: { [usuario.uid]: ahora } },
    { merge: true }
  );
  lote.set(fn.doc(fn.collection(bd, "chats", par, "mensajes")), {
    uid: usuario.uid,
    texto: limpio,
    creado: ahora,
    expira: fn.Timestamp.fromMillis(Date.now() + DIAS_CADUCA * 86400000)
  });
  await lote.commit();
}

// ---------- Chat de un locke ----------
//
// Los que juegan un locke (y ya lo han aceptado) tienen un chat común: lockes/{id}/mensajes. Mismo
// formato y misma caducidad que el de amigos. El freno de 1 s va en lockes/{id}/ritmoChat/{uid}, que
// va en el mismo lote que cada mensaje. Sin avisos de «sin leer»: se abre desde el locke.

export function escucharMensajesLocke(id, alCambiar, alFallar) {
  const { bd, fn } = acceso();
  borrarCaducadosLocke(id).catch((error) => console.error("No se han podido quitar los mensajes caducados", error));
  return fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes", id, "mensajes"), fn.orderBy("creado", "desc"), fn.limit(MENSAJES_VISIBLES)),
    (instantanea) => {
      const ahora = Date.now();
      alCambiar(
        instantanea.docs.map(mensajeLeido).filter((mensaje) => mensaje.expira > ahora).reverse(),
        instantanea.docs.length >= MENSAJES_VISIBLES
      );
    },
    alFallar
  );
}

// Los caducados de ese locke (los puede borrar cualquiera de los que juegan)
export async function borrarCaducadosLocke(id) {
  const { bd, fn } = acceso();
  const instantanea = await fn.getDocs(
    fn.query(fn.collection(bd, "lockes", id, "mensajes"), fn.where("expira", "<=", fn.Timestamp.now()), fn.limit(400))
  );
  if (instantanea.empty) return;
  const lote = fn.writeBatch(bd);
  for (const documento of instantanea.docs) lote.delete(documento.ref);
  await lote.commit();
}

export async function enviarMensajeLocke(id, texto) {
  const { bd, fn, usuario } = acceso();
  const limpio = limpiarTexto(texto).slice(0, MAX_MENSAJE);
  if (!limpio) return;

  const falta = ultimoEnvio + ESPERA_MS - Date.now();
  if (falta > 0) await new Promise((resolver) => setTimeout(resolver, falta));
  ultimoEnvio = Date.now();

  const lote = fn.writeBatch(bd);
  lote.set(fn.doc(bd, "lockes", id, "ritmoChat", usuario.uid), { cuando: fn.serverTimestamp() });
  lote.set(fn.doc(fn.collection(bd, "lockes", id, "mensajes")), {
    uid: usuario.uid,
    texto: limpio,
    creado: fn.serverTimestamp(),
    expira: fn.Timestamp.fromMillis(Date.now() + DIAS_CADUCA * 86400000)
  });
  await lote.commit();
}

// Cada uno borra los suyos; quien creó el locke, cualquiera
export async function borrarMensajeLocke(id, idMensaje) {
  const { bd, fn } = acceso();
  await fn.deleteDoc(fn.doc(bd, "lockes", id, "mensajes", idMensaje));
}

// Mis mensajes en el chat de ese locke, para borrarlos antes de salir de él (después, las reglas
// ya no dejan: hay que seguir jugando en él). Lo usa borrar la cuenta (lockes.js).
export async function borrarMisMensajesDeLocke(id) {
  const { bd, fn, usuario } = acceso();
  const instantanea = await fn.getDocs(
    fn.query(fn.collection(bd, "lockes", id, "mensajes"), fn.where("uid", "==", usuario.uid), fn.limit(400))
  );
  if (instantanea.empty) return;
  const lote = fn.writeBatch(bd);
  for (const documento of instantanea.docs) lote.delete(documento.ref);
  await lote.commit();
}

// Al borrar un locke (lockes.js): Firestore no borra lo de dentro, y las reglas solo dejan
// mientras el locke existe
export async function borrarChatDeLocke(id) {
  const { bd, fn } = acceso();
  for (const subcoleccion of ["mensajes", "ritmoChat"]) {
    const instantanea = await fn.getDocs(fn.collection(bd, "lockes", id, subcoleccion));
    for (let i = 0; i < instantanea.docs.length; i += 400) {
      const lote = fn.writeBatch(bd);
      for (const documento of instantanea.docs.slice(i, i + 400)) lote.delete(documento.ref);
      await lote.commit();
    }
  }
}

// Apunta que he leído lo último (solo si había algo sin leer: así no se escribe de más)
export async function marcarLeido(otro) {
  const { bd, fn, usuario } = acceso();
  if (!haySinLeer(otro)) return;
  const par = idAmistad(usuario.uid, otro);
  await fn.updateDoc(fn.doc(bd, "chats", par), { [`leido.${usuario.uid}`]: fn.serverTimestamp() });
}

// Quita todos los mensajes de la conversación, para los dos
export async function vaciarConversacion(otro) {
  const { usuario } = acceso();
  await borrarChat(idAmistad(usuario.uid, otro));
}

// Un mensaje solo, el que he escrito yo o el que me han escrito
export async function borrarMensaje(otro, id) {
  const { bd, fn, usuario } = acceso();
  await fn.deleteDoc(fn.doc(bd, "chats", idAmistad(usuario.uid, otro), "mensajes", id));
}

// ---------- Bloquear ----------

// Quita la amistad (y con ella el chat) y apunta el bloqueo: esa persona ya no puede pedirme
// amistad otra vez hasta que lo quite
export async function bloquear(otro) {
  const { bd, fn, usuario } = acceso();
  const amistad = amistades().find((cada) => cada.otro === otro);
  if (amistad) await borrarAmistad(amistad.id);
  await fn.setDoc(fn.doc(bd, "bloqueos", `${usuario.uid}_${otro}`), {
    por: usuario.uid,
    a: otro,
    desde: fn.serverTimestamp()
  });
}

export async function desbloquear(otro) {
  const { bd, fn, usuario } = acceso();
  await fn.deleteDoc(fn.doc(bd, "bloqueos", `${usuario.uid}_${otro}`));
}

// ---------- Borrar la cuenta ----------

// Mis bloqueos. Los chats se borran con las amistades (borrarMisAmistades en perfiles.js).
export async function borrarMisBloqueos() {
  const { bd, fn, usuario } = acceso();
  if (!bloqueadosPorUid.size) return;
  const lote = fn.writeBatch(bd);
  for (const otro of bloqueadosPorUid) lote.delete(fn.doc(bd, "bloqueos", `${usuario.uid}_${otro}`));
  await lote.commit();
}
