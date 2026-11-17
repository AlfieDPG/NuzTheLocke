// ---------- Las partidas de «Jugar», también en la cuenta ----------
//
// En el navegador (./partidas.js, IndexedDB) está todo: la ROM y la partida guardada. A la cuenta se suben
// los datos de cada partida y su partida guardada, para no perderla al cambiar de dispositivo o de dirección
// de la web. La ROM NO se sube (pesa mucho, la nube gratuita de Firebase no guarda archivos y no debe salir de
// tu ordenador): en un sitio nuevo la partida sale con «Falta la ROM» y se elige otra vez (si era
// randomizada, la original: se randomiza igual con su semilla y sus normas, guardadas en «random»).
//
//   usuarios/{uid}/jugar/{id}      { datos: { nombre, consola, juego, idLocke, rom, randomizada, random,
//                                    creada, jugada }, savActualizado, actualizado }
//   usuarios/{uid}/jugarSav/{id}   { sav: base64, actualizado }   (aparte: así la lista no baja las partidas)
//
// Cada partida del navegador lleva «dueno» (el uid con el que se creó): solo se suben las tuyas (o las de
// nadie, creadas sin sesión, que pasan a ser tuyas). «subida»: ya está en la cuenta; si deja de estar, es que
// se borró desde otro sitio y se borra también aquí.

import { usuarioActual, baseDeDatos } from "../comun/nube.js";

const ESPERA = 4000; // ms: los guardados seguidos del juego se suben de una vez
const temporizadores = new Map();

function acceso() {
  const usuario = usuarioActual();
  const base = baseDeDatos();
  return usuario && base ? { ...base, usuario } : null;
}

function aBase64(bytes) {
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

function deBase64(texto) {
  const binario = atob(texto || "");
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// Lo que se sube de los datos (sin lo que solo vale en este navegador)
function datosParaSubir(datos) {
  const { id, nombre, consola, juego, idLocke, rom, randomizada, random, creada, jugada } = datos;
  // Las normas, como texto: Firestore no admite listas dentro de listas
  const aleatorio = random ? { semilla: random.semilla, reglas: JSON.stringify(random.reglas || {}) } : null;
  return JSON.parse(JSON.stringify({ id, nombre, consola, juego, idLocke, rom, randomizada, random: aleatorio, creada, jugada }));
}

function datosBajados(datos) {
  const random = datos.random && datos.random.semilla
    ? { semilla: datos.random.semilla, reglas: typeof datos.random.reglas === "string" ? JSON.parse(datos.random.reglas) : datos.random.reglas }
    : null;
  return { ...datos, random };
}

// Subir esa partida dentro de un rato (al crearla, cambiarla o guardar en el juego)
export function subirLuego(id) {
  if (!acceso()) return;
  clearTimeout(temporizadores.get(id));
  temporizadores.set(id, setTimeout(() => {
    temporizadores.delete(id);
    subir(id).catch((error) => console.error("No se ha podido subir la partida de «Jugar»", error));
  }, ESPERA));
}

async function subir(id) {
  const a = acceso();
  if (!a) return;
  const { datosDe, savDe, marcarLocal } = await import("./partidas.js");
  const datos = await datosDe(id);
  if (!datos || (datos.dueno && datos.dueno !== a.usuario.uid)) return;
  const { bd, fn, usuario } = a;
  const ahora = Date.now();
  const savActualizado = datos.savActualizado || 0;
  // La partida guardada, solo si ha cambiado desde la última vez que se subió
  if (savActualizado && savActualizado !== datos.savSubido) {
    const sav = await savDe(id);
    if (sav && sav.length) {
      await fn.setDoc(fn.doc(bd, "usuarios", usuario.uid, "jugarSav", id), { sav: aBase64(new Uint8Array(sav)), actualizado: ahora });
    }
  }
  await fn.setDoc(fn.doc(bd, "usuarios", usuario.uid, "jugar", id), { datos: datosParaSubir(datos), savActualizado, actualizado: ahora });
  await marcarLocal(id, { dueno: usuario.uid, subida: true, savSubido: savActualizado });
}

export async function borrarDeLaNube(id) {
  const a = acceso();
  if (!a) return;
  clearTimeout(temporizadores.get(id));
  const { bd, fn, usuario } = a;
  await Promise.all([
    fn.deleteDoc(fn.doc(bd, "usuarios", usuario.uid, "jugar", id)),
    fn.deleteDoc(fn.doc(bd, "usuarios", usuario.uid, "jugarSav", id))
  ]);
}

// Juntar lo de aquí con lo de la cuenta (al abrir «Jugar»). Devuelve true si ha cambiado algo aquí.
export async function sincronizarPartidas() {
  const a = acceso();
  if (!a) return false;
  const { bd, fn, usuario } = a;
  const { listaDePartidas, ponerDesdeLaNube, borrarSoloAqui } = await import("./partidas.js");
  const instantanea = await fn.getDocs(fn.collection(bd, "usuarios", usuario.uid, "jugar"));
  const enLaNube = new Map(instantanea.docs.map((documento) => [documento.id, documento.data()]));
  const locales = await listaDePartidas();
  const aqui = new Map(locales.map((p) => [p.id, p]));
  let cambios = false;

  // Lo de la cuenta que aquí falta o está más viejo
  for (const [id, remota] of enLaNube) {
    const local = aqui.get(id);
    if (local && local.dueno && local.dueno !== usuario.uid) continue;
    const masNueva = (remota.savActualizado || 0) > ((local && local.savActualizado) || 0);
    if (local && !masNueva) continue;
    let sav = null;
    if (remota.savActualizado) {
      const documento = await fn.getDoc(fn.doc(bd, "usuarios", usuario.uid, "jugarSav", id));
      if (documento.exists()) sav = deBase64(documento.data().sav);
    }
    await ponerDesdeLaNube(id, { ...datosBajados(remota.datos || {}), id }, sav, {
      dueno: usuario.uid, subida: true, savActualizado: remota.savActualizado || 0, savSubido: remota.savActualizado || 0
    });
    cambios = true;
  }

  // Lo de aquí: lo que ya se subió y ya no está, se borró desde otro sitio; lo que no se subió, se sube
  for (const local of locales) {
    if (enLaNube.has(local.id)) {
      if ((local.savActualizado || 0) > (enLaNube.get(local.id).savActualizado || 0)) subirLuego(local.id);
      continue;
    }
    if (local.dueno && local.dueno !== usuario.uid) continue;
    if (local.subida) {
      await borrarSoloAqui(local.id);
      cambios = true;
    } else {
      subirLuego(local.id);
    }
  }
  return cambios;
}
