// ---------- Avisos de respuestas a tus hilos del foro ----------
//
// Escucha tus hilos (los que has creado) y avisa en la campana (js/avisos.js) cuando alguien
// ha respondido desde la última vez que los miraste. No hay servidor que mande avisos: se
// compara el número de respuestas de cada hilo con el que tenías apuntado.
//
//   · Lo que has visto se guarda solo en este navegador (CLAVE): { idHilo: respuestas vistas }.
//   · La primera vez que se ve un hilo no se avisa de lo que ya tiene (se apunta tal cual).
//   · Abrir el hilo en el foro lo deja al día (js/foro/index.js), y eso incluye tus propias
//     respuestas en él, que también suben el contador.
//   · El contador de respuestas del hilo nunca baja (ver js/comun/foro.js), aunque se borre una
//     respuesta (la borra quien la escribió, un moderador o quien borra su cuenta). Por eso, antes
//     de avisar, se miran las respuestas de verdad: su id es «uid_N», con N el número que dejó el
//     hilo, así que las nuevas son las de N mayor que lo visto y que no son tuyas.
//   · Los avisos llegan solo con la web abierta o la próxima vez que se abre (no hay notificaciones
//     push: harían falta Cloud Functions, que piden el plan de pago).
//
// Y además (avisosDelForo, abajo del todo):
//   · alguien te ha respondido a un mensaje tuyo (comentarios con respondeA.uid = tú: consulta de
//     «grupo de colección», pide su índice; ver LEEME-nube.md);
//   · alguien pide unirse al grupo de un hilo tuyo de «Busco compañeros»;
//   · el autor de un hilo te ha aceptado en su grupo.
// Los hilos silenciados (perfil.foroSilenciados, se silencian desde el foro) no avisan de nada.

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { leer, escribir } from "./almacen.js";
import { miPerfil, alCambiarMiPerfil, guardarMiPerfil, perfilesDe } from "./perfiles.js";

const CLAVE = "poketeams-avisos-foro-v1";
const MAX_HILOS = 50;          // los más recientes de los tuyos
const MAX_GUARDADOS = 300;     // apuntes de hilos viejos que se conservan

let hilos = [];                // { id, titulo, respuestas, ultimo }
const comprobadas = new Map(); // idHilo -> { respuestas, visto, nuevas }: las que existen de verdad
let dejarDeEscuchar = null;
const oyentes = new Set();

function avisar() {
  for (const funcion of oyentes) funcion();
}

export function alCambiarAvisosForo(funcion) {
  oyentes.add(funcion);
  funcion();
  return () => oyentes.delete(funcion);
}

function vistos() {
  const guardado = leer(CLAVE, {});
  return guardado && typeof guardado === "object" ? guardado : {};
}

// Los hilos tuyos con más respuestas de las que has visto, el que tiene la respuesta más nueva primero
// (solo las ya comprobadas: mientras se comprueba un hilo, no sale)
export function respuestasNuevas() {
  const vistas = vistos();
  return hilos
    .filter((hilo) => hilo.id in vistas && hilo.respuestas > vistas[hilo.id] && !hiloSilenciado(hilo.id))
    .map((hilo) => {
      const hecha = comprobadas.get(hilo.id);
      const vale = hecha && hecha.respuestas === hilo.respuestas && hecha.visto === vistas[hilo.id];
      return { id: hilo.id, titulo: hilo.titulo, nuevas: vale ? hecha.nuevas : 0, ultimo: hilo.ultimo };
    })
    .filter((hilo) => hilo.nuevas > 0)
    .sort((uno, otro) => otro.ultimo - uno.ultimo);
}

// Cuenta las respuestas nuevas que siguen existiendo en un hilo (las últimas, como mucho 20). Si
// no queda ninguna (las borraron, o eran tuyas), el hilo se da por visto.
async function comprobar(hilo, visto) {
  const base = baseDeDatos();
  const usuario = usuarioActual();
  if (!base || !usuario) return;
  const { bd, fn } = base;
  const hecha = comprobadas.get(hilo.id);
  if (hecha && hecha.respuestas === hilo.respuestas && hecha.visto === visto) return;
  comprobadas.set(hilo.id, { respuestas: hilo.respuestas, visto, nuevas: 0, pendiente: true });

  try {
    const instantanea = await fn.getDocs(
      fn.query(
        fn.collection(bd, "foro", hilo.id, "comentarios"),
        fn.orderBy("creado", "desc"),
        fn.limit(Math.min(20, hilo.respuestas - visto))
      )
    );
    const nuevas = instantanea.docs.filter((documento) => {
      const numero = Number(documento.id.split("_").pop());
      return numero > visto && (documento.data().uid || "") !== usuario.uid;
    }).length;
    const actual = comprobadas.get(hilo.id);
    if (!actual || actual.respuestas !== hilo.respuestas || actual.visto !== visto) return; // ya ha cambiado
    comprobadas.set(hilo.id, { respuestas: hilo.respuestas, visto, nuevas });
    if (!nuevas) marcarHiloVisto(hilo.id, hilo.respuestas);
    else avisar();
  } catch (error) {
    // Si no se puede mirar, se avisa con el contador, como antes
    comprobadas.set(hilo.id, { respuestas: hilo.respuestas, visto, nuevas: hilo.respuestas - visto });
    avisar();
  }
}

// Apunta que ya has visto esas respuestas (o, sin número, las que tiene el hilo ahora)
export function marcarHiloVisto(id, respuestas) {
  marcarOtrosVistos(id);
  const hilo = hilos.find((cada) => cada.id === id);
  const cuantas = respuestas == null ? hilo && hilo.respuestas : respuestas;
  if (cuantas == null) return;

  const actual = vistos();
  if (actual[id] === cuantas) return;
  actual[id] = cuantas;
  // Si se acumulan muchos apuntes de hilos viejos, se tiran los más antiguos (el objeto guarda el orden de alta)
  const claves = Object.keys(actual);
  for (const vieja of claves.slice(0, Math.max(0, claves.length - MAX_GUARDADOS))) delete actual[vieja];
  escribir(CLAVE, actual);
  avisar();
}

function milisegundos(marca) {
  return marca && typeof marca.toMillis === "function" ? marca.toMillis() : 0;
}

// Se llama una vez al arrancar la web (sesion.js)
export function iniciarAvisosForo() {
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = null;
    pararTodoLoOtro();
    hilos = [];
    comprobadas.clear();
    avisar();

    const base = baseDeDatos();
    if (!usuario || !base) return;
    const { bd, fn } = base;

    dejarDeEscuchar = fn.onSnapshot(
      fn.query(fn.collection(bd, "foro"), fn.where("uid", "==", usuario.uid), fn.limit(MAX_HILOS)),
      (instantanea) => {
        hilos = instantanea.docs.map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return {
            id: documento.id,
            titulo: datos.titulo || "",
            respuestas: datos.respuestas || 0,
            ultimo: milisegundos(datos.ultimo),
            busca: datos.categoria === "busco" && !datos.cerrado
          };
        });
        vigilarSolicitudes();

        // Lo que no estaba apuntado se apunta tal cual, sin avisar
        const actual = vistos();
        let cambia = false;
        for (const hilo of hilos) {
          if (hilo.id in actual) continue;
          actual[hilo.id] = hilo.respuestas;
          cambia = true;
        }
        if (cambia) escribir(CLAVE, actual);
        for (const hilo of hilos) {
          if (hilo.respuestas > actual[hilo.id]) comprobar(hilo, actual[hilo.id]);
        }
        avisar();
      },
      (error) => console.error("No se han podido leer tus hilos del foro", error)
    );
    escucharOtros(usuario.uid);
  });
  alCambiarMiPerfil(avisar); // silenciar o dejar de silenciar un hilo
}

// ---------- Silenciar un hilo ----------

export function hiloSilenciado(id) {
  const perfil = miPerfil();
  return Boolean(perfil && (perfil.foroSilenciados || []).includes(id));
}

export async function silenciarHilo(id, silenciar) {
  const perfil = miPerfil();
  const lista = ((perfil && perfil.foroSilenciados) || []).filter((cada) => cada !== id);
  await guardarMiPerfil({ foroSilenciados: silenciar ? [...lista, id].slice(-200) : lista });
}

// ---------- Respuestas a ti, solicitudes y grupos ----------

const CLAVE_OTROS = "poketeams-avisos-foro-otros-v1"; // { respuestas: ["hilo/comentario"], solicitudes: ["hilo/uid"], aceptado: [hilo] }
const MAX_OTROS = 300;

let respuestasAMi = [];                    // { hilo, id, uid, texto, creado }
const solicitudesPendientes = new Map();   // idHilo -> [{ uid, mensaje }]
const escuchasSolicitudes = new Map();     // idHilo -> dejar de escuchar
let gruposConmigo = [];                    // { id, titulo, autor }: hilos de otros en cuyo grupo estás
const titulos = new Map();                 // idHilo -> título (de los que no son tuyos)
const nombres = new Map();                 // uid -> nombre
let pararOtros = [];

function otrosVistos() {
  const guardado = leer(CLAVE_OTROS, {});
  const valido = guardado && typeof guardado === "object" ? guardado : {};
  return {
    respuestas: Array.isArray(valido.respuestas) ? valido.respuestas : [],
    solicitudes: Array.isArray(valido.solicitudes) ? valido.solicitudes : [],
    aceptado: Array.isArray(valido.aceptado) ? valido.aceptado : []
  };
}

function apuntar(lista, clave) {
  if (lista.includes(clave)) return;
  lista.push(clave);
  if (lista.length > MAX_OTROS) lista.splice(0, lista.length - MAX_OTROS);
}

// Lo que tenga que ver con ese hilo, visto (respuestas a ti, solicitudes, que te aceptaron)
function marcarOtrosVistos(id) {
  const vistosOtros = otrosVistos();
  const antes = JSON.stringify(vistosOtros);
  for (const respuesta of respuestasAMi) if (respuesta.hilo === id) apuntar(vistosOtros.respuestas, `${id}/${respuesta.id}`);
  for (const solicitud of solicitudesPendientes.get(id) || []) apuntar(vistosOtros.solicitudes, `${id}/${solicitud.uid}`);
  if (gruposConmigo.some((hilo) => hilo.id === id)) apuntar(vistosOtros.aceptado, id);
  if (JSON.stringify(vistosOtros) !== antes) {
    escribir(CLAVE_OTROS, vistosOtros);
    avisar();
  }
}

function pararTodoLoOtro() {
  for (const parar of pararOtros) parar();
  pararOtros = [];
  for (const parar of escuchasSolicitudes.values()) parar();
  escuchasSolicitudes.clear();
  solicitudesPendientes.clear();
  respuestasAMi = [];
  gruposConmigo = [];
}

// Nombres y títulos que hacen falta para enseñar los avisos
async function completar(uids, idsHilos) {
  const base = baseDeDatos();
  if (!base) return;
  const faltanNombres = [...new Set(uids)].filter((uid) => uid && !nombres.has(uid));
  const faltanTitulos = [...new Set(idsHilos)].filter((id) => !titulos.has(id) && !hilos.some((hilo) => hilo.id === id));
  try {
    if (faltanNombres.length) for (const [uid, perfil] of await perfilesDe(faltanNombres)) nombres.set(uid, perfil.nombre);
    await Promise.all(faltanTitulos.map(async (id) => {
      const documento = await base.fn.getDoc(base.fn.doc(base.bd, "foro", id));
      titulos.set(id, documento.exists() ? documento.data().titulo || "" : "");
    }));
  } catch (error) {
    console.warn("No se han podido completar los avisos del foro", error);
  }
  avisar();
}

function escucharOtros(uid) {
  pararTodoLoOtro();
  const base = baseDeDatos();
  if (!base) return;
  const { bd, fn } = base;

  // Respuestas a mensajes tuyos, en cualquier hilo
  pararOtros.push(fn.onSnapshot(
    fn.query(fn.collectionGroup(bd, "comentarios"), fn.where("respondeA.uid", "==", uid), fn.orderBy("creado", "desc"), fn.limit(20)),
    (instantanea) => {
      respuestasAMi = instantanea.docs
        .map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return { hilo: documento.ref.parent.parent.id, id: documento.id, uid: datos.uid || "", texto: datos.texto || "", creado: milisegundos(datos.creado) };
        })
        .filter((respuesta) => respuesta.uid !== uid);
      completar(respuestasAMi.map((respuesta) => respuesta.uid), respuestasAMi.map((respuesta) => respuesta.hilo));
    },
    (error) => console.warn("No se pueden leer las respuestas que te han hecho en el foro (¿falta el índice de grupo de colección?)", error)
  ));

  // Hilos de otros en cuyo grupo te han aceptado. La primera vez, lo que ya había se da por visto.
  let primera = !leer(CLAVE_OTROS, null);
  pararOtros.push(fn.onSnapshot(
    fn.query(fn.collection(bd, "foro"), fn.where("grupo", "array-contains", uid), fn.limit(20)),
    (instantanea) => {
      gruposConmigo = instantanea.docs.map((documento) => {
        const datos = documento.data();
        titulos.set(documento.id, datos.titulo || "");
        return { id: documento.id, titulo: datos.titulo || "", autor: datos.uid || "" };
      });
      if (primera) {
        primera = false;
        const vistosOtros = otrosVistos();
        for (const hilo of gruposConmigo) apuntar(vistosOtros.aceptado, hilo.id);
        escribir(CLAVE_OTROS, vistosOtros);
      }
      completar(gruposConmigo.map((hilo) => hilo.autor), []);
    },
    (error) => console.warn("No se pueden leer los grupos del foro en los que estás", error)
  ));
}

// Las solicitudes pendientes de tus hilos abiertos de «Busco compañeros» (pocos, normalmente uno)
function vigilarSolicitudes() {
  const base = baseDeDatos();
  if (!base) return;
  const { bd, fn } = base;
  const buscan = new Set(hilos.filter((hilo) => hilo.busca).map((hilo) => hilo.id));
  for (const [id, parar] of escuchasSolicitudes) {
    if (buscan.has(id)) continue;
    parar();
    escuchasSolicitudes.delete(id);
    solicitudesPendientes.delete(id);
  }
  for (const id of buscan) {
    if (escuchasSolicitudes.has(id)) continue;
    escuchasSolicitudes.set(id, fn.onSnapshot(
      fn.query(fn.collection(bd, "foro", id, "solicitudes"), fn.where("estado", "==", "pendiente")),
      (instantanea) => {
        const lista = instantanea.docs.map((documento) => ({ uid: documento.id, mensaje: documento.data().mensaje || "" }));
        solicitudesPendientes.set(id, lista);
        completar(lista.map((cada) => cada.uid), []);
      },
      (error) => console.warn("No se pueden leer las solicitudes de tu hilo", error)
    ));
  }
}

// Las solicitudes pendientes de un hilo tuyo (para la lista del foro)
export function solicitudesDe(id) {
  return solicitudesPendientes.get(id) || [];
}

// Quién te ha respondido en un hilo (sin verlo todavía), para la lista del foro; null si nadie
export function respondidoEn(id) {
  const vistosOtros = otrosVistos();
  const respuesta = respuestasAMi.find((cada) => cada.hilo === id && !vistosOtros.respuestas.includes(`${id}/${cada.id}`));
  return respuesta ? nombres.get(respuesta.uid) || "" : null;
}

// Todos los avisos del foro para la campana (js/avisos.js), lo más nuevo primero:
//   { tipo: "hilo", id, titulo, nuevas }                       respuestas nuevas en tu hilo
//   { tipo: "respuesta", id, titulo, quien, texto }            te han respondido
//   { tipo: "solicitud", id, titulo, quienes: [nombres] }      quieren unirse a tu grupo
//   { tipo: "aceptado", id, titulo, quien }                    te han aceptado en un grupo
export function avisosDelForo() {
  const vistosOtros = otrosVistos();
  const mios = new Set(hilos.map((hilo) => hilo.id));
  const tituloDe = (id) => (hilos.find((hilo) => hilo.id === id) || {}).titulo || titulos.get(id) || "";
  const avisos = respuestasNuevas().map((hilo) => ({ tipo: "hilo", ...hilo }));

  for (const respuesta of respuestasAMi) {
    // En tus hilos ya avisa «N respuestas nuevas en tu hilo»
    if (mios.has(respuesta.hilo) || hiloSilenciado(respuesta.hilo)) continue;
    if (vistosOtros.respuestas.includes(`${respuesta.hilo}/${respuesta.id}`)) continue;
    avisos.push({ tipo: "respuesta", id: respuesta.hilo, titulo: tituloDe(respuesta.hilo), quien: nombres.get(respuesta.uid) || "", texto: respuesta.texto, ultimo: respuesta.creado });
  }
  for (const [id, lista] of solicitudesPendientes) {
    if (hiloSilenciado(id)) continue;
    const nuevas = lista.filter((cada) => !vistosOtros.solicitudes.includes(`${id}/${cada.uid}`));
    if (!nuevas.length) continue;
    avisos.push({ tipo: "solicitud", id, titulo: tituloDe(id), quienes: nuevas.map((cada) => nombres.get(cada.uid) || ""), ultimo: Date.now() });
  }
  for (const hilo of gruposConmigo) {
    if (vistosOtros.aceptado.includes(hilo.id) || hiloSilenciado(hilo.id)) continue;
    avisos.push({ tipo: "aceptado", id: hilo.id, titulo: hilo.titulo, quien: nombres.get(hilo.autor) || "", ultimo: Date.now() });
  }
  return avisos.sort((uno, otro) => (otro.ultimo || 0) - (uno.ultimo || 0));
}

