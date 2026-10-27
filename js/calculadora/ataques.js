// Potencia, tipo y categoría de los ataques que hacen daño, para la calculadora.
//
// Sale de moves.csv de PokeAPI: id,identifier,generation_id,type_id,power,pp,accuracy,priority,
// target_id,damage_class_id,... (categoría: 1 estado, 2 físico, 3 especial). Solo entran los
// que tienen potencia fija: los de potencia variable (Patada Baja, Giro Bola...) o de daño
// fijo (Movimiento Sísmico...) no se pueden calcular con la fórmula normal.
//
// Como la Pokédex, la web lo lleva ya montado en datos/ataques.json (lo rehace
// herramientas/generar-datos.html) y la primera vez se lo guarda en el navegador.

import { descargarCSV } from "../comun/datos.js";
import { leer, escribir } from "../comun/almacen.js";

// NO cambiar sin motivo; sí subirla al rehacer datos/ataques.json
const CLAVE = "poketeams-ataques-calc-v4";

export const TIPOS_POR_ID = {
  1: "normal", 2: "fighting", 3: "flying", 4: "poison", 5: "ground", 6: "rock",
  7: "bug", 8: "ghost", 9: "steel", 10: "fire", 11: "water", 12: "grass",
  13: "electric", 14: "psychic", 15: "ice", 16: "dragon", 17: "dark", 18: "fairy"
};

const CLASES = { 2: "fisico", 3: "especial" };

// Lo que miran algunas habilidades (Garra Dura, Puño Férreo...): move_flag_map.csv, con los
// números de move_flags.csv
const BANDERAS = { 1: "contacto", 8: "punetazo", 9: "sonido", 16: "mordisco", 17: "pulso" };

// [{ id, tipo, potencia, clase: "fisico" | "especial", prioridad?, precision? (solo si es
//    menos de 100; la usa el análisis de equipos), contacto?, punetazo?, sonido?, mordisco?,
//    pulso?, secundario? (con efecto extra, para Potencia Bruta) }]
// (los opcionales solo si no son 0 / false)
export async function montarAtaquesDePokeAPI() {
  const [csv, csvBanderas] = await Promise.all([descargarCSV("moves.csv"), descargarCSV("move_flag_map.csv")]);
  const banderas = new Map();
  for (const linea of csvBanderas.split("\n").slice(1)) {
    const [idAtaque, idBandera] = linea.trim().split(",").map(Number);
    if (!BANDERAS[idBandera]) continue;
    if (!banderas.has(idAtaque)) banderas.set(idAtaque, {});
    banderas.get(idAtaque)[BANDERAS[idBandera]] = true;
  }

  const ataques = [];
  for (const linea of csv.split("\n").slice(1)) {
    const partes = linea.trim().split(",");
    const id = Number(partes[0]);
    const tipo = TIPOS_POR_ID[Number(partes[3])];
    const potencia = Number(partes[4]);
    const precision = Number(partes[6]) || 0; // vacía: no falla nunca
    const prioridad = Number(partes[7]) || 0;
    const clase = CLASES[Number(partes[9])];
    const secundario = Boolean(partes[11]);
    // Los de id 10000 en adelante son los Z y Dinamax de cada tipo: fuera
    if (!id || id >= 10000 || !tipo || !potencia || !clase) continue;
    ataques.push({
      id, tipo, potencia, clase,
      ...(prioridad ? { prioridad } : {}),
      ...(precision && precision < 100 ? { precision } : {}),
      ...(banderas.get(id) || {}),
      ...(secundario ? { secundario } : {})
    });
  }
  return ataques;
}

const URL_ATAQUES = new URL("../../datos/ataques.json", import.meta.url);
let promesa = null;

// Map id -> { id, tipo, potencia, clase }
export function cargarAtaques() {
  if (!promesa) {
    promesa = (async () => {
      try {
        localStorage.removeItem("poketeams-ataques-calc-v1"); // versión antigua (sin la prioridad)
        localStorage.removeItem("poketeams-ataques-calc-v2"); // versión antigua (sin contacto, puñetazo...)
      } catch (error) {
        // no pasa nada
      }
      let lista = leer(CLAVE, null);
      if (!lista) {
        try {
          const respuesta = await fetch(URL_ATAQUES);
          if (respuesta.ok) lista = await respuesta.json();
        } catch (error) {
          // sin el archivo, se monta desde PokeAPI
        }
        if (!lista) lista = await montarAtaquesDePokeAPI();
        escribir(CLAVE, lista);
      }
      return new Map(lista.map((ataque) => [ataque.id, ataque]));
    })();
    promesa.catch(() => (promesa = null));
  }
  return promesa;
}
