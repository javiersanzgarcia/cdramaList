import { describe, expect, it } from 'vitest'
import { buildSeriesUpdateQueries, pickSearchQueries } from './seriesUpdates'

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

  it('incluye el título original dentro del límite de búsquedas', () => {
    const queries = buildSeriesUpdateQueries({
      title: 'Drama Coreano',
      originalTitles: ['Korean Original Title'],
      manualAliases: ['Alias Manual'],
      descriptionTitles: ['Descripcion Titulo'],
      partTitles: ['Parte Uno'],
      maxSearches: 2
    })

    expect(queries).toEqual(['Drama Coreano', 'Korean Original Title'])
  })

  it('no repite el título original si coincide con el de la serie', () => {
    const queries = buildSeriesUpdateQueries({
      title: 'Drama Coreano',
      originalTitles: [' drama coreano ', 'Otro Original'],
      maxSearches: 3
    })

    expect(queries).toEqual(['Drama Coreano', 'Otro Original'])
  })
})
