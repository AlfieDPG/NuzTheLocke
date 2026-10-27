// ---------- Logros ----------
//
// Cada logro se consigue solo, al hacer algo en la web: ganar lockes, perder Pokémon,
// guardar equipos, marcar rutas, crear normas... No hay que avisar desde cada sitio: se mira
// lo que ya hay guardado (equipos, lockes, cementerio, rutas, perfil...) cada vez que algo
// cambia, y los que se cumplen se apuntan. Así cuentan también las cosas hechas antes de que
// hubiera logros.
//
// Los conseguidos van en tu perfil (perfiles/{uid}.logros: { idLogro: fecha }), que es lo que
// pueden leer tus amigos en tu ficha. Por eso hace falta sesión para conseguirlos. Una vez
// conseguido no se pierde, aunque luego borres lo que lo dio.
//
// Lo que no deja rastro en ningún sitio (tirar de la ruleta, exportar un equipo...) se cuenta
// en js/comun/contadores.js.
//
// Para añadir uno: una entrada más en LOGROS. «valor» recibe el contexto (ver contexto()) y
// devuelve un número; se consigue al llegar a «meta» (1 si no se dice). NO cambiar los id: son
// los que están guardados en los perfiles.

import { leer, alCambiar } from "./almacen.js";
import { usuarioActual, alCambiarSesion, cuandoEsteSincronizado } from "./nube.js";
import {
  miPerfil, alCambiarMiPerfil, guardarMiPerfil, amigosAceptados, alCambiarAmistades, perfilesDeAmigos, alCambiarPerfilesAmigos
} from "./perfiles.js";
import { misLockes, estadoDe, alCambiarLockes, victoriasDe, combatesDe, estaEliminado } from "./lockes.js";
import { conjuntos } from "./normas.js";
import { contadores } from "./contadores.js";
import { CLAVE_AJUSTES } from "./claves-ajustes.js";
import { icono } from "./iconos.js";
import { escaparHTML } from "./utilidades.js";
import { tiposEs, urlIconoTipo } from "./tipos.js";
import { generoDe } from "./pokemon.js";
import { registrados, TOTAL_ESPECIES } from "./registro.js";
import { t } from "./idioma.js";

export const NIVELES = {
  bronce: t("Bronce"),
  plata: t("Plata"),
  oro: t("Oro"),
  platino: t("Platino")
};

export const CATEGORIAS = [
  { id: "versus", nombre: "Lockes" },
  { id: "cementerio", nombre: "Cementerio" },
  { id: "equipos", nombre: "Equipos" },
  { id: "rutas", nombre: "Rutas y level caps" },
  { id: "personalizados", nombre: "A tu manera" },
  { id: "partida", nombre: "Partida y randomizer" },
  { id: "social", nombre: "Amigos y perfil" },
  { id: "otros", nombre: "Otros" },
  { id: "pokedex", nombre: "Pokédex" },
  { id: "tipos", nombre: "Tipos" },
  { id: "logros", nombre: "Logros" }
].map((categoria) => ({ ...categoria, nombre: t(categoria.nombre) }));

// ---------- Logros de tipo ----------
//
// Uno por tipo: tener en tus equipos guardados 15 Pokémon distintos de ese tipo (cuenta la
// especie, así una Mega no suma otra vez). Cada uno desbloquea el fondo de ese tipo para tu
// tarjeta de «Amigos» (ver fondos.js).

export const POKEMON_POR_TIPO = 15;

const NOMBRES_DE_TIPO = {
  normal: "Gente corriente", fire: "Corazón ardiente", water: "Lobo de mar", grass: "Mano verde",
  electric: "Alto voltaje", ice: "Corazón helado", fighting: "Cinturón negro", poison: "Toxicólogo",
  ground: "Con los pies en la tierra", flying: "Rey de los cielos", psychic: "Mente maestra",
  bug: "Entomólogo", rock: "Duro como una roca", ghost: "Cazafantasmas", dragon: "Domador de dragones",
  dark: "El lado oscuro", steel: "Voluntad de acero", fairy: "Cuento de hadas"
};

// Los de logros que dan los fondos de plata y oro (el de platino, todos)
export const LOGROS_PARA_PLATA = 25;
export const LOGROS_PARA_ORO = 50;

const LOGROS_DE_TIPO = Object.keys(tiposEs).map((tipo) => ({
  id: `t-${tipo}`, categoria: "tipos", nivel: "plata", icono: "pokeball", tipo, fondo: `tipo-${tipo}`,
  nombre: NOMBRES_DE_TIPO[tipo],
  descripcion: t("Ten {n} Pokémon distintos de tipo {tipo} en tus equipos guardados.", { n: POKEMON_POR_TIPO, tipo: tiposEs[tipo] }), traducido: true,
  valor: (c) => (c.especiesPorTipo.get(tipo) || new Set()).size, meta: POKEMON_POR_TIPO
}));

// ---------- Logros de la Pokédex ----------
//
// Registrar es haber tenido ese Pokémon alguna vez (registro.js): en tus equipos, en la
// partida de un locke, en una captura de «Rutas» o en tu cementerio. Cada Eeveelution
// registrada desbloquea su fondo para la tarjeta (fondos.js); las ocho, el de Eevee.

export const EEVEELUTIONS = [
  { especie: "vaporeon", numero: 134, nombre: "Vaporeon", logro: "Espuma de mar" },
  { especie: "jolteon", numero: 135, nombre: "Jolteon", logro: "Pelaje eléctrico" },
  { especie: "flareon", numero: 136, nombre: "Flareon", logro: "Llama interior" },
  { especie: "espeon", numero: 196, nombre: "Espeon", logro: "Sol de mediodía" },
  { especie: "umbreon", numero: 197, nombre: "Umbreon", logro: "Luz de luna" },
  { especie: "leafeon", numero: 470, nombre: "Leafeon", logro: "Hoja perenne" },
  { especie: "glaceon", numero: 471, nombre: "Glaceon", logro: "Polvo de diamante" },
  { especie: "sylveon", numero: 700, nombre: "Sylveon", logro: "Lazo de hada" }
];

const LOGROS_DE_EEVEE = EEVEELUTIONS.map((eevee) => ({
  id: `x-${eevee.especie}`, categoria: "pokedex", nivel: "plata", icono: "pokedex", fondo: `eevee-${eevee.especie}`,
  nombre: eevee.logro, descripcion: t("Registra a {nombre}.", { nombre: eevee.nombre }), traducido: true,
  valor: (c) => c.registrados.has(eevee.numero)
}));

const cuantos = (lista, condicion) => lista.filter(condicion).length;

// Los combates ganados de un locke cuyo marcador es uno de esos («2-0», «3-0»...)
const combatesGanadosCon = (c, marcadores) =>
  c.lockes.reduce((suma, locke) => {
    const resultados = locke.resultados || {};
    return suma + cuantos(combatesDe(locke), (combate) => {
      const resultado = resultados[combate.id] || {};
      return resultado.ganador === c.yo && marcadores.includes(resultado.marcador);
    });
  }, 0);

// La racha más larga de lockes de Versus ganados seguidos (por la fecha en que se cerraron)
function mejorRacha(c) {
  const ordenados = [...c.terminados].sort((uno, otro) =>
    String(uno.fechaFin || "").localeCompare(String(otro.fechaFin || "")) || (uno.creado || 0) - (otro.creado || 0));
  let racha = 0;
  let mejor = 0;
  for (const locke of ordenados) {
    racha = locke.ganador === c.yo ? racha + 1 : 0;
    mejor = Math.max(mejor, racha);
  }
  return mejor;
}

// Las opciones de la ruleta de ejemplo (las de ahora y las de antes): una ruleta con solo esas
// no es «tuya»
const OPCIONES_DE_EJEMPLO = new Set([
  "Caramelo raro", "Objeto a elegir", "Revivir a un Pokémon", "Una vida extra",
  "Captura extra", "MT a elegir", "Cambiar de inicial", "Nada"
]);

const textoOpcion = (opcion) => String(typeof opcion === "string" ? opcion : (opcion && opcion.texto) || "").trim();

// Un participante de un locke apuntado en un palmarés: ¿eres tú? Por tu uid (los que se
// eligen de tus amigos lo llevan) o, en los de antes, por tu nombre
export function soyYo(participante, yo, perfil) {
  if (participante.uid) return participante.uid === yo;
  const nombre = String(participante.nombre || "").trim().toLowerCase();
  return Boolean(nombre) && [perfil.nombre, perfil.mote].some((mio) => String(mio || "").trim().toLowerCase() === nombre);
}

const evsDe = (poke) => ((poke.entreno && poke.entreno.evs) || []).reduce((suma, v) => suma + (Number(v) || 0), 0);

// Un locke apuntado a mano en tu palmarés: ¿era de vidas ilimitadas? Los de antes no lo
// llevan apuntado y se deduce de las vidas de los participantes (igual que en «Amigos»)
function apuntadoIlimitado(ganado) {
  if (typeof ganado.vidasIlimitadas === "boolean") return ganado.vidasIlimitadas;
  const participantes = ganado.participantes || [];
  return participantes.length > 0 && participantes.every((p) => p.vidas === null);
}

export const LOGROS = [
  // ---------- Versus ----------
  { id: "v-primer-locke", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Primeros pasos", descripcion: "Juega tu primer locke.",
    valor: (c) => c.jugados },
  { id: "v-crear", categoria: "versus", nivel: "bronce", icono: "mas",
    nombre: "Anfitrión", descripcion: "Crea un locke.",
    valor: (c) => cuantos(c.lockes, (l) => l.creador === c.yo) },
  { id: "v-con-amigos", categoria: "versus", nivel: "bronce", icono: "amigos",
    nombre: "Cuantos más, mejor", descripcion: "Juega un locke con al menos un amigo.",
    valor: (c) => c.masJugadores >= 2 },
  { id: "v-cuatro", categoria: "versus", nivel: "plata", icono: "amigos",
    nombre: "Todos contra todos", descripcion: "Juega un locke de 4 jugadores o más.",
    valor: (c) => c.masJugadores, meta: 4 },
  { id: "v-terminar", categoria: "versus", nivel: "bronce", icono: "visto",
    nombre: "Hasta el final", descripcion: "Termina un locke.",
    valor: (c) => c.terminados.length + c.apuntados.length + c.participados.length },
  { id: "v-rom", categoria: "versus", nivel: "plata", icono: "mando",
    nombre: "Fin de la partida", descripcion: "Pásate la ROM de un locke.",
    valor: (c) => cuantos(c.lockes, (l) => (l.rom || {})[c.yo]) },
  { id: "v-ilimitadas", categoria: "versus", nivel: "bronce", icono: "corazon",
    nombre: "Sin presión", descripcion: "Juega un locke con vidas ilimitadas.",
    valor: (c) => cuantos(c.lockes, (l) => l.vidasIlimitadas) + cuantos([...c.apuntados, ...c.participados], apuntadoIlimitado) },
  { id: "v-jugar-5", categoria: "versus", nivel: "plata", icono: "espadas",
    nombre: "Veterano", descripcion: "Juega 5 lockes.",
    valor: (c) => c.jugados, meta: 5 },
  { id: "v-jugar-15", categoria: "versus", nivel: "oro", icono: "espadas",
    nombre: "Incansable", descripcion: "Juega 15 lockes.",
    valor: (c) => c.jugados, meta: 15 },
  { id: "v-ganar-1", categoria: "versus", nivel: "bronce", icono: "corona",
    nombre: "¡Campeón!", descripcion: "Gana un locke.",
    valor: (c) => c.ganados },
  { id: "v-ganar-5", categoria: "versus", nivel: "plata", icono: "corona",
    nombre: "Leyenda en ciernes", descripcion: "Gana 5 lockes.",
    valor: (c) => c.ganados, meta: 5 },
  { id: "v-ganar-10", categoria: "versus", nivel: "oro", icono: "corona",
    nombre: "Leyenda", descripcion: "Gana 10 lockes.",
    valor: (c) => c.ganados, meta: 10 },
  { id: "v-ganar-25", categoria: "versus", nivel: "platino", icono: "trofeo",
    nombre: "Maestro Pokémon", descripcion: "Gana 25 lockes.",
    valor: (c) => c.ganados, meta: 25 },
  { id: "v-intocable", categoria: "versus", nivel: "oro", icono: "escudo",
    nombre: "Intocable", descripcion: "Gana un locke sin perder ni una vida.",
    valor: (c) => cuantos(c.mios, (l) => !l.vidasIlimitadas && (l.vidasIniciales || 0) > 0 && c.vidasDe(l) >= l.vidasIniciales) },
  { id: "v-limite", categoria: "versus", nivel: "plata", icono: "corazon",
    nombre: "Al límite", descripcion: "Gana un locke con una sola vida.",
    valor: (c) => cuantos(c.mios, (l) => !l.vidasIlimitadas && c.vidasDe(l) === 1) +
      cuantos(c.apuntados, (g) => !apuntadoIlimitado(g) && c.misVidasEn(g) === 1) },
  { id: "v-victorias-10", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Luchador", descripcion: "Suma 10 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 10 },
  { id: "v-victorias-50", categoria: "versus", nivel: "plata", icono: "espadas",
    nombre: "Guerrero", descripcion: "Suma 50 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 50 },
  { id: "v-victorias-100", categoria: "versus", nivel: "oro", icono: "espadas",
    nombre: "Imparable", descripcion: "Suma 100 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 100 },
  { id: "v-combates-crear", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Al mejor de tres", descripcion: "Crea un locke con combates.",
    valor: (c) => cuantos(c.lockes, (l) => l.creador === c.yo && combatesDe(l).length > 0) },
  { id: "v-combate-ganar", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Primera sangre", descripcion: "Gana un combate de un locke.",
    valor: (c) => c.lockes.reduce((suma, l) => suma + (combatesDe(l).length ? victoriasDe(l, c.yo) : 0), 0) },
  { id: "v-por-los-pelos", categoria: "versus", nivel: "bronce", icono: "corazon",
    nombre: "Por los pelos", descripcion: "Gana un combate en la última ronda (2-1 o 3-2).",
    valor: (c) => combatesGanadosCon(c, ["2-1", "3-2"]) },
  { id: "v-barrida", categoria: "versus", nivel: "plata", icono: "rayo",
    nombre: "Barrida", descripcion: "Gana un combate sin perder ni una ronda (2-0 o 3-0).",
    valor: (c) => combatesGanadosCon(c, ["2-0", "3-0"]) },
  { id: "v-eliminado", categoria: "versus", nivel: "bronce", icono: "calavera",
    nombre: "Game over", descripcion: "Pierde un locke al perder la vida cero.",
    valor: (c) => cuantos(c.lockes, (l) => estaEliminado(l, c.yo)) },
  { id: "v-ganar-cuatro", categoria: "versus", nivel: "oro", icono: "corona",
    nombre: "Rey de la colina", descripcion: "Gana un locke de 4 jugadores o más.",
    valor: (c) => cuantos(c.mios, (l) => c.jugadoresDe(l) >= 4) +
      cuantos(c.apuntados, (g) => (g.participantes || []).length >= 4) },
  { id: "v-racha", categoria: "versus", nivel: "oro", icono: "rayo",
    nombre: "En racha", descripcion: "Gana 3 lockes seguidos.",
    valor: (c) => mejorRacha(c), meta: 3 },
  { id: "v-salon", categoria: "versus", nivel: "bronce", icono: "trofeo",
    nombre: "Salón de la Fama", descripcion: "Apunta tu equipo final en un locke terminado.",
    valor: (c) => c.equiposFinales },
  { id: "v-salon-5", categoria: "versus", nivel: "plata", icono: "trofeo",
    nombre: "Galería de honor", descripcion: "Apunta tu equipo final en 5 lockes.",
    valor: (c) => c.equiposFinales, meta: 5 },
  { id: "v-alineacion", categoria: "versus", nivel: "bronce", icono: "pokeball",
    nombre: "Alineación", descripcion: "Apunta con qué equipo juegas un combate de un locke.",
    valor: (c) => c.combatesConEquipo },
  { id: "v-alineacion-10", categoria: "versus", nivel: "plata", icono: "pokeball",
    nombre: "Director técnico", descripcion: "Apunta tu equipo en 10 combates.",
    valor: (c) => c.combatesConEquipo, meta: 10 },

  // ---------- Cementerio ----------
  { id: "c-primer-muerto", categoria: "cementerio", nivel: "bronce", icono: "calavera",
    nombre: "Descanse en paz", descripcion: "Pierde tu primer Pokémon.",
    valor: (c) => c.muertos.length },
  { id: "c-con-mote", categoria: "cementerio", nivel: "bronce", icono: "etiqueta",
    nombre: "Nunca te olvidaremos", descripcion: "Apunta en el cementerio a un Pokémon con mote.",
    valor: (c) => cuantos(c.muertos, (m) => m.mote) },
  { id: "c-muertos-10", categoria: "cementerio", nivel: "plata", icono: "calavera",
    nombre: "Cementerio lleno", descripcion: "Pierde 10 Pokémon.",
    valor: (c) => c.muertos.length, meta: 10 },
  { id: "c-muertos-50", categoria: "cementerio", nivel: "oro", icono: "calavera",
    nombre: "Sepulturero", descripcion: "Pierde 50 Pokémon.",
    valor: (c) => c.muertos.length, meta: 50 },
  { id: "c-masacre", categoria: "cementerio", nivel: "plata", icono: "calavera",
    nombre: "Masacre", descripcion: "Pierde 6 Pokémon en un mismo locke.",
    valor: (c) => Math.max(0, ...c.lockes.map((l) => c.muertosDe(l).length)), meta: 6 },
  { id: "c-ni-rasguno", categoria: "cementerio", nivel: "oro", icono: "estrella",
    nombre: "Ni un rasguño", descripcion: "Gana un locke sin ningún Pokémon en tu cementerio.",
    valor: (c) => cuantos(c.mios, (l) => c.muertosDe(l).length === 0) },
  { id: "c-muertos-100", categoria: "cementerio", nivel: "platino", icono: "calavera",
    nombre: "Valle de lágrimas", descripcion: "Pierde 100 Pokémon.",
    valor: (c) => c.muertos.length, meta: 100 },
  { id: "c-reaccion", categoria: "cementerio", nivel: "bronce", icono: "corazon",
    nombre: "Presentar respetos", descripcion: "Reacciona a la tumba de un Pokémon de un rival.",
    valor: (c) => c.lockes.reduce((suma, l) => {
      const mios = new Set(c.muertosDe(l).map((m) => m.id));
      return suma + cuantos(Object.entries(l.reacciones || {}), ([idMuerto, porPersona]) => !mios.has(idMuerto) && (porPersona || {})[c.yo]);
    }, 0) },
  { id: "c-llorado", categoria: "cementerio", nivel: "plata", icono: "corazon",
    nombre: "Llorado por todos", descripcion: "Que todos tus rivales reaccionen a la tumba de uno de tus Pokémon.",
    valor: (c) => c.lockes.reduce((suma, l) => {
      const rivales = c.rivalesDe(l);
      if (!rivales.length) return suma;
      return suma + cuantos(c.muertosDe(l), (m) => rivales.every((uid) => ((l.reacciones || {})[m.id] || {})[uid]));
    }, 0) },

  // ---------- Equipos ----------
  { id: "e-primero", categoria: "equipos", nivel: "bronce", icono: "pokeball",
    nombre: "Entrenador", descripcion: "Guarda tu primer equipo.",
    valor: (c) => c.equipos.length },
  { id: "e-cinco", categoria: "equipos", nivel: "plata", icono: "lista",
    nombre: "Estratega", descripcion: "Guarda 5 equipos.",
    valor: (c) => c.equipos.length, meta: 5 },
  { id: "e-quince", categoria: "equipos", nivel: "oro", icono: "lista",
    nombre: "Coleccionista", descripcion: "Guarda 15 equipos.",
    valor: (c) => c.equipos.length, meta: 15 },
  { id: "e-completo", categoria: "equipos", nivel: "bronce", icono: "pokeball",
    nombre: "Equipo al completo", descripcion: "Guarda un equipo de 6 Pokémon.",
    valor: (c) => c.equiposDeSeis.length },
  { id: "e-preparados", categoria: "equipos", nivel: "plata", icono: "espadas",
    nombre: "Bien preparados", descripcion: "Guarda un equipo de 6 con 4 ataques cada uno.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => e.pokemon.every((p) => (p.ataques || []).filter(Boolean).length === 4)) },
  { id: "e-equipados", categoria: "equipos", nivel: "plata", icono: "etiqueta",
    nombre: "Bien equipados", descripcion: "Guarda un equipo de 6 con un objeto cada uno.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => e.pokemon.every((p) => p.objeto)) },
  { id: "e-shiny", categoria: "equipos", nivel: "bronce", icono: "estrella",
    nombre: "Brillante", descripcion: "Guarda un equipo con un Pokémon variocolor.",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.shiny) },
  { id: "e-motes", categoria: "equipos", nivel: "bronce", icono: "lapiz",
    nombre: "Con nombre propio", descripcion: "Guarda un equipo de 3 o más con mote todos.",
    valor: (c) => cuantos(c.equipos, (e) => e.pokemon.length >= 3 && e.pokemon.every((p) => p.mote)) },
  { id: "e-monotipo", categoria: "equipos", nivel: "oro", icono: "escudo",
    nombre: "Monotipo", descripcion: "Guarda un equipo de 6 que compartan un tipo.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => (e.pokemon[0].tipos || []).some((tipo) => e.pokemon.every((p) => (p.tipos || []).includes(tipo)))) },
  { id: "e-forma", categoria: "equipos", nivel: "bronce", icono: "mapa",
    nombre: "Viajero regional", descripcion: "Guarda un equipo con un Pokémon de otra forma (Alola, Mega...).",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.forma) },
  { id: "e-sin-repetir", categoria: "equipos", nivel: "plata", icono: "escudo",
    nombre: "Arcoíris", descripcion: "Guarda un equipo de 6 sin ningún tipo repetido.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => {
      const tipos = e.pokemon.flatMap((p) => p.tipos || []);
      return tipos.length > 0 && new Set(tipos).size === tipos.length;
    }) },
  { id: "e-entreno", categoria: "equipos", nivel: "bronce", icono: "actividad",
    nombre: "Entrenamiento especial", descripcion: "Guarda un equipo con un Pokémon con su nivel, naturaleza, EVs o IVs a medida.",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.entreno) },
  { id: "e-competitivo", categoria: "equipos", nivel: "oro", icono: "trofeo",
    nombre: "Listo para competir", descripcion: "Guarda un equipo de 6 con habilidad, objeto, 4 ataques y todos los EVs repartidos en cada uno.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => e.pokemon.every((p) =>
      p.habilidad && p.objeto && (p.ataques || []).filter(Boolean).length === 4 && evsDe(p) >= 508)) },
  { id: "e-genero", categoria: "equipos", nivel: "bronce", icono: "persona",
    nombre: "¿Chico o chica?", descripcion: "Guarda un equipo eligiendo el género de un Pokémon.",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.genero === "M" || p.genero === "F") },
  { id: "e-rivalidad", categoria: "equipos", nivel: "plata", icono: "persona",
    nombre: "Rivalidad", descripcion: "Guarda un equipo de 6 Pokémon todos del mismo género.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => ["M", "F"].some((g) => e.pokemon.every((p) => generoDe(p) === g))) },
  { id: "e-importar", categoria: "equipos", nivel: "bronce", icono: "importar",
    nombre: "Desde Showdown", descripcion: "Importa un equipo de Showdown.",
    valor: (c) => c.contadores.importar || 0 },
  { id: "e-exportar", categoria: "equipos", nivel: "bronce", icono: "copiar",
    nombre: "Rumbo a Showdown", descripcion: "Exporta un equipo.",
    valor: (c) => c.contadores.exportar || 0 },
  { id: "e-mudanza", categoria: "equipos", nivel: "bronce", icono: "importar",
    nombre: "Mudanza", descripcion: "Importa varios equipos a la vez (la copia de seguridad de Showdown).",
    valor: (c) => c.contadores["importar-varios"] || 0 },
  { id: "e-copia", categoria: "equipos", nivel: "bronce", icono: "copiar",
    nombre: "Copia de seguridad", descripcion: "Exporta todos tus equipos a la vez.",
    valor: (c) => c.contadores["exportar-todos"] || 0 },
  { id: "e-grupo", categoria: "equipos", nivel: "bronce", icono: "carpeta",
    nombre: "Bien ordenado", descripcion: "Mete un equipo en un grupo de «Mis equipos».",
    valor: (c) => c.equiposEnGrupos },
  { id: "e-grupos-10", categoria: "equipos", nivel: "plata", icono: "carpeta",
    nombre: "Archivador", descripcion: "Ten 10 equipos repartidos en 3 grupos o más.",
    valor: (c) => (c.gruposConEquipos >= 3 ? c.equiposEnGrupos : 0), meta: 10 },
  { id: "e-destacar", categoria: "equipos", nivel: "bronce", icono: "estrella",
    nombre: "Escaparate", descripcion: "Destaca un equipo en tu perfil.",
    valor: (c) => (c.perfil.escaparate || []).length },

  // ---------- Rutas y level caps ----------
  { id: "r-primera", categoria: "rutas", nivel: "bronce", icono: "mapa",
    nombre: "Primera captura", descripcion: "Marca tu primer lugar en «Rutas».",
    valor: (c) => c.lugaresMarcados },
  { id: "r-50", categoria: "rutas", nivel: "plata", icono: "mapa",
    nombre: "Explorador", descripcion: "Marca 50 lugares en «Rutas».",
    valor: (c) => c.lugaresMarcados, meta: 50 },
  { id: "r-150", categoria: "rutas", nivel: "oro", icono: "mapa",
    nombre: "Trotamundos", descripcion: "Marca 150 lugares en «Rutas».",
    valor: (c) => c.lugaresMarcados, meta: 150 },
  { id: "r-completo", categoria: "rutas", nivel: "oro", icono: "mapa",
    nombre: "Cartógrafo", descripcion: "Marca todos los lugares de un juego.",
    valor: (c) => c.juegosConTodasLasRutas },
  { id: "r-juegos-5", categoria: "rutas", nivel: "plata", icono: "mapa",
    nombre: "Mochilero", descripcion: "Marca lugares en 5 juegos distintos.",
    valor: (c) => c.juegosConRutas, meta: 5 },
  { id: "r-captura", categoria: "rutas", nivel: "bronce", icono: "pokeball",
    nombre: "Cuaderno de campo", descripcion: "Apunta qué capturaste en un lugar de «Rutas».",
    valor: (c) => c.capturasApuntadas },
  { id: "r-capturas-25", categoria: "rutas", nivel: "plata", icono: "pokeball",
    nombre: "Naturalista", descripcion: "Apunta 25 capturas en «Rutas».",
    valor: (c) => c.capturasApuntadas, meta: 25 },
  { id: "l-primero", categoria: "rutas", nivel: "bronce", icono: "escudo",
    nombre: "Primer combate", descripcion: "Supera tu primer combate en «Level caps».",
    valor: (c) => c.combatesSuperados },
  { id: "l-campeon", categoria: "rutas", nivel: "plata", icono: "corona",
    nombre: "Campeón de la Liga", descripcion: "Supera al Campeón de un juego en «Level caps».",
    valor: (c) => c.campeonesSuperados },
  { id: "l-50", categoria: "rutas", nivel: "plata", icono: "escudo",
    nombre: "Retador", descripcion: "Supera 50 combates en «Level caps».",
    valor: (c) => c.combatesSuperados, meta: 50 },
  { id: "l-campeones-3", categoria: "rutas", nivel: "oro", icono: "corona",
    nombre: "Campeón de campeones", descripcion: "Supera al Campeón de 3 juegos en «Level caps».",
    valor: (c) => c.campeonesSuperados, meta: 3 },
  { id: "l-completo", categoria: "rutas", nivel: "oro", icono: "escudo",
    nombre: "Sin dejar a nadie", descripcion: "Supera todos los combates de un juego.",
    valor: (c) => c.juegosConTodosLosCombates },
  { id: "l-multiplicador", categoria: "rutas", nivel: "bronce", icono: "actividad",
    nombre: "Subir el listón", descripcion: "Cambia el multiplicador de nivel en «Level caps».",
    valor: (c) => cuantos(Object.values(c.multiplicadores), (valor) => valor !== 1) },

  // ---------- Personalizados ----------
  { id: "p-normas", categoria: "personalizados", nivel: "bronce", icono: "libro",
    nombre: "Legislador", descripcion: "Crea un conjunto de normas.",
    valor: (c) => c.normas.length },
  { id: "p-normas-5", categoria: "personalizados", nivel: "plata", icono: "libro",
    nombre: "Código completo", descripcion: "Ten un conjunto con 5 normas o más.",
    valor: (c) => Math.max(0, ...c.normas.map((conjunto) => (conjunto.normas || []).length)), meta: 5 },
  { id: "p-rutas", categoria: "personalizados", nivel: "bronce", icono: "mapa",
    nombre: "Constructor de mundos", descripcion: "Crea unas rutas personalizadas.",
    valor: (c) => c.rutasPropias.length },
  { id: "p-caps", categoria: "personalizados", nivel: "bronce", icono: "escudo",
    nombre: "Diseñador de retos", descripcion: "Crea unos level caps personalizados.",
    valor: (c) => c.capsPropios.length },
  { id: "p-imagen", categoria: "personalizados", nivel: "bronce", icono: "imagen",
    nombre: "Artista", descripcion: "Ponle una imagen personalizada a un entrenador de tus level caps.",
    valor: (c) => cuantos(c.capsPropios.flatMap((lista) => lista.combates || []), (combate) => String(combate.imagen || "").startsWith("data:")) },
  { id: "p-ruleta", categoria: "personalizados", nivel: "bronce", icono: "ruleta",
    nombre: "Crupier", descripcion: "Haz una ruleta con tus propias opciones.",
    valor: (c) => cuantos(c.ruletas, (r) => {
      const textos = (r.opciones || []).map(textoOpcion).filter(Boolean);
      return textos.length >= 2 && textos.some((texto) => !OPCIONES_DE_EJEMPLO.has(texto));
    }) },
  { id: "p-tipo", categoria: "personalizados", nivel: "bronce", icono: "etiqueta",
    nombre: "A mi manera", descripcion: "Crea un tipo de locke propio.",
    valor: (c) => cuantos(c.perfil.tipos || [], (tipo) => tipo.id !== "locke") },
  { id: "p-locke", categoria: "personalizados", nivel: "plata", icono: "mando",
    nombre: "Fan game", descripcion: "Crea un locke con tus normas, rutas o level caps personalizados.",
    valor: (c) => cuantos(c.lockes, (l) => l.creador === c.yo &&
      ((l.normas && l.normas.id && l.normas.id !== "generales") || l.rutasPropias || l.capsPropios)) },

  // ---------- Partida y randomizer ----------
  { id: "z-vincular", categoria: "partida", nivel: "bronce", icono: "enlace",
    nombre: "Conexión establecida", descripcion: "Vincula la partida de un locke.",
    valor: (c) => c.partidas },
  { id: "z-copiar", categoria: "partida", nivel: "bronce", icono: "copiar",
    nombre: "Del juego a la web", descripcion: "Copia el equipo de tu partida a «Mis equipos».",
    valor: (c) => c.contadores["copiar-partida"] || 0 },
  { id: "z-editar", categoria: "partida", nivel: "bronce", icono: "lapiz",
    nombre: "Retoque", descripcion: "Guarda un cambio en tu partida vinculada desde la web.",
    valor: (c) => c.contadores["editar-partida"] || 0 },
  { id: "z-editar-10", categoria: "partida", nivel: "plata", icono: "lapiz",
    nombre: "Editor jefe", descripcion: "Guarda 10 veces cambios en tu partida.",
    valor: (c) => c.contadores["editar-partida"] || 0, meta: 10 },
  { id: "z-bolsa", categoria: "partida", nivel: "bronce", icono: "mochila",
    nombre: "Mochila llena", descripcion: "Cambia los objetos de la bolsa de tu partida.",
    valor: (c) => c.contadores["bolsa-partida"] || 0 },
  { id: "z-randomizar", categoria: "partida", nivel: "bronce", icono: "mezclar",
    nombre: "Dados cargados", descripcion: "Randomiza una ROM.",
    valor: (c) => c.contadores.randomizar || 0 },
  { id: "z-randomizar-locke", categoria: "partida", nivel: "bronce", icono: "mando",
    nombre: "Mismas reglas para todos", descripcion: "Randomiza tu ROM desde un locke.",
    valor: (c) => c.contadores["randomizar-locke"] || 0 },
  { id: "z-randomizar-10", categoria: "partida", nivel: "plata", icono: "mezclar",
    nombre: "Caos organizado", descripcion: "Randomiza 10 ROMs.",
    valor: (c) => c.contadores.randomizar || 0, meta: 10 },
  { id: "z-consolas", categoria: "partida", nivel: "oro", icono: "mando",
    nombre: "Multiconsola", descripcion: "Randomiza juegos de DS, 3DS y Switch.",
    valor: (c) => cuantos(["nds", "3ds", "switch"], (consola) => c.contadores[`randomizar-${consola}`]), meta: 3 },

  // ---------- Amigos y perfil ----------
  { id: "s-amigo", categoria: "social", nivel: "bronce", icono: "amigos",
    nombre: "Compañero de viaje", descripcion: "Haz tu primer amigo.",
    valor: (c) => c.amigos },
  { id: "s-amigos-5", categoria: "social", nivel: "plata", icono: "amigos",
    nombre: "Popular", descripcion: "Ten 5 amigos.",
    valor: (c) => c.amigos, meta: 5 },
  { id: "s-amigos-10", categoria: "social", nivel: "oro", icono: "amigos",
    nombre: "Líder de grupo", descripcion: "Ten 10 amigos.",
    valor: (c) => c.amigos, meta: 10 },
  { id: "s-avatar", categoria: "social", nivel: "bronce", icono: "persona",
    nombre: "Nueva imagen", descripcion: "Ponte un Pokémon o una foto tuya como foto de perfil.",
    valor: (c) => Boolean(c.perfil.avatar) },
  { id: "s-fondo", categoria: "social", nivel: "bronce", icono: "imagen",
    nombre: "De estreno", descripcion: "Ponle un fondo a tu tarjeta de «Amigos».",
    valor: (c) => Boolean(c.perfil.fondo) },
  { id: "s-titulo", categoria: "social", nivel: "bronce", icono: "estrella",
    nombre: "Con título", descripcion: "Ponte el título de un logro en tu perfil.",
    valor: (c) => Boolean(c.perfil.titulo) },
  { id: "s-palmares", categoria: "social", nivel: "bronce", icono: "libro",
    nombre: "Memoria histórica", descripcion: "Apunta a mano en tu palmarés un locke de antes.",
    valor: (c) => c.apuntados.length },
  { id: "s-cronica", categoria: "social", nivel: "plata", icono: "libro",
    nombre: "Cronista", descripcion: "Apunta a mano los combates de un locke de tu palmarés, con quién ganó cada uno.",
    valor: (c) => cuantos(c.apuntados, (g) => (g.combates || []).some((combate) => combate.ganador)) },

  // ---------- Otros ----------
  { id: "o-ruleta", categoria: "otros", nivel: "bronce", icono: "ruleta",
    nombre: "Que decida la suerte", descripcion: "Tira de la ruleta.",
    valor: (c) => c.contadores.ruleta || 0 },
  { id: "o-ruleta-25", categoria: "otros", nivel: "plata", icono: "ruleta",
    nombre: "Jugador empedernido", descripcion: "Tira de la ruleta 25 veces.",
    valor: (c) => c.contadores.ruleta || 0, meta: 25 },
  { id: "o-evoluciones", categoria: "otros", nivel: "bronce", icono: "pokedex",
    nombre: "Investigador", descripcion: "Mira la línea evolutiva de un Pokémon en la Pokédex.",
    valor: (c) => c.contadores.evoluciones || 0 },
  { id: "o-evoluciones-25", categoria: "otros", nivel: "plata", icono: "pokedex",
    nombre: "Profesor Pokémon", descripcion: "Mira 25 líneas evolutivas en la Pokédex.",
    valor: (c) => c.contadores.evoluciones || 0, meta: 25 },
  { id: "o-ayuda", categoria: "otros", nivel: "bronce", icono: "libro",
    nombre: "Curioso", descripcion: "Lee las preguntas frecuentes.",
    valor: (c) => c.contadores.ayuda || 0 },
  { id: "o-calculo", categoria: "otros", nivel: "bronce", icono: "calculadora",
    nombre: "Haciendo números", descripcion: "Calcula el daño de un ataque en la calculadora.",
    valor: (c) => c.contadores.calculos || 0 },
  { id: "o-calculos-50", categoria: "otros", nivel: "plata", icono: "calculadora",
    nombre: "Analista de combate", descripcion: "Haz 50 cálculos distintos en la calculadora.",
    valor: (c) => c.contadores.calculos || 0, meta: 50 },
  { id: "o-ajustes", categoria: "otros", nivel: "bronce", icono: "ajustes",
    nombre: "Cambio de aires", descripcion: "Cambia el tema o el idioma de la web en los ajustes.",
    valor: (c) => Boolean(c.ajustes.tema || c.ajustes.idioma) },

  // ---------- Pokédex ----------
  { id: "x-25", categoria: "pokedex", nivel: "bronce", icono: "pokedex",
    nombre: "Primeras páginas", descripcion: "Registra 25 Pokémon distintos (tenerlos en un equipo, en la partida de un locke, en «Rutas» o en tu cementerio).",
    valor: (c) => c.registrados.size, meta: 25 },
  { id: "x-100", categoria: "pokedex", nivel: "plata", icono: "pokedex",
    nombre: "Pokédex en marcha", descripcion: "Registra 100 Pokémon distintos.",
    valor: (c) => c.registrados.size, meta: 100 },
  { id: "x-250", categoria: "pokedex", nivel: "plata", icono: "pokedex",
    nombre: "Bestiario", descripcion: "Registra 250 Pokémon distintos.",
    valor: (c) => c.registrados.size, meta: 250 },
  { id: "x-500", categoria: "pokedex", nivel: "oro", icono: "pokedex",
    nombre: "Media Pokédex", descripcion: "Registra 500 Pokémon distintos.",
    valor: (c) => c.registrados.size, meta: 500 },
  { id: "x-800", categoria: "pokedex", nivel: "oro", icono: "pokedex",
    nombre: "Enciclopedia andante", descripcion: "Registra 800 Pokémon distintos.",
    valor: (c) => c.registrados.size, meta: 800 },
  { id: "x-todos", categoria: "pokedex", nivel: "platino", icono: "pokeball",
    nombre: "Hazte con todos", descripcion: t("Registra los {n} Pokémon.", { n: TOTAL_ESPECIES }), traducido: true,
    valor: (c) => c.registrados.size, meta: TOTAL_ESPECIES },
  ...LOGROS_DE_EEVEE,
  { id: "x-eeveelutions", categoria: "pokedex", nivel: "oro", icono: "estrella", fondo: "eevee-eevee",
    nombre: "Eeveelución completa", descripcion: "Registra las ocho evoluciones de Eevee.",
    valor: (c) => cuantos(EEVEELUTIONS, (eevee) => c.registrados.has(eevee.numero)), meta: EEVEELUTIONS.length },

  // ---------- Tipos ----------
  ...LOGROS_DE_TIPO,

  // ---------- Logros de logros (se miran los últimos, con los demás ya contados) ----------
  // Cada uno da un fondo de metal para la tarjeta (fondos.js). Los id son los de antes (pedían
  // 30 y 60): así quien ya los tenía los conserva.
  { id: "m-30", categoria: "logros", nivel: "plata", icono: "trofeo", fondo: "plata",
    nombre: "Brillo de plata", descripcion: t("Consigue {n} logros.", { n: LOGROS_PARA_PLATA }), traducido: true,
    valor: (c) => c.conseguidos, meta: LOGROS_PARA_PLATA },
  { id: "m-60", categoria: "logros", nivel: "oro", icono: "trofeo", fondo: "oro",
    nombre: "Toque de oro", descripcion: t("Consigue {n} logros.", { n: LOGROS_PARA_ORO }), traducido: true,
    valor: (c) => c.conseguidos, meta: LOGROS_PARA_ORO },
  { id: "m-todos", categoria: "logros", nivel: "platino", icono: "trofeo", fondo: "platino",
    nombre: "Completista", descripcion: "Consigue todos los demás logros.",
    valor: (c) => c.conseguidos }
];

// Nombres y descripciones, en el idioma de la web (las que llevan números ya lo están: traducido)
for (const logro of LOGROS) {
  logro.nombre = t(logro.nombre);
  if (!logro.traducido) logro.descripcion = t(logro.descripcion);
}

const DE_LOGROS = new Set(LOGROS.filter((logro) => logro.categoria === "logros").map((logro) => logro.id));
LOGROS.find((logro) => logro.id === "m-todos").meta = LOGROS.length - 1;

export function metaDe(logro) {
  return logro.meta || 1;
}

// ---------- Contexto: todo lo que miran los logros ----------

// Las rutas y los level caps de los juegos de la web solo se descargan aquí (para saber si
// un juego está completo)
async function contexto() {
  const usuario = usuarioActual();
  const perfil = miPerfil() || {};
  const yo = usuario ? usuario.uid : null;
  const [{ LUGARES }, { COMBATES }] = await Promise.all([import("../rutas/datos.js"), import("../levelcaps/datos.js")]);

  const lockes = yo ? misLockes() : [];
  const terminados = lockes.filter((locke) => locke.estado === "cerrado");
  const mios = terminados.filter((locke) => locke.ganador === yo); // los que he ganado
  const muertosDe = (locke) => ((locke.muertos || {})[yo]) || [];
  const jugadoresDe = (locke) => (locke.jugadores || []).filter((uid) => estadoDe(locke, uid) === "aceptado").length;

  // Los lockes de tu palmarés que no son de Versus: los que apuntaste a mano (los de antes de
  // la web). Cuentan como jugados y terminados, además de ganados. Los de Versus que ganas
  // también se copian ahí: esos ya están en «lockes» y no se cuentan dos veces.
  const deVersus = new Set(lockes.map((locke) => locke.id));
  const apuntados = (perfil.ganados || []).filter((ganado) => !deVersus.has(ganado.id));
  const misVidasEn = (ganado) => {
    const yoEn = (ganado.participantes || []).find((p) => soyYo(p, yo, perfil));
    return yoEn && typeof yoEn.vidas === "number" ? yoEn.vidas : null;
  };

  // Los que un amigo ha apuntado en su palmarés contigo de participante: también los has
  // jugado y terminado tú, aunque no los ganaras (cada uno una vez)
  const vistos = new Set([...deVersus, ...apuntados.map((ganado) => ganado.id)]);
  const participados = [];
  // Los que jugaste y no ganaste, ya apuntados en tu perfil (de la web, a mano o de un amigo)
  for (const perdido of perfil.perdidos || []) {
    if (vistos.has(perdido.id)) continue;
    vistos.add(perdido.id);
    participados.push(perdido);
  }
  for (const otro of (perfilesDeAmigos() || new Map()).values()) {
    for (const ganado of (otro && otro.ganados) || []) {
      if (vistos.has(ganado.id) || !(ganado.participantes || []).some((p) => soyYo(p, yo, perfil))) continue;
      vistos.add(ganado.id);
      participados.push(ganado);
    }
  }
  const deOtros = [...apuntados, ...participados];

  const equipos = (leer("poketeams-equipos-v1", []) || []).filter((equipo) => Array.isArray(equipo.pokemon));
  const rutasTodas = ((leer("poketeams-rutas-propias-v1", null) || {}).listas) || [];
  const capsTodos = ((leer("poketeams-levelcaps-propios-v1", null) || {}).listas) || [];
  // Qué se capturó en cada lugar: { idJuego: { lugar: captura } } (rutas/capturas.js)
  const capturas = leer("poketeams-capturas-v1", {}) || {};
  const ruletas = ((leer("poketeams-ruletas-v1", null) || {}).ruletas) || [];
  // Equipos en grupos de «Mis equipos» (los de grupos que existen)
  const grupos = new Set((leer("poketeams-grupos-v1", []) || []).map((grupo) => grupo.id));
  const enGrupos = equipos.filter((equipo) => grupos.has(equipo.grupo));

  return {
    yo,
    perfil,
    lockes,
    terminados,
    mios,
    muertosDe,
    jugadoresDe,
    // Los demás que juegan contigo un locke (los que han aceptado)
    rivalesDe: (locke) => (locke.jugadores || []).filter((uid) => uid !== yo && estadoDe(locke, uid) === "aceptado"),
    vidasDe: (locke) => (locke.vidas || {})[yo] || 0,
    apuntados,
    participados,
    // Equipos finales apuntados: en tus lockes (salón) y en los de amigos en los que sales
    equiposFinales: (perfil.salon || []).length + Object.values(perfil.equiposAjenos || {}).filter(Boolean).length,
    misVidasEn,
    jugados: lockes.length + deOtros.length,
    masJugadores: Math.max(0, ...lockes.map(jugadoresDe), ...deOtros.map((ganado) => (ganado.participantes || []).length)),
    muertos: lockes.flatMap(muertosDe),
    ganados: (perfil.ganados || []).length,
    victorias: lockes.reduce((suma, locke) => suma + victoriasDe(locke, yo), 0),
    // Combates en los que has apuntado con qué equipo jugaste
    combatesConEquipo: lockes.reduce((suma, locke) => suma + Object.keys(((locke.equipos || {})[yo]) || {}).length, 0),
    equiposEnGrupos: enGrupos.length,
    gruposConEquipos: new Set(enGrupos.map((equipo) => equipo.grupo)).size,
    amigos: yo ? amigosAceptados().length : 0,
    equipos,
    equiposDeSeis: equipos.filter((equipo) => equipo.pokemon.length === 6),
    pokemonGuardados: equipos.flatMap((equipo) => equipo.pokemon),
    especiesPorTipo: especiesPorTipo(equipos),
    registrados: registrados(lockes.flatMap(muertosDe)),
    normas: conjuntos(),
    rutasPropias: rutasTodas.filter((lista) => !lista.recibido),
    capsPropios: capsTodos.filter((lista) => !lista.recibido),
    multiplicadores: leer("poketeams-levelcaps-multiplicador-v1", {}) || {},
    // Las «sin captura» (rutas/capturas.js) no cuentan
    capturasApuntadas: Object.values(capturas).reduce((suma, delJuego) => suma + Object.values(delJuego || {}).filter((captura) => captura && !captura.fallada).length, 0),
    ruletas,
    // Partidas vinculadas ahora mismo a tus lockes (js/partida/partidas.js)
    partidas: Object.keys(leer("poketeams-partidas-v1", {}) || {}).length,
    ajustes: leer(CLAVE_AJUSTES, {}) || {},
    contadores: contadores(),
    ...progresoRutas(LUGARES, rutasTodas),
    ...progresoCaps(COMBATES, capsTodos)
  };
}

// tipo -> especies distintas (su número) de ese tipo en tus equipos guardados
function especiesPorTipo(equipos) {
  const porTipo = new Map();
  for (const p of equipos.flatMap((equipo) => equipo.pokemon)) {
    if (!p || !p.id) continue;
    for (const tipo of p.tipos || []) {
      if (!porTipo.has(tipo)) porTipo.set(tipo, new Set());
      porTipo.get(tipo).add(p.id);
    }
  }
  return porTipo;
}

// Lugares marcados en total, en cuántos juegos hay alguno, y en cuántos están todos (de 10
// lugares para arriba, para que unas rutas propias de dos lugares no valgan)
function progresoRutas(LUGARES, rutasTodas) {
  const marcadas = leer("poketeams-rutas-v2", {}) || {};
  let lugaresMarcados = 0;
  let juegosConRutas = 0;
  let juegosConTodasLasRutas = 0;

  for (const [idJuego, claves] of Object.entries(marcadas)) {
    lugaresMarcados += (claves || []).length;
    if ((claves || []).length) juegosConRutas++;
    const textos = new Set((claves || []).map((clave) => clave.slice(clave.indexOf(":") + 1)));

    let lugares = [];
    const deLaWeb = LUGARES[idJuego];
    if (deLaWeb) {
      const apartados = deLaWeb.apartados || ["rutas", "ciudades", "postgame", "eventos"].map((clave) => ({ clave }));
      lugares = apartados.flatMap(({ clave }) => deLaWeb[clave] || []);
    } else {
      const propia = rutasTodas.find((lista) => lista.id === idJuego);
      if (propia) lugares = (propia.secciones || []).flatMap((seccion) => seccion.lugares || []);
    }
    if (lugares.length >= 10 && lugares.every((lugar) => textos.has(lugar))) juegosConTodasLasRutas++;
  }
  return { lugaresMarcados, juegosConRutas, juegosConTodasLasRutas };
}

// Combates superados en total, campeones superados y juegos con todos superados (de 8
// combates para arriba). Las claves son las de js/levelcaps/index.js (claveCombate).
function progresoCaps(COMBATES, capsTodos) {
  const superados = leer("poketeams-levelcaps-v2", {}) || {};
  let combatesSuperados = 0;
  let campeonesSuperados = 0;
  let juegosConTodosLosCombates = 0;

  for (const [idJuego, claves] of Object.entries(superados)) {
    const hechos = new Set(claves || []);
    combatesSuperados += hechos.size;

    const propio = capsTodos.find((lista) => lista.id === idJuego);
    const combates = (propio ? propio.combates : COMBATES[idJuego]) || [];
    const clave = (c) => c.id || `${c.etiqueta}|${c.nombre}|${c.lugar || ""}`;

    if (combates.some((c) => c.tipo === "campeon" && hechos.has(clave(c)))) campeonesSuperados++;
    const principales = combates.filter((c) => !c.seccion && (c.etiqueta || c.nombre));
    if (principales.length >= 8 && principales.every((c) => hechos.has(clave(c)))) juegosConTodosLosCombates++;
  }
  return { combatesSuperados, campeonesSuperados, juegosConTodosLosCombates };
}

// Cada logro con lo que lleva: { logro, valor, meta, conseguido (fecha o null) }.
// tengo: los que ya están apuntados en el perfil ({ id: fecha }).
export async function progreso(tengo = (miPerfil() || {}).logros || {}) {
  const ctx = await contexto();
  const filas = LOGROS.filter((logro) => !DE_LOGROS.has(logro.id)).map((logro) => fila(logro, ctx, tengo));
  ctx.conseguidos = filas.filter(hecho).length;

  // Los de logros, de menos a más: cada uno que se cumple cuenta ya para el siguiente
  const deLogros = LOGROS.filter((logro) => DE_LOGROS.has(logro.id)).sort((uno, otro) => metaDe(uno) - metaDe(otro));
  for (const logro of deLogros) {
    const suya = fila(logro, ctx, tengo);
    filas.push(suya);
    if (hecho(suya)) ctx.conseguidos++;
  }
  return filas;
}

const hecho = (cada) => Boolean(cada.conseguido) || cada.valor >= cada.meta;

function fila(logro, ctx, tengo) {
  let valor = 0;
  try {
    valor = Number(logro.valor(ctx)) || 0;
  } catch (error) {
    console.error(`No se ha podido mirar el logro ${logro.id}`, error);
  }
  return { logro, valor, meta: metaDe(logro), conseguido: tengo[logro.id] || null };
}

// ---------- Apuntar los nuevos ----------

const ESPERA = 1500; // ms tras el último cambio (para no mirar diez veces seguidas)
let temporizador = null;
let revisando = false;
let otraVez = false;

function programar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => revisar().catch((error) => console.error("No se han podido mirar los logros", error)), ESPERA);
}

async function revisar() {
  if (revisando) {
    otraVez = true;
    return;
  }
  revisando = true;
  try {
    await cuandoEsteSincronizado(); // si no, se miraría lo del navegador antes de juntarlo con la cuenta
    const perfil = miPerfil();
    if (!usuarioActual() || !perfil) return;

    const tengo = perfil.logros || {};
    const nuevos = (await progreso(tengo)).filter((cada) => !cada.conseguido && hecho(cada));
    if (!nuevos.length) return;

    const ahora = Date.now();
    await guardarMiPerfil(Object.fromEntries(nuevos.map((cada) => [`logros.${cada.logro.id}`, ahora])));
    anunciar(nuevos.map((cada) => cada.logro));
  } finally {
    revisando = false;
    if (otraVez) {
      otraVez = false;
      programar();
    }
  }
}

export function iniciarLogros() {
  alCambiarSesion(programar);
  alCambiarMiPerfil(programar);
  alCambiarLockes(programar);
  alCambiarAmistades(programar);
  alCambiarPerfilesAmigos(programar); // sus palmarés: los lockes en los que sales tú
  alCambiar(programar); // equipos, rutas, normas, contadores...
}

// ---------- Aviso en pantalla ----------
//
// Abajo a la derecha, unos segundos. Si llegan muchos de golpe (la primera vez, con todo lo
// que ya habías hecho), uno solo que lo resume. Pulsándolo se abre «Logros».

let caja = null;

// Los de tipo, con el icono del tipo
export function insignia(logro, conseguido = true) {
  const dibujo = !conseguido
    ? icono("candado")
    : logro.tipo
      ? `<span class="icono icono-tipo-insignia" style="--icono: url(${urlIconoTipo(logro.tipo)})"></span>`
      : icono(logro.icono);
  return `<span class="logro-insignia ${escaparHTML(logro.nivel)} ${conseguido ? "" : "bloqueado"}">${dibujo}</span>`;
}

// Una fanfarria cortita, de consola antigua, hecha por el navegador (sin archivos). Solo deja
// sonar después de que se haya tocado la página: por eso se prepara con el primer clic o tecla.
let audio = null;

function prepararAudio() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!audio && Contexto) audio = new Contexto();
}
for (const evento of ["pointerdown", "keydown"]) addEventListener(evento, prepararAudio, { once: true, capture: true });

function sonar() {
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const inicio = audio.currentTime + 0.03;
  const notas = [[784, 0], [1047, 0.09], [1319, 0.18], [1568, 0.27]]; // sol, do, mi, sol
  notas.forEach(([frecuencia, cuando], i) => {
    const t = inicio + cuando;
    const dura = i === notas.length - 1 ? 0.5 : 0.12;
    const onda = audio.createOscillator();
    const volumen = audio.createGain();
    onda.type = "square";
    onda.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0.0001, t);
    volumen.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    onda.connect(volumen).connect(audio.destination);
    onda.start(t);
    onda.stop(t + dura + 0.02);
  });
}

function anunciar(logros) {
  try {
    sonar();
  } catch (error) {
    console.error(error);
  }
  if (!caja) {
    caja = document.createElement("div");
    caja.className = "avisos-logro";
    document.body.appendChild(caja);
  }

  const avisos = logros.length > 3
    ? [{ html: `${insignia({ nivel: "oro", icono: "trofeo" })}<span><small>${t("¡Logros conseguidos!")}</small><strong>${t("{n} logros nuevos", { n: logros.length })}</strong></span>` }]
    : logros.map((logro) => ({ html: `${insignia(logro)}<span><small>${t("¡Logro conseguido!")}</small><strong>${escaparHTML(logro.nombre)}</strong></span>` }));

  avisos.forEach(({ html }, i) => {
    const aviso = document.createElement("button");
    aviso.className = "aviso-logro";
    aviso.innerHTML = html;
    aviso.addEventListener("click", async () => {
      aviso.remove();
      const { irA } = await import("../navegacion.js");
      irA("logros");
    });
    setTimeout(() => caja.appendChild(aviso), i * 400);
    setTimeout(() => aviso.classList.add("saliendo"), 5000 + i * 400);
    setTimeout(() => aviso.remove(), 5600 + i * 400);
  });
}
