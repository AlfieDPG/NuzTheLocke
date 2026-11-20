// Juegos con amigos (sección «Juegos»): la columna del medio cuando eliges uno de «Con amigos» en la cartilla.
//
// Sin partida abierta, el «vestíbulo» de ese juego: cómo se juega, a qué amigo retar, las invitaciones que te han
// mandado, las partidas en marcha y las terminadas. Con una abierta, el juego (js/juegos/amigos-quien.js,
// amigos-cromos.js, amigos-siluetas.js, amigos-dibujo.js). Los datos y las reglas, en js/comun/juntos.js.
//
// Cada juego exporta:
//   NOMBRE, COMO (cómo se juega, una frase), ICONO
//   datosIniciales() -> datos de la partida al retar
//   montar(caja, partida, ctx) -> se llama cada vez que cambia la partida (el juego decide qué repinta)
//   soltar() -> al salir (timers, escuchas)
// ctx: { yo, otro, nombreDe(uid), especies, cambiar(cambios), seguro(hacer), terminar(ganador, cambios), azar() }

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { usuarioActual } from "../comun/nube.js";
import { amigosAceptados, perfilesDeAmigos } from "../comun/perfiles.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { azarDelDia, claseMarco, marcoDe, fondoVisual, plantillaTituloDe } from "../comun/fichas.js";
import { t } from "../comun/idioma.js";
import {
  alCambiarJuntos, partidasJuntos, partidaJuntos, retarJuntos, aceptarJuntos, cambiarJuntos, cambiarJuntosSeguro,
  terminarJuntos, borrarJuntos, rendirseJuntos, otroDe, fallanJuntos, PREMIO_DIA, alCobrarPremio
} from "../comun/juntos.js";
import { cargarEspecies } from "./comun.js";

const MODULOS = {
  quien: () => import("./amigos-quien.js"),
  cromos: () => import("./amigos-cromos.js"),
  siluetas: () => import("./amigos-siluetas.js"),
  dibujo: () => import("./amigos-dibujo.js")
};

let caja = null;
let juego = ""; // el que se ve
let abierta = ""; // la partida abierta ("" = el vestíbulo)
let modulo = null;
let quitarOyente = null;
let ultimaPintada = null; // la partida tal y como se pintó la última vez (para no repintar si no cambia)
let premios = new Map(); // partida -> Pokédólares cobrados (para enseñarlo al final)

alCobrarPremio((id, puntos) => {
  premios.set(id, puntos);
  if (abierta === id) pintar(true);
});

export const JUEGOS_AMIGOS = [
  { id: "quien", icono: "lupa" },
  { id: "cromos", icono: "estadisticas" },
  { id: "siluetas", icono: "rayo" },
  { id: "dibujo", icono: "lapiz" }
];

const yo = () => (usuarioActual() || {}).uid || "";

// Lo que tengo pendiente en un juego (invitaciones y partidas en las que me toca), para la cartilla
export function pendientesDe(id) {
  const uid = yo();
  return partidasJuntos().filter((p) => p.juego === id && ((p.estado === "reto" && p.jugadores[1] === uid) || (p.estado === "jugando" && p.turno === uid))).length;
}

export async function montarAmigos(contenedor, id, idPartida = "") {
  soltarJuego();
  caja = contenedor;
  juego = id;
  abierta = idPartida;
  ultimaPintada = null;
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  modulo = await MODULOS[id]();
  if (quitarOyente) quitarOyente();
  quitarOyente = alCambiarJuntos(() => {
    if (caja && caja.isConnected) pintar();
    else if (quitarOyente) {
      quitarOyente();
      quitarOyente = null;
      soltarJuego();
    }
  });
}

function soltarJuego() {
  if (modulo && modulo.soltar) modulo.soltar();
}

function nombreDe(partida, uid) {
  if (uid === yo()) return t("Tú");
  return (partida.nombres || {})[uid] || t("Alguien");
}

function amigos() {
  return amigosAceptados().map((amistad) => perfilesDeAmigos().get(amistad.otro)).filter(Boolean);
}

// ---------- Vestíbulo ----------

function plantillaFila(partida) {
  const uid = yo();
  const otro = otroDe(partida, uid);
  const quien = escaparHTML(nombreDe(partida, otro));
  let estado;
  let botones;
  if (partida.estado === "reto" && partida.jugadores[1] === uid) {
    estado = t("Te invita");
    botones = `<button class="juntos-aceptar" data-id="${partida.id}">${t("Jugar")}</button>
               <button class="juntos-borrar boton-gris" data-id="${partida.id}">${t("Rechazar")}</button>`;
  } else if (partida.estado === "reto") {
    estado = t("Esperando a que acepte");
    botones = `<button class="juntos-borrar boton-gris" data-id="${partida.id}">${t("Retirar")}</button>`;
  } else if (partida.estado === "jugando") {
    estado = partida.turno === uid ? t("Te toca") : partida.turno ? t("Le toca") : t("En marcha");
    botones = `<button class="juntos-abrir" data-id="${partida.id}">${t("Abrir")}</button>`;
  } else {
    estado = partida.ganador === uid ? t("Ganaste") : partida.ganador === "empate" ? t("Empate") : t("Perdiste");
    botones = `<button class="juntos-abrir boton-gris" data-id="${partida.id}">${t("Ver")}</button>
               <button class="juntos-borrar boton-gris" data-id="${partida.id}" title="${t("Quitar de la lista")}">${icono("aspa")}</button>`;
  }
  const clase = partida.estado === "fin" ? (partida.ganador === uid ? "ganada" : partida.ganador === "empate" ? "" : "perdida") : partida.turno === uid || (partida.estado === "reto" && partida.jugadores[1] === uid) ? "me-toca" : "";
  return `
    <li class="juntos-fila ${clase}">
      <span class="juntos-fila-quien"><strong>${quien}</strong><small>${estado}</small></span>
      <span class="juntos-fila-botones">${botones}</span>
    </li>`;
}

// Un amigo con su botón de retar (o de abrir, si ya tenéis una partida de este juego a medias)
function plantillaAmigo(perfil, lista) {
  const conEl = lista.find((p) => p.estado !== "fin" && p.jugadores.includes(perfil.uid));
  const foto = perfil.foto
    ? `<img src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${escaparHTML((perfil.nombre || "?")[0].toUpperCase())}</span>`;
  // Con su foto, su marco, su título y su fondo, como en el resto de la web
  const fondo = fondoVisual(perfil);
  return `
    <li class="juntos-fila juntos-amigo ${fondo.clase}" style="${fondo.estilo}">
      <span class="clasificacion-foto juntos-foto ${claseMarco(marcoDe(perfil))}" data-perfil="${escaparHTML(perfil.uid)}" title="${t("Ver perfil")}">${foto}</span>
      <span class="juntos-fila-quien">
        <strong>${escaparHTML(perfil.nombre)}</strong>
        ${plantillaTituloDe(perfil, "pequeno")}
        ${conEl ? `<small>${t("Ya tenéis una partida")}</small>` : ""}
      </span>
      <span class="juntos-fila-botones">${conEl
        ? `<button class="juntos-abrir boton-gris" data-id="${conEl.id}">${t("Abrir")}</button>`
        : `<button class="juntos-retar-a" data-uid="${escaparHTML(perfil.uid)}">${icono("dados")} ${t("Retar")}</button>`}</span>
    </li>`;
}

function plantillaVestibulo() {
  const uid = yo();
  if (!uid) return `<p class="juegos-nota">${t("Entra con tu cuenta para jugar con tus amigos.")}</p>`;
  const lista = partidasJuntos().filter((p) => p.juego === juego);
  const grupos = [
    { titulo: t("Invitaciones"), filas: lista.filter((p) => p.estado === "reto" && p.jugadores[1] === uid) },
    { titulo: t("En marcha"), filas: lista.filter((p) => p.estado === "jugando" || (p.estado === "reto" && p.jugadores[0] === uid)) },
    { titulo: t("Terminadas"), filas: lista.filter((p) => p.estado === "fin").slice(0, 8) }
  ];
  const conAmigos = amigos();
  return `
    <p class="juntos-como">${modulo.COMO()}</p>
    <p class="juntos-premio">${icono("estrella")} ${t("La primera partida que ganes cada día: +{n} Pokédólares.", { n: PREMIO_DIA })}</p>
    ${conAmigos.length
      ? `<section class="juntos-grupo">
          <h3>${t("Tus amigos")}</h3>
          <ul class="juntos-lista juntos-amigos">${conAmigos.map((perfil) => plantillaAmigo(perfil, lista)).join("")}</ul>
        </section>`
      : `<p class="juegos-nota">${t("Añade amigos en «Amigos» para jugar con ellos.")}</p>`}
    ${fallanJuntos() === "permisos" ? `<p class="juegos-nota error">${t("No se pueden leer las partidas: faltan por publicar las reglas de Firestore.")}</p>` : ""}
    ${grupos.map((grupo) => grupo.filas.length
      ? `<section class="juntos-grupo"><h3>${grupo.titulo}</h3><ul class="juntos-lista">${grupo.filas.map(plantillaFila).join("")}</ul></section>`
      : "").join("")}`;
}

// ---------- Pintar ----------

function contexto(partida) {
  const uid = yo();
  return {
    yo: uid,
    otro: otroDe(partida, uid),
    nombreDe: (quien) => nombreDe(partida, quien),
    especies: null, // (las pone pintar)
    azar: () => azarDelDia(partida.semilla),
    cambiar: (cambios) => cambiarJuntos(partida.id, cambios),
    seguro: (hacer) => cambiarJuntosSeguro(partida.id, hacer),
    terminar: (ganador, cambios) => terminarJuntos(partida.id, ganador, cambios),
    premio: premios.get(partida.id) || 0
  };
}

function cabezaPartida(partida) {
  const uid = yo();
  const otro = otroDe(partida, uid);
  let estado;
  if (partida.estado === "fin") {
    estado = partida.ganador === uid ? t("¡Has ganado!") : partida.ganador === "empate" ? t("Empate") : t("Ha ganado {quien}", { quien: escaparHTML(nombreDe(partida, otro)) });
    if (partida.datos && partida.datos.rendido) estado += ` · ${partida.datos.rendido === uid ? t("te rendiste") : t("se rindió")}`;
    if (premios.get(partida.id)) estado += ` · <span class="ficha-moneda"></span>+${premios.get(partida.id)}`;
  } else if (partida.turno) {
    estado = partida.turno === uid ? `<b>${t("Te toca")}</b>` : t("Le toca a {quien}", { quien: escaparHTML(nombreDe(partida, otro)) });
  } else estado = t("Jugáis a la vez");
  return `
    <header class="juego-cabeza juntos-cabeza">
      <button class="juntos-volver boton-gris" title="${t("Volver")}">${icono("atras")}</button>
      <h2>${modulo.NOMBRE()}</h2>
      <span class="juntos-contra">${t("contra {quien}", { quien: `<b>${escaparHTML(nombreDe(partida, otro))}</b>` })}</span>
      <span class="juntos-estado ${partida.estado === "fin" ? "fin" : partida.turno === uid ? "me-toca" : ""}">${estado}</span>
      ${partida.estado === "jugando" ? `<button class="juntos-rendirse boton-gris">${icono("bandera")} ${t("Rendirse")}</button>` : ""}
    </header>`;
}

async function pintar(forzar = false) {
  if (!caja || !modulo) return;
  if (!abierta) {
    ultimaPintada = null;
    caja.innerHTML = `
      <header class="juego-cabeza"><h2>${modulo.NOMBRE()}</h2></header>
      <div class="juntos-vestibulo">${plantillaVestibulo()}</div>`;
    return;
  }
  const partida = partidaJuntos(abierta);
  if (!partida) {
    abierta = "";
    return pintar();
  }
  // Si no ha cambiado nada, no se toca (que no se pierda lo que se está haciendo)
  const firma = JSON.stringify([partida.estado, partida.turno, partida.datos, partida.ganador, premios.get(partida.id) || 0]);
  if (!forzar && ultimaPintada && ultimaPintada.id === partida.id && ultimaPintada.firma === firma) return;
  const primeraVez = !ultimaPintada || ultimaPintada.id !== partida.id;
  ultimaPintada = { id: partida.id, firma };
  if (primeraVez) {
    caja.innerHTML = `<div class="juntos-partida"><div class="juntos-cabeza-sitio"></div><div class="juntos-juego"></div></div>`;
  }
  caja.querySelector(".juntos-cabeza-sitio").innerHTML = cabezaPartida(partida);
  const ctx = contexto(partida);
  ctx.especies = await cargarEspecies();
  if (abierta !== partida.id) return;
  modulo.montar(caja.querySelector(".juntos-juego"), partida, ctx, primeraVez);
}

// ---------- Botones ----------

async function retar(boton) {
  const perfil = amigos().find((cada) => cada.uid === boton.dataset.uid);
  if (!perfil) return;
  boton.disabled = true;
  try {
    const id = await retarJuntos(juego, perfil.uid, perfil.nombre, perfil.foto || "", modulo.datosIniciales());
    abierta = "";
    avisar(t("Invitación mandada a {quien}. La partida empieza cuando acepte.", { quien: perfil.nombre }));
    return id;
  } catch (error) {
    console.error(error);
    avisar(error && error.code === "permission-denied"
      ? t("No se ha podido mandar la invitación. ¿Están publicadas las reglas de Firestore?")
      : t("No se ha podido mandar la invitación. Prueba otra vez en un rato."));
  } finally {
    boton.disabled = false;
  }
}

export function activarAmigos(contenedor) {
  contenedor.addEventListener("click", async (e) => {
    const boton = e.target.closest("button");
    if (!boton || !caja || !caja.contains(boton)) return;
    const id = boton.dataset.id;
    try {
      if (boton.matches(".juntos-retar-a")) {
        await retar(boton);
      } else if (boton.matches(".juntos-aceptar")) {
        boton.disabled = true;
        const partida = partidaJuntos(id);
        await aceptarJuntos(id, modulo.alAceptar ? modulo.alAceptar(partida) : {});
        abierta = id;
        pintar(true);
      } else if (boton.matches(".juntos-abrir")) {
        abierta = id;
        pintar(true);
      } else if (boton.matches(".juntos-borrar")) {
        boton.disabled = true;
        await borrarJuntos(id);
      } else if (boton.matches(".juntos-volver")) {
        soltarJuego();
        abierta = "";
        pintar(true);
      } else if (boton.matches(".juntos-rendirse")) {
        if (await confirmar(t("¿Rendirte? Gana tu amigo."))) await rendirseJuntos(abierta);
      }
    } catch (error) {
      console.error(error);
      boton.disabled = false;
      avisar(t("No se ha podido guardar. Revisa la conexión y vuelve a probar."));
    }
  });
}
