// Editar un Pokémon de la partida vinculada a un locke (como en PKHeX), desde la ventana
// «Partida» (js/versus/partida.js): especie y forma, mote, shiny, género, nivel, naturaleza,
// EVs e IVs (la ventana de «Crear equipo», js/equipos/entreno.js), amistad, ball, objeto,
// habilidad, ataques y si es un huevo. En un hueco vacío, se crea uno nuevo.
//
// Además: borrarlo y clonarlo (a la primera caja con sitio). Moverlos es arrastrarlos en las cajas.
//
// «Aceptar» no escribe: el cambio va a la copia en memoria de la partida (./editor-comun.js),
// y todo se guarda junto al cerrar la ventana «Partida», con una línea en la actividad del
// locke. Lo de escribir está en js/partida/ (vinculo, formato, huecos y las piezas de cada consola).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { coloresTipo, iconoTipo } from "../comun/tipos.js";
import { activarAutocompletado, iconoPokemon, iconoObjeto } from "../comun/autocompletado.js";
import { imagenConRespaldo, urlsRetrato, urlsIconoObjeto } from "../comun/imagenes.js";
import { generosPosibles, ICONO_GENERO, NOMBRE_GENERO } from "../comun/pokemon.js";
import { campoNumero } from "../comun/numero.js";
import { NATURALEZAS, incrustarEntreno, opcionesNaturaleza } from "../equipos/entreno.js";
import { mirar, poner, huecoLibre, llaveDe } from "../partida/huecos.js";
import { ppMaximos } from "../partida/pokemon3ds.js";
import { formatoDeSeguro } from "../partida/formato.js";
import {
  LIMITES, infoAtaques, prepararDatos, nombreEspecie, nombreHuevo, objetosDe, hastaLimite, objeto, habilidad,
  ataque, balls, cargarInfoAtaque, formasDe, datosEspecie, ataquesDeNivel, generoAlAzar, comprobarSitio, cambiarHuecos, partidaDeTrabajo, urlsIconoDe, iconoDe,
  VERSIONES, versionesDe, lugaresDe, lugarIntercambio, nombreLugar, creadoEnWeb, partidaGuardada
} from "./editor-comun.js";
import { confirmar } from "../comun/ventanas.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";

let dialogo = null;
let panel = null; // lo de dentro: va en su ventana o en el lado de la ventana «Partida»
let lado = null;
let reposo = null; // el aviso del hueco de la derecha cuando no se edita nada
let cuerpo = null;
let error = null;
let alCambiarEditando = () => {};

// A partir de este ancho, el editor va a la derecha de las cajas: se pasa de un Pokémon a otro
// sin abrir y cerrar ventanas
const ANCHO_PARA_LADO = "(min-width: 1100px)";
// { idLocke, sitio, juego, llave (0 si es nuevo), antes (null si es nuevo), poke, nivelInicial }
let abierto = null;
let editando = null; // el sitio que se abre (ya mientras carga)

// Pone la especie (y su forma): estadísticas base, habilidades posibles, géneros posibles...
// cambiando: si viene de elegir otra especie u otra forma (habilidad y género se ajustan)
async function ponerEspecie(poke, especie, forma, cambiando) {
  const d = await datosEspecie(especie, forma, abierto.juego);
  Object.assign(poke, {
    especie, id: especie, es: nombreEspecie(especie), en: nombreEspecie(especie, 2), forma,
    idForma: d.opcion.idForma, formaPMD: d.opcion.formaPMD || 0, imagenForma: d.opcion.imagenForma,
    stats: d.bases, habilidades: d.habilidades, generoRatio: d.generoRatio, difGenero: d.difGenero,
    felicidad: d.felicidad, ciclos: d.ciclos, aprende: d.aprende
  });
  if (cambiando && poke.habilidades.length) {
    const misma = poke.habilidades.find((h) => h.num === poke.numHabilidad) || poke.habilidades[0];
    poke.habilidad = misma.id;
    poke.numHabilidad = misma.num;
  }
  const posibles = generosPosibles(poke);
  if (!posibles.includes(poke.genero)) poke.genero = posibles[0] || "";
}

// Uno nuevo, como los salvajes: naturaleza e IVs al azar, sin EVs y con los ataques que
// tendría a ese nivel (mientras no se toquen, cambian con la especie)
async function ponerPorDefecto(poke) {
  const nivel = poke.entreno ? poke.entreno.nivel : abierto.nivelInicial;
  if (!poke.entreno) {
    poke.entreno = {
      nivel,
      naturaleza: NATURALEZAS[Math.floor(Math.random() * NATURALEZAS.length)].id,
      evs: [0, 0, 0, 0, 0, 0],
      ivs: Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    };
    poke.genero = generoAlAzar(poke.generoRatio);
    const posibles = generosPosibles(poke);
    if (!posibles.includes(poke.genero)) poke.genero = posibles[0] || "";
  }
  poke.amistad = poke.huevo ? poke.ciclos : poke.felicidad;
  if (poke.ataquesSolos !== false) {
    const ids = ataquesDeNivel(poke.aprende, nivel);
    await Promise.all(ids.map(cargarInfoAtaque));
    poke.ataques = [0, 1, 2, 3].map((i) => (ids[i] ? { id: ids[i], pp: infoAtaques.get(ids[i]).pp, masPP: 0 } : null));
    poke.ataquesSolos = true;
  }
}

// ---------- Pintar ----------

function plantillaGenero(poke) {
  const posibles = generosPosibles(poke);
  if (!posibles.length) return "";
  const genero = poke.genero;
  return `<button class="editor-genero ${genero ? `genero-${genero}` : ""}" ${posibles.length < 2 ? "disabled" : ""}
            title="${genero ? NOMBRE_GENERO[genero] : t("Sin género")}">${genero ? icono(ICONO_GENERO[genero]) : "⚥︎"}</button>`;
}

// Objeto y habilidad: desplegables en los que también se escribe (lo que tiene, escrito; al
// entrar, la lista corta y, escribiendo, todos los que encajan)
function plantillaObjeto(poke) {
  const o = objeto(poke.objeto, abierto.juego);
  return `
    <span class="editor-combo">
      ${o ? imagenConRespaldo(urlsIconoDe(o.id, abierto.juego), `class="editor-icono-objeto" alt="" data-quitar-si-falla`) : ""}
      <span class="editor-buscar"><input class="editor-objeto-campo" type="text" placeholder="${t("Sin objeto")}" autocomplete="off" aria-label="${t("Objeto")}" value="${escaparHTML(o ? nombreDe(o) : "")}"></span>
    </span>`;
}

function plantillaBall(poke) {
  const lista = balls(abierto.juego);
  const suya = lista.find((b) => b.id === poke.ball);
  return `
    <span class="editor-ball" title="Ball">
      ${suya ? imagenConRespaldo(urlsIconoObjeto(suya.en), `class="editor-icono-objeto" alt="" data-quitar-si-falla`) : ""}
      <select class="editor-ball-campo" aria-label="Ball">
        ${suya ? "" : `<option value="${poke.ball}" selected>Ball ${poke.ball}</option>`}
        ${lista.map((b) => `<option value="${b.id}" ${b.id === poke.ball ? "selected" : ""}>${escaparHTML(nombreDe(b))}</option>`).join("")}
      </select>
    </span>`;
}

function plantillaHabilidad(poke) {
  const propia = (poke.habilidades || []).find((h) => h.id === poke.habilidad);
  return `
    <span class="editor-combo">
      <span class="editor-buscar"><input class="editor-habilidad-campo" type="text" placeholder="${t("Habilidad")}" autocomplete="off" aria-label="${t("Habilidad")}" value="${escaparHTML(poke.habilidad ? nombreDe(habilidad(poke.habilidad)) : "")}"></span>
      ${propia && propia.num === 4 ? `<span class="editor-oculta">${t("oculta")}</span>` : ""}
    </span>`;
}

// Al entrar, todo seleccionado (para escribir encima); al salir sin elegir, vuelve lo que había
function comoDesplegable(campo) {
  const habia = campo.value;
  campo.addEventListener("focus", () => campo.select());
  campo.addEventListener("blur", () => (campo.value = habia));
}

function plantillaAtaque(a, i) {
  if (!a) {
    return `<div class="editor-ataque vacio"><span class="editor-buscar"><input class="editor-ataque-campo" data-hueco="${i}" type="search" placeholder="${t("Ataque {n}", { n: i + 1 })}" autocomplete="off"></span></div>`;
  }
  const info = infoAtaques.get(a.id) || {};
  const maximos = info.pp ? ppMaximos(info.pp, a.masPP) : "";
  return `
    <div class="editor-ataque" style="--color:${coloresTipo[info.tipo] || "var(--t-control)"}">
      ${info.tipo ? iconoTipo(info.tipo) : ""}
      <span class="editor-ataque-nombre">${escaparHTML(nombreDe(ataque(a.id)))}</span>
      <span class="editor-ataque-pp">${a.pp}/${maximos}</span>
      <button class="editor-ataque-quitar" data-hueco="${i}" title="${t("Cambiar")}">${icono("aspa")}</button>
    </div>`;
}

// Amistad (o ciclos del huevo) y de dónde viene: dónde se conoció, el juego de origen y el
// entrenador original. Los creados aquí son «de NuzTheLocke» (hasta que se les ponga otro juego).
function plantillaOrigen(poke) {
  const creado = poke.creado && poke.version === "lockedex";
  const versiones = [
    ...(poke.creado ? [{ id: "lockedex", nombre: "NuzTheLocke" }] : []),
    ...(versionesDe(abierto.juego).some((v) => v.id === poke.version) || poke.version === "lockedex" ? [] : [{ id: poke.version, nombre: (VERSIONES.find((v) => v.id === poke.version) || { nombre: t("Juego {n}", { n: poke.version }) }).nombre }]),
    ...versionesDe(abierto.juego)
  ];
  return `
    <div class="editor-origen">
      <label class="editor-dato" title="${poke.huevo ? t("Ciclos que le faltan para eclosionar") : t("Amistad")}">
        ${icono(poke.huevo ? "huevo" : "corazon")}
        ${campoNumero(`<input class="editor-amistad-campo" type="number" min="0" max="255" value="${poke.amistad}" aria-label="${poke.huevo ? t("Ciclos") : t("Amistad")}">`)}
      </label>
      <label class="editor-dato" title="${t("Entrenador original")}">
        ${icono("persona")}
        <input class="editor-entrenador-campo" type="text" maxlength="${abierto.maxEntrenador}" autocomplete="off" placeholder="${t("Entrenador")}" aria-label="${t("Entrenador original")}" value="${escaparHTML(poke.entrenador || "")}">
      </label>
      <span class="editor-dato" title="${poke.huevo ? t("Los huevos aún no tienen dónde se conocieron") : t("Dónde se conoció")}">
        ${icono("mapa")}
        <span class="editor-buscar"><input class="editor-lugar-campo" type="text" autocomplete="off" placeholder="${t("Lugar")}" aria-label="${t("Dónde se conoció")}"
          value="${escaparHTML(poke.huevo ? "" : nombreLugar(poke.lugar, creado, abierto.juego))}" ${poke.huevo ? "disabled" : ""}></span>
      </span>
      <label class="editor-dato" title="${t("Juego de origen")}">
        ${icono("mando")}
        <select class="editor-version-campo" aria-label="${t("Juego de origen")}">
          ${versiones.map((v) => `<option value="${v.id}" ${v.id === poke.version ? "selected" : ""}>${escaparHTML(v.nombre)}</option>`).join("")}
        </select>
      </label>
    </div>`;
}

function campoEspecie(poke) {
  return `<span class="editor-buscar"><input class="editor-especie" type="search" autocomplete="off" placeholder="${t("Especie")}" aria-label="${t("Especie")}" title="${t("Especie")}" value="${escaparHTML(poke.especie ? nombreDe(poke) : "")}"></span>`;
}

function pintar() {
  const poke = abierto.poke;
  const nuevo = !abierto.antes;
  panel.classList.toggle("nuevo", nuevo);

  // Nuevo y sin especie todavía: solo el buscador
  if (!poke.especie) {
    cuerpo.innerHTML = `<div class="editor-solo-especie">${campoEspecie(poke)}</div>`;
    activarCampos();
    cuerpo.querySelector(".editor-especie").focus();
    return;
  }

  const formas = formasDe(poke.especie, abierto.juego);
  if (!formas.some((f) => f.forma === poke.forma)) formas.push({ forma: poke.forma, texto: t("Forma {forma}", { forma: poke.forma }) });

  cuerpo.innerHTML = `
    <div class="editor-cabecera">
      <div class="editor-retrato">
        ${imagenConRespaldo(urlsRetrato(poke), `class="editor-cara" alt=""`)}
        <button class="editor-shiny ${poke.shiny ? "activo" : ""}" title="Shiny">${poke.shiny ? "★" : "☆"}</button>
        ${plantillaGenero(poke)}
      </div>
      <div class="editor-datos">
        <div class="editor-linea">
          ${campoEspecie(poke)}
          ${formas.length > 1
            ? `<select class="editor-forma" aria-label="${t("Forma")}" title="${t("Forma")}">${formas
                .map((f) => `<option value="${f.forma}" ${f.forma === poke.forma ? "selected" : ""}>${escaparHTML(f.texto)}</option>`)
                .join("")}</select>`
            : ""}
          ${poke.huevo
            ? ""
            : `<input class="editor-mote" type="text" maxlength="${abierto.maxMote}" autocomplete="off" placeholder="${t("Mote")}" aria-label="${t("Mote")}" title="${t("Mote")}" value="${escaparHTML(poke.mote)}">`}
        </div>
        <div class="editor-linea">
          <label class="editor-nivel" title="${t("Nivel")}">
            <span>${t("Nv.")}</span>
            ${campoNumero(`<input class="editor-nivel-campo" type="number" min="1" max="100" value="${poke.entreno.nivel}" aria-label="${t("Nivel")}">`)}
          </label>
          <select class="editor-naturaleza" aria-label="${t("Naturaleza")}" title="${t("Naturaleza")}">${opcionesNaturaleza(poke.entreno.naturaleza, true)}</select>
          ${plantillaBall(poke)}
        </div>
      </div>
    </div>

    <div class="editor-par">
      <div class="editor-apartado"><span class="editor-titulo">${t("Objeto")}</span>${plantillaObjeto(poke)}</div>
      <div class="editor-apartado"><span class="editor-titulo">${t("Habilidad")}</span>${plantillaHabilidad(poke)}</div>
    </div>
    <div class="editor-apartado">
      <span class="editor-titulo">${t("Ataques")}</span>
      <div class="editor-ataques">${poke.ataques.map(plantillaAtaque).join("")}</div>
    </div>
    <div class="editor-apartado">
      <span class="editor-titulo">${t("Estadísticas")}</span>
      <div class="editor-estadisticas"></div>
    </div>
    ${plantillaOrigen(poke)}
    <div class="editor-extra">
      <button class="editor-huevo ${poke.huevo ? "activo" : ""}" title="${poke.huevo ? t("Es un huevo (pulsa para que no lo sea)") : t("Convertir en huevo")}" aria-pressed="${poke.huevo}">${icono("huevo")} <span>${poke.huevo ? t("Es un huevo") : t("Convertir en huevo")}</span></button>
    </div>`;
  // EVs e IVs: la ventana de «Crear equipo», aquí dentro (el nivel y la naturaleza, arriba)
  incrustarEntreno(cuerpo.querySelector(".editor-estadisticas"), poke);

  activarCampos();
}

// Los buscadores de lo que se acaba de pintar
function activarCampos() {
  const poke = abierto.poke;
  const juego = abierto.juego;

  activarAutocompletado(cuerpo.querySelector(".editor-especie"), hastaLimite("pokemon", juego), (entrada) => {
    trabajar(async () => {
      const primera = !poke.especie;
      await ponerEspecie(poke, entrada.id, 0, true);
      if (!abierto.antes) await ponerPorDefecto(poke);
      if (primera) panel.querySelector(".editor-guardar").disabled = false;
      pintar();
    });
  }, { icono: iconoPokemon });
  if (!poke.especie) return;

  // Objeto: al entrar, «Sin objeto» (para quitarlo); escribiendo, todos los del juego
  const campoObjeto = cuerpo.querySelector(".editor-objeto-campo");
  const sinObjeto = { id: 0, es: t("Sin objeto"), en: "", buscar: "" };
  comoDesplegable(campoObjeto);
  activarAutocompletado(campoObjeto, objetosDe(juego), (entrada) => {
    poke.objeto = entrada.id;
    pintar();
  }, { icono: (e) => (e.id ? iconoDe(e.id, juego) : ""), actual: campoObjeto.value, sinTexto: () => (poke.objeto ? [sinObjeto] : []) });

  // Habilidad: al entrar, las suyas (la oculta, marcada); escribiendo, cualquiera, las suyas
  // primero. Si es una de las suyas, va en su hueco (la oculta, el 4).
  const campoHabilidad = cuerpo.querySelector(".editor-habilidad-campo");
  const propias = poke.habilidades || [];
  const todas = hastaLimite("habilidades", juego);
  const lista = [
    ...propias.map((h) => todas.find((entrada) => entrada.id === h.id)).filter(Boolean),
    ...todas.filter((entrada) => !propias.some((h) => h.id === entrada.id))
  ];
  comoDesplegable(campoHabilidad);
  activarAutocompletado(campoHabilidad, lista, (entrada) => {
    const propia = propias.find((h) => h.id === entrada.id);
    poke.habilidad = entrada.id;
    if (propia) poke.numHabilidad = propia.num;
    pintar();
  }, {
    actual: campoHabilidad.value,
    sinTexto: () => propias.map((h) => ({ ...h, es: h.num === 4 ? `${nombreDe(h)} (${t("oculta")})` : nombreDe(h), en: "", buscar: "" }))
  });

  // Dónde se conoció: los lugares del juego
  const campoLugar = cuerpo.querySelector(".editor-lugar-campo");
  if (!campoLugar.disabled) {
    comoDesplegable(campoLugar);
    activarAutocompletado(campoLugar, lugaresDe(juego), (entrada) => {
      poke.lugar = entrada.id;
      pintar();
    }, { actual: campoLugar.value });
  }

  for (const campo of cuerpo.querySelectorAll(".editor-ataque-campo")) {
    const i = Number(campo.dataset.hueco);
    activarAutocompletado(campo, hastaLimite("ataques", juego), (entrada) => {
      trabajar(async () => {
        await cargarInfoAtaque(entrada.id);
        poke.ataques[i] = { id: entrada.id, pp: infoAtaques.get(entrada.id).pp, masPP: 0 };
        poke.ataquesSolos = false;
        pintar();
      });
    });
  }
}

// Una tarea que espera a PokeAPI: si falla, se dice abajo
function trabajar(tarea) {
  error.textContent = "";
  tarea().catch((fallo) => {
    console.error(fallo);
    error.textContent = t("No se ha podido cargar. Revisa tu conexión.");
  });
}

// ---------- Ventana o panel de al lado ----------

function ventanaPartida() {
  return lado.closest("dialog");
}

// true si está abierto a la derecha de las cajas
export function editorEnLado() {
  return Boolean(editando) && panel.parentElement === lado && ventanaPartida().classList.contains("con-editor");
}

// El hueco de la derecha se reserva mientras la ventana «Partida» se puede editar (y cabe): así
// las cajas no se mueven al elegir un Pokémon. Sin ninguno elegido, el hueco dice qué hacer.
export function reservarEditor(activo) {
  const reservar = Boolean(activo) && matchMedia(ANCHO_PARA_LADO).matches;
  if (!reservar && editorEnLado()) cerrarEditor();
  ventanaPartida().classList.toggle("con-editor", reservar);
  reposo.hidden = !reservar || (panel.parentElement === lado && !panel.hidden);
}

// El sitio del que se está editando a la derecha (para marcarlo en las cajas), o null
export function sitioEditando() {
  return editando && editorEnLado() ? editando : null;
}

function mostrarPanel() {
  panel.hidden = false;
  if (ventanaPartida().open && ventanaPartida().classList.contains("con-editor")) {
    if (panel.parentElement !== lado) lado.appendChild(panel);
    reposo.hidden = true;
  } else {
    if (panel.parentElement !== dialogo) dialogo.appendChild(panel);
    if (!dialogo.open) dialogo.showModal();
  }
}

export function cerrarEditor() {
  // A la derecha, el panel se esconde (y se vacía) y vuelve el aviso de «elige un Pokémon»; el
  // hueco sigue reservado
  if (panel.parentElement === lado) {
    panel.hidden = true;
    cuerpo.innerHTML = "";
    reposo.hidden = !ventanaPartida().classList.contains("con-editor");
  }
  if (dialogo.open) dialogo.close();
  abierto = null;
  editando = null;
  alCambiarEditando();
}

// Tras aceptar: en su ventana, se cierra; a la derecha, se queda con ese hueco tal y como ha
// quedado (para seguir tocándolo o pulsar otro)
function despuesDeAceptar(sitio) {
  if (editorEnLado()) abrirEditor(abierto.idLocke, sitio, true);
  else cerrarEditor();
}

// Lo cambiado y sin aceptar (al pasar a otro Pokémon a la derecha, se pregunta)
function sinAceptar() {
  return Boolean(abierto && abierto.poke.especie && resumenCambios(abierto.antes, editableDe(abierto.poke)));
}

// ---------- Abrir ----------

// El nivel con el que salen los nuevos: el del más alto del equipo
function nivelInicial(idLocke) {
  const equipo = (partidaGuardada(idLocke) || {}).equipo || [];
  return Math.max(5, ...equipo.filter((p) => !p.huevo).map((p) => p.nivel || 0));
}

// Ya está el nuevo: se quita lo de «atenuado» y, si es otro Pokémon, entra con un fundido corto
// desde arriba del todo
function entrar(recargado) {
  panel.classList.remove("cambiando");
  if (recargado) return;
  cuerpo.scrollTop = 0;
  cuerpo.classList.remove("entra");
  void cuerpo.offsetWidth; // para que la animación vuelva a empezar
  cuerpo.classList.add("entra");
}

// sitio: { equipo } o { caja, hueco }. Si está vacío, es para crear uno. recargar: el mismo
// que ya estaba abierto, tras aceptar (sin el «Cargando...» de en medio).
export async function abrirEditor(idLocke, sitio, recargar = false) {
  if (!recargar && editorEnLado() && sinAceptar() && !(await confirmar(t("Lo que has cambiado sin pulsar «Aceptar» se pierde. ¿Seguir?"), { aceptar: t("Seguir"), peligro: true }))) return;
  // Pasando de un Pokémon a otro a la derecha, el panel no se vacía: se queda el anterior,
  // atenuado, hasta que llega el nuevo (así no hay un «cerrar y abrir» en medio)
  const conPrevio = !recargar && editorEnLado() && Boolean(cuerpo.firstElementChild) && !cuerpo.querySelector(".editor-cargando");
  abierto = null;
  editando = sitio;
  error.textContent = "";
  if (!recargar && !conPrevio) cuerpo.innerHTML = `<p class="editor-cargando">${t("Cargando...")}</p>`;
  panel.classList.toggle("cambiando", conPrevio);
  panel.querySelector(".editor-guardar").disabled = true;
  if (!recargar && !conPrevio) panel.classList.remove("nuevo");
  mostrarPanel();
  alCambiarEditando();

  try {
    const [bytes] = await Promise.all([partidaDeTrabajo(idLocke), prepararDatos()]);
    const formato = formatoDeSeguro(bytes);
    if (!LIMITES[formato.id]) throw new Error(t("Todavía no se puede editar la partida de este juego."));
    const crudo = formato.leerHueco(bytes, sitio);
    const pk = formato.pokemon;
    const base = {
      idLocke, sitio, juego: formato.id, pk, nivelInicial: nivelInicial(idLocke), versionEntrenador: formato.entrenadorDe(bytes).version,
      maxMote: pk.maxMote, maxEntrenador: pk.maxEntrenador
    };

    if (!crudo) {
      // Los creados aquí: conocidos «en NuzTheLocke», del entrenador de la partida
      const poke = { especie: 0, mote: "", shiny: false, objeto: 0, huevo: false, ball: 4, ataques: [null, null, null, null] };
      Object.assign(poke, { lugar: lugarIntercambio(formato.id), version: "lockedex", entrenador: (partidaGuardada(idLocke) || {}).entrenador || "", creado: true });
      abierto = { ...base, llave: 0, antes: null, poke };
      pintar();
      entrar(recargar);
      return;
    }

    const antes = pk.leerEditable(crudo);
    const poke = {
      ...antes,
      evs: undefined,
      ivs: undefined,
      entreno: { nivel: antes.nivel, naturaleza: NATURALEZAS[antes.naturaleza].id, evs: [...antes.evs], ivs: [...antes.ivs] },
      ataques: antes.ataques.map((a) => (a.id ? { ...a } : null))
    };
    abierto = { ...base, llave: llaveDe(crudo), antes, poke };
    poke.creado = creadoEnWeb(idLocke, abierto.llave);
    if (poke.creado && antes.version === base.versionEntrenador) poke.version = "lockedex";
    await Promise.all([ponerEspecie(poke, antes.especie, antes.forma, false), ...antes.ataques.map((a) => cargarInfoAtaque(a.id))]);
    pintar();
    entrar(recargar);
    panel.querySelector(".editor-guardar").disabled = false;
  } catch (fallo) {
    console.error(fallo);
    cuerpo.innerHTML = "";
    panel.classList.remove("cambiando");
    error.textContent = t(fallo.message || "No se ha podido abrir.");
  }
}

// ---------- Guardar ----------

// Lo que se escribe (los nombres de js/partida/pokemon3ds.js y pokemonds.js)
function editableDe(poke) {
  const posibles = generosPosibles(poke);
  return {
    especie: poke.especie,
    forma: poke.forma,
    genero: posibles.includes(poke.genero) ? poke.genero : posibles[0] || "",
    mote: String(poke.mote || "").trim(),
    shiny: poke.shiny,
    huevo: poke.huevo,
    ball: poke.ball,
    objeto: poke.objeto || 0,
    habilidad: poke.habilidad,
    numHabilidad: poke.numHabilidad,
    naturaleza: NATURALEZAS.findIndex((n) => n.id === poke.entreno.naturaleza),
    nivel: poke.entreno.nivel,
    evs: poke.entreno.evs,
    ivs: poke.entreno.ivs,
    amistad: poke.amistad,
    lugar: poke.huevo ? undefined : poke.lugar,
    version: poke.version === "lockedex" ? abierto.versionEntrenador : poke.version,
    entrenador: String(poke.entrenador || "").trim(),
    ataques: poke.ataques.map((a) => (a ? { id: a.id, pp: a.pp, masPP: a.masPP } : { id: 0, pp: 0, masPP: 0 }))
  };
}

// idioma: el del Pokémon (en Rojo Fuego los huevos son japoneses: se usa el de la partida, que es el que tendrá al
// nacer)
function opcionesDe(poke, idioma) {
  return { base: poke.stats, nombreEspecie: nombreEspecie(poke.especie, idioma), nombreHuevo: nombreHuevo(idioma), generoRatio: poke.generoRatio, idioma };
}

const JAPONES = 1;

// La especie ({ es, en }) por su número
function especieDatos(id) {
  return { es: nombreEspecie(id), en: nombreEspecie(id, 2) };
}

// Cómo se llama al preguntar: «Misty» o «Charizard»
function nombreDePokemon(e) {
  return e.huevo ? t("huevo de {pokemon}", { pokemon: nombreDe(especieDatos(e.especie)) }) : e.mote || nombreDe(especieDatos(e.especie));
}

// En la actividad, sin especie ni mote: los demás no tienen por qué saber qué Pokémon tiene
function nombreOculto(e) {
  return e.huevo ? t("un huevo") : t("un Pokémon");
}

// Lo que ha cambiado, para la actividad del locke: «un Pokémon (nivel 36 → 50 · objeto Restos)»
function resumenCambios(antes, despues) {
  if (!antes) return despues.huevo ? t("nuevo huevo") : t("nuevo Pokémon (Nv. {nivel})", { nivel: despues.nivel });
  const partes = [];
  const igual = (uno, otro) => JSON.stringify(uno) === JSON.stringify(otro);
  if (despues.especie !== antes.especie) partes.push(t("otra especie"));
  else if (despues.forma !== antes.forma) partes.push(t("forma"));
  if (despues.huevo !== antes.huevo) partes.push(despues.huevo ? t("ahora es un huevo") : t("ya no es un huevo"));
  if (despues.mote !== antes.mote && !despues.huevo) partes.push(despues.mote ? t("mote") : t("sin mote"));
  if (despues.nivel !== antes.nivel && despues.huevo === antes.huevo) partes.push(t("nivel {antes} → {despues}", { antes: antes.nivel, despues: despues.nivel }));
  if (despues.naturaleza !== antes.naturaleza) partes.push(t("naturaleza {nombre}", { nombre: nombreDe(NATURALEZAS[despues.naturaleza]) }));
  if (despues.objeto !== antes.objeto) partes.push(despues.objeto ? t("objeto {nombre}", { nombre: nombreDe(objeto(despues.objeto, abierto.juego)) }) : t("sin objeto"));
  if (despues.habilidad !== antes.habilidad || despues.numHabilidad !== antes.numHabilidad) partes.push(t("habilidad {nombre}", { nombre: nombreDe(habilidad(despues.habilidad)) }));
  if (despues.shiny !== antes.shiny) partes.push(despues.shiny ? "shiny" : t("ya no es shiny"));
  if (despues.genero !== antes.genero && despues.genero) partes.push(NOMBRE_GENERO[despues.genero].toLowerCase());
  if (despues.amistad !== antes.amistad && despues.huevo === antes.huevo) {
    partes.push(`${despues.huevo ? t("ciclos") : t("amistad")} ${antes.amistad} → ${despues.amistad}`);
  }
  if (despues.ball !== antes.ball) partes.push(nombreDe(balls(abierto.juego).find((b) => b.id === despues.ball) || { es: "ball" }));
  if (despues.lugar !== undefined && despues.lugar !== antes.lugar) partes.push(t("conocido en {lugar}", { lugar: nombreLugar(despues.lugar, false, abierto.juego) }));
  if (despues.version !== antes.version) partes.push(t("origen {juego}", { juego: (VERSIONES.find((v) => v.id === despues.version) || { nombre: t("otro juego") }).nombre }));
  if (despues.entrenador && despues.entrenador !== antes.entrenador) partes.push(t("entrenador «{nombre}»", { nombre: despues.entrenador }));
  const nuevos = despues.ataques.filter((a) => a.id && !antes.ataques.some((b) => b.id === a.id));
  if (nuevos.length) partes.push(t("ataques {nombres}", { nombres: nuevos.map((a) => nombreDe(ataque(a.id))).join(", ") }));
  else if (!igual(despues.ataques.map((a) => a.id), antes.ataques.map((a) => a.id))) partes.push(t("ataques"));
  if (!igual(despues.ivs, antes.ivs)) partes.push("IVs");
  if (!igual(despues.evs, antes.evs)) partes.push("EVs");
  if (!partes.length) return "";
  return `${nombreOculto(antes)} (${partes.join(" · ")})`;
}

async function guardar() {
  const { idLocke, sitio, llave, antes, poke } = abierto;
  const despues = editableDe(poke);
  const resumen = resumenCambios(antes, despues);
  if (!resumen) {
    cerrarEditor();
    return;
  }

  await cambiarHuecos(idLocke, (h) => {
    comprobarSitio(h, sitio, llave);
    const pk = h.formato.pokemon;
    const idioma = antes && !(h.formato.gen === 3 && antes.idioma === JAPONES) ? antes.idioma : h.formato.entrenadorDe(h.bytes).idioma;
    const opciones = opcionesDe(poke, idioma);
    if (antes) {
      const cambiado = pk.aplicarEditable(mirar(h, sitio), despues, opciones);
      poner(h, sitio, cambiado);
      // En DS, cambiar el género, la naturaleza, la habilidad o el shiny cambia el PID, que es
      // su llave: para la web es otro, y no es una captura ni un muerto nuevo
      const nueva = llaveDe(cambiado);
      if (nueva !== llave) {
        const sigueCreado = poke.creado && poke.version === "lockedex";
        return { metidos: [nueva], creados: sigueCreado ? [nueva] : [], noCreados: poke.creado ? [llave] : [] };
      }
      // Creado aquí, pero con otro juego de origen: ya no sale como «NuzTheLocke»
      return poke.creado && poke.version !== "lockedex" ? { noCreados: [llave] } : [];
    }
    const crudo = pk.crearPokemon(h.formato.entrenadorDe(h.bytes), despues, opciones);
    poner(h, sitio, crudo);
    return poke.version === "lockedex" ? { metidos: [llaveDe(crudo)], creados: [llaveDe(crudo)] } : [llaveDe(crudo)];
  }, resumen);
  despuesDeAceptar(sitio);
}

// ---------- Borrar y clonar ----------

async function borrar() {
  const { idLocke, sitio, llave, antes } = abierto;
  if (!(await confirmar(t("¿Borrar a {nombre} de la partida?", { nombre: nombreDePokemon(antes) })))) return;
  await cambiarHuecos(idLocke, (h) => {
    comprobarSitio(h, sitio, llave);
    poner(h, sitio, null);
  }, t("borrado {quien}", { quien: nombreOculto(antes) }));
  cerrarEditor();
}

// La copia va a la primera caja con sitio (desde la suya), con lo que se haya cambiado
async function clonar() {
  const { idLocke, sitio, llave, antes, poke } = abierto;
  const despues = editableDe(poke);
  const cambiado = Boolean(resumenCambios(antes, despues));
  await cambiarHuecos(idLocke, (h) => {
    comprobarSitio(h, sitio, llave);
    const destino = huecoLibre(h, sitio.caja || 0);
    if (!destino) throw new Error(t("Las cajas están llenas."));
    const pk = h.formato.pokemon;
    const crudo = mirar(h, sitio);
    const copia = pk.conLlaveNueva(cambiado ? pk.aplicarEditable(crudo, despues, opcionesDe(poke, antes.idioma)) : crudo);
    poner(h, destino, copia);
    return [llaveDe(copia)];
  }, t("clon de {quien}", { quien: nombreOculto(despues) }));
  despuesDeAceptar(sitio);
}

// Los botones de abajo: mientras trabajan, quietos; si fallan, se dice
function accion(boton, tarea) {
  boton.disabled = true;
  error.textContent = "";
  Promise.resolve()
    .then(tarea)
    .catch((fallo) => {
      console.error(fallo);
      error.textContent = fallo && fallo.name === "AbortError" ? "" : t(fallo.message || "No se ha podido guardar.");
    })
    .finally(() => (boton.disabled = false));
}

// ---------- Arranque ----------

// alCambiarEditandoPokemon(): el que se edita en el panel de al lado ha cambiado (para marcarlo).
export function iniciarEditor(alCambiarEditandoPokemon = () => {}) {
  dialogo = document.querySelector("#dialogo-editor");
  panel = dialogo.querySelector(".editor-panel");
  lado = document.querySelector("#dialogo-partida .partida-lado");
  cuerpo = panel.querySelector(".editor-cuerpo");
  error = panel.querySelector(".editor-error");
  alCambiarEditando = alCambiarEditandoPokemon;

  // Lo que se ve en el hueco de la derecha mientras no hay ningún Pokémon elegido
  reposo = document.createElement("div");
  reposo.className = "editor-reposo";
  reposo.hidden = true;
  reposo.innerHTML = `${icono("lapiz")}<p>${t("Elige un Pokémon de las cajas para editarlo, o un «+» para crear uno nuevo.")}</p>`;
  lado.appendChild(reposo);
  const botones = { borrar: ["papelera", t("Borrar")], clonar: ["copiar", t("Clonar")] };
  for (const [nombre, [dibujo, texto]] of Object.entries(botones)) {
    panel.querySelector(`.editor-${nombre}`).innerHTML = `${icono(dibujo)} <span>${texto}</span>`;
  }

  panel.querySelector(".editor-cancelar").addEventListener("click", cerrarEditor);
  panel.querySelector(".editor-guardar").addEventListener("click", (e) => abierto && abierto.poke.especie && accion(e.currentTarget, guardar));
  panel.querySelector(".editor-borrar").addEventListener("click", (e) => abierto && abierto.antes && accion(e.currentTarget, borrar));
  panel.querySelector(".editor-clonar").addEventListener("click", (e) => abierto && abierto.antes && accion(e.currentTarget, clonar));

  cuerpo.addEventListener("click", (e) => {
    if (!abierto) return;
    const poke = abierto.poke;
    const boton = e.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("editor-shiny")) poke.shiny = !poke.shiny;
    else if (boton.classList.contains("editor-genero")) {
      const posibles = generosPosibles(poke);
      poke.genero = posibles[(posibles.indexOf(poke.genero) + 1) % posibles.length];
    } else if (boton.classList.contains("editor-huevo")) {
      // Al volverse huevo: nivel 1 y, en lugar de la amistad, los ciclos que le faltan
      poke.huevo = !poke.huevo;
      if (poke.huevo) {
        poke.amistadAntes = poke.amistad;
        poke.amistad = poke.ciclos;
        poke.entreno.nivel = 1;
      } else poke.amistad = poke.amistadAntes ?? poke.felicidad;
    } else if (boton.classList.contains("editor-ataque-quitar")) {
      poke.ataques[Number(boton.dataset.hueco)] = null;
      poke.ataquesSolos = false;
    } else return;
    pintar();
    if (boton.classList.contains("editor-ataque-quitar")) cuerpo.querySelector(`.editor-ataque-campo[data-hueco="${boton.dataset.hueco}"]`).focus();
  });

  cuerpo.addEventListener("input", (e) => {
    if (!abierto) return;
    if (e.target.matches(".editor-mote")) abierto.poke.mote = e.target.value;
    else if (e.target.matches(".editor-entrenador-campo")) abierto.poke.entrenador = e.target.value;
    else if (e.target.matches(".editor-amistad-campo") && e.target.value !== "") {
      abierto.poke.amistad = Math.max(0, Math.min(255, Math.floor(Number(e.target.value) || 0)));
    }
  });

  cuerpo.addEventListener("change", (e) => {
    if (!abierto) return;
    const poke = abierto.poke;
    if (e.target.matches(".editor-forma")) {
      trabajar(async () => {
        await ponerEspecie(poke, poke.especie, Number(e.target.value), true);
        if (!abierto.antes) await ponerPorDefecto(poke);
        pintar();
      });
    } else if (e.target.matches(".editor-ball-campo")) {
      poke.ball = Number(e.target.value);
      pintar();
    } else if (e.target.matches(".editor-nivel-campo")) {
      poke.entreno = { ...poke.entreno, nivel: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || poke.entreno.nivel))) };
      // Uno nuevo con los ataques sin tocar: los de su nivel
      if (!abierto.antes && poke.ataquesSolos) trabajar(async () => {
        await ponerPorDefecto(poke);
        pintar();
      });
      else pintar();
    } else if (e.target.matches(".editor-version-campo")) {
      poke.version = e.target.value === "lockedex" ? "lockedex" : Number(e.target.value);
      pintar();
    } else if (e.target.matches(".editor-naturaleza")) {
      poke.entreno = { ...poke.entreno, naturaleza: e.target.value };
      pintar();
    } else if (e.target.matches(".editor-amistad-campo")) e.target.value = poke.amistad;
  });
}
