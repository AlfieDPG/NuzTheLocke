// Dibuja los marcos de la foto que llevan un dibujo: los animados Jungla (una corona de hojas con
// lianas que cuelgan), Celestial (dos alas), Llamarada (un anillo de fuego, en cuatro fotogramas) y
// Escarcha (cristales de hielo y una tira de nieve), y los 18 de tipo de la Tienda (burbujas, llamas,
// una herradura...). Los guarda en img/marcos/<id>.svg (y <id>-delante.svg, lo que va encima de la
// foto). El CSS de los animados está a mano en css/juegos.css; el de los de tipo lo escribe este
// script en css/marcos-dibujo.css.
//
//   node herramientas/generar-marcos.mjs [carpeta-para-la-muestra] [ids,separados,por,comas]
//
// Cada marco es una lista de formas (elipses, polígonos y trazos) en un lienzo donde la foto es un
// círculo de radio 50. Con esa misma lista se escribe el SVG y, con una carpeta, unas muestras en PNG
// (con una foto gris encima y el aro del CSS debajo, como en la web) para mirarlos sin navegador.
// Todo dibujado por código: nada de imágenes de otros ni de IA.
//
// Para el CSS: el dibujo va en un ::after que mide ancho% × alto% de la foto (la foto mide 100) y
// se coloca con left = -(cx - 50)% y top = -(cy - 50)%. El script lo escribe al terminar.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { png } from "./png.mjs";

const CARPETA = fileURLToPath(new URL("../img/marcos/", import.meta.url));

// Formas: { elipse: [cx, cy, rx, ry, giro], relleno, borde, grueso } y { trazo: [[x, y], ...], color, grueso }
const elipse = (cx, cy, rx, ry, giro, relleno, borde, grueso = 1.5) => ({ elipse: [cx, cy, rx, ry, giro], relleno, borde, grueso });
const trazo = (puntos, color, grueso) => ({ trazo: puntos, color, grueso });

// Lo de un lado, también al otro (para las alas)
const espejo = (formas, ancho) => formas.map((forma) => {
  if (forma.elipse) return { ...forma, elipse: [ancho - forma.elipse[0], forma.elipse[1], forma.elipse[2], forma.elipse[3], -forma.elipse[4]] };
  const clave = forma.poligono ? "poligono" : "trazo";
  return { ...forma, [clave]: forma[clave].map(([x, y]) => [ancho - x, y]) };
});
// Todo, movido (para poner los fotogramas de los animados uno al lado del otro)
const mover = (formas, dx, dy = 0) => formas.map((forma) => {
  if (forma.elipse) return { ...forma, elipse: [forma.elipse[0] + dx, forma.elipse[1] + dy, ...forma.elipse.slice(2)] };
  const clave = forma.poligono ? "poligono" : "trazo";
  return { ...forma, [clave]: forma[clave].map(([x, y]) => [x + dx, y + dy]) };
});
// Unos puntos, girados alrededor de (0, 0)
const girar = (puntos, grados) => puntos.map(([x, y]) => {
  const g = (grados * Math.PI) / 180;
  return [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g)];
});
// Una línea quebrada, suavizada (cada vuelta corta las esquinas)
function alisar(puntos, vueltas = 3) {
  let linea = puntos;
  for (let v = 0; v < vueltas; v++) {
    const nueva = [linea[0]];
    for (let i = 0; i < linea.length - 1; i++) {
      const [[ax, ay], [bx, by]] = [linea[i], linea[i + 1]];
      nueva.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    nueva.push(linea[linea.length - 1]);
    linea = nueva;
  }
  return linea;
}
// Una curva de a a b que tira hacia el punto de control (sin incluir a)
const curva = ([ax, ay], [bx, by], [qx, qy], pasos = 6) => Array.from({ length: pasos }, (_, k) => {
  const t = (k + 1) / pasos;
  return [(1 - t) ** 2 * ax + 2 * (1 - t) * t * qx + t * t * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * qy + t * t * by];
});

// ---------- Celestial: dos alas, más altas que anchas ----------
//
// Cada ala: un abanico de plumas largas que nace a media altura, junto a la foto, y sube abriéndose
// hacia fuera (las de fuera, más cortas; las de dentro, por encima), cada una con su raquis; en la
// base, tres plumitas con el borde dorado.

function celestial() {
  const [ancho, alto, cx, cy] = [170, 120, 85, 66];
  const [rx0, ry0] = [130, 70]; // de donde nacen las plumas
  const pluma = (angulo, largo, ancho, relleno, borde) => {
    const g = (angulo * Math.PI) / 180;
    const [x, y] = [rx0 + Math.sin(g) * largo * 0.5, ry0 - Math.cos(g) * largo * 0.5];
    return [elipse(x, y, ancho, largo / 2, angulo, relleno, borde, 1.6),
      trazo([[rx0 + Math.sin(g) * largo * 0.2, ry0 - Math.cos(g) * largo * 0.2], [rx0 + Math.sin(g) * largo * 0.85, ry0 - Math.cos(g) * largo * 0.85]], "#d6e0f0", 1)];
  };
  const ala = [];
  for (const [angulo, largo] of [[64, 30], [46, 42], [29, 52], [13, 60], [-2, 66]]) ala.push(...pluma(angulo, largo, 6.5, "#ffffff", "#b8c6de"));
  for (const [angulo, largo] of [[68, 24], [44, 24], [20, 22]]) ala.push(pluma(angulo, largo, 6, "#fff8e6", "#e0c070")[0]);
  return { id: "celestial", ancho, alto, cx, cy, formas: [...ala, ...espejo(ala, ancho)] };
}

// ---------- Jungla: una corona de hojas arriba y lianas que cuelgan por los lados ----------

function jungla() {
  const [ancho, alto, cx, cy] = [150, 150, 75, 65];
  const formas = [];
  const enAro = (grados, r = 50) => [cx + Math.cos((grados * Math.PI) / 180) * r, cy + Math.sin((grados * Math.PI) / 180) * r];
  // Las lianas: de un punto del aro hacia abajo, ondulando y apartándose un poco
  const lianas = [[194, 132, -1], [210, 120, -1], [330, 124, 1], [346, 136, 1]];
  for (const [grados, hasta, lado] of lianas) {
    const [x0, y0] = enAro(grados, 50);
    const puntos = [];
    for (let y = y0; y <= hasta; y += 3) {
      const t = (y - y0) / (hasta - y0);
      puntos.push([x0 + lado * 8 * t + Math.sin(t * 7 + grados) * 2.5, y]);
    }
    formas.push(trazo(puntos, "#5e6e2a", 2.6));
    puntos.forEach(([x, y], i) => {
      if (i % 3 !== 1) return;
      const izquierda = (i / 3) % 2 < 1;
      formas.push(elipse(x + (izquierda ? -3 : 3), y, 2.6, 5.5, izquierda ? 40 : -40, "#4a9a40", "#24581f", 1));
    });
    const [xf, yf] = puntos[puntos.length - 1];
    formas.push(elipse(xf, yf + 2, 2.6, 5, 0, "#5fb04a", "#24581f", 1));
  }
  // La corona: hojas a lo largo de la mitad de arriba del aro, una más afuera y otra más adentro
  for (let grados = 186, i = 0; grados <= 354; grados += 11, i++) {
    const [x, y] = enAro(grados, i % 2 ? 51 : 55);
    formas.push(elipse(x, y, 5, 9.5, grados + (i % 2 ? 12 : -12), i % 2 ? "#3f8f3a" : "#5fb04a", "#24581f", 1.2));
  }
  // Unas flores
  for (const grados of [236, 304]) {
    const [x, y] = enAro(grados, 55);
    formas.push(elipse(x, y, 3.6, 3.6, 0, "#ff6a8a", "#b8304a", 1));
    formas.push(elipse(x, y, 1.4, 1.4, 0, "#ffe060", "#ffe060", 0.5));
  }
  return { id: "jungla", ancho, alto, cx, cy, formas };
}

// ---------- Llamarada: un anillo de fuego con lenguas grandes que bailan ----------
//
// Cuatro fotogramas, en una tira uno al lado del otro (el CSS los va pasando): lenguas alrededor de
// la foto, casi igual de largas por todo el aro (algo más arriba) y torcidas hacia arriba por los lados, en tres capas
// (rojo, naranja y amarillo) que crecen, menguan y se tuercen; y unas chispas que suben.

function llamarada() {
  const [ancho, alto, cx, cy] = [170, 170, 85, 88];
  const c = [cx, cy];
  const LENGUAS = 14;
  const lengua = (g, largo, abre, sesgo) => {
    const n = [Math.cos(rad(g)), Math.sin(rad(g))];
    const dir = [n[0], n[1] - 0.9 * (1 - Math.max(0, n[1]))];
    const [dx, dy] = dir.map((v) => v / Math.hypot(...dir));
    const base = polar(c, 49, g);
    const punta = [base[0] + dx * largo - dy * sesgo, base[1] + dy * largo + dx * sesgo];
    const [izquierda, derecha] = [polar(c, 49, g - abre), polar(c, 49, g + abre)];
    const tira = (p) => [p[0] + dx * largo * 0.6, p[1] + dy * largo * 0.6];
    return [izquierda, ...curva(izquierda, punta, tira(izquierda), 7), ...curva(punta, derecha, tira(derecha), 7)];
  };
  const fotogramas = [0, 1, 2, 3].map((f) => {
    const lenguas = Array.from({ length: LENGUAS }, (_, i) => {
      const g = 270 + (i * 360) / LENGUAS;
      const fase = i * 2.3 + (f * Math.PI) / 2;
      const largo = (22 + 5 * (1 - Math.sin(rad(g)))) * (i % 2 ? 0.75 : 1) * (1 + 0.16 * Math.sin(fase));
      return [g, largo, i % 2 ? 10 : 13, 5 * Math.cos(fase + i * 0.7)];
    });
    const capa = (escala, abre, relleno, borde, grueso) => lenguas.map(([g, largo, a, sesgo]) => poligono(lengua(g, largo * escala, a * abre, sesgo * escala), relleno, borde, grueso));
    const chispas = [210, 245, 280, 305, 330, 258].map((a, k) => {
      const paso = (f + k) % 4;
      const p = polar(c, 64 + (k % 2) * 6, a);
      return circulo([p[0] + Math.sin(paso + k) * 2, p[1] - paso * 5], 2.2 - paso * 0.3, "#ffe066", "#e8401c", 0.8);
    });
    return [
      arco(c, 53, 0, 360, "#7a1a08", 11.6),
      ...capa(1, 1, "#e8401c", "#7a1a08", 1.5),
      arco(c, 53, 0, 360, "#e8401c", 10),
      ...capa(0.66, 0.66, "#ff8c1a", "#ff8c1a", 0.4),
      arco(c, 51.5, 0, 360, "#ff8c1a", 5),
      ...capa(0.38, 0.42, "#ffd23a", "#ffd23a", 0.4),
      arco(c, 50.5, 0, 360, "#ffd23a", 2.6),
      ...chispas
    ];
  });
  return { id: "llamarada", ancho, alto, cx, cy, fotogramas };
}

// ---------- Escarcha: una corona de cristales de hielo, copos y nieve que cae ----------
//
// El dibujo (quieto): el aro helado, racimos de cristales alrededor (de tres en tres, de dos tonos,
// como tallados) y unos copos. Aparte, una tira de nieve (escarcha-nieve.svg, la mitad de alta) que el
// CSS repite hacia abajo y hace caer detrás de la foto; los copos que se salen por arriba o por abajo
// están también al otro lado, para que la tira empalme.

function escarcha() {
  const [ancho, alto, cx, cy] = [170, 170, 85, 85];
  const c = [cx, cy];
  const cristal = (g, inclina, largo, w) => {
    const pon = (puntos) => enAro(c, 53, g, girar(puntos, inclina));
    return [
      poligono(pon([[-w, 3], [-w, -largo * 0.72], [0, -largo], [0, 3]]), "#ffffff", "#ffffff", 0.3),
      poligono(pon([[0, 3], [0, -largo], [w, -largo * 0.72], [w, 3]]), "#9edcf6", "#9edcf6", 0.3),
      trazo(pon([[-w, 3], [-w, -largo * 0.72], [0, -largo], [w, -largo * 0.72], [w, 3]]), "#2e7aa8", 1.4)
    ];
  };
  const formas = [arco(c, 53, 0, 360, "#2e7aa8", 8.5), arco(c, 53, 0, 360, "#d8f6ff", 5.5), arco(c, 54.5, 200, 250, "#ffffff", 1.5)];
  for (let k = 0; k < 8; k++) {
    const g = 270 + k * 45;
    const [centro, lado] = k % 2 ? [16, 10] : [24, 15];
    formas.push(...cristal(g - 9, -24, lado, 2.8), ...cristal(g + 9, 24, lado, 2.8), ...cristal(g, 0, centro, 3.6));
  }
  for (const g of [292.5, 22.5, 112.5, 202.5]) {
    const p = polar(c, 74, g);
    const brazos = [0, 60, 120].map((a) => [polar(p, 4.5, a), polar(p, 4.5, a + 180)]);
    formas.push(...brazos.map((brazo) => trazo(brazo, "#2e7aa8", 3)), ...brazos.map((brazo) => trazo(brazo, "#ffffff", 1.5)));
  }
  const tira = alto / 2;
  const nieve = [];
  for (let k = 0; k < 16; k++) {
    const azar = (n) => ((Math.abs(Math.sin(k * 12.9898 + n * 78.233)) * 43758.5453) % 1);
    const [x, y, r] = [10 + azar(1) * (ancho - 20), azar(2) * tira, 1.2 + azar(3) * 1.3];
    for (const dy of [0, tira, -tira]) {
      if (dy === 0 || (dy > 0 ? y < r + 1 : y > tira - r - 1)) nieve.push(circulo([x, y + dy], r, "#ffffff", "#6ab4e0", 0.8));
    }
  }
  return { id: "escarcha", ancho, alto, cx, cy, formas, nieve: { ancho, alto: tira, formas: nieve } };
}


// ---------- Los de tipo ----------
//
// Uno por tipo, sin movimiento: el aro del color del tipo y, alrededor, algo suyo (burbujas,
// llamas, una telaraña, alas de mariposa...). Los de un solo color (sin dibujo) son otros: los dan
// los logros de tipo (css/juegos.css, .marco-de-tipo). Ángulos: 0 a la derecha, 90 abajo, 270 arriba.

const rad = (g) => (g * Math.PI) / 180;
const polar = ([cx, cy], r, g) => [cx + Math.cos(rad(g)) * r, cy + Math.sin(rad(g)) * r];
const arco = (centro, r, desde, hasta, color, grueso) => {
  const puntos = [];
  for (let g = desde; g <= hasta + 0.01; g += 4) puntos.push(polar(centro, r, g));
  return trazo(puntos, color, grueso);
};
const poligono = (puntos, relleno, borde, grueso = 1.2) => ({ poligono: puntos, relleno, borde, grueso });
// Lo que va por DELANTE de la foto (la cinta de Lucha, las nubes de Volador...): va en otro SVG, en un
// ::before encima de la imagen
const alante = (formas) => formas.map((forma) => ({ ...forma, delante: true }));
const circulo = ([x, y], r, relleno, borde, grueso = 1) => elipse(x, y, r, r, 0, relleno, borde, grueso);
// Una forma dibujada «hacia arriba» (y negativa = hacia fuera del aro) y puesta en el aro, en el ángulo g
const enAro = (centro, r, g, puntos) => puntos.map(([x, y]) => {
  const a = rad(g + 90);
  const [px, py] = [x, y - r];
  return [centro[0] + px * Math.cos(a) - py * Math.sin(a), centro[1] + px * Math.sin(a) + py * Math.cos(a)];
});
// El aro: el color del tipo sobre un borde más oscuro
const banda = (centro, color, oscuro) => [arco(centro, 53, 0, 360, oscuro, 7), arco(centro, 53, 0, 360, color, 4.5)];
const estrella4 = (y, grande, chica) => Array.from({ length: 8 }, (_, k) => {
  const r = k % 2 ? chica : grande;
  return [Math.cos(rad(k * 45 - 90)) * r, y + Math.sin(rad(k * 45 - 90)) * r];
});

// Un color entre dos (t = 0, el primero; 1, el segundo)
const mezcla = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
// Un cilindro con las puntas redondas, de un punto a otro (los brazos de la sábana)
function capsula([x1, y1], [x2, y2], r, relleno, borde, grueso) {
  const g = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const puntos = [];
  for (let a = g + 90; a <= g + 270; a += 15) puntos.push(polar([x1, y1], r, a));
  for (let a = g - 90; a <= g + 90; a += 15) puntos.push(polar([x2, y2], r, a));
  return poligono(puntos, relleno, borde, grueso);
}

// Una roca: un contorno irregular (más largo que ancho, girado) de un color, con su borde y un brillo
// arriba a la izquierda; sin más detalle (como las alas de mariposa). Siempre la misma para la misma
// semilla.
function roca([x, y], largo, ancho, giro, semilla, tono) {
  const azar = (k) => ((Math.abs(Math.sin(semilla * 12.9898 + k * 78.233)) * 43758.5453) % 1);
  const LADOS = 8;
  const contorno = Array.from({ length: LADOS }, (_, k) => {
    const a = (k + (azar(k) - 0.5) * 0.6) * ((2 * Math.PI) / LADOS);
    const f = 0.82 + 0.18 * azar(k + 20);
    const [lx, ly] = [Math.cos(a) * largo * f, Math.sin(a) * ancho * f];
    return [x + lx * Math.cos(rad(giro)) - ly * Math.sin(rad(giro)), y + lx * Math.sin(rad(giro)) + ly * Math.cos(rad(giro))];
  });
  const [bx, by] = [x - ancho * 0.3, y - ancho * 0.34];
  const brillo = contorno.map(([px, py]) => [bx + (px - x) * 0.3, by + (py - y) * 0.3]);
  const claro = mezcla(tono, "#ffffff", 0.38);
  return [poligono(contorno, tono, mezcla(tono, "#000000", 0.62), 1.6), poligono(brillo, claro, claro, 0.4)];
}

// Una flor: de cinco pétalos redondos (con el centro de dos tonos) o una margarita
function flor([x, y], R, giro, [petalo, borde, forma]) {
  const formas = [];
  if (forma === "margarita") {
    for (let k = 0; k < 11; k++) {
      const g = giro + (k * 360) / 11;
      const p = polar([x, y], R * 0.56, g);
      formas.push(elipse(p[0], p[1], R * 0.21, R * 0.46, g - 90, petalo, borde, 1.1));
    }
  } else {
    for (let k = 0; k < 5; k++) formas.push(circulo(polar([x, y], R * 0.5, giro + k * 72), R * 0.5, petalo, borde, 1.3));
    const ojo = mezcla(petalo, borde, 0.3);
    formas.push(circulo([x, y], R * 0.44, ojo, ojo, 0.3));
  }
  const centro = petalo === "#ffd84a" ? "#f08a30" : "#ffd040";
  formas.push(circulo([x, y], R * 0.27, centro, mezcla(centro, "#000000", 0.38), 1));
  formas.push(circulo([x - R * 0.08, y - R * 0.08], R * 0.09, "#fff8d0", "#fff8d0", 0.2));
  return formas;
}

// Una luna creciente: el círculo grande menos otro desplazado
function creciente(centro, r, [dx, dy], rCorte, relleno, borde) {
  const corte = [centro[0] + dx, centro[1] + dy];
  const fuera = [];
  const dentro = [];
  for (let g = 0; g < 360; g += 6) {
    const p = polar(centro, r, g);
    if (Math.hypot(p[0] - corte[0], p[1] - corte[1]) > rCorte) fuera.push([g, p]);
    const q = polar(corte, rCorte, g);
    if (Math.hypot(q[0] - centro[0], q[1] - centro[1]) < r) dentro.push([g, q]);
  }
  // Cada arco seguido, empezando después de su hueco
  const seguido = (lista) => {
    const i = lista.findIndex(([g], k) => k > 0 && g - lista[k - 1][0] > 6);
    return (i > 0 ? [...lista.slice(i), ...lista.slice(0, i)] : lista).map(([, p]) => p);
  };
  return poligono([...seguido(fuera), ...seguido(dentro).reverse()], relleno, borde, 1.2);
}

const TIPOS = {
  normal: { color: "#a8a77a", oscuro: "#5e5d40", dibujo(c) {
    return [...banda(c, "#c8c6a0", "#5e5d40"), ...[0, 45, 90, 135, 180, 225, 270, 315].map((g, i) => poligono(enAro(c, 55, g, estrella4(-5, i % 2 ? 5 : 8, i % 2 ? 1.8 : 2.6)), "#fff8d8", "#7a7850", 1.2))];
  } },
  fire: { color: "#ee8130", oscuro: "#8a3410", dibujo(c) {
    const llama = (alto, ancho) => [[-ancho, 2], [-ancho * 0.9, -alto * 0.45], [-ancho * 0.3, -alto * 0.75], [0, -alto], [ancho * 0.35, -alto * 0.7], [ancho * 0.9, -alto * 0.4], [ancho, 2]];
    const formas = [];
    Array.from({ length: 15 }, (_, i) => i * 24 + 6).forEach((g, i) => {
      const alto = i % 2 ? 11 : 17;
      formas.push(poligono(enAro(c, 54, g, llama(alto, 6)), "#f08030", "#a83010", 1.2));
      formas.push(poligono(enAro(c, 54, g, llama(alto * 0.6, 3.2)), "#ffd040", "#ffd040", 0.5));
    });
    return [...formas, ...banda(c, "#ee8130", "#8a3410")];
  } },
  water: { color: "#6390f0", oscuro: "#2a50a8", dibujo(c) {
    const burbujas = [[66, 208, 8], [76, 234, 5], [68, 300, 6.5], [63, 332, 4.5], [72, 18, 6], [67, 150, 7.5], [75, 118, 4.5], [63, 64, 5], [78, 272, 3.5]];
    return [
      arco(c, 53, 0, 360, "#2a70c0", 9), arco(c, 53, 0, 360, "#9ad8f8", 6),
      arco(c, 55, 200, 250, "#ffffff", 2), arco(c, 51, 20, 50, "#e8f8ff", 1.5),
      ...burbujas.flatMap(([r, g, tam]) => {
        const p = polar(c, r, g);
        return [circulo(p, tam, "#d8f0ff", "#4a90d0", 1.2), circulo([p[0] - tam * 0.35, p[1] - tam * 0.35], tam * 0.3, "#ffffff", "#ffffff", 0.3)];
      })
    ];
  } },
  // Diez relámpagos alrededor, con su zigzag de siempre (ancho junto al aro y en punta hacia fuera),
  // grandes y pequeños alternados y un poco torcidos, cada uno con un brillo
  electric: { color: "#f7d02c", oscuro: "#8a6a00", dibujo(c) {
    const RAYO = [[-2, 2], [8, 2], [2, -12], [8, -12], [-6, -32], [-2, -16], [-8, -16]];
    const BRILLO = [[0, 0], [4, 0], [-1, -12], [4, -12], [-3, -24], [-1, -15], [-4, -15]];
    const rayos = Array.from({ length: 10 }, (_, i) => {
      const [escala, inclina] = [i % 2 ? 0.8 : 1.1, i % 2 ? -10 : 10];
      const pon = (puntos) => enAro(c, 52, 270 + i * 36, girar(puntos.map(([x, y]) => [x * escala, y * escala]), inclina));
      return [poligono(pon(RAYO), "#fff060", "#6a5000", 1.6), poligono(pon(BRILLO), "#fffbd0", "#fffbd0", 0.3)];
    });
    return [...rayos.flat(), ...banda(c, "#f7d02c", "#8a6a00")];
  } },
  // Todo el aro, de flores grandes (delante, pisando el borde de la foto) y, detrás, otras pequeñas
  // en los huecos; sin hojas (el aro del CSS, rosa, solo asoma entre ellas)
  grass: { color: "#f383b0", oscuro: "#a8406e", dibujo(c) {
    const ROSA = ["#ff8fbf", "#b8406e"];
    const BLANCA = ["#ffffff", "#9a8aa8"];
    const AMARILLA = ["#ffd84a", "#b07a10"];
    const LILA = ["#c9a2f2", "#6a48a8"];
    const CORAL = ["#ff7a6a", "#a8342a"];
    const CELESTE = ["#8ccaff", "#3a6ab0"];
    const grandes = [ROSA, [...BLANCA, "margarita"], AMARILLA, LILA, CORAL, [...BLANCA, "margarita"], CELESTE, ROSA, [...BLANCA, "margarita"], AMARILLA, LILA, CORAL];
    const chicas = [BLANCA, ROSA, AMARILLA, LILA];
    return [
      ...Array.from({ length: 12 }, (_, i) => flor(polar(c, 63, i * 30 + 15), 7, i * 23, chicas[i % 4])).flat(),
      ...alante(grandes.flatMap((colores, i) => flor(polar(c, 57, i * 30), 13.5, i * 41, colores)))
    ];
  } },
  ice: { color: "#96d9d6", oscuro: "#3a8a90", dibujo(c) {
    const pincho = (largo) => [[-3, 1], [0, -largo], [3, 1], [0, 3]];
    const formas = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((g, i) => poligono(enAro(c, 53, g, pincho(i % 2 ? 9 : 15)), "#e8fbff", "#4ab0c8", 1.1));
    const copo = polar(c, 66, 40);
    for (const g of [0, 60, 120]) formas.push(trazo([polar(copo, 5, g), polar(copo, 5, g + 180)], "#ffffff", 1.4));
    return [...formas, ...banda(c, "#96d9d6", "#3a8a90")];
  } },
  fighting: { color: "#c22e28", oscuro: "#6a1410", dibujo(c) {
    // Los bordes de la cinta se curvan hacia abajo por los lados, como si rodeara la cabeza
    const borde = (y0) => {
      const puntos = [];
      for (let x = -56; x <= 56; x += 4) {
        const y = y0 + 0.006 * x * x;
        if (Math.hypot(x, y - c[1]) <= 55) puntos.push([c[0] + x, y]);
      }
      return puntos;
    };
    const arriba = borde(c[1] - 40);
    const abajo = borde(c[1] - 28);
    const nudo = [arriba[arriba.length - 1][0] - 1, (arriba[arriba.length - 1][1] + abajo[abajo.length - 1][1]) / 2];
    const mas = ([x, y]) => [nudo[0] + x, nudo[1] + y];
    return [
      ...banda(c, "#c22e28", "#6a1410"),
      ...alante([
        poligono([...arriba, ...abajo.reverse()], "#e2382f", "#6a1410", 1.4),
        trazo(borde(c[1] - 36), "#ff7a6a", 1.2),
        poligono([mas([1, -4]), mas([14, -3]), mas([26, 2]), mas([25, 9]), mas([13, 5]), mas([0, 4])], "#e83a32", "#6a1410", 1.3),
        poligono([mas([-1, 2]), mas([8, 12]), mas([17, 22]), mas([11, 26]), mas([3, 15]), mas([-4, 5])], "#d83028", "#6a1410", 1.3),
        circulo(nudo, 5.5, "#c22e28", "#6a1410", 1.3)
      ])
    ];
  } },
  poison: { color: "#a33ea1", oscuro: "#5a1a58", dibujo(c) {
    const formas = [];
    for (const [g, largo] of [[60, 9], [80, 15], [99, 7], [117, 12]]) {
      formas.push(poligono([polar(c, 52, g - 4), polar(c, 52 + largo, g - 1.8), polar(c, 52 + largo, g + 1.8), polar(c, 52, g + 4)], "#c870c8", "#5a1a58", 1.1));
      formas.push(circulo(polar(c, 56 + largo, g), 4.6, "#c870c8", "#5a1a58", 1.2));
      formas.push(circulo(polar(c, 55 + largo, g - 2), 1.3, "#f0c8f0", "#f0c8f0", 0.3));
    }
    for (const [r, g, tam] of [[62, 220, 3.5], [67, 250, 2.2], [61, 300, 2.8], [68, 320, 2]]) formas.push(circulo(polar(c, r, g), tam, "#d898d8", "#5a1a58", 1));
    return [...formas, ...banda(c, "#a33ea1", "#5a1a58")];
  } },
  // El marco ES una herradura, abierta por abajo, delante de la foto (pisa un poco su borde): más
  // ancha arriba, con la ranura y sus clavos a los lados (en la punta, no) y los talones más
  // oscuros. Entre los talones queda el borde de la foto, fino y marrón (sin aro).
  ground: { color: "#5a3a12", oscuro: null, dibujo(c) {
    const [desde, hasta] = [132, 408]; // de la punta izquierda de abajo, por arriba, a la derecha (48 + 360)
    const exterior = (g) => 62 + 3.5 * Math.max(0, Math.cos(rad(g - 270)));
    const herradura = (de, a, dentro, fuera) => {
      const puntos = [];
      for (let g = de; g <= a + 0.01; g += 3) puntos.push(polar(c, fuera(g), g));
      for (let g = a; g >= de - 0.01; g -= 3) puntos.push(polar(c, dentro, g));
      return puntos;
    };
    // Los clavos: la cabeza redonda, de metal, con su brillo
    const clavo = (g) => {
      const p = polar(c, 57, g);
      return [circulo(p, 3, "#dfe2ea", "#3a3a46", 1.2), circulo([p[0] - 0.9, p[1] - 0.9], 0.9, "#ffffff", "#ffffff", 0.2)];
    };
    return alante([
      poligono(herradura(desde, hasta, 46, exterior), "#d9b25a", "#5a3a12", 1.6),
      poligono(herradura(desde, desde + 9, 46.8, (g) => exterior(g) - 0.8), "#b08a3c", "#b08a3c", 0.3),
      poligono(herradura(hasta - 9, hasta, 46.8, (g) => exterior(g) - 0.8), "#b08a3c", "#b08a3c", 0.3),
      arco(c, 57, desde + 14, hasta - 14, "#a37b30", 3),
      arco(c, 61.5, 196, 268, "#f6dc94", 1.8),
      ...[152, 174, 196, 218, 322, 344, 366, 388].flatMap(clavo)
    ]);
  } },
  // Una fila de nubes apretadas, unas encima de otras, de media altura hasta abajo (la de abajo del
  // centro, delante de la foto), cada una de su forma y su tamaño, y dos remolinos arriba. Cada nube, de bolas con un solo
  // contorno y la parte de abajo un poco sombreada; las de más abajo, por delante de las de arriba.
  flying: { color: "#7ec8f0", oscuro: "#2a78b8", dibujo(c) {
    const FORMAS = {
      ancha: [[-13, 2, 5], [-7, -2, 6.5], [0, -4, 7.5], [7, -2, 6.5], [13, 2, 5], [-5, 3, 5.5], [5, 3, 5.5]],
      alta: [[-7, 2, 6], [0, -5, 8.5], [7, 1, 6.5], [0, 3, 6.5], [-3, -1, 6]],
      chica: [[-6, 1, 4.5], [0, -2, 6], [6, 1, 4.5], [0, 2, 4.5]],
      larga: [[-15, 2, 4.5], [-9, -1, 6], [-2, -4, 7], [5, -2, 6.5], [11, 0, 5.5], [16, 2, 4], [-6, 3, 5], [6, 3, 5]]
    };
    const nube = ([g, r, forma, s, girada]) => {
      const p = polar(c, r, g);
      const bolas = FORMAS[forma].map(([dx, dy, radio]) => [p[0] + (girada ? -dx : dx) * s, p[1] + dy * s, radio * s]);
      return [
        ...bolas.map(([x, y, radio]) => circulo([x, y], radio + 1.3, "#7aa6d4", "#7aa6d4", 0.1)),
        ...bolas.map(([x, y, radio]) => circulo([x, y], radio, "#d6e8f8", "#d6e8f8", 0.1)),
        ...bolas.map(([x, y, radio]) => circulo([x, y - 1], radio - 1.2, "#ffffff", "#ffffff", 0.1))
      ];
    };
    const remolino = (p) => Array.from({ length: 14 }, (_, k) => polar(p, 2 + k * 0.5, k * 40));
    return [
      ...banda(c, "#7ec8f0", "#2a78b8"),
      ...[230, 310].flatMap((g) => [trazo(remolino(polar(c, 65, g)), "#2a78b8", 3.4), trazo(remolino(polar(c, 65, g)), "#ffffff", 1.7)]),
      ...[
        [-8, 62, "chica", 1.2], [188, 62, "chica", 1.1, true], [14, 63, "alta", 1.1], [166, 63, "alta", 1.05, true],
        [36, 63, "ancha", 1], [144, 63, "larga", 0.9, true], [60, 61, "alta", 1, true], [120, 61, "ancha", 1.05]
      ].flatMap(nube),
      ...alante(nube([90, 55, "larga", 1.05]))
    ];
  } },
  // La gema arriba, medio metida en la foto, y ondas gruesas a los cuatro lados, separadas del aro
  psychic: { color: "#f95587", oscuro: "#8a1a40", dibujo(c) {
    const gema = [[c[0], c[1] - 60], [c[0] + 9, c[1] - 47], [c[0], c[1] - 33], [c[0] - 9, c[1] - 47]];
    const ondas = [270, 0, 90, 180].flatMap((g) => [[70, g - 26, g + 26, 7.2, 4.6, "#ff7aa8"], [82, g - 18, g + 18, 6.2, 3.8, "#ffb4cf"]]);
    return [
      ...ondas.map(([r, de, a, grueso]) => arco(c, r, de, a, "#8a1a40", grueso)),
      ...ondas.map(([r, de, a, , grueso, color]) => arco(c, r, de, a, color, grueso)),
      ...banda(c, "#f95587", "#8a1a40"),
      ...alante([
        poligono(gema, "#ff5c7a", "#8a1a40", 1.5),
        poligono([[c[0] - 1, c[1] - 55], [c[0] + 4, c[1] - 48], [c[0] - 1, c[1] - 41], [c[0] - 5, c[1] - 48]], "#ffc0d0", "#ffc0d0", 0.3)
      ])
    ];
  } },
  // Una telaraña: pocos hilos (ocho radios y dos vueltas que se comban hacia dentro), gruesos y con
  // borde, del verde del tipo
  bug: { color: "#a6b91a", oscuro: "#5a6a10", dibujo(c) {
    const radios = [12, 57, 102, 147, 192, 237, 282, 327];
    const hilos = radios.map((g) => [polar(c, 54, g), polar(c, 81, g)]);
    for (const [r, cae] of [[66, 4.5], [77, 6]]) {
      radios.forEach((a, i) => {
        const b = i === radios.length - 1 ? radios[0] + 360 : radios[i + 1];
        hilos.push(Array.from({ length: 9 }, (_, k) => polar(c, r - cae * Math.sin((Math.PI * k) / 8), a + ((b - a) * k) / 8)));
      });
    }
    return [...hilos.map((puntos) => trazo(puntos, "#4a5a0a", 4.6)), ...hilos.map((puntos) => trazo(puntos, "#c4d640", 2.6)), ...banda(c, "#a6b91a", "#5a6a10")];
  } },
  // Todo el aro, de rocas de distintos tamaños: unas grandes delante (pisando el borde de la
  // foto) y otras más pequeñas detrás, en los huecos. Sin aro: el del CSS, oscuro, solo asoma entre
  // ellas, como una grieta.
  rock: { color: "#4a3e2c", oscuro: "#2e261a", dibujo(c) {
    const TONOS = ["#a8987a", "#968a72", "#b2a486", "#8c8478", "#a09070"];
    const detras = Array.from({ length: 16 }, (_, i) => {
      const g = i * 22.5 + 11 + ((i * 7) % 5) - 2;
      return roca(polar(c, 58.5, g), 11 + (i % 3), 9.5, g + 90 + ((i * 13) % 20) - 10, i + 31, TONOS[(i + 2) % 5]);
    }).flat();
    const delante = Array.from({ length: 11 }, (_, i) => {
      const g = i * (360 / 11) + ((i * 11) % 7) - 3;
      return roca(polar(c, 56, g), [17, 14, 16, 13.5][i % 4], [12, 10.5, 11.5, 10][i % 4], g + 90 + ((i * 17) % 24) - 12, i + 1, TONOS[i % 5]);
    }).flat();
    return [...detras, ...alante(delante)];
  } },
  // Una sábana de fantasma (la foto, su cara) con los bajos en ondas y dos brazos sencillos (dos
  // cilindros) levantados, como dando un susto
  ghost: { color: "#735797", oscuro: "#3e2a58", dibujo(c) {
    const puntos = [];
    for (let g = 180; g <= 360; g += 8) puntos.push(polar(c, 60, g));
    const [derecha, izquierda, abajo] = [c[0] + 60, c[0] - 60, c[1] + 60];
    puntos.push([derecha, abajo]);
    for (let x = derecha; x >= izquierda; x -= 2) puntos.push([x, abajo + 9 * Math.abs(Math.sin((Math.PI * (derecha - x)) / 30))]);
    puntos.push([izquierda, abajo]);
    const brazo = (lado) => [
      capsula([c[0] + lado * 50, c[1] + 16], [c[0] + lado * 72, c[1] - 13], 8, "#8a6aae", "#3e2a58", 1.8),
      trazo([[c[0] + lado * 64, c[1] - 8], [c[0] + lado * 70, c[1] - 17]], "#b89ade", 2.2)
    ];
    return [
      ...brazo(-1), ...brazo(1),
      poligono(puntos, "#8a6aae", "#3e2a58", 1.8),
      arco(c, 58, 192, 252, "#b89ade", 2.4),
      trazo([[izquierda + 4, c[1] + 4], [izquierda + 4, abajo - 4]], "#a688c8", 2),
      arco(c, 53, 0, 360, "#735797", 4.5)
    ];
  } },
  // Dos cuernos gordos que suben, se enroscan hacia fuera y abajo y vuelven con la punta metida en la
  // foto (ese trozo, delante), con unos anillos; y dos alas a los lados: el brazo hasta la muñeca
  // (con su garra), tres dedos que se abren y, entre ellos, la membrana en tres tonos con el borde en
  // ondas
  dragon: { color: "#6f35fc", oscuro: "#3a1a8a", dibujo(c) {
    const P = ([x, y]) => [c[0] + x, c[1] + y];
    const [HUESO, BORDE] = ["#f2e6c8", "#6a5a3a"];
    const linea = alisar([[-18, -38], [-26, -60], [-40, -76], [-58, -77], [-71, -64], [-70, -46], [-58, -34], [-46, -27], [-34, -21]].map(P));
    const lados = linea.map((p, i) => {
      const [a, b] = [linea[Math.max(0, i - 1)], linea[Math.min(linea.length - 1, i + 1)]];
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const w = 9.5 * Math.pow(1 - i / (linea.length - 1), 0.6);
      return [[p[0] - ((b[1] - a[1]) / largo) * w, p[1] + ((b[0] - a[0]) / largo) * w], [p[0] + ((b[1] - a[1]) / largo) * w, p[1] - ((b[0] - a[0]) / largo) * w]];
    });
    const contorno = (tramo) => [...tramo.map(([a]) => a), ...tramo.map(([, b]) => b).reverse()];
    // Desde donde la punta entra en la foto, delante (sin raya de corte: el borde, solo por los lados)
    let j = linea.length - 1;
    while (j > 0 && Math.hypot(linea[j][0] - c[0], linea[j][1] - c[1]) < 50) j--;
    const punta = lados.slice(j);
    const anillos = [0.2, 0.32, 0.44].map((t) => {
      const [[ax, ay], [bx, by]] = lados[Math.round(t * (lados.length - 1))];
      return trazo([[ax * 0.88 + bx * 0.12, ay * 0.88 + by * 0.12], [ax * 0.12 + bx * 0.88, ay * 0.12 + by * 0.88]], "#c8b48a", 1.3);
    });
    const cuerno = [poligono(contorno(lados), HUESO, BORDE, 1.6), ...anillos];
    const cuernoDelante = alante([poligono(contorno(punta), HUESO, HUESO, 0.3), trazo(contorno(punta), BORDE, 1.6)]);
    const [S, W, F1, F2, F3, B] = [[-44, 0], [-74, -20], [-88, -4], [-84, 16], [-68, 28], [-44, 22]].map(P);
    const hacia = (a, b) => {
      const medio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return curva(a, b, [medio[0] + (W[0] - medio[0]) * 0.25, medio[1] + (W[1] - medio[1]) * 0.25]);
    };
    const dedo1 = curva(W, F1, P([-83, -16]));
    const MEMBRANA = "#2e1470";
    const ala = [
      poligono([W, ...dedo1, ...hacia(F1, F2)], "#9a6aff", MEMBRANA, 1.5),
      poligono([W, F2, ...hacia(F2, F3)], "#8558ec", MEMBRANA, 1.5),
      poligono([W, F3, ...hacia(F3, B), S], "#7448d8", MEMBRANA, 1.5),
      trazo([S, W], MEMBRANA, 4.4), trazo([S, W], "#a888ff", 1.8),
      trazo([W, ...dedo1], MEMBRANA, 2.4), trazo([W, F2], MEMBRANA, 2.4), trazo([W, F3], MEMBRANA, 2.4),
      poligono([[W[0] - 3, W[1] + 1], [W[0] + 1, W[1] - 7], [W[0] + 3, W[1] + 2]], HUESO, BORDE, 1.2)
    ];
    return [
      ...ala, ...espejo(ala, 2 * c[0]),
      ...banda(c, "#6f35fc", "#3a1a8a"),
      ...cuerno, ...espejo(cuerno, 2 * c[0]),
      ...cuernoDelante, ...espejo(cuernoDelante, 2 * c[0])
    ];
  } },
  // Una luna: un aro fino alrededor de la foto que, abajo a la izquierda, se ensancha en una luna
  // creciente grande (la foto, en su hueco), con sus cráteres; y tres estrellas arriba a la derecha.
  // El aro del CSS es del color de la luna y queda debajo.
  dark: { color: "#ddd6f0", oscuro: null, dibujo(c) {
    const [d, R] = [[-7, 6], 62];
    const exterior = (g) => {
      const u = [Math.cos(rad(g)), Math.sin(rad(g))];
      const ud = u[0] * d[0] + u[1] * d[1];
      return Math.max(56.5, ud + Math.sqrt(ud * ud - (d[0] ** 2 + d[1] ** 2) + R * R));
    };
    const fuera = Array.from({ length: 120 }, (_, k) => polar(c, exterior(k * 3), k * 3));
    const dentro = Array.from({ length: 120 }, (_, k) => polar(c, 48, 357 - k * 3));
    return [
      poligono([...fuera, fuera[0], ...dentro, dentro[0]], "#ddd6f0", "#ddd6f0", 0.3),
      trazo([...fuera, fuera[0]], "#4a3a6a", 1.6),
      ...[[63, 132, 4.4], [61, 158, 3], [62, 106, 3.2], [66.5, 119, 1.8], [59, 182, 2.2]].map(([r, g, tam]) => circulo(polar(c, r, g), tam, "#aea2d2", "#7e70aa", 1)),
      ...[[68, 316, 9.5], [80, 296, 5.5], [77, 338, 5]].map(([r, g, tam]) => {
        const p = polar(c, r, g);
        return poligono(estrella4(0, tam, tam * 0.4).map(([x, y]) => [p[0] + x, p[1] + y]), "#fff0b0", "#8a7a40", 1.2);
      })
    ];
  } },
  steel: { color: "#b7b7ce", oscuro: "#5a5a70", dibujo(c) {
    const dientes = [];
    for (let k = 0; k < 16; k++) {
      const g = k * 22.5;
      dientes.push(polar(c, 53, g - 8), polar(c, 61, g - 5), polar(c, 61, g + 5), polar(c, 53, g + 8));
    }
    return [poligono(dientes, "#c8c8dc", "#5a5a70", 1.4), arco(c, 52, 0, 360, "#8a8aa0", 4), ...[45, 135, 225, 315].map((g) => circulo(polar(c, 56.5, g), 1.8, "#eeeef8", "#5a5a70", 0.8))];
  } },
  fairy: { color: "#d685ad", oscuro: "#8a3a6a", dibujo(c) {
    const ala = [
      elipse(c[0] + 58, c[1] - 20, 13, 20, 35, "#ffb8d8", "#c8508a", 1.6),
      elipse(c[0] + 55, c[1] + 18, 9, 13, -30, "#ffd0e4", "#c8508a", 1.6),
      circulo([c[0] + 60, c[1] - 24], 3, "#ffffff", "#ffffff", 0.3),
      circulo([c[0] + 56, c[1] + 19], 2, "#ffffff", "#ffffff", 0.3)
    ];
    return [...ala, ...espejo(ala, 2 * c[0]), ...banda(c, "#d685ad", "#8a3a6a")];
  } }
};

// El lienzo de cada uno (ancho, alto y el centro de la foto): lo justo para que quepa su dibujo
const LIENZO_TIPO = {
  fire: [144, 144, 72, 72], electric: [184, 184, 92, 92], fighting: [148, 140, 70, 70], poison: [140, 150, 70, 70],
  ghost: [176, 160, 88, 70], water: [170, 170, 85, 85], dragon: [180, 146, 90, 86], fairy: [170, 140, 85, 70], bug: [170, 170, 85, 85],
  dark: [162, 162, 82, 86], psychic: [176, 176, 88, 88], flying: [170, 170, 85, 85], rock: [150, 150, 75, 75], grass: [150, 150, 75, 75]
};
const MARCOS_TIPO = Object.entries(TIPOS).map(([tipo, datos]) => {
  const [ancho, alto, cx, cy] = LIENZO_TIPO[tipo] || [140, 140, 70, 70];
  return { id: `tipo-${tipo}`, tipo, color: datos.color, oscuro: datos.oscuro, ancho, alto, cx, cy, formas: datos.dibujo([cx, cy]) };
});

const MARCOS = [jungla(), celestial(), ...MARCOS_TIPO];
const LLAMARADA = llamarada();
const ESCARCHA = escarcha();

// Lo que se sale del lienzo se cortaría: aviso
function limites(formas) {
  const caja = [Infinity, Infinity, -Infinity, -Infinity];
  const meter = (x, y, m) => {
    [caja[0], caja[1], caja[2], caja[3]] = [Math.min(caja[0], x - m), Math.min(caja[1], y - m), Math.max(caja[2], x + m), Math.max(caja[3], y + m)];
  };
  for (const forma of formas) {
    if (forma.elipse) meter(forma.elipse[0], forma.elipse[1], Math.max(forma.elipse[2], forma.elipse[3]) + forma.grueso / 2);
    else for (const [x, y] of forma.poligono || forma.trazo) meter(x, y, forma.grueso / 2);
  }
  return caja;
}
const conFotogramas = (marco, fotogramas) => fotogramas.map((formas) => ({ ...marco, formas }));
for (const marco of [...MARCOS, ...conFotogramas(LLAMARADA, LLAMARADA.fotogramas), ESCARCHA]) {
  const [x0, y0, x1, y1] = limites(marco.formas);
  if (x0 < 0 || y0 < 0 || x1 > marco.ancho || y1 > marco.alto) console.warn(`¡${marco.id} se sale del lienzo! ${[x0, y0, x1, y1].map((v) => Math.round(v)).join(", ")} (lienzo ${marco.ancho}×${marco.alto})`);
}

// ---------- SVG ----------

const n = (v) => Math.round(v * 10) / 10;

function svg(marco, delante = false) {
  const partes = marco.formas.filter((forma) => Boolean(forma.delante) === delante).map((forma) => {
    if (forma.elipse) {
      const [cx, cy, rx, ry, giro] = forma.elipse.map(n);
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${giro} ${cx} ${cy})" fill="${forma.relleno}" stroke="${forma.borde}" stroke-width="${forma.grueso}"/>`;
    }
    if (forma.poligono) {
      return `<polygon points="${forma.poligono.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="${forma.relleno}" stroke="${forma.borde}" stroke-width="${forma.grueso}" stroke-linejoin="round"/>`;
    }
    return `<polyline points="${forma.trazo.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="none" stroke="${forma.color}" stroke-width="${forma.grueso}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${marco.ancho} ${marco.alto}">${partes.join("")}</svg>\n`;
}

const pct = (v) => `${n(v)}%`;
mkdirSync(CARPETA, { recursive: true });
const tieneDelante = (marco) => marco.formas.some((forma) => forma.delante);
for (const marco of MARCOS) {
  writeFileSync(join(CARPETA, `${marco.id}.svg`), svg(marco));
  if (tieneDelante(marco)) writeFileSync(join(CARPETA, `${marco.id}-delante.svg`), svg(marco, true));
}
// Llamarada: los fotogramas en una tira; Escarcha: el dibujo y la tira de nieve
writeFileSync(join(CARPETA, "llamarada.svg"), svg({ ancho: LLAMARADA.ancho * LLAMARADA.fotogramas.length, alto: LLAMARADA.alto, formas: LLAMARADA.fotogramas.flatMap((formas, k) => mover(formas, k * LLAMARADA.ancho)) }));
writeFileSync(join(CARPETA, "escarcha.svg"), svg(ESCARCHA));
writeFileSync(join(CARPETA, "escarcha-nieve.svg"), svg(ESCARCHA.nieve));
for (const marco of [jungla(), celestial(), LLAMARADA, ESCARCHA]) {
  console.log(`marco-${marco.id}: width ${pct(marco.ancho)}; height ${pct(marco.alto)}; left ${pct(-(marco.cx - 50))}; top ${pct(-(marco.cy - 50))}`);
}

// El CSS de los de tipo (los de Jungla y Celestial, que se mueven, están a mano en css/juegos.css)
const css = [`/* Los marcos de tipo con dibujo (los de la Tienda; js/comun/fichas.js, MARCOS).
   GENERADO por herramientas/generar-marcos.mjs: no se toca a mano, se cambia allí y se vuelve a
   ejecutar. El dibujo (img/marcos/tipo-*.svg) va en un ::after DETRÁS de la foto, como en Jungla y
   Celestial; la foto deja de recortar y se redondea la imagen. En las fotos que son un <img> suelto
   (chat, barra lateral) no hay ::after: ahí queda el aro del color del tipo. */

.con-marco.marco-dibujo {
  position: relative;
  overflow: visible !important;
  isolation: isolate;
}

.con-marco.marco-dibujo > * {
  border-radius: 50%;
}

.con-marco.marco-dibujo::after {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
  background: center / 100% 100% no-repeat;
}
`];
for (const marco of MARCOS_TIPO) {
  css.push(`.con-marco.marco-${marco.id} {
  border-color: ${marco.color} !important;
  box-shadow: ${marco.oscuro ? `0 0 0 calc(var(--g) * 2) ${marco.oscuro}` : "none"};
}

.con-marco.marco-${marco.id}::after {
  left: ${pct(-(marco.cx - 50))};
  top: ${pct(-(marco.cy - 50))};
  width: ${pct(marco.ancho)};
  height: ${pct(marco.alto)};
  background-image: url("../img/marcos/${marco.id}.svg");
}
`);
  // Lo de delante, en un ::before ENCIMA de la foto (en algunas fotos el ::before enseñaba la
  // inicial cuando la imagen no carga: con estos marcos, esa inicial no sale)
  if (tieneDelante(marco)) {
    css.push(`.con-marco.marco-${marco.id}::before {
  content: "";
  position: absolute;
  z-index: 1;
  inset: auto;
  left: ${pct(-(marco.cx - 50))};
  top: ${pct(-(marco.cy - 50))};
  width: ${pct(marco.ancho)};
  height: ${pct(marco.alto)};
  background: url("../img/marcos/${marco.id}-delante.svg") center / 100% 100% no-repeat;
  pointer-events: none;
}
`);
  }
}
const ARCHIVO_CSS = fileURLToPath(new URL("../css/marcos-dibujo.css", import.meta.url));
writeFileSync(ARCHIVO_CSS, css.join("\n"));
console.log(`CSS en ${ARCHIVO_CSS}`);

// ---------- La muestra ----------

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

function dentroDe(puntos, x, y) {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [puntos[i], puntos[j]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function cercaDe(puntos, x, y, r, cerrado = false) {
  const lista = cerrado ? [...puntos, puntos[0]] : puntos;
  for (let i = 1; i < lista.length; i++) {
    const [[x1, y1], [x2, y2]] = [lista[i - 1], lista[i]];
    const largo = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / largo));
    if ((x - x1 - t * (x2 - x1)) ** 2 + (y - y1 - t * (y2 - y1)) ** 2 <= r * r) return true;
  }
  return false;
}

function colorEn(forma, x, y) {
  if (forma.elipse) {
    const [cx, cy, rx, ry, giro] = forma.elipse;
    const g = rad(giro);
    const [dx, dy] = [x - cx, y - cy];
    const lx = dx * Math.cos(g) + dy * Math.sin(g);
    const ly = -dx * Math.sin(g) + dy * Math.cos(g);
    const dentro = (mas) => (lx / (rx + mas)) ** 2 + (ly / (ry + mas)) ** 2 <= 1;
    if (!dentro(forma.grueso / 2)) return null;
    return dentro(-forma.grueso / 2) ? forma.relleno : forma.borde;
  }
  if (forma.poligono) {
    if (cercaDe(forma.poligono, x, y, forma.grueso / 2, true)) return forma.borde;
    return dentroDe(forma.poligono, x, y) ? forma.relleno : null;
  }
  return cercaDe(forma.trazo, x, y, forma.grueso / 2) ? forma.color : null;
}

// Lo que se ve en un punto, de abajo arriba como en la web: el aro del CSS (el borde de la foto y su
// sombra, que se pintan DEBAJO del ::after: aquí, con los gruesos de la Tienda, 3px y 2px en una foto
// de 48px), el dibujo de detrás, la foto y lo de delante
const ARO_CSS = { jungla: ["#3f8f3a", "#24581f"], celestial: ["#fff3c4", "#d8b04a"], llamarada: ["#ffb347", "#c2321b"], escarcha: ["#bfefff", "#3a8ab8"] };
const [BORDE_CSS, SOMBRA_CSS] = [6, 4];
function colorDe(marco, x, y, fondo) {
  let color = fondo;
  const [borde, sombra] = marco.color ? [marco.color, marco.oscuro] : ARO_CSS[marco.id.replace(/-\d+$/, "")] || [];
  const r = Math.hypot(x - marco.cx, y - marco.cy);
  if (borde && r <= 50 + BORDE_CSS) color = borde;
  else if (sombra && r <= 50 + BORDE_CSS + SOMBRA_CSS) color = sombra;
  for (const forma of marco.formas) if (!forma.delante) color = colorEn(forma, x, y) || color;
  if (r <= 50) color = "#7a7a88"; // la foto, encima
  for (const forma of marco.formas) if (forma.delante) color = colorEn(forma, x, y) || color;
  return color;
}

// Una rejilla de 5 por fila sobre el color de las tarjetas del tema Atardecer: a ×2
// (muestra-marcos.png) y a su tamaño en la Tienda, sobre las tarjetas de Atardecer y de Claro
// (muestra-marcos-real.png, con cada píxel de 4×4 puntos). Con un tercer argumento (ids separados por
// comas, p. ej. tipo-rock,tipo-ground), solo esos.
const carpetaMuestra = process.argv[2];
if (carpetaMuestra) {
  // Llamarada, cada fotograma; Escarcha, con la nieve por encima (como en el CSS)
  const todos = [
    ...MARCOS,
    ...LLAMARADA.fotogramas.map((formas, k) => ({ ...LLAMARADA, id: `llamarada-${k}`, formas })),
    { ...ESCARCHA, formas: [...ESCARCHA.formas, ...ESCARCHA.nieve.formas, ...mover(ESCARCHA.nieve.formas, 0, ESCARCHA.nieve.alto)] }
  ];
  const lista = process.argv[3] ? todos.filter((marco) => process.argv[3].split(",").some((id) => marco.id.startsWith(id))) : todos;
  const CELDA = 180;
  const rejilla = (escala, puntos, fondos, archivo) => {
    const POR_FILA = Math.min(5, lista.length);
    const lado = Math.round(CELDA * escala);
    const anchoTotal = lado * POR_FILA * fondos.length;
    const altoTotal = lado * Math.ceil(lista.length / POR_FILA);
    const datos = new Uint8Array(anchoTotal * altoTotal * 4);
    fondos.forEach((fondo, f) => lista.forEach((marco, k) => {
      const [x0, y0] = [(f * POR_FILA + (k % POR_FILA)) * lado, Math.floor(k / POR_FILA) * lado];
      const [ox, oy] = [(CELDA - marco.ancho) / 2, (CELDA - marco.alto) / 2];
      for (let py = 0; py < lado; py++) {
        for (let px = 0; px < lado; px++) {
          const suma = [0, 0, 0];
          for (let sy = 0; sy < puntos; sy++) {
            for (let sx = 0; sx < puntos; sx++) {
              const [x, y] = [(px + (sx + 0.5) / puntos) / escala - ox, (py + (sy + 0.5) / puntos) / escala - oy];
              rgb(colorDe(marco, x, y, fondo)).forEach((v, i) => { suma[i] += v; });
            }
          }
          datos.set([...suma.map((v) => Math.round(v / (puntos * puntos))), 255], ((y0 + py) * anchoTotal + x0 + px) * 4);
        }
      }
    }));
    writeFileSync(join(carpetaMuestra, archivo), png(anchoTotal, altoTotal, datos));
    console.log(`Muestra en ${join(carpetaMuestra, archivo)}`);
  };
  rejilla(2, 1, ["#32302f"], "muestra-marcos.png");
  rejilla(0.48, 4, ["#32302f", "#f3eee4"], "muestra-marcos-real.png");
}
