// Sección «Logros»: todos los logros, por categorías, con los tuyos en color y lo que te falta
// para los demás (una barra en los que piden llegar a un número). Arriba, cuántos llevas.
//
// Los logros, qué pide cada uno y cómo se apuntan están en js/comun/logros.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual, alCambiarSesion, hayNube } from "../comun/nube.js";
import { alCambiarMiPerfil } from "../comun/perfiles.js";
import { LOGROS, CATEGORIAS, NIVELES, progreso, insignia, LOGROS_PARA_PLATA, LOGROS_PARA_ORO } from "../comun/logros.js";
import { FONDOS, claseFondo, estiloFondo } from "../comun/fondos.js";
import { FICHAS_POR_NIVEL, MARCOS } from "../comun/fichas.js";
import { t, LOCALE } from "../comun/idioma.js";

const vista = document.getElementById("vista-logros");
const cabecera = vista.querySelector(".logros-cabecera");
const lista = vista.querySelector(".logros-lista");

const FILTROS = [
  { id: "todos", nombre: t("Todos") },
  { id: "conseguidos", nombre: t("Conseguidos") },
  { id: "pendientes", nombre: t("Por conseguir") }
];
let filtroActual = "todos";
let categoriaActual = "todas"; // la categoría que se ve a la derecha, o "todas"
let filas = [];
let vuelta = 0; // para quedarse solo con el último cálculo si se piden varios seguidos

function fecha(cuando) {
  return new Date(cuando).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

function plantillaLogro({ logro, valor, meta, conseguido }) {
  let pie = "";
  if (conseguido) pie = `<small class="logro-fecha">${icono("visto")} ${escaparHTML(fecha(conseguido))}</small>`;
  else if (meta > 1) {
    const hecho = Math.min(valor, meta);
    pie = `
      <div class="logro-barra"><span style="width:${Math.round((hecho / meta) * 100)}%"></span></div>
      <small class="logro-cuenta">${hecho} / ${meta}</small>`;
  }

  // Los que dan un fondo para la tarjeta: una muestra pequeña de ese fondo; y los de tipo, además,
  // el marco liso de ese tipo (una plaquita con el borde de su color)
  const fondo = FONDOS.find((cada) => cada.id === logro.fondo);
  const marco = MARCOS.find((cada) => cada.logro === logro.id && cada.liso);
  const premio = (fondo
    ? `<span class="logro-premio ${claseFondo(fondo.id)}" style="${estiloFondo(fondo.id)}"
             title="${t("Da el fondo «{nombre}» para tu tarjeta", { nombre: escaparHTML(fondo.nombre) })}">${t("Fondo")}</span>`
    : "") + (marco
    ? `<span class="logro-premio logro-premio-marco ${marco.id}" title="${t("Da el marco «{nombre}» para tu foto", { nombre: escaparHTML(marco.nombre) })}">${t("Marco")}</span>`
    : "");

  return `
    <article class="logro ${escaparHTML(logro.nivel)} ${conseguido ? "conseguido" : ""}">
      ${insignia(logro, Boolean(conseguido))}
      <div class="logro-texto">
        <strong>${escaparHTML(logro.nombre)}</strong>
        <span class="logro-descripcion">${escaparHTML(logro.descripcion)}</span>
        ${pie}
      </div>
      <!-- A la derecha: el nivel arriba, debajo el fondo que da (si da alguno) y los Pokédólares
           que da en la esquina de abajo -->
      <div class="logro-lado">
        <span class="logro-nivel">${NIVELES[logro.nivel]}</span>
        ${premio}
        <span class="logro-fichas" title="${t("Pokédólares para la Tienda de «Juegos»")}"><span class="ficha-moneda"></span>${FICHAS_POR_NIVEL[logro.nivel] || 0}</span>
      </div>
    </article>`;
}

// El trofeo del total, del metal que llevas: bronce, plata desde 25, oro desde 50 y platino
// con todos (lo mismo que los fondos)
function nivelDelTotal(conseguidos) {
  if (conseguidos >= LOGROS.length) return "platino";
  if (conseguidos >= LOGROS_PARA_ORO) return "oro";
  if (conseguidos >= LOGROS_PARA_PLATA) return "plata";
  return "bronce";
}

function pintar() {
  const conseguidos = filas.filter((cada) => cada.conseguido).length;
  const conSesion = Boolean(usuarioActual());

  cabecera.innerHTML = `
    ${insignia({ nivel: nivelDelTotal(conseguidos), icono: "trofeo" })}
    <div class="logros-total">
      <strong>${conseguidos} <small>/ ${LOGROS.length}</small></strong>
      <div class="logro-barra grande"><span style="width:${Math.round((conseguidos / LOGROS.length) * 100)}%"></span></div>
      ${conSesion ? "" : `<span class="logros-aviso">${hayNube() ? t("Inicia sesión para ir consiguiendo logros.") : ""}</span>`}
    </div>
    <div class="logros-niveles">
      ${Object.entries(NIVELES)
        .map(([nivel, nombre]) => {
          const delNivel = filas.filter((cada) => cada.logro.nivel === nivel);
          return `<span class="logros-nivel ${nivel}">${insignia({ nivel, icono: "estrella" })} ${nombre} <strong>${delNivel.filter((cada) => cada.conseguido).length}/${delNivel.length}</strong></span>`;
        })
        .join("")}
    </div>`;

  // Todos, conseguidos o por conseguir: tres botoncitos en la cabeza de la página
  const filtros = `
    <div class="logros-filtros" role="group" aria-label="${t("Qué logros ver")}">
      ${FILTROS.map(
        (cada) => `<button data-filtro="${cada.id}" class="${cada.id === filtroActual ? "activa" : ""}" aria-pressed="${cada.id === filtroActual}">${cada.nombre}</button>`
      ).join("")}
    </div>`;

  const pasa = (cada) =>
    filtroActual === "todos" || (filtroActual === "conseguidos" ? Boolean(cada.conseguido) : !cada.conseguido);

  const hechosDe = (suyas) => suyas.filter((cada) => cada.conseguido).length;
  const porcentaje = (hechos, total) => Math.round((hechos / Math.max(1, total)) * 100);

  // El índice del álbum: cada categoría con lo que llevas
  const indice = [{ id: "todas", nombre: t("Todos los logros") }, ...CATEGORIAS]
    .map((categoria) => {
      const suyas = categoria.id === "todas" ? filas : filas.filter((cada) => cada.logro.categoria === categoria.id);
      const hechos = hechosDe(suyas);
      return `
        <button class="logros-cat ${categoria.id === categoriaActual ? "activa" : ""}" data-categoria="${escaparHTML(categoria.id)}">
          <b>${escaparHTML(categoria.nombre)}</b>
          <span class="logros-cat-cuenta ${hechos === suyas.length ? "lleno" : ""}">${hechos}/${suyas.length}</span>
          <span class="logro-barra"><span style="width:${porcentaje(hechos, suyas.length)}%"></span></span>
        </button>`;
    })
    .join("");

  const vacio = `<p class="logros-vacio">${filtroActual === "conseguidos" ? t("Todavía ninguno.") : t("¡Los tienes todos!")}</p>`;
  let pagina;
  if (categoriaActual === "todas") {
    // Todas, una categoría debajo de otra
    pagina = `
      <div class="logros-pagina-cabeza">
        <h2>${t("Todos los logros")}</h2>
        <span class="logros-chip">${t("{hechos} de {total}", { hechos: conseguidos, total: filas.length })}</span>
        ${filtros}
      </div>` +
      (CATEGORIAS.map((categoria) => {
        const suyas = filas.filter((cada) => cada.logro.categoria === categoria.id);
        const visibles = suyas.filter(pasa);
        if (!visibles.length) return "";
        return `
          <section class="logros-grupo">
            <h2>${escaparHTML(categoria.nombre)} <small>${hechosDe(suyas)}/${suyas.length}</small></h2>
            <div class="logros-rejilla">${visibles.map(plantillaLogro).join("")}</div>
          </section>`;
      }).join("") || vacio);
  } else {
    // Una sola: su nombre, lo que llevas y lo que te falta, y sus logros
    const categoria = CATEGORIAS.find((cada) => cada.id === categoriaActual) || CATEGORIAS[0];
    const suyas = filas.filter((cada) => cada.logro.categoria === categoria.id);
    const visibles = suyas.filter(pasa);
    pagina = `
      <div class="logros-pagina-cabeza">
        <h2>${escaparHTML(categoria.nombre)}</h2>
        <span class="logros-chip">${t("{hechos} de {total}", { hechos: hechosDe(suyas), total: suyas.length })}</span>
        ${filtros}
      </div>
      ${visibles.length ? `<div class="logros-rejilla">${visibles.map(plantillaLogro).join("")}</div>` : vacio}`;
  }

  lista.innerHTML = `
    <div class="logros-cuerpo">
      <nav class="logros-indice" aria-label="${t("Categorías de logros")}">${indice}</nav>
      <section class="logros-pagina">${pagina}</section>
    </div>`;
}

async function calcular() {
  const esta = ++vuelta;
  // Sin sesión no se apunta nada: se enseña lo que llevas, pero ninguno conseguido
  const calculadas = await progreso(usuarioActual() ? undefined : {});
  if (esta !== vuelta) return;
  filas = calculadas;
  pintar();
}

function recalcular() {
  if (!vista.hidden) calcular().catch((error) => console.error(error));
}

export function iniciar() {
  // Una categoría del índice, o todos / conseguidos / por conseguir
  lista.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-filtro]");
    if (boton) {
      filtroActual = boton.dataset.filtro;
      pintar();
      return;
    }
    const categoria = e.target.closest("[data-categoria]");
    if (!categoria) return;
    categoriaActual = categoria.dataset.categoria;
    pintar();
  });

  alCambiarMiPerfil(recalcular);
  alCambiarSesion(recalcular);
}

export function mostrar() {
  calcular().catch((error) => console.error(error));
}
