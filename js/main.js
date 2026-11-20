// Lo primero: el idioma (traduce lo que ya está escrito en la página antes de que se vea nada)
import "./comun/idioma.js";
import { activarRespaldoImagenes } from "./comun/imagenes.js";
import { iniciarNavegacion, irA, vistaInicial } from "./navegacion.js";
import { iniciarSesionUI } from "./sesion.js";
import { sumarContador } from "./comun/contadores.js";
import { usuarioActual, alCambiarSesion } from "./comun/nube.js";
import { perfilesDeAmigos } from "./comun/perfiles.js";
import { iniciarAjustes } from "./comun/ajustes.js";
import { icono } from "./comun/iconos.js";
import "./comun/numero.js"; // las flechas de las casillas de número (en toda la web)
import "./comun/mudanza.js"; // «Nos mudamos», solo en la dirección vieja (alfiedpg.github.io)
import "./comun/teclado.js"; // pulsar con el teclado las fotos, avisos y bloques que no son botones
import { activarPestanasDeslizantes } from "./comun/pestanas-deslizantes.js";
import { iniciarMovil } from "./movil.js";
import { girarCruz } from "./comun/logo.js";

activarRespaldoImagenes();
activarPestanasDeslizantes(); // antes de pintar nada, para ver ya las primeras pestañas
iniciarNavegacion();
iniciarMovil(); // la barra de abajo del móvil y la hoja de «Más»
irA(vistaInicial(), { historial: "cambiar" }); // la que hubiera al recargar, o Inicio si se entra de nuevas

// El logo: al pasar el ratón, la cruz del centro da un cuarto de vuelta. En Inicio, la del
// símbolo grande gira sola cada 8 s (si se está viendo).
document.querySelector(".logo a").addEventListener("mouseenter", (e) => girarCruz(e.currentTarget.querySelector(".cruz")));
setInterval(() => {
  if (!document.hidden) girarCruz(document.querySelector(".inicio-logo .cruz"));
}, 8000);

// El menú lateral siempre sin barra de scroll: el CSS lo encoge con el alto de la ventana y, si con
// eso no basta (más secciones, letra del sistema más grande...), se aprieta por niveles hasta que
// todo quepa (css/layout.css, .apretado-N)
const barraLateral = document.querySelector(".barra-lateral");
const menuLateral = document.querySelector(".menu-lateral");
function ajustarMenu() {
  barraLateral.classList.remove("apretado-1", "apretado-2", "apretado-3");
  if (matchMedia("(max-width: 760px)").matches) return;
  for (let nivel = 1; nivel <= 3 && menuLateral.scrollHeight > menuLateral.clientHeight + 1; nivel++) {
    barraLateral.classList.add(`apretado-${nivel}`);
  }
}
addEventListener("resize", ajustarMenu);
document.fonts.ready.then(ajustarMenu);
ajustarMenu();

// Ajustes (la rueda de abajo del panel): el tema y el idioma
document.querySelector(".boton-ajustes").innerHTML = icono("ajustes");
for (const boton of document.querySelectorAll("#dialogo-ajustes [data-icono]")) {
  boton.insertAdjacentHTML("afterbegin", icono(boton.dataset.icono));
}
iniciarAjustes();

// Preguntas frecuentes: el «?» al lado de «Créditos y privacidad» (js/ayuda.js, se baja al abrirlas)
document.querySelector(".boton-ayuda").addEventListener("click", async () => {
  const { abrirAyuda } = await import("./ayuda.js");
  abrirAyuda();
  sumarContador("ayuda"); // para los logros
});

// Pulsar la foto de alguien (data-perfil="uid": Versus, cementerio, Amigos...) abre su perfil.
// En captura, para ganar a lo que haga la tarjeta en la que está (desplegarse, por ejemplo).
// Solo el tuyo o el de un amigo: el de otra persona no se puede leer.
document.addEventListener(
  "click",
  async (e) => {
    const foto = e.target.closest("[data-perfil]");
    if (!foto || !foto.dataset.perfil) return;
    const usuario = usuarioActual();
    const uid = foto.dataset.perfil;
    const mio = usuario && uid === usuario.uid;
    if (!usuario || (!mio && !perfilesDeAmigos().has(uid))) return;
    e.stopPropagation();
    e.preventDefault();
    const { abrirMiPerfil, abrirPerfilDe } = await import("./perfil.js");
    if (mio) abrirMiPerfil();
    else abrirPerfilDe(uid);
  },
  true
);

// La sesión se monta aparte: si falla, la web sigue funcionando con el navegador
iniciarSesionUI().catch((error) => console.error(error));

// Guarda en el ordenador las imágenes y datos de fuera (ver sw.js). Si el navegador no
// lo admite o falla, la web va igual, solo que sin ese ahorro.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((error) => console.error(error));
}

// Las partidas de «Jugar» también van a la cuenta (js/jugar/nube-partidas.js): al entrar, un rato después
// (para no frenar el arranque), se juntan con las de la cuenta aunque no se abra «Jugar»
alCambiarSesion((usuario) => {
  if (!usuario) return;
  setTimeout(() => {
    if (usuarioActual() !== usuario) return;
    import("./jugar/nube-partidas.js")
      .then(({ sincronizarPartidas }) => sincronizarPartidas())
      .catch((error) => console.error("No se han podido juntar las partidas de «Jugar» con la cuenta", error));
  }, 8000);
});
