import { DAY_MS } from '../../../shared/lib/constants'

/** Cuánto se conserva la lápida de una etiqueta borrada para propagar el borrado. */
export const DELETED_TAG_TTL = 30 * DAY_MS

/** Longitud máxima del nombre de una etiqueta. */
export const MAX_TAG_NAME_LENGTH = 32
