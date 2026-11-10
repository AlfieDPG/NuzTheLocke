// ---------- Blanco / Negro: los Pokémon estáticos ----------
//
// Dónde va cada uno en los scripts (a/0/5/7): [script, posición] de la especie (u16), del nivel
// (byte) y de la forma (byte). Sacado de la tabla de UPR-ZX (gen5_offsets.ini), que la comparten
// todas las versiones de idioma. «huevo»: el que se regala como huevo (sale una especie que no venga de otra).

export const ESTATICOS_BW1 = [
  { nombre: "Pansage", especie: [[304, 0x121], [304, 0x1c9], [304, 0x299]], nivel: [[304, 0x29d]], forma: [] },
  { nombre: "Pansear", especie: [[304, 0x131], [304, 0x1de], [304, 0x2b7]], nivel: [[304, 0x2bb]], forma: [] },
  { nombre: "Panpour", especie: [[304, 0xfe], [304, 0x1a1], [304, 0x268]], nivel: [[304, 0x26c]], forma: [] },
  { nombre: "Magikarp", especie: [[526, 0x758]], nivel: [[526, 0x75c]], forma: [] },
  { nombre: "Zorua", especie: [[94, 0x810], [94, 0x64], [94, 0xb4], [94, 0x44b], [94, 0x7ab], [94, 0x7d0], [94, 0x7dc]], nivel: [[94, 0x44f]], forma: [] },
  { nombre: "Larvesta (egg)", especie: [[776, 0x85], [776, 0xb2]], nivel: [], forma: [], huevo: true },
  { nombre: "Darmanitan 1", especie: [[316, 0x369]], nivel: [[316, 0x36b]], forma: [] },
  { nombre: "Darmanitan 2", especie: [[316, 0x437]], nivel: [[316, 0x439]], forma: [] },
  { nombre: "Darmanitan 3", especie: [[316, 0x505]], nivel: [[316, 0x507]], forma: [] },
  { nombre: "Darmanitan 4", especie: [[316, 0x5d3]], nivel: [[316, 0x5d5]], forma: [] },
  { nombre: "Darmanitan 5", especie: [[316, 0x6a1]], nivel: [[316, 0x6a3]], forma: [] },
  { nombre: "Musharna", especie: [[306, 0x65], [306, 0x8f]], nivel: [[306, 0x91]], forma: [] },
  { nombre: "Zoroark", especie: [[770, 0x2f8], [770, 0x353]], nivel: [[770, 0x355]], forma: [] },
  { nombre: "Volcarona", especie: [[364, 0xe], [364, 0x1f]], nivel: [[364, 0x21]], forma: [] },
  { nombre: "Victini", especie: [[474, 0x1ce], [474, 0x20a]], nivel: [[474, 0x20c]], forma: [] },
  { nombre: "Reshiram", especie: [[426, 0x133], [426, 0x15b], [556, 0x1841], [556, 0xcfc], [556, 0x1878], [556, 0x18ea]], nivel: [[426, 0x15d], [556, 0xcfe]], forma: [] },
  { nombre: "Zekrom", especie: [[426, 0x127], [426, 0x174], [556, 0x184d], [556, 0x186c], [556, 0xd15], [556, 0x18de]], nivel: [[426, 0x176], [556, 0xd17]], forma: [] },
  { nombre: "Cobalion", especie: [[670, 0x415], [670, 0x426], [692, 0x1e2]], nivel: [[670, 0x428]], forma: [] },
  { nombre: "Terrakion", especie: [[458, 0x10], [458, 0x21], [692, 0x203]], nivel: [[458, 0x23]], forma: [] },
  { nombre: "Virizion", especie: [[312, 0x10], [312, 0x21], [692, 0x224]], nivel: [[312, 0x23]], forma: [] },
  { nombre: "Landorus", especie: [[752, 0x66d], [752, 0x6cc], [752, 0x6dd]], nivel: [[752, 0x6df]], forma: [] },
  { nombre: "Kyurem", especie: [[464, 0x10], [468, 0x4f], [468, 0x60]], nivel: [[468, 0x62]], forma: [] },
  { nombre: "Cranidos", especie: [[877, 0x601]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Shieldon", especie: [[877, 0x620]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Omanyte", especie: [[877, 0x63f]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Kabuto", especie: [[877, 0x65e]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Aerodactyl", especie: [[877, 0x67d]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Anorith", especie: [[877, 0x69c]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Lileep", especie: [[877, 0x6bb]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Tirtouga", especie: [[877, 0x6da]], nivel: [[877, 0x3f7]], forma: [] },
  { nombre: "Archen", especie: [[877, 0x6f9]], nivel: [[877, 0x3f7]], forma: [] },
  // Los que se hacen pasar por un objeto en el suelo (StaticPokemonFakeBall de UPR-ZX)
  { nombre: "Foongus (objeto)", especie: [[897, 0x45]], nivel: [[331, 0x2aa], [331, 0x2ce], [355, 0x196], [355, 0x2da]], forma: [] },
  { nombre: "Amoonguss (objeto)", especie: [[897, 0xc1]], nivel: [[355, 0x24a], [355, 0x26e]], forma: [] }
];