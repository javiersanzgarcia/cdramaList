import {
  detectOriginCountryFromMetadata,
  detectOriginCountryFromText,
  detectSeriesOriginCountry,
  shouldRedetectOriginCountry
} from './origin'
import { combineSeries, normalizeSeries } from './series'
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

  it('detecta el país desde descripciones y tags de YouTube', () => {
    expect(
      detectOriginCountryFromMetadata({
        title: 'La historia',
        channelTitle: 'Canal',
        videos: [
          {
            description: 'This is a Chinese drama with English subtitles.',
            tags: ['c drama', 'chinese']
          }
        ]
      })
    ).toBe('CN')
  })

  it('elige la señal mayoritaria y marca Desconocido si hay empate', () => {
    expect(
      detectOriginCountryFromMetadata({
        title: 'Sin pista',
        videos: [{ title: 'Kdrama' }, { title: 'Korean drama' }, { title: 'drama chino' }]
      })
    ).toBe('KR')
    expect(
      detectOriginCountryFromMetadata({
        title: 'Sin pista',
        videos: [{ title: 'Kdrama' }, { title: 'drama chino' }]
      })
    ).toBe('unknown')
  })

  it('vuelve a detectar el país al cargar una serie guardada como Desconocido', () => {
    const normalized = normalizeSeries(
      makeSeries({
        title: 'Serie misteriosa',
        parts: [makePart('a', { description: 'Un drama chino' })],
        originCountry: 'unknown'
      })
    )
    expect(normalized.originCountry).toBe('CN')
  })

  it('no pisa una elección manual aunque el valor sea Desconocido', () => {
    const normalized = normalizeSeries(
      makeSeries({
        title: 'Kdrama de prueba',
        originCountry: 'unknown',
        originCountryManual: true
      })
    )
    expect(normalized.originCountry).toBe('unknown')
    expect(normalized.originCountryManual).toBe(true)
  })

  it('solo vuelve a detectar si no es manual y falta o es Desconocido', () => {
    expect(shouldRedetectOriginCountry(undefined, undefined)).toBe(true)
    expect(shouldRedetectOriginCountry('unknown', undefined)).toBe(true)
    expect(shouldRedetectOriginCountry('CN', undefined)).toBe(false)
    expect(shouldRedetectOriginCountry('unknown', true)).toBe(false)
  })

  it('conserva el país manual al fusionar copias de Drive', () => {
    const local = makeSeries({
      title: 'Kdrama de prueba',
      originCountry: 'CN',
      originCountryManual: true,
      updatedAt: 10
    })
    const remote = makeSeries({
      title: 'Kdrama de prueba',
      originCountry: 'KR',
      updatedAt: 20
    })

    const merged = combineSeries(local, remote)
    expect(merged.originCountry).toBe('CN')
    expect(merged.originCountryManual).toBe(true)
  })

  it('redetecta al fusionar series antiguas guardadas como Desconocido', () => {
    const local = makeSeries({
      title: 'Kdrama de prueba',
      originCountry: 'unknown',
      updatedAt: 10
    })
    const remote = makeSeries({
      title: 'Kdrama de prueba',
      originCountry: 'unknown',
      updatedAt: 10
    })

    expect(combineSeries(local, remote).originCountry).toBe('KR')
  })
})
