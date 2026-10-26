// ---------- Capturas de la partida en «Rutas» ----------
//
// Cada Pokémon de la partida dice dónde se capturó. Con eso se marca su lugar en «Rutas» y se
// apunta qué salió ahí, igual que si se hiciera a mano. Nunca se desmarca nada, y cada Pokémon
// se mira una sola vez: si desmarcas un lugar, no vuelve a marcarse solo.

import { lugaresDelJuego } from "../rutas/datos.js";
import { leer, escribir } from "../comun/almacen.js";
import { apuntarEnLockesDelJuego } from "../comun/lockes.js";

// Las mismas claves que js/rutas/index.js y js/rutas/capturas.js
const CLAVE_MARCADAS = "poketeams-rutas-v2";
const CLAVE_CAPTURAS = "poketeams-capturas-v1";

const APARTADOS = ["rutas", "ciudades", "postgame", "eventos"];

// Ediciones de cada juego: los Pokémon que vienen de otro juego no cuentan
const EDICIONES = {
  dp: ["Diamante", "Perla"], platino: ["Platino"], hgss: ["HeartGold", "SoulSilver"], bw: ["Negro", "Blanco"],
  b2w2: ["Negro 2", "Blanco 2"], xy: ["X", "Y"], oras: ["Rubí Omega", "Zafiro Alfa"], sm: ["Sol", "Luna"], usum: ["Ultrasol", "Ultraluna"],
  swsh: ["Espada", "Escudo"], bdsp: ["Diamante Brillante", "Perla Reluciente"]
};

// Lugares que en «Rutas» van partidos en zonas o se llaman distinto. Por el número del lugar
// en el juego, que es lo único que distingue las zonas.
const ZONAS_ALOLA = {
  8: "Ruta 1 (Afueras de Hauoli)",
  18: "Ciudad Hauoli (Paseo Marítimo)",
  20: "Ciudad Hauoli (Zona Comercial)",
  36: "Colina Dequilate (Caldera Remota)",
  192: "Ciudad Malíe (Cabo de las Afueras)"
};
const POR_NUMERO = {
  sm: ZONAS_ALOLA,
  usum: { ...ZONAS_ALOLA, 88: "Colina Saltagua (Sala del dominante)" }
};
const POR_NOMBRE = {
  "Área Volcánica Wela": "Área Volcánica del Wela",
  "Súper Ultraganga": "Supermercado Ultraganga",
  "Zona de Descanso": "Zona Descanso",
  "Torre BELLSPROUT": "Torre Bellsprout",
  "Pozo SLOWPOKE": "Pozo Slowpoke",
  "Torre Campana": "Torre Campana (Torre Hojalata)",
  "Mt. Mortero": "Monte Mortero",
  "Entrada Safari": "Entrada Zona Safari",
  "Alm. Frigoríficos": "Almacenes Frigoríficos",
  "Torre Duodraco": "Torre Dracoespiral",
  "Escon. T. Rocket": "Escondite del Team Rocket",
  "Cueva M Plateado": "Cueva del Monte Plateado",
  "Puente Villa": "Puente Aldea",
  "Puente Progreso": "Puente Maravilla",
  "Laboratorio P+P": "Laboratorio P2",
  "Estancia Orientación": "Cámara Orientación",
  "Bosque Blanco": "Bosque Blanco (solo Edición Blanca)",
  "Villa Horroris": "Quinta Horroris",
  // Perla Reluciente (la Torre Perdida no tiene lugar propio: lo de dentro sale como Ruta 209)
  "Mina Ruinamaníaco (Mina del Ruinamaníaco)": "Mina Ruinamaníaco"
};

// Dónde apunta el juego a la inicial, si no es el sitio de su evento: en Diamante Brillante y Perla Reluciente, en el
// Lago Veraz (el evento es «Ruta 201», donde se da en Diamante y Perla)
const LUGAR_INICIAL = { bdsp: "Lago Veraz" };
// La inicial se da a nivel 5 (lo salvaje del primer sitio sale más bajo)
const NIVEL_INICIAL = 5;

// «Villa Raíz / Ruta 101: Pokémon inicial» -> ["Villa Raíz", "Ruta 101"]
function lugaresDelEvento(texto) {
  const corte = texto.indexOf(": ");
  return (corte > 0 ? texto.slice(0, corte) : texto).split(" / ").map((lugar) => lugar.trim());
}

function captura(p) {
  const salida = { especie: p.id, nombre: p.nombre, mote: p.mote || "" };
  if (p.nombreEn || p.en) salida.en = p.nombreEn || p.en; // en inglés (ver js/rutas/capturas.js)
  for (const campo of ["idForma", "formaPMD", "imagenForma"]) {
    if (p[campo] !== undefined && p[campo] !== null) salida[campo] = p[campo];
  }
  return salida;
}

// partida: la convertida (js/partida/convertir.js). mirados: llaves de los Pokémon ya
// mirados otras veces (se añaden los de ahora). conHierba: el locke tiene la hierba en los
// pueblos del randomizer (esos pueblos también cuentan). Devuelve cuántos lugares se han marcado.
export function marcarCapturas(partida, idJuego, mirados, conHierba = false) {
  const lugares = lugaresDelJuego(idJuego, conHierba);
  if (!lugares) return 0;

  const apartados = (lugares.apartados || APARTADOS.map((clave) => ({ clave }))).map((a) => a.clave);
  const porTexto = new Map(); // lugar -> clave («rutas:Ruta 1»)
  const eventos = [];         // [{ clave, lugares }]
  for (const apartado of apartados) {
    for (const texto of lugares[apartado] || []) {
      if (apartado === "eventos") eventos.push({ clave: `${apartado}:${texto}`, texto, lugares: lugaresDelEvento(texto) });
      else porTexto.set(texto, `${apartado}:${texto}`);
    }
  }

  const marcadas = leer(CLAVE_MARCADAS, {}) || {};
  const capturas = leer(CLAVE_CAPTURAS, {}) || {};
  const usadas = new Set(marcadas[idJuego] || []);
  const usadosTexto = new Set([...usadas].map((clave) => clave.slice(clave.indexOf(":") + 1)));
  const delJuego = { ...(capturas[idJuego] || {}) };
  const ediciones = EDICIONES[idJuego] || [];

  // Del primero capturado al último: si dos salen del mismo sitio, cuenta el primero
  const deEsteJuego = [...partida.equipo, ...partida.cajas.flatMap((caja) => caja.pokemon)]
    .filter((p) => p.lugar && (!p.origen || ediciones.includes(p.origen)))
    .sort((uno, otro) => String(uno.fecha).localeCompare(String(otro.fecha)));
  const todos = deEsteJuego.filter((p) => !mirados.has(p.llave));

  // La inicial va siempre a su evento (nunca a la ruta de su sitio), y lo salvaje de ese sitio, nunca al evento. Es la
  // primera que se tuvo de las de ese sitio a nivel 5 (también entre las ya miradas: así no se toma otra por ella)
  const eventoInicial = eventos.find((e) => e.texto.endsWith(": Pokémon inicial"));
  const sitiosInicial = eventoInicial ? [...eventoInicial.lugares, LUGAR_INICIAL[idJuego]] : [];
  const inicial = deEsteJuego.find((p) => sitiosInicial.includes(p.lugar) && (!p.nivelCaptura || p.nivelCaptura === NIVEL_INICIAL));

  const nuevos = [];
  for (const p of todos) {
    mirados.add(p.llave);
    const alias = POR_NOMBRE[p.lugar];
    const lugar = (POR_NUMERO[idJuego] || {})[p.lugarN] || (alias && (porTexto.has(alias) || eventos.some((e) => e.lugares.includes(alias))) ? alias : p.lugar);

    let elegido = null;
    if (p === inicial) {
      if (!usadosTexto.has(eventoInicial.texto)) elegido = { clave: eventoInicial.clave, texto: eventoInicial.texto, lugar };
    } else if (porTexto.has(lugar) && !usadosTexto.has(lugar)) elegido = { clave: porTexto.get(lugar), texto: lugar, lugar };
    else {
      // El lugar ya está usado (o no es de los que tienen Pokémon salvajes): un evento de
      // ese sitio, si hay uno solo libre (un regalo, un estático...)
      const libres = eventos.filter((e) => e !== eventoInicial && !usadosTexto.has(e.texto) && e.lugares.includes(lugar));
      if (libres.length === 1) elegido = { clave: libres[0].clave, texto: libres[0].texto, lugar };
    }
    if (!elegido) continue;

    usadas.add(elegido.clave);
    usadosTexto.add(elegido.texto);
    if (!delJuego[elegido.texto]) delJuego[elegido.texto] = captura(p);
    nuevos.push(elegido);
  }

  if (nuevos.length) {
    marcadas[idJuego] = [...usadas];
    capturas[idJuego] = delJuego;
    escribir(CLAVE_MARCADAS, marcadas);
    escribir(CLAVE_CAPTURAS, capturas);
    // A la actividad de tus lockes de este juego, como al marcar a mano
    for (const { lugar } of nuevos) {
      apuntarEnLockesDelJuego("rutasPropias", idJuego, "ruta", lugar, true).catch((error) => console.error(error));
    }
  }
  return nuevos.length;
}
