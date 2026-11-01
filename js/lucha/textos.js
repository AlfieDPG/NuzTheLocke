// ---------- Lucha: lo que cuenta el motor, en sucesos y frases ----------
//
// El motor de Showdown cuenta el combate en su protocolo («|move|p1a: Garchomp|Earthquake|p2a:
// Gyarados», «|-damage|p2a: Gyarados|61/138»...). Aquí se pasa a sucesos para la pantalla (quién
// sale, quién ataca, cuántos PS le quedan) y a frases en el idioma de la web, escritas aquí (no
// se usa nada de la web de Showdown). Lo que no se reconoce no se cuenta: la pantalla ya enseña
// el cambio (los PS, el estado).
//
//   const lector = crearLector({ miLado: "p1", nombreRival: "Ana" });
//   lector.leer(lineas)   // [{ tipo: "ataque", lado, nombre, ataque, texto, marcas }, ...]
//
// «marcas»: los trozos de la frase que son un ataque, una habilidad, un objeto o un Pokémon (de cada
// lado), para resaltarlos en el registro: [{ texto: "Terremoto", clase: "ataque", en: "Earthquake" }].
//
// Tipos de suceso: cambio (sale un Pokémon), ataque, ps, debilitado, estado, cambios (de
// estadísticas), forma (megaevolución...), eficacia, critico, mega, tera, zeta, dinamax,
// transforma, lado (púas, pantallas... de un lado), campo (Espacio Raro, campos...), clima, turno,
// fin, revela (habilidad u objeto que se ha visto, sin texto) y «mensaje» (solo texto).
//
// Las líneas «|split|p1» van seguidas de dos versiones de la siguiente: la de ese jugador (con sus
// PS exactos) y la de todos (en la 1.ª-3.ª gen, en porcentaje). Se coge la propia para mi lado.

import { t, enIngles } from "../comun/idioma.js";
import { datos, buscarPorNombreIngles } from "../comun/datos.js";
import { tiposEs } from "../comun/tipos.js";

// ---------- Nombres ----------

function traducido(lista, nombre) {
  if (!nombre || !datos || enIngles) return nombre || "";
  const entrada = buscarPorNombreIngles(datos[lista] || [], nombre);
  return (entrada && entrada.es) || nombre;
}

export const nombreAtaque = (nombre) => traducido("ataques", nombre);
export const nombreHabilidad = (nombre) => traducido("habilidades", nombre);
export const nombreObjeto = (nombre) => traducido("objetos", nombre);

const ESTADISTICAS = enIngles
  ? { atk: "Attack", def: "Defense", spa: "Sp. Atk", spd: "Sp. Def", spe: "Speed", accuracy: "accuracy", evasion: "evasiveness" }
  : { atk: "el Ataque", def: "la Defensa", spa: "el Ataque Especial", spd: "la Defensa Especial", spe: "la Velocidad", accuracy: "la Precisión", evasion: "la Evasión" };

// Para las chapitas de la pantalla («Atq +1»)
export const ESTADISTICAS_CORTAS = enIngles
  ? { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", accuracy: "Acc", evasion: "Eva" }
  : { atk: "Atq", def: "Def", spa: "AtE", spd: "DfE", spe: "Vel", accuracy: "Pre", evasion: "Eva" };

export const ESTADOS = {
  brn: { corto: t("QUE"), largo: t("quemado") },
  par: { corto: t("PAR"), largo: t("paralizado") },
  slp: { corto: t("DOR"), largo: t("dormido") },
  frz: { corto: t("CON"), largo: t("congelado") },
  psn: { corto: t("ENV"), largo: t("envenenado") },
  tox: { corto: t("TOX"), largo: t("gravemente envenenado") }
};

const CLIMAS = {
  RainDance: { empieza: t("¡Ha empezado a llover!"), sigue: t("Sigue lloviendo."), acaba: t("Ha dejado de llover.") },
  PrimordialSea: { empieza: t("¡Ha empezado a diluviar!"), sigue: t("Sigue diluviando."), acaba: t("Ha dejado de diluviar.") },
  SunnyDay: { empieza: t("¡El sol pega fuerte!"), sigue: t("El sol sigue pegando fuerte."), acaba: t("El sol ha dejado de pegar fuerte.") },
  DesolateLand: { empieza: t("¡El sol abrasa!"), sigue: t("El sol sigue abrasando."), acaba: t("El sol ya no abrasa.") },
  Sandstorm: { empieza: t("¡Se ha desatado una tormenta de arena!"), sigue: t("La tormenta de arena sigue azotando."), acaba: t("La tormenta de arena ha amainado.") },
  Hail: { empieza: t("¡Ha empezado a granizar!"), sigue: t("Sigue granizando."), acaba: t("Ha dejado de granizar.") },
  Snowscape: { empieza: t("¡Ha empezado a nevar!"), sigue: t("Sigue nevando."), acaba: t("Ha dejado de nevar.") },
  DeltaStream: { empieza: t("¡Unas misteriosas turbulencias protegen a los Pokémon de tipo Volador!"), sigue: "", acaba: t("Las turbulencias han amainado.") }
};

// El clima que hay, para la pantalla (una palabra)
export const NOMBRE_CLIMA = {
  RainDance: t("Lluvia"), PrimordialSea: t("Diluvio"), SunnyDay: t("Sol"), DesolateLand: t("Sol abrasador"),
  Sandstorm: t("Tormenta de arena"), Hail: t("Granizo"), Snowscape: t("Nieve"), DeltaStream: t("Turbulencias")
};

// ---------- Leer el protocolo ----------

// «p2a: Gyarados» -> { lado: "p2", nombre: "Gyarados" }
function quien(ident) {
  const m = /^(p[12])[a-c]?: ?(.*)$/.exec(ident || "");
  return m ? { lado: m[1], nombre: m[2] } : null;
}

// «61/138 par» -> { ps: 61, psMax: 138, estado: "par" }; «0 fnt» -> debilitado
function leerPS(texto) {
  const [ps, estado = ""] = String(texto || "").split(" ");
  const [actual, maximo] = ps.split("/").map(Number);
  return { ps: actual || 0, psMax: maximo || 0, estado: estado === "fnt" ? "" : estado, debilitado: estado === "fnt" || actual === 0 };
}

// «Garchomp, L50, F, shiny» -> { especie, nivel, genero, shiny }
function leerDetalles(texto) {
  const partes = String(texto || "").split(", ");
  const detalles = { especie: partes[0], nivel: 100, genero: "", shiny: false, tera: "" };
  for (const parte of partes.slice(1)) {
    if (/^L\d+$/.test(parte)) detalles.nivel = Number(parte.slice(1));
    else if (parte === "M" || parte === "F") detalles.genero = parte;
    else if (parte === "shiny") detalles.shiny = true;
    else if (parte.startsWith("tera:")) detalles.tera = parte.slice(5);
  }
  return detalles;
}

// «[from] item: Leftovers» -> { tipo: "item", nombre: "Leftovers" }; «[from] psn» -> { tipo: "", nombre: "psn" }
function leerEfecto(texto) {
  if (!texto) return null;
  const m = /^(item|ability|move): ?(.*)$/.exec(texto);
  return m ? { tipo: m[1], nombre: m[2] } : { tipo: "", nombre: texto };
}

// Id de un efecto de lado o de campo: «move: Reflect» -> «reflect», «Stealth Rock» -> «stealthrock»
export function idEfecto(texto) {
  return String(texto || "").replace(/^move: ?/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function partir(linea) {
  const trozos = linea.split("|").slice(1);
  const args = [];
  const kw = {};
  for (const trozo of trozos) {
    const m = /^\[(\w+)\] ?(.*)$/.exec(trozo);
    if (m) kw[m[1]] = m[2];
    else args.push(trozo);
  }
  return { tipo: args[0], args: args.slice(1), kw };
}

// Mayúscula al principio, detrás del «¡» o «¿» si lo hay (el rival va con «el ...»)
function capital(texto) {
  return texto.replace(/^([¡¿]?)(\p{Ll})/u, (todo, signo, letra) => signo + letra.toUpperCase());
}

export function crearLector({ miLado, nombreRival }) {
  // Lo que se va a resaltar de la línea que se está leyendo (se vacía al empezar cada una)
  let marcas = [];
  const marcar = (texto, clase, en = "") => {
    if (texto && !marcas.some((marca) => marca.texto === texto && marca.clase === clase)) marcas.push({ texto, clase, en });
    return texto;
  };
  const ataqueM = (en) => marcar(nombreAtaque(en), "ataque", en);
  const habilidadM = (en) => marcar(nombreHabilidad(en), "habilidad", en);
  const objetoM = (en) => marcar(nombreObjeto(en), "objeto", en);
  const pokemonM = (p) => marcar(p.nombre, p.lado === miLado ? "mio" : "suyo");

  // Nombre de un Pokémon en una frase: el tuyo, tal cual; el del rival, «el Gyarados rival»
  const nombre = (p) => (pokemonM(p), p.lado === miLado ? p.nombre : enIngles ? `the opposing ${p.nombre}` : `el ${p.nombre} rival`);
  // «de» y «a» con su contracción («del Gyarados rival», «al Gyarados rival»)
  const de = (p) => (p.lado !== miLado && !enIngles ? `del ${pokemonM(p)} rival` : `${enIngles ? "" : "de "}${nombre(p)}`);
  const a = (p) => (p.lado !== miLado && !enIngles ? `al ${pokemonM(p)} rival` : `${enIngles ? "" : "a "}${nombre(p)}`);
  const jugador = (lado) => (lado === miLado ? t("Tú") : nombreRival || t("El rival"));
  const huecos = (p, extra = {}) => ({ p: nombre(p), de_p: de(p), a_p: a(p), ...extra });

  function texto(plantilla, p, extra) {
    return capital(t(plantilla, p ? huecos(p, extra) : extra));
  }

  // De dónde viene un daño o una cura con su nombre («los Restos», «Piel Tosca»)
  function fuente(efecto) {
    if (!efecto) return "";
    if (efecto.tipo === "item") return objetoM(efecto.nombre);
    if (efecto.tipo === "ability") return habilidadM(efecto.nombre);
    if (efecto.tipo === "move") return ataqueM(efecto.nombre);
    return ataqueM(efecto.nombre);
  }

  function textoDanio(p, efecto, de2) {
    if (!efecto) return "";
    switch (efecto.nombre) {
      case "psn":
      case "tox": return texto("¡{p} sufre los efectos del veneno!", p);
      case "brn": return texto("¡{p} se resiente de las quemaduras!", p);
      case "Recoil":
      case "recoil": return texto("¡{p} sufre daño por el retroceso!", p);
      case "Sandstorm": return texto("¡La tormenta de arena zarandea {a_p}!", p);
      case "Hail": return texto("¡El granizo golpea {a_p}!", p);
      case "Stealth Rock": return texto("¡Unas piedras puntiagudas hieren {a_p}!", p);
      case "Spikes": return texto("¡{p} se hiere con las púas!", p);
      case "Leech Seed": return texto("¡Las drenadoras restan salud {a_p}!", p);
      case "confusion": return texto("¡Está tan confuso que se hiere a sí mismo!", p);
      case "Curse": return texto("¡{p} sufre la maldición!", p);
      case "Nightmare": return texto("¡{p} tiene pesadillas!", p);
      default: break;
    }
    if (efecto.tipo === "ability" && de2) return texto("¡{p} sufre daño por {cosa} {de_q}!", p, { cosa: fuente(efecto), de_q: de(de2) });
    return texto("¡{p} pierde PS por {cosa}!", p, { cosa: fuente(efecto) });
  }

  function textoCambio(p, cuanto, sube) {
    const stat = ESTADISTICAS[p.stat] || p.stat;
    const pkm = { lado: p.lado, nombre: p.nombre };
    if (cuanto === 0) return texto(sube ? "¡{stat} {de_p} no puede subir más!" : "¡{stat} {de_p} no puede bajar más!", pkm, { stat });
    if (sube) {
      if (cuanto >= 3) return texto("¡{stat} {de_p} subió muchísimo!", pkm, { stat });
      if (cuanto === 2) return texto("¡{stat} {de_p} subió mucho!", pkm, { stat });
      return texto("¡{stat} {de_p} subió!", pkm, { stat });
    }
    if (cuanto >= 3) return texto("¡{stat} {de_p} bajó muchísimo!", pkm, { stat });
    if (cuanto === 2) return texto("¡{stat} {de_p} bajó mucho!", pkm, { stat });
    return texto("¡{stat} {de_p} bajó!", pkm, { stat });
  }

  function textoEstado(p, estado) {
    switch (estado) {
      case "brn": return texto("¡{p} se ha quemado!", p);
      case "par": return texto("¡{p} está paralizado! Quizá no pueda moverse.", p);
      case "slp": return texto("¡{p} se ha dormido!", p);
      case "frz": return texto("¡{p} se ha congelado!", p);
      case "psn": return texto("¡{p} ha sido envenenado!", p);
      case "tox": return texto("¡{p} ha sido gravemente envenenado!", p);
      default: return "";
    }
  }

  function textoCura(p, estado) {
    switch (estado) {
      case "slp": return texto("¡{p} se ha despertado!", p);
      case "frz": return texto("¡{p} se ha descongelado!", p);
      case "par": return texto("¡{p} ya no está paralizado!", p);
      case "brn": return texto("¡{p} ya no está quemado!", p);
      case "psn":
      case "tox": return texto("¡{p} ya no está envenenado!", p);
      default: return "";
    }
  }

  function textoNoPuede(p, motivo) {
    switch (leerEfecto(motivo)?.nombre) {
      case "slp": return texto("{p} está dormido como un tronco.", p);
      case "par": return texto("¡{p} está paralizado! No se puede mover.", p);
      case "frz": return texto("¡{p} está congelado!", p);
      case "flinch": return texto("¡{p} se amedrentó y no pudo moverse!", p);
      case "recharge": return texto("¡{p} necesita recuperarse!", p);
      case "Truant": return texto("{p} está holgazaneando.", p);
      default: return texto("¡{p} no se puede mover!", p);
    }
  }

// Un efecto de un lado del campo (Reflejo, Trampa Rocas...), con su nombre traducido
  function efectoDeLado(texto2) {
    return ataqueM(String(texto2 || "").replace(/^move: ?/, ""));
  }

  let ultimoClima = "";

  // La habilidad o el objeto que una línea deja ver: «-ability|p2a: X|Intimidate», «[from] item:
  // Leftovers», «[from] ability: Rough Skin|[of] p1a: Garchomp» (la habilidad es del [of])
  function revelado(linea) {
    const { tipo, args, kw } = partir(linea);
    const p = quien(args[0]);
    if (tipo === "-ability" && p) return { tipo: "revela", lado: p.lado, nombre: p.nombre, habilidad: args[1] };
    if (tipo === "-item" && p) return { tipo: "revela", lado: p.lado, nombre: p.nombre, objeto: args[1] };
    if (tipo === "-enditem" && p) return { tipo: "revela", lado: p.lado, nombre: p.nombre, objeto: "", usado: args[1] };
    const efecto = leerEfecto(kw.from);
    if (!efecto || !p) return null;
    const de = kw.of ? quien(kw.of) : p;
    if (efecto.tipo === "ability" && de) return { tipo: "revela", lado: de.lado, nombre: de.nombre, habilidad: efecto.nombre };
    if (efecto.tipo === "item") return { tipo: "revela", lado: p.lado, nombre: p.nombre, objeto: efecto.nombre };
    return null;
  }

  // Una línea -> un suceso (o null)
  function leerLinea(linea) {
    const { tipo, args, kw } = partir(linea);
    const p = quien(args[0]);
    switch (tipo) {
      case "switch":
      case "drag":
      case "replace": {
        const detalles = leerDetalles(args[1]);
        const ps = leerPS(args[2]);
        const textoSale = tipo === "drag"
          ? texto("¡{p} fue arrastrado al combate!", p)
          : p.lado === miLado
            ? capital(t("¡Adelante, {nombre}!", { nombre: pokemonM(p) }))
            : capital(t("{jugador} sacó a {nombre}.", { jugador: jugador(p.lado), nombre: pokemonM(p) }));
        return { tipo: "cambio", lado: p.lado, nombre: p.nombre, ...detalles, ...ps, texto: textoSale };
      }
      case "move": {
        const objetivo = quien(args[2]);
        return {
          tipo: "ataque", lado: p.lado, nombre: p.nombre, ataque: args[1], objetivo: objetivo && objetivo.lado,
          texto: texto("¡{p} usó {ataque}!", p, { ataque: ataqueM(args[1]) })
        };
      }
      case "-damage":
      case "-heal":
      case "-sethp": {
        const ps = leerPS(args[1]);
        const efecto = leerEfecto(kw.from);
        let frase = "";
        if (tipo === "-damage") frase = textoDanio(p, efecto, quien(kw.of));
        else if (tipo === "-heal" && efecto) {
          frase = efecto.nombre === "drain"
            ? texto("¡{p} ha absorbido energía!", p)
            : texto("{p} recuperó PS gracias a {cosa}.", p, { cosa: fuente(efecto) });
        }
        return { tipo: "ps", lado: p.lado, nombre: p.nombre, ...ps, danio: tipo === "-damage", texto: frase };
      }
      case "faint":
        return { tipo: "debilitado", lado: p.lado, nombre: p.nombre, texto: texto("¡{p} se debilitó!", p) };
      case "-status":
        return { tipo: "estado", lado: p.lado, nombre: p.nombre, estado: args[1], texto: textoEstado(p, args[1]) };
      case "-curestatus":
        return { tipo: "estado", lado: p.lado, nombre: p.nombre, estado: "", texto: textoCura(p, args[1]) };
      case "-cureteam":
        return { tipo: "mensaje", texto: texto("¡El equipo {de_p} se ha curado de todo!", p) };
      case "-boost":
      case "-unboost": {
        const cuanto = Number(args[2]) || 0;
        const sube = tipo === "-boost";
        return {
          tipo: "cambios", lado: p.lado, nombre: p.nombre, stat: args[1], cuanto: sube ? cuanto : -cuanto,
          texto: textoCambio({ ...p, stat: args[1] }, cuanto, sube)
        };
      }
      case "-setboost":
        return { tipo: "cambios", lado: p.lado, nombre: p.nombre, stat: args[1], fijo: Number(args[2]) || 0, texto: "" };
      case "-clearboost":
      case "-clearallboost":
        return { tipo: "cambios", lado: p && p.lado, nombre: p && p.nombre, limpiar: true, todos: tipo === "-clearallboost", texto: tipo === "-clearallboost" ? t("¡Se han anulado todos los cambios de estadísticas!") : "" };
      case "-supereffective":
        return { tipo: "eficacia", lado: p && p.lado, valor: 2, texto: t("¡Es muy eficaz!") };
      case "-resisted":
        return { tipo: "eficacia", lado: p && p.lado, valor: 0.5, texto: t("No es muy eficaz...") };
      case "-immune":
        return { tipo: "eficacia", lado: p && p.lado, valor: 0, texto: texto("No afecta {a_p}...", p) };
      case "-crit":
        return { tipo: "critico", lado: p && p.lado, texto: t("¡Un golpe crítico!") };
      case "-miss":
        return { tipo: "mensaje", texto: quien(args[1]) ? texto("¡{p} ha evitado el ataque!", quien(args[1])) : t("¡Pero falló!") };
      case "-fail":
        return { tipo: "mensaje", texto: t("¡Pero falló!") };
      case "-ohko":
        return { tipo: "mensaje", texto: t("¡Fulminado de un golpe!") };
      case "-notarget":
        return { tipo: "mensaje", texto: t("¡Pero no había objetivo!") };
      case "-nothing":
        return { tipo: "mensaje", texto: t("¡Pero no pasó nada!") };
      case "cant":
        return { tipo: "mensaje", texto: textoNoPuede(p, args[1]) };
      case "-weather": {
        const clima = args[0];
        if (clima === "none") {
          const antes = CLIMAS[ultimoClima];
          ultimoClima = "";
          return { tipo: "clima", clima: "", texto: antes ? antes.acaba : "" };
        }
        const datosClima = CLIMAS[clima];
        const sigue = kw.upkeep !== undefined;
        ultimoClima = clima;
        return { tipo: "clima", clima, texto: datosClima ? (sigue ? datosClima.sigue : datosClima.empieza) : "" };
      }
      case "-fieldstart":
        return { tipo: "campo", efecto: idEfecto(args[0]), activo: true, texto: texto("¡{efecto} afecta al campo de combate!", null, { efecto: efectoDeLado(args[0]) }) };
      case "-fieldend":
        return { tipo: "campo", efecto: idEfecto(args[0]), activo: false, texto: texto("{efecto} ha dejado de afectar al campo.", null, { efecto: efectoDeLado(args[0]) }) };
      case "-sidestart": {
        const lado = (/^(p[12])/.exec(args[0]) || [])[1];
        const efecto = efectoDeLado(args[1]);
        return {
          tipo: "lado", lado, efecto: idEfecto(args[1]), activo: true,
          texto: lado === miLado ? t("¡{efecto} afecta a tu equipo!", { efecto }) : t("¡{efecto} afecta al equipo de {jugador}!", { efecto, jugador: jugador(lado) })
        };
      }
      case "-sideend": {
        const lado = (/^(p[12])/.exec(args[0]) || [])[1];
        const efecto = efectoDeLado(args[1]);
        return {
          tipo: "lado", lado, efecto: idEfecto(args[1]), activo: false,
          texto: lado === miLado ? t("{efecto} ya no afecta a tu equipo.", { efecto }) : t("{efecto} ya no afecta al equipo de {jugador}.", { efecto, jugador: jugador(lado) })
        };
      }
      case "-swapsideconditions":
        return { tipo: "lado", cambiarLados: true, texto: t("¡Los dos equipos han intercambiado los efectos de su lado del campo!") };
      // Cambios de estadísticas entre dos (Cambiaalmas, Más Psique...) o del revés (Reversión)
      case "-swapboost": {
        const otro = quien(args[1]);
        const stats = (args[2] || "").split(/, ?/).filter(Boolean);
        return { tipo: "cambios", intercambio: { a: p, b: otro, stats }, texto: texto("¡{p} ha intercambiado los cambios de estadísticas con {q}!", p, { q: otro ? nombre(otro) : "" }) };
      }
      case "-copyboost": {
        const otro = quien(args[1]);
        return { tipo: "cambios", copia: { a: p, de: otro }, texto: texto("¡{p} ha copiado los cambios de estadísticas de {q}!", p, { q: otro ? nombre(otro) : "" }) };
      }
      case "-invertboost":
        return { tipo: "cambios", lado: p.lado, nombre: p.nombre, invertir: true, texto: texto("¡Se han invertido los cambios de estadísticas {de_p}!", p) };
      case "-clearnegativeboost":
        return { tipo: "cambios", lado: p.lado, nombre: p.nombre, quitarNegativos: true, texto: texto("¡{p} ha vuelto a la normalidad sus estadísticas bajadas!", p) };
      case "-clearpositiveboost":
        return { tipo: "cambios", lado: p.lado, nombre: p.nombre, quitarPositivos: true, texto: texto("¡Se han anulado las mejoras de estadísticas {de_p}!", p) };
      case "-start": {
        const efecto = leerEfecto(args[1]);
        const cual = efecto ? efecto.nombre : "";
        if (cual === "confusion") return { tipo: "mensaje", texto: texto("¡{p} se ha confundido!", p) };
        if (cual === "Substitute") return { tipo: "mensaje", texto: texto("¡{p} creó un sustituto!", p) };
        if (cual === "Leech Seed") return { tipo: "mensaje", texto: texto("¡{p} ha sido infectado!", p) };
        if (cual === "Dynamax") return { tipo: "dinamax", lado: p.lado, nombre: p.nombre, activo: true, texto: texto("¡{p} se ha dinamaximizado!", p) };
        if (cual === "Taunt") return { tipo: "mensaje", texto: texto("¡{p} se ha dejado engañar por la Mofa!", p) };
        if (cual === "Encore") return { tipo: "mensaje", texto: texto("¡{p} tiene que repetir su ataque!", p) };
        if (cual === "Yawn") return { tipo: "mensaje", texto: texto("¡{p} empieza a tener sueño!", p) };
        if (cual === "Attract") return { tipo: "mensaje", texto: texto("¡{p} se ha enamorado!", p) };
        if (cual === "Focus Energy") return { tipo: "mensaje", texto: texto("¡{p} se está concentrando!", p) };
        if (cual === "Disable") return { tipo: "mensaje", texto: texto("¡Se ha anulado {ataque} {de_p}!", p, { ataque: ataqueM(args[2]) }) };
        if (cual === "typechange") return { tipo: "mensaje", texto: texto("¡{p} ahora es de tipo {tipo}!", p, { tipo: (args[2] || "").split("/").map((tipo2) => tiposEs[tipo2.toLowerCase()] || tipo2).join("/") }) };
        return { tipo: "mensaje", texto: "" };
      }
      case "-end": {
        const efecto = leerEfecto(args[1]);
        const cual = efecto ? efecto.nombre : "";
        if (cual === "confusion") return { tipo: "mensaje", texto: texto("¡{p} ya no está confundido!", p) };
        if (cual === "Substitute") return { tipo: "mensaje", texto: texto("¡El sustituto {de_p} se ha debilitado!", p) };
        if (cual === "Dynamax") return { tipo: "dinamax", lado: p.lado, nombre: p.nombre, activo: false, texto: texto("¡{p} ha vuelto a su tamaño normal!", p) };
        return { tipo: "mensaje", texto: "" };
      }
      case "-activate": {
        const efecto = leerEfecto(args[1]);
        const cual = efecto ? efecto.nombre : "";
        if (cual === "confusion") return { tipo: "mensaje", texto: texto("¡{p} está confundido!", p) };
        if (cual === "Protect" || cual === "Detect" || cual === "King's Shield" || cual === "Spiky Shield" || cual === "Baneful Bunker")
          return { tipo: "mensaje", texto: texto("¡{p} se ha protegido!", p) };
        if (cual === "Substitute") return { tipo: "mensaje", texto: texto("¡El sustituto recibe el daño en lugar {de_p}!", p) };
        if (cual === "Endure") return { tipo: "mensaje", texto: texto("¡{p} ha aguantado el golpe!", p) };
        if (cual === "Focus Sash" || cual === "Sturdy") return { tipo: "mensaje", texto: texto("¡{p} ha resistido gracias a {cosa}!", p, { cosa: fuente(efecto) }) };
        if (cual === "Skill Swap") return { tipo: "mensaje", texto: texto("¡{p} ha intercambiado su habilidad con la del rival!", p) };
        if (cual === "Trick" || cual === "Switcheroo") return { tipo: "mensaje", texto: texto("¡{p} ha intercambiado los objetos!", p) };
        if (cual === "Spite") return { tipo: "mensaje", texto: texto("¡{p} ha perdido PP de su ataque!", p) };
        return { tipo: "mensaje", texto: "" };
      }
      case "-singleturn":
        if (/Protect|Detect/.test(args[1] || "")) return { tipo: "mensaje", texto: texto("¡{p} se está protegiendo!", p) };
        return null;
      case "-ability":
        if (!p) return null;
        return { tipo: "mensaje", aviso: true, texto: texto("{habilidad} {de_p}", p, { habilidad: habilidadM(args[1]) }) };
      case "-item":
        if (!p) return null;
        return { tipo: "mensaje", texto: texto("{p} lleva {objeto}.", p, { objeto: objetoM(args[1]) }) };
      case "-enditem": {
        if (!p) return null;
        const objeto = objetoM(args[1]);
        if (kw.eat !== undefined) return { tipo: "mensaje", texto: texto("¡{p} se ha comido su {objeto}!", p, { objeto }) };
        if (kw.from && /stealeat|move: (Knock Off|Thief|Covet|Trick|Switcheroo)/.test(kw.from)) return { tipo: "mensaje", texto: texto("¡{p} ha perdido su {objeto}!", p, { objeto }) };
        return { tipo: "mensaje", texto: texto("¡{p} ha usado su {objeto}!", p, { objeto }) };
      }
      case "detailschange":
      case "-formechange": {
        const detalles = leerDetalles(args[1]);
        return { tipo: "forma", lado: p.lado, nombre: p.nombre, ...detalles, texto: "" };
      }
      case "-mega":
        return { tipo: "mega", lado: p.lado, nombre: p.nombre, usa: "mega", texto: texto("¡{p} ha megaevolucionado!", p) };
      case "-burst":
        return { tipo: "mega", lado: p.lado, nombre: p.nombre, usa: "ultra", texto: texto("¡{p} ha liberado su Ultraexplosión!", p) };
      case "-primal":
        return { tipo: "mega", lado: p.lado, nombre: p.nombre, texto: texto("¡{p} ha vuelto a su estado primigenio!", p) };
      case "-terastallize":
        return { tipo: "tera", lado: p.lado, nombre: p.nombre, tera: (args[1] || "").toLowerCase(), texto: texto("¡{p} se ha teracristalizado en tipo {tipo}!", p, { tipo: tiposEs[(args[1] || "").toLowerCase()] || args[1] }) };
      case "-zpower":
        return { tipo: "zeta", lado: p.lado, nombre: p.nombre, texto: texto("¡{p} libera todo su poder Z!", p) };
      case "-transform": {
        const otro = quien(args[1]);
        return { tipo: "transforma", lado: p.lado, nombre: p.nombre, objetivo: otro, texto: texto("¡{p} se ha transformado en {q}!", p, { q: otro ? otro.nombre : "" }) };
      }
      case "-prepare":
        return { tipo: "mensaje", texto: texto("{p} está cogiendo fuerzas.", p) };
      case "-mustrecharge":
        return null;
      case "turn":
        return { tipo: "turno", n: Number(args[0]) || 0 };
      case "win":
        return { tipo: "fin", ganador: args[0] };
      case "tie":
        return { tipo: "fin", ganador: "" };
      default:
        return null;
    }
  }

  return {
    leer(lineas) {
      const sucesos = [];
      for (let i = 0; i < lineas.length; i++) {
        let linea = lineas[i];
        const division = /^\|split\|(p[12])$/.exec(linea);
        if (division) {
          // La siguiente, la del jugador; la de después, la de todos
          linea = division[1] === miLado ? lineas[i + 1] : lineas[i + 2];
          i += 2;
        }
        if (!linea || !linea.startsWith("|")) continue;
        try {
          marcas = [];
          const suceso = leerLinea(linea);
          if (suceso && suceso.texto && marcas.length) suceso.marcas = marcas;
          if (suceso) sucesos.push(suceso);
          const revela = revelado(linea);
          if (revela) sucesos.push(revela);
        } catch (error) {
          console.error("Línea del combate sin leer", linea, error);
        }
      }
      return sucesos;
    }
  };
}
