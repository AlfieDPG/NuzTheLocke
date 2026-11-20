# NuzTheLocke

Web de fans para jugar Nuzlockes con amigos: equipos, rutas, level caps, Pokédex y marcador de lockes.

Enlace: https://alfiedpg.github.io/NuzTheLocke/

Créditos, aviso legal y privacidad: [legal.html](legal.html). Web sin ánimo de lucro, no afiliada
a Nintendo, Creatures Inc., GAME FREAK inc. ni The Pokémon Company.

## Carga rápida

- `datos/nombres.json`, `datos/pokedex.json` y `img/pokedex/retratos-N.webp` van ya preparados
  para no tener que bajar y procesar los CSV de PokeAPI. Se rehacen abriendo
  `herramientas/generar-datos.html` desde la web (solo hace falta si salen Pokémon nuevos).
  Los retratos son de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0).
- `sw.js` guarda en el navegador las imágenes y datos de GitHub y PokeAPI, que si no
  caducan a los 5 minutos.
- Firestore guarda en el navegador perfiles, amistades y lockes, que salen al momento al entrar.
- Al publicar, Cloudflare Pages ejecuta `npm run build` (`herramientas/publicar.mjs`): copia la web a
  `publicar/` con el JS y el CSS minificados y precarga los módulos del arranque. Se edita el código de siempre.

## Evoluciones del randomizer

Qué cambia en las evoluciones con cada opción de **Pokémon > Evoluciones** del randomizer. La
forma de evolucionar de siempre **nunca se quita**: se le suma otra.

- **Facilitar evoluciones complejas**: las de intercambio, amistad, saber un ataque, otro Pokémon
  en el equipo, belleza, un lugar, el tiempo o la hora pueden además evolucionar por nivel. Las de
  intercambio llevando un objeto, además subiendo de nivel con ese objeto (de día o de noche).
- **Facilitar evoluciones por objeto**: las de piedra o llevar un objeto (también las de
  intercambio con objeto) pueden además evolucionar por nivel, sin el objeto. Si hay dos destinos
  con objeto (Gloom, Poliwhirl, Clamperl), los machos van a uno y las hembras al otro.
- **Bajar niveles de evolución**: como mucho 24 la primera de una línea de tres fases, 30 las de
  dos fases (36 si el Pokémon al que evoluciona suma 500 o más de estadísticas base) y 36 la
  segunda de una línea de tres (45 si suma 600 o más). Vale también para los niveles que añaden
  las otras dos opciones.

Los niveles nuevos salen de la fuerza del Pokémon al que se evoluciona (total de estadísticas base
del juego original). Los que no salen en la lista no cambian: Eevee no tiene sitio para más
evoluciones, y Kirlia → Gallade y Snorunt → Froslass perderían su evolución normal. Con las
evoluciones aleatorias las opciones también se aplican, pero sobre las evoluciones nuevas, así que
estas listas ya no valen.

<details>
<summary>Diamante y Perla · Platino · Oro HeartGold y Plata SoulSilver</summary>

**Facilitar evoluciones complejas** (40)

- Golbat → Crobat: amistad; **también** nivel 37
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Kadabra → Alakazam: intercambio; **también** nivel 33
- Machoke → Machamp: intercambio; **también** nivel 34
- Graveler → Golem: intercambio; **también** nivel 33
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Magneton → Magnezone: subir de nivel en un lugar magnético; **también** nivel 37
- Haunter → Gengar: intercambio; **también** nivel 34
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Lickitung → Lickilicky: subir de nivel sabiendo Rodar; **también** nivel 35
- Rhydon → Rhyperior: intercambio llevando Protector; **también** subir de nivel llevando Protector
- Chansey → Blissey: amistad; **también** nivel 37
- Tangela → Tangrowth: subir de nivel sabiendo Poder Pasado; **también** nivel 37
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** subir de nivel llevando Escamadragón
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** subir de nivel llevando Electrizador
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** subir de nivel llevando Magmatizador
- Porygon → Porygon2: intercambio llevando Mejora; **también** subir de nivel llevando Mejora
- Pichu → Pikachu: amistad; **también** nivel 18
- Cleffa → Clefairy: amistad; **también** nivel 20
- Igglybuff → Jigglypuff: amistad; **también** nivel 18
- Togepi → Togetic: amistad; **también** nivel 26
- Aipom → Ambipom: subir de nivel sabiendo Doble Golpe; **también** nivel 33
- Yanma → Yanmega: subir de nivel sabiendo Poder Pasado; **también** nivel 35
- Piloswine → Mamoswine: subir de nivel sabiendo Poder Pasado; **también** nivel 36
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** subir de nivel llevando Disco Extraño
- Azurill → Marill: amistad; **también** nivel 10
- Nosepass → Probopass: subir de nivel en un lugar magnético; **también** nivel 36
- Feebas → Milotic: belleza; **también** nivel 37
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** subir de nivel llevando Tela Terrible
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** subir de nivel llevando Diente Marino
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** subir de nivel llevando Escama Marina
- Budew → Roselia: amistad de día; **también** nivel 26
- Buneary → Lopunny: amistad; **también** nivel 32
- Chingling → Chimecho: amistad de noche; **también** nivel 28
- Bonsly → Sudowoodo: subir de nivel sabiendo Mimético; **también** nivel 27
- Mime Jr. → Mr. Mime: subir de nivel sabiendo Mimético; **también** nivel 31
- Munchlax → Snorlax: amistad; **también** nivel 37
- Riolu → Lucario: amistad de día; **también** nivel 36
- Mantyke → Mantine: subir de nivel con Remoraid en el equipo; **también** nivel 31

**Facilitar evoluciones por objeto** (38)

- Pikachu → Raichu: Piedra Trueno; **también** nivel 32
- Nidorina → Nidoqueen: Piedra Lunar; **también** nivel 34
- Nidorino → Nidoking: Piedra Lunar; **también** nivel 34
- Clefairy → Clefable: Piedra Lunar; **también** nivel 32
- Vulpix → Ninetales: Piedra Fuego; **también** nivel 34
- Jigglypuff → Wigglytuff: Piedra Lunar; **también** nivel 28
- Gloom → Vileplume: Piedra Hoja; **también** nivel 32 (machos)
- Gloom → Bellossom: Piedra Solar; **también** nivel 32 (hembras)
- Growlithe → Arcanine: Piedra Fuego; **también** nivel 38
- Poliwhirl → Poliwrath: Piedra Agua; **también** nivel 34 (machos)
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** nivel 34 (hembras)
- Weepinbell → Victreebel: Piedra Hoja; **también** nivel 32
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** amistad
- Shellder → Cloyster: Piedra Agua; **también** nivel 36
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** nivel 35
- Exeggcute → Exeggutor: Piedra Hoja; **también** nivel 36
- Rhydon → Rhyperior: intercambio llevando Protector; **también** nivel 50
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** nivel 37
- Staryu → Starmie: Piedra Agua; **también** nivel 36
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** nivel 34
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** nivel 37
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** nivel 37
- Porygon → Porygon2: intercambio llevando Mejora; **también** nivel 35
- Togetic → Togekiss: Piedra Día; **también** nivel 38
- Sunkern → Sunflora: Piedra Solar; **también** nivel 28
- Murkrow → Honchkrow: Piedra Noche; **también** nivel 34
- Misdreavus → Mismagius: Piedra Noche; **también** nivel 34
- Gligar → Gliscor: subir de nivel de noche llevando Colmillo Agudo; **también** nivel 35
- Sneasel → Weavile: subir de nivel de noche llevando Garra Afilada; **también** nivel 35
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** nivel 37
- Lombre → Ludicolo: Piedra Agua; **también** nivel 32
- Nuzleaf → Shiftry: Piedra Hoja; **también** nivel 32
- Skitty → Delcatty: Piedra Lunar; **también** nivel 24
- Roselia → Roserade: Piedra Día; **también** nivel 34
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** nivel 45
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** nivel 33 (machos)
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** nivel 33 (hembras)
- Happiny → Chansey: subir de nivel de día llevando Piedra Oval; **también** nivel 30

**Bajar niveles de evolución** (53)

- Venonat → Venomoth: 31 → 30
- Poliwag → Poliwhirl: 25 → 24
- Machop → Machoke: 28 → 24
- Geodude → Graveler: 25 → 24
- Ponyta → Rapidash: 40 → 36
- Slowpoke → Slowbro: 37 → 30
- Magnemite → Magneton: 30 → 24
- Doduo → Dodrio: 31 → 30
- Seel → Dewgong: 34 → 30
- Grimer → Muk: 38 → 36
- Gastly → Haunter: 25 → 24
- Koffing → Weezing: 35 → 30
- Rhyhorn → Rhydon: 42 → 24
- Horsea → Seadra: 32 → 24
- Goldeen → Seaking: 33 → 30
- Omanyte → Omastar: 40 → 30
- Kabuto → Kabutops: 40 → 30
- Dratini → Dragonair: 30 → 24
- Dragonair → Dragonite: 55 → 45
- Pineco → Forretress: 31 → 30
- Slugma → Magcargo: 38 → 30
- Swinub → Piloswine: 33 → 24
- Elekid → Electabuzz: 30 → 24
- Magby → Magmar: 30 → 24
- Larvitar → Pupitar: 30 → 24
- Pupitar → Tyranitar: 55 → 45
- Loudred → Exploud: 40 → 36
- Aron → Lairon: 32 → 24
- Lairon → Aggron: 42 → 36
- Meditite → Medicham: 37 → 30
- Wailmer → Wailord: 40 → 36
- Numel → Camerupt: 33 → 30
- Spoink → Grumpig: 32 → 30
- Trapinch → Vibrava: 35 → 24
- Vibrava → Flygon: 45 → 36
- Cacnea → Cacturne: 32 → 30
- Swablu → Altaria: 35 → 30
- Lileep → Cradily: 40 → 30
- Anorith → Armaldo: 40 → 30
- Shuppet → Banette: 37 → 30
- Duskull → Dusclops: 37 → 24
- Snorunt → Glalie: 42 → 30
- Spheal → Sealeo: 32 → 24
- Sealeo → Walrein: 44 → 36
- Bagon → Shelgon: 30 → 24
- Shelgon → Salamence: 50 → 45
- Glameow → Purugly: 38 → 30
- Stunky → Skuntank: 34 → 30
- Gabite → Garchomp: 48 → 45
- Skorupi → Drapion: 40 → 36
- Croagunk → Toxicroak: 37 → 30
- Finneon → Lumineon: 31 → 30
- Snover → Abomasnow: 40 → 30

</details>

<details>
<summary>Negro y Blanco · Negro 2 y Blanco 2</summary>

**Facilitar evoluciones complejas** (46)

- Golbat → Crobat: amistad; **también** nivel 37
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Kadabra → Alakazam: intercambio; **también** nivel 33
- Machoke → Machamp: intercambio; **también** nivel 34
- Graveler → Golem: intercambio; **también** nivel 33
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Magneton → Magnezone: subir de nivel en un lugar magnético; **también** nivel 37
- Haunter → Gengar: intercambio; **también** nivel 34
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Lickitung → Lickilicky: subir de nivel sabiendo Rodar; **también** nivel 35
- Rhydon → Rhyperior: intercambio llevando Protector; **también** subir de nivel llevando Protector
- Chansey → Blissey: amistad; **también** nivel 37
- Tangela → Tangrowth: subir de nivel sabiendo Poder Pasado; **también** nivel 37
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** subir de nivel llevando Escamadragón
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** subir de nivel llevando Electrizador
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** subir de nivel llevando Magmatizador
- Porygon → Porygon2: intercambio llevando Mejora; **también** subir de nivel llevando Mejora
- Pichu → Pikachu: amistad; **también** nivel 18
- Cleffa → Clefairy: amistad; **también** nivel 20
- Igglybuff → Jigglypuff: amistad; **también** nivel 18
- Togepi → Togetic: amistad; **también** nivel 26
- Aipom → Ambipom: subir de nivel sabiendo Doble Golpe; **también** nivel 33
- Yanma → Yanmega: subir de nivel sabiendo Poder Pasado; **también** nivel 35
- Piloswine → Mamoswine: subir de nivel sabiendo Poder Pasado; **también** nivel 36
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** subir de nivel llevando Disco Extraño
- Azurill → Marill: amistad; **también** nivel 10
- Nosepass → Probopass: subir de nivel en un lugar magnético; **también** nivel 36
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37 o subir de nivel llevando Escama Bella
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** subir de nivel llevando Tela Terrible
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** subir de nivel llevando Diente Marino
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** subir de nivel llevando Escama Marina
- Budew → Roselia: amistad de día; **también** nivel 26
- Buneary → Lopunny: amistad; **también** nivel 32
- Chingling → Chimecho: amistad de noche; **también** nivel 28
- Bonsly → Sudowoodo: subir de nivel sabiendo Mimético; **también** nivel 27
- Mime Jr. → Mr. Mime: subir de nivel sabiendo Mimético; **también** nivel 31
- Munchlax → Snorlax: amistad; **también** nivel 37
- Riolu → Lucario: amistad de día; **también** nivel 36
- Mantyke → Mantine: subir de nivel con Remoraid en el equipo; **también** nivel 31
- Boldore → Gigalith: intercambio; **también** nivel 34
- Woobat → Swoobat: amistad; **también** nivel 28
- Gurdurr → Conkeldurr: intercambio; **también** nivel 34
- Swadloon → Leavanny: amistad; **también** nivel 33
- Karrablast → Escavalier: intercambio por un Shelmet; **también** nivel 34
- Shelmet → Accelgor: intercambio por un Karrablast; **también** nivel 34

**Facilitar evoluciones por objeto** (48)

- Pikachu → Raichu: Piedra Trueno; **también** nivel 32
- Nidorina → Nidoqueen: Piedra Lunar; **también** nivel 34
- Nidorino → Nidoking: Piedra Lunar; **también** nivel 34
- Clefairy → Clefable: Piedra Lunar; **también** nivel 32
- Vulpix → Ninetales: Piedra Fuego; **también** nivel 34
- Jigglypuff → Wigglytuff: Piedra Lunar; **también** nivel 28
- Gloom → Vileplume: Piedra Hoja; **también** nivel 32 (machos)
- Gloom → Bellossom: Piedra Solar; **también** nivel 32 (hembras)
- Growlithe → Arcanine: Piedra Fuego; **también** nivel 38
- Poliwhirl → Poliwrath: Piedra Agua; **también** nivel 34 (machos)
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** nivel 34 (hembras)
- Weepinbell → Victreebel: Piedra Hoja; **también** nivel 32
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** amistad
- Shellder → Cloyster: Piedra Agua; **también** nivel 36
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** nivel 35
- Exeggcute → Exeggutor: Piedra Hoja; **también** nivel 36
- Rhydon → Rhyperior: intercambio llevando Protector; **también** nivel 50
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** nivel 37
- Staryu → Starmie: Piedra Agua; **también** nivel 36
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** nivel 34
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** nivel 37
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** nivel 37
- Porygon → Porygon2: intercambio llevando Mejora; **también** nivel 35
- Togetic → Togekiss: Piedra Día; **también** nivel 38
- Sunkern → Sunflora: Piedra Solar; **también** nivel 28
- Murkrow → Honchkrow: Piedra Noche; **también** nivel 34
- Misdreavus → Mismagius: Piedra Noche; **también** nivel 34
- Gligar → Gliscor: subir de nivel de noche llevando Colmillo Agudo; **también** nivel 35
- Sneasel → Weavile: subir de nivel de noche llevando Garra Afilada; **también** nivel 35
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** nivel 37
- Lombre → Ludicolo: Piedra Agua; **también** nivel 32
- Nuzleaf → Shiftry: Piedra Hoja; **también** nivel 32
- Skitty → Delcatty: Piedra Lunar; **también** nivel 24
- Roselia → Roserade: Piedra Día; **también** nivel 34
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** nivel 45
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** nivel 33 (machos)
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** nivel 33 (hembras)
- Happiny → Chansey: subir de nivel de día llevando Piedra Oval; **también** nivel 30
- Pansage → Simisage: Piedra Hoja; **también** nivel 34
- Pansear → Simisear: Piedra Fuego; **también** nivel 34
- Panpour → Simipour: Piedra Agua; **también** nivel 34
- Munna → Musharna: Piedra Lunar; **también** nivel 33
- Cottonee → Whimsicott: Piedra Solar; **también** nivel 32
- Petilil → Lilligant: Piedra Solar; **también** nivel 32
- Minccino → Cinccino: Piedra Día; **también** nivel 32
- Eelektrik → Eelektross: Piedra Trueno; **también** nivel 47
- Lampent → Chandelure: Piedra Noche; **también** nivel 49

**Bajar niveles de evolución** (93)

- Venonat → Venomoth: 31 → 30
- Poliwag → Poliwhirl: 25 → 24
- Machop → Machoke: 28 → 24
- Geodude → Graveler: 25 → 24
- Ponyta → Rapidash: 40 → 36
- Slowpoke → Slowbro: 37 → 30
- Magnemite → Magneton: 30 → 24
- Doduo → Dodrio: 31 → 30
- Seel → Dewgong: 34 → 30
- Grimer → Muk: 38 → 36
- Gastly → Haunter: 25 → 24
- Koffing → Weezing: 35 → 30
- Rhyhorn → Rhydon: 42 → 24
- Horsea → Seadra: 32 → 24
- Goldeen → Seaking: 33 → 30
- Omanyte → Omastar: 40 → 30
- Kabuto → Kabutops: 40 → 30
- Dratini → Dragonair: 30 → 24
- Dragonair → Dragonite: 55 → 45
- Pineco → Forretress: 31 → 30
- Slugma → Magcargo: 38 → 30
- Swinub → Piloswine: 33 → 24
- Elekid → Electabuzz: 30 → 24
- Magby → Magmar: 30 → 24
- Larvitar → Pupitar: 30 → 24
- Pupitar → Tyranitar: 55 → 45
- Loudred → Exploud: 40 → 36
- Aron → Lairon: 32 → 24
- Lairon → Aggron: 42 → 36
- Meditite → Medicham: 37 → 30
- Wailmer → Wailord: 40 → 36
- Numel → Camerupt: 33 → 30
- Spoink → Grumpig: 32 → 30
- Trapinch → Vibrava: 35 → 24
- Vibrava → Flygon: 45 → 36
- Cacnea → Cacturne: 32 → 30
- Swablu → Altaria: 35 → 30
- Lileep → Cradily: 40 → 30
- Anorith → Armaldo: 40 → 30
- Shuppet → Banette: 37 → 30
- Duskull → Dusclops: 37 → 24
- Snorunt → Glalie: 42 → 30
- Spheal → Sealeo: 32 → 24
- Sealeo → Walrein: 44 → 36
- Bagon → Shelgon: 30 → 24
- Shelgon → Salamence: 50 → 45
- Glameow → Purugly: 38 → 30
- Stunky → Skuntank: 34 → 30
- Gabite → Garchomp: 48 → 45
- Skorupi → Drapion: 40 → 36
- Croagunk → Toxicroak: 37 → 30
- Finneon → Lumineon: 31 → 30
- Snover → Abomasnow: 40 → 30
- Roggenrola → Boldore: 25 → 24
- Timburr → Gurdurr: 25 → 24
- Tympole → Palpitoad: 25 → 24
- Sandile → Krokorok: 29 → 24
- Krokorok → Krookodile: 40 → 36
- Darumaka → Darmanitan: 35 → 30
- Dwebble → Crustle: 34 → 30
- Scraggy → Scrafty: 39 → 30
- Yamask → Cofagrigus: 34 → 30
- Tirtouga → Carracosta: 37 → 30
- Archen → Archeops: 37 → 36
- Trubbish → Garbodor: 36 → 30
- Gothita → Gothorita: 32 → 24
- Gothorita → Gothitelle: 41 → 36
- Solosis → Duosion: 32 → 24
- Duosion → Reuniclus: 41 → 36
- Ducklett → Swanna: 35 → 30
- Vanillite → Vanillish: 35 → 24
- Vanillish → Vanilluxe: 47 → 36
- Deerling → Sawsbuck: 34 → 30
- Foongus → Amoonguss: 39 → 30
- Frillish → Jellicent: 40 → 30
- Joltik → Galvantula: 36 → 30
- Ferroseed → Ferrothorn: 40 → 30
- Klink → Klang: 38 → 24
- Klang → Klinklang: 49 → 36
- Tynamo → Eelektrik: 39 → 24
- Elgyem → Beheeyem: 42 → 30
- Litwick → Lampent: 41 → 24
- Axew → Fraxure: 38 → 24
- Fraxure → Haxorus: 48 → 36
- Cubchoo → Beartic: 37 → 30
- Mienfoo → Mienshao: 50 → 36
- Golett → Golurk: 43 → 30
- Pawniard → Bisharp: 52 → 30
- Rufflet → Braviary: 54 → 36
- Vullaby → Mandibuzz: 54 → 36
- Deino → Zweilous: 50 → 24
- Zweilous → Hydreigon: 64 → 45
- Larvesta → Volcarona: 59 → 36

</details>

<details>
<summary>X e Y · Rubí Omega y Zafiro Alfa</summary>

**Facilitar evoluciones complejas** (55)

- Golbat → Crobat: amistad; **también** nivel 37
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Kadabra → Alakazam: intercambio; **también** nivel 34
- Machoke → Machamp: intercambio; **también** nivel 34
- Graveler → Golem: intercambio; **también** nivel 34
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Magneton → Magnezone: subir de nivel en un lugar magnético; **también** nivel 37
- Haunter → Gengar: intercambio; **también** nivel 34
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Lickitung → Lickilicky: subir de nivel sabiendo Rodar; **también** nivel 35
- Rhydon → Rhyperior: intercambio llevando Protector; **también** subir de nivel llevando Protector
- Chansey → Blissey: amistad; **también** nivel 37
- Tangela → Tangrowth: subir de nivel sabiendo Poder Pasado; **también** nivel 37
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** subir de nivel llevando Escamadragón
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** subir de nivel llevando Electrizador
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** subir de nivel llevando Magmatizador
- Porygon → Porygon2: intercambio llevando Mejora; **también** subir de nivel llevando Mejora
- Pichu → Pikachu: amistad; **también** nivel 20
- Cleffa → Clefairy: amistad; **también** nivel 20
- Igglybuff → Jigglypuff: amistad; **también** nivel 18
- Togepi → Togetic: amistad; **también** nivel 26
- Aipom → Ambipom: subir de nivel sabiendo Doble Golpe; **también** nivel 33
- Yanma → Yanmega: subir de nivel sabiendo Poder Pasado; **también** nivel 35
- Piloswine → Mamoswine: subir de nivel sabiendo Poder Pasado; **también** nivel 36
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** subir de nivel llevando Disco Extraño
- Azurill → Marill: amistad; **también** nivel 10
- Nosepass → Probopass: subir de nivel en un lugar magnético; **también** nivel 36
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37 o subir de nivel llevando Escama Bella
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** subir de nivel llevando Tela Terrible
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** subir de nivel llevando Diente Marino
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** subir de nivel llevando Escama Marina
- Budew → Roselia: amistad de día; **también** nivel 26
- Buneary → Lopunny: amistad; **también** nivel 32
- Chingling → Chimecho: amistad de noche; **también** nivel 28
- Bonsly → Sudowoodo: subir de nivel sabiendo Mimético; **también** nivel 27
- Mime Jr. → Mr. Mime: subir de nivel sabiendo Mimético; **también** nivel 31
- Munchlax → Snorlax: amistad; **también** nivel 37
- Riolu → Lucario: amistad de día; **también** nivel 36
- Mantyke → Mantine: subir de nivel con Remoraid en el equipo; **también** nivel 31
- Boldore → Gigalith: intercambio; **también** nivel 35
- Woobat → Swoobat: amistad; **también** nivel 28
- Gurdurr → Conkeldurr: intercambio; **también** nivel 34
- Swadloon → Leavanny: amistad; **también** nivel 34
- Karrablast → Escavalier: intercambio por un Shelmet; **también** nivel 34
- Shelmet → Accelgor: intercambio por un Karrablast; **también** nivel 34
- Pancham → Pangoro: nivel 32 con un tipo Siniestro en el equipo; **también** nivel 32
- Spritzee → Aromatisse: intercambio llevando Saquito Fragante; **también** subir de nivel llevando Saquito Fragante
- Swirlix → Slurpuff: intercambio llevando Nata Montada; **también** subir de nivel llevando Nata Montada
- Inkay → Malamar: nivel 30 con la consola boca abajo; **también** nivel 30
- Tyrunt → Tyrantrum: nivel 39 de día; **también** nivel 39
- Amaura → Aurorus: nivel 39 de noche; **también** nivel 39
- Sliggoo → Goodra: nivel 50 lloviendo; **también** nivel 50
- Phantump → Trevenant: intercambio; **también** nivel 32
- Pumpkaboo → Gourgeist: intercambio; **también** nivel 34

**Facilitar evoluciones por objeto** (53)

- Pikachu → Raichu: Piedra Trueno; **también** nivel 33
- Nidorina → Nidoqueen: Piedra Lunar; **también** nivel 34
- Nidorino → Nidoking: Piedra Lunar; **también** nivel 34
- Clefairy → Clefable: Piedra Lunar; **también** nivel 33
- Vulpix → Ninetales: Piedra Fuego; **también** nivel 34
- Jigglypuff → Wigglytuff: Piedra Lunar; **también** nivel 29
- Gloom → Vileplume: Piedra Hoja; **también** nivel 33 (machos)
- Gloom → Bellossom: Piedra Solar; **también** nivel 33 (hembras)
- Growlithe → Arcanine: Piedra Fuego; **también** nivel 38
- Poliwhirl → Poliwrath: Piedra Agua; **también** nivel 35 (machos)
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** nivel 34 (hembras)
- Weepinbell → Victreebel: Piedra Hoja; **también** nivel 33
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** amistad
- Shellder → Cloyster: Piedra Agua; **también** nivel 36
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** nivel 35
- Exeggcute → Exeggutor: Piedra Hoja; **también** nivel 36
- Rhydon → Rhyperior: intercambio llevando Protector; **también** nivel 50
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** nivel 37
- Staryu → Starmie: Piedra Agua; **también** nivel 36
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** nivel 34
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** nivel 37
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** nivel 37
- Porygon → Porygon2: intercambio llevando Mejora; **también** nivel 35
- Togetic → Togekiss: Piedra Día; **también** nivel 38
- Sunkern → Sunflora: Piedra Solar; **también** nivel 28
- Murkrow → Honchkrow: Piedra Noche; **también** nivel 34
- Misdreavus → Mismagius: Piedra Noche; **también** nivel 34
- Gligar → Gliscor: subir de nivel de noche llevando Colmillo Agudo; **también** nivel 35
- Sneasel → Weavile: subir de nivel de noche llevando Garra Afilada; **también** nivel 35
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** nivel 37
- Lombre → Ludicolo: Piedra Agua; **también** nivel 32
- Nuzleaf → Shiftry: Piedra Hoja; **también** nivel 32
- Skitty → Delcatty: Piedra Lunar; **también** nivel 24
- Roselia → Roserade: Piedra Día; **también** nivel 35
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** nivel 45
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** nivel 33 (machos)
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** nivel 33 (hembras)
- Happiny → Chansey: subir de nivel de día llevando Piedra Oval; **también** nivel 30
- Pansage → Simisage: Piedra Hoja; **también** nivel 34
- Pansear → Simisear: Piedra Fuego; **también** nivel 34
- Panpour → Simipour: Piedra Agua; **también** nivel 34
- Munna → Musharna: Piedra Lunar; **también** nivel 33
- Cottonee → Whimsicott: Piedra Solar; **también** nivel 32
- Petilil → Lilligant: Piedra Solar; **también** nivel 32
- Minccino → Cinccino: Piedra Día; **también** nivel 32
- Eelektrik → Eelektross: Piedra Trueno; **también** nivel 47
- Lampent → Chandelure: Piedra Noche; **también** nivel 49
- Floette → Florges: Piedra Día; **también** nivel 38
- Doublade → Aegislash: Piedra Noche; **también** nivel 36
- Spritzee → Aromatisse: intercambio llevando Saquito Fragante; **también** nivel 31
- Swirlix → Slurpuff: intercambio llevando Nata Montada; **también** nivel 32
- Helioptile → Heliolisk: Piedra Solar; **también** nivel 32

**Bajar niveles de evolución** (104)

- Venonat → Venomoth: 31 → 30
- Poliwag → Poliwhirl: 25 → 24
- Machop → Machoke: 28 → 24
- Geodude → Graveler: 25 → 24
- Ponyta → Rapidash: 40 → 36
- Slowpoke → Slowbro: 37 → 30
- Magnemite → Magneton: 30 → 24
- Doduo → Dodrio: 31 → 30
- Seel → Dewgong: 34 → 30
- Grimer → Muk: 38 → 36
- Gastly → Haunter: 25 → 24
- Koffing → Weezing: 35 → 30
- Rhyhorn → Rhydon: 42 → 24
- Horsea → Seadra: 32 → 24
- Goldeen → Seaking: 33 → 30
- Omanyte → Omastar: 40 → 30
- Kabuto → Kabutops: 40 → 30
- Dratini → Dragonair: 30 → 24
- Dragonair → Dragonite: 55 → 45
- Pineco → Forretress: 31 → 30
- Slugma → Magcargo: 38 → 30
- Swinub → Piloswine: 33 → 24
- Elekid → Electabuzz: 30 → 24
- Magby → Magmar: 30 → 24
- Larvitar → Pupitar: 30 → 24
- Pupitar → Tyranitar: 55 → 45
- Loudred → Exploud: 40 → 36
- Aron → Lairon: 32 → 24
- Lairon → Aggron: 42 → 36
- Meditite → Medicham: 37 → 30
- Wailmer → Wailord: 40 → 36
- Numel → Camerupt: 33 → 30
- Spoink → Grumpig: 32 → 30
- Trapinch → Vibrava: 35 → 24
- Vibrava → Flygon: 45 → 36
- Cacnea → Cacturne: 32 → 30
- Swablu → Altaria: 35 → 30
- Lileep → Cradily: 40 → 30
- Anorith → Armaldo: 40 → 30
- Shuppet → Banette: 37 → 30
- Duskull → Dusclops: 37 → 24
- Snorunt → Glalie: 42 → 30
- Spheal → Sealeo: 32 → 24
- Sealeo → Walrein: 44 → 36
- Bagon → Shelgon: 30 → 24
- Shelgon → Salamence: 50 → 45
- Glameow → Purugly: 38 → 30
- Stunky → Skuntank: 34 → 30
- Gabite → Garchomp: 48 → 45
- Skorupi → Drapion: 40 → 36
- Croagunk → Toxicroak: 37 → 30
- Finneon → Lumineon: 31 → 30
- Snover → Abomasnow: 40 → 30
- Roggenrola → Boldore: 25 → 24
- Timburr → Gurdurr: 25 → 24
- Tympole → Palpitoad: 25 → 24
- Sandile → Krokorok: 29 → 24
- Krokorok → Krookodile: 40 → 36
- Darumaka → Darmanitan: 35 → 30
- Dwebble → Crustle: 34 → 30
- Scraggy → Scrafty: 39 → 30
- Yamask → Cofagrigus: 34 → 30
- Tirtouga → Carracosta: 37 → 30
- Archen → Archeops: 37 → 36
- Trubbish → Garbodor: 36 → 30
- Gothita → Gothorita: 32 → 24
- Gothorita → Gothitelle: 41 → 36
- Solosis → Duosion: 32 → 24
- Duosion → Reuniclus: 41 → 36
- Ducklett → Swanna: 35 → 30
- Vanillite → Vanillish: 35 → 24
- Vanillish → Vanilluxe: 47 → 36
- Deerling → Sawsbuck: 34 → 30
- Foongus → Amoonguss: 39 → 30
- Frillish → Jellicent: 40 → 30
- Joltik → Galvantula: 36 → 30
- Ferroseed → Ferrothorn: 40 → 30
- Klink → Klang: 38 → 24
- Klang → Klinklang: 49 → 36
- Tynamo → Eelektrik: 39 → 24
- Elgyem → Beheeyem: 42 → 30
- Litwick → Lampent: 41 → 24
- Axew → Fraxure: 38 → 24
- Fraxure → Haxorus: 48 → 36
- Cubchoo → Beartic: 37 → 30
- Mienfoo → Mienshao: 50 → 36
- Golett → Golurk: 43 → 30
- Pawniard → Bisharp: 52 → 30
- Rufflet → Braviary: 54 → 36
- Vullaby → Mandibuzz: 54 → 36
- Deino → Zweilous: 50 → 24
- Zweilous → Hydreigon: 64 → 45
- Larvesta → Volcarona: 59 → 36
- Pancham → Pangoro: 32 → 30
- Honedge → Doublade: 35 → 24
- Binacle → Barbaracle: 39 → 36
- Skrelp → Dragalge: 48 → 30
- Clauncher → Clawitzer: 37 → 36
- Tyrunt → Tyrantrum: 39 → 36
- Amaura → Aurorus: 39 → 36
- Goomy → Sliggoo: 40 → 24
- Sliggoo → Goodra: 50 → 45
- Bergmite → Avalugg: 37 → 36
- Noibat → Noivern: 48 → 36

</details>

<details>
<summary>Sol y Luna</summary>

**Facilitar evoluciones complejas** (62)

- Golbat → Crobat: amistad; **también** nivel 37
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Kadabra → Alakazam: intercambio; **también** nivel 34
- Machoke → Machamp: intercambio; **también** nivel 34
- Graveler → Golem: intercambio; **también** nivel 34
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** subir de nivel llevando Roca del Rey
- Magneton → Magnezone: subir de nivel en un lugar magnético; **también** nivel 37
- Haunter → Gengar: intercambio; **también** nivel 34
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Cubone → Marowak de Alola: nivel 28 de noche; **también** nivel 28
- Lickitung → Lickilicky: subir de nivel sabiendo Rodar; **también** nivel 35
- Rhydon → Rhyperior: intercambio llevando Protector; **también** subir de nivel llevando Protector
- Chansey → Blissey: amistad; **también** nivel 37
- Tangela → Tangrowth: subir de nivel sabiendo Poder Pasado; **también** nivel 37
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** subir de nivel llevando Escamadragón
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** subir de nivel llevando Revestimiento Metálico
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** subir de nivel llevando Electrizador
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** subir de nivel llevando Magmatizador
- Porygon → Porygon2: intercambio llevando Mejora; **también** subir de nivel llevando Mejora
- Pichu → Pikachu: amistad; **también** nivel 20
- Cleffa → Clefairy: amistad; **también** nivel 20
- Igglybuff → Jigglypuff: amistad; **también** nivel 18
- Togepi → Togetic: amistad; **también** nivel 26
- Aipom → Ambipom: subir de nivel sabiendo Doble Golpe; **también** nivel 33
- Yanma → Yanmega: subir de nivel sabiendo Poder Pasado; **también** nivel 35
- Piloswine → Mamoswine: subir de nivel sabiendo Poder Pasado; **también** nivel 36
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** subir de nivel llevando Disco Extraño
- Azurill → Marill: amistad; **también** nivel 10
- Nosepass → Probopass: subir de nivel en un lugar magnético; **también** nivel 36
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37 o subir de nivel llevando Escama Bella
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** subir de nivel llevando Tela Terrible
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** subir de nivel llevando Diente Marino
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** subir de nivel llevando Escama Marina
- Budew → Roselia: amistad de día; **también** nivel 26
- Buneary → Lopunny: amistad; **también** nivel 32
- Chingling → Chimecho: amistad de noche; **también** nivel 30
- Bonsly → Sudowoodo: subir de nivel sabiendo Mimético; **también** nivel 27
- Mime Jr. → Mr. Mime: subir de nivel sabiendo Mimético; **también** nivel 31
- Munchlax → Snorlax: amistad; **también** nivel 37
- Riolu → Lucario: amistad de día; **también** nivel 36
- Mantyke → Mantine: subir de nivel con Remoraid en el equipo; **también** nivel 33
- Boldore → Gigalith: intercambio; **también** nivel 35
- Woobat → Swoobat: amistad; **también** nivel 28
- Gurdurr → Conkeldurr: intercambio; **también** nivel 34
- Swadloon → Leavanny: amistad; **también** nivel 34
- Karrablast → Escavalier: intercambio por un Shelmet; **también** nivel 34
- Shelmet → Accelgor: intercambio por un Karrablast; **también** nivel 34
- Pancham → Pangoro: nivel 32 con un tipo Siniestro en el equipo; **también** nivel 32
- Spritzee → Aromatisse: intercambio llevando Saquito Fragante; **también** subir de nivel llevando Saquito Fragante
- Swirlix → Slurpuff: intercambio llevando Nata Montada; **también** subir de nivel llevando Nata Montada
- Inkay → Malamar: nivel 30 con la consola boca abajo; **también** nivel 30
- Tyrunt → Tyrantrum: nivel 39 de día; **también** nivel 39
- Amaura → Aurorus: nivel 39 de noche; **también** nivel 39
- Sliggoo → Goodra: nivel 50 lloviendo; **también** nivel 50
- Phantump → Trevenant: intercambio; **también** nivel 32
- Pumpkaboo → Gourgeist: intercambio; **también** nivel 34
- Yungoos → Gumshoos: nivel 20 de día; **también** nivel 20
- Charjabug → Vikavolt: subir de nivel en un lugar magnético; **también** nivel 34
- Crabrawler → Crabominable: subir de nivel en el Monte Lanakila; **también** nivel 32
- Fomantis → Lurantis: nivel 34 de día; **también** nivel 34
- Steenee → Tsareena: subir de nivel sabiendo Pisotón; **también** nivel 35
- Código Cero → Silvally: amistad; **también** nivel 40

**Facilitar evoluciones por objeto** (53)

- Pikachu → Raichu de Alola: Piedra Trueno; **también** nivel 33
- Nidorina → Nidoqueen: Piedra Lunar; **también** nivel 34
- Nidorino → Nidoking: Piedra Lunar; **también** nivel 34
- Clefairy → Clefable: Piedra Lunar; **también** nivel 33
- Vulpix → Ninetales: Piedra Fuego; **también** nivel 34
- Jigglypuff → Wigglytuff: Piedra Lunar; **también** nivel 29
- Gloom → Vileplume: Piedra Hoja; **también** nivel 33 (machos)
- Gloom → Bellossom: Piedra Solar; **también** nivel 33 (hembras)
- Growlithe → Arcanine: Piedra Fuego; **también** nivel 38
- Poliwhirl → Poliwrath: Piedra Agua; **también** nivel 35 (machos)
- Poliwhirl → Politoed: intercambio llevando Roca del Rey; **también** nivel 34 (hembras)
- Weepinbell → Victreebel: Piedra Hoja; **también** nivel 33
- Slowpoke → Slowking: intercambio llevando Roca del Rey; **también** amistad
- Shellder → Cloyster: Piedra Agua; **también** nivel 36
- Onix → Steelix: intercambio llevando Revestimiento Metálico; **también** nivel 35
- Exeggcute → Exeggutor de Alola: Piedra Hoja; **también** nivel 36
- Rhydon → Rhyperior: intercambio llevando Protector; **también** nivel 50
- Seadra → Kingdra: intercambio llevando Escamadragón; **también** nivel 37
- Staryu → Starmie: Piedra Agua; **también** nivel 36
- Scyther → Scizor: intercambio llevando Revestimiento Metálico; **también** nivel 34
- Electabuzz → Electivire: intercambio llevando Electrizador; **también** nivel 37
- Magmar → Magmortar: intercambio llevando Magmatizador; **también** nivel 37
- Porygon → Porygon2: intercambio llevando Mejora; **también** nivel 35
- Togetic → Togekiss: Piedra Día; **también** nivel 38
- Sunkern → Sunflora: Piedra Solar; **también** nivel 28
- Murkrow → Honchkrow: Piedra Noche; **también** nivel 34
- Misdreavus → Mismagius: Piedra Noche; **también** nivel 34
- Gligar → Gliscor: subir de nivel de noche llevando Colmillo Agudo; **también** nivel 35
- Sneasel → Weavile: subir de nivel de noche llevando Garra Afilada; **también** nivel 35
- Porygon2 → Porygon-Z: intercambio llevando Disco Extraño; **también** nivel 37
- Lombre → Ludicolo: Piedra Agua; **también** nivel 32
- Nuzleaf → Shiftry: Piedra Hoja; **también** nivel 32
- Skitty → Delcatty: Piedra Lunar; **también** nivel 26
- Roselia → Roserade: Piedra Día; **también** nivel 35
- Feebas → Milotic: belleza o intercambio llevando Escama Bella; **también** nivel 37
- Dusclops → Dusknoir: intercambio llevando Tela Terrible; **también** nivel 45
- Clamperl → Huntail: intercambio llevando Diente Marino; **también** nivel 33 (machos)
- Clamperl → Gorebyss: intercambio llevando Escama Marina; **también** nivel 33 (hembras)
- Happiny → Chansey: subir de nivel de día llevando Piedra Oval; **también** nivel 30
- Pansage → Simisage: Piedra Hoja; **también** nivel 34
- Pansear → Simisear: Piedra Fuego; **también** nivel 34
- Panpour → Simipour: Piedra Agua; **también** nivel 34
- Munna → Musharna: Piedra Lunar; **también** nivel 33
- Cottonee → Whimsicott: Piedra Solar; **también** nivel 32
- Petilil → Lilligant: Piedra Solar; **también** nivel 32
- Minccino → Cinccino: Piedra Día; **también** nivel 32
- Eelektrik → Eelektross: Piedra Trueno; **también** nivel 47
- Lampent → Chandelure: Piedra Noche; **también** nivel 49
- Floette → Florges: Piedra Día; **también** nivel 38
- Doublade → Aegislash: Piedra Noche; **también** nivel 36
- Spritzee → Aromatisse: intercambio llevando Saquito Fragante; **también** nivel 31
- Swirlix → Slurpuff: intercambio llevando Nata Montada; **también** nivel 32
- Helioptile → Heliolisk: Piedra Solar; **también** nivel 32

**Bajar niveles de evolución** (109)

- Venonat → Venomoth: 31 → 30
- Poliwag → Poliwhirl: 25 → 24
- Machop → Machoke: 28 → 24
- Geodude → Graveler: 25 → 24
- Ponyta → Rapidash: 40 → 36
- Slowpoke → Slowbro: 37 → 30
- Magnemite → Magneton: 30 → 24
- Doduo → Dodrio: 31 → 30
- Seel → Dewgong: 34 → 30
- Grimer → Muk: 38 → 36
- Gastly → Haunter: 25 → 24
- Koffing → Weezing: 35 → 30
- Rhyhorn → Rhydon: 42 → 24
- Horsea → Seadra: 32 → 24
- Goldeen → Seaking: 33 → 30
- Omanyte → Omastar: 40 → 30
- Kabuto → Kabutops: 40 → 30
- Dratini → Dragonair: 30 → 24
- Dragonair → Dragonite: 55 → 45
- Pineco → Forretress: 31 → 30
- Slugma → Magcargo: 38 → 30
- Swinub → Piloswine: 33 → 24
- Elekid → Electabuzz: 30 → 24
- Magby → Magmar: 30 → 24
- Larvitar → Pupitar: 30 → 24
- Pupitar → Tyranitar: 55 → 45
- Loudred → Exploud: 40 → 36
- Aron → Lairon: 32 → 24
- Lairon → Aggron: 42 → 36
- Meditite → Medicham: 37 → 30
- Wailmer → Wailord: 40 → 36
- Numel → Camerupt: 33 → 30
- Spoink → Grumpig: 32 → 30
- Trapinch → Vibrava: 35 → 24
- Vibrava → Flygon: 45 → 36
- Cacnea → Cacturne: 32 → 30
- Swablu → Altaria: 35 → 30
- Lileep → Cradily: 40 → 30
- Anorith → Armaldo: 40 → 30
- Shuppet → Banette: 37 → 30
- Duskull → Dusclops: 37 → 24
- Snorunt → Glalie: 42 → 30
- Spheal → Sealeo: 32 → 24
- Sealeo → Walrein: 44 → 36
- Bagon → Shelgon: 30 → 24
- Shelgon → Salamence: 50 → 45
- Glameow → Purugly: 38 → 30
- Stunky → Skuntank: 34 → 30
- Gabite → Garchomp: 48 → 45
- Skorupi → Drapion: 40 → 36
- Croagunk → Toxicroak: 37 → 30
- Finneon → Lumineon: 31 → 30
- Snover → Abomasnow: 40 → 30
- Roggenrola → Boldore: 25 → 24
- Timburr → Gurdurr: 25 → 24
- Tympole → Palpitoad: 25 → 24
- Sandile → Krokorok: 29 → 24
- Krokorok → Krookodile: 40 → 36
- Darumaka → Darmanitan: 35 → 30
- Dwebble → Crustle: 34 → 30
- Scraggy → Scrafty: 39 → 30
- Yamask → Cofagrigus: 34 → 30
- Tirtouga → Carracosta: 37 → 30
- Archen → Archeops: 37 → 36
- Trubbish → Garbodor: 36 → 30
- Gothita → Gothorita: 32 → 24
- Gothorita → Gothitelle: 41 → 36
- Solosis → Duosion: 32 → 24
- Duosion → Reuniclus: 41 → 36
- Ducklett → Swanna: 35 → 30
- Vanillite → Vanillish: 35 → 24
- Vanillish → Vanilluxe: 47 → 36
- Deerling → Sawsbuck: 34 → 30
- Foongus → Amoonguss: 39 → 30
- Frillish → Jellicent: 40 → 30
- Joltik → Galvantula: 36 → 30
- Ferroseed → Ferrothorn: 40 → 30
- Klink → Klang: 38 → 24
- Klang → Klinklang: 49 → 36
- Tynamo → Eelektrik: 39 → 24
- Elgyem → Beheeyem: 42 → 30
- Litwick → Lampent: 41 → 24
- Axew → Fraxure: 38 → 24
- Fraxure → Haxorus: 48 → 36
- Cubchoo → Beartic: 37 → 36
- Mienfoo → Mienshao: 50 → 36
- Golett → Golurk: 43 → 30
- Pawniard → Bisharp: 52 → 30
- Rufflet → Braviary: 54 → 36
- Vullaby → Mandibuzz: 54 → 36
- Deino → Zweilous: 50 → 24
- Zweilous → Hydreigon: 64 → 45
- Larvesta → Volcarona: 59 → 36
- Pancham → Pangoro: 32 → 30
- Honedge → Doublade: 35 → 24
- Binacle → Barbaracle: 39 → 36
- Skrelp → Dragalge: 48 → 30
- Clauncher → Clawitzer: 37 → 36
- Tyrunt → Tyrantrum: 39 → 36
- Amaura → Aurorus: 39 → 36
- Goomy → Sliggoo: 40 → 24
- Sliggoo → Goodra: 50 → 45
- Bergmite → Avalugg: 37 → 36
- Noibat → Noivern: 48 → 36
- Mareanie → Toxapex: 38 → 30
- Fomantis → Lurantis: 34 → 30
- Salandit → Salazzle: 33 → 30
- Sandygast → Palossand: 42 → 30
- Jangmo-o → Hakamo-o: 35 → 24

</details>
