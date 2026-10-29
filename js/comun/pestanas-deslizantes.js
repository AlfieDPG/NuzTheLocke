// Las pestañas que cuelgan de la línea de color (regiones de Rutas y Level caps, Normas,
// Ruleta, Randomizer, Foro, Juegos) y las de Logros, que están de pie sobre ella: al cambiar de
// pestaña, el relleno se desliza de la vieja a la nueva en vez de saltar.
//
// Cada sección vuelve a pintar sus pestañas al cambiar, así que no se mueve la pestaña en sí:
// se apunta dónde estaba la elegida (por sección) y, cuando cambia, una copia del relleno, con
// sus curvas, viaja de ese sitio al nuevo (css/nuzlocke.css, .pestana-viajera). Mientras
// viaja, la nueva elegida no pinta el suyo.

const PESTANAS = ":is(.selector-juego, #vista-normas, #vista-ruleta, #vista-randomizer, #vista-foro, #vista-juegos) > .selector-regiones:first-child, .logros-filtro";
const DURACION = 250;
const sinAnimaciones = matchMedia("(prefers-reduced-motion: reduce)");

// Cada fila (su sección y sus clases: en Juegos hay dos, la de arriba y la de Clasificación)
// -> dónde estaba su elegida, relativo a la fila
const ultimas = new Map();

function medir(fila) {
  const elegida = fila.querySelector("button.activa");
  if (!elegida || !elegida.offsetWidth) return null;
  const caja = fila.getBoundingClientRect();
  const sitio = elegida.getBoundingClientRect();
  return {
    elegida,
    izquierda: sitio.left - caja.left + fila.scrollLeft,
    arriba: sitio.top - caja.top,
    ancho: sitio.width,
    alto: sitio.height
  };
}

function viajar(fila, antes, ahora) {
  const { elegida } = ahora;
  const viajera = document.createElement("span");
  viajera.className = fila.matches(".logros-filtro") ? "pestana-viajera de-pie" : "pestana-viajera";
  viajera.style.setProperty("--fondo", getComputedStyle(elegida).backgroundColor);
  fila.append(viajera);
  elegida.classList.add("pestana-llegando");

  const sitio = (medida) => ({
    transform: `translate(${medida.izquierda}px, ${medida.arriba}px)`,
    width: `${medida.ancho}px`,
    height: `${medida.alto}px`
  });
  const animacion = viajera.animate([sitio(antes), sitio(ahora)], { duration: DURACION, easing: "ease-in-out", fill: "forwards" });
  const acabar = () => {
    viajera.remove();
    elegida.classList.remove("pestana-llegando");
  };
  animacion.onfinish = acabar;
  animacion.oncancel = acabar;
}

function revisar(fila) {
  const seccion = fila.closest("section[id]");
  if (!seccion) return;
  const clave = `${seccion.id} ${fila.className}`;
  const ahora = medir(fila);
  const antes = ultimas.get(clave);
  ultimas.set(clave, ahora && { izquierda: ahora.izquierda, arriba: ahora.arriba, ancho: ahora.ancho, alto: ahora.alto });
  if (!ahora || !antes || sinAnimaciones.matches) return;
  if (Math.abs(antes.izquierda - ahora.izquierda) < 1 && Math.abs(antes.arriba - ahora.arriba) < 1) return;
  viajar(fila, antes, ahora);
}

// Los cambios que hace la propia animación (meter y sacar la copia, la clase de la que llega) no
// cuentan: si no, cada animación provocaría otra
function esDeLaAnimacion(cambio) {
  if (cambio.type === "attributes") {
    const antes = cambio.oldValue || "";
    const ahora = cambio.target.className || "";
    return antes.replace(/\s*pestana-llegando/g, "") === ahora.replace(/\s*pestana-llegando/g, "");
  }
  const nodos = [...cambio.addedNodes, ...cambio.removedNodes];
  return nodos.length > 0 && nodos.every((nodo) => nodo.classList && nodo.classList.contains("pestana-viajera"));
}

// Se mira cada cambio de la página, así que lo que no está en una fila de pestañas se descarta
// al momento (con un selector sencillo): si no, escribir en el creador de equipos o pintar una
// lista larga se volvía lento
export function activarPestanasDeslizantes() {
  const observador = new MutationObserver((cambios) => {
    const filas = new Set();
    for (const cambio of cambios) {
      if (esDeLaAnimacion(cambio)) continue;
      // El Randomizer vuelve a pintar toda la sección: la fila llega entre lo añadido
      for (const nodo of cambio.addedNodes) {
        if (nodo.nodeType === 1 && nodo.matches(PESTANAS)) filas.add(nodo);
      }
      const elemento = cambio.target.nodeType === 1 ? cambio.target : cambio.target.parentElement;
      const cerca = elemento && elemento.closest(".selector-regiones, .selector-juego");
      if (!cerca) continue;
      // En Rutas y Level caps se vuelve a pintar todo .selector-juego, con la fila dentro
      const fila = cerca.matches(".selector-juego") ? cerca.querySelector(":scope > .selector-regiones") : cerca;
      if (fila && fila.matches(PESTANAS)) filas.add(fila);
    }
    for (const fila of filas) revisar(fila);
  });
  observador.observe(document.querySelector("main"), { subtree: true, childList: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
}
