// Ventana del chat con tus amigos y de cada locke. Dos vistas dentro de la misma ventana:
//
//   · Lista: tus amigos, los que te han escrito sin que lo hayas leído arriba. Abajo, las personas
//     que has bloqueado (para desbloquearlas).
//   · Conversación: los últimos mensajes con un amigo, en vivo, y la casilla para escribir. Arriba,
//     vaciar la conversación, denunciar a esa persona y bloquearla.
//
//   · Chat de un locke (abrirChatLocke): una sola conversación entre los que juegan, con el nombre de
//     cada uno encima de sus mensajes. Quien creó el locke puede borrar los mensajes de los demás.
//
// Los mensajes caducan a los 90 días y se borran del servidor desde la web (ver js/comun/chat.js). Se abre con abrirChat(): sin
// nada va a la lista y con el uid de un amigo, directo a su conversación. Se descarga la primera
// vez que se abre (ver avisos.js).

import { icono } from "./comun/iconos.js";
import { escaparHTML } from "./comun/utilidades.js";
import { claseMarcoDe } from "./comun/fichas.js";
import { t, LOCALE } from "./comun/idioma.js";
import { usuarioActual } from "./comun/nube.js";
import { amigosAceptados, perfilesDeAmigos, perfilesDe } from "./comun/perfiles.js";
import { estaConectado, alCambiarPresencia } from "./comun/presencia.js";
import {
  alCambiarChats, haySinLeer, ultimoMensajeEn, escucharMensajes, enviarMensaje, marcarLeido,
  vaciarConversacion, borrarMensaje, bloquear, desbloquear, misBloqueados, MAX_MENSAJE, DIAS_CADUCA,
  escucharMensajesLocke, enviarMensajeLocke, borrarMensajeLocke
} from "./comun/chat.js";
import { lockePorId, soyCreador } from "./comun/lockes.js";
import { confirmar, avisar } from "./comun/ventanas.js";

const dialogo = document.querySelector("#dialogo-chat");
const titulo = dialogo.querySelector(".chat-titulo");
const botonVolver = dialogo.querySelector(".chat-volver");
const acciones = dialogo.querySelector(".chat-acciones");
const lista = dialogo.querySelector(".chat-lista");
const conversacion = dialogo.querySelector(".chat-conversacion");
const zonaMensajes = dialogo.querySelector(".chat-mensajes");
const formulario = dialogo.querySelector(".chat-formulario");
const campo = dialogo.querySelector(".chat-campo");
const botonEnviar = dialogo.querySelector(".chat-enviar");
const error = dialogo.querySelector(".chat-error");

let abierto = null;          // uid del amigo (o id del locke) cuya conversación se ve; null si es la lista
let modo = "amigo";          // "amigo": chat 1 a 1; "locke": el chat común de un locke
let mensajes = [];
let hayMas = false;
let pararMensajes = null;
let verBloqueados = false;
const nombresAjenos = new Map(); // uid -> perfil de alguien bloqueado (no es amigo: se pide aparte)

// ---------- Piezas ----------

function perfilDe(uid) {
  return perfilesDeAmigos().get(uid) || nombresAjenos.get(uid) || { uid, nombre: t("Jugador"), foto: "" };
}

function foto(perfil, clase) {
  clase = `${clase} ${claseMarcoDe(perfil.uid)}`; // su marco (js/comun/fichas.js)
  const nombre = perfil.nombre || "?";
  return perfil.foto
    ? `<img class="${clase}" src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase} sin-foto">${escaparHTML(nombre[0].toUpperCase())}</span>`;
}

function hora(ms) {
  return new Date(ms).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

// «Hoy», «Ayer» o la fecha
function dia(ms) {
  const fecha = new Date(ms);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86400000);
  if (fecha.toDateString() === hoy.toDateString()) return t("Hoy");
  if (fecha.toDateString() === ayer.toDateString()) return t("Ayer");
  return fecha.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: fecha.getFullYear() === hoy.getFullYear() ? undefined : "numeric" });
}

// ---------- Lista ----------

function filasDeAmigos() {
  return amigosAceptados()
    .map((amistad) => perfilDe(amistad.otro))
    .sort(
      (uno, otro) =>
        Number(haySinLeer(otro.uid)) - Number(haySinLeer(uno.uid)) ||
        ultimoMensajeEn(otro.uid) - ultimoMensajeEn(uno.uid) ||
        Number(estaConectado(otro.uid)) - Number(estaConectado(uno.uid)) ||
        (uno.nombre || "").localeCompare(otro.nombre || "", LOCALE)
    );
}

function plantillaFila(perfil) {
  const sinLeer = haySinLeer(perfil.uid);
  const conectado = estaConectado(perfil.uid);
  return `
    <button class="chat-fila ${sinLeer ? "sin-leer" : ""}" data-uid="${escaparHTML(perfil.uid)}">
      ${foto(perfil, "chat-foto")}
      <span class="chat-fila-nombre">${escaparHTML(perfil.nombre)}</span>
      ${conectado ? `<span class="chat-fila-estado"><span class="punto-conectado"></span>${t("Conectado")}</span>` : ""}
      ${sinLeer ? `<span class="chat-fila-nuevo">${t("Nuevo")}</span>` : ""}
    </button>`;
}

function plantillaBloqueados() {
  const uids = misBloqueados();
  if (!uids.length) return "";
  const faltan = uids.filter((uid) => !nombresAjenos.has(uid) && !perfilesDeAmigos().has(uid));
  if (faltan.length) {
    perfilesDe(faltan)
      .then((mapa) => {
        for (const [uid, perfil] of mapa) nombresAjenos.set(uid, perfil);
        if (dialogo.open && !abierto) pintarLista();
      })
      .catch((fallo) => console.error(fallo));
  }

  return `
    <div class="chat-bloqueados">
      <button class="chat-ver-bloqueados">${t("Personas bloqueadas ({n})", { n: uids.length })} ${icono(verBloqueados ? "arriba" : "abajo")}</button>
      ${verBloqueados
        ? uids
            .map((uid) => {
              const perfil = perfilDe(uid);
              return `
                <div class="chat-bloqueado">
                  ${foto(perfil, "chat-foto")}
                  <span class="chat-fila-nombre">${escaparHTML(perfil.nombre)}</span>
                  <button class="chat-desbloquear" data-uid="${escaparHTML(uid)}">${t("Desbloquear")}</button>
                </div>`;
            })
            .join("")
        : ""}
    </div>`;
}

function pintarLista() {
  const filas = filasDeAmigos();
  lista.innerHTML =
    (filas.length
      ? `<div class="chat-filas">${filas.map(plantillaFila).join("")}</div>`
      : `<p class="chat-vacio">${t("Todavía no tienes amigos con los que chatear. Pídele amistad a alguien desde el foro o desde Amigos.")}</p>`) +
    plantillaBloqueados();
}

// ---------- Conversación ----------

// En el chat de un locke, el nombre de cada jugador (lo lleva el propio locke)
function nombreEnLocke(uid) {
  const locke = lockePorId(abierto);
  return ((locke && locke.nombres) || {})[uid] || t("Jugador");
}

function plantillaMensaje(mensaje, yo) {
  const mio = mensaje.uid === yo;
  // Cada uno borra los suyos; en un locke, quien lo creó también los de los demás
  const puedeBorrar = mio || (modo === "locke" && soyCreador(lockePorId(abierto)));
  return `
    <div class="chat-mensaje ${mio ? "mio" : ""} ${mensaje.enviando ? "enviando" : ""}" data-id="${escaparHTML(mensaje.id)}">
      ${modo === "locke" && !mio ? `<span class="chat-autor">${escaparHTML(nombreEnLocke(mensaje.uid))}</span>` : ""}
      <p class="chat-texto">${escaparHTML(mensaje.texto)}</p>
      <span class="chat-hora">${hora(mensaje.creado)}</span>
      ${puedeBorrar && !mensaje.enviando ? `<button class="chat-borrar" title="${t("Borrar este mensaje")}">${icono("aspa")}</button>` : ""}
    </div>`;
}

function pintarMensajes() {
  const yo = (usuarioActual() || {}).uid;
  const alFinal = zonaMensajes.scrollHeight - zonaMensajes.scrollTop - zonaMensajes.clientHeight < 80;
  const primera = !zonaMensajes.childElementCount;

  let ultimoDia = "";
  const piezas = mensajes.map((mensaje) => {
    const etiqueta = dia(mensaje.creado);
    const separador = etiqueta !== ultimoDia ? `<div class="chat-dia"><span>${escaparHTML(etiqueta)}</span></div>` : "";
    ultimoDia = etiqueta;
    return separador + plantillaMensaje(mensaje, yo);
  });

  zonaMensajes.innerHTML = mensajes.length
    ? (hayMas ? `<p class="chat-aviso-viejos">${t("Solo se ven los últimos mensajes.")}</p>` : "") + piezas.join("")
    : `<p class="chat-vacio">${t("Aún no hay mensajes. Saluda.")}</p>`;

  if (primera || alFinal) zonaMensajes.scrollTop = zonaMensajes.scrollHeight;
}

// El chat común de un locke: entra cualquiera de los que juegan (las reglas lo comprueban)
function empezarConversacionLocke(id) {
  modo = "locke";
  abierto = id;
  mensajes = [];
  hayMas = false;
  error.textContent = "";
  campo.value = "";
  zonaMensajes.innerHTML = "";
  pintarCabeza();
  pintarMensajes();

  if (pararMensajes) pararMensajes();
  pararMensajes = escucharMensajesLocke(
    id,
    (nuevos, mas) => {
      mensajes = nuevos;
      hayMas = mas;
      if (abierto === id && modo === "locke") pintarMensajes();
    },
    (fallo) => {
      console.error(fallo);
      error.textContent = fallo && fallo.code === "permission-denied"
        ? t("Firebase no deja leer el chat. Falta publicar las reglas de Firestore, o ya no juegas en este locke.")
        : t("No se han podido cargar los mensajes.");
    }
  );
  campo.focus();
}

function empezarConversacion(uid) {
  modo = "amigo";
  abierto = uid;
  mensajes = [];
  hayMas = false;
  error.textContent = "";
  campo.value = "";
  zonaMensajes.innerHTML = "";
  pintarCabeza();
  pintarMensajes();

  if (pararMensajes) pararMensajes();
  pararMensajes = escucharMensajes(
    uid,
    (nuevos, mas) => {
      mensajes = nuevos;
      hayMas = mas;
      if (abierto !== uid) return;
      pintarMensajes();
      // Si lo último es de él y la ventana está a la vista, queda leído
      if (dialogo.open && mensajes.some((mensaje) => mensaje.uid === uid)) {
        marcarLeido(uid).catch((fallo) => console.error(fallo));
      }
    },
    (fallo) => {
      console.error(fallo);
      error.textContent = fallo && fallo.code === "permission-denied"
        ? t("Firebase no deja leer el chat. Falta publicar las reglas de Firestore, o ya no sois amigos.")
        : t("No se han podido cargar los mensajes.");
    }
  );
  campo.focus();
}

function pintarCabeza() {
  if (!abierto) {
    titulo.innerHTML = t("Chats");
    botonVolver.hidden = true;
    acciones.hidden = true;
    lista.hidden = false;
    conversacion.hidden = true;
    return;
  }

  // El chat de un locke: su nombre, sin atrás ni acciones de persona (no es de nadie en concreto)
  if (modo === "locke") {
    const locke = lockePorId(abierto);
    titulo.innerHTML = `${icono("espadas")}<span>${escaparHTML((locke && locke.nombre) || t("Locke"))}</span>`;
    botonVolver.hidden = true;
    acciones.hidden = true;
    lista.hidden = true;
    conversacion.hidden = false;
    return;
  }

  const perfil = perfilDe(abierto);
  titulo.innerHTML = `${foto(perfil, "chat-foto")}<span>${escaparHTML(perfil.nombre)}${
    estaConectado(abierto) ? ` <small class="chat-conectado"><span class="punto-conectado"></span>${t("Conectado")}</small>` : ""
  }</span>`;
  botonVolver.hidden = false;
  acciones.hidden = false;
  lista.hidden = true;
  conversacion.hidden = false;
}

function cerrarConversacion() {
  if (pararMensajes) pararMensajes();
  pararMensajes = null;
  abierto = null;
  mensajes = [];
  pintarCabeza();
  pintarLista();
}

// ---------- Acciones ----------

async function enviar() {
  const uid = abierto;
  const texto = campo.value;
  if (!uid || !texto.trim()) return;
  campo.value = "";
  crecerCampo();
  error.textContent = "";
  try {
    if (modo === "locke") await enviarMensajeLocke(uid, texto);
    else await enviarMensaje(uid, texto);
  } catch (fallo) {
    console.error(fallo);
    if (abierto === uid && !campo.value) campo.value = texto;
    error.textContent = fallo && fallo.code === "permission-denied"
      ? t(modo === "locke"
          ? "No se ha podido enviar. Puede que ya no juegues en este locke, o que falten por publicar las reglas de Firestore."
          : "No se ha podido enviar. Puede que ya no seáis amigos, o que falten por publicar las reglas de Firestore.")
      : t("No se ha podido enviar. Prueba de nuevo.");
  }
}

async function vaciar() {
  const uid = abierto;
  if (!uid || !(await confirmar(t("¿Vaciar la conversación? Se borran los mensajes para los dos."), { aceptar: t("Vaciar") }))) return;
  try {
    await vaciarConversacion(uid);
  } catch (fallo) {
    console.error(fallo);
    error.textContent = t("No se ha podido vaciar. Prueba de nuevo.");
  }
}

async function bloquearAmigo() {
  const uid = abierto;
  if (!uid) return;
  const nombre = perfilDe(uid).nombre;
  const quiere = await confirmar(
    t("¿Bloquear a {nombre}? Dejaréis de ser amigos, se borrará el chat y no podrá volver a pedirte amistad.", { nombre }),
    { aceptar: t("Bloquear") }
  );
  if (!quiere) return;
  try {
    await bloquear(uid);
    cerrarConversacion();
    avisar(t("{nombre} bloqueado.", { nombre }));
  } catch (fallo) {
    console.error(fallo);
    error.textContent = t("No se ha podido bloquear. Prueba de nuevo.");
  }
}

// Denunciar a la persona, con sus últimos mensajes como copia (el chat es privado: sin esto el
// moderador no tendría nada que mirar). Usa la ventana de denuncias del foro.
async function denunciarAmigo() {
  const uid = abierto;
  if (!uid) return;
  const suyos = mensajes.filter((mensaje) => mensaje.uid === uid).slice(-5).map((mensaje) => mensaje.texto);
  const copia = `${perfilDe(uid).nombre}: ${suyos.join(" / ")}`.slice(0, 700);
  const { prepararSeccion } = await import("./navegacion.js");
  const foro = await prepararSeccion("foro");
  foro.denunciarPersona(uid, copia);
}

// ---------- Casilla de escribir ----------

function crecerCampo() {
  campo.style.height = "auto";
  campo.style.height = `${Math.min(campo.scrollHeight, 130)}px`;
}

campo.addEventListener("input", crecerCampo);
campo.addEventListener("keydown", (e) => {
  // Enter envía; con Mayús, salto de línea
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    enviar();
  }
});
formulario.addEventListener("submit", (e) => {
  e.preventDefault();
  enviar();
});

// ---------- Eventos ----------

lista.addEventListener("click", async (e) => {
  const fila = e.target.closest(".chat-fila");
  if (fila) return empezarConversacion(fila.dataset.uid);

  if (e.target.closest(".chat-ver-bloqueados")) {
    verBloqueados = !verBloqueados;
    return pintarLista();
  }

  const desbloqueo = e.target.closest(".chat-desbloquear");
  if (desbloqueo) {
    desbloqueo.disabled = true;
    try {
      await desbloquear(desbloqueo.dataset.uid);
    } catch (fallo) {
      console.error(fallo);
      desbloqueo.disabled = false;
    }
  }
});

zonaMensajes.addEventListener("click", async (e) => {
  const borrar = e.target.closest(".chat-borrar");
  if (!borrar || !abierto) return;
  try {
    const idMensaje = borrar.closest(".chat-mensaje").dataset.id;
    if (modo === "locke") await borrarMensajeLocke(abierto, idMensaje);
    else await borrarMensaje(abierto, idMensaje);
  } catch (fallo) {
    console.error(fallo);
    error.textContent = t("No se ha podido borrar. Prueba de nuevo.");
  }
});

botonVolver.addEventListener("click", cerrarConversacion);
dialogo.querySelector(".chat-vaciar").addEventListener("click", vaciar);
dialogo.querySelector(".chat-denunciar").addEventListener("click", () => denunciarAmigo().catch((fallo) => console.error(fallo)));
dialogo.querySelector(".chat-bloquear").addEventListener("click", bloquearAmigo);
dialogo.querySelector(".chat-cerrar").addEventListener("click", () => dialogo.close());
dialogo.addEventListener("close", () => {
  if (pararMensajes) pararMensajes();
  pararMensajes = null;
  abierto = null;
  modo = "amigo";
});

// Pulsando fuera de la ventana (en lo oscuro de alrededor) se cierra, si empieza y acaba fuera
const fueraDe = (e) => {
  const caja = dialogo.getBoundingClientRect();
  return e.target === dialogo &&
    (e.clientX < caja.left || e.clientX > caja.right || e.clientY < caja.top || e.clientY > caja.bottom);
};
let empezoFuera = false;
dialogo.addEventListener("pointerdown", (e) => (empezoFuera = fueraDe(e)));
dialogo.addEventListener("click", (e) => {
  if (empezoFuera && fueraDe(e)) dialogo.close();
  empezoFuera = false;
});

// Botones con su icono
botonVolver.innerHTML = icono("arriba");
dialogo.querySelector(".chat-vaciar").innerHTML = icono("papelera");
dialogo.querySelector(".chat-denunciar").innerHTML = icono("bandera");
dialogo.querySelector(".chat-bloquear").innerHTML = icono("candado");
dialogo.querySelector(".chat-cerrar").innerHTML = icono("aspa");
botonEnviar.innerHTML = icono("enviar");
campo.maxLength = MAX_MENSAJE;
dialogo.querySelector(".chat-pie").textContent = t("Los mensajes caducan a los {n} días.", { n: DIAS_CADUCA });

// Al día mientras está abierta: quién te ha escrito, quién está conectado, si dejáis de ser amigos
const repintar = () => {
  if (!dialogo.open || modo === "locke") return;
  if (abierto && !amigosAceptados().some((amistad) => amistad.otro === abierto)) {
    cerrarConversacion();
    return;
  }
  if (abierto) pintarCabeza();
  else pintarLista();
};
alCambiarChats(repintar);
alCambiarPresencia(repintar);

// ---------- Abrir ----------

// Sin uid, la lista de chats; con el de un amigo, su conversación
export function abrirChat(uid = null) {
  if (!usuarioActual()) return;
  verBloqueados = false;
  modo = "amigo";
  if (uid && amigosAceptados().some((amistad) => amistad.otro === uid)) {
    pintarCabeza();
    if (!dialogo.open) dialogo.showModal();
    empezarConversacion(uid);
  } else {
    abierto = null;
    pintarCabeza();
    pintarLista();
    if (!dialogo.open) dialogo.showModal();
  }
}

// El chat común de un locke, desde su tarjeta en «Lockes»
export function abrirChatLocke(id) {
  if (!usuarioActual() || !lockePorId(id)) return;
  verBloqueados = false;
  empezarConversacionLocke(id);
  if (!dialogo.open) dialogo.showModal();
  campo.focus();
}
