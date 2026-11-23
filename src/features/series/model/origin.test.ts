import { detectOriginCountryFromText, detectSeriesOriginCountry } from './origin'
import { normalizeSeries } from './series'
import type { Part, Series } from '../types'

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
    parts: [makePart('a')],
    watched: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('país de origen', () => {
  it.each([
    ['cdrama', 'CN'],
    ['drama chino', 'CN'],
    ['kdrama', 'KR'],
    ['serie coreana', 'KR'],
    ['jdrama', 'JP'],
    ['dorama', 'JP'],
    ['lakorn', 'TH'],
    ['serie tailandesa', 'TH'],
    ['dizi turco', 'TR'],
    ['serie filipina', 'PH'],
    ['drama taiwanés', 'TW']
  ] as const)('detecta %s como %s', (text, expected) => {
    expect(detectOriginCountryFromText(text)).toBe(expected)
  })

  it('marca Desconocido si no hay señal o hay varias', () => {
    expect(detectOriginCountryFromText('Una historia sin pistas')).toBe('unknown')
    expect(detectOriginCountryFromText('kdrama y drama chino')).toBe('unknown')
  })

  it('detecta el país al normalizar series antiguas sin el campo', () => {
    expect(normalizeSeries(makeSeries({ title: 'Kdrama de prueba' })).originCountry).toBe('KR')
    expect(normalizeSeries(makeSeries({ title: 'Serie misteriosa' })).originCountry).toBe(
      'unknown'
    )
  })

  it('respeta el país elegido a mano aunque el texto diga otra cosa', () => {
    const normalized = normalizeSeries(
      makeSeries({ title: 'Kdrama de prueba', originCountry: 'CN' })
    )
    expect(normalized.originCountry).toBe('CN')
  })

  it('detecta el país desde la ficha (título, alias y canal)', () => {
    expect(
      detectSeriesOriginCountry({
        title: 'Sin pista',
        aliases: ['Drama chino famoso'],
        channelTitle: 'Canal',
        parts: []
      })
    ).toBe('CN')
    expect(
      detectSeriesOriginCountry({
        title: 'Sin pista',
        aliases: [],
        channelTitle: 'Canal de dramas turcos',
        parts: []
      })
    ).toBe('TR')
  })
})
