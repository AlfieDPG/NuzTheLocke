// Sección «Juegos»: los retos del día. (La Tienda y los huevos tienen su propia sección:
// js/tienda/index.js.)
//
// Tres columnas que llegan hasta abajo de la pantalla en el ordenador (en pantallas más estrechas, dos
// o una; css/juegos.css, «A toda la altura»):
//   · Izquierda, la cartilla de hoy: los nueve retos, con un sello «+N» en los ya hechos y un
//     hueco de puntos en los que faltan; encima, la racha de la semana (los días jugados).
//   · En medio, el reto elegido (js/juegos/silueta.js, pistas.js, eficaz.js, masomenos.js,
//     grito.js, evolucion.js, tipos.js, intruso.js y locke.js; lo común en js/juegos/comun.js).
//   · Derecha, la clasificación con tus amigos (esta semana o siempre) y cómo les ha ido en el
//     reto que tienes abierto (siempre a la vista: solo dice los Pokédólares, no destripa nada).
//
// Las Pokédólares (cómo se ganan y cómo se guardan) están en js/comun/fichas.js.

import { icono } from "../comun/iconos.js";
import { flechasIr } from "../comun/utilidades.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual, alCambiarSesion, baseDeDatos } from "../comun/nube.js";
import { miPerfil, alCambiarMiPerfil, amigosAceptados, perfilesDeAmigos, alCambiarPerfilesAmigos } from "../comun/perfiles.js";
import {
  saldo, rachaDe, bonoRacha, fichasDeJuegos, marcoDe, claseMarco, plantillaTituloDe, hoy, lunesDe, fichasDeLaSemana
} from "../comun/fichas.js";
import { avisar } from "../comun/ventanas.js";
import { copiarAlPortapapeles } from "../equipos/exportar.js";
import { t, LOCALE } from "../comun/idioma.js";
import { coloresParaDaltonicos } from "../comun/ajustes.js";
import { irA } from "../navegacion.js";
import { estadoDe } from "./comun.js";
import { montarSilueta } from "./silueta.js";
import { montarPistas } from "./pistas.js";
import { montarEficaz } from "./eficaz.js";
import { montarMasOMenos } from "./masomenos.js";
import { montarLocke } from "./locke.js";
import { montarGrito } from "./grito.js";
import { montarEvolucion } from "./evolucion.js";
import { montarTipos } from "./tipos.js";
import { montarIntruso } from "./intruso.js";

const vista = document.getElementById("vista-juegos");
const cuerpo = vista.querySelector(".juegos-cuerpo");

const numero = (n) => n.toLocaleString(LOCALE);
const moneda = (n) => `<span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(n)}</span>`;

// Los retos, en el orden de la cartilla. «maximo»: los Pokédólares que da como mucho (sin la racha)
const JUEGOS = [
  { id: "silueta", nombre: t("¿Quién es ese Pokémon?"), icono: "lupa", maximo: 120, montar: montarSilueta },
  { id: "pistas", nombre: t("Adivínalo"), icono: "pokedex", maximo: 100, montar: montarPistas },
  { id: "eficaz", nombre: t("Supereficaz"), icono: "rayo", maximo: 100, montar: montarEficaz },
  { id: "masomenos", nombre: t("¿Más o menos?"), icono: "estadisticas", maximo: 100, montar: montarMasOMenos },
  { id: "grito", nombre: t("¿De quién es este grito?"), icono: "campana", maximo: 90, montar: montarGrito },
  { id: "evolucion", nombre: t("¿En qué evoluciona?"), icono: "intercambiar", maximo: 96, montar: montarEvolucion },
  { id: "tipos", nombre: t("¿De qué tipo es?"), icono: "etiqueta", maximo: 96, montar: montarTipos },
  { id: "intruso", nombre: t("El intruso"), icono: "cuadricula", maximo: 100, montar: montarIntruso },
  { id: "locke", nombre: t("Locke del día"), icono: "espadas", maximo: 120, montar: montarLocke }
];
let reto = null;

// ---------- La cartilla ----------

// Un día («2026-11-12») movido «cuantos» días
function moverDia(dia, cuantos) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cuantos);
  return fecha.toISOString().slice(0, 10);
}

// La semana de lunes a domingo: los días de la racha que llevas, hoy y los que quedan
function plantillaSemana(perfil) {
  const dia = hoy();
  const lunes = lunesDe(dia);
  const juegos = (perfil && perfil.juegos) || {};
  const racha = rachaDe(perfil);
  const jugados = new Set(Array.from({ length: racha }, (_, i) => moverDia(juegos.dia, -i)));
  const letras = [t("dia|L"), t("dia|M"), t("dia|X"), t("dia|J"), t("dia|V"), t("dia|S"), t("dia|D")];
  return letras
    .map((letra, i) => {
      const cada = moverDia(lunes, i);
      const clase = [jugados.has(cada) ? "jugado" : "", cada === dia ? "hoy" : ""].join(" ");
      return `<span class="semana-dia ${clase}"><span></span>${letra}</span>`;
    })
    .join("");
}

function plantillaReto(juego) {
  const estado = estadoDe(juego.id);
  const clase = [estado.fin ? "hecho" : "", juego.id === reto ? "activo" : ""].join(" ");
  let marca;
  let detalle;
  if (estado.fin) {
    marca = estado.fichas != null ? `+${estado.fichas}` : icono("visto");
    detalle = estado.fichas != null ? t("Hecho") : t("Jugado");
  } else {
    marca = icono(juego.icono);
    detalle = juego.id === reto
      ? t("Jugando")
      : `<span class="ficha-moneda"></span>${t("hasta {n}", { n: juego.maximo })}`;
  }
  return `
    <button class="reto-fila ${clase}" data-reto="${juego.id}" ${juego.id === reto ? 'aria-current="true"' : ""}>
      <span class="reto-marca">${marca}</span>
      <span class="reto-texto"><strong>${juego.nombre}</strong><small>${detalle}</small></span>
    </button>`;
}

function pintarCartilla() {
  const caja = cuerpo.querySelector(".retos-cartilla");
  if (!caja) return;
  const perfil = usuarioActual() ? miPerfil() : null;
  const hechos = JUEGOS.filter((juego) => estadoDe(juego.id).fin).length;
  const racha = perfil ? rachaDe(perfil) : 0;
  const bono = bonoRacha(racha + 1);
  const fecha = new Date(`${hoy()}T12:00:00Z`).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  caja.innerHTML = `
    <div class="cartilla-cabeza">
      <h2>${hechos === JUEGOS.length ? t("¡Todos hechos!") : t("Hoy, {n} de {total}", { n: hechos, total: JUEGOS.length })}</h2>
      <span class="juegos-nota">${escaparHTML(fecha)}</span>
    </div>
    ${perfil
      ? `<div class="cartilla-semana" aria-label="${t("Tu racha esta semana")}">${plantillaSemana(perfil)}</div>
         <p class="cartilla-racha ${racha ? "activa" : ""}">${icono("rayo")}<span>${racha
           ? `<b>${t(racha === 1 ? "{n} día seguido" : "{n} días seguidos", { n: racha })}</b> · ${t("+{n} en cada reto", { n: bono })}`
           : t("Juega hoy y mañana: la racha da Pokédólares extra")}</span></p>`
      : ""}
    <div class="cartilla-retos">${JUEGOS.map(plantillaReto).join("")}</div>
    <div class="cartilla-pie">
      <button class="juegos-compartir-enlace">${icono("copiar")} ${t("Copiar mis resultados de hoy")}</button>
      <span class="juegos-copiado" hidden>${t("¡Copiado! Pégalo donde quieras.")}</span>
    </div>`;
}

// ---------- El reto ----------

async function pintarReto() {
  const juego = JUEGOS.find((cada) => cada.id === reto);
  const caja = cuerpo.querySelector(".retos-juego");
  caja.innerHTML = `<article class="juego juego-${juego.id}"></article>`;
  try {
    await juego.montar(caja.querySelector(".juego"));
  } catch (error) {
    console.error(error);
    caja.querySelector(".juego").innerHTML = `<p class="juego-cargando">${t("No se han podido cargar los juegos. Comprueba la conexión y vuelve a entrar.")}</p>`;
  }
  pintarCartilla(); // por si ya estaba jugado en otro sitio
  pintarAmigosHoy();
}

function elegirReto(id) {
  if (id === reto) return;
  reto = id;
  pintarCartilla();
  pintarReto();
  // En el móvil el reto está debajo de la cartilla: se baja hasta él
  if (matchMedia("(max-width: 1000px)").matches) {
    cuerpo.querySelector(".retos-juego").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Lo de hoy, para pegar en un chat: una línea (o varias) por reto terminado
async function compartir() {
  const lineas = JUEGOS.map((juego) => estadoDe(juego.id).resumen).filter(Boolean);
  const aviso = cuerpo.querySelector(".juegos-copiado");
  if (!lineas.length) {
    await avisar(t("Termina algún reto primero."));
    return;
  }
  const fecha = new Date(`${hoy()}T12:00:00Z`).toLocaleDateString(LOCALE, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  const enlace = `${location.origin}${location.pathname}#juegos`;
  let texto = `NuzTheLocke · ${t("Reto del día")} ${fecha}\n\n${lineas.join("\n\n")}\n\n${enlace}`;
  // Con los colores para daltónicos, los cuadraditos también: azul y naranja
  if (coloresParaDaltonicos()) texto = texto.replaceAll("🟩", "🟦").replaceAll("🟥", "🟧");
  if (await copiarAlPortapapeles(texto)) {
    aviso.hidden = false;
    setTimeout(() => (aviso.hidden = true), 3000);
  }
}

// ---------- Clasificación ----------
//
// Tú y tus amigos, por los Pokédólares ganados en los retos: los de esta semana (de lunes a
// domingo) o los de siempre. Sale de los perfiles, que ya están cargados: no cuesta lecturas.

const MODOS = [
  { id: "semana", nombre: t("Esta semana"), cuenta: fichasDeLaSemana },
  { id: "general", nombre: t("Siempre"), cuenta: fichasDeJuegos }
];
let modo = "semana";

function amigosConPerfil() {
  return amigosAceptados().map((amistad) => perfilesDeAmigos().get(amistad.otro)).filter(Boolean);
}

// [{ perfil, fichas, puesto }] de más a menos (los empatados comparten puesto), o [] sin sesión
function ranking(cual = modo) {
  const yo = usuarioActual() ? miPerfil() : null;
  if (!yo) return [];
  const cuenta = MODOS.find((cada) => cada.id === cual).cuenta;
  const todos = [{ ...yo, mio: true }, ...amigosConPerfil()].sort(
    (uno, otro) => cuenta(otro) - cuenta(uno) || rachaDe(otro) - rachaDe(uno) || uno.nombre.localeCompare(otro.nombre, LOCALE)
  );
  let puesto = 0;
  let anterior = null;
  return todos.map((perfil, i) => {
    const fichas = cuenta(perfil);
    if (fichas !== anterior) puesto = i + 1;
    anterior = fichas;
    return { perfil, fichas, puesto };
  });
}

function fotoDeMuestra(perfil) {
  return perfil && perfil.foto
    ? `<img src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${escaparHTML(((perfil && perfil.nombre) || "?")[0].toUpperCase())}</span>`;
}

function plantillaFoto(perfil) {
  return `<span class="clasificacion-foto ${claseMarco(marcoDe(perfil))}" data-perfil="${escaparHTML(perfil.uid)}" title="${escaparHTML(perfil.nombre)}">${fotoDeMuestra(perfil)}</span>`;
}

function plantillaFilaRanking({ perfil, fichas, puesto }) {
  const racha = rachaDe(perfil);
  return `
    <li class="clasificacion-fila ${perfil.mio ? "mia" : ""} ${puesto <= 3 && fichas ? `podio-${puesto}` : ""}">
      <span class="clasificacion-puesto">${puesto}</span>
      ${plantillaFoto(perfil)}
      <span class="clasificacion-quien">
        <strong>${perfil.mio ? t("Tú") : escaparHTML(perfil.nombre)}</strong>
        <small>${racha > 1 ? `${icono("rayo")} ${t("{n} días", { n: racha })}` : ""}</small>
      </span>
      ${moneda(fichas)}
    </li>`;
}

function plantillaClasificacion() {
  const filas = ranking();
  if (!filas.length) {
    return `
      <section class="retos-caja">
        <h3>${t("Compite con tus amigos")}</h3>
        <p class="juegos-nota">${t("Con sesión, cada reto suma Pokédólares y entras en la clasificación semanal con tus amigos.")}</p>
      </section>`;
  }
  return `
    <section class="retos-caja">
      <div class="retos-caja-cabeza"><h3>${t("Clasificación")}</h3></div>
      <div class="segmentos-juegos" role="group" aria-label="${t("Qué Pokédólares contar")}">
        ${MODOS.map((cada) => `<button data-modo="${cada.id}" class="${cada.id === modo ? "activo" : ""}">${cada.nombre}</button>`).join("")}
      </div>
      <ol class="clasificacion-lista">${filas.map(plantillaFilaRanking).join("")}</ol>
    </section>`;
}

// ---------- Cómo les ha ido hoy a tus amigos en este reto ----------
//
// Su jugada de hoy (jugadas/{uid}_{juego}_{dia}; las reglas dejan leerlas de una en una). Siempre a la
// vista: solo dice cuántos Pokédólares sacó cada uno, no sus respuestas. Una fila por amigo desde el
// principio (con «…» mientras llega), para que la caja no cambie de alto al cargar ni al terminar.
// Lo que ya está se guarda mientras dure el día; lo que aún no, se vuelve a mirar como mucho cada
// RELEER (al hacer cada intento se repinta, y no hace falta leer cada vez).

const RELEER = 90 * 1000;
const jugadasDeAmigos = new Map(); // `${uid}_${juego}_${dia}` -> { datos: { puntos } | null, cuando }

async function leerJugadas(juego) {
  const acceso = baseDeDatos();
  if (!acceso) return;
  const { bd, fn } = acceso;
  const dia = hoy();
  await Promise.all(
    amigosConPerfil().map(async (perfil) => {
      const id = `${perfil.uid}_${juego}_${dia}`;
      // Lo que no estaba puede llegar más tarde: solo se guarda de una vez lo que ya existe
      const leida = jugadasDeAmigos.get(id);
      if (leida && (leida.datos || Date.now() - leida.cuando < RELEER)) return;
      try {
        const documento = await fn.getDoc(fn.doc(bd, "jugadas", id));
        jugadasDeAmigos.set(id, { datos: documento.exists() ? documento.data() : null, cuando: Date.now() });
      } catch (error) {
        jugadasDeAmigos.set(id, { datos: null, cuando: Date.now() });
      }
    })
  );
}

function plantillaAmigosHoy(juego) {
  const amigos = amigosConPerfil();
  let dentro;
  if (!amigos.length) dentro = `<p class="juegos-nota">${t("Cuando tengas amigos, aquí verás cómo les ha ido en este reto.")}</p>`;
  else {
    const dia = hoy();
    // Los que ya lo han hecho, de más a menos; luego los que aún no y los que se están mirando
    const valor = (jugada) => (jugada && jugada.datos ? jugada.datos.puntos : jugada ? -1 : -2);
    const filas = amigos
      .map((perfil) => ({ perfil, jugada: jugadasDeAmigos.get(`${perfil.uid}_${juego.id}_${dia}`) }))
      .sort((una, otra) => valor(otra.jugada) - valor(una.jugada) || una.perfil.nombre.localeCompare(otra.perfil.nombre, LOCALE));
    dentro = `<ul class="amigos-hoy">${filas.map(({ perfil, jugada }) => `
      <li>
        ${plantillaFoto(perfil)}
        <strong>${escaparHTML(perfil.nombre)}</strong>
        ${jugada && jugada.datos
          ? `<span class="amigos-hoy-puntos">+${numero(jugada.datos.puntos)}</span>`
          : `<span class="juegos-nota">${jugada ? t("aún no") : "…"}</span>`}
      </li>`).join("")}</ul>`;
  }
  return `
    <section class="retos-caja retos-caja-hoy">
      <h3>${t("Hoy, en este reto")}</h3>
      ${dentro}
    </section>`;
}

function pintarLado() {
  const caja = cuerpo.querySelector(".retos-lado");
  if (!caja) return;
  // Arriba del todo, el saldo que lleva a la Tienda (a lo ancho de la columna)
  caja.innerHTML = `<div class="juegos-arriba"></div>${plantillaClasificacion()}<div class="retos-hoy"></div>`;
  pintarArriba();
  pintarAmigosHoy();
}

let lecturaHoy = 0;

async function pintarAmigosHoy() {
  const caja = cuerpo.querySelector(".retos-hoy");
  if (!caja || !usuarioActual()) {
    if (caja) caja.innerHTML = "";
    return;
  }
  const juego = JUEGOS.find((cada) => cada.id === reto);
  const esta = ++lecturaHoy;
  caja.innerHTML = plantillaAmigosHoy(juego);
  if (!amigosConPerfil().length) return;
  await leerJugadas(juego.id);
  if (esta === lecturaHoy && caja.isConnected) caja.innerHTML = plantillaAmigosHoy(juego);
}

// ---------- Sección ----------

function pintarArriba() {
  const caja = cuerpo.querySelector(".juegos-arriba");
  if (!caja) return;
  const perfil = usuarioActual() ? miPerfil() : null;
  // Tu saldo, en un botón de los colores de la Tienda que lleva a ella (flechas que avanzan al pasar el ratón)
  caja.innerHTML = perfil
    ? `<button class="boton-ir juegos-ir-tienda" title="${t("Gástalos en la Tienda")}">
        ${moneda(saldo(perfil))}<span class="boton-ir-texto">${t("Tienda")}</span>${flechasIr()}
      </button>`
    : "";
}

function pintarTodo() {
  if (!reto) reto = (JUEGOS.find((juego) => !estadoDe(juego.id).fin) || JUEGOS[0]).id;
  cuerpo.innerHTML = `
    <div class="retos-cuerpo">
      <aside class="retos-cartilla" aria-label="${t("Los retos de hoy")}"></aside>
      <div class="retos-juego"></div>
      <aside class="retos-lado"></aside>
    </div>`;
  pintarCartilla();
  pintarLado();
  pintarReto();
}

export function iniciar() {
  cuerpo.addEventListener("click", (e) => {
    if (e.target.closest(".juegos-compartir-enlace")) {
      compartir().catch((error) => console.error(error));
    } else if (e.target.closest(".juegos-ir-tienda")) {
      irA("tienda");
    } else if (e.target.closest("[data-modo]")) {
      modo = e.target.closest("[data-modo]").dataset.modo;
      pintarLado();
    } else if (e.target.closest("[data-perfil]")) {
      const uid = e.target.closest("[data-perfil]").dataset.perfil;
      import("../perfil.js").then(({ abrirMiPerfil, abrirPerfilDe }) => {
        if (usuarioActual() && uid === usuarioActual().uid) abrirMiPerfil();
        else abrirPerfilDe(uid);
      });
    } else {
      const fila = e.target.closest("[data-reto]");
      if (fila) elegirReto(fila.dataset.reto);
    }
  });
  // «Volver a intentarlo» apuntó (o no) los Pokédólares de un reto: se vuelve a pintar
  document.addEventListener("reto-repintar", () => {
    if (!vista.hidden) pintarReto();
  });
  // Un reto terminado (o sus Pokédólares ya apuntados): la cartilla y lo de los amigos, al día
  document.addEventListener("reto-cambiado", () => {
    if (vista.hidden) return;
    pintarCartilla();
    pintarAmigosHoy();
  });

  // El saldo, la racha y la clasificación, al día; el reto no se repinta (se perdería lo escrito)
  alCambiarMiPerfil(() => {
    if (vista.hidden) return;
    pintarArriba();
    pintarCartilla();
    pintarLado();
  });
  alCambiarPerfilesAmigos(() => {
    if (!vista.hidden) pintarLado();
  });
  // Otra cuenta: otros retos jugados
  alCambiarSesion(() => {
    jugadasDeAmigos.clear();
    if (!vista.hidden) pintarTodo();
  });
}

export function mostrar() {
  pintarTodo();
}
