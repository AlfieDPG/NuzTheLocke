// Combates, ROM, terminar el locke y salón de la fama (sección «Lockes»).
//
// Cómo se gana un locke: hay que pasarse la ROM. Si no se la pasa nadie, no gana nadie; si
// solo uno, ese, aunque fuese perdiendo los combates; si varios, el que más combates gana. Los
// combates (cuántos y cuándo: «tras la 3ª medalla», «Liga»...) los pone quien crea el locke, y
// cada uno se juega fuera (en Showdown: el botón «Showdown» copia tu equipo y lo abre) y aquí se apunta quién ganó y cómo (al mejor de 3: 2-0,
// 2-1). Con 3 o más jugadores, cada combate lo gana uno y le suma un punto: vale para un
// todos contra todos o para un torneo por rondas.
//
//   · En la tarjeta del locke: una casilla por combate (pulsándola se apunta el resultado).
//   · En el bloque de cada uno: si se ha pasado la ROM (el tuyo, pulsándolo).
//   · «Terminar» (solo quien lo creó): propone el ganador según lo de arriba y se puede cambiar.
//   · Con el locke cerrado, cada uno pone su equipo final y su MVP (salón de la fama).
//
// Los datos están en js/comun/lockes.js (Combates, ROM y salón de la fama).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual } from "../comun/nube.js";
import { leerGuardados } from "../equipos/estado.js";
import { elegirEquipo, caraDePokemon, carasDeEquipo, copiaDeEquipo } from "../comun/elegir-equipo.js";
import {
  lockePorId, estadoDe, combatesDe, nombreCombate, victoriasDe, seHaPasadoLaRom, ganadorPropuesto,
  apuntarResultado, cambiarRom, elegirGanador, guardarSalon, estaEliminado, alCambiarLockes,
  equipoDeCombate, guardarEquipoCombate
} from "../comun/lockes.js";
import { equipoParaCombate } from "../partida/partidas.js";
import { confirmar } from "../comun/ventanas.js";
import { pasteDelEquipo, copiarAlPortapapeles } from "../equipos/exportar.js";
import { campoNumero } from "../comun/numero.js";
import { t } from "../comun/idioma.js";

let alFallar = (error) => console.error(error);

function aceptados(locke) {
  return (locke.jugadores || []).filter((uid) => estadoDe(locke, uid) === "aceptado");
}

function nombreDe(locke, uid) {
  return (locke.nombres || {})[uid] || t("Jugador");
}

function fotoDe(locke, uid, clase) {
  const foto = (locke.fotos || {})[uid] || "";
  const nombre = nombreDe(locke, uid);
  return foto
    ? `<img class="${clase}" src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase} sin-foto">${escaparHTML(nombre[0].toUpperCase())}</span>`;
}

// Retrato de un Pokémon de un equipo guardado (el de su forma; si no hay, su render)
const cara = caraDePokemon;

// ---------- Plantillas (las usa js/versus/index.js) ----------

// Una casilla por combate, con su ganador y el marcador
export function plantillaCombates(locke) {
  const combates = combatesDe(locke);
  if (!combates.length) return "";
  const resultados = locke.resultados || {};
  const abierto = locke.estado !== "cerrado";

  return `
    <div class="locke-combates">
      ${combates
        .map((combate) => {
          const resultado = resultados[combate.id];
          const contenido = resultado
            ? `${fotoDe(locke, resultado.ganador, "combate-foto")}
               <span class="combate-ganador">${escaparHTML(nombreDe(locke, resultado.ganador))}</span>
               ${resultado.marcador ? `<span class="combate-marcador">${escaparHTML(resultado.marcador)}</span>` : ""}`
            : `<span class="combate-pendiente">${t("Por jugar")}</span>`;
          // Con qué equipo lo jugó cada uno (los que lo hayan puesto)
          const equipos = aceptados(locke)
            .map((uid) => ({ uid, equipo: equipoDeCombate(locke, uid, combate.id) }))
            .filter(({ equipo }) => equipo);
          const filaEquipos = equipos.length
            ? `<span class="combate-equipos-mini">${equipos
                .map(({ uid, equipo }) => `<span class="combate-equipo-mini" title="${escaparHTML(`${nombreDe(locke, uid)}: ${equipo.nombre}`)}">${carasDeEquipo(equipo)}</span>`)
                .join(`<span class="combate-vs">vs</span>`)}</span>`
            : "";
          // Cerrado, se abre igual (para ver los equipos), pero sin poder cambiar nada
          return `
            <button class="locke-combate ${resultado ? "jugado" : ""} ${abierto ? "" : "solo-ver"}" data-combate="${escaparHTML(combate.id)}"
                    title="${abierto ? t("Apuntar el resultado y los equipos") : t("Ver el combate")}">
              <span class="combate-nombre">${icono("espadas")} ${escaparHTML(nombreCombate(locke, combate.id))}</span>
              <span class="combate-resultado">${contenido}</span>
              ${filaEquipos}
            </button>`;
        })
        .join("")}
    </div>`;
}

// ¿Se ha pasado la ROM? En tu bloque, un botón para marcarlo
export function plantillaRom(locke, uid, editable) {
  const pasada = seHaPasadoLaRom(locke, uid);
  const estado = pasada ? t("ROM superada") : t("ROM sin pasar");
  const icono_ = icono(pasada ? "visto" : "mando");
  return editable
    ? `<button class="locke-rom ${pasada ? "pasada" : ""}" title="${estado} · ${pasada ? t("Desmarcar") : t("Me he pasado la ROM")}" aria-label="${estado}">${icono_}</button>`
    : `<span class="locke-rom ${pasada ? "pasada" : ""}" title="${estado}" aria-label="${estado}">${icono_}</span>`;
}

// Equipo final y MVP (con el locke cerrado). El tuyo se cambia con el lápiz.
export function plantillaSalon(locke, uid, mio) {
  const salon = (locke.salon || {})[uid];
  // Sin equipo, el hueco igual (vacío): así los bloques del locke quedan alineados
  if (!salon) {
    return mio ? `<button class="locke-salon-poner">${icono("estrella")} ${t("Equipo final")}</button>` : `<div class="locke-salon"></div>`;
  }
  return `
    <div class="locke-salon">
      <div class="locke-salon-caras">
        ${(salon.pokemon || [])
          .map((p, i) => `<span class="salon-cara ${i === salon.mvp ? "mvp" : ""} ${(salon.pasan || []).includes(i) ? "pasa" : ""}">${cara(p)}${i === salon.mvp ? `<span class="salon-mvp">MVP</span>` : ""}${(salon.pasan || []).includes(i) ? `<span class="salon-pasa" title="${t("Pasa a la siguiente etapa")}">→</span>` : ""}</span>`)
          .join("")}
      </div>
      ${mio ? `<button class="locke-salon-cambiar" title="${t("Cambiar equipo final")}">${icono("lapiz")}</button>` : ""}
    </div>`;
}

// ---------- Apuntar un combate ----------

let dialogoCombate = null;
// El editor de equipos de Showdown: ahí se importa el equipo copiado
const SHOWDOWN = "https://play.pokemonshowdown.com/teambuilder";

let enCombate = null; // { id (locke), idCombate, puntos: { uid: combates ganados } }

// Quién va ganando con esos puntos: el que más tiene, si es uno solo y más que 0
function lider(locke, puntos) {
  const valores = aceptados(locke).map((uid) => ({ uid, n: Number(puntos[uid]) || 0 }));
  const max = Math.max(0, ...valores.map((v) => v.n));
  const arriba = valores.filter((v) => v.n === max);
  return { max, ganador: max > 0 && arriba.length === 1 ? arriba[0].uid : "", empate: max > 0 && arriba.length > 1 };
}

// El marcador como texto, de más a menos («2-1», «3-1-0»), para las casillas y el historial
function textoMarcador(locke, puntos) {
  return aceptados(locke)
    .map((uid) => Number(puntos[uid]) || 0)
    .sort((a, b) => b - a)
    .join("-");
}

// Los apuntados antes de existir las casillas por jugador: el ganador y un «2-1»
function puntosDe(locke, resultado) {
  if (resultado.puntos) return { ...resultado.puntos };
  const puntos = {};
  const [alto, bajo] = String(resultado.marcador || "").split("-").map((n) => Number(n) || 0);
  if (!resultado.ganador) return puntos;
  puntos[resultado.ganador] = alto || 1;
  const otros = aceptados(locke).filter((uid) => uid !== resultado.ganador);
  if (otros.length && bajo) puntos[otros[0]] = bajo;
  return puntos;
}

// El aviso de debajo (empate, nadie...) y el botón de guardar, sin volver a pintar las casillas
function textoEstadoCombate(locke) {
  const { ganador, empate } = lider(locke, enCombate.puntos);
  const soloVer = locke.estado === "cerrado";
  dialogoCombate.querySelector(".combate-estado").textContent = soloVer || ganador ? "" : empate
    ? t("Empate: no se puede guardar. Sube los combates de uno.")
    : t("Pon los combates que ha ganado cada uno.");
  dialogoCombate.querySelector(".combate-ok").disabled = !ganador;
  for (const fila of dialogoCombate.querySelectorAll(".combate-jugador")) {
    fila.classList.toggle("gana", fila.dataset.uid === ganador);
  }
}

function pintarCombate() {
  const locke = lockePorId(enCombate.id);
  if (!locke) return;
  const soloVer = locke.estado === "cerrado";
  const desactivado = soloVer ? "disabled" : "";
  dialogoCombate.classList.toggle("solo-ver", soloVer);
  dialogoCombate.querySelector(".combate-titulo").innerHTML =
    `${icono("espadas")} ${escaparHTML(nombreCombate(locke, enCombate.idCombate))}`;
  // Una fila por jugador, con los combates que ha ganado (se escribe a mano: valen dos o más)
  const { ganador } = lider(locke, enCombate.puntos);
  dialogoCombate.querySelector(".combate-jugadores").innerHTML = aceptados(locke)
    .map(
      (uid) => `
        <div class="combate-jugador ${ganador === uid ? "gana" : ""}" data-uid="${escaparHTML(uid)}">
          ${fotoDe(locke, uid, "combate-opcion-foto")}
          <span class="combate-jugador-nombre">${escaparHTML(nombreDe(locke, uid))}</span>
          ${ganador === uid ? `<span class="combate-corona" title="${t("Va ganando")}">${icono("corona")}</span>` : ""}
          ${campoNumero(`<input class="combate-puntos" type="number" min="0" max="99" value="${enCombate.puntos[uid] ?? 0}" aria-label="${t("Combates ganados")}" ${desactivado}>`)}
        </div>`
    )
    .join("");
  textoEstadoCombate(locke);

  // Los equipos: el tuyo se elige (se guarda al momento, aparte del resultado); los de los
  // demás, los que hayan puesto ellos
  const yo = usuarioActual().uid;
  dialogoCombate.querySelector(".combate-equipos").innerHTML = aceptados(locke)
    .map((uid) => {
      const equipo = equipoDeCombate(locke, uid, enCombate.idCombate);
      const mio = uid === yo && !soloVer;
      // Tu equipo, copiado como paste para importarlo en Showdown (que se abre en otra pestaña)
      const showdown = uid === yo && equipo
        ? `<a class="boton-gris combate-showdown" href="${SHOWDOWN}" target="_blank" rel="noopener" title="${t("Copia tu equipo y abre Showdown para importarlo")}">${icono("copiar")} Showdown</a>`
        : "";
      return `
        <div class="combate-equipo ${uid === yo ? "mio" : ""}">
          ${fotoDe(locke, uid, "combate-opcion-foto")}
          <span class="combate-equipo-nombre">${escaparHTML(nombreDe(locke, uid))}</span>
          ${equipo ? carasDeEquipo(equipo) : `<span class="combate-sin-equipo">${t("Sin equipo")}</span>`}
          <span class="combate-equipo-botones">
            ${showdown}
            ${mio ? `<button type="button" class="boton-gris combate-elegir-equipo">${icono("pokeball")} ${equipo ? t("Cambiar") : t("Elegir")}</button>` : ""}
          </span>
        </div>`;
    })
    .join("");

  dialogoCombate.querySelector(".combate-ok").hidden = soloVer;
  dialogoCombate.querySelector(".combate-borrar").hidden = soloVer || !((locke.resultados || {})[enCombate.idCombate]);
  dialogoCombate.querySelector(".combate-cancelar").textContent = soloVer ? t("Cerrar") : t("Cancelar");
}

export function abrirCombate(id, idCombate) {
  const locke = lockePorId(id);
  if (!locke) return;
  const resultado = (locke.resultados || {})[idCombate] || {};
  enCombate = { id, idCombate, puntos: puntosDe(locke, resultado) };
  dialogoCombate.querySelector(".combate-showdown-ayuda").hidden = true;
  pintarCombate();
  dialogoCombate.showModal();
}

// ---------- Terminar el locke ----------

let dialogoTerminar = null;
let terminando = null; // { id, elegido: uid o "" (nadie) }

function textoPropuesta(locke, ganadores) {
  if (!ganadores.length) return t("Nadie se ha pasado la ROM: no gana nadie.");
  if (ganadores.length === 1) return t("Gana {nombre}.", { nombre: nombreDe(locke, ganadores[0]) });
  return t("Empate entre {nombres}: elige tú.", { nombres: ganadores.map((uid) => nombreDe(locke, uid)).join(` ${t("y")} `) });
}

function pintarTerminar() {
  const locke = lockePorId(terminando.id);
  if (!locke) return;
  const { ganadores } = ganadorPropuesto(locke);
  const conCombates = combatesDe(locke).length > 0;

  const fila = (uid) => {
    const eliminado = estaEliminado(locke, uid);
    const rom = seHaPasadoLaRom(locke, uid);
    return `
      <button type="button" class="terminar-opcion ${terminando.elegido === uid ? "elegido" : ""}" data-ganador="${escaparHTML(uid)}">
        ${fotoDe(locke, uid, "combate-opcion-foto")}
        <span class="terminar-nombre">${escaparHTML(nombreDe(locke, uid))}</span>
        <span class="terminar-dato ${rom && !eliminado ? "bien" : ""}">${eliminado ? `${icono("calavera")} ${t("Eliminado")}` : `${icono(rom ? "visto" : "aspa")} ROM`}</span>
        <span class="terminar-dato">${icono("espadas")} ${victoriasDe(locke, uid)}${conCombates ? ` / ${combatesDe(locke).length}` : ""}</span>
      </button>`;
  };

  dialogoTerminar.querySelector(".terminar-propuesta").textContent = textoPropuesta(locke, ganadores);
  dialogoTerminar.querySelector(".terminar-lista").innerHTML =
    aceptados(locke).map(fila).join("") +
    `<button type="button" class="terminar-opcion nadie ${terminando.elegido === "" ? "elegido" : ""}" data-ganador="">
       <span class="terminar-nombre">${icono("aspa")} ${t("Nadie gana")}</span>
     </button>`;
}

export function abrirTerminar(id) {
  const locke = lockePorId(id);
  if (!locke || locke.estado === "cerrado") return;
  const { ganadores } = ganadorPropuesto(locke);
  terminando = { id, elegido: ganadores.length === 1 ? ganadores[0] : ganadores.length ? null : "" };
  pintarTerminar();
  dialogoTerminar.showModal();
}

// ---------- Equipo final y MVP ----------

let dialogoSalon = null;
let enSalon = null; // { id, equipo (copia), mvp, pasan (posiciones que pasan a la siguiente etapa de una cadena) }

// Cuántos Pokémon pasan a la siguiente etapa si el locke es una cadena (0 si no)
function cuantosPasan(id) {
  const locke = lockePorId(id);
  return (locke && locke.cadena && locke.cadena.pasan) || 0;
}

function pintarSalon() {
  const guardados = leerGuardados().filter((equipo) => (equipo.pokemon || []).length);
  dialogoSalon.querySelector(".salon-equipos").innerHTML = guardados.length
    ? guardados
        .map(
          (equipo) => `
            <button type="button" class="escaparate-equipo ${enSalon.idEquipo === equipo.id ? "destacado" : ""}" data-id="${escaparHTML(equipo.id)}">
              <strong>${escaparHTML(equipo.nombre || t("Equipo"))}</strong>
              <span class="perfil-equipo-caras">${equipo.pokemon.map((p) => cara(p)).join("")}</span>
            </button>`
        )
        .join("")
    : `<p class="perfil-vacio">${t("No tienes equipos guardados.")}</p>`;

  const mvp = dialogoSalon.querySelector(".salon-mvp-elegir");
  mvp.hidden = !enSalon.equipo;
  mvp.querySelector(".salon-mvp-caras").innerHTML = enSalon.equipo
    ? enSalon.equipo.pokemon
        .map((p, i) => `<button type="button" class="salon-cara ${i === enSalon.mvp ? "mvp" : ""}" data-mvp="${i}">${cara(p)}${i === enSalon.mvp ? `<span class="salon-mvp">MVP</span>` : ""}</button>`)
        .join("")
    : "";
  const limite = cuantosPasan(enSalon.id);
  const pasan = dialogoSalon.querySelector(".salon-pasan-elegir");
  pasan.hidden = !enSalon.equipo || !limite;
  pasan.querySelector(".etiqueta-campo").textContent = t("Pasan a la siguiente etapa (hasta {n})", { n: limite });
  pasan.querySelector(".salon-pasan-caras").innerHTML = enSalon.equipo
    ? enSalon.equipo.pokemon
        .map((p, i) => `<button type="button" class="salon-cara ${enSalon.pasan.includes(i) ? "pasa" : ""}" data-pasa="${i}">${cara(p)}${enSalon.pasan.includes(i) ? `<span class="salon-pasa">→</span>` : ""}</button>`)
        .join("")
    : "";
  dialogoSalon.querySelector(".salon-ok").disabled = !enSalon.equipo;
  const locke = lockePorId(enSalon.id);
  dialogoSalon.querySelector(".salon-quitar").hidden = !((locke && locke.salon) || {})[usuarioActual().uid];
}

export function abrirSalon(id) {
  const locke = lockePorId(id);
  if (!locke) return;
  const actual = (locke.salon || {})[usuarioActual().uid];
  enSalon = { id, idEquipo: null, equipo: actual ? { nombre: actual.nombre, pokemon: actual.pokemon } : null, mvp: actual ? actual.mvp : -1, pasan: actual ? [...(actual.pasan || [])] : [] };
  pintarSalon();
  dialogoSalon.showModal();
}

// ---------- Arranque ----------

// fallo(error): para que la sección diga que no se ha podido guardar
export function iniciarCombates(fallo) {
  alFallar = fallo;
  dialogoCombate = document.querySelector("#dialogo-combate");
  dialogoTerminar = document.querySelector("#dialogo-terminar");
  dialogoSalon = document.querySelector("#dialogo-salon");

  // Combate
  dialogoCombate.addEventListener("click", async (e) => {
    // «Showdown» es un enlace: abre Showdown en otra pestaña él solo. Antes, en el mismo clic, se
    // copia el equipo (la copia empieza ya, antes de que la pestaña nueva se lleve el foco)
    const showdown = e.target.closest(".combate-showdown");
    if (showdown) {
      const locke = lockePorId(enCombate.id);
      const equipo = locke && equipoDeCombate(locke, usuarioActual().uid, enCombate.idCombate);
      if (!equipo) return;
      const copiado = await copiarAlPortapapeles(pasteDelEquipo(equipo.pokemon || []));
      const ayuda = dialogoCombate.querySelector(".combate-showdown-ayuda");
      ayuda.hidden = false;
      ayuda.classList.toggle("error", !copiado);
      ayuda.textContent = copiado
        ? t("Equipo copiado. En Showdown: «New Team» → «Import from text», pega el equipo (Ctrl+V) y «Save». Luego reta a tu rival con ese equipo.")
        : t("No se ha podido copiar el equipo.");
      if (copiado) {
        showdown.classList.add("copiado");
        showdown.innerHTML = `${icono("visto")} ${t("¡Copiado!")}`;
        setTimeout(() => {
          if (!showdown.isConnected) return;
          showdown.classList.remove("copiado");
          showdown.innerHTML = `${icono("copiar")} Showdown`;
        }, 2500);
      }
      return;
    }
    const elegir = e.target.closest(".combate-elegir-equipo");
    if (elegir) {
      const { id, idCombate } = enCombate;
      const locke = lockePorId(id);
      const actual = locke && equipoDeCombate(locke, usuarioActual().uid, idCombate);
      const equipo = await elegirEquipo(elegir, { conQuitar: Boolean(actual), primero: equipoParaCombate(id) });
      if (equipo === undefined) return;
      guardarEquipoCombate(id, idCombate, equipo).catch(alFallar); // al llegar el cambio se repinta
      return;
    }
  });
  // Los combates ganados de cada uno: se escriben (o con las flechas) y solo se actualiza el aviso
  dialogoCombate.addEventListener("input", (e) => {
    if (!e.target.matches(".combate-puntos") || !enCombate) return;
    const locke = lockePorId(enCombate.id);
    if (!locke) return;
    enCombate.puntos[e.target.closest(".combate-jugador").dataset.uid] = Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0)));
    textoEstadoCombate(locke);
  });
  dialogoCombate.querySelector(".combate-cancelar").addEventListener("click", () => dialogoCombate.close());
  dialogoCombate.querySelector(".combate-borrar").addEventListener("click", () => {
    const { id, idCombate } = enCombate;
    dialogoCombate.close();
    apuntarResultado(id, idCombate, "", "").catch(alFallar);
  });
  dialogoCombate.querySelector(".combate-ok").addEventListener("click", () => {
    const { id, idCombate, puntos } = enCombate;
    const locke = lockePorId(id);
    const { ganador } = locke ? lider(locke, puntos) : {};
    if (!ganador) return;
    // Solo los puntos de quienes están dentro (y mayores que 0)
    const apuntados = {};
    for (const uid of aceptados(locke)) if (puntos[uid] > 0) apuntados[uid] = puntos[uid];
    dialogoCombate.close();
    apuntarResultado(id, idCombate, ganador, textoMarcador(locke, puntos), apuntados).catch(alFallar);
  });

  // Terminar
  dialogoTerminar.querySelector(".terminar-lista").addEventListener("click", (e) => {
    const opcion = e.target.closest(".terminar-opcion");
    if (!opcion) return;
    terminando.elegido = opcion.dataset.ganador;
    pintarTerminar();
  });
  dialogoTerminar.querySelector(".terminar-cancelar").addEventListener("click", () => dialogoTerminar.close());
  dialogoTerminar.querySelector(".terminar-ok").addEventListener("click", async () => {
    const { id, elegido } = terminando;
    const locke = lockePorId(id);
    if (!locke || elegido === null) return;
    const pregunta = elegido
      ? t("¿Terminar «{locke}» con {nombre} como ganador?", { locke: locke.nombre, nombre: nombreDe(locke, elegido) })
      : t("¿Terminar «{locke}» sin ganador?", { locke: locke.nombre });
    if (!(await confirmar(`${pregunta}\n\n${t("El locke dejará de poder editarse.")}`, { aceptar: t("Terminar") }))) return;
    dialogoTerminar.close();
    elegirGanador(id, elegido).catch(alFallar);
  });

  // Salón de la fama
  dialogoSalon.querySelector(".salon-equipos").addEventListener("click", (e) => {
    const boton = e.target.closest(".escaparate-equipo");
    if (!boton) return;
    const equipo = leerGuardados().find((cada) => cada.id === boton.dataset.id);
    if (!equipo) return;
    enSalon.idEquipo = equipo.id;
    enSalon.equipo = copiaDeEquipo(equipo);
    enSalon.mvp = -1;
    enSalon.pasan = [];
    pintarSalon();
  });
  dialogoSalon.querySelector(".salon-mvp-caras").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-mvp]");
    if (!boton) return;
    const i = Number(boton.dataset.mvp);
    enSalon.mvp = enSalon.mvp === i ? -1 : i;
    pintarSalon();
  });
  dialogoSalon.querySelector(".salon-pasan-caras").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-pasa]");
    if (!boton) return;
    const i = Number(boton.dataset.pasa);
    // Se quita si estaba; si no, se pone mientras queden huecos
    if (enSalon.pasan.includes(i)) enSalon.pasan = enSalon.pasan.filter((otro) => otro !== i);
    else if (enSalon.pasan.length < cuantosPasan(enSalon.id)) enSalon.pasan.push(i);
    pintarSalon();
  });
  dialogoSalon.querySelector(".salon-cancelar").addEventListener("click", () => dialogoSalon.close());
  dialogoSalon.querySelector(".salon-quitar").addEventListener("click", () => {
    dialogoSalon.close();
    guardarSalon(enSalon.id, null).catch(alFallar);
  });
  dialogoSalon.querySelector(".salon-ok").addEventListener("click", () => {
    if (!enSalon.equipo) return;
    dialogoSalon.close();
    guardarSalon(enSalon.id, enSalon.equipo, enSalon.mvp, enSalon.pasan.slice(0, cuantosPasan(enSalon.id))).catch(alFallar);
  });

  // Si cambia el locke con una ventana abierta (otro apunta algo), al día; si se cierra, fuera
  alCambiarLockes(() => {
    if (dialogoCombate.open) {
      const locke = lockePorId(enCombate.id);
      if (!locke) dialogoCombate.close();
      else pintarCombate(); // lo que cambien los demás (sus equipos...); lo que hayas marcado tú se queda
    }
    if (dialogoTerminar.open) {
      const locke = lockePorId(terminando.id);
      if (!locke || locke.estado === "cerrado") dialogoTerminar.close();
      else pintarTerminar();
    }
  });
}

// El botón de la ROM de tu bloque
export function alternarRom(id) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;
  cambiarRom(id, !seHaPasadoLaRom(locke, usuario.uid)).catch(alFallar);
}
