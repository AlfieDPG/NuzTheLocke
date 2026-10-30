// ---------- Iconos ----------
//
// SVG metido directamente en la página, con el mismo trazo que los iconos de Lucide
// (licencia ISC). No se usa ninguna librería externa: son cuatro líneas de dibujo y así
// no hay que descargar una fuente de iconos entera ni depender de otra web.
//
// Heredan el color del botón (currentColor) y se escalan con el tamaño de letra.

const DIBUJOS = {
  copiar: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
           <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  papelera: `<path d="M3 6h18"/>
             <path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"/>
             <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/>
             <path d="M10 11v6"/>
             <path d="M14 11v6"/>`,
  guardar: `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
            <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
            <path d="M7 3v4a1 1 0 0 0 1 1h7"/>`,
  visto: `<path d="M20 6 9 17l-5-5"/>`,
  aspa: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  lapiz: `<path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>
          <path d="m15 5 4 4"/>`,
  etiqueta: `<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/>
             <path d="M7.5 7.5h.01"/>`,
  mas: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  menos: `<path d="M5 12h14"/>`,
  corona: `<path d="M11.6 3.3a.5.5 0 0 1 .9 0l3 5.6a1 1 0 0 0 1.5.3l4.2-3.7a.5.5 0 0 1 .8.5l-2.8 10.3a1 1 0 0 1-1 .7H5.8a1 1 0 0 1-1-.7L2 6a.5.5 0 0 1 .8-.5L7 9.2a1 1 0 0 0 1.5-.3z"/>
           <path d="M5 21h14"/>`,
  // Ventana «Partida»: las cajas, la bolsa y sus bolsillos
  caja: `<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5"/><path d="M12 12v9"/>`,
  mochila: `<path d="M6 9a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9.5 3.5h5"/><path d="M8.5 14h7v3.5h-7z"/>`,
  objeto: `<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="m8 9 4 12 4-12-4-6z"/>`,
  pocion: `<path d="M9 3h6"/><path d="M10 3v5.5L5.6 16.8A3 3 0 0 0 8.2 21h7.6a3 3 0 0 0 2.6-4.2L14 8.5V3"/><path d="M7.2 14h9.6"/>`,
  disco: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3a9 9 0 0 1 9 9"/>`,
  baya: `<circle cx="12" cy="14.5" r="6.5"/><path d="M12 8c0-2.2 1.2-4.2 3.5-5"/><path d="M12 8C10.5 6.3 8.3 6 6.5 7"/>`,
  llave: `<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8"/><path d="m16 7 3 3"/><path d="m13.5 9.5 2 2"/>`,
  // Caramelo envuelto (Caramelo Raro)
  caramelo: `<circle cx="12" cy="12" r="4.5"/>
             <path d="M8.8 8.8 5 5l-1 4 1.6 1.4"/><path d="M15.2 15.2 19 19l1-4-1.6-1.4"/>`,
  // Huevo Pokémon: el óvalo (más estrecho arriba) con sus manchas
  huevo: `<path d="M12 2C7.8 2 5 9 5 14.5a7 7 0 0 0 14 0C19 9 16.2 2 12 2z"/>
          <circle cx="9.5" cy="10" r="1.6" fill="currentColor" stroke="none"/>
          <circle cx="14.8" cy="14" r="2" fill="currentColor" stroke="none"/>
          <circle cx="9.8" cy="17.6" r="1.2" fill="currentColor" stroke="none"/>`,
  corazon: `<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>`,
  personaMas: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
               <circle cx="9" cy="7" r="4"/>
               <path d="M19 8v6"/><path d="M22 11h-6"/>`,
  campana: `<path d="M10.3 21a2 2 0 0 0 3.4 0"/>
            <path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/>`,
  mapa: `<path d="M14.1 4.6a2 2 0 0 0 1.8 0l3.7-1.9A1 1 0 0 1 21 3.6v12.8a1 1 0 0 1-.6.9l-4.5 2.2a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.7 1.9A1 1 0 0 1 3 20.4V7.6a1 1 0 0 1 .6-.9l4.5-2.2a2 2 0 0 1 1.8 0z"/>
         <path d="M15 5.8v15"/><path d="M9 3.2v15"/>`,
  escudo: `<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>`,
  consola: `<rect width="20" height="12" x="2" y="6" rx="3"/><rect width="8" height="6" x="8" y="9" rx="1"/>
            <path d="M5 11v2"/><path d="M4 12h2"/><path d="M19 11h.01"/><path d="M18 13h.01"/>`,
  mando: `<path d="M6 11h4"/><path d="M8 9v4"/><path d="M15 12h.01"/><path d="M18 10h.01"/>
          <path d="M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3A4 4 0 0 0 17.3 5z"/>`,
  calendario: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
  espadas: `<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>
            <path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>
            <path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/>`,
  pokeball: `<circle cx="12" cy="12" r="10"/><path d="M2 12h7"/><path d="M15 12h7"/><circle cx="12" cy="12" r="3"/>`,
  pokedex: `<rect width="16" height="20" x="4" y="2" rx="2"/><circle cx="9" cy="7" r="2"/><path d="M8 13h8"/><path d="M8 17h5"/>`,
  amigos: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
           <path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>`,
  cuadricula: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>`,
  puntos: `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>`,
  lista: `<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>`,
  importar: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>`,
  subir: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>`,
  arriba: `<path d="m18 15-6-6-6 6"/>`,
  abajo: `<path d="m6 9 6 6 6-6"/>`,
  imagen: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>
           <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>`,
  trofeo: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/>
           <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
           <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
           <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  ruleta: `<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/>
           <path d="m4.9 4.9 14.2 14.2"/><path d="m19.1 4.9-14.2 14.2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>`,
  estadisticas: `<path d="M5 21V12"/><path d="M12 21V4"/><path d="M19 21v-6"/>`,
  estrella: `<path d="M11.5 2.3a.5.5 0 0 1 .9 0l2.3 4.8a2 2 0 0 0 1.5 1.1l5.2.8a.5.5 0 0 1 .3.9l-3.8 3.7a2 2 0 0 0-.6 1.8l.9 5.2a.5.5 0 0 1-.7.5l-4.7-2.5a2 2 0 0 0-1.9 0l-4.7 2.5a.5.5 0 0 1-.7-.5l.9-5.2a2 2 0 0 0-.6-1.8L2.7 9.9a.5.5 0 0 1 .3-.9l5.2-.8a2 2 0 0 0 1.5-1.1z"/>`,
  candado: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  mezclar: `<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.46-8.6a4 4 0 0 1 3.3-1.7H22"/>
            <path d="M2 6h1.97a4 4 0 0 1 3.3 1.7l.53.8"/><path d="M22 18h-6.04a4 4 0 0 1-3.3-1.8l-.36-.45"/>`,
  persona: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  calavera: `<path d="m12.5 17-.5-1-.5 1h1z"/>
             <path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/>
             <circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>`,
  actividad: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>`,
  calculadora: `<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/><path d="M16 14v4"/>
                <path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/>
                <path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>`,
  intercambiar: `<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>`,
  rayo: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
  libro: `<path d="M12 7v14"/>
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,
  deshacer: `<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>`,
  macho: `<circle cx="10" cy="14" r="6"/><path d="M15 9l6-6"/><path d="M15.5 3H21v5.5"/>`,
  hembra: `<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M8.5 18.5h7"/>`,
  carpeta: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
  enlace: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
           <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  reanudar: `<polygon points="6 3 20 12 6 21 6 3"/>`,
  pausa: `<rect width="4" height="16" x="14" y="4" rx="1"/><rect width="4" height="16" x="6" y="4" rx="1"/>`,
  acelerar: `<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>`,
  sonido: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`,
  silencio: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>`,
  directo: `<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/>
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>`,
  ampliar: `<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`,
  carpetaMas: `<path d="M12 10v6"/><path d="M9 13h6"/>
               <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
  sobre: `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
  enviar: `<path d="M14.5 21.7a.5.5 0 0 0 .9 0L21.9 2.7a.5.5 0 0 0-.6-.6L2.3 8.6a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z"/>
           <path d="m21.9 2.1-10.9 10.9"/>`,
  aviso: `<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  ayuda: `<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  ajustes: `<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/>
           <circle cx="12" cy="12" r="3"/>`,
  sol: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/>
        <path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>`,
  luna: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>`,
  atardecer: `<path d="M17 17a5 5 0 0 0-10 0"/><path d="M12 7v2"/><path d="m5.6 10.6 1.4 1.4"/><path d="m18.4 10.6-1.4 1.4"/>
              <path d="M2 17h3"/><path d="M19 17h3"/><path d="M6 21h12"/>`,
  // Foro
  mensaje: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  bandera: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>`,
  chincheta: `<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.7l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>`,
  refrescar: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`,
  salir: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`,
  lupa: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`
};

// Los que son una imagen (blanca sobre transparente): se usa de máscara y se pinta con el color
// del botón, como los demás
const IMAGENES = {
  mega: new URL("../../img/iconos/mega.png", import.meta.url).href // el símbolo de la megaevolución
};

export function icono(nombre) {
  if (IMAGENES[nombre]) {
    return `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <mask id="mascara-${nombre}"><image href="${IMAGENES[nombre]}" width="24" height="24"/></mask>
      <rect width="24" height="24" fill="currentColor" mask="url(#mascara-${nombre})"/></svg>`;
  }
  return `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${DIBUJOS[nombre] || ""}</svg>`;
}
