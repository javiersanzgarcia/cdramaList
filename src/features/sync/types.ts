import type { Dispatch, SetStateAction } from 'react'
import type { Series } from '../series/types'

export interface GoogleUser {
  sub: string
  name: string
  email: string
  picture?: string
}

export interface DrivePersistenceState {
  enabled: boolean
  auto: boolean
  email?: string
  fileId?: string
  lastSyncedAt?: number
}

export interface SyncMessage {
  kind: 'ok' | 'error' | 'info'
  text: string
}

export type DriveErrorCode = 'auth' | 'permission' | 'network' | 'format' | 'notfound'

/** Token OAuth2 de Google con su momento de caducidad. */
export interface AccessToken {
  token: string
  expiresAt: number
}

/** Contenido de un snapshot leído de Drive. */
export interface DriveSnapshot {
  fileId: string
  series: Series[]
  exportedAt?: string
}

/** Formato del JSON que se exporta y se sube a Drive. */
export interface SnapshotPayload {
  app: string
  version: number
  exportedAt: string
  series: Series[]
}

export type DriveSyncStatus = 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'

export interface DriveSync {
  configured: boolean
  connected: boolean
  auto: boolean
  dirty: boolean
  busy: boolean
  status: DriveSyncStatus
  email: string | null
  lastSyncedAt: number | null
  message: SyncMessage | null
  connect: () => Promise<boolean>
  disconnect: () => void
  syncNow: (seriesOverride?: Series[]) => Promise<boolean>
  upload: () => Promise<void>
  download: () => Promise<void>
  setAuto: (auto: boolean) => void
}

export interface UseDriveSyncOptions {
  clientId: string
  series: Series[]
  setSeries: Dispatch<SetStateAction<Series[]>>
  onUser: (user: GoogleUser | null) => void
}
