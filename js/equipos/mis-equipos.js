import {
  estado, leerGuardados, escribirGuardados, colocarGuardados, guardarActual, hayCambiosSinGuardar, reemplazarEquipo,
  guardarCara, leerGrupos, escribirGrupos, grupoConNombre
} from "./estado.js";
import { leer, escribir } from "../comun/almacen.js";
import { icono } from "../comun/iconos.js";
import { copiaProfunda, escaparHTML } from "../comun/utilidades.js";
import { activarArrastre } from "../comun/arrastrar.js";
import {
  imagenConRespaldo, urlsPMD, urlsRetrato, urlsPMDEmocion, EMOCIONES_PMD, precargarImagen
} from "../comun/imagenes.js";
import { textoForma } from "../comun/pokemon.js";
import { pasteDelEquipo, pasteDeTodos, copiarAlPortapapeles } from "./exportar.js";
import { sumarContador } from "../comun/contadores.js";
import { irA } from "../navegacion.js";
import { confirmar } from "../comun/ventanas.js";
import { t, nombre, LOCALE } from "../comun/idioma.js";

const lista = document.getElementById("lista-equipos");

// ---------- Tarjetas o lista ----------

// Un interruptor de dos iconos a la derecha de la barra; el elegido, iluminado
const CLAVE_VISTA = "poketeams-equipos-vista-v1";
const botonesVista = document.querySelectorAll(".vista-equipos [data-modo]");

function aplicarVista(enLista) {
  lista.classList.toggle("modo-lista", enLista);
  // La sombra del elegido se desliza de un botón al otro (css/equipos.css, .vista-equipos::before)
  document.querySelector(".vista-equipos")?.classList.toggle("en-lista", enLista);
  for (const boton of botonesVista) {
    const elegido = (boton.dataset.modo === "lista") === enLista;
    boton.classList.toggle("elegido", elegido);
    boton.setAttribute("aria-pressed", elegido);
  }
}

for (const boton of botonesVista) {
  boton.innerHTML = icono(boton.dataset.modo === "lista" ? "lista" : "cuadricula");
  boton.addEventListener("click", () => {
    const enLista = boton.dataset.modo === "lista";
    escribir(CLAVE_VISTA, enLista);
    aplicarVista(enLista);
  });
}

aplicarVista(leer(CLAVE_VISTA, false));

// Todos los equipos a la vez, para pegarlos en Showdown («Backup/Restore all teams»)
const botonTodos = document.getElementById("exportar-todos");
botonTodos.innerHTML = `${icono("copiar")} <span>${t("Exportar todos")}</span>`;
const textoTodos = botonTodos.querySelector("span");
botonTodos.addEventListener("click", async () => {
  const guardados = leerGuardados();
  if (!guardados.length) return;
  const copiado = await copiarAlPortapapeles(pasteDeTodos(guardados, leerGrupos()));
  if (copiado) {
    sumarContador("exportar");
    sumarContador("exportar-todos");
  }
  textoTodos.textContent = copiado ? t("Copiados ✔") : t("No se pudo copiar");
  botonTodos.disabled = true;
  setTimeout(() => {
    textoTodos.textContent = t("Exportar todos");
    botonTodos.disabled = false;
  }, 1500);
});

async function abrirEquipo(guardado) {
  if (hayCambiosSinGuardar()) {
    const seguro = await confirmar(
      t("Tienes cambios sin guardar en el equipo actual. ¿Abrir otro equipo y descartarlos?"),
      { aceptar: t("Descartar y abrir"), peligro: true }
    );
    if (!seguro) return;
  }

  reemplazarEquipo(copiaProfunda(guardado.pokemon), guardado.nombre, guardado.id);
  irA("crear");
}

async function borrarEquipo(guardado) {
  if (!(await confirmar(t("¿Borrar el equipo «{nombre}»?", { nombre: guardado.nombre })))) return;

  escribirGuardados(leerGuardados().filter((g) => g.id !== guardado.id));

  if (estado.id === guardado.id) {
    estado.id = null;
    guardarActual();
  }

  renderMisEquipos();
}

async function exportarEquipo(guardado, boton) {
  const copiado = await copiarAlPortapapeles(pasteDelEquipo(guardado.pokemon));
  if (copiado) sumarContador("exportar");

  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  boton.title = copiado ? t("Copiado al portapapeles") : t("No se pudo copiar");
  boton.disabled = true;
  setTimeout(() => {
    boton.innerHTML = icono("copiar");
    boton.title = t("Copiar el equipo como paste");
    boton.disabled = false;
  }, 1500);
}

// ---------- Caras de Mundo Misterioso ----------
//
// Cada Pokémon tiene en Mundo Misterioso varias caras (contento, enfadado, llorando...).
// Pulsando en su miniatura se pasa a la siguiente que exista, y se queda guardada en el
// equipo («cara»). Para saber cuáles tiene se miran todas a la vez en cuanto pasas el ratón
// por encima: así al pulsar ya va al momento (y el service worker las guarda para siempre).
// Algunos solo tienen una (Hariyama): entonces la miniatura se sacude y no cambia.

const carasDisponibles = new Map(); // direcciones de su cara normal -> promesa de [{ emocion, url }]

function caras(p) {
  const clave = urlsPMD(p).join("|");
  if (!carasDisponibles.has(clave)) {
    carasDisponibles.set(
      clave,
      Promise.all(
        EMOCIONES_PMD.map(async (emocion) => {
          for (const url of urlsPMDEmocion(p, emocion)) {
            if (await precargarImagen(url)) return { emocion, url };
          }
          return null;
        })
      ).then((lista) => lista.filter(Boolean))
    );
  }
  return carasDisponibles.get(clave);
}

async function cambiarDeCara(img, p, idEquipo) {
  if (!p || img.dataset.cambiando) return;
  img.dataset.cambiando = "1";
  img.classList.add("cambiando-cara");

  try {
    const lista = await caras(p);
    if (lista.length > 1) {
      const actual = lista.findIndex((cara) => cara.emocion === (img.dataset.emocion || "Normal"));
      const siguiente = lista[(actual + 1) % lista.length];
      img.removeAttribute("data-respaldo");
      img.src = siguiente.url;
      img.dataset.emocion = siguiente.emocion;
      p.cara = siguiente.emocion;
      guardarCara(idEquipo, Number(img.dataset.posicion), siguiente.emocion);
    } else {
      // Solo tiene una cara: se sacude para que se note que el clic ha llegado
      img.classList.remove("sin-mas-caras");
      void img.offsetWidth; // reinicia la animación si se pulsa varias veces seguidas
      img.classList.add("sin-mas-caras");
    }
  } finally {
    delete img.dataset.cambiando;
    img.classList.remove("cambiando-cara");
  }
}

// ---------- Grupos ----------
//
// Arriba, los grupos (plegables, como carpetas) y debajo los equipos sueltos. Un equipo se
// mete en un grupo arrastrándolo dentro (o encima de la cabecera si está plegado) o con el
// botón de la carpeta de su tarjeta. Pulsando el nombre del grupo se le cambia.

function nuevoGrupo() {
  const grupos = leerGrupos();
  const nombres = new Set(grupos.map((g) => g.nombre));
  let nombre = t("Grupo nuevo");
  for (let i = 2; nombres.has(nombre); i++) nombre = `${t("Grupo nuevo")} ${i}`;
  const grupo = grupoConNombre(nombre);
  renderMisEquipos();
  const titulo = lista.querySelector(`.grupo-equipos[data-grupo="${grupo.id}"] .grupo-nombre`);
  if (titulo) renombrarGrupo(titulo, grupo.id);
  return grupo;
}

function cambiarGrupo(id, cambios) {
  escribirGrupos(leerGrupos().map((g) => (g.id === id ? { ...g, ...cambios } : g)));
}

// Como el mote en «Crear equipo»: el nombre se vuelve una casilla. Enter o salir guarda;
// Escape lo deja como estaba.
function renombrarGrupo(titulo, id) {
  if (titulo.querySelector("input")) return;
  const grupo = leerGrupos().find((g) => g.id === id);
  if (!grupo) return;
  titulo.innerHTML = `<input class="grupo-nombre-campo" type="text" maxlength="40" autocomplete="off">`;
  const campo = titulo.querySelector("input");
  campo.value = grupo.nombre;
  campo.focus();
  campo.select();

  let hecho = false;
  const terminar = (guardar) => {
    if (hecho) return;
    hecho = true;
    // «/» no: en Showdown separa la carpeta del equipo
    const nombre = campo.value.replace(/\//g, "-").trim();
    if (guardar && nombre) cambiarGrupo(id, { nombre });
    renderMisEquipos();
  };
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") terminar(true);
    if (e.key === "Escape") {
      e.preventDefault();
      terminar(false);
    }
  });
  campo.addEventListener("blur", () => terminar(true));
  campo.addEventListener("click", (e) => e.stopPropagation());
}

async function borrarGrupo(id) {
  const grupo = leerGrupos().find((g) => g.id === id);
  if (!grupo) return;
  if (!(await confirmar(`${t("¿Borrar el grupo «{nombre}»?", { nombre: grupo.nombre })}\n\n${t("Sus equipos no se borran: pasan a estar sueltos.")}`))) return;
  escribirGuardados(
    leerGuardados().map((g) => {
      if (g.grupo !== id) return g;
      const { grupo: _quitar, ...resto } = g;
      return resto;
    })
  );
  escribirGrupos(leerGrupos().filter((g) => g.id !== id));
  renderMisEquipos();
}

async function exportarGrupo(id, boton) {
  const grupos = leerGrupos();
  const suyos = leerGuardados().filter((g) => g.grupo === id);
  if (!suyos.length) return;
  const copiado = await copiarAlPortapapeles(pasteDeTodos(suyos, grupos));
  if (copiado) sumarContador("exportar");
  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  boton.disabled = true;
  setTimeout(() => {
    boton.innerHTML = icono("copiar");
    boton.disabled = false;
  }, 1500);
}

// ---------- Mover un equipo a un grupo (botón de la carpeta) ----------

let menuGrupos = null;

function cerrarMenuGrupos() {
  if (menuGrupos) menuGrupos.remove();
  menuGrupos = null;
}

function abrirMenuGrupos(boton, guardado) {
  const yaAbierto = menuGrupos && menuGrupos.dataset.id === guardado.id;
  cerrarMenuGrupos();
  if (yaAbierto) return;

  const grupos = leerGrupos();
  menuGrupos = document.createElement("div");
  menuGrupos.className = "menu-grupos";
  menuGrupos.dataset.id = guardado.id;
  menuGrupos.innerHTML = `
    ${grupos
      .map(
        (g) => `<button data-grupo="${escaparHTML(g.id)}" class="${guardado.grupo === g.id ? "actual" : ""}">
                  ${icono("carpeta")} <span>${escaparHTML(g.nombre)}</span></button>`
      )
      .join("")}
    <button data-grupo="" class="${guardado.grupo && grupos.some((g) => g.id === guardado.grupo) ? "" : "actual"}">
      ${icono("aspa")} <span>${t("Sin grupo")}</span></button>
    <button data-grupo="__nuevo">${icono("carpetaMas")} <span>${t("Grupo nuevo")}</span></button>`;
  document.body.appendChild(menuGrupos);

  const r = boton.getBoundingClientRect();
  const ancho = menuGrupos.offsetWidth;
  menuGrupos.style.left = `${Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8))}px`;
  menuGrupos.style.top = `${r.bottom + 6}px`;

  menuGrupos.addEventListener("click", (e) => {
    const opcion = e.target.closest("button");
    if (!opcion) return;
    cerrarMenuGrupos();
    let grupo = opcion.dataset.grupo;
    if (grupo === "__nuevo") {
      const nombres = new Set(leerGrupos().map((g) => g.nombre));
      let nombre = t("Grupo nuevo");
      for (let i = 2; nombres.has(nombre); i++) nombre = `${t("Grupo nuevo")} ${i}`;
      grupo = grupoConNombre(nombre).id;
    }
    escribirGuardados(
      leerGuardados().map((g) => {
        if (g.id !== guardado.id) return g;
        const { grupo: _antes, ...resto } = g;
        return grupo ? { ...resto, grupo } : resto;
      })
    );
    renderMisEquipos();
    if (opcion.dataset.grupo === "__nuevo") {
      const titulo = lista.querySelector(`.grupo-equipos[data-grupo="${grupo}"] .grupo-nombre`);
      if (titulo) renombrarGrupo(titulo, grupo);
    }
  });
}

document.addEventListener("pointerdown", (e) => {
  if (menuGrupos && !menuGrupos.contains(e.target) && !e.target.closest(".mover")) cerrarMenuGrupos();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMenuGrupos();
});
window.addEventListener("scroll", cerrarMenuGrupos, true);

// ---------- Cambiar de sitio arrastrando (y de grupo) ----------
//
// La línea que marca dónde cae, en js/comun/arrastrar.js. Cada grupo es una zona; los
// equipos sueltos, otra. Al soltar se guarda el orden y el grupo de cada uno.

let seAcabaDeArrastrar = false;

activarArrastre(lista, {
  elementos: ".equipo-guardado",
  zona: (destino) => {
    const seccion = destino.closest && destino.closest(".grupo-equipos");
    return seccion ? seccion.querySelector(".equipos-zona") : null;
  },
  alternativa: (zona) => zona.closest(".grupo-equipos").querySelector(".grupo-cabecera"),
  alTerminar: (tarjeta, movido) => {
    seAcabaDeArrastrar = true; // soltar la tarjeta no debe contar como clic para abrirla
    setTimeout(() => (seAcabaDeArrastrar = false), 0);
    if (!movido) return;
    colocarGuardados(
      [...lista.querySelectorAll(".equipos-zona")].flatMap((zona) =>
        [...zona.querySelectorAll(".equipo-guardado")].map((t) => ({ id: t.dataset.id, grupo: zona.dataset.grupo || "" }))
      )
    );
    renderMisEquipos();
  }
});

// ---------- Pintar ----------

function crearTarjeta(guardado) {
  const fecha = new Date(guardado.actualizado).toLocaleDateString(LOCALE);

  // Retrato de Mundo Misterioso; si no existe, render HOME; si no, el icono antiguo.
  // Pulsando en él va cambiando de cara (ver cambiarDeCara).
  // Con la cara que se le eligiera; si esa no cargase, la normal y los respaldos de siempre
  const miniaturas = guardado.pokemon
    .map((p, posicion) => {
      const cara = p.cara && p.cara !== "Normal" ? p.cara : "";
      return imagenConRespaldo(
        [...(cara ? urlsPMDEmocion(p, cara) : []), ...urlsRetrato(p)],
        `alt="${escaparHTML(nombre(p))}" title="${escaparHTML(nombre(p))}${textoForma(p) ? " (" + escaparHTML(textoForma(p)) + ")" : ""} · ${t("pulsa para cambiarle la cara")}"
         data-posicion="${posicion}" ${cara ? `data-emocion="${cara}"` : ""} loading="lazy" decoding="async" draggable="false"`
      );
    })
    .join("");
  // Los que faltan para los 6, como los huecos de «Crear equipo» (pulsando, se abre el equipo)
  const huecos = `<span class="miniatura-vacia" aria-hidden="true">${icono("mas")}</span>`.repeat(Math.max(0, 6 - guardado.pokemon.length));

  const tarjeta = document.createElement("div");
  tarjeta.className = "equipo-guardado";
  tarjeta.draggable = true;
  tarjeta.dataset.id = guardado.id;
  tarjeta.innerHTML = `
    <div class="equipo-cabecera">
      <div>
        <h3></h3>
        <span class="fecha">${t("Guardado el {fecha}", { fecha })}</span>
      </div>
      <div class="equipo-botones">
        <button class="mover" title="${t("Mover a un grupo")}" aria-label="${t("Mover a un grupo")}">${icono("carpeta")}</button>
        <button class="exportar" title="${t("Copiar el equipo como paste")}" aria-label="${t("Exportar")}">${icono("copiar")}</button>
        <button class="borrar" title="${t("Borrar el equipo")}" aria-label="${t("Borrar")}">${icono("papelera")}</button>
      </div>
    </div>
    <div class="equipo-miniaturas">${miniaturas}${huecos}</div>
  `;

  tarjeta.querySelector("h3").textContent = guardado.nombre;
  tarjeta.title = t("Pulsa para abrir este equipo");

  // Se abre pulsando en la tarjeta, menos si el clic ha sido en uno de sus botones o en
  // un Pokémon (que cambia de cara)
  tarjeta.addEventListener("click", (e) => {
    if (seAcabaDeArrastrar || e.target.closest("button")) return;
    const miniatura = e.target.closest(".equipo-miniaturas img");
    if (miniatura) {
      cambiarDeCara(miniatura, guardado.pokemon[Number(miniatura.dataset.posicion)], guardado.id);
      return;
    }
    abrirEquipo(guardado);
  });

  // Al pasar el ratón por un Pokémon se miran ya sus caras: el clic irá al momento
  tarjeta.addEventListener("mouseover", (e) => {
    const miniatura = e.target.closest(".equipo-miniaturas img");
    if (miniatura) caras(guardado.pokemon[Number(miniatura.dataset.posicion)]);
  });

  const botonExportar = tarjeta.querySelector(".exportar");
  botonExportar.addEventListener("click", () => exportarEquipo(guardado, botonExportar));
  tarjeta.querySelector(".borrar").addEventListener("click", () => borrarEquipo(guardado));
  const botonMover = tarjeta.querySelector(".mover");
  botonMover.addEventListener("click", () => abrirMenuGrupos(botonMover, guardado));

  return tarjeta;
}

// Un grupo: cabecera (plegar, nombre, cuántos, exportar y borrar) y sus equipos.
// grupo null: los sueltos (con cabecera solo si hay grupos).
function crearSeccion(grupo, equipos, hayGrupos) {
  const seccion = document.createElement("section");
  seccion.className = `grupo-equipos ${grupo ? "" : "sueltos"} ${grupo && grupo.plegado ? "plegado" : ""}`;
  if (grupo) seccion.dataset.grupo = grupo.id;

  // Plegado, los Pokémon de sus equipos en pequeño (el primero de cada uno) para reconocerlo
  const caras = equipos
    .map((g) => g.pokemon[0])
    .filter(Boolean)
    .slice(0, 12)
    .map((p) => imagenConRespaldo(urlsRetrato(p), `alt="" loading="lazy" draggable="false"`))
    .join("");

  if (grupo) {
    seccion.innerHTML = `
      <header class="grupo-cabecera" title="${grupo.plegado ? t("Pulsa para desplegar") : t("Pulsa para plegar")}">
        <span class="grupo-flecha">${icono("abajo")}</span>
        <span class="grupo-icono">${icono("carpeta")}</span>
        <h2 class="grupo-nombre" title="${t("Cambiar el nombre")}"></h2>
        <span class="grupo-cuenta">${equipos.length}</span>
        <span class="grupo-caras">${caras}</span>
        <span class="grupo-botones">
          <button class="grupo-exportar" title="${t("Copiar los equipos del grupo")}" aria-label="${t("Exportar el grupo")}" ${equipos.length ? "" : "disabled"}>${icono("copiar")}</button>
          <button class="grupo-borrar" title="${t("Borrar el grupo (sus equipos no)")}" aria-label="${t("Borrar el grupo")}">${icono("papelera")}</button>
        </span>
      </header>
      <div class="equipos-zona" data-grupo="${escaparHTML(grupo.id)}"></div>`;
    seccion.querySelector(".grupo-nombre").textContent = grupo.nombre;
  } else {
    seccion.innerHTML = `
      ${hayGrupos ? `<header class="grupo-cabecera sin-grupo"><h2 class="grupo-nombre">${t("Equipos")}</h2><span class="grupo-cuenta">${equipos.length}</span></header>` : ""}
      <div class="equipos-zona" data-grupo=""></div>`;
  }

  seccion.querySelector(".equipos-zona").append(...equipos.map(crearTarjeta));
  return seccion;
}

lista.addEventListener("click", (e) => {
  const cabecera = e.target.closest(".grupo-cabecera:not(.sin-grupo)");
  if (!cabecera) return;
  const id = cabecera.closest(".grupo-equipos").dataset.grupo;
  const boton = e.target.closest("button");
  if (boton && boton.classList.contains("grupo-borrar")) borrarGrupo(id);
  else if (boton && boton.classList.contains("grupo-exportar")) exportarGrupo(id, boton);
  else if (e.target.closest(".grupo-nombre")) renombrarGrupo(e.target.closest(".grupo-nombre"), id);
  else if (!e.target.closest("input")) {
    const grupo = leerGrupos().find((g) => g.id === id);
    if (grupo) plegarGrupo(grupo, cabecera.closest(".grupo-equipos"));
  }
});

// Plegar o desplegar un grupo poco a poco: sus equipos se cierran (o se abren) cambiando de
// alto. Se vuelve a pintar todo, así que al desplegar se anima la zona ya pintada.
let plegando = false;

async function plegarGrupo(grupo, seccion) {
  if (plegando) return;
  const plegar = !grupo.plegado;
  const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animarAlto = (zona, desde, hasta, alFinal) => {
    zona.style.overflow = "hidden";
    const animacion = zona.animate(
      [{ height: `${desde}px`, opacity: desde ? 1 : 0 }, { height: `${hasta}px`, opacity: hasta ? 1 : 0 }],
      { duration: 220, easing: "ease-in-out" }
    );
    animacion.onfinish = () => {
      zona.style.overflow = "";
      if (alFinal) alFinal();
    };
    return animacion.finished;
  };

  plegando = true;
  try {
    const zona = seccion.querySelector(":scope > .equipos-zona");
    if (plegar && suave && zona) await animarAlto(zona, zona.offsetHeight, 0, () => (zona.style.height = "0px"));
    cambiarGrupo(grupo.id, { plegado: plegar });
    renderMisEquipos();
    if (!plegar && suave) {
      const nueva = lista.querySelector(`.grupo-equipos[data-grupo="${CSS.escape(grupo.id)}"] > .equipos-zona`);
      if (nueva) await animarAlto(nueva, 0, nueva.offsetHeight);
    }
  } finally {
    plegando = false;
  }
}

document.getElementById("nuevo-grupo").addEventListener("click", nuevoGrupo);

// Sin equipos: un equipo «fantasma» con sus 6 huecos vacíos, como los de «Crear equipo», que
// invitan a llenarlos. Los huecos y el botón llevan a crear uno; el otro botón, a importar.
function plantillaSinEquipos() {
  const hueco = `<button class="equipos-vacio-hueco" tabindex="-1" aria-hidden="true">${icono("mas")}</button>`;
  return `
    <div class="equipos-vacio">
      <div>
        <h3>${t("Tu primer equipo")}</h3>
        <p>${t("Aquí se guardan tus equipos. Crea uno y pulsa «Guardar equipo», o trae los tuyos de Showdown.")}</p>
      </div>
      <div class="equipos-vacio-huecos">${hueco.repeat(6)}</div>
      <div class="equipos-vacio-botones">
        <button class="equipos-vacio-crear">${icono("mas")} ${t("Crear equipo")}</button>
        <button class="equipos-vacio-importar">${icono("importar")} ${t("Importar de Showdown")}</button>
      </div>
    </div>`;
}

lista.addEventListener("click", (e) => {
  if (e.target.closest(".equipos-vacio-crear, .equipos-vacio-hueco")) document.getElementById("crear-equipo-nuevo").click();
  else if (e.target.closest(".equipos-vacio-importar")) document.getElementById("importar-varios").click();
});

export function renderMisEquipos() {
  cerrarMenuGrupos();
  const guardados = leerGuardados();
  const grupos = leerGrupos();

  if (guardados.length === 0 && grupos.length === 0) {
    lista.innerHTML = plantillaSinEquipos();
    return;
  }

  const ids = new Set(grupos.map((g) => g.id));
  lista.replaceChildren(
    ...grupos.map((grupo) => crearSeccion(grupo, guardados.filter((g) => g.grupo === grupo.id), true)),
    crearSeccion(null, guardados.filter((g) => !ids.has(g.grupo)), grupos.length > 0)
  );
}

