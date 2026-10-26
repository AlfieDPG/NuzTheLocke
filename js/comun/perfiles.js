// ---------- Perfiles, amistades y palmarés ----------
//
// Esto NO pasa por localStorage. Los equipos, las rutas y los level caps son tuyos y la
// nube solo guarda una copia (ver almacen.js y nube.js). Un amigo o un locke compartido,
// en cambio, es un dato de dos personas: si cada navegador se guardase su copia volvería
// el problema de quién pisa a quién. Así que se lee y se escribe directamente en Firestore.
//
// Colecciones (las reglas están en firestore.rules):
//
//   perfiles/{uid}   { nombre, foto, mote, tipos, ganados, avatar, fotoGoogle, escaparate, logros }
//                    (logros: { idLogro: fecha }, los apunta js/comun/logros.js)
//   motes/{mote}     { uid, mote }  (el id va en minúsculas: así no hay dos iguales)
//   amistades/{par}  { miembros: [uidA, uidB], estado, pidio, creado }
//   estadisticas/usuarios  { total }  (cuántos perfiles hay; ver «Cuántos usuarios hay»)
//
//   · El correo NO va en el perfil ni se puede buscar por él: los perfiles los puede leer
//     cualquiera con sesión. Tampoco el nombre ni la foto de Google, salvo que la persona
//     elija usar su foto (fotoGoogle).
//
//   · mote:    nombre único elegido por la persona. Si lo tiene, «nombre» es el mote.
//   · avatar:  número de Pokédex si ha elegido un Pokémon de foto. Entonces «foto» es su
//              retrato y la de Google ya no la pisa.
//   · escaparate: equipos que enseña en su perfil (copias, ver js/perfil.js).
//
//   · tipos:   los tipos de locke que usa esa persona, editables.
//              [{ id, nombre, color }]
//   · ganados: su palmarés entero. Cada entrada se queda con una COPIA del tipo, no con
//              una referencia, para que renombrar un tipo no reescriba la historia.
//              [{ id, nombre, tipo: { id, nombre, color }, nota }]

import { usuarioActual, baseDeDatos, alCambiarSesion, nombreDeUsuario, recordarNombreDeCuenta } from "./nube.js";
import { t } from "./idioma.js";
import { leer, escribir } from "./almacen.js";

// Con lo que empieza una cuenta nueva: solo el locke normal. Cada uno puede renombrarlo,
// cambiarle el color o añadir los suyos (Megalocke, Bebelocke... son inventos de cada grupo).
//
// Ojo: esto solo vale para perfiles NUEVOS. Los que ya existían guardaron su lista al
// crearse y la conservan.
export const TIPOS_POR_DEFECTO = [
  { id: "locke", nombre: "Locke", color: "#3498db" }
];

// El color con el que se pinta un tipo de locke (el de por defecto si no tiene uno válido)
export function colorDeTipo(tipo) {
  const color = String((tipo && tipo.color) || "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : TIPOS_POR_DEFECTO[0].color;
}

const PERFIL_VACIO = { nombre: t("Jugador"), foto: "", tipos: [], ganados: [] };

// Un perfil tal como lo enseña la web. Si tiene mote, su nombre ES el mote, ponga lo que
// ponga en «nombre» (que puede haberse quedado con el de Google: ver asegurarPerfil).
function perfilLeido(uid, datos) {
  const perfil = { uid, ...PERFIL_VACIO, ...(datos || {}) };
  if (perfil.mote) perfil.nombre = perfil.mote;
  return perfil;
}

let mio = null;              // mi perfil, siempre al día (hay un onSnapshot encima)
let perfilAsegurado = Promise.resolve(); // lo que hace asegurarPerfil al entrar
let dejarDeEscuchar = null;
let falloPerfil = "";        // por qué no ha cargado, para poder decirlo en pantalla
const oyentes = new Set();

// Mis amistades, también en vivo: así en cuanto alguien te acepta te sale sin recargar
let listaAmistades = [];
let dejarDeEscucharAmistades = null;
let errorAmistades = "";
const oyentesAmistades = new Set();

// Los perfiles de la gente con la que tengo amistad (o solicitud), también en vivo: si un
// amigo gana un locke o se cambia el mote, su ficha cambia sin recargar.
const perfilesAmigos = new Map();   // uid -> perfil
const escuchasAmigos = new Map();   // uid -> función para dejar de escuchar
const oyentesPerfilesAmigos = new Set();

// ---------- Avisos ----------

export function miPerfil() {
  return mio;
}

export function fallaElPerfil() {
  return falloPerfil;
}

// Mientras el perfil no llega (o si Firestore no deja leerlo) se tira de lo que da Google,
// para que la web pueda seguir enseñando cosas en vez de quedarse muda.
export function miPerfilOProvisional() {
  if (mio) return mio;

  const usuario = usuarioActual();
  if (!usuario) return null;

  return { uid: usuario.uid, ...PERFIL_VACIO, ...datosDeLaCuenta(usuario), tipos: TIPOS_POR_DEFECTO };
}

function explicar(error, queCosa) {
  return error && error.code === "permission-denied"
    ? t("Firebase no deja leer {que}. Falta publicar las reglas de Firestore.", { que: t(queCosa) })
    : t("No se ha podido cargar {que}.", { que: t(queCosa) });
}

// Avisa cada vez que cambia mi perfil, incluido el primer momento. Devuelve una función
// para darse de baja.
export function alCambiarMiPerfil(funcion) {
  oyentes.add(funcion);
  funcion(mio);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(mio);
}

// ---------- Avisos de las amistades ----------

export function amistades() {
  return listaAmistades;
}

export function amigosAceptados() {
  return listaAmistades.filter((amistad) => amistad.estado === "ok");
}

// Las que te han mandado a ti y aún no has contestado
export function solicitudesRecibidas() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return listaAmistades.filter(
    (amistad) => amistad.estado === "pendiente" && amistad.pidio !== usuario.uid
  );
}

export function solicitudesEnviadas() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return listaAmistades.filter(
    (amistad) => amistad.estado === "pendiente" && amistad.pidio === usuario.uid
  );
}

export function fallaLasAmistades() {
  return errorAmistades;
}

export function alCambiarAmistades(funcion) {
  oyentesAmistades.add(funcion);
  funcion(listaAmistades);
  return () => oyentesAmistades.delete(funcion);
}

function avisarAmistades() {
  for (const funcion of oyentesAmistades) funcion(listaAmistades);
}

// ---------- Perfiles de los amigos, en vivo ----------

// uid -> perfil de los que ya han llegado (los que faltan, aún no)
export function perfilesDeAmigos() {
  return perfilesAmigos;
}

export function alCambiarPerfilesAmigos(funcion) {
  oyentesPerfilesAmigos.add(funcion);
  funcion(perfilesAmigos);
  return () => oyentesPerfilesAmigos.delete(funcion);
}

function avisarPerfilesAmigos() {
  for (const funcion of oyentesPerfilesAmigos) funcion(perfilesAmigos);
}

// Se escucha a quien haya entrado en la lista de amistades y se deja de escuchar a quien
// haya salido
function escucharPerfilesAmigos() {
  const acceso = baseDeDatos();
  const quedan = new Set(listaAmistades.map((amistad) => amistad.otro));

  for (const [uid, dejar] of escuchasAmigos) {
    if (quedan.has(uid)) continue;
    dejar();
    escuchasAmigos.delete(uid);
    perfilesAmigos.delete(uid);
  }

  if (!acceso) return;
  const { bd, fn } = acceso;

  for (const uid of quedan) {
    if (escuchasAmigos.has(uid)) continue;
    escuchasAmigos.set(
      uid,
      fn.onSnapshot(
        fn.doc(bd, "perfiles", uid),
        (documento) => {
          perfilesAmigos.set(uid, perfilLeido(uid, documento.data()));
          avisarPerfilesAmigos();
        },
        (error) => console.error("No se ha podido leer el perfil de un amigo", error)
      )
    );
  }

  avisarPerfilesAmigos();
}

function dejarDeEscucharPerfilesAmigos() {
  for (const dejar of escuchasAmigos.values()) dejar();
  escuchasAmigos.clear();
  perfilesAmigos.clear();
  avisarPerfilesAmigos();
}

// ---------- Utilidades ----------

// El id del documento de amistad: los dos uid ordenados. Da igual quién lo cree.
export function idAmistad(unUid, otroUid) {
  return [unUid, otroUid].sort().join("_");
}

// Los tipos de un perfil, con los de siempre como red de seguridad
export function tiposDe(perfil) {
  const tipos = perfil && perfil.tipos;
  return tipos && tipos.length ? tipos : TIPOS_POR_DEFECTO;
}

// Los tipos que hay que enseñar en una ficha: los suyos, más los que aparezcan en el
// palmarés y ya no estén en su lista (lockes ganados con un tipo que luego borró).
export function tiposParaFicha(perfil) {
  const tipos = tiposDe(perfil).slice();
  const vistos = new Set(tipos.map((tipo) => tipo.id));

  for (const ganado of (perfil && perfil.ganados) || []) {
    const tipo = ganado.tipo;
    if (!tipo || vistos.has(tipo.id)) continue;
    vistos.add(tipo.id);
    tipos.push(tipo);
  }

  return tipos;
}

// Id para las entradas que se apuntan a mano (las automáticas usan el id del locke)
export function nuevoId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Arranque ----------

export function iniciarPerfiles() {
  alCambiarSesion(async (usuario) => {
    cargarTotalDeUsuarios();

    if (dejarDeEscuchar) {
      dejarDeEscuchar();
      dejarDeEscuchar = null;
    }
    if (dejarDeEscucharAmistades) {
      dejarDeEscucharAmistades();
      dejarDeEscucharAmistades = null;
    }
    dejarDeEscucharPerfilesAmigos();

    listaAmistades = [];
    amistadesDelServidor = false;
    errorAmistades = "";
    falloPerfil = "";

    if (!usuario) {
      mio = null;
      avisar();
      avisarAmistades();
      return;
    }

    escucharAmistades(usuario);
    // Se escucha ya, sin esperar a asegurarPerfil: así el perfil sale de la caché al
    // momento en vez de después de dos viajes al servidor
    escucharMiPerfil(usuario);

    try {
      perfilAsegurado = asegurarPerfil(usuario);
      await perfilAsegurado;
    } catch (error) {
      console.error("No se ha podido preparar el perfil", error);
      falloPerfil = explicar(error, "tu perfil");
      avisar();
      return;
    }

    try {
      await apuntarLockesGanados();
    } catch (error) {
      console.error("No se han podido apuntar los lockes ganados", error);
    }
  });
}

// Nombre y foto del perfil público según cómo se haya entrado. Del nombre y la foto de Google
// NO se copia nada: el perfil lo ve cualquiera con cuenta (foro, amigos...) y ahí no tiene que
// salir el nombre real de nadie. El nombre es el mote (hasta que lo elige, «Jugador») y la foto
// solo es la de Google si la persona lo pide (perfil.fotoGoogle, ver perfil.js).
function datosDeLaCuenta(usuario) {
  const deUsuario = nombreDeUsuario(usuario);
  return { nombre: deUsuario || "Jugador", foto: "" };
}

// El correo de Google con el que, antes, te podían buscar. Ya no se usa para buscar a nadie:
// solo para borrar el apunte de antes (correos/).
function correoParaBuscar(usuario) {
  return nombreDeUsuario(usuario) ? "" : (usuario.email || "").toLowerCase();
}

// Crea el perfil la primera vez. Después pone al día el nombre (con mote, el nombre es él) y la
// foto (la de Google solo si se ha pedido; con un Pokémon o una foto propia, esa).
//
// merge y no setDoc a secas: al crear una cuenta de usuario, crearCuenta reserva el mote a
// la vez, y si esto llegase después lo borraría.
async function asegurarPerfil(usuario) {
  const { bd, fn } = baseDeDatos();
  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const guardado = await fn.getDoc(referencia);
  const deLaCuenta = datosDeLaCuenta(usuario);

  if (guardado.exists()) {
    const { mote, avatar, fotoGoogle } = guardado.data();
    const cambios = { ...deLaCuenta };
    // Con mote, el nombre es el mote: si se quedó con el de Google (los perfiles de antes
    // lo copiaban), aquí se arregla
    if (mote) cambios.nombre = mote;
    // Con un Pokémon o una foto propia, esa foto no se pisa; la de Google, solo si la pidió
    if (avatar) delete cambios.foto;
    else if (fotoGoogle && usuario.photoURL) cambios.foto = usuario.photoURL;
    // Y el correo se quita: los perfiles de antes lo llevaban dentro
    await fn.updateDoc(referencia, { ...cambios, correo: fn.deleteField() });
  } else {
    const datos = { ...PERFIL_VACIO, ...deLaCuenta, tipos: TIPOS_POR_DEFECTO };
    await conContador(1, (lote) => lote.set(referencia, datos, { merge: true }));
  }

  await limpiarCorreoAntiguo(usuario);
}

// ---------- Cuántos usuarios hay ----------
//
// estadisticas/usuarios { total }: un número y nada más (ni uids ni correos), público para
// leer. Sube 1 cuando se crea un perfil y baja 1 cuando se borra, SIEMPRE en el mismo lote
// que el perfil (las reglas no dejan tocarlo de otra forma). Es aproximado: sin servidor no
// hay forma de que sea exacto. El valor de partida se puso a mano en la consola (ver
// LEEME-nube.md).
//
// Si el contador falla (no existe, reglas sin publicar...) el perfil se crea o se borra igual.

let totalUsuarios = null;
let cargandoTotal = false;
const oyentesTotal = new Set();

export function totalDeUsuarios() {
  return totalUsuarios;
}

export function alCambiarTotalDeUsuarios(funcion) {
  oyentesTotal.add(funcion);
  return () => oyentesTotal.delete(funcion);
}

// Una sola lectura por visita, también sin sesión
async function cargarTotalDeUsuarios() {
  const acceso = baseDeDatos();
  if (!acceso || totalUsuarios !== null || cargandoTotal) return;
  cargandoTotal = true;

  const { bd, fn } = acceso;
  try {
    const total = ((await fn.getDoc(fn.doc(bd, "estadisticas", "usuarios"))).data() || {}).total;
    if (Number.isInteger(total) && total >= 0) {
      totalUsuarios = total;
      for (const funcion of oyentesTotal) funcion(total);
    }
  } catch (error) {
    console.error("No se ha podido leer cuántos usuarios hay", error);
  } finally {
    cargandoTotal = false;
  }
}

// Escribe en un lote lo que haga falta (con «armar») junto con el +1 / -1 del contador. Si el
// lote con el contador falla, se repite sin él.
async function conContador(cambio, armar) {
  const { bd, fn } = baseDeDatos();
  const contador = fn.doc(bd, "estadisticas", "usuarios");

  try {
    const lote = fn.writeBatch(bd);
    armar(lote);
    lote.update(contador, { total: fn.increment(cambio) });
    await lote.commit();
  } catch (error) {
    console.error("No se ha podido tocar el contador de usuarios", error);
    const lote = fn.writeBatch(bd);
    armar(lote);
    await lote.commit();
  }
}

// Antes se apuntaba el correo de Google en correos/ para poder buscar a la gente por él. Ya no:
// se borra el apunte de antes, una sola vez por cuenta y navegador. Aparte y sin que un fallo
// pare lo demás.
async function limpiarCorreoAntiguo(usuario) {
  const correo = correoParaBuscar(usuario);
  const marca = `pokely-correo-limpio-${usuario.uid}`;
  if (!correo || leer(marca, false)) return;

  const { bd, fn } = baseDeDatos();
  try {
    const referencia = fn.doc(bd, "correos", correo);
    if ((await fn.getDoc(referencia)).exists()) await fn.deleteDoc(referencia);
    escribir(marca, true);
  } catch (error) {
    console.error("No se ha podido borrar el correo apuntado de antes", error);
  }
}

// ---------- Mote ----------
//
// Nombre único con el que te ven los demás y con el que te pueden buscar. Para que no haya
// dos iguales, cada mote ocupa un documento motes/{mote en minúsculas} con el uid de su
// dueño: Firestore no deja crear uno que ya existe (las reglas lo comprueban).
//
// Se cambia todo de golpe (lote): se reserva el nuevo, se apunta en el perfil (también como
// nombre) y se suelta el viejo. Si el nuevo está cogido, no cambia nada.

export const FORMATO_MOTE = /^[A-Za-z0-9_.-]{3,20}$/;
export const EXPLICACION_MOTE = t("De 3 a 20 letras sin acentos, números, punto, guion o guion bajo.");

export function claveMote(mote) {
  return String(mote || "").trim().toLowerCase();
}

// uid del dueño de ese mote, o null si está libre. Se puede mirar sin sesión (lo usa el
// formulario de crear cuenta).
export async function dueñoDelMote(mote) {
  const acceso = baseDeDatos();
  if (!acceso || !FORMATO_MOTE.test(mote)) return null;
  const { bd, fn } = acceso;
  const documento = await fn.getDoc(fn.doc(bd, "motes", claveMote(mote)));
  return documento.exists() ? documento.data().uid : null;
}

// Devuelve "" si ha ido bien o el motivo por el que no
export async function cambiarMote(nuevo) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return t("Inicia sesión primero.");

  nuevo = String(nuevo || "").trim();
  if (!FORMATO_MOTE.test(nuevo)) return EXPLICACION_MOTE;

  // Si asegurarPerfil aún está escribiendo el nombre de Google, se espera a que acabe:
  // si no, podría llegar después y pisar el mote recién puesto
  await perfilAsegurado.catch(() => {});

  const { bd, fn } = acceso;
  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const actual = ((await fn.getDoc(referencia)).data() || {}).mote || "";
  if (actual === nuevo) return "";

  const dueño = await dueñoDelMote(nuevo);
  if (dueño && dueño !== usuario.uid) return t("«{nombre}» ya lo tiene otra persona.", { nombre: nuevo });

  const lote = fn.writeBatch(bd);
  // Si solo cambian mayúsculas («pepe» -> «Pepe») el documento es el mismo y solo se reescribe
  lote.set(fn.doc(bd, "motes", claveMote(nuevo)), { uid: usuario.uid, mote: nuevo });
  if (actual && claveMote(actual) !== claveMote(nuevo)) lote.delete(fn.doc(bd, "motes", claveMote(actual)));
  lote.set(referencia, { mote: nuevo, nombre: nuevo }, { merge: true });

  try {
    await lote.commit();
  } catch (error) {
    console.error(error);
    // Lo normal: alguien lo ha cogido justo entre la comprobación y el guardado
    return error && error.code === "permission-denied"
      ? t("No se ha podido guardar «{nombre}». Puede que ya esté cogido.", { nombre: nuevo })
      : t("No se ha podido guardar. Inténtalo otra vez.");
  }

  // En los lockes en los que estoy, el nombre nuevo lo pone lockes.js (ponerMiNombre) en
  // cuanto llega el perfil con el mote
  return "";
}

function escucharMiPerfil(usuario) {
  const { bd, fn } = baseDeDatos();

  dejarDeEscuchar = fn.onSnapshot(
    fn.doc(bd, "perfiles", usuario.uid),
    (documento) => {
      // La primera vez que entras el perfil aún no existe: llega en cuanto asegurarPerfil
      // lo crea. Mientras, se queda en null (y se tira del provisional, con sus tipos).
      if (!documento.exists()) return;
      falloPerfil = "";
      mio = perfilLeido(usuario.uid, documento.data());
      if (mio.mote) recordarNombreDeCuenta(mio.mote, mio.foto || ""); // para la lista de cuentas
      avisar();
      publicarAmigos();
    },
    (error) => {
      console.error("Se ha perdido la conexión con el perfil", error);
      falloPerfil = explicar(error, "tu perfil");
      avisar();
    }
  );
}

// Tus amigos también van en tu perfil (perfil.amigos: [uid]), para que los vea quien mire tu
// perfil: las amistades en sí solo las pueden leer los dos de cada una.
let amistadesDelServidor = false;

function publicarAmigos() {
  if (!mio || !amistadesDelServidor) return;
  const ahora = amigosAceptados().map((amistad) => amistad.otro).sort();
  const antes = [...(mio.amigos || [])].sort();
  if (JSON.stringify(ahora) === JSON.stringify(antes)) return;
  guardarMiPerfil({ amigos: ahora }).catch((error) => console.error("No se han podido apuntar los amigos en el perfil", error));
}

function escucharAmistades(usuario) {
  const { bd, fn } = baseDeDatos();

  dejarDeEscucharAmistades = fn.onSnapshot(
    fn.query(fn.collection(bd, "amistades"), fn.where("miembros", "array-contains", usuario.uid)),
    (instantanea) => {
      errorAmistades = "";
      listaAmistades = instantanea.docs.map((documento) => {
        const datos = documento.data();
        return {
          id: documento.id,
          ...datos,
          otro: datos.miembros.find((uid) => uid !== usuario.uid) || usuario.uid
        };
      });
      escucharPerfilesAmigos();
      avisarAmistades();
      // Solo con lo que dice el servidor: lo de la caché puede estar vacío o viejo
      if (!instantanea.metadata.fromCache) {
        amistadesDelServidor = true;
        publicarAmigos();
      }
    },
    (error) => {
      console.error("No se han podido leer las amistades", error);
      // Lo normal es que falten las reglas por publicar, así que se dice tal cual
      errorAmistades = explicar(error, "las amistades");
      avisarAmistades();
    }
  );
}

// ---------- Escribir mi perfil ----------

export async function guardarMiPerfil(cambios) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;

  const { bd, fn } = acceso;
  await fn.updateDoc(fn.doc(bd, "perfiles", usuario.uid), cambios);
}

// ---------- Leer otros perfiles ----------

export async function perfilesDe(uids) {
  const acceso = baseDeDatos();
  const mapa = new Map();
  if (!acceso || !uids.length) return mapa;

  const { bd, fn } = acceso;
  const perfiles = await Promise.all(
    uids.map(async (uid) => {
      // Los de los amigos ya están aquí, al día: no hace falta ir al servidor
      if (perfilesAmigos.has(uid)) return perfilesAmigos.get(uid);
      const documento = await fn.getDoc(fn.doc(bd, "perfiles", uid));
      return perfilLeido(uid, documento.data());
    })
  );

  for (const perfil of perfiles) mapa.set(perfil.uid, perfil);
  return mapa;
}

// Solo por mote. Por correo ya no se puede: así nadie puede comprobar si un correo concreto
// usa la web.
export async function buscarAmigo(texto) {
  const acceso = baseDeDatos();
  texto = String(texto || "").trim();
  if (!acceso || !texto) return null;

  const uid = await dueñoDelMote(texto);
  if (!uid) return null;
  return (await perfilesDe([uid])).get(uid) || null;
}

// ---------- Borrar la cuenta ----------

// Perfil, mote y correo de un golpe (las reglas de motes miran que el perfil ya no lo tenga)
export async function borrarMiPerfil() {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const mote = ((await fn.getDoc(referencia)).data() || {}).mote || "";
  const correo = correoParaBuscar(usuario);
  // Solo si es suyo: puede no estar (no llegó a apuntarse) y entonces las reglas no dejan
  const correoMio = correo && ((await fn.getDoc(fn.doc(bd, "correos", correo))).data() || {}).uid === usuario.uid;

  await conContador(-1, (lote) => {
    if (mote) lote.delete(fn.doc(bd, "motes", claveMote(mote)));
    if (correoMio) lote.delete(fn.doc(bd, "correos", correo));
    lote.delete(referencia);
  });
}

export async function borrarMisAmistades() {
  await Promise.all(listaAmistades.map((amistad) => borrarAmistad(amistad.id)));
}

// ---------- Amistades ----------

export async function pedirAmistad(otroUid) {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  const id = idAmistad(usuario.uid, otroUid);

  await fn.setDoc(fn.doc(bd, "amistades", id), {
    miembros: [usuario.uid, otroUid].sort(),
    estado: "pendiente",
    pidio: usuario.uid,
    creado: Date.now()
  });

  return id;
}

export async function aceptarAmistad(id) {
  const { bd, fn } = baseDeDatos();
  await fn.updateDoc(fn.doc(bd, "amistades", id), { estado: "ok" });
}

export async function borrarAmistad(id) {
  const { bd, fn } = baseDeDatos();
  await fn.deleteDoc(fn.doc(bd, "amistades", id));
}

// Lo que se guarda en tus lockes ganados de un locke de Versus. Es una copia, no un enlace:
// tus amigos ven tu ficha pero no pueden leer los lockes en los que no han jugado, así que
// todo lo que salga en la ficha (quién jugó, con cuántas vidas acabó, cuándo terminó) tiene
// que ir aquí dentro.
function resumenDeLocke(id, locke) {
  const nombres = locke.nombres || {};
  const vidas = locke.vidas || {};
  const estados = locke.estados || {};

  const salon = locke.salon || {};
  const equipos = locke.equipos || {};
  const resultados = locke.resultados || {};
  const dentro = (locke.jugadores || []).filter((uid) => (estados[uid] || "aceptado") === "aceptado");

  // Como en los que se apuntan a mano (amigos/index.js): cada participante con su id (aquí, su
  // uid), si se pasó la ROM y su equipo final con su MVP
  const participantes = dentro.map((uid) => ({
    id: uid,
    nombre: nombres[uid] || "Jugador",
    vidas: locke.vidasIlimitadas ? null : Math.max(0, vidas[uid] || 0), // -1: eliminado (vida cero)
    rom: Boolean((locke.rom || {})[uid]),
    ...(salon[uid] ? { equipo: { nombre: salon[uid].nombre || "", pokemon: salon[uid].pokemon || [] }, mvp: salon[uid].mvp ?? -1 } : {})
  }));

  // Y cada combate: quién lo ganó, cómo y con qué equipo jugó cada uno
  const combates = (Array.isArray(locke.combates) ? locke.combates : []).map((combate, i) => {
    const resultado = resultados[combate.id] || {};
    return {
      nombre: combate.nombre || t("Combate {n}", { n: i + 1 }),
      ganador: dentro.includes(resultado.ganador) ? resultado.ganador : "",
      marcador: resultado.marcador || "",
      equipos: Object.fromEntries(dentro.filter((uid) => (equipos[uid] || {})[combate.id]).map((uid) => [uid, equipos[uid][combate.id]]))
    };
  });

  return {
    id,
    nombre: locke.nombre,
    nota: "",
    tipo: locke.tipo,
    juego: locke.juego || "",
    // Un juego propio se queda con su nombre (en la ficha no se puede abrir: es de otro)
    juegoOtro: locke.juegoOtro || (locke.juegoPropio ? locke.juegoPropio.nombre : ""),
    fechaFin: locke.fechaFin || "",
    vidasIlimitadas: Boolean(locke.vidasIlimitadas),
    ganador: nombres[locke.ganador] || "",
    participantes,
    combates
  };
}

// ---------- Lockes ganados automáticos ----------
//
// Al cerrar un locke, el que lo cierra marca el ganador. El +1 en el palmarés no lo puede
// escribir él: las reglas solo dejan que cada uno escriba su propio perfil. Así que lo
// hace el ganador en cuanto abre la web, y el locke se queda apuntado en «contado» para
// que no se sume dos veces.
//
// Sin Cloud Functions a propósito: esas piden plan de pago.

export async function apuntarLockesGanados() {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;

  const { bd, fn } = acceso;

  // Solo se filtra por «array-contains» y el resto se mira aquí: con tres condiciones
  // Firestore pediría crear un índice a mano y no hace falta para tan pocos lockes.
  const encontrados = await fn.getDocs(
    fn.query(fn.collection(bd, "lockes"), fn.where("jugadores", "array-contains", usuario.uid))
  );

  const nuevos = [];
  const porMarcar = [];

  encontrados.forEach((documento) => {
    const locke = documento.data();
    if (locke.estado !== "cerrado" || locke.ganador !== usuario.uid) return;
    if ((locke.contado || []).includes(usuario.uid)) return;

    nuevos.push(resumenDeLocke(documento.id, locke));
    porMarcar.push(documento.ref);
  });

  if (!nuevos.length) return;

  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const guardado = await fn.getDoc(referencia);
  const ganados = (guardado.data() || {}).ganados || [];
  const yaEstan = new Set(ganados.map((ganado) => ganado.id));

  await fn.updateDoc(referencia, {
    ganados: [...ganados, ...nuevos.filter((nuevo) => !yaEstan.has(nuevo.id))]
  });

  await Promise.all(
    porMarcar.map((referenciaLocke) =>
      fn.updateDoc(referenciaLocke, { contado: fn.arrayUnion(usuario.uid) })
    )
  );
}
