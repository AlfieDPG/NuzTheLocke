// Sección «Equipos»: vistas «crear» (Crear equipo) y «equipos» (Mis equipos)

import { cargarDatos } from "../comun/datos.js";
import { t } from "../comun/idioma.js";
import { cargarEstado } from "./estado.js";
import { iniciarCrear, renderCrear, mostrarMensaje } from "./crear.js";
import { renderMisEquipos } from "./mis-equipos.js";
import { iniciarImportar } from "./importar.js";
import { icono } from "../comun/iconos.js";
import { irA } from "../navegacion.js";

export async function iniciar() {
  mostrarMensaje(t("Cargando datos de Pokémon (solo tarda la primera vez)..."));

  try {
    await cargarDatos();
  } catch (error) {
    mostrarMensaje(t("No he podido cargar los datos. Revisa tu conexión y recarga la página."));
    throw error;
  }

  cargarEstado();
  iniciarCrear();
  iniciarImportar();

  // «Crear equipo»: el primero de la barra de «Mis equipos» (en el menú solo está «Equipos»)
  const crear = document.getElementById("crear-equipo-nuevo");
  crear.insertAdjacentHTML("afterbegin", `${icono("mas")} `);
  crear.addEventListener("click", () => irA("crear"));
}

export function mostrar(vista) {
  if (vista === "crear") {
    renderCrear();
  } else {
    renderMisEquipos();
  }
}
