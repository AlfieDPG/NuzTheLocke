// Lo primero: el idioma (traduce lo que ya está escrito en la página antes de que se vea nada)
import "./comun/idioma.js";
import { activarRespaldoImagenes } from "./comun/imagenes.js";
import { iniciarNavegacion, irA, vistaInicial } from "./navegacion.js";
import { iniciarSesionUI } from "./sesion.js";
import { sumarContador } from "./comun/contadores.js";
import { usuarioActual } from "./comun/nube.js";
import { perfilesDeAmigos } from "./comun/perfiles.js";
import { iniciarAjustes } from "./comun/ajustes.js";
import { icono } from "./comun/iconos.js";
import "./comun/numero.js"; // las flechas de las casillas de número (en toda la web)
import { activarPestanasDeslizantes } from "./comun/pestanas-deslizantes.js";

activarRespaldoImagenes();
activarPestanasDeslizantes(); // antes de pintar nada, para ver ya las primeras pestañas
iniciarNavegacion();
irA(vistaInicial()); // la que hubiera al recargar, o Inicio si se entra de nuevas

// Ajustes (la rueda de abajo del panel): el tema y el idioma
document.querySelector(".boton-ajustes").innerHTML = icono("ajustes");
for (const boton of document.querySelectorAll("#dialogo-ajustes [data-icono]")) {
  boton.insertAdjacentHTML("afterbegin", icono(boton.dataset.icono));
}
iniciarAjustes();

// Preguntas frecuentes: el «?» al lado de «Créditos y privacidad»
const dialogoAyuda = document.querySelector("#dialogo-ayuda");
document.querySelector(".boton-ayuda").addEventListener("click", () => {
  dialogoAyuda.showModal();
  sumarContador("ayuda"); // para los logros
});
dialogoAyuda.querySelector(".ayuda-cerrar").addEventListener("click", () => dialogoAyuda.close());

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
