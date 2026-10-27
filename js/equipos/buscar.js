// Ventana «Buscar equipo» (botón de «Crear equipo»): los mejores equipos con los Pokémon vivos
// de la caja de uno de tus lockes (./caja.js). A la izquierda, la caja: pulsando un Pokémon se
// ve su ficha en el panel de la derecha (ataques, habilidad, objeto, estadísticas y el porqué
// de su nota), y con los dos botoncitos de sus esquinas se deja fuera de la búsqueda o se fija
// (irá seguro). El resto lo elige buscarEquipos (./analisis.js). Cada equipo propuesto se puede ver
// analizado (con «Para mejorarlo») o pasar a «Crear equipo» con sus ataques, habilidad,
// objeto, naturaleza, EVs e IVs.
//
// Lo de la partida (y lo de leerla) se carga solo al abrir la ventana: pesa bastante.

import { reemplazarEquipo, hayCambiosSinGuardar } from "./estado.js";
import { analizarPokemon, buscarEquipos, palabraNota } from "./analisis.js";
import { cargarContexto, mostrarAnalisis, colorNota, recordarMochila } from "./analizar.js";
import { STATS, NATURALEZAS, entrenoDe, statsFinales } from "./entreno.js";
import { misLockes } from "../comun/lockes.js";
import { leer, escribir } from "../comun/almacen.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { icono } from "../comun/iconos.js";
import { imagenConRespaldo, urlsRetrato, urlsIconoObjeto } from "../comun/imagenes.js";
import { escaparHTML } from "../comun/tooltip.js";
import { confirmar, avisar } from "../comun/ventanas.js";
import { t, nombre } from "../comun/idioma.js";

// El último locke elegido, para la próxima vez
const CLAVE_LOCKE = "poketeams-buscar-locke-v1";
const MAX_FIJOS = 6;

const dialogo = document.getElementById("dialogo-buscar-equipo");
const cuerpo = dialogo.querySelector(".buscar-cuerpo");

// Lo que se enseña: { locke, lockes, candidatos (analizados, de más a menos nota), conDetalle,
// hayArchivo (vinculado pero sin permiso), mochila, contexto (el del análisis),
// estados: Map(candidato -> "fijo" | "fuera"), elegido (el de la ficha de la derecha),
// resultados: [{ miembros, nota }] | null }
let actual = null;
let alUsar = () => {};

const nombreDe = (poke) => poke.mote || nombre(poke);

function mensaje(texto) {
  dialogo.classList.remove("con-caja");
  cuerpo.innerHTML = `<p class="analisis-mensaje">${texto}</p>`;
}

// Tus lockes con la partida leída alguna vez (en este navegador o, con sesión, en tu cuenta)
async function lockesConPartida() {
  const { partidaDe } = await import("../partida/partidas.js");
  return misLockes().filter((locke) => partidaDe(locke.id));
}

async function abrir() {
  dialogo.showModal();
  mensaje(t("Cargando tus lockes..."));
  try {
    const lockes = await lockesConPartida();
    if (!lockes.length) {
      actual = null;
      mensaje(t("Para buscar equipo hace falta la partida de un locke: en «Lockes», abre tu bloque y vincula el archivo de guardado (en Chrome o Edge) o léelo una vez."));
      return;
    }
    const guardado = leer(CLAVE_LOCKE, "");
    const locke = lockes.find((l) => l.id === guardado) || lockes[0];
    await cargarLocke(locke, lockes);
  } catch (error) {
    console.error(error);
    mensaje(t("No he podido leer la caja. Vuelve a probar en un momento."));
  }
}

// Lee la caja de un locke y analiza a todos. pedir: pedir permiso para leer el archivo (con un clic)
async function cargarLocke(locke, lockes, pedir = false) {
  escribir(CLAVE_LOCKE, locke.id);
  mensaje(t("Leyendo la caja de «{locke}»...", { locke: escaparHTML(locke.nombre) }));
  const [{ leerVinculado, hayVinculo }, { cajaDeLaPartida }] = await Promise.all([
    import("../partida/vinculo.js"),
    import("./caja.js")
  ]);
  const bytes = await leerVinculado(locke.id, pedir).catch(() => null);
  let caja;
  try {
    caja = await cajaDeLaPartida(locke.id, bytes);
  } catch (error) {
    console.error(error); // el emulador a mitad de guardar, por ejemplo: con lo guardado
    caja = await cajaDeLaPartida(locke.id, null);
  }
  const contexto = await cargarContexto();
  actual = {
    locke,
    lockes,
    candidatos: caja.pokemon.map((p) => analizarPokemon(p, contexto)).sort((a, b) => b.nota - a.nota),
    conDetalle: caja.conDetalle,
    hayArchivo: !caja.conDetalle && (await hayVinculo(locke.id)),
    mochila: caja.mochila,
    contexto,
    estados: new Map(),
    elegido: null,
    resultados: null
  };
  pintar();
}

// ---------- La caja (a la izquierda) ----------

function textoFuente() {
  if (actual.conDetalle) return t("Leída del archivo de la partida: con habilidades, ataques, objetos, naturalezas, EVs e IVs.");
  if (actual.hayArchivo) {
    return `${t("Sin permiso para leer el archivo: del equipo se sabe todo, pero de las cajas solo la especie y el nivel.")}
      <button type="button" class="boton-gris buscar-leer">${icono("refrescar")} ${t("Leer el archivo")}</button>`;
  }
  return t("Sin el archivo de la partida en este navegador: del equipo se sabe todo, pero de las cajas solo la especie y el nivel. Para más, vincula la partida en tu bloque del locke (Chrome o Edge).");
}

// Un Pokémon de la caja: lo que se pulsa para ver su ficha y, en las esquinas de arriba,
// dejarlo fuera (izquierda) y fijarlo (derecha)
function ficha(m, i) {
  const p = m.poke;
  const marca = actual.estados.get(m) || "";
  const nivel = t("Nv. {nivel}", { nivel: p.entreno.nivel });
  return `
    <li class="buscar-ficha ${marca} ${m === actual.elegido ? "elegida" : ""}">
      <button type="button" class="buscar-ficha-ver" data-ficha="${i}" title="${escaparHTML(t("{nombre}: ver su ficha", { nombre: nombreDe(p) }))}">
        ${imagenConRespaldo(urlsRetrato(p), `class="buscar-retrato" alt="" draggable="false"`)}
        <span class="buscar-ficha-nombre">${escaparHTML(nombreDe(p))}</span>
        <span class="buscar-ficha-datos">${nivel} · <b style="color:${colorNota(m.nota)}">${Math.round(m.nota)}</b></span>
      </button>
      <button type="button" class="buscar-dejar ${marca === "fuera" ? "activo" : ""}" data-fuera="${i}" aria-pressed="${marca === "fuera"}"
        title="${marca === "fuera" ? t("Fuera de la búsqueda (pulsa para que vuelva a contar)") : t("Dejarlo fuera de la búsqueda")}">${icono("aspa")}</button>
      <button type="button" class="buscar-fijar ${marca === "fijo" ? "activo" : ""}" data-fijar="${i}" aria-pressed="${marca === "fijo"}"
        title="${marca === "fijo" ? t("Fijo: irá seguro en el equipo (pulsa para quitarlo)") : t("Fijarlo: irá seguro en el equipo")}">${icono("candado")}</button>
    </li>`;
}

// Uno de un equipo propuesto: también abre su ficha
function miniatura(m, fijos) {
  const i = actual.candidatos.indexOf(m);
  return `
    <li>
      <button type="button" class="buscar-mini ${m === actual.elegido ? "elegida" : ""}" data-ficha="${i}"
        title="${escaparHTML(t("{nombre}: ver su ficha", { nombre: nombreDe(m.poke) }))}">
        ${imagenConRespaldo(urlsRetrato(m.poke), `class="buscar-retrato" alt="" draggable="false"`)}
        <span class="buscar-ficha-nombre">${escaparHTML(nombreDe(m.poke))}</span>
        <span class="buscar-ficha-datos">${t("Nv. {nivel}", { nivel: m.poke.entreno.nivel })}</span>
        ${fijos.has(m) ? `<span class="buscar-marca">${icono("candado")}</span>` : ""}
      </button>
    </li>`;
}

function propuesta(r, i) {
  const fijos = new Set([...actual.estados].filter(([, e]) => e === "fijo").map(([m]) => m));
  return `
    <li class="buscar-propuesta">
      <div class="analisis-nota">
        <span class="analisis-nota-numero" style="color:${colorNota(r.nota)}">${Math.round(r.nota)}</span>
        <span class="analisis-nota-palabra">${palabraNota(r.nota)}</span>
      </div>
      <ul class="buscar-propuesta-pokemon">${r.miembros.map((m) => miniatura(m, fijos)).join("")}</ul>
      <div class="buscar-propuesta-botones">
        <button type="button" class="boton-gris" data-ver="${i}">${icono("estadisticas")} ${t("Ver análisis")}</button>
        <button type="button" data-usar="${i}" class="boton-seccion">${t("Usar este equipo")}</button>
      </div>
    </li>`;
}

function pintarResultados() {
  if (!actual.resultados) return "";
  if (!actual.resultados.length) return `<p class="analisis-mensaje">${t("No queda nadie para buscar: quita alguno de «fuera».")}</p>`;
  return `
    <section class="analisis-seccion">
      <h3>${t("Los mejores equipos")}</h3>
      <ol class="buscar-propuestas">${actual.resultados.map(propuesta).join("")}</ol>
    </section>`;
}

function pintarPrincipal() {
  const fijos = [...actual.estados.values()].filter((e) => e === "fijo").length;
  const fuera = [...actual.estados.values()].filter((e) => e === "fuera").length;
  return `
    <div class="buscar-barra">
      <label class="buscar-elegir"><span>${t("La caja de")}</span>
        <select class="buscar-locke">
          ${actual.lockes.map((l) => `<option value="${escaparHTML(l.id)}" ${l.id === actual.locke.id ? "selected" : ""}>${escaparHTML(l.nombre)}</option>`).join("")}
        </select>
      </label>
      <p class="buscar-fuente">${textoFuente()}</p>
    </div>
    <p class="analisis-explica">${t("Pulsa un Pokémon para ver su ficha. En sus esquinas, la ✕ lo deja fuera de la búsqueda y el candado lo fija (irá seguro en el equipo). La nota no mira el nivel: fíjate en el de cada uno por si hay que entrenarlo.")}</p>
    ${actual.candidatos.length
      ? `<ul class="buscar-caja">${actual.candidatos.map(ficha).join("")}</ul>`
      : `<p class="analisis-mensaje">${t("No hay ningún Pokémon vivo en la caja de este locke.")}</p>`}
    <div class="buscar-acciones">
      <button type="button" class="boton-seccion buscar-buscar" ${actual.candidatos.length ? "" : "disabled"}>${icono("lupa")} ${t("Buscar los mejores equipos")}</button>
      <span class="buscar-cuenta">${t("{total} en la caja · {fijos} fijos · {fuera} fuera", { total: actual.candidatos.length, fijos, fuera })}</span>
    </div>
    <div class="buscar-resultados">${pintarResultados()}</div>`;
}

// ---------- La ficha (a la derecha) ----------

// Lo que no está en datos/ataques.json (los de estado y los de potencia variable): de PokeAPI,
// una vez por ataque
const infoAtaques = new Map(); // id -> promesa de { tipo, categoria, potencia }

function infoAtaque(id) {
  if (!infoAtaques.has(id)) {
    const promesa = pedirJSON(`${URL_API}move/${id}`).then((m) => ({
      tipo: m.type.name,
      categoria: { physical: "Físico", special: "Especial", status: "Estado" }[m.damage_class && m.damage_class.name] || "",
      potencia: m.power || null
    }));
    promesa.catch(() => infoAtaques.delete(id));
    infoAtaques.set(id, promesa);
  }
  return infoAtaques.get(id);
}

// Rojo (bajo) -> amarillo -> verde (alto), como las barras de las fichas de «Crear equipo»
function colorStat(valor) {
  const proporcion = Math.min(1, Math.max(0, (valor - 30) / 100));
  return `hsl(${Math.round(proporcion * 120)}, 70%, 45%)`;
}

// Un ataque como en las tarjetas de «Crear equipo»: del color de su tipo, con su categoría y
// potencia. Sin tipo (de estado): gris hasta que llega de PokeAPI.
function filaAtaque(a) {
  if (!a) return `<div class="ataque buscar-ataque-vacio">—</div>`;
  const fijo = actual.contexto.ataques.get(a.id);
  const tipo = a.tipo || (fijo && fijo.tipo);
  const detalle = fijo ? `${t(a.categoria || (fijo.clase === "fisico" ? "Físico" : "Especial"))} · ${fijo.potencia}` : t(a.categoria || "");
  return `
    <div class="ataque ${tipo ? "" : "buscar-ataque-sin-tipo"}" data-ataque="${a.id}" style="${tipo ? `background:${coloresTipo[tipo]}` : ""}">
      ${tipo ? iconoTipo(tipo) : ""}
      <span class="ataque-nombre">${escaparHTML(nombre(a))}</span>
      <span class="ataque-tipo">${escaparHTML(detalle)}</span>
    </div>`;
}

// Los ataques que llegan de PokeAPI, en su sitio (si sigue enseñándose el mismo)
function completarAtaques(m) {
  for (const a of m.poke.ataques || []) {
    if (!a || a.tipo || actual.contexto.ataques.has(a.id)) continue;
    infoAtaque(a.id)
      .then((info) => {
        const fila = actual && actual.elegido === m && cuerpo.querySelector(`.buscar-lado [data-ataque="${a.id}"]`);
        if (!fila) return;
        fila.classList.remove("buscar-ataque-sin-tipo");
        fila.style.background = coloresTipo[info.tipo];
        fila.insertAdjacentHTML("afterbegin", iconoTipo(info.tipo));
        fila.querySelector(".ataque-tipo").textContent = info.potencia ? `${t(info.categoria)} · ${info.potencia}` : t(info.categoria);
      })
      .catch(() => {});
  }
}

function filaStat(i, base, final, entreno, conDetalle, nat) {
  const flecha = nat && nat.sube === i ? " ↑" : nat && nat.baja === i ? " ↓" : "";
  return `
    <div class="buscar-stat">
      <span class="buscar-stat-nombre">${STATS[i]}${flecha}</span>
      <span class="analisis-barra-fondo"><i style="width:${Math.min(100, (base / 180) * 100)}%;background:${colorStat(base)}"></i></span>
      <span class="buscar-stat-valor" title="${t("Base {base}", { base })}">${final}</span>
      ${conDetalle ? `<span class="buscar-stat-extra">${t("IV {iv} · EV {ev}", { iv: entreno.ivs[i], ev: entreno.evs[i] })}</span>` : ""}
    </div>`;
}

function pintarFicha() {
  const m = actual.elegido;
  if (!m) {
    return `<p class="buscar-lado-reposo">${t("Pulsa un Pokémon para ver su ficha: ataques, habilidad, objeto, estadísticas y el porqué de su nota.")}</p>`;
  }
  const p = m.poke;
  const entreno = entrenoDe(p);
  const nat = p.conDetalle && p.entreno.naturaleza ? NATURALEZAS.find((n) => n.id === p.entreno.naturaleza) : null;
  const finales = statsFinales(p) || p.stats;
  const chips = (p.tipos || [])
    .map((tipo) => `<span class="chip" style="background:${coloresTipo[tipo]}">${iconoTipo(tipo)} ${tiposEs[tipo]}</span>`)
    .join("");
  const objeto = p.objeto
    ? `${imagenConRespaldo(urlsIconoObjeto(p.objeto.en), `class="icono-objeto" alt="" data-quitar-si-falla`)}
       <span class="ataque-tipo">${t("Objeto")}</span><span class="ataque-nombre">${escaparHTML(nombre(p.objeto))}</span>`
    : `<span class="ataque-tipo">${t("Objeto")}</span><span class="ataque-nombre">${t("Sin objeto")}</span>`;
  const notas = m.notas
    .map((n) => `<li class="${n.bien === true ? "bien" : n.bien === false ? "mal" : ""}">${escaparHTML(n.texto)}</li>`)
    .join("");

  return `
    <button type="button" class="buscar-lado-cerrar" data-cerrar-ficha title="${t("Cerrar")}" aria-label="${t("Cerrar")}">${icono("aspa")}</button>
    <div class="buscar-lado-cabeza">
      ${imagenConRespaldo(urlsRetrato(p), `class="buscar-lado-retrato" alt="" draggable="false"`)}
      <div class="buscar-lado-nombre">
        <h3>${escaparHTML(nombreDe(p))}</h3>
        <span>${p.mote ? `${escaparHTML(nombre(p))} · ` : ""}${t("Nv. {nivel}", { nivel: p.entreno.nivel })}${nat ? ` · ${escaparHTML(nombre(nat))}` : ""}</span>
        <div class="chips">${chips}</div>
      </div>
      <div class="analisis-nota">
        <span class="analisis-nota-numero" style="color:${colorNota(m.nota)}">${Math.round(m.nota)}</span>
        <span class="analisis-nota-palabra">${palabraNota(m.nota)}</span>
      </div>
    </div>
    <div class="analisis-barras">
      ${barra(t("stat|Ataque"), m.ataque)}
      ${barra(t("Aguante"), m.aguante)}
      ${barra(t("stat|Velocidad"), m.velocidad)}
    </div>
    ${p.conDetalle
      ? `<div class="buscar-lado-cosas">
           <div class="ataque habilidad"><span class="ataque-tipo">${t("Habilidad")}</span><span class="ataque-nombre">${p.habilidad ? escaparHTML(nombre(p.habilidad)) : "—"}</span></div>
           <div class="ataque objeto">${objeto}</div>
         </div>
         <div class="buscar-lado-ataques">${[0, 1, 2, 3].map((j) => filaAtaque((p.ataques || [])[j])).join("")}</div>`
      : `<p class="analisis-explica">${t("De este solo se sabe la especie y el nivel: lee el archivo de la partida para ver sus ataques, habilidad, objeto, IVs y EVs.")}</p>`}
    <h4>${t("Estadísticas")}</h4>
    <div class="buscar-lado-stats">${p.stats.map((base, i) => filaStat(i, base, finales[i], entreno, p.conDetalle, nat)).join("")}</div>
    ${notas ? `<h4>${t("El porqué de su nota")}</h4><ul class="analisis-notas">${notas}</ul>` : ""}`;
}

// Una barra de 0 a 100, como las del análisis
function barra(etiqueta, nota) {
  return `
    <div class="analisis-barra">
      <span class="analisis-barra-nombre">${etiqueta}</span>
      <span class="analisis-barra-fondo"><i style="width:${Math.round(nota)}%;background:${colorNota(nota)}"></i></span>
      <span class="analisis-barra-valor">${Math.round(nota)}</span>
    </div>`;
}

// ---------- Pintar ----------

function pintar() {
  const antes = cuerpo.querySelector(".buscar-principal");
  const scroll = antes ? antes.scrollTop : 0;
  dialogo.classList.add("con-caja");
  cuerpo.innerHTML = `
    <div class="buscar-rejilla ${actual.elegido ? "con-ficha" : ""}">
      <div class="buscar-principal">${pintarPrincipal()}</div>
      <aside class="buscar-lado">${pintarFicha()}</aside>
    </div>`;
  cuerpo.querySelector(".buscar-principal").scrollTop = scroll;
  if (actual.elegido) completarAtaques(actual.elegido);
}

// Solo la ficha y la marca del elegido (la caja no se vuelve a pintar: no se mueve)
function verFicha(m) {
  actual.elegido = m;
  for (const marcado of cuerpo.querySelectorAll(".elegida")) marcado.classList.remove("elegida");
  const i = actual.candidatos.indexOf(m);
  for (const boton of cuerpo.querySelectorAll(`[data-ficha="${i}"]`)) boton.closest(".buscar-ficha, .buscar-mini")?.classList.add("elegida");
  cuerpo.querySelector(".buscar-rejilla").classList.toggle("con-ficha", Boolean(m));
  const lado = cuerpo.querySelector(".buscar-lado");
  lado.innerHTML = pintarFicha();
  lado.scrollTop = 0;
  if (m) completarAtaques(m);
}

// Fijo o fuera: el mismo botón otra vez lo quita
async function marcar(m, estado) {
  if (actual.estados.get(m) === estado) {
    actual.estados.delete(m);
  } else {
    const fijos = [...actual.estados.values()].filter((e) => e === "fijo").length;
    if (estado === "fijo" && fijos >= MAX_FIJOS) {
      await avisar(t("Ya hay 6 fijos: quita alguno antes."));
      return;
    }
    actual.estados.set(m, estado);
  }
  actual.resultados = null; // ya no valen
  pintar();
}

async function buscar(boton) {
  boton.disabled = true;
  boton.innerHTML = `${icono("lupa")} ${t("Buscando...")}`;
  // Que se vea el «Buscando...» antes de ponerse a hacer cuentas
  await new Promise((resolver) => setTimeout(resolver, 30));
  const fijos = actual.candidatos.filter((m) => actual.estados.get(m) === "fijo");
  const libres = actual.candidatos.filter((m) => !actual.estados.get(m));
  actual.resultados = buscarEquipos(fijos, libres);
  pintar();
  cuerpo.querySelector(".buscar-resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Pasa el equipo a «Crear equipo», con todo lo que se sabe de cada uno (como «Copiar a Mis
// equipos» de la partida: un paste de Showdown que se importa)
async function usar(r, boton) {
  if (hayCambiosSinGuardar()) {
    const seguro = await confirmar(t("Tienes cambios sin guardar en el equipo de «Crear equipo». ¿Cambiarlo por este de todas formas?"), {
      aceptar: t("Cambiar"), peligro: true
    });
    if (!seguro) return;
  }
  boton.disabled = true;
  boton.textContent = t("Pasando...");
  try {
    const [{ pasteDeEquipo, prepararConversion }, { pokemonDePaste }] = await Promise.all([
      import("../partida/convertir.js"),
      import("./importar.js")
    ]);
    await prepararConversion();
    const { pokemon, problemas } = await pokemonDePaste(pasteDeEquipo(r.miembros.map((m) => m.poke.partida)));
    reemplazarEquipo(pokemon, actual.locke.nombre, null);
    if (actual.mochila) recordarMochila(actual.mochila, actual.locke.nombre);
    dialogo.close();
    alUsar(problemas);
  } catch (error) {
    console.error(error);
    boton.disabled = false;
    boton.textContent = t("Usar este equipo");
    avisar(t("No he podido pasar el equipo a «Crear equipo». Revisa tu conexión y vuelve a probar."));
  }
}

// alAlUsar(problemas): el equipo ya está en «Crear equipo» (problemas: lo que no se reconoció)
export function iniciarBuscar(alAlUsar) {
  alUsar = alAlUsar;
  document.getElementById("buscar-equipo").addEventListener("click", abrir);
  document.getElementById("buscar-equipo-cerrar").addEventListener("click", () => dialogo.close());

  cuerpo.addEventListener("click", (e) => {
    if (!actual) return;
    const boton = e.target.closest("button");
    if (!boton) return;
    const candidato = (clave) => actual.candidatos[Number(boton.dataset[clave])];
    if (boton.dataset.ficha !== undefined) verFicha(candidato("ficha"));
    else if (boton.dataset.fijar !== undefined) marcar(candidato("fijar"), "fijo");
    else if (boton.dataset.fuera !== undefined) marcar(candidato("fuera"), "fuera");
    else if (boton.dataset.cerrarFicha !== undefined) verFicha(null);
    else if (boton.matches(".buscar-buscar")) buscar(boton);
    else if (boton.matches(".buscar-leer")) {
      cargarLocke(actual.locke, actual.lockes, true).catch((error) => {
        console.error(error);
        mensaje(t("No he podido leer la caja. Vuelve a probar en un momento."));
      });
    } else if (boton.dataset.ver !== undefined) {
      const r = actual.resultados[Number(boton.dataset.ver)];
      mostrarAnalisis(r.miembros, actual.mochila ? { objetos: actual.mochila, nombre: actual.locke.nombre } : null);
    } else if (boton.dataset.usar !== undefined) usar(actual.resultados[Number(boton.dataset.usar)], boton);
  });

  cuerpo.addEventListener("change", (e) => {
    if (!actual || !e.target.matches(".buscar-locke")) return;
    const locke = actual.lockes.find((l) => l.id === e.target.value);
    if (locke) {
      cargarLocke(locke, actual.lockes).catch((error) => {
        console.error(error);
        mensaje(t("No he podido leer la caja. Vuelve a probar en un momento."));
      });
    }
  });
}
