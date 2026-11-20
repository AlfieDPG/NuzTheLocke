// ---------- Tabla de tipos (6ª generación en adelante) ----------
//
// Para cada tipo atacante se apunta solo lo que no es daño normal:
//   super -> hace el doble    poco -> hace la mitad    nulo -> no hace nada
// Lo que no aparece en ninguna lista es daño normal (×1).
//
// Comprobada entrada por entrada contra type_efficacy.csv de PokeAPI.

import { tiposEs } from "./tipos.js";

export const TIPOS = Object.keys(tiposEs);

const TABLA = {
  normal:   { poco: ["rock", "steel"], nulo: ["ghost"] },
  fire:     { super: ["grass", "ice", "bug", "steel"], poco: ["fire", "water", "rock", "dragon"] },
  water:    { super: ["fire", "ground", "rock"], poco: ["water", "grass", "dragon"] },
  electric: { super: ["water", "flying"], poco: ["electric", "grass", "dragon"], nulo: ["ground"] },
  grass:    { super: ["water", "ground", "rock"], poco: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"] },
  ice:      { super: ["grass", "ground", "flying", "dragon"], poco: ["fire", "water", "ice", "steel"] },
  fighting: { super: ["normal", "ice", "rock", "dark", "steel"], poco: ["poison", "flying", "psychic", "bug", "fairy"], nulo: ["ghost"] },
  poison:   { super: ["grass", "fairy"], poco: ["poison", "ground", "rock", "ghost"], nulo: ["steel"] },
  ground:   { super: ["fire", "electric", "poison", "rock", "steel"], poco: ["grass", "bug"], nulo: ["flying"] },
  flying:   { super: ["grass", "fighting", "bug"], poco: ["electric", "rock", "steel"] },
  psychic:  { super: ["fighting", "poison"], poco: ["psychic", "steel"], nulo: ["dark"] },
  bug:      { super: ["grass", "psychic", "dark"], poco: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"] },
  rock:     { super: ["fire", "ice", "flying", "bug"], poco: ["fighting", "ground", "steel"] },
  ghost:    { super: ["psychic", "ghost"], poco: ["dark"], nulo: ["normal"] },
  dragon:   { super: ["dragon"], poco: ["steel"], nulo: ["fairy"] },
  dark:     { super: ["psychic", "ghost"], poco: ["fighting", "dark", "fairy"] },
  steel:    { super: ["ice", "rock", "fairy"], poco: ["fire", "water", "electric", "steel"] },
  fairy:    { super: ["fighting", "dragon", "dark"], poco: ["fire", "poison", "steel"] }
};

function contiene(lista, tipo) {
  return Boolean(lista) && lista.includes(tipo);
}

// Daño que recibe un Pokémon de tipos «defensor» al pegarle un ataque de tipo «atacante».
// Con dos tipos se multiplican los dos valores (Roca contra Fuego/Volador: 2 × 2 = 4).
export function multiplicador(atacante, defensor) {
  const relacion = TABLA[atacante];
  if (!relacion) return 1;

  let total = 1;
  for (const tipo of defensor) {
    if (contiene(relacion.nulo, tipo)) return 0;
    if (contiene(relacion.super, tipo)) total *= 2;
    else if (contiene(relacion.poco, tipo)) total *= 0.5;
  }

  return total;
}

// { normal: 1, fire: 2, ... } para un Pokémon de esos tipos
export function multiplicadoresDe(defensor) {
  const tabla = {};
  for (const atacante of TIPOS) tabla[atacante] = multiplicador(atacante, defensor);
  return tabla;
}

// "×4", "×½", "×0"... para enseñarlo sin decimales feos
const TEXTOS = { 0: "×0", 0.25: "×¼", 0.5: "×½", 2: "×2", 4: "×4" };

export function textoMultiplicador(valor) {
  return TEXTOS[valor] || `×${valor}`;
}

// Debilidades, resistencias e inmunidades de un Pokémon, de más a menos daño
export function puntosDe(defensor) {
  const tabla = multiplicadoresDe(defensor);
  const porValor = (a, b) => tabla[b] - tabla[a];

  return {
    debiles: TIPOS.filter((t) => tabla[t] > 1).sort(porValor),
    resisten: TIPOS.filter((t) => tabla[t] > 0 && tabla[t] < 1).sort(porValor),
    inmunes: TIPOS.filter((t) => tabla[t] === 0)
  };
}

