// ---------- «Nos mudamos» (solo en la dirección vieja) ----------
//
// La web pasa de alfiedpg.github.io/NuzTheLocke a www.nuzthelocke.es (2026-11-17). En la vieja sale
// abajo un aviso con un botón que lleva a la misma página en la nueva (con su ruta, ?... y #...).
// Lo guardado en el navegador NO pasa solo de una dirección a otra: pasa con la cuenta (se sube al
// iniciar sesión aquí y se baja al iniciarla allí). Se puede cerrar; vuelve a salir la próxima vez.
// Más adelante la vieja solo redirigirá (paso 4 de la mudanza).

import { enIngles } from "./idioma.js";

const VIEJA = "alfiedpg.github.io";
const NUEVA = "https://www.nuzthelocke.es/";
const CERRADO = "nuzthelocke-mudanza-cerrada";

function direccionNueva() {
  const ruta = location.pathname.replace(/^\/NuzTheLocke\/?/i, "");
  return NUEVA + ruta + location.search + location.hash;
}

function textos() {
  return enIngles
    ? {
      titulo: "We've moved!",
      texto: "NuzTheLocke now lives at <b>www.nuzthelocke.es</b>. Log in there with your account and you'll have everything. No account yet? Create one here first: what you saved in this browser goes into it.",
      ir: "Go to the new site",
      cerrar: "Close"
    }
    : {
      titulo: "¡Nos mudamos!",
      texto: "NuzTheLocke ahora está en <b>www.nuzthelocke.es</b>. Entra allí con tu cuenta y lo tendrás todo. ¿No tienes cuenta? Créala antes aquí: lo que guardaste en este navegador se pasa a ella.",
      ir: "Ir a la nueva",
      cerrar: "Cerrar"
    };
}

function mostrar() {
  try {
    if (sessionStorage.getItem(CERRADO)) return;
  } catch (error) {
    // sin sessionStorage, sale siempre
  }
  const { titulo, texto, ir, cerrar } = textos();

  const estilo = document.createElement("style");
  estilo.textContent = `
    .mudanza {
      position: fixed; z-index: 9999; left: 50%; transform: translateX(-50%);
      bottom: calc(var(--hueco-abajo, 0px) + 0.8rem);
      width: min(34rem, calc(100vw - 2rem)); box-sizing: border-box;
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.9rem;
      padding: 0.85rem 1rem; border-radius: 12px;
      background: var(--t-panel, #32302f); color: var(--t-texto, #f2f2f2);
      border-left: 0.35rem solid var(--t-bien, #2ecc71);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
      font: inherit; font-size: 0.92rem; line-height: 1.4;
    }
    .mudanza-texto { flex: 1 1 16rem; margin: 0; }
    .mudanza-texto strong { display: block; font-size: 1.05rem; margin-bottom: 0.15rem; }
    .mudanza-botones { display: flex; gap: 0.5rem; margin-left: auto; }
    .mudanza a, .mudanza button {
      padding: 0.45rem 0.9rem; border-radius: 8px; border: none; cursor: pointer;
      font: inherit; font-weight: bold; text-decoration: none; white-space: nowrap;
    }
    .mudanza a { background: var(--t-bien-oscuro, #27ae60); color: #fff; }
    .mudanza button { background: var(--t-control, #423f3e); color: inherit; }
  `;
  document.head.appendChild(estilo);

  const caja = document.createElement("div");
  caja.className = "mudanza";
  caja.setAttribute("role", "status");
  caja.innerHTML = `
    <p class="mudanza-texto"><strong>${titulo}</strong>${texto}</p>
    <div class="mudanza-botones">
      <button type="button">${cerrar}</button>
      <a href="${direccionNueva()}">${ir}</a>
    </div>`;
  // El enlace, con la página en la que se esté en ese momento (la web cambia el # al navegar)
  caja.querySelector("a").addEventListener("click", (e) => {
    e.currentTarget.href = direccionNueva();
  });
  caja.querySelector("button").addEventListener("click", () => {
    caja.remove();
    try {
      sessionStorage.setItem(CERRADO, "1");
    } catch (error) {
      // da igual
    }
  });
  document.body.appendChild(caja);
}

if (location.hostname === VIEJA) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrar);
  else mostrar();
}
