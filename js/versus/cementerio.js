// Cementerio de un locke y la ventana de apuntar un muerto.
//
//   · Cementerio: una columna por jugador (la tuya primero), con sus muertos como lápidas con
//     el retrato de Mundo Misterioso. En la tuya, una lápida «+» para apuntar uno, una X en
//     cada uno para quitarlo si te equivocaste, y se cambian de sitio arrastrándolos.
//   · Apuntar un muerto: Pokémon (con su forma, si tiene varias: Alola, Mega...) y mote. Sale
//     también al darle a «−» en tus vidas: ahí el Pokémon es opcional (se puede perder una
//     vida sin decir quién).
//
// Los datos están en js/comun/lockes.js (Cementerio).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { claseMarcoDe } from "../comun/fichas.js";
import { usuarioActual } from "../comun/nube.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { obtenerVariedades, etiquetaForma } from "../comun/formas.js";
import { elegirForma, datosDeForma } from "../comun/elegir-forma.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { activarArrastre } from "../comun/arrastrar.js";
import {
  lockePorId, estadoDe, muertosDe, apuntarMuerto, borrarMuerto, reordenarMuertos, cambiarNumero, alCambiarLockes,
  estaEliminado, REACCIONES, reaccionar
} from "../comun/lockes.js";
import { confirmar } from "../comun/ventanas.js";
import { t, LOCALE, enIngles, nombre as nombreDe } from "../comun/idioma.js";

let dialogoCementerio = null;
let dialogoMuerte = null;
let idCementerio = null; // locke del cementerio abierto

let idMuerte = null;     // locke en el que se apunta el muerto
let desdeVidas = false;  // se abrió con el «−» de las vidas
let elegido = null;      // Pokémon elegido: { id, es, texto (lo que sale en la casilla), es/en (con la forma), forma }
let eligiendo = null;    // promesa mientras se pregunta la forma (al guardar se espera a que acabe)
let listaPokemon = [];   // la que mira el autocompletado (se rellena al cargar los datos)
let autocompletado = null;

// Retrato de Mundo Misterioso del muerto (de su forma, si es una); si no lo hay, el sprite
// pequeño. Una forma sin retrato propio NO cae al de la especie: saldría la forma normal.
export function retratoMuerto(muerto, clase = "") {
  const p = { id: muerto.especie, idForma: muerto.idForma, formaPMD: muerto.formaPMD || 0 };
  return imagenConRespaldo(
    urlsRetrato(p),
    `class="${clase}" alt="" loading="lazy" data-quitar-si-falla`
  );
}

// El nombre se guarda en español («nombre») y en inglés («en», los apuntados desde que hay inglés)
function especieMuerto(muerto) {
  return (enIngles && muerto.en) || muerto.nombre;
}

export function nombreMuerto(muerto) {
  return muerto.mote ? `${especieMuerto(muerto)} «${muerto.mote}»` : especieMuerto(muerto);
}

// ---------- Cementerio ----------

export function totalMuertos(locke) {
  return Object.values((locke && locke.muertos) || {}).reduce((total, lista) => total + lista.length, 0);
}

// Las reacciones de los del locke a un muerto: las que hay, con cuántas (la tuya, marcada), y
// una «+» que despliega las que se pueden poner. Una por persona.
function plantillaReacciones(locke, muerto) {
  const deEste = (locke.reacciones || {})[muerto.id] || {};
  const mia = deEste[usuarioActual().uid];
  const cuantas = new Map();
  for (const reaccion of Object.values(deEste)) cuantas.set(reaccion, (cuantas.get(reaccion) || 0) + 1);

  const usadas = REACCIONES.filter((reaccion) => cuantas.get(reaccion))
    .map(
      (reaccion) =>
        `<button class="reaccion ${reaccion === mia ? "mia" : ""}" data-reaccion="${reaccion}" data-muerto="${escaparHTML(muerto.id)}">${reaccion}<small>${cuantas.get(reaccion)}</small></button>`
    )
    .join("");
  const opciones = REACCIONES.map(
    (reaccion) => `<button class="reaccion-opcion" data-reaccion="${reaccion}" data-muerto="${escaparHTML(muerto.id)}">${reaccion}</button>`
  ).join("");

  return `
    <div class="tumba-reacciones">
      ${usadas}
      <span class="reaccion-mas">
        <button class="reaccion-abrir" title="${t("Reaccionar")}">${icono("mas")}</button>
        <span class="reaccion-opciones">${opciones}</span>
      </span>
    </div>`;
}

function plantillaTumba(locke, muerto, mia) {
  const fecha = muerto.fecha
    ? new Date(muerto.fecha).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })
    : "";
  // «Contra quién» ya no se pregunta; solo lo llevan los de antes
  const detalle = [muerto.causa && t("Contra {causa}", { causa: muerto.causa }), fecha].filter(Boolean).join(" · ");
  // Las tuyas se pueden arrastrar para cambiarlas de sitio
  return `
    <div class="tumba ${mia ? "movible" : ""}" title="${escaparHTML(detalle)}" data-id="${escaparHTML(muerto.id)}"
         ${mia ? `draggable="true"` : ""}>
      ${retratoMuerto(muerto, "tumba-cara")}
      <span class="tumba-mote">${escaparHTML(muerto.mote || especieMuerto(muerto))}</span>
      ${muerto.mote ? `<span class="tumba-especie">${escaparHTML(especieMuerto(muerto))}</span>` : ""}
      ${mia ? `<button class="tumba-quitar" data-muerto="${escaparHTML(muerto.id)}" title="${t("Quitar")}">${icono("aspa")}</button>` : ""}
      ${plantillaReacciones(locke, muerto)}
    </div>`;
}

function plantillaColumna(locke, uid) {
  const usuario = usuarioActual();
  const mia = uid === usuario.uid;
  const muertos = [...muertosDe(locke, uid)].reverse(); // el último, primero
  const nombre = (locke.nombres || {})[uid] || t("Jugador");
  const foto = (locke.fotos || {})[uid] || "";
  const abierto = locke.estado !== "cerrado";

  return `
    <section class="cementerio-jugador ${mia ? "mio" : ""}">
      <header>
        <span class="cementerio-cara ${claseMarcoDe(uid)}" data-perfil="${escaparHTML(uid)}" title="${t("Ver perfil")}">${foto ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer">` : escaparHTML(nombre[0] || "?")}</span>
        <span class="cementerio-nombre">${escaparHTML(nombre)}</span>
        <span class="cementerio-cuenta">${icono("calavera")} ${muertos.length}</span>
      </header>
      <div class="tumbas">
        ${mia && abierto ? `<button class="tumba tumba-nueva" title="${t("Apuntar un muerto")}">${icono("mas")}</button>` : ""}
        ${muertos.map((muerto) => plantillaTumba(locke, muerto, mia)).join("")}
        ${!muertos.length && !(mia && abierto) ? `<p class="cementerio-vacio">${t("Ninguno")}</p>` : ""}
      </div>
    </section>`;
}

// ---------- Cambiar de sitio tus muertos arrastrándolos ----------
//
// Solo dentro de tu columna (los de los demás no se tocan: lo comprueban las reglas). Se ven
// del último al primero, así que al guardar se le da la vuelta al orden de la pantalla.

let tumbaArrastrada = null;

function activarArrastreTumbas(alFallar) {
  const cuerpo = dialogoCementerio.querySelector(".cementerio-cuerpo");
  activarArrastre(cuerpo, {
    elementos: ".tumba.movible",
    // Solo entre las lápidas de la misma columna (la tuya)
    zona: (destino, arrastrada) =>
      destino.closest && destino.closest(".tumbas") === arrastrada.parentElement ? arrastrada.parentElement : null,
    puedeEmpezar: (e, tumba) => {
      tumbaArrastrada = tumba;
      return true;
    },
    alTerminar: (tumba, movido) => {
      tumbaArrastrada = null;
      if (!movido) return;
      const ids = [...tumba.parentElement.querySelectorAll(".tumba.movible")].map((cada) => cada.dataset.id).reverse();
      reordenarMuertos(idCementerio, ids).catch((error) => {
        alFallar(error);
        pintarCementerio(); // vuelve a como estaba
      });
    }
  });
}

function pintarCementerio() {
  if (tumbaArrastrada) return; // a mitad de arrastrar no se repinta (se perdería lo arrastrado)
  const locke = idCementerio ? lockePorId(idCementerio) : null;
  if (!locke) {
    if (dialogoCementerio.open) dialogoCementerio.close();
    return;
  }

  const usuario = usuarioActual();
  const jugadores = locke.jugadores
    .filter((uid) => estadoDe(locke, uid) === "aceptado")
    .sort((uno, otro) => Number(otro === usuario.uid) - Number(uno === usuario.uid));

  dialogoCementerio.querySelector(".cementerio-titulo").innerHTML =
    `${icono("calavera")} ${t("Cementerio")} · ${escaparHTML(locke.nombre)}`;
  dialogoCementerio.querySelector(".cementerio-cuerpo").innerHTML =
    `<div class="cementerio-columnas">${jugadores.map((uid) => plantillaColumna(locke, uid)).join("")}</div>`;
}

export function abrirCementerio(id) {
  idCementerio = id;
  pintarCementerio();
  if (!dialogoCementerio.open) dialogoCementerio.showModal();
}

// ---------- Apuntar un muerto ----------

// desdeLasVidas: con el «−» de las vidas (siempre quita vida y el Pokémon es opcional).
// Si no, desde el cementerio (el Pokémon hace falta y lo de la vida se elige).
export function abrirMuerte(id, desdeLasVidas) {
  const locke = lockePorId(id);
  if (!locke) return;

  idMuerte = id;
  desdeVidas = desdeLasVidas;
  elegido = null;
  eligiendo = null;

  // Con 0 vidas, la que se pierde es la vida cero: queda fuera del locke
  const usuario = usuarioActual();
  const vidaCero = !locke.vidasIlimitadas && usuario && ((locke.vidas || {})[usuario.uid] || 0) === 0;

  dialogoMuerte.querySelector(".muerte-titulo").textContent =
    desdeLasVidas ? (vidaCero ? t("Perder la vida cero") : t("Perder una vida")) : t("Apuntar un muerto");
  dialogoMuerte.querySelector(".muerte-ok").textContent =
    desdeLasVidas ? (vidaCero ? t("Perder el locke") : t("Quitar vida")) : t("Apuntar");
  dialogoMuerte.querySelector(".muerte-vida-texto").textContent =
    vidaCero ? t("Perder también la vida cero (quedas eliminado)") : t("Quitar también una vida");
  for (const selector of [".muerte-pokemon", ".muerte-mote"]) {
    dialogoMuerte.querySelector(selector).value = "";
  }
  dialogoMuerte.querySelector(".muerte-error").textContent = "";

  // La casilla de la vida solo desde el cementerio, y solo si el locke tiene vidas
  const casilla = dialogoMuerte.querySelector(".muerte-vida");
  dialogoMuerte.querySelector(".muerte-vida-campo").hidden =
    desdeLasVidas || locke.vidasIlimitadas || estaEliminado(locke, usuario && usuario.uid);
  casilla.checked = !locke.vidasIlimitadas;

  dialogoMuerte.showModal();
  dialogoMuerte.querySelector(".muerte-pokemon").focus();
  cargarDatos()
    .then(() => (listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon)))
    .catch((error) => console.error(error));
}

// Elegida la especie: si tiene varias formas, se pregunta cuál (cancelar = la normal)
async function elegirEspecie(pokemon) {
  const campo = dialogoMuerte.querySelector(".muerte-pokemon");
  elegido = { id: pokemon.id, es: pokemon.es, en: pokemon.en, texto: nombreDe(pokemon), forma: {} };
  campo.value = elegido.texto;

  let info = { especie: "", lista: [] };
  try {
    info = await obtenerVariedades(pokemon.id);
  } catch (error) {
    // sin información de formas: la normal
  }

  if (info.lista.length > 1) {
    const slug = await elegirForma(pokemon, info);
    try {
      const forma = slug ? await datosDeForma(info, slug) : {};
      if (forma.etiqueta) {
        const es = `${pokemon.es} (${etiquetaForma(slug, info.especie, "es")})`;
        const en = `${pokemon.en} (${etiquetaForma(slug, info.especie, "en")})`;
        elegido = { ...elegido, es, en, texto: `${nombreDe(pokemon)} (${forma.etiqueta})`, forma };
        campo.value = elegido.texto;
      }
    } catch (error) {
      console.error(error); // sin conexión: se queda la normal
    }
  }
  dialogoMuerte.querySelector(".muerte-mote").focus();
}

async function guardarMuerte() {
  const error = dialogoMuerte.querySelector(".muerte-error");
  const texto = dialogoMuerte.querySelector(".muerte-pokemon").value.trim();

  // Si ha escrito algo sin elegirlo de la lista, se coge la primera sugerencia
  if (texto && (!elegido || elegido.texto !== texto)) autocompletado.elegirPrimera();
  if (eligiendo) await eligiendo;
  if (texto && !elegido) {
    error.textContent = t("Elige un Pokémon de la lista.");
    return;
  }
  if (!desdeVidas && !elegido) {
    error.textContent = t("¿Qué Pokémon ha muerto?");
    return;
  }

  const id = idMuerte;
  dialogoMuerte.close();

  if (!elegido) {
    await cambiarNumero(id, usuarioActual().uid, "vidas", -1);
    return;
  }

  const { idForma, formaPMD, imagenForma } = elegido.forma;
  await apuntarMuerto(
    id,
    {
      especie: elegido.id,
      nombre: elegido.es,
      en: elegido.en || "",
      mote: dialogoMuerte.querySelector(".muerte-mote").value.trim(),
      idForma,
      formaPMD,
      imagenForma
    },
    desdeVidas || dialogoMuerte.querySelector(".muerte-vida").checked
  );
}

// ---------- Arranque ----------

// alFallar(error): para que la sección diga que no se ha podido guardar
export function iniciarCementerio(alFallar) {
  dialogoCementerio = document.querySelector("#dialogo-cementerio");
  dialogoMuerte = document.querySelector("#dialogo-muerte");

  dialogoCementerio.querySelector(".cementerio-cerrar").addEventListener("click", () => dialogoCementerio.close());
  dialogoCementerio.addEventListener("close", () => (idCementerio = null));
  activarArrastreTumbas(alFallar);

  dialogoCementerio.querySelector(".cementerio-cuerpo").addEventListener("click", async (e) => {
    if (e.target.closest(".tumba-nueva")) {
      abrirMuerte(idCementerio, false);
      return;
    }
    const reaccion = e.target.closest("[data-reaccion]");
    if (reaccion) {
      reaccionar(idCementerio, reaccion.dataset.muerto, reaccion.dataset.reaccion).catch(alFallar);
      return;
    }
    const abrir = e.target.closest(".reaccion-abrir");
    if (abrir) {
      const mas = abrir.parentElement;
      const yaAbierto = mas.classList.contains("abierto");
      for (const otro of dialogoCementerio.querySelectorAll(".reaccion-mas.abierto")) otro.classList.remove("abierto");
      mas.classList.toggle("abierto", !yaAbierto);
      return;
    }
    const quitar = e.target.closest(".tumba-quitar");
    if (quitar && (await confirmar(`${t("¿Quitar este Pokémon del cementerio?")}\n\n${t("La vida no se devuelve: eso se hace con el «+».")}`))) {
      borrarMuerto(idCementerio, quitar.dataset.muerto).catch(alFallar);
    }
  });

  const campo = dialogoMuerte.querySelector(".muerte-pokemon");
  // Enter con sugerencias a la vista elige la primera (lo hace el autocompletado) y se queda
  // en la ventana para poner el mote; no la manda. Tiene que ir antes que el autocompletado,
  // que al elegir vacía las sugerencias.
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && campo.parentElement.querySelector(".sugerencias .opcion")) e.preventDefault();
  });
  autocompletado = activarAutocompletado(campo, listaPokemon, (pokemon) => {
    eligiendo = elegirEspecie(pokemon).finally(() => (eligiendo = null));
  }, { icono: iconoPokemon });
  campo.addEventListener("input", () => (elegido = null));

  dialogoMuerte.querySelector(".muerte-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarMuerte().catch(alFallar);
  });
  dialogoMuerte.querySelector(".muerte-cancelar").addEventListener("click", () => dialogoMuerte.close());

  // Si alguien apunta un muerto con el cementerio abierto, sale al momento
  alCambiarLockes(() => {
    if (dialogoCementerio.open) pintarCementerio();
  });
}
