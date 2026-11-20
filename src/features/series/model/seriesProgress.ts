import type { Filter, Series, SeriesSort, SeriesStatus } from '../types'
import { statusOrder } from './status'

export function watchedCount(series: Series): number {
  return series.parts.filter((part) => series.watched.includes(part.videoId)).length
}

/**
 * Estado efectivo de una serie. Es la única fuente de verdad (la usan el badge,
 * los filtros, «Continuar viendo» y el agrupado de «Mi lista»).
 *
 * Prioridad:
 * 1. Todas las partes vistas ⇒ «completada», aunque haya estado manual: el
 *    progreso y el estado nunca deben contradecirse.
 * 2. Estado elegido a mano, si no contradice lo anterior.
 * 3. Automático: «en curso» con algo de progreso, «pendiente» si no hay nada.
 */
export function seriesStatus(series: Series): SeriesStatus {
  const total = series.parts.length
  const watched = watchedCount(series)

  if (total > 0 && watched >= total) return 'completed'

  // Un «completada» manual que ya no cubre todas las partes (por ejemplo, tras
  // añadir capítulos) se ignora y se recalcula; uno sin partes se respeta.
  if (series.status === 'completed') {
    if (total === 0) return 'completed'
    return watched > 0 || series.lastOpenedAt ? 'watching' : 'planned'
  }

  if (series.status) return series.status

  // Automático: con algo de progreso (parte vista o reproducida), en curso.
  if (watched > 0 || series.lastOpenedAt) return 'watching'

  return 'planned'
}

export function progressPercent(series: Series): number {
  if (series.parts.length === 0) return 0
  return Math.round((watchedCount(series) / series.parts.length) * 100)
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
    completed: []
  }

  for (const item of series) {
    groups[seriesStatus(item)].push(item)
  }

  for (const status of statusOrder) {
    groups[status].sort(
      (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)
    )
  }

  return groups
}

export function continueWatching(series: Series[]): Series[] {
  return sortSeriesByRecent(series.filter((item) => seriesStatus(item) === 'watching'))
}

/** Ordena por la última vez que se abrió o modificó la serie. */
export function sortSeriesByRecent(series: Series[]): Series[] {
  return [...series].sort(
    (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)
  )
}

/**
 * Aplica el criterio elegido en «Mi lista». Los criterios secundarios usan la
 * actividad reciente para desempatar, así que el orden anterior se conserva
 * cuando dos series tienen el mismo título, progreso o favorito.
 */
export function sortSeries(series: Series[], sort: SeriesSort): Series[] {
  const ordered = sortSeriesByRecent(series)

  switch (sort) {
    case 'created':
      return ordered.sort((a, b) => b.createdAt - a.createdAt)
    case 'title':
      return ordered.sort((a, b) =>
        a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true })
      )
    case 'progress':
      return ordered.sort((a, b) => progressPercent(b) - progressPercent(a))
    case 'favorites':
      return ordered.sort((a, b) => Number(b.favorite) - Number(a.favorite))
    default:
      return ordered
  }
}
