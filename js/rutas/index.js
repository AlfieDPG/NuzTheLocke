// Sección «Rutas»: marcar los lugares donde ya se ha hecho la captura del Nuzlocke.
// Los lugares de cada juego están en ./datos.js.
//
// En «Personalizado» cada uno se hace los suyos (js/comun/personalizados.js). Con «Editar»
// la misma lista pasa a tener casillas: apartados con su título, lugares que se quitan con
// la X y se añaden escribiéndolos (con los de la web como sugerencia) o copiando de golpe
// los de un juego de la web.

import { LUGARES, lugaresDelJuego, nombreDeLugar } from "./datos.js";
import { crearSelectorJuego, CLAVE_HIERBA_RUTAS } from "../comun/selector-juego.js";
import { leer, escribir } from "../comun/almacen.js";
import { quitarAcentos, escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { activarAutocompletado } from "../comun/autocompletado.js";
import { JUEGOS } from "../comun/juegos.js";
import {
  rutasPropias, lugaresDe, seccionesDeLaWeb, lugaresDeLaWeb, MAX_LUGARES
} from "../comun/personalizados.js";
import { apuntarEnLockesDelJuego } from "../comun/lockes.js";
import { plantillaCaptura, abrirCaptura, iniciarCapturas, quitarCaptura, quitarCapturasDelJuego, capturaDe } from "./capturas.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";

// NO cambiar estas claves: si se cambian, se pierden las rutas marcadas
const CLAVE_MARCADAS = "poketeams-rutas-v2"; // { idJuego: ["rutas:Ruta 1", ...] }
const CLAVE_JUEGO = "poketeams-rutas-juego-v1";

// Apartados en el orden en que se muestran. Si un juego no tiene alguno (p. ej. postgame), no sale.
const APARTADOS = [
  { clave: "rutas", titulo: "Rutas" },
  { clave: "ciudades", titulo: "Ciudades y pueblos" },
  { clave: "postgame", titulo: "Postgame" },
  { clave: "eventos", titulo: "Pokémon de evento" }
];

const vista = document.getElementById("vista-rutas");
const selector = vista.querySelector(".selector-juego");
const barra = vista.querySelector(".barra-nuzlocke");
const lista = vista.querySelector(".rutas-lista");
const buscador = vista.querySelector(".rutas-buscar");
const progreso = vista.querySelector(".rutas-progreso");
const editar = vista.querySelector(".juego-editar");

let juego = null;   // { id, nombre, region } (los propios llevan además sus secciones)
let lugares = null; // { rutas, ciudades, postgame, eventos } del juego actual
let usadas = new Set();
// Se vuelve a leer al abrir la sección: la partida vinculada a un locke también marca
// (js/partida/rutas.js)
let marcadas = leer(CLAVE_MARCADAS, {});
// Juegos con los pueblos con hierba del randomizer (los apunta un locke al abrir sus Rutas)
let hierba = leer(CLAVE_HIERBA_RUTAS, {}) || {};

let editando = false;       // la lista propia abierta, con casillas para cambiarla
let abrirEditando = false;  // la próxima lista que se abra, ya en modo editar (al crearla)
let callado = false;        // guardando desde el editor: no se vuelve a pintar (se perdería el foco)

function claveLugar(apartado, texto) {
  return `${apartado}:${texto}`;
}

// Apartados del juego actual: los suyos propios (p. ej. islas de Alola) o los normales
function apartadosDelJuego() {
  return (lugares.apartados || APARTADOS).filter((a) => (lugares[a.clave] || []).length > 0);
}

function guardar() {
  marcadas[juego.id] = [...usadas];
  escribir(CLAVE_MARCADAS, marcadas);
}

function pintarProgreso() {
  const total = apartadosDelJuego().reduce((suma, a) => suma + lugares[a.clave].length, 0);
  progreso.textContent = t("Usadas: {n} / {total}", { n: usadas.size, total });
}

function botonLugar(apartado, texto) {
  const clave = claveLugar(apartado, texto);
  const usada = usadas.has(clave);

  // Eventos: "Lugar: detalle" -> lugar en negrita y detalle debajo. En los personalizados,
  // cualquier lugar escrito así (al copiar uno de la web, los eventos vienen así).
  // Todo escapado: los personalizados los escribe la gente.
  // (Se enseña en el idioma de la web; la clave y lo guardado, en español)
  const visible = nombreDeLugar(texto);
  const corte = apartado === "eventos" || juego.propio ? visible.indexOf(": ") : -1;
  const evento = apartado === "eventos" || corte > 0;
  const contenido = corte > 0
    ? `<span class="ruta-lugar">${escaparHTML(visible.slice(0, corte))}</span><span class="ruta-detalle">${escaparHTML(visible.slice(corte + 2))}</span>`
    : `<span class="ruta-lugar">${escaparHTML(visible)}</span>`;

  // Marcado: qué cogiste ahí (solo lo ves tú, ver ./capturas.js), con su retrato a la
  // izquierda y el mote debajo del lugar. Sin marcar, el hueco del retrato vacío: así la
  // tarjeta mide lo mismo y al marcarla no se mueve nada.
  const captura = usada ? capturaDe(juego.id, clave) : null;
  // Sin captura («No la conseguí», ver ./capturas.js): una ✗ y «Sin captura» en vez del mote
  const fallada = Boolean(captura && captura.fallada);
  const mote = fallada
    ? `<span class="ruta-mote">${t("Sin captura")}</span>`
    : captura && captura.mote ? `<span class="ruta-mote">${escaparHTML(captura.mote)}</span>` : "";
  return `<button class="ruta ${evento ? "evento" : ""} ${usada ? "usada" : ""} ${fallada ? "fallada" : ""}" aria-pressed="${usada}"
    data-clave="${escaparHTML(clave)}" data-buscar="${escaparHTML(quitarAcentos(visible === texto ? texto : `${texto} ${visible}`))}">${
      usada ? plantillaCaptura(juego.id, clave) : `<span class="ruta-hueco"></span>`
    }<span class="ruta-textos">${contenido}${mote}</span></button>`;
}

// «rutas:Ruta 3» -> «Ruta 3»; en los eventos, solo el lugar («Lugar: detalle»)
function nombreDelLugar(clave) {
  const texto = clave.slice(clave.indexOf(":") + 1);
  const corte = texto.indexOf(": ");
  return corte > 0 ? texto.slice(0, corte) : texto;
}

function pintarLista() {
  buscador.hidden = editando;
  if (juego.propio && editando) {
    pintarEditor();
    pintarProgreso();
    return;
  }

  if (!apartadosDelJuego().length) {
    lista.innerHTML = `<p class="rutas-vacio">${t("Sin lugares.")}</p>`;
    pintarProgreso();
    return;
  }

  lista.innerHTML = apartadosDelJuego()
    .map(
      (a) => `
        <section class="rutas-grupo ${a.clave}">
          <h3>${escaparHTML(t(a.titulo))}</h3>
          <div class="rutas-botones ${a.clave}">${lugares[a.clave].map((texto) => botonLugar(a.clave, texto)).join("")}</div>
        </section>`
    )
    .join("");

  filtrar();
  pintarProgreso();
}

// Oculta los lugares que no coinciden con lo escrito en el buscador
function filtrar() {
  const texto = quitarAcentos(buscador.value.trim());

  for (const boton of lista.querySelectorAll(".ruta")) {
    boton.hidden = Boolean(texto) && !boton.dataset.buscar.includes(texto);
  }
  for (const grupo of lista.querySelectorAll(".rutas-grupo")) {
    grupo.hidden = !grupo.querySelector(".ruta:not([hidden])");
  }
  ajustarAnchos();
}

// ---------- Cada tarjeta, del ancho de su nombre ----------
//
// El nombre (y el detalle de los eventos, en la suya) va en una sola línea y cada tarjeta
// mide lo que su texto y el retrato (o su hueco); el CSS estira cada fila hasta llenar el
// ancho. Se mide sin estirar (clase rutas-midiendo) y se guarda en su flex-basis, para que
// marcar una no mueva nada. En «em»: la letra de la web cambia con la ventana y así crece con ella sin
// volver a medir. Si ni así cabe (un móvil muy estrecho), el CSS lo corta con «...».

function ajustarAnchos() {
  if (!lista.offsetWidth) return; // la sección está escondida: se hará al volver
  const sinMedir = [...lista.querySelectorAll(".ruta:not([hidden])")].filter((boton) => !boton.style.flexBasis);
  if (!sinMedir.length) return;
  lista.classList.add("rutas-midiendo");
  const anchos = sinMedir.map((boton) => boton.getBoundingClientRect().width / parseFloat(getComputedStyle(boton).fontSize));
  lista.classList.remove("rutas-midiendo");
  // + un pelín, que al redondear no se coma la última letra
  sinMedir.forEach((boton, i) => (boton.style.flexBasis = `${(anchos[i] + 0.1).toFixed(2)}em`));
}

// Las que estaban escondidas (otra sección abierta) se miden al volver
const vigilante = new ResizeObserver(() => {
  if (!editando) ajustarAnchos();
});

// ---------- Editor de los personalizados ----------
//
// Cada cambio se guarda al momento. Al escribir un título no se vuelve a pintar (callado),
// para no perder el foco; al añadir o quitar, sí.

function pintarEditor() {
  const secciones = juego.secciones || [];
  const total = secciones.reduce((suma, seccion) => suma + seccion.lugares.length, 0);
  const caben = total < MAX_LUGARES;

  lista.innerHTML = `
    <div class="rutas-editor-cabecera">
      <input class="rutas-ed-nombre" maxlength="40" placeholder="${t("Nombre")}" value="${escaparHTML(juego.nombre)}">
      <select class="rutas-ed-copiar" ${caben ? "" : "disabled"}>
        <option value="">${t("Copiar lugares de...")}</option>
        ${JUEGOS.filter((cada) => LUGARES[cada.id]).map((cada) => `<option value="${cada.id}">${escaparHTML(cada.nombre)}</option>`).join("")}
      </select>
      <button class="rutas-ed-borrar">${icono("papelera")} ${t("Borrar")}</button>
    </div>
    ${secciones
      .map(
        (seccion, indice) => `
          <section class="rutas-grupo rutas-ed-grupo" data-seccion="${indice}">
            <h3>
              <input class="rutas-ed-apartado" maxlength="40" placeholder="${t("Apartado")}" value="${escaparHTML(seccion.titulo)}">
              <button class="rutas-ed-quitar-apartado" title="${t("Quitar apartado")}">${icono("aspa")}</button>
            </h3>
            <div class="rutas-botones">
              ${seccion.lugares
                .map(
                  (lugar, posicion) => `
                    <span class="ruta-ed" data-lugar="${posicion}">
                      <span>${escaparHTML(nombreDeLugar(lugar))}</span>
                      <button class="ruta-ed-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
                    </span>`
                )
                .join("")}
              ${caben ? `<span class="ruta-ed-nuevo-caja"><input class="ruta-ed-nuevo" maxlength="80" placeholder="${t("Añadir lugar...")}" autocomplete="off"></span>` : ""}
            </div>
          </section>`
      )
      .join("")}
    <button class="rutas-ed-anadir-apartado">${icono("mas")} ${t("Añadir apartado")}</button>`;

  // Sugerencias al escribir un lugar: los de todos los juegos de la web (con la misma lista
  // que el resto de buscadores)
  for (const campo of lista.querySelectorAll(".ruta-ed-nuevo")) {
    activarAutocompletado(campo, lugaresSugeridos(), (entrada) => {
      campo.value = entrada.es;
      anadirLugar(campo);
    }, { libre: true });
  }
}

let sugeridos = null;

function lugaresSugeridos() {
  if (!sugeridos) {
    sugeridos = lugaresDeLaWeb().map((lugar) => {
      const en = nombreDeLugar(lugar);
      return { es: lugar, en, buscar: quitarAcentos(`${lugar} ${en}`) };
    });
  }
  return sugeridos;
}

function guardarLista() {
  callado = true;
  rutasPropias.guardar({ id: juego.id, nombre: juego.nombre, secciones: juego.secciones });
  callado = false;
}

// Cambia una copia de las secciones, guarda y vuelve a pintar
function cambiarSecciones(cambio) {
  const secciones = (juego.secciones || []).map((seccion) => ({ ...seccion, lugares: [...seccion.lugares] }));
  cambio(secciones);
  juego.secciones = secciones;
  guardarLista();
  pintarLista();
}

function anadirLugar(campo) {
  const texto = campo.value.trim();
  if (!texto) return;
  const indice = Number(campo.closest(".rutas-ed-grupo").dataset.seccion);
  cambiarSecciones((secciones) => {
    if (!secciones[indice].lugares.includes(texto)) secciones[indice].lugares.push(texto);
  });
  const otra = lista.querySelector(`.rutas-ed-grupo[data-seccion="${indice}"] .ruta-ed-nuevo`);
  if (otra) otra.focus();
}

// Los apartados de un juego de la web: los que se llamen igual se juntan con los que ya hay
function copiarDe(idJuego) {
  cambiarSecciones((secciones) => {
    for (const deLaWeb of seccionesDeLaWeb(idJuego)) {
      const igual = secciones.find((seccion) => seccion.titulo.trim().toLowerCase() === deLaWeb.titulo.toLowerCase());
      if (igual) igual.lugares.push(...deLaWeb.lugares.filter((lugar) => !igual.lugares.includes(lugar)));
      else secciones.push(deLaWeb);
    }
  });
}

function activarEditor() {
  lista.addEventListener("input", (e) => {
    if (!juego || !juego.propio || !editando) return;
    if (e.target.classList.contains("rutas-ed-nombre")) {
      if (!e.target.value.trim()) return; // sin nombre no se guarda (al salir vuelve el de antes)
      juego.nombre = e.target.value;
      guardarLista();
    } else if (e.target.classList.contains("rutas-ed-apartado")) {
      const indice = Number(e.target.closest(".rutas-ed-grupo").dataset.seccion);
      juego.secciones[indice].titulo = e.target.value;
      guardarLista();
    }
  });

  lista.addEventListener("change", (e) => {
    if (!juego || !juego.propio || !editando) return;
    if (e.target.classList.contains("rutas-ed-nombre") && !e.target.value.trim()) {
      e.target.value = juego.nombre;
    } else if (e.target.classList.contains("rutas-ed-copiar") && e.target.value) {
      copiarDe(e.target.value);
    }
  });

  lista.addEventListener("keydown", (e) => {
    // (Con una sugerencia marcada, ya la ha elegido el autocompletado)
    if (e.key !== "Enter" || e.defaultPrevented || !e.target.classList.contains("ruta-ed-nuevo")) return;
    e.preventDefault();
    anadirLugar(e.target);
  });

  lista.addEventListener("click", async (e) => {
    if (!juego || !juego.propio || !editando) return;
    const boton = e.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("rutas-ed-borrar")) {
      if (!(await confirmar(t("¿Borrar «{nombre}»?", { nombre: juego.nombre })))) return;
      delete marcadas[juego.id];
      escribir(CLAVE_MARCADAS, marcadas);
      rutasPropias.borrar(juego.id);
      return;
    }
    if (boton.classList.contains("rutas-ed-anadir-apartado")) {
      cambiarSecciones((secciones) => secciones.push({ titulo: "", lugares: [] }));
      const titulos = lista.querySelectorAll(".rutas-ed-apartado");
      if (titulos.length) titulos[titulos.length - 1].focus();
      return;
    }

    const grupo = boton.closest(".rutas-ed-grupo");
    if (!grupo) return;
    const indice = Number(grupo.dataset.seccion);

    if (boton.classList.contains("rutas-ed-quitar-apartado")) {
      const seccion = juego.secciones[indice];
      if (seccion.lugares.length && !(await confirmar(t("¿Quitar «{nombre}» y sus {n} lugares?", { nombre: seccion.titulo || t("este apartado"), n: seccion.lugares.length })))) return;
      cambiarSecciones((secciones) => secciones.splice(indice, 1));
    } else if (boton.classList.contains("ruta-ed-quitar")) {
      const posicion = Number(boton.closest(".ruta-ed").dataset.lugar);
      cambiarSecciones((secciones) => secciones[indice].lugares.splice(posicion, 1));
    }
  });
}

// ---------- Arranque ----------

export function iniciar() {
  // Un solo oyente para todos los botones de lugar
  lista.addEventListener("click", (e) => {
    const boton = e.target.closest(".ruta");
    if (!boton) return;
    const clave = boton.dataset.clave;

    // La captura de un lugar marcado: se apunta, no se desmarca
    if (e.target.closest(".ruta-captura")) {
      abrirCaptura(juego.id, clave, nombreDeLugar(nombreDelLugar(clave)));
      return;
    }

    if (usadas.has(clave)) {
      usadas.delete(clave);
      quitarCaptura(juego.id, clave);
    } else usadas.add(clave);
    const apartado = clave.slice(0, clave.indexOf(":"));
    const ancho = boton.style.flexBasis;
    boton.outerHTML = botonLugar(apartado, clave.slice(clave.indexOf(":") + 1));
    lista.querySelector(`.ruta[data-clave="${CSS.escape(clave)}"]`).style.flexBasis = ancho;
    guardar();
    pintarProgreso();

    // A la actividad de tus lockes de este juego («ha capturado en la Ruta 3»)
    apuntarEnLockesDelJuego("rutasPropias", juego.id, "ruta", nombreDelLugar(clave), usadas.has(clave))
      .catch((error) => console.error(error));
  });

  activarEditor();
  iniciarCapturas(() => {
    if (juego && !editando) pintarLista();
  });

  buscador.addEventListener("input", filtrar);
  vigilante.observe(lista);

  vista.querySelector(".rutas-reiniciar").addEventListener("click", async () => {
    if (usadas.size === 0) return;
    if (!(await confirmar(t("¿Desmarcar todos los lugares de {juego}?", { juego: juego.nombre })))) return;
    usadas.clear();
    quitarCapturasDelJuego(juego.id);
    guardar();
    pintarLista();
  });

  editar.addEventListener("click", () => {
    editando = !editando;
    pintarBotonEditar();
    elegirJuego(juego, true);
  });

  selectorJuego = crearSelectorJuego(selector, CLAVE_JUEGO, elegirJuego, {
    almacen: rutasPropias,
    alNuevo() {
      const nueva = rutasPropias.crear(t("Nuevo juego"));
      if (!nueva) {
        avisar(t("Has llegado al máximo de listas personalizadas."));
        return;
      }
      rutasPropias.guardar({ ...nueva, secciones: [{ titulo: t("Rutas"), lugares: [] }] });
      abrirEditando = true;
      selectorJuego.elegirPorId(nueva.id);
      const nombre = lista.querySelector(".rutas-ed-nombre");
      if (nombre) nombre.select();
    }
  });
}

let selectorJuego = null;

function pintarBotonEditar() {
  editar.hidden = !juego || !juego.propio;
  editar.textContent = editando ? t("Listo") : t("Editar");
  editar.classList.toggle("activo", editando);
}

// seguir: es el mismo juego y se vuelve a pintar (al entrar o salir de «Editar»)
function elegirJuego(nuevo, seguir = false) {
  const mismo = Boolean(juego && nuevo && juego.id === nuevo.id);
  juego = nuevo;
  if (callado) {
    lugares = lugaresDe(juego);
    return;
  }

  if (!mismo) editando = abrirEditando;
  abrirEditando = false;

  barra.hidden = !juego;
  pintarBotonEditar();
  if (!juego) {
    lista.innerHTML = "";
    return;
  }

  // (Con la hierba en los pueblos del randomizer, si un locke de este juego la lleva)
  lugares = juego.propio ? lugaresDe(juego) : lugaresDelJuego(juego.id, Boolean(hierba[juego.id]));

  // Solo cuentan las marcas de lugares que siguen existiendo. Si un lugar ha cambiado de
  // apartado (p. ej. de «rutas» a «postgame»), su marca se conserva.
  const porTexto = new Map();
  for (const a of apartadosDelJuego()) {
    for (const texto of lugares[a.clave]) porTexto.set(texto, claveLugar(a.clave, texto));
  }
  usadas = new Set();
  for (const clave of marcadas[juego.id] || []) {
    const texto = clave.slice(clave.indexOf(":") + 1);
    if (porTexto.has(texto)) usadas.add(porTexto.get(texto));
  }

  if (!mismo || !seguir) buscador.value = "";
  pintarLista();
}

export function mostrar() {
  // Si se ha llegado desde un locke de «Lockes», el juego viene apuntado en CLAVE_JUEGO.
  // Si es el mismo que ya había, no hace nada.
  const antes = JSON.stringify([marcadas, hierba]);
  marcadas = leer(CLAVE_MARCADAS, {}) || {};
  hierba = leer(CLAVE_HIERBA_RUTAS, {}) || {};
  const id = leer(CLAVE_JUEGO, null);
  selectorJuego.elegirPorId(id);
  // Mismo juego, pero con marcas nuevas (o los pueblos con hierba) desde fuera: se vuelve a pintar
  if (juego && !editando && JSON.stringify([marcadas, hierba]) !== antes) elegirJuego(juego, true);
}
