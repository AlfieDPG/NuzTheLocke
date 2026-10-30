// ---------- En directo: tus amigos ven tu partida de «Jugar» ----------
//
// Quien juega emite (desde «Jugar»); sus amigos lo ven desde su ficha de «Amigos». La imagen y el sonido del juego van
// de un navegador a otro directamente (WebRTC), sin pasar por ningún servidor: por eso caben pocos espectadores (los
// manda todos la conexión de quien juega). El chat de la sala va por esa misma conexión: no se guarda en ningún sitio.
//
// Firestore solo sirve para presentarse (las reglas solo dejan a amigos aceptados):
//
//   presencia/{uid}.directo                    a qué juegas (js/comun/presencia.js): así lo ven tus amigos
//   directos/{uid}/espectadores/{suUid}        { pedido, nombre, oferta, respuesta }
//
//   1. El espectador crea su documento (pedido, nombre).
//   2. Quien emite lo ve, prepara la conexión con la imagen, el sonido y el chat, y escribe su oferta.
//   3. El espectador la lee y escribe su respuesta. Ya están conectados.
//   Al irse, el espectador borra su documento; al acabar, quien emite borra todos.
//
// Sin servidor intermedio (TURN), algunas redes muy cerradas no llegan a conectarse: se avisa.

import { usuarioActual, baseDeDatos } from "../comun/nube.js";
import { miPerfil } from "../comun/perfiles.js";
import { ponerMiDirecto } from "../comun/presencia.js";
import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { t } from "../comun/idioma.js";

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const MAX_ESPECTADORES = 6;
const MAX_TEXTO = 300;
const MAX_MENSAJES = 100;
const ESPERA_CANDIDATOS = 3000; // ms buscando por dónde conectarse
const ESPERA_OFERTA = 20000; // ms que espera el espectador a que conteste quien emite
const BITS_VIDEO = 1200000; // por espectador

const miNombre = () => (miPerfil() || {}).nombre || t("Jugador");

// Sin ir mandando trozos: se espera a tener todos los caminos posibles (o a que pase un rato) y se escriben de una vez
function candidatosListos(pc) {
  return new Promise((resolver) => {
    if (pc.iceGatheringState === "complete") return resolver();
    const mirar = () => {
      if (pc.iceGatheringState !== "complete") return;
      pc.removeEventListener("icegatheringstatechange", mirar);
      resolver();
    };
    pc.addEventListener("icegatheringstatechange", mirar);
    setTimeout(resolver, ESPERA_CANDIDATOS);
  });
}

function mandar(canal, mensaje) {
  if (canal && canal.readyState === "open") canal.send(JSON.stringify(mensaje));
}

// Los mensajes del chat (los de quien emite y los de la sala)
export function plantillaMensajes(mensajes) {
  if (!mensajes.length) return `<li class="directo-vacio">${t("Todavía no ha escrito nadie.")}</li>`;
  return mensajes
    .map((m) => m.sistema
      ? `<li class="directo-sistema">${escaparHTML(m.texto)}</li>`
      : `<li><strong>${escaparHTML(m.nombre)}</strong> ${escaparHTML(m.texto)}</li>`)
    .join("");
}

const plantillaEscribir = () => `
  <form class="directo-escribir">
    <input type="text" maxlength="${MAX_TEXTO}" autocomplete="off" placeholder="${t("Escribe algo...")}" aria-label="${t("Mensaje")}">
    <button type="submit" title="${t("Enviar")}">${icono("enviar")}</button>
  </form>`;

// ---------- Quien emite ----------

let emision = null; // { uid, medios, conexiones: Map(suUid -> conexión), mensajes, dejar, alCambiar }

export const emitiendo = () => Boolean(emision);

// medios: la imagen y el sonido (emulador.html, capturarDirecto); juego: lo que verán tus amigos; alCambiar: cuando
// entra o sale alguien o llega un mensaje
export async function empezarDirecto({ medios, juego, alCambiar }) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) throw new Error("Para emitir en directo hace falta iniciar sesión.");
  const { bd, fn } = acceso;
  const coleccion = fn.collection(bd, "directos", usuario.uid, "espectadores");
  // Lo que quedara de otra vez (se cerró la pestaña sin acabar)
  const viejos = await fn.getDocs(coleccion);
  await Promise.all(viejos.docs.map((documento) => fn.deleteDoc(documento.ref).catch(() => {})));

  emision = { uid: usuario.uid, medios, conexiones: new Map(), mensajes: [], alCambiar };
  const esta = emision;
  emision.dejar = fn.onSnapshot(
    coleccion,
    (instantanea) => {
      if (emision !== esta) return;
      for (const cambio of instantanea.docChanges()) {
        const suUid = cambio.doc.id;
        if (cambio.type === "removed") {
          cerrarEspectador(suUid);
          continue;
        }
        const datos = cambio.doc.data();
        if (!esta.conexiones.has(suUid)) {
          if (!datos.oferta) atenderEspectador(suUid, datos, cambio.doc.ref).catch((error) => console.error(error));
        } else if (datos.respuesta) recibirRespuesta(suUid, datos.respuesta);
      }
    },
    (error) => console.error("No se puede escuchar a los espectadores del directo", error)
  );
  ponerMiDirecto(juego);
}

export async function acabarDirecto() {
  if (!emision) return;
  const esta = emision;
  emision = null;
  esta.dejar();
  ponerMiDirecto("");
  for (const pista of esta.medios.getTracks()) pista.stop();
  const acceso = baseDeDatos();
  for (const conexion of esta.conexiones.values()) {
    conexion.pc.close();
    if (acceso) acceso.fn.deleteDoc(conexion.ref).catch(() => {});
  }
  esta.conexiones.clear();
  esta.alCambiar();
}

// Quién te está viendo (ya conectados)
export function espectadores() {
  return emision ? [...emision.conexiones.values()].filter((c) => c.abierto).map((c) => c.nombre) : [];
}

export const mensajesDelDirecto = () => (emision ? emision.mensajes : []);

// Tu mensaje, a toda la sala
export function escribirEnDirecto(texto) {
  if (emision) publicar(miNombre(), texto);
}

function publicar(nombre, texto, sistema = false) {
  const limpio = String(texto || "").trim().slice(0, MAX_TEXTO);
  if (!limpio || !emision) return;
  const mensaje = sistema ? { sistema: true, texto: limpio } : { nombre, texto: limpio };
  emision.mensajes.push(mensaje);
  if (emision.mensajes.length > MAX_MENSAJES) emision.mensajes.shift();
  for (const conexion of emision.conexiones.values()) mandar(conexion.canal, { tipo: "mensaje", mensaje });
  emision.alCambiar();
}

function avisarCuantos() {
  const cuantos = espectadores().length;
  for (const conexion of emision.conexiones.values()) mandar(conexion.canal, { tipo: "cuantos", cuantos });
}

async function atenderEspectador(suUid, datos, ref) {
  const { fn } = baseDeDatos();
  // Llena: se le quita el documento y su ventana lo dice
  if (emision.conexiones.size >= MAX_ESPECTADORES) {
    fn.deleteDoc(ref).catch(() => {});
    return;
  }
  const esta = emision;
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const conexion = { pc, ref, canal: null, abierto: false, respondido: false, nombre: String(datos.nombre || "").slice(0, 40) || t("Amigo") };
  esta.conexiones.set(suUid, conexion);

  for (const pista of esta.medios.getTracks()) pc.addTrack(pista, esta.medios);
  const canal = pc.createDataChannel("chat");
  conexion.canal = canal;
  canal.addEventListener("open", () => {
    if (emision !== esta) return;
    conexion.abierto = true;
    mandar(canal, { tipo: "hola", mensajes: esta.mensajes.slice(-30) });
    publicar("", t("{nombre} se ha unido.", { nombre: conexion.nombre }), true);
    avisarCuantos();
  });
  // Lo que escribe: con su nombre, el que puso al entrar (no el que diga el mensaje)
  canal.addEventListener("message", (e) => {
    let mensaje = null;
    try {
      mensaje = JSON.parse(e.data);
    } catch (error) {
      return;
    }
    if (mensaje && mensaje.tipo === "texto" && emision === esta) publicar(conexion.nombre, mensaje.texto);
  });
  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "closed"].includes(pc.connectionState)) quitarEspectador(suUid, conexion);
  });

  await pc.setLocalDescription(await pc.createOffer());
  await candidatosListos(pc);
  if (emision !== esta || esta.conexiones.get(suUid) !== conexion) return;
  await fn.updateDoc(ref, { oferta: pc.localDescription.sdp });
}

function recibirRespuesta(suUid, sdp) {
  const conexion = emision.conexiones.get(suUid);
  if (!conexion || conexion.respondido) return;
  conexion.respondido = true;
  conexion.pc
    .setRemoteDescription({ type: "answer", sdp })
    .then(() => {
      // Que con varios espectadores no se ahogue la conexión de quien emite
      for (const emisor of conexion.pc.getSenders()) {
        if (!emisor.track || emisor.track.kind !== "video") continue;
        const parametros = emisor.getParameters();
        if (!parametros.encodings || !parametros.encodings.length) parametros.encodings = [{}];
        parametros.encodings[0].maxBitrate = BITS_VIDEO;
        emisor.setParameters(parametros).catch(() => {});
      }
    })
    .catch((error) => console.error(error));
}

// Se ha ido (ha borrado su documento)
function cerrarEspectador(suUid) {
  if (!emision) return;
  const conexion = emision.conexiones.get(suUid);
  if (!conexion) return;
  emision.conexiones.delete(suUid);
  conexion.pc.close();
  if (conexion.abierto) publicar("", t("{nombre} se ha ido.", { nombre: conexion.nombre }), true);
  avisarCuantos();
  emision.alCambiar();
}

// Se ha caído la conexión: fuera, también su documento
function quitarEspectador(suUid, conexion) {
  if (!emision || emision.conexiones.get(suUid) !== conexion) return;
  cerrarEspectador(suUid);
  const acceso = baseDeDatos();
  if (acceso) acceso.fn.deleteDoc(conexion.ref).catch(() => {});
}

// ---------- Quien mira ----------

// Abre la ventana para ver el directo de un amigo (uid), con su nombre y su juego
export async function verDirecto(uid, nombre, juego = "") {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;
  const ref = fn.doc(bd, "directos", uid, "espectadores", usuario.uid);

  const dialogo = document.createElement("dialog");
  dialogo.className = "ventana-web directo-ventana";
  dialogo.innerHTML = `
    <header class="directo-cabeza">
      <h2><span class="directo-punto"></span> ${escaparHTML(nombre)} <small>${escaparHTML(juego)}</small></h2>
      <span class="directo-cuantos"></span>
      <button type="button" class="directo-ampliar" title="${t("Pantalla completa")}">${icono("ampliar")}</button>
      <button type="button" class="directo-cerrar" title="${t("Cerrar")}">${icono("aspa")}</button>
    </header>
    <div class="directo-cuerpo">
      <div class="directo-pantalla">
        <video autoplay playsinline></video>
        <p class="directo-estado">${t("Conectando...")}</p>
        <button type="button" class="directo-sonido" hidden>${icono("sonido")} ${t("Activar el sonido")}</button>
      </div>
      <div class="directo-chat">
        <ul class="directo-mensajes"></ul>
        ${plantillaEscribir()}
      </div>
    </div>`;
  document.body.appendChild(dialogo);
  const video = dialogo.querySelector("video");
  const estado = dialogo.querySelector(".directo-estado");
  const lista = dialogo.querySelector(".directo-mensajes");
  const mensajes = [];
  const pintarMensajes = () => {
    lista.innerHTML = plantillaMensajes(mensajes);
    lista.scrollTop = lista.scrollHeight;
  };
  const decir = (texto) => {
    estado.textContent = texto;
    estado.hidden = !texto;
  };
  pintarMensajes();

  const pc = new RTCPeerConnection({ iceServers: ICE });
  let canal = null;
  let dejar = () => {};
  let terminado = false;
  let conectado = false;
  let haHabidoOferta = false;
  const acabar = (texto) => {
    if (terminado) return;
    terminado = true;
    dejar();
    pc.close();
    fn.deleteDoc(ref).catch(() => {});
    if (texto) decir(texto);
  };
  dialogo.addEventListener("close", () => {
    acabar("");
    dialogo.remove();
  });
  dialogo.querySelector(".directo-cerrar").addEventListener("click", () => dialogo.close());
  dialogo.querySelector(".directo-ampliar").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else dialogo.querySelector(".directo-pantalla").requestFullscreen().catch((error) => console.error(error));
  });
  const sonido = dialogo.querySelector(".directo-sonido");
  sonido.addEventListener("click", () => {
    video.muted = false;
    video.play().catch(() => {});
    sonido.hidden = true;
  });
  dialogo.querySelector(".directo-escribir").addEventListener("submit", (e) => {
    e.preventDefault();
    const campo = e.target.querySelector("input");
    const texto = campo.value.trim().slice(0, MAX_TEXTO);
    if (!texto || !canal || canal.readyState !== "open") return;
    mandar(canal, { tipo: "texto", texto });
    campo.value = "";
  });

  pc.addEventListener("track", (e) => {
    if (video.srcObject !== e.streams[0]) video.srcObject = e.streams[0];
    // Si el navegador no deja que suene solo, se pone sin sonido y un botón para activarlo
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
      sonido.hidden = false;
    });
  });
  pc.addEventListener("datachannel", (e) => {
    canal = e.channel;
    canal.addEventListener("message", (ev) => {
      let m = null;
      try {
        m = JSON.parse(ev.data);
      } catch (error) {
        return;
      }
      if (!m) return;
      if (m.tipo === "hola" && Array.isArray(m.mensajes)) mensajes.push(...m.mensajes);
      else if (m.tipo === "mensaje" && m.mensaje) mensajes.push(m.mensaje);
      else if (m.tipo === "cuantos") {
        dialogo.querySelector(".directo-cuantos").textContent = t("{n} viendo", { n: Number(m.cuantos) || 0 });
        return;
      }
      if (mensajes.length > MAX_MENSAJES) mensajes.splice(0, mensajes.length - MAX_MENSAJES);
      pintarMensajes();
    });
  });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      conectado = true;
      decir("");
    } else if (pc.connectionState === "failed") {
      acabar(t("No se ha podido conectar: puede que alguna de vuestras redes no lo permita."));
    } else if (pc.connectionState === "disconnected" && conectado) decir(t("Se ha cortado la conexión..."));
  });

  dialogo.showModal();

  try {
    await fn.deleteDoc(ref).catch(() => {});
    await fn.setDoc(ref, { pedido: fn.serverTimestamp(), nombre: miNombre().slice(0, 40) });
  } catch (error) {
    console.error(error);
    acabar(t("No se puede ver este directo."));
    return;
  }
  if (terminado) return;

  let existia = false;
  dejar = fn.onSnapshot(
    ref,
    async (documento) => {
      if (terminado) return;
      if (!documento.exists()) {
        // Lo ha borrado quien emite: ha acabado, o está llena
        if (existia && !documento.metadata.hasPendingWrites) {
          acabar(conectado ? t("El directo ha terminado.") : t("No se ha podido entrar: puede que ya haya demasiada gente viéndolo."));
        }
        return;
      }
      existia = true;
      const datos = documento.data();
      if (!datos.oferta || haHabidoOferta) return;
      haHabidoOferta = true;
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: datos.oferta });
        await pc.setLocalDescription(await pc.createAnswer());
        await candidatosListos(pc);
        if (!terminado) await fn.updateDoc(ref, { respuesta: pc.localDescription.sdp });
      } catch (error) {
        console.error(error);
        acabar(t("No se ha podido conectar: puede que alguna de vuestras redes no lo permita."));
      }
    },
    (error) => {
      console.error(error);
      acabar(t("No se puede ver este directo."));
    }
  );
  setTimeout(() => {
    if (!terminado && !haHabidoOferta) acabar(t("No contesta: puede que ya no esté en directo."));
  }, ESPERA_OFERTA);
}

// ---------- La caja del directo en «Jugar» (quien emite) ----------

// Se monta una vez en «caja»; luego solo se cambian la lista de quién ve y los mensajes (el campo de escribir no se
// toca, para no perder lo que estés escribiendo)
export function pintarCajaDirecto(caja) {
  caja.hidden = !emision;
  if (!emision) {
    caja.innerHTML = "";
    return;
  }
  if (!caja.querySelector(".directo-mensajes")) {
    caja.innerHTML = `
      <h3><span class="directo-punto"></span> ${t("En directo para tus amigos")}</h3>
      <p class="jugar-nota directo-quien"></p>
      <div class="directo-chat">
        <ul class="directo-mensajes"></ul>
        ${plantillaEscribir()}
      </div>`;
    caja.querySelector(".directo-escribir").addEventListener("submit", (e) => {
      e.preventDefault();
      const campo = e.target.querySelector("input");
      escribirEnDirecto(campo.value);
      campo.value = "";
    });
  }
  const quien = espectadores();
  caja.querySelector(".directo-quien").textContent = quien.length
    ? t("Te ven: {nombres}", { nombres: quien.join(", ") })
    : t("Tus amigos lo ven en su ficha de «Amigos». Todavía no te ve nadie.");
  const lista = caja.querySelector(".directo-mensajes");
  lista.innerHTML = plantillaMensajes(mensajesDelDirecto());
  lista.scrollTop = lista.scrollHeight;
}
