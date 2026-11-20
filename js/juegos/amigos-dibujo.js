// «Dibuja ese Pokémon» con un amigo (ver js/juegos/amigos.js): RONDAS rondas, la mitad dibuja cada uno.
//   · Quien dibuja ve qué Pokémon le ha tocado (sale de la semilla) y lo dibuja en el lienzo; los trazos llegan al
//     otro mientras se dibujan, a trocitos (cada ENVIAR_CADA ms un juntos/{id}/trazos con lo nuevo).
//   · Quien adivina escribe Pokémon hasta acertar. Cuanto antes, más puntos: PUNTOS_MAX − 1 por segundo (como poco
//     PUNTOS_MIN) para quien acierta y la mitad para quien dibujó. Quien dibuja puede pasar la ronda (0 puntos).
//   · Gana quien sume más al final.
//
//   datos: { total (rondas; las de antes no lo llevan: 4), ronda, inicio (ms de cuando empezó la ronda),
//            rondas: [{ acierto, segundos }], fallos: [especie] }
//   trazos: { uid, ronda, puntos: "C" (borrar) | "color|grosor|x,y x,y ..." (x de 0 a ANCHO, y de 0 a ALTO) }

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { urlArte } from "../comun/imagenes.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { avisar, confirmar } from "../comun/ventanas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { mandarTrazo, escucharTrazos } from "../comun/juntos.js";

export const NOMBRE = () => t("Dibuja ese Pokémon");
export const COMO = () => t("Por turnos, uno dibuja el Pokémon que le toca y el otro lo adivina escribiendo su nombre. Cuanto antes se acierte, más puntos (para los dos). Ocho rondas: cuatro dibuja cada uno.");
const RONDAS = 8;
const rondasDe = (partida) => ((partida && partida.datos) || {}).total || 4;
const PUNTOS_MAX = 100;
const PUNTOS_MIN = 20;
const COLORES = [
  "#222222", "#7a7a7a", "#c8c8c8", "#ffffff", "#e03c31", "#f28b82", "#f2a51a", "#f7d038", "#fff3a0",
  "#3fa34d", "#9fdc6f", "#1e6b3a", "#2f80ed", "#8fd3ff", "#1b3b8f", "#8e44ad", "#e58ad8", "#8b5a2b"
];
const GROSORES = [4, 9, 18, 32];
// Las coordenadas: x de 0 a ANCHO, y de 0 a ALTO (la pizarra es apaisada, 5:3)
const ANCHO = 1000;
const ALTO = 600;
const ENVIAR_CADA = 150; // ms: lo dibujado llega al otro mientras se dibuja
const AVISO_MS = 1800; // lo que dura el «¡Acertado!» entre ronda y ronda

let caja = null;
let actual = null;
let ctxActual = null;
let montada = ""; // `${partida}:${ronda}:${estado}` de lo que hay pintado
let trazos = []; // los de la partida (todas las rondas)
let dejarDeEscuchar = null;
let escuchando = "";
let color = COLORES[0];
let grosor = GROSORES[1];
let trazo = null; // el que se está dibujando: [[x, y]]
let trazoRonda = -1; // la ronda en la que se empezó (si cambia a medias, se tira)
let enviados = 0; // cuántos puntos del trazo ya han salido
let ultimoEnvio = 0;
let rondaVista = { id: "", ronda: -1 }; // para saber cuándo ha cambiado la ronda (y avisar de cómo acabó)
const terminando = new Set();

export function datosIniciales() {
  return { total: RONDAS, ronda: 0, inicio: 0, rondas: [], fallos: [] };
}

export function alAceptar() {
  return { "datos.inicio": Date.now() };
}

export function soltar() {
  if (dejarDeEscuchar) dejarDeEscuchar();
  dejarDeEscuchar = null;
  escuchando = "";
  trazos = [];
  montada = "";
  trazo = null;
  rondaVista = { id: "", ronda: -1 };
  caja = null;
}

// Quién dibuja en cada ronda: empieza el retado
const dibujante = (partida, ronda) => partida.jugadores[(ronda + 1) % 2];

// Los Pokémon de cada ronda (de las primeras generaciones: más fáciles de dibujar y de reconocer)
function objetivos(partida, ctx) {
  const azar = ctx.azar();
  const lista = ctx.especies.filter((e) => e.gen <= 4);
  const elegidos = [];
  while (elegidos.length < rondasDe(partida)) {
    const especie = lista[Math.floor(azar() * lista.length)];
    if (!elegidos.includes(especie)) elegidos.push(especie);
  }
  return elegidos;
}

const puntosDe = (segundos) => Math.max(PUNTOS_MIN, PUNTOS_MAX - Math.round(segundos));

function marcador(partida) {
  const puntos = { [partida.jugadores[0]]: 0, [partida.jugadores[1]]: 0 };
  ((partida.datos || {}).rondas || []).forEach((ronda, r) => {
    if (!ronda.acierto) return;
    const dibuja = dibujante(partida, r);
    const adivina = partida.jugadores[0] === dibuja ? partida.jugadores[1] : partida.jugadores[0];
    const p = puntosDe(ronda.segundos);
    puntos[adivina] += p;
    puntos[dibuja] += Math.round(p / 2);
  });
  return puntos;
}

// ---------- Lienzo ----------

function pintarLienzo() {
  const lienzo = caja && caja.querySelector(".dibujo-lienzo");
  if (!lienzo || !actual) return;
  const ronda = (actual.datos || {}).ronda || 0;
  const c = lienzo.getContext("2d");
  const escala = lienzo.width / ANCHO;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, lienzo.width, lienzo.height);
  const deLaRonda = trazos.filter((cada) => cada.ronda === ronda);
  // Desde el último «borrar»
  let desde = 0;
  deLaRonda.forEach((cada, i) => {
    if (cada.puntos === "C") desde = i + 1;
  });
  const todos = deLaRonda.slice(desde).map((cada) => leerTrazo(cada.puntos)).filter(Boolean);
  if (trazo && trazoRonda === ronda) todos.push({ color, grosor, puntos: trazo });
  for (const cada of todos) {
    c.strokeStyle = cada.color;
    c.lineWidth = cada.grosor * escala;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    cada.puntos.forEach(([x, y], i) => (i ? c.lineTo(x * escala, y * escala) : c.moveTo(x * escala, y * escala)));
    if (cada.puntos.length === 1) c.lineTo(cada.puntos[0][0] * escala + 0.1, cada.puntos[0][1] * escala);
    c.stroke();
  }
}

function leerTrazo(texto) {
  const [col, gro, puntos] = String(texto).split("|");
  if (!puntos) return null;
  return { color: col, grosor: Number(gro) || 6, puntos: puntos.split(" ").map((par) => par.split(",").map(Number)) };
}

function posicion(e, lienzo) {
  const caja = lienzo.getBoundingClientRect();
  const x = Math.round(((e.clientX - caja.left) / caja.width) * ANCHO);
  const y = Math.round(((e.clientY - caja.top) / caja.height) * ALTO);
  return [Math.max(0, Math.min(ANCHO, x)), Math.max(0, Math.min(ALTO, y))];
}

function activarLienzo(lienzo) {
  lienzo.addEventListener("pointerdown", (e) => {
    if (!puedoDibujar()) return;
    e.preventDefault();
    lienzo.setPointerCapture(e.pointerId);
    trazo = [posicion(e, lienzo)];
    trazoRonda = (actual.datos || {}).ronda || 0;
    enviados = 0;
    ultimoEnvio = performance.now();
    pintarLienzo();
  });
  lienzo.addEventListener("pointermove", (e) => {
    if (!trazo) return;
    const [x, y] = posicion(e, lienzo);
    const [px, py] = trazo[trazo.length - 1];
    if (Math.abs(x - px) + Math.abs(y - py) < 6) return; // menos puntos, el mismo dibujo
    trazo.push([x, y]);
    pintarLienzo();
    // A trocitos mientras se dibuja: así el otro lo ve casi a la vez
    if (performance.now() - ultimoEnvio >= ENVIAR_CADA) mandarLoNuevo();
  });
  const soltarTrazo = () => {
    if (!trazo) return;
    mandarLoNuevo(true);
    trazo = null;
    pintarLienzo();
  };
  lienzo.addEventListener("pointerup", soltarTrazo);
  lienzo.addEventListener("pointercancel", soltarTrazo);
}

// Lo del trazo que aún no ha salido (desde el último punto mandado, para que no quede un hueco), en trozos que
// quepan en las reglas (6.000 caracteres). Si la ronda ya ha cambiado (lo han acertado a medias), se tira.
function mandarLoNuevo(final = false) {
  if (!trazo || !actual) return;
  const ronda = (actual.datos || {}).ronda || 0;
  if (ronda !== trazoRonda || !puedoDibujar()) {
    trazo = null;
    return;
  }
  ultimoEnvio = performance.now();
  const desde = Math.max(0, enviados - 1);
  // Un solo punto suelto solo se manda al soltar (es un puntito)
  if (trazo.length - desde < 2 && !(final && trazo.length === 1)) return;
  const nuevos = trazo.slice(desde);
  enviados = trazo.length;
  for (let i = 0; i < nuevos.length; i += 500) {
    const trozo = nuevos.slice(Math.max(0, i - 1), i + 500);
    const texto = `${color}|${grosor}|${trozo.map(([x, y]) => `${x},${y}`).join(" ")}`;
    trazos.push({ ronda, puntos: texto, creado: Date.now(), propio: true });
    mandarTrazo(actual.id, ronda, texto).catch((error) => console.error(error));
  }
}

function puedoDibujar() {
  if (!actual || actual.estado !== "jugando") return false;
  const ronda = (actual.datos || {}).ronda || 0;
  return ronda < rondasDe(actual) && dibujante(actual, ronda) === ctxActual.yo;
}

function escuchar(partida) {
  if (escuchando === partida.id) return;
  if (dejarDeEscuchar) dejarDeEscuchar();
  escuchando = partida.id;
  trazos = [];
  dejarDeEscuchar = escucharTrazos(partida.id, (lista) => {
    trazos = lista;
    pintarLienzo();
  });
}

// ---------- Pantalla ----------

// Cómo acabó la ronda que se acaba de cerrar: un aviso grande encima de la pizarra que hace de transición
function plantillaAviso(partida, ctx, r) {
  const d = partida.datos || {};
  const hecha = (d.rondas || [])[r];
  const especie = objetivos(partida, ctx)[r];
  if (!hecha || !especie) return "";
  const dibuja = dibujante(partida, r);
  const adivina = dibuja === ctx.yo ? ctx.otro : ctx.yo;
  const texto = hecha.acierto
    ? (adivina === ctx.yo ? t("¡Correcto!") : t("¡{quien} lo ha acertado!", { quien: escaparHTML(ctx.nombreDe(adivina)) }))
    : t("Ronda pasada");
  const extra = hecha.acierto ? ` · +${puntosDe(hecha.segundos)}` : "";
  return `
    <div class="dibujo-aviso ${hecha.acierto ? "bien" : "pasada"}">
      <img src="${escaparHTML(urlArte({ id: especie.id }))}" alt="" draggable="false">
      <strong>${texto}</strong>
      <span>${t("Era {pokemon}", { pokemon: `<b>${escaparHTML(nombreDe(especie))}</b>` })}${extra}</span>
    </div>`;
}

export function montar(contenedor, partida, ctx) {
  const nuevaCaja = caja !== contenedor;
  caja = contenedor;
  actual = partida;
  ctxActual = ctx;
  escuchar(partida);
  const d = partida.datos || {};
  const total = rondasDe(partida);
  const ronda = d.ronda || 0;
  const fin = partida.estado === "fin" || ronda >= total;
  const puntos = marcador(partida);

  // Acabadas las rondas: el final (lo apunta el primero que lo ve)
  if (partida.estado === "jugando" && ronda >= total && !terminando.has(partida.id)) {
    terminando.add(partida.id);
    const [uno, dos] = partida.jugadores;
    ctx.terminar(puntos[uno] > puntos[dos] ? uno : puntos[dos] > puntos[uno] ? dos : "empate").catch((error) => {
      console.error(error);
      terminando.delete(partida.id);
    });
  }

  // ¿Acaba de cerrarse una ronda? (no al abrir la partida: solo si ya la estábamos viendo)
  const cambiaRonda = rondaVista.id === partida.id && ronda > rondaVista.ronda && rondaVista.ronda >= 0;
  const cerrada = cambiaRonda ? ronda - 1 : -1;
  rondaVista = { id: partida.id, ronda };
  // La ronda ha cambiado a medias de un trazo: fuera (que no se quede pintado en la siguiente)
  if (cambiaRonda) trazo = null;

  const clave = `${partida.id}:${ronda}:${partida.estado}`;
  const lista = objetivos(partida, ctx);
  const dibujo = !fin && dibujante(partida, ronda) === ctx.yo;
  const cabeza = `
    <div class="cromos-marcador">
      <span><b>${puntos[ctx.yo]}</b> ${t("Tú")}</span>
      <span class="cromos-ronda">${fin ? t("Final") : t("Ronda {n} de {total}", { n: ronda + 1, total })}</span>
      <span>${escaparHTML(ctx.nombreDe(ctx.otro))} <b>${puntos[ctx.otro]}</b></span>
    </div>`;

  if (fin) {
    if (montada === clave && !nuevaCaja) return;
    montada = clave;
    caja.innerHTML = `
      <div class="dibujo">
        ${cabeza}
        <ol class="siluetas-repaso siluetas-final dibujo-final" style="--columnas: ${Math.ceil(total / 2)}">${lista.map((especie, r) => {
          const suya = (d.rondas || [])[r];
          return `
            <li>
              <img src="${escaparHTML(urlArte({ id: especie.id }))}" alt="" draggable="false" loading="lazy">
              <span>${escaparHTML(nombreDe(especie))}</span>
              <small>${t("dibujó {quien}", { quien: escaparHTML(ctx.nombreDe(dibujante(partida, r))) })}</small>
              <small class="${suya && suya.acierto ? "bien" : "mal"}">${suya ? (suya.acierto ? `${icono("visto")} ${t("{n} s", { n: Math.round(suya.segundos) })} · +${puntosDe(suya.segundos)}` : `${icono("aspa")} ${t("pasada")}`) : "–"}</small>
            </li>`;
        }).join("")}</ol>
        ${cerrada >= 0 ? plantillaAviso(partida, ctx, cerrada) : ""}
      </div>`;
    quitarAvisoLuego();
    return;
  }

  // Lo que cambia sin rehacer el lienzo: los fallos de quien adivina
  if (!nuevaCaja && montada === clave) {
    const fallos = caja.querySelector(".dibujo-fallos");
    if (fallos) fallos.innerHTML = plantillaFallos(d, ctx);
    return;
  }
  montada = clave;
  const objetivo = lista[ronda];
  caja.innerHTML = `
    <div class="dibujo">
      ${cabeza}
      <p class="quien-aviso destacado">${dibujo
        ? `${t("Te toca dibujar:")} <b>${escaparHTML(nombreDe(objetivo))}</b>`
        : t("Dibuja {quien}. ¿Qué Pokémon es?", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>
      <div class="dibujo-pizarra">
        <canvas class="dibujo-lienzo ${dibujo ? "mio" : ""}" width="${ANCHO}" height="${ALTO}"></canvas>
        ${dibujo ? `<img class="dibujo-modelo" src="${escaparHTML(urlArte({ id: objetivo.id }))}" alt="" draggable="false">` : ""}
        ${cerrada >= 0 ? plantillaAviso(partida, ctx, cerrada) : ""}
      </div>
      ${dibujo
        ? `<div class="dibujo-herramientas">
             <div class="dibujo-colores">${COLORES.map((cada) => `<button class="dibujo-color ${cada === color ? "elegido" : ""}" data-color="${cada}" style="--c:${cada}" title="${cada}"></button>`).join("")}</div>
             <div class="dibujo-grosores">${GROSORES.map((cada) => `<button class="dibujo-grosor ${cada === grosor ? "elegido" : ""}" data-grosor="${cada}"><i style="--g:${Math.min(cada / 2, 12)}px"></i></button>`).join("")}</div>
             <div class="quien-botones">
               <button class="dibujo-borrar boton-gris">${icono("papelera")} ${t("Borrar todo")}</button>
               <button class="dibujo-pasar boton-gris">${t("Pasar la ronda")}</button>
             </div>
           </div>`
        : `<form class="juego-form dibujo-adivinar">
             <span class="juego-campo"><input type="text" autocomplete="off" placeholder="${t("Escribe un Pokémon...")}" aria-label="${t("Pokémon")}"></span>
             <button type="submit">${t("Probar")}</button>
           </form>`}
      <ul class="dibujo-fallos">${plantillaFallos(d, ctx)}</ul>
    </div>`;

  activarLienzo(caja.querySelector(".dibujo-lienzo"));
  pintarLienzo();
  quitarAvisoLuego();
  if (!caja.dataset.activo) {
    caja.dataset.activo = "1";
    caja.addEventListener("click", alPulsar);
  }
  const formulario = caja.querySelector(".dibujo-adivinar");
  if (formulario) {
    const campo = formulario.querySelector("input");
    const sugerencias = activarAutocompletado(campo, ctx.especies, probar, { icono: iconoPokemon });
    formulario.addEventListener("submit", (e) => {
      e.preventDefault();
      sugerencias.elegirPrimera();
    });
    if (cerrada >= 0) campo.focus();
  }
}

// El aviso entre rondas se va solo (con su animación de salida)
function quitarAvisoLuego() {
  const aviso = caja && caja.querySelector(".dibujo-aviso");
  if (!aviso) return;
  setTimeout(() => aviso.classList.add("saliendo"), AVISO_MS);
  setTimeout(() => aviso.remove(), AVISO_MS + 400);
}

function plantillaFallos(d, ctx) {
  return (d.fallos || [])
    .map((numero) => ctx.especies.find((e) => e.id === numero))
    .filter(Boolean)
    .map((especie) => `<li>${icono("aspa")} ${escaparHTML(nombreDe(especie))}</li>`)
    .join("");
}

// La ronda, terminada (acertada o pasada): la siguiente, la dibuja el otro
function acabarRonda(acierto) {
  const ctx = ctxActual;
  const ronda = (actual.datos || {}).ronda || 0;
  return ctx.seguro((ahora) => {
    const d = ahora.datos || {};
    if (ahora.estado !== "jugando" || (d.ronda || 0) !== ronda) return null;
    const segundos = Math.max(0, (Date.now() - (d.inicio || Date.now())) / 1000);
    const rondas = [...(d.rondas || []), { acierto, segundos: Math.round(segundos * 10) / 10 }];
    const siguiente = ronda + 1;
    return {
      "datos.rondas": rondas,
      "datos.ronda": siguiente,
      "datos.inicio": Date.now(),
      "datos.fallos": [],
      turno: siguiente < rondasDe(ahora) ? dibujante(ahora, siguiente) : ""
    };
  });
}

async function probar(especie) {
  if (!actual || actual.estado !== "jugando" || puedoDibujar()) return;
  const ctx = ctxActual;
  const d = actual.datos || {};
  const objetivo = objetivos(actual, ctx)[d.ronda || 0];
  const campo = caja.querySelector(".dibujo-adivinar input");
  try {
    if (especie.id === objetivo.id) {
      await acabarRonda(true);
    } else {
      if (campo) campo.value = "";
      const fallos = [...new Set([...(d.fallos || []), especie.id])].slice(-20);
      await ctx.cambiar({ "datos.fallos": fallos });
      if (campo) campo.focus();
    }
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido guardar. Revisa la conexión y vuelve a probar."));
  }
}

async function alPulsar(e) {
  const boton = e.target.closest("button");
  if (!boton || !actual) return;
  if (boton.dataset.color) {
    color = boton.dataset.color;
    for (const cada of caja.querySelectorAll(".dibujo-color")) cada.classList.toggle("elegido", cada === boton);
  } else if (boton.dataset.grosor) {
    grosor = Number(boton.dataset.grosor);
    for (const cada of caja.querySelectorAll(".dibujo-grosor")) cada.classList.toggle("elegido", cada === boton);
  } else if (boton.matches(".dibujo-borrar") && puedoDibujar()) {
    const ronda = (actual.datos || {}).ronda || 0;
    trazos.push({ ronda, puntos: "C", creado: Date.now() });
    pintarLienzo();
    mandarTrazo(actual.id, ronda, "C").catch((error) => console.error(error));
  } else if (boton.matches(".dibujo-pasar") && puedoDibujar()) {
    if (await confirmar(t("¿Pasar la ronda? Nadie se lleva puntos en esta."))) acabarRonda(false).catch((error) => console.error(error));
  }
}
