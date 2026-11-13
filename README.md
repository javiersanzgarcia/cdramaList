# CdramaList

PWA para reunir las partes de una historia de YouTube, guardar el progreso y verlas dentro de la app con el reproductor embebido de YouTube.

**Demo:** <https://javiersanzgarcia.github.io/cdramaList/>

## Novedades de la 1.2

- **Crear una serie ya no se confunde con añadir partes.** Desde la portada, la app ya no adjunta en silencio una serie nueva a otra parecida: si detecta una coincidencia, muestra una tarjeta para elegir entre **Añadir a la existente** o **Crear serie nueva**, sin adjuntar nada por defecto.
- **Añadir partes tiene su propio flujo.** Al entrar desde una serie, la cabecera lo indica, aparece un banner con el nombre y la portada de la serie destino, el título no se puede cambiar y el botón de guardar dice cuántas partes nuevas vas a añadir.
- **Las partes que ya están en la serie se marcan como «Ya en la serie».** Aparecen deshabilitadas, fuera de la selección y «Seleccionar todas» solo afecta a las partes nuevas, así que es imposible duplicarlas por error.

## Novedades de la 1.1

- **Quitar partes de una serie.** Cada parte de la ficha tiene una papelera para sacarla de la serie sin borrar la serie entera. Pide confirmación con una segunda pulsación y limpia también su marca de vista. La parte queda con una lápida (con su momento de borrado), así que no reaparece en las búsquedas ni la reintroduce la sincronización desde otra copia; si más adelante la vuelves a añadir, la lápida se levanta sola.

## Novedades de la 1.0

Primera versión estable. Lo más destacado:

- **Estados coherentes.** El estado manual manda salvo cuando contradice al progreso, y bajar de «Completada» pide confirmación antes de reiniciar el progreso. Ver [Estados de las series](#estados-de-las-series).
- **Cola de novedades.** «Actualizar todas las favoritas» abre las series con novedades en cola, con **Revisar siguiente serie** y un botón flotante **Revisar novedades (N)** que sobrevive al cerrar la ficha y se recalcula solo, sin recargar la página. Ver [Favoritas y novedades](#favoritas-y-novedades).
- **Duración por parte y total**, con el total marcado como parcial si falta el metadato de algún vídeo.
- **Portada personalizable** por la de cualquiera de las partes de la serie.
- **Sincronización fiable con Drive.** Mezcla a tres bandas campo a campo, lápidas de borrado con purga a los 30 días y aviso si la subida falla.

## Qué hace

- **Encuentra las partes automáticamente.** Pega un enlace de vídeo y la app busca en el canal los vídeos de la misma historia. Reconoce formatos como `Parte 2`, `P2`, `EP2`, `Episode 2`, `E02`, `Vol. 2`, `Pt. 2`, `Part Two`, `第二集`, `第2集`, `2화`, `2/5`, `(2)` y `#2`.
- **Detecta los capítulos finales.** Identifica marcadores como `Final`, `The End`, `Ending`, `Última Parte`, `Cap Final`, `Episodio Final`, `完结` y `结局`, y marca la parte como final automáticamente.
- **Relaciona títulos por conceptos.** Ignora emojis, hashtags, caracteres decorativos y diferencias de mayúsculas; compara palabras significativas y reconoce algunas variantes de género, plural y conjugación. Por ejemplo, puede relacionar «CEO millonario enamorado» con «Secretaria pobre enamora al CEO millonario».
- **Aprende de tus confirmaciones.** Al añadir una sugerencia, sus palabras clave ganan confianza para esa serie; las coincidencias relacionadas se priorizan en próximas búsquedas. La señal se guarda con la serie, se sincroniza con Drive y tiene límites para evitar que crezca sin control.
- **Importa listas de reproducción completas.** Si el canal agrupa las partes en una playlist, se importan todas en orden.
- **Guarda tu progreso.** Marca partes como vistas, continúa donde lo dejaste y consulta el porcentaje de cada serie.
- **Estados claros por serie.** Cada serie es **Pendiente**, está **En curso** o **Completada**, según su progreso o tu elección manual en la ficha. Puedes filtrar por estado; marcar una serie como completada da por vistas todas sus partes.
- **Favoritas.** Marca series como favoritas para tenerlas a mano y actualízalas todas de una vez buscando capítulos nuevos.
- **Duración por parte y total.** La ficha muestra la duración de cada parte y la suma de la serie; si falta el metadato de algún vídeo, el total se marca como parcial.
- **Reorganiza los capítulos.** Usa las flechas de la ficha para cambiar el orden de reproducción; el orden manual se conserva al recargar y sincronizar. También puedes quitar una parte concreta de la serie con la papelera de su fila.
- **Portada personalizable.** Cambia la portada de la serie por la de cualquiera de sus partes.
- **Reproductor integrado.** Las partes se reproducen dentro de la app y avanzan solas al terminar el vídeo.
- **Sincronización con Google Drive.** Inicia sesión con Google y guarda tus series en un archivo privado de tu Drive (`appDataFolder`). Funciona entre móvil y ordenador sin servidor propio.
- **Todo sigue siendo local por defecto.** Sin cuenta de Google, las series y la clave de API se guardan en `localStorage`.
- **Estado persistente con Zustand.** Series, preferencias de Drive, clave de YouTube y caché de sinónimos se guardan en un store Zustand con persistencia. Los datos de instalaciones anteriores se migran automáticamente.

## Estados de las series

Desde la ficha de una serie puedes fijar su estado a mano: **Pendientes**, **En curso** o **Completadas**. El estado que elijas manda sobre el automático mientras no contradiga al progreso:

- **Completada ⇒ todas las partes vistas.** Marcar una serie como completada marca todas sus partes como vistas, y cualquier serie con todas las partes vistas se muestra siempre como completada. Así el porcentaje y el estado nunca se contradicen.
- **Dejar de estar completada borra el progreso.** Si marcas como «En curso» o «Pendiente» una serie que estaba al 100 %, se reinicia su progreso para que pueda volver a verse desde el principio. La app pide confirmación antes de borrarlo.
- **Reproducir no cambia lo que hayas elegido.** Ver una parte no pisa un estado manual: una serie marcada como «Pendiente» sigue en «Pendientes» hasta que la completes o cambies el estado tú.
- **«Continuar viendo»** muestra las series en curso con alguna parte pendiente, y el filtro de cada lista se basa tanto en el estado elegido como en el progreso.

## Favoritas y novedades

Marca series como favoritas (el corazón de la tarjeta o de la ficha) y filtra por **Favoritas**. Con el filtro de favoritas activo aparece el botón **Actualizar todas las favoritas**, que busca capítulos nuevos en todas ellas de una vez:

- Mientras trabaja, la app avisa de que no cierres ni cambies de pantalla, porque el lote puede tardar.
- Las series con novedades se abren **en cola**: revisas la primera y pasas a la siguiente con **Revisar siguiente serie**.
- Si cierras la ficha, la cola **no se pierde**: un botón flotante **Revisar novedades (N)** te deja retomarla sin repetir la búsqueda.
- Al terminar se muestran los avisos de la búsqueda y, si la sincronización con Drive falla, también se indica.

## Clave de YouTube (opcional pero recomendada)

La búsqueda automática usa la [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) con **tu propia clave gratuita**:

1. Habilita **YouTube Data API v3** en Google Cloud.
2. Crea una **clave de API** en [Credenciales](https://console.cloud.google.com/apis/credentials).
3. Restringe la clave a los referrers `https://javiersanzgarcia.github.io/*` y `http://localhost:5173/*`.
4. Pega la clave en **Ajustes** dentro de la app.

La clave se guarda solo en el navegador y nunca se sube a Google Drive. Sin clave puedes seguir añadiendo vídeos uno a uno en modo manual.

## Fingerprint semántico con Cloudflare Workers AI (opcional)

Un **Worker de Cloudflare** clasifica títulos y descripciones en etiquetas abiertas agrupadas por géneros, tropos, roles, escenarios y elementos de trama; no depende de una lista cerrada. Puede reconocer, por ejemplo, `engineer`, `transmigration`, `modern_person_in_past`, `rebirth`, `ancient_china`, `cultivation`, `secretary` o `revenge`, y añadir otros conceptos relevantes. El fingerprint de la serie se genera una vez y se guarda con ella; en cada actualización se clasifican en una sola petición los candidatos encontrados y se comparan sus etiquetas. Sin servicio configurado, o si falla, se mantiene la búsqueda habitual.

La credencial de Cloudflare vive **solo en el Worker** (binding `AI` de Workers AI). La PWA únicamente conoce la URL pública del endpoint, así que no se incluye ninguna clave de proveedor en el JavaScript publicado.

### Desplegar el Worker

El Worker está en `cloudflare/semantic-worker`:

```bash
cd cloudflare/semantic-worker
npx wrangler login
npx wrangler deploy
```

Antes de desplegar, revisa `wrangler.toml`:

- `AI_MODEL`: modelo de Workers AI (por defecto `@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
- `ALLOWED_ORIGINS`: orígenes permitidos, separados por comas. Incluye `https://javiersanzgarcia.github.io` y, para desarrollo local, `http://localhost:5173`.

Wrangler imprimirá la URL del Worker. El endpoint es:

```text
https://<nombre-del-worker>.<tu-subdominio>.workers.dev/api/semantic-fingerprint
```

### Configurar la PWA

1. En local, añade la URL a `.env`:

   ```bash
   VITE_SEMANTIC_API_URL=https://<nombre-del-worker>.<tu-subdominio>.workers.dev/api/semantic-fingerprint
   ```

2. En GitHub Pages, crea la variable de repositorio `VITE_SEMANTIC_API_URL` en **Settings → Secrets and variables → Actions → Variables**.

Los títulos enviados al Worker salen del dispositivo. La cuota gratuita de Workers AI es limitada y puede cambiar; el Worker limita el tamaño de la petición y la frecuencia por IP.

> Cada búsqueda consume 100 unidades de la cuota gratuita diaria (10.000). Las peticiones de metadatos consumen mucho menos. **Actualizar serie** hace una sola búsqueda global por actualización.

## Buscar capítulos nuevos

Al **añadir una serie** desde un vídeo, al pulsar **Actualizar serie** y al pulsar **Actualizar todas las favoritas** se usa la misma búsqueda ampliada:

- Revisa las subidas recientes del canal de la serie.
- Lee las descripciones de las partes conocidas para extraer el título real del drama (por ejemplo, `【Títulos】 Apocalipsis de la Lluvia Negra`), porque muchos canales usan el título del vídeo solo como resumen.
- Hace una búsqueda global en YouTube con el título principal y añade el título real extraído de las descripciones como referencia. Si no hay título en las descripciones, sigue usando el título principal (una sola consulta por actualización).
- Busca también por los **alias manuales** de cada serie. Puedes añadir otros títulos de la misma historia (traducciones o títulos alternativos) desde la ficha de la serie; se combinan con el título principal en la misma consulta OR, así que no se multiplican las llamadas a la API.
- Amplía la búsqueda con **sinónimos en español** de las palabras principales del título (por ejemplo, `lluvia` → `precipitación`, `aguacero`, `chaparrón`; `apocalipsis` → `catástrofe`, `cataclismo`), porque las traducciones automáticas suelen cambiar unas palabras por otras. Los sinónimos se consultan en [rae-api.com](https://rae-api.com), se guardan en caché durante 60 días y, si la API falla o se agota su cuota, la búsqueda continúa con el título original.
- Si se configura el servicio semántico, genera el fingerprint de la serie en el primer refresco y clasifica en lote los candidatos para priorizar historias con atributos compartidos. El fingerprint queda guardado con la serie y se sincroniza con Drive.
- Añade automáticamente solo los vídeos cuyo título base coincide exactamente con el de la serie o con uno de sus alias (por ejemplo, «Mi drama» → «Mi drama - Parte 3» o «Mi drama | Final»).
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
- Al borrar una serie se guarda una **lápida** para propagar el borrado a los demás dispositivos. Pasados **30 días** esa lápida se purga sola, de modo que la lista y el archivo de Drive no crecen sin control ni acumulan duplicados al volver a añadir la misma serie.

> **Privacidad:** el permiso `drive.appdata` solo da acceso a la carpeta privada de CdramaList. La app no puede leer ni modificar el resto de archivos de tu Google Drive. Si quieres revocar el acceso, hazlo desde [la configuración de tu cuenta de Google](https://myaccount.google.com/permissions).

## Stack

- **React 19** + **TypeScript**
- **Zustand** (estado global y persistencia local)
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

```text
src/
├── app/                 # composición raíz, navegación y tipos de aplicación
├── features/
│   ├── discovery/       # model/ (API, playlists, ranking, IA semántica), types.ts
│   ├── library/         # componentes del inicio, lista y tarjetas
│   ├── playback/        # componentes de reproducción
│   ├── series/          # components/, model/ (partes, títulos, progreso), types.ts
│   ├── settings/        # componentes de ajustes y cuenta
│   └── sync/            # hooks/, model/, types.ts para Google Drive
├── shared/              # UI, hooks y utilidades reutilizables
├── store/               # Zustand persistido y migración de localStorage
├── App.tsx               # composición de features
└── index.css             # Tailwind y tema
```

## Datos guardados

| Clave                | Contenido                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `cdramalist:zustand` | Series, partes, progreso, clave de YouTube, usuario de Google, preferencias de Drive y caché RAE |

Las claves anteriores de series, configuración y caché se migran automáticamente a `cdramalist:zustand`. El token de acceso de Drive se guarda temporalmente en `sessionStorage` (`cdramalist:driveToken`) para que la sincronización siga activa al recargar la página. Caduca en aproximadamente una hora; después hay que pulsar **Reconectar Google Drive**. Nunca se guarda de forma permanente.

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
3. En **Settings → Secrets and variables → Actions**, crea `VITE_GOOGLE_CLIENT_ID` como variable. Si usas la similitud semántica, añade también `VITE_SEMANTIC_API_URL` como variable con la URL del Worker. Es una URL pública, no una credencial: la clave de Cloudflare permanece en el Worker.
4. Ve a la pestaña **Actions** y espera a que termine el workflow **Deploy to GitHub Pages**.
5. La app quedará disponible en:

```~~txt~~
https://TU_USUARIO.github.io/cdramaList/
```

La ruta base se detecta automáticamente en GitHub Actions a partir del nombre del repositorio (`/cdramaList/`), por lo que no hace falta cambiar `vite.config.ts`. En local se sigue usando `/`.

También puedes desplegar la carpeta `dist/` en cualquier otro hosting estático con HTTPS (Netlify, Vercel, Cloudflare Pages…).
