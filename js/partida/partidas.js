// ---------- Partidas vinculadas a los lockes ----------
//
// Lo leído de la partida de cada locke se guarda en tus datos (y con sesión, en tu cuenta,
// como tus equipos): nunca en el locke, que lo leen los demás. Así se ve también desde otro
// sitio, aunque leer el archivo solo se pueda en el ordenador donde está.
//
//   localStorage «poketeams-partidas-v1»:
//     { idLocke: { juego, version, entrenador, actualizada, archivo, equipo, cajas, medallas: [sí/no],
//                  cajasMuertos: [posiciones], mirados: [llaves], muertosVistos: [llaves],
//                  medallasVistas: [índices], arbitroVistas: [ids], arbitroSinMote: [llaves] } }

import { leer, escribir } from "../comun/almacen.js";
import { pokemonParaCopia } from "../comun/pokemon.js";
import { leerPartida3DS, esPartida3DS } from "./tresds.js";
import { leerPartidaDS, esPartidaDS } from "./nds.js";
import { leerPartidaSwSh, esPartidaSwSh } from "./switch.js";
import { leerPartidaBDSP, esPartidaBDSP } from "./bdsp.js";
import { leerPartidaGBA, esPartidaGBA, prepararGBA } from "./gba.js";
import { convertirPartida } from "./convertir.js";
import { cargarPokedex } from "../pokedex/datos.js";
import { marcarCapturas } from "./rutas.js";
import { revisar, nivelTope } from "./arbitro.js";
import { marcarMedallasNuevas } from "../comun/medallas.js";
import { hierbaEnPueblos } from "../randomizer/reglas.js";
import { CLAVE_HIERBA_RUTAS } from "../comun/selector-juego.js";
import { nombreDeJuego } from "../comun/juegos.js";
import { t } from "../comun/idioma.js";

// NO cambiar esta clave: si se cambia, se pierden las partidas vinculadas
const CLAVE = "poketeams-partidas-v1";
const MAX_VISTAS = 300; // infracciones ya apuntadas que se recuerdan (arbitroVistas)

// Juegos que se saben leer (ids de js/comun/juegos.js)
export const JUEGOS_LEIBLES = ["frlg", "dp", "platino", "hgss", "bw", "b2w2", "xy", "oras", "sm", "usum", "swsh", "bdsp"];

// De qué consola es la partida (la que sepa leerla), o null
function lectorDe(bytes) {
  if (esPartida3DS(bytes)) return leerPartida3DS;
  if (esPartidaSwSh(bytes)) return leerPartidaSwSh;
  if (esPartidaBDSP(bytes)) return leerPartidaBDSP;
  if (esPartidaDS(bytes)) return leerPartidaDS;
  if (esPartidaGBA(bytes)) return leerPartidaGBA;
  return null;
}

export function sePuedeLeer(locke) {
  return Boolean(locke && JUEGOS_LEIBLES.includes(locke.juego));
}

function todas() {
  return leer(CLAVE, {}) || {};
}

export function partidaDe(idLocke) {
  return todas()[idLocke] || null;
}

function guardarPartida(idLocke, partida) {
  const lista = todas();
  if (partida) lista[idLocke] = partida;
  else delete lista[idLocke];
  escribir(CLAVE, lista);
}

export function olvidarPartida(idLocke) {
  guardarPartida(idLocke, null);
}

// Las cajas de los muertos (con muchas vidas no caben en una): las que se marquen o, la
// primera vez, las que se llamen como tal
const NOMBRE_CEMENTERIO = /muert|cementerio|tumba|\brip\b|dead|grave|fallec/i;

export function cajasMuertosDe(partida) {
  if (!partida) return [];
  if (partida.cajasMuertos) return partida.cajasMuertos;
  // Las guardadas cuando solo había una
  return partida.cajaMuertos >= 0 ? [partida.cajaMuertos] : [];
}

export function alternarCajaMuertos(idLocke, posicion) {
  const partida = partidaDe(idLocke);
  if (!partida) return;
  const cajas = cajasMuertosDe(partida);
  partida.cajasMuertos = cajas.includes(posicion) ? cajas.filter((i) => i !== posicion) : [...cajas, posicion].sort((a, b) => a - b);
  delete partida.cajaMuertos;
  guardarPartida(idLocke, partida);
}

// Para el árbitro: la primera especie de cada línea evolutiva (datos/familias.json) y qué
// especies son legendarias o singulares (de la Pokédex). Si no se pueden bajar, el árbitro
// sigue sin ellas (y se vuelve a intentar la próxima vez).
const URL_FAMILIAS = new URL("../../datos/familias.json", import.meta.url);
let datosArbitro = null;

async function datosDelArbitro() {
  if (datosArbitro) return datosArbitro;
  let familias = null;
  try {
    const respuesta = await fetch(URL_FAMILIAS);
    if (respuesta.ok) familias = await respuesta.json();
  } catch (error) {
    // sin red ni archivo: sin líneas evolutivas
  }
  const clases = {};
  try {
    for (const fila of await cargarPokedex()) if (!fila.forma && fila.clase) clases[fila.numero] = fila.clase;
  } catch (error) {
    // sin Pokédex: sin clases
  }
  const datos = { familias: familias || {}, clases };
  if (familias) datosArbitro = datos;
  return datos;
}

// Lee el archivo y lo guarda. Devuelve { partida } o { error } (texto para enseñar; con
// reintentar o dudoso, puede que a la próxima sí se pueda).
// enVivo: jugando en la web (js/jugar), { equipo, base }: el equipo de ahora mismo, leído de la
// memoria del juego, en lugar del de la partida guardada. Sin partida guardada todavía (bytes
// null), el resto sale de base.
export async function procesarArchivo(locke, bytes, archivo = "", enVivo = null) {
  let leida = null;
  if (bytes) {
    const lector = lectorDe(bytes);
    // dudoso: puede ser una partida a medio guardar (el emulador escribiendo justo entonces)
    if (!lector) return { error: t("Ese archivo no es una partida que se sepa leer."), dudoso: true };
    if (lector === leerPartidaGBA) await prepararGBA();
    try {
      leida = lector(bytes);
    } catch (error) {
      // Lo normal: el emulador estaba a mitad de guardar
      return { error: t("No se ha podido leer la partida."), reintentar: true };
    }
  }
  if (enVivo) leida = { ...(leida || enVivo.base), equipo: enVivo.equipo };
  if (locke.juego && leida.juego !== locke.juego) {
    return { error: t("Esa partida es de {partida} y el locke, de {locke}.", { partida: nombreDeJuego(leida.juego), locke: nombreDeJuego(locke.juego) }) };
  }

  const nueva = await convertirPartida(leida);
  const anterior = partidaDe(locke.id) || {};
  const cajasMuertos = anterior.juego
    ? cajasMuertosDe(anterior)
    : nueva.cajas.flatMap((caja, i) => (NOMBRE_CEMENTERIO.test(caja.nombre) ? [i] : []));

  const mirados = new Set(anterior.mirados || []);
  // Con la hierba en los pueblos del randomizer, esos pueblos también son lugares de captura (y
  // Rutas los enseña, como al llegar desde el locke)
  const conHierba = hierbaEnPueblos(locke);
  if (conHierba) {
    const juegos = leer(CLAVE_HIERBA_RUTAS, {}) || {};
    if (!juegos[leida.juego]) escribir(CLAVE_HIERBA_RUTAS, { ...juegos, [leida.juego]: true });
  }
  const hallazgos = {};
  const marcadas = marcarCapturas(nueva, leida.juego, mirados, conHierba, hallazgos);
  // Las medallas nuevas: su gimnasio, superado en «Level caps»
  const medallasVistas = new Set(anterior.medallasVistas || []);
  marcarMedallasNuevas(leida.juego, nueva.medallas, medallasVistas);

  // El árbitro de normas (./arbitro.js). La primera lectura solo toma nota: lo que ya había
  // antes de vincular no se acusa
  const primera = !anterior.juego;
  const revision = locke.arbitro
    ? revisar({
        arbitro: locke.arbitro,
        partida: nueva,
        cajasMuertos,
        repetidasEnZona: hallazgos.repetidasEnZona,
        deEvento: hallazgos.deEvento,
        tope: locke.arbitro.nivel ? nivelTope(locke) : null,
        ...(await datosDelArbitro()),
        antes: { vistas: anterior.arbitroVistas, sinMote: primera ? [] : anterior.arbitroSinMote }
      })
    : null;
  const infracciones = revision && !primera ? revision.infracciones : [];

  const partida = {
    ...nueva,
    actualizada: Date.now(),
    archivo,
    cajasMuertos,
    mirados: [...mirados],
    medallasVistas: [...medallasVistas],
    muertosVistos: anterior.muertosVistos || [],
    creados: anterior.creados || []
  };
  if (revision) {
    // Lo de antes de vincular cuenta como visto, y sin mote también
    const deAntes = primera ? revision.sinMote.map((llave) => `mote|${llave}`) : [];
    partida.arbitroVistas = [...new Set([...revision.vistas, ...deAntes])].slice(-MAX_VISTAS);
    partida.arbitroSinMote = primera ? [] : revision.sinMote;
  }
  guardarPartida(locke.id, partida);
  return { partida, marcadas, primera, infracciones };
}

// Los de la caja de los muertos que no se han apuntado ni descartado todavía. Los que ya
// están en el cementerio del locke (misma especie y mote) se dan por apuntados.
export function muertosSinApuntar(idLocke, enCementerio) {
  const partida = partidaDe(idLocke);
  if (!partida) return [];
  const vistos = new Set(partida.muertosVistos || []);
  const yaEstan = new Set(enCementerio.map((muerto) => `${muerto.especie}|${(muerto.mote || "").toLowerCase()}`));
  const enCajas = cajasMuertosDe(partida).flatMap((i) => (partida.cajas[i] ? partida.cajas[i].pokemon : []));
  return enCajas.filter(
    (p) => !vistos.has(p.llave) && !yaEstan.has(`${p.id}|${(p.mote || "").toLowerCase()}`)
  );
}

export function marcarMuertosVistos(idLocke, llaves) {
  const partida = partidaDe(idLocke);
  if (!partida) return;
  partida.muertosVistos = [...new Set([...(partida.muertosVistos || []), ...llaves])];
  guardarPartida(idLocke, partida);
}

// Los Pokémon metidos desde la web (nuevos, clonados, de un equipo): no son capturas de
// ninguna ruta ni muertos que apuntar. Se apuntan antes de escribirlos, para que la lectura de
// después ya los encuentre.
export function marcarMetidos(idLocke, llaves) {
  const partida = partidaDe(idLocke);
  if (!partida) return;
  partida.mirados = [...new Set([...(partida.mirados || []), ...llaves])];
  partida.muertosVistos = [...new Set([...(partida.muertosVistos || []), ...llaves])];
  guardarPartida(idLocke, partida);
}

// Los creados de cero en la web (no los clonados): su juego de origen se ve como «NuzTheLocke»
export function marcarCreados(idLocke, llaves, creados = true) {
  const partida = partidaDe(idLocke);
  if (!partida) return;
  const antes = new Set(partida.creados || []);
  for (const llave of llaves) {
    if (creados) antes.add(llave);
    else antes.delete(llave);
  }
  partida.creados = [...antes];
  guardarPartida(idLocke, partida);
}

export function esCreado(idLocke, llave) {
  return ((partidaDe(idLocke) || {}).creados || []).includes(llave);
}

// El equipo de la partida para un combate (como los de «Mis equipos» en elegir-equipo.js)
export function equipoParaCombate(idLocke) {
  const partida = partidaDe(idLocke);
  if (!partida || !partida.equipo.length) return null;
  const pokemon = partida.equipo.filter((p) => !p.huevo).map((p) => pokemonParaCopia(p));
  return JSON.parse(JSON.stringify({ nombre: t("Equipo de la partida"), pokemon }));
}
