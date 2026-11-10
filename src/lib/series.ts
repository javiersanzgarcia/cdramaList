import type { Filter, Part, Series, SeriesDraft, SeriesStatus } from '../types'
import { sortParts, titleSimilarity } from './parts'
import { statusOrder } from './status'

export function watchedCount(series: Series): number {
  return series.parts.filter((part) => series.watched.includes(part.videoId)).length
}

export function seriesStatus(series: Series): SeriesStatus {
  const total = series.parts.length
  const watched = watchedCount(series)

  if (total > 0 && watched >= total) return 'completed'
  if (watched > 0 || series.lastOpenedAt) return 'watching'
  return 'planned'
}

export function progressPercent(series: Series): number {
  if (series.parts.length === 0) return 0
  return Math.round((watchedCount(series) / series.parts.length) * 100)
}

export function nextPartIndex(series: Series): number {
  const index = series.parts.findIndex((part) => !series.watched.includes(part.videoId))
  return index === -1 ? 0 : index
}

export function isSeriesComplete(series: Series): boolean {
  return series.parts.length > 0 && watchedCount(series) >= series.parts.length
}

export function progressLabel(series: Series): string {
  return `${watchedCount(series)}/${series.parts.length}`
}

export function filterSeries(series: Series[], query: string, filter: Filter): Series[] {
  const term = query.trim().toLowerCase()

  return series.filter((item) => {
    const matchesQuery =
      term.length === 0 ||
      item.title.toLowerCase().includes(term) ||
      (item.aliases ?? []).some((alias) => alias.toLowerCase().includes(term)) ||
      item.channelTitle.toLowerCase().includes(term)

    const matchesFilter =
      filter === 'all' ||
      (filter === 'favorites' ? item.favorite : seriesStatus(item) === filter)

    return matchesQuery && matchesFilter
  })
}

export function groupSeries(series: Series[]): Record<SeriesStatus, Series[]> {
  const groups: Record<SeriesStatus, Series[]> = {
    watching: [],
    planned: [],
    completed: [],
  }

  for (const item of series) {
    groups[seriesStatus(item)].push(item)
  }

  for (const status of statusOrder) {
    groups[status].sort(
      (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
    )
  }

  return groups
}

export function continueWatching(series: Series[]): Series[] {
  return series
    .filter((item) => seriesStatus(item) === 'watching')
    .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt))
}

export function findExistingSeries(
  series: Series[],
  draft: SeriesDraft,
): Series | undefined {
  if (draft.existingSeriesId) {
    return series.find((item) => item.id === draft.existingSeriesId)
  }

  const draftIds = new Set(draft.parts.map((part) => part.videoId))
  const byPart = series.find((item) =>
    item.parts.some((part) => draftIds.has(part.videoId)),
  )
  if (byPart) return byPart

  const matches = series
    .filter((item) => {
      const similarity = titleSimilarity(item.title, draft.title)
      if (similarity < 0.6) return false

      if (draft.channelId && item.channelId) {
        return draft.channelId === item.channelId
      }

      const sameChannelName =
        !draft.channelTitle ||
        !item.channelTitle ||
        draft.channelTitle === item.channelTitle ||
        draft.channelTitle === 'YouTube' ||
        item.channelTitle === 'YouTube'

      return sameChannelName && similarity >= 0.75
    })
    .sort(
      (a, b) =>
        titleSimilarity(b.title, draft.title) - titleSimilarity(a.title, draft.title),
    )

  return matches[0]
}

export function createSeries(draft: SeriesDraft, title: string, parts: Part[]): Series {
  const now = Date.now()
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `series_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    title: title.trim() || draft.title,
    aliases: [],
    channelId: draft.channelId,
    channelTitle: draft.channelTitle,
    channelUrl: draft.channelUrl,
    thumbnail: draft.thumbnail ?? parts[0]?.thumbnail,
    parts: sortParts(parts),
    watched: [],
    favorite: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function mergeParts(existing: Part[], incoming: Part[]): Part[] {
  const byId = new Map(existing.map((part) => [part.videoId, part]))

  for (const part of incoming) {
    const previous = byId.get(part.videoId)
    byId.set(
      part.videoId,
      previous
        ? { ...previous, ...part, addedAt: previous.addedAt }
        : part,
    )
  }

  return sortParts([...byId.values()])
}

export function mergeSeries(
  existing: Series,
  draft: SeriesDraft,
  title: string,
  parts: Part[],
): Series {
  const mergedParts = mergeParts(existing.parts, parts)

  return {
    ...existing,
    title: title.trim() || existing.title,
    channelId: existing.channelId ?? draft.channelId,
    channelTitle: existing.channelTitle || draft.channelTitle,
    channelUrl: existing.channelUrl ?? draft.channelUrl,
    thumbnail: existing.thumbnail ?? draft.thumbnail ?? mergedParts[0]?.thumbnail,
    parts: mergedParts,
    updatedAt: Date.now(),
  }
}

export const MAX_SERIES_ALIASES = 12

/**
 * Limpia la lista de alias: cadenas recortadas, sin duplicados (sin distinguir
 * mayúsculas) y con un límite para no disparar la consulta de búsqueda.
 */
export function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const result: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry !== 'string') continue

    const alias = entry.trim().replace(/\s+/g, ' ').slice(0, 120)
    if (alias.length < 2) continue

    const key = alias.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(alias)
    if (result.length >= MAX_SERIES_ALIASES) break
  }

  return result
}

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

  return {
    id: value.id,
    title: value.title.trim() || 'Serie sin título',
    aliases: normalizeAliases(value.aliases),
    channelId: value.channelId,
    channelTitle: value.channelTitle || 'YouTube',
    channelUrl: value.channelUrl,
    thumbnail: value.thumbnail,
    parts: value.parts
      .filter(
        (part) => part && typeof part.videoId === 'string' && part.videoId.length > 0,
      )
      .map((part) => ({
        videoId: part.videoId,
        title:
          typeof part.title === 'string' && part.title.length > 0
            ? part.title
            : 'Vídeo de YouTube',
        partNumber:
          typeof part.partNumber === 'number' ? part.partNumber : undefined,
        totalParts: typeof part.totalParts === 'number' ? part.totalParts : undefined,
        isFinal: Boolean(part.isFinal),
        durationSeconds:
          typeof part.durationSeconds === 'number' ? part.durationSeconds : undefined,
        publishedAt:
          typeof part.publishedAt === 'string' ? part.publishedAt : undefined,
        thumbnail: typeof part.thumbnail === 'string' ? part.thumbnail : undefined,
        addedAt: typeof part.addedAt === 'number' ? part.addedAt : now,
      })),
    watched: value.watched.filter((id) => typeof id === 'string'),
    favorite: Boolean(value.favorite),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    lastOpenedAt:
      typeof value.lastOpenedAt === 'number' ? value.lastOpenedAt : undefined,
  }
}

export function combineSeries(current: Series, incoming: Series): Series {
  const newer = incoming.updatedAt >= current.updatedAt ? incoming : current
  const older = newer === incoming ? current : incoming
  const lastOpenedAt = Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0)

  return {
    ...older,
    ...newer,
    id: current.id,
    createdAt: Math.min(current.createdAt, incoming.createdAt),
    favorite: current.favorite || incoming.favorite,
    aliases: normalizeAliases([
      ...(current.aliases ?? []),
      ...(incoming.aliases ?? []),
    ]),
    parts: mergeParts(current.parts, incoming.parts),
    watched: [...new Set([...current.watched, ...incoming.watched])],
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
    lastOpenedAt: lastOpenedAt > 0 ? lastOpenedAt : undefined,
  }
}

export function mergeSeriesCollections(local: Series[], remote: Series[]): Series[] {
  const byId = new Map(local.map((item) => [item.id, item]))

  for (const incoming of remote) {
    const previous = byId.get(incoming.id)
    byId.set(incoming.id, previous ? combineSeries(previous, incoming) : incoming)
  }

  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

