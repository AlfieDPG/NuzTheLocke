// Sección «Foro».
//
// Hilos para charlar y, sobre todo, para encontrar gente con la que jugar un locke. Al crear un
// hilo se elige su tipo (Busco compañeros, Charla, Dudas y ayuda); «Busco compañeros» lleva el
// juego, el tipo de locke y cuánta gente falta. Solo se entra con sesión.
//
// Los moderadores (moderadores/{uid}, ver LEEME-nube.md) pueden además crear hilos «principales»
// (fijados: salen destacados arriba del todo), borrar los hilos y comentarios de otros, silenciar
// a alguien y ver la pestaña «Denuncias». El administrador (rol «admin»; tú) nombra y quita
// moderadores en la pestaña «Moderadores» y desde la ficha de cada persona.
//
// Se puede abrir el perfil de quien escribe, añadirlo como amigo y denunciar un hilo, un
// comentario o a una persona.
//
// Aquí solo está la pantalla. Los datos y las escrituras están en js/comun/foro.js.

import { icono } from "../comun/iconos.js";
import { imagenConRespaldo } from "../comun/imagenes.js";
import { escaparHTML, quitarAcentos } from "../comun/utilidades.js";
import { marcoDe, claseMarco, apuntarMarco, fondoVisual, plantillaTituloDe } from "../comun/fichas.js";
import { hayNube, usuarioActual, alCambiarSesion } from "../comun/nube.js";
import { JUEGOS } from "../comun/juegos.js";
import { plantillaCampoJuego, activarCamposJuego, leerCampoJuego, nombreJuego } from "../comun/campo-juego.js";
import { amistades, perfilesDe, pedirAmistad, buscarAmigo, lockesJugados } from "../comun/perfiles.js";
import { estaBloqueado, bloquear, desbloquear } from "../comun/chat.js";
import { marcarHiloVisto, avisosDelForo, respondidoEn, solicitudesDe, hiloSilenciado, silenciarHilo, alCambiarAvisosForo } from "../comun/avisos-foro.js";
import { estaConectado } from "../comun/presencia.js";
import { confirmar, avisar, preguntar } from "../comun/ventanas.js";
import { t, LOCALE } from "../comun/idioma.js";
import * as foro from "../comun/foro.js";
import { abrirCapa, cerrarCapa } from "../comun/atras.js";
import { cargarSugerencias, borrarSugerencia } from "../comun/sugerencias.js";

const REFRESCO = 60 * 1000;          // al volver a la sección se recarga si hace más de esto
const COMENTARIOS_POR_PAGINA = 40;   // de un hilo principal, de más nuevo a más viejo

let seccion = null;
let pestanas = null;
let barra = null;
let lista = null;
let aviso = null;
let avisoSilencio = null;
let botonMas = null;
let selectTipo = null;
let selectJuego = null;
let cuerpo = null;            // la lista y el panel del hilo, uno al lado del otro

// Lo que se ve: el foro, o (solo moderadores) las denuncias, o (solo el administrador) la lista de moderadores
let vista = "foro";
let filtroTipo = "";          // "" (todos) o una de foro.CATEGORIAS
let filtroJuego = "";
let soloAbiertos = false;
let busqueda = "";

let hilos = [];               // la lista que se ha ido cargando (más reciente primero)
let fijados = [];             // los hilos principales
let cursor = null;
let hayMas = false;
let cargadoEn = 0;
let cargando = false;

let esModerador = false;
let esAdmin = false;
let silencio = null;          // null, o { motivo } si me han silenciado
let denunciasAbiertas = 0;
let gruposDenuncias = new Map();

const perfiles = new Map();   // uid -> perfil de quien aparece en pantalla
let rolesForo = new Map();    // uid -> «admin» o «moderador»: para su insignia junto al nombre

// ---------- Cosas pequeñas ----------

function miUid() {
  const usuario = usuarioActual();
  return usuario ? usuario.uid : "";
}

function nombreCategoria(id) {
  switch (id) {
    case "busco":
      return t("Busco compañeros");
    case "general":
      return t("Charla");
    case "ayuda":
      return t("Dudas");
    default:
      return id;
  }
}

function nombreMotivo(motivo) {
  switch (motivo) {
    case "spam":
      return t("Spam o publicidad");
    case "acoso":
      return t("Acoso o insultos");
    case "ofensivo":
      return t("Contenido ofensivo");
    case "engano":
      return t("Engaño o suplantación");
    default:
      return t("Otro motivo");
  }
}

// «hace 5 min», «hace 3 h», «ayer», o la fecha
function hace(cuando) {
  const segundos = Math.max(0, (Date.now() - cuando) / 1000);
  if (segundos < 60) return t("ahora");
  if (segundos < 3600) return t("hace {n} min", { n: Math.floor(segundos / 60) });
  if (segundos < 86400) return t("hace {n} h", { n: Math.floor(segundos / 3600) });
  if (segundos < 2 * 86400) return t("ayer");
  return new Date(cuando).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

function textoRespuestas(n) {
  return n === 1 ? t("1 respuesta") : t("{n} respuestas", { n });
}

// ---------- Perfiles de quien escribe ----------

async function traerPerfiles(uids) {
  const faltan = [...new Set(uids)].filter((uid) => uid && !perfiles.has(uid));
  if (!faltan.length) return;
  try {
    for (const [uid, perfil] of await perfilesDe(faltan)) {
      perfiles.set(uid, perfil);
      apuntarMarco(perfil); // su marco, también para el chat y demás
    }
  } catch (error) {
    console.error(error);
  }
}

function perfilDe(uid) {
  return perfiles.get(uid) || { uid, nombre: t("Jugador"), foto: "", ganados: [] };
}

function foto(uid) {
  const perfil = perfilDe(uid);
  const nombre = perfil.nombre || t("Jugador");
  const imagen = perfil.foto
    ? imagenConRespaldo([escaparHTML(perfil.foto)], `alt="" draggable="false" referrerpolicy="no-referrer" data-quitar-si-falla`)
    : "";
  return `<span class="foro-foto ${claseMarco(marcoDe(perfil))}" data-inicial="${escaparHTML(nombre[0] || "?")}" data-autor="${escaparHTML(uid)}" title="${escaparHTML(nombre)}">${imagen}</span>`;
}

function nombreDe(uid) {
  return escaparHTML(perfilDe(uid).nombre || t("Jugador"));
}

// La insignia de quien modera el foro, para que se sepa que contesta alguien de la web
function insigniaModerador(uid) {
  const rol = rolesForo.get(uid);
  if (!rol) return "";
  const explicacion = rol === "admin" ? t("Administrador de la web") : t("Moderador de la web");
  return `<span class="foro-insignia-mod" title="${explicacion}">${icono("escudo")}${t("Moderador")}</span>`;
}

// La ficha de quien escribe (en la cabecera del hilo y en cada respuesta): su foto con el marco,
// el nombre, el título a la derecha y, detrás, el fondo de su tarjeta. Quien modera lleva su
// franja de color y la insignia. «extra»: lo que va tras el título (p. ej. «Autor»).
function fichaAutor(uid, extra = "") {
  const perfil = perfilDe(uid);
  const fondo = fondoVisual(perfil);
  return `
    <div class="foro-ficha ${rolesForo.has(uid) ? "moderador" : ""} ${fondo.clase}" style="${fondo.estilo}">
      ${foto(uid)}
      <div class="foro-ficha-datos">
        <button class="foro-nombre" data-autor="${escaparHTML(uid)}">${nombreDe(uid)}</button>
        ${plantillaTituloDe(perfil, "pequeno")}
        ${insigniaModerador(uid)}
        ${extra}
      </div>
    </div>`;
}

// Quién modera: lo puede leer cualquiera con sesión (firestore.rules). Si las reglas aún no están
// publicadas, quien no modera no puede: el foro sigue, solo que sin insignias.
async function traerRoles() {
  try {
    rolesForo = new Map((await foro.listarModeradores()).map((cada) => [cada.uid, cada.rol]));
  } catch (error) {
    console.warn("No se ha podido saber quién modera el foro", error);
  }
}

// Amigo ("ok"), solicitud pendiente ("pendiente") o nada (null)
function relacionCon(uid) {
  const amistad = amistades().find((cada) => cada.otro === uid);
  return amistad ? amistad.estado : null;
}

// ---------- La lista ----------

function pintarPestanas() {
  // Las pestañas son solo para moderar: quien no modera ve únicamente el foro
  const ids = esModerador ? ["foro", "denuncias"] : [];
  if (esAdmin) ids.push("moderadores", "sugerencias");
  pestanas.hidden = !esModerador;
  barra.hidden = false;   // (sin sesión se esconde; ver pintarSinSesion)
  pestanas.innerHTML = ids
    .map((id) => {
      const nombre =
        id === "foro"
          ? t("Foro")
          : id === "denuncias"
            ? t("Denuncias") + (denunciasAbiertas ? ` (${denunciasAbiertas})` : "")
            : id === "sugerencias"
              ? t("Sugerencias")
              : t("Moderadores");
      return `<button data-pestana="${id}" class="${id === vista ? "activa" : ""}">${escaparHTML(nombre)}</button>`;
    })
    .join("");

  const enForo = vista === "foro";
  barra.querySelector(".foro-nuevo").hidden = !enForo;
  barra.querySelector(".foro-filtros").hidden = !enForo;
  barra.querySelector(".foro-buscar-caja").hidden = !enForo;

  // El juego y «solo abiertos» solo tienen sentido donde se busca gente
  const conJuego = filtroTipo === "" || filtroTipo === "busco";
  selectJuego.hidden = !conJuego;
  barra.querySelector(".foro-abiertos").hidden = !conJuego;
}

// Los principales (fijados) van siempre arriba. Cuentan con el filtro de tipo (en «Charla» solo
// salen los principales de «Charla») y con la búsqueda, pero no con los de juego y «solo abiertos»
function visibles() {
  const texto = quitarAcentos(busqueda.trim());
  const base = [...fijados, ...hilos.filter((hilo) => !fijados.some((fijado) => fijado.id === hilo.id))];

  return base.filter((hilo) => {
    // El tipo vale para todos, también para los principales; el juego y «solo abiertos» no
    // (un principal normalmente no es de un juego ni se «completa»)
    const encaja =
      (!filtroTipo || hilo.categoria === filtroTipo) &&
      (hilo.fijado || ((!filtroJuego || hilo.juego === filtroJuego) && (!soloAbiertos || !hilo.cerrado)));
    return encaja && (!texto || quitarAcentos(`${hilo.titulo} ${hilo.texto}`).includes(texto));
  });
}

// Lo que se ve del tipo de un hilo y, si busca gente, su juego, su tipo de locke y cuánta falta
function chipsDeHilo(hilo, enLista = false) {
  const chips = [];
  // En la lista la chincheta del título ya dice que es principal
  if (hilo.fijado && !enLista) chips.push(`<span class="hilo-chip principal">${icono("chincheta")}${t("Principal")}</span>`);
  chips.push(`<span class="hilo-chip cat cat-${hilo.categoria}">${escaparHTML(nombreCategoria(hilo.categoria))}</span>`);
  if (hilo.categoria === "busco") {
    const juego = nombreJuego(hilo);
    if (juego) chips.push(`<span class="hilo-chip">${icono("mando")}${escaparHTML(juego)}</span>`);
    if (hilo.tipo) chips.push(`<span class="hilo-chip">${icono("etiqueta")}${escaparHTML(hilo.tipo)}</span>`);
    if (foro.faltanEnGrupo(hilo) && !hilo.cerrado) {
      chips.push(`<span class="hilo-chip busca">${icono("personaMas")}${t("Busca a {n}", { n: foro.faltanEnGrupo(hilo) })}</span>`);
    }
  }
  if (hilo.cerrado) {
    chips.push(`<span class="hilo-chip cerrado">${icono("candado")}${hilo.categoria === "busco" ? t("Completo") : t("Cerrado")}</span>`);
  }
  return chips;
}

// Una fila por hilo: la foto de quien lo empezó, el título (con la chincheta si es principal), lo
// nuevo y las respuestas; debajo, el tipo de hilo en su color, el juego, quién y cuándo. Los de
// «Busco compañeros» llevan el grupo (fotos y huecos de puntos), y debajo, si toca, «Fulano te ha
// respondido» o «N quieren unirse» (js/comun/avisos-foro.js).
function plantillaHilo(hilo) {
  const principal = hilo.fijado ? `<span class="hilo-fijado" title="${t("Principal")}">${icono("chincheta")}</span>` : "";
  const avisoHilo = avisosDelForo().find((aviso) => aviso.tipo === "hilo" && aviso.id === hilo.id);
  const respondido = respondidoEn(hilo.id);
  const piden = hilo.uid === miUid() ? solicitudesDe(hilo.id).length : 0;
  const silenciado = hiloSilenciado(hilo.id);
  const juego = hilo.categoria === "busco" ? nombreJuego(hilo) : "";

  let grupo = "";
  if (hilo.categoria === "busco" && (hilo.huecos || hilo.grupo.length)) {
    const faltan = foro.faltanEnGrupo(hilo);
    grupo = `
      <div class="hilo-grupo">
        ${[hilo.uid, ...hilo.grupo].map((uid) => foto(uid)).join("")}
        ${Array.from({ length: Math.min(faltan, 6) }, () => `<span class="foro-hueco" aria-hidden="true"></span>`).join("")}
        <span>${hilo.cerrado ? t("completo") : faltan ? t(faltan === 1 ? "falta 1" : "faltan {n}", { n: faltan }) : ""}</span>
      </div>`;
  }
  let aviso = "";
  if (respondido !== null) aviso = `<span class="hilo-aviso">${icono("deshacer")}${t("{nombre} te ha respondido", { nombre: escaparHTML(respondido || t("Alguien")) })}</span>`;
  else if (piden) aviso = `<span class="hilo-aviso">${icono("personaMas")}${t(piden === 1 ? "1 persona quiere unirse" : "{n} personas quieren unirse", { n: piden })}</span>`;

  return `
    <article class="hilo cat-${hilo.categoria} ${hilo.cerrado ? "cerrado" : ""} ${hilo.fijado ? "fijado" : ""} ${hilo.id === idAbierto ? "seleccionado" : ""}" data-hilo="${escaparHTML(hilo.id)}" tabindex="0">
      ${foto(hilo.uid)}
      <div class="hilo-cuerpo">
        <div class="hilo-linea">
          <h3 class="hilo-titulo">${principal}${escaparHTML(hilo.titulo)}</h3>
          ${avisoHilo ? `<span class="hilo-nuevas">${t(avisoHilo.nuevas === 1 ? "1 nueva" : "{n} nuevas", { n: avisoHilo.nuevas })}</span>` : ""}
          ${silenciado ? `<span class="hilo-silenciado" title="${t("Silenciado")}">${icono("campanaTachada")}</span>` : ""}
          <span class="hilo-respuestas" title="${textoRespuestas(hilo.respuestas)}">${icono("mensaje")}<b>${hilo.respuestas}</b></span>
        </div>
        <div class="hilo-meta">
          <span class="hilo-cat">${escaparHTML(nombreCategoria(hilo.categoria))}</span>
          ${juego ? `<span>${escaparHTML(juego)}</span>` : ""}
          ${hilo.cerrado && hilo.categoria !== "busco" ? `<span>${t("Cerrado")}</span>` : ""}
          <span class="hilo-autor">${nombreDe(hilo.uid)}</span>
          <span>${hace(hilo.ultimo)}</span>
        </div>
        ${grupo}
        ${aviso}
      </div>
    </article>`;
}

function pintarLista() {
  pintarPestanas();
  lista.hidden = false;

  const encajan = visibles();
  if (!encajan.length) {
    const hayFiltros = filtroTipo || filtroJuego || soloAbiertos || busqueda.trim();
    lista.innerHTML = `<p class="foro-vacio">${hayFiltros ? t("Ningún hilo de los cargados encaja con eso.") : t("Aquí no hay nada todavía. ¡Empieza tú un hilo!")}</p>`;
  } else {
    lista.innerHTML = encajan.map(plantillaHilo).join("");
  }

  botonMas.hidden = !hayMas;
}

// (El panel de la derecha sale con el foro; en «Denuncias» y «Moderadores» la lista ocupa todo el ancho)

async function cargarPagina(primera) {
  const pagina = await foro.cargarHilos(primera ? null : cursor);
  await traerPerfiles(pagina.hilos.flatMap((hilo) => [hilo.uid, ...hilo.grupo]));
  hilos = primera ? pagina.hilos : [...hilos, ...pagina.hilos];
  cursor = pagina.cursor;
  hayMas = pagina.hayMas;
}

// Pinta la vista elegida (el foro, las denuncias o los moderadores)
async function pintarVista() {
  pintarPestanas();
  const conPanel = vista === "foro";
  cuerpo.classList.toggle("sin-panel", !conPanel);
  ajustarAlto();
  if (!conPanel && idAbierto) cerrarPanel();
  if (vista === "denuncias") await pintarDenuncias();
  else if (vista === "moderadores") await pintarModeradores();
  else if (vista === "sugerencias") await pintarSugerencias();
  else pintarLista();
}

async function recargar() {
  if (cargando) return;
  cargando = true;
  aviso.textContent = "";
  perfiles.clear();

  try {
    const rol = await foro.miRol();
    esModerador = Boolean(rol);
    esAdmin = rol === "admin";
    if (vista === "denuncias" && !esModerador) vista = "foro";
    if ((vista === "moderadores" || vista === "sugerencias") && !esAdmin) vista = "foro";

    silencio = await foro.miSilencio();
    avisoSilencio.hidden = !silencio;
    avisoSilencio.textContent = silencio ? t("Un moderador te ha silenciado: puedes leer el foro, pero no escribir.") : "";

    const [nuevosFijados] = await Promise.all([foro.cargarFijados(), cargarPagina(true), traerRoles()]);
    fijados = nuevosFijados;
    await traerPerfiles(fijados.flatMap((hilo) => [hilo.uid, ...hilo.grupo]));

    if (esModerador) {
      // El número de la pestaña: si falla, el foro sigue (solo se queda sin número)
      denunciasAbiertas = await foro
        .cargarDenuncias()
        .then((denuncias) => agruparDenuncias(denuncias).size)
        .catch(() => 0);
    }

    cargadoEn = Date.now();
    await pintarVista();
  } catch (error) {
    console.error(error);
    aviso.textContent = t("No se ha podido cargar el foro.");
    if (!hilos.length) lista.innerHTML = "";
  } finally {
    cargando = false;
  }
}

async function irAVista(nueva) {
  vista = nueva;
  pintarPestanas();
  await pintarVista();
}

async function verMas() {
  botonMas.disabled = true;
  try {
    await cargarPagina(false);
    pintarLista();
  } catch (error) {
    console.error(error);
    aviso.textContent = t("No se ha podido cargar el foro.");
  } finally {
    botonMas.disabled = false;
  }
}

// Quita un hilo de lo cargado (se ha borrado) sin volver a pedir nada
function olvidarHilo(id) {
  hilos = hilos.filter((cada) => cada.id !== id);
  fijados = fijados.filter((cada) => cada.id !== id);
}

// ---------- Nuevo hilo (y editar el tuyo) ----------

let dialogoNuevo = null;
let editando = null;   // el hilo que se está editando, o null si es uno nuevo

function actualizarCamposDeBusco() {
  const esBusco = dialogoNuevo.querySelector(".foro-nuevo-categoria").value === "busco";
  dialogoNuevo.querySelector(".foro-nuevo-busco").hidden = !esBusco;
}

function abrirNuevo(hilo = null) {
  if (silencio) {
    avisar(t("Un moderador te ha silenciado: no puedes escribir en el foro."));
    return;
  }
  editando = hilo;

  dialogoNuevo.querySelector(".foro-nuevo-encabezado").textContent = hilo ? t("Editar hilo") : t("Nuevo hilo");
  dialogoNuevo.querySelector(".foro-nuevo-enviar").textContent = hilo ? t("Guardar") : t("Publicar");

  const select = dialogoNuevo.querySelector(".foro-nuevo-categoria");
  select.innerHTML = foro.CATEGORIAS.map((id) => `<option value="${id}">${escaparHTML(nombreCategoria(id))}</option>`).join("");
  select.value = hilo ? hilo.categoria : filtroTipo || "busco";

  dialogoNuevo.querySelector(".foro-nuevo-titulo").value = hilo ? hilo.titulo : "";
  dialogoNuevo.querySelector(".foro-nuevo-texto").value = hilo ? hilo.texto : "";
  dialogoNuevo.querySelector(".foro-nuevo-juego").innerHTML = plantillaCampoJuego(hilo || {});
  dialogoNuevo.querySelector(".foro-nuevo-tipo").value = hilo ? hilo.tipo : "";
  dialogoNuevo.querySelector(".foro-nuevo-huecos").value = hilo && hilo.huecos ? hilo.huecos : "";
  dialogoNuevo.querySelector(".foro-nuevo-error").textContent = "";

  // Hacerlo «principal»: solo un moderador, al crearlo o al editarlo
  const principal = dialogoNuevo.querySelector(".foro-nuevo-principal");
  principal.hidden = !esModerador;
  principal.querySelector("input").checked = Boolean(hilo && hilo.fijado);
  actualizarCamposDeBusco();

  dialogoNuevo.showModal();
  dialogoNuevo.querySelector(".foro-nuevo-titulo").focus();
}

async function enviarNuevo() {
  const error = dialogoNuevo.querySelector(".foro-nuevo-error");
  const boton = dialogoNuevo.querySelector(".foro-nuevo-enviar");
  const categoriaElegida = dialogoNuevo.querySelector(".foro-nuevo-categoria").value;
  const titulo = foro.limpiarTexto(dialogoNuevo.querySelector(".foro-nuevo-titulo").value);
  const texto = foro.limpiarTexto(dialogoNuevo.querySelector(".foro-nuevo-texto").value);

  if (titulo.length < 3) {
    error.textContent = t("Ponle un título al hilo (3 letras como mínimo).");
    return;
  }
  const espera = foro.segundosDeEspera();
  if (!editando && espera > 0) {
    error.textContent = t("Espera {n} s antes de publicar otra vez.", { n: espera });
    return;
  }

  const datos = {
    categoria: categoriaElegida,
    titulo,
    texto,
    juego: "",
    juegoOtro: "",
    tipo: "",
    huecos: 0,
    fijado: esModerador && dialogoNuevo.querySelector(".foro-nuevo-principal input").checked
  };
  if (categoriaElegida === "busco") {
    Object.assign(datos, leerCampoJuego(dialogoNuevo.querySelector(".campo-juego")));
    datos.tipo = dialogoNuevo.querySelector(".foro-nuevo-tipo").value.trim();
    datos.huecos = Math.min(20, Math.max(0, Math.floor(Number(dialogoNuevo.querySelector(".foro-nuevo-huecos").value) || 0)));
  }

  boton.disabled = true;
  error.textContent = "";
  try {
    if (editando) {
      // Quien no es moderador no toca «fijado» (las reglas se lo rechazarían)
      if (!esModerador) delete datos.fijado;
      await foro.editarHilo(editando, datos);
      dialogoNuevo.close();
      await recargar();
      // El hilo abierto (si lo estaba) se actualiza solo: está escuchado
    } else {
      const id = await foro.crearHilo(datos);
      dialogoNuevo.close();
      vista = "foro";
      await recargar();
      abrirHilo(id);
    }
  } catch (fallo) {
    console.error(fallo);
    error.textContent = foro.explicarFallo(fallo, silencio);
  } finally {
    boton.disabled = false;
  }
}

// ---------- Un hilo abierto ----------
//
// El panel de la derecha no se mueve con la página: arriba el título y sus botones (Avisos y
// «⋯»), en medio lo que se desplaza (el mensaje del hilo y las respuestas) y abajo, siempre a la
// vista, la caja de escribir.
//
// Las respuestas van en ramas de un solo nivel: cada respuesta al hilo empieza una rama y lo que
// se le contesta cuelga de ella (si se contesta a una respuesta de la rama, se queda en la misma
// rama con «↩ a Fulano»). Las ramas largas se pliegan. Un hilo principal (fijado), que acumula
// muchos mensajes, enseña las ramas de la más nueva a la más vieja, de 40 en 40.
//
// En los hilos de «Busco compañeros», el mensaje del hilo lleva el grupo (el autor, los que ha
// aceptado y los huecos que faltan) y las solicitudes: quien quiere jugar pide unirse y el autor
// acepta o rechaza (js/comun/foro.js).

let panelHilo = null;
let hiloAbierto = null;            // el hilo del panel, ya cargado
let idAbierto = null;              // su id (desde que se pulsa, aunque aún no haya cargado)
let comentariosAbiertos = [];
let comentariosCargados = false;   // ya ha llegado la primera tanda de comentarios
let recienteActual = null;         // true si se están viendo del más nuevo al más viejo (hilo principal)
let limiteComentarios = COMENTARIOS_POR_PAGINA;
let hayMasComentarios = false;
let solicitudes = [];              // las del hilo abierto (si es de «Busco compañeros»)
let respondiendo = null;           // { id, uid, rama, nombre, texto }: el mensaje al que se contesta
let ramaPorVer = null;             // tras responder en una rama, se baja hasta ella
const ramasAbiertas = new Set();   // las ramas largas que se han desplegado
let pararHilo = null;
let pararComentarios = null;
let pararSolicitudes = null;
let aperturas = 0;   // cuenta cada vez que se abre un hilo: lo que llega tarde de uno anterior se tira

const RAMA_PLEGADA = 3;   // con más respuestas que esto, la rama se pliega y enseña las 2 últimas

function pararEscuchas() {
  if (pararHilo) pararHilo();
  if (pararComentarios) pararComentarios();
  if (pararSolicitudes) pararSolicitudes();
  pararHilo = pararComentarios = pararSolicitudes = null;
}

function puedoBorrarComentario(comentario) {
  return esModerador || comentario.uid === miUid() || (hiloAbierto && hiloAbierto.uid === miUid());
}

function puedoEscribir() {
  const hilo = hiloAbierto;
  if (!hilo || silencio) return false;
  return !hilo.cerrado || hilo.uid === miUid() || esModerador;
}

// ---------- Cabecera ----------

function pintarCabeceraHilo() {
  const hilo = hiloAbierto;
  const silenciado = hiloSilenciado(hilo.id);
  panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `
    <div class="foro-hilo-titulo-fila">
      <h2>${escaparHTML(hilo.titulo)}</h2>
      <div class="foro-hilo-acciones">
        <button data-accion="avisos" class="foro-avisos ${silenciado ? "silenciado" : ""}" aria-pressed="${silenciado}"
                title="${silenciado ? t("No te avisa de este hilo. Pulsa para volver a recibir avisos.") : t("Te avisa en la campana. Pulsa para silenciar este hilo.")}">
          ${icono(silenciado ? "campanaTachada" : "campana")}<span>${silenciado ? t("Silenciado") : t("Avisos")}</span>
        </button>
        <button data-accion="opciones-hilo" class="foro-mas-opciones" aria-label="${t("Más opciones")}" title="${t("Más opciones")}">${icono("puntos")}</button>
      </div>
    </div>
    <div class="hilo-chips">${chipsDeHilo(hilo).join("")}<span class="foro-hilo-cuenta">${textoRespuestas(hilo.respuestas)}</span></div>
    ${silenciado ? `<p class="foro-hilo-silenciado">${t("Hilo silenciado: no te llegarán avisos de él (ni respuestas ni solicitudes).")}</p>` : ""}`;
}

// Lo que va en el «⋯» del hilo
function opcionesDelHilo() {
  const hilo = hiloAbierto;
  const mio = hilo.uid === miUid();
  const opciones = [];
  if (mio) {
    opciones.push({ accion: "editar", icono: "lapiz", texto: t("Editar el hilo") });
    opciones.push({
      accion: "cerrar",
      icono: hilo.cerrado ? "reanudar" : "candado",
      texto: hilo.cerrado ? t("Volver a abrirlo") : hilo.categoria === "busco" ? t("Ya tengo gente: cerrarlo") : t("Cerrar el hilo")
    });
  } else {
    opciones.push({ accion: "perfil", icono: "persona", texto: t("Ver el perfil de {nombre}", { nombre: perfilDe(hilo.uid).nombre || t("Jugador") }), uid: hilo.uid });
    opciones.push({ accion: "denunciar-hilo", icono: "bandera", texto: t("Denunciar el hilo") });
  }
  if (esModerador) opciones.push({ accion: "fijar", icono: "chincheta", texto: hilo.fijado ? t("Quitar de principales") : t("Hacer principal") });
  if (mio || esModerador) opciones.push({ accion: "borrar-hilo", icono: "papelera", texto: t("Borrar el hilo"), peligro: true });
  return opciones;
}

// ---------- El mensaje del hilo, con el grupo ----------

function plantillaGrupoDelHilo(hilo) {
  const mio = hilo.uid === miUid();
  const faltan = foro.faltanEnGrupo(hilo);
  const miembros = [hilo.uid, ...hilo.grupo];
  const fotos = miembros.map((uid) => `
    <span class="foro-grupo-miembro">
      ${foto(uid)}
      ${mio && uid !== hilo.uid ? `<button class="foro-grupo-quitar" data-accion="quitar-grupo" data-uid="${escaparHTML(uid)}" title="${t("Quitar del grupo")}" aria-label="${t("Quitar del grupo")}">${icono("aspa")}</button>` : ""}
    </span>`).join("");
  const huecos = Array.from({ length: Math.min(faltan, 12) }, () => `<span class="foro-hueco" aria-hidden="true">${icono("mas")}</span>`).join("");
  const estado = hilo.huecos
    ? faltan ? t(faltan === 1 ? "Falta 1" : "Faltan {n}", { n: faltan }) : t("¡Grupo completo!")
    : t(miembros.length === 1 ? "{n} persona" : "{n} personas", { n: miembros.length });

  const pendientes = solicitudes.filter((cada) => cada.estado === "pendiente");
  const mia = solicitudes.find((cada) => cada.uid === miUid());
  let parteDeAbajo = "";

  if (mio) {
    parteDeAbajo = pendientes.length
      ? `<div class="foro-candidatos">
          <span class="foro-grupo-etiqueta">${t("Quieren unirse")}</span>
          ${pendientes.map((cada) => plantillaCandidato(cada, hilo.huecos && !faltan)).join("")}
        </div>`
      : `<p class="foro-grupo-nota">${hilo.cerrado ? t("El grupo está cerrado: ya no se puede pedir plaza.") : t("Nadie ha pedido unirse todavía. Te avisaremos en la campana.")}</p>`;
  } else if (hilo.grupo.includes(miUid())) {
    parteDeAbajo = `<p class="foro-grupo-nota bien">${icono("visto")} ${t("Estás en el grupo.")}</p>`;
  } else if (mia && mia.estado === "pendiente") {
    parteDeAbajo = `
      <div class="foro-mi-solicitud">
        <span><b>${t("Has pedido unirte")}</b><small>${t("{nombre} decide quién entra.", { nombre: escaparHTML(perfilDe(hilo.uid).nombre || t("Jugador")) })}</small></span>
        <button data-accion="retirar">${t("Retirar")}</button>
      </div>`;
  } else if (mia && mia.estado === "rechazada") {
    parteDeAbajo = `<p class="foro-grupo-nota">${t("Esta vez no ha podido ser: el grupo ya estaba hecho.")}</p>`;
  } else if (hilo.cerrado) {
    parteDeAbajo = `<p class="foro-grupo-nota">${t("El grupo está cerrado.")}</p>`;
  } else if (!silencio) {
    parteDeAbajo = `<button class="foro-pedir" data-accion="pedir">${icono("personaMas")}${t("Pedir unirme")}</button>`;
  }

  return `
    <div class="foro-grupo">
      <div class="foro-grupo-fila">
        <span class="foro-grupo-etiqueta">${t("El grupo")}</span>
        <span class="foro-grupo-fotos">${fotos}${huecos}</span>
        <span class="foro-grupo-estado">${estado}</span>
      </div>
      ${parteDeAbajo}
    </div>`;
}

function plantillaCandidato(solicitud, lleno) {
  const perfil = perfilDe(solicitud.uid);
  const jugados = lockesJugados(perfil).length;
  const ganados = (perfil.ganados || []).length;
  return `
    <div class="foro-candidato">
      ${foto(solicitud.uid)}
      <span class="foro-candidato-datos">
        <span class="foro-candidato-nombre">
          <button class="foro-nombre" data-autor="${escaparHTML(solicitud.uid)}">${nombreDe(solicitud.uid)}</button>
          <small>${t(jugados === 1 ? "{n} locke" : "{n} lockes", { n: jugados })} · ${t(ganados === 1 ? "{n} ganado" : "{n} ganados", { n: ganados })}</small>
        </span>
        ${solicitud.mensaje ? `<span class="foro-candidato-mensaje">«${escaparHTML(solicitud.mensaje)}»</span>` : ""}
      </span>
      <span class="foro-candidato-botones">
        <button data-accion="rechazar" data-uid="${escaparHTML(solicitud.uid)}">${t("Rechazar")}</button>
        <button data-accion="aceptar" data-uid="${escaparHTML(solicitud.uid)}" class="principal" ${lleno ? "disabled" : ""}>${t("Aceptar")}</button>
      </span>
    </div>`;
}

function pintarOriginal() {
  const hilo = hiloAbierto;
  panelHilo.querySelector(".foro-hilo-original").innerHTML = `
    <article class="foro-original cat-${hilo.categoria}">
      <span class="foro-original-etiqueta">${icono("chincheta")}${t("Mensaje del hilo")}</span>
      <div class="comentario-cabecera">
        ${fichaAutor(hilo.uid, `<span class="comentario-op">${t("Autor")}</span>`)}
        <span class="comentario-hace">${hace(hilo.creado)}</span>
      </div>
      ${hilo.texto ? `<p class="foro-hilo-texto">${escaparHTML(hilo.texto)}</p>` : ""}
      ${hilo.categoria === "busco" ? plantillaGrupoDelHilo(hilo) : ""}
    </article>
    <div class="foro-separador"><span>${hilo.respuestas ? textoRespuestas(hilo.respuestas) : t("Respuestas")}</span></div>`;
}

// ---------- Las ramas ----------

// [{ raiz, hijos }] en el orden de la pantalla. Lo que cuelga de un mensaje que ya no está (borrado,
// o fuera de los que se han pedido) sale suelto, como una rama más.
function ramas() {
  const porId = new Map(comentariosAbiertos.map((comentario) => [comentario.id, comentario]));
  const hijos = new Map();
  const raices = [];
  for (const comentario of comentariosAbiertos) {
    const rama = comentario.rama && comentario.rama !== comentario.id && porId.has(comentario.rama) ? comentario.rama : "";
    if (!rama) raices.push(comentario);
    else {
      if (!hijos.has(rama)) hijos.set(rama, []);
      hijos.get(rama).push(comentario);
    }
  }
  const orden = (a, b) => a.creado - b.creado;
  raices.sort(recienteActual ? (a, b) => orden(b, a) : orden);
  return raices.map((raiz) => ({ raiz, hijos: (hijos.get(raiz.id) || []).sort(orden) }));
}

function plantillaMensaje(comentario, enRama) {
  const mio = comentario.uid === miUid();
  const paraTi = !mio && comentario.respondeA && comentario.respondeA.uid === miUid();
  const respondido = comentario.respondeA && comentario.respondeA.id !== comentario.rama ? comentario.respondeA.uid : "";
  return `
    <article class="comentario ${enRama ? "hijo" : ""} ${paraTi ? "para-ti" : ""} ${mio ? "mio" : ""}" data-comentario="${escaparHTML(comentario.id)}">
      <div class="comentario-cabecera">
        ${fichaAutor(comentario.uid, comentario.uid === hiloAbierto.uid ? `<span class="comentario-op">${t("Autor")}</span>` : "")}
        ${respondido ? `<span class="comentario-a">${icono("deshacer")}${t("a {nombre}", { nombre: nombreDe(respondido) })}</span>` : ""}
        <span class="comentario-hace">${hace(comentario.creado)}</span>
        <span class="comentario-acciones">
          ${puedoEscribir() ? `<button class="comentario-responder" data-accion="responder" data-comentario="${escaparHTML(comentario.id)}">${icono("deshacer")}<span>${t("Responder")}</span></button>` : ""}
          <button class="comentario-mas" data-accion="opciones-comentario" data-comentario="${escaparHTML(comentario.id)}" aria-label="${t("Más opciones")}" title="${t("Más opciones")}">${icono("puntos")}</button>
        </span>
      </div>
      <p class="comentario-texto">${escaparHTML(comentario.texto)}</p>
    </article>`;
}

function plantillaRama({ raiz, hijos }) {
  const plegada = hijos.length > RAMA_PLEGADA && !ramasAbiertas.has(raiz.id);
  const vistos = plegada ? hijos.slice(-2) : hijos;
  const ocultos = hijos.length - vistos.length;
  return `
    <div class="foro-rama" data-rama="${escaparHTML(raiz.id)}">
      ${plantillaMensaje(raiz, false)}
      ${hijos.length
        ? `<div class="foro-rama-hijos">
            ${ocultos ? `<button class="foro-rama-mas" data-accion="abrir-rama" data-rama="${escaparHTML(raiz.id)}">${icono("abajo")}${t(ocultos === 1 ? "Ver 1 respuesta más" : "Ver {n} respuestas más", { n: ocultos })}</button>` : ""}
            ${vistos.map((hijo) => plantillaMensaje(hijo, true)).join("")}
          </div>`
        : ""}
    </div>`;
}

function pintarComentarios(alFinal) {
  const desliza = panelHilo.querySelector(".foro-hilo-desliza");
  const caja = panelHilo.querySelector(".foro-hilo-comentarios");
  const abajo = desliza.scrollHeight - desliza.scrollTop - desliza.clientHeight < 40;

  caja.innerHTML = comentariosAbiertos.length
    ? ramas().map(plantillaRama).join("")
    : `<p class="foro-vacio">${t("Todavía nadie ha respondido.")}</p>`;

  if (ramaPorVer) {
    const rama = caja.querySelector(`[data-rama="${CSS.escape(ramaPorVer)}"]`);
    if (rama) {
      const ultimo = rama.querySelector(".comentario:last-of-type") || rama;
      ultimo.scrollIntoView({ block: "nearest" });
      ramaPorVer = null;
    }
  } else if (!recienteActual && (alFinal || abajo)) {
    // En un hilo normal lo último está abajo y se baja hasta ello
    desliza.scrollTop = desliza.scrollHeight;
  }
  panelHilo.querySelector(".foro-hilo-mas").hidden = !hayMasComentarios;
}

// ---------- Responder ----------

function pintarRespondiendo() {
  const caja = panelHilo.querySelector(".foro-hilo-respondiendo");
  const campo = panelHilo.querySelector(".foro-hilo-responder textarea");
  caja.hidden = !respondiendo;
  caja.innerHTML = respondiendo
    ? `${icono("deshacer")}
       <b>${t("Respondiendo a {nombre}", { nombre: escaparHTML(respondiendo.nombre) })}</b>
       <span>«${escaparHTML(respondiendo.texto)}»</span>
       <button data-accion="no-responder" aria-label="${t("No responder a nadie en concreto")}" title="${t("No responder a nadie en concreto")}">${icono("aspa")}</button>`
    : "";
  campo.placeholder = respondiendo
    ? t("Responde a {nombre}... (Ctrl + Intro para enviar)", { nombre: respondiendo.nombre })
    : t("Escribe una respuesta para todo el hilo... (Ctrl + Intro para enviar)");
}

function responderA(idComentario) {
  const comentario = comentariosAbiertos.find((cada) => cada.id === idComentario);
  if (!comentario) return;
  const rama = comentario.rama && comentariosAbiertos.some((cada) => cada.id === comentario.rama) ? comentario.rama : comentario.id;
  respondiendo = { id: comentario.id, uid: comentario.uid, rama, nombre: perfilDe(comentario.uid).nombre || t("Jugador"), texto: comentario.texto };
  pintarRespondiendo();
  panelHilo.querySelector(".foro-hilo-responder textarea").focus();
}

// El formulario de responder no se repinta con cada cambio (se perdería lo que se está
// escribiendo): solo se enciende, se apaga o cambia de texto según el estado del hilo
function actualizarFormularioRespuesta() {
  const formulario = panelHilo.querySelector(".foro-hilo-responder");
  const campo = formulario.querySelector("textarea");
  const nota = panelHilo.querySelector(".foro-hilo-nota");
  const hilo = hiloAbierto;

  let motivo = "";
  if (silencio) motivo = t("Un moderador te ha silenciado: no puedes escribir en el foro.");
  else if (!puedoEscribir()) motivo = hilo.categoria === "busco" ? t("Este hilo ya está completo.") : t("Este hilo está cerrado.");

  formulario.hidden = Boolean(motivo);
  nota.hidden = !motivo;
  nota.textContent = motivo;
  campo.disabled = Boolean(motivo);
  if (motivo && respondiendo) {
    respondiendo = null;
    pintarRespondiendo();
  }
}

// ---------- Abrir y cerrar ----------

async function abrirHilo(id) {
  const apertura = ++aperturas;
  pararEscuchas();
  cerrarOpciones();
  hiloAbierto = null;
  comentariosAbiertos = [];
  comentariosCargados = false;
  hayMasComentarios = false;
  recienteActual = null;
  limiteComentarios = COMENTARIOS_POR_PAGINA;
  solicitudes = [];
  respondiendo = null;
  ramaPorVer = null;
  ramasAbiertas.clear();

  panelHilo.classList.remove("reciente");
  panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `<p class="foro-vacio">${t("Cargando...")}</p>`;
  panelHilo.querySelector(".foro-hilo-original").innerHTML = "";
  panelHilo.querySelector(".foro-hilo-comentarios").innerHTML = "";
  panelHilo.querySelector(".foro-hilo-mas").hidden = true;
  panelHilo.querySelector(".foro-hilo-responder").hidden = true;
  panelHilo.querySelector(".foro-hilo-nota").hidden = true;
  panelHilo.querySelector(".foro-hilo-responder textarea").value = "";
  panelHilo.querySelector(".foro-hilo-error").textContent = "";
  pintarRespondiendo();
  idAbierto = id;
  mostrarPanel(true);
  marcarSeleccion();

  pararHilo = foro.escucharHilo(
    id,
    async (hilo) => {
      if (apertura !== aperturas) return;
      if (!hilo) {
        // Lo han borrado mientras se miraba (o ya no estaba)
        cerrarPanel();
        olvidarHilo(id);
        pintarLista();
        avisar(t("Ese hilo ya no existe."));
        return;
      }
      await traerPerfiles([hilo.uid, ...hilo.grupo]);
      if (apertura !== aperturas) return;
      const antes = hiloAbierto;
      hiloAbierto = hilo;
      // Mirándolo, lo suyo deja de ser nuevo para la campana (en tus hilos, también tus respuestas)
      marcarHiloVisto(hilo.id, hilo.uid === miUid() ? hilo.respuestas : undefined);
      pintarCabeceraHilo();
      pintarOriginal();
      actualizarFormularioRespuesta();

      // Las solicitudes, solo en «Busco compañeros» (se empiezan a escuchar una vez)
      if (hilo.categoria === "busco" && !pararSolicitudes) escucharLasSolicitudes(id, apertura);

      // La primera vez (o si lo hacen principal o dejan de serlo con el hilo abierto) se elige cómo
      // se leen los comentarios y se empieza a escucharlos
      if (hilo.fijado !== recienteActual) {
        recienteActual = hilo.fijado;
        limiteComentarios = COMENTARIOS_POR_PAGINA;
        comentariosCargados = false;
        panelHilo.classList.toggle("reciente", recienteActual);
        suscribirComentarios(id, apertura);
      } else if (comentariosCargados && (!antes || antes.cerrado !== hilo.cerrado)) {
        pintarComentarios(false); // los botones de «Responder» dependen de si está cerrado
      }
    },
    (error) => {
      console.error(error);
      if (apertura === aperturas) panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `<p class="foro-vacio">${t("No se ha podido cargar el hilo.")}</p>`;
    }
  );
}

function escucharLasSolicitudes(id, apertura) {
  pararSolicitudes = foro.escucharSolicitudes(
    id,
    async (lista) => {
      if (apertura !== aperturas) return;
      await traerPerfiles(lista.map((cada) => cada.uid));
      if (apertura !== aperturas || !hiloAbierto) return;
      solicitudes = lista;
      if (hiloAbierto.uid === miUid()) marcarHiloVisto(id, hiloAbierto.respuestas);
      pintarOriginal();
    },
    (error) => console.warn("No se han podido leer las solicitudes del hilo", error)
  );
}

// Para abrir un hilo desde fuera del foro (los avisos de la campana)
export function abrirHiloDe(id) {
  return abrirHilo(id);
}

// Escucha los comentarios del hilo: los primeros 300 si es normal, los últimos
// «limiteComentarios» (de más nuevo a más viejo) si es principal
function suscribirComentarios(id, apertura) {
  if (pararComentarios) pararComentarios();
  pararComentarios = foro.escucharComentarios(
    id,
    async (comentarios, hayMas) => {
      if (apertura !== aperturas) return;
      await traerPerfiles(comentarios.flatMap((comentario) => [comentario.uid, comentario.respondeA ? comentario.respondeA.uid : ""]));
      if (apertura !== aperturas) return;
      const primera = !comentariosCargados;
      comentariosAbiertos = comentarios;
      comentariosCargados = true;
      hayMasComentarios = Boolean(recienteActual) && hayMas;
      // Lo que te respondan con el hilo abierto ya lo estás viendo
      marcarHiloVisto(id, hiloAbierto && hiloAbierto.uid === miUid() ? hiloAbierto.respuestas : undefined);
      if (hiloAbierto) pintarComentarios(primera);
    },
    (error) => {
      console.error(error);
      // Que no parezca un hilo sin respuestas
      if (apertura === aperturas) {
        panelHilo.querySelector(".foro-hilo-comentarios").innerHTML = `<p class="foro-vacio">${t("No se han podido cargar las respuestas.")}</p>`;
      }
    },
    { recientesPrimero: Boolean(recienteActual), limite: recienteActual ? limiteComentarios : 300 }
  );
}

// «Ver comentarios anteriores»: se piden más, y se vuelve a escuchar con el límite nuevo
function verComentariosAnteriores() {
  if (!hiloAbierto) return;
  limiteComentarios += COMENTARIOS_POR_PAGINA;
  suscribirComentarios(hiloAbierto.id, aperturas);
}

// El panel de la derecha: el hilo abierto o, si no hay, «Elige un hilo». En pantallas estrechas el
// panel abierto ocupa toda la pantalla (ver foro.css) y se cierra con la flecha.
// Con un fundido: el hilo entra deslizándose un poco (también al pasar de un hilo a otro) y,
// al cerrarlo, se desvanece antes de que vuelva el aviso de la derecha
let cambioDePanel = 0;
let animacionCierre = null;

// En pantallas estrechas el hilo abierto tapa la lista: «Atrás» (o el gesto de volver del móvil) lo
// cierra y vuelve a la lista, en vez de irse de la sección (js/comun/atras.js)
const capaHilo = {
  abierta: () => seccion.querySelector(".foro-panel").classList.contains("abierto"),
  cerrar: () => {
    cerrarHilo();
    return true;
  }
};

function mostrarPanel(abierto) {
  const vacio = seccion.querySelector(".foro-panel-vacio");
  const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cambio = ++cambioDePanel;
  const aparecer = (elemento, desde) =>
    suave && elemento.animate([{ opacity: 0, transform: desde }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });

  if (animacionCierre) animacionCierre.cancel();
  animacionCierre = null;

  if (abierto) {
    seccion.querySelector(".foro-panel").classList.add("abierto");
    document.documentElement.classList.add("foro-hilo-en-pantalla");
    if (matchMedia("(max-width: 1000px)").matches) abrirCapa(capaHilo);
    vacio.hidden = true;
    panelHilo.hidden = false;
    panelHilo.querySelector(".foro-hilo-desliza").scrollTop = 0;
    aparecer(panelHilo, "translateX(0.75rem)");
    return;
  }

  cerrarCapa(capaHilo);
  const cerrar = () => {
    if (cambio !== cambioDePanel) return; // mientras se cerraba, se ha abierto otro
    seccion.querySelector(".foro-panel").classList.remove("abierto");
    document.documentElement.classList.remove("foro-hilo-en-pantalla");
    panelHilo.hidden = true;
    vacio.hidden = false;
    aparecer(vacio, "none");
  };
  if (suave && !panelHilo.hidden) {
    // Se queda transparente al acabar (fill) hasta que se esconde: así no parpadea
    const animacion = panelHilo.animate([{ opacity: 1 }, { opacity: 0, transform: "translateX(0.75rem)" }], { duration: 150, easing: "ease-in", fill: "forwards" });
    animacionCierre = animacion;
    animacion.onfinish = () => {
      cerrar();
      animacion.cancel();
      if (animacionCierre === animacion) animacionCierre = null;
    };
  } else {
    cerrar();
  }
}

// Salta a la fila de otro hilo con el teclado. La fila se marca al momento, pero el hilo se abre
// cuando se deja de pulsar un instante: así, bajando deprisa por la lista no se pide cada uno.
let esperaAbrir = null;

function irAHilo(fila) {
  fila.focus();
  fila.scrollIntoView({ block: "nearest" });
  idAbierto = fila.dataset.hilo;
  marcarSeleccion();
  clearTimeout(esperaAbrir);
  esperaAbrir = setTimeout(() => abrirHilo(fila.dataset.hilo), 180);
}

// Resalta en la lista el hilo que está abierto
function marcarSeleccion() {
  for (const fila of lista.querySelectorAll("[data-hilo]")) {
    fila.classList.toggle("seleccionado", fila.dataset.hilo === idAbierto);
  }
}

// Deja de escuchar el hilo y vuelve a enseñar «Elige un hilo»
function cerrarPanel() {
  aperturas++;
  pararEscuchas();
  cerrarOpciones();
  hiloAbierto = null;
  idAbierto = null;
  respondiendo = null;
  mostrarPanel(false);
  marcarSeleccion();
}

function cerrarHilo() {
  cerrarPanel();
  // La lista se pone al día con lo que haya cambiado (respuestas, cerrado...)
  if (!cargando && Date.now() - cargadoEn > 5000) recargar();
}

async function responder() {
  const campo = panelHilo.querySelector(".foro-hilo-responder textarea");
  const error = panelHilo.querySelector(".foro-hilo-error");
  const boton = panelHilo.querySelector(".foro-hilo-enviar");
  const texto = foro.limpiarTexto(campo.value);
  if (!texto || !hiloAbierto) return;

  const espera = foro.segundosDeEspera();
  if (espera > 0) {
    error.textContent = t("Espera {n} s antes de publicar otra vez.", { n: espera });
    return;
  }

  boton.disabled = true;
  error.textContent = "";
  const respuesta = respondiendo;
  try {
    await foro.comentar(hiloAbierto.id, texto, respuesta ? { id: respuesta.id, uid: respuesta.uid, rama: respuesta.rama } : null);
    campo.value = "";
    respondiendo = null;
    pintarRespondiendo();
    if (respuesta) {
      ramasAbiertas.add(respuesta.rama);
      ramaPorVer = respuesta.rama;
    }
    pintarComentarios(!respuesta);
  } catch (fallo) {
    console.error(fallo);
    error.textContent = foro.explicarFallo(fallo, silencio);
  } finally {
    boton.disabled = false;
  }
}

// ---------- El menú «⋯» (del hilo o de un mensaje) ----------
//
// Uno solo, flotando junto al botón que lo abre (en el móvil, como una hoja que sube desde abajo).

let menuOpciones = null;

function cerrarOpciones() {
  if (menuOpciones) menuOpciones.remove();
  menuOpciones = null;
}

function abrirOpciones(boton, opciones) {
  const mismo = menuOpciones && menuOpciones.dataset.de === boton.dataset.accion + (boton.dataset.comentario || "");
  cerrarOpciones();
  if (mismo || !opciones.length) return;
  menuOpciones = document.createElement("div");
  menuOpciones.className = "foro-opciones";
  menuOpciones.dataset.de = boton.dataset.accion + (boton.dataset.comentario || "");
  menuOpciones.setAttribute("role", "menu");
  menuOpciones.innerHTML = opciones
    .map((opcion) => `
      <button role="menuitem" data-accion="${opcion.accion}" ${opcion.comentario ? `data-comentario="${escaparHTML(opcion.comentario)}"` : ""}
              ${opcion.uid ? `data-uid="${escaparHTML(opcion.uid)}"` : ""} class="${opcion.peligro ? "peligro" : ""}">
        ${icono(opcion.icono)}<span>${opcion.texto}</span>
      </button>`)
    .join("");
  document.body.append(menuOpciones);
  if (matchMedia("(max-width: 760px)").matches) {
    menuOpciones.classList.add("hoja");
  } else {
    const caja = boton.getBoundingClientRect();
    const ancho = menuOpciones.offsetWidth;
    const alto = menuOpciones.offsetHeight;
    const arriba = caja.bottom + 6 + alto > innerHeight ? caja.top - 6 - alto : caja.bottom + 6;
    menuOpciones.style.top = `${Math.max(8, arriba)}px`;
    menuOpciones.style.left = `${Math.max(8, Math.min(innerWidth - ancho - 8, caja.right - ancho))}px`;
  }
  menuOpciones.querySelector("button").focus();
  menuOpciones.addEventListener("click", (e) => {
    const opcion = e.target.closest("[data-accion]");
    if (!opcion) return;
    cerrarOpciones();
    if (opcion.dataset.accion === "perfil") abrirUsuario(opcion.dataset.uid);
    else accionDeHilo({ target: opcion });
  });
}

function opcionesDelComentario(comentario) {
  const opciones = [{ accion: "perfil", icono: "persona", texto: t("Ver el perfil de {nombre}", { nombre: perfilDe(comentario.uid).nombre || t("Jugador") }), uid: comentario.uid }];
  if (comentario.uid !== miUid()) opciones.push({ accion: "denunciar-comentario", icono: "bandera", texto: t("Denunciar"), comentario: comentario.id });
  if (puedoBorrarComentario(comentario)) opciones.push({ accion: "borrar-comentario", icono: "papelera", texto: t("Borrar"), comentario: comentario.id, peligro: true });
  return opciones;
}

async function accionDeHilo(e) {
  const boton = e.target.closest("[data-accion]");
  if (!boton || !hiloAbierto) return;
  const hilo = hiloAbierto;
  const accion = boton.dataset.accion;

  try {
    if (accion === "opciones-hilo") {
      abrirOpciones(boton, opcionesDelHilo());
    } else if (accion === "opciones-comentario") {
      const comentario = comentariosAbiertos.find((cada) => cada.id === boton.dataset.comentario);
      if (comentario) abrirOpciones(boton, opcionesDelComentario(comentario));
    } else if (accion === "responder") {
      responderA(boton.dataset.comentario);
    } else if (accion === "no-responder") {
      respondiendo = null;
      pintarRespondiendo();
    } else if (accion === "abrir-rama") {
      ramasAbiertas.add(boton.dataset.rama);
      pintarComentarios(false);
    } else if (accion === "avisos") {
      boton.disabled = true;
      await silenciarHilo(hilo.id, !hiloSilenciado(hilo.id));
      pintarCabeceraHilo();
      pintarLista();
    } else if (accion === "pedir") {
      const mensaje = await preguntar(t("¿Quieres contarle algo a {nombre}? Por ejemplo, cuándo puedes jugar (opcional).", { nombre: perfilDe(hilo.uid).nombre || t("Jugador") }), "");
      if (mensaje === null) return;
      await foro.pedirUnirme(hilo.id, mensaje);
    } else if (accion === "retirar") {
      await foro.retirarSolicitud(hilo.id);
    } else if (accion === "aceptar" || accion === "rechazar") {
      boton.disabled = true;
      await foro.responderSolicitud(hilo, boton.dataset.uid, accion === "aceptar");
    } else if (accion === "quitar-grupo") {
      const nombre = perfilDe(boton.dataset.uid).nombre || t("Jugador");
      if (!(await confirmar(t("¿Quitar a {nombre} del grupo? Su hueco vuelve a quedar libre.", { nombre }), { aceptar: t("Quitar") }))) return;
      await foro.quitarDelGrupo(hilo, boton.dataset.uid);
    } else if (accion === "editar") {
      abrirNuevo(hilo);
    } else if (accion === "cerrar") {
      await foro.cerrarHilo(hilo, !hilo.cerrado);
    } else if (accion === "fijar") {
      await foro.fijarHilo(hilo.id, !hilo.fijado);
      await recargar();
    } else if (accion === "denunciar-hilo") {
      abrirDenuncia({ tipo: "hilo", hilo: hilo.id, autor: hilo.uid, copia: `${hilo.titulo}\n${hilo.texto}` });
    } else if (accion === "borrar-hilo") {
      if (!(await confirmar(t("¿Borrar este hilo y todos sus comentarios?"), { aceptar: t("Borrar") }))) return;
      await foro.borrarHilo(hilo.id);
      cerrarHilo();
      olvidarHilo(hilo.id);
      pintarLista();
    } else if (accion === "denunciar-comentario") {
      const comentario = comentariosAbiertos.find((cada) => cada.id === boton.dataset.comentario);
      if (comentario) abrirDenuncia({ tipo: "comentario", hilo: hilo.id, comentario: comentario.id, autor: comentario.uid, copia: comentario.texto });
    } else if (accion === "borrar-comentario") {
      if (!(await confirmar(t("¿Borrar este comentario?"), { aceptar: t("Borrar") }))) return;
      await foro.borrarComentario(hilo.id, boton.dataset.comentario);
    }
  } catch (error) {
    console.error(error);
    avisar(foro.explicarFallo(error, silencio));
  } finally {
    if (boton.isConnected) boton.disabled = false;
  }
}

// ---------- Denunciar ----------

let dialogoDenuncia = null;
let denunciando = null;

function abrirDenuncia(objetivo) {
  denunciando = objetivo;
  const que = { hilo: t("este hilo"), comentario: t("este comentario"), usuario: t("a esta persona") }[objetivo.tipo];
  dialogoDenuncia.querySelector(".foro-denuncia-que").textContent = t("Vas a denunciar {que}. Lo verá un moderador.", { que });
  dialogoDenuncia.querySelector(".foro-denuncia-motivo").innerHTML = foro.MOTIVOS
    .map((motivo) => `<option value="${motivo}">${escaparHTML(nombreMotivo(motivo))}</option>`)
    .join("");
  dialogoDenuncia.querySelector(".foro-denuncia-nota").value = "";
  dialogoDenuncia.querySelector(".foro-denuncia-error").textContent = "";
  dialogoDenuncia.showModal();
}

// Para denunciar a una persona desde fuera del foro (el chat): «copia» es lo que se enseña al
// moderador
export function denunciarPersona(uid, copia) {
  abrirDenuncia({ tipo: "usuario", autor: uid, copia });
}

async function enviarDenuncia() {
  const boton = dialogoDenuncia.querySelector(".foro-denuncia-enviar");
  const error = dialogoDenuncia.querySelector(".foro-denuncia-error");
  boton.disabled = true;
  try {
    const enviada = await foro.denunciar({
      ...denunciando,
      motivo: dialogoDenuncia.querySelector(".foro-denuncia-motivo").value,
      nota: dialogoDenuncia.querySelector(".foro-denuncia-nota").value
    });
    dialogoDenuncia.close();
    avisar(enviada ? t("Gracias. Un moderador la revisará.") : t("Ya habías denunciado esto."));
  } catch (fallo) {
    console.error(fallo);
    error.textContent = t("No se ha podido enviar la denuncia. Prueba de nuevo.");
  } finally {
    boton.disabled = false;
  }
}

// ---------- Ficha de una persona ----------

let dialogoUsuario = null;

async function abrirUsuario(uid) {
  if (!uid) return;
  await traerPerfiles([uid]);
  const perfil = perfilDe(uid);
  const yo = uid === miUid();
  const relacion = relacionCon(uid);
  const ganados = (perfil.ganados || []).length;
  const jugados = lockesJugados(perfil).length;

  const bloqueada = estaBloqueado(uid);
  const conectado = !yo && estaConectado(uid);

  // Arriba, lo que se hace con más probabilidad: ver su perfil y, según la relación, charlar o
  // pedirle amistad. Debajo, en discreto, denunciar y bloquear. Y aparte, lo de moderar.
  const principales = [`<button class="principal" data-accion="perfil">${icono("persona")}${t("Ver perfil")}</button>`];
  if (!yo && !relacion && !bloqueada) principales.push(`<button data-accion="amigo">${icono("personaMas")}${t("Añadir a amigos")}</button>`);
  if (!yo && relacion === "ok") principales.push(`<button data-accion="chat">${icono("mensaje")}${t("Chat")}</button>`);

  const discretas = [];
  if (!yo) {
    discretas.push(`<button data-accion="denunciar">${icono("bandera")}${t("Denunciar")}</button>`);
    discretas.push(bloqueada
      ? `<button data-accion="desbloquear">${icono("candado")}${t("Desbloquear")}</button>`
      : `<button data-accion="bloquear">${icono("candado")}${t("Bloquear")}</button>`);
  }

  const moderacion = [];
  if (esModerador && !yo) moderacion.push(`<button data-accion="silenciar">${icono("aviso")}<span>${t("Silenciar en el foro")}</span></button>`);
  if (esAdmin && !yo) moderacion.push(`<button data-accion="moderador" hidden>${icono("escudo")}<span></span></button>`);

  const chips = [];
  if (relacion === "ok") chips.push(`<span class="foro-usuario-chip">${icono("amigos")}${t("Amigo")}</span>`);
  else if (relacion === "pendiente") chips.push(`<span class="foro-usuario-chip">${t("Solicitud de amistad pendiente")}</span>`);
  if (perfil.busca) chips.push(`<span class="foro-usuario-chip busca">${icono("persona")}${t("Busca compañeros")}</span>`);

  const sobreMi = (perfil.sobreMi || "").trim();
  const horario = (perfil.horario || "").trim();

  dialogoUsuario.dataset.uid = uid;
  dialogoUsuario.querySelector(".foro-usuario-cuerpo").innerHTML = `
    <header class="foro-usuario-cabecera ${conectado ? "conectado" : yo ? "mia" : ""} ${fondoVisual(perfil).clase}" style="${fondoVisual(perfil).estilo}">
      ${foto(uid)}
      <div class="foro-usuario-datos">
        ${yo
          ? `<span class="jugador-estado">${t("Tú")}</span>`
          : conectado
            ? `<span class="jugador-estado"><span class="punto-conectado"></span>${t("Conectado")}</span>`
            : ""}
        <div class="foro-usuario-nombre"><h2>${nombreDe(uid)}</h2>${plantillaTituloDe(perfil, "pequeno")}${insigniaModerador(uid)}</div>
        <span class="foro-usuario-ganados">
          ${t(jugados === 1 ? "{n} locke jugado" : "{n} lockes jugados", { n: jugados })}
          <span class="foro-usuario-de-ellos">${icono("corona")}${t(ganados === 1 ? "{n} ganado" : "{n} ganados", { n: ganados })}</span>
        </span>
        ${chips.length ? `<div class="foro-usuario-chips">${chips.join("")}</div>` : ""}
      </div>
    </header>
    ${sobreMi || horario
      ? `<div class="foro-usuario-sobre">
          ${sobreMi ? `<p>${escaparHTML(sobreMi)}</p>` : ""}
          ${horario ? `<small><strong>${t("Horario")}:</strong> ${escaparHTML(horario)}</small>` : ""}
        </div>`
      : ""}
    <div class="foro-usuario-principales">${principales.join("")}</div>
    ${discretas.length ? `<div class="foro-usuario-discretas">${discretas.join("")}</div>` : ""}
    ${moderacion.length ? `<div class="foro-usuario-moderacion"><span>${t("Moderación")}</span>${moderacion.join("")}</div>` : ""}
    <p class="foro-usuario-error"></p>`;
  if (!dialogoUsuario.open) dialogoUsuario.showModal();

  // Si soy moderador, el botón dice si ya está silenciado
  if (esModerador && !yo) {
    try {
      const silenciado = await foro.estaSilenciado(uid);
      const etiqueta = dialogoUsuario.querySelector('[data-accion="silenciar"] span');
      if (etiqueta && dialogoUsuario.dataset.uid === uid) {
        etiqueta.textContent = silenciado ? t("Quitar el silencio") : t("Silenciar en el foro");
        dialogoUsuario.querySelector('[data-accion="silenciar"]').dataset.silenciado = silenciado ? "1" : "";
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Si soy el administrador, el botón dice si ya es moderador (y no sale si es otro administrador)
  if (esAdmin && !yo) {
    try {
      const rol = await foro.rolDe(uid);
      const boton = dialogoUsuario.querySelector('[data-accion="moderador"]');
      if (boton && dialogoUsuario.dataset.uid === uid && rol !== "admin") {
        boton.querySelector("span").textContent = rol ? t("Quitar como moderador") : t("Nombrar moderador");
        boton.dataset.rol = rol || "";
        boton.hidden = false;
      }
    } catch (error) {
      console.error(error);
    }
  }
}

async function accionDeUsuario(e) {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const uid = dialogoUsuario.dataset.uid;
  const error = dialogoUsuario.querySelector(".foro-usuario-error");
  error.textContent = "";

  try {
    switch (boton.dataset.accion) {
      case "perfil": {
        dialogoUsuario.close();
        const { abrirMiPerfil, abrirPerfilDe } = await import("../perfil.js");
        if (uid === miUid()) abrirMiPerfil();
        else abrirPerfilDe(uid);
        break;
      }
      case "amigo":
        boton.disabled = true;
        await pedirAmistad(uid);
        dialogoUsuario.close();
        avisar(t("Solicitud de amistad enviada."));
        break;
      case "denunciar":
        dialogoUsuario.close();
        abrirDenuncia({ tipo: "usuario", autor: uid, copia: perfilDe(uid).nombre || "" });
        break;
      case "chat": {
        dialogoUsuario.close();
        const { abrirChat } = await import("../chat.js");
        abrirChat(uid);
        break;
      }
      case "bloquear": {
        const nombre = perfilDe(uid).nombre || t("Jugador");
        const quiere = await confirmar(
          t("¿Bloquear a {nombre}? Dejaréis de ser amigos, se borrará el chat y no podrá volver a pedirte amistad.", { nombre }),
          { aceptar: t("Bloquear") }
        );
        if (!quiere) return;
        await bloquear(uid);
        dialogoUsuario.close();
        avisar(t("{nombre} bloqueado.", { nombre }));
        break;
      }
      case "desbloquear":
        await desbloquear(uid);
        dialogoUsuario.close();
        avisar(t("Desbloqueado."));
        break;
      case "silenciar": {
        const yaSilenciado = Boolean(boton.dataset.silenciado);
        if (yaSilenciado) {
          await foro.quitarSilencio(uid);
          dialogoUsuario.close();
          avisar(t("Silencio quitado."));
        } else {
          const motivo = await preguntar(t("¿Por qué lo silencias? (solo lo verá esa persona)"), "");
          if (motivo === null) return;
          await foro.silenciar(uid, motivo);
          dialogoUsuario.close();
          avisar(t("Silenciado: ya no puede escribir en el foro."));
        }
        break;
      }
      case "moderador": {
        const nombre = perfilDe(uid).nombre || t("Jugador");
        if (boton.dataset.rol) {
          if (!(await confirmar(t("¿Quitar a {nombre} como moderador?", { nombre }), { aceptar: t("Quitar") }))) return;
          await foro.quitarModerador(uid);
          dialogoUsuario.close();
          avisar(t("{nombre} ya no es moderador.", { nombre }));
        } else {
          if (!(await confirmar(t("¿Nombrar moderador a {nombre}?", { nombre }), { aceptar: t("Nombrar") }))) return;
          await foro.nombrarModerador(uid);
          dialogoUsuario.close();
          avisar(t("{nombre} ya es moderador.", { nombre }));
        }
        break;
      }
      default:
    }
  } catch (fallo) {
    console.error(fallo);
    boton.disabled = false;
    error.textContent = t("No se ha podido hacer. Prueba de nuevo.");
  }
}

// ---------- Panel de moderación ----------

// Una tarjeta por cosa denunciada, con todas las denuncias que ha recibido
function agruparDenuncias(denuncias) {
  const grupos = new Map();
  for (const denuncia of denuncias) {
    const clave = denuncia.tipo === "usuario" ? `usuario:${denuncia.autor}` : `${denuncia.tipo}:${denuncia.hilo}:${denuncia.comentario}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, tipo: denuncia.tipo, hilo: denuncia.hilo, comentario: denuncia.comentario, autor: denuncia.autor, denuncias: [] });
    grupos.get(clave).denuncias.push(denuncia);
  }
  return grupos;
}

async function pintarDenuncias() {
  lista.hidden = false;
  lista.innerHTML = `<p class="foro-vacio">${t("Cargando...")}</p>`;
  botonMas.hidden = true;

  try {
    const denuncias = await foro.cargarDenuncias();
    gruposDenuncias = agruparDenuncias(denuncias);
    denunciasAbiertas = gruposDenuncias.size;
    pintarPestanas();

    if (!gruposDenuncias.size) {
      lista.innerHTML = `<p class="foro-vacio">${t("No hay denuncias pendientes.")}</p>`;
      return;
    }

    // El autor de verdad: el que denuncia podría haber escrito cualquiera en «autor». Un comentario
    // lleva el uid de quien lo escribió en su id (lo exigen las reglas); un hilo se mira en el hilo.
    const hilosDenunciados = new Map();
    await Promise.all(
      [...new Set([...gruposDenuncias.values()].filter((grupo) => grupo.tipo === "hilo").map((grupo) => grupo.hilo))].map(async (id) => {
        hilosDenunciados.set(id, await foro.cargarHilo(id).catch(() => null));
      })
    );
    for (const grupo of gruposDenuncias.values()) {
      if (grupo.tipo === "comentario") grupo.autor = grupo.comentario.split("_")[0];
      if (grupo.tipo === "hilo") {
        grupo.hiloActual = hilosDenunciados.get(grupo.hilo) || null;
        if (grupo.hiloActual) grupo.autor = grupo.hiloActual.uid;
      }
    }
    await traerPerfiles([...gruposDenuncias.values()].flatMap((grupo) => [grupo.autor, ...grupo.denuncias.map((cada) => cada.de)]));

    lista.innerHTML = [...gruposDenuncias.values()].map(plantillaGrupo).join("");
  } catch (error) {
    console.error(error);
    lista.innerHTML = `<p class="foro-vacio">${t("No se han podido cargar las denuncias.")}</p>`;
  }
}

function plantillaGrupo(grupo) {
  const motivos = {};
  for (const denuncia of grupo.denuncias) motivos[denuncia.motivo] = (motivos[denuncia.motivo] || 0) + 1;
  const textoMotivos = Object.entries(motivos)
    .map(([motivo, veces]) => `${nombreMotivo(motivo)}${veces > 1 ? ` ×${veces}` : ""}`)
    .join(" · ");
  const notas = grupo.denuncias
    .filter((denuncia) => denuncia.nota)
    .slice(0, 3)
    .map((denuncia) => `<li><b>${nombreDe(denuncia.de)}:</b> ${escaparHTML(denuncia.nota)}</li>`)
    .join("");
  const copia = grupo.denuncias.find((denuncia) => denuncia.copia);
  const yaNoEsta = grupo.tipo === "hilo" && !grupo.hiloActual;
  const tipo = { hilo: t("Hilo"), comentario: t("Comentario"), usuario: t("Persona") }[grupo.tipo];

  const botones = [];
  if (grupo.tipo !== "usuario" && !yaNoEsta) botones.push(`<button data-accion="ver">${icono("mensaje")}${t("Ver el hilo")}</button>`);
  botones.push(`<button data-accion="autor">${icono("persona")}${t("Ver autor")}</button>`);
  if (grupo.tipo !== "usuario" && !yaNoEsta) botones.push(`<button data-accion="borrar" class="peligro">${icono("papelera")}${t("Borrar contenido")}</button>`);
  botones.push(`<button data-accion="descartar">${icono("visto")}${t("Descartar")}</button>`);

  return `
    <article class="denuncia" data-grupo="${escaparHTML(grupo.clave)}">
      <div class="denuncia-cabecera">
        ${icono("bandera")}
        <b>${tipo}</b>
        <span>${grupo.denuncias.length === 1 ? t("1 denuncia") : t("{n} denuncias", { n: grupo.denuncias.length })}</span>
        <span class="comentario-hace">${hace(Math.max(...grupo.denuncias.map((denuncia) => denuncia.creado)))}</span>
        ${yaNoEsta ? `<span class="hilo-chip cerrado">${t("Ya no existe")}</span>` : ""}
      </div>
      <div class="denuncia-autor">${foto(grupo.autor)}<span>${nombreDe(grupo.autor)}</span></div>
      <p class="denuncia-motivos">${escaparHTML(textoMotivos)}</p>
      ${notas ? `<ul class="denuncia-notas">${notas}</ul>` : ""}
      ${copia ? `<blockquote class="denuncia-copia">${escaparHTML(copia.copia)}</blockquote>` : ""}
      <div class="denuncia-botones">${botones.join("")}</div>
    </article>`;
}

async function accionDeDenuncia(e) {
  const boton = e.target.closest("[data-accion]");
  const tarjeta = e.target.closest("[data-grupo]");
  if (!boton || !tarjeta) return;
  const grupo = gruposDenuncias.get(tarjeta.dataset.grupo);
  if (!grupo) return;
  const ids = grupo.denuncias.map((denuncia) => denuncia.id);

  try {
    switch (boton.dataset.accion) {
      case "ver":
        await irAVista("foro");   // el hilo se abre en el panel del foro
        abrirHilo(grupo.hilo);
        break;
      case "autor":
        abrirUsuario(grupo.autor);
        break;
      case "borrar":
        if (!(await confirmar(t("¿Borrar este contenido?"), { aceptar: t("Borrar") }))) return;
        if (grupo.tipo === "hilo") await foro.borrarHilo(grupo.hilo);
        else await foro.borrarComentario(grupo.hilo, grupo.comentario);
        await foro.borrarDenuncias(ids);
        await recargar();
        break;
      case "descartar":
        if (!(await confirmar(t("¿Descartar esta denuncia? El contenido se queda como está."), { aceptar: t("Descartar") }))) return;
        await foro.borrarDenuncias(ids);
        await pintarDenuncias();
        break;
      default:
    }
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido hacer. Prueba de nuevo."));
  }
}

// ---------- Moderadores (solo el administrador) ----------

function plantillaModerador(moderador) {
  const yo = moderador.uid === miUid();
  const admin = moderador.rol === "admin";
  return `
    <article class="moderador">
      ${foto(moderador.uid)}
      <div class="moderador-datos">
        <button class="foro-nombre" data-autor="${escaparHTML(moderador.uid)}">${nombreDe(moderador.uid)}</button>
        <span class="hilo-chip ${admin ? "principal" : ""}">${admin ? t("Administrador") : t("Moderador")}</span>
      </div>
      ${admin || yo ? "" : `<button class="moderador-quitar" data-quitar-moderador="${escaparHTML(moderador.uid)}">${icono("aspa")}${t("Quitar")}</button>`}
    </article>`;
}

async function pintarModeradores() {
  lista.hidden = false;
  botonMas.hidden = true;
  lista.innerHTML = `<p class="foro-vacio">${t("Cargando...")}</p>`;

  try {
    const moderadores = await foro.listarModeradores();
    await traerPerfiles(moderadores.map((moderador) => moderador.uid));
    lista.innerHTML = `
      <p class="moderadores-explicacion">${t("Un moderador puede borrar hilos y comentarios de otros, crear hilos principales, silenciar a gente y ver las denuncias. Solo tú, como administrador, puedes nombrar y quitar moderadores.")}</p>
      <div class="moderadores-nuevo">
        <input class="moderadores-campo" type="text" placeholder="${t("Mote de la persona...")}">
        <button class="moderadores-nombrar">${icono("escudo")} ${t("Nombrar moderador")}</button>
        <span class="moderadores-aviso foro-error"></span>
      </div>
      ${moderadores.map(plantillaModerador).join("")}`;
  } catch (error) {
    console.error(error);
    lista.innerHTML = `<p class="foro-vacio">${t("No se han podido cargar los moderadores.")}</p>`;
  }
}

// ---------- Sugerencias (solo el administrador) ----------
//
// Lo que manda la gente desde «Enviar sugerencia», en Inicio: lo más nuevo arriba, con quién la mandó
// (si tenía sesión, se abre su ficha) y una papelera para quitarla cuando ya está vista.

function plantillaSugerencia(sugerencia) {
  const fecha = sugerencia.creado
    ? new Date(sugerencia.creado).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const quien = sugerencia.uid
    ? `<button class="sugerencia-quien" data-autor="${escaparHTML(sugerencia.uid)}">${escaparHTML(sugerencia.nombre || t("Jugador"))}</button>`
    : `<span class="sugerencia-quien">${t("Sin sesión")}</span>`;
  return `
    <article class="sugerencia">
      <header>
        ${quien}
        <span class="sugerencia-fecha">${escaparHTML(fecha)}${sugerencia.idioma === "en" ? " · EN" : ""}</span>
        <button class="sugerencia-borrar" data-borrar-sugerencia="${escaparHTML(sugerencia.id)}" title="${t("Borrar")}" aria-label="${t("Borrar")}">${icono("papelera")}</button>
      </header>
      <p>${escaparHTML(sugerencia.texto)}</p>
    </article>`;
}

async function pintarSugerencias() {
  lista.hidden = false;
  botonMas.hidden = true;
  lista.innerHTML = `<p class="foro-vacio">${t("Cargando...")}</p>`;
  try {
    const sugerencias = await cargarSugerencias();
    lista.innerHTML = sugerencias.length
      ? `<p class="moderadores-explicacion">${t("Lo que manda la gente desde «Enviar sugerencia», en Inicio. Solo las ves tú.")}</p>
         ${sugerencias.map(plantillaSugerencia).join("")}`
      : `<p class="foro-vacio">${t("No hay sugerencias.")}</p>`;
  } catch (error) {
    console.error(error);
    lista.innerHTML = `<p class="foro-vacio">${t("No se han podido cargar las sugerencias.")}</p>`;
  }
}

async function accionDeSugerencia(boton) {
  if (!(await confirmar(t("¿Borrar esta sugerencia?"), { aceptar: t("Borrar") }))) return;
  try {
    await borrarSugerencia(boton.dataset.borrarSugerencia);
    boton.closest(".sugerencia").remove();
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido hacer. Prueba de nuevo."));
  }
}

async function accionDeModeradores(e) {
  const quitar = e.target.closest("[data-quitar-moderador]");
  const aviso = lista.querySelector(".moderadores-aviso");
  const campo = lista.querySelector(".moderadores-campo");
  if (aviso) aviso.textContent = "";

  try {
    if (quitar) {
      const uid = quitar.dataset.quitarModerador;
      await traerPerfiles([uid]);
      const nombre = perfilDe(uid).nombre || t("Jugador");
      if (!(await confirmar(t("¿Quitar a {nombre} como moderador?", { nombre }), { aceptar: t("Quitar") }))) return;
      await foro.quitarModerador(uid);
      await pintarModeradores();
      return;
    }

    // Nombrar: se busca por mote, como al añadir un amigo
    const texto = campo ? campo.value.trim() : "";
    if (!texto) return;
    const perfil = await buscarAmigo(texto);
    if (!perfil) {
      aviso.textContent = t("No encuentro a nadie con eso.");
      return;
    }
    if (perfil.uid === miUid()) {
      aviso.textContent = t("Esa eres tú.");
      return;
    }
    const nombre = perfil.nombre || t("Jugador");
    if ((await foro.rolDe(perfil.uid)) !== null) {
      aviso.textContent = t("{nombre} ya es moderador.", { nombre });
      return;
    }
    if (!(await confirmar(t("¿Nombrar moderador a {nombre}?", { nombre }), { aceptar: t("Nombrar") }))) return;
    await foro.nombrarModerador(perfil.uid);
    await pintarModeradores();
  } catch (error) {
    console.error(error);
    if (aviso) aviso.textContent = t("No se ha podido hacer. Prueba de nuevo.");
  }
}

// ---------- El alto ----------

// En ordenador, la lista y el hilo llegan justo hasta abajo de la ventana (cada uno con su propio
// desplazamiento). En el móvil, y en «Denuncias» y «Moderadores», la página se desplaza normal.
function ajustarAlto() {
  if (!cuerpo || seccion.hidden) return;
  const ancho = matchMedia("(min-width: 1001px)").matches;
  if (!ancho || cuerpo.classList.contains("sin-panel")) {
    cuerpo.style.height = "";
    return;
  }
  const arriba = cuerpo.getBoundingClientRect().top + window.scrollY;
  cuerpo.style.height = `${Math.max(26 * 16, innerHeight - arriba - 16)}px`;
}

// ---------- Arranque ----------

function pintarSinSesion() {
  pestanas.hidden = barra.hidden = true;
  botonMas.hidden = true;
  avisoSilencio.hidden = true;
  cuerpo.classList.add("sin-panel");
  ajustarAlto();
  lista.hidden = false;
  lista.innerHTML = `<p class="foro-vacio">${hayNube() ? t("Inicia sesión para entrar al foro.") : t("El foro necesita la nube: no está disponible en esta versión de la web.")}</p>`;
}

function pintarTipos() {
  selectTipo.innerHTML = ["", ...foro.CATEGORIAS]
    .map((id) => `<button data-tipo="${id}" class="foro-tipo-boton ${id ? `cat-${id}` : ""} ${id === filtroTipo ? "activa" : ""}" aria-pressed="${id === filtroTipo}">${id ? escaparHTML(nombreCategoria(id)) : t("Todos")}</button>`)
    .join("");
}

function construirFiltros() {
  pintarTipos();
  selectJuego.innerHTML =
    `<option value="">${t("Cualquier juego")}</option>` +
    JUEGOS.map((juego) => `<option value="${escaparHTML(juego.id)}">${escaparHTML(juego.nombre)}</option>`).join("");
}

export function iniciar() {
  seccion = document.querySelector("#vista-foro");
  pestanas = seccion.querySelector(".foro-categorias");
  barra = seccion.querySelector(".barra-foro");
  lista = seccion.querySelector(".foro-lista");
  aviso = seccion.querySelector(".foro-aviso");
  avisoSilencio = seccion.querySelector(".foro-silencio");
  botonMas = seccion.querySelector(".foro-mas");
  selectTipo = seccion.querySelector(".foro-tipos");
  selectJuego = seccion.querySelector(".foro-juego");
  dialogoNuevo = document.querySelector("#dialogo-foro-nuevo");
  panelHilo = seccion.querySelector(".foro-panel-hilo");
  cuerpo = seccion.querySelector(".foro-cuerpo");
  dialogoDenuncia = document.querySelector("#dialogo-foro-denuncia");
  dialogoUsuario = document.querySelector("#dialogo-foro-usuario");

  barra.querySelector(".foro-nuevo").innerHTML = `${icono("mas")} ${t("Nuevo hilo")}`;
  barra.querySelector(".foro-actualizar").innerHTML = icono("refrescar");
  barra.querySelector(".foro-buscar-caja").insertAdjacentHTML("afterbegin", icono("lupa"));
  construirFiltros();

  // Pestañas de moderación y filtros
  pestanas.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-pestana]");
    if (boton && boton.dataset.pestana !== vista) irAVista(boton.dataset.pestana);
  });
  selectTipo.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-tipo]");
    if (!boton) return;
    filtroTipo = boton.dataset.tipo;
    pintarTipos();
    pintarLista();
  });
  selectJuego.addEventListener("change", () => {
    filtroJuego = selectJuego.value;
    pintarLista();
  });
  barra.querySelector(".foro-abiertos input").addEventListener("change", (e) => {
    soloAbiertos = e.target.checked;
    pintarLista();
  });
  barra.querySelector(".foro-buscar").addEventListener("input", (e) => {
    busqueda = e.target.value;
    pintarLista();
  });
  barra.querySelector(".foro-nuevo").addEventListener("click", () => abrirNuevo());
  barra.querySelector(".foro-actualizar").addEventListener("click", () => recargar());
  botonMas.addEventListener("click", verMas);

  // La lista: la foto de alguien abre su ficha; una tarjeta abre el hilo; en «Denuncias» y
  // «Moderadores», los botones de cada tarjeta
  lista.addEventListener("click", (e) => {
    const autor = e.target.closest("[data-autor]");
    if (autor) {
      e.stopPropagation();
      abrirUsuario(autor.dataset.autor);
      return;
    }
    if (e.target.closest("[data-grupo]")) {
      accionDeDenuncia(e);
      return;
    }
    if (e.target.closest(".moderadores-nombrar") || e.target.closest("[data-quitar-moderador]")) {
      accionDeModeradores(e);
      return;
    }
    const borrar = e.target.closest("[data-borrar-sugerencia]");
    if (borrar) {
      accionDeSugerencia(borrar);
      return;
    }
    const hilo = e.target.closest("[data-hilo]");
    if (hilo) abrirHilo(hilo.dataset.hilo);
  });
  lista.addEventListener("keydown", (e) => {
    const hilo = e.target.closest("[data-hilo]");
    if (hilo && e.key === "Enter") abrirHilo(hilo.dataset.hilo);
    // Con las flechas arriba y abajo se pasa de un hilo al siguiente y se abre en el panel
    if (hilo && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const filas = [...lista.querySelectorAll("[data-hilo]")];
      const otra = filas[filas.indexOf(hilo) + (e.key === "ArrowDown" ? 1 : -1)];
      if (otra) irAHilo(otra);
    }
    if (e.key === "Enter" && e.target.closest(".moderadores-campo")) accionDeModeradores(e);
  });

  // Nuevo hilo
  activarCamposJuego(dialogoNuevo);
  dialogoNuevo.querySelector(".foro-nuevo-categoria").addEventListener("change", actualizarCamposDeBusco);
  dialogoNuevo.querySelector(".foro-nuevo-cancelar").addEventListener("click", () => dialogoNuevo.close());
  dialogoNuevo.querySelector(".foro-nuevo-enviar").addEventListener("click", enviarNuevo);

  // Un hilo abierto
  panelHilo.addEventListener("click", (e) => {
    const autor = e.target.closest("[data-autor]");
    if (autor && !e.target.closest("[data-accion]")) {
      abrirUsuario(autor.dataset.autor);
      return;
    }
    accionDeHilo(e);
  });
  // El «⋯» se cierra pulsando fuera, con Escape o al desplazar lo de detrás
  document.addEventListener("pointerdown", (e) => {
    if (menuOpciones && !menuOpciones.contains(e.target) && !e.target.closest('[data-accion^="opciones"]')) cerrarOpciones();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpciones) cerrarOpciones();
  });
  panelHilo.querySelector(".foro-hilo-desliza").addEventListener("scroll", cerrarOpciones, { passive: true });
  panelHilo.querySelector(".foro-hilo-respondiendo").addEventListener("click", accionDeHilo);

  // Lo que cambia en la campana (alguien te responde, piden unirse...) se ve también en la lista
  alCambiarAvisosForo(() => {
    if (!seccion.hidden && vista === "foro" && usuarioActual() && lista.querySelector("[data-hilo]")) pintarLista();
  });

  // La lista y el hilo ocupan justo lo que queda de pantalla: no se desplaza la página, cada uno
  // se desplaza por dentro
  addEventListener("resize", ajustarAlto);
  // En el ordenador un aspa; en el móvil (el hilo a pantalla completa), una flecha de volver
  panelHilo.querySelector(".foro-panel-cerrar").innerHTML = `<span class="solo-ancho">${icono("aspa")}</span><span class="solo-movil">${icono("atras")}</span>`;
  panelHilo.querySelector(".foro-hilo-enviar").innerHTML = `${icono("enviar")}<span>${t("Enviar")}</span>`;
  panelHilo.querySelector(".foro-panel-cerrar").addEventListener("click", cerrarHilo);
  panelHilo.querySelector(".foro-hilo-enviar").addEventListener("click", responder);
  panelHilo.querySelector(".foro-hilo-mas").addEventListener("click", verComentariosAnteriores);
  panelHilo.querySelector(".foro-hilo-responder textarea").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) responder();
  });

  // Denuncias y fichas
  dialogoDenuncia.querySelector(".foro-denuncia-cancelar").addEventListener("click", () => dialogoDenuncia.close());
  dialogoDenuncia.querySelector(".foro-denuncia-enviar").addEventListener("click", enviarDenuncia);
  dialogoUsuario.querySelector(".foro-usuario-cerrar").innerHTML = icono("aspa");
  dialogoUsuario.querySelector(".foro-usuario-cerrar").addEventListener("click", () => dialogoUsuario.close());
  // Pulsando fuera de la ficha (en lo oscuro de alrededor) también se cierra
  dialogoUsuario.addEventListener("click", (e) => {
    if (e.target !== dialogoUsuario) return;
    const caja = dialogoUsuario.getBoundingClientRect();
    if (e.clientX < caja.left || e.clientX > caja.right || e.clientY < caja.top || e.clientY > caja.bottom) dialogoUsuario.close();
  });
  dialogoUsuario.addEventListener("click", accionDeUsuario);

  // Si se cambia de cuenta o se sale, lo cargado ya no vale
  alCambiarSesion(() => {
    hilos = fijados = [];
    cursor = null;
    hayMas = false;
    cargadoEn = 0;
    esModerador = esAdmin = false;
    silencio = null;
    vista = "foro";
    cerrarPanel();
    if (!seccion.hidden) mostrar();
  });
}

export function mostrar() {
  if (!usuarioActual()) {
    pintarSinSesion();
    return;
  }
  pintarPestanas();
  requestAnimationFrame(ajustarAlto);
  if (Date.now() - cargadoEn > REFRESCO) recargar();
}
