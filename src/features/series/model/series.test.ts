import type { Part, Series } from '../types'
import { FAVORITES_REFRESH_COOLDOWN_MS } from './constants'
import {
  combineSeries,
  normalizePlaybackPosition,
  normalizeSeries,
  pickPlaybackPosition,
  progressPercent,
  selectFavoritesForRefresh,
  seriesStatus,
  watchedCount
} from './series'

function makePart(videoId: string, overrides: Partial<Part> = {}): Part {
  return {
    videoId,
    title: `Parte ${videoId}`,
    addedAt: 1,
    ...overrides
  }
}

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    title: 'Serie de prueba',
    aliases: [],
    channelTitle: 'Canal',
    parts: [makePart('a'), makePart('b')],
    watched: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('series model', () => {
  it('calcula partes vistas y progreso', () => {
    const series = makeSeries({ watched: ['a'] })
    expect(watchedCount(series)).toBe(1)
    expect(progressPercent(series)).toBe(50)
  })

  it('deduce el estado según progreso y prioridad de completada', () => {
    expect(seriesStatus(makeSeries())).toBe('planned')
    expect(seriesStatus(makeSeries({ watched: ['a'] }))).toBe('watching')
    expect(seriesStatus(makeSeries({ watched: ['a', 'b'] }))).toBe('completed')
    // Todas vistas: manda sobre un estado manual no coherente.
    expect(seriesStatus(makeSeries({ watched: ['a', 'b'], status: 'watching' }))).toBe(
      'completed'
    )
  })

  it('normaliza posiciones de reproducción válidas y descarta inválidas', () => {
    expect(normalizePlaybackPosition({ seconds: 42.9, updatedAt: 100 })).toEqual({
      seconds: 42,
      updatedAt: 100
    })
    expect(normalizePlaybackPosition({ seconds: 0, updatedAt: 100 })).toBeUndefined()
    expect(normalizePlaybackPosition({ seconds: 10, updatedAt: -1 })).toBeUndefined()
    expect(normalizePlaybackPosition(null)).toBeUndefined()
  })

  it('elige la posición más reciente (o más avanzada si empatan)', () => {
    const older = { seconds: 50, updatedAt: 100 }
    const newer = { seconds: 20, updatedAt: 200 }
    const tieAhead = { seconds: 60, updatedAt: 100 }

    expect(pickPlaybackPosition(older, newer)).toEqual(newer)
    expect(pickPlaybackPosition(newer, older)).toEqual(newer)
    expect(pickPlaybackPosition(older, tieAhead)).toEqual(tieAhead)
    expect(pickPlaybackPosition(undefined, older)).toEqual(older)
  })

  it('selecciona favoritas por antigüedad, respetando cooldown y límite', () => {
    const now = 2_000_000_000
    const favorites = [
      makeSeries({ id: 'reciente', favorite: true, lastFavoritesRefreshAt: now - 1_000 }),
      makeSeries({
        id: 'antigua',
        favorite: true,
        lastFavoritesRefreshAt: now - FAVORITES_REFRESH_COOLDOWN_MS - 1
      }),
      makeSeries({ id: 'nunca', favorite: true }),
      makeSeries({ id: 'reciente-2', favorite: true, lastFavoritesRefreshAt: now - 10_000 }),
      makeSeries({ id: 'pendiente', favorite: true })
    ]

    const result = selectFavoritesForRefresh(favorites, now, 2)

    expect(result.selected.map((item) => item.id)).toEqual(['nunca', 'pendiente'])
    expect(result.skipped).toBe(2)
    expect(result.remaining).toBe(1)
  })

  it('conserva la marca del lote de favoritas al normalizar y sincronizar', () => {
    const markedAt = 987_654
    const local = makeSeries({ lastFavoritesRefreshAt: markedAt, updatedAt: 10 })
    const incoming = makeSeries({ updatedAt: 20 })

    expect(normalizeSeries(local).lastFavoritesRefreshAt).toBe(markedAt)
    expect(combineSeries(local, incoming).lastFavoritesRefreshAt).toBe(markedAt)
    expect(combineSeries(incoming, local).lastFavoritesRefreshAt).toBe(markedAt)
  })
})
