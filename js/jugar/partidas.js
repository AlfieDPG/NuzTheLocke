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
export async function crearPartida({ nombre, consola = "gba", juego = "frlg", idLocke = "", archivo, bytes, randomizada = false }) {
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await operar(["lista", "roms"], "readwrite", (t) => {
    t.objectStore("roms").put({ nombre: archivo, bytes }, id);
    return t.objectStore("lista").put({ id, nombre, consola, juego, idLocke, rom: archivo, randomizada, creada: Date.now(), jugada: 0 }, id);
  });
  return id;
}

export async function cambiarPartida(id, cambios) {
  const actual = await datosDe(id);
  if (!actual) return;
  await operar("lista", "readwrite", (t) => t.objectStore("lista").put({ ...actual, ...cambios }, id));
}

export function guardarSav(id, bytes) {
  return operar("partidas", "readwrite", (t) => t.objectStore("partidas").put(bytes, id)).catch((error) => console.error(error));
}

export function borrarPartida(id) {
  return operar(["lista", "roms", "partidas"], "readwrite", (t) => {
    for (const almacen of ["lista", "roms", "partidas"]) t.objectStore(almacen).delete(id);
  });
}
