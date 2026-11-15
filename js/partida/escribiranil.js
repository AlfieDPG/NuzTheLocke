// ---------- Editar una partida de Pokémon Añil ----------
//
// Las mismas piezas que GS Vitro (./escribirvitro.js) y los demás juegos (ver ./formato.js): los
// huecos del equipo y las cajas, cada Pokémon como «editable» y la bolsa. La partida (un solo
// objeto de Ruby: ver ./anil.js) se lee entera como nodos de Marshal (./marshal-arbol.js) y se
// vuelve a escribir igual, con lo que se haya cambiado.
//
// Cada Pokémon «crudo» son 4 bytes con su PID (la llave) y, detrás, el objeto Pokemon de Ruby
// guardado él solo. A diferencia de Vitro, Essentials 21 lo guarda todo por su nombre interno
// (:FENNEKIN, :SCRATCH...) y deja escritos el nivel, el género, la naturaleza y la habilidad: aquí
// se pasan de los números de la web a esos nombres (datos/partida-anil.json, al revés) y las
// estadísticas se vuelven a calcular como calc_stats del juego. Lo que el editor no toca (cintas,
// marcas, lo propio de Añil...) se queda como estaba.

import { leerNodos, escribirNodos, variable, ponerVariable, valorDe, nodoEntero, nodoBool, nodoNil, copiarNodo } from "./marshal-arbol.js";
import {
  tablasAnil, moteDeAnil, filaAnil, generoAnil, shinyAnil, naturalezaAnil, huecoHabilidadAnil, habilidadPorHueco,
  nivelPorExperiencia, NATURALEZAS_ANIL, aprendeAnil
} from "./anil.js";
import { experienciaPara } from "./convertir.js";
import { OBJETOS_EN } from "./datos-3ds.js";

// Las balls del editor, por su número (del 1 al 26, como en js/versus/editor-comun.js); en Añil
// van como objetos (:POKEBALL)
const BALLS = [
  "Master Ball", "Ultra Ball", "Great Ball", "Poke Ball", "Safari Ball", "Net Ball", "Dive Ball", "Nest Ball",
  "Repeat Ball", "Timer Ball", "Luxury Ball", "Premier Ball", "Dusk Ball", "Heal Ball", "Quick Ball", "Cherish Ball",
  "Fast Ball", "Level Ball", "Lure Ball", "Heavy Ball", "Love Ball", "Friend Ball", "Moon Ball", "Sport Ball", "Dream Ball", "Beast Ball"
];
const sinAcentos = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ballDeObjeto = (objeto) => BALLS.findIndex((b) => sinAcentos(b) === sinAcentos(OBJETOS_EN[objeto])) + 1;
const objetoDeBall = (ball) => OBJETOS_EN.findIndex((n) => n && sinAcentos(n) === sinAcentos(BALLS[ball - 1]));

export const CAJAS_EDITABLES_ANIL = 50;
const POR_CAJA = 30;
const MAX_MOTE = 12;
const MAX_ENTRENADOR = 13; // MAX_PLAYER_NAME_SIZE de sus ajustes
const INTERCAMBIADO = 2; // obtain_method
export const LUGAR_INTERCAMBIO_ANIL = 0; // en el editable: los intercambiados (y los creados en la web)
const PASOS_POR_CICLO = 256;
const MAX_POR_HUECO = 999; // BAG_MAX_PER_SLOT

// Los bolsillos de Añil (bag_pocket_names de sus ajustes) con los nombres de la web (js/versus/bolsa.js)
const BOLSILLOS = [null, "objetos", "medicinas", "balls", "mt", "bayas", "megapiedras", "combate", "clave"];

// Las estadísticas: el orden de la web es el mismo que el de sus tablas (PS, At, Def, AtE, DfE, Vel)
const STATS = ["HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED"];
const VARIABLES_STATS = ["@totalhp", "@attack", "@defense", "@spatk", "@spdef", "@speed"];
// La que sube o baja cada naturaleza (número / 5 y número % 5: At, Def, Vel, AtE, DfE), en el orden de la web
const STAT_NATURALEZA = [1, 2, 5, 3, 4];

// ---------- Tablas al revés (de la web al juego) ----------

let inversas = null;

function tablas() {
  const t = tablasAnil();
  if (!t) throw new Error("Faltan los datos de Pokémon Añil.");
  if (!inversas) {
    const alReves = (tabla) => {
      const mapa = new Map();
      for (const [simbolo, web] of Object.entries(tabla)) if (web && !mapa.has(web)) mapa.set(web, simbolo);
      return mapa;
    };
    inversas = { especies: alReves(t.especies), ataques: alReves(t.ataques), objetos: alReves(t.objetos), habilidades: alReves(t.habilidades) };
  }
  return t;
}

// Si un ataque u objeto de la web existe en Añil (para las listas del editor)
export function existeEnAnil(tipo, id) {
  tablas();
  if (tipo === "ataques") return inversas.ataques.has(id);
  if (tipo === "objetos") return inversas.objetos.has(id);
  return true;
}

// El bolsillo de la bolsa donde va un objeto de la web («medicinas»...), o ""
export function bolsilloAnil(objetoWeb) {
  const t = tablas();
  return BOLSILLOS[t.bolsillos[inversas.objetos.get(objetoWeb)]] || "";
}

// Las habilidades de una especie como las quiere el editor: [{ id, num: 1 | 2 | 4 (oculta) }]
export function habilidadesAnil(especie, forma = 0) {
  tablas();
  const fila = filaAnil(inversas.especies.get(especie) || "", forma);
  const lista = [[fila.h[0], 1], [fila.h[1], 2], ...fila.o.map((id) => [id, 4])];
  const vistas = new Set();
  return lista.filter(([id]) => id && !vistas.has(id) && vistas.add(id)).map(([id, num]) => ({ id, num }));
}

// Lo general de una especie para el editor: género, amistad de base y ciclos del huevo
export function especieAnil(especie, forma = 0) {
  tablas();
  const fila = filaAnil(inversas.especies.get(especie) || "", forma);
  const generoRatio = fila.g === 255 ? -1 : Math.round((fila.g / 254) * 8);
  return { generoRatio, felicidad: fila.f, ciclos: fila.c, bases: fila.b };
}

// Los lugares del juego que se pueden elegir: uno por lugar de «Rutas» (el primer mapa que lo es)
export function lugaresAnil() {
  const vistos = new Map();
  for (const [mapa, lugar] of Object.entries(tablas().lugares)) {
    if (!vistos.has(lugar)) vistos.set(lugar, Number(mapa));
  }
  return [...vistos].map(([lugar, mapa]) => ({ id: mapa, es: lugar }));
}

export { aprendeAnil };

// ---------- Nodos ----------

// Un texto como los guarda Ruby 3 (con la marca de UTF-8)
const nodoTexto = (texto) => ({ t: "str", bytes: new TextEncoder().encode(texto), extra: [["E", { t: "true" }]] });
const nodoSimbolo = (v) => ({ t: "sym", v });
const simboloONil = (v) => (v ? nodoSimbolo(v) : nodoNil());

// Una entrada de la tabla de arriba (:player, :bag, :storage_system...)
function entrada(nodos, nombre) {
  const par = nodos[0].pares.find(([clave]) => clave.t === "sym" && clave.v === nombre);
  return par ? par[1] : null;
}

const abiertas = new WeakMap(); // bytes -> nodos (para no volver a leerla en cada hueco)

function nodosDe(bytes) {
  if (!abiertas.has(bytes)) {
    const nodos = leerNodos(bytes);
    const jugador = nodos[0] && nodos[0].t === "hash" ? entrada(nodos, "player") : null;
    if (!jugador || jugador.clase !== "Player") throw new Error("No parece una partida de Pokémon Añil.");
    abiertas.set(bytes, nodos);
  }
  return abiertas.get(bytes);
}

const equipoDe = (nodos) => variable(entrada(nodos, "player"), "@party");
const cajaDe = (nodos, caja) => {
  const cajas = variable(entrada(nodos, "storage_system"), "@boxes");
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

export function leerHuecoAnil(bytes, sitio) {
  const nodos = nodosDe(bytes);
  const lista = sitio.equipo !== undefined ? equipoDe(nodos) : cajaDe(nodos, sitio.caja);
  const i = sitio.equipo !== undefined ? sitio.equipo : sitio.hueco;
  const nodo = lista && lista.items[i];
  return nodo && nodo.t === "obj" ? crudoDe(nodo) : null;
}

export function huecoVacioAnil() {
  return VACIO;
}

export function cuantosEquipoAnil(bytes) {
  return equipoDe(nodosDe(bytes)).items.length;
}

// cambios: [{ sitio, crudo }] (crudo vacío: quitarlo). cuantosEquipo: cuántos quedan en el equipo
export function editarHuecosAnil(bytes, cambios, cuantosEquipo) {
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
  const largo = cuantosEquipo !== undefined ? cuantosEquipo : equipo.items.length;
  equipo.items = equipo.items.slice(0, largo).filter(Boolean);
  return escribirNodos(nodos);
}

export function sePuedeEditarAnil() {
  return { ok: true };
}

export function entrenadorAnil(bytes) {
  const nodos = nodosDe(bytes);
  const jugador = entrada(nodos, "player");
  const primero = equipoDe(nodos).items.find((n) => n && n.t === "obj");
  return {
    nombre: valorDe(variable(jugador, "@name")) || "",
    id: (valorDe(variable(jugador, "@id")) || 0) >>> 0,
    version: 0,
    idioma: 7,
    plantilla: primero ? crudoDe(primero) : null
  };
}

// ---------- Un Pokémon ----------

const num = (nodo, nombre) => {
  const v = valorDe(variable(nodo, nombre));
  return typeof v === "number" ? v : 0;
};
const guardado = (nodo, nombre) => {
  const v = valorDe(variable(nodo, nombre));
  return v === undefined ? null : v;
};
const pidDe = (nodo) => num(nodo, "@personalID") >>> 0;
const simboloDe = (nodo, nombre) => {
  const n = variable(nodo, nombre);
  return n && n.t === "sym" ? n.v : "";
};
const dueno = (nodo) => variable(nodo, "@owner");

function filaDe(nodo) {
  return filaAnil(simboloDe(nodo, "@species"), num(nodo, "@form"));
}

// Una tabla de estadísticas (:HP => 31...) en el orden de la web
function stats(nodo, nombre) {
  const tabla = variable(nodo, nombre);
  const valor = (stat) => {
    const par = tabla && tabla.pares && tabla.pares.find(([clave]) => clave.t === "sym" && clave.v === stat);
    return par ? Number(valorDe(par[1])) || 0 : 0;
  };
  return STATS.map(valor);
}

function ponerStats(nodo, nombre, valores, maximo) {
  const tabla = variable(nodo, nombre);
  const limpio = (v) => nodoEntero(Math.max(0, Math.min(maximo, Math.round(Number(v) || 0))));
  if (tabla && tabla.t === "hash") {
    STATS.forEach((stat, i) => {
      const par = tabla.pares.find(([clave]) => clave.t === "sym" && clave.v === stat);
      if (par) par[1] = limpio(valores[i]);
      else tabla.pares.push([nodoSimbolo(stat), limpio(valores[i])]);
    });
  } else {
    ponerVariable(nodo, nombre, { t: "hash", pares: STATS.map((stat, i) => [nodoSimbolo(stat), limpio(valores[i])]) });
  }
}

const NUM_HABILIDAD = (hueco) => (hueco >= 2 ? 4 : hueco + 1); // hueco de Essentials -> 1, 2 o 4 (oculta) del editor

function nivelDe(nodo) {
  return num(nodo, "@level") || nivelPorExperiencia(filaDe(nodo).r, num(nodo, "@exp"));
}

export function leerEditableAnil(crudo) {
  const t = tablas();
  const nodo = nodoDe(crudo);
  const especie = t.especies[simboloDe(nodo, "@species")] || 0;
  const fila = filaDe(nodo);
  const pid = pidDe(nodo);
  const huevo = num(nodo, "@steps_to_hatch") > 0;
  const hueco = huecoHabilidadAnil(guardado(nodo, "@ability_index"), pid);
  const nombre = valorDe(variable(nodo, "@name"));
  const mote = huevo ? "" : moteDeAnil(typeof nombre === "string" ? nombre : "", especie);
  const movimientos = (variable(nodo, "@moves") || { items: [] }).items;
  return {
    especie,
    forma: num(nodo, "@form"),
    genero: generoAnil(guardado(nodo, "@gender"), pid, fila),
    apodado: Boolean(mote),
    mote,
    shiny: shinyAnil(guardado(nodo, "@shiny"), pid, num(dueno(nodo), "@id") >>> 0),
    objeto: t.objetos[simboloDe(nodo, "@item")] || 0,
    habilidad: t.habilidades[simboloDe(nodo, "@ability")] || habilidadPorHueco(fila, hueco, pid),
    numHabilidad: NUM_HABILIDAD(hueco),
    naturaleza: naturalezaAnil(simboloDe(nodo, "@nature"), pid),
    experiencia: num(nodo, "@exp"),
    nivel: nivelDe(nodo),
    evs: stats(nodo, "@ev"),
    ivs: stats(nodo, "@iv"),
    amistad: huevo ? Math.min(255, Math.ceil(num(nodo, "@steps_to_hatch") / PASOS_POR_CICLO)) : num(nodo, "@happiness"),
    ataques: [0, 1, 2, 3].map((i) => {
      const m = movimientos[i];
      const simbolo = m && m.t === "obj" ? simboloDe(m, "@id") : "";
      return { id: t.ataques[simbolo] || 0, pp: simbolo ? num(m, "@pp") : 0, masPP: simbolo ? num(m, "@ppup") : 0 };
    }),
    huevo,
    ball: ballDeObjeto(t.objetos[simboloDe(nodo, "@poke_ball")]) || 4,
    lugar: num(nodo, "@obtain_method") === INTERCAMBIADO ? LUGAR_INTERCAMBIO_ANIL : num(nodo, "@obtain_map"),
    version: 0,
    entrenador: valorDe(variable(dueno(nodo), "@name")) || "",
    idioma: 7,
    enEquipo: true
  };
}

// Las estadísticas, como calc_stats del juego (con las bases de su especie y forma), y los PS:
// llenos si no estaba debilitado
function calcularEstadisticas(nodo) {
  const fila = filaDe(nodo);
  const nivel = nivelDe(nodo);
  const ivs = stats(nodo, "@iv");
  const evs = stats(nodo, "@ev");
  const naturaleza = naturalezaAnil(simboloDe(nodo, "@nature"), pidDe(nodo));
  const sube = STAT_NATURALEZA[Math.floor(naturaleza / 5)];
  const baja = STAT_NATURALEZA[naturaleza % 5];
  const valores = fila.b.map((base, i) => {
    const bruto = Math.floor(((base * 2 + ivs[i] + Math.floor(evs[i] / 4)) * nivel) / 100);
    if (i === 0) return base === 1 ? 1 : bruto + nivel + 10;
    const efecto = sube === baja ? 100 : i === sube ? 110 : i === baja ? 90 : 100;
    return Math.floor(((bruto + 5) * efecto) / 100);
  });
  const antes = num(nodo, "@totalhp");
  const psAntes = num(nodo, "@hp");
  VARIABLES_STATS.forEach((nombre, i) => ponerVariable(nodo, nombre, nodoEntero(valores[i])));
  ponerVariable(nodo, "@hp", nodoEntero(psAntes <= 0 && antes > 0 ? 0 : valores[0]));
}

function nodoAtaque(simbolo, pp, masPP) {
  return { t: "obj", clase: "Pokemon::Move", iv: [["@id", nodoSimbolo(simbolo)], ["@ppup", nodoEntero(masPP)], ["@pp", nodoEntero(pp)]] };
}

// Copia del Pokémon con los cambios (editable: como el de leerEditableAnil)
export function aplicarEditableAnil(crudo, editable) {
  const t = tablas();
  const e = editable;
  const antes = leerEditableAnil(crudo);
  const nodo = nodoDe(crudo);
  const huevo = e.huevo === undefined ? antes.huevo : Boolean(e.huevo);

  if (e.especie !== antes.especie) {
    const simbolo = inversas.especies.get(e.especie);
    if (!simbolo) throw new Error("Esa especie no está en Pokémon Añil.");
    ponerVariable(nodo, "@species", nodoSimbolo(simbolo));
    ponerVariable(nodo, "@form", nodoEntero(0));
  }
  const fila = filaDe(nodo);
  ponerVariable(nodo, "@item", simboloONil(e.objeto ? inversas.objetos.get(e.objeto) : ""));

  // Habilidad: el hueco de la especie donde está la elegida (o el que diga el editor), y la
  // habilidad escrita (Essentials 21 la guarda)
  let hueco = [0, 1].find((h) => fila.h[h] && fila.h[h] === e.habilidad);
  if (hueco === undefined) {
    const oculta = fila.o.indexOf(e.habilidad);
    hueco = oculta >= 0 ? 2 + oculta : { 1: 0, 2: 1, 4: 2 }[e.numHabilidad] ?? 0;
  }
  ponerVariable(nodo, "@ability_index", nodoEntero(hueco));
  ponerVariable(nodo, "@ability", simboloONil(inversas.habilidades.get(e.habilidad) || ""));

  ponerVariable(nodo, "@nature", nodoSimbolo(NATURALEZAS_ANIL[e.naturaleza] || "HARDY"));
  ponerVariable(nodo, "@gender", nodoEntero(e.genero === "F" ? 1 : e.genero === "M" ? 0 : 2));
  if (e.shiny !== antes.shiny) ponerVariable(nodo, "@shiny", nodoBool(e.shiny));
  const ball = e.ball ? inversas.objetos.get(objetoDeBall(e.ball)) : "";
  if (ball) ponerVariable(nodo, "@poke_ball", nodoSimbolo(ball));

  // La experiencia solo cambia si cambia el nivel o la especie (así no se pierde lo que llevaba)
  const nivel = Math.max(1, Math.min(100, e.nivel));
  if (e.especie !== antes.especie || nivel !== antes.nivel) {
    ponerVariable(nodo, "@exp", nodoEntero(experienciaPara(fila.r, nivel)));
    ponerVariable(nodo, "@level", nodoEntero(nivel));
  }

  // Huevo: los ciclos que le faltan (en el editor van donde la amistad)
  if (huevo) ponerVariable(nodo, "@steps_to_hatch", nodoEntero(Math.max(1, (Number(e.amistad) || 1) * PASOS_POR_CICLO)));
  else {
    if (antes.huevo) ponerVariable(nodo, "@steps_to_hatch", nodoEntero(0));
    ponerVariable(nodo, "@happiness", nodoEntero(Math.max(0, Math.min(255, Number(e.amistad) || 0))));
  }

  // Dónde se conoció: «Intercambio» (0) lo deja como intercambiado
  if (e.lugar !== undefined && !huevo && e.lugar !== antes.lugar) {
    if (e.lugar === LUGAR_INTERCAMBIO_ANIL) ponerVariable(nodo, "@obtain_method", nodoEntero(INTERCAMBIADO));
    else {
      ponerVariable(nodo, "@obtain_map", nodoEntero(e.lugar));
      if (num(nodo, "@obtain_method") === INTERCAMBIADO) ponerVariable(nodo, "@obtain_method", nodoEntero(0));
    }
  }
  const entrenador = String(e.entrenador ?? antes.entrenador).trim();
  if (entrenador && entrenador !== antes.entrenador && dueno(nodo)) ponerVariable(dueno(nodo), "@name", nodoTexto(entrenador.slice(0, MAX_ENTRENADOR)));

  ponerStats(nodo, "@ev", e.evs || [], 252);
  ponerStats(nodo, "@iv", e.ivs || [], 31);

  // El mote: sin él, nil (Essentials 21 enseña entonces el nombre de la especie)
  const mote = huevo ? "" : String(e.mote || "").trim().slice(0, MAX_MOTE);
  if (huevo !== antes.huevo || mote !== antes.mote || e.especie !== antes.especie) {
    ponerVariable(nodo, "@name", mote ? nodoTexto(mote) : nodoNil());
  }

  // Los ataques: los que haya (Essentials 21 no guarda huecos vacíos), con sus PP como mucho los del juego
  const ataques = [];
  for (const a of (e.ataques || []).slice(0, 4)) {
    const simbolo = a && a.id ? inversas.ataques.get(a.id) : "";
    if (!simbolo) continue;
    const masPP = Math.max(0, Math.min(3, a.masPP || 0));
    const total = Math.floor(((t.pp[simbolo] || 1) * (5 + masPP)) / 5);
    ataques.push(nodoAtaque(simbolo, Math.max(0, Math.min(total, a.pp ?? total)), masPP));
  }
  ponerVariable(nodo, "@moves", { t: "arr", items: ataques });

  calcularEstadisticas(nodo);
  return crudoDe(nodo);
}

// En Essentials el equipo y las cajas guardan lo mismo
export function paraEquipoAnil(crudo) {
  return new Uint8Array(crudo);
}

export function paraCajaAnil(crudo) {
  return new Uint8Array(crudo);
}

function alAzar() {
  const numero = new Uint32Array(1);
  crypto.getRandomValues(numero);
  return numero[0] & 0x3fffffff; // que quepa en un entero de Ruby (Fixnum) al guardarlo
}

// Copia con otro PID. Lo que el juego saca del PID (naturaleza, género, habilidad, shiny) se deja
// escrito antes, para que la copia sea igual
export function conLlaveNuevaAnil(crudo) {
  const antes = leerEditableAnil(crudo);
  const nodo = nodoDe(crudo);
  ponerVariable(nodo, "@nature", nodoSimbolo(NATURALEZAS_ANIL[antes.naturaleza] || "HARDY"));
  ponerVariable(nodo, "@gender", nodoEntero(antes.genero === "F" ? 1 : antes.genero === "M" ? 0 : 2));
  ponerVariable(nodo, "@ability_index", nodoEntero(huecoHabilidadAnil(guardado(nodo, "@ability_index"), pidDe(nodo))));
  ponerVariable(nodo, "@shiny", nodoBool(antes.shiny));
  ponerVariable(nodo, "@personalID", nodoEntero(alAzar() || 1));
  return crudoDe(nodo);
}

// Un Pokémon nuevo, del entrenador de la partida (entrenadorAnil), «intercambiado» hoy: así no
// cuenta como captura de ninguna ruta. Se parte de uno de su equipo (las variables propias de
// Añil) y se deja todo lo demás como uno recién creado.
export function crearPokemonAnil(entrenador, editable) {
  if (!entrenador.plantilla) throw new Error("No hay ningún Pokémon en el equipo de la partida.");
  tablas();
  const simbolo = inversas.especies.get(editable.especie);
  if (!simbolo) throw new Error("Esa especie no está en Pokémon Añil.");
  const nodo = copiarNodo(nodoDe(entrenador.plantilla));
  const nivel = Math.max(1, Math.min(100, editable.nivel));
  const fila = filaAnil(simbolo, 0);
  const iniciales = {
    "@species": nodoSimbolo(simbolo),
    "@form": nodoEntero(0),
    "@personalID": nodoEntero(alAzar()),
    "@timeReceived": nodoEntero(Math.floor(Date.now() / 1000)),
    "@exp": nodoEntero(experienciaPara(fila.r, nivel)),
    "@level": nodoEntero(nivel),
    "@obtain_method": nodoEntero(INTERCAMBIADO),
    "@obtain_map": nodoEntero(0),
    "@obtain_level": nodoEntero(nivel),
    "@obtain_text": nodoNil(),
    "@hatched_map": nodoEntero(0),
    "@steps_to_hatch": nodoEntero(0),
    "@status": nodoSimbolo("NONE"),
    "@statusCount": nodoEntero(0),
    "@ribbons": { t: "arr", items: [] },
    "@first_moves": { t: "arr", items: [] },
    "@mail": nodoNil(),
    "@fused": nodoNil(),
    "@pokerus": nodoEntero(0),
    "@hp": nodoEntero(1),
    "@totalhp": nodoEntero(1),
    "@name": nodoNil()
  };
  for (const [nombre, valor] of Object.entries(iniciales)) ponerVariable(nodo, nombre, valor);
  // El dueño: el de la partida
  const suyo = dueno(nodo);
  if (suyo) {
    ponerVariable(suyo, "@id", nodoEntero(entrenador.id));
    ponerVariable(suyo, "@name", nodoTexto(entrenador.nombre));
  }
  return aplicarEditableAnil(crudoDe(nodo), { ...editable, lugar: LUGAR_INTERCAMBIO_ANIL });
}

export function esHuevoAnil(crudo) {
  return num(nodoDe(crudo), "@steps_to_hatch") > 0;
}

export function especieDeAnil(crudo) {
  return tablas().especies[simboloDe(nodoDe(crudo), "@species")] || 0;
}

export function formaDeAnil(crudo) {
  return num(nodoDe(crudo), "@form");
}

export const POKEMON_ANIL = {
  leerEditable: leerEditableAnil,
  aplicarEditable: aplicarEditableAnil,
  crearPokemon: crearPokemonAnil,
  conLlaveNueva: conLlaveNuevaAnil,
  paraEquipo: paraEquipoAnil,
  paraCaja: paraCajaAnil,
  esHuevo: esHuevoAnil,
  especieDe: especieDeAnil,
  formaDe: formaDeAnil,
  lugarIntercambio: LUGAR_INTERCAMBIO_ANIL,
  maxMote: MAX_MOTE,
  maxEntrenador: MAX_ENTRENADOR
};

// ---------- La bolsa ----------
//
// :bag es un PokemonBag: @pockets, una lista por bolsillo (la 0 no se usa) de [objeto, cantidad],
// con el objeto por su nombre (:POTION). Los que la web no conoce (objetos propios de Añil, objetos
// clave del juego...) no se ven, pero se quedan donde estaban.

export function bolsillosAnil() {
  return BOLSILLOS.slice(1).map((id) => ({ id, caben: 999, maximo: 999 }));
}

export function leerMochilaEditableAnil(bytes) {
  const t = tablas();
  const bolsillos = variable(entrada(nodosDe(bytes), "bag"), "@pockets");
  const mochila = Object.fromEntries(BOLSILLOS.slice(1).map((id) => [id, []]));
  (bolsillos ? bolsillos.items : []).forEach((bolsillo, i) => {
    const id = BOLSILLOS[i];
    if (!id || !bolsillo.items) return;
    for (const hueco of bolsillo.items) {
      const [objeto, cantidad] = (hueco.items || []).map(valorDe);
      const web = t.objetos[objeto];
      if (!web) continue;
      const ya = mochila[id].find((e) => e.objeto === web);
      if (ya) ya.cantidad += cantidad || 0;
      else mochila[id].push({ objeto: web, cantidad: cantidad || 0 });
    }
  });
  return mochila;
}

export function escribirMochilaAnil(original, mochila) {
  const t = tablas();
  const nodos = leerNodos(original);
  const bolsillos = variable(entrada(nodos, "bag"), "@pockets");
  bolsillos.items.forEach((bolsillo, i) => {
    const id = BOLSILLOS[i];
    if (!id || !bolsillo.items) return;
    const desconocidos = bolsillo.items.filter((hueco) => !t.objetos[valorDe((hueco.items || [])[0])]);
    const nuevos = [];
    for (const { objeto, cantidad } of mochila[id] || []) {
      const simbolo = inversas.objetos.get(objeto);
      let quedan = Math.max(0, Math.min(999, Math.round(cantidad) || 0));
      if (!simbolo) continue;
      while (quedan > 0) {
        const aqui = Math.min(MAX_POR_HUECO, quedan);
        nuevos.push({ t: "arr", items: [nodoSimbolo(simbolo), nodoEntero(aqui)] });
        quedan -= aqui;
      }
    }
    bolsillo.items = [...nuevos, ...desconocidos];
  });
  return escribirNodos(nodos);
}

export function esPartidaEditableAnil(bytes) {
  try {
    nodosDe(bytes);
    return true;
  } catch (error) {
    return false;
  }
}
