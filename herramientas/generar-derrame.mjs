// Genera img/titulos/derrame.svg y derrame-gota.svg (Baddie de Alola): el borde de abajo de la
// plaquita derramándose como pintura líquida.
//
// Uso: node herramientas/generar-derrame.mjs   (escribe en img/titulos/)
//
// · La franja blanca del borde NO va aquí: es el propio borde de la plaquita (un box-shadow en
//   css/titulos-adornos.css), que sigue las esquinas redondeadas y se une con el de los lados.
// · Aquí va lo que cuelga de ese borde: UNA silueta continua, todo curvas. Entre goterón y goterón
//   el borde hace un arco hacia arriba; de ahí baja con una curva suave a cada goterón, que se
//   ensancha un poco al final y acaba redondeado (como una gota de verdad, sin bola pegada).
// · Es una tesela que se repite a lo ancho: empieza y acaba en lo alto de un arco (a ras del borde
//   y en horizontal), así empalma sin cortes y, en los extremos, se funde con el borde. El CSS la
//   repite con «round» (siempre un número entero de teselas, nunca una cortada).
// · Sin contorno: la sombra hacia abajo la pone el CSS.
import { writeFileSync } from "node:fs";

const destino = process.argv[2] || "img/titulos";
const ANCHO = 60;          // la tesela: 4em en el CSS (1 unidad = 1/15 em)
const COLOR = "#ececec";   // el mismo que el borde de la plaquita (--placa-borde en el CSS)
const CUELLO = 3.5;        // donde el goterón ya baja recto

// Goterones: centro, medio ancho del cuello, radio del final y hasta dónde baja (pocos y distintos)
const gotas = [
  { x: 12, n: 2.6, rb: 3.4, largo: 10 },
  { x: 31, n: 3.4, rb: 4.4, largo: 15 },
  { x: 49, n: 2.2, rb: 2.9, largo: 7 }
];
// Lo alto de los arcos entre goterones (x, y): los de los extremos, a ras del borde
const arcos = [[0, 0], [21.5, 0.8], [40.5, 0.5], [ANCHO, 0]];

const r = (n) => +n.toFixed(2);
const K = 0.5523;          // para dibujar un cuarto de círculo con una curva de Bézier

let d = `M0 -3 L0 0`;
gotas.forEach((g, i) => {
  const [xa, ya] = arcos[i];
  const [xb, yb] = arcos[i + 1];
  const izq = g.x - g.n, der = g.x + g.n;
  const lado = g.largo - g.rb;                      // donde empieza la punta redondeada
  const tramo = lado - CUELLO;
  // Del arco al cuello, con una curva suave (horizontal arriba, vertical abajo)
  d += ` C${r(xa + (izq - xa) * 0.55)} ${r(ya)}, ${r(izq)} ${r(CUELLO - (CUELLO - ya) * 0.55)}, ${r(izq)} ${CUELLO}`;
  // El cuello se ensancha un poco hasta la punta
  d += ` C${r(izq)} ${r(CUELLO + tramo * 0.5)}, ${r(g.x - g.rb)} ${r(lado - tramo * 0.4)}, ${r(g.x - g.rb)} ${r(lado)}`;
  // La punta redondeada (media circunferencia)
  d += ` C${r(g.x - g.rb)} ${r(lado + g.rb * K)}, ${r(g.x - g.rb * K)} ${r(g.largo)}, ${g.x} ${r(g.largo)}`;
  d += ` C${r(g.x + g.rb * K)} ${r(g.largo)}, ${r(g.x + g.rb)} ${r(lado + g.rb * K)}, ${r(g.x + g.rb)} ${r(lado)}`;
  // Y vuelta a subir por el otro lado hasta el siguiente arco
  d += ` C${r(g.x + g.rb)} ${r(lado - tramo * 0.4)}, ${r(der)} ${r(CUELLO + tramo * 0.5)}, ${r(der)} ${CUELLO}`;
  d += ` C${r(der)} ${r(CUELLO - (CUELLO - yb) * 0.55)}, ${r(der + (xb - der) * 0.45)} ${r(yb)}, ${r(xb)} ${r(yb)}`;
});
d += ` L${ANCHO} -3 Z`;

// Un brillo pequeño en cada punta, para darle volumen
const brillos = gotas
  .map((g) => `<ellipse cx="${r(g.x - g.rb * 0.4)}" cy="${r(g.largo - g.rb * 0.75)}" rx="${r(g.rb * 0.22)}" ry="${r(g.rb * 0.38)}"/>`)
  .join("\n    ");

writeFileSync(`${destino}/derrame.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} 40">
  <!-- Baddie de Alola: la pintura que cuelga del borde de abajo de la plaquita (y = 0 es el borde):
       arcos entre goterones y goterones que acaban redondeados, todo una sola curva.
       GENERADO por herramientas/generar-derrame.mjs: no se toca a mano. -->
  <path d="${d}" fill="${COLOR}"/>
  <g fill="#ffffff" opacity="0.9">
    ${brillos}
  </g>
</svg>
`);

// La gota que cae: con su punta arriba, escondida al principio dentro del goterón largo
const g = gotas[1];
const cy = g.largo - g.rb + 1.2;
writeFileSync(`${destino}/derrame-gota.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} 40">
  <!-- La gota que se suelta del goterón largo (Baddie de Alola).
       GENERADO por herramientas/generar-derrame.mjs: no se toca a mano. -->
  <path d="M${g.x} ${r(cy - 4.2)} C${r(g.x - 1)} ${r(cy - 2.2)}, ${r(g.x - 2.2)} ${r(cy - 1.1)}, ${r(g.x - 2.2)} ${r(cy)} A2.2 2.2 0 0 0 ${r(g.x + 2.2)} ${r(cy)} C${r(g.x + 2.2)} ${r(cy - 1.1)}, ${r(g.x + 1)} ${r(cy - 2.2)}, ${g.x} ${r(cy - 4.2)} Z"
        fill="${COLOR}"/>
</svg>
`);
console.log("ok");
