#!/usr/bin/env node
/**
 * Comprueba el respaldo OpenAI-compatible con la misma carga que usa el Worker.
 * No necesita Wrangler ni desplegar nada.
 *
 *   FALLBACK_API_KEY=... node scripts/check-fallback.mjs
 *   FALLBACK_API_BASE=https://openrouter.ai/api/v1 \
 *     FALLBACK_MODEL=openrouter/free \
 *     FALLBACK_API_KEY=... node scripts/check-fallback.mjs
 */

const KEY = process.env.FALLBACK_API_KEY
const BASE = (process.env.FALLBACK_API_BASE || 'https://api.groq.com/openai/v1').replace(
  /\/+$/,
  ''
)
const MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b'

if (!KEY) {
  console.error(
    'Falta FALLBACK_API_KEY. Ejecuta: FALLBACK_API_KEY=tu-clave node scripts/check-fallback.mjs'
  )
  process.exit(1)
}

const system = [
  'Classify the country of origin of each short drama-series description.',
  'Allowed values: CN (China), KR (South Korea), JP (Japan), TH (Thailand), TR (Turkey), PH (Philippines), TW (Taiwan), other, unknown.',
  'Use "unknown" when the text gives no solid clue. Return only id and originCountry as JSON. No extra text.'
].join('\n')

const payload = {
  model: MODEL,
  messages: [
    { role: 'system', content: system },
    {
      role: 'user',
      content: JSON.stringify([
        { id: 'series', text: 'Harem imperial, princesa consorte, renacimiento' }
      ])
    }
  ],
  temperature: 0,
  max_tokens: 512,
  response_format: { type: 'json_object' }
}

console.log(`Probando ${MODEL} en ${BASE} ...`)
let response
try {
  response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(payload)
  })
} catch (cause) {
  console.error('No se pudo conectar:', cause.message)
  process.exit(1)
}

const raw = await response.text()
console.log(`HTTP ${response.status}`)

if (response.ok) {
  try {
    const parsed = JSON.parse(raw)
    console.log('Respuesta:', parsed.choices?.[0]?.message?.content ?? raw.slice(0, 500))
    console.log('✅ La clave y el modelo funcionan con el formato del Worker.')
    process.exit(0)
  } catch {
    console.log('Respuesta no JSON:', raw.slice(0, 500))
    process.exit(1)
  }
}

let detail = raw
try {
  detail = JSON.parse(raw)?.error?.message ?? raw
} catch {
  // La respuesta no era JSON.
}
console.log('Error:', detail)

const hints = {
  400: 'El modelo no acepta algún parámetro. Prueba a quitar response_format o usa openai/gpt-oss-120b (Groq) / openrouter/free (OpenRouter).',
  401: 'Clave incorrecta o ausente. Cópiala tal cual desde la consola del proveedor.',
  402: 'Sin créditos disponibles. Usa un modelo gratuito (:free en OpenRouter) o recarga la cuenta.',
  403: 'La clave no tiene acceso a ese modelo o tiene un límite de gasto.',
  404: `El modelo ${MODEL} no existe en ${BASE}. Revisa el catálogo del proveedor.`,
  429: 'Cupo agotado (por minuto o por día). Espera o cambia de proveedor/modelo.'
}
console.log('Pista:', hints[response.status] ?? 'Revisa la respuesta completa anterior.')
process.exit(1)
