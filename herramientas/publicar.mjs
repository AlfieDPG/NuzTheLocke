// Prepara la web para publicarla: copia todo a publicar/ con el JS y el CSS minificados (sin
// comentarios ni espacios; el navegador baja menos y lo lee antes). Lo ejecuta Cloudflare Pages en
// cada push («npm run build»); a mano no hace falta. Se sigue editando el código de siempre: esto
// solo cambia lo que se sirve.
//
// Además, en index.html y seguir.html se avisa de todos los módulos del arranque
// (<link rel="modulepreload">): así se piden todos a la vez en vez de uno tras otro según se van
// encontrando los import.
//
// Para probarlo en el ordenador: npm install y luego npm run build (sale en publicar/).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "publicar");

// Lo que no se publica: herramientas, notas y configuración
const FUERA = new Set([
  ".git", ".github", ".vscode", "node_modules", "publicar", "herramientas",
  "package.json", "package-lock.json", ".gitignore", "README.md", "LEEME-nube.md", "firestore.rules"
]);

// Ya vienen minificados (y con su licencia arriba, que hay que conservar)
const TAL_CUAL = new Set(["js/lucha/motor.js"]);

// Los módulos con los que arranca cada página (además de su <script type="module">). En index.html,
// Inicio: es la sección con la que se entra casi siempre.
const ARRANQUE = {
  "index.html": ["js/main.js", "js/inicio/index.js"],
  "seguir.html": ["js/seguir.js"]
};

let antes = 0;
let despues = 0;

function recorrer(carpeta) {
  for (const nombre of readdirSync(join(RAIZ, carpeta))) {
    const ruta = carpeta ? `${carpeta}/${nombre}` : nombre;
    if (!carpeta && FUERA.has(nombre)) continue;
    if (statSync(join(RAIZ, ruta)).isDirectory()) {
      recorrer(ruta);
      continue;
    }
    const destino = join(SALIDA, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    const tipo = /\.(m?js|css)$/.exec(nombre)?.[1];
    if (!tipo || TAL_CUAL.has(ruta)) {
      cpSync(join(RAIZ, ruta), destino);
      continue;
    }
    const codigo = readFileSync(join(RAIZ, ruta), "utf8");
    let minificado;
    try {
      // Archivo por archivo, sin juntar nada: las rutas (import, import.meta.url, url() del CSS)
      // siguen valiendo igual
      minificado = transformSync(codigo, {
        loader: tipo === "css" ? "css" : "js",
        minify: true,
        legalComments: "none",
        charset: "utf8"
      }).code;
    } catch (error) {
      throw new Error(`No se ha podido minificar ${ruta}: ${error.message}`);
    }
    antes += codigo.length;
    despues += minificado.length;
    writeFileSync(destino, minificado);
  }
}

// Todos los módulos que importan (sin import(), que se bajan solo al hacer falta) los de entrada
function modulosDeArranque(entradas) {
  const vistos = new Set();
  const pendientes = [...entradas];
  const importes = /(?:^|[;\s])(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["']([^"']+)["']/g;
  while (pendientes.length) {
    const archivo = pendientes.pop();
    if (vistos.has(archivo) || !existsSync(join(RAIZ, archivo))) continue;
    vistos.add(archivo);
    for (const [, destino] of readFileSync(join(RAIZ, archivo), "utf8").matchAll(importes)) {
      if (!destino.startsWith(".")) continue;
      pendientes.push(posix.normalize(posix.join(posix.dirname(archivo), destino)));
    }
  }
  return [...vistos];
}

function avisarModulos() {
  for (const [pagina, entradas] of Object.entries(ARRANQUE)) {
    const ruta = join(SALIDA, pagina);
    const html = readFileSync(ruta, "utf8");
    const scripts = new Set([...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]));
    const enlaces = modulosDeArranque(entradas)
      .filter((archivo) => !scripts.has(archivo))
      .map((archivo) => `<link rel="modulepreload" href="${archivo}">`)
      .join("");
    const primerScript = html.indexOf('<script type="module"');
    if (primerScript < 0) throw new Error(`${pagina}: no tiene <script type="module">`);
    writeFileSync(ruta, html.slice(0, primerScript) + enlaces + "\n  " + html.slice(primerScript));
  }
}

rmSync(SALIDA, { recursive: true, force: true });
recorrer("");
avisarModulos();
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`publicar/: JS y CSS de ${kb(antes)} a ${kb(despues)} (${relative(RAIZ, SALIDA)})`);
