// ---------- Foro: datos ----------
//
// Igual que perfiles y lockes, esto no pasa por localStorage: un hilo es de todos y se lee y
// se escribe directamente en Firestore. La pantalla está en js/foro/index.js; las reglas (qué
// puede hacer cada uno) están en firestore.rules, en «Foro».
//
//   foro/{id}                    hilo: { uid, titulo, texto, categoria, juego, juegoOtro, tipo,
//                                        huecos, creado, ultimo, respuestas, cerrado, fijado }
//   foro/{id}/comentarios/{cid}  { uid, texto, creado }        (cid = «uid_N», ver abajo)
//   denuncias/{id}               { de, tipo, hilo, comentario, autor, motivo, nota, copia, creado }
//   moderadores/{uid}, silenciados/{uid}   (se apuntan a mano en la consola de Firebase)
//   ritmo/{uid}                  { cuando }: la hora de lo último que escribiste, para el freno
//
// Cosas que parecen raras y tienen su razón:
//
//   · Cada hilo o comentario nuevo se escribe en un lote junto a «ritmo/{uid}». Las reglas
//     exigen esa marca y no dejan ponerla otra vez hasta pasados 20 s: es lo único que frena el
//     spam sin un servidor propio.
//   · Comentar sube «respuestas» del hilo en 1 y crea el comentario con id «uid_N» (N = el nuevo
//     número de respuestas). Las reglas comprueban que van juntos; por eso se hace en una
//     transacción y por eso «respuestas» nunca baja, aunque se borre un comentario.
//   · Los hilos se piden por «ultimo» (el último comentario), sin filtrar por categoría en la
//     consulta: filtrar y ordenar por campos distintos pide un índice compuesto en la consola.
//     La categoría, el juego y la búsqueda se filtran en la pantalla.

import { usuarioActual, baseDeDatos } from "./nube.js";
import { t } from "./idioma.js";

// El «tipo» de hilo (en el código, categoría). No hay pestañas: se elige al crear el hilo.
export const CATEGORIAS = ["busco", "general", "ayuda"];
export const POR_PAGINA = 25;
export const MAX_TITULO = 100;
export const MAX_TEXTO = 2000;
export const MAX_COMENTARIO = 1000;
export const ESPERA_SEGUNDOS = 20;   // lo mismo que dicen las reglas

export const MOTIVOS = ["spam", "acoso", "ofensivo", "engano", "otro"];

// ---------- Utilidades ----------

function acceso() {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  if (!base || !usuario) throw new Error("sin-sesion");
  return { ...base, usuario };
}

// Los saltos de línea de más fuera, y sin espacios por los lados
export function limpiarTexto(texto) {
  return String(texto || "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// La hora que viene del servidor (null un instante, mientras se escribe) en milisegundos
function milisegundos(marca) {
  return marca && typeof marca.toMillis === "function" ? marca.toMillis() : Date.now();
}

function hiloLeido(documento) {
  const datos = documento.data({ serverTimestamps: "estimate" }) || {};
  return {
    id: documento.id,
    uid: datos.uid || "",
    titulo: datos.titulo || "",
    texto: datos.texto || "",
    categoria: CATEGORIAS.includes(datos.categoria) ? datos.categoria : "general",
    juego: datos.juego || "",
    juegoOtro: datos.juegoOtro || "",
    tipo: datos.tipo || "",
    huecos: datos.huecos || 0,
    creado: milisegundos(datos.creado),
    ultimo: milisegundos(datos.ultimo),
    respuestas: datos.respuestas || 0,
    cerrado: Boolean(datos.cerrado),
    fijado: Boolean(datos.fijado)
  };
}

function comentarioLeido(documento) {
  const datos = documento.data({ serverTimestamps: "estimate" }) || {};
  return { id: documento.id, uid: datos.uid || "", texto: datos.texto || "", creado: milisegundos(datos.creado) };
}

// Qué decirle a la persona cuando Firestore se niega a escribir. Pasa por tres motivos y no
// hay forma de distinguirlos desde aquí: te han silenciado, escribiste hace menos de 20 s, o las
// reglas nuevas no están publicadas. Se explica lo más probable.
export function explicarFallo(error, silenciado) {
  if (error && error.message === "hilo-borrado") return t("Ese hilo ya no existe.");
  if (error && error.code === "permission-denied") {
    if (silenciado) return t("Un moderador te ha silenciado: no puedes escribir en el foro.");
    return t("No se ha podido enviar. Si acabas de escribir algo, espera unos segundos y vuelve a probar.");
  }
  if (error && error.code === "unavailable") return t("Sin conexión con el servidor. Prueba de nuevo en un momento.");
  return t("No se ha podido enviar. Prueba de nuevo.");
}

// ---------- Freno local ----------
//
// El de verdad está en las reglas. Esto solo evita mandar algo que se sabe que van a rechazar.

let ultimaEscritura = 0;

export function segundosDeEspera() {
  return Math.max(0, Math.ceil(ESPERA_SEGUNDOS - (Date.now() - ultimaEscritura) / 1000));
}

// ---------- Hilos ----------

// Los hilos fijados (pocos) van aparte para que salgan siempre arriba, estén en la página que estén
// (del más antiguo al más nuevo: el primero es «el hilo principal» mientras el foro no está abierto)
export async function cargarFijados() {
  const { bd, fn } = acceso();
  const instantanea = await fn.getDocs(
    fn.query(fn.collection(bd, "foro"), fn.where("fijado", "==", true), fn.limit(10))
  );
  return instantanea.docs.map(hiloLeido).sort((a, b) => a.creado - b.creado);
}

// Una página de hilos, del que tiene la última respuesta más reciente al más viejo.
// «despues» es el cursor que devolvió la página anterior.
export async function cargarHilos(despues = null) {
  const { bd, fn } = acceso();
  const piezas = [fn.collection(bd, "foro"), fn.orderBy("ultimo", "desc")];
  if (despues) piezas.push(fn.startAfter(despues));
  piezas.push(fn.limit(POR_PAGINA));

  const instantanea = await fn.getDocs(fn.query(...piezas));
  const docs = instantanea.docs;
  return {
    hilos: docs.map(hiloLeido),
    cursor: docs.length ? docs[docs.length - 1] : despues,
    hayMas: docs.length === POR_PAGINA
  };
}

export async function cargarHilo(id) {
  const { bd, fn } = acceso();
  const documento = await fn.getDoc(fn.doc(bd, "foro", id));
  return documento.exists() ? hiloLeido(documento) : null;
}

// Un hilo en vivo mientras su ventana está abierta (si lo cierran o lo borran, se nota)
export function escucharHilo(id, alCambiar, alFallar) {
  const { bd, fn } = acceso();
  return fn.onSnapshot(
    fn.doc(bd, "foro", id),
    (documento) => alCambiar(documento.exists() ? hiloLeido(documento) : null),
    alFallar
  );
}

// Con «recientesPrimero» se escuchan los últimos «limite» comentarios, del más nuevo al más viejo
// (el hilo principal: con cientos de mensajes importan los de ahora). Si no, los primeros 300
// en orden de escritura (una conversación normal).
// «hayMas»: true si el hilo tiene más comentarios de los que se piden.
export function escucharComentarios(id, alCambiar, alFallar, { recientesPrimero = false, limite = 300 } = {}) {
  const { bd, fn } = acceso();
  return fn.onSnapshot(
    fn.query(
      fn.collection(bd, "foro", id, "comentarios"),
      fn.orderBy("creado", recientesPrimero ? "desc" : "asc"),
      fn.limit(limite)
    ),
    (instantanea) => alCambiar(instantanea.docs.map(comentarioLeido), instantanea.docs.length >= limite),
    alFallar
  );
}

// «datos»: { categoria, titulo, texto, juego, juegoOtro, tipo, huecos }
export async function crearHilo(datos) {
  const { bd, fn, usuario } = acceso();
  const ahora = fn.serverTimestamp();
  const referencia = fn.doc(fn.collection(bd, "foro"));

  const lote = fn.writeBatch(bd);
  lote.set(referencia, {
    uid: usuario.uid,
    titulo: limpiarTexto(datos.titulo).slice(0, MAX_TITULO),
    texto: limpiarTexto(datos.texto).slice(0, MAX_TEXTO),
    categoria: datos.categoria,
    juego: datos.juego || "",
    juegoOtro: (datos.juegoOtro || "").slice(0, 60),
    tipo: (datos.tipo || "").slice(0, 30),
    huecos: datos.huecos || 0,
    creado: ahora,
    ultimo: ahora,
    respuestas: 0,
    cerrado: false,
    ...(datos.fijado ? { fijado: true } : {})   // solo lo dejan poner los moderadores
  });
  lote.set(fn.doc(bd, "ritmo", usuario.uid), { cuando: ahora });
  await lote.commit();

  ultimaEscritura = Date.now();
  return referencia.id;
}

// Su autor cambia lo que escribió; «cambios» lleva solo lo que cambia. Las reglas piden el
// hilo entero bien formado, así que se vuelve a mandar lo que no cambia.
// «fijado» (hacerlo principal) solo se manda si va en «cambios», y solo lo aceptan las reglas
// si quien edita es moderador: quien no lo es no debe incluirlo.
export async function editarHilo(hilo, cambios) {
  const { bd, fn } = acceso();
  const nuevo = { ...hilo, ...cambios };
  await fn.updateDoc(fn.doc(bd, "foro", hilo.id), {
    ...("fijado" in cambios ? { fijado: Boolean(cambios.fijado) } : {}),
    titulo: limpiarTexto(nuevo.titulo).slice(0, MAX_TITULO),
    texto: limpiarTexto(nuevo.texto).slice(0, MAX_TEXTO),
    categoria: CATEGORIAS.includes(nuevo.categoria) ? nuevo.categoria : hilo.categoria,
    juego: nuevo.juego || "",
    juegoOtro: (nuevo.juegoOtro || "").slice(0, 60),
    tipo: (nuevo.tipo || "").slice(0, 30),
    huecos: nuevo.huecos || 0,
    cerrado: Boolean(nuevo.cerrado)
  });
}

export async function cerrarHilo(hilo, cerrado) {
  await editarHilo(hilo, { cerrado });
}

// Solo moderadores (las reglas lo comprueban)
export async function fijarHilo(id, fijado) {
  const { bd, fn } = acceso();
  await fn.updateDoc(fn.doc(bd, "foro", id), { fijado });
}

// Los comentarios se quedarían sin hilo si solo se borrara este, y Firestore no borra solo lo de
// dentro. Primero los comentarios, de 400 en 400, y el hilo el último: mientras exista, las
// reglas dejan al autor del hilo borrar los comentarios de los demás.
export async function borrarHilo(id) {
  const { bd, fn } = acceso();
  const instantanea = await fn.getDocs(fn.collection(bd, "foro", id, "comentarios"));
  for (let i = 0; i < instantanea.docs.length; i += 400) {
    const lote = fn.writeBatch(bd);
    for (const documento of instantanea.docs.slice(i, i + 400)) lote.delete(documento.ref);
    await lote.commit();
  }
  await fn.deleteDoc(fn.doc(bd, "foro", id));
}

// ---------- Comentarios ----------

export async function comentar(idHilo, texto) {
  const { bd, fn, usuario } = acceso();
  const referencia = fn.doc(bd, "foro", idHilo);
  const ahora = fn.serverTimestamp();

  // En una transacción: si otra persona comenta a la vez, el número de respuestas cambia y se
  // vuelve a intentar con el nuevo (el id del comentario depende de él)
  await fn.runTransaction(bd, async (transaccion) => {
    const hilo = await transaccion.get(referencia);
    if (!hilo.exists()) throw new Error("hilo-borrado");
    const numero = (hilo.data().respuestas || 0) + 1;

    transaccion.set(fn.doc(bd, "foro", idHilo, "comentarios", `${usuario.uid}_${numero}`), {
      uid: usuario.uid,
      texto: limpiarTexto(texto).slice(0, MAX_COMENTARIO),
      creado: ahora
    });
    transaccion.update(referencia, { respuestas: numero, ultimo: ahora });
    transaccion.set(fn.doc(bd, "ritmo", usuario.uid), { cuando: ahora });
  });

  ultimaEscritura = Date.now();
}

export async function borrarComentario(idHilo, idComentario) {
  const { bd, fn } = acceso();
  await fn.deleteDoc(fn.doc(bd, "foro", idHilo, "comentarios", idComentario));
}

// ---------- Denuncias ----------

// «datos»: { tipo: "hilo" | "comentario" | "usuario", hilo, comentario, autor, motivo, nota, copia }
// Devuelve false si ya la habías enviado (el id es el mismo y las reglas no dejan reescribirla)
export async function denunciar(datos) {
  const { bd, fn, usuario } = acceso();
  const objeto = datos.tipo === "usuario" ? datos.autor : [datos.hilo, datos.comentario].filter(Boolean).join("_");

  try {
    await fn.setDoc(fn.doc(bd, "denuncias", `${usuario.uid}_${objeto}`), {
      de: usuario.uid,
      tipo: datos.tipo,
      hilo: datos.hilo || "",
      comentario: datos.comentario || "",
      autor: datos.autor || "",
      motivo: datos.motivo,
      nota: limpiarTexto(datos.nota).slice(0, 300),
      copia: limpiarTexto(datos.copia).slice(0, 700),
      creado: fn.serverTimestamp()
    });
    return true;
  } catch (error) {
    if (error && error.code === "permission-denied") return false;
    throw error;
  }
}

// ---------- Moderación ----------

// moderadores/{uid} { rol: "admin" | "moderador", por, desde }. Los de rol «admin» (tú) se apuntan
// a mano en la consola y son los únicos que nombran y quitan moderadores. Un documento sin «rol»
// cuenta como moderador.
function rolDelDocumento(documento) {
  if (!documento.exists()) return null;
  return documento.data().rol === "admin" ? "admin" : "moderador";
}

let miRolDe = { uid: null, promesa: null };

// «admin», «moderador» o null. Se pregunta una vez por cuenta.
export function miRol() {
  const usuario = usuarioActual();
  const base = baseDeDatos();
  if (!usuario || !base) return Promise.resolve(null);
  if (miRolDe.uid !== usuario.uid) {
    miRolDe = {
      uid: usuario.uid,
      promesa: base.fn
        .getDoc(base.fn.doc(base.bd, "moderadores", usuario.uid))
        .then(rolDelDocumento)
        .catch(() => null)
    };
  }
  return miRolDe.promesa;
}

// El rol de otra persona (lo pueden mirar los moderadores)
export async function rolDe(uid) {
  const { bd, fn } = acceso();
  return rolDelDocumento(await fn.getDoc(fn.doc(bd, "moderadores", uid)));
}

export async function listarModeradores() {
  const { bd, fn } = acceso();
  const instantanea = await fn.getDocs(fn.collection(bd, "moderadores"));
  return instantanea.docs
    .map((documento) => ({ uid: documento.id, rol: rolDelDocumento(documento) }))
    .sort((a, b) => (a.rol === b.rol ? 0 : a.rol === "admin" ? -1 : 1));
}

// Solo el administrador (las reglas lo comprueban)
export async function nombrarModerador(uid) {
  const { bd, fn, usuario } = acceso();
  await fn.setDoc(fn.doc(bd, "moderadores", uid), { rol: "moderador", por: usuario.uid, desde: fn.serverTimestamp() });
}

export async function quitarModerador(uid) {
  const { bd, fn } = acceso();
  await fn.deleteDoc(fn.doc(bd, "moderadores", uid));
}

// null si no estás silenciado; si lo estás, { motivo }
export async function miSilencio() {
  const { bd, fn, usuario } = acceso();
  try {
    const documento = await fn.getDoc(fn.doc(bd, "silenciados", usuario.uid));
    return documento.exists() ? { motivo: documento.data().motivo || "" } : null;
  } catch (error) {
    return null;
  }
}

export async function cargarDenuncias() {
  const { bd, fn } = acceso();
  const instantanea = await fn.getDocs(
    fn.query(fn.collection(bd, "denuncias"), fn.orderBy("creado", "desc"), fn.limit(100))
  );
  return instantanea.docs.map((documento) => {
    const datos = documento.data({ serverTimestamps: "estimate" });
    return { id: documento.id, ...datos, creado: milisegundos(datos.creado) };
  });
}

export async function borrarDenuncias(ids) {
  const { bd, fn } = acceso();
  const lote = fn.writeBatch(bd);
  for (const id of ids) lote.delete(fn.doc(bd, "denuncias", id));
  await lote.commit();
}

export async function estaSilenciado(uid) {
  const { bd, fn } = acceso();
  const documento = await fn.getDoc(fn.doc(bd, "silenciados", uid));
  return documento.exists();
}

export async function silenciar(uid, motivo) {
  const { bd, fn, usuario } = acceso();
  await fn.setDoc(fn.doc(bd, "silenciados", uid), {
    desde: fn.serverTimestamp(),
    motivo: String(motivo || "").slice(0, 200),
    por: usuario.uid
  });
}

export async function quitarSilencio(uid) {
  const { bd, fn } = acceso();
  await fn.deleteDoc(fn.doc(bd, "silenciados", uid));
}

// ---------- Borrar la cuenta ----------

// Mis hilos (con sus comentarios), mis comentarios en los hilos de otros y mi marca de ritmo.
// Los comentarios se buscan en todos los hilos a la vez, y eso necesita un índice compuesto de
// «grupo de colección» sobre uid + creado (ver LEEME-nube.md): si falta, esos comentarios se quedan y se avisa en consola.
export async function borrarMiForo() {
  const { bd, fn, usuario } = acceso();

  const hilos = await fn.getDocs(fn.query(fn.collection(bd, "foro"), fn.where("uid", "==", usuario.uid)));
  for (const hilo of hilos.docs) await borrarHilo(hilo.id);

  try {
    const comentarios = await fn.getDocs(
      fn.query(fn.collectionGroup(bd, "comentarios"), fn.where("uid", "==", usuario.uid), fn.orderBy("creado", "asc"))
    );
    for (let i = 0; i < comentarios.docs.length; i += 400) {
      const lote = fn.writeBatch(bd);
      for (const documento of comentarios.docs.slice(i, i + 400)) lote.delete(documento.ref);
      await lote.commit();
    }
  } catch (error) {
    console.warn("No se han podido buscar mis comentarios del foro (¿falta el índice de grupo de colección?)", error);
  }

  await fn.deleteDoc(fn.doc(bd, "ritmo", usuario.uid)).catch(() => {});
}
