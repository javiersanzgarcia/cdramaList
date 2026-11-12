import type { ChapterCandidate } from '../discovery/types'

export type SeriesStatus = 'watching' | 'planned' | 'completed'

export type Filter = 'all' | SeriesStatus | 'favorites'

export interface Part {
  videoId: string
  title: string
  description?: string
  partNumber?: number
  totalParts?: number
  sortOrder?: number
  isFinal?: boolean
  durationSeconds?: number
  publishedAt?: string
  thumbnail?: string
  addedAt: number
}

export interface SemanticFingerprint {
  genres: string[]
  tropes: string[]
  roles: string[]
  settings: string[]
  plotElements: string[]
}

export interface Series {
  id: string
  title: string
  /** Otros títulos con los que se publica la misma historia. */
  aliases: string[]
  /** Confianza acumulada en palabras de capítulos aceptados manualmente. */
  keywordConfidence?: Record<string, number>
  semanticFingerprint?: SemanticFingerprint
  channelId?: string
  channelTitle: string
  channelUrl?: string
  thumbnail?: string
  parts: Part[]
  watched: string[]
  favorite: boolean
  /**
   * Estado elegido manualmente. Manda sobre el automático mientras no
   * contradiga al progreso: una serie con todas las partes vistas se muestra
   * siempre como «completed». Si no existe, el estado se deduce del progreso
   * (o «planned» si la serie no tiene actividad).
   */
  status?: SeriesStatus
  /** Candidatos descartados a mano: no se vuelven a sugerir en las búsquedas. */
  discardedCandidates?: string[]
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
  /**
   * Marca de borrado. La serie se oculta en la app pero se conserva para
   * propagar el borrado al sincronizar: sin esta lápida, otro dispositivo
   * volvería a subirla a Google Drive.
   */
  deletedAt?: number
}

export interface SeriesDraft {
  title: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  thumbnail?: string
  parts: Part[]
  candidates?: ChapterCandidate[]
  source: 'playlist' | 'search' | 'manual'
  existingSeriesId?: string
  warnings: string[]
  selectedIds: string[]
}
