// ---------- Hojas de estilo que se piden al abrir su sección ----------
//
// Las hojas que solo usa una sección (Ruleta, Calculadora, Randomizer, Pokédex, Tienda, Combates
// y Jugar) no van en el <head> de index.html: se piden la primera vez que se abre la sección,
// igual que su JS (js/navegacion.js, HOJAS). Así la web pinta antes al entrar.
//
// El ORDEN importa: en CSS, a igual especificidad gana la regla que va después. Por eso cada hoja
// se mete en el sitio que tenía cuando se cargaban todas de golpe: delante de la siguiente de
// ORDEN que ya esté en la página. Al añadir una hoja nueva, ponla también aquí en su sitio.
//
// Para que una hoja pase a cargarse así, TODOS sus selectores tienen que ser solo de su sección
// (si algo de otra sección usa una de sus clases, se vería sin estilo hasta abrirla).

const ORDEN = [
  "base", "layout", "equipos", "nuzlocke", "amigos", "foro", "chat", "versus", "jugar", "lucha",
  "pokedex", "logros", "juegos", "tienda", "fondos-pixel", "marcos-dibujo", "titulos-adornos",
  "ruleta", "calculadora", "randomizer", "inicio", "perfil", "movil"
];

const pedidas = new Map(); // nombre -> promesa (se cumple al cargar, o al fallar: sin estilo, funciona igual)

function enlaceDe(nombre) {
  return document.querySelector(`link[rel="stylesheet"][href="css/${nombre}.css"]`);
}

export function cargarHoja(nombre) {
  if (!pedidas.has(nombre)) {
    pedidas.set(
      nombre,
      new Promise((resolver) => {
        if (enlaceDe(nombre)) return resolver(); // ya estaba en la página
        const enlace = document.createElement("link");
        enlace.rel = "stylesheet";
        enlace.href = `css/${nombre}.css`;
        enlace.addEventListener("load", resolver);
        enlace.addEventListener("error", resolver);
        const siguiente = ORDEN.slice(ORDEN.indexOf(nombre) + 1).map(enlaceDe).find(Boolean);
        if (siguiente) siguiente.before(enlace);
        else document.head.append(enlace);
      })
    );
  }
  return pedidas.get(nombre);
}

// Con la web ya cargada y sin nada que hacer, se piden por detrás (sin aplicarlas): así, al abrir
// la sección, salen de la caché del navegador al momento.
export function adelantarHojas(nombres) {
  const pedir = () => {
    for (const nombre of nombres) {
      if (enlaceDe(nombre)) continue;
      const aviso = document.createElement("link");
      aviso.rel = "prefetch";
      aviso.as = "style";
      aviso.href = `css/${nombre}.css`;
      document.head.append(aviso);
    }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(pedir, { timeout: 5000 });
  else setTimeout(pedir, 3000);
}
