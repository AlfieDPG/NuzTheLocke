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
import { t } from "../comun/idioma.js";
import { usuarioActual, hayNube } from "../comun/nube.js";
import { amigosAceptados, perfilesDeAmigos, alCambiarPerfilesAmigos } from "../comun/perfiles.js";
import { lockes, combatesDe, nombreCombate, estadoDe, lockePorId, sumarVictoriaCombate } from "../comun/lockes.js";
import { generacionDeJuego } from "../comun/juegos.js";
import { elegirEquipo, carasDeEquipo, caraDePokemon } from "../comun/elegir-equipo.js";
import { pokemonParaCopia } from "../comun/pokemon.js";
import { pasteDelEquipo } from "../equipos/exportar.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { cargarDatos } from "../comun/datos.js";
import { coloresTipo, iconoTipo, tiposEs } from "../comun/tipos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { pedirVariedad } from "../comun/pokemon.js";
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
    modulos = Promise.all([import("./combate.js"), import("./textos.js"), cargarDatos()])
      .then(([combate, textos]) => ({ ...combate, ...textos }));
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
// abierto = { id, lado, rival, combate, lector, vista, registro, cola, ... } mientras se ve uno

let abierto = null;

const numeroDe = (lado) => (lado === "p1" ? 1 : 2);

function nuevaVista() {
  const lado = () => ({ activo: null, vistos: {} });
  return { p1: lado(), p2: lado(), clima: "", turno: 0, ganador: null };
}

// Sprites animados de Negro/Blanco (hasta la 5.ª gen); para formas y los de después, el fijo de
// PokeAPI de esa forma. De espaldas, el tuyo.
const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const idsDeForma = new Map(); // "lucario-mega" -> id de PokeAPI (o null, si no lo tiene)

function urlsSprite({ num, idForma, shiny, espalda }) {
  const atras = espalda ? "back/" : "";
  const brillo = shiny ? "shiny/" : "";
  const lista = [];
  if (idForma && idForma !== num) lista.push(`${URL_SPRITES}${atras}${brillo}${idForma}.png`, `${URL_SPRITES}${atras}${idForma}.png`);
  else if (num <= 649) lista.push(`${URL_SPRITES}versions/generation-v/black-white/animated/${atras}${brillo}${num}.gif`);
  lista.push(`${URL_SPRITES}${atras}${brillo}${num}.png`, `${URL_SPRITES}${atras}${num}.png`, `${URL_SPRITES}${num}.png`);
  return lista;
}

// Número y forma de lo que hay en el campo: si sigue siendo la especie con la que se metió en el
// equipo, la forma de su cara (las formas regionales); si ha cambiado en el combate (una
// megaevolución), se busca esa forma en PokeAPI y se repinta al llegar.
function datosDeSprite(activo, lado) {
  const { Dex, toID } = abierto.modulos;
  const especie = Dex.species.get(activo.especie);
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
          if (abierto) pintarCampo(true);
        })
        .catch(() => {});
    }
  }
  return { num, idForma, shiny: activo.shiny, espalda: lado === abierto.lado, clave: `${num}-${idForma}-${activo.shiny}` };
}

function carasDe(lado) {
  return (abierto.lucha.caras || {})[uidDe(lado)] || [];
}

function retratoDe(lado, posicion) {
  const cara = carasDe(lado)[posicion];
  return cara ? caraDePokemon(cara, "lucha-retrato") : `<span class="lucha-retrato sin-cara"></span>`;
}

// ---------- Lo que se ve: aplicar cada suceso ----------

function aplicarSuceso(suceso) {
  const vista = abierto.vista;
  const lado = suceso.lado && vista[suceso.lado];
  switch (suceso.tipo) {
    case "cambio":
      lado.activo = {
        nombre: suceso.nombre, especie: suceso.especie, nivel: suceso.nivel, genero: suceso.genero, shiny: suceso.shiny,
        ps: suceso.ps, psMax: suceso.psMax, estado: suceso.estado, cambios: {}, debilitado: false,
        posicion: abierto.combate.posicionDe(suceso.lado, suceso.nombre)
      };
      lado.vistos[suceso.nombre] = { ps: suceso.ps, psMax: suceso.psMax, estado: suceso.estado, debilitado: false };
      break;
    case "ps":
      if (lado.activo && lado.activo.nombre === suceso.nombre) Object.assign(lado.activo, { ps: suceso.ps, psMax: suceso.psMax || lado.activo.psMax, estado: suceso.estado });
      if (lado.vistos[suceso.nombre]) Object.assign(lado.vistos[suceso.nombre], { ps: suceso.ps, estado: suceso.estado });
      break;
    case "debilitado":
      if (lado.activo && lado.activo.nombre === suceso.nombre) Object.assign(lado.activo, { ps: 0, debilitado: true });
      if (lado.vistos[suceso.nombre]) Object.assign(lado.vistos[suceso.nombre], { ps: 0, debilitado: true });
      break;
    case "estado":
      if (lado.activo && lado.activo.nombre === suceso.nombre) lado.activo.estado = suceso.estado;
      if (lado.vistos[suceso.nombre]) lado.vistos[suceso.nombre].estado = suceso.estado;
      break;
    case "cambios":
      if (suceso.limpiar) {
        for (const cual of suceso.todos ? ["p1", "p2"] : [suceso.lado]) if (vista[cual] && vista[cual].activo) vista[cual].activo.cambios = {};
      } else if (lado && lado.activo) {
        const antes = lado.activo.cambios[suceso.stat] || 0;
        const ahora = "fijo" in suceso ? suceso.fijo : antes + suceso.cuanto;
        lado.activo.cambios[suceso.stat] = Math.max(-6, Math.min(6, ahora));
      }
      break;
    case "forma":
      if (lado.activo && lado.activo.nombre === suceso.nombre) lado.activo.especie = suceso.especie;
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
  if (suceso.texto) abierto.registro.push({ texto: suceso.texto, aviso: suceso.aviso });
}

// ---------- Pintar el combate ----------

function barraPS(ps, psMax) {
  const parte = psMax ? Math.max(0, Math.min(1, ps / psMax)) : 0;
  const nivel = parte > 0.5 ? "alto" : parte > 0.2 ? "medio" : "bajo";
  return `<span class="lucha-ps ${nivel}"><span style="width: ${(parte * 100).toFixed(1)}%"></span></span>`;
}

function chipEstado(estado) {
  const datos = abierto.modulos.ESTADOS[estado];
  return datos ? `<span class="lucha-chip-estado estado-${estado}" title="${escaparHTML(datos.largo)}">${escaparHTML(datos.corto)}</span>` : "";
}

function fichaDe(lado) {
  const { activo } = abierto.vista[lado];
  if (!activo) return "";
  const mio = lado === abierto.lado;
  const psTexto = mio ? `${activo.ps}/${activo.psMax}` : `${Math.round(activo.psMax ? (activo.ps / activo.psMax) * 100 : 0)} %`;
  const cambios = Object.entries(activo.cambios)
    .filter(([, valor]) => valor)
    .map(([stat, valor]) => `<span class="lucha-chip-cambio ${valor > 0 ? "sube" : "baja"}">${escaparHTML(abierto.modulos.ESTADISTICAS_CORTAS[stat] || stat)} ${valor > 0 ? "+" : ""}${valor}</span>`)
    .join("");
  const genero = activo.genero ? `<span class="lucha-genero ${activo.genero === "F" ? "hembra" : "macho"}">${icono(activo.genero === "F" ? "hembra" : "macho")}</span>` : "";
  return `
    <div class="lucha-ficha ${mio ? "mia" : "suya"} ${activo.debilitado ? "debilitado" : ""}">
      ${retratoDe(lado, activo.posicion)}
      <div class="lucha-ficha-datos">
        <div class="lucha-ficha-nombre"><strong>${escaparHTML(activo.nombre)}</strong>${genero}<small>${t("Nv.")} ${activo.nivel}</small>${chipEstado(activo.estado)}</div>
        ${barraPS(activo.ps, activo.psMax)}
        <div class="lucha-ficha-pie"><span class="lucha-ps-texto">${psTexto}</span>${cambios}</div>
      </div>
    </div>`;
}

// Las bolitas de cada equipo: vivo, debilitado o sin ver todavía (los del rival)
// (los tuyos que aún no han salido, vivos: los conoces)
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
  return `<div class="lucha-bolitas">${bolitas.join("")}</div>`;
}

function spriteDe(lado, forzar) {
  const caja = vistaCombate.querySelector(`.lucha-sprite[data-lado="${lado}"]`);
  const { activo } = abierto.vista[lado];
  if (!caja) return;
  if (!activo) {
    caja.innerHTML = "";
    caja.dataset.clave = "";
    return;
  }
  const datos = datosDeSprite(activo, lado);
  const clave = `${activo.nombre}|${datos.clave}`;
  if (caja.dataset.clave === clave && !forzar) return;
  caja.dataset.clave = clave;
  caja.innerHTML = imagenConRespaldo(urlsSprite(datos), `alt="${escaparHTML(activo.nombre)}" draggable="false"`);
}

function pintarCampo(forzarSprites = false) {
  if (!abierto) return;
  const rival = abierto.lado === "p1" ? "p2" : "p1";
  for (const [lado, clase] of [[abierto.lado, "mio"], [rival, "suyo"]]) {
    const zona = vistaCombate.querySelector(`.lucha-lado.${clase}`);
    zona.querySelector(".lucha-ficha-hueco").innerHTML = fichaDe(lado) + bolitasDe(lado);
    zona.querySelector(".lucha-sprite").classList.toggle("caido", Boolean(abierto.vista[lado].activo && abierto.vista[lado].activo.debilitado));
    spriteDe(lado, forzarSprites);
  }
  const clima = abierto.modulos.NOMBRE_CLIMA[abierto.vista.clima];
  const etiqueta = vistaCombate.querySelector(".lucha-clima");
  etiqueta.hidden = !clima;
  etiqueta.textContent = clima || "";
  vistaCombate.querySelector(".lucha-turno").textContent = abierto.vista.turno ? t("Turno {n}", { n: abierto.vista.turno }) : t("Antes de empezar");
}

function pintarRegistro() {
  const lista = vistaCombate.querySelector(".lucha-registro-lista");
  lista.innerHTML = abierto.registro
    .map((linea) => (linea.turno
      ? `<li class="turno">${t("Turno {n}", { n: linea.turno })}</li>`
      : `<li class="${linea.aviso ? "aviso" : ""}">${escaparHTML(linea.texto)}</li>`))
    .join("");
  lista.scrollTop = lista.scrollHeight;
}

function ponerMensaje(texto) {
  const caja = vistaCombate.querySelector(".lucha-mensaje");
  if (caja) caja.textContent = texto || "";
}

// ---------- Animaciones ----------

const DURACION = { cambio: 650, ataque: 600, ps: 500, debilitado: 750, mensaje: 850 };

function animar(lado, clase) {
  const caja = vistaCombate.querySelector(`.lucha-sprite[data-lado="${lado}"]`);
  if (!caja) return;
  caja.classList.remove(clase);
  void caja.offsetWidth; // para que vuelva a empezar si ya la tenía
  caja.classList.add(clase);
}

// Va sacando los sucesos de la cola, de uno en uno, con su animación. Al acabar, los botones.
async function reproducir() {
  if (abierto.reproduciendo) return;
  abierto.reproduciendo = true;
  const yoMismo = abierto;
  pintarAcciones();
  while (yoMismo === abierto && abierto.cola.length) {
    const suceso = abierto.cola.shift();
    aplicarSuceso(suceso);
    if (abierto.rapido) continue;
    if (suceso.tipo === "ataque") animar(suceso.lado, "ataca");
    if (suceso.tipo === "ps" && suceso.danio) animar(suceso.lado, "golpeado");
    if (suceso.tipo === "cambio") animar(suceso.lado, "sale");
    pintarCampo();
    pintarRegistro();
    if (suceso.texto) ponerMensaje(suceso.texto);
    const duracion = DURACION[suceso.tipo] ?? (suceso.texto ? DURACION.mensaje : 0);
    if (duracion) await esperar(duracion);
  }
  if (yoMismo !== abierto) return;
  abierto.reproduciendo = false;
  abierto.rapido = false;
  pintarCampo();
  pintarRegistro();
  pintarAcciones();
}

// ---------- Avanzar con las elecciones que han llegado ----------

function turnoActual() {
  return abierto.turnos[abierto.combate.decisiones] || {};
}

function uidDe(lado) {
  return lado === "p1" ? abierto.lucha.jugadores[0] : abierto.lucha.jugadores[1];
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
        abierto.cola.push(...abierto.lector.leer(abierto.combate.lineasNuevas()));
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
  const datos = motor.Dex.forGen(motor.genDe(abierto.combate.formato)).moves.get(ataque.id);
  const tipo = (datos.type || "Normal").toLowerCase();
  const especial = abierto.especial;
  const zeta = especial === "zmove" ? (peticionActiva.canZMove || [])[i] : null;
  const desactivado = ataque.disabled || ataque.pp === 0 || (especial === "zmove" && !zeta);
  const nombreVisible = zeta ? zeta.move : ataque.move;
  const clase = datos.category === "Physical" ? t("Físico") : datos.category === "Special" ? t("Especial") : t("Estado");
  return `
    <button type="button" class="lucha-ataque" data-eleccion="move ${i + 1}" style="--tipo: ${coloresTipo[tipo] || "#888"}" ${desactivado ? "disabled" : ""}>
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
      return `
        <button type="button" class="lucha-cambio ${pokemon.active && !vistaPrevia ? "en-campo" : ""} ${caido ? "caido" : ""}"
          data-${vistaPrevia ? "primero" : "eleccion"}="${vistaPrevia ? i + 1 : `switch ${i + 1}`}" ${desactivado ? "disabled" : ""}>
          ${retratoDe(abierto.lado, posicion)}
          <span class="lucha-cambio-datos">
            <strong>${escaparHTML(nombrePokemon)}</strong>
            <small>${t("Nv.")} ${nivel}${estado && estado !== "fnt" ? ` · ${escaparHTML((abierto.modulos.ESTADOS[estado] || {}).corto || estado)}` : ""}</small>
            ${vistaPrevia ? "" : barraPS(ps, psMax)}
          </span>
        </button>`;
    })
    .join("");
}

function botonesEspeciales(activa) {
  const opciones = [
    activa.canMegaEvo && { valor: "mega", texto: t("Megaevolucionar") },
    activa.canUltraBurst && { valor: "ultra", texto: t("Ultraexplosión") },
    activa.canZMove && { valor: "zmove", texto: t("Movimiento Z") },
    activa.canDynamax && { valor: "dynamax", texto: t("Dinamax") },
    activa.canTerastallize && { valor: "terastallize", texto: t("Teracristalizar ({tipo})", { tipo: tiposEs[String(activa.canTerastallize).toLowerCase()] || activa.canTerastallize }) }
  ].filter(Boolean);
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
  if (abierto.reproduciendo) {
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
      </div>`;
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

// ---------- Abrir y cerrar un combate ----------

function esqueletoCombate(lucha) {
  const rival = rivalDe(lucha, yo());
  const locke = textoLocke(lucha);
  return `
    <div class="lucha-cabeza">
      <button type="button" class="boton-gris lucha-volver">${icono("atras")} ${t("Combates")}</button>
      <div class="lucha-cabeza-jugadores">
        ${fotoEn(lucha, yo())}<strong>${escaparHTML(nombreEn(lucha, yo()))}</strong>
        <span class="lucha-vs">vs</span>
        <strong>${escaparHTML(nombreEn(lucha, rival))}</strong>${fotoEn(lucha, rival)}
      </div>
      <small class="lucha-cabeza-datos">${escaparHTML(textoFormato(lucha.formato))} · ${escaparHTML(textoNivel(lucha.nivel))}${locke ? ` · ${escaparHTML(locke)}` : ""}</small>
      <button type="button" class="boton-gris lucha-rendirse" hidden>${icono("bandera")} ${t("Rendirse")}</button>
    </div>
    <div class="lucha-cuerpo">
      <div class="lucha-principal">
        <div class="lucha-arena">
          <span class="lucha-turno"></span>
          <span class="lucha-clima" hidden></span>
          <div class="lucha-lado suyo">
            <div class="lucha-ficha-hueco"></div>
            <div class="lucha-sprite" data-lado="${lucha.jugadores[0] === yo() ? "p2" : "p1"}"></div>
          </div>
          <div class="lucha-lado mio">
            <div class="lucha-sprite" data-lado="${ladoDe(lucha, yo())}"></div>
            <div class="lucha-ficha-hueco"></div>
          </div>
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

// También sin combate abierto (si no se pudo preparar): vuelve a la lista
function cerrarCombate() {
  if (abierto && abierto.dejar) abierto.dejar();
  abierto = null;
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
    vista: nuevaVista(), registro: [], cola: [], turnos: [],
    primeraVez: true, rapido: false, reproduciendo: false, avanzando: false, enviando: false, especial: ""
  };
  vistaCombate.innerHTML = esqueletoCombate(actual);
  if (actual.motor && actual.motor !== motor.VERSION) {
    ponerMensaje(t("Este combate empezó con otra versión del motor: puede que no se pueda seguir."));
  }
  abierto.cola.push(...abierto.lector.leer(combate.lineasNuevas()));
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
    const total = abierto.combate.peticion(abierto.lado).side.pokemon.length;
    const lider = Number(primero.dataset.primero);
    const orden = [lider, ...Array.from({ length: total }, (_, i) => i + 1).filter((n) => n !== lider)];
    return elegir(`team ${orden.join("")}`);
  }
  const opcion = e.target.closest("[data-eleccion]");
  if (opcion && !opcion.disabled) {
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
