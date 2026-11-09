import type { Part } from '../types'

const PART_KEYWORD =
  /\b(?:parte|part|episodio|cap[ií]tulo|cap|p)\s*[#.:-]?\s*(\d{1,3})(?:\s*(?:de|\/)\s*(\d{1,3}))?/i
const PART_KEYWORD_GLOBAL = new RegExp(PART_KEYWORD.source, 'gi')
const FRACTION_GLOBAL = /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/g
const OF_GLOBAL = /\b(\d{1,3})\s*(?:de|of)\s*(\d{1,3})\b/gi
const PAREN_GLOBAL = /\(\s*(\d{1,3})\s*\)/g
const HASH_GLOBAL = /#\s*(\d{1,3})\b/g

const FINAL_WORD = /\b(?:final|fin|ending|last)\b/i
const FRACTION = /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/
const OF = /\b(\d{1,3})\s*(?:de|of)\s*(\d{1,3})\b/i
const PAREN = /\(\s*(\d{1,3})\s*\)/
const HASH = /#\s*(\d{1,3})\b/

const STOPWORDS = new Set([
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'durante',
  'e',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'es',
  'esa',
  'ese',
  'eso',
  'esta',
  'este',
  'esto',
  'estos',
  'fue',
  'ha',
  'hasta',
  'hay',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mis',
  'mucho',
  'muy',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'pero',
  'por',
  'porque',
  'que',
  'se',
  'sin',
  'sobre',
  'su',
  'sus',
  'te',
  'tiene',
  'todo',
  'tu',
  'tus',
  'un',
  'una',
  'uno',
  'unos',
  'unas',
  'y',
  'ya',
  'the',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'without',
  'that',
  'this',
  'is',
  'are',
  'was',
  'were',
  'as',
  'at',
  'by',
  'from',
  'it',
  'its',
  'his',
  'her',
  'their',
  'our',
  'your',
  'my',
  'be',
  'been',
  'has',
  'have',
  'had',
  'will',
  'would',
  'can',
  'could',
  'not',
  'full',
  'part',
  'parte',
  'video',
  'youtube',
  'canal',
  'hd',
  '4k',
  'espanol',
  'latino',
  'castellano',
  'subtitulado',
  'sub',
  'audio',
  'nuevo',
  'nueva',
  'version',
  'completo',
  'completa',
  'final',
])

export interface PartInfo {
  partNumber?: number
  totalParts?: number
  isFinal: boolean
}

export function detectPart(title: string): PartInfo {
  const keyword = PART_KEYWORD.exec(title)
  if (keyword) {
    return {
      partNumber: Number(keyword[1]),
      totalParts: keyword[2] ? Number(keyword[2]) : undefined,
      isFinal: false,
    }
  }

  const fraction = FRACTION.exec(title)
  if (fraction) {
    return {
      partNumber: Number(fraction[1]),
      totalParts: Number(fraction[2]),
      isFinal: false,
    }
  }

  const of = OF.exec(title)
  if (of) {
    return {
      partNumber: Number(of[1]),
      totalParts: Number(of[2]),
      isFinal: false,
    }
  }

  const paren = PAREN.exec(title)
  if (paren) {
    return { partNumber: Number(paren[1]), isFinal: false }
  }

  const hash = HASH.exec(title)
  if (hash) {
    return { partNumber: Number(hash[1]), isFinal: false }
  }

  return { isFinal: FINAL_WORD.test(title) }
}

export function stripPartMarkers(title: string): string {
  const cleaned = title
    .replace(PART_KEYWORD_GLOBAL, ' ')
    .replace(FRACTION_GLOBAL, ' ')
    .replace(OF_GLOBAL, ' ')
    .replace(PAREN_GLOBAL, ' ')
    .replace(HASH_GLOBAL, ' ')
    .replace(/[\s\-–—|:·•,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return cleaned || title.trim()
}

export function buildSearchQuery(title: string): string {
  const base = stripPartMarkers(title)
  const cleaned = base
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/[|•·].*$/u, ' ')
    .replace(/[[\]{}()«»"“”'’]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ').filter(Boolean)
  const meaningful = words.filter((word) => !STOPWORDS.has(normalizeText(word)))

  return (meaningful.length > 0 ? meaningful : words).slice(0, 10).join(' ').slice(0, 100)
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function tokenize(value: string): string[] {
  return normalizeText(stripPartMarkers(value))
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 0 &&
        !STOPWORDS.has(token) &&
        !/^\d{4}$/.test(token),
    )
}

export function tokenCount(value: string): number {
  return new Set(tokenize(value)).size
}

export function sharedTokenCount(a: string, b: string): number {
  const first = new Set(tokenize(a))
  const second = new Set(tokenize(b))
  let shared = 0

  for (const token of first) {
    if (second.has(token)) shared += 1
  }

  return shared
}

export function titleSimilarity(a: string, b: string): number {
  const first = new Set(tokenize(a))
  const second = new Set(tokenize(b))

  if (first.size === 0 || second.size === 0) return 0

  let shared = 0
  for (const token of first) {
    if (second.has(token)) shared += 1
  }

  return shared / Math.min(first.size, second.size)
}

/**
 * Similitud de Jaccard entre las palabras significativas de dos títulos.
 * A diferencia de `titleSimilarity`, penaliza las palabras de más, así que
 * sirve para distinguir historias distintas del mismo canal.
 */
export function titleJaccard(a: string, b: string): number {
  const first = new Set(tokenize(a))
  const second = new Set(tokenize(b))

  if (first.size === 0 || second.size === 0) return 0

  let shared = 0
  for (const token of first) {
    if (second.has(token)) shared += 1
  }

  return shared / (first.size + second.size - shared)
}

export function sortParts(parts: Part[]): Part[] {
  return [...parts].sort((a, b) => {
    const first = a.partNumber
    const second = b.partNumber

    if (first != null && second != null && first !== second) return first - second
    if (first != null && second == null) return -1
    if (first == null && second != null) return 1

    if (a.isFinal && !b.isFinal) return 1
    if (!a.isFinal && b.isFinal) return -1

    const firstDate = a.publishedAt ?? ''
    const secondDate = b.publishedAt ?? ''
    if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)

    return a.addedAt - b.addedAt
  })
}

export function partLabel(part: Part, index: number): string {
  if (part.isFinal) return 'Final'
  if (part.partNumber != null) return `Parte ${part.partNumber}`
  return `Parte ${index + 1}`
}
