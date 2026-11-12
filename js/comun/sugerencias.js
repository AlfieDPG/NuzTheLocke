// ---------- Sugerencias (el cuadro «Enviar sugerencia» de Inicio) ----------
//
// Antes iban por correo con formsubmit.co, y el correo del desarrollador tenía que estar escrito en
// el código de la web, a la vista de cualquiera. Ahora se guardan en Firestore y solo el
// administrador las lee, en la pestaña «Sugerencias» del foro (js/foro/index.js).
//
//   sugerencias/{id}  { texto, uid (null sin sesión), nombre, idioma, creado }
//
// Se pueden mandar sin sesión (las reglas lo dejan con uid null; App Check frena los robots). Las
// reglas están en firestore.rules, en «Sugerencias».

import { usuarioActual, baseDeDatos } from "./nube.js";
import { idioma } from "./idioma.js";

export const MAX_SUGERENCIA = 3000;

function accesoBD() {
  const base = baseDeDatos();
  if (!base) throw new Error("sin-nube");
  return base;
}

export async function enviarSugerencia(texto, nombre) {
  const { bd, fn } = accesoBD();
  const usuario = usuarioActual();
  await fn.addDoc(fn.collection(bd, "sugerencias"), {
    texto: String(texto).trim().slice(0, MAX_SUGERENCIA),
    uid: usuario ? usuario.uid : null,
    nombre: usuario ? String(nombre || "").slice(0, 40) : "",
    idioma,
    creado: fn.serverTimestamp()
  });
}

// Solo el administrador (las reglas no dejan a nadie más)
export async function cargarSugerencias() {
  const { bd, fn } = accesoBD();
  const instantanea = await fn.getDocs(
    fn.query(fn.collection(bd, "sugerencias"), fn.orderBy("creado", "desc"), fn.limit(100))
  );
  return instantanea.docs.map((documento) => {
    const datos = documento.data({ serverTimestamps: "estimate" });
    const creado = datos.creado && datos.creado.toMillis ? datos.creado.toMillis() : 0;
    return { id: documento.id, ...datos, creado };
  });
}

export async function borrarSugerencia(id) {
  const { bd, fn } = accesoBD();
  await fn.deleteDoc(fn.doc(bd, "sugerencias", id));
}
