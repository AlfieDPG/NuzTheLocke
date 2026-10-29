// Ventana del perfil: el tuyo (desde el desplegable de tu nombre), el de un amigo (desde tu
// lista de amigos o desde «Amigos») o el de cualquiera desde el foro. Quien no es amigo ve solo
// lo básico (foto, nombre, título, lockes jugados y ganados y su «sobre mí») y un botón para pedirle
// amistad. En vertical, una cosa debajo de otra:
//
//   · «Sobre mí»: una frase, un horario y si busca compañeros (lo escribe cada uno; lo ve cualquiera).
//   · Foto: la de Google o un Pokémon (su retrato de Mundo Misterioso). En el tuyo, pulsándola
//     se cambia.
//   · Nombre, con un lápiz para cambiarlo (es el nombre de usuario, ver perfiles.js).
//   · Título: el nombre de uno de sus logros, el que elija.
//   · Lockes jugados (los terminados, ganados o no) y ganados y, en el tuyo, amigos; en el de un amigo, los lockes jugados juntos en
//     total (los mismos que cuenta la rivalidad de «Amigos»: js/comun/cara-a-cara.js).
//   · Equipos destacados: los que cada uno elige enseñar (hasta MAX_DESTACADOS). En otra
//     ventana el dueño los ordena. Se guarda
//     una copia en el perfil (escaparate), que es lo que pueden leer los demás: tus equipos de
//     verdad son privados.
//   · En el tuyo, tus VER_AMIGOS amigos con los que más lockes has jugado: pulsando uno se ve
//     su perfil. Todos están en «Amigos».
//   · Pestaña «Logros»: los que tiene esa persona (js/comun/logros.js).
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
  FONDOS, FONDOS_METAL, FONDOS_TIPO, FONDOS_EEVEE, FONDOS_TIENDA, FONDOS_REGION, fondoDe, logrosDe, desbloqueado, requisito, requisitoCorto,
  claseFondo, estiloFondo
} from "./comun/fondos.js";
import { TITULOS, MARCOS, loTiene, tieneMarco, marcoDe, claseMarco, claseTitulo } from "./comun/fichas.js";
import { miColeccion, escucharColeccion, alCambiarColeccion, coleccionDe, escaparate, aspectoDe } from "./comun/coleccion.js";
import { t, LOCALE, nombre as nombreDe } from "./comun/idioma.js";

const MAX_DESTACADOS = 3;    // los equipos que se pueden destacar (cada uno es una copia dentro del perfil)
const VER_AMIGOS = 5;
const VER_GANADOS = 6;       // lockes ganados que se ven en tu perfil (el resto, al gestionarlos)

const dialogo = document.querySelector("#dialogo-perfil");
const cuerpo = dialogo.querySelector(".perfil-cuerpo");
const dialogoAvatar = document.querySelector("#dialogo-avatar");
const dialogoEscaparate = document.querySelector("#dialogo-escaparate");
const dialogoDestacados = document.querySelector("#dialogo-destacados");
const dialogoTitulo = document.querySelector("#dialogo-titulo");

const ajenos = new Map();    // uid -> perfil de alguien que no es amigo (se pide al abrirlo)

let viendo = null;           // uid de la persona cuyo perfil se ve, o null si es el tuyo
let desdeMiPerfil = false;   // se llegó al del amigo desde tu lista (sale «Volver»)
let pestana = "perfil";      // "perfil" o "logros"
let editandoNombre = false;
let errorNombre = "";

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

// ordenar: en la ventana de todos los destacados, el dueño los sube y los baja
function plantillaEquipo(equipo, indice, mio, ordenar = false, total = 0) {
  const mover = ordenar
    ? `<button class="perfil-subir-equipo" data-indice="${indice}" title="${t("Subir")}" ${indice === 0 ? "disabled" : ""}>${icono("arriba")}</button>
       <button class="perfil-bajar-equipo" data-indice="${indice}" title="${t("Bajar")}" ${indice === total - 1 ? "disabled" : ""}>${icono("abajo")}</button>`
    : "";
  return `
    <article class="perfil-equipo">
      <header>
        <strong>${escaparHTML(equipo.nombre)}</strong>
        <div class="perfil-equipo-botones">
          ${mover}
          <button class="perfil-copiar" data-indice="${indice}" title="${t("Copiar como paste")}">${icono("copiar")}</button>
          ${mio ? `<button class="perfil-quitar-equipo" data-indice="${indice}" title="${t("Dejar de destacar")}">${icono("aspa")}</button>` : ""}
        </div>
      </header>
      <div class="perfil-equipo-caras">${(equipo.pokemon || []).map(caraDe).join("")}</div>
    </article>`;
}

// El nombre y, al cambiarlo, la casilla en el mismo sitio y del mismo alto: no se mueve nada
function plantillaNombre(perfil, mio) {
  if (mio && editandoNombre) {
    return `
      <form class="perfil-nombre-fila perfil-nombre-form">
        <input class="perfil-nombre-campo" type="text" maxlength="20" autocomplete="off" value="${escaparHTML(perfil.mote || "")}">
        <button type="submit" class="perfil-nombre-ok" title="${t("Guardar")}">${icono("visto")}</button>
        <button type="button" class="perfil-nombre-cancelar" title="${t("Cancelar")}">${icono("aspa")}</button>
      </form>`;
  }
  return `
    <div class="perfil-nombre-fila">
      <h2 class="perfil-nombre">${escaparHTML(perfil.nombre)}</h2>
      ${mio ? `<button class="perfil-editar-nombre" title="${t("Cambiar nombre")}">${icono("lapiz")}</button>` : ""}
    </div>`;
}

// El título: el nombre de uno de sus logros o uno comprado en la Tienda de «Juegos»
// (js/comun/fichas.js), el que haya elegido (perfil.titulo), debajo del nombre. Solo si lo
// tiene. En el tuyo, pulsándolo se cambia.
const TITULOS_TIENDA = TITULOS.map((titulo) => ({ ...titulo, icono: "estrella", descripcion: t("Comprado en la Tienda.") }));

function tituloDe(perfil) {
  const logro = LOGROS.find((cada) => cada.id === perfil.titulo);
  if (logro) return (perfil.logros || {})[logro.id] ? logro : null;
  const comprado = TITULOS_TIENDA.find((cada) => cada.id === perfil.titulo);
  return comprado && loTiene(perfil, comprado.id) ? comprado : null;
}

function plantillaTitulo(perfil, mio) {
  const logro = tituloDe(perfil);
  if (mio) {
    return `<button class="perfil-titulo ${logro ? claseTitulo(logro) : "sin-titulo"}" title="${t("Cambiar título")}" ${editandoNombre ? "disabled" : ""}>
              ${escaparHTML(logro ? logro.nombre : t("Elegir título"))}
            </button>`;
  }
  return logro ? `<span class="perfil-titulo ${claseTitulo(logro)}">${escaparHTML(logro.nombre)}</span>` : "";
}

function pintarTitulos() {
  const perfil = miPerfil() || {};
  const tengo = perfil.logros || {};
  const conseguidos = [...TITULOS_TIENDA.filter((titulo) => loTiene(perfil, titulo.id)), ...LOGROS.filter((logro) => tengo[logro.id])];
  dialogoTitulo.querySelector(".titulo-lista").innerHTML = conseguidos.length
    ? conseguidos
        .map(
          (logro) => `
            <button class="titulo-opcion ${logro.id === perfil.titulo ? "elegido" : ""}" data-logro="${escaparHTML(logro.id)}"
                    title="${escaparHTML(logro.descripcion)}">
              ${insignia(logro, true)}
              <span class="perfil-titulo ${claseTitulo(logro)}">${escaparHTML(logro.nombre)}</span>
            </button>`
        )
        .join("")
    : `<p class="perfil-vacio">${t("Todavía no tienes logros.")}</p>`;
  dialogoTitulo.querySelector(".titulo-quitar").hidden = !tituloDe(perfil);
}

async function ponerTitulo(id) {
  await guardarMiPerfil({ titulo: id });
  dialogoTitulo.close();
}

// El fondo de tu tarjeta de «Amigos» (js/comun/fondos.js). En el perfil, solo unos pocos (el
// que llevas y otros que ya tienes) y un «+» que abre una ventana con todos: los de metal, los
// 18 de tipo y los de Eevee, los que aún no tienes con un candado y lo que piden.
const VER_FONDOS = 3;
const SIN_FONDO = { id: "", nombre: t("Sin fondo") };
const dialogoFondos = document.querySelector("#dialogo-fondos");

function muestraFondo(fondo, perfil) {
  const libre = !fondo.id || desbloqueado(fondo, perfil);
  // A los de metal les sirve saber cuántos logros llevas; a los demás, no
  const metal = FONDOS_METAL.includes(fondo);
  const pide = `${requisito(fondo)}${metal ? ` ${t("(tienes {n} logros)", { n: logrosDe(perfil) })}` : ""}`;
  const corto = libre ? "" : requisitoCorto(fondo);
  return `
    <button class="perfil-fondo ${claseFondo(fondo.id)} ${fondo.id === fondoDe(perfil) ? "elegido" : ""}"
            style="${estiloFondo(fondo.id)}" data-fondo="${fondo.id}" ${libre ? "" : "disabled"}
            title="${escaparHTML(libre ? fondo.nombre : pide)}">
      <span class="perfil-fondo-nombre">${libre ? "" : icono("candado")} ${fondo.nombre}</span>
      ${corto ? `<small>${corto}</small>` : ""}
    </button>`;
}

function plantillaFondos(perfil) {
  const puesto = fondoDe(perfil);
  const todos = [SIN_FONDO, ...FONDOS];
  // El puesto primero; luego «Sin fondo» y los que ya tienes (los más nuevos de metal antes)
  const libres = [...FONDOS_METAL].reverse().concat(FONDOS_REGION, FONDOS_TIENDA, FONDOS_TIPO, FONDOS_EEVEE).filter((fondo) => desbloqueado(fondo, perfil));
  const pocos = [todos.find((fondo) => fondo.id === puesto) || SIN_FONDO, SIN_FONDO, ...libres]
    .filter((fondo, i, lista) => lista.indexOf(fondo) === i)
    .slice(0, VER_FONDOS);
  const quedan = todos.length - pocos.length;
  return `
    <section class="perfil-apartado">
      <h3>${t("Fondo de tu tarjeta")}</h3>
      <div class="perfil-fondos">
        ${pocos.map((fondo) => muestraFondo(fondo, perfil)).join("")}
        <button class="perfil-fondo perfil-fondos-mas" title="${t("Ver todos los fondos")}">${icono("mas")}<small>${t("{n} más", { n: quedan })}</small></button>
      </div>
    </section>`;
}

// La ventana con todos, por apartados
function pintarFondos() {
  const perfil = miPerfil() || {};
  const apartado = (titulo, fondos, clase = "") => {
    const tengo = fondos.filter((fondo) => !fondo.id || desbloqueado(fondo, perfil)).length;
    return `
      <section class="fondos-apartado">
        <h3>${titulo} <small>${tengo}/${fondos.length}</small></h3>
        <div class="perfil-fondos ${clase}">${fondos.map((fondo) => muestraFondo(fondo, perfil)).join("")}</div>
      </section>`;
  };
  dialogoFondos.querySelector(".fondos-lista").innerHTML =
    apartado(t("Básicos"), [SIN_FONDO, ...FONDOS_METAL]) +
    apartado(t("De la Tienda"), FONDOS_TIENDA) +
    apartado(t("De región"), FONDOS_REGION) +
    apartado("Eevee", FONDOS_EEVEE, "perfil-fondos-eevee") +
    apartado(t("Tipos"), FONDOS_TIPO, "perfil-fondos-tipo");
}

// El marco de tu foto (js/comun/fichas.js): «Sin marco» y los que tienes (comprados en la
// Tienda de «Juegos» o, los de metal, por logros). Los demás se ven en la Tienda.
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
    <section class="perfil-apartado perfil-coleccion">
      <h3>
        ${t("Colección")}
        <small class="perfil-cuenta">${t("{n} especies", { n: especies })}${shiny ? ` · ${icono("estrella")} ${shiny}` : ""}</small>
        ${mio ? `<button class="perfil-ir-tienda" data-ir-coleccion>${icono("huevo")} ${t("Ir")}</button>` : ""}
      </h3>
      ${muestra.length
        ? `<div class="perfil-coleccion-muestra">${muestra
            .map(({ id }) => {
              const { cara, shiny: enShiny } = aspectoDe(coleccion, id);
              return `<span class="perfil-coleccion-poke ${enShiny ? "shiny" : ""}" title="${escaparHTML(nombreDeEspecie(id))}">
                        ${imagenConRespaldo(urlsPMDEmocion({ id, shiny: enShiny }, cara), `alt="" loading="lazy" data-quitar-si-falla`)}
                      </span>`;
            })
            .join("")}</div>
           ${coleccion.destacados.length ? `<small class="perfil-coleccion-nota">${mio ? t("Tus destacados (se eligen en la colección)") : t("Sus destacados")}</small>` : ""}`
        : `<p class="perfil-vacio">${mio ? t("Abre huevos en «Juegos» → «Colección» para empezarla.") : t("Todavía no ha abierto ningún huevo.")}</p>`}
    </section>`;
}

function plantillaMarcos(perfil) {
  const puesto = marcoDe(perfil);
  const tuyos = MARCOS.filter((marco) => tieneMarco(perfil, marco));
  const muestra = (id, nombre) => `
    <button class="perfil-marco ${id === puesto ? "elegido" : ""}" data-marco="${id}" title="${escaparHTML(nombre)}">
      <span class="perfil-marco-foto ${claseMarco(id)}">${plantillaFoto(perfil, "perfil-foto")}</span>
      <small>${escaparHTML(nombre)}</small>
    </button>`;
  return `
    <section class="perfil-apartado">
      <h3>
        ${t("Marco de tu foto")}
        <button class="perfil-ir-tienda">${icono("mas")} ${t("Tienda")}</button>
      </h3>
      <div class="perfil-marcos">
        ${muestra("", t("Sin marco"))}
        ${tuyos.map((marco) => muestra(marco.id, marco.nombre)).join("")}
      </div>
      ${tuyos.length ? "" : `<p class="perfil-vacio">${t("Consigue marcos en la Tienda de «Juegos» con tus Pokédólares.")}</p>`}
    </section>`;
}

// Lockes jugados juntos en total (los de Versus, en marcha o terminados, y los apuntados a
// mano): lo mismo que la rivalidad de «Amigos»
function lockesJuntos(amigo) {
  const mio = miPerfil();
  return mio && amigo ? caraACara(mio, amigo).juntos : 0;
}

function textoLockes(cuantos) {
  return t(cuantos === 1 ? "{n} locke" : "{n} lockes", { n: cuantos });
}

// Los VER_AMIGOS con los que más has jugado (a igualdad, los conectados y por nombre)
function plantillaAmigos() {
  const juntos = new Map(
    amigosAceptados()
      .map((amistad) => perfilesDeAmigos().get(amistad.otro))
      .filter(Boolean)
      .map((amigo) => [amigo.uid, lockesJuntos(amigo)])
  );
  const todos = amigosAceptados()
    .map((amistad) => perfilesDeAmigos().get(amistad.otro))
    .filter(Boolean)
    .sort(
      (uno, otro) =>
        (juntos.get(otro.uid) || 0) - (juntos.get(uno.uid) || 0) ||
        Number(estaConectado(otro.uid)) - Number(estaConectado(uno.uid)) ||
        uno.nombre.localeCompare(otro.nombre, LOCALE)
    );

  return `
    <section class="perfil-apartado">
      <h3>
        ${t("Amigos")}
        ${todos.length > VER_AMIGOS ? `<button class="perfil-ver-amigos">${t("Ver todos ({n})", { n: todos.length })}</button>` : ""}
      </h3>
      ${todos.length
        ? `<div class="perfil-amigos">${todos
            .slice(0, VER_AMIGOS)
            .map(
              (amigo) => `
                <button class="perfil-amigo ${estaConectado(amigo.uid) ? "conectado" : ""}" data-uid="${escaparHTML(amigo.uid)}"
                        title="${escaparHTML(amigo.nombre)}">
                  ${plantillaFoto(amigo, "perfil-amigo-foto")}
                  <span class="perfil-amigo-nombre">${escaparHTML(amigo.nombre)}</span>
                  <small>${textoLockes(juntos.get(amigo.uid) || 0)}</small>
                </button>`
            )
            .join("")}</div>`
        : `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`}
    </section>`;
}

// ---------- En el perfil de un amigo ----------
//
// Sus fondos desbloqueados (solo para ver) y sus amigos. Sus amigos salen de su perfil
// (perfil.amigos, lo apunta cada uno: ver perfiles.js), que se pide la primera vez. Los que
// también son amigos tuyos (o tú) se pueden pulsar para ver su perfil.

function plantillaFondosDe(perfil) {
  const puesto = fondoDe(perfil);
  const suyos = FONDOS.filter((fondo) => desbloqueado(fondo, perfil));
  return `
    <section class="perfil-apartado">
      <h3>${t("Fondos")} <small class="perfil-cuenta">${suyos.length}/${FONDOS.length}</small></h3>
      ${suyos.length
        ? `<div class="perfil-fondos perfil-fondos-suyos">${suyos
            .map(
              (fondo) => `
                <span class="perfil-fondo ${claseFondo(fondo.id)} ${fondo.id === puesto ? "elegido" : ""}"
                      style="${estiloFondo(fondo.id)}" title="${escaparHTML(fondo.nombre)}">
                  <span class="perfil-fondo-nombre">${escaparHTML(fondo.nombre)}</span>
                </span>`
            )
            .join("")}</div>`
        : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`}
    </section>`;
}

const amigosDeOtros = new Map(); // uid -> sus amigos (perfiles), cuando han llegado

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
    <section class="perfil-apartado">
      <h3>${t("Amigos")} <small class="perfil-cuenta">${uids.length}</small></h3>
      ${!uids.length
        ? `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`
        : !llegados
          ? `<p class="perfil-vacio">${t("Cargando...")}</p>`
          : `<div class="perfil-amigos">${lista
              .slice(0, VER_AMIGOS * 2)
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

// ---------- Lockes jugados ----------
//
// Los de tu palmarés (los de «Lockes» que ganas se apuntan solos; los de antes, a mano). Con
// «Gestionar» se abre la misma ventana que en «Amigos» para añadirlos o corregirlos. En el de
// un amigo, solo para ver.

// Todos los lockes terminados que ha jugado: los ganados con su corona y los demás sin ella
function plantillaPalmares(perfil, mio = true) {
  // El más reciente primero (los que no tienen fecha, al final), como en «Amigos»
  const jugados = lockesJugados(perfil)
    .map((ganado, i) => ({ ganado, i }))
    .sort((uno, otro) => String(otro.ganado.fechaFin || "").localeCompare(String(uno.ganado.fechaFin || "")) || otro.i - uno.i)
    .map(({ ganado }) => ganado);
  const color = (ganado) => colorDeTipo(ganado.tipo);
  return `
    <section class="perfil-apartado">
      <h3>
        ${t("Lockes jugados")}
        ${mio ? `<button class="perfil-palmares">${icono("lapiz")} ${t("Gestionar")}</button>` : ""}
      </h3>
      ${jugados.length
        ? `<div class="perfil-ganados">
            ${jugados
              .slice(0, VER_GANADOS)
              .map(
                (ganado) => `
                  <span class="perfil-ganado ${ganado.gano ? "" : "perdido"}" style="--color-locke: ${color(ganado)}"
                        title="${escaparHTML([(ganado.tipo || {}).nombre, ganado.gano ? t("Ganado") : ""].filter(Boolean).join(" · "))}">
                    ${ganado.gano ? icono("corona") : ""} ${escaparHTML(ganado.nombre || t("Locke"))}
                  </span>`
              )
              .join("")}
            ${jugados.length > VER_GANADOS ? `<span class="perfil-ganado mas">+${jugados.length - VER_GANADOS}</span>` : ""}
          </div>`
        : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`}
    </section>`;
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

// ---------- Sobre mí (en tu perfil) ----------

const dialogoSobreMi = document.querySelector("#dialogo-sobre-mi");
const campoSobreMi = dialogoSobreMi.querySelector(".sobre-mi-texto");
const campoHorario = dialogoSobreMi.querySelector(".sobre-mi-horario");
const campoBusca = dialogoSobreMi.querySelector(".sobre-mi-busca input");
const errorSobreMi = dialogoSobreMi.querySelector(".sobre-mi-error");

function abrirSobreMi() {
  const perfil = miPerfil() || {};
  campoSobreMi.value = perfil.sobreMi || "";
  campoHorario.value = perfil.horario || "";
  campoBusca.checked = Boolean(perfil.busca);
  errorSobreMi.textContent = "";
  dialogoSobreMi.showModal();
  campoSobreMi.focus();
}

async function guardarSobreMi() {
  await guardarMiPerfil({
    sobreMi: campoSobreMi.value.trim().slice(0, 200),
    horario: campoHorario.value.trim().slice(0, 40),
    busca: campoBusca.checked
  });
  dialogoSobreMi.close();
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

async function gestionarPalmares() {
  const { prepararSeccion } = await import("./navegacion.js");
  const amigos = await prepararSeccion("amigos");
  amigos.abrirPalmares();
}

// ---------- Salón de la fama ----------
//
// El equipo final y el MVP de cada locke terminado (perfil.salon, lo apunta cada uno desde
// el locke: js/versus/combates.js). Los VER_SALON últimos y el resto, al pulsar «Ver todos».

const VER_SALON = 3;
let salonEntero = false;

function plantillaSalon(perfil) {
  const salon = perfil.salon || [];
  if (!salon.length) return "";
  const visibles = salonEntero ? salon : salon.slice(0, VER_SALON);

  return `
    <section class="perfil-apartado">
      <h3>
        ${t("Salón de la fama")}
        ${salon.length > VER_SALON ? `<button class="perfil-ver-salon">${salonEntero ? t("Ver menos") : t("Ver todos ({n})", { n: salon.length })}</button>` : ""}
      </h3>
      <div class="perfil-equipos">
        ${visibles
          .map(
            (entrada) => `
              <article class="perfil-equipo perfil-salon ${entrada.gano ? "gano" : ""}">
                <header>
                  <strong>${entrada.gano ? icono("corona") : ""}${escaparHTML(entrada.locke || t("Locke"))}</strong>
                  ${entrada.fechaFin ? `<small>${escaparHTML(fechaLarga(entrada.fechaFin))}</small>` : ""}
                </header>
                <div class="perfil-equipo-caras">
                  ${(entrada.pokemon || [])
                    .map((p, i) => `<span class="salon-cara ${i === entrada.mvp ? "mvp" : ""}">${caraDe(p)}${i === entrada.mvp ? `<span class="salon-mvp">MVP</span>` : ""}</span>`)
                    .join("")}
                </div>
              </article>`
          )
          .join("")}
      </div>
    </section>`;
}

// ---------- Pestaña de logros ----------
//
// Los suyos (perfil.logros: { id: fecha }, ver js/comun/logros.js), del último al primero, y
// detrás, apagados, los que le faltan. Lo que pide cada uno, al pasar el ratón.

function plantillaLogrosDe(perfil) {
  const tengo = perfil.logros || {};
  const conseguidos = LOGROS.filter((logro) => tengo[logro.id]).sort((uno, otro) => tengo[otro.id] - tengo[uno.id]);
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
    <section class="perfil-apartado">
      ${conseguidos.length
        ? `<div class="perfil-logros">${conseguidos.map((logro) => ficha(logro, true)).join("")}</div>`
        : `<p class="perfil-vacio">${t("Todavía ninguno.")}</p>`}
      ${faltan.length
        ? `<h3 class="perfil-logros-faltan">${t("Por conseguir")} <small>${faltan.length}</small></h3>
           <div class="perfil-logros">${faltan.map((logro) => ficha(logro, false)).join("")}</div>`
        : ""}
    </section>`;
}

// ---------- Pintar ----------

function perfilQueSeVe() {
  return viendo ? perfilesDeAmigos().get(viendo) || ajenos.get(viendo) : miPerfil();
}

// Quien no es amigo (ni tú) ve solo lo básico: foto, nombre, título, lockes jugados y ganados y lo que
// haya escrito de sí mismo. El resto es de los amigos.
function conocido() {
  return !viendo || relacionCon(viendo) === "ok";
}

// Su «sobre mí»: lo que la persona escribe de sí misma, si busca compañeros y su horario. Lo
// ve cualquiera; en el tuyo, con un lápiz para cambiarlo.
function plantillaSobreMi(perfil, mio) {
  const texto = (perfil.sobreMi || "").trim();
  const horario = (perfil.horario || "").trim();
  if (!mio && !texto && !horario && !perfil.busca) return "";

  return `
    <section class="perfil-apartado perfil-sobre-mi">
      <h3>
        ${t("Sobre mí")}
        ${mio ? `<button class="perfil-editar-sobre-mi" title="${t("Editar")}" aria-label="${t("Editar")}">${icono("lapiz")}</button>` : ""}
      </h3>
      ${perfil.busca ? `<p class="perfil-busca">${icono("persona")} ${t("Busca compañeros para un locke")}</p>` : ""}
      ${texto ? `<p class="perfil-sobre-mi-texto">${escaparHTML(texto)}</p>` : ""}
      ${horario ? `<p class="perfil-horario"><strong>${t("Horario")}:</strong> ${escaparHTML(horario)}</p>` : ""}
      ${mio && !texto && !horario && !perfil.busca ? `<p class="perfil-vacio">${t("Cuenta algo de ti o di si buscas compañeros.")}</p>` : ""}
    </section>`;
}

// El botón de la cabecera de otra persona: retar a un locke si es amiga y, si no, lo que toque
// con la solicitud de amistad
function plantillaAccion(perfil) {
  switch (relacionCon(perfil.uid)) {
    case "ok":
      return `<div class="perfil-botones">
        <button class="perfil-retar perfil-chat">${icono("mensaje")} ${t("Chat")}</button>
        <button class="perfil-retar">${icono("espadas")} ${t("Retar a un locke")}</button>
      </div>`;
    case "enviada":
      return `<span class="perfil-solicitud">${t("Solicitud de amistad enviada")}</span>`;
    case "recibida":
      return `<button class="perfil-retar perfil-amistad" data-accion="aceptar">${icono("personaMas")} ${t("Aceptar solicitud de amistad")}</button>`;
    default:
      // A quien has bloqueado no se le pide amistad sin desbloquearlo antes
      return estaBloqueado(perfil.uid)
        ? `<span class="perfil-solicitud">${t("Lo has bloqueado")}</span>`
        : `<button class="perfil-retar perfil-amistad" data-accion="pedir">${icono("personaMas")} ${t("Añadir a amigos")}</button>`;
  }
}

function pintar() {
  const perfil = perfilQueSeVe();
  const mio = !viendo;
  if (!perfil) {
    cuerpo.innerHTML = viendo ? `<p class="perfil-vacio">${t("Cargando...")}</p>` : "";
    return;
  }

  const sabeTodo = conocido();
  if (!sabeTodo && pestana !== "perfil") pestana = "perfil";

  const escaparate = perfil.escaparate || [];
  const jugados = lockesJugados(perfil).length;
  const ganados = (perfil.ganados || []).length;
  const amigos = amigosAceptados().length;
  const juntos = mio || !sabeTodo ? 0 : lockesJuntos(perfil);

  // Con un error al cambiar el nombre, sale en el hueco de las cifras (así no se mueve nada)
  const cifras = mio && editandoNombre && errorNombre
    ? `<span class="perfil-error">${escaparHTML(errorNombre)}</span>`
    : `<span><strong>${jugados}</strong> ${jugados === 1 ? t("locke jugado") : t("lockes jugados")}</span>
       <span><strong>${ganados}</strong> ${ganados === 1 ? t("ganado") : t("ganados")}</span>
       ${mio
         ? `<span><strong>${amigos}</strong> ${amigos === 1 ? t("amigo") : t("amigos")}</span>`
         : sabeTodo
           ? `<span><strong>${juntos}</strong> ${juntos === 1 ? t("locke juntos") : t("lockes juntos")}</span>`
           : ""}`;

  const logros = Object.keys(perfil.logros || {}).filter((id) => LOGROS.some((logro) => logro.id === id)).length;

  // Con el fondo que haya elegido para su tarjeta (el mismo que en «Amigos»)
  const fondo = fondoDe(perfil);
  // Como en su ficha de «Amigos»: la capa de color a la izquierda dice quién es, y debajo del nombre
  // «Tú» o «Conectado»
  const conectado = !mio && estaConectado(perfil.uid);
  const estado = mio
    ? `<span class="jugador-estado">${t("Tú")}</span>`
    : conectado
      ? `<span class="jugador-estado"><span class="punto-conectado"></span>${t("Conectado")}</span>`
      : "";
  // «Sobre mí» va en la propia tarjeta, a la derecha (en ancho): así no queda ese hueco vacío
  const sobreMi = plantillaSobreMi(perfil, mio);
  const cabeza = `
    <header class="perfil-cabeza ${sobreMi ? "con-lado" : ""} ${mio ? "mia" : conectado ? "conectado" : ""} ${fondo ? `con-fondo ${claseFondo(fondo)}` : ""}" style="${estiloFondo(fondo)}">
      ${mio
        ? `<button class="perfil-avatar ${claseMarco(marcoDe(perfil))}" title="${t("Cambiar foto")}">${plantillaFoto(perfil, "perfil-foto")}<span class="perfil-avatar-lapiz">${icono("lapiz")}</span></button>`
        : `<div class="perfil-avatar ${claseMarco(marcoDe(perfil))}">${plantillaFoto(perfil, "perfil-foto")}</div>`}
      <div class="perfil-datos">
        ${estado}
        ${plantillaNombre(perfil, mio)}
        ${plantillaTitulo(perfil, mio)}
        <div class="perfil-cifras">${cifras}</div>
        ${mio ? "" : plantillaAccion(perfil)}
      </div>
      ${sobreMi ? `<div class="perfil-cabeza-lado">${sobreMi}</div>` : ""}
    </header>

    ${sabeTodo
      ? `<div class="perfil-pestanas">
          <button data-pestana="perfil" class="${pestana === "perfil" ? "activa" : ""}">${icono("persona")} ${t("Perfil")}</button>
          <button data-pestana="logros" class="${pestana === "logros" ? "activa" : ""}">${icono("trofeo")} ${t("Logros")} <small>${logros}/${LOGROS.length}</small></button>
        </div>`
      : ""}`;

  // Hasta MAX_DESTACADOS. Si alguien tiene más de antes, se ven los primeros; en «Ordenar»
  // están todos para quitar los que sobren.
  const destacados = `
    <section class="perfil-apartado">
      <h3>
        ${t("Equipos destacados")}
        ${mio && escaparate.length < MAX_DESTACADOS ? `<button class="perfil-destacar">${icono("mas")} ${t("Destacar")}</button>` : ""}
      </h3>
      ${escaparate.length
        ? `<div class="perfil-equipos">${escaparate
            .slice(0, MAX_DESTACADOS)
            .map((equipo, indice) => plantillaEquipo(equipo, indice, mio))
            .join("")}</div>`
        : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`}
      ${mio && escaparate.length > 1 ? `<button class="perfil-ver-equipos">${t("Ordenar")}</button>` : ""}
    </section>`;

  // En ancho, en tres columnas (así cabe todo sin bajar): los equipos; los lockes; y lo tuyo
  // (fondo, marco y amigos)
  const columnas = !sabeTodo
    ? [sobreMi ? "" : `<p class="perfil-vacio">${t("Hazte su amigo para ver más de su perfil.")}</p>`]
    : mio
      ? [destacados, plantillaPalmares(perfil) + plantillaSalon(perfil) + plantillaColeccion(perfil, true), plantillaFondos(perfil) + plantillaMarcos(perfil) + plantillaAmigos()]
      : [destacados, plantillaPalmares(perfil, false) + plantillaSalon(perfil) + plantillaColeccion(perfil, false), plantillaFondosDe(perfil) + plantillaAmigosDe(perfil)];
  const llenas = columnas.filter((columna) => columna.trim());

  cuerpo.innerHTML = sabeTodo && pestana === "logros" ? cabeza + plantillaLogrosDe(perfil) : `
    ${cabeza}
    ${llenas.length
      ? `<div class="perfil-columnas columnas-${llenas.length}">
          ${llenas.map((columna) => `<div class="perfil-columna">${columna}</div>`).join("")}
        </div>`
      : ""}`;

  dialogo.querySelector(".perfil-borrar").hidden = !mio;
  dialogo.querySelector(".perfil-volver").hidden = mio || !desdeMiPerfil;

  if (mio && editandoNombre) {
    const campo = cuerpo.querySelector(".perfil-nombre-campo");
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

// ---------- Todos los destacados ----------

function pintarDestacados() {
  const perfil = perfilQueSeVe();
  const mio = !viendo;
  const escaparate = (perfil && perfil.escaparate) || [];

  dialogoDestacados.querySelector(".destacados-lista").innerHTML = escaparate.length
    ? escaparate.map((equipo, indice) => plantillaEquipo(equipo, indice, mio, mio, escaparate.length)).join("")
    : `<p class="perfil-vacio">${t("Ninguno todavía.")}</p>`;
  dialogoDestacados.querySelector(".destacados-anadir").hidden = !mio || escaparate.length >= MAX_DESTACADOS;
}

function abrirDestacados() {
  pintarDestacados();
  dialogoDestacados.showModal();
}

// ---------- Abrir ----------

export function abrirMiPerfil() {
  if (!usuarioActual()) return;
  viendo = null;
  desdeMiPerfil = false;
  editandoNombre = false;
  pestana = "perfil";
  salonEntero = false;
  pintar();
  if (!dialogo.open) dialogo.showModal();
}

export function abrirPerfilDe(uid, desdeElMio = false) {
  viendo = uid;
  desdeMiPerfil = desdeElMio;
  editandoNombre = false;
  pestana = "perfil";
  salonEntero = false;
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

// ---------- Nombre ----------

async function guardarNombre() {
  const campo = cuerpo.querySelector(".perfil-nombre-campo");
  const nuevo = campo.value.trim();
  for (const boton of cuerpo.querySelectorAll(".perfil-nombre-form button")) boton.disabled = true;
  errorNombre = await cambiarMote(nuevo);
  if (!errorNombre) editandoNombre = false;
  pintar();
}

// ---------- Equipos destacados ----------

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

function pintarEscaparate() {
  const destacados = new Set(((miPerfil() || {}).escaparate || []).map((equipo) => equipo.id));
  const guardados = leerGuardados();
  dialogoEscaparate.querySelector(".escaparate-lista").innerHTML = guardados.length
    ? guardados
        .map(
          (equipo) => `
            <button class="escaparate-equipo ${destacados.has(equipo.id) ? "destacado" : ""}" data-id="${escaparHTML(equipo.id)}">
              <strong>${escaparHTML(equipo.nombre || t("Equipo"))}</strong>
              <span class="perfil-equipo-caras">${equipo.pokemon.map(caraDe).join("")}</span>
              ${destacados.has(equipo.id) ? icono("visto") : ""}
            </button>`
        )
        .join("")
    : `<p class="perfil-vacio">${t("No tienes equipos guardados.")}</p>`;
}

// Pulsar un equipo lo destaca; si ya lo estaba, lo quita
async function alternarDestacado(id) {
  const escaparate = [...((miPerfil() || {}).escaparate || [])];
  const posicion = escaparate.findIndex((equipo) => equipo.id === id);
  if (posicion >= 0) {
    escaparate.splice(posicion, 1);
  } else {
    if (escaparate.length >= MAX_DESTACADOS) return;
    const equipo = leerGuardados().find((cada) => cada.id === id);
    if (!equipo) return;
    escaparate.push(copiaDeEquipo(equipo));
  }
  await guardarMiPerfil({ escaparate });
  if (escaparate.length >= MAX_DESTACADOS) dialogoEscaparate.close();
}

async function quitarDestacado(indice) {
  const escaparate = [...((miPerfil() || {}).escaparate || [])];
  escaparate.splice(indice, 1);
  await guardarMiPerfil({ escaparate });
}

// paso: -1 sube, +1 baja
async function moverDestacado(indice, paso) {
  const escaparate = [...((miPerfil() || {}).escaparate || [])];
  const otro = indice + paso;
  if (otro < 0 || otro >= escaparate.length) return;
  [escaparate[indice], escaparate[otro]] = [escaparate[otro], escaparate[indice]];
  await guardarMiPerfil({ escaparate });
}

// Los botones de un equipo destacado, en el perfil o en la ventana de todos
function alPulsarEquipo(boton) {
  const indice = Number(boton.dataset.indice);
  if (boton.classList.contains("perfil-quitar-equipo")) quitarDestacado(indice).catch(siFalla);
  else if (boton.classList.contains("perfil-subir-equipo")) moverDestacado(indice, -1).catch(siFalla);
  else if (boton.classList.contains("perfil-bajar-equipo")) moverDestacado(indice, 1).catch(siFalla);
  else if (boton.classList.contains("perfil-copiar")) copiarEquipo(boton).catch((error) => console.error(error));
  else return false;
  return true;
}

async function copiarEquipo(boton) {
  const perfil = perfilQueSeVe();
  const equipo = ((perfil && perfil.escaparate) || [])[Number(boton.dataset.indice)];
  if (!equipo) return;
  const copiado = await copiarAlPortapapeles(equipo.paste || "");
  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  setTimeout(() => (boton.innerHTML = icono("copiar")), 1500);
}

// ---------- Foto (un Pokémon) ----------

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

// La foto que ya tienes, si es un retrato de Mundo Misterioso: así se le puede cambiar la cara
// sin volver a buscar el Pokémon
const RETRATO_PMD = /PMDCollab\/SpriteCollab\/.+\/([^/]+)\.png$/;

function avatarDeMiFoto() {
  const mio = miPerfil() || {};
  const encontrada = typeof mio.foto === "string" && typeof mio.avatar === "number" && mio.foto.match(RETRATO_PMD);
  if (!encontrada) return null;
  return { id: mio.avatar, normales: [mio.foto.replace(/[^/]+\.png$/, "Normal.png")], cara: encontrada[1] };
}

function pintarMuestra() {
  const muestra = dialogoAvatar.querySelector(".avatar-muestra");
  muestra.innerHTML = !avatarElegido
    ? plantillaFoto(miPerfil() || {}, "perfil-foto")
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
  const mio = miPerfil() || {};
  dialogoAvatar.querySelector(".avatar-quitar").hidden = !(mio.avatar || mio.fotoGoogle);
  const usuario = usuarioActual();
  dialogoAvatar.querySelector(".avatar-google").hidden = !(usuario && usuario.photoURL) || Boolean(mio.fotoGoogle);
  pintarMuestra();
  dialogoAvatar.showModal();
  dialogoAvatar.querySelector(".avatar-pokemon").focus();
  cargarDatos()
    .then(() => listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon))
    .catch((error) => console.error(error));
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
async function guardarAvatar() {
  if (eligiendoAvatar) await eligiendoAvatar;
  if (!avatarElegido) {
    dialogoAvatar.querySelector(".avatar-error").textContent = t("Elige un Pokémon de la lista o sube una foto.");
    return;
  }
  if (avatarElegido.subida) {
    await guardarMiPerfil({ avatar: "propia", fotoGoogle: false, foto: avatarElegido.subida });
    dialogoAvatar.close();
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
  await guardarMiPerfil({ avatar: avatarElegido.id, fotoGoogle: false, foto });
  dialogoAvatar.close();
}

// Sin foto. La de Google no sale sola: solo si se pide con «Usar mi foto de Google»
async function quitarAvatar() {
  await guardarMiPerfil({ avatar: null, fotoGoogle: false, foto: "" });
  dialogoAvatar.close();
}

// La foto de tu cuenta de Google en el perfil público. Se enseña a cualquiera con cuenta,
// así que es una decisión de cada uno (por defecto no sale)
async function usarFotoDeGoogle() {
  const usuario = usuarioActual();
  if (!usuario || !usuario.photoURL) return;
  await guardarMiPerfil({ avatar: null, fotoGoogle: true, foto: usuario.photoURL });
  dialogoAvatar.close();
}

// ---------- Arranque (al cargar el módulo) ----------

function siFalla(error) {
  console.error(error);
  errorNombre = t("No se ha podido guardar. Inténtalo otra vez.");
  pintar();
}

cuerpo.addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (!boton) return;

  if (boton.dataset.pestana) {
    pestana = boton.dataset.pestana;
    pintar();
  } else if (boton.classList.contains("perfil-avatar")) abrirAvatar();
  else if (boton.classList.contains("perfil-titulo")) {
    pintarTitulos();
    dialogoTitulo.showModal();
  }
  else if (boton.classList.contains("perfil-editar-nombre")) {
    editandoNombre = true;
    errorNombre = "";
    pintar();
  } else if (boton.classList.contains("perfil-nombre-cancelar")) {
    editandoNombre = false;
    pintar();
  } else if (boton.classList.contains("perfil-destacar")) {
    pintarEscaparate();
    dialogoEscaparate.showModal();
  } else if (boton.classList.contains("perfil-ver-equipos")) {
    abrirDestacados();
  } else if (boton.classList.contains("perfil-palmares")) {
    gestionarPalmares().catch(siFalla);
  } else if (boton.classList.contains("perfil-amistad")) {
    responderAmistad(boton).catch(siFalla);
  } else if (boton.classList.contains("perfil-editar-sobre-mi")) {
    abrirSobreMi();
  } else if (boton.classList.contains("perfil-chat")) {
    const uid = viendo;
    dialogo.close();
    import("./chat.js").then((modulo) => modulo.abrirChat(uid)).catch(siFalla);
  } else if (boton.classList.contains("perfil-retar")) {
    retar(viendo).catch(siFalla);
  } else if (boton.classList.contains("perfil-fondos-mas")) {
    pintarFondos();
    dialogoFondos.showModal();
  } else if (boton.classList.contains("perfil-fondo")) {
    // Se ve ya, mientras se guarda (cuando llega el perfil se vuelve a pintar igual)
    cuerpo.querySelectorAll(".perfil-fondo").forEach((cada) => cada.classList.toggle("elegido", cada === boton));
    guardarMiPerfil({ fondo: boton.dataset.fondo || null }).catch(siFalla);
  } else if (boton.classList.contains("perfil-marco")) {
    cuerpo.querySelectorAll(".perfil-marco").forEach((cada) => cada.classList.toggle("elegido", cada === boton));
    guardarMiPerfil({ marco: boton.dataset.marco || "" }).catch(siFalla);
  } else if (boton.hasAttribute("data-ir-coleccion")) {
    dialogo.close();
    irA("juegos");
  } else if (boton.classList.contains("perfil-ir-tienda")) {
    dialogo.close();
    irA("juegos");
  } else if (boton.classList.contains("perfil-ver-salon")) {
    salonEntero = !salonEntero;
    pintar();
  } else if (boton.classList.contains("perfil-ver-amigos")) {
    dialogo.close();
    irA("amigos");
  } else if (boton.classList.contains("perfil-amigo")) {
    // Desde el perfil de un amigo se puede llegar al tuyo (entre sus amigos estás tú)
    if (boton.dataset.uid === (usuarioActual() || {}).uid) abrirMiPerfil();
    else abrirPerfilDe(boton.dataset.uid, true);
  } else {
    alPulsarEquipo(boton);
  }
});

dialogoDestacados.querySelector(".destacados-lista").addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (boton) alPulsarEquipo(boton);
});
dialogoDestacados.querySelector(".destacados-anadir").addEventListener("click", () => {
  pintarEscaparate();
  dialogoEscaparate.showModal();
});
dialogoDestacados.querySelector(".destacados-cerrar").addEventListener("click", () => dialogoDestacados.close());

cuerpo.addEventListener("submit", (e) => {
  e.preventDefault();
  guardarNombre().catch(siFalla);
});

dialogo.querySelector(".perfil-cerrar").addEventListener("click", () => dialogo.close());
dialogo.querySelector(".perfil-volver").addEventListener("click", abrirMiPerfil);
dialogo.addEventListener("close", () => (editandoNombre = false));

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
  if (empezoFuera && fueraDe(e)) dialogo.close();
  empezoFuera = false;
});

dialogoSobreMi.querySelector(".sobre-mi-formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  guardarSobreMi().catch((error) => {
    console.error(error);
    errorSobreMi.textContent = t("No se ha podido guardar.");
  });
});
dialogoSobreMi.querySelector(".sobre-mi-cancelar").addEventListener("click", () => dialogoSobreMi.close());

dialogoTitulo.querySelector(".titulo-lista").addEventListener("click", (e) => {
  const opcion = e.target.closest(".titulo-opcion");
  if (opcion) ponerTitulo(opcion.dataset.logro).catch(siFalla);
});
dialogoTitulo.querySelector(".titulo-quitar").addEventListener("click", () => ponerTitulo(null).catch(siFalla));
dialogoTitulo.querySelector(".titulo-cerrar").addEventListener("click", () => dialogoTitulo.close());

// Elegir uno en la ventana de todos los fondos: se pone y se cierra
dialogoFondos.querySelector(".fondos-cerrar").addEventListener("click", () => dialogoFondos.close());
dialogoFondos.querySelector(".fondos-lista").addEventListener("click", (e) => {
  const boton = e.target.closest(".perfil-fondo");
  if (!boton || boton.disabled) return;
  dialogoFondos.querySelectorAll(".perfil-fondo").forEach((cada) => cada.classList.toggle("elegido", cada === boton));
  guardarMiPerfil({ fondo: boton.dataset.fondo || null }).catch(siFalla);
  dialogoFondos.close();
});

dialogoEscaparate.querySelector(".escaparate-cerrar").addEventListener("click", () => dialogoEscaparate.close());
dialogoEscaparate.querySelector(".escaparate-lista").addEventListener("click", (e) => {
  const equipo = e.target.closest(".escaparate-equipo");
  if (equipo) alternarDestacado(equipo.dataset.id).catch(siFalla);
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
  guardarAvatar().catch((error) => {
    console.error(error);
    dialogoAvatar.querySelector(".avatar-error").textContent = t("No se ha podido guardar.");
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
dialogoAvatar.querySelector(".avatar-quitar").addEventListener("click", () => {
  quitarAvatar().catch((error) => console.error(error));
});
dialogoAvatar.querySelector(".avatar-google").addEventListener("click", () => {
  usarFotoDeGoogle().catch((error) => console.error(error));
});

// Al día mientras está abierto: tu perfil, el del amigo, quién está conectado
const repintar = () => {
  if (dialogo.open && !editandoNombre) pintar();
  if (dialogoEscaparate.open) pintarEscaparate();
  if (dialogoDestacados.open) pintarDestacados();
  if (dialogoTitulo.open) pintarTitulos();
  if (dialogoFondos.open) pintarFondos();
};
alCambiarMiPerfil(repintar);
alCambiarColeccion(repintar); // tu colección, en tu perfil
alCambiarPerfilesAmigos(repintar);
alCambiarAmistades(repintar);
alCambiarChats(repintar);
alCambiarPresencia(repintar);
alCambiarLockes(repintar);
