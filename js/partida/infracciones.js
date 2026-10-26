// ---------- Texto de los avisos del árbitro ----------
//
// Aparte de ./arbitro.js (que es grande) porque lo usan también la campana de notificaciones,
// que carga al entrar en la web. Un aviso es un suceso «infraccion» de la actividad de un locke
// con el «detalle» «regla|dato|dato...»:
//   nivel: Pokémon|nivel|level cap · captura: Pokémon|zona · motes: Pokémon · repetidos: Pokémon|el primero de su línea

import { nombreDeLugar } from "../rutas/datos.js";
import { t } from "../comun/idioma.js";

// Lo que ha pasado, en una frase. «formato» se aplica a cada dato (en la actividad y la campana
// escapa el texto y lo pone en negrita).
export function textoInfraccion(detalle, formato = (dato) => dato) {
  const [regla, uno, dos, tres] = String(detalle || "").split("|");
  const pokemon = formato(uno || "");
  switch (regla) {
    case "nivel":
      return t("{pokemon} (nv. {nivel}) está por encima del level cap ({cap})", { pokemon, nivel: formato(dos), cap: formato(tres) });
    case "captura":
      return t("{pokemon} es una segunda captura en {lugar}", { pokemon, lugar: formato(nombreDeLugar(dos || "")) });
    case "motes":
      return t("{pokemon} no tiene mote", { pokemon });
    case "repetidos":
      return t("{pokemon} está en el equipo y es repetido de {primero}, que sigue vivo", { pokemon, primero: formato(dos) });
    default:
      return "";
  }
}
