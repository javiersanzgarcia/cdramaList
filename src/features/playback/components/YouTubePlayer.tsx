import { useEffect, useRef, useState } from 'react'

interface YTPlayer {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void
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

const ENDED = 0
const API_TIMEOUT = 12_000

let apiPromise: Promise<YTNamespace> | null = null

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('YouTube no ha respondido a tiempo.'))
    }, API_TIMEOUT)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timeout)
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('La API de YouTube no está disponible.'))
    }

    if (!document.querySelector('script[data-youtube-iframe-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
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
  onEnded?: () => void
  onError?: () => void
}

export function YouTubePlayer({
  videoId,
  onEnded,
  onError
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const currentVideoRef = useRef<string | null>(null)
  const callbacks = useRef({ onEnded, onError })
  const [mode, setMode] = useState<'loading' | 'api' | 'fallback'>('loading')

  useEffect(() => {
    callbacks.current = { onEnded, onError }
  }, [onEnded, onError])

  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    const initialVideo = videoId

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return

        player = new YT.Player(containerRef.current, {
          videoId: initialVideo,
          playerVars: {
            autoplay: 1,
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
              if (!cancelled && event.data === ENDED)
                callbacks.current.onEnded?.()
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
      player.loadVideoById({ videoId })
    } catch {
      setMode('fallback')
    }
  }, [videoId, mode])

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 size-full" />

      {mode === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950">
          <div className="size-10 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
        </div>
      )}

      {mode === 'fallback' && (
        <iframe
          key={videoId}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
          title="Reproductor de YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      )}
    </div>
  )
}
