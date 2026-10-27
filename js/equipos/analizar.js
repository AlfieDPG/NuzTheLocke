// Ventana «Análisis del equipo» (botón «Analizar» de «Crear equipo», y «Ver análisis» de
// «Buscar equipo»): la nota del equipo, lo que más conviene mirar, lo que más lo mejoraría,
// cada Pokémon con el porqué de su nota, la cobertura y los puntos débiles. Las cuentas están
// en ./analisis.js.

import { estado, guardarEquipo } from "./estado.js";
import { analizarPokemon, analizarEquipo, palabraNota, sugerirMejoras, OBJETOS_HABITUALES } from "./analisis.js";
import { cargarAtaques } from "../calculadora/ataques.js";
import { clave } from "../calculadora/danio.js";
import { datos } from "../comun/datos.js";
import { obtenerStats } from "../comun/pokemon.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { imagenConRespaldo, urlsRetrato, urlsIconoObjeto } from "../comun/imagenes.js";
import { escaparHTML } from "../comun/tooltip.js";
import { t, nombre, LOCALE } from "../comun/idioma.js";

const dialogo = document.getElementById("dialogo-analisis");
const cuerpo = dialogo.querySelector(".analisis-cuerpo");

// Las sugerencias que se enseñan, como mucho
const MAX_MEJORAS = 5;

// Lo que se está enseñando: { miembros (analizados), mochila } (para las mejoras)
let mostrado = null;

// La última mochila leída de una partida («Buscar equipo», al pasar un equipo a «Crear equipo»):
// { objetos, nombre (del locke) }. Sin ella, se sugieren los objetos habituales.
let mochilaRecordada = null;

export function recordarMochila(objetos, nombreLocke) {
  mochilaRecordada = { objetos, nombre: nombreLocke };
}

const URL_NOTAS = new URL("../../datos/habilidades.json", import.meta.url);
const URL_FAMILIAS = new URL("../../datos/familias.json", import.meta.url);

// Lo que necesita el análisis además del equipo: se descarga la primera vez que se abre
let contexto = null;

export function cargarContexto() {
  if (!contexto) {
    const json = (url) => fetch(url).then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject(new Error(url))));
    contexto = Promise.all([cargarAtaques(), json(URL_NOTAS), json(URL_FAMILIAS)])
      .then(([ataques, notas, familias]) => ({ ataques, notas, familias }));
    contexto.catch(() => (contexto = null));
  }
  return contexto;
}

function mensaje(texto) {
  cuerpo.innerHTML = `<p class="analisis-mensaje">${texto}</p>`;
}

async function abrirAnalisis() {
  dialogo.showModal();
  mostrado = null;
  const equipo = estado.equipo.filter((p) => p.tipos && p.tipos.length);
  if (!equipo.length) {
    mensaje(t("Añade Pokémon al equipo para analizarlo."));
    return;
  }

  mensaje(t("Analizando..."));
  try {
    // Los añadidos antes de guardar las stats base: se descargan ahora
    const sinStats = equipo.filter((p) => !p.stats);
    if (sinStats.length) {
      await Promise.all(sinStats.map(async (p) => (p.stats = await obtenerStats(p))));
      guardarEquipo();
    }
    const contexto = await cargarContexto();
    mostrarAnalisis(equipo.map((p) => analizarPokemon(p, contexto)), mochilaRecordada);
  } catch (error) {
    console.error(error);
    mensaje(t("No he podido analizar el equipo. Revisa tu conexión y vuelve a probar."));
  }
}

// La ventana con unos Pokémon ya analizados (analizarPokemon). mochila: { objetos, nombre } de
// la partida de la que salen, para sugerir objetos que tienes (null: los habituales)
export function mostrarAnalisis(miembros, mochila = null) {
  if (!dialogo.open) dialogo.showModal();
  mostrado = { miembros, mochila };
  cuerpo.innerHTML = pintar(analizarEquipo(miembros));
  cuerpo.scrollTop = 0;
  // Las mejoras tardan un poco más: se buscan con la ventana ya pintada
  setTimeout(() => pintarMejoras(miembros, mochila), 30);
}

// ---------- Para mejorarlo ----------

// Los objetos habituales, como los de la web ({ id, es, en }), por si no se sabe la mochila
function objetosHabituales() {
  const porClave = new Map(datos.objetos.map((o) => [clave(o.en), o]));
  return OBJETOS_HABITUALES.map((en) => ({ objeto: porClave.get(clave(en)) || { id: 0, es: en, en }, cantidad: 1, mochila: false }));
}

const decimal = (n) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

// Una fila: el retrato de quién, qué cambiar (con el icono del objeto o del tipo) y lo que sube
// su nota (grande) y la del equipo (pequeño)
function filaMejora(s) {
  let texto;
  if (s.que === "objeto") {
    const icono = imagenConRespaldo(urlsIconoObjeto(s.objeto.en), `class="mejora-icono" alt="" data-quitar-si-falla`);
    const datosObjeto = { objeto: `<b>${icono}${escaparHTML(nombre(s.objeto))}</b>` };
    texto = s.mochila ? t("Ponle {objeto} (lo tienes en la mochila)", datosObjeto) : t("Ponle {objeto}, si lo tienes", datosObjeto);
  } else {
    const datosAtaque = {
      clase: s.clase === "fisico" ? t("ataque|físico") : t("ataque|especial"),
      tipo: `<b class="mejora-tipo" style="--color-tipo:${coloresTipo[s.tipo]}">${iconoTipo(s.tipo)}${tiposEs[s.tipo]}</b>`,
      ataque: s.quita ? `<b>${escaparHTML(nombre(s.quita))}</b>` : ""
    };
    texto = s.quita
      ? t("Un ataque {clase} de tipo {tipo} en lugar de {ataque}", datosAtaque)
      : t("Un ataque {clase} de tipo {tipo} en un hueco libre", datosAtaque);
  }
  return `
    <li class="mejora">
      ${imagenConRespaldo(urlsRetrato(s.poke), `class="mejora-retrato" alt="" draggable="false"`)}
      <span class="mejora-texto">
        <span class="mejora-quien">${escaparHTML(nombreDe(s.poke))}</span>
        <span>${texto}</span>
      </span>
      <span class="mejora-sube" title="${t("Lo que sube su nota y la del equipo")}">
        <b>+${Math.max(0, Math.round(s.subeEl))}</b>
        <small>${t("equipo +{n}", { n: decimal(s.sube) })}</small>
      </span>
    </li>`;
}

async function pintarMejoras(miembros, mochila) {
  const caja = cuerpo.querySelector(".analisis-mejoras");
  if (!caja || !mostrado || mostrado.miembros !== miembros) return;
  try {
    const lista = sugerirMejoras(miembros, await cargarContexto(), mochila ? mochila.objetos : objetosHabituales()).slice(0, MAX_MEJORAS);
    if (!mostrado || mostrado.miembros !== miembros) return; // mientras, se ha abierto otro
    const deDonde = mochila
      ? t("Los objetos, de la mochila de «{locke}».", { locke: escaparHTML(mochila.nombre) })
      : t("Sin la mochila de la partida, los objetos habituales.");
    caja.innerHTML = lista.length
      ? `<ul class="analisis-mejoras-lista">${lista.map(filaMejora).join("")}</ul>
         <p class="analisis-explica">${deDonde} ${t("De los ataques solo se dice el tipo: en un randomlocke, mira cuál de ese tipo puede aprender.")}</p>`
      : `<p class="analisis-bien">${t("No veo ningún cambio sencillo que lo mejore.")}</p>`;
  } catch (error) {
    console.error(error);
    caja.innerHTML = `<p class="analisis-mensaje">${t("No he podido buscar mejoras.")}</p>`;
  }
}

// ---------- Piezas ----------

// Rojo (20 o menos) -> amarillo -> verde (80 o más), como las barras de las fichas
export function colorNota(nota) {
  const proporcion = Math.min(1, Math.max(0, (nota - 20) / 60));
  return `hsl(${Math.round(proporcion * 120)}, 65%, 45%)`;
}

function barra(etiqueta, nota) {
  return `
    <div class="analisis-barra">
      <span class="analisis-barra-nombre">${etiqueta}</span>
      <span class="analisis-barra-fondo"><i style="width:${Math.round(nota)}%;background:${colorNota(nota)}"></i></span>
      <span class="analisis-barra-valor">${Math.round(nota)}</span>
    </div>`;
}

function seccion(titulo, contenido) {
  return `<section class="analisis-seccion"><h3>${titulo}</h3>${contenido}</section>`;
}

const nombreDe = (poke) => poke.mote || nombre(poke);

// ---------- La ventana ----------

// En pantallas anchas, todo de un vistazo: a la izquierda, arriba, la nota y, a su lado, lo que
// más conviene mirar; debajo, a todo el ancho, «Para mejorarlo» (en varias columnas, para no
// dejar huecos) y los Pokémon. A la derecha, en dos columnas tan altas como eso, la cobertura y
// los puntos débiles de los 18 tipos (cada tipo, en la misma fila en las dos, para leerlas
// como una tabla: lo que les hacéis y lo que os hacen)
function pintar(a) {
  return `
    <div class="analisis-rejilla">
      <div class="analisis-principal">
        <div class="analisis-arriba">
          <div>${cabecera(a)}</div>
          ${seccion(
            t("Lo que más conviene mirar"),
            a.avisos.length
              ? `<ul class="analisis-avisos">${a.avisos.map((aviso) => `<li class="${aviso.grave ? "grave" : ""}">${escaparHTML(aviso.texto)}</li>`).join("")}</ul>`
              : `<p class="analisis-bien">${t("Nada grave a la vista.")}</p>`
          )}
        </div>
        ${seccion(t("Para mejorarlo"), `<div class="analisis-mejoras"><p class="analisis-mensaje">${t("Buscando mejoras...")}</p></div>`)}
        ${seccion(t("Cada Pokémon"), `<ul class="analisis-miembros">${a.miembros.map(miembro).join("")}</ul>`)}
      </div>
      <div class="analisis-tablas">
        ${tabla(
          t("Cobertura"),
          t("Cuánta vida le quita vuestro mejor ataque a un Pokémon normalito de cada tipo."),
          a.cobertura.map(filaCobertura)
        )}
        ${tabla(
          t("Puntos débiles"),
          t("Cuántos son débiles a los ataques de cada tipo y cuántos los aguantan."),
          a.defensa.map((d) => filaDefensa(d, a.miembros.length))
        )}
      </div>
    </div>
  `;
}

function tabla(titulo, explicacion, filas) {
  return `
    <section class="analisis-tabla">
      <h3>${titulo}</h3>
      <p class="analisis-explica">${explicacion}</p>
      <div class="analisis-tabla-caja"><ul class="analisis-filas">${filas.join("")}</ul></div>
    </section>`;
}

function cabecera(a) {
  const { partes } = a;
  const faltan = 6 - a.miembros.length;
  return `
    <div class="analisis-cabecera">
      <div class="analisis-nota">
        <span class="analisis-nota-numero" style="color:${colorNota(a.nota)}">${Math.round(a.nota)}</span>
        <span class="analisis-nota-palabra">${palabraNota(a.nota)}</span>
      </div>
      <div class="analisis-barras">
        ${barra(t("Pokémon"), partes.miembros)}
        ${barra(t("Cobertura"), partes.cobertura)}
        ${barra(t("Defensa"), partes.defensa)}
        ${barra(t("Equilibrio"), partes.equilibrio)}
      </div>
    </div>
    <p class="analisis-explica">
      ${t("Una guía para pensar el equipo, no la última palabra. Todo se compara con un Pokémon normalito de su mismo nivel (80 en todas las estadísticas base), que sacaría un 50.")}
      ${faltan > 0 ? t("Faltan {n} Pokémon: la nota cuenta solo los que hay.", { n: faltan }) : ""}
    </p>`;
}

function miembro(m) {
  const poke = m.poke;
  const retrato = imagenConRespaldo(urlsRetrato(poke), `class="analisis-retrato" alt="" draggable="false"`);
  const notas = m.notas
    .map((n) => `<li class="${n.bien === true ? "bien" : n.bien === false ? "mal" : ""}">${escaparHTML(n.texto)}</li>`)
    .join("");
  return `
    <li class="analisis-miembro">
      ${retrato}
      <div class="analisis-miembro-datos">
        <div class="analisis-miembro-cabeza">
          <strong>${escaparHTML(nombreDe(poke))}</strong>
          <span class="analisis-miembro-nota" style="color:${colorNota(m.nota)}">${Math.round(m.nota)} · ${palabraNota(m.nota)}</span>
        </div>
        <div class="analisis-barras">
          ${barra(t("stat|Ataque"), m.ataque)}
          ${barra(t("Aguante"), m.aguante)}
          ${barra(t("stat|Velocidad"), m.velocidad)}
        </div>
        ${notas ? `<ul class="analisis-notas">${notas}</ul>` : ""}
      </div>
    </li>`;
}

// Una fila por tipo, igual en las dos tablas: la capa de color y el icono del tipo, su nombre
// y lo de esa tabla
function fila(tipo, clase, titulo, contenido) {
  return `
    <li class="analisis-fila ${clase}" style="--color-tipo:${coloresTipo[tipo]}" title="${escaparHTML(titulo)}">
      ${iconoTipo(tipo)}
      <span class="fila-tipo">${tiposEs[tipo]}</span>
      ${contenido}
    </li>`;
}

// Cobertura: quién le hace más daño y cuánto (verde si mucho, rojo si poco)
function filaCobertura(c) {
  const tipo = tiposEs[c.tipo];
  const porcentaje = Math.round(c.porcentaje);
  const titulo = c.quien
    ? t("{tipo}: {quien} con {ataque} le quita un {porcentaje} % de vida", {
        tipo, quien: nombreDe(c.quien.poke), ataque: c.golpe.nombre, porcentaje
      })
    : t("{tipo}: nadie le hace daño", { tipo });
  return fila(c.tipo, `cobertura ${c.nivel}`, titulo, `
    <span class="fila-detalle">${c.quien ? escaparHTML(nombreDe(c.quien.poke)) : "—"}</span>
    <span class="fila-valor">${t("{n} %", { n: porcentaje })}</span>`);
}

// Puntos débiles: cuántos son débiles y cuántos lo aguantan (resisten o son inmunes, también
// por la habilidad: con Levitación no es débil a Tierra). Rojo si tumba a 3 o más (o a 2 y
// nadie lo aguanta), naranja si a 2.
function filaDefensa({ tipo, debiles, aguantan }, miembros) {
  const gravedad = debiles >= 3 || (debiles >= 2 && !aguantan) ? "critico" : debiles >= 2 ? "aviso" : "";
  const titulo = t("{tipo}: {debiles} de {miembros} son débiles y {aguantan} lo aguantan (lo resisten o son inmunes)", {
    tipo: tiposEs[tipo], debiles, miembros, aguantan
  });
  const cuantosDebiles = debiles === 1 ? t("1 débil") : t("{n} débiles", { n: debiles });
  const cuantosAguantan = aguantan === 1 ? t("1 aguanta") : t("{n} aguantan", { n: aguantan });
  return fila(tipo, `defensa ${gravedad} ${debiles ? "" : "sin-debiles"} ${debiles && !aguantan ? "sin-aguante" : ""}`, titulo, `
    <span class="fila-detalle"><b class="defensa-debiles">${cuantosDebiles}</b> · <span class="defensa-aguantan">${cuantosAguantan}</span></span>
    <span class="defensa-barra"><i style="width:${(debiles / miembros) * 100}%"></i></span>`);
}

// ---------- Arranque ----------

export function iniciarAnalisis() {
  document.getElementById("analizar-equipo").addEventListener("click", abrirAnalisis);
  document.getElementById("analisis-cerrar").addEventListener("click", () => dialogo.close());
}
