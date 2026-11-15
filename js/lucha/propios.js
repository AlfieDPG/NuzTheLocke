// ---------- Los ataques y habilidades propios de Pokémon Añil, en el motor de combate ----------
//
// Pokémon Añil (fangame) tiene 5 ataques y 18 habilidades que no existen en los juegos
// (js/comun/propios.js). Aquí se le enseñan al motor de Showdown (./motor.js) para que hagan en
// «Combates» lo mismo que en el juego: cada uno, copiado de su código (Essentials, en los
// archivos de Añil: Battle::AbilityEffects y Battle::Move::*), con sus mismos números. Es como un
// servidor de Showdown personalizado: se meten en sus datos (Moves y Abilities) de todas las
// generaciones antes del primer combate.
//
// Van con su nombre del juego (el que lleva el paste: «Ability: Acometida», «- Escalofrío»), que
// es como los escribe pasteDeEquipo de js/partida/convertir.js para los combates.
//
// Tres no hacen en Añil lo que dice su descripción: aquí se hacen COMO DICE LA DESCRIPCIÓN (lo
// decidió el usuario), no como su código:
//   · Coleóptero convierte los ataques de tipo Normal en Bicho (en el juego, solo potencia ×1,5 los
//     de Bicho).
//   · Acometida: el primer turno, ×1,5 de Velocidad y ×1,2 de Ataque (en el juego, ×1,3 al
//     Ataque y al Ataque Especial).
//   · Poder Gélido: con nieve (o granizo), ×1,5 de Velocidad y ×1,5 de potencia a los ataques de
//     Hielo (en el juego, ×2 de Velocidad y el de Hielo no llega a aplicarse).
//
// OJO: los dos navegadores de un combate tienen que llevar los mismos efectos (cada uno calcula el
// combate entero). Si se cambia algo de aquí, las luchas a medias con estos ataques o habilidades
// pueden dejar de cuadrar.

// Las patadas (para Camorrista): las que llevan la marca «Kicking» en los datos de Añil
const PATADAS = [
  "highjumpkick", "jumpkick", "thunderouskick", "lowsweep", "rollingkick", "doublekick", "triplekick", "lowkick",
  "blazekick", "tropkick", "tripleaxel", "megakick", "axekick"
];

// Los ataques que no cambian de tipo con las habilidades «-ato» (como Pixilado en el motor)
const SIN_CAMBIO_DE_TIPO = ["judgment", "multiattack", "naturalgift", "revelationdance", "technoblast", "terrainpulse", "weatherball"];

// Una habilidad que convierte los ataques de tipo Normal en otro tipo y (con potencia) los potencia
// ×1,2, como Pixilado
function cambiaNormalA(tipo, potencia = true) {
  return {
    onModifyTypePriority: -1,
    onModifyType(move, pokemon) {
      if (move.type !== "Normal" || (SIN_CAMBIO_DE_TIPO.includes(move.id) && !(this.activeMove && this.activeMove.isMax))) return;
      if (move.isZ && move.category !== "Status") return;
      if (move.name === "Tera Blast" && pokemon.terastallized) return;
      move.type = tipo;
      if (potencia) move.typeChangerBoosted = this.effect;
    },
    onBasePowerPriority: 23,
    onBasePower(basePower, pokemon, target, move) {
      if (move.typeChangerBoosted === this.effect) return this.chainModify([4915, 4096]);
    }
  };
}

// ×multiplicador al ataque (físico y especial: en Essentials, «attack_multiplier») si se cumple la condición
function potenciaSi(multiplicador, condicion) {
  const mod = function (valor, atacante, defensor, move) {
    if (condicion.call(this, atacante, move)) return this.chainModify(multiplicador);
  };
  return { onModifyAtkPriority: 5, onModifyAtk: mod, onModifySpAPriority: 5, onModifySpA: mod };
}

const enGranizo = (battle) => battle.field.isWeather(["hail", "snowscape", "snow"]);

const HABILIDADES = {
  // Ataques de tipo Eléctrico ×1,5 con 1/3 de sus PS o menos
  Sobrecarga: potenciaSi(1.5, (pokemon, move) => move.type === "Electric" && pokemon.hp <= Math.floor(pokemon.maxhp / 3)),

  // Como Táctica Gorila, pero con el Ataque Especial: ×1,5 a los ataques especiales y solo puede usar el primero que elija
  "Poder Sabio": {
    onStart(pokemon) {
      pokemon.abilityState.choiceLock = "";
    },
    onBeforeMove(pokemon, target, move) {
      if (move.isZOrMaxPowered || move.id === "struggle") return;
      if (pokemon.abilityState.choiceLock && pokemon.abilityState.choiceLock !== move.id) {
        this.addMove("move", pokemon, move.name);
        this.attrLastMove("[still]");
        this.add("-fail", pokemon);
        return false;
      }
    },
    onModifyMove(move, pokemon) {
      if (pokemon.abilityState.choiceLock || move.isZOrMaxPowered || move.id === "struggle") return;
      pokemon.abilityState.choiceLock = move.id;
    },
    onModifySpAPriority: 1,
    onModifySpA(spa, pokemon) {
      if (pokemon.volatiles.dynamax) return;
      return this.chainModify(1.5);
    },
    onDisableMove(pokemon) {
      if (!pokemon.abilityState.choiceLock || pokemon.volatiles.dynamax) return;
      for (const slot of pokemon.moveSlots) {
        if (slot.id !== pokemon.abilityState.choiceLock) pokemon.disableMove(slot.id, false, this.effectState.sourceEffect);
      }
    },
    onEnd(pokemon) {
      pokemon.abilityState.choiceLock = "";
    }
  },

  // Normal -> Bicho (sin potenciarlos: su descripción no lo dice)
  "Coleóptero": cambiaNormalA("Bug", false),
  // Normal -> Fantasma (×1,2)
  "Piel Tétrica": cambiaNormalA("Ghost"),
  // Normal -> Planta (×1,2)
  "Piel Herbácea": cambiaNormalA("Grass"),

  // Como Intimidación, pero baja el Ataque Especial
  Espanto: {
    onStart(pokemon) {
      let avisado = false;
      for (const rival of pokemon.adjacentFoes()) {
        if (!avisado) {
          this.add("-ability", pokemon, "Espanto", "boost");
          avisado = true;
        }
        if (rival.volatiles.substitute) this.add("-immune", rival);
        else this.boost({ spa: -1 }, rival, pokemon, null, true);
      }
    }
  },

  // Como Cabeza Roca: sin daño de retroceso (salvo Forcejeo)
  Iceberg: {
    onDamage(damage, target, source, effect) {
      if (effect.id === "recoil" && this.activeMove && this.activeMove.id !== "struggle") return null;
    }
  },

  // Ataques de su tipo ×1,5
  Inflamable: potenciaSi(1.5, (pokemon, move) => move.type === "Fire"),
  Albino: potenciaSi(1.5, (pokemon, move) => move.type === "Ice"),
  "Floración": potenciaSi(1.5, (pokemon, move) => move.type === "Grass"),

  // ×1,5 a los ataques que no son de su tipo
  Realeza: potenciaSi(1.5, (pokemon, move) => !pokemon.hasType(move.type)),

  // El primer turno en el campo: 50 % más de Velocidad y 20 % más de Ataque
  Acometida: {
    onStart(pokemon) {
      this.add("-ability", pokemon, "Acometida");
    },
    onModifySpe(spe, pokemon) {
      if (pokemon.activeTurns === 0) return this.chainModify(1.5);
    },
    onModifyAtkPriority: 5,
    onModifyAtk(atk, pokemon) {
      if (pokemon.activeTurns === 0) return this.chainModify(1.2);
    }
  },

  // Con nieve o granizo: 50 % más de Velocidad y de potencia en los ataques de Hielo
  "Poder Gélido": {
    onModifySpe(spe) {
      if (enGranizo(this)) return this.chainModify(1.5);
    },
    onBasePowerPriority: 23,
    onBasePower(basePower, pokemon, target, move) {
      if (move.type === "Ice" && enGranizo(this)) return this.chainModify(1.5);
    }
  },

  // ×1,3 de ataque con Campo de Hierba
  Silvano: potenciaSi(1.3, function () {
    return this.field.isTerrain("grassyterrain");
  }),

  // Patadas ×1,2
  Camorrista: {
    onBasePowerPriority: 23,
    onBasePower(basePower, pokemon, target, move) {
      if (PATADAS.includes(move.id)) return this.chainModify(1.2);
    }
  },

  // Al salir cura los problemas de estado de todo su equipo; los ataques de sonido pasan a ser de tipo
  // Psíquico y se potencian ×1,2
  Tintineo: {
    onStart(pokemon) {
      this.add("-ability", pokemon, "Tintineo");
      for (const aliado of pokemon.side.pokemon) {
        if (aliado.status && !aliado.fainted) aliado.cureStatus();
      }
    },
    onModifyTypePriority: -1,
    onModifyType(move) {
      if (!move.flags.sound || move.isZ || move.isMax) return;
      move.type = "Psychic";
      move.typeChangerBoosted = this.effect;
    },
    onBasePowerPriority: 23,
    onBasePower(basePower, pokemon, target, move) {
      if (move.typeChangerBoosted === this.effect) return this.chainModify([4915, 4096]);
    }
  },

  // Lo que se cura absorbiendo (como Raíz Grande), ×1,3
  "Raíz robusta": {
    onTryHealPriority: 1,
    onTryHeal(damage, target, source, effect) {
      if (["drain", "leechseed", "ingrain", "aquaring", "strengthsap"].includes(effect.id)) return this.chainModify(1.3);
    }
  },

  // Como Toque Tóxico, pero quema: 30 % al golpear con contacto
  "Toque Ardiente": {
    onSourceDamagingHit(damage, target, source, move) {
      if (target.hasAbility("shielddust") || target.hasItem("covertcloak")) return;
      if (this.checkMoveMakesContact(move, target, source) && this.randomChance(3, 10)) target.trySetStatus("brn", source);
    }
  }
};

const ATAQUES = {
  // De estado: congela al objetivo
  "Escalofrío": {
    accuracy: 85, basePower: 0, category: "Status", pp: 15, priority: 0, type: "Ice", target: "normal",
    flags: { protect: 1, reflectable: 1, mirror: 1, metronome: 1 },
    status: "frz"
  },
  // Sube la Velocidad del que lo usa
  Deslizamiento: {
    accuracy: 100, basePower: 70, category: "Physical", pp: 20, priority: 0, type: "Ice", target: "normal",
    flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
    secondary: { chance: 100, self: { boosts: { spe: 1 } } }
  },
  // Muerde; muy eficaz contra el tipo Bicho
  Atrapabicho: {
    accuracy: 100, basePower: 90, category: "Physical", pp: 20, priority: 0, type: "Grass", target: "normal",
    flags: { contact: 1, protect: 1, mirror: 1, bite: 1, metronome: 1 },
    onEffectiveness(typeMod, target, type) {
      if (type === "Bug") return 1;
    }
  },
  // Tres golpes (15, 30 y 45), cada uno con su precisión, como Triple Patada
  "Triple Golpe": {
    accuracy: 100, basePower: 15, category: "Physical", pp: 10, priority: 0, type: "Normal", target: "normal",
    flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
    multihit: 3,
    multiaccuracy: true,
    basePowerCallback(pokemon, target, move) {
      return 15 * move.hit;
    }
  },
  // Neutro contra el tipo Hada; no mira los cambios de Defensa / Def. Esp. ni de Evasión del objetivo
  "Luz Devastadora": {
    accuracy: 100, basePower: 200, category: "Special", pp: 10, priority: 0, type: "Dragon", target: "normal",
    flags: { protect: 1, mirror: 1, metronome: 1 },
    ignoreImmunity: { Dragon: true },
    ignoreDefensive: true,
    ignoreEvasion: true,
    onEffectiveness(typeMod, target, type) {
      if (type === "Fairy") return 0;
    }
  }
};

// Súbela si cambia el efecto de alguno (las luchas a medias con ellos avisan de que puede no cuadrar)
export const VERSION_PROPIOS = "anil3";

// Sus nombres (para saber si un equipo lleva alguno)
export function nombresPropios() {
  return [...Object.keys(ATAQUES), ...Object.keys(HABILIDADES), ...Object.keys(ESPECIES)];
}

// Los dos Pokémon propios de Añil (evoluciones de Eevee), con los datos de su juego. num: el de la web
// (js/comun/propios.js), que es también el de sus imágenes
const ESPECIES = {
  Royaleon: {
    num: 20001, types: ["Normal"], gender: "", genderRatio: { M: 0.5, F: 0.5 },
    baseStats: { hp: 110, atk: 60, def: 95, spa: 130, spd: 65, spe: 65 },
    abilities: { 0: "Realeza", H: "Adaptability" }, heightm: 1, weightkg: 29, color: "Blue",
    prevo: "Eevee", evoLevel: undefined, evoType: "useItem", evoItem: "Peluca Regia", eggGroups: ["Field"]
  },
  Cefireon: {
    num: 20002, types: ["Flying"], gender: "", genderRatio: { M: 0.5, F: 0.5 },
    baseStats: { hp: 65, atk: 65, def: 60, spa: 110, spd: 95, spe: 130 },
    abilities: { 0: "Lightning Rod", H: "Compound Eyes" }, heightm: 1, weightkg: 29, color: "Blue",
    prevo: "Eevee", evoLevel: undefined, evoType: "useItem", evoItem: "Pluma Eólica", eggGroups: ["Field"]
  }
};

const aId = (nombre) => String(nombre).toLowerCase().replace(/[^a-z0-9]+/g, "");

let hecho = false;

// Una vez, antes del primer combate: en los datos de todas las generaciones del motor
export function anadirPropiosAlMotor(Dex) {
  if (hecho) return;
  hecho = true;
  const dexes = Object.values(Dex.dexes || {});
  if (!dexes.includes(Dex)) dexes.push(Dex);
  let numero = 30001;
  const numeros = new Map();
  for (const nombre of [...Object.keys(ATAQUES), ...Object.keys(HABILIDADES)]) numeros.set(nombre, numero++);
  for (const dex of dexes) {
    const datos = dex.loadData();
    for (const [nombre, ataque] of Object.entries(ATAQUES)) {
      datos.Moves[aId(nombre)] = { num: numeros.get(nombre), name: nombre, ...ataque };
    }
    for (const [nombre, habilidad] of Object.entries(HABILIDADES)) {
      datos.Abilities[aId(nombre)] = { num: numeros.get(nombre), name: nombre, flags: {}, rating: 3, ...habilidad };
    }
    for (const [nombre, especie] of Object.entries(ESPECIES)) {
      const { gender, evoLevel, ...resto } = especie;
      datos.Pokedex[aId(nombre)] = { name: nombre, ...resto };
    }
  }
}
