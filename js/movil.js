// ---------- El móvil: barra de abajo y hoja de «Más» ----------
//
// En pantallas estrechas (css/movil.css) el panel lateral pasa a ser una barra fina arriba (logo,
// chat, campana y tu foto) y abajo sale .barra-movil con las secciones de más uso: Inicio, Lockes,
// Rutas, Level caps y «Más». «Más» abre el menú lateral entero (el mismo, con sus grupos, la sesión y
// el pie) como una hoja que sube desde abajo. Mientras está abierta, «Más» pasa a ser una aspa. Se
// cierra al elegir una sección, al tocar fuera, con esa aspa o con «Atrás» (js/comun/atras.js).
//
// La barra de abajo marca la sección abierta; si no es una de las suyas, marca «Más».

import { icono } from "./comun/iconos.js";
import { t } from "./comun/idioma.js";
import { irA } from "./navegacion.js";
import { abrirCapa, cerrarCapa } from "./comun/atras.js";

export const ES_MOVIL = matchMedia("(max-width: 760px)");

const barra = document.querySelector(".barra-movil");
const botonMas = barra.querySelector(".barra-movil-mas");
const lateral = document.querySelector(".barra-lateral");
const menu = lateral.querySelector(".menu-lateral");
const fondo = document.querySelector(".hoja-fondo");

const capa = {
  abierta: () => lateral.classList.contains("hoja-abierta"),
  cerrar: () => {
    pintarHoja(false);
    marcar();
    return true;
  }
};

function pintarHoja(abierta) {
  lateral.classList.toggle("hoja-abierta", abierta);
  document.documentElement.classList.toggle("hoja-menu-abierta", abierta);
  fondo.hidden = !abierta;
  botonMas.setAttribute("aria-expanded", String(abierta));
  botonMas.querySelector("svg").outerHTML = icono(abierta ? "aspa" : "menu");
}

export function abrirHoja() {
  if (capa.abierta()) return;
  for (const boton of barra.querySelectorAll(".activa")) boton.classList.remove("activa");
  pintarHoja(true);
  abrirCapa(capa);
}

export function cerrarHoja() {
  if (!capa.abierta()) return;
  pintarHoja(false);
  cerrarCapa(capa);
  marcar();
}

// Qué botón de la barra va marcado: el de la sección abierta, o «Más»
function marcar() {
  if (capa.abierta()) return; // con la hoja abierta, «Más» es la aspa
  const activa = menu.querySelector("[data-vista].activa");
  const vista = activa ? activa.dataset.vista : (location.hash.slice(1) || "inicio");
  let alguno = false;
  for (const boton of barra.querySelectorAll("[data-vista]")) {
    const es = boton.dataset.vista === vista;
    boton.classList.toggle("activa", es);
    alguno ||= es;
  }
  botonMas.classList.toggle("activa", !alguno);
  // «Más» con el color de la sección abierta (si es de las suyas)
  if (!alguno && activa) botonMas.style.setProperty("--color-boton", getComputedStyle(activa).getPropertyValue("--color-boton"));
  else botonMas.style.removeProperty("--color-boton");
}

// Las pestañas de cuaderno van en una fila que se desplaza de lado (css/movil.css): la elegida, a la vista
function centrarPestanas(fila, suave = false) {
  const activa = fila.querySelector(":scope > button.activa");
  if (!activa || fila.scrollWidth <= fila.clientWidth) return;
  const izquierda = activa.offsetLeft - (fila.clientWidth - activa.offsetWidth) / 2;
  fila.scrollTo({ left: Math.max(0, izquierda), behavior: suave ? "smooth" : "auto" });
}

function centrarTodas() {
  if (!ES_MOVIL.matches) return;
  for (const fila of document.querySelectorAll("main > section:not([hidden]) .selector-regiones")) centrarPestanas(fila);
}

export function iniciarMovil() {
  for (const boton of barra.querySelectorAll("[data-icono]")) {
    const texto = boton === botonMas ? t("menu|Más") : boton.textContent.trim();
    boton.innerHTML = `${icono(boton.dataset.icono)}<span>${texto}</span>`;
  }

  barra.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton === botonMas) return capa.abierta() ? cerrarHoja() : abrirHoja();
    cerrarHoja();
    irA(boton.dataset.vista);
  });

  // Elegir una sección, las preguntas frecuentes o los ajustes cierra la hoja. En captura: antes de que
  // se abra la sección o la ventana, para que el historial quede en orden (js/comun/atras.js)
  lateral.addEventListener("click", (e) => {
    if (e.target.closest(".menu-lateral [data-vista], .pie-lateral button, .enlace-legal")) cerrarHoja();
  }, true);
  fondo.addEventListener("click", cerrarHoja);

  // La sección abierta, siempre al día (el menú lateral es quien sabe cuál es)
  new MutationObserver(() => {
    marcar();
    requestAnimationFrame(centrarTodas);
  }).observe(menu, { subtree: true, attributes: true, attributeFilter: ["class"] });
  // (Inicio no está en el menú: también al cambiar la dirección, y al cargar la página)
  addEventListener("popstate", () => requestAnimationFrame(centrarTodas));
  setTimeout(centrarTodas, 800);

  document.addEventListener("click", (e) => {
    if (!ES_MOVIL.matches) return;
    const pestana = e.target.closest(".selector-regiones > button");
    // (la fila se suele volver a pintar al cambiar de pestaña: se buscan otra vez)
    if (pestana) setTimeout(centrarTodas, 60);
  });
  marcar();

  // Al pasar a pantalla ancha, nada de hoja
  ES_MOVIL.addEventListener("change", () => {
    if (!ES_MOVIL.matches) cerrarHoja();
  });
}
