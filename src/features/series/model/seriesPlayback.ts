import type { Part, PlaybackPosition, Series } from '../types'
import { MAX_PLAYBACK_POSITION_SECONDS } from './constants'

/** Convierte una posición guardada en un valor válido, o la descarta. */
export function normalizePlaybackPosition(value: unknown): PlaybackPosition | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  const { seconds, updatedAt } = record
  if (
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    typeof updatedAt !== 'number' ||
    !Number.isFinite(updatedAt) ||
    updatedAt < 1
  ) {
    return undefined
  }

  return {
    seconds: Math.min(Math.floor(seconds), MAX_PLAYBACK_POSITION_SECONDS),
    updatedAt
  }
}

/**
 * Se queda con la posición guardada más reciente. Si dos copias la guardaron en
 * el mismo instante gana la que más avanzó, para no retroceder al sincronizar.
 */
export function pickPlaybackPosition(
  current: PlaybackPosition | undefined,
  incoming: PlaybackPosition | undefined
): PlaybackPosition | undefined {
  if (!current) return incoming
  if (!incoming) return current
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt ? incoming : current
  }
  return incoming.seconds >= current.seconds ? incoming : current
}

/** Guarda el punto de reanudación de una parte, sin retroceder. */
export function setPlaybackPosition(
  series: Series,
  videoId: string,
  seconds: number,
  now: number = Date.now()
): Series {
  const position = normalizePlaybackPosition({ seconds, updatedAt: now })
  if (!position) return series

  let changed = false
  const parts = series.parts.map((part) => {
    if (part.videoId !== videoId) return part

    const previous = normalizePlaybackPosition(part.playback)
    if (previous && previous.seconds >= position.seconds) return part

    changed = true
    return { ...part, playback: position }
  })

  return changed ? { ...series, parts } : series
}

/** Borra el punto de reanudación de las partes indicadas (o de todas). */
export function clearPlaybackPositions(series: Series, videoIds?: Iterable<string>): Series {
  const cleared = videoIds ? new Set(videoIds) : null
  let changed = false
  const parts = series.parts.map((part) => {
    if (!part.playback || (cleared && !cleared.has(part.videoId))) return part
    changed = true
    const nextPart: Part = { ...part }
    delete nextPart.playback
    return nextPart
  })

  return changed ? { ...series, parts } : series
}

/**
 * Siguiente parte a reproducir. Si alguna parte sin ver tiene una posición
 * guardada, se vuelve a ella (la más reciente) en lugar de empezar por la
 * primera pendiente.
 */
export function nextPartIndex(series: Series): number {
  const watchedIds = new Set(series.watched)
  let resumeIndex = -1
  let latest = 0

  series.parts.forEach((part, index) => {
    if (watchedIds.has(part.videoId) || !part.playback) return
    if (part.playback.updatedAt >= latest) {
      latest = part.playback.updatedAt
      resumeIndex = index
    }
  })
  if (resumeIndex >= 0) return resumeIndex

  const index = series.parts.findIndex((part) => !watchedIds.has(part.videoId))
  return index === -1 ? 0 : index
}

/** Segundos desde los que debe empezar una parte al abrir el reproductor. */
export function resumeSeconds(series: Series, index: number): number {
  return series.parts[index]?.playback?.seconds ?? 0
}
