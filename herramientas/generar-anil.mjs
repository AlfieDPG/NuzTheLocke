// Tablas de Pokémon Añil (Essentials 21) para la web: datos/partida-anil.json, datos/partida-anil-aprende.json y
// datos/propios-anil.json. Uso: node herramientas/generar-anil.mjs (con el juego en la carpeta de D, abajo).
// OJO: los propios (30001...) se numeran por orden: comprobar que no cambian al regenerar (js/comun/propios.js).
import { readFileSync, writeFileSync } from "fs";
import { leerTodosMarshal } from "file:///c:/Users/alfon/Documents/Proyectos/Pokelocke/js/partida/marshal.js";
import { OBJETOS_EN } from "file:///c:/Users/alfon/Documents/Proyectos/Pokelocke/js/partida/datos-3ds.js";
const WEB = "c:/Users/alfon/Documents/Proyectos/Pokelocke/";
const D = "C:/Users/alfon/Desktop/Juegos/Pokemon/Pokemon Anil v4.14/Data/";
const leer = (f) => leerTodosMarshal(new Uint8Array(readFileSync(D + f)))[0];
const nombres = JSON.parse(readFileSync(WEB + "datos/nombres.json", "utf8"));
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/♀/g, "F").replace(/♂/g, "M").toUpperCase().replace(/[^A-Z0-9]/g, "");
const sim = (v) => (v && v.simbolo) || String(v).replace(/^:/, "");

// Los propios de Añil (no existen en los juegos): con un número desde PRIMER_PROPIO, su nombre y su
// descripción del juego
const PRIMER_PROPIO = 30001;
function tabla(lista, archivo, extra = {}, propios = null) {
  const porEn = new Map(), porEs = new Map();
  for (const e of lista) { if (!porEn.has(norm(e.en))) porEn.set(norm(e.en), e.id); if (!porEs.has(norm(e.es))) porEs.set(norm(e.es), e.id); }
  const salida = {}, faltan = [];
  for (const [k, v] of leer(archivo)) {
    const s = sim(v["@id"]);
    const id = extra[s] || porEn.get(norm(s)) || porEs.get(norm(v["@real_name"]));
    if (id) salida[s] = id;
    else if (propios) {
      const nuevo = PRIMER_PROPIO + propios.length;
      salida[s] = nuevo;
      propios.push({ id: nuevo, v });
    } else faltan.push(`${s} (${v["@real_name"]})`);
  }
  return { salida, faltan };
}

// Especies: solo la forma 0 (la forma va aparte, en @form)
const especies = {}, faltanEsp = [];
// Lo de cada especie (y forma) que hace falta para editar: { "FENNEKIN" | "RATTATA_1": { h: [hab. 1, hab. 2],
// o: [ocultas], g: probabilidad de hembra (0-254; 255 sin género), r: ritmo de crecimiento (el de
// convertir.js), f: amistad de base, b: estadísticas base (orden de la web), c: ciclos del huevo } }
const filas = {};
const HEMBRA = { AlwaysMale: 0, FemaleOneEighth: 32, Female25Percent: 64, Female50Percent: 128, Female75Percent: 192, FemaleSevenEighths: 224, AlwaysFemale: 254, Genderless: 255 };
const RITMO = { Medium: 2, Slow: 1, Fast: 3, Parabolic: 4, Erratic: 5, Fluctuating: 6 };
const ORDEN_STATS = ["HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED"];
const aprende = {};
{
  const porEn = new Map(nombres.pokemon.map((p) => [norm(p.en), p.id]));
  const porEs = new Map(nombres.pokemon.map((p) => [norm(p.es), p.id]));
  for (const [, v] of leer("species.dat")) {
    if (v["@form"]) continue;
    const s = sim(v["@id"]);
    const id = porEn.get(norm(s)) || porEs.get(norm(v["@real_name"])) || porEn.get(norm(v["@real_name"]));
    if (id) especies[s] = id; else faltanEsp.push(s);
  }
}
// Los Pokémon propios de Añil (Royaleon, Cefireon): números desde el 20001, en el orden de sus datos
const PRIMERA_ESPECIE_PROPIA = 20001;
faltanEsp.forEach((s, i) => (especies[s] = PRIMERA_ESPECIE_PROPIA + i));
const ataquesPropios = [], habilidadesPropias = [];
const ataques = tabla(nombres.ataques, "moves.dat", {}, ataquesPropios);
const habilidades = tabla(nombres.habilidades, "abilities.dat", { ASONECHILLINGNEIGH: 266, ASONEGRIMNEIGH: 267 }, habilidadesPropias);
const CLASES = ["fisico", "especial", "estado"];
const propios = {
  ataques: ataquesPropios.map(({ id, v }) => ({
    id, es: v["@real_name"], descripcion: v["@real_description"] || "", tipo: sim(v["@type"]).toLowerCase(),
    clase: CLASES[v["@category"]] || "estado", potencia: v["@power"] || 0, precision: v["@accuracy"] || 0, pp: v["@total_pp"] || 0
  })),
  habilidades: habilidadesPropias.map(({ id, v }) => ({ id, es: v["@real_name"], descripcion: v["@real_description"] || "" }))
};
// Los PP de cada ataque (para editar)
const pp = {};
for (const [, v] of leer("moves.dat")) pp[sim(v["@id"])] = v["@total_pp"] || 0;

// Objetos: número en OBJETOS_EN (el primero con ese nombre); si no, por el español de datos/nombres.json
const objetos = {}, faltanObj = [];
{
  const indice = new Map();
  OBJETOS_EN.forEach((n, i) => { if (n && !indice.has(norm(n))) indice.set(norm(n), i); });
  const esAEn = new Map(nombres.objetos.map((o) => [norm(o.es), o.en]));
  for (const [, v] of leer("items.dat")) {
    const s = sim(v["@id"]);
    const i = indice.get(norm(s)) ?? indice.get(norm(esAEn.get(norm(v["@real_name"])))) ?? indice.get(norm(v["@real_name"]));
    if (i) objetos[s] = i; else faltanObj.push(`${s} (${v["@real_name"]})`);
  }
}

// Las filas de cada especie y forma, y lo que aprende por nivel (la forma 0), ya con los números de la web
const idHab = (x) => habilidades.salida[sim(x)] || 0;
for (const [, v] of leer("species.dat")) {
  const clave = sim(v["@id"]);
  const bases = v["@base_stats"];
  const base = (stat) => { for (const [k, n] of bases) if (String(k).replace(/^:/, "") === stat) return n; return 1; };
  filas[clave] = {
    h: (v["@abilities"] || []).map(idHab).slice(0, 2),
    o: (v["@hidden_abilities"] || []).map(idHab),
    g: HEMBRA[sim(v["@gender_ratio"])] ?? 128,
    r: RITMO[sim(v["@growth_rate"])] || 2,
    f: v["@happiness"] ?? 70,
    b: ORDEN_STATS.map(base),
    c: Math.ceil((v["@hatch_steps"] || 5120) / 256)
  };
  if (!v["@form"] && especies[sim(v["@species"])]) {
    const lista = [];
    for (const [nivel, ataque] of v["@moves"] || []) {
      const id = ataques.salida[sim(ataque)];
      if (id) lista.push(nivel, id);
    }
    aprende[especies[sim(v["@species"])]] = lista;
  }
}
// Lo que la web necesita de los Pokémon propios (datos/propios-anil.json: pokemon): nombre, tipos,
// estadísticas base (orden de la web), habilidades, género, tamaño, Pokédex y lo que aprende
const pokemonPropios = [];
for (const [, v] of leer("species.dat")) {
  const simbolo = sim(v["@id"]);
  if (v["@form"] || !faltanEsp.includes(simbolo)) continue;
  const fila = filas[simbolo];
  const ataquesDe = (lista) => [...new Set(lista.map((a) => ataques.salida[sim(a)]).filter(Boolean))];
  pokemonPropios.push({
    id: especies[simbolo], simbolo, es: v["@real_name"],
    tipos: (v["@types"] || []).map((t) => sim(t).toLowerCase()),
    bases: fila.b, habilidades: fila.h, ocultas: fila.o, hembra: fila.g, felicidad: fila.f, ciclos: fila.c,
    altura: (v["@height"] || 0) / 10, peso: (v["@weight"] || 0) / 10,
    categoria: v["@real_category"] || "", pokedex: v["@real_pokedex_entry"] || "",
    generacion: v["@generation"] || 9,
    nivel: (v["@moves"] || []).map(([nivel, a]) => [nivel, ataques.salida[sim(a)]]).filter(([, id]) => id),
    mt: ataquesDe([...(v["@tutor_moves"] || []), ...(v["@egg_moves"] || [])]),
    evoluciona: (v["@evolutions"] || []).filter((e) => e[3]).map((e) => especies[sim(e[0])]).filter(Boolean)
  });
}
propios.pokemon = pokemonPropios;

// El bolsillo de cada objeto (1 Objetos, 2 Medicinas, 3 Balls, 4 MT, 5 Bayas, 6 Megapiedras, 7 Batalla, 8 Clave)
const bolsillos = {};
for (const [, v] of leer("items.dat")) bolsillos[sim(v["@id"])] = v["@pocket"] || 1;

// Mapas -> lugar de «Rutas» de Añil (js/rutas/datos.js); si el mapa no lo es, el de su mapa padre
const rutasJs = readFileSync(WEB + "js/rutas/datos.js", "utf8");
const bloque = rutasJs.slice(rutasJs.indexOf("  anil: {"), rutasJs.indexOf("eventos: EVENTOS_KANTO", rutasJs.indexOf("  anil: {")));
const lugaresWeb = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const IGUALES = { "Central Energía": "Central Eléctrica", "Bosque Arcoiris": "Bosque Arcoíris", "Claro Secreto": "Claro Oculto", "Ruta 25 Sur": "Ruta 25", "Ruta 25 Norte": "Ruta 25" };
const porNombre = new Map(lugaresWeb.map((l) => [norm(l), l]));
const info = leer("MapInfos.rxdata");
// Los que no se sacan por el nombre: los dos mapas de la Ruta 12 (el de arriba, junto a Lavanda, es el
// norte), las cuatro áreas de la Zona Safari (las casas de descanso, a la entrada), la Guarida Rocket
// (bajo el Casino de Azulona) y el laboratorio de la intro (el inicial, en Pueblo Paleta)
const A_MANO = {
  86: "Ruta 12 Norte", 108: "Ruta 12 Sur",
  112: "Zona Safari 1", 113: "Zona Safari 2", 114: "Zona Safari 3", 115: "Zona Safari 4",
  147: "Zona Safari 1", 148: "Zona Safari 1", 149: "Zona Safari 1",
  82: "Ciudad Azulona", 83: "Ciudad Azulona", 84: "Ciudad Azulona", 85: "Ciudad Azulona", 179: "Ciudad Azulona",
  217: "Pueblo Paleta"
};
const lugares = {}, sinLugar = [];
for (const [id, m] of info) {
  let actual = id, lugar = A_MANO[id] || "";
  for (let vueltas = 0; actual && vueltas < 10 && !lugar; vueltas++) {
    const mapa = info.get(actual);
    if (!mapa) break;
    if (A_MANO[actual]) { lugar = A_MANO[actual]; break; }
    const n = IGUALES[mapa["@name"]] || mapa["@name"];
    lugar = porNombre.get(norm(n)) || "";
    actual = mapa["@parent_id"];
  }
  if (lugar) lugares[id] = lugar; else sinLugar.push(`${id}:${m["@name"]}`);
}

writeFileSync(WEB + "datos/partida-anil.json", JSON.stringify({ especies, ataques: ataques.salida, habilidades: habilidades.salida, objetos, lugares, filas, pp, bolsillos }));
writeFileSync(WEB + "datos/propios-anil.json", JSON.stringify(propios));
writeFileSync(WEB + "datos/partida-anil-aprende.json", JSON.stringify(aprende));
console.log("propios", propios.ataques.length, propios.habilidades.length, JSON.stringify(propios.habilidades[0]), JSON.stringify(propios.ataques[0]));
console.log("especies", Object.keys(especies).length, "propias", faltanEsp.map((s) => `${s}=${especies[s]}`).join(", "));
console.log("ataques", Object.keys(ataques.salida).length, "faltan", ataques.faltan.join(", "));
console.log("habilidades", Object.keys(habilidades.salida).length, "faltan", habilidades.faltan.join(", "));
console.log("objetos", Object.keys(objetos).length, "faltan", faltanObj.length, faltanObj.slice(0, 80).join(", "));
console.log("lugares", Object.keys(lugares).length, "sin", sinLugar.join(", "));
console.log("lugares web sin mapa", lugaresWeb.filter((l) => !Object.values(lugares).includes(l)).join(", "));
