const MAX_ENTRIES = 25
const MAX_TEXT_LENGTH = 900
const MAX_TAGS_PER_CATEGORY = 8
const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const requestWindows = new Map()
const CATEGORIES = ['genres', 'tropes', 'roles', 'settings', 'plotElements']
const ORIGIN_COUNTRIES = ['CN', 'KR', 'JP', 'TH', 'TR', 'PH', 'TW', 'other', 'unknown']
// Cloudflare retira modelos con poco aviso (error 5028). Se prueban en orden.
// El primero es económico y NO razona: los modelos de razonamiento (glm-4.7,
// gemma-4) agotan los 2048 tokens de salida antes de escribir el JSON y dejan
// `content: null`. El modelo grande queda solo como red de seguridad.
const DEFAULT_MODELS = [
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
]
// Respaldo gratuito: cualquier API compatible con /chat/completions de OpenAI.
const DEFAULT_FALLBACK_BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_FALLBACK_MODEL = 'openai/gpt-oss-120b'

const ORIGIN_SYSTEM_PROMPT = [
  'Classify the country of origin of each short drama-series description.',
  'Allowed values: CN (China), KR (South Korea), JP (Japan), TH (Thailand), TR (Turkey), PH (Philippines), TW (Taiwan), other, unknown.',
  'Infer it from cultural and production clues: imperial consorts, harem, xianxia, cultivation, Chinese republican era, or rural Chinese web dramas point to CN; Korean celebrity or chaebol dramas to KR; samurai or Japanese family dramas to JP; lakorn to TH; dizi to TR; Filipino family dramas to PH; Taiwanese dramas to TW.',
  'Use "unknown" when the text gives no solid clue; do not guess when evidence is contradictory. Use "other" only for a clearly identified country outside the list.',
  'Return one result for every input id, unchanged, with only the id and originCountry fields.',
  'Answer with a single JSON object: {"items":[{"id":"...","originCountry":"CN"}]}. No extra text.'
].join('\n')

const FINGERPRINT_SYSTEM_PROMPT = [
  'Create a semantic fingerprint for each short drama-series description.',
  'Return concise, reusable English snake_case tags grouped into genres, tropes, roles, settings, and plotElements. These are open categories: add relevant concepts not shown in the examples instead of omitting them.',
  'Recognize Chinese-drama concepts across languages. Examples include: roles engineer, scientist, inventor, doctor, ceo, billionaire, secretary, poor_heroine, orphan, heiress, farmer, soldier; tropes transmigration, rebirth, reincarnation, time_travel, modern_person_in_past, body_swap, revenge, contract_marriage, arranged_marriage, hidden_identity, system, raising_children; settings ancient_china, historical_china, republican_era, 1980s_china, modern_city, rural_village, workplace; plotElements twins, secret_child, family_feud, inheritance, cultivation; genres romance, fantasy, historical, comedy, mystery, crime.',
  'Only include concepts stated or strongly implied by the text. Do not invent plot details. Return at most 8 tags per category.',
  'Also return originCountry for every entry, using the same country codes as above. Use "unknown" when the text gives no solid clue.',
  'Return one result for every input id, unchanged.',
  'Answer with a single JSON object: {"items":[{"id":"...","fingerprint":{"genres":[],"tropes":[],"roles":[],"settings":[],"plotElements":[]},"originCountry":"CN"}]}. No extra text.'
].join('\n')

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/** Lista de modelos en orden de preferencia; admite el antiguo `*_MODEL`. */
function modelList(configured, defaults) {
  const models = (configured ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
  return models.length > 0 ? models : defaults
}

function jsonResponse(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    headers['Vary'] = 'Origin'
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((tag) => typeof tag === 'string')
        .map((tag) =>
          tag
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40)
        )
        .filter((tag) => tag.length >= 2)
    )
  ].slice(0, MAX_TAGS_PER_CATEGORY)
}

function isRateLimited(ip) {
  const now = Date.now()
  const current = requestWindows.get(ip)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(ip, { startedAt: now, count: 1 })
    return false
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return true
  current.count += 1
  return false
}

function safeEntries(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ENTRIES) {
    return null
  }

  const entries = []
  const ids = new Set()
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') {
      return null
    }
    const id = item.id.slice(0, 80)
    if (!id || ids.has(id)) return null
    ids.add(id)
    entries.push({
      id,
      text: item.text.slice(0, MAX_TEXT_LENGTH),
      originOnly: item.originOnly === true
    })
  }
  // Mezclar los dos modos en una misma petición complicaría el esquema de salida.
  const originOnly = entries[0].originOnly
  if (entries.some((entry) => entry.originOnly !== originOnly)) return null
  return entries
}

function normalizeResults(value, ids, originOnly) {
  if (!value || !Array.isArray(value.items)) return null
  const expected = new Set(ids)
  const results = []

  for (const item of value.items) {
    if (!item || typeof item.id !== 'string' || !expected.has(item.id)) continue
    const originCountry = ORIGIN_COUNTRIES.includes(item.originCountry)
      ? item.originCountry
      : 'unknown'
    if (originOnly) {
      results.push({ id: item.id, originCountry })
      continue
    }
    const fingerprint = {}
    for (const category of CATEGORIES) {
      fingerprint[category] = normalizeTags(item.fingerprint?.[category])
    }
    results.push({ id: item.id, fingerprint, originCountry })
  }
  return results.length > 0 ? results : null
}

/**
 * Algunos modelos rodean el JSON con cercas markdown o texto introductorio,
 * tanto en Workers AI como en los proveedores compatibles con OpenAI.
 */
function parseJsonLoose(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('El modelo no devolvió un objeto JSON.')
  }
  return JSON.parse(text.slice(start, end + 1))
}

async function runFallback(env, { system, entries, maxTokens }) {
  const base = (env.FALLBACK_API_BASE || DEFAULT_FALLBACK_BASE).replace(/\/+$/, '')
  const model = env.FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(entries) }
  ]
  const send = (structured) =>
    fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FALLBACK_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        // Los modelos de razonamiento de Groq consumen tokens antes de escribir
        // el JSON: con 10 entradas, 2048 no bastan y `content` queda vacío.
        max_tokens: Math.max(maxTokens, 8192),
        ...(structured ? { response_format: { type: 'json_object' } } : {})
      })
    })

  let response = await send(true)
  // Algunos modelos gratuitos rechazan `response_format`; se reintenta sin él
  // y el prompt ya pide explícitamente JSON sin texto adicional.
  if (response.status === 400) {
    await response.body?.cancel()
    response = await send(false)
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    throw new Error(`Respaldo (${response.status}): ${detail}`)
  }
  const body = await response.json()
  return parseJsonLoose(body?.choices?.[0]?.message?.content)
}

async function runWorkersAi({ env, system, entries, maxTokens, originOnly }) {
  const models = modelList(
    originOnly ? (env.ORIGIN_MODELS ?? env.ORIGIN_MODEL) : (env.AI_MODELS ?? env.AI_MODEL),
    DEFAULT_MODELS
  )
  const request = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(entries) }
    ],
    max_tokens: maxTokens,
    temperature: 0
  }
  // Los modelos económicos no siempre aceptan JSON Mode: el prompt pide un
  // objeto JSON y `parseJsonLoose` tolera cercas markdown y texto introductorio.

  let lastError
  for (const model of models) {
    try {
      const output = await env.AI.run(model, request)
      return parseInferenceOutput(output)
    } catch (cause) {
      lastError = cause
      console.warn(
        `Modelo ${model} no disponible; se prueba el siguiente.`,
        cause instanceof Error ? cause.message : cause
      )
    }
  }
  throw lastError
}

async function runInference(options) {
  const { env } = options
  // Cloudflare + caché siguen siendo la vía principal. El respaldo externo
  // cubre tanto peticiones de país como de fingerprints cuando se agota la
  // cuota (4006), se retira un modelo (5028) o hay un timeout.
  if (env.FALLBACK_API_KEY) {
    try {
      return await runWorkersAi(options)
    } catch (cause) {
      console.warn(
        'Workers AI falló; usando respaldo:',
        cause instanceof Error ? cause.message : cause
      )
      return await runFallback(env, options)
    }
  }
  return await runWorkersAi(options)
}

function parseInferenceOutput(output) {
  const message = output?.choices?.[0]?.message
  // Los modelos de razonamiento pueden dejar `content` vacío y poner la
  // respuesta final en `reasoning`. Se prueban todas las ubicaciones y solo se
  // acepta un objeto con `items`: una salida truncada debe provocar el siguiente
  // modelo, no un 502 con "resultado no válido".
  const candidates = [output?.response, message?.content, message?.reasoning, output?.output]
  let lastError
  for (const candidate of candidates) {
    if (candidate == null) continue
    try {
      const parsed = parseJsonLoose(candidate)
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) return parsed
    } catch (cause) {
      lastError = cause
    }
  }
  throw lastError ?? new Error('El modelo no devolvió un JSON con resultados.')
}

async function handleFingerprint(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin'
      }
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, origin)
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (isRateLimited(ip)) {
    return jsonResponse(
      {
        error: 'Límite temporal de solicitudes alcanzado. Inténtalo más tarde.'
      },
      429,
      origin
    )
  }

  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (length > 50_000) {
    return jsonResponse({ error: 'La solicitud es demasiado grande.' }, 413, origin)
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'El cuerpo debe ser JSON válido.' }, 400, origin)
  }

  const entries = safeEntries(payload?.entries)
  if (!entries) {
    return jsonResponse({ error: 'La lista de textos no es válida.' }, 400, origin)
  }

  const originOnly = entries[0].originOnly
  const system = originOnly ? ORIGIN_SYSTEM_PROMPT : FINGERPRINT_SYSTEM_PROMPT
  const maxTokens = originOnly ? 1024 : 2048

  try {
    const parsed = await runInference({ env, system, entries, maxTokens, originOnly })
    const results = normalizeResults(
      parsed,
      entries.map((entry) => entry.id),
      originOnly
    )
    if (!results) {
      return jsonResponse(
        { error: 'Los servicios de IA no devolvieron un resultado válido.' },
        502,
        origin
      )
    }
    return jsonResponse({ items: results }, 200, origin)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error desconocido al consultar los servicios de IA.'
    return jsonResponse({ error: message.slice(0, 300) }, 502, origin)
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const origins = allowedOrigins(env)

    if (!origin || !origins.includes(origin)) {
      return jsonResponse({ error: 'Origen no permitido.' }, 403, null)
    }

    const url = new URL(request.url)
    if (url.pathname !== '/api/semantic-fingerprint') {
      return jsonResponse({ error: 'Ruta no encontrada.' }, 404, origin)
    }

    return handleFingerprint(request, env, origin)
  }
}
