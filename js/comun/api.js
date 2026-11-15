import { esUrlPropia, pokeapiPropio } from "./propios.js";

export const URL_API = "https://pokeapi.co/api/v2/";

// Se guarda cada petición (también las que están en curso) para no pedir
// dos veces lo mismo mientras la página esté abierta.
const cache = new Map();

export function pedirJSON(url) {
  if (!cache.has(url)) {
    // Lo propio de Pokémon Añil (Royaleon, sus ataques...) no está en PokeAPI: se responde desde
    // nuestros datos (./propios.js)
    const promesa = esUrlPropia(url) ? pokeapiPropio(url) : fetch(url).then((respuesta) => {
      if (!respuesta.ok) throw new Error("Error " + respuesta.status);
      return respuesta.json();
    });
    promesa.catch(() => cache.delete(url)); // si falla, se podrá volver a intentar
    cache.set(url, promesa);
  }
  return cache.get(url);
}
