import { afterEach, vi } from 'vitest'
import { analyzeSemanticEntries, generateSemanticFingerprints } from './semanticAi'

const FINGERPRINT = {
  genres: ['romance'],
  tropes: ['revenge'],
  roles: ['consort'],
  settings: ['rural_village'],
  plotElements: ['rebirth']
}

function stubSemanticResponse(items: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ items })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('análisis semántico', () => {
  const entries = [{ id: 'series', text: 'Harem imperial, princesa consorte, renacimiento' }]

  it('lee el país inferido por la IA', async () => {
    stubSemanticResponse([{ id: 'series', fingerprint: FINGERPRINT, originCountry: 'CN' }])

    const analyses = await analyzeSemanticEntries('https://example.com/api', entries)

    expect(analyses.get('series')?.originCountry).toBe('CN')
    expect(analyses.get('series')?.fingerprint.genres).toEqual(['romance'])
  })

  it('conserva «Desconocido» cuando la IA no encuentra una señal', async () => {
    stubSemanticResponse([
      { id: 'series', fingerprint: FINGERPRINT, originCountry: 'unknown' }
    ])

    const analyses = await analyzeSemanticEntries('https://example.com/api', entries)

    expect(analyses.get('series')?.originCountry).toBe('unknown')
  })

  it('descarta países fuera del catálogo', async () => {
    stubSemanticResponse([{ id: 'series', fingerprint: FINGERPRINT, originCountry: 'Marte' }])

    const analyses = await analyzeSemanticEntries('https://example.com/api', entries)

    expect(analyses.get('series')?.originCountry).toBeUndefined()
    expect(analyses.get('series')?.fingerprint.tropes).toEqual(['revenge'])
  })

  it('mantiene la interfaz de solo fingerprints', async () => {
    stubSemanticResponse([{ id: 'series', fingerprint: FINGERPRINT, originCountry: 'KR' }])

    const fingerprints = await generateSemanticFingerprints('https://example.com/api', entries)

    expect(fingerprints.get('series')?.settings).toEqual(['rural_village'])
  })
})
