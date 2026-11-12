// Ventana del perfil: el tuyo (desde el desplegable de tu nombre), el de un amigo (desde tu
// lista de amigos o desde «Amigos») o el de cualquiera desde el foro.
//
// Dos columnas, sin pestañas (estilos en css/perfil.css):
//
//   · A la izquierda, su FICHA: la misma tarjeta que en «Amigos», en grande. Foto con su marco,
//     nombre, título, si busca compañeros, lo que cuenta de sí, su horario y sus cifras, con el
//     fondo que haya elegido detrás. Abajo, el botón: «Editar perfil» en el tuyo; «Chat» y
//     «Retar a un locke» en el de un amigo; «Añadir a amigos» (o cómo va la solicitud) en el de
//     alguien que aún no lo es.
//   · A la derecha, lo que ha hecho: equipos destacados; su historial de lockes (los jugados y,
//     de cada uno, su equipo final y el MVP: lo que antes eran «Lockes jugados» y «Salón de la
//     fama»); su colección; sus logros en resumen; y sus amigos. Quien no es amigo solo ve la
//     ficha.
//
// Cada uno elige el color de su perfil (perfil.color, ver COLORES_PERFIL en js/comun/fichas.js): la
// ventana entera se tiñe del de la persona que se ve (--color-vista), se abra desde donde se abra.
//
// «Editar perfil» cambia la ventana al modo editar: a la izquierda los apartados (foto y nombre,
// sobre mí, título, marco, fondo, color, equipos destacados, lockes jugados y la cuenta), en medio las
// opciones del elegido y a la derecha tu ficha tal como quedará. Lo que se cambia va a un
// borrador y se guarda todo junto con «Guardar cambios» (o se tira con «Cancelar»). Solo los
// lockes jugados se apuntan en su propia ventana (la de «Amigos»), que guarda al momento.
//
// Se descarga la primera vez que se abre (ver sesion.js).

import { icono } from "./comun/iconos.js";
import { escaparHTML, fechaLarga } from "./comun/utilidades.js";
import { usuarioActual } from "./comun/nube.js";
import {
  miPerfil, alCambiarMiPerfil, cambiarMote, guardarMiPerfil, amigosAceptados, perfilesDeAmigos,
  alCambiarPerfilesAmigos, perfilesDe, colorDeTipo, relacionCon, pedirAmistad, aceptarAmistad,
  amistades, alCambiarAmistades, lockesJugados
} from "./comun/perfiles.js";
import { estaBloqueado, alCambiarChats } from "./comun/chat.js";
import { alCambiarLockes } from "./comun/lockes.js";
import { caraACara } from "./comun/cara-a-cara.js";
import { estaConectado, alCambiarPresencia } from "./comun/presencia.js";
import { irA } from "./navegacion.js";
import { leerGuardados } from "./equipos/estado.js";
import { pokemonParaCopia } from "./comun/pokemon.js";
import { pasteDelEquipo, copiarAlPortapapeles } from "./equipos/exportar.js";
import {
  imagenConRespaldo, urlsPMDEmocion, urlsRetrato, precargarImagen, carasDisponibles
} from "./comun/imagenes.js";
import { cargarDatos, datos } from "./comun/datos.js";
import { activarAutocompletado, iconoPokemon } from "./comun/autocompletado.js";
import { obtenerVariedades } from "./comun/formas.js";
import { elegirForma, datosDeForma } from "./comun/elegir-forma.js";
import { LOGROS, insignia } from "./comun/logros.js";
import {
  FONDOS, FONDOS_METAL, FONDOS_TIPO, FONDOS_EEVEE, FONDOS_TIENDA, FONDOS_REGION, fondoDe, logrosDe, desbloqueado,
  requisito, requisitoCorto, claseFondo, estiloFondo
} from "./comun/fondos.js";
import {
  TITULOS, MARCOS, COLORES_PERFIL, loTiene, tieneMarco, marcoDe, claseMarco, claseTitulo, fondoVisual, colorElegido, rgbDePerfil
} from "./comun/fichas.js";
import { miColeccion, escucharColeccion, alCambiarColeccion, coleccionDe, escaparate, aspectoDe } from "./comun/coleccion.js";
import { confirmar } from "./comun/ventanas.js";
import { t, LOCALE, nombre as nombreDe } from "./comun/idioma.js";

const MAX_DESTACADOS = 3;    // los equipos que se pueden destacar (cada uno es una copia dentro del perfil)
const VER_AMIGOS = 5;
const VER_LOCKES = 4;        // lockes del historial a la vista (el resto, con «Ver todos»)
const VER_INSIGNIAS = 8;     // los últimos logros conseguidos, en el resumen

const dialogo = document.querySelector("#dialogo-perfil");
const cuerpo = dialogo.querySelector(".perfil-cuerpo");
const dialogoAvatar = document.querySelector("#dialogo-avatar");

const ajenos = new Map();    // uid -> perfil de alguien que no es amigo (se pide al abrirlo)

let viendo = null;           // uid de la persona cuyo perfil se ve, o null si es el tuyo
let desdeMiPerfil = false;   // se llegó al del amigo desde tu perfil (sale «Mi perfil» para volver)
let historialEntero = false; // «Ver todos» los lockes del historial
let verLogros = false;       // los logros de otra persona, enteros, en lugar de la columna derecha

// El modo editar (solo en el tuyo)
let editando = false;
let apartado = "foto";
let borrador = null;         // ver empezarAEditar
let errorEditar = "";
let guardando = false;

// ---------- Piezas ----------

function plantillaFoto(perfil, clase) {
  const nombre = perfil.nombre || "?";
  return perfil.foto
    ? `<img class="${clase}" src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase} sin-foto">${escaparHTML(nombre[0].toUpperCase())}</span>`;
}

function caraDe(p) {
  const cara = p.cara && p.cara !== "Normal" ? p.cara : "";
  const titulo = p.mote ? `${p.mote} (${nombreDe(p)})` : nombreDe(p);
  return imagenConRespaldo(
    [...(cara ? urlsPMDEmocion(p, cara) : []), ...urlsRetrato(p)],
    `alt="${escaparHTML(nombreDe(p))}" title="${escaparHTML(titulo || "")}" loading="lazy"`
  );
}

// La cabecera de cada caja de la derecha: el nombre, una cuenta y, si hay, un botón
function cabeza(titulo, cuenta = "", boton = "") {
  return `<header class="perfil-caja-cabeza"><h3>${titulo}</h3>${cuenta ? `<small>${cuenta}</small>` : ""}${boton}</header>`;
}

function textoLockes(cuantos) {
  return t(cuantos === 1 ? "{n} locke" : "{n} lockes", { n: cuantos });
}

// ---------- Títulos ----------
//
// El nombre de uno de sus logros o uno comprado en la Tienda de «Juegos» (js/comun/fichas.js), el
// que haya elegido (perfil.titulo). Solo si de verdad lo tiene.

const TITULOS_TIENDA = TITULOS.map((titulo) => ({ ...titulo, icono: "estrella", descripcion: t("Comprado en la Tienda.") }));

function tituloDe(perfil) {
  const logro = LOGROS.find((cada) => cada.id === perfil.titulo);
  if (logro) return (perfil.logros || {})[logro.id] ? logro : null;
  const comprado = TITULOS_TIENDA.find((cada) => cada.id === perfil.titulo);
  return comprado && loTiene(perfil, comprado.id) ? comprado : null;
}

// Los que puede ponerse: los de la Tienda que tiene y los de sus logros
function titulosDe(perfil) {
  const tengo = perfil.logros || {};
  return [...TITULOS_TIENDA.filter((titulo) => loTiene(perfil, titulo.id)), ...LOGROS.filter((logro) => tengo[logro.id])];
}

// ---------- La ficha (izquierda) ----------

function perfilQueSeVe() {
  return viendo ? perfilesDeAmigos().get(viendo) || ajenos.get(viendo) : miPerfil();
}

// Quien no es amigo (ni tú) ve solo la ficha. El resto es de los amigos.
function conocido() {
  return !viendo || relacionCon(viendo) === "ok";
}

// Lockes jugados juntos en total (los de Versus, en marcha o terminados, y los apuntados a
// mano): lo mismo que la rivalidad de «Amigos»
function lockesJuntos(amigo) {
  const mio = miPerfil();
  return mio && amigo ? caraACara(mio, amigo).juntos : 0;
}

// El botón de abajo de la ficha de otra persona: chat y reto si es amiga y, si no, lo que toque
// con la solicitud de amistad
function plantillaAccion(perfil) {
  switch (relacionCon(perfil.uid)) {
    case "ok":
      return `<div class="perfil-ficha-botones">
        <button class="perfil-boton perfil-chat">${icono("mensaje")} ${t("Chat")}</button>
        <button class="perfil-boton perfil-retar">${icono("espadas")} ${t("Retar a un locke")}</button>
      </div>`;
    case "enviada":
      return `<span class="perfil-solicitud">${t("Solicitud de amistad enviada")}</span>`;
    case "recibida":
      return `<button class="perfil-boton perfil-amistad" data-accion="aceptar">${icono("personaMas")} ${t("Aceptar solicitud de amistad")}</button>`;
    default:
      // A quien has bloqueado no se le pide amistad sin desbloquearlo antes
      return estaBloqueado(perfil.uid)
        ? `<span class="perfil-solicitud">${t("Lo has bloqueado")}</span>`
        : `<button class="perfil-boton perfil-amistad" data-accion="pedir">${icono("personaMas")} ${t("Añadir a amigos")}</button>`;
  }
}

// mio: es el tuyo. vistaPrevia: la del modo editar (sin botones). La capa de color de la izquierda
// dice quién es, como en «Amigos»: el color de la sección si eres tú, verde si está conectado.
function plantillaFicha(perfil, { mio = false, vistaPrevia = false } = {}) {
  const sabeTodo = mio || conocido();
  const conectado = !mio && estaConectado(perfil.uid);
  const fondo = fondoVisual(perfil);
  const titulo = tituloDe(perfil);
  const texto = (perfil.sobreMi || "").trim();
  const horario = (perfil.horario || "").trim();

  // Las cifras: lockes, ganados y logros los ve cualquiera; las especies de su colección, sus
  // amigos y los lockes que habéis jugado juntos, solo los amigos
  const coleccion = sabeTodo ? coleccionPara(perfil, mio) : undefined;
  const especies = coleccion ? new Set([...Object.keys(coleccion.especies), ...Object.keys(coleccion.shiny)]).size : coleccion === null ? 0 : null;
  const amigos = mio ? amigosAceptados().length : (perfil.amigos || []).length;
  const logros = Object.keys(perfil.logros || {}).filter((id) => LOGROS.some((logro) => logro.id === id)).length;
  const cifra = (numero, singular, plural) =>
    `<span class="perfil-cifra"><strong>${numero ?? "–"}</strong>${numero === 1 ? singular : plural}</span>`;
  const jugados = lockesJugados(perfil).length;
  const ganados = (perfil.ganados || []).length;
  const cifras = [
    cifra(jugados, t("locke jugado"), t("lockes jugados")),
    cifra(ganados, t("ganado"), t("ganados")),
    cifra(logros, t("logro"), t("logros")),
    sabeTodo ? cifra(especies, t("especie"), t("especies")) : "",
    sabeTodo ? cifra(amigos, t("amigo"), t("amigos")) : "",
    !mio && sabeTodo ? cifra(lockesJuntos(perfil), t("locke juntos"), t("lockes juntos")) : ""
  ].join("");

  const abajo = vistaPrevia
    ? ""
    : mio
      ? `<button class="perfil-boton perfil-editar">${icono("lapiz")} ${t("Editar perfil")}</button>`
      : plantillaAccion(perfil);

  return `
    <aside class="perfil-ficha ${mio ? "mia" : conectado ? "conectado" : ""} ${fondo.clase}" style="${fondo.estilo}">
      ${!mio && !vistaPrevia && desdeMiPerfil ? `<button class="perfil-volver-mio">${icono("atras")} ${t("Mi perfil")}</button>` : ""}
      <span class="perfil-ficha-foto ${claseMarco(marcoDe(perfil))}">${plantillaFoto(perfil, "perfil-foto")}</span>
      ${conectado ? `<span class="jugador-estado"><span class="punto-conectado"></span>${t("Conectado")}</span>` : ""}
      <h2 class="perfil-ficha-nombre">${escaparHTML(perfil.nombre || t("Jugador"))}</h2>
      ${titulo ? `<span class="perfil-titulo ${claseTitulo(titulo)}">${escaparHTML(titulo.nombre)}</span>` : ""}
      ${perfil.busca ? `<span class="perfil-busca">${icono("persona")} ${t("Busca compañeros")}</span>` : ""}
      ${texto ? `<p class="perfil-ficha-texto">${escaparHTML(texto)}</p>` : ""}
      ${horario ? `<span class="perfil-ficha-horario">${icono("calendario")} ${escaparHTML(horario)}</span>` : ""}
      <div class="perfil-ficha-cifras">${cifras}</div>
      ${abajo}
    </aside>`;
}

// ---------- Equipos destacados ----------

function plantillaEquipos(perfil, mio) {
  const lista = (perfil.escaparate || []).slice(0, MAX_DESTACADOS);
  return `
    <section class="perfil-caja perfil-destacados">
      ${cabeza(t("Equipos destacados"), lista.length ? String(lista.length) : "")}
      ${lista.length
        ? `<div class="perfil-destacados-lista">${lista
            .map(
              (equipo, indice) => `
                <article class="perfil-equipo">
                  <header>
                    <strong>${escaparHTML(equipo.nombre)}</strong>
                    <button class="perfil-copiar" data-indice="${indice}" title="${t("Copiar como paste")}">${icono("copiar")}</button>
                  </header>
                  <div class="perfil-equipo-caras">${(equipo.pokemon || []).map(caraDe).join("")}</div>
                </article>`
            )
            .join("")}</div>`
        : `<p class="perfil-vacio">${mio ? t("Destaca hasta tres de tus equipos desde «Editar perfil».") : t("Ninguno todavía.")}</p>`}
    </section>`;
}

async function copiarEquipo(boton) {
  const perfil = perfilQueSeVe();
  const equipo = ((perfil && perfil.escaparate) || [])[Number(boton.dataset.indice)];
  if (!equipo) return;
  const copiado = await copiarAlPortapapeles(equipo.paste || "");
  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  setTimeout(() => (boton.innerHTML = icono("copiar")), 1500);
}

// ---------- Historial de lockes ----------
//
// Cada locke terminado que ha jugado, una vez: el nombre, el tipo y la fecha, si lo ganó y su
// equipo final con el MVP. Los jugados vienen de su palmarés (lockesJugados: los de «Lockes» se
// apuntan solos; los de antes, a mano en «Amigos») y el equipo final, de su salón de la fama
// (perfil.salon, con el mismo id; si no, el que se apuntara a mano en el palmarés). Del salón
// se añaden también los que no estén en el palmarés.

function historialDe(perfil) {
  const salon = new Map((perfil.salon || []).map((entrada) => [entrada.id, entrada]));
  const lista = lockesJugados(perfil).map((jugado) => {
    const delSalon = salon.get(jugado.id);
    salon.delete(jugado.id);
    const propio = (jugado.participantes || []).find((p) => p.id === perfil.uid && p.equipo);
    const equipo = delSalon || (propio ? { pokemon: propio.equipo.pokemon, mvp: propio.mvp } : null);
    return {
      nombre: jugado.nombre || t("Locke"),
      tipo: jugado.tipo,
      fechaFin: jugado.fechaFin || "",
      gano: jugado.gano,
      pokemon: equipo ? equipo.pokemon || [] : [],
      mvp: equipo ? equipo.mvp : -1
    };
  });
  for (const entrada of salon.values()) {
    lista.push({ nombre: entrada.locke || t("Locke"), tipo: entrada.tipo, fechaFin: entrada.fechaFin || "", gano: entrada.gano, pokemon: entrada.pokemon || [], mvp: entrada.mvp });
  }
  // El más reciente primero (los que no tienen fecha, al final)
  return lista
    .map((locke, i) => ({ locke, i }))
    .sort((uno, otro) => String(otro.locke.fechaFin).localeCompare(String(uno.locke.fechaFin)) || uno.i - otro.i)
    .map(({ locke }) => locke);
}

function plantillaLocke(locke) {
  const tipo = (locke.tipo || {}).nombre || "";
  const datosLocke = [tipo, locke.fechaFin ? fechaLarga(locke.fechaFin) : ""].filter(Boolean).join(" · ");
  return `
    <article class="perfil-locke ${locke.gano ? "gano" : ""}" style="--color-locke: ${colorDeTipo(locke.tipo)}">
      <span class="perfil-locke-nombre"><strong>${escaparHTML(locke.nombre)}</strong>${datosLocke ? `<small>${escaparHTML(datosLocke)}</small>` : ""}</span>
      ${locke.gano ? `<span class="perfil-locke-ganado">${icono("corona")} ${t("Ganado")}</span>` : ""}
      ${locke.pokemon.length
        ? `<div class="perfil-locke-caras">${locke.pokemon
            .map((p, i) => `<span class="salon-cara ${i === locke.mvp ? "mvp" : ""}">${caraDe(p)}${i === locke.mvp ? `<span class="salon-mvp">MVP</span>` : ""}</span>`)
            .join("")}</div>`
        : ""}
    </article>`;
}

function plantillaHistorial(perfil) {
  const historial = historialDe(perfil);
  const ganados = historial.filter((locke) => locke.gano).length;
  const visibles = historialEntero ? historial : historial.slice(0, VER_LOCKES);
  const boton = historial.length > VER_LOCKES
    ? `<button class="perfil-mini perfil-ver-lockes">${historialEntero ? t("Ver menos") : t("Ver los {n}", { n: historial.length })}</button>`
    : "";
  return `
    <section class="perfil-caja perfil-historial">
      ${cabeza(t("Lockes"), historial.length ? t("{n} jugados · {g} ganados", { n: historial.length, g: ganados }) : "", boton)}
      ${historial.length
        ? `<div class="perfil-historial-lista">${visibles.map(plantillaLocke).join("")}</div>`
        : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`}
    </section>`;
}

// ---------- Su colección (los huevos de «Juegos») ----------
//
// Una muestra: los que haya elegido destacar o, si no, los últimos que le han salido (ver
// escaparate en js/comun/coleccion.js), con la cara y el shiny que haya elegido para cada uno.
// La tuya está siempre al día; la de los demás se pide la primera vez que se abre su perfil.

const coleccionesVistas = new Map(); // uid -> su colección (o null si no tiene)

function coleccionPara(perfil, mio) {
  if (mio) {
    escucharColeccion();
    return miColeccion();
  }
  if (coleccionesVistas.has(perfil.uid)) return coleccionesVistas.get(perfil.uid);
  coleccionesVistas.set(perfil.uid, undefined); // pedida: hasta que llegue, nada
  coleccionDe(perfil.uid)
    .then((coleccion) => {
      coleccionesVistas.set(perfil.uid, coleccion);
      if (dialogo.open && viendo === perfil.uid) pintar();
    })
    .catch((error) => console.error("No se ha podido leer su colección", error));
  return undefined; // aún no ha llegado
}

function plantillaColeccion(perfil, mio) {
  const coleccion = coleccionPara(perfil, mio);
  if (coleccion === undefined) return "";
  const especies = coleccion ? new Set([...Object.keys(coleccion.especies), ...Object.keys(coleccion.shiny)]).size : 0;
  const shiny = coleccion ? Object.keys(coleccion.shiny).length : 0;
  const muestra = escaparate(coleccion);
  const nombreDeEspecie = (id) => {
    const especie = datos && datos.pokemon.find((cada) => cada.id === id);
    return especie ? nombreDe(especie) : `#${id}`;
  };
  return `
    <section class="perfil-caja perfil-coleccion">
      ${cabeza(
        t("Colección"),
        `${t("{n} especies", { n: especies })}${shiny ? ` · ${icono("estrella")} ${shiny}` : ""}`,
        mio ? `<button class="perfil-mini" data-ir-coleccion>${t("Ver colección")}</button>` : ""
      )}
      ${muestra.length
        ? `<div class="perfil-coleccion-muestra">${muestra
            .map(({ id }) => {
              const { cara, shiny: enShiny } = aspectoDe(coleccion, id);
              return `<span class="perfil-coleccion-poke ${enShiny ? "shiny" : ""}" title="${escaparHTML(nombreDeEspecie(id))}">
                        ${imagenConRespaldo(urlsPMDEmocion({ id, shiny: enShiny }, cara), `alt="" loading="lazy" data-quitar-si-falla`)}
                      </span>`;
            })
            .join("")}</div>`
        : `<p class="perfil-vacio">${mio ? t("Abre huevos en «Juegos» → «Colección» para empezarla.") : t("Todavía no ha abierto ningún huevo.")}</p>`}
    </section>`;
}

// ---------- Logros ----------
//
// En el perfil, en resumen: cuántos, una barra y los últimos conseguidos. «Ver todos» lleva a la
// sección «Logros» si es el tuyo; si es de otro, los enseña enteros en lugar de la columna derecha.

function logrosConseguidos(perfil) {
  const tengo = perfil.logros || {};
  return LOGROS.filter((logro) => tengo[logro.id]).sort((uno, otro) => tengo[otro.id] - tengo[uno.id]);
}

function plantillaLogrosResumen(perfil) {
  const conseguidos = logrosConseguidos(perfil);
  const total = LOGROS.length;
  const parte = total ? Math.round((conseguidos.length / total) * 100) : 0;
  return `
    <section class="perfil-caja perfil-logros-resumen">
      ${cabeza(t("Logros"), t("{n} de {total}", { n: conseguidos.length, total }), `<button class="perfil-mini perfil-ver-logros">${t("Ver todos")}</button>`)}
      <div class="perfil-logros-barra" title="${parte} %"><span style="width: ${parte}%"></span></div>
      ${conseguidos.length
        ? `<div class="perfil-logros-ultimos">${conseguidos
            .slice(0, VER_INSIGNIAS)
            .map((logro) => `<span title="${escaparHTML(`${logro.nombre}: ${logro.descripcion}`)}">${insignia(logro, true)}</span>`)
            .join("")}</div>`
        : `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`}
    </section>`;
}

// Los de otra persona, enteros: los suyos, del último al primero, y detrás, apagados, los que le
// faltan. Lo que pide cada uno, al pasar el ratón.
function plantillaLogrosDe(perfil) {
  const tengo = perfil.logros || {};
  const conseguidos = logrosConseguidos(perfil);
  const faltan = LOGROS.filter((logro) => !tengo[logro.id]);
  const ficha = (logro, hecho) => {
    const cuando = hecho
      ? ` · ${new Date(tengo[logro.id]).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" })}`
      : "";
    return `
      <div class="perfil-logro ${hecho ? "conseguido" : ""}" title="${escaparHTML(logro.descripcion + cuando)}">
        ${insignia(logro, hecho)}
        <span>${escaparHTML(logro.nombre)}</span>
      </div>`;
  };
  return `
    <section class="perfil-caja perfil-logros-enteros">
      ${cabeza(t("Logros"), t("{n} de {total}", { n: conseguidos.length, total: LOGROS.length }), `<button class="perfil-mini perfil-cerrar-logros">${icono("atras")} ${t("Volver")}</button>`)}
      <div class="perfil-logros-rejilla">
        ${conseguidos.map((logro) => ficha(logro, true)).join("")}
        ${faltan.map((logro) => ficha(logro, false)).join("")}
      </div>
    </section>`;
}

// ---------- Amigos ----------

// Los tuyos: los VER_AMIGOS con los que más has jugado (a igualdad, los conectados y por nombre)
function plantillaAmigos() {
  const todos = amigosAceptados()
    .map((amistad) => perfilesDeAmigos().get(amistad.otro))
    .filter(Boolean)
    .map((amigo) => ({ amigo, juntos: lockesJuntos(amigo) }))
    .sort(
      (uno, otro) =>
        otro.juntos - uno.juntos ||
        Number(estaConectado(otro.amigo.uid)) - Number(estaConectado(uno.amigo.uid)) ||
        uno.amigo.nombre.localeCompare(otro.amigo.nombre, LOCALE)
    );

  return `
    <section class="perfil-caja perfil-amigos-caja">
      ${cabeza(t("Amigos"), todos.length ? String(todos.length) : "", todos.length ? `<button class="perfil-mini perfil-ver-amigos">${t("Ver todos")}</button>` : "")}
      ${todos.length
        ? `<div class="perfil-amigos">${todos
            .slice(0, VER_AMIGOS)
            .map(
              ({ amigo, juntos }) => `
                <button class="perfil-amigo ${estaConectado(amigo.uid) ? "conectado" : ""}" data-uid="${escaparHTML(amigo.uid)}" title="${escaparHTML(amigo.nombre)}">
                  ${plantillaFoto(amigo, "perfil-amigo-foto")}
                  <span class="perfil-amigo-nombre">${escaparHTML(amigo.nombre)}</span>
                  <small>${textoLockes(juntos)}</small>
                </button>`
            )
            .join("")}</div>`
        : `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`}
    </section>`;
}

// Los de otra persona salen de su perfil (perfil.amigos, lo apunta cada uno: ver perfiles.js),
// que se pide la primera vez. Los que también son amigos tuyos (o tú) se pueden pulsar.
const amigosDeOtros = new Map(); // «uid|uids» -> sus amigos (perfiles), cuando han llegado

function pedirAmigosDe(perfil) {
  const uids = perfil.amigos || [];
  const clave = `${perfil.uid}|${uids.join(",")}`;
  if (amigosDeOtros.has(clave)) return amigosDeOtros.get(clave);
  amigosDeOtros.set(clave, null); // pedido: hasta que llegue, nada
  perfilesDe(uids)
    .then((mapa) => {
      amigosDeOtros.set(clave, [...mapa.values()].filter((amigo) => amigo && amigo.nombre));
      if (dialogo.open && viendo === perfil.uid) pintar();
    })
    .catch((error) => console.error("No se han podido leer sus amigos", error));
  return null;
}

function plantillaAmigosDe(perfil) {
  const uids = perfil.amigos || [];
  const llegados = uids.length ? pedirAmigosDe(perfil) : [];
  const yo = (usuarioActual() || {}).uid;
  const lista = (llegados || [])
    .slice()
    .sort((uno, otro) => Number(otro.uid === yo) - Number(uno.uid === yo) || uno.nombre.localeCompare(otro.nombre, LOCALE));

  return `
    <section class="perfil-caja perfil-amigos-caja">
      ${cabeza(t("Amigos"), uids.length ? String(uids.length) : "")}
      ${!uids.length
        ? `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`
        : !llegados
          ? `<p class="perfil-vacio">${t("Cargando...")}</p>`
          : `<div class="perfil-amigos">${lista
              .slice(0, VER_AMIGOS)
              .map((amigo) => {
                // Se puede abrir el tuyo y el de tus amigos
                const abrible = amigo.uid === yo || perfilesDeAmigos().has(amigo.uid);
                const etiqueta = abrible ? "button" : "span";
                return `
                  <${etiqueta} class="perfil-amigo ${abrible ? "" : "ajeno"}" data-uid="${escaparHTML(amigo.uid)}" title="${escaparHTML(amigo.nombre)}">
                    ${plantillaFoto(amigo, "perfil-amigo-foto")}
                    <span class="perfil-amigo-nombre">${escaparHTML(amigo.uid === yo ? t("Tú") : amigo.nombre)}</span>
                  </${etiqueta}>`;
              })
              .join("")}</div>`}
    </section>`;
}

// ---------- Ver un perfil ----------

function plantillaDerecha(perfil, mio) {
  if (!mio && !conocido()) {
    return `<div class="perfil-derecha"><p class="perfil-vacio perfil-solo-amigos">${t("Hazte su amigo para ver sus equipos, sus lockes y su colección.")}</p></div>`;
  }
  if (!mio && verLogros) return `<div class="perfil-derecha">${plantillaLogrosDe(perfil)}</div>`;
  return `
    <div class="perfil-derecha">
      ${plantillaEquipos(perfil, mio)}
      <div class="perfil-abajo">
        ${plantillaHistorial(perfil)}
        <div class="perfil-pila">
          ${plantillaColeccion(perfil, mio)}
          ${plantillaLogrosResumen(perfil)}
          ${mio ? plantillaAmigos() : plantillaAmigosDe(perfil)}
        </div>
      </div>
    </div>`;
}

function pintar() {
  if (editando && !viendo) {
    pintarEditar();
    return;
  }
  const perfil = perfilQueSeVe();
  const mio = !viendo;
  cuerpo.classList.remove("editando");
  if (!perfil) {
    cuerpo.innerHTML = viendo ? `<p class="perfil-vacio">${t("Cargando...")}</p>` : "";
    return;
  }
  teñir(perfil);
  cuerpo.innerHTML = `
    <div class="perfil-vista">
      ${plantillaFicha(perfil, { mio })}
      ${plantillaDerecha(perfil, mio)}
    </div>`;
}

// ---------- Editar perfil ----------
//
// borrador: { mote, sobreMi, horario, busca, titulo, marco, fondo, color, escaparate, foto }. foto es
// null mientras no se cambie y, si se cambia, lo que se guardará: { avatar, fotoGoogle, foto }.

const APARTADOS = [
  { id: "foto", icono: "persona", nombre: () => t("Foto y nombre") },
  { id: "sobre", icono: "mensaje", nombre: () => t("Sobre mí") },
  { id: "titulo", icono: "etiqueta", nombre: () => t("Título") },
  { id: "marco", icono: "estrella", nombre: () => t("Marco") },
  { id: "fondo", icono: "imagen", nombre: () => t("Fondo") },
  { id: "color", icono: "atardecer", nombre: () => t("Color") },
  { id: "equipos", icono: "pokeball", nombre: () => t("Equipos destacados") },
  { id: "lockes", icono: "trofeo", nombre: () => t("Lockes jugados") }
];

function empezarAEditar(cual = "foto") {
  const perfil = miPerfil() || {};
  borrador = {
    mote: perfil.mote || perfil.nombre || "",
    sobreMi: perfil.sobreMi || "",
    horario: perfil.horario || "",
    busca: Boolean(perfil.busca),
    titulo: tituloDe(perfil) ? perfil.titulo : null,
    marco: marcoDe(perfil),
    fondo: fondoDe(perfil) || null,
    color: colorElegido(perfil),
    escaparate: [...(perfil.escaparate || [])].slice(0, MAX_DESTACADOS),
    foto: null
  };
  editando = true;
  apartado = cual;
  errorEditar = "";
  pintar();
}

// Tu perfil con lo del borrador encima: lo que se ve en la ficha de la derecha
function perfilEditado() {
  const perfil = miPerfil() || {};
  if (!borrador) return perfil;
  return {
    ...perfil,
    nombre: borrador.mote.trim() || perfil.nombre,
    mote: borrador.mote,
    sobreMi: borrador.sobreMi,
    horario: borrador.horario,
    busca: borrador.busca,
    titulo: borrador.titulo,
    marco: borrador.marco,
    fondo: borrador.fondo,
    color: borrador.color,
    escaparate: borrador.escaparate,
    ...(borrador.foto || {})
  };
}

// Lo que cambia respecto a lo guardado (sin el nombre, que va aparte: cambiarMote)
function cambiosDelBorrador() {
  const perfil = miPerfil() || {};
  const cambios = {};
  const sobreMi = borrador.sobreMi.trim().slice(0, 200);
  const horario = borrador.horario.trim().slice(0, 40);
  if (sobreMi !== (perfil.sobreMi || "")) cambios.sobreMi = sobreMi;
  if (horario !== (perfil.horario || "")) cambios.horario = horario;
  if (borrador.busca !== Boolean(perfil.busca)) cambios.busca = borrador.busca;
  if ((borrador.titulo || null) !== (tituloDe(perfil) ? perfil.titulo : null)) cambios.titulo = borrador.titulo || null;
  if ((borrador.marco || "") !== marcoDe(perfil)) cambios.marco = borrador.marco || "";
  if ((borrador.fondo || null) !== (fondoDe(perfil) || null)) cambios.fondo = borrador.fondo || null;
  if (borrador.color !== colorElegido(perfil)) cambios.color = borrador.color || null;
  const ids = (lista) => lista.map((equipo) => equipo.id).join("|");
  if (ids(borrador.escaparate) !== ids((perfil.escaparate || []).slice(0, MAX_DESTACADOS))) cambios.escaparate = borrador.escaparate;
  if (borrador.foto) Object.assign(cambios, borrador.foto);
  return cambios;
}

function nombreCambiado() {
  const perfil = miPerfil() || {};
  return borrador.mote.trim() !== (perfil.mote || perfil.nombre || "");
}

function hayCambios() {
  return Boolean(borrador) && (nombreCambiado() || Object.keys(cambiosDelBorrador()).length > 0);
}

async function guardarCambios() {
  if (!borrador || guardando) return;
  guardando = true;
  errorEditar = "";
  pintar();
  try {
    if (nombreCambiado()) {
      const error = await cambiarMote(borrador.mote.trim());
      if (error) {
        errorEditar = error;
        apartado = "foto";
        return;
      }
    }
    const cambios = cambiosDelBorrador();
    if (Object.keys(cambios).length) await guardarMiPerfil(cambios);
    editando = false;
    borrador = null;
  } catch (error) {
    console.error(error);
    errorEditar = t("No se ha podido guardar. Inténtalo otra vez.");
  } finally {
    guardando = false;
    pintar();
  }
}

// Salir sin guardar: si hay algo cambiado, se pregunta. Devuelve si se ha salido.
async function dejarDeEditar() {
  if (hayCambios() && !(await confirmar(t("Tienes cambios sin guardar. ¿Descartarlos?"), { aceptar: t("Descartar") }))) return false;
  editando = false;
  borrador = null;
  errorEditar = "";
  return true;
}

// --- Los apartados ---

function panelFoto() {
  const perfil = perfilEditado();
  return `
    <h3>${t("Foto y nombre")}</h3>
    <div class="editar-foto">
      <span class="perfil-ficha-foto ${claseMarco(marcoDe(perfil))}">${plantillaFoto(perfil, "perfil-foto")}</span>
      <div class="editar-foto-texto">
        <button class="perfil-boton editar-cambiar-foto">${icono("imagen")} ${t("Cambiar foto")}</button>
        <small>${t("Un Pokémon (con su cara de Mundo Misterioso), una imagen tuya o la foto de tu cuenta de Google.")}</small>
      </div>
    </div>
    <label class="editar-campo">
      <span>${t("Nombre de usuario")}</span>
      <input class="editar-nombre" type="text" maxlength="20" autocomplete="off" value="${escaparHTML(borrador.mote)}">
      <small>${t("Es único: con él te encuentran tus amigos.")}</small>
    </label>`;
}

function panelSobreMi() {
  return `
    <h3>${t("Sobre mí")}</h3>
    <label class="editar-campo">
      <span>${t("Una frase sobre ti")}</span>
      <textarea class="editar-sobre-mi" rows="3" maxlength="200" placeholder="${t("Por ejemplo: juego Nuzlockes aleatorizados desde hace años.")}">${escaparHTML(borrador.sobreMi)}</textarea>
    </label>
    <label class="editar-campo">
      <span>${t("Horario (opcional)")}</span>
      <input class="editar-horario" type="text" maxlength="40" autocomplete="off" value="${escaparHTML(borrador.horario)}"
             placeholder="${t("Por ejemplo: noches y fines de semana (España)")}">
    </label>
    <label class="editar-casilla">
      <input class="editar-busca" type="checkbox" ${borrador.busca ? "checked" : ""}>
      <span>${t("Busco compañeros para un locke")}</span>
    </label>`;
}

function panelTitulo() {
  const perfil = miPerfil() || {};
  const lista = titulosDe(perfil);
  return `
    <h3>${t("Título")}</h3>
    <p>${t("Sale debajo de tu nombre, aquí, en «Amigos», en el foro y en la clasificación.")}</p>
    <div class="editar-titulos">
      <button class="editar-opcion editar-titulo ${borrador.titulo ? "" : "elegido"}" data-titulo="">
        <span class="editar-sin">${t("Sin título")}</span>
      </button>
      ${lista
        .map(
          (titulo) => `
            <button class="editar-opcion editar-titulo ${titulo.id === borrador.titulo ? "elegido" : ""}" data-titulo="${escaparHTML(titulo.id)}"
                    title="${escaparHTML(titulo.descripcion)}">
              <span class="perfil-titulo ${claseTitulo(titulo)}">${escaparHTML(titulo.nombre)}</span>
            </button>`
        )
        .join("")}
    </div>
    ${lista.length ? "" : `<p class="perfil-vacio">${t("Consigue títulos con los logros o cómpralos en la Tienda de «Juegos».")}</p>`}`;
}

function panelMarco() {
  const perfil = perfilEditado();
  const tuyos = MARCOS.filter((marco) => tieneMarco(miPerfil() || {}, marco));
  const opcion = (id, nombre) => `
    <button class="editar-opcion editar-marco ${id === (borrador.marco || "") ? "elegido" : ""}" data-marco="${id}" title="${escaparHTML(nombre)}">
      <span class="perfil-marco-foto ${claseMarco(id)}">${plantillaFoto(perfil, "perfil-foto")}</span>
      <small>${escaparHTML(nombre)}</small>
    </button>`;
  return `
    <h3>${t("Marco")}</h3>
    <p>${t("Alrededor de tu foto, en toda la web. Se consiguen en la Tienda de «Juegos» y con algunos logros.")}</p>
    <div class="editar-marcos">
      ${opcion("", t("Sin marco"))}
      ${tuyos.map((marco) => opcion(marco.id, marco.nombre)).join("")}
    </div>`;
}

function panelFondo() {
  const perfil = miPerfil() || {};
  const sinFondo = { id: "", nombre: t("Sin fondo") };
  const muestra = (fondo) => {
    const libre = !fondo.id || desbloqueado(fondo, perfil);
    // A los de metal les sirve saber cuántos logros llevas; a los demás, no
    const metal = FONDOS_METAL.includes(fondo);
    const pide = `${requisito(fondo)}${metal ? ` ${t("(tienes {n} logros)", { n: logrosDe(perfil) })}` : ""}`;
    return `
      <button class="editar-opcion editar-fondo ${(fondo.id || null) === (borrador.fondo || null) ? "elegido" : ""}" data-fondo="${fondo.id}"
              ${libre ? "" : "disabled"} title="${escaparHTML(libre ? fondo.nombre : pide)}">
        <span class="perfil-fondo ${claseFondo(fondo.id)}" style="${estiloFondo(fondo.id)}">${libre ? "" : `<span class="editar-candado">${icono("candado")}</span>`}</span>
        <small>${escaparHTML(fondo.nombre)}${libre ? "" : ` · ${escaparHTML(requisitoCorto(fondo))}`}</small>
      </button>`;
  };
  const grupo = (titulo, fondos) => {
    const tengo = fondos.filter((fondo) => !fondo.id || desbloqueado(fondo, perfil)).length;
    return `
      <section class="editar-grupo">
        <h4>${titulo} <small>${tengo}/${fondos.length}</small></h4>
        <div class="editar-fondos">${fondos.map(muestra).join("")}</div>
      </section>`;
  };
  return `
    <h3>${t("Fondo")}</h3>
    <p>${t("Va detrás de tu ficha, aquí y en «Amigos». Los que te faltan dicen qué piden.")}</p>
    ${grupo(t("Básicos"), [sinFondo, ...FONDOS_METAL])}
    ${grupo(t("De la Tienda"), FONDOS_TIENDA)}
    ${grupo(t("De región"), FONDOS_REGION)}
    ${grupo("Eevee", FONDOS_EEVEE)}
    ${grupo(t("Tipos"), FONDOS_TIPO)}`;
}

function panelColor() {
  const opcion = (color) => `
    <button class="editar-opcion editar-color ${color.id === (borrador.color || "celeste") ? "elegido" : ""}" data-color="${color.id}"
            title="${escaparHTML(color.nombre)}">
      <span class="editar-muestra-color" style="--c: ${color.rgb}"></span>
      <small>${escaparHTML(color.nombre)}</small>
    </button>`;
  return `
    <h3>${t("Color")}</h3>
    <p>${t("El de tu ficha, sus botones y todo tu perfil. Lo ven así todos, lo abran desde donde lo abran.")}</p>
    <div class="editar-colores">${COLORES_PERFIL.map(opcion).join("")}</div>`;
}

function panelEquipos() {
  const destacados = borrador.escaparate;
  const guardados = leerGuardados();
  const ids = new Set(destacados.map((equipo) => equipo.id));
  return `
    <h3>${t("Equipos destacados")}</h3>
    <p>${t("Hasta tres de tus equipos, para que tus amigos los vean y los copien. Se guarda una copia: si luego cambias el equipo, aquí sigue como estaba.")}</p>
    <h4 class="editar-subtitulo">${t("En tu perfil")} <small>${destacados.length}/${MAX_DESTACADOS}</small></h4>
    ${destacados.length
      ? `<div class="editar-destacados">${destacados
          .map(
            (equipo, indice) => `
              <div class="editar-destacado">
                <strong>${escaparHTML(equipo.nombre)}</strong>
                <span class="perfil-equipo-caras">${(equipo.pokemon || []).map(caraDe).join("")}</span>
                <span class="editar-destacado-botones">
                  <button class="editar-subir" data-indice="${indice}" title="${t("Subir")}" ${indice === 0 ? "disabled" : ""}>${icono("arriba")}</button>
                  <button class="editar-bajar" data-indice="${indice}" title="${t("Bajar")}" ${indice === destacados.length - 1 ? "disabled" : ""}>${icono("abajo")}</button>
                  <button class="editar-quitar" data-indice="${indice}" title="${t("Dejar de destacar")}">${icono("aspa")}</button>
                </span>
              </div>`
          )
          .join("")}</div>`
      : `<p class="perfil-vacio">${t("Ninguno todavía: elige abajo.")}</p>`}
    <h4 class="editar-subtitulo">${t("Tus equipos")}</h4>
    ${guardados.length
      ? `<div class="editar-equipos">${guardados
          .map(
            (equipo) => `
              <button class="editar-equipo ${ids.has(equipo.id) ? "destacado" : ""}" data-id="${escaparHTML(equipo.id)}"
                      ${!ids.has(equipo.id) && destacados.length >= MAX_DESTACADOS ? "disabled" : ""}>
                <strong>${escaparHTML(equipo.nombre || t("Equipo"))}</strong>
                <span class="perfil-equipo-caras">${equipo.pokemon.map(caraDe).join("")}</span>
                ${ids.has(equipo.id) ? icono("visto") : icono("mas")}
              </button>`
          )
          .join("")}</div>`
      : `<p class="perfil-vacio">${t("No tienes equipos guardados.")}</p>`}`;
}

function panelLockes() {
  const historial = historialDe(miPerfil() || {});
  return `
    <h3>${t("Lockes jugados")}</h3>
    <p>${t("Los de «Lockes» se apuntan solos al terminar. Los de antes, o los que jugaste fuera de la web, se apuntan a mano. Se guardan en su propia ventana, al momento.")}</p>
    <button class="perfil-boton editar-palmares">${icono("lapiz")} ${t("Apuntar o corregir lockes")}</button>
    ${historial.length
      ? `<div class="perfil-historial-lista editar-historial">${historial.map(plantillaLocke).join("")}</div>`
      : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`}`;
}

function panelCuenta() {
  return `
    <h3>${t("Borrar mi cuenta")}</h3>
    <p>${t("Se borra para siempre: tu perfil, tu nombre de usuario, tus equipos, rutas y level caps, tus amistades y tus lockes ganados. No se puede deshacer.")}</p>
    <button class="perfil-boton peligro perfil-borrar">${icono("papelera")} ${t("Borrar mi cuenta")}</button>`;
}

const PANELES = {
  foto: panelFoto, sobre: panelSobreMi, titulo: panelTitulo, marco: panelMarco, fondo: panelFondo,
  color: panelColor, equipos: panelEquipos, lockes: panelLockes, cuenta: panelCuenta
};

// La ventana entera, del color de la persona (en el modo editar, del que estás eligiendo)
function teñir(perfil) {
  dialogo.style.setProperty("--color-vista", rgbDePerfil(perfil));
}

function pintarEditar() {
  // Al elegir algo se repinta todo. Si sigue en el mismo apartado, lo que baja se queda donde
  // estaba (el panel y, en pantallas estrechas, la ventana): si no, volvería arriba y habría que
  // bajar otra vez para elegir el de al lado. Al cambiar de apartado, sí empieza arriba.
  const panelAntes = cuerpo.querySelector(".editar-panel");
  const mismoApartado = Boolean(panelAntes) && panelAntes.dataset.apartado === apartado;
  const bajadoPanel = mismoApartado ? panelAntes.scrollTop : 0;
  const bajadoVentana = mismoApartado ? dialogo.scrollTop : 0;
  cuerpo.classList.add("editando");
  teñir(perfilEditado());
  const cambia = hayCambios();
  cuerpo.innerHTML = `
    <header class="editar-barra">
      <h2>${t("Editar perfil")}</h2>
      <span class="editar-nota">${errorEditar ? `<span class="perfil-error">${escaparHTML(errorEditar)}</span>` : cambia ? t("Hay cambios sin guardar") : ""}</span>
      <button class="editar-cancelar" ${guardando ? "disabled" : ""}>${t("Cancelar")}</button>
      <button class="editar-guardar" ${guardando || !cambia ? "disabled" : ""}>${icono("visto")} ${guardando ? t("Guardando...") : t("Guardar cambios")}</button>
    </header>
    <div class="editar-cuerpo">
      <nav class="editar-menu" aria-label="${t("Apartados")}">
        ${APARTADOS.map(
          (cada) => `<button class="${cada.id === apartado ? "activo" : ""}" data-apartado="${cada.id}">${icono(cada.icono)} ${cada.nombre()}</button>`
        ).join("")}
        <hr>
        <button class="peligro ${apartado === "cuenta" ? "activo" : ""}" data-apartado="cuenta">${icono("papelera")} ${t("Borrar mi cuenta")}</button>
      </nav>
      <div class="editar-panel" data-apartado="${apartado}">${PANELES[apartado]()}</div>
      <div class="editar-vista">
        <span class="editar-asi">${t("Así te ven")}</span>
        ${plantillaFicha(perfilEditado(), { mio: true, vistaPrevia: true })}
      </div>
    </div>`;
  cuerpo.querySelector(".editar-panel").scrollTop = bajadoPanel;
  dialogo.scrollTop = bajadoVentana;
}

// Al escribir no se repinta todo (se perdería el cursor): solo la ficha y la barra
function refrescarVistaPrevia() {
  const vista = cuerpo.querySelector(".editar-vista");
  if (!vista || !borrador) return;
  vista.innerHTML = `<span class="editar-asi">${t("Así te ven")}</span>${plantillaFicha(perfilEditado(), { mio: true, vistaPrevia: true })}`;
  const cambia = hayCambios();
  const nota = cuerpo.querySelector(".editar-nota");
  if (nota && !errorEditar) nota.textContent = cambia ? t("Hay cambios sin guardar") : "";
  const guardar = cuerpo.querySelector(".editar-guardar");
  if (guardar) guardar.disabled = guardando || !cambia;
}

// --- Equipos destacados, en el borrador ---

// Lo justo para pintarlo y para copiarlo como paste. JSON de ida y vuelta para quitar los
// «undefined», que Firestore no acepta.
function copiaDeEquipo(equipo) {
  return JSON.parse(
    JSON.stringify({
      id: equipo.id,
      nombre: equipo.nombre || t("Equipo"),
      pokemon: equipo.pokemon.map((p) => ({ ...pokemonParaCopia(p), cara: p.cara || "" })),
      paste: pasteDelEquipo(equipo.pokemon)
    })
  );
}

// Pulsar uno de tus equipos lo destaca; si ya lo estaba, lo quita
function alternarDestacado(id) {
  const lista = borrador.escaparate;
  const posicion = lista.findIndex((equipo) => equipo.id === id);
  if (posicion >= 0) {
    lista.splice(posicion, 1);
  } else {
    if (lista.length >= MAX_DESTACADOS) return;
    const equipo = leerGuardados().find((cada) => cada.id === id);
    if (equipo) lista.push(copiaDeEquipo(equipo));
  }
}

// paso: -1 sube, +1 baja
function moverDestacado(indice, paso) {
  const lista = borrador.escaparate;
  const otro = indice + paso;
  if (otro < 0 || otro >= lista.length) return;
  [lista[indice], lista[otro]] = [lista[otro], lista[indice]];
}

// ---------- Abrir ----------

export function abrirMiPerfil() {
  if (!usuarioActual()) return;
  viendo = null;
  desdeMiPerfil = false;
  historialEntero = false;
  verLogros = false;
  pintar();
  if (!dialogo.open) dialogo.showModal();
}

export function abrirPerfilDe(uid, desdeElMio = false) {
  viendo = uid;
  desdeMiPerfil = desdeElMio;
  historialEntero = false;
  verLogros = false;
  pintar();
  if (!dialogo.open) dialogo.showModal();

  // Quien no tiene amistad ni solicitud contigo no está en la lista en vivo: se pide el perfil
  // cada vez que se abre (lo último que se vio se enseña mientras llega)
  if (!perfilesDeAmigos().has(uid)) {
    perfilesDe([uid])
      .then((mapa) => {
        ajenos.set(uid, mapa.get(uid));
        if (dialogo.open && viendo === uid) pintar();
      })
      .catch((error) => console.error("No se ha podido leer el perfil", error));
  }
}

// Cerrar la ventana (con la aspa, pulsando fuera o con Escape). Si estás editando con cambios,
// antes se pregunta.
async function cerrarPerfil() {
  if (editando && !(await dejarDeEditar())) return;
  dialogo.close();
}

// «Amigos» → palmarés: la misma ventana para apuntar los lockes jugados a mano
async function gestionarPalmares() {
  const { prepararSeccion } = await import("./navegacion.js");
  const amigos = await prepararSeccion("amigos");
  amigos.abrirPalmares();
}

// «Retar a un locke» (en el perfil de un amigo): a «Lockes», con la ventana de crear uno y
// ese amigo ya puesto para invitarlo
async function retar(uid) {
  dialogo.close();
  const { prepararSeccion } = await import("./navegacion.js");
  await irA("lockes");
  const lockes = await prepararSeccion("versus");
  await lockes.retarA(uid);
}

// «Añadir a amigos» o «Aceptar solicitud» en el perfil de alguien que aún no es amigo. Al
// cambiar la lista de amistades el perfil se vuelve a pintar solo.
async function responderAmistad(boton) {
  const uid = viendo;
  boton.disabled = true;
  if (boton.dataset.accion === "aceptar") {
    const amistad = amistades().find((cada) => cada.otro === uid);
    if (amistad) await aceptarAmistad(amistad.id);
  } else {
    await pedirAmistad(uid);
  }
}

// ---------- Foto (un Pokémon) ----------
//
// La ventana de la foto no guarda: lo elegido pasa al borrador del modo editar (borrador.foto) y
// se guarda con «Guardar cambios».

// { id, es, forma, cara } · forma: {} la normal, o { etiqueta, idForma, formaPMD, imagenForma? }
// (Mega, Alola...: se pregunta como en el creador de equipos, ver js/comun/elegir-forma.js).
// cara: la de Mundo Misterioso que se ha elegido pulsando la muestra (Normal, Happy...).
// Con la foto que ya tenías (sin buscar otro Pokémon): { id, normales, cara }, con normales
// las direcciones de su cara normal, sacadas de la foto guardada.
let avatarElegido = null;
let eligiendoAvatar = null; // la elección en curso (mientras sale la ventana de la forma)
const listaPokemon = [];

// Las direcciones de su cara normal: las de su retrato de Mundo Misterioso (el de la forma)
function normalesAvatar(elegido) {
  if (elegido.normales) return elegido.normales;
  const { idForma, formaPMD } = elegido.forma || {};
  return urlsRetrato({ id: elegido.id, idForma, formaPMD });
}

// Su retrato con la cara elegida y, si esa no la tiene, el normal
function urlsAvatar(elegido) {
  const normales = normalesAvatar(elegido);
  const cara = elegido.cara || "Normal";
  if (cara === "Normal") return normales;
  return [...normales.map((url) => url.replace(/Normal\.png$/, `${cara}.png`)), ...normales];
}

// La foto que llevas (la del borrador), si es un retrato de Mundo Misterioso: así se le puede
// cambiar la cara sin volver a buscar el Pokémon
const RETRATO_PMD = /PMDCollab\/SpriteCollab\/.+\/([^/]+)\.png$/;

function avatarDeMiFoto() {
  const mio = perfilEditado();
  const encontrada = typeof mio.foto === "string" && typeof mio.avatar === "number" && mio.foto.match(RETRATO_PMD);
  if (!encontrada) return null;
  return { id: mio.avatar, normales: [mio.foto.replace(/[^/]+\.png$/, "Normal.png")], cara: encontrada[1] };
}

function pintarMuestra() {
  const muestra = dialogoAvatar.querySelector(".avatar-muestra");
  muestra.innerHTML = !avatarElegido
    ? plantillaFoto(perfilEditado(), "perfil-foto")
    : avatarElegido.subida
      ? `<img src="${avatarElegido.subida}" alt="">`
      : imagenConRespaldo(urlsAvatar(avatarElegido), `alt=""`);
  // Se puede pulsar para cambiar de cara si es un Pokémon (el elegido o el que ya tenías)
  const conCaras = avatarElegido ? !avatarElegido.subida : Boolean(avatarDeMiFoto());
  muestra.disabled = !conCaras;
  muestra.title = conCaras ? t("Pulsa para cambiarle la cara") : "";
  if (conCaras) muestra.insertAdjacentHTML("beforeend", `<span class="avatar-cara">${icono("refrescar")}</span>`);
}

// La siguiente cara que tenga (las que no existen se saltan). Si solo tiene una, se sacude
let cambiandoCara = false;

async function siguienteCara() {
  if (cambiandoCara) return;
  if (!avatarElegido) avatarElegido = avatarDeMiFoto();
  if (!avatarElegido || avatarElegido.subida) return;
  const muestra = dialogoAvatar.querySelector(".avatar-muestra");
  cambiandoCara = true;
  muestra.classList.add("cambiando-cara");
  try {
    const lista = await carasDisponibles(normalesAvatar(avatarElegido));
    if (lista.length > 1) {
      const actual = lista.findIndex((cara) => cara.emocion === (avatarElegido.cara || "Normal"));
      avatarElegido.cara = lista[(actual + 1) % lista.length].emocion;
      pintarMuestra();
    } else {
      muestra.classList.remove("sin-mas-caras");
      void muestra.offsetWidth; // reinicia la animación si se pulsa varias veces seguidas
      muestra.classList.add("sin-mas-caras");
    }
  } finally {
    cambiandoCara = false;
    muestra.classList.remove("cambiando-cara");
  }
}

// Elegida la especie: si tiene varias formas, se pregunta cuál (cancelar = la normal)
async function elegirAvatar(pokemon) {
  avatarElegido = { id: pokemon.id, es: pokemon.es, en: pokemon.en, forma: {}, cara: "Normal" };
  campoAvatar.value = nombreDe(pokemon);
  pintarMuestra();

  let info = { especie: "", lista: [] };
  try {
    info = await obtenerVariedades(pokemon.id);
  } catch (error) {
    // sin información de formas: la normal
  }
  if (info.lista.length < 2) return;

  const slug = await elegirForma(pokemon, info);
  try {
    const forma = slug ? await datosDeForma(info, slug) : {};
    if (forma.etiqueta) {
      avatarElegido = { ...avatarElegido, forma };
      campoAvatar.value = `${nombreDe(pokemon)} (${forma.etiqueta})`;
      pintarMuestra();
    }
  } catch (error) {
    console.error(error); // sin conexión: se queda la normal
  }
}

function abrirAvatar() {
  avatarElegido = null;
  dialogoAvatar.querySelector(".avatar-pokemon").value = "";
  dialogoAvatar.querySelector(".avatar-error").textContent = "";
  const mio = perfilEditado();
  dialogoAvatar.querySelector(".avatar-quitar").hidden = !mio.foto;
  const usuario = usuarioActual();
  dialogoAvatar.querySelector(".avatar-google").hidden = !(usuario && usuario.photoURL) || Boolean(mio.fotoGoogle);
  pintarMuestra();
  dialogoAvatar.showModal();
  dialogoAvatar.querySelector(".avatar-pokemon").focus();
  cargarDatos()
    .then(() => listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon))
    .catch((error) => console.error(error));
}

// Lo elegido en la ventana de la foto pasa al borrador
function ponerFoto(foto) {
  if (borrador) borrador.foto = foto;
  dialogoAvatar.close();
  pintar();
}

// ---------- Foto (una tuya, subida) ----------
//
// Firebase Storage pediría el plan de pago: la foto se recorta en cuadrado (desde el centro),
// se reduce a LADO_FOTO píxeles y se guarda como texto (data:) en el propio perfil, como los
// retratos de los level caps propios (comun/personalizados.js). Ocupa unos pocos KB.

const LADO_FOTO = 160;

async function fotoRecortada(archivo) {
  if (!archivo || !archivo.type.startsWith("image/")) throw new Error("no-es-imagen");
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise((cumplir, fallar) => {
      const elemento = new Image();
      elemento.onload = () => cumplir(elemento);
      elemento.onerror = fallar;
      elemento.src = url;
    });
    const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight);
    const salida = Math.min(LADO_FOTO, lado);
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = salida;
    const contexto = lienzo.getContext("2d");
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(
      imagen,
      (imagen.naturalWidth - lado) / 2, (imagen.naturalHeight - lado) / 2, lado, lado,
      0, 0, salida, salida
    );
    const webp = lienzo.toDataURL("image/webp", 0.82);
    return webp.startsWith("data:image/webp") ? webp : lienzo.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function subirFoto(archivo) {
  const error = dialogoAvatar.querySelector(".avatar-error");
  error.textContent = "";
  try {
    avatarElegido = { subida: await fotoRecortada(archivo) };
    campoAvatar.value = "";
    pintarMuestra();
  } catch (e) {
    console.error(e);
    error.textContent = t("Esa imagen no se puede usar. Prueba con otra.");
  }
}

// La foto es la dirección de su retrato (si no tiene, la del sprite pequeño): así sale igual
// en todas partes donde ya se pinta la foto de alguien (Amigos, Versus...). La subida, tal cual.
async function elegirFotoDelDialogo() {
  if (eligiendoAvatar) await eligiendoAvatar;
  if (!avatarElegido) {
    dialogoAvatar.querySelector(".avatar-error").textContent = t("Elige un Pokémon de la lista o sube una foto.");
    return;
  }
  if (avatarElegido.subida) {
    ponerFoto({ avatar: "propia", fotoGoogle: false, foto: avatarElegido.subida });
    return;
  }
  const opciones = urlsAvatar(avatarElegido);
  let foto = opciones[opciones.length - 1];
  for (const url of opciones) {
    if (await precargarImagen(url)) {
      foto = url;
      break;
    }
  }
  ponerFoto({ avatar: avatarElegido.id, fotoGoogle: false, foto });
}

// ---------- Eventos ----------

function siFalla(error) {
  console.error(error);
  errorEditar = t("No se ha podido guardar. Inténtalo otra vez.");
  pintar();
}

// Lo que se pulsa en el modo editar (devuelve si era de ahí)
function alPulsarEditando(boton) {
  if (boton.dataset.apartado) {
    apartado = boton.dataset.apartado;
    errorEditar = "";
  } else if (boton.classList.contains("editar-cancelar")) {
    dejarDeEditar().then((salio) => salio && pintar()).catch(siFalla);
    return true;
  } else if (boton.classList.contains("editar-guardar")) {
    guardarCambios();
    return true;
  } else if (boton.classList.contains("editar-cambiar-foto")) {
    abrirAvatar();
    return true;
  } else if (boton.classList.contains("editar-titulo")) {
    borrador.titulo = boton.dataset.titulo || null;
  } else if (boton.classList.contains("editar-marco")) {
    borrador.marco = boton.dataset.marco || "";
  } else if (boton.classList.contains("editar-fondo")) {
    borrador.fondo = boton.dataset.fondo || null;
  } else if (boton.classList.contains("editar-color")) {
    borrador.color = boton.dataset.color === "celeste" ? "" : boton.dataset.color;
  } else if (boton.classList.contains("editar-equipo")) {
    alternarDestacado(boton.dataset.id);
  } else if (boton.classList.contains("editar-subir")) {
    moverDestacado(Number(boton.dataset.indice), -1);
  } else if (boton.classList.contains("editar-bajar")) {
    moverDestacado(Number(boton.dataset.indice), 1);
  } else if (boton.classList.contains("editar-quitar")) {
    borrador.escaparate.splice(Number(boton.dataset.indice), 1);
  } else if (boton.classList.contains("editar-palmares")) {
    gestionarPalmares().catch(siFalla);
    return true;
  } else {
    return false; // (Borrar mi cuenta lo atiende sesion.js)
  }
  pintar();
  return true;
}

cuerpo.addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (!boton) return;

  if (editando && !viendo) {
    alPulsarEditando(boton);
    return;
  }

  if (boton.classList.contains("perfil-editar")) empezarAEditar();
  else if (boton.classList.contains("perfil-volver-mio")) abrirMiPerfil();
  else if (boton.classList.contains("perfil-amistad")) responderAmistad(boton).catch(siFalla);
  else if (boton.classList.contains("perfil-chat")) {
    const uid = viendo;
    dialogo.close();
    import("./chat.js").then((modulo) => modulo.abrirChat(uid)).catch(siFalla);
  } else if (boton.classList.contains("perfil-retar")) retar(viendo).catch(siFalla);
  else if (boton.classList.contains("perfil-copiar")) copiarEquipo(boton).catch((error) => console.error(error));
  else if (boton.classList.contains("perfil-ver-lockes")) {
    historialEntero = !historialEntero;
    pintar();
  } else if (boton.classList.contains("perfil-ver-logros")) {
    if (viendo) {
      verLogros = true;
      pintar();
    } else {
      dialogo.close();
      irA("logros");
    }
  } else if (boton.classList.contains("perfil-cerrar-logros")) {
    verLogros = false;
    pintar();
  } else if (boton.hasAttribute("data-ir-coleccion")) {
    dialogo.close();
    import("./tienda/index.js").then(({ abrirPestana }) => {
      abrirPestana("huevos");
      irA("tienda");
    });
  } else if (boton.classList.contains("perfil-ver-amigos")) {
    dialogo.close();
    irA("amigos");
  } else if (boton.classList.contains("perfil-amigo")) {
    // Desde el perfil de un amigo se puede llegar al tuyo (entre sus amigos estás tú)
    if (boton.dataset.uid === (usuarioActual() || {}).uid) abrirMiPerfil();
    else abrirPerfilDe(boton.dataset.uid, !viendo || desdeMiPerfil);
  }
});

// Lo que se escribe va al borrador (sin repintar todo: solo la ficha de la derecha)
cuerpo.addEventListener("input", (e) => {
  if (!borrador) return;
  const campo = e.target;
  if (campo.classList.contains("editar-nombre")) borrador.mote = campo.value;
  else if (campo.classList.contains("editar-sobre-mi")) borrador.sobreMi = campo.value;
  else if (campo.classList.contains("editar-horario")) borrador.horario = campo.value;
  else if (campo.classList.contains("editar-busca")) borrador.busca = campo.checked;
  else return;
  if (campo.classList.contains("editar-nombre") && errorEditar) {
    errorEditar = "";
    const nota = cuerpo.querySelector(".editar-nota");
    if (nota) nota.textContent = "";
  }
  refrescarVistaPrevia();
});

// Enter en el nombre o el horario guarda (como en cualquier formulario)
cuerpo.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches(".editar-nombre, .editar-horario")) {
    e.preventDefault();
    if (hayCambios()) guardarCambios();
  }
});

const botonCerrar = dialogo.querySelector(".perfil-cerrar");
botonCerrar.innerHTML = icono("aspa");
botonCerrar.addEventListener("click", () => cerrarPerfil().catch(siFalla));
dialogo.addEventListener("cancel", (e) => {
  // Escape: con cambios sin guardar, se pregunta antes
  if (editando && hayCambios()) {
    e.preventDefault();
    cerrarPerfil().catch(siFalla);
  }
});
dialogo.addEventListener("close", () => {
  editando = false;
  borrador = null;
  errorEditar = "";
});

// Pulsando fuera de la ventana (en lo oscuro de alrededor) se cierra. Tiene que empezar y
// acabar fuera: así no se cierra al seleccionar texto y soltar el ratón fuera.
const fueraDe = (e) => {
  const caja = dialogo.getBoundingClientRect();
  return e.target === dialogo &&
    (e.clientX < caja.left || e.clientX > caja.right || e.clientY < caja.top || e.clientY > caja.bottom);
};
let empezoFuera = false;
dialogo.addEventListener("pointerdown", (e) => (empezoFuera = fueraDe(e)));
dialogo.addEventListener("click", (e) => {
  if (empezoFuera && fueraDe(e)) cerrarPerfil().catch(siFalla);
  empezoFuera = false;
});

const campoAvatar = dialogoAvatar.querySelector(".avatar-pokemon");
campoAvatar.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && campoAvatar.parentElement.querySelector(".sugerencias .opcion")) e.preventDefault();
});
const autocompletadoAvatar = activarAutocompletado(campoAvatar, listaPokemon, (pokemon) => {
  eligiendoAvatar = elegirAvatar(pokemon).finally(() => (eligiendoAvatar = null));
}, { icono: iconoPokemon });
campoAvatar.addEventListener("input", () => (avatarElegido = null));
dialogoAvatar.querySelector(".avatar-formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!avatarElegido && campoAvatar.value.trim()) autocompletadoAvatar.elegirPrimera();
  elegirFotoDelDialogo().catch((error) => {
    console.error(error);
    dialogoAvatar.querySelector(".avatar-error").textContent = t("No se ha podido usar esa foto.");
  });
});
dialogoAvatar.querySelector(".avatar-cancelar").addEventListener("click", () => dialogoAvatar.close());
dialogoAvatar.querySelector(".avatar-muestra").addEventListener("click", () => {
  siguienteCara().catch((error) => console.error(error));
});
const archivoAvatar = dialogoAvatar.querySelector(".avatar-archivo");
dialogoAvatar.querySelector(".avatar-subir").addEventListener("click", () => archivoAvatar.click());
archivoAvatar.addEventListener("change", () => {
  if (archivoAvatar.files[0]) subirFoto(archivoAvatar.files[0]).catch((error) => console.error(error));
  archivoAvatar.value = ""; // para poder elegir la misma otra vez
});
// Sin foto. La de Google no sale sola: solo si se pide con «Usar mi foto de Google» (se enseña a
// cualquiera con cuenta, así que es una decisión de cada uno)
dialogoAvatar.querySelector(".avatar-quitar").addEventListener("click", () => {
  ponerFoto({ avatar: null, fotoGoogle: false, foto: "" });
});
dialogoAvatar.querySelector(".avatar-google").addEventListener("click", () => {
  const usuario = usuarioActual();
  if (usuario && usuario.photoURL) ponerFoto({ avatar: null, fotoGoogle: true, foto: usuario.photoURL });
});

// Al día mientras está abierto: tu perfil, el del amigo, quién está conectado. Editando, solo
// la ficha (el resto es el borrador, y repintarlo quitaría el cursor de donde escribes).
const repintar = () => {
  if (!dialogo.open) return;
  if (editando && !viendo) refrescarVistaPrevia();
  else pintar();
};
alCambiarMiPerfil(repintar);
alCambiarColeccion(repintar); // tu colección, en tu perfil
alCambiarPerfilesAmigos(repintar);
alCambiarAmistades(repintar);
alCambiarChats(repintar);
alCambiarPresencia(repintar);
alCambiarLockes(repintar);
