import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  PLAYBACK_SAVE_INTERVAL_MS,
  YOUTUBE_EMBED_BASE,
  YOUTUBE_IFRAME_API_SRC,
  YOUTUBE_PLAYER_ENDED_STATE,
  YOUTUBE_PLAYER_PAUSED_STATE,
  YOUTUBE_PLAYER_PLAYING_STATE,
  YOUTUBE_PLAYER_TIMEOUT_MS
} from '../constants'

interface YTPlayer {
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void
  getCurrentTime: () => number
  getPlayerState: () => number
  playVideo: () => void
  pauseVideo: () => void
  destroy: () => void
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (event: { data: number }) => void
        onError?: () => void
      }
    }
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const ENDED = YOUTUBE_PLAYER_ENDED_STATE
const PLAYING = YOUTUBE_PLAYER_PLAYING_STATE
const PAUSED = YOUTUBE_PLAYER_PAUSED_STATE

let apiPromise: Promise<YTNamespace> | null = null

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('YouTube no ha respondido a tiempo.'))
    }, YOUTUBE_PLAYER_TIMEOUT_MS)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timeout)
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('La API de YouTube no está disponible.'))
    }

    if (!document.querySelector('script[data-youtube-iframe-api]')) {
      const script = document.createElement('script')
      script.src = YOUTUBE_IFRAME_API_SRC
      script.async = true
      script.dataset.youtubeIframeApi = 'true'
      script.addEventListener('error', () => {
        window.clearTimeout(timeout)
        reject(new Error('No se pudo cargar el reproductor de YouTube.'))
      })
      document.head.appendChild(script)
    }
  }).catch((error: unknown) => {
    apiPromise = null
    throw error
  })

  return apiPromise
}

interface YouTubePlayerProps {
  videoId: string
  /** Segundos desde los que se carga el vídeo, sin iniciarlo. */
  startSeconds?: number
  onEnded?: () => void
  onError?: () => void
  /** Posición actual, avisada periódicamente mientras se reproduce. */
  onProgress?: (seconds: number) => void
}

export interface YouTubePlayerHandle {
  /** Segundos actuales, para guardarlos al cambiar de parte o al cerrar. */
  getTime: () => number | null
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, startSeconds = 0, onEnded, onError, onProgress }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const currentVideoRef = useRef<string | null>(null)
    const callbacks = useRef({ onEnded, onError, onProgress })
    const [mode, setMode] = useState<'loading' | 'api' | 'fallback'>('loading')

    // `startSeconds` cambia cada vez que guardamos la posición. El reproductor
    // debe leer el valor solo al cargar un vídeo, nunca volver a bobinar uno que
    // ya está sonando.
    const startRef = useRef(Math.floor(startSeconds))
    startRef.current = Math.floor(startSeconds)
    const fallbackVideoRef = useRef(videoId)
    const fallbackStartRef = useRef(Math.floor(startSeconds))
    if (fallbackVideoRef.current !== videoId) {
      fallbackVideoRef.current = videoId
      fallbackStartRef.current = Math.floor(startSeconds)
    }

    useImperativeHandle(
      ref,
      () => ({
        getTime: () => {
          try {
            const seconds = playerRef.current?.getCurrentTime() ?? -1
            return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : null
          } catch {
            return null
          }
        }
      }),
      []
    )

    useEffect(() => {
      callbacks.current = { onEnded, onError, onProgress }
    }, [onEnded, onError, onProgress])

    useEffect(() => {
      let cancelled = false
      let player: YTPlayer | null = null
      const initialVideo = videoId
      const initialStart = startRef.current

      loadYouTubeApi()
        .then((YT) => {
          if (cancelled || !containerRef.current) return

          player = new YT.Player(containerRef.current, {
            videoId: initialVideo,
            playerVars: {
              // Sin autoplay: el vídeo (y su publicidad) espera a que el usuario
              // pulse reproducir. `start` solo sitúa la cabeza de lectura.
              autoplay: 0,
              start: initialStart,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              iv_load_policy: 3,
              origin: window.location.origin
            },
            events: {
              onReady: () => {
                if (cancelled) return
                setMode('api')
              },
              onStateChange: (event) => {
                if (cancelled) return
                if (event.data === ENDED) callbacks.current.onEnded?.()
                if (event.data === PAUSED) {
                  try {
                    const seconds = player?.getCurrentTime() ?? 0
                    if (Number.isFinite(seconds) && seconds > 0) {
                      callbacks.current.onProgress?.(Math.floor(seconds))
                    }
                  } catch {
                    // El reproductor pudo haberse eliminado al cambiar de parte.
                  }
                }
              },
              onError: () => {
                if (!cancelled) callbacks.current.onError?.()
              }
            }
          })

          playerRef.current = player
          currentVideoRef.current = initialVideo
        })
        .catch(() => {
          if (!cancelled) setMode('fallback')
        })

      return () => {
        cancelled = true
        playerRef.current = null
        currentVideoRef.current = null
        try {
          player?.destroy()
        } catch {
          // El reproductor puede haberse eliminado ya.
        }
      }
      // El reproductor se crea una sola vez; los cambios de vídeo se cargan aparte.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const player = playerRef.current
      if (!player || mode !== 'api') return
      if (currentVideoRef.current === videoId) return

      currentVideoRef.current = videoId
      try {
        // Carga el vídeo en pausa y en el punto guardado; nunca inicia la
        // reproducción ni la publicidad.
        player.cueVideoById({ videoId, startSeconds: startRef.current })
      } catch {
        setMode('fallback')
      }
    }, [videoId, mode])

    useEffect(() => {
      if (mode !== 'api') return

      const timer = window.setInterval(() => {
        try {
          const player = playerRef.current
          if (!player || player.getPlayerState() !== PLAYING) return
          const seconds = player.getCurrentTime()
          if (Number.isFinite(seconds) && seconds > 0) {
            callbacks.current.onProgress?.(Math.floor(seconds))
          }
        } catch {
          // Un fallo puntual del reproductor no debe interrumpir la reproducción.
        }
      }, PLAYBACK_SAVE_INTERVAL_MS)

      return () => window.clearInterval(timer)
    }, [mode])

    const fallbackStart =
      fallbackStartRef.current > 0 ? `&start=${fallbackStartRef.current}` : ''

    return (
      <div className="relative aspect-video w-full overflow-hidden bg-overlay">
        <div ref={containerRef} className="absolute inset-0 size-full" />

        {mode === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-canvas">
            <div className="size-10 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
          </div>
        )}

        {mode === 'fallback' && (
          <iframe
            key={videoId}
            src={`${YOUTUBE_EMBED_BASE}/${videoId}?autoplay=0&playsinline=1&rel=0${fallbackStart}`}
            title="Reproductor de YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        )}
      </div>
    )
  }
)
