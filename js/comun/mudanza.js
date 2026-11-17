// ---------- «Nos mudamos» (solo en la dirección vieja) ----------
//
// La web pasa de alfiedpg.github.io/NuzTheLocke a www.nuzthelocke.es (2026-11-17). En la vieja sale
// una ventana en medio, con el fondo oscurecido, con un botón que lleva a la misma página en la nueva (con su ruta, ?... y #...).
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
      texto: "NuzTheLocke has a new address. Log in there with your account and you'll have everything. No account yet? Create one here first: what you saved in this browser goes into it.",
      ir: "Go to the new site",
      cerrar: "Stay here for now (to create an account)"
    }
    : {
      titulo: "¡Nos mudamos!",
      texto: "NuzTheLocke tiene dirección nueva. Entra allí con tu cuenta y lo tendrás todo. ¿No tienes cuenta? Créala antes aquí: lo que guardaste en este navegador se pasa a ella.",
      ir: "Ir a la web nueva",
      cerrar: "Quedarme aquí por ahora (para crear la cuenta)"
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
    .mudanza-fondo {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; box-sizing: border-box;
      background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(3px);
    }
    .mudanza {
      width: min(30rem, 100%); box-sizing: border-box;
      padding: 1.8rem 1.6rem 1.4rem; border-radius: 16px; text-align: center;
      background: var(--t-panel, #32302f); color: var(--t-texto, #f2f2f2);
      border-top: 0.4rem solid var(--t-bien, #2ecc71);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      font: inherit; font-size: 1rem; line-height: 1.5;
    }
    .mudanza img { width: 4.5rem; height: 4.5rem; display: block; margin: 0 auto 0.6rem; }
    .mudanza h2 { margin: 0 0 0.6rem; font-size: 1.7rem; }
    .mudanza p { margin: 0 0 0.7rem; }
    .mudanza-direccion {
      display: inline-block; margin: 0.2rem 0 0.9rem; padding: 0.4rem 0.9rem; border-radius: 8px;
      background: var(--t-control, #423f3e); font-size: 1.2rem; font-weight: bold;
    }
    .mudanza a {
      display: block; margin: 0.4rem 0 0.8rem; padding: 0.8rem 1rem; border-radius: 10px;
      background: var(--t-bien-oscuro, #27ae60); color: #fff;
      font-size: 1.15rem; font-weight: bold; text-decoration: none;
    }
    .mudanza a:hover { filter: brightness(1.1); }
    .mudanza button {
      border: none; background: none; color: inherit; opacity: 0.65; cursor: pointer;
      font: inherit; font-size: 0.85rem; text-decoration: underline;
    }
    .mudanza button:hover { opacity: 1; }
  `;
  document.head.appendChild(estilo);

  const fondo = document.createElement("div");
  fondo.className = "mudanza-fondo";
  fondo.innerHTML = `
    <div class="mudanza" role="dialog" aria-modal="true" aria-labelledby="mudanza-titulo">
      <img src="img/icono.svg" alt="">
      <h2 id="mudanza-titulo">${titulo}</h2>
      <p>${texto}</p>
      <div class="mudanza-direccion">www.nuzthelocke.es</div>
      <a href="${direccionNueva()}">${ir}</a>
      <button type="button">${cerrar}</button>
    </div>`;
  const caja = fondo;
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
