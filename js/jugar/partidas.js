// ---------- Las partidas de «Jugar» ----------
//
// Cada partida: su nombre, su ROM (la de siempre o una randomizada aquí mismo), su partida guardada y, si se quiere,
// el locke que va siguiendo. Nada se mezcla: la partida guardada va con su ROM. Todo en este navegador (IndexedDB):
//
//   lista:    id -> { id, nombre, consola («gba» o «nds»), juego (id de js/comun/juegos.js), idLocke, rom (nombre
//             del archivo), randomizada, creada, jugada, forzarSav }
//   roms:     id -> { nombre, bytes }
//   partidas: id -> la partida (.sav) tal y como la dejó el juego la última vez (copia de la del emulador)
//
// Hasta el 2026-10-29 había una sola por locke (con su id de clave, o «libre» sin locke): al abrir la base de datos se
// pasan a la lista con esa misma clave, que es también con la que el emulador guarda la suya (emulador.html).
// forzarSav: al jugar, la partida de la web pisa la del emulador (la que se ha cargado de un .sav sin estar jugando).

import { usuarioActual } from "../comun/nube.js";

const BD = "poketeams-jugar";

function abrirBD() {
  return new Promise((resolver, fallar) => {
    const peticion = indexedDB.open(BD, 2);
    peticion.onupgradeneeded = (e) => {
      const bd = peticion.result;
      for (const almacen of ["roms", "partidas"]) if (!bd.objectStoreNames.contains(almacen)) bd.createObjectStore(almacen);
      if (bd.objectStoreNames.contains("lista")) return;
      const lista = bd.createObjectStore("lista");
      // Las de antes: una por ROM guardada
      if (e.oldVersion < 1) return;
      const cursor = peticion.transaction.objectStore("roms").openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        const rom = c.value || {};
        lista.put({
          id: c.key, nombre: String(rom.nombre || "Partida").replace(/\.gba$/i, ""), consola: "gba", juego: "frlg",
          idLocke: c.key === "libre" ? "" : c.key,
          rom: rom.nombre || "", randomizada: Boolean(rom.randomizada), creada: Date.now(), jugada: 0
        }, c.key);
        c.continue();
      };
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => fallar(peticion.error);
  });
}

async function operar(almacenes, modo, hacer) {
  const bd = await abrirBD();
  return new Promise((resolver, fallar) => {
    const transaccion = bd.transaction(almacenes, modo);
    const peticion = hacer(transaccion);
    transaccion.oncomplete = () => resolver(peticion && peticion.result);
    transaccion.onerror = () => fallar(transaccion.error);
  });
}

const leer = (almacen, id) => operar(almacen, "readonly", (t) => t.objectStore(almacen).get(id)).catch(() => null);

// Las partidas, de la última jugada (o creada) a la primera
export async function listaDePartidas() {
  const lista = (await operar("lista", "readonly", (t) => t.objectStore("lista").getAll()).catch(() => null)) || [];
  return lista.sort((a, b) => Math.max(b.jugada || 0, b.creada || 0) - Math.max(a.jugada || 0, a.creada || 0));
}

export const datosDe = (id) => leer("lista", id);
export const romDe = (id) => leer("roms", id);
export const savDe = (id) => leer("partidas", id);

// Una partida nueva (sin partida guardada): devuelve su id
// random: { semilla, reglas } si es randomizada (para volver a sacar la misma ROM en otro sitio: ./nube-partidas.js)
export async function crearPartida({ nombre, consola = "gba", juego = "frlg", idLocke = "", archivo, bytes, randomizada = false, random = null }) {
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const usuario = usuarioActual();
  await operar(["lista", "roms"], "readwrite", (t) => {
    t.objectStore("roms").put({ nombre: archivo, bytes }, id);
    return t.objectStore("lista").put({
      id, nombre, consola, juego, idLocke, rom: archivo, randomizada, random: randomizada ? random : null,
      creada: Date.now(), jugada: 0, dueno: usuario ? usuario.uid : ""
    }, id);
  });
  aLaNube(id);
  return id;
}

export async function cambiarPartida(id, cambios) {
  await marcarLocal(id, cambios);
  aLaNube(id);
}

// Cambiar los datos sin subirlos (lo que solo vale aquí, o lo que acaba de llegar de la nube)
export async function marcarLocal(id, cambios) {
  const actual = await datosDe(id);
  if (!actual) return;
  await operar("lista", "readwrite", (t) => t.objectStore("lista").put({ ...actual, ...cambios }, id));
}

// ¿Tiene ya su ROM en este navegador? (las que llegan de la cuenta, no: hay que elegirla otra vez)
// (sin leerla: solo si está su clave, que las de DS pesan mucho)
export async function tieneRom(id) {
  const clave = await operar("roms", "readonly", (t) => t.objectStore("roms").getKey(id)).catch(() => undefined);
  return clave !== undefined;
}

// Una partida que llega de la cuenta (./nube-partidas.js): sus datos y su partida guardada, sin ROM. Al
// jugarla, la web le pasa al emulador esta partida (forzarSav).
export async function ponerDesdeLaNube(id, datos, sav, extra) {
  const actual = (await datosDe(id)) || {};
  await operar(["lista", "partidas"], "readwrite", (t) => {
    if (sav) t.objectStore("partidas").put(sav, id);
    return t.objectStore("lista").put({ ...actual, ...datos, ...extra, id, forzarSav: Boolean(sav) || actual.forzarSav }, id);
  });
}

// Borrar solo aquí (se borró desde otro dispositivo)
export function borrarSoloAqui(id) {
  return operar(["lista", "roms", "partidas"], "readwrite", (t) => {
    for (const almacen of ["lista", "roms", "partidas"]) t.objectStore(almacen).delete(id);
  });
}

// Subirla a la cuenta (si hay sesión), dentro de un rato
function aLaNube(id) {
  import("./nube-partidas.js").then(({ subirLuego }) => subirLuego(id)).catch((error) => console.error(error));
}

// La ROM cambiada (las mentas que se le ponen al editar: ./mentas.js). rom: { nombre, bytes }
export function guardarRom(id, rom) {
  return operar("roms", "readwrite", (t) => t.objectStore("roms").put(rom, id));
}

export async function guardarSav(id, bytes) {
  try {
    await operar("partidas", "readwrite", (t) => t.objectStore("partidas").put(bytes, id));
    await marcarLocal(id, { savActualizado: Date.now() });
    aLaNube(id);
  } catch (error) {
    console.error(error);
  }
}

export async function borrarPartida(id) {
  await borrarSoloAqui(id);
  import("./nube-partidas.js")
    .then(({ borrarDeLaNube }) => borrarDeLaNube(id))
    .catch((error) => console.error("No se ha podido borrar la partida de la cuenta", error));
}
