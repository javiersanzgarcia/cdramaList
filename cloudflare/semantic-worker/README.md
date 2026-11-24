# Worker semántico de CdramaList

Worker de Cloudflare que genera fingerprints semánticos con **Workers AI** para
la PWA de CdramaList. La PWA envía títulos y descripciones; el Worker devuelve
etiquetas agrupadas en `genres`, `tropes`, `roles`, `settings` y `plotElements`,
además del **país de origen inferido** (`originCountry`) cuando el texto aporta
pistas culturales.

La credencial de Cloudflare no sale del Worker: el frontend solo conoce la URL
pública del endpoint. No hay ninguna clave de proveedor en el bundle de la PWA.

## Requisitos

- Cuenta de Cloudflare con Workers AI habilitado.
- Wrangler (se ejecuta con `npx wrangler`, no hace falta instalarlo globalmente).

## Configuración

Revisa `wrangler.toml` antes de desplegar:

```toml
name = "cdramalist-semantic-ai"
main = "src/index.js"
compatibility_date = "2026-11-10"

[ai]
binding = "AI"

[vars]
AI_MODELS = "@cf/mistralai/mistral-small-3.1-24b-instruct,@cf/meta/llama-3.3-70b-instruct-fp8-fast"
ORIGIN_MODELS = "@cf/mistralai/mistral-small-3.1-24b-instruct,@cf/meta/llama-3.3-70b-instruct-fp8-fast"
FALLBACK_API_BASE = "https://api.groq.com/openai/v1"
FALLBACK_MODEL = "openai/gpt-oss-120b"
ALLOWED_ORIGINS = "https://javiersanzgarcia.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
```

- `AI_MODELS`: modelos para fingerprints, **en orden de preferencia**. El
  primero (`mistral-small-3.1-24b-instruct`) es económico y **no razona**: con
  10 entradas responde en ~15 s, dentro del timeout de 60 s de la PWA. El
  modelo grande de 70B queda solo como red de seguridad. No se usan
  `glm-4.7-flash` ni `gemma-4-26b-a4b-it`: son modelos de razonamiento y, con
  el límite de 2048 tokens de salida, se quedan en su cadena de pensamiento y
  dejan `content: null` sin llegar a escribir el JSON. Ya no se exige JSON
  Mode: el prompt pide un objeto JSON y el Worker tolera cercas markdown o
  texto introductorio. Se acepta también `AI_MODEL` con un solo modelo, por
  compatibilidad con versiones anteriores.
- `ORIGIN_MODELS`: modelos para clasificar el país, **en orden de preferencia**.
  Si Cloudflare retira uno (error `5028`) o falla, se prueba el siguiente. Se
  acepta también `ORIGIN_MODEL` con un solo modelo, por compatibilidad con
  versiones anteriores.
- `FALLBACK_API_BASE` y `FALLBACK_MODEL`: proveedor externo opcional compatible
  con la API de OpenAI. Por defecto Groq; también funciona con OpenRouter.
- `ALLOWED_ORIGINS`: orígenes permitidos, separados por comas. Si usas otro
  dominio o el puerto de vista previa (`http://localhost:4173`), añádelo.

### Respaldo gratuito con Groq u OpenRouter (opcional)

Cuando Workers AI agota su asignación diaria de 10 000 neurons (error `4006`)
o ninguno de los modelos configurados está disponible, el Worker puede pedir
el país o los fingerprints a otro proveedor **sin cambiar la URL de la PWA** y
sin depender de Google AI Studio. La clave se guarda como **secreto del
Worker**, nunca en el bundle:

```bash
npx wrangler secret put FALLBACK_API_KEY
```

Con los valores por defecto se usa Groq (plan gratuito: 30 peticiones/min y
1 000/día; clave en [console.groq.com/keys](https://console.groq.com/keys)).
Para usar OpenRouter en su lugar, cambia las variables en `wrangler.toml` y
vuelve a desplegar:

```toml
FALLBACK_API_BASE = "https://openrouter.ai/api/v1"
FALLBACK_MODEL = "openrouter/free"
```

La clave de OpenRouter se crea en
[openrouter.ai/settings/keys](https://openrouter.ai/settings/keys); el router
`openrouter/free` elige entre los modelos gratuitos (50 peticiones/día sin
créditos comprados, 1 000/día a partir de 10 créditos).

Si el secreto no existe, no pasa nada: la PWA sigue mostrando _Desconocido_
cuando Cloudflare no puede responder y continúa con la búsqueda léxica si falla
un fingerprint. El respaldo se usa tanto en las peticiones `originOnly` como en
las de fingerprints, siempre después de intentar los modelos de Cloudflare.

Los modelos disponibles en el plan gratuito de Groq (`openai/gpt-oss-120b`,
`openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) también razonan. El Worker pide
**8192 tokens** de salida al proveedor externo para que puedan terminar el JSON
antes de responder; con 2048 se quedaban a medias y devolvían `content: null`.

### Diagnosticar el respaldo

Para ver el error exacto sin desplegar nada:

```bash
FALLBACK_API_KEY=tu-clave node scripts/check-fallback.mjs
# con OpenRouter
FALLBACK_API_BASE=https://openrouter.ai/api/v1 FALLBACK_MODEL=openrouter/free \
  FALLBACK_API_KEY=tu-clave node scripts/check-fallback.mjs
```

El script usa la misma carga que el Worker. Errores típicos:

- **`401`**: clave incorrecta o copiada con espacios.
- **`402` / `403`**: sin créditos o sin acceso a ese modelo. Comprueba el modelo
  gratuito del proveedor.
- **`404`**: el modelo ya no existe; consulta el catálogo del proveedor.
- **`429`**: cupo por minuto o por día agotado.
- **CORS en el navegador**: no aplica. La llama el Worker, no la PWA.

## Desplegar

```bash
cd cloudflare/semantic-worker
npx wrangler login
npx wrangler deploy
```

Wrangler mostrará la URL del Worker. El endpoint es:

```text
https://<nombre-del-worker>.<tu-subdominio>.workers.dev/api/semantic-fingerprint
```

Copia esa URL en `VITE_SEMANTIC_API_URL` (`.env` en local y variable del
repositorio en GitHub Actions).

## Contrato

`POST /api/semantic-fingerprint`

```json
{
  "entries": [{ "id": "video-id", "text": "Título y descripción del drama" }]
}
```

Respuesta:

```json
{
  "items": [
    {
      "id": "video-id",
      "fingerprint": {
        "genres": ["romance", "fantasy"],
        "tropes": ["rebirth", "revenge"],
        "roles": ["ceo", "secretary"],
        "settings": ["modern_city"],
        "plotElements": ["secret_child"]
      },
      "originCountry": "CN"
    }
  ]
}
```

### Solo país (modo `originOnly`)

Para ahorrar neurons, la PWA puede pedir únicamente el país cuando ya tiene la
huella semántica guardada:

```json
{
  "entries": [{ "id": "series", "text": "Título y etiquetas", "originOnly": true }]
}
```

Respuesta:

```json
{
  "items": [{ "id": "series", "originCountry": "CN" }]
}
```

No se pueden mezclar entradas `originOnly` y normales en la misma petición. La
PWA además guarda el resultado en `localStorage`: si el texto no cambia, no
vuelve a consultar al Worker (ni siquiera cuando la respuesta fue `unknown`).

`originCountry` usa los mismos códigos que la PWA: `CN` (China), `KR` (Corea
del Sur), `JP` (Japón), `TH` (Tailandia), `TR` (Turquía), `PH` (Filipinas),
`TW` (Taiwán), `other` y `unknown`. El modelo debe devolver `unknown` cuando no
haya una pista fiable. La PWA solo aplica este valor si la detección por texto
de los metadatos de YouTube no ha encontrado ningún país y el usuario no ha
fijado el país a mano.

> **Importante:** tras cambiar el Worker hay que volver a desplegarlo
> (`npx wrangler deploy`) y recargar la PWA. Mientras el Worker desplegado sea
> una versión anterior, no devolverá `originCountry` y la PWA seguirá mostrando
> _Desconocido_ en las series sin pistas en sus metadatos.

## Límites y seguridad

- Máximo 25 entradas por petición, 900 caracteres por texto y 8 etiquetas por
  categoría (la PWA envía como máximo 10 entradas por petición).
- Máximo 8 peticiones por IP cada 60 segundos (mejor esfuerzo por isolate).
- Solo se aceptan peticiones de los orígenes de `ALLOWED_ORIGINS`.
- Si ningún servicio de IA puede cumplir el esquema JSON (o se agotan ambos
  cupos), el Worker devuelve `502` y la PWA continúa con la búsqueda léxica.
- La cuota de Workers AI se reinicia a las **00:00 UTC**; no hay peticiones
  sobrantes ni coste oculto en el plan gratuito.

## Desarrollo local

```bash
cd cloudflare/semantic-worker
npx wrangler dev
```

El endpoint local es `http://localhost:8787/api/semantic-fingerprint`. Añade
`http://localhost:5173` a `ALLOWED_ORIGINS` y configura esa URL en el `.env` de
la PWA si quieres probar el flujo completo.
