// Ventana «Estadísticas» de una ficha de «Amigos»: los números de esa persona en sus lockes.
//
//   · En la tuya, de todos tus lockes: los de la web, los de tu palmarés y los que tus amigos
//     han apuntado en el suyo contigo como participante (aunque los perdieras).
//   · En la de un amigo, arriba el cara a cara contra él (lo monta js/amigos/index.js y llega
//     hecho) y debajo sus números: los lockes que jugáis juntos, los de su palmarés y los que
//     se ven apuntados en los palmarés de los demás con él dentro (de los otros lockes suyos
//     no ves nada).
//
// Los números están en js/comun/estadisticas.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { tiposEs, coloresTipo } from "../comun/tipos.js";
import { caraDePokemon } from "../comun/elegir-equipo.js";
import { misLockes } from "../comun/lockes.js";
import { miPerfil, perfilesDeAmigos } from "../comun/perfiles.js";
import { caraACara } from "../comun/cara-a-cara.js";
import { estadisticasDe } from "../comun/estadisticas.js";
import { retratoMuerto } from "../versus/cementerio.js";
import { t } from "../comun/idioma.js";

let dialogo = null;

// Los tipos de un Pokémon muerto (el cementerio no los guarda): de la Pokédex, por su forma o su especie
let tablaTipos = null;

async function tiposDeMuertos() {
  if (!tablaTipos) {
    const porClave = new Map();
    const porNumero = new Map();
    try {
      for (const fila of await cargarPokedex()) {
        porClave.set(fila.clave, fila.tipos || []);
        if (!fila.forma) porNumero.set(fila.numero, fila.tipos || []);
      }
    } catch (error) {
      // sin Pokédex no hay tipos que contar
    }
    tablaTipos = (muerto) => porClave.get(muerto.idForma) || porNumero.get(muerto.especie) || null;
  }
  return tablaTipos;
}

// ---------- Pintar ----------

function cifra(etiqueta, valor) {
  return `<div><dt>${escaparHTML(etiqueta)}</dt><dd>${escaparHTML(String(valor))}</dd></div>`;
}

function fichaDeTipos(lista) {
  return lista
    .map(
      (tipo) =>
        `<span class="stats-tipo" style="--color-tipo: ${coloresTipo[tipo.clave] || "#888"}">${escaparHTML(tipo.nombre)} <b>${tipo.n}</b></span>`
    )
    .join("");
}

function seccion(titulo, cuerpo) {
  return cuerpo ? `<h3>${escaparHTML(titulo)}</h3>${cuerpo}` : "";
}

function conCuenta(imagen, n, nombre) {
  return `
    <figure class="stats-pokemon">
      ${imagen}
      <span class="stats-cuenta">×${n}</span>
      <figcaption>${escaparHTML(nombre)}</figcaption>
    </figure>`;
}

function contraAmigos(mio) {
  const filas = [...perfilesDeAmigos().values()]
    .map((suyo) => ({ suyo, ...caraACara(mio, suyo) }))
    .filter((fila) => fila.juntos)
    .sort((uno, otro) => otro.juntos - uno.juntos || String(uno.suyo.nombre).localeCompare(String(otro.suyo.nombre)));
  if (!filas.length) return "";
  return `<ul class="stats-amigos">${filas
    .map(
      ({ suyo, juntos, mias, suyas }) => `
        <li>
          <span class="stats-amigo-nombre">${escaparHTML(suyo.nombre || t("Jugador"))}</span>
          <span class="stats-amigo-juntos">${t(juntos === 1 ? "{n} locke" : "{n} lockes", { n: juntos })}</span>
          <span class="stats-amigo-marcador ${mias > suyas ? "gana" : mias < suyas ? "pierde" : ""}">${mias} – ${suyas}</span>
        </li>`
    )
    .join("")}</ul>`;
}

// De qué lockes salen los números
function textoAlcance(mia, apuntados) {
  if (mia) return t(apuntados ? "En todos tus lockes, también los apuntados (por ti o por tus amigos)" : "En todos tus lockes");
  return t(apuntados ? "En los lockes que jugáis juntos y los que hay apuntados de esa persona" : "En los lockes que jugáis juntos");
}

// comparacion: el cara a cara ya montado (en la ficha de un amigo), o ""
export async function abrirEstadisticas(uid, comparacion = "") {
  const mio = miPerfil();
  const mia = Boolean(mio) && uid === mio.uid;
  const perfil = mia ? mio : perfilesDeAmigos().get(uid);
  if (!perfil) return;

  dialogo.querySelector(".estadisticas-titulo").innerHTML = `${icono("estadisticas")} ${escaparHTML(perfil.nombre || t("Jugador"))}`;
  dialogo.querySelector(".estadisticas-cuerpo").innerHTML = `<p class="actividad-vacia">${t("Contando…")}</p>`;
  dialogo.showModal();

  const otros = [mio, ...perfilesDeAmigos().values()].filter(Boolean);
  const datos = estadisticasDe(uid, misLockes(), perfil, otros, await tiposDeMuertos(), (tipo) => tiposEs[tipo] || tipo);
  if (!dialogo.open) return;

  if (!datos.lockes) {
    dialogo.querySelector(".estadisticas-cuerpo").innerHTML =
      comparacion || `<p class="actividad-vacia">${t(mia ? "Todavía no tienes lockes de los que sacar números." : "Todavía no habéis jugado ningún locke juntos.")}</p>`;
    return;
  }

  // Los apuntados no dicen cuántos murieron: lo de los muertos y las vidas
  // sale solo de los de la web, y con apuntados el «ganados de» no cuenta las derrotas que no se apuntan
  const enWeb = datos.lockes - datos.apuntados;
  const cifras = [
    cifra(t("Lockes"), datos.lockes),
    cifra(t("Ganados"), datos.apuntados ? datos.ganados : datos.terminados ? `${datos.ganados}/${datos.terminados}` : "–")
  ];
  if (datos.apuntados) {
    cifras.push(cifra(t("Lockes apuntados"), datos.apuntados));
    if (datos.terminadosEnWeb) cifras.push(cifra(t("Ganados en la web"), `${datos.ganadosEnWeb}/${datos.terminadosEnWeb}`));
  }
  cifras.push(cifra(t("ROM pasadas"), datos.roms));
  if (enWeb) {
    cifras.push(
      cifra(t("Pokémon muertos"), datos.caidos),
      cifra(t("Muertos por locke"), datos.caidosPorLocke),
      cifra(t("Vidas perdidas"), datos.vidasPerdidas)
    );
  }
  if (datos.combatesJugados) cifras.push(cifra(t("Combates ganados"), `${datos.combatesGanados}/${datos.combatesJugados}`));
  if (datos.eliminado) cifras.push(cifra(t("Eliminado en"), datos.eliminado));

  dialogo.querySelector(".estadisticas-cuerpo").innerHTML = `
    ${comparacion ? `<h3 class="stats-cabecera">${t("Cara a cara")}</h3>${comparacion}<h3 class="stats-cabecera">${t("Estadísticas")}</h3>` : ""}
    <p class="stats-sub">${escaparHTML(textoAlcance(mia, datos.apuntados))}</p>
    <dl class="cronica-cifras stats-cifras">${cifras.join("")}</dl>
    ${datos.apuntados ? `<p class="stats-nota">${t("Los lockes apuntados cuentan con lo que se haya apuntado de ellos (equipos, combates, ROM, juego), ganados o perdidos, pero no dicen cuántos Pokémon murieron.")}</p>` : ""}
    ${seccion(t("Los Pokémon que más mueren"), datos.masMuertos.length
      ? `<div class="stats-pokemones">${datos.masMuertos.map((fila) => conCuenta(retratoMuerto(fila.muestra, "stats-cara"), fila.n, fila.nombre)).join("")}</div>`
      : "")}
    ${seccion(t("El tipo que más muere"), datos.tiposQueMueren.length ? `<div class="stats-tipos">${fichaDeTipos(datos.tiposQueMueren)}</div>` : "")}
    ${seccion(t("Los Pokémon más usados"), datos.masUsados.length
      ? `<div class="stats-pokemones">${datos.masUsados.map((fila) => conCuenta(caraDePokemon(fila.muestra, "stats-cara"), fila.n, fila.nombre)).join("")}</div>`
      : "")}
    ${seccion(t("Tipos más usados"), datos.tiposUsados.length ? `<div class="stats-tipos">${fichaDeTipos(datos.tiposUsados)}</div>` : "")}
    ${seccion(t("Por juego"), datos.porJuego.length
      ? `<table class="stats-juegos"><thead><tr><th>${t("Juego")}</th><th>${t("Lockes")}</th><th>${t("Ganados")}</th><th>${t("Muertos")}</th></tr></thead><tbody>${datos.porJuego
          .map((fila) => `<tr><td>${escaparHTML(fila.nombre)}</td><td>${fila.n}</td><td>${fila.ganados}</td><td>${fila.caidos}</td></tr>`)
          .join("")}</tbody></table>`
      : "")}
    ${mia ? seccion(t("Contra tus amigos"), contraAmigos(mio)) : ""}`;
}

// alVerTodos: despliega la lista del cara a cara (la función de js/amigos/index.js)
export function iniciarEstadisticas(alVerTodos) {
  dialogo = document.querySelector("#dialogo-estadisticas");
  dialogo.querySelector(".estadisticas-cerrar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => {
    const boton = e.target.closest(".ver-todos");
    if (boton) alVerTodos(boton);
  });
}
