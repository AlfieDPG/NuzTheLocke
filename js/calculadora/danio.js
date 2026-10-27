// La fórmula de daño de los juegos (de la 5ª generación en adelante), con los redondeos de
// Showdown. Sin pantalla: la usa js/calculadora/index.js.
//
//   combatiente: { especie (número de la Pokédex), stats: [6] (las finales, ver
//                  equipos/entreno.js), nivel, tipos, etapas: [6] (−6..+6), objeto y
//                  habilidad ({ es, en } o null), quemado, paralizado, ps (% que le quedan) }
//   ataque:      { tipo, potencia, clase: "fisico" | "especial", contacto?, punetazo?,
//                  mordisco?, pulso?, sonido?, secundario? (ver ./ataques.js) }
//   campo:       { clima: "" | "sol" | "lluvia" | "arena" | "nieve", reflejo, luz, critico }
//
// Lo que se tiene en cuenta: STAB, tipos, crítico, quemadura, etapas de estadística, clima,
// Reflejo y Pantalla de luz, los objetos que cambian el daño o la velocidad (efectoObjeto) y
// las habilidades que lo hacen (HABILIDADES).

import { multiplicador } from "../comun/efectividad.js";
import { tiposEs } from "../comun/tipos.js";
import { t, nombre } from "../comun/idioma.js";

const TIPOS = Object.keys(tiposEs);

// ---------- Objetos ----------

// El nombre en inglés, sin espacios ni signos: «Never-Melt Ice» -> «nevermeltice»
export function clave(nombre) {
  return String(nombre || "").toLowerCase().replace(/[^a-z]/g, "");
}

// ×1,2 a los ataques de un tipo
const DE_TIPO = {
  silkscarf: "normal", charcoal: "fire", flameplate: "fire", mysticwater: "water", splashplate: "water",
  seaincense: "water", waveincense: "water", magnet: "electric", zapplate: "electric", miracleseed: "grass",
  meadowplate: "grass", roseincense: "grass", nevermeltice: "ice", icicleplate: "ice", blackbelt: "fighting",
  fistplate: "fighting", poisonbarb: "poison", toxicplate: "poison", softsand: "ground", earthplate: "ground",
  sharpbeak: "flying", skyplate: "flying", twistedspoon: "psychic", mindplate: "psychic", oddincense: "psychic",
  silverpowder: "bug", insectplate: "bug", hardstone: "rock", stoneplate: "rock", rockincense: "rock",
  spelltag: "ghost", spookyplate: "ghost", dragonfang: "dragon", dracoplate: "dragon", blackglasses: "dark",
  dreadplate: "dark", metalcoat: "steel", ironplate: "steel", fairyfeather: "fairy", pixieplate: "fairy"
};

// ×½ a un ataque súper eficaz de su tipo (la Chilan, a cualquier ataque Normal)
const BAYAS = {
  occaberry: "fire", passhoberry: "water", wacanberry: "electric", rindoberry: "grass", yacheberry: "ice",
  chopleberry: "fighting", kebiaberry: "poison", shucaberry: "ground", cobaberry: "flying",
  payapaberry: "psychic", tangaberry: "bug", chartiberry: "rock", kasibberry: "ghost", habanberry: "dragon",
  colburberry: "dark", babiriberry: "steel", roseliberry: "fairy", chilanberry: "normal"
};

// Los de un Pokémon concreto: [especies, efecto]
const DE_POKEMON = {
  lightball: [[25], { stats: { 1: 2, 3: 2 }, texto: "Ataque y At. Esp. ×2" }],
  thickclub: [[104, 105], { stats: { 1: 2 }, texto: "Ataque ×2" }],
  deepseatooth: [[366], { stats: { 3: 2 }, texto: "At. Esp. ×2" }],
  deepseascale: [[366], { stats: { 4: 2 }, texto: "Def. Esp. ×2" }],
  souldew: [[380, 381], { potencia: 4915 / 4096, tipos: ["psychic", "dragon"], texto: "Psíquico y Dragón ×1,2" }],
  adamantorb: [[483], { potencia: 4915 / 4096, tipos: ["steel", "dragon"], texto: "Acero y Dragón ×1,2" }],
  lustrousorb: [[484], { potencia: 4915 / 4096, tipos: ["water", "dragon"], texto: "Agua y Dragón ×1,2" }],
  griseousorb: [[487], { potencia: 4915 / 4096, tipos: ["ghost", "dragon"], texto: "Fantasma y Dragón ×1,2" }],
  wellspringmask: [[1017], { potencia: 4915 / 4096, texto: "Daño ×1,2" }],
  hearthflamemask: [[1017], { potencia: 4915 / 4096, texto: "Daño ×1,2" }],
  cornerstonemask: [[1017], { potencia: 4915 / 4096, texto: "Daño ×1,2" }]
};

const OTROS = {
  choiceband: { stats: { 1: 1.5 }, texto: "Ataque ×1,5" },
  choicespecs: { stats: { 3: 1.5 }, texto: "At. Esp. ×1,5" },
  choicescarf: { stats: { 5: 1.5 }, texto: "Velocidad ×1,5" },
  assaultvest: { stats: { 4: 1.5 }, texto: "Def. Esp. ×1,5" },
  eviolite: { stats: { 2: 1.5, 4: 1.5 }, texto: "Defensas ×1,5" },
  ironball: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  machobrace: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  powerweight: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  powerbracer: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  powerbelt: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  powerlens: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  powerband: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  poweranklet: { stats: { 5: 0.5 }, texto: "Velocidad ×½" },
  muscleband: { potencia: 4505 / 4096, clase: "fisico", texto: "Físicos ×1,1" },
  wiseglasses: { potencia: 4505 / 4096, clase: "especial", texto: "Especiales ×1,1" },
  lifeorb: { final: 5324 / 4096, texto: "Daño ×1,3" },
  expertbelt: { final: 4915 / 4096, superEficaz: true, texto: "Súper eficaz ×1,2" },
  focussash: { banda: true, texto: "Aguanta con 1 PS" }
};

// Los textos, en el idioma de la web
for (const efecto of Object.values(OTROS)) efecto.texto = t(efecto.texto);
for (const [, efecto] of Object.values(DE_POKEMON)) efecto.texto = t(efecto.texto);

// Lo que hace un objeto en un Pokémon (null si no cambia nada que se calcule aquí):
//   { texto, stats?: { índice: ×}, potencia?: ×, tipos?: [], clase?, final?: ×, superEficaz?,
//     baya?: tipo, banda? }
export function efectoObjeto(objeto, especie) {
  if (!objeto) return null;
  const k = clave(objeto.en);
  if (OTROS[k]) return OTROS[k];
  if (DE_TIPO[k]) return { potencia: 4915 / 4096, tipos: [DE_TIPO[k]], texto: t("{tipo} ×1,2", { tipo: tiposEs[DE_TIPO[k]] }) };
  if (BAYAS[k]) return { baya: BAYAS[k], texto: t("{tipo} ×½", { tipo: tiposEs[BAYAS[k]] }) };
  const gema = k.match(/^(\w+)gem$/);
  if (gema && TIPOS.includes(gema[1])) return { potencia: 5325 / 4096, tipos: [gema[1]], texto: t("{tipo} ×1,3", { tipo: tiposEs[gema[1]] }) };
  if (DE_POKEMON[k]) {
    const [especies, efecto] = DE_POKEMON[k];
    return especies.includes(especie) ? efecto : null;
  }
  return null;
}

// ---------- Habilidades ----------

// Las que se tienen en cuenta, con lo que hacen (sale al lado de su nombre)
const HABILIDADES = {
  hugepower: "Ataque ×2", purepower: "Ataque ×2", hustle: "Ataque ×1,5", gorillatactics: "Ataque ×1,5",
  guts: "Con estado: Ataque ×1,5", solarpower: "Con sol: At. Esp. ×1,5",
  blaze: "Con ⅓ de PS: Fuego ×1,5", overgrow: "Con ⅓ de PS: Planta ×1,5",
  torrent: "Con ⅓ de PS: Agua ×1,5", swarm: "Con ⅓ de PS: Bicho ×1,5",
  technician: "Potencia 60 o menos ×1,5", adaptability: "STAB ×2", toughclaws: "Contacto ×1,3",
  ironfist: "Puñetazos ×1,2", strongjaw: "Mordiscos ×1,5", megalauncher: "Pulsos ×1,5",
  punkrock: "Sonido ×1,3 (y recibe ×½)", sandforce: "Con arena: Roca, Tierra y Acero ×1,3",
  steelworker: "Acero ×1,5", steelyspirit: "Acero ×1,5", transistor: "Eléctrico ×1,3",
  dragonsmaw: "Dragón ×1,5", rockypayload: "Roca ×1,5", sheerforce: "Con efecto extra ×1,3",
  aerilate: "Normal → Volador ×1,2", pixilate: "Normal → Hada ×1,2",
  refrigerate: "Normal → Hielo ×1,2", galvanize: "Normal → Eléctrico ×1,2", normalize: "Todo → Normal ×1,2",
  tintedlens: "Poco eficaz ×2", sniper: "Crítico ×2,25", scrappy: "Normal y Lucha dan a Fantasma",
  moldbreaker: "Ignora la habilidad rival", teravolt: "Ignora la habilidad rival", turboblaze: "Ignora la habilidad rival",
  swiftswim: "Con lluvia: Velocidad ×2", chlorophyll: "Con sol: Velocidad ×2",
  sandrush: "Con arena: Velocidad ×2", slushrush: "Con nieve: Velocidad ×2", quickfeet: "Con estado: Velocidad ×1,5",
  thickfat: "Recibe Fuego y Hielo ×½", heatproof: "Recibe Fuego ×½", waterbubble: "Agua ×2 y recibe Fuego ×½",
  purifyingsalt: "Recibe Fantasma ×½", levitate: "Inmune a Tierra", eartheater: "Inmune a Tierra",
  flashfire: "Inmune a Fuego", wellbakedbody: "Inmune a Fuego", waterabsorb: "Inmune a Agua",
  stormdrain: "Inmune a Agua", dryskin: "Inmune a Agua; recibe Fuego ×1,25", voltabsorb: "Inmune a Eléctrico",
  lightningrod: "Inmune a Eléctrico", motordrive: "Inmune a Eléctrico", sapsipper: "Inmune a Planta",
  wonderguard: "Solo le daña lo súper eficaz", filter: "Recibe súper eficaz ×¾", solidrock: "Recibe súper eficaz ×¾",
  prismarmor: "Recibe súper eficaz ×¾", multiscale: "Con todos los PS: recibe ×½",
  shadowshield: "Con todos los PS: recibe ×½", furcoat: "Defensa ×2", icescales: "Recibe especiales ×½",
  fluffy: "Recibe contacto ×½ y Fuego ×2", marvelscale: "Con estado: Defensa ×1,5",
  rivalry: "Mismo género ×1,25; contrario ×0,75"
};
for (const habilidad of Object.keys(HABILIDADES)) HABILIDADES[habilidad] = t(HABILIDADES[habilidad]);

// Lo que hace una habilidad, si cuenta para el cálculo ("" si no)
export function textoHabilidad(habilidad) {
  return (habilidad && HABILIDADES[clave(habilidad.en)]) || "";
}

const ROMPEMOLDES = ["moldbreaker", "teravolt", "turboblaze"];
const IRROMPIBLES = ["shadowshield", "prismarmor"]; // estas cuentan aunque el otro tenga Rompemoldes
const CAMBIAN_TIPO = { aerilate: "flying", pixilate: "fairy", refrigerate: "ice", galvanize: "electric" };
const CON_POCA_VIDA = { blaze: "fire", overgrow: "grass", torrent: "water", swarm: "bug" };
const VELOCIDAD_CLIMA = { swiftswim: "lluvia", chlorophyll: "sol", sandrush: "arena", slushrush: "nieve" };
const INMUNIDADES = {
  levitate: "ground", eartheater: "ground", flashfire: "fire", wellbakedbody: "fire", waterabsorb: "water",
  stormdrain: "water", dryskin: "water", voltabsorb: "electric", lightningrod: "electric",
  motordrive: "electric", sapsipper: "grass"
};

// ---------- Fórmula ----------

// Etapas: +1 = ×1,5, +2 = ×2... y −1 = ×2/3, −2 = ×1/2...
export function multiplicadorEtapa(etapa) {
  return etapa >= 0 ? (2 + etapa) / 2 : 2 / (2 - etapa);
}

// Redondeo de los juegos: a partir de ,5 exacto hacia abajo
function redondear(x) {
  return x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x);
}

// Una estadística tal y como está en el combate: con su etapa, el objeto (Cinta Elección,
// Pañuelo...), la habilidad (Potencia, Ímpetu Arena con arena...), el clima (la Def. Esp. de
// los Roca con arena...) y la parálisis. La usan la fórmula y lo que se pinta, para que los
// números sean los mismos.
//   opciones: { etapa (si no, la suya), sinHabilidad (el rival tiene Rompemoldes) }
//   -> { valor, cambios: [textos de lo que la ha cambiado, sin contar la etapa] }
export function statEnCombate(c, i, campo = {}, { etapa = (c.etapas || [])[i] || 0, sinHabilidad = false } = {}) {
  const cambios = [];
  let valor = Math.floor(c.stats[i] * multiplicadorEtapa(i ? etapa : 0));

  const objeto = efectoObjeto(c.objeto, c.especie);
  if (objeto && objeto.stats && objeto.stats[i]) {
    valor = redondear(valor * objeto.stats[i]);
    cambios.push(`${nombre(c.objeto)} (${objeto.texto})`);
  }

  const habilidad = sinHabilidad ? "" : clave(c.habilidad && c.habilidad.en);
  const conEstado = Boolean(c.quemado || c.paralizado);
  let porHabilidad = 1;
  const cuenta = (cumple, factor) => {
    if (!cumple) return;
    porHabilidad *= factor;
    cambios.push(`${nombre(c.habilidad)} (${HABILIDADES[habilidad]})`);
  };
  cuenta(i === 1 && (habilidad === "hugepower" || habilidad === "purepower"), 2);
  cuenta(i === 1 && (habilidad === "hustle" || habilidad === "gorillatactics"), 1.5);
  cuenta(i === 1 && habilidad === "guts" && conEstado, 1.5);
  cuenta(i === 3 && habilidad === "solarpower" && campo.clima === "sol", 1.5);
  cuenta(i === 2 && habilidad === "furcoat", 2);
  cuenta(i === 2 && habilidad === "marvelscale" && conEstado, 1.5);
  cuenta(i === 5 && VELOCIDAD_CLIMA[habilidad] && VELOCIDAD_CLIMA[habilidad] === campo.clima, 2);
  cuenta(i === 5 && habilidad === "quickfeet" && conEstado, 1.5);
  if (porHabilidad !== 1) valor = Math.max(1, redondear(valor * porHabilidad));

  const tipos = c.tipos || [];
  if (i === 4 && campo.clima === "arena" && tipos.includes("rock")) {
    valor = Math.floor(valor * 1.5);
    cambios.push(t("Arena: Def. Esp. ×1,5"));
  }
  if (i === 2 && campo.clima === "nieve" && tipos.includes("ice")) {
    valor = Math.floor(valor * 1.5);
    cambios.push(t("Nieve: Defensa ×1,5"));
  }
  // Con Pies Rápidos, la parálisis no le frena
  if (i === 5 && c.paralizado && habilidad !== "quickfeet") {
    valor = Math.floor(valor / 2);
    cambios.push(t("Paralizado: Velocidad ×½"));
  }
  return { valor: Math.max(1, valor), cambios };
}

// Si la habilidad de «c» no cuenta porque el rival tiene Rompemoldes (o Turbollama, Terravoltaje)
export function habilidadAnulada(c, rival) {
  const suya = clave(c && c.habilidad && c.habilidad.en);
  const delRival = clave(rival && rival.habilidad && rival.habilidad.en);
  return ROMPEMOLDES.includes(delRival) && Boolean(HABILIDADES[suya]) && !IRROMPIBLES.includes(suya);
}

// La velocidad de verdad, para saber quién ataca antes
export function velocidad(c, campo = {}) {
  return statEnCombate(c, 5, campo).valor;
}

// Las 16 tiradas posibles (del 85% al 100%), de menor a mayor, y lo que ha influido:
//   { tiradas, efectividad, stab, extras: [textos de lo que ha contado: objetos, clima...] }
export function calcularDanio(atacante, defensor, ataqueElegido, campo = {}) {
  const extras = [];
  const apuntar = (texto) => {
    if (!extras.includes(texto)) extras.push(texto);
  };

  // Habilidades (la del defensor no cuenta si el atacante tiene Rompemoldes)
  const habA = clave(atacante.habilidad && atacante.habilidad.en);
  let habD = clave(defensor.habilidad && defensor.habilidad.en);
  const usaA = () => apuntar(`${nombre(atacante.habilidad)} (${HABILIDADES[habA]})`);
  const usaD = () => apuntar(`${nombre(defensor.habilidad)} (${HABILIDADES[habD]})`);
  if (ROMPEMOLDES.includes(habA) && HABILIDADES[habD] && !IRROMPIBLES.includes(habD)) {
    apuntar(t("{habilidad}: no cuenta {otra}", { habilidad: nombre(atacante.habilidad), otra: nombre(defensor.habilidad) }));
    habD = "";
  }

  // Piel Celeste y compañía: los de tipo Normal pasan a ser de otro tipo (y más fuertes)
  const ataque = { ...ataqueElegido };
  let potenciaHabilidad = 1;
  if ((CAMBIAN_TIPO[habA] && ataque.tipo === "normal") || habA === "normalize") {
    ataque.tipo = CAMBIAN_TIPO[habA] || "normal";
    potenciaHabilidad *= 4915 / 4096;
    usaA();
  }

  const fisico = ataque.clase === "fisico";
  const iAtaque = fisico ? 1 : 3;
  const iDefensa = fisico ? 2 : 4;
  const critico = Boolean(campo.critico);
  const tiposD = defensor.tipos || [];

  let efectividad = multiplicador(ataque.tipo, tiposD);
  if (habA === "scrappy" && ["normal", "fighting"].includes(ataque.tipo) && tiposD.includes("ghost")) {
    efectividad = multiplicador(ataque.tipo, tiposD.filter((t) => t !== "ghost"));
    usaA();
  }
  if (INMUNIDADES[habD] === ataque.tipo || (habD === "wonderguard" && efectividad > 0 && efectividad <= 1)) {
    efectividad = 0;
    usaD();
  }
  const stab = (atacante.tipos || []).includes(ataque.tipo);

  if (!ataque.potencia || efectividad === 0) {
    return { tiradas: new Array(16).fill(0), efectividad, stab, extras };
  }

  const objetoA = efectoObjeto(atacante.objeto, atacante.especie);
  const objetoD = efectoObjeto(defensor.objeto, defensor.especie);
  const cuenta = (objeto, efecto) => apuntar(`${nombre(objeto)} (${efecto.texto})`);

  // El crítico no hace caso de las bajadas del atacante ni de las subidas del defensor
  let etapaA = (atacante.etapas || [])[iAtaque] || 0;
  let etapaD = (defensor.etapas || [])[iDefensa] || 0;
  if (critico) {
    etapaA = Math.max(0, etapaA);
    etapaD = Math.min(0, etapaD);
  }

  // Ataque (o At. Esp.): la estadística como está en combate (etapa, objeto, Potencia...) y
  // lo que depende del tipo del ataque (Mar Llamas, Acero Templado...) o del rival (Sebo...)
  const statA = statEnCombate(atacante, iAtaque, campo, { etapa: etapaA });
  statA.cambios.forEach(apuntar);
  let A = statA.valor;
  let modA = 1;
  const subeA = (cumple, factor) => {
    if (!cumple) return;
    modA *= factor;
    usaA();
  };
  subeA(CON_POCA_VIDA[habA] === ataque.tipo && (atacante.ps ?? 100) <= 100 / 3, 1.5);
  subeA(habA === "steelworker" && ataque.tipo === "steel", 1.5);
  subeA(habA === "dragonsmaw" && ataque.tipo === "dragon", 1.5);
  subeA(habA === "rockypayload" && ataque.tipo === "rock", 1.5);
  subeA(habA === "transistor" && ataque.tipo === "electric", 5325 / 4096);
  subeA(habA === "waterbubble" && ataque.tipo === "water", 2);
  const bajaA = (cumple) => {
    if (!cumple) return;
    modA *= 0.5;
    usaD();
  };
  bajaA(habD === "thickfat" && (ataque.tipo === "fire" || ataque.tipo === "ice"));
  bajaA((habD === "heatproof" || habD === "waterbubble") && ataque.tipo === "fire");
  bajaA(habD === "purifyingsalt" && ataque.tipo === "ghost");
  if (modA !== 1) A = Math.max(1, redondear(A * modA));

  // Defensa (o Def. Esp.): como está en combate (etapa, objeto, clima, Pelaje Recio...)
  const statD = statEnCombate(defensor, iDefensa, campo, { etapa: etapaD, sinHabilidad: !habD });
  statD.cambios.forEach(apuntar);
  const D = statD.valor;

  // La potencia, con los objetos (los de tipo, las gemas...) y las habilidades que la suben
  let potencia = ataque.potencia;
  const subeP = (cumple, factor, usa = usaA) => {
    if (!cumple) return;
    potenciaHabilidad *= factor;
    usa();
  };
  subeP(habA === "technician" && ataque.potencia <= 60, 1.5);
  // Rivalidad: solo si los dos tienen género
  const conGeneros = Boolean(atacante.genero && defensor.genero);
  subeP(habA === "rivalry" && conGeneros && atacante.genero === defensor.genero, 1.25);
  subeP(habA === "rivalry" && conGeneros && atacante.genero !== defensor.genero, 0.75);
  subeP(habA === "toughclaws" && ataque.contacto, 5325 / 4096);
  subeP(habA === "ironfist" && ataque.punetazo, 4915 / 4096);
  subeP(habA === "strongjaw" && ataque.mordisco, 1.5);
  subeP(habA === "megalauncher" && ataque.pulso, 1.5);
  subeP(habA === "punkrock" && ataque.sonido, 5325 / 4096);
  subeP(habA === "sandforce" && campo.clima === "arena" && ["rock", "ground", "steel"].includes(ataque.tipo), 5325 / 4096);
  subeP(habA === "steelyspirit" && ataque.tipo === "steel", 1.5);
  subeP(habA === "sheerforce" && ataque.secundario, 5325 / 4096);
  subeP(habD === "dryskin" && ataque.tipo === "fire", 1.25, usaD);
  let modP = potenciaHabilidad;
  if (
    objetoA && objetoA.potencia &&
    (!objetoA.tipos || objetoA.tipos.includes(ataque.tipo)) &&
    (!objetoA.clase || objetoA.clase === ataque.clase)
  ) {
    modP *= objetoA.potencia;
    cuenta(atacante.objeto, objetoA);
  }
  if (modP !== 1) potencia = Math.max(1, redondear(potencia * modP));

  const nivel = atacante.nivel || 100;
  let base = Math.floor(Math.floor((Math.floor((2 * nivel) / 5 + 2) * potencia * A) / D) / 50) + 2;

  if (campo.clima === "sol" || campo.clima === "lluvia") {
    const aFavor = campo.clima === "sol" ? "fire" : "water";
    const enContra = campo.clima === "sol" ? "water" : "fire";
    const clima = campo.clima === "sol" ? t("Sol") : t("Lluvia");
    if (ataque.tipo === aFavor) {
      base = redondear(base * 1.5);
      apuntar(t("{clima} ×1,5", { clima }));
    }
    if (ataque.tipo === enContra) {
      base = redondear(base * 0.5);
      apuntar(t("{clima} ×½", { clima }));
    }
  }
  if (critico) base = Math.floor(base * 1.5);

  let final = 1;
  const multiplicaFinal = (cumple, factor, usa) => {
    if (!cumple) return;
    final *= factor;
    usa();
  };
  const pantalla = fisico ? campo.reflejo : campo.luz;
  if (pantalla) {
    if (critico) apuntar(t("El crítico se salta la pantalla"));
    else {
      final *= 0.5;
      apuntar(t("{pantalla} ×½", { pantalla: fisico ? t("Reflejo") : t("Pantalla de luz") }));
    }
  }
  if (objetoA && objetoA.final && (!objetoA.superEficaz || efectividad > 1)) {
    final *= objetoA.final;
    cuenta(atacante.objeto, objetoA);
  }
  if (objetoD && objetoD.baya === ataque.tipo && (efectividad > 1 || ataque.tipo === "normal")) {
    final *= 0.5;
    cuenta(defensor.objeto, objetoD);
  }
  multiplicaFinal(habA === "tintedlens" && efectividad < 1, 2, usaA);
  multiplicaFinal(habA === "sniper" && critico, 1.5, usaA);
  multiplicaFinal(["filter", "solidrock", "prismarmor"].includes(habD) && efectividad > 1, 0.75, usaD);
  multiplicaFinal(["multiscale", "shadowshield"].includes(habD) && (defensor.ps ?? 100) >= 100, 0.5, usaD);
  multiplicaFinal(habD === "icescales" && !fisico, 0.5, usaD);
  multiplicaFinal(habD === "fluffy" && ataque.contacto, 0.5, usaD);
  multiplicaFinal(habD === "fluffy" && ataque.tipo === "fire", 2, usaD);
  multiplicaFinal(habD === "punkrock" && ataque.sonido, 0.5, usaD);

  // Agallas no se deja quitar daño por la quemadura
  const quemadura = atacante.quemado && fisico && habA !== "guts";
  const stabMultiplicador = habA === "adaptability" ? 2 : 1.5;
  if (stab && habA === "adaptability") usaA();

  const tiradas = [];
  for (let azar = 85; azar <= 100; azar++) {
    let d = Math.floor((base * azar) / 100);
    if (stab) d = redondear(d * stabMultiplicador);
    d = Math.floor(d * efectividad);
    if (quemadura) d = redondear(d * 0.5);
    d = redondear(d * final);
    tiradas.push(Math.max(1, d));
  }
  if (quemadura) apuntar(t("Quemado ×½"));
  return { tiradas, efectividad, stab, extras };
}

// Probabilidad (de 0 a 1) de dejarlo KO en «golpes» golpes, contando todas las combinaciones
// de tiradas (16 por golpe, todas igual de probables). topePrimero: lo más que puede quitar
// el primer golpe (con Banda Focus, todos los PS menos 1)
export function probabilidadKO(tiradas, ps, golpes, topePrimero = Infinity) {
  let reparto = new Map([[0, 1]]);
  for (let g = 0; g < golpes; g++) {
    const siguiente = new Map();
    for (const [suma, veces] of reparto) {
      for (const tirada of tiradas) {
        // Pasarse de los PS ya cuenta igual: se junta todo en «ps» para no hacer el mapa enorme
        const nueva = Math.min(ps, g === 0 ? Math.min(topePrimero, tirada) : suma + tirada);
        siguiente.set(nueva, (siguiente.get(nueva) || 0) + veces);
      }
    }
    reparto = siguiente;
  }
  const total = tiradas.length ** golpes;
  return (reparto.get(ps) || 0) / total;
}

// { golpes, seguro, probabilidad, banda } del primer número de golpes (hasta 4) con el que
// puede caer; golpes null si ni en 4, o si no le hace nada. banda: lleva Banda Focus con
// todos los PS (el primer golpe le deja como mucho con 1 PS); en el resultado, true si le ha
// salvado de caer de un golpe.
export function resumenKO(tiradas, ps, banda = false) {
  if (!tiradas.length || tiradas[tiradas.length - 1] === 0 || ps <= 0) return { golpes: null };
  const tope = banda && ps > 1 ? ps - 1 : Infinity;
  for (let golpes = 1; golpes <= 4; golpes++) {
    const probabilidad = probabilidadKO(tiradas, ps, golpes, tope);
    if (probabilidad > 0) {
      const salvado = tope < Infinity && tiradas[tiradas.length - 1] >= ps;
      return { golpes, seguro: probabilidad >= 1, probabilidad, banda: salvado };
    }
  }
  return { golpes: null, banda: tope < Infinity && tiradas[tiradas.length - 1] >= ps };
}
