// Pestaña «Colección» de «Juegos»: huevos y la Pokédex por completar (los datos y el sorteo, en
// js/comun/coleccion.js).
//
//   · Arriba, cuántas especies llevas (y shiny) y los huevos: 1 o 10 de golpe. Al abrirlos, los
//     huevos (dibujados con CSS) se agitan y se abren uno detrás de otro: lo nuevo, lo shiny
//     y los repetidos (con los Pokédólares que devuelven).
//   · Debajo, todas las especies de una generación (pestañas): las tuyas con su retrato de
//     Mundo Misterioso y cuántas veces te ha salido; las que faltan, con un «?». Pulsando uno
//     de los tuyos se elige con qué cara verlo y, si lo tienes shiny, si en shiny (y con un
//     botón, todas las shiny en shiny de golpe).
//
// Los retratos normales salen de las hojas de la Pokédex (una imagen con muchos: así no se
// piden mil archivos); los shiny, uno a uno.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsPMD, urlsPMDEmocion, EMOCIONES_PMD } from "../comun/imagenes.js";
import { usuarioActual } from "../comun/nube.js";
import { miPerfil } from "../comun/perfiles.js";
import { saldo } from "../comun/fichas.js";
import {
  miColeccion, escucharColeccion, alCambiarColeccion, abrirHuevos, laTengo, aspectoDe, elegirAspecto, todasEnShiny,
  alternarDestacado, MAX_DESTACADOS,
  PRECIO_HUEVO, PRECIO_DIEZ, DEVOLUCION, PROB_SHINY
} from "../comun/coleccion.js";
import { RETRATOS, archivoHoja } from "../pokedex/datos.js";
import { avisar } from "../comun/ventanas.js";
import { t, LOCALE, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies } from "./comun.js";

const GENERACIONES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const PAUSA_HUEVO = 900;  // ms que se agitan antes de abrirse
const PAUSA_ENTRE = 140;  // ms entre uno y otro al abrirse

let caja = null;
let especies = [];
let generacion = 1;
let abriendo = false;
let ultimos = null; // lo que salió en los últimos huevos (se sigue viendo hasta abrir más)
let fase = "quietos"; // los huevos de «ultimos»: "agitando", "abriendo" o "quietos" (ya abiertos)

const numero = (n) => n.toLocaleString(LOCALE);
const moneda = (n) => `<span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(n)}</span>`;

export async function montarColeccion(contenedor) {
  caja = contenedor;
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  especies = await cargarEspecies();
  escucharColeccion();
  pintar();
}

// Hay que volver a pintar cuando cambia (otra pestaña, o al llegar la primera vez)
alCambiarColeccion(() => {
  if (caja && caja.isConnected && !abriendo) pintar();
});

// ---------- Retratos ----------

function retratoEnHoja(especie, clase) {
  if (especie.retrato == null || especie.retrato < 0) return `<span class="${clase}"></span>`;
  const porHoja = RETRATOS.columnas * RETRATOS.filasPorHoja;
  const dentro = especie.retrato % porHoja;
  return `<span class="${clase} en-hoja" style="background-image:url(${archivoHoja(Math.floor(especie.retrato / porHoja))});--columna:${dentro % RETRATOS.columnas};--fila:${Math.floor(dentro / RETRATOS.columnas)}"></span>`;
}

function retrato(especie, shiny, clase) {
  return shiny
    ? imagenConRespaldo(urlsPMD({ id: especie.id, shiny: true }), `class="${clase}" alt="" loading="lazy" data-quitar-si-falla`)
    : retratoEnHoja(especie, clase);
}

// ---------- Pintar ----------

function plantillaCabeza(coleccion) {
  const tengo = especies.filter((especie) => laTengo(coleccion, especie.id)).length;
  const shiny = Object.keys(coleccion.shiny).length;
  const perfil = usuarioActual() ? miPerfil() : null;
  const dinero = perfil ? saldo(perfil) : 0;
  return `
    <div class="coleccion-cabeza">
      <div class="coleccion-progreso">
        <span class="coleccion-cuenta"><strong>${numero(tengo)}</strong> / ${numero(especies.length)} ${t("especies")}</span>
        <div class="logro-barra grande"><span style="width:${(tengo / especies.length) * 100}%"></span></div>
        <small>${icono("estrella")} ${t("{n} shiny", { n: shiny })}</small>
      </div>
      <div class="coleccion-huevos">
        <span class="huevo-dibujo grande"></span>
        <div class="coleccion-comprar">
          <button data-abrir="1" ${dinero >= PRECIO_HUEVO && !abriendo ? "" : "disabled"}>${t("Abrir 1 huevo")} ${moneda(PRECIO_HUEVO)}</button>
          <button data-abrir="10" ${dinero >= PRECIO_DIEZ && !abriendo ? "" : "disabled"}>${t("Abrir 10 huevos")} ${moneda(PRECIO_DIEZ)}</button>
        </div>
        <small class="coleccion-reglas">${t("De cada huevo sale una especie al azar (1 de cada {n}, shiny; los legendarios y singulares, más difíciles). Los repetidos se cambian solos por {normal} Pokédólares ({shiny} si es shiny).", { n: PROB_SHINY, normal: DEVOLUCION.normal, shiny: DEVOLUCION.shiny })}</small>
      </div>
    </div>`;
}

function plantillaResultado(r, i) {
  const clase = `${r.nuevo ? "nuevo" : "repetido"} ${r.shiny ? "shiny" : ""}`;
  return `
    <div class="coleccion-sale ${clase}" style="--retraso: ${i * PAUSA_ENTRE}ms">
      <span class="huevo-dibujo"></span>
      <div class="coleccion-sale-dentro">
        ${retrato(r.especie, r.shiny, "coleccion-sale-foto")}
        <strong>${escaparHTML(nombreDe(r.especie))}</strong>
        <small>${r.shiny ? `${icono("estrella")} ${t("¡Shiny!")}` : ""} ${r.nuevo ? t("¡Nuevo!") : t("Repetido: +{n}", { n: r.devuelve })}</small>
      </div>
    </div>`;
}

// Cada una con el aspecto que hayas elegido (aspectoDe): la cara de Mundo Misterioso y, si la
// tienes shiny, en shiny o no. Las normales de cara «Normal» salen de la hoja; el resto, una a una.
function retratoElegido(especie, coleccion, clase) {
  const { cara, shiny } = aspectoDe(coleccion, especie.id);
  if (cara === "Normal" && !shiny) return retratoEnHoja(especie, clase);
  return imagenConRespaldo(urlsPMDEmocion({ id: especie.id, shiny }, cara), `class="${clase}" alt="" loading="lazy" data-quitar-si-falla`);
}

function plantillaRejilla(coleccion) {
  const deLaGen = especies.filter((especie) => especie.gen === generacion);
  const tengoGen = deLaGen.filter((especie) => laTengo(coleccion, especie.id)).length;
  const conShiny = Object.keys(coleccion.shiny);
  const todasEnShinyYa = conShiny.length > 0 && conShiny.every((id) => aspectoDe(coleccion, id).shiny);
  return `
    <div class="coleccion-filtros">
      <div class="coleccion-gens">
        ${GENERACIONES.map((gen) => {
          const todas = especies.filter((especie) => especie.gen === gen);
          const mias = todas.filter((especie) => laTengo(coleccion, especie.id)).length;
          return `<button data-gen="${gen}" class="${gen === generacion ? "activa" : ""} ${mias === todas.length ? "completa" : ""}">
                    ${t("Gen. {n}", { n: gen })} <small>${mias}/${todas.length}</small>
                  </button>`;
        }).join("")}
      </div>
      ${conShiny.length
        ? `<button class="coleccion-todas-shiny" data-shiny="${todasEnShinyYa ? "no" : "si"}">
            ${icono("estrella")} ${todasEnShinyYa ? t("Ver todas en normal") : t("Poner en shiny las que tengo shiny")}
          </button>`
        : ""}
    </div>
    <p class="coleccion-nota">${t("Generación {gen}: tienes {n} de {total}. Pulsa uno de los tuyos para elegir su cara (y, si lo tienes shiny, verlo en shiny).", { gen: generacion, n: tengoGen, total: deLaGen.length })}</p>
    <div class="coleccion-rejilla">
      ${deLaGen
        .map((especie) => {
          const tengo = laTengo(coleccion, especie.id);
          const veces = (coleccion.especies[especie.id] || 0) + (coleccion.shiny[especie.id] || 0);
          const nombre = escaparHTML(nombreDe(especie));
          if (!tengo) {
            return `
              <div class="coleccion-casilla falta" title="#${especie.id}">
                <span class="coleccion-foto vacia">?</span>
                <span class="coleccion-numero">#${String(especie.id).padStart(4, "0")}</span>
              </div>`;
          }
          return `
            <button class="coleccion-casilla tuya ${aspectoDe(coleccion, especie.id).shiny ? "shiny" : ""}" data-especie="${especie.id}" title="${nombre}">
              ${retratoElegido(especie, coleccion, "coleccion-foto")}
              <span class="coleccion-numero">${nombre}</span>
              ${coleccion.shiny[especie.id] ? `<span class="coleccion-estrella" title="${t("La tienes shiny")}">${icono("estrella")}</span>` : ""}
              ${veces > 1 ? `<span class="coleccion-veces">×${veces}</span>` : ""}
            </button>`;
        })
        .join("")}
    </div>`;
}

function pintar() {
  if (!usuarioActual()) {
    caja.innerHTML = `<p class="juegos-nota">${t("Inicia sesión para abrir huevos y empezar tu colección.")}</p>`;
    return;
  }
  const coleccion = miColeccion();
  if (!coleccion) {
    caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
    return;
  }
  caja.innerHTML = `
    ${plantillaCabeza(coleccion)}
    ${ultimos ? `<div class="coleccion-salidos ${fase} ${ultimos.length > 1 ? "diez" : ""}">${ultimos.map(plantillaResultado).join("")}</div>` : ""}
    ${plantillaRejilla(coleccion)}`;

  for (const boton of caja.querySelectorAll("[data-abrir]")) {
    boton.addEventListener("click", () => abrir(Number(boton.dataset.abrir)));
  }
  for (const boton of caja.querySelectorAll("[data-gen]")) {
    boton.addEventListener("click", () => {
      generacion = Number(boton.dataset.gen);
      pintar();
    });
  }
  const todas = caja.querySelector(".coleccion-todas-shiny");
  if (todas) {
    todas.addEventListener("click", () => {
      todas.disabled = true;
      todasEnShiny(todas.dataset.shiny === "si").catch(siFalla);
    });
  }
  for (const casilla of caja.querySelectorAll("[data-especie]")) {
    casilla.addEventListener("click", () => abrirAspecto(especies.find((especie) => especie.id === Number(casilla.dataset.especie))));
  }
}

function siFalla(error) {
  console.error(error);
  avisar(t("No se ha podido guardar. Prueba otra vez."));
}

// ---------- Elegir el aspecto de uno ----------
//
// Una ventana con todas sus caras de Mundo Misterioso (las que no existen se quitan solas) y,
// arriba, Normal o Shiny (cada una solo si la tienes). Al pulsar una cara, se queda esa.

let dialogo = null;
let editando = null; // { especie, shiny }

function crearDialogo() {
  dialogo = document.createElement("dialog");
  dialogo.className = "dialogo-sesion dialogo-aspecto";
  document.body.appendChild(dialogo);
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo || e.target.closest(".aspecto-cerrar")) {
      dialogo.close();
      return;
    }
    const version = e.target.closest("[data-version]");
    if (version && !version.disabled) {
      editando.shiny = version.dataset.version === "shiny";
      pintarAspecto();
      return;
    }
    if (e.target.closest("[data-destacar]")) {
      alternarDestacado(editando.especie.id)
        .then(() => dialogo.open && pintarAspecto())
        .catch(siFalla);
      return;
    }
    const cara = e.target.closest("[data-cara]");
    if (cara) {
      elegirAspecto(editando.especie.id, cara.dataset.cara, editando.shiny).catch(siFalla);
      dialogo.close();
    }
  });
}

function abrirAspecto(especie) {
  if (!especie) return;
  if (!dialogo) crearDialogo();
  editando = { especie, shiny: aspectoDe(miColeccion(), especie.id).shiny };
  pintarAspecto();
  dialogo.showModal();
}

function pintarAspecto() {
  const coleccion = miColeccion();
  const { especie, shiny } = editando;
  const actual = aspectoDe(coleccion, especie.id);
  const tieneNormal = Boolean(coleccion.especies[especie.id]);
  const tieneShiny = Boolean(coleccion.shiny[especie.id]);
  // En shiny, solo la shiny (sin caer a la normal si Mundo Misterioso no la tiene: así no se
  // confunden); si no la hay, esa cara no sale
  const urls = (cara) => urlsPMDEmocion({ id: especie.id, shiny }, cara).slice(0, shiny ? 1 : undefined);
  dialogo.innerHTML = `
    <h2>${escaparHTML(nombreDe(especie))}</h2>
    <div class="aspecto-versiones">
      <button data-version="normal" class="${shiny ? "" : "activa"}" ${tieneNormal ? "" : "disabled"}
              title="${tieneNormal ? "" : t("Todavía no lo tienes normal")}">${t("Normal")}</button>
      <button data-version="shiny" class="${shiny ? "activa" : ""}" ${tieneShiny ? "" : "disabled"}
              title="${tieneShiny ? "" : t("Todavía no lo tienes shiny")}">${icono("estrella")} ${t("Shiny")}</button>
    </div>
    <p class="coleccion-nota">${t("Elige la cara con la que quieres verlo en tu colección.")}</p>
    <div class="aspecto-caras">
      ${EMOCIONES_PMD.map((cara) => `
        <button class="aspecto-cara ${cara === actual.cara && shiny === actual.shiny ? "elegida" : ""}" data-cara="${cara}" title="${cara}">
          ${imagenConRespaldo(urls(cara), `alt="" loading="lazy" data-quitar-si-falla`)}
        </button>`).join("")}
    </div>
    <div class="dialogo-botones">
      ${(() => {
        const destacado = coleccion.destacados.map(Number).includes(especie.id);
        const lleno = !destacado && coleccion.destacados.length >= MAX_DESTACADOS;
        return `<button class="boton-gris boton-izquierda aspecto-destacar ${destacado ? "activo" : ""}" data-destacar
                        title="${lleno ? t("Ya tienes {n} destacados: al poner este se quita el primero.", { n: MAX_DESTACADOS }) : ""}">
                  ${icono("chincheta")} ${destacado ? t("Quitar de mi perfil") : t("Destacar en mi perfil")}
                </button>`;
      })()}
      <button class="boton-gris aspecto-cerrar">${t("Cerrar")}</button>
    </div>`;
}

// ---------- Abrir ----------

async function abrir(cuantos) {
  if (abriendo) return;
  abriendo = true;
  let resultados;
  try {
    resultados = await abrirHuevos(cuantos, especies);
  } catch (error) {
    abriendo = false;
    console.error(error);
    await avisar(error.message === "sin-saldo" ? t("No tienes Pokédólares suficientes.") : t("No se ha podido abrir. Prueba otra vez."));
    pintar();
    return;
  }
  // Los huevos se agitan (CSS) y, al poco, se abren uno detrás de otro
  ultimos = resultados;
  fase = "agitando";
  pintar();
  await new Promise((listo) => setTimeout(listo, PAUSA_HUEVO));
  fase = "abriendo";
  const salidos = caja.querySelector(".coleccion-salidos");
  if (salidos) salidos.classList.replace("agitando", "abriendo");
  await new Promise((listo) => setTimeout(listo, PAUSA_ENTRE * resultados.length + 500));
  fase = "quietos";
  abriendo = false;
  // Se ve la generación del primero nuevo (si lo hay), para encontrarlo en la rejilla
  const nuevo = resultados.find((r) => r.nuevo);
  if (nuevo) generacion = nuevo.especie.gen;
  if (caja.isConnected) pintar();
}
