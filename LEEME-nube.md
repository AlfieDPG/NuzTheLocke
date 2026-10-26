# Guardar los datos en la nube

Mientras no hagas esto, la web funciona exactamente igual que antes: todo se guarda en el
navegador y el cajón de sesión del panel lateral ni siquiera aparece. No hay prisa y no se
rompe nada.

Son unos diez minutos. Todo es gratis y sin tarjeta.

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto**. Ponle el nombre que quieras (por ejemplo `pokelocke`).
3. Cuando pregunte por Google Analytics, dile que no. No hace falta.

## 2. Encender el inicio de sesión con Google

1. En el menú de la izquierda: **Compilación → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → **Google** → activar → elige un correo de contacto → **Guardar**.
3. Pestaña **Settings → Authorized domains → Add domain**: añade `alfiedpg.github.io`.
   `localhost` ya viene puesto, así que para probar en tu ordenador no hay que tocar nada.
4. Para las cuentas con usuario y contraseña (sin Google): **Sign-in method → Agregar
   proveedor nuevo → Correo electrónico/contraseña** → activar solo la primera opción →
   **Guardar**. Por dentro, el usuario «Pepe» es el correo inventado `pepe@pokely.invalid`
   (ver `js/comun/nube.js`); por eso esas cuentas no pueden recuperar la contraseña. Se
   queda `pokely` (el nombre antiguo) aunque la web se llame NuzTheLocke: si cambiase, las
   cuentas que ya existen no podrían entrar.
5. Si la web cambia de dirección (otro nombre de repositorio o un dominio propio), hay que
   añadir la nueva en **Authorized domains**. Si no, no deja iniciar sesión.

## 3. Crear la base de datos

1. **Compilación → Firestore Database → Crear base de datos**.
2. Elige **modo de producción** (el de prueba deja entrar a cualquiera).
3. Región: `eur3 (europe-west)`.

## 4. Pegar las reglas

1. Dentro de Firestore Database, pestaña **Reglas**.
2. Borra lo que haya y pega **todo** el contenido del archivo `firestore.rules` de este repositorio.
3. **Publicar**.

> Este paso no es opcional. Sin él, cualquiera que abra la web puede leer y borrar los
> datos de todos.

> **Y hay que repetirlo cada vez que cambie `firestore.rules`.** La consola no se entera
> de que el archivo del repositorio ha cambiado: eso se pega a mano. Si «Amigos» o
> «Lockes» dan error de permisos, es que falta este paso.

## 5. Copiar la configuración

1. Vete a la pantalla de inicio del proyecto (**Descripción general del proyecto**, arriba
   del todo a la izquierda).
2. En el centro hay una fila de iconos de plataforma bajo *«Comienza agregando Firebase a
   tu app»*. Pulsa el de web, **`</>`**. Si ya tienes alguna app creada, ahí pondrá
   **Agregar app**.
3. Apodo: `pokelocke-web`. **No** marques Firebase Hosting. **Registrar app**.
4. Te enseña un bloque `firebaseConfig`. Copia esos cuatro valores a
   `js/comun/firebase-config.js`:

```js
export const CONFIG_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "pokelocke-xxxx.firebaseapp.com",
  projectId: "pokelocke-xxxx",
  appId: "1:123...:web:abc..."
};
```

Sube el cambio a GitHub y ya está: aparece el botón **Iniciar sesión** abajo del panel lateral.

Para volver a consultar esos valores más adelante: rueda dentada → **Configuración del
proyecto** → pestaña **General** → abajo, **Tus apps**. Esa sección solo tiene algo una vez
has registrado la app en este paso.

Estos datos **no son secretos**. Van en el JavaScript, a la vista de cualquiera, y así tiene
que ser. Lo que protege tus datos son las reglas del paso 4.

## Dos cosas distintas que no se mezclan

### 1. Lo tuyo: copia de lo que hay en el navegador

Equipos guardados, equipo en edición, rutas marcadas, combates superados, multiplicador,
los juegos elegidos y «Mis normas». La lista está en `CLAVES_SINCRONIZADAS` (`js/comun/almacen.js`), va a
`usuarios/{uid}/datos/{clave}` y **nadie más que tú puede leerlo**.

El navegador sigue mandando: `leer()` y `escribir()` son inmediatos y la nube solo guarda
una copia. Por eso la web funciona igual sin conexión y sin haber iniciado sesión.

- Al iniciar sesión se compara fecha a fecha. Para cada cosa gana la más reciente, venga del
  navegador o de la nube. Si la nube traía algo más nuevo, la página se recarga sola.
- A partir de ahí, cada cambio se sube un segundo después.
- Al **cerrar sesión** se borra todo eso de este navegador (antes se sube lo pendiente): queda
  solo en tu cuenta y vuelve al entrar.
- **Si tocas lo mismo en dos sitios a la vez, gana el último que guarde.** No hay mezcla fina:
  si cambias un equipo en el móvil y otro en el PC sin recargar, uno pisa al otro. Esto solo
  pasa con **tu misma cuenta** abierta en dos aparatos; entre cuentas distintas no hay
  manera de que una toque a la otra.

**No** se sincronizan las cachés de Pokémon y objetos descargados de PokeAPI: cada navegador
las rehace solo y solo servirían para gastar cuota.

### 2. Lo compartido: perfiles, amigos y lockes

`perfiles/{uid}`, `amistades/{par}` y `lockes/{id}` (`js/comun/perfiles.js` y
`js/comun/lockes.js`). Esto **no** pasa por el navegador: se lee y se escribe directo en
Firestore. Un amigo o un marcador compartido es un dato de dos personas, así que guardar una
copia local volvería a plantear quién pisa a quién.

| Colección | Quién la ve | Quién la escribe |
| --- | --- | --- |
| `perfiles/{uid}` | cualquiera con sesión, de uno en uno (sin lista) | solo su dueño; sin correo |
| `motes/{mote}` | cualquiera (para ver si está libre) | solo su dueño; uno por persona |
| `correos/{correo}` | ya no se usa (antes: buscar por correo); solo el dueño mira y borra el suyo | nadie |
| `presencia/{uid}` | cualquiera con sesión | solo su dueño (la hora la pone el servidor) |
| `amistades/{par}` | los dos implicados | los dos implicados |
| `lockes/{id}` | los que juegan ese locke | cada uno sus vidas, victorias, muertos y respuesta; el creador el resto |
| `lockes/{id}/actividad` | los que juegan ese locke | cada uno lo suyo; el creador lo borra al borrar el locke |

Las tres están escuchadas en vivo (`onSnapshot`): si tu rival quita una vida desde su móvil,
a ti te cambia en pantalla al momento, y en cuanto alguien te acepta como amigo te sale su
ficha sin recargar.

### Invitaciones

Nadie entra en tu lista ni en un locke tuyo sin querer:

- **Amigos.** Metes su mote (por correo ya no se busca a nadie) → le llega una solicitud → cuando la acepta, os
  salís el uno en la lista del otro. Hasta entonces en «Amigos» solo estás tú.
- **Lockes.** Quien lo crea elige a los invitados, y puede no invitar a nadie: un locke
  para ti solo vale igual. Los invitados salen como «Sin contestar» hasta que entran, y el
  locke no aparece en su «Lockes» hasta que lo aceptan. Rechazar es salirse: se quita el
  uid de `jugadores` y deja de poder verlo.

Las dos cosas llegan al **buzón** del panel lateral, con un número encima cuando hay algo
pendiente. Está ahí y no dentro de «Amigos» a propósito: una invitación puede llegarte
mientras montas un equipo.

Los invitados van también dentro de `jugadores` desde el principio, aunque no hayan
contestado. Si no, las reglas no les dejarían ni leer la invitación. Quién ha aceptado está
en `estados`.

Al elegir ganador, el +1 del palmarés **no lo escribe quien cierra el locke**: las reglas
solo dejan que cada uno escriba su propio perfil. Lo apunta el navegador del ganador en
cuanto abre la web, y el locke se queda marcado en `contado` para no sumarlo dos veces.
Se hace así a propósito, porque las Cloud Functions piden plan de pago.

### Tipos de locke

Cada persona tiene los suyos en su perfil (`tipos`), con nombre y color. Los tres de
siempre —Locke, Megalocke, Bebelocke— son solo el punto de partida: se pueden renombrar,
recolorear, quitar o añadir otros desde el botón de la etiqueta en tu propia ficha.

Cada locke ganado se queda con una **copia** del tipo, no con una referencia. Así renombrar
un tipo no reescribe la historia.

### 3. El foro

`foro/{id}` (hilos), `foro/{id}/comentarios/{uid_N}`, `denuncias/{id}`, `moderadores/{uid}`,
`silenciados/{uid}` y `ritmo/{uid}` (`js/comun/foro.js` y `js/foro/index.js`). Solo con sesión:
cualquiera identificado lee los hilos; cada uno escribe lo suyo.

**Cómo funciona.** Cualquiera con sesión crea hilos y comenta. Al crear un hilo se elige su tipo
(Busco compañeros, Charla, Dudas y ayuda); no hay pestañas, solo un filtro por tipo, juego y texto.
Los moderadores pueden además crear hilos **principales**: salen destacados arriba del todo y sus
comentarios se leen del más nuevo al más viejo, de 40 en 40.

| Colección | Quién la ve | Quién la escribe |
| --- | --- | --- |
| `foro/{id}` | cualquiera con sesión | cualquiera lo crea (fijado, solo un moderador); su autor edita título y texto; quien comenta, solo el contador; los moderadores, borrar y fijar |
| `foro/{id}/comentarios` | cualquiera con sesión | su autor; los puede borrar él, el autor del hilo y los moderadores |
| `denuncias/{id}` | solo los moderadores | cualquiera con sesión las crea (una por persona y cosa) |
| `moderadores/{uid}` | cada uno ve el suyo; los moderadores, todos | el **administrador** (desde la web); el suyo, a mano en la consola |
| `silenciados/{uid}` | el silenciado y los moderadores | los moderadores |
| `ritmo/{uid}` | — | cada uno la suya |

**Ser administrador (una vez, a mano).** No hay forma de serlo desde la web: así nadie se da permisos.
1. Mira tu uid en Firebase → **Authentication → Usuarios**, columna «UID de usuario» (el de tu cuenta).
2. Firebase → **Firestore Database → Datos → `moderadores` →** el documento con tu uid (créalo si no
   existe: ID de la colección `moderadores`, ID del documento = tu uid) → campo `rol` (string) =
   **`admin`**. Sin ese `admin` eres moderador pero no puedes nombrar a otros.
3. Recarga la web: en el Foro te salen las pestañas **Foro**, **Denuncias** (con el número de
   pendientes) y **Moderadores**, y en cada hilo la chincheta (hacer principal), la papelera
   (borrar el hilo de otro) y, en la ficha de cada persona, silenciar y nombrar moderador.

**Nombrar y quitar moderadores (desde la web).** Pestaña **Moderadores**: escribe el mote de la persona → **Nombrar moderador**. También desde su ficha (pulsa su foto en el foro). Para
quitarlo, **Quitar** en la misma pestaña. Los administradores no se pueden quitar desde la web.
Qué puede hacer un moderador: borrar hilos y comentarios de otros, crear y quitar hilos principales,
silenciar y ver las denuncias.

**Silenciar.** Desde la ficha de la persona (pulsa su foto en el foro) → **Silenciar en el foro**.
No puede escribir hilos ni comentarios, pero sí leer. Lo mismo para quitarlo. Por dentro es un
documento en `silenciados/{uid}`: también se puede crear o borrar desde la consola.

**El freno de 20 segundos.** Cada hilo o comentario va en un lote con `ritmo/{uid}`, y las reglas no
dejan escribir otra marca hasta 20 s después. Es lo único que frena el spam sin servidor propio:
no sustituye a moderar.

**Un índice que hay que crear (solo para borrar cuentas).** Al borrar una cuenta se buscan sus
comentarios en todos los hilos a la vez, y Firestore pide un índice para eso. Sin él, la cuenta se
borra igual y esos comentarios se quedan (sale un aviso en la consola del navegador con un enlace
para crearlo). Para crearlo a mano: Firestore → **Índices → Compuestos → Crear índice** →
ID de colección `comentarios`, ámbito de consulta **Grupo de colección**, campos `uid` (Ascendente)
y `creado` (Ascendente) → Crear. Tarda un par de minutos en estar listo.

**Cuota.** Abrir el foro lee 25 hilos (más los fijados); cada hilo abierto escucha sus comentarios
en vivo hasta que se cierra. Los hilos no se escuchan en vivo: se recargan con el botón ↻ o al
volver a la sección pasado un minuto.

**Al borrar un comentario el contador de respuestas no baja.** Es a propósito: el id de cada
comentario es `uid_N` (N = el número de respuestas que dejó), y las reglas lo usan para exigir
que comentar y subir el contador vayan juntos. Si bajara, un id podría repetirse.

## Privacidad de los perfiles

- **Mote obligatorio.** Al entrar sin mote sale una ventana que no se puede cerrar (`js/sesion.js`,
  `revisarMote`), y las reglas exigen mote para escribir en el foro.
- **Nombre y foto de Google no se copian al perfil.** El nombre es el mote (hasta elegirlo, «Jugador»).
  La foto de Google solo sale si la persona pulsa «Usar mi foto de Google» (`fotoGoogle` en el perfil).
  Quien tenía antes su foto de Google se queda sin foto hasta que la vuelva a pedir.
- **No se busca por correo.** `correos/` ya no se escribe; al entrar, cada cuenta de Google borra el
  apunte que tuviera de antes. Cuando ya no quede ningún documento en `correos`, se puede quitar de las reglas.
- **Política de contraseñas** (solo cuentas de usuario y contraseña, al crearlas): mínimo 8 caracteres con
  mayúscula, minúscula y número. Se activa en Firebase → Authentication → **Configuración → Política de
  contraseñas**, y tiene que coincidir con `claveValida` de `js/sesion.js`. Las cuentas que ya existen
  siguen entrando con su contraseña.

## Protegerla de abusos (App Check y la clave)

La `apiKey` es pública, así que cualquiera podría usarla desde un script y gastar tu cuota diaria
(en Spark no cobra, pero la web se queda sin respuesta). Dos defensas:

1. **Restringir la clave por dominio.** Google Cloud → *APIs y servicios → Credenciales* → la
   «Browser key» del proyecto → *Restricciones de aplicaciones: Sitios web* → añadir
   `https://alfiedpg.github.io/*` y `http://localhost/*`. En *Restricciones de API* deja las que ya
   estén (Identity Toolkit, Cloud Firestore, Token Service…).
2. **App Check** (`js/comun/appcheck.js`). Con Fraud Defense (antes reCAPTCHA Enterprise),
   Firestore y el inicio de sesión solo contestan a esta web. (El reCAPTCHA v3 clásico está
   obsoleto y Firebase ya no deja registrar su clave secreta.) Gratis hasta 10.000 comprobaciones
   al mes; si se pasa, App Check falla y, con «Aplicar» activo, la web se queda sin respuesta.
   1. Google Cloud (proyecto `pokelocke-24512`) → buscar **reCAPTCHA** (o Fraud Defense) →
      habilitar la API si lo pide → **Crear clave** → tipo **Sitio web**, con puntuación
      (invisible), dominios `alfiedpg.github.io` y `localhost` → copia el **ID de la clave**.
   2. Pégalo en `RECAPTCHA_SITE_KEY` de `js/comun/firebase-config.js` y súbelo.
   3. Firebase → *App Check* → tu app web → **Fraud Defense (reCAPTCHA Enterprise)** → pega el
      mismo ID de clave → Guardar.
   4. Espera unos días mirando *App Check → Solicitudes*: tiene que salir casi todo como
      «verificado». Solo entonces pulsa **Aplicar** en Firestore y en Authentication. Antes de
      eso no bloquea nada.
   5. Para probar en tu ordenador: abre la web en `localhost`, copia el token de depuración que
      sale en la consola y regístralo en *App Check → Apps → ⋮ → Gestionar tokens de depuración*.

## Límites del plan gratuito

50.000 lecturas y 20.000 escrituras al día, 1 GiB de datos, y sesión gratis hasta 50.000
usuarios al mes. Si se pasa, no cobra: deja de responder hasta el día siguiente.

Lo que más gasta es el punto de «conectado» (`js/comun/presencia.js`): una escritura cada
3 minutos por persona con la web a la vista (escondida no cuenta). Da para unas 1.000 horas
de gente conectada al día.

## Borrar una cuenta

Desde la web: tu nombre → **Borrar mi cuenta**. Pide otra vez la contraseña (o Google),
porque Firebase solo deja borrar una cuenta recién entrada, y borra perfil, mote, correo,
presencia, datos, amistades, tus hilos y comentarios del foro y la cuenta; de los lockes compartidos se sale (los que creó y
nadie más había aceptado se borran).

El plan gratis de Firebase (Spark) **no pausa el proyecto** por no usarlo, que es justo por
lo que no elegimos Supabase.
