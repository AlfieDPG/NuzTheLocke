// ---------- Un Pokémon de una partida de DS (gen 4 y 5), para editarlo ----------
//
// Lo mismo que ./pokemon3ds.js (mismos nombres y mismo objeto «editable»), con los offsets de
// los Pokémon de gen 4 y 5 (136 bytes en caja; 236 en el equipo en gen 4 y 220 en gen 5).
// pokemonDS(juego) da las funciones para ese juego ({ id, gen } de ./nds.js).
//
// La diferencia grande: aquí el PID decide el género (su byte bajo), la habilidad (un bit), si
// es shiny y, en gen 4, la naturaleza (PID % 25). Si se cambia algo de eso, se busca otro PID
// que cuadre con todo; y como el PID es también la llave del Pokémon, para la web pasa a ser
// otro (el editor lo apunta como metido).

import { TAM_POKEMON, formaWeb, formaJuego, codigosTexto, textoGen4, textoGen5, objetoWebDS, objetoJuegoDS } from "./nds.js";
import { estadisticas } from "./pokemon3ds.js";
import { ritmoDe, experienciaPara, nivelDe } from "./convertir.js";

// Orden de la web (PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad) -> sitio en el Pokémon
const EVS = [0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1b];
const BITS_IV = [0, 5, 10, 20, 25, 15];

export const MAX_MOTE_DS = 10;
export const MAX_ENTRENADOR_DS = 7;

// Lugares especiales: los creados aquí llegan «por intercambio» (así no cuentan como captura de
// ninguna ruta); los huevos, de la pareja de la guardería
const LUGARES = {
  4: { intercambio: 2002, guarderia: 2000, lejano: 3002 },
  5: { intercambio: 30003, guarderia: 60002 }
};
const POKE_BALL = 4;
const ULTIMA_BALL_DP = 16; // Cherish Ball: las de Bonguri de HGSS van aparte (0x86)

// Byte bajo del PID por debajo del cual es hembra, según gender_rate de PokeAPI (octavos de hembra)
const UMBRAL_HEMBRA = { 1: 31, 2: 63, 4: 127, 6: 191, 7: 225 };

export function generoDePid(pid, generoRatio) {
  if (generoRatio < 0) return "";
  if (generoRatio === 0) return "M";
  if (generoRatio === 8) return "F";
  return (pid & 0xff) < (UMBRAL_HEMBRA[generoRatio] ?? 127) ? "F" : "M";
}

function azar16() {
  const n = new Uint16Array(1);
  crypto.getRandomValues(n);
  return n[0];
}

function ponerFecha(datos, inicio, fecha) {
  datos[inicio] = fecha.getFullYear() % 100;
  datos[inicio + 1] = fecha.getMonth() + 1;
  datos[inicio + 2] = fecha.getDate();
}

export function pokemonDS(juego) {
  const gen = juego.gen;
  const lugares = LUGARES[gen];
  const texto = gen === 4 ? textoGen4 : textoGen5;

  // Un PID que cumpla lo pedido: { shiny, naturaleza? (gen 4), hab? (0 o 1), generoRatio?,
  // genero?, bajo? (byte bajo fijo) }
  function buscarPid(ids, req) {
    for (let intento = 0; intento < 2000000; intento++) {
      let bajo = azar16();
      if (req.bajo !== undefined) bajo = (bajo & 0xff00) | req.bajo;
      if (req.generoRatio !== undefined && generoDePid(bajo, req.generoRatio) !== req.genero) continue;
      if (gen === 4 && req.hab !== undefined && (bajo & 1) !== req.hab) continue;
      const alto = req.shiny ? (ids ^ bajo ^ (azar16() & 7)) & 0xffff : azar16();
      if (!req.shiny && (ids ^ bajo ^ alto) < 8) continue;
      if (gen === 5 && req.hab !== undefined && (alto & 1) !== req.hab) continue;
      const pid = ((alto << 16) | bajo) >>> 0;
      if (gen === 4 && req.naturaleza !== undefined && pid % 25 !== req.naturaleza) continue;
      return pid;
    }
    throw new Error("No se ha encontrado un PID que cuadre.");
  }

  // Dónde se conoció (met) o dónde se recibió el huevo. En gen 4, Platino y HGSS guardan aparte
  // los lugares que no existían en Diamante / Perla, y en el sitio de siempre, «lugar lejano».
  function leerLugar(v, huevo) {
    const [normal, aparte] = huevo ? [0x7e, 0x44] : [0x80, 0x46];
    return (gen === 4 && v.getUint16(aparte, true)) || v.getUint16(normal, true);
  }
  function ponerLugar(v, huevo, valor) {
    const [normal, aparte] = huevo ? [0x7e, 0x44] : [0x80, 0x46];
    if (gen === 5) {
      v.setUint16(normal, valor, true);
      return;
    }
    const nuevo = (valor > 111 && valor < 2000) || (valor > 2010 && valor < 3000);
    v.setUint16(normal, valor && nuevo ? lugares.lejano : valor, true);
    v.setUint16(aparte, valor && (nuevo || juego.id !== "dp") ? valor : 0, true);
  }

  // Hasta «maximo» letras, el 0xFFFF del final y lo que sobra del campo a ceros
  function escribirTexto(v, inicio, cadena, maximo, campo) {
    const codigos = codigosTexto(gen, cadena).slice(0, maximo);
    for (let i = 0; i < campo; i++) v.setUint16(inicio + i * 2, i < codigos.length ? codigos[i] : i === codigos.length ? 0xffff : 0, true);
  }

  function esShiny(v) {
    const pid = v.getUint32(0, true);
    return (v.getUint16(0x0c, true) ^ v.getUint16(0x0e, true) ^ (pid >>> 16) ^ (pid & 0xffff)) < 8;
  }

  function numHabilidad(v) {
    const pid = v.getUint32(0, true);
    if (gen === 5 && v.getUint8(0x42) & 1) return 4;
    return (gen === 4 ? pid & 1 : (pid >>> 16) & 1) ? 2 : 1;
  }

  function leerEditable(crudo) {
    const v = new DataView(crudo.buffer, crudo.byteOffset, crudo.byteLength);
    const iv32 = v.getUint32(0x38, true);
    const especie = v.getUint16(0x08, true);
    const experiencia = v.getUint32(0x10, true);
    const huevo = Boolean((iv32 >>> 30) & 1);
    const apodado = Boolean(iv32 >>> 31);
    const pid = v.getUint32(0, true);
    return {
      especie,
      forma: formaWeb(especie, crudo[0x40] >> 3),
      genero: crudo[0x40] & 4 ? "" : crudo[0x40] & 2 ? "F" : "M",
      apodado,
      mote: apodado && !huevo ? texto(v, 0x48, 11) : "",
      shiny: esShiny(v),
      objeto: objetoWebDS(gen, v.getUint16(0x0a, true)),
      habilidad: crudo[0x15],
      numHabilidad: numHabilidad(v),
      naturaleza: gen === 4 ? pid % 25 : crudo[0x41],
      experiencia,
      nivel: nivelDe(especie, experiencia),
      evs: EVS.map((o) => crudo[o]),
      ivs: BITS_IV.map((b) => (iv32 >>> b) & 31),
      amistad: crudo[0x14],
      ataques: [0, 1, 2, 3].map((i) => ({ id: v.getUint16(0x28 + i * 2, true), pp: crudo[0x30 + i], masPP: crudo[0x34 + i] })),
      huevo,
      ball: crudo[0x86] || crudo[0x83],
      lugar: leerLugar(v, false),
      version: crudo[0x5f],
      entrenador: texto(v, 0x68, 8),
      idioma: crudo[0x17],
      enEquipo: crudo.length > TAM_POKEMON
    };
  }

  // Copia con los cambios. opciones: { base, nombreEspecie, nombreHuevo, generoRatio }. Sin
  // generoRatio, el género no se toca (sale del PID).
  function aplicarEditable(crudo, editable, { base, nombreEspecie, nombreHuevo = "Huevo", generoRatio }) {
    const antes = leerEditable(crudo);
    const datos = new Uint8Array(crudo);
    const v = new DataView(datos.buffer);
    const e = editable;
    const huevo = e.huevo === undefined ? antes.huevo : Boolean(e.huevo);
    const hoy = new Date();

    v.setUint16(0x08, e.especie, true);
    v.setUint16(0x0a, objetoJuegoDS(gen, e.objeto || 0), true);
    datos[0x15] = e.habilidad;
    if (gen === 5) {
      datos[0x41] = e.naturaleza;
      datos[0x42] = (datos[0x42] & ~1) | (e.numHabilidad === 4 ? 1 : 0);
    }
    const genero = generoRatio === undefined ? antes.genero : e.genero;
    datos[0x40] = (datos[0x40] & 1) | (genero === "F" ? 2 : 0) | (genero === "" ? 4 : 0) | (formaJuego(e.especie, e.forma) << 3);
    if (e.ball) {
      if (juego.id === "hgss") {
        datos[0x86] = e.ball;
        datos[0x83] = e.ball <= ULTIMA_BALL_DP ? e.ball : POKE_BALL;
      } else datos[0x83] = e.ball;
    }

    const nivel = Math.max(1, Math.min(100, e.nivel));
    if (e.especie !== antes.especie || nivel !== antes.nivel) {
      v.setUint32(0x10, experienciaPara(ritmoDe(e.especie), nivel), true);
    }

    // Huevo: como los de la guardería (sin lugar ni fecha de conocerse hasta que eclosione).
    // Al dejar de serlo, se ha conocido hoy.
    if (huevo && !antes.huevo) {
      ponerLugar(v, true, lugares.guarderia);
      ponerFecha(datos, 0x78, hoy);
      ponerLugar(v, false, 0);
      datos.fill(0, 0x7b, 0x7e);
      datos[0x84] &= 0x80;
    } else if (!huevo && antes.huevo) {
      if (!datos[0x7b]) ponerFecha(datos, 0x7b, hoy);
      datos[0x84] = (datos[0x84] & 0x80) | nivel;
    }

    if (e.lugar !== undefined && !huevo) ponerLugar(v, false, e.lugar);
    if (e.version) datos[0x5f] = e.version;
    const entrenador = String(e.entrenador ?? antes.entrenador).trim();
    if (entrenador && entrenador !== antes.entrenador) escribirTexto(v, 0x68, entrenador, MAX_ENTRENADOR_DS, 8);

    EVS.forEach((o, i) => (datos[o] = Math.max(0, Math.min(252, e.evs[i]))));
    let iv32 = 0;
    BITS_IV.forEach((b, i) => (iv32 |= (Math.max(0, Math.min(31, e.ivs[i])) & 31) << b));
    const mote = huevo ? "" : String(e.mote || "").trim();
    if (huevo) iv32 |= 3 << 30;
    else if (mote) iv32 |= 1 << 31;
    v.setUint32(0x38, iv32 >>> 0, true);

    // El nombre: el mote o, sin él, el de la especie (en gen 4, en mayúsculas, como en el juego)
    if (huevo !== antes.huevo || mote !== antes.mote || e.especie !== antes.especie) {
      const nombre = huevo ? nombreHuevo : mote || nombreEspecie;
      escribirTexto(v, 0x48, gen === 4 && !mote ? nombre.toLocaleUpperCase("es") : nombre, MAX_MOTE_DS, 11);
    }

    datos[0x14] = Math.max(0, Math.min(255, e.amistad));

    e.ataques.forEach((ataque, i) => {
      v.setUint16(0x28 + i * 2, (ataque && ataque.id) || 0, true);
      datos[0x30 + i] = ataque && ataque.id ? ataque.pp : 0;
      datos[0x34 + i] = ataque && ataque.id ? ataque.masPP : 0;
    });

    // El PID: solo cambia si lo que depende de él ya no cuadra
    const pid = v.getUint32(0, true);
    const ids = v.getUint16(0x0c, true) ^ v.getUint16(0x0e, true);
    const hab = e.numHabilidad === 1 ? 0 : e.numHabilidad === 2 ? 1 : undefined;
    const conGenero = generoRatio !== undefined && (genero !== antes.genero || e.especie !== antes.especie);
    const cuadra =
      ((ids ^ (pid >>> 16) ^ (pid & 0xffff)) < 8) === Boolean(e.shiny) &&
      (gen !== 4 || pid % 25 === e.naturaleza) &&
      (hab === undefined || e.numHabilidad === antes.numHabilidad || (gen === 4 ? pid & 1 : (pid >>> 16) & 1) === hab) &&
      (!conGenero || generoDePid(pid, generoRatio) === genero);
    if (!cuadra) {
      v.setUint32(0, buscarPid(ids, {
        shiny: Boolean(e.shiny),
        naturaleza: gen === 4 ? e.naturaleza : undefined,
        hab,
        ...(generoRatio !== undefined ? { generoRatio, genero } : { bajo: pid & 0xff })
      }), true);
    }

    if (datos.length > TAM_POKEMON && base) ponerDatosDeEquipo(datos, base);
    return datos;
  }

  // Nivel, PS (llenos) y estadísticas, que en el equipo van guardados (sin estados)
  function ponerDatosDeEquipo(datos, base) {
    const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
    const e = leerEditable(datos);
    const [ps, ataque, defensa, ataqueEsp, defensaEsp, velocidad] = estadisticas(base, e.nivel, e.naturaleza, e.evs, e.ivs, e.especie);
    v.setUint32(0x88, 0, true);
    datos[0x8c] = e.nivel;
    [ps, ps, ataque, defensa, velocidad, ataqueEsp, defensaEsp].forEach((valor, i) => v.setUint16(0x8e + i * 2, valor, true));
  }

  // De la caja al equipo. plantilla: otro del equipo, del que se copia el final (la carta y los
  // sellos, que en uno de la caja no existen)
  function paraEquipo(crudo, base, plantilla) {
    if (crudo.length > TAM_POKEMON) return crudo;
    const datos = new Uint8Array(gen === 4 ? 0xec : 0xdc);
    if (plantilla && plantilla.length === datos.length) datos.set(plantilla.subarray(0x9c), 0x9c);
    datos.set(crudo);
    ponerDatosDeEquipo(datos, base);
    return datos;
  }

  function paraCaja(crudo) {
    return crudo.slice(0, TAM_POKEMON);
  }

  // Copia con otro PID (para la web, otro Pokémon) y todo lo que depende de él igual
  function conLlaveNueva(crudo) {
    const datos = paraCaja(crudo);
    const v = new DataView(datos.buffer);
    const pid = v.getUint32(0, true);
    const ids = v.getUint16(0x0c, true) ^ v.getUint16(0x0e, true);
    const nuevo = buscarPid(ids, {
      shiny: esShiny(v),
      naturaleza: gen === 4 ? pid % 25 : undefined,
      hab: gen === 5 ? (pid >>> 16) & 1 : undefined,
      bajo: pid & 0xff
    });
    v.setUint32(0, nuevo === pid ? (nuevo ^ 0x100) >>> 0 : nuevo, true);
    return datos;
  }

  // Uno nuevo, de la caja, como si lo hubiera conseguido el entrenador de la partida (de
  // entrenadorDS en ./nds.js) por intercambio hoy
  function crearPokemon(entrenador, editable, opciones) {
    const datos = new Uint8Array(TAM_POKEMON);
    const v = new DataView(datos.buffer);
    v.setUint32(0, ((azar16() << 16) | azar16()) >>> 0, true);
    v.setUint16(0x0c, entrenador.tid, true);
    v.setUint16(0x0e, entrenador.sid, true);
    datos[0x17] = entrenador.idioma;
    datos.set(entrenador.nombre, 0x68);
    ponerFecha(datos, 0x7b, new Date());
    ponerLugar(v, false, lugares.intercambio);
    datos[0x83] = POKE_BALL;
    datos[0x84] = (entrenador.genero ? 0x80 : 0) | Math.max(1, Math.min(100, editable.nivel));
    datos[0x5f] = entrenador.version;
    return aplicarEditable(datos, editable, opciones);
  }

  function esHuevo(crudo) {
    return Boolean((new DataView(crudo.buffer, crudo.byteOffset, crudo.byteLength).getUint32(0x38, true) >>> 30) & 1);
  }

  function especieDe(crudo) {
    return crudo[0x08] | (crudo[0x09] << 8);
  }

  function formaDe(crudo) {
    return formaWeb(especieDe(crudo), crudo[0x40] >> 3);
  }

  return {
    leerEditable, aplicarEditable, crearPokemon, conLlaveNueva, paraEquipo, paraCaja, esHuevo, especieDe, formaDe,
    lugarIntercambio: lugares.intercambio, maxMote: MAX_MOTE_DS, maxEntrenador: MAX_ENTRENADOR_DS
  };
}
