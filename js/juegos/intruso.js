// «El intruso»: salen cuatro Pokémon y tres tienen algo en común; hay que elegir el que no. Al
// responder se dice qué tenían los otros tres. RONDAS rondas al día, las mismas para todo el mundo.
//
// Lo que pueden compartir (RASGOS, cada grupo con su peso al sortear): un tipo, una debilidad o
// una inmunidad (por sus tipos), el color de la Pokédex, la generación, un grupo huevo, el sexo
// (sin sexo, solo hembras, solo machos), cómo evolucionan, su estadística más alta, ser iniciales,
// legendarios o pseudolegendarios, tener megaevolución o forma regional, el peso y la altura.
//
// Para que no haya dos respuestas buenas, cada ronda se arma hasta que solo uno de los cuatro se
// queda fuera de un trío por cualquiera de esas cosas (o por otras que saltan a la vista y no se
// preguntan: tener uno o dos tipos, la etapa, la inicial del nombre, los grupos huevo de agua...).
// Los cuatro son de familias distintas.
//
// Lo que no está en datos/pokedex.json sale de datos/rasgos.json (herramientas/generar-rasgos.mjs).
//
// Pokédólares: 10 por acierto (50 si aciertas todos), más lo de la racha.

import { icono } from "../comun/iconos.js";
import { tiposEs } from "../comun/tipos.js";
import { TIPOS, multiplicador } from "../comun/efectividad.js";
import { t } from "../comun/idioma.js";
import { crearTest, mezclar } from "./test.js";
import { familias } from "./comun.js";

const RONDAS = 5;
const INTENTOS = 500; // por ronda, para dar con cuatro sin dos intrusos posibles
const URL_RASGOS = new URL("../../datos/rasgos.json", import.meta.url);

const GENERACIONES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const COLORES = {
  black: t("negro"), blue: t("azul"), brown: t("marrón"), gray: t("gris"), green: t("verde"),
  pink: t("rosa"), purple: t("morado"), red: t("rojo"), white: t("blanco"), yellow: t("amarillo")
};
// Los grupos huevo que se preguntan (los de agua y Ditto solo se comprueban: se confunden)
const HUEVOS = {
  1: t("Monstruo"), 3: t("Bicho"), 4: t("Volador"), 5: t("Campo"), 6: t("Hada"), 7: t("Planta"),
  8: t("Humanoide"), 10: t("Mineral"), 11: t("Amorfo"), 14: t("Dragón")
};
const TODOS_LOS_HUEVOS = [...Object.keys(HUEVOS).map(Number), 2, 9, 12, 13, 15];
const ESTADISTICAS = [t("PS"), t("Ataque"), t("Defensa"), t("Ataque Especial"), t("Defensa Especial"), t("Velocidad")];
// La primera de cada línea de iniciales (sus evoluciones también cuentan)
const INICIALES = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656,
  722, 725, 728, 810, 813, 816, 906, 909, 912];

let rasgos = {}; // datos/rasgos.json, cuando ha llegado
let cargando = null;

const esLegendario = (especie) => especie.clase === "legendario" || especie.clase === "singular";

// La estadística más alta, si solo hay una (-1 si empatan)
function masAlta(especie) {
  const maximo = Math.max(...especie.bases);
  return especie.bases.filter((valor) => valor === maximo).length === 1 ? especie.bases.indexOf(maximo) : -1;
}

// [{ peso, rasgos: [{ tiene(especie), porque }] }] lo que se puede preguntar, por grupos; y
// aparte, lo que solo se comprueba
function armarRasgos(raiz, padres) {
  const grupo = (peso, rasgos) => ({ peso, rasgos });
  const inmunes = TIPOS.filter((ataque) => TIPOS.some((tipo) => multiplicador(ataque, [tipo]) === 0));
  const iniciales = new Set(INICIALES);
  const preguntas = [
    grupo(3, TIPOS.map((tipo) => ({
      tiene: (e) => e.tipos.includes(tipo),
      porque: t("Los otros tres son de tipo {tipo}.", { tipo: tiposEs[tipo] })
    }))),
    grupo(3, TIPOS.map((tipo) => ({
      tiene: (e) => multiplicador(tipo, e.tipos) >= 2,
      porque: t("A los otros tres les es supereficaz el tipo {tipo}.", { tipo: tiposEs[tipo] })
    }))),
    grupo(1, inmunes.map((tipo) => ({
      tiene: (e) => multiplicador(tipo, e.tipos) === 0,
      porque: t("Por sus tipos, los otros tres son inmunes al tipo {tipo}.", { tipo: tiposEs[tipo] })
    }))),
    grupo(3, Object.entries(COLORES).map(([color, nombre]) => ({
      tiene: (e) => e.color === color,
      porque: t("En la Pokédex, los otros tres son de color {color}.", { color: nombre })
    }))),
    grupo(2, GENERACIONES.map((gen) => ({
      tiene: (e) => e.gen === gen,
      porque: t("Los otros tres son de la generación {n}.", { n: gen })
    }))),
    grupo(2, [
      ...Object.entries(HUEVOS).map(([id, nombre]) => ({
        tiene: (e) => e.huevos.includes(Number(id)),
        porque: t("Los otros tres son del grupo huevo {grupo}.", { grupo: nombre })
      })),
      { tiene: (e) => e.huevos.includes(15), porque: t("Los otros tres no pueden criar (grupo huevo Desconocido).") }
    ]),
    grupo(1.5, [
      { tiene: (e) => e.sexo === -1, porque: t("Los otros tres no tienen sexo.") },
      { tiene: (e) => e.sexo === 8, porque: t("De los otros tres solo hay hembras.") },
      { tiene: (e) => e.sexo === 0, porque: t("De los otros tres solo hay machos.") }
    ]),
    grupo(1.5, [
      { tiene: (e) => e.etapa === 1 && !padres.has(e.id), porque: t("Los otros tres no evolucionan ni vienen de otro.") },
      { tiene: (e) => e.etapa === 3, porque: t("Los otros tres son la tercera etapa de su familia.") },
      { tiene: (e) => e.clase === "bebe", porque: t("Los otros tres son Pokémon bebé.") }
    ]),
    grupo(1.5, ESTADISTICAS.map((nombre, i) => ({
      tiene: (e) => masAlta(e) === i,
      porque: t("La estadística más alta de los otros tres es {estadistica}.", { estadistica: nombre })
    }))),
    grupo(1, [{ tiene: (e) => iniciales.has(raiz(e.id)), porque: t("Los otros tres son de una línea de iniciales.") }]),
    grupo(1, [{ tiene: esLegendario, porque: t("Los otros tres son legendarios o singulares.") }]),
    grupo(0.5, [{
      tiene: (e) => e.etapa === 3 && e.total === 600 && !esLegendario(e),
      porque: t("Los otros tres son pseudolegendarios.")
    }]),
    grupo(1, [{ tiene: (e) => e.mega, porque: t("Los otros tres tienen megaevolución.") }]),
    grupo(1, [{ tiene: (e) => e.regional, porque: t("Los otros tres tienen forma regional (Alola, Galar, Hisui o Paldea).") }]),
    grupo(0.7, [{ tiene: (e) => e.peso >= 1000, porque: t("Los otros tres pesan 100 kg o más.") }]),
    grupo(0.7, [{ tiene: (e) => e.altura >= 20, porque: t("Los otros tres miden 2 m o más.") }])
  ];

  // La inicial, en los dos idiomas: las rondas tienen que ser las mismas para todo el mundo
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const empieza = (e, letra) => [e.es, e.en].some((nombre) => (nombre || "").toUpperCase().startsWith(letra));
  const comprobar = [
    ...preguntas.flatMap((cada) => cada.rasgos.map((rasgo) => rasgo.tiene)),
    (e) => e.tipos.length === 1,
    (e) => e.tipos.length === 2,
    ...[1, 2, 3].map((etapa) => (e) => e.etapa === etapa),
    ...TODOS_LOS_HUEVOS.map((id) => (e) => e.huevos.includes(id)),
    ...letras.map((letra) => (e) => empieza(e, letra))
  ];
  return { preguntas, comprobar };
}

// Los que se quedan fuera de algún trío
function intrusosDe(cuatro, comprobar) {
  const fuera = new Set();
  for (const tiene of comprobar) {
    const con = cuatro.filter(tiene);
    if (con.length === 3) fuera.add(cuatro.find((especie) => !tiene(especie)).id);
  }
  return fuera;
}

// Las rondas del día: [{ buena, opciones, porque }]
function armarRondas(especies, azar) {
  const deQuien = familias();
  const raiz = (id) => {
    let actual = id;
    while (deQuien[actual]) actual = deQuien[actual];
    return Number(actual);
  };
  const padres = new Set(Object.values(deQuien).map(Number));
  // Cada especie con lo de datos/rasgos.json: [color, sexo, huevos, altura, peso, mega, regional]
  const lista = especies.filter((especie) => rasgos[especie.id]).map((especie) => {
    const [color, sexo, huevos, altura, peso, mega, regional] = rasgos[especie.id];
    return { ...especie, color, sexo, huevos, altura, peso, mega: Boolean(mega), regional: Boolean(regional) };
  });
  const { preguntas, comprobar } = armarRasgos(raiz, padres);
  const pesoTotal = preguntas.reduce((suma, cada) => suma + cada.peso, 0);
  const elegir = (cosas) => cosas[Math.floor(azar() * cosas.length)];
  const usadas = new Set(); // para no repetir Pokémon en el día

  function rasgoAlAzar() {
    let tirada = azar() * pesoTotal;
    const grupo = preguntas.find((cada) => (tirada -= cada.peso) < 0) || preguntas[preguntas.length - 1];
    return elegir(grupo.rasgos);
  }

  function ronda() {
    for (let intento = 0; intento < INTENTOS; intento++) {
      const { tiene, porque } = rasgoAlAzar();
      const libres = lista.filter((especie) => !usadas.has(especie.id));
      const con = libres.filter(tiene);
      if (con.length < 3) continue;
      const trio = mezclar(con, azar).slice(0, 3);
      const fuera = elegir(libres.filter((especie) => !tiene(especie)));
      const cuatro = [...trio, fuera];
      if (new Set(cuatro.map((especie) => raiz(especie.id))).size < 4) continue;
      const intrusos = intrusosDe(cuatro, comprobar);
      if (intrusos.size !== 1 || !intrusos.has(fuera.id)) continue;
      for (const especie of cuatro) usadas.add(especie.id);
      return { buena: fuera, opciones: mezclar(cuatro, azar), porque };
    }
    return null;
  }

  return Array.from({ length: RONDAS }, ronda).filter(Boolean);
}

export const montarIntruso = crearTest({
  juego: "intruso",
  titulo: t("El intruso"),
  explicacion: t("Tres de los cuatro tienen algo en común: un tipo, una debilidad, el color, la generación, el grupo huevo... Elige el que no."),
  porAcierto: 10,
  pausa: 2600,
  async cargar() {
    cargando ??= fetch(URL_RASGOS).then((respuesta) => respuesta.json()).then((datos) => (rasgos = datos));
    cargando.catch(() => (cargando = null)); // si falla, se reintenta
    await cargando;
  },
  armar: armarRondas,
  pregunta: () => `
    <div class="intruso-pregunta">
      ${icono("cuadricula")}
      <strong>${t("¿Cuál es el intruso?")}</strong>
    </div>`,
  explicar: (ronda) => ronda.porque
});
