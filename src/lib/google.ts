import type { GoogleUser } from '../types'

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  disableAutoSelect: () => void
}

interface GoogleNamespace {
  accounts: {
    id: GoogleAccountsId
  }
}

declare global {
  interface Window {
    google?: GoogleNamespace
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<GoogleNamespace> | null = null

export function loadGoogleIdentity(): Promise<GoogleNamespace> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Google no ha respondido a tiempo. Revisa tu conexión.'))
    }, 12_000)

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity]',
    )

    function finish() {
      window.clearTimeout(timeout)
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('No se pudo inicializar el login de Google.'))
    }

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeout)
          reject(new Error('No se pudo cargar el login de Google.'))
        },
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout)
        reject(new Error('No se pudo cargar el login de Google.'))
      },
      { once: true },
    )
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function decodeGoogleCredential(credential: string): GoogleUser {
  const payload = credential.split('.')[1]
  if (!payload) throw new Error('La credencial de Google no es válida.')

  const data = JSON.parse(base64UrlDecode(payload)) as {
    sub?: string
    name?: string
    email?: string
    picture?: string
  }

  if (!data.sub || !data.email) {
    throw new Error('La cuenta de Google no tiene los datos esperados.')
  }

  return {
    sub: data.sub,
    name: data.name || data.email.split('@')[0],
    email: data.email,
    picture: data.picture,
  }
}

export function sanitizeGoogleUser(value: unknown): GoogleUser | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>

  if (typeof item.sub !== 'string' || typeof item.email !== 'string') return null

  return {
    sub: item.sub,
    email: item.email,
    name: typeof item.name === 'string' && item.name ? item.name : item.email,
    picture: typeof item.picture === 'string' ? item.picture : undefined,
  }
}

export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onUser: (user: GoogleUser) => void,
  onError?: (message: string) => void,
): Promise<void> {
  const google = await loadGoogleIdentity()

  google.accounts.id.initialize({
    client_id: clientId,
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      if (!response.credential) {
        onError?.('Google no devolvió una credencial válida.')
        return
      }

      try {
        onUser(decodeGoogleCredential(response.credential))
      } catch (error) {
        onError?.(
          error instanceof Error ? error.message : 'No se pudo leer la cuenta de Google.',
        )
      }
    },
  })

  container.replaceChildren()
  google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'left',
    locale: 'es',
    width: container.clientWidth > 0 ? Math.min(280, container.clientWidth) : 280,
  })
}

export function signOutGoogle() {
  try {
    window.google?.accounts.id.disableAutoSelect()
  } catch {
    // La librería puede no estar cargada; no es un problema.
  }
}
