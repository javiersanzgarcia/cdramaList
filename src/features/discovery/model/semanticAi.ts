import type { SemanticFingerprint } from '../../series/types'

export interface FingerprintInput {
  id: string
  text: string
}

interface SemanticResponse {
  items?: unknown
  error?: unknown
}

const REQUEST_TIMEOUT_MS = 60_000
const MAX_TEXT_LENGTH = 1200
// El Worker acepta como máximo 25 entradas por petición, pero con lotes
// pequeños responde mucho antes. Se envían varios lotes en paralelo para
// cubrir una ventana amplia de re-subidas sin alargar la actualización.
const MAX_ENTRIES_PER_REQUEST = 10

const FINGERPRINT_CATEGORIES: Array<keyof SemanticFingerprint> = [
  'genres',
  'tropes',
  'roles',
  'settings',
  'plotElements'
]

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
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

export function normalizeSemanticFingerprint(
  value: unknown
): SemanticFingerprint | undefined {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const fingerprint = Object.fromEntries(
    FINGERPRINT_CATEGORIES.map((category) => [
      category,
      normalizeTags(record[category])
    ])
  ) as unknown as SemanticFingerprint

  const valid = FINGERPRINT_CATEGORIES.some((category) =>
    Array.isArray(record[category])
  )

  return valid ? fingerprint : undefined
}

function retryDelay(response: Response): number {
  const retryAfter = Number(response.headers.get('Retry-After'))
  return Number.isFinite(retryAfter) && retryAfter >= 0
    ? Math.min(retryAfter * 1000, 5000)
    : 1000
}

function errorMessage(body: SemanticResponse, status: number): string {
  if (typeof body.error === 'string' && body.error.trim()) {
    return body.error.trim().slice(0, 240)
  }
  return `El servicio semántico respondió con código ${status}.`
}

async function requestFingerprints(
  endpoint: string,
  entries: FingerprintInput[],
  timeoutMs: number
): Promise<{ response: Response; body: SemanticResponse }> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: entries.map((entry) => ({
          id: entry.id,
          text: entry.text.slice(0, MAX_TEXT_LENGTH)
        }))
      }),
      signal: controller.signal
    })
    const body = (await response.json().catch(() => ({}))) as SemanticResponse
    return { response, body }
  } catch (cause) {
    if (timedOut) {
      throw new Error(
        'El servicio semántico agotó el tiempo máximo de respuesta de 60 segundos.'
      )
    }
    throw cause
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Pide al Worker de Cloudflare los fingerprints semánticos de una lista de
 * textos. El Worker enlaza Workers AI, así que la PWA nunca incluye una clave
 * de proveedor: solo conoce la URL pública del endpoint.
 *
 * Si hay más entradas de las que admite una petición, se envían en varios
 * lotes. Un lote que falle no invalida los fingerprints ya obtenidos: la
 * búsqueda léxica y los candidatos del resto de lotes siguen funcionando.
 */
export async function generateSemanticFingerprints(
  endpoint: string,
  entries: FingerprintInput[]
): Promise<Map<string, SemanticFingerprint>> {
  const url = endpoint.trim()
  if (!url || entries.length === 0) return new Map()

  const deadline = Date.now() + REQUEST_TIMEOUT_MS
  const chunks: FingerprintInput[][] = []
  for (
    let index = 0;
    index < entries.length;
    index += MAX_ENTRIES_PER_REQUEST
  ) {
    chunks.push(entries.slice(index, index + MAX_ENTRIES_PER_REQUEST))
  }

  const settled = await Promise.allSettled(
    chunks.map((chunk) => requestFingerprintChunk(url, chunk, deadline))
  )

  const results = new Map<string, SemanticFingerprint>()
  let firstError: unknown
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      firstError ??= outcome.reason
      continue
    }
    for (const [id, fingerprint] of outcome.value) {
      results.set(id, fingerprint)
    }
  }

  if (results.size === 0) {
    throw firstError instanceof Error
      ? firstError
      : new Error('El servicio semántico no devolvió fingerprints válidos.')
  }

  return results
}

async function requestFingerprintChunk(
  url: string,
  entries: FingerprintInput[],
  deadline: number
): Promise<Map<string, SemanticFingerprint>> {
  const request = () =>
    requestFingerprints(url, entries, Math.max(1, deadline - Date.now()))

  let result = await request()
  if (result.response.status === 429 || result.response.status === 503) {
    const waitMs = Math.min(
      retryDelay(result.response),
      Math.max(0, deadline - Date.now())
    )
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    if (Date.now() >= deadline) {
      throw new Error(
        'El servicio semántico agotó el tiempo máximo de respuesta de 60 segundos.'
      )
    }
    result = await request()
  }

  const { response, body } = result
  if (!response.ok) {
    throw new Error(errorMessage(body, response.status))
  }

  if (!Array.isArray(body.items)) {
    throw new Error('El servicio semántico devolvió un formato no válido.')
  }

  const results = new Map<string, SemanticFingerprint>()
  for (const item of body.items) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string') continue

    const fingerprint = normalizeSemanticFingerprint(record.fingerprint)
    if (fingerprint) results.set(record.id, fingerprint)
  }

  if (results.size === 0) {
    throw new Error('El servicio semántico no devolvió fingerprints válidos.')
  }

  return results
}

export function semanticSimilarity(
  first?: SemanticFingerprint,
  second?: SemanticFingerprint
): number {
  if (!first || !second) return 0

  let shared = 0
  let union = 0

  for (const category of FINGERPRINT_CATEGORIES) {
    const firstTags = new Set(first[category])
    const secondTags = new Set(second[category])

    for (const tag of firstTags) {
      if (secondTags.has(tag)) shared += 1
      union += 1
    }
    for (const tag of secondTags) {
      if (!firstTags.has(tag)) union += 1
    }
  }

  return shared >= 2 && union > 0 ? shared / union : 0
}
