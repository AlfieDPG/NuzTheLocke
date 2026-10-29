// Sección «Normas», en pestañas (como las regiones de Rutas y Level caps):
//
//   · Normas generales: fijas, en dos apartados (las básicas de cualquier Nuzlocke y las
//     extras, muy habituales pero no en todos). Es la que sale al entrar.
//   · Una pestaña por cada conjunto tuyo: su nombre, sus normas (se crean, se cambian y se
//     borran aquí) y una casilla para que lleve también las generales.
//   · «Nuevo conjunto», al final.
//   · Si se llega desde el botón «Normas» de un locke, una pestaña más al principio con las
//     de ese locke.
//
// Los datos están en js/comun/normas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import {
  ID_GENERALES, NOMBRE_GENERALES, NORMAS_GENERALES, conjuntos, conjuntoPorId, normasCompletas,
  normasDeLocke, nombreDeConjuntoLibre, crearConjunto, cambiarConjunto, borrarConjunto,
  guardarNorma, quitarNorma, alCambiarNormas
} from "../comun/normas.js";
import { alCambiarLockes, lockePorId } from "../comun/lockes.js";
import { colorDeTipo } from "../comun/perfiles.js";
import { confirmar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";

const PESTANA_LOCKE = "__locke";

let pestanas = null;
let cuerpo = null;
let dialogoNorma = null;
let dialogoConjunto = null;

let pestana = ID_GENERALES; // la abierta: ID_GENERALES, el id de un conjunto o PESTANA_LOCKE
let idLocke = null;         // locke cuya pestaña sale al principio
let editandoNorma = null;   // id de la norma que se está cambiando, o null si es nueva
let editandoConjunto = null; // id del conjunto que se renombra, o null si es nuevo

// Para el botón «Normas» de cada locke (js/versus): se abre la sección en su pestaña
export function verNormasDeLocke(id) {
  idLocke = id;
  pestana = PESTANA_LOCKE;
}

// ---------- Pintar ----------

function plantillaNorma(norma, editable) {
  const acciones = editable
    ? `
      <div class="norma-acciones">
        <button class="norma-editar" data-id="${escaparHTML(norma.id)}" title="${t("Cambiar")}">${icono("lapiz")}</button>
        <button class="norma-borrar" data-id="${escaparHTML(norma.id)}" title="${t("Borrar")}">${icono("papelera")}</button>
      </div>`
    : "";
  return `
    <li>
      <strong>${escaparHTML(norma.nombre)}</strong>
      ${norma.texto ? `<p>${escaparHTML(norma.texto)}</p>` : ""}
      ${acciones}
    </li>`;
}

function plantillaLista(normas, editable) {
  return `<ul>${normas.map((norma) => plantillaNorma(norma, editable)).join("")}</ul>`;
}

function lockeAbierto() {
  return idLocke ? lockePorId(idLocke) : null;
}

function pintarPestanas() {
  const locke = lockeAbierto();
  const boton = (id, texto, clase = "") =>
    `<button data-pestana="${escaparHTML(id)}" class="${clase} ${id === pestana ? "activa" : ""}">${texto}</button>`;

  pestanas.innerHTML = [
    locke
      ? boton(PESTANA_LOCKE, `${icono("libro")} ${escaparHTML(locke.nombre)} <span class="pestana-cerrar" title="${t("Cerrar")}">${icono("aspa")}</span>`, "pestana-locke")
      : "",
    boton(ID_GENERALES, NOMBRE_GENERALES),
    ...conjuntos().map((conjunto) => boton(conjunto.id, escaparHTML(conjunto.nombre))),
    `<button class="pestana-nueva" title="${t("Nuevo conjunto de normas")}" aria-label="${t("Nuevo conjunto de normas")}">${icono("mas")}</button>`
  ].join("");
}

const APARTADOS_GENERALES = [
  { grupo: "basica", titulo: "Básicas", nota: "Las de cualquier Nuzlocke" },
  { grupo: "extra", titulo: "Extras", nota: "Muy habituales, pero no están en todos" }
];

function cuerpoGenerales() {
  return APARTADOS_GENERALES.map(({ grupo, titulo, nota }) => `
    <section class="normas-grupo generales">
      <h2>${t(titulo)} <small>${t(nota)}</small></h2>
      ${plantillaLista(NORMAS_GENERALES.filter((norma) => norma.grupo === grupo), false)}
    </section>`).join("");
}

function cuerpoConjunto(conjunto) {
  return `
    <div class="conjunto-barra">
      <label class="conjunto-casilla">
        <input type="checkbox" class="conjunto-con-generales" ${conjunto.conGenerales ? "checked" : ""}>
        ${t("Incluye también las normas generales")}
      </label>
      <button class="conjunto-renombrar">${icono("lapiz")} ${t("Renombrar")}</button>
      <button class="conjunto-borrar">${icono("papelera")} ${t("Borrar conjunto")}</button>
    </div>

    <section class="normas-grupo mias">
      <h2>
        ${t("Normas de «{nombre}»", { nombre: escaparHTML(conjunto.nombre) })}
        <button class="normas-anadir">${icono("mas")} ${t("Nueva norma")}</button>
      </h2>
      ${conjunto.normas.length
        ? plantillaLista(conjunto.normas, true)
        : `<p class="normas-vacio">${t("Todavía no tiene normas. Añádelas con «Nueva norma».")}</p>`}
    </section>

    ${conjunto.conGenerales
      ? `<section class="normas-grupo generales incluidas">
          <h2>${NOMBRE_GENERALES}</h2>
          ${plantillaLista(NORMAS_GENERALES, false)}
        </section>`
      : ""}`;
}

function cuerpoLocke(locke) {
  const delLocke = normasDeLocke(locke);
  const normas = normasCompletas(delLocke);
  const tipo = locke.tipo || {};
  return `
    <section class="normas-grupo del-locke" style="--color-apartado: ${colorDeTipo(tipo)}">
      <h2>${icono("libro")} ${escaparHTML(locke.nombre)}${delLocke ? ` <small>· ${escaparHTML(t(delLocke.nombre))}</small>` : ""}</h2>
      ${normas.length
        ? plantillaLista(normas, false)
        : `<p class="normas-vacio">${t("Este locke no tiene normas. Quien lo creó puede ponérselas con el lápiz del locke.")}</p>`}
    </section>`;
}

function pintar() {
  // Si la pestaña abierta ya no existe (conjunto borrado, locke borrado), a las generales
  const locke = lockeAbierto();
  if (!locke) idLocke = null;
  if ((pestana === PESTANA_LOCKE && !locke) || (pestana !== PESTANA_LOCKE && pestana !== ID_GENERALES && !conjuntoPorId(pestana))) {
    pestana = ID_GENERALES;
  }

  pintarPestanas();
  if (pestana === PESTANA_LOCKE) cuerpo.innerHTML = cuerpoLocke(locke);
  else if (pestana === ID_GENERALES) cuerpo.innerHTML = cuerpoGenerales();
  else cuerpo.innerHTML = cuerpoConjunto(conjuntoPorId(pestana));
}

// ---------- Ventana de conjunto (crear / renombrar) ----------

function abrirConjunto(conjunto = null) {
  editandoConjunto = conjunto ? conjunto.id : null;
  dialogoConjunto.querySelector(".conjunto-titulo").textContent = conjunto ? t("Renombrar conjunto") : t("Nuevo conjunto de normas");
  dialogoConjunto.querySelector(".conjunto-ok").textContent = conjunto ? t("Guardar") : t("Crear");
  dialogoConjunto.querySelector(".conjunto-nombre").value = conjunto ? conjunto.nombre : "";
  dialogoConjunto.querySelector(".conjunto-generales").checked = conjunto ? Boolean(conjunto.conGenerales) : true;
  dialogoConjunto.querySelector(".conjunto-error").textContent = "";
  dialogoConjunto.showModal();
  dialogoConjunto.querySelector(".conjunto-nombre").focus();
}

function guardarConjunto() {
  const nombre = dialogoConjunto.querySelector(".conjunto-nombre").value.trim();
  const conGenerales = dialogoConjunto.querySelector(".conjunto-generales").checked;
  const error = dialogoConjunto.querySelector(".conjunto-error");

  if (!nombre) {
    error.textContent = t("Ponle un nombre.");
    return;
  }
  if (!nombreDeConjuntoLibre(nombre, editandoConjunto)) {
    error.textContent = t("Ya hay un conjunto con ese nombre.");
    return;
  }

  if (editandoConjunto) {
    cambiarConjunto(editandoConjunto, { nombre, conGenerales });
  } else {
    pestana = crearConjunto(nombre, conGenerales).id; // y se abre
    pintar();
  }
  dialogoConjunto.close();
}

// ---------- Ventana de norma (crear / cambiar) ----------

function abrirNorma(norma = null) {
  editandoNorma = norma ? norma.id : null;
  dialogoNorma.querySelector(".norma-titulo").textContent = norma ? t("Cambiar norma") : t("Nueva norma");
  dialogoNorma.querySelector(".norma-nombre").value = norma ? norma.nombre : "";
  dialogoNorma.querySelector(".norma-texto").value = norma ? norma.texto : "";
  dialogoNorma.querySelector(".norma-error").textContent = "";
  dialogoNorma.showModal();
  dialogoNorma.querySelector(".norma-nombre").focus();
}

function guardarDesdeLaNorma() {
  const conjunto = conjuntoPorId(pestana);
  const nombre = dialogoNorma.querySelector(".norma-nombre").value.trim();
  const texto = dialogoNorma.querySelector(".norma-texto").value.trim();
  const error = dialogoNorma.querySelector(".norma-error");
  if (!conjunto) return;

  if (!nombre) {
    error.textContent = t("Ponle un nombre.");
    return;
  }
  const repetida = conjunto.normas.some(
    (norma) => norma.id !== editandoNorma && norma.nombre.trim().toLowerCase() === nombre.toLowerCase()
  );
  if (repetida) {
    error.textContent = t("Este conjunto ya tiene una norma con ese nombre.");
    return;
  }

  guardarNorma(conjunto.id, { id: editandoNorma, nombre, texto });
  dialogoNorma.close();
}

// ---------- Arranque ----------

export function iniciar() {
  const seccion = document.querySelector("#vista-normas");
  pestanas = seccion.querySelector(".normas-pestanas");
  cuerpo = seccion.querySelector(".normas");
  dialogoNorma = document.querySelector("#dialogo-norma");
  dialogoConjunto = document.querySelector("#dialogo-conjunto");

  dialogoNorma.querySelector(".norma-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarDesdeLaNorma();
  });
  dialogoNorma.querySelector(".norma-cancelar").addEventListener("click", () => dialogoNorma.close());

  dialogoConjunto.querySelector(".conjunto-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarConjunto();
  });
  dialogoConjunto.querySelector(".conjunto-cancelar").addEventListener("click", () => dialogoConjunto.close());

  pestanas.addEventListener("click", (e) => {
    // La X de la pestaña del locke la cierra
    if (e.target.closest(".pestana-cerrar")) {
      idLocke = null;
      if (pestana === PESTANA_LOCKE) pestana = ID_GENERALES;
      pintar();
      return;
    }
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("pestana-nueva")) {
      abrirConjunto();
      return;
    }
    pestana = boton.dataset.pestana;
    pintar();
  });

  cuerpo.addEventListener("change", (e) => {
    if (e.target.classList.contains("conjunto-con-generales")) {
      cambiarConjunto(pestana, { conGenerales: e.target.checked });
    }
  });

  cuerpo.addEventListener("click", async (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    const conjunto = conjuntoPorId(pestana);

    if (boton.classList.contains("normas-anadir")) {
      abrirNorma();
    } else if (boton.classList.contains("conjunto-renombrar")) {
      abrirConjunto(conjunto);
    } else if (boton.classList.contains("conjunto-borrar")) {
      if (conjunto && (await confirmar(`${t("¿Borrar el conjunto «{nombre}» con todas sus normas?", { nombre: conjunto.nombre })}\n\n${t("Los lockes que ya lo usan lo conservan.")}`))) {
        borrarConjunto(conjunto.id);
      }
    } else if (boton.classList.contains("norma-editar")) {
      abrirNorma(conjunto && conjunto.normas.find((norma) => norma.id === boton.dataset.id));
    } else if (boton.classList.contains("norma-borrar")) {
      const norma = conjunto && conjunto.normas.find((cada) => cada.id === boton.dataset.id);
      if (norma && (await confirmar(t("¿Borrar «{norma}» de «{conjunto}»?", { norma: norma.nombre, conjunto: conjunto.nombre })))) quitarNorma(conjunto.id, norma.id);
    }
  });

  alCambiarNormas(pintar);
  // Si el locke de su pestaña cambia (le cambian las normas, lo borran...), al día
  alCambiarLockes(() => {
    if (idLocke && cuerpo.isConnected) pintar();
  });
}

export function mostrar() {
  pintar();
}
