// ---------- Lucha: combates entre amigos (datos) ----------
//
// Como los lockes y el chat, esto no pasa por localStorage: se lee y se escribe directamente en
// Firestore. La pantalla está en js/lucha/; las reglas, en firestore.rules («Lucha»).
//
//   luchas/{id}
//     jugadores: [retador, retado]   // en el combate, p1 y p2 (en ese orden)
//     nombres, fotos: { uid: ... }   // copia para pintar la lista sin leer perfiles
//     estado: "reto" | "jugando" | "fin"
//     formato: "gen4customgame@@@Team Preview"..., nivel: "tal" | "50", motor: versión del motor
//     vistaPrevia: true | false      // si se ven los dos equipos antes de empezar (sin el campo: sí)
//     escena: "" | "pradera" | ...   // el escenario que eligió quien retó ("": uno al azar)
//     mirar: true | false            // si los amigos de los dos pueden verlo (mientras se juega y la repetición)
//     mirones: [uid]                 // quiénes pueden verlo: los amigos de cada uno, que los apunta él al retar/aceptar
//     random: { uid: { "6": "fire/water|78,84,..." } }   // en los de un locke con randomizer: los tipos y
//                                    // estadísticas de su ROM de las especies de su equipo (js/comun/randomizados.js)
//     apuesta: 0 | 50 | 100 | 250 | 500   // Pokédólares que pone cada uno (APUESTAS). Ver «Apuestas», abajo.
//     tiempo: true | false           // con tiempo por turno (SEGUNDOS_TURNO); sin el campo, sin tiempo
//     reloj: { n: "0005", desde }    // cuándo empezó a correr el tiempo del turno n (hora del servidor)
//     semilla: { a: [4 números], b: [4 números] }   // a, de quien reta; b, de quien acepta
//     equipos: { uid: paste }        // el equipo de cada uno, como paste de Showdown
//     caras: { uid: [Pokémon] }      // lo justo para pintar sus retratos (pokemonParaCopia)
//     locke: { id, combate } | null  // si es un combate de un locke de «Lockes»
//     espera: [uid]                  // a quién le toca elegir (lo apunta la pantalla del combate)
//     ganador: uid | "empate", rendido: uid   // al terminar
//     esperaDesde                    // desde cuándo (hora del servidor) es «espera» como está ahora
//     abandono: uid                  // si acabó porque ese no jugó en DIAS_ABANDONO (ganó el otro al pedirlo)
//     porTiempo: uid                 // si acabó porque a ese se le acabó el tiempo MAX_SIN_TIEMPO veces seguidas
//     creado, actualizado: milisegundos
//   luchas/{id}/turnos/{n}           // n = "0000", "0001"...: cada vez que alguien tiene que elegir
//     s1, s2: sellos (el resumen SHA-256 de la elección, para no poder verla antes de elegir)
//     e1, e2: elecciones ("move 1|sal", "switch 3|sal", "team 213456|sal")
//     t1, t2: true si a ese se le acabó el tiempo en este turno: se elige solo («default» del motor)
//
// Cosas que parecen raras y tienen su razón:
//
//   · No hay servidor: cada navegador calcula el combate entero con el motor de Showdown y la
//     misma semilla, y solo se apuntan las elecciones. Con las mismas elecciones sale el mismo
//     combate en los dos (el motor es determinista), así que basta con eso, y al volver a entrar
//     se rehace desde el principio.
//   · El sello: cuando los dos eligen a la vez, cada uno apunta primero el resumen de su elección
//     (s1/s2) y solo cuando están los dos, la elección de verdad (e1/e2). Así nadie puede esperar
//     a ver la del otro. Lo comprueba cada navegador (las reglas no saben hacer SHA-256): si la
//     elección no casa con su sello, se avisa de trampa. Lo que se elige solo (un cambio tras un
//     debilitado) va sin sello.
//   · La semilla son dos mitades, una de cada jugador: quien reta no sabe la de quien acepta.
//   · Ganador: lo apunta el navegador del que antes vea el final; las reglas solo dejan pasar de
//     «jugando» a «fin» una vez.
//   · Borrar una lucha: sus turnos primero (Firestore no borra lo de dentro solo).
//   · Apuestas: cada uno deja lo suyo apostado al retar o al aceptar (perfil.apuestas[id] = -n, en el
//     mismo lote: lo exigen las reglas). Al terminar, el ganador cobra (de -n a +n: lo suyo y lo del otro);
//     en un empate cada uno recupera lo suyo (0). Un reto con apuesta no se borra al rechazarlo: pasa a
//     «rechazado» y quien retó recupera lo suyo y lo borra (liquidarApuestas, solo). Con apuesta, el resultado
//     solo lo puede apuntar quien pierde: nadie se puede dar por ganador. Y no se borra hasta que esté pagado.
//   · El tiempo: al acabar de verse lo que pasa en un turno, el primer navegador que llega apunta en
//     «reloj» la hora del servidor (solo una vez por turno: las reglas no dejan volver a ponerlo).
//     Pasado SEGUNDOS_TURNO, cualquiera de los dos puede apuntar t1/t2 del que no ha elegido (las
//     reglas miran la hora), y ese elige «default». A la MAX_SIN_TIEMPO.ª vez seguida, pierde.

import { leer, escribir } from "./almacen.js";
import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { miPerfil, perfilesDeAmigos, amigosAceptados, alCambiarMiPerfil } from "./perfiles.js";

export const MAX_PASTE = 8000;
export const SEGUNDOS_TURNO = 60;
export const MAX_MIRONES = 400;
export const APUESTAS = [0, 50, 100, 250, 500];
export const DIAS_ABANDONO = 1; // también en firestore.rules (abandonoBien)
export const MAX_SIN_TIEMPO = 3;

// Elecciones que esperan el sello del otro para destaparse: { "idLucha/n": "move 1|sal" }.
// En el navegador, por si se recarga entre sellar y destapar.
const CLAVE_PENDIENTES = "poketeams-luchas-pendientes-v1";

function acceso() {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  if (!base || !usuario) throw new Error("sin-sesion");
  return { ...base, usuario };
}

// ---------- Mis luchas, en vivo ----------

let todas = [];
let fallo = "";
let dejarDeEscuchar = null;
let mirables = [];              // los de amigos que puedo mirar (mirones contiene mi uid)
let dejarDeMirar = null;
const oyentes = new Set();

function avisar() {
  for (const funcion of oyentes) funcion();
}

export function alCambiarLuchas(funcion) {
  oyentes.add(funcion);
  funcion();
  return () => oyentes.delete(funcion);
}

export function misLuchas() {
  return todas;
}

export function fallanLasLuchas() {
  return fallo;
}

export function luchaPorId(id) {
  return todas.find((lucha) => lucha.id === id) || mirables.find((lucha) => lucha.id === id) || null;
}

// Los combates de mis amigos que puedo mirar (en marcha y terminados), sin los míos
export function luchasParaMirar() {
  const mias = new Set(todas.map((lucha) => lucha.id));
  return mirables.filter((lucha) => !mias.has(lucha.id) && lucha.estado !== "reto" && lucha.estado !== "rechazado");
}

// Lado de cada uno en el combate: "p1" quien reta, "p2" quien acepta
export function ladoDe(lucha, uid) {
  return lucha.jugadores[0] === uid ? "p1" : lucha.jugadores[1] === uid ? "p2" : null;
}

export function rivalDe(lucha, uid) {
  return lucha.jugadores[0] === uid ? lucha.jugadores[1] : lucha.jugadores[0];
}

// Retos que me han mandado y aún no he contestado (para la campana), solo de amigos de ahora
export function retosRecibidos() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  const amigos = perfilesDeAmigos();
  return todas.filter((lucha) => lucha.estado === "reto" && lucha.jugadores[1] === usuario.uid && amigos.has(lucha.jugadores[0]));
}

// ¿A quién le toca elegir? Solo lo sabe quien rehace el combate (js/lucha/index.js), que lo apunta
// en «espera» (los uid que tienen que elegir) cada vez que cambia. Así la lista y la campana lo
// saben sin abrir el combate. Lo pueden apuntar los dos navegadores: los dos calculan lo mismo.
export function meToca(lucha) {
  const usuario = usuarioActual();
  return Boolean(usuario && lucha.estado === "jugando" && (lucha.espera || []).includes(usuario.uid));
}

export function luchasEnLasQueMeToca() {
  return todas.filter(meToca);
}

export async function ponerEspera(id, uids) {
  const { bd, fn } = acceso();
  const lucha = luchaPorId(id);
  const ahora = [...uids].sort();
  if (!lucha || lucha.estado !== "jugando" || JSON.stringify([...(lucha.espera || [])].sort()) === JSON.stringify(ahora)) return;
  await fn.updateDoc(fn.doc(bd, "luchas", id), { espera: ahora, esperaDesde: fn.serverTimestamp(), actualizado: Date.now() });
}

// ¿Puedo ganar ya por abandono? Le toca solo al otro desde hace más de DIAS_ABANDONO (con un poco de margen
// por si el reloj de este ordenador no va igual que el del servidor)
export function puedoGanarPorAbandono(lucha) {
  const usuario = usuarioActual();
  if (!usuario || !lucha || lucha.estado !== "jugando" || !lucha.esperaDesde) return false;
  const otro = rivalDe(lucha, usuario.uid);
  const espera = lucha.espera || [];
  if (espera.length !== 1 || espera[0] !== otro) return false;
  const desde = typeof lucha.esperaDesde.toMillis === "function" ? lucha.esperaDesde.toMillis() : Number(lucha.esperaDesde);
  return Date.now() > desde + DIAS_ABANDONO * 86400000 + 60000;
}

// Gana quien lo pide porque el otro lleva más de un día sin jugar. Como terminar (true si lo ha apuntado).
export async function ganarPorAbandono(id) {
  const { bd, fn, usuario } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const apuntado = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return false;
    const otro = rivalDe(actual.data(), usuario.uid);
    transaccion.update(referencia, { estado: "fin", ganador: usuario.uid, abandono: otro, actualizado: Date.now() });
    return true;
  });
  olvidarPendientes(id);
  return apuntado;
}

function escuchar(usuario) {
  const { bd, fn } = baseDeDatos();
  const consulta = fn.query(fn.collection(bd, "luchas"), fn.where("jugadores", "array-contains", usuario.uid));
  dejarDeEscuchar = fn.onSnapshot(
    consulta,
    (instantanea) => {
      fallo = "";
      todas = instantanea.docs
        .map((documento) => ({ id: documento.id, ...documento.data({ serverTimestamps: "estimate" }) }))
        .sort((una, otra) => (otra.actualizado || 0) - (una.actualizado || 0));
      avisar();
      liquidarApuestas();
    },
    (error) => {
      console.error("No se pueden leer las luchas", error);
      fallo = error.code === "permission-denied" ? "permisos" : "otro";
      todas = [];
      avisar();
    }
  );
  // Los que puedo mirar. Si falla (reglas sin publicar), sin ellos y nada más.
  dejarDeMirar = fn.onSnapshot(
    fn.query(fn.collection(bd, "luchas"), fn.where("mirones", "array-contains", usuario.uid)),
    (instantanea) => {
      mirables = instantanea.docs
        .map((documento) => ({ id: documento.id, ...documento.data({ serverTimestamps: "estimate" }) }))
        .sort((una, otra) => (otra.actualizado || 0) - (una.actualizado || 0));
      avisar();
    },
    (error) => {
      console.error("No se pueden leer los combates de los amigos", error);
      mirables = [];
      avisar();
    }
  );
}

// ---------- Apuestas: cobrar y devolver solo ----------
//
// Cada vez que cambian mis luchas: si he ganado una con apuesta, cobro; si fue empate, recupero lo mío; si me
// han rechazado un reto con apuesta, recupero lo mío y lo borro. Una vez por lucha y estado (en marcha).
const liquidando = new Set();

function liquidarApuestas() {
  const usuario = usuarioActual();
  const perfil = miPerfil();
  if (!usuario || !perfil) return;
  const mias = perfil.apuestas || {};
  for (const lucha of todas) {
    const n = lucha.apuesta || 0;
    if (!n || mias[lucha.id] !== -n) continue;
    let valor = null;
    if (lucha.estado === "fin" && lucha.ganador === usuario.uid) valor = n;
    else if (lucha.estado === "fin" && lucha.ganador === "empate") valor = 0;
    else if (lucha.estado === "rechazado" && lucha.jugadores[0] === usuario.uid) valor = 0;
    if (valor === null) continue;
    const clave = `${lucha.id}/${lucha.estado}`;
    if (liquidando.has(clave)) continue;
    liquidando.add(clave);
    const { bd, fn } = acceso();
    const lote = fn.writeBatch(bd);
    lote.update(fn.doc(bd, "perfiles", usuario.uid), { [`apuestas.${lucha.id}`]: valor, ultimaApuesta: lucha.id });
    if (lucha.estado === "rechazado") lote.delete(fn.doc(bd, "luchas", lucha.id));
    lote.commit().catch((error) => {
      console.error("No se ha podido cobrar o devolver la apuesta", error);
      liquidando.delete(clave);
    });
  }
}

export function iniciarLuchas() {
  // El perfil puede llegar después que las luchas: entonces también se mira si hay algo que cobrar
  alCambiarMiPerfil(liquidarApuestas);
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    if (dejarDeMirar) dejarDeMirar();
    dejarDeEscuchar = null;
    dejarDeMirar = null;
    todas = [];
    mirables = [];
    fallo = "";
    if (usuario && baseDeDatos()) escuchar(usuario);
    avisar();
  });
}

// ---------- Retar, aceptar, rechazar ----------

// Cuatro números al azar de 16 bits: media semilla del motor (se juntan en js/lucha/combate.js)
function mediaSemilla() {
  return [...crypto.getRandomValues(new Uint16Array(4))];
}

// Mis amigos (sus uid), para «mirones»
function misAmigos() {
  return amigosAceptados().map((amistad) => amistad.otro).slice(0, MAX_MIRONES / 2);
}

function miNombreYFoto() {
  const perfil = miPerfil() || {};
  return { nombre: perfil.mote || perfil.nombre || "", foto: perfil.foto || "" };
}

// equipo: { paste, caras }; locke: { id, combate } o null
export async function retar({ rival, nombreRival, fotoRival, equipo, formato, nivel, motor, vistaPrevia = true, tiempo = false, mirar = false, escena = "", locke = null, random = null, apuesta = 0 }) {
  const { bd, fn, usuario } = acceso();
  const yo = miNombreYFoto();
  const ahora = Date.now();
  const referencia = fn.doc(fn.collection(bd, "luchas"));
  apuesta = APUESTAS.includes(apuesta) ? apuesta : 0;
  const lote = fn.writeBatch(bd);
  if (apuesta) lote.update(fn.doc(bd, "perfiles", usuario.uid), { [`apuestas.${referencia.id}`]: -apuesta, ultimaApuesta: referencia.id });
  lote.set(referencia, {
    apuesta,
    jugadores: [usuario.uid, rival],
    nombres: { [usuario.uid]: yo.nombre, [rival]: nombreRival || "" },
    fotos: { [usuario.uid]: yo.foto, [rival]: fotoRival || "" },
    estado: "reto",
    formato,
    nivel,
    motor,
    vistaPrevia: Boolean(vistaPrevia),
    tiempo: Boolean(tiempo),
    mirar: Boolean(mirar),
    mirones: mirar ? misAmigos() : [],
    ...(random ? { random: { [usuario.uid]: random } } : {}),
    escena: escena || "",
    semilla: { a: mediaSemilla() },
    equipos: { [usuario.uid]: equipo.paste },
    caras: { [usuario.uid]: equipo.caras },
    locke: locke || null,
    creado: ahora,
    actualizado: ahora
  });
  await lote.commit();
  return referencia.id;
}

export async function aceptarReto(id, equipo, random = null) {
  const { bd, fn, usuario } = acceso();
  const yo = miNombreYFoto();
  const lucha = luchaPorId(id);
  const mirones = lucha && lucha.mirar
    ? { mirones: [...new Set([...(lucha.mirones || []), ...misAmigos()])].filter((uid) => !lucha.jugadores.includes(uid)).slice(0, MAX_MIRONES) }
    : {};
  const lote = fn.writeBatch(bd);
  const apuesta = (lucha && lucha.apuesta) || 0;
  if (apuesta) lote.update(fn.doc(bd, "perfiles", usuario.uid), { [`apuestas.${id}`]: -apuesta, ultimaApuesta: id });
  lote.update(fn.doc(bd, "luchas", id), {
    ...mirones,
    ...(random ? { [`random.${usuario.uid}`]: random } : {}),
    estado: "jugando",
    "semilla.b": mediaSemilla(),
    [`equipos.${usuario.uid}`]: equipo.paste,
    [`caras.${usuario.uid}`]: equipo.caras,
    [`nombres.${usuario.uid}`]: yo.nombre,
    [`fotos.${usuario.uid}`]: yo.foto,
    actualizado: Date.now()
  });
}

// Rechazar un reto: con apuesta no se borra (quien retó tiene que recuperar lo suyo: liquidarApuestas)
export async function rechazarReto(id) {
  const lucha = luchaPorId(id);
  if (!lucha || !lucha.apuesta) return borrarLucha(id);
  const { bd, fn } = acceso();
  await fn.updateDoc(fn.doc(bd, "luchas", id), { estado: "rechazado", actualizado: Date.now() });
}

// ¿Se puede quitar ya de la lista? Con apuesta, solo cuando está pagada (lo dicen las reglas)
export function sePuedeQuitar(lucha) {
  if (!lucha.apuesta || lucha.estado !== "fin") return true;
  // El ganador cobra al verla terminada: si aún no, que la quite él (o que espere a que cobre)
  const usuario = usuarioActual();
  const mia = (((miPerfil() || {}).apuestas) || {})[lucha.id];
  if (lucha.ganador === "empate") return mia !== -lucha.apuesta;
  return lucha.ganador === usuario.uid ? mia === lucha.apuesta : true;
}

// Rechazar un reto, retirarlo o quitar una ya terminada de la lista (de los dos)
export async function borrarLucha(id) {
  const { bd, fn } = acceso();
  const lucha = luchaPorId(id);
  // Retirar un reto con apuesta: lo apostado vuelve en el mismo lote
  if (lucha && lucha.apuesta && ["reto", "rechazado"].includes(lucha.estado) && lucha.jugadores[0] === acceso().usuario.uid) {
    const lote = fn.writeBatch(bd);
    const mia = (((miPerfil() || {}).apuestas) || {})[id];
    if (mia === -lucha.apuesta) lote.update(fn.doc(bd, "perfiles", acceso().usuario.uid), { [`apuestas.${id}`]: 0, ultimaApuesta: id });
    lote.delete(fn.doc(bd, "luchas", id));
    await lote.commit();
    olvidarPendientes(id);
    return;
  }
  const turnos = await fn.getDocs(fn.collection(bd, "luchas", id, "turnos"));
  await Promise.all(turnos.docs.map((documento) => fn.deleteDoc(documento.ref)));
  await fn.deleteDoc(fn.doc(bd, "luchas", id));
  olvidarPendientes(id);
}

// Al borrar la cuenta: las mías, fuera (las que están a medias se dan por perdidas antes)
export async function borrarMisLuchas() {
  const usuario = usuarioActual();
  if (!usuario) return;
  for (const lucha of [...todas]) {
    try {
      if (lucha.estado === "jugando") await rendirse(lucha.id);
      await borrarLucha(lucha.id);
    } catch (error) {
      console.error("No se ha podido borrar una lucha", error);
    }
  }
}

// ---------- El final ----------

// ganador: uid o "empate". Devuelve true si ha sido este navegador el que lo ha apuntado (el otro
// ya lo habrá visto terminado): así solo uno de los dos lo apunta también en el locke.
export async function terminar(id, ganador) {
  const { bd, fn } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const apuntado = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return false;
    transaccion.update(referencia, { estado: "fin", ganador, actualizado: Date.now() });
    return true;
  });
  olvidarPendientes(id);
  return apuntado;
}

// Se le ha acabado el tiempo a «quien» demasiadas veces seguidas: gana el otro. Como terminar (true si lo
// ha apuntado este navegador).
export async function terminarPorTiempo(id, quien) {
  const { bd, fn } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const apuntado = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return false;
    const otro = rivalDe(actual.data(), quien);
    transaccion.update(referencia, { estado: "fin", ganador: otro, porTiempo: quien, actualizado: Date.now() });
    return true;
  });
  olvidarPendientes(id);
  return apuntado;
}

// Como terminar, pero ganando el otro. Devuelve el uid del que gana (o null si ya había terminado).
export async function rendirse(id) {
  const { bd, fn, usuario } = acceso();
  const referencia = fn.doc(bd, "luchas", id);
  const ganador = await fn.runTransaction(bd, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists() || actual.data().estado !== "jugando") return null;
    const otro = rivalDe(actual.data(), usuario.uid);
    transaccion.update(referencia, { estado: "fin", ganador: otro, rendido: usuario.uid, actualizado: Date.now() });
    return otro;
  });
  olvidarPendientes(id);
  return ganador;
}

// ---------- Turnos ----------

export function idTurno(n) {
  return String(n).padStart(4, "0");
}

// Todos los turnos de una lucha, en orden, cada vez que cambia alguno: alLlegar([{ n, s1, s2, e1, e2 }])
export function escucharTurnos(id, alLlegar, alFallar) {
  const { bd, fn } = acceso();
  return fn.onSnapshot(
    fn.collection(bd, "luchas", id, "turnos"),
    (instantanea) => {
      const turnos = [];
      for (const documento of instantanea.docs) turnos[Number(documento.id)] = documento.data();
      alLlegar(turnos);
    },
    alFallar
  );
}

// El resumen con el que se sella una elección (texto hexadecimal)
export async function sello(eleccion) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(eleccion));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function conSal(eleccion) {
  const sal = [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${eleccion}|${sal}`;
}

// "move 1|a1b2..." -> "move 1"
export function sinSal(texto) {
  return String(texto || "").replace(/\|[0-9a-f]*$/, "");
}

// Apunta mi sello (s1/s2) o mi elección (e1/e2) en el turno n. La lucha sube arriba de la lista
// cuando cambia «espera» (ponerEspera), no aquí: una escritura menos por turno.
export async function apuntarEnTurno(id, n, campo, valor) {
  const { bd, fn } = acceso();
  await fn.setDoc(fn.doc(bd, "luchas", id, "turnos", idTurno(n)), { [campo]: valor }, { merge: true });
}

// Quita mi sello del turno n (cancelar la elección): solo mientras el otro no haya sellado la suya (lo
// comprueban las reglas)
export async function cancelarEleccion(id, n, campo) {
  const { bd, fn } = acceso();
  await fn.updateDoc(fn.doc(bd, "luchas", id, "turnos", idTurno(n)), { [campo]: fn.deleteField() });
  const pendientes = leerPendientes();
  delete pendientes[`${id}/${n}`];
  escribirPendientes(pendientes);
}

// ---------- El tiempo de cada turno ----------

// Empieza a correr el tiempo del turno n (si aún no corría): la hora la pone el servidor
export async function ponerReloj(id, n) {
  const lucha = luchaPorId(id);
  if (!lucha || !lucha.tiempo || lucha.estado !== "jugando") return;
  if (lucha.reloj && lucha.reloj.n >= idTurno(n)) return;
  const { bd, fn } = acceso();
  await fn.updateDoc(fn.doc(bd, "luchas", id), { reloj: { n: idTurno(n), desde: fn.serverTimestamp() } });
}

// Milisegundos que quedan del turno n (null si no hay tiempo o aún no corre)
export function tiempoQueQueda(lucha, n) {
  if (!lucha || !lucha.tiempo || !lucha.reloj || lucha.reloj.n !== idTurno(n) || !lucha.reloj.desde) return null;
  const desde = typeof lucha.reloj.desde.toMillis === "function" ? lucha.reloj.desde.toMillis() : Number(lucha.reloj.desde);
  return desde + SEGUNDOS_TURNO * 1000 - Date.now();
}

// Apunta que a los de «numeros» (1 y/o 2) se les ha acabado el tiempo en el turno n
export async function apuntarSinTiempo(id, n, numeros) {
  const { bd, fn } = acceso();
  await fn.setDoc(fn.doc(bd, "luchas", id, "turnos", idTurno(n)), Object.fromEntries(numeros.map((k) => [`t${k}`, true])), { merge: true });
}

// ---------- Elecciones selladas que aún no se han destapado ----------

// Se sincronizan con la cuenta (js/comun/almacen.js): así también se destapan desde otro dispositivo
function leerPendientes() {
  return leer(CLAVE_PENDIENTES, {}) || {};
}

function escribirPendientes(pendientes) {
  try {
    if (!escribir(CLAVE_PENDIENTES, pendientes)) throw new Error("sin sitio");
  } catch (error) {
    // sin sitio: si se recarga antes de destapar, habrá que volver a elegir (no se puede: queda
    // el sello). Muy raro; la pantalla lo explica si pasa.
  }
}

export function pendienteDe(id, n) {
  return leerPendientes()[`${id}/${n}`] || null;
}

export function guardarPendiente(id, n, eleccion) {
  const pendientes = leerPendientes();
  pendientes[`${id}/${n}`] = eleccion;
  escribirPendientes(pendientes);
}

export function olvidarPendientes(id) {
  const pendientes = leerPendientes();
  for (const clave of Object.keys(pendientes)) if (clave.startsWith(`${id}/`)) delete pendientes[clave];
  escribirPendientes(pendientes);
}
