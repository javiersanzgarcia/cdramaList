export type Tab = 'home' | 'list' | 'settings'

export type SeriesStatus = 'watching' | 'planned' | 'completed'

export type Filter = 'all' | SeriesStatus | 'favorites'

export interface Part {
  videoId: string
  title: string
  partNumber?: number
  totalParts?: number
  isFinal?: boolean
  durationSeconds?: number
  publishedAt?: string
  thumbnail?: string
  addedAt: number
}

export interface Series {
  id: string
  title: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  thumbnail?: string
  parts: Part[]
  watched: string[]
  favorite: boolean
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
}

export interface SeriesDraft {
  title: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  thumbnail?: string
  parts: Part[]
  source: 'playlist' | 'search' | 'manual'
  existingSeriesId?: string
  warnings: string[]
  selectedIds: string[]
}

export interface GoogleUser {
  sub: string
  name: string
  email: string
  picture?: string
}

export interface SyncConfig {
  token: string
  repo: string
  branch: string
  path: string
  auto: boolean
  sha?: string
  lastSyncedAt?: number
}
