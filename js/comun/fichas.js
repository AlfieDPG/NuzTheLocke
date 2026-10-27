// ---------- Pokédólares ----------
//
// Los puntos de la web. Se ganan con los logros (según su nivel) y con los retos del día de
// «Juegos», y se gastan en la Tienda en cosas que solo se ven: fondos para la tarjeta, marcos
// para la foto y títulos. Nada que cambie los lockes.
//
// El saldo no se guarda: se calcula.
//   saldo = Pokédólares de tus logros + perfil.juegos.ganadas − lo pagado (perfil.compras)
//           − lo gastado en huevos + lo devuelto por repetidos (perfil.huevos, ver coleccion.js)
// Así cada logro da sus Pokédólares (también los conseguidos antes de que hubiera Pokédólares) sin
// apuntar nada más.
//
//   perfiles/{uid}.juegos   { ganadas, racha, dia, ultima, semana, semanales }: lo ganado
//                           jugando, los días seguidos, el último día jugado, la última jugada,
//                           y el lunes de esa semana con lo ganado en ella (la clasificación
//                           entre amigos sale de aquí: los perfiles de los amigos ya se leen)
//   perfiles/{uid}.compras  { idArticulo: Pokédólares pagados }
//   perfiles/{uid}.marco    el marco de la foto que lleva puesto
//   jugadas/{uid}_{juego}_{dia}  { uid, juego, dia, puntos, intentos, acierto, cuando }
//
// Cada reto terminado crea su jugada y sube «ganadas» en el mismo lote. Las reglas
// (firestore.rules, «Juegos») solo dejan una jugada por juego y día, del día de hoy, con
// PUNTOS_MAX como mucho, y que «ganadas» suba justo lo de esa jugada: no se puede repetir un
// reto ni apuntarse Pokédólares de más jugando. Las compras solo las comprueba la web.
//
// El día es el de España (Europe/Madrid) para todo el mundo: el reto cambia a medianoche
// de aquí y es el mismo para todos.

import { usuarioActual, baseDeDatos } from "./nube.js";
import { miPerfil, guardarMiPerfil, perfilesDeAmigos } from "./perfiles.js";
import { LOGROS } from "./logros.js";
import { FONDOS_TIENDA, fondoDe, claseFondo, estiloFondo } from "./fondos.js";
import { tiposEs } from "./tipos.js";
import { t } from "./idioma.js";

export const FICHAS_POR_NIVEL = { bronce: 10, plata: 25, oro: 50, platino: 100 };

// Lo más que puede dar un reto (el mejor resultado y la racha más larga). Las reglas lo miran.
export const PUNTOS_MAX = 70;
const BONO_POR_DIA = 2;
const BONO_MAX = 20;

// ---------- Días ----------

export function hoy() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function diaAntes(dia, cuantos = 1) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - cuantos);
  return fecha.toISOString().slice(0, 10);
}

// El lunes de la semana de ese día (la clasificación va de lunes a domingo)
export function lunesDe(dia) {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay(); // 0 domingo ... 6 sábado
  return diaAntes(dia, (semana + 6) % 7);
}

// Los Pokédólares ganados jugando esta semana (0 si lo último que jugó es de otra semana)
export function fichasDeLaSemana(perfil) {
  const juegos = (perfil && perfil.juegos) || {};
  return juegos.semana === lunesDe(hoy()) ? Number(juegos.semanales) || 0 : 0;
}

export function jugoHoy(perfil) {
  return ((perfil && perfil.juegos) || {}).dia === hoy();
}

// La racha que llevas: los días seguidos con algún reto jugado, contando hoy o ayer (si hoy
// aún no has jugado, no se ha roto)
export function rachaDe(perfil) {
  const juegos = (perfil && perfil.juegos) || {};
  const dia = hoy();
  return juegos.dia === dia || juegos.dia === diaAntes(dia) ? Number(juegos.racha) || 0 : 0;
}

function rachaTrasJugar(juegos, dia) {
  if (juegos.dia === dia) return Math.max(1, Number(juegos.racha) || 1);
  if (juegos.dia === diaAntes(dia)) return (Number(juegos.racha) || 0) + 1;
  return 1;
}

// Lo que suma la racha a cada reto: 2 por cada día seguido después del primero, hasta 20
export function bonoRacha(racha) {
  return Math.min(Math.max(racha - 1, 0) * BONO_POR_DIA, BONO_MAX);
}

// ---------- Azar del día ----------
//
// El mismo para todo el mundo: sale de la fecha y del nombre del juego.

export function azarDelDia(semilla) {
  let h = 2166136261;
  for (const letra of semilla) h = Math.imul(h ^ letra.charCodeAt(0), 16777619);
  let estado = h >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let x = estado;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Saldo ----------

export function fichasDeLogros(perfil) {
  const tengo = (perfil && perfil.logros) || {};
  return LOGROS.reduce((suma, logro) => suma + (tengo[logro.id] ? FICHAS_POR_NIVEL[logro.nivel] || 0 : 0), 0);
}

export function fichasDeJuegos(perfil) {
  return Number(((perfil && perfil.juegos) || {}).ganadas) || 0;
}

// Solo lo que sigue a la venta: si algo deja de venderse (los marcos de metal pasaron a ser
// de logros), lo pagado vuelve al saldo
export function gastadas(perfil) {
  const aLaVenta = new Set(ARTICULOS.map((articulo) => articulo.id));
  return Object.entries((perfil && perfil.compras) || {})
    .filter(([id]) => aLaVenta.has(id))
    .reduce((suma, [, precio]) => suma + (Number(precio) || 0), 0);
}

// Los huevos de «Colección» (js/comun/coleccion.js): lo que se ha ido en ellos y lo que ha
// vuelto por repetidos
export function balanceHuevos(perfil) {
  const huevos = (perfil && perfil.huevos) || {};
  return (Number(huevos.devueltos) || 0) - (Number(huevos.gastados) || 0);
}

export function saldo(perfil) {
  return Math.max(0, fichasDeLogros(perfil) + fichasDeJuegos(perfil) - gastadas(perfil) + balanceHuevos(perfil));
}

// ---------- Jugadas ----------

const idJugada = (uid, juego, dia) => `${uid}_${juego}_${dia}`;

// La jugada de hoy de ese juego, si ya la hay (p. ej. jugado en otro dispositivo), o null
export async function jugadaDeHoy(juego) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return null;
  const { bd, fn } = acceso;
  const documento = await fn.getDoc(fn.doc(bd, "jugadas", idJugada(usuario.uid, juego, hoy())));
  return documento.exists() ? documento.data() : null;
}

// Apunta un reto terminado y suma sus Pokédólares (con el bono de la racha).
// Devuelve { puntos, bono, racha }, o null sin sesión.
export async function guardarJugada(juego, { puntos, intentos, acierto }) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  const perfil = miPerfil();
  if (!usuario || !acceso || !perfil) return null;

  const { bd, fn } = acceso;
  const dia = hoy();
  const id = idJugada(usuario.uid, juego, dia);
  const antes = perfil.juegos || {};
  const racha = rachaTrasJugar(antes, dia);
  const total = Math.min(Math.round(puntos) + bonoRacha(racha), PUNTOS_MAX);

  const lote = fn.writeBatch(bd);
  lote.set(fn.doc(bd, "jugadas", id), {
    uid: usuario.uid, juego, dia, puntos: total, intentos, acierto, cuando: fn.serverTimestamp()
  });
  const semana = lunesDe(dia);
  const semanales = (antes.semana === semana ? Number(antes.semanales) || 0 : 0) + total;
  lote.update(fn.doc(bd, "perfiles", usuario.uid), {
    juegos: { ganadas: fichasDeJuegos(perfil) + total, racha, dia, ultima: id, semana, semanales }
  });
  await lote.commit();
  return { puntos: total, bono: total - Math.round(puntos), racha };
}

// Al borrar la cuenta, después de borrar el perfil (las reglas solo dejan borrarlas entonces)
export async function borrarMisJugadas() {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  const instantanea = await fn.getDocs(fn.query(fn.collection(bd, "jugadas"), fn.where("uid", "==", usuario.uid)));
  for (let i = 0; i < instantanea.docs.length; i += 400) {
    const lote = fn.writeBatch(bd);
    for (const documento of instantanea.docs.slice(i, i + 400)) lote.delete(documento.ref);
    await lote.commit();
  }
}

// ---------- Tienda ----------
//
// Los ids NO se cambian: son los que quedan guardados en perfil.compras (por eso algunos
// marcos de tipo tienen el nombre de antes: «marco-hoja» es el de Planta).
// Los fondos están en fondos.js (con los demás fondos); aquí, los marcos y los títulos.
//
// El precio va por lo elaborado que es, no por gustos: lo que es igual de trabajado cuesta
// lo mismo. La Tienda los enseña siempre del más barato al más caro.

// Marcos: uno por tipo, todos con el mismo diseño (borde y aro del color del tipo, con un
// brillo suave: css/juegos.css, .marco-de-tipo) y el mismo precio; los animados (con
// movimiento), todos al mismo precio, más caro; y los de metal, que no se compran.
const PRECIO_MARCO_TIPO = 200;
const PRECIO_MARCO_ANIMADO = 800;

const MARCO_DE_TIPO = {
  normal: "marco-normal", fire: "marco-brasa", water: "marco-burbuja", electric: "marco-rayo",
  grass: "marco-hoja", ice: "marco-hielo", fighting: "marco-lucha", poison: "marco-veneno",
  ground: "marco-tierra", flying: "marco-volador", psychic: "marco-psiquico", bug: "marco-bicho",
  rock: "marco-roca", ghost: "marco-sombra", dragon: "marco-dragon", dark: "marco-noche",
  steel: "marco-acero", fairy: "marco-hada"
};

export const MARCOS = [
  ...Object.entries(MARCO_DE_TIPO).map(([tipo, id]) => ({ id, nombre: tiposEs[tipo], tipo, precio: PRECIO_MARCO_TIPO })),
  { id: "marco-arcoiris", nombre: t("Arcoíris"), precio: PRECIO_MARCO_ANIMADO },
  { id: "marco-estelar", nombre: t("Estelar"), precio: PRECIO_MARCO_ANIMADO },
  { id: "marco-aura", nombre: t("Aura"), precio: PRECIO_MARCO_ANIMADO },
  { id: "marco-llamarada", nombre: t("Llamarada"), precio: PRECIO_MARCO_ANIMADO },
  { id: "marco-latido", nombre: t("Latido"), precio: PRECIO_MARCO_ANIMADO },
  { id: "marco-chispazo", nombre: t("Chispazo"), precio: PRECIO_MARCO_ANIMADO },
  // Los de metal no se compran: vienen con los mismos logros que los fondos de metal
  // (25 logros, 50 y todos: ver LOGROS_PARA_PLATA y LOGROS_PARA_ORO en logros.js)
  { id: "marco-plata", nombre: t("Plata"), logro: "m-30" },
  { id: "marco-dorado", nombre: t("Oro"), logro: "m-60" },
  { id: "marco-platino", nombre: t("Platino"), logro: "m-todos" }
];

// Títulos: cada uno es una plaquita con su propio diseño (css/juegos.css, .titulo-<id>). El
// precio, por lo trabajado que está: sencillos (un color), detallados (degradados o dibujo) y
// animados (con movimiento). «nivel» solo da el color de respaldo (el de los títulos de logros).
const PRECIO_TITULO = { sencillo: 150, detallado: 350, animado: 800 };

export const TITULOS = [
  { id: "titulo-ojo", nombre: t("Ojo de halcón"), nivel: "bronce", acabado: "sencillo" },
  { id: "titulo-detective", nombre: t("Detective Pokémon"), nivel: "bronce", acabado: "sencillo" },
  { id: "titulo-madrugador", nombre: t("Madrugador"), nivel: "bronce", acabado: "sencillo" },
  { id: "titulo-estratega", nombre: t("Estratega"), nivel: "plata", acabado: "sencillo" },
  { id: "titulo-alma", nombre: t("Alma de entrenador"), nivel: "plata", acabado: "sencillo" },
  { id: "titulo-trotamundos", nombre: t("Trotamundos"), nivel: "plata", acabado: "sencillo" },
  { id: "titulo-casino", nombre: t("Habitual del Casino"), nivel: "plata", acabado: "detallado" },
  { id: "titulo-profesor", nombre: t("Profesor en prácticas"), nivel: "plata", acabado: "detallado" },
  { id: "titulo-racha", nombre: t("Racha imparable"), nivel: "oro", acabado: "detallado" },
  { id: "titulo-siluetas", nombre: t("Maestro de las siluetas"), nivel: "oro", acabado: "detallado" },
  { id: "titulo-tipos", nombre: t("Domador de tipos"), nivel: "oro", acabado: "detallado" },
  { id: "titulo-calle", nombre: t("Veterano de Calle Victoria"), nivel: "oro", acabado: "detallado" },
  { id: "titulo-coleccionista", nombre: t("Gran coleccionista"), nivel: "platino", acabado: "animado" },
  { id: "titulo-leyenda", nombre: t("Leyenda del Casino"), nivel: "platino", acabado: "animado" },
  { id: "titulo-nuzlocke", nombre: t("Maestro Nuzlocke"), nivel: "platino", acabado: "animado" },
  { id: "titulo-leyendas", nombre: t("Cazador de leyendas"), nivel: "platino", acabado: "animado" },
  { id: "titulo-campeon", nombre: t("Campeón de la Liga"), nivel: "oro", acabado: "animado" },
  { id: "titulo-guardian", nombre: t("Guardián de la Pokédex"), nivel: "platino", acabado: "animado" }
].map((titulo) => ({ ...titulo, precio: PRECIO_TITULO[titulo.acabado] }));

// Las clases con las que se pinta un título (el de un logro o uno de la Tienda), donde salga
export function claseTitulo(titulo) {
  if (!titulo) return "";
  return `nivel-${titulo.nivel} ${titulo.id && titulo.id.startsWith("titulo-") ? `placa-tienda ${titulo.id}` : ""}`;
}

// El título que lleva alguien (perfil.titulo): uno de sus logros o uno comprado en la Tienda,
// solo si de verdad lo tiene. null si ninguno.
export function tituloDe(perfil) {
  const id = perfil && perfil.titulo;
  if (!id) return null;
  const logro = LOGROS.find((cada) => cada.id === id);
  if (logro) return (perfil.logros || {})[id] ? logro : null;
  const comprado = TITULOS.find((cada) => cada.id === id);
  return comprado && loTiene(perfil, id) ? comprado : null;
}

// Su plaquita, para ponerla junto a su nombre (Amigos, el foro, la clasificación...). «clase»:
// p. ej. «pequeno», para los sitios con poco hueco. "" si no lleva título.
export function plantillaTituloDe(perfil, clase = "") {
  const titulo = tituloDe(perfil);
  if (!titulo) return "";
  const nombre = String(titulo.nombre).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<span class="perfil-titulo ${claseTitulo(titulo)} ${clase}" title="${nombre}">${nombre}</span>`;
}

// Del más barato al más caro (los que no se compran, al final)
export function porPrecio(lista) {
  return lista.slice().sort((uno, otro) => (uno.precio || Infinity) - (otro.precio || Infinity));
}

// Lo que se compra (los marcos de metal, no)
export const ARTICULOS = [...FONDOS_TIENDA, ...MARCOS.filter((marco) => marco.precio), ...TITULOS];

export function loTiene(perfil, id) {
  return Boolean(((perfil && perfil.compras) || {})[id]);
}

// Un marco: comprado o, los de metal, con su logro
export function tieneMarco(perfil, marco) {
  return marco.logro ? Boolean(((perfil && perfil.logros) || {})[marco.logro]) : loTiene(perfil, marco.id);
}

// El marco que lleva puesto ("" si ninguno o si no lo tiene)
export function marcoDe(perfil) {
  const marco = MARCOS.find((cada) => cada.id === (perfil && perfil.marco));
  return marco && tieneMarco(perfil, marco) ? marco.id : "";
}

export function claseMarco(id) {
  if (!id) return "";
  const marco = MARCOS.find((cada) => cada.id === id);
  return marco && marco.tipo ? `con-marco marco-de-tipo ${id}` : `con-marco ${id}`;
}

// El marco y el fondo de alguien sabiendo solo su uid (foros, lockes, cementerio, chat...):
// salen de los perfiles que la web ya tiene (el tuyo y los de tus amigos, al día) o de los que
// se han leído en otro sitio y se han apuntado con apuntarMarco (los autores del foro). Si no
// se sabe, sin marco ni fondo.
const perfilesDeOtros = new Map(); // uid -> perfil

export function apuntarMarco(perfil) {
  if (perfil && perfil.uid) perfilesDeOtros.set(perfil.uid, perfil);
}

function perfilConocido(uid) {
  const usuario = usuarioActual();
  if (usuario && uid === usuario.uid) return miPerfil();
  return perfilesDeAmigos().get(uid) || perfilesDeOtros.get(uid) || null;
}

export function claseMarcoDe(uid) {
  const perfil = perfilConocido(uid);
  return claseMarco(perfil ? marcoDe(perfil) : "");
}

// Su fondo (el de su tarjeta de «Amigos»), para ponerlo en un trozo de otra cosa: la cabecera
// de su ficha en un locke, la ficha del foro, el cara a cara de «Amigos»... Devuelve la clase
// (con «lleva-fondo», que es la que dibuja: css/amigos.css y css/juegos.css) y el estilo.
export function fondoVisual(perfil) {
  const id = perfil ? fondoDe(perfil) : "";
  return id ? { clase: `lleva-fondo ${claseFondo(id)}`, estilo: estiloFondo(id) } : { clase: "", estilo: "" };
}

export function fondoVisualDe(uid) {
  return fondoVisual(perfilConocido(uid));
}

// Compra un artículo si llegan los Pokédólares. Devuelve "" si ha ido bien, o por qué no.
export async function comprar(id) {
  const perfil = miPerfil();
  const articulo = ARTICULOS.find((cada) => cada.id === id);
  if (!perfil || !articulo) return t("Inicia sesión para usar la Tienda.");
  if (loTiene(perfil, id)) return "";
  if (saldo(perfil) < articulo.precio) return t("No tienes Pokédólares suficientes.");
  await guardarMiPerfil({ [`compras.${id}`]: articulo.precio });
  return "";
}
