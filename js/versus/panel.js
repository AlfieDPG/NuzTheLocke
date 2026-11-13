// ---------- El panel de la derecha de un locke abierto: actividad y chat juntos ----------
//
// Al abrir un locke (js/versus/index.js), a su derecha va este panel: lo que ha ido pasando
// (js/versus/actividad.js, textoSuceso) y los mensajes del chat del locke, mezclados por fecha como
// el chat de un directo, con un filtro Todo / Chat / Actividad. El botón de actividad de la ficha
// de un rival filtra para ver solo lo suyo. Con un solo jugador no hay chat: solo la actividad.
//
// Se escucha en vivo solo mientras el locke está abierto (cada cosa que llega es una lectura).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual } from "../comun/nube.js";
import { claseMarcoDe } from "../comun/fichas.js";
import { lockePorId, escucharActividad } from "../comun/lockes.js";
import { escucharMensajesLocke, enviarMensajeLocke, MAX_MENSAJE } from "../comun/chat.js";
import { textoSuceso, iconoSuceso } from "./actividad.js";
import { t, LOCALE } from "../comun/idioma.js";

let panel = null;
let idLocke = null;
let filtro = "todo";    // "todo" | "chat" | "actividad"
let uidFiltrado = null; // solo lo de esta persona
let sucesos;            // undefined: aún no ha llegado; null: no se ha podido leer
let mensajes = [];
let pararActividad = null;
let pararChat = null;

function hace(cuando) {
  const segundos = Math.max(0, (Date.now() - cuando) / 1000);
  if (segundos < 60) return t("ahora");
  if (segundos < 3600) return t("hace {n} min", { n: Math.floor(segundos / 60) });
  if (segundos < 86400) return t("hace {n} h", { n: Math.floor(segundos / 3600) });
  if (segundos < 2 * 86400) return t("ayer");
  return new Date(cuando).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

const conChat = (locke) => (locke.jugadores || []).length > 1;

function plantillaCabeza(locke) {
  const quien = uidFiltrado ? escaparHTML((locke.nombres || {})[uidFiltrado] || t("Jugador")) : "";
  const boton = (valor, texto) => `<button data-filtro="${valor}" class="${filtro === valor ? "activo" : ""}">${texto}</button>`;
  return `
    <div class="panel-cabeza">
      <h3>${icono(conChat(locke) ? "mensaje" : "actividad")} ${conChat(locke) ? t("Actividad y chat") : t("Actividad")}</h3>
      ${conChat(locke) ? `<div class="panel-filtros">${boton("todo", t("Todo"))}${boton("chat", t("Chat"))}${boton("actividad", t("Actividad"))}</div>` : ""}
      ${uidFiltrado ? `<div class="panel-solo">${t("Solo lo de {nombre}", { nombre: quien })}<button class="panel-quitar-solo" aria-label="${t("Ver lo de todos")}" title="${t("Ver lo de todos")}">${icono("aspa")}</button></div>` : ""}
    </div>`;
}

function plantillaHilo(locke) {
  if (sucesos === undefined) return "";
  const yo = (usuarioActual() || {}).uid;
  const nombres = locke.nombres || {};
  const cosas = [];
  if (filtro !== "chat" && sucesos) {
    for (const suceso of sucesos) {
      if (uidFiltrado && suceso.uid !== uidFiltrado) continue;
      const texto = textoSuceso(suceso, locke);
      if (texto) cosas.push({ cuando: suceso.cuando, html: `<div class="panel-suceso"><span class="suceso-icono">${iconoSuceso(suceso)}</span><span>${texto}</span><time>${hace(suceso.cuando)}</time></div>` });
    }
  }
  if (filtro !== "actividad" && conChat(locke)) {
    for (const mensaje of mensajes) {
      if (uidFiltrado && mensaje.uid !== uidFiltrado) continue;
      const mio = mensaje.uid === yo;
      const nombre = nombres[mensaje.uid] || t("Jugador");
      const foto = (locke.fotos || {})[mensaje.uid] || "";
      // La cara de quien habla: a la izquierda la de los demás, a la derecha la tuya
      const cara = `<span class="panel-cara ${claseMarcoDe(mensaje.uid)}" title="${escaparHTML(nombre)}">${foto ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-quitar-si-falla>` : escaparHTML((nombre[0] || "?").toUpperCase())}</span>`;
      cosas.push({
        cuando: mensaje.creado,
        html: `
          <div class="panel-linea ${mio ? "mio" : ""}">
            ${mio ? "" : cara}
            <div class="panel-mensaje ${mio ? "mio" : ""}">
              ${mio ? "" : `<b>${escaparHTML(nombre)}</b>`}
              <p>${escaparHTML(mensaje.texto)}</p>
            </div>
            ${mio ? cara : ""}
          </div>`
      });
    }
  }
  if (!cosas.length) {
    const vacio = sucesos === null && filtro !== "chat" ? t("No se ha podido cargar.") : t("Todavía no ha pasado nada.");
    return `<p class="panel-vacio">${vacio}</p>`;
  }
  // Lo más nuevo, abajo (como en un chat)
  return cosas.sort((una, otra) => una.cuando - otra.cuando).map((cosa) => cosa.html).join("");
}

function pintar() {
  if (!panel || !idLocke) return;
  const locke = lockePorId(idLocke);
  if (!locke) return;
  const hilo = panel.querySelector(".panel-hilo");
  const alFinal = !hilo || hilo.scrollHeight - hilo.scrollTop - hilo.clientHeight < 80;
  const escrito = panel.querySelector(".panel-campo");
  const texto = escrito ? escrito.value : "";
  const conFoco = escrito && document.activeElement === escrito;

  panel.innerHTML = `
    ${plantillaCabeza(locke)}
    <div class="panel-hilo">${plantillaHilo(locke)}</div>
    ${conChat(locke) && locke.estado !== "cerrado"
      ? `<form class="panel-escribir">
           <input class="panel-campo" type="text" maxlength="${MAX_MENSAJE}" autocomplete="off" placeholder="${t("Escribe en el chat…")}" aria-label="${t("Mensaje para el chat del locke")}">
           <button type="submit" aria-label="${t("Enviar")}" title="${t("Enviar")}">${icono("enviar")}</button>
         </form>
         <p class="panel-error" hidden></p>`
      : ""}`;

  const campo = panel.querySelector(".panel-campo");
  if (campo) {
    campo.value = texto;
    if (conFoco) campo.focus();
  }
  const nuevo = panel.querySelector(".panel-hilo");
  if (alFinal) nuevo.scrollTop = nuevo.scrollHeight;
}

async function enviar() {
  const campo = panel.querySelector(".panel-campo");
  const texto = campo.value;
  if (!idLocke || !texto.trim()) return;
  campo.value = "";
  const error = panel.querySelector(".panel-error");
  try {
    await enviarMensajeLocke(idLocke, texto);
  } catch (fallo) {
    console.error(fallo);
    campo.value = texto;
    if (error) {
      error.hidden = false;
      error.textContent = t("No se ha podido enviar. Prueba de nuevo.");
    }
  }
}

function parar() {
  if (pararActividad) pararActividad();
  if (pararChat) pararChat();
  pararActividad = pararChat = null;
}

// El panel (vacío) dentro de su sitio. Una vez.
export function montarPanel(elemento) {
  panel = elemento;
  panel.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-filtro]");
    if (boton) {
      filtro = boton.dataset.filtro;
      pintar();
      return;
    }
    if (e.target.closest(".panel-quitar-solo")) {
      uidFiltrado = null;
      pintar();
    }
  });
  panel.addEventListener("submit", (e) => {
    e.preventDefault();
    enviar();
  });
}

// Empieza a escuchar el locke abierto (o lo deja si ya era ese)
export function mostrarPanel(id) {
  if (id === idLocke) {
    pintar();
    return;
  }
  parar();
  idLocke = id;
  filtro = "todo";
  uidFiltrado = null;
  sucesos = undefined;
  mensajes = [];
  pintar();
  pararActividad = escucharActividad(id, (llegados) => {
    sucesos = llegados;
    pintar();
  });
  const locke = lockePorId(id);
  if (locke && conChat(locke)) {
    pararChat = escucharMensajesLocke(
      id,
      (nuevos) => {
        mensajes = nuevos;
        pintar();
      },
      (fallo) => console.error("No se ha podido leer el chat del locke", fallo)
    );
  }
}

export function ocultarPanel() {
  parar();
  idLocke = null;
  if (panel) panel.innerHTML = "";
}

// El botón de actividad de la ficha de un rival: solo lo suyo
export function filtrarPanel(uid) {
  uidFiltrado = uid;
  if (filtro === "chat") filtro = "todo";
  pintar();
}

// Repintar cuando cambian los datos del locke (nombres, quién juega...)
export function repintarPanel() {
  pintar();
}
