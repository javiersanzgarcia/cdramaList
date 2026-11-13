import { DAY_MS } from '../../../shared/lib/constants'

/** Cuánto se conserva la lápida de una serie borrada para propagar el borrado. */
export const DELETED_SERIES_TTL = 30 * DAY_MS

/** Límite de alias por serie (editor manual y aprendizaje automático). */
export const MAX_SERIES_ALIASES = 12

/** Topes del aprendizaje de confianza de palabras clave. */
export const MAX_KEYWORD_CONFIDENCE_ENTRIES = 100
export const MAX_KEYWORD_CONFIDENCE = 5

/** Longitudes mínima y máxima de un alias. */
export const MIN_ALIAS_LENGTH = 2
export const MAX_ALIAS_LENGTH = 120
/** Longitud máxima de la descripción de una parte que se persiste. */
export const MAX_PART_DESCRIPTION_LENGTH = 5_000
/** Longitud mínima del título de una serie editado a mano. */
export const MIN_SERIES_TITLE_LENGTH = 2

/** Umbrales para detectar que un borrador corresponde a una serie existente. */
export const SERIES_MATCH_MIN_SIMILARITY = 0.6
export const SERIES_MATCH_SAME_CHANNEL_SIMILARITY = 0.75

/** Límites de las consultas de búsqueda construidas a partir del título. */
export const MAX_TITLE_QUERY_WORDS = 10
export const MAX_TITLE_QUERY_LENGTH = 100

/** Puntos que aporta cada palabra aprendida al puntuar un candidato. */
export const KEYWORD_BONUS_PER_WORD = 3
export const KEYWORD_BONUS_MULTIPLIER = 2
export const MAX_KEYWORD_BONUS = 12
