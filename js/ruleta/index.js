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

const CLAVE = "poketeams-ruletas-v1";
const MAX_RULETAS = 20;
const MAX_OPCIONES = 60;
const MAX_HISTORIAL = 8;

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

  const paso = 360 / total;
  // Cada texto va del borde hacia el centro, hasta el botón. La letra, lo más grande que deje
  // el ancho de la casilla y, si el texto es largo, más pequeña para que quepa entero (hasta
  // un mínimo: de ahí para abajo, se corta).
  const largo = RADIO - 8 - RADIO * 0.27;
  const tamanoMaximo = Math.min(10, ((2 * Math.PI * RADIO * 0.6) / total) * 0.7);
  const medidas = (texto) => {
    const tamano = Math.max(Math.min(4.5, tamanoMaximo), Math.min(tamanoMaximo, largo / (texto.length * 0.58)));
    return { tamano, caben: Math.floor(largo / (tamano * 0.58) + 0.01) }; // +0.01: que 12,9999 no se quede en 12
  };

  rueda.innerHTML = opciones
    .map(({ texto }, i) => {
      const { tamano, caben } = medidas(texto);
      const color = colorDe(opciones, i);
      const forma = total === 1
        ? `<circle r="${RADIO}" fill="${color}"/>`
        : `<path d="M0 0 L${punto(i * paso, RADIO)} A${RADIO} ${RADIO} 0 ${paso > 180 ? 1 : 0} 1 ${punto((i + 1) * paso, RADIO)}Z" fill="${color}"/>`;
      const medio = i * paso + paso / 2;
      return `
        <g class="ruleta-casilla ${ganadora === null ? "" : ganadora === i ? "ganadora" : "apagada"}">
          ${forma}
          <text transform="rotate(${(medio - 90).toFixed(2)})" x="${RADIO - 8}" y="0" text-anchor="end"
                dominant-baseline="central" font-size="${tamano.toFixed(1)}"
                fill="${textoSobre(color)}">${escaparHTML(recortar(texto, caben))}</text>
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

function duracion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 5500;
}

function girar() {
  const opciones = actual().opciones;
  if (girando || !opciones.length) return;

  const total = opciones.length;
  const paso = 360 / total;
  const casilla = Math.floor(azar() * total);
  // Un punto al azar dentro de la casilla, sin pegarse a los bordes
  const angulo = (casilla + 0.12 + azar() * 0.76) * paso;

  // Para que ese punto quede arriba hay que girar hasta -angulo; más unas cuantas vueltas
  const ahora = ((rotacion % 360) + 360) % 360;
  const destino = (360 - angulo) % 360;
  rotacion += (5 + Math.floor(azar() * 3)) * 360 + ((destino - ahora + 360) % 360);

  girando = true;
  ganadora = null;
  const texto = opciones[casilla].texto;
  pintarRueda();
  resultado.classList.add("oculto");
  vista.classList.add("girando");
  botonGirar.disabled = true;
  for (const campo of vista.querySelectorAll(".ruleta-panel input, .ruleta-panel button")) campo.disabled = true;

  const tiempo = duracion();
  rueda.style.transition = `transform ${tiempo}ms cubic-bezier(0.12, 0.8, 0.18, 1)`;
  rueda.style.transform = `rotate(${rotacion}deg)`;
  contextoAudio(); // en la misma pulsación, para que el navegador deje sonar
  sonarGiro(total);
  setTimeout(() => terminar(casilla, texto), tiempo + 80);
}

function terminar(casilla, texto) {
  girando = false;
  ganadora = casilla;
  vista.classList.remove("girando");
  botonGirar.disabled = false;
  for (const campo of vista.querySelectorAll(".ruleta-panel input, .ruleta-panel button")) campo.disabled = false;

  historial.unshift({ texto, ruleta: actual().nombre });
  historial.splice(MAX_HISTORIAL);
  tilin();
  sumarContador("ruleta"); // para los logros

  pintarRueda();
  pintarHistorial();
  resultado.innerHTML = `
    <span class="ruleta-resultado-etiqueta">${t("Ha salido")}</span>
    <strong class="ruleta-resultado-texto">${escaparHTML(texto)}</strong>
    <div class="ruleta-resultado-botones">
      <button class="ruleta-otra">${icono("ruleta")} ${t("Otra vez")}</button>
      <button class="ruleta-quitar-ganadora" data-casilla="${casilla}">${icono("aspa")} ${t("Quitarla de la ruleta")}</button>
    </div>`;
  resultado.classList.remove("oculto");
  // Oculto no desaparece (guarda su hueco, ver ruleta.css): la animación de salir, a mano
  resultado.style.animation = "none";
  void resultado.offsetWidth;
  resultado.style.animation = "";
}

// ---------- Opciones ----------

function pintarOpciones() {
  const opciones = actual().opciones;
  listaOpciones.innerHTML = opciones
    .map(
      ({ texto }, i) => `
        <div class="ruleta-opcion" data-indice="${i}">
          <label class="ruleta-color" title="${t("Cambiar el color")}" style="background:${colorDe(opciones, i)}">
            <input type="color" class="ruleta-elegir-color" value="${colorDe(opciones, i)}">
          </label>
          <input type="text" class="ruleta-texto" maxlength="40" autocomplete="off" value="${escaparHTML(texto)}">
          <button class="ruleta-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
        </div>`
    )
    .join("");
  cajaNueva.hidden = opciones.length >= MAX_OPCIONES;
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
    .map((tirada) => `<li><strong>${escaparHTML(tirada.texto)}</strong> <small>${escaparHTML(tirada.ruleta)}</small></li>`)
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

function anadirOpcion() {
  const texto = campoNueva.value.trim();
  const opciones = actual().opciones;
  if (!texto || opciones.length >= MAX_OPCIONES) return;
  opciones.push({ texto });
  campoNueva.value = "";
  guardar();
  olvidarResultado();
  pintarOpciones();
  pintarRueda();
  if (!cajaNueva.hidden) campoNueva.focus();
}

function quitarOpcion(indice) {
  actual().opciones.splice(indice, 1);
  guardar();
  olvidarResultado();
  pintarOpciones();
  pintarRueda();
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
    if (boton) quitarOpcion(Number(boton.closest(".ruleta-opcion").dataset.indice));
  });

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
