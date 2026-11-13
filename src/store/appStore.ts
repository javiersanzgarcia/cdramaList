import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  type StateStorage
} from 'zustand/middleware'
import { sanitizeGoogleUser } from '../features/sync/model/google'
import {
  isSeries,
  normalizeSeries,
  pruneDeletedSeries
} from '../features/series/model/series'
import type { SynonymCacheEntry } from '../features/discovery/types'
import type { Series } from '../features/series/types'
import type { DrivePersistenceState } from '../features/sync/types'
import { STORE_KEY } from '../shared/lib/constants'
import { LEGACY_STORAGE, LEGACY_STORAGE_KEYS, STORE_VERSION } from './constants'
import type { AppStore, PersistedAppState } from './types'

const DEFAULT_DRIVE_STATE: DrivePersistenceState = {
  enabled: false,
  auto: true
}

function sanitizeSeries(value: unknown): Series[] {
  return Array.isArray(value)
    ? pruneDeletedSeries(value.filter(isSeries).map(normalizeSeries))
    : []
}

function sanitizeDriveState(value: unknown): DrivePersistenceState {
  if (!value || typeof value !== 'object') return DEFAULT_DRIVE_STATE

  const record = value as Record<string, unknown>
  return {
    enabled: record.enabled === true,
    auto: record.auto !== false,
    email: typeof record.email === 'string' ? record.email : undefined,
    fileId: typeof record.fileId === 'string' ? record.fileId : undefined,
    lastSyncedAt:
      typeof record.lastSyncedAt === 'number' ? record.lastSyncedAt : undefined
  }
}

function sanitizeSynonymCache(
  value: unknown
): Record<string, SynonymCacheEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return []

      const record = entry as Record<string, unknown>
      if (
        typeof record.at !== 'number' ||
        !Array.isArray(record.synonyms) ||
        !record.synonyms.every((word) => typeof word === 'string')
      ) {
        return []
      }

      return [
        [
          key,
          {
            at: record.at,
            synonyms: record.synonyms,
            notFound: record.notFound === true
          }
        ]
      ]
    })
  )
}

function readLegacyValue(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : undefined
  } catch {
    return undefined
  }
}

function migrateLegacyStorage(): PersistedAppState | undefined {
  const hasLegacyData = LEGACY_STORAGE_KEYS.some((key) => {
    try {
      return window.localStorage.getItem(key) !== null
    } catch {
      return false
    }
  })
  if (!hasLegacyData) return undefined

  const apiKey = readLegacyValue(LEGACY_STORAGE.apiKey)
  return {
    series: sanitizeSeries(readLegacyValue(LEGACY_STORAGE.series)),
    apiKeyOverride: typeof apiKey === 'string' ? apiKey : '',
    googleUser: sanitizeGoogleUser(readLegacyValue(LEGACY_STORAGE.googleUser)),
    drive: sanitizeDriveState(readLegacyValue(LEGACY_STORAGE.drive)),
    synonymCache: sanitizeSynonymCache(readLegacyValue(LEGACY_STORAGE.synonyms))
  }
}

const storage: StateStorage = {
  getItem(name) {
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) return stored

      const legacyState = migrateLegacyStorage()
      if (!legacyState) return null

      const migrated = JSON.stringify({
        state: legacyState,
        version: STORE_VERSION
      })
      window.localStorage.setItem(name, migrated)
      for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key)
      return migrated
    } catch {
      return null
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Si el almacenamiento no está disponible, Zustand mantiene el estado en memoria.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name)
    } catch {
      // No hay nada que borrar si localStorage está bloqueado.
    }
  }
}

export const useAppStore = create<AppStore>()(
  persist<AppStore, [], [], PersistedAppState>(
    (set) => ({
      series: [],
      apiKeyOverride: '',
      googleUser: null,
      drive: DEFAULT_DRIVE_STATE,
      synonymCache: {},
      setSeries: (next) =>
        set((state) => ({
          series:
            typeof next === 'function'
              ? (next as (current: Series[]) => Series[])(state.series)
              : next
        })),
      setApiKeyOverride: (apiKeyOverride) => set({ apiKeyOverride }),
      setGoogleUser: (googleUser) => set({ googleUser }),
      setDrive: (next) =>
        set((state) => ({
          drive:
            typeof next === 'function'
              ? (
                  next as (
                    current: DrivePersistenceState
                  ) => DrivePersistenceState
                )(state.drive)
              : next
        })),
      setSynonymCache: (synonymCache) => set({ synonymCache })
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage<PersistedAppState>(() => storage),
      partialize: ({
        series,
        apiKeyOverride,
        googleUser,
        drive,
        synonymCache
      }) => ({ series, apiKeyOverride, googleUser, drive, synonymCache }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedAppState>
        return {
          ...current,
          series: sanitizeSeries(saved.series ?? current.series),
          apiKeyOverride:
            typeof saved.apiKeyOverride === 'string'
              ? saved.apiKeyOverride
              : current.apiKeyOverride,
          googleUser:
            'googleUser' in saved
              ? sanitizeGoogleUser(saved.googleUser)
              : current.googleUser,
          drive: sanitizeDriveState(saved.drive ?? current.drive),
          synonymCache: sanitizeSynonymCache(
            saved.synonymCache ?? current.synonymCache
          )
        }
      }
    }
  )
)
