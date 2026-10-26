// Ventana «Crónica» de un locke terminado: el resumen de lo que ha sido, con una imagen para
// compartir. Se abre desde la tarjeta del locke, solo cuando está cerrado.
//
//   · Arriba el resultado y la duración; luego una ficha por jugador (cifras y equipo final),
//     unos destacados (el primero en morir, racha más larga sin muertes, día más negro, tipo que más muere) y la
//     cronología con los hitos de la actividad.
//   · «Descargar imagen» dibuja a mano (canvas) una tarjeta con lo mismo, sin cronología. Los
//     retratos solo salen si el navegador deja usarlos en el canvas; si no, la tarjeta va sin ellos.
//
// Los números están en js/comun/cronica.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML, fechaLarga } from "../comun/utilidades.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { tiposEs } from "../comun/tipos.js";
import { urlsRetrato } from "../comun/imagenes.js";
import { caraDePokemon } from "../comun/elegir-equipo.js";
import { nombreJuego } from "../comun/campo-juego.js";
import { colorDeTipo } from "../comun/perfiles.js";
import { tieneMedallas } from "../comun/medallas.js";
import { lockePorId, leerActividad } from "../comun/lockes.js";
import { calcularCronica, textoDestacado } from "../comun/cronica.js";
import { nombreMuerto } from "./cementerio.js";
import { textoSuceso, iconoSuceso } from "./actividad.js";
import { sumarContador } from "../comun/contadores.js";
import { t, LOCALE } from "../comun/idioma.js";

const MAX_HITOS = 120;

let dialogo = null;
let actual = null; // { locke, datos } de la crónica abierta

// ---------- Datos ----------

let tiposDeEspecie = null;

async function tiposPorEspecie() {
  if (tiposDeEspecie) return tiposDeEspecie;
  const mapa = new Map();
  try {
    for (const fila of await cargarPokedex()) if (!fila.forma) mapa.set(fila.numero, fila.tipos || []);
  } catch (error) {
    // sin Pokédex, sin «tipo que más muere»
  }
  if (mapa.size) tiposDeEspecie = mapa;
  return mapa;
}

function fechaCorta(milisegundos) {
  return new Date(milisegundos).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

function fechaDe(milisegundos) {
  return new Date(milisegundos).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

// ---------- Ventana ----------

function resultadoDe(locke) {
  if (!locke.ganador) return `${icono("aspa")} ${t("Nadie ganó")}`;
  return `${icono("corona")} ${t("Ganó {nombre}", { nombre: escaparHTML((locke.nombres || {})[locke.ganador] || t("alguien")) })}`;
}

// Las cifras de un jugador: [etiqueta, valor]
function cifrasDe(jugador, locke) {
  const cifras = [
    [t("Victorias"), jugador.victorias],
    [t("Muertos"), jugador.muertos],
    [t("Vidas"), jugador.vidas === null ? "∞" : `${jugador.vidas}/${jugador.vidasIniciales}`]
  ];
  if (jugador.supervivencia !== null) cifras.push([t("Supervivencia"), `${jugador.supervivencia}%`]);
  if (tieneMedallas(locke.juego)) cifras.push([t("Medallas"), jugador.medallas]);
  cifras.push([t("ROM"), jugador.rom ? t("Pasada") : t("Sin pasar")]);
  if (jugador.infracciones) cifras.push([t("Avisos del árbitro"), jugador.infracciones]);
  return cifras;
}

function fichaJugador(jugador, locke) {
  return `
    <section class="cronica-jugador ${jugador.gano ? "ganador" : ""} ${jugador.eliminado ? "eliminado" : ""}">
      <header>
        ${jugador.foto ? `<img class="cronica-foto" src="${escaparHTML(jugador.foto)}" alt="" referrerpolicy="no-referrer" data-quitar-si-falla>` : ""}
        <strong>${escaparHTML(jugador.nombre)}</strong>
        ${jugador.gano ? `<span class="cronica-corona">${icono("corona")}</span>` : ""}
        ${jugador.eliminado ? `<span class="cronica-fuera">${t("Eliminado")}</span>` : ""}
      </header>
      <dl class="cronica-cifras">
        ${cifrasDe(jugador, locke).map(([etiqueta, valor]) => `<div><dt>${escaparHTML(etiqueta)}</dt><dd>${escaparHTML(String(valor))}</dd></div>`).join("")}
      </dl>
      ${jugador.equipo.length
        ? `<div class="cronica-equipo">${jugador.equipo
            .map((p, i) => `<span class="cronica-cara ${i === jugador.mvp ? "mvp" : ""}">${caraDePokemon(p)}${i === jugador.mvp ? `<small>MVP</small>` : ""}</span>`)
            .join("")}</div>`
        : ""}
    </section>`;
}

function hitoHTML(suceso, locke) {
  const texto = textoSuceso(suceso, locke);
  if (!texto) return "";
  return `
    <div class="suceso suceso-${escaparHTML(suceso.tipo)} ${suceso.delta < 0 ? "resta" : ""}">
      <span class="suceso-icono">${iconoSuceso(suceso)}</span>
      <span class="suceso-cuerpo"><span class="suceso-texto">${texto}</span></span>
      <time class="suceso-cuando">${fechaCorta(suceso.cuando)}</time>
    </div>`;
}

function pintar(locke, datos, hayActividad) {
  const juego = nombreJuego(locke);
  const cuerpo = dialogo.querySelector(".cronica-cuerpo");
  const frases = datos.destacados.map((destacado) => textoDestacado(destacado, nombreMuerto)).filter(Boolean);
  const hitos = datos.hitos.map((suceso) => hitoHTML(suceso, locke)).filter(Boolean);

  dialogo.querySelector(".cronica-titulo").innerHTML = `${icono("trofeo")} ${escaparHTML(locke.nombre)}`;
  cuerpo.innerHTML = `
    <p class="cronica-resumen">
      <span class="cronica-resultado ${locke.ganador ? "" : "sin-ganador"}">${resultadoDe(locke)}</span>
      <span>${[
        juego,
        datos.fin ? `${fechaDe(datos.inicio)} – ${fechaLarga(locke.fechaFin)}` : fechaDe(datos.inicio),
        t(datos.dias === 1 ? "{n} día" : "{n} días", { n: datos.dias }),
        t(datos.caidos === 1 ? "{n} Pokémon muerto" : "{n} Pokémon muertos", { n: datos.caidos })
      ].filter(Boolean).map(escaparHTML).join(" · ")}</span>
    </p>
    <div class="cronica-jugadores">${datos.jugadores.map((jugador) => fichaJugador(jugador, locke)).join("")}</div>
    ${frases.length ? `<h3>${t("Destacados")}</h3><ul class="cronica-destacados">${frases.map((frase) => `<li>${escaparHTML(frase)}</li>`).join("")}</ul>` : ""}
    <h3>${t("Cronología")}</h3>
    <div class="cronica-hitos">
      ${hayActividad
        ? hitos.slice(0, MAX_HITOS).join("") || `<p class="actividad-vacia">${t("Todavía no ha pasado nada.")}</p>`
        : `<p class="actividad-vacia">${t("No se ha podido cargar.")}</p>`}
    </div>`;
}

export async function abrirCronica(id) {
  const locke = lockePorId(id);
  if (!locke) return;
  actual = null;
  dialogo.querySelector(".cronica-titulo").innerHTML = `${icono("trofeo")} ${escaparHTML(locke.nombre)}`;
  dialogo.querySelector(".cronica-cuerpo").innerHTML = `<p class="actividad-vacia">${t("Preparando la crónica…")}</p>`;
  dialogo.querySelector(".cronica-imagen").disabled = true;
  dialogo.showModal();

  const [sucesos, tipos] = await Promise.all([leerActividad(id), tiposPorEspecie()]);
  if (!dialogo.open) return;
  const datos = calcularCronica(locke, sucesos || [], tipos, (tipo) => tiposEs[tipo] || tipo);
  actual = { locke, datos };
  pintar(locke, datos, sucesos !== null);
  dialogo.querySelector(".cronica-imagen").disabled = false;
  dialogo.querySelector(".cronica-compartir").hidden = !puedeCompartir();
  sumarContador("cronica");
}

// ---------- Imagen para compartir ----------

const ANCHO = 1080;
const MARGEN = 64;
const FUENTE = '"Baloo 2", "Nunito", system-ui, sans-serif';

// Un retrato, o null si no se puede (otra dirección, o el navegador no lo deja usar en el canvas)
function cargarImagen(urls) {
  const probar = (indice) =>
    new Promise((resolver) => {
      if (indice >= Math.min(urls.length, 2)) return resolver(null);
      const imagen = new Image();
      imagen.crossOrigin = "anonymous";
      const espera = setTimeout(() => resolver(probar(indice + 1)), 4000);
      imagen.onload = () => {
        clearTimeout(espera);
        resolver(imagen);
      };
      imagen.onerror = () => {
        clearTimeout(espera);
        resolver(probar(indice + 1));
      };
      imagen.src = urls[indice];
    });
  return probar(0);
}

function rectanguloRedondo(ctx, x, y, ancho, alto, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

// Reduce la letra hasta que el texto cabe en el ancho
function textoAjustado(ctx, texto, x, y, anchoMax, peso, tamano) {
  let letra = tamano;
  do {
    ctx.font = `${peso} ${letra}px ${FUENTE}`;
    letra -= 2;
  } while (ctx.measureText(texto).width > anchoMax && letra > 16);
  ctx.fillText(texto, x, y);
}

async function dibujarImagen({ locke, datos }) {
  try {
    await Promise.all([document.fonts.load(`700 40px "Baloo 2"`), document.fonts.load(`400 28px "Nunito"`)]);
  } catch (error) {
    // sin las letras de la web, sale con las del sistema
  }

  const color = colorDeTipo(locke.tipo);
  const frases = datos.destacados.map((destacado) => textoDestacado(destacado, nombreMuerto)).filter(Boolean).slice(0, 4);
  const altoJugador = (jugador) => 150 + (jugador.equipo.length ? 140 : 0);
  const alto = 400 + datos.jugadores.reduce((suma, jugador) => suma + altoJugador(jugador) + 24, 0) + (frases.length ? 80 + frases.length * 46 : 0) + 110;

  // Los retratos del equipo final, a la vez
  const retratos = await Promise.all(
    datos.jugadores.map((jugador) => Promise.all(jugador.equipo.slice(0, 6).map((p) => cargarImagen(urlsRetrato(p)))))
  );

  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");

  ctx.fillStyle = "#1d2826";
  ctx.fillRect(0, 0, ANCHO, alto);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ANCHO, 18);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.font = `700 28px ${FUENTE}`;
  ctx.fillText(String((locke.tipo && locke.tipo.nombre) || "Locke").toUpperCase(), MARGEN, 100);

  ctx.fillStyle = "#f4ead6";
  textoAjustado(ctx, locke.nombre, MARGEN, 190, ANCHO - 2 * MARGEN, 700, 84);

  ctx.fillStyle = "#a7b6aa";
  ctx.font = `400 30px ${FUENTE}`;
  const meta = [nombreJuego(locke), datos.fin ? fechaLarga(locke.fechaFin) : fechaDe(datos.inicio), t(datos.dias === 1 ? "{n} día" : "{n} días", { n: datos.dias })].filter(Boolean).join(" · ");
  textoAjustado(ctx, meta, MARGEN, 245, ANCHO - 2 * MARGEN, 400, 30);

  ctx.fillStyle = locke.ganador ? "#e6c27a" : "#a7b6aa";
  const ganador = locke.ganador
    ? t("Ganó {nombre}", { nombre: (locke.nombres || {})[locke.ganador] || t("alguien") })
    : t("Nadie ganó");
  textoAjustado(ctx, `${locke.ganador ? "★ " : ""}${ganador} · ${t(datos.caidos === 1 ? "{n} Pokémon muerto" : "{n} Pokémon muertos", { n: datos.caidos })}`, MARGEN, 310, ANCHO - 2 * MARGEN, 700, 40);

  let y = 370;
  datos.jugadores.forEach((jugador, i) => {
    const alturaFicha = altoJugador(jugador);
    ctx.fillStyle = "#283633";
    rectanguloRedondo(ctx, MARGEN, y, ANCHO - 2 * MARGEN, alturaFicha, 24);
    ctx.fill();
    ctx.fillStyle = jugador.gano ? "#e6c27a" : color;
    ctx.fillRect(MARGEN, y + 18, 8, alturaFicha - 36);

    ctx.fillStyle = "#f4ead6";
    textoAjustado(ctx, `${jugador.gano ? "★ " : ""}${jugador.nombre}${jugador.eliminado ? ` (${t("Eliminado")})` : ""}`, MARGEN + 36, y + 62, ANCHO - 2 * MARGEN - 72, 700, 44);

    ctx.fillStyle = "#a7b6aa";
    const linea = cifrasDe(jugador, locke).slice(0, 5).map(([etiqueta, valor]) => `${etiqueta} ${valor}`).join("  ·  ");
    textoAjustado(ctx, linea, MARGEN + 36, y + 112, ANCHO - 2 * MARGEN - 72, 400, 28);

    retratos[i].forEach((imagen, j) => {
      const x = MARGEN + 36 + j * 140;
      const arriba = y + 150;
      ctx.fillStyle = "#1d2826";
      rectanguloRedondo(ctx, x, arriba, 120, 120, 20);
      ctx.fill();
      if (imagen) {
        ctx.save();
        rectanguloRedondo(ctx, x, arriba, 120, 120, 20);
        ctx.clip();
        ctx.drawImage(imagen, x, arriba, 120, 120);
        ctx.restore();
      }
      if (j === jugador.mvp) {
        ctx.strokeStyle = "#e6c27a";
        ctx.lineWidth = 5;
        rectanguloRedondo(ctx, x, arriba, 120, 120, 20);
        ctx.stroke();
      }
    });
    y += alturaFicha + 24;
  });

  if (frases.length) {
    ctx.fillStyle = color;
    ctx.font = `700 34px ${FUENTE}`;
    ctx.fillText(t("Destacados"), MARGEN, y + 40);
    ctx.fillStyle = "#f4ead6";
    frases.forEach((frase, i) => textoAjustado(ctx, `• ${frase}`, MARGEN, y + 92 + i * 46, ANCHO - 2 * MARGEN, 400, 28));
  }

  ctx.fillStyle = "#a7b6aa";
  ctx.font = `700 26px ${FUENTE}`;
  ctx.textAlign = "right";
  ctx.fillText("NuzTheLocke", ANCHO - MARGEN, alto - 44);
  ctx.textAlign = "left";
  return lienzo;
}

function aBlob(lienzo) {
  return new Promise((resolver) => lienzo.toBlob(resolver, "image/png"));
}

function nombreDeArchivo(locke) {
  const base = locke.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `cronica-${base || "locke"}.png`;
}

function puedeCompartir() {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files: [new File([""], "cronica.png", { type: "image/png" })] }));
  } catch (error) {
    return false;
  }
}

async function crearImagen(compartir) {
  if (!actual) return;
  const botones = dialogo.querySelectorAll(".cronica-imagen, .cronica-compartir");
  for (const boton of botones) boton.disabled = true;
  try {
    const blob = await aBlob(await dibujarImagen(actual));
    if (!blob) return;
    const archivo = nombreDeArchivo(actual.locke);
    if (compartir) {
      await navigator.share({ files: [new File([blob], archivo, { type: "image/png" })], title: actual.locke.nombre });
    } else {
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = archivo;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
    }
  } catch (error) {
    // quien compartía ha cancelado
    if (!error || error.name !== "AbortError") console.error(error);
  } finally {
    for (const boton of botones) boton.disabled = false;
  }
}

export function iniciarCronica() {
  dialogo = document.querySelector("#dialogo-cronica");
  dialogo.querySelector(".cronica-cerrar").addEventListener("click", () => dialogo.close());
  dialogo.querySelector(".cronica-imagen").addEventListener("click", () => crearImagen(false));
  dialogo.querySelector(".cronica-compartir").addEventListener("click", () => crearImagen(true));
  dialogo.addEventListener("close", () => {
    actual = null;
  });
}
