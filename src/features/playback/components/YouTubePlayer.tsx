import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import {
  PLAYBACK_SAVE_INTERVAL_MS,
  YOUTUBE_EMBED_BASE,
  YOUTUBE_IFRAME_API_SRC,
  YOUTUBE_PLAYER_ENDED_STATE,
  YOUTUBE_PLAYER_PAUSED_STATE,
  YOUTUBE_PLAYER_PLAYING_STATE,
  YOUTUBE_PLAYER_TIMEOUT_MS
} from '../constants'
import { createIframeBridge, type IframeBridge } from '../model/iframeBridge'

interface YTPlayer {
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void
  getCurrentTime: () => number
  getPlayerState: () => number
  playVideo: () => void
  pauseVideo: () => void
  destroy: () => void
}

/** Lo que la API oficial y el puente del iframe saben hacer por igual. */
interface PlaybackHandle {
  getCurrentTime: () => number
  getPlayerState: () => number
  cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void
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
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const apiPlayerRef = useRef<YTPlayer | null>(null)
    const bridgeRef = useRef<IframeBridge | null>(null)
    const playerRef = useRef<PlaybackHandle | null>(null)
    const currentVideoRef = useRef<string | null>(null)
    const callbacks = useRef({ onEnded, onError, onProgress })
    const [mode, setMode] = useState<'loading' | 'api' | 'fallback'>('loading')

    // Valores iniciales para crear el reproductor una sola vez al montar.
    const initialVideoRef = useRef(videoId)
    const initialStartRef = useRef(Math.floor(startSeconds))

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

    // Un único manejador para la API oficial y para el puente del iframe: en
    // ambos modos terminar avanza de parte y pausar guarda la posición.
    const handleStateChange = useCallback((state: number) => {
      if (state === ENDED) {
        callbacks.current.onEnded?.()
        return
      }
      if (state === PAUSED) {
        try {
          const seconds = playerRef.current?.getCurrentTime() ?? 0
          if (Number.isFinite(seconds) && seconds > 0) {
            callbacks.current.onProgress?.(Math.floor(seconds))
          }
        } catch {
          // El reproductor pudo haberse eliminado al cambiar de parte.
        }
      }
    }, [])

    useEffect(() => {
      let cancelled = false
      let player: YTPlayer | null = null
      const initialVideo = initialVideoRef.current
      const initialStart = initialStartRef.current

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
                if (!cancelled) handleStateChange(event.data)
              },
              onError: () => {
                if (!cancelled) callbacks.current.onError?.()
              }
            }
          })

          apiPlayerRef.current = player
          playerRef.current = player
          currentVideoRef.current = initialVideo
        })
        .catch(() => {
          if (!cancelled) setMode('fallback')
        })

      return () => {
        cancelled = true
        bridgeRef.current?.destroy()
        bridgeRef.current = null
        apiPlayerRef.current = null
        playerRef.current = null
        currentVideoRef.current = null
        try {
          player?.destroy()
        } catch {
          // El reproductor puede haberse eliminado ya.
        }
      }
      // El reproductor se crea una sola vez al montar; los cambios de vídeo se
      // gestionan en efectos aparte. `handleStateChange` es estable.
    }, [handleStateChange])

    useEffect(() => {
      if (mode !== 'api' || !playerRef.current) return
      if (currentVideoRef.current === videoId) return

      currentVideoRef.current = videoId
      try {
        // Carga el vídeo en pausa y en el punto guardado; nunca inicia la
        // reproducción ni la publicidad.
        playerRef.current?.cueVideoById?.({ videoId, startSeconds: startRef.current })
      } catch {
        setMode('fallback')
      }
    }, [videoId, mode])

    useEffect(() => {
      if (mode === 'loading') return

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

    useEffect(() => {
      if (mode !== 'fallback') return
      const iframe = iframeRef.current
      if (!iframe) return

      // Cada vídeo monta su propio iframe: retira el puente anterior y, si la
      // API llegó a crear un reproductor, lo descarta para no tener dos activos.
      bridgeRef.current?.destroy()
      try {
        apiPlayerRef.current?.destroy()
      } catch {
        // Ya se había eliminado al cambiar de parte.
      }
      apiPlayerRef.current = null

      const bridge = createIframeBridge(iframe, (state) => handleStateChange(state))
      bridgeRef.current = bridge
      playerRef.current = bridge

      return () => {
        bridge.destroy()
        if (bridgeRef.current === bridge) {
          bridgeRef.current = null
          playerRef.current = null
        }
      }
    }, [mode, videoId, handleStateChange])

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
            ref={iframeRef}
            key={videoId}
            src={`${YOUTUBE_EMBED_BASE}/${videoId}?autoplay=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}${fallbackStart}`}
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
