// ---------- Imágenes (arte, Mundo Misterioso, sprites, objetos) ----------
//
// Los renders 3D (los de HOME) no se usan en ninguna parte: en «Crear equipo», el arte 2D
// oficial; en lo demás, los retratos de Mundo Misterioso y, si no los hay, sprites.

import { indicePMD } from "./formas-pmd.js";

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const URL_PMD = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";

// Nombre del archivo de sus imágenes. Normalmente el id de la forma (Mega-Charizard X es
// el 10034), salvo Arceus y Silvally de un tipo, que van por nombre: "493-fire".
function idImagen(p) {
  return p.imagenForma || p.idForma || p.id;
}

// Arte grande (normal o shiny). Se arma con el id de la FORMA en vez de usar p.imagen:
// los Pokémon guardados hace tiempo pueden tener ahí el arte de la especie, y entonces
// una Mega o una forma de Alola salían con el dibujo de la forma normal.
export function urlArte(p) {
  return `${URL_SPRITES}pokemon/other/official-artwork/${p.shiny ? "shiny/" : ""}${idImagen(p)}.png`;
}

// Hembra de una especie en la que se ve distinta (Unfezant, Pikachu...): su retrato de Mundo
// Misterioso, si lo tiene. El género se mira aquí y no en pokemon.js para no cargar con él a
// quien solo pinta.
function esHembraDistinta(p) {
  return p.genero === "F" && p.difGenero;
}

// Artes de PokeAPI que desentonan y tienen uno mejor en Serebii. Las aves de Galar vienen
// con un contorno blanco (como una pegatina) que no tiene ningún otro arte y que sobre el
// fondo oscuro de las tarjetas canta mucho. El de Serebii es el mismo dibujo sin contorno.
// Solo para la versión normal: de las shiny no hay arte 2D sin contorno en ningún sitio.
const URL_ARTE_SEREBII = "https://www.serebii.net/pokemon/art/";
const ARTES_SEREBII = {
  10169: "144-g", // Articuno de Galar
  10170: "145-g", // Zapdos de Galar
  10171: "146-g"  // Moltres de Galar
};

// Arte grande con sus respaldos, por orden de preferencia (de la hembra no hay arte oficial:
// sale el de siempre)
export function urlsArte(p) {
  const serebii = !p.shiny && ARTES_SEREBII[p.idForma];
  return [serebii && `${URL_ARTE_SEREBII}${serebii}.png`, urlArte(p), p.imagen].filter(Boolean);
}

// Retrato de Mundo Misterioso con su respaldo: el de su forma (o el de la hembra) y, si no lo
// hay, el de su especie, como en la Pokédex. Nunca los sprites de PokeAPI: los de las formas
// modernas son renders 3D.
export function urlsRetrato(p) {
  const propias = urlsPMD(p);
  const conForma = indicePMD(p.idForma, p.formaPMD) || esHembraDistinta(p);
  return conForma ? [...new Set([...propias, ...urlsPMD({ id: p.id, shiny: p.shiny })])] : propias;
}

// Sprite pixelado pequeño (96x96). Sirve también para las formas alternativas,
// que tienen su propio id (Mega-Charizard X es el 10034).
export function urlSpritePixel(id) {
  return `${URL_SPRITES}pokemon/${id}.png`;
}

function cuatroCifras(n) {
  return String(n).padStart(4, "0");
}

// Retratos de Pokémon Mundo Misterioso (PMD SpriteCollab), de más a menos concreto
export function urlsPMD(p) {
  const dex = cuatroCifras(p.id);
  // Se corrige aquí (y no solo al añadir el Pokémon) para que también se arreglen
  // los equipos que ya estaban guardados con el número antiguo.
  const forma = indicePMD(p.idForma, p.formaPMD);
  const lista = [];
  // Hembra: carpeta 0002 dentro de la de normal (0000) o shiny (0001). Muy pocos la tienen.
  if (esHembraDistinta(p)) {
    if (p.shiny) lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/0001/0002/Normal.png`);
    lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/0000/0002/Normal.png`);
  }
  if (p.shiny) lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/0001/Normal.png`);

  // Si es una forma y Mundo Misterioso no la tiene, NO se cae al retrato de la especie:
  // saldría dibujada la forma normal (Mega-Meowstic hembra salía como un Meowstic macho).
  // Quien llame a esto ya pone detrás un respaldo que sí distingue la forma.
  if (forma) lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/Normal.png`);
  else lista.push(`${URL_PMD}${dex}/Normal.png`);

  return lista;
}

// Caras que tiene Mundo Misterioso además de la normal. No todos los Pokémon las tienen
// todas (muchas formas solo tienen tres o cuatro): las que faltan dan 404 y se saltan.
// Fuera las «Special», que son poses raras de cada uno, y las «^» (las mismas, giradas).
export const EMOCIONES_PMD = [
  "Normal", "Happy", "Joyous", "Inspired", "Surprised", "Determined", "Angry", "Shouting",
  "Worried", "Sad", "Crying", "Teary-Eyed", "Pain", "Dizzy", "Sigh", "Stunned"
];

// Las mismas direcciones que urlsPMD, pero con otra cara
export function urlsPMDEmocion(p, emocion) {
  return urlsPMD(p).map((url) => url.replace(/Normal\.png$/, `${emocion}.png`));
}

// Las caras que existen de verdad para unas direcciones de su cara normal (las de urlsPMD o
// urlsRetrato): promesa de [{ emocion, url }], en el orden de EMOCIONES_PMD. Se miran todas a
// la vez y se recuerda (las imágenes, además, se quedan en la caché). Para ir cambiando de cara
// al pulsar: las miniaturas de «Mis equipos» y la foto de perfil.
const carasYaMiradas = new Map();

export function carasDisponibles(normales) {
  const clave = normales.join("|");
  if (!carasYaMiradas.has(clave)) {
    carasYaMiradas.set(
      clave,
      Promise.all(
        EMOCIONES_PMD.map(async (emocion) => {
          for (const url of normales.map((normal) => normal.replace(/Normal\.png$/, `${emocion}.png`))) {
            if (await precargarImagen(url)) return { emocion, url };
          }
          return null;
        })
      ).then((lista) => lista.filter(Boolean))
    );
  }
  return carasYaMiradas.get(clave);
}

// Iconos de objetos, de mejor a peor:
//   1) Icono HD de Escarlata/Púrpura (Serebii): "Heavy-Duty Boots" -> heavy-dutyboots.png,
//      "King's Rock" -> king'srock.png (minúsculas, sin espacios ni acentos; guiones y apóstrofos se quedan)
//   2) Icono HD de Leyendas Z-A (Serebii), con el mismo nombre de archivo: objetos que no
//      salen en Escarlata/Púrpura, sobre todo las megapiedras nuevas ("Chandelurite" -> chandelurite.png)
//   3) Icono pixelado de PokeAPI (lo que no esté en ninguno de los dos)
const URL_OBJETOS_SV = "https://www.serebii.net/itemdex/sprites/sv/";
const URL_OBJETOS_ZA = "https://www.serebii.net/itemdex/sprites/za/";

export function urlsIconoObjeto(en) {
  const sinAcentos = en.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/’/g, "'");
  const serebii = sinAcentos.replace(/\s+/g, "");
  const pokeapi = sinAcentos
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return [
    `${URL_OBJETOS_SV}${serebii}.png`,
    `${URL_OBJETOS_ZA}${serebii}.png`,
    `${URL_SPRITES}items/${pokeapi}.png`
  ];
}

// ---------- <img> con direcciones de respaldo ----------

// <img> que prueba varias direcciones seguidas hasta que una cargue
export function imagenConRespaldo(urls, atributos) {
  const [primera, ...resto] = urls.filter(Boolean);
  return `<img src="${primera}" data-respaldo="${resto.join("|")}" ${atributos || ""}>`;
}

// Los errores de carga de imágenes no "suben" por la página, pero se pueden escuchar
// en fase de captura: así un solo oyente sirve para todas las <img data-respaldo>.
// Si se acaban las direcciones y la imagen tiene data-quitar-si-falla, se elimina.
export function activarRespaldoImagenes() {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-respaldo")) return;

      const resto = img.dataset.respaldo.split("|").filter(Boolean);
      if (resto.length === 0) {
        img.removeAttribute("data-respaldo");
        if (img.hasAttribute("data-quitar-si-falla")) img.remove();
        return;
      }
      img.src = resto.shift();
      img.dataset.respaldo = resto.join("|");
    },
    true
  );
}

// ---------- Precarga ----------

const precargadas = new Map(); // url -> promesa: true si cargó, false si falló

export function precargarImagen(url) {
  if (!precargadas.has(url)) {
    precargadas.set(
      url,
      new Promise((resolver) => {
        const img = new Image();
        img.onload = () => resolver(true);
        img.onerror = () => resolver(false);
        img.src = url;
      })
    );
  }
  return precargadas.get(url);
}

// Descarga las imágenes cuando el navegador no tiene nada mejor que hacer
export function precargarEnReposo(urls) {
  const enReposo = window.requestIdleCallback || ((tarea) => setTimeout(tarea, 200));
  enReposo(() => urls.filter(Boolean).forEach(precargarImagen));
}

const ultimoCambio = new WeakMap(); // img -> último cambio pedido

// Cambia la imagen sin que desaparezca: la nueva se descarga aparte
// y solo se pone cuando ya está lista. Prueba las direcciones por orden.
export async function cambiarImagen(img, urls) {
  const pedido = urls.join("|");
  ultimoCambio.set(img, pedido);

  for (const url of urls.filter(Boolean)) {
    const cargada = await precargarImagen(url);
    if (ultimoCambio.get(img) !== pedido) return; // mientras tanto se pidió otro cambio
    if (cargada) {
      img.removeAttribute("data-respaldo");
      img.src = url;
      return;
    }
  }
}
