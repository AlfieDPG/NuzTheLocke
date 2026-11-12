// ---------- Preguntas frecuentes (el «?» del pie del menú) ----------
//
// Agrupadas por tema, con un buscador arriba. Se abren en el tema de la sección en la que estás
// (TEMA_DE_VISTA); «Todas» las enseña todas. Al buscar se miran todas, sin acentos ni mayúsculas, y
// se abren las que coinciden.
//
// Cada pregunta va en los dos idiomas aquí mismo ({ es, en }): es más fácil tenerlas al día que en el
// diccionario. Las respuestas admiten HTML (<b>...).
//
// Al añadir una sección o una función nueva, añade aquí su pregunta: es lo primero que mira quien se
// pierde.

import { icono } from "./comun/iconos.js";
import { t, segunIdioma } from "./comun/idioma.js";
import { quitarAcentos, escaparHTML } from "./comun/utilidades.js";

const TEMAS = [
  {
    id: "empezar", icono: "estrella", es: "Empezar", en: "Getting started",
    preguntas: [
      {
        es: "¿Qué es NuzTheLocke?", en: "What is NuzTheLocke?",
        res: `Una web para jugar Nuzlockes con tus amigos: lleváis el marcador de cada locke en «Lockes» (vidas, victorias, muertos y quién gana) y tienes a mano lo que hace falta mientras juegas: tus equipos, las rutas donde ya has capturado, los level caps de cada combate, las normas y la Pokédex. También puedes jugar desde la web, randomizar tu juego, combatir con tus amigos, buscar compañeros en el foro y hacer los retos del día.`,
        ren: `A site for playing Nuzlockes with your friends: you keep the scoreboard of each locke in “Lockes” (lives, wins, deaths and who wins) and have what you need at hand while you play: your teams, the routes where you've already caught, the level caps of each battle, the rules and the Pokédex. You can also play in the browser, randomize your game, battle your friends, find partners in the forum and do the daily challenges.`
      },
      {
        es: "¿Necesito una cuenta?", en: "Do I need an account?",
        res: `Para equipos, rutas, level caps, normas, Pokédex, calculadora, randomizer, ruleta y «Jugar», no: se guarda todo en este navegador. Con una cuenta (usuario y contraseña, o Google) se guarda además en tu cuenta, así que lo tienes en cualquier dispositivo, y puedes usar «Lockes», «Amigos», el foro, el chat, los combates, los retos del día y la Tienda.`,
        ren: `For teams, routes, level caps, rules, the Pokédex, the calculator, the randomizer, the wheel and “Play”, no: everything is saved in this browser. With an account (username and password, or Google) it's also saved to your account, so you have it on any device, and you can use “Lockes”, “Friends”, the forum, the chat, battles, the daily challenges and the Shop.`
      },
      {
        es: "¿Funciona en el móvil?", en: "Does it work on mobile?",
        res: `Sí. En el móvil las secciones de más uso están en la barra de abajo y el resto en «Más». Lo único que pide ordenador es vigilar el archivo de tu partida al vincularla (Chrome o Edge de ordenador); en el móvil se puede leer a mano.`,
        ren: `Yes. On mobile the most used sections are in the bottom bar and the rest under “More”. The only thing that needs a computer is watching your save file when you link it (Chrome or Edge on a computer); on mobile it can be read by hand.`
      },
      {
        es: "¿Cómo añado a un amigo?", en: "How do I add a friend?",
        res: `En «Amigos», escribe su nombre de usuario y pulsa «Agregar». Le llega una solicitud a la campana; en cuanto la acepta, os salís el uno en la lista del otro. También puedes añadir a alguien desde su perfil (pulsando su foto en el foro, por ejemplo).`,
        ren: `In “Friends”, type their username and click “Add”. They get a request in the bell; as soon as they accept it, you appear in each other's list. You can also add someone from their profile (by clicking their picture in the forum, for example).`
      },
      {
        es: "¿Qué pasa al cerrar sesión? ¿Y con varias cuentas?", en: "What happens when I sign out? And with several accounts?",
        res: `Lo tuyo sigue guardado en tu cuenta y vuelve al entrar; de este navegador se quita mientras tanto. Para tener varias cuentas, pulsa tu nombre (abajo del menú; en el móvil, tu foto arriba) y «Añadir otra cuenta»: luego cambias de una a otra desde ahí mismo.`,
        ren: `Your stuff stays saved in your account and comes back when you sign in; it's removed from this browser in the meantime. To have several accounts, click your name (at the bottom of the menu; on mobile, your picture at the top) and “Add another account”: then you switch between them from right there.`
      },
      {
        es: "¿Cómo borro mi cuenta?", en: "How do I delete my account?",
        res: `Pulsa tu nombre (en el móvil, tu foto), «Mi perfil», «Editar perfil» y «Borrar mi cuenta». Se borra todo lo tuyo y no se puede deshacer.`,
        ren: `Click your name (on mobile, your picture), “My profile”, “Edit profile” and “Delete my account”. Everything of yours is deleted and it can't be undone.`
      }
    ]
  },
  {
    id: "lockes", icono: "espadas", es: "Lockes", en: "Lockes",
    preguntas: [
      {
        es: "¿Cómo funciona un locke?", en: "How does a locke work?",
        res: `Con «Nuevo locke» le pones nombre, tipo, juego, vidas y combates, eliges las normas, las rutas y los level caps, e invitas a tus amigos (les llega a la campana). Cada uno lleva lo suyo: quita sus vidas (y apunta qué Pokémon ha muerto, que va a su cementerio) y marca cuándo se pasa la ROM. Cuando acaba, quien lo creó pulsa «Terminar» y se le suma al ganador a sus lockes ganados.`,
        ren: `With “New locke” you give it a name, type, game, lives and battles, choose the rules, routes and level caps, and invite your friends (it reaches their bell). Everyone keeps track of their own: removes their lives (and records which Pokémon died, which goes to their graveyard) and marks when they beat the ROM. When it's over, whoever created it clicks “End” and it's added to the winner's won lockes.`
      },
      {
        es: "¿Quién gana un locke?", en: "Who wins a locke?",
        res: `Para ganar hay que pasarse la ROM. Si no se la pasa nadie, no gana nadie; si solo se la pasa uno, gana ese, aunque fuese perdiendo los combates; si se la pasan varios, gana el que más combates ha ganado. Al pulsar «Terminar» la web te propone el ganador según esto, y quien lo creó puede cambiarlo (por ejemplo, si empatan). Terminar un locke da Pokédólares: 500 al ganador, 300 al segundo, 150 al tercero y 50 al resto.`,
        ren: `To win you have to beat the ROM. If nobody beats it, nobody wins; if only one does, they win, even if they were losing the battles; if several do, whoever won the most battles wins. When you click “End” the site suggests the winner based on this, and whoever created it can change it (for example, if there's a tie). Finishing a locke gives Pokédollars: 500 to the winner, 300 to second, 150 to third and 50 to everyone else.`
      },
      {
        es: "¿Qué son las vidas? ¿Y la vida cero?", en: "What are lives? And life zero?",
        res: `Las vidas son las que te quedan: cada vez que pierdes un Pokémon (o lo que digan vuestras normas) se quita una. Con 0 vidas aún se juega: es la vida cero. Si pierdes una más, quedas eliminado y ya no puedes ganar el locke. También se puede jugar con vidas ilimitadas.`,
        ren: `Lives are the ones you have left: every time you lose a Pokémon (or whatever your rules say) one is removed. With 0 lives you still play: that's life zero. If you lose one more, you're eliminated and can no longer win the locke. You can also play with unlimited lives.`
      },
      {
        es: "¿Cómo funcionan los combates del locke?", en: "How do the locke's battles work?",
        res: `Al crear el locke se pone cuántos combates habrá (por ejemplo, 3: tras la 3.ª medalla, tras la 6.ª y tras la Liga) y, si quieres, el nombre de cada uno. Se pueden jugar aquí mismo (botón «Retar» del combate, ver «Combates») o fuera, en Showdown (el botón «Showdown» copia tu equipo y lo abre). Pulsando cada combate se apunta quién lo ganó, cómo (2-0, 2-1...) y con qué equipo jugó cada uno. Con 3 o más jugadores, cada combate le suma un punto al que lo gana. Sin combates, cada uno se suma sus victorias a mano.`,
        ren: `When creating the locke you set how many battles there will be (for example, 3: after the 3rd badge, after the 6th and after the League) and, if you want, the name of each. They can be played right here (the battle's “Challenge” button, see “Battles”) or elsewhere, on Showdown (the “Showdown” button copies your team and opens it). Clicking each battle records who won it, how (2-0, 2-1...) and which team each one used. With 3 or more players, each battle adds a point to whoever wins it. Without battles, everyone adds their wins by hand.`
      },
      {
        es: "¿Y el equipo final?", en: "And the final team?",
        res: `Con el locke terminado, cada uno puede poner su equipo final (de «Mis equipos») y elegir a su MVP. Sale en el locke y en el historial de tu perfil.`,
        ren: `Once the locke is over, everyone can set their final team (from “My teams”) and choose their MVP. It shows on the locke and in your profile's history.`
      },
      {
        es: "¿Ven mis rivales lo que capturo?", en: "Can my rivals see what I catch?",
        res: `No. En «Rutas», al marcar un lugar puedes apuntar qué Pokémon cogiste (pulsa la «+» del lugar marcado), pero eso solo lo ves tú. En la actividad del locke solo sale que has capturado en ese lugar, nunca el Pokémon. De tu partida vinculada, los demás solo ven a tus caídos.`,
        ren: `No. In “Routes”, when you mark a location you can note which Pokémon you caught (click the “+” of the marked location), but only you can see that. The locke's activity only shows that you caught something there, never the Pokémon. From your linked save file, the others only see your fallen.`
      },
      {
        es: "¿Qué es el árbitro de normas?", en: "What is the rules referee?",
        res: `Al crear o editar un locke, quien lo creó elige qué normas vigila la web. Con la partida vinculada (o jugando en «Jugar»), si alguien se salta una de ellas, sale en la actividad del locke para que lo veáis todos.`,
        ren: `When creating or editing a locke, its creator chooses which rules the site watches. With the save file linked (or playing in “Play”), if someone breaks one of them, it shows up in the locke's activity for everyone to see.`
      },
      {
        es: "¿Pueden seguir mi locke sin cuenta?", en: "Can people follow my locke without an account?",
        res: `Sí: marca el locke como público (al crearlo o con el lápiz) y en su pie sale «Enlace», que copia una dirección de solo lectura. Quien la abra ve el marcador, las medallas, el cementerio y la actividad al momento, sin cuenta y sin poder tocar nada. Pensado para quien juega en directo.`,
        ren: `Yes: mark the locke as public (when creating it or with the pencil) and its footer shows “Link”, which copies a read-only address. Whoever opens it sees the scoreboard, badges, graveyard and activity live, without an account and without being able to change anything. Made for people who stream.`
      }
    ]
  },
  {
    id: "partida", icono: "consola", es: "Tu partida", en: "Your game",
    preguntas: [
      {
        es: "¿Qué es «Vincular partida»?", en: "What is “Link save file”?",
        res: `En los lockes de Rojo Fuego / Verde Hoja, Diamante / Perla, Platino, HeartGold / SoulSilver, Negro / Blanco, Negro 2 / Blanco 2, X / Y, Rubí Omega / Zafiro Alfa, Sol / Luna, Ultrasol / Ultraluna, Espada / Escudo, Diamante Brillante / Perla Reluciente y el fangame GS Vitro puedes elegir el archivo de guardado del emulador (en GBA, el .sav de mGBA o VBA; en DS, el .dsv de DeSmuME o el .sav; en 3DS, el archivo «main» de Citra o Lime3DS; en Switch, el «main» de Espada / Escudo o el «SaveData.bin» de Perla Reluciente, de Eden, Ryujinx o yuzu, o los que saca JKSV de la consola). La web lo vuelve a leer cada vez que guardas: en tu bloque sale tu equipo, al pulsarlo ves también las cajas, las capturas se marcan solas en «Rutas» y los que metes en las cajas que marques como de muertos te los propone para el cementerio. Pulsando un Pokémon de las cajas lo puedes editar, borrar o clonar, y en la pestaña «Bolsa» cambias los objetos. Los cambios se guardan al cerrar la ventana de las cajas: hazlo con el juego cerrado en el emulador. Con «Copias» vuelves a como estaba. Vigilar el archivo solo funciona en Chrome o Edge de ordenador; en otros navegadores se puede leer a mano. Si el navegador no te deja elegirlo porque está dentro de AppData, cambia en el emulador la carpeta de las partidas a una normal, como Documentos. Lo tienes explicado en el «?» de la partida, en tu bloque del locke.`,
        ren: `In lockes of FireRed / LeafGreen, Diamond / Pearl, Platinum, HeartGold / SoulSilver, Black / White, Black 2 / White 2, X / Y, Omega Ruby / Alpha Sapphire, Sun / Moon, Ultra Sun / Ultra Moon, Sword / Shield, Brilliant Diamond / Shining Pearl and the GS Vitro fan game you can choose the emulator's save file (on GBA, mGBA's or VBA's .sav; on DS, DeSmuME's .dsv or the .sav; on 3DS, the “main” file from Citra or Lime3DS; on Switch, the Sword / Shield “main” or the Shining Pearl “SaveData.bin”, from Eden, Ryujinx or yuzu, or the ones JKSV dumps from the console). The site reads it again every time you save: your team appears in your block, clicking it also shows the boxes, catches are marked automatically in “Routes” and the ones you put in boxes marked for the dead are suggested for the graveyard. Clicking a Pokémon in the boxes lets you edit, delete or clone it, and in the “Bag” tab you change the items. Changes are saved when you close the boxes window: do it with the game closed in the emulator. With “Backups” you go back to how it was. Watching the file only works in Chrome or Edge on a computer; in other browsers it can be read by hand. If the browser won't let you choose it because it's inside AppData, change the emulator's save folder to a normal one, like Documents. It's explained in the save file's “?”, in your locke block.`
      },
      {
        es: "¿Cómo juego desde la web?", en: "How do I play in the browser?",
        res: `En «Jugar», «Nueva partida»: eliges tu ROM (.gba de Rojo Fuego / Verde Hoja o .nds de los de DS), el locke que sigue (si quieres) y si randomizarla ahí mismo. La ROM no sale de tu navegador. Con un locke, la web mira la partida mientras juegas: tu equipo, las capturas en «Rutas», las medallas en «Level caps» y, si un Pokémon se debilita, te lo propone para el cementerio. Con «Editar», debajo de la pantalla, cambias la partida (cajas, bolsa...) sin salir. Se juega con el teclado, con un mando o, en el móvil, con los botones de la pantalla.`,
        ren: `In “Play”, “New game”: choose your ROM (a FireRed / LeafGreen .gba or a DS .nds), the locke it follows (if you want) and whether to randomize it right there. The ROM never leaves your browser. With a locke, the site watches the game while you play: your team, catches in “Routes”, badges in “Level caps” and, if a Pokémon faints, it suggests it for the graveyard. With “Edit”, below the screen, you change the save (boxes, bag...) without leaving. You play with the keyboard, a controller or, on mobile, the on-screen buttons.`
      },
      {
        es: "¿Pueden mis amigos verme jugar?", en: "Can my friends watch me play?",
        res: `Sí: en «Jugar», pulsa «Emitir» mientras juegas. Tus amigos ven «En directo» en tu ficha de «Amigos» y, al entrar, ven tu pantalla con sonido y un chat. Van de tu navegador al suyo, sin pasar por ningún servidor: caben hasta 6 y algunas redes muy cerradas no llegan a conectarse.`,
        ren: `Yes: in “Play”, click “Stream” while you play. Your friends see “Live” on your card in “Friends” and, when they join, they see your screen with sound and a chat. It goes from your browser to theirs without any server in between: up to 6 can watch and some very locked-down networks can't connect.`
      },
      {
        es: "¿Puedo usar las rutas o los level caps de un fan game?", en: "Can I use the routes or level caps of a fan game?",
        res: `Sí. En «Rutas» o en «Level caps», pestaña «Personalizado», pulsa «+ Nuevo». Puedes escribirlo todo desde cero o aprovechar lo de la web: copiar los lugares de un juego, o poner a cada combate el retrato de un personaje (o subir tu propia imagen). Luego los eliges al crear un locke y los demás jugadores los abren desde los botones «Rutas» y «Level caps» del locke.`,
        ren: `Yes. In “Routes” or “Level caps”, “Custom” tab, click “+ New”. You can write it all from scratch or reuse what's on the site: copy a game's locations, or give each battle a character portrait (or upload your own image). Then you choose them when creating a locke and the other players open them from the locke's “Routes” and “Level caps” buttons.`
      },
      {
        es: "¿Para qué sirve el multiplicador de los level caps?", en: "What is the level cap multiplier for?",
        res: `Para los randomizers que suben el nivel de los entrenadores: multiplica todos los niveles de la lista por lo que pongas.`,
        ren: `For randomizers that raise the trainers' levels: it multiplies every level in the list by whatever you set.`
      }
    ]
  },
  {
    id: "equipos", icono: "pokeball", es: "Equipos y cálculos", en: "Teams and calculations",
    preguntas: [
      {
        es: "¿Cómo paso un equipo a Showdown, o al revés?", en: "How do I move a team to Showdown, or the other way round?",
        res: `En el creador de equipos, «Exportar» (en el «⋯») copia el equipo en el formato de Showdown. Para traer uno, «Importar». En «Mis equipos», «Exportar todos» copia todos los equipos como la copia de seguridad de Showdown, e «Importar» con esa copia los añade todos. Con «Nuevo grupo» juntas equipos en carpetas; son las mismas carpetas de Showdown al exportar e importar. Pulsando el nombre de un Pokémon le pones o le cambias el mote.`,
        ren: `In the team builder, “Export” (in the “⋯”) copies the team in Showdown's format. To bring one in, “Import”. In “My teams”, “Export all” copies every team like Showdown's backup, and “Import” with that backup adds them all. With “New group” you put teams into folders; they're the same as Showdown's folders when exporting and importing. Clicking a Pokémon's name lets you give or change its nickname.`
      },
      {
        es: "¿Qué hacen «Analizar» y «Buscar equipo»?", en: "What do “Analyze” and “Find team” do?",
        res: `«Analizar» le pone nota a tu equipo y te explica su cobertura, sus puntos débiles y qué podrías cambiar para mejorarlo. «Buscar equipo» busca el mejor equipo con los Pokémon de la caja de uno de tus lockes (con la partida vinculada). Los dos están en la barra de «Crear equipo».`,
        ren: `“Analyze” grades your team and explains its coverage, its weak spots and what you could change to improve it. “Find team” looks for the best team with the Pokémon in the box of one of your lockes (with the save file linked). Both are in the “Create team” bar.`
      },
      {
        es: "¿Cómo pongo nivel, naturaleza, EVs e IVs?", en: "How do I set level, nature, EVs and IVs?",
        res: `En «Crear equipo», con el botón «Estadísticas» de cada Pokémon. Si no los tocas, se exporta como siempre (nivel 100, naturaleza neutra). Al importar un paste de Showdown se leen también.`,
        ren: `In “Create team”, with each Pokémon's “Stats” button. If you don't touch them, it's exported as always (level 100, neutral nature). They're also read when importing a Showdown paste.`
      },
      {
        es: "¿Cómo funciona la calculadora?", en: "How does the calculator work?",
        res: `Eliges quién ataca y quién recibe: de tus equipos (con su nivel, naturaleza, EVs, IVs, objeto y ataques) o cualquier Pokémon buscándolo (para el rival de un randomlocke). Salen sus cuatro ataques con el daño de cada uno y, del elegido, el daño en % y en PS, cómo queda su vida, si lo deja KO y quién ataca antes. Tiene en cuenta STAB, tipos, crítico, quemadura, parálisis, cambios de estadísticas, clima, Reflejo, Pantalla de luz, la prioridad, los PS que le quedan a cada uno, y los objetos y habilidades que cambian el daño o la velocidad. Lo que cambies aquí no toca tus equipos.`,
        ren: `You choose who attacks and who takes the hit: from your teams (with their level, nature, EVs, IVs, item and moves) or any Pokémon by searching for it (for a randomlocke rival). You get its four moves with the damage of each and, for the chosen one, the damage in % and HP, how much health is left, whether it KOs and who moves first. It takes into account STAB, types, critical hits, burn, paralysis, stat changes, weather, Reflect, Light Screen, priority, each one's remaining HP, and the items and abilities that change damage or speed. What you change here doesn't touch your teams.`
      },
      {
        es: "¿Cómo veo la línea evolutiva de un Pokémon?", en: "How do I see a Pokémon's evolution line?",
        res: `En la «Pokédex», pulsa la foto del Pokémon: sale su línea evolutiva con cómo evoluciona cada uno.`,
        ren: `In the “Pokédex”, click the Pokémon's picture: its evolution line appears with how each one evolves.`
      }
    ]
  },
  {
    id: "herramientas", icono: "mezclar", es: "Randomizer y ruleta", en: "Randomizer and wheel",
    preguntas: [
      {
        es: "¿Cómo randomizo mi juego?", en: "How do I randomize my game?",
        res: `En «Randomizer» eliges qué cambiar (Pokémon, ataques, entrenadores, salvajes, objetos...) y luego tu juego: el .gba de Rojo Fuego / Verde Hoja, el .nds en los de DS, el .3ds descifrado en los de 3DS y, en los de Switch, la carpeta «romfs» que sacas desde el emulador. La web lo randomiza en tu ordenador (el juego no se sube a ningún sitio) y te lo da para descargar; con GBA y DS, «Randomizar y jugar» lo abre directamente en «Jugar». En el «?» al lado de «Elegir ROM» tienes cómo hacerlo en cada consola. En un locke con randomizer, pulsa «Randomizar mi ROM» en el locke: a cada uno le sale un juego distinto con las mismas normas.`,
        ren: `In “Randomizer” you choose what to change (Pokémon, moves, trainers, wild Pokémon, items...) and then your game: the FireRed / LeafGreen .gba, the .nds for DS games, the decrypted .3ds for 3DS games and, for Switch games, the “romfs” folder you extract from the emulator. The site randomizes it on your computer (the game isn't uploaded anywhere) and gives it back for you to download; with GBA and DS, “Randomize and play” opens it straight in “Play”. The “?” next to “Choose ROM” explains how on each console. In a locke with a randomizer, click “Randomize my ROM” on the locke: everyone gets a different game with the same rules.`
      },
      {
        es: "¿Para qué sirve la ruleta?", en: "What is the wheel for?",
        res: `Para echar a suertes lo que queráis, por ejemplo la recompensa del que gana un combate. Escribe las opciones (la ruleta cambia según escribes) y pulsa el centro para girarla. Puedes tener varias ruletas, cada una con su nombre.`,
        ren: `To leave whatever you want to chance, for example the reward for whoever wins a battle. Write the options (the wheel changes as you type) and click the centre to spin it. You can have several wheels, each with its own name.`
      }
    ]
  },
  {
    id: "comunidad", icono: "amigos", es: "Comunidad y juegos", en: "Community and games",
    preguntas: [
      {
        es: "¿Cómo funciona el foro?", en: "How does the forum work?",
        res: `Cualquiera con sesión crea hilos de tres tipos: «Busco compañeros», «Charla» y «Dudas». Puedes responder al hilo o a un mensaje concreto (a quien le respondes le llega a la campana). En «Busco compañeros», «Pedir unirme» le manda una solicitud al autor, que acepta a quien quiera hasta llenar el grupo. Con «Avisos» dejas de recibir avisos de un hilo. Lo que no deba estar se denuncia desde el «⋯» del mensaje.`,
        ren: `Anyone signed in can create three kinds of thread: “Looking for players”, “Chat” and “Questions”. You can reply to the thread or to a specific message (whoever you reply to gets it in their bell). In “Looking for players”, “Ask to join” sends a request to the author, who accepts whoever they want until the group is full. With “Notifications” you stop getting alerts from a thread. Anything that shouldn't be there can be reported from the message's “⋯”.`
      },
      {
        es: "¿Con quién puedo chatear?", en: "Who can I chat with?",
        res: `Con tus amigos: el botón del bocadillo, junto a la campana. Cada locke con varios jugadores tiene además su propio chat (el botón «Chat» del locke). Los mensajes caducan a los 90 días. Desde el chat puedes bloquear o denunciar a alguien.`,
        ren: `With your friends: the speech bubble button, next to the bell. Every locke with several players also has its own chat (the locke's “Chat” button). Messages expire after 90 days. From the chat you can block or report someone.`
      },
      {
        es: "¿Cómo funcionan los combates entre amigos?", en: "How do battles between friends work?",
        res: `En «Combates», «Retar a un amigo»: eliges tu equipo y él elige el suyo al aceptar. El combate lo calcula el motor de Showdown en vuestros navegadores y va por turnos: cada uno elige cuando puede, no hace falta estar a la vez. Desde un combate de un locke, «Retar» reta a tu rival en ese combate y, al terminar, la victoria se apunta sola. La sección aún está en pruebas.`,
        ren: `In “Battles”, “Challenge a friend”: you choose your team and they choose theirs when accepting. The battle is calculated by Showdown's engine in your browsers and goes turn by turn: each one picks when they can, you don't need to be there at the same time. From a locke battle, “Challenge” challenges your rival in that battle and, when it ends, the win is recorded automatically. The section is still in testing.`
      },
      {
        es: "¿Qué son los retos del día?", en: "What are the daily challenges?",
        res: `En «Juegos» hay nueve retos (adivinar la silueta, por pistas, gritos, tipos, el intruso, el locke del día...). Son los mismos para todo el mundo y cambian cada día a medianoche (hora de España). Cada uno da Pokédólares según lo bien que lo hagas, y jugar días seguidos da un extra. La clasificación es solo con tus amigos, por semana o de siempre.`,
        ren: `In “Games” there are nine challenges (guess the silhouette, by clues, cries, types, the odd one out, the locke of the day...). They're the same for everyone and change every day at midnight (Spanish time). Each one gives Pokédollars depending on how well you do, and playing on consecutive days gives a bonus. The leaderboard is only with your friends, weekly or all-time.`
      },
      {
        es: "¿Para qué sirven los Pokédólares?", en: "What are Pokédollars for?",
        res: `Se ganan con los retos del día, con los logros y al terminar lockes, y se gastan en la «Tienda»: fondos para tu tarjeta, marcos para tu foto, títulos y huevos para tu colección de Pokémon. Todo es estético: nada cambia tus lockes.`,
        ren: `You earn them with the daily challenges, with achievements and by finishing lockes, and spend them in the “Shop”: backgrounds for your card, frames for your picture, titles and eggs for your Pokémon collection. It's all cosmetic: nothing changes your lockes.`
      },
      {
        es: "¿Cómo se consiguen los logros?", en: "How do you get achievements?",
        res: `Solos, usando la web: ganando lockes, perdiendo Pokémon, guardando equipos, marcando rutas, haciendo retos... En «Logros» ves todos, lo que pide cada uno y lo que te falta. Hace falta tener sesión, porque se guardan en tu perfil. Cada logro da Pokédólares. Con 25 logros, con 50 y con todos desbloqueas el fondo y el marco de plata, oro y platino, y cada logro de tipo (15 Pokémon distintos de ese tipo en tus equipos guardados), el fondo y el marco de ese tipo.`,
        ren: `By themselves, using the site: winning lockes, losing Pokémon, saving teams, marking routes, doing challenges... In “Achievements” you see them all, what each one asks for and what you're missing. You need to be signed in, because they're saved to your profile. Each achievement gives Pokédollars. With 25 achievements, with 50 and with all of them you unlock the silver, gold and platinum background and frame, and each type achievement (15 different Pokémon of that type in your saved teams) unlocks that type's background and frame.`
      }
    ]
  }
];

// La sección abierta → el tema con el que se abre
const TEMA_DE_VISTA = {
  inicio: "empezar", lockes: "lockes", normas: "lockes",
  jugar: "partida", rutas: "partida", levelcaps: "partida",
  equipos: "equipos", crear: "equipos", pokedex: "equipos", calculadora: "equipos",
  randomizer: "herramientas", ruleta: "herramientas",
  foro: "comunidad", amigos: "comunidad", lucha: "comunidad", juegos: "comunidad", tienda: "comunidad", logros: "comunidad"
};

let dialogo = null;
let tema = "empezar";

function normalizar(texto) {
  return quitarAcentos(String(texto).replace(/<[^>]+>/g, " ")).toLowerCase();
}

function plantillaPregunta(pregunta, abierta) {
  return `
    <details ${abierta ? "open" : ""}>
      <summary>${escaparHTML(segunIdioma(pregunta.es, pregunta.en))}</summary>
      <p>${segunIdioma(pregunta.res, pregunta.ren)}</p>
    </details>`;
}

function pintar() {
  const buscado = normalizar(dialogo.querySelector(".ayuda-buscar").value.trim());
  for (const boton of dialogo.querySelectorAll(".ayuda-temas button")) {
    const activa = !buscado && boton.dataset.tema === tema;
    boton.classList.toggle("activa", activa);
    boton.setAttribute("aria-pressed", String(activa));
  }

  const lista = dialogo.querySelector(".ayuda-lista");
  if (buscado) {
    const palabras = buscado.split(/\s+/);
    const halladas = TEMAS.flatMap((cada) => cada.preguntas).filter((pregunta) => {
      const texto = normalizar(`${segunIdioma(pregunta.es, pregunta.en)} ${segunIdioma(pregunta.res, pregunta.ren)}`);
      return palabras.every((palabra) => texto.includes(palabra));
    });
    lista.innerHTML = halladas.length
      ? halladas.map((pregunta) => plantillaPregunta(pregunta, halladas.length <= 2)).join("")
      : `<p class="ayuda-nada">${t("No hay ninguna pregunta con eso. Si no encuentras la respuesta, escríbeme en «Enviar sugerencia», en Inicio.")}</p>`;
    return;
  }
  const temas = tema === "todas" ? TEMAS : TEMAS.filter((cada) => cada.id === tema);
  lista.innerHTML = temas
    .map((cada) => `${tema === "todas" ? `<h3 class="ayuda-tema-titulo">${icono(cada.icono)} ${segunIdioma(cada.es, cada.en)}</h3>` : ""}
      ${cada.preguntas.map((pregunta) => plantillaPregunta(pregunta, false)).join("")}`)
    .join("");
  lista.scrollTop = 0;
}

function crear() {
  dialogo = document.querySelector("#dialogo-ayuda");
  dialogo.innerHTML = `
    <h2>${t("Preguntas frecuentes")}</h2>
    <label class="ayuda-buscar-caja">
      ${icono("lupa")}
      <input class="ayuda-buscar" type="search" placeholder="${t("Busca tu duda…")}" aria-label="${t("Busca tu duda…")}">
    </label>
    <div class="ayuda-temas" role="group" aria-label="${t("Temas")}">
      ${TEMAS.map((cada) => `<button data-tema="${cada.id}">${icono(cada.icono)} ${segunIdioma(cada.es, cada.en)}</button>`).join("")}
      <button data-tema="todas">${t("Todas")}</button>
    </div>
    <div class="ayuda-lista"></div>
    <div class="dialogo-botones">
      <button class="ayuda-cerrar">${t("Cerrar")}</button>
    </div>`;

  dialogo.querySelector(".ayuda-buscar").addEventListener("input", pintar);
  dialogo.addEventListener("click", (e) => {
    if (e.target.closest(".ayuda-cerrar")) return dialogo.close();
    const boton = e.target.closest(".ayuda-temas button");
    if (!boton) return;
    tema = boton.dataset.tema;
    dialogo.querySelector(".ayuda-buscar").value = "";
    pintar();
  });
}

export function abrirAyuda() {
  if (!dialogo) crear();
  const vista = decodeURIComponent(location.hash.slice(1)) || "inicio";
  tema = TEMA_DE_VISTA[vista] || "empezar";
  dialogo.querySelector(".ayuda-buscar").value = "";
  pintar();
  dialogo.showModal();
}
