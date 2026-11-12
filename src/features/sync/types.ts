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
