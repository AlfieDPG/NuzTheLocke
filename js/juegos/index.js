// Sección «Juegos»: los retos del día y la Tienda.
//
//   · Arriba, tus Pokédólares, tu racha (días seguidos jugando) y lo que suma la racha a cada reto.
//   · «Reto del día»: un reto de cada juego al día, el mismo para todo el mundo (js/juegos/
//     silueta.js, pistas.js, eficaz.js, masomenos.js y locke.js). Lo común, en js/juegos/comun.js. Abajo,
//     un botón copia los resultados de hoy (con cuadraditos de colores) para compartirlos.
//   · «Clasificación»: tú y tus amigos, por los Pokédólares ganados en los retos esta semana.
//   · «Tienda»: fondos para tu tarjeta, marcos para tu foto y títulos, a cambio de Pokédólares.
//     Lo comprado se pone y se quita desde aquí (los fondos y los títulos, también desde el perfil).
//
// Las Pokédólares (cómo se ganan y cómo se guardan) están en js/comun/fichas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual, alCambiarSesion, hayNube } from "../comun/nube.js";
import {
  miPerfil, alCambiarMiPerfil, guardarMiPerfil, amigosAceptados, perfilesDeAmigos, alCambiarPerfilesAmigos
} from "../comun/perfiles.js";
import { FONDOS_TIENDA, claseFondo, estiloFondo } from "../comun/fondos.js";
import {
  saldo, rachaDe, bonoRacha, fichasDeLogros, fichasDeJuegos, FICHAS_POR_NIVEL, MARCOS, TITULOS, loTiene, tieneMarco, porPrecio,
  marcoDe, claseMarco, claseTitulo, plantillaTituloDe, comprar, hoy, fichasDeLaSemana, jugoHoy
} from "../comun/fichas.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { NIVELES, LOGROS } from "../comun/logros.js";
import { copiarAlPortapapeles } from "../equipos/exportar.js";
import { t, LOCALE } from "../comun/idioma.js";
import { coloresParaDaltonicos } from "../comun/ajustes.js";
import { estadoDe } from "./comun.js";
import { montarSilueta } from "./silueta.js";
import { montarPistas } from "./pistas.js";
import { montarEficaz } from "./eficaz.js";
import { montarMasOMenos } from "./masomenos.js";
import { montarLocke } from "./locke.js";
import { montarGrito } from "./grito.js";
import { montarEvolucion } from "./evolucion.js";
import { montarColeccion } from "./coleccion.js";

const vista = document.getElementById("vista-juegos");
const pestanas = vista.querySelector(".juegos-pestanas");
const cabecera = vista.querySelector(".juegos-cabecera");
const cuerpo = vista.querySelector(".juegos-cuerpo");

const PESTANAS = [
  { id: "retos", nombre: t("Reto del día") },
  { id: "clasificacion", nombre: t("Clasificación") },
  { id: "coleccion", nombre: t("Colección") },
  { id: "tienda", nombre: t("Tienda") }
];
let pestana = "retos";
let ocupado = false;

const numero = (n) => n.toLocaleString(LOCALE);
const moneda = (n) => `<span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(n)}</span>`;

// ---------- Cabecera ----------

function pintarCabecera() {
  const perfil = miPerfil();
  if (!usuarioActual() || !perfil) {
    cabecera.innerHTML = `
      <div class="juegos-saldo">
        <span class="ficha-moneda grande"></span>
        <p>${hayNube() ? t("Inicia sesión para ganar Pokédólares con los retos y los logros, y gastarlos en la Tienda.") : ""}</p>
      </div>`;
    return;
  }
  const racha = rachaDe(perfil);
  const bono = bonoRacha(racha + 1);
  const hechos = JUEGOS.filter((juego) => estadoDe(juego.id).fin).length;
  const mia = ranking().find((fila) => fila.perfil.mio);
  cabecera.innerHTML = `
    <div class="juegos-saldo">
      <span class="ficha-moneda grande"></span>
      <div>
        <strong>${numero(saldo(perfil))}</strong> <span>${t("Pokédólares")}</span>
        <small>${t("{logros} de logros · {juegos} de retos", { logros: numero(fichasDeLogros(perfil)), juegos: numero(fichasDeJuegos(perfil)) })}</small>
      </div>
    </div>
    <div class="juegos-racha ${racha ? "activa" : ""}">
      ${icono("rayo")}
      <div>
        <strong>${t(racha === 1 ? "{n} día seguido" : "{n} días seguidos", { n: racha })}</strong>
        <small>${bono ? t("Hoy, +{n} Pokédólares extra por reto", { n: bono }) : t("Juega mañana también: la racha da Pokédólares extra")}</small>
      </div>
    </div>
    <div class="juegos-racha ${hechos === JUEGOS.length ? "activa" : ""}">
      ${icono("calendario")}
      <div>
        <strong>${t("{n} de {total} retos hoy", { n: hechos, total: JUEGOS.length })}</strong>
        <small>${hechos === JUEGOS.length ? t("¡Todos hechos! Vuelve mañana.") : t("Te quedan {n}", { n: JUEGOS.length - hechos })}</small>
      </div>
    </div>
    <div class="juegos-racha ${mia && mia.fichas ? "activa" : ""}">
      ${icono("trofeo")}
      <div>
        <strong>${t("{n} Pokédólares esta semana", { n: numero(mia ? mia.fichas : 0) })}</strong>
        <small>${mia && ranking().length > 1 ? t("{puesto}.º de {n} con tus amigos", { puesto: mia.puesto, n: ranking().length }) : t("Se reinicia cada lunes")}</small>
      </div>
    </div>`;
}

// ---------- Retos ----------

// Arriba, una tarjeta pequeña por reto (con lo que llevas hoy en cada uno); debajo, solo el
// elegido. Al entrar se abre el primero que te quede por jugar.
const JUEGOS = [
  { id: "silueta", nombre: t("¿Quién es ese Pokémon?"), icono: "lupa", maximo: 45, montar: montarSilueta },
  { id: "pistas", nombre: t("Adivínalo"), icono: "pokedex", maximo: 50, montar: montarPistas },
  { id: "eficaz", nombre: t("Supereficaz"), icono: "rayo", maximo: 50, montar: montarEficaz },
  { id: "masomenos", nombre: t("¿Más o menos?"), icono: "estadisticas", maximo: 50, montar: montarMasOMenos },
  { id: "grito", nombre: t("¿De quién es este grito?"), icono: "campana", maximo: 45, montar: montarGrito },
  { id: "evolucion", nombre: t("¿En qué evoluciona?"), icono: "intercambiar", maximo: 48, montar: montarEvolucion },
  { id: "locke", nombre: t("Locke del día"), icono: "espadas", maximo: 60, montar: montarLocke }
];
let reto = null;

function plantillaTarjetaReto(juego) {
  const estado = estadoDe(juego.id);
  let pie;
  if (!estado.fin) pie = `<small title="${t("Hasta {n} Pokédólares", { n: juego.maximo })}"><span class="ficha-moneda"></span>${t("hasta {n}", { n: juego.maximo })}</small>`;
  else if (estado.fichas != null) pie = `<small class="hecho">${icono("visto")} +${estado.fichas}</small>`;
  else pie = `<small class="hecho">${icono("visto")} ${t("Jugado")}</small>`;
  return `
    <button class="reto-tarjeta ${juego.id === reto ? "activa" : ""} ${estado.fin ? "terminado" : ""}" data-reto="${juego.id}">
      ${icono(juego.icono)}
      <span>
        <strong>${juego.nombre}</strong>
        ${pie}
      </span>
    </button>`;
}

function pintarTarjetasRetos() {
  const fila = cuerpo.querySelector(".retos-fila");
  if (fila) fila.innerHTML = JUEGOS.map(plantillaTarjetaReto).join("");
}

async function pintarRetos() {
  if (!reto) reto = (JUEGOS.find((juego) => !estadoDe(juego.id).fin) || JUEGOS[0]).id;
  const juego = JUEGOS.find((cada) => cada.id === reto);
  cuerpo.innerHTML = `
    <div class="retos-fila"></div>
    <div class="retos-cuerpo">
      <article class="juego juego-${juego.id}"></article>
      ${plantillaColumnaRetos()}
    </div>`;
  pintarTarjetasRetos();
  try {
    await juego.montar(cuerpo.querySelector(".juego"));
  } catch (error) {
    console.error(error);
    cuerpo.querySelector(".juego").innerHTML = `<p class="juego-cargando">${t("No se han podido cargar los juegos. Comprueba la conexión y vuelve a entrar.")}</p>`;
  }
  pintarTarjetasRetos(); // por si ya estaba jugado en otro sitio
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
// domingo) o los de siempre («General»), con pestañas. Sale de los perfiles, que ya están
// cargados: no cuesta lecturas.

const MODOS = [
  { id: "semana", nombre: t("Esta semana"), cuenta: fichasDeLaSemana },
  { id: "general", nombre: t("General"), cuenta: fichasDeJuegos }
];
let modo = "semana";

// [{ perfil, fichas, puesto }] de más a menos (los empatados comparten puesto), o [] sin sesión
function ranking(cual = "semana") {
  const yo = usuarioActual() ? miPerfil() : null;
  if (!yo) return [];
  const cuenta = MODOS.find((cada) => cada.id === cual).cuenta;
  const amigos = amigosAceptados().map((amistad) => perfilesDeAmigos().get(amistad.otro)).filter(Boolean);
  const todos = [{ ...yo, mio: true }, ...amigos].sort(
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

function plantillaFilaRanking({ perfil, fichas, puesto }, corta = false) {
  const racha = rachaDe(perfil);
  return `
    <li class="clasificacion-fila ${perfil.mio ? "mia" : ""} ${puesto <= 3 && fichas ? `podio-${puesto}` : ""}">
      <span class="clasificacion-puesto">${puesto}</span>
      <span class="clasificacion-foto ${claseMarco(marcoDe(perfil))}" data-perfil="${escaparHTML(perfil.uid)}">${fotoDeMuestra(perfil)}</span>
      <span class="clasificacion-quien">
        <span class="clasificacion-nombre"><strong>${escaparHTML(perfil.nombre)}</strong>${corta ? "" : plantillaTituloDe(perfil, "pequeno")}</span>
        ${corta
          ? ""
          : `<small>
              ${jugoHoy(perfil) ? `<span class="clasificacion-hoy">${icono("visto")} ${t("Ha jugado hoy")}</span>` : t("Hoy aún no ha jugado")}
              ${racha > 1 ? ` · ${icono("rayo")} ${t("{n} días seguidos", { n: racha })}` : ""}
            </small>`}
      </span>
      ${moneda(fichas)}
    </li>`;
}

// Lo de cada día al lado del reto: los primeros de la semana y tú (si no estás entre ellos)
const EN_LA_COLUMNA = 5;

function plantillaColumnaRetos() {
  const filas = ranking();
  const nota = `<p class="juegos-nota">${t("Los retos cambian cada día a medianoche (hora de España) y son los mismos para todo el mundo.")}</p>`;
  const copiar = `
    <button class="juegos-compartir-enlace">${icono("copiar")} ${t("Copiar mis resultados de hoy")}</button>
    <span class="juegos-copiado" hidden>${t("¡Copiado! Pégalo donde quieras.")}</span>`;
  if (!filas.length) {
    return `
      <aside class="juegos-pie">
        <h3>${t("Compite con tus amigos")}</h3>
        <p class="juegos-nota">${t("Con sesión, cada reto suma Pokédólares y entras en la clasificación semanal con tus amigos.")}</p>
        ${nota}
        ${copiar}
      </aside>`;
  }
  const primeros = filas.slice(0, EN_LA_COLUMNA);
  const mia = filas.find((fila) => fila.perfil.mio);
  const visibles = primeros.includes(mia) ? primeros : [...primeros.slice(0, EN_LA_COLUMNA - 1), mia];
  return `
    <aside class="juegos-pie">
      <h3>${t("Esta semana")}</h3>
      <ol class="clasificacion-lista corta">${visibles.map((fila) => plantillaFilaRanking(fila, true)).join("")}</ol>
      <button class="juegos-ver-clasificacion">${t("Ver la clasificación")}</button>
      ${nota}
      ${copiar}
    </aside>`;
}

// Arriba las pestañas (como los filtros de «Logros») y la explicación; debajo, a la misma altura,
// la lista y el resumen tuyo
function pintarClasificacion() {
  const filas = ranking(modo);
  if (!filas.length) {
    cuerpo.innerHTML = `<p class="juegos-nota">${t("Inicia sesión para competir con tus amigos.")}</p>`;
    return;
  }
  const semanal = modo === "semana";
  const mia = filas.find((fila) => fila.perfil.mio);
  const amigos = filas.length - 1;
  cuerpo.innerHTML = `
    <div class="selector-regiones logros-filtro clasificacion-filtro">
      ${MODOS.map((cada) => `<button data-modo="${cada.id}" class="${cada.id === modo ? "activa" : ""}">${cada.nombre}</button>`).join("")}
    </div>
    <p class="tienda-explicacion">${semanal
      ? t("Los Pokédólares ganados en los retos desde el lunes (los de los logros no cuentan). Se reinicia cada lunes.")
      : t("Los Pokédólares ganados en los retos desde que empezaste (los de los logros no cuentan).")}</p>
    <div class="clasificacion-cuerpo">
      <section class="clasificacion">
        <ol class="clasificacion-lista">${filas.map((fila) => plantillaFilaRanking(fila)).join("")}</ol>
        ${amigos ? "" : `<p class="juegos-nota">${t("Añade amigos en «Amigos» para competir con ellos.")}</p>`}
      </section>
      <aside class="juegos-pie clasificacion-tuya">
        <h3>${semanal ? t("Tu semana") : t("Tu clasificación")}</h3>
        <div class="clasificacion-dato"><span>${t("clasificacion|Puesto")}</span><strong>${mia.puesto}.º</strong><small>${t("de {n}", { n: filas.length })}</small></div>
        <div class="clasificacion-dato"><span>${semanal ? t("Pokédólares de la semana") : t("Pokédólares en total")}</span>${moneda(mia.fichas)}</div>
        <div class="clasificacion-dato"><span>${t("Racha")}</span><strong>${t(rachaDe(mia.perfil) === 1 ? "{n} día seguido" : "{n} días seguidos", { n: rachaDe(mia.perfil) })}</strong></div>
        <p class="juegos-nota">${t("Cada reto da Pokédólares según lo bien que te salga, y la racha suma hasta 20 más por reto. Pulsa la foto de alguien para ver su perfil.")}</p>
      </aside>
    </div>`;
}

// ---------- Tienda ----------

const TIPOS_ARTICULO = {
  fondo: { campo: "fondo", quitar: "" },
  marco: { campo: "marco", quitar: "" },
  titulo: { campo: "titulo", quitar: null }
};

// Los marcos de metal no se compran: salen con su logro (y si no lo tienes, lo que pide)
function plantillaArticulo(articulo, tipo, muestra, perfil) {
  const tuyo = tipo === "marco" ? tieneMarco(perfil, articulo) : loTiene(perfil, articulo.id);
  const puesto = tuyo && perfil && perfil[TIPOS_ARTICULO[tipo].campo] === articulo.id;
  const llega = saldo(perfil) >= articulo.precio;
  const logro = articulo.logro && LOGROS.find((cada) => cada.id === articulo.logro);
  let accion;
  if (!tuyo && logro) {
    accion = `<small class="tienda-logro" title="${escaparHTML(logro.descripcion)}">${icono("trofeo")} ${t("Logro «{nombre}»", { nombre: escaparHTML(logro.nombre) })}</small>`;
  } else if (!tuyo) {
    accion = `<button class="tienda-comprar" data-comprar="${articulo.id}" ${perfil && llega ? "" : "disabled"}
                      title="${llega ? t("Comprar") : t("Te faltan {n} Pokédólares", { n: numero(articulo.precio - saldo(perfil)) })}">
                ${moneda(articulo.precio)}
              </button>`;
  } else if (puesto) {
    accion = `<button class="tienda-quitar" data-quitar="${articulo.id}" data-tipo="${tipo}">${icono("visto")} ${t("Puesto")}</button>`;
  } else {
    accion = `<button class="tienda-poner" data-poner="${articulo.id}" data-tipo="${tipo}">${t("Ponérmelo")}</button>`;
  }
  // Los títulos, en una fila: la plaquita tal cual se ve (con su color y su efecto) y a la
  // derecha el precio o el botón; sin repetir el nombre
  if (tipo === "titulo") {
    return `
      <article class="tienda-titulo-fila ${tuyo ? "tuyo" : ""} ${puesto ? "puesto" : ""}">
        ${muestra}
        ${accion}
      </article>`;
  }
  return `
    <article class="tienda-articulo ${tuyo ? "tuyo" : ""} ${puesto ? "puesto" : ""}">
      ${muestra}
      <strong>${escaparHTML(articulo.nombre)}</strong>
      ${accion}
    </article>`;
}

function fotoDeMuestra(perfil) {
  return perfil && perfil.foto
    ? `<img src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${escaparHTML(((perfil && perfil.nombre) || "?")[0].toUpperCase())}</span>`;
}

function pintarTienda() {
  const perfil = usuarioActual() ? miPerfil() : null;
  const apartado = (titulo, explicacion, articulos, clase = "tienda-rejilla") => `
    <section class="tienda-apartado">
      <h2>${titulo}</h2>
      <p class="tienda-explicacion">${explicacion}</p>
      <div class="${clase}">${articulos}</div>
    </section>`;

  const fondos = porPrecio(FONDOS_TIENDA).map((fondo) =>
    plantillaArticulo(fondo, "fondo", `<span class="tienda-muestra ${claseFondo(fondo.id)}" style="${estiloFondo(fondo.id)}"></span>`, perfil)
  ).join("");
  const marcos = porPrecio(MARCOS).map((marco) =>
    plantillaArticulo(marco, "marco", `<span class="tienda-muestra tienda-muestra-marco"><span class="tienda-foto ${claseMarco(marco.id)}">${fotoDeMuestra(perfil)}</span></span>`, perfil)
  ).join("");
  const titulos = porPrecio(TITULOS).map((titulo) =>
    plantillaArticulo(titulo, "titulo", `<span class="perfil-titulo ${claseTitulo(titulo)}">${escaparHTML(titulo.nombre)}</span>`, perfil)
  ).join("");

  const niveles = Object.entries(FICHAS_POR_NIVEL).map(([nivel, fichas]) => `${NIVELES[nivel]} ${fichas}`).join(" · ");

  cuerpo.innerHTML = `
    <button class="tienda-ir-coleccion">
      <span class="huevo-dibujo"></span>
      <span><strong>${t("Huevos Pokémon")}</strong><small>${t("Completa la Pokédex en «Colección»: cada huevo trae un Pokémon al azar.")}</small></span>
      ${icono("mas")}
    </button>
    <aside class="tienda-como">
      <h2>${t("Cómo se ganan Pokédólares")}</h2>
      <ul>
        <li>${t("Con cada logro, según su nivel: {niveles}. También los que ya tenías.", { niveles })}</li>
        <li>${t("Con los retos del día, como mucho: {lista}.", { lista: JUEGOS.map((juego) => `${juego.maximo} en «${juego.nombre}»`).join(", ") })}</li>
        <li>${t("Con la racha: 2 más por reto por cada día seguido jugando, hasta 20.")}</li>
      </ul>
      ${perfil ? "" : `<p>${t("Inicia sesión para comprar.")}</p>`}
    </aside>
    ${apartado(t("Fondos"), t("Para tu tarjeta de «Amigos» y la cabecera de tu perfil."), fondos)}
    ${apartado(t("Marcos"), t("Alrededor de tu foto, en tu perfil y en «Amigos». Los de plata, oro y platino no se compran: vienen con los logros de 25, 50 y todos los logros."), marcos)}
    ${apartado(t("Títulos"), t("Una plaquita debajo de tu nombre, en tu perfil."), titulos, "tienda-titulos")}`;
}

async function alPulsarTienda(e) {
  const boton = e.target.closest("[data-comprar], [data-poner], [data-quitar]");
  if (!boton || ocupado) return;
  ocupado = true;
  try {
    if (boton.dataset.comprar) {
      const articulo = [...FONDOS_TIENDA, ...MARCOS, ...TITULOS].find((cada) => cada.id === boton.dataset.comprar);
      const vale = await confirmar(t("¿Comprar «{nombre}» por {n} Pokédólares?", { nombre: articulo.nombre, n: numero(articulo.precio) }), { aceptar: t("Comprar") });
      if (!vale) return;
      const fallo = await comprar(articulo.id);
      if (fallo) await avisar(fallo);
    } else if (boton.dataset.poner) {
      await guardarMiPerfil({ [TIPOS_ARTICULO[boton.dataset.tipo].campo]: boton.dataset.poner });
    } else {
      const tipo = TIPOS_ARTICULO[boton.dataset.tipo];
      await guardarMiPerfil({ [tipo.campo]: tipo.quitar });
    }
  } catch (error) {
    console.error(error);
    await avisar(t("No se ha podido guardar. Prueba otra vez."));
  } finally {
    ocupado = false;
  }
}

// ---------- Sección ----------

function pintarPestanas() {
  pestanas.innerHTML = PESTANAS.map(
    (cada) => `<button data-pestana="${cada.id}" class="${cada.id === pestana ? "activa" : ""}">${cada.nombre}</button>`
  ).join("");
}

// La colección y sus huevos (js/juegos/coleccion.js)
function pintarColeccion() {
  cuerpo.innerHTML = `<div class="coleccion"></div>`;
  montarColeccion(cuerpo.querySelector(".coleccion")).catch((error) => {
    console.error(error);
    cuerpo.innerHTML = `<p class="juego-cargando">${t("No se han podido cargar los juegos. Comprueba la conexión y vuelve a entrar.")}</p>`;
  });
}

function pintarTodo() {
  pintarPestanas();
  pintarCabecera();
  if (pestana === "retos") pintarRetos();
  else if (pestana === "clasificacion") pintarClasificacion();
  else if (pestana === "coleccion") pintarColeccion();
  else pintarTienda();
}

export function iniciar() {
  pestanas.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-pestana]");
    if (!boton || boton.dataset.pestana === pestana) return;
    pestana = boton.dataset.pestana;
    pintarTodo();
  });
  cuerpo.addEventListener("click", (e) => {
    if (e.target.closest(".tienda-ir-coleccion")) {
      pestana = "coleccion";
      pintarTodo();
    } else if (pestana === "tienda") alPulsarTienda(e);
    else if (e.target.closest(".juegos-compartir-enlace")) compartir().catch((error) => console.error(error));
    else if (e.target.closest("[data-modo]")) {
      modo = e.target.closest("[data-modo]").dataset.modo;
      pintarClasificacion();
    } else if (e.target.closest(".juegos-ver-clasificacion")) {
      pestana = "clasificacion";
      pintarTodo();
    } else {
      const tarjeta = e.target.closest("[data-reto]");
      if (tarjeta && tarjeta.dataset.reto !== reto) {
        reto = tarjeta.dataset.reto;
        pintarRetos();
      }
    }
  });
  // «Volver a intentarlo» apuntó (o no) los Pokédólares de un reto: se vuelve a pintar
  document.addEventListener("reto-repintar", () => {
    if (!vista.hidden && pestana === "retos") pintarRetos();
  });
  // Un reto terminado (o sus Pokédólares ya apuntados): su tarjeta de arriba, al día
  document.addEventListener("reto-cambiado", () => {
    if (vista.hidden || pestana !== "retos") return;
    pintarTarjetasRetos();
    pintarCabecera();
  });

  // El saldo, la Tienda y la clasificación, al día; los retos no se repintan (se perdería lo escrito)
  alCambiarMiPerfil(() => {
    if (vista.hidden) return;
    pintarCabecera();
    if (pestana === "tienda") pintarTienda();
    if (pestana === "clasificacion") pintarClasificacion();
  });
  alCambiarPerfilesAmigos(() => {
    if (!vista.hidden && pestana === "clasificacion") pintarClasificacion();
  });
  // Otra cuenta: otros retos jugados
  alCambiarSesion(() => {
    if (!vista.hidden) pintarTodo();
  });
}

export function mostrar() {
  pintarTodo();
}
