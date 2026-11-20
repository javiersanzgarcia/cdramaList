import type { Part, Series } from '../types'
import {
  normalizePlaybackPosition,
  pickPlaybackPosition,
  progressPercent,
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
})
