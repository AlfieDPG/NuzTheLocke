// Sección «Amigos».
//
// Una ficha por persona con su palmarés: la tuya y las de los amigos que te han aceptado.
// Nadie más sale: hasta que mandas una solicitud y te la aceptan, aquí solo estás tú.
//
// Nadie puede editar la ficha de otro. Tú editas la tuya: los tipos de locke que usas y
// tu palmarés. Lo que ganes en «Lockes» se apunta solo.

import { imagenConRespaldo } from "../comun/imagenes.js";
import { activarArrastre } from "../comun/arrastrar.js";
import { elegirEquipo, caraDePokemon, carasDeEquipo } from "../comun/elegir-equipo.js";
import { fondoDe, claseFondo, estiloFondo } from "../comun/fondos.js";
import { marcoDe, claseMarco, fondoVisual, plantillaTituloDe } from "../comun/fichas.js";
import { icono } from "../comun/iconos.js";
import { campoNumero } from "../comun/numero.js";
import { escaparHTML, fechaLarga } from "../comun/utilidades.js";
import {
  plantillaCampoJuego, activarCamposJuego, leerCampoJuego, nombreJuego
} from "../comun/campo-juego.js";
import { hayNube, usuarioActual } from "../comun/nube.js";
import { estaConectado, alCambiarPresencia } from "../comun/presencia.js";
import { caraACara } from "../comun/cara-a-cara.js";
import { iniciarEstadisticas, abrirEstadisticas } from "./estadisticas.js";
import { soyYo } from "../comun/logros.js";
import {
  TIPOS_POR_DEFECTO, alCambiarMiPerfil, alCambiarAmistades, miPerfil, fallaElPerfil, tiposDe, tiposParaFicha,
  amigosAceptados, solicitudesRecibidas, solicitudesEnviadas, fallaLasAmistades,
  perfilesDeAmigos, alCambiarPerfilesAmigos, buscarAmigo, pedirAmistad, aceptarAmistad, borrarAmistad,
  guardarMiPerfil, nuevoId, colorDeTipo, lockesJugados
} from "../comun/perfiles.js";
import { haySinLeer, alCambiarChats } from "../comun/chat.js";
import { confirmar } from "../comun/ventanas.js";
import { leer, escribir } from "../comun/almacen.js";
import { t, LOCALE } from "../comun/idioma.js";

let seccion = null;
let lista = null;
let solicitudes = null;
let aviso = null;
let campoCorreo = null;
let dialogoTipos = null;
let dialogoPalmares = null;

// ---------- Colores ----------

// El color va dentro de un atributo style, así que solo se deja pasar #rrggbb.
// Si alguien guardase cualquier otra cosa en su perfil, aquí se queda fuera.
function colorSeguro(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color : "#3498db";
}

// ---------- Plantillas ----------

function etiquetaTipo(nombre, total) {
  if (total === 1 || /s$/i.test(nombre)) return nombre;
  return `${nombre}s`;
}

// Los jugados de ese tipo en grande y, debajo, cuántos de ellos ganó
function plantillaContador(tipo, total, ganados) {
  return `
    <div class="contador-locke" style="--color-locke: ${colorDeTipo(tipo)}">
      <span class="contador-numero">${total}</span>
      <span class="contador-tipo">${escaparHTML(etiquetaTipo(tipo.nombre, total))}</span>
      <span class="contador-ganados">${icono("corona")}${t(ganados === 1 ? "{n} ganado" : "{n} ganados", { n: ganados })}</span>
    </div>`;
}

// Lockes que se ven de entrada en una lista; el resto, detrás de «Ver todos»
const MOSTRAR_DE_ENTRADA = 5;

// Un locke jugado: con corona si lo ganó; los demás, un poco más apagados
function plantillaLocke(ganado, posicion, extra) {
  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  return `
    <li class="locke-ganado ${ganado.gano ? "gano" : "perdido"} ${extra ? "extra" : ""}" data-posicion="${posicion}" style="--color-locke: ${colorDeTipo(tipo)}"
        title="${t("Pulsa para ver los datos de este locke")}">
      <span class="locke-nombre">${ganado.gano ? `<span class="locke-corona" title="${t("Ganado")}">${icono("corona")}</span>` : ""}${escaparHTML(ganado.nombre)}</span>
      ${ganado.nota ? `<span class="locke-nota">${escaparHTML(ganado.nota)}</span>` : ""}
    </li>`;
}

// Del más reciente al más antiguo: primero los que tienen fecha de fin (de la más nueva a
// la más vieja) y después los que no, de los últimos apuntados a los primeros
function delMasReciente(lista, fecha) {
  return lista
    .map((elemento, posicion) => ({ elemento, posicion }))
    .sort((uno, otro) => {
      const a = fecha(uno.elemento) || "";
      const b = fecha(otro.elemento) || "";
      if (a !== b) return a && b ? (a < b ? 1 : -1) : a ? -1 : 1;
      return otro.posicion - uno.posicion;
    });
}

// Los últimos MOSTRAR_DE_ENTRADA y, si hay más, el botón que despliega el resto (los
// demás llevan la clase «extra» y el CSS los esconde mientras la lista no esté abierta)
function botonVerTodos(total) {
  const quedan = total - MOSTRAR_DE_ENTRADA;
  if (quedan <= 0) return "";
  return `
    <li class="ver-todos-fila">
      <button class="ver-todos" data-quedan="${quedan}">${icono("mas")} ${t("Ver todos ({n} más)", { n: quedan })}</button>
    </li>`;
}

function plantillaListaGanados(jugados) {
  const ordenados = delMasReciente(jugados, (ganado) => ganado.fechaFin);
  return (
    ordenados.map(({ elemento, posicion }, i) => plantillaLocke(elemento, posicion, i >= MOSTRAR_DE_ENTRADA)).join("") +
    botonVerTodos(ordenados.length)
  );
}

// Pulsando una ficha se abre o se cierra su lista de lockes, bajando o subiendo poco a poco (lo
// de debajo también). Sin lockes no hay nada que enseñar: se queda como está.
const sinAnimaciones = matchMedia("(prefers-reduced-motion: reduce)");

function desplegarFicha(ficha) {
  const lockes = ficha.querySelector(".lockes-ganados");
  if (!lockes || !lockes.children.length) return;
  // Mientras se cierra aún no lleva «plegada»: pulsar otra vez la vuelve a abrir
  const abrir = ficha.classList.contains("plegada") || ficha.classList.contains("cerrando");
  for (const animacion of lockes.getAnimations()) animacion.cancel();
  ficha.classList.remove("cerrando");
  if (sinAnimaciones.matches) {
    ficha.classList.toggle("plegada", !abrir);
    return;
  }

  ficha.classList.remove("plegada");
  // El hueco entre la lista y lo de arriba (el gap de la ficha) también crece y se encoge
  const hueco = parseFloat(getComputedStyle(ficha).rowGap) || 0;
  const abierta = { height: `${lockes.offsetHeight}px`, marginTop: "0px", opacity: 1 };
  const cerrada = { height: "0px", marginTop: `${-hueco}px`, opacity: 0 };
  lockes.style.overflow = "hidden";
  if (!abrir) ficha.classList.add("cerrando");
  const animacion = lockes.animate(abrir ? [cerrada, abierta] : [abierta, cerrada], {
    duration: 220,
    easing: "ease-in-out",
    fill: abrir ? "none" : "forwards" // al cerrar, cerrada hasta que se esconda de verdad
  });
  animacion.onfinish = () => {
    lockes.style.overflow = "";
    if (abrir) return;
    ficha.classList.remove("cerrando");
    ficha.classList.add("plegada");
    animacion.cancel();
  };
}

// Abre o cierra el resto de una lista
function alternarVerTodos(boton) {
  const lista = boton.closest(".lista-plegable");
  const abierta = lista.classList.toggle("todos");
  boton.innerHTML = abierta
    ? `${icono("menos")} ${t("Ver solo los últimos")}`
    : `${icono("mas")} ${t("Ver todos ({n} más)", { n: boton.dataset.quedan })}`;
  return abierta;
}

// ---------- Recuadro con los datos de un locke ----------
//
// Al pulsar un locke de una ficha desplegada sale un recuadro flotante al lado: juego, cuándo
// terminó, quién ganó y quién jugó con cuántas vidas acabó. Todo sale de la copia que se
// guarda en el perfil (ver resumenDeLocke en perfiles.js): el locke original puede no ser
// legible para quien mira la ficha.

let fichasPintadas = new Map(); // clave de la ficha -> { nombre, jugados, mia }
let flotante = null;

function plantillaFlotante(ganado, ficha) {
  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  const juego = nombreJuego(ganado);
  const fecha = fechaLarga(ganado.fechaFin);
  // Los ganados los ganó el dueño de la ficha (si no se apuntó otro nombre); los perdidos, quien diga
  const ganador = ganado.gano === false ? ganado.ganador || "" : ganado.ganador || ficha.nombre;
  const participantes = ganado.participantes || [];

  const filas = [];
  if (juego) filas.push(`<div class="flotante-fila">${icono("mando")}<span>${escaparHTML(juego)}</span></div>`);
  if (fecha) filas.push(`<div class="flotante-fila">${icono("calendario")}<span>${t("Terminó el {fecha}", { fecha: escaparHTML(fecha) })}</span></div>`);
  if (deVidasIlimitadas(ganado)) filas.push(`<div class="flotante-fila">${icono("corazon")}<span>${t("Vidas ilimitadas")}</span></div>`);
  filas.push(ganador
    ? `<div class="flotante-fila ganador">${icono("corona")}<span>${t("Ganó {nombre}", { nombre: `<b>${escaparHTML(ganador)}</b>` })}</span></div>`
    : `<div class="flotante-fila">${icono("aspa")}<span>${t("Nadie ganó")}</span></div>`);

  const usuario = usuarioActual();
  const lista = participantes.length
    ? `
      <div class="flotante-titulo">${t("Participantes")}</div>
      <ul class="flotante-participantes">
        ${participantes
          .map((p) => {
            // null: el locke era de vidas ilimitadas. "" o nada: no se apuntó.
            const vidas = p.vidas === null ? "∞" : p.vidas === "" || p.vidas === undefined ? "" : p.vidas;
            const gano = p.nombre === ganador;
            // El dueño del locke apuntado: el de la ficha o, si es una copia del de un amigo, ese amigo
            const suyo = equipoPropio(ganado.de || ficha.clave, ganado.id, p);
            const equipo = suyo ? suyo.equipo : p.equipo;
            const mvp = suyo ? suyo.mvp : p.mvp;
            // En el locke de otro en el que sales tú, pones tu equipo final
            const tuyo = !ficha.mia && usuario && soyYo(p, usuario.uid, miPerfil() || {});
            return `
              <li class="${gano ? "gano" : ""}">
                <span class="flotante-quien">${gano ? icono("corona") : ""}${escaparHTML(p.nombre)}</span>
                ${p.rom ? `<span class="flotante-rom" title="${t("Se pasó la ROM")}">${icono("mando")}</span>` : ""}
                ${vidas === "" ? "" : `<span class="flotante-vidas">${icono("corazon")}${escaparHTML(vidas)}</span>`}
                ${equipo ? `<span class="flotante-equipo">${carasDeEquipo(equipo, { mvp: mvp ?? -1 })}</span>` : ""}
                ${tuyo ? `<button class="flotante-mi-equipo">${icono("estrella")} ${suyo ? t("Cambiar mi equipo") : t("Poner mi equipo")}</button>` : ""}
              </li>`;
          })
          .join("")}
      </ul>`
    : "";

  // Los combates: quién ganó, cómo y con qué equipo jugó cada uno
  const nombrePorId = new Map(participantes.map((p) => [p.id, p.nombre]));
  const combates = (ganado.combates || []).filter((c) => c.nombre || c.ganador || Object.keys(c.equipos || {}).length);
  const listaCombates = combates.length
    ? `
      <div class="flotante-titulo">${t("Combates")}</div>
      <ul class="flotante-combates">
        ${combates
          .map((combate, i) => {
            const quien = nombrePorId.get(combate.ganador) || "";
            const equipos = Object.entries(combate.equipos || {})
              .filter(([id]) => nombrePorId.has(id))
              .map(([id, equipo]) => `<span class="flotante-combate-equipo" title="${escaparHTML(nombrePorId.get(id))}">${carasDeEquipo(equipo)}</span>`)
              .join(`<span class="combate-vs">vs</span>`);
            return `
              <li>
                <span class="flotante-combate-cabeza">
                  <b>${escaparHTML(combate.nombre || t("Combate {n}", { n: i + 1 }))}</b>
                  ${quien ? `<span>${icono("corona")} ${escaparHTML(quien)}${combate.marcador ? ` · ${escaparHTML(combate.marcador)}` : ""}</span>` : ""}
                </span>
                ${equipos ? `<span class="flotante-combate-equipos">${equipos}</span>` : ""}
              </li>`;
          })
          .join("")}
      </ul>`
    : "";

  const sinDatos =
    !juego && !fecha && !participantes.length && !deVidasIlimitadas(ganado) && !(ganado.combates || []).length
      ? `<p class="flotante-vacio">${
          ficha.mia ? t("Sin más datos. Puedes añadirlos con el lápiz de tu ficha.") : t("Sin más datos.")
        }</p>`
      : "";

  return `
    <div class="flotante-cabecera">
      <span class="flotante-tipo">${escaparHTML(tipo.nombre)}</span>
      <span class="flotante-nombre">${escaparHTML(ganado.nombre)}</span>
    </div>
    ${ganado.nota ? `<p class="flotante-nota">${escaparHTML(ganado.nota)}</p>` : ""}
    ${filas.join("")}
    ${lista}
    ${listaCombates}
    ${sinDatos}`;
}

// ---------- Tu equipo en los lockes de otros ----------
//
// En el palmarés de un amigo, si sales de participante, pones tu equipo final. Como nadie
// escribe en el perfil de otro, va en el tuyo: equiposAjenos[«k<dueño>_<locke>»] =
// { equipo, mvp }. Al pintar ese locke se coge de tu perfil (o del de quien sea).

function claveAjena(dueno, idGanado) {
  return `k${dueno}_${idGanado}`;
}

// El equipo que ha puesto el propio participante (si es amigo tuyo o eres tú), o null
function equipoPropio(dueno, idGanado, participante) {
  const usuario = usuarioActual();
  // Los apuntados antes de llevar uid, por el nombre
  const uid = participante.uid || uidsPorNombre().get(String(participante.nombre || "").trim().toLowerCase());
  if (!uid || !usuario) return null;
  const perfil = uid === usuario.uid ? miPerfil() : perfilesDeAmigos().get(uid);
  return ((perfil && perfil.equiposAjenos) || {})[claveAjena(dueno, idGanado)] || null;
}

async function elegirMiEquipo(boton, dueno, ganado) {
  const clave = claveAjena(dueno, ganado.id);
  const actual = ((miPerfil() || {}).equiposAjenos || {})[clave];
  const equipo = await elegirEquipo(boton, { conQuitar: Boolean(actual) });
  if (equipo === undefined) return;
  // JSON de ida y vuelta: Firestore no acepta «undefined»
  await guardarMiPerfil({ [`equiposAjenos.${clave}`]: equipo ? JSON.parse(JSON.stringify({ equipo, mvp: -1 })) : null });
}

function cerrarFlotante() {
  if (!flotante) return;
  flotante.remove();
  flotante = null;
  for (const marcado of lista.querySelectorAll(".locke-ganado.abierto")) marcado.classList.remove("abierto");
}

function abrirFlotante(elemento, ganado, ficha) {
  const yaAbierto = elemento.classList.contains("abierto");
  cerrarFlotante();
  if (yaAbierto) return; // pulsar otra vez el mismo lo cierra

  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  flotante = document.createElement("div");
  flotante.className = "flotante-locke";
  flotante.style.setProperty("--color-locke", colorDeTipo(tipo));
  flotante.innerHTML = plantillaFlotante(ganado, ficha);
  flotante.addEventListener("click", (e) => {
    const boton = e.target.closest(".flotante-mi-equipo");
    if (boton) elegirMiEquipo(boton, ganado.de || ficha.clave, ganado).catch((error) => console.error(error));
  });
  document.body.appendChild(flotante);
  elemento.classList.add("abierto");

  // A la derecha del locke si cabe; si no, a la izquierda. Y sin salirse por abajo.
  const caja = elemento.getBoundingClientRect();
  const ancho = flotante.offsetWidth;
  const alto = flotante.offsetHeight;
  const margen = 12;

  let izquierda = caja.right + margen;
  if (izquierda + ancho > window.innerWidth - margen) izquierda = caja.left - ancho - margen;
  if (izquierda < margen) izquierda = Math.max(margen, Math.min(caja.left, window.innerWidth - ancho - margen));

  let arriba = caja.top;
  if (arriba + alto > window.innerHeight - margen) arriba = window.innerHeight - alto - margen;

  flotante.style.left = `${Math.round(izquierda)}px`;
  flotante.style.top = `${Math.round(Math.max(margen, arriba))}px`;
}

// Botones de la esquina. No plegan la ficha: lo para el oyente del click.
function plantillaAcciones(ficha) {
  if (ficha.mia) {
    return `
      <div class="ficha-acciones">
        <button class="accion-estadisticas" title="${t("Estadísticas")}">${icono("estadisticas")}</button>
        <button class="accion-tipos" title="${t("Tipos de locke")}">${icono("etiqueta")}</button>
        <button class="accion-palmares" title="${t("Editar mis lockes")}">${icono("lapiz")}</button>
      </div>`;
  }

  return `
    <div class="ficha-acciones">
      <button class="accion-chat ${haySinLeer(ficha.clave) ? "sin-leer" : ""}" title="${t("Chat")}">${icono("mensaje")}</button>
      <button class="accion-estadisticas" title="${t("Estadísticas y cara a cara")}">${icono("estadisticas")}</button>
      <button class="accion-quitar" title="${t("Quitar de amigos")}">${icono("aspa")}</button>
    </div>`;
}

// ---------- Cara a cara ----------
//
// Lo cuenta js/comun/cara-a-cara.js (lo usa también el perfil).

function plantillaListaCaraACara(lista, mio, suyo) {
  const ordenados = delMasReciente(lista, (locke) => locke.fecha);
  const filas = ordenados.map(({ elemento: locke }, i) => {
    const tipo = locke.tipo || TIPOS_POR_DEFECTO[0];
    const resultado = {
      mia: `${icono("corona")} ${escaparHTML(mio.nombre)}`,
      suya: `${icono("corona")} ${escaparHTML(suyo.nombre)}`,
      marcha: t("En marcha"),
      otro: `${icono("corona")} ${escaparHTML(locke.ganador || t("Otra persona"))}`
    }[locke.resultado];
    const fecha = locke.fecha ? `<span class="comparar-fecha">${escaparHTML(fechaLarga(locke.fecha))}</span>` : "";

    return `
      <li class="comparar-locke ${i >= MOSTRAR_DE_ENTRADA ? "extra" : ""}" style="--color-locke: ${colorDeTipo(tipo)}">
        <span class="comparar-locke-nombre">${escaparHTML(locke.nombre)}${fecha}</span>
        <span class="comparar-resultado ${locke.resultado}">${resultado}</span>
      </li>`;
  });

  return `<ul class="comparar-lista lista-plegable">${filas.join("")}${botonVerTodos(ordenados.length)}</ul>`;
}

function plantillaLuchador(perfil, victorias, clase) {
  const nombre = escaparHTML(perfil.nombre || t("Jugador"));
  const urls = [perfil.foto].filter(Boolean).map(escaparHTML);
  const imagen = urls.length
    ? imagenConRespaldo(urls, `alt="${nombre}" draggable="false" referrerpolicy="no-referrer" data-quitar-si-falla`)
    : "";
  return `
    <div class="luchador ${clase} ${fondoVisual(perfil).clase}" style="${fondoVisual(perfil).estilo}">
      ${clase.includes("gana") ? `<span class="luchador-corona">${icono("corona")}</span>` : ""}
      <div class="jugador-foto ${claseMarco(marcoDe(perfil))}" data-inicial="${escaparHTML((perfil.nombre || "?")[0])}" data-perfil="${escaparHTML(perfil.uid || "")}" title="${t("Ver perfil")}">${imagen}</div>
      <span class="luchador-nombre">${nombre}</span>
      ${plantillaTituloDe(perfil, "pequeno")}
      <span class="luchador-victorias">${victorias}</span>
      <span class="luchador-etiqueta">${victorias === 1 ? t("victoria") : t("victorias")}</span>
    </div>`;
}

// El cara a cara con un amigo, que sale arriba en su ventana de estadísticas ("" si es la tuya)
function htmlComparacion(uid) {
  const mio = miPerfil();
  const suyo = perfilesDeAmigos().get(uid);
  if (!mio || !suyo) return "";

  const { juntos, enMarcha, mias, suyas, lista: jugados } = caraACara(mio, suyo);
  const claseMia = mias > suyas ? "gana" : mias < suyas ? "pierde" : "";
  const claseSuya = suyas > mias ? "gana" : suyas < mias ? "pierde" : "";

  let resumen = t("Todavía no habéis jugado ningún locke juntos.");
  if (juntos) {
    resumen = t(juntos === 1 ? "{n} locke jugado juntos" : "{n} lockes jugados juntos", { n: juntos });
    if (enMarcha) resumen += ` · ${t("{n} en marcha", { n: enMarcha })}`;
    const otros = juntos - enMarcha - mias - suyas;
    if (otros > 0) resumen += ` · ${t("{n} los ganó otra persona", { n: otros })}`;
  }

  return `
    <div class="cara-a-cara">
      ${plantillaLuchador(mio, mias, `mio ${claseMia}`)}
      <span class="comparar-vs">VS</span>
      ${plantillaLuchador(suyo, suyas, claseSuya)}
    </div>
    <p class="comparar-resumen">${escaparHTML(resumen)}</p>
    ${juntos && mias === suyas && mias + suyas > 0 ? `<p class="comparar-empate">${t("Vais empatados")}</p>` : ""}
    ${jugados.length ? plantillaListaCaraACara(jugados, mio, suyo) : ""}`;
}

function plantillaFicha(ficha) {
  const alt = escaparHTML(ficha.nombre);

  // La dirección de la foto se escapa igual que el resto: viene del perfil de otra
  // persona y acaba dentro de un atributo. Las entidades (&amp;) las deshace el navegador.
  const urls = ficha.urls.map(escaparHTML);
  const imagen = urls.length
    ? imagenConRespaldo(urls, `alt="${alt}" draggable="false" referrerpolicy="no-referrer" data-quitar-si-falla`)
    : "";

  const tipos = ficha.tipos
    .map((tipo) => {
      const delTipo = ficha.jugados.filter((jugado) => jugado.tipo && jugado.tipo.id === tipo.id);
      return plantillaContador(tipo, delTipo.length, delTipo.filter((jugado) => jugado.gano).length);
    })
    .join("");

  const conectado = !ficha.mia && estaConectado(ficha.clave);

  return `
    <article class="ficha-jugador plegada ${ficha.mia ? "mia" : ""} ${conectado ? "conectado" : ""} ${claseFondo(ficha.fondo)}"
             style="${estiloFondo(ficha.fondo)}"
             draggable="true" data-clave="${escaparHTML(ficha.clave)}"
             ${ficha.jugados.length ? `title="${t("Pulsa para ver los lockes")}"` : ""}>
      ${plantillaAcciones(ficha)}
      <header class="ficha-cabeza">
        <div class="jugador-foto ${claseMarco(ficha.marco)}" data-inicial="${escaparHTML(ficha.nombre[0] || "?")}" data-perfil="${escaparHTML(ficha.clave)}" title="${t("Ver perfil")}">${imagen}</div>
        <div class="ficha-quien">
          <h2 class="jugador-nombre">${alt}</h2>
          ${ficha.titulo || ""}
          ${!ficha.mia && conectado
              ? `<span class="jugador-estado" title="${t("Tiene la web abierta")}"><span class="punto-conectado"></span>${t("Conectado")}</span>`
              : ""}
        </div>
      </header>

      <div class="contadores-locke">${tipos}</div>

      <ul class="lockes-ganados lista-plegable">${plantillaListaGanados(ficha.jugados)}</ul>
    </article>`;
}

// ---------- Armar la lista de fichas ----------

function fichaDePerfil(perfil, mia) {
  return {
    clave: perfil.uid,
    nombre: perfil.nombre || t("Jugador"),
    urls: [perfil.foto].filter(Boolean),
    tipos: tiposParaFicha(perfil),
    // Todos los terminados que ha jugado: los ganados (gano: true) y los que no
    jugados: lockesJugados(perfil),
    fondo: fondoDe(perfil),
    marco: marcoDe(perfil),
    titulo: plantillaTituloDe(perfil, "pequeno"),
    mia
  };
}

async function recargar() {
  const mio = hayNube() && usuarioActual() ? miPerfil() : null;

  // Sin sesión (o mientras el perfil llega) no hay nada que enseñar. Si no llega porque
  // Firestore no deja leerlo, eso sí se dice.
  if (!mio) {
    lista.innerHTML = "";
    solicitudes.hidden = true;
    aviso.textContent = hayNube() && usuarioActual() ? fallaElPerfil() : "";
    return;
  }

  aviso.textContent = fallaLasAmistades();

  const aceptados = amigosAceptados();
  const pendientes = [...solicitudesRecibidas(), ...solicitudesEnviadas()];
  // Escuchados en vivo (perfiles.js): los que aún no han llegado salen cuando lleguen
  const perfiles = perfilesDeAmigos();

  const fichas = [fichaDePerfil(mio, true)];
  for (const amistad of aceptados) {
    const perfil = perfiles.get(amistad.otro);
    if (perfil) fichas.push(fichaDePerfil(perfil, false));
  }

  // Ahora se repinta solo cada vez que un amigo cambia algo: lo que tuvieras desplegado y el
  // orden en que hubieras arrastrado las fichas se quedan como estaban
  const ordenAnterior = [...lista.querySelectorAll(".ficha-jugador")].map((ficha) => ficha.dataset.clave);
  const desplegadas = new Set(
    [...lista.querySelectorAll(".ficha-jugador:not(.plegada)")].map((ficha) => ficha.dataset.clave)
  );
  const conTodos = new Set(
    [...lista.querySelectorAll(".ficha-jugador:has(.lista-plegable.todos)")].map((ficha) => ficha.dataset.clave)
  );
  const posicion = (ficha) => {
    const donde = ordenAnterior.indexOf(ficha.clave);
    return donde < 0 ? Infinity : donde;
  };
  fichas.sort((una, otra) => posicion(una) - posicion(otra));

  cerrarFlotante();
  fichasPintadas = new Map(fichas.map((ficha) => [ficha.clave, ficha]));
  lista.innerHTML = fichas.map(plantillaFicha).join("");
  for (const ficha of lista.querySelectorAll(".ficha-jugador")) {
    if (desplegadas.has(ficha.dataset.clave)) ficha.classList.remove("plegada");
    const verTodos = ficha.querySelector(".ver-todos");
    if (conTodos.has(ficha.dataset.clave) && verTodos) alternarVerTodos(verTodos);
  }
  pintarSolicitudes(pendientes, perfiles);
}

// La misma tira que el buzón del panel lateral, pero aquí al lado del buscador: lo que
// estás mirando cuando agregas a alguien es justo esto.
function pintarSolicitudes(pendientes, perfiles) {
  const usuario = usuarioActual();

  solicitudes.innerHTML = pendientes
    .map((amistad) => {
      const perfil = perfiles.get(amistad.otro);
      const nombre = escaparHTML((perfil && perfil.nombre) || t("Alguien"));

      if (amistad.pidio === usuario.uid) {
        return `
          <div class="solicitud" data-amistad="${escaparHTML(amistad.id)}">
            <span>${t("Esperando a {nombre}", { nombre: `<b>${nombre}</b>` })}</span>
            <button class="solicitud-cancelar" title="${t("Cancelar")}">${icono("aspa")}</button>
          </div>`;
      }

      return `
        <div class="solicitud entrante" data-amistad="${escaparHTML(amistad.id)}">
          <span>${t("{nombre} quiere ser tu amigo", { nombre: `<b>${nombre}</b>` })}</span>
          <button class="solicitud-aceptar" title="${t("Aceptar")}">${icono("visto")}</button>
          <button class="solicitud-rechazar" title="${t("Rechazar")}">${icono("aspa")}</button>
        </div>`;
    })
    .join("");

  solicitudes.hidden = pendientes.length === 0;
}

// ---------- Agregar un amigo ----------

// Solo por mote (por correo ya no se puede buscar a nadie)
async function agregar() {
  const texto = campoCorreo.value.trim();
  if (!texto) return;

  const usuario = usuarioActual();
  if (!usuario) {
    aviso.textContent = t("Primero inicia sesión.");
    return;
  }

  aviso.textContent = t("Buscando...");

  try {
    const perfil = await buscarAmigo(texto);
    if (!perfil) {
      aviso.textContent = texto.includes("@")
        ? t("Se busca por mote, no por correo.")
        : t("Nadie con ese mote.");
      return;
    }
    if (perfil.uid === usuario.uid) {
      aviso.textContent = t("Ese eres tú.");
      return;
    }
    if (amigosAceptados().some((amistad) => amistad.otro === perfil.uid)) {
      aviso.textContent = t("{nombre} ya es tu amigo.", { nombre: perfil.nombre });
      return;
    }

    await pedirAmistad(perfil.uid);
    campoCorreo.value = "";
    aviso.textContent = t("Solicitud enviada a {nombre}.", { nombre: perfil.nombre });
    await recargar();
  } catch (error) {
    console.error(error);
    aviso.textContent = t("No se ha podido. Inténtalo otra vez.");
  }
}

// ---------- Diálogo de tipos de locke ----------

let tiposEnEdicion = [];

function pintarTipos() {
  const cuerpo = dialogoTipos.querySelector(".tipos-lista");

  cuerpo.innerHTML = tiposEnEdicion
    .map(
      (tipo, posicion) => `
        <div class="fila-tipo" data-posicion="${posicion}">
          <input class="tipo-color" type="color" value="${colorDeTipo(tipo)}" title="${t("Color")}">
          <input class="tipo-nombre" type="text" value="${escaparHTML(tipo.nombre)}" placeholder="${t("Nombre del tipo")}">
          <button class="tipo-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
        </div>`
    )
    .join("");
}

function abrirTipos() {
  const mio = miPerfil();
  tiposEnEdicion = tiposDe(mio).map((tipo) => ({ ...tipo }));
  pintarTipos();
  dialogoTipos.showModal();
}

async function guardarTipos() {
  const filas = [...dialogoTipos.querySelectorAll(".fila-tipo")];

  const tipos = filas
    .map((fila, posicion) => ({
      id: tiposEnEdicion[posicion].id,
      nombre: fila.querySelector(".tipo-nombre").value.trim(),
      color: colorSeguro(fila.querySelector(".tipo-color").value)
    }))
    .filter((tipo) => tipo.nombre);

  await guardarMiPerfil({ tipos });
  dialogoTipos.close();
}

// ---------- Diálogo de lockes ganados ----------

let ganadosEnEdicion = [];

// Los tipos que se ofrecen en cada fila: los míos y los que ya estén en la lista aunque los
// haya borrado de mis tipos.
function tiposDelDialogo() {
  return tiposParaFicha({ tipos: tiposDe(miPerfil()), ganados: ganadosEnEdicion });
}

function pintarPalmares() {
  const cuerpo = dialogoPalmares.querySelector(".palmares-lista");
  const tipos = tiposDelDialogo();

  cuerpo.innerHTML = ganadosEnEdicion
    .map((ganado, posicion) => {
      const elegido = ganado.tipo ? ganado.tipo.id : "";
      const opciones = tipos
        .map(
          (tipo) =>
            `<option value="${escaparHTML(tipo.id)}" ${tipo.id === elegido ? "selected" : ""}>${escaparHTML(tipo.nombre)}</option>`
        )
        .join("");

      return `
        <div class="fila-palmares ${ganado.gano ? "gano" : ""}" data-posicion="${posicion}">
          <div class="fila-palmares-principal">
            <input class="palmares-nombre" type="text" value="${escaparHTML(ganado.nombre)}" placeholder="${t("Juego o nombre del locke")}">
            <select class="palmares-tipo">${opciones}</select>
            <input class="palmares-nota" type="text" value="${escaparHTML(ganado.nota || "")}" placeholder="${t("Nota (opcional)")}">
            <button class="palmares-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
          </div>
          <div class="fila-palmares-resultado">
            <label class="palmares-casilla palmares-gane">
              <input class="palmares-gano" type="checkbox" ${ganado.gano ? "checked" : ""}>
              <span>${icono("corona")} ${t("Lo gané")}</span>
            </label>
            <input class="palmares-ganador" type="text" maxlength="40" value="${escaparHTML(ganado.gano ? "" : ganado.ganador || "")}"
                   placeholder="${t("¿Quién ganó? (opcional)")}" aria-label="${t("¿Quién ganó? (opcional)")}">
          </div>
          ${plantillaDetalles(ganado)}
        </div>`;
    })
    .join("");
}

// Lo que sale en el recuadro al pulsar el locke en la ficha. Plegado por defecto para que la
// lista no sea eterna; el resumen del <summary> dice lo que ya hay apuntado.
// ¿Era de vidas ilimitadas? Los de Versus lo traen apuntado; en los de antes se deduce de
// que todos los participantes tengan las vidas a null (así se guardaban los ilimitados).
function deVidasIlimitadas(ganado) {
  if (typeof ganado.vidasIlimitadas === "boolean") return ganado.vidasIlimitadas;
  const participantes = ganado.participantes || [];
  return participantes.length > 0 && participantes.every((p) => p.vidas === null);
}

// Tú y tus amigos, por nombre, para elegirlos como participantes. Fuera los que ya están.
function nombresParaParticipar(ganado) {
  const yaEstan = new Set((ganado.participantes || []).map((p) => (p.nombre || "").trim().toLowerCase()));
  const perfiles = perfilesDeAmigos();
  const mio = miPerfil();
  const nombres = [
    mio && mio.nombre,
    ...amigosAceptados().map((amistad) => (perfiles.get(amistad.otro) || {}).nombre)
  ].filter(Boolean);

  return [...new Set(nombres)]
    .filter((nombre) => !yaEstan.has(nombre.toLowerCase()))
    .sort((uno, otro) => uno.localeCompare(otro, LOCALE));
}

const OTRA_PERSONA = "__otra";

function plantillaDetalles(ganado) {
  const participantes = ganado.participantes || [];
  const ilimitadas = deVidasIlimitadas(ganado);
  const resumen = [
    nombreJuego(ganado),
    fechaLarga(ganado.fechaFin),
    participantes.length ? t(participantes.length === 1 ? "{n} participante" : "{n} participantes", { n: participantes.length }) : "",
    ilimitadas ? t("vidas ilimitadas") : ""
  ].filter(Boolean);

  // Cada participante: nombre, vidas, si se pasó la ROM y su equipo final (pulsando un
  // Pokémon de su equipo, ese es su MVP)
  const filas = participantes
    .map(
      (p) => `
        <div class="participante" data-participante="${escaparHTML(p.id || "")}">
          <div class="participante-fila">
            <input class="participante-nombre" type="text" value="${escaparHTML(p.nombre || "")}" placeholder="${t("Nombre")}">
            <span class="participante-corazon">${icono("corazon")}</span>
            ${campoNumero(`<input class="participante-vidas" type="number" min="0" max="999"
              value="${p.vidas === null || p.vidas === undefined ? "" : escaparHTML(p.vidas)}"
              placeholder="${t("Vidas")}" title="${t("Vidas con las que acabó")}">`)}
            <label class="participante-rom" title="${t("Se pasó la ROM")}">
              <input class="participante-rom-casilla" type="checkbox" ${p.rom ? "checked" : ""}>
              <span>${icono("mando")} ROM</span>
            </label>
            <button class="participante-quitar" title="${t("Quitar")}">${icono("aspa")}</button>
          </div>
          <div class="participante-equipo">
            ${p.equipo ? plantillaEquipoMvp(p) : ""}
            <button type="button" class="palmares-elegir-equipo" data-para="final">
              ${icono("estrella")} ${p.equipo ? t("Cambiar equipo final") : t("Equipo final")}
            </button>
          </div>
        </div>`
    )
    .join("");

  const opciones = nombresParaParticipar(ganado)
    .map((nombre) => `<option value="${escaparHTML(nombre)}">${escaparHTML(nombre)}</option>`)
    .join("");

  return `
    <details class="palmares-mas" ${ganado.abierto ? "open" : ""}>
      <summary>
        ${t("Juego, fecha, participantes y combates")}
        ${resumen.length ? `<span class="palmares-resumen">· ${escaparHTML(resumen.join(" · "))}</span>` : ""}
      </summary>
      <div class="palmares-detalles ${ilimitadas ? "ilimitadas" : ""}">
        <div class="palmares-campo">
          <span>${t("Juego")}</span>
          ${plantillaCampoJuego(ganado)}
        </div>
        <label class="palmares-campo">
          <span>${t("Terminó el")}</span>
          <input class="palmares-fecha" type="date" value="${escaparHTML(ganado.fechaFin || "")}">
        </label>
        <label class="palmares-casilla">
          <input class="palmares-ilimitadas" type="checkbox" ${ilimitadas ? "checked" : ""}>
          <span>${t("Vidas ilimitadas")}</span>
        </label>
        <div class="palmares-campo participantes">
          <span class="participantes-titulo">${t("Participantes")}<span class="con-vidas"> ${t("y vidas con las que acabaron")}</span></span>
          ${filas}
          <select class="participante-elegir" title="${t("Añadir participante")}">
            <option value="">+ ${t("Añadir participante...")}</option>
            ${opciones}
            <option value="${OTRA_PERSONA}">${t("Otra persona (escribir el nombre)")}</option>
          </select>
        </div>
        <div class="palmares-campo palmares-combates">
          <span class="participantes-titulo">${t("Combates")}</span>
          ${(ganado.combates || []).map((combate, i) => plantillaCombatePalmares(combate, i, participantes)).join("")}
          <button type="button" class="palmares-anadir-combate">${icono("mas")} ${t("Añadir combate")}</button>
        </div>
      </div>
    </details>`;
}

// El equipo final de un participante; pulsando un Pokémon se marca (o desmarca) como su MVP
function plantillaEquipoMvp(p) {
  return `
    <span class="participante-mvp" title="${t("Pulsa un Pokémon para que sea su MVP")}">
      ${p.equipo.pokemon
        .map((poke, i) => `<button type="button" class="cara-equipo palmares-mvp ${i === p.mvp ? "mvp" : ""}" data-mvp="${i}">${caraDePokemon(poke)}</button>`)
        .join("")}
    </span>`;
}
// Los combates ganados por cada participante en un combate: { idParticipante: n }. Los apuntados
// antes de existir estas casillas traían un ganador y un «2-1»: se reparten entre el ganador y el
// primer participante que no lo es.
function puntosDeCombate(combate, participantes) {
  if (combate.puntos) return { ...combate.puntos };
  const puntos = {};
  if (!combate.ganador) return puntos;
  const [alto, bajo] = String(combate.marcador || "").split("-").map((n) => Number(n) || 0);
  puntos[combate.ganador] = alto || 1;
  const otro = participantes.find((p) => p.id !== combate.ganador && (p.nombre || "").trim());
  if (otro && bajo) puntos[otro.id] = bajo;
  return puntos;
}

// De esos puntos: quién gana (el que más tiene, si es uno solo) y el marcador como texto
// («2-1», «3-1-0»: de mayor a menor)
function resumenDeCombate(puntos, ids) {
  const valores = ids.map((id) => ({ id, n: Number(puntos[id]) || 0 }));
  const max = Math.max(0, ...valores.map((v) => v.n));
  const arriba = valores.filter((v) => v.n === max);
  return {
    ganador: max > 0 && arriba.length === 1 ? arriba[0].id : "",
    marcador: max > 0 ? valores.map((v) => v.n).sort((a, b) => b - a).join("-") : ""
  };
}

// Un combate: nombre y, por cada participante, los combates que ha ganado y con qué equipo jugó
function plantillaCombatePalmares(combate, i, participantes) {
  const conNombre = participantes.filter((p) => (p.nombre || "").trim());
  const puntos = puntosDeCombate(combate, participantes);
  const { ganador } = resumenDeCombate(puntos, conNombre.map((p) => p.id));
  const filas = conNombre
    .map((p) => {
      const equipo = (combate.equipos || {})[p.id];
      return `
        <div class="palmares-combate-equipo ${ganador === p.id ? "gana" : ""}" data-participante="${escaparHTML(p.id)}">
          <span class="palmares-combate-quien">${ganador === p.id ? `<span class="palmares-corona" title="${t("Ganó")}">${icono("corona")}</span>` : ""}${escaparHTML(p.nombre)}</span>
          ${campoNumero(`<input class="palmares-combate-puntos" type="number" min="0" max="99" value="${puntos[p.id] ?? 0}" aria-label="${t("Combates ganados")}" title="${t("Combates ganados")}">`)}
          ${equipo ? carasDeEquipo(equipo) : ""}
          <button type="button" class="palmares-elegir-equipo" data-para="${i}" title="${t("Equipo con el que jugó este combate")}">
            ${icono("pokeball")} ${equipo ? t("Cambiar") : t("Equipo")}
          </button>
        </div>`;
    })
    .join("");

  return `
    <div class="palmares-combate" data-combate="${i}">
      <div class="palmares-combate-fila">
        <input class="palmares-combate-nombre" type="text" maxlength="30" value="${escaparHTML(combate.nombre || "")}" placeholder="${t("Combate {n}", { n: i + 1 })}">
        <button class="palmares-quitar-combate" title="${t("Quitar combate")}">${icono("aspa")}</button>
      </div>
      ${filas ? `<div class="palmares-combate-equipos">${filas}</div>` : ""}
    </div>`;
}


// Una fila del diálogo tal y como está escrita ahora mismo. «abierto» solo sirve para que
// los detalles sigan desplegados al repintar; no se guarda.
function leerFila(fila, posicion, tipos) {
  const idTipo = fila.querySelector(".palmares-tipo").value;
  const anterior = ganadosEnEdicion[posicion] || {};
  const ilimitadas = fila.querySelector(".palmares-ilimitadas").checked;
  const gano = fila.querySelector(".palmares-gano").checked;

  return {
    ...anterior, // conserva lo que no se edita aquí (el ganador de los de Versus, de quién es la copia)
    id: anterior.id || nuevoId(),
    gano,
    // Ganado: el de antes si ya lo era (en los de Versus, tu nombre); si no, vacío (eres tú).
    // No ganado: lo que diga la casilla.
    ganador: gano ? (anterior.gano ? anterior.ganador || "" : "") : fila.querySelector(".palmares-ganador").value.trim(),
    nombre: fila.querySelector(".palmares-nombre").value,
    nota: fila.querySelector(".palmares-nota").value,
    tipo: tipos.find((tipo) => tipo.id === idTipo) || tipos[0],
    ...leerCampoJuego(fila.querySelector(".campo-juego")),
    fechaFin: fila.querySelector(".palmares-fecha").value,
    vidasIlimitadas: ilimitadas,
    participantes: [...fila.querySelectorAll(".participante")].map((p, i) => {
      const vidas = p.querySelector(".participante-vidas").value;
      // El equipo final y el MVP no están en casillas: vienen de lo que ya había
      const antes = (anterior.participantes || [])[i] || {};
      return {
        ...antes,
        id: p.dataset.participante || antes.id || nuevoId(),
        nombre: p.querySelector(".participante-nombre").value,
        // null: ilimitadas (sale ∞ en la ficha). "": no se apuntó.
        vidas: ilimitadas ? null : vidas === "" ? "" : Number(vidas),
        rom: p.querySelector(".participante-rom-casilla").checked
      };
    }),
    combates: [...fila.querySelectorAll(".palmares-combate")].map((c, i) => {
      // Los combates ganados que hay en las casillas; de ahí salen el ganador y el marcador
      const puntos = {};
      for (const cada of c.querySelectorAll(".palmares-combate-equipo")) {
        puntos[cada.dataset.participante] = Math.max(0, Math.min(99, Math.floor(Number(cada.querySelector(".palmares-combate-puntos").value) || 0)));
      }
      return {
        ...((anterior.combates || [])[i] || {}), // sus equipos
        nombre: c.querySelector(".palmares-combate-nombre").value,
        puntos,
        ...resumenDeCombate(puntos, Object.keys(puntos))
      };
    }),
    abierto: fila.querySelector(".palmares-mas").open
  };
}

// Los ids que había al abrir: los que falten al guardar se han quitado a mano y van a
// «descartados» (si eran de los que llegan solos, así no vuelven)
let idsAlAbrir = new Set();

// También desde el perfil (js/perfil.js, «Lockes jugados» → «Gestionar»). Todos tus lockes
// terminados: los ganados y los que no, cada uno con su casilla «Lo gané».
export function abrirPalmares() {
  const mio = miPerfil();
  // Copia de verdad (equipos y combates incluidos) y un id para cada participante: los
  // combates dicen quién ganó y con qué equipo jugó cada uno por ese id
  ganadosEnEdicion = JSON.parse(JSON.stringify(lockesJugados(mio))).map((ganado) => ({
    ...ganado,
    participantes: (ganado.participantes || []).map((p) => ({ ...p, id: p.id || nuevoId() }))
  }));
  idsAlAbrir = new Set(ganadosEnEdicion.map((ganado) => ganado.id));
  pintarPalmares();
  dialogoPalmares.showModal();
}

// Los participantes que son tus amigos (o tú) llevan su uid: así ese locke cuenta también
// para sus logros y pueden poner su equipo (ver equipoPropio)
function uidsPorNombre() {
  const uids = new Map();
  for (const [uid, perfil] of perfilesDeAmigos()) {
    if (perfil && perfil.nombre) uids.set(perfil.nombre.trim().toLowerCase(), uid);
  }
  const mio = miPerfil();
  const usuario = usuarioActual();
  if (mio && mio.nombre && usuario) uids.set(mio.nombre.trim().toLowerCase(), usuario.uid);
  return uids;
}

async function guardarPalmares() {
  const uids = uidsPorNombre();
  const lockes = leerPalmaresDelDialogo()
    .map(({ abierto, ...ganado }) => {
      const participantes = ganado.participantes
        .map(({ uid, ...p }) => {
          const nombre = p.nombre.trim();
          const suyo = uids.get(nombre.toLowerCase());
          return { ...p, nombre, ...(suyo ? { uid: suyo } : {}) };
        })
        .filter((p) => p.nombre);
      const ids = new Set(participantes.map((p) => p.id));
      return {
        ...ganado,
        nombre: ganado.nombre.trim(),
        nota: ganado.nota.trim(),
        juegoOtro: ganado.juegoOtro.trim(),
        participantes,
        // Los equipos y el ganador de cada combate, solo de los que siguen
        combates: (ganado.combates || []).map((combate) => {
          const puntos = Object.fromEntries(Object.entries(combate.puntos || {}).filter(([id, n]) => ids.has(id) && n > 0));
          return {
            nombre: (combate.nombre || "").trim(),
            puntos,
            ...resumenDeCombate(puntos, [...ids]),
            equipos: Object.fromEntries(Object.entries(combate.equipos || {}).filter(([id]) => ids.has(id)))
          };
        })
      };
    })
    .filter((ganado) => ganado.nombre);

  // Cada uno a su lista; «gano» solo sirve aquí
  const ganados = lockes.filter((locke) => locke.gano).map(({ gano, ...locke }) => locke);
  const perdidos = lockes.filter((locke) => !locke.gano).map(({ gano, ...locke }) => locke);
  const quedan = new Set(lockes.map((locke) => locke.id));
  const descartados = [...new Set([...((miPerfil() || {}).descartados || []), ...[...idsAlAbrir].filter((id) => !quedan.has(id))])]
    .filter((id) => !quedan.has(id))
    .slice(-300);

  // JSON de ida y vuelta: Firestore no acepta «undefined»
  await guardarMiPerfil(JSON.parse(JSON.stringify({ ganados, perdidos, descartados })));
  dialogoPalmares.close();
}

// El equipo final de un participante o el de un combate (para = "final" o el número del combate)
async function elegirEquipoPalmares(boton) {
  const fila = boton.closest(".fila-palmares");
  const posicion = Number(fila.dataset.posicion);
  const idParticipante = boton.closest("[data-participante]").dataset.participante;
  ganadosEnEdicion = leerPalmaresDelDialogo();
  const ganado = ganadosEnEdicion[posicion];
  const participante = ganado.participantes.find((p) => p.id === idParticipante);
  if (!participante) return;

  const final = boton.dataset.para === "final";
  const combate = final ? null : ganado.combates[Number(boton.dataset.para)];
  const actual = final ? participante.equipo : (combate.equipos || {})[idParticipante];
  const equipo = await elegirEquipo(boton, { conQuitar: Boolean(actual) });
  if (equipo === undefined) return;

  if (final) {
    participante.equipo = equipo;
    participante.mvp = -1;
  } else {
    combate.equipos = { ...(combate.equipos || {}) };
    if (equipo) combate.equipos[idParticipante] = equipo;
    else delete combate.equipos[idParticipante];
  }
  pintarPalmares();
}

// ---------- Mover las fichas de sitio ----------
//
// Solo cambia el orden en pantalla y no se guarda: al recargar vuelven en el mismo orden.

let seAcabaDeArrastrar = false;

// La línea que marca dónde cae, en js/comun/arrastrar.js
function activarArrastreFichas() {
  activarArrastre(lista, {
    elementos: ".ficha-jugador",
    alTerminar: () => {
      seAcabaDeArrastrar = true; // el navegador puede soltar un click justo después
      setTimeout(() => (seAcabaDeArrastrar = false), 0);
    }
  });
}

// ---------- Clicks en las fichas ----------

function activarFichas() {
  lista.addEventListener("click", async (e) => {
    if (seAcabaDeArrastrar) return;

    const ficha = e.target.closest(".ficha-jugador");
    if (!ficha) return;

    // Un locke de la lista: abre sus datos sin plegar la ficha
    const locke = e.target.closest(".locke-ganado");
    if (locke) {
      const datos = fichasPintadas.get(ficha.dataset.clave);
      const ganado = datos && datos.jugados[Number(locke.dataset.posicion)];
      if (ganado) abrirFlotante(locke, ganado, datos);
      return;
    }

    const boton = e.target.closest("button");
    if (!boton) {
      cerrarFlotante();
      desplegarFicha(ficha);
      return;
    }

    try {
      if (boton.classList.contains("ver-todos")) {
        cerrarFlotante();
        alternarVerTodos(boton);
      } else if (boton.classList.contains("accion-chat")) {
        const { abrirChat } = await import("../chat.js");
        abrirChat(ficha.dataset.clave);
      } else if (boton.classList.contains("accion-tipos")) abrirTipos();
      else if (boton.classList.contains("accion-palmares")) abrirPalmares();
      else if (boton.classList.contains("accion-estadisticas")) abrirEstadisticas(ficha.dataset.clave, htmlComparacion(ficha.dataset.clave));
      else if (boton.classList.contains("accion-quitar")) await quitarAmigo(ficha);
    } catch (error) {
      console.error(error);
      aviso.textContent = t("No se ha podido. Inténtalo otra vez.");
    }
  });
}

async function quitarAmigo(ficha) {
  const nombre = ficha.querySelector(".jugador-nombre").textContent;
  if (!(await confirmar(t("¿Quitar a {nombre} de tus amigos?", { nombre })))) return;

  const amistad = amigosAceptados().find((cada) => cada.otro === ficha.dataset.clave);
  if (amistad) await borrarAmistad(amistad.id);
}

// ---------- Tarjetas o lista ----------
//
// Como en «Mis equipos»: dos iconos a la derecha de la barra, con la sombra del elegido que se
// desliza (css/equipos.css, .vista-equipos::before). Se queda en este navegador (no va a la nube).

const CLAVE_VISTA = "poketeams-amigos-vista-v1";

function aplicarVista(enLista) {
  lista.classList.toggle("modo-lista", enLista);
  const interruptor = seccion.querySelector(".amigos-vista");
  interruptor.classList.toggle("en-lista", enLista);
  for (const boton of interruptor.querySelectorAll("[data-modo]")) {
    const elegido = (boton.dataset.modo === "lista") === enLista;
    boton.classList.toggle("elegido", elegido);
    boton.setAttribute("aria-pressed", elegido);
  }
}

// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-amigos");
  dialogoTipos = document.querySelector("#dialogo-tipos");
  dialogoPalmares = document.querySelector("#dialogo-palmares");
  iniciarEstadisticas(alternarVerTodos);
  lista = seccion.querySelector(".jugadores");
  solicitudes = seccion.querySelector(".amigos-solicitudes");
  aviso = seccion.querySelector(".amigos-aviso");
  campoCorreo = seccion.querySelector(".amigos-correo");

  seccion.querySelector(".barra-amigos").hidden = !hayNube();
  const botonAgregar = seccion.querySelector(".amigos-agregar");
  botonAgregar.insertAdjacentHTML("afterbegin", `${icono("mas")} `);
  botonAgregar.addEventListener("click", agregar);
  campoCorreo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar();
  });

  for (const boton of seccion.querySelectorAll(".amigos-vista [data-modo]")) {
    boton.innerHTML = icono(boton.dataset.modo === "lista" ? "lista" : "cuadricula");
    boton.addEventListener("click", () => {
      const enLista = boton.dataset.modo === "lista";
      escribir(CLAVE_VISTA, enLista);
      aplicarVista(enLista);
    });
  }
  aplicarVista(leer(CLAVE_VISTA, false));

  activarArrastreFichas();
  activarFichas();

  // El recuadro de datos de un locke se cierra al pulsar fuera, con Escape o al moverse
  document.addEventListener("click", (e) => {
    if (!flotante || flotante.contains(e.target) || e.target.closest(".locke-ganado")) return;
    cerrarFlotante();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarFlotante();
  });
  window.addEventListener("scroll", cerrarFlotante, true);
  window.addEventListener("resize", cerrarFlotante);
  lista.addEventListener("dragstart", cerrarFlotante);

  solicitudes.addEventListener("click", async (e) => {
    const fila = e.target.closest(".solicitud");
    const boton = e.target.closest("button");
    if (!fila || !boton) return;

    for (const cada of fila.querySelectorAll("button")) cada.disabled = true;

    try {
      if (boton.classList.contains("solicitud-aceptar")) await aceptarAmistad(fila.dataset.amistad);
      else await borrarAmistad(fila.dataset.amistad);
      // No hace falta repintar: el oyente de amistades lo hace al llegar el cambio
    } catch (error) {
      console.error(error);
      for (const cada of fila.querySelectorAll("button")) cada.disabled = false;
    }
  });

  // Diálogo de tipos
  dialogoTipos.querySelector(".tipos-anadir").addEventListener("click", () => {
    tiposEnEdicion = leerTiposDelDialogo();
    tiposEnEdicion.push({ id: nuevoId(), nombre: "", color: "#9b59b6" });
    pintarTipos();
  });
  dialogoTipos.querySelector(".tipos-lista").addEventListener("click", (e) => {
    const fila = e.target.closest(".fila-tipo");
    if (!e.target.closest(".tipo-quitar") || !fila) return;
    tiposEnEdicion = leerTiposDelDialogo();
    tiposEnEdicion.splice(Number(fila.dataset.posicion), 1);
    pintarTipos();
  });
  dialogoTipos.querySelector("#tipos-cancelar").addEventListener("click", () => dialogoTipos.close());
  dialogoTipos.querySelector("#tipos-guardar").addEventListener("click", guardarTipos);

  // Diálogo del palmarés
  dialogoPalmares.querySelector(".palmares-anadir").addEventListener("click", () => {
    ganadosEnEdicion = leerPalmaresDelDialogo();
    ganadosEnEdicion.push({ id: nuevoId(), nombre: "", nota: "", tipo: tiposDelDialogo()[0], gano: true });
    pintarPalmares();
  });
  dialogoPalmares.querySelector(".palmares-lista").addEventListener("click", (e) => {
    const fila = e.target.closest(".fila-palmares");
    const boton = e.target.closest("button");
    if (!fila || !boton) return;

    const posicion = Number(fila.dataset.posicion);

    if (boton.classList.contains("palmares-elegir-equipo")) {
      elegirEquipoPalmares(boton).catch((error) => console.error(error));
      return;
    }

    // Siempre se recoge lo escrito antes de repintar, o se perdería
    if (boton.classList.contains("palmares-quitar")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion.splice(posicion, 1);
    } else if (boton.classList.contains("participante-quitar")) {
      const cual = [...fila.querySelectorAll(".participante")].indexOf(boton.closest(".participante"));
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].participantes.splice(cual, 1);
    } else if (boton.classList.contains("palmares-mvp")) {
      // Su MVP: pulsando el que ya lo es, se quita
      const idParticipante = boton.closest(".participante").dataset.participante;
      ganadosEnEdicion = leerPalmaresDelDialogo();
      const participante = ganadosEnEdicion[posicion].participantes.find((p) => p.id === idParticipante);
      const i = Number(boton.dataset.mvp);
      if (participante) participante.mvp = participante.mvp === i ? -1 : i;
    } else if (boton.classList.contains("palmares-anadir-combate")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].combates.push({ nombre: "", ganador: "", marcador: "", equipos: {} });
    } else if (boton.classList.contains("palmares-quitar-combate")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].combates.splice(Number(boton.closest(".palmares-combate").dataset.combate), 1);
    } else {
      return;
    }

    pintarPalmares();
  });
  dialogoPalmares.querySelector(".palmares-lista").addEventListener("change", (e) => {
    const fila = e.target.closest(".fila-palmares");
    if (!fila) return;

    // «Lo gané»: sin marcar, sale la casilla de quién ganó
    if (e.target.classList.contains("palmares-gano")) {
      fila.classList.toggle("gano", e.target.checked);
      return;
    }

    // Vidas ilimitadas: se esconden las vidas de cada participante (salen como ∞)
    if (e.target.classList.contains("palmares-ilimitadas")) {
      fila.querySelector(".palmares-detalles").classList.toggle("ilimitadas", e.target.checked);
      return;
    }

    // Al cambiar un nombre, los combates lo ponen al día (quién ganó, de quién es cada equipo)
    if (e.target.classList.contains("participante-nombre") && fila.querySelector(".palmares-combate")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      pintarPalmares();
      return;
    }

    // Elegir participante: un amigo (o tú) entra con su nombre; «Otra persona», en blanco
    if (e.target.classList.contains("participante-elegir")) {
      const elegido = e.target.value;
      if (!elegido) return;
      const posicion = Number(fila.dataset.posicion);
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].participantes.push({
        id: nuevoId(),
        nombre: elegido === OTRA_PERSONA ? "" : elegido,
        vidas: ""
      });
      pintarPalmares();

      if (elegido === OTRA_PERSONA) {
        const nombres = dialogoPalmares.querySelectorAll(
          `.fila-palmares[data-posicion="${posicion}"] .participante-nombre`
        );
        nombres[nombres.length - 1].focus();
      }
    }
  });
  activarCamposJuego(dialogoPalmares);
  dialogoPalmares.querySelector("#palmares-cancelar").addEventListener("click", () => dialogoPalmares.close());
  dialogoPalmares.querySelector("#palmares-guardar").addEventListener("click", guardarPalmares);

  // Se repinta cuando cambia mi perfil (lo he editado yo o acabo de ganar un locke) y
  // cuando cambian las amistades (alguien me ha aceptado o me ha mandado una solicitud).
  const repintar = () => {
    if (!seccion.hidden) recargar().catch((error) => console.error(error));
  };

  alCambiarMiPerfil(repintar);
  alCambiarAmistades(repintar);
  // Y cuando cambia el perfil de un amigo (ha ganado un locke, se ha cambiado el mote...)
  alCambiarPerfilesAmigos(repintar);

  // Lo mismo con quién te ha escrito sin que lo hayas leído: solo se toca la clase del botón
  alCambiarChats(() => {
    for (const boton of lista.querySelectorAll(".ficha-jugador:not(.mia) .accion-chat")) {
      boton.classList.toggle("sin-leer", haySinLeer(boton.closest(".ficha-jugador").dataset.clave));
    }
  });

  // Quién está conectado cambia a menudo: solo se toca la clase, sin repintar las fichas
  alCambiarPresencia(() => {
    for (const ficha of lista.querySelectorAll(".ficha-jugador:not(.mia)")) {
      ficha.classList.toggle("conectado", estaConectado(ficha.dataset.clave));
    }
  });
}

// Antes de repintar el diálogo hay que recoger lo escrito, que vive en los <input>
function leerTiposDelDialogo() {
  return [...dialogoTipos.querySelectorAll(".fila-tipo")].map((fila, posicion) => ({
    id: tiposEnEdicion[posicion].id,
    nombre: fila.querySelector(".tipo-nombre").value,
    color: colorSeguro(fila.querySelector(".tipo-color").value)
  }));
}

function leerPalmaresDelDialogo() {
  const tipos = tiposDelDialogo();
  return [...dialogoPalmares.querySelectorAll(".fila-palmares")].map((fila, posicion) =>
    leerFila(fila, posicion, tipos)
  );
}

export function mostrar() {
  aviso.textContent = "";
  recargar().catch((error) => {
    console.error(error);
    aviso.textContent = t("No se han podido cargar los amigos.");
  });
}
