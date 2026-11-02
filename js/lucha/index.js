// ---------- Lucha: combates entre amigos (la pantalla) ----------
//
// Dos vistas dentro de la sección:
//   · La lista: retos que te mandan (aceptar con un equipo o rechazar), luchas en marcha (con «Te
//     toca» si te toca elegir), retos que has mandado y las terminadas. Arriba, «Retar a un amigo».
//   · El combate: el campo con los dos Pokémon (sprites animados de la 5.ª gen y, en las fichas,
//     sus retratos de Mundo Misterioso), lo que pasa contado en frases, los botones para elegir y,
//     al lado, el registro de todos los turnos.
//
// El combate lo calcula el motor de Showdown en este navegador (js/lucha/combate.js) y aquí solo se
// mandan y se reciben las elecciones (js/comun/luchas.js, que explica el sello). El motor pesa: se
// descarga la primera vez que hace falta (al retar, aceptar o abrir un combate), no al entrar.
//
// Desde «Lockes», cada combate de un locke tiene «Lucha» para retar al rival en ese combate: al
// terminar, la victoria se suma sola en ese combate del locke (sumarVictoriaCombate).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { t, enIngles } from "../comun/idioma.js";
import { usuarioActual, hayNube } from "../comun/nube.js";
import { claseMarcoDe, plantillaTituloDeUid, fondoVisualDe } from "../comun/fichas.js";
import { amigosAceptados, perfilesDeAmigos, alCambiarPerfilesAmigos } from "../comun/perfiles.js";
import { lockes, combatesDe, nombreCombate, estadoDe, lockePorId, sumarVictoriaCombate } from "../comun/lockes.js";
import { generacionDeJuego } from "../comun/juegos.js";
import { elegirEquipo, carasDeEquipo, caraDePokemon } from "../comun/elegir-equipo.js";
import { pokemonParaCopia } from "../comun/pokemon.js";
import { pasteDelEquipo } from "../equipos/exportar.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { cargarDatos, datos as datosWeb, buscarPorNombreIngles } from "../comun/datos.js";
import { coloresTipo, iconoTipo, tiposEs } from "../comun/tipos.js";
import { imagenConRespaldo } from "../comun/imagenes.js";
import { pedirVariedad, descripcionAtaque } from "../comun/pokemon.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { filaStat } from "../comun/fichas-pokemon.js";
import { activarTooltips, actualizarTooltip, ocultarTooltip } from "../comun/tooltip.js";
import {
  alCambiarLuchas, misLuchas, fallanLasLuchas, luchaPorId, ladoDe, rivalDe, meToca, retar, aceptarReto,
  borrarLucha, terminar, rendirse, escucharTurnos, apuntarEnTurno, sello, conSal, sinSal, pendienteDe, cancelarEleccion,
  guardarPendiente, ponerEspera, MAX_PASTE
} from "../comun/luchas.js";

let seccion = null;
let vistaLista = null;
let vistaCombate = null;
let dialogoRetar = null;

const MAX_TERMINADAS = 20;

// El motor y lo que va con él: se descargan la primera vez que hacen falta
let modulos = null;

function cargarMotor() {
  if (!modulos) {
    modulos = Promise.all([
      import("./combate.js"), import("./textos.js"), import("./efectos.js"), import("./escenario.js"), import("./pixeles.js"), cargarDatos()
    ]).then(([combate, textos, efectos, escenario, pixeles]) => ({ ...combate, ...textos, ...efectos, ...escenario, ...pixeles }));
    modulos.catch(() => (modulos = null));
  }
  return modulos;
}

// ---------- Utilidades ----------

function yo() {
  const usuario = usuarioActual();
  return usuario ? usuario.uid : "";
}

function nombreEn(lucha, uid) {
  return (lucha.nombres || {})[uid] || t("Jugador");
}

// La foto de un jugador dentro de su círculo, con el marco que lleve (js/comun/fichas.js)
function fotoEn(lucha, uid, clase = "lucha-foto") {
  const foto = (lucha.fotos || {})[uid] || "";
  const letra = escaparHTML((nombreEn(lucha, uid)[0] || "?").toUpperCase());
  return `<span class="${clase} ${foto ? "" : "sin-foto"} ${claseMarcoDe(uid)}" data-perfil="${escaparHTML(uid)}" title="${t("Ver perfil")}">${
    foto ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer">` : letra
  }</span>`;
}

function carasEn(lucha, uid) {
  const caras = (lucha.caras || {})[uid];
  return caras && caras.length ? carasDeEquipo({ pokemon: caras }) : "";
}

const GEN_ORDINAL = ["", "1.ª", "2.ª", "3.ª", "4.ª", "5.ª", "6.ª", "7.ª", "8.ª", "9.ª"];

// Los juegos de cada generación, para elegir las reglas sin saberse los números
const JUEGOS_GEN = {
  1: "Rojo, Azul, Amarillo", 2: "Oro, Plata, Cristal", 3: "Rubí, Zafiro, Esmeralda, Rojo Fuego",
  4: "Diamante, Perla, Platino, HGSS", 5: "Negro, Blanco, Negro 2, Blanco 2", 6: "X, Y, ROZA",
  7: "Sol, Luna, USUL", 8: "Espada, Escudo", 9: "Escarlata, Púrpura"
};

function textoFormato(formato) {
  const gen = Number((/^gen(\d)/.exec(formato || "") || [])[1]) || 9;
  const variante = /bdsp/.test(formato || "") ? ` · ${t("DBPR")}` : "";
  const sinTera = /Terastal Clause/.test(formato || "") ? ` · ${t("sin tera")}` : "";
  return `${t("{n} gen", { n: GEN_ORDINAL[gen] })}${variante}${sinTera}`;
}

function textoNivel(nivel) {
  return nivel === "50" ? t("Todos al 50") : t("Niveles del equipo");
}

function textoLocke(lucha) {
  if (!lucha.locke) return "";
  const locke = lockePorId(lucha.locke.id);
  return locke ? `${locke.nombre} · ${nombreCombate(locke, lucha.locke.combate)}` : "";
}

const esperar = (ms) => new Promise((cumplir) => setTimeout(cumplir, ms));

// ---------- La lista ----------
//
// Como «Jugar»: arriba y en grande, los combates en marcha (el primero, el que te toca); debajo, los
// retos (los que te mandan y los que esperan respuesta) y, al final, los terminados, con su resultado
// y la repetición. Cada jugador, con su foto y su marco, y su título junto al nombre: son premios de
// la web y se enseñan donde se pueda.

function nombreConTitulo(lucha, uid) {
  return `<span class="lucha-nombre">${escaparHTML(nombreEn(lucha, uid))}</span>${plantillaTituloDeUid(uid, "pequeno")}`;
}

function datosLucha(lucha) {
  const locke = textoLocke(lucha);
  return `${escaparHTML(textoFormato(lucha.formato))} · ${escaparHTML(textoNivel(lucha.nivel))}${locke ? ` · ${escaparHTML(locke)}` : ""}`;
}

// Un combate en marcha, en grande: los dos jugadores frente a frente con sus equipos
function tarjetaEnMarcha(lucha) {
  const uid = yo();
  const rival = rivalDe(lucha, uid);
  const toca = meToca(lucha);
  const jugador = (quien, clase) => `
    <div class="lucha-grande-jugador ${clase} ${fondoVisualDe(quien).clase}" style="${fondoVisualDe(quien).estilo}">
      ${fotoEn(lucha, quien, "lucha-foto grande")}
      <div class="lucha-grande-quien">
        <div class="lucha-grande-nombre">${nombreConTitulo(lucha, quien)}</div>
        ${carasEn(lucha, quien)}
      </div>
    </div>`;
  return `
    <article class="lucha-grande ${toca ? "toca" : ""}" data-id="${escaparHTML(lucha.id)}">
      <span class="lucha-ceja">${toca ? t("Te toca") : t("Le toca a {nombre}", { nombre: escaparHTML(nombreEn(lucha, rival)) })}</span>
      <div class="lucha-grande-cuerpo">
        ${jugador(uid, "mio")}
        <div class="lucha-grande-centro">
          <span class="lucha-vs">vs</span>
          <small>${datosLucha(lucha)}</small>
        </div>
        ${jugador(rival, "suyo")}
      </div>
      <button type="button" class="lucha-boton lucha-abrir">${icono("lucha")} ${toca ? t("Luchar") : t("Ver")}</button>
    </article>`;
}

// Un reto o un combate terminado, en una fila
function filaLucha(lucha) {
  const uid = yo();
  const rival = rivalDe(lucha, uid);
  const recibido = lucha.estado === "reto" && lucha.jugadores[1] === uid;
  const enviado = lucha.estado === "reto" && lucha.jugadores[0] === uid;

  let estado = "";
  let botones = "";
  // La capa de color: la de la sección en los retos que te llegan; verde o roja en las terminadas
  let clase = recibido ? "destacada" : "";
  if (recibido) {
    estado = `<span class="lucha-estado reto">${t("Te reta")}</span>`;
    botones = `
      <button type="button" class="boton-gris lucha-rechazar" title="${t("Rechazar")}">${icono("aspa")}</button>
      <button type="button" class="lucha-boton lucha-aceptar">${icono("visto")} ${t("Aceptar")}</button>`;
  } else if (enviado) {
    estado = `<span class="lucha-estado">${t("Esperando respuesta")}</span>`;
    botones = `<button type="button" class="boton-gris lucha-retirar">${t("Retirar")}</button>`;
  } else {
    const gana = lucha.ganador === uid;
    const empate = lucha.ganador === "empate";
    clase = empate ? "" : gana ? "gana" : "pierde";
    estado =`<span class="lucha-estado ${empate ? "" : gana ? "gana" : "pierde"}">${
      empate ? t("Empate") : gana ? t("Ganaste") : t("Perdiste")
    }${lucha.rendido ? ` · ${lucha.rendido === uid ? t("te rendiste") : t("se rindió")}` : ""}</span>`;
    botones = `
      <button type="button" class="boton-gris lucha-abrir">${icono("reanudar")} ${t("Ver repetición")}</button>
      <button type="button" class="boton-gris lucha-quitar" title="${t("Quitar de la lista")}">${icono("papelera")}</button>`;
  }

  // El equipo del rival no se enseña hasta que empieza (no se elige con ventaja)
  const misCaras = carasEn(lucha, uid);
  const susCaras = lucha.estado === "reto" ? "" : carasEn(lucha, rival);

  return `
    <article class="lucha-fila ${clase}" data-id="${escaparHTML(lucha.id)}">
      ${fotoEn(lucha, rival)}
      <div class="lucha-fila-texto">
        <div class="lucha-fila-nombre">${nombreConTitulo(lucha, rival)}</div>
        <small>${datosLucha(lucha)}</small>
      </div>
      <div class="lucha-fila-equipos">
        ${misCaras || `<span class="lucha-sin-equipo">${t("Sin equipo")}</span>`}
        ${susCaras ? `<span class="lucha-vs">vs</span>${susCaras}` : ""}
      </div>
      ${estado}
      <div class="lucha-fila-botones">${botones}</div>
    </article>`;
}

function bloque(titulo, contenido, clase = "") {
  if (!contenido) return "";
  return `
    <section class="lucha-bloque ${clase}">
      <h3>${titulo}</h3>
      ${contenido}
    </section>`;
}

function pintarLista() {
  if (!vistaLista) return;
  const barra = `
    <p class="lucha-en-pruebas">${icono("aviso")} ${t("Sección en pruebas: todavía puede fallar. Si algo va mal, cuéntalo en el foro.")}</p>
    <div class="lucha-barra">
      <button type="button" class="lucha-boton lucha-retar">${icono("lucha")} ${t("Retar a un amigo")}</button>
      <p class="lucha-explica">${t("Combates por turnos con los equipos que quieras, contra tus amigos y sin salir de la web. Cada uno elige cuando puede: no hace falta estar a la vez.")}</p>
    </div>`;

  if (!hayNube() || !usuarioActual()) {
    vistaLista.innerHTML = `<p class="lucha-aviso">${t("Entra con tu cuenta para retar a tus amigos.")}</p>`;
    return;
  }
  if (fallanLasLuchas()) {
    vistaLista.innerHTML = `${barra}<p class="lucha-aviso error">${
      fallanLasLuchas() === "permisos"
        ? t("Firebase no deja leer los combates. Falta publicar las reglas de Firestore.")
        : t("No se han podido cargar los combates.")
    }</p>`;
    return;
  }

  const uid = yo();
  const todas = misLuchas();
  const retos = todas
    .filter((lucha) => lucha.estado === "reto")
    .sort((una, otra) => Number(otra.jugadores[1] === uid) - Number(una.jugadores[1] === uid)); // primero los que te mandan
  const enMarcha = todas
    .filter((lucha) => lucha.estado === "jugando")
    .sort((una, otra) => Number(meToca(otra)) - Number(meToca(una)));
  const terminadas = todas.filter((lucha) => lucha.estado === "fin").slice(0, MAX_TERMINADAS);

  if (!todas.length) {
    vistaLista.innerHTML = `${barra}
      <div class="lucha-nada">
        <span class="lucha-nada-icono">${icono("lucha")}</span>
        <p>${t("Aún no tienes combates. Reta a un amigo con uno de tus equipos o, desde «Lockes», en un combate de vuestro locke.")}</p>
      </div>`;
    return;
  }

  vistaLista.innerHTML = `${barra}
    ${bloque(t("En marcha"), enMarcha.map(tarjetaEnMarcha).join(""), "en-marcha")}
    ${bloque(t("Retos"), retos.map(filaLucha).join(""))}
    ${bloque(t("Terminadas"), terminadas.map(filaLucha).join(""))}`;
}

// ---------- Retar y aceptar ----------
//
// retando = { modo: "retar" | "aceptar", id (al aceptar), rival, locke: { id, combate } | null,
//             gen, nivel, equipo: { nombre, paste, caras } | null }

let retando = null;

function lockesEnComunCon(rival) {
  const uid = yo();
  return lockes().filter(
    (locke) => locke.estado !== "cerrado" && combatesDe(locke).length
      && estadoDe(locke, uid) === "aceptado" && estadoDe(locke, rival) === "aceptado"
  );
}

// El formato que toca: el del juego del locke o el de la generación elegida
function formatoActual(motor) {
  if (retando.modo === "aceptar") return luchaPorId(retando.id).formato;
  const locke = retando.locke && lockePorId(retando.locke.id);
  const gen = locke && generacionDeJuego(locke.juego);
  return gen ? motor.formatoDeJuego(locke.juego, gen, retando.vistaPrevia) : motor.formatoDe(retando.gen, "", retando.vistaPrevia, retando.tera);
}

function textoProblema(problema) {
  const datos = { nombre: escaparHTML(problema.nombre), de: escaparHTML(problema.de || "") };
  if (problema.clave === "especie") return t("{nombre}: el motor no conoce este Pokémon, no luchará.", datos);
  if (problema.clave === "ataque") return t("{de}: se quita {nombre}, que el motor no conoce.", datos);
  return t("{nombre} no tiene ataques: usará Forcejeo.", datos);
}

async function pintarRetar() {
  const motor = await cargarMotor();
  const aceptando = retando.modo === "aceptar";
  const lucha = aceptando ? luchaPorId(retando.id) : null;
  const amigos = perfilesDeAmigos();
  const formato = formatoActual(motor);
  const nivel = aceptando ? lucha.nivel : retando.nivel;

  // Rival
  let campoRival;
  if (aceptando) {
    campoRival = `<div class="lucha-retar-rival">${fotoEn(lucha, retando.rival)} <strong>${escaparHTML(nombreEn(lucha, retando.rival))}</strong></div>`;
  } else {
    const opciones = amigosAceptados()
      .map((amistad) => ({ uid: amistad.otro, perfil: amigos.get(amistad.otro) }))
      .filter(({ perfil }) => perfil)
      .sort((uno, otro) => (uno.perfil.mote || "").localeCompare(otro.perfil.mote || ""));
    campoRival = opciones.length
      ? `<select class="lucha-retar-amigo">
          <option value="">${t("Elige a un amigo")}</option>
          ${opciones.map(({ uid, perfil }) => `<option value="${escaparHTML(uid)}" ${uid === retando.rival ? "selected" : ""}>${escaparHTML(perfil.mote || perfil.nombre || "")}</option>`).join("")}
        </select>`
      : `<p class="lucha-vacio">${t("Aún no tienes amigos. Añade a alguien desde «Amigos» o el foro.")}</p>`;
  }

  // Combate de locke
  let campoLocke = "";
  if (aceptando) {
    const texto = textoLocke(lucha);
    campoLocke = texto ? `<p class="lucha-retar-dato">${icono("espadas")} ${escaparHTML(texto)}</p>` : "";
  } else if (retando.rival) {
    const comunes = lockesEnComunCon(retando.rival);
    if (comunes.length) {
      const elegido = retando.locke ? `${retando.locke.id}|${retando.locke.combate}` : "";
      campoLocke = `
        <label>${t("Combate de un locke")}
          <select class="lucha-retar-locke">
            <option value="">${t("Ninguno: reto libre")}</option>
            ${comunes.map((locke) => combatesDe(locke).map((combate) => {
              const valor = `${locke.id}|${combate.id}`;
              return `<option value="${escaparHTML(valor)}" ${valor === elegido ? "selected" : ""}>${escaparHTML(`${locke.nombre} · ${nombreCombate(locke, combate.id)}`)}</option>`;
            }).join("")).join("")}
          </select>
        </label>`;
    }
  }

  // Reglas: las del juego del locke o una generación
  const locke = retando.locke && lockePorId(retando.locke.id);
  const genFija = aceptando || (locke && generacionDeJuego(locke.juego));
  const campoReglas = genFija
    ? `<p class="lucha-retar-dato">${icono("libro")} ${t("Reglas de la {formato}", { formato: escaparHTML(textoFormato(formato)) })} · ${escaparHTML(textoNivel(nivel))}${aceptando && lucha.vistaPrevia === false ? ` · ${t("sin vista previa")}` : ""}</p>`
    : `
      <label>${t("Reglas")}
        <select class="lucha-retar-gen">
          ${motor.GENERACIONES.slice().reverse().map((gen) => `<option value="${gen}" ${gen === retando.gen ? "selected" : ""}>${t("{n} gen", { n: GEN_ORDINAL[gen] })} (${escaparHTML(JUEGOS_GEN[gen])})</option>`).join("")}
        </select>
      </label>`;
  const campoNivel = aceptando ? "" : `
    <span class="etiqueta-campo">${t("Nivel")}</span>
    <div class="lucha-retar-nivel">
      <button type="button" data-nivel="tal" class="${nivel === "tal" ? "elegido" : ""}">${t("Niveles del equipo")}</button>
      <button type="button" data-nivel="50" class="${nivel === "50" ? "elegido" : ""}">${t("Todos al 50")}</button>
    </div>
    <span class="etiqueta-campo">${t("Vista previa")}</span>
    <div class="lucha-retar-nivel">
      <button type="button" data-previa="si" class="${retando.vistaPrevia ? "elegido" : ""}">${t("Ver los dos equipos antes de empezar")}</button>
      <button type="button" data-previa="no" class="${retando.vistaPrevia ? "" : "elegido"}">${t("Sin vista previa")}</button>
    </div>
    ${!genFija && retando.gen === 9 ? `
      <span class="etiqueta-campo">${t("Teracristalización")}</span>
      <div class="lucha-retar-nivel">
        <button type="button" data-tera="si" class="${retando.tera ? "elegido" : ""}">${t("Se puede teracristalizar")}</button>
        <button type="button" data-tera="no" class="${retando.tera ? "" : "elegido"}">${t("Sin tera")}</button>
      </div>` : ""}
    <span class="etiqueta-campo">${t("Escenario")}</span>
    <div class="lucha-retar-escenas">
      <button type="button" data-escena="" class="lucha-retar-escena aleatorio ${retando.escena ? "" : "elegido"}">
        <span class="lucha-retar-escena-muestra">${icono("mezclar")}</span>
        <span>${t("Aleatorio")}</span>
      </button>
      ${motor.NOMBRES_ESCENAS.map((escena) => `
        <button type="button" data-escena="${escena}" class="lucha-retar-escena ${retando.escena === escena ? "elegido" : ""}">
          <img class="lucha-retar-escena-muestra" src="${motor.miniaturaEscena(escena)}" alt="">
          <span>${escaparHTML(NOMBRES_ESCENA()[escena] || escena)}</span>
        </button>`).join("")}
    </div>`;

  // Equipo y lo que el motor le vaya a cambiar
  const revision = retando.equipo ? motor.revisarEquipo(retando.equipo.paste, formato, nivel) : null;
  const problemas = revision ? revision.problemas.map((p) => `<li>${textoProblema(p)}</li>`).join("") : "";
  const campoEquipo = `
    <span class="etiqueta-campo">${t("Tu equipo")}</span>
    <div class="lucha-retar-equipo">
      ${retando.equipo
        ? `<strong>${escaparHTML(retando.equipo.nombre)}</strong>${carasDeEquipo({ pokemon: retando.equipo.caras })}`
        : `<span class="lucha-sin-equipo">${t("Sin elegir")}</span>`}
      <button type="button" class="boton-gris lucha-retar-elegir">${icono("pokeball")} ${retando.equipo ? t("Cambiar") : t("Elegir equipo")}</button>
    </div>
    ${problemas ? `<ul class="lucha-retar-problemas">${problemas}</ul>` : ""}`;

  dialogoRetar.querySelector("h2").innerHTML = `${icono("lucha")} ${aceptando ? t("Aceptar el reto") : t("Retar a un amigo")}`;
  dialogoRetar.querySelector(".lucha-retar-cuerpo").innerHTML = `
    ${aceptando ? "" : `<span class="etiqueta-campo">${t("Rival")}</span>`}
    ${campoRival}
    ${campoLocke}
    ${campoReglas}
    ${campoNivel}
    ${campoEquipo}`;
  const ok = dialogoRetar.querySelector(".lucha-retar-ok");
  ok.textContent = aceptando ? t("Aceptar y luchar") : t("Retar");
  ok.disabled = !retando.rival || !revision || !revision.vale;
}

// Los nombres de los escenarios (js/lucha/escenario.js)
const NOMBRES_ESCENA = () => ({
  pradera: t("Pradera"), atardecer: t("Atardecer"), noche: t("Noche"), nieve: t("Nieve"), playa: t("Playa"), cueva: t("Cueva")
});

async function abrirDialogoRetar(datos) {
  retando = { modo: "retar", id: "", rival: "", locke: null, gen: 9, nivel: "tal", vistaPrevia: true, tera: true, escena: "", equipo: null, ...datos };
  dialogoRetar.querySelector(".lucha-retar-error").textContent = "";
  try {
    await pintarRetar();
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido cargar el motor de combate. Prueba de nuevo."));
    return;
  }
  if (!dialogoRetar.open) dialogoRetar.showModal();
}

// Desde «Lockes» (js/versus/combates.js): retar a alguien en un combate del locke
export function abrirRetar({ rival = "", locke = null } = {}) {
  return abrirDialogoRetar({ rival, locke });
}

function abrirAceptar(id) {
  const lucha = luchaPorId(id);
  if (!lucha) return;
  abrirDialogoRetar({ modo: "aceptar", id, rival: lucha.jugadores[0], locke: lucha.locke || null });
}

// Un Pokémon guardado con la imagen de una forma (una Mega, una regional) pero sin el nombre de su forma
// (equipos de antes, o si falló PokeAPI al crearlo) se exportaría como la forma normal: una Mega
// entraría sin megaevolucionar y podría hacerlo en el combate. El nombre se saca de su forma en PokeAPI.
async function conSuForma(p) {
  if (p.formaSlug || !p.idForma || p.idForma === p.id || p.imagenForma) return p;
  try {
    const variedad = await pedirJSON(`${URL_API}pokemon/${p.idForma}`);
    const especie = (variedad.species && variedad.species.name) || "";
    const slug = especie && variedad.name.startsWith(`${especie}-`) ? variedad.name.slice(especie.length + 1) : "";
    return slug ? { ...p, formaSlug: slug } : p;
  } catch (error) {
    return p;
  }
}

// El equipo elegido, listo para la lucha: { nombre, paste, caras }
async function equipoParaLucha(elegido) {
  let pokemon = (elegido.pokemon || []).filter((p) => !p.huevo);
  if (!elegido.deLaPartida) pokemon = await Promise.all(pokemon.map(conSuForma));
  let paste;
  if (elegido.deLaPartida) {
    const { pasteDeEquipo, prepararConversion } = await import("../partida/convertir.js");
    await prepararConversion();
    paste = pasteDeEquipo(pokemon);
  } else {
    paste = pasteDelEquipo(pokemon);
  }
  const caras = JSON.parse(JSON.stringify(pokemon.map(pokemonParaCopia)));
  return { nombre: elegido.nombre || t("Equipo"), paste: paste.slice(0, MAX_PASTE), caras };
}

async function elegirEquipoParaLucha(boton) {
  // En un combate de locke, primero el equipo de la partida vinculada (con todo: ataques, objetos...)
  let primero = null;
  if (retando.locke) {
    const { partidaDe } = await import("../partida/partidas.js");
    const partida = partidaDe(retando.locke.id);
    if (partida && partida.equipo.length) {
      primero = { nombre: t("Equipo de la partida"), pokemon: partida.equipo.filter((p) => !p.huevo), deLaPartida: true };
    }
  }
  const elegido = await elegirEquipo(boton, { completo: true, primero });
  if (!elegido) return;
  retando.equipo = await equipoParaLucha(elegido);
  await pintarRetar();
}

async function enviarReto() {
  const error = dialogoRetar.querySelector(".lucha-retar-error");
  const ok = dialogoRetar.querySelector(".lucha-retar-ok");
  ok.disabled = true;
  error.textContent = "";
  try {
    const motor = await cargarMotor();
    if (retando.modo === "aceptar") {
      await aceptarReto(retando.id, retando.equipo);
      const id = retando.id;
      dialogoRetar.close();
      abrirCombate(id);
      return;
    }
    const perfil = perfilesDeAmigos().get(retando.rival) || {};
    await retar({
      rival: retando.rival,
      nombreRival: perfil.mote || perfil.nombre || "",
      fotoRival: perfil.foto || "",
      equipo: retando.equipo,
      formato: formatoActual(motor),
      nivel: retando.nivel,
      vistaPrevia: retando.vistaPrevia,
      escena: retando.escena,
      motor: motor.VERSION,
      locke: retando.locke
    });
    dialogoRetar.close();
  } catch (fallo) {
    console.error(fallo);
    error.textContent = fallo.code === "permission-denied"
      ? t("Firebase no lo deja. Puede que ya no seáis amigos, o que falten por publicar las reglas de Firestore.")
      : t("No se ha podido enviar. Prueba de nuevo.");
    ok.disabled = false;
  }
}

// ---------- El combate ----------
//
// abierto = { id, lado, combate, lector, vista, registro, cola, historia, efectos, ... } mientras se ve uno.
// «historia» guarda todos los sucesos desde el principio: con el combate acabado, la repetición
// (abierto.repeticion) los vuelve a aplicar hasta el turno que se quiera ver.
//
// La vista es lo que se sabe en cada momento de lo que se ve en el campo (lo que el motor cuenta,
// suceso a suceso): no se lee del motor, que ya va al final del turno mientras se anima.

let abierto = null;

const numeroDe = (lado) => (lado === "p1" ? 1 : 2);
const otroLado = (lado) => (lado === "p1" ? "p2" : "p1");

function nuevaVista() {
  // condiciones: púas, pantallas... de su lado ({ spikes: 2, reflect: 1 }); usados: mega, tera, zeta,
  // dinamax (una vez por combate); conocidos: lo que se ha visto de cada uno (ataques, habilidad, objeto)
  const lado = () => ({ activo: null, vistos: {}, condiciones: {}, usados: new Set(), conocidos: {} });
  return { p1: lado(), p2: lado(), clima: "", campo: new Set(), turno: 0, ganador: null };
}

function uidDe(lado) {
  return lado === "p1" ? abierto.lucha.jugadores[0] : abierto.lucha.jugadores[1];
}

function carasDe(lado) {
  return (abierto.lucha.caras || {})[uidDe(lado)] || [];
}

function retratoDe(lado, posicion) {
  const cara = carasDe(lado)[posicion];
  return cara ? caraDePokemon(cara, "lucha-retrato") : `<span class="lucha-retrato sin-cara"></span>`;
}

function dex() {
  const { Dex, genDe } = abierto.modulos;
  return Dex.forGen(genDe(abierto.combate.formato));
}

function conocidoDe(lado, nombrePokemon) {
  const conocidos = abierto.vista[lado].conocidos;
  // ataques: nombre (el del motor, en inglés) -> veces que lo ha usado gastando PP
  if (!conocidos[nombrePokemon]) conocidos[nombrePokemon] = { ataques: new Map(), habilidad: "", objeto: "" };
  return conocidos[nombrePokemon];
}

// ---------- Sprites ----------
//
// Todos con el mismo estilo: los animados en 3D de la carpeta «showdown» de PokeAPI (es el único que
// hay para todos los Pokémon y sus formas); si alguno falta, el fijo. De espaldas, el tuyo.
//
// Se ven a su tamaño, ampliado a saltos de medio en medio según lo ancho que sea el campo (640 px =
// tamaño real, como en los juegos de DS) y sin suavizar: así no se emborronan. El tuyo, algo más
// grande (está más cerca).

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const idsDeForma = new Map(); // "lucario-mega" -> id de PokeAPI (o null, si no lo tiene)

function urlsSprite({ num, idForma, shiny, espalda }) {
  const atras = espalda ? "back/" : "";
  const brillo = shiny ? "shiny/" : "";
  const id = idForma && idForma !== num ? idForma : num;
  const lista = [];
  lista.push(`${URL_SPRITES}other/showdown/${atras}${brillo}${id}.gif`);
  if (brillo) lista.push(`${URL_SPRITES}other/showdown/${atras}${id}.gif`);
  lista.push(`${URL_SPRITES}${atras}${brillo}${id}.png`, `${URL_SPRITES}${atras}${id}.png`, `${URL_SPRITES}${atras}${num}.png`, `${URL_SPRITES}${num}.png`);
  return lista;
}

// Número y forma de un Pokémon del campo: si sigue siendo la especie con la que se metió en el equipo,
// la forma de su cara (las regionales); si ha cambiado en el combate (megaevolución), se busca esa forma
// en PokeAPI y se repinta al llegar.
function formaDe(activo, lado) {
  const { toID } = abierto.modulos;
  const especie = dex().species.get(activo.especie);
  const num = especie.num || 0;
  const set = abierto.combate.sets[lado].find((cada) => cada.posicion === activo.posicion);
  const cara = carasDe(lado)[activo.posicion];
  let idForma = null;
  if (set && cara && toID(set.species) === especie.id) idForma = cara.idForma || null;
  else if (especie.forme && !especie.isCosmeticForme) {
    const slug = especie.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (idsDeForma.has(slug)) idForma = idsDeForma.get(slug);
    else {
      idsDeForma.set(slug, null);
      pedirVariedad(slug)
        .then((variedad) => {
          idsDeForma.set(slug, variedad.id);
          if (abierto) pintarCampo({ sprites: true });
        })
        .catch(() => {});
    }
  }
  return { num, idForma, shiny: activo.shiny };
}

// Lo que se ve de él: si se ha transformado (Transformación, Impostor), el Pokémon en que se convirtió
function aspectoDe(activo, lado) {
  const forma = activo.transformado || formaDe(activo, lado);
  return { ...forma, espalda: lado === abierto.lado };
}

const ANCHO_REAL = 640;

function ajustarSprite(img) {
  const arena = img.closest(".lucha-arena");
  if (!arena || !img.naturalWidth) return;
  const enPrevia = Boolean(img.closest(".lucha-previa-sprite"));
  const cerca = enPrevia ? (img.closest(".mio") ? 1 : 0.75) : img.closest(".lucha-lado.mio") ? 1.4 : 1;
  const escala = Math.max(1, Math.round((arena.clientWidth / ANCHO_REAL) * cerca * 2) / 2);
  img.style.width = `${img.naturalWidth * escala}px`;
}

function spriteDe(lado, forzar = false) {
  const caja = vistaCombate.querySelector(`.lucha-sprite[data-lado="${lado}"]`);
  if (!caja) return;
  const { activo } = abierto.vista[lado];
  if (!activo) {
    caja.innerHTML = "";
    caja.dataset.clave = "";
    return;
  }
  const aspecto = aspectoDe(activo, lado);
  const clave = `${activo.nombre}|${aspecto.num}|${aspecto.idForma}|${aspecto.shiny}`;
  caja.classList.toggle("caido", activo.debilitado);
  caja.classList.toggle("tera", Boolean(activo.tera));
  caja.classList.toggle("dinamax", Boolean(activo.dinamax));
  const colorTera = coloresTipo[activo.tera] || "#7fd8ff";
  caja.style.setProperty("--tera", colorTera);
  if (activo.tera) caja.style.setProperty("--joya", `url("${abierto.modulos.urlJoya(colorTera)}")`);
  if (caja.dataset.clave === clave && !forzar) return;
  caja.dataset.clave = clave;
  caja.innerHTML = imagenConRespaldo(urlsSprite(aspecto), `alt="${escaparHTML(activo.nombre)}" draggable="false"`);
}

// ---------- Lo que se ve: aplicar cada suceso ----------

function aplicarSuceso(suceso) {
  const vista = abierto.vista;
  const lado = suceso.lado && vista[suceso.lado];
  const activo = lado && lado.activo && lado.activo.nombre === suceso.nombre ? lado.activo : null;
  switch (suceso.tipo) {
    case "cambio":
      lado.activo = {
        nombre: suceso.nombre, especie: suceso.especie, nivel: suceso.nivel, genero: suceso.genero, shiny: suceso.shiny,
        ps: suceso.ps, psMax: suceso.psMax, estado: suceso.estado, cambios: {}, debilitado: false,
        posicion: abierto.combate.posicionDe(suceso.lado, suceso.nombre), tera: suceso.tera ? suceso.tera.toLowerCase() : ""
      };
      lado.vistos[suceso.nombre] = { ps: suceso.ps, psMax: suceso.psMax, estado: suceso.estado, debilitado: false };
      break;
    case "ps":
      if (activo) Object.assign(activo, { ps: suceso.ps, psMax: suceso.psMax || activo.psMax, estado: suceso.estado });
      if (lado.vistos[suceso.nombre]) Object.assign(lado.vistos[suceso.nombre], { ps: suceso.ps, estado: suceso.estado });
      break;
    case "debilitado":
      if (activo) Object.assign(activo, { ps: 0, debilitado: true });
      if (lado.vistos[suceso.nombre]) Object.assign(lado.vistos[suceso.nombre], { ps: 0, debilitado: true });
      break;
    case "estado":
      if (activo) activo.estado = suceso.estado;
      if (lado.vistos[suceso.nombre]) lado.vistos[suceso.nombre].estado = suceso.estado;
      break;
    case "cambios":
      aplicarCambios(suceso);
      break;
    case "forma":
      if (activo) activo.especie = suceso.especie;
      break;
    case "transforma": {
      const objetivo = suceso.objetivo && vista[suceso.objetivo.lado].activo;
      if (activo && objetivo) {
        activo.transformado = formaDe(objetivo, suceso.objetivo.lado);
        activo.especieTransformado = objetivo.especie;
        activo.cambios = { ...objetivo.cambios };
        // Hasta que se retire es una copia del otro (habilidad, ataques, estadísticas): su bocadillo lo enseña
        activo.transformadoDe = { lado: suceso.objetivo.lado, posicion: objetivo.posicion };
        activo.usosTransformado = {};
      }
      break;
    }
    case "mega":
      if (suceso.usa) lado.usados.add(suceso.usa);
      break;
    case "tera":
      lado.usados.add("tera");
      if (activo) activo.tera = suceso.tera;
      break;
    case "zeta":
      lado.usados.add("zeta");
      break;
    case "dinamax":
      if (suceso.activo) lado.usados.add("dinamax");
      if (activo) activo.dinamax = suceso.activo;
      break;
    case "ataque": {
      // Transformado, usa los ataques copiados: no son suyos (no se apuntan como «vistos»)
      if (activo && activo.transformadoDe) {
        activo.usosTransformado[suceso.ataque] = (activo.usosTransformado[suceso.ataque] || 0) + (suceso.gastaPP === false ? 0 : 1);
        break;
      }
      const ataques = conocidoDe(suceso.lado, suceso.nombre).ataques;
      ataques.set(suceso.ataque, (ataques.get(suceso.ataque) || 0) + (suceso.gastaPP === false ? 0 : 1));
      break;
    }
    case "revela": {
      const conocido = conocidoDe(suceso.lado, suceso.nombre);
      if (suceso.habilidad) conocido.habilidad = suceso.habilidad;
      if ("objeto" in suceso) conocido.objeto = suceso.objeto;
      break;
    }
    case "lado":
      if (suceso.cambiarLados) [vista.p1.condiciones, vista.p2.condiciones] = [vista.p2.condiciones, vista.p1.condiciones];
      else if (suceso.activo) lado.condiciones[suceso.efecto] = (lado.condiciones[suceso.efecto] || 0) + 1;
      else delete lado.condiciones[suceso.efecto];
      break;
    case "campo":
      if (suceso.activo) {
        // Solo un campo (eléctrico, de hierba...) a la vez
        if (suceso.efecto.endsWith("terrain")) for (const efecto of [...vista.campo]) if (efecto.endsWith("terrain")) vista.campo.delete(efecto);
        vista.campo.add(suceso.efecto);
      } else vista.campo.delete(suceso.efecto);
      break;
    case "clima":
      vista.clima = suceso.clima;
      break;
    case "turno":
      vista.turno = suceso.n;
      abierto.registro.push({ turno: suceso.n });
      break;
    case "fin":
      vista.ganador = suceso.ganador;
      break;
    default:
      break;
  }
  if (suceso.texto) abierto.registro.push({ texto: suceso.texto, aviso: suceso.aviso, marcas: suceso.marcas });
}

function aplicarCambios(suceso) {
  const vista = abierto.vista;
  const activoDe = (p) => p && vista[p.lado] && vista[p.lado].activo && vista[p.lado].activo.nombre === p.nombre ? vista[p.lado].activo : null;
  if (suceso.intercambio) {
    const a = activoDe(suceso.intercambio.a);
    const b = activoDe(suceso.intercambio.b);
    if (!a || !b) return;
    const stats = suceso.intercambio.stats.length ? suceso.intercambio.stats : ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];
    for (const stat of stats) [a.cambios[stat], b.cambios[stat]] = [b.cambios[stat] || 0, a.cambios[stat] || 0];
    return;
  }
  if (suceso.copia) {
    const a = activoDe(suceso.copia.a);
    const de = activoDe(suceso.copia.de);
    if (a && de) a.cambios = { ...de.cambios };
    return;
  }
  if (suceso.limpiar) {
    for (const cual of suceso.todos ? ["p1", "p2"] : [suceso.lado]) if (vista[cual] && vista[cual].activo) vista[cual].activo.cambios = {};
    return;
  }
  const activo = activoDe(suceso);
  if (!activo) return;
  const cambios = activo.cambios;
  if (suceso.invertir) for (const stat of Object.keys(cambios)) cambios[stat] = -cambios[stat];
  else if (suceso.quitarNegativos) for (const stat of Object.keys(cambios)) cambios[stat] = Math.max(0, cambios[stat]);
  else if (suceso.quitarPositivos) for (const stat of Object.keys(cambios)) cambios[stat] = Math.min(0, cambios[stat]);
  else {
    const antes = cambios[suceso.stat] || 0;
    const ahora = "fijo" in suceso ? suceso.fijo : antes + suceso.cuanto;
    cambios[suceso.stat] = Math.max(-6, Math.min(6, ahora));
  }
}

// ---------- Pintar el combate ----------

function claseBarra(parte) {
  return parte > 0.5 ? "alto" : parte > 0.2 ? "medio" : "bajo";
}

function chipEstado(estado) {
  const datos = abierto.modulos.ESTADOS[estado];
  return datos ? `<span class="lucha-chip-estado estado-${estado}" title="${escaparHTML(datos.largo)}">${escaparHTML(datos.corto)}</span>` : "";
}

function chipTera(tipo) {
  return tipo ? `<span class="lucha-chip-tera" style="--c: ${coloresTipo[tipo] || "#7fd8ff"}" title="${escaparHTML(t("Teracristalizado: tipo {tipo}", { tipo: tiposEs[tipo] || tipo }))}">${iconoTipo(tipo)} Tera</span>` : "";
}

function textoPS(lado, ps, psMax) {
  return lado === abierto.lado ? `${Math.round(ps)}/${psMax}` : `${Math.round(psMax ? (ps / psMax) * 100 : 0)} %`;
}

// La ficha de un lado se pinta entera solo al salir otro Pokémon; lo demás se cambia dentro, para
// que la barra de PS pueda bajar poco a poco.
function fichaVacia(lado) {
  const { activo } = abierto.vista[lado];
  const genero = activo.genero ? `<span class="lucha-genero ${activo.genero === "F" ? "hembra" : "macho"}">${icono(activo.genero === "F" ? "hembra" : "macho")}</span>` : "";
  return `
    <div class="lucha-ficha ${lado === abierto.lado ? "mia" : "suya"}" data-bocadillo="pokemon:${lado}">
      ${retratoDe(lado, activo.posicion)}
      <div class="lucha-ficha-datos">
        <div class="lucha-ficha-nombre"><strong>${escaparHTML(activo.nombre)}</strong>${genero}<small>${t("Nv.")} ${activo.nivel}</small><span class="lucha-ficha-estado"></span></div>
        <span class="lucha-ps"><span></span></span>
        <div class="lucha-ficha-pie"><span class="lucha-ps-texto"></span><span class="lucha-ficha-cambios"></span></div>
      </div>
    </div>`;
}

// Pone la barra y el número de PS. Con «animar», bajan (o suben) poco a poco; devuelve cuánto tarda.
function ponerPS(lado, animar) {
  const hueco = vistaCombate.querySelector(`.lucha-lado[data-lado="${lado}"] .lucha-ficha-hueco`);
  const ficha = hueco && hueco.querySelector(".lucha-ficha");
  const { activo } = abierto.vista[lado];
  if (!ficha || !activo) return 0;
  const barra = ficha.querySelector(".lucha-ps");
  const relleno = barra.querySelector("span");
  const texto = ficha.querySelector(".lucha-ps-texto");
  const psMax = activo.psMax || 1;
  const destino = activo.ps;
  const desde = ficha.dataset.ps === undefined ? destino : Number(ficha.dataset.ps);
  ficha.dataset.ps = String(destino);
  cancelAnimationFrame(Number(ficha.dataset.cuadro || 0));

  if (!animar || desde === destino || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    relleno.style.transition = "none";
    relleno.style.width = `${(Math.max(0, destino) / psMax) * 100}%`;
    barra.className = `lucha-ps ${claseBarra(destino / psMax)}`;
    texto.textContent = textoPS(lado, destino, activo.psMax);
    return 0;
  }
  // Más tiempo cuanto más cambia: de 0,5 s (un rasguño) a 1,6 s (de lleno a vacío)
  const duracion = 500 + 1100 * Math.min(1, Math.abs(destino - desde) / psMax);
  const inicio = performance.now();
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / duracion);
    const valor = desde + (destino - desde) * t;
    relleno.style.transition = "none";
    relleno.style.width = `${(Math.max(0, valor) / psMax) * 100}%`;
    barra.className = `lucha-ps ${claseBarra(valor / psMax)}`;
    texto.textContent = textoPS(lado, valor, activo.psMax);
    if (t < 1) ficha.dataset.cuadro = String(requestAnimationFrame(paso));
  };
  ficha.dataset.cuadro = String(requestAnimationFrame(paso));
  return duracion;
}

function pintarFicha(lado) {
  const zona = vistaCombate.querySelector(`.lucha-lado[data-lado="${lado}"]`);
  const hueco = zona.querySelector(".lucha-ficha-hueco");
  const { activo } = abierto.vista[lado];
  const clave = activo ? `${activo.nombre}|${activo.posicion}` : "";
  if (hueco.dataset.clave !== clave) {
    hueco.dataset.clave = clave;
    hueco.innerHTML = activo ? fichaVacia(lado) : "";
  }
  if (!activo) return;
  const ficha = hueco.querySelector(".lucha-ficha");
  ficha.classList.toggle("debilitado", activo.debilitado);
  ficha.querySelector(".lucha-ficha-estado").innerHTML = chipEstado(activo.estado) + chipTera(activo.tera);
  ficha.querySelector(".lucha-ficha-cambios").innerHTML = Object.entries(activo.cambios)
    .filter(([, valor]) => valor)
    .map(([stat, valor]) => `<span class="lucha-chip-cambio ${valor > 0 ? "sube" : "baja"}">${escaparHTML(abierto.modulos.ESTADISTICAS_CORTAS[stat] || stat)} ${valor > 0 ? "+" : ""}${valor}</span>`)
    .join("");
  if (ficha.dataset.ps === undefined || !abierto.animandoPS) ponerPS(lado, false);
}

// Lo que hay en el lado de cada uno: púas, rocas, telaraña, pantallas, viento afín...
const TRAMPAS = ["spikes", "toxicspikes", "stealthrock", "stickyweb", "gmaxsteelsurge"];
const COLORES_PANTALLA = { reflect: "#ff8ad8", lightscreen: "#ffe066", auroraveil: "#7ff0ff", safeguard: "#7be495", mist: "#ffffff", luckychant: "#ffd166" };

// El color del escudo de cada ataque que protege
const COLORES_ESCUDO = {
  protect: "#7fe0ff", detect: "#ffe066", kingsshield: "#d7dce8", spikyshield: "#7bd36b", banefulbunker: "#b35ad6",
  obstruct: "#6a5a7a", silktrap: "#e8e0c0", maxguard: "#ff6b8a", burningbulwark: "#ff8a3d"
};

function pintarTrampas(lado) {
  const capa = vistaCombate.querySelector(`.lucha-lado[data-lado="${lado}"] .lucha-trampas`);
  if (!capa) return;
  const condiciones = abierto.vista[lado].condiciones;
  const piezas = [];
  const puas = (cuantas, clase) => {
    for (let i = 0; i < cuantas; i++) piezas.push(`<span class="lucha-pua ${clase}" style="--i: ${i}; --n: ${cuantas}; --fila: ${i % 2}"></span>`);
  };
  if (condiciones.spikes) puas(Math.min(3, condiciones.spikes) * 3, "puas");
  if (condiciones.toxicspikes) puas(Math.min(2, condiciones.toxicspikes) * 3, "toxicas");
  if (condiciones.stealthrock || condiciones.gmaxsteelsurge) {
    for (let i = 0; i < 4; i++) piezas.push(`<span class="lucha-roca ${condiciones.gmaxsteelsurge ? "acero" : ""}" style="--i: ${i}; --fila: ${i % 2}"></span>`);
  }
  if (condiciones.stickyweb) piezas.push(`<span class="lucha-telarana"></span>`);
  for (const [pantalla, color] of Object.entries(COLORES_PANTALLA)) {
    if (condiciones[pantalla]) piezas.push(`<span class="lucha-pantalla pantalla-${pantalla}" style="--c: ${color}; --trama: url('${abierto.modulos.urlTrama(color)}')"></span>`);
  }
  if (condiciones.tailwind) piezas.push(`<span class="lucha-viento"></span><span class="lucha-viento otra"></span>`);
  const clave = JSON.stringify(condiciones);
  if (capa.dataset.clave === clave) return;
  capa.dataset.clave = clave;
  capa.innerHTML = piezas.join("");
  // Y su nombre en una chapita bajo la ficha, para saber qué es cada cosa
  const nombres = Object.entries(condiciones).map(([efecto, n]) => {
    const ataque = dex().moves.get(efecto);
    const nombreEfecto = abierto.modulos.nombreAtaque(ataque.exists ? ataque.name : efecto);
    return `<span class="lucha-chip-lado ${TRAMPAS.includes(efecto) ? "trampa" : ""}">${escaparHTML(nombreEfecto)}${n > 1 && TRAMPAS.includes(efecto) ? ` ×${n}` : ""}</span>`;
  });
  vistaCombate.querySelector(`.lucha-lado[data-lado="${lado}"] .lucha-condiciones`).innerHTML = nombres.join("");
}

// ---------- La vista previa, en el campo ----------
//
// Antes de que salga nadie (con vista previa): los seis de cada uno en el campo, más pequeños y frente a
// frente. Los del rival, de cara, en fila junto a su plataforma; los tuyos, de espaldas, abajo. Cada uno
// con su bocadillo. Se quitan en cuanto sale el primero.
function pintarPrevia() {
  const capa = vistaCombate.querySelector(".lucha-previa-campo");
  if (!capa) return;
  const vista = abierto.vista;
  const toca = abierto.lucha.vistaPrevia !== false && !vista.p1.activo && !vista.p2.activo && !vista.turno;
  if (!toca) {
    if (capa.innerHTML) capa.innerHTML = "";
    return;
  }
  if (capa.innerHTML) return;
  const filas = [[otroLado(abierto.lado), "suyo"], [abierto.lado, "mio"]];
  capa.innerHTML = filas.map(([lado, clase]) => {
    const sets = abierto.combate.sets[lado];
    return sets.map((set, i) => {
      const especie = dex().species.get(set.species);
      const cara = carasDe(lado)[set.posicion] || {};
      const idForma = cara.id === especie.num ? cara.idForma : null;
      const urls = urlsSprite({ num: especie.num, idForma, shiny: Boolean(cara.shiny), espalda: lado === abierto.lado });
      // El rival, repartido por la mitad derecha a la altura de su plataforma; tú, por la izquierda, abajo.
      // En zigzag (uno más atrás, otro más delante) para que se vean todos.
      const x = clase === "suyo" ? 0.5 + ((i + 0.5) * 0.46) / sets.length : 0.03 + ((i + 0.5) * 0.52) / sets.length;
      const y = clase === "suyo" ? 0.53 - (i % 2) * 0.05 : 0.95 - (i % 2) * 0.07;
      return `<span class="lucha-previa-sprite ${clase}" data-bocadillo="hueco:${lado}:${set.posicion}"
        style="left: ${(x * 100).toFixed(2)}%; top: ${(y * 100).toFixed(2)}%; z-index: ${Math.round(y * 100)}; animation-delay: ${i * 80}ms">${
          imagenConRespaldo(urls, `alt="${escaparHTML(especie.name)}" draggable="false"`)
        }</span>`;
    }).join("");
  }).join("");
}

function pintarCampo({ sprites = false } = {}) {
  if (!abierto) return;
  for (const lado of ["p1", "p2"]) {
    pintarFicha(lado);
    spriteDe(lado, sprites);
    pintarTrampas(lado);
  }
  pintarEquipos();
  pintarPrevia();
  const arena = vistaCombate.querySelector(".lucha-arena");
  arena.dataset.clima = abierto.vista.clima || "";
  arena.dataset.campo = [...abierto.vista.campo].join(" ");
  const clima = abierto.modulos.NOMBRE_CLIMA[abierto.vista.clima];
  const nombresCampo = [...abierto.vista.campo].map((efecto) => abierto.modulos.nombreAtaque(dex().moves.get(efecto).name || efecto));
  const etiqueta = vistaCombate.querySelector(".lucha-clima");
  const textoClima = [clima, ...nombresCampo].filter(Boolean).join(" · ");
  etiqueta.hidden = !textoClima;
  etiqueta.textContent = textoClima;
  vistaCombate.querySelector(".lucha-turno").textContent = abierto.vista.turno ? t("Turno {n}", { n: abierto.vista.turno }) : t("Antes de empezar");
}

// Una frase con sus marcas (js/lucha/textos.js) resaltadas: cada ataque del color de su tipo, las
// habilidades y los objetos con su propio estilo, y los Pokémon de cada lado en su color
function resaltar(texto, marcas = []) {
  const trozos = [];
  for (const marca of marcas) {
    // La primera vez que sale y que no pisa a otra marca
    let desde = 0;
    for (;;) {
      const i = texto.indexOf(marca.texto, desde);
      if (i < 0) break;
      const fin = i + marca.texto.length;
      if (!trozos.some((trozo) => i < trozo.fin && fin > trozo.i)) {
        trozos.push({ i, fin, marca });
        break;
      }
      desde = fin;
    }
  }
  trozos.sort((uno, otro) => uno.i - otro.i);
  let html = "";
  let hecho = 0;
  for (const { i, fin, marca } of trozos) {
    html += escaparHTML(texto.slice(hecho, i));
    const contenido = escaparHTML(texto.slice(i, fin));
    if (marca.clase === "ataque") {
      const ataque = dex().moves.get(marca.en);
      const tipo = ataque.exists ? ataque.type.toLowerCase() : "normal";
      html += `<span class="lucha-r-ataque" style="--c: ${coloresTipo[tipo] || "#888"}">${contenido}</span>`;
    } else {
      html += `<span class="lucha-r-${marca.clase}">${contenido}</span>`;
    }
    hecho = fin;
  }
  return html + escaparHTML(texto.slice(hecho));
}

function pintarRegistro() {
  const lista = vistaCombate.querySelector(".lucha-registro-lista");
  const enRepeticion = Boolean(abierto.repeticion);
  lista.innerHTML = abierto.registro
    .map((linea) => (linea.turno
      ? `<li class="turno">${enRepeticion
        ? `<button type="button" class="lucha-ir-turno" data-turno="${linea.turno}" title="${t("Ver este turno otra vez")}">${t("Turno {n}", { n: linea.turno })}</button>`
        : t("Turno {n}", { n: linea.turno })}</li>`
      : `<li class="${linea.aviso ? "lucha-linea-habilidad" : ""}">${resaltar(linea.texto, linea.marcas)}</li>`))
    .join("");
  lista.scrollTop = lista.scrollHeight;
}

function ponerMensaje(texto, marcas) {
  const caja = vistaCombate.querySelector(".lucha-mensaje");
  if (caja) caja.innerHTML = texto ? resaltar(texto, marcas) : "";
}

// ---------- Animaciones y sonidos de cada suceso ----------

const COLOR_ESTADO = { brn: "#ff7a3d", par: "#f5d33b", slp: "#a0a6c8", frz: "#8fe0f5", psn: "#b45ad1", tox: "#8f2fb0" };

function animar(lado, clase) {
  const caja = vistaCombate.querySelector(`.lucha-sprite[data-lado="${lado}"]`);
  if (!caja) return;
  caja.classList.remove(clase);
  void caja.offsetWidth; // para que vuelva a empezar si ya la tenía
  caja.classList.add(clase);
}

// Pinta y anima un suceso ya aplicado. antes: los PS que tenía (para el número que flota).
async function animarSuceso(suceso, antes) {
  const { efectos, modulos } = abierto;
  const { sonidos, grito } = modulos;
  if (suceso.texto) ponerMensaje(suceso.texto, suceso.marcas);
  const lado = suceso.lado;
  const activo = lado && abierto.vista[lado].activo;

  // Protección y su familia: un escudo en pixel art, del color del ataque que lo ha puesto
  if (suceso.proteccion && lado) {
    const ultimo = modulos.idEfecto((abierto.ultimoAtaque || {})[lado] || "");
    const color = COLORES_ESCUDO[ultimo] || COLORES_ESCUDO[suceso.proteccion] || COLORES_ESCUDO.protect;
    efectos.escudo(lado, modulos.urlEscudo(color));
    sonidos.brillo();
    return esperar(950);
  }

  switch (suceso.tipo) {
    case "cambio": {
      pintarCampo();
      animar(lado, "sale");
      grito(aspectoDe(activo, lado).num);
      return esperar(700);
    }
    case "ataque": {
      abierto.fuerza = "normal";
      abierto.ultimoAtaque = { ...(abierto.ultimoAtaque || {}), [lado]: suceso.ataque };
      const ataque = dex().moves.get(suceso.ataque);
      const tipo = (ataque.type || "Normal").toLowerCase();
      efectos.rotulo(modulos.nombreAtaque(suceso.ataque), tipo);
      const aSiMismo = ["self", "allySide", "allies", "adjacentAllyOrSelf", "adjacentAlly"].includes(ataque.target);
      const contacto = Boolean(ataque.flags && ataque.flags.contact);
      if (ataque.category === "Physical" && contacto && !aSiMismo) animar(lado, "ataca");
      await esperar(250);
      await efectos.ataque({ lado, objetivo: suceso.objetivo || otroLado(lado), tipo, categoria: ataque.category, contacto, aSiMismo });
      return esperar(150);
    }
    case "eficacia":
      abierto.fuerza = suceso.valor > 1 ? "muy" : suceso.valor > 0 ? "poco" : "nada";
      if (suceso.valor === 0 && lado) efectos.numero(lado, t("Sin efecto"), "nada");
      return esperar(650);
    case "critico":
      abierto.fuerza = "critico";
      if (lado) efectos.numero(lado, t("¡Crítico!"), "critico");
      return esperar(600);
    case "ps": {
      abierto.animandoPS = true;
      pintarFicha(lado);
      const psMax = (activo && activo.psMax) || 1;
      const cambio = antes == null ? 0 : suceso.ps - antes;
      if (cambio < 0) {
        efectos.golpe(lado, suceso.danio && !suceso.texto ? abierto.fuerza || "normal" : "poco");
        animar(lado, "golpeado");
        efectos.numero(lado, `−${Math.max(1, Math.round((-cambio / psMax) * 100))} %`, "danio");
      } else if (cambio > 0) {
        sonidos.cura();
        efectos.aura(lado, "#7be495", { anillos: 2 });
        efectos.numero(lado, `+${Math.max(1, Math.round((cambio / psMax) * 100))} %`, "cura");
      }
      abierto.fuerza = "normal";
      const duracion = ponerPS(lado, true);
      await esperar(Math.max(duracion, suceso.texto ? 850 : 350));
      abierto.animandoPS = false;
      return undefined;
    }
    case "debilitado":
      if (activo) grito(aspectoDe(activo, lado).num, { grave: true });
      sonidos.debilitado();
      pintarCampo();
      return esperar(900);
    case "estado":
      pintarFicha(lado);
      if (suceso.estado) {
        sonidos.estado();
        efectos.aura(lado, COLOR_ESTADO[suceso.estado] || "#ffffff", { anillos: 2, sube: false });
      } else sonidos.cura();
      return esperar(800);
    case "cambios": {
      pintarFicha("p1");
      pintarFicha("p2");
      const sube = suceso.cuanto > 0 || suceso.intercambio || suceso.copia || suceso.quitarNegativos;
      if (suceso.cuanto || suceso.intercambio || suceso.copia || suceso.invertir || suceso.quitarNegativos || suceso.quitarPositivos) {
        if (sube) sonidos.sube();
        else sonidos.baja();
        const quien = lado || (suceso.intercambio && suceso.intercambio.a.lado) || (suceso.copia && suceso.copia.a.lado);
        if (quien) efectos.flechas(quien, sube, modulos.urlFlecha(sube));
      }
      return esperar(suceso.texto ? 850 : 200);
    }
    case "forma":
      sonidos.transformacion();
      pintarCampo();
      animar(lado, "sale");
      return esperar(400);
    case "mega":
    case "zeta":
      efectos.destello(lado, suceso.tipo === "zeta" ? "#ffe066" : "#ffffff");
      sonidos.brillo();
      return esperar(900);
    case "tera": {
      const color = coloresTipo[suceso.tera] || "#7fd8ff";
      sonidos.transformacion();
      efectos.destello(lado, color);
      efectos.cristales(lado, color);
      pintarCampo();
      return esperar(1100);
    }
    case "dinamax":
      sonidos.transformacion();
      if (suceso.activo) efectos.destello(lado, "#ff4f6d");
      pintarCampo();
      return esperar(900);
    case "transforma":
      sonidos.transformacion();
      efectos.destello(lado, "#d9b3ff");
      pintarCampo();
      animar(lado, "sale");
      return esperar(900);
    case "lado":
      sonidos.brillo();
      pintarCampo();
      return esperar(900);
    case "campo":
    case "clima":
      sonidos.brillo();
      pintarCampo();
      return esperar(suceso.texto ? 900 : 300);
    case "turno":
      pintarCampo();
      return esperar(250);
    case "fin": {
      const ganoYo = suceso.ganador === abierto.lado;
      if (ganoYo) sonidos.victoria();
      else if (suceso.ganador) sonidos.derrota();
      return esperar(400);
    }
    case "revela":
      return undefined;
    default:
      return suceso.texto ? esperar(850) : undefined;
  }
}

// Va sacando los sucesos de la cola, de uno en uno, con su animación. Al acabar, los botones.
async function reproducir() {
  if (abierto.reproduciendo) return;
  abierto.reproduciendo = true;
  const yoMismo = abierto;
  pintarAcciones();
  while (yoMismo === abierto && abierto.cola.length) {
    const suceso = abierto.cola.shift();
    const lado = suceso.lado && abierto.vista[suceso.lado];
    const antes = suceso.tipo === "ps" && lado && lado.activo && lado.activo.nombre === suceso.nombre ? lado.activo.ps : null;
    aplicarSuceso(suceso);
    if (abierto.rapido) continue;
    await animarSuceso(suceso, antes);
    if (yoMismo !== abierto) return;
    if (suceso.texto || suceso.tipo === "turno") pintarRegistro();
  }
  if (yoMismo !== abierto) return;
  abierto.reproduciendo = false;
  abierto.rapido = false;
  pintarCampo();
  pintarRegistro();
  pintarAcciones();
  // Repetición en marcha: el turno siguiente, después de una pausa
  const repeticion = abierto.repeticion;
  if (repeticion && repeticion.auto) {
    if (repeticion.actual >= repeticion.segmentos.length) {
      repeticion.auto = false;
      pintarAcciones();
    } else {
      setTimeout(() => {
        if (abierto === yoMismo && repeticion.auto && !abierto.reproduciendo) irATurno(repeticion.actual + 1, { animar: true });
      }, 600);
    }
  }
}

// ---------- Repetición (con el combate ya terminado) ----------
//
// Los sucesos se parten por turnos: el primer trozo es lo de antes del turno 1 (salen los primeros) y
// cada uno de los demás empieza con su «Turno N». «actual» es cuántos trozos están ya aplicados:
// ir atrás o saltar a uno vuelve a empezar desde cero y aplica de golpe hasta ahí; ir adelante anima
// el trozo siguiente.

// Se prepara con el combate ya entero; si la historia ha crecido desde entonces (al abrir uno terminado,
// los turnos llegan después), se vuelve a partir.
function prepararRepeticion() {
  if (abierto.repeticion && abierto.repeticion.largo === abierto.historia.length) return abierto.repeticion;
  const segmentos = [[]];
  for (const suceso of abierto.historia) {
    if (suceso.tipo === "turno") segmentos.push([suceso]);
    else segmentos[segmentos.length - 1].push(suceso);
  }
  abierto.repeticion = { segmentos, actual: segmentos.length, auto: false, largo: abierto.historia.length };
  pintarRegistro();
  return abierto.repeticion;
}

// controles: false mientras se arrastra la barra (repintarla la soltaría de la mano)
function irATurno(destino, { animar = false, controles = true } = {}) {
  const repeticion = abierto.repeticion;
  if (!repeticion) return;
  const total = repeticion.segmentos.length;
  destino = Math.max(0, Math.min(total, destino));
  // Lo que se estuviera animando se deja: se vuelve a pintar todo desde cero
  abierto.cola = [];
  abierto.vista = nuevaVista();
  abierto.registro = [];
  const hasta = animar ? destino - 1 : destino;
  for (const segmento of repeticion.segmentos.slice(0, hasta)) for (const suceso of segmento) aplicarSuceso(suceso);
  repeticion.actual = destino;
  abierto.animandoPS = false;
  ponerMensaje("");
  pintarCampo({ sprites: true });
  pintarRegistro();
  if (animar && destino > 0) {
    abierto.rapido = false;
    abierto.cola.push(...repeticion.segmentos[destino - 1]);
    reproducir();
  }
  if (controles) pintarAcciones();
  else {
    const texto = vistaCombate.querySelector(".lucha-rep-turno");
    if (texto) texto.textContent = textoTurnoRepeticion(repeticion);
  }
}

function textoTurnoRepeticion(repeticion) {
  const turnos = repeticion.segmentos.length - 1;
  const actual = repeticion.actual === 0 ? 0 : repeticion.actual - 1;
  return actual === 0 ? t("repeticion|Inicio") : t("Turno {n} de {total}", { n: actual, total: turnos });
}

function controlesRepeticion() {
  const repeticion = prepararRepeticion();
  const total = repeticion.segmentos.length;
  const boton = (accion, icono2, titulo, desactivado = false) =>
    `<button type="button" class="boton-gris lucha-rep-boton" data-rep="${accion}" title="${titulo}" ${desactivado ? "disabled" : ""}>${icono(icono2)}</button>`;
  return `
    <div class="lucha-repeticion">
      <span class="etiqueta-campo">${t("Repetición")}</span>
      <div class="lucha-rep-fila">
        ${boton("inicio", "principio", t("Al principio"), repeticion.actual === 0)}
        ${boton("atras", "atras", t("Turno anterior"), repeticion.actual === 0)}
        ${boton("auto", repeticion.auto ? "pausa" : "reanudar", repeticion.auto ? t("Pausa") : t("Reproducir"))}
        ${boton("adelante", "adelante", t("Turno siguiente"), repeticion.actual >= total)}
        ${boton("final", "final", t("Al final"), repeticion.actual >= total)}
        <input type="range" class="lucha-rep-barra" min="0" max="${total}" value="${repeticion.actual}" aria-label="${t("Turno")}">
        <span class="lucha-rep-turno">${textoTurnoRepeticion(repeticion)}</span>
      </div>
    </div>`;
}

function encolar(sucesos) {
  abierto.cola.push(...sucesos);
  abierto.historia.push(...sucesos);
}

// ---------- Avanzar con las elecciones que han llegado ----------

function turnoActual() {
  return abierto.turnos[abierto.combate.decisiones] || {};
}

// Mete en el motor todas las decisiones completas que haya y pone en la cola lo que pasa
async function avanzar() {
  if (abierto.avanzando) {
    abierto.otraVez = true;
    return;
  }
  abierto.avanzando = true;
  const yoMismo = abierto;
  try {
    do {
      abierto.otraVez = false;
      for (;;) {
        const necesitan = abierto.combate.necesitan();
        if (!necesitan.length) break;
        const turno = turnoActual();
        if (!necesitan.every((lado) => turno[`e${numeroDe(lado)}`])) break;
        // Elegían los dos a la vez: cada elección tiene que casar con su sello
        if (necesitan.length === 2) {
          for (const lado of necesitan) {
            const n = numeroDe(lado);
            if (turno[`s${n}`] && (await sello(turno[`e${n}`])) !== turno[`s${n}`]) {
              if (yoMismo !== abierto) return;
              abierto.trampa = lado;
              pintarAcciones();
              return;
            }
          }
          if (yoMismo !== abierto) return;
        }
        abierto.combate.aplicar(Object.fromEntries(necesitan.map((lado) => [lado, sinSal(turno[`e${numeroDe(lado)}`])])));
        encolar(abierto.lector.leer(abierto.combate.lineasNuevas()));
      }
      await destaparSiToca();
      if (yoMismo !== abierto) return;
    } while (abierto.otraVez);
  } finally {
    if (yoMismo === abierto) abierto.avanzando = false;
  }
  if (yoMismo !== abierto) return;
  apuntarEsperaYFinal();
  if (abierto.primeraVez) {
    // Lo de antes de entrar, de golpe; se anima solo lo que llegue a partir de ahora
    abierto.primeraVez = false;
    abierto.rapido = true;
  }
  reproducir();
}

// Mi elección sellada se destapa en cuanto está también el sello del otro
async function destaparSiToca() {
  const necesitan = abierto.combate.necesitan();
  if (necesitan.length !== 2) return;
  const turno = turnoActual();
  const mio = numeroDe(abierto.lado);
  const suyo = mio === 1 ? 2 : 1;
  if (!turno[`s${mio}`] || turno[`e${mio}`] || !turno[`s${suyo}`]) return;
  const pendiente = pendienteDe(abierto.id, abierto.combate.decisiones);
  if (!pendiente) {
    abierto.sinPendiente = true;
    return;
  }
  await apuntarEnTurno(abierto.id, abierto.combate.decisiones, `e${mio}`, pendiente);
}

// A quién le toca (para la lista y la campana) y, si ya ha acabado, apuntar el resultado
function apuntarEsperaYFinal() {
  const { combate, lucha, id } = abierto;
  if (lucha.estado !== "jugando") return;
  if (combate.terminado) {
    if (abierto.finApuntado) return;
    abierto.finApuntado = true;
    const ganador = combate.ganador ? uidDe(combate.ganador) : "empate";
    terminar(id, ganador)
      .then((apuntado) => {
        if (apuntado && lucha.locke && ganador !== "empate") return sumarVictoriaCombate(lucha.locke.id, lucha.locke.combate, ganador);
        return null;
      })
      .catch((error) => console.error("No se ha podido apuntar el final de la lucha", error));
    return;
  }
  const turno = turnoActual();
  const espera = combate.necesitan()
    .filter((lado) => !turno[`s${numeroDe(lado)}`] && !turno[`e${numeroDe(lado)}`])
    .map(uidDe);
  ponerEspera(id, espera).catch((error) => console.error("No se ha podido apuntar a quién le toca", error));
}

// ---------- Elegir ----------

async function elegir(eleccion) {
  if (!abierto || abierto.enviando) return;
  const { id, combate, lado } = abierto;
  // El motor tiene que aceptarla: si no, no se manda (antes se cambiaba en silencio por otra)
  if (!combate.valida(lado, eleccion)) {
    avisar(t("Esa elección no se puede hacer ahora."));
    abierto.especial = "";
    pintarAcciones();
    return;
  }
  const n = combate.decisiones;
  const mio = numeroDe(lado);
  const conSuSal = conSal(eleccion);
  abierto.enviando = true;
  abierto.especial = "";
  pintarAcciones();
  try {
    if (combate.necesitan().length === 2) {
      // A la vez que el otro: primero el sello; la elección, cuando esté también el suyo
      guardarPendiente(id, n, conSuSal);
      await apuntarEnTurno(id, n, `s${mio}`, await sello(conSuSal));
    } else {
      await apuntarEnTurno(id, n, `e${mio}`, conSuSal);
    }
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido mandar tu elección. Prueba de nuevo."));
  } finally {
    if (abierto && abierto.id === id) {
      abierto.enviando = false;
      pintarAcciones();
    }
  }
}

// Lo que he elegido, en palabras («move 2 terastallize» -> «Terremoto + Tera»), y el texto de su botón
// de cancelar. null si no se entiende (no debería pasar).
function textoEleccion(eleccion) {
  const peticion = abierto.combate.peticion(abierto.lado);
  if (!peticion) return null;
  const [accion, numero = "", especial] = eleccion.split(" ");
  const n = Number(numero) - 1;
  if (accion === "move") {
    const activa = (peticion.active || [])[0] || {};
    const ataque = (activa.moves || [])[n];
    if (!ataque) return null;
    const zeta = especial === "zmove" ? (activa.canZMove || [])[n] : null;
    const nombre = abierto.modulos.nombreAtaque(zeta ? zeta.move : ataque.move);
    const extra = { mega: "Mega", ultra: t("Ultraexplosión"), dynamax: t("Dinamax"), terastallize: "Tera" }[especial];
    return { texto: extra ? `${nombre} + ${extra}` : nombre, cancelar: t("Cancelar ataque") };
  }
  const nombrePokemon = (i) => String((((peticion.side || {}).pokemon || [])[i] || {}).ident || "").replace(/^p[12]: /, "");
  if (accion === "switch") return { texto: t("cambiar a {nombre}", { nombre: nombrePokemon(n) }), cancelar: t("Cancelar cambio") };
  // «team 312456»: el primero es con quién empiezas
  if (accion === "team") return { texto: t("empezar con {nombre}", { nombre: nombrePokemon(Number(numero[0]) - 1) }), cancelar: t("Cancelar mi elección") };
  return null;
}

function botonAtaque(ataque, i, peticionActiva) {
  const motor = abierto.modulos;
  const datos = dex().moves.get(ataque.id);
  const tipo = (datos.type || "Normal").toLowerCase();
  const especial = abierto.especial;
  const zeta = especial === "zmove" ? (peticionActiva.canZMove || [])[i] : null;
  const desactivado = ataque.disabled || ataque.pp === 0 || (especial === "zmove" && !zeta);
  const nombreVisible = zeta ? zeta.move : ataque.move;
  const clase = datos.category === "Physical" ? t("Físico") : datos.category === "Special" ? t("Especial") : t("Estado");
  return `
    <button type="button" class="lucha-ataque" data-eleccion="move ${i + 1}" data-bocadillo="ataque:${i}" style="--tipo: ${coloresTipo[tipo] || "#888"}" ${desactivado ? "disabled" : ""}>
      ${iconoTipo(tipo)}
      <strong>${escaparHTML(motor.nombreAtaque(nombreVisible))}</strong>
      <small>${escaparHTML(tiposEs[tipo] || tipo)} · ${escaparHTML(clase)}${datos.basePower > 1 ? ` · ${datos.basePower}` : ""}</small>
      <span class="lucha-pp">${ataque.pp ?? "-"}/${ataque.maxpp ?? "-"}</span>
    </button>`;
}

// Mis Pokémon para cambiar (o para elegir con quién empiezo)
function botonesEquipo(peticion, { vistaPrevia = false, atrapado = false } = {}) {
  return peticion.side.pokemon
    .map((pokemon, i) => {
      const nombrePokemon = pokemon.ident.replace(/^p[12]: /, "");
      const posicion = abierto.combate.posicionDe(abierto.lado, nombrePokemon);
      const [ps, psMax] = String(pokemon.condition).split(" ")[0].split("/").map(Number);
      const estado = String(pokemon.condition).split(" ")[1] || "";
      const caido = estado === "fnt" || !ps;
      const nivel = (/, L(\d+)/.exec(pokemon.details) || [])[1] || 100;
      const desactivado = vistaPrevia ? false : pokemon.active || caido || atrapado;
      const parte = psMax ? ps / psMax : 0;
      return `
        <button type="button" class="lucha-cambio ${pokemon.active && !vistaPrevia ? "en-campo" : ""} ${caido ? "caido" : ""}"
          data-${vistaPrevia ? "primero" : "eleccion"}="${vistaPrevia ? i + 1 : `switch ${i + 1}`}" data-bocadillo="hueco:${abierto.lado}:${posicion}" ${desactivado ? "disabled" : ""}>
          ${retratoDe(abierto.lado, posicion)}
          <span class="lucha-cambio-datos">
            <strong>${escaparHTML(nombrePokemon)}</strong>
            <small>${t("Nv.")} ${nivel}${estado && estado !== "fnt" ? ` · ${escaparHTML((abierto.modulos.ESTADOS[estado] || {}).corto || estado)}` : ""}</small>
            ${vistaPrevia
              ? `<span class="lucha-previa-tipos">${(dex().species.get(pokemon.details.split(",")[0]).types || []).map((tipo) => iconoTipo(tipo.toLowerCase())).join("")}</span>`
              : `<span class="lucha-ps ${claseBarra(parte)}"><span style="width: ${(parte * 100).toFixed(1)}%"></span></span>`}
          </span>
        </button>`;
    })
    .join("");
}

// Megaevolucionar, Z, Dinamax y Tera: siempre los cuatro, en columna a la derecha de los ataques. Encendido
// el que se puede usar ahora (lo ofrece el motor y no se ha usado ya en el combate); los demás, apagados.
// La Ultraexplosión (Necrozma) va en el botón de la Mega.
function botonesEspeciales(activa) {
  const { usados, activo } = abierto.vista[abierto.lado];
  const yaMega = activo && dex().species.get(activo.especie).isMega;
  const tipoTera = String(activa.canTerastallize || "").toLowerCase();
  const ultra = Boolean(activa.canUltraBurst && !usados.has("ultra"));
  const opciones = [
    { valor: ultra ? "ultra" : "mega", texto: ultra ? t("Ultraexplosión") : t("Megaevolucionar"), corto: "Mega",
      puede: ultra || Boolean(activa.canMegaEvo && !usados.has("mega") && !yaMega) },
    { valor: "zmove", texto: t("Movimiento Z"), corto: "Z", puede: Boolean(activa.canZMove && !usados.has("zeta")) },
    { valor: "dynamax", texto: t("Dinamax"), corto: t("Dinamax"), puede: Boolean(activa.canDynamax && !usados.has("dinamax")) },
    { valor: "terastallize", texto: tipoTera ? t("Teracristalizar ({tipo})", { tipo: tiposEs[tipoTera] || tipoTera }) : t("Teracristalizar"),
      corto: "Tera", tipo: tipoTera, puede: Boolean(activa.canTerastallize && !usados.has("tera") && !(activo && activo.tera)) }
  ];
  if (abierto.especial && !opciones.some((opcion) => opcion.puede && opcion.valor === abierto.especial)) abierto.especial = "";
  return `<div class="lucha-especiales">${opciones
    .map((opcion) => `
      <button type="button" class="lucha-especial ${opcion.puede ? "" : "apagado"} ${abierto.especial === opcion.valor ? "elegido" : ""}"
        data-especial="${opcion.valor}" title="${escaparHTML(opcion.texto)}" ${opcion.puede ? "" : "disabled"}>
        ${opcion.tipo ? iconoTipo(opcion.tipo) : ""}<span>${escaparHTML(opcion.corto)}</span>
      </button>`)
    .join("")}</div>`;
}

// El panel «Cambiar» (bajo el registro): tu equipo en iconos para cambiar. Solo cuando toca elegir;
// «destacado» cuando cambiar es lo único que se puede hacer (tras un debilitado).
function pintarCambios(peticion, { atrapado = false, destacado = false } = {}) {
  const panel = vistaCombate.querySelector(".lucha-cambios");
  if (!panel) return;
  panel.hidden = !peticion;
  panel.classList.toggle("destacado", destacado);
  if (!peticion) return;
  panel.querySelector("h3").innerHTML = `${icono("intercambiar")} ${atrapado ? t("No puede huir ni cambiar") : t("lucha|Cambiar")}`;
  panel.querySelector(".lucha-cambios-mini").innerHTML = botonesCambioMini(peticion, { atrapado });
}

function pintarAcciones() {
  if (!abierto) return;
  const caja = vistaCombate.querySelector(".lucha-acciones");
  pintarCambios(null);
  const { combate, lado, lucha } = abierto;
  const rival = nombreEn(lucha, rivalDe(lucha, yo()));
  const boton = vistaCombate.querySelector(".lucha-rendirse");
  boton.hidden = lucha.estado !== "jugando" || combate.terminado;

  if (abierto.trampa) {
    caja.innerHTML = `<p class="lucha-espera error">${t("La elección de {nombre} no casa con la que selló: el combate se ha parado.", {
      nombre: escaparHTML(abierto.trampa === lado ? t("tu lado") : rival)
    })}</p>`;
    return;
  }
  if (abierto.reproduciendo && !abierto.repeticion) {
    caja.innerHTML = `<p class="lucha-espera"><button type="button" class="boton-gris lucha-saltar">${t("Saltar")}</button></p>`;
    return;
  }

  // Abriendo uno: hasta que llegan los turnos, nada (si no, la repetición saldría sin ellos)
  if (abierto.primeraVez) {
    caja.innerHTML = `<p class="lucha-espera">${t("Cargando el combate...")}</p>`;
    return;
  }

  // Terminado (o rendido)
  if (combate.terminado || lucha.estado === "fin") {
    const ganador = lucha.estado === "fin" ? lucha.ganador : combate.ganador ? uidDe(combate.ganador) : "empate";
    const gano = ganador === yo();
    const texto = ganador === "empate"
      ? t("¡Empate!")
      : lucha.rendido
        ? lucha.rendido === yo() ? t("Te has rendido. Gana {nombre}.", { nombre: escaparHTML(rival) }) : t("¡{nombre} se ha rendido! Has ganado.", { nombre: escaparHTML(rival) })
        : gano ? t("¡Has ganado!") : t("Has perdido. Gana {nombre}.", { nombre: escaparHTML(rival) });
    const locke = textoLocke(lucha);
    caja.innerHTML = `
      <div class="lucha-final ${ganador === "empate" ? "" : gano ? "gana" : "pierde"}">
        <strong>${texto}</strong>
        ${locke && ganador !== "empate" ? `<small>${t("Apuntado en el locke: {locke}", { locke: escaparHTML(locke) })}</small>` : ""}
        <button type="button" class="boton-gris lucha-volver">${t("Volver a los combates")}</button>
      </div>
      ${controlesRepeticion()}`;
    return;
  }

  const necesitan = combate.necesitan();
  const turno = turnoActual();
  const mio = numeroDe(lado);
  const yaElegi = turno[`s${mio}`] || turno[`e${mio}`];

  if (!necesitan.includes(lado) || yaElegi || abierto.enviando) {
    const texto = abierto.enviando
      ? t("Mandando...")
      : abierto.sinPendiente
        ? t("Elegiste desde otro sitio: sigue el combate desde allí para destapar tu elección.")
        : yaElegi && necesitan.length === 2
          ? t("Elección sellada. Esperando a {nombre}...", { nombre: escaparHTML(rival) })
          : t("Esperando a {nombre}...", { nombre: escaparHTML(rival) });
    // Sellada y el otro aún sin sellar: se puede cancelar. Se dice qué elegiste y el botón va bien a la vista.
    const suyo = mio === 1 ? 2 : 1;
    const cancelable = !abierto.enviando && necesitan.length === 2 && turno[`s${mio}`] && !turno[`e${mio}`] && !turno[`s${suyo}`];
    if (cancelable) {
      const pendiente = pendienteDe(abierto.id, combate.decisiones);
      const cual = pendiente ? textoEleccion(sinSal(pendiente)) : null;
      caja.innerHTML = `
        <div class="lucha-elegida">
          <p>${cual
            ? `${t("Has elegido {eleccion}.", { eleccion: `<strong>${escaparHTML(cual.texto)}</strong>` })} ${t("Esperando a {nombre}...", { nombre: escaparHTML(rival) })}`
            : texto}</p>
          <button type="button" class="boton-gris lucha-cancelar-eleccion">${icono("deshacer")} ${cual ? cual.cancelar : t("Cancelar mi elección")}</button>
        </div>`;
      return;
    }
    caja.innerHTML = `<p class="lucha-espera">${texto}</p>`;
    return;
  }

  const peticion = combate.peticion(lado);
  if (!peticion) {
    caja.innerHTML = "";
    return;
  }

  // Antes de empezar: los dos equipos se ven en el campo (pintarPrevia); aquí, con quién sales
  if (peticion.teamPreview) {
    caja.innerHTML = `
      <p class="lucha-pregunta">${t("Elige con quién empiezas")}</p>
      <div class="lucha-equipo">${botonesEquipo(peticion, { vistaPrevia: true })}</div>`;
    return;
  }

  // Tras un debilitado: solo cambiar (en el panel de la derecha, que se destaca)
  if (peticion.forceSwitch) {
    caja.innerHTML = `<p class="lucha-pregunta">${t("¿A quién sacas? Elígelo en «Cambiar».")}</p>`;
    pintarCambios(peticion, { destacado: true });
    return;
  }

  // Los ataques, con Mega, Z, Dinamax y Tera en columna a su derecha; cambiar va en su panel, bajo el registro
  const activa = (peticion.active || [])[0] || { moves: [] };
  const atrapado = Boolean(activa.trapped);
  caja.innerHTML = `
    <p class="lucha-pregunta">${t("¿Qué hará {nombre}?", { nombre: escaparHTML((abierto.vista[lado].activo || {}).nombre || "") })}</p>
    <div class="lucha-elegir">
      <div class="lucha-ataques">${activa.moves.map((ataque, i) => botonAtaque(ataque, i, activa)).join("")}</div>
      ${botonesEspeciales(activa)}
    </div>`;
  pintarCambios(peticion, { atrapado });
}

// Tus Pokémon para cambiar, en pequeño (su retrato, su vida y su estado; el resto, en su bocadillo).
// Sin «disabled» (los botones desactivados no avisan al pasar el ratón y no saldría el bocadillo):
// aria-disabled, y el clic lo mira.
function botonesCambioMini(peticion, { atrapado = false } = {}) {
  return peticion.side.pokemon
    .map((pokemon, i) => {
      const nombrePokemon = pokemon.ident.replace(/^p[12]: /, "");
      const posicion = abierto.combate.posicionDe(abierto.lado, nombrePokemon);
      const [ps, psMax] = String(pokemon.condition).split(" ")[0].split("/").map(Number);
      const estado = String(pokemon.condition).split(" ")[1] || "";
      const caido = estado === "fnt" || !ps;
      const parte = psMax ? ps / psMax : 0;
      const desactivado = pokemon.active || caido || atrapado;
      return `
        <button type="button" class="lucha-cambio-mini ${pokemon.active ? "en-campo" : ""} ${caido ? "caido" : ""}"
          data-eleccion="switch ${i + 1}" data-bocadillo="hueco:${abierto.lado}:${posicion}" aria-disabled="${desactivado}">
          ${retratoDe(abierto.lado, posicion)}
          <span class="lucha-ps ${claseBarra(parte)}"><span style="width: ${(parte * 100).toFixed(1)}%"></span></span>
          ${estado && estado !== "fnt" ? `<span class="lucha-hueco-estado estado-${estado}">${escaparHTML((abierto.modulos.ESTADOS[estado] || {}).corto || "")}</span>` : ""}
        </button>`;
    })
    .join("");
}

// ---------- Bocadillos: lo que sale al poner el ratón encima ----------
//
// Con las mismas fichas que «Crear equipo» (css/equipos.css: .ficha-stats con sus barras, .ataque del
// color de su tipo, .ficha-ataque, las debilidades de js/comun/fichas-pokemon.js):
//   · Un Pokémon tuyo: sus estadísticas de verdad, habilidad, objeto y sus ataques con los PP.
//   · Uno del rival: lo que se sabe (como en el juego): sus PS en %, su estado, entre qué valores puede
//     estar su velocidad, la habilidad y el objeto si se han visto, y los ataques que ha usado con los PP
//     que le quedarían (contando cuántas veces los ha usado). Sin stats base ni debilidades: era demasiado.
//   · Un ataque tuyo: tipo, categoría, potencia, precisión, PP, descripción y si es eficaz contra el
//     que tienes delante (sin decir cuánto le quitaría: eso es demasiada pista).

const descripciones = new Map(); // id de PokeAPI del ataque -> descripción (o promesa)

function nombreHabilidadDe(id) {
  const habilidad = dex().abilities.get(id);
  return habilidad.exists ? abierto.modulos.nombreHabilidad(habilidad.name) : "";
}

function nombreObjetoDe(id) {
  const objeto = dex().items.get(id);
  return objeto.exists ? abierto.modulos.nombreObjeto(objeto.name) : "";
}

// Los tipos que tiene ahora (teracristalizado, transformado...), en minúsculas («fire»)
function tiposVisibles(activo, especieNombre) {
  if (activo && activo.tera) return [activo.tera];
  const especie = dex().species.get((activo && (activo.especieTransformado || activo.especie)) || especieNombre || "");
  return (especie.types || []).map((tipo) => tipo.toLowerCase());
}

function chipsTipos(tipos) {
  return tipos.map((tipo) => `<span class="lucha-bocadillo-tipo" style="--c: ${coloresTipo[tipo] || "#888"}">${iconoTipo(tipo)} ${escaparHTML(tiposEs[tipo] || tipo)}</span>`).join("");
}

// La eficacia de un tipo de ataque contra unos tipos (0, 0.25, 0.5, 1, 2, 4)
function eficaciaContra(tipoAtaque, tipos) {
  const nombres = tipos.map((tipo) => tipo.charAt(0).toUpperCase() + tipo.slice(1));
  if (!dex().getImmunity(tipoAtaque, nombres)) return 0;
  return 2 ** dex().getEffectiveness(tipoAtaque, nombres);
}

// La velocidad que puede tener alguien sin saber su entrenamiento: de la peor a la mejor
function velocidadPosible(base, nivel) {
  const stat = (iv, ev, naturaleza) => Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * nivel) / 100) + 5) * naturaleza);
  return [stat(0, 0, 0.9), stat(31, 252, 1.1)];
}

// Lo que se sabe en este momento de un Pokémon de un equipo (por su posición en el equipo):
// { set, nombre (el del combate), visto, activo, conocido }
function datosDeHueco(lado, posicion) {
  const set = abierto.combate.sets[lado].find((cada) => cada.posicion === posicion);
  if (!set) return null;
  // El nombre con el que sale en el combate (el del motor: un «Tyranitar-Mega» sin mote es «Tyranitar»)
  const delMotor = pokemonDelMotor(lado, posicion);
  const nombre = delMotor ? delMotor.name : set.name || set.species;
  const vista = abierto.vista[lado];
  const activo = vista.activo && vista.activo.posicion === posicion ? vista.activo : null;
  return { set, nombre, visto: vista.vistos[nombre] || null, activo, conocido: conocidoDe(lado, nombre) };
}

// ¿Se puede saber qué Pokémon es? Los tuyos, siempre; los del rival, con vista previa o si ya han salido
function seConoce(lado, datos) {
  return lado === abierto.lado || abierto.lucha.vistaPrevia !== false || Boolean(datos.visto);
}

// El Pokémon del motor (el tuyo): sus estadísticas y sus PP de verdad
function pokemonDelMotor(lado, posicion) {
  return abierto.combate.motor[lado].pokemon.find((pokemon) => pokemon.set && pokemon.set.posicion === posicion) || null;
}

const STATS_ORDEN = ["hp", "atk", "def", "spa", "spd", "spe"];
const NOMBRES_STATS = () => [t("stat|PS"), t("stat|Ataque"), t("stat|Defensa"), t("stat|At. Esp."), t("stat|Def. Esp."), t("stat|Velocidad")];

function tarjetasAtaques(lista) {
  if (!lista.length) return "";
  return `<div class="ataques lucha-bocadillo-ataques">${lista.map(({ nombre: nombreAtaque, tipo, pp }) => `
    <div class="ataque" style="background:${coloresTipo[tipo] || "#888"}">
      ${iconoTipo(tipo)}
      <span class="ataque-nombre">${escaparHTML(nombreAtaque)}</span>
      ${pp ? `<span class="lucha-bocadillo-pp">${escaparHTML(pp)}</span>` : ""}
    </div>`).join("")}</div>`;
}

function bocadilloPokemon(lado, posicion) {
  const datos = datosDeHueco(lado, posicion);
  if (!datos || !seConoce(lado, datos)) return "";
  const { set, nombre, visto, activo, conocido } = datos;
  const mio = lado === abierto.lado;
  const especie = dex().species.get(activo && activo.especie ? activo.especie : set.species);
  const tipos = tiposVisibles(activo, especie.name);
  const nivel = set.level || 100;
  // Del rival, el mote solo si ya ha salido
  const titulo = mio || visto ? nombre : especie.name;
  const cabecera = `
    <div class="ficha-titulo">${escaparHTML(titulo)}${titulo !== especie.name ? ` <small>(${escaparHTML(especie.name)})</small>` : ""}<small class="lucha-bocadillo-nivel">${t("Nv.")} ${nivel}</small></div>
    <div class="lucha-bocadillo-tipos">${chipsTipos(tipos)}</div>`;

  const estado = (visto && visto.estado) || (activo && activo.estado) || "";
  const caido = Boolean(visto && visto.debilitado);

  if (activo && activo.transformadoDe) return bocadilloTransformado(lado, datos, estado);

  if (mio) {
    const motor = pokemonDelMotor(lado, posicion);
    const psMax = (visto && visto.psMax) || (motor && motor.maxhp) || 0;
    const ps = visto ? visto.ps : psMax;
    const stats = motor ? { hp: motor.maxhp, ...motor.storedStats } : null;
    const cambios = (activo && activo.cambios) || {};
    const filas = stats
      ? STATS_ORDEN.map((stat, i) => {
        const etapa = cambios[stat] || 0;
        const nombreStat = etapa ? `${NOMBRES_STATS()[i]} <em class="${etapa > 0 ? "sube" : "baja"}">${etapa > 0 ? "+" : ""}${etapa}</em>` : NOMBRES_STATS()[i];
        return filaStat(nombreStat, stats[stat], stat === "hp" ? 400 : 300, 40, 180);
      }).join("")
      : "";
    // PP: en la repetición, contados con lo visto; jugando, los del motor
    const enRepeticion = Boolean(abierto.repeticion);
    const ataques = (set.moves || []).map((nombreAtaque) => {
      const ataque = dex().moves.get(nombreAtaque);
      const hueco = motor && motor.baseMoveSlots ? motor.baseMoveSlots.find((cada) => cada.id === ataque.id) : null;
      const maximo = hueco ? hueco.maxpp : Math.floor((ataque.pp || 0) * 1.6);
      const usados = conocido.ataques.get(ataque.name) || 0;
      const quedan = enRepeticion || !hueco ? Math.max(0, maximo - usados) : hueco.pp;
      return { nombre: abierto.modulos.nombreAtaque(ataque.name), tipo: (ataque.type || "Normal").toLowerCase(), pp: `${quedan}/${maximo}` };
    });
    return `
      <div class="ficha ficha-stats lucha-bocadillo">
        ${cabecera}
        <p class="lucha-bocadillo-ps">${t("PS")}: <b>${caido ? t("Debilitado") : `${ps}/${psMax}`}</b> ${chipEstado(estado)}</p>
        ${filas}
        <p>${t("Habilidad")}: <b>${escaparHTML(nombreHabilidadDe(set.ability) || "—")}</b></p>
        <p>${t("Objeto")}: <b>${escaparHTML(nombreObjetoDe(set.item) || t("ninguno"))}</b></p>
        ${tarjetasAtaques(ataques)}
      </div>`;
  }

  // Del rival: lo que se ve
  const porcentaje = visto ? Math.round(visto.psMax ? (visto.ps / visto.psMax) * 100 : 0) : 100;
  const [lenta, rapida] = velocidadPosible(especie.baseStats.spe, nivel);
  const posibles = Object.values(especie.abilities || {}).map((habilidad) => abierto.modulos.nombreHabilidad(habilidad));
  const ataques = [...conocido.ataques.entries()].map(([nombreAtaque, usos]) => {
    const ataque = dex().moves.get(nombreAtaque);
    const maximo = ataque.noPPBoosts ? ataque.pp : Math.floor((ataque.pp || 0) * 1.6);
    return { nombre: abierto.modulos.nombreAtaque(ataque.name), tipo: (ataque.type || "Normal").toLowerCase(), pp: `${Math.max(0, maximo - usos)}/${maximo}` };
  });
  return `
    <div class="ficha ficha-stats lucha-bocadillo">
      ${cabecera}
      <p class="lucha-bocadillo-ps">${t("PS")}: <b>${caido ? t("Debilitado") : `${porcentaje} %`}</b> ${chipEstado(estado)}</p>
      <p>${t("Velocidad: entre {min} y {max}", { min: lenta, max: rapida })}</p>
      <p>${t("Habilidad")}: <b>${escaparHTML(conocido.habilidad ? abierto.modulos.nombreHabilidad(conocido.habilidad) : posibles.join(" / "))}</b>${conocido.habilidad ? "" : ` <small>(${t("sin ver")})</small>`}</p>
      <p>${t("Objeto")}: <b>${escaparHTML(conocido.objeto ? abierto.modulos.nombreObjeto(conocido.objeto) : t("sin ver"))}</b></p>
      ${ataques.length ? `<span class="lucha-bocadillo-etiqueta">${t("Ataques vistos")}</span>${tarjetasAtaques(ataques)}` : ""}
    </div>`;
}

// Transformado (Transformación, Impostor): hasta que se retire es una copia del otro. Se enseña lo copiado:
// sus tipos, su habilidad, sus estadísticas (menos los PS, que son los suyos) y sus ataques, con 5 PP cada
// uno, como en los juegos. Al saber cómo es el copiado, del rival también se sabe todo eso.
function bocadilloTransformado(lado, datos, estado) {
  const { set, nombre, visto, activo, conocido } = datos;
  const mio = lado === abierto.lado;
  const { lado: suLado, posicion: suPosicion } = activo.transformadoDe;
  const copiado = abierto.combate.sets[suLado].find((cada) => cada.posicion === suPosicion);
  const motorCopiado = pokemonDelMotor(suLado, suPosicion);
  const especieCopiada = dex().species.get(activo.especieTransformado || (copiado && copiado.species) || "");
  const tipos = tiposVisibles(activo, especieCopiada.name);
  const caido = Boolean(visto && visto.debilitado);
  const titulo = mio || visto ? nombre : dex().species.get(set.species).name;

  const ps = mio
    ? (visto ? `${visto.ps}/${visto.psMax}` : "—")
    : `${visto && visto.psMax ? Math.round((visto.ps / visto.psMax) * 100) : 100} %`;
  const cambios = activo.cambios || {};
  const filas = motorCopiado
    ? STATS_ORDEN.slice(1).map((stat, i) => {
      const etapa = cambios[stat] || 0;
      const nombreStat = etapa ? `${NOMBRES_STATS()[i + 1]} <em class="${etapa > 0 ? "sube" : "baja"}">${etapa > 0 ? "+" : ""}${etapa}</em>` : NOMBRES_STATS()[i + 1];
      return filaStat(nombreStat, motorCopiado.storedStats[stat], 300, 40, 180);
    }).join("")
    : "";
  const ataques = ((copiado && copiado.moves) || []).map((nombreAtaque) => {
    const ataque = dex().moves.get(nombreAtaque);
    const usados = activo.usosTransformado[ataque.name] || 0;
    return { nombre: abierto.modulos.nombreAtaque(ataque.name), tipo: (ataque.type || "Normal").toLowerCase(), pp: `${Math.max(0, 5 - usados)}/5` };
  });
  const objeto = mio
    ? nombreObjetoDe(set.item) || t("ninguno")
    : conocido.objeto ? abierto.modulos.nombreObjeto(conocido.objeto) : t("sin ver");

  return `
    <div class="ficha ficha-stats lucha-bocadillo">
      <div class="ficha-titulo">${escaparHTML(titulo)} <small>(${escaparHTML(t("transformado en {especie}", { especie: especieCopiada.name }))})</small><small class="lucha-bocadillo-nivel">${t("Nv.")} ${set.level || 100}</small></div>
      <div class="lucha-bocadillo-tipos">${chipsTipos(tipos)}</div>
      <p class="lucha-bocadillo-ps">${t("PS")}: <b>${caido ? t("Debilitado") : ps}</b> ${chipEstado(estado)}</p>
      ${filas}
      <p>${t("Habilidad")}: <b>${escaparHTML((copiado && nombreHabilidadDe(copiado.ability)) || "—")}</b></p>
      <p>${t("Objeto")}: <b>${escaparHTML(objeto)}</b></p>
      ${tarjetasAtaques(ataques)}
    </div>`;
}

// Un ataque tuyo, con la ficha de ataque de «Crear equipo» (del color de su tipo)
function bocadilloAtaque(indice, elemento) {
  const peticion = abierto.combate.peticion(abierto.lado);
  const activa = peticion && (peticion.active || [])[0];
  const datos = activa && activa.moves[indice];
  if (!datos) return "";
  const ataque = dex().moves.get(datos.id);
  const tipo = (ataque.type || "Normal").toLowerCase();
  const categoria = ataque.category === "Physical" ? t("Físico") : ataque.category === "Special" ? t("Especial") : t("Estado");

  // Descripción: en inglés, la del motor; en español, la de PokeAPI (se trae la primera vez)
  let descripcion = enIngles ? ataque.shortDesc || ataque.desc || "" : "";
  if (!enIngles) {
    const entrada = datosWeb && buscarPorNombreIngles(datosWeb.ataques, ataque.name);
    const guardada = entrada && descripciones.get(entrada.id);
    if (typeof guardada === "string") descripcion = guardada;
    else if (entrada && !guardada) {
      descripciones.set(entrada.id, descripcionAtaque(entrada.id)
        .then((texto) => {
          descripciones.set(entrada.id, texto || "");
          actualizarTooltip(elemento, bocadilloAtaque(indice, elemento));
        })
        .catch(() => descripciones.set(entrada.id, "")));
    }
  }

  // Si es eficaz contra el que tienes delante (no cuánto le quitaría)
  const suyo = abierto.vista[otroLado(abierto.lado)].activo;
  let contra = "";
  if (suyo && ataque.category !== "Status") {
    const efi = eficaciaContra(ataque.type, tiposVisibles(suyo));
    const textoEfi = efi === 0
      ? t("No le afecta")
      : efi > 1 ? t("Muy eficaz (×{n})", { n: efi }) : efi < 1 ? t("Poco eficaz (×{n})", { n: String(efi).replace(".", enIngles ? "." : ",") }) : t("Eficacia normal");
    contra = `<p class="lucha-bocadillo-contra">${t("Contra {nombre}", { nombre: escaparHTML(suyo.nombre) })}: <b>${textoEfi}</b></p>`;
  }

  return `
    <div class="ficha ficha-ataque lucha-bocadillo-ataque" style="background:${coloresTipo[tipo] || "#888"}">
      <div class="ficha-titulo">
        ${iconoTipo(tipo)}
        <span>${escaparHTML(abierto.modulos.nombreAtaque(ataque.name))}</span>
        <span class="ficha-tipo">${escaparHTML(tiposEs[tipo] || tipo)}</span>
      </div>
      ${descripcion ? `<p>${escaparHTML(descripcion)}</p>` : ""}
      <div class="ficha-datos">
        <span>${escaparHTML(categoria)}</span>
        <span>${t("Potencia")}: ${ataque.basePower > 1 ? ataque.basePower : "—"}</span>
        <span>${t("Precisión")}: ${ataque.accuracy === true ? "—" : `${ataque.accuracy}%`}</span>
        <span>PP: ${datos.pp ?? "-"}/${datos.maxpp ?? "-"}</span>
        ${ataque.priority ? `<span>${t("Prioridad")}: ${ataque.priority > 0 ? "+" : ""}${ataque.priority}</span>` : ""}
        ${ataque.flags && ataque.flags.contact ? `<span>${t("Contacto")}</span>` : ""}
      </div>
      ${contra}
    </div>`;
}

function contenidoBocadillo(elemento) {
  if (!abierto) return "";
  const [que, lado, valor] = String(elemento.dataset.bocadillo || "").split(":");
  try {
    if (que === "ataque") return bocadilloAtaque(Number(lado), elemento);
    if (que === "hueco") return bocadilloPokemon(lado, Number(valor));
    // El que está en el campo (su ficha o su sprite)
    if (que === "pokemon") {
      const { activo } = abierto.vista[lado];
      return activo ? bocadilloPokemon(lado, activo.posicion) : "";
    }
  } catch (error) {
    console.error("No se ha podido pintar el bocadillo", error);
  }
  return "";
}

// ---------- Los dos equipos, siempre a la vista ----------
//
// Encima del campo: tus seis y los seis del rival, con su retrato, su vida y su estado. Los
// debilitados, en gris; el que está en el campo, con un aro. Los del rival que aún no se conocen
// (sin vista previa), con «?». Cada uno tiene su bocadillo.

function huecoDeEquipo(lado, posicion) {
  const datos = datosDeHueco(lado, posicion);
  if (!datos) return "";
  if (!seConoce(lado, datos)) return `<span class="lucha-hueco desconocido" title="${t("Aún no ha salido")}">?</span>`;
  const { visto, activo } = datos;
  const psMax = visto ? visto.psMax : 1;
  const parte = visto ? (visto.debilitado ? 0 : visto.ps / (psMax || 1)) : 1;
  const estado = visto && visto.estado;
  const clases = ["lucha-hueco", visto && visto.debilitado ? "caido" : "", activo ? "en-campo" : ""].join(" ");
  return `
    <span class="${clases}" data-bocadillo="hueco:${lado}:${posicion}">
      ${retratoDe(lado, posicion)}
      <span class="lucha-ps ${claseBarra(parte)}"><span style="width: ${(parte * 100).toFixed(1)}%"></span></span>
      ${estado ? `<span class="lucha-hueco-estado estado-${estado}">${escaparHTML((abierto.modulos.ESTADOS[estado] || {}).corto || "")}</span>` : ""}
    </span>`;
}

function pintarEquipos() {
  for (const lado of ["p1", "p2"]) {
    const caja = vistaCombate.querySelector(`.lucha-equipo-fila[data-lado="${lado}"] .lucha-huecos`);
    if (!caja) continue;
    const posiciones = abierto.combate.sets[lado].map((set) => set.posicion);
    const html = posiciones.map((posicion) => huecoDeEquipo(lado, posicion)).join("");
    if (caja.dataset.html === html) continue;
    caja.dataset.html = html;
    caja.innerHTML = html;
  }
}

// ---------- Abrir y cerrar un combate ----------

// Los pies del Pokémon y sus trampas, en su plataforma del escenario (PUESTOS, js/lucha/escenario.js)
function ladoHTML(lado, clase) {
  const p = abierto.modulos.PUESTOS[clase];
  const porciento = (n) => `${(n * 100).toFixed(2)}%`;
  return `
    <div class="lucha-lado ${clase}" data-lado="${lado}">
      <div class="lucha-ficha-columna">
        <div class="lucha-ficha-hueco"></div>
        <div class="lucha-condiciones"></div>
      </div>
      <div class="lucha-trampas" style="left: ${porciento(p.x - p.rx)}; width: ${porciento(2 * p.rx)}; top: ${porciento(p.y - p.ry)}; height: ${porciento(2 * p.ry)}"></div>
      <div class="lucha-sprite" data-lado="${lado}" data-bocadillo="pokemon:${lado}" style="left: ${porciento(p.x)}; top: ${porciento(p.pies)}"></div>
    </div>`;
}

function esqueletoCombate(lucha) {
  const rival = rivalDe(lucha, yo());
  const locke = textoLocke(lucha);
  const miLado = ladoDe(lucha, yo());
  return `
    <div class="lucha-cabeza">
      <button type="button" class="boton-gris lucha-volver">${icono("atras")} ${t("Combates")}</button>
      <div class="lucha-cabeza-jugadores">
        ${fotoEn(lucha, yo())}<strong>${escaparHTML(nombreEn(lucha, yo()))}</strong>
        <span class="lucha-vs">vs</span>
        <strong>${escaparHTML(nombreEn(lucha, rival))}</strong>${fotoEn(lucha, rival)}
      </div>
      <small class="lucha-cabeza-datos">${escaparHTML(textoFormato(lucha.formato))} · ${escaparHTML(textoNivel(lucha.nivel))}${locke ? ` · ${escaparHTML(locke)}` : ""}</small>
      <button type="button" class="boton-gris lucha-sonido" title="${t("Sonido")}"></button>
      <button type="button" class="boton-gris lucha-rendirse" hidden>${icono("bandera")} ${t("Rendirse")}</button>
    </div>
    <div class="lucha-cuerpo">
      <div class="lucha-principal">
        <div class="lucha-equipos-barra">
          <div class="lucha-equipo-fila mio" data-lado="${miLado}">
            <span class="lucha-equipo-nombre">${escaparHTML(nombreEn(lucha, yo()))}</span>
            <div class="lucha-huecos"></div>
          </div>
          <div class="lucha-equipo-fila suyo" data-lado="${otroLado(miLado)}">
            <div class="lucha-huecos"></div>
            <span class="lucha-equipo-nombre">${escaparHTML(nombreEn(lucha, rival))}</span>
          </div>
        </div>
        <div class="lucha-arena">
          <canvas class="lucha-escena" aria-hidden="true"></canvas>
          <canvas class="lucha-nubes" aria-hidden="true"></canvas>
          <div class="lucha-campo-capa"></div>
          <div class="lucha-tiempo"></div>
          <span class="lucha-turno"></span>
          <span class="lucha-clima" hidden></span>
          ${ladoHTML(otroLado(miLado), "suyo")}
          ${ladoHTML(miLado, "mio")}
          <div class="lucha-previa-campo"></div>
          <div class="lucha-efectos"></div>
        </div>
        <div class="lucha-acciones"></div>
      </div>
      <aside class="lucha-lateral">
        <div class="lucha-registro">
          <h3>${icono("lista")} ${t("Registro")}</h3>
          <ol class="lucha-registro-lista"></ol>
        </div>
        <section class="lucha-cambios" hidden>
          <h3></h3>
          <div class="lucha-cambios-mini"></div>
        </section>
      </aside>
    </div>`;
}

// Los dibujitos en pixel art (js/lucha/pixeles.js) van como variables del campo, y --px es el tamaño de un
// píxel del escenario (180 de alto): con él, las púas, las rocas o la joya tera tienen píxeles del mismo
// tamaño que el paisaje
function ponerPixeles(arena, motor) {
  arena.style.setProperty("--px", String(Math.max(1, arena.clientHeight / 180)));
  if (arena.dataset.pixeles) return;
  arena.dataset.pixeles = "1";
  arena.style.setProperty("--px-pua", `url("${motor.urlPua(false)}")`);
  arena.style.setProperty("--px-pua-toxica", `url("${motor.urlPua(true)}")`);
  arena.style.setProperty("--px-roca", `url("${motor.urlRoca(false)}")`);
  arena.style.setProperty("--px-roca-acero", `url("${motor.urlRoca(true)}")`);
  arena.style.setProperty("--px-telarana", `url("${motor.urlTelarana()}")`);
}

function pintarBotonSonido() {
  const boton = vistaCombate.querySelector(".lucha-sonido");
  if (!boton || !abierto) return;
  const con = abierto.modulos.haySonido();
  boton.innerHTML = icono(con ? "sonido" : "silencio");
  boton.title = con ? t("Quitar el sonido") : t("Poner el sonido");
}

// También sin combate abierto (si no se pudo preparar): vuelve a la lista
function cerrarCombate() {
  if (abierto && abierto.dejar) abierto.dejar();
  if (abierto && abierto.observador) abierto.observador.disconnect();
  abierto = null;
  ocultarTooltip();
  vistaCombate.hidden = true;
  vistaCombate.innerHTML = "";
  vistaLista.hidden = false;
  pintarLista();
}

async function abrirCombate(id) {
  const lucha = luchaPorId(id);
  if (!lucha || lucha.estado === "reto") return;
  cerrarCombate();
  vistaLista.hidden = true;
  vistaCombate.hidden = false;
  vistaCombate.innerHTML = `<p class="lucha-aviso">${t("Cargando el motor de combate...")}</p>`;

  let motor;
  try {
    motor = await cargarMotor();
  } catch (error) {
    console.error(error);
    vistaCombate.innerHTML = `<p class="lucha-aviso error">${t("No se ha podido cargar el motor de combate. Prueba de nuevo.")}</p>`;
    return;
  }
  const actual = luchaPorId(id);
  if (!actual || vistaCombate.hidden) return;

  const lado = ladoDe(actual, yo());
  let combate;
  try {
    combate = new motor.Combate(actual);
  } catch (error) {
    console.error(error);
    vistaCombate.innerHTML = `<p class="lucha-aviso error">${t("No se ha podido preparar el combate (algún equipo no vale para el motor).")}</p>
      <button type="button" class="boton-gris lucha-volver">${t("Volver a los combates")}</button>`;
    return;
  }

  abierto = {
    id, lucha: actual, lado, combate, modulos: motor,
    lector: motor.crearLector({ miLado: lado, nombreRival: nombreEn(actual, rivalDe(actual, yo())) }),
    vista: nuevaVista(), registro: [], cola: [], historia: [], turnos: [], repeticion: null,
    primeraVez: true, rapido: false, reproduciendo: false, avanzando: false, enviando: false, especial: "", fuerza: "normal"
  };
  vistaCombate.innerHTML = esqueletoCombate(actual);
  const arena = vistaCombate.querySelector(".lucha-arena");
  motor.pintarEscena(arena, actual.id, actual.escena);
  ponerPixeles(arena, motor);
  abierto.efectos = motor.crearEfectos(arena);
  // Si cambia el tamaño del campo, el escenario se vuelve a pintar con su forma y los sprites se ajustan
  let cuadro = 0;
  const observador = new ResizeObserver(() => {
    cancelAnimationFrame(cuadro);
    cuadro = requestAnimationFrame(() => {
      motor.pintarEscena(arena, actual.id, actual.escena);
      ponerPixeles(arena, motor);
      for (const img of arena.querySelectorAll(".lucha-sprite img, .lucha-previa-sprite img")) ajustarSprite(img);
    });
  });
  observador.observe(arena);
  abierto.observador = observador;
  pintarBotonSonido();
  if (actual.motor && actual.motor !== motor.VERSION) {
    avisar(t("Este combate empezó con otra versión del motor: puede que no se pueda seguir."));
  }
  encolar(abierto.lector.leer(combate.lineasNuevas()));
  pintarCampo();
  pintarAcciones();

  const esta = abierto;
  abierto.dejar = escucharTurnos(
    id,
    (turnos) => {
      if (esta !== abierto) return;
      abierto.turnos = turnos;
      avanzar().catch((error) => console.error(error));
    },
    (error) => {
      console.error("No se pueden leer los turnos", error);
      if (esta === abierto) avisar(t("No se pueden leer los turnos de este combate."));
    }
  );
}

// La lucha abierta ha cambiado en Firestore (el otro se ha rendido, la han borrado...)
function alCambiarLaAbierta() {
  if (!abierto) return;
  const lucha = luchaPorId(abierto.id);
  if (!lucha) {
    cerrarCombate();
    return;
  }
  abierto.lucha = lucha;
  if (!abierto.reproduciendo) pintarAcciones();
}

// ---------- Botones ----------

async function alPulsarLista(e) {
  const fila = e.target.closest(".lucha-fila, .lucha-grande");
  const id = fila && fila.dataset.id;
  if (e.target.closest(".lucha-retar")) return abrirDialogoRetar({});
  if (!id) return;
  if (e.target.closest(".lucha-aceptar")) return abrirAceptar(id);
  if (e.target.closest(".lucha-abrir")) return abrirCombate(id);
  const rechazar = e.target.closest(".lucha-rechazar, .lucha-retirar, .lucha-quitar");
  if (rechazar) {
    const pregunta = rechazar.matches(".lucha-rechazar")
      ? t("¿Rechazar el reto?")
      : rechazar.matches(".lucha-retirar") ? t("¿Retirar el reto?") : t("¿Quitar este combate de la lista? Se quita para los dos.");
    if (!(await confirmar(pregunta, { aceptar: rechazar.matches(".lucha-quitar") ? t("Quitar") : rechazar.matches(".lucha-rechazar") ? t("Rechazar") : t("Retirar") }))) return;
    borrarLucha(id).catch((error) => {
      console.error(error);
      avisar(t("No se ha podido. Prueba de nuevo."));
    });
  }
  return undefined;
}

async function alPulsarCombate(e) {
  if (e.target.closest(".lucha-volver")) return cerrarCombate();
  if (!abierto) return undefined;
  if (e.target.closest(".lucha-saltar")) {
    abierto.rapido = true;
    return undefined;
  }
  const rep = e.target.closest("[data-rep]");
  if (rep && abierto.repeticion) {
    const repeticion = abierto.repeticion;
    const accion = rep.dataset.rep;
    if (accion === "auto") {
      repeticion.auto = !repeticion.auto;
      if (repeticion.auto) irATurno(repeticion.actual >= repeticion.segmentos.length ? 1 : repeticion.actual + 1, { animar: true });
      else pintarAcciones();
      return undefined;
    }
    repeticion.auto = false;
    if (accion === "inicio") irATurno(0);
    else if (accion === "atras") irATurno(repeticion.actual - 1);
    else if (accion === "adelante") irATurno(repeticion.actual + 1, { animar: true });
    else if (accion === "final") irATurno(repeticion.segmentos.length);
    return undefined;
  }
  const irTurno = e.target.closest(".lucha-ir-turno");
  if (irTurno && abierto.repeticion) {
    abierto.repeticion.auto = false;
    // El trozo de ese turno es el número del turno: se ve animado desde el final del anterior
    irATurno(Number(irTurno.dataset.turno) + 1, { animar: true });
    return undefined;
  }
  if (e.target.closest(".lucha-sonido")) {
    abierto.modulos.ponerSonido(!abierto.modulos.haySonido());
    pintarBotonSonido();
    return undefined;
  }
  if (e.target.closest(".lucha-cancelar-eleccion")) {
    const { id, combate, lado } = abierto;
    try {
      await cancelarEleccion(id, combate.decisiones, `s${numeroDe(lado)}`);
    } catch (error) {
      console.error(error);
      // Lo normal: el rival acababa de elegir y ya no se puede
      avisar(t("Ya no se puede cancelar: tu rival acaba de elegir."));
    }
    return undefined;
  }
  if (e.target.closest(".lucha-rendirse")) {
    const { id, lucha } = abierto;
    if (!(await confirmar(t("¿Rendirte? El combate lo gana tu rival."), { aceptar: t("Rendirse"), peligro: true }))) return undefined;
    try {
      const ganador = await rendirse(id);
      if (ganador && lucha.locke) await sumarVictoriaCombate(lucha.locke.id, lucha.locke.combate, ganador);
    } catch (error) {
      console.error(error);
      avisar(t("No se ha podido. Prueba de nuevo."));
    }
    return undefined;
  }
  const especial = e.target.closest("[data-especial]");
  if (especial) {
    abierto.especial = abierto.especial === especial.dataset.especial ? "" : especial.dataset.especial;
    pintarAcciones();
    return undefined;
  }
  const primero = e.target.closest("[data-primero]");
  if (primero && !primero.disabled) {
    ocultarTooltip();
    const total = abierto.combate.peticion(abierto.lado).side.pokemon.length;
    const lider = Number(primero.dataset.primero);
    const orden = [lider, ...Array.from({ length: total }, (_, i) => i + 1).filter((n) => n !== lider)];
    return elegir(`team ${orden.join("")}`);
  }
  const opcion = e.target.closest("[data-eleccion]");
  if (opcion && !opcion.disabled && opcion.getAttribute("aria-disabled") !== "true") {
    ocultarTooltip();
    let eleccion = opcion.dataset.eleccion;
    if (eleccion.startsWith("move") && abierto.especial) eleccion += ` ${abierto.especial}`;
    return elegir(eleccion);
  }
  return undefined;
}

function alPulsarRetar(e) {
  if (e.target.closest(".lucha-retar-cancelar")) return dialogoRetar.close();
  if (e.target.closest(".lucha-retar-ok")) return enviarReto();
  const elegirBoton = e.target.closest(".lucha-retar-elegir");
  if (elegirBoton) return elegirEquipoParaLucha(elegirBoton).catch((error) => console.error(error));
  const nivel = e.target.closest("[data-nivel]");
  if (nivel) {
    retando.nivel = nivel.dataset.nivel;
    return pintarRetar();
  }
  const previa = e.target.closest("[data-previa]");
  if (previa) {
    retando.vistaPrevia = previa.dataset.previa === "si";
    return pintarRetar();
  }
  const tera = e.target.closest("[data-tera]");
  if (tera) {
    retando.tera = tera.dataset.tera === "si";
    return pintarRetar();
  }
  const escena = e.target.closest("[data-escena]");
  if (escena) {
    retando.escena = escena.dataset.escena;
    return pintarRetar();
  }
  return undefined;
}

function alCambiarRetar(e) {
  if (e.target.matches(".lucha-retar-amigo")) {
    retando.rival = e.target.value;
    retando.locke = null;
  } else if (e.target.matches(".lucha-retar-locke")) {
    const [id, combate] = e.target.value.split("|");
    retando.locke = id ? { id, combate } : null;
  } else if (e.target.matches(".lucha-retar-gen")) {
    retando.gen = Number(e.target.value) || 9;
  } else return;
  pintarRetar();
}

// ---------- Desde la campana ----------

export function abrirLucha(id) {
  const lucha = luchaPorId(id);
  if (!lucha) return;
  if (lucha.estado === "reto" && lucha.jugadores[1] === yo()) abrirAceptar(id);
  else abrirCombate(id);
}

// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-lucha");
  vistaLista = seccion.querySelector(".lucha-inicio");
  vistaCombate = seccion.querySelector(".lucha-combate");
  dialogoRetar = document.querySelector("#dialogo-lucha-retar");

  vistaLista.addEventListener("click", (e) => {
    alPulsarLista(e).catch((error) => console.error(error));
  });
  vistaCombate.addEventListener("click", (e) => {
    alPulsarCombate(e).catch((error) => console.error(error));
  });
  activarTooltips(vistaCombate, "[data-bocadillo]", contenidoBocadillo, () => 250);
  // Cada sprite, a su tamaño en cuanto carga
  vistaCombate.addEventListener("load", (e) => {
    if (e.target instanceof HTMLImageElement && e.target.closest(".lucha-sprite, .lucha-previa-sprite")) ajustarSprite(e.target);
  }, true);
  vistaCombate.addEventListener("input", (e) => {
    if (!e.target.matches(".lucha-rep-barra") || !abierto || !abierto.repeticion) return;
    abierto.repeticion.auto = false;
    irATurno(Number(e.target.value), { controles: false });
  });
  vistaCombate.addEventListener("change", (e) => {
    if (e.target.matches(".lucha-rep-barra") && abierto && abierto.repeticion) pintarAcciones();
  });
  dialogoRetar.addEventListener("click", alPulsarRetar);
  dialogoRetar.addEventListener("change", alCambiarRetar);

  alCambiarLuchas(() => {
    if (abierto) alCambiarLaAbierta();
    if (!vistaLista.hidden) pintarLista();
  });
  alCambiarPerfilesAmigos(() => {
    if (!vistaLista.hidden) pintarLista();
  });
}

export function mostrar() {
  if (!abierto) pintarLista();
}
