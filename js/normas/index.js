// Sección «Normas»: un CREADOR de normas.
//
//   · Arriba, el nombre del conjunto con una flecha (como en la Ruleta): al pulsarla, tus conjuntos
//     para cambiar de uno a otro, y «Nuevo conjunto».
//   · A la izquierda, lo que se puede marcar: generales, variantes (con su «i») y cláusulas, y
//     «Norma propia» para escribir la tuya. Cada norma dice si la puede vigilar el árbitro del
//     locke (js/partida/arbitro.js) o va «a tu palabra».
//   · A la derecha, el conjunto: lo que lleva, con la × para quitarlo, cuántas normas son y cuántas
//     vigila el árbitro, y los botones «Usar en un locke nuevo», «Copiar como texto» y «⋯» (renombrar
//     y borrar).
//   · Si se llega desde el botón «Normas» de un locke, su desplegable lleva también las de ese
//     locke, que solo se leen.
//
// Todo se guarda solo. Los datos están en js/comun/normas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import {
  NORMAS_GENERALES, NORMAS_VARIANTES, NORMAS_CLAUSULAS, ARBITRO_DE, normaDelCatalogo, conjuntos,
  conjuntoPorId, normasCompletas, normasDeLocke, nombreDeConjuntoLibre, crearConjunto, cambiarConjunto,
  borrarConjunto, guardarNorma, quitarNorma, alternarNormaDelCatalogo, alCambiarNormas
} from "../comun/normas.js";
import { alCambiarLockes, lockePorId } from "../comun/lockes.js";
import { colorDeTipo } from "../comun/perfiles.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { copiarAlPortapapeles } from "../equipos/exportar.js";
import { irA } from "../navegacion.js";
import { t } from "../comun/idioma.js";

const PESTANA_LOCKE = "__locke";
const CLAVE_ULTIMO = "poketeams-normas-ultimo-v1";

let cuerpo = null;
let dialogoNorma = null;
let dialogoConjunto = null;

let pestana = null;         // el conjunto abierto (su id) o PESTANA_LOCKE
let idLocke = null;         // locke cuyas normas se pueden ver en el desplegable
let abierto = false;        // el desplegable de conjuntos
let menuAbierto = false;    // el «⋯» del conjunto
let editandoNorma = null;   // id de la norma propia que se está cambiando, o null si es nueva
let editandoConjunto = null; // id del conjunto que se renombra, o null si es nuevo

// Para el botón «Normas» de cada locke (js/versus): se abre la sección con las suyas
export function verNormasDeLocke(id) {
  idLocke = id;
  pestana = PESTANA_LOCKE;
}

const lockeAbierto = () => (idLocke ? lockePorId(idLocke) : null);

// ---------- Qué lleva un conjunto ----------

// Los conjuntos de antes llevaban las generales detrás de una casilla (conGenerales)
function llevaGeneral(conjunto, id) {
  return (conjunto.conGenerales && id.startsWith("general-")) || conjunto.normas.some((norma) => norma.id === id);
}

// Todas sus normas, en el orden en que se enseñan: generales, variantes y cláusulas, propias
function normasDe(conjunto) {
  const delCatalogo = (lista) => lista.filter((norma) => llevaGeneral(conjunto, norma.id));
  const propias = conjunto.normas.filter((norma) => !normaDelCatalogo(norma.id));
  return {
    generales: delCatalogo(NORMAS_GENERALES),
    otras: [...delCatalogo(NORMAS_VARIANTES), ...delCatalogo(NORMAS_CLAUSULAS)],
    propias
  };
}

// ---------- Pintar ----------

function etiquetaArbitro(id) {
  return ARBITRO_DE[id]
    ? `<span class="norma-arbitro">${icono("visto")} ${t("Lo vigila el árbitro")}</span>`
    : `<span class="norma-arbitro no">${t("A tu palabra")}</span>`;
}

const caja = (puesta) => `<span class="norma-caja ${puesta ? "si" : ""}">${puesta ? icono("visto") : ""}</span>`;

function tarjetaNorma(conjunto, norma, conResumen) {
  const puesta = llevaGeneral(conjunto, norma.id);
  return `
    <div class="norma ${puesta ? "puesta" : ""}">
      <button class="norma-alternar" data-alternar="${norma.id}" role="switch" aria-checked="${puesta}" title="${escaparHTML(norma.texto)}">
        ${caja(puesta)}
        <span class="norma-textos">
          <strong>${escaparHTML(norma.nombre)}</strong>
          ${conResumen ? `<small>${escaparHTML(norma.resumen)}</small>` : etiquetaArbitro(norma.id)}
        </span>
      </button>
      ${conResumen ? `<button class="norma-info" data-info="${norma.id}" aria-label="${t("Qué es")}" title="${t("Qué es")}">i</button>` : ""}
    </div>`;
}

function clausula(conjunto, norma) {
  const puesta = llevaGeneral(conjunto, norma.id);
  return `
    <button class="clausula ${puesta ? "puesta" : ""}" data-alternar="${norma.id}" role="switch" aria-checked="${puesta}" title="${escaparHTML(norma.texto)}">
      <span class="norma-interruptor ${puesta ? "activa" : ""}"><i></i></span>
      <span class="clausula-nombre">${escaparHTML(norma.nombre)}</span>
      ${etiquetaArbitro(norma.id)}
    </button>`;
}

function lineaDelConjunto(norma, propia) {
  return `
    <div class="resumen-norma">
      ${propia ? icono("lapiz") : icono("visto")}
      ${propia
        ? `<button class="resumen-nombre" data-editar="${escaparHTML(norma.id)}" title="${t("Cambiar")}">${escaparHTML(norma.nombre)}</button>`
        : `<span>${escaparHTML(norma.nombre)}</span>`}
      <button class="resumen-quitar" ${propia ? `data-quitar="${escaparHTML(norma.id)}"` : `data-alternar="${norma.id}"`} title="${t("Quitar")}" aria-label="${t("Quitar")}">${icono("aspa")}</button>
    </div>`;
}

function ladoDelConjunto(conjunto) {
  const { generales, otras, propias } = normasDe(conjunto);
  const total = generales.length + otras.length + propias.length;
  const vigiladas = [...generales, ...otras].filter((norma) => ARBITRO_DE[norma.id]).length;
  const grupo = (titulo, lista, propia = false) =>
    lista.length ? `<div class="resumen-grupo">${t(titulo)}</div>${lista.map((norma) => lineaDelConjunto(norma, propia)).join("")}` : "";
  return `
    <aside class="normas-lado">
      <span class="normas-lado-nota">${t("El conjunto")}</span>
      <input class="normas-lado-nombre" type="text" maxlength="40" autocomplete="off" value="${escaparHTML(conjunto.nombre)}" aria-label="${t("Nombre del conjunto")}" title="${t("Cambiar el nombre")}">
      <div class="resumen-lista">
        ${total
          ? grupo("Generales", generales) + grupo("Variantes y cláusulas", otras) + grupo("Propias", propias, true)
          : `<p class="normas-vacio">${t("Todavía no lleva ninguna norma. Márcalas a la izquierda.")}</p>`}
      </div>
      <div class="resumen-cuenta">
        <span><b>${total}</b><small>${t("normas")}</small></span>
        <span><b class="vigila">${vigiladas}</b><small>${t("las vigila el árbitro")}</small></span>
      </div>
      <button class="normas-usar">${t("Usar en un locke nuevo")}</button>
      <div class="normas-botones">
        <button class="normas-copiar">${t("Copiar como texto")}</button>
        <div class="normas-mas">
          <button class="normas-menu" aria-label="${t("Renombrar o borrar el conjunto")}" title="${t("Renombrar o borrar el conjunto")}" aria-expanded="${menuAbierto}">${icono("puntos")}</button>
          ${menuAbierto
            ? `<div class="normas-menu-lista">
                 <button class="normas-renombrar">${icono("lapiz")} ${t("Renombrar")}</button>
                 <button class="normas-borrar">${icono("papelera")} ${t("Borrar conjunto")}</button>
               </div>`
            : ""}
        </div>
      </div>
    </aside>`;
}

function cuerpoConjunto(conjunto) {
  return `
    <div class="normas-cuerpo">
      <div class="normas-izq">
        <div class="normas-apartado">${t("Generales")} <small>${t("Márcalas o quítalas")}</small></div>
        <div class="normas-rejilla">${NORMAS_GENERALES.map((norma) => tarjetaNorma(conjunto, norma, false)).join("")}</div>

        <div class="normas-apartado">${t("Variantes")} <small>${t("La «i» explica cada una")}</small></div>
        <div class="normas-rejilla">${NORMAS_VARIANTES.map((norma) => tarjetaNorma(conjunto, norma, true)).join("")}</div>

        <div class="normas-apartado">${t("Cláusulas")} <small>${t("Para afinar")}</small></div>
        <div class="normas-clausulas">${NORMAS_CLAUSULAS.map((norma) => clausula(conjunto, norma)).join("")}</div>

        <div class="normas-apartado">${t("Norma propia")}</div>
        <form class="normas-propia">
          <input class="normas-propia-texto" type="text" maxlength="80" autocomplete="off" placeholder="${t("Escribe una norma tuya, p. ej.: «El inicial se elige con la ruleta»")}" aria-label="${t("Norma propia")}">
          <button type="submit" class="normas-propia-anadir">${t("Añadir")}</button>
        </form>
      </div>
      ${ladoDelConjunto(conjunto)}
    </div>`;
}

// Las normas de un locke (solo se leen)
function cuerpoLocke(locke) {
  const delLocke = normasDeLocke(locke);
  const normas = normasCompletas(delLocke);
  const tipo = locke.tipo || {};
  return `
    <section class="normas-grupo del-locke" style="--color-apartado: ${colorDeTipo(tipo)}">
      <h2>${icono("libro")} ${escaparHTML(locke.nombre)}${delLocke ? ` <small>· ${escaparHTML(t(delLocke.nombre))}</small>` : ""}</h2>
      ${normas.length
        ? `<ul>${normas.map((norma) => `<li><strong>${escaparHTML(norma.nombre)}</strong>${norma.texto ? `<p>${escaparHTML(norma.texto)}</p>` : ""}</li>`).join("")}</ul>`
        : `<p class="normas-vacio">${t("Este locke no tiene normas. Quien lo creó puede ponérselas con el lápiz del locke.")}</p>`}
    </section>`;
}

function cabecera(nombre, todos, locke) {
  const lista = `
    <div class="normas-desplegable">
      ${locke ? `<button data-conjunto="${PESTANA_LOCKE}" class="${pestana === PESTANA_LOCKE ? "activa" : ""}">${icono("libro")} ${escaparHTML(locke.nombre)}<small>${t("las del locke")}</small></button><hr>` : ""}
      ${todos.map((conjunto) => `<button data-conjunto="${escaparHTML(conjunto.id)}" class="${conjunto.id === pestana ? "activa" : ""}">${escaparHTML(conjunto.nombre)}<small>${normasCompletas(conjunto).length} ${t(normasCompletas(conjunto).length === 1 ? "norma" : "normas")}</small></button>`).join("")}
      ${todos.length || locke ? "<hr>" : ""}
      <button class="normas-nuevo">${icono("mas")} ${t("Nuevo conjunto")}</button>
    </div>`;
  return `
    <div class="normas-cabeza">
      <button class="normas-nombre" aria-expanded="${abierto}" aria-haspopup="true">${escaparHTML(nombre)}<span class="flecha">${icono("abajo")}</span></button>
      <span class="normas-nota">${pestana === PESTANA_LOCKE ? t("Solo se leen") : t("Se guarda solo")}</span>
      ${abierto ? lista : ""}
    </div>`;
}

function pintar() {
  if (!cuerpo) return;
  const todos = conjuntos();
  const locke = lockeAbierto();
  if (!locke) idLocke = null;

  // Si el abierto ya no existe (conjunto borrado, locke borrado), el último que se miró o el primero
  if ((pestana === PESTANA_LOCKE && !locke) || (pestana !== PESTANA_LOCKE && !conjuntoPorId(pestana))) {
    const ultimo = localStorage.getItem(CLAVE_ULTIMO);
    pestana = (todos.find((conjunto) => conjunto.id === ultimo) || todos[0] || {}).id || null;
  }

  if (pestana === PESTANA_LOCKE) {
    cuerpo.innerHTML = cabecera(locke.nombre, todos, locke) + cuerpoLocke(locke);
  } else if (pestana) {
    const conjunto = conjuntoPorId(pestana);
    cuerpo.innerHTML = cabecera(conjunto.nombre, todos, locke) + cuerpoConjunto(conjunto);
  } else {
    // Sin ningún conjunto todavía
    cuerpo.innerHTML = `<button class="normas-nuevo grande">${icono("mas")} ${t("Crear norma")}</button>`;
  }
}

// ---------- Ventana de conjunto (crear / renombrar) ----------

function abrirConjunto(conjunto = null) {
  editandoConjunto = conjunto ? conjunto.id : null;
  dialogoConjunto.querySelector(".conjunto-titulo").textContent = conjunto ? t("Renombrar conjunto") : t("Nuevo conjunto de normas");
  dialogoConjunto.querySelector(".conjunto-ok").textContent = conjunto ? t("Guardar") : t("Crear");
  dialogoConjunto.querySelector(".conjunto-nombre").value = conjunto ? conjunto.nombre : "";
  dialogoConjunto.querySelector(".conjunto-generales").checked = true;
  dialogoConjunto.querySelector(".casilla-sesion").hidden = Boolean(conjunto);
  dialogoConjunto.querySelector(".conjunto-error").textContent = "";
  dialogoConjunto.showModal();
  dialogoConjunto.querySelector(".conjunto-nombre").focus();
}

function guardarConjunto() {
  const nombre = dialogoConjunto.querySelector(".conjunto-nombre").value.trim();
  const conBasicas = dialogoConjunto.querySelector(".conjunto-generales").checked;
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
    cambiarConjunto(editandoConjunto, { nombre });
  } else {
    const nuevo = crearConjunto(nombre, false);
    // Empieza con las normas básicas de cualquier Nuzlocke (se quitan las que no se quieran)
    if (conBasicas) {
      for (const norma of NORMAS_GENERALES.filter((cada) => cada.grupo === "basica")) {
        guardarNorma(nuevo.id, { id: norma.id, nombre: norma.nombre, texto: norma.texto });
      }
    }
    pestana = nuevo.id; // y se abre
    pintar();
  }
  dialogoConjunto.close();
}

// ---------- Ventana de norma propia (cambiar) ----------

function abrirNorma(norma) {
  if (!norma) return;
  editandoNorma = norma.id;
  dialogoNorma.querySelector(".norma-titulo").textContent = t("Cambiar norma");
  dialogoNorma.querySelector(".norma-nombre").value = norma.nombre;
  dialogoNorma.querySelector(".norma-texto").value = norma.texto || "";
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

// ---------- Acciones ----------

// El conjunto en palabras, para pegarlo donde se quiera
function comoTexto(conjunto) {
  const { generales, otras, propias } = normasDe(conjunto);
  const lineas = [...generales, ...otras, ...propias].map((norma) => `· ${norma.nombre}${norma.texto ? `: ${norma.texto}` : ""}`);
  return `${conjunto.nombre}\n\n${lineas.join("\n")}`;
}

// A «Lockes», «Nuevo locke» y con este conjunto elegido
async function usarEnUnLocke(conjunto) {
  await irA("lockes");
  const boton = document.querySelector("#nuevo-locke");
  if (!boton || boton.hidden) return;
  boton.click();
  for (let intento = 0; intento < 20; intento++) {
    await new Promise((resolver) => setTimeout(resolver, 50));
    const elegir = document.querySelector("#dialogo-nuevo-locke .locke-normas-elegir:not(.locke-randomizer-elegir)");
    if (elegir) {
      elegir.value = conjunto.id;
      elegir.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }
}

// ---------- Arranque ----------

export function iniciar() {
  const seccion = document.querySelector("#vista-normas");
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

  // Los desplegables se cierran al pulsar fuera
  document.addEventListener("click", (e) => {
    if (!cuerpo.isConnected || (!abierto && !menuAbierto)) return;
    const dentroNombre = e.target.closest(".normas-cabeza");
    const dentroMenu = e.target.closest(".normas-mas");
    if ((abierto && !dentroNombre) || (menuAbierto && !dentroMenu)) {
      if (abierto && !dentroNombre) abierto = false;
      if (menuAbierto && !dentroMenu) menuAbierto = false;
      pintar();
    }
  });

  // El nombre del conjunto, en su tarjeta: se cambia ahí mismo (al salir del campo o con Intro)
  cuerpo.addEventListener("change", (e) => {
    if (!e.target.matches(".normas-lado-nombre")) return;
    const conjunto = conjuntoPorId(pestana);
    const nombre = e.target.value.trim();
    if (!conjunto || !nombre || nombre === conjunto.nombre) {
      pintar();
      return;
    }
    if (!nombreDeConjuntoLibre(nombre, conjunto.id)) {
      avisar(t("Ya hay un conjunto con ese nombre."));
      pintar();
      return;
    }
    cambiarConjunto(conjunto.id, { nombre });
  });
  cuerpo.addEventListener("keydown", (e) => {
    if (e.target.matches(".normas-lado-nombre") && e.key === "Enter") e.target.blur();
  });

  cuerpo.addEventListener("submit", (e) => {
    if (!e.target.matches(".normas-propia")) return;
    e.preventDefault();
    const conjunto = conjuntoPorId(pestana);
    const campo = e.target.querySelector(".normas-propia-texto");
    const nombre = campo.value.trim();
    if (!conjunto || !nombre) return;
    if (conjunto.normas.some((norma) => norma.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
      avisar(t("Este conjunto ya tiene una norma con ese nombre."));
      return;
    }
    guardarNorma(conjunto.id, { nombre, texto: "" });
  });

  cuerpo.addEventListener("click", async (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    const conjunto = conjuntoPorId(pestana);

    if (boton.classList.contains("normas-nombre")) {
      abierto = !abierto;
      pintar();
    } else if (boton.dataset.conjunto) {
      pestana = boton.dataset.conjunto;
      if (pestana !== PESTANA_LOCKE) localStorage.setItem(CLAVE_ULTIMO, pestana);
      abierto = false;
      menuAbierto = false;
      pintar();
    } else if (boton.classList.contains("normas-nuevo")) {
      abierto = false;
      pintar();
      abrirConjunto();
    } else if (boton.dataset.alternar) {
      if (conjunto) alternarNormaDelCatalogo(conjunto.id, boton.dataset.alternar);
    } else if (boton.dataset.info) {
      const norma = normaDelCatalogo(boton.dataset.info);
      if (norma) avisar(`${norma.nombre}\n\n${norma.texto}`);
    } else if (boton.dataset.quitar) {
      if (conjunto) quitarNorma(conjunto.id, boton.dataset.quitar);
    } else if (boton.dataset.editar) {
      abrirNorma(conjunto && conjunto.normas.find((norma) => norma.id === boton.dataset.editar));
    } else if (boton.classList.contains("normas-usar")) {
      if (conjunto) usarEnUnLocke(conjunto);
    } else if (boton.classList.contains("normas-copiar")) {
      if (!conjunto) return;
      const bien = await copiarAlPortapapeles(comoTexto(conjunto));
      boton.textContent = bien ? t("Copiado") : t("No se pudo copiar");
      setTimeout(() => {
        if (boton.isConnected) boton.textContent = t("Copiar como texto");
      }, 1600);
    } else if (boton.classList.contains("normas-menu")) {
      menuAbierto = !menuAbierto;
      pintar();
    } else if (boton.classList.contains("normas-renombrar")) {
      menuAbierto = false;
      pintar();
      abrirConjunto(conjunto);
    } else if (boton.classList.contains("normas-borrar")) {
      menuAbierto = false;
      pintar();
      if (conjunto && (await confirmar(`${t("¿Borrar el conjunto «{nombre}» con todas sus normas?", { nombre: conjunto.nombre })}\n\n${t("Los lockes que ya lo usan lo conservan.")}`))) {
        borrarConjunto(conjunto.id);
      }
    }
  });

  alCambiarNormas(pintar);
  // Si el locke cambia (le cambian las normas, lo borran...), al día
  alCambiarLockes(() => {
    if (idLocke && cuerpo.isConnected) pintar();
  });
}

export function mostrar() {
  abierto = false;
  menuAbierto = false;
  pintar();
}
