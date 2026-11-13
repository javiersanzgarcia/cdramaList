import { DAY_MS } from '../../../shared/lib/constants'

/**
 * Ajustes afinables de la búsqueda de capítulos, los sinónimos y el análisis
 * semántico. Se centralizan aquí para no tener que bucear en la lógica.
 */

// --- API de YouTube ---
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/** Petición directa a la API de YouTube. */
export const YOUTUBE_REQUEST_TIMEOUT_MS = 20_000
/** Petición a través de un proxy CORS (más frágil, caduca antes). */
export const YOUTUBE_PROXY_TIMEOUT_MS = 8_000

// --- Búsqueda de capítulos (discoverSeriesUpdates) ---
export const MAX_CANDIDATES = 12
export const MAX_SEMANTIC_CANDIDATES = 12
/**
 * Ventana de re-subidas recientes del canal que se clasifica semánticamente.
 * Debe cubrir varios días: los canales de resúmenes suben muchos vídeos al día
 * y una re-subida puede quedar decenas de posiciones por debajo de la última.
 */
export const MAX_RECENT_CHANNEL_CANDIDATES = 30
export const MAX_FINGERPRINT_CANDIDATES = 39
/**
 * Consultas globales independientes por actualización: título, alias, título
 * real de la descripción y títulos de las partes. Cada una cuesta 100 unidades
 * de cuota, así que se limita para no agotar la cuota diaria.
 */
export const MAX_GLOBAL_SEARCHES = 4

// --- Ranking de términos de búsqueda ---
export const MAX_SEARCH_TERMS = 14
export const MAX_SEARCH_QUERY_LENGTH = 500

// --- Listas de reproducción ---
export const MAX_PLAYLIST_ITEMS = 200

// --- Sinónimos ---
export const SYNONYM_CACHE_TTL = 60 * DAY_MS
export const SYNONYM_NOT_FOUND_TTL = 7 * DAY_MS
export const SYNONYM_REQUEST_TIMEOUT_MS = 2_000
export const SYNONYM_MAX_WORDS = 4
export const SYNONYM_MAX_PER_WORD = 8
export const SYNONYM_MAX_PER_SENSE = 3
export const SYNONYM_MAX_QUERY_VARIANTS = 2
export const SYNONYM_MAX_QUERY_LENGTH = 300

// --- Análisis semántico (Worker de IA) ---
export const SEMANTIC_REQUEST_TIMEOUT_MS = 60_000
export const SEMANTIC_MAX_TEXT_LENGTH = 1200
/**
 * El Worker acepta como máximo 25 entradas por petición, pero con lotes
 * pequeños responde mucho antes. Se envían varios lotes en paralelo para
 * cubrir una ventana amplia de re-subidas sin alargar la actualización.
 */
export const SEMANTIC_MAX_ENTRIES_PER_REQUEST = 10
