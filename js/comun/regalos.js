// ---------- Regalos de Pokédólares ----------
//
// Para celebrar algo con todo el mundo (p. ej. los 100 usuarios). Lo regalado no se apunta
// en ningún sitio: está aquí escrito y se suma al saldo de todos (ver saldo() en fichas.js),
// también de los que se registren después. Así nadie puede cambiarse la cantidad y no hacen
// falta reglas nuevas.
//
// Lo único que se guarda es que ya has visto la ventana de cada regalo, para que salga una
// sola vez (también entre dispositivos):
//
//   perfiles/{uid}.regalosVistos  { idRegalo: cuándo }
//
// Para hacer otro regalo, añadir uno a REGALOS con un id nuevo (y sus textos en
// js/idiomas/en/juegos.js).

import { usuarioActual } from "./nube.js";
import { alCambiarMiPerfil, miPerfil, guardarMiPerfil } from "./perfiles.js";
import { t, LOCALE } from "./idioma.js";

export const REGALOS = [
  {
    id: "100-usuarios",
    pokedolares: 2000,
    titulo: "¡Ya somos más de 100!",
    // Antes de la cantidad
    texto: "¡Hola! Solo quería contaros que NuzTheLocke ya ha pasado de los 100 usuarios. ¡Gracias por usar la web!\n\nPara celebrarlo, os dejo un regalo a todos:",
    // Después de la cantidad
    despues: "Ya los tenéis en vuestro saldo: gastadlos en la Tienda o en huevos de la Colección, dentro de «Juegos».\n\nY una cosa más: si os gusta la web, pasádsela a vuestros amigos, a vuestro grupo de lockes o a quien sepáis que está jugando uno. Cuantos más seamos, más cosas podré ir añadiendo. ¡A por los 200!",
    firma: "Alfie"
  }
];

const parrafos = (texto) => t(texto).split(/\n\s*\n/).map((parrafo) => `<p>${parrafo}</p>`).join("");

export function fichasDeRegalos() {
  return REGALOS.reduce((suma, regalo) => suma + regalo.pokedolares, 0);
}

// ---------- La ventana ----------

let enseñando = false;

function pendiente(perfil) {
  const vistos = (perfil && perfil.regalosVistos) || {};
  return REGALOS.find((regalo) => !vistos[regalo.id]) || null;
}

function enseñar(regalo) {
  enseñando = true;
  const dialogo = document.createElement("dialog");
  dialogo.className = "ventana-web regalo-ventana";
  dialogo.innerHTML = `
    <div class="ventana-texto">
      <p class="regalo-titulo">${t(regalo.titulo)}</p>
      ${parrafos(regalo.texto)}
    </div>
    <div class="regalo-cantidad">
      <span class="ficha-moneda grande"></span>
      <strong>+${regalo.pokedolares.toLocaleString(LOCALE)}</strong>
      <span>${t("Pokédólares")}</span>
    </div>
    <div class="ventana-texto regalo-despues">
      ${parrafos(regalo.despues)}
      ${regalo.firma ? `<p class="regalo-firma">— ${regalo.firma}</p>` : ""}
    </div>
    <div class="dialogo-botones">
      <button type="button" class="ventana-aceptar">${t("¡Gracias!")}</button>
    </div>`;
  document.body.appendChild(dialogo);

  dialogo.querySelector("button").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", async () => {
    dialogo.remove();
    try {
      await guardarMiPerfil({ [`regalosVistos.${regalo.id}`]: Date.now() });
    } catch (error) {
      console.error(error); // saldrá otra vez la próxima vez que entre
    }
    enseñando = false;
    revisar(); // por si hay otro regalo detrás
  });
  dialogo.showModal();
}

// Con sesión, el perfil cargado y ya con mote (si no, está la ventana obligatoria del nombre)
function revisar() {
  const perfil = miPerfil();
  if (enseñando || !usuarioActual() || !perfil || !perfil.mote) return;
  const regalo = pendiente(perfil);
  if (regalo) enseñar(regalo);
}

export function iniciarRegalos() {
  alCambiarMiPerfil(revisar);
}
