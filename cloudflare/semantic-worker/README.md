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
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
ORIGIN_MODEL = "@cf/meta/llama-3.1-8b-instruct"
GEMINI_MODEL = "gemini-3.5-flash-lite"
ALLOWED_ORIGINS = "https://javiersanzgarcia.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
```

- `AI_MODEL`: modelo grande de Workers AI, solo para fingerprints. Debe soportar
  JSON Mode.
- `ORIGIN_MODEL`: modelo pequeño para clasificar el país. Soporta JSON Mode y
  consume unas **20 veces menos neurons** que Llama 3.3 70B (~4–20 neurons por
  llamada frente a ~80–155).
- `GEMINI_MODEL`: modelo de respaldo. `gemini-3.5-flash-lite` suele tener un
  cupo gratuito más amplio que Flash; consulta el cupo real de tu proyecto en
  Google AI Studio.
- `ALLOWED_ORIGINS`: orígenes permitidos, separados por comas. Si usas otro
  dominio o el puerto de vista previa (`http://localhost:4173`), añádelo.

### Respaldo gratuito con Gemini (opcional)

Cuando Workers AI agota su asignación diaria de 10 000 neurons (error `4006`),
el Worker puede clasificar el país con Gemini sin cambiar la URL de la PWA.
La clave se guarda como **secreto del Worker**, nunca en el bundle:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Si el secreto no existe, no pasa nada: la PWA sigue mostrando _Desconocido_
cuando Cloudflare no puede responder. El respaldo solo se usa en las peticiones
`originOnly`, no en las de fingerprints.

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

- Máximo 25 entradas por petición y 1200 caracteres por texto.
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
