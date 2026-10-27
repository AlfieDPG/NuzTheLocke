// «¿De quién es este grito?»: suena el grito de un Pokémon y hay que elegirlo entre cuatro.
// RONDAS rondas al día (las mismas para todo el mundo). Se puede volver a escuchar todas las
// veces que quieras (solo suena al pulsar «Escuchar»). Los gritos son los de PokeAPI
// (github.com/PokeAPI/cries), en .ogg.
//
// Pokédólares: 6 por acierto (30 si aciertas todos), más lo de la racha.

import { icono } from "../comun/iconos.js";
import { t } from "../comun/idioma.js";
import { crearTest, mezclar } from "./test.js";

const RONDAS = 5;
const URL_GRITOS = "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/";

let audio = null;

function sonar(ronda, caja) {
  if (!audio) audio = new Audio();
  audio.src = `${URL_GRITOS}${ronda.buena.id}.ogg`;
  audio.currentTime = 0;
  const boton = caja.querySelector(".grito-escuchar");
  audio.play().then(
    () => boton && boton.classList.add("sonando"),
    () => {} // sin haber tocado la página, el navegador no deja: ya lo pulsará
  );
  audio.onended = () => boton && boton.classList.remove("sonando");
}

export const montarGrito = crearTest({
  juego: "grito",
  titulo: t("¿De quién es este grito?"),
  explicacion: t("Escucha el grito y elige de quién es. Puedes escucharlo todas las veces que quieras."),
  porAcierto: 6,
  armar(especies, azar) {
    const salen = mezclar(especies, azar).slice(0, RONDAS * 4);
    return Array.from({ length: RONDAS }, (_, i) => {
      const cuatro = salen.slice(i * 4, i * 4 + 4);
      return { buena: cuatro[0], opciones: mezclar(cuatro, azar) };
    });
  },
  pregunta: () => `
    <button class="grito-escuchar" type="button">${icono("reanudar")}<span>${t("Escuchar")}</span></button>`,
  alEntrar(ronda, caja) {
    const boton = caja.querySelector(".grito-escuchar");
    boton.addEventListener("click", () => sonar(ronda, caja));
  }
});
