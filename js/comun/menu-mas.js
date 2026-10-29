// Botón «⋯» con sus opciones debajo (las barras de Mis equipos y Crear equipo).
//
// En el HTML: <div class="menu-mas"> con un .menu-mas-boton vacío y una .menu-mas-lista
// (hidden) con los botones de siempre, cada uno con su id y su función. Aquí solo se pone el
// icono y se abre y se cierra: con el botón, al elegir una opción, al pulsar fuera o con
// Escape. Las opciones con data-sigue-abierto no lo cierran (las que avisan en el propio botón).
// En la Ruleta es una flecha (nombreIcono «abajo») y la lista se pinta desde su archivo.

import { icono } from "./iconos.js";

export function activarMenuMas(caja, nombreIcono = "puntos") {
  const boton = caja.querySelector(".menu-mas-boton");
  const lista = caja.querySelector(".menu-mas-lista");

  const abrir = (si) => {
    lista.hidden = !si;
    boton.setAttribute("aria-expanded", si);
  };

  boton.innerHTML = icono(nombreIcono);
  boton.setAttribute("aria-haspopup", "true");
  abrir(false);

  boton.addEventListener("click", () => abrir(lista.hidden));
  lista.addEventListener("click", (e) => {
    const opcion = e.target.closest("button");
    if (opcion && !opcion.hasAttribute("data-sigue-abierto")) abrir(false);
  });
  document.addEventListener("click", (e) => {
    if (!caja.contains(e.target)) abrir(false);
  });
  caja.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lista.hidden) {
      abrir(false);
      boton.focus();
    }
  });
}
