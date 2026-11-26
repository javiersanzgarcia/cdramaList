import type { Part, PartMetaPatch, Series, SeriesDraft, SeriesStatus } from '../types'
import { normalizeSemanticFingerprint } from '../../discovery/model/semanticAi'
import {
  YOUTUBE_CHANNEL_FALLBACK,
  YOUTUBE_VIDEO_FALLBACK_TITLE
} from '../../discovery/model/constants'
import { keepOnlyLastFinal, sortParts } from './parts'
import { titleSimilarity } from './titleMatching'
import { normalizeTagIds } from '../../tags/model/tags'
import {
  detectSeriesOriginCountry,
  normalizeOriginCountry,
  shouldRedetectOriginCountry
} from './origin'
import {
  DELETED_SERIES_TTL,
  FAVORITES_REFRESH_COOLDOWN_MS,
  FAVORITES_REFRESH_MAX_SERIES,
  MAX_PART_DESCRIPTION_LENGTH,
  SERIES_MATCH_MIN_SIMILARITY,
  SERIES_MATCH_SAME_CHANNEL_SIMILARITY
} from './constants'
import { normalizePlaybackPosition, pickPlaybackPosition } from './seriesPlayback'

export {
  clearPlaybackPositions,
  nextPartIndex,
  normalizePlaybackPosition,
  pickPlaybackPosition,
  resumeSeconds,
  setPlaybackPosition
} from './seriesPlayback'
export {
  continueWatching,
  filterSeries,
  groupSeries,
  isSeriesComplete,
  progressLabel,
  progressPercent,
  seriesStatus,
  sortSeries,
  sortSeriesByRecent,
  watchedCount
} from './seriesProgress'

// Progreso, estado y ordenación: ver ./seriesProgress.ts

export function findExistingSeries(series: Series[], draft: SeriesDraft): Series | undefined {
  if (draft.existingSeriesId) {
    return series.find((item) => item.id === draft.existingSeriesId)
  }

  const draftIds = new Set(draft.parts.map((part) => part.videoId))
  const byPart = series.find((item) => item.parts.some((part) => draftIds.has(part.videoId)))
  if (byPart) return byPart

  const matches = series
    .filter((item) => {
      const similarity = titleSimilarity(item.title, draft.title)
      if (similarity < SERIES_MATCH_MIN_SIMILARITY) return false

      if (draft.channelId && item.channelId) {
        return draft.channelId === item.channelId
      }

      const sameChannelName =
        !draft.channelTitle ||
        !item.channelTitle ||
        draft.channelTitle === item.channelTitle ||
        draft.channelTitle === YOUTUBE_CHANNEL_FALLBACK ||
        item.channelTitle === YOUTUBE_CHANNEL_FALLBACK

      return sameChannelName && similarity >= SERIES_MATCH_SAME_CHANNEL_SIMILARITY
    })
    .sort(
      (a, b) => titleSimilarity(b.title, draft.title) - titleSimilarity(a.title, draft.title)
    )

  return matches[0]
}

function acceptedCandidateTitles(
  draft: SeriesDraft,
  parts: Part[],
  excludedIds: Set<string> = new Set()
): string[] {
  const selectedIds = new Set(parts.map((part) => part.videoId))

  return (draft.candidates ?? [])
    .filter(
      (candidate) => selectedIds.has(candidate.videoId) && !excludedIds.has(candidate.videoId)
    )
    .flatMap((candidate) =>
      [candidate.title, candidate.descriptionTitle].filter(
        (candidateTitle): candidateTitle is string => Boolean(candidateTitle)
      )
    )
}

export function createSeries(draft: SeriesDraft, title: string, parts: Part[]): Series {
  const now = Date.now()
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `series_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const finalTitle = title.trim() || draft.title
  const sortedParts = sortParts(parts)
  const aliases = mergeAliasesWithParts([], parts, finalTitle)

  return {
    id,
    title: finalTitle,
    aliases,
    originCountry: detectSeriesOriginCountry({
      title: finalTitle,
      aliases,
      channelTitle: draft.channelTitle,
      parts: sortedParts
    }),
    keywordConfidence: learnKeywordConfidence({}, acceptedCandidateTitles(draft, parts)),
    channelId: draft.channelId,
    channelTitle: draft.channelTitle,
    channelUrl: draft.channelUrl,
    thumbnail: draft.thumbnail ?? parts[0]?.thumbnail,
    parts: sortedParts,
    watched: [],
    favorite: false,
    tagIds: [],
    createdAt: now,
    updatedAt: now
  }
}

export function mergeParts(existing: Part[], incoming: Part[]): Part[] {
  const byId = new Map(existing.map((part) => [part.videoId, part]))

  for (const part of incoming) {
    const previous = byId.get(part.videoId)
    byId.set(
      part.videoId,
      previous
        ? {
            ...previous,
            ...part,
            description: part.description ?? previous.description,
            durationSeconds: part.durationSeconds ?? previous.durationSeconds,
            sortOrder: part.sortOrder ?? previous.sortOrder,
            playback: pickPlaybackPosition(previous.playback, part.playback),
            addedAt: previous.addedAt
          }
        : part
    )
  }

  return sortParts([...byId.values()])
}

/**
 * Lápida de parte. Quita de la lista los vídeos quitados a mano (por ejemplo,
 * al eliminar una parte de la serie). Sin este filtro, cualquier merge —el de la
 * sincronización con Drive o el de una búsqueda de capítulos— volvería a añadir
 * la parte desde la copia que todavía la tiene, igual que una serie borrada sin
 * `deletedAt` reaparecería. Una parte reañadida después del borrado (con un
 * `addedAt` más reciente) se conserva: la re-adición levanta su propia lápida.
 */
export function filterRemovedParts(
  parts: Part[],
  removed: Record<string, number> | undefined
): Part[] {
  if (!removed) return parts

  const kept = parts.filter((part) => {
    const removedAt = removed[part.videoId]
    return removedAt == null || part.addedAt > removedAt
  })
  return kept.length === parts.length ? parts : kept
}

/**
 * Une las lápidas de partes de dos copias quedándose con el borrado más
 * reciente de cada vídeo: si una copia borró y otra volvió a añadir después, la
 * re-adición (más nueva) gana al filtrar las partes.
 */
function combineRemovedParts(
  current: Record<string, number> | undefined,
  incoming: Record<string, number> | undefined
): Record<string, number> | undefined {
  const merged: Record<string, number> = { ...(current ?? {}) }

  for (const [videoId, removedAt] of Object.entries(incoming ?? {})) {
    const previous = merged[videoId]
    merged[videoId] = previous == null ? removedAt : Math.max(previous, removedAt)
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

/** Quita las lápidas de un vídeo vuelto a añadir a propósito. */
export function clearRemovedParts(
  removed: Record<string, number> | undefined,
  videoIds: Iterable<string>
): Record<string, number> | undefined {
  if (!removed) return removed

  const cleared = new Set(videoIds)
  const result: Record<string, number> = {}
  for (const [videoId, removedAt] of Object.entries(removed)) {
    if (!cleared.has(videoId)) result[videoId] = removedAt
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Deja solo las lápidas vigentes: una parte presente con un `addedAt` posterior
 * a su lápida se considera reañadida y descarta la suya.
 */
function keepPendingRemovals(
  removed: Record<string, number> | undefined,
  parts: Part[]
): Record<string, number> | undefined {
  if (!removed) return removed

  const lifted: string[] = []
  for (const part of parts) {
    const removedAt = removed[part.videoId]
    if (removedAt != null && part.addedAt > removedAt) lifted.push(part.videoId)
  }
  return clearRemovedParts(removed, lifted)
}

/** Aplica metadatos de un vídeo (descripción y duración) a una parte. */
export function applyPartMeta(series: Series, videoId: string, patch: PartMetaPatch): Series {
  const description = patch.description?.trim()
  const durationSeconds =
    typeof patch.durationSeconds === 'number' && patch.durationSeconds > 0
      ? patch.durationSeconds
      : undefined
  if (!description && durationSeconds == null) return series

  let changed = false
  const parts = series.parts.map((part) => {
    if (part.videoId !== videoId) return part

    const nextDescription = description || part.description
    const nextDuration = durationSeconds ?? part.durationSeconds
    if (nextDescription === part.description && nextDuration === part.durationSeconds) {
      return part
    }

    changed = true
    return {
      ...part,
      description: nextDescription,
      durationSeconds: nextDuration
    }
  })

  return changed ? { ...series, parts, updatedAt: Date.now() } : series
}

/** Rellena las duraciones que falten a partir de los metadatos de YouTube. */
export function applyPartDurations(series: Series, metas: Map<string, PartMetaPatch>): Series {
  let changed = false
  const parts = series.parts.map((part) => {
    if (part.durationSeconds != null) return part

    const meta = metas.get(part.videoId)
    if (!meta) return part

    const durationSeconds = meta.durationSeconds ?? part.durationSeconds
    const description = part.description ?? meta.description
    if (durationSeconds === part.durationSeconds && description === part.description) {
      return part
    }

    changed = true
    return { ...part, durationSeconds, description }
  })

  return changed ? { ...series, parts, updatedAt: Date.now() } : series
}

export function mergeSeries(
  existing: Series,
  draft: SeriesDraft,
  title: string,
  parts: Part[]
): Series {
  // Las partes elegidas a mano se consideran una re-adición: levantan su lápida
  // y dejan de estar descartadas, para que el merge de Drive no las borre.
  const selectedIds = new Set(parts.map((part) => part.videoId))
  const removedParts = clearRemovedParts(existing.removedParts, selectedIds)
  const discardedCandidates = (existing.discardedCandidates ?? []).filter(
    (videoId) => !selectedIds.has(videoId)
  )
  const mergedParts = filterRemovedParts(mergeParts(existing.parts, parts), removedParts)
  const existingPartIds = new Set(existing.parts.map((part) => part.videoId))
  const gainedParts = mergedParts.some((part) => !existingPartIds.has(part.videoId))
  const finalTitle = title.trim() || existing.title

  const aliases = mergeAliasesWithParts(existing.aliases, mergedParts, finalTitle)
  const channelTitle =
    existing.channelTitle === YOUTUBE_CHANNEL_FALLBACK && draft.channelTitle
      ? draft.channelTitle
      : existing.channelTitle

  return {
    ...existing,
    title: finalTitle,
    aliases,
    originCountry: shouldRedetectOriginCountry(
      existing.originCountry,
      existing.originCountryManual
    )
      ? detectSeriesOriginCountry({
          title: finalTitle,
          aliases,
          channelTitle,
          parts: mergedParts
        })
      : existing.originCountry,
    channelId: existing.channelId ?? draft.channelId,
    // «YouTube» es el valor por defecto cuando no se conoce el canal; si ahora
    // llega el canal real, se actualiza (igual que hace handleRefreshSeries).
    channelTitle,
    channelUrl: existing.channelUrl ?? draft.channelUrl,
    thumbnail: existing.thumbnail ?? draft.thumbnail ?? mergedParts[0]?.thumbnail,
    parts: mergedParts,
    discardedCandidates,
    removedParts,
    status: gainedParts
      ? reconcileCompletedStatus(existing.status, existing.watched, mergedParts)
      : existing.status,
    keywordConfidence: learnKeywordConfidence(
      existing.keywordConfidence,
      acceptedCandidateTitles(draft, parts, existingPartIds)
    ),
    updatedAt: Date.now()
  }
}

/**
 * Descarta un «completada» que ya no cubre todas las partes (por ejemplo, tras
 * añadir capítulos). Devuelve `undefined` para que el estado se recalcule solo a
 * partir del progreso, en lugar de anclarlo a un valor manual.
 */
export function reconcileCompletedStatus(
  status: SeriesStatus | undefined,
  watched: string[],
  parts: Part[]
): SeriesStatus | undefined {
  if (status !== 'completed') return status

  const watchedIds = new Set(watched)
  const hasUnwatched = parts.some((part) => !watchedIds.has(part.videoId))
  return hasUnwatched ? undefined : status
}

import {
  combineKeywordConfidence,
  learnKeywordConfidence,
  mergeAliasesWithParts,
  normalizeAliases,
  normalizeDiscardedCandidates,
  normalizeKeywordConfidence,
  normalizeRemovedParts
} from './seriesMetadata'

export {
  learnKeywordConfidence,
  mergeAliasesWithParts,
  normalizeAliases,
  normalizeDiscardedCandidates,
  normalizeKeywordConfidence,
  normalizeRemovedParts,
  youtubeTitleAliases
} from './seriesMetadata'
export function isSeries(value: unknown): value is Series {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    Array.isArray(item.parts) &&
    Array.isArray(item.watched)
  )
}

export function normalizeSeries(value: Series): Series {
  const now = Date.now()
  const title = value.title.trim() || 'Serie sin título'
  const aliases = normalizeAliases(value.aliases)
  const channelTitle = value.channelTitle || YOUTUBE_CHANNEL_FALLBACK
  const parts = keepOnlyLastFinal(
    value.parts
      .filter((part) => part && typeof part.videoId === 'string' && part.videoId.length > 0)
      .map((part) => ({
        videoId: part.videoId,
        title:
          typeof part.title === 'string' && part.title.length > 0
            ? part.title
            : YOUTUBE_VIDEO_FALLBACK_TITLE,
        description:
          typeof part.description === 'string'
            ? part.description.slice(0, MAX_PART_DESCRIPTION_LENGTH)
            : undefined,
        partNumber: typeof part.partNumber === 'number' ? part.partNumber : undefined,
        totalParts: typeof part.totalParts === 'number' ? part.totalParts : undefined,
        sortOrder:
          typeof part.sortOrder === 'number' &&
          Number.isFinite(part.sortOrder) &&
          part.sortOrder >= 0
            ? part.sortOrder
            : undefined,
        isFinal: Boolean(part.isFinal),
        durationSeconds:
          typeof part.durationSeconds === 'number' ? part.durationSeconds : undefined,
        publishedAt: typeof part.publishedAt === 'string' ? part.publishedAt : undefined,
        thumbnail: typeof part.thumbnail === 'string' ? part.thumbnail : undefined,
        playback: normalizePlaybackPosition(part.playback),
        addedAt: typeof part.addedAt === 'number' ? part.addedAt : now
      }))
  )

  const storedOriginCountry = normalizeOriginCountry(value.originCountry)
  const originCountryManual = value.originCountryManual === true
  // «Desconocido» no es definitivo: las series guardadas antes de existir la
  // detección (o sin metadatos suficientes) se vuelven a intentar al cargar.
  const originCountry = shouldRedetectOriginCountry(storedOriginCountry, originCountryManual)
    ? detectSeriesOriginCountry({ title, aliases, channelTitle, parts })
    : storedOriginCountry

  return {
    id: value.id,
    title,
    aliases,
    originCountry,
    originCountryManual,
    keywordConfidence: normalizeKeywordConfidence(value.keywordConfidence),
    semanticFingerprint: normalizeSemanticFingerprint(value.semanticFingerprint),
    channelId: value.channelId,
    channelTitle,
    channelUrl: value.channelUrl,
    thumbnail: value.thumbnail,
    parts,
    watched: value.watched.filter((id) => typeof id === 'string'),
    favorite: Boolean(value.favorite),
    tagIds: normalizeTagIds(value.tagIds),
    status:
      value.status === 'watching' || value.status === 'planned' || value.status === 'completed'
        ? value.status
        : undefined,
    discardedCandidates: normalizeDiscardedCandidates(value.discardedCandidates),
    removedParts: normalizeRemovedParts(value.removedParts),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    lastOpenedAt: typeof value.lastOpenedAt === 'number' ? value.lastOpenedAt : undefined,
    lastFavoritesRefreshAt:
      typeof value.lastFavoritesRefreshAt === 'number'
        ? value.lastFavoritesRefreshAt
        : undefined,
    deletedAt: typeof value.deletedAt === 'number' ? value.deletedAt : undefined
  }
}

/**
 * Elige qué favoritas se revisan en el botón masivo. Primero las que llevan más
 * tiempo sin buscarse (o nunca), y nunca más de `limit` para no agotar la cuota
 * diaria de YouTube en una sola pulsación.
 */
export function selectFavoritesForRefresh(
  favorites: Series[],
  now: number = Date.now(),
  limit = FAVORITES_REFRESH_MAX_SERIES,
  cooldownMs = FAVORITES_REFRESH_COOLDOWN_MS
): { selected: Series[]; skipped: number; remaining: number } {
  const pending = favorites.filter(
    (item) =>
      !item.lastFavoritesRefreshAt || now - item.lastFavoritesRefreshAt >= cooldownMs
  )
  const selected = [...pending]
    .sort((a, b) => (a.lastFavoritesRefreshAt ?? 0) - (b.lastFavoritesRefreshAt ?? 0))
    .slice(0, limit)

  return {
    selected,
    skipped: favorites.length - pending.length,
    remaining: pending.length - selected.length
  }
}

function sameStringSet(
  current: string[] | undefined,
  incoming: string[] | undefined
): boolean {
  const left = new Set(current ?? [])
  const right = new Set(incoming ?? [])
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

/**
 * Combina un campo usando la última copia sincronizada como base. Si solo una
 * de las copias lo cambió, gana esa; si ambas lo cambiaron, gana la más
 * reciente. Sin base (primera sincronización o importación) se usa LWW.
 */
function mergeField<T>(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series,
  pick: (series: Series) => T,
  equals: (a: T, b: T) => boolean = Object.is
): T {
  if (!base) return pick(newer)

  const currentValue = pick(current)
  const incomingValue = pick(incoming)
  const baseValue = pick(base)

  if (equals(currentValue, baseValue)) return incomingValue
  if (equals(incomingValue, baseValue)) return currentValue
  return pick(newer)
}

/**
 * Combina el estado manual. Sin base, una copia sin estado no debe borrar el
 * estado definido por la otra (por ejemplo, al recibir por primera vez una
 * serie marcada manualmente en otro dispositivo).
 */
function mergeStatus(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series
): SeriesStatus | undefined {
  if (!base) {
    if (current.status === undefined) return incoming.status
    if (incoming.status === undefined) return current.status
    return newer.status
  }

  if (current.status === base.status) return incoming.status
  if (incoming.status === base.status) return current.status
  return newer.status
}

/**
 * Combina las etiquetas asignadas a una serie. Sin base se usa la unión: una
 * primera sincronización no debe perder las etiquetas de ninguno de los dos
 * dispositivos.
 */
function mergeTagIds(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series
): string[] {
  if (!base) {
    return normalizeTagIds([...(current.tagIds ?? []), ...(incoming.tagIds ?? [])])
  }

  return normalizeTagIds(
    mergeField(base, current, incoming, newer, (item) => item.tagIds ?? [], sameStringSet)
  )
}

/**
 * Combina las partes quedándose con los campos de la copia preferida (la de
 * `updatedAt` más reciente) y conservando las partes que solo existan en la
 * otra. `mergeParts` hace que la segunda lista pise a la primera, así que se
 * pasa como preferida la copia más nueva; de lo contrario, una descarga de
 * Drive podría revertir un cambio local reciente en el título, la descripción
 * o el orden de una parte.
 */
function mergePartsForSync(
  current: Part[],
  incoming: Part[],
  preferIncoming: boolean
): Part[] {
  const preferred = preferIncoming ? incoming : current
  const fallback = preferIncoming ? current : incoming
  const merged = mergeParts(fallback, preferred)

  // `addedAt` se conserva con el valor más reciente de las dos copias: una
  // parte reañadida después de borrarse debe mantener la marca que levanta su
  // lápida, venga de la copia que venga.
  const addedById = new Map<string, number>()
  for (const part of [...current, ...incoming]) {
    const previous = addedById.get(part.videoId)
    addedById.set(
      part.videoId,
      previous == null ? part.addedAt : Math.max(previous, part.addedAt)
    )
  }

  return sortParts(
    merged.map((part) => ({
      ...part,
      addedAt: addedById.get(part.videoId) ?? part.addedAt
    }))
  )
}

export function combineSeries(current: Series, incoming: Series, base?: Series): Series {
  // En caso de empate gana la copia local: así un cambio hecho en este
  // dispositivo (por ejemplo el estado) no lo borra la copia de Drive, que
  // puede tener el mismo `updatedAt` sin reflejar ese cambio.
  const newer = incoming.updatedAt > current.updatedAt ? incoming : current
  const older = newer === incoming ? current : incoming
  const lastOpenedAt = Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0)
  // La marca del lote de favoritas se conserva aunque la copia ganadora no la
  // traiga (por ejemplo, un archivo de Drive creado antes de que existiera).
  const lastFavoritesRefreshAt = Math.max(
    current.lastFavoritesRefreshAt ?? 0,
    incoming.lastFavoritesRefreshAt ?? 0
  )
  const removedParts = combineRemovedParts(current.removedParts, incoming.removedParts)
  const parts = filterRemovedParts(
    // Un vídeo quitado a mano no vuelve desde la copia que aún lo tiene: la
    // lápida de la parte solo la levanta una re-adición posterior.
    mergePartsForSync(current.parts, incoming.parts, newer === incoming),
    removedParts
  )
  // Con la base se evita que un cambio en un campo (por ejemplo, marcar una
  // favorita) haga ganar toda la copia y pierda los capítulos vistos que el
  // otro dispositivo había subido.
  const watched = [
    ...new Set(
      mergeField(base, current, incoming, newer, (item) => item.watched, sameStringSet)
    )
  ]
  const aliases = normalizeAliases(
    mergeField(base, current, incoming, newer, (item) => item.aliases ?? [], sameStringSet)
  )
  const title = mergeField(base, current, incoming, newer, (item) => item.title)
  const favorite = mergeField(base, current, incoming, newer, (item) => item.favorite)
  const tagIds = mergeTagIds(base, current, incoming, newer)
  const mergedStatus = mergeStatus(base, current, incoming, newer)
  const thumbnail =
    mergeField(base, current, incoming, newer, (item) => item.thumbnail) ?? older.thumbnail
  const channelId =
    mergeField(base, current, incoming, newer, (item) => item.channelId) ?? older.channelId
  const channelTitle = mergeField(base, current, incoming, newer, (item) => item.channelTitle)
  const channelUrl =
    mergeField(base, current, incoming, newer, (item) => item.channelUrl) ?? older.channelUrl
  // Una elección manual gana a la detección automática. Si ambas copias la
  // marcan, gana la más reciente, y el flag se conserva al restaurar un
  // snapshot de Drive creado antes de que existiera.
  const originSource =
    current.originCountryManual === true && incoming.originCountryManual !== true
      ? current
      : incoming.originCountryManual === true && current.originCountryManual !== true
        ? incoming
        : newer
  const originCountryManual = originSource.originCountryManual === true
  const mergedOriginCountry =
    mergeField(base, current, incoming, newer, (item) => item.originCountry) ??
    older.originCountry
  const originCountry = originCountryManual
    ? (originSource.originCountry ?? mergedOriginCountry ?? 'unknown')
    : shouldRedetectOriginCountry(mergedOriginCountry, false)
      ? detectSeriesOriginCountry({ title, aliases, channelTitle, parts })
      : mergedOriginCountry

  return {
    ...older,
    ...newer,
    id: current.id,
    title,
    createdAt: Math.min(current.createdAt, incoming.createdAt),
    favorite,
    tagIds,
    aliases,
    originCountry,
    originCountryManual,
    keywordConfidence: combineKeywordConfidence(
      current.keywordConfidence,
      incoming.keywordConfidence
    ),
    semanticFingerprint: newer.semanticFingerprint ?? older.semanticFingerprint,
    // Los campos opcionales no deben perderse si la copia más nueva no los
    // trae (por ejemplo, un archivo de Drive creado antes de que existieran).
    channelId,
    channelUrl,
    channelTitle,
    thumbnail,
    parts,
    watched,
    // Se descarta un «completada» que ya no cubra todas las partes, para no
    // propagar una copia antigua con estado «completada» y progreso parcial.
    status: reconcileCompletedStatus(mergedStatus, watched, parts),
    discardedCandidates: [
      ...new Set([
        ...(current.discardedCandidates ?? []),
        ...(incoming.discardedCandidates ?? [])
      ])
    ],
    // Las lápidas de partes que ya levantó una re-adición posterior no se
    // propagan: así una parte vuelta a añadir no se borra en el siguiente sync.
    removedParts: keepPendingRemovals(removedParts, parts),
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
    lastOpenedAt: lastOpenedAt > 0 ? lastOpenedAt : undefined,
    lastFavoritesRefreshAt: lastFavoritesRefreshAt > 0 ? lastFavoritesRefreshAt : undefined,
    // El borrado es pegajoso: si una de las dos copias tiene lápida, la serie
    // queda borrada en ambas (no existe función para «desborrar»).
    deletedAt: earliest(current.deletedAt, incoming.deletedAt)
  }
}

function earliest(
  current: number | undefined,
  incoming: number | undefined
): number | undefined {
  if (current == null) return incoming
  if (incoming == null) return current
  return Math.min(current, incoming)
}

/**
 * Elimina definitivamente las lápidas con más de `maxAgeMs`. Pasado ese plazo
 * se asume que el borrado ya se ha propagado a los demás dispositivos, así que
 * la serie (y sus duplicados huérfanos al volver a añadirla) se puede purgar.
 */
export function pruneDeletedSeries(
  series: Series[],
  maxAgeMs: number = DELETED_SERIES_TTL,
  now: number = Date.now()
): Series[] {
  const kept = series.filter(
    (item) => item.deletedAt == null || now - item.deletedAt < maxAgeMs
  )
  return kept.length === series.length ? series : kept
}

export function mergeSeriesCollections(
  local: Series[],
  remote: Series[],
  base?: Series[]
): Series[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  const baseById = new Map((base ?? []).map((item) => [item.id, item]))

  for (const incoming of remote) {
    const previous = byId.get(incoming.id)
    byId.set(
      incoming.id,
      previous ? combineSeries(previous, incoming, baseById.get(incoming.id)) : incoming
    )
  }

  // Se descartan las lápidas antiguas para que no crezcan sin límite en
  // localStorage ni en el archivo de Drive.
  return pruneDeletedSeries([...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt))
}
