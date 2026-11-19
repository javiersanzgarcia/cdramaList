import {
  YOUTUBE_IFRAME_HANDSHAKE_ATTEMPTS,
  YOUTUBE_IFRAME_HANDSHAKE_MS,
  YOUTUBE_MESSAGE_ORIGINS
} from '../constants'

/**
 * Puente mínimo para el iframe de reserva, cuando no se pudo cargar el script
 * de la API de YouTube. El iframe sí entiende `postMessage`: basta con añadir
 * `enablejsapi=1` a su URL y avisar de que estamos escuchando. A partir de ahí
 * envía `infoDelivery` con el estado y el segundo actuales, igual que la API.
 */
export interface IframeBridge {
  getCurrentTime: () => number
  getPlayerState: () => number
  destroy: () => void
}

interface InfoDelivery {
  event?: string
  info?: {
    currentTime?: number
    playerState?: number
  }
}

export function createIframeBridge(
  iframe: HTMLIFrameElement,
  onStateChange: (state: number) => void
): IframeBridge {
  let seconds = 0
  let state = -1
  let answered = false
  let attempts = 0

  function send(message: Record<string, unknown>) {
    try {
      // `'*'` cubre tanto youtube.com como youtube-nocookie.com.
      iframe.contentWindow?.postMessage(JSON.stringify(message), '*')
    } catch {
      // El iframe pudo haberse cerrado al cambiar de parte.
    }
  }

  function listen() {
    send({ event: 'listening', id: 1, channel: 'widget' })
  }

  listen()
  // YouTube puede tardar en instalarse dentro del iframe: se repite el saludo
  // hasta que responde o se agotan los intentos.
  const handshake = window.setInterval(() => {
    listen()
    attempts += 1
    if (answered || attempts >= YOUTUBE_IFRAME_HANDSHAKE_ATTEMPTS) {
      window.clearInterval(handshake)
    }
  }, YOUTUBE_IFRAME_HANDSHAKE_MS)

  function handleMessage(event: MessageEvent) {
    // Solo mensajes de este vídeo: al cambiar de parte se monta un iframe nuevo
    // y el anterior deja de enviar eventos.
    if (event.source !== iframe.contentWindow) return
    if (!YOUTUBE_MESSAGE_ORIGINS.includes(event.origin)) return
    if (typeof event.data !== 'string') return

    let data: InfoDelivery
    try {
      data = JSON.parse(event.data) as InfoDelivery
    } catch {
      return
    }
    // YouTube informa del estado inicial con `initialDelivery` y de los
    // cambios posteriores con `infoDelivery`.
    if (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') return
    if (!data.info) return

    answered = true
    if (typeof data.info.currentTime === 'number' && Number.isFinite(data.info.currentTime)) {
      seconds = data.info.currentTime
    }
    // El estado se repite en cada entrega de información; solo avisamos de los
    // cambios para no marcar la parte como vista dos veces al terminar.
    if (typeof data.info.playerState === 'number' && data.info.playerState !== state) {
      state = data.info.playerState
      onStateChange(state)
    }
  }

  window.addEventListener('message', handleMessage)

  return {
    getCurrentTime: () => seconds,
    getPlayerState: () => state,
    destroy: () => {
      window.clearInterval(handshake)
      window.removeEventListener('message', handleMessage)
    }
  }
}
