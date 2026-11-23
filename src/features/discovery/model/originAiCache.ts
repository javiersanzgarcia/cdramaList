import type { SeriesOriginCountry } from '../../series/types'
import { normalizeOriginCountry } from '../../series/model/origin'

// La versión del prefijo permite invalidar respuestas antiguas si cambia el
// prompt del Worker. Se guarda también `unknown` para no repetir una consulta
// que ya determinó que no hay pistas fiables.
const CACHE_PREFIX = 'cdramalist:ai-origin:v1:'

function cacheKey(text: string): string {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${CACHE_PREFIX}${(hash >>> 0).toString(36)}`
}

/** Lee el país que la IA devolvió para exactamente el mismo texto. */
export function readCachedAiOrigin(text: string): SeriesOriginCountry | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(text))
    return raw ? normalizeOriginCountry(JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

/** Guarda el país inferido para no gastar neurons en la misma serie dos veces. */
export function writeCachedAiOrigin(text: string, originCountry: SeriesOriginCountry): void {
  try {
    localStorage.setItem(cacheKey(text), JSON.stringify(originCountry))
  } catch {
    // Modo privado o almacenamiento lleno: simplemente no se cachea.
  }
}
