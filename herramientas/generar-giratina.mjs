// Genera img/titulos/giratina-der.svg (las alas del lado derecho de «Rey del Inframundo") a partir
// de giratina.svg (las del izquierdo): el mismo dibujo en espejo y con otros ritmos, para que los
// dos lados no se muevan a la par.
//
// Uso: node herramientas/generar-giratina.mjs
//
// Hace falta el espejo ya dibujado (no vale darle la vuelta en el CSS): las dos alas van como dos
// capas del fondo de una misma pieza, por detrás de la tarjeta del título (css/titulos-adornos.css).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const carpeta = fileURLToPath(new URL("../img/titulos/", import.meta.url));
const ANCHO = 48;   // el ancho del dibujo (viewBox)

// Otros ritmos para el lado derecho (segundos de cada animación)
const RITMOS = { late: 2.2, "mece-a": 5.2, "mece-b": 4.3, "mece-c": 4.4, "retuerce-a": 3.6, "retuerce-b": 3.2, "retuerce-c": 3.1 };

const espejoPares = (texto) =>
  texto.replace(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(ANCHO - Number(x)).toFixed(2)} ${y}`);

let svg = readFileSync(`${carpeta}giratina.svg`, "utf8");
svg = svg
  // Los trazos: en los atributos d="..." y en los path("...") de las animaciones
  .replace(/ d="([^"]+)"/g, (_, d) => ` d="${espejoPares(d)}"`)
  .replace(/path\("([^"]+)"\)/g, (_, d) => `path("${espejoPares(d)}")`)
  // Los puntos sobre los que se mecen
  .replace(/transform-origin: (\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px/g, (_, x, y) => `transform-origin: ${ANCHO - Number(x)}px ${y}px`)
  // Al mecerse, en espejo giran al revés
  .replace(/rotate\((-?\d+(?:\.\d+)?)deg\)/g, (_, g) => `rotate(${-Number(g)}deg)`)
  // Los ritmos
  .replace(/(late|mece-[abc]|retuerce-[abc]) (\d+(?:\.\d+)?)s/g, (_, nombre) => `${nombre} ${RITMOS[nombre]}s`)
  // El comentario de arriba
  .replace(/<!--[\s\S]*?-->/, `<!-- Rey del Inframundo: las alas de Giratina del lado DERECHO de la plaquita: giratina.svg en
       espejo y con otros ritmos. GENERADO por herramientas/generar-giratina.mjs: no se toca a mano. -->`);

writeFileSync(`${carpeta}giratina-der.svg`, svg);
console.log("ok");
