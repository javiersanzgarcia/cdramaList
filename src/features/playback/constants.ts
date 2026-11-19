/** Ajustes del reproductor embebido de YouTube. */

/** Espera máxima a que cargue la API del reproductor de YouTube. */
export const YOUTUBE_PLAYER_TIMEOUT_MS = 12_000
/** Código de estado que emite la API cuando el vídeo termina. */
export const YOUTUBE_PLAYER_ENDED_STATE = 0
/** Código de estado que emite la API mientras el vídeo está en marcha. */
export const YOUTUBE_PLAYER_PLAYING_STATE = 1
/** Código de estado que emite la API cuando el vídeo está en pausa. */
export const YOUTUBE_PLAYER_PAUSED_STATE = 2
/** Cada cuánto se guarda la posición mientras se reproduce. */
export const PLAYBACK_SAVE_INTERVAL_MS = 30_000
/** Cadencia y número de intentos del saludo `postMessage` con el iframe. */
export const YOUTUBE_IFRAME_HANDSHAKE_MS = 600
export const YOUTUBE_IFRAME_HANDSHAKE_ATTEMPTS = 8
/** Dominios desde los que YouTube responde al iframe embebido. */
export const YOUTUBE_MESSAGE_ORIGINS = [
  'https://www.youtube.com',
  'https://youtube.com',
  'https://www.youtube-nocookie.com',
  'https://youtube-nocookie.com'
]
export const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'
export const YOUTUBE_EMBED_BASE = 'https://www.youtube-nocookie.com/embed'
export const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v='
