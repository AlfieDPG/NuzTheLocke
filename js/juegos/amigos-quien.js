// «¿Quién es quién?» con un amigo (ver js/juegos/amigos.js). Pensado para jugar en llamada:
//   · Los dos ven el mismo tablero de TABLERO Pokémon (sale de la semilla de la partida).
//   · Cada uno elige uno en secreto (juntos/{id}/secretos/{uid}: el otro no puede leerlo hasta el final).
//   · Por turnos: preguntas en voz alta («¿es de tipo Fuego?»), tachas en tu tablero los que descartas y pasas el
//     turno. Tachar se puede siempre (son tus apuntes); resolver, solo en tu turno.
//   · Resolver se puede UNA vez: si aciertas, ganas; si fallas, pierdes. Lo comprueba el navegador del otro (es
//     el que sabe su Pokémon) y al terminar los dos enseñan el suyo.
//
//   datos: { elegidos: { uid: true }, tachados: { uid: [especie] }, adivina: { uid, especie } | null,
//            revelado: { uid: especie }, turnos }

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { tiposEs } from "../comun/tipos.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { guardarSecreto, leerSecreto } from "../comun/juntos.js";

export const NOMBRE = () => t("¿Quién es quién?");
export const COMO = () => t("Cada uno elige un Pokémon en secreto del mismo tablero. Por turnos, pregunta cómo es el del otro (mejor en llamada), tacha los que descartes y pasa el turno. Puedes resolver una sola vez: si aciertas, ganas; si fallas, pierdes.");
export const TABLERO = 24;

const secretos = new Map(); // partida -> mi Pokémon (número)
const resolviendo = new Set(); // partidas cuyo «¿es este?» ya estoy comprobando
let resolver = false; // eligiendo a cuál apuntar
let caja = null;
let actual = null;
let ctxActual = null;

export function datosIniciales() {
  return { elegidos: {}, tachados: {}, adivina: null, revelado: {}, turnos: 0 };
}

export function soltar() {
  resolver = false;
  caja = null;
}

// Los del tablero: distintos, de todas las generaciones (unos cuantos de cada una, mezclados)
function tablero(partida, especies, azar) {
  const elegidas = [];
  const usadas = new Set();
  while (elegidas.length < TABLERO) {
    const especie = especies[Math.floor(azar() * especies.length)];
    if (usadas.has(especie.id)) continue;
    usadas.add(especie.id);
    elegidas.push(especie);
  }
  return elegidas;
}

async function miSecreto(partida, ctx) {
  if (!secretos.has(partida.id)) {
    const valor = await leerSecreto(partida.id, ctx.yo);
    if (valor) secretos.set(partida.id, Number(valor));
  }
  return secretos.get(partida.id) || 0;
}

function casilla(especie, { tachada, mia, elegible, apuntable, revelada }) {
  const clase = [tachada ? "tachada" : "", mia ? "mia" : "", elegible || apuntable ? "pulsable" : "", apuntable ? "apuntable" : "", revelada ? "revelada" : ""].join(" ");
  return `
    <button class="quien-casilla ${clase}" data-especie="${especie.id}" title="${escaparHTML(nombreDe(especie))} · ${especie.tipos.map((tipo) => tiposEs[tipo]).join(" / ")}">
      ${imagenConRespaldo(urlsRetrato({ id: especie.id }), `alt="" draggable="false" loading="lazy"`)}
      <span>${escaparHTML(nombreDe(especie))}</span>
      ${mia ? `<i class="quien-mia" title="${t("Tu Pokémon")}">${icono("estrella")}</i>` : ""}
    </button>`;
}

export async function montar(contenedor, partida, ctx) {
  caja = contenedor;
  actual = partida;
  ctxActual = ctx;
  const d = partida.datos || {};
  const lista = tablero(partida, ctx.especies, ctx.azar());
  const porNumero = new Map(lista.map((especie) => [especie.id, especie]));
  const secreto = await miSecreto(partida, ctx);
  if (caja !== contenedor) return;
  const elegidos = d.elegidos || {};
  const tachados = new Set(((d.tachados || {})[ctx.yo]) || []);
  const susTachados = ((d.tachados || {})[ctx.otro] || []).length;
  const meToca = partida.estado === "jugando" && partida.turno === ctx.yo;
  const fin = partida.estado === "fin";

  // Me han apuntado: lo compruebo yo (sé cuál es el mío)
  if (partida.estado === "jugando" && d.adivina && d.adivina.uid === ctx.otro && secreto && !resolviendo.has(partida.id)) {
    resolviendo.add(partida.id);
    const acierta = Number(d.adivina.especie) === secreto;
    ctx.terminar(acierta ? ctx.otro : ctx.yo, { [`datos.revelado.${ctx.yo}`]: secreto })
      .catch((error) => {
        console.error(error);
        resolviendo.delete(partida.id);
      });
  }
  // Terminada: enseño el mío (si no lo he hecho ya)
  if (fin && secreto && !(d.revelado || {})[ctx.yo] && !resolviendo.has(`${partida.id}/revelar`)) {
    resolviendo.add(`${partida.id}/revelar`);
    ctx.cambiar({ [`datos.revelado.${ctx.yo}`]: secreto }).catch((error) => console.error(error));
  }

  let aviso;
  let botones = "";
  if (fin) {
    const suyo = porNumero.get(Number((d.revelado || {})[ctx.otro]));
    const mio = porNumero.get(secreto);
    const apuesta = d.adivina ? porNumero.get(Number(d.adivina.especie)) : null;
    aviso = `
      <div class="quien-final">
        ${d.adivina ? `<p>${t("{quien} dijo {pokemon}.", { quien: escaparHTML(ctx.nombreDe(d.adivina.uid)), pokemon: `<b>${escaparHTML(apuesta ? nombreDe(apuesta) : "?")}</b>` })}</p>` : ""}
        <p>${t("El tuyo: {mio} · El de {quien}: {suyo}", {
          mio: `<b>${escaparHTML(mio ? nombreDe(mio) : "?")}</b>`,
          quien: escaparHTML(ctx.nombreDe(ctx.otro)),
          suyo: `<b>${escaparHTML(suyo ? nombreDe(suyo) : t("aún sin enseñar"))}</b>`
        })}</p>
      </div>`;
  } else if (!elegidos[ctx.yo] || !secreto) {
    aviso = `<p class="quien-aviso destacado">${icono("estrella")} ${t("Elige tu Pokémon en secreto: pulsa uno del tablero.")}</p>`;
  } else if (!elegidos[ctx.otro]) {
    aviso = `<p class="quien-aviso">${t("Esperando a que {quien} elija el suyo...", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>`;
  } else if (d.adivina && d.adivina.uid === ctx.yo) {
    aviso = `<p class="quien-aviso">${t("Has dicho {pokemon}. Comprobando...", { pokemon: `<b>${escaparHTML(nombreDe(porNumero.get(Number(d.adivina.especie)) || {}))}</b>` })}</p>`;
  } else if (meToca) {
    aviso = resolver
      ? `<p class="quien-aviso destacado">${icono("lupa")} ${t("¿Cuál es el de {quien}? Pulsa uno. Si fallas, pierdes.", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>`
      : `<p class="quien-aviso destacado">${t("Te toca: pregunta cómo es el suyo, tacha los que descartes y pasa el turno.")}</p>`;
    botones = resolver
      ? `<button class="quien-cancelar boton-gris">${t("Cancelar")}</button>`
      : `<button class="quien-pasar">${icono("visto")} ${t("Pasar el turno")}</button>
         <button class="quien-resolver boton-gris">${icono("lupa")} ${t("Resolver")}</button>`;
  } else {
    aviso = `<p class="quien-aviso">${t("Le toca a {quien}: contesta a su pregunta. Puedes ir tachando los tuyos.", { quien: escaparHTML(ctx.nombreDe(ctx.otro)) })}</p>`;
  }

  const eligiendo = !fin && (!elegidos[ctx.yo] || !secreto);
  const revelado = new Set(Object.values(d.revelado || {}).map(Number));
  caja.innerHTML = `
    <div class="quien">
      <div class="quien-barra">
        ${secreto ? `<span class="quien-tuyo">${imagenConRespaldo(urlsRetrato({ id: secreto }), `alt="" draggable="false"`)} ${t("Tu Pokémon: {pokemon}", { pokemon: `<b>${escaparHTML(nombreDe(porNumero.get(secreto) || {}))}</b>` })}</span>` : ""}
        <span class="quien-quedan">${t("Te quedan {n}", { n: TABLERO - tachados.size })} · ${t("A {quien} le quedan {n}", { quien: escaparHTML(ctx.nombreDe(ctx.otro)), n: TABLERO - susTachados })}</span>
      </div>
      ${aviso}
      <div class="quien-tablero ${resolver ? "resolviendo" : ""}">
        ${lista.map((especie) => casilla(especie, {
          tachada: !eligiendo && tachados.has(especie.id),
          mia: especie.id === secreto,
          elegible: eligiendo,
          apuntable: resolver && !fin,
          revelada: fin && revelado.has(especie.id)
        })).join("")}
      </div>
      ${botones ? `<div class="quien-botones">${botones}</div>` : ""}
      ${!fin && !eligiendo ? `<p class="juegos-nota">${t("Pulsa un Pokémon para tacharlo o destacharlo.")}</p>` : ""}
    </div>`;

  if (!caja.dataset.activo) {
    caja.dataset.activo = "1";
    caja.addEventListener("click", alPulsar);
  }
}

async function alPulsar(e) {
  const partida = actual;
  const ctx = ctxActual;
  if (!partida || !ctx || partida.estado !== "jugando") return;
  const d = partida.datos || {};
  try {
    if (e.target.closest(".quien-pasar")) {
      await ctx.cambiar({ turno: ctx.otro, "datos.turnos": (d.turnos || 0) + 1 });
      return;
    }
    if (e.target.closest(".quien-resolver")) {
      resolver = true;
      return montar(caja, partida, ctx);
    }
    if (e.target.closest(".quien-cancelar")) {
      resolver = false;
      return montar(caja, partida, ctx);
    }
    const boton = e.target.closest(".quien-casilla");
    if (!boton) return;
    const especie = Number(boton.dataset.especie);
    const nombre = boton.querySelector("span").textContent;
    // Elegir el mío
    if (!(d.elegidos || {})[ctx.yo] || !secretos.get(partida.id)) {
      if (!(await confirmar(t("¿Eliges a {pokemon}? Ya no se puede cambiar.", { pokemon: nombre })))) return;
      await guardarSecreto(partida.id, especie);
      secretos.set(partida.id, especie);
      await ctx.cambiar({ [`datos.elegidos.${ctx.yo}`]: true });
      return;
    }
    // Resolver: ¿es este?
    if (resolver) {
      if (partida.turno !== ctx.yo || d.adivina) return;
      if (!(await confirmar(t("¿Dices que es {pokemon}? Si fallas, pierdes.", { pokemon: nombre })))) return;
      resolver = false;
      await ctx.cambiar({ "datos.adivina": { uid: ctx.yo, especie } });
      return;
    }
    // Tachar o destachar (mis apuntes)
    const mios = new Set(((d.tachados || {})[ctx.yo]) || []);
    if (mios.has(especie)) mios.delete(especie);
    else mios.add(especie);
    boton.classList.toggle("tachada");
    await ctx.cambiar({ [`datos.tachados.${ctx.yo}`]: [...mios] });
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido guardar. Revisa la conexión y vuelve a probar."));
  }
}
