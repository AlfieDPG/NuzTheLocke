// Sección «Calculadora»: cuánto daño le hace un Pokémon a otro con un ataque.
//
// Tres columnas: el atacante, el ataque y el resultado en el centro, y el defensor. Cada
// Pokémon sale de tus equipos (con su nivel, naturaleza, EVs, IVs, objeto y ataques) o de
// la Pokédex entera (para el rival de un randomlocke, del que solo se sabe qué es). Su nivel,
// naturaleza, EVs e IVs se cambian en la misma tarjeta (los EVs e IVs, en cada fila de
// estadística); lo que se cambie aquí no toca tus equipos.
//
// En el centro, los cuatro huecos de ataques del atacante (los vacíos, para buscar uno) con
// el daño que hace cada uno y, del elegido, el daño en % y en PS, la barra de vida del
// defensor, si lo deja KO (y en cuántos golpes) y quién ataca antes. La fórmula está en
// ./danio.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML, quitarAcentos } from "../comun/utilidades.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { imagenConRespaldo, urlsRetrato, urlsIconoObjeto } from "../comun/imagenes.js";
import { activarAutocompletado, iconoPokemon as iconoSugerencia, iconoObjeto } from "../comun/autocompletado.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { leer } from "../comun/almacen.js";
import { sumarContador } from "../comun/contadores.js";
import { obtenerStats, datosDeGenero, generosPosibles, generoDe, ICONO_GENERO, NOMBRE_GENERO } from "../comun/pokemon.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { formasDeTipoDe } from "../comun/formas.js";
import { leerGuardados } from "../equipos/estado.js";
import {
  statsFinales, entrenoDe, naturaleza, opcionesNaturaleza, STATS, MAX_EV, MAX_EVS, MAX_IV
} from "../equipos/entreno.js";
import { cargarAtaques } from "./ataques.js";
import { calcularDanio, resumenKO, efectoObjeto, textoHabilidad, velocidad, statEnCombate, habilidadAnulada } from "./danio.js";
import { t, LOCALE, enIngles, nombre } from "../comun/idioma.js";
import { etiquetaEnIngles } from "../comun/formas.js";
import { nombreDeFila } from "../pokedex/datos.js";

const vista = document.getElementById("vista-calculadora");
const columnas = {
  atacante: vista.querySelector('.calc-lado[data-lado="atacante"]'),
  defensor: vista.querySelector('.calc-lado[data-lado="defensor"]')
};
const centro = vista.querySelector(".calc-centro");

const HUECOS = 4;

// Sin ninguno marcado, no hay clima
const CLIMAS = [["sol", `☀️ ${t("Sol")}`], ["lluvia", `🌧️ ${t("Lluvia")}`], ["arena", `🏜️ ${t("Arena")}`], ["nieve", `❄️ ${t("Nieve")}`]];

const ESTADOS = [["quemado", `🔥 ${t("Quemado")}`], ["paralizado", `⚡ ${t("Paralizado")}`]];

// { id, idForma, formaPMD, es, mote, tipos, stats (base), entreno, objeto y habilidad
//   ({ id, es, en } o null), habilidades (las que puede tener, de PokeAPI), estado ("" |
//   "quemado" | "paralizado"), etapas: [6], psActual (%),
//   ataques: [4] ({ id, es, tipo, potencia, clase, prioridad, categoria... } o null) }
const lados = { atacante: null, defensor: null };
let elegido = -1;       // el hueco (0..3) del ataque elegido del atacante
const campo = { clima: "", reflejo: false, luz: false, critico: false };

let ataquesConDatos = new Map(); // id -> { tipo, potencia, clase, prioridad } (./ataques.js)
let listaPokemon = [];           // para el buscador: filas de la Pokédex
let listaAtaques = [];           // para los huecos vacíos: solo los que hacen daño

// ---------- Combatientes ----------

function nuevoCombatiente(datosPoke) {
  const c = {
    objeto: null, habilidad: null, habilidades: [], estado: "", etapas: [0, 0, 0, 0, 0, 0], psActual: 100,
    ataques: new Array(HUECOS).fill(null), ...datosPoke
  };
  cargarHabilidades(c);
  if (c.generoRatio === undefined) {
    datosDeGenero(c.id)
      .then((datosGenero) => {
        Object.assign(c, datosGenero);
        if (lados.atacante === c || lados.defensor === c) pintarTodo();
      })
      .catch(() => {});
  }
  return c;
}

// El género, al lado del nombre: pulsando, sin decir -> macho -> hembra. Cuenta para
// Rivalidad; y la hembra de las especies en que se ve distinta sale con su retrato.
function plantillaGenero(c) {
  const posibles = generosPosibles(c);
  if (!posibles.length) return "";
  const genero = generoDe(c);
  const fijo = posibles.length === 1;
  return `<button class="calc-genero ${genero ? `genero-${genero}` : ""}" ${fijo ? "disabled" : ""}
            title="${genero ? NOMBRE_GENERO[genero] : t("Género sin elegir")}">${genero ? icono(ICONO_GENERO[genero]) : "⚥︎"}</button>`;
}

// Las habilidades que puede tener (para elegirlas de un toque); sin ninguna puesta, la primera.
// cambiandoForma: si la que tenía no la puede tener la forma nueva (Mega...), la primera.
async function cargarHabilidades(c, cambiandoForma = false) {
  const forma = c.forma;
  try {
    const p = await pedirJSON(`${URL_API}pokemon/${c.idForma || c.id}`);
    if (c.forma !== forma) return; // mientras llegaba, se ha vuelto a cambiar de forma
    const porId = new Map(datos.habilidades.map((h) => [h.id, h]));
    c.habilidades = [...p.abilities]
      .sort((a, b) => a.slot - b.slot)
      .map((h) => porId.get(Number((h.ability.url.match(/\/(\d+)\/?$/) || [])[1])))
      .filter(Boolean)
      .map((h) => ({ id: h.id, es: h.es, en: h.en }));
    const sigueValiendo = c.habilidad && c.habilidades.some((h) => h.id === c.habilidad.id);
    if ((!c.habilidad || (cambiandoForma && !sigueValiendo)) && c.habilidades.length) c.habilidad = c.habilidades[0];
    if (lados.atacante === c || lados.defensor === c) pintarTodo();
  } catch (error) {
    // sin conexión: se busca a mano
  }
}

// ---------- Formas ----------
//
// Salen de la Pokédex de la web (las filas con el mismo número: Alola, Mega, Rotom Calor...),
// que ya trae sus tipos y estadísticas: cambiar es al momento. Más los tipos de Arceus y
// Silvally, que para la Pokédex son uno solo. Cada forma se apunta como «f:<clave de la
// Pokédex>» o «t:<tipo>».

let formasPorNumero = new Map(); // número -> filas de la Pokédex

function formaNormal(numero) {
  const filas = formasPorNumero.get(numero) || [];
  return filas.find((fila) => fila.normal) || filas[0] || null;
}

// «Charizard (Mega X)» -> «Mega X»
function nombreDeForma(fila) {
  if (fila.normal) return "Normal";
  const dentro = fila.nombre.match(/\((.*)\)$/);
  if (!dentro) return nombreDeFila(fila);
  return enIngles ? etiquetaEnIngles(dentro[1]) : dentro[1];
}

function opcionesDeForma(c) {
  const opciones = (formasPorNumero.get(c.id) || []).map((fila) => ({ valor: `f:${fila.clave}`, texto: nombreDeForma(fila) }));
  const deTipo = formasDeTipoDe(c.id);
  if (deTipo.length) {
    if (opciones[0]) opciones[0].texto = t("Tipo {tipo}", { tipo: tiposEs.normal });
    opciones.push(...deTipo.map((forma) => ({ valor: `t:${forma.tipo}`, texto: t("Tipo {tipo}", { tipo: tiposEs[forma.tipo] }) })));
  }
  return opciones;
}

// La forma que es ahora. Las que la Pokédex junta con otra (iguales en tipos y estadísticas,
// como los colores de Vivillon) cuentan como esa.
function formaActual(c, opciones) {
  if (opciones.some((opcion) => opcion.valor === c.forma)) return c.forma;
  const igual = (formasPorNumero.get(c.id) || []).find(
    (fila) => String(fila.tipos) === String(c.tipos) && String(fila.bases) === String(c.stats)
  );
  return igual ? `f:${igual.clave}` : (opciones[0] || {}).valor;
}

function cambiarDeForma(c, valor) {
  const [tipoDeValor, dato] = [valor.slice(0, 1), valor.slice(2)];
  if (tipoDeValor === "t") {
    const forma = formasDeTipoDe(c.id).find((cada) => cada.tipo === dato);
    const normal = formaNormal(c.id);
    if (!forma || !normal) return;
    Object.assign(c, { formaSlug: undefined, idForma: undefined, formaPMD: forma.pmd, imagenForma: forma.imagenForma, tipos: [forma.tipo], stats: normal.bases });
  } else {
    const fila = (formasPorNumero.get(c.id) || []).find((cada) => String(cada.clave) === dato);
    if (!fila) return;
    Object.assign(c, {
      formaSlug: undefined,
      idForma: fila.clave !== fila.numero ? fila.clave : undefined,
      formaPMD: fila.forma || 0,
      imagenForma: undefined,
      tipos: fila.tipos,
      stats: fila.bases
    });
  }
  c.forma = valor;
  pintarTodo();
  cargarHabilidades(c, true);
}

function plantillaForma(c) {
  const opciones = opcionesDeForma(c);
  if (opciones.length < 2) return "";
  const actual = formaActual(c, opciones);
  return `
    <select class="calc-forma" aria-label="${t("Forma")}">
      ${opciones.map((opcion) => `<option value="${escaparHTML(opcion.valor)}" ${opcion.valor === actual ? "selected" : ""}>${escaparHTML(opcion.texto)}</option>`).join("")}
    </select>`;
}

// Un ataque con lo que necesita la fórmula (si no está, es de estado o de potencia variable)
function conDatos(a) {
  return { id: a.id, es: a.es, en: a.en, tipo: a.tipo, categoria: a.categoria || "", ...(ataquesConDatos.get(a.id) || {}) };
}

// Una fila de la Pokédex (cualquier Pokémon, con o sin forma)
// (con el nombre de la especie: la forma ya la dice su desplegable)
function desdePokedex(fila) {
  return nuevoCombatiente({
    id: fila.numero,
    idForma: fila.clave !== fila.numero ? fila.clave : undefined,
    formaPMD: fila.forma || 0,
    forma: `f:${fila.clave}`,
    es: (formaNormal(fila.numero) || fila).nombre,
    en: nombreDeFila(formaNormal(fila.numero) || fila, "en"),
    tipos: fila.tipos,
    stats: fila.bases
  });
}

// Un Pokémon de tus equipos: con su entreno, su objeto y sus ataques
function desdeEquipo(poke) {
  const combatiente = nuevoCombatiente({
    id: poke.id,
    idForma: poke.imagenForma || poke.idForma === poke.id ? undefined : poke.idForma,
    formaPMD: poke.formaPMD,
    imagenForma: poke.imagenForma,
    forma: poke.imagenForma ? `t:${poke.imagenForma.split("-")[1]}` : `f:${poke.idForma || poke.id}`,
    es: poke.es,
    en: poke.en,
    mote: poke.mote || "",
    genero: generoDe(poke),
    formaSlug: poke.formaSlug,
    ...(poke.generoRatio === undefined ? {} : { generoRatio: poke.generoRatio, difGenero: Boolean(poke.difGenero) }),
    tipos: poke.tipos || [],
    stats: poke.stats || null,
    entreno: poke.entreno ? JSON.parse(JSON.stringify(poke.entreno)) : undefined,
    objeto: poke.objeto ? { id: poke.objeto.id, es: poke.objeto.es, en: poke.objeto.en } : null,
    habilidad: poke.habilidad ? { id: poke.habilidad.id, es: poke.habilidad.es, en: poke.habilidad.en } : null,
    ataques: Array.from({ length: HUECOS }, (_, i) => ((poke.ataques || [])[i] ? conDatos(poke.ataques[i]) : null))
  });
  if (!combatiente.stats) {
    obtenerStats(combatiente)
      .then((stats) => {
        combatiente.stats = stats;
        pintarTodo();
      })
      .catch((error) => console.error(error));
  }
  return combatiente;
}

// Lo que necesita ./danio.js: las estadísticas finales, el nivel...
function paraCalcular(c) {
  return {
    especie: c.id,
    stats: statsFinales(c) || c.stats || [1, 1, 1, 1, 1, 1],
    nivel: entrenoDe(c).nivel,
    tipos: c.tipos,
    etapas: c.etapas,
    objeto: c.objeto,
    habilidad: c.habilidad,
    genero: generoDe(c),
    quemado: c.estado === "quemado",
    paralizado: c.estado === "paralizado",
    ps: c.psActual
  };
}

function nombreDe(c) {
  return c.mote || nombre(c);
}

function ataqueElegido() {
  return (lados.atacante && lados.atacante.ataques[elegido]) || null;
}

// Los equipos para el desplegable: el que estás creando y los de «Mis equipos»
function equiposDisponibles() {
  const actual = leer("poketeams-equipo-v1", []) || [];
  const lista = [];
  if (actual.length) lista.push({ clave: "actual", nombre: t("Equipo que estás creando"), pokemon: actual });
  for (const equipo of leerGuardados()) {
    if ((equipo.pokemon || []).length) lista.push({ clave: equipo.id, nombre: equipo.nombre || t("Equipo"), pokemon: equipo.pokemon });
  }
  return lista;
}

// ---------- Pintar: cada lado ----------

function retrato(c, clase) {
  return imagenConRespaldo(
    urlsRetrato({ id: c.id, idForma: c.idForma, formaPMD: c.formaPMD, genero: generoDe(c), difGenero: c.difGenero }),
    `class="${clase}" alt=""`
  );
}

function chipsTipos(tipos) {
  return (tipos || [])
    .map((t) => `<span class="chip" style="background:${coloresTipo[t]}">${iconoTipo(t)} ${tiposEs[t]}</span>`)
    .join("");
}

// Las subidas y bajadas (−6..+6) de una estadística, con sus botones
function plantillaEtapa(c, i) {
  if (i === 0) return `<span></span>`; // los PS no suben ni bajan
  const etapa = c.etapas[i];
  return `
    <span class="calc-etapa ${etapa > 0 ? "sube" : etapa < 0 ? "baja" : ""}">
      <button class="calc-etapa-menos" data-stat="${i}" ${etapa <= -6 ? "disabled" : ""} aria-label="${t("Bajar {stat}", { stat: STATS[i] })}">${icono("menos")}</button>
      <span class="calc-etapa-valor">${etapa > 0 ? `+${etapa}` : etapa}</span>
      <button class="calc-etapa-mas" data-stat="${i}" ${etapa >= 6 ? "disabled" : ""} aria-label="${t("Subir {stat}", { stat: STATS[i] })}">${icono("mas")}</button>
    </span>`;
}

function plantillaObjeto(c) {
  if (!c.objeto) {
    return `<div class="calc-buscar"><input class="calc-objeto-campo" type="search" placeholder="${t("Objeto...")}" autocomplete="off"></div>`;
  }
  const efecto = efectoObjeto(c.objeto, c.id);
  return `
    <div class="calc-objeto">
      ${imagenConRespaldo(urlsIconoObjeto(c.objeto.en), `class="calc-objeto-icono" alt="" data-quitar-si-falla`)}
      <span class="calc-objeto-nombre">${escaparHTML(nombre(c.objeto))}</span>
      ${efecto ? `<span class="calc-objeto-efecto">${efecto.texto}</span>` : ""}
      <button class="calc-objeto-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
    </div>`;
}

function pintarLado(lado) {
  const c = lados[lado];
  const ficha = columnas[lado].querySelector(".calc-ficha");
  if (!c) {
    ficha.innerHTML = `<p class="calc-vacio">${lado === "atacante" ? t("¿Quién ataca?") : t("¿Quién recibe el golpe?")}</p>`;
    return;
  }

  const entreno = entrenoDe(c);
  const nat = naturaleza(entreno.naturaleza);
  const usados = entreno.evs.reduce((suma, v) => suma + v, 0);
  const finales = statsFinales(c) || [];
  // Las que importan para el ataque elegido, resaltadas
  const ataque = ataqueElegido();
  const fisico = !ataque || ataque.clase !== "especial";
  const importantes = lado === "atacante" ? [fisico ? 1 : 3] : [0, fisico ? 2 : 4];
  // Al defensor, Rompemoldes del atacante le anula la habilidad (para la velocidad no importa,
  // pero así se ve lo mismo que cuenta en el daño)
  const anulada = lado === "defensor" && habilidadAnulada(c, lados.atacante);

  ficha.innerHTML = `
    <div class="calc-poke">
      ${retrato(c, "calc-retrato")}
      <div class="calc-poke-datos">
        <div class="calc-nombre-fila">
          <strong class="calc-nombre">${escaparHTML(nombreDe(c))}</strong>
          ${plantillaGenero(c)}
          ${plantillaForma(c)}
        </div>
        ${c.mote ? `<small>${escaparHTML(nombre(c))}</small>` : ""}
        <div class="calc-tipos">${chipsTipos(c.tipos)}</div>
      </div>
      <button class="calc-poke-quitar" title="${lado === "atacante" ? t("Quitar al atacante") : t("Quitar al defensor")}"
              aria-label="${lado === "atacante" ? t("Quitar al atacante") : t("Quitar al defensor")}">${icono("aspa")}</button>
    </div>
    <div class="calc-entreno-fila">
      <label class="calc-entreno-campo">${t("Nv.")}
        <input class="calc-nivel" type="text" inputmode="numeric" maxlength="3" value="${entreno.nivel}" aria-label="${t("Nivel")}">
      </label>
      <select class="calc-naturaleza" aria-label="${t("Naturaleza")}" title="${escaparHTML(nombre(nat))}">${opcionesNaturaleza(entreno.naturaleza)}</select>
      <span class="calc-evs-usados ${usados >= MAX_EVS ? "lleno" : ""}" title="${t("EVs repartidos")}">${usados}/${MAX_EVS}</span>
    </div>
    <div class="calc-stats">
      <div class="calc-stat calc-stat-cabecera">
        <span></span><span></span><span></span><span>EV</span><span>IV</span><span>${t("Etapa")}</span>
      </div>
      ${STATS.map((nombreStat, i) => {
        // Como está en combate: su etapa, el objeto, la habilidad (si se cumple lo que pide),
        // el clima y la parálisis. Pasando el ratón, de dónde sale.
        let valor = finales[i] ?? null;
        let cambios = [];
        if (valor !== null && i) ({ valor, cambios } = statEnCombate(paraCalcular(c), i, campo, { sinHabilidad: anulada }));
        const cambio = valor === null || valor === finales[i] ? "" : valor > finales[i] ? "sube" : "baja";
        const etapa = i && c.etapas[i] ? [`${t("Etapa")} ${c.etapas[i] > 0 ? "+" : ""}${c.etapas[i]}`] : [];
        const explicacion = cambio ? `${t("Sin cambios: {n}", { n: finales[i] })}\n${[...etapa, ...cambios].join("\n")}` : "";
        return `
          <div class="calc-stat ${importantes.includes(i) ? "importa" : ""} ${cambio}">
            <span class="calc-stat-nombre">${nombreStat}</span>
            <span class="calc-stat-barra"><i style="width:${Math.min(100, ((valor || 0) / 450) * 100)}%"></i></span>
            <strong class="calc-stat-valor" ${explicacion ? `title="${escaparHTML(explicacion)}"` : ""}>${valor ?? "…"}</strong>
            <input class="calc-ev" data-stat="${i}" type="text" inputmode="numeric" maxlength="3" value="${entreno.evs[i]}" aria-label="${t("EVs de {stat}", { stat: nombreStat })}">
            <input class="calc-iv" data-stat="${i}" type="text" inputmode="numeric" maxlength="2" value="${entreno.ivs[i]}" aria-label="${t("IVs de {stat}", { stat: nombreStat })}">
            ${plantillaEtapa(c, i)}
          </div>`;
      }).join("")}
    </div>
    <div class="calc-opciones">
      ${plantillaHabilidad(c)}
      <span class="calc-opciones-titulo">${t("Objeto")}</span>
      ${plantillaObjeto(c)}
      <span class="calc-opciones-titulo">${t("Estado")}</span>
      <div class="calc-chips">
        ${ESTADOS.map(([id, texto]) => `<button class="calc-chip ${c.estado === id ? "activa" : ""}" data-estado="${id}">${texto}</button>`).join("")}
      </div>
      <span class="calc-opciones-titulo">${t("PS ahora")} <strong class="calc-ps-valor">${c.psActual}%</strong></span>
      <input class="calc-ps" type="range" min="1" max="100" value="${c.psActual}" aria-label="${t("PS que le quedan")}">
    </div>`;

  const campoObjeto = ficha.querySelector(".calc-objeto-campo");
  if (campoObjeto) {
    activarAutocompletado(campoObjeto, datos.objetos, (entrada) => {
      c.objeto = { id: entrada.id, es: entrada.es, en: entrada.en };
      pintarTodo();
    }, { icono: iconoObjeto });
  }

  const campoHabilidad = ficha.querySelector(".calc-habilidad-campo");
  if (campoHabilidad) {
    activarAutocompletado(campoHabilidad, datos.habilidades, (entrada) => {
      c.habilidad = { id: entrada.id, es: entrada.es, en: entrada.en };
      buscandoHabilidad = null;
      pintarTodo();
    });
    // Saliendo sin elegir, vuelve el botón «Otra...»
    campoHabilidad.addEventListener("blur", () => {
      setTimeout(() => {
        if (buscandoHabilidad !== c) return;
        buscandoHabilidad = null;
        pintarLado(lado);
      }, 150);
    });
  }
}

// Las que puede tener, de un toque (pulsando la marcada se queda sin habilidad), y «Otra...»
// para buscar cualquiera
let buscandoHabilidad = null; // el combatiente con la casilla de «Otra...» abierta

function plantillaHabilidad(c) {
  const posibles = c.habilidades || [];
  const lista = c.habilidad && !posibles.some((h) => h.id === c.habilidad.id) ? [...posibles, c.habilidad] : posibles;
  const efecto = textoHabilidad(c.habilidad);
  return `
    <span class="calc-opciones-titulo">${t("Habilidad")} ${efecto ? `<span class="calc-efecto">${efecto}</span>` : ""}</span>
    <div class="calc-chips">
      ${lista.map((h) => `<button class="calc-chip ${c.habilidad && c.habilidad.id === h.id ? "activa" : ""}" data-habilidad="${h.id}">${escaparHTML(nombre(h))}</button>`).join("")}
      ${buscandoHabilidad === c
        ? `<span class="calc-buscar calc-habilidad-buscar"><input class="calc-habilidad-campo" type="search" placeholder="${t("Habilidad...")}" autocomplete="off"></span>`
        : `<button class="calc-chip calc-otra">${icono("mas")} ${t("Otra")}</button>`}
    </div>`;
}

// ---------- Pintar: el centro ----------

function textoEfectividad(efectividad) {
  if (efectividad === 0) return t("No le afecta");
  if (efectividad >= 4) return t("Súper eficaz ×4");
  if (efectividad >= 2) return t("Súper eficaz ×2");
  if (efectividad <= 0.25) return t("Muy poco eficaz ×¼");
  if (efectividad < 1) return t("Poco eficaz ×½");
  return t("Neutro");
}

function porcentaje(valor) {
  return valor.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

// Lo que hace un ataque: tiradas, % y PS (null si falta algo)
function resultadoDe(ataque) {
  const atacante = lados.atacante;
  const defensor = lados.defensor;
  if (!atacante || !defensor || !ataque || !ataque.potencia || !atacante.stats || !defensor.stats) return null;
  const a = paraCalcular(atacante);
  const d = paraCalcular(defensor);
  const { tiradas, efectividad, stab, extras } = calcularDanio(a, d, ataque, campo);
  const psMax = d.stats[0];
  const ps = Math.max(1, Math.ceil((psMax * defensor.psActual) / 100));
  return {
    tiradas, efectividad, stab, extras, psMax, ps,
    min: tiradas[0], max: tiradas[tiradas.length - 1],
    minPct: (tiradas[0] / psMax) * 100,
    maxPct: (tiradas[tiradas.length - 1] / psMax) * 100
  };
}

function textoDatosAtaque(a) {
  if (!a.potencia) return a.categoria === "Estado" ? t("Estado") : t("Potencia variable");
  const prioridad = a.prioridad ? ` · ${t("Prioridad")} ${a.prioridad > 0 ? "+" : ""}${a.prioridad}` : "";
  return `${a.clase === "fisico" ? t("Físico") : t("Especial")} · ${a.potencia}${prioridad}`;
}

function plantillaHueco(a, i) {
  if (!a) {
    return `
      <div class="calc-hueco vacio calc-buscar">
        <input class="calc-hueco-campo" data-hueco="${i}" type="search" placeholder="${t("Ataque {n}", { n: i + 1 })}" autocomplete="off"
               ${lados.atacante ? "" : "disabled"}>
      </div>`;
  }
  const r = a.potencia ? resultadoDe(a) : null;
  const dano = r ? (r.efectividad === 0 ? "—" : `${porcentaje(r.minPct)}–${porcentaje(r.maxPct)}%`) : "";
  return `
    <div class="calc-hueco">
      <button class="calc-ataque ${i === elegido ? "elegido" : ""}" data-hueco="${i}" style="--color:${coloresTipo[a.tipo] || "var(--t-control)"}"
              ${a.potencia ? "" : "disabled"}>
        <span class="calc-ataque-nombre">${iconoTipo(a.tipo)} ${escaparHTML(nombre(a))}</span>
        <span class="calc-ataque-datos">${textoDatosAtaque(a)}</span>
        <span class="calc-ataque-dano">${dano}</span>
      </button>
      <button class="calc-hueco-quitar" data-hueco="${i}" title="${t("Cambiar")}">${icono("aspa")}</button>
    </div>`;
}

function veredicto(r) {
  if (r.efectividad === 0) return { clase: "nada", texto: t("No le afecta") };
  const banda = lados.defensor.psActual === 100 && efectoObjeto(lados.defensor.objeto, lados.defensor.id)?.banda;
  const ko = resumenKO(r.tiradas, r.ps, banda);
  const salva = ko.banda ? ` ${t("(le salva la Banda Focus)")}` : "";
  if (!ko.golpes) return { clase: "lejos", texto: `${t("Necesita más de 4 golpes")}${salva}` };
  const golpes = ko.golpes === 1 ? t("de un golpe") : t("en {n} golpes", { n: ko.golpes });
  if (ko.seguro) return { clase: ko.golpes === 1 ? "ko" : "seguro", texto: `${t("KO {golpes}", { golpes })}${salva}` };
  return { clase: "posible", texto: `${t("Puede caer {golpes} ({n}%)", { golpes, n: porcentaje(ko.probabilidad * 100) })}${salva}` };
}

// Quién ataca antes: por la prioridad del ataque o, si no tiene, por la velocidad
function quienAntes(ataque) {
  const atacante = lados.atacante;
  const defensor = lados.defensor;
  if (ataque.prioridad > 0) return { clase: "antes", texto: t("Ataca antes {nombre} (prioridad +{n})", { nombre: nombreDe(atacante), n: ataque.prioridad }) };
  if (ataque.prioridad < 0) return { clase: "despues", texto: t("Ataca después {nombre} (prioridad {n})", { nombre: nombreDe(atacante), n: ataque.prioridad }) };
  const va = velocidad(paraCalcular(atacante), campo);
  const vd = velocidad(paraCalcular(defensor), campo);
  if (va > vd) return { clase: "antes", texto: t("Ataca antes {nombre} (Vel. {a} contra {b})", { nombre: nombreDe(atacante), a: va, b: vd }) };
  if (va < vd) return { clase: "despues", texto: t("Ataca antes {nombre} (Vel. {a} contra {b})", { nombre: nombreDe(defensor), a: vd, b: va }) };
  return { clase: "empate", texto: t("Empate de velocidad ({n}): 50% cada uno", { n: va }) };
}

// Para los logros: cada cálculo distinto (otro atacante, otro defensor u otro ataque) cuenta
// una vez; mover la barra de PS o tocar las etapas, no
const calculados = new Set();

function contarCalculo(ataque) {
  const forma = (c) => c.idForma || c.id;
  const clave = `${forma(lados.atacante)}|${forma(lados.defensor)}|${ataque.id}`;
  if (calculados.has(clave)) return;
  calculados.add(clave);
  sumarContador("calculos");
}

function pintarCentro() {
  const atacante = lados.atacante;
  const huecos = centro.querySelector(".calc-ataques");
  huecos.innerHTML = (atacante ? atacante.ataques : new Array(HUECOS).fill(null)).map(plantillaHueco).join("");
  for (const campoHueco of huecos.querySelectorAll(".calc-hueco-campo:not(:disabled)")) {
    const i = Number(campoHueco.dataset.hueco);
    activarAutocompletado(campoHueco, listaAtaques, (entrada) => {
      atacante.ataques[i] = conDatos(entrada);
      elegido = i;
      pintarTodo();
    });
  }

  centro.querySelector(".calc-campo").innerHTML = `
    <button class="calc-chip ${campo.critico ? "activa" : ""}" data-campo="critico">${icono("rayo")} ${t("Crítico")}</button>
    <button class="calc-chip ${campo.reflejo ? "activa" : ""}" data-campo="reflejo" title="${t("Ataques físicos ×½")}">${icono("escudo")} ${t("Reflejo")}</button>
    <button class="calc-chip ${campo.luz ? "activa" : ""}" data-campo="luz" title="${t("Ataques especiales ×½")}">${icono("escudo")} ${t("Pantalla de luz")}</button>
    <span class="calc-separador"></span>
    <span class="calc-climas">
      ${CLIMAS.map(([id, texto]) => `<button class="calc-chip ${campo.clima === id ? "activa" : ""}" data-clima="${id}">${texto}</button>`).join("")}
    </span>`;

  const caja = centro.querySelector(".calc-resultado");
  const ataque = ataqueElegido();
  const r = resultadoDe(ataque);
  if (!r) {
    caja.innerHTML = `<p class="calc-vacio">${!atacante || !lados.defensor ? t("Elige los dos Pokémon y aquí sale el daño.") : t("Elige un ataque y aquí sale el daño.")}</p>`;
    caja.className = "calc-resultado vacio";
    return;
  }
  contarCalculo(ataque);

  const v = veredicto(r);
  const antes = quienAntes(ataque);
  // La barra de vida del defensor, que se vacía de izquierda a derecha: lo que ya había
  // perdido (gris), lo que pierde seguro (rojo), lo que puede perder según la tirada
  // (rayado) y lo que le queda seguro (verde)
  const actual = lados.defensor.psActual;
  const quedaSeguro = Math.max(0, actual - r.maxPct);
  const quedaComoMucho = Math.max(0, actual - r.minPct);
  caja.className = `calc-resultado ${v.clase}`;
  caja.innerHTML = `
    <div class="calc-porcentaje">${r.efectividad === 0 ? "0%" : `${porcentaje(r.minPct)} – ${porcentaje(r.maxPct)}%`}</div>
    <div class="calc-ps-texto">${t("{min} – {max} PS de {total}", { min: r.min, max: r.max, total: r.psMax })}${actual < 100 ? ` ${t("(le quedan {n})", { n: r.ps })}` : ""}</div>
    <div class="calc-barra" title="${t("Vida de {nombre}", { nombre: escaparHTML(nombreDe(lados.defensor)) })}">
      <i class="perdida" style="width:${100 - actual}%"></i>
      <i class="pierde" style="width:${actual - quedaComoMucho}%"></i>
      <i class="quiza" style="width:${quedaComoMucho - quedaSeguro}%"></i>
      <i class="queda" style="width:${quedaSeguro}%"></i>
    </div>
    <div class="calc-veredicto">${v.texto}</div>
    <div class="calc-etiquetas">
      <span class="calc-etiqueta calc-velocidad ${antes.clase}">${icono("rayo")} ${escaparHTML(antes.texto)}</span>
      <span class="calc-etiqueta">${textoEfectividad(r.efectividad)}</span>
      ${r.stab ? `<span class="calc-etiqueta">${t("STAB ×1,5")}</span>` : ""}
      ${campo.critico ? `<span class="calc-etiqueta">${t("Crítico ×1,5")}</span>` : ""}
      ${r.extras.map((texto) => `<span class="calc-etiqueta">${escaparHTML(texto)}</span>`).join("")}
    </div>`;
}

function pintarTodo() {
  pintarLado("atacante");
  pintarLado("defensor");
  pintarCentro();
}

// ---------- Elegir ----------

// «De mis equipos…»: un desplegable propio (el del navegador no deja plegar los grupos). Al
// abrirlo salen solo los equipos, cada uno con sus Pokémon en pequeño para reconocerlo; al
// pulsar uno se despliegan sus Pokémon, y al pulsar un Pokémon entra.

// El retrato de Mundo Misterioso (como en el resto de la web); si no lo tiene, su sprite
function iconoPokemon(p) {
  const urls = urlsRetrato(p);
  return imagenConRespaldo(urls, `class="calc-equipo-icono" alt="" loading="lazy" data-quitar-si-falla`);
}

function pintarEquipos() {
  const equipos = equiposDisponibles();
  for (const lado of ["atacante", "defensor"]) {
    const caja = columnas[lado].querySelector(".calc-equipos");
    const abiertos = new Set([...caja.querySelectorAll(".calc-equipo.abierto")].map((el) => el.dataset.clave));
    caja.querySelector(".calc-equipos-boton").disabled = !equipos.length;
    caja.querySelector(".calc-equipos-panel").innerHTML = equipos
      .map(
        (equipo) => `
          <div class="calc-equipo ${abiertos.has(String(equipo.clave)) ? "abierto" : ""}" data-clave="${escaparHTML(equipo.clave)}">
            <button type="button" class="calc-equipo-nombre">
              <span class="calc-equipo-flecha">${icono("abajo")}</span>
              <span class="calc-equipo-titulo">${escaparHTML(equipo.nombre)}</span>
              <span class="calc-equipo-iconos">${equipo.pokemon.map(iconoPokemon).join("")}</span>
            </button>
            <div class="calc-equipo-pokemon">
              ${equipo.pokemon
                .map(
                  (p, i) => `
                    <button type="button" class="calc-equipo-poke" data-valor="${escaparHTML(equipo.clave)}|${i}">
                      ${iconoPokemon(p)}
                      <span>${escaparHTML(p.mote || nombre(p))}</span>
                      ${p.mote ? `<small>${escaparHTML(nombre(p))}</small>` : ""}
                    </button>`
                )
                .join("")}
            </div>
          </div>`
      )
      .join("");
  }
}

function cerrarEquipos(menos = null) {
  for (const caja of vista.querySelectorAll(".calc-equipos.abierto")) {
    if (caja === menos) continue;
    caja.classList.remove("abierto");
    caja.querySelector(".calc-equipos-boton").setAttribute("aria-expanded", "false");
  }
}

function prepararEquipos(lado) {
  const caja = columnas[lado].querySelector(".calc-equipos");
  caja.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("calc-equipos-boton")) {
      const abrir = !caja.classList.contains("abierto");
      cerrarEquipos();
      caja.classList.toggle("abierto", abrir);
      boton.setAttribute("aria-expanded", String(abrir));
      // Con un solo equipo, ya desplegado
      const equipos = caja.querySelectorAll(".calc-equipo");
      if (abrir && equipos.length === 1) equipos[0].classList.add("abierto");
    } else if (boton.classList.contains("calc-equipo-nombre")) {
      boton.closest(".calc-equipo").classList.toggle("abierto");
    } else if (boton.dataset.valor) {
      cerrarEquipos();
      elegirDeEquipo(lado, boton.dataset.valor);
    }
  });
}

// Se cierra pulsando fuera o con Escape
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".calc-equipos")) cerrarEquipos();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarEquipos();
});

// Al poner un atacante nuevo, el ataque pasa a ser el primero suyo que haga daño
function ponerAtacante(c) {
  lados.atacante = c;
  elegido = c ? c.ataques.findIndex((a) => a && a.potencia) : -1;
  pintarTodo();
}

function ponerEnLado(lado, c) {
  if (lado === "atacante") ponerAtacante(c);
  else {
    lados.defensor = c;
    pintarTodo();
  }
}

function elegirDeEquipo(lado, valor) {
  const [clave, indice] = valor.split("|");
  const equipo = equiposDisponibles().find((cada) => String(cada.clave) === clave);
  const poke = equipo && equipo.pokemon[Number(indice)];
  if (poke) ponerEnLado(lado, desdeEquipo(poke));
}

function elegirDePokedex(lado, entrada) {
  const c = desdePokedex(entrada.fila);
  // Al mismo nivel que el otro, que es lo normal al comparar
  const otro = lados[lado === "atacante" ? "defensor" : "atacante"];
  if (otro && otro.entreno && otro.entreno.nivel) c.entreno = { nivel: otro.entreno.nivel };
  ponerEnLado(lado, c);
}

// ---------- Arranque ----------

function prepararColumna(lado) {
  const columna = columnas[lado];
  columna.innerHTML = `
    <div class="calc-rol">${icono(lado === "atacante" ? "espadas" : "escudo")} ${lado === "atacante" ? t("Atacante") : t("Defensor")}</div>
    <div class="calc-elegir">
      <div class="calc-buscar"><input class="calc-buscar-campo" type="search" placeholder="${t("Buscar Pokémon...")}" autocomplete="off"></div>
      <div class="calc-equipos">
        <button type="button" class="calc-equipos-boton" aria-expanded="false">
          <span>${t("De mis equipos…")}</span>${icono("abajo")}
        </button>
        <div class="calc-equipos-panel"></div>
      </div>
    </div>
    <div class="calc-ficha"></div>`;

  const buscar = columna.querySelector(".calc-buscar-campo");
  activarAutocompletado(buscar, listaPokemon, (entrada) => {
    buscar.value = "";
    elegirDePokedex(lado, entrada);
  }, { icono: iconoSugerencia });
  prepararEquipos(lado);

  columna.addEventListener("click", (e) => {
    const c = lados[lado];
    if (!c) return;
    const boton = e.target.closest("button");
    if (!boton) return;
    // Dejar el lado vacío: sin atacante (y sin ataque elegido) o sin defensor
    if (boton.classList.contains("calc-poke-quitar")) {
      buscandoHabilidad = null;
      ponerEnLado(lado, null);
      return;
    }
    if (boton.classList.contains("calc-genero")) {
      const orden = ["", ...generosPosibles(c)];
      c.genero = orden[(orden.indexOf(generoDe(c)) + 1) % orden.length];
      pintarTodo();
      return;
    }
    const i = Number(boton.dataset.stat);
    if (boton.classList.contains("calc-etapa-mas")) c.etapas[i] = Math.min(6, c.etapas[i] + 1);
    else if (boton.classList.contains("calc-etapa-menos")) c.etapas[i] = Math.max(-6, c.etapas[i] - 1);
    else if (boton.classList.contains("calc-objeto-quitar")) c.objeto = null;
    else if (boton.dataset.estado) c.estado = c.estado === boton.dataset.estado ? "" : boton.dataset.estado;
    else if (boton.dataset.habilidad) {
      const id = Number(boton.dataset.habilidad);
      c.habilidad = c.habilidad && c.habilidad.id === id ? null : [...c.habilidades, c.habilidad].find((h) => h && h.id === id);
    } else if (boton.classList.contains("calc-otra")) {
      buscandoHabilidad = c;
      pintarLado(lado);
      columna.querySelector(".calc-habilidad-campo").focus();
      return;
    } else return;
    pintarTodo();
    // Tras quitar el objeto, a escribir el nuevo
    if (boton.classList.contains("calc-objeto-quitar")) columna.querySelector(".calc-objeto-campo")?.focus();
  });

  // Los PS de ahora: al arrastrar solo cambia el resultado (para no perder la barra)
  columna.addEventListener("change", (e) => {
    if (e.target.matches(".calc-forma") && lados[lado]) cambiarDeForma(lados[lado], e.target.value);
    if (e.target.matches(".calc-naturaleza") && lados[lado]) {
      cambiarEntreno(lados[lado], (entreno) => (entreno.naturaleza = e.target.value));
      pintarTodo();
    }
  });

  columna.addEventListener("input", (e) => {
    const c = lados[lado];
    if (!c) return;
    if (e.target.matches(".calc-ev, .calc-iv, .calc-nivel")) {
      cambiarCifra(c, e.target);
      repintarSinPerderLaCasilla(columna, e.target);
      return;
    }
    if (!e.target.matches(".calc-ps")) return;
    c.psActual = Number(e.target.value);
    columna.querySelector(".calc-ps-valor").textContent = `${c.psActual}%`;
    pintarCentro();
  });

  // Flechas del teclado en las casillas de nivel, EVs e IVs (los EVs, de 4 en 4)
  columna.addEventListener("keydown", (e) => {
    if (!e.target.matches(".calc-ev, .calc-iv, .calc-nivel") || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const salto = (e.target.matches(".calc-ev") ? 4 : 1) * (e.key === "ArrowUp" ? 1 : -1);
    e.target.value = Math.max(0, (Number(e.target.value) || 0) + salto);
    e.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// ---------- Nivel, naturaleza, EVs e IVs (en la tarjeta) ----------

function cambiarEntreno(c, hacer) {
  const entreno = entrenoDe(c);
  hacer(entreno);
  c.entreno = entreno;
}

// Lo escrito en una casilla, dentro de sus límites (los EVs, sin pasar de 510 entre todas)
function cambiarCifra(c, campo) {
  if (campo.value.trim() === "") return;
  const pedido = Math.max(0, Math.floor(Number(campo.value.replace(/\D/g, "")) || 0));
  cambiarEntreno(c, (entreno) => {
    if (campo.matches(".calc-nivel")) entreno.nivel = Math.max(1, Math.min(100, pedido));
    else if (campo.matches(".calc-iv")) entreno.ivs[Number(campo.dataset.stat)] = Math.min(MAX_IV, pedido);
    else {
      const i = Number(campo.dataset.stat);
      const otros = entreno.evs.reduce((suma, v, j) => (j === i ? suma : suma + v), 0);
      entreno.evs[i] = Math.min(pedido, MAX_EV, MAX_EVS - otros);
    }
  });
}

// Se repinta todo (las estadísticas y el daño cambian) y se vuelve a la misma casilla, con el
// cursor al final, para seguir escribiendo
function repintarSinPerderLaCasilla(columna, campo) {
  const clase = [".calc-ev", ".calc-iv", ".calc-nivel"].find((cada) => campo.matches(cada));
  const selector = campo.dataset.stat !== undefined ? `${clase}[data-stat="${campo.dataset.stat}"]` : clase;
  const vacio = campo.value.trim() === "";
  pintarTodo();
  const nuevo = columna.querySelector(selector);
  if (!nuevo) return;
  if (vacio) nuevo.value = "";
  nuevo.focus();
  nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
}

export async function iniciar() {
  centro.innerHTML = `<p class="calc-vacio">${t("Cargando...")}</p>`;
  const [pokedex, conDatosCargados] = await Promise.all([cargarPokedex(), cargarAtaques(), cargarDatos()]);
  ataquesConDatos = conDatosCargados;
  listaPokemon = pokedex.map((fila) => {
    const en = nombreDeFila(fila, "en");
    return { es: fila.nombre, en, buscar: quitarAcentos(`${fila.nombre} ${en} ${fila.numero}`), fila };
  });
  listaAtaques = datos.ataques.filter((a) => ataquesConDatos.has(a.id));
  formasPorNumero = new Map();
  for (const fila of pokedex) {
    if (!formasPorNumero.has(fila.numero)) formasPorNumero.set(fila.numero, []);
    formasPorNumero.get(fila.numero).push(fila);
  }

  prepararColumna("atacante");
  prepararColumna("defensor");

  centro.innerHTML = `
    <div class="calc-ataques"></div>
    <div class="calc-campo"></div>
    <div class="calc-resultado"></div>
    <button class="calc-intercambiar" title="${t("Que ataque el otro")}">${icono("intercambiar")} ${t("Intercambiar")}</button>`;

  centro.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("calc-ataque")) elegido = Number(boton.dataset.hueco);
    else if (boton.classList.contains("calc-hueco-quitar")) {
      const i = Number(boton.dataset.hueco);
      lados.atacante.ataques[i] = null;
      if (elegido === i) elegido = lados.atacante.ataques.findIndex((a) => a && a.potencia);
      pintarTodo();
      centro.querySelector(`.calc-hueco-campo[data-hueco="${i}"]`)?.focus();
      return;
    } else if (boton.dataset.campo) campo[boton.dataset.campo] = !campo[boton.dataset.campo];
    else if (boton.dataset.clima) campo.clima = campo.clima === boton.dataset.clima ? "" : boton.dataset.clima;
    else if (boton.classList.contains("calc-intercambiar")) {
      const defensor = lados.defensor;
      lados.defensor = lados.atacante;
      ponerAtacante(defensor);
      return;
    } else return;
    pintarTodo();
  });

  // Para empezar, de atacante el primero del equipo que estás creando (si hay)
  const actual = leer("poketeams-equipo-v1", []) || [];
  pintarEquipos();
  ponerAtacante(actual.length ? desdeEquipo(actual[0]) : null);
}

export function mostrar() {
  // Los equipos pueden haber cambiado desde la última vez
  if (columnas.atacante.querySelector(".calc-equipos")) pintarEquipos();
}
