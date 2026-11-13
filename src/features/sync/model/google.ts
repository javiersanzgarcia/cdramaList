import type { AccessToken, GoogleUser } from '../types'
import { DRIVE_TOKEN_STORAGE_KEY } from '../../../shared/lib/constants'
import {
  GOOGLE_DRIVE_SCOPES,
  GOOGLE_SCRIPT_SRC,
  GOOGLE_SCRIPT_TIMEOUT_MS,
  GOOGLE_TOKEN_DEFAULT_LIFETIME_S,
  GOOGLE_TOKEN_EXPIRY_MARGIN_S,
  GOOGLE_USERINFO_URL
} from './constants'

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrides?: {
    prompt?: '' | 'none' | 'consent' | 'select_account'
  }) => void
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (options: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type: string; message: string }) => void
    ux_mode?: 'popup' | 'redirect'
  }) => GoogleTokenClient
  revoke: (token: string, done?: () => void) => void
}

interface GoogleNamespace {
  accounts: {
    oauth2?: GoogleAccountsOAuth2
  }
}

declare global {
  interface Window {
    google?: GoogleNamespace
  }
}

let scriptPromise: Promise<GoogleNamespace> | null = null

export function loadGoogleIdentity(): Promise<GoogleNamespace> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Google no ha respondido a tiempo. Revisa tu conexión.'))
    }, GOOGLE_SCRIPT_TIMEOUT_MS)

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity]'
    )

    function finish() {
      window.clearTimeout(timeout)
      if (window.google?.accounts?.oauth2) resolve(window.google)
      else reject(new Error('No se pudo inicializar Google.'))
    }

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeout)
          reject(new Error('No se pudo cargar Google.'))
        },
        { once: true }
      )
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout)
        reject(new Error('No se pudo cargar Google.'))
      },
      { once: true }
    )
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

/**
 * Guarda el token de Drive solo durante la sesión del navegador. Así una
 * recarga conserva la sincronización sin dejar el token en disco de forma
 * permanente. El token caduca igualmente en aproximadamente una hora.
 */
export function loadStoredDriveToken(): AccessToken | null {
  try {
    const raw = window.sessionStorage.getItem(DRIVE_TOKEN_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown }

    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      window.sessionStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY)
      return null
    }

    if (Date.now() >= parsed.expiresAt) {
      window.sessionStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY)
      return null
    }

    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

export function storeDriveToken(token: AccessToken) {
  try {
    window.sessionStorage.setItem(
      DRIVE_TOKEN_STORAGE_KEY,
      JSON.stringify(token)
    )
  } catch {
    // Sin acceso a sessionStorage: el token queda solo en memoria.
  }
}

export function clearStoredDriveToken() {
  try {
    window.sessionStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY)
  } catch {
    // Sin acceso a sessionStorage: no hay nada que borrar.
  }
}

/**
 * Pide un access token OAuth2 con permiso sobre la carpeta privada de Drive.
 * - `prompt: ''` muestra el consentimiento solo la primera vez.
 * - `prompt: 'none'` intenta renovar el token sin interacción.
 */
export async function requestDriveToken(
  clientId: string,
  prompt: '' | 'none' | 'consent' = ''
): Promise<AccessToken> {
  const google = await loadGoogleIdentity()
  const oauth2 = google.accounts.oauth2

  if (!oauth2) {
    throw new Error('Google no ofrece autorización OAuth2 en este navegador.')
  }

  return new Promise<AccessToken>((resolve, reject) => {
    let settled = false

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPES,
      callback: (response) => {
        if (settled) return
        settled = true

        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ??
                response.error ??
                'No se pudo autorizar el acceso a Google Drive.'
            )
          )
          return
        }

        const expiresIn = Number(response.expires_in)
        const lifetime = Number.isFinite(expiresIn)
          ? Math.max(
              expiresIn - GOOGLE_TOKEN_EXPIRY_MARGIN_S,
              GOOGLE_TOKEN_EXPIRY_MARGIN_S
            )
          : GOOGLE_TOKEN_DEFAULT_LIFETIME_S

        resolve({
          token: response.access_token,
          expiresAt: Date.now() + lifetime * 1_000
        })
      },
      error_callback: (error) => {
        if (settled) return
        settled = true
        reject(
          new Error(
            error.message ||
              'No se pudo autorizar el acceso a Google Drive. Inténtalo de nuevo.'
          )
        )
      }
    })

    client.requestAccessToken({ prompt })
  })
}

export async function fetchGoogleUserInfo(token: string): Promise<GoogleUser> {
  let response: Response

  try {
    response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
  } catch {
    throw new Error('No se pudo conectar con Google. Revisa tu conexión.')
  }

  if (!response.ok) {
    throw new Error('No se pudo leer la cuenta de Google.')
  }

  const data = (await response.json()) as {
    sub?: string
    name?: string
    email?: string
    picture?: string
  }

  if (!data.sub || !data.email) {
    throw new Error('Google no devolvió los datos de la cuenta.')
  }

  return {
    sub: data.sub,
    name: data.name || data.email.split('@')[0],
    email: data.email,
    picture: data.picture
  }
}

export function revokeGoogleToken(token: string) {
  try {
    window.google?.accounts.oauth2?.revoke(token, () => undefined)
  } catch {
    // La librería puede no estar cargada; no es un problema.
  }
}

export function sanitizeGoogleUser(value: unknown): GoogleUser | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>

  if (typeof item.sub !== 'string' || typeof item.email !== 'string')
    return null

  return {
    sub: item.sub,
    email: item.email,
    name: typeof item.name === 'string' && item.name ? item.name : item.email,
    picture: typeof item.picture === 'string' ? item.picture : undefined
  }
}
