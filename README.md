# CdramaList

PWA para reunir las partes de una historia de YouTube, guardar el progreso y verlas dentro de la app con el reproductor embebido de YouTube.

**Demo:** https://javiersanzgarcia.github.io/cdramaList/

## Qué hace

- **Encuentra las partes automáticamente.** Pega un enlace de vídeo y la app busca en el canal los vídeos de la misma historia, detecta los números de parte (`Parte 2`, `P2`, `2/5`, `Capítulo 2`, `(2)`, `#2`, `Final`…) y te deja elegir cuáles guardar.
- **Importa listas de reproducción completas.** Si el canal agrupa las partes en una playlist, se importan todas en orden.
- **Guarda tu progreso.** Marca partes como vistas, continúa donde lo dejaste y consulta el porcentaje de cada serie.
- **Reproductor integrado.** Las partes se reproducen dentro de la app y avanzan solas al terminar el vídeo.
- **Cuenta de Google opcional.** Inicia sesión para identificar tu cuenta y usar una ruta de sincronización propia.
- **Sincronización sin backend.** Guarda tus series en un JSON dentro de un repositorio de GitHub mediante la API de GitHub y un token fine-grained. Funciona entre móvil y ordenador sin servidor propio.
- **Todo sigue siendo local por defecto.** Sin cuenta ni token, las series y la clave de API se guardan en `localStorage`.

## Clave de YouTube (opcional pero recomendada)

La búsqueda automática usa la [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) con **tu propia clave gratuita**:

1. Habilita **YouTube Data API v3** en Google Cloud.
2. Crea una **clave de API** en [Credenciales](https://console.cloud.google.com/apis/credentials).
3. Restringe la clave a los referrers `https://javiersanzgarcia.github.io/*` y `http://localhost:5173/*`.
4. Pega la clave en **Ajustes** dentro de la app.

La clave se guarda solo en el navegador y nunca se sube al repositorio. Sin clave puedes seguir añadiendo vídeos uno a uno en modo manual.

> Cada búsqueda consume 100 unidades de la cuota gratuita diaria (10.000). Las peticiones de metadatos consumen mucho menos.

## Cuenta de Google

El inicio de sesión usa **Google Identity Services** y solo necesita un **Client ID público** (no hay secreto que guardar). Pasos:

1. Entra en [Credenciales de Google Cloud](https://console.cloud.google.com/apis/credentials) y crea o elige un proyecto.
2. Si es la primera vez, configura la **pantalla de consentimiento** como _External_ y añade tu correo como usuario de prueba.
3. Pulsa **Crear credenciales → ID de cliente OAuth → Aplicación web**.
4. En **Orígenes JavaScript autorizados** añade, sin barra final:
   - `https://javiersanzgarcia.github.io`
   - `http://localhost:5173`
5. Copia el Client ID (termina en `.apps.googleusercontent.com`).
6. Configúralo de una de estas formas:
   - **Local:** crea un `.env` a partir de `.env.example` y pega el valor en `VITE_GOOGLE_CLIENT_ID`.
     ```bash
     cp .env.example .env
     ```
   - **GitHub Pages:** crea la variable de repositorio `VITE_GOOGLE_CLIENT_ID` en **Settings → Secrets and variables → Actions → Variables** (ver más abajo).
   - **Sin rebuild:** pégalo desde el avatar de la esquina → **Cuenta y sincronización**.

El valor de `VITE_GOOGLE_CLIENT_ID` (entorno o build) tiene prioridad sobre el que se guarda en el navegador, así que al desplegar la app el botón de Google aparece ya listo. El archivo `.env` no se sube al repositorio; solo se versiona `.env.example`.

> El login es una identidad de cliente: el JWT se decodifica en el navegador y no se verifica en un servidor. No concede acceso a Google Drive. La protección real de tus datos depende de que el repositorio de sincronización sea privado y de tu token de GitHub.

## Sincronización en GitHub

GitHub Pages es solo lectura para el navegador, así que la app escribe el JSON directamente con la **API de GitHub** usando un token que se guarda únicamente en tu navegador.

1. Crea un repositorio **privado** para los datos, por ejemplo `cdramalist-data`. No necesita GitHub Pages.
2. Entra en [Fine-grained tokens](https://github.com/settings/personal-access-tokens/new) y crea un token.
3. En **Repository access** selecciona solo ese repositorio.
4. En **Permissions → Contents** elige **Read and write**.
5. En la app, abre **Cuenta y sincronización**, pega el token, el repositorio (`usuario/repositorio`), la rama (`main`) y la ruta del JSON.
6. Pulsa **Guardar y comprobar**.

La ruta recomendada es `cdramalist/<id-de-google>.json`, que la app rellena automáticamente al iniciar sesión. La sincronización también funciona sin iniciar sesión si escribes una ruta manual; la cuenta de Google solo sirve para identificar al usuario y proponer esa ruta.

### Cómo funciona

| Acción                        | Qué hace                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| **Sincronizar y combinar**    | Lee la nube, une las series y el progreso de ambos lados y vuelve a subir el resultado. |
| **Subir**                     | Reemplaza el archivo de la nube con las series de este dispositivo.                     |
| **Bajar**                     | Reemplaza las series de este dispositivo con las de la nube.                            |
| **Sincronización automática** | Sube los cambios unos 2 segundos después de cada edición.                               |

- Si el archivo cambia en la nube mientras tanto, GitHub devuelve un conflicto y la app pide volver a sincronizar.
- Borrar una serie o pulsar **Borrar series y progreso** con la sincronización automática activa también borra esos datos en la nube.
- **Sincronizar y combinar** usa la unión de series y progreso. No resucita una serie borrada si antes se ha subido el borrado, pero si se combina con una copia antigua de la nube puede reaparecer.

> **Seguridad:** el token se guarda en `localStorage` de este navegador y nunca se incluye en el repositorio ni en la build. Aun así, usa un token limitado al repositorio de datos, mantenlo privado y revócalo en GitHub si sospechas que se ha filtrado. No reutilices un token con acceso a otros repositorios.

## Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **vite-plugin-pwa** (service worker + manifest instalable)

## Scripts

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # compilar para producción (dist/)
npm run preview  # previsualizar la build
npm run lint     # lint con oxlint
```

## Estructura

```
src/
├── components/         # UI (HomeView, ListView, SeriesSheet, AccountSheet…)
├── hooks/              # persistencia local, instalación PWA y hojas modales
├── lib/
│   ├── format.ts       # duraciones y fechas
│   ├── google.ts       # Google Identity Services y decodificación del JWT
│   ├── parts.ts        # detección de partes y similitud de títulos
│   ├── series.ts       # progreso, estados, filtros y fusión de series
│   ├── status.ts       # metadatos de los estados
│   ├── sync.ts         # cliente de la API de GitHub (pull/push)
│   └── youtube.ts      # API de YouTube, URLs, búsqueda y playlists
├── types.ts
├── App.tsx
└── index.css           # Tailwind + tema
```

## Datos guardados

| Clave                       | Contenido                                                           |
| --------------------------- | ------------------------------------------------------------------- |
| `cdramalist:series`         | Series, partes y progreso                                           |
| `cdramalist:apiKey`         | Clave de YouTube Data API v3                                        |
| `cdramalist:googleUser`     | Nombre, correo y foto de la cuenta de Google                        |
| `cdramalist:googleClientId` | Client ID guardado desde la app (el de `.env`/repo tiene prioridad) |
| `cdramalist:syncConfig`     | Token de GitHub, repositorio, rama y ruta                           |
| `cdramalist:syncDirty`      | Si hay cambios locales pendientes de subir                          |

Puedes exportar una copia en JSON desde **Ajustes → Mis datos** e importarla en otro dispositivo. La clave de YouTube y el token de GitHub nunca se incluyen en esa exportación.

## Instalar en Android

La PWA necesita HTTPS (o `localhost`) para registrarse:

1. Abre la app en Chrome para Android.
2. Toca el menú **⋮** y elige **«Añadir a pantalla de inicio»** o **«Instalar aplicación»**.
3. También puedes usar el botón de descarga que aparece en la cabecera de la app.

## Despliegue en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml`, que compila y publica la app en GitHub Pages en cada push a `main`.

1. Sube el repositorio a GitHub (rama `main`).
2. En GitHub, entra en **Settings → Pages → Build and deployment** y selecciona **GitHub Actions** como _Source_.
3. Opcional: en **Settings → Secrets and variables → Actions → Variables**, crea `VITE_GOOGLE_CLIENT_ID` con tu Client ID. Así el botón de Google aparece ya configurado y no hay que pegarlo en cada dispositivo.
4. Ve a la pestaña **Actions** y espera a que termine el workflow **Deploy to GitHub Pages**.
5. La app quedará disponible en:

```
https://TU_USUARIO.github.io/cdramaList/
```

La ruta base se detecta automáticamente en GitHub Actions a partir del nombre del repositorio (`/cdramaList/`), por lo que no hace falta cambiar `vite.config.ts`. En local se sigue usando `/`.

También puedes desplegar la carpeta `dist/` en cualquier otro hosting estático con HTTPS (Netlify, Vercel, Cloudflare Pages…).

## Pendientes

### Configurar la api de youtube automaticamente

### Modificar como se sincronizan las series entre dispositivos por login con google drive en vez de un repo de github

### Añadir botón actualizar serie, para que busque nuevos capitulos

### Modificar modo de búsqueda, para buscar por nombres propios, descripción, nombres de personajes
