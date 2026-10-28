// «Partida» de un locke: el archivo de guardado del emulador vinculado a tu bloque.
//
//   · En tu bloque (solo en tu pantalla): tu equipo de la partida y el botón para vincularla.
//     Mientras se vigila el archivo, cada vez que guardas en el emulador se vuelve a leer.
//   · La ventana «Partida»: equipo y cajas, qué caja es la de los muertos, «Copiar a Mis
//     equipos» y exportar una caja entera como paste de Showdown.
//   · Los que entran nuevos en la caja de los muertos se proponen para el cementerio.
//   · Las capturas se marcan solas en «Rutas» (js/partida/rutas.js).
//   · Pulsando un Pokémon de la ventana se edita (./editor.js), con la partida vigilada y en
//     los juegos que se saben escribir; en un hueco libre, se crea. Arrastrándolos, se cambian
//     de sitio. «Meter equipo» (./meter-equipo.js) y «Copias», que deshace una edición.
//
// Los demás no ven nada de esto: solo lo que ya veían (el cementerio, las vidas, la actividad) y
// que has editado tu partida.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { confirmar, avisar as avisarVentana } from "../comun/ventanas.js";
import { usuarioActual } from "../comun/nube.js";
import { caraDePokemon, carasDeEquipo } from "../comun/elegir-equipo.js";
import { cargarDatos } from "../comun/datos.js";
import { sumarContador } from "../comun/contadores.js";
import { lockePorId, muertosDe, apuntarMuerto, estaEliminado, apuntarSuceso, medallasDe, cambiarMedallas } from "../comun/lockes.js";
import { tieneMedallas } from "../comun/medallas.js";
import { textoInfraccion } from "../partida/infracciones.js";
import {
  sePuedeVigilar, cargarVinculos, vincular, reanudar, desvincular, leerUnaVez, estadoVinculo,
  copiasDe, restaurarCopia
} from "../partida/vinculo.js";
import { EDITABLES, formatoDeSeguro } from "../partida/formato.js";
import { POR_CAJA } from "../partida/tresds.js";
import { pintarBolsa, activarBolsa } from "./bolsa.js";
import { mover } from "../partida/huecos.js";
import { prepararConversion, cajaConDetalle, pasteDeEquipo } from "../partida/convertir.js";
import { copiarAlPortapapeles } from "../equipos/exportar.js";
import { iniciarEditor, abrirEditor, cerrarEditor, editorEnLado, sitioEditando, reservarEditor } from "./editor.js";
import { iniciarMeter, abrirMeter } from "./meter-equipo.js";
import {
  prepararDatos, cambiarHuecos, comprobarSitio, hayCambios, cuantosCambios, vistaConCambios, guardarCambios, descartarCambios, alCambiarBorrador,
  bytesComoSeVen
} from "./editor-comun.js";
import {
  sePuedeLeer, partidaDe, procesarArchivo, olvidarPartida, cajasMuertosDe, alternarCajaMuertos, muertosSinApuntar,
  marcarMuertosVistos
} from "../partida/partidas.js";
import { t, LOCALE, enIngles } from "../comun/idioma.js";

let repintar = () => {};
let avisar = () => {};
let dialogo = null;
let dialogoMuertos = null;
let dialogoCopias = null;
let idAbierto = null; // locke de la ventana «Partida»
let idMuertos = null; // locke de la ventana de los muertos
let propuestos = [];
let pestana = "cajas"; // en la ventana «Partida»: «cajas» o «bolsa»

function misMuertos(locke) {
  return muertosDe(locke, usuarioActual().uid);
}

// Especie (con su forma) en el idioma de la web; las leídas antes de haber inglés, en español
function especieDe(p) {
  return (enIngles && (p.nombreEn || p.en)) || p.nombre;
}

function nombreDe(p) {
  return p.mote && p.mote !== p.es ? `${p.mote} (${especieDe(p)})` : especieDe(p);
}

// ---------- En tu bloque ----------

export function plantillaPartida(locke) {
  if (!sePuedeLeer(locke) || locke.estado === "cerrado") return "";
  const partida = partidaDe(locke.id);
  const estado = estadoVinculo(locke.id);
  const pendientes = partida ? muertosSinApuntar(locke.id, misMuertos(locke)).length : 0;

  let accion = "";
  if (estado === "leyendo") {
    accion = `<button class="locke-partida-vincular" disabled>${icono("enlace")} ${t("Leyendo...")}</button>`;
  } else if (estado === "pausado") {
    accion = `<button class="locke-partida-reanudar" title="${t("Volver a leer la partida")}">${icono("reanudar")} ${t("Reanudar")}</button>`;
  } else if (!partida) {
    // Con la partida ya leída, volver a vincular está en la ventana, junto a «Desvincular»
    accion = sePuedeVigilar
      ? `<button class="locke-partida-vincular">${icono("enlace")} ${t("Vincular partida")}</button>`
      : `<button class="locke-partida-vincular">${icono("subir")} ${t("Leer partida")}</button>`;
  }

  return `
    <div class="locke-partida">
      ${partida ? `<button class="locke-partida-abrir" title="${t("Ver cajas")}">${carasDeEquipo({ nombre: t("Equipo de la partida"), pokemon: partida.equipo })}</button>` : ""}
      ${pendientes ? `<button class="locke-partida-muertos" title="${t("Muertos por apuntar")}">${icono("calavera")} ${pendientes}</button>` : ""}
      ${accion}
      <button class="locke-partida-ayuda" title="${t("Cómo funciona")}">?</button>
    </div>`;
}

// Los botones de la partida en tu bloque. true si era uno de ellos.
export function accionPartida(boton, id) {
  const fallo = (error) => {
    if (error && error.name === "AbortError") return; // ha cerrado el selector sin elegir
    console.error(error);
    avisar(t("No se ha podido abrir la partida."));
  };
  if (boton.classList.contains("locke-partida-vincular")) {
    // Lo que hace falta para leerla, ya mientras se elige el archivo
    prepararConversion().catch((error) => console.error(error));
    if (sePuedeVigilar) vincular(id).catch(fallo);
    else leerUnaVez(id);
  } else if (boton.classList.contains("locke-partida-reanudar")) {
    reanudar(id).catch(fallo);
  } else if (boton.classList.contains("locke-partida-abrir")) {
    abrirPartida(id);
  } else if (boton.classList.contains("locke-partida-muertos")) {
    proponerMuertos(id, false);
  } else if (boton.classList.contains("locke-partida-ayuda")) {
    document.querySelector("#dialogo-ayuda-partida").showModal();
  } else {
    return false;
  }
  return true;
}

// ---------- Al leer el archivo ----------

const intentos = new Map(); // idLocke -> lecturas dudosas seguidas
const MAX_DUDOSAS = 3;

// true si ya está (bien o con un error que no se arregla reintentando)
// Las medallas de la partida, a tu tarjeta del locke (las marcadas a mano se quedan)
function subirMedallas(locke, partida) {
  if (!partida.medallas || !tieneMedallas(locke.juego)) return;
  const antes = medallasDe(locke, usuarioActual().uid);
  const todas = new Set([...antes.tiene, ...partida.medallas.flatMap((tiene, i) => (tiene ? [i] : []))]);
  const version = partida.version || antes.version;
  if (todas.size === antes.tiene.length && version === antes.version) return;
  cambiarMedallas(locke.id, [...todas], version).catch((error) => console.error(error));
}

// El árbitro de normas (../partida/arbitro.js): lo que ha visto se apunta en la actividad, donde
// lo ven los demás, y a ti te lo dice la web con cómo retirarlo si se ha equivocado
function avisarInfracciones(locke, infracciones) {
  if (!infracciones || !infracciones.length) return;
  for (const { detalle } of infracciones) {
    apuntarSuceso(locke.id, "infraccion", { detalle }).catch((error) => console.error(error));
  }
  avisarVentana(
    `${t("El árbitro ha visto algo que no cuadra con las normas y se lo ha dicho a los demás:")}\n\n` +
      infracciones.map(({ detalle }) => `· ${textoInfraccion(detalle)}`).join("\n") +
      `\n\n${t("Si se ha equivocado, retira el aviso desde la actividad del locke.")}`
  );
}

async function alLeer(id, bytes, archivo) {
  const locke = lockePorId(id);
  if (!locke) return false; // los lockes todavía no han llegado: en el siguiente vistazo
  if (locke.estado === "cerrado") return true; // ya no se lee: no vuelve a marcar «Rutas»

  const resultado = await procesarArchivo(locke, bytes, archivo);
  if (resultado.error) {
    if (resultado.reintentar) return false;
    // Puede que el emulador estuviera guardando: se mira otra vez antes de darlo por malo
    const dudosas = (intentos.get(id) || 0) + 1;
    if (resultado.dudoso && dudosas < MAX_DUDOSAS) {
      intentos.set(id, dudosas);
      return false;
    }
    intentos.delete(id);
    avisar(t(resultado.error));
    // Recién vinculado con el archivo equivocado: fuera, para poder elegir otro
    if (!partidaDe(id)) await desvincular(id);
    return true;
  }

  intentos.delete(id);
  subirMedallas(locke, resultado.partida);
  avisarInfracciones(locke, resultado.infracciones);
  repintar();
  if (dialogo.open && idAbierto === id) pintarPartida();
  // La ventana de los muertos sale sola si estás mirando «Lockes»; si no, queda el aviso
  const enLockes = document.visibilityState === "visible" && document.querySelector("#vista-lockes").offsetParent;
  if (enLockes) proponerMuertos(id, resultado.primera);
  return true;
}

// ---------- Ventana «Partida» ----------

// Se puede editar: partida vigilada (con el archivo a mano), de un juego que se sabe escribir
// y con el locke en marcha
function editable(locke) {
  return estadoVinculo(locke.id) === "vigilando" && EDITABLES.includes(locke.juego) && locke.estado !== "cerrado";
}

// sitio: "e2" (tercero del equipo) o "c4-17" (caja 5, hueco 18); con él, se puede pulsar
function ficha(p, sitio = "") {
  const titulo = [nombreDe(p), (enIngles && p.lugarEn) || p.lugar].filter(Boolean).join(" · ");
  const etiqueta = sitio ? "button" : "span";
  return `
    <${etiqueta} class="partida-ficha" title="${escaparHTML(titulo)}" ${sitio ? `data-sitio="${sitio}" data-llave="${p.llave}" draggable="true"` : ""}>
      ${caraDePokemon(p, "partida-cara")}
      ${p.huevo ? `<span class="partida-huevo" title="${t("Huevo")}">${icono("huevo")}</span>` : ""}
      <span class="partida-ficha-nombre">${escaparHTML(p.huevo ? especieDe(p) : p.mote || especieDe(p))}</span>
      <small>${p.huevo ? t("Huevo") : t("Nv. {nivel}", { nivel: p.nivel })}</small>
    </${etiqueta}>`;
}

// Un hueco libre: para crear uno nuevo o para soltar ahí uno arrastrado
function fichaVacia(sitio) {
  return `<button class="partida-ficha partida-hueco" data-sitio="${sitio}" data-llave="0" title="${t("Nuevo Pokémon (o suelta aquí uno arrastrado)")}">${icono("mas")}</button>`;
}

function primerHueco(caja) {
  const usados = new Set(caja.pokemon.map((p) => p.hueco));
  for (let hueco = 0; hueco < POR_CAJA; hueco++) if (!usados.has(hueco)) return hueco;
  return -1;
}

function sitioDe(texto) {
  if (texto.startsWith("e")) return { equipo: Number(texto.slice(1)) };
  const [caja, hueco] = texto.slice(1).split("-").map(Number);
  return { caja, hueco };
}

function textoSitio(sitio) {
  return sitio.equipo !== undefined ? `e${sitio.equipo}` : `c${sitio.caja}-${sitio.hueco}`;
}

function pintarPartida() {
  const guardada = partidaDe(idAbierto);
  const locke = lockePorId(idAbierto);
  if (!guardada || !locke) {
    dialogo.close();
    return;
  }
  // Con cambios sin guardar, se ve la partida con ellos (las cajas de muertos, las de siempre)
  const conCambios = vistaConCambios(idAbierto);
  const partida = conCambios ? { ...guardada, ...conCambios, cajasMuertos: cajasMuertosDe(guardada) } : guardada;

  const conSitio = editable(locke);
  if (!conSitio) pestana = "cajas";
  // El hueco del editor, a la derecha de las cajas, ya desde que se abre (en la bolsa no hace falta)
  reservarEditor(conSitio && pestana === "cajas");
  dialogo.classList.toggle("en-bolsa", pestana === "bolsa");
  const cuando = new Date(partida.actualizada).toLocaleString(LOCALE, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
  // Editando, dos pestañas: las cajas y la bolsa
  const titulo = conSitio
    ? `<span class="partida-pestanas">${[["cajas", t("Cajas"), "caja"], ["bolsa", t("Bolsa"), "mochila"]]
        .map(([id, texto, dibujo]) => `<button class="partida-pestana ${pestana === id ? "activa" : ""}" data-pestana="${id}">${icono(dibujo)} ${texto}</button>`)
        .join("")}</span>`
    : `${icono("caja")} ${t("Cajas")}`;
  dialogo.querySelector(".partida-titulo").innerHTML =
    `${titulo} <small>${[partida.entrenador, partida.version, cuando].filter(Boolean).map(escaparHTML).join(" · ")}</small>
     <button class="partida-ayuda" title="${t("Cómo funciona")}">?</button>`;
  const botonVincular = dialogo.querySelector(".partida-vincular");
  botonVincular.innerHTML = icono(sePuedeVigilar ? "enlace" : "subir");
  botonVincular.title = sePuedeVigilar ? t("Volver a vincular (elegir otra vez el archivo)") : t("Volver a leer");

  // Cambios sin guardar: se guardan al cerrar (o se descartan)
  const pendientes = cuantosCambios(idAbierto);
  dialogo.classList.toggle("con-cambios", pendientes > 0);
  dialogo.querySelector(".partida-pendientes").textContent = pendientes
    ? t(pendientes === 1 ? "{n} cambio sin guardar: se guardan al cerrar (con el juego cerrado)" : "{n} cambios sin guardar: se guardan al cerrar (con el juego cerrado)", { n: pendientes })
    : "";
  // Con cambios, el botón de cerrar pasa a ser uno de guardar (icono y texto): así se ve que es
  // por donde se guardan; sin cambios, la ✕ de siempre
  const cerrar = dialogo.querySelector(".partida-cerrar");
  cerrar.title = pendientes ? t("Guardar y cerrar") : t("Cerrar");
  if (!cerrar.dataset.equis) cerrar.dataset.equis = cerrar.innerHTML;
  cerrar.innerHTML = pendientes ? `${icono("guardar")} <span>${t("Guardar")}</span>` : cerrar.dataset.equis;
  cerrar.classList.toggle("guardar", pendientes > 0);

  dialogo.querySelector(".partida-copias").hidden = !conSitio || pendientes > 0;

  if (pestana === "bolsa") {
    return pintarBolsa(dialogo.querySelector(".partida-cuerpo"), idAbierto).catch((error) => {
      console.error(error);
      dialogo.querySelector(".partida-cuerpo").innerHTML = `<p>${escaparHTML(t(error.message || "No se ha podido leer la bolsa."))}</p>`;
    });
  }

  // Cada caja con «Exportar» (si tiene algo) y su interruptor de «Muertos» (puede haber varias).
  // Editando, también la primera vacía (para meter ahí) y en cada una un hueco libre. Las
  // bloqueadas (Sol / Luna: se abren según se llenan) no se ven en el juego: marcadas y sin hueco
  // para meter.
  const deMuertos = cajasMuertosDe(partida);
  const abiertas = partida.abiertas || partida.cajas.length;
  let vaciaPuesta = false;
  const cajas = partida.cajas
    .map((caja, i) => {
      const bloqueada = i >= abiertas;
      if (!caja.pokemon.length && (!conSitio || vaciaPuesta || bloqueada)) return "";
      if (!caja.pokemon.length) vaciaPuesta = true;
      const muertos = deMuertos.includes(i);
      const libre = conSitio && !bloqueada ? primerHueco(caja) : -1;
      return `
        <section class="partida-caja ${muertos ? "de-muertos" : ""} ${bloqueada ? "bloqueada" : ""}">
          <h3>
            ${bloqueada ? `<span class="partida-candado" title="${t("Bloqueada en el juego")}">${icono("candado")}</span>` : ""}
            ${escaparHTML(caja.nombre)} <small>${caja.pokemon.length}</small>
            ${caja.pokemon.length ? `<button class="partida-exportar" data-caja="${i}" title="${t("Copiar la caja como paste de Showdown")}">${icono("copiar")} ${t("Exportar")}</button>` : ""}
            <button class="partida-marcar-muertos ${muertos ? "activa" : ""}" data-caja="${i}" aria-pressed="${muertos}"
                    title="${muertos ? t("Ya no es caja de muertos") : t("Marcar como caja de muertos")}">${icono("calavera")} ${t("Muertos")}</button>
          </h3>
          <div class="partida-pokemon">
            ${caja.pokemon.map((p) => ficha(p, conSitio ? `c${i}-${p.hueco}` : "")).join("")}
            ${libre >= 0 ? fichaVacia(`c${i}-${libre}`) : ""}
          </div>
        </section>`;
    })
    .join("");

  dialogo.querySelector(".partida-cuerpo").innerHTML = `
    <section class="partida-caja partida-equipo">
      <h3>
        ${t("Equipo")}
        ${conSitio ? `<button class="partida-meter">${icono("importar")} ${t("Meter equipo")}</button>` : ""}
        <button class="partida-copiar">${icono("copiar")} ${t("Copiar a Mis equipos")}</button>      </h3>
      <div class="partida-pokemon">
        ${partida.equipo.map((p, i) => ficha(p, conSitio ? `e${i}` : "")).join("")}
        ${conSitio && partida.equipo.length < 6 ? fichaVacia(`e${partida.equipo.length}`) : ""}
      </div>
    </section>
    ${cajas}`;
  marcarEditando();
}

// El que se está editando a la derecha, marcado en las cajas
function marcarEditando() {
  for (const ficha of dialogo.querySelectorAll(".partida-ficha.editando")) ficha.classList.remove("editando");
  const sitio = sitioEditando();
  const ficha = sitio && dialogo.querySelector(`.partida-ficha[data-sitio="${textoSitio(sitio)}"]`);
  if (ficha) ficha.classList.add("editando");
}

// ---------- Mover arrastrando ----------
//
// Un Pokémon se arrastra encima de otro (se cambian de sitio) o de un hueco «+». Va a la copia
// en memoria, como lo demás, y no se apunta en la actividad: es lo mismo que el PC del juego.

let arrastrado = null; // la ficha que se está arrastrando

function marcarDestino(ficha) {
  for (const otra of dialogo.querySelectorAll(".partida-ficha.destino")) if (otra !== ficha) otra.classList.remove("destino");
  if (ficha) ficha.classList.add("destino");
}

function destinoDe(e) {
  const ficha = arrastrado && e.target.closest && e.target.closest(".partida-ficha[data-sitio]");
  return ficha && ficha !== arrastrado ? ficha : null;
}

async function moverA(desde, hasta) {
  const idLocke = idAbierto;
  const sitio = sitioDe(desde.dataset.sitio);
  const otro = sitioDe(hasta.dataset.sitio);
  // Si uno de los dos está abierto a la derecha, se cierra (cambia de hueco)
  if ([desde.dataset.sitio, hasta.dataset.sitio].includes(sitioEditando() && textoSitio(sitioEditando()))) cerrarEditor();
  try {
    await cambiarHuecos(idLocke, (h) => {
      comprobarSitio(h, sitio, Number(desde.dataset.llave));
      comprobarSitio(h, otro, Number(hasta.dataset.llave));
      mover(h, sitio, otro);
    });
  } catch (error) {
    console.error(error);
    avisarVentana(t(error.message || "No se ha podido mover."));
  }
}

function activarArrastre() {
  const cuerpo = dialogo.querySelector(".partida-cuerpo");
  cuerpo.addEventListener("dragstart", (e) => {
    const ficha = e.target.closest && e.target.closest('.partida-ficha[draggable="true"]');
    if (!ficha) return;
    arrastrado = ficha;
    requestAnimationFrame(() => arrastrado && arrastrado.classList.add("arrastrando"));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ""); // Firefox no arranca el arrastre sin esto
  });
  cuerpo.addEventListener("dragover", (e) => {
    const destino = destinoDe(e);
    marcarDestino(destino);
    if (!destino) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  cuerpo.addEventListener("drop", (e) => {
    const destino = destinoDe(e);
    if (!destino) return;
    e.preventDefault();
    moverA(arrastrado, destino);
  });
  cuerpo.addEventListener("dragend", () => {
    if (arrastrado) arrastrado.classList.remove("arrastrando");
    arrastrado = null;
    marcarDestino(null);
  });
}

export function abrirPartida(id) {
  if (!dialogo.open) pestana = "cajas";
  idAbierto = id;
  pintarPartida();
  if (partidaDe(id) && !dialogo.open) dialogo.showModal();
  // Lo que necesita el editor, ya mientras se miran las cajas: así el primero abre al momento
  prepararDatos().catch((error) => console.error(error));
}

// Guarda los cambios (si hay) y cierra. Si no se puede guardar, se queda abierta.
async function cerrarPartida() {
  const boton = dialogo.querySelector(".partida-cerrar");
  if (hayCambios(idAbierto)) {
    boton.disabled = true;
    boton.classList.add("guardando");
    try {
      await guardarCambios(idAbierto);
    } catch (error) {
      boton.disabled = false;
      boton.classList.remove("guardando");
      pintarPartida();
      if (error && error.name === "AbortError") return;
      console.error(error);
      avisarVentana(t(error.message || "No se ha podido guardar."));
      return;
    }
    boton.disabled = false;
    boton.classList.remove("guardando");
  }
  dialogo.close();
}

// «Buscar equipo» de «Crear equipo» (js/equipos/buscar.js), ya con este locke. Busca con la
// partida como está guardada (sin los cambios de aquí sin guardar). El equipo elegido va a
// «Crear equipo»: allí se va, guardando antes lo de esta ventana.
async function buscarEquipo() {
  const id = idAbierto;
  const boton = dialogo.querySelector(".partida-buscar");
  boton.disabled = true;
  try {
    const { prepararSeccion, irA } = await import("../navegacion.js");
    await prepararSeccion("equipos"); // la que pone en marcha la ventana
    const { abrirBuscar } = await import("../equipos/buscar.js");
    abrirBuscar(id, async () => {
      await cerrarPartida();
      if (!dialogo.open) irA("crear");
    });
  } catch (error) {
    console.error(error);
    avisarVentana(t("No he podido leer la caja. Vuelve a probar en un momento."));
  } finally {
    boton.disabled = false;
  }
}

async function copiarEquipo() {
  const partida = partidaDe(idAbierto);
  const locke = lockePorId(idAbierto);
  if (!partida || !locke) return;
  const boton = dialogo.querySelector(".partida-copiar");
  boton.disabled = true;
  try {
    const [{ pasteDeEquipo, prepararConversion }, { anadirEquipoDesdePaste }] = await Promise.all([
      import("../partida/convertir.js"),
      import("../equipos/importar.js"),
      cargarDatos()
    ]);
    await prepararConversion();
    const { problemas } = await anadirEquipoDesdePaste(pasteDeEquipo(partida.equipo), locke.nombre);
    sumarContador("copiar-partida"); // para los logros
    avisarVentana(problemas.length
      ? `${t("Copiado a «Mis equipos», pero algunas cosas no se han podido reconocer:")}\n\n• ${problemas.join("\n• ")}`
      : t("Copiado a «Mis equipos» ✔"));
  } catch (error) {
    console.error(error);
    avisarVentana(t("No se ha podido copiar el equipo."));
  } finally {
    boton.disabled = false;
  }
}

// ---------- Exportar una caja ----------
//
// Toda la caja como paste de Showdown (para la calculadora de daño, el teambuilder...). Lo guardado
// de las cajas no lleva ataques, habilidad ni naturaleza: con la partida vigilada se lee del
// archivo (con los cambios sin guardar, si hay); si no, sale con lo que hay y se dice por qué.

function porQueSinDetalle(id) {
  const estado = estadoVinculo(id);
  if (estado === "pausado") return t("Pulsa «Reanudar» en tu bloque y vuelve a exportarla.");
  if (estado) return t("No se ha podido leer el archivo ahora mismo: prueba otra vez en un momento.");
  return sePuedeVigilar
    ? t("Vincula la partida en este navegador (el botón del enlace, arriba) y vuelve a exportarla.")
    : t("Para eso hay que vincular la partida, y eso solo se puede en Chrome o Edge.");
}

async function exportarCaja(boton) {
  const id = idAbierto;
  const posicion = Number(boton.dataset.caja);
  const antes = boton.innerHTML;
  boton.disabled = true;
  try {
    await prepararConversion();
    const vista = vistaConCambios(id) || partidaDe(id);
    let pokemon = ((vista && vista.cajas[posicion]) || {}).pokemon || [];
    let completa = false;
    if (estadoVinculo(id) === "vigilando") {
      try {
        const bytes = await bytesComoSeVen(id);
        pokemon = await cajaConDetalle(formatoDeSeguro(bytes).leer(bytes), posicion);
        completa = true;
      } catch (error) {
        console.error(error); // el emulador a mitad de guardar, por ejemplo: con lo que hay
      }
    }
    const paste = pasteDeEquipo(pokemon);
    if (!paste) {
      avisarVentana(t("No hay nada que exportar.")); // solo huevos
      boton.disabled = false;
      return;
    }
    const copiado = await copiarAlPortapapeles(paste);
    boton.innerHTML = `${icono(copiado ? "visto" : "aspa")} ${copiado ? t("Copiada") : t("No se pudo copiar")}`;
    setTimeout(() => {
      boton.innerHTML = antes;
      boton.disabled = false;
    }, 1500);
    if (copiado && !completa) {
      avisarVentana(`${t("Copiada, pero sin ataques, habilidades ni naturalezas: de las cajas solo se leen del archivo de la partida.")}\n\n${porQueSinDetalle(id)}`);
    }
  } catch (error) {
    console.error(error);
    boton.disabled = false;
    avisarVentana(t("No se ha podido exportar la caja."));
  }
}

// ---------- Copias de seguridad ----------
//
// Antes de cada edición se guarda la partida como estaba (js/partida/vinculo.js). Volver a una
// también se apunta en la actividad del locke.

function fechaCopia(cuando) {
  return new Date(cuando).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function abrirCopias(id) {
  const copias = await copiasDe(id);
  dialogoCopias.dataset.id = id;
  dialogoCopias.querySelector(".copias-lista").innerHTML = copias.length
    ? copias
        .map(
          (copia) => `
            <div class="copias-fila">
              <span>${escaparHTML(fechaCopia(copia.cuando))}</span>
              <button class="boton-gris copias-restaurar" data-clave="${copia.clave}" data-cuando="${copia.cuando}">${icono("deshacer")} ${t("Volver a esta")}</button>
            </div>`
        )
        .join("")
    : `<p class="copias-vacio">${t("Todavía no has editado esta partida.")}</p>`;
  dialogoCopias.showModal();
}

async function restaurar(boton) {
  const id = dialogoCopias.dataset.id;
  const fecha = fechaCopia(Number(boton.dataset.cuando));
  if (!(await confirmar(`${t("¿Volver a como estaba el {fecha}?", { fecha })}\n\n${t("Cierra antes el juego en el emulador.")}`, { aceptar: t("Volver a esta") }))) return;
  boton.disabled = true;
  try {
    await restaurarCopia(id, Number(boton.dataset.clave));
    dialogoCopias.close();
    await apuntarSuceso(id, "edicion", { detalle: t("vuelta a como estaba el {fecha}", { fecha }) });
  } catch (error) {
    boton.disabled = false;
    if (error && error.name === "AbortError") return;
    console.error(error);
    avisarVentana(t(error.message || "No se ha podido."));
  }
}

// ---------- Muertos nuevos ----------

// primera: es la primera lectura de la partida (lo de la caja suele estar ya contado en las
// vidas, así que por defecto no se quitan)
function proponerMuertos(id, primera) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.estado === "cerrado" || estaEliminado(locke, usuario.uid)) return;
  if (dialogoMuertos.open) return;
  propuestos = muertosSinApuntar(id, misMuertos(locke));
  if (!propuestos.length) return;
  idMuertos = id;

  dialogoMuertos.querySelector(".partida-muertos-lista").innerHTML = propuestos
    .map(
      (p, i) => `
        <label class="casilla-sesion partida-muerto">
          <input type="checkbox" value="${i}" checked>
          ${caraDePokemon(p, "partida-cara")}
          <span>${escaparHTML(nombreDe(p))}</span>
        </label>`
    )
    .join("");
  dialogoMuertos.querySelector(".partida-muertos-vida-campo").hidden = Boolean(locke.vidasIlimitadas);
  dialogoMuertos.querySelector(".partida-muertos-vida").checked = !primera && !locke.vidasIlimitadas;
  dialogoMuertos.showModal();
}

async function apuntarPropuestos() {
  const id = idMuertos;
  const lista = propuestos;
  const marcados = [...dialogoMuertos.querySelectorAll(".partida-muerto input:checked")].map((casilla) => lista[Number(casilla.value)]);
  const quitarVida = dialogoMuertos.querySelector(".partida-muertos-vida").checked;
  dialogoMuertos.close();
  marcarMuertosVistos(id, lista.map((p) => p.llave));
  // De uno en uno: cada uno lee el cementerio que dejó el anterior
  for (const p of marcados) {
    await apuntarMuerto(
      id,
      { especie: p.id, nombre: p.nombre, en: p.nombreEn || p.en || "", mote: p.mote, idForma: p.idForma, formaPMD: p.formaPMD, imagenForma: p.imagenForma },
      quitarVida
    );
  }
  repintar();
}

// ---------- Arranque ----------

// alRepintar: volver a pintar los lockes. alAvisar(texto): decirlo en la sección.
export function iniciarPartida(alRepintar, alAvisar) {
  repintar = alRepintar;
  avisar = alAvisar;
  dialogo = document.querySelector("#dialogo-partida");
  dialogoMuertos = document.querySelector("#dialogo-partida-muertos");
  dialogoCopias = document.querySelector("#dialogo-copias");

  // Cerrar (también con Escape) guarda los cambios que haya
  dialogo.querySelector(".partida-cerrar").addEventListener("click", cerrarPartida);
  dialogo.addEventListener("cancel", (e) => {
    e.preventDefault();
    // Con el editor a la derecha, Escape cierra primero el editor
    if (editorEnLado()) cerrarEditor();
    else cerrarPartida();
  });
  dialogo.addEventListener("close", () => {
    if (editorEnLado()) cerrarEditor();
    if (hayCambios(idAbierto)) descartarCambios();
    idAbierto = null;
  });
  dialogo.querySelector(".partida-descartar").addEventListener("click", async () => {
    if (!(await confirmar(t("¿Descartar los cambios sin guardar?")))) return;
    descartarCambios();
  });
  dialogo.querySelector(".partida-titulo").addEventListener("click", (e) => {
    if (e.target.closest(".partida-ayuda")) document.querySelector("#dialogo-ayuda-partida").showModal();
    const otra = e.target.closest(".partida-pestana");
    if (otra && otra.dataset.pestana !== pestana) {
      if (editorEnLado()) cerrarEditor();
      pestana = otra.dataset.pestana;
      pintarPartida();
      dialogo.querySelector(".partida-cuerpo").scrollTop = 0;
    }
  });
  activarBolsa(dialogo.querySelector(".partida-cuerpo"), () => idAbierto);
  const ayuda = document.querySelector("#dialogo-ayuda-partida");
  ayuda.querySelector(".ayuda-partida-cerrar").addEventListener("click", () => ayuda.close());
  alCambiarBorrador(() => {
    if (dialogo.open) {
      const cuerpo = dialogo.querySelector(".partida-cuerpo");
      const scroll = cuerpo.scrollTop;
      Promise.resolve(pintarPartida()).then(() => (cuerpo.scrollTop = scroll));
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (idAbierto && hayCambios(idAbierto)) e.preventDefault();
  });
  dialogo.querySelector(".partida-desvincular").addEventListener("click", async () => {
    const aviso = hayCambios(idAbierto) ? `\n\n${t("Los cambios sin guardar se pierden.")}` : "";
    if (!(await confirmar(`${t("¿Desvincular la partida de este locke?")}\n\n${t("Lo apuntado en el cementerio y en «Rutas» se queda.")}${aviso}`))) return;
    const id = idAbierto;
    dialogo.close();
    olvidarPartida(id);
    desvincular(id).finally(repintar);
  });
  // Elegir otra vez el archivo (otro emulador, otra carpeta, otro navegador...)
  dialogo.querySelector(".partida-vincular").addEventListener("click", async () => {
    const id = idAbierto;
    if (hayCambios(id)) {
      if (!(await confirmar(t("Los cambios sin guardar se pierden. ¿Seguir?"), { aceptar: t("Seguir"), peligro: true }))) return;
      descartarCambios();
    }
    if (!sePuedeVigilar) {
      leerUnaVez(id);
      return;
    }
    vincular(id).catch((error) => {
      if (error && error.name === "AbortError") return;
      console.error(error);
      avisar(t("No se ha podido abrir la partida."));
    });
  });
  dialogo.querySelector(".partida-cuerpo").addEventListener("click", (e) => {
    const pokemon = e.target.closest(".partida-ficha[data-sitio]");
    // El que ya está abierto a la derecha: pulsarlo otra vez lo cierra
    const abiertoAlLado = sitioEditando();
    if (pokemon && abiertoAlLado && textoSitio(abiertoAlLado) === pokemon.dataset.sitio) cerrarEditor();
    else if (pokemon) abrirEditor(idAbierto, sitioDe(pokemon.dataset.sitio));
    if (e.target.closest(".partida-meter")) abrirMeter(idAbierto);
    if (e.target.closest(".partida-copiar")) copiarEquipo();
    const exportar = e.target.closest(".partida-exportar");
    if (exportar) exportarCaja(exportar);
    const marcar = e.target.closest(".partida-marcar-muertos");
    if (marcar) {
      alternarCajaMuertos(idAbierto, Number(marcar.dataset.caja));
      const cuerpo = dialogo.querySelector(".partida-cuerpo");
      const scroll = cuerpo.scrollTop; // que no salte arriba al repintar
      pintarPartida();
      cuerpo.scrollTop = scroll;
      repintar();
    }
  });

  iniciarEditor(marcarEditando);
  activarArrastre();
  iniciarMeter();
  dialogo.querySelector(".partida-buscar").addEventListener("click", buscarEquipo);
  dialogo.querySelector(".partida-copias").addEventListener("click", () => {
    abrirCopias(idAbierto).catch((error) => {
      console.error(error);
      avisar(t("No se han podido leer las copias de la partida."));
    });
  });
  dialogoCopias.querySelector(".copias-cerrar").addEventListener("click", () => dialogoCopias.close());
  dialogoCopias.querySelector(".copias-lista").addEventListener("click", (e) => {
    const boton = e.target.closest(".copias-restaurar");
    if (boton) restaurar(boton);
  });

  dialogoMuertos.querySelector(".partida-muertos-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    apuntarPropuestos().catch((error) => {
      console.error(error);
      avisar(t("No se ha podido apuntar en el cementerio."));
    });
  });
  dialogoMuertos.querySelector(".partida-muertos-descartar").addEventListener("click", () => {
    marcarMuertosVistos(idMuertos, propuestos.map((p) => p.llave));
    dialogoMuertos.close();
    repintar();
  });

  cargarVinculos(alLeer, repintar).catch((error) => console.error(error));
}
