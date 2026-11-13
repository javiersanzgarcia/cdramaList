import { DAY_MS } from '../../../shared/lib/constants'

/**
 * Ajustes afinables de la búsqueda de capítulos, los sinónimos y el análisis
 * semántico. Se centralizan aquí para no tener que bucear en la lógica.
 */

// --- API de YouTube ---
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
export const YOUTUBE_WEB_BASE = 'https://www.youtube.com'
export const YOUTUBE_CHANNEL_BASE = `${YOUTUBE_WEB_BASE}/channel`
export const YOUTUBE_THUMBNAIL_BASE = 'https://i.ytimg.com/vi'
export const YOUTUBE_OEMBED_URL = `${YOUTUBE_WEB_BASE}/oembed`
export const YOUTUBE_WATCH_URL = `${YOUTUBE_WEB_BASE}/watch?v=`
/** Hosts aceptados al pegar un enlace de YouTube. */
export const YOUTUBE_HOSTS = [
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'youtube-nocookie.com'
] as const
/** Proxies CORS usados cuando no hay clave de API para leer metadatos. */
export const YOUTUBE_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
] as const
export const YOUTUBE_SEARCH_LANGUAGE = 'es'
/** Máximo de vídeos que acepta una consulta de la API de YouTube. */
export const YOUTUBE_MAX_VIDEOS_PER_REQUEST = 50
export const YOUTUBE_SEARCH_MAX_RESULTS = 50
/** Tamaño de página al recorrer listas de reproducción y subidas. */
export const YOUTUBE_PLAYLIST_PAGE_SIZE = 50
/** Títulos con los que YouTube marca vídeos no disponibles en una lista. */
export const YOUTUBE_DELETED_VIDEO_TITLE = 'Deleted video'
export const YOUTUBE_PRIVATE_VIDEO_TITLE = 'Private video'
/** Valores por defecto cuando no se conoce el canal o el título real. */
export const YOUTUBE_CHANNEL_FALLBACK = 'YouTube'
export const YOUTUBE_VIDEO_FALLBACK_TITLE = 'Vídeo de YouTube'

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

/** Umbrales de relevancia léxica de un candidato. */
export const SERIES_UPDATE_DESCRIPTION_OVERLAP = 0.65
export const SERIES_UPDATE_TITLE_OVERLAP = 0.45
export const SERIES_UPDATE_TITLE_OVERLAP_SAME_CHANNEL = 0.3
export const SERIES_UPDATE_TITLE_SHARED_SAME_CHANNEL = 4
export const SERIES_UPDATE_LEARNING_BONUS_MIN = 4
/** Puntos extra cuando la descripción confirma el título de la historia. */
export const SERIES_UPDATE_DESCRIPTION_MATCH_BONUS = 12
export const SERIES_UPDATE_DESCRIPTION_RELEVANT_BONUS = 6
/** Títulos de partes que se incluyen al construir el fingerprint de la serie. */
export const SERIES_UPDATE_FINGERPRINT_TITLE_PARTS = 10
/** Similitud semántica mínima para incorporar un candidato. */
export const SERIES_UPDATE_SEMANTIC_MIN_SIMILARITY = 0.3
export const SERIES_UPDATE_SEMANTIC_MIN_SCORE = 30
export const SERIES_UPDATE_SEMANTIC_SCORE_WEIGHT = 35
/** Longitud máxima del detalle de error que se muestra en un aviso. */
export const SERIES_UPDATE_MAX_ERROR_LENGTH = 240

// --- Ranking de términos de búsqueda ---
export const MAX_SEARCH_TERMS = 14
export const MAX_SEARCH_QUERY_LENGTH = 500

// --- Puntuación de candidatos ---
export const CANDIDATE_SCORE_OVERLAP_WEIGHT = 55
export const CANDIDATE_SCORE_SHARED_WEIGHT = 20
export const CANDIDATE_SCORE_PART_NUMBER = 12
export const CANDIDATE_SCORE_FINAL = 5
export const CANDIDATE_SCORE_SAME_CHANNEL = 8

// --- Listas de reproducción ---
export const MAX_PLAYLIST_ITEMS = 200

// --- Sinónimos ---
export const RAE_API_BASE = 'https://rae-api.com/api/words'
export const SYNONYM_CACHE_TTL = 60 * DAY_MS
export const SYNONYM_NOT_FOUND_TTL = 7 * DAY_MS
export const SYNONYM_REQUEST_TIMEOUT_MS = 2_000
/** Tiempo que se deja de consultar la API tras un 429 o una caída total. */
export const SYNONYM_BLOCK_DURATION_MS = 60_000
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
/** Normalización de etiquetas devueltas por el servicio semántico. */
export const SEMANTIC_MAX_TAG_LENGTH = 40
export const SEMANTIC_MIN_TAG_LENGTH = 2
export const SEMANTIC_MAX_TAGS = 12
/** Similitud mínima (etiquetas compartidas) para considerar dos historias. */
export const SEMANTIC_MIN_SHARED_TAGS = 2
/** Reintento ante 429/503. */
export const SEMANTIC_RETRY_MAX_DELAY_MS = 5_000
export const SEMANTIC_RETRY_DEFAULT_DELAY_MS = 1_000
export const SEMANTIC_MAX_ERROR_LENGTH = 240
