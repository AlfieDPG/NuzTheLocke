// Ajustes de la web (el botón de la rueda, abajo del panel): el tema y el idioma.
//
// Se guardan como lo demás (almacen.js), así que con sesión iniciada se copian a la cuenta.
//   · Tema: atardecer (el de por defecto), oscuro o claro. Se pone en <html data-tema="oscuro">
//     o "claro"; el atardecer va sin nada. Lo pone ya el <script> del <head> de index.html
//     antes de pintar nada (para que no parpadee), y aquí se cambia al elegirlo. Sin nada
//     elegido, atardecer, salvo que el sistema esté en claro.
//   · Idioma: lo lee js/comun/idioma.js al cargar; cambiarlo recarga la página.

import { leer, escribir } from "./almacen.js";
import { cuandoEsteSincronizado } from "./nube.js";
import { CLAVE_AJUSTES } from "./claves-ajustes.js";
import { idioma } from "./idioma.js";

const sistemaClaro = matchMedia("(prefers-color-scheme: light)");

function ajustes() {
  return leer(CLAVE_AJUSTES, {}) || {};
}

function guardar(cambios) {
  escribir(CLAVE_AJUSTES, { ...ajustes(), ...cambios });
}

// ---------- Tema ----------

export function temaActual() {
  const { tema } = ajustes();
  if (tema === "atardecer" || tema === "oscuro" || tema === "claro") return tema;
  return sistemaClaro.matches ? "claro" : "atardecer";
}

function aplicarTema() {
  const tema = temaActual();
  if (tema === "atardecer") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  marcar("tema", tema);
}

export function cambiarTema(tema) {
  guardar({ tema });
  aplicarTema();
}

// ---------- Idioma ----------

export function cambiarIdioma(nuevo) {
  if (nuevo === idioma) return;
  guardar({ idioma: nuevo });
  location.reload();
}

// Si en la cuenta hay otro idioma (elegido en otro sitio), se recarga para ponerlo
function revisarIdioma() {
  const { idioma: guardado } = ajustes();
  if (guardado && guardado !== idioma) location.reload();
}

// ---------- Ventana ----------

// La opción elegida de cada fila, iluminada
function marcar(ajuste, valor) {
  for (const boton of document.querySelectorAll(`#dialogo-ajustes [data-${ajuste}]`)) {
    const elegido = boton.dataset[ajuste] === valor;
    boton.classList.toggle("elegido", elegido);
    boton.setAttribute("aria-checked", elegido);
  }
  for (const grupo of document.querySelectorAll("#dialogo-ajustes .ajustes-opciones")) moverSombra(grupo);
}

// La sombra de la elegida es una sola por fila (css/layout.css, .ajustes-opciones::before) y
// se desliza hasta la nueva. Con la ventana cerrada no hay medidas: se coloca al abrirla, sin
// animación (animar = false)
function moverSombra(grupo, animar = true) {
  const elegido = grupo.querySelector(".elegido");
  if (!elegido || !elegido.offsetWidth) return;
  if (!animar) grupo.classList.add("sin-animar");
  grupo.style.setProperty("--sombra-x", `${elegido.offsetLeft}px`);
  grupo.style.setProperty("--sombra-ancho", `${elegido.offsetWidth}px`);
  if (!animar) {
    void grupo.offsetWidth; // que se pinte ya en su sitio antes de volver a animar
    grupo.classList.remove("sin-animar");
  }
}

export function iniciarAjustes() {
  const dialogo = document.querySelector("#dialogo-ajustes");
  document.querySelector(".boton-ajustes").addEventListener("click", () => {
    dialogo.showModal();
    for (const grupo of dialogo.querySelectorAll(".ajustes-opciones")) moverSombra(grupo, false);
  });
  dialogo.querySelector(".ajustes-cerrar").addEventListener("click", () => dialogo.close());
  for (const boton of dialogo.querySelectorAll("[data-tema]")) {
    boton.addEventListener("click", () => cambiarTema(boton.dataset.tema));
  }
  for (const boton of dialogo.querySelectorAll("[data-idioma]")) {
    boton.addEventListener("click", () => cambiarIdioma(boton.dataset.idioma));
  }

  aplicarTema();
  marcar("idioma", idioma);
  // Si sigue al del sistema y este cambia; si llega otro de la cuenta; o si se cambia en otra pestaña
  sistemaClaro.addEventListener("change", aplicarTema);
  cuandoEsteSincronizado().then(() => {
    aplicarTema();
    revisarIdioma();
  });
  addEventListener("storage", (e) => {
    if (e.key !== CLAVE_AJUSTES) return;
    aplicarTema();
    revisarIdioma();
  });
}
