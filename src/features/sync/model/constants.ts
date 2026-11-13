/** Endpoints y ajustes de la sincronización con Google Drive. */

export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
export const DRIVE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3'

/** Origen del script de Google Identity Services. */
export const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
/** `drive.appdata` da acceso únicamente a la carpeta privada de la app en Drive. */
export const GOOGLE_DRIVE_SCOPES =
  'openid email profile https://www.googleapis.com/auth/drive.appdata'
/** Espera máxima a que cargue el script de Google Identity. */
export const GOOGLE_SCRIPT_TIMEOUT_MS = 12_000

/** Retardo antes de subir cambios automáticamente (evita subidas en ráfaga). */
export const AUTO_SYNC_DEBOUNCE_MS = 2_000
