// Sección «Tienda»: en qué se gastan los Pokédólares.
//
//   · Arriba, las pestañas (Fondos, Marcos, Títulos y Huevos: todo se compra con Pokédólares) y tu
//     saldo, con la «i» que explica de dónde sale cada Pokédólar.
//   · A la derecha, «Así te ven»: tu ficha con el fondo, el marco y el título que llevas. Al pasar
//     el ratón (o el dedo) por un artículo, la ficha se lo prueba, aunque no lo tengas.
//   · «Huevos»: la colección de js/juegos/coleccion.js (antes era una pestaña de «Juegos»).
//
// Los Pokédólares (cómo se ganan, cómo se guardan, comprar) están en js/comun/fichas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML, flechasIr } from "../comun/utilidades.js";
import { usuarioActual, alCambiarSesion, hayNube } from "../comun/nube.js";
import { miPerfil, alCambiarMiPerfil, guardarMiPerfil } from "../comun/perfiles.js";
import { FONDOS, FONDOS_TIENDA, claseFondo, estiloFondo, fondoDe } from "../comun/fondos.js";
import {
  saldo, fichasDeLogros, fichasDeJuegos, fichasDeLockes, PREMIOS_LOCKE, BONO_MAX, FICHAS_POR_NIVEL, MARCOS, TITULOS,
  loTiene, tieneMarco, porPrecio, marcoDe, claseMarco, claseTitulo, tituloDe, comprar
} from "../comun/fichas.js";
import { fichasDeRegalos } from "../comun/regalos.js";
import { NIVELES } from "../comun/logros.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { t, LOCALE } from "../comun/idioma.js";
import { irA } from "../navegacion.js";

const vista = document.getElementById("vista-tienda");
const pestanas = vista.querySelector(".tienda-pestanas");
const saldoCaja = vista.querySelector(".tienda-saldo");
const cuerpo = vista.querySelector(".tienda-cuerpo");

const PESTANAS = [
  { id: "fondos", nombre: t("Fondos") },
  { id: "marcos", nombre: t("Marcos") },
  { id: "titulos", nombre: t("Títulos") },
  { id: "huevos", nombre: t("Huevos") }
];
let pestana = "fondos";
let ocupado = false;
let probando = null; // { tipo: "fondo" | "marco" | "titulo", id }: lo que «Así te ven» se prueba

const numero = (n) => n.toLocaleString(LOCALE);
const moneda = (n) => `<span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(n)}</span>`;

// ---------- Saldo ----------

// De dónde salen los tuyos: [[de qué, cuántos]] (solo lo que no es cero)
function desglose(perfil) {
  return [
    [t("logros"), fichasDeLogros(perfil)],
    [t("retos"), fichasDeJuegos(perfil)],
    [t("lockes"), fichasDeLockes(perfil)],
    [t("regalos"), fichasDeRegalos()]
  ].filter(([, cuanto]) => cuanto > 0);
}

function comoSeGanan() {
  const niveles = Object.entries(FICHAS_POR_NIVEL).map(([nivel, fichas]) => `${NIVELES[nivel]} ${fichas}`).join(" · ");
  const perfil = usuarioActual() ? miPerfil() : null;
  const tuyos = perfil ? desglose(perfil) : [];
  return [
    ...(tuyos.length ? [t("Los tuyos: {lista}.", { lista: tuyos.map(([de, cuanto]) => `${numero(cuanto)} ${de}`).join(" · ") })] : []),
    t("Cómo se ganan Pokédólares"),
    t("Con cada logro, según su nivel: {niveles}. También los que ya tenías.", { niveles }),
    t("Con los retos del día de «Juegos», según lo bien que te salgan, y con la racha: hasta {max} más por reto.", { max: BONO_MAX }),
    t("Terminando lockes con amigos en «Lockes»: el ganador {a}, el segundo {b}, el tercero {c} y el resto {d}. Si nadie gana, {d} cada uno.", {
      a: PREMIOS_LOCKE[1], b: PREMIOS_LOCKE[2], c: PREMIOS_LOCKE[3], d: PREMIOS_LOCKE.resto
    })
  ].join("\n\n");
}

// El saldo va arriba de «Así te ven» (plantillaAsiTeVen); el hueco de antes, junto a las pestañas, vacío
function pintarSaldo() {
  saldoCaja.innerHTML = "";
}

// El saldo, a lo ancho de la columna de «Así te ven», con los colores de la Tienda; de dónde sale cada
// Pokédólar, en la «i»
function plantillaSaldo(perfil) {
  return `
    <div class="boton-ir tienda-saldo-cifra">
      <span class="ficha-moneda"></span>
      <strong>${numero(saldo(perfil))}</strong>
      <small class="boton-ir-texto">${t("Pokédólares")}</small>
      <button class="juegos-info" aria-label="${t("De dónde salen tus Pokédólares")}" title="${t("De dónde salen tus Pokédólares")}">i</button>
    </div>`;
}

// ---------- Artículos ----------

const TIPOS_ARTICULO = {
  fondo: { campo: "fondo", quitar: "" },
  marco: { campo: "marco", quitar: "" },
  titulo: { campo: "titulo", quitar: null }
};

export function fotoDeMuestra(perfil) {
  return perfil && perfil.foto
    ? `<img src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${escaparHTML(((perfil && perfil.nombre) || "?")[0].toUpperCase())}</span>`;
}

function plantillaArticulo(articulo, tipo, muestra, perfil) {
  const tuyo = tipo === "marco" ? tieneMarco(perfil, articulo) : loTiene(perfil, articulo.id);
  const puesto = tuyo && perfil && perfil[TIPOS_ARTICULO[tipo].campo] === articulo.id;
  const llega = saldo(perfil) >= articulo.precio;
  let accion;
  if (!tuyo) {
    accion = `<button class="tienda-comprar" data-comprar="${articulo.id}" ${perfil && llega ? "" : "disabled"}
                      title="${llega ? t("Comprar") : t("Te faltan {n} Pokédólares", { n: numero(articulo.precio - saldo(perfil)) })}">
                ${moneda(articulo.precio)}
              </button>`;
  } else if (puesto) {
    accion = `<button class="tienda-quitar" data-quitar="${articulo.id}" data-tipo="${tipo}">${icono("visto")} ${t("Puesto")}</button>`;
  } else {
    accion = `<button class="tienda-poner" data-poner="${articulo.id}" data-tipo="${tipo}">${t("Ponérmelo")}</button>`;
  }
  const probar = `data-probar="${articulo.id}" data-probar-tipo="${tipo}"`;
  // Los títulos, en una fila: la plaquita tal cual se ve y a la derecha el precio o el botón
  if (tipo === "titulo") {
    return `
      <article class="tienda-titulo-fila ${tuyo ? "tuyo" : ""} ${puesto ? "puesto" : ""}" ${probar}>
        ${muestra}
        ${accion}
      </article>`;
  }
  return `
    <article class="tienda-articulo ${tuyo ? "tuyo" : ""} ${puesto ? "puesto" : ""}" ${probar}>
      ${muestra}
      <strong>${escaparHTML(articulo.nombre)}</strong>
      ${accion}
    </article>`;
}

function plantillaArticulos(perfil) {
  if (pestana === "fondos") {
    return `
      <div class="tienda-rejilla">${porPrecio(FONDOS_TIENDA).map((fondo) =>
        plantillaArticulo(fondo, "fondo", `<span class="tienda-muestra ${claseFondo(fondo.id)}" style="${estiloFondo(fondo.id)}"></span>`, perfil)).join("")}</div>`;
  }
  if (pestana === "marcos") {
    // Solo los que se compran: los de metal (plata, oro y platino) vienen con sus logros
    return `
      <div class="tienda-rejilla">${porPrecio(MARCOS.filter((marco) => marco.precio)).map((marco) =>
        plantillaArticulo(marco, "marco", `<span class="tienda-muestra tienda-muestra-marco"><span class="tienda-foto ${claseMarco(marco.id)}">${fotoDeMuestra(perfil)}</span></span>`, perfil)).join("")}</div>`;
  }
  return `
    <div class="tienda-titulos">${porPrecio(TITULOS).map((titulo) =>
      plantillaArticulo(titulo, "titulo", `<span class="perfil-titulo ${claseTitulo(titulo)}">${escaparHTML(titulo.nombre)}</span>`, perfil)).join("")}</div>`;
}

// ---------- Así te ven ----------

function nombreDeFondo(id) {
  const fondo = FONDOS.find((cada) => cada.id === id);
  return fondo ? fondo.nombre : t("Ninguno");
}

function nombreDeMarco(id) {
  const marco = MARCOS.find((cada) => cada.id === id);
  return marco ? marco.nombre : t("Ninguno");
}

function plantillaAsiTeVen(perfil) {
  if (!perfil) return "";
  const fondo = probando && probando.tipo === "fondo" ? probando.id : fondoDe(perfil);
  const marco = probando && probando.tipo === "marco" ? probando.id : marcoDe(perfil);
  const titulo = probando && probando.tipo === "titulo" ? TITULOS.find((cada) => cada.id === probando.id) : tituloDe(perfil);
  const placa = titulo ? `<span class="perfil-titulo ${claseTitulo(titulo)} pequeno">${escaparHTML(titulo.nombre)}</span>` : "";
  return `
    ${plantillaSaldo(perfil)}
    <h3>${probando ? t("Probándotelo") : t("Así te ven")}</h3>
    <div class="tienda-ficha ${fondo ? `lleva-fondo ${claseFondo(fondo)}` : ""}" style="${fondo ? estiloFondo(fondo) : ""}">
      <span class="tienda-foto ${claseMarco(marco)}">${fotoDeMuestra(perfil)}</span>
      <span class="tienda-ficha-datos"><strong>${escaparHTML(perfil.nombre || t("Jugador"))}</strong>${placa}</span>
    </div>
    <dl class="tienda-llevas">
      <div><dt>${t("Fondo")}</dt><dd>${escaparHTML(nombreDeFondo(fondoDe(perfil)))}</dd></div>
      <div><dt>${t("Marco")}</dt><dd>${escaparHTML(nombreDeMarco(marcoDe(perfil)))}</dd></div>
      <div><dt>${t("Título")}</dt><dd>${escaparHTML(tituloDe(perfil) ? tituloDe(perfil).nombre : t("Ninguno"))}</dd></div>
    </dl>
    <button class="boton-ir de-juegos tienda-ir-juegos">${icono("mando")}<span class="boton-ir-texto">${t("Gana más en Juegos")}</span>${flechasIr()}</button>`;
}

function pintarAsiTeVen() {
  const caja = cuerpo.querySelector(".tienda-asi");
  if (caja) caja.innerHTML = plantillaAsiTeVen(usuarioActual() ? miPerfil() : null);
}

// ---------- Pintar ----------

function pintarPestanas() {
  pestanas.innerHTML = PESTANAS.map(
    (cada) => `<button data-pestana="${cada.id}" class="${cada.id === pestana ? "activa" : ""}">${cada.nombre}</button>`
  ).join("");
}

function pintarCuerpo() {
  const perfil = usuarioActual() ? miPerfil() : null;
  probando = null;
  if (pestana === "huevos") {
    cuerpo.innerHTML = `<div class="tienda-principal"><div class="coleccion"></div></div>${perfil ? `<aside class="tienda-asi"></aside>` : ""}`;
    import("../juegos/coleccion.js")
      .then(({ montarColeccion }) => montarColeccion(cuerpo.querySelector(".coleccion")))
      .catch((error) => {
        console.error(error);
        cuerpo.querySelector(".tienda-principal").innerHTML = `<p class="juego-cargando">${t("No se ha podido cargar la colección. Comprueba la conexión y vuelve a entrar.")}</p>`;
      });
  } else {
    cuerpo.innerHTML = `
      <div class="tienda-principal">
        ${perfil ? "" : `<p class="juegos-nota">${hayNube() ? t("Inicia sesión para comprar.") : ""}</p>`}
        ${plantillaArticulos(perfil)}
      </div>
      ${perfil ? `<aside class="tienda-asi"></aside>` : ""}`;
  }
  pintarAsiTeVen();
}

function pintarTodo() {
  pintarPestanas();
  pintarSaldo();
  pintarCuerpo();
}

// La lista sin repintar entera (se perdería dónde estabas): solo los botones de comprar/poner
function repintarArticulos() {
  if (pestana === "huevos") return;
  const principal = cuerpo.querySelector(".tienda-principal");
  if (!principal) return pintarCuerpo();
  const arriba = window.scrollY;
  principal.innerHTML = plantillaArticulos(miPerfil());
  window.scrollTo(0, arriba);
}

async function alPulsar(e) {
  if (e.target.closest(".juegos-info:not(.coleccion-info)")) {
    avisar(comoSeGanan());
    return;
  }
  if (e.target.closest(".tienda-ir-juegos")) {
    irA("juegos");
    return;
  }
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

// Probarse lo que hay bajo el ratón (o lo último que se ha tocado en una pantalla táctil)
function alPasar(e) {
  const articulo = e.target.closest("[data-probar]");
  const nuevo = articulo ? { tipo: articulo.dataset.probarTipo, id: articulo.dataset.probar } : null;
  if (JSON.stringify(nuevo) === JSON.stringify(probando)) return;
  probando = nuevo;
  pintarAsiTeVen();
}

export function iniciar() {
  saldoCaja.addEventListener("click", (e) => {
    if (e.target.closest(".juegos-info")) avisar(comoSeGanan());
  });
  pestanas.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-pestana]");
    if (!boton || boton.dataset.pestana === pestana) return;
    pestana = boton.dataset.pestana;
    pintarPestanas();
    pintarCuerpo();
  });
  cuerpo.addEventListener("click", alPulsar);
  cuerpo.addEventListener("pointerover", alPasar);
  cuerpo.addEventListener("pointerleave", () => {
    if (!probando) return;
    probando = null;
    pintarAsiTeVen();
  });

  alCambiarMiPerfil(() => {
    if (vista.hidden) return;
    // El perfil ha llegado después de pintar (al entrar directo en la Tienda): falta la columna de
    // «Así te ven» (y el saldo, que va en ella)
    if (miPerfil() && !cuerpo.querySelector(".tienda-asi")) {
      pintarCuerpo();
      return;
    }
    pintarSaldo();
    repintarArticulos();
    pintarAsiTeVen();
  });
  alCambiarSesion(() => {
    if (!vista.hidden) pintarTodo();
  });
}

// mostrar(vista, opciones): desde fuera se puede abrir en una pestaña (p. ej. «huevos» desde el perfil)
export function mostrar(_vista, opciones = {}) {
  if (opciones && opciones.pestana && PESTANAS.some((cada) => cada.id === opciones.pestana)) pestana = opciones.pestana;
  pintarTodo();
}

export function abrirPestana(id) {
  pestana = id;
  if (!vista.hidden) pintarTodo();
}
