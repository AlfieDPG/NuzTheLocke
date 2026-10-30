// ---------- El menú «⋯» de «Jugar» ----------
//
// Uno solo, que se abre debajo del botón que lo pide (las partidas de la lista, la partida guardada, la velocidad, las
// demás opciones). Con el aspecto del «⋯» del resto de la web (.menu-mas-lista, css/equipos.css), pero suelto en la
// página: las tarjetas se repintan a menudo y así no hay que volver a montarlo. Se cierra al elegir, al pulsar fuera,
// con Escape o al mover la página.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";

let abierto = null; // { lista, boton }

// opciones: [{ valor, texto, icono?, marcado?, peligro? } | { titulo }]; alElegir(valor)
export function abrirMenu(boton, opciones, alElegir) {
  const yaEra = abierto && abierto.boton === boton;
  cerrarMenu();
  if (yaEra) return; // el mismo botón: lo cierra
  const lista = document.createElement("div");
  lista.className = "menu-mas-lista jugar-menu";
  lista.setAttribute("role", "menu");
  lista.innerHTML = opciones
    .map((o) => o.titulo
      ? `<span class="jugar-menu-titulo">${escaparHTML(o.titulo)}</span>`
      : `<button type="button" role="menuitem" data-valor="${escaparHTML(o.valor)}" class="${o.peligro ? "peligro" : ""} ${o.marcado ? "marcado" : ""}">
           ${icono(o.marcado ? "visto" : o.icono || "vacio")}<span>${escaparHTML(o.texto)}</span></button>`)
    .join("");
  document.body.appendChild(lista);

  // Debajo del botón, alineado a su derecha; si no cabe, encima
  const caja = boton.getBoundingClientRect();
  const ancho = lista.offsetWidth;
  const alto = lista.offsetHeight;
  const izquierda = Math.max(8, Math.min(caja.right - ancho, innerWidth - ancho - 8));
  const arriba = caja.bottom + 6 + alto > innerHeight - 8 ? Math.max(8, caja.top - 6 - alto) : caja.bottom + 6;
  lista.style.left = `${izquierda}px`;
  lista.style.top = `${arriba}px`;

  boton.setAttribute("aria-expanded", "true");
  abierto = { lista, boton };
  lista.addEventListener("click", (e) => {
    const opcion = e.target.closest("button[data-valor]");
    if (!opcion) return;
    cerrarMenu();
    alElegir(opcion.dataset.valor);
  });
  const primera = lista.querySelector("button");
  if (primera) primera.focus({ preventScroll: true });
}

export function cerrarMenu() {
  if (!abierto) return;
  abierto.boton.setAttribute("aria-expanded", "false");
  abierto.lista.remove();
  abierto = null;
}

document.addEventListener("pointerdown", (e) => {
  if (abierto && !abierto.lista.contains(e.target) && !abierto.boton.contains(e.target)) cerrarMenu();
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && abierto) {
    const { boton } = abierto;
    cerrarMenu();
    boton.focus();
  }
});
addEventListener("resize", cerrarMenu);
addEventListener("scroll", cerrarMenu, true);
