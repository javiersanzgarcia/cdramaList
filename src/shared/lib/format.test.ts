import { formatDate, formatDuration, parseIsoDuration } from './format'

describe('format', () => {
  describe('parseIsoDuration', () => {
    it('devuelve segundos para duraciones ISO válidas', () => {
      expect(parseIsoDuration('PT1M30S')).toBe(90)
      expect(parseIsoDuration('PT2H5M1S')).toBe(7501)
      expect(parseIsoDuration('PT45S')).toBe(45)
      expect(parseIsoDuration('P1DT1H')).toBe(90_000)
    })

    it('devuelve undefined para valores vacíos o no parseables', () => {
      expect(parseIsoDuration()).toBeUndefined()
      expect(parseIsoDuration('')).toBeUndefined()
      expect(parseIsoDuration('nope')).toBeUndefined()
      expect(parseIsoDuration('PT0S')).toBeUndefined()
    })
  })

  describe('formatDuration', () => {
    it('formatea minutos y segundos', () => {
      expect(formatDuration(90)).toBe('1:30')
      expect(formatDuration(5)).toBe('0:05')
    })

    it('formatea horas cuando corresponde', () => {
      expect(formatDuration(3661)).toBe('1:01:01')
    })

    it('devuelve undefined para duraciones inválidas o vacías', () => {
      expect(formatDuration()).toBeUndefined()
      expect(formatDuration(0)).toBeUndefined()
      expect(formatDuration(-10)).toBeUndefined()
    })
  })

  describe('formatDate', () => {
    it('devuelve undefined para fechas inválidas', () => {
      expect(formatDate()).toBeUndefined()
      expect(formatDate('fecha-rara')).toBeUndefined()
    })

    it('formatea una fecha ISO válida', () => {
      const result = formatDate('2026-11-20T10:00:00.000Z')
      expect(result).toEqual(expect.any(String))
      expect(result).toMatch(/2026/)
    })
  })
})
