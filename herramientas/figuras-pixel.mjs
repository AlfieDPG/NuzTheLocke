// Pinta una figura en pixel art ({ ancho, alto, pixeles }: un color "#rrggbb" o null por píxel, como
// los sellos de herramientas/sellos-pixel.mjs) en un lienzo de generar-fondos-pixel.mjs (l.poner),
// con su esquina de arriba a la izquierda en (x, y).
export function pintarFigura(l, fig, x, y, a = 1) {
  fig.pixeles.forEach((c, k) => {
    if (c) l.poner(x + (k % fig.ancho), y + Math.floor(k / fig.ancho), c, a);
  });
}
