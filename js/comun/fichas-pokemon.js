// ---------- Piezas de la ficha de un Pokémon (al pasar el ratón) ----------
//
// Las barras de stats y las debilidades de la ficha de «Crear equipo» (js/equipos/crear.js), aparte
// para usarlas también en otras secciones (los bocadillos de «Combates», js/lucha/index.js). El
// estilo está en css/equipos.css (.ficha-stats, .stat, .ficha-tipos).

import { coloresTipo, tiposEs, iconoTipo } from "./tipos.js";
import { puntosDe, multiplicadoresDe, textoMultiplicador } from "./efectividad.js";
import { t } from "./idioma.js";

// Rojo (bajo) -> amarillo -> verde (alto). «bueno» es el valor a partir del cual ya es verde del todo.
export function colorStat(valor, malo, bueno) {
  const proporcion = Math.min(1, Math.max(0, (valor - malo) / (bueno - malo)));
  return `hsl(${Math.round(proporcion * 120)}, 70%, 45%)`;
}

export function filaStat(nombre, valor, maximo, malo, bueno, clase = "") {
  const ancho = Math.min(100, (valor / maximo) * 100);
  return `
    <div class="stat ${clase}">
      <span class="stat-nombre">${nombre}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-barra"><span style="width:${ancho}%;background:${colorStat(valor, malo, bueno)}"></span></span>
    </div>`;
}

// Debilidades, resistencias e inmunidades, para la ficha de la foto
export function bloqueTipos(tipos) {
  if (tipos.length === 0) return "";

  const { debiles, resisten, inmunes } = puntosDe(tipos);
  const multiplicadores = multiplicadoresDe(tipos);

  const fila = (titulo, lista, clase) =>
    lista.length
      ? `<div class="ficha-tipos-fila ${clase}">
           <span class="ficha-tipos-titulo">${titulo}</span>
           <span class="ficha-tipos-lista">
             ${lista
               .map(
                 (t) => `<span class="marca-tipo" style="background:${coloresTipo[t]}" title="${tiposEs[t]}">
                           ${iconoTipo(t)}<small>${textoMultiplicador(multiplicadores[t])}</small>
                         </span>`
               )
               .join("")}
           </span>
         </div>`
      : "";

  return `
    <div class="ficha-tipos">
      ${fila(t("Débil"), debiles, "debil")}
      ${fila(t("Resiste"), resisten, "resiste")}
      ${fila(t("Inmune"), inmunes, "inmune")}
    </div>`;
}
