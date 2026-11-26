import type { Series } from '../../series/types'
import { syncSignature } from './drive'

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    title: 'Serie de prueba',
    aliases: [],
    channelTitle: 'Canal',
    parts: [],
    watched: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('syncSignature', () => {
  it('incluye la marca de actualización de favoritas', () => {
    const series = makeSeries()
    expect(syncSignature([series])).not.toBe(
      syncSignature([{ ...series, lastFavoritesRefreshAt: 1_234 }])
    )
  })
})
