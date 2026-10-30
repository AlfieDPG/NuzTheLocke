// ---------- Randomizar ----------
//
// randomizarROM(bytes, reglas, semilla): la ROM (que se cambia ahí mismo) con las normas de
// ./reglas.js. De momento, Negro 2 / Blanco 2. Cada apartado tiene su propio azar (sembrado con
// la semilla y su nombre): cambiar una norma no cambia lo que sale en los demás.
// Devuelve un resumen sin spoilers: qué se ha tocado, no cómo.

import { RomNDS } from "./rom-nds.js";
import { RomGBA, esRomGBA } from "./rom-gba.js";
import { crearAzar } from "./azar.js";
import { completarReglas } from "./reglas.js";
import { cargarDatosRandomizer, montarDatosRandomizer, clasificarObjetos, deGeneracion } from "./datos.js";
import { TIPOS_ES } from "../comun/tipos.js"; // en español: van dentro del juego
import { ULTIMA_ESPECIE, ULTIMO_ATAQUE, ULTIMA_HABILIDAD, EVO, TIPOS } from "./juego-gen5.js";
import { esGen4 } from "./juego-gen4-ident.js";

// El módulo de cada generación (todos exportan lo mismo): se carga el que toca
async function cargarMotor(rom) {
  if (rom.esSwitch) return rom.juego === "bdsp" ? import("./juego-bdsp.js") : import("./juego-swsh.js");
  if (rom.es3DS) return import("./juego-3ds.js");
  if (rom.esGBA) return import("./juego-gba.js");
  return esGen4(rom) ? import("./juego-gen4.js") : import("./juego-gen5.js");
}

// Legendarios y singulares hasta gen 5
const LEGENDARIOS = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643,
  644, 645, 646, 647, 648, 649
]);
// Habilidades que nunca salen: Superguarda y las que solo funcionan en un Pokémon (Predicción,
// Multitipo, Modo Daruma). Don Floral sí: sin cambiar de forma, sube igual Ataque y Def. Esp. con sol
const HABILIDADES_NUNCA = new Set([25, 59, 121, 161]);
// Las inútiles: Ausente, Inicio Lento, Flaqueza, Zoquete, Rezagado, Recogemiel, Fuga, Iluminación,
// Más, Menos, Compiescolta, Telepatía
const HABILIDADES_MALAS = new Set([54, 112, 129, 103, 100, 118, 50, 35, 57, 58, 132, 140]);
const rango = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, k) => desde + k);
// Forcejeo y los que solo existen en combate: los movimientos Z (7.ª) y los Maxiataques (8.ª, al dinamaxizarse)
const ATAQUES_MALOS = new Set([165, ...rango(622, 658), ...rango(695, 703), 719, ...rango(723, 728), 743, ...rango(757, 774)]);
// Los que acaban el combate o debilitan al que los usa (Remolino, Rugido, Teletransporte, Autodestrucción, Explosión,
// Mismodestino, Canto Mortal, Legado, Deseo Cura y Danza Lunar) y Huida: en el primer combate (la inicial, a nivel 5) y
// en los que el juego hace a su manera (perfil.primerosCombates), el juego se queda a medias si acaba antes de tiempo
const ATAQUES_FIN = new Set([18, 46, 100, 120, 153, 194, 195, 262, 361, 461]);
const HUIDA = 50;
const NIVEL_INICIAL = 5;
const PIEDRAS = [80, 81, 82, 83, 84, 85]; // Solar, Lunar, Fuego, Trueno, Agua, Hoja
const PIEDRAS_EVOLUTIVAS = [...PIEDRAS, 107, 108, 109]; // y Piedra Brillante, Noche y Alba
const CARAMELO_RARO = 50;
const PRECIO_CARAMELO = 10; // en decenas: 100
const NINCADA = 290;
const SHEDINJA = 292;
const MAX_EQUIPO = 6;
// En los claros ocultos solo caben los de antes de gen 5 y estos de Teselia (el juego no admite otros)
const DE_TESELIA_EN_CLAROS = new Set([
  505, 507, 510, 511, 513, 515, 519, 523, 525, 527, 529, 531, 533, 535, 538, 539, 542, 545, 546, 548, 550, 553, 556, 558,
  559, 561, 564, 569, 572, 575, 578, 580, 583, 587, 588, 594, 596, 601, 605, 607, 610, 613, 616, 618, 619, 621, 622, 624,
  626, 628, 630, 631, 632
]);
const BLOQUES_MT_DS = 13; // bytes de compatibilidad con las MT y MO (en Negro 2 y Blanco 2, 95 MT y 6 MO; en la 4.ª generación, 92 y 8)
// Cuántas MT, cuántas MO y cuántas MT más van detrás de las MO (solo Negro y Blanco y su segunda parte)
const bitsMT = (datos) => datos.perfil.bitsMT || { tm: 92, hm: 6, extra: 3 };
const GRUPOS_TUTOR = [15, 17, 13, 15]; // cuántos ataques de cada grupo de tutores (4 bytes cada uno)
// Dónde empieza cada grupo en la lista de ataques de los tutores (que va en otro orden: 13, 15, 15, 17)
const ORDEN_TUTOR = [13, 43, 0, 28];

// ---------- Utilidades ----------

const todas = (datos) => datos.especies.filter(Boolean);

function candidatas(datos, { sinLegendarios }) {
  return todas(datos).filter((e) => !(sinLegendarios && LEGENDARIOS.has(e.id)));
}

// Una especie para sustituir a «original». Con «parecida», de las que más se le acercan en
// estadísticas totales (±10 % y abriendo el margen si hay pocas). evitar: las ya usadas.
function sustituta(azar, original, lista, modo, evitar) {
  const libres = evitar ? lista.filter((e) => !evitar.has(e.id)) : lista;
  const donde = libres.length ? libres : lista;
  if (modo !== "parecida" || !original) return azar.elegir(donde);
  for (let margen = 0.1; margen < 1; margen += 0.05) {
    const cerca = donde.filter((e) => Math.abs(e.total - original.total) <= original.total * margen);
    if (cerca.length >= 5) return azar.elegir(cerca);
  }
  return azar.elegir(donde);
}

function subirNivel(nivel, porcentaje) {
  return porcentaje ? Math.max(1, Math.min(100, Math.round(nivel * (1 + porcentaje / 100)))) : nivel;
}

// La forma final de una especie (al azar entre sus ramas)
function finalDe(azar, datos, id) {
  let actual = datos.especies[id];
  for (let i = 0; i < 4 && actual && actual.evoluciones.length; i++) {
    const evo = azar.elegir(actual.evoluciones);
    const siguiente = datos.especies[evo.especie];
    if (!siguiente) break;
    actual = siguiente;
  }
  return actual;
}

const tieneDosEvoluciones = (datos, e) =>
  !e.previa && e.evoluciones.some((evo) => datos.especies[evo.especie] && datos.especies[evo.especie].evoluciones.length);

// Quién evoluciona de quién, otra vez (tras cambiar las evoluciones)
function recalcularPrevias(datos) {
  for (const e of todas(datos)) e.previa = 0;
  for (const e of todas(datos)) for (const evo of e.evoluciones) if (datos.especies[evo.especie]) datos.especies[evo.especie].previa = e.id;
}

// Recorre cada familia desde la base: hacer(evolución, de quién evoluciona)
function porFamilias(datos, hacer) {
  const vistos = new Set();
  const bajar = (e) => {
    vistos.add(e.id);
    for (const evo of e.evoluciones) {
      const hija = datos.especies[evo.especie];
      if (!hija || vistos.has(hija.id)) continue;
      hacer(hija, e);
      bajar(hija);
    }
  };
  for (const e of todas(datos)) if (!e.previa) bajar(e);
}

const sumar = (lista) => lista.reduce((a, b) => a + b, 0);

// ---------- Estadísticas y tipos ----------

// Las de otra generación (de deGeneracion, en ./datos.js)
function statsDeGeneracion(datos, modernas) {
  for (const e of todas(datos)) {
    const s = modernas[e.id];
    if (!s || !s.every((n) => n > 0 && n <= 255)) continue;
    e.stats = s.slice();
    e.total = sumar(s);
  }
}

// Su total, repartido al azar (con un mínimo en cada una)
function randomizarStats(datos, azar) {
  const MINIMOS = [20, 10, 10, 10, 10, 10];
  for (const e of todas(datos)) {
    if (e.id === SHEDINJA) continue; // 1 PS siempre
    const resto = e.total - sumar(MINIMOS);
    if (resto <= 0) continue;
    const pesos = MINIMOS.map(() => azar.numero() + 0.2);
    const peso = sumar(pesos);
    const stats = MINIMOS.map((m, k) => Math.min(255, m + Math.floor((resto * pesos[k]) / peso)));
    for (let falta = e.total - sumar(stats); falta > 0; ) {
      const k = azar.entero(6);
      if (stats[k] < 255) {
        stats[k]++;
        falta--;
      }
    }
    e.stats = stats;
  }
}

// «familia»: la base saca tipos nuevos y sus evoluciones los heredan (si la evolución ganaba un
// segundo tipo, gana otro al azar). «cualquiera»: cada uno los suyos. Quien tenía dos, sigue con dos.
function randomizarTipos(datos, reglas, azar) {
  const tipos = datos.perfil.tipos || TIPOS;
  const otro = (menos) => azar.elegir(tipos.filter((t) => t !== menos && t));
  const nuevos = (cuantos) => {
    const uno = azar.elegir(tipos.filter(Boolean));
    return cuantos === 2 ? [uno, otro(uno)] : [uno];
  };
  const antes = new Map(todas(datos).map((e) => [e.id, e.tipos.length]));
  for (const e of todas(datos)) if (!reglas.tipos.familia || !e.previa) e.tipos = nuevos(antes.get(e.id));
  if (!reglas.tipos.familia) return;
  porFamilias(datos, (hija, madre) => {
    const ganaUno = antes.get(hija.id) === 2 && madre.tipos.length === 1;
    hija.tipos = ganaUno ? [madre.tipos[0], otro(madre.tipos[0])] : madre.tipos.slice();
  });
}

// ---------- Habilidades ----------

function randomizarHabilidades(datos, reglas, azar) {
  const buenas = [];
  for (let id = 1; id <= (datos.perfil.ultimaHabilidad || ULTIMA_HABILIDAD); id++) {
    if (!HABILIDADES_NUNCA.has(id) && !(datos.perfil.habilidadesNunca || []).includes(id) && !(reglas.habilidades.sinMalas && HABILIDADES_MALAS.has(id))) buenas.push(id);
  }
  for (const e of todas(datos)) {
    const [uno, dos, oculta] = e.habilidades;
    const nueva1 = azar.elegir(buenas);
    let nueva2 = dos && dos !== uno ? azar.elegir(buenas) : 0;
    if (reglas.habilidades.dos && !nueva2) nueva2 = azar.elegir(buenas.filter((h) => h !== nueva1));
    if (nueva2 === nueva1) nueva2 = azar.elegir(buenas.filter((h) => h !== nueva1));
    e.habilidades = [nueva1, nueva2, oculta ? azar.elegir(buenas) : 0];
    // Si no le ha tocado una segunda y no se pide, la repite (así el juego no mira a una vacía)
    if (!e.habilidades[1]) e.habilidades[1] = nueva1;
    if (reglas.habilidades.dos && e.habilidades[1] === nueva1) e.habilidades[1] = azar.elegir(buenas.filter((h) => h !== nueva1));
  }
  // Las evoluciones, las mismas que su base
  if (reglas.habilidades.familia) porFamilias(datos, (hija, madre) => (hija.habilidades = madre.habilidades.slice()));
  // Los de los primeros combates, sin Huida (si les toca, otra al azar)
  for (const id of datos.perfil.primerosCombates || []) {
    const e = datos.especies[id];
    if (e) e.habilidades = e.habilidades.map((h) => (h === HUIDA ? azar.elegir(buenas.filter((x) => x !== HUIDA)) : h));
  }
}

// ---------- Evoluciones ----------

// El nivel al que tiene sentido evolucionar a «destino»: más fuerte, más tarde. Sale del total de
// estadísticas que tenía en el juego (aunque se cambien después): así es siempre el mismo.
function nivelParaEvolucion(destino) {
  return Math.max(18, Math.min(58, Math.round((destino.totalOriginal || destino.total) / 12.5 - 6)));
}

// Cada evolución lleva a otra especie de fuerza parecida a la de antes (con el mismo método).
// Sin legendarios, sin repetir destino, sin bucles y sin pasar de tres fases.
function randomizarEvolucionesAlAzar(datos, azar) {
  const lista = todas(datos).filter((e) => !LEGENDARIOS.has(e.id));
  const hijas = new Map(todas(datos).map((e) => [e.id, []])); // las evoluciones nuevas
  const madre = new Map();
  // Fases por encima (cuántas hay antes) y por debajo (cuántas después)
  const arriba = (id) => (madre.has(id) ? 1 + arriba(madre.get(id)) : 0);
  const abajo = (id) => Math.max(0, ...hijas.get(id).map((h) => 1 + abajo(h)));
  const usadas = new Set();
  const fija = (e, evo) => {
    madre.set(evo.especie, e.id);
    hijas.get(e.id).push(evo.especie);
    usadas.add(evo.especie);
  };
  // Nincada se queda como está (el juego da Shedinja por su cuenta)
  for (const evo of datos.especies[NINCADA].evoluciones) fija(datos.especies[NINCADA], evo);
  for (const e of azar.barajar(todas(datos))) {
    if (e.id === NINCADA) continue;
    for (const evo of e.evoluciones) {
      const antes = datos.especies[evo.especie];
      if (!antes) continue;
      const fases = arriba(e.id);
      const vale = (c) => c.id !== e.id && !madre.has(c.id) && fases + 1 + abajo(c.id) <= 2 && !(fases && esAntepasada(c.id, e.id, madre));
      let posibles = lista.filter((c) => vale(c) && !usadas.has(c.id));
      if (!posibles.length) posibles = lista.filter(vale);
      // Si no hay ninguna que valga (ya tiene dos fases antes), deja de evolucionar
      if (!posibles.length) {
        evo.quitar = true;
        continue;
      }
      evo.especie = sustituta(azar, antes, posibles, "parecida").id;
      fija(e, evo);
    }
    e.evoluciones = e.evoluciones.filter((evo) => !evo.quitar);
  }
  recalcularPrevias(datos);
}

// ¿Es «id» antepasada de «de»?
function esAntepasada(id, de, madre) {
  for (let x = madre.get(de); x; x = madre.get(x)) if (x === id) return true;
  return false;
}

// Métodos de evolución (los números de gen 5; del 28 en adelante, los de 6.ª y 7.ª)
const METODOS_AMISTAD = new Set([EVO.amistad, EVO.amistadDia, EVO.amistadNoche]);
// Los que en un locke no se pueden (o casi): intercambio, belleza (en gen 5 no hay concursos),
// saber un ataque, otro en el equipo, un lugar (25-27), juego al revés (Inkay), afecto (Sylveon),
// un tipo en el equipo (Pancham), lluvia (Sliggo), solo de día o de noche (Tyrunt, Amaura,
// Fomantis), una cumbre (Crabrawler) y, en 8.ª, golpes críticos (Farfetch’d de Galar), perder PS
// (Yamask de Galar) y dar vueltas (Milcery)
const METODOS_COMPLEJOS = new Set([
  EVO.intercambio, EVO.intercambioEspecial, EVO.belleza, EVO.ataque, EVO.otroEnEquipo, 25, 26, 27, 28, 29, 30, 31, 32, 33, 39, 43, 44, 45
]);
// Con un objeto: piedras (también las de solo machos o solo hembras), llevarlo de día o de noche
// e intercambio llevándolo
const METODOS_OBJETO = new Set([EVO.piedra, EVO.piedraMacho, EVO.piedraHembra, EVO.objetoDia, EVO.objetoNoche, EVO.intercambioObjeto]);
// Los que llevan un nivel en el dato
const METODOS_NIVEL = new Set([4, 9, 10, 11, 12, 13, 14, 15, 23, 24, 28, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 46, 47]);
const conGeneros = (e) => e.genero > 0 && e.genero < 254;

// Facilitar evoluciones: la forma de siempre no se quita nunca, se le suma otra.
// · Con objeto: además por nivel, sin el objeto. Las de piedra de solo machos o solo hembras, por
//   nivel con ese género. Con dos destinos (Gloom, Poliwhirl, Clamperl), los machos van al primero
//   y las hembras al segundo.
// · Complejas (y amistad): además por nivel. Las de intercambio llevando un objeto, además
//   subiendo de nivel con él puesto (de día y de noche).
// · Si la especie ya evoluciona por nivel a otra (Slowpoke → Slowking), por amistad; si es cosa de
//   un género (Kirlia → Gallade, Snorunt → Froslass), no se puede. Tampoco si no queda sitio en la
//   tabla (7 evoluciones, 8 en 3DS: Eevee las llena).
// · Bajar niveles, como mucho: 24 la primera de tres fases, 30 las de dos (36 si el destino suma
//   500 o más) y 36 la segunda de tres (45 si suma 600 o más).
function randomizarEvoluciones(datos, reglas) {
  const { dificiles, objetos, niveles } = reglas.evoluciones;
  const cabe = datos.perfil.maxEvoluciones || (datos.perfil.gen >= 6 ? 8 : 7);
  const destino = (evo) => `${evo.especie}/${evo.forma || 0}`;
  // El suyo si ya lo llevaba (Pancham, Sliggo...); si no, el que tiene sentido por la fuerza del destino
  const nivelDe = (evo) => (METODOS_NIVEL.has(evo.metodo) && evo.dato > 0 && evo.dato <= 100 ? evo.dato : nivelParaEvolucion(datos.especies[evo.especie]));
  for (const e of todas(datos)) {
    const originales = e.evoluciones.filter((evo) => datos.especies[evo.especie]);
    const yaLlega = (evo, metodo) => e.evoluciones.some((x) => destino(x) === destino(evo) && (x.metodo === EVO.nivel || x.metodo === metodo));
    const anadir = (evo, metodo, dato) => e.evoluciones.length < cabe && e.evoluciones.push({ ...evo, metodo, dato, nueva: true });
    // ¿Ya evoluciona por nivel a otro? (por nivel de machos no choca con uno de hembras, ni al revés)
    const ocupado = (evo, genero) =>
      e.evoluciones.some((x) => METODOS_NIVEL.has(x.metodo) && destino(x) !== destino(evo) &&
        !(x.metodo === EVO.nivelMacho && genero === "hembra") && !(x.metodo === EVO.nivelHembra && genero === "macho"));
    const porNivel = (evo, genero) => {
      const metodo = genero === "macho" ? EVO.nivelMacho : genero === "hembra" ? EVO.nivelHembra : EVO.nivel;
      if (yaLlega(evo, metodo)) return;
      if (!ocupado(evo, genero)) anadir(evo, metodo, nivelDe(evo));
      else if (!genero && !METODOS_AMISTAD.has(evo.metodo) && !METODOS_NIVEL.has(evo.metodo) && !yaLlega(evo, EVO.amistad)) anadir(evo, EVO.amistad, 0);
    };
    if (objetos) {
      const conObjeto = [];
      for (const evo of originales) if (METODOS_OBJETO.has(evo.metodo) && !conObjeto.some((x) => destino(x) === destino(evo))) conObjeto.push(evo);
      // (en la 3.ª generación no hay evoluciones por nivel de un solo género: el primero por nivel y el otro, por amistad)
      const reparte = conObjeto.length === 2 && conGeneros(e) && !datos.perfil.evoSinNivelGenero;
      conObjeto.forEach((evo, i) => {
        const genero = evo.metodo === EVO.piedraMacho ? "macho" : evo.metodo === EVO.piedraHembra ? "hembra" : reparte ? ["macho", "hembra"][i] : null;
        porNivel(evo, genero);
      });
    }
    if (dificiles) {
      for (const evo of originales) {
        if (evo.metodo === EVO.intercambioObjeto && datos.perfil.evoSinObjetoHora) porNivel(evo, null);
        else if (evo.metodo === EVO.intercambioObjeto) {
          if (e.evoluciones.length + 2 > cabe) continue;
          anadir(evo, EVO.objetoDia, evo.dato);
          anadir(evo, EVO.objetoNoche, evo.dato);
        } else if (METODOS_COMPLEJOS.has(evo.metodo) || METODOS_AMISTAD.has(evo.metodo)) porNivel(evo, null);
      }
    }
  }
  if (niveles) {
    for (const e of todas(datos)) {
      if (LEGENDARIOS.has(e.id)) continue;
      for (const evo of e.evoluciones) {
        const a = datos.especies[evo.especie];
        if (!a || !METODOS_NIVEL.has(evo.metodo) || !evo.dato) continue;
        const fuerza = a.totalOriginal || a.total;
        const tope = e.previa ? (fuerza >= 600 ? 45 : 36) : a.evoluciones.length ? 24 : fuerza >= 500 ? 36 : 30;
        evo.dato = Math.min(evo.dato, tope);
      }
    }
  }
  // Una segunda evolución nunca antes (ni al mismo nivel) que la primera: se mueve la añadida (si
  // es la segunda, más tarde; si es la primera, antes), nunca la del juego
  for (const e of todas(datos)) {
    const previa = e.previa && datos.especies[e.previa];
    if (!previa) continue;
    for (const antes of previa.evoluciones) {
      if (antes.especie !== e.id || !METODOS_NIVEL.has(antes.metodo) || !antes.dato) continue;
      for (const evo of e.evoluciones) {
        if (!METODOS_NIVEL.has(evo.metodo) || !evo.dato || evo.dato > antes.dato) continue;
        if (evo.nueva) evo.dato = Math.min(60, antes.dato + 8);
        else if (antes.nueva) antes.dato = Math.max(1, evo.dato - 8);
      }
    }
  }
}
// ---------- Iniciales ----------

function randomizarIniciales(datos, reglas, azar) {
  const lista = candidatas(datos, { sinLegendarios: true });
  const elegidas = [];
  for (let i = 0; i < 3; i++) {
    // Elegidas a mano: la que se haya puesto (si falta alguna, al azar)
    const aMano = reglas.iniciales.modo === "elegidas" && Number(reglas.iniciales.elegidas[i]);
    if (aMano && datos.especies[aMano]) {
      elegidas.push(aMano);
      continue;
    }
    let posibles = lista.filter((e) => !elegidas.includes(e.id));
    if (reglas.iniciales.modo === "dos-evoluciones") posibles = posibles.filter((e) => tieneDosEvoluciones(datos, e));
    elegidas.push(azar.elegir(posibles).id);
  }
  datos.iniciales = elegidas;
}

// Con ataques aleatorios: las iniciales y los de los primeros combates, hasta nivel 5, sin los que acaban el combate.
// Si les toca uno, otro al azar (que pegue, si el de antes pegaba)
function primerosCombatesSeguros(datos, reglas, azar) {
  const pos = ataquesPosibles(datos);
  const tipo = reglas.ataques.deSuTipo ? reglas.ataques.tipo : 0;
  const pega = (id) => datos.ataques[id] && datos.ataques[id].potencia > 1;
  for (const id of new Set([...(datos.iniciales || []), ...(datos.perfil.primerosCombates || [])])) {
    const e = datos.especies[id];
    const lista = datos.aprende[id] || [];
    const usados = new Set(lista.map(([ataque]) => ataque));
    for (const par of lista) {
      if (!e || par[1] > NIVEL_INICIAL || !ATAQUES_FIN.has(par[0])) continue;
      const debePegar = pega(par[0]);
      let nuevo;
      do nuevo = ataqueAlAzar(azar, e, pos, tipo, usados);
      while (ATAQUES_FIN.has(nuevo.id) || (debePegar && !(nuevo.potencia > 1)));
      par[0] = nuevo.id;
      usados.add(nuevo.id);
    }
  }
}

// ---------- Estáticos e intercambios ----------

// Los tótems de 7.ª generación: otra especie (y otras para sus aliados) y otra aura de entre las que usan los del juego
function randomizarTotems(datos, reglas, azar) {
  const lista = todas(datos);
  const { totems: modo, aliados, aura } = reglas.estaticos;
  const auras = [...new Set(datos.totems.map((t) => t.auraOriginal).filter(Boolean))];
  for (const t of datos.totems) {
    if (t.sinUso) continue;
    if (modo !== "no") t.nueva = sustituta(azar, datos.especies[t.actual], lista, modo).id;
    if (aliados !== "no") for (const a of t.aliados) if (datos.especies[a.actual]) a.nueva = sustituta(azar, datos.especies[a.actual], lista, aliados).id;
    if (aura === "azar" && t.auraOriginal) t.aura = azar.elegir(auras);
  }
}

function randomizarEstaticos(datos, reglas, azar) {
  const lista = todas(datos);
  for (const e of datos.estaticos) {
    if (e.huevo || e.ignorar || e.copiaDe !== undefined) continue; // el huevo que se da en el juego se queda como está
    const original = datos.especies[e.actual];
    // (soloBase: los huevos que se regalan, de una que no venga de otra)
    e.nueva = sustituta(azar, original, e.soloBase ? lista.filter((x) => !x.previa) : lista, reglas.estaticos.modo).id;
  }
  // Los que son el mismo Pokémon que otro, igual que él
  for (const e of datos.estaticos) if (e.copiaDe !== undefined) e.nueva = datos.estaticos[e.copiaDe].nueva;
}

function randomizarIntercambios(datos, reglas, azar, objetos) {
  const lista = todas(datos);
  for (const t of datos.intercambios) {
    if (reglas.intercambios.modo !== "no") {
      t.da = sustituta(azar, datos.especies[t.da], lista, reglas.intercambios.modo).id;
      // Lo que piden, nunca un legendario (sería casi imposible de conseguir)
      if (datos.especies[t.pide]) t.pide = sustituta(azar, datos.especies[t.pide], lista.filter((e) => !LEGENDARIOS.has(e.id)), reglas.intercambios.modo).id;
    }
    if (reglas.intercambios.objetos) t.objeto = azar.elegir(objetos.equipables);
    if (reglas.intercambios.ivs) t.ivs = t.ivs.map(() => azar.entero(32));
  }
}

// ---------- Ataques ----------

// Potencia, precisión y PP de otra generación (de deGeneracion). El tipo también, salvo el hada
// (no existe en gen 5). Los de potencia variable (1 en el juego) y los que nunca fallan (101) se
// quedan así.
function ataquesDeGeneracion(datos, modernos) {
  for (const a of datos.ataques) {
    const m = a && modernos[a.id];
    if (!m) continue;
    const [tipo, , potencia, precision, pp] = m;
    if (TIPOS[tipo]) a.tipo = TIPOS[tipo];
    if (potencia !== null && a.potencia > 1) a.potencia = Math.min(255, potencia);
    if (precision !== null && a.precision <= 100) a.precision = precision;
    if (pp) a.pp = pp;
  }
}

function ataquesPosibles(datos) {
  const porTipo = new Map();
  const sueltos = [];
  for (const a of datos.ataques) {
    if (!a || ATAQUES_MALOS.has(a.id)) continue;
    sueltos.push(a);
    if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, []);
    porTipo.get(a.tipo).push(a);
  }
  return { porTipo, sueltos };
}

// Un ataque al azar, con «tipo» % de que sea de uno de los tipos de la especie
function ataqueAlAzar(azar, especie, pos, tipo, usados) {
  for (let intento = 0; intento < 30; intento++) {
    const deSuTipo = azar.numero() * 100 < tipo;
    const grupo = deSuTipo ? pos.porTipo.get(azar.elegir(especie.tipos)) || pos.sueltos : pos.sueltos;
    const a = azar.elegir(grupo);
    if (!usados.has(a.id)) return a;
  }
  return azar.elegir(pos.sueltos);
}

const MAX_APRENDE = 20;

function randomizarAtaques(datos, reglas, azar) {
  const pos = ataquesPosibles(datos);
  // Cualquiera, todos igual de probables; con «deSuTipo», de sus tipos con esa probabilidad
  const { inicio } = reglas.ataques;
  const tipo = reglas.ataques.deSuTipo ? reglas.ataques.tipo : 0;
  for (const e of todas(datos)) {
    const viejos = datos.aprende[e.id] || [];
    const usados = new Set();
    let nuevos = viejos.map(([, nivel]) => {
      const a = ataqueAlAzar(azar, e, pos, tipo, usados);
      usados.add(a.id);
      return { id: a.id, nivel, potencia: a.potencia };
    });
    // Siempre algo con lo que pegar entre los primeros
    if (nuevos.length && !nuevos.slice(0, 4).some((a) => a.potencia > 1)) {
      const danino = azar.elegir(pos.sueltos.filter((a) => a.potencia > 1 && (!tipo || e.tipos.includes(a.tipo))));
      if (danino) nuevos[0] = { id: danino.id, nivel: nuevos[0].nivel, potencia: danino.potencia };
    }
    // Que empiecen con al menos «inicio» ataques: los que falten, nuevos a nivel 1. Los niveles de
    // la lista no se tocan: sigue aprendiendo en los mismos niveles que en el juego. Sin pasar de
    // MAX_APRENDE en total (o de los que ya tenía, si eran más), por si el juego tiene tope
    if (inicio) {
      let enNivelUno = nuevos.filter((a) => a.nivel <= 1).length;
      const tope = Math.max(MAX_APRENDE, viejos.length);
      while (enNivelUno < inicio && nuevos.length < tope) {
        const a = ataqueAlAzar(azar, e, pos, tipo, new Set(nuevos.map((x) => x.id)));
        nuevos.push({ id: a.id, nivel: 1, potencia: a.potencia });
        enNivelUno++;
      }
    }
    nuevos.sort((a, b) => a.nivel - b.nivel);
    // Los que hacen daño, de más flojo a más fuerte (en los mismos niveles)
    if (reglas.ataques.orden) {
      const sitios = nuevos.map((a, i) => (a.potencia > 1 ? i : -1)).filter((i) => i >= 0);
      const niveles = sitios.map((i) => nuevos[i].nivel);
      const ordenados = sitios.map((i) => nuevos[i]).sort((a, b) => a.potencia - b.potencia);
      sitios.forEach((i, k) => (nuevos[i] = { ...ordenados[k], nivel: niveles[k] }));
    }
    // Y, ya ordenados, que entre los primeros (los que sabe de salida) haya alguno que haga daño
    if (nuevos.length && !nuevos.slice(0, 4).some((a) => a.potencia > 1)) {
      const danino = azar.elegir(pos.sueltos.filter((a) => a.potencia > 1 && (!tipo || e.tipos.includes(a.tipo))));
      if (danino) nuevos[0] = { id: danino.id, nivel: nuevos[0].nivel, potencia: danino.potencia };
    }
    datos.aprende[e.id] = nuevos.map((a) => [a.id, a.nivel]);
  }
}

// Los cuatro últimos que aprende hasta ese nivel (como los salvajes)
function ataquesANivel(aprende, nivel) {
  const ids = [];
  for (const [ataque, n] of aprende || []) {
    if (n > nivel) break;
    if (ids.includes(ataque)) ids.splice(ids.indexOf(ataque), 1);
    ids.push(ataque);
  }
  const cuatro = ids.slice(-4);
  while (cuatro.length < 4) cuatro.push(0);
  return cuatro;
}

// ---------- Salvajes ----------

function randomizarSalvajes(datos, reglas, azar) {
  // (sin los que el juego no deja salir en libertad: Unown en Rojo Fuego y Verde Hoja)
  const nunca = new Set(datos.perfil.sinSalvajes || []);
  const todos = candidatas(datos, reglas.salvajes).filter((e) => !nunca.has(e.id));
  const modo = reglas.salvajes.modo;
  const nivel = reglas.salvajes.nivel;
  for (const area of datos.salvajes) {
    // Los que no pueden salir en esa zona (en la Zona Safari, los que no dejan huir)
    const lista = area.prohibir ? todos.filter((e) => !area.prohibir(e)) : todos;
    // En cada archivo (una ruta), cada especie original pasa a ser otra distinta, igual en todas
    // sus zonas y estaciones. Con «variedad», cada hueco se sortea por separado (como en el Universal Pokémon
    // Randomizer): en una ruta con solo Starly y Bidoof salen tantas especies como huecos, no dos
    const mapa = new Map();
    const usadas = new Set();
    for (const zonas of area.estaciones) {
      for (const { huecos } of zonas) {
        for (const h of huecos) {
          if (h.especie && modo !== "no") {
            if (reglas.salvajes.variedad || !mapa.has(h.especie)) {
              const elegida = sustituta(azar, datos.especies[h.especie], lista, modo, usadas);
              mapa.set(h.especie, elegida);
              usadas.add(elegida.id);
            }
            h.especie = mapa.get(h.especie).id;
            h.forma = 0;
          }
          h.min = subirNivel(h.min, nivel);
          h.max = subirNivel(h.max, nivel);
        }
      }
    }
  }
}

// Los que se ven por el campo (Espada y Escudo): en cada zona, todos la misma especie (una de las que había), con todos
// los climas igual. Así no se puede elegir cuál capturar
function unSoloPorZona(datos, azar) {
  for (const area of datos.salvajes) {
    if (!area.campo) continue;
    const huecos = area.estaciones.flat().flatMap((z) => z.huecos).filter((h) => !h.vacio && h.especie);
    if (!huecos.length) continue;
    const elegida = azar.elegir(huecos);
    for (const h of huecos) {
      h.especie = elegida.especie;
      h.forma = elegida.forma;
    }
  }
}

// Los claros ocultos: cada hueco, otro de los que caben ahí
function randomizarClaros(datos, reglas, azar) {
  const lista = candidatas(datos, reglas.salvajes).filter((e) => e.id <= 493 || DE_TESELIA_EN_CLAROS.has(e.id));
  for (const h of datos.claros.huecos) {
    if (h.especie && datos.especies[h.especie]) h.especie = sustituta(azar, datos.especies[h.especie], lista, reglas.salvajes.modo).id;
  }
}

// Lo que llevan puesto los salvajes: un objeto común y uno raro
function randomizarObjetosSalvajes(datos, azar, objetos) {
  for (const e of todas(datos)) {
    const comun = azar.elegir(objetos.equipables);
    let raro = azar.elegir(objetos.equipables);
    if (raro === comun) raro = azar.elegir(objetos.equipables);
    e.objetos = [comun, raro, e.objetos[2]];
  }
}

// ---------- Entrenadores ----------

// De qué grupo es cada entrenador: «lideres» (gimnasios, Alto Mando, campeón...), «rivales» (los
// demás importantes) o «normales»
function grupoDe(datos, t) {
  if (!t.importante) return "normales";
  return (datos.perfil.lideres || []).includes(t.indice) ? "lideres" : "rivales";
}

const delGrupo = (quienes, datos, t) => (quienes || []).includes(grupoDe(datos, t));

// El primer combate contra el rival (solo tienes la inicial): a nivel 5 como mucho
const NIVEL_PRIMER_COMBATE = 5;

// Las tres líneas de iniciales: especie -> { cual (0, 1 o 2), fase (0, 1 o 2) }
function lineasIniciales(datos, iniciales) {
  const lineas = new Map();
  iniciales.forEach((base, cual) => {
    let id = base;
    for (let fase = 0; fase < 3 && id; fase++) {
      lineas.set(id, { cual, fase });
      id = (datos.especies[id] && datos.especies[id].evoluciones[0] && datos.especies[id].evoluciones[0].especie) || 0;
    }
  });
  return lineas;
}

function inicialEnFase(datos, iniciales, cual, fase) {
  let id = iniciales[cual];
  for (let i = 0; i < fase && datos.especies[id] && datos.especies[id].evoluciones.length; i++) id = datos.especies[id].evoluciones[0].especie;
  return id;
}

// lineas: las de las iniciales de antes de randomizar (de lineasIniciales), para el rival
function randomizarEntrenadores(datos, reglas, azar, lineas, objetos, azarJefes) {
  const r = reglas.entrenadores;
  const lista = candidatas(datos, r);
  // Los Pokémon que se añaden, de fuerza parecida al último (o cualquiera, si así se pide)
  const modoExtra = r.modo === "cualquiera" ? "cualquiera" : "parecida";
  // Líderes y Alto Mando de un tipo: un tipo al azar para cada gimnasio y cada uno del Alto Mando
  const tipoDe = new Map();
  if (r.modo !== "no" && r.lideresTipo) {
    for (const grupo of datos.perfil.grupos) {
      const tipo = azarJefes.elegir(datos.perfil.tipos || TIPOS);
      for (const i of grupo) tipoDe.set(i, tipo);
    }
  }
  const delTipo = new Map((datos.perfil.tipos || TIPOS).filter(Boolean).map((tipo) => [tipo, lista.filter((e) => e.tipos.includes(tipo))]));

  for (const t of datos.entrenadores) {
    const suyos = tipoDe.has(t.indice) ? delTipo.get(tipoDe.get(t.indice)) : lista;
    const primerCombate = grupoDe(datos, t) === "rivales" && t.pokemon.length &&
      t.pokemon.every((poke) => poke.nivel <= NIVEL_PRIMER_COMBATE);
    for (const poke of t.pokemon) {
      const linea = lineas.get(poke.especie);
      if (linea) {
        poke.especie = inicialEnFase(datos, datos.iniciales, linea.cual, linea.fase);
        poke.forma = 0;
        poke.cambiado = true;
      } else if (r.modo !== "no" && datos.especies[poke.especie]) {
        poke.especie = sustituta(azar, datos.especies[poke.especie], suyos, r.modo).id;
        poke.forma = 0;
        poke.cambiado = true;
      }
      poke.nivel = subirNivel(poke.nivel, r.nivel);
    }

    const anadir = () => {
      const ultimo = t.pokemon[t.pokemon.length - 1];
      const nuevo = sustituta(azar, datos.especies[ultimo.especie], suyos, modoExtra);
      t.pokemon.push({ ...ultimo, especie: nuevo.id, forma: 0, habilidad: 0, objeto: 0, ataques: [0, 0, 0, 0], cambiado: true });
    };

    // Pokémon extra (hasta seis en total), con el nivel del último. El primer combate contra el
    // rival, no: tú solo tienes un Pokémon
    if (delGrupo(r.extras, datos, t) && !primerCombate) {
      for (let k = 0; k < r.cuantos && t.pokemon.length && t.pokemon.length < MAX_EQUIPO; k++) anadir();
    }

    // Todos los combates dobles: los de un solo Pokémon, uno más
    if (r.dobles && t.combate === 0 && !datos.perfil.sinDobles.includes(t.indice) && t.pokemon.length) {
      t.combate = 1;
      if (t.pokemon.length === 1) anadir();
    }

    // Completamente evolucionados a partir de cierto nivel
    if (r.evolucionados) {
      for (const poke of t.pokemon) {
        const e = datos.especies[poke.especie];
        if (poke.nivel >= r.nivelEvolucionados && e && e.evoluciones.length) {
          poke.especie = finalDe(azar, datos, poke.especie).id;
          poke.cambiado = true;
        }
      }
    }

    // El que cambia de especie, con su habilidad al azar (la de la ranura de antes podría no existir)
    for (const poke of t.pokemon) if (poke.cambiado) poke.habilidad = 0;

    // Objetos
    if (delGrupo(r.objetos, datos, t)) {
      t.conObjetos = true;
      for (const poke of t.pokemon) if (!poke.objeto) poke.objeto = azar.elegir(objetos.equipables);
    }

    // Ataques propios: los que tendría cada uno a su nivel
    if (t.conAtaques) {
      for (const poke of t.pokemon) {
        if (!(poke.cambiado || r.nivel || reglas.ataques.modo !== "no")) continue;
        poke.ataques = ataquesANivel(datos.aprende[poke.especie], poke.nivel);
        // Con al menos uno que haga daño (si no, el último sale por otro que sí, de los que aprende)
        const daña = (id) => datos.ataques[id] && datos.ataques[id].potencia > 1;
        if (reglas.ataques.modo !== "no" && poke.ataques.some(Boolean) && !poke.ataques.some(daña)) {
          const otro = (datos.aprende[poke.especie] || []).find(([id]) => daña(id));
          if (otro) poke.ataques[Math.max(0, poke.ataques.filter(Boolean).length - 1)] = otro[0];
        }
      }
    }
  }
}

// Nombres al azar: los de los entrenadores normales, barajados entre ellos; y los de las clases
// que no usa ningún importante, también
function barajarNombres(datos, textos, azar) {
  const normales = datos.entrenadores.filter((t) => !t.importante && textos.nombres[t.indice]).map((t) => t.indice);
  azar.barajar(normales.map((i) => textos.nombres[i])).forEach((nombre, k) => (textos.nombres[normales[k]] = nombre));
  const deImportantes = new Set(datos.entrenadores.filter((t) => t.importante).map((t) => t.clase));
  const usadas = [...new Set(datos.entrenadores.map((t) => t.clase))].filter((c) => !deImportantes.has(c) && textos.clases[c]);
  azar.barajar(usadas.map((c) => textos.clases[c])).forEach((nombre, k) => (textos.clases[usadas[k]] = nombre));
}

// ---------- MT y tutores ----------

// Un byte de compatibilidad con «cuantos» bits útiles
function ponerBits(datos, cuantos, valor) {
  const bytes = new Uint8Array(Math.ceil(cuantos / 8));
  for (let i = 0; i < cuantos; i++) if (valor(i)) bytes[i >> 3] |= 1 << (i & 7);
  return bytes;
}

// Cara o cruz (50 %); con «deSuTipo», los ataques de sus tipos con «tipo» % (nunca menos de 50)
function aprendeAlAzar(azar, e, ataque, { deSuTipo, tipo }) {
  const suyo = deSuTipo && ataque && e.tipos.includes(ataque.tipo);
  return azar.numero() * 100 < (suyo ? Math.max(tipo, 50) : 50);
}

function compatibilidad(datos, parte, reglas, azar, ataqueDe) {
  for (const e of todas(datos)) {
    if (parte === "mt") {
      const bloques = datos.perfil.bloquesMT || BLOQUES_MT_DS;
      const bits = ponerBits(datos, bloques * 8, (i) => {
        if (reglas.mt.compat === "total") return true; // todas, las MO también
        return aprendeAlAzar(azar, e, ataqueDe(i), reglas.mt);
      });
      // Las MO (las que van detrás de las MT) no se tocan salvo en «total»
      const { tm, hm } = bitsMT(datos);
      if (reglas.mt.compat !== "total") for (let i = tm; i < tm + hm; i++) bits[i >> 3] = (bits[i >> 3] & ~(1 << (i & 7))) | (e.mt[i >> 3] & (1 << (i & 7)));
      e.mt = bits.slice(0, bloques);
    } else if (datos.perfil.tutorInfo) {
      // 4.ª generación: un solo bloque de bits, uno por tutor; los fijos (Golpe Cabeza) se quedan como están
      const { cuantos, bytes: largo, fijos } = datos.perfil.tutorInfo;
      const bits = ponerBits(datos, cuantos, (k) => {
        if (fijos.includes(k)) return e.tutor[k >> 3] & (1 << (k & 7));
        if (reglas.tutores.compat === "total") return true;
        return aprendeAlAzar(azar, e, ataqueDe(k), reglas.tutores);
      });
      const bytes = new Uint8Array(largo);
      bytes.set(bits.slice(0, largo));
      e.tutor = bytes;
    } else {
      const bytes = new Uint8Array(16);
      GRUPOS_TUTOR.forEach((cuantos, g) => {
        const fila = ponerBits(datos, cuantos, (b) => {
          if (reglas.tutores.compat === "total") return true;
          return aprendeAlAzar(azar, e, ataqueDe(ORDEN_TUTOR[g] + b), reglas.tutores);
        });
        bytes.set(fila, g * 4);
      });
      e.tutor = bytes;
    }
  }
}

// ---------- Objetos ----------

// Los números de objeto de las MT (sin las MO): 92 seguidas desde el 328 y, si las hay, las que van aparte
function objetosMT(datos) {
  if (datos.perfil.mtItems) return datos.perfil.mtItems;
  const { tm, extra } = bitsMT(datos);
  const rango = (desde, cuantos) => Array.from({ length: cuantos }, (_, k) => desde + k);
  return [...rango(328, Math.min(tm, 92)), ...rango(618, extra || 0)];
}

// MT al azar sin repetir hasta que salgan todas (luego vuelve a empezar)
function sacoDeMT(azar, mts) {
  let quedan = [];
  return () => {
    if (!quedan.length) quedan = azar.barajar(mts);
    return quedan.pop();
  };
}

// Lo que hay por el camino (como el UPR): donde había una MT, otra MT, sin repetir mientras se pueda; en
// cualquier otro sitio, cualquier objeto que no sea MT (así hay las mismas MT que en el juego), menos los
// clave (los de la historia, que ni salen ni se mueven) y, si se pide, los inútiles
function randomizarObjetosSuelo(datos, reglas, azar, objetos) {
  const mts = objetosMT(datos);
  const esMT = new Set(mts);
  const otraMT = sacoDeMT(azar, mts);
  const lista = objetos.usables.filter((id) => !(reglas.objetos.sinMalos && objetos.malos.has(id)));
  for (const o of datos.objetosSuelo) {
    const actual = objetos.categoria(o.objeto);
    if (!actual || objetos.clave(o.objeto) || actual === "plot-advancement" || actual === "event-items" || actual === "gameplay") continue;
    if (actual === "all-machines") {
      // Las MO no se mueven
      if (esMT.has(o.objeto)) o.objeto = otraMT();
      continue;
    }
    o.objeto = azar.elegir(lista);
  }
}

// Las tiendas especiales de la historia y las de MT (las normales no se tocan). Donde se vendía una
// MT, otra MT (sin repetir en la misma tienda); lo demás, cualquier objeto que no sea MT
function randomizarTiendas(datos, reglas, azar, objetos) {
  const mts = objetosMT(datos);
  const esMT = new Set(mts);
  // Sin lo que ya venden las tiendas normales, si se pide
  const normales = new Set(reglas.objetos.sinNormales ? datos.tiendas.filter((t) => datos.perfil.tiendas.normales.includes(t.indice)).flatMap((t) => t.objetos) : []);
  const lista = objetos.usables.filter((id) => !(reglas.objetos.sinMalos && objetos.malos.has(id)) && !normales.has(id));
  for (const t of datos.tiendas) {
    if (datos.perfil.tiendas.normales.includes(t.indice)) continue;
    const otraMT = sacoDeMT(azar, mts);
    // (los huecos libres, 0, se quedan libres)
    t.objetos = t.objetos.map((id) => (!id ? 0 : esMT.has(id) ? otraMT() : azar.elegir(lista)));
  }
}

// Que estos objetos se vendan en alguna tienda especial de las de la historia (si no está ya, en
// el sitio de otro objeto). primera: una tienda concreta (aunque sea una normal), si se quiere.
// Lo que pone una llamada no lo quita la siguiente: los Caramelos Raros no pisan una piedra
function venderSiempre(datos, azar, ids, primera) {
  const tiendas = datos.tiendas.filter((t) => datos.perfil.tiendas.historia.includes(t.indice) && t.objetos.length);
  if (!datos.fijosTiendas) datos.fijosTiendas = new Set(); // «tienda:hueco» ya ocupados por uno de estos
  const fijos = datos.fijosTiendas;
  const concreta = primera !== undefined && datos.tiendas.find((t) => t.indice === primera && t.objetos.length);
  for (const id of ids) {
    if ((concreta ? [concreta] : tiendas).some((t) => t.objetos.includes(id))) continue;
    const donde = concreta || azar.elegir(tiendas);
    if (!donde) continue;
    const libres = donde.objetos.map((_, k) => k).filter((k) => !fijos.has(`${donde.indice}:${k}`) && !ids.includes(donde.objetos[k]));
    if (!libres.length) continue;
    // Mejor en un hueco libre (0) que en el sitio de otro objeto
    const vacios = libres.filter((k) => !donde.objetos[k]);
    const k = azar.elegir(vacios.length ? vacios : libres);
    donde.objetos[k] = id;
    fijos.add(`${donde.indice}:${k}`);
  }
}

// Todas las MO, para todos (las que van detrás de las 92 primeras MT)
function moParaTodos(datos) {
  const { tm, hm } = bitsMT(datos);
  for (const e of todas(datos)) for (let i = tm; i < tm + hm; i++) e.mt[i >> 3] |= 1 << (i & 7);
}

function equilibrarPrecios(datos, objetos) {
  datos.precios = datos.precios.map((precio, id) => {
    const nuevo = objetos.precio(id);
    // Negro, Blanco y los segundos los guardan en decenas (la Poción, 30 = 300); los de la 4.ª, tal cual
    const unidad = datos.perfil.preciosEnDecenas === false ? 1 : 10;
    return nuevo ? Math.min(0xffff, Math.max(1, Math.round(nuevo / unidad))) : precio;
  });
}

// ---------- Todo ----------

export async function randomizarROM(bytes, reglasEntrada, semilla) {
  const reglas = completarReglas(reglasEntrada);
  // Una ROM de DS o de GBA (los bytes) o un juego de 3DS ya preparado (ver ./rom-3ds.js)
  const rom = bytes.es3DS || bytes.esSwitch ? bytes : esRomGBA(bytes) ? new RomGBA(bytes) : new RomNDS(bytes);
  const M = await cargarMotor(rom);
  // La hierba de los pueblos, antes de leer nada (sus Pokémon son salvajes como los demás)
  // (en 3DS carga antes lo que le falta: puede tardar)
  const conHierba = reglas.salvajes.pueblos && M.ponerHierbaEnPueblos ? (await M.ponerHierbaEnPueblos(rom)).length > 0 : false;
  const datos = M.leerBW2(rom);
  for (const id of datos.perfil.legendarios || []) LEGENDARIOS.add(id);
  let datosObjetos = await cargarDatosRandomizer();
  // Un datos/randomizer.json viejo (de la caché) no trae estadísticas ni ataques: a PokeAPI
  if (!datosObjetos.statsAntes || !datosObjetos.ataquesAntes || !datosObjetos.objetosGen) datosObjetos = await montarDatosRandomizer();
  const objetos = clasificarObjetos(datosObjetos, datos.perfil.ultimoObjeto, datos.perfil.objetosGen || datos.perfil.gen);
  // Los que no existen en este juego (en Diamante y Perla, los números 112 a 134)
  if (datos.perfil.objetosInexistentes) {
    const existe = (id) => !datos.perfil.objetosInexistentes(id);
    objetos.usables = objetos.usables.filter(existe);
    objetos.equipables = objetos.equipables.filter(existe);
  }
  // Si piden quitar los malos, los equipables tampoco los llevan
  if (reglas.objetos.sinMalos) objetos.equipables = objetos.equipables.filter((id) => !objetos.malos.has(id));

  const azar = (parte) => crearAzar(`${semilla}|${parte}`);
  // Las líneas de las iniciales de antes de tocar nada (para darle al rival las nuevas)
  const inicialesAntes = datos.iniciales.slice();
  const lineas = lineasIniciales(datos, datos.iniciales);
  const originalesIntercambios = datos.intercambios.map((x) => ({ da: x.da, pide: x.pide }));
  const yaDobles = new Set(datos.entrenadores.filter((t) => t.combate === 1).map((t) => t.indice));
  const hecho = [];
  const hacer = (nombre, activo, funcion) => {
    if (!activo) return;
    funcion();
    hecho.push(nombre);
  };

  const r = reglas;
  hacer("hierba en los pueblos", conHierba, () => {});
  // Primero lo que cambia a los Pokémon (las evoluciones, antes que los tipos y las habilidades,
  // que siguen a las familias)
  hacer("datos de los ataques", r.movimientos.generacion, () => ataquesDeGeneracion(datos, deGeneracion(datosObjetos, r.movimientos.generacion).ataques));
  hacer("estadísticas de otra generación", r.stats.generacion, () => statsDeGeneracion(datos, deGeneracion(datosObjetos, r.stats.generacion).stats));
  hacer("estadísticas", r.stats.modo !== "no", () => randomizarStats(datos, azar("stats")));
  hacer("evoluciones al azar", r.evoluciones.modo !== "no", () => randomizarEvolucionesAlAzar(datos, azar("evoluciones")));
  hacer("evoluciones", r.evoluciones.dificiles || r.evoluciones.objetos || r.evoluciones.niveles, () => randomizarEvoluciones(datos, reglas));
  hacer("tipos", r.tipos.modo !== "no", () => randomizarTipos(datos, reglas, azar("tipos")));
  hacer("habilidades", r.habilidades.modo !== "no", () => randomizarHabilidades(datos, reglas, azar("habilidades")));
  hacer("ataques", r.ataques.modo !== "no", () => randomizarAtaques(datos, reglas, azar("ataques")));
  hacer("iniciales", r.iniciales.modo !== "no" && datos.perfil.iniciales !== false, () => randomizarIniciales(datos, reglas, azar("iniciales")));
  // (antes de los entrenadores: el rival lleva los mismos ataques)
  if (r.ataques.modo !== "no") primerosCombatesSeguros(datos, reglas, azar("primeros-combates"));
  hacer("estáticos", r.estaticos.modo !== "no", () => randomizarEstaticos(datos, reglas, azar("estaticos")));
  hacer("tótems", datos.totems && datos.totems.length && (r.estaticos.totems !== "no" || r.estaticos.aliados !== "no" || r.estaticos.aura === "azar"), () => randomizarTotems(datos, reglas, azar("totems")));
  hacer("intercambios", r.intercambios.modo !== "no" || r.intercambios.objetos || r.intercambios.ivs, () =>
    randomizarIntercambios(datos, reglas, azar("intercambios"), objetos));
  hacer("salvajes", r.salvajes.modo !== "no" || r.salvajes.nivel, () => randomizarSalvajes(datos, reglas, azar("salvajes")));
  hacer("un solo Pokémon por zona", r.salvajes.unico && datos.salvajes.some((a) => a.campo), () => unSoloPorZona(datos, azar("unico")));
  hacer("claros ocultos", r.salvajes.modo !== "no" && datos.perfil.claros, () => randomizarClaros(datos, reglas, azar("claros")));
  hacer("objetos de los salvajes", r.salvajes.objetos, () => randomizarObjetosSalvajes(datos, azar("objetos-salvajes"), objetos));
  const rival = r.iniciales.modo !== "no" && r.iniciales.rivalInicial;
  const entrenadores = r.entrenadores.modo !== "no" || r.entrenadores.extras.length || r.entrenadores.objetos.length ||
    r.entrenadores.evolucionados || r.entrenadores.nivel || r.entrenadores.dobles || rival || r.ataques.modo !== "no";
  hacer("entrenadores", entrenadores, () =>
    randomizarEntrenadores(datos, reglas, azar("entrenadores"), rival ? lineas : new Map(), objetos, azar("jefes")));

  // Los ataques de las MT y de los tutores (el programa principal y el overlay 36)
  const movimientos = !datos.perfil.sinMT && (r.mt.ataques || r.tutores.ataques || r.mt.compat !== "no" || r.tutores.compat !== "no") ? M.leerMovimientos(rom) : null;
  if (movimientos) {
    const pos = ataquesPosibles(datos);
    const elegir = (nombre, lista) => {
      const a = azar(nombre);
      const usados = new Set();
      return lista.map(() => {
        let ataque;
        do ataque = a.elegir(pos.sueltos);
        while (usados.has(ataque.id));
        usados.add(ataque.id);
        return ataque.id;
      });
    };
    // (en Espada y Escudo no se pueden cambiar: van en el programa)
    const mtAtaques = r.mt.ataques && !datos.perfil.mtFijas;
    const tutoresAtaques = r.tutores.ataques && datos.perfil.tutores && !datos.perfil.tutoresFijos;
    if (mtAtaques) movimientos.mt = elegir("mt-ataques", movimientos.mt);
    if (tutoresAtaques) {
      const fijos = datos.perfil.tutorInfo?.fijos || [];
      const nuevos = elegir("tutores-ataques", movimientos.tutor);
      movimientos.tutor = movimientos.tutor.map((v, k) => (fijos.includes(k) ? v : nuevos[k]));
    }
    hacer("ataques de las MT", mtAtaques, () => {});
    hacer("ataques de los tutores", tutoresAtaques, () => {});
    // Qué ataque es cada MT y cada tutor (ya con los nuevos) para dar más compatibilidad a los de su tipo
    const mtDe = (i) => {
      const { tm, hm } = bitsMT(datos);
      const k = i < tm ? i : i >= tm + hm ? tm + (i - tm - hm) : -1;
      return k >= 0 ? datos.ataques[movimientos.mt[k]] : null;
    };
    hacer("MT", r.mt.compat !== "no", () => compatibilidad(datos, "mt", reglas, azar("mt"), mtDe));
    hacer("tutores", r.tutores.compat !== "no" && datos.perfil.tutores, () => compatibilidad(datos, "tutor", reglas, azar("tutores"), (k) => datos.ataques[movimientos.tutor[k]]));
    if (mtAtaques || tutoresAtaques) M.escribirMovimientos(rom, movimientos, datos.ataques);
  }
  hacer("MO para todos", r.mt.mo && !datos.perfil.sinMT, () => moParaTodos(datos));
  hacer("objetos del suelo", r.objetos.suelo && !datos.perfil.sinObjetos && !datos.perfil.sinObjetosSuelo, () => randomizarObjetosSuelo(datos, reglas, azar("suelo"), objetos));
  hacer("tiendas", r.objetos.tiendas && !datos.perfil.sinObjetos, () => randomizarTiendas(datos, reglas, azar("tiendas"), objetos));
  hacer("piedras en las tiendas", r.objetos.piedras && !datos.perfil.sinObjetos, () => venderSiempre(datos, azar("piedras"), PIEDRAS_EVOLUTIVAS));
  hacer("precios", r.objetos.precios && !datos.perfil.sinObjetos, () => equilibrarPrecios(datos, objetos));
  hacer("Caramelos Raros baratos", r.objetos.caramelos && !datos.perfil.sinObjetos, () => {
    venderSiempre(datos, azar("caramelos"), [CARAMELO_RARO], datos.perfil.tiendas.primera);
    datos.precios[CARAMELO_RARO] = datos.perfil.preciosEnDecenas === false ? PRECIO_CARAMELO * 10 : PRECIO_CARAMELO;
  });
  // (antes de escribir los scripts)
  hacer("Pokédex Nacional", r.varios.pokedex, () => M.ponerPokedexNacional(datos));
  M.escribirBW2(rom, datos);

  // Los nombres de los entrenadores (se escriben con los demás textos, al final)
  let nombresEntrenadores = null;
  hacer("nombres de entrenadores", r.entrenadores.nombres, () => {
    nombresEntrenadores = M.leerNombresEntrenadores(rom);
    barajarNombres(datos, nombresEntrenadores, azar("nombres"));
  });
  // Retoques del programa
  hacer("combates dobles", r.entrenadores.dobles, () => M.ponerCombatesDobles(rom, yaDobles));
  hacer("texto rápido", r.varios.texto, () => M.ponerTextoRapido(rom));

  // Que lo que se lee cuadre: descripciones de las MT, tipo de las iniciales y diálogos de los
  // intercambios
  const viejos = originalesIntercambios;
  const nombres = M.nombresPokemon(rom);
  const cambiosIntercambio = new Map();
  if (nombres.length) {
    datos.intercambios.forEach((t, i) => {
      const o = viejos[i];
      if (o.da !== t.da) cambiosIntercambio.set(nombres[o.da], nombres[t.da]);
      if (o.pide !== t.pide) cambiosIntercambio.set(nombres[o.pide], nombres[t.pide]);
    });
  }
  // En la pantalla de elegir, el dibujo y el grito de las nuevas
  if (r.iniciales.modo !== "no") M.ponerAspectoIniciales(rom, datos.iniciales);
  // El tipo de las iniciales, si cambian ellas o los tipos
  const textoIniciales = r.iniciales.modo !== "no" || r.tipos.modo !== "no";
  M.actualizarTextos(rom, {
    mt: movimientos && r.mt.ataques && !datos.perfil.mtFijas ? movimientos.mt : null,
    iniciales: textoIniciales ? Object.assign(datos.iniciales.map((id) => ({ tipo: TIPOS_ES[datos.especies[id].tipos[0]] })), { antes: inicialesAntes, ahora: datos.iniciales }) : null,
    intercambios: cambiosIntercambio,
    entrenadores: nombresEntrenadores
  });
  return { juego: rom.titulo, hecho, cambiados: rom.cambiados.size };
}

export { ULTIMA_ESPECIE, ULTIMO_ATAQUE };

