// «Adivínalo»: hay que dar con el Pokémon del día en seis intentos. Cada Pokémon que pruebas
// sale en una fila comparado con el del día:
//
//   · Tipo 1 y tipo 2: verde si coincide, amarillo si lo tiene pero en el otro hueco, rojo si no.
//   · Generación, etapa (1.ª, 2.ª o 3.ª de su línea) y total de estadísticas: verde si coincide;
//     si no, del amarillo (cerca) al rojo (lejos), y debajo «▲ más» o «▼ menos» (lo que tiene
//     el del día comparado con el tuyo).
//   · Clase (normal, bebé, legendario o singular): verde o rojo.
//
// Pokédólares: 50 a la primera y 8 menos por cada intento más (10 al sexto), más lo de la racha.

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { activarAutocompletado, iconoPokemon } from "../comun/autocompletado.js";
import { tiposEs, iconoTipo } from "../comun/tipos.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { cargarEspecies, delDia, estadoDe, guardarEstado, mirarSiYaJugado, terminar, plantillaFin, tituloAdivinar, CLASES } from "./comun.js";

const JUEGO = "pistas";
const INTENTOS = 6;
const PUNTOS = [50, 42, 34, 26, 18, 10];
const CERCA_TOTAL = 150; // a esta distancia del total bueno (o más), ya en rojo

const COLUMNAS = [t("Tipo 1"), t("Tipo 2"), t("Gen."), t("Etapa"), t("Total"), t("Clase")];

let caja = null;
let especies = [];
let objetivo = null;
let estado = null;
let ocupado = false;

export async function montarPistas(contenedor) {
  caja = contenedor;
  caja.innerHTML = `<p class="juego-cargando">${t("Cargando...")}</p>`;
  especies = await cargarEspecies();
  objetivo = delDia(especies, JUEGO);
  estado = estadoDe(JUEGO);
  pintar();
  if (await mirarSiYaJugado(JUEGO, estado).catch(() => false)) pintar();
}

// ---------- Comparar ----------

function casillaTipo(suya, i) {
  const tipo = suya.tipos[i] || "";
  const bueno = objetivo.tipos[i] || "";
  const estadoCasilla = tipo === bueno ? "si" : tipo && objetivo.tipos.includes(tipo) ? "casi" : "no";
  const texto = tipo ? `${iconoTipo(tipo)}<span>${escaparHTML(tiposEs[tipo])}</span>` : `<span>${t("Ninguno")}</span>`;
  return { estado: estadoCasilla, texto };
}

// Los números: verde si coincide; si no, del amarillo al rojo según lo lejos que esté (lejos
// = la distancia con la que ya sale rojo del todo) y, a la derecha del valor, una flecha hacia el
// bueno: «▲ más» si el del día tiene más, «▼ menos» si tiene menos.
function casillaNumero(valor, bueno, lejos, texto) {
  if (valor === bueno) return { estado: "si", texto };
  const cerca = 1 - Math.min(Math.abs(valor - bueno) - 1, lejos) / lejos; // 1 rozando, 0 lejos
  const tono = Math.round(cerca * 62); // 62 amarillo verdoso ... 0 rojo
  const mas = bueno > valor;
  return {
    estado: cerca >= 0.6 ? "casi" : "no",
    estilo: `--tono: ${tono}`,
    texto: `${texto}<span class="pistas-flecha" title="${mas ? t("El del día tiene más") : t("El del día tiene menos")}">${icono(mas ? "arriba" : "abajo")}</span>`
  };
}

const ETAPAS = { 1: t("1.ª etapa"), 2: t("2.ª etapa"), 3: t("3.ª etapa") };

function casillas(suya) {
  return [
    casillaTipo(suya, 0),
    casillaTipo(suya, 1),
    casillaNumero(suya.gen, objetivo.gen, 3, `<span>${suya.gen}</span>`),
    casillaNumero(suya.etapa, objetivo.etapa, 1, `<span>${ETAPAS[suya.etapa] || suya.etapa}</span>`),
    casillaNumero(suya.total, objetivo.total, CERCA_TOTAL, `<span>${suya.total}</span>`),
    { estado: suya.clase === objetivo.clase ? "si" : "no", texto: `<span>${escaparHTML(CLASES[suya.clase] || suya.clase)}</span>` }
  ];
}

// ---------- Pintar ----------

function plantillaFila(numero) {
  const suya = especies.find((especie) => especie.id === numero);
  if (!suya) return "";
  return `
    <div class="pistas-fila ${numero === objetivo.id ? "acierto" : ""}" role="row">
      <span class="pistas-quien" role="cell">
        ${imagenConRespaldo(urlsRetrato({ id: suya.id }), `alt="" loading="lazy" data-quitar-si-falla`)}
        <span>${escaparHTML(nombreDe(suya))}</span>
      </span>
      ${casillas(suya)
        .map((casilla) => `<span class="pistas-casilla ${casilla.estilo ? "escala" : casilla.estado}" style="${casilla.estilo || ""}" role="cell">${casilla.texto}</span>`)
        .join("")}
    </div>`;
}

function pintar() {
  const quedan = INTENTOS - estado.intentos.length;
  const puntos = Array.from({ length: INTENTOS }, (_, i) => {
    const numero = estado.intentos[i];
    const clase = numero == null ? "" : numero === objetivo.id ? "acierto" : "fallo";
    return `<span class="juego-intento ${clase}"></span>`;
  }).join("");

  caja.innerHTML = `
    <header class="juego-cabeza">
      <h2>${t("Adivínalo")}</h2>
      <span class="juego-intentos" title="${t("Intentos")}">${puntos}</span>
    </header>
    <p class="juego-explicacion">${t("Prueba con cualquier Pokémon: verás en qué se parece al del día.")}</p>
    <p class="pistas-leyenda">
      <span class="pistas-muestra si"></span> ${t("Acierto")}
      <span class="pistas-muestra casi"></span> ${t("Cerca (o el tipo está en el otro hueco)")}
      <span class="pistas-muestra no"></span> ${t("Lejos")}
      <span class="pistas-leyenda-flecha">${icono("arriba")} ${icono("abajo")} ${t("el del día tiene más o menos que el tuyo")}</span>
    </p>
    ${estado.fin
      ? plantillaFin(estado, tituloAdivinar(estado, escaparHTML(nombreDe(objetivo))))
      : `<form class="juego-form">
          <span class="juego-campo"><input type="text" autocomplete="off" placeholder="${t("Escribe un Pokémon...")}"
                 aria-label="${t("Pokémon")}"></span>
          <button type="submit">${t("Probar")} <small>(${quedan})</small></button>
        </form>`}
    ${estado.intentos.length
      ? `<div class="pistas-tabla" role="table">
          <div class="pistas-fila pistas-titulos" role="row">
            <span role="columnheader">${t("Pokémon")}</span>
            ${COLUMNAS.map((columna) => `<span role="columnheader">${columna}</span>`).join("")}
          </div>
          ${[...estado.intentos].reverse().map(plantillaFila).join("")}
        </div>`
      : ""}`;

  const formulario = caja.querySelector(".juego-form");
  if (!formulario) return;
  const campo = formulario.querySelector("input");
  const sugerencias = activarAutocompletado(campo, especies, probar, { icono: iconoPokemon });
  formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    sugerencias.elegirPrimera();
  });
}

async function probar(especie) {
  if (ocupado || estado.fin || estado.intentos.includes(especie.id)) return;
  ocupado = true;
  try {
    estado.intentos.push(especie.id);
    estado.acierto = especie.id === objetivo.id;
    if (estado.acierto || estado.intentos.length >= INTENTOS) {
      const cuadro = { si: "🟩", casi: "🟨", no: "🟥" };
      const filas = estado.intentos.map((numero) =>
        casillas(especies.find((cada) => cada.id === numero)).map((casilla) => cuadro[casilla.estado]).join(""));
      estado.resumen = `${t("Adivínalo")} ${estado.acierto ? estado.intentos.length : "X"}/${INTENTOS}\n${filas.join("\n")}`;
      const apuntando = terminar(JUEGO, estado, estado.acierto ? PUNTOS[estado.intentos.length - 1] : 0);
      pintar(); // ya terminado, mientras se apuntan los Pokédólares
      await apuntando;
    } else {
      guardarEstado(JUEGO, estado);
    }
    pintar();
    if (!estado.fin) caja.querySelector(".juego-form input").focus();
  } finally {
    ocupado = false;
  }
}
