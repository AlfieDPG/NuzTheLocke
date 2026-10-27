// ---------- Buzón de invitaciones ----------
//
// La campana va a la derecha de tu nombre, abajo del panel lateral, con un número cuando hay
// algo pendiente. Está ahí y no dentro de «Amigos» a propósito: una invitación a un locke
// puede llegar mientras estás montando un equipo, y así la ves desde cualquier sección.
// Como vive dentro de .sesion-usuario, se esconde sola cuando no hay sesión.
//
// Dentro caben cuatro cosas (y, aparte, el botón de chats junto a la campana):
//   · solicitudes de amistad que te han mandado
//   · invitaciones a un locke de «Lockes»
//   · avisos del árbitro de normas: lo que ha visto en la partida de otro jugador de un locke
//     tuyo con árbitro (js/partida/arbitro.js). Se quitan con el visto, y se guardan como
//     vistos en tu cuenta para no volver a salir en otro dispositivo.
//   · respuestas nuevas a tus hilos del foro (js/comun/avisos-foro.js)
//
// Las listas están escuchadas en vivo, así que el número sube y baja solo.

import { icono } from "./comun/iconos.js";
import { escaparHTML } from "./comun/utilidades.js";
import { t } from "./comun/idioma.js";
import { hayNube, usuarioActual } from "./comun/nube.js";
import {
  alCambiarAmistades, solicitudesRecibidas, aceptarAmistad, borrarAmistad, perfilesDe, colorDeTipo
} from "./comun/perfiles.js";
import {
  alCambiarLockes, invitacionesALockes, aceptarLocke, rechazarLocke, miEstado, lockePorId, escucharInfracciones
} from "./comun/lockes.js";
import { chatsSinLeer, alCambiarChats } from "./comun/chat.js";
import { respuestasNuevas, marcarHiloVisto, alCambiarAvisosForo } from "./comun/avisos-foro.js";
import { leer, escribir } from "./comun/almacen.js";
import { irA, prepararSeccion } from "./navegacion.js";

const CLAVE_VISTOS = "poketeams-avisos-arbitro-v1"; // ids de los avisos del árbitro que ya has visto
const DIAS_VIGENTES = 14;                           // los avisos más viejos ya no salen
const MAX_VISTOS = 200;

let boton = null;
let cuenta = null;
let dialogo = null;
let listaDialogo = null;

// uid -> nombre, para las solicitudes de amistad (las de locke ya traen el nombre dentro)
let nombres = new Map();

// ---------- Pintar ----------

function plantillaAmistad(amistad) {
  const nombre = escaparHTML(nombres.get(amistad.otro) || t("Alguien"));
  return `
    <div class="aviso" data-tipo="amistad" data-id="${escaparHTML(amistad.id)}">
      <span class="aviso-icono amistad">${icono("personaMas")}</span>
      <span class="aviso-texto">${t("{nombre} quiere ser tu amigo", { nombre: `<b>${nombre}</b>` })}</span>
      <button class="aviso-si" title="${t("Aceptar")}">${icono("visto")}</button>
      <button class="aviso-no" title="${t("Rechazar")}">${icono("aspa")}</button>
    </div>`;
}

function plantillaLocke(locke) {
  const tipo = locke.tipo || { nombre: "Locke", color: "#3498db" };
  const quien = escaparHTML((locke.nombres || {})[locke.creador] || t("Alguien"));

  return `
    <div class="aviso" data-tipo="locke" data-id="${escaparHTML(locke.id)}">
      <span class="aviso-icono de-locke" style="--color-locke: ${colorDeTipo(tipo)}">${icono("espadas")}</span>
      <span class="aviso-texto">
        ${t("{quien} te mete en {locke}", { quien: `<b>${quien}</b>`, locke: `<b>${escaparHTML(locke.nombre)}</b>` })}
        <small>${escaparHTML(tipo.nombre)} · ${t("{n} vidas", { n: locke.vidasIniciales })}</small>
      </span>
      <button class="aviso-si" title="${t("Entrar")}">${icono("visto")}</button>
      <button class="aviso-no" title="${t("No entrar")}">${icono("aspa")}</button>
    </div>`;
}

// ---------- Avisos del árbitro ----------

const escuchas = new Map(); // id del locke -> { avisos: [...], parar }
let textoInfraccion = null; // de js/partida/infracciones.js: se baja la primera vez que hace falta

// Escucha los avisos de los lockes con árbitro en los que estás dentro y siguen abiertos
function vigilar(lockes) {
  const usuario = usuarioActual();
  const quiero = new Set(
    usuario && hayNube()
      ? lockes.filter((locke) => locke.arbitro && locke.estado !== "cerrado" && miEstado(locke) === "aceptado").map((locke) => locke.id)
      : []
  );

  for (const [id, escucha] of escuchas) {
    if (quiero.has(id)) continue;
    escucha.parar();
    escuchas.delete(id);
  }
  for (const id of quiero) {
    if (escuchas.has(id)) continue;
    const escucha = { avisos: [], parar: () => {} };
    escuchas.set(id, escucha);
    escucha.parar = escucharInfracciones(id, (avisos) => {
      escucha.avisos = avisos;
      if (avisos.length && !textoInfraccion) {
        import("./partida/infracciones.js").then((modulo) => {
          textoInfraccion = modulo.textoInfraccion;
          pintar();
        }).catch((error) => console.error(error));
      }
      pintar();
    });
  }
}

// Los de otros que aún no has visto, del más nuevo al más viejo
function avisosDelArbitro() {
  const usuario = usuarioActual();
  if (!usuario || !hayNube()) return [];
  const vistos = new Set(leer(CLAVE_VISTOS, []) || []);
  const desde = Date.now() - DIAS_VIGENTES * 86400000;
  const lista = [];
  for (const [id, escucha] of escuchas) {
    const locke = lockePorId(id);
    if (!locke) continue;
    for (const aviso of escucha.avisos) {
      if (aviso.uid !== usuario.uid && aviso.cuando > desde && !vistos.has(aviso.id)) lista.push({ ...aviso, locke });
    }
  }
  return lista.sort((uno, otro) => otro.cuando - uno.cuando);
}

function marcarVisto(id) {
  const vistos = (leer(CLAVE_VISTOS, []) || []).filter((cada) => cada !== id);
  vistos.push(id);
  escribir(CLAVE_VISTOS, vistos.slice(-MAX_VISTOS));
  pintar();
}

function plantillaArbitro(aviso) {
  const negrita = (dato) => `<b>${escaparHTML(dato)}</b>`;
  const quien = negrita((aviso.locke.nombres || {})[aviso.uid] || t("Alguien"));
  const caso = textoInfraccion ? textoInfraccion(aviso.detalle, negrita) : "";

  return `
    <div class="aviso" data-tipo="arbitro" data-id="${escaparHTML(aviso.id)}">
      <span class="aviso-icono arbitro">${icono("aviso")}</span>
      <span class="aviso-texto aviso-ir" title="${t("Ir a Lockes")}">
        ${t("El árbitro ve algo raro en {quien}: {caso}", { quien, caso })}
        <small>${escaparHTML(aviso.locke.nombre)}</small>
      </span>
      <button class="aviso-si" title="${t("Entendido")}">${icono("visto")}</button>
    </div>`;
}

// ---------- Respuestas a tus hilos del foro ----------

function plantillaForo(hilo) {
  return `
    <div class="aviso" data-tipo="foro" data-id="${escaparHTML(hilo.id)}">
      <span class="aviso-icono foro">${icono("mensaje")}</span>
      <span class="aviso-texto aviso-ir" title="${t("Abrir el hilo")}">
        ${t(hilo.nuevas === 1 ? "{n} respuesta nueva en tu hilo" : "{n} respuestas nuevas en tu hilo", { n: hilo.nuevas })}
        <small>${escaparHTML(hilo.titulo)}</small>
      </span>
      <button class="aviso-si" title="${t("Entendido")}">${icono("visto")}</button>
    </div>`;
}

// El foro se descarga la primera vez; el hilo se abre una vez que la sección está lista
async function abrirHiloDelForo(id) {
  dialogo.close();
  await irA("foro");
  const foro = await prepararSeccion("foro");
  foro.abrirHiloDe(id);
  marcarHiloVisto(id);
}

function pendientes() {
  if (!hayNube() || !usuarioActual()) return { amistades: [], lockes: [], arbitro: [], foro: [] };
  return { amistades: solicitudesRecibidas(), lockes: invitacionesALockes(), arbitro: avisosDelArbitro(), foro: respuestasNuevas() };
}

function pintar() {
  const { amistades, lockes, arbitro, foro } = pendientes();
  const total = amistades.length + lockes.length + arbitro.length + foro.length;

  cuenta.textContent = total;
  cuenta.hidden = total === 0;
  boton.classList.toggle("con-avisos", total > 0);
  boton.title = total === 0 ? t("Notificaciones") : t(total === 1 ? "Tienes {n} notificación" : "Tienes {n} notificaciones", { n: total });

  listaDialogo.innerHTML = total
    ? [...amistades.map(plantillaAmistad), ...lockes.map(plantillaLocke), ...arbitro.map(plantillaArbitro), ...foro.map(plantillaForo)].join("")
    : `<p class="aviso-vacio">${t("No tienes nada pendiente.")}</p>`;
}

// Los nombres de quien te manda una solicitud hay que ir a buscarlos a su perfil
async function traerNombres(amistades) {
  const faltan = amistades.map((amistad) => amistad.otro).filter((uid) => !nombres.has(uid));
  if (!faltan.length) return;

  const perfiles = await perfilesDe(faltan);
  for (const [uid, perfil] of perfiles) nombres.set(uid, perfil.nombre);
  pintar();
}

// ---------- Contestar ----------

async function contestar(aviso, acepta) {
  const { tipo, id } = aviso.dataset;

  for (const cada of aviso.querySelectorAll("button")) cada.disabled = true;

  try {
    if (tipo === "amistad") {
      if (acepta) await aceptarAmistad(id);
      else await borrarAmistad(id);
    } else {
      if (acepta) await aceptarLocke(id);
      else await rechazarLocke(id);
    }
  } catch (error) {
    console.error(error);
    for (const cada of aviso.querySelectorAll("button")) cada.disabled = false;
  }
}

// ---------- Arranque ----------

export function iniciarAvisos() {
  boton = document.querySelector(".avisos-boton:not(.chat-boton)");
  dialogo = document.querySelector("#dialogo-avisos");
  listaDialogo = dialogo.querySelector(".avisos-lista");

  boton.innerHTML = `${icono("campana")}<span class="avisos-cuenta" hidden></span>`;
  cuenta = boton.querySelector(".avisos-cuenta");

  boton.addEventListener("click", () => dialogo.showModal());
  dialogo.querySelector("#avisos-cerrar").addEventListener("click", () => dialogo.close());

  // Los chats, al lado de la campana: el número es de los chats con algo sin leer. La ventana
  // se descarga la primera vez que se abre.
  const botonChat = document.querySelector(".chat-boton");
  botonChat.innerHTML = `${icono("mensaje")}<span class="avisos-cuenta" hidden></span>`;
  const cuentaChat = botonChat.querySelector(".avisos-cuenta");
  botonChat.addEventListener("click", () => {
    import("./chat.js").then((modulo) => modulo.abrirChat()).catch((error) => console.error(error));
  });
  alCambiarChats(() => {
    const sinLeer = chatsSinLeer().length;
    cuentaChat.textContent = sinLeer;
    cuentaChat.hidden = sinLeer === 0;
    botonChat.classList.toggle("con-avisos", sinLeer > 0);
    botonChat.title = sinLeer === 0
      ? t("Chats")
      : t(sinLeer === 1 ? "Tienes {n} chat con mensajes sin leer" : "Tienes {n} chats con mensajes sin leer", { n: sinLeer });
  });

  listaDialogo.addEventListener("click", (e) => {
    const aviso = e.target.closest(".aviso");
    const si = e.target.closest(".aviso-si");
    const no = e.target.closest(".aviso-no");
    if (aviso && aviso.dataset.tipo === "foro") {
      if (si) marcarHiloVisto(aviso.dataset.id);
      else if (e.target.closest(".aviso-ir")) abrirHiloDelForo(aviso.dataset.id).catch((error) => console.error(error));
      return;
    }
    if (aviso && aviso.dataset.tipo === "arbitro") {
      if (si) marcarVisto(aviso.dataset.id);
      else if (e.target.closest(".aviso-ir")) {
        dialogo.close();
        irA("lockes");
      }
      return;
    }
    if (!aviso || (!si && !no)) return;
    contestar(aviso, Boolean(si));
  });

  alCambiarAmistades((amistades) => {
    pintar();
    traerNombres(amistades.filter((amistad) => amistad.estado === "pendiente")).catch((error) =>
      console.error(error)
    );
  });

  alCambiarLockes((lockes) => {
    vigilar(lockes);
    pintar();
  });

  alCambiarAvisosForo(pintar);
}
