# Worker semántico de CdramaList

Worker de Cloudflare que genera fingerprints semánticos con **Workers AI** para
la PWA de CdramaList. La PWA envía títulos y descripciones; el Worker devuelve
etiquetas agrupadas en `genres`, `tropes`, `roles`, `settings` y `plotElements`.

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
ALLOWED_ORIGINS = "https://javiersanzgarcia.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
```

- `AI_MODEL`: modelo de Workers AI. Debe soportar JSON Mode.
- `ALLOWED_ORIGINS`: orígenes permitidos, separados por comas. Si usas otro
  dominio o el puerto de vista previa (`http://localhost:4173`), añádelo.

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
  "entries": [
    { "id": "video-id", "text": "Título y descripción del drama" }
  ]
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
      }
    }
  ]
}
```

## Límites y seguridad

- Máximo 25 entradas por petición y 1200 caracteres por texto.
- Máximo 8 peticiones por IP cada 60 segundos (mejor esfuerzo por isolate).
- Solo se aceptan peticiones de los orígenes de `ALLOWED_ORIGINS`.
- Si Workers AI no puede cumplir el esquema JSON, el Worker devuelve `502` y la
  PWA continúa con la búsqueda habitual.

## Desarrollo local

```bash
cd cloudflare/semantic-worker
npx wrangler dev
```

El endpoint local es `http://localhost:8787/api/semantic-fingerprint`. Añade
`http://localhost:5173` a `ALLOWED_ORIGINS` y configura esa URL en el `.env` de
la PWA si quieres probar el flujo completo.
