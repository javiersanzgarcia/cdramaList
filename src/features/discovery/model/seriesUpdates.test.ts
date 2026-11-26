import { describe, expect, it } from 'vitest'
import { pickSearchQueries } from './seriesUpdates'

describe('pickSearchQueries', () => {
  it('respeta el límite de búsquedas globales y quita duplicados', () => {
    expect(pickSearchQueries([' drama ', 'DRAMA', 'alias', 'parte'], 2)).toEqual([
      'drama',
      'alias'
    ])
  })

  it('usa cuatro búsquedas por defecto', () => {
    expect(pickSearchQueries(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd'])
  })
})
