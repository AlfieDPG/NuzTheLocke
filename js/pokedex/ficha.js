// Ficha de la Pokédex: a la derecha de la tabla (en el móvil, por encima de ella), la del
// Pokémon de la fila que se pulse. Lleva:
//   · su retrato grande, número, nombre y tipos, y los botones «Añadir a equipo» (al equipo que
//     estás creando) y «En la calculadora» (de defensor);
//   · «Debilidades»: qué tipos le hacen ×4 y ×2;
//   · su línea evolutiva (./evoluciones.js; al pulsar uno, pasa a la ficha);
//   · sus habilidades, con lo que hacen;
//   · los ataques que aprende en el juego que elijas (nivel, MT, tutores y huevo), en una lista
//     con su propio scroll que ocupa lo que le dejen los demás apartados: la ficha mide justo
//     hasta el final de la pantalla (css/pokedex.css).
// «Dónde se captura» no sale: no se enseña nunca, para no destripar las rutas.
//
// Lo que no está en la tabla (habilidades, ataques) sale de PokeAPI: pokemon/{id de la forma}.
// Las megaevoluciones no tienen ataques propios en PokeAPI: salen los de su especie.

import { pedirJSON, URL_API } from "../comun/api.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { descripcionHabilidad } from "../comun/pokemon.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { multiplicadoresDe } from "../comun/efectividad.js";
import { escaparHTML } from "../comun/utilidades.js";
import { t, nombre, LOCALE, enIngles } from "../comun/idioma.js";
import { icono } from "../comun/iconos.js";
import { leer, escribir } from "../comun/almacen.js";
import { TIPOS_POR_ID } from "../calculadora/ataques.js";
import { fotoDeFila } from "./datos.js";
import { htmlEvoluciones } from "./evoluciones.js";

// El juego elegido en «Ataques que aprende» (el mismo para todos los Pokémon)
const CLAVE_JUEGO = "poketeams-pokedex-juego-v1";
// Los grupos de versiones de PokeAPI, con su nombre en cada idioma y del más antiguo al más
// nuevo (el id de PokeAPI no sirve: las versiones japonesas de Rojo y Azul van detrás de las
// nuevas). Los que no estén aquí (esas japonesas, o uno que salga nuevo) no salen.
const JUEGOS = {
  "red-blue": ["Rojo / Azul", "Red / Blue"],
  yellow: ["Amarillo", "Yellow"],
  "gold-silver": ["Oro / Plata", "Gold / Silver"],
  crystal: ["Cristal", "Crystal"],
  "ruby-sapphire": ["Rubí / Zafiro", "Ruby / Sapphire"],
  emerald: ["Esmeralda", "Emerald"],
  "firered-leafgreen": ["Rojo Fuego / Verde Hoja", "FireRed / LeafGreen"],
  colosseum: ["Colosseum", "Colosseum"],
  xd: ["XD", "XD"],
  "diamond-pearl": ["Diamante / Perla", "Diamond / Pearl"],
  platinum: ["Platino", "Platinum"],
  "heartgold-soulsilver": ["Oro HeartGold / Plata SoulSilver", "HeartGold / SoulSilver"],
  "black-white": ["Negro / Blanco", "Black / White"],
  "black-2-white-2": ["Negro 2 / Blanco 2", "Black 2 / White 2"],
  "x-y": ["X / Y", "X / Y"],
  "omega-ruby-alpha-sapphire": ["Rubí Omega / Zafiro Alfa", "Omega Ruby / Alpha Sapphire"],
  "sun-moon": ["Sol / Luna", "Sun / Moon"],
  "ultra-sun-ultra-moon": ["Ultrasol / Ultraluna", "Ultra Sun / Ultra Moon"],
  "lets-go-pikachu-lets-go-eevee": ["Let's Go, Pikachu / Eevee", "Let's Go, Pikachu / Eevee"],
  "sword-shield": ["Espada / Escudo", "Sword / Shield"],
  "the-isle-of-armor": ["La isla de la armadura", "The Isle of Armor"],
  "the-crown-tundra": ["Las nieves de la corona", "The Crown Tundra"],
  "brilliant-diamond-shining-pearl": ["Diamante Brillante / Perla Reluciente", "Brilliant Diamond / Shining Pearl"],
  "legends-arceus": ["Leyendas Pokémon: Arceus", "Legends: Arceus"],
  "scarlet-violet": ["Escarlata / Púrpura", "Scarlet / Violet"],
  "the-teal-mask": ["La máscara turquesa", "The Teal Mask"],
  "the-indigo-disk": ["El disco índigo", "The Indigo Disk"],
  "legends-za": ["Leyendas Pokémon: Z-A", "Legends: Z-A"],
  "mega-dimension": ["Megadimensión", "Mega Dimension"],
  champions: ["Pokémon Champions", "Pokémon Champions"]
};
const ORDEN_JUEGOS = Object.keys(JUEGOS);

function nombreJuego(slug) {
  return JUEGOS[slug][enIngles ? 1 : 0];
}

// "https://pokeapi.co/api/v2/move/82/" -> 82
function idDeUrl(url) {
  return Number(String(url || "").split("/").filter(Boolean).pop());
}

// Tipo de cada ataque (también los de estado, que datos/ataques.json no lleva): { id: [tipo, clase] }
const URL_TIPOS_ATAQUES = new URL("../../datos/tipos-ataques.json", import.meta.url);
let tiposAtaques = null;
function cargarTiposAtaques() {
  if (!tiposAtaques) {
    tiposAtaques = fetch(URL_TIPOS_ATAQUES)
      .then((respuesta) => (respuesta.ok ? respuesta.json() : {}))
      .catch(() => ({}));
  }
  return tiposAtaques;
}

const indices = new Map(); // lista de datos -> Map(id -> entrada)
function porId(lista, id) {
  if (!indices.has(lista)) indices.set(lista, new Map(lista.map((entrada) => [entrada.id, entrada])));
  return indices.get(lista).get(id);
}

function nombreDe(lista, recurso) {
  const entrada = porId(lista, idDeUrl(recurso.url));
  return entrada ? nombre(entrada) : recurso.name.replace(/-/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

// ---------- Trozos ----------

export function pastillaTipo(tipo) {
  return `<span class="pdx-tipo" style="--color-tipo:${coloresTipo[tipo]}">${iconoTipo(tipo)}${tiposEs[tipo]}</span>`;
}

// Solo las debilidades: con resistencias e inmunidades eran demasiados datos
const EFECTOS = [
  [4, "×4", "mal4"],
  [2, "×2", "mal2"]
];

function plantillaEfectos(tipos) {
  const tabla = multiplicadoresDe(tipos);
  return EFECTOS.map(([valor, texto, clase]) => {
    const suyos = Object.keys(tabla).filter((tipo) => tabla[tipo] === valor);
    if (!suyos.length) return "";
    return `<b class="${clase}">${texto}</b><div>${suyos.map(pastillaTipo).join("")}</div>`;
  }).join("");
}

function numeroCorto(numero) {
  return String(numero).padStart(3, "0");
}

function cargando() {
  return `<p class="pdx-cargando">${t("Cargando...")}</p>`;
}

// ---------- Habilidades y ataques (PokeAPI) ----------

async function pedirPokemon(fila) {
  const propio = await pedirJSON(`${URL_API}pokemon/${fila.clave}`);
  // Las Megas y las Primigenias aprenden lo de su especie (PokeAPI no les pone nada o solo lo
  // de Let's Go); otras formas que no traen ataques, también
  const deEspecie = /-(mega|primal)/.test(propio.name) || !propio.moves.length;
  if (!deEspecie || fila.clave === fila.numero) return { propio, ataques: propio.moves };
  try {
    const especie = await pedirJSON(`${URL_API}pokemon/${fila.numero}`);
    return { propio, ataques: especie.moves };
  } catch (error) {
    return { propio, ataques: [] };
  }
}

async function plantillaHabilidades(propio) {
  const habilidades = [...propio.abilities].sort((a, b) => a.slot - b.slot);
  const textos = await Promise.all(
    habilidades.map((h) => descripcionHabilidad(idDeUrl(h.ability.url)).catch(() => ""))
  );
  return habilidades
    .map(
      (h, i) => `
        <div class="pdx-habilidad">
          <b>${escaparHTML(nombreDe(datos.habilidades, h.ability))}${h.is_hidden ? ` <span class="pdx-oculta">${t("oculta")}</span>` : ""}</b>
          <span>${escaparHTML(textos[i])}</span>
        </div>`
    )
    .join("");
}

// Los juegos en los que aprende algo, del más antiguo al más nuevo
function juegosDe(ataques) {
  const juegos = new Set();
  for (const ataque of ataques) {
    for (const detalle of ataque.version_group_details) juegos.add(detalle.version_group.name);
  }
  return ORDEN_JUEGOS.filter((slug) => juegos.has(slug));
}

const METODOS = { "level-up": "nivel", machine: "mt", tutor: "tutor", egg: "huevo" };

// { nivel: [{ nivel, id, nombre, tipo }], mt: [...], tutor: [...], huevo: [...] }
function ataquesEn(ataques, juego, tipos) {
  const grupos = { nivel: [], mt: [], tutor: [], huevo: [] };
  for (const ataque of ataques) {
    const id = idDeUrl(ataque.move.url);
    const base = {
      id,
      nombre: nombreDe(datos.ataques, ataque.move),
      tipo: TIPOS_POR_ID[(tipos[id] || [])[0]] || ""
    };
    const vistos = new Set();
    for (const detalle of ataque.version_group_details) {
      if (detalle.version_group.name !== juego) continue;
      const grupo = METODOS[detalle.move_learn_method.name];
      if (!grupo) continue;
      // Un ataque que se aprende a dos niveles (o al evolucionar, nivel 0) sale en cada uno
      const clave = `${grupo}|${detalle.level_learned_at}`;
      if (vistos.has(clave) || (grupo !== "nivel" && vistos.has(grupo))) continue;
      vistos.add(clave);
      vistos.add(grupo);
      grupos[grupo].push({ ...base, nivel: detalle.level_learned_at });
    }
  }
  grupos.nivel.sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, LOCALE));
  for (const grupo of ["mt", "tutor", "huevo"]) grupos[grupo].sort((a, b) => a.nombre.localeCompare(b.nombre, LOCALE));
  return grupos;
}

function filaAtaque(ataque, etiqueta) {
  return `
    <div class="pdx-ataque">
      <span class="pdx-nv">${etiqueta}</span>
      <span>${escaparHTML(ataque.nombre)}</span>
      ${ataque.tipo ? pastillaTipo(ataque.tipo) : "<span></span>"}
    </div>`;
}

function etiquetaNivel(ataque) {
  return ataque.nivel ? t("Nv. {n}", { n: ataque.nivel }) : t("Evol.");
}

const TITULOS_GRUPO = { mt: () => t("Por MT"), tutor: () => t("Con tutores"), huevo: () => t("Por huevo") };
const ETIQUETAS_GRUPO = { mt: () => t("fila|MT"), tutor: () => t("fila|Tutor"), huevo: () => t("fila|Huevo") };

function plantillaAtaques(grupos) {
  let html = grupos.nivel.length
    ? `<div class="pdx-ataques">${grupos.nivel.map((ataque) => filaAtaque(ataque, etiquetaNivel(ataque))).join("")}</div>`
    : `<p class="pdx-cargando">${t("No aprende ataques por nivel en este juego.")}</p>`;
  for (const grupo of ["mt", "tutor", "huevo"]) {
    if (!grupos[grupo].length) continue;
    html += `
      <h4 class="pdx-subtitulo">${TITULOS_GRUPO[grupo]()}</h4>
      <div class="pdx-ataques">${grupos[grupo].map((ataque) => filaAtaque(ataque, ETIQUETAS_GRUPO[grupo]())).join("")}</div>`;
  }
  return html;
}

// ---------- La ficha ----------

let caja = null;        // el <aside>
let filaActual = null;  // la fila de la tabla que se está viendo
let turno = 0;          // al cambiar de Pokémon mientras carga, gana el último
let ataquesActuales = [];
let tiposActuales = {};

export function filaDeLaFicha() {
  return filaActual;
}

function plantillaFicha(fila) {
  const color = coloresTipo[fila.tipos[0]] || "#888";
  return `
    <button class="pdx-cerrar" aria-label="${t("Cerrar ficha")}">${icono("aspa")}</button>
    <div class="pdx-cabeza" style="--color-tipo:${color}">
      <span class="pdx-grande">${fotoDeFila(fila)}</span>
      <div class="pdx-titulo">
        <h2><small>#${numeroCorto(fila.numero)} </small>${escaparHTML(fila.visible || fila.nombre)}</h2>
        <div class="pdx-tipos">${fila.tipos.map(pastillaTipo).join("")}</div>
        <div class="pdx-botones">
          <button class="pdx-boton pdx-al-equipo">${icono("mas")}${t("Añadir a equipo")}</button>
          <button class="pdx-boton pdx-a-calculadora">${icono("calculadora")}${t("En la calculadora")}</button>
        </div>
      </div>
    </div>

    <section class="pdx-apartado">
      <h3>${t("Debilidades")}</h3>
      <div class="pdx-efectos">${plantillaEfectos(fila.tipos)}</div>
    </section>

    <section class="pdx-apartado pdx-apartado-evo">
      <h3>${t("Evolución")}</h3>
      <div class="pdx-evo">${cargando()}</div>
    </section>

    <section class="pdx-apartado pdx-apartado-formas" hidden>
      <h3>${t("Formas")}</h3>
      <div class="pdx-evo pdx-formas"></div>
    </section>

    <section class="pdx-apartado">
      <h3>${t("Habilidades")}</h3>
      <div class="pdx-habilidades">${cargando()}</div>
    </section>

    <section class="pdx-apartado pdx-apartado-ataques">
      <h3>${t("Ataques que aprende")} <span class="pdx-juego-caja"></span></h3>
      <div class="pdx-lista-ataques">${cargando()}</div>
    </section>`;
}

function pintarAtaques() {
  const juegoCaja = caja.querySelector(".pdx-juego-caja");
  const lista = caja.querySelector(".pdx-lista-ataques");
  const juegos = juegosDe(ataquesActuales);
  if (!juegos.length) {
    juegoCaja.innerHTML = "";
    lista.innerHTML = `<p class="pdx-cargando">${t("No hay datos de sus ataques.")}</p>`;
    return;
  }
  const guardado = leer(CLAVE_JUEGO, "");
  // Sin elegir: el más nuevo en el que aprende algo por nivel
  const conNivel = juegos.filter((slug) => ataquesEn(ataquesActuales, slug, tiposActuales).nivel.length);
  const juego = juegos.includes(guardado) ? guardado : conNivel[conNivel.length - 1] || juegos[juegos.length - 1];
  juegoCaja.innerHTML = `
    <select class="pdx-juego" aria-label="${t("Juego")}">
      ${[...juegos].reverse().map((slug) => `<option value="${slug}" ${slug === juego ? "selected" : ""}>${nombreJuego(slug)}</option>`).join("")}
    </select>`;
  lista.innerHTML = plantillaAtaques(ataquesEn(ataquesActuales, juego, tiposActuales));
  lista.scrollTop = 0;
}

export function prepararFicha(aside, { alElegir, alEquipo, aCalculadora, alCerrar }) {
  caja = aside;
  caja.addEventListener("click", (e) => {
    const boton = e.target.closest("button, [data-clave]");
    if (!boton || !filaActual) return;
    if (boton.classList.contains("pdx-al-equipo")) alEquipo(filaActual);
    else if (boton.classList.contains("pdx-a-calculadora")) aCalculadora(filaActual);
    else if (boton.classList.contains("pdx-cerrar")) alCerrar();
    else if (boton.dataset.clave) alElegir(Number(boton.dataset.clave), Number(boton.dataset.numero));
  });
  caja.addEventListener("keydown", (e) => {
    const paso = e.target.closest("[data-clave]");
    if (paso && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      alElegir(Number(paso.dataset.clave), Number(paso.dataset.numero));
    }
  });
  caja.addEventListener("change", (e) => {
    if (!e.target.classList.contains("pdx-juego")) return;
    escribir(CLAVE_JUEGO, e.target.value);
    pintarAtaques();
  });
}

export async function mostrarFicha(fila) {
  if (!caja) return;
  const miTurno = ++turno;
  filaActual = fila;
  caja.hidden = false;
  caja.setAttribute("aria-label", t("Ficha de {nombre}", { nombre: fila.visible || fila.nombre }));
  caja.innerHTML = plantillaFicha(fila);
  caja.scrollTop = 0;

  // Sin evolución no sale el apartado; las Megas y cambios de forma, en el suyo
  htmlEvoluciones(fila.numero, fila.clave).then(({ linea, formas }) => {
    if (miTurno !== turno) return;
    const apartadoEvo = caja.querySelector(".pdx-apartado-evo");
    const apartadoFormas = caja.querySelector(".pdx-apartado-formas");
    apartadoEvo.querySelector(".pdx-evo").innerHTML = linea;
    apartadoEvo.hidden = !linea;
    apartadoFormas.querySelector(".pdx-formas").innerHTML = formas;
    apartadoFormas.hidden = !formas;
  });

  try {
    const [{ propio, ataques }, tipos] = await Promise.all([pedirPokemon(fila), cargarTiposAtaques(), cargarDatos()]);
    if (miTurno !== turno) return;
    ataquesActuales = ataques;
    tiposActuales = tipos;
    pintarAtaques();
    const habilidades = await plantillaHabilidades(propio);
    if (miTurno === turno) caja.querySelector(".pdx-habilidades").innerHTML = habilidades;
  } catch (error) {
    console.error(error);
    if (miTurno !== turno) return;
    const fallo = `<p class="pdx-cargando">${t("No se ha podido cargar. Revisa tu conexión.")}</p>`;
    caja.querySelector(".pdx-habilidades").innerHTML = fallo;
    caja.querySelector(".pdx-lista-ataques").innerHTML = fallo;
  }
}
