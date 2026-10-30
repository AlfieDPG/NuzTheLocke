// Inglés: todas las secciones juntas. Lo carga js/comun/idioma.js solo si la web va en inglés.
// Cada archivo es { "texto en español": "English text" } (ver idioma.js).

import comun from "./comun.js";
import inicio from "./inicio.js";
import equipos from "./equipos.js";
import pagina from "./pagina.js";
import lockes from "./lockes.js";
import rutas from "./rutas.js";
import pokedex from "./pokedex.js";
import calculadora from "./calculadora.js";
import normas from "./normas.js";
import logros from "./logros.js";
import amigos from "./amigos.js";
import perfil from "./perfil.js";
import randomizer from "./randomizer.js";
import foro from "./foro.js";
import chat from "./chat.js";
import juegos from "./juegos.js";
import jugar from "./jugar.js";

export default { ...comun, ...pagina, ...inicio, ...equipos, ...lockes, ...rutas, ...pokedex, ...calculadora, ...normas, ...logros, ...amigos, ...perfil, ...randomizer, ...foro, ...chat, ...juegos, ...jugar };
