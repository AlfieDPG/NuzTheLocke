// Lo que comparten los juegos de «Juegos»: las especies con lo que hace falta para las pistas,
// el Pokémon del día, lo que llevas jugado hoy y el final de cada reto (sus Pokédólares).
//
// Lo jugado hoy se guarda en el navegador (no se sube: la jugada de verdad está en Firestore
// al terminar, ver js/comun/fichas.js):
//
//   localStorage «poketeams-juegos-v1»:
//     { dia, cuenta, silueta: { intentos: [numero], fin, acierto, fichas, bono, resumen }, pistas: {...},
//       eficaz: {...}, masomenos: {...} }
//   (de otro día o de otra cuenta, no vale y se empieza de cero). «resumen» es la línea del
//   resultado para compartir (con cuadraditos de colores), que se arma al terminar.

import { leer, escribir } from "../comun/almacen.js";
import { sumarContador } from "../comun/contadores.js";
import { usuarioActual } from "../comun/nube.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { hoy, azarDelDia, guardarJugada, jugadaDeHoy } from "../comun/fichas.js";
import { t } from "../comun/idioma.js";

const CLAVE = "poketeams-juegos-v1";
const URL_FAMILIAS = new URL("../../datos/familias.json", import.meta.url);
const ULTIMA_ESPECIE = 1025;

export const CLASES = {
  "": t("Normal"),
  bebe: t("Bebé"),
  legendario: t("Legendario"),
  singular: t("Singular")
};

// ---------- Especies ----------
//
// Una por especie (su forma normal), con el nombre en los dos idiomas (para buscar) y:
// { id, es, en, buscar, tipos, gen, total, bases, clase, etapa }. bases: [PS, At, Def, AtEsp,
// DefEsp, Vel]. etapa: 1 la que no viene de
// ninguna, 2 su evolución, 3 la siguiente (datos/familias.json: { especie: de la que viene }).

let especies = null;
let deQuienViene = {}; // datos/familias.json, cuando ha llegado

// { especie: especie de la que viene } (para «¿En qué evoluciona?»). Vacío hasta cargarEspecies().
export function familias() {
  return deQuienViene;
}

export function cargarEspecies() {
  especies ??= (async () => {
    const [tabla, familias] = await Promise.all([
      cargarPokedex(),
      fetch(URL_FAMILIAS).then((respuesta) => respuesta.json()).then((datos) => (deQuienViene = datos)),
      cargarDatos()
    ]);
    const nombres = new Map(datos.pokemon.map((especie) => [especie.id, especie]));
    const etapa = (numero) => {
      let cuantas = 1;
      for (let actual = numero; familias[actual] && cuantas < 4; actual = familias[actual]) cuantas++;
      return cuantas;
    };
    return tabla
      .filter((fila) => fila.forma === 0 && fila.numero <= ULTIMA_ESPECIE && nombres.has(fila.numero))
      .sort((una, otra) => una.numero - otra.numero)
      .map((fila) => ({
        ...nombres.get(fila.numero),
        tipos: fila.tipos,
        gen: fila.gen,
        total: fila.total,
        bases: fila.bases,
        retrato: fila.retrato, // su casilla en la hoja de retratos (js/pokedex/datos.js)
        clase: fila.clase || "",
        etapa: etapa(fila.numero)
      }));
  })();
  especies.catch(() => (especies = null)); // si falla, se reintenta
  return especies;
}

// El de hoy de ese juego: el mismo para todo el mundo
export function delDia(lista, juego) {
  const azar = azarDelDia(`${hoy()}|${juego}`);
  return lista[Math.floor(azar() * lista.length)];
}

// ---------- Lo jugado hoy ----------

function guardado() {
  const todo = leer(CLAVE, {}) || {};
  const cuenta = (usuarioActual() || {}).uid || "";
  return todo.dia === hoy() && todo.cuenta === cuenta ? todo : { dia: hoy(), cuenta };
}

export function estadoDe(juego) {
  return guardado()[juego] || { intentos: [] };
}

export function guardarEstado(juego, estado) {
  escribir(CLAVE, { ...guardado(), [juego]: estado });
  // Para las tarjetas de los retos (js/juegos/index.js)
  document.dispatchEvent(new CustomEvent("reto-cambiado", { detail: juego }));
}

// Si ya lo jugaste hoy en otro dispositivo (con esta cuenta), lo da por terminado aquí también
export async function mirarSiYaJugado(juego, estado) {
  if (estado.fin || !usuarioActual()) return false;
  const jugada = await jugadaDeHoy(juego);
  if (!jugada) return false;
  Object.assign(estado, { fin: true, acierto: jugada.acierto, fichas: jugada.puntos, otroSitio: true });
  guardarEstado(juego, estado);
  return true;
}

// Para los logros (js/comun/logros.js, los de «Retos»): retos terminados, los acertados del todo
// (acierto) y los perfectos de cada juego (perfecto; si el juego no dice otra cosa, el acierto), y
// los días con todos los retos hechos
const TODOS_LOS_RETOS = ["silueta", "pistas", "eficaz", "masomenos", "locke", "grito", "evolucion"];

function contarParaLogros(juego, estado) {
  sumarContador("retos");
  if (estado.acierto) sumarContador(`acierto-${juego}`);
  if (estado.perfecto ?? estado.acierto) sumarContador(`perfecto-${juego}`);
  if (TODOS_LOS_RETOS.every((cada) => estadoDe(cada).fin)) sumarContador("dias-completos");
}

// Reto terminado: se apunta y, con sesión, se suman sus Pokédólares
export async function terminar(juego, estado, puntos) {
  Object.assign(estado, { fin: true, juego, puntos }); // juego y puntos: por si hay que reintentarlo
  guardarEstado(juego, estado);
  contarParaLogros(juego, estado);
  if (!usuarioActual()) return;
  await apuntar(juego, estado);
}

async function apuntar(juego, estado) {
  try {
    const resultado = await guardarJugada(juego, { puntos: estado.puntos || 0, intentos: (estado.intentos || []).length, acierto: Boolean(estado.acierto) });
    if (resultado) {
      Object.assign(estado, { fichas: resultado.puntos, bono: resultado.bono });
      delete estado.error;
    } else estado.error = true; // con sesión pero sin el perfil cargado
  } catch (error) {
    // Si sale «permission-denied», lo normal es que falte publicar las reglas de firestore.rules
    console.error("No se ha podido apuntar la jugada", error);
    estado.error = true;
  }
  guardarEstado(juego, estado);
}

// «Volver a intentarlo» (en el aviso de error de plantillaFin): el reto ya está jugado, solo
// falta apuntarlo. Al acabar, la sección vuelve a pintar el reto (js/juegos/index.js).
document.addEventListener("click", async (e) => {
  const boton = e.target.closest(".juego-reintentar");
  if (!boton || !usuarioActual()) return;
  boton.disabled = true;
  const juego = boton.dataset.juego;
  const estado = estadoDe(juego);
  await apuntar(juego, estado);
  document.dispatchEvent(new CustomEvent("reto-repintar"));
});

// El título del final en los de adivinar un Pokémon
export function tituloAdivinar(estado, solucion) {
  return estado.acierto ? t("¡Correcto! Era {nombre}.", { nombre: solucion }) : t("Era {nombre}.", { nombre: solucion });
}

// Lo de debajo del reto terminado: el título (ya escapado) y cuántos Pokédólares ha dado (o por qué no)
export function plantillaFin(estado, titulo) {
  let fichas = "";
  if (estado.otroSitio) fichas = t("Ya lo jugaste hoy en otro sitio: {n} Pokédólares.", { n: estado.fichas || 0 });
  else if (estado.error) {
    fichas = `${t("No se han podido apuntar los Pokédólares.")}
      ${estado.juego ? `<button class="juego-reintentar" data-juego="${estado.juego}">${t("Volver a intentarlo")}</button>` : ""}`;
  }
  else if (!usuarioActual()) fichas = t("Inicia sesión antes de jugar para ganar Pokédólares.");
  else if (estado.fichas == null) fichas = t("Apuntando tus Pokédólares...");
  else {
    fichas = estado.bono
      ? t("+{n} Pokédólares ({bono} por la racha)", { n: estado.fichas, bono: estado.bono })
      : t("+{n} Pokédólares", { n: estado.fichas });
  }
  return `
    <div class="juego-fin ${estado.acierto ? "acierto" : "fallo"}">
      <strong>${titulo}</strong>
      ${fichas ? `<span class="juego-fin-fichas"><span class="ficha-moneda"></span>${fichas}</span>` : ""}
      <small>${t("Mañana, otro reto.")}</small>
    </div>`;
}
