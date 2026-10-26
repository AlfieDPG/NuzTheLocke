// ---------- Seguir un locke (seguir.html) ----------
//
// Una página de solo lectura para que cualquiera, sin cuenta, vea cómo va un locke: marcador,
// medallas, cementerio y actividad, en directo. Pensada para quien juega en directo y quiere
// que le sigan. El enlace lleva el id del locke (seguir.html?c=ID) y solo vale si quien lo
// creó lo ha marcado como público (campo «publico»): las reglas de Firestore lo comprueban,
// no esta página.
//
// No inicia sesión ni toca nada: lee el locke y su actividad y se pone al día sola cuando
// cambian. Los datos están en js/comun/lockes.js; las frases de la actividad, las del resto
// de la web (js/versus/actividad.js).

import { CONFIG_FIREBASE, hayConfiguracion } from "./comun/firebase-config.js";
import { activarRespaldoImagenes } from "./comun/imagenes.js";
import { icono } from "./comun/iconos.js";
import { escaparHTML, fechaLarga } from "./comun/utilidades.js";
import { estadoDe, muertosDe, victoriasDe, seHaPasadoLaRom, medallasDe, estaEliminado } from "./comun/lockes.js";
import { medallasDelJuego } from "./comun/medallas.js";
import { nombreJuego } from "./comun/campo-juego.js";
import { colorDeTipo } from "./comun/perfiles.js";
import { caraDePokemon } from "./comun/elegir-equipo.js";
import { retratoMuerto, nombreMuerto } from "./versus/cementerio.js";
import { textoSuceso, iconoSuceso } from "./versus/actividad.js";
import { t, LOCALE } from "./comun/idioma.js";

const VERSION_SDK = "11.3.1";
const BASE_SDK = `https://www.gstatic.com/firebasejs/${VERSION_SDK}/`;
const SUCESOS = 50;
// Lo que se cuenta de la actividad (editar la partida son cosas internas)
const OCULTOS = ["edicion"];

let principal = null;
let locke = null;
let sucesos = [];
let error = "";

function fecha(milisegundos) {
  return new Date(milisegundos).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

// ---------- Pintar ----------

function plantillaJugador(uid) {
  const nombre = (locke.nombres || {})[uid] || t("Jugador");
  const foto = (locke.fotos || {})[uid] || "";
  const gano = locke.ganador === uid;
  const eliminado = !gano && estaEliminado(locke, uid);
  const vidas = locke.vidasIlimitadas ? "∞" : Math.max(0, (locke.vidas || {})[uid] || 0);

  const cifras = [
    [t("Vidas"), vidas],
    [t("Victorias"), victoriasDe(locke, uid)],
    [t("Muertos"), muertosDe(locke, uid).length],
    [t("ROM"), seHaPasadoLaRom(locke, uid) ? t("Pasada") : t("Sin pasar")]
  ];

  const medallas = medallasDelJuego(locke.juego, medallasDe(locke, uid).version);
  const tiene = new Set(medallasDe(locke, uid).tiene);
  const salon = (locke.salon || {})[uid];

  return `
    <section class="cronica-jugador ${gano ? "ganador" : ""} ${eliminado ? "eliminado" : ""}">
      <header>
        ${foto ? `<img class="cronica-foto" src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-quitar-si-falla>` : ""}
        <strong>${escaparHTML(nombre)}</strong>
        ${gano ? `<span class="cronica-corona">${icono("corona")}</span>` : ""}
        ${eliminado ? `<span class="cronica-fuera">${t("Eliminado")}</span>` : ""}
      </header>
      <dl class="cronica-cifras">
        ${cifras.map(([etiqueta, valor]) => `<div><dt>${escaparHTML(etiqueta)}</dt><dd>${escaparHTML(String(valor))}</dd></div>`).join("")}
      </dl>
      ${medallas.length
        ? `<div class="seguir-medallas" title="${t("Medallas")}: ${[...tiene].filter((i) => i < medallas.length).length}/${medallas.length}">
            ${medallas.map((m, i) => `<img class="${tiene.has(i) ? "conseguida" : ""}" src="${escaparHTML(m.imagen)}" alt="" title="${escaparHTML(m.nombre)}" loading="lazy">`).join("")}
          </div>`
        : ""}
      ${salon && (salon.pokemon || []).length
        ? `<div class="cronica-equipo">${salon.pokemon
            .map((p, i) => `<span class="cronica-cara ${i === salon.mvp ? "mvp" : ""}">${caraDePokemon(p)}${i === salon.mvp ? `<small>MVP</small>` : ""}</span>`)
            .join("")}</div>`
        : ""}
    </section>`;
}

function plantillaCementerio(jugadores) {
  const columnas = jugadores
    .map((uid) => ({ uid, muertos: muertosDe(locke, uid) }))
    .filter(({ muertos }) => muertos.length)
    .map(
      ({ uid, muertos }) => `
        <div class="seguir-columna">
          <h3>${escaparHTML((locke.nombres || {})[uid] || t("Jugador"))} <small>${muertos.length}</small></h3>
          <div class="seguir-tumbas">
            ${muertos
              .map((muerto) => `<figure class="seguir-tumba">${retratoMuerto(muerto, "seguir-cara")}<figcaption>${escaparHTML(nombreMuerto(muerto))}</figcaption></figure>`)
              .join("")}
          </div>
        </div>`
    );
  return columnas.length ? `<section><h2>${icono("calavera")} ${t("Cementerio")}</h2><div class="seguir-columnas">${columnas.join("")}</div></section>` : "";
}

function plantillaActividad() {
  const filas = sucesos
    .filter((suceso) => !OCULTOS.includes(suceso.tipo))
    .map((suceso) => {
      const texto = textoSuceso(suceso, locke);
      if (!texto) return "";
      return `
        <div class="suceso suceso-${escaparHTML(suceso.tipo)} ${suceso.delta < 0 ? "resta" : ""}">
          <span class="suceso-icono">${iconoSuceso(suceso)}</span>
          <span class="suceso-cuerpo"><span class="suceso-texto">${texto}</span></span>
          <time class="suceso-cuando">${fecha(suceso.cuando)}</time>
        </div>`;
    })
    .filter(Boolean);
  return `<section><h2>${icono("actividad")} ${t("Actividad")}</h2><div class="actividad-lista">${filas.join("") || `<p class="actividad-vacia">${t("Todavía no ha pasado nada.")}</p>`}</div></section>`;
}

function pintar() {
  if (error) {
    principal.innerHTML = `<p class="seguir-estado">${escaparHTML(error)}</p>`;
    return;
  }
  if (!locke) {
    principal.innerHTML = `<p class="seguir-estado">${t("Cargando el locke…")}</p>`;
    return;
  }

  const cerrado = locke.estado === "cerrado";
  const tipo = locke.tipo || { nombre: "Locke", color: "#3498db" };
  const juego = nombreJuego(locke);
  const jugadores = (locke.jugadores || []).filter((uid) => estadoDe(locke, uid) === "aceptado");
  const resultado = !cerrado
    ? ""
    : locke.ganador
      ? `${icono("corona")} ${t("Ganó {nombre}", { nombre: escaparHTML((locke.nombres || {})[locke.ganador] || t("alguien")) })}`
      : `${icono("aspa")} ${t("Nadie ganó")}`;

  document.title = `${locke.nombre} · NuzTheLocke`;
  principal.style.setProperty("--color-locke", colorDeTipo(tipo));
  principal.innerHTML = `
    <header class="seguir-cabecera">
      <span class="locke-tipo">${escaparHTML(tipo.nombre)}</span>
      <h1>${escaparHTML(locke.nombre)}</h1>
      <p class="seguir-meta">
        ${juego ? `<span>${icono("mando")} ${escaparHTML(juego)}</span>` : ""}
        ${cerrado
          ? `<span class="locke-resultado ${locke.ganador ? "" : "sin-ganador"}">${resultado}${locke.fechaFin ? ` · ${escaparHTML(fechaLarga(locke.fechaFin))}` : ""}</span>`
          : `<span class="seguir-directo"><i></i>${t("En directo")}</span>`}
      </p>
      ${locke.descripcion ? `<p class="seguir-descripcion">${escaparHTML(locke.descripcion)}</p>` : ""}
    </header>
    <div class="cronica-jugadores">${jugadores.map(plantillaJugador).join("")}</div>
    ${plantillaCementerio(jugadores)}
    ${plantillaActividad()}
    <footer class="seguir-pie">
      ${t("Solo lectura.")} <a href="index.html">${t("Hecho con NuzTheLocke")}</a>
    </footer>`;
}

// ---------- Arranque ----------

async function iniciar() {
  principal = document.getElementById("seguir");
  if (!principal) return;
  activarRespaldoImagenes();

  const id = new URLSearchParams(location.search).get("c");
  if (!id || !hayConfiguracion()) {
    error = t("Este enlace no vale.");
    pintar();
    return;
  }

  try {
    const [app, firestore] = await Promise.all([import(`${BASE_SDK}firebase-app.js`), import(`${BASE_SDK}firebase-firestore.js`)]);
    // Una app aparte y sin sesión: aquí no se entra, solo se mira
    const bd = firestore.getFirestore(app.initializeApp(CONFIG_FIREBASE, "seguidor"));
    const sinAcceso = () => {
      error = t("Este locke no es público, o el enlace ya no vale.");
      pintar();
    };

    firestore.onSnapshot(
      firestore.doc(bd, "lockes", id),
      (instantanea) => {
        if (!instantanea.exists()) return sinAcceso();
        locke = { id, ...instantanea.data() };
        error = "";
        pintar();
      },
      sinAcceso
    );
    firestore.onSnapshot(
      firestore.query(firestore.collection(bd, "lockes", id, "actividad"), firestore.orderBy("cuando", "desc"), firestore.limit(SUCESOS)),
      (instantanea) => {
        sucesos = instantanea.docs.map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return { id: documento.id, ...datos, cuando: datos.cuando ? datos.cuando.toMillis() : Date.now() };
        });
        pintar();
      },
      () => {} // sin actividad se sigue viendo el marcador
    );
  } catch (fallo) {
    console.error(fallo);
    error = t("No se ha podido cargar.");
    pintar();
  }
}

iniciar();
