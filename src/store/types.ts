import type { Dispatch, SetStateAction } from 'react'
import type { SynonymCacheEntry } from '../features/discovery/types'
import type { Series } from '../features/series/types'
import type { Tag } from '../features/tags/types'
import type { DrivePersistenceState, GoogleUser } from '../features/sync/types'

/** Parte del estado de la app que se guarda en localStorage. */
export interface PersistedAppState {
  series: Series[]
  tags: Tag[]
  apiKeyOverride: string
  googleUser: GoogleUser | null
  drive: DrivePersistenceState
  synonymCache: Record<string, SynonymCacheEntry>
}

/** Estado completo del store, con sus acciones. */
export interface AppStore extends PersistedAppState {
  setSeries: Dispatch<SetStateAction<Series[]>>
  setTags: Dispatch<SetStateAction<Tag[]>>
  setApiKeyOverride: (value: string) => void
  setGoogleUser: (value: GoogleUser | null) => void
  setDrive: Dispatch<SetStateAction<DrivePersistenceState>>
  setSynonymCache: (value: Record<string, SynonymCacheEntry>) => void
}
