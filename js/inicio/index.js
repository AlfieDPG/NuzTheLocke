// Sección «Inicio»: lo primero que se ve al entrar y al pulsar el logo.
//
//   · Arriba, el saludo y, a la derecha, las notificaciones sin contestar (abre la campana) y los
//     usuarios registrados (siempre en la esquina).
//   · «Hoy»: una franja con los retos de hoy, la racha, tu saldo y, si la hay, la última partida de
//     «Jugar» para seguir.
//   · Tus lockes en marcha (uno a la vista y «Ver todos»): pulsando uno se va a él en «Lockes».
//   · Novedades y avisos juntos: los avisos fijados («Ya lo he leído» los quita hasta que cambien)
//     y las novedades, tantas como quepan.
//   · A la derecha: los amigos conectados (cinco y «+N»), tus últimos equipos y un cuadro para
//     mandar sugerencias.
//
// Sin sesión, en vez de los lockes y los amigos, una bienvenida que explica la web (con sus
// secciones) y el botón de «Iniciar sesión».

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { marcoDe, claseMarco } from "../comun/fichas.js";
import { t, segunIdioma, LOCALE } from "../comun/idioma.js";
import { hayNube, usuarioActual, alCambiarSesion, seSabeLaSesion } from "../comun/nube.js";
import { nombreJuego } from "../comun/campo-juego.js";
import { carasDeEquipo, caraDePokemon } from "../comun/elegir-equipo.js";
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
import { medallasDelLocke } from "../comun/medallas.js";
import { leer, escribir } from "../comun/almacen.js";
import { saldo, rachaDe, bonoRacha, hoy, lunesDe } from "../comun/fichas.js";
import { estadoDe as estadoDeReto, TODOS_LOS_RETOS } from "../juegos/comun.js";
import { listaDePartidas } from "../jugar/partidas.js";

let seccion = null;

const MAX_LOCKES = 12; // los que se pintan; a la vista, los que caben (ajustarListas; el resto, en «Ver todos»)
const NOVEDADES_MIN_FILAS = 2; // las filas de novedades que se respetan al dar sitio a más lockes
const MAX_EQUIPOS = 10;
const AMIGOS_A_LA_VISTA = 5; // los conectados que salen; si hay más, un «+N»
const CLAVE_AVISOS_LEIDOS = "poketeams-avisos-leidos-v1";
const CLAVE_JUGAR = "poketeams-jugar-v1"; // lo que se le pide a «Jugar» al llegar (js/jugar/index.js)

// El número de registrados solo sale a partir de aquí (con pocos, queda peor que no ponerlo).
// Para esconderlo del todo, súbelo a un número que no se vaya a alcanzar.
const MINIMO_REGISTRADOS = 50;

// ---------- Avisos (los escribe el desarrollador; los ven todos) ----------
//
// AVISOS: un punto cada uno, con su icono (de js/comun/iconos.js) y un color en «r, g, b». El texto
// admite HTML (<b>, <a>...). Cada texto va en español (es) y en inglés (en); si falta el inglés,
// sale en español. Con sesión van fijados dentro de «Novedades y avisos» y «Ya lo he leído» los
// esconde hasta que cambie alguno (se recuerda en este navegador); sin sesión, en su propio bloque.

const AVISOS = [
  {
    icono: "mezclar", color: "160, 205, 80",
    es: `El <b>Randomizer</b> funciona con ROMs de <b>GBA, NDS, 3DS y Switch</b>, y necesitas las tuyas.`,
    en: `The <b>Randomizer</b> works with <b>GBA, NDS, 3DS and Switch</b> ROMs, and you need your own.`
  },
  {
    icono: "enlace", color: "224, 90, 74",
    es: `Puedes <b>vincular tu partida</b> a un locke y se apunta todo solo.`,
    en: `You can <b>link your save file</b> to a locke and everything is recorded automatically.`
  },
  {
    icono: "ayuda", color: "106, 159, 224",
    es: `¿Dudas? Las <b>preguntas frecuentes</b> están en el <b>«?»</b> del menú (en el móvil, en «Más»).`,
    en: `Questions? The <b>FAQ</b> is under the <b>“?”</b> in the menu (on mobile, under “More”).`
  },
  {
    icono: "aviso", color: "240, 196, 60",
    es: `La web está en <b>desarrollo</b>: si algo falla, cuéntamelo en sugerencias.`,
    en: `The site is <b>in development</b>: if something breaks, tell me in the suggestions box.`
  }
];

// Una firma de los avisos: si cambian, vuelven a salir aunque se hayan marcado como leídos
function firmaAvisos() {
  const texto = AVISOS.map((aviso) => aviso.es).join("|");
  let h = 0;
  for (const letra of texto) h = (Math.imul(h, 31) + letra.charCodeAt(0)) | 0;
  return String(h);
}

const avisosLeidos = () => leer(CLAVE_AVISOS_LEIDOS, "") === firmaAvisos();

// ---------- Novedades ----------
//
// Lo último que ha salido, en el orden en que se enseña (lo más importante, primero: no tiene por
// qué ir por fechas). En Inicio salen las que caben (ajustarListas) y todas en «Ver todas».
// Cada una lleva a su sección (vista) al pulsarla, con su icono y el color de esa sección. Mismo
// formato de textos que los avisos.

const NOVEDADES = [
  {
    fecha: "2026-11-12", vista: "inicio", icono: "casa", color: "231, 76, 60",
    es: `La web, <b>adaptada al móvil</b>: las secciones de más uso en una barra abajo y el resto en «Más».
      «Atrás» ya no te saca de la web, y las preguntas frecuentes («?») tienen buscador.`,
    en: `The site, <b>adapted for mobile</b>: the most used sections in a bar at the bottom and the rest under
      “More”. “Back” no longer takes you out of the site, and the FAQ (“?”) has a search box.`
  },
  {
    fecha: "2026-11-12", vista: "foro", icono: "mensaje", color: "196, 128, 214",
    es: `<b>Foro</b> renovado: responde a un mensaje concreto (y a quien le respondas le llega a la
      campana), pide unirte a los grupos de «Busco compañeros» y silencia los hilos que no te interesen.`,
    en: `Revamped <b>Forum</b>: reply to a specific message (they get it in their bell), ask to join
      «Looking for players» groups and mute threads you don't care about.`
  },
  {
    fecha: "2026-11-12", vista: "tienda", icono: "tienda", color: "200, 118, 74",
    es: `La <b>Tienda</b> y los huevos tienen su propia sección. Y ahora terminar un locke da
      Pokédólares: 500 al ganador, 300 al segundo, 150 al tercero y 50 al resto (también los que ya acabaste).`,
    en: `The <b>Shop</b> and eggs have their own section. And finishing a locke now gives Pokédollars:
      500 to the winner, 300 to second, 150 to third and 50 to everyone else (also the ones you already finished).`
  },
  {
    fecha: "2026-11-02", vista: "lucha", icono: "lucha", color: "222, 112, 52",
    es: `Nueva sección <b>Combates</b> (en pruebas): reta a un amigo y combatid sin salir de la web,
      también en los combates de tus lockes.`,
    en: `New <b>Battles</b> section (in testing): challenge a friend and battle without leaving the
      site, also in your lockes' battles.`
  },
  {
    fecha: "2026-11-02", vista: "lockes", icono: "enlace", color: "214, 88, 76",
    es: `Nuevo juego: <b>Pokémon GS Vitro</b>. Vincula y edita tu partida, con sus rutas y sus
      level caps.`,
    en: `New game: <b>Pokémon GS Vitro</b>. Link and edit your save, with its routes and level
      caps.`
  },
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

// Novedades y avisos, juntos: los avisos fijados arriba y, debajo, las novedades en rejilla
function plantillaNovedades() {
  const fijados = AVISOS.length && !avisosLeidos()
    ? `<div class="inicio-fijado">
         <div class="inicio-fijado-cabeza">
           ${icono("chincheta")} ${t("PARA TENER EN CUENTA")}
           <button class="inicio-leido">${t("Ya lo he leído")}</button>
         </div>
         <ul class="inicio-fijado-lista">${AVISOS.map(
           (aviso) => `
             <li style="--color-aviso: ${aviso.color}">
               <span class="inicio-aviso-icono">${icono(aviso.icono)}</span>
               <span>${segunIdioma(aviso.es, aviso.en)}</span>
             </li>`
         ).join("")}</ul>
       </div>`
    : "";
  if (!NOVEDADES.length && !fijados) return "";
  return `
    <section class="inicio-bloque inicio-novedades">
      <h2>
        ${icono("estrella")} ${t("Novedades y avisos")}
        ${NOVEDADES.length ? `<button class="inicio-ver-todo inicio-novedades-todas">${t("Ver todas ({n})", { n: NOVEDADES.length })}${icono("derecha")}</button>` : ""}
      </h2>
      ${fijados}
      <ul class="inicio-novedades-lista" data-max-movil="3">${NOVEDADES.map(plantillaNovedad).join("")}</ul>
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

// Sin sesión: los avisos, en su propio bloque
function plantillaAvisos() {
  if (!AVISOS.length) return "";

  return `
    <section class="inicio-bloque inicio-avisos-web">
      <h2>${icono("campana")} ${t("Notas y avisos")}</h2>
      <ul class="inicio-avisos-lista">${AVISOS.map(
        (aviso) => `
          <li style="--color-aviso: ${aviso.color}">
            <span class="inicio-aviso-icono">${icono(aviso.icono)}</span>
            <span>${segunIdioma(aviso.es, aviso.en)}</span>
          </li>`
      ).join("")}</ul>
    </section>`;
}

// ---------- Bienvenida (sin sesión) ----------

// Lo que hay en la web, con el icono y el color de su sección; pulsando uno se va a ella
const SECCIONES = [
  { vista: "lockes", icono: "espadas", color: "214, 88, 76", nombre: "Lockes",
    texto: "Juega con amigos: vidas, muertes y victorias, y tu partida vinculada al momento." },
  { vista: "jugar", icono: "consola", color: "186, 62, 102", nombre: "Jugar",
    texto: "Juega a Rojo Fuego, Verde Hoja y los de DS desde la web, y emite tu partida a tus amigos." },
  { vista: "randomizer", icono: "mezclar", color: "160, 205, 80", nombre: "Randomizer",
    texto: "Randomiza tu ROM de GBA, DS, 3DS o Switch sin que salga de tu navegador." },
  { vista: "crear", icono: "pokeball", color: "64, 112, 214", nombre: "Equipos",
    texto: "Monta tus equipos, guárdalos e importa o exporta pastes de Showdown." },
  { vista: "rutas", icono: "mapa", color: "82, 183, 136", nombre: "Rutas",
    texto: "Marca dónde ya has hecho la captura en cada juego." },
  { vista: "levelcaps", icono: "escudo", color: "0, 184, 169", nombre: "Level caps",
    texto: "El nivel máximo antes de cada combate importante." },
  { vista: "pokedex", icono: "pokedex", color: "232, 82, 110", nombre: "Pokédex",
    texto: "Las estadísticas base de todos los Pokémon, para ordenar a tu gusto." },
  { vista: "calculadora", icono: "calculadora", color: "155, 110, 230", nombre: "Calculadora",
    texto: "Cuánto daño hace cada ataque y en cuántos golpes cae." },
  { vista: "lucha", icono: "lucha", color: "222, 112, 52", nombre: "Combates",
    texto: "Reta a un amigo con tus equipos y combatid por turnos sin salir de la web." },
  { vista: "foro", icono: "mensaje", color: "196, 128, 214", nombre: "Foro",
    texto: "Busca compañeros para tu próximo locke, pide ayuda o charla." },
  { vista: "juegos", icono: "mando", color: "76, 182, 92", nombre: "Juegos",
    texto: "Retos diarios que dan Pokédólares para la Tienda y huevos para tu colección." },
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
        <p>${t("Elige una sección para empezar a explorar: cada una te lleva directa a su página.")}</p>
        ${hayNube()
          ? `<p class="inicio-bienvenida-cuenta">${t(`Casi todo funciona sin cuenta. Con sesión, tus equipos
              se guardan en la nube y desbloqueas los lockes con amigos, los perfiles y los logros.`)}</p>
            <button class="inicio-entrar grande">${icono("persona")} ${t("Iniciar sesión")}</button>`
          : ""}
      </div>
      <div class="inicio-bienvenida-secciones">
        ${SECCIONES.map(
          (cada) => `
            <button class="inicio-seccion" data-vista="${cada.vista}" style="--color-seccion: ${cada.color}" title="${t(cada.texto)}">
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

// El cuaderno del logo del menú (index.html), con los marcapáginas asomando por turnos. La fase
// sigue el reloj para que la animación no vuelva a empezar cada vez que se repinta Inicio.
function cuadernoDelSaludo() {
  const dibujo = document.querySelector(".logo svg").cloneNode(true);
  dibujo.setAttribute("class", "inicio-logo");
  dibujo.style.setProperty("--fase", `-${(performance.now() % 8000) / 1000}s`);
  for (const marca of dibujo.querySelectorAll(".fuera")) marca.classList.remove("fuera");
  return dibujo.outerHTML;
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
      ${cuadernoDelSaludo()}
      <div class="inicio-saludo">
        <h1>${nombre ? t("Hola, {nombre}", { nombre: escaparHTML(nombre) }) : `NuzThe<span class="logo-locke">Locke</span>`}</h1>
        ${vistazo}
      </div>
      ${pendientes
        ? `<button class="inicio-avisos">${icono("campana")} ${t("{n} sin contestar", { n: pendientes })}</button>`
        : ""}
      ${usuarios}
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
  const delJuego = medallasDelLocke(locke, medallas.version).length;
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
      <h2>
        ${icono("espadas")} ${t("Lockes en marcha")}
        ${enMarcha.length ? `<button class="inicio-ver-todo inicio-ver-resto" data-vista="lockes" hidden></button>` : ""}
      </h2>
      ${enMarcha.length
        ? `<div class="inicio-lista" data-total="${enMarcha.length}" data-modo="mas">${enMarcha.slice(0, MAX_LOCKES).map(plantillaLocke).join("")}</div>`
        : `<p class="inicio-vacio">${t("Ninguno ahora mismo.")}</p>
           <div class="inicio-pie"><button class="inicio-nuevo inicio-principal">${icono("mas")} ${t("Nuevo locke")}</button></div>`}
    </section>`;
}

function plantillaAmigos() {
  const conectados = amigosConectados();
  const resto = conectados.length - AMIGOS_A_LA_VISTA;

  return `
    <section class="inicio-bloque inicio-amigos inicio-enlace" data-ir="amigos">
      <h2>${icono("amigos")} ${t("Conectados")}</h2>
      ${conectados.length
        ? `<div class="inicio-amigos-lista">${conectados
            .slice(0, AMIGOS_A_LA_VISTA)
            .map(
              (perfil) => `
                <button class="inicio-amigo" data-perfil="${escaparHTML(perfil.uid)}" title="${t("Ver perfil")}">
                  ${cara(perfil.nombre, perfil.foto, `inicio-cara grande ${claseMarco(marcoDe(perfil))}`)}
                  <span>${escaparHTML(perfil.nombre || t("Amigo"))}</span>
                </button>`
            )
            .join("")}${resto > 0
            ? `<button class="inicio-amigo inicio-amigos-mas" data-vista="amigos" title="${t("Ver todos")}"><span class="inicio-mas-gente">+${resto}</span></button>`
            : ""}</div>`
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

// ---------- Hoy ----------

function moverDia(dia, cuantos) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cuantos);
  return fecha.toISOString().slice(0, 10);
}

const numero = (n) => n.toLocaleString(LOCALE);

// La última partida de «Jugar» (se lee de IndexedDB, así que llega algo después de pintar)
let ultimaPartida = null;

function cuando(fecha) {
  const minutos = Math.round((Date.now() - fecha) / 60000);
  if (minutos < 1) return t("ahora mismo");
  if (minutos < 60) return t("hace {n} min", { n: minutos });
  const horas = Math.round(minutos / 60);
  if (horas < 24) return horas === 1 ? t("hace 1 hora") : t("hace {n} horas", { n: horas });
  return new Date(fecha).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

async function leerUltimaPartida() {
  let nueva = null;
  try {
    const p = (await listaDePartidas()).find((cada) => cada.jugada);
    if (p) {
      const { portadaDe } = await import("../jugar/portadas.js");
      nueva = { id: p.id, nombre: p.nombre, jugada: p.jugada, especie: portadaDe(p, null).especie };
    }
  } catch (error) {
    console.error(error);
  }
  const igual = (nueva && nueva.id) === (ultimaPartida && ultimaPartida.id) && (nueva && nueva.jugada) === (ultimaPartida && ultimaPartida.jugada);
  ultimaPartida = nueva;
  if (!igual) pintar();
}

function plantillaHoy() {
  const perfil = miPerfil();
  const hechos = TODOS_LOS_RETOS.filter((juego) => estadoDeReto(juego).fin).length;
  const racha = rachaDe(perfil);
  const bono = bonoRacha(racha + 1);

  // La semana de lunes a domingo: los días de la racha, hoy y los que quedan
  const dia = hoy();
  const lunes = lunesDe(dia);
  const ultimoDia = (perfil && perfil.juegos && perfil.juegos.dia) || dia;
  const jugados = new Set(Array.from({ length: racha }, (_, i) => moverDia(ultimoDia, -i)));
  const letras = [t("dia|L"), t("dia|M"), t("dia|X"), t("dia|J"), t("dia|V"), t("dia|S"), t("dia|D")];
  const semana = letras
    .map((letra, i) => {
      const cada = moverDia(lunes, i);
      return `<span class="${cada === dia ? "hoy-dia" : jugados.has(cada) ? "si" : ""}">${letra}</span>`;
    })
    .join("");

  const sellos = TODOS_LOS_RETOS.map((_, i) => `<span class="${i < hechos ? "ok" : ""}"></span>`).join("");

  const partida = ultimaPartida
    ? `<div class="inicio-hoy-parte inicio-hoy-partida">
         <span class="inicio-hoy-portada">${caraDePokemon({ id: ultimaPartida.especie, nombre: "" })}</span>
         <span class="inicio-hoy-texto">
           <span class="inicio-hoy-etiqueta">${t("Seguir jugando")}</span>
           <strong>${escaparHTML(ultimaPartida.nombre)}</strong>
           <span class="inicio-hoy-nota">${cuando(ultimaPartida.jugada)}</span>
         </span>
         <button class="inicio-hoy-boton continuar" data-partida="${escaparHTML(ultimaPartida.id)}">${icono("reanudar")} ${t("Continuar")}</button>
       </div>`
    : "";

  return `
    <section class="inicio-hoy ${ultimaPartida ? "" : "sin-partida"}" aria-label="${t("Hoy")}">
      <div class="inicio-hoy-parte">
        <span class="inicio-hoy-texto">
          <span class="inicio-hoy-etiqueta">${t("Retos de hoy")}</span>
          <span class="inicio-hoy-grande">${hechos} <small>${t("de {n}", { n: TODOS_LOS_RETOS.length })}</small></span>
        </span>
        <span class="inicio-hoy-sellos" aria-hidden="true">${sellos}</span>
        <button class="inicio-hoy-boton seguir" data-vista="juegos">${hechos === TODOS_LOS_RETOS.length ? t("Ver") : t("Seguir")}${icono("derecha")}</button>
      </div>
      <div class="inicio-hoy-parte">
        <span class="inicio-hoy-rayo">${icono("rayo")}</span>
        <span class="inicio-hoy-texto">
          <span class="inicio-hoy-etiqueta">${bono ? t("Racha · +{n} por reto", { n: bono }) : t("Racha")}</span>
          <span class="inicio-hoy-grande">${t(racha === 1 ? "{n} día" : "{n} días", { n: racha })}</span>
          <span class="inicio-hoy-semana" aria-hidden="true">${semana}</span>
        </span>
      </div>
      <div class="inicio-hoy-parte">
        <span class="inicio-hoy-texto">
          <span class="inicio-hoy-etiqueta">${t("Tu saldo")}</span>
          <span class="inicio-hoy-grande"><span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(saldo(perfil))}</span></span>
        </span>
        <button class="inicio-hoy-ir" data-vista="tienda" aria-label="${t("Ir a la Tienda")}" title="${t("Ir a la Tienda")}">${icono("tienda")}${icono("derecha")}</button>
      </div>
      ${partida}
    </section>`;
}

// Sugerencias: un cuadro de texto que se guarda en Firestore y lee el administrador en la pestaña
// «Sugerencias» del foro (js/comun/sugerencias.js)
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

  // Sin sesión, abajo, los avisos y las sugerencias
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
      ? `${plantillaHoy()}
         <div class="inicio-columnas">
           <div class="inicio-lado inicio-izq">${plantillaLockes()}${plantillaNovedades()}</div>
           <div class="inicio-lado">${plantillaAmigos()}${plantillaEquipos()}${plantillaSugerencias()}</div>
         </div>`
      : pie}`;

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

// Nada de desplazarse dentro de las tarjetas: cada lista enseña las que caben ENTERAS en su hueco
// (el que le deja la pantalla) y esconde el resto; el botón de «Ver todos» (a la derecha del título)
// cuenta las que faltan. En el móvil (la sección baja entera, sin alto fijo) se enseñan todas las
// pintadas (las novedades, solo unas pocas: data-max-movil).
//
// A la izquierda, lockes y novedades se reparten el alto: las novedades en rejilla, con filas
// enteras. Se enseñan todos los lockes que caben mientras las novedades conserven sus
// NOVEDADES_MIN_FILAS filas; con un solo locke (o al marcar los avisos como leídos), las novedades
// se llevan el sitio que sobra y enseñan más filas.
const PANTALLA_FIJA = window.matchMedia("(min-width: 761px)");

function esconderLosQueNoCaben(lista) {
  const elementos = [...lista.children];
  for (const elemento of elementos) elemento.hidden = false;
  let visibles = elementos.length;
  if (!PANTALLA_FIJA.matches) {
    const tope = Number(lista.dataset.maxMovil);
    if (tope && visibles > tope) {
      visibles = tope;
      for (let i = visibles; i < elementos.length; i++) elementos[i].hidden = true;
    }
    return visibles;
  }
  while (visibles > 0 && lista.scrollHeight > lista.clientHeight + 1) {
    elementos[--visibles].hidden = true;
  }
  // En rejilla, filas enteras (que no quede una fila a medias)
  const columnas = getComputedStyle(lista).gridTemplateColumns.split(" ").length;
  if (lista.classList.contains("inicio-novedades-lista") && columnas > 1 && visibles > columnas) {
    const entero = visibles - (visibles % columnas);
    for (let i = entero; i < visibles; i++) elementos[i].hidden = true;
    visibles = entero;
  }
  return visibles;
}

function textoVerTodos(lista, visibles) {
  const boton = lista.closest(".inicio-bloque").querySelector(".inicio-ver-resto");
  if (!boton) return;
  const total = Number(lista.dataset.total) || lista.children.length;
  const faltan = total - visibles;
  boton.hidden = faltan <= 0;
  boton.innerHTML = (lista.dataset.modo === "mas" && visibles
    ? t("Ver todos ({n} más)", { n: faltan })
    : t("Ver todos ({n})", { n: total })) + icono("derecha");
}

function ajustarListas() {
  if (!seccion || seccion.hidden) return;
  const lockes = seccion.querySelector(".inicio-lockes .inicio-lista");
  const novedades = seccion.querySelector(".inicio-novedades .inicio-novedades-lista");

  for (const lista of seccion.querySelectorAll(".inicio-lista, .inicio-amigos-lista, .inicio-novedades-lista")) {
    if (lista === lockes || lista === novedades) continue;
    textoVerTodos(lista, esconderLosQueNoCaben(lista));
  }

  if (novedades) esconderLosQueNoCaben(novedades);
  if (!lockes) return;
  const hijos = [...lockes.children];
  if (!PANTALLA_FIJA.matches) {
    for (const hijo of hijos) hijo.hidden = false;
    textoVerTodos(lockes, hijos.length);
    return;
  }
  const columnas = novedades ? getComputedStyle(novedades).gridTemplateColumns.split(" ").length : 1;
  let visibles = hijos.length;
  for (; visibles > 1; visibles--) {
    hijos.forEach((hijo, i) => { hijo.hidden = i >= visibles; });
    if (!novedades) break;
    const filas = Math.floor(esconderLosQueNoCaben(novedades) / columnas);
    if (filas >= NOVEDADES_MIN_FILAS || filas * columnas >= novedades.children.length) break;
  }
  hijos.forEach((hijo, i) => { hijo.hidden = i >= visibles; });
  if (novedades) esconderLosQueNoCaben(novedades);
  textoVerTodos(lockes, visibles);
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
    const { enviarSugerencia: guardar } = await import("../comun/sugerencias.js");
    await guardar(texto, conSesion() ? (miPerfil() && miPerfil().nombre) || "" : "");
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
    if (e.target.closest(".inicio-leido")) {
      escribir(CLAVE_AVISOS_LEIDOS, firmaAvisos());
      return pintar();
    }
    const continuar = e.target.closest(".inicio-hoy-boton.continuar");
    if (continuar) {
      escribir(CLAVE_JUGAR, { partida: continuar.dataset.partida });
      return irA("jugar");
    }
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
  // Un reto terminado cambia «Hoy» (el mismo aviso que usa la sección Juegos)
  document.addEventListener("reto-cambiado", pintar);

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
  leerUltimaPartida();
  requestAnimationFrame(ajustarListas); // por si la sección acaba de aparecer
}