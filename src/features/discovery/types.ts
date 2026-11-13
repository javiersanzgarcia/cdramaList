import type { Part, PartInfo, SemanticFingerprint } from '../series/types'

/** Respuesta de la API de YouTube para las miniaturas de un vídeo. */
export interface Thumbnails {
  default?: { url: string }
  medium?: { url: string }
  high?: { url: string }
  standard?: { url: string }
  maxres?: { url: string }
}

/** Metadatos normalizados de un vídeo de YouTube. */
export interface VideoMeta {
  videoId: string
  title: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  publishedAt?: string
  description?: string
  tags?: string[]
  thumbnail?: string
  durationSeconds?: number
}

/** Resultado de interpretar un enlace o identificador de YouTube. */
export interface ParsedYouTubeUrl {
  videoId?: string
  playlistId?: string
}

/** Lista de reproducción importada como borrador de serie. */
export interface PlaylistData {
  playlistId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnail?: string
  parts: Part[]
  truncated: boolean
}

export interface ChapterCandidate {
  videoId: string
  title: string
  description?: string
  descriptionTitle?: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  thumbnail?: string
  durationSeconds?: number
  publishedAt?: string
  partNumber?: number
  totalParts?: number
  isFinal?: boolean
  score: number
  matchedBy: 'title' | 'description'
  source: 'channel' | 'search'
}

/** Candidato con la información de parte ya detectada y su puntuación. */
export interface RankedCandidate {
  video: VideoMeta
  info: PartInfo
  source: 'channel' | 'search'
  score: number
  descriptionTitle?: string
  matchedBy: 'title' | 'description'
}

/** Estado editable de los números y finales de los candidatos. */
export interface CandidateState {
  numbers: Record<string, string>
  finals: Record<string, boolean>
}

/** Resultado de buscar capítulos nuevos de una serie. */
export interface SeriesUpdate {
  parts: Part[]
  added: Part[]
  candidates: ChapterCandidate[]
  channelId?: string
  channelTitle?: string
  channelUrl?: string
  semanticFingerprint?: SemanticFingerprint
  warnings: string[]
}

/** Resultado que consume la ficha al actualizar una serie. */
export interface SeriesRefreshResult {
  added: number
  candidates: ChapterCandidate[]
  parts: Part[]
  warnings: string[]
  synced: boolean
}

export interface SynonymCacheEntry {
  at: number
  synonyms: string[]
  notFound?: boolean
}

/** Entrada de texto que se envía al servicio semántico. */
export interface FingerprintInput {
  id: string
  text: string
}
