// Sección «Tienda»: en qué se gastan los Pokédólares (rediseño del 2026-11-20).
//
//   · Dos pestañas: «Probador» y «Huevos». A la derecha, tu saldo, con la «i» que explica de dónde sale cada
//     Pokédólar.
//   · Probador: arriba, cómo te verían los demás en los sitios de verdad (la portada de tu perfil, tu fila en la
//     lista de amigos y un mensaje del foro) y, al lado, el carrito (fondo, marco y título que te pruebas, lo que
//     cuesta y «Comprar»). Abajo, lo que hay: «De oferta hoy» (4 cosas al azar cada día con un 25 % menos),
//     fondos, marcos y títulos. Tocar algo lo mete en el carrito (o lo saca); comprar lo paga todo y te lo pone.
//   · «Huevos»: la colección de js/juegos/coleccion.js.
//
// Los Pokédólares (cómo se ganan, cómo se guardan, comprar, las ofertas) están en js/comun/fichas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual, alCambiarSesion, hayNube } from "../comun/nube.js";
import { miPerfil, alCambiarMiPerfil } from "../comun/perfiles.js";
import { FONDOS, FONDOS_TIENDA, claseFondo, estiloFondo, fondoDe } from "../comun/fondos.js";
import {
  saldo, fichasDeLogros, fichasDeJuegos, fichasDeLockes, fichasDeApuestas, PREMIOS_LOCKE, BONO_MAX, FICHAS_POR_NIVEL, MARCOS, TITULOS,
  loTiene, porPrecio, marcoDe, claseMarco, claseTitulo, tituloDe, comprarYPoner, ofertasDeHoy, precioDeHoy, DESCUENTO,
  rgbDePerfil
} from "../comun/fichas.js";
import { fichasDeRegalos } from "../comun/regalos.js";
import { NIVELES } from "../comun/logros.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { t, LOCALE } from "../comun/idioma.js";

const vista = document.getElementById("vista-tienda");
const pestanas = vista.querySelector(".tienda-pestanas");
const saldoCaja = vista.querySelector(".tienda-saldo");
const cuerpo = vista.querySelector(".tienda-cuerpo");

const PESTANAS = [
  { id: "probador", nombre: t("Probador") },
  { id: "huevos", nombre: t("Huevos") }
];
// Dentro del probador
const ESTANTES = ["ofertas", "fondos", "marcos", "titulos"];
const POR_PAGINA = 12; // 6 x 2; con más, por páginas
const ORDENES = [
  { id: "barato", nombre: () => t("Más baratos primero") },
  { id: "caro", nombre: () => t("Más caros primero") },
  { id: "faltan", nombre: () => t("Los que no tienes") },
  { id: "tuyos", nombre: () => t("Los que tienes") }
];

let pestana = "probador";
let estante = "ofertas";
let orden = "barato";
let pagina = 0;
let ocupado = false;
// El carrito: lo que has elegido para probarte, { fondo, marco, titulo } con su id. Empieza vacío: lo que no
// está, se ve lo que ya llevas.
let carrito = {};

const numero = (n) => n.toLocaleString(LOCALE);
const moneda = (n) => `<span class="ficha-cifra"><span class="ficha-moneda"></span>${numero(n)}</span>`;

// ---------- Saldo ----------

// De dónde salen los tuyos: [[de qué, cuántos]] (solo lo que no es cero)
function desglose(perfil) {
  return [
    [t("logros"), fichasDeLogros(perfil)],
    [t("retos"), fichasDeJuegos(perfil)],
    [t("lockes"), fichasDeLockes(perfil)],
    [t("regalos"), fichasDeRegalos()],
    [t("apuestas"), fichasDeApuestas(perfil)]
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

// A la derecha de las pestañas
function pintarSaldo() {
  const perfil = usuarioActual() ? miPerfil() : null;
  saldoCaja.innerHTML = perfil
    ? `
      <div class="boton-ir tienda-saldo-cifra">
        <span class="ficha-moneda"></span>
        <strong>${numero(saldo(perfil))}</strong>
        <small class="boton-ir-texto">${t("Pokédólares")}</small>
        <button class="juegos-info" aria-label="${t("De dónde salen tus Pokédólares")}" title="${t("De dónde salen tus Pokédólares")}">i</button>
      </div>`
    : "";
}

// ---------- Artículos ----------

const TIPOS = {
  fondo: { campo: "fondo", nada: "", lista: () => porPrecio(FONDOS_TIENDA), nombre: () => t("Fondo") },
  marco: { campo: "marco", nada: "", lista: () => porPrecio(MARCOS.filter((marco) => marco.precio)), nombre: () => t("Marco") },
  titulo: { campo: "titulo", nada: null, lista: () => porPrecio(TITULOS), nombre: () => t("Título") }
};

const tipoDe = (id) => (FONDOS.some((cada) => cada.id === id) ? "fondo" : MARCOS.some((cada) => cada.id === id) ? "marco" : "titulo");
// También los fondos y marcos de logros (los puedes llevar puestos aunque no se vendan)
const articuloDe = (id) => [...FONDOS, ...MARCOS, ...TITULOS].find((cada) => cada.id === id) || null;

// Lo que llevas puesto de cada tipo ("" si nada)
function puestoDe(perfil, tipo) {
  if (!perfil) return "";
  if (tipo === "fondo") return fondoDe(perfil);
  if (tipo === "marco") return marcoDe(perfil);
  const titulo = tituloDe(perfil);
  return titulo ? titulo.id : "";
}

// Lo que se ve con el carrito: lo elegido o, si no hay nada elegido de ese tipo, lo de ahora
function seVe(perfil, tipo) {
  return carrito[tipo] || puestoDe(perfil, tipo);
}

export function fotoDeMuestra(perfil, clase = "") {
  return perfil && perfil.foto
    ? `<img class="${clase}" src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase} sin-foto">${escaparHTML(((perfil && perfil.nombre) || "?")[0].toUpperCase())}</span>`;
}

function muestraDe(articulo, tipo, perfil) {
  if (tipo === "fondo") return `<span class="tienda-muestra ${claseFondo(articulo.id)}" style="${estiloFondo(articulo.id)}"></span>`;
  if (tipo === "marco") return `<span class="tienda-muestra tienda-muestra-marco"><span class="tienda-foto ${claseMarco(articulo.id)}">${fotoDeMuestra(perfil)}</span></span>`;
  return `<span class="tienda-muestra tienda-muestra-titulo"><span class="perfil-titulo ${claseTitulo(articulo)}">${escaparHTML(articulo.nombre)}</span></span>`;
}

function plantillaArticulo(articulo, perfil, ofertas) {
  const tipo = tipoDe(articulo.id);
  const tuyo = loTiene(perfil, articulo.id);
  const puesto = puestoDe(perfil, tipo) === articulo.id;
  const elegido = tipo in carrito && carrito[tipo] === articulo.id;
  const oferta = ofertas.includes(articulo.id);
  const precio = precioDeHoy(articulo);
  const pie = tuyo
    ? `<span class="tp-tuyo">${puesto ? t("Puesto") : t("Tuyo")}</span>`
    : `<span class="tp-precio ${perfil && saldo(perfil) < precio ? "no-llega" : ""}">${oferta ? `<s>${numero(articulo.precio)}</s>` : ""}${moneda(precio)}</span>`;
  return `
    <button class="tp-articulo ${elegido ? "elegido" : ""} ${puesto ? "puesto" : ""}" data-elegir="${escaparHTML(articulo.id)}" title="${escaparHTML(articulo.nombre)}">
      ${muestraDe(articulo, tipo, perfil)}
      ${oferta && !tuyo ? `<span class="tp-descuento">−${Math.round(DESCUENTO * 100)} %</span>` : ""}
      <span class="tp-pie"><b>${escaparHTML(articulo.nombre)}</b>${pie}</span>
    </button>`;
}

function articulosDelEstante(perfil) {
  const lista = estante === "ofertas"
    ? ofertasDeHoy().map(articuloDe).filter(Boolean)
    : TIPOS[estante === "fondos" ? "fondo" : estante === "marcos" ? "marco" : "titulo"].lista();
  const precio = (articulo) => precioDeHoy(articulo);
  const tuyo = (articulo) => (loTiene(perfil, articulo.id) ? 1 : 0);
  const ordenada = lista.slice().sort((uno, otro) => precio(uno) - precio(otro));
  if (orden === "caro") ordenada.reverse();
  if (orden === "faltan") ordenada.sort((uno, otro) => tuyo(uno) - tuyo(otro));
  if (orden === "tuyos") ordenada.sort((uno, otro) => tuyo(otro) - tuyo(uno));
  return ordenada;
}

// ---------- Cómo te verían ----------

function plantillaAsiTeVerian(perfil) {
  const fondo = seVe(perfil, "fondo");
  const marco = seVe(perfil, "marco");
  const idTitulo = seVe(perfil, "titulo");
  const titulo = TITULOS.find((cada) => cada.id === idTitulo) || null;
  const placa = titulo ? `<span class="perfil-titulo ${claseTitulo(titulo)}">${escaparHTML(titulo.nombre)}</span>` : "";
  const placaChica = titulo ? `<span class="perfil-titulo ${claseTitulo(titulo)} pequeno">${escaparHTML(titulo.nombre)}</span>` : "";
  const visual = fondo ? { clase: `lleva-fondo ${claseFondo(fondo)}`, estilo: estiloFondo(fondo) } : { clase: "", estilo: "" };
  const color = rgbDePerfil(perfil);
  const nombre = escaparHTML(perfil.nombre || t("Jugador"));
  const frase = (perfil.sobreMi || "").trim();
  const probando = enCarrito().length > 0;
  return `
    <span class="tp-donde">${t("En tu perfil")}</span>
    <header class="amigo-portada tp-portada ${visual.clase}" style="--color-vista: ${color}; ${visual.estilo}">
      ${probando ? `<span class="tp-probando">${t("Probándotelo")}</span>` : ""}
      <span class="perfil-ficha-foto amigo-portada-foto ${claseMarco(marco)}">${fotoDeMuestra(perfil, "perfil-foto")}</span>
      <div class="amigo-portada-quien">
        <h2 class="amigo-portada-nombre-solo">${nombre}</h2>
        <div class="amigo-portada-nombre">${placa}</div>
        <p class="amigo-portada-frase">${frase ? `«${escaparHTML(frase)}»` : ""}</p>
      </div>
    </header>
    <div class="tp-dos">
      <div>
        <span class="tp-donde">${t("En la lista de amigos")}</span>
        <div class="amigo-fila tp-fila ${visual.clase}" style="--color-vista: ${color}; ${visual.estilo}">
          <span class="jugador-foto ${claseMarco(marco)}" style="--foto: 2.7rem">${fotoDeMuestra(perfil)}</span>
          <span class="amigo-fila-quien"><b class="amigo-fila-nombre">${nombre}</b><span class="amigo-fila-estado"><span class="amigo-punto"></span>${t("Conectado")}</span></span>
          <span class="amigo-fila-marcador"><b>3 – 1</b><small>${t("contigo")}</small></span>
        </div>
      </div>
      <div>
        <span class="tp-donde">${t("En el foro y el chat")}</span>
        <div class="tp-mensaje">
          <span class="tienda-foto ${claseMarco(marco)}">${fotoDeMuestra(perfil)}</span>
          <span class="tp-mensaje-texto"><span><b>${nombre}</b>${placaChica}</span><p>${t("¿Alguien se apunta a un Soul Link este finde?")}</p></span>
        </div>
      </div>
    </div>`;
}

// ---------- El carrito ----------

// Lo que hay en el carrito, por orden (fondo, marco, título)
const enCarrito = () => ["fondo", "marco", "titulo"].filter((tipo) => carrito[tipo]).map((tipo) => articuloDe(carrito[tipo])).filter(Boolean);

// Lo que hay que comprar del carrito (lo que no es tuyo)
function porComprar(perfil) {
  return enCarrito().filter((articulo) => !loTiene(perfil, articulo.id));
}

function plantillaRanura(perfil, articulo, ofertas) {
  const tipo = tipoDe(articulo.id);
  const id = articulo.id;
  let muestra;
  if (tipo === "fondo") muestra = `<span class="tp-mini tienda-muestra ${claseFondo(id)}" style="${estiloFondo(id)}"></span>`;
  else if (tipo === "marco") muestra = `<span class="tp-mini"><span class="tienda-foto ${claseMarco(id)}">${fotoDeMuestra(perfil)}</span></span>`;
  else muestra = `<span class="tp-mini"><span class="perfil-titulo ${claseTitulo(articulo)} pequeno">${escaparHTML(articulo.nombre)}</span></span>`;
  const derecha = loTiene(perfil, id)
    ? `<span class="tp-tuyo">${t("Tuyo")}</span>`
    : `<span class="tp-precio">${ofertas.includes(id) ? `<s>${numero(articulo.precio)}</s>` : ""}${moneda(precioDeHoy(articulo))}</span>`;
  return `
    <div class="tp-ranura">
      ${muestra}
      <span class="tp-ranura-quien"><small>${TIPOS[tipo].nombre()}</small><b>${escaparHTML(articulo.nombre)}</b></span>
      ${derecha}
      <button class="tp-quitar" data-sacar="${tipo}" title="${t("Sacar del carrito")}" aria-label="${t("Sacar del carrito")}">${icono("aspa")}</button>
    </div>`;
}

function plantillaCarrito(perfil, ofertas) {
  const dentro = enCarrito();
  const comprar = porComprar(perfil);
  const total = comprar.reduce((suma, articulo) => suma + precioDeHoy(articulo), 0);
  const faltan = total - saldo(perfil);
  let boton = `<button class="tp-comprar" disabled>${t("Comprar")}</button>`;
  if (comprar.length) {
    boton = `<button class="tp-comprar" data-accion="comprar" ${faltan > 0 ? "disabled" : ""}>${
      comprar.length === 1 ? t("Comprar") : t("Comprar los {n}", { n: comprar.length })}</button>`;
  } else if (dentro.length) boton = `<button class="tp-comprar" data-accion="poner">${t("Ponérmelo")}</button>`;
  const huecos = Array.from({ length: 3 - dentro.length }, () => `<div class="tp-ranura tp-ranura-hueco"></div>`).join("");
  return `
    <h3>${icono("tienda")} ${t("Carrito")}</h3>
    ${dentro.map((articulo) => plantillaRanura(perfil, articulo, ofertas)).join("")}${huecos}
    <div class="tp-total">
      <span class="tp-cuenta">
        <b>${moneda(total)}</b>
        ${faltan > 0 ? `<small class="no-llega">${t("Te faltan {n}", { n: numero(faltan) })}</small>` : ""}
      </span>
      <button class="tp-vaciar" data-accion="vaciar" ${dentro.length ? "" : "disabled"}>${t("Vaciar")}</button>
      ${boton}
    </div>`;
}

// ---------- Pintar ----------

function pintarPestanas() {
  pestanas.innerHTML = PESTANAS.map(
    (cada) => `<button data-pestana="${cada.id}" class="${cada.id === pestana ? "activa" : ""}">${cada.nombre}</button>`
  ).join("");
}

function plantillaContenidoEstante(perfil, ofertas) {
  const lista = articulosDelEstante(perfil);
  const tuyos = lista.filter((articulo) => loTiene(perfil, articulo.id)).length;
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  pagina = Math.min(pagina, paginas - 1);
  const vistos = lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const huecos = Array.from({ length: POR_PAGINA - vistos.length }, () => `<span class="tp-hueco"></span>`).join("");
  return `
    <div class="tp-estante-herramientas">
      <div class="tp-orden">
        <button class="tp-orden-boton" data-abrir-orden aria-haspopup="listbox" aria-expanded="false" title="${t("Ordenar")}">
          ${ORDENES.find((cada) => cada.id === orden).nombre()}${icono("abajo")}
        </button>
        <div class="tp-orden-lista" role="listbox" hidden>
          ${ORDENES.map((cada) => `<button role="option" data-orden="${cada.id}" class="${cada.id === orden ? "elegido" : ""}" aria-selected="${cada.id === orden}">${cada.nombre()}</button>`).join("")}
        </div>
      </div>
      ${paginas > 1 ? `
        <span class="tp-paginas">
          <button data-pagina="-1" ${pagina === 0 ? "disabled" : ""} aria-label="${t("Anterior")}">${icono("izquierda")}</button>
          <b>${pagina + 1}/${paginas}</b>
          <button data-pagina="1" ${pagina === paginas - 1 ? "disabled" : ""} aria-label="${t("Siguiente")}">${icono("derecha")}</button>
        </span>` : ""}
      <span class="tp-progreso"><small>${t("Tienes {n} de {total}", { n: tuyos, total: lista.length })}</small><span class="tp-barrita"><i style="width: ${lista.length ? Math.round((100 * tuyos) / lista.length) : 0}%"></i></span></span>
    </div>
    <div class="tp-rejilla">
      ${vistos.map((articulo) => plantillaArticulo(articulo, perfil, ofertas)).join("")}${huecos}
    </div>`;
}

function plantillaEstante(perfil, ofertas) {
  const nombres = { ofertas: t("De oferta hoy"), fondos: t("Fondos"), marcos: t("Marcos"), titulos: t("Títulos") };
  return `
    <div class="tp-estante-cabeza">
      <div class="tp-segmentos" role="tablist">
        <span class="tp-indicador" aria-hidden="true"></span>
        ${ESTANTES.map((cada) => `<button data-estante="${cada}" class="${cada === estante ? "activo" : ""}">${nombres[cada]}${cada === "ofertas" ? ` <span class="tp-oferta-chip">${ofertas.length}</span>` : ""}</button>`).join("")}
      </div>
    </div>
    <div class="tp-estante-contenido">${plantillaContenidoEstante(perfil, ofertas)}</div>`;
}

// El resalte de la pestaña elegida, debajo de ella (se desliza al cambiar: css/tienda.css, .tp-indicador)
function moverIndicador(sinTransicion = false) {
  const segmentos = cuerpo.querySelector(".tp-segmentos");
  const activo = segmentos && segmentos.querySelector("button.activo");
  if (!activo) return;
  const indicador = segmentos.querySelector(".tp-indicador");
  indicador.classList.toggle("sin-transicion", sinTransicion);
  indicador.style.left = `${activo.offsetLeft}px`;
  indicador.style.width = `${activo.offsetWidth}px`;
}

// Solo lo de dentro del estante (las pestañas se quedan, y así el resalte se desliza)
function pintarEstante() {
  const perfil = miPerfil();
  const caja = cuerpo.querySelector(".tp-estante-contenido");
  if (!perfil || !caja) return pintarCuerpo();
  for (const boton of cuerpo.querySelectorAll(".tp-segmentos [data-estante]")) boton.classList.toggle("activo", boton.dataset.estante === estante);
  moverIndicador();
  caja.innerHTML = plantillaContenidoEstante(perfil, ofertasDeHoy());
  const rejilla = caja.querySelector(".tp-rejilla");
  rejilla.classList.remove("entra");
  void rejilla.offsetWidth;
  rejilla.classList.add("entra");
  return undefined;
}

// Lo de arriba (cómo te verían y el carrito), sin tocar el estante
function pintarArriba() {
  const perfil = miPerfil();
  const asi = cuerpo.querySelector(".tp-asi");
  const caja = cuerpo.querySelector(".tp-carrito");
  if (!perfil || !asi || !caja) return pintarCuerpo();
  const ofertas = ofertasDeHoy();
  asi.innerHTML = plantillaAsiTeVerian(perfil);
  caja.innerHTML = plantillaCarrito(perfil, ofertas);
  // Lo elegido, marcado en el estante
  for (const boton of cuerpo.querySelectorAll(".tp-estante [data-elegir]")) {
    const tipo = tipoDe(boton.dataset.elegir);
    boton.classList.toggle("elegido", carrito[tipo] === boton.dataset.elegir);
  }
  return undefined;
}

function pintarCuerpo() {
  const perfil = usuarioActual() ? miPerfil() : null;
  cuerpo.classList.toggle("es-probador", pestana === "probador");
  if (pestana === "huevos") {
    cuerpo.innerHTML = `<div class="tienda-principal"><div class="coleccion"></div></div>`;
    import("../juegos/coleccion.js")
      .then(({ montarColeccion }) => montarColeccion(cuerpo.querySelector(".coleccion")))
      .catch((error) => {
        console.error(error);
        cuerpo.querySelector(".tienda-principal").innerHTML = `<p class="juego-cargando">${t("No se ha podido cargar la colección. Comprueba la conexión y vuelve a entrar.")}</p>`;
      });
    return;
  }
  if (!perfil) {
    cuerpo.innerHTML = `<p class="juegos-nota">${hayNube() ? t("Inicia sesión para comprar.") : ""}</p>`;
    return;
  }
  const ofertas = ofertasDeHoy();
  cuerpo.innerHTML = `
    <div class="tp-probador">
      <section class="tp-caja tp-asi">${plantillaAsiTeVerian(perfil)}</section>
      <section class="tp-caja tp-carrito">${plantillaCarrito(perfil, ofertas)}</section>
      <section class="tp-caja tp-estante">${plantillaEstante(perfil, ofertas)}</section>
    </div>`;
  moverIndicador(true);
}

function pintarTodo() {
  pintarPestanas();
  pintarSaldo();
  pintarCuerpo();
}

// Tocar algo: al carrito (en el hueco de su tipo); otra vez, fuera. Lo que ya llevas puesto no entra.
function elegir(id) {
  const perfil = miPerfil();
  const tipo = tipoDe(id);
  if (carrito[tipo] === id) delete carrito[tipo];
  else if (puestoDe(perfil, tipo) === id) return;
  else carrito[tipo] = id;
  pintarArriba();
}

function sacar(tipo) {
  delete carrito[tipo];
  pintarArriba();
}

async function comprarCarrito(soloPoner) {
  const perfil = miPerfil();
  if (!perfil || ocupado) return;
  const comprar = soloPoner ? [] : porComprar(perfil);
  const total = comprar.reduce((suma, articulo) => suma + precioDeHoy(articulo), 0);
  if (comprar.length) {
    const lista = comprar.map((articulo) => `«${articulo.nombre}»`).join(", ");
    const vale = await confirmar(t("¿Comprar {lista} por {n} Pokédólares? Te lo pones al momento.", { lista, n: numero(total) }), { aceptar: t("Comprar") });
    if (!vale) return;
  }
  const ponerse = {};
  for (const tipo of Object.keys(carrito)) if (carrito[tipo]) ponerse[TIPOS[tipo].campo] = carrito[tipo];
  ocupado = true;
  try {
    const fallo = await comprarYPoner(comprar.map((articulo) => articulo.id), ponerse);
    if (fallo) await avisar(fallo);
    else carrito = {};
  } catch (error) {
    console.error(error);
    await avisar(t("No se ha podido guardar. Prueba otra vez."));
  } finally {
    ocupado = false;
    pintarCuerpo();
  }
}

function abrirOrden(si) {
  const lista = cuerpo.querySelector(".tp-orden-lista");
  const boton = cuerpo.querySelector(".tp-orden-boton");
  if (!lista || !boton) return;
  lista.hidden = !si;
  boton.setAttribute("aria-expanded", String(si));
}

function alPulsar(e) {
  if (e.target.closest(".juegos-info:not(.coleccion-info)")) {
    avisar(comoSeGanan());
    return;
  }
  const boton = e.target.closest("button");
  if (!boton) return;
  if (boton.hasAttribute("data-abrir-orden")) {
    abrirOrden(cuerpo.querySelector(".tp-orden-lista").hidden);
    return;
  }
  if (boton.dataset.orden) {
    orden = boton.dataset.orden;
    pagina = 0;
    pintarEstante();
    return;
  }
  if (boton.dataset.estante) {
    if (boton.dataset.estante === estante) return;
    estante = boton.dataset.estante;
    pagina = 0;
    pintarEstante();
  } else if (boton.dataset.pagina) {
    pagina += Number(boton.dataset.pagina);
    pintarEstante();
  } else if (boton.dataset.elegir) elegir(boton.dataset.elegir);
  else if (boton.dataset.sacar) sacar(boton.dataset.sacar);
  else if (boton.dataset.accion === "vaciar") {
    carrito = {};
    pintarArriba();
  } else if (boton.dataset.accion === "comprar") comprarCarrito(false);
  else if (boton.dataset.accion === "poner") comprarCarrito(true);
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
  // El desplegable de ordenar se cierra al pulsar fuera o con Escape
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tp-orden")) abrirOrden(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") abrirOrden(false);
  });
  window.addEventListener("resize", () => moverIndicador(true));

  alCambiarMiPerfil(() => {
    if (vista.hidden) return;
    pintarSaldo();
    if (pestana !== "probador") return;
    if (cuerpo.querySelector(".tp-estante-contenido")) {
      pintarArriba();
      pintarEstante();
    } else pintarCuerpo();
  });
  alCambiarSesion(() => {
    carrito = {};
    if (!vista.hidden) pintarTodo();
  });
}

// mostrar(vista, opciones): desde fuera se puede abrir en una pestaña («huevos») o en un estante del probador
// («fondos», «marcos», «titulos», «ofertas»)
function irA(id) {
  if (PESTANAS.some((cada) => cada.id === id)) pestana = id;
  else if (ESTANTES.includes(id)) {
    pestana = "probador";
    estante = id;
    pagina = 0;
  }
}

export function mostrar(_vista, opciones = {}) {
  if (opciones && opciones.pestana) irA(opciones.pestana);
  pintarTodo();
}

export function abrirPestana(id) {
  irA(id);
  if (!vista.hidden) pintarTodo();
}
