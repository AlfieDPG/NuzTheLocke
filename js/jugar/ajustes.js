// ---------- Tus ajustes de «Jugar»: volumen, velocidad, filtro, pantallas de DS y teclas ----------
//
// Se guardan en este navegador (no van a la nube: dependen del teclado y del mando de cada uno) y valen para todas las
// partidas. Las teclas y los botones del mando, por consola (GBA y DS tienen botones distintos).
//
//   { volumen (0-1), silencio, velocidad (1.5, 2, 3 o 4), filtro («nitido», «suave», «lcd»),
//     pantallasDS («vertical», «horizontal», «grande»), teclas: { gba: { código: acción }, nds },
//     mando: { gba: { acción: botón del mando }, nds } }

import { leer, escribir } from "../comun/almacen.js";
import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { t } from "../comun/idioma.js";

const CLAVE = "poketeams-jugar-ajustes-v1";

// Los botones, por su número en el mando de RetroArch (el que entiende el emulador). ACELERAR no es un botón de la
// consola: mientras se mantiene, el juego va rápido.
export const BOTON = { B: 0, Y: 1, SELECT: 2, START: 3, ARRIBA: 4, ABAJO: 5, IZQUIERDA: 6, DERECHA: 7, A: 8, X: 9, L: 10, R: 11 };
export const ACELERAR = "acelerar";

export const VELOCIDADES = [1.5, 2, 3, 4];
export const FILTROS = ["nitido", "suave", "lcd"];
export const PANTALLAS_DS = ["vertical", "horizontal", "grande"];

// Las de siempre (por e.code: valen igual con cualquier distribución de teclado). En DS: X e Y en S y A, y L y R en Q
// y W; la pantalla de abajo se toca con el ratón (o con el dedo).
const COMUNES = {
  ArrowUp: BOTON.ARRIBA, ArrowDown: BOTON.ABAJO, ArrowLeft: BOTON.IZQUIERDA, ArrowRight: BOTON.DERECHA,
  KeyX: BOTON.A, KeyZ: BOTON.B, Enter: BOTON.START, Backspace: BOTON.SELECT, Space: ACELERAR
};
const TECLAS_DE_SIEMPRE = {
  gba: { ...COMUNES, KeyA: BOTON.L, KeyS: BOTON.R },
  nds: { ...COMUNES, KeyS: BOTON.X, KeyA: BOTON.Y, KeyQ: BOTON.L, KeyW: BOTON.R }
};

// Lo que se puede cambiar, en este orden, con su nombre
const ACCIONES = {
  gba: [
    [BOTON.A, "A"], [BOTON.B, "B"], [BOTON.L, "L"], [BOTON.R, "R"], [BOTON.START, "Start"], [BOTON.SELECT, "Select"],
    [BOTON.ARRIBA, "Arriba"], [BOTON.ABAJO, "Abajo"], [BOTON.IZQUIERDA, "Izquierda"], [BOTON.DERECHA, "Derecha"],
    [ACELERAR, "Acelerar (mantener)"]
  ],
  nds: [
    [BOTON.A, "A"], [BOTON.B, "B"], [BOTON.X, "X"], [BOTON.Y, "Y"], [BOTON.L, "L"], [BOTON.R, "R"], [BOTON.START, "Start"],
    [BOTON.SELECT, "Select"], [BOTON.ARRIBA, "Arriba"], [BOTON.ABAJO, "Abajo"], [BOTON.IZQUIERDA, "Izquierda"],
    [BOTON.DERECHA, "Derecha"], [ACELERAR, "Acelerar (mantener)"]
  ]
};

const POR_DEFECTO = { volumen: 0.5, silencio: false, velocidad: 2, filtro: "nitido", pantallasDS: "vertical", teclas: {}, mando: {} };

let ajustes = null;

export function misAjustes() {
  if (!ajustes) {
    const guardados = leer(CLAVE, {}) || {};
    ajustes = { ...POR_DEFECTO, ...guardados };
    if (!VELOCIDADES.includes(ajustes.velocidad)) ajustes.velocidad = POR_DEFECTO.velocidad;
    if (!FILTROS.includes(ajustes.filtro)) ajustes.filtro = POR_DEFECTO.filtro;
    if (!PANTALLAS_DS.includes(ajustes.pantallasDS)) ajustes.pantallasDS = POR_DEFECTO.pantallasDS;
  }
  return ajustes;
}

export function cambiarAjustes(cambios) {
  Object.assign(misAjustes(), cambios);
  escribir(CLAVE, ajustes);
}

// código de tecla -> acción, de esa consola (las tuyas o las de siempre)
export function teclasDe(consola) {
  return misAjustes().teclas[consola] || TECLAS_DE_SIEMPRE[consola];
}

// acción -> botón del mando que has puesto (solo los cambiados; los demás, los de EmulatorJS)
export const mandoDe = (consola) => misAjustes().mando[consola] || {};

// El nombre de una tecla, para enseñarlo
export function nombreTecla(codigo) {
  if (!codigo) return "—";
  const especiales = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: t("Intro"), Backspace: t("Retroceso"),
    Space: t("Espacio"), ShiftLeft: t("Mayús izq."), ShiftRight: t("Mayús der."), ControlLeft: t("Ctrl izq."),
    ControlRight: t("Ctrl der."), AltLeft: "Alt", AltRight: "Alt Gr", Tab: t("Tabulador"), Escape: "Esc"
  };
  if (especiales[codigo]) return especiales[codigo];
  return codigo.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, t("Num") + " ");
}

// Las teclas en el panel: [teclas, lo que hacen], juntando las que hacen lo mismo
export function listaTeclas(consola) {
  const teclas = teclasDe(consola);
  const filas = ACCIONES[consola].map(([accion, nombre]) => [
    Object.keys(teclas).filter((codigo) => teclas[codigo] === accion).map(nombreTecla).join(" · ") || "—",
    t(nombre)
  ]);
  if (consola === "nds") filas.push([t("Ratón"), t("Pantalla táctil")]);
  return filas;
}

// ---------- La ventana para cambiarlas ----------

// alCambiar(): cuando cambia algo (para ponerlo en el emulador y en el panel)
export function abrirCambiarTeclas(consola, alCambiar) {
  const dialogo = document.createElement("dialog");
  dialogo.className = "ventana-web jugar-teclas-ventana";
  let esperando = null; // { tipo: «tecla» | «mando», accion, boton }
  let sondeo = null;

  const pintar = () => {
    const teclas = teclasDe(consola);
    const mando = mandoDe(consola);
    dialogo.querySelector(".jugar-teclas-filas").innerHTML = ACCIONES[consola]
      .map(([accion, nombre]) => {
        const deTeclado = Object.keys(teclas).filter((codigo) => teclas[codigo] === accion);
        const esperaTecla = esperando && esperando.tipo === "tecla" && esperando.accion === accion;
        const esperaMando = esperando && esperando.tipo === "mando" && esperando.accion === accion;
        return `
          <div class="jugar-teclas-fila">
            <span>${escaparHTML(t(nombre))}</span>
            <button type="button" class="jugar-tecla ${esperaTecla ? "esperando" : ""}" data-tipo="tecla" data-accion="${accion}">
              ${esperaTecla ? t("Pulsa una tecla...") : escaparHTML(deTeclado.map(nombreTecla).join(" · ") || "—")}</button>
            ${accion === ACELERAR
              ? `<span class="jugar-tecla vacia" title="${t("Con el mando no se puede")}">—</span>`
              : `<button type="button" class="jugar-tecla ${esperaMando ? "esperando" : ""}" data-tipo="mando" data-accion="${accion}">
                   ${esperaMando ? t("Pulsa un botón...") : accion in mando ? t("Botón {n}", { n: mando[accion] }) : t("El de siempre")}</button>`}
          </div>`;
      })
      .join("");
  };

  const dejarDeEsperar = () => {
    esperando = null;
    clearInterval(sondeo);
    sondeo = null;
  };

  // Una tecla nueva para esa acción: la quita de lo que hiciera antes y quita las que tuviera la acción
  const ponerTecla = (accion, codigo) => {
    const teclas = { ...teclasDe(consola) };
    for (const c of Object.keys(teclas)) if (teclas[c] === accion || c === codigo) delete teclas[c];
    teclas[codigo] = accion;
    cambiarAjustes({ teclas: { ...misAjustes().teclas, [consola]: teclas } });
    alCambiar();
  };

  const ponerBotonDeMando = (accion, numero) => {
    const mando = { ...mandoDe(consola) };
    for (const a of Object.keys(mando)) if (mando[a] === numero) delete mando[a];
    mando[accion] = numero;
    cambiarAjustes({ mando: { ...misAjustes().mando, [consola]: mando } });
    alCambiar();
  };

  // La siguiente tecla que se pulse, antes que nadie (que no llegue al juego ni cierre la ventana, salvo Escape)
  const alTeclear = (e) => {
    if (!esperando || esperando.tipo !== "tecla") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== "Escape") ponerTecla(esperando.accion, e.code);
    dejarDeEsperar();
    pintar();
  };
  addEventListener("keydown", alTeclear, true);

  // El siguiente botón del mando que se pulse (se mira cada poco: los mandos no avisan solos)
  const esperarMando = (accion) => {
    const pulsadosAntes = new Set();
    for (const mando of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (mando) mando.buttons.forEach((b, i) => b.pressed && pulsadosAntes.add(`${mando.index}:${i}`));
    }
    sondeo = setInterval(() => {
      for (const mando of navigator.getGamepads ? navigator.getGamepads() : []) {
        if (!mando) continue;
        const i = mando.buttons.findIndex((b, n) => b.pressed && !pulsadosAntes.has(`${mando.index}:${n}`));
        if (i < 0) continue;
        ponerBotonDeMando(accion, i);
        dejarDeEsperar();
        pintar();
        return;
      }
    }, 50);
  };

  dialogo.innerHTML = `
    <h2>${icono("mando")} ${t("Cambiar teclas")} <small>${consola === "nds" ? "DS" : "GBA"}</small></h2>
    <p class="jugar-nota">${t("Pulsa en una casilla y luego la tecla (o el botón del mando) que quieras. Se guarda en este navegador.")}</p>
    <div class="jugar-teclas-cabeza"><span></span><span>${t("Teclado")}</span><span>${t("Mando")}</span></div>
    <div class="jugar-teclas-filas"></div>
    <div class="dialogo-botones">
      <button type="button" class="ventana-cancelar jugar-teclas-restablecer">${icono("deshacer")} ${t("Las de siempre")}</button>
      <button type="button" class="ventana-aceptar jugar-teclas-hecho">${t("Hecho")}</button>
    </div>`;
  document.body.appendChild(dialogo);
  pintar();

  dialogo.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.matches(".jugar-teclas-hecho")) {
      dialogo.close();
    } else if (boton.matches(".jugar-teclas-restablecer")) {
      dejarDeEsperar();
      const { teclas, mando } = misAjustes();
      const sinEsta = (mapa) => Object.fromEntries(Object.entries(mapa).filter(([c]) => c !== consola));
      cambiarAjustes({ teclas: sinEsta(teclas), mando: sinEsta(mando) });
      alCambiar();
      pintar();
    } else if (boton.dataset.tipo) {
      const accion = boton.dataset.accion === ACELERAR ? ACELERAR : Number(boton.dataset.accion);
      dejarDeEsperar();
      esperando = { tipo: boton.dataset.tipo, accion };
      if (esperando.tipo === "mando") esperarMando(accion);
      pintar();
    }
  });
  // Escape, esperando una tecla, solo deja de esperar
  dialogo.addEventListener("cancel", (e) => {
    if (esperando) e.preventDefault();
  });
  dialogo.addEventListener("close", () => {
    dejarDeEsperar();
    removeEventListener("keydown", alTeclear, true);
    dialogo.remove();
  });
  dialogo.showModal();
}
