import { normalizeText } from '../../series/model/parts'
import { isStopword } from '../../series/model/titleMatching'
import { useAppStore } from '../../../store/appStore'
import type { SynonymCacheEntry } from '../types'
import {
  SYNONYM_CACHE_TTL,
  SYNONYM_MAX_PER_SENSE,
  SYNONYM_MAX_PER_WORD,
  SYNONYM_MAX_QUERY_LENGTH,
  SYNONYM_MAX_QUERY_VARIANTS,
  SYNONYM_MAX_WORDS,
  SYNONYM_NOT_FOUND_TTL,
  SYNONYM_REQUEST_TIMEOUT_MS
} from './constants'

const BLOCKED_LABEL =
  /coloquial|despectiv|regional|poco usado|vulgar|malsonante/i

interface ApiSynonym {
  word?: string
  kind?: string
  label?: string
}

interface ApiSense {
  category?: string
  synonyms?: string[]
  synonyms_v2?: ApiSynonym[]
}

interface ApiMeaning {
  senses?: ApiSense[]
}

interface ApiResponse {
  data?: {
    meanings?: ApiMeaning[]
  }
}

type SynonymCache = Record<string, SynonymCacheEntry>

let memoryCache: SynonymCache | null = null
let blockedUntil = 0

function pruneCache(cache: SynonymCache) {
  const now = Date.now()
  for (const [key, entry] of Object.entries(cache)) {
    const ttl = entry.notFound ? SYNONYM_NOT_FOUND_TTL : SYNONYM_CACHE_TTL
    if (now - entry.at > ttl) delete cache[key]
  }
}

function readCache(): SynonymCache {
  if (memoryCache) return memoryCache

  memoryCache = useAppStore.getState().synonymCache
  return memoryCache
}

function writeCache(cache: SynonymCache) {
  pruneCache(cache)
  memoryCache = cache
  useAppStore.getState().setSynonymCache(cache)
}

export function normalizeWord(value: string): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * Palabras a las que merece la pena pedir sinónimos: sin enlaces, hashtags,
 * palabras vacías ni números. Se priorizan las más largas (suelen ser las más
 * específicas del título).
 */
export function pickSynonymWords(
  value: string,
  limit = SYNONYM_MAX_WORDS
): string[] {
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')

  const words = cleaned.match(/[\p{L}]+/gu) ?? []
  const seen = new Set<string>()
  const candidates: Array<{ word: string; index: number }> = []

  for (const [index, raw] of words.entries()) {
    const word = raw.trim().toLowerCase()
    if (word.length < 3 || isStopword(word)) continue

    const key = normalizeWord(word)
    if (!key || seen.has(key)) continue

    seen.add(key)
    candidates.push({ word, index })
  }

  candidates.sort((a, b) => b.word.length - a.word.length || a.index - b.index)

  return candidates.slice(0, limit).map((entry) => entry.word)
}

/**
 * Reparte las palabras entre varios textos (primero el título real de la
 * descripción y después el resto) para no gastar consultas en palabras poco
 * relevantes.
 */
export function pickSynonymWordsFromTexts(
  texts: Array<string | undefined>,
  limit = SYNONYM_MAX_WORDS
): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const text of texts) {
    if (!text) continue

    for (const word of pickSynonymWords(text, limit)) {
      const key = normalizeWord(word)
      if (!key || seen.has(key)) continue

      seen.add(key)
      result.push(word)
      if (result.length >= limit) return result
    }
  }

  return result
}

function splitSynonym(value: string): string[] {
  return value
    .split(/[,;/]/)
    .map((part) => part.trim().toLowerCase())
    .filter(
      (part) =>
        part.length >= 3 && /^[\p{L}]+$/u.test(part) && !isStopword(part)
    )
}

function extractSynonyms(data: ApiResponse, sourceWord: string): string[] {
  const meanings = data.data?.meanings ?? []
  const senses = meanings.flatMap((meaning) => meaning.senses ?? [])
  const primaryCategory = senses.find((sense) => sense.category)?.category

  // Los adjetivos suelen devolver sinónimos demasiado genéricos («moreno»,
  // «policíaco»…) que ensucian la búsqueda. Nos quedamos con sustantivos y
  // verbos, que son los que suelen cambiar al traducir un título.
  if (primaryCategory !== 'noun' && primaryCategory !== 'verb') return []

  const matching = senses.filter((sense) => sense.category === primaryCategory)
  const candidates = matching.length > 0 ? matching : senses

  const sourceKey = normalizeWord(sourceWord)
  const seen = new Set<string>()
  const result: string[] = []

  // Los sinónimos marcados como coloquiales, regionales o vulgares no suelen
  // aparecer en los títulos traducidos y ensucian la consulta.
  const blocked = new Set<string>()
  for (const sense of candidates) {
    for (const entry of sense.synonyms_v2 ?? []) {
      if (entry.word && entry.label && BLOCKED_LABEL.test(entry.label)) {
        blocked.add(normalizeWord(entry.word))
      }
    }
  }

  for (const sense of candidates) {
    const values: string[] = []

    for (const entry of sense.synonyms_v2 ?? []) {
      if (!entry.word) continue
      if (entry.label && BLOCKED_LABEL.test(entry.label)) continue
      values.push(entry.word)
    }
    for (const value of sense.synonyms ?? []) {
      if (blocked.has(normalizeWord(value))) continue
      values.push(value)
    }

    let added = 0
    for (const value of values) {
      for (const word of splitSynonym(value)) {
        const key = normalizeWord(word)
        if (!key || key === sourceKey || seen.has(key)) continue

        seen.add(key)
        result.push(word)
        added += 1
        if (added >= SYNONYM_MAX_PER_SENSE) break
      }
      if (added >= SYNONYM_MAX_PER_SENSE) break
    }

    if (result.length >= SYNONYM_MAX_PER_WORD) break
  }

  return result.slice(0, SYNONYM_MAX_PER_WORD)
}

async function requestSynonyms(
  word: string
): Promise<SynonymCacheEntry | null> {
  // Si la API acaba de responder 429, no insistimos durante un minuto.
  if (Date.now() < blockedUntil) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNONYM_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://rae-api.com/api/words/${encodeURIComponent(word)}`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }
    )

    if (response.status === 429) {
      blockedUntil = Date.now() + 60_000
      return null
    }

    if (response.status === 404) {
      return { at: Date.now(), synonyms: [], notFound: true }
    }

    if (!response.ok) return null

    const data = (await response.json()) as ApiResponse
    return { at: Date.now(), synonyms: extractSynonyms(data, word) }
  } catch {
    // La API es un extra: si no responde, la búsqueda sigue con el título.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Busca sinónimos en la RAE con caché persistida en Zustand. Las palabras repetidas
 * no vuelven a consultarse durante 60 días y los fallos no se cachean.
 */
export async function fetchSynonyms(
  words: string[]
): Promise<Map<string, string[]>> {
  const cache = readCache()
  const wasBlocked = Date.now() < blockedUntil
  const result = new Map<string, string[]>()
  const wordByKey = new Map<string, string>()
  const missing: string[] = []

  for (const word of words) {
    const key = normalizeWord(word)
    if (!key) continue

    const entry = cache[key]
    const ttl = entry?.notFound ? SYNONYM_NOT_FOUND_TTL : SYNONYM_CACHE_TTL
    if (entry && Date.now() - entry.at < ttl) {
      result.set(key, entry.synonyms)
      continue
    }

    if (!wordByKey.has(key)) {
      wordByKey.set(key, word)
      missing.push(key)
    }
  }

  const fetched = await Promise.all(
    missing.map(async (key) => ({
      key,
      entry: await requestSynonyms(wordByKey.get(key) ?? key)
    }))
  )

  // Si todas las consultas fallaron (red caída, timeout…), no repetimos el
  // intento en cada búsqueda durante un minuto.
  if (
    !wasBlocked &&
    missing.length > 0 &&
    fetched.every(({ entry }) => entry === null)
  ) {
    blockedUntil = Date.now() + 60_000
  }

  let changed = false
  for (const { key, entry } of fetched) {
    if (!entry) continue

    cache[key] = entry
    result.set(key, entry.synonyms)
    changed = true
  }

  if (changed) writeCache(cache)
  return result
}

/**
 * Relaciona cada sinónimo con la palabra original. Se usa para que, al
 * comparar títulos, «catástrofe» y «apocalipsis» cuenten como la misma palabra.
 */
export function buildSynonymAliases(
  synonyms: Map<string, string[]>
): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const [word, list] of synonyms) {
    const canonical = normalizeWord(word)
    if (!canonical) continue

    for (const synonym of list) {
      const key = normalizeWord(synonym)
      if (!key || key === canonical) continue
      if (!aliases.has(key)) aliases.set(key, canonical)
    }
  }

  return aliases
}

/**
 * Añade variantes con sinónimos a la consulta de YouTube usando el operador
 * OR. Siempre conserva la consulta original como primera opción.
 */
export function expandQueryWithSynonyms(
  query: string,
  synonyms: Map<string, string[]>
): string {
  const words = query.split(/\s+/).filter(Boolean)
  if (words.length === 0 || synonyms.size === 0) return query

  const perWord = words.map((word) =>
    [...(synonyms.get(normalizeWord(word)) ?? [])].sort(
      (a, b) => b.length - a.length
    )
  )
  if (perWord.every((list) => list.length === 0)) return query

  const order = words
    .map((_, index) => index)
    .sort((a, b) => perWord[b].length - perWord[a].length)

  const variants: string[] = []
  const seen = new Set([query.toLowerCase()])

  // Solo variantes que cambian una palabra. Añadir demasiados OR hace que
  // YouTube pierda resultados, así que nos quedamos con las dos mejores
  // variantes (la original y una más).
  for (
    let round = 0;
    variants.length < SYNONYM_MAX_QUERY_VARIANTS - 1;
    round += 1
  ) {
    let added = false

    for (const index of order) {
      const synonym = perWord[index][round]
      if (!synonym) continue

      const variantWords = [...words]
      variantWords[index] = synonym
      const variant = variantWords.join(' ')
      const key = variant.toLowerCase()
      if (seen.has(key)) continue

      seen.add(key)
      variants.push(variant)
      added = true

      if (variants.length >= SYNONYM_MAX_QUERY_VARIANTS - 1) break
    }

    if (!added) break
  }

  let expanded = query
  for (const variant of variants) {
    const next = `${expanded} | ${variant}`
    if (next.length > SYNONYM_MAX_QUERY_LENGTH) break
    expanded = next
  }

  return expanded
}
