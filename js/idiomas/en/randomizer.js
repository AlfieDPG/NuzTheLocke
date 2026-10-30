// Randomizer (js/randomizer): las opciones, la barra y los avisos

export default {
  // Opciones de siempre
  "Sin cambios": "No change",
  "Fuerza parecida": "Similar strength",
  "Aleatorio": "Random",
  "Aleatoria": "Random",
  "Líderes": "Leaders",
  "Rivales": "Rivals",
  "Con dos evoluciones": "With two evolutions",
  "Elegir": "Choose",
  "{n}.ª generación": "Generation {n}",

  // Pokémon
  "Cada Pokémon conserva la suma total de sus estadísticas base, pero repartida de otra forma entre PS, Ataque, Defensa, etc.":
    "Each Pokémon keeps its base stat total, but spread differently between HP, Attack, Defense, etc.",
  "Actualizar a la generación": "Update to generation",
  "Algunos Pokémon cambiaron sus estadísticas base en juegos posteriores. Con esta opción tienen las de la generación que elijas.":
    "Some Pokémon had their base stats changed in later games. With this option they have the ones from the generation you choose.",
  "Se mantienen al evolucionar": "Kept when evolving",
  "Habilidades": "Abilities",
  "Todos los Pokémon tienen dos habilidades": "Every Pokémon has two abilities",
  "Banear habilidades inútiles": "Ban useless abilities",
  "Evoluciones": "Evolutions",
  "Cada Pokémon evoluciona en otro distinto de fuerza parecida. Ninguna línea evolutiva pasa de tres fases.":
    "Each Pokémon evolves into a different one of similar strength. No evolution line goes beyond three stages.",
  "Facilitar evoluciones complejas": "Ease complex evolutions",
  "Los Pokémon que evolucionan de forma difícil en un locke (por intercambio, amistad, sabiendo un ataque, en un lugar concreto…) también evolucionan al llegar a cierto nivel.\n\nLos que evolucionan por intercambio llevando un objeto también lo hacen subiendo de nivel con ese objeto equipado.\n\nLa forma original de evolucionar sigue funcionando.":
    "Pokémon that are hard to evolve in a locke (by trade, friendship, knowing a move, at a specific location…) also evolve on reaching a certain level.\n\nThose that evolve by trading while holding an item also evolve by levelling up while holding it.\n\nThe original way to evolve still works.",
  "Facilitar evoluciones por objeto": "Ease item evolutions",
  "Los Pokémon que evolucionan con una piedra u otro objeto también evolucionan al llegar a cierto nivel, sin necesitar el objeto. El objeto sigue funcionando.":
    "Pokémon that evolve with a stone or another item also evolve on reaching a certain level, without needing the item. The item still works.",
  "Bajar niveles de evolución": "Lower evolution levels",
  "Adelanta las evoluciones por nivel que llegan muy tarde. Como máximo:\n\n· Líneas de tres fases: nivel 24 para la primera evolución y 36 para la segunda (45 en los pseudolegendarios).\n· Líneas de dos fases: nivel 30 (36 si el Pokémon es fuerte).":
    "Brings forward level evolutions that come very late. At most:\n\n· Three-stage lines: level 24 for the first evolution and 36 for the second (45 for pseudo-legendaries).\n· Two-stage lines: level 30 (36 if the Pokémon is strong).",

  // Ataques
  "Datos de los ataques": "Move data",
  "Algunos ataques cambiaron de potencia, precisión, PP o tipo en juegos posteriores. Con esta opción tienen los de la generación que elijas.":
    "Some moves had their power, accuracy, PP or type changed in later games. With this option they have the ones from the generation you choose.",
  "Ataques que aprenden": "Learnsets",
  "Preferiblemente de su tipo": "Preferably of its type",
  "Ataques de su tipo": "Moves of its type",
  "Número de ataques asegurados": "Guaranteed moves",
  "Cuántos ataques sabe cada Pokémon como mínimo desde el nivel 1. Si tiene menos, se le añaden los que falten. El resto los sigue aprendiendo en los mismos niveles.":
    "How many moves each Pokémon knows at minimum from level 1. If it has fewer, the missing ones are added. It keeps learning the rest at the same levels.",
  "Ataques más fuertes en niveles más altos": "Stronger moves at higher levels",
  "Quién las aprende": "Who learns them",
  "Con «Aleatorio», cada Pokémon tiene un 50 % de probabilidades de poder aprender cada MT. Con «Todos», todos pueden aprender todas.\n\nEn Espada y Escudo se aplica también a los DT.":
    "With “Random”, each Pokémon has a 50% chance of being able to learn each TM. With “All”, everyone can learn all of them.\n\nIn Sword and Shield it also applies to TRs.",
  "Más fácil si son de su tipo": "Easier if they're of its type",
  "Las de su tipo": "Those of its type",
  "Todos aprenden las MO": "Everyone learns HMs",
  "Tutores de ataques": "Move tutors",
  "Quién los aprende": "Who learns them",
  "Los de su tipo": "Those of its type",

  // Iniciales y especiales
  "Iniciales y especiales": "Starters and specials",
  "Iniciales": "Starters",
  "El rival lleva su inicial": "The rival uses their starter",
  "El rival escoge la inicial nueva que tiene ventaja sobre la tuya y la va evolucionando a lo largo del juego, igual que en el original.":
    "The rival picks the new starter that has the advantage over yours and evolves it throughout the game, just like in the original.",
  "Estáticos": "Static encounters",
  "Los legendarios y otros Pokémon que encuentras quietos en el mapa, y los que te regalan durante la historia.":
    "Legendaries and other Pokémon you find standing still on the map, and the ones you're given during the story.",
  "Tótems": "Totems",
  "Aliados de los tótems": "Totem allies",
  "Aura de los tótems": "Totem aura",
  "Intercambios": "Trades",
  "Objetos de los intercambios aleatorios": "Random trade items",
  "IVs de los intercambios aleatorios": "Random trade IVs",

  // Entrenadores
  "Entrenadores": "Trainers",
  "Pokémon de entrenadores": "Trainer Pokémon",
  "Sin legendarios": "No legendaries",
  "Líderes y Alto Mando de un tipo": "Type-themed leaders and Elite Four",
  "Cada gimnasio (el líder y sus entrenadores), cada miembro del Alto Mando y el campeón usan Pokémon de un único tipo, elegido al azar.":
    "Each gym (the leader and their trainers), each Elite Four member and the champion use Pokémon of a single type, chosen at random.",
  "Multiplicador de niveles": "Level multiplier",
  "Más Pokémon y objetos": "More Pokémon and items",
  "Pokémon extra para": "Extra Pokémon for",
  "Los entrenadores que elijas llevan más Pokémon, hasta un máximo de seis. El primer combate contra el rival no cambia, porque en ese momento solo tienes un Pokémon.":
    "The trainers you choose carry more Pokémon, up to six. The first battle against the rival doesn't change, because at that point you only have one Pokémon.",
  "Cuántos se añaden": "How many are added",
  "Añadir objetos a": "Add items to",
  "Evolucionados del todo": "Fully evolved",
  "A partir del nivel que elijas, los entrenadores solo usan Pokémon en su última evolución.":
    "From the level you choose, trainers only use Pokémon in their final evolution.",
  "Desde el nivel": "From level",
  "Todos los combates dobles": "All battles are doubles",
  "Nombres de los entrenadores aleatorios": "Random trainer names",

  // Salvajes
  "Salvajes": "Wild",
  "Pokémon salvajes": "Wild Pokémon",
  "Un solo Pokémon por zona en el campo": "A single overworld Pokémon per area",
  "Más variedad en cada zona": "More variety in each area",
  "Normalmente cada Pokémon de una zona se cambia siempre por el mismo: si en la Ruta 201 solo hay Starly y Bidoof, solo verás dos Pokémon distintos. Con esta opción cada hueco de la hierba, el agua, etc. se sortea por separado, como en el Universal Pokémon Randomizer, y salen muchos más distintos.":
    "Normally each Pokémon in an area is always replaced by the same one: if Route 201 only has Starly and Bidoof, you only see two different Pokémon. With this option each slot of the grass, water, etc. is rolled separately, like in the Universal Pokémon Randomizer, so many more different ones appear.",
  "En Espada y Escudo los Pokémon salvajes se ven por el campo, así que podrías elegir contra cuál luchar. Con esta opción, todos los que se ven en cada zona son de la misma especie, elegida al azar: te toca la que te toca.\n\nLos que salen de la hierba alta con «!» siguen siendo al azar entre los de la zona.":
    "In Sword and Shield wild Pokémon roam the overworld, so you could pick which one to fight. With this option, every one you see in each area is the same species, chosen at random: you get what you get.\n\nThe ones that pop out of tall grass with “!” are still random among the area's Pokémon.",
  "Objetos de los Pokémon salvajes aleatorios": "Random wild Pokémon items",
  "Hierba en los pueblos": "Grass in towns",
  "Añade una zona de hierba alta invisible en los pueblos y ciudades que no tienen Pokémon salvajes. Salen los mismos Pokémon que en la ruta por la que se llega a ese pueblo.":
    "Adds an invisible tall grass area to towns and cities without wild Pokémon. The same Pokémon appear as on the route leading to that town.",

  // Objetos
  "Objetos del suelo": "Field items",
  "Cambia los objetos que encuentras por el camino, también los ocultos. Donde había una MT aparece otra MT, y los objetos clave de la historia no se tocan.":
    "Changes the items you find along the way, hidden ones too. Where there was a TM another TM appears, and story key items aren't touched.",
  "Banear objetos inútiles": "Ban useless items",
  "Quita los objetos que no sirven durante la aventura (cartas, pañuelos, objetos de colección…). No aparecen en el suelo, en las tiendas ni equipados en los Pokémon.":
    "Removes items that are useless during the adventure (mail, scarves, collectibles…). They don't appear on the ground, in shops or held by Pokémon.",
  "Tiendas": "Shops",
  "Tiendas especiales aleatorias": "Random special shops",
  "Cambia lo que venden las tiendas especiales (todas menos la Tienda Pokémon normal). Donde se vendía una MT, se vende otra MT.":
    "Changes what special shops sell (all but the regular Poké Mart). Where a TM was sold, another TM is sold.",
  "Sin lo de las tiendas normales": "Without what regular shops sell",
  "Siempre hay piedras evolutivas": "Evolution stones always available",
  "Caramelos Raros baratos": "Cheap Rare Candies",
  "Precios equilibrados": "Balanced prices",
  "Varios": "Miscellaneous",
  "Pokédex Nacional desde el principio": "National Pokédex from the start",
  "Texto instantáneo": "Instant text",

  // Resumen de lo que cambian unas normas
  "estadísticas": "stats",
  "tipos": "types",
  "habilidades": "abilities",
  "evoluciones": "evolutions",
  "iniciales": "starters",
  "estáticos": "static encounters",
  "intercambios": "trades",
  "datos de los ataques": "move data",
  "ataques que aprenden": "learnsets",
  "entrenadores": "trainers",
  "salvajes": "wild Pokémon",
  "tutores": "tutors",
  "objetos": "items",
  "varios": "miscellaneous",

  // Barra y avisos
  "Sin guardar": "Unsaved",
  "Guardadas": "Saved",
  "De un locke": "From a locke",
  "Copiar a las mías": "Copy to mine",
  "Guardar copia": "Save a copy",
  "¿Borrar todo lo elegido para randomizar?": "Clear everything chosen to randomize?",
  "Borrar todo": "Clear all",
  "Nombre para estas normas:": "Name for these rules:",
  "¿Borrar las normas «{nombre}»?": "Delete the rules “{nombre}”?",
  "Qué es esto": "What is this",
  "Otra ROM": "Another ROM",
  "Elegir ROM": "Choose ROM",
  "Los de Switch: la carpeta «romfs» sacada desde el emulador": "Switch games: the “romfs” folder extracted from the emulator",
  "Elegir carpeta": "Choose folder",
  "Qué elegir en cada consola y qué hacer con lo que sale": "What to choose on each console and what to do with the result",
  "Ayuda": "Help",
  "Cambia algo primero": "Change something first",
  "Randomizando...": "Randomizing...",
  "Randomizar": "Randomize",
  "Los juegos de Switch van cifrados: hay que sacar su carpeta «romfs» desde el emulador y elegirla con «Elegir carpeta» (mira el «?»).":
    "Switch games are encrypted: you have to extract their “romfs” folder from the emulator and pick it with “Choose folder” (see the “?”).",
  "Ese .3ds está cifrado: hace falta uno descifrado.": "That .3ds is encrypted: a decrypted one is needed.",
  "Este juego todavía no se puede randomizar (de momento, Rojo Fuego y Verde Hoja y los de DS, 3DS y Switch).": "This game can't be randomized yet (for now, FireRed and LeafGreen and DS, 3DS and Switch games).",
  "Esa ROM es de {rom} y el locke, de {locke}.": "That ROM is {rom} and the locke is {locke}.",
  "No se ha podido leer el archivo.": "The file couldn't be read.",
  "Elige la carpeta «romfs» del juego (la que sacaste desde el emulador).": "Choose the game's “romfs” folder (the one you extracted from the emulator).",
  "Después, el navegador te preguntará con su propia ventana si quieres «subir» los archivos a esta web. Acepta: no se sube nada, la web los lee aquí mismo, en tu ordenador.":
    "Then the browser will ask with its own window whether you want to “upload” the files to this site. Accept: nothing is uploaded, the site reads them right here, on your computer.",
  "Si es una carpeta grande, puede tardar unos segundos en aparecer.": "If it's a big folder, it may take a few seconds to appear.",
  "Esa carpeta no es el «romfs» de un juego que se sepa randomizar (mira el «?»).": "That folder isn't the “romfs” of a game the site can randomize (see the “?”).",
  "Todavía no se puede randomizar este juego.": "This game can't be randomized yet.",
  "Esa carpeta es de {rom} y el locke, de {locke}.": "That folder is {rom} and the locke is {locke}.",
  "Lista: {nombre}": "Done: {nombre}",
  "No se ha podido randomizar.": "It couldn't be randomized.",

  // Errores de las ROM
  "Este .3ds no es de ningún juego de 6.ª ni 7.ª generación que se sepa randomizar.": "This .3ds isn't a generation 6 or 7 game the site can randomize.",
  "Esta ROM no es de ningún juego de 4.ª generación que se sepa randomizar.": "This ROM isn't a generation 4 game the site can randomize.",
  "Esta ROM no es de Negro, Blanco, Negro 2 ni Blanco 2.": "This ROM isn't Black, White, Black 2 or White 2.",
  "Este juego no admite los combates dobles.": "This game doesn't support double battles.",
  "Eso no parece una ROM de DS.": "That doesn't look like a DS ROM.",
  "La ROM no tiene sitio para el archivo cambiado.": "The ROM doesn't have room for the changed file.",
  "No se han encontrado las MT.": "The TMs weren't found.",
  "No se han encontrado los tutores.": "The tutors weren't found.",
  "No se conocen las tiendas de esta versión.": "This version's shops aren't known.",
  "No se ha encontrado la rutina del texto.": "The text routine wasn't found."
};
