# CdramaList

PWA para reunir las partes de una historia de YouTube, guardar el progreso y verlas dentro de la app con el reproductor embebido de YouTube.

**Demo:** https://javiersanzgarcia.github.io/cdramaList/

## Qué hace

- **Encuentra las partes automáticamente.** Pega un enlace de vídeo y la app busca en el canal los vídeos de la misma historia, detecta los números de parte (`Parte 2`, `P2`, `2/5`, `Capítulo 2`, `(2)`, `#2`, `Final`…) y te deja elegir cuáles guardar.
- **Importa listas de reproducción completas.** Si el canal agrupa las partes en una playlist, se importan todas en orden.
- **Guarda tu progreso.** Marca partes como vistas, continúa donde lo dejaste y consulta el porcentaje de cada serie.
- **Reproductor integrado.** Las partes se reproducen dentro de la app y avanzan solas al terminar el vídeo.
- **Todo en tu dispositivo.** Las series y la clave de API se guardan en `localStorage`; no hay backend ni cuentas.

## Clave de YouTube (opcional pero recomendada)

La búsqueda automática usa la [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) con **tu propia clave gratuita**:

1. Habilita **YouTube Data API v3** en Google Cloud.
2. Crea una **clave de API** en [Credenciales](https://console.cloud.google.com/apis/credentials).
3. Restringe la clave a los referrers `https://javiersanzgarcia.github.io/*` y `http://localhost:5173/*`.
4. Pega la clave en **Ajustes** dentro de la app.

La clave se guarda solo en el navegador y nunca se sube al repositorio. Sin clave puedes seguir añadiendo vídeos uno a uno en modo manual.

> Cada búsqueda consume 100 unidades de la cuota gratuita diaria (10.000). Las peticiones de metadatos consumen mucho menos.

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
├── components/         # UI (HomeView, ListView, SeriesSheet, PlayerSheet…)
├── hooks/              # persistencia local, instalación PWA y hojas modales
├── lib/
│   ├── format.ts       # duraciones y fechas
│   ├── parts.ts        # detección de partes y similitud de títulos
│   ├── series.ts       # progreso, estados, filtros y fusión de series
│   ├── status.ts       # metadatos de los estados
│   └── youtube.ts      # API de YouTube, URLs, búsqueda y playlists
├── types.ts
├── App.tsx
└── index.css           # Tailwind + tema
```

## Datos guardados

| Clave                  | Contenido                                   |
| ---------------------- | ------------------------------------------- |
| `cdramalist:series`    | Series, partes y progreso                   |
| `cdramalist:apiKey`    | Clave de YouTube Data API v3                |

Puedes exportar una copia en JSON desde **Ajustes → Mis datos** e importarla en otro dispositivo.

## Instalar en Android

La PWA necesita HTTPS (o `localhost`) para registrarse:

1. Abre la app en Chrome para Android.
2. Toca el menú **⋮** y elige **«Añadir a pantalla de inicio»** o **«Instalar aplicación»**.
3. También puedes usar el botón de descarga que aparece en la cabecera de la app.

## Despliegue en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml`, que compila y publica la app en GitHub Pages en cada push a `main`.

1. Sube el repositorio a GitHub (rama `main`).
2. En GitHub, entra en **Settings → Pages → Build and deployment** y selecciona **GitHub Actions** como *Source*.
3. Ve a la pestaña **Actions** y espera a que termine el workflow **Deploy to GitHub Pages**.
4. La app quedará disponible en:

```
https://TU_USUARIO.github.io/cdramaList/
```

La ruta base se detecta automáticamente en GitHub Actions a partir del nombre del repositorio (`/cdramaList/`), por lo que no hace falta cambiar `vite.config.ts`. En local se sigue usando `/`.

También puedes desplegar la carpeta `dist/` en cualquier otro hosting estático con HTTPS (Netlify, Vercel, Cloudflare Pages…).
