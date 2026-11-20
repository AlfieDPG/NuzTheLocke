// Sección «Amigos».
//
// Una ficha por persona con su palmarés: la tuya y las de los amigos que te han aceptado.
// Nadie más sale: hasta que mandas una solicitud y te la aceptan, aquí solo estás tú.
//
// Nadie puede editar la ficha de otro. Tú editas la tuya: los tipos de locke que usas y
// tu palmarés. Lo que ganes en «Lockes» se apunta solo.

import { imagenConRespaldo } from "../comun/imagenes.js";
import { elegirEquipo, caraDePokemon, carasDeEquipo } from "../comun/elegir-equipo.js";
import { fondoDe } from "../comun/fondos.js";
import { marcoDe, claseMarco, claseMarcoDe, fondoVisual, plantillaTituloDe, rgbDePerfil } from "../comun/fichas.js";
import { icono } from "../comun/iconos.js";
import { campoNumero } from "../comun/numero.js";
import { escaparHTML, fechaLarga } from "../comun/utilidades.js";
import {
  plantillaCampoJuego, activarCamposJuego, leerCampoJuego, nombreJuego, nombreJuegoJugado
} from "../comun/campo-juego.js";
import { hayNube, usuarioActual } from "../comun/nube.js";
import { estaConectado, alCambiarPresencia, directoDe } from "../comun/presencia.js";
import { caraACara } from "../comun/cara-a-cara.js";
import { iniciarEstadisticas, abrirEstadisticas } from "./estadisticas.js";
import { soyYo } from "../comun/logros.js";
import {
  TIPOS_POR_DEFECTO, alCambiarMiPerfil, alCambiarAmistades, miPerfil, fallaElPerfil, tiposDe, tiposParaFicha,
  amigosAceptados, solicitudesRecibidas, solicitudesEnviadas, fallaLasAmistades,
  perfilesDeAmigos, alCambiarPerfilesAmigos, buscarAmigo, pedirAmistad, aceptarAmistad, borrarAmistad,
  guardarMiPerfil, nuevoId, colorDeTipo, lockesJugados, relacionCon
} from "../comun/perfiles.js";
import { haySinLeer, alCambiarChats, estaBloqueado, bloquear, desbloquear } from "../comun/chat.js";
import { misLockes, estadoDe as estadoEnLocke, puestosDe, puestoFinal, alCambiarLockes } from "../comun/lockes.js";
import { confirmar } from "../comun/ventanas.js";
import { leer, escribir } from "../comun/almacen.js";
import { t, LOCALE } from "../comun/idioma.js";

let seccion = null;
let lista = null;
let aviso = null;
let textoFiltro = ""; // lo escrito en «Buscar entre tus amigos»
let dialogoPalmares = null;

// ---------- Plantillas ----------


// Lockes que se ven de entrada en una lista; el resto, detrás de «Ver todos»
const MOSTRAR_DE_ENTRADA = 5;

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

  const resumen = textoResumen({ juntos, enMarcha, mias, suyas });

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

// ---------- La lista y el amigo elegido ----------
//
// A la izquierda, tus amigos ordenados solos: en directo, conectados y el resto. A la derecha, el que
// has pulsado: lo que tenéis en común (el cara a cara y los lockes en marcha) y sus lockes. Su perfil
// entero se abre con su foto o con «Ver perfil»; aquí no se repite.

let elegido = "";            // uid del amigo que se ve a la derecha
let filtroLista = "todos";   // "todos" | "conectados"
let columna = null;          // la lista de amigos
let panel = null;            // el amigo elegido
let botonSolicitudes = null;
let ventanaSolicitudes = null;
let pestanaSolicitudes = "recibidas";
const conTodosAbierto = new Set(); // amigos con «Ver todos» desplegado en sus lockes

const ORDEN_SITUACION = { vivo: 0, on: 1, off: 2 };

// En directo (jugando desde «Jugar»), conectado (con la web abierta) o desconectado
function situacionDe(uid) {
  return directoDe(uid) ? "vivo" : estaConectado(uid) ? "on" : "off";
}

function textoSituacion(uid, situacion) {
  if (situacion === "vivo") return t("Jugando: {juego}", { juego: directoDe(uid) });
  return situacion === "on" ? t("Conectado") : t("Desconectado");
}

// La foto con su marco; con «perfilar», pulsarla abre su perfil entero
function plantillaFoto(ficha, tamano, perfilar = false) {
  const urls = ficha.urls.map(escaparHTML);
  const imagen = urls.length
    ? imagenConRespaldo(urls, `alt="${escaparHTML(ficha.nombre)}" draggable="false" referrerpolicy="no-referrer" data-quitar-si-falla`)
    : "";
  const perfil = perfilar ? `data-perfil="${escaparHTML(ficha.clave)}" title="${t("Ver perfil")}"` : "";
  return `<span class="jugador-foto ${claseMarco(ficha.marco)}" style="--foto: ${tamano}rem" data-inicial="${escaparHTML(ficha.nombre[0] || "?")}" ${perfil}>${imagen}</span>`;
}

// «3–1»: lo que habéis ganado tú y él en los lockes que habéis jugado juntos
function marcadorCon(perfil) {
  const mio = miPerfil();
  if (!mio) return "0 – 0";
  // Siempre los dos números (0 – 0 si aún no habéis jugado ninguno), con aire alrededor de la raya
  const { mias, suyas } = caraACara(mio, perfil);
  return `${mias} – ${suyas}`;
}

function plantillaFila(ficha, perfil) {
  const situacion = situacionDe(ficha.clave);
  // Su fondo, en la tarjeta misma (como en la portada de su perfil)
  const fondo = fondoVisual(perfil);
  return `
    <button class="amigo-fila ${fondo.clase} ${situacion} ${ficha.clave === elegido ? "elegida" : ""} ${haySinLeer(ficha.clave) ? "sin-leer" : ""}" data-clave="${escaparHTML(ficha.clave)}" data-situacion="${situacion}" draggable="true" style="--color-vista: ${rgbDePerfil(perfil)}; ${fondo.estilo}">
      ${plantillaFoto(ficha, 2.7)}
      <span class="amigo-fila-quien">
        <b class="amigo-fila-nombre">${escaparHTML(ficha.nombre)}</b>
        <span class="amigo-fila-estado"><span class="amigo-punto"></span>${escaparHTML(textoSituacion(ficha.clave, situacion))}</span>
      </span>
      <span class="amigo-fila-marcador" title="${t("Victorias: tú – {nombre}", { nombre: escaparHTML(ficha.nombre) })}">
        <b>${marcadorCon(perfil)}</b><small>${t("contigo")}</small>
      </span>
    </button>`;
}

// Los lockes de «Lockes» que habéis jugado los dos: primero los que están en marcha y luego los
// terminados, del más reciente al más antiguo
function lockesJugadosJuntos(uid) {
  const cuando = (locke) => (locke.fechaFin ? Date.parse(locke.fechaFin) : Number(new Date(locke.creado || 0))) || 0;
  return misLockes()
    .filter((locke) => (locke.jugadores || []).includes(uid) && estadoEnLocke(locke, uid) === "aceptado")
    .sort((uno, otro) => Number(uno.estado === "cerrado") - Number(otro.estado === "cerrado") || cuando(otro) - cuando(uno));
}

// Un locke jugado juntos, siempre del mismo alto: arriba su nombre y «Abrir»; debajo, el tipo y el
// juego (y si está en marcha); y debajo, quiénes jugáis, pegados a la izquierda y por puesto, con la
// medalla de oro, plata o bronce en la foto (la de Lockes). Como mucho cuatro: con más, tres y «+n».
const JUNTOS_CARAS = 4;

function medallaDePuesto(puesto) {
  if (!puesto || puesto > 3) return "";
  return `<span class="locke-resumen-galardon puesto-${puesto}" data-puesto="${puesto}" aria-hidden="true"></span>`;
}

function plantillaLockeJunto(locke) {
  const tipo = locke.tipo || TIPOS_POR_DEFECTO[0];
  const juego = nombreJuegoJugado(locke, (usuarioActual() || {}).uid);
  const enMarcha = locke.estado !== "cerrado";
  const ranking = enMarcha ? puestosDe(locke) : null;
  const puesto = (uid) => (enMarcha ? (ranking && ranking.puestos[uid]) || 0 : puestoFinal(locke, uid));
  const jugadores = (locke.jugadores || []).filter((uid) => estadoEnLocke(locke, uid) === "aceptado");
  const ordenados = [...jugadores].sort((a, b) => (puesto(a) || 99) - (puesto(b) || 99));
  const caben = ordenados.length > JUNTOS_CARAS ? JUNTOS_CARAS - 1 : JUNTOS_CARAS;
  const yo = (usuarioActual() || {}).uid;

  const personas = ordenados.slice(0, caben).map((uid) => {
    const nombre = (locke.nombres || {})[uid] || t("Jugador");
    // La foto de ahora (la tuya o la de tu amigo) y, si no, la que se guardó en el locke
    const perfil = uid === yo ? miPerfil() : perfilesDeAmigos().get(uid);
    const foto = (perfil && perfil.foto) || (locke.fotos || {})[uid] || "";
    const n = puesto(uid);
    const titulo = n && n <= 3 ? `${nombre} · ${t("Puesto {n}", { n })}` : nombre;
    return `
      <span class="junto-persona" title="${escaparHTML(titulo)}">
        <span class="junto-cara ${claseMarcoDe(uid)}">${foto
          ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-quitar-si-falla>`
          : escaparHTML((nombre[0] || "?").toUpperCase())}${medallaDePuesto(n)}</span>
        <span class="junto-nombre">${escaparHTML(nombre)}</span>
      </span>`;
  });
  const mas = ordenados.length - caben;

  return `
    <article class="junto-locke ${enMarcha ? "en-marcha" : "terminado"}" style="--color-locke: ${colorDeTipo(tipo)}">
      <h4>${escaparHTML(locke.nombre)}</h4>
      <button class="junto-abrir" data-locke="${escaparHTML(locke.id)}">${t("Abrir")}</button>
      <span class="junto-tipo">${escaparHTML(tipo.nombre)}${juego ? ` · ${escaparHTML(juego)}` : ""}${enMarcha ? ` · <b class="junto-en-marcha">${t("En marcha")}</b>` : ""}</span>
      <div class="junto-personas">
        ${personas.join("")}
        ${mas > 0 ? `<span class="junto-mas" title="${t("y {n} más", { n: mas })}">+${mas}</span>` : ""}
      </div>
    </article>`;
}

// Las frases de arriba del cara a cara («5 lockes jugados juntos · 1 en marcha...»)
function textoResumen({ juntos, enMarcha, mias, suyas }) {
  let resumen = t("Todavía no habéis jugado ningún locke juntos.");
  if (juntos) {
    resumen = t(juntos === 1 ? "{n} locke jugado juntos" : "{n} lockes jugados juntos", { n: juntos });
    if (enMarcha) resumen += ` · ${t("{n} en marcha", { n: enMarcha })}`;
    const otros = juntos - enMarcha - mias - suyas;
    if (otros > 0) resumen += ` · ${t("{n} los ganó otra persona", { n: otros })}`;
  }
  return resumen;
}

// El amigo elegido: su perfil entero (el mismo que en la ventana, ver plantillaPerfilIncrustado en
// js/perfil.js) y, de lo de Amigos, arriba de su columna derecha el cara a cara y los lockes que
// jugáis, en «Lockes» cuántos de cada tipo y en la ficha ver su partida y «⋯».
let modPerfil = null; // js/perfil.js, cuando ha cargado

// Los huecos de cada tarjeta: siempre los mismos, tenga lo que tenga. Lo que falta, con borde de
// puntos; lo que no cabe, con «Ver todos» (una ventana con todo).
const HUECOS_EQUIPOS = 3;
const HUECOS_CARAS = 6;
const HUECOS_JUNTOS = 3;      // jugados juntos / en marcha (debajo de los equipos): tres líneas cada uno
const HUECOS_LOCKES_MIO = 8;  // en tu perfil, los lockes ocupan la columna entera
const HUECOS_LOCKES = 7;      // los lockes del amigo, finitos, debajo del cara a cara
const HUECOS_EN_MARCHA = 2;   // en tu perfil, tus lockes en marcha (con sitio para el tipo y el juego)
const HUECOS_TIPOS = 6;   // en la portada, dos columnas de tres; con más, cinco y «+n»
const HUECOS_COLECCION = 21; // 3 filas de 7
const HUECOS_AMIGOS = 5;     // el quinto, si tiene más, es «+n»

function cabezaCaja(titulo, cuenta = "", boton = "") {
  return `<header class="amigo-tarjeta-cabeza"><h3>${titulo}</h3>${cuenta ? `<small>${cuenta}</small>` : ""}${boton}</header>`;
}

// n huecos: los que hay y, hasta completar, vacíos con borde de puntos
function huecos(llenos, total, clase) {
  return [...llenos.slice(0, total), ...Array.from({ length: Math.max(0, total - llenos.length) }, () => `<span class="${clase} hueco-vacio"></span>`)].join("");
}

// Igual, pero si hay más de los que caben, el último hueco es «+n» y abre «Ver todos»
function huecosConMas(llenos, total, clase, ver) {
  if (llenos.length <= total) return huecos(llenos, total, clase);
  const sobran = llenos.length - (total - 1);
  return `${llenos.slice(0, total - 1).join("")}<button class="${clase} amigo-ver-mas amigo-mas-hueco" data-ver="${ver}" title="${t("Ver todos ({n})", { n: llenos.length })}">+${sobran}</button>`;
}

// «Ver todos (n)» en la cabeza de una tarjeta con lista, si no caben
function botonVerTodosCaja(cuantos, caben, ver) {
  return cuantos > caben ? `<button class="perfil-mini amigo-ver-mas" data-ver="${ver}">${t("Ver todos ({n})", { n: cuantos })}</button>` : "";
}

// Una lista de altura fija: n huecos del mismo alto. Sin nada, el primero dice por qué.
function listaFija(llenos, total, vacio) {
  const vacios = Array.from({ length: Math.max(0, total - llenos.length) }, (_, i) =>
    `<div class="amigo-fila-hueco hueco-vacio">${!llenos.length && i === 0 ? vacio : ""}</div>`
  );
  return `<div class="amigo-lista-fija" style="--huecos: ${total}">${[...llenos.slice(0, total), ...vacios].join("")}</div>`;
}

// Cuántos lockes ha jugado de cada tipo (Locke, Randomlocke...) y cuántos ganó: una tarjetita de
// su color por tipo, todas del mismo ancho (el nombre, cortado si es largo). Van en la portada.
function plaquitasDeTipos(ficha) {
  return ficha.tipos
    .map((tipo) => {
      const delTipo = ficha.jugados.filter((jugado) => jugado.tipo && jugado.tipo.id === tipo.id);
      if (!delTipo.length) return "";
      const ganados = delTipo.filter((jugado) => jugado.gano).length;
      return `
        <span class="amigo-portada-tipo" style="--color-locke: ${colorDeTipo(tipo)}" title="${escaparHTML(`${tipo.nombre}: ${delTipo.length}`)}">
          <b>${delTipo.length}</b>
          <span class="amigo-portada-tipo-nombre">${escaparHTML(tipo.nombre)}</span>
          <small>${icono("corona")}${ganados}</small>
        </span>`;
    })
    .filter(Boolean);
}

// Uno de sus amigos, con su foto y su marco
function caraDeSuAmigo(amigo) {
  const yo = (usuarioActual() || {}).uid;
  const soyYo = amigo.uid === yo;
  const fichaAmigo = fichaDePerfil(soyYo ? miPerfil() || amigo : amigo, soyYo);
  return `
    <button class="amigo-su-amigo" data-uid="${escaparHTML(amigo.uid)}" title="${escaparHTML(fichaAmigo.nombre)}">
      ${plantillaFoto(fichaAmigo, 2.5)}
      <span class="amigo-su-amigo-nombre">${escaparHTML(soyYo ? t("Tú") : fichaAmigo.nombre)}</span>
    </button>`;
}

// Lo que enseña «Ver todos» de cada tarjeta (se pinta al abrirla): la del amigo elegido y la de tu
// perfil (la ventana del perfil, js/perfil.js), que pueden estar pintadas a la vez
const verTodo = { amigo: {}, mio: {} };
let dialogoTodo = null;

export function abrirTodo(clave, mio = false) {
  const que = verTodo[mio ? "mio" : "amigo"][clave];
  if (!que || !dialogoTodo) return;
  dialogoTodo.querySelector(".amigo-todo-titulo").textContent = que.titulo;
  const cuerpo = dialogoTodo.querySelector(".amigo-todo-cuerpo");
  cuerpo.className = `amigo-todo-cuerpo ${que.clase}`;
  cuerpo.innerHTML = que.html();
  const color = mio ? rgbDePerfil(miPerfil()) : panel.style.getPropertyValue("--color-vista");
  dialogoTodo.style.setProperty("--color-vista", color);
  if (!dialogoTodo.open) dialogoTodo.showModal();
  cuerpo.scrollTop = 0;
}

// Los tipos en la portada: recuadros como las cifras, en una rejilla de 3 × 2 que se llena desde
// el lado de las cifras (el sexto, si aún hay más, es «+n» y abre todos). La rejilla guarda su
// sitio aunque esté vacía: así lo demás no se mueve de un amigo a otro.
function plantillaTiposPortada(tipos) {
  const vistos = tipos.length > HUECOS_TIPOS
    ? [...tipos.slice(0, HUECOS_TIPOS - 1), `<button class="amigo-portada-tipo amigo-ver-mas amigo-portada-tipo-mas" data-ver="tipos" title="${t("Ver todos ({n})", { n: tipos.length })}">+${tipos.length - (HUECOS_TIPOS - 1)}</button>`]
    : tipos;
  return `<div class="amigo-portada-tipos">${vistos.join("")}</div>`;
}

function plantillaPanel(ficha, perfil) {
  if (!modPerfil) return `<p class="perfil-vacio amigo-cargando">${t("Cargando...")}</p>`;
  const piezas = modPerfil.piezasDelPerfil(ficha.clave);
  if (!piezas) return `<p class="perfil-vacio amigo-cargando">${t("Cargando...")}</p>`;
  return plantillaRejilla(ficha, perfil, piezas, false);
}

// Tu perfil (la ventana de «Mi perfil», js/perfil.js), con el mismo diseño que el de un amigo en
// «Amigos»: la misma portada y las mismas tarjetas, salvo la primera columna (en vez del cara a cara
// y los jugados juntos, «Tu perfil» con «Editar perfil» y tus lockes en marcha), sin Chat ni Retar.
export function plantillaMiPerfil(piezas) {
  const perfil = miPerfil();
  if (!perfil || !piezas) return `<p class="perfil-vacio amigo-cargando">${t("Cargando...")}</p>`;
  return plantillaRejilla(fichaDePerfil(perfil, true), perfil, piezas, true);
}

// Tus lockes en marcha (en los que estás dentro)
function misLockesEnMarcha() {
  const yo = (usuarioActual() || {}).uid;
  return misLockes().filter((locke) => locke.estado !== "cerrado" && estadoEnLocke(locke, yo) === "aceptado");
}

function plantillaRejilla(ficha, perfil, piezas, esMio) {
  const mio = miPerfil();
  const cara = esMio ? null : caraACara(mio, perfil);
  const juego = directoDe(ficha.clave);
  const situacion = situacionDe(ficha.clave);
  const fichaMia = fichaDePerfil(mio, true);
  const fondo = fondoVisual(perfil);
  const texto = (perfil.sobreMi || "").trim();
  const horario = (perfil.horario || "").trim();
  const juntos = (esMio ? misLockesEnMarcha() : lockesJugadosJuntos(ficha.clave)).map(plantillaLockeJunto);
  const lockes = piezas.historial.lockes;
  const tipos = plaquitasDeTipos(ficha);
  const nombre = escaparHTML(ficha.nombre);
  // Solo se pintan los que caben (los demás cuentan para el «+n»)
  const susAmigos = [...piezas.amigos.perfiles.slice(0, HUECOS_AMIGOS).map(caraDeSuAmigo), ...Array(Math.max(0, piezas.amigos.perfiles.length - HUECOS_AMIGOS)).fill("")];

  verTodo[esMio ? "mio" : "amigo"] = {
    juntos: { titulo: esMio ? t("Tus lockes en marcha") : t("Jugados juntos"), clase: "en-lista", html: () => juntos.join("") },
    lockes: { titulo: t("Lockes de {nombre}", { nombre: ficha.nombre }), clase: "en-lista", html: () => lockes.join("") },
    tipos: { titulo: t("Tipos de locke de {nombre}", { nombre: ficha.nombre }), clase: "en-tipos", html: () => tipos.join("") },
    coleccion: { titulo: t("Colección de {nombre}", { nombre: ficha.nombre }), clase: "en-coleccion", html: () => piezas.coleccion.caras.join("") },
    amigos: { titulo: t("Amigos de {nombre}", { nombre: ficha.nombre }), clase: "en-amigos", html: () => piezas.amigos.perfiles.map(caraDeSuAmigo).join("") }
  };

  const cifra = (numero, etiqueta) => `<span><b>${numero ?? "–"}</b><small>${etiqueta}</small></span>`;
  const cifras = [
    cifra(ficha.jugados.length, t("lockes")),
    cifra((perfil.ganados || []).length, t("ganados")),
    cifra(piezas.logros.hechos, t("logros")),
    cifra(piezas.coleccion.cargando ? null : piezas.coleccion.especies, t("especies")),
    cifra(piezas.amigos.total, t("amigos")),
    esMio ? cifra(juntos.length, t("en marcha")) : cifra(cara.juntos, t("juntos"))
  ].join("");

  // Lo que está haciendo: si juega en directo, la etiqueta misma lleva a su partida
  const estado = esMio
    ? ""
    : juego
    ? `<button class="amigo-chip vivo ver-directo" title="${escaparHTML(t("Ver su partida en directo: {juego}", { juego }))}"><span class="amigo-punto"></span>${escaparHTML(textoSituacion(ficha.clave, situacion))} · ${t("Ver")}</button>`
    : `<span class="amigo-chip ${situacion}"><span class="amigo-punto"></span>${escaparHTML(textoSituacion(ficha.clave, situacion))}</span>`;

  // En una línea: el nombre, su título y cómo está (y si busca compañeros, y su horario)
  const portada = `
    <header class="amigo-portada ${fondo.clase}" style="${fondo.estilo}">
      <span class="perfil-ficha-foto amigo-portada-foto ${claseMarco(marcoDe(perfil))}">${piezas.foto}</span>
      <div class="amigo-portada-quien">
        <h2 class="amigo-portada-nombre-solo">${nombre}</h2>
        <div class="amigo-portada-nombre">
          ${plantillaTituloDe(perfil)}
          ${estado}
          ${perfil.busca ? `<span class="amigo-chip busca">${icono("persona")} ${t("Busca compañeros")}</span>` : ""}
          ${horario ? `<span class="amigo-chip amigo-chip-horario" title="${escaparHTML(horario)}">${icono("calendario")} <span>${escaparHTML(horario)}</span></span>` : ""}
        </div>
        <p class="amigo-portada-frase" ${texto ? `title="${escaparHTML(texto)}"` : ""}>${texto ? `«${escaparHTML(texto)}»` : ""}</p>
      </div>
      ${plantillaTiposPortada(tipos)}
      <div class="amigo-portada-cifras">${cifras}</div>
    </header>`;

  const equipos = piezas.equipos.map(
    (equipo) => `
      <article class="amigo-equipo">
        <b class="amigo-equipo-nombre">${escaparHTML(equipo.nombre)}</b>
        <div class="amigo-equipo-tira">
          ${huecos(equipo.caras.map((cara) => `<span class="amigo-equipo-cara">${cara}</span>`), HUECOS_CARAS, "amigo-equipo-cara")}
          <button class="perfil-copiar" data-indice="${equipo.indice}" title="${t("Copiar como paste")}" aria-label="${t("Copiar como paste")}">${icono("copiar")}</button>
        </div>
      </article>`
  );
  const equiposVacios = Array.from(
    { length: HUECOS_EQUIPOS - equipos.length },
    () => `<div class="amigo-equipo hueco-vacio"><span>${t("Sin equipo destacado")}</span></div>`
  );

  const tarjetas = `
    <div class="amigo-rejilla">
      <div class="amigo-columna-1">
      ${esMio ? "" : `
      <section class="amigo-tarjeta a-cara">
        <header class="amigo-tarjeta-cabeza">
          <h3>${t("Cara a cara")}</h3>
          <div class="menu-mas amigo-mas">
            <button class="menu-mas-boton amigo-mas-boton" aria-haspopup="true" aria-expanded="false" title="${t("Más opciones")}" aria-label="${t("Más opciones")}">${icono("puntos")}</button>
            <div class="menu-mas-lista" hidden>
              <button class="accion-estadisticas">${icono("estadisticas")} ${t("Estadísticas y cara a cara")}</button>
              <button class="accion-quitar">${icono("aspa")} ${t("Quitar de amigos")}</button>
            </div>
          </div>
        </header>
        <div class="amigo-vs">
          <span class="amigo-vs-lado">${plantillaFoto(fichaMia, 2.4)}<span>${t("Tú")}</span></span>
          <span class="amigo-tanteo"><b class="${cara.mias > cara.suyas ? "gana" : ""}">${cara.mias}</b><i>–</i><b class="${cara.suyas > cara.mias ? "gana" : ""}">${cara.suyas}</b></span>
          <span class="amigo-vs-lado">${plantillaFoto(ficha, 2.4)}<span>${nombre}</span></span>
        </div>
        <div class="amigo-cara-cifras">
          <span><b>${cara.juntos}</b><small>${t("jugados")}</small></span>
          <span><b>${cara.enMarcha}</b><small>${t("en marcha")}</small></span>
          <span title="${t("Los ganó otra persona")}"><b>${Math.max(0, cara.juntos - cara.enMarcha - cara.mias - cara.suyas)}</b><small>${t("otro ganó")}</small></span>
        </div>
        <div class="amigo-botones">
          <button class="perfil-boton perfil-chat">${icono("mensaje")} ${t("Chat")}</button>
          <button class="perfil-boton perfil-retar">${icono("espadas")} ${t("Retar a un locke")}</button>
        </div>
      </section>`}

      <!-- (Las clases a-juntos y a-lockes dicen el sitio: debajo del cara a cara y debajo de los equipos) -->
      <section class="amigo-tarjeta a-juntos">
        ${cabezaCaja(t("Lockes"), "", botonVerTodosCaja(lockes.length, esMio ? HUECOS_LOCKES_MIO : HUECOS_LOCKES, "lockes"))}
        ${listaFija(lockes, esMio ? HUECOS_LOCKES_MIO : HUECOS_LOCKES, esMio ? t("Todavía no has terminado ningún locke.") : t("Todavía no ha jugado ningún locke."))}
      </section>
      </div>

      <section class="amigo-tarjeta a-equipos">
        ${cabezaCaja(t("Equipos destacados"), `${piezas.equipos.length}/${HUECOS_EQUIPOS}`)}
        <div class="amigo-equipos">${[...equipos, ...equiposVacios].join("")}</div>
      </section>

      <section class="amigo-tarjeta a-lockes">
        ${cabezaCaja(esMio ? t("En marcha") : t("Jugados juntos"), String(juntos.length), botonVerTodosCaja(juntos.length, esMio ? HUECOS_EN_MARCHA : HUECOS_JUNTOS, "juntos"))}
        ${listaFija(juntos, esMio ? HUECOS_EN_MARCHA : HUECOS_JUNTOS, esMio ? t("No estás jugando ningún locke ahora mismo.") : t("Todavía no habéis jugado ningún locke juntos."))}
      </section>

      <div class="amigo-columna-3">
        <section class="amigo-tarjeta a-coleccion">
          ${cabezaCaja(t("Colección"), piezas.coleccion.cargando ? "" : `${t("{n} especies", { n: piezas.coleccion.especies })}${piezas.coleccion.shiny ? ` · ${icono("estrella")} ${piezas.coleccion.shiny}` : ""}`, esMio ? `<button class="perfil-mini" data-ir-coleccion>${t("Ver colección")}</button>` : "")}
          <div class="amigo-coleccion">${huecosConMas(piezas.coleccion.caras, HUECOS_COLECCION, "amigo-coleccion-hueco", "coleccion")}</div>
        </section>

        <section class="amigo-tarjeta a-logros">
          ${cabezaCaja(t("Logros"), t("{n} de {total}", { n: piezas.logros.hechos, total: piezas.logros.total }), esMio ? `<button class="perfil-mini perfil-ver-logros">${t("Ver todos")}</button>` : "")}
          <div class="perfil-logros-barra"><span style="width: ${Math.round((piezas.logros.hechos / Math.max(1, piezas.logros.total)) * 100)}%"></span></div>
          <div class="amigo-logros-cats">
            ${piezas.logros.categorias
              .map(
                (categoria) => `
                  <span class="amigo-logros-cat ${categoria.hechos === categoria.total ? "lleno" : ""}">
                    <span class="amigo-logros-cat-texto"><span>${escaparHTML(categoria.nombre)}</span><b>${categoria.hechos}/${categoria.total}</b></span>
                    <span class="logro-barra"><span style="width: ${Math.round((categoria.hechos / Math.max(1, categoria.total)) * 100)}%"></span></span>
                  </span>`
              )
              .join("")}
          </div>
        </section>

        <section class="amigo-tarjeta a-amigos">
          ${cabezaCaja(t("Amigos"), String(piezas.amigos.total))}
          <div class="amigo-amigos">${huecosConMas(susAmigos, HUECOS_AMIGOS, "amigo-amigo-hueco", "amigos")}</div>
        </section>
      </div>
    </div>`;

  const editar = esMio ? `<button class="perfil-boton perfil-editar amigo-editar-abajo">${icono("lapiz")} ${t("Editar perfil")}</button>` : "";
  return `<div class="amigo-p ${esMio ? "amigo-p-mio" : ""}">${portada}${tarjetas}${editar}</div>`;
}


const TITULOS_GRUPO = { vivo: "En directo", on: "Conectados", off: "Desconectados" };

// Pinta la lista y el amigo elegido. Conserva el que estaba elegido y hasta dónde habías bajado.
function pintarAmigos() {
  const perfiles = perfilesDeAmigos();
  const fichas = amigosAceptados()
    .map((amistad) => perfiles.get(amistad.otro))
    .filter(Boolean)
    .map((perfil) => fichaDePerfil(perfil, false));
  // Por situación (en directo, conectados, el resto) y, dentro de cada una, en el orden que hayas
  // dejado arrastrando (los que no has movido, al final y por nombre)
  const orden = ordenDeAmigos();
  const puesto = (clave) => (orden.includes(clave) ? orden.indexOf(clave) : orden.length);
  fichas.sort(
    (una, otra) =>
      ORDEN_SITUACION[situacionDe(una.clave)] - ORDEN_SITUACION[situacionDe(otra.clave)] ||
      puesto(una.clave) - puesto(otra.clave) ||
      una.nombre.localeCompare(otra.nombre, LOCALE)
  );
  fichasEnOrden = fichas.map((ficha) => ficha.clave);

  const conectados = fichas.filter((ficha) => situacionDe(ficha.clave) !== "off").length;
  const soloConectados = seccion.querySelector(".amigos-solo-conectados");
  soloConectados.innerHTML = `<span class="amigos-interruptor"></span>${t("Conectados")}`;
  soloConectados.setAttribute("aria-pressed", String(filtroLista === "conectados"));
  soloConectados.title = filtroLista === "conectados" ? t("Ver todos ({n})", { n: fichas.length }) : t("Ver solo los conectados ({n})", { n: conectados });

  if (!fichas.some((ficha) => ficha.clave === elegido)) elegido = fichas.length ? fichas[0].clave : "";
  const busca = textoFiltro.trim().toLocaleLowerCase(LOCALE);
  const visibles = fichas.filter(
    (ficha) =>
      (filtroLista !== "conectados" || situacionDe(ficha.clave) !== "off") &&
      (!busca || ficha.nombre.toLocaleLowerCase(LOCALE).includes(busca))
  );

  // Solo se repinta lo que ha cambiado: la presencia avisa a menudo y repintar sin motivo hacía
  // parpadear la barra de desplazamiento (y volvía a pedir las fotos)
  const htmlLista = ["vivo", "on", "off"]
    .map((situacion) => {
      const delGrupo = visibles.filter((ficha) => situacionDe(ficha.clave) === situacion);
      if (!delGrupo.length) return "";
      return `
        <span class="amigo-grupo">${t(TITULOS_GRUPO[situacion])} · ${delGrupo.length}</span>
        ${delGrupo.map((ficha) => plantillaFila(ficha, perfiles.get(ficha.clave))).join("")}`;
    })
    .join("") || `<p class="amigo-nota amigo-nota-lista">${!fichas.length ? "" : busca ? t("Ningún amigo se llama así.") : t("Ninguno conectado ahora.")}</p>`;
  if (htmlLista !== ultimaLista && !arrastrando) {
    const bajado = columna.scrollTop;
    columna.innerHTML = htmlLista;
    columna.scrollTop = bajado;
    ultimaLista = htmlLista;
  }

  const ficha = fichas.find((cada) => cada.clave === elegido);
  fichasPintadas = new Map(ficha ? [[ficha.clave, ficha]] : []);
  const htmlPanel = ficha
    ? plantillaPanel(ficha, perfiles.get(ficha.clave))
    : `
      <div class="amigos-vacio">
        ${icono("amigos")}
        <p>${t("Todavía no tienes amigos aquí.")}</p>
        <p class="amigo-nota">${t("Agrega a alguien por su mote, o busca compañeros en el Foro.")}</p>
      </div>`;
  if (htmlPanel === ultimoPanel) return;
  cerrarFlotante();
  const mismoAmigo = panel.dataset.clave === (ficha ? ficha.clave : "");
  const bajadoPanel = panel.scrollTop;
  panel.innerHTML = htmlPanel;
  panel.dataset.clave = ficha ? ficha.clave : "";
  // Del color que haya elegido (como en su ventana) y con el aviso de chat sin leer
  if (ficha) panel.style.setProperty("--color-vista", rgbDePerfil(perfiles.get(ficha.clave)));
  else panel.style.removeProperty("--color-vista");
  const chat = panel.querySelector(".perfil-chat");
  if (chat) chat.classList.toggle("sin-leer", haySinLeer(ficha.clave));
  panel.scrollTop = mismoAmigo ? bajadoPanel : 0;
  ultimoPanel = htmlPanel;
  if (ficha && conTodosAbierto.has(ficha.clave)) {
    const verTodos = panel.querySelector(".amigo-lockes-suyos .ver-todos");
    if (verTodos) alternarVerTodos(verTodos);
  }
}

// ---------- Ordenar la lista arrastrando ----------
//
// Cada uno ordena a sus amigos como quiera, dentro de su grupo (en directo, conectados, el resto):
// se arrastra uno encima de otro del mismo grupo. Se guarda con tu cuenta. (La clave es la de
// antes de cómo se veía la lista, que ya no se usa: así no hace falta tocar las reglas de la nube.)
const CLAVE_ORDEN = "poketeams-amigos-vista-v1";
let fichasEnOrden = [];   // los uid tal como salen en la lista ahora
let arrastrando = null;   // { clave, situacion } mientras se arrastra uno

function ordenDeAmigos() {
  const guardado = leer(CLAVE_ORDEN, null);
  return guardado && Array.isArray(guardado.orden) ? guardado.orden : [];
}

function moverAmigo(clave, junto, detras) {
  const lista = fichasEnOrden.filter((cada) => cada !== clave);
  const donde = lista.indexOf(junto);
  if (donde < 0) return;
  lista.splice(detras ? donde + 1 : donde, 0, clave);
  escribir(CLAVE_ORDEN, { orden: lista });
}

function activarArrastre() {
  const limpiar = () => {
    for (const fila of columna.querySelectorAll(".arrastrando, .soltar-antes, .soltar-despues")) {
      fila.classList.remove("arrastrando", "soltar-antes", "soltar-despues");
    }
  };
  columna.addEventListener("dragstart", (e) => {
    const fila = e.target.closest(".amigo-fila");
    if (!fila) return;
    arrastrando = { clave: fila.dataset.clave, situacion: fila.dataset.situacion };
    fila.classList.add("arrastrando");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", fila.dataset.clave);
  });
  columna.addEventListener("dragover", (e) => {
    const fila = e.target.closest(".amigo-fila");
    if (!arrastrando || !fila || fila.dataset.situacion !== arrastrando.situacion || fila.dataset.clave === arrastrando.clave) return;
    e.preventDefault();
    const caja = fila.getBoundingClientRect();
    const detras = e.clientY > caja.top + caja.height / 2;
    for (const otra of columna.querySelectorAll(".soltar-antes, .soltar-despues")) {
      if (otra !== fila) otra.classList.remove("soltar-antes", "soltar-despues");
    }
    fila.classList.toggle("soltar-antes", !detras);
    fila.classList.toggle("soltar-despues", detras);
  });
  columna.addEventListener("drop", (e) => {
    const fila = e.target.closest(".amigo-fila");
    if (!arrastrando || !fila || fila.dataset.situacion !== arrastrando.situacion) return;
    e.preventDefault();
    moverAmigo(arrastrando.clave, fila.dataset.clave, fila.classList.contains("soltar-despues"));
  });
  columna.addEventListener("dragend", () => {
    arrastrando = null;
    limpiar();
    pintarAmigos();
  });
}

// Lo último pintado en la lista y en el amigo (para no repintar si no ha cambiado nada)
let ultimaLista = null;
let ultimoPanel = null;

// En ordenador, la lista y el amigo llegan justo hasta abajo de la ventana, cada uno con su propio
// desplazamiento (como el Foro). En pantallas estrechas, la página se desplaza normal.
function ajustarAlto() {
  if (!lista || seccion.hidden) return;
  if (!matchMedia("(min-width: 901px)").matches) {
    lista.style.height = "";
    return;
  }
  const arriba = lista.getBoundingClientRect().top + window.scrollY;
  // Con menos alto, la página baja en vez de aplastar las tarjetas
  lista.style.height = `${Math.max(46 * 16, innerHeight - arriba - 16)}px`;
}

function elegirAmigo(uid) {
  if (uid === elegido) return;
  elegido = uid;
  pintarAmigos();
  if (matchMedia("(max-width: 900px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function recargar() {
  const mio = hayNube() && usuarioActual() ? miPerfil() : null;

  // Sin sesión (o mientras el perfil llega) no hay nada que enseñar. Si no llega porque
  // Firestore no deja leerlo, eso sí se dice.
  if (!mio) {
    columna.innerHTML = "";
    panel.innerHTML = "";
    ultimaLista = ultimoPanel = null;
    botonSolicitudes.hidden = true;
    aviso.textContent = hayNube() && usuarioActual() ? fallaElPerfil() : "";
    return;
  }

  botonSolicitudes.hidden = false;
  aviso.textContent = fallaLasAmistades();
  pintarSolicitudes();
  pintarAmigos();
}

// ---------- Las solicitudes: un botón con el número y una ventana ----------
//
// Con muchas, la ventana se desplaza (no ocupa la sección). Además, aceptarlas o rechazarlas todas.

function plantillaSolicitud(amistad, perfiles, usuario) {
  const perfil = perfiles.get(amistad.otro);
  const nombre = escaparHTML((perfil && perfil.nombre) || t("Alguien"));
  const ganados = perfil ? (perfil.ganados || []).length : 0;
  const nota = perfil
    ? `${t(ganados === 1 ? "{n} locke ganado" : "{n} lockes ganados", { n: ganados })}${perfil.busca ? ` · ${t("Busca compañeros")}` : ""}`
    : "";
  const foto = perfil ? plantillaFoto(fichaDePerfil(perfil, false), 2.4) : "";
  const botones =
    amistad.pidio === usuario.uid
      ? `<button class="solicitud-cancelar" title="${t("Cancelar")}" aria-label="${t("Cancelar")}">${icono("aspa")}</button>`
      : `<button class="solicitud-rechazar" title="${t("Rechazar")}" aria-label="${t("Rechazar")}">${icono("aspa")}</button>
         <button class="solicitud-aceptar" title="${t("Aceptar")}" aria-label="${t("Aceptar")}">${icono("visto")}</button>`;
  return `
    <div class="solicitud" data-amistad="${escaparHTML(amistad.id)}">
      ${foto}
      <p><b>${nombre}</b>${nota ? `<small>${escaparHTML(nota)}</small>` : ""}</p>
      ${botones}
    </div>`;
}

function pintarSolicitudes() {
  const usuario = usuarioActual();
  if (!usuario) return;
  const perfiles = perfilesDeAmigos();
  const recibidas = solicitudesRecibidas();
  const enviadas = solicitudesEnviadas();
  const enPestana = pestanaSolicitudes === "recibidas" ? recibidas : enviadas;

  const insignia = botonSolicitudes.querySelector(".amigos-badge");
  insignia.textContent = recibidas.length > 99 ? "99+" : recibidas.length;
  // Siempre a la vista, también a 0
  insignia.hidden = false;
  insignia.classList.toggle("cero", recibidas.length === 0);

  ventanaSolicitudes.innerHTML = `
    <div class="amigos-pop-cabeza">
      <strong>${t("Solicitudes")}</strong>
      <div class="amigos-pop-pestanas">
        <button data-pestana="recibidas" class="${pestanaSolicitudes === "recibidas" ? "elegida" : ""}">${t("Recibidas")} <small>${recibidas.length}</small></button>
        <button data-pestana="enviadas" class="${pestanaSolicitudes === "enviadas" ? "elegida" : ""}">${t("Enviadas")} <small>${enviadas.length}</small></button>
      </div>
    </div>
    <div class="amigos-pop-lista">
      ${enPestana.map((amistad) => plantillaSolicitud(amistad, perfiles, usuario)).join("") ||
        `<p class="amigo-nota">${pestanaSolicitudes === "recibidas" ? t("No tienes solicitudes.") : t("No has enviado ninguna.")}</p>`}
    </div>
    ${pestanaSolicitudes === "recibidas" && recibidas.length > 1
      ? `<div class="amigos-pop-pie">
           <button data-todas="rechazar">${t("Rechazar todas")}</button>
           <button data-todas="aceptar" class="principal">${t("Aceptar todas")}</button>
         </div>`
      : ""}`;
}

function cerrarSolicitudes() {
  ventanaSolicitudes.hidden = true;
  botonSolicitudes.setAttribute("aria-expanded", "false");
}

async function responderSolicitudes(e) {
  const pestana = e.target.closest("[data-pestana]");
  if (pestana) {
    pestanaSolicitudes = pestana.dataset.pestana;
    pintarSolicitudes();
    return;
  }

  const todas = e.target.closest("[data-todas]");
  if (todas) {
    const aceptar = todas.dataset.todas === "aceptar";
    for (const cada of ventanaSolicitudes.querySelectorAll("button")) cada.disabled = true;
    try {
      for (const amistad of solicitudesRecibidas()) {
        if (aceptar) await aceptarAmistad(amistad.id);
        else await borrarAmistad(amistad.id);
      }
    } catch (error) {
      console.error(error);
      pintarSolicitudes();
    }
    return;
  }

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
}


// ---------- Agregar un amigo ----------

// Solo por mote (por correo ya no se puede buscar a nadie)
// ---------- Agregar amigos: una ventana con el buscador ----------
//
// Como en otros juegos: hay que escribir su nombre de usuario EXACTO (da igual mayúsculas o
// minúsculas) y entonces sale su tarjetita (foto, nombre, título y fondo), con «Agregar» y
// «Bloquear». No hay listas de gente que empiece por lo que escribes: así nadie puede sacar la
// lista de todos los usuarios (las reglas de la nube solo dejan preguntar por un nombre concreto).

let dialogoAgregar = null;
let encontrado = null;   // el perfil que ha salido
let vueltaBusqueda = 0;  // para quedarse solo con la última búsqueda
let esperaBusqueda = null;

function abrirAgregar() {
  if (!usuarioActual()) return;
  const campo = dialogoAgregar.querySelector(".agregar-campo");
  campo.value = "";
  encontrado = null;
  pintarAgregar("");
  dialogoAgregar.showModal();
  campo.focus();
}

// Lo que sale debajo del campo: su tarjetita con lo que se puede hacer, o por qué no sale nadie
function pintarAgregar(mensaje) {
  const caja = dialogoAgregar.querySelector(".agregar-resultado");
  if (!encontrado) {
    caja.innerHTML = mensaje ? `<p class="agregar-mensaje">${escaparHTML(mensaje)}</p>` : "";
    return;
  }
  const perfil = encontrado;
  const yo = (usuarioActual() || {}).uid;
  const ficha = fichaDePerfil(perfil, perfil.uid === yo);
  const fondo = fondoVisual(perfil);
  const relacion = relacionCon(perfil.uid);
  const bloqueado = estaBloqueado(perfil.uid);
  let botones;
  if (perfil.uid === yo) botones = `<span class="agregar-estado">${t("Eres tú")}</span>`;
  else if (bloqueado) botones = `<button class="agregar-desbloquear">${t("Desbloquear")}</button>`;
  else {
    const principal =
      relacion === "ok" ? `<span class="agregar-estado">${icono("visto")} ${t("Ya es tu amigo")}</span>`
      : relacion === "enviada" ? `<span class="agregar-estado">${t("Solicitud enviada")}</span>`
      : relacion === "recibida" ? `<button class="agregar-aceptar principal">${icono("visto")} ${t("Aceptar")}</button>`
      : `<button class="agregar-pedir principal">${icono("mas")} ${t("Agregar")}</button>`;
    botones = `${principal}<button class="agregar-bloquear" title="${t("No podrá pedirte amistad ni escribirte")}">${icono("aspa")} ${t("Bloquear")}</button>`;
  }
  caja.innerHTML = `
    <div class="agregar-tarjeta ${fondo.clase}" style="--color-vista: ${rgbDePerfil(perfil)}; ${fondo.estilo}">
      ${plantillaFoto(ficha, 3)}
      <span class="agregar-quien">
        <b>${escaparHTML(ficha.nombre)}</b>
        ${ficha.titulo || ""}
      </span>
      <span class="agregar-botones">${botones}</span>
    </div>
    ${mensaje ? `<p class="agregar-mensaje">${escaparHTML(mensaje)}</p>` : ""}`;
}

async function buscarExacto(texto) {
  const esta = ++vueltaBusqueda;
  encontrado = null;
  if (texto.length < 3) {
    pintarAgregar(texto ? t("Escribe su nombre de usuario entero.") : "");
    return;
  }
  pintarAgregar(t("Buscando..."));
  try {
    const perfil = await buscarAmigo(texto);
    if (esta !== vueltaBusqueda) return;
    encontrado = perfil;
    pintarAgregar(perfil ? "" : texto.includes("@") ? t("Se busca por nombre de usuario, no por correo.") : t("Nadie se llama así. Tiene que ser su nombre exacto."));
  } catch (error) {
    if (esta !== vueltaBusqueda) return;
    console.error(error);
    pintarAgregar(t("No se ha podido buscar. Inténtalo otra vez."));
  }
}

function activarAgregar() {
  dialogoAgregar = document.querySelector("#dialogo-agregar-amigo");
  dialogoAgregar.querySelector(".agregar-titulo").textContent = t("Agregar amigos");
  dialogoAgregar.querySelector(".agregar-nota").textContent = t("Escribe su nombre de usuario exacto (da igual si es con mayúsculas o minúsculas).");
  const campo = dialogoAgregar.querySelector(".agregar-campo");
  campo.placeholder = t("Nombre de usuario");
  const cerrar = dialogoAgregar.querySelector(".agregar-cerrar");
  cerrar.textContent = t("Cerrar");
  cerrar.addEventListener("click", () => dialogoAgregar.close());

  // Busca al dejar de escribir (o al pulsar Intro)
  campo.addEventListener("input", () => {
    clearTimeout(esperaBusqueda);
    esperaBusqueda = setTimeout(() => buscarExacto(campo.value.trim()), 450);
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    clearTimeout(esperaBusqueda);
    buscarExacto(campo.value.trim());
  });

  dialogoAgregar.querySelector(".agregar-resultado").addEventListener("click", async (e) => {
    const boton = e.target.closest("button");
    if (!boton || !encontrado) return;
    const perfil = encontrado;
    boton.disabled = true;
    try {
      if (boton.classList.contains("agregar-pedir")) {
        await pedirAmistad(perfil.uid);
        pintarAgregar(t("Solicitud enviada a {nombre}.", { nombre: perfil.nombre }));
      } else if (boton.classList.contains("agregar-aceptar")) {
        const amistad = solicitudesRecibidas().find((cada) => cada.otro === perfil.uid);
        if (amistad) await aceptarAmistad(amistad.id);
        pintarAgregar(t("{nombre} ya es tu amigo.", { nombre: perfil.nombre }));
      } else if (boton.classList.contains("agregar-bloquear")) {
        if (!(await confirmar(t("¿Bloquear a {nombre}? No podrá pedirte amistad ni escribirte.", { nombre: perfil.nombre })))) {
          boton.disabled = false;
          return;
        }
        await bloquear(perfil.uid);
        pintarAgregar(t("Has bloqueado a {nombre}.", { nombre: perfil.nombre }));
      } else if (boton.classList.contains("agregar-desbloquear")) {
        await desbloquear(perfil.uid);
        pintarAgregar(t("Has desbloqueado a {nombre}.", { nombre: perfil.nombre }));
      }
      await recargar();
    } catch (error) {
      console.error(error);
      pintarAgregar(t("No se ha podido. Inténtalo otra vez."));
    }
  });
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

// ---------- Clicks en la lista y en el amigo elegido ----------

function activarCuerpo() {
  lista.addEventListener("click", async (e) => {
    // Un locke de «Sus lockes»: abre sus datos
    const locke = e.target.closest(".locke-ganado");
    if (locke) {
      const datos = fichasPintadas.get(elegido);
      const ganado = datos && datos.jugados[Number(locke.dataset.posicion)];
      if (ganado) abrirFlotante(locke, ganado, datos);
      return;
    }

    // Otro amigo de la lista
    const fila = e.target.closest(".amigo-fila");
    if (fila) {
      elegirAmigo(fila.dataset.clave);
      return;
    }

    const boton = e.target.closest("button");
    if (!boton || !panel.contains(boton)) {
      cerrarFlotante();
      return;
    }

    // «⋯» de la ficha: abre o cierra sus opciones
    if (boton.classList.contains("amigo-mas-boton")) {
      const opciones = boton.parentElement.querySelector(".menu-mas-lista");
      opciones.hidden = !opciones.hidden;
      boton.setAttribute("aria-expanded", String(!opciones.hidden));
      return;
    }
    const menu = boton.closest(".amigo-mas .menu-mas-lista");
    if (menu) menu.hidden = true;

    // «Ver todos» o «+n» de una tarjeta: una ventana con todo
    if (boton.classList.contains("amigo-ver-mas")) {
      abrirTodo(boton.dataset.ver);
      return;
    }

    // Lo que es del perfil (copiar un equipo, ver todos sus lockes o sus logros)
    if (modPerfil && modPerfil.pulsarEnPerfilIncrustado(boton)) return;

    if (boton.matches(".perfil-amigo, .amigo-su-amigo")) {
      abrirSuAmigo(boton.dataset.uid);
      return;
    }

    const datos = fichasPintadas.get(elegido);
    try {
      if (boton.classList.contains("ver-todos")) {
        cerrarFlotante();
        const abierta = alternarVerTodos(boton);
        if (boton.closest(".amigo-lockes-suyos")) {
          if (abierta) conTodosAbierto.add(elegido);
          else conTodosAbierto.delete(elegido);
        }
      } else if (boton.classList.contains("ver-directo")) {
        const { verDirecto } = await import("../jugar/directo.js");
        verDirecto(elegido, datos ? datos.nombre : "", directoDe(elegido));
      } else if (boton.classList.contains("accion-chat") || boton.classList.contains("perfil-chat")) {
        const { abrirChat } = await import("../chat.js");
        abrirChat(elegido);
      } else if (boton.classList.contains("accion-invitar") || boton.classList.contains("perfil-retar")) await invitarAUnLocke(elegido);
      else if (boton.classList.contains("accion-estadisticas")) abrirEstadisticas(elegido, htmlComparacion(elegido));
      else if (boton.classList.contains("accion-quitar")) await quitarAmigo(datos);
      else if (boton.classList.contains("junto-abrir")) await abrirElLocke(boton.dataset.locke);
    } catch (error) {
      console.error(error);
      aviso.textContent = t("No se ha podido. Inténtalo otra vez.");
    }
  });
}

// Uno de sus amigos: si también es tuyo, se elige aquí; si eres tú o no lo es, su ventana
export function abrirSuAmigo(uid) {
  if (uid === (usuarioActual() || {}).uid) modPerfil.abrirMiPerfil();
  else if (amigosAceptados().some((amistad) => amistad.otro === uid)) verAmigo(uid).catch((error) => console.error(error));
  else modPerfil.abrirPerfilDe(uid);
}

// Ir a «Amigos» con él elegido (desde tu perfil, se cierra su ventana)
async function verAmigo(uid) {
  const ventana = document.querySelector("#dialogo-perfil");
  if (ventana && ventana.open) ventana.close();
  if (seccion.hidden) {
    const { irA } = await import("../navegacion.js");
    await irA("amigos");
  }
  elegirAmigo(uid);
}

// La ventana de «Ver todos»: cerrar, y desde ella abrir un amigo o un locke
function activarVentanaTodo() {
  dialogoTodo = document.querySelector("#dialogo-amigo-todo");
  const cerrar = dialogoTodo.querySelector(".amigo-todo-cerrar");
  cerrar.textContent = t("Cerrar");
  dialogoTodo.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton === cerrar) dialogoTodo.close();
    else if (boton.matches(".perfil-amigo, .amigo-su-amigo")) {
      dialogoTodo.close();
      abrirSuAmigo(boton.dataset.uid);
    } else if (boton.classList.contains("junto-abrir")) {
      dialogoTodo.close();
      abrirElLocke(boton.dataset.locke).catch((error) => console.error(error));
    }
  });
}

async function quitarAmigo(ficha) {
  if (!ficha) return;
  if (!(await confirmar(t("¿Quitar a {nombre} de tus amigos?", { nombre: ficha.nombre })))) return;

  const amistad = amigosAceptados().find((cada) => cada.otro === ficha.clave);
  if (amistad) await borrarAmistad(amistad.id);
}

// «Invitar a un locke»: la ventana de «Nuevo locke» con él ya puesto (como «Retar a un locke» del perfil)
async function invitarAUnLocke(uid) {
  const { irA, prepararSeccion } = await import("../navegacion.js");
  await irA("lockes");
  const lockes = await prepararSeccion("versus");
  await lockes.retarA(uid);
}

export async function abrirElLocke(id) {
  const ventana = document.querySelector("#dialogo-perfil");
  if (ventana && ventana.open) ventana.close();
  const { irA, prepararSeccion } = await import("../navegacion.js");
  await irA("lockes");
  const lockes = await prepararSeccion("versus");
  lockes.abrirElLocke(id);
}


// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-amigos");
  dialogoPalmares = document.querySelector("#dialogo-palmares");
  iniciarEstadisticas(alternarVerTodos);
  activarVentanaTodo();
  lista = seccion.querySelector(".amigos-cuerpo");
  columna = seccion.querySelector(".amigos-lista");
  panel = seccion.querySelector(".amigos-ficha");
  activarArrastre();
  botonSolicitudes = seccion.querySelector(".amigos-solicitudes-boton");
  ventanaSolicitudes = seccion.querySelector(".amigos-pop");
  aviso = seccion.querySelector(".amigos-aviso");

  seccion.querySelector(".amigos-agregar-caja").hidden = !hayNube();
  // Buscar entre tus amigos: la lista se filtra según escribes
  const filtrar = seccion.querySelector(".amigos-filtrar");
  filtrar.placeholder = t("Buscar entre tus amigos...");
  filtrar.addEventListener("input", () => {
    textoFiltro = filtrar.value;
    pintarAmigos();
  });
  const botonAgregar = seccion.querySelector(".amigos-agregar");
  botonAgregar.innerHTML = icono("agregarAmigos");
  botonAgregar.title = t("Agregar amigos");
  botonAgregar.setAttribute("aria-label", t("Agregar amigos"));
  botonAgregar.addEventListener("click", abrirAgregar);
  activarAgregar();

  // Todos o solo los conectados: un interruptor al lado de las solicitudes
  seccion.querySelector(".amigos-solo-conectados").addEventListener("click", () => {
    filtroLista = filtroLista === "conectados" ? "todos" : "conectados";
    pintarAmigos();
  });

  // Hasta abajo de la ventana (tus tipos de locke y tus lockes apuntados se editan en el perfil)
  window.addEventListener("resize", ajustarAlto);

  // Solicitudes: un botón con el número y una ventana que se abre debajo
  botonSolicitudes.innerHTML = `${icono("amigos")} <span>${t("Solicitudes")}</span><span class="amigos-badge" hidden></span>`;
  botonSolicitudes.addEventListener("click", () => {
    ventanaSolicitudes.hidden = !ventanaSolicitudes.hidden;
    botonSolicitudes.setAttribute("aria-expanded", String(!ventanaSolicitudes.hidden));
  });
  ventanaSolicitudes.addEventListener("click", responderSolicitudes);
  document.addEventListener("click", (e) => {
    if (ventanaSolicitudes.hidden || ventanaSolicitudes.contains(e.target) || botonSolicitudes.contains(e.target)) return;
    cerrarSolicitudes();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ventanaSolicitudes.hidden) cerrarSolicitudes();
  });

  activarCuerpo();

  // El «⋯» de la ficha se cierra al pulsar fuera
  document.addEventListener("click", (e) => {
    for (const opciones of panel.querySelectorAll(".amigo-mas .menu-mas-lista:not([hidden])")) {
      if (!opciones.parentElement.contains(e.target)) opciones.hidden = true;
    }
  });

  // El perfil del amigo elegido se pinta con js/perfil.js (el mismo que su ventana)
  const puedePintar = () => !seccion.hidden && hayNube() && usuarioActual() && miPerfil();
  import("../perfil.js")
    .then((modulo) => {
      modPerfil = modulo;
      modulo.alCambiarPerfilIncrustado(() => {
        if (puedePintar()) pintarAmigos();
      });
      if (puedePintar()) pintarAmigos();
    })
    .catch((error) => console.error("No se ha podido cargar el perfil", error));

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

  // Lo mismo con quién te ha escrito sin que lo hayas leído: solo se tocan las clases
  alCambiarChats(() => {
    for (const fila of lista.querySelectorAll(".amigo-fila")) fila.classList.toggle("sin-leer", haySinLeer(fila.dataset.clave));
    const chat = panel.querySelector(".perfil-chat");
    if (chat) chat.classList.toggle("sin-leer", haySinLeer(elegido));
  });

  // Quién está conectado o en directo cambia a menudo, y también los lockes de los dos
  alCambiarPresencia(() => {
    if (!seccion.hidden && hayNube() && usuarioActual() && miPerfil()) pintarAmigos();
  });
  alCambiarLockes(() => {
    if (!seccion.hidden && hayNube() && usuarioActual() && miPerfil()) pintarAmigos();
  });
}

function leerPalmaresDelDialogo() {
  const tipos = tiposDelDialogo();
  return [...dialogoPalmares.querySelectorAll(".fila-palmares")].map((fila, posicion) =>
    leerFila(fila, posicion, tipos)
  );
}

export function mostrar() {
  aviso.textContent = "";
  ajustarAlto();
  recargar().catch((error) => {
    console.error(error);
    aviso.textContent = t("No se han podido cargar los amigos.");
  });
}
