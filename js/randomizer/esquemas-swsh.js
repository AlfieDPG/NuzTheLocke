// ---------- Esquemas FlatBuffers de Espada y Escudo ----------
//
// Los campos en el orden de los .fbs de pkNX (el orden es el número de campo). Ver ./flatbuffers.js.

const IVS = [["IV_SPE", "i8"], ["IV_ATK", "i8"], ["IV_DEF", "i8"], ["IV_HP", "i8"], ["IV_SPA", "i8"], ["IV_SPD", "i8"]];

// Salvajes (encount_k.bin y encount_symbol_k.bin en Espada, _t en Escudo, dentro de data_table.gfpak)
const SLOT = [["Probability", "u8"], ["Species", "i32"], ["Form", "u8"]];
const SUBTABLA = [["LevelMin", "u8"], ["LevelMax", "u8"], ["Slots", { vector: SLOT }]];
const TABLA_SALVAJES = [["ZoneID", "u64"], ["SubTables", { vector: SUBTABLA }]];
export const SALVAJES = [["Field_00", "u32"], ["EncounterTables", { vector: TABLA_SALVAJES }]];

// Las incursiones Dinamax (nest_hole_encount.bin, dentro de data_table.gfpak): una tabla por nido y versión
const NIDO = [
  ["EntryIndex", "i32"], ["Species", "i32"], ["Form", "i32"], ["LevelTableID", "u64"], ["Ability", "u8"], ["IsGigantamax", "bool"],
  ["DropTableID", "u64"], ["BonusTableID", "u64"], ["Probabilities", { vector: "u32" }], ["Gender", "i8"], ["FlawlessIVs", "i8"]
];
const TABLA_NIDO = [["TableID", "u64"], ["GameVersion", "i32"], ["Entries", { vector: NIDO }]];
export const NIDOS = [["Table", { vector: TABLA_NIDO }]];

// La Aventura Dinamax (appli/chika/data_table/underground_exploration_poke.bin)
const AVENTURA = [
  ["IsSingleCapture", "bool"], ["SingleCaptureFlagBlock", "u64"], ["Field_02", "u8"], ["Form", "u8"], ["GigantamaxState", "u32"],
  ["Ball", "u32"], ["IndexNum", "u32"], ["Level", "u32"], ["Species", "i32"], ["UiMessageID", "u64"], ["OT_Gender", "u32"],
  ["Version", "u8"], ["Shiny", "u32"], ...IVS, ["Ability", "u32"], ["IsStoryProgressGated", "bool"],
  ["Move0", "u32"], ["Move1", "u32"], ["Move2", "u32"], ["Move3", "u32"]
];
export const AVENTURAS = [["Table", { vector: AVENTURA }]];

// Estáticos (script_event_data/event_encount_data.bin)
const ESTATICO = [
  ["BackgroundFarTypeID", "u64"], ["BackgroundNearTypeID", "u64"],
  ["EV_SPE", "u8"], ["EV_ATK", "u8"], ["EV_DEF", "u8"], ["EV_HP", "u8"], ["EV_SPA", "u8"], ["EV_SPD", "u8"],
  ["Form", "u8"], ["DynamaxLevel", "u8"], ["Field_0A", "i32"], ["EncounterID", "u64"], ["Field_0C", "u8"],
  ["CanGigantamax", "bool"], ["HeldItem", "i32"], ["Level", "u8"], ["EncounterScenario", "i32"], ["Species", "i32"],
  ["ShinyLock", "u32"], ["Nature", "u32"], ["Gender", "i8"], ...IVS,
  ["Ability", "i32"], ["Move0", "i32"], ["Move1", "i32"], ["Move2", "i32"], ["Move3", "i32"]
];
export const ESTATICOS = [["Table", { vector: ESTATICO }]];

// Regalos (script_event_data/add_poke.bin): las iniciales son los regalos 0, 3 y 4
const REGALO = [
  ["IsEgg", "i32"], ["Form", "u8"], ["DynamaxLevel", "u8"], ["BallItemID", "i32"], ["Field_04", "u8"], ["Hash1", "u64"],
  ["CanGigantamax", "bool"], ["HeldItem", "i32"], ["Level", "u8"], ["Species", "i32"], ["Field_0A", "u8"],
  ["MemoryCode", "u8"], ["MemoryData", "u16"], ["MemoryFeel", "u8"], ["MemoryLevel", "u8"], ["OtNameID", "u64"],
  ["OtGender", "i32"], ["ShinyLock", "i32"], ["Nature", "i32"], ["Gender", "u8"], ...IVS, ["Ability", "i32"], ["SpecialMove", "i32"]
];
export const REGALOS = [["Table", { vector: REGALO }]];

// Intercambios (script_event_data/field_trade.bin)
const INTERCAMBIO = [
  ["Form", "u8"], ["DynamaxLevel", "u8"], ["BallItemID", "i32"], ["Field_03", "i32"], ["Hash0", "u64"], ["CanGigantamax", "bool"],
  ["HeldItem", "i32"], ["Level", "u8"], ["Species", "i32"], ["Hash1", "u64"], ["TrainerID", "i32"], ["Memory", "u8"],
  ["TextVar", "u16"], ["Feeling", "u8"], ["Intensity", "u8"], ["Hash2", "u64"], ["OTGender", "u8"], ["RequiredForm", "u8"],
  ["RequiredSpecies", "i32"], ["RequiredNature", "i32"], ["UnknownRequirement", "u8"], ["ShinyLock", "i32"], ["Nature", "i32"],
  ["Gender", "i8"], ...IVS, ["AbilityNumber", "u8"], ["Relearn1", "u16"], ["Relearn2", "u16"], ["Relearn3", "u16"], ["Relearn4", "u16"]
];
export const INTERCAMBIOS = [["Table", { vector: INTERCAMBIO }]];

// Tiendas (appli/shop/bin/shop_data.bin): las de una lista y las de varias (las de los gimnasios que
// van creciendo con las medallas)
const INVENTARIO = [["Items", { vector: "i32" }]];
const TIENDA = [["Hash", "u64"], ["Inventories", INVENTARIO]];
const TIENDA_VARIAS = [["Hash", "u64"], ["Inventories", { vector: INVENTARIO }]];
export const TIENDAS = [["Single", { vector: TIENDA }], ["Multi", { vector: TIENDA_VARIAS }]];

// Un ataque (pml/waza/wazaNNNN.wazabin)
export const ATAQUE = [
  ["Version", "u32"], ["MoveID", "u32"], ["CanUseMove", "bool"], ["Type", "u8"], ["Quality", "u8"], ["Category", "u8"],
  ["Power", "u8"], ["Accuracy", "u8"], ["PP", "u8"], ["Priority", "i8"], ["HitMax", "u8"], ["HitMin", "u8"],
  ["Inflict", "u16"], ["InflictPercent", "u8"], ["RawInflictCount", "u8"], ["TurnMin", "u8"], ["TurnMax", "u8"],
  ["CritStage", "i8"], ["Flinch", "u8"], ["EffectSequence", "u16"], ["Recoil", "i8"], ["RawHealing", "i8"], ["RawTarget", "u8"],
  ["Stat1", "u8"], ["Stat2", "u8"], ["Stat3", "u8"], ["Stat1Stage", "i8"], ["Stat2Stage", "i8"], ["Stat3Stage", "i8"],
  ["Stat1Percent", "u8"], ["Stat2Percent", "u8"], ["Stat3Percent", "u8"], ["GigantamaxPower", "u8"],
  ...["MakesContact", "Charge", "Recharge", "Protect", "Reflectable", "Snatch", "Mirror", "Punch", "Sound", "Gravity", "Defrost",
    "DistanceTriple", "Heal", "IgnoreSubstitute", "FailSkyBattle", "AnimateAlly", "Dance", "Metronome"].map((f) => ["Flag_" + f, "bool"])
];
