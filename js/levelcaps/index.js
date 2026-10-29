// Sección «Level caps»: combates importantes de cada juego con el nivel máximo permitido.
// Los combates de cada juego están en ./datos.js y sus retratos en ./retratos.js.
//
// En «Personalizado» cada uno se hace los suyos (js/comun/personalizados.js). Con «Editar»
// la misma lista pasa a tener casillas: título, nombre, lugar, nivel e imagen (un personaje
// de la web o una subida), y botones para moverlos, quitarlos y añadir más.

import { COMBATES, textoDeCombate, claveCombate } from "./datos.js";
import { retratoDeLaWeb } from "./retratos.js";
import { abrirElegirImagen } from "./elegir-imagen.js";
import { crearSelectorJuego, CLAVE_MULTIPLICADOR_CAPS } from "../comun/selector-juego.js";
import { leer, escribir } from "../comun/almacen.js";
import { imagenConRespaldo } from "../comun/imagenes.js";
import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { campoNumero } from "../comun/numero.js";
import { capsPropios, tipoDeCombate, MAX_COMBATES } from "../comun/personalizados.js";
import { apuntarEnLockesDelJuego } from "../comun/lockes.js";
import { medallasDelJuego } from "../comun/medallas.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";

function retrato(c, clase = "cap-retrato") {
  const url = juego.propio ? c.imagen : retratoDeLaWeb(juego.id, c.nombre);
  if (!url) return "";
  return imagenConRespaldo([url], `class="${clase}" alt="" loading="lazy" data-quitar-si-falla`);
}

// NO cambiar estas claves: si se cambian, se pierden los combates marcados como superados
const CLAVE_SUPERADOS = "poketeams-levelcaps-v2"; // { idJuego: [claveCombate, ...] }
const CLAVE_JUEGO = "poketeams-levelcaps-juego-v1";
const CLAVE_MULTIPLICADOR = CLAVE_MULTIPLICADOR_CAPS; // { idJuego: 1.5, ... }

// Multiplicador de nivel (randomizers que suben el nivel de los entrenadores)
const MULTIPLICADOR_MIN = 0.5;
const MULTIPLICADOR_MAX = 3;
const MULTIPLICADOR_PASO = 0.1;

const vista = document.getElementById("vista-levelcaps");
const selector = vista.querySelector(".selector-juego");
const barra = vista.querySelector(".barra-nuzlocke");
const resumen = vista.querySelector(".caps-resumen");
const lista = vista.querySelector(".caps-lista");
const valorMultiplicador = vista.querySelector(".multiplicador-valor");
const editar = vista.querySelector(".juego-editar");

let juego = null;
let combates = [];
let superados = new Set();
let multiplicador = 1;
const guardados = leer(CLAVE_SUPERADOS, {});
const multiplicadores = leer(CLAVE_MULTIPLICADOR, {});

let editando = false;       // la lista propia abierta, con casillas para cambiarla
let abrirEditando = false;  // la próxima lista que se abra, ya en modo editar (al crearla)
let callado = false;        // guardando desde el editor: no se vuelve a pintar (se perdería el foco)

// Nivel con el multiplicador aplicado (redondeado y como mucho 100)
function nivel(c) {
  return Math.min(100, Math.round(c.nivel * multiplicador));
}

function textoNivel(c) {
  return c.aprox ? `≈${nivel(c)}` : String(nivel(c));
}

function tituloNivel(c) {
  const partes = [];
  if (multiplicador !== 1) partes.push(t("Nivel original: {nivel}", { nivel: c.nivel }));
  if (c.aprox) partes.push(t("Nivel aproximado, sin verificar del todo"));
  return partes.length ? `title="${partes.join(". ")}"` : "";
}

function pintarMultiplicador() {
  // Con un decimal, salvo los de un randomizer (×1,05)
  const decimales = Math.abs(multiplicador * 10 - Math.round(multiplicador * 10)) < 1e-9 ? 1 : 2;
  valorMultiplicador.textContent = `×${multiplicador.toFixed(decimales)}`;
}

function cambiarMultiplicador(paso) {
  // Se redondea a un decimal para que no se acumulen errores (1.1 + 0.1 = 1.2000000000000002)
  const nuevo = Math.round((multiplicador + paso) * 10) / 10;
  multiplicador = Math.min(MULTIPLICADOR_MAX, Math.max(MULTIPLICADOR_MIN, nuevo));
  multiplicadores[juego.id] = multiplicador;
  escribir(CLAVE_MULTIPLICADOR, multiplicadores);
  pintarMultiplicador();
  pintarLista();
}

// ---------- Medallas ----------
//
// Las del juego (js/comun/medallas.js), cada una con su gimnasio de la lista: se ven en
// color las de los gimnasios superados. Los personalizados no tienen.

let medallaDe = new Map(); // claveCombate -> { imagen, nombre }

function calcularMedallas() {
  medallaDe = new Map();
  if (!juego || juego.propio) return [];
  const gimnasios = combates.filter((c) => c.tipo === "gimnasio" && !c.seccion);
  return medallasDelJuego(juego.id).map((medalla) => {
    const combate = gimnasios[medalla.gimnasio];
    if (combate) medallaDe.set(claveCombate(combate), medalla);
    return { ...medalla, combate };
  });
}

function imagenMedalla(medalla, clase) {
  return `<img class="${clase}" src="${medalla.imagen}" alt="${escaparHTML(medalla.nombre)}" title="${escaparHTML(medalla.nombre)}" loading="lazy">`;
}

// ---------- Arriba: progreso y medallas ----------

function pintarResumen() {
  // Los combates de secciones aparte (p. ej. líderes de otras regiones) no cuentan
  const propios = combates.filter((c) => !c.seccion);
  resumen.hidden = !propios.length || (juego.propio && editando);
  if (resumen.hidden) return;

  const hechos = propios.filter((c) => superados.has(claveCombate(c))).length;
  const medallas = calcularMedallas().filter((m) => m.combate);
  resumen.querySelector(".caps-progreso").innerHTML = `
    <div class="caps-progreso-texto">
      <span>${hechos === propios.length ? t("¡Has superado todos los combates de este juego!") : t("Progreso")}</span>
      <span>${t("{hechos} de {total} combates", { hechos, total: propios.length })}</span>
    </div>
    <div class="caps-pista"><i style="width: ${(hechos / propios.length) * 100}%"></i></div>`;
  resumen.querySelector(".caps-medallas-fila").innerHTML = medallas
    .map((m) => imagenMedalla(m, `caps-medalla-imagen ${superados.has(claveCombate(m.combate)) ? "ganada" : ""}`))
    .join("");
}

// Todo escapado: los personalizados los escribe la gente. La casilla es el punto del riel; la
// barra enseña el nivel frente al más alto de la lista; el que toca ahora va desplegado.
function filaCombate(c, siguiente, techo) {
  const clave = claveCombate(c);
  const hecho = superados.has(clave);
  const lugar = c.lugar ? ` · <span class="cap-lugar">${escaparHTML(textoDeCombate(c.lugar))}</span>` : "";
  return `
    <li class="cap ${escaparHTML(c.tipo)} ${hecho ? "superado" : ""} ${siguiente ? "siguiente" : ""}">
      <label>
        <input type="checkbox" data-clave="${escaparHTML(clave)}" ${hecho ? "checked" : ""}>
        ${retrato(c) || `<span class="cap-retrato"></span>`}
        <span class="cap-textos">
          ${siguiente ? `<span class="cap-chapa">${t("Próximo combate")}</span>` : ""}
          <span class="cap-etiqueta">${escaparHTML(textoDeCombate(c.etiqueta))}${lugar}</span>
          <span class="cap-nombre">${escaparHTML(textoDeCombate(c.nombre))}</span>
        </span>
        <span class="cap-barra" ${tituloNivel(c)}><i style="width: ${Math.min(100, (nivel(c) / techo) * 100)}%"></i></span>
        <span class="cap-nivel-col">
          ${siguiente ? `<span class="cap-leyenda">${t("Tu level cap")}</span>` : ""}
          <span class="cap-nivel" ${tituloNivel(c)}>${siguiente ? textoNivel(c) : t("Nv. {nivel}", { nivel: textoNivel(c) })}</span>
        </span>
      </label>
    </li>`;
}

// Tramos que llevan su propio título dentro de la lista, al llegar el primer combate de ese tipo
const TRAMOS = { "alto-mando": t("Alto Mando"), campeon: t("Campeón") };

function pintarLista() {
  // Fuera del editor, la ruta
  lista.classList.toggle("caps-ruta", !(juego.propio && editando));
  if (juego.propio && editando) {
    pintarEditor();
    pintarResumen();
    return;
  }

  if (!combates.length) {
    lista.innerHTML = `<li class="caps-vacio">${t("Sin combates.")}</li>`;
    pintarResumen();
    return;
  }

  calcularMedallas(); // la de cada gimnasio, para el resumen de arriba

  // El que toca ahora y el nivel más alto (el 100 % de las barras)
  const siguiente = combates.find((c) => !c.seccion && !superados.has(claveCombate(c)));
  const techo = Math.max(1, ...combates.map(nivel));

  // Primero los combates normales y después, con su título, los de cada sección aparte
  let html = "";
  let tipoAnterior = null;

  for (const c of combates.filter((c) => !c.seccion)) {
    if (TRAMOS[c.tipo] && c.tipo !== tipoAnterior) {
      html += `<li class="caps-tramo ${c.tipo}"><h3>${TRAMOS[c.tipo]}</h3></li>`;
    }
    tipoAnterior = c.tipo;
    html += filaCombate(c, c === siguiente, techo);
  }

  const secciones = [...new Set(combates.filter((c) => c.seccion).map((c) => c.seccion))];
  for (const seccion of secciones) {
    html += `<li class="caps-seccion"><h3>${escaparHTML(textoDeCombate(seccion))}</h3></li>`;
    html += combates.filter((c) => c.seccion === seccion).map((c) => filaCombate(c, false, techo)).join("");
  }

  lista.innerHTML = html;
  pintarResumen();
}

// ---------- Editor de los personalizados ----------
//
// Cada cambio se guarda al momento. Al escribir no se vuelve a pintar (callado), para no
// perder el foco; al mover, quitar o añadir, sí.

function filaEditor(c, indice, total) {
  const valor = (texto) => escaparHTML(texto || "");
  const imagen = c.imagen ? `<img src="${valor(c.imagen)}" alt="">` : icono("imagen");
  return `
    <li class="cap cap-editable ${valor(c.tipo)}" data-indice="${indice}">
      <button class="cap-ed-imagen ${c.imagen ? "con-imagen" : ""}" title="${t("Imagen")}">${imagen}</button>
      <div class="cap-ed-campos">
        <input class="cap-ed-etiqueta" data-campo="etiqueta" maxlength="40" placeholder="${t("Gimnasio 1")}" value="${valor(c.etiqueta)}">
        <input class="cap-ed-nombre" data-campo="nombre" maxlength="40" placeholder="${t("Nombre")}" value="${valor(c.nombre)}">
        <input class="cap-ed-lugar" data-campo="lugar" maxlength="40" placeholder="${t("Ciudad")}" value="${valor(c.lugar)}">
      </div>
      <label class="cap-ed-nivel">
        <span>${t("Nv.")}</span>
        ${campoNumero(`<input data-campo="nivel" type="number" min="1" max="100" value="${c.nivel}">`)}
      </label>
      <div class="cap-ed-acciones">
        <button class="cap-ed-subir" title="${t("Subir")}" ${indice === 0 ? "disabled" : ""}>${icono("arriba")}</button>
        <button class="cap-ed-bajar" title="${t("Bajar")}" ${indice === total - 1 ? "disabled" : ""}>${icono("abajo")}</button>
        <button class="cap-ed-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
      </div>
    </li>`;
}

function pintarEditor() {
  const todos = juego.combates || [];
  lista.innerHTML = `
    <li class="caps-editor-cabecera">
      <input class="caps-ed-nombre" maxlength="40" placeholder="${t("Nombre")}" value="${escaparHTML(juego.nombre)}">
      <button class="caps-ed-borrar">${icono("papelera")} ${t("Borrar")}</button>
    </li>
    ${todos.map((c, indice) => filaEditor(c, indice, todos.length)).join("")}
    ${todos.length < MAX_COMBATES ? `<li><button class="caps-ed-anadir">${icono("mas")} ${t("Añadir combate")}</button></li>` : ""}`;
}

// Devuelve false si no se ha podido (no cabe)
function guardarLista() {
  callado = true;
  const ok = capsPropios.guardar({ id: juego.id, nombre: juego.nombre, combates: juego.combates });
  callado = false;
  return ok;
}

function cambiarCombates(cambio) {
  const todos = [...juego.combates];
  cambio(todos);
  juego.combates = todos;
  guardarLista();
  pintarLista();
}

function anadirCombate() {
  const ultimo = juego.combates[juego.combates.length - 1];
  cambiarCombates((todos) => todos.push({ etiqueta: "", nombre: "", lugar: "", nivel: ultimo ? ultimo.nivel : 10, imagen: "" }));
  const filas = lista.querySelectorAll(".cap-editable");
  if (filas.length) filas[filas.length - 1].querySelector(".cap-ed-etiqueta").focus();
}

function elegirImagen(indice) {
  abrirElegirImagen(Boolean(juego.combates[indice].imagen), (imagen, nombre) => {
    const combate = juego.combates[indice];
    const antes = { ...combate };
    combate.imagen = imagen;
    if (nombre && !combate.nombre) combate.nombre = nombre;
    if (!guardarLista()) {
      Object.assign(combate, antes);
      return false;
    }
    pintarLista();
    return true;
  });
}

function activarEditor() {
  lista.addEventListener("input", (e) => {
    if (!juego || !juego.propio || !editando) return;

    if (e.target.classList.contains("caps-ed-nombre")) {
      if (!e.target.value.trim()) return; // sin nombre no se guarda (al salir vuelve el de antes)
      juego.nombre = e.target.value;
      guardarLista();
      return;
    }

    const campo = e.target.dataset.campo;
    const fila = e.target.closest(".cap-editable");
    if (!campo || !fila) return;
    const combate = juego.combates[Number(fila.dataset.indice)];
    combate[campo] = campo === "nivel" ? Number(e.target.value) || 1 : e.target.value;
    if (campo === "etiqueta") {
      fila.classList.remove(combate.tipo);
      combate.tipo = tipoDeCombate(combate.etiqueta);
      fila.classList.add(combate.tipo);
    }
    guardarLista();
    combates = visibles();
    pintarResumen();
  });

  // Al salir de la casilla: el nivel dentro de 1-100 y el nombre de la lista, nunca vacío
  lista.addEventListener("change", (e) => {
    if (!juego || !juego.propio || !editando) return;
    if (e.target.dataset.campo === "nivel") {
      e.target.value = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1)));
    }
    if (e.target.classList.contains("caps-ed-nombre") && !e.target.value.trim()) {
      e.target.value = juego.nombre;
    }
  });

  lista.addEventListener("click", async (e) => {
    if (!juego || !juego.propio || !editando) return;
    const boton = e.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("caps-ed-anadir")) {
      anadirCombate();
      return;
    }
    if (boton.classList.contains("caps-ed-borrar")) {
      if (!(await confirmar(t("¿Borrar «{nombre}»?", { nombre: juego.nombre })))) return;
      delete guardados[juego.id];
      delete multiplicadores[juego.id];
      escribir(CLAVE_SUPERADOS, guardados);
      escribir(CLAVE_MULTIPLICADOR, multiplicadores);
      capsPropios.borrar(juego.id);
      return;
    }

    const fila = boton.closest(".cap-editable");
    if (!fila) return;
    const indice = Number(fila.dataset.indice);

    if (boton.classList.contains("cap-ed-imagen")) elegirImagen(indice);
    else if (boton.classList.contains("cap-ed-quitar")) cambiarCombates((todos) => todos.splice(indice, 1));
    else if (boton.classList.contains("cap-ed-subir") || boton.classList.contains("cap-ed-bajar")) {
      const otro = indice + (boton.classList.contains("cap-ed-subir") ? -1 : 1);
      cambiarCombates((todos) => ([todos[indice], todos[otro]] = [todos[otro], todos[indice]]));
      lista.querySelector(`.cap-editable[data-indice="${otro}"] .${boton.classList[0]}`)?.focus();
    }
  });
}

// ---------- Al marcar un combate, que se vea el cambio ----------
//
// Se vuelve a pintar todo, así que antes se apunta cómo estaba (el alto de cada fila, la barra
// de progreso, dónde estaba el marco del próximo combate y qué medallas había) y después se
// anima de eso a lo nuevo: el marco baja deslizándose al siguiente mientras su fila se abre y la
// del anterior se cierra, la barra avanza y la medalla ganada se colorea.

function fotoAntes() {
  const filas = new Map();
  for (const casilla of lista.querySelectorAll("input[data-clave]")) {
    filas.set(casilla.dataset.clave, casilla.closest(".cap").offsetHeight);
  }
  const pista = resumen.querySelector(".caps-pista i");
  const medallas = new Map([...resumen.querySelectorAll(".caps-medalla-imagen")].map((m) => [m.title, m.classList.contains("ganada")]));
  const siguiente = lista.querySelector(".cap.siguiente");
  return { filas, ancho: pista ? pista.style.width : "", medallas, marco: siguiente && medirFila(siguiente) };
}

function medirFila(fila) {
  return { arriba: fila.offsetTop, izquierda: fila.offsetLeft, alto: fila.offsetHeight, ancho: fila.offsetWidth };
}

// Una copia del marco (su fondo y su sombra) viaja de donde estaba al nuevo próximo combate,
// siguiéndolo fotograma a fotograma mientras su fila cambia de alto. Mientras, la fila nueva no
// pinta el suyo (.marco-llegando)
function moverMarco(desde, fila, duracion) {
  const estilo = getComputedStyle(fila);
  const marco = document.createElement("li");
  marco.className = "caps-marco";
  marco.setAttribute("aria-hidden", "true");
  marco.style.background = estilo.backgroundColor;
  marco.style.boxShadow = estilo.boxShadow;
  marco.style.borderRadius = estilo.borderRadius;
  lista.prepend(marco); // primero: las filas se pintan por encima
  fila.classList.add("marco-llegando");

  const inicio = performance.now();
  const suavizar = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  const mezclar = (a, b, x) => a + (b - a) * x;
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / duracion);
    if (!marco.isConnected || avance >= 1) {
      marco.remove();
      fila.classList.remove("marco-llegando");
      return;
    }
    const x = suavizar(avance);
    const hasta = medirFila(fila);
    marco.style.top = `${mezclar(desde.arriba, hasta.arriba, x)}px`;
    marco.style.left = `${mezclar(desde.izquierda, hasta.izquierda, x)}px`;
    marco.style.height = `${mezclar(desde.alto, hasta.alto, x)}px`;
    marco.style.width = `${mezclar(desde.ancho, hasta.ancho, x)}px`;
    requestAnimationFrame(paso);
  };
  paso(inicio);
}

function animarCambio(antes) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const suave = { duration: 320, easing: "ease-in-out" };

  // Solo el alto de las filas que cambian: las de debajo se mueven solas con ellas
  for (const casilla of lista.querySelectorAll("input[data-clave]")) {
    const fila = casilla.closest(".cap");
    const altoAntes = antes.filas.get(casilla.dataset.clave);
    if (altoAntes === undefined || Math.abs(altoAntes - fila.offsetHeight) < 1) continue;
    fila.style.overflow = "hidden";
    fila.animate([{ height: `${altoAntes}px` }, { height: `${fila.offsetHeight}px` }], suave).onfinish = () => {
      fila.style.overflow = "";
    };
  }

  const siguiente = lista.querySelector(".cap.siguiente");
  if (antes.marco && siguiente && Math.abs(antes.marco.arriba - siguiente.offsetTop) > 1) moverMarco(antes.marco, siguiente, suave.duration);

  const pista = resumen.querySelector(".caps-pista i");
  if (pista && antes.ancho && antes.ancho !== pista.style.width) {
    pista.animate([{ width: antes.ancho }, { width: pista.style.width }], suave);
  }

  // La medalla recién ganada pasa de gris a su color con un saltito; la que se pierde, a gris
  for (const medalla of resumen.querySelectorAll(".caps-medalla-imagen")) {
    const ganada = medalla.classList.contains("ganada");
    if (!antes.medallas.has(medalla.title) || antes.medallas.get(medalla.title) === ganada) continue;
    if (ganada) {
      medalla.animate(
        [
          { filter: "grayscale(1) opacity(0.35)", transform: "scale(1)" },
          { filter: "grayscale(0) opacity(1)", transform: "scale(1.3)", offset: 0.55 },
          { transform: "scale(1)" }
        ],
        { duration: 550, easing: "ease-out" }
      );
    } else {
      medalla.animate([{ filter: "grayscale(0) opacity(1)" }, {}], { duration: 300, easing: "ease-out" });
    }
  }
}

// ---------- Arranque ----------

export function iniciar() {
  // Un solo oyente para todas las casillas
  lista.addEventListener("change", (e) => {
    const casilla = e.target.closest("input[data-clave]");
    if (!casilla) return;
    if (casilla.checked) superados.add(casilla.dataset.clave);
    else superados.delete(casilla.dataset.clave);

    // Lo de los otros juegos, como esté ahora (las medallas de una partida marcan desde fuera)
    Object.assign(guardados, leer(CLAVE_SUPERADOS, {}) || {});
    guardados[juego.id] = [...superados];
    escribir(CLAVE_SUPERADOS, guardados);
    const antes = fotoAntes();
    pintarLista(); // cambia quién es el próximo, el progreso y las medallas
    animarCambio(antes);

    // A la actividad de tus lockes de este juego («ha vencido a Brock»)
    const combate = combates.find((c) => claveCombate(c) === casilla.dataset.clave);
    const quien = combate ? combate.nombre || combate.etiqueta : "";
    if (quien) {
      apuntarEnLockesDelJuego("capsPropios", juego.id, "cap", quien, casilla.checked).catch((error) => console.error(error));
    }
  });

  activarEditor();

  vista.querySelector(".caps-reiniciar").addEventListener("click", async () => {
    if (superados.size === 0) return;
    if (!(await confirmar(t("¿Desmarcar todos los combates de {juego}?", { juego: juego.nombre })))) return;
    superados.clear();
    guardados[juego.id] = [];
    escribir(CLAVE_SUPERADOS, guardados);
    pintarLista();
  });

  vista.querySelector(".multiplicador-menos").addEventListener("click", () => cambiarMultiplicador(-MULTIPLICADOR_PASO));
  vista.querySelector(".multiplicador-mas").addEventListener("click", () => cambiarMultiplicador(MULTIPLICADOR_PASO));

  editar.addEventListener("click", () => {
    editando = !editando;
    pintarBotonEditar();
    pintarLista();
  });

  selectorJuego = crearSelectorJuego(selector, CLAVE_JUEGO, elegirJuego, {
    almacen: capsPropios,
    alNuevo() {
      const nueva = capsPropios.crear(t("Nuevo juego"));
      if (!nueva) {
        avisar(t("Has llegado al máximo de listas personalizadas."));
        return;
      }
      abrirEditando = true;
      selectorJuego.elegirPorId(nueva.id);
      const nombre = lista.querySelector(".caps-ed-nombre");
      if (nombre) nombre.select();
    }
  });
}

let selectorJuego = null;

// Los personalizados sin título ni nombre (recién añadidos) no salen fuera del editor
function visibles() {
  if (!juego) return [];
  if (!juego.propio) return COMBATES[juego.id] || [];
  return (juego.combates || []).filter((c) => c.etiqueta || c.nombre);
}

function pintarBotonEditar() {
  editar.hidden = !juego || !juego.propio;
  editar.textContent = editando ? t("Listo") : t("Editar");
  editar.classList.toggle("activo", editando);
}

function elegirJuego(nuevo) {
  const mismo = Boolean(juego && nuevo && juego.id === nuevo.id);
  juego = nuevo;
  if (callado) {
    combates = visibles();
    return;
  }

  if (!mismo) editando = abrirEditando;
  abrirEditando = false;

  barra.hidden = !juego;
  pintarBotonEditar();
  if (!juego) {
    lista.innerHTML = "";
    resumen.hidden = true;
    return;
  }

  combates = visibles();
  superados = new Set(guardados[juego.id] || []);
  multiplicador = multiplicadores[juego.id] || 1;
  pintarMultiplicador();
  pintarLista();
}

export function mostrar() {
  // Las medallas de una partida vinculada pueden haber marcado gimnasios desde fuera
  for (const clave of Object.keys(guardados)) delete guardados[clave];
  Object.assign(guardados, leer(CLAVE_SUPERADOS, {}) || {});
  // Si se ha llegado desde un locke de «Lockes», el juego viene apuntado en CLAVE_JUEGO.
  // Si es el mismo que ya había, no hace nada.
  selectorJuego.elegirPorId(leer(CLAVE_JUEGO, null));
  const ahora = juego ? guardados[juego.id] || [] : [];
  if (juego && !editando && (ahora.length !== superados.size || ahora.some((clave) => !superados.has(clave)))) {
    superados = new Set(ahora);
    pintarLista();
  }
  // Un locke con randomizer puede haber cambiado el multiplicador desde fuera
  for (const clave of Object.keys(multiplicadores)) delete multiplicadores[clave];
  Object.assign(multiplicadores, leer(CLAVE_MULTIPLICADOR, {}));
  const impuesto = juego && (multiplicadores[juego.id] || 1);
  if (juego && impuesto !== multiplicador) {
    multiplicador = impuesto;
    pintarMultiplicador();
    pintarLista();
  }
}
