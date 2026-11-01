// ---------- Lucha: el combate, con el motor de Showdown ----------
//
// Cada navegador lleva el combate entero (js/lucha/motor.js) con la semilla de la lucha y le va
// metiendo las elecciones de los dos, turno a turno, según llegan de Firestore (js/comun/luchas.js).
// El motor es determinista: con la misma semilla y las mismas elecciones, el mismo combate.
//
//   const combate = new Combate(lucha);
//   combate.necesitan()            // ["p1", "p2"], ["p2"] o [] (nadie: terminado)
//   combate.aplicar({ p1: "move 1", p2: "switch 3" })   // las de los que necesitan, a la vez
//   combate.peticion("p1")         // lo que puede elegir p1 ahora (la «request» de Showdown)
//   combate.lineasNuevas()         // lo que ha pasado desde la última vez (protocolo de Showdown)
//
// Formato: «Custom Game» de la generación (sin cláusulas: en un locke vale todo) y siempre con
// vista previa del equipo, que es donde cada uno elige con quién empieza. Nivel 50: se les pone
// aquí a los equipos (la regla «Adjust Level» del motor no se aplica antes de empezar).

import { Battle, Teams, Dex, toID, VERSION } from "./motor.js";

export { VERSION, Dex, toID };

// La semilla del combate: las dos mitades (la de quien reta y la de quien acepta), mezcladas
export function semillaDe(lucha) {
  const { a = [0, 0, 0, 0], b = [0, 0, 0, 0] } = lucha.semilla || {};
  return a.map((numero, i) => (numero ^ b[i]) & 0xffff);
}

export const GENERACIONES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// "gen4customgame@@@Team Preview": hasta la 4.ª no traen vista previa
export function formatoDe(gen, variante = "") {
  const base = `gen${gen}${variante}customgame`;
  return gen >= 5 && !variante ? base : `${base}@@@Team Preview`;
}

export function genDe(formato) {
  return Number((/^gen(\d)/.exec(formato || "") || [])[1]) || 9;
}

// El formato de un juego de los lockes (js/comun/juegos.js): DBPR tiene su propio modo
export function formatoDeJuego(juego, gen) {
  return juego === "bdsp" ? formatoDe(8, "bdsp") : formatoDe(gen || 9);
}

function dexDe(formato) {
  return Dex.forGen(genDe(formato));
}

// Un equipo (paste) revisado para el combate: { sets, problemas: [texto], vale }
// Los Pokémon que el motor no conoce no pueden luchar; los ataques que no conoce se quitan.
// nivel: "tal" o "50"
export function revisarEquipo(paste, formato, nivel = "tal") {
  const dex = dexDe(formato);
  const problemas = [];
  let sets = [];
  try {
    sets = Teams.import(paste || "") || [];
  } catch (error) {
    sets = [];
  }
  // «posicion»: la que tenía en el paste, que es la de sus caras (lucha.caras), aunque se quite alguno
  sets = sets.slice(0, 6).map((set, posicion) => ({ ...set, posicion })).filter((set) => {
    const especie = dex.species.get(set.species);
    if (!especie.exists) {
      problemas.push({ clave: "especie", nombre: set.species || set.name || "?" });
      return false;
    }
    set.moves = (set.moves || []).filter((ataque) => {
      const existe = dex.moves.get(ataque).exists;
      if (!existe) problemas.push({ clave: "ataque", nombre: ataque, de: set.name || set.species });
      return existe;
    });
    // Sin ataques el motor no deja empezar: Combate, como los Pokémon de los juegos sin nada
    if (!set.moves.length) {
      problemas.push({ clave: "sin-ataques", nombre: set.name || set.species });
      set.moves = ["Struggle"];
    }
    if (nivel === "50") set.level = 50;
    if (!set.level) set.level = 100;
    return true;
  });
  return { sets, problemas, vale: sets.length > 0 };
}

export class Combate {
  constructor(lucha) {
    this.formato = lucha.formato;
    this.sets = {};
    this.indices = {}; // lado -> { nombre en el combate: posición en su equipo }
    const motor = new Battle({ formatid: lucha.formato, seed: semillaDe(lucha) });
    lucha.jugadores.forEach((uid, i) => {
      const lado = `p${i + 1}`;
      const { sets } = revisarEquipo((lucha.equipos || {})[uid], lucha.formato, lucha.nivel);
      this.sets[lado] = sets;
      this.indices[lado] = {};
      for (const set of sets) {
        const nombre = set.name || set.species;
        if (!(nombre in this.indices[lado])) this.indices[lado][nombre] = set.posicion;
      }
      motor.setPlayer(lado, { name: lado, team: sets });
    });
    this.motor = motor;
    this.leidas = 0;
    this.decisiones = 0; // cuántas veces se ha elegido ya (= el turno de Firestore que toca)
  }

  get terminado() {
    return this.motor.ended;
  }

  // "p1", "p2" o "" (empate). Solo con el combate terminado.
  get ganador() {
    return this.motor.winner || "";
  }

  necesitan() {
    if (this.motor.ended) return [];
    return ["p1", "p2"].filter((lado) => {
      const peticion = this.motor[lado].activeRequest;
      return peticion && !peticion.wait;
    });
  }

  peticion(lado) {
    return this.motor[lado].activeRequest || null;
  }

  // elecciones: { p1: "move 1", ... } de TODOS los que necesitan elegir. Lo que el motor no acepte
  // (no debería pasar) se cambia por lo que haría él solo: igual en los dos navegadores.
  aplicar(elecciones) {
    for (const lado of this.necesitan()) {
      const eleccion = elecciones[lado] || "default";
      if (!this.motor.choose(lado, eleccion)) this.motor.choose(lado, "default");
    }
    this.decisiones++;
  }

  // ¿El motor aceptaría esta elección ahora? Se prueba en el lado sin cerrar el turno y se deshace:
  // así nunca se manda una que luego se cambiaría en silencio por «default».
  valida(lado, eleccion) {
    const lado2 = this.motor[lado];
    const vale = lado2.choose(eleccion);
    lado2.clearChoice();
    return vale;
  }

  lineasNuevas() {
    const lineas = this.motor.log.slice(this.leidas);
    this.leidas = this.motor.log.length;
    return lineas;
  }

  // La posición en su equipo (la de sus caras) de un Pokémon del combate, por su nombre («p2a: Mote» -> 3)
  posicionDe(lado, nombre) {
    return this.indices[lado][nombre] ?? -1;
  }

  // Cuántos le quedan sin debilitar a cada lado (para el marcador de arriba)
  vivos(lado) {
    return this.motor[lado].pokemon.filter((pokemon) => !pokemon.fainted).length;
  }
}
