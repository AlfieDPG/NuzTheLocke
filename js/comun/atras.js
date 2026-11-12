// ---------- El botón «Atrás» (y el gesto de volver del móvil) ----------
//
// Cada sección es una entrada del historial (js/navegacion.js), así que «Atrás» vuelve a la de antes
// en vez de sacarte de la web. Y si hay algo abierto por encima («capas»: cualquier <dialog> abierto
// con showModal —perfil, cementerio, ajustes...— o la hoja de «Más» del móvil), «Atrás» lo cierra.
//
// Cómo: mientras haya alguna capa abierta hay UNA entrada de más en el historial («armado»). Al pulsar
// «Atrás» se gasta esa entrada y se cierra la capa de encima; si queda otra debajo, se vuelve a armar.
// Si la capa se cierra de otra forma (su botón, Esc, el código), la entrada sobra y se quita con
// history.back(), cuyo aviso (popstate) se ignora.
//
// history.back() no es inmediato: hasta que llega su aviso, lo que se quiera apuntar en el historial
// (otra capa, otra sección) espera (apuntar), o se apuntaría antes y se lo comería.
//
// Con una ventana, «Atrás» hace lo mismo que Esc: le manda «cancel» (que puede pararlo: cambios sin
// guardar, la ventana del nombre de usuario...) y la cierra. Una ventana que no deba tocar el
// historial lleva data-sin-atras.

const abiertas = [];   // las capas abiertas, la de encima al final: { cerrar(): bool, abierta(): bool }
let armado = false;
let ignorar = 0;       // avisos de popstate que vienen de un history.back() nuestro
let esperando = [];    // lo que hay que apuntar cuando llegue ese aviso
let alVolver = null;   // qué hacer al volver atrás sin capas (cambiar de sección)

// Apunta algo en el historial ya, o en cuanto termine el history.back() pendiente
export function apuntar(funcion) {
  if (ignorar > 0) esperando.push(funcion);
  else funcion();
}

function armar() {
  armado = true;
  apuntar(() => history.pushState({ capa: true }, "", location.href));
}

function desarmar() {
  armado = false;
  ignorar++;
  history.back();
}

// capa: { cerrar() → true si se ha cerrado (false si no se deja), abierta() → si sigue abierta }
export function abrirCapa(capa) {
  if (abiertas.includes(capa)) return;
  abiertas.push(capa);
  if (!armado) armar();
}

// Se ha cerrado sola (no por «Atrás»): fuera su entrada del historial si ya no queda ninguna
export function cerrarCapa(capa) {
  const sitio = abiertas.indexOf(capa);
  if (sitio < 0) return;
  abiertas.splice(sitio, 1);
  if (!abiertas.length && armado) desarmar();
}

// Cada <dialog>, su capa (se crea la primera vez que se abre)
const capasDeVentanas = new WeakMap();

export function activarAtras(volver) {
  alVolver = volver;

  const mostrar = HTMLDialogElement.prototype.showModal;
  const cerrar = HTMLDialogElement.prototype.close;

  function capaDe(dialogo) {
    if (!capasDeVentanas.has(dialogo)) {
      capasDeVentanas.set(dialogo, {
        abierta: () => dialogo.open,
        cerrar: () => {
          if (!dialogo.dispatchEvent(new Event("cancel", { cancelable: true }))) return false;
          cerrar.call(dialogo);
          return true;
        }
      });
      // Esc, <form method="dialog">...: se cierran sin pasar por close()
      dialogo.addEventListener("close", () => cerrarCapa(capasDeVentanas.get(dialogo)));
    }
    return capasDeVentanas.get(dialogo);
  }

  HTMLDialogElement.prototype.showModal = function (...argumentos) {
    const resultado = mostrar.apply(this, argumentos);
    if (!this.hasAttribute("data-sin-atras")) abrirCapa(capaDe(this));
    return resultado;
  };

  HTMLDialogElement.prototype.close = function (...argumentos) {
    const resultado = cerrar.apply(this, argumentos);
    // al momento: si justo después se cambia de sección, el historial ya está al día
    if (capasDeVentanas.has(this)) cerrarCapa(capasDeVentanas.get(this));
    return resultado;
  };

  addEventListener("popstate", (evento) => {
    if (ignorar > 0) {
      ignorar--;
      if (!ignorar) {
        const lista = esperando;
        esperando = [];
        for (const funcion of lista) funcion();
      }
      return;
    }
    if (armado) {
      // Se ha gastado la entrada de las capas: fuera la de encima
      armado = false;
      // (las que ya no están abiertas, por si alguna se quitó de la página sin cerrarla)
      for (let i = abiertas.length - 1; i >= 0; i--) if (!abiertas[i].abierta()) abiertas.splice(i, 1);
      const capa = abiertas[abiertas.length - 1];
      if (capa) {
        const sitio = abiertas.length - 1;
        abiertas.pop();
        // Si no se deja cerrar, sigue abierta: vuelve a su sitio de la lista (por debajo de lo que haya
        // abierto ella misma, como la ventana de «¿Descartar los cambios?»)
        if (!capa.cerrar() && capa.abierta() && !abiertas.includes(capa)) abiertas.splice(sitio, 0, capa);
      }
      if (abiertas.length && !armado) armar();
      return;
    }
    // Una entrada de capa que ya no tiene capa (por ejemplo, con «Adelante»): se salta
    if (evento.state && evento.state.capa) {
      ignorar++;
      history.back();
      return;
    }
    if (alVolver) alVolver();
  });
}
