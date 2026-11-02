// ---------- Editar una partida de GS Vitro ----------
//
// Las mismas piezas que los demás juegos (ver ./formato.js) para el editor de la web: los huecos
// del equipo y las cajas, cada Pokémon como «editable» y la bolsa. La partida se lee entera como
// nodos de Marshal (./marshal-arbol.js) y se vuelve a escribir igual, con lo que se haya cambiado.
//
// Cada Pokémon «crudo» (lo que el editor mueve de un sitio a otro) son 4 bytes con su PID (la
// llave: huecos.js la lee de ahí) y, detrás, el objeto PokeBattle_Pokemon de Ruby guardado él solo.
//
// En el «editable», como en los demás juegos, los ataques, objetos y habilidades van con los
// números de la web; aquí se pasan a los del juego (datos/partida-vitro.json, ./vitro.js). Las
// estadísticas se vuelven a calcular con las bases del juego, como hace Essentials (calcStats).
// Lo que el editor no toca (cintas, tipo Tera, Dinamax...) se queda como estaba.

import { leerNodos, escribirNodos, variable, ponerVariable, valorDe, nodoEntero, nodoBool, nodoNil, nodoTexto, copiarNodo } from "./marshal-arbol.js";
import { tablasVitro, moteDe } from "./vitro.js";
import { experienciaPara } from "./convertir.js";

const ENTRENADOR = 0;
const MOCHILA = 13;
const CAJAS = 14;
export const CAJAS_EDITABLES_VITRO = 40;
const POR_CAJA = 30;

const MAX_MOTE = 12;
const PROBABILIDAD_SHINY = 16;
const INTERCAMBIADO = 2; // obtainMode
export const LUGAR_INTERCAMBIO_VITRO = 0; // en el editable: los intercambiados (y los creados en la web)
const MAX_POR_HUECO = 99; // BAGMAXPERSLOT de sus ajustes: con más, ocupan varios huecos de la bolsa
const PASOS_POR_CICLO = 256;

// Los bolsillos de Essentials (pbPocketNames de sus ajustes) con los nombres de la web (js/versus/bolsa.js)
const BOLSILLOS = [null, "objetos", "medicinas", "balls", "mt", "bayas", "combate", "tesoros", "clave", "megapiedras", "cristales"];

// Orden de la web (PS, At, Def, AtE, DfE, Vel) <-> Essentials (PS, At, Def, Vel, AtE, DfE)
const A_ESSENTIALS = [0, 1, 2, 5, 3, 4]; // para escribir: la de la web que va en cada sitio de Essentials
const A_WEB = [0, 1, 2, 4, 5, 3]; // para leer: el sitio de Essentials de cada una de la web

// ---------- Tablas al revés (de la web al juego) ----------

let inversas = null;

function tablas() {
  const t = tablasVitro();
  if (!t) throw new Error("Faltan los datos de GS Vitro.");
  if (!inversas) {
    const alReves = (lista) => {
      const mapa = new Map();
      lista.forEach((web, propio) => {
        if (web && !mapa.has(web)) mapa.set(web, propio);
      });
      return mapa;
    };
    inversas = { ataques: alReves(t.ataques), objetos: alReves(t.objetos), balls: alReves(t.balls) };
  }
  return t;
}

const ataqueDelJuego = (web) => (tablas(), inversas.ataques.get(web) || 0);
const objetoDelJuego = (web) => (tablas(), inversas.objetos.get(web) || 0);

// Si un ataque u objeto de la web existe en Vitro (para las listas del editor)
export function existeEnVitro(tipo, id) {
  tablas();
  if (tipo === "ataques") return inversas.ataques.has(id);
  if (tipo === "objetos") return inversas.objetos.has(id);
  return true;
}

// El bolsillo de la bolsa donde va un objeto de la web («medicinas»...), o ""
export function bolsilloVitro(objetoWeb) {
  return BOLSILLOS[tablas().bolsillos[objetoDelJuego(objetoWeb)]] || "";
}

// Las habilidades de una especie como las quiere el editor: [{ id, num: 1 | 2 | 4 (oculta) }]
export function habilidadesVitro(especie) {
  const fila = tablas().especies[especie - 1] || [];
  return [[fila[0], 1], [fila[1], 2], [fila[2], 4]].filter(([id]) => id).map(([id, num]) => ({ id, num }));
}

// Los lugares del juego que se pueden elegir: uno por lugar de «Rutas» (el primer mapa que lo es)
export function lugaresVitro() {
  const vistos = new Map();
  for (const [mapa, lugar] of Object.entries(tablas().lugares)) {
    if (!vistos.has(lugar)) vistos.set(lugar, Number(mapa));
  }
  return [...vistos].map(([lugar, mapa]) => ({ id: mapa, es: lugar }));
}

const URL_APRENDE = new URL("../../datos/partida-vitro-aprende.json", import.meta.url);
let aprende = null;

// Los ataques que aprende por nivel en Vitro: [{ id (de la web), nivel }]
export async function aprendeVitro(especie) {
  if (!aprende) {
    const respuesta = await fetch(URL_APRENDE);
    aprende = respuesta.ok ? await respuesta.json() : {};
  }
  const lista = aprende[especie] || [];
  const salida = [];
  for (let i = 0; i < lista.length; i += 2) salida.push({ nivel: lista[i], id: lista[i + 1] });
  return salida;
}

// ---------- La partida, como nodos ----------

const abiertas = new WeakMap(); // bytes -> nodos (para no volver a leerla en cada hueco)

function nodosDe(bytes) {
  if (!abiertas.has(bytes)) {
    const nodos = leerNodos(bytes);
    if (!nodos[ENTRENADOR] || nodos[ENTRENADOR].clase !== "PokeBattle_Trainer") throw new Error("No parece una partida de GS Vitro.");
    abiertas.set(bytes, nodos);
  }
  return abiertas.get(bytes);
}

const equipoDe = (nodos) => variable(nodos[ENTRENADOR], "@party");
const cajaDe = (nodos, caja) => {
  const cajas = variable(nodos[CAJAS], "@boxes");
  const una = cajas && cajas.items[caja];
  return una ? variable(una, "@pokemon") : null;
};

function crudoDe(nodo) {
  const cuerpo = escribirNodos([nodo]);
  const crudo = new Uint8Array(4 + cuerpo.length);
  new DataView(crudo.buffer).setUint32(0, (valorDe(variable(nodo, "@personalID")) || 0) >>> 0, true);
  crudo.set(cuerpo, 4);
  return crudo;
}

function nodoDe(crudo) {
  return leerNodos(crudo.subarray(4))[0];
}

const VACIO = new Uint8Array(0);

export function leerHuecoVitro(bytes, sitio) {
  const nodos = nodosDe(bytes);
  const lista = sitio.equipo !== undefined ? equipoDe(nodos) : cajaDe(nodos, sitio.caja);
  const i = sitio.equipo !== undefined ? sitio.equipo : sitio.hueco;
  const nodo = lista && lista.items[i];
  return nodo && nodo.t === "obj" ? crudoDe(nodo) : null;
}

export function huecoVacioVitro() {
  return VACIO;
}

export function cuantosEquipoVitro(bytes) {
  return equipoDe(nodosDe(bytes)).items.length;
}

// cambios: [{ sitio, crudo }] (crudo vacío: quitarlo). cuantosEquipo: cuántos quedan en el equipo
export function editarHuecosVitro(bytes, cambios, cuantosEquipo) {
  const nodos = leerNodos(bytes); // una copia aparte: la de la caché no se toca
  const equipo = equipoDe(nodos);
  for (const { sitio, crudo } of cambios) {
    const nodo = crudo && crudo.length ? nodoDe(crudo) : null;
    if (sitio.equipo !== undefined) {
      equipo.items[sitio.equipo] = nodo;
    } else {
      const caja = cajaDe(nodos, sitio.caja);
      if (!caja || sitio.hueco >= POR_CAJA) throw new Error("Ese hueco no existe.");
      while (caja.items.length <= sitio.hueco) caja.items.push(nodoNil());
      caja.items[sitio.hueco] = nodo || nodoNil();
    }
  }
  // El equipo, seguido y sin huecos (en Ruby es una lista de los que hay)
  const largo = cuantosEquipo !== undefined ? cuantosEquipo : equipo.items.length;
  equipo.items = equipo.items.slice(0, largo).filter(Boolean);
  return escribirNodos(nodos);
}

export function sePuedeEditarVitro() {
  return { ok: true };
}

// El entrenador de la partida, para crear Pokémon suyos. plantilla: uno de su equipo, del que se
// copian las variables que el editor no conoce (las propias de Vitro)
export function entrenadorVitro(bytes) {
  const nodos = nodosDe(bytes);
  const entrenador = nodos[ENTRENADOR];
  const primero = equipoDe(nodos).items.find((n) => n && n.t === "obj");
  return {
    nombre: valorDe(variable(entrenador, "@name")) || "",
    id: (valorDe(variable(entrenador, "@id")) || 0) >>> 0,
    version: 0,
    idioma: 7, // español: el juego está en español
    plantilla: primero ? crudoDe(primero) : null
  };
}

// ---------- Un Pokémon ----------

const num = (nodo, nombre) => {
  const v = valorDe(variable(nodo, nombre));
  return typeof v === "number" ? v : 0;
};
const flag = (nodo, nombre) => {
  const v = valorDe(variable(nodo, nombre));
  return v === null || v === undefined ? null : v;
};
const lista = (nodo, nombre) => {
  const l = variable(nodo, nombre);
  return l && l.items ? l.items.map(valorDe) : [];
};

function filaEspecie(especie) {
  return tablas().especies[especie - 1] || [];
}

function nivelDe(especie, experiencia) {
  const ritmo = filaEspecie(especie)[7] || 2;
  let nivel = 1;
  while (nivel < 100 && experienciaPara(ritmo, nivel + 1) <= experiencia) nivel++;
  return nivel;
}

// Lo que el juego calcula del PID si no hay «flag» (como PokeBattle_Pokemon de Essentials)
function naturalezaDe(nodo) {
  const forzada = flag(nodo, "@natureflag");
  return forzada !== null ? forzada : (num(nodo, "@personalID") >>> 0) % 25;
}

function generoDe(nodo) {
  const forzado = flag(nodo, "@genderflag");
  if (forzado !== null) return ["M", "F", ""][forzado] ?? "";
  const byte = filaEspecie(num(nodo, "@species"))[6];
  if (byte === 255 || byte === undefined) return "";
  if (byte === 254) return "F";
  if (byte === 0) return "M";
  return (num(nodo, "@personalID") & 0xff) < byte ? "F" : "M";
}

function huecoHabilidad(nodo) {
  const fila = filaEspecie(num(nodo, "@species"));
  const pid = num(nodo, "@personalID") >>> 0;
  const forzado = flag(nodo, "@abilityflag");
  let hueco = forzado !== null ? forzado : pid & 1;
  if (fila[hueco]) return hueco;
  if (hueco >= 2) hueco = pid & 1;
  return hueco === 1 && fila[1] ? 1 : 0;
}

function esShiny(nodo) {
  const forzado = flag(nodo, "@shinyflag");
  if (forzado !== null) return Boolean(forzado);
  const mezcla = ((num(nodo, "@personalID") >>> 0) ^ (num(nodo, "@trainerID") >>> 0)) >>> 0;
  return ((mezcla & 0xffff) ^ (mezcla >>> 16)) < PROBABILIDAD_SHINY;
}

const NUM_HABILIDAD = [1, 2, 4, 4, 4, 4]; // hueco de Essentials -> 1, 2 o 4 (oculta) del editor

export function leerEditableVitro(crudo) {
  const t = tablas();
  const nodo = nodoDe(crudo);
  const especie = num(nodo, "@species");
  const experiencia = num(nodo, "@exp");
  const huevo = num(nodo, "@eggsteps") > 0;
  const hueco = huecoHabilidad(nodo);
  const mote = huevo ? "" : moteDe(valorDe(variable(nodo, "@name")) || "", especie);
  const ivs = lista(nodo, "@iv");
  const evs = lista(nodo, "@ev");
  return {
    especie,
    forma: num(nodo, "@form"),
    genero: generoDe(nodo),
    apodado: Boolean(mote),
    mote, // sin mote, el juego guarda el nombre de la especie: aquí sale vacío
    shiny: esShiny(nodo),
    objeto: t.objetos[num(nodo, "@item")] || 0,
    habilidad: filaEspecie(especie)[hueco] || 0, // la tabla ya las trae con el número de la web
    numHabilidad: NUM_HABILIDAD[hueco] || 1,
    naturaleza: naturalezaDe(nodo),
    experiencia,
    nivel: nivelDe(especie, experiencia),
    evs: A_WEB.map((i) => Number(evs[i]) || 0),
    ivs: A_WEB.map((i) => Number(ivs[i]) || 0),
    amistad: huevo ? Math.min(255, Math.ceil(num(nodo, "@eggsteps") / PASOS_POR_CICLO)) : num(nodo, "@happiness"),
    ataques: [0, 1, 2, 3].map((i) => {
      const m = (variable(nodo, "@moves") || { items: [] }).items[i];
      const id = m && m.t === "obj" ? num(m, "@id") : 0;
      return { id: t.ataques[id] || 0, pp: id ? num(m, "@pp") : 0, masPP: id ? num(m, "@ppup") : 0 };
    }),
    huevo,
    ball: t.balls[num(nodo, "@ballused")] || 4,
    lugar: num(nodo, "@obtainMode") === INTERCAMBIADO ? LUGAR_INTERCAMBIO_VITRO : num(nodo, "@obtainMap"),
    version: 0,
    entrenador: valorDe(variable(nodo, "@ot")) || "",
    idioma: 7,
    enEquipo: true
  };
}

// Las estadísticas, como calcStats de Essentials (con las bases del juego), y los PS: llenos si no
// estaba debilitado
function calcularEstadisticas(nodo, curar) {
  const fila = filaEspecie(num(nodo, "@species"));
  const bases = fila.slice(9, 15);
  if (bases.length < 6) return;
  const nivel = nivelDe(num(nodo, "@species"), num(nodo, "@exp"));
  const ivs = lista(nodo, "@iv");
  const evs = lista(nodo, "@ev");
  const naturaleza = naturalezaDe(nodo);
  const sube = Math.floor(naturaleza / 5);
  const baja = naturaleza % 5;
  const valores = bases.map((base, i) => {
    const iv = Number(ivs[i]) || 0;
    const ev = Number(evs[i]) || 0;
    const bruto = Math.floor(((base * 2 + iv + (ev >> 2)) * nivel) / 100);
    if (i === 0) return base === 1 ? 1 : bruto + nivel + 10;
    const efecto = sube === baja ? 100 : i - 1 === sube ? 110 : i - 1 === baja ? 90 : 100;
    return Math.floor(((bruto + 5) * efecto) / 100);
  });
  const antes = num(nodo, "@totalhp");
  const psAntes = num(nodo, "@hp");
  ponerVariable(nodo, "@totalhp", nodoEntero(valores[0]));
  ["@attack", "@defense", "@speed", "@spatk", "@spdef"].forEach((nombre, i) => ponerVariable(nodo, nombre, nodoEntero(valores[i + 1])));
  const ps = psAntes <= 0 && antes > 0 ? 0 : curar ? valores[0] : Math.min(valores[0], psAntes);
  ponerVariable(nodo, "@hp", nodoEntero(ps));
}

function nodoAtaque(id, pp, masPP) {
  return { t: "obj", clase: "PBMove", iv: [["@id", nodoEntero(id)], ["@pp", nodoEntero(pp)], ["@ppup", nodoEntero(masPP)]] };
}

// Copia del Pokémon con los cambios (editable: como el de leerEditableVitro). opciones.nombreEspecie:
// su nombre (el juego lo guarda como nombre si no tiene mote)
export function aplicarEditableVitro(crudo, editable, opciones = {}) {
  const t = tablas();
  const e = editable;
  const antes = leerEditableVitro(crudo);
  const nodo = nodoDe(crudo);
  const huevo = e.huevo === undefined ? antes.huevo : Boolean(e.huevo);

  if (e.especie !== antes.especie) ponerVariable(nodo, "@species", nodoEntero(e.especie));
  ponerVariable(nodo, "@item", nodoEntero(objetoDelJuego(e.objeto) || 0));

  // Habilidad: el hueco de la especie donde está la elegida (o el que diga el editor)
  const fila = filaEspecie(e.especie);
  let hueco = [0, 1, 2, 3, 4, 5].find((h) => fila[h] && fila[h] === e.habilidad);
  if (hueco === undefined) hueco = { 1: 0, 2: 1, 4: 2 }[e.numHabilidad] ?? 0;
  if (hueco !== huecoHabilidad(nodo) || e.especie !== antes.especie) ponerVariable(nodo, "@abilityflag", nodoEntero(hueco));

  if (e.naturaleza !== antes.naturaleza) ponerVariable(nodo, "@natureflag", nodoEntero(e.naturaleza));
  if (e.genero !== antes.genero) ponerVariable(nodo, "@genderflag", nodoEntero(e.genero === "F" ? 1 : e.genero === "M" ? 0 : 2));
  if (e.shiny !== antes.shiny) ponerVariable(nodo, "@shinyflag", nodoBool(e.shiny));
  if (e.ball) ponerVariable(nodo, "@ballused", nodoEntero(inversas.balls.get(e.ball) ?? 0));

  // La experiencia solo cambia si cambia el nivel o la especie (así no se pierde lo que llevaba)
  const nivel = Math.max(1, Math.min(100, e.nivel));
  if (e.especie !== antes.especie || nivel !== antes.nivel) {
    ponerVariable(nodo, "@exp", nodoEntero(experienciaPara(filaEspecie(e.especie)[7] || 2, nivel)));
  }

  // Huevo: los ciclos que le faltan (en el editor van donde la amistad)
  if (huevo) ponerVariable(nodo, "@eggsteps", nodoEntero(Math.max(1, (Number(e.amistad) || 1) * PASOS_POR_CICLO)));
  else {
    if (antes.huevo) ponerVariable(nodo, "@eggsteps", nodoEntero(0));
    ponerVariable(nodo, "@happiness", nodoEntero(Math.max(0, Math.min(255, Number(e.amistad) || 0))));
  }

  // Dónde se conoció: «Intercambio» (0) lo deja como intercambiado
  if (e.lugar !== undefined && !huevo && e.lugar !== antes.lugar) {
    if (e.lugar === LUGAR_INTERCAMBIO_VITRO) ponerVariable(nodo, "@obtainMode", nodoEntero(INTERCAMBIADO));
    else {
      ponerVariable(nodo, "@obtainMap", nodoEntero(e.lugar));
      if (num(nodo, "@obtainMode") === INTERCAMBIADO) ponerVariable(nodo, "@obtainMode", nodoEntero(0));
    }
  }
  const entrenador = String(e.entrenador ?? antes.entrenador).trim();
  if (entrenador && entrenador !== antes.entrenador) ponerVariable(nodo, "@ot", nodoTexto(entrenador.slice(0, MAX_MOTE)));

  ponerVariable(nodo, "@ev", { t: "arr", items: A_ESSENTIALS.map((_, i) => nodoEntero(Math.max(0, Math.min(252, e.evs[A_ESSENTIALS[i]] || 0)))) });
  ponerVariable(nodo, "@iv", { t: "arr", items: A_ESSENTIALS.map((_, i) => nodoEntero(Math.max(0, Math.min(31, e.ivs[A_ESSENTIALS[i]] || 0)))) });

  // El nombre: el mote o, sin él, el de la especie (solo si cambia algo: el de la partida es el bueno)
  const mote = huevo ? "" : String(e.mote || "").trim().slice(0, MAX_MOTE);
  if (huevo !== antes.huevo || mote !== antes.mote || e.especie !== antes.especie) {
    ponerVariable(nodo, "@name", nodoTexto(huevo ? "Huevo" : mote || opciones.nombreEspecie || ""));
  }

  // Los ataques: siempre 4 (los vacíos, con el 0), con sus PP como mucho los del juego
  const ataques = (e.ataques || []).slice(0, 4).map((a) => {
    const id = a && a.id ? ataqueDelJuego(a.id) : 0;
    if (!id) return nodoAtaque(0, 0, 0);
    const masPP = Math.max(0, Math.min(3, a.masPP || 0));
    const total = Math.floor(((t.pp[id] || 1) * (5 + masPP)) / 5);
    return nodoAtaque(id, Math.max(0, Math.min(total, a.pp ?? total)), masPP);
  });
  // Los que existen, primero (como el juego)
  ataques.sort((a, b) => (num(b, "@id") ? 1 : 0) - (num(a, "@id") ? 1 : 0));
  while (ataques.length < 4) ataques.push(nodoAtaque(0, 0, 0));
  ponerVariable(nodo, "@moves", { t: "arr", items: ataques });

  calcularEstadisticas(nodo, true);
  return crudoDe(nodo);
}

// En Essentials el equipo y las cajas guardan lo mismo
export function paraEquipoVitro(crudo) {
  return new Uint8Array(crudo);
}

export function paraCajaVitro(crudo) {
  return new Uint8Array(crudo);
}

function alAzar() {
  const numero = new Uint32Array(1);
  crypto.getRandomValues(numero);
  return numero[0];
}

// Copia con otro PID. Lo que el juego saca del PID (naturaleza, género, habilidad, shiny) se deja
// fijado antes, para que la copia sea igual
export function conLlaveNuevaVitro(crudo) {
  const nodo = nodoDe(crudo);
  const genero = generoDe(nodo);
  ponerVariable(nodo, "@natureflag", nodoEntero(naturalezaDe(nodo)));
  ponerVariable(nodo, "@genderflag", nodoEntero(genero === "F" ? 1 : genero === "M" ? 0 : 2));
  ponerVariable(nodo, "@abilityflag", nodoEntero(huecoHabilidad(nodo)));
  ponerVariable(nodo, "@shinyflag", nodoBool(esShiny(nodo)));
  ponerVariable(nodo, "@personalID", nodoEntero(alAzar() || 1));
  return crudoDe(nodo);
}

// Un Pokémon nuevo, del entrenador de la partida (entrenadorVitro), «intercambiado» hoy: así no
// cuenta como captura de ninguna ruta. Se parte de uno de su equipo (las variables propias de
// Vitro) y se deja todo lo demás como uno recién creado.
export function crearPokemonVitro(entrenador, editable, opciones) {
  if (!entrenador.plantilla) throw new Error("No hay ningún Pokémon en el equipo de la partida.");
  const nodo = copiarNodo(nodoDe(entrenador.plantilla));
  const nivel = Math.max(1, Math.min(100, editable.nivel));
  const iniciales = {
    "@species": nodoEntero(editable.especie),
    "@personalID": nodoEntero(alAzar()),
    "@trainerID": nodoEntero(entrenador.id),
    "@ot": nodoTexto(entrenador.nombre),
    "@timeReceived": nodoEntero(Math.floor(Date.now() / 1000)),
    "@exp": nodoEntero(experienciaPara(filaEspecie(editable.especie)[7] || 2, nivel)),
    "@obtainMode": nodoEntero(INTERCAMBIADO),
    "@obtainMap": nodoEntero(0),
    "@obtainLevel": nodoEntero(nivel),
    "@obtainText": nodoNil(),
    "@hatchedMap": nodoEntero(0),
    "@eggsteps": nodoEntero(0),
    "@status": nodoEntero(0),
    "@statusCount": nodoEntero(0),
    "@form": nodoEntero(0),
    "@ribbons": { t: "arr", items: [] },
    "@firstmoves": { t: "arr", items: [] },
    "@mail": nodoNil(),
    "@fused": nodoNil(),
    "@hp": nodoEntero(1),
    "@totalhp": nodoEntero(1)
  };
  for (const [nombre, valor] of Object.entries(iniciales)) ponerVariable(nodo, nombre, valor);
  // Sin nada fijado: lo pone aplicarEditable
  nodo.iv = nodo.iv.filter(([nombre]) => !["@abilityflag", "@natureflag", "@genderflag", "@shinyflag"].includes(nombre));
  // Para que aplicarEditable lo vea todo como cambiado (nombre, ataques...)
  ponerVariable(nodo, "@name", nodoTexto(""));
  return aplicarEditableVitro(crudoDe(nodo), { ...editable, lugar: LUGAR_INTERCAMBIO_VITRO }, opciones);
}

export function esHuevoVitro(crudo) {
  return num(nodoDe(crudo), "@eggsteps") > 0;
}

export function especieDeVitro(crudo) {
  return num(nodoDe(crudo), "@species");
}

export function formaDeVitro(crudo) {
  return num(nodoDe(crudo), "@form");
}

export const POKEMON_VITRO = {
  leerEditable: leerEditableVitro,
  aplicarEditable: aplicarEditableVitro,
  crearPokemon: crearPokemonVitro,
  conLlaveNueva: conLlaveNuevaVitro,
  paraEquipo: paraEquipoVitro,
  paraCaja: paraCajaVitro,
  esHuevo: esHuevoVitro,
  especieDe: especieDeVitro,
  formaDe: formaDeVitro,
  lugarIntercambio: LUGAR_INTERCAMBIO_VITRO,
  maxMote: MAX_MOTE,
  maxEntrenador: MAX_MOTE
};

// ---------- La bolsa ----------
//
// $PokemonBag: @pockets, una lista por bolsillo (la 0 no se usa) de [objeto, cantidad]. Los objetos
// que la web no conoce (megapiedras propias de Vitro, objetos clave del juego...) no se ven, pero se
// quedan donde estaban.

export function bolsillosVitro() {
  return BOLSILLOS.slice(1).map((id) => ({ id, caben: 999, maximo: 999 }));
}

export function leerMochilaEditableVitro(bytes) {
  const t = tablas();
  const bolsa = nodosDe(bytes)[MOCHILA];
  const bolsillos = variable(bolsa, "@pockets");
  const mochila = Object.fromEntries(BOLSILLOS.slice(1).map((id) => [id, []]));
  (bolsillos ? bolsillos.items : []).forEach((bolsillo, i) => {
    const id = BOLSILLOS[i];
    if (!id || !bolsillo.items) return;
    for (const entrada of bolsillo.items) {
      const [objeto, cantidad] = (entrada.items || []).map(valorDe);
      const web = t.objetos[objeto];
      if (!web) continue;
      // El mismo objeto en varios huecos (más de 99): uno solo, con todos
      const ya = mochila[id].find((e) => e.objeto === web);
      if (ya) ya.cantidad += cantidad || 0;
      else mochila[id].push({ objeto: web, cantidad: cantidad || 0 });
    }
  });
  return mochila;
}

export function escribirMochilaVitro(original, mochila) {
  const t = tablas();
  const nodos = leerNodos(original);
  const bolsillos = variable(nodos[MOCHILA], "@pockets");
  bolsillos.items.forEach((bolsillo, i) => {
    const id = BOLSILLOS[i];
    if (!id || !bolsillo.items) return;
    // Los que la web no conoce, tal cual; los demás, como estén ahora (en huecos de 99 como mucho)
    const desconocidos = bolsillo.items.filter((entrada) => !t.objetos[valorDe((entrada.items || [])[0])]);
    const nuevos = [];
    for (const { objeto, cantidad } of mochila[id] || []) {
      const propio = objetoDelJuego(objeto);
      let quedan = Math.max(0, Math.min(999, Math.round(cantidad) || 0));
      if (!propio) continue;
      while (quedan > 0) {
        const aqui = Math.min(MAX_POR_HUECO, quedan);
        nuevos.push({ t: "arr", items: [nodoEntero(propio), nodoEntero(aqui)] });
        quedan -= aqui;
      }
    }
    bolsillo.items = [...nuevos, ...desconocidos];
  });
  return escribirNodos(nodos);
}
