import type { Part } from '../types'
import { stripPartMarkers } from './parts'
import { extractKeywords } from './titleMatching'
import {
  MAX_ALIAS_LENGTH,
  MAX_KEYWORD_CONFIDENCE,
  MAX_KEYWORD_CONFIDENCE_ENTRIES,
  MAX_SERIES_ALIASES,
  MIN_ALIAS_LENGTH,
  MIN_SERIES_TITLE_LENGTH
} from './constants'

export function normalizeKeywordConfidence(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([keyword, score]) => [keyword, Number(score)] as const)
    .filter(
      ([keyword, score]) =>
        /^[\p{L}\p{N}]+$/u.test(keyword) && Number.isFinite(score) && score > 0
    )
    .map(
      ([keyword, score]) =>
        [keyword, Math.min(MAX_KEYWORD_CONFIDENCE, Math.floor(score))] as const
    )
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORD_CONFIDENCE_ENTRIES)

  return Object.fromEntries(entries)
}

export function learnKeywordConfidence(
  current: unknown,
  titles: string[]
): Record<string, number> {
  const confidence = normalizeKeywordConfidence(current)

  for (const keyword of new Set(titles.flatMap(extractKeywords))) {
    const previous = Object.hasOwn(confidence, keyword) ? confidence[keyword] : 0
    confidence[keyword] = Math.min(MAX_KEYWORD_CONFIDENCE, previous + 1)
  }

  return normalizeKeywordConfidence(confidence)
}

export function combineKeywordConfidence(
  current: unknown,
  incoming: unknown
): Record<string, number> {
  const confidence = normalizeKeywordConfidence(current)

  for (const [keyword, score] of Object.entries(normalizeKeywordConfidence(incoming))) {
    const currentScore = Object.hasOwn(confidence, keyword) ? confidence[keyword] : 0
    confidence[keyword] = Math.max(currentScore, score)
  }

  return normalizeKeywordConfidence(confidence)
}

/**
 * Limpia la lista de alias: cadenas recortadas, sin duplicados (sin distinguir
 * mayúsculas) y con un límite para no disparar la consulta de búsqueda.
 */
export function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const result: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry !== 'string') continue

    const alias = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_ALIAS_LENGTH)
    if (alias.length < MIN_ALIAS_LENGTH) continue

    const key = alias.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(alias)
    if (result.length >= MAX_SERIES_ALIASES) break
  }

  return result
}

/**
 * IDs de vídeos descartados a mano en las sugerencias de capítulos. Se guardan
 * para no volver a proponerlos en futuras actualizaciones de la serie.
 */
export function normalizeDiscardedCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return [...new Set(value.filter((id): id is string => typeof id === 'string'))]
}

/**
 * Lápidas de partes: id del vídeo y momento en que se quitó de la serie. Se
 * descartan las entradas sin marca de tiempo válida.
 */
export function normalizeRemovedParts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * Títulos base de los vídeos de YouTube, sin marcadores de parte ni emojis.
 * Sirven como alias para que una re-subida publicada con otro título siga
 * apareciendo en las búsquedas de la serie.
 */
export function youtubeTitleAliases(parts: Part[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    const title = stripPartMarkers(part.title)
      .replace(/[\s\-–—|:]*\b(?:final|fin|ending|last|[uú]ltima\s+parte)\s*$/iu, '')
      .replace(/[\s\-–—|:]+$/gu, '')
      .trim()
    if (title.length < MIN_SERIES_TITLE_LENGTH) continue

    const key = title.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(title)
  }

  return result
}

/**
 * Combina los alias actuales con los títulos reales de YouTube de los vídeos,
 * descartando los que coinciden con el título principal de la serie.
 */
export function mergeAliasesWithParts(
  current: string[] | undefined,
  parts: Part[],
  title: string
): string[] {
  const titleKey = title.trim().toLowerCase()
  const aliases = (current ?? []).filter((alias) => alias.trim().toLowerCase() !== titleKey)

  return normalizeAliases([
    // Los títulos de YouTube van primero: la búsqueda global solo lanza unas
    // pocas consultas, así que deben tener prioridad sobre alias antiguos.
    ...youtubeTitleAliases(parts).filter((alias) => alias.toLowerCase() !== titleKey),
    ...aliases
  ])
}
