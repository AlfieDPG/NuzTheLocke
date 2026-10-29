import {
  estado, MAX_EQUIPO, guardarEquipo, guardarActual, reemplazarEquipo, guardarEnMisEquipos, hayCambiosSinGuardar
} from "./estado.js";
import { datos } from "../comun/datos.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { puntosDe, multiplicadoresDe, textoMultiplicador } from "../comun/efectividad.js";
import { nombreOpcionForma, obtenerVariedades } from "../comun/formas.js";
import { elegirForma } from "../comun/elegir-forma.js";
import { sumarContador } from "../comun/contadores.js";
import {
  pokemonDesdeAPI, pedirVariedad, cambiarForma, variedadActual,
  ataqueDesdeAPI, obtenerStats, obtenerDatosCombate, descripcionHabilidad, descripcionObjeto, textoForma,
  datosDeGenero, generosPosibles, generoDe, ICONO_GENERO, NOMBRE_GENERO, CAMPO_DESCRIPCION, descripcionAtaque
} from "../comun/pokemon.js";
import { activarTooltips, actualizarTooltip, ocultarTooltip, escaparHTML } from "../comun/tooltip.js";
import { activarAutocompletado, iconoPokemon, iconoObjeto } from "../comun/autocompletado.js";
import { pasteDelEquipo, copiarAlPortapapeles } from "./exportar.js";
import { iniciarEntreno, abrirEntreno, textoEntreno, STATS } from "./entreno.js";
import { iniciarAnalisis } from "./analizar.js";
import { iniciarBuscar } from "./buscar.js";
import { icono } from "../comun/iconos.js";
import { activarArrastre } from "../comun/arrastrar.js";
import {
  imagenConRespaldo, urlArte, urlsArte, urlsIconoObjeto, cambiarImagen, precargarEnReposo
} from "../comun/imagenes.js";
import { confirmar } from "../comun/ventanas.js";
import { t, nombre, enIngles } from "../comun/idioma.js";

const resultado = document.getElementById("resultado");
const campoBuscar = document.getElementById("nombre");
const campoNombre = document.getElementById("nombre-equipo");
const contadorEl = document.getElementById("contador");
const avisoEl = document.getElementById("aviso");

// Lo que hay que dejar el ratón encima de la habilidad o el objeto para ver su ficha
const RETRASO_FICHAS = 1000;

// Mensaje en lugar de las tarjetas (cargando, error...)
export function mostrarMensaje(texto) {
  resultado.innerHTML = `<p>${texto}</p>`;
}

// ---------- Avisos ----------

let temporizadorAviso = null;

export function mostrarAviso(texto) {
  avisoEl.textContent = texto;
  clearTimeout(temporizadorAviso);
  if (texto) {
    temporizadorAviso = setTimeout(() => {
      avisoEl.textContent = "";
    }, 3000);
  }
}

// ---------- Añadir Pokémon al equipo (búsqueda manual) ----------

async function agregarPokemon(entrada) {
  campoBuscar.value = "";

  if (estado.equipo.length >= MAX_EQUIPO) {
    mostrarAviso(t("El equipo ya tiene 6 Pokémon."));
    return;
  }

  mostrarAviso(t("Añadiendo..."));

  try {
    let variedad = null;

    let info = { especie: "", lista: [] };
    try {
      info = await obtenerVariedades(entrada.id);
    } catch (error) {
      // sin formas: se añade la normal
    }

    // Si la especie tiene más formas (Alola, Mega...), se pregunta cuál
    if (info.lista.length > 1) {
      mostrarAviso("");
      variedad = await elegirForma(entrada, info);
      if (!variedad) return;
      mostrarAviso(t("Añadiendo..."));
    }

    const p = variedad ? await pedirVariedad(variedad) : await pedirJSON(`${URL_API}pokemon/${entrada.id}`);
    estado.equipo.push(await pokemonDesdeAPI(p, entrada));

    guardarEquipo();
    mostrarAviso("");
    renderCrear();
  } catch (error) {
    mostrarAviso(t("No he podido cargar ese Pokémon."));
  }
}

// ---------- Tarjetas ----------

const tarjetas = new WeakMap(); // Pokémon -> su tarjeta en pantalla
const pokemonDe = new WeakMap(); // tarjeta -> su Pokémon (para las fichas al pasar el ratón)

// Dibuja todas las tarjetas a partir de estado.equipo
export function renderCrear() {
  ocultarTooltip();
  if (campoNombre.value !== estado.nombre) campoNombre.value = estado.nombre;
  contadorEl.textContent = `${estado.equipo.length}/${MAX_EQUIPO}`;
  contadorEl.title = t("Pokémon en el equipo");
  // Las tarjetas del equipo y, detrás, un hueco vacío por cada sitio que quede libre
  const tarjetas = estado.equipo.map((poke) => crearTarjeta(poke));
  for (let i = estado.equipo.length; i < MAX_EQUIPO; i++) tarjetas.push(crearHueco());
  resultado.replaceChildren(...tarjetas);

  // Deja descargada la otra versión (normal/shiny, macho/hembra) de cada arte para que el cambio sea instantáneo
  precargarEnReposo(estado.equipo.flatMap((p) => [
    urlArte({ ...p, shiny: !p.shiny }),
    p.difGenero ? urlsArte({ ...p, genero: p.genero === "F" ? "M" : "F" })[0] : ""
  ]));
}

// Vuelve a dibujar solo la tarjeta de ese Pokémon (las demás no se tocan)
function refrescarTarjeta(poke) {
  const vieja = tarjetas.get(poke);
  if (vieja && vieja.isConnected) {
    ocultarTooltip();
    vieja.replaceWith(crearTarjeta(poke));
  }
}

// El botón de estadísticas de la tarjeta dice el nivel y la naturaleza («Nv. 50 · Firme»)
function textoBotonEntreno(poke) {
  return `${icono("actividad")} ${escaparHTML(textoEntreno(poke) || t("Estadísticas"))}`;
}

// Línea de debajo del título: la especie (si hay mote) y la forma. Va todo en una sola
// línea, que se dibuja siempre aunque esté vacía, para que la tarjeta no cambie de alto.
function detalleNombre(poke) {
  const partes = [];
  if (poke.mote) partes.push(escaparHTML(nombre(poke)));
  if (textoForma(poke)) partes.push(`(${textoForma(poke)})`);
  return partes.join(" ");
}

// Hueco para un Pokémon que todavía no está: al pulsarlo se pone a escribir en el buscador
function crearHueco() {
  const hueco = document.createElement("button");
  hueco.type = "button";
  hueco.className = "tarjeta tarjeta-vacia";
  hueco.title = t("Añadir un Pokémon al equipo");
  hueco.setAttribute("aria-label", t("Añadir un Pokémon al equipo"));
  hueco.innerHTML = `<span class="mas">+</span>`;

  hueco.addEventListener("click", () => {
    campoBuscar.focus();
    campoBuscar.select();
  });

  return hueco;
}

// ---------- Cambiar de sitio los Pokémon arrastrando su tarjeta ----------

// La línea que marca dónde cae y el movimiento, en js/comun/arrastrar.js. Los huecos vacíos
// no cuentan: siempre van detrás de los Pokémon.
function activarArrastreTarjetas() {
  activarArrastre(resultado, {
    elementos: ".tarjeta:not(.tarjeta-vacia)",
    // Desde un campo, un botón o un desplegable no se arrastra: ahí se escribe y se pulsa
    puedeEmpezar: (e) => {
      if (e.target.closest("input, textarea, button, select")) return false;
      ocultarTooltip();
      return true;
    },
    alTerminar: (tarjeta, movido) => {
      if (!movido) return;
      // El equipo pasa a estar en el orden en que han quedado las tarjetas. Se cambia el
      // contenido del array sin sustituirlo para no perder las referencias de las tarjetas.
      const orden = [...resultado.querySelectorAll(".tarjeta:not(.tarjeta-vacia)")].map((t) => pokemonDe.get(t));
      estado.equipo.splice(0, estado.equipo.length, ...orden.filter(Boolean));
      guardarEquipo();
    }
  });
}

function crearTarjeta(poke) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta";
  tarjeta.draggable = true;
  // El color de su primer tipo, para el degradado de arriba de la tarjeta (css/equipos.css)
  tarjeta.style.setProperty("--color-tipo", coloresTipo[poke.tipos[0]] || "transparent");
  tarjetas.set(poke, tarjeta);
  pokemonDe.set(tarjeta, poke);

  const chipsTipos = poke.tipos
    .map(
      (t) => `
        <span class="chip" style="background:${coloresTipo[t]}">
          ${iconoTipo(t)}
          ${tiposEs[t]}
        </span>`
    )
    .join("");

  // draggable="false": si no, al arrastrar desde el dibujo se lleva la imagen y no la tarjeta
  const arte = imagenConRespaldo(urlsArte(poke), `class="arte" alt="${escaparHTML(nombre(poke))}" draggable="false"`);

  tarjeta.innerHTML = `
    <button class="btn-shiny ${poke.shiny ? "activo" : ""}" title="Shiny">${poke.shiny ? "★" : "☆"}</button>
    ${plantillaGenero(poke)}
    <div class="tarjeta-izq">
      ${arte}
      <h2 class="nombre-editable" title="${poke.mote ? t("Cambiar mote") : t("Poner mote")}">${escaparHTML(poke.mote || nombre(poke))}</h2>
      <div class="forma-nombre">
        <span class="forma-texto">${detalleNombre(poke)}</span>
        <select class="selector-forma" title="${t("Cambiar de forma")}" hidden></select>
      </div>
      <div class="chips">${chipsTipos}</div>
      <div class="tarjeta-botones">
        <button class="abrir-entreno" title="${t("Nivel, naturaleza, EVs e IVs")}">${textoBotonEntreno(poke)}</button>
        <button class="quitar-pokemon">${t("Quitar")}</button>
      </div>
    </div>
    <div class="tarjeta-der">
      <div class="fila-superior">
        <div class="campo casilla-habilidad"></div>
        <div class="campo casilla-objeto"></div>
      </div>
      <div class="ataques"></div>
    </div>
  `;

  // Shiny: solo cambian el botón y la imagen; la imagen vieja se queda hasta que la nueva está lista
  const botonShiny = tarjeta.querySelector(".btn-shiny");
  botonShiny.addEventListener("click", () => {
    poke.shiny = !poke.shiny;
    guardarEquipo();
    botonShiny.classList.toggle("activo", poke.shiny);
    botonShiny.textContent = poke.shiny ? "★" : "☆";
    cambiarImagen(tarjeta.querySelector(".arte"), urlsArte(poke));
  });

  // Género: sin decir -> macho -> hembra -> sin decir. Si solo puede ser uno, no se cambia.
  // Como el shiny: cambian el botón y la imagen, sin redibujar la tarjeta
  tarjeta.addEventListener("click", (e) => {
    const boton = e.target.closest(".btn-genero");
    if (!boton) return;
    const posibles = generosPosibles(poke);
    if (posibles.length < 2) return;
    const orden = ["", ...posibles];
    poke.genero = orden[(orden.indexOf(generoDe(poke)) + 1) % orden.length];
    guardarEquipo();
    boton.outerHTML = plantillaGenero(poke);
    cambiarImagen(tarjeta.querySelector(".arte"), urlsArte(poke));
  });
  // Los guardados antes de apuntar el género de la especie: se mira ahora
  if (poke.generoRatio === undefined) {
    datosDeGenero(poke.id)
      .then((datos) => {
        Object.assign(poke, datos);
        guardarEquipo();
        refrescarTarjeta(poke);
      })
      .catch(() => {});
  }

  tarjeta.querySelector(".nombre-editable").addEventListener("click", (e) => editarMote(e.currentTarget, poke));

  tarjeta.querySelector(".abrir-entreno").addEventListener("click", () => abrirEntreno(poke));

  tarjeta.querySelector(".quitar-pokemon").addEventListener("click", () => {
    estado.equipo.splice(estado.equipo.indexOf(poke), 1);
    guardarEquipo();
    renderCrear();
  });

  pintarCasilla(
    tarjeta.querySelector(".casilla-habilidad"),
    poke.habilidad, t("Habilidad"), t("Habilidad"), datos.habilidades, "habilidad",
    (nuevo) => {
      poke.habilidad = nuevo;
      guardarEquipo();
      refrescarTarjeta(poke);
    }
  );

  pintarCasilla(
    tarjeta.querySelector(".casilla-objeto"),
    poke.objeto, t("Objeto"), t("Objeto"), datos.objetos, "objeto",
    (nuevo) => {
      poke.objeto = nuevo;
      guardarEquipo();
      refrescarTarjeta(poke);
    }
  );

  const contenedorAtaques = tarjeta.querySelector(".ataques");
  for (let i = 0; i < 4; i++) {
    const hueco = document.createElement("div");
    hueco.className = "hueco";
    contenedorAtaques.appendChild(hueco);
    pintarAtaque(hueco, poke, i);
  }

  prepararSelectorForma(tarjeta, poke);

  return tarjeta;
}

// ---------- Género ----------

// Debajo del de shiny. Sin género (Magnemite...), nada.
function plantillaGenero(poke) {
  const posibles = generosPosibles(poke);
  if (!posibles.length) return "";
  const genero = generoDe(poke);
  const fijo = posibles.length === 1;
  const titulo = fijo
    ? t("Siempre {genero}", { genero: NOMBRE_GENERO[genero].toLowerCase() })
    : genero ? t("{genero} (pulsa para cambiar)", { genero: NOMBRE_GENERO[genero] }) : t("Género sin elegir (pulsa para elegir)");
  return `<button class="btn-genero ${genero ? `genero-${genero}` : ""} ${fijo ? "fijo" : ""}" title="${titulo}"
            aria-label="${titulo}">${genero ? icono(ICONO_GENERO[genero]) : "⚥︎"}</button>`;
}

// ---------- Mote ----------
//
// Pulsando el nombre se convierte en una casilla en el mismo sitio. Enter o salir de ella
// guarda; Escape lo deja como estaba. Vacía, se quita el mote (vuelve el nombre de la especie).

const LARGO_MOTE = 18; // lo que deja Showdown

function editarMote(titulo, poke) {
  if (titulo.querySelector("input")) return;
  titulo.innerHTML = `<input class="mote-campo" type="text" maxlength="${LARGO_MOTE}" autocomplete="off"
    placeholder="${escaparHTML(nombre(poke))}" value="${escaparHTML(poke.mote || "")}">`;
  const campo = titulo.querySelector("input");
  campo.focus();
  campo.select();

  let hecho = false;
  const terminar = (guardar) => {
    if (hecho) return;
    hecho = true;
    if (guardar) {
      poke.mote = campo.value.trim() || null;
      guardarEquipo();
    }
    refrescarTarjeta(poke);
  };

  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") terminar(true);
    if (e.key === "Escape") {
      e.preventDefault(); // que no cierre nada más
      terminar(false);
    }
  });
  campo.addEventListener("blur", () => terminar(true));
}

// ---------- Cambiar de forma desde la tarjeta ----------
//
// Si la especie tiene más de una forma (Alola, Mega, los tipos de Arceus...), debajo del
// nombre sale un desplegable en lugar del texto de la forma. Al cambiarlo se pide la forma
// nueva y se le pasan el mote, el shiny, la habilidad, el objeto y los ataques: así no hay
// que borrar el Pokémon y volver a montarlo entero.
//
// Las formas se piden aparte para no retrasar la tarjeta; como pedirJSON guarda las
// respuestas, a partir de la primera vez sale al instante.

async function prepararSelectorForma(tarjeta, poke) {
  let info;
  try {
    info = await obtenerVariedades(poke.id);
  } catch (error) {
    return; // sin conexión: se queda el texto de la forma, como antes
  }

  // Mientras llegaba, la tarjeta puede haberse redibujado o quitado
  if (info.lista.length < 2 || tarjetas.get(poke) !== tarjeta) return;

  const selector = tarjeta.querySelector(".selector-forma");
  const actual = variedadActual(poke, info);

  selector.innerHTML = info.lista
    .map(
      (slug) =>
        `<option value="${escaparHTML(slug)}" ${slug === actual ? "selected" : ""}>${escaparHTML(nombreOpcionForma(slug, info.especie))}</option>`
    )
    .join("");

  // El desplegable ya dice la forma: el texto se queda solo con la especie si hay mote
  tarjeta.querySelector(".forma-texto").innerHTML = poke.mote ? escaparHTML(nombre(poke)) : "";
  selector.hidden = false;

  selector.addEventListener("change", async () => {
    selector.disabled = true;

    try {
      const nuevo = await cambiarForma(poke, selector.value);
      const posicion = estado.equipo.indexOf(poke);
      if (posicion < 0) return;

      estado.equipo[posicion] = nuevo;
      guardarEquipo();
      ocultarTooltip();
      tarjeta.replaceWith(crearTarjeta(nuevo));
    } catch (error) {
      selector.value = actual;
      selector.disabled = false;
      mostrarAviso(t("No he podido cambiar la forma."));
    }
  });
}

// ---------- Habilidad y objeto (casillas con formato de tarjeta) ----------

function pintarCasilla(casilla, valor, placeholder, etiqueta, lista, clase, alCambiar) {
  if (valor) {
    const icono =
      clase === "objeto"
        ? imagenConRespaldo(urlsIconoObjeto(valor.en), `class="icono-objeto" alt="" data-quitar-si-falla`)
        : "";

    casilla.innerHTML = `
      <div class="ataque ${clase}">
        ${icono}
        <span class="ataque-nombre">${escaparHTML(nombre(valor))}</span>
        <span class="ataque-tipo">${etiqueta}</span>
        <button class="quitar" title="${t("Cambiar")}">✕</button>
      </div>
    `;
    casilla.querySelector(".quitar").addEventListener("click", () => alCambiar(null));
    // Pulsando la tarjeta se escribe otro encima, sin quitarlo antes
    alPulsarCambiar(casilla.querySelector(".ataque"), () => {
      const campo = campoCasilla(casilla, nombre(valor), lista, clase, alCambiar);
      alSalirSinElegir(campo, () => pintarCasilla(casilla, valor, placeholder, etiqueta, lista, clase, alCambiar));
    });
  } else {
    campoCasilla(casilla, placeholder, lista, clase, alCambiar);
  }
}

function campoCasilla(casilla, placeholder, lista, clase, alCambiar) {
  casilla.innerHTML = `<input type="text" placeholder="${escaparHTML(placeholder)}">`;
  const campo = casilla.querySelector("input");
  activarAutocompletado(campo, lista, (entrada) => {
    alCambiar({ id: entrada.id, es: entrada.es, en: entrada.en });
  }, { icono: clase === "objeto" ? iconoObjeto : null });
  return campo;
}

// Al pulsar una tarjeta de ataque, habilidad u objeto (no sus botones), se cambia por la
// casilla para escribir otro
function alPulsarCambiar(tarjeta, cambiar) {
  tarjeta.classList.add("cambiable");
  tarjeta.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    ocultarTooltip();
    cambiar();
  });
}

// La casilla que sale al pulsar la tarjeta: con el cursor dentro y, si se sale sin elegir
// nada (o con Escape), vuelve la tarjeta como estaba
function alSalirSinElegir(campo, volver) {
  campo.focus();
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.defaultPrevented) campo.blur();
  });
  campo.addEventListener("blur", () => {
    if (campo.isConnected) volver();
  });
}

// ---------- Ataques (búsqueda manual) ----------

function pintarAtaque(hueco, poke, i) {
  const ataque = poke.ataques[i];

  if (!ataque) {
    campoAtaque(hueco, poke, i, t("Ataque {n}", { n: i + 1 }));
    return;
  }

  // data-indice: para encontrar el ataque al pasar el ratón (ficha con la descripción)
  hueco.innerHTML = `
    <div class="ataque" style="background:${coloresTipo[ataque.tipo]}" data-indice="${i}">
      ${iconoTipo(ataque.tipo)}
      <span class="ataque-nombre">${escaparHTML(nombre(ataque))}</span>
      <span class="pp">
        <button class="menos">−</button>
        <span class="pp-valor">${ataque.pp}/${ataque.ppMax}</span>
        <button class="mas">+</button>
      </span>
      <button class="quitar" title="${t("Cambiar ataque")}">✕</button>
    </div>
  `;

  const valor = hueco.querySelector(".pp-valor");

  hueco.querySelector(".menos").addEventListener("click", () => {
    if (ataque.pp > 0) ataque.pp--;
    valor.textContent = `${ataque.pp}/${ataque.ppMax}`;
    guardarEquipo();
  });

  hueco.querySelector(".mas").addEventListener("click", () => {
    if (ataque.pp < ataque.ppMax) ataque.pp++;
    valor.textContent = `${ataque.pp}/${ataque.ppMax}`;
    guardarEquipo();
  });

  hueco.querySelector(".quitar").addEventListener("click", () => {
    poke.ataques[i] = null;
    guardarEquipo();
    refrescarTarjeta(poke);
  });

  alPulsarCambiar(hueco.querySelector(".ataque"), () => {
    const campo = campoAtaque(hueco, poke, i, nombre(ataque));
    alSalirSinElegir(campo, () => pintarAtaque(hueco, poke, i));
  });
}

function campoAtaque(hueco, poke, i, placeholder) {
  hueco.innerHTML = `<input type="text" placeholder="${escaparHTML(placeholder)}">`;
  const campo = hueco.querySelector("input");

  activarAutocompletado(campo, datos.ataques, async (entrada) => {
    try {
      poke.ataques[i] = await ataqueDesdeAPI(entrada);
      guardarEquipo();
      refrescarTarjeta(poke);
    } catch (error) {
      campo.value = "";
      campo.placeholder = t("No se pudo cargar, prueba otra vez");
    }
  });
  return campo;
}

// ---------- Fichas al pasar el ratón (stats base y descripción de ataques) ----------

// Rojo (bajo) -> amarillo -> verde (alto). «bueno» es el valor a partir del cual ya es verde del todo.
function colorStat(valor, malo, bueno) {
  const proporcion = Math.min(1, Math.max(0, (valor - malo) / (bueno - malo)));
  return `hsl(${Math.round(proporcion * 120)}, 70%, 45%)`;
}

function filaStat(nombre, valor, maximo, malo, bueno, clase = "") {
  const ancho = Math.min(100, (valor / maximo) * 100);
  return `
    <div class="stat ${clase}">
      <span class="stat-nombre">${nombre}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-barra"><span style="width:${ancho}%;background:${colorStat(valor, malo, bueno)}"></span></span>
    </div>`;
}

function fichaStats(poke) {
  const forma = textoForma(poke);
  const titulo = `${escaparHTML(nombre(poke))}${forma ? ` <small>(${escaparHTML(forma)})</small>` : ""}`;
  if (!poke.stats) {
    return `<div class="ficha ficha-stats"><div class="ficha-titulo">${titulo}</div><p>${t("Cargando stats...")}</p></div>`;
  }

  const total = poke.stats.reduce((suma, v) => suma + v, 0);
  const tipos = poke.tipos || [];
  // Cada stat: la barra se llena hasta 180 y es verde del todo a partir de 130.
  // Total: se llena hasta 720 y es verde del todo a partir de 600.
  return `
    <div class="ficha ficha-stats">
      <div class="ficha-titulo">${titulo}</div>
      ${poke.stats.map((v, i) => filaStat(STATS[i], v, 180, 30, 130)).join("")}
      ${filaStat(t("Total"), total, 720, 250, 600, "stat-total")}
      ${bloqueTipos(tipos)}
    </div>`;
}

// Debilidades, resistencias e inmunidades, para la ficha de la foto
function bloqueTipos(tipos) {
  if (tipos.length === 0) return "";

  const { debiles, resisten, inmunes } = puntosDe(tipos);
  const multiplicadores = multiplicadoresDe(tipos);

  const fila = (titulo, lista, clase) =>
    lista.length
      ? `<div class="ficha-tipos-fila ${clase}">
           <span class="ficha-tipos-titulo">${titulo}</span>
           <span class="ficha-tipos-lista">
             ${lista
               .map(
                 (t) => `<span class="marca-tipo" style="background:${coloresTipo[t]}" title="${tiposEs[t]}">
                           ${iconoTipo(t)}<small>${textoMultiplicador(multiplicadores[t])}</small>
                         </span>`
               )
               .join("")}
           </span>
         </div>`
      : "";

  return `
    <div class="ficha-tipos">
      ${fila(t("Débil"), debiles, "debil")}
      ${fila(t("Resiste"), resisten, "resiste")}
      ${fila(t("Inmune"), inmunes, "inmune")}
    </div>`;
}

function fichaAtaque(ataque) {
  return `
    <div class="ficha ficha-ataque" style="background:${coloresTipo[ataque.tipo]}">
      <div class="ficha-titulo">
        ${iconoTipo(ataque.tipo)}
        <span>${escaparHTML(nombre(ataque))}</span>
        <span class="ficha-tipo">${tiposEs[ataque.tipo]}</span>
      </div>
      <p>${escaparHTML((ataque[CAMPO_DESCRIPCION] ?? ataque.descripcion) || t("Sin descripción."))}</p>
      ${
        ataque.categoria
          ? `<div class="ficha-datos">
              <span>${t(ataque.categoria)}</span>
              <span>${t("Potencia")}: ${ataque.potencia || "—"}</span>
              <span>${t("Precisión")}: ${ataque.precision ? ataque.precision + "%" : "—"}</span>
            </div>`
          : `<div class="ficha-datos"><span>${t("Cargando potencia y precisión...")}</span></div>`
      }
    </div>`;
}

// Habilidad u objeto: ficha oscura con el nombre y la descripción
function fichaTexto(etiqueta, valor, icono = "") {
  return `
    <div class="ficha ficha-texto">
      <div class="ficha-titulo">${icono}<span>${escaparHTML(nombre(valor))}</span><span class="ficha-tipo">${etiqueta}</span></div>
      <p>${valor[CAMPO_DESCRIPCION] === undefined ? t("Cargando descripción...") : escaparHTML(valor[CAMPO_DESCRIPCION] || t("Sin descripción."))}</p>
    </div>`;
}

// Si al dato le falta algo (guardado con una versión anterior), se descarga, se guarda y se actualiza la ficha
function completarFicha(elemento, promesa, aplicar, ficha) {
  promesa
    .then((resultado) => {
      aplicar(resultado);
      guardarEquipo();
      actualizarTooltip(elemento, ficha());
    })
    .catch(() => {});
}

function contenidoFicha(elemento) {
  const poke = pokemonDe.get(elemento.closest(".tarjeta"));
  if (!poke) return "";

  if (elemento.matches(".ataque[data-indice]")) {
    const ataque = poke.ataques[Number(elemento.dataset.indice)];
    if (!ataque) return "";
    if (!ataque.categoria) {
      completarFicha(elemento, obtenerDatosCombate(ataque), (datos) => Object.assign(ataque, datos), () => fichaAtaque(ataque));
    }
    // Los guardados antes de tener la descripción en inglés
    if (ataque[CAMPO_DESCRIPCION] === undefined) {
      completarFicha(elemento, descripcionAtaque(ataque.id), (texto) => (ataque[CAMPO_DESCRIPCION] = texto), () => fichaAtaque(ataque));
    }
    return fichaAtaque(ataque);
  }

  if (elemento.matches(".ataque.habilidad")) {
    const h = poke.habilidad;
    if (h[CAMPO_DESCRIPCION] === undefined) {
      completarFicha(elemento, descripcionHabilidad(h.id), (texto) => (h[CAMPO_DESCRIPCION] = texto), () => fichaTexto(t("Habilidad"), h));
    }
    return fichaTexto(t("Habilidad"), h);
  }

  if (elemento.matches(".ataque.objeto")) {
    const o = poke.objeto;
    const icono = imagenConRespaldo(urlsIconoObjeto(o.en), `class="ficha-icono" alt="" data-quitar-si-falla`);
    // fuente 2: descripciones de WikiDex (las guardadas antes podían estar en inglés). En
    // inglés van en otro campo y no hay WikiDex
    if (o[CAMPO_DESCRIPCION] === undefined || (!enIngles && o.fuente !== 2)) {
      const aplicar = (texto) => Object.assign(o, { [CAMPO_DESCRIPCION]: texto }, enIngles ? {} : { fuente: 2 });
      completarFicha(elemento, descripcionObjeto(o), aplicar, () => fichaTexto(t("Objeto"), o, icono));
    }
    return fichaTexto(t("Objeto"), o, icono);
  }

  // Foto: si es un Pokémon añadido antes de guardar las stats, se descargan ahora y se guardan
  if (!poke.stats) {
    obtenerStats(poke)
      .then((stats) => {
        poke.stats = stats;
        guardarEquipo();
        actualizarTooltip(elemento, fichaStats(poke));
      })
      .catch(() => actualizarTooltip(elemento, `<div class="ficha ficha-stats"><p>${t("No se han podido cargar las stats.")}</p></div>`));
  }
  return fichaStats(poke);
}

// ---------- Arranque de la vista ----------

// Los botones de la barra llevan solo icono; el texto se queda en el title
function ponerIcono(id, nombre, texto) {
  const boton = document.getElementById(id);
  boton.innerHTML = icono(nombre);
  boton.title = texto;
  boton.setAttribute("aria-label", texto);
}

function ponerBoton(id, nombre, texto, titulo) {
  const boton = document.getElementById(id);
  boton.innerHTML = `${icono(nombre)} <span>${texto}</span>`;
  boton.title = titulo;
}

export function iniciarCrear() {
  activarArrastreTarjetas();

  // Ventana de nivel, naturaleza, EVs e IVs (./entreno.js). Al cambiar algo se guarda y su
  // tarjeta pone al día el botón (sin volver a dibujarla entera)
  iniciarEntreno((poke) => {
    guardarEquipo();
    const tarjeta = tarjetas.get(poke);
    const boton = tarjeta && tarjeta.querySelector(".abrir-entreno");
    if (boton) boton.innerHTML = textoBotonEntreno(poke);
  });

  // Importar y exportar (en el menú «⋯») y Guardar llevan su nombre al lado del icono;
  // Vaciar, solo la papelera, pegado a Guardar
  ponerBoton("importar-equipo", "importar", t("Importar"), t("Importar: pegar un equipo de Showdown"));
  ponerBoton("exportar-equipo", "copiar", t("Exportar"), t("Exportar: copiar el equipo como paste"));
  ponerBoton("guardar", "guardar", t("Guardar"), t("Guardar equipo"));
  ponerIcono("vaciar", "papelera", t("Vaciar equipo"));

  campoNombre.addEventListener("input", () => {
    estado.nombre = campoNombre.value;
    guardarActual();
  });

  // Ventana de análisis (./analizar.js), siempre con el equipo que haya en ese momento
  iniciarAnalisis();

  // Buscar equipo en la caja de un locke (./buscar.js): el elegido llega aquí
  iniciarBuscar((problemas) => {
    renderCrear();
    mostrarAviso(problemas.length ? t("Equipo listo, pero algunas cosas no se han podido reconocer.") : t("Equipo listo ✔"));
  });

  document.getElementById("exportar-equipo").addEventListener("click", async () => {
    if (estado.equipo.length === 0) {
      mostrarAviso(t("No hay nada que exportar."));
      return;
    }
    const copiado = await copiarAlPortapapeles(pasteDelEquipo(estado.equipo));
    if (copiado) sumarContador("exportar");
    mostrarAviso(copiado ? t("Equipo copiado al portapapeles ✔") : t("No he podido copiarlo."));
  });

  document.getElementById("guardar").addEventListener("click", () => {
    if (estado.equipo.length === 0) {
      mostrarAviso(t("Añade al menos un Pokémon antes de guardar."));
      return;
    }
    mostrarAviso(guardarEnMisEquipos() ? t("Equipo guardado ✔") : t("No se ha podido guardar en el navegador."));
  });

  document.getElementById("vaciar").addEventListener("click", async () => {
    if (estado.equipo.length === 0) return;
    // Solo se pregunta si se perdería algo (cambios sin guardar en «Mis equipos»)
    if (hayCambiosSinGuardar()) {
      const seguro = await confirmar(t("Tienes cambios sin guardar en este equipo. ¿Vaciarlo de todas formas?"), { aceptar: t("Vaciar"), peligro: true });
      if (!seguro) return;
    }

    reemplazarEquipo([], "", null);
    renderCrear();
  });

  // Habilidad y objeto: la ficha sale tras un segundo con el ratón encima (si no, moverse por
  // la página era un no parar de fichas). La del Pokémon y las de los ataques, al momento.
  activarTooltips(
    resultado,
    ".arte, .ataque[data-indice], .ataque.habilidad, .ataque.objeto",
    contenidoFicha,
    (elemento) => (elemento.matches(".habilidad, .objeto") ? RETRASO_FICHAS : 0)
  );

  const buscadorPokemon = activarAutocompletado(campoBuscar, datos.pokemon, agregarPokemon, { icono: iconoPokemon });
  document.getElementById("buscar").addEventListener("click", () => buscadorPokemon.elegirPrimera());
}
