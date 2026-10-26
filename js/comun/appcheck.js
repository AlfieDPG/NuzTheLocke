// ---------- App Check ----------
//
// Hace que Firestore y el inicio de sesión solo contesten a ESTA web (reCAPTCHA v3 lo
// comprueba: Fraud Defense, antes reCAPTCHA Enterprise; el reCAPTCHA v3 clásico está
// obsoleto) y no a un script que use la apiKey, que es pública. Sin esto, cualquiera
// podría gastar la cuota diaria desde fuera y dejar la web sin respuesta.
//
// Mientras RECAPTCHA_SITE_KEY esté vacío no hace nada, y la web funciona como siempre.
// Se activa en la consola de Firebase (App Check → Aplicar) DESPUÉS de comprobar que la web
// ya manda las fichas: ver LEEME-nube.md, «App Check».

import { RECAPTCHA_SITE_KEY } from "./firebase-config.js";

// Hay que llamarlo justo después de initializeApp y antes de getAuth/getFirestore
export async function activarAppCheck(baseSdk, aplicacion) {
  if (!RECAPTCHA_SITE_KEY) return;

  try {
    // En tu ordenador reCAPTCHA no vale: el navegador saca una ficha de depuración por
    // consola, y esa se registra una vez en Firebase (App Check → Apps → Gestionar tokens)
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const appCheck = await import(`${baseSdk}firebase-app-check.js`);
    appCheck.initializeAppCheck(aplicacion, {
      provider: new appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    // Sin App Check la web sigue funcionando (mientras no esté «Aplicar» en la consola)
    console.error("App Check no se ha podido activar", error);
  }
}
