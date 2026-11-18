// Sección «Ruleta»: una ruleta con las opciones que pongas (recompensas por ganar un
// combate, castigos, lo que sea). Al pulsar el centro gira y cae en una al azar.
//
//   · Puede haber varias, cada una con su nombre y sus opciones. Se cambia de una a otra (o se
//     crea otra) con la flecha pegada al nombre, que abre la lista.
//   · Las opciones se escriben a la derecha y la ruleta cambia según escribes.
//   · El resultado se elige ANTES de girar, con el azar del navegador (crypto), y la ruleta
//     simplemente gira hasta dejarlo bajo la flecha: todas las casillas tienen la misma
//     probabilidad.
//
// Se guardan como los equipos (en el navegador y, con sesión, en tu cuenta).
//
//   localStorage «poketeams-ruletas-v1»:
//     { ruletas: [{ id, nombre, opciones: [{ texto, color? }] }], activa: id }
//   (color solo si se ha elegido uno; si no, va el de la paleta según su sitio)

import { leer, escribir } from "../comun/almacen.js";
import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { sumarContador } from "../comun/contadores.js";
import { confirmar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";
import { activarMenuMas } from "../comun/menu-mas.js";
import { cargarPokedex, nombreDeFila, archivoHoja, RETRATOS } from "../pokedex/datos.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { activarAutocompletado, iconoPokemon, iconoObjeto } from "../comun/autocompletado.js";
import { imagenConRespaldo, urlsIconoObjeto } from "../comun/imagenes.js";
import { quitarAcentos } from "../comun/utilidades.js";
import { nombre as nombreEn } from "../comun/idioma.js";

const CLAVE = "poketeams-ruletas-v1";
const MAX_RULETAS = 20;
const MAX_OPCIONES = 60;
const MAX_HISTORIAL = 8;
const MAX_CASILLAS = 20;

// Las casillas que ocupa una opción en la rueda (1 si no se ha tocado)
function casillasDe(opcion) {
  return Math.max(1, Math.min(MAX_CASILLAS, Math.floor(opcion.casillas) || 1));
}

// Con la que se empieza: recompensas típicas de un locke por ganar un combate importante
const DE_EJEMPLO = {
  nombre: t("Recompensas"),
  opciones: ["Objeto a elegir", "Revivir a un Pokémon", "Una vida extra", "Captura extra", "MT a elegir", "Nada"].map((opcion) => t(opcion))
};

// Las de ejemplo de antes: a quien las tenga tal cual (sin tocar), se le quitan esas dos
const EJEMPLO_ANTIGUO = [
  "Caramelo raro", "Objeto a elegir", "Revivir a un Pokémon", "Una vida extra",
  "Captura extra", "MT a elegir", "Cambiar de inicial", "Nada"
];

const COLORES = [
  "#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e84393", "#16a085", "#d35400"
];

const RADIO = 96;

const vista = document.getElementById("vista-ruleta");
const listaRuletas = vista.querySelector(".ruleta-lista");
// Lo que gira es lo de dentro del SVG, no el SVG: un cuadrado girado se sale por las esquinas y
// la página cambiaba de tamaño (y salía y se iba la barra de scroll) mientras daba vueltas
const rueda = vista.querySelector(".ruleta-giro");
const botonGirar = vista.querySelector(".ruleta-girar");
const resultado = vista.querySelector(".ruleta-resultado");
const campoNombre = vista.querySelector(".ruleta-nombre");
const listaOpciones = vista.querySelector(".ruleta-opciones");
const campoNueva = vista.querySelector(".ruleta-nueva");
const cajaNueva = vista.querySelector(".ruleta-anadir");
const anadirTodo = vista.querySelector(".ruleta-anadir-todo");
let modoAnadir = "texto"; // "texto", "poke" u "objeto": lo que se añade
const cajaHistorial = vista.querySelector(".ruleta-historial-caja");
const historialLista = vista.querySelector(".ruleta-historial");

let rotacion = 0;      // grados que lleva girados la ruleta (se acumulan)
let girando = false;
let ganadora = null;   // casilla en la que ha caído la última vez (se resalta)
const historial = [];  // { texto, ruleta } de esta visita, la última primero

// ---------- Datos ----------

function nuevoId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function guardado() {
  const valor = leer(CLAVE, null);
  const ruletas = (valor && Array.isArray(valor.ruletas) && valor.ruletas) || [];
  if (!ruletas.length) ruletas.push({ id: nuevoId(), nombre: DE_EJEMPLO.nombre, opciones: DE_EJEMPLO.opciones });
  // Antes las opciones eran solo el texto
  for (const ruleta of ruletas) {
    ruleta.opciones = (ruleta.opciones || []).map((opcion) => (typeof opcion === "string" ? { texto: opcion } : opcion));
    const textos = ruleta.opciones.map((opcion) => opcion.texto);
    if (textos.length === EJEMPLO_ANTIGUO.length && textos.every((texto, i) => texto === EJEMPLO_ANTIGUO[i])) {
      ruleta.opciones = ruleta.opciones.filter((opcion) => DE_EJEMPLO.opciones.includes(opcion.texto));
    }
  }
  const activa = ruletas.some((ruleta) => ruleta.id === (valor && valor.activa)) ? valor.activa : ruletas[0].id;
  return { ruletas, activa };
}

let estado = null;

function guardar() {
  escribir(CLAVE, estado);
}

function actual() {
  return estado.ruletas.find((ruleta) => ruleta.id === estado.activa);
}

// Un número al azar en [0, 1) con el generador del navegador para cosas de seguridad: mejor
// repartido que Math.random
function azar() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

// ---------- La ruleta (SVG) ----------
//
// Los ángulos se cuentan desde arriba y en el sentido de las agujas del reloj, que es donde
// está la flecha. La casilla i ocupa de i·s a (i+1)·s grados (s = 360 / casillas).

function punto(grados, radio) {
  const rad = (grados * Math.PI) / 180;
  return `${(radio * Math.sin(rad)).toFixed(2)} ${(-radio * Math.cos(rad)).toFixed(2)}`;
}

function colorDe(opciones, i) {
  if (opciones[i].color) return opciones[i].color;
  // Que la última no quede del mismo color que la primera, que están juntas
  const total = opciones.length;
  const indice = i === total - 1 && total % COLORES.length === 1 ? 1 : i % COLORES.length;
  return COLORES[indice];
}

// Texto oscuro sobre los colores claros, blanco sobre los oscuros
function textoSobre(color) {
  const canal = (j) => {
    const c = parseInt(color.slice(j, j + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  return luz > 0.35 ? "#1e1f2b" : "#fff";
}

function recortar(texto, caben) {
  return texto.length > caben ? `${texto.slice(0, Math.max(1, caben - 1))}…` : texto;
}

// Cada opción ocupa tantas casillas como diga (1 por defecto): más casillas, más probabilidad. Juntas,
// son un solo trozo más grande; separadas (opcion.separadas), son varios trozos del tamaño de una
// casilla, repartidos por la rueda (la probabilidad es la misma: es solo cómo se ve).
// Devuelve los trozos en orden, cada uno con su opción (i), cuántas casillas mide y sus ángulos.
function tramos(opciones) {
  const total = opciones.reduce((suma, opcion) => suma + casillasDe(opcion), 0);
  const trozos = [];
  opciones.forEach((opcion, i) => {
    const n = casillasDe(opcion);
    // Dónde cae cada trozo en la vuelta (de 0 a 1): las opciones en su orden y, las separadas,
    // con sus trozos a la misma distancia unos de otros
    const base = (i + 0.5) / opciones.length;
    if (opcion.separadas && n > 1) for (let j = 0; j < n; j++) trozos.push({ i, casillas: 1, orden: (j + base) / n });
    else trozos.push({ i, casillas: n, orden: base });
  });
  trozos.sort((uno, otro) => uno.orden - otro.orden || uno.i - otro.i);
  let desde = 0;
  return trozos.map((trozo) => {
    const tamano = (trozo.casillas / total) * 360;
    const tramo = { i: trozo.i, casillas: trozo.casillas, desde, hasta: desde + tamano, tamano, medio: desde + tamano / 2 };
    desde += tamano;
    return tramo;
  });
}

// El dibujo de un objeto en la rueda, el mismo que en la lista (el de alta resolución): un <image>
// de SVG no prueba otra dirección si falla, así que se prueban aquí y se guarda la que carga
const urlDeObjeto = new Map(); // nombre en inglés -> la dirección que carga
let repintarAlParar = false;

function dibujoDeObjeto(en) {
  if (urlDeObjeto.has(en)) return urlDeObjeto.get(en);
  const urls = urlsIconoObjeto(en);
  urlDeObjeto.set(en, urls[0]);
  const probar = (n) => {
    const imagen = new Image();
    imagen.onerror = () => {
      if (n + 1 >= urls.length) return;
      urlDeObjeto.set(en, urls[n + 1]);
      if (girando) repintarAlParar = true;
      else pintarRueda();
      probar(n + 1);
    };
    imagen.src = urls[n];
  };
  probar(0);
  return urls[0];
}

// Un Pokémon (su retrato de la hoja de la Pokédex, recortado en círculo) o un objeto (su icono),
// dibujado dentro de la rueda. Siempre derecho: el dibujo gira al revés que la rueda (también
// mientras gira: enderezarDibujos), como las cabinas de una noria. El giro va en el atributo
// transform, sobre el 0 0 del grupo (el centro del dibujo). Con transform de CSS y «fill-box» se
// medía la hoja entera de retratos (la imagen de dentro, sin recortar) y los dibujos se salían.
function iconoEnRueda(icono, tramo, i) {
  const radio = RADIO * 0.64;
  const cuerda = 2 * Math.PI * radio * (tramo.tamano / 360);
  const lado = Math.max(10, Math.min(30, cuerda * 0.85));
  const mitad = (lado / 2).toFixed(1);
  let dibujo = "";
  if (icono.tipo === "poke" && icono.retrato >= 0) {
    const porHoja = RETRATOS.columnas * RETRATOS.filasPorHoja;
    const dentro = icono.retrato % porHoja;
    const columna = dentro % RETRATOS.columnas;
    const fila = Math.floor(dentro / RETRATOS.columnas);
    dibujo = `<clipPath id="ruleta-recorte-${i}"><circle r="${mitad}"/></clipPath>
              <g clip-path="url(#ruleta-recorte-${i})">
                <svg x="-${mitad}" y="-${mitad}" width="${lado.toFixed(1)}" height="${lado.toFixed(1)}"
                     viewBox="${columna * RETRATOS.lado} ${fila * RETRATOS.lado} ${RETRATOS.lado} ${RETRATOS.lado}">
                  <image href="${archivoHoja(Math.floor(icono.retrato / porHoja))}" width="${RETRATOS.columnas * RETRATOS.lado}"
                         height="${RETRATOS.filasPorHoja * RETRATOS.lado}" style="image-rendering: pixelated"/>
                </svg>
              </g>`;
  } else if (icono.tipo === "objeto" && icono.en) {
    dibujo = `<image href="${escaparHTML(dibujoDeObjeto(icono.en))}" x="-${mitad}" y="-${mitad}"
                     width="${lado.toFixed(1)}" height="${lado.toFixed(1)}"/>`;
  } else return "";
  const rad = (tramo.medio * Math.PI) / 180;
  const x = (radio * Math.sin(rad)).toFixed(2);
  const y = (-radio * Math.cos(rad)).toFixed(2);
  return `<g transform="translate(${x} ${y})"><g class="ruleta-ico-giro" transform="rotate(${(-rotacion % 360).toFixed(2)})">${dibujo}</g></g>`;
}

function pintarRueda() {
  const opciones = actual().opciones;
  const total = opciones.length;

  if (!total) {
    rotacion = 0; // que el texto salga derecho
    rueda.style.transition = "none";
    rueda.style.transform = "";
    rueda.innerHTML = `
      <circle r="${RADIO}" class="ruleta-vacia"/>
      <text class="ruleta-vacia-texto" y="-34" text-anchor="middle">${t("Añade opciones")}</text>`;
    return;
  }

  const partes = tramos(opciones);
  // Cada texto va del borde hacia el centro, hasta el botón. La letra, lo más grande que deje
  // el ancho de la casilla y, si el texto es largo, más pequeña para que quepa entero (hasta
  // un mínimo: de ahí para abajo, se corta).
  const largo = RADIO - 8 - RADIO * 0.27;
  const medidas = (texto, tramo) => {
    const tamanoMaximo = Math.min(10, ((2 * Math.PI * RADIO * 0.6 * (tramo.tamano / 360))) * 0.7);
    const tamano = Math.max(Math.min(4.5, tamanoMaximo), Math.min(tamanoMaximo, largo / (texto.length * 0.58)));
    return { tamano, caben: Math.floor(largo / (tamano * 0.58) + 0.01) }; // +0.01: que 12,9999 no se quede en 12
  };

  rueda.innerHTML = partes
    .map((tramo, k) => {
      const i = tramo.i;
      const { texto, icono: dibujo } = opciones[i];
      const { tamano, caben } = medidas(texto, tramo);
      const color = colorDe(opciones, i);
      const forma = partes.length === 1
        ? `<circle r="${RADIO}" fill="${color}"/>`
        : `<path d="M0 0 L${punto(tramo.desde, RADIO)} A${RADIO} ${RADIO} 0 ${tramo.tamano > 180 ? 1 : 0} 1 ${punto(tramo.hasta, RADIO)}Z" fill="${color}"/>`;
      // Con icono (un Pokémon o un objeto), solo el dibujo; si no, el texto
      const dentro = dibujo
        ? iconoEnRueda(dibujo, tramo, k)
        : `<text transform="rotate(${(tramo.medio - 90).toFixed(2)})" x="${RADIO - 8}" y="0" text-anchor="end"
                dominant-baseline="central" font-size="${tamano.toFixed(1)}"
                fill="${textoSobre(color)}">${escaparHTML(recortar(texto, caben))}</text>`;
      return `
        <g class="ruleta-casilla ${ganadora === null ? "" : ganadora === i ? "ganadora" : "apagada"}">
          ${forma}
          ${dentro}
        </g>`;
    })
    .join("") + `<circle r="${RADIO}" class="ruleta-borde"/>`;
}

// ---------- Sonido ----------
//
// Un «tac» cada vez que una casilla pasa por la flecha (como en las de verdad: rápido al
// principio y cada vez más despacio) y un «tilín» al pararse. Hecho con Web Audio, sin
// archivos; el primer giro es una pulsación, así que el navegador deja sonar.

let audio = null;

function contextoAudio() {
  if (!audio) {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return null;
    audio = new Contexto();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

// Una nota corta: frecuencia de inicio y final, cuándo (segundos desde ya), cuánto dura y volumen
function nota(ctx, tipo, desde, hasta, cuando, dura, volumen) {
  const t = ctx.currentTime + cuando;
  const oscilador = ctx.createOscillator();
  const ganancia = ctx.createGain();
  oscilador.type = tipo;
  oscilador.frequency.setValueAtTime(desde, t);
  oscilador.frequency.exponentialRampToValueAtTime(hasta, t + dura);
  ganancia.gain.setValueAtTime(volumen, t);
  ganancia.gain.exponentialRampToValueAtTime(0.001, t + dura);
  oscilador.connect(ganancia).connect(ctx.destination);
  oscilador.start(t);
  oscilador.stop(t + dura + 0.02);
}

function tac() {
  const ctx = contextoAudio();
  if (ctx) nota(ctx, "triangle", 1500, 500, 0, 0.035, 0.2);
}

function tilin() {
  const ctx = contextoAudio();
  if (!ctx) return;
  nota(ctx, "sine", 1046, 1040, 0, 0.35, 0.18);
  nota(ctx, "sine", 1568, 1560, 0.09, 0.5, 0.15);
}

// Mientras gira, mira en cada fotograma qué casilla hay bajo la flecha; al cambiar, «tac»
function sonarGiro(total) {
  const paso = 360 / total;
  let anterior = null;
  let ultimo = 0;
  const mirar = () => {
    if (!girando) return;
    const matriz = getComputedStyle(rueda).transform.match(/matrix\(([^,]+),([^,]+)/);
    if (matriz) {
      const grados = (Math.atan2(Number(matriz[2]), Number(matriz[1])) * 180) / Math.PI;
      const bajoFlecha = Math.floor((((-grados % 360) + 360) % 360) / paso);
      const ahora = performance.now();
      // Muy deprisa, como mucho uno cada 25 ms (si no, se emborrona)
      if (anterior !== null && bajoFlecha !== anterior && ahora - ultimo > 25) {
        tac();
        ultimo = ahora;
      }
      anterior = bajoFlecha;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
}

// ---------- Girar ----------

// Los dibujos, al revés que la rueda en cada fotograma: se quedan derechos mientras gira
function enderezarDibujos() {
  const dibujos = [...rueda.querySelectorAll(".ruleta-ico-giro")];
  if (!dibujos.length) return;
  const paso = () => {
    if (!girando) return;
    const matriz = getComputedStyle(rueda).transform.match(/matrix\(([^,]+),([^,]+)/);
    if (matriz) {
      const grados = (Math.atan2(Number(matriz[2]), Number(matriz[1])) * 180) / Math.PI;
      for (const dibujo of dibujos) dibujo.setAttribute("transform", `rotate(${(-grados).toFixed(2)})`);
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function duracion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 5500;
}

function girar() {
  const opciones = actual().opciones;
  if (girando || !opciones.length) return;

  const total = opciones.length;
  const partes = tramos(opciones);
  // Cada casilla de la rueda tiene la misma probabilidad: se sortea entre todas (una opción con
  // más casillas tiene más posibilidades) y luego un punto dentro de esa opción
  const sorteo = azar() * partes.reduce((suma, tramo) => suma + tramo.casillas, 0);
  let acumulado = 0;
  let trozo = partes[partes.length - 1];
  for (const tramo of partes) {
    acumulado += tramo.casillas;
    if (sorteo < acumulado) {
      trozo = tramo;
      break;
    }
  }
  const casilla = trozo.i;
  // Un punto al azar dentro del trozo, sin pegarse a los bordes
  const angulo = trozo.desde + (0.12 + azar() * 0.76) * trozo.tamano;

  // Se repinta sin la ganadora de antes ANTES de cambiar «rotacion»: los dibujos salen derechos
  // para donde está la rueda ahora (luego los endereza enderezarDibujos)
  girando = true;
  ganadora = null;
  const elegida = opciones[casilla];
  pintarRueda();

  // Para que ese punto quede arriba hay que girar hasta -angulo; más unas cuantas vueltas
  const ahora = ((rotacion % 360) + 360) % 360;
  const destino = (360 - angulo) % 360;
  rotacion += (5 + Math.floor(azar() * 3)) * 360 + ((destino - ahora + 360) % 360);
  resultado.classList.add("oculto");
  vista.classList.add("girando");
  botonGirar.disabled = true;
  for (const campo of vista.querySelectorAll(".ruleta-panel input, .ruleta-panel button")) campo.disabled = true;

  const tiempo = duracion();
  rueda.style.transition = `transform ${tiempo}ms cubic-bezier(0.12, 0.8, 0.18, 1)`;
  rueda.style.transform = `rotate(${rotacion}deg)`;
  enderezarDibujos();
  contextoAudio(); // en la misma pulsación, para que el navegador deje sonar
  sonarGiro(partes.length);
  setTimeout(() => terminar(casilla, elegida), tiempo + 80);
}

function terminar(casilla, elegida) {
  const texto = elegida.texto;
  girando = false;
  repintarAlParar = false;
  ganadora = casilla;
  vista.classList.remove("girando");
  botonGirar.disabled = false;
  for (const campo of vista.querySelectorAll(".ruleta-panel input, .ruleta-panel button")) campo.disabled = false;

  historial.unshift({ texto, ruleta: actual().nombre, color: colorDe(actual().opciones, casilla) });
  historial.splice(MAX_HISTORIAL);
  tilin();
  sumarContador("ruleta"); // para los logros

  pintarRueda();
  pintarHistorial();
  resultado.innerHTML = `
    <button class="ruleta-cerrar-resultado" title="${t("Cerrar")}" aria-label="${t("Cerrar")}">${icono("aspa")}</button>
    <span class="ruleta-resultado-etiqueta">${t("Ha salido")}</span>
    <strong class="ruleta-resultado-texto">${iconoDeOpcion(elegida, "ruleta-ico-grande")}${escaparHTML(texto)}</strong>
    <div class="ruleta-resultado-botones">
      <button class="ruleta-otra">${icono("ruleta")} ${t("Otra vez")}</button>
      <button class="ruleta-quitar-ganadora" data-casilla="${casilla}">${icono("papelera")} ${t("Quitarla de la ruleta")}</button>
    </div>`;
  resultado.classList.remove("oculto");
  // Oculto no desaparece (guarda su hueco, ver ruleta.css): la animación de salir, a mano
  resultado.style.animation = "none";
  void resultado.offsetWidth;
  resultado.style.animation = "";
}

// ---------- Opciones ----------

// El dibujo de una opción en la lista y en el resultado: el retrato del Pokémon o el icono del objeto
function iconoDeOpcion(opcion, clase = "") {
  const dibujo = opcion.icono;
  if (!dibujo) return "";
  if (dibujo.tipo === "poke" && dibujo.retrato >= 0) {
    const porHoja = RETRATOS.columnas * RETRATOS.filasPorHoja;
    const dentro = dibujo.retrato % porHoja;
    const columna = dentro % RETRATOS.columnas;
    const fila = Math.floor(dentro / RETRATOS.columnas);
    return `<span class="ruleta-ico ${clase}" style="background-image: url(${archivoHoja(Math.floor(dibujo.retrato / porHoja))});
      background-position: ${((columna / (RETRATOS.columnas - 1)) * 100).toFixed(3)}% ${((fila / (RETRATOS.filasPorHoja - 1)) * 100).toFixed(3)}%"></span>`;
  }
  if (dibujo.tipo === "objeto" && dibujo.en) {
    return `<span class="ruleta-ico ruleta-ico-objeto ${clase}">${imagenConRespaldo(urlsIconoObjeto(dibujo.en), `alt="" draggable="false"`)}</span>`;
  }
  return "";
}

// Juntas (un trozo grande) o separadas (varios del tamaño de una): solo cambia cómo se ve
function botonSeparar(opcion) {
  const separadas = Boolean(opcion.separadas);
  const titulo = separadas ? t("Separadas: varias casillas iguales. Pulsa para juntarlas en una") : t("Juntas: una casilla más grande. Pulsa para separarlas en varias iguales");
  const dibujo = separadas
    ? `<svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0.5" y="1" width="6.5" height="8" rx="1.2"/><rect x="9" y="1" width="6.5" height="8" rx="1.2"/></svg>`
    : `<svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0.5" y="1" width="15" height="8" rx="1.2"/></svg>`;
  return `<button class="ruleta-separar ${separadas ? "separadas" : ""}" title="${titulo}" aria-label="${titulo}" aria-pressed="${separadas}" ${casillasDe(opcion) <= 1 ? "disabled" : ""}>${dibujo}</button>`;
}

function pintarOpciones() {
  const opciones = actual().opciones;
  const total = opciones.reduce((suma, opcion) => suma + casillasDe(opcion), 0);
  const cabecera = opciones.length
    ? `<div class="ruleta-cabecera-lista"><span>${t("Opción")}</span><span title="${t("Cuántas casillas ocupa en la rueda: más casillas, más probabilidad")}">${t("Casillas")}</span><span>${t("Prob.")}</span></div>`
    : "";
  listaOpciones.innerHTML =
    cabecera +
    opciones
      .map(
        (opcion, i) => `
        <div class="ruleta-opcion" data-indice="${i}">
          <label class="ruleta-color" title="${t("Cambiar el color")}" style="background:${colorDe(opciones, i)}">
            <input type="color" class="ruleta-elegir-color" value="${colorDe(opciones, i)}">
          </label>
          ${iconoDeOpcion(opcion)}
          <input type="text" class="ruleta-texto" maxlength="40" autocomplete="off" value="${escaparHTML(opcion.texto)}">
          <span class="ruleta-casillas" title="${t("Cuántas casillas ocupa en la rueda: más casillas, más probabilidad")}">
            <button class="ruleta-menos" aria-label="${t("Una casilla menos")}" ${casillasDe(opcion) <= 1 ? "disabled" : ""}>−</button>
            <b>${casillasDe(opcion)}</b>
            <button class="ruleta-mas" aria-label="${t("Una casilla más")}" ${casillasDe(opcion) >= MAX_CASILLAS ? "disabled" : ""}>+</button>
            ${botonSeparar(opcion)}
          </span>
          <span class="ruleta-prob">${Math.round((casillasDe(opcion) / total) * 100)}%</span>
          <button class="ruleta-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
        </div>`
      )
      .join("");
  anadirTodo.hidden = opciones.length >= MAX_OPCIONES;
}

// La lista de la flecha: tus ruletas (la de ahora, marcada) y, debajo, «Nueva ruleta»
function pintarLista() {
  const cuantas = (n) => (n === 1 ? t("1 opción") : t("{n} opciones", { n }));
  listaRuletas.innerHTML =
    estado.ruletas
      .map(
        (ruleta) => `
          <button data-ruleta="${escaparHTML(ruleta.id)}" class="${ruleta.id === estado.activa ? "elegida" : ""}">
            ${ruleta.id === estado.activa ? icono("visto") : icono("ruleta")}
            <span class="ruleta-lista-nombre">${escaparHTML(ruleta.nombre || t("Sin nombre"))}</span>
            <small>${cuantas(ruleta.opciones.length)}</small>
          </button>`
      )
      .join("") +
    (estado.ruletas.length < MAX_RULETAS ? `<button class="ruleta-nueva-ruleta">${icono("mas")} ${t("Nueva ruleta")}</button>` : "");
}

function pintarHistorial() {
  cajaHistorial.hidden = !historial.length;
  historialLista.innerHTML = historial
    .map((tirada) => `<li><span class="ruleta-historial-punto" style="background: ${escaparHTML(tirada.color || "transparent")}"></span><strong>${escaparHTML(tirada.texto)}</strong> <small>${escaparHTML(tirada.ruleta)}</small></li>`)
    .join("");
}

// Al cambiar de ruleta o sus opciones, lo que había salido ya no vale (las casillas se mueven)
function olvidarResultado() {
  ganadora = null;
  resultado.classList.add("oculto");
}

function pintarTodo() {
  campoNombre.value = actual().nombre;
  pintarLista();
  pintarOpciones();
  pintarRueda();
}

// Añade una opción: de texto (lo escrito) o con dibujo (un Pokémon o un objeto elegidos en el buscador)
function anadirOpcion(nueva = null) {
  const opciones = actual().opciones;
  if (opciones.length >= MAX_OPCIONES) return;
  if (nueva && nueva.texto) {
    opciones.push(nueva);
  } else {
    const texto = campoNueva.value.trim();
    if (!texto) return;
    opciones.push({ texto });
    campoNueva.value = "";
  }
  guardar();
  olvidarResultado();
  pintarOpciones();
  pintarRueda();
  if (!nueva && modoAnadir === "texto") campoNueva.focus();
}

function quitarOpcion(indice) {
  actual().opciones.splice(indice, 1);
  guardar();
  olvidarResultado();
  pintarOpciones();
  pintarRueda();
}

// ---------- Añadir un Pokémon o un objeto ----------
//
// Con dibujo: el retrato de Mundo Misterioso del Pokémon o el icono del objeto, en la rueda y en la
// lista. Los buscadores se preparan la primera vez que se usan (cargan la Pokédex y los objetos).

const buscadoresListos = new Set();

async function prepararBuscador(modo) {
  if (buscadoresListos.has(modo)) return;
  buscadoresListos.add(modo);
  const campo = vista.querySelector(`.ruleta-buscar[data-buscar="${modo}"] input`);
  campo.placeholder = modo === "poke" ? t("Buscar Pokémon...") : t("Buscar objeto...");

  if (modo === "poke") {
    const pokedex = await cargarPokedex();
    const lista = pokedex
      .filter((fila) => fila.retrato >= 0)
      .map((fila) => {
        const en = nombreDeFila(fila, "en");
        return { es: fila.nombre, en, buscar: quitarAcentos(`${fila.nombre} ${en} ${fila.numero}`), fila };
      });
    activarAutocompletado(campo, lista, (entrada) => {
      campo.value = "";
      anadirOpcion({ texto: nombreEn(entrada), icono: { tipo: "poke", retrato: entrada.fila.retrato } });
    }, { icono: iconoPokemon });
  } else {
    await cargarDatos();
    activarAutocompletado(campo, datos.objetos, (entrada) => {
      campo.value = "";
      anadirOpcion({ texto: nombreEn(entrada), icono: { tipo: "objeto", en: entrada.en } });
    }, { icono: iconoObjeto });
  }
}

async function cambiarModo(modo) {
  modoAnadir = modo;
  for (const boton of vista.querySelectorAll(".ruleta-anadir-tipos button")) {
    boton.classList.toggle("elegido", boton.dataset.tipo === modo);
  }
  cajaNueva.hidden = modo !== "texto";
  for (const caja of vista.querySelectorAll(".ruleta-buscar")) caja.hidden = caja.dataset.buscar !== modo;
  if (modo === "texto") {
    campoNueva.focus();
    return;
  }
  try {
    await prepararBuscador(modo);
  } catch (error) {
    console.error(error);
    buscadoresListos.delete(modo);
    return;
  }
  vista.querySelector(`.ruleta-buscar[data-buscar="${modo}"] input`).focus();
}

// ---------- Arranque ----------

export function iniciar() {
  estado = guardado();
  vista.querySelector(".ruleta-borrar").innerHTML = icono("papelera");
  vista.querySelector(".ruleta-mezclar").innerHTML = `${icono("mezclar")} ${t("Mezclar")}`;
  vista.querySelector(".ruleta-vaciar").innerHTML = `${icono("papelera")} ${t("Vaciar")}`;
  vista.querySelector(".ruleta-anadir-boton").insertAdjacentHTML("afterbegin", `${icono("mas")} `);
  activarMenuMas(vista.querySelector(".ruleta-elegir"), "abajo");

  botonGirar.addEventListener("click", girar);

  listaRuletas.addEventListener("click", (e) => {
    if (girando) return;
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("ruleta-nueva-ruleta")) {
      const nueva = { id: nuevoId(), nombre: t("Ruleta {n}", { n: estado.ruletas.length + 1 }), opciones: [] };
      estado.ruletas.push(nueva);
      estado.activa = nueva.id;
    } else if (boton.dataset.ruleta) {
      estado.activa = boton.dataset.ruleta;
    } else return;
    guardar();
    olvidarResultado();
    pintarTodo();
    // Una nueva: el nombre ya elegido, para escribir el suyo encima
    if (!actual().opciones.length) {
      campoNombre.focus();
      campoNombre.select();
    }
  });

  campoNombre.addEventListener("input", () => {
    actual().nombre = campoNombre.value.trim() || t("Sin nombre");
    guardar();
    pintarLista();
  });

  vista.querySelector(".ruleta-borrar").addEventListener("click", async () => {
    if (!(await confirmar(t("¿Borrar la ruleta «{nombre}»?", { nombre: actual().nombre })))) return;
    estado.ruletas = estado.ruletas.filter((ruleta) => ruleta.id !== estado.activa);
    if (!estado.ruletas.length) estado.ruletas.push({ id: nuevoId(), nombre: t("Ruleta"), opciones: [] });
    estado.activa = estado.ruletas[0].id;
    guardar();
    olvidarResultado();
    pintarTodo();
  });

  // Cambiar el texto de una opción: la ruleta cambia según se escribe
  listaOpciones.addEventListener("input", (e) => {
    const fila = e.target.closest(".ruleta-opcion");
    if (!fila) return;
    const opcion = actual().opciones[Number(fila.dataset.indice)];
    if (e.target.classList.contains("ruleta-elegir-color")) {
      opcion.color = e.target.value;
      e.target.parentElement.style.background = opcion.color;
      guardar();
      pintarRueda(); // el color no mueve casillas: lo que ha salido sigue valiendo
      return;
    }
    opcion.texto = e.target.value;
    guardar();
    olvidarResultado();
    pintarRueda();
  });

  // Al salir, una opción vacía se quita
  listaOpciones.addEventListener("change", (e) => {
    const fila = e.target.closest(".ruleta-opcion");
    if (fila && e.target.classList.contains("ruleta-texto") && !e.target.value.trim()) quitarOpcion(Number(fila.dataset.indice));
  });

  listaOpciones.addEventListener("click", (e) => {
    const boton = e.target.closest(".ruleta-quitar");
    if (boton) {
      quitarOpcion(Number(boton.closest(".ruleta-opcion").dataset.indice));
      return;
    }
    // Juntar o separar sus casillas
    const separar = e.target.closest(".ruleta-separar");
    if (separar) {
      const opcion = actual().opciones[Number(separar.closest(".ruleta-opcion").dataset.indice)];
      opcion.separadas = !opcion.separadas;
      guardar();
      olvidarResultado();
      pintarOpciones();
      pintarRueda();
      return;
    }
    // Más o menos casillas: cambia el trozo de la rueda y la probabilidad de todas
    const cambio = e.target.closest(".ruleta-menos, .ruleta-mas");
    if (!cambio) return;
    const opcion = actual().opciones[Number(cambio.closest(".ruleta-opcion").dataset.indice)];
    opcion.casillas = Math.max(1, Math.min(MAX_CASILLAS, casillasDe(opcion) + (cambio.classList.contains("ruleta-mas") ? 1 : -1)));
    guardar();
    olvidarResultado();
    pintarOpciones();
    pintarRueda();
  });

  // Lo que se añade: texto, un Pokémon (su retrato) o un objeto (su icono)
  const botonesTipo = vista.querySelectorAll(".ruleta-anadir-tipos button");
  botonesTipo[0].textContent = t("Texto");
  botonesTipo[1].textContent = t("Pokémon");
  botonesTipo[2].textContent = t("Objeto");
  for (const boton of botonesTipo) boton.addEventListener("click", () => cambiarModo(boton.dataset.tipo));

  campoNueva.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    anadirOpcion();
  });
  campoNueva.addEventListener("blur", anadirOpcion);
  vista.querySelector(".ruleta-anadir-boton").addEventListener("click", anadirOpcion);

  vista.querySelector(".ruleta-mezclar").addEventListener("click", () => {
    const opciones = actual().opciones;
    for (let i = opciones.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
    }
    guardar();
    olvidarResultado();
    pintarOpciones();
    pintarRueda();
  });

  vista.querySelector(".ruleta-vaciar").addEventListener("click", async () => {
    if (!actual().opciones.length || !(await confirmar(t("¿Quitar todas las opciones de esta ruleta?")))) return;
    actual().opciones = [];
    guardar();
    olvidarResultado();
    pintarOpciones();
    pintarRueda();
  });

  resultado.addEventListener("click", (e) => {
    if (e.target.closest(".ruleta-otra")) girar();
    // Cerrar: la ruleta como antes de tirar (sin la ganadora resaltada), sin tirar ni quitar nada
    if (e.target.closest(".ruleta-cerrar-resultado")) {
      olvidarResultado();
      pintarRueda();
    }
    const quitar = e.target.closest(".ruleta-quitar-ganadora");
    if (quitar) quitarOpcion(Number(quitar.dataset.casilla));
  });

  pintarTodo();
}

export function mostrar() {
  // Si ha cambiado en otro sitio (otra pestaña, la nube), se vuelve a leer; girando no se toca
  if (girando) return;
  estado = guardado();
  pintarTodo();
}
