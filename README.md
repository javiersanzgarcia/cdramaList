# CdramaList

PWA para reunir las partes de una historia de YouTube, guardar el progreso y verlas dentro de la app con el reproductor embebido de YouTube.

**Demo:** https://javiersanzgarcia.github.io/cdramaList/

## Qué hace

- **Encuentra las partes automáticamente.** Pega un enlace de vídeo y la app busca en el canal los vídeos de la misma historia, detecta los números de parte (`Parte 2`, `P2`, `2/5`, `Capítulo 2`, `(2)`, `#2`, `Final`…) y te deja elegir cuáles guardar.
- **Importa listas de reproducción completas.** Si el canal agrupa las partes en una playlist, se importan todas en orden.
- **Guarda tu progreso.** Marca partes como vistas, continúa donde lo dejaste y consulta el porcentaje de cada serie.
- **Reproductor integrado.** Las partes se reproducen dentro de la app y avanzan solas al terminar el vídeo.
- **Sincronización con Google Drive.** Inicia sesión con Google y guarda tus series en un archivo privado de tu Drive (`appDataFolder`). Funciona entre móvil y ordenador sin servidor propio.
- **Todo sigue siendo local por defecto.** Sin cuenta de Google, las series y la clave de API se guardan en `localStorage`.

## Clave de YouTube (opcional pero recomendada)

La búsqueda automática usa la [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) con **tu propia clave gratuita**:

1. Habilita **YouTube Data API v3** en Google Cloud.
2. Crea una **clave de API** en [Credenciales](https://console.cloud.google.com/apis/credentials).
3. Restringe la clave a los referrers `https://javiersanzgarcia.github.io/*` y `http://localhost:5173/*`.
4. Pega la clave en **Ajustes** dentro de la app.

La clave se guarda solo en el navegador y nunca se sube a Google Drive. Sin clave puedes seguir añadiendo vídeos uno a uno en modo manual.

> Cada búsqueda consume 100 unidades de la cuota gratuita diaria (10.000). Las peticiones de metadatos consumen mucho menos. **Actualizar serie** hace una sola búsqueda global por actualización.

## Buscar capítulos nuevos

Al **añadir una serie** desde un vídeo y al pulsar **Actualizar serie** se usa la misma búsqueda ampliada:

- Revisa las subidas recientes del canal de la serie.
- Lee las descripciones de las partes conocidas para extraer el título real del drama (por ejemplo, `【Títulos】 Apocalipsis de la Lluvia Negra`), porque muchos canales usan el título del vídeo solo como resumen.
- Hace una búsqueda global en YouTube con ese título real; si no hay título en las descripciones, usa el título de la serie (una sola consulta por actualización).
- Añade automáticamente solo los vídeos cuyo título base coincide exactamente con el de la serie (por ejemplo, «Mi drama» → «Mi drama - Parte 3» o «Mi drama | Final»).
- Las coincidencias por el título de la descripción y el resto de coincidencias parciales aparecen como **posibles capítulos**: puedes revisar el vídeo, ver el título detectado en la descripción, escribir o editar el número de capítulo, marcarlo como final, añadirlo o descartarlo. Al añadir una serie, los candidatos se incorporan a la vista previa y se guardan junto con ella.

Los candidatos no se guardan hasta que los validas. Al añadir uno en una serie existente, la serie se sincroniza con Drive si hay una sesión activa.

## Cuenta de Google y sincronización con Drive

La sincronización usa **Google Drive** como almacenamiento y **GitHub Pages solo como hosting**. No hay backend propio: el navegador obtiene un access token OAuth2 y escribe un archivo `cdramalist.json` en la carpeta privada `appDataFolder` de tu Drive.

### Activar Google Drive en Google Cloud

1. Entra en [Credenciales de Google Cloud](https://console.cloud.google.com/apis/credentials) y crea o elige un proyecto.
2. Activa la [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com).
3. Configura la **pantalla de consentimiento** como _External_ y añade tu correo como usuario de prueba.
4. En **Permisos o scopes**, añade:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `openid`, `email` y `profile` (suelen venir por defecto).
5. Pulsa **Crear credenciales → ID de cliente OAuth → Aplicación web**.
6. En **Orígenes JavaScript autorizados** añade, sin barra final:
   - `https://javiersanzgarcia.github.io`
   - `http://localhost:5173`
7. Copia el Client ID (termina en `.apps.googleusercontent.com`).
8. Configúralo de una de estas formas:
   - **Local:** crea un `.env` a partir de `.env.example` y pega el valor en `VITE_GOOGLE_CLIENT_ID`.
     ```bash
     cp .env.example .env
     ```
   - **GitHub Pages:** crea la variable de repositorio `VITE_GOOGLE_CLIENT_ID` en **Settings → Secrets and variables → Actions → Variables**.

El Client ID se lee solo de `VITE_GOOGLE_CLIENT_ID` (en local desde `.env`, en Pages desde la variable del repositorio). No se configura desde la app. El archivo `.env` no se sube al repositorio; solo se versiona `.env.example`.

### Cómo funciona la sincronización

| Acción                        | Qué hace                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| **Conectar con Google Drive** | Pide permiso `drive.appdata` y crea o lee `cdramalist.json` en la carpeta privada de la app.        |
| **Sincronizar y combinar**    | Lee el archivo de Drive, une las series y el progreso de ambos lados y vuelve a subir el resultado. |
| **Subir**                     | Reemplaza el archivo de Drive con las series de este dispositivo.                                   |
| **Bajar**                     | Reemplaza las series de este dispositivo con las de Drive.                                          |
| **Sincronización automática** | Sube los cambios unos 2 segundos después de cada edición.                                           |

- Cada cuenta de Google tiene su propio archivo en su propio Drive.
- El token de acceso se mantiene en memoria y no se guarda en `localStorage`. Al recargar, la app intenta renovarlo sin mostrar ventanas; si Google lo requiere, pulsa **Reconectar**.
- Si no hay conexión, los cambios siguen guardándose en el dispositivo y se suben cuando vuelvas a sincronizar.
- Borrar una serie o pulsar **Borrar series y progreso** con la sincronización automática activa también borra esos datos en Drive.
- **Sincronizar y combinar** usa la unión de series y progreso. No resucita una serie borrada si el borrado ya se ha subido, pero si se combina con una copia antigua de Drive puede reaparecer.

> **Privacidad:** el permiso `drive.appdata` solo da acceso a la carpeta privada de CdramaList. La app no puede leer ni modificar el resto de archivos de tu Google Drive. Si quieres revocar el acceso, hazlo desde [la configuración de tu cuenta de Google](https://myaccount.google.com/permissions).

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
├── hooks/              # persistencia local, sync con Drive, instalación PWA y hojas modales
├── lib/
│   ├── format.ts       # duraciones y fechas
│   ├── google.ts       # OAuth2, token de Drive y datos de la cuenta
│   ├── parts.ts        # detección de partes y similitud de títulos
│   ├── series.ts       # progreso, estados, filtros y fusión de series
│   ├── status.ts       # metadatos de los estados
│   ├── drive.ts        # cliente de Google Drive (pull/push en appDataFolder)
│   └── youtube.ts      # API de YouTube, URLs, búsqueda y playlists
├── types.ts
├── App.tsx
└── index.css           # Tailwind + tema
```

## Datos guardados

| Clave                   | Contenido                                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| `cdramalist:series`     | Series, partes y progreso                                              |
| `cdramalist:apiKey`     | Clave de YouTube Data API v3                                           |
| `cdramalist:googleUser` | Nombre, correo y foto de la cuenta de Google                           |
| `cdramalist:drive`      | Conexión con Drive: auto-sync, correo, archivo y última sincronización |

El token de acceso de Drive se guarda temporalmente en `sessionStorage` (`cdramalist:driveToken`) para que la sincronización siga activa al recargar la página. Caduca en aproximadamente una hora; después hay que pulsar **Reconectar Google Drive**. Nunca se guarda de forma permanente.

Puedes exportar una copia en JSON desde **Ajustes → Mis datos** e importarla en otro dispositivo. La clave de YouTube y el token de Drive nunca se incluyen en esa exportación.

## Instalar en Android

La PWA necesita HTTPS (o `localhost`) para registrarse:

1. Abre la app en Chrome para Android.
2. Toca el menú **⋮** y elige **«Añadir a pantalla de inicio»** o **«Instalar aplicación»**.
3. También puedes usar el botón de descarga que aparece en la cabecera de la app.

## Despliegue en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml`, que compila y publica la app en GitHub Pages en cada push a `main`.

1. Sube el repositorio a GitHub (rama `main`).
2. En GitHub, entra en **Settings → Pages → Build and deployment** y selecciona **GitHub Actions** como _Source_.
3. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_GOOGLE_CLIENT_ID` con tu Client ID. La app lo usa para todo el flujo de Google (cuenta y Drive).
4. Ve a la pestaña **Actions** y espera a que termine el workflow **Deploy to GitHub Pages**.
5. La app quedará disponible en:

```
https://TU_USUARIO.github.io/cdramaList/
```

La ruta base se detecta automáticamente en GitHub Actions a partir del nombre del repositorio (`/cdramaList/`), por lo que no hace falta cambiar `vite.config.ts`. En local se sigue usando `/`.

También puedes desplegar la carpeta `dist/` en cualquier otro hosting estático con HTTPS (Netlify, Vercel, Cloudflare Pages…).

## Pendientes

### Buscar también por nombres de personajes y títulos alternativos
