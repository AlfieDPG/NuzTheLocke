// ---------- Crónica de un locke: los números ----------
//
// Con lo que hay en el locke (vidas, muertos, victorias, salón de la fama...) y su actividad
// completa saca el resumen de lo que ha sido: cifras de cada jugador y unos cuantos
// destacados. La ventana y la imagen para compartir están en js/versus/cronica.js.
//
// Las capturas salen de la actividad (cada «ruta» marcada), así que si alguien no marcó sus
// rutas no hay porcentaje de supervivencia para él: no se inventa.

import { muertosDe, victoriasDe, seHaPasadoLaRom, medallasDe, estaEliminado, estadoDe } from "./lockes.js";
import { t, LOCALE } from "./idioma.js";

const DIA = 86400000;

// Los sucesos que salen en la cronología (las rutas y las victorias sueltas serían demasiadas)
export const HITOS = ["creado", "muerte", "vida", "eliminado", "cap", "combate", "rom", "ganador", "infraccion"];

// Cuándo acabó el locke, en milisegundos (la fecha se guarda como «2025-06-01»); null si sigue abierto
export function finDe(locke) {
  if (!locke.fechaFin) return null;
  const fecha = new Date(`${locke.fechaFin}T23:59:59`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
}

function diasEntre(desde, hasta) {
  return Math.max(0, Math.floor((hasta - desde) / DIA));
}

// Día como texto para agrupar («2026-10-12»), en la hora de quien mira
function claveDeDia(milisegundos) {
  const fecha = new Date(milisegundos);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// tiposDe: Map número de especie -> ["fire", "flying"] (de la Pokédex); sin él, no hay «tipo que más ha muerto»
// nombreTipo: id de tipo -> nombre en el idioma de la web
export function calcularCronica(locke, sucesos, tiposDe = new Map(), nombreTipo = (tipo) => tipo) {
  const ahora = finDe(locke) || Date.now();
  const inicio = locke.creado || (sucesos[0] && sucesos[0].cuando) || ahora;
  const lista = sucesos || [];

  const jugadores = (locke.jugadores || [])
    .filter((uid) => estadoDe(locke, uid) === "aceptado")
    .map((uid) => {
      const propios = lista.filter((suceso) => suceso.uid === uid);
      const muertos = muertosDe(locke, uid);
      const capturas = propios.filter((suceso) => suceso.tipo === "ruta").length;
      const salon = (locke.salon || {})[uid];
      const vidas = (locke.vidas || {})[uid] || 0;
      return {
        uid,
        nombre: (locke.nombres || {})[uid] || t("Jugador"),
        foto: (locke.fotos || {})[uid] || "",
        gano: locke.ganador === uid,
        eliminado: estaEliminado(locke, uid),
        vidas: locke.vidasIlimitadas ? null : Math.max(0, vidas),
        vidasIniciales: locke.vidasIlimitadas ? null : locke.vidasIniciales || 0,
        muertos: muertos.length,
        capturas,
        // Qué parte de lo capturado sigue vivo; solo si se marcaron rutas
        supervivencia: capturas > 0 ? Math.max(0, Math.min(100, Math.round(((capturas - muertos.length) / capturas) * 100))) : null,
        victorias: victoriasDe(locke, uid),
        rom: seHaPasadoLaRom(locke, uid),
        medallas: medallasDe(locke, uid).tiene.length,
        infracciones: propios.filter((suceso) => suceso.tipo === "infraccion").length,
        equipo: (salon && salon.pokemon) || [],
        mvp: salon && salon.pokemon ? salon.mvp : -1
      };
    });

  // Todos los muertos, del primero al último, con quién los perdió
  const caidos = jugadores
    .flatMap((jugador) => muertosDe(locke, jugador.uid).map((muerto) => ({ muerto, jugador })))
    .filter(({ muerto }) => muerto.fecha)
    .sort((uno, otro) => uno.muerto.fecha - otro.muerto.fecha);

  const destacados = [];

  if (caidos.length) {
    const { muerto, jugador } = caidos[0];
    const dias = diasEntre(inicio, muerto.fecha);
    destacados.push({
      clave: "primera",
      muerto,
      jugador: jugador.nombre,
      dias
    });
  }

  // La racha más larga sin perder a nadie (del principio al primero, entre dos, y del último al final)
  if (caidos.length) {
    const marcas = [inicio, ...caidos.map(({ muerto }) => muerto.fecha), Math.max(ahora, caidos[caidos.length - 1].muerto.fecha)];
    let mejor = 0;
    for (let i = 1; i < marcas.length; i++) mejor = Math.max(mejor, diasEntre(marcas[i - 1], marcas[i]));
    if (mejor >= 2) destacados.push({ clave: "racha", dias: mejor });
  }

  // El día con más muertes
  const porDia = new Map();
  for (const { muerto } of caidos) {
    const dia = claveDeDia(muerto.fecha);
    porDia.set(dia, { cuando: muerto.fecha, n: (porDia.get(dia) || { n: 0 }).n + 1 });
  }
  const peorDia = [...porDia.values()].sort((uno, otro) => otro.n - uno.n || uno.cuando - otro.cuando)[0];
  if (peorDia && peorDia.n >= 2) destacados.push({ clave: "dia", cuando: peorDia.cuando, n: peorDia.n });

  // El tipo que más ha muerto (cada tipo del Pokémon cuenta)
  if (tiposDe.size) {
    const porTipo = new Map();
    for (const { muerto } of caidos) {
      for (const tipo of tiposDe.get(muerto.especie) || []) porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1);
    }
    const [tipo, n] = [...porTipo.entries()].sort((uno, otro) => otro[1] - uno[1])[0] || [];
    if (tipo && n >= 2) destacados.push({ clave: "tipo", tipo: nombreTipo(tipo), n });
  }

  return {
    inicio,
    fin: finDe(locke),
    dias: Math.max(1, diasEntre(inicio, ahora)),
    caidos: caidos.length,
    jugadores,
    destacados,
    hitos: lista.filter((suceso) => HITOS.includes(suceso.tipo))
  };
}

// La frase de cada destacado (sin formato: sirve para la ventana y para la imagen)
export function textoDestacado(destacado, nombreDelMuerto) {
  switch (destacado.clave) {
    case "primera":
      return destacado.dias
        ? t("El primero en morir: {pokemon}, de {quien}, a los {n} días de empezar", { pokemon: nombreDelMuerto(destacado.muerto), quien: destacado.jugador, n: destacado.dias })
        : t("El primero en morir: {pokemon}, de {quien}, el mismo día de empezar", { pokemon: nombreDelMuerto(destacado.muerto), quien: destacado.jugador });
    case "racha":
      return t("La racha más larga sin que muera nadie: {n} días", { n: destacado.dias });
    case "dia":
      return t("El día más negro: {n} muertes el {fecha}", {
        n: destacado.n,
        fecha: new Date(destacado.cuando).toLocaleDateString(LOCALE, { day: "numeric", month: "long" })
      });
    case "tipo":
      return t("El tipo que más ha muerto: {tipo} ({n})", { tipo: destacado.tipo, n: destacado.n });
    default:
      return "";
  }
}
