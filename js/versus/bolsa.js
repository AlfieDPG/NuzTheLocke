// Pestaña «Bolsa» de la ventana «Partida» (js/versus/partida.js): los bolsillos de la bolsa
// del jugador, como en PKHeX. En cada uno se cambia cuántos hay de cada objeto, se quitan y se
// meten otros (solo los que van en ese bolsillo). Como lo demás, va a la copia en memoria de la
// partida y se guarda al cerrar la ventana; en la actividad sale cómo ha quedado.

import { icono } from "../comun/iconos.js";
import { escaparHTML, quitarAcentos } from "../comun/utilidades.js";
import { activarAutocompletado } from "../comun/autocompletado.js";
import { imagenConRespaldo } from "../comun/imagenes.js";
import { campoNumero } from "../comun/numero.js";
import { formatoDeSeguro, CARAMELO_RARO } from "../partida/formato.js";
import {
  prepararDatos, partidaDeTrabajo, cambiarPartida, objetosDe, nombreObjeto, bolsilloDe, urlsIconoDe, iconoDe, LIMITES
} from "./editor-comun.js";
import { avisar } from "../comun/ventanas.js";
import { t } from "../comun/idioma.js";

const NOMBRES = {
  objetos: t("Objetos"), medicinas: t("Medicinas"), balls: "Balls", mt: t("MT y MO"), bayas: t("Bayas"), cartas: t("Cartas"), combate: t("bolsillo|Combate"),
  cristales: t("Cristales Z"), roto: t("Rotoprodigios"), tesoros: t("Tesoros"), ingredientes: t("Ingredientes"), clave: t("Objetos clave"),
  megapiedras: t("Megapiedras")
};
const ICONOS = {
  objetos: "objeto", medicinas: "pocion", balls: "pokeball", mt: "disco", bayas: "baya", cartas: "etiqueta", combate: "espadas",
  cristales: "rayo", roto: "estrella", tesoros: "corona", ingredientes: "caramelo", clave: "llave", megapiedras: "mega"
};
// En los de Switch ya no hay MO: en Espada / Escudo son MT y DT; en Perla Reluciente, solo MT
// En GS Vitro, el de los objetos de combate se llama «Mejoras» (como en el juego)
const NOMBRES_DE = { swsh: { mt: t("MT y DT") }, bdsp: { mt: t("MT") }, vitro: { mt: t("MT"), combate: t("Mejoras") } };

let elegido = "objetos"; // el bolsillo que se ve

function fila(e, bolsillo, juego) {
  // En algunos bolsillos cada objeto tiene su máximo (Espada / Escudo: las MT, una; los DT, 999)
  const maximo = bolsillo.maximoDe ? bolsillo.maximoDe(e.objeto) : bolsillo.maximo;
  return `
    <div class="bolsa-fila" data-objeto="${e.objeto}">
      <span class="bolsa-icono">${urlsIconoDe(e.objeto, juego).length ? imagenConRespaldo(urlsIconoDe(e.objeto, juego), `alt="" loading="lazy" data-quitar-si-falla`) : ""}</span>
      <span class="bolsa-nombre">${escaparHTML(nombreObjeto(e.objeto, juego))}</span>
      ${maximo > 1
        ? campoNumero(`<input class="bolsa-cantidad" type="number" min="0" max="${maximo}" value="${e.cantidad}" aria-label="${t("Cantidad")}">`)
        : ""}
      <button class="bolsa-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
    </div>`;
}

// Pinta la bolsa (la de la copia en memoria, con los cambios) en «contenedor»
export async function pintarBolsa(contenedor, idLocke) {
  await prepararDatos();
  const bytes = await partidaDeTrabajo(idLocke);
  const { id: juego, mochila: m } = formatoDeSeguro(bytes);
  const bolsillos = m.bolsillosDe(bytes);
  const mochila = m.leerMochila(bytes);
  if (!bolsillos.some((b) => b.id === elegido)) elegido = bolsillos[0].id;
  const bolsillo = bolsillos.find((b) => b.id === elegido);
  const lista = mochila[elegido];
  const lleno = lista.length >= bolsillo.caben;

  contenedor.innerHTML = `
    <div class="bolsa" data-juego="${juego}">
      <div class="bolsa-bolsillos">
        ${bolsillos
          .map((b) => `<button class="bolsa-bolsillo ${b.id === elegido ? "activo" : ""}" data-bolsillo="${b.id}">${icono(ICONOS[b.id])} ${(NOMBRES_DE[juego] || {})[b.id] || NOMBRES[b.id]} <small>${mochila[b.id].length}</small></button>`)
          .join("")}
      </div>
      <div class="bolsa-barra">
        ${lleno
          ? `<p class="bolsa-lleno">${t("Este bolsillo está lleno.")}</p>`
          : `<span class="editor-buscar bolsa-anadir"><input class="bolsa-buscar" type="search" placeholder="${t("Meter un objeto...")}" autocomplete="off"></span>`}
        <button class="bolsa-caramelos" title="${t("Llevar 999 Caramelos Raros")}">${icono("caramelo")} ${t("Caramelos raros")}</button>
      </div>
      <div class="bolsa-lista">
        ${lista.length ? lista.map((e) => fila(e, bolsillo, juego)).join("") : `<p class="bolsa-vacio">${t("No hay nada.")}</p>`}
      </div>
    </div>`;

  const campo = contenedor.querySelector(".bolsa-buscar");
  if (campo) {
    // Los de este bolsillo que existen en el juego y no están ya
    const ya = new Set(lista.map((e) => e.objeto));
    const opciones = objetosDe(juego)
      .filter((o) => !ya.has(o.id) && bolsilloDe(o.id, juego) === elegido)
      .map((o) => {
        // Con el ataque de las MT («MT26 Terremoto»), en el idioma de la web
        const nombre = nombreObjeto(o.id, juego);
        return { ...o, es: nombre, en: nombre, buscar: quitarAcentos(`${nombre} ${o.es} ${o.en}`) };
      });
    activarAutocompletado(campo, opciones, (entrada) => {
      cambiar(idLocke, (m) => m[elegido].push({ objeto: entrada.id, cantidad: 1 }), contenedor);
    }, { icono: (entrada) => iconoDe(entrada.id, juego) });
  }
}

// Cambia la bolsa de la copia en memoria: hacer(mochila) la toca
function cambiar(idLocke, hacer, contenedor) {
  cambiarPartida(idLocke, (original) => {
    const m = formatoDeSeguro(original).mochila;
    const mochila = m.leerMochila(original);
    const antes = JSON.stringify(mochila);
    hacer(mochila);
    if (JSON.stringify(mochila) === antes) throw new Error(""); // nada que cambiar
    return { nuevo: m.escribirMochila(original, mochila) };
  }, "bolsa").catch((error) => {
    if (!error.message) return;
    console.error(error);
    avisar(t(error.message || "No se ha podido cambiar la bolsa."));
    pintarBolsa(contenedor, idLocke).catch((otro) => console.error(otro));
  });
}

// Atajo: 999 Caramelos Raros, sin preguntar (van en su bolsillo, que pasa a verse: las medicinas
// o, en los de Switch y en Rojo Fuego, los objetos)
const CARAMELOS = 999;

async function caramelos(contenedor, idLocke) {
  const juego = formatoDeSeguro(await partidaDeTrabajo(idLocke)).id;
  elegido = LIMITES[juego].gen === 8 || LIMITES[juego].gen === 3 ? bolsilloDe(CARAMELO_RARO, juego) : "medicinas";
  cambiar(idLocke, (m) => {
    const suyo = m[elegido].find((e) => e.objeto === CARAMELO_RARO);
    if (suyo) suyo.cantidad = CARAMELOS;
    else m[elegido].push({ objeto: CARAMELO_RARO, cantidad: CARAMELOS });
  }, contenedor);
}

// Los botones y casillas de la bolsa (en la ventana «Partida»)
export function activarBolsa(contenedor, idDe) {
  contenedor.addEventListener("click", (e) => {
    if (!contenedor.querySelector(".bolsa")) return;
    const pestana = e.target.closest(".bolsa-bolsillo");
    if (pestana) {
      elegido = pestana.dataset.bolsillo;
      pintarBolsa(contenedor, idDe()).catch((error) => console.error(error));
      return;
    }
    if (e.target.closest(".bolsa-caramelos")) {
      caramelos(contenedor, idDe()).catch((error) => console.error(error));
      return;
    }
    const quitar = e.target.closest(".bolsa-quitar");
    if (quitar) {
      const id = Number(quitar.closest(".bolsa-fila").dataset.objeto);
      cambiar(idDe(), (m) => (m[elegido] = m[elegido].filter((x) => x.objeto !== id)), contenedor);
    }
  });
  contenedor.addEventListener("change", (e) => {
    if (!e.target.matches(".bolsa-cantidad")) return;
    const id = Number(e.target.closest(".bolsa-fila").dataset.objeto);
    const cantidad = Math.max(0, Math.floor(Number(e.target.value) || 0));
    cambiar(idDe(), (m) => {
      const suyo = m[elegido].find((x) => x.objeto === id);
      if (suyo) suyo.cantidad = cantidad;
      if (!cantidad) m[elegido] = m[elegido].filter((x) => x.objeto !== id);
    }, contenedor);
  });
}
