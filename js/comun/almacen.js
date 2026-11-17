// Datos guardados en el navegador (localStorage) en formato JSON.
// Si el navegador no deja leer o guardar, la web sigue funcionando.
//
// El navegador sigue siendo el sitio donde se guarda todo: la nube (js/comun/nube.js)
// solo es una copia para poder entrar desde otro sitio. Así la web funciona igual sin
// conexión y sin haber iniciado sesión, y leer() y escribir() siguen siendo inmediatos.

// Claves que se copian a la nube: son las cosas que ha hecho el usuario.
// NO entran las cachés de datos descargados (poketeams-datos-*, poketeams-pokedex-*),
// que cada navegador se rehace solo y solo servirían para gastar cuota.
export const CLAVES_SINCRONIZADAS = [
  "poketeams-equipo-v1",                  // equipo que se está editando
  "poketeams-equipos-v1",                 // «Mis equipos»
  "poketeams-actual-v1",                  // nombre e id del equipo en edición
  "poketeams-equipos-orden-v1",           // si ya se ordenaron los equipos una vez
  "poketeams-equipos-vista-v1",           // tarjetas o lista
  "poketeams-grupos-v1",                  // grupos de «Mis equipos»
  "poketeams-rutas-v2",                   // rutas marcadas
  "poketeams-capturas-v1",                // qué se capturó en cada lugar (rutas/capturas.js)
  "poketeams-rutas-juego-v1",             // juego elegido en «Rutas»
  "poketeams-rutas-hierba-v1",            // juegos con los pueblos con hierba del randomizer
  "poketeams-levelcaps-v2",               // combates superados
  "poketeams-levelcaps-juego-v1",         // juego elegido en «Level caps»
  "poketeams-levelcaps-multiplicador-v1", // multiplicador de nivel
  "poketeams-normas-v2",                  // conjuntos de normas propios
  "poketeams-contadores-v1",              // veces que se ha hecho algo (para los logros)
  "poketeams-ruletas-v1",                 // ruletas
  "poketeams-rutas-propias-v1",           // rutas personalizadas
  "poketeams-levelcaps-propios-v1",       // level caps personalizados
  "poketeams-partidas-v1",                // partidas vinculadas a los lockes (js/partida)
  "poketeams-registrados-v1",             // Pokémon que has tenido alguna vez (comun/registro.js)
  "poketeams-lockes-quitados-v1",         // lockes terminados que has quitado de tu lista (versus)
  "poketeams-avisos-arbitro-v1",          // avisos del árbitro que ya has visto en la campana (avisos.js)
  "poketeams-ajustes-v1",                 // tema (comun/ajustes.js)
  "poketeams-juegos-propios-v1",          // los de antes (rutas y level caps juntos): se pasan
                                          // solos a los dos de arriba (personalizados.js)
  // Desde 2026-11-17, también lo que antes se quedaba solo en el navegador (para no perderlo al cambiar
  // de dirección la web ni de dispositivo). Lo que solo es caché (datos, Pokédex, ataques), no.
  "poketeams-randomizer-v1",              // tus normas del randomizer (randomizer/reglas.js)
  "poketeams-randomizer-guardadas-v1",    // normas del randomizer guardadas con nombre
  "poketeams-randomizer-semillas-v1",     // la semilla de cada locke: misma semilla = misma ROM
  "poketeams-randomizer-aviso-carpeta-v1", // aviso de la carpeta de Switch ya visto
  "poketeams-luchas-pendientes-v1",       // elecciones selladas sin destapar (comun/luchas.js)
  "poketeams-lucha-sonido-v1",            // sonido en los combates
  "poketeams-jugar-v1",                   // la partida elegida en «Jugar»
  "poketeams-jugar-ajustes-v1",           // controles y ajustes de «Jugar»
  "poketeams-juegos-v1",                  // el reto del día a medias (juegos/comun.js)
  "poketeams-amigos-vista-v1",            // cómo se ve la lista de Amigos
  "poketeams-buscar-ajustes-v1",          // ajustes de «Buscar equipo»
  "poketeams-buscar-locke-v1",            // último locke elegido en «Buscar equipo»
  "poketeams-lockes-plegados-v1",         // lockes plegados
  "poketeams-normas-ultimo-v1",           // último conjunto de normas mirado
  "poketeams-pokedex-juego-v1",           // juego elegido en la ficha de la Pokédex
  "poketeams-progreso-locke-v1",          // locke elegido para cada juego en Rutas y Level caps
  "poketeams-avisos-leidos-v1",           // novedades y avisos ya leídos (Inicio)
  "poketeams-avisos-foro-v1",             // avisos del foro ya vistos
  "poketeams-avisos-foro-otros-v1",       // otros avisos del foro ya vistos
  "poketeams-normas-ajenas-quitadas-v1",  // normas de otros ya quitadas (comun/lockes.js)
  "poketeams-rutas-limpias-v1"            // lockes cerrados cuyas Rutas ya se limpiaron
];

// Cuándo se cambió cada clave por última vez: { clave: milisegundos }.
// Sirve para decidir, al entrar, si manda lo del navegador o lo de la nube.
const CLAVE_TIEMPOS = "poketeams-tiempos-v1";

function bruto(clave, porDefecto) {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch (error) {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    return false;
  }
}

export function leer(clave, porDefecto) {
  return bruto(clave, porDefecto);
}

export function tiempos() {
  return bruto(CLAVE_TIEMPOS, {});
}

function apuntarTiempo(clave, cuando) {
  const todos = tiempos();
  todos[clave] = cuando;
  guardar(CLAVE_TIEMPOS, todos);
}

// A quién avisar cuando cambie algo que se sincroniza (nube.js, para subirlo, y logros.js,
// para mirar si se ha conseguido alguno)
const oyentes = new Set();

export function alCambiar(funcion) {
  oyentes.add(funcion);
}

// Devuelve false si el navegador no deja guardar
export function escribir(clave, valor) {
  const ok = guardar(clave, valor);
  if (!ok || !CLAVES_SINCRONIZADAS.includes(clave)) return ok;

  apuntarTiempo(clave, Date.now());
  for (const funcion of oyentes) funcion(clave);
  return ok;
}

// Borra de este navegador todo lo que se sincroniza, con sus fechas. Se usa cuando entra
// una cuenta distinta de la última que usó este navegador, para no mezclar datos de dos
// personas (si no, los equipos del anterior acabarían subidos a la cuenta del nuevo).
export function vaciarSincronizadas() {
  for (const clave of CLAVES_SINCRONIZADAS) {
    try {
      localStorage.removeItem(clave);
    } catch (error) {
      // si el navegador no deja, se queda como esté
    }
  }
  guardar(CLAVE_TIEMPOS, {});
}

// Guarda algo que viene de la nube: se respeta su fecha y no se vuelve a subir.
// Devuelve true si el valor era distinto del que había.
export function escribirDesdeLaNube(clave, valor, cuando) {
  const cambia = JSON.stringify(bruto(clave, null)) !== JSON.stringify(valor);
  guardar(clave, valor);
  apuntarTiempo(clave, cuando);
  return cambia;
}
