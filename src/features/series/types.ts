import type { ChapterCandidate } from '../discovery/types'
import type { Dispatch, SetStateAction } from 'react'
import type { PlayerState } from '../../app/types'
import type { DriveSync } from '../sync/types'

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

/** Información de parte detectada en el título de un vídeo. */
export interface PartInfo {
  partNumber?: number
  totalParts?: number
  isFinal: boolean
}

/** Metadatos de vídeo que se pueden aplicar a una parte. */
export interface PartMetaPatch {
  description?: string
  durationSeconds?: number
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
  /** Etiquetas globales asignadas a la serie (referencias por id). */
  tagIds?: string[]
  /**
   * Estado elegido manualmente. Manda sobre el automático mientras no
   * contradiga al progreso: una serie con todas las partes vistas se muestra
   * siempre como «completed». Si no existe, el estado se deduce del progreso
   * (o «planned» si la serie no tiene actividad).
   */
  status?: SeriesStatus
  /**
   * Vídeos descartados a mano: no se vuelven a sugerir en las búsquedas.
   */
  discardedCandidates?: string[]
  /**
   * Lápidas de partes: id del vídeo quitado a mano y momento del borrado. Hace
   * falta el instante (y no solo el id) para distinguir una parte borrada de
   * otra reañadida después: si `addedAt` de la parte es posterior, la lápida ya
   * no aplica. Al reañadir una parte se borra su entrada.
   */
  removedParts?: Record<string, number>
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

/** Opciones con las que se construye el hook de acciones de series. */
export interface UseSeriesActionsOptions {
  series: Series[]
  setSeries: Dispatch<SetStateAction<Series[]>>
  apiKey: string
  semanticEndpoint: string
  drive: Pick<DriveSync, 'connected' | 'syncNow'>
  setSelectedSeriesId: Dispatch<SetStateAction<string | null>>
  setPlayer: Dispatch<SetStateAction<PlayerState | null>>
  setAddTargetId: Dispatch<SetStateAction<string | null>>
  setAddOpen: Dispatch<SetStateAction<boolean>>
}

/** Resumen de una actualización masiva de favoritas. */
export interface RefreshFavoritesResult {
  updatedIds: string[]
  candidatesById: Record<string, ChapterCandidate[]>
  failed: number
  warnings: string[]
  syncFailed: boolean
}
