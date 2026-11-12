// ---------- «¿De qué locke?» en Rutas y Level caps ----------
//
// Solo sale si tienes DOS o más lockes abiertos del juego que estás viendo: una fila con uno por locke
// (su tipo de color y su nombre) para elegir de cuál es el progreso que se ve y se marca. Con uno solo
// (lo normal) no sale nada y todo va como siempre. Cómo se guarda cada uno: js/comun/lockes.js, «El
// progreso de Rutas y Level caps de cada locke».

import { escaparHTML } from "./utilidades.js";
import { icono } from "./iconos.js";
import { t } from "./idioma.js";
import { colorDeTipo } from "./perfiles.js";
import { lockesAbiertosDelJuego, lockeDeProgreso, elegirLockeDeProgreso } from "./lockes.js";

// Crea la fila (vacía y escondida) justo antes de «antesDe»
export function crearFilaLockes(antesDe, alElegir) {
  const fila = document.createElement("div");
  fila.className = "progreso-lockes";
  fila.hidden = true;
  antesDe.before(fila);
  fila.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-locke]");
    if (!boton || boton.classList.contains("activo")) return;
    elegirLockeDeProgreso(fila.dataset.juego, boton.dataset.locke);
    alElegir();
  });
  return fila;
}

// Firma de lo que hay (para saber si hay que volver a pintar al cambiar los lockes)
export function firmaLockes(idJuego, campoPropio) {
  const lista = lockesAbiertosDelJuego(idJuego, campoPropio);
  return lista.length < 2 ? "" : `${lista.map((locke) => locke.id).join(",")}|${lockeDeProgreso(idJuego, campoPropio)}`;
}

export function pintarFilaLockes(fila, idJuego, campoPropio) {
  const lista = idJuego ? lockesAbiertosDelJuego(idJuego, campoPropio) : [];
  fila.hidden = lista.length < 2;
  if (fila.hidden) {
    fila.innerHTML = "";
    return;
  }
  const elegido = lockeDeProgreso(idJuego, campoPropio);
  fila.dataset.juego = idJuego;
  fila.innerHTML = `
    <span class="progreso-lockes-titulo">${icono("espadas")} ${t("Progreso de")}</span>
    ${lista.map((locke) => `
      <button data-locke="${escaparHTML(locke.id)}" class="${locke.id === elegido ? "activo" : ""}"
              aria-pressed="${locke.id === elegido}" style="--color-locke: ${colorDeTipo(locke.tipo || {})}">
        ${escaparHTML(locke.nombre || t("Locke"))}
      </button>`).join("")}`;
}
