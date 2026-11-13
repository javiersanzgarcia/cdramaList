/**
 * Constantes transversales a toda la aplicación: identidad, claves de
 * almacenamiento y unidades de tiempo compartidas por varios features.
 */

/** Nombre de la aplicación: prefijo de las claves de almacenamiento. */
export const APP_NAME = 'cdramalist'

/** Milisegundos de un día. Base de todos los TTL expresados en días. */
export const DAY_MS = 24 * 60 * 60 * 1000

/** Clave del estado persistido de la aplicación (Zustand). */
export const STORE_KEY = `${APP_NAME}:zustand`

/** Clave del token de Drive guardado en la sesión del navegador. */
export const DRIVE_TOKEN_STORAGE_KEY = `${APP_NAME}:driveToken`

/** Nombre del archivo de sincronización en la carpeta privada de Drive. */
export const DRIVE_SNAPSHOT_FILE = `${APP_NAME}.json`
