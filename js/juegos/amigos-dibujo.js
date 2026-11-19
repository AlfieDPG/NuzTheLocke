// «Dibuja ese Pokémon» con un amigo (ver js/juegos/amigos.js): RONDAS rondas, la mitad dibuja cada uno.
//   · Quien dibuja ve qué Pokémon le ha tocado (sale de la semilla) y lo dibuja en el lienzo; los trazos llegan al
//     otro al soltar cada uno (juntos/{id}/trazos).
//   · Quien adivina escribe Pokémon hasta acertar. Cuanto antes, más puntos: PUNTOS_MAX − 1 por segundo (como poco
//     PUNTOS_MIN) para quien acierta y la mitad para quien dibujó. Quien dibuja puede pasar la ronda (0 puntos).
//   · Gana quien sume más al final.
//
//   datos: { ronda, inicio (ms de cuando empezó la ronda), rondas: [{ acierto, segundos }], fallos: [especie] }
//   trazos: { uid, ronda, puntos: "C" (borrar) | "color|grosor|x,y x,y ..." (de 0 a 1000) }

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { urlArte } from "../comun/imagenes.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { avisar, confirmar } from "../comun/ventanas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { mandarTrazo, escucharTrazos } from "../comun/juntos.js";

export const NOMBRE = () => t("Dibuja ese Pokémon");
export const COMO = () => t("Por turnos, uno dibuja el Pokémon que le toca y el otro lo adivina escribiendo su nombre. Cuanto antes se acierte, más puntos (para los dos). Cuatro rondas: dos dibuja cada uno.");
const RONDAS = 4;
const PUNTOS_MAX = 100;
const PUNTOS_MIN = 20;
const COLORES = ["#222222", "#e03c31", "#f2a51a", "#f7d038", "#3fa34d", "#2f80ed", "#8e44ad", "#8b5a2b", "#ffffff"];
const GROSORES = [4, 9, 18];
const LADO = 1000; // las coordenadas, de 0 a LADO

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
const terminando = new Set();

export function datosIniciales() {
  return { ronda: 0, inicio: 0, rondas: [], fallos: [] };
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
  caja = null;
}

// Quién dibuja en cada ronda: empieza el retado
const dibujante = (partida, ronda) => partida.jugadores[(ronda + 1) % 2];

// Los Pokémon de cada ronda (de las primeras generaciones: más fáciles de dibujar y de reconocer)
function objetivos(ctx) {
  const azar = ctx.azar();
  const lista = ctx.especies.filter((e) => e.gen <= 4);
  const elegidos = [];
  while (elegidos.length < RONDAS) {
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
  const escala = lienzo.width / LADO;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, lienzo.width, lienzo.height);
  const deLaRonda = trazos.filter((cada) => cada.ronda === ronda);
  // Desde el último «borrar»
  let desde = 0;
  deLaRonda.forEach((cada, i) => {
    if (cada.puntos === "C") desde = i + 1;
  });
  const todos = deLaRonda.slice(desde).map((cada) => leerTrazo(cada.puntos)).filter(Boolean);
  if (trazo) todos.push({ color, grosor, puntos: trazo });
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
  const x = Math.round(((e.clientX - caja.left) / caja.width) * LADO);
  const y = Math.round(((e.clientY - caja.top) / caja.height) * LADO);
  return [Math.max(0, Math.min(LADO, x)), Math.max(0, Math.min(LADO, y))];
}

function activarLienzo(lienzo) {
  lienzo.addEventListener("pointerdown", (e) => {
    if (!puedoDibujar()) return;
    e.preventDefault();
    lienzo.setPointerCapture(e.pointerId);
    trazo = [posicion(e, lienzo)];
    pintarLienzo();
  });
  lienzo.addEventListener("pointermove", (e) => {
    if (!trazo) return;
    const [x, y] = posicion(e, lienzo);
    const [px, py] = trazo[trazo.length - 1];
    if (Math.abs(x - px) + Math.abs(y - py) < 6) return; // menos puntos, el mismo dibujo
    trazo.push([x, y]);
    pintarLienzo();
  });
  const soltarTrazo = () => {
    if (!trazo) return;
    const puntos = trazo;
    trazo = null;
    enviar(puntos);
  };
  lienzo.addEventListener("pointerup", soltarTrazo);
  lienzo.addEventListener("pointercancel", soltarTrazo);
}

// Un trazo, en trozos que quepan en las reglas (6.000 caracteres): se pinta ya y se manda
function enviar(puntos) {
  const ronda = (actual.datos || {}).ronda || 0;
  const trozos = [];
  for (let i = 0; i < puntos.length; i += 500) trozos.push(puntos.slice(Math.max(0, i - 1), i + 500));
  for (const trozo of trozos) {
    const texto = `${color}|${grosor}|${trozo.map(([x, y]) => `${x},${y}`).join(" ")}`;
    trazos.push({ ronda, puntos: texto, creado: Date.now(), propio: true });
    mandarTrazo(actual.id, ronda, texto).catch((error) => console.error(error));
  }
  pintarLienzo();
}

function puedoDibujar() {
  if (!actual || actual.estado !== "jugando") return false;
  const ronda = (actual.datos || {}).ronda || 0;
  return ronda < RONDAS && dibujante(actual, ronda) === ctxActual.yo;
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

export function montar(contenedor, partida, ctx) {
  const nuevaCaja = caja !== contenedor;
  caja = contenedor;
  actual = partida;
  ctxActual = ctx;
  escuchar(partida);
  const d = partida.datos || {};
  const ronda = d.ronda || 0;
  const fin = partida.estado === "fin" || ronda >= RONDAS;
  const puntos = marcador(partida);

  // Acabadas las rondas: el final (lo apunta el primero que lo ve)
  if (partida.estado === "jugando" && ronda >= RONDAS && !terminando.has(partida.id)) {
    terminando.add(partida.id);
    const [uno, dos] = partida.jugadores;
    ctx.terminar(puntos[uno] > puntos[dos] ? uno : puntos[dos] > puntos[uno] ? dos : "empate").catch((error) => {
      console.error(error);
      terminando.delete(partida.id);
    });
  }

  const clave = `${partida.id}:${ronda}:${partida.estado}`;
  const lista = objetivos(ctx);
  const dibujo = !fin && dibujante(partida, ronda) === ctx.yo;
  const cabeza = `
    <div class="cromos-marcador">
      <span><b>${puntos[ctx.yo]}</b> ${t("Tú")}</span>
      <span class="cromos-ronda">${fin ? t("Final") : t("Ronda {n} de {total}", { n: ronda + 1, total: RONDAS })}</span>
      <span>${escaparHTML(ctx.nombreDe(ctx.otro))} <b>${puntos[ctx.otro]}</b></span>
    </div>`;

  if (fin) {
    montada = clave;
    caja.innerHTML = `
      <div class="dibujo">
        ${cabeza}
        <ol class="siluetas-repaso">${lista.map((especie, r) => {
          const suya = (d.rondas || [])[r];
          return `
            <li>
              <img src="${escaparHTML(urlArte({ id: especie.id }))}" alt="" draggable="false" loading="lazy">
              <span>${escaparHTML(nombreDe(especie))}</span>
              <small>${t("dibujó {quien}", { quien: escaparHTML(ctx.nombreDe(dibujante(partida, r))) })}</small>
              <small class="${suya && suya.acierto ? "bien" : "mal"}">${suya ? (suya.acierto ? `${icono("visto")} ${t("{n} s", { n: Math.round(suya.segundos) })}` : `${icono("aspa")} ${t("pasada")}`) : "–"}</small>
            </li>`;
        }).join("")}</ol>
      </div>`;
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
      <div class="dibujo-mesa">
        <canvas class="dibujo-lienzo ${dibujo ? "mio" : ""}" width="640" height="640"></canvas>
        <div class="dibujo-lado">
          ${dibujo
            ? `<p class="quien-aviso destacado">${t("Te toca dibujar:")} <b>${escaparHTML(nombreDe(objetivo))}</b></p>
               <img class="dibujo-modelo" src="${escaparHTML(urlArte({ id: objetivo.id }))}" alt="" draggable="false">
               <div class="dibujo-colores">${COLORES.map((cada) => `<button class="dibujo-color ${cada === color ? "elegido" : ""}" data-color="${cada}" style="--c:${cada}" title="${cada}"></button>`).join("")}</div>
               <div class="dibujo-grosores">${GROSORES.map((cada) => `<button class="dibujo-grosor ${cada === grosor ? "elegido" : ""}" data-grosor="${cada}"><i style="--g:${cada / 2}px"></i></button>`).join("")}</div>
               <div class="quien-botones">
                 <button class="dibujo-borrar boton-gris">${icono("papelera")} ${t("Borrar todo")}</button>
                 <button class="dibujo-pasar boton-gris">${t("Pasar la ronda")}</button>
               </div>`
            : `<p class="quien-aviso destacado">${t("Dibuja {quien}. ¿Qué Pokémon es?", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>
               <form class="juego-form dibujo-adivinar">
                 <span class="juego-campo"><input type="text" autocomplete="off" placeholder="${t("Escribe un Pokémon...")}" aria-label="${t("Pokémon")}"></span>
                 <button type="submit">${t("Probar")}</button>
               </form>`}
          <ul class="dibujo-fallos">${plantillaFallos(d, ctx)}</ul>
        </div>
      </div>
    </div>`;

  activarLienzo(caja.querySelector(".dibujo-lienzo"));
  pintarLienzo();
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
  }
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
      turno: siguiente < RONDAS ? dibujante(ahora, siguiente) : ""
    };
  });
}

async function probar(especie) {
  if (!actual || actual.estado !== "jugando" || puedoDibujar()) return;
  const ctx = ctxActual;
  const d = actual.datos || {};
  const objetivo = objetivos(ctx)[d.ronda || 0];
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
