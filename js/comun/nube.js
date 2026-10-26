// ---------- Copia en la nube (Firebase) ----------
//
// Cómo funciona:
//   · El navegador sigue mandando: leer() y escribir() no cambian y siguen siendo inmediatos.
//   · Al iniciar sesión se comparan las fechas de cada clave. Para cada una gana la más
//     reciente, venga del navegador o de la nube. Si algo cambia, se recarga la página
//     para que todas las secciones se vuelvan a pintar con los datos buenos.
//   · A partir de ahí, cada vez que se guarda algo se sube en segundo plano (con un
//     respiro de un segundo para no subir diez veces seguidas al arrastrar o escribir).
//
// Cada clave va en su propio documento (usuarios/{uid}/datos/{clave}) para no toparse
// con el límite de 1 MiB por documento de Firestore cuando haya muchos equipos.

import { CONFIG_FIREBASE, hayConfiguracion } from "./firebase-config.js";
import { activarAppCheck } from "./appcheck.js";
import {
  CLAVES_SINCRONIZADAS, leer, escribir, tiempos, alCambiar, escribirDesdeLaNube, vaciarSincronizadas
} from "./almacen.js";

// De quién son los datos que hay ahora mismo en este navegador
const CLAVE_DUENO = "poketeams-dueno-v1";

const VERSION_SDK = "11.3.1";
const BASE_SDK = `https://www.gstatic.com/firebasejs/${VERSION_SDK}/`;

const RETRASO_SUBIDA = 1000; // ms que se espera antes de subir, por si vienen más cambios

let auth = null;
let bd = null;
let usuario = null;
let funcionesAuth = null;
let funcionesBD = null;

const pendientes = new Set();
let temporizador = null;

// Se cumple cuando lo del navegador ya se ha juntado con lo de la cuenta (o no hay cuenta).
// Quien escriba algo sincronizado por su cuenta, sin que lo pida la persona (p. ej. las
// normas que llegan de un locke), tiene que esperar a esto: si no, su escritura sería «más
// nueva» que lo de la nube y lo pisaría.
let marcarSincronizado = null;
const sincronizado = new Promise((cumplir) => (marcarSincronizado = cumplir));

export function cuandoEsteSincronizado() {
  return sincronizado;
}

// ---------- Varias cuentas ----------
//
// Firebase solo deja una sesión por «app», así que cada cuenta tiene la suya: la primera,
// la de siempre (nombre ""), y cada una que se añada, «cuenta-<fecha>». Cada app guarda su
// sesión por separado en el navegador; cambiar de cuenta es decir qué app se abre y recargar.
//
// Lo que se recuerda en este navegador (no se sube a ningún sitio):
//   { activa: "cuenta-123" | "", cuentas: [{ app, uid, nombre, foto }] }

const CLAVE_CUENTAS = "pokely-cuentas-v1";
let appActiva = "";

function cuentas() {
  const guardado = leer(CLAVE_CUENTAS, null);
  return {
    activa: (guardado && guardado.activa) || "",
    cuentas: (guardado && guardado.cuentas) || []
  };
}

// Las cuentas recordadas, la activa marcada
export function cuentasRecordadas() {
  return cuentas().cuentas.map((cuenta) => ({ ...cuenta, activa: cuenta.app === appActiva }));
}

function apuntarCuenta(cuenta) {
  const estado = cuentas();
  // La misma persona no sale dos veces aunque haya entrado en dos apps: se queda la de ahora
  estado.cuentas = estado.cuentas.filter((otra) => otra.uid !== cuenta.uid && otra.app !== cuenta.app);
  estado.cuentas.push(cuenta);
  escribir(CLAVE_CUENTAS, estado);
}

// El nombre y la foto que salen en la lista (perfiles.js los pone al día con los del perfil)
export function recordarNombreDeCuenta(nombre, foto) {
  if (!usuario) return;
  const estado = cuentas();
  const cuenta = estado.cuentas.find((cada) => cada.app === appActiva);
  if (!cuenta || (cuenta.nombre === nombre && (foto === undefined || cuenta.foto === foto))) return;
  cuenta.nombre = nombre;
  if (foto !== undefined) cuenta.foto = foto;
  escribir(CLAVE_CUENTAS, estado);
}

// Antes de irse de una cuenta se sube lo que estuviera esperando y se borra de este
// navegador lo suyo (equipos, rutas...): al abrir la otra se baja lo de esa.
async function dejarEstaCuenta() {
  clearTimeout(temporizador);
  await vaciarPendientes();
  vaciarSincronizadas();
  escribir(CLAVE_DUENO, null);
}

export async function cambiarDeCuenta(app) {
  if (app === appActiva) return;
  if (usuario) await dejarEstaCuenta();
  escribir(CLAVE_CUENTAS, { ...cuentas(), activa: app });
  location.reload();
}

// Abre una app nueva, sin sesión: al recargar sale la ventana de entrar
export async function anadirCuenta() {
  if (usuario) await dejarEstaCuenta();
  escribir(CLAVE_CUENTAS, { ...cuentas(), activa: `cuenta-${Date.now()}` });
  try {
    sessionStorage.setItem("pokely-abrir-entrar", "1");
  } catch (error) {
    // sin esto solo hay que pulsar «Iniciar sesión» a mano
  }
  location.reload();
}

// Para sesion.js: si hay que abrir la ventana de entrar nada más cargar
export function tocaAbrirEntrar() {
  try {
    const toca = sessionStorage.getItem("pokely-abrir-entrar") === "1";
    sessionStorage.removeItem("pokely-abrir-entrar");
    return toca;
  } catch (error) {
    return false;
  }
}

// ---------- Carga del SDK ----------

// Se descarga solo si hay configuración y solo la primera vez
async function cargarFirebase() {
  const [app, autenticacion, firestore] = await Promise.all([
    import(`${BASE_SDK}firebase-app.js`),
    import(`${BASE_SDK}firebase-auth.js`),
    import(`${BASE_SDK}firebase-firestore.js`)
  ]);

  // Cada cuenta recordada vive en su propia «app» de Firebase (ver Varias cuentas, abajo):
  // cada una guarda su sesión aparte y por eso se puede cambiar sin volver a meter nada
  const nombreApp = cuentas().activa;
  const aplicacion = nombreApp ? app.initializeApp(CONFIG_FIREBASE, nombreApp) : app.initializeApp(CONFIG_FIREBASE);
  appActiva = nombreApp || "";
  await activarAppCheck(BASE_SDK, aplicacion);
  funcionesAuth = autenticacion;
  funcionesBD = firestore;
  auth = autenticacion.getAuth(aplicacion);
  bd = abrirFirestore(firestore, aplicacion);
}

// Con caché en el navegador (IndexedDB): al entrar, perfiles, amistades y lockes salen al
// momento con lo de la última vez y se ponen al día en cuanto contesta el servidor. Vale
// también con la web abierta en varias pestañas. Si el navegador no deja (modo incógnito
// en algunos), se usa la de siempre, solo en memoria.
function abrirFirestore(firestore, aplicacion) {
  try {
    return firestore.initializeFirestore(aplicacion, {
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() })
    });
  } catch (error) {
    console.error("Firestore sin caché local", error);
    return firestore.getFirestore(aplicacion);
  }
}

// ---------- Subir y bajar ----------

function documento(clave) {
  return funcionesBD.doc(bd, "usuarios", usuario.uid, "datos", clave);
}

async function subir(clave) {
  const valor = leer(clave, null);
  // Lo guardado antes de que existiera la nube no tiene fecha: se le pone ahora y se deja
  // apuntada también aquí, para que al volver a entrar no parezca que la nube es más nueva.
  const cuando = tiempos()[clave] || Date.now();
  escribirDesdeLaNube(clave, valor, cuando);

  await funcionesBD.setDoc(documento(clave), { valor: JSON.stringify(valor), actualizado: cuando });
}

// El valor va como texto: así Firestore no se queja de los arrays dentro de arrays
// ni cambia los tipos por el camino.
function valorDe(datos) {
  try {
    return JSON.parse(datos.valor);
  } catch (error) {
    return null;
  }
}

const CLAVE_EQUIPOS = "poketeams-equipos-v1";

// null, [] o {}: no hay nada
function vacio(valor) {
  if (valor === null || valor === undefined) return true;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "object") return Object.keys(valor).length === 0;
  return false;
}

// Los de la cuenta primero y detrás los que no estuvieran (por id)
function juntarEquipos(deLaCuenta, deAqui) {
  const cuenta = Array.isArray(deLaCuenta) ? deLaCuenta : [];
  const ids = new Set(cuenta.map((equipo) => equipo.id));
  return [...cuenta, ...(Array.isArray(deAqui) ? deAqui : []).filter((equipo) => !ids.has(equipo.id))];
}

// Junta lo del navegador con lo de la nube: para cada clave gana la fecha más reciente.
// Devuelve true si ha cambiado algo de lo que hay guardado aquí.
//
// Excepción: si este navegador lo usó otra cuenta, primero se borra lo que haya aquí y
// solo se baja lo de la nube. Así dos personas pueden usar el mismo ordenador sin que
// los equipos de una acaben en la cuenta de la otra. Lo que se usó sin haber entrado
// nunca (no hay dueño apuntado) sí se sube: es el caso de estrenar la sesión.
async function juntar() {
  const dueñoAnterior = leer(CLAVE_DUENO, null);
  const otraPersona = Boolean(dueñoAnterior) && dueñoAnterior !== usuario.uid;

  if (otraPersona) vaciarSincronizadas();
  escribir(CLAVE_DUENO, usuario.uid);

  const locales = tiempos();
  const instantanea = await funcionesBD.getDocs(
    funcionesBD.collection(bd, "usuarios", usuario.uid, "datos")
  );

  const enLaNube = new Map();
  instantanea.forEach((d) => enLaNube.set(d.id, d.data()));

  let hayCambios = false;
  const porSubir = [];

  // Lo que hay en el navegador sin haber entrado nunca (o tras cerrar sesión) es de nadie:
  // no puede pisar lo de la cuenta solo por ser más reciente
  const anonimo = !dueñoAnterior;

  const bajar = (clave, valor, fecha) => {
    if (escribirDesdeLaNube(clave, valor, fecha)) hayCambios = true;
  };

  for (const clave of CLAVES_SINCRONIZADAS) {
    const remoto = enLaNube.get(clave);
    const fechaLocal = locales[clave] || 0;
    const fechaRemota = (remoto && remoto.actualizado) || 0;
    const valorLocal = leer(clave, undefined);
    const hayAqui = valorLocal !== undefined;
    const valorRemoto = remoto ? valorDe(remoto) : undefined;

    if (remoto && vacio(valorLocal) && !vacio(valorRemoto)) {
      // Nunca se cambia algo con datos por algo vacío, aunque lo vacío sea más nuevo
      // (así se perdieron una vez los equipos: una lista vacía apuntada al abrir la web)
      bajar(clave, valorRemoto, fechaRemota);
    } else if (hayAqui && !vacio(valorLocal) && remoto && vacio(valorRemoto)) {
      porSubir.push(clave);
    } else if (anonimo && remoto && clave === CLAVE_EQUIPOS) {
      // Equipos guardados sin sesión y equipos de la cuenta: se juntan, no se pisan
      const juntos = juntarEquipos(valorRemoto, valorLocal);
      bajar(clave, juntos, Date.now());
      if (juntos.length !== (valorRemoto || []).length) porSubir.push(clave);
    } else if (anonimo && remoto) {
      bajar(clave, valorRemoto, fechaRemota);
    } else if (remoto && fechaRemota > fechaLocal) {
      bajar(clave, valorRemoto, fechaRemota);
    } else if (hayAqui && (!remoto || fechaLocal > fechaRemota)) {
      // También entra aquí lo que se guardó antes de que existiera la nube, que no tiene fecha
      porSubir.push(clave);
    }
  }

  await Promise.all(porSubir.map(subir));

  // Si ha entrado otra persona hay que recargar sí o sí: las secciones ya están pintadas
  // con los datos del anterior aunque la nube de la nueva esté vacía.
  return hayCambios || otraPersona;
}

// ---------- Avisos de la interfaz ----------

const oyentes = new Set();

export function alCambiarSesion(funcion) {
  oyentes.add(funcion);
  funcion(usuario);
}

function avisarDeLaSesion() {
  for (const funcion of oyentes) funcion(usuario);
}

// ---------- Entrar y salir ----------

export async function entrar() {
  if (!auth) return;
  const proveedor = new funcionesAuth.GoogleAuthProvider();
  await funcionesAuth.signInWithPopup(auth, proveedor);
}

// ---------- Cuentas de usuario y contraseña ----------
//
// Firebase solo sabe de correos, así que el usuario se convierte en un correo inventado:
// «Pepe» -> pepe@pokely.invalid. «.invalid» es un dominio que no existe ni puede existir:
// nunca se manda nada ahí. Por eso estas cuentas no pueden recuperar la contraseña.
//
// Se queda «pokely» (el nombre antiguo de la web) aunque ahora se llame NuzTheLocke: es el
// correo con el que entran las cuentas que ya existen, y si cambiase no podrían entrar.
// Lo mismo con las claves «pokely-...» del navegador.
//
// Hay que activar «Correo electrónico/contraseña» en la consola de Firebase
// (Authentication -> Sign-in method), o Firebase contesta auth/operation-not-allowed.

const DOMINIO_USUARIOS = "@pokely.invalid";

function correoDeUsuario(nombre) {
  return `${String(nombre).trim().toLowerCase()}${DOMINIO_USUARIOS}`;
}

// El usuario con el que entra esa cuenta, o "" si es de Google
export function nombreDeUsuario(cuenta) {
  const correo = (cuenta && cuenta.email) || "";
  if (!correo.endsWith(DOMINIO_USUARIOS)) return "";
  return cuenta.displayName || correo.slice(0, -DOMINIO_USUARIOS.length);
}

export async function entrarConUsuario(nombre, contraseña) {
  if (!auth) return;
  await funcionesAuth.signInWithEmailAndPassword(auth, correoDeUsuario(nombre), contraseña);
}

export async function crearCuentaDeUsuario(nombre, contraseña) {
  if (!auth) return;
  const { user } = await funcionesAuth.createUserWithEmailAndPassword(auth, correoDeUsuario(nombre), contraseña);
  // Con las mayúsculas tal cual las escribió (el correo va en minúsculas)
  await funcionesAuth.updateProfile(user, { displayName: String(nombre).trim() });
}

// Al salir se borra de este navegador todo lo tuyo (equipos, rutas, level caps): sigue en
// tu cuenta y vuelve al entrar. Antes se sube lo que estuviera esperando. La cuenta se
// olvida de la lista y, si quedan otras, se abre la primera.
export async function salir() {
  if (!auth) return;
  await dejarEstaCuenta();
  await funcionesAuth.signOut(auth);
  olvidarEstaCuentaYRecargar();
}

function olvidarEstaCuentaYRecargar() {
  const estado = cuentas();
  estado.cuentas = estado.cuentas.filter((cuenta) => cuenta.app !== appActiva);
  estado.activa = estado.cuentas.length ? estado.cuentas[0].app : "";
  escribir(CLAVE_CUENTAS, estado);
  location.reload();
}

// ---------- Borrar la cuenta ----------
//
// Firebase solo deja borrar una cuenta en la que se ha entrado hace un momento, así que
// antes se vuelve a pedir la contraseña (o la ventana de Google). Va primero, antes de
// borrar nada: si no, podrían borrarse los datos y quedarse la cuenta.

export async function confirmarIdentidad(contraseña) {
  if (nombreDeUsuario(usuario)) {
    const credencial = funcionesAuth.EmailAuthProvider.credential(usuario.email, contraseña);
    await funcionesAuth.reauthenticateWithCredential(usuario, credencial);
  } else {
    await funcionesAuth.reauthenticateWithPopup(usuario, new funcionesAuth.GoogleAuthProvider());
  }
}

// Que no se suba nada más: lo que haya en usuarios/{uid}/datos se va a borrar
export function dejarDeSubir() {
  clearTimeout(temporizador);
  pendientes.clear();
}

// Equipos, rutas, level caps... lo de usuarios/{uid}/datos
export async function borrarMisDatosGuardados() {
  dejarDeSubir();
  const guardados = await funcionesBD.getDocs(funcionesBD.collection(bd, "usuarios", usuario.uid, "datos"));
  await Promise.all(guardados.docs.map((cada) => funcionesBD.deleteDoc(cada.ref)));
}

// Lo último, cuando ya no queda nada suyo en Firestore: la cuenta en sí, lo suyo en este
// navegador y la cuenta en la lista de cuentas
export async function borrarCuentaDeFirebase() {
  dejarDeSubir();
  await funcionesAuth.deleteUser(usuario);
  vaciarSincronizadas();
  escribir(CLAVE_DUENO, null);
  olvidarEstaCuentaYRecargar();
}

export function hayNube() {
  return hayConfiguracion();
}

// ---------- Acceso directo a Firestore ----------
//
// Lo usan las partes compartidas (perfiles, amigos y lockes), que no pasan por
// localStorage: ahí no tiene sentido guardar una copia local, porque el dato es de dos
// personas a la vez y la copia volvería a plantear quién pisa a quién.
//
// Devuelve null mientras el SDK no esté cargado o no haya sesión.

export function usuarioActual() {
  return usuario;
}

// Firebase ya ha dicho si hay sesión o no (al cargar la página tarda un momento): hasta
// entonces, no tener usuario no quiere decir que no se haya entrado
let sesionSabida = false;

export function seSabeLaSesion() {
  return sesionSabida;
}

export function baseDeDatos() {
  return bd ? { bd, fn: funcionesBD } : null;
}

// ---------- Arranque ----------

export async function iniciarNube() {
  if (!hayConfiguracion()) {
    marcarSincronizado();
    return; // sin configurar: la web va solo con el navegador
  }

  try {
    await cargarFirebase();
  } catch (error) {
    console.error("No se ha podido cargar Firebase", error);
    sesionSabida = true;
    avisarDeLaSesion();
    marcarSincronizado();
    return;
  }

  // Cada vez que se guarda algo se apunta para subirlo un segundo después
  alCambiar((clave) => {
    if (!usuario) return;
    pendientes.add(clave);
    clearTimeout(temporizador);
    temporizador = setTimeout(vaciarPendientes, RETRASO_SUBIDA);
  });

  // Si se cierra la pestaña dentro de ese segundo, se sube ya (sin esto se quedaría solo
  // en el navegador hasta la próxima vez que se entre)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden" || !pendientes.size) return;
    clearTimeout(temporizador);
    vaciarPendientes();
  });

  funcionesAuth.onAuthStateChanged(auth, async (nuevo) => {
    usuario = nuevo;
    sesionSabida = true;
    if (nuevo) {
      apuntarCuenta({
        app: appActiva,
        uid: nuevo.uid,
        nombre: nombreDeUsuario(nuevo) || nuevo.displayName || nuevo.email || "Cuenta",
        foto: nuevo.photoURL || ""
      });
    }
    avisarDeLaSesion();
    if (!nuevo) {
      marcarSincronizado();
      return;
    }

    try {
      if (await juntar()) {
        location.reload(); // había datos más nuevos en la nube
        return;
      }
    } catch (error) {
      console.error("No se han podido sincronizar los datos", error);
    }
    marcarSincronizado();
  });
}

async function vaciarPendientes() {
  const claves = [...pendientes];
  pendientes.clear();

  try {
    await Promise.all(claves.map(subir));
  } catch (error) {
    // si falla, se vuelven a intentar en el siguiente cambio
    for (const clave of claves) pendientes.add(clave);
    console.error("No se han podido subir los cambios", error);
  }
}
