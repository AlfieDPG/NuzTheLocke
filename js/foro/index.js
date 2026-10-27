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
import { marcoDe, claseMarco, apuntarMarco } from "../comun/fichas.js";
import { hayNube, usuarioActual, alCambiarSesion } from "../comun/nube.js";
import { JUEGOS } from "../comun/juegos.js";
import { plantillaCampoJuego, activarCamposJuego, leerCampoJuego, nombreJuego } from "../comun/campo-juego.js";
import { amistades, perfilesDe, pedirAmistad, buscarAmigo, lockesJugados } from "../comun/perfiles.js";
import { estaBloqueado, bloquear, desbloquear } from "../comun/chat.js";
import { marcarHiloVisto } from "../comun/avisos-foro.js";
import { estaConectado } from "../comun/presencia.js";
import { confirmar, avisar, preguntar } from "../comun/ventanas.js";
import { t, LOCALE } from "../comun/idioma.js";
import * as foro from "../comun/foro.js";

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
      return t("Dudas y ayuda");
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

// Amigo ("ok"), solicitud pendiente ("pendiente") o nada (null)
function relacionCon(uid) {
  const amistad = amistades().find((cada) => cada.otro === uid);
  return amistad ? amistad.estado : null;
}

// ---------- La lista ----------

function pintarPestanas() {
  // Las pestañas son solo para moderar: quien no modera ve únicamente el foro
  const ids = esModerador ? ["foro", "denuncias"] : [];
  if (esAdmin) ids.push("moderadores");
  pestanas.hidden = !esModerador;
  barra.hidden = false;   // (sin sesión se esconde; ver pintarSinSesion)
  pestanas.innerHTML = ids
    .map((id) => {
      const nombre =
        id === "foro"
          ? t("Foro")
          : id === "denuncias"
            ? t("Denuncias") + (denunciasAbiertas ? ` (${denunciasAbiertas})` : "")
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
  chips.push(`<span class="hilo-chip">${escaparHTML(nombreCategoria(hilo.categoria))}</span>`);
  if (hilo.categoria === "busco") {
    const juego = nombreJuego(hilo);
    if (juego) chips.push(`<span class="hilo-chip">${icono("mando")}${escaparHTML(juego)}</span>`);
    if (hilo.tipo) chips.push(`<span class="hilo-chip">${icono("etiqueta")}${escaparHTML(hilo.tipo)}</span>`);
    if (hilo.huecos && !hilo.cerrado) {
      chips.push(`<span class="hilo-chip busca">${icono("personaMas")}${t("Busca a {n}", { n: hilo.huecos })}</span>`);
    }
  }
  if (hilo.cerrado) {
    chips.push(`<span class="hilo-chip cerrado">${icono("candado")}${hilo.categoria === "busco" ? t("Completo") : t("Cerrado")}</span>`);
  }
  return chips;
}

// Una línea por hilo: el título (con la chincheta si es principal) y las respuestas, y debajo, en
// pequeño, sus etiquetas, quién lo escribió y cuándo fue lo último. El texto se lee al abrirlo.
function plantillaHilo(hilo) {
  const principal = hilo.fijado ? `<span class="hilo-fijado" title="${t("Principal")}">${icono("chincheta")}</span>` : "";
  return `
    <article class="hilo ${hilo.cerrado ? "cerrado" : ""} ${hilo.fijado ? "fijado" : ""} ${hilo.id === idAbierto ? "seleccionado" : ""}" data-hilo="${escaparHTML(hilo.id)}" tabindex="0">
      ${foto(hilo.uid)}
      <div class="hilo-cuerpo">
        <div class="hilo-linea">
          <h3 class="hilo-titulo">${principal}${escaparHTML(hilo.titulo)}</h3>
          <span class="hilo-respuestas" title="${textoRespuestas(hilo.respuestas)}">${icono("mensaje")}<b>${hilo.respuestas}</b></span>
        </div>
        <div class="hilo-meta">
          ${chipsDeHilo(hilo, true).join("")}
          <span class="hilo-autor">${nombreDe(hilo.uid)}</span>
          <span>${hace(hilo.ultimo)}</span>
        </div>
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
  await traerPerfiles(pagina.hilos.map((hilo) => hilo.uid));
  hilos = primera ? pagina.hilos : [...hilos, ...pagina.hilos];
  cursor = pagina.cursor;
  hayMas = pagina.hayMas;
}

// Pinta la vista elegida (el foro, las denuncias o los moderadores)
async function pintarVista() {
  pintarPestanas();
  const conPanel = vista === "foro";
  cuerpo.classList.toggle("sin-panel", !conPanel);
  if (!conPanel && idAbierto) cerrarPanel();
  if (vista === "denuncias") await pintarDenuncias();
  else if (vista === "moderadores") await pintarModeradores();
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
    if (vista === "moderadores" && !esAdmin) vista = "foro";

    silencio = await foro.miSilencio();
    avisoSilencio.hidden = !silencio;
    avisoSilencio.textContent = silencio ? t("Un moderador te ha silenciado: puedes leer el foro, pero no escribir.") : "";

    const [nuevosFijados] = await Promise.all([foro.cargarFijados(), cargarPagina(true)]);
    fijados = nuevosFijados;
    await traerPerfiles(fijados.map((hilo) => hilo.uid));

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
// Un hilo normal se lee de arriba abajo, con lo último escrito al final y la caja para responder
// debajo. Un hilo principal (fijado) acumula muchos mensajes de gente buscando compañeros, así que
// va al revés: la caja arriba y lo más nuevo primero, de 40 en 40.

let panelHilo = null;
let hiloAbierto = null;            // el hilo del panel, ya cargado
let idAbierto = null;              // su id (desde que se pulsa, aunque aún no haya cargado)
let comentariosAbiertos = [];
let comentariosCargados = false;   // ya ha llegado la primera tanda de comentarios
let recienteActual = null;         // true si se están viendo del más nuevo al más viejo (hilo principal)
let limiteComentarios = COMENTARIOS_POR_PAGINA;
let hayMasComentarios = false;
let pararHilo = null;
let pararComentarios = null;
let aperturas = 0;   // cuenta cada vez que se abre un hilo: lo que llega tarde de uno anterior se tira

function pararEscuchas() {
  if (pararHilo) pararHilo();
  if (pararComentarios) pararComentarios();
  pararHilo = pararComentarios = null;
}

function puedoBorrarComentario(comentario) {
  return esModerador || comentario.uid === miUid() || (hiloAbierto && hiloAbierto.uid === miUid());
}

function pintarCabeceraHilo() {
  const hilo = hiloAbierto;
  const mio = hilo.uid === miUid();

  const acciones = [];
  if (mio) {
    acciones.push(`<button data-accion="editar" title="${t("Editar")}">${icono("lapiz")}</button>`);
    acciones.push(
      `<button data-accion="cerrar" title="${hilo.cerrado ? t("Volver a abrir") : hilo.categoria === "busco" ? t("Ya tengo gente") : t("Cerrar el hilo")}">${icono(hilo.cerrado ? "reanudar" : "candado")}</button>`
    );
  } else {
    acciones.push(`<button data-accion="denunciar-hilo" title="${t("Denunciar")}">${icono("bandera")}</button>`);
  }
  if (esModerador) {
    acciones.push(`<button data-accion="fijar" class="${hilo.fijado ? "activo" : ""}" title="${hilo.fijado ? t("Quitar de principales") : t("Hacer principal")}">${icono("chincheta")}</button>`);
  }
  if (mio || esModerador) {
    acciones.push(`<button data-accion="borrar-hilo" class="peligro" title="${t("Borrar")}">${icono("papelera")}</button>`);
  }

  panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `
    <div class="foro-hilo-titulo-fila">
      <h2>${escaparHTML(hilo.titulo)}</h2>
      <div class="foro-hilo-acciones">${acciones.join("")}</div>
    </div>
    <div class="hilo-chips">${chipsDeHilo(hilo).join("")}</div>
    <div class="foro-hilo-autor">
      ${foto(hilo.uid)}
      <div>
        <button class="foro-nombre" data-autor="${escaparHTML(hilo.uid)}">${nombreDe(hilo.uid)}</button>
        <span class="comentario-hace">${hace(hilo.creado)}</span>
      </div>
    </div>
    ${hilo.texto ? `<p class="foro-hilo-texto">${escaparHTML(hilo.texto)}</p>` : ""}`;

  actualizarFormularioRespuesta();
}

function pintarComentarios(alFinal) {
  const caja = panelHilo.querySelector(".foro-hilo-comentarios");
  const abajo = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 40;

  caja.innerHTML = comentariosAbiertos.length
    ? comentariosAbiertos
        .map((comentario) => {
          const acciones = [];
          if (comentario.uid !== miUid()) {
            acciones.push(`<button data-accion="denunciar-comentario" data-comentario="${escaparHTML(comentario.id)}" title="${t("Denunciar")}">${icono("bandera")}</button>`);
          }
          if (puedoBorrarComentario(comentario)) {
            acciones.push(`<button data-accion="borrar-comentario" data-comentario="${escaparHTML(comentario.id)}" class="peligro" title="${t("Borrar")}">${icono("papelera")}</button>`);
          }
          return `
            <div class="comentario">
              ${foto(comentario.uid)}
              <div class="comentario-cuerpo">
                <div class="comentario-cabecera">
                  <button class="foro-nombre" data-autor="${escaparHTML(comentario.uid)}">${nombreDe(comentario.uid)}</button>
                  ${comentario.uid === hiloAbierto.uid ? `<span class="comentario-op">${t("Autor")}</span>` : ""}
                  <span class="comentario-hace">${hace(comentario.creado)}</span>
                  <span class="comentario-acciones">${acciones.join("")}</span>
                </div>
                <p class="comentario-texto">${escaparHTML(comentario.texto)}</p>
              </div>
            </div>`;
        })
        .join("")
    : `<p class="foro-vacio">${t("Todavía nadie ha respondido.")}</p>`;

  // En un hilo normal el último comentario está abajo y se baja hasta él
  if (!recienteActual && (alFinal || abajo)) caja.scrollTop = caja.scrollHeight;
  panelHilo.querySelector(".foro-hilo-mas").hidden = !hayMasComentarios;
}

// El formulario de responder no se repinta con cada cambio (se perdería lo que se está
// escribiendo): solo se enciende, se apaga o cambia de texto según el estado del hilo
function actualizarFormularioRespuesta() {
  const formulario = panelHilo.querySelector(".foro-hilo-responder");
  const campo = formulario.querySelector("textarea");
  const nota = panelHilo.querySelector(".foro-hilo-nota");
  const hilo = hiloAbierto;

  const dueno = hilo.uid === miUid() || esModerador;
  let motivo = "";
  if (silencio) motivo = t("Un moderador te ha silenciado: no puedes escribir en el foro.");
  else if (hilo.cerrado && !dueno) motivo = hilo.categoria === "busco" ? t("Este hilo ya está completo.") : t("Este hilo está cerrado.");

  formulario.hidden = Boolean(motivo);
  nota.hidden = !motivo;
  nota.textContent = motivo;
  campo.disabled = Boolean(motivo);
}

async function abrirHilo(id) {
  const apertura = ++aperturas;
  pararEscuchas();
  hiloAbierto = null;
  comentariosAbiertos = [];
  comentariosCargados = false;
  hayMasComentarios = false;
  recienteActual = null;
  limiteComentarios = COMENTARIOS_POR_PAGINA;

  panelHilo.classList.remove("reciente");
  panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `<p class="foro-vacio">${t("Cargando...")}</p>`;
  panelHilo.querySelector(".foro-hilo-comentarios").innerHTML = "";
  panelHilo.querySelector(".foro-hilo-mas").hidden = true;
  panelHilo.querySelector(".foro-hilo-responder").hidden = true;
  panelHilo.querySelector(".foro-hilo-nota").hidden = true;
  panelHilo.querySelector(".foro-hilo-responder textarea").value = "";
  panelHilo.querySelector(".foro-hilo-error").textContent = "";
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
      await traerPerfiles([hilo.uid]);
      if (apertura !== aperturas) return;
      hiloAbierto = hilo;
      // Mirando tu hilo, sus respuestas dejan de ser nuevas para la campana (también tus propias respuestas)
      if (hilo.uid === miUid()) marcarHiloVisto(hilo.id, hilo.respuestas);
      pintarCabeceraHilo();

      // La primera vez (o si lo hacen principal o dejan de serlo con el hilo abierto) se elige cómo
      // se leen los comentarios y se empieza a escucharlos
      if (hilo.fijado !== recienteActual) {
        recienteActual = hilo.fijado;
        limiteComentarios = COMENTARIOS_POR_PAGINA;
        comentariosCargados = false;
        panelHilo.classList.toggle("reciente", recienteActual);
        suscribirComentarios(id, apertura);
      } else if (comentariosCargados) {
        pintarComentarios(false);
      }
    },
    (error) => {
      console.error(error);
      if (apertura === aperturas) panelHilo.querySelector(".foro-hilo-cabecera").innerHTML = `<p class="foro-vacio">${t("No se ha podido cargar el hilo.")}</p>`;
    }
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
      await traerPerfiles(comentarios.map((comentario) => comentario.uid));
      if (apertura !== aperturas) return;
      comentariosAbiertos = comentarios;
      comentariosCargados = true;
      hayMasComentarios = Boolean(recienteActual) && hayMas;
      if (hiloAbierto) pintarComentarios(false);
    },
    (error) => console.error(error),
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
// panel abierto ocupa toda la pantalla (ver foro.css) y se cierra con la aspa.
function mostrarPanel(abierto) {
  seccion.querySelector(".foro-panel").classList.toggle("abierto", abierto);
  seccion.querySelector(".foro-panel-vacio").hidden = abierto;
  panelHilo.hidden = !abierto;
  if (abierto) panelHilo.scrollTop = 0;
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
  hiloAbierto = null;
  idAbierto = null;
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
  try {
    await foro.comentar(hiloAbierto.id, texto);
    campo.value = "";
    pintarComentarios(true);
  } catch (fallo) {
    console.error(fallo);
    error.textContent = foro.explicarFallo(fallo, silencio);
  } finally {
    boton.disabled = false;
  }
}

async function accionDeHilo(e) {
  const boton = e.target.closest("[data-accion]");
  if (!boton || !hiloAbierto) return;
  const hilo = hiloAbierto;
  const accion = boton.dataset.accion;

  try {
    if (accion === "editar") {
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
    <header class="foro-usuario-cabecera ${conectado ? "conectado" : yo ? "mia" : ""}">
      ${foto(uid)}
      <div class="foro-usuario-datos">
        ${yo
          ? `<span class="jugador-estado">${t("Tú")}</span>`
          : conectado
            ? `<span class="jugador-estado"><span class="punto-conectado"></span>${t("Conectado")}</span>`
            : ""}
        <h2>${nombreDe(uid)}</h2>
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

// ---------- Arranque ----------

function pintarSinSesion() {
  pestanas.hidden = barra.hidden = true;
  botonMas.hidden = true;
  avisoSilencio.hidden = true;
  cuerpo.classList.add("sin-panel");
  lista.hidden = false;
  lista.innerHTML = `<p class="foro-vacio">${hayNube() ? t("Inicia sesión para entrar al foro.") : t("El foro necesita la nube: no está disponible en esta versión de la web.")}</p>`;
}

function construirFiltros() {
  selectTipo.innerHTML =
    `<option value="">${t("Todos los tipos")}</option>` +
    foro.CATEGORIAS.map((id) => `<option value="${id}">${escaparHTML(nombreCategoria(id))}</option>`).join("");
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
  selectTipo = seccion.querySelector(".foro-tipo");
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
  selectTipo.addEventListener("change", () => {
    filtroTipo = selectTipo.value;
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
    if (autor) {
      abrirUsuario(autor.dataset.autor);
      return;
    }
    accionDeHilo(e);
  });
  panelHilo.querySelector(".foro-panel-cerrar").innerHTML = icono("aspa");
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
  if (Date.now() - cargadoEn > REFRESCO) recargar();
}
