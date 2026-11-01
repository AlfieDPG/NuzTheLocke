// ---------- Combates: cuánto quita un ataque (aproximado) ----------
//
// Para el bocadillo de cada ataque: el daño que haría al rival que está en el campo, en % de sus PS.
// Es una cuenta aproximada con la fórmula de los juegos (sin críticos):
//
//   daño = ((2·Nv/5 + 2) · Potencia · Atq/Def / 50 + 2) · STAB · eficacia · clima · objeto · quemado · (0,85…1)
//
// Tus estadísticas son las de verdad (las da el motor); las del rival no se saben (sus EV, IV y
// naturaleza), así que se suponen IV 31, sin EV y naturaleza neutra. Sus PS máximos sí se ven
// desde la 4.ª gen. Los cambios de estadísticas (+1, -2...) de los dos cuentan.
//
// No se usa el motor para esto: calcular el daño ahí gasta números al azar del combate y lo
// descuadraría con el del otro jugador.

// Lo que multiplica una etapa de estadística (+1 = ×1,5; -1 = ×0,67)
function etapa(n = 0) {
  return n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
}

// La estadística de un Pokémon sin saber nada de su entrenamiento
export function statSupuesta(base, nivel, esPS = false) {
  const valor = Math.floor(((2 * base + 31) * nivel) / 100);
  return esPS ? valor + nivel + 10 : valor + 5;
}

// Eficacia de un tipo de ataque contra unos tipos: 0, 0.25, 0.5, 1, 2, 4
export function eficacia(dex, tipoAtaque, tipos) {
  if (!dex.getImmunity(tipoAtaque, tipos)) return 0;
  return 2 ** dex.getEffectiveness(tipoAtaque, tipos);
}

// atacante: { nivel, stats: { atk, def, spa, spd, spe } (de verdad), tipos, habilidad, objeto, estado, cambios }
// defensor: { especie (del dex), nivel, tipos, cambios, psMax (si se sabe) }
// Devuelve null si el ataque no hace daño normal (de estado, o daño fijo); si no,
//   { min, max (en % de los PS del rival), eficacia, fijo? }
export function estimarDanio(dex, ataque, atacante, defensor, clima = "") {
  if (!ataque || ataque.category === "Status") return null;
  const tipos = defensor.tipos;
  const efi = eficacia(dex, ataque.type, tipos);
  const psMax = defensor.psMax || statSupuesta(defensor.especie.baseStats.hp, defensor.nivel, true);

  // Daño fijo: Sísmico y Tinieblas (el nivel), Superdiente (la mitad de lo que le queda)...
  if (ataque.damage === "level") {
    const danio = efi === 0 ? 0 : atacante.nivel;
    return { min: (danio / psMax) * 100, max: (danio / psMax) * 100, eficacia: efi, fijo: true };
  }
  if (typeof ataque.damage === "number") {
    return { min: (ataque.damage / psMax) * 100, max: (ataque.damage / psMax) * 100, eficacia: efi, fijo: true };
  }
  if (ataque.ohko) return { ohko: true, eficacia: efi };

  const potencia = ataque.basePower || 0;
  if (!potencia) return { variable: true, eficacia: efi };

  const fisico = ataque.category === "Physical";
  const atq = (fisico ? atacante.stats.atk : atacante.stats.spa) * etapa((atacante.cambios || {})[fisico ? "atk" : "spa"]);
  const baseDef = fisico ? defensor.especie.baseStats.def : defensor.especie.baseStats.spd;
  const def = statSupuesta(baseDef, defensor.nivel) * etapa((defensor.cambios || {})[fisico ? "def" : "spd"]);

  let danio = Math.floor(Math.floor((Math.floor((2 * atacante.nivel) / 5 + 2) * potencia * atq) / def) / 50) + 2;

  // STAB (Adaptable: ×2)
  if (atacante.tipos.includes(ataque.type)) danio *= atacante.habilidad === "adaptability" ? 2 : 1.5;
  danio *= efi;
  // Clima
  if (clima === "RainDance" || clima === "PrimordialSea") danio *= ataque.type === "Water" ? 1.5 : ataque.type === "Fire" ? 0.5 : 1;
  if (clima === "SunnyDay" || clima === "DesolateLand") danio *= ataque.type === "Fire" ? 1.5 : ataque.type === "Water" ? 0.5 : 1;
  // Quemado, salvo con Agallas
  if (fisico && atacante.estado === "brn" && atacante.habilidad !== "guts") danio *= 0.5;
  // Objetos que se ven en tu equipo
  const objeto = atacante.objeto || "";
  if ((objeto === "choiceband" && fisico) || (objeto === "choicespecs" && !fisico)) danio *= 1.5;
  if (objeto === "lifeorb") danio *= 1.3;
  if (objeto === "expertbelt" && efi > 1) danio *= 1.2;
  // Varios golpes: Doble Patada, Ataque Óseo... (lo normal: el número fijo o 2-5)
  const golpes = Array.isArray(ataque.multihit) ? ataque.multihit : ataque.multihit ? [ataque.multihit, ataque.multihit] : [1, 1];

  const min = Math.floor(danio * 0.85) * golpes[0];
  const max = Math.floor(danio) * golpes[1];
  return { min: (min / psMax) * 100, max: (max / psMax) * 100, eficacia: efi, golpes: golpes[1] > 1 ? golpes : null };
}
