import { APP_NAME } from '../shared/lib/constants'

/** Versión del esquema del estado persistido en localStorage. */
export const STORE_VERSION = 1

/** Claves usadas por versiones anteriores del estado persistido. */
export const LEGACY_STORAGE = {
  series: `${APP_NAME}:series`,
  apiKey: `${APP_NAME}:apiKey`,
  googleUser: `${APP_NAME}:googleUser`,
  drive: `${APP_NAME}:drive`,
  synonyms: `${APP_NAME}:synonyms:v1`
} as const

export const LEGACY_STORAGE_KEYS = Object.values(LEGACY_STORAGE)

/** Claves antiguas que ya no se usan y se limpian al arrancar. */
export const LEGACY_CLEANUP_KEYS = [
  `${APP_NAME}:syncConfig`,
  `${APP_NAME}:syncDirty`,
  `${APP_NAME}:googleClientId`
]
