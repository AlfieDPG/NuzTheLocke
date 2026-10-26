// ---------- Configuración de Firebase ----------
//
// Rellena esto con los datos de TU proyecto (están en LEEME-nube.md, paso 3).
// Mientras apiKey esté vacío, la web funciona como siempre: todo en el navegador
// y sin botón de iniciar sesión. No se rompe nada.
//
// Estos datos NO son secretos: van en el JavaScript, a la vista de cualquiera, y así
// es como tiene que ser. Lo que protege los datos son las reglas de Firestore
// (firestore.rules), no esconder esta clave.

export const CONFIG_FIREBASE = {
  apiKey: "AIzaSyDfTU4ZZQZKp5sGKi77gYN_XcY-RmOpts4",
  authDomain: "pokelocke-24512.firebaseapp.com",
  projectId: "pokelocke-24512",
  appId: "1:426929162559:web:21316b8070832442c26b8a"
};

// Clave del SITIO de Fraud Defense / reCAPTCHA Enterprise (la pública) para App Check. Vacía =
// App Check apagado. Se crea en Google Cloud (ver LEEME-nube.md, «App Check»).
export const RECAPTCHA_SITE_KEY = "6Lf2HAIuAAAAADuqf0ua_GxNVbEwfv0hyfVjzgcd";

export function hayConfiguracion() {
  return Boolean(CONFIG_FIREBASE.apiKey && CONFIG_FIREBASE.projectId);
}
