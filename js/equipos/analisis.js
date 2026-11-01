// Análisis de un equipo (botón «Analizar» de «Crear equipo»). Sin pantalla: la ventana está
// en ./analizar.js.
//
// No es la última palabra, sino una guía: cada Pokémon saca una nota de 0 a 100 en Ataque,
// Aguante y Velocidad, con el porqué, y el equipo una nota que junta la de sus miembros, la
// cobertura, los puntos débiles y el equilibrio. Todo se mide contra «un Pokémon normalito»
// de su mismo nivel (80 en todas las estadísticas base, IVs al máximo, sin EVs) y con la
// fórmula de la calculadora (../calculadora/danio.js), así que el nivel, la naturaleza, los
// EVs, los IVs, la habilidad y el objeto cuentan igual que allí:
//
//   · Ataque: cuánta vida le quita su mejor ataque a un normalito de cada uno de los 18 tipos.
//   · Aguante: cuánta le quita a él un normalito de cada tipo con un ataque de su tipo de
//     potencia 80 (uno físico y otro especial).
//   · Velocidad: la suya (con el objeto y la habilidad) frente a la del normalito.
//
// El normalito saca 50 en las tres. Las habilidades que no cambian esas cuentas (Impulso,
// Intimidación, Ausente...) suman o restan según la nota que les da Pokémon Showdown
// (datos/habilidades.json, de -1 a 5).
//
// analizarPokemon va por separado de analizarEquipo para poder probar muchos equipos con
// los mismos Pokémon sin repetir las cuentas de cada uno. Con eso, además:
//
//   · buscarEquipos: los mejores equipos de una caja, con los que quieras fijos (./buscar.js)
//   · sugerirMejoras: el objeto o el tipo de ataque que más subiría la nota (./analizar.js)

import { calcularDanio, velocidad, statEnCombate, textoHabilidad, efectoObjeto, clave } from "../calculadora/danio.js";
import { statsFinales, entrenoDe } from "./entreno.js";
import { TIPOS } from "../comun/efectividad.js";
import { tiposEs } from "../comun/tipos.js";
import { t, nombre } from "../comun/idioma.js";

// Lo que pesa cada cosa. Está todo aquí para ir afinándolo con equipos de verdad.
export const PESOS = {
  // La nota de cada Pokémon (los tres suman 1)
  ataque: 0.45,
  aguante: 0.35,
  velocidad: 0.2,
  // Puntos por cada punto de nota de Showdown por encima (o por debajo) de 2, «útil»
  habilidad: 2.5,
  // Ataques que valen algo además del daño: subirse estadísticas, curarse, dejar un estado al
  // rival, poner trampas (Trampa Rocas, Púas: dañan a cada Pokémon que saque el rival),
  // barreras (Reflejo, Pantalla de Luz) y frenar al rival (Red Viscosa, Viento Hielo, Viento
  // Afín, Espacio Raro...)
  estado: { sube: 4, cura: 3, altera: 3, trampa: 3, barrera: 3, frena: 2, tope: 10 },
  // Lo que suma una Hierba Blanca o una Hierba Única que le sirve
  hierba: 2,

  // La nota del equipo (los cuatro suman 1)
  miembros: 0.55,
  cobertura: 0.2,
  defensa: 0.15,
  equilibrio: 0.1,
  // Lo que se resta de 100 en defensa por cada tipo...
  tresDebiles: 15, // ...al que son débiles 3 o más
  dosSinAguante: 10, // ...al que son débiles 2 y nadie lo aguanta
  sinAguante: 4, // ...que nadie aguanta (sin ser débiles 2)
  // Lo que se resta de 100 en equilibrio
  todosIguales: 30, // todos atacan solo con físicos (o solo con especiales)
  nadieRapido: 30, // nadie es más rápido que un normalito
  nadieAguanta: 20, // nadie aguanta bien los golpes (todos atacantes frágiles)
  nadiePega: 20, // nadie pega fuerte (todos defensivos)
  tipoRepetido: 20 // por cada tipo que comparten 3 o más
};

// Quién cuenta como «aguanta bien» o «pega fuerte» para el equilibrio (su nota de Aguante o de
// Ataque, de 0 a 100: el normalito saca 50)
const DURO = 60;
const PEGADOR = 60;

// Cobertura: frente a un tipo, el mejor ataque del equipo es «fuerte» si quita al menos 1,5
// veces lo que el normalito le quita a otro normalito, y «flojo» si no llega a 0,9 veces
const FUERTE = 1.5;
const FLOJO = 0.9;
// Más rápido que el normalito a partir de un 10 % más
const RAPIDO = 1.1;

// ---------- El normalito ----------

const BASES_NORMALITO = [80, 80, 80, 80, 80, 80];

function normalito(nivel, tipos) {
  return { especie: 0, stats: statsFinales({ id: 0, entreno: { nivel } }, BASES_NORMALITO), nivel, tipos };
}

// Lo que se toma como «normal»: un ataque de su tipo de potencia 80, de un normalito a otro
function ataqueNormal(tipo, clase = "fisico") {
  return { tipo, potencia: 80, clase };
}

const referencias = new Map(); // nivel -> % que quita el normalito al normalito

function referencia(nivel) {
  if (!referencias.has(nivel)) {
    const uno = normalito(nivel, ["normal"]);
    referencias.set(nivel, porcentaje(calcularDanio(uno, uno, ataqueNormal("normal")), uno));
  }
  return referencias.get(nivel);
}

function porcentaje({ tiradas }, defensor) {
  const media = tiradas.reduce((suma, d) => suma + d, 0) / tiradas.length;
  return Math.min(100, (media / defensor.stats[0]) * 100);
}

// De «cuántas veces lo del normalito» a una nota: 1 vez = 50, el doble = 85, la mitad = 15
function puntuar(veces) {
  if (!(veces > 0)) return 0;
  return limitar(50 + 35 * Math.log2(veces));
}

function limitar(nota) {
  return Math.max(0, Math.min(100, nota));
}

// Cómo suena una nota
export function palabraNota(nota) {
  if (nota < 35) return t("analisis|Flojo");
  if (nota < 50) return t("analisis|Justo");
  if (nota < 65) return t("analisis|Bueno");
  if (nota < 80) return t("analisis|Muy bueno");
  return t("analisis|Excelente");
}

// ---------- Habilidades, objetos y ataques que la fórmula no ve ----------

// Habilidades que lastran: lo que se queda de su ataque y su velocidad
const LASTRAN = {
  truant: { ataque: 0.5, texto: "Solo ataca un turno de cada dos" },
  slowstart: { ataque: 0.6, velocidad: 0.6, texto: "Ataque y Velocidad a la mitad los primeros turnos" },
  defeatist: { ataque: 0.8, texto: "Con la mitad de PS o menos, ataca con la mitad de fuerza" }
};

// Objetos que la fórmula no ve pero ayudan: los puntos que suman (tipo: solo en los de ese tipo)
const UTILES = {
  leftovers: { puntos: 4, texto: "Recupera PS cada turno" },
  blacksludge: { puntos: 4, texto: "Recupera PS cada turno", tipo: "poison" },
  sitrusberry: { puntos: 2, texto: "Se cura al quedarse con la mitad de PS" },
  oranberry: { puntos: 1, texto: "Se cura un poco al quedarse con la mitad de PS" },
  lumberry: { puntos: 2, texto: "Se quita un problema de estado" },
  focussash: { puntos: 2, texto: "Con todos los PS, aguanta con 1 un golpe que lo tumbaría" },
  rockyhelmet: { puntos: 1, texto: "Daña al que le golpea con contacto" },
  shellbell: { puntos: 1, texto: "Recupera PS al hacer daño" },
  quickclaw: { puntos: 1, texto: "A veces ataca el primero" },
  kingsrock: { puntos: 1, texto: "A veces hace retroceder al rival" },
  razorfang: { puntos: 1, texto: "A veces hace retroceder al rival" },
  scopelens: { puntos: 1, texto: "Más golpes críticos" },
  razorclaw: { puntos: 1, texto: "Más golpes críticos" },
  brightpowder: { puntos: 1, texto: "Al rival le cuesta más acertarle" },
  laxincense: { puntos: 1, texto: "Al rival le cuesta más acertarle" }
};

// Lo que se resta por llevar un objeto que choca con sus ataques de estado (Elección, Chaleco)
const CHOCA_CON_ESTADO = 3;

// Objetos que suele haber en una partida, para sugerir sin saber qué hay en la mochila (en
// inglés, como los guarda la web)
export const OBJETOS_HABITUALES = [
  "Leftovers", "Choice Band", "Choice Specs", "Choice Scarf", "Life Orb", "Expert Belt", "Assault Vest",
  "Eviolite", "Focus Sash", "Sitrus Berry", "Lum Berry", "Muscle Band", "Wise Glasses", "Black Sludge",
  "Charcoal", "Mystic Water", "Magnet", "Miracle Seed", "Never-Melt Ice", "Black Belt", "Poison Barb",
  "Soft Sand", "Sharp Beak", "Twisted Spoon", "Silver Powder", "Hard Stone", "Spell Tag", "Dragon Fang",
  "Black Glasses", "Metal Coat", "Silk Scarf", "Fairy Feather"
];

// Ataques de estado que cuentan. sube: los ataques a los que ayuda («ambos»: todos)
const ESTADO = {
  swordsdance: { sube: "fisico" }, dragondance: { sube: "fisico" }, bulkup: { sube: "fisico" },
  coil: { sube: "fisico" }, honeclaws: { sube: "fisico" }, shiftgear: { sube: "fisico" },
  bellydrum: { sube: "fisico" }, victorydance: { sube: "fisico" }, tidyup: { sube: "fisico" },
  nastyplot: { sube: "especial" }, calmmind: { sube: "especial" }, quiverdance: { sube: "especial" },
  tailglow: { sube: "especial" }, geomancy: { sube: "especial" }, takeheart: { sube: "especial" },
  shellsmash: { sube: "ambos" }, growth: { sube: "ambos" }, workup: { sube: "ambos" },
  agility: { sube: "ambos" }, rockpolish: { sube: "ambos" }, autotomize: { sube: "ambos" },
  recover: { cura: true }, roost: { cura: true }, softboiled: { cura: true }, milkdrink: { cura: true },
  slackoff: { cura: true }, synthesis: { cura: true }, moonlight: { cura: true }, morningsun: { cura: true },
  shoreup: { cura: true }, healorder: { cura: true }, wish: { cura: true }, strengthsap: { cura: true },
  rest: { cura: true }, junglehealing: { cura: true }, lunarblessing: { cura: true },
  willowisp: { altera: true }, thunderwave: { altera: true }, toxic: { altera: true }, spore: { altera: true },
  sleeppowder: { altera: true }, hypnosis: { altera: true }, lovelykiss: { altera: true }, yawn: { altera: true },
  glare: { altera: true }, stunspore: { altera: true }, darkvoid: { altera: true }, sing: { altera: true },
  stealthrock: { trampa: true }, spikes: { trampa: true }, toxicspikes: { trampa: true }, stickyweb: { frena: true },
  reflect: { barrera: true }, lightscreen: { barrera: true }, auroraveil: { barrera: true },
  tailwind: { frena: true }, trickroom: { frena: true }, scaryface: { frena: true }, cottonspore: { frena: true },
  stringshot: { frena: true }
};

// Ataques que hacen daño y además bajan la Velocidad del rival
const FRENAN = ["icywind", "electroweb", "bulldoze", "rocktomb", "mudshot", "lowsweep", "glaciate", "drumbeating", "pounce"];

// Ataques que solo funcionan con un Pokémon (desde: la generación desde la que es así; sin
// ella, siempre). Con otro, fallan.
const SOLO_DE = {
  darkvoid: { especie: 491, quien: "Darkrai", desde: 7 },
  aurawheel: { especie: 877, quien: "Morpeko" },
  hyperspacefury: { especie: 720, quien: "Hoopa" }
};

// Los que bajan sus propias estadísticas (la Hierba Blanca se las devuelve una vez) y los que
// cargan un turno (la Hierba Única se lo ahorra una vez)
const BAJAN_LAS_SUYAS = [
  "shellsmash", "closecombat", "superpower", "overheat", "dracometeor", "leafstorm", "psychoboost", "fleurcannon",
  "hammerarm", "icehammer", "vcreate", "makeitrain", "spinout", "armorcannon", "clangingscales", "dragonascent",
  "headlongrush", "hyperspacefury"
];
const CARGAN = [
  "solarbeam", "solarblade", "skyattack", "skullbash", "razorwind", "freezeshock", "iceburn", "meteorbeam",
  "electroshot", "geomancy", "fly", "dig", "dive", "bounce", "phantomforce", "shadowforce"
];
// Con la Hierba Única, lo que se queda de los que cargan: la primera vez salen sin esperar
const CARGA_CON_HIERBA = 0.75;

// Ataques con pega: lo que se queda de su daño y por qué
const CON_PEGA = {
  explosion: [0, "{ataque} lo debilita: en un Nuzlocke, lo pierdes"],
  selfdestruct: [0, "{ataque} lo debilita: en un Nuzlocke, lo pierdes"],
  mistyexplosion: [0, "{ataque} lo debilita: en un Nuzlocke, lo pierdes"],
  finalgambit: [0, "{ataque} lo debilita: en un Nuzlocke, lo pierdes"],
  hyperbeam: [0.5, "{ataque} le obliga a descansar un turno"],
  gigaimpact: [0.5, "{ataque} le obliga a descansar un turno"],
  blastburn: [0.5, "{ataque} le obliga a descansar un turno"],
  frenzyplant: [0.5, "{ataque} le obliga a descansar un turno"],
  hydrocannon: [0.5, "{ataque} le obliga a descansar un turno"],
  rockwrecker: [0.5, "{ataque} le obliga a descansar un turno"],
  roaroftime: [0.5, "{ataque} le obliga a descansar un turno"],
  prismaticlaser: [0.5, "{ataque} le obliga a descansar un turno"],
  eternabeam: [0.5, "{ataque} le obliga a descansar un turno"],
  meteorassault: [0.5, "{ataque} le obliga a descansar un turno"],
  solarbeam: [0.5, "{ataque} tarda un turno en cargar"],
  solarblade: [0.5, "{ataque} tarda un turno en cargar"],
  skyattack: [0.5, "{ataque} tarda un turno en cargar"],
  skullbash: [0.5, "{ataque} tarda un turno en cargar"],
  razorwind: [0.5, "{ataque} tarda un turno en cargar"],
  freezeshock: [0.5, "{ataque} tarda un turno en cargar"],
  iceburn: [0.5, "{ataque} tarda un turno en cargar"],
  focuspunch: [0.5, "{ataque} falla si le golpean antes"],
  dreameater: [0.2, "{ataque} solo funciona si el rival está dormido"],
  fakeout: [0.3, "{ataque} solo funciona el primer turno"],
  firstimpression: [0.3, "{ataque} solo funciona el primer turno"]
};

// Ataques de varios golpes: cuántos da de media (con Encadenado, siempre los 5)
const VARIOS_GOLPES = {
  doublekick: 2, bonemerang: 2, dualchop: 2, doublehit: 2, dualwingbeat: 2, geargrind: 2, twineedle: 2,
  doubleironbash: 2, dragondarts: 2, twinbeam: 2, tachyoncutter: 2, surgingstrikes: 3, tripledive: 3
};
const DE_DOS_A_CINCO = [
  "bulletseed", "rockblast", "iciclespear", "pinmissile", "armthrust", "furyattack", "furyswipes", "cometpunch",
  "doubleslap", "spikecannon", "barrage", "tailslap", "watershuriken", "scaleshot", "bonerush"
];

// ---------- El clima ----------

// Las habilidades que ponen un clima al salir y los ataques que lo ponen
const PONEN_CLIMA = {
  drought: "sol", desolateland: "sol", orichalcumpulse: "sol",
  drizzle: "lluvia", primordialsea: "lluvia", sandstream: "arena", snowwarning: "nieve"
};
const ATAQUES_DE_CLIMA = { sunnyday: "sol", raindance: "lluvia", sandstorm: "arena", hail: "nieve", snowscape: "nieve" };
// Las que solo sirven con un clima (puntos: lo que suman, en el equipo, si alguien lo pone)
const USAN_CLIMA = {
  swiftswim: { clima: "lluvia", puntos: 6 }, chlorophyll: { clima: "sol", puntos: 6 },
  sandrush: { clima: "arena", puntos: 6 }, slushrush: { clima: "nieve", puntos: 6 },
  solarpower: { clima: "sol", puntos: 4 }, protosynthesis: { clima: "sol", puntos: 3 },
  sandforce: { clima: "arena", puntos: 3 }, flowergift: { clima: "sol", puntos: 2 },
  raindish: { clima: "lluvia", puntos: 2 }, hydration: { clima: "lluvia", puntos: 2 },
  icebody: { clima: "nieve", puntos: 2 }, snowcloak: { clima: "nieve", puntos: 2 },
  sandveil: { clima: "arena", puntos: 2 }, leafguard: { clima: "sol", puntos: 1 }
};
const NOMBRES_CLIMA = { sol: "clima|sol", lluvia: "clima|lluvia", arena: "clima|arena", nieve: "clima|granizo o nieve" };
// Los que no fallan con lluvia (o con nieve, Ventisca)
const NO_FALLAN = { lluvia: ["thunder", "hurricane", "bleakwindstorm", "wildboltstorm", "sandsearstorm"], nieve: ["blizzard"] };
const CURAN_CON_SOL = ["synthesis", "morningsun", "moonlight"];
const SIN_DANIO_ARENA = ["rock", "ground", "steel"];

// Con su clima, lo que le sirve (razones) y lo que le perjudica (contra: un texto o "")
//   gen: la del juego (null si no se sabe)
function suClima(clima, { tipos, danio, claves, gen }) {
  const razones = [];
  let contra = "";
  const conTipo = (tipo) => danio.some((g) => g.datos.tipo === tipo && g.factor > 0);
  const suyos = (lista) => (lista || []).filter((k) => claves.has(k));
  const conNombre = (k) => nombre(danio.find((g) => clave(g.ataque && g.ataque.en) === k)?.ataque || { es: k, en: k });
  if (claves.has("weatherball")) razones.push(t("Meteorobola cambia de tipo y dobla su potencia"));
  if (clima === "sol") {
    if (conTipo("fire")) razones.push(t("sus ataques de Fuego hacen ×1,5"));
    for (const k of suyos(["solarbeam", "solarblade"])) razones.push(t("{ataque} sale sin cargar", { ataque: conNombre(k) }));
    if (suyos(CURAN_CON_SOL).length) razones.push(t("se cura más"));
    if (claves.has("growth")) razones.push(t("Desarrollo sube el doble"));
    if (conTipo("water")) contra = t("sus ataques de Agua hacen la mitad");
  } else if (clima === "lluvia") {
    if (conTipo("water")) razones.push(t("sus ataques de Agua hacen ×1,5"));
    for (const k of suyos(NO_FALLAN.lluvia)) razones.push(t("{ataque} no falla", { ataque: conNombre(k) }));
    if (conTipo("fire")) contra = t("sus ataques de Fuego hacen la mitad");
  } else if (clima === "arena") {
    if (tipos.some((tipo) => SIN_DANIO_ARENA.includes(tipo))) razones.push(t("la arena daña al rival y a él no"));
    if (tipos.includes("rock") && !(gen && gen < 4)) razones.push(t("Def. Esp. ×1,5 por ser de tipo Roca"));
    if (claves.has("shoreup")) razones.push(t("se cura más"));
    if (!razones.length) contra = t("la arena le quita PS cada turno");
  } else if (clima === "nieve") {
    // Hasta la 8.ª generación es granizo (daña a los que no son de tipo Hielo); desde la 9.ª,
    // nieve (no daña, y los de tipo Hielo tienen Defensa ×1,5)
    const granizo = !gen || gen <= 8;
    if (tipos.includes("ice")) razones.push(gen >= 9 ? t("Defensa ×1,5 por ser de tipo Hielo") : t("el granizo daña al rival y a él no"));
    for (const k of suyos(NO_FALLAN.nieve)) razones.push(t("{ataque} no falla", { ataque: conNombre(k) }));
    if (claves.has("auroraveil") && !(gen && gen < 7)) razones.push(t("puede usar Velo Aurora"));
    if (!razones.length && granizo) contra = gen ? t("el granizo le quita PS cada turno") : t("el granizo le quita PS cada turno (hasta la 8.ª generación)");
  }
  return { razones, contra };
}

// ---------- Habilidades que solo sirven con algo ----------

const RETROCESO = [
  "doubleedge", "bravebird", "flareblitz", "woodhammer", "headsmash", "wildcharge", "volttackle", "takedown",
  "submission", "headcharge", "wavecrash", "lightofruin", "struggle"
];
const BAYAS_O_GASTABLES = ["whiteherb", "powerherb", "mentalherb", "focussash", "airballoon", "electricseed", "grassyseed", "mistyseed", "psychicseed"];
const esBaya = (objeto) => /berry$/i.test((objeto && objeto.en) || "");
const ORBES = ["flameorb", "toxicorb"];

// cumple({ claves (sus ataques), ko (su objeto), danio, deEstado (cuántos de estado), poke }): si le sirve; texto: si no
const NECESITAN = {
  rockhead: { cumple: (c) => RETROCESO.some((k) => c.claves.has(k)), texto: "solo sirve con ataques que le dañan a él (Doble Filo, Pájaro Osado...)" },
  reckless: { cumple: (c) => [...RETROCESO, "highjumpkick", "jumpkick", "axekick", "supercellslam"].some((k) => c.claves.has(k)), texto: "solo sirve con ataques que le dañan a él (Doble Filo, Patada Salto Alta...)" },
  skilllink: { cumple: (c) => [...DE_DOS_A_CINCO, "tripleaxel", "triplekick", "populationbomb"].some((k) => c.claves.has(k)), texto: "solo sirve con ataques de varios golpes (Semilladora, Pedrada...)" },
  prankster: { cumple: (c) => c.deEstado > 0, texto: "solo sirve con ataques de estado" },
  unburden: { cumple: (c) => esBaya(c.poke.objeto) || /gem$/i.test((c.poke.objeto && c.poke.objeto.en) || "") || BAYAS_O_GASTABLES.includes(c.ko), texto: "solo sirve si gasta su objeto (una baya, una hierba...)" },
  poisonheal: { cumple: (c) => c.ko === "toxicorb", texto: "solo sirve envenenado: con Toxisfera" },
  guts: { cumple: (c) => ORBES.includes(c.ko), texto: "solo sirve con un problema de estado: con Llamasfera o Toxisfera" },
  quickfeet: { cumple: (c) => ORBES.includes(c.ko), texto: "solo sirve con un problema de estado: con Llamasfera o Toxisfera" },
  marvelscale: { cumple: (c) => ORBES.includes(c.ko), texto: "solo sirve con un problema de estado: con Llamasfera o Toxisfera" },
  flareboost: { cumple: (c) => c.ko === "flameorb", texto: "solo sirve quemado: con Llamasfera" },
  toxicboost: { cumple: (c) => c.ko === "toxicorb", texto: "solo sirve envenenado: con Toxisfera" },
  harvest: { cumple: (c) => esBaya(c.poke.objeto), texto: "solo sirve si lleva una baya" },
  gluttony: { cumple: (c) => esBaya(c.poke.objeto), texto: "solo sirve si lleva una baya" },
  ripen: { cumple: (c) => esBaya(c.poke.objeto), texto: "solo sirve si lleva una baya" },
  cheekpouch: { cumple: (c) => esBaya(c.poke.objeto), texto: "solo sirve si lleva una baya" },
  blaze: { cumple: (c) => c.danio.some((g) => g.datos.tipo === "fire"), texto: "solo sirve con ataques de tipo Fuego" },
  overgrow: { cumple: (c) => c.danio.some((g) => g.datos.tipo === "grass"), texto: "solo sirve con ataques de tipo Planta" },
  torrent: { cumple: (c) => c.danio.some((g) => g.datos.tipo === "water"), texto: "solo sirve con ataques de tipo Agua" },
  swarm: { cumple: (c) => c.danio.some((g) => g.datos.tipo === "bug"), texto: "solo sirve con ataques de tipo Bicho" }
};
// De las que tiene en cuenta la fórmula, las que sirven aunque contra el normalito no se vean
const SIEMPRE_SIRVEN = ["moldbreaker", "teravolt", "turboblaze", "sniper", "rivalry"];

// Potencia que se le supone a los de potencia variable (Patada Baja, Movimiento Sísmico...)
const POTENCIA_VARIABLE = 60;

const CLASES = { Físico: "fisico", Especial: "especial" };

// Los de potencia variable no están en datos/ataques.json y los de la caja de la partida llegan
// sin tipo ni categoría: aquí, para que no pasen por ataques de estado. Fuera los que devuelven
// el golpe (Contraataque, Manto Espejo...) y los fulminantes (Guillotina, Fisura...).
const VARIABLES = {
  gyroball: ["steel", "fisico"], electroball: ["electric", "especial"], lowkick: ["fighting", "fisico"],
  grassknot: ["grass", "especial"], heavyslam: ["steel", "fisico"], heatcrash: ["fire", "fisico"],
  seismictoss: ["fighting", "fisico"], nightshade: ["ghost", "especial"], return: ["normal", "fisico"],
  frustration: ["normal", "fisico"], flail: ["normal", "fisico"], reversal: ["fighting", "fisico"],
  crushgrip: ["normal", "fisico"], wringout: ["normal", "especial"], punishment: ["dark", "fisico"],
  magnitude: ["ground", "fisico"], present: ["normal", "fisico"], naturalgift: ["normal", "fisico"],
  fling: ["dark", "fisico"], trumpcard: ["normal", "especial"], beatup: ["dark", "fisico"],
  psywave: ["psychic", "especial"], superfang: ["normal", "fisico"], naturesmadness: ["fairy", "especial"],
  spitup: ["normal", "especial"], dragonrage: ["dragon", "especial"], sonicboom: ["normal", "especial"],
  hardpress: ["steel", "fisico"]
};

// Giro Bola y Bola Voltio dependen de su velocidad frente a la del rival (aquí, el normalito)
function potenciaPorVelocidad(k, yo) {
  const suya = velocidad(yo);
  const rival = velocidad(normalito(yo.nivel, []));
  if (k === "gyroball") return Math.min(150, Math.floor((25 * rival) / suya) + 1);
  const veces = suya / rival;
  return veces >= 4 ? 150 : veces >= 3 ? 120 : veces >= 2 ? 80 : veces >= 1 ? 60 : 40;
}

function puedeEvolucionar(especie, familias) {
  return Object.values(familias).includes(especie);
}

// El Pokémon como lo quiere la fórmula. El Mineral Evolutivo en uno que ya no evoluciona no
// hace nada: fuera.
function combatienteDe(poke, familias) {
  const evolucionaCon = poke.objeto && clave(poke.objeto.en) === "eviolite";
  const objeto = evolucionaCon && !puedeEvolucionar(poke.id, familias) ? null : poke.objeto;
  return {
    especie: poke.id,
    stats: statsFinales(poke),
    nivel: entrenoDe(poke).nivel,
    tipos: poke.tipos || [],
    objeto,
    habilidad: poke.habilidad,
    genero: ""
  };
}

// Sus ataques, repartidos: los que hacen daño, con lo que necesita la fórmula
// ({ nombre, datos, golpes, factor, pega }), y los de estado que cuentan
// fallan: [{ ataque, solo, seguro }] los de SOLO_DE que en él no funcionan (seguro: false si
// puede que sí, sin saber la generación). gen: la del juego (null si no se sabe).
function repartirAtaques(poke, ataques, yo, gen) {
  const danio = [];
  const estado = [];
  const fallan = [];
  const encadenado = clave(poke.habilidad && poke.habilidad.en) === "skilllink";
  const conHierbaUnica = clave(poke.objeto && poke.objeto.en) === "powerherb";

  for (const a of poke.ataques || []) {
    if (!a) continue;
    const k = clave(a.en);
    // Los de potencia fija, de datos/ataques.json; los demás, con su categoría (los supuestos
    // de sugerirMejoras traen su potencia)
    const solo = SOLO_DE[k];
    let falla = false;
    if (solo && poke.id !== solo.especie && !(solo.desde && gen && gen < solo.desde)) {
      const seguro = !solo.desde || Boolean(gen);
      fallan.push({ ataque: a, solo, seguro });
      falla = seguro;
    }
    let datos = ataques.get(a.id);
    if (!datos && VARIABLES[k]) {
      const [tipo, clase] = VARIABLES[k];
      const potencia = k === "gyroball" || k === "electroball" ? potenciaPorVelocidad(k, yo) : POTENCIA_VARIABLE;
      datos = { tipo, potencia, clase };
    }
    if (!datos && CLASES[a.categoria]) datos = { tipo: a.tipo, potencia: a.potencia || POTENCIA_VARIABLE, clase: CLASES[a.categoria] };
    if (!datos) {
      if (ESTADO[k] && !falla) estado.push({ ataque: a, ...ESTADO[k] });
      continue;
    }
    const golpes = DE_DOS_A_CINCO.includes(k) ? (encadenado ? 5 : 3.1) : VARIOS_GOLPES[k] || 1;
    // La precisión, de datos/ataques.json (así sale igual en «Crear equipo» que en la caja)
    const precision = (datos.precision || a.precision || 100) / 100;
    const pega = CON_PEGA[k];
    let queda = pega ? pega[0] : 1;
    if (conHierbaUnica && CARGAN.includes(k)) queda = Math.max(queda, CARGA_CON_HIERBA);
    if (falla) queda = 0;
    danio.push({ nombre: nombre(a), datos, golpes, factor: precision * queda, pega: pega && pega[1], ataque: a, frena: FRENAN.includes(k) });
  }

  // Sin ningún ataque puesto: se le supone uno de potencia 80 de cada tipo suyo, con la mejor
  // de sus dos estadísticas de ataque
  const supuestos = !(poke.ataques || []).some(Boolean);
  if (supuestos) {
    const clase = statEnCombate(yo, 1).valor >= statEnCombate(yo, 3).valor ? "fisico" : "especial";
    for (const tipo of yo.tipos) {
      danio.push({ nombre: t("un ataque de tipo {tipo} y potencia 80", { tipo: tiposEs[tipo] }), datos: ataqueNormal(tipo, clase), golpes: 1, factor: 1 });
    }
  }
  return { danio, estado, fallan, supuestos };
}

// ---------- Cada Pokémon ----------

// { poke, nivel, ataque, aguante, velocidad, nota (0-100), clase ("fisico", "especial",
//   "mixto" o ""), rapido, cobertura: { tipo: { porcentaje, veces, golpe } },
//   efectividad: { tipo: lo que le hace }, notas: [{ texto, bien (true, false o null) }] }
//   contexto: { ataques (Map de ../calculadora/ataques.js), notas (datos/habilidades.json),
//               familias (datos/familias.json), gen (la del juego; sin ella, null) }
export function analizarPokemon(poke, { ataques, notas: notasHabilidad, familias, gen = null }) {
  const notas = [];
  const apuntar = (texto, bien) => notas.push({ texto, bien });
  const yo = combatienteDe(poke, familias);
  const nivel = yo.nivel;
  const ref = referencia(nivel);
  const { danio, estado, fallan, supuestos } = repartirAtaques(poke, ataques, yo, gen);
  // Si la fórmula ha usado su habilidad en alguna cuenta (Puño Férreo sin puñetazos, no)
  const marcaHabilidad = poke.habilidad ? `${nombre(poke.habilidad)} (` : null;
  let habilidadCuenta = false;
  const mirarHabilidad = ({ extras }) => {
    if (marcaHabilidad && !habilidadCuenta) habilidadCuenta = extras.some((e) => e.startsWith(marcaHabilidad));
  };

  // Ataque: su mejor golpe contra cada tipo
  const cobertura = {};
  let conStab = false;
  for (const tipo of TIPOS) {
    const rival = normalito(nivel, [tipo]);
    let mejor = { porcentaje: 0, veces: 0, golpe: null };
    for (const golpe of danio) {
      const resultado = calcularDanio(yo, rival, golpe.datos);
      if (resultado.stab) conStab = true;
      mirarHabilidad(resultado);
      const quita = Math.min(100, porcentaje(resultado, rival) * golpe.golpes) * golpe.factor;
      if (quita > mejor.porcentaje) mejor = { porcentaje: quita, veces: quita / ref, golpe };
    }
    cobertura[tipo] = mejor;
  }
  let vecesAtaque = TIPOS.reduce((suma, tipo) => suma + cobertura[tipo].veces, 0) / TIPOS.length;

  // Aguante: lo que le quitan, de media, un físico y un especial de cada tipo
  const efectividad = {};
  let recibido = 0;
  for (const tipo of TIPOS) {
    const rival = normalito(nivel, [tipo]);
    for (const clase of ["fisico", "especial"]) {
      const resultado = calcularDanio(rival, yo, ataqueNormal(tipo, clase));
      recibido += porcentaje(resultado, yo);
      mirarHabilidad(resultado);
      efectividad[tipo] = resultado.efectividad;
    }
  }
  recibido /= TIPOS.length * 2;
  const vecesAguante = recibido > 0 ? ref / recibido : 4;

  let vecesVelocidad = velocidad(yo) / velocidad(normalito(nivel, []));

  const fisicos = danio.filter((g) => g.datos.clase === "fisico");
  const especiales = danio.filter((g) => g.datos.clase === "especial");
  const clase = !danio.length ? "" : !especiales.length ? "fisico" : !fisicos.length ? "especial" : "mixto";
  // Ataques de estado que valen: subir (si le sirve a sus ataques), curarse, alterar al rival
  const suben = estado.filter((e) => e.sube && (e.sube === "ambos" || e.sube === clase || clase === "mixto"));
  const curan = estado.filter((e) => e.cura);
  const alteran = estado.filter((e) => e.altera);
  const trampas = estado.filter((e) => e.trampa);
  const barreras = estado.filter((e) => e.barrera);
  // Los que frenan al rival, de estado y de daño
  const frenan = [...estado.filter((e) => e.frena), ...danio.filter((g) => g.frena && g.factor > 0)];

  // La habilidad
  const habilidad = poke.habilidad;
  const k = clave(habilidad && habilidad.en);
  let extra = 0;
  const claves = new Set((poke.ataques || []).filter(Boolean).map((a) => clave(a.en)));
  const ko = clave(poke.objeto && poke.objeto.en);
  // Los climas que pone él (con la habilidad o con un ataque) y el que necesita su habilidad:
  // lo que vale eso se cuenta en el equipo (cuentasEquipo)
  const pone = [...new Set([PONEN_CLIMA[k], ...[...claves].map((a) => ATAQUES_DE_CLIMA[a])].filter(Boolean))];
  const usa = USAN_CLIMA[k] || null;
  if (habilidad) {
    const datosHabilidad = { habilidad: nombre(habilidad) };
    let notaShowdown = notasHabilidad[habilidad.id] ?? 2;
    // Simple dobla lo que se suba: sin ataques para subirse, no hace nada
    if (k === "simple" && !suben.length) notaShowdown = 0;
    const necesita = NECESITAN[k];
    const deEstado = (poke.ataques || []).filter((a) => a && !danio.some((g) => g.ataque === a)).length;
    if (LASTRAN[k]) {
      vecesAtaque *= LASTRAN[k].ataque || 1;
      vecesVelocidad *= LASTRAN[k].velocidad || 1;
      apuntar(`${nombre(habilidad)}: ${t(LASTRAN[k].texto)}`, false);
    } else if (PONEN_CLIMA[k]) {
      // Sequía, Llovizna, Chorro Arena, Nevada: buenas solo si a él le sirve el clima (a sus
      // compañeros con Nado Rápido, Clorofila... se les cuenta en el equipo)
      const { razones, contra } = suClima(PONEN_CLIMA[k], { tipos: yo.tipos, danio, claves, gen });
      const datos = { ...datosHabilidad, clima: t(NOMBRES_CLIMA[PONEN_CLIMA[k]]), razones: razones.join(", "), contra };
      if (razones.length) {
        extra += (notaShowdown - 2) * PESOS.habilidad;
        apuntar(t("{habilidad}: pone {clima} y le sirve ({razones})", datos), true);
      } else if (contra) {
        extra -= PESOS.habilidad;
        apuntar(t("{habilidad}: pone {clima}, pero no lo aprovecha y además {contra}", datos), false);
      } else {
        apuntar(t("{habilidad}: pone {clima}, pero no lo aprovecha", datos), null);
      }
    } else if (usa) {
      const datos = { ...datosHabilidad, clima: t(NOMBRES_CLIMA[usa.clima]) };
      apuntar(pone.includes(usa.clima)
        ? t("{habilidad}: solo sirve con {clima}, y él mismo puede ponerlo", datos)
        : t("{habilidad}: solo sirve con {clima}; hace falta que alguien del equipo lo ponga", datos), null);
    } else if (necesita && !necesita.cumple({ claves, ko, danio, deEstado, poke })) {
      apuntar(`${nombre(habilidad)}: ${t(necesita.texto)}`, null);
    } else if (textoHabilidad(habilidad)) {
      // La fórmula ya la ha tenido en cuenta: solo se dice (y si con sus ataques no hace nada, también)
      if (necesita || habilidadCuenta || SIEMPRE_SIRVEN.includes(k)) apuntar(`${nombre(habilidad)}: ${textoHabilidad(habilidad)}`, notaShowdown >= 2);
      else apuntar(t("{habilidad} ({texto}): con sus ataques no le sirve", { ...datosHabilidad, texto: textoHabilidad(habilidad) }), null);
    } else {
      extra += (notaShowdown - 2) * PESOS.habilidad;
      if (notaShowdown >= 3.5) apuntar(t("{habilidad}: de las mejores habilidades", { habilidad: nombre(habilidad) }), true);
      else if (notaShowdown <= 1) apuntar(t("{habilidad}: apenas le ayuda en combate", { habilidad: nombre(habilidad) }), false);
    }
  }
  if (poke.id === 292) apuntar(t("Solo tiene 1 PS: un golpe súper eficaz, el clima o un estado lo tumban"), false);

  // El objeto: si le sirve con sus ataques (un Carbón sin ataques de Fuego no hace nada)
  const objeto = poke.objeto;
  const efecto = yo.objeto && efectoObjeto(yo.objeto, yo.especie);
  if (objeto && !yo.objeto) apuntar(t("{objeto} no le hace nada: ya no evoluciona", { objeto: nombre(objeto) }), false);
  else if (efecto && !efecto.baya && !efecto.banda) {
    const stats = efecto.stats || {};
    const sirve =
      (!efecto.tipos || danio.some((g) => efecto.tipos.includes(g.datos.tipo))) &&
      (!efecto.clase || danio.some((g) => g.datos.clase === efecto.clase)) &&
      (!efecto.final || danio.length) &&
      (!stats[1] || fisicos.length) && (!stats[3] || especiales.length);
    const empeora = Object.values(stats).some((factor) => factor < 1);
    if (sirve) apuntar(`${nombre(objeto)}: ${efecto.texto}`, !empeora);
    else apuntar(t("{objeto} no le sirve con sus ataques", { objeto: nombre(objeto) }), false);
  }
  if (estado.length && ["choiceband", "choicespecs", "choicescarf"].includes(ko)) {
    extra -= CHOCA_CON_ESTADO;
    apuntar(t("Con {objeto} se queda atascado en un ataque: le sobran los de estado", { objeto: nombre(objeto) }), false);
  }
  if (estado.length && ko === "assaultvest") {
    extra -= CHOCA_CON_ESTADO;
    apuntar(t("Con {objeto} no puede usar ataques de estado", { objeto: nombre(objeto) }), false);
  }
  // Las hierbas: solo sirven con algunos ataques
  const conMios = (lista) => (poke.ataques || []).filter((a) => a && lista.includes(clave(a.en)));
  if (ko === "whiteherb") {
    const bajan = conMios(BAJAN_LAS_SUYAS);
    const rompecoraza = bajan.find((a) => clave(a.en) === "shellsmash");
    if (rompecoraza) {
      extra += PESOS.hierba;
      apuntar(t("{objeto} con {ataque}: le devuelve la Defensa y la Def. Esp. que baja, y no le quita lo que sube", { objeto: nombre(objeto), ataque: nombre(rompecoraza) }), true);
    } else if (bajan.length) {
      extra += PESOS.hierba / 2;
      apuntar(t("{objeto}: la primera vez que use {ataques}, no pierde estadísticas", { objeto: nombre(objeto), ataques: bajan.map(nombre).join(", ") }), true);
    } else {
      apuntar(t("{objeto} apenas le sirve: no tiene ataques que le bajen sus estadísticas", { objeto: nombre(objeto) }), false);
    }
  }
  if (ko === "powerherb") {
    const cargan = conMios(CARGAN);
    if (cargan.length) {
      extra += PESOS.hierba;
      apuntar(t("{objeto}: la primera vez, {ataques} sale sin tener que cargar", { objeto: nombre(objeto), ataques: cargan.map(nombre).join(", ") }), true);
    } else {
      apuntar(t("{objeto} no le sirve: solo vale para ataques que cargan un turno (Rayo Solar, Vuelo...)", { objeto: nombre(objeto) }), false);
    }
  }

  const util = yo.objeto && UTILES[ko];
  if (util && (!util.tipo || yo.tipos.includes(util.tipo))) {
    extra += util.puntos;
    apuntar(`${nombre(objeto)}: ${t(util.texto)}`, true);
  }

  // Los ataques
  if (supuestos) apuntar(t("Sin ataques: se le supone uno de potencia 80 de cada tipo suyo"), null);
  else if (!danio.length) apuntar(t("No tiene ningún ataque que haga daño"), false);
  else {
    if (!conStab) apuntar(t("Ningún ataque de su tipo: le falta el ×1,5 del STAB"), false);
    if ((poke.ataques || []).filter(Boolean).length < 4) apuntar(t("Le quedan huecos de ataque libres"), false);
  }

  // Los que usan la estadística que no es (cuenta Potencia, Cinta Elección...)
  const atq = statEnCombate(yo, 1).valor;
  const esp = statEnCombate(yo, 3).valor;
  const nombresGolpes = (lista) => lista.map((g) => g.nombre).join(", ");
  if (!supuestos && fisicos.length && esp > atq * 1.25) {
    apuntar(t("Su At. Esp. es mucho mejor que su Ataque: le rinden poco los físicos ({ataques})", { ataques: nombresGolpes(fisicos) }), false);
  }
  if (!supuestos && especiales.length && atq > esp * 1.25) {
    apuntar(t("Su Ataque es mucho mejor que su At. Esp.: le rinden poco los especiales ({ataques})", { ataques: nombresGolpes(especiales) }), false);
  }

  for (const golpe of danio) if (golpe.pega) apuntar(t(golpe.pega, { ataque: golpe.nombre }), false);
  for (const { ataque: a, solo, seguro } of fallan) {
    const datos = { ataque: nombre(a), quien: solo.quien, gen: solo.desde };
    if (!seguro) apuntar(t("{ataque}: desde la {gen}.ª generación solo funciona si lo usa {quien} (mira en qué juego estás)", datos), null);
    else if (solo.desde) apuntar(t("{ataque} no le sirve: en este juego solo funciona si lo usa {quien}", datos), false);
    else apuntar(t("{ataque} no le sirve: solo funciona si lo usa {quien}", datos), false);
  }

  const nombres = (lista) => lista.map((e) => nombre(e.ataque)).join(", ");
  let deEstado = 0;
  if (suben.length) {
    deEstado += PESOS.estado.sube;
    apuntar(t("Puede subirse las estadísticas ({ataques})", { ataques: nombres(suben) }), true);
  }
  if (curan.length) {
    deEstado += PESOS.estado.cura;
    apuntar(t("Puede curarse ({ataques})", { ataques: nombres(curan) }), true);
  }
  if (alteran.length) {
    deEstado += PESOS.estado.altera;
    apuntar(t("Deja al rival quemado, paralizado, envenenado o dormido ({ataques})", { ataques: nombres(alteran) }), true);
  }
  if (trampas.length) {
    deEstado += PESOS.estado.trampa;
    apuntar(t("Pone trampas que dañan a cada Pokémon que saque el rival ({ataques})", { ataques: nombres(trampas) }), true);
  }
  if (barreras.length) {
    deEstado += PESOS.estado.barrera;
    apuntar(t("Pone barreras que protegen a todo el equipo ({ataques})", { ataques: nombres(barreras) }), true);
  }
  if (frenan.length) {
    deEstado += PESOS.estado.frena;
    apuntar(t("Puede frenar al rival o hacer que el equipo ataque antes ({ataques})", { ataques: nombres(frenan) }), true);
  }
  extra += Math.min(deEstado, PESOS.estado.tope);

  const ataque = puntuar(vecesAtaque);
  const aguante = puntuar(vecesAguante);
  const veloz = puntuar(vecesVelocidad);
  const nota = limitar(PESOS.ataque * ataque + PESOS.aguante * aguante + PESOS.velocidad * veloz + extra);

  return {
    poke, nivel, ataque, aguante, velocidad: veloz, nota, clase,
    rapido: vecesVelocidad >= RAPIDO,
    frena: frenan.length > 0,
    clima: { pone, habilidad: PONEN_CLIMA[k] || null, usa },
    cobertura, efectividad, notas,
    // Lo mismo en listas por tipo (en el orden de TIPOS), para las cuentas rápidas del equipo
    veces: TIPOS.map((tipo) => cobertura[tipo].veces),
    recibe: TIPOS.map((tipo) => efectividad[tipo])
  };
}

// ---------- El equipo ----------

// Las cuentas de la nota del equipo, sin textos (buscarEquipos las hace miles de veces):
//   { mejores: [por tipo, el miembro que más le quita o null], debiles: [por tipo],
//     aguantan: [por tipo], todosFisicos, todosEspeciales, nadieRapido,
//     nadieAguanta, nadiePega, repetidos: [{ tipo, cuantos }], sinSuClima: [miembros con
//     Nado Rápido, Clorofila... sin nadie que ponga su clima], partes, nota }
function cuentasEquipo(miembros) {
  const n = miembros.length;
  const mejores = [];
  const debiles = [];
  const aguantan = [];
  let cobertura = 0;
  let defensa = 100;
  for (let i = 0; i < TIPOS.length; i++) {
    let mejor = null;
    let veces = 0;
    let suyosDebiles = 0;
    let suyosAguantan = 0;
    for (const m of miembros) {
      if (m.veces[i] > veces) {
        veces = m.veces[i];
        mejor = m;
      }
      if (m.recibe[i] > 1) suyosDebiles++;
      else if (m.recibe[i] < 1) suyosAguantan++;
    }
    mejores.push(mejor);
    debiles.push(suyosDebiles);
    aguantan.push(suyosAguantan);
    cobertura += Math.min(1, veces / FUERTE);
    if (suyosDebiles >= 3) defensa -= PESOS.tresDebiles;
    else if (suyosDebiles === 2 && !suyosAguantan) defensa -= PESOS.dosSinAguante;
    else if (!suyosAguantan && n > 1) defensa -= PESOS.sinAguante;
  }

  let suma = 0;
  let atacantes = 0;
  let fisicos = 0;
  let especiales = 0;
  let rapido = false;
  let duro = false;
  let pegador = false;
  // El clima: los que lo necesitan suman si alguien del equipo lo pone (o él mismo con un ataque)
  const climas = new Set();
  for (const m of miembros) for (const clima of m.clima.pone) climas.add(clima);
  const sinSuClima = [];
  for (const m of miembros) {
    suma += m.nota;
    const usa = m.clima.usa;
    if (usa && climas.has(usa.clima)) suma += usa.puntos;
    else if (usa) sinSuClima.push(m);
    if (m.aguante >= DURO) duro = true;
    if (m.ataque >= PEGADOR) pegador = true;
    // Quien frena al rival (Red Viscosa, Viento Afín, Espacio Raro...) también vale
    if (m.rapido || m.frena) rapido = true;
    if (m.clase) atacantes++;
    if (m.clase === "fisico") fisicos++;
    if (m.clase === "especial") especiales++;
  }
  const todosFisicos = atacantes >= 3 && fisicos === atacantes;
  const todosEspeciales = atacantes >= 3 && especiales === atacantes;
  const nadieRapido = n >= 3 && !rapido;
  const nadieAguanta = n >= 3 && !duro;
  const nadiePega = n >= 3 && !pegador;
  const repetidos = [];
  for (const tipo of TIPOS) {
    let cuantos = 0;
    for (const m of miembros) if ((m.poke.tipos || []).includes(tipo)) cuantos++;
    if (cuantos >= 3) repetidos.push({ tipo, cuantos });
  }
  let equilibrio = 100 - PESOS.tipoRepetido * repetidos.length;
  if (todosFisicos || todosEspeciales) equilibrio -= PESOS.todosIguales;
  if (nadieRapido) equilibrio -= PESOS.nadieRapido;
  if (nadieAguanta) equilibrio -= PESOS.nadieAguanta;
  if (nadiePega) equilibrio -= PESOS.nadiePega;

  const partes = {
    miembros: n ? suma / n : 0,
    cobertura: (cobertura / TIPOS.length) * 100,
    defensa: Math.max(0, defensa),
    equilibrio: Math.max(0, equilibrio)
  };
  const nota = n
    ? limitar(
        PESOS.miembros * partes.miembros + PESOS.cobertura * partes.cobertura +
        PESOS.defensa * partes.defensa + PESOS.equilibrio * partes.equilibrio
      )
    : 0;
  return { mejores, debiles, aguantan, todosFisicos, todosEspeciales, nadieRapido, nadieAguanta, nadiePega, repetidos, sinSuClima, partes, nota };
}

// { miembros, cobertura: [{ tipo, porcentaje, veces, quien, golpe, nivel: "fuerte" | "normal" |
//   "flojo" }], defensa: [{ tipo, debiles, aguantan }], avisos: [{ texto, grave }], nota,
//   partes: { miembros, cobertura, defensa, equilibrio } }
//   miembros: lo que da analizarPokemon de cada uno
export function analizarEquipo(miembros) {
  const avisos = [];
  const avisar = (texto, grave) => avisos.push({ texto, grave });
  const nombreDe = (m) => m.poke.mote || nombre(m.poke);
  const cuentas = cuentasEquipo(miembros);

  if (!miembros.length) return { miembros, cobertura: [], defensa: [], avisos, nota: 0, partes: cuentas.partes };

  // Cobertura: contra cada tipo, el que más le quita
  const cobertura = TIPOS.map((tipo, i) => {
    const quien = cuentas.mejores[i];
    const suyo = quien ? quien.cobertura[tipo] : { veces: 0, porcentaje: 0, golpe: null };
    const nivel = suyo.veces >= FUERTE ? "fuerte" : suyo.veces >= FLOJO ? "normal" : "flojo";
    return { tipo, ...suyo, quien, nivel };
  });
  const flojos = cobertura.filter((c) => c.nivel === "flojo").map((c) => tiposEs[c.tipo]);
  if (flojos.length) avisar(t("Nadie le hace mucho daño a: {tipos}", { tipos: flojos.join(", ") }), flojos.length >= 3);

  // Defensa: débiles y quienes lo aguantan (resisten o son inmunes, también por la habilidad)
  const defensa = TIPOS.map((tipo, i) => ({ tipo, debiles: cuentas.debiles[i], aguantan: cuentas.aguantan[i] }));
  for (const { tipo, debiles, aguantan } of defensa) {
    const datos = { n: debiles, total: miembros.length, tipo: tiposEs[tipo] };
    if (debiles >= 3) {
      avisar(aguantan ? t("{n} de {total} son débiles a {tipo}", datos) : t("{n} de {total} son débiles a {tipo} y nadie lo aguanta", datos), true);
    } else if (debiles === 2 && !aguantan) {
      avisar(t("{n} de {total} son débiles a {tipo} y nadie lo aguanta", datos), true);
    }
  }
  // Todos los que nadie aguanta, como decía la antigua ventana «Debilidades»
  const sinAguante = defensa.filter((d) => !d.aguantan).map((d) => tiposEs[d.tipo]);
  if (sinAguante.length) avisar(t("Nadie resiste ni es inmune a: {tipos}", { tipos: sinAguante.join(", ") }), false);

  // Equilibrio: físicos y especiales, alguien rápido y tipos sin repetir
  if (cuentas.todosFisicos) {
    avisar(t("Todos atacan con ataques físicos: Intimidación o un rival con mucha Defensa os frena a todos"), false);
  }
  if (cuentas.todosEspeciales) {
    avisar(t("Todos atacan con ataques especiales: un rival con mucha Def. Esp. os frena a todos"), false);
  }
  if (cuentas.nadieRapido) avisar(t("Nadie es rápido ni puede frenar al rival: casi todos los rivales atacarán antes"), false);
  if (cuentas.nadieAguanta) avisar(t("Nadie aguanta bien los golpes: falta alguno más defensivo"), false);
  if (cuentas.nadiePega) avisar(t("Nadie pega fuerte: falta alguno más atacante"), false);
  for (const m of cuentas.sinSuClima) {
    avisar(t("{nombre} tiene {habilidad}, pero nadie del equipo pone {clima}", {
      nombre: nombreDe(m), habilidad: nombre(m.poke.habilidad), clima: t(NOMBRES_CLIMA[m.clima.usa.clima])
    }), false);
  }
  // Dos habilidades que ponen climas distintos se pisan: vale el del último que sale
  const climasDeHabilidad = new Set(miembros.map((m) => m.clima.habilidad).filter(Boolean));
  if (climasDeHabilidad.size > 1) {
    avisar(t("Hay habilidades que ponen climas distintos ({climas}): se quitan el uno al otro", {
      climas: [...climasDeHabilidad].map((c) => t(NOMBRES_CLIMA[c])).join(", ")
    }), false);
  }
  for (const { tipo, cuantos } of cuentas.repetidos) {
    avisar(t("{n} comparten el tipo {tipo}", { n: cuantos, tipo: tiposEs[tipo] }), false);
  }

  // El que menos aporta, si se queda muy atrás
  const peor = miembros.reduce((a, b) => (b.nota < a.nota ? b : a));
  if (miembros.length > 1 && peor.nota < 40) {
    avisar(t("{nombre} es el que menos aporta: mira por qué en su fila", { nombre: nombreDe(peor) }), false);
  }

  // Primero lo grave
  avisos.sort((a, b) => Number(b.grave) - Number(a.grave));
  return { miembros, cobertura, defensa, avisos, nota: cuentas.nota, partes: cuentas.partes };
}

// ---------- Buscar equipo ----------

// Como mucho, las combinaciones que se prueban una a una, y los equipos que se guardan de ellas
const LIMITE_COMBINACIONES = 150000;
const GUARDADOS = 12;

// La cláusula de objetos: dos del equipo no pueden llevar el mismo. Lo lleva aquel al que más
// le sube la nota y los demás van sin él (su análisis sin objeto, que va en m.sinObjeto; sin
// él, se queda como está)
const loQueLeDa = (m) => m.nota - (m.sinObjeto ? m.sinObjeto.nota : m.nota);

export function conClausulaDeObjetos(miembros) {
  const porObjeto = new Map();
  let repetido = false;
  for (const m of miembros) {
    const k = clave(m.poke.objeto && m.poke.objeto.en);
    if (!k) continue;
    if (porObjeto.has(k)) repetido = true;
    else porObjeto.set(k, []);
    porObjeto.get(k).push(m);
  }
  if (!repetido) return miembros;
  const sinEl = new Set();
  for (const lista of porObjeto.values()) {
    if (lista.length < 2) continue;
    const loLleva = lista.reduce((a, b) => (loQueLeDa(b) > loQueLeDa(a) ? b : a));
    for (const m of lista) if (m !== loLleva) sinEl.add(m);
  }
  return miembros.map((m) => (sinEl.has(m) ? m.sinObjeto || m : m));
}

function combinaciones(n, k) {
  let total = 1;
  for (let i = 0; i < k; i++) total = (total * (n - i)) / (i + 1);
  return total;
}

// Los mejores equipos con los fijos (van siempre) y los candidatos que mejor los completen (todos
// analizados con analizarPokemon; los fijos no van entre los candidatos). Primero se prueban
// todas las combinaciones de los mejores candidatos por su nota, tantos como quepan en
// LIMITE_COMBINACIONES; luego, en los mejores equipos que salen, se cambia uno por cualquier otro
// candidato mientras suba la nota: así entra también el de poca nota que tapa un hueco. Si todos
// acaban en el mismo equipo, las alternativas son ese equipo con uno cambiado por el mejor
// sustituto. No se repite especie (dos Garchomp) salvo que no haya otra forma de completarlo.
// Con clausulaObjetos, si dos llevan el mismo objeto, uno va sin él (conClausulaDeObjetos): en
// los miembros que salen, ese es su análisis sin objeto.
//   -> [{ miembros, nota }], de mejor a peor (cuantos como mucho, sin repetir)
export function buscarEquipos(fijos, candidatos, { tamano = 6, cuantos = 3, repetirEspecie = false, clausulaObjetos = false } = {}) {
  const equipo = (miembros) => (clausulaObjetos ? conClausulaDeObjetos(miembros) : miembros);
  const libres = Math.max(0, Math.min(tamano - fijos.length, candidatos.length));
  const especiesFijas = new Set(fijos.map((m) => m.poke.id));
  // Cuántos repiten especie (con los fijos o entre ellos)
  const repetidos = (elegidos) => {
    if (repetirEspecie) return 0;
    const vistas = new Set(especiesFijas);
    let cuantos = 0;
    for (const m of elegidos) {
      if (vistas.has(m.poke.id)) cuantos++;
      vistas.add(m.poke.id);
    }
    return cuantos;
  };
  // Cada repetido resta 100: así, cambiando de uno en uno, se van quitando
  const nota = (elegidos) => cuentasEquipo(equipo([...fijos, ...elegidos])).nota - 100 * repetidos(elegidos);
  if (!libres) return fijos.length ? [{ miembros: equipo([...fijos]), nota: cuentasEquipo(equipo(fijos)).nota }] : [];

  // De más a menos nota, pero primero el mejor de cada especie (si no, entre los que se prueban
  // podría haber ocho Garchomp)
  const porNota = [...candidatos].sort((a, b) => b.nota - a.nota);
  const vistas = new Set(especiesFijas);
  const primeros = [];
  const otros = [];
  for (const m of porNota) {
    if (vistas.has(m.poke.id)) {
      otros.push(m);
    } else {
      vistas.add(m.poke.id);
      primeros.push(m);
    }
  }
  const orden = [...primeros, ...otros];
  let probados = orden.length;
  while (probados > libres && combinaciones(probados, libres) > LIMITE_COMBINACIONES) probados--;

  // Todas las combinaciones de los «probados» primeros: se guardan las GUARDADOS mejores
  const mejores = [];
  const indices = Array.from({ length: libres }, (_, i) => i);
  for (;;) {
    const elegidos = indices.map((i) => orden[i]);
    const suya = nota(elegidos);
    if (mejores.length < GUARDADOS || suya > mejores[mejores.length - 1].nota) {
      mejores.push({ elegidos, nota: suya });
      mejores.sort((a, b) => b.nota - a.nota);
      if (mejores.length > GUARDADOS) mejores.pop();
    }
    let i = libres - 1;
    while (i >= 0 && indices[i] === probados - libres + i) i--;
    if (i < 0) break;
    indices[i]++;
    for (let j = i + 1; j < libres; j++) indices[j] = indices[j - 1] + 1;
  }

  // Cambiar uno por otro (de todos los candidatos) mientras suba la nota
  for (const equipo of mejores) {
    for (;;) {
      let cambio = null;
      for (let hueco = 0; hueco < libres; hueco++) {
        for (const candidato of candidatos) {
          if (equipo.elegidos.includes(candidato)) continue;
          const prueba = equipo.elegidos.map((e, i) => (i === hueco ? candidato : e));
          const suya = nota(prueba);
          if (suya > (cambio ? cambio.nota : equipo.nota) + 1e-9) cambio = { elegidos: prueba, nota: suya };
        }
      }
      if (!cambio) break;
      Object.assign(equipo, cambio);
    }
  }

  // Sin repetir (dos de los guardados pueden acabar en el mismo equipo, o en los mismos con otro
  // Garchomp de la caja: cuentan como el mismo), de mejor a peor
  const vistos = new Set();
  const firma = (elegidos) => elegidos.map((m) => `${m.poke.id}-${m.poke.idForma || ""}`).sort().join(",");
  const distintos = mejores
    .filter((e) => !repetidos(e.elegidos))
    .sort((a, b) => b.nota - a.nota)
    .filter(({ elegidos }) => {
      if (vistos.has(firma(elegidos))) return false;
      vistos.add(firma(elegidos));
      return true;
    });
  // Sin forma de completarlo sin repetir especie: repitiendo
  if (!distintos.length) return repetirEspecie ? [] : buscarEquipos(fijos, candidatos, { tamano, cuantos, repetirEspecie: true, clausulaObjetos });

  // Alternativas: el mejor con uno cambiado por su mejor sustituto (las que más nota dejan)
  if (distintos.length < cuantos) {
    const mejor = distintos[0];
    const otros = [];
    for (let hueco = 0; hueco < libres; hueco++) {
      let sustituto = null;
      for (const candidato of candidatos) {
        // Otro de la misma especie no es una alternativa: es el mismo equipo
        if (mejor.elegidos.includes(candidato) || candidato.poke.id === mejor.elegidos[hueco].poke.id) continue;
        const prueba = mejor.elegidos.map((e, i) => (i === hueco ? candidato : e));
        const suya = nota(prueba);
        if (!repetidos(prueba) && (!sustituto || suya > sustituto.nota)) sustituto = { elegidos: prueba, nota: suya };
      }
      if (sustituto) otros.push(sustituto);
    }
    for (const otro of otros.sort((a, b) => b.nota - a.nota)) {
      if (distintos.length >= cuantos) break;
      if (vistos.has(firma(otro.elegidos))) continue;
      vistos.add(firma(otro.elegidos));
      distintos.push(otro);
    }
  }

  return distintos
    .slice(0, cuantos)
    .map(({ elegidos, nota: suya }) => ({ miembros: equipo([...fijos, ...[...elegidos].sort((a, b) => b.nota - a.nota)]), nota: suya }));
}

// ---------- Para mejorarlo ----------

// Lo que tiene que subir la nota del equipo para que valga la pena decirlo (un objeto que sube
// 4 puntos a un Pokémon sube menos de 1 la del equipo: es la media de seis y algo más)
const MINIMO_MEJORA = 0.2;

// Lo que más subiría la nota del equipo cambiando una sola cosa a uno de sus Pokémon:
//   · un objeto, de los que hay. objetos: [{ objeto: { id, es, en }, cantidad, mochila }]
//     (de la mochila de la partida o, si no se sabe, OBJETOS_HABITUALES con mochila: false).
//     Cada uno se sugiere a uno solo (o a tantos como haya en la mochila).
//   · un ataque: uno de potencia 80 de cada tipo (físico o especial, según su mejor estadística)
//     en cada hueco, en lugar del que haya (los de estado que valen no se tocan). En un
//     randomlocke no se sabe qué puede aprender: se dice el tipo que le falta.
//   miembros: lo que da analizarPokemon de cada uno; contexto: el mismo; clausulaObjetos: no
//   sugerir uno que ya lleva otro del equipo, ni el mismo a dos
//   -> [{ poke, que: "objeto" | "ataque", objeto?, mochila?, tipo?, clase?, quita? (el ataque que
//        sale; null: va a un hueco libre), sube (la nota del equipo), subeEl (la suya) }], de lo
//        que más sube a lo que menos
export function sugerirMejoras(miembros, contexto, objetos, { clausulaObjetos = false } = {}) {
  const base = cuentasEquipo(miembros).nota;
  const sube = (i, poke) => {
    const otro = analizarPokemon(poke, contexto);
    return { equipo: cuentasEquipo(miembros.map((m, j) => (j === i ? otro : m))).nota - base, el: otro.nota - miembros[i].nota };
  };
  const sugerencias = [];

  // Objetos: lo que sube cada uno en cada Pokémon y, de más a menos, uno por Pokémon
  const llevan = new Set(miembros.map((m) => clave(m.poke.objeto && m.poke.objeto.en)));
  const posibles = [];
  miembros.forEach((m, i) => {
    for (const o of objetos) {
      const k = clave(o.objeto.en);
      // Sin mochila (o con la cláusula), el que ya lleva otro no está libre
      if (llevan.has(k) && (!o.mochila || clausulaObjetos)) continue;
      if (k === clave(m.poke.objeto && m.poke.objeto.en)) continue;
      if (!efectoObjeto(o.objeto, m.poke.id) && !UTILES[k]) continue;
      const cuanto = sube(i, { ...m.poke, objeto: o.objeto });
      if (cuanto.equipo >= MINIMO_MEJORA) posibles.push({ i, o, cuanto });
    }
  });
  posibles.sort((a, b) => b.cuanto.equipo - a.cuanto.equipo);
  const usados = new Map();
  const conObjeto = new Set();
  for (const { i, o, cuanto } of posibles) {
    const k = clave(o.objeto.en);
    if (conObjeto.has(i) || (usados.get(k) || 0) >= (clausulaObjetos ? 1 : o.cantidad || 1)) continue;
    conObjeto.add(i);
    usados.set(k, (usados.get(k) || 0) + 1);
    sugerencias.push({ poke: miembros[i].poke, que: "objeto", objeto: o.objeto, mochila: Boolean(o.mochila), sube: cuanto.equipo, subeEl: cuanto.el });
  }

  // Ataques: el mejor cambio de cada Pokémon (a los que no tienen ninguno puesto no se les dice
  // nada: el análisis ya les supone los de su tipo)
  miembros.forEach((m, i) => {
    const poke = m.poke;
    const suyos = poke.ataques || [];
    if (!suyos.some(Boolean)) return;
    const yo = combatienteDe(poke, contexto.familias);
    const clase = statEnCombate(yo, 1).valor >= statEnCombate(yo, 3).valor ? "fisico" : "especial";
    let mejor = null;
    for (let hueco = 0; hueco < 4; hueco++) {
      const actual = suyos[hueco] || null;
      if (actual && ESTADO[clave(actual.en)]) continue;
      for (const tipo of TIPOS) {
        if (actual && actual.tipo === tipo) continue;
        const nuevo = { id: -1, es: "", en: "", tipo, categoria: clase === "fisico" ? "Físico" : "Especial", potencia: 80 };
        const cuanto = sube(i, { ...poke, ataques: [0, 1, 2, 3].map((j) => (j === hueco ? nuevo : suyos[j] || null)) });
        if (cuanto.equipo >= MINIMO_MEJORA && (!mejor || cuanto.equipo > mejor.sube)) {
          mejor = { poke, que: "ataque", tipo, clase, quita: actual, sube: cuanto.equipo, subeEl: cuanto.el };
        }
      }
    }
    if (mejor) sugerencias.push(mejor);
  });

  return sugerencias.sort((a, b) => b.sube - a.sube);
}
