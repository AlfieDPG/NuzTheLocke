// ---------- Negro 2 / Blanco 2: los Pokémon estáticos ----------
//
// Dónde va cada uno en los scripts (a/0/5/6): [script, posición] de la especie (u16), del nivel
// (byte) y de la forma (byte). Sacado de la tabla de UPR-ZX (gen5_offsets.ini), que la comparten
// todas las versiones de idioma.

export const ESTATICOS_BW2 = [
  { nombre: "Cobalion", especie: [[662, 0x1de], [662, 0x240], [740, 0xcd], [740, 0xfc], [740, 0x12c], [740, 0x14c]], nivel: [[740, 0x12e], [740, 0x14e]], forma: [] },
  { nombre: "Virizion", especie: [[730, 0x13a], [730, 0x15f], [730, 0x19b], [730, 0x1bb]], nivel: [[730, 0x19d], [730, 0x1bd]], forma: [] },
  { nombre: "Terrakion", especie: [[948, 0x45d], [948, 0x48d], [948, 0x4ad]], nivel: [[948, 0x48f], [948, 0x4af]], forma: [] },
  { nombre: "Reshiram", especie: [[426, 0x38a], [426, 0x39b], [556, 0x367], [556, 0x568], [556, 0x5e6], [556, 0x6e1], [1208, 0x3a4], [1208, 0xa6a], [1208, 0x717]], nivel: [[426, 0x39d]], forma: [] },
  { nombre: "Zekrom", especie: [[426, 0x36b], [426, 0x37c], [556, 0x350], [556, 0x551], [556, 0x5c7], [556, 0x6c3], [1208, 0x38d], [1208, 0xa53], [1208, 0x706]], nivel: [[426, 0x37e]], forma: [] },
  { nombre: "Kyurem", especie: [[1112, 0x133], [1122, 0x2ba], [1122, 0x311], [1128, 0x37a], [1128, 0x3d1], [1208, 0x1b7], [1208, 0x1f8], [1208, 0x723], [1208, 0xf3d], [1208, 0xf4e]], nivel: [[1208, 0xf50]], forma: [] },
  { nombre: "Kyurem-Black", especie: [[1208, 0xd8b], [1208, 0xd97]], nivel: [[1208, 0xd99]], forma: [[1208, 0xd8d], [1208, 0xd9b]] },
  { nombre: "Kyurem-White", especie: [[1208, 0xdb6], [1208, 0xdc2]], nivel: [[1208, 0xdc4]], forma: [[1208, 0xdb8], [1208, 0xdc6]] },
  { nombre: "Latias", especie: [[304, 0xcc], [304, 0x14b], [304, 0x1bc], [304, 0x237], [304, 0x327], [304, 0x3e6], [304, 0x4a1], [304, 0x54a], [304, 0x5bd], [304, 0x5ce]], nivel: [[304, 0x5d0]], forma: [] },
  { nombre: "Latios", especie: [[304, 0xb5], [304, 0x134], [304, 0x1a5], [304, 0x220], [304, 0x310], [304, 0x3cf], [304, 0x48a], [304, 0x533], [304, 0x59e], [304, 0x5af]], nivel: [[304, 0x5b1]], forma: [] },
  { nombre: "Uxie", especie: [[32, 0x247], [32, 0x2b0], [32, 0x2c1], [1034, 0x12a]], nivel: [[32, 0x2c3]], forma: [] },
  { nombre: "Mesprit", especie: [[684, 0x136], [684, 0x1c2], [684, 0x1d3], [1034, 0x169]], nivel: [[684, 0x1d5]], forma: [] },
  { nombre: "Azelf", especie: [[950, 0xa1], [950, 0x10a], [950, 0x11b], [1034, 0x1be]], nivel: [[950, 0x11d]], forma: [] },
  { nombre: "Regirock", especie: [[1222, 0x134], [1222, 0x145], [1018, 0x32]], nivel: [[1222, 0x147]], forma: [] },
  { nombre: "Regice", especie: [[1224, 0x134], [1224, 0x145], [1018, 0x2c]], nivel: [[1224, 0x147]], forma: [] },
  { nombre: "Registeel", especie: [[1226, 0x134], [1226, 0x145], [1018, 0x38]], nivel: [[1226, 0x147]], forma: [] },
  { nombre: "Regigigas", especie: [[1018, 0x97], [1018, 0xa8]], nivel: [[1018, 0xaa]], forma: [] },
  { nombre: "Cresselia", especie: [[526, 0x48d], [526, 0x512], [526, 0x523]], nivel: [[526, 0x525]], forma: [] },
  { nombre: "Heatran", especie: [[1068, 0x193], [1068, 0x1d6], [1068, 0x1e7], [1080, 0x193], [1080, 0x1d6], [1080, 0x1e7]], nivel: [[1068, 0x1e9], [1080, 0x1e9]], forma: [] },
  { nombre: "Mandibuzz", especie: [[652, 0x5c6], [652, 0x5e9]], nivel: [[652, 0x5eb]], forma: [] },
  { nombre: "Braviary", especie: [[1102, 0x592], [1102, 0x5b5]], nivel: [[1102, 0x5b7]], forma: [] },
  { nombre: "Volcarona", especie: [[364, 0xe], [364, 0x32], [364, 0x40]], nivel: [[364, 0x34], [364, 0x42]], forma: [] },
  { nombre: "Crustle", especie: [[1030, 0x290], [1030, 0x2a1]], nivel: [[1030, 0x2a3]], forma: [] },
  { nombre: "Jellicent", especie: [[480, 0xe1], [480, 0x10a], [480, 0x131], [480, 0x15a]], nivel: [[480, 0x10c], [480, 0x15c]], forma: [] },
  { nombre: "Shiny Haxorus", especie: [[1168, 0x2c], [1168, 0x4f]], nivel: [[1168, 0x51]], forma: [] },
  { nombre: "Eevee", especie: [[988, 0x382]], nivel: [[988, 0x386]], forma: [] },
  { nombre: "Deerling", especie: [[664, 0x3b5], [664, 0x3e2], [664, 0x40f], [664, 0x43c]], nivel: [[664, 0x3b9], [664, 0x3e6], [664, 0x413], [664, 0x440]], forma: [[664, 0x3b7], [664, 0x3e4], [664, 0x411], [664, 0x43e]] },
  { nombre: "Shiny Gible", especie: [[880, 0xab4], [880, 0xac7]], nivel: [[880, 0xab8]], forma: [] },
  { nombre: "Shiny Dratini", especie: [[880, 0xad3], [880, 0xae6]], nivel: [[880, 0xad7]], forma: [] },
  { nombre: "Happiny (egg)", especie: [[54, 0xdd]], nivel: [], forma: [], huevo: true },
  { nombre: "Magikarp", especie: [[526, 0x27e]], nivel: [[526, 0x282]], forma: [] },
  { nombre: "Cranidos", especie: [[1253, 0x5e0]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Shieldon", especie: [[1253, 0x5ff]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Omanyte", especie: [[1253, 0x61e]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Kabuto", especie: [[1253, 0x63d]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Aerodactyl", especie: [[1253, 0x65c]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Anorith", especie: [[1253, 0x67b]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Lileep", especie: [[1253, 0x69a]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Tirtouga", especie: [[1253, 0x6b9]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Archen", especie: [[1253, 0x6d8]], nivel: [[1253, 0x3d6]], forma: [] },
  { nombre: "Zorua", especie: [[208, 0x5a6]], nivel: [[208, 0x5a8]], forma: [] },
  // Los que se hacen pasar por un objeto en el suelo (StaticPokemonFakeBall de UPR-ZX)
  { nombre: "Foongus (objeto)", especie: [[1273, 0x45]], nivel: [[500, 0x46e], [500, 0x492], [500, 0x4b6], [506, 0x42a], [506, 0x44e]], forma: [] },
  { nombre: "Amoonguss (objeto)", especie: [[1273, 0xc7]], nivel: [[534, 0x2f2], [534, 0x316], [562, 0x3fe], [562, 0x422], [563, 0x742], [563, 0x766], [563, 0x78a]], forma: [] }
];
