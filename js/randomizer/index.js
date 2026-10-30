// ---------- Sección «Randomizer» ----------
//
// Arriba, las pestañas (Pokémon, iniciales, entrenadores...); debajo, la ROM y el botón de
// randomizar y las normas de la pestaña. Todo empieza «sin cambios». Desde un locke
// («Randomizar mi ROM») las normas son las del locke y no se tocan: elegir la ROM y randomizar.
//
// La ROM no sale nunca del navegador: se lee, se randomiza aquí y se descarga. Las de GBA y DS, además, con
// «Randomizar y jugar»: sin descargar nada, pasa a ser una partida nueva de «Jugar» (js/jugar/partidas.js).
//
//   localStorage «poketeams-randomizer-v1»: { reglas } (las tuyas)
//   localStorage «poketeams-randomizer-semillas-v1»: { idLocke: semilla } (la tuya de cada
//     locke: volver a randomizar da la misma ROM)

import { escaparHTML } from "../comun/utilidades.js";
import { icono } from "../comun/iconos.js";
import { leer, escribir } from "../comun/almacen.js";
import { sumarContador } from "../comun/contadores.js";
import { lockePorId, misLockes } from "../comun/lockes.js";
import { JUEGOS } from "../comun/juegos.js";
import { datos, cargarDatos } from "../comun/datos.js";
import { preguntar, confirmar, avisar } from "../comun/ventanas.js";
import {
  completarReglas, hayAlgo, misReglas, REGLAS_VACIAS, CLAVE_MIAS as CLAVE, normasGuardadas, guardarNormas, borrarNormas
} from "./reglas.js";
import { t, LOCALE, nombre as nombreDe } from "../comun/idioma.js";

// La última especie de cada juego (para elegir las iniciales a mano). Sin ROM ni locke, la del
// más nuevo: al randomizar, la que no exista en el juego sale al azar (randomizar.js)
const ULTIMA_ESPECIE = { frlg: 386, dp: 493, platino: 493, hgss: 493, bw: 649, b2w2: 649, xy: 721, oras: 721, sm: 802, usum: 807, bdsp: 493, swsh: 898 };
const ULTIMA_DE_TODAS = Math.max(...Object.values(ULTIMA_ESPECIE));

const CLAVE_SEMILLAS = "poketeams-randomizer-semillas-v1";

// Juego de js/comun/juegos.js por las tres primeras letras del código de la ROM (las de GBA: Rojo Fuego y Verde Hoja)
const JUEGO_DE_CODIGO = {
  IRE: "b2w2", IRD: "b2w2", IRB: "bw", IRA: "bw", ADA: "dp", APA: "dp", CPU: "platino", IPK: "hgss", IPG: "hgss",
  BPR: "frlg", BPG: "frlg"
};
const GEN4 = ["dp", "platino", "hgss"];
// Los de 3DS (se leen del .3ds y salen como archivos sueltos para el emulador o la consola)
const TRES_DS = ["xy", "oras", "sm", "usum"];
// Juego de js/comun/juegos.js por el código de producto de un .3ds («CTR-P-EK2A»)
const JUEGO_DE_CODIGO_3DS = { EK: "xy", EC: "oras", BN: "sm", A2: "usum" };
// La generación de cada juego (las actualizaciones de datos son a las siguientes)
const GENERACION_DE = { frlg: 3, dp: 4, platino: 4, hgss: 4, bw: 5, b2w2: 5, xy: 6, oras: 6, sm: 7, usum: 7, bdsp: 8, swsh: 8 };
// Los de Switch (se elige su carpeta «romfs» y sale un .zip, un mod)
const SWITCH = ["swsh", "bdsp"];
// Lo que no tiene cada juego (no sale en su pestaña): no tienen tutores de ataques Negro y Blanco, Diamante y Perla,
// X e Y, y Sol y Luna
const SIN_PESTANAS = {};
// En Diamante Brillante y Perla Reluciente, los intercambios van en los scripts
const SIN_APARTADOS = { bw: ["tutores"], dp: ["tutores"], xy: ["tutores"], oras: [], sm: ["tutores"], usum: [], bdsp: ["tutores", "intercambios"] };

const PARECIDA_ALEATORIO = [["no", "Sin cambios"], ["parecida", "Fuerza parecida"], ["cualquiera", "Aleatorio"]];
// A quién: se marcan sueltos, ninguno es nadie
const QUIEN = [["lideres", "Líderes"], ["rivales", "Rivales"], ["normales", "Entrenadores"]];
const COMPAT = [["no", "Sin cambios"], ["aleatoria", "Aleatorio"], ["total", "Todos"]];
const ALEATORIO = [["no", "Sin cambios"], ["azar", "Aleatorio"]];
const SI_NO = [[false, "Sin cambios"], [true, "Aleatorio"]];
// Solo Sol, Luna, Ultrasol y Ultraluna tienen tótems
const SIN_TOTEMS = ["frlg", "dp", "platino", "hgss", "bw", "b2w2", "xy", "oras", ...SWITCH];
// Las generaciones a las que se puede actualizar (las de después del juego)
const GENERACIONES = (juego) => [
  [0, t("Sin cambios")], ...[5, 6, 7, 8, 9].filter((g) => g > (GENERACION_DE[juego] || 5)).map((g) => [g, t("{n}.ª generación", { n: g })])
];
// Multiplicador de niveles: se guarda lo que suben, en %
const MULTIPLICADOR = { tipo: "barra", min: 0, max: 100, paso: 5, formato: (v) => (v ? `×${(1 + v / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2 })}` : t("Sin cambios")) };

// Las pestañas, y en cada una sus apartados. Cada apartado, sus campos, siempre a la vista: el
// primer valor de cada uno es «sin cambios». tipo: «opciones» (botones), «casilla» (sí o no),
// «lista» (desplegable), «barra» (deslizable) o «iniciales» (las tres, a mano). «hijos»: los que
// dependen de este, colgando debajo; se ven cuando «abre» lo dice. «si»: solo se muestra con
// eso. «ayuda»: lo que explica la «i» de al lado (solo en las que lo necesitan).
const PESTANAS = [
  {
    id: "pokemon", titulo: "Pokémon",
    apartados: [
      {
        id: "stats", titulo: "Estadísticas", icono: "actividad",
        campos: [
          { k: "modo", tipo: "opciones", opciones: ALEATORIO, ayuda: "Cada Pokémon conserva la suma total de sus estadísticas base, pero repartida de otra forma entre PS, Ataque, Defensa, etc." },
          { k: "generacion", tipo: "lista", texto: "Actualizar a la generación", opciones: GENERACIONES, ayuda: "Algunos Pokémon cambiaron sus estadísticas base en juegos posteriores. Con esta opción tienen las de la generación que elijas." }
        ]
      },
      {
        id: "tipos", titulo: "Tipos", icono: "etiqueta",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: ALEATORIO, abre: (r) => r.tipos.modo !== "no",
            hijos: [{ k: "familia", tipo: "casilla", texto: "Se mantienen al evolucionar" }]
          }
        ]
      },
      {
        id: "habilidades", titulo: "Habilidades", icono: "estrella",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: ALEATORIO, abre: (r) => r.habilidades.modo !== "no",
            hijos: [
              { k: "familia", tipo: "casilla", texto: "Se mantienen al evolucionar" },
              { k: "dos", tipo: "casilla", texto: "Todos los Pokémon tienen dos habilidades" },
              { k: "sinMalas", tipo: "casilla", texto: "Banear habilidades inútiles" }
            ]
          }
        ]
      },
      {
        id: "evoluciones", titulo: "Evoluciones", icono: "mega",
        campos: [
          { k: "modo", tipo: "opciones", opciones: ALEATORIO, ayuda: "Cada Pokémon evoluciona en otro distinto de fuerza parecida. Ninguna línea evolutiva pasa de tres fases." },
          { k: "dificiles", tipo: "casilla", texto: "Facilitar evoluciones complejas", ayuda: "Los Pokémon que evolucionan de forma difícil en un locke (por intercambio, amistad, sabiendo un ataque, en un lugar concreto…) también evolucionan al llegar a cierto nivel.\n\nLos que evolucionan por intercambio llevando un objeto también lo hacen subiendo de nivel con ese objeto equipado.\n\nLa forma original de evolucionar sigue funcionando." },
          { k: "objetos", tipo: "casilla", texto: "Facilitar evoluciones por objeto", ayuda: "Los Pokémon que evolucionan con una piedra u otro objeto también evolucionan al llegar a cierto nivel, sin necesitar el objeto. El objeto sigue funcionando." },
          { k: "niveles", tipo: "casilla", texto: "Bajar niveles de evolución", ayuda: "Adelanta las evoluciones por nivel que llegan muy tarde. Como máximo:\n\n· Líneas de tres fases: nivel 24 para la primera evolución y 36 para la segunda (45 en los pseudolegendarios).\n· Líneas de dos fases: nivel 30 (36 si el Pokémon es fuerte)." }
        ]
      }
    ]
  },
  {
    id: "ataques", titulo: "Ataques",
    apartados: [
      {
        id: "movimientos", titulo: "Datos de los ataques", icono: "rayo",
        campos: [{ k: "generacion", tipo: "lista", texto: "Actualizar a la generación", opciones: GENERACIONES, ayuda: "Algunos ataques cambiaron de potencia, precisión, PP o tipo en juegos posteriores. Con esta opción tienen los de la generación que elijas." }]
      },
      {
        id: "ataques", titulo: "Ataques que aprenden", icono: "libro",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: ALEATORIO, abre: (r) => r.ataques.modo !== "no",
            hijos: [
              { k: "deSuTipo", tipo: "casilla", texto: "Preferiblemente de su tipo" },
              { k: "tipo", tipo: "barra", texto: "Ataques de su tipo", min: 0, max: 100, paso: 5, formato: (v) => `${v} %`, si: (r) => r.ataques.deSuTipo },
              { k: "inicio", tipo: "lista", texto: "Número de ataques asegurados", opciones: [[0, "Sin cambios"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]], ayuda: "Cuántos ataques sabe cada Pokémon como mínimo desde el nivel 1. Si tiene menos, se le añaden los que falten. El resto los sigue aprendiendo en los mismos niveles." },
              { k: "orden", tipo: "casilla", texto: "Ataques más fuertes en niveles más altos" }
            ]
          }
        ]
      },
      {
        id: "mt", titulo: "MT", icono: "disco",
        campos: [
          // En Espada y Escudo, qué enseña cada MT va en el programa del juego (no se puede cambiar)
          { k: "ataques", tipo: "opciones", opciones: SI_NO, no: ["swsh"] },
          {
            k: "compat", tipo: "opciones", texto: "Quién las aprende", opciones: COMPAT, abre: (r) => r.mt.compat === "aleatoria",
            ayuda: "Con «Aleatorio», cada Pokémon tiene un 50 % de probabilidades de poder aprender cada MT. Con «Todos», todos pueden aprender todas.\n\nEn Espada y Escudo se aplica también a los DT.",
            hijos: [
              { k: "deSuTipo", tipo: "casilla", texto: "Más fácil si son de su tipo" },
              { k: "tipo", tipo: "barra", texto: "Las de su tipo", min: 50, max: 100, paso: 5, formato: (v) => `${v} %`, si: (r) => r.mt.deSuTipo }
            ]
          },
          { k: "mo", tipo: "casilla", texto: "Todos aprenden las MO", si: (r) => r.mt.compat !== "total", no: SWITCH }
        ]
      },
      {
        id: "tutores", titulo: "Tutores de ataques", icono: "persona",
        campos: [
          { k: "ataques", tipo: "opciones", opciones: SI_NO, no: ["swsh"] },
          {
            k: "compat", tipo: "opciones", texto: "Quién los aprende", opciones: COMPAT, abre: (r) => r.tutores.compat === "aleatoria",
            hijos: [
              { k: "deSuTipo", tipo: "casilla", texto: "Más fácil si son de su tipo" },
              { k: "tipo", tipo: "barra", texto: "Los de su tipo", min: 50, max: 100, paso: 5, formato: (v) => `${v} %`, si: (r) => r.tutores.deSuTipo }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "especiales", titulo: "Iniciales y especiales",
    apartados: [
      {
        id: "iniciales", titulo: "Iniciales", icono: "pokeball",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: [["no", "Sin cambios"], ["cualquiera", "Aleatorio"], ["dos-evoluciones", "Con dos evoluciones"], ["elegidas", "Elegir"]],
            abre: (r) => r.iniciales.modo !== "no",
            hijos: [
              { k: "elegidas", tipo: "iniciales", texto: "Iniciales", si: (r) => r.iniciales.modo === "elegidas" },
              { k: "rivalInicial", tipo: "casilla", texto: "El rival lleva su inicial", ayuda: "El rival escoge la inicial nueva que tiene ventaja sobre la tuya y la va evolucionando a lo largo del juego, igual que en el original." }
            ]
          }
        ]
      },
      {
        id: "estaticos", titulo: "Estáticos", icono: "corona", ayuda: "Los legendarios y otros Pokémon que encuentras quietos en el mapa, y los que te regalan durante la historia.",
        campos: [
          { k: "modo", tipo: "opciones", opciones: PARECIDA_ALEATORIO },
          { k: "totems", tipo: "opciones", texto: "Tótems", opciones: PARECIDA_ALEATORIO, no: SIN_TOTEMS },
          { k: "aliados", tipo: "opciones", texto: "Aliados de los tótems", opciones: PARECIDA_ALEATORIO, no: SIN_TOTEMS },
          { k: "aura", tipo: "opciones", texto: "Aura de los tótems", opciones: ALEATORIO, no: SIN_TOTEMS }
        ]
      },
      {
        id: "intercambios", titulo: "Intercambios", icono: "intercambiar",
        campos: [
          { k: "modo", tipo: "opciones", opciones: PARECIDA_ALEATORIO },
          { k: "objetos", tipo: "casilla", texto: "Objetos de los intercambios aleatorios" },
          { k: "ivs", tipo: "casilla", texto: "IVs de los intercambios aleatorios" }
        ]
      }
    ]
  },
  {
    id: "entrenadores", titulo: "Entrenadores",
    apartados: [
      {
        id: "entrenadores", titulo: "Pokémon de entrenadores", icono: "espadas",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: PARECIDA_ALEATORIO, abre: (r) => r.entrenadores.modo !== "no",
            hijos: [
              { k: "sinLegendarios", tipo: "casilla", texto: "Sin legendarios" },
              { k: "lideresTipo", tipo: "casilla", texto: "Líderes y Alto Mando de un tipo", ayuda: "Cada gimnasio (el líder y sus entrenadores), cada miembro del Alto Mando y el campeón usan Pokémon de un único tipo, elegido al azar." }
            ]
          },
          { k: "nivel", texto: "Multiplicador de niveles", ...MULTIPLICADOR }
        ]
      },
      {
        id: "entrenadores", titulo: "Más Pokémon y objetos", icono: "mas",
        campos: [
          {
            k: "extras", tipo: "opciones", varias: true, texto: "Pokémon extra para", opciones: QUIEN, abre: (r) => r.entrenadores.extras.length > 0,
            ayuda: "Los entrenadores que elijas llevan más Pokémon, hasta un máximo de seis. El primer combate contra el rival no cambia, porque en ese momento solo tienes un Pokémon.",
            hijos: [{ k: "cuantos", tipo: "opciones", texto: "Cuántos se añaden", opciones: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]] }]
          },
          { k: "objetos", tipo: "opciones", varias: true, texto: "Añadir objetos a", opciones: QUIEN },
          {
            k: "evolucionados", tipo: "casilla", texto: "Evolucionados del todo", ayuda: "A partir del nivel que elijas, los entrenadores solo usan Pokémon en su última evolución.",
            abre: (r) => r.entrenadores.evolucionados,
            hijos: [{ k: "nivelEvolucionados", tipo: "barra", texto: "Desde el nivel", min: 10, max: 70, paso: 1, formato: (v) => t("Nivel {n}", { n: v }) }]
          }
        ]
      },
      {
        id: "entrenadores", titulo: "Combates", icono: "amigos",
        campos: [
          { k: "dobles", tipo: "casilla", texto: "Todos los combates dobles" },
          { k: "nombres", tipo: "casilla", texto: "Nombres de los entrenadores aleatorios" }
        ]
      }
    ]
  },
  {
    id: "salvajes", titulo: "Salvajes",
    apartados: [
      {
        id: "salvajes", titulo: "Pokémon salvajes", icono: "mapa",
        campos: [
          {
            k: "modo", tipo: "opciones", opciones: PARECIDA_ALEATORIO, abre: (r) => r.salvajes.modo !== "no",
            hijos: [{ k: "sinLegendarios", tipo: "casilla", texto: "Sin legendarios" }]
          },
          { k: "nivel", texto: "Multiplicador de niveles", ...MULTIPLICADOR },
          {
            k: "unico", tipo: "casilla", texto: "Un solo Pokémon por zona en el campo", no: ["frlg", "dp", "platino", "hgss", "bw", "b2w2", "xy", "oras", "sm", "usum", "bdsp"],
            ayuda: "En Espada y Escudo los Pokémon salvajes se ven por el campo, así que podrías elegir contra cuál luchar. Con esta opción, todos los que se ven en cada zona son de la misma especie, elegida al azar: te toca la que te toca.\n\nLos que salen de la hierba alta con «!» siguen siendo al azar entre los de la zona."
          },
          {
            k: "variedad", tipo: "casilla", texto: "Más variedad en cada zona",
            ayuda: "Normalmente cada Pokémon de una zona se cambia siempre por el mismo: si en la Ruta 201 solo hay Starly y Bidoof, solo verás dos Pokémon distintos. Con esta opción cada hueco de la hierba, el agua, etc. se sortea por separado, como en el Universal Pokémon Randomizer, y salen muchos más distintos."
          },
          { k: "objetos", tipo: "casilla", texto: "Objetos de los Pokémon salvajes aleatorios" },
          {
            k: "pueblos", tipo: "casilla", texto: "Hierba en los pueblos", no: ["frlg", "sm", "usum", ...SWITCH],
            ayuda: "Añade una zona de hierba alta invisible en los pueblos y ciudades que no tienen Pokémon salvajes. Salen los mismos Pokémon que en la ruta por la que se llega a ese pueblo."
          }
        ]
      }
    ]
  },
  {
    id: "objetos", titulo: "Objetos",
    apartados: [
      {
        id: "objetos", titulo: "Objetos del suelo", icono: "objeto", ayuda: "Cambia los objetos que encuentras por el camino, también los ocultos. Donde había una MT aparece otra MT, y los objetos clave de la historia no se tocan.",
        campos: [
          { k: "suelo", tipo: "opciones", opciones: SI_NO },
          { k: "sinMalos", tipo: "casilla", texto: "Banear objetos inútiles", ayuda: "Quita los objetos que no sirven durante la aventura (cartas, pañuelos, objetos de colección…). No aparecen en el suelo, en las tiendas ni equipados en los Pokémon." }
        ]
      },
      {
        id: "objetos", titulo: "Tiendas", icono: "caja",
        campos: [
          {
            k: "tiendas", tipo: "casilla", texto: "Tiendas especiales aleatorias", ayuda: "Cambia lo que venden las tiendas especiales (todas menos la Tienda Pokémon normal). Donde se vendía una MT, se vende otra MT.",
            abre: (r) => r.objetos.tiendas,
            hijos: [{ k: "sinNormales", tipo: "casilla", texto: "Sin lo de las tiendas normales" }]
          },
          { k: "piedras", tipo: "casilla", texto: "Siempre hay piedras evolutivas" },
          { k: "caramelos", tipo: "casilla", texto: "Caramelos Raros baratos" },
          { k: "precios", tipo: "casilla", texto: "Precios equilibrados" }
        ]
      }
    ]
  },
  {
    id: "varios", titulo: "Varios",
    apartados: [
      {
        id: "varios", titulo: "Varios", icono: "pokedex",
        campos: [
          { k: "pokedex", tipo: "casilla", texto: "Pokédex Nacional desde el principio", no: [...GEN4, "sm", "usum", ...SWITCH] },
          { k: "texto", tipo: "casilla", texto: "Texto instantáneo", no: [...GEN4, ...SWITCH] }
        ]
      }
    ]
  }
];

// Los textos de las pestañas, en el idioma de la web (las listas de opciones compartidas, una vez)
const opcionesTraducidas = new WeakSet();
function traducirConfig(cosa) {
  if (Array.isArray(cosa)) {
    cosa.forEach(traducirConfig);
    return;
  }
  if (!cosa || typeof cosa !== "object") return;
  for (const campo of ["titulo", "texto", "ayuda"]) if (typeof cosa[campo] === "string") cosa[campo] = t(cosa[campo]);
  if (Array.isArray(cosa.opciones) && !opcionesTraducidas.has(cosa.opciones)) {
    opcionesTraducidas.add(cosa.opciones);
    for (const opcion of cosa.opciones) if (typeof opcion[1] === "string") opcion[1] = t(opcion[1]);
  }
  for (const hijo of [cosa.apartados, cosa.campos, cosa.hijos]) if (hijo) traducirConfig(hijo);
}
traducirConfig(PESTANAS);

let vista = null;
let mias = null; // reglas que se están editando (tuyas)
let guardada = null; // id de las normas guardadas que se están editando (null: las sueltas)
let idLocke = null; // con normas de un locke
let rom = null; // { archivo (File), juego, nombre }
let trabajando = false;
let pestana = PESTANAS[0].id;

// ---------- Normas ----------

function reglasActuales() {
  if (idLocke) {
    const locke = lockePorId(idLocke);
    if (locke && locke.randomizer) return completarReglas(locke.randomizer.reglas);
  }
  return mias;
}

// Lo que se cambia se guarda solo: en las normas guardadas que estén elegidas o, si no, en las sueltas
function guardarMias() {
  if (guardada) guardarNormas(null, mias, guardada);
  else escribir(CLAVE, { reglas: mias });
}

// La barra de normas: de dónde vienen las que se ven (las sueltas, unas guardadas o las de un
// locke) y qué se puede hacer con ellas
function plantillaNormas() {
  const guardadas = normasGuardadas();
  const lockes = misLockes().filter((l) => l.randomizer);
  const elegida = idLocke ? `l:${idLocke}` : guardada ? `g:${guardada}` : "";
  const opcion = (valor, texto) => `<option value="${escaparHTML(valor)}" ${valor === elegida ? "selected" : ""}>${escaparHTML(texto)}</option>`;
  return `
    <div class="random-normas">
      <span>${t("Normas")}</span>
      <select class="random-normas-elegir">
        ${opcion("", t("Sin guardar"))}
        ${guardadas.length ? `<optgroup label="${t("Guardadas")}">${guardadas.map((n) => opcion(`g:${n.id}`, n.nombre)).join("")}</optgroup>` : ""}
        ${lockes.length ? `<optgroup label="${t("De un locke")}">${lockes.map((l) => opcion(`l:${l.id}`, l.nombre)).join("")}</optgroup>` : ""}
      </select>
      ${idLocke
        ? `<button class="random-boton-normas" data-normas="copiar">${t("Copiar a las mías")}</button>`
        : `<button class="random-boton-normas" data-normas="guardar">${guardada ? t("Guardar copia") : t("Guardar")}</button>
           ${guardada ? `<button class="random-boton-normas" data-normas="borrar">${t("Borrar")}</button>` : ""}`}
    </div>`;
}

// Elegir de dónde vienen las normas
function elegirNormas(valor) {
  idLocke = null;
  guardada = null;
  if (valor.startsWith("l:")) idLocke = valor.slice(2);
  else if (valor.startsWith("g:")) {
    const n = normasGuardadas().find((x) => x.id === valor.slice(2));
    if (n) {
      guardada = n.id;
      mias = completarReglas(n.reglas);
    }
  } else mias = misReglas() || completarReglas();
  if (rom) revisarRom();
  else pintar();
}

// Todo sin cambios, para empezar de nuevo (también en las normas guardadas que estén elegidas)
async function vaciarNormas() {
  if (idLocke || !(await confirmar(t("¿Borrar todo lo elegido para randomizar?"), { aceptar: t("Borrar todo") }))) return;
  mias = completarReglas();
  guardarMias();
  pintar();
}

async function accionNormas(que) {
  if (que === "guardar") {
    const nombre = await preguntar(t("Nombre para estas normas:"), "");
    if (!nombre || !nombre.trim()) return;
    guardada = guardarNormas(nombre.trim().slice(0, 40), mias);
    pintar();
  } else if (que === "borrar") {
    const n = normasGuardadas().find((x) => x.id === guardada);
    if (!n || !(await confirmar(t("¿Borrar las normas «{nombre}»?", { nombre: n.nombre })))) return;
    borrarNormas(guardada);
    guardada = null;
    mias = misReglas() || completarReglas();
    pintar();
  } else if (que === "copiar") {
    const locke = lockePorId(idLocke);
    if (!locke || !locke.randomizer) return;
    mias = completarReglas(locke.randomizer.reglas);
    idLocke = null;
    guardada = null;
    escribir(CLAVE, { reglas: mias });
    if (rom) revisarRom();
    else pintar();
  }
}

// ---------- Pintar ----------

// Las tres iniciales a mano: un desplegable por cada una, con todas las especies
function plantillaIniciales(a, c, valor, dis) {
  const lista = (datos && datos.pokemon) || [];
  const locke = idLocke ? lockePorId(idLocke) : null;
  const juego = (rom && !rom.error && rom.juego) || (locke && locke.juego);
  const ultima = ULTIMA_ESPECIE[juego] || ULTIMA_DE_TODAS;
  const especies = lista.filter((p) => p.id <= ultima).sort((x, y) => x.id - y.id);
  return `<div class="random-iniciales">${[0, 1, 2]
    .map((i) => `
      <select data-apartado="${a.id}" data-campo="${c.k}" data-indice="${i}" ${dis}>
        <option value="0">${t("Aleatoria")}</option>
        ${especies.map((p) => `<option value="${p.id}" ${Number(valor[i]) === p.id ? "selected" : ""}>${escaparHTML(nombreDe(p))}</option>`).join("")}
      </select>`)
    .join("")}</div>`;
}

// Los que cuelgan de un campo (si los tiene y están abiertos), sangrados y con su línea
function plantillaHijos(a, c, reglas, bloqueado) {
  if (!c.hijos || !c.abre(reglas)) return "";
  const filas = c.hijos.map((h) => plantillaFila(a, h, reglas, bloqueado)).join("");
  return filas ? `<div class="random-hijos">${filas}</div>` : "";
}

// El juego para el que se ve el randomizer: el de la ROM elegida o, si no hay, el del locke
function juegoActual() {
  if (rom && rom.juego) return rom.juego;
  const locke = idLocke ? lockePorId(idLocke) : null;
  return (locke && locke.juego) || "";
}

// «no»: los juegos que no tienen esa opción. Un apartado sin ninguna que se vea no sale; una pestaña
// sin apartados, tampoco
const noLoTiene = (c) => Boolean(c.no && c.no.includes(juegoActual()));
const apartadoVisible = (a) => !(SIN_APARTADOS[juegoActual()] || []).includes(a.id) && a.campos.some((c) => !noLoTiene(c));
const pestanaVisible = (p) => !(SIN_PESTANAS[juegoActual()] || []).includes(p.id) && p.apartados.some(apartadoVisible);

// La «i» de las opciones que necesitan explicación: al pulsarla, una ventana con el texto
function botonInfo(texto) {
  return texto ? `<button class="random-info" data-info="${escaparHTML(texto)}" aria-label="${t("Qué es esto")}" title="${t("Qué es esto")}">i</button>` : "";
}

// Una fila: el nombre a la izquierda y el control a la derecha; debajo, lo que cuelga de ella
function plantillaFila(a, c, reglas, bloqueado) {
  if (c.si && !c.si(reglas)) return "";
  if (noLoTiene(c)) return "";
  return `
    <div class="random-fila">
      <span class="random-nombre">${escaparHTML(c.texto || "")}${botonInfo(c.ayuda)}</span>
      ${plantillaControl(a, c, reglas, bloqueado)}
    </div>
    ${plantillaHijos(a, c, reglas, bloqueado)}`;
}

function plantillaControl(a, c, reglas, bloqueado) {
  const valor = reglas[a.id][c.k];
  const dis = bloqueado ? "disabled" : "";
  const dato = `data-apartado="${a.id}" data-campo="${c.k}"`;
  if (c.tipo === "iniciales") return plantillaIniciales(a, c, valor, dis);
  // Un número: barra deslizable, con lo que vale al lado
  if (c.tipo === "barra") {
    return `
      <label class="random-barra-valor">
        <output>${escaparHTML(c.formato(valor))}</output>
        <input type="range" min="${c.min}" max="${c.max}" step="${c.paso}" value="${valor}" ${dato} ${dis}>
      </label>`;
  }
  // Sí o no: un interruptor
  if (c.tipo === "casilla") {
    return `<button class="random-interruptor ${valor ? "activa" : ""}" role="switch" aria-checked="${Boolean(valor)}" aria-label="${escaparHTML(c.texto)}" ${dato} data-valor="${!valor}" ${dis}><i></i></button>`;
  }
  // Varias opciones que se marcan sueltas (varias: el valor es la lista de las marcadas): cada
  // botón lleva la lista que queda al pulsarlo
  if (c.tipo === "opciones" && c.varias) {
    const marcadas = valor || [];
    const alPulsar = (v) => c.opciones.map(([x]) => x).filter((x) => (x === v) !== marcadas.includes(x));
    return `<div class="random-segmentado" title="${escaparHTML(c.ayuda || "")}">${c.opciones
      .map(([v, t]) => `<button class="${marcadas.includes(v) ? "activa" : ""}" aria-pressed="${marcadas.includes(v)}" ${dato} data-valor="${escaparHTML(JSON.stringify(alPulsar(v)))}" ${dis}>${escaparHTML(t)}</button>`)
      .join("")}</div>`;
  }
  // Varias opciones: botones pegados, siempre en una fila (en pantallas estrechas, en columna)
  if (c.tipo === "opciones") {
    return `<div class="random-segmentado" title="${escaparHTML(c.ayuda || "")}">${c.opciones
      .map(([v, t]) => `<button class="${v === valor ? "activa" : ""}" ${dato} data-valor="${escaparHTML(JSON.stringify(v))}" ${dis}>${escaparHTML(t)}</button>`)
      .join("")}</div>`;
  }
  const opciones = typeof c.opciones === "function" ? c.opciones(rom && rom.juego) : c.opciones;
  return `<select class="random-desplegable" ${dato} ${dis}>${opciones.map(([v, t]) => `<option value="${escaparHTML(JSON.stringify(v))}" ${v === valor ? "selected" : ""}>${escaparHTML(t)}</option>`).join("")}</select>`;
}

// ¿Algo de esta tarjeta (o de lo que cuelga) no está sin cambios?
function tarjetaCambiada(a, reglas) {
  const claves = [];
  const juntar = (campos) => campos.forEach((c) => (claves.push(c.k), c.hijos && juntar(c.hijos)));
  juntar(a.campos);
  return claves.some((k) => JSON.stringify(reglas[a.id][k]) !== JSON.stringify(REGLAS_VACIAS[a.id][k]));
}

// Una tarjeta por apartado. Si el primer campo son opciones sin nombre, es la principal: va en la
// cabecera, al lado del título, y lo que cuelga de ella, justo debajo. Los demás, una fila cada uno.
function plantillaApartado(a, reglas, bloqueado) {
  const [primero, ...resto] = a.campos;
  // (si el juego no la tiene, no hay principal: sale como fila, y la fila no se pinta)
  const principal = primero.tipo === "opciones" && !primero.texto && !noLoTiene(primero) ? primero : null;
  const filas = (principal ? resto : a.campos).map((c) => plantillaFila(a, c, reglas, bloqueado)).join("");
  // La explicación del apartado y la de su opción principal, juntas en la «i» del título
  const ayuda = [a.ayuda, principal && principal.ayuda].filter(Boolean).join("\n\n");
  return `
    <section class="random-tarjeta ${tarjetaCambiada(a, reglas) ? "encendida" : ""}">
      <header>
        <h3>${icono(a.icono)} ${escaparHTML(a.titulo)}${botonInfo(ayuda)}</h3>
        ${principal ? plantillaControl(a, principal, reglas, bloqueado) : ""}
      </header>
      ${principal ? plantillaHijos(a, principal, reglas, bloqueado) : ""}
      ${filas}
    </section>`;
}

function pintar() {
  const locke = idLocke ? lockePorId(idLocke) : null;
  if (idLocke && !(locke && locke.randomizer)) idLocke = null;
  const reglas = reglasActuales();
  const bloqueado = Boolean(idLocke);
  const visibles = PESTANAS.filter(pestanaVisible);
  const actual = visibles.find((p) => p.id === pestana) || visibles[0];

  // Una pestaña con algo cambiado lleva un punto
  const cambiada = (p) => p.apartados.some((a) => tarjetaCambiada(a, reglas));
  vista.innerHTML = `
    <div class="selector-regiones random-pestanas">
      ${visibles.map((p) => `<button data-pestana="${p.id}" class="${p.id === actual.id ? "activa" : ""}">${escaparHTML(p.titulo)}${cambiada(p) ? `<i class="random-punto"></i>` : ""}</button>`).join("")}
    </div>
    ${plantillaNormas()}
    <div class="random-barra">
      <button class="random-elegir">${icono("subir")} ${rom ? t("Otra ROM") : t("Elegir ROM")}</button>
      <button class="random-elegir-carpeta" title="${t("Los de Switch: la carpeta «romfs» sacada desde el emulador")}">${icono("carpeta")} ${t("Elegir carpeta")}</button>
      <button class="random-ayuda" title="${t("Qué elegir en cada consola y qué hacer con lo que sale")}" aria-label="${t("Ayuda")}">?</button>
      <span class="random-rom ${rom && rom.error ? "con-error" : ""}">${rom ? escaparHTML(rom.error || `${rom.nombre} · ${rom.archivo.name}`) : ""}</span>
      <button class="random-vaciar" ${!idLocke && hayAlgo(reglas) ? "" : "disabled"}>${icono("deshacer")} ${t("Borrar todo")}</button>
      ${rom && !rom.es3DS && !rom.carpeta ? `<button class="random-jugar" ${!rom.error && !trabajando && hayAlgo(reglas) ? "" : "disabled"} title="${t("Sin descargar nada: se queda en «Jugar», lista para jugar")}">${icono("consola")} ${t("Randomizar y jugar")}</button>` : ""}
      <button class="random-ir" ${rom && !rom.error && !trabajando && hayAlgo(reglas) ? "" : "disabled"} title="${hayAlgo(reglas) ? "" : t("Cambia algo primero")}">${icono("mezclar")} ${trabajando ? t("Randomizando...") : t("Randomizar")}</button>
    </div>
    <span class="random-estado"></span>
    <div class="random-tarjetas">${actual.apartados.filter(apartadoVisible).map((a) => plantillaApartado(a, reglas, bloqueado)).join("")}</div>
    <input class="random-archivo" type="file" accept=".nds,.3ds,.gba" hidden>
    <input class="random-carpeta" type="file" webkitdirectory hidden>`;
}
// ---------- ROM ----------

async function elegirRom(archivo) {
  rom = { archivo, nombre: "", juego: "", error: "" };
  if (/\.(nsp|xci|nsz|xcz)$/i.test(archivo.name)) {
    rom.error = t("Los juegos de Switch van cifrados: hay que sacar su carpeta «romfs» desde el emulador y elegirla con «Elegir carpeta» (mira el «?»).");
    pintar();
    return;
  }
  try {
    // La cabecera basta para saber qué juego es
    const cabecera = new Uint8Array(await archivo.slice(0, 0x200).arrayBuffer());
    let juego;
    if (new TextDecoder("latin1").decode(cabecera.subarray(0x100, 0x104)) === "NCSD") {
      // Un .3ds: el código del juego está en la cabecera de su primera partición
      const inicio = new DataView(cabecera.buffer).getUint32(0x120, true) * 0x200;
      const particion = new Uint8Array(await archivo.slice(inicio, inicio + 0x200).arrayBuffer());
      const producto = new TextDecoder("latin1").decode(particion.subarray(0x150, 0x160));
      juego = JUEGO_DE_CODIGO_3DS[producto.slice(6, 8)];
      rom.es3DS = true;
      if (juego && !(particion[0x188 + 7] & 4)) {
        rom.error = t("Ese .3ds está cifrado: hace falta uno descifrado.");
      }
    } else if (cabecera[0xb2] === 0x96) {
      // Una ROM de GBA: el código va en 0xAC
      juego = JUEGO_DE_CODIGO[new TextDecoder("latin1").decode(cabecera.subarray(0xac, 0xaf))];
      rom.esGBA = true;
    } else {
      const codigo = new TextDecoder("latin1").decode(cabecera.subarray(0x0c, 0x10));
      juego = JUEGO_DE_CODIGO[codigo.slice(0, 3)];
    }
    if (!juego) {
      rom.error = t("Este juego todavía no se puede randomizar (de momento, Rojo Fuego y Verde Hoja y los de DS, 3DS y Switch).");
    } else {
      rom.juego = juego;
      rom.nombre = (JUEGOS.find((j) => j.id === juego) || {}).nombre || juego;
      const locke = idLocke ? lockePorId(idLocke) : null;
      if (locke && locke.juego && locke.juego !== juego) {
        const delLocke = (JUEGOS.find((j) => j.id === locke.juego) || {}).nombre || locke.juego;
        rom.error = t("Esa ROM es de {rom} y el locke, de {locke}.", { rom: rom.nombre, locke: delLocke });
      }
    }
  } catch (error) {
    console.error(error);
    rom.error = t("No se ha podido leer el archivo.");
  }
  pintar();
}

// La ROM ya elegida, otra vez (han cambiado las normas o el locke: puede no valer para este)
function revisarRom() {
  if (rom && rom.carpeta) elegirCarpeta(rom.archivos);
  else if (rom) elegirRom(rom.archivo);
}

// Los de Switch: la carpeta «romfs» sacada desde el emulador (ver el «?»). archivos: los File del
// <input webkitdirectory>, con su ruta dentro de la carpeta elegida (webkitRelativePath)
const ROMFS = {
  swsh: "bin/pml/personal/personal_total.bin",
  bdsp: "Data/StreamingAssets/AssetAssistant/Pml/personal_masterdatas"
};
// Los que ya se saben randomizar
const ROMFS_LISTOS = ["swsh", "bdsp"];

// Antes de abrir el selector, lo que va a pasar (el navegador pregunta con su propia ventana si se «suben» los
// archivos: no se puede cambiar, pero sí avisar antes con una ventana de la web). Solo la primera vez
const CLAVE_AVISO_CARPETA = "poketeams-randomizer-aviso-carpeta-v1";
async function elegirCarpetaConAviso() {
  if (!leer(CLAVE_AVISO_CARPETA, false)) {
    const seguir = await confirmar(
      `${t("Elige la carpeta «romfs» del juego (la que sacaste desde el emulador).")}\n\n` +
      `${t("Después, el navegador te preguntará con su propia ventana si quieres «subir» los archivos a esta web. Acepta: no se sube nada, la web los lee aquí mismo, en tu ordenador.")}\n\n` +
      t("Si es una carpeta grande, puede tardar unos segundos en aparecer."),
      { aceptar: t("Elegir carpeta"), cancelar: t("Cancelar") }
    );
    if (!seguir) return;
    escribir(CLAVE_AVISO_CARPETA, true);
  }
  vista.querySelector(".random-carpeta").click();
}

function elegirCarpeta(archivos) {
  const nombreCarpeta = (archivos[0].webkitRelativePath || "").split("/")[0] || "romfs";
  rom = { archivos, archivo: { name: nombreCarpeta }, carpeta: true, nombre: "", juego: "", error: "" };
  // La ruta de cada uno dentro del romfs (se haya elegido la carpeta «romfs» o la de encima)
  const rutas = new Map();
  for (const a of archivos) {
    const partes = a.webkitRelativePath.split("/").slice(1);
    const romfs = partes.indexOf("romfs");
    rutas.set((romfs >= 0 ? partes.slice(romfs + 1) : partes).join("/"), a);
  }
  rom.rutas = rutas;
  const juego = Object.keys(ROMFS).find((id) => rutas.has(ROMFS[id]));
  if (!juego) {
    rom.error = t("Esa carpeta no es el «romfs» de un juego que se sepa randomizar (mira el «?»).");
  } else {
    rom.juego = juego;
    rom.nombre = (JUEGOS.find((j) => j.id === juego) || {}).nombre || juego;
    if (!ROMFS_LISTOS.includes(juego)) rom.error = t("Todavía no se puede randomizar este juego.");
    const locke = idLocke ? lockePorId(idLocke) : null;
    if (locke && locke.juego && locke.juego !== juego) {
      const delLocke = (JUEGOS.find((j) => j.id === locke.juego) || {}).nombre || locke.juego;
      rom.error = t("Esa carpeta es de {rom} y el locke, de {locke}.", { rom: rom.nombre, locke: delLocke });
    }
  }
  pintar();
}

const modulos = {};

function semillaPara() {
  const { nuevaSemilla } = modulos.azar;
  if (!idLocke) return nuevaSemilla();
  const semillas = leer(CLAVE_SEMILLAS, {}) || {};
  if (!semillas[idLocke]) {
    semillas[idLocke] = nuevaSemilla();
    escribir(CLAVE_SEMILLAS, semillas);
  }
  return semillas[idLocke];
}

// jugar: las de GBA, a una partida nueva de «Jugar» en lugar de descargarla
async function randomizar(jugar = false) {
  if (!rom || rom.error || trabajando) return;
  trabajando = true;
  pintar();
  const estado = () => vista.querySelector(".random-estado");
  try {
    if (!modulos.azar) {
      [modulos.azar, modulos.randomizar] = await Promise.all([import("./azar.js"), import("./randomizar.js")]);
    }
    let bytes;
    let nombre;
    // Que se vea «Randomizando...» antes de que el navegador se ponga a trabajar
    await new Promise((resolver) => setTimeout(resolver, 30));
    if (rom.es3DS) {
      // Un .3ds no se carga entero: se leen los archivos que hacen falta y el .3ds nuevo se monta con trozos del original
      const { Rom3DS, lectorDeArchivo, Sesion3DS } = await import("./rom-3ds.js");
      const juego3DS = await import("./juego-3ds.js");
      const sesion = new Sesion3DS(await new Rom3DS(lectorDeArchivo(rom.archivo)).abrir());
      await juego3DS.prepararRom(sesion);
      await modulos.randomizar.randomizarROM(sesion, reglasActuales(), semillaPara());
      const nuevo = await sesion.construirRom();
      nombre = rom.archivo.name.replace(/(\.3ds)?$/i, " (random).3ds");
      const piezas = nuevo.partes.map((x) => (x.rango ? rom.archivo.slice(x.rango.desde, x.rango.desde + x.rango.tam) : x));
      bytes = new Blob(piezas, { type: "application/octet-stream" });
    } else if (rom.carpeta) {
      // Switch: de la carpeta «romfs» se leen solo los archivos que hacen falta; sale un .zip con los cambiados (un mod)
      const { SesionSwitch } = await import("./rom-switch.js");
      const motor = await import(rom.juego === "bdsp" ? "./juego-bdsp.js" : "./juego-swsh.js");
      const sesion = new SesionSwitch(rom.rutas, rom.juego, rom.nombre);
      await motor.prepararRom(sesion);
      await modulos.randomizar.randomizarROM(sesion, reglasActuales(), semillaPara());
      bytes = sesion.zip();
      nombre = `${rom.nombre.replace(/\s*\/\s*/g, " y ")} (random).zip`;
    } else {
      bytes = new Uint8Array(await rom.archivo.arrayBuffer());
      await modulos.randomizar.randomizarROM(bytes, reglasActuales(), semillaPara());
      if (jugar) {
        const { crearPartida } = await import("../jugar/partidas.js");
        const extension = rom.esGBA ? "gba" : "nds";
        const archivo = rom.archivo.name.replace(/(\.(gba|nds))?$/i, ` (random).${extension}`);
        const locke = idLocke ? lockePorId(idLocke) : null;
        const id = await crearPartida({
          nombre: locke ? locke.nombre : archivo.replace(/\.(gba|nds)$/i, ""), consola: extension, juego: rom.juego,
          idLocke: locke && locke.juego === rom.juego ? idLocke : "", archivo, bytes, randomizada: true
        });
        sumarContador("randomizar");
        if (idLocke) sumarContador("randomizar-locke");
        sumarContador(`randomizar-${extension}`);
        trabajando = false;
        pintar();
        // La misma clave que CLAVE_ELEGIDO de js/jugar/index.js: «Jugar» la abre y empieza
        escribir("poketeams-jugar-v1", { partida: id });
        const { irA } = await import("../navegacion.js");
        irA("jugar");
        return;
      }
      nombre = rom.esGBA ? rom.archivo.name.replace(/(\.gba)?$/i, " (random).gba") : rom.archivo.name.replace(/(\.nds)?$/i, " (random).nds");
    }
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 60000);
    // Para los logros: cuántas, desde un locke y de qué consola
    sumarContador("randomizar");
    if (idLocke) sumarContador("randomizar-locke");
    sumarContador(`randomizar-${rom.es3DS ? "3ds" : rom.carpeta ? "switch" : rom.esGBA ? "gba" : "nds"}`);
    trabajando = false;
    pintar();
    estado().textContent = t("Lista: {nombre}", { nombre });
  } catch (error) {
    console.error(error);
    trabajando = false;
    pintar();
    estado().textContent = t(error.message || "No se ha podido randomizar.");
    estado().classList.add("con-error");
  }
}

// ---------- Arranque ----------

// El campo de la pestaña que se ve, por su apartado y su clave (también los que cuelgan)
function buscarCampo(apartado, clave) {
  const actual = PESTANAS.find((p) => p.id === pestana) || PESTANAS[0];
  const buscar = (campos) => {
    for (const c of campos) {
      if (c.k === clave) return c;
      const hijo = c.hijos && buscar(c.hijos);
      if (hijo) return hijo;
    }
    return null;
  };
  for (const a of actual.apartados) {
    const c = a.id === apartado && buscar(a.campos);
    if (c) return c;
  }
  return null;
}

function cambiar(apartado, campo, valor) {
  mias[apartado][campo] = valor;
  guardarMias();
  pintar();
}

export function iniciar() {
  vista = document.querySelector("#vista-randomizer");
  mias = misReglas() || completarReglas();

  vista.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton || boton.disabled) return;
    if (boton.classList.contains("random-info")) avisar(boton.dataset.info);
    else if (boton.dataset.pestana) {
      pestana = boton.dataset.pestana;
      pintar();
    } else if (boton.dataset.campo) cambiar(boton.dataset.apartado, boton.dataset.campo, JSON.parse(boton.dataset.valor));
    else if (boton.classList.contains("random-elegir")) vista.querySelector(".random-archivo").click();
    else if (boton.classList.contains("random-elegir-carpeta")) elegirCarpetaConAviso();
    else if (boton.classList.contains("random-ayuda")) document.querySelector("#dialogo-ayuda-rom").showModal();
    else if (boton.classList.contains("random-ir")) randomizar();
    else if (boton.classList.contains("random-jugar")) randomizar(true);
    else if (boton.dataset.normas) accionNormas(boton.dataset.normas);
    else if (boton.classList.contains("random-vaciar")) vaciarNormas();
  });

  vista.addEventListener("change", (e) => {
    if (e.target.matches(".random-archivo") && e.target.files[0]) elegirRom(e.target.files[0]);
    else if (e.target.matches(".random-carpeta") && e.target.files.length) elegirCarpeta([...e.target.files]);
    else if (e.target.matches(".random-normas-elegir")) elegirNormas(e.target.value);
    else if (e.target.matches("select[data-indice]")) {
      const { apartado, campo, indice } = e.target.dataset;
      const lista = mias[apartado][campo].slice();
      lista[Number(indice)] = Number(e.target.value);
      cambiar(apartado, campo, lista);
    } else if (e.target.matches("select[data-campo], input[type=range][data-campo]")) {
      cambiar(e.target.dataset.apartado, e.target.dataset.campo, JSON.parse(e.target.value));
    }
  });

  // Mientras se arrastra una barra, su valor al lado (se guarda al soltar)
  vista.addEventListener("input", (e) => {
    if (!e.target.matches("input[type=range][data-campo]")) return;
    const campo = buscarCampo(e.target.dataset.apartado, e.target.dataset.campo);
    const salida = e.target.parentElement.querySelector("output");
    if (campo && salida) salida.textContent = campo.formato(Number(e.target.value));
  });

  const ayuda = document.querySelector("#dialogo-ayuda-rom");
  ayuda.querySelector(".ayuda-rom-cerrar").addEventListener("click", () => ayuda.close());

  // Los nombres de los Pokémon, para elegir las iniciales a mano
  cargarDatos().then(() => vista.isConnected && pintar()).catch(() => {});
}

export function mostrar() {
  pintar();
}

// Desde el botón «Randomizar mi ROM» de un locke: sus normas
export function usarLocke(id) {
  idLocke = id;
  guardada = null;
  revisarRom();
}

