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
import { activarTooltips, actualizarTooltip, ocultarTooltip } from "../comun/tooltip.js";
import {
  alCambiarLuchas, misLuchas, fallanLasLuchas, luchaPorId, ladoDe, rivalDe, meToca, retar, aceptarReto,
  borrarLucha, terminar, rendirse, escucharTurnos, apuntarEnTurno, sello, conSal, sinSal, pendienteDe,
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
      import("./combate.js"), import("./textos.js"), import("./efectos.js"), import("./escenario.js"), import("./calculo.js"), cargarDatos()
    ]).then(([combate, textos, efectos, escenario, calculo]) => ({ ...combate, ...textos, ...efectos, ...escenario, ...calculo }));
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

function fotoEn(lucha, uid, clase = "lucha-foto") {
  const foto = (lucha.fotos || {})[uid] || "";
  const letra = escaparHTML((nombreEn(lucha, uid)[0] || "?").toUpperCase());
  return foto
    ? `<img class="${clase}" src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-perfil="${escaparHTML(uid)}">`
    : `<span class="${clase} sin-foto" data-perfil="${escaparHTML(uid)}">${letra}</span>`;
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
  return `${t("{n} gen", { n: GEN_ORDINAL[gen] })}${variante}`;
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

function filaLucha(lucha) {
  const uid = yo();
  const rival = rivalDe(lucha, uid);
  const recibido = lucha.estado === "reto" && lucha.jugadores[1] === uid;
  const enviado = lucha.estado === "reto" && lucha.jugadores[0] === uid;
  const toca = meToca(lucha);
  const locke = textoLocke(lucha);

  let estado = "";
  let botones = "";
  if (recibido) {
    estado = `<span class="lucha-estado reto">${t("Te reta")}</span>`;
    botones = `
      <button type="button" class="boton-gris lucha-rechazar" title="${t("Rechazar")}">${icono("aspa")}</button>
      <button type="button" class="lucha-boton lucha-aceptar">${icono("visto")} ${t("Aceptar")}</button>`;
  } else if (enviado) {
    estado = `<span class="lucha-estado">${t("Esperando respuesta")}</span>`;
    botones = `<button type="button" class="boton-gris lucha-retirar">${t("Retirar")}</button>`;
  } else if (lucha.estado === "jugando") {
    estado = toca
      ? `<span class="lucha-estado toca">${t("Te toca")}</span>`
      : `<span class="lucha-estado">${t("Le toca a {nombre}", { nombre: escaparHTML(nombreEn(lucha, rival)) })}</span>`;
    botones = `<button type="button" class="lucha-boton lucha-abrir">${icono("lucha")} ${toca ? t("Luchar") : t("Ver")}</button>`;
  } else {
    const gana = lucha.ganador === uid;
    const empate = lucha.ganador === "empate";
    estado = `<span class="lucha-estado ${empate ? "" : gana ? "gana" : "pierde"}">${
      empate ? t("Empate") : gana ? t("Ganaste") : t("Perdiste")
    }${lucha.rendido ? ` · ${lucha.rendido === uid ? t("te rendiste") : t("se rindió")}` : ""}</span>`;
    botones = `
      <button type="button" class="boton-gris lucha-abrir">${t("Ver")}</button>
      <button type="button" class="boton-gris lucha-quitar" title="${t("Quitar de la lista")}">${icono("papelera")}</button>`;
  }

  // El equipo del rival no se enseña hasta que empieza (no se elige con ventaja)
  const misCaras = carasEn(lucha, uid);
  const susCaras = lucha.estado === "reto" ? "" : carasEn(lucha, rival);

  return `
    <article class="lucha-fila ${toca || recibido ? "destacada" : ""}" data-id="${escaparHTML(lucha.id)}">
      ${fotoEn(lucha, rival)}
      <div class="lucha-fila-texto">
        <strong>${escaparHTML(nombreEn(lucha, rival))}</strong>
        <small>${escaparHTML(textoFormato(lucha.formato))} · ${escaparHTML(textoNivel(lucha.nivel))}${locke ? ` · ${escaparHTML(locke)}` : ""}</small>
      </div>
      <div class="lucha-fila-equipos">
        ${misCaras || `<span class="lucha-sin-equipo">${t("Sin equipo")}</span>`}
        ${susCaras ? `<span class="lucha-vs">vs</span>${susCaras}` : ""}
      </div>
      ${estado}
      <div class="lucha-fila-botones">${botones}</div>
    </article>`;
}

function bloque(titulo, luchas, vacio = "") {
  if (!luchas.length && !vacio) return "";
  return `
    <section class="lucha-bloque">
      <h3>${titulo}</h3>
      ${luchas.length ? luchas.map(filaLucha).join("") : `<p class="lucha-vacio">${vacio}</p>`}
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
  const recibidos = todas.filter((lucha) => lucha.estado === "reto" && lucha.jugadores[1] === uid);
  const enviados = todas.filter((lucha) => lucha.estado === "reto" && lucha.jugadores[0] === uid);
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
    <div class="lucha-bloques">
      ${bloque(t("Te retan"), recibidos)}
      ${bloque(t("En marcha"), enMarcha)}
      ${bloque(t("Esperando respuesta"), enviados)}
      ${bloque(t("Terminadas"), terminadas)}
    </div>`;
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
  return gen ? motor.formatoDeJuego(locke.juego, gen) : motor.formatoDe(retando.gen);
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
    ? `<p class="lucha-retar-dato">${icono("libro")} ${t("Reglas de la {formato}", { formato: escaparHTML(textoFormato(formato)) })} · ${escaparHTML(textoNivel(nivel))}</p>`
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

async function abrirDialogoRetar(datos) {
  retando = { modo: "retar", id: "", rival: "", locke: null, gen: 9, nivel: "tal", equipo: null, ...datos };
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

// El equipo elegido, listo para la lucha: { nombre, paste, caras }
async function equipoParaLucha(elegido) {
  const pokemon = (elegido.pokemon || []).filter((p) => !p.huevo);
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
  if (!conocidos[nombrePokemon]) conocidos[nombrePokemon] = { ataques: new Set(), habilidad: "", objeto: "" };
  return conocidos[nombrePokemon];
}

// ---------- Sprites ----------
//
// Animados siempre que se pueda: los de Negro/Blanco hasta la 5.ª gen; para los de después y las
// formas (megas, regionales), los animados de la carpeta «showdown» de PokeAPI; y si no hay, el fijo.
// De espaldas, el tuyo.

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const idsDeForma = new Map(); // "lucario-mega" -> id de PokeAPI (o null, si no lo tiene)

function urlsSprite({ num, idForma, shiny, espalda }) {
  const atras = espalda ? "back/" : "";
  const brillo = shiny ? "shiny/" : "";
  const id = idForma && idForma !== num ? idForma : num;
  const lista = [];
  if (id === num && num <= 649) lista.push(`${URL_SPRITES}versions/generation-v/black-white/animated/${atras}${brillo}${num}.gif`);
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
  caja.style.setProperty("--tera", (abierto.modulos.ESTILOS[activo.tera] || {}).colores?.[0] || "#7fd8ff");
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
    case "ataque":
      conocidoDe(suceso.lado, suceso.nombre).ataques.add(suceso.ataque);
      break;
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
    hueco.innerHTML = activo ? `${fichaVacia(lado)}<div class="lucha-bolitas"></div>` : "";
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
  hueco.querySelector(".lucha-bolitas").innerHTML = bolitasDe(lado);
}

// Las bolitas de cada equipo: vivo, debilitado o sin ver todavía (los tuyos que no han salido: vivos)
function bolitasDe(lado) {
  const total = abierto.combate.sets[lado].length;
  const vistos = Object.values(abierto.vista[lado].vistos);
  const mio = lado === abierto.lado;
  const bolitas = [];
  for (let i = 0; i < total; i++) {
    const visto = vistos[i];
    const clase = visto ? (visto.debilitado ? "caido" : "vivo") : mio ? "vivo" : "";
    bolitas.push(`<span class="lucha-bolita ${clase}"></span>`);
  }
  return bolitas.join("");
}

// Lo que hay en el lado de cada uno: púas, rocas, telaraña, pantallas, viento afín...
const TRAMPAS = ["spikes", "toxicspikes", "stealthrock", "stickyweb", "gmaxsteelsurge"];

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
  for (const pantalla of ["reflect", "lightscreen", "auroraveil", "safeguard", "mist", "luckychant"]) {
    if (condiciones[pantalla]) piezas.push(`<span class="lucha-pantalla pantalla-${pantalla}"></span>`);
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

function pintarCampo({ sprites = false } = {}) {
  if (!abierto) return;
  for (const lado of ["p1", "p2"]) {
    pintarFicha(lado);
    spriteDe(lado, sprites);
    pintarTrampas(lado);
  }
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

  switch (suceso.tipo) {
    case "cambio": {
      pintarCampo();
      animar(lado, "sale");
      grito(aspectoDe(activo, lado).num);
      return esperar(700);
    }
    case "ataque": {
      abierto.fuerza = "normal";
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
        if (quien) efectos.aura(quien, sube ? "#6ab8ff" : "#ff6b6b", { anillos: 2, sube });
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

function prepararRepeticion() {
  if (abierto.repeticion) return abierto.repeticion;
  const segmentos = [[]];
  for (const suceso of abierto.historia) {
    if (suceso.tipo === "turno") segmentos.push([suceso]);
    else segmentos[segmentos.length - 1].push(suceso);
  }
  abierto.repeticion = { segmentos, actual: segmentos.length, auto: false };
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
          data-${vistaPrevia ? "primero" : "eleccion"}="${vistaPrevia ? i + 1 : `switch ${i + 1}`}" data-bocadillo="equipo:${i}" ${desactivado ? "disabled" : ""}>
          ${retratoDe(abierto.lado, posicion)}
          <span class="lucha-cambio-datos">
            <strong>${escaparHTML(nombrePokemon)}</strong>
            <small>${t("Nv.")} ${nivel}${estado && estado !== "fnt" ? ` · ${escaparHTML((abierto.modulos.ESTADOS[estado] || {}).corto || estado)}` : ""}</small>
            ${vistaPrevia ? "" : `<span class="lucha-ps ${claseBarra(parte)}"><span style="width: ${(parte * 100).toFixed(1)}%"></span></span>`}
          </span>
        </button>`;
    })
    .join("");
}

// Megaevolucionar, Z, Dinamax, Tera: solo lo que el motor ofrece y no se ha usado ya en el combate
function botonesEspeciales(activa) {
  const { usados, activo } = abierto.vista[abierto.lado];
  const yaMega = activo && dex().species.get(activo.especie).isMega;
  const opciones = [
    activa.canMegaEvo && !usados.has("mega") && !yaMega && { valor: "mega", texto: t("Megaevolucionar") },
    activa.canUltraBurst && !usados.has("ultra") && { valor: "ultra", texto: t("Ultraexplosión") },
    activa.canZMove && !usados.has("zeta") && { valor: "zmove", texto: t("Movimiento Z") },
    activa.canDynamax && !usados.has("dinamax") && { valor: "dynamax", texto: t("Dinamax") },
    activa.canTerastallize && !usados.has("tera") && !(activo && activo.tera) && {
      valor: "terastallize", texto: t("Teracristalizar ({tipo})", { tipo: tiposEs[String(activa.canTerastallize).toLowerCase()] || activa.canTerastallize })
    }
  ].filter(Boolean);
  if (abierto.especial && !opciones.some((opcion) => opcion.valor === abierto.especial)) abierto.especial = "";
  if (!opciones.length) return "";
  return `<div class="lucha-especiales">${opciones
    .map((opcion) => `<button type="button" class="lucha-especial ${abierto.especial === opcion.valor ? "elegido" : ""}" data-especial="${opcion.valor}">${escaparHTML(opcion.texto)}</button>`)
    .join("")}</div>`;
}

function pintarAcciones() {
  if (!abierto) return;
  const caja = vistaCombate.querySelector(".lucha-acciones");
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
    caja.innerHTML = `<p class="lucha-espera">${texto}</p>`;
    return;
  }

  const peticion = combate.peticion(lado);
  if (!peticion) {
    caja.innerHTML = "";
    return;
  }

  // Antes de empezar: con quién sales
  if (peticion.teamPreview) {
    const uidRival = rivalDe(lucha, yo());
    caja.innerHTML = `
      <div class="lucha-previa">
        <p>${t("Elige con quién empiezas. El equipo de {nombre}:", { nombre: escaparHTML(rival) })} ${carasEn(lucha, uidRival)}</p>
        <div class="lucha-equipo">${botonesEquipo(peticion, { vistaPrevia: true })}</div>
      </div>`;
    return;
  }

  // Tras un debilitado: solo cambiar
  if (peticion.forceSwitch) {
    caja.innerHTML = `
      <p class="lucha-pregunta">${t("¿A quién sacas?")}</p>
      <div class="lucha-equipo">${botonesEquipo(peticion)}</div>`;
    return;
  }

  const activa = (peticion.active || [])[0] || { moves: [] };
  const atrapado = Boolean(activa.trapped);
  caja.innerHTML = `
    <p class="lucha-pregunta">${t("¿Qué hará {nombre}?", { nombre: escaparHTML((abierto.vista[lado].activo || {}).nombre || "") })}</p>
    <div class="lucha-ataques">${activa.moves.map((ataque, i) => botonAtaque(ataque, i, activa)).join("")}</div>
    ${botonesEspeciales(activa)}
    <span class="etiqueta-campo">${atrapado ? t("No puede huir ni cambiar") : t("lucha|Cambiar")}</span>
    <div class="lucha-equipo">${botonesEquipo(peticion, { atrapado })}</div>`;
}

// ---------- Bocadillos: lo que sale al poner el ratón encima ----------

const descripciones = new Map(); // id de PokeAPI del ataque -> descripción (o promesa)

function nombreHabilidadDe(id) {
  const habilidad = dex().abilities.get(id);
  return habilidad.exists ? abierto.modulos.nombreHabilidad(habilidad.name) : "";
}

function nombreObjetoDe(id) {
  const objeto = dex().items.get(id);
  return objeto.exists ? abierto.modulos.nombreObjeto(objeto.name) : "";
}

function tiposVisibles(activo) {
  if (activo && activo.tera) return [activo.tera.charAt(0).toUpperCase() + activo.tera.slice(1)];
  const especie = dex().species.get((activo && (activo.especieTransformado || activo.especie)) || "");
  return especie.types || [];
}

function chipsTipos(tipos) {
  return tipos.map((tipo) => {
    const id = tipo.toLowerCase();
    return `<span class="lucha-bocadillo-tipo" style="--c: ${coloresTipo[id] || "#888"}">${iconoTipo(id)} ${escaparHTML(tiposEs[id] || tipo)}</span>`;
  }).join("");
}

const NOMBRES_STATS = () => ({ atk: t("Ataque"), def: t("Defensa"), spa: t("At. Esp."), spd: t("Def. Esp."), spe: t("Velocidad") });

// Uno de mis Pokémon: sus estadísticas de verdad, habilidad, objeto y ataques
function bocadilloMio(indice) {
  const peticion = abierto.combate.peticion(abierto.lado);
  const pokemon = peticion && peticion.side && peticion.side.pokemon[indice];
  if (!pokemon) return "";
  const nombrePokemon = pokemon.ident.replace(/^p[12]: /, "");
  const especie = dex().species.get(pokemon.details.split(",")[0]);
  const activo = pokemon.active ? abierto.vista[abierto.lado].activo : null;
  const [ps, psMax] = String(pokemon.condition).split(" ")[0].split("/").map(Number);
  const cambios = (activo && activo.cambios) || {};
  const stats = Object.entries(NOMBRES_STATS())
    .map(([stat, nombreStat]) => {
      const etapa = cambios[stat] || 0;
      return `<span>${escaparHTML(nombreStat)}</span><b>${pokemon.stats[stat]}${etapa ? ` <em class="${etapa > 0 ? "sube" : "baja"}">${etapa > 0 ? "+" : ""}${etapa}</em>` : ""}</b>`;
    })
    .join("");
  const ataques = pokemon.moves.map((id) => {
    const ataque = dex().moves.get(id);
    const tipo = (ataque.type || "Normal").toLowerCase();
    return `<li style="--c: ${coloresTipo[tipo] || "#888"}">${escaparHTML(abierto.modulos.nombreAtaque(ataque.name))}</li>`;
  }).join("");
  return `
    <div class="ficha lucha-bocadillo">
      <strong class="lucha-bocadillo-titulo">${escaparHTML(nombrePokemon)}${nombrePokemon !== especie.name ? ` <small>(${escaparHTML(especie.name)})</small>` : ""}</strong>
      <div class="lucha-bocadillo-tipos">${chipsTipos(tiposVisibles(activo || { especie: especie.name }))}</div>
      <p>${t("PS")}: <b>${ps || 0}/${psMax || 0}</b></p>
      <div class="lucha-bocadillo-stats">${stats}</div>
      <p>${t("Habilidad")}: <b>${escaparHTML(nombreHabilidadDe(pokemon.ability || pokemon.baseAbility) || "—")}</b></p>
      <p>${t("Objeto")}: <b>${escaparHTML(nombreObjetoDe(pokemon.item) || t("ninguno"))}</b></p>
      <ul class="lucha-bocadillo-ataques">${ataques}</ul>
    </div>`;
}

// La velocidad que puede tener alguien sin saber su entrenamiento: de la peor a la mejor
function velocidadPosible(base, nivel) {
  const stat = (iv, ev, naturaleza) => Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * nivel) / 100) + 5) * naturaleza);
  return [stat(0, 0, 0.9), stat(31, 252, 1.1)];
}

// El del rival que está en el campo: lo que se sabe y lo que puede ser
function bocadilloRival(lado) {
  const { activo } = abierto.vista[lado];
  if (!activo) return "";
  const especie = dex().species.get(activo.especieTransformado || activo.especie);
  const conocido = conocidoDe(lado, activo.nombre);
  const posibles = Object.values(especie.abilities || {}).map((habilidad) => abierto.modulos.nombreHabilidad(habilidad));
  const [lenta, rapida] = velocidadPosible(especie.baseStats.spe, activo.nivel);
  const base = Object.entries({ hp: t("PS"), ...NOMBRES_STATS() }).map(([stat, nombreStat]) => `<span>${escaparHTML(nombreStat)}</span><b>${especie.baseStats[stat]}</b>`).join("");
  const ataques = [...conocido.ataques].map((nombreAtaque) => {
    const ataque = dex().moves.get(nombreAtaque);
    const tipo = (ataque.type || "Normal").toLowerCase();
    return `<li style="--c: ${coloresTipo[tipo] || "#888"}">${escaparHTML(abierto.modulos.nombreAtaque(ataque.name))}</li>`;
  }).join("");
  return `
    <div class="ficha lucha-bocadillo">
      <strong class="lucha-bocadillo-titulo">${escaparHTML(activo.nombre)}${activo.nombre !== especie.name ? ` <small>(${escaparHTML(especie.name)})</small>` : ""}</strong>
      <div class="lucha-bocadillo-tipos">${chipsTipos(tiposVisibles(activo))}</div>
      <p>${t("PS")}: <b>${Math.round(activo.psMax ? (activo.ps / activo.psMax) * 100 : 0)} %</b> · ${t("Nv.")} ${activo.nivel}</p>
      <p>${t("Habilidad")}: <b>${escaparHTML(conocido.habilidad ? abierto.modulos.nombreHabilidad(conocido.habilidad) : posibles.join(" / "))}</b>${conocido.habilidad ? "" : ` <small>(${t("sin ver")})</small>`}</p>
      <p>${t("Objeto")}: <b>${escaparHTML(conocido.objeto ? abierto.modulos.nombreObjeto(conocido.objeto) : t("sin ver"))}</b></p>
      <p>${t("Velocidad: entre {min} y {max}", { min: lenta, max: rapida })}</p>
      <span class="lucha-bocadillo-etiqueta">${t("Estadísticas base")}</span>
      <div class="lucha-bocadillo-stats">${base}</div>
      ${ataques ? `<span class="lucha-bocadillo-etiqueta">${t("Ataques vistos")}</span><ul class="lucha-bocadillo-ataques">${ataques}</ul>` : ""}
    </div>`;
}

// Un ataque mío: tipo, categoría, potencia, precisión, descripción y cuánto le quitaría al rival
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

  // Contra el que tiene delante
  const rival = otroLado(abierto.lado);
  const suyo = abierto.vista[rival].activo;
  const mioActivo = abierto.vista[abierto.lado].activo;
  const mio = peticion.side.pokemon.find((pokemon) => pokemon.active);
  let contra = "";
  if (suyo && mio && mioActivo) {
    const gen = abierto.modulos.genDe(abierto.combate.formato);
    const estimado = abierto.modulos.estimarDanio(dex(), ataque, {
      nivel: mioActivo.nivel, stats: mio.stats, tipos: tiposVisibles(mioActivo), habilidad: mio.ability || mio.baseAbility,
      objeto: mio.item, estado: mioActivo.estado, cambios: mioActivo.cambios
    }, {
      especie: dex().species.get(suyo.especieTransformado || suyo.especie), nivel: suyo.nivel, tipos: tiposVisibles(suyo),
      cambios: suyo.cambios, psMax: gen >= 4 ? suyo.psMax : 0
    }, abierto.vista.clima);
    if (estimado) {
      const efi = estimado.eficacia;
      const textoEfi = efi === 0 ? t("No le afecta") : efi > 1 ? t("Muy eficaz (×{n})", { n: efi }) : efi < 1 ? t("Poco eficaz (×{n})", { n: String(efi).replace(".", enIngles ? "." : ",") }) : t("Eficacia normal");
      const cuanto = estimado.ohko
        ? t("Lo debilita de un golpe si acierta")
        : estimado.variable
          ? t("Potencia variable")
          : efi === 0 ? "" : t("Le quitaría ≈ {min}–{max} % de sus PS", { min: Math.floor(estimado.min), max: Math.ceil(estimado.max) });
      contra = `
        <span class="lucha-bocadillo-etiqueta">${t("Contra {nombre}", { nombre: escaparHTML(suyo.nombre) })}</span>
        <p class="lucha-bocadillo-efi ${efi === 0 ? "nada" : efi > 1 ? "muy" : efi < 1 ? "poco" : ""}"><b>${textoEfi}</b>${cuanto ? ` · ${escaparHTML(cuanto)}` : ""}</p>
        <small class="lucha-bocadillo-nota">${t("Aproximado: sin saber su entrenamiento, ni críticos.")}</small>`;
    }
  }

  const precision = ataque.accuracy === true ? "—" : `${ataque.accuracy} %`;
  return `
    <div class="ficha lucha-bocadillo">
      <strong class="lucha-bocadillo-titulo">${escaparHTML(abierto.modulos.nombreAtaque(ataque.name))}</strong>
      <div class="lucha-bocadillo-tipos">${chipsTipos([ataque.type || "Normal"])}<span class="lucha-bocadillo-cat">${escaparHTML(categoria)}</span></div>
      <div class="lucha-bocadillo-stats">
        <span>${t("Potencia")}</span><b>${ataque.basePower > 1 ? ataque.basePower : "—"}</b>
        <span>${t("Precisión")}</span><b>${precision}</b>
        <span>PP</span><b>${datos.pp ?? "-"}/${datos.maxpp ?? "-"}</b>
        ${ataque.priority ? `<span>${t("Prioridad")}</span><b>${ataque.priority > 0 ? "+" : ""}${ataque.priority}</b>` : ""}
        ${ataque.flags && ataque.flags.contact ? `<span>${t("Contacto")}</span><b>${t("Sí")}</b>` : ""}
      </div>
      ${descripcion ? `<p class="lucha-bocadillo-desc">${escaparHTML(descripcion)}</p>` : ""}
      ${contra}
    </div>`;
}

function contenidoBocadillo(elemento) {
  if (!abierto) return "";
  const [que, valor] = String(elemento.dataset.bocadillo || "").split(":");
  try {
    if (que === "ataque") return bocadilloAtaque(Number(valor), elemento);
    if (que === "equipo") return bocadilloMio(Number(valor));
    if (que === "pokemon") {
      if (valor !== abierto.lado) return bocadilloRival(valor);
      const peticion = abierto.combate.peticion(abierto.lado);
      const indice = peticion && peticion.side ? peticion.side.pokemon.findIndex((pokemon) => pokemon.active) : -1;
      return indice >= 0 ? bocadilloMio(indice) : "";
    }
  } catch (error) {
    console.error("No se ha podido pintar el bocadillo", error);
  }
  return "";
}

// ---------- Abrir y cerrar un combate ----------

function ladoHTML(lado, clase) {
  return `
    <div class="lucha-lado ${clase}" data-lado="${lado}">
      <div class="lucha-ficha-columna">
        <div class="lucha-ficha-hueco"></div>
        <div class="lucha-condiciones"></div>
      </div>
      <div class="lucha-trampas"></div>
      <div class="lucha-sprite" data-lado="${lado}" data-bocadillo="pokemon:${lado}"></div>
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
        <div class="lucha-arena">
          ${abierto.modulos.dibujarEscena(lucha.id)}
          <div class="lucha-campo-capa"></div>
          <div class="lucha-tiempo"></div>
          <span class="lucha-turno"></span>
          <span class="lucha-clima" hidden></span>
          ${ladoHTML(otroLado(miLado), "suyo")}
          ${ladoHTML(miLado, "mio")}
          <div class="lucha-efectos"></div>
        </div>
        <p class="lucha-mensaje" role="status"></p>
        <div class="lucha-acciones"></div>
      </div>
      <aside class="lucha-registro">
        <h3>${icono("lista")} ${t("Registro")}</h3>
        <ol class="lucha-registro-lista"></ol>
      </aside>
    </div>`;
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
  abierto.efectos = motor.crearEfectos(vistaCombate.querySelector(".lucha-arena"));
  pintarBotonSonido();
  if (actual.motor && actual.motor !== motor.VERSION) {
    ponerMensaje(t("Este combate empezó con otra versión del motor: puede que no se pueda seguir."));
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
      if (esta === abierto) ponerMensaje(t("No se pueden leer los turnos de este combate."));
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
  const fila = e.target.closest(".lucha-fila");
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
  if (opcion && !opcion.disabled) {
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
