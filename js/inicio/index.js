// Sección «Inicio»: lo primero que se ve al entrar y al pulsar el logo.
//
//   · Arriba, el saludo y, si hay algo sin contestar, cuántas notificaciones (abre la campana).
//   · Tus lockes en marcha, con tus vidas y victorias: pulsando uno se va a él en «Lockes».
//   · Los amigos conectados ahora mismo.
//   · Tus últimos equipos guardados.
//   · Novedades: lo último que ha salido en la web (debajo de los lockes).
//   · Notas y avisos del desarrollador para todos los usuarios, y un cuadro para mandarle
//     sugerencias.
//
// Sin sesión, en vez de los lockes y los amigos, una bienvenida que explica la web (con sus
// secciones) y el botón de «Iniciar sesión».

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { marcoDe, claseMarco } from "../comun/fichas.js";
import { t, segunIdioma, LOCALE } from "../comun/idioma.js";
import { hayNube, usuarioActual, alCambiarSesion, seSabeLaSesion } from "../comun/nube.js";
import { nombreJuego } from "../comun/campo-juego.js";
import { carasDeEquipo } from "../comun/elegir-equipo.js";
import { leerGuardados } from "../equipos/estado.js";
import {
  miPerfil, alCambiarMiPerfil, amigosAceptados, solicitudesRecibidas, alCambiarAmistades,
  perfilesDeAmigos, alCambiarPerfilesAmigos, colorDeTipo, totalDeUsuarios, alCambiarTotalDeUsuarios
} from "../comun/perfiles.js";
import { estaConectado, alCambiarPresencia } from "../comun/presencia.js";
import {
  alCambiarLockes, misLockes, invitacionesALockes, estadoDe, estaEliminado, victoriasDe
} from "../comun/lockes.js";
import { irA } from "../navegacion.js";
import { medallasDelJuego } from "../comun/medallas.js";

let seccion = null;

const MAX_LOCKES = 12; // los que se pintan; en pantalla se ven los que caben (ajustarListas)
const MAX_EQUIPOS = 10;

// El número de registrados solo sale a partir de aquí (con pocos, queda peor que no ponerlo).
// Para esconderlo del todo, súbelo a un número que no se vaya a alcanzar.
const MINIMO_REGISTRADOS = 50;

// ---------- Notas y avisos (los escribe el desarrollador; los ven todos) ----------
//
// NOTA_INICIO: el párrafo de arriba. AVISOS: un punto cada uno, con su icono (de
// js/comun/iconos.js) y un color en «r, g, b». El texto admite HTML (<b>, <a>...).
// Cada texto va en español (es) y en inglés (en); si falta el inglés, sale en español.
// Si se dejan los dos vacíos, la tarjeta no sale.

const NOTA_INICIO = {
  es: `La web está en desarrollo y puede tener algún fallo. Si encuentras uno, o se te
    ocurre una idea que le vendría bien, cuéntamelo en el recuadro de sugerencias: todo feedback
    respetuoso es bienvenido :)`,
  en: `The site is still in development and may have some bugs. If you find one, or have an
    idea that would make it better, tell me in the suggestions box: all respectful feedback
    is welcome :)`
};

const AVISOS = [
  {
    icono: "mezclar", color: "160, 205, 80",
    es: `El <b>Randomizer</b> funciona con ROMs de <b>GBA</b> (Rojo Fuego / Verde Hoja), <b>NDS, 3DS
      y Switch</b> (Espada / Escudo y Diamante Brillante / Perla Reluciente).`,
    en: `The <b>Randomizer</b> works with <b>GBA</b> (FireRed / LeafGreen), <b>NDS, 3DS and
      Switch</b> ROMs (Sword / Shield and Brilliant Diamond / Shining Pearl).`
  },
  {
    icono: "enlace", color: "214, 88, 76",
    es: `Puedes <b>vincular tu partida</b> a un locke con Rojo Fuego / Verde Hoja y todos los juegos
      de DS, 3DS y Switch.`,
    en: `You can <b>link your save file</b> to a locke with FireRed / LeafGreen and every DS, 3DS
      and Switch game.`
  },
  {
    icono: "ayuda", color: "91, 141, 239",
    es: `¿Dudas? Mira el botón <b>«?»</b> de abajo a la izquierda. Si no está ahí la respuesta,
      escríbeme y la añadiré a las preguntas frecuentes.`,
    en: `Questions? Check the <b>“?”</b> button at the bottom left. If the answer isn't there,
      write to me and I'll add it to the FAQ.`
  },
  {
    icono: "aviso", color: "241, 196, 15",
    es: `Para el Randomizer necesitas <b>tus propias ROMs</b>: no puedo dároslas porque sería
      piratería y no me apetece ir a la cárcel :)`,
    en: `For the Randomizer you need <b>your own ROMs</b>: I can't give them to you because that
      would be piracy and I don't fancy going to jail :)`
  }
];

// ---------- Novedades ----------
//
// Lo último que ha salido, en el orden en que se enseña (lo más importante, primero: no tiene por
// qué ir por fechas). En Inicio salen las NOVEDADES_A_LA_VISTA primeras y el resto en «Ver todas».
// Cada una lleva a su sección (vista) al pulsarla, con su icono y el color de esa sección. Mismo
// formato de textos que los avisos.

const NOVEDADES_A_LA_VISTA = 3;

const NOVEDADES = [
  {
    fecha: "2026-10-29", vista: "jugar", icono: "consola", color: "186, 62, 102",
    es: `Nueva sección <b>Jugar</b>: juega a Rojo Fuego, Verde Hoja y los Pokémon de DS desde la web.
      Tu equipo y tus capturas se apuntan solos en el locke.`,
    en: `New <b>Play</b> section: play FireRed, LeafGreen and the DS Pokémon games in the browser.
      Your team and catches are recorded in your locke automatically.`
  },
  {
    fecha: "2026-10-26", vista: "foro", icono: "mensaje", color: "196, 128, 214",
    es: `Nueva sección <b>Foro</b>: busca compañeros para tu próximo locke, pide ayuda o charla, y
      habla en privado con tus amigos.`,
    en: `New <b>Forum</b> section: find partners for your next locke, ask for help or chat, and
      message your friends privately.`
  },
  {
    fecha: "2026-10-27", vista: "juegos", icono: "mando", color: "76, 182, 92",
    es: `Nueva sección <b>Juegos</b>: retos diarios (silueta, pistas, gritos...) que dan
      Pokédólares para la tienda y huevos para tu colección.`,
    en: `New <b>Games</b> section: daily challenges (silhouette, clues, cries...) that earn
      Pokédollars for the shop and eggs for your collection.`
  },
  {
    fecha: "2026-10-30", vista: "jugar", icono: "directo", color: "186, 62, 102",
    es: `<b>En directo</b>: emite tu partida de «Jugar» y tus amigos la ven con sonido y chat.`,
    en: `<b>Live</b>: stream your “Play” game and your friends watch it with sound and chat.`
  },
  {
    fecha: "2026-10-30", vista: "lockes", icono: "espadas", color: "214, 88, 76",
    es: `<b>Combates en Showdown</b>: en los combates de un locke, copia tu equipo y abre Showdown
      para retar a tu rival.`,
    en: `<b>Showdown battles</b>: in a locke's battles, copy your team and open Showdown to
      challenge your rival.`
  },
  {
    fecha: "2026-10-30", vista: "jugar", icono: "ajustes", color: "186, 62, 102",
    es: `«Jugar» renovado: velocidad, volumen, <b>cambiar teclas</b>, filtro de pantalla y cómo
      ver las dos pantallas de DS.`,
    en: `“Play” revamped: speed, volume, <b>key remapping</b>, screen filter and how to show the
      two DS screens.`
  },
  {
    fecha: "2026-10-29", vista: "randomizer", icono: "mezclar", color: "160, 205, 80",
    es: `<b>Randomizer de Rojo Fuego / Verde Hoja</b>, y «Randomizar y jugar» para empezar a jugar
      la ROM al momento.`,
    en: `<b>FireRed / LeafGreen Randomizer</b>, and “Randomize and play” to start playing the ROM
      right away.`
  }
];

function fechaNovedad(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

function plantillaNovedad(novedad) {
  return `
    <li>
      <button class="inicio-novedad" data-vista="${novedad.vista}" style="--color-aviso: ${novedad.color}">
        <span class="inicio-aviso-icono">${icono(novedad.icono)}</span>
        <span class="inicio-novedad-texto">
          <span class="inicio-novedad-fecha">${fechaNovedad(novedad.fecha)}</span>
          ${segunIdioma(novedad.es, novedad.en)}
        </span>
      </button>
    </li>`;
}

function plantillaNovedades() {
  if (!NOVEDADES.length) return "";
  const resto = NOVEDADES.length - NOVEDADES_A_LA_VISTA;
  return `
    <section class="inicio-bloque inicio-novedades">
      <h2>${icono("estrella")} ${t("Novedades")}</h2>
      <ul class="inicio-novedades-lista">${NOVEDADES.slice(0, NOVEDADES_A_LA_VISTA).map(plantillaNovedad).join("")}</ul>
      ${resto > 0
        ? `<div class="inicio-pie"><button class="inicio-novedades-todas">${t("Ver todas ({n})", { n: NOVEDADES.length })}</button></div>`
        : ""}
    </section>`;
}

// «Ver todas»: una ventana con la lista entera (se crea la primera vez)
function abrirNovedades() {
  let dialogo = document.querySelector("#dialogo-novedades");
  if (!dialogo) {
    dialogo = document.createElement("dialog");
    dialogo.id = "dialogo-novedades";
    dialogo.className = "dialogo-sesion";
    document.body.append(dialogo);
    dialogo.addEventListener("click", (e) => {
      if (e.target.closest(".novedades-cerrar")) return dialogo.close();
      const destino = e.target.closest("[data-vista]");
      if (destino) {
        dialogo.close();
        irA(destino.dataset.vista);
      }
    });
  }
  dialogo.innerHTML = `
    <h2>${t("Novedades")}</h2>
    <ul class="inicio-novedades-lista">${NOVEDADES.map(plantillaNovedad).join("")}</ul>
    <div class="dialogo-botones"><button class="boton-gris novedades-cerrar">${t("Cerrar")}</button></div>`;
  dialogo.showModal();
}

function plantillaAvisos() {
  const nota = segunIdioma(NOTA_INICIO.es, NOTA_INICIO.en).trim();
  if (!nota && !AVISOS.length) return "";

  return `
    <section class="inicio-bloque inicio-avisos-web">
      <h2>${icono("campana")} ${t("Notas y avisos")}</h2>
      ${nota ? `<p class="inicio-nota">${nota}</p>` : ""}
      ${AVISOS.length
        ? `<ul class="inicio-avisos-lista">${AVISOS.map(
            (aviso) => `
              <li style="--color-aviso: ${aviso.color}">
                <span class="inicio-aviso-icono">${icono(aviso.icono)}</span>
                <span>${segunIdioma(aviso.es, aviso.en)}</span>
              </li>`
          ).join("")}</ul>`
        : ""}
    </section>`;
}

// ---------- Bienvenida (sin sesión) ----------

// Lo que hay en la web, con el icono y el color de su sección; pulsando uno se va a ella
const SECCIONES = [
  { vista: "lockes", icono: "espadas", color: "214, 88, 76", nombre: "Lockes",
    texto: "Juega con amigos: vidas, muertes y victorias, y tu partida vinculada al momento." },
  { vista: "crear", icono: "pokeball", color: "91, 141, 239", nombre: "Equipos",
    texto: "Monta tus equipos, guárdalos e importa o exporta pastes de Showdown." },
  { vista: "rutas", icono: "mapa", color: "82, 183, 136", nombre: "Rutas",
    texto: "Marca dónde ya has hecho la captura en cada juego." },
  { vista: "levelcaps", icono: "escudo", color: "0, 184, 169", nombre: "Level caps",
    texto: "El nivel máximo antes de cada combate importante." },
  { vista: "pokedex", icono: "pokedex", color: "232, 82, 110", nombre: "Pokédex",
    texto: "Las estadísticas base de todos los Pokémon, para ordenar a tu gusto." },
  { vista: "calculadora", icono: "calculadora", color: "155, 110, 230", nombre: "Calculadora",
    texto: "Cuánto daño hace cada ataque y en cuántos golpes cae." },
  { vista: "randomizer", icono: "mezclar", color: "160, 205, 80", nombre: "Randomizer",
    texto: "Randomiza tu ROM de DS, 3DS o Switch sin que salga de tu navegador." },
  { vista: "ruleta", icono: "ruleta", color: "240, 150, 60", nombre: "Ruleta",
    texto: "Premios, castigos o lo que quieras: que decida la suerte." }
];

function plantillaBienvenida() {
  return `
    <section class="inicio-bloque inicio-bienvenida">
      <div class="inicio-bienvenida-texto">
        <h2>${t("Bienvenido a NuzTheLocke")}</h2>
        <p>${t(`Todo lo que necesitas para jugar <b>Nuzlockes</b> (y cualquier otro locke) en un solo
          sitio: tus equipos, las rutas, los level caps, una calculadora de daño, un randomizer…
          y lockes compartidos con tus amigos.`)}</p>
        <p>${t("Elige una sección a la derecha para empezar a explorar: cada una te lleva directa a su página.")}</p>
        ${hayNube()
          ? `<p class="inicio-bienvenida-cuenta">${t(`Casi todo funciona sin cuenta. Con sesión, tus equipos
              se guardan en la nube y desbloqueas los lockes con amigos, los perfiles y los logros.`)}</p>
            <button class="inicio-entrar grande">${icono("persona")} ${t("Iniciar sesión")}</button>`
          : ""}
      </div>
      <div class="inicio-bienvenida-secciones">
        ${SECCIONES.map(
          (cada) => `
            <button class="inicio-seccion" data-vista="${cada.vista}" style="--color-seccion: ${cada.color}">
              <span class="inicio-seccion-icono">${icono(cada.icono)}</span>
              <span class="inicio-seccion-datos">
                <strong>${t(cada.nombre)}</strong>
                <span>${t(cada.texto)}</span>
              </span>
            </button>`
        ).join("")}
      </div>
    </section>`;
}

// ---------- Pintar ----------

function conSesion() {
  return hayNube() && Boolean(usuarioActual());
}

// Sin sesión (y ya se sabe que no la hay, para que no salga un momento la bienvenida al entrar)
function invitado() {
  return !conSesion() && (!hayNube() || seSabeLaSesion());
}

function lockesEnMarcha() {
  return misLockes()
    .filter((locke) => locke.estado !== "cerrado")
    .sort((uno, otro) => (otro.actualizado || 0) - (uno.actualizado || 0));
}

function amigosConectados() {
  const perfiles = perfilesDeAmigos();
  return amigosAceptados()
    .map((amistad) => perfiles.get(amistad.otro))
    .filter((perfil) => perfil && estaConectado(perfil.uid))
    .sort((uno, otro) => (uno.nombre || "").localeCompare(otro.nombre || "", LOCALE));
}

function cara(nombre, foto, clase = "inicio-cara") {
  const inicial = escaparHTML(((nombre || "?").trim()[0] || "?").toUpperCase());
  return foto
    ? `<span class="${clase}"><img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-respaldo="" data-quitar-si-falla></span>`
    : `<span class="${clase} sin-foto">${inicial}</span>`;
}

function plantillaCabecera() {
  const perfil = miPerfil();
  const nombre = conSesion() ? (perfil && perfil.nombre) || "" : "";
  const pendientes = conSesion() ? invitacionesALockes().length + solicitudesRecibidas().length : 0;

  // A la derecha, con o sin sesión, cuánta gente se ha registrado (si ya hay un número que enseñar)
  const total = totalDeUsuarios();
  const usuarios = total !== null && total >= MINIMO_REGISTRADOS
    ? `<div class="inicio-usuarios" title="${t("Usuarios registrados")}">
         <b>${total.toLocaleString(LOCALE)}</b><span>${t("usuarios")}</span>
       </div>`
    : "";

  // Con sesión, un vistazo: cuántos lockes en marcha y cuántos amigos conectados
  let vistazo = "";
  if (conSesion()) {
    const lockes = lockesEnMarcha().length;
    const amigos = amigosConectados().length;
    vistazo = `
      <p class="inicio-resumen">
        <span><b>${lockes}</b> ${t(lockes === 1 ? "locke en marcha" : "lockes en marcha")}</span>
        <span class="${amigos ? "en-linea" : ""}"><b>${amigos}</b> ${t(amigos === 1 ? "amigo conectado" : "amigos conectados")}</span>
      </p>`;
  }

  return `
    <header class="inicio-cabecera">
      <img class="inicio-logo" src="img/icono.svg" alt="" style="animation-delay: -${(performance.now() % 6000) / 1000}s">
      <div class="inicio-saludo">
        <h1>${nombre ? t("Hola, {nombre}", { nombre: escaparHTML(nombre) }) : `NuzThe<span class="logo-locke">Locke</span>`}</h1>
        ${vistazo}
      </div>
      ${usuarios}
      ${pendientes
        ? `<button class="inicio-avisos">${icono("campana")} ${t("{n} sin contestar", { n: pendientes })}</button>`
        : ""}
    </header>`;
}

function plantillaLocke(locke) {
  const uid = usuarioActual().uid;
  const tipo = locke.tipo || { nombre: "Locke", color: "#3498db" };
  const juego = nombreJuego(locke);
  const jugadores = (locke.jugadores || []).filter((cada) => estadoDe(locke, cada) === "aceptado");
  // El tuyo, el primero
  jugadores.sort((uno, otro) => (otro === uid) - (uno === uid));

  const vidas = locke.vidasIlimitadas ? "∞" : (locke.vidas || {})[uid] || 0;
  const fuera = estaEliminado(locke, uid);
  const medallas = (locke.medallas || {})[uid] || {};
  const delJuego = medallasDelJuego(locke.juego, medallas.version).length;
  const conseguidas = (medallas.tiene || []).filter((i) => i < delJuego).length;

  return `
    <button class="inicio-locke" data-id="${escaparHTML(locke.id)}" style="--color-locke: ${colorDeTipo(tipo)}">
      <span class="inicio-locke-datos">
        <span class="inicio-locke-tipo">${escaparHTML(tipo.nombre)}</span>
        <strong class="inicio-locke-nombre">${escaparHTML(locke.nombre)}</strong>
        ${juego ? `<span class="inicio-locke-juego">${escaparHTML(juego)}</span>` : ""}
      </span>
      <span class="inicio-locke-caras">
        ${jugadores.map((cada) => cara((locke.nombres || {})[cada], (locke.fotos || {})[cada])).join("")}
      </span>
      <span class="inicio-locke-cifras">
        <span class="inicio-cifra victorias"><b>${victoriasDe(locke, uid)}</b><small>${t("Victorias")}</small></span>
        <span class="inicio-cifra vidas ${fuera ? "fuera" : ""}"><b>${fuera ? icono("calavera") : vidas}</b><small>${t("Vidas")}</small></span>
        ${delJuego ? `<span class="inicio-cifra medallas"><b>${conseguidas}/${delJuego}</b><small>${t("Medallas")}</small></span>` : ""}
      </span>
    </button>`;
}

function plantillaLockes() {
  const enMarcha = lockesEnMarcha();

  return `
    <section class="inicio-bloque inicio-lockes inicio-enlace" data-ir="lockes">
      <h2>${icono("espadas")} ${t("Lockes en marcha")}</h2>
      ${enMarcha.length
        ? `<div class="inicio-lista" data-total="${enMarcha.length}" data-modo="mas">${enMarcha.slice(0, MAX_LOCKES).map(plantillaLocke).join("")}</div>`
        : `<p class="inicio-vacio">${t("Ninguno ahora mismo.")}</p>`}
      ${enMarcha.length ? `<div class="inicio-pie"><button class="inicio-ver-resto" data-vista="lockes" hidden></button></div>` : ""}
    </section>`;
}

function plantillaAmigos() {
  const conectados = amigosConectados();

  return `
    <section class="inicio-bloque inicio-amigos inicio-enlace" data-ir="amigos">
      <h2>${icono("amigos")} ${t("Conectados")}</h2>
      ${conectados.length
        ? `<div class="inicio-amigos-lista">${conectados
            .map(
              (perfil) => `
                <button class="inicio-amigo" data-perfil="${escaparHTML(perfil.uid)}" title="${t("Ver perfil")}">
                  ${cara(perfil.nombre, perfil.foto, `inicio-cara grande ${claseMarco(marcoDe(perfil))}`)}
                  <span>${escaparHTML(perfil.nombre || t("Amigo"))}</span>
                </button>`
            )
            .join("")}</div>`
        : `<p class="inicio-vacio">${amigosAceptados().length ? t("Nadie ahora mismo.") : t("Aún no tienes amigos.")}</p>`}
    </section>`;
}

// Los últimos que has guardado o cambiado; pulsando uno se va a «Mis equipos»
function plantillaEquipos() {
  const equipos = (leerGuardados() || [])
    .filter((equipo) => equipo && (equipo.pokemon || []).length)
    .sort((uno, otro) => (otro.actualizado || 0) - (uno.actualizado || 0));

  return `
    <section class="inicio-bloque inicio-equipos inicio-enlace" data-ir="equipos">
      <h2>${icono("pokeball")} ${t("Últimos equipos")}</h2>
      ${equipos.length
        ? `<div class="inicio-lista" data-total="${equipos.length}" data-modo="total">${equipos
            .slice(0, MAX_EQUIPOS)
            .map(
              (equipo) => `
                <button class="inicio-equipo" data-vista="equipos">
                  <strong>${escaparHTML(equipo.nombre || t("Equipo"))}</strong>
                  ${carasDeEquipo(equipo)}
                </button>`
            )
            .join("")}</div>`
        : `<p class="inicio-vacio">${t("Ninguno guardado.")}</p>`}
    </section>`;
}

// Sugerencias: un cuadro de texto que llega por correo (formsubmit.co)
function plantillaSugerencias() {
  return `
    <section class="inicio-bloque inicio-sugerencias">
      <h2>${icono("sobre")} ${t("Enviar sugerencia")}</h2>
      <p class="inicio-nota">${t("¿Una idea, un fallo o cualquier comentario sobre la web? ¡Escríbeme!")}</p>
      <form class="sugerencias-form">
        <textarea class="sugerencias-texto" rows="4" maxlength="3000"
          placeholder="${t("Escribe aquí tu comentario o sugerencia…")}" required></textarea>
        <div class="inicio-pie">
          <span class="sugerencias-aviso" role="status"></span>
          <button type="submit" class="inicio-principal">${icono("enviar")} ${t("Enviar")}</button>
        </div>
      </form>
    </section>`;
}

function pintar() {
  if (seccion.hidden) return;

  // Se repinta solo a menudo (alguien se conecta...): que no se pierda lo que estabas escribiendo
  const cuadro = seccion.querySelector(".sugerencias-texto");
  const borrador = cuadro ? cuadro.value : "";
  const escribiendo = cuadro && document.activeElement === cuadro;
  const seleccion = escribiendo ? [cuadro.selectionStart, cuadro.selectionEnd] : null;
  const aviso = seccion.querySelector(".sugerencias-aviso");
  const avisoAntes = aviso ? aviso.outerHTML : "";

  const pie = `
    <div class="inicio-columnas inicio-fila-baja">
      ${plantillaAvisos()}
      <div class="inicio-lado">${plantillaSugerencias()}</div>
    </div>`;

  // Con o sin sesión, la pantalla justa: sin scroll (css/inicio.css, «Con sesión, sin scroll»)
  seccion.classList.add("inicio-fijo");
  seccion.classList.toggle("inicio-invitado", invitado());
  seccion.innerHTML = `
    ${plantillaCabecera()}
    ${invitado() ? plantillaBienvenida() : ""}
    ${conSesion()
      ? `<div class="inicio-columnas">
           <div class="inicio-lado inicio-izq">${plantillaLockes()}${plantillaNovedades()}</div>
           <div class="inicio-lado">${plantillaAmigos()}${plantillaEquipos()}</div>
         </div>`
      : ""}
    ${pie}`;

  const nuevo = seccion.querySelector(".sugerencias-texto");
  nuevo.value = borrador;
  if (seleccion) {
    nuevo.focus();
    nuevo.setSelectionRange(...seleccion);
  }
  if (avisoAntes) seccion.querySelector(".sugerencias-aviso").outerHTML = avisoAntes;
  seccion.querySelector(".sugerencias-form button").disabled = enviando;
  ajustarListas();
}

// Nada de desplazarse dentro de las tarjetas: cada lista enseña las que caben en su hueco (el
// que le deja la pantalla) y esconde el resto; el botón de «Ver todos» cuenta las que faltan.
// En el móvil (la sección baja entera, sin alto fijo) se enseñan todas las pintadas.
const PANTALLA_FIJA = window.matchMedia("(min-width: 761px)");

function ajustarListas() {
  if (!seccion || seccion.hidden) return;

  for (const lista of seccion.querySelectorAll(".inicio-lista, .inicio-amigos-lista")) {
    const elementos = [...lista.children];
    for (const elemento of elementos) elemento.hidden = false;

    let visibles = elementos.length;
    if (PANTALLA_FIJA.matches) {
      while (visibles > 1 && lista.scrollHeight > lista.clientHeight + 1) {
        elementos[--visibles].hidden = true;
      }
    }

    const boton = lista.closest(".inicio-bloque").querySelector(".inicio-ver-resto");
    if (!boton) continue;
    const total = Number(lista.dataset.total) || elementos.length;
    const faltan = total - visibles;
    boton.hidden = faltan <= 0;
    boton.textContent = lista.dataset.modo === "mas"
      ? t("Ver todos ({n} más)", { n: faltan })
      : t("Ver todos ({n})", { n: total });
  }
}

// ---------- Enviar una sugerencia ----------

let enviando = false;

function avisoSugerencia(texto, clase = "") {
  const aviso = seccion.querySelector(".sugerencias-aviso");
  if (!aviso) return;
  aviso.className = `sugerencias-aviso ${clase}`;
  aviso.textContent = texto;
}

async function enviarSugerencia() {
  const cuadro = seccion.querySelector(".sugerencias-texto");
  const texto = cuadro.value.trim();
  if (!texto || enviando) return;

  enviando = true;
  seccion.querySelector(".sugerencias-form button").disabled = true;
  avisoSugerencia(t("Enviando…"));

  try {
    const respuesta = await fetch("https://formsubmit.co/ajax/alfdelgar@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "Sugerencia de NuzTheLocke",
        message: texto,
        usuario: conSesion() ? (miPerfil() && miPerfil().nombre) || "Usuario registrado" : "Anónimo"
      })
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    seccion.querySelector(".sugerencias-texto").value = "";
    avisoSugerencia(t("¡Gracias! Mensaje enviado."), "ok");
  } catch (error) {
    console.error(error);
    avisoSugerencia(t("No se pudo enviar. Inténtalo más tarde."), "error");
  } finally {
    enviando = false;
    const boton = seccion.querySelector(".sugerencias-form button");
    if (boton) boton.disabled = false;
  }
}

// ---------- Ir a un sitio ----------

// A «Lockes» y, si está en la lista, hasta ese locke (se ilumina un momento)
async function irAlLocke(id) {
  await irA("lockes");
  const tarjeta = document.querySelector(`#vista-lockes .locke[data-id="${CSS.escape(id)}"]`);
  if (!tarjeta) return;
  tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
  tarjeta.classList.remove("resaltado");
  void tarjeta.offsetWidth; // para que la animación vuelva a empezar
  tarjeta.classList.add("resaltado");
}

async function nuevoLocke() {
  await irA("lockes");
  const boton = document.querySelector("#nuevo-locke");
  if (boton && !boton.hidden) boton.click();
}

// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-inicio");

  seccion.addEventListener("click", (e) => {
    if (e.target.closest(".inicio-novedades-todas")) return abrirNovedades();
    const locke = e.target.closest(".inicio-locke");
    if (locke) return irAlLocke(locke.dataset.id);
    const destino = e.target.closest("[data-vista]");
    if (destino) return irA(destino.dataset.vista);
    if (e.target.closest(".inicio-nuevo")) return nuevoLocke();
    if (e.target.closest(".inicio-avisos")) return document.querySelector(".avisos-boton:not(.chat-boton)").click();
    if (e.target.closest(".inicio-entrar")) return document.querySelector(".sesion-boton").click();
    // El resto de un bloque (Lockes, Conectados, Últimos equipos) lleva a su sección
    const bloque = e.target.closest("[data-ir]");
    if (bloque && !e.target.closest("button, a")) return irA(bloque.dataset.ir);
  });

  seccion.addEventListener("submit", (e) => {
    if (!e.target.matches(".sugerencias-form")) return;
    e.preventDefault();
    enviarSugerencia();
  });

  // Todo en vivo: se repinta solo mientras se ve
  alCambiarSesion(pintar);
  alCambiarMiPerfil(pintar);
  alCambiarLockes(pintar);
  alCambiarAmistades(pintar);
  alCambiarPerfilesAmigos(pintar);
  alCambiarPresencia(pintar);
  alCambiarTotalDeUsuarios(pintar);

  // Al cambiar el tamaño de la ventana (o cuando llegan las letras) cambia lo que cabe
  let esperando = false;
  const reajustar = () => {
    if (esperando) return;
    esperando = true;
    requestAnimationFrame(() => {
      esperando = false;
      ajustarListas();
    });
  };
  window.addEventListener("resize", reajustar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reajustar);
}

export function mostrar() {
  pintar();
  requestAnimationFrame(ajustarListas); // por si la sección acaba de aparecer
}