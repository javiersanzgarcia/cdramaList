# CdramaList

Aplicación móvil (PWA) para descubrir, guardar y seguir tus dramas chinos favoritos. Funciona sin conexión y guarda tu progreso en el dispositivo.

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

## Instalar en Android

La PWA necesita HTTPS (o `localhost`) para registrarse:

1. Abre la app en Chrome para Android.
2. Toca el menú **⋮** y elige **«Añadir a pantalla de inicio»** o **«Instalar aplicación»**.
3. También puedes usar el botón de descarga que aparece en la cabecera de la app.

## Estructura

```
src/
├── components/     # UI (TopBar, DramaCard, DramaSheet, BottomNav…)
├── data/dramas.ts  # catálogo de dramas
├── hooks/          # persistencia local e instalación PWA
├── lib/status.ts   # metadatos de estados de visionado
├── types.ts
├── App.tsx
└── index.css       # Tailwind + tema
```

## Subir a GitHub

El repositorio local ya está inicializado en la rama `main` con el commit inicial. Como `gh` no está autenticado, elige una opción:

### Opción A — GitHub CLI

```bash
gh auth login
gh repo create cdramaList --public --source=. --remote=origin --push
```

### Opción B — Repositorio creado desde la web

Crea un repositorio vacío llamado `cdramaList` en GitHub y después:

```bash
git remote add origin https://github.com/TU_USUARIO/cdramaList.git
git push -u origin main
```

## Despliegue en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml`, que compila y publica la app en GitHub Pages en cada push a `main`.

1. Sube el repositorio a GitHub (rama `main`).
2. En GitHub, entra en **Settings → Pages → Build and deployment** y selecciona **GitHub Actions** como *Source*.
3. Ve a la pestaña **Actions** y espera a que termine el workflow **Deploy to GitHub Pages**.
4. La app quedará disponible en:

```
https://TU_USUARIO.github.io/cdramaList/
```

La URL exacta aparece en el entorno `github-pages` del despliegue.

La ruta base se detecta automáticamente en GitHub Actions a partir del nombre del repositorio (`/cdramaList/`), por lo que no hace falta cambiar `vite.config.ts`. En local se sigue usando `/`.

> Si el repositorio se llama `TU_USUARIO.github.io`, la app se publica en la raíz y el workflow lo detecta automáticamente.

También puedes desplegar la carpeta `dist/` en cualquier otro hosting estático con HTTPS (Netlify, Vercel, Cloudflare Pages…).
