// Sección «Jugar»: el emulador dentro de la web: Rojo Fuego / Verde Hoja (GBA) y los de DS.
//
//   · Tus partidas (./partidas.js): cada una con su ROM, su partida guardada y, si quieres, el locke que va
//     siguiendo. «Nueva partida»: eliges la ROM (.gba o .nds), el locke y si randomizarla aquí mismo (con las normas del
//     locke y tu semilla de ese locke, como en la sección «Randomizer», o con tus normas de esa sección). La ROM no
//     sale de este navegador. «Randomizar y jugar» de la sección «Randomizer» también crea una.
//   · El emulador es EmulatorJS con mGBA (GBA) o melonDS (DS), en un marco (emulador.html). Guarda la partida con el id de cada una, y la
//     web guarda además una copia (por si el navegador borra la del emulador).
//   · Con un locke, la web mira el juego mientras juegas:
//       - Cada vez que guardas en el juego, la partida pasa a «Lockes» como una partida vinculada
//         (js/partida/vinculo.js, entregarPartida): capturas en Rutas, medallas, árbitro, muertos...
//       - Cada poco, el equipo, de la memoria del juego (js/partida/gba.js y nds.js). Si cambia (una
//         captura, un nivel, una evolución) también se pasa, sin esperar a que guardes; y si uno se
//         queda a 0 PS, se avisa al momento para apuntarlo en el cementerio. En DS, mientras no se
//         encuentre en la memoria, el de la partida guardada (cada vez que guardas en el juego).
//   · Los controles los pone la web (no los de EmulatorJS, que se esconden): el teclado (./ajustes.js, se puede
//     cambiar), un mando táctil en el móvil y, debajo de la pantalla, pausa, velocidad, volumen, directo, pantalla
//     completa y «⋯» (filtro, pantallas de DS, teclas). Los mandos de verdad los sigue llevando EmulatorJS (con los
//     botones que hayas cambiado).
//
// Cómo se ve (decidido con el usuario, 2026-10-30): sin jugar, la última partida en grande («Seguir jugando», con su
// portada, su equipo y sus medallas: ./portadas.js) y las demás en filas; jugando, la pantalla con sus botones debajo
// y, a la derecha, cajas: los avisos, tu equipo, las teclas (plegadas) y el directo.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { leer, escribir } from "../comun/almacen.js";
import { confirmar, avisar, preguntar } from "../comun/ventanas.js";
import { usuarioActual, hayNube } from "../comun/nube.js";
import { misLockes, alCambiarLockes, lockePorId, apuntarMuerto, estaEliminado } from "../comun/lockes.js";
import { caraDePokemon } from "../comun/elegir-equipo.js";
import { prepararSeccion } from "../navegacion.js";
import { prepararGBA, esPartidaGBA, buscarEquipo, equipoEnMemoria, CAJAS_GBA } from "../partida/gba.js";
import { convertirPartida } from "../partida/convertir.js";
import { esPartidaDS, leerPartidaDS, equipoEnEstadoDS, buscarEquiposDS } from "../partida/nds.js";
import { nombreDeJuego } from "../comun/juegos.js";
import { medallasDelJuego } from "../comun/medallas.js";
import { entregarPartida } from "../partida/vinculo.js";
import { partidaDe, marcarMuertosVistos } from "../partida/partidas.js";
import { listaDePartidas, datosDe, romDe, savDe, crearPartida, cambiarPartida, guardarSav, borrarPartida } from "./partidas.js";
import { firmwareDS } from "./firmware-ds.js";
import { emitiendo, empezarDirecto, acabarDirecto, pintarCajaDirecto } from "./directo.js";
import {
  BOTON, ACELERAR, VELOCIDADES, misAjustes, cambiarAjustes, teclasDe, mandoDe, listaTeclas, abrirCambiarTeclas
} from "./ajustes.js";
import { abrirMenu, cerrarMenu } from "./menu.js";
import { portadaDe, resumenDe, olvidarResumen } from "./portadas.js";
import { t, enIngles, LOCALE } from "../comun/idioma.js";

const vista = document.getElementById("vista-jugar");
const barra = vista.querySelector(".jugar-barra");
const lista = vista.querySelector(".jugar-partidas");
const consola_ = vista.querySelector(".jugar-consola");
const pantalla = vista.querySelector(".jugar-pantalla");
const controles = vista.querySelector(".jugar-controles");
const mando = vista.querySelector(".jugar-mando");
const panel = vista.querySelector(".jugar-panel");
const cajaDirecto = vista.querySelector(".jugar-directo");
const cuerpo = vista.querySelector(".jugar-cuerpo");
const tira = vista.querySelector(".jugar-tira");

// Lo que piden otras secciones al venir: { locke } (el botón «Jugar» de un locke: su partida o una nueva para él) o
// { partida } (la recién creada con «Randomizar y jugar»: se empieza a jugar)
export const CLAVE_ELEGIDO = "poketeams-jugar-v1";
// Los que se saben mirar mientras se juega (ids de js/comun/juegos.js)
const JUEGOS = ["frlg", "dp", "platino", "hgss", "bw", "b2w2"];
// Los de DS, por las tres primeras letras del código de la ROM (0x0C)
const JUEGO_DE_CODIGO_DS = {
  ADA: "dp", APA: "dp", CPU: "platino", IPK: "hgss", IPG: "hgss", IRB: "bw", IRA: "bw", IRE: "b2w2", IRD: "b2w2"
};
const GEN_DE = { frlg: 3, dp: 4, platino: 4, hgss: 4, bw: 5, b2w2: 5 };

const CADA_MEMORIA = 1000; // ms entre vistazos al equipo
const CADA_PARTIDA = 4000; // ms entre vistazos a la partida guardada
const CADA_BUSQUEDA = 5000; // sin equipo encontrado, cada cuánto se vuelve a buscar
// El estado del emulador (mGBA): la memoria grande de la GBA va en 0x21000-0x60FFF
const MEMORIA = [0x21000, 0x61000];
const MARCA_MGBA = 0x01000000; // los 4 primeros bytes del estado de mGBA: 0x010000xx (la versión)

// Dónde empieza el estado de mGBA dentro del que da el emulador, o -1. El RetroArch de
// EmulatorJS lo mete en su formato «RASTATE»: «RASTATE» + versión (8 bytes) y bloques de
// [nombre de 4 letras, largo de 4 bytes, datos]; el de mGBA es el bloque «MEM ».
function inicioDelEstado(estado) {
  const texto = (i, largo) => String.fromCharCode(...estado.subarray(i, i + largo));
  const esMGBA = (i) => i >= 0 && i + MEMORIA[1] <= estado.length && (u32(estado, i) & 0xffffff00) === MARCA_MGBA;
  if (texto(0, 7) !== "RASTATE") return esMGBA(0) ? 0 : -1;
  for (let i = 8; i + 8 <= estado.length && i < 0x100; ) {
    const largo = u32(estado, i + 4);
    if (texto(i, 4) === "MEM ") return esMGBA(i + 8) ? i + 8 : -1;
    i += 8 + Math.ceil(largo / 8) * 8;
  }
  return -1;
}

const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

const tactil = matchMedia("(pointer: coarse)");

// Las pantallas de DS (./ajustes.js) en melonDS, y lo que ocupan (ancho / alto)
const DISPOSICION_DS = { vertical: "Top/Bottom", horizontal: "Left/Right", grande: "Hybrid Top" };
// Los píxeles de la consola a lo ancho y a lo alto, para el filtro LCD
const PIXELES = { gba: [240, 160], vertical: [256, 384], horizontal: [512, 192], grande: [768, 384] };

let partidas = []; // las guardadas (./partidas.js)
let destacada = ""; // la que se acaba de crear o la del locke del que se viene
let partida = null; // la que se está jugando ahora (ver empezar)
let ocupado = false;

// ---------- Lockes y ROM ----------

function lockesJugables() {
  if (!usuarioActual()) return [];
  return misLockes().filter((locke) => JUEGOS.includes(locke.juego) && locke.estado !== "cerrado");
}

const nombreDeLocke = (id) => (lockePorId(id) || {}).nombre || t("Locke");

// { consola, juego } de una ROM, o null si no es de las que se saben jugar. GBA: 0xB2 vale 0x96 y el código va en 0xAC
// (BPR = Rojo Fuego, BPG = Verde Hoja); DS: el código va en 0x0C
function queRom(bytes) {
  const texto = (desde, hasta) => String.fromCharCode(...bytes.subarray(desde, hasta));
  if (bytes.length > 0x200 && bytes[0xb2] === 0x96) return /^BP[RG]/.test(texto(0xac, 0xb0)) ? { consola: "gba", juego: "frlg" } : null;
  const juego = bytes.length > 0x200 && JUEGO_DE_CODIGO_DS[texto(0x0c, 0x0f)];
  return juego ? { consola: "nds", juego } : null;
}

// Una partida guardada que se sabe leer, de esa consola
const partidaValida = (consola, bytes) => Boolean(bytes) && (consola === "nds" ? esPartidaDS(bytes) : esPartidaGBA(bytes));

// La misma clave que CLAVE_SEMILLAS de js/randomizer/index.js: tu semilla de cada locke
const CLAVE_SEMILLAS = "poketeams-randomizer-semillas-v1";

async function semillaDe(idLocke) {
  const { nuevaSemilla } = await import("../randomizer/azar.js");
  if (!idLocke) return nuevaSemilla();
  const semillas = leer(CLAVE_SEMILLAS, {}) || {};
  if (!semillas[idLocke]) {
    semillas[idLocke] = nuevaSemilla();
    escribir(CLAVE_SEMILLAS, semillas);
  }
  return semillas[idLocke];
}

async function recargar() {
  partidas = await listaDePartidas();
  pintar();
}

// ---------- Nueva partida ----------

// La ventana: la ROM, el nombre, el locke y si randomizarla. idLocke: el que sale ya elegido
async function nuevaPartida(idLocke = "") {
  const { hayAlgo, misReglas } = await import("../randomizer/reglas.js");
  const misNormas = misReglas();
  const jugables = lockesJugables();
  const dialogo = document.createElement("dialog");
  dialogo.className = "ventana-web jugar-nueva";
  let archivo = null;
  let bytes = null;
  let tipo = null; // { consola, juego } de la ROM elegida

  const opcionesRandom = (id) => {
    const locke = id ? lockePorId(id) : null;
    return [
      ["no", t("No (sin randomizar, o ya randomizada)")],
      ...(locke && locke.randomizer ? [["locke", t("Con las normas del locke")]] : []),
      ...(misNormas && hayAlgo(misNormas) ? [["mias", t("Con tus normas de la sección «Randomizer»")]] : [])
    ];
  };
  const pintarRandom = () => {
    const id = dialogo.querySelector(".jugar-nueva-locke").value;
    const opciones = opcionesRandom(id);
    const elegir = opciones.some(([v]) => v === "locke") ? "locke" : "no";
    dialogo.querySelector(".jugar-nueva-random").innerHTML = opciones
      .map(([v, texto]) => `<option value="${v}" ${v === elegir ? "selected" : ""}>${escaparHTML(texto)}</option>`)
      .join("");
  };

  dialogo.innerHTML = `
    <h2>${icono("consola")} ${t("Nueva partida")}</h2>
    <div class="jugar-nueva-campos">
      <div class="jugar-nueva-fila">
        <span>${t("ROM")}</span>
        <span class="jugar-nueva-rom">
          <button type="button" class="jugar-nueva-elegir">${icono("subir")} ${t("Elegir ROM (.gba o .nds)")}</button>
          <small class="jugar-nueva-archivo"></small>
        </span>
      </div>
      <label class="jugar-nueva-fila"><span>${t("Nombre")}</span><input class="jugar-nueva-nombre" type="text" maxlength="40" autocomplete="off"></label>
      <label class="jugar-nueva-fila"><span>${t("Locke")}</span>
        <select class="jugar-nueva-locke">
          <option value="">${t("Sin locke")}</option>
          ${jugables.map((l) => `<option value="${escaparHTML(l.id)}" ${l.id === idLocke ? "selected" : ""}>${escaparHTML(l.nombre)}</option>`).join("")}
        </select>
      </label>
      <label class="jugar-nueva-fila"><span>${t("Randomizar")}</span><select class="jugar-nueva-random"></select></label>
      <p class="jugar-nota">${t("Si la ROM ya viene randomizada (de la sección «Randomizer»), deja «No»: si no, se randomizaría dos veces.")}</p>
      <p class="jugar-nueva-error con-error" hidden></p>
    </div>
    <div class="dialogo-botones">
      <button type="button" class="ventana-cancelar">${t("Cancelar")}</button>
      <button type="button" class="ventana-aceptar jugar-nueva-crear" disabled>${icono("reanudar")} ${t("Crear y jugar")}</button>
    </div>`;
  document.body.appendChild(dialogo);
  pintarRandom();
  dialogo.addEventListener("close", () => dialogo.remove());
  dialogo.querySelector(".jugar-nueva-locke").addEventListener("change", pintarRandom);
  const error = (texto) => {
    const p = dialogo.querySelector(".jugar-nueva-error");
    p.textContent = texto;
    p.hidden = !texto;
  };

  dialogo.addEventListener("click", async (e) => {
    const boton = e.target.closest("button");
    if (!boton || boton.disabled) return;
    if (boton.matches(".ventana-cancelar")) dialogo.close();
    else if (boton.matches(".jugar-nueva-elegir")) {
      const campo = document.createElement("input");
      campo.type = "file";
      campo.accept = ".gba,.nds";
      campo.addEventListener("change", async () => {
        const elegido = campo.files[0];
        if (!elegido) return;
        const leidos = new Uint8Array(await elegido.arrayBuffer());
        const deQue = queRom(leidos);
        if (!deQue) {
          error(t("Esa ROM no se puede jugar aquí (de momento, Rojo Fuego, Verde Hoja y los Pokémon de DS)."));
          return;
        }
        error("");
        archivo = elegido.name;
        bytes = leidos;
        tipo = deQue;
        dialogo.querySelector(".jugar-nueva-archivo").textContent = `${archivo} · ${nombreDeJuego(tipo.juego)}`;
        const nombre = dialogo.querySelector(".jugar-nueva-nombre");
        if (!nombre.value) nombre.value = archivo.replace(/\.(gba|nds)$/i, "");
        // Los lockes, solo los de ese juego
        const select = dialogo.querySelector(".jugar-nueva-locke");
        const antes = select.value;
        select.innerHTML = [`<option value="">${t("Sin locke")}</option>`, ...jugables.filter((l) => l.juego === tipo.juego)
          .map((l) => `<option value="${escaparHTML(l.id)}" ${l.id === antes ? "selected" : ""}>${escaparHTML(l.nombre)}</option>`)].join("");
        pintarRandom();
        dialogo.querySelector(".jugar-nueva-crear").disabled = false;
      });
      campo.click();
    } else if (boton.matches(".jugar-nueva-crear")) {
      const idElegido = dialogo.querySelector(".jugar-nueva-locke").value;
      const como = dialogo.querySelector(".jugar-nueva-random").value;
      const nombre = dialogo.querySelector(".jugar-nueva-nombre").value.trim() || archivo.replace(/\.(gba|nds)$/i, "");
      boton.disabled = true;
      let randomizada = false;
      if (como !== "no") {
        boton.innerHTML = `${icono("mezclar")} ${t("Randomizando...")}`;
        try {
          const { randomizarROM } = await import("../randomizer/randomizar.js");
          await new Promise((resolver) => setTimeout(resolver, 30)); // que se vea «Randomizando...»
          const reglas = como === "locke" ? lockePorId(idElegido).randomizer.reglas : misNormas;
          // Con las del locke, tu semilla de ese locke (la misma ROM que en «Randomizer»); con las tuyas, una nueva
          await randomizarROM(bytes, reglas, await semillaDe(como === "locke" ? idElegido : ""));
          randomizada = true;
        } catch (fallo) {
          console.error(fallo);
          error(t(fallo.message || "No se ha podido randomizar."));
          boton.disabled = false;
          boton.innerHTML = `${icono("reanudar")} ${t("Crear y jugar")}`;
          return;
        }
      }
      const id = await crearPartida({
        nombre, consola: tipo.consola, juego: tipo.juego, idLocke: idElegido, bytes, randomizada,
        archivo: randomizada ? archivo.replace(/(\.(gba|nds))?$/i, ` (random).${tipo.consola}`) : archivo
      });
      dialogo.close();
      destacada = id;
      await recargar();
      empezar(id);
    }
  });
  dialogo.showModal();
}

// ---------- Pintar ----------

function pintar() {
  pintarBarra();
  pintarLista();
  pintarPanel();
  pintarControles();
  lista.hidden = Boolean(partida);
  consola_.hidden = !partida;
  // Sin jugar no hay panel: la lista ocupa todo el ancho
  cuerpo.classList.toggle("sin-panel", !partida);
  requestAnimationFrame(ajustarPantalla);
}

// Un Pokémon en retrato (Mundo Misterioso), por su número
const retrato = (especie, clase) => caraDePokemon({ id: especie, nombre: "" }, clase);

// Arriba: sin jugar, «Nueva partida»; jugando, la partida (portada, nombre, locke y juego), su partida guardada y «Parar»
function pintarBarra() {
  if (!partida) {
    barra.innerHTML = partidas.length
      ? `<button class="jugar-nueva-boton">${icono("mas")} ${t("Nueva partida")}</button>`
      : "";
    return;
  }
  const { especie, color } = portadaDe({ juego: partida.juego }, partida.resumen);
  const detalle = [partida.idLocke ? `${icono("espadas")} ${escaparHTML(nombreDeLocke(partida.idLocke))}` : "", escaparHTML(nombreDeJuego(partida.juego))]
    .filter(Boolean)
    .join(" · ");
  barra.innerHTML = `
    <div class="jugar-cabeza" style="--juego: ${color}">
      ${retrato(especie, "jugar-portada")}
      <div class="jugar-cabeza-texto">
        <strong>${escaparHTML(partida.nombre)}</strong>
        <span class="jugar-detalle">${detalle}</span>
      </div>
    </div>
    <span class="jugar-acciones">
      <button class="jugar-sav-boton" title="${t("Partida guardada (.sav)")}" aria-label="${t("Partida guardada (.sav)")}">${icono("guardar")}</button>
      <button class="jugar-parar">${icono("aspa")} ${t("Parar")}</button>
    </span>`;
}

function cuando(fecha) {
  const minutos = Math.round((Date.now() - fecha) / 60000);
  if (minutos < 1) return t("ahora mismo");
  if (minutos < 60) return t("hace {n} min", { n: minutos });
  const horas = Math.round(minutos / 60);
  if (horas < 24) return horas === 1 ? t("hace 1 hora") : t("hace {n} horas", { n: horas });
  return new Date(fecha).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

// Las medallas del juego, como en «Lockes»: en gris hasta que las consigues (de la última partida guardada)
function plantillaMedallas(juego, resumen) {
  const lista = medallasDelJuego(juego, (resumen && resumen.version) || "");
  if (!lista.length) return "";
  const tienes = (resumen && resumen.medallas) || [];
  return `
    <span class="jugar-medallas ${lista.length > 8 ? "dos-filas" : ""}">
      ${lista.map((m, i) => {
        const titulo = escaparHTML(tienes[i] ? m.nombre : t("{medalla} (sin conseguir)", { medalla: m.nombre }));
        return `<img class="jugar-medalla ${tienes[i] ? "conseguida" : ""}" src="${escaparHTML(m.imagen)}" alt="${titulo}" title="${titulo}" loading="lazy">`;
      }).join("")}
    </span>`;
}

// Qué tipo de partida es: normal, randomizada, de un locke o de un locke randomizado
function plantillaTipo(p) {
  const [dibujo, texto, clase] = p.idLocke && p.randomizada
    ? ["espadas", t("Locke randomizado"), "locke"]
    : p.idLocke
      ? ["espadas", t("Locke"), "locke"]
      : p.randomizada
        ? ["mezclar", t("Randomizada"), "random"]
        : ["consola", t("Normal"), "normal"];
  return `<span class="jugar-tipo ${clase}">${icono(dibujo)} ${texto}</span>`;
}

const nivelDePs = (p) => {
  const parte = p.psMax ? Math.round((100 * p.ps) / p.psMax) : 0;
  return { parte, clase: parte > 50 ? "bien" : parte > 20 ? "casi" : "mal" };
};

const nombreDe = (p) => p.mote || (enIngles ? p.en || p.nombre : p.nombre);

// Siempre los 6 huecos del equipo: los que no tienen Pokémon, con borde de puntos
const seisHuecos = (equipo, pintar, vacio) => Array.from({ length: 6 }, (_, i) => (equipo[i] ? pintar(equipo[i]) : vacio)).join("");

// Tus partidas: la última jugada (o la recién creada) en grande, para seguir; las demás, en filas
function pintarLista() {
  if (!partidas.length) {
    lista.innerHTML = `
      <div class="jugar-vacio">
        ${icono("consola")}
        <h3>${t("Juega desde la web")}</h3>
        <ul class="jugar-explicacion">
          <li>${t("Sin instalar nada: el emulador va dentro de la web, también en el móvil.")}</li>
          <li>${t("Cada partida tiene su ROM y su partida guardada: nada se mezcla. La ROM no sale de tu navegador.")}</li>
          <li>${t("Al crearla puedes randomizar la ROM aquí mismo, con las normas del locke o con las tuyas, sin descargar nada.")}</li>
          <li>${t("Con un locke, la web mira la partida mientras juegas: tu equipo al momento, las capturas en «Rutas», las medallas en «Level caps» y, si un Pokémon se debilita, te lo propone para el cementerio.")}</li>
        </ul>
        <p class="jugar-nota">${t("De momento, Rojo Fuego, Verde Hoja y los Pokémon de DS. Se juega con el teclado, con un mando o, en el móvil, con los botones de la pantalla.")}</p>
        <button class="jugar-nueva-boton">${icono("mas")} ${t("Nueva partida")}</button>
      </div>`;
    return;
  }

  const primera = partidas.find((p) => p.id === destacada) || partidas[0];
  const otras = partidas.filter((p) => p !== primera);
  const nombreDelLocke = (p) => {
    const locke = p.idLocke ? lockePorId(p.idLocke) : null;
    return locke ? locke.nombre : t("Locke que ya no está");
  };
  const botonMas = (p, texto = "") => `<button class="jugar-mas" data-id="${escaparHTML(p.id)}" title="${t("Más")}" aria-label="${t("Más")}">${icono("puntos")}${texto}</button>`;

  // La grande, con lo que se sepa ya (el resumen se lee de la partida guardada: luego se repinta)
  const resumen = resumenGuardado.get(primera.id);
  const { especie, color } = portadaDe(primera, resumen);
  const equipo = seisHuecos(
    (resumen && resumen.equipo) || [],
    (p) => caraDePokemon(p, `jugar-cara ${p.ps === 0 ? "debilitado" : ""}`),
    `<span class="jugar-hueco" title="${t("Hueco libre")}"></span>`
  );
  const grande = `
    <article class="jugar-seguir" data-id="${escaparHTML(primera.id)}" style="--juego: ${color}">
      ${retrato(especie, "jugar-portada")}
      <div class="jugar-seguir-texto">
        <span class="jugar-ceja">${primera.jugada ? t("Lo último que jugaste · {cuando}", { cuando: cuando(primera.jugada) }) : t("Sin jugar todavía")}</span>
        <h3>${escaparHTML(primera.nombre)}</h3>
        <p class="jugar-detalle">
          <span>${icono("consola")} ${escaparHTML(nombreDeJuego(primera.juego || "frlg"))}</span>
          ${primera.idLocke ? `<span>${icono("espadas")} ${escaparHTML(nombreDelLocke(primera))}</span>` : ""}
          ${plantillaTipo(primera)}
          ${plantillaMedallas(primera.juego || "frlg", resumen)}
        </p>
        <div class="jugar-seguir-equipo">${equipo}</div>
      </div>
      <div class="jugar-seguir-botones">
        <button class="jugar-jugar" data-id="${escaparHTML(primera.id)}">${icono("reanudar")} ${primera.jugada ? t("Seguir jugando") : t("Empezar")}</button>
        ${botonMas(primera, ` ${t("Más")}`)}
      </div>
    </article>`;

  const filas = otras.map((p) => {
    const suyo = resumenGuardado.get(p.id);
    const portada = portadaDe(p, suyo);
    const detalle = [nombreDeJuego(p.juego || "frlg"), p.idLocke ? nombreDelLocke(p) : "", p.jugada ? cuando(p.jugada) : t("Sin jugar todavía")];
    return `
      <article class="jugar-fila" data-id="${escaparHTML(p.id)}" style="--juego: ${portada.color}">
        ${retrato(portada.especie, "jugar-portada")}
        <div class="jugar-fila-texto">
          <strong>${escaparHTML(p.nombre)}</strong>
          <span class="jugar-detalle">${escaparHTML(detalle.filter(Boolean).join(" · "))}</span>
        </div>
        <span class="jugar-fila-tipo">${plantillaTipo(p)}</span>
        <span class="jugar-fila-equipo">${seisHuecos(
          (suyo && suyo.equipo) || [],
          (x) => caraDePokemon(x, `jugar-cara ${x.ps === 0 ? "debilitado" : ""}`),
          `<span class="jugar-hueco"></span>`
        )}</span>
        <button class="jugar-jugar" data-id="${escaparHTML(p.id)}">${icono("reanudar")} ${t("Jugar")}</button>
        ${botonMas(p)}
      </article>`;
  }).join("");

  lista.innerHTML = `${grande}${otras.length ? `<h4 class="jugar-otras">${t("Otras partidas")}</h4><div class="jugar-filas">${filas}</div>` : ""}`;
  leerResumenes();
}

// Los resúmenes (equipo, medallas, versión) de las partidas guardadas: cuando llegan, se repinta la lista
const resumenGuardado = new Map();
let leyendo = false;

async function leerResumenes() {
  if (leyendo) return;
  leyendo = true;
  let cambia = false;
  try {
    for (const p of partidas) {
      const resumen = await resumenDe(p);
      if (resumenGuardado.get(p.id) !== resumen) {
        resumenGuardado.set(p.id, resumen);
        cambia = true;
      }
    }
  } finally {
    leyendo = false;
  }
  if (cambia && !partida) pintarLista();
}

// A la derecha, mientras se juega: los avisos (si hay), tu equipo y las teclas, cada cosa en su caja
function pintarPanel() {
  pintarTira();
  if (!partida) {
    panel.innerHTML = "";
    return;
  }
  const enLaTira = !tira.hidden;

  const equipo = partida.equipoVisto || [];
  const filas = equipo
    .map((p) => {
      const { parte, clase } = nivelDePs(p);
      return `
        <li class="jugar-pokemon ${p.ps === 0 ? "debilitado" : ""}">
          ${caraDePokemon(p, "jugar-cara")}
          <span class="jugar-pokemon-nombre">${escaparHTML(nombreDe(p))}</span>
          <small>${t("Nv.")} ${p.nivel}</small>
          ${p.huevo ? "" : `<span class="jugar-ps ${clase}" title="${p.ps}/${p.psMax}"><span style="width:${parte}%"></span></span>`}
        </li>`;
    })
    .join("");

  const avisos = partida.avisos
    .map(
      (aviso, i) => `
        <li class="jugar-aviso ${aviso.tipo}">
          ${aviso.cara || ""}
          <span>${escaparHTML(aviso.texto)}</span>
          ${aviso.tipo === "muerto" && !aviso.hecho ? `
            <span class="jugar-aviso-botones">
              <button class="jugar-apuntar" data-aviso="${i}">${icono("calavera")} ${t("Al cementerio")}</button>
              <button class="jugar-descartar" data-aviso="${i}">${t("No ha muerto")}</button>
            </span>` : ""}
        </li>`
    )
    .join("");

  const enDirecto = partida.consola === "gba" ? Boolean(partida.equipoCrudo) : partida.inicioEquipo >= 0;
  const sinSeguir = partida.lockeParado
    ? t("El locke de esta partida ya no está en marcha (o no es tuyo): la web no apunta nada.")
    : t("Sin locke, la web no apunta nada de la partida.");
  panel.innerHTML = `
    ${avisos && !enLaTira ? `
      <section class="jugar-caja jugar-caja-avisos">
        <h3>${icono("calavera")} ${t("Avisos")}</h3>
        <ul class="jugar-avisos">${avisos}</ul>
      </section>` : ""}
    <section class="jugar-caja" ${enLaTira ? "hidden" : ""}>
      <h3>${t("Tu equipo")} ${equipo.length ? `<small>${enDirecto ? t("en directo") : t("de la última vez que guardaste")}</small>` : ""}</h3>
      ${equipo.length ? `<ul class="jugar-equipo">${filas}</ul>` : `<p class="jugar-nota">${t("Aquí saldrá tu equipo en cuanto tengas tu primer Pokémon.")}</p>`}
      ${partida.idLocke ? "" : `<p class="jugar-nota">${sinSeguir}</p>`}
    </section>
    <details class="jugar-caja jugar-caja-teclas" ${teclasAbiertas ? "open" : ""} ${enLaTira ? "hidden" : ""}>
      <summary>${icono("mando")} ${t("Teclas y mando")}</summary>
      ${tactil.matches ? "" : `
        <dl class="jugar-teclas">
          ${listaTeclas(partida.consola).map(([tecla, boton]) => `<dt>${escaparHTML(tecla)}</dt><dd>${escaparHTML(boton)}</dd>`).join("")}
        </dl>`}
      <button class="jugar-cambiar-teclas">${icono("lapiz")} ${t("Cambiar teclas")}</button>
    </details>`;
}

let teclasAbiertas = false;

// En las pantallas anchas de DS, debajo de la pantalla y al lado de los botones: tu equipo en círculos (con su vida)
// y los avisos, para que todo quepa sin bajar
function pintarTira() {
  tira.hidden = !partida || !cuerpo.classList.contains("ancha");
  if (tira.hidden) {
    tira.innerHTML = "";
    return;
  }
  const equipo = seisHuecos(
    partida.equipoVisto || [],
    (p) => {
      const { parte, clase } = nivelDePs(p);
      return `
        <span class="jugar-tira-poke ${p.ps === 0 ? "debilitado" : ""}" title="${escaparHTML(`${nombreDe(p)} · ${t("Nv.")} ${p.nivel}${p.huevo ? "" : ` · ${p.ps}/${p.psMax}`}`)}">
          ${caraDePokemon(p, "jugar-cara")}
          ${p.huevo ? "" : `<span class="jugar-ps ${clase}"><span style="width:${parte}%"></span></span>`}
        </span>`;
    },
    `<span class="jugar-tira-poke"><span class="jugar-hueco"></span></span>`
  );
  const avisos = partida.avisos
    .map((aviso, i) => aviso.tipo !== "muerto" || aviso.hecho ? "" : `
      <span class="jugar-tira-aviso">
        ${icono("calavera")} <span>${escaparHTML(aviso.texto)}</span>
        <button class="jugar-apuntar" data-aviso="${i}">${t("Al cementerio")}</button>
        <button class="jugar-descartar" data-aviso="${i}" title="${t("No ha muerto")}" aria-label="${t("No ha muerto")}">${icono("aspa")}</button>
      </span>`)
    .join("");
  tira.innerHTML = `
    <span class="jugar-tira-equipo">${equipo}</span>
    <button class="jugar-tira-teclas">${icono("mando")} ${t("Teclas y mando")}</button>
    ${avisos}`;
}

// Las teclas en una ventana (en las pantallas anchas de DS no caben en el panel sin bajar)
function abrirListaTeclas() {
  if (!partida) return;
  const dialogo = document.createElement("dialog");
  dialogo.className = "ventana-web jugar-teclas-ventana";
  dialogo.innerHTML = `
    <h2>${icono("mando")} ${t("Teclas y mando")}</h2>
    <dl class="jugar-teclas">
      ${listaTeclas(partida.consola).map(([tecla, boton]) => `<dt>${escaparHTML(tecla)}</dt><dd>${escaparHTML(boton)}</dd>`).join("")}
    </dl>
    <div class="dialogo-botones">
      <button type="button" class="ventana-cancelar jugar-lista-cambiar">${icono("lapiz")} ${t("Cambiar teclas")}</button>
      <button type="button" class="ventana-aceptar jugar-lista-cerrar">${t("Cerrar")}</button>
    </div>`;
  document.body.appendChild(dialogo);
  dialogo.addEventListener("close", () => dialogo.remove());
  dialogo.addEventListener("click", (e) => {
    if (e.target.closest(".jugar-lista-cerrar")) dialogo.close();
    else if (e.target.closest(".jugar-lista-cambiar")) {
      dialogo.close();
      abrirTeclas();
    }
  });
  soltarTodo();
  dialogo.showModal();
}

// Debajo de la pantalla, mientras se juega, por grupos: pausa y velocidad; volumen; directo, pantalla completa y «⋯»
function pintarControles() {
  controles.hidden = !partida;
  mando.hidden = !partida || !tactil.matches;
  if (!partida) return;
  const ajustes = misAjustes();
  const boton = (clase, dibujo, texto, { activo = false, soloIcono = false } = {}) =>
    `<button class="${clase} ${activo ? "activo" : ""}" title="${texto}" aria-label="${texto}" aria-pressed="${activo}">${icono(dibujo)}${soloIcono ? "" : `<span>${texto}</span>`}</button>`;
  const velocidad = String(ajustes.velocidad).replace(".", enIngles ? "." : ",");
  // Si ya existe la barra de volumen, no se toca (se estaría arrastrando)
  const volumen = controles.querySelector(".jugar-volumen input");
  if (volumen && document.activeElement === volumen) return;
  controles.innerHTML = `
    <span class="jugar-grupo">
      ${partida.pausado ? boton("jugar-pausa", "reanudar", t("Seguir"), { activo: true, soloIcono: true }) : boton("jugar-pausa", "pausa", t("Pausa"), { soloIcono: true })}
      <button class="jugar-acelerar ${partida.acelerado ? "activo" : ""}" title="${t("Acelerar")}" aria-pressed="${partida.acelerado}">${icono("acelerar")}<span>×${velocidad}</span></button>
      <button class="jugar-velocidad" title="${t("Velocidad")}" aria-label="${t("Velocidad")}" aria-haspopup="true">${icono("abajo")}</button>
    </span>
    <span class="jugar-volumen" title="${t("Volumen")}">
      <button class="jugar-sonido" aria-label="${ajustes.silencio ? t("Activar el sonido") : t("Quitar el sonido")}">${icono(ajustes.silencio ? "silencio" : "sonido")}</button>
      <input type="range" min="0" max="1" step="0.05" value="${ajustes.silencio ? 0 : ajustes.volumen}" aria-label="${t("Volumen")}">
    </span>
    <span class="jugar-grupo">
      ${boton("jugar-directo-boton", "directo", emitiendo() ? t("En directo") : t("Emitir"), { activo: emitiendo() })}
      ${boton("jugar-ampliar", "ampliar", t("Pantalla completa"), { soloIcono: true })}
      <button class="jugar-opciones" title="${t("Más opciones")}" aria-label="${t("Más opciones")}" aria-haspopup="true">${icono("puntos")}</button>
    </span>`;
}

// Emitir tu partida para tus amigos (js/jugar/directo.js), o dejar de hacerlo
async function alternarDirecto() {
  if (emitiendo()) {
    await acabarDirecto();
    return;
  }
  if (!hayNube() || !usuarioActual()) {
    avisar(t("Para emitir en directo hace falta iniciar sesión: solo te pueden ver tus amigos."));
    return;
  }
  let medios = null;
  try {
    medios = partida.marco.contentWindow.capturarDirecto();
  } catch (error) {
    console.error(error);
  }
  if (!medios) {
    avisar(t("Espera a que arranque el juego para emitir."));
    return;
  }
  try {
    await empezarDirecto({ medios, juego: nombreDeJuego(partida.juego), alCambiar: alCambiarDirecto });
  } catch (error) {
    console.error(error);
    for (const pista of medios.getTracks()) pista.stop();
    avisar(t("No se ha podido empezar el directo."));
  }
  alCambiarDirecto();
}

function alCambiarDirecto() {
  pintarCajaDirecto(cajaDirecto);
  pintarControles();
}

// El mando táctil (solo en pantallas táctiles): se monta al empezar cada partida (en DS, con X e Y en rombo)
function montarMando(consola) {
  const b = (boton, texto, clase = "") => `<button class="mando-boton ${clase}" data-boton="${boton}" aria-label="${texto}">${texto}</button>`;
  mando.innerHTML = `
    <div class="mando-hombros">${b(BOTON.L, "L", "mando-hombro")}${b(BOTON.R, "R", "mando-hombro")}</div>
    <div class="mando-cruceta">
      ${b(BOTON.ARRIBA, "▲", "mando-arriba")}${b(BOTON.IZQUIERDA, "◀", "mando-izquierda")}
      ${b(BOTON.DERECHA, "▶", "mando-derecha")}${b(BOTON.ABAJO, "▼", "mando-abajo")}
    </div>
    <div class="mando-centro">${b(BOTON.SELECT, "Select", "mando-pequeno")}${b(BOTON.START, "Start", "mando-pequeno")}</div>
    ${consola === "nds"
      ? `<div class="mando-ab mando-rombo">${b(BOTON.X, "X", "mando-redondo mando-x")}${b(BOTON.Y, "Y", "mando-redondo mando-y")}${b(BOTON.A, "A", "mando-redondo mando-a")}${b(BOTON.B, "B", "mando-redondo mando-b")}</div>`
      : `<div class="mando-ab">${b(BOTON.B, "B", "mando-redondo mando-b")}${b(BOTON.A, "A", "mando-redondo mando-a")}</div>`}`;
  mando.classList.toggle("ds", consola === "nds");
}

// ---------- Jugar ----------

async function empezar(id) {
  if (partida || ocupado) return;
  ocupado = true;
  try {
    const [datos, rom] = await Promise.all([datosDe(id), romDe(id)]);
    if (!datos || !rom) {
      avisar(t("No se encuentra esa partida en este navegador."));
      return;
    }
    // El locke solo se sigue si es tuyo y está en marcha (si no, se juega igual, sin apuntar nada)
    const sigue = Boolean(datos.idLocke) && lockesJugables().some((locke) => locke.id === datos.idLocke);
    const idLocke = sigue ? datos.idLocke : "";
    await prepararGBA();
    // Lo que pasa la partida a «Lockes» lo pone esa sección al iniciarse
    if (idLocke) await prepararSeccion("versus");
    cambiarPartida(id, { jugada: Date.now() }).catch((error) => console.error(error));

    const consola = datos.consola || "gba";
    partida = {
      consola,
      juego: datos.juego || "frlg",
      idLocke,
      lockeParado: Boolean(datos.idLocke) && !sigue,
      clave: id,
      nombre: datos.nombre,
      randomizada: datos.randomizada,
      marco: document.createElement("iframe"),
      emulador: null,
      temporizadores: [],
      inicioEquipo: -1,
      ultimaBusqueda: 0,
      sav: null, // la última partida guardada que se ha leído (válida)
      ultimaSav: null, // lo último que había en el emulador (aunque sea una partida vacía)
      firmaEquipo: "",
      firmaVista: "",
      psAntes: new Map(),
      equipoVisto: [],
      avisos: [],
      entregando: Promise.resolve(),
      pausado: false,
      acelerado: false, // con el botón
      acelerandoConTecla: false,
      pulsados: new Set(),
      resumen: resumenGuardado.get(id) || null // para la portada de arriba
    };
    const { marco } = partida;
    marco.src = "emulador.html";
    marco.title = t("Emulador");
    marco.allow = "autoplay; fullscreen; gamepad";
    marco.allowFullscreen = true;
    marco.className = "jugar-marco";
    pantalla.replaceChildren(marco);
    consola_.classList.toggle("ds", consola === "nds");
    montarMando(consola);
    aplicarPantallasDS();
    aplicarFiltro();
    pintar();
    await new Promise((resolver) => marco.addEventListener("load", resolver, { once: true }));
    escucharTeclado(marco.contentWindow);
    const respaldo = await savDe(id);
    if (!partida || partida.marco !== marco) return; // parado mientras cargaba
    if (partidaValida(consola, respaldo)) partida.sav = respaldo;
    marco.contentWindow.arrancar({
      // El emulador guarda la partida con el nombre de la ROM: uno distinto para cada partida
      nucleo: consola === "nds" ? "melonds" : "gba",
      bytes: rom.bytes,
      archivo: `nuzthelocke-${id}.${consola}`,
      firmware: consola === "nds" ? firmwareDS({ idioma: enIngles ? 1 : 5, nombre: enIngles ? "Player" : "Jugador" }) : null,
      nombre: `nuzthelocke-${id}`,
      ingles: enIngles,
      // Las pantallas de la DS, ya desde que arranca
      opciones: consola === "nds" ? { melonds_screen_layout: DISPOSICION_DS[misAjustes().pantallasDS] } : {},
      alEmpezar: (emulador) => alEmpezar(emulador, respaldo, datos.forzarSav).catch((error) => console.error(error))
    });
  } catch (error) {
    console.error(error);
    avisar(t("No se ha podido arrancar el emulador."));
    parar(false);
  } finally {
    ocupado = false;
  }
}

// forzar: la de la web pisa la del emulador (se cargó un .sav sin estar jugando)
async function alEmpezar(emulador, respaldo, forzar) {
  if (!partida) return;
  partida.emulador = emulador;
  const juego = emulador.gameManager;

  // Sin la partida del emulador (el navegador la ha borrado, u otro navegador): la copia de la web
  const ruta = juego.getSaveFilePath();
  if (respaldo && ruta && (forzar || !juego.FS.analyzePath(ruta).exists)) {
    escribirPartidaEnEmulador(juego, respaldo);
  }
  if (forzar) cambiarPartida(partida.clave, { forzarSav: false }).catch((error) => console.error(error));

  // Tus ajustes (./ajustes.js)
  ajustarPantalla();
  aplicarVolumen();
  aplicarVelocidad();
  aplicarMando();
  aplicarPantallasDS();
  aplicarFiltro();

  partida.temporizadores.push(
    setInterval(() => mirarPartida(), CADA_PARTIDA)
  );
  // El equipo en directo, de la memoria del juego
  partida.temporizadores.push(setInterval(() => mirarMemoria(), CADA_MEMORIA));
}

function escribirPartidaEnEmulador(juego, bytes) {
  const ruta = juego.getSaveFilePath();
  let carpeta = "";
  for (const trozo of ruta.split("/").slice(0, -1)) {
    if (!trozo) continue;
    carpeta += `/${trozo}`;
    if (!juego.FS.analyzePath(carpeta).exists) juego.FS.mkdir(carpeta);
  }
  if (juego.FS.analyzePath(ruta).exists) juego.FS.unlink(ruta);
  juego.FS.writeFile(ruta, bytes);
  juego.loadSaveFiles();
  juego.restart(); // el juego solo lee la partida al encenderse
}

// Lo que el juego tiene guardado ahora (la .sav), o null
function partidaDelEmulador() {
  const juego = partida && partida.emulador && partida.emulador.gameManager;
  if (!juego) return null;
  juego.saveSaveFiles();
  return juego.getSaveFile(false);
}

function iguales(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// La partida guardada: si ha cambiado (has guardado en el juego), copia y a «Lockes»
async function mirarPartida() {
  let sav;
  try {
    sav = partidaDelEmulador();
  } catch (error) {
    return; // el emulador a medio arrancar
  }
  if (!sav || !sav.length || iguales(sav, partida.ultimaSav)) return;
  partida.ultimaSav = sav.slice();
  // Antes de guardar por primera vez la partida está vacía: nada que leer
  if (!partidaValida(partida.consola, sav)) return;
  partida.sav = sav.slice();
  guardarSav(partida.clave, partida.sav);
  if (partida.consola === "nds") equipoDeLaPartida(partida.sav);
  entregar();
}

// En DS, mientras no se encuentre en la memoria, el equipo sale de la partida guardada (al guardar en el juego)
function equipoDeLaPartida(sav) {
  recordarGuardado(sav);
  if (partida.inicioEquipo >= 0) return; // ya se ve en directo
  let equipo;
  try {
    equipo = leerPartidaDS(sav).equipo;
  } catch (error) {
    return; // a mitad de guardar: a la próxima
  }
  vigilarDebilitados(equipo);
  pintarEquipo(equipo);
}

// A «Lockes», de una en una (cada lectura parte de lo que dejó la anterior)
function entregar() {
  if (!partida || !partida.idLocke) return;
  const { idLocke, sav } = partida;
  const equipo = partida.equipoCrudo;
  // Sin partida guardada todavía, lo demás (vacío) de base
  const base = { juego: partida.juego, version: "", gen: GEN_DE[partida.juego], entrenador: "", medallas: null, abiertas: partida.consola === "gba" ? CAJAS_GBA : 0, cajas: [] };
  const enVivo = equipo ? { equipo, base } : null;
  if (!sav && !enVivo) return;
  partida.entregando = partida.entregando
    .then(() => entregarPartida(idLocke, sav, t("Emulador de la web"), enVivo))
    .catch((error) => console.error(error));
}

// El equipo, de la memoria del juego
function mirarMemoria() {
  const juego = partida && partida.emulador && partida.emulador.gameManager;
  if (!juego) return;
  if (partida.consola === "nds") {
    mirarMemoriaDS(juego);
    return;
  }
  let estado;
  try {
    estado = juego.getState();
  } catch (error) {
    return;
  }
  const inicio = inicioDelEstado(estado);
  if (inicio < 0) {
    if (!partida.avisadoEstado) console.warn("Jugar: el estado del emulador no es el de mGBA que se esperaba", estado.subarray(0, 32));
    partida.avisadoEstado = true;
    return;
  }
  const memoria = estado.subarray(inicio + MEMORIA[0], inicio + MEMORIA[1]);

  let equipo = equipoEnMemoria(memoria, partida.inicioEquipo);
  if (!equipo && Date.now() - partida.ultimaBusqueda > CADA_BUSQUEDA) {
    partida.ultimaBusqueda = Date.now();
    partida.inicioEquipo = buscarEquipo(memoria);
    equipo = equipoEnMemoria(memoria, partida.inicioEquipo);
  }
  if (!equipo) return;
  alVerEquipo(equipo);
}

// En DS no se saca el estado del emulador como en GBA: a melonDS, sacarlo con el juego en marcha le rompe la conexión
// inalámbrica y el juego salta con «Ha habido un error de comunicación». Se lee su memoria (la de WebAssembly, donde
// está la de la consola) tal cual, sin tocar nada.
//
// Ahí está tu equipo más de una vez (el del juego, la copia de la partida guardada, las de los combates): valen los
// que tienen a los tuyos (los de tu última partida guardada o los que ya se veían) y, entre ellos, el que ya no es
// como lo guardaste (el del juego; si todos son iguales, da igual cuál). Si dejan de valer, se vuelve a buscar.
function mirarMemoriaDS(juego) {
  const memoria = juego.Module && juego.Module.HEAPU8;
  if (!memoria) return;
  const gen = GEN_DE[partida.juego];
  if (partida.sav && !partida.llavesGuardadas) recordarGuardado(partida.sav);
  const validos = (partida.sitiosEquipo || [])
    .map((sitio) => ({ sitio, equipo: equipoEnEstadoDS(memoria, sitio, gen) }))
    .filter(({ equipo }) => equipo && esTuEquipo(equipo));
  if (validos.length) {
    const elegido = validos.find(({ equipo }) => firmaGuardada(equipo) !== partida.firmaGuardada) || validos[0];
    partida.inicioEquipo = elegido.sitio;
    alVerEquipo(elegido.equipo);
    return;
  }
  partida.inicioEquipo = -1;
  if (!partida.buscando && Date.now() - partida.ultimaBusqueda >= CADA_BUSQUEDA) {
    buscarEnMemoriaDS(juego, gen).catch((error) => console.error(error));
  }
}

const TROZO_BUSQUEDA = 8 << 20; // la memoria se recorre a trozos, para no parar el juego

async function buscarEnMemoriaDS(juego, gen) {
  const yo = partida;
  yo.buscando = true;
  try {
    const sitios = [];
    for (let desde = 0; ; desde += TROZO_BUSQUEDA) {
      const memoria = juego.Module.HEAPU8; // puede crecer entre un trozo y otro
      if (partida !== yo || desde >= memoria.length) break;
      sitios.push(...buscarEquiposDS(memoria, gen, desde, desde + TROZO_BUSQUEDA));
      await new Promise((resolver) => setTimeout(resolver, 0));
    }
    if (partida !== yo) return;
    const memoria = juego.Module.HEAPU8;
    const conocidos = yo.llavesGuardadas;
    const parecido = (sitio) => (equipoEnEstadoDS(memoria, sitio, gen) || []).filter((p) => conocidos && conocidos.has(p.llave)).length;
    const tuyos = sitios.filter((sitio) => {
      const equipo = equipoEnEstadoDS(memoria, sitio, gen);
      return equipo && esTuEquipo(equipo);
    });
    // Los que más se parecen a tu partida guardada (en combate, el rival también tiene su lista)
    const mejor = Math.max(0, ...tuyos.map(parecido));
    yo.sitiosEquipo = tuyos.filter((sitio) => parecido(sitio) === mejor);
    if (!yo.sitiosEquipo.length && !yo.avisadoEstado) {
      console.warn("Jugar: no se encuentra el equipo en la memoria del emulador de DS", memoria.length, sitios.length);
      yo.avisadoEstado = true;
    }
  } finally {
    yo.buscando = false;
    yo.ultimaBusqueda = Date.now();
  }
}

// Si tiene a alguno de los tuyos (sin partida guardada ni equipo visto todavía, cualquiera vale)
function esTuEquipo(equipo) {
  const conocidos = partida.llavesGuardadas;
  const vistos = partida.equipoCrudo;
  if ((!conocidos || !conocidos.size) && !vistos) return true;
  return equipo.some((p) => (conocidos && conocidos.has(p.llave)) || (vistos && vistos.some((q) => q.llave === p.llave)));
}

// Para saber si un equipo de la memoria es tal cual el de la partida guardada
const firmaGuardada = (equipo) => equipo.map((p) => `${p.llave}|${p.especie}|${p.nivel}|${p.ps}|${p.psMax}`).join(",");

function recordarGuardado(sav) {
  try {
    const { equipo } = leerPartidaDS(sav);
    partida.llavesGuardadas = new Set(equipo.map((p) => p.llave));
    partida.firmaGuardada = firmaGuardada(equipo);
  } catch (error) {
    // a mitad de guardar: a la próxima
  }
}

// Lo que se hace con el equipo de la memoria (GBA o DS): debilitados, «Lockes» y lo que se ve
function alVerEquipo(equipo) {
  vigilarDebilitados(equipo);

  // Capturas, niveles, evoluciones, motes: a «Lockes»
  const firma = equipo.map((p) => `${p.llave}|${p.especie}|${p.nivel}|${p.mote}|${p.huevo}`).join(",");
  if (firma !== partida.firmaEquipo) {
    partida.firmaEquipo = firma;
    partida.equipoCrudo = equipo;
    entregar();
  }
  // Lo que se ve (también los PS)
  const firmaVista = `${firma}|${equipo.map((p) => p.ps).join(",")}`;
  if (firmaVista !== partida.firmaVista) {
    partida.firmaVista = firmaVista;
    pintarEquipo(equipo);
  }
}

async function pintarEquipo(equipo) {
  const { equipo: convertido } = await convertirPartida({ juego: partida.juego, gen: GEN_DE[partida.juego], equipo, cajas: [] });
  if (!partida) return;
  partida.equipoVisto = convertido.map((p, i) => ({ ...p, ps: equipo[i].ps, psMax: equipo[i].psMax }));
  pintarPanel();
}

// Un Pokémon que se queda a 0 PS: se propone para el cementerio (una vez, y no si ya se apuntó
// o descartó desde la caja de los muertos)
function vigilarDebilitados(equipo) {
  const vistos = new Set((partida.idLocke && (partidaDe(partida.idLocke) || {}).muertosVistos) || []);
  for (const p of equipo) {
    if (p.huevo) continue;
    const antes = partida.psAntes.get(p.llave);
    partida.psAntes.set(p.llave, p.ps);
    if (!partida.idLocke || !antes || p.ps !== 0 || vistos.has(p.llave)) continue;
    if (partida.avisos.some((aviso) => aviso.llave === p.llave)) continue;
    avisarDebilitado(p);
  }
}

async function avisarDebilitado(crudo) {
  const [p] = (await convertirPartida({ juego: partida.juego, gen: GEN_DE[partida.juego], equipo: [crudo], cajas: [] })).equipo;
  if (!partida) return;
  const nombre = p.mote ? `${p.mote} (${enIngles ? p.en || p.nombre : p.nombre})` : enIngles ? p.en || p.nombre : p.nombre;
  partida.avisos.unshift({
    tipo: "muerto",
    llave: p.llave,
    pokemon: p,
    cara: caraDePokemon(p, "jugar-cara"),
    texto: t("{nombre} se ha debilitado.", { nombre })
  });
  pintarPanel();
}

async function apuntarDebilitado(i) {
  const aviso = partida && partida.avisos[i];
  if (!aviso || aviso.hecho) return;
  const locke = lockePorId(partida.idLocke);
  const usuario = usuarioActual();
  if (!locke || !usuario || estaEliminado(locke, usuario.uid)) return;
  aviso.hecho = true;
  const p = aviso.pokemon;
  marcarMuertosVistos(partida.idLocke, [p.llave]);
  try {
    await apuntarMuerto(
      partida.idLocke,
      { especie: p.id, nombre: p.nombre, en: p.nombreEn || p.en || "", mote: p.mote, idForma: p.idForma, formaPMD: p.formaPMD, imagenForma: p.imagenForma },
      !locke.vidasIlimitadas
    );
    aviso.texto = t("{nombre}, en el cementerio.", { nombre: p.mote || p.nombre });
  } catch (error) {
    console.error(error);
    aviso.hecho = false;
    avisar(t("No se ha podido apuntar en el cementerio."));
  }
  pintarPanel();
}

function descartarDebilitado(i) {
  const aviso = partida && partida.avisos[i];
  if (!aviso) return;
  marcarMuertosVistos(partida.idLocke, [aviso.llave]);
  partida.avisos.splice(i, 1);
  pintarPanel();
}

// ---------- Controles ----------

function pulsar(boton, abajo) {
  const juego = partida && partida.emulador && partida.emulador.gameManager;
  if (!juego) return;
  if (abajo) partida.pulsados.add(boton);
  else partida.pulsados.delete(boton);
  juego.simulateInput(0, boton, abajo ? 1 : 0);
}

// Al cambiar de ventana o de pestaña, nada se queda pulsado
function soltarTodo() {
  if (!partida) return;
  for (const boton of [...partida.pulsados]) pulsar(boton, false);
  if (partida.acelerandoConTecla) acelerarConTecla(false);
}

// El emulador solo mira la velocidad al ponerse rápido: con un cambio de velocidad estando ya rápido, se quita y se
// vuelve a poner para que valga la nueva al momento
function aplicarVelocidad(cambiaLaVelocidad = false) {
  const juego = partida.emulador && partida.emulador.gameManager;
  if (!juego) return;
  const rapido = partida.acelerado || partida.acelerandoConTecla;
  juego.setFastForwardRatio(misAjustes().velocidad);
  if (cambiaLaVelocidad && rapido) juego.toggleFastForward(0);
  juego.toggleFastForward(rapido ? 1 : 0);
}

function acelerarConTecla(si) {
  partida.acelerandoConTecla = si;
  aplicarVelocidad();
}

function alTeclear(e) {
  if (!partida || !partida.emulador || vista.hidden) return;
  // Escribiendo en una casilla de la web, o con una ventana abierta, las teclas son suyas
  if (e.target && e.target.closest && e.target.closest("input:not([type=range]), textarea, select, [contenteditable]")) return;
  if (document.querySelector("dialog[open]")) return;
  const abajo = e.type === "keydown";
  const accion = teclasDe(partida.consola)[e.code];
  if (accion === undefined) return;
  e.preventDefault(); // que las flechas no muevan la página, ni Retroceso vuelva atrás
  if (e.repeat) return;
  if (accion === ACELERAR) acelerarConTecla(abajo);
  else pulsar(accion, abajo);
}

function escucharTeclado(ventana) {
  ventana.addEventListener("keydown", alTeclear);
  ventana.addEventListener("keyup", alTeclear);
  ventana.addEventListener("blur", soltarTodo);
}

// ---------- Volumen, filtro, pantallas de DS y botones del mando (./ajustes.js) ----------

function aplicarVolumen() {
  const emulador = partida && partida.emulador;
  const { silencio, volumen } = misAjustes();
  if (emulador) emulador.setVolume(silencio ? 0 : volumen);
}

// Al cambiar cómo se ven las pantallas de la DS, el emulador vuelve a montar la imagen y el sonido, y el sonido vuelve
// a su volumen de siempre (aunque lo tuvieras quitado): se vuelve a poner el tuyo cuando acaba
function volverAPonerElVolumen() {
  for (const espera of [100, 400, 1000, 2000]) setTimeout(aplicarVolumen, espera);
}

// Nítido (como sale), suave (el filtro «bicubic» de EmulatorJS) o LCD (una rejilla encima, un cuadro por píxel)
function aplicarFiltro() {
  if (!partida) return;
  const { filtro, pantallasDS } = misAjustes();
  try {
    partida.marco.contentWindow.ponerFiltro(filtro === "suave" ? "bicubic" : "disabled");
    if (partida.emulador) volverAPonerElVolumen();
  } catch (error) {
    // el juego aún no ha arrancado: se pone al empezar
  }
  const [columnas, filas] = PIXELES[partida.consola === "nds" ? pantallasDS : "gba"];
  pantalla.style.setProperty("--columnas", columnas);
  pantalla.style.setProperty("--filas", filas);
  pantalla.classList.toggle("lcd", filtro === "lcd");
}

// Cómo van las dos pantallas de la DS: en el emulador y en lo que ocupa la pantalla de la web
function aplicarPantallasDS() {
  if (!partida || partida.consola !== "nds") return;
  const { pantallasDS } = misAjustes();
  for (const forma of Object.keys(DISPOSICION_DS)) consola_.classList.toggle(`ds-${forma}`, forma === pantallasDS);
  // Las anchas (una al lado de otra, la de arriba grande): el panel pasa debajo y la pantalla ocupa todo el ancho
  cuerpo.classList.toggle("ancha", pantallasDS !== "vertical");
  pintarPanel();
  const juego = partida.emulador && partida.emulador.gameManager;
  if (juego) {
    juego.setVariable("melonds_screen_layout", DISPOSICION_DS[pantallasDS]);
    volverAPonerElVolumen();
  }
  aplicarFiltro();
  ajustarPantalla();
}

// La pantalla, todo lo grande que quepa sin que los botones de debajo se salgan de la ventana: el alto que queda desde
// donde empieza hasta abajo, menos los botones (y el mando táctil) y un margen. El CSS saca el ancho de este alto.
function ajustarPantalla() {
  if (!partida || consola_.hidden || document.fullscreenElement) return;
  const arriba = pantalla.getBoundingClientRect().top + scrollY;
  const separacion = parseFloat(getComputedStyle(consola_).rowGap) || 12;
  let debajo = 20;
  const fila = Math.max(controles.hidden ? 0 : controles.offsetHeight, tira.hidden ? 0 : tira.offsetHeight);
  if (fila) debajo += fila + separacion;
  if (!mando.hidden) debajo += mando.offsetHeight + separacion;
  pantalla.style.setProperty("--alto", `${Math.max(240, innerHeight - arriba - debajo)}px`);
}

// Los botones del mando que has cambiado (los demás, los de EmulatorJS): por su número, que EmulatorJS también entiende
function aplicarMando() {
  const controlesEJS = partida && partida.emulador && partida.emulador.controls;
  if (!controlesEJS || !controlesEJS[0]) return;
  for (const [accion, numero] of Object.entries(mandoDe(partida.consola))) {
    if (!controlesEJS[0][accion]) controlesEJS[0][accion] = {};
    controlesEJS[0][accion].value2 = numero;
  }
}

const textoVelocidad = (v) => `×${String(v).replace(".", enIngles ? "." : ",")}`;

function abrirVelocidades(boton) {
  const { velocidad } = misAjustes();
  abrirMenu(
    boton,
    [{ titulo: t("Velocidad al acelerar") }, ...VELOCIDADES.map((v) => ({
      valor: String(v), texto: textoVelocidad(v), icono: "acelerar", marcado: v === velocidad
    }))],
    (valor) => {
      cambiarAjustes({ velocidad: Number(valor) });
      aplicarVelocidad(true);
      pintarControles();
    }
  );
}

function abrirOpciones(boton) {
  const { filtro, pantallasDS } = misAjustes();
  const opciones = [
    { titulo: t("Filtro de pantalla") },
    { valor: "filtro:nitido", texto: t("Nítido"), icono: "cuadricula", marcado: filtro === "nitido" },
    { valor: "filtro:suave", texto: t("Suave"), icono: "imagen", marcado: filtro === "suave" },
    { valor: "filtro:lcd", texto: t("Pantalla de la consola (LCD)"), icono: "consola", marcado: filtro === "lcd" }
  ];
  if (partida.consola === "nds") {
    opciones.push(
      { titulo: t("Pantallas de la DS") },
      { valor: "ds:vertical", texto: t("Una encima de otra"), icono: "lista", marcado: pantallasDS === "vertical" },
      { valor: "ds:horizontal", texto: t("Una al lado de otra"), icono: "cuadricula", marcado: pantallasDS === "horizontal" },
      { valor: "ds:grande", texto: t("La de arriba grande"), icono: "ampliar", marcado: pantallasDS === "grande" }
    );
  }
  opciones.push({ titulo: t("Controles") }, { valor: "teclas", texto: t("Cambiar teclas"), icono: "mando" });
  abrirMenu(boton, opciones, (valor) => {
    const [que, cual] = valor.split(":");
    if (que === "filtro") {
      cambiarAjustes({ filtro: cual });
      aplicarFiltro();
    } else if (que === "ds") {
      cambiarAjustes({ pantallasDS: cual });
      aplicarPantallasDS();
    } else if (que === "teclas") {
      abrirTeclas();
    }
  });
}

function abrirTeclas() {
  if (!partida) return;
  soltarTodo();
  abrirCambiarTeclas(partida.consola, () => {
    aplicarMando();
    pintarPanel();
  });
}

// La partida guardada (.sav): descargarla o cargar otra
function abrirMenuSav(boton) {
  abrirMenu(
    boton,
    [
      { titulo: t("Partida guardada (.sav)") },
      { valor: "bajar", texto: t("Descargar partida"), icono: "guardar" },
      { valor: "subir", texto: t("Cargar partida"), icono: "subir" }
    ],
    (valor) => (valor === "bajar" ? descargarPartida() : cargarPartida())
  );
}

// Lo de cada partida de la lista que se usa poco
function abrirMenuPartida(boton) {
  const id = boton.dataset.id;
  abrirMenu(
    boton,
    [
      { valor: "jugar-renombrar", texto: t("Renombrar"), icono: "lapiz" },
      { valor: "jugar-bajar-rom", texto: t("Descargar la ROM"), icono: "disco" },
      { valor: "jugar-bajar-sav", texto: t("Descargar la partida (.sav)"), icono: "guardar" },
      { valor: "jugar-subir-sav", texto: t("Cargar una partida (.sav)"), icono: "subir" },
      { valor: "jugar-borrar", texto: t("Borrar"), icono: "papelera", peligro: true }
    ],
    (valor) => accionPartida(valor, id)
  );
}

function alPulsarControl(boton) {
  const emulador = partida && partida.emulador;
  if (!emulador) return;
  if (boton.matches(".jugar-velocidad")) return abrirVelocidades(boton);
  if (boton.matches(".jugar-opciones")) return abrirOpciones(boton);
  if (boton.matches(".jugar-pausa")) {
    partida.pausado = !partida.pausado;
    if (partida.pausado) emulador.pause();
    else emulador.play();
  } else if (boton.matches(".jugar-acelerar")) {
    partida.acelerado = !partida.acelerado;
    aplicarVelocidad();
  } else if (boton.matches(".jugar-sonido")) {
    cambiarAjustes({ silencio: !misAjustes().silencio });
    aplicarVolumen();
  } else if (boton.matches(".jugar-ampliar")) {
    if (document.fullscreenElement) document.exitFullscreen();
    else consola_.requestFullscreen().catch((error) => console.error(error));
    return;
  } else if (boton.matches(".jugar-directo-boton")) {
    boton.blur();
    alternarDirecto().catch((error) => console.error(error));
    return;
  }
  // El foco, fuera del botón: que Espacio o Intro no lo vuelvan a pulsar
  boton.blur();
  pintarControles();
}

// guardarAntes: una última copia de la partida antes de apagar
function parar(guardarAntes = true) {
  if (!partida) return;
  if (guardarAntes) mirarPartida();
  if (emitiendo()) acabarDirecto().catch((error) => console.error(error));
  if (document.fullscreenElement) document.exitFullscreen();
  cerrarMenu();
  for (const temporizador of partida.temporizadores) clearInterval(temporizador);
  partida.marco.remove();
  olvidarResumen(partida.clave);
  resumenGuardado.delete(partida.clave);
  pantalla.classList.remove("lcd");
  for (const forma of Object.keys(DISPOSICION_DS)) consola_.classList.remove(`ds-${forma}`);
  cuerpo.classList.remove("ancha");
  partida = null;
  recargar();
}

function descargar(bytes, nombre) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([bytes]));
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

// Mientras se juega: la que tiene el emulador ahora mismo
function descargarPartida() {
  let sav = null;
  try {
    sav = partidaDelEmulador();
  } catch (error) {
    console.error(error);
  }
  if (!partidaValida(partida.consola, sav)) {
    avisar(t("Todavía no hay partida guardada: guarda en el juego primero."));
    return;
  }
  descargar(sav, `${partida.nombre}.sav`);
}

// consola: la de la partida (la .sav tiene que ser de esa)
function elegirSav(consola, alElegir) {
  const campo = document.createElement("input");
  campo.type = "file";
  campo.accept = ".sav,.srm";
  campo.addEventListener("change", async () => {
    const archivo = campo.files[0];
    if (!archivo) return;
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    if (!partidaValida(consola, bytes)) {
      avisar(t("Ese archivo no es una partida guardada de este juego."));
      return;
    }
    alElegir(bytes);
  });
  campo.click();
}

function cargarPartida() {
  elegirSav(partida.consola, async (bytes) => {
    if (!partida || !partida.emulador) return;
    if (!(await confirmar(t("La partida que hay ahora se cambiará por la del archivo y el juego volverá a empezar. ¿Seguro?")))) return;
    escribirPartidaEnEmulador(partida.emulador.gameManager, bytes);
  });
}

// Lo que se elige de cada partida de la lista (jugar o su «⋯»): accion, la clase de ese botón u opción
async function accionPartida(accion, id) {
  const p = partidas.find((x) => x.id === id);
  if (!p) return;
  if (accion === "jugar-jugar") empezar(id);
  else if (accion === "jugar-renombrar") {
    const nombre = await preguntar(t("Nombre de la partida"), p.nombre);
    if (!nombre || !nombre.trim()) return;
    await cambiarPartida(id, { nombre: nombre.trim().slice(0, 40) });
    recargar();
  } else if (accion === "jugar-bajar-rom") {
    const rom = await romDe(id);
    if (rom) descargar(rom.bytes, rom.nombre || `${p.nombre}.${p.consola || "gba"}`);
  } else if (accion === "jugar-bajar-sav") {
    const sav = await savDe(id);
    if (!partidaValida(p.consola || "gba", sav)) avisar(t("Todavía no hay partida guardada: guarda en el juego primero."));
    else descargar(sav, `${p.nombre}.sav`);
  } else if (accion === "jugar-subir-sav") {
    elegirSav(p.consola || "gba", async (bytes) => {
      if (!(await confirmar(t("La partida guardada de «{nombre}» se cambiará por la del archivo. ¿Seguro?", { nombre: p.nombre })))) return;
      await guardarSav(id, bytes);
      await cambiarPartida(id, { forzarSav: true }); // al jugar, pisa la del emulador
      olvidarResumen(id);
      resumenGuardado.delete(id);
      recargar();
    });
  } else if (accion === "jugar-borrar") {
    const texto = t("¿Borrar la partida «{nombre}»? Se borran de este navegador su ROM y su partida guardada (descárgalas antes si las quieres).", { nombre: p.nombre });
    if (!(await confirmar(texto))) return;
    await borrarPartida(id);
    recargar();
  }
}

// ---------- Arranque ----------

export function iniciar() {
  barra.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.matches(".jugar-nueva-boton")) nuevaPartida();
    else if (boton.matches(".jugar-parar")) parar();
    else if (boton.matches(".jugar-sav-boton")) abrirMenuSav(boton);
  });
  lista.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.matches(".jugar-nueva-boton")) nuevaPartida();
    else if (boton.matches(".jugar-mas")) abrirMenuPartida(boton);
    else if (boton.matches(".jugar-jugar")) accionPartida("jugar-jugar", boton.dataset.id);
  });
  controles.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (boton) alPulsarControl(boton);
  });
  // El volumen: al arrastrar suena ya; al soltar se guarda y el foco vuelve al juego
  controles.addEventListener("input", (e) => {
    if (!e.target.matches(".jugar-volumen input")) return;
    const volumen = Number(e.target.value);
    Object.assign(misAjustes(), { volumen, silencio: volumen === 0 });
    aplicarVolumen();
  });
  controles.addEventListener("change", (e) => {
    if (!e.target.matches(".jugar-volumen input")) return;
    const { volumen } = misAjustes();
    cambiarAjustes({ volumen: volumen || 0.5, silencio: volumen === 0 });
    e.target.blur();
    pintarControles();
  });
  mando.addEventListener("pointerdown", (e) => {
    const boton = e.target.closest("[data-boton]");
    if (!boton) return;
    e.preventDefault();
    boton.setPointerCapture(e.pointerId);
    boton.classList.add("pulsado");
    pulsar(Number(boton.dataset.boton), true);
  });
  for (const tipo of ["pointerup", "pointercancel", "lostpointercapture"]) {
    mando.addEventListener(tipo, (e) => {
      const boton = e.target.closest("[data-boton]");
      if (!boton || !boton.classList.contains("pulsado")) return;
      boton.classList.remove("pulsado");
      pulsar(Number(boton.dataset.boton), false);
    });
  }
  mando.addEventListener("contextmenu", (e) => e.preventDefault());
  escucharTeclado(window);
  document.addEventListener("visibilitychange", soltarTodo);
  // La pantalla, a la medida de la ventana
  addEventListener("resize", ajustarPantalla);
  document.addEventListener("fullscreenchange", () => requestAnimationFrame(ajustarPantalla));
  tactil.addEventListener("change", () => pintar());
  panel.addEventListener("toggle", (e) => {
    if (e.target.matches(".jugar-caja-teclas")) teclasAbiertas = e.target.open;
  }, true);
  tira.addEventListener("click", (e) => {
    if (e.target.closest(".jugar-tira-teclas")) {
      abrirListaTeclas();
      return;
    }
    const boton = e.target.closest("button[data-aviso]");
    if (!boton) return;
    if (boton.matches(".jugar-apuntar")) apuntarDebilitado(Number(boton.dataset.aviso));
    else if (boton.matches(".jugar-descartar")) descartarDebilitado(Number(boton.dataset.aviso));
  });
  panel.addEventListener("click", (e) => {
    if (e.target.closest(".jugar-cambiar-teclas")) {
      abrirTeclas();
      return;
    }
    const boton = e.target.closest("button[data-aviso]");
    if (!boton) return;
    if (boton.matches(".jugar-apuntar")) apuntarDebilitado(Number(boton.dataset.aviso));
    else if (boton.matches(".jugar-descartar")) descartarDebilitado(Number(boton.dataset.aviso));
  });
  // Al cerrar la pestaña, la última copia de la partida
  window.addEventListener("pagehide", () => partida && mirarPartida());
  alCambiarLockes(() => {
    if (!partida) pintarLista();
  });
}

export async function mostrar() {
  // Lo que piden al venir (se usa una vez)
  const pedido = leer(CLAVE_ELEGIDO, {}) || {};
  if (pedido.locke || pedido.partida) escribir(CLAVE_ELEGIDO, {});
  await recargar();
  if (partida) return;
  if (pedido.partida && partidas.some((p) => p.id === pedido.partida)) {
    destacada = pedido.partida;
    empezar(pedido.partida);
  } else if (pedido.locke) {
    // El botón «Jugar» de un locke: su partida (la última jugada) o, si no tiene, una nueva para él
    const suya = partidas.find((p) => p.idLocke === pedido.locke);
    if (!suya) {
      nuevaPartida(pedido.locke);
      return;
    }
    // Sale la primera, en grande
    destacada = suya.id;
    pintarLista();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
