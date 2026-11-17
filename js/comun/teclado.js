// ---------- Pulsar con el teclado lo que no es un botón ----------
//
// Algunas cosas se pulsan aunque no sean <button>: las fotos que abren un perfil (data-perfil),
// los avisos de la campana que llevan a su sitio y los bloques de Inicio que llevan a su sección.
// Aquí se les da foco con Tab (tabindex) y se pulsan con Intro o Espacio, como un botón.

const PULSABLES = "[data-perfil]:not(button):not(a), .aviso-ir, .inicio-enlace";

function preparar(raiz) {
  const lista = raiz.matches?.(PULSABLES) ? [raiz] : [];
  for (const el of lista.concat([...(raiz.querySelectorAll?.(PULSABLES) || [])])) {
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
  }
}

preparar(document.body);
new MutationObserver((cambios) => {
  for (const cambio of cambios) for (const nodo of cambio.addedNodes) if (nodo.nodeType === 1) preparar(nodo);
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  // Solo si el foco está en el propio elemento (no en un botón o casilla de dentro)
  if (!e.target.matches?.(PULSABLES)) return;
  e.preventDefault();
  e.target.click();
});
