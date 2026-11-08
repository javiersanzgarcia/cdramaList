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
