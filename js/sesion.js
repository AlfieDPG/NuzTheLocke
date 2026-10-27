// Cajón de la sesión, abajo del todo del panel lateral, y sus ventanas.
// Si Firebase no está configurado no se enseña nada: la web va igual, solo que lo
// guardado se queda en este navegador.
//
//   · Entrar: con usuario y contraseña de NuzTheLocke o con Google (ver nube.js).
//   · Crear cuenta: usuario, contraseña y repetirla. El usuario es también su nombre.
//   · Nombre de usuario obligatorio: mientras la cuenta no tenga uno (las de Google al
//     entrar por primera vez) sale una ventana que no se puede cerrar. Así nadie va por
//     ahí con el nombre de Google y no puede haber dos «Alfonso».
//   · Pulsando tu nombre, un desplegable: tu perfil (js/perfil.js), cambiar de cuenta y
//     añadir otra.
//   · Borrar la cuenta (el botón está en la ventana del perfil).

import { escaparHTML } from "./comun/utilidades.js";
import { icono } from "./comun/iconos.js";
import { t } from "./comun/idioma.js";
import {
  iniciarNube, alCambiarSesion, entrar, salir, hayNube, usuarioActual,
  entrarConUsuario, crearCuentaDeUsuario, nombreDeUsuario,
  cuentasRecordadas, cambiarDeCuenta, anadirCuenta, tocaAbrirEntrar,
  confirmarIdentidad, borrarMisDatosGuardados, borrarCuentaDeFirebase
} from "./comun/nube.js";
import {
  iniciarPerfiles, alCambiarMiPerfil, miPerfil, cambiarMote, dueñoDelMote,
  FORMATO_MOTE, EXPLICACION_MOTE, borrarMiPerfil, borrarMisAmistades
} from "./comun/perfiles.js";
import { iniciarLockes, salirDeTodosMisLockes } from "./comun/lockes.js";
import { borrarMiForo } from "./comun/foro.js";
import { iniciarChats, borrarMisBloqueos } from "./comun/chat.js";
import { borrarMisJugadas, marcoDe, claseMarco } from "./comun/fichas.js";
import { iniciarAvisosForo } from "./comun/avisos-foro.js";
import { iniciarAvisos } from "./avisos.js";
import { iniciarPresencia, borrarMiPresencia } from "./comun/presencia.js";
import { iniciarLogros } from "./comun/logros.js";

const cajon = document.querySelector(".sesion");
const datosUsuario = cajon.querySelector(".sesion-usuario");
const foto = cajon.querySelector(".sesion-foto");
const nombre = cajon.querySelector(".sesion-nombre");
const boton = cajon.querySelector(".sesion-boton");
const aviso = cajon.querySelector(".sesion-aviso");

const dialogoEntrar = document.querySelector("#dialogo-entrar");
const dialogoCrear = document.querySelector("#dialogo-crear-cuenta");
const dialogoMote = document.querySelector("#dialogo-mote");
const dialogoPerfil = document.querySelector("#dialogo-perfil");
const dialogoBorrar = document.querySelector("#dialogo-borrar-cuenta");
const menuCuentas = cajon.querySelector(".menu-cuentas");

// Mientras se crea una cuenta de usuario, su nombre se reserva justo después: que no salte
// entretanto la ventana de «elige tu nombre»
let creandoCuenta = false;

// ---------- Panel lateral ----------

// Nombre y foto: los del perfil (mote y, si se ha puesto un Pokémon, su retrato) y, mientras
// no llega, los de la cuenta
function pintarNombre() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const perfil = miPerfil();
  nombre.textContent =
    (perfil && perfil.nombre) || nombreDeUsuario(usuario) || usuario.displayName || usuario.email || t("Tu cuenta");

  // Solo la del perfil: la de Google no sale si no se ha pedido (ver perfiles.js)
  const url = (perfil && perfil.foto) || "";
  foto.hidden = !url;
  if (url && foto.getAttribute("src") !== url) foto.src = url;
  foto.className = `sesion-foto ${claseMarco(marcoDe(perfil))}`; // con su marco (js/comun/fichas.js)
}

function pintar(usuario) {
  datosUsuario.hidden = !usuario;
  menuCuentas.hidden = true;

  if (usuario) {
    pintarNombre();
    boton.textContent = t("Cerrar sesión");
    aviso.textContent = "";
    if (dialogoEntrar.open) dialogoEntrar.close();
    if (dialogoCrear.open) dialogoCrear.close();
  } else {
    boton.textContent = t("Iniciar sesión");
    aviso.textContent = t("Inicia sesión para que todo se guarde en tu cuenta.");
    if (dialogoMote.open) dialogoMote.close();
  }
}

// ---------- Contraseña ----------

// Lo mismo que la política de contraseñas de Firebase (Authentication → Configuración →
// Política de contraseñas): si se cambia allí, hay que cambiarlo aquí. Solo vale al crear la
// cuenta; las que ya existen siguen entrando con la suya.
const AVISO_CLAVE = "La contraseña tiene que tener al menos 8 caracteres, con mayúsculas, minúsculas y un número.";

function claveValida(clave) {
  return clave.length >= 8 && /[a-z]/.test(clave) && /[A-Z]/.test(clave) && /[0-9]/.test(clave);
}

// ---------- Errores ----------

function textoDeError(error) {
  const codigo = (error && error.code) || "";
  if (codigo === "auth/operation-not-allowed") {
    return t("Las cuentas con usuario aún no están activadas en Firebase (Authentication → Sign-in method → Correo electrónico/contraseña).");
  }
  if (codigo === "auth/invalid-credential" || codigo === "auth/wrong-password" || codigo === "auth/user-not-found") {
    return t("Usuario o contraseña incorrectos.");
  }
  if (codigo === "auth/email-already-in-use") return t("Ese usuario ya existe.");
  if (codigo === "auth/weak-password" || codigo === "auth/password-does-not-meet-requirements") return t(AVISO_CLAVE);
  if (codigo === "auth/too-many-requests") return t("Demasiados intentos. Espera un poco.");
  if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") return "";
  if (codigo === "auth/user-mismatch") return t("Esa no es la cuenta de Google con la que estás dentro.");
  if (codigo === "auth/missing-password") return t("Escribe tu contraseña.");
  return t("No se ha podido. Inténtalo otra vez.");
}

// Apaga los botones de la ventana mientras dura la tarea y pone el error si falla
async function conBotonesApagados(dialogo, tarea) {
  const error = dialogo.querySelector(".sesion-error");
  const botones = [...dialogo.querySelectorAll("button")];
  error.textContent = "";
  for (const cada of botones) cada.disabled = true;
  try {
    await tarea(error);
  } catch (fallo) {
    console.error(fallo);
    error.textContent = textoDeError(fallo);
  }
  for (const cada of botones) cada.disabled = false;
}

// ---------- Lista de cuentas ----------

function plantillaCuenta(cuenta) {
  const nombreCuenta = escaparHTML(cuenta.nombre || t("Cuenta"));
  const cara = cuenta.foto
    ? `<img src="${escaparHTML(cuenta.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="cuenta-inicial">${escaparHTML((cuenta.nombre || "?")[0].toUpperCase())}</span>`;

  if (cuenta.activa) {
    return `<div class="cuenta activa">${cara}<span class="cuenta-nombre">${nombreCuenta}</span><small>${t("Abierta")}</small></div>`;
  }
  return `
    <button class="cuenta" data-app="${escaparHTML(cuenta.app)}" title="${t("Cambiar a esta cuenta")}">
      ${cara}<span class="cuenta-nombre">${nombreCuenta}</span><small>${t("cuenta|Cambiar")}</small>
    </button>`;
}

function activarListaDeCuentas(contenedor) {
  contenedor.addEventListener("click", (e) => {
    const cuenta = e.target.closest("button.cuenta");
    if (!cuenta) return;
    for (const cada of contenedor.querySelectorAll("button")) cada.disabled = true;
    cambiarDeCuenta(cuenta.dataset.app).catch((error) => console.error(error));
  });
}

// ---------- Entrar ----------

function abrirEntrar() {
  dialogoEntrar.querySelector(".entrar-error").textContent = "";

  // Sin sesión, las cuentas que este navegador recuerda: se vuelve a ellas con un clic
  const otras = cuentasRecordadas().filter((cuenta) => !cuenta.activa);
  const caja = dialogoEntrar.querySelector(".cuentas-recordadas");
  caja.hidden = !otras.length;
  caja.innerHTML = otras.length
    ? `<span class="etiqueta-cuentas">${t("Volver a una cuenta")}</span>${otras.map(plantillaCuenta).join("")}`
    : "";

  if (!dialogoEntrar.open) dialogoEntrar.showModal();
  dialogoEntrar.querySelector(".entrar-nombre").focus();
}

function entrarConElFormulario() {
  return conBotonesApagados(dialogoEntrar, async (error) => {
    const usuario = dialogoEntrar.querySelector(".entrar-nombre").value.trim();
    const clave = dialogoEntrar.querySelector(".entrar-clave").value;
    if (!usuario || !clave) {
      error.textContent = t("Escribe tu usuario y tu contraseña.");
      return;
    }
    await entrarConUsuario(usuario, clave);
  });
}

// ---------- Crear cuenta ----------

function abrirCrear() {
  // Lo que ya hubiera escrito en «Usuario» se lleva a la nueva ventana
  dialogoCrear.querySelector(".crear-nombre").value = dialogoEntrar.querySelector(".entrar-nombre").value.trim();
  for (const campo of dialogoCrear.querySelectorAll('input[type="password"]')) campo.value = "";
  dialogoCrear.querySelector(".crear-error").textContent = "";
  dialogoEntrar.close();
  dialogoCrear.showModal();
  dialogoCrear.querySelector(".crear-nombre").focus();
}

function volverDeCrear() {
  dialogoCrear.close();
  abrirEntrar();
}

// El usuario es también su nombre de usuario: se comprueba antes que no lo tenga nadie
// (tampoco alguien de Google que se lo haya puesto) y, nada más crear la cuenta, se reserva.
function crearCuenta() {
  return conBotonesApagados(dialogoCrear, async (error) => {
    const usuario = dialogoCrear.querySelector(".crear-nombre").value.trim();
    const clave = dialogoCrear.querySelector(".crear-clave").value;
    const repetida = dialogoCrear.querySelector(".crear-repetir").value;

    if (!FORMATO_MOTE.test(usuario)) {
      error.textContent = `${t("Usuario no válido.")} ${EXPLICACION_MOTE}`;
      return;
    }
    if (!claveValida(clave)) {
      error.textContent = t(AVISO_CLAVE);
      return;
    }
    if (clave !== repetida) {
      error.textContent = t("Las contraseñas no coinciden.");
      return;
    }
    if (await dueñoDelMote(usuario)) {
      error.textContent = t("«{nombre}» ya lo tiene otra persona.", { nombre: usuario });
      return;
    }

    creandoCuenta = true;
    try {
      await crearCuentaDeUsuario(usuario, clave);
      const motivo = await cambiarMote(usuario);
      if (motivo) console.error("No se ha podido reservar el nombre de usuario", motivo);
    } finally {
      creandoCuenta = false;
      revisarMote(); // si no se pudo reservar, que lo elija a mano
    }
  });
}

// ---------- Nombre de usuario obligatorio ----------

// Lo que se propone de primeras: el nombre de Google sin acentos ni espacios
function propuesta() {
  const usuario = usuarioActual();
  const base = nombreDeUsuario(usuario) || (usuario && usuario.displayName) || "";
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_.-]/g, "")
    .slice(0, 20);
}

function revisarMote() {
  const perfil = miPerfil();
  const falta = Boolean(usuarioActual() && perfil && !perfil.mote && !creandoCuenta);

  if (falta && !dialogoMote.open) {
    dialogoMote.querySelector(".mote-nombre").value = propuesta();
    dialogoMote.querySelector(".mote-error").textContent = "";
    dialogoMote.showModal();
    dialogoMote.querySelector(".mote-nombre").focus();
  } else if (!falta && dialogoMote.open) {
    dialogoMote.close();
  }
}

function guardarMoteObligatorio() {
  return conBotonesApagados(dialogoMote, async (error) => {
    error.textContent = t("Comprobando...");
    error.textContent = await cambiarMote(dialogoMote.querySelector(".mote-nombre").value);
    // Si ha ido bien, se cierra sola al llegar el perfil con el mote (revisarMote)
  });
}

// ---------- Desplegable de cuentas ----------
//
// Al pulsar tu nombre: «Mi perfil», las cuentas de este navegador (pulsando otra se cambia)
// y «Añadir otra cuenta». Se cierra al pulsar fuera o con Escape.

function abrirMenuCuentas() {
  menuCuentas.querySelector(".menu-mi-perfil").innerHTML = `${icono("persona")} ${t("Mi perfil")}`;
  menuCuentas.querySelector(".menu-anadir").innerHTML = `${icono("mas")} ${t("Añadir otra cuenta")}`;
  menuCuentas.querySelector(".cuentas-lista").innerHTML = cuentasRecordadas().map(plantillaCuenta).join("");
  menuCuentas.hidden = false;
}

function cerrarMenuCuentas() {
  menuCuentas.hidden = true;
}

// El perfil se descarga la primera vez que se abre
function abrirPerfil() {
  cerrarMenuCuentas();
  import("./perfil.js")
    .then((modulo) => modulo.abrirMiPerfil())
    .catch((error) => console.error(error));
}

// ---------- Borrar la cuenta ----------

function abrirBorrar() {
  const deUsuario = Boolean(nombreDeUsuario(usuarioActual()));
  dialogoBorrar.querySelector(".borrar-clave-campo").hidden = !deUsuario;
  dialogoBorrar.querySelector(".borrar-google").hidden = deUsuario;
  dialogoBorrar.querySelector(".borrar-clave").value = "";
  dialogoBorrar.querySelector(".borrar-error").textContent = "";
  dialogoPerfil.close();
  dialogoBorrar.showModal();
}

// Primero se comprueba que eres tú (si no, Firebase no deja borrar la cuenta al final y se
// quedaría a medias). Luego se borra todo lo tuyo de Firestore y, lo último, la cuenta.
function borrarCuenta() {
  return conBotonesApagados(dialogoBorrar, async (error) => {
    const clave = dialogoBorrar.querySelector(".borrar-clave").value;
    if (nombreDeUsuario(usuarioActual()) && !clave) {
      error.textContent = t("Escribe tu contraseña.");
      return;
    }
    await confirmarIdentidad(clave);

    error.textContent = t("Borrando...");
    await borrarMiPresencia();
    await salirDeTodosMisLockes();
    // Mis hilos y comentarios del foro: si falla, que no impida borrar la cuenta
    await borrarMiForo().catch((fallo) => console.error(fallo));
    await borrarMisAmistades();     // también vacía los chats con mis amigos
    await borrarMisBloqueos().catch((fallo) => console.error(fallo));
    await borrarMisDatosGuardados();
    await borrarMiPerfil();
    // Las jugadas de «Juegos»: las reglas solo dejan borrarlas ya sin perfil
    await borrarMisJugadas().catch((fallo) => console.error(fallo));
    await borrarCuentaDeFirebase(); // recarga la página
  });
}

// ---------- Arranque ----------

export async function iniciarSesionUI() {
  if (!hayNube()) return; // sin configurar: el cajón se queda escondido

  cajon.hidden = false;
  alCambiarSesion(pintar);

  boton.addEventListener("click", async () => {
    if (!usuarioActual()) {
      abrirEntrar();
      return;
    }
    boton.disabled = true;
    try {
      await salir();
    } catch (error) {
      aviso.textContent = t("No se ha podido completar. Inténtalo otra vez.");
      console.error(error);
    }
    boton.disabled = false;
  });

  // Entrar
  dialogoEntrar.querySelector(".entrar-usuario").addEventListener("submit", (e) => {
    e.preventDefault();
    entrarConElFormulario();
  });
  dialogoEntrar.querySelector(".entrar-google").addEventListener("click", () =>
    conBotonesApagados(dialogoEntrar, () => entrar())
  );
  dialogoEntrar.querySelector(".entrar-crear").addEventListener("click", abrirCrear);
  dialogoEntrar.querySelector(".entrar-cerrar").addEventListener("click", () => dialogoEntrar.close());
  activarListaDeCuentas(dialogoEntrar.querySelector(".cuentas-recordadas"));

  // Crear cuenta
  dialogoCrear.querySelector(".crear-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    crearCuenta();
  });
  dialogoCrear.querySelector(".crear-volver").addEventListener("click", volverDeCrear);

  // Nombre de usuario obligatorio: ni Escape ni nada la cierra, solo guardar o salir
  dialogoMote.addEventListener("cancel", (e) => e.preventDefault());
  dialogoMote.querySelector(".mote-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarMoteObligatorio();
  });
  dialogoMote.querySelector(".mote-salir").addEventListener("click", () =>
    salir().catch((error) => console.error(error))
  );

  // Desplegable de cuentas y perfil
  cajon.querySelector(".sesion-perfil").addEventListener("click", (e) => {
    e.stopPropagation();
    if (menuCuentas.hidden) abrirMenuCuentas();
    else cerrarMenuCuentas();
  });
  menuCuentas.querySelector(".menu-mi-perfil").addEventListener("click", abrirPerfil);
  activarListaDeCuentas(menuCuentas.querySelector(".cuentas-lista"));
  menuCuentas.querySelector(".menu-anadir").addEventListener("click", (e) => {
    e.currentTarget.disabled = true;
    anadirCuenta().catch((error) => console.error(error));
  });
  document.addEventListener("click", (e) => {
    if (!menuCuentas.hidden && !menuCuentas.contains(e.target)) cerrarMenuCuentas();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarMenuCuentas();
  });

  // Borrar la cuenta
  dialogoPerfil.querySelector(".perfil-borrar").addEventListener("click", abrirBorrar);
  dialogoBorrar.querySelector(".borrar-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    borrarCuenta();
  });
  dialogoBorrar.querySelector(".borrar-cancelar").addEventListener("click", () => dialogoBorrar.close());

  // Todo esto antes de iniciarNube: así ya están escuchando cuando llegue la sesión
  iniciarPerfiles();
  iniciarLockes();
  iniciarChats();
  iniciarAvisosForo();
  iniciarAvisos();
  iniciarPresencia();
  iniciarLogros();
  alCambiarMiPerfil(() => {
    pintarNombre();
    revisarMote();
  });

  // Recién pulsado «Añadir otra cuenta»: se abre directamente la ventana de entrar
  if (tocaAbrirEntrar()) abrirEntrar();

  await iniciarNube();
}
