import { DAY_MS } from '../../../shared/lib/constants'

/** Cuánto se conserva la lápida de una serie borrada para propagar el borrado. */
export const DELETED_SERIES_TTL = 30 * DAY_MS

/** Límite de alias por serie (editor manual y aprendizaje automático). */
export const MAX_SERIES_ALIASES = 12

/** Topes del aprendizaje de confianza de palabras clave. */
export const MAX_KEYWORD_CONFIDENCE_ENTRIES = 100
export const MAX_KEYWORD_CONFIDENCE = 5
