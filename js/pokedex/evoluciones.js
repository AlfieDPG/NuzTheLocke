// Bocadillo de la Pokédex: al pulsar la foto de un Pokémon sale, pegada a ella, su línea
// evolutiva entera y cómo evoluciona cada uno. Lleva también:
//   · las formas regionales, cada una con su propia línea (Vulpix de Alola -> Ninetales de
//     Alola, Meowth de Galar -> Perrserker...);
//   · las megaevoluciones (con su megapiedra) y los cambios de forma (Giratina Origen,
//     Rotom Calor...), colgando con una flecha discontinua del Pokémon del que salen.
//
// Sale de PokeAPI: pokemon-species/{n} dice cuál es su cadena, evolution-chain/{id} la da
// entera (con la forma que evoluciona y la que sale) y las variedades de cada especie dan las
// formas. Los nombres de especies, objetos y ataques, en español, de datos/nombres.json.

import { pedirJSON, URL_API } from "../comun/api.js";
import { cargarDatos, datos, buscarPorNombreIngles } from "../comun/datos.js";
import { obtenerVariedades, formaDeTipo, etiquetaForma } from "../comun/formas.js";
import { indicePMD } from "../comun/formas-pmd.js";
import { imagenConRespaldo, urlsPMD } from "../comun/imagenes.js";
import { tiposEs } from "../comun/tipos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { sumarContador } from "../comun/contadores.js";
import { t, nombre } from "../comun/idioma.js";

let bocadillo = null;
let abiertoDe = null; // botón de la foto que lo ha abierto

// ---------- Nombres ----------

// "https://pokeapi.co/api/v2/item/82/" -> 82
function idDeUrl(url) {
  return Number(String(url || "").split("/").filter(Boolean).pop());
}

const indices = new Map(); // lista de datos -> Map(id -> entrada)

function nombreEn(lista, recurso) {
  if (!recurso) return "";
  if (!indices.has(lista)) indices.set(lista, new Map(lista.map((entrada) => [entrada.id, entrada])));
  const entrada = indices.get(lista).get(idDeUrl(recurso.url));
  // Si no está (algo muy nuevo), el nombre interno un poco arreglado: "tart-apple" -> "Tart Apple"
  return entrada ? nombre(entrada) : recurso.name.replace(/-/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

const especie = (recurso) => nombreEn(datos.pokemon, recurso);
const objeto = (recurso) => nombreEn(datos.objetos, recurso);
const ataque = (recurso) => nombreEn(datos.ataques, recurso);

// Objeto por su nombre en inglés (para los cambios de forma de abajo)
function objetoIngles(ingles) {
  const entrada = buscarPorNombreIngles(datos.objetos, ingles);
  return entrada ? nombre(entrada) : ingles;
}

function ataqueIngles(ingles) {
  const entrada = buscarPorNombreIngles(datos.ataques, ingles);
  return entrada ? nombre(entrada) : ingles;
}

// ---------- Cómo evoluciona ----------

const MOMENTOS = { day: t("de día"), night: t("de noche"), dusk: t("al anochecer"), "full-moon": t("con luna llena") };

// Los que no son subir de nivel, usar un objeto o intercambiar. {ataque}: el que pide.
const ESPECIALES = {
  shed: "Al evolucionar Nincada, con hueco en el equipo y una Poké Ball",
  spin: "Girar con un dulce equipado",
  "tower-of-darkness": "Superar la Torre de la Oscuridad",
  "tower-of-waters": "Superar la Torre del Agua",
  "three-critical-hits": "Tres golpes críticos en un combate",
  "take-damage": "Tras recibir mucho daño sin debilitarse",
  "agile-style-move": "Usar {ataque} en estilo rápido 20 veces",
  "strong-style-move": "Usar {ataque} en estilo fuerte 20 veces",
  "recoil-damage": "Recibir mucho daño de retroceso",
  "use-move": "Usar {ataque} 20 veces",
  "three-defeated-bisharp": "Derrotar a 3 Bisharp líderes",
  "gimmighoul-coins": "Reunir 999 monedas de Gimmighoul",
  "meltan-candies": "400 caramelos de Meltan (Pokémon GO)",
  "in-battle-level-up": "Subir de nivel en combate",
  other: "Método especial"
};
for (const clave of Object.keys(ESPECIALES)) ESPECIALES[clave] = t(ESPECIALES[clave]);

const TRIGGERS_CON_ATAQUE = ["agile-style-move", "strong-style-move", "use-move"];

function textoDetalle(d) {
  const trigger = (d.trigger && d.trigger.name) || "";
  const movimiento = ataque(d.used_move || d.known_move) || t("un movimiento");
  const partes = [];

  if (trigger === "level-up") partes.push(d.min_level ? t("Nivel {n}", { n: d.min_level }) : t("Subir de nivel"));
  else if (trigger === "use-item") partes.push(objeto(d.item) || t("Usar un objeto"));
  else if (trigger === "trade") partes.push(t("Intercambio"));
  else if (trigger === "use-move" && d.min_move_count) partes.push(t("Usar {ataque} {n} veces", { ataque: movimiento, n: d.min_move_count }));
  else if ((trigger === "take-damage" || trigger === "recoil-damage") && d.min_damage_taken) {
    partes.push(t(trigger === "take-damage" ? "Recibir {n} PS de daño sin debilitarse" : "Recibir de retroceso {n} PS de daño sin debilitarse", { n: d.min_damage_taken }));
  } else partes.push((ESPECIALES[trigger] || ESPECIALES.other).replace("{ataque}", movimiento));

  if (d.held_item) partes.push(t("llevando {objeto}", { objeto: objeto(d.held_item) }));
  if (d.known_move && !TRIGGERS_CON_ATAQUE.includes(trigger)) partes.push(t("sabiendo {ataque}", { ataque: ataque(d.known_move) }));
  if (d.known_move_type) partes.push(t("sabiendo un movimiento de tipo {tipo}", { tipo: tiposEs[d.known_move_type.name] || d.known_move_type.name }));
  if (d.min_happiness) partes.push(t("con mucha amistad"));
  if (d.min_affection) partes.push(t("con mucho afecto"));
  if (d.min_beauty) partes.push(t("con mucha belleza"));
  if (d.min_steps) partes.push(t("tras andar {n} pasos", { n: d.min_steps }));
  if (d.time_of_day) partes.push(MOMENTOS[d.time_of_day] || d.time_of_day);
  if (d.location) partes.push(t("en un lugar concreto"));
  if (d.needs_overworld_rain) partes.push(t("con lluvia"));
  if (d.party_species) partes.push(t("con {pokemon} en el equipo", { pokemon: especie(d.party_species) }));
  if (d.party_type) partes.push(t("con un Pokémon de tipo {tipo} en el equipo", { tipo: tiposEs[d.party_type.name] || d.party_type.name }));
  if (d.relative_physical_stats === 1) partes.push(t("con más Ataque que Defensa"));
  if (d.relative_physical_stats === -1) partes.push(t("con más Defensa que Ataque"));
  if (d.relative_physical_stats === 0) partes.push(t("con el mismo Ataque que Defensa"));
  if (d.trade_species) partes.push(t("por {pokemon}", { pokemon: especie(d.trade_species) }));
  if (d.turn_upside_down) partes.push(t("con la consola boca abajo"));
  if ((d.allowed_natures || []).length) partes.push(t("según su naturaleza"));
  if (d.gender === 1) partes.push(t("(hembra)"));
  if (d.gender === 2) partes.push(t("(macho)"));

  return partes.join(", ");
}

// PokeAPI da una forma por juego (Leafeon: en un lugar concreto en unos, con Piedra Hoja en
// otros): se enseñan las distintas, una por línea, como mucho tres
function textosMetodo(detalles) {
  return [...new Set((detalles || []).map(textoDetalle).filter(Boolean))].slice(0, 3);
}

// ---------- Megaevoluciones y cambios de forma ----------
//
// Ninguno sale en las cadenas de PokeAPI. Las megapiedras se buscan entre los objetos de la
// categoría «mega-stones» por el parecido del nombre («charizardite-x» -> charizard-mega-x).
// Los demás cambios de forma, a mano: si una forma no está aquí y no es regional, sale como
// «Cambio de forma».

const REGIONAL = /-(alola|galar|hisui|paldea)(-|$)/;
const MEGA = /^(.+?)-mega(?:-([xyz]))?$/;

let piedras = null;

async function megapiedras() {
  if (!piedras) {
    piedras = pedirJSON(`${URL_API}item-category/mega-stones/`)
      .then((categoria) => categoria.items)
      .catch(() => []);
  }
  return piedras;
}

function prefijoComun(uno, otro) {
  let n = 0;
  while (n < uno.length && n < otro.length && uno[n] === otro[n]) n++;
  return n;
}

// La megapiedra que más se parece al nombre de la mega (y con la misma letra: X, Y, Z)
function piedraDe(slug, lista) {
  const mega = MEGA.exec(slug);
  if (!mega) return null;
  const [, base, letra = ""] = mega;
  let mejor = null;
  let largo = 3;
  for (const piedra of lista) {
    const [, nombre, letraPiedra = ""] = /^(.+?)(?:-([xyz]))?$/.exec(piedra.name);
    if (letraPiedra !== letra) continue;
    const n = prefijoComun(nombre, base);
    if (n > largo) {
      largo = n;
      mejor = piedra;
    }
  }
  return mejor;
}

// slug -> [objeto en inglés, más texto] o una función que da el texto
const CAMBIOS = {
  "kyogre-primal": () => t("Regresión primigenia con {objeto}", { objeto: objetoIngles("Blue Orb") }),
  "groudon-primal": () => t("Regresión primigenia con {objeto}", { objeto: objetoIngles("Red Orb") }),
  "rayquaza-mega": () => t("Megaevolución sabiendo {ataque}", { ataque: ataqueIngles("Dragon Ascent") }),
  "giratina-origin": () => objetoIngles("Griseous Core"),
  "dialga-origin": () => objetoIngles("Adamant Crystal"),
  "palkia-origin": () => objetoIngles("Lustrous Globe"),
  "shaymin-sky": () => `${objetoIngles("Gracidea")}, ${t("de día")}`,
  "kyurem-black": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("DNA Splicers"), pokemon: "Zekrom" }),
  "kyurem-white": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("DNA Splicers"), pokemon: "Reshiram" }),
  "necrozma-dusk": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("N-Solarizer"), pokemon: "Solgaleo" }),
  "necrozma-dawn": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("N-Lunarizer"), pokemon: "Lunala" }),
  "necrozma-ultra": () => t("Ultraexplosión en combate"),
  "hoopa-unbound": () => objetoIngles("Prison Bottle"),
  "zacian-crowned": () => t("Llevando {objeto}", { objeto: objetoIngles("Rusted Sword") }),
  "zamazenta-crowned": () => t("Llevando {objeto}", { objeto: objetoIngles("Rusted Shield") }),
  "calyrex-ice": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("Reins of Unity"), pokemon: "Glastrier" }),
  "calyrex-shadow": () => t("{objeto} con {pokemon}", { objeto: objetoIngles("Reins of Unity"), pokemon: "Spectrier" }),
  "tornadus-therian": () => objetoIngles("Reveal Glass"),
  "thundurus-therian": () => objetoIngles("Reveal Glass"),
  "landorus-therian": () => objetoIngles("Reveal Glass"),
  "enamorus-therian": () => objetoIngles("Reveal Glass"),
  "meloetta-pirouette": () => t("Usar {ataque} en combate", { ataque: ataqueIngles("Relic Song") }),
  "keldeo-resolute": () => t("Sabiendo {ataque}", { ataque: ataqueIngles("Secret Sword") }),
  "palafin-hero": () => t("Salir del combate y volver a entrar"),
  "darmanitan-zen": () => t("En combate, con poca vida (Modo Daruma)"),
  "darmanitan-galar-zen": () => t("En combate, con poca vida (Modo Daruma)"),
  "oricorio-pom-pom": () => objetoIngles("Yellow Nectar"),
  "oricorio-pau": () => objetoIngles("Pink Nectar"),
  "oricorio-sensu": () => objetoIngles("Purple Nectar"),
  "ogerpon-wellspring-mask": () => t("Llevando {objeto}", { objeto: objetoIngles("Wellspring Mask") }),
  "ogerpon-hearthflame-mask": () => t("Llevando {objeto}", { objeto: objetoIngles("Hearthflame Mask") }),
  "ogerpon-cornerstone-mask": () => t("Llevando {objeto}", { objeto: objetoIngles("Cornerstone Mask") })
};

const PREFIJOS_CAMBIO = {
  "rotom-": "Cambiar el motor de Rotom",
  "deoxys-": "Tocar un meteorito",
  "zygarde-": "Con el Zygarde Cubo",
  "wormadam-": "Según el manto de Burmy",
  "castform-": "Según el tiempo, en combate",
  "cherrim-": "Con sol, en combate"
};
for (const clave of Object.keys(PREFIJOS_CAMBIO)) PREFIJOS_CAMBIO[clave] = t(PREFIJOS_CAMBIO[clave]);

// Texto del cambio de forma, o null si no es un cambio de forma (sino una forma regional o
// distinta sin más: esas salen con su propia línea)
function textoCambio(slug, lista) {
  if (CAMBIOS[slug]) return CAMBIOS[slug]();
  if (MEGA.test(slug)) {
    const piedra = piedraDe(slug, lista);
    return piedra ? t("Megaevolución con {objeto}", { objeto: objeto(piedra) }) : t("Megaevolución");
  }
  for (const [prefijo, texto] of Object.entries(PREFIJOS_CAMBIO)) {
    if (slug.startsWith(prefijo)) return texto;
  }
  if (REGIONAL.test(slug) || /-(male|female)$/.test(slug)) return null;
  return t("Cambio de forma");
}

// ---------- Montar el árbol ----------
//
// Cada nodo es una forma concreta (el nombre de su variedad: "vulpix", "vulpix-alola"). Las
// flechas salen de los detalles de la cadena: required_pokemon_form dice qué forma evoluciona
// y evolved_pokemon_form cuál sale (si no lo dicen, la normal). Así cada forma regional
// queda con su propia línea.

function recorrer(eslabon, alVer, padre = null) {
  alVer(eslabon, padre);
  for (const hijo of eslabon.evolves_to || []) recorrer(hijo, alVer, eslabon);
}

async function montar(numero) {
  const [datosEspecie] = await Promise.all([pedirJSON(`${URL_API}pokemon-species/${numero}`), cargarDatos()]);
  const cadena = await pedirJSON(datosEspecie.evolution_chain.url);

  const eslabones = [];
  recorrer(cadena.chain, (eslabon) => eslabones.push(eslabon));

  // Las formas de cada especie de la cadena
  const infos = new Map();
  await Promise.all(
    eslabones.map(async (eslabon) => {
      const id = idDeUrl(eslabon.species.url);
      let info = { especie: eslabon.species.name, lista: [eslabon.species.name] };
      try {
        info = await obtenerVariedades(id);
      } catch (error) {
        // sin formas: solo la normal
      }
      // Sin las de tipo de Arceus y Silvally: serían 17 más y no son evoluciones
      infos.set(id, { ...info, lista: info.lista.filter((slug) => !formaDeTipo(slug)) });
    })
  );

  const nodos = new Map(); // slug -> { slug, especie, nombre, hijos, cambios, entra }
  const nodo = (eslabon, slug) => {
    const id = idDeUrl(eslabon.species.url);
    const info = infos.get(id);
    if (!info.lista.includes(slug)) slug = info.lista[0];
    if (!nodos.has(slug)) {
      nodos.set(slug, { slug, especie: id, info, nombre: especie(eslabon.species), hijos: [], cambios: [], entra: false });
    }
    return nodos.get(slug);
  };

  // Primero la forma normal de cada especie, para que salgan en el orden de la cadena
  for (const eslabon of eslabones) nodo(eslabon, infos.get(idDeUrl(eslabon.species.url)).lista[0]);

  // Las flechas, juntando los detalles que van de la misma forma a la misma forma
  recorrer(cadena.chain, (eslabon, padre) => {
    if (!padre) return;
    const flechas = new Map();
    const detalles = eslabon.evolution_details.length ? eslabon.evolution_details : [{}];
    for (const d of detalles) {
      const desde = nodo(padre, d.required_pokemon_form ? d.required_pokemon_form.name : "");
      let hacia = d.evolved_pokemon_form ? d.evolved_pokemon_form.name : "";
      // Una regional que evoluciona sin decir a qué: a la misma región, si la especie la tiene
      const region = REGIONAL.exec(desde.slug);
      if (!hacia && region) hacia = `${infos.get(idDeUrl(eslabon.species.url)).especie}-${desde.slug.slice(desde.slug.indexOf(region[1]))}`;
      const destino = nodo(eslabon, hacia);
      const clave = `${desde.slug}>${destino.slug}`;
      if (!flechas.has(clave)) flechas.set(clave, { desde, destino, detalles: [] });
      if (d.trigger) flechas.get(clave).detalles.push(d);
    }
    for (const { desde, destino, detalles: suyos } of flechas.values()) {
      desde.hijos.push({ nodo: destino, textos: textosMetodo(suyos) });
      destino.entra = true;
    }
  });

  // Las demás formas: cambios de forma colgando de la normal; el resto, con su propia línea
  const lista = eslabones.some((eslabon) => infos.get(idDeUrl(eslabon.species.url)).lista.some((slug) => MEGA.test(slug)))
    ? await megapiedras()
    : [];
  for (const eslabon of eslabones) {
    const info = infos.get(idDeUrl(eslabon.species.url));
    for (const slug of info.lista.slice(1)) {
      if (nodos.has(slug)) continue;
      const texto = textoCambio(slug, lista);
      const suyo = nodo(eslabon, slug);
      if (texto) {
        nodos.get(info.lista[0]).cambios.push({ nodo: suyo, textos: [texto] });
        suyo.entra = true;
      }
    }
  }

  // Imagen y nombre de cada forma
  await Promise.all(
    [...nodos.values()].map(async (n) => {
      try {
        n.forma = await formaDe(n);
      } catch (error) {
        n.forma = {}; // sin conexión: el retrato de la especie
      }
    })
  );

  return [...nodos.values()].filter((n) => !n.entra);
}

// El nombre de la forma y su retrato de Mundo Misterioso. La subcarpeta del retrato se cuenta
// igual que en la tabla (js/pokedex/datos.js): posición entre TODAS las variedades que no son
// la normal, por id, con las correcciones de formas-pmd.js.
async function formaDe(n) {
  if (n.slug === n.info.lista[0]) return {};
  const etiqueta = etiquetaForma(n.slug, n.info.especie);
  const datosEspecie = await pedirJSON(`${URL_API}pokemon-species/${n.especie}`); // ya pedida
  const otras = datosEspecie.varieties
    .filter((variedad) => !variedad.is_default)
    .map((variedad) => ({ nombre: variedad.pokemon.name, id: idDeUrl(variedad.pokemon.url) }))
    .sort((una, otra) => una.id - otra.id);
  const posicion = otras.findIndex((variedad) => variedad.nombre === n.slug);
  if (posicion < 0) return { etiqueta };
  const id = otras[posicion].id;
  return { etiqueta, idForma: id, formaPMD: indicePMD(id, posicion + 1) };
}

// ---------- Pintar ----------

// Siempre un retrato de Mundo Misterioso, como en la tabla: el de la forma y, si no lo tiene,
// el de su especie. Nunca los sprites de PokeAPI (en las formas modernas son renders 3D).
// Las hembras (Meowstic, Indeedee...) no van por número de forma: Mundo Misterioso las guarda
// en {número}/0000/0000/0002.
function retrato(n) {
  const deEspecie = urlsPMD({ id: n.especie });
  const forma = { id: n.especie, idForma: n.forma.idForma, formaPMD: n.forma.formaPMD || 0 };
  const urls = /-female$/.test(n.slug)
    ? [...deEspecie.map((url) => url.replace(/Normal\.png$/, "0000/0000/0002/Normal.png")), ...deEspecie]
    : [...urlsPMD(forma), ...(n.forma.formaPMD ? deEspecie : [])];
  return imagenConRespaldo(urls, `class="evo-cara" alt="" data-quitar-si-falla`);
}

// clave: el id de la fila pulsada (el de su forma): esa sale marcada
function plantillaNodo(n, clave) {
  const actual = (n.forma.idForma || n.especie) === clave;
  const paso = (rama, cambio) => `
    <div class="evo-paso ${cambio ? "cambio" : ""}">
      <div class="evo-metodo">
        ${rama.textos.map((texto) => `<span>${escaparHTML(texto)}</span>`).join("")}
        <span class="evo-flecha">${cambio ? "⇢" : "→"}</span>
      </div>
      ${plantillaNodo(rama.nodo, clave)}
    </div>`;
  const pasos = [...n.hijos.map((rama) => paso(rama, false)), ...n.cambios.map((rama) => paso(rama, true))];

  return `
    <div class="evo-rama">
      <div class="evo-pokemon ${actual ? "actual" : ""}">
        ${retrato(n)}
        <span>${escaparHTML(n.nombre)}</span>
        ${n.forma.etiqueta ? `<small>${escaparHTML(n.forma.etiqueta)}</small>` : ""}
      </div>
      ${pasos.length ? `<div class="evo-hijos">${pasos.join("")}</div>` : ""}
    </div>`;
}

// Pegado a la foto: debajo si cabe y si no encima, sin salirse por los lados. La flecha del
// bocadillo apunta siempre al centro de la foto.
function colocar() {
  if (!bocadillo || !abiertoDe) return;
  const foto = abiertoDe.getBoundingClientRect();
  const ancho = bocadillo.offsetWidth;
  const alto = bocadillo.offsetHeight;
  const margen = 8;

  const izquierda = Math.max(margen, Math.min(foto.left - 16, window.innerWidth - ancho - margen));
  const debajo = foto.bottom + 10 + alto <= window.innerHeight || foto.top - 10 - alto < 0;
  const arriba = debajo ? foto.bottom + 10 : foto.top - 10 - alto;

  bocadillo.classList.toggle("encima", !debajo);
  bocadillo.style.left = `${izquierda + window.scrollX}px`;
  bocadillo.style.top = `${arriba + window.scrollY}px`;
  bocadillo.style.setProperty("--flecha", `${foto.left + foto.width / 2 - izquierda}px`);
}

const suave = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

// Al cerrarse se desvanece un momento (ya no se puede pulsar) y después se quita
export function cerrarEvoluciones() {
  if (bocadillo) {
    const viejo = bocadillo;
    viejo.style.pointerEvents = "none";
    if (suave()) {
      const animacion = viejo.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.96)" }], { duration: 120, easing: "ease-in" });
      animacion.onfinish = () => viejo.remove();
    } else viejo.remove();
  }
  bocadillo = null;
  abiertoDe = null;
}

// Cuando llega la línea (en vez del «Cargando...»), el bocadillo crece hasta su tamaño en vez
// de saltar; si va encima de la foto, su borde de abajo se queda quieto
function crecer(antes) {
  if (!suave()) return;
  const ahora = { ancho: bocadillo.offsetWidth, alto: bocadillo.offsetHeight, arriba: bocadillo.style.top };
  if (Math.abs(ahora.ancho - antes.ancho) < 2 && Math.abs(ahora.alto - antes.alto) < 2) return;
  const este = bocadillo;
  // Mientras crece, lo de dentro no se sale ni saca barras de scroll; el piquito (que está
  // fuera, ::before) sí se ve: por eso «clip» con margen y no «hidden»
  const arbol = este.querySelector(".evo-arbol");
  este.style.overflow = "clip";
  este.style.overflowClipMargin = "0.6rem";
  if (arbol) arbol.style.overflow = "hidden";
  const animacion = este.animate(
    [
      { width: `${antes.ancho}px`, height: `${antes.alto}px`, top: antes.arriba },
      { width: `${ahora.ancho}px`, height: `${ahora.alto}px`, top: ahora.arriba }
    ],
    { duration: 200, easing: "ease-out" }
  );
  animacion.onfinish = () => {
    este.style.overflow = "";
    este.style.overflowClipMargin = "";
    if (arbol) arbol.style.overflow = "";
  };
}

// boton: la foto pulsada; numero: su número de la Pokédex; clave: el id de su forma (la de la
// fila). Pulsar la misma otra vez lo cierra.
export async function abrirEvoluciones(boton, numero, clave = numero) {
  if (abiertoDe === boton) {
    cerrarEvoluciones();
    return;
  }
  cerrarEvoluciones();

  abiertoDe = boton;
  sumarContador("evoluciones"); // para los logros
  bocadillo = document.createElement("div");
  bocadillo.className = "bocadillo-evo";
  bocadillo.innerHTML = `<p class="evo-aviso">${t("Cargando...")}</p>`;
  document.body.appendChild(bocadillo);
  colocar();

  const este = bocadillo;
  let html;
  try {
    const raices = await montar(numero);
    const evoluciona = raices.some((n) => n.hijos.length || n.cambios.length) || raices.length > 1;
    html = `
      <div class="evo-arbol">
        ${raices.map((n) => `<div class="evo-linea">${plantillaNodo(n, clave)}</div>`).join("")}
        ${evoluciona ? "" : `<p class="evo-aviso">${t("No evoluciona.")}</p>`}
      </div>`;
  } catch (error) {
    console.error(error);
    html = `<p class="evo-aviso">${t("No se ha podido cargar. Revisa tu conexión.")}</p>`;
  }
  if (bocadillo !== este) return; // mientras cargaba se ha cerrado o se ha abierto otro
  const antes = { ancho: bocadillo.offsetWidth, alto: bocadillo.offsetHeight, arriba: bocadillo.style.top };
  bocadillo.innerHTML = html;
  colocar();
  crecer(antes);
}

// ---------- Cerrar ----------

document.addEventListener("click", (e) => {
  if (bocadillo && !bocadillo.contains(e.target) && !(abiertoDe && abiertoDe.contains(e.target))) cerrarEvoluciones();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarEvoluciones();
});
window.addEventListener("resize", colocar);
