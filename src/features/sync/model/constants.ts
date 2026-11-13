/** Endpoints y ajustes de la sincronización con Google Drive. */

export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
export const DRIVE_UPLOAD_API_BASE =
  'https://www.googleapis.com/upload/drive/v3'
export const GOOGLE_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo'

/** Versión del formato del snapshot que se sube a Drive. */
export const DRIVE_SNAPSHOT_VERSION = 2
/** Tamaño de página al buscar el archivo de sincronización en Drive. */
export const DRIVE_FILE_PAGE_SIZE = 100

/** Origen del script de Google Identity Services. */
export const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
/** `drive.appdata` da acceso únicamente a la carpeta privada de la app en Drive. */
export const GOOGLE_DRIVE_SCOPES =
  'openid email profile https://www.googleapis.com/auth/drive.appdata'
/** Espera máxima a que cargue el script de Google Identity. */
export const GOOGLE_SCRIPT_TIMEOUT_MS = 12_000
/** Margen de seguridad antes de que caduque el token de acceso. */
export const GOOGLE_TOKEN_EXPIRY_MARGIN_S = 60
/** Duración por defecto si Google no devuelve `expires_in`. */
export const GOOGLE_TOKEN_DEFAULT_LIFETIME_S = 3_000

/** Retardo antes de subir cambios automáticamente (evita subidas en ráfaga). */
export const AUTO_SYNC_DEBOUNCE_MS = 2_000
