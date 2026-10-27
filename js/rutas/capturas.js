// Registro de capturas (sección «Rutas»): en cada lugar marcado se puede apuntar qué Pokémon
// cogiste (con su forma y su mote). Es solo tuyo: va con tus rutas marcadas (en el navegador
// y, con sesión, en tu cuenta) y no en los lockes, así que tus rivales no lo ven. En un
// randomlocke no tienen por qué saber qué te ha tocado.
//
//   localStorage «poketeams-capturas-v1»:
//     { idJuego: { lugar: { especie, nombre, mote, idForma?, formaPMD?, imagenForma? } } }
//   o, si pasaste por ahí y no conseguiste capturar nada («No la conseguí»): { fallada: true }
//   (sin especie: no cuenta como captura en los logros ni registra nada en la Pokédex)

import { leer, escribir } from "../comun/almacen.js";
import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { obtenerVariedades, etiquetaForma } from "../comun/formas.js";
import { t, enIngles, nombre as nombreDe } from "../comun/idioma.js";
import { elegirForma, datosDeForma } from "../comun/elegir-forma.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";

// NO cambiar esta clave: si se cambia, se pierden las capturas apuntadas
const CLAVE = "poketeams-capturas-v1";

let dialogo = null;
let enLugar = null;   // { idJuego, clave }
let elegido = null;   // { id, es, texto, forma }
let eligiendo = null; // la elección en curso (mientras sale la ventana de la forma)
const listaPokemon = [];
let autocompletado = null;
let alGuardar = () => {};

function todas() {
  return leer(CLAVE, {}) || {};
}

// Se guardan por el nombre del lugar, sin el apartado («melemele:Ruta 1» -> «Ruta 1»): así
// no se pierden si un lugar cambia de apartado (como las marcas, ver rutas/index.js)
function lugarDe(clave) {
  return clave.slice(clave.indexOf(":") + 1);
}

export function capturaDe(idJuego, clave) {
  return (todas()[idJuego] || {})[lugarDe(clave)] || null;
}

function retrato(captura, clase) {
  const p = { id: captura.especie, idForma: captura.idForma, formaPMD: captura.formaPMD || 0 };
  return imagenConRespaldo(
    urlsRetrato(p),
    `class="${clase}" alt="" loading="lazy"`
  );
}

// Lo que va dentro del botón de un lugar marcado: su captura, o una «+» para apuntarla
// La especie (con su forma) en el idioma de la web: «nombre» va en español y «en», en inglés
// (las apuntadas antes de haber inglés, solo en español)
function especieDe(captura) {
  return (enIngles && captura.en) || captura.nombre;
}

export function plantillaCaptura(idJuego, clave) {
  const captura = capturaDe(idJuego, clave);
  if (captura && captura.fallada) {
    return `<span class="ruta-captura fallada" title="${t("Sin captura")}">${icono("aspa")}</span>`;
  }
  const titulo = captura ? (captura.mote ? `${captura.mote} (${especieDe(captura)})` : especieDe(captura)) : t("Apuntar captura");
  return `<span class="ruta-captura ${captura ? "con" : ""}" title="${escaparHTML(titulo)}">${
    captura ? retrato(captura, "ruta-captura-cara") : icono("mas")
  }</span>`;
}

export function abrirCaptura(idJuego, clave, lugar) {
  enLugar = { idJuego, clave };
  const guardada = capturaDe(idJuego, clave);
  const captura = guardada && !guardada.fallada ? guardada : null;
  elegido = captura
    ? {
        id: captura.especie,
        es: captura.nombre,
        en: captura.en || "",
        texto: especieDe(captura),
        forma: { idForma: captura.idForma, formaPMD: captura.formaPMD, imagenForma: captura.imagenForma }
      }
    : null;

  dialogo.querySelector(".captura-titulo").textContent = lugar;
  dialogo.querySelector(".captura-pokemon").value = captura ? especieDe(captura) : "";
  dialogo.querySelector(".captura-mote").value = captura ? captura.mote || "" : "";
  dialogo.querySelector(".captura-error").textContent = "";
  dialogo.querySelector(".captura-quitar").hidden = !guardada;
  dialogo.querySelector(".captura-fallada").hidden = Boolean(guardada && guardada.fallada);
  dialogo.showModal();
  dialogo.querySelector(".captura-pokemon").focus();
  cargarDatos()
    .then(() => listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon))
    .catch((error) => console.error(error));
}

// Elegida la especie: si tiene varias formas, se pregunta cuál (cancelar = la normal)
async function elegirEspecie(pokemon) {
  const campo = dialogo.querySelector(".captura-pokemon");
  elegido = { id: pokemon.id, es: pokemon.es, en: pokemon.en, texto: nombreDe(pokemon), forma: {} };
  campo.value = elegido.texto;

  let info = { especie: "", lista: [] };
  try {
    info = await obtenerVariedades(pokemon.id);
  } catch (error) {
    // sin información de formas: la normal
  }
  if (info.lista.length > 1) {
    const slug = await elegirForma(pokemon, info);
    try {
      const forma = slug ? await datosDeForma(info, slug) : {};
      if (forma.etiqueta) {
        const es = `${pokemon.es} (${etiquetaForma(slug, info.especie, "es")})`;
        const en = `${pokemon.en} (${etiquetaForma(slug, info.especie, "en")})`;
        elegido = { ...elegido, es, en, texto: `${nombreDe(pokemon)} (${forma.etiqueta})`, forma };
        campo.value = elegido.texto;
      }
    } catch (error) {
      console.error(error); // sin conexión: se queda la normal
    }
  }
  dialogo.querySelector(".captura-mote").focus();
}

function guardarEn(idJuego, clave, captura) {
  const guardadas = todas();
  const delJuego = { ...(guardadas[idJuego] || {}) };
  if (captura) delJuego[lugarDe(clave)] = captura;
  else delete delJuego[lugarDe(clave)];
  guardadas[idJuego] = delJuego;
  escribir(CLAVE, guardadas);
  alGuardar();
}

// Al desmarcar un lugar, lo que se capturó ahí se va con él (sin volver a pintar: ya lo hace
// rutas/index.js con el botón)
export function quitarCaptura(idJuego, clave) {
  if (!capturaDe(idJuego, clave)) return;
  const guardadas = todas();
  const delJuego = { ...(guardadas[idJuego] || {}) };
  delete delJuego[lugarDe(clave)];
  guardadas[idJuego] = delJuego;
  escribir(CLAVE, guardadas);
}

// «Desmarcar todo»: las de un juego entero
export function quitarCapturasDelJuego(idJuego) {
  const guardadas = todas();
  if (!guardadas[idJuego]) return;
  delete guardadas[idJuego];
  escribir(CLAVE, guardadas);
}

async function guardar() {
  const error = dialogo.querySelector(".captura-error");
  const texto = dialogo.querySelector(".captura-pokemon").value.trim();
  if (texto && (!elegido || elegido.texto !== texto)) autocompletado.elegirPrimera();
  if (eligiendo) await eligiendo;
  if (!elegido) {
    error.textContent = t("Elige un Pokémon de la lista.");
    return;
  }

  // Solo lo que haya: nada de «undefined» (se sube a tu cuenta)
  const captura = { especie: elegido.id, nombre: elegido.es, mote: dialogo.querySelector(".captura-mote").value.trim() };
  if (elegido.en) captura.en = elegido.en;
  for (const campo of ["idForma", "formaPMD", "imagenForma"]) {
    const valor = (elegido.forma || {})[campo];
    if (valor !== undefined && valor !== null) captura[campo] = valor;
  }
  dialogo.close();
  guardarEn(enLugar.idJuego, enLugar.clave, captura);
}

// alCambiar: para volver a pintar la lista
export function iniciarCapturas(alCambiar) {
  alGuardar = alCambiar;
  dialogo = document.querySelector("#dialogo-captura");
  const campo = dialogo.querySelector(".captura-pokemon");

  // Enter con sugerencias a la vista elige la primera y se queda en la ventana (ver cementerio)
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && campo.parentElement.querySelector(".sugerencias .opcion")) e.preventDefault();
  });
  autocompletado = activarAutocompletado(campo, listaPokemon, (pokemon) => {
    eligiendo = elegirEspecie(pokemon).finally(() => (eligiendo = null));
  }, { icono: iconoPokemon });
  campo.addEventListener("input", () => (elegido = null));

  dialogo.querySelector(".captura-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardar().catch((error) => console.error(error));
  });
  dialogo.querySelector(".captura-cancelar").addEventListener("click", () => dialogo.close());
  dialogo.querySelector(".captura-quitar").addEventListener("click", () => {
    dialogo.close();
    guardarEn(enLugar.idJuego, enLugar.clave, null);
  });
  // Pasaste por ahí y no conseguiste capturar nada: el lugar sigue gastado, sin Pokémon
  dialogo.querySelector(".captura-fallada").addEventListener("click", () => {
    dialogo.close();
    guardarEn(enLugar.idJuego, enLugar.clave, { fallada: true });
  });
}
