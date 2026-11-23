import { readCachedAiOrigin, writeCachedAiOrigin } from './originAiCache'

describe('caché del país inferido', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('recuerda tanto un país como un Desconocido', () => {
    writeCachedAiOrigin('Harem imperial, princesa consorte', 'CN')
    writeCachedAiOrigin('Historia sin pistas', 'unknown')

    expect(readCachedAiOrigin('Harem imperial, princesa consorte')).toBe('CN')
    expect(readCachedAiOrigin('Historia sin pistas')).toBe('unknown')
  })

  it('no confunde textos distintos', () => {
    writeCachedAiOrigin('Drama coreano', 'KR')

    expect(readCachedAiOrigin('Drama chino')).toBeUndefined()
  })
})
