// La cruz del centro del logo: un cuarto de vuelta, con un pequeño rebote al final.
// Se gira cambiando el atributo transform del SVG en cada fotograma (no con una animación de
// CSS): así el navegador la vuelve a dibujar como vector cada vez y no se ve borrosa ni a mitad
// de giro. Al acabar se quita el giro; como la cruz es simétrica, no se nota el salto.
const DURACION = 600;

// Pasa del todo con un rebote (sube un poco de más y vuelve), como cubic-bezier(.34,1.56,.64,1)
function conRebote(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function girarCruz(cruz) {
  if (!cruz || cruz.dataset.girando || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  cruz.dataset.girando = "1";
  const caja = cruz.getBBox();
  const cx = caja.x + caja.width / 2;
  const cy = caja.y + caja.height / 2;
  const inicio = performance.now();
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / DURACION);
    if (t < 1) {
      cruz.setAttribute("transform", `rotate(${(90 * conRebote(t)).toFixed(2)} ${cx} ${cy})`);
      requestAnimationFrame(paso);
    } else {
      cruz.removeAttribute("transform");
      delete cruz.dataset.girando;
    }
  };
  requestAnimationFrame(paso);
}
