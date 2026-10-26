// ---------- Árbitro de normas ----------
//
// Con la partida vinculada, la web puede ver si te saltas alguna norma. Qué se vigila lo elige
// quien crea el locke (locke.arbitro, ver arbitroLimpio); cada uno es revisado en su
// ordenador, al leer su partida, y lo que encuentra se apunta en la actividad del locke como
// «infraccion» (js/versus/actividad.js), donde lo ven los demás y de donde les llega a la
// campana de notificaciones (js/avisos.js). El texto de los avisos está en ./infracciones.js.
//
//   locke.arbitro: { nivel, captura, motes, repetidos }   (cada una true o false)
//
//   · nivel: un Pokémon del equipo por encima del level cap. Se mira con el level cap de la
//     web ya puesto al día con las medallas de esta misma lectura (ver nivelTope).
//   · captura: una segunda captura en una zona que ya tenía (la web ya sabe cuál es la
//     primera; ver marcarCapturas en ./rutas.js).
//   · motes: un Pokémon sin mote. Se avisa si sigue sin él en la siguiente lectura (al
//     capturarlo hay un rato hasta ponérselo).
//   · repetidos: un Pokémon repetido en el equipo mientras el primero de su línea sigue vivo.
//     Tener repetidos en las cajas vale; se usan cuando el primero ha muerto (está en una caja
//     de muertos). Un repetido es el que no puede acabar siendo otra cosa que lo que ya tienes
//     (ver chocan): un Pikachu con un Raichu vivo, sí; un Eevee con un Jolteon vivo, no, porque
//     puede evolucionar en otro; dos Jolteon, sí.
//
// No cuentan como captura de la zona: los variocolor, la inicial, los regalos y estáticos de la
// lista de eventos de «Rutas» de ese sitio, los legendarios y singulares, los fósiles y los
// intercambios. Los huevos no cuentan en nada.
//
// La web solo ve lo que hay en la partida, así que puede equivocarse (un regalo que no está
// en la lista de eventos...): quien recibe el aviso puede retirarlo desde la actividad.
// Cada infracción se apunta una sola vez (su id queda en la partida: arbitroVistas).
//
// Un suceso lleva el tipo «infraccion» y en «detalle»: «regla|datos...» (ver ./infracciones.js)

import { leer } from "../comun/almacen.js";
import { CLAVE_MULTIPLICADOR_CAPS } from "../comun/selector-juego.js";
import { tieneMedallas } from "../comun/medallas.js";
import { COMBATES, claveCombate } from "../levelcaps/datos.js";
import { completarReglas } from "../randomizer/reglas.js";

const CLAVE_SUPERADOS = "poketeams-levelcaps-v2"; // la de js/levelcaps/index.js

export const REGLAS_ARBITRO = ["nivel", "captura", "motes", "repetidos"];

// Los Pokémon que se revivieron de un fósil (la primera de su línea): se consiguen, no se capturan
const FOSILES = new Set([138, 140, 142, 345, 347, 408, 410, 564, 566, 696, 698, 880, 881, 882, 883]);

// Las líneas evolutivas a partir de datos/familias.json ({ especie: especie de la que viene }):
// la primera de la línea y en qué puede acabar cada especie (las últimas de sus ramas)
const cacheLineas = new WeakMap();

function lineas(padres) {
  if (cacheLineas.has(padres)) return cacheLineas.get(padres);
  const hijos = new Map();
  for (const [hijo, padre] of Object.entries(padres)) {
    if (!hijos.has(Number(padre))) hijos.set(Number(padre), []);
    hijos.get(Number(padre)).push(Number(hijo));
  }
  const finales = new Map();
  const finalesDe = (id) => {
    if (!finales.has(id)) {
      const siguientes = hijos.get(id) || [];
      finales.set(id, new Set(siguientes.length ? siguientes.flatMap((hijo) => [...finalesDe(hijo)]) : [id]));
    }
    return finales.get(id);
  };
  const raiz = (id) => {
    while (padres[id]) id = padres[id];
    return id;
  };
  const resultado = { raiz, finalesDe };
  cacheLineas.set(padres, resultado);
  return resultado;
}

// Lo que se guarda en el locke: solo las reglas activas (o null si no hay ninguna)
export function arbitroLimpio(arbitro) {
  if (!arbitro) return null;
  const limpio = Object.fromEntries(REGLAS_ARBITRO.map((regla) => [regla, Boolean(arbitro[regla])]));
  return REGLAS_ARBITRO.some((regla) => limpio[regla]) ? limpio : null;
}

const nombreDe = (p) => p.mote || p.nombre || "";

// El level cap de ahora, con el multiplicador del locke (el del randomizer o el que se haya
// puesto en «Level caps»). Sale de los combates superados de «Level caps», que se ponen al día
// solos con las medallas de la partida (js/comun/medallas.js) justo antes de que el árbitro mire,
// así que un gimnasio recién ganado ya sube el tope.
//
// Es el del próximo gimnasio; con todos los gimnasios hechos, el más alto hasta el Campeón. Los
// combates de historia sin marcar de antes no lo bajan: se perdona de más, mejor que acusar a
// alguien por no haber marcado un combate. null si no se sabe cuál toca: juegos sin medallas
// que leer (el tope no se movería nunca) y listas de level caps propias.
export function nivelTope(locke) {
  if (locke.capsPropios || !tieneMedallas(locke.juego)) return null;
  const combates = (COMBATES[locke.juego] || []).filter((c) => !c.seccion);
  const superados = new Set((leer(CLAVE_SUPERADOS, {}) || {})[locke.juego] || []);
  const pendientes = combates.filter((c) => !superados.has(claveCombate(c)));
  if (!pendientes.length) return null;

  const siguiente = pendientes.find((c) => c.tipo === "gimnasio" || c.tipo === "alto-mando" || c.tipo === "campeon");
  let hasta = siguiente;
  if (!siguiente || siguiente.tipo !== "gimnasio") {
    // Sin gimnasios que hacer: la Liga entera cuenta, hasta el Campeón
    hasta = pendientes.find((c) => c.tipo === "campeon") || pendientes[pendientes.length - 1];
  }
  const tope = Math.max(...pendientes.slice(0, pendientes.indexOf(hasta) + 1).map((c) => c.nivel));

  let multiplicador = 1;
  if (locke.randomizer) {
    const subida = Number(completarReglas(locke.randomizer.reglas).entrenadores.nivel) || 0;
    multiplicador = 1 + subida / 100;
  } else {
    multiplicador = ((leer(CLAVE_MULTIPLICADOR_CAPS, {}) || {})[locke.juego]) || 1;
  }
  return Math.min(100, Math.round(tope * multiplicador));
}

// Qué ha visto el árbitro en esta lectura.
//   arbitro: locke.arbitro
//   partida: la partida convertida (equipo y cajas)
//   cajasMuertos: posiciones de las cajas de los muertos (no se les pide mote)
//   repetidasEnZona: los capturados ahora que son una segunda captura en su zona (marcarCapturas)
//   deEvento: llaves de los Pokémon que son un regalo o estático del sitio donde se conocieron
//   tope: el level cap de ahora (nivelTope), o null
//   familias: { especie: especie de la que viene } (datos/familias.json)
//   clases: { especie: "legendario" | "singular" | "bebe" } (de la Pokédex)
//   antes: { vistas: [ids ya apuntados], sinMote: [llaves sin mote en la lectura anterior] }
// Devuelve { infracciones: [{ id, regla, detalle }], vistas, sinMote }
export function revisar({
  arbitro, partida, cajasMuertos = [], repetidasEnZona = [], deEvento = new Set(), tope = null,
  familias = {}, clases = {}, antes = {}
}) {
  const vistas = new Set(antes.vistas || []);
  const encontradas = [];
  const apuntar = (id, regla, ...datos) => {
    if (vistas.has(id)) return;
    vistas.add(id);
    encontradas.push({ id, regla, detalle: [regla, ...datos].join("|") });
  };

  const reales = (lista) => lista.filter((p) => !p.huevo);
  const equipo = reales(partida.equipo);
  const vivos = [...equipo, ...reales(partida.cajas.flatMap((caja, i) => (cajasMuertos.includes(i) ? [] : caja.pokemon)))];

  const { raiz, finalesDe } = lineas(familias);
  // Los que no se han capturado en el sentido de las normas (ver arriba)
  const noEsCaptura = (p) =>
    p.shiny || deEvento.has(p.llave) || p.lugar === "Intercambio" ||
    ["legendario", "singular"].includes(clases[p.id]) || FOSILES.has(raiz(p.id));

  if (arbitro.nivel && tope) {
    for (const p of equipo) {
      if (p.nivel > tope) apuntar(`nivel|${p.llave}|${tope}`, "nivel", nombreDe(p), p.nivel, tope);
    }
  }

  if (arbitro.captura) {
    for (const p of repetidasEnZona) {
      if (!noEsCaptura(p)) apuntar(`captura|${p.llave}`, "captura", nombreDe(p), p.lugar);
    }
  }

  // Un repetido en el equipo: todo en lo que puede acabar ya lo tiene, en uno que sigue vivo y que
  // se capturó antes (los de las ramas, como Eevee, solo ocupan algo cuando ya han evolucionado)
  if (arbitro.repetidos) {
    for (const p of equipo) {
      const primeros = vivos.filter((otro) => otro.llave !== p.llave && raiz(otro.id) === raiz(p.id) && String(otro.fecha) < String(p.fecha));
      const ocupa = (otro) => {
        const finales = finalesDe(otro.id);
        return finales.size === 1 ? [...finales][0] : null;
      };
      const ocupados = new Set(primeros.map(ocupa).filter(Boolean));
      if (!primeros.length || ![...finalesDe(p.id)].every((final) => ocupados.has(final))) continue;
      const primero = primeros.find((otro) => finalesDe(p.id).has(ocupa(otro)));
      apuntar(`repetido|${p.llave}`, "repetidos", nombreDe(p), nombreDe(primero));
    }
  }

  // Sin mote: hasta que no lo está dos lecturas seguidas no se avisa
  const sinMote = [];
  if (arbitro.motes) {
    const estabanSin = new Set(antes.sinMote || []);
    for (const p of vivos) {
      if (p.mote) continue;
      sinMote.push(p.llave);
      if (estabanSin.has(p.llave)) apuntar(`mote|${p.llave}`, "motes", nombreDe(p));
    }
  }

  return { infracciones: encontradas, vistas: [...vistas], sinMote };
}
