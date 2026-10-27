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
//   · Los avisos llegan solo con la web abierta o la próxima vez que se abre (no hay notificaciones
//     push: harían falta Cloud Functions, que piden el plan de pago).

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { leer, escribir } from "./almacen.js";

const CLAVE = "poketeams-avisos-foro-v1";
const MAX_HILOS = 50;          // los más recientes de los tuyos
const MAX_GUARDADOS = 300;     // apuntes de hilos viejos que se conservan

let hilos = [];                // { id, titulo, respuestas, ultimo }
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
export function respuestasNuevas() {
  const vistas = vistos();
  return hilos
    .filter((hilo) => hilo.id in vistas && hilo.respuestas > vistas[hilo.id])
    .map((hilo) => ({ id: hilo.id, titulo: hilo.titulo, nuevas: hilo.respuestas - vistas[hilo.id], ultimo: hilo.ultimo }))
    .sort((uno, otro) => otro.ultimo - uno.ultimo);
}

// Apunta que ya has visto esas respuestas (o, sin número, las que tiene el hilo ahora)
export function marcarHiloVisto(id, respuestas) {
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
    hilos = [];
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
            ultimo: milisegundos(datos.ultimo)
          };
        });

        // Lo que no estaba apuntado se apunta tal cual, sin avisar
        const actual = vistos();
        let cambia = false;
        for (const hilo of hilos) {
          if (hilo.id in actual) continue;
          actual[hilo.id] = hilo.respuestas;
          cambia = true;
        }
        if (cambia) escribir(CLAVE, actual);
        avisar();
      },
      (error) => console.error("No se han podido leer tus hilos del foro", error)
    );
  });
}
