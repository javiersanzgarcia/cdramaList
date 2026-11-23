const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const MAX_ENTRIES = 25
const MAX_TEXT_LENGTH = 1200
const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const requestWindows = new Map()
const CATEGORIES = ['genres', 'tropes', 'roles', 'settings', 'plotElements']
const ORIGIN_COUNTRIES = ['CN', 'KR', 'JP', 'TH', 'TR', 'PH', 'TW', 'other', 'unknown']
const DEFAULT_ORIGIN_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const ORIGIN_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          originCountry: { type: 'string', enum: ORIGIN_COUNTRIES }
        },
        required: ['id', 'originCountry']
      }
    }
  },
  required: ['items']
}

const FINGERPRINT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fingerprint: {
            type: 'object',
            properties: Object.fromEntries(
              CATEGORIES.map((category) => [
                category,
                {
                  type: 'array',
                  items: { type: 'string' }
                }
              ])
            ),
            required: CATEGORIES
          },
          originCountry: { type: 'string', enum: ORIGIN_COUNTRIES }
        },
        required: ['id', 'fingerprint', 'originCountry']
      }
    }
  },
  required: ['items']
}

const ORIGIN_SYSTEM_PROMPT = [
  'Classify the country of origin of each short drama-series description.',
  'Allowed values: CN (China), KR (South Korea), JP (Japan), TH (Thailand), TR (Turkey), PH (Philippines), TW (Taiwan), other, unknown.',
  'Infer it from cultural and production clues: imperial consorts, harem, xianxia, cultivation, Chinese republican era, or rural Chinese web dramas point to CN; Korean celebrity or chaebol dramas to KR; samurai or Japanese family dramas to JP; lakorn to TH; dizi to TR; Filipino family dramas to PH; Taiwanese dramas to TW.',
  'Use "unknown" when the text gives no solid clue; do not guess when evidence is contradictory. Use "other" only for a clearly identified country outside the list.',
  'Return one result for every input id, unchanged, with only the id and originCountry fields. No extra text.'
].join('\n')

const FINGERPRINT_SYSTEM_PROMPT = [
  'Create a semantic fingerprint for each short drama-series description.',
  'Return concise, reusable English snake_case tags grouped into genres, tropes, roles, settings, and plotElements. These are open categories: add relevant concepts not shown in the examples instead of omitting them.',
  'Recognize Chinese-drama concepts across languages. Examples include: roles engineer, scientist, inventor, doctor, ceo, billionaire, secretary, poor_heroine, orphan, heiress, farmer, soldier; tropes transmigration, rebirth, reincarnation, time_travel, modern_person_in_past, body_swap, revenge, contract_marriage, arranged_marriage, hidden_identity, system, raising_children; settings ancient_china, historical_china, republican_era, 1980s_china, modern_city, rural_village, workplace; plotElements twins, secret_child, family_feud, inheritance, cultivation; genres romance, fantasy, historical, comedy, mystery, crime.',
  'Only include concepts stated or strongly implied by the text. Do not invent plot details. Return at most 12 tags per category.',
  'Also return originCountry for every entry, using the same country codes as above. Use "unknown" when the text gives no solid clue.',
  'Return one result for every input id, unchanged, and no extra text.'
].join('\n')

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
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
  ].slice(0, 12)
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

// Gemini usa nombres de tipo en mayúsculas y un subconjunto de JSON Schema.
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema
  const converted = {}
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && value && typeof value === 'object') {
      converted.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, toGeminiSchema(child)])
      )
    } else if (key === 'items') {
      converted.items = toGeminiSchema(value)
    } else if (key === 'type' && typeof value === 'string') {
      converted.type = value.toUpperCase()
    } else {
      converted[key] = value
    }
  }
  return converted
}

async function runGemini(env, { system, entries, schema, maxTokens }) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(entries) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(schema)
        }
      })
    }
  )
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    throw new Error(`Gemini respondió ${response.status}: ${detail}`)
  }
  const body = await response.json()
  const text = (body?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('')
  if (!text) throw new Error('Gemini no devolvió ningún resultado.')
  return JSON.parse(text)
}

async function runWorkersAi({ env, system, entries, schema, maxTokens, originOnly }) {
  const model = originOnly ? env.ORIGIN_MODEL || DEFAULT_ORIGIN_MODEL : env.AI_MODEL || MODEL
  const output = await env.AI.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(entries) }
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    max_tokens: maxTokens,
    temperature: 0
  })
  return parseInferenceOutput(output)
}

async function runInference(options) {
  const { env, originOnly } = options
  if (originOnly && env.GEMINI_API_KEY) {
    try {
      return await runWorkersAi(options)
    } catch {
      // Cuota diaria agotada, modelo no disponible o timeout: se usa el respaldo.
      return await runGemini(env, options)
    }
  }
  return await runWorkersAi(options)
}

function parseInferenceOutput(output) {
  const resultText =
    typeof output?.response === 'string'
      ? output.response
      : JSON.stringify(output?.response ?? output)
  return JSON.parse(resultText)
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
  const schema = originOnly ? ORIGIN_SCHEMA : FINGERPRINT_SCHEMA
  const system = originOnly ? ORIGIN_SYSTEM_PROMPT : FINGERPRINT_SYSTEM_PROMPT
  const maxTokens = originOnly ? 512 : 3072

  try {
    const parsed = await runInference({
      env,
      system,
      entries,
      schema,
      maxTokens,
      originOnly
    })
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
