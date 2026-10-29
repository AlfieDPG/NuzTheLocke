// Sección «Pokédex»: tabla con las estadísticas base de todos los Pokémon.
//
// Cada columna tiene un botón en su cabecera: la primera vez que se pulsa ordena de
// menor a mayor y, al volver a pulsarlo, de mayor a menor (el nombre, de la A a la Z
// y al revés). Al entrar, la tabla sale ordenada por número de Pokédex.
//
// Para añadir una columna basta con añadirla a COLUMNAS: la cabecera, las celdas y
// la ordenación salen solas.

import { cargarPokedex, RETRATOS, archivoHoja, nombreDeFila } from "./datos.js";
import { cargarDatos } from "../comun/datos.js";
import { imagenConRespaldo, urlsPMD } from "../comun/imagenes.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { quitarAcentos } from "../comun/utilidades.js";
import { abrirEvoluciones, cerrarEvoluciones } from "./evoluciones.js";
import { t, LOCALE, enIngles } from "../comun/idioma.js";
import { icono } from "../comun/iconos.js";
import { activarMenuMas } from "../comun/menu-mas.js";

// "valor" es lo que se usa para ordenar. La columna de la foto no lo tiene, así que no se ordena.
const COLUMNAS = [
  { clave: "numero", titulo: t("Nº"), clase: "col-numero", valor: (p) => p.numero },
  { clave: "foto", titulo: "", clase: "col-foto" },
  { clave: "nombre", titulo: "Pokémon", clase: "col-nombre", valor: (p) => p.visible },
  { clave: "tipos", titulo: "", clase: "col-tipos" },
  { clave: "ps", titulo: t("stat|PS"), clase: "col-dato", valor: (p) => p.bases[0] },
  { clave: "ataque", titulo: t("stat|Ataque"), clase: "col-dato", valor: (p) => p.bases[1] },
  { clave: "defensa", titulo: t("stat|Defensa"), clase: "col-dato", valor: (p) => p.bases[2] },
  { clave: "ataque-especial", titulo: t("stat|At. Esp."), clase: "col-dato", valor: (p) => p.bases[3] },
  { clave: "defensa-especial", titulo: t("stat|Def. Esp."), clase: "col-dato", valor: (p) => p.bases[4] },
  { clave: "velocidad", titulo: t("stat|Velocidad"), clase: "col-dato", valor: (p) => p.bases[5] },
  { clave: "total", titulo: t("Total"), clase: "col-dato col-total", valor: (p) => p.total }
];

const vista = document.getElementById("vista-pokedex");
const aviso = vista.querySelector(".pokedex-aviso");
const barra = vista.querySelector(".barra-pokedex");
const campoBuscar = vista.querySelector(".pokedex-buscar");
const cajaTipo = vista.querySelector(".pokedex-tipo");
const botonTipo = cajaTipo.querySelector(".menu-mas-boton");
const listaTipos = cajaTipo.querySelector(".pokedex-tipo-lista");
const cuentaEl = vista.querySelector(".pokedex-cuenta");
const botonFiltros = vista.querySelector(".pokedex-filtros-boton");
const panelFiltros = vista.querySelector(".pokedex-filtros");
const tabla = vista.querySelector(".tabla-pokedex");
const cabecera = tabla.querySelector("thead");
const cuerpo = tabla.querySelector("tbody");

let pokemon = [];               // lista completa, en el orden en que se está mostrando
const filas = new Map();        // clave -> <tr>, para reordenar sin volver a crear las fotos
let ordenActual = "numero";
let descendente = false;

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

// Retrato de Mundo Misterioso: el de la forma concreta (Mega-Charizard X, Palafin Héroe...)
// y, si Mundo Misterioso no tiene esa forma, el de la especie. Aquí NUNCA se cae a un
// sprite de PokeAPI: en las formas modernas esos son renders 3D y desentonan en la tabla.
//
// A día de hoy solo dos formas no tienen retrato propio y salen con el de su especie:
// Mega Kangaskhan (Mundo Misterioso solo dibujó a la cría) y Calyrex Jinete Espectral.
function foto(p) {
  // Lo normal: su casilla de la hoja de retratos (ver RETRATOS en ./datos.js)
  if (p.retrato >= 0) {
    const porHoja = RETRATOS.columnas * RETRATOS.filasPorHoja;
    const dentro = p.retrato % porHoja;
    const columna = dentro % RETRATOS.columnas;
    const fila = Math.floor(dentro / RETRATOS.columnas);
    const hoja = archivoHoja(Math.floor(p.retrato / porHoja));
    return `<span class="pokedex-foto en-hoja" style="background-image:url(${hoja});--columna:${columna};--fila:${fila}"></span>`;
  }
  if (p.retrato === -1) return ""; // Mundo Misterioso no tiene ninguno

  // Tabla montada sin hoja (desde PokeAPI): uno a uno
  const urls = [
    ...urlsPMD({ id: p.numero, formaPMD: p.forma }),
    ...(p.forma ? urlsPMD({ id: p.numero, formaPMD: 0 }) : [])
  ];
  return imagenConRespaldo(urls, `class="pokedex-foto" alt="" loading="lazy" data-quitar-si-falla`);
}

function numeroDex(id) {
  return String(id).padStart(4, "0");
}

function chipTipo(tipo) {
  return `<span class="chip-tipo" style="background:${coloresTipo[tipo]}" title="${tiposEs[tipo]}">${iconoTipo(tipo)}</span>`;
}

function filaPokemon(p) {
  return `
    <tr>
      <td class="col-numero">${numeroDex(p.numero)}</td>
      <td class="col-foto"><button class="pokedex-evo" data-numero="${p.numero}" data-clave="${p.clave}" title="${t("Línea evolutiva")}">${foto(p)}</button></td>
      <td class="col-nombre">${p.visible}</td>
      <td class="col-tipos">${p.tipos.map(chipTipo).join("")}</td>
      ${p.bases.map((base) => `<td class="col-dato">${base}</td>`).join("")}
      <td class="col-dato col-total">${p.total}</td>
    </tr>`;
}

function celdaCabecera(c) {
  if (!c.valor) return `<th class="${c.clase}"></th>`;

  const activa = c.clave === ordenActual;
  const flecha = activa ? (descendente ? "▼" : "▲") : "↕";
  const sentido = activa && descendente ? t("Ordenar de mayor a menor") : t("Ordenar de menor a mayor");

  return `
    <th class="${c.clase} ${activa ? "ordenada" : ""}">
      <button data-orden="${c.clave}" title="${sentido}">
        ${c.titulo}<span class="flecha">${flecha}</span>
      </button>
    </th>`;
}

function pintarCabecera() {
  cabecera.innerHTML = `<tr>${COLUMNAS.map(celdaCabecera).join("")}</tr>`;
}

// Mueve las filas que ya existen al orden actual: así las fotos no se vuelven a cargar
function pintarFilas() {
  const fragmento = document.createDocumentFragment();
  for (const p of pokemon) fragmento.append(filas.get(p.clave));
  cuerpo.append(fragmento);
}

function comparar(columna) {
  return (a, b) => {
    const valorA = columna.valor(a);
    const valorB = columna.valor(b);
    const diferencia =
      typeof valorA === "string" ? valorA.localeCompare(valorB, LOCALE) : valorA - valorB;

    // Los empates (dos Pokémon con el mismo ataque) se deshacen por el id de PokeAPI, que
    // deja cada especie seguida de sus formas aunque se esté ordenando al revés
    return (descendente ? -diferencia : diferencia) || a.clave - b.clave;
  };
}

function ordenarPor(clave) {
  const columna = COLUMNAS.find((c) => c.clave === clave);
  if (!columna) return;

  // La misma columna otra vez le da la vuelta; una columna nueva empieza de menor a mayor
  if (clave === ordenActual) descendente = !descendente;
  else {
    ordenActual = clave;
    descendente = false;
  }

  pokemon.sort(comparar(columna));
  pintarCabecera();
  pintarFilas();

  // La cabecera se vuelve a crear entera, así que hay que devolver el foco al botón
  // que se acaba de pulsar (si no, no se puede seguir ordenando con el teclado)
  cabecera.querySelector(`[data-orden="${clave}"]`).focus();
}

// ---------- Buscador y filtros ----------

let textoBuscado = "";
let tipoElegido = "";

// El panel de «Filtros» (para que no se llene la barra de desplegables): generación, formas y
// legendarios. Cada grupo, una fila de botones que se marcan y desmarcan (se pueden marcar
// varios: vale cualquiera de ellos, «1ª o 2ª»); el primero, «todos», los desmarca.
const FILTROS = [
  {
    clave: "gen",
    titulo: t("Generación"),
    opciones: [["", t("Todas")], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((gen) => [String(gen), t("gen|{n}ª", { n: gen })])],
    pasa: (p, valor) => String(p.gen) === valor
  },
  {
    clave: "forma",
    titulo: t("Formas"),
    opciones: [["", t("Todas")], ["normal", t("Solo normales")], ["regional", t("Regionales")], ["mega", t("Megas")], ["otra", t("Otras formas")]],
    pasa: (p, valor) => claseDeForma(p) === valor
  },
  {
    clave: "clase",
    titulo: t("Clase"),
    opciones: [["", t("Todos")], ["legendario", t("Legendarios")], ["singular", t("Singulares")], ["bebe", t("Bebés")], ["comun", t("Ni legendarios ni singulares")]],
    pasa: (p, valor) => (valor === "comun" ? p.clase !== "legendario" && p.clase !== "singular" : p.clase === valor)
  }
];

// Los marcados de cada grupo (vacío: todos)
const filtros = { gen: new Set(), forma: new Set(), clase: new Set() };

function claseDeForma(p) {
  if (p.normal || p.clave === p.numero) return "normal";
  if (/\((Alola|Galar|Hisui|Paldea)/.test(p.nombre)) return "regional";
  if (/\((Mega|Primigenia)/.test(p.nombre)) return "mega";
  return "otra";
}

function pasaFiltros(p) {
  if (tipoElegido && !p.tipos.includes(tipoElegido)) return false;
  const noPasa = (filtro) => {
    const marcados = filtros[filtro.clave];
    return marcados.size > 0 && ![...marcados].some((valor) => filtro.pasa(p, valor));
  };
  if (FILTROS.some(noPasa)) return false;
  return !textoBuscado || p.busqueda.includes(textoBuscado);
}

// Lo que se mueve (el panel de filtros, el bocadillo...), solo si no se ha pedido que no
const suave = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

// El panel de filtros se abre bajando poco a poco (y la tabla, con él) y se cierra igual.
// No se anima su alto: con eso la tabla entera (más de mil filas) se volvía a colocar en
// cada fotograma y daba tirones. El panel se pone o se quita de golpe y lo que se anima es
// solo un desplazamiento (transform), que no obliga a recolocar nada: la tabla sale desde
// donde estaba y el panel se descubre de arriba abajo.
let animacionesFiltros = [];

function desplegarFiltros(abrir) {
  botonFiltros.setAttribute("aria-expanded", String(abrir));
  botonFiltros.classList.toggle("abierto", abrir);
  for (const animacion of animacionesFiltros) animacion.cancel();
  animacionesFiltros = [];
  panelFiltros.hidden = false;
  if (!suave()) {
    panelFiltros.hidden = !abrir;
    return;
  }

  const alto = panelFiltros.offsetHeight + parseFloat(getComputedStyle(panelFiltros).marginTop);
  // Al cerrar, todo se queda en su sitio final (fill) hasta quitar el panel: si no, la tabla
  // volvería abajo un fotograma antes de que el panel se fuera
  const opciones = { duration: 220, easing: "ease-in-out", fill: abrir ? "none" : "forwards" };
  const abierto = { transform: "translateY(0)", clipPath: "inset(0 0 0 0)", opacity: 1 };
  const cerrado = { transform: `translateY(${-alto}px)`, clipPath: `inset(${alto}px 0 0 0)`, opacity: 0 };
  const panel = panelFiltros.animate(abrir ? [cerrado, abierto] : [abierto, cerrado], opciones);
  const debajo = tabla.animate(
    abrir ? [{ transform: `translateY(${-alto}px)` }, { transform: "translateY(0)" }] : [{ transform: "translateY(0)" }, { transform: `translateY(${-alto}px)` }],
    opciones
  );
  animacionesFiltros = [panel, debajo];
  // Al cerrar, el panel se quita justo cuando la tabla ha llegado arriba: no se nota el cambio
  if (!abrir) {
    panel.onfinish = () => {
      panelFiltros.hidden = true;
      panel.cancel();
      debajo.cancel();
      animacionesFiltros = [];
    };
  }
}

// El desplegable de los tipos: el elegido en el botón y, en la lista, todos con su icono
function pintarTipo() {
  const opcion = (valor, nombre) => `
    <button data-tipo="${valor}" class="${valor === tipoElegido ? "elegido" : ""}" aria-pressed="${valor === tipoElegido}">
      ${valor ? chipTipo(valor) : `<span class="chip-tipo chip-todos"></span>`}${nombre}
    </button>`;
  listaTipos.innerHTML = opcion("", t("Todos los tipos")) + Object.keys(tiposEs).map((tipo) => opcion(tipo, tiposEs[tipo])).join("");
  botonTipo.innerHTML = `
    ${tipoElegido ? chipTipo(tipoElegido) : ""}
    <span class="pokedex-tipo-nombre">${tipoElegido ? tiposEs[tipoElegido] : t("Todos los tipos")}</span>
    ${icono("abajo")}`;
}

function pintarFiltros() {
  const activos = FILTROS.reduce((suma, filtro) => suma + filtros[filtro.clave].size, 0);
  panelFiltros.innerHTML =
    FILTROS.map(
      (filtro) => `
        <div class="pokedex-filtro">
          <span class="pokedex-filtro-titulo">${filtro.titulo}</span>
          <div class="pokedex-filtro-opciones">
            ${filtro.opciones
              .map(([valor, texto]) => {
                const marcados = filtros[filtro.clave];
                const activa = valor === "" ? marcados.size === 0 : marcados.has(valor);
                return `<button class="${activa ? "activa" : ""}" data-filtro="${filtro.clave}" data-valor="${valor}" aria-pressed="${activa}">${texto}</button>`;
              })
              .join("")}
          </div>
        </div>`
    ).join("") + (activos ? `<button class="pokedex-filtros-quitar">${t("Quitar filtros")}</button>` : "");
  botonFiltros.innerHTML = `${t("Filtros")}${activos ? ` <span class="pokedex-filtros-cuantos">${activos}</span>` : ""}`;
  botonFiltros.classList.toggle("con-filtros", activos > 0);
}

// Se esconden filas en vez de volver a pintarlas: así no se recargan las fotos
function aplicarFiltros() {
  let visibles = 0;

  for (const p of pokemon) {
    const pasa = pasaFiltros(p);
    filas.get(p.clave).hidden = !pasa;
    if (pasa) visibles++;
  }

  cuentaEl.textContent =
    visibles === pokemon.length ? `${visibles} Pokémon` : t("{n} de {total}", { n: visibles, total: pokemon.length });
  tabla.hidden = visibles === 0;
  mostrarAviso(visibles === 0 ? t("Ningún Pokémon coincide con la búsqueda.") : "");
}

function prepararFiltros() {
  activarMenuMas(cajaTipo, "abajo");
  pintarTipo();

  campoBuscar.addEventListener("input", () => {
    textoBuscado = quitarAcentos(campoBuscar.value.trim());
    aplicarFiltros();
  });

  listaTipos.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-tipo]");
    if (!boton) return;
    tipoElegido = boton.dataset.tipo;
    cerrarEvoluciones();
    pintarTipo();
    aplicarFiltros();
  });

  // Abierto o cerrando: lo que diga el botón (el panel sigue a la vista mientras se cierra)
  botonFiltros.addEventListener("click", () => desplegarFiltros(botonFiltros.getAttribute("aria-expanded") !== "true"));

  panelFiltros.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("pokedex-filtros-quitar")) {
      for (const filtro of FILTROS) filtros[filtro.clave].clear();
    } else if (boton.dataset.filtro) {
      const marcados = filtros[boton.dataset.filtro];
      const valor = boton.dataset.valor;
      if (!valor) marcados.clear();
      else if (marcados.has(valor)) marcados.delete(valor);
      else marcados.add(valor);
      // Todos los de un grupo marcados es lo mismo que ninguno
      const filtro = FILTROS.find((cada) => cada.clave === boton.dataset.filtro);
      if (marcados.size === filtro.opciones.length - 1) marcados.clear();
    } else return;
    cerrarEvoluciones();
    pintarFiltros();
    aplicarFiltros();
  });

  pintarFiltros();
}

export async function iniciar() {
  mostrarAviso(t("Cargando la Pokédex (solo tarda la primera vez)..."));

  try {
    pokemon = await cargarPokedex();
    // En inglés, los nombres de las especies (la tabla va en español)
    if (enIngles) await cargarDatos();
  } catch (error) {
    mostrarAviso(t("No he podido cargar la Pokédex. Revisa tu conexión y recarga la página."));
    throw error;
  }

  // Texto por el que se busca: nombre sin acentos y número, para poder buscar "25" o "pikachu"
  // (y en inglés, también por el nombre en inglés)
  for (const p of pokemon) {
    p.visible = nombreDeFila(p);
    p.busqueda = `${quitarAcentos(p.nombre)} ${p.visible === p.nombre ? "" : quitarAcentos(p.visible)} ${p.numero}`;
  }

  // Medidas de las hojas de retratos, para que el CSS sepa dónde cae cada casilla
  tabla.style.setProperty("--hoja-columnas", RETRATOS.columnas);
  tabla.style.setProperty("--hoja-filas", RETRATOS.filasPorHoja);

  cuerpo.innerHTML = pokemon.map(filaPokemon).join("");
  [...cuerpo.children].forEach((fila, i) => filas.set(pokemon[i].clave, fila));

  pintarCabecera();
  prepararFiltros();
  aplicarFiltros();
  mostrarAviso("");
  barra.hidden = false;
  tabla.hidden = false;

  // Un solo oyente para los botones de todas las columnas
  cabecera.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-orden]");
    if (boton) ordenarPor(boton.dataset.orden);
  });

  // La foto: su línea evolutiva en un bocadillo (./evoluciones.js)
  cuerpo.addEventListener("click", (e) => {
    const boton = e.target.closest(".pokedex-evo");
    if (boton) abrirEvoluciones(boton, Number(boton.dataset.numero), Number(boton.dataset.clave));
  });
  // Al buscar, filtrar u ordenar, la foto se mueve o se esconde: el bocadillo se va
  campoBuscar.addEventListener("input", cerrarEvoluciones);
  cabecera.addEventListener("click", cerrarEvoluciones);
}

export function mostrar() {
  // la tabla se mantiene como se dejó (con el orden que eligiera el usuario)
}
