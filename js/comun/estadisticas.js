// ---------- Estadísticas de una persona en sus lockes ----------
//
// Los números de «Amigos» (botón de estadísticas de cada ficha). Salen de tres sitios, sin contar
// ningún locke dos veces (el id):
//
//   · los lockes de «Lockes» en los que está esa persona (los tuyos, o los que jugáis juntos si
//     es un amigo): traen vidas, muertos, victorias, ROM, equipos finales y los de cada combate;
//   · los lockes ganados que tiene apuntados en su propio palmarés (perfil.ganados), a mano o
//     puestos solos al ganar un locke: son siempre victorias suyas;
//   · los apuntados en el palmarés de otra persona en los que sale como participante (por su uid
//     o, si no, por su nombre): ahí lo normal es que haya perdido, pero cuenta igual.
//
//   De los apuntados se sabe lo que se apuntó (participantes, ROM, equipos, combates y juego);
//   no traen muertos ni las vidas con las que se empezó.
//
// La ventana está en js/amigos/estadisticas.js.

import { muertosDe, victoriasDe, seHaPasadoLaRom, estadoDe, estaEliminado, combatesDe } from "./lockes.js";
import { nombreJuego } from "./campo-juego.js";
import { enIngles } from "./idioma.js";

const TOP = 5;

// Los de un mapa de cuentas, de más a menos (a igualdad, por nombre)
function ordenados(cuentas, tope) {
  return [...cuentas.values()]
    .sort((uno, otro) => otro.n - uno.n || String(uno.nombre).localeCompare(String(otro.nombre)))
    .slice(0, tope);
}

function sumar(cuentas, clave, nombre, muestra) {
  const antes = cuentas.get(clave);
  if (antes) antes.n++;
  else cuentas.set(clave, { clave, nombre, n: 1, muestra });
}

const mismoNombre = (uno, otro) => String(uno || "").trim().toLowerCase() === String(otro || "").trim().toLowerCase();

// Todos los Pokémon que ha llevado en un locke: el equipo final y el de cada combate
function usadosEn(locke, uid) {
  const salon = (locke.salon || {})[uid];
  const deCombates = Object.values((locke.equipos || {})[uid] || {});
  return [...((salon && salon.pokemon) || []), ...deCombates.flatMap((equipo) => equipo.pokemon || [])];
}

// Quién es esta persona entre los participantes de un locke apuntado: por su uid (los que son
// amigos o ella misma) o por su nombre. Si el locke es de su propio palmarés y no hay más pistas,
// el de quien ganó.
function participanteDe(ganado, uid, perfil, propio) {
  const participantes = ganado.participantes || [];
  return (
    participantes.find((p) => p.uid === uid || p.id === uid) ||
    participantes.find((p) => mismoNombre(p.nombre, perfil && perfil.nombre)) ||
    (propio ? participantes.find((p) => mismoNombre(p.nombre, ganado.ganador)) : null) ||
    null
  );
}

// Los lockes apuntados que cuentan para esta persona y que no son ya uno de «Lockes»:
// { ganado, participante, gana }. Los de su palmarés (los ganó) y los de los demás perfiles
// (otrosPerfiles) en los que sale; si el mismo locke está en varios, solo cuenta una vez.
function apuntadosDe(uid, perfil, otrosPerfiles, conocidos) {
  const vistos = new Set(conocidos);
  const lista = [];

  for (const ganado of (perfil && perfil.ganados) || []) {
    if (vistos.has(ganado.id)) continue;
    vistos.add(ganado.id);
    lista.push({ ganado, participante: participanteDe(ganado, uid, perfil, true), gana: true });
  }

  for (const otro of otrosPerfiles) {
    if (!otro || otro.uid === uid) continue;
    for (const ganado of otro.ganados || []) {
      if (vistos.has(ganado.id)) continue;
      const participante = participanteDe(ganado, uid, perfil, false);
      if (!participante) continue;
      vistos.add(ganado.id);
      // Ganó el que lo apuntó, que es quien ganó en su palmarés: si esta persona es ese, también
      const gana = participante.uid === otro.uid || mismoNombre(participante.nombre, ganado.ganador || otro.nombre);
      lista.push({ ganado, participante, gana });
    }
  }
  return lista;
}

// Los Pokémon que ha llevado en un locke apuntado: su equipo final y los de sus combates
function usadosEnApuntado(ganado, participante) {
  if (!participante) return [];
  const deCombates = (ganado.combates || []).map((combate) => (combate.equipos || {})[participante.id]).filter(Boolean);
  return [...((participante.equipo && participante.equipo.pokemon) || []), ...deCombates.flatMap((equipo) => equipo.pokemon || [])];
}

// uid: de quién; lockes: los de «Lockes» en los que mirar; perfil: su perfil, para su palmarés;
// otrosPerfiles: los demás que se pueden ver, por los lockes suyos en los que sale; tipos: función
// que da los tipos de un muerto (Pokédex) o null si no se sabe; nombreTipo: id de tipo -> nombre
export function estadisticasDe(uid, lockes, perfil = null, otrosPerfiles = [], tipos = () => null, nombreTipo = (tipo) => tipo) {
  const suyos = lockes.filter((locke) => (locke.jugadores || []).includes(uid) && estadoDe(locke, uid) === "aceptado");
  const terminados = suyos.filter((locke) => locke.estado === "cerrado");

  // Los apuntados que no son ya uno de arriba
  const apuntados = apuntadosDe(uid, perfil, otrosPerfiles, new Set(suyos.map((locke) => locke.id)));

  let caidos = 0;
  let vidasPerdidas = 0;
  let victorias = 0;
  let combatesGanados = 0;
  let combatesJugados = 0;
  let roms = 0;
  const muertosPorEspecie = new Map();
  const muertosPorTipo = new Map();
  const usadosPorEspecie = new Map();
  const usadosPorTipo = new Map();
  const porJuego = new Map();

  // Cada especie y cada tipo cuentan una vez por locke, aunque estén en varios equipos
  const contarUsados = (pokemon) => {
    const especies = new Set();
    const tiposDelLocke = new Set();
    for (const p of pokemon) {
      if (!especies.has(p.id)) {
        especies.add(p.id);
        sumar(usadosPorEspecie, p.id, (enIngles && p.en) || p.es || p.nombre || "", p);
      }
      for (const tipo of p.tipos || []) {
        if (tiposDelLocke.has(tipo)) continue;
        tiposDelLocke.add(tipo);
        sumar(usadosPorTipo, tipo, nombreTipo(tipo), null);
      }
    }
  };

  const contarJuego = (nombre, gano, muertos) => {
    if (!nombre) return;
    const fila = porJuego.get(nombre) || { clave: nombre, nombre, n: 0, ganados: 0, caidos: 0 };
    fila.n++;
    fila.caidos += muertos;
    if (gano) fila.ganados++;
    porJuego.set(nombre, fila);
  };

  for (const locke of suyos) {
    const muertos = muertosDe(locke, uid);
    caidos += muertos.length;

    if (!locke.vidasIlimitadas && (locke.vidas || {})[uid] !== undefined) {
      vidasPerdidas += Math.max(0, (locke.vidasIniciales || 0) - Math.max(0, locke.vidas[uid]));
    }
    victorias += victoriasDe(locke, uid);
    const combates = combatesDe(locke);
    const resultados = locke.resultados || {};
    combatesJugados += combates.filter((combate) => resultados[combate.id]).length;
    combatesGanados += combates.filter((combate) => (resultados[combate.id] || {}).ganador === uid).length;
    if (seHaPasadoLaRom(locke, uid)) roms++;

    for (const muerto of muertos) {
      sumar(muertosPorEspecie, muerto.especie, (enIngles && muerto.en) || muerto.nombre, muerto);
      for (const tipo of tipos(muerto) || []) sumar(muertosPorTipo, tipo, nombreTipo(tipo), null);
    }
    contarUsados(usadosEn(locke, uid));
    contarJuego(nombreJuego(locke), locke.estado === "cerrado" && locke.ganador === uid, muertos.length);
  }

  for (const { ganado, participante, gana } of apuntados) {
    if (participante && participante.rom) roms++;
    for (const combate of ganado.combates || []) {
      if (!combate.ganador && !Object.keys(combate.puntos || {}).length) continue;
      combatesJugados++;
      if (participante && combate.ganador === participante.id) combatesGanados++;
    }
    contarUsados(usadosEnApuntado(ganado, participante));
    contarJuego(nombreJuego(ganado), gana, 0);
  }

  const ganadosEnWeb = terminados.filter((locke) => locke.ganador === uid).length;
  return {
    lockes: suyos.length + apuntados.length,
    apuntados: apuntados.length,
    enMarcha: suyos.length - terminados.length,
    terminados: terminados.length + apuntados.length,
    terminadosEnWeb: terminados.length,
    ganados: ganadosEnWeb + apuntados.filter((apuntado) => apuntado.gana).length,
    ganadosEnWeb,
    roms,
    eliminado: suyos.filter((locke) => estaEliminado(locke, uid)).length,
    caidos,
    // Solo de los lockes de la web: los apuntados no dicen cuántos murieron
    caidosPorLocke: suyos.length ? Math.round((caidos / suyos.length) * 10) / 10 : 0,
    vidasPerdidas,
    victorias,
    combatesGanados,
    combatesJugados,
    masMuertos: ordenados(muertosPorEspecie, TOP),
    tiposQueMueren: ordenados(muertosPorTipo, 3),
    masUsados: ordenados(usadosPorEspecie, TOP),
    tiposUsados: ordenados(usadosPorTipo, 3),
    porJuego: ordenados(porJuego, 6)
  };
}
