// ---------- Archivo de guardado vinculado ----------
//
// Con la File System Access API (Chrome y Edge de ordenador) se elige el archivo una vez y la
// web lo vuelve a leer cada vez que cambia: cada vez que guardas en el emulador. Para editar la
// partida (ver escribirPartida) se pide además permiso de escritura.
//
// El permiso se guarda en este navegador (IndexedDB, que es donde se pueden guardar). Al
// volver a entrar, el navegador pide confirmarlo con un clic: hasta entonces, «Reanudar».
//
// Sin la API (Firefox, Safari, el móvil) se puede leer igual una vez, con el selector de
// archivos de siempre.

const BD = "poketeams-partidas";
const ALMACEN = "archivos";
const COPIAS = "copias"; // la partida tal y como estaba antes de cada edición
const MAX_COPIAS = 5;    // por locke
const CADA = 2000; // ms entre vistazos al archivo

export const sePuedeVigilar = typeof window !== "undefined" && "showOpenFilePicker" in window;

// ---------- IndexedDB ----------

function abrirBD() {
  return new Promise((resolver, fallar) => {
    const peticion = indexedDB.open(BD, 2);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains(ALMACEN)) bd.createObjectStore(ALMACEN);
      if (!bd.objectStoreNames.contains(COPIAS)) bd.createObjectStore(COPIAS, { autoIncrement: true });
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => fallar(peticion.error);
  });
}

async function operar(modo, hacer, almacen = ALMACEN) {
  const bd = await abrirBD();
  return new Promise((resolver, fallar) => {
    const transaccion = bd.transaction(almacen, modo);
    const peticion = hacer(transaccion.objectStore(almacen));
    transaccion.oncomplete = () => resolver(peticion && peticion.result);
    transaccion.onerror = () => fallar(transaccion.error);
  });
}

// ---------- Vínculos ----------

const vinculos = new Map(); // idLocke -> { archivo, permiso: "granted" | "prompt" | ..., ultimo, leyendo }
let alLeer = () => {};
let alCambiarEstado = () => {};
let temporizador = null;

export function estadoVinculo(idLocke) {
  const vinculo = vinculos.get(idLocke);
  if (!vinculo) return "";
  if (vinculo.leyendo) return "leyendo"; // recién elegido, la primera lectura aún no ha acabado
  return vinculo.permiso === "granted" ? "vigilando" : "pausado";
}

// Al arrancar: los archivos que ya estaban vinculados en este navegador
export async function cargarVinculos(leer, cambiarEstado) {
  alLeer = leer;
  alCambiarEstado = cambiarEstado;
  if (!sePuedeVigilar) return;
  try {
    const claves = (await operar("readonly", (almacen) => almacen.getAllKeys())) || [];
    for (const id of claves) {
      const archivo = await operar("readonly", (almacen) => almacen.get(id));
      if (!archivo) continue;
      vinculos.set(id, { archivo, permiso: await archivo.queryPermission({ mode: "read" }), ultimo: "" });
    }
  } catch (error) {
    console.error(error); // sin IndexedDB: habrá que vincular cada vez
  }
  alCambiarEstado();
  arrancar();
}

// Elegir el archivo (tiene que ser con un clic: el navegador no deja abrirlo solo)
export async function vincular(idLocke) {
  const [archivo] = await window.showOpenFilePicker({ id: "partida", multiple: false });
  vinculos.set(idLocke, { archivo, permiso: "granted", ultimo: "", leyendo: true });
  await operar("readwrite", (almacen) => almacen.put(archivo, idLocke)).catch((error) => console.error(error));
  alCambiarEstado();
  await mirar(idLocke);
  arrancar();
}

// Volver a dar permiso tras recargar la página (también con un clic)
export async function reanudar(idLocke) {
  const vinculo = vinculos.get(idLocke);
  if (!vinculo) return;
  vinculo.permiso = await vinculo.archivo.requestPermission({ mode: "read" });
  alCambiarEstado();
  if (vinculo.permiso === "granted") await mirar(idLocke);
}

export async function desvincular(idLocke) {
  vinculos.delete(idLocke);
  await operar("readwrite", (almacen) => almacen.delete(idLocke)).catch((error) => console.error(error));
  alCambiarEstado();
}

// Los bytes del archivo vinculado a un locke, desde cualquier sección (aunque la de Lockes no se
// haya abierto y no esté vigilándolo). Sin permiso: con pedir, se pide (tiene que ser con un
// clic); si no, null. Sin archivo vinculado en este navegador, también null.
export async function leerVinculado(idLocke, pedir = false) {
  if (!sePuedeVigilar) return null;
  const vinculo = vinculos.get(idLocke);
  const archivo = vinculo ? vinculo.archivo : await operar("readonly", (almacen) => almacen.get(idLocke)).catch(() => null);
  if (!archivo) return null;
  let permiso = await archivo.queryPermission({ mode: "read" });
  if (permiso !== "granted" && pedir) permiso = await archivo.requestPermission({ mode: "read" });
  if (permiso !== "granted") return null;
  if (vinculo && vinculo.permiso !== "granted") {
    vinculo.permiso = "granted";
    alCambiarEstado();
  }
  return new Uint8Array(await (await archivo.getFile()).arrayBuffer());
}

// Si hay un archivo vinculado a ese locke en este navegador (con permiso o sin él)
export async function hayVinculo(idLocke) {
  if (!sePuedeVigilar) return false;
  if (vinculos.has(idLocke)) return true;
  return Boolean(await operar("readonly", (almacen) => almacen.get(idLocke)).catch(() => null));
}

// La partida que llega de otro sitio que no es un archivo: la del emulador de la web (js/jugar),
// con el equipo de su memoria (enVivo, ver procesarArchivo en ./partidas.js). Igual que al leer el
// archivo vinculado: necesita la sección «Lockes» iniciada (es la que pone alLeer).
export function entregarPartida(idLocke, bytes, nombre, enVivo = null) {
  return alLeer(idLocke, bytes, nombre, enVivo);
}

// Sin la API: leer un archivo una vez (<input type="file">)
export function leerUnaVez(idLocke) {
  const campo = document.createElement("input");
  campo.type = "file";
  campo.addEventListener("change", async () => {
    const archivo = campo.files[0];
    if (archivo) alLeer(idLocke, new Uint8Array(await archivo.arrayBuffer()), archivo.name);
  });
  campo.click();
}

// ---------- Escribir ----------
//
// editar(original) recibe la partida tal y como está ahora en el disco y devuelve la nueva
// (js/partida/escribir3ds.js). Antes de escribir se guarda una copia de la original: si no se
// puede, no se escribe. Tiene que ser con un clic: la primera vez el navegador pide permiso.
//
// OJO: el juego solo lee la partida al arrancar y la pisa cada vez que guarda. Hay que editar
// con la emulación parada y volver a arrancar el juego después.

// El permiso para escribir. Lo pide escribirPartida, pero quien tenga que esperar a otras cosas
// antes de escribir lo pide nada más pulsar: pasado un rato del clic, el navegador ya no lo pide.
export async function pedirPermiso(idLocke) {
  const vinculo = vinculos.get(idLocke);
  if (!vinculo) throw new Error("La partida no está vinculada.");
  if ((await vinculo.archivo.requestPermission({ mode: "readwrite" })) !== "granted") {
    throw new Error("Sin permiso para guardar en el archivo de la partida.");
  }
  vinculo.permiso = "granted";
  return vinculo;
}

export async function escribirPartida(idLocke, editar) {
  const vinculo = await pedirPermiso(idLocke);
  const archivo = await vinculo.archivo.getFile();
  const original = new Uint8Array(await archivo.arrayBuffer());
  const nuevo = await editar(original);

  await guardarCopia(idLocke, original, archivo.name);
  const escritor = await vinculo.archivo.createWritable();
  await escritor.write(nuevo);
  await escritor.close();

  alCambiarEstado();
  await mirar(idLocke); // la web se pone al día con lo escrito
  return nuevo;
}

// La partida tal y como está ahora en el disco (para el editor, que siempre parte de ella)
export async function leerArchivo(idLocke) {
  const vinculo = vinculos.get(idLocke);
  if (!vinculo || vinculo.permiso !== "granted") throw new Error("La partida no está vinculada.");
  return new Uint8Array(await (await vinculo.archivo.getFile()).arrayBuffer());
}

// ---------- Copias de seguridad ----------
//
// { idLocke, nombre, cuando, bytes }: las MAX_COPIAS últimas de cada locke

async function todasLasCopias() {
  const [claves, copias] = await Promise.all([
    operar("readonly", (almacen) => almacen.getAllKeys(), COPIAS),
    operar("readonly", (almacen) => almacen.getAll(), COPIAS)
  ]);
  return (copias || []).map((copia, i) => ({ ...copia, clave: claves[i] }));
}

async function guardarCopia(idLocke, bytes, nombre) {
  await operar("readwrite", (almacen) => almacen.add({ idLocke, nombre, cuando: Date.now(), bytes }), COPIAS);
  const sobran = (await copiasDe(idLocke)).slice(MAX_COPIAS);
  for (const copia of sobran) await operar("readwrite", (almacen) => almacen.delete(copia.clave), COPIAS);
}

// Las de un locke, de la más nueva a la más vieja
export async function copiasDe(idLocke) {
  return (await todasLasCopias()).filter((copia) => copia.idLocke === idLocke).sort((una, otra) => otra.cuando - una.cuando);
}

// Vuelve a dejar la partida como estaba en esa copia (de lo que hubiera, se guarda otra copia)
export async function restaurarCopia(idLocke, clave) {
  const copia = (await copiasDe(idLocke)).find((cada) => cada.clave === clave);
  if (!copia) throw new Error("Esa copia ya no está.");
  return escribirPartida(idLocke, () => copia.bytes);
}

// ---------- Vigilar ----------

async function mirar(idLocke) {
  const vinculo = vinculos.get(idLocke);
  if (!vinculo || vinculo.permiso !== "granted") return;
  let archivo;
  try {
    archivo = await vinculo.archivo.getFile();
  } catch (error) {
    // Borrado, movido o sin permiso: se deja en pausa
    vinculo.permiso = "prompt";
    vinculo.leyendo = false;
    alCambiarEstado();
    return;
  }
  const firma = `${archivo.lastModified}|${archivo.size}`;
  if (firma === vinculo.ultimo) return;
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  // Si el emulador está a mitad de escribir, la lectura falla: se reintenta en el siguiente
  // vistazo (por eso la firma solo se apunta si se ha podido leer)
  if (!(await alLeer(idLocke, bytes, archivo.name))) return;
  vinculo.ultimo = firma;
  if (vinculo.leyendo) {
    vinculo.leyendo = false;
    alCambiarEstado();
  }
}

let mirando = false;
async function mirarTodos() {
  if (mirando) return;
  mirando = true;
  try {
    for (const id of vinculos.keys()) await mirar(id);
  } finally {
    mirando = false;
  }
}

function arrancar() {
  if (temporizador || !vinculos.size) return;
  temporizador = setInterval(mirarTodos, CADA);
  // Al volver a la pestaña, un vistazo en el momento (en segundo plano el navegador frena
  // los temporizadores)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") mirarTodos();
  });
}
