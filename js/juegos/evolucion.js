// «¿En qué evoluciona?»: sale un Pokémon que evoluciona y hay que elegir su evolución entre
// cuatro. Las otras tres comparten algún tipo con la buena (para que no sea tan fácil) y no son
// de su familia. Si evoluciona en varios (Eevee, Gloom...), solo uno de ellos sale entre las
// opciones. RONDAS rondas al día, las mismas para todo el mundo.
//
// Las evoluciones salen de datos/familias.json ({ especie: de la que viene }).
//
// Pokédólares: 8 por acierto (48 si aciertas todos), más lo de la racha.

import { escaparHTML } from "../comun/utilidades.js";
import { imagenConRespaldo, urlsRetrato } from "../comun/imagenes.js";
import { t, nombre as nombreDe } from "../comun/idioma.js";
import { crearTest, mezclar } from "./test.js";
import { familias } from "./comun.js";

const RONDAS = 6;

export const montarEvolucion = crearTest({
  juego: "evolucion",
  titulo: t("¿En qué evoluciona?"),
  explicacion: t("Elige en qué evoluciona cada Pokémon."),
  porAcierto: 8,
  armar(especies, azar) {
    const porId = new Map(especies.map((especie) => [especie.id, especie]));
    const deQuien = familias();
    // padre -> sus evoluciones
    const hijos = new Map();
    for (const [hijo, padre] of Object.entries(deQuien)) {
      if (!porId.has(Number(hijo)) || !porId.has(Number(padre))) continue;
      if (!hijos.has(Number(padre))) hijos.set(Number(padre), []);
      hijos.get(Number(padre)).push(porId.get(Number(hijo)));
    }
    // La primera especie de su familia, para no poner de distractor a un pariente
    const raiz = (id) => {
      let actual = id;
      while (deQuien[actual]) actual = deQuien[actual];
      return Number(actual);
    };

    const padres = mezclar([...hijos.keys()], azar).slice(0, RONDAS).map((id) => porId.get(id));
    return padres.map((padre) => {
      const opcionesHijos = hijos.get(padre.id);
      const buena = opcionesHijos[Math.floor(azar() * opcionesHijos.length)];
      const familia = raiz(padre.id);
      const parecidos = especies.filter((especie) =>
        raiz(especie.id) !== familia && especie.tipos.some((tipo) => buena.tipos.includes(tipo)));
      const otros = mezclar(parecidos.length >= 3 ? parecidos : especies.filter((especie) => raiz(especie.id) !== familia), azar).slice(0, 3);
      return { padre, buena, opciones: mezclar([buena, ...otros], azar) };
    });
  },
  pregunta: (ronda) => `
    <div class="evolucion-padre">
      ${imagenConRespaldo(urlsRetrato({ id: ronda.padre.id }), `alt="" data-quitar-si-falla`)}
      <strong>${escaparHTML(nombreDe(ronda.padre))}</strong>
      <span>${t("evoluciona en...")}</span>
    </div>`
});
