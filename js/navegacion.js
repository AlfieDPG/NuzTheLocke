// ---------- Secciones y vistas ----------
//
// Para añadir una sección nueva:
//   1) Crea js/<seccion>/index.js con dos funciones exportadas:
//        iniciar()       -> se ejecuta una sola vez, la primera vez que se abre
//        mostrar(vista)  -> se ejecuta cada vez que se abre una de sus vistas
//   2) Añádela a SECCIONES y sus vistas a VISTAS.
//   3) En index.html: un <section id="vista-XXX" hidden> y un botón data-vista="XXX" en el menú.
//
// El código de cada sección solo se descarga cuando se abre por primera vez,
// así que añadir secciones no hace más lenta la carga inicial. Si su hoja de estilo solo la usa
// ella, tampoco va en index.html: va en HOJAS (ver js/comun/hojas.js).
//
// Cada sección que se abre es una entrada del historial: «Atrás» (o el gesto de volver del móvil)
// vuelve a la anterior en vez de salir de la web (y antes cierra la ventana que haya abierta:
// js/comun/atras.js).

import { icono } from "./comun/iconos.js";
import { cargarHoja, adelantarHojas } from "./comun/hojas.js";
import { activarAtras, apuntar } from "./comun/atras.js";

const SECCIONES = {
  inicio: () => import("./inicio/index.js"),
  equipos: () => import("./equipos/index.js"),
  rutas: () => import("./rutas/index.js"),
  levelcaps: () => import("./levelcaps/index.js"),
  normas: () => import("./normas/index.js"),
  amigos: () => import("./amigos/index.js"),
  foro: () => import("./foro/index.js"),
  versus: () => import("./versus/index.js"),
  pokedex: () => import("./pokedex/index.js"),
  calculadora: () => import("./calculadora/index.js"),
  ruleta: () => import("./ruleta/index.js"),
  logros: () => import("./logros/index.js"),
  juegos: () => import("./juegos/index.js"),
  tienda: () => import("./tienda/index.js"),
  randomizer: () => import("./randomizer/index.js"),
  jugar: () => import("./jugar/index.js"),
  lucha: () => import("./lucha/index.js")
};

// Vista -> sección que la gestiona
const VISTAS = {
  inicio: "inicio",
  crear: "equipos",
  equipos: "equipos",
  rutas: "rutas",
  levelcaps: "levelcaps",
  normas: "normas",
  amigos: "amigos",
  foro: "foro",
  lockes: "versus",
  pokedex: "pokedex",
  calculadora: "calculadora",
  ruleta: "ruleta",
  logros: "logros",
  juegos: "juegos",
  tienda: "tienda",
  randomizer: "randomizer",
  jugar: "jugar",
  lucha: "lucha"
};

// Las hojas de estilo (css/<nombre>.css) que solo usa cada sección: se piden al abrirla
const HOJAS = {
  ruleta: ["ruleta"],
  calculadora: ["calculadora"],
  randomizer: ["randomizer"],
  pokedex: ["pokedex"],
  tienda: ["tienda"],
  lucha: ["lucha"],
  jugar: ["jugar"]
};

// Vistas sin botón propio en el menú -> el botón que se marca
const VISTA_EN_MENU = { crear: "equipos" };

const iniciadas = new Map(); // sección -> promesa con su módulo ya iniciado

function hojasDe(nombre) {
  return Promise.all((HOJAS[nombre] || []).map(cargarHoja));
}

function cargarSeccion(nombre) {
  if (!iniciadas.has(nombre)) {
    const promesa = Promise.all([SECCIONES[nombre](), hojasDe(nombre)]).then(async ([modulo]) => {
      await modulo.iniciar();
      return modulo;
    });
    promesa.catch(() => iniciadas.delete(nombre)); // si falla, se reintenta al volver a entrar
    iniciadas.set(nombre, promesa);
  }
  return iniciadas.get(nombre);
}

// Una sección ya iniciada, sin ir a ella (el perfil abre la ventana del palmarés de «Amigos»)
export function prepararSeccion(nombre) {
  return cargarSeccion(nombre);
}

// La vista abierta va en la dirección (#rutas, #pokedex...): al recargar se vuelve a ella.
// Sin nada (entrar de nuevas) se empieza en Inicio.
const VISTA_DE_ENTRADA = "inicio";

// Nombres de antes, para que sigan valiendo los enlaces guardados («Lockes» se llamaba «Versus»)
const ANTIGUAS = { versus: "lockes" };

export function vistaInicial() {
  const pedida = decodeURIComponent(location.hash.slice(1));
  const vista = ANTIGUAS[pedida] || pedida;
  return VISTAS[vista] ? vista : VISTA_DE_ENTRADA;
}

let turno = 0; // si se pulsa otra sección mientras llega la hoja de una, gana la última

// historial: "nueva" (otra entrada: «Atrás» vuelve aquí), "cambiar" (la misma entrada: al entrar en
// la web) o "no" (ya está: se viene de «Atrás»)
export async function irA(vista, { historial = "nueva" } = {}) {
  vista = ANTIGUAS[vista] || vista;
  if (!VISTAS[vista]) vista = VISTA_DE_ENTRADA;
  const direccion = `#${vista}`;
  if (historial === "cambiar") history.replaceState(null, "", direccion);
  else if (historial === "nueva" && location.hash !== direccion) {
    apuntar(() => {
      if (location.hash !== direccion) history.pushState(null, "", direccion);
    });
  }

  // La sección no se enseña hasta que tiene su hoja (la primera vez; luego ya está)
  const miTurno = ++turno;
  await hojasDe(VISTAS[vista]);
  if (miTurno !== turno) return;

  // En el móvil, la sección nueva empieza arriba (si no, sale a la altura de la de antes)
  const nueva = document.querySelector(`#vista-${vista}`);
  if (nueva && nueva.hidden) window.scrollTo(0, 0);
  for (const seccion of document.querySelectorAll("main > section")) {
    seccion.hidden = seccion.id !== `vista-${vista}`;
  }
  // «Crear equipo» no tiene botón en el menú: se marca el de Equipos
  const enMenu = VISTA_EN_MENU[vista] || vista;
  for (const boton of document.querySelectorAll(".menu-lateral [data-vista]")) {
    boton.classList.toggle("activa", boton.dataset.vista === enMenu);
  }

  try {
    const modulo = await cargarSeccion(VISTAS[vista]);
    modulo.mostrar(vista);
  } catch (error) {
    console.error(error); // la propia sección ya muestra el mensaje de error
  }
}

// Un solo oyente para todos los botones del menú
export function iniciarNavegacion() {
  // Cada botón del menú, con su icono delante (el que diga su data-icono)
  for (const boton of document.querySelectorAll(".menu-lateral [data-icono]")) {
    boton.insertAdjacentHTML("afterbegin", icono(boton.dataset.icono));
  }

  document.querySelector(".menu-lateral").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-vista]");
    if (boton) irA(boton.dataset.vista);
  });

  // El logo lleva a Inicio
  document.querySelector(".logo a").addEventListener("click", (e) => {
    e.preventDefault();
    irA("inicio");
  });

  // «Atrás» sin ventanas abiertas: a la sección que diga la dirección
  activarAtras(() => irA(vistaInicial(), { historial: "no" }));

  // Las hojas de las secciones, ya pedidas por detrás para cuando se abran
  adelantarHojas([...new Set(Object.values(HOJAS).flat())]);
}
