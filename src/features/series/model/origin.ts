import type { Series, SeriesOriginCountry } from '../types'

export interface OriginCountryOption {
  value: SeriesOriginCountry
  label: string
  shortLabel: string
}

export const ORIGIN_COUNTRY_OPTIONS: OriginCountryOption[] = [
  { value: 'CN', label: 'China', shortLabel: 'CN' },
  { value: 'KR', label: 'Corea del Sur', shortLabel: 'KR' },
  { value: 'JP', label: 'Japón', shortLabel: 'JP' },
  { value: 'TH', label: 'Tailandia', shortLabel: 'TH' },
  { value: 'TR', label: 'Turquía', shortLabel: 'TR' },
  { value: 'PH', label: 'Filipinas', shortLabel: 'PH' },
  { value: 'TW', label: 'Taiwán', shortLabel: 'TW' },
  { value: 'other', label: 'Otro', shortLabel: 'Otro' },
  { value: 'unknown', label: 'Desconocido', shortLabel: '?' }
]

const ORIGIN_VALUES = new Set<SeriesOriginCountry>(
  ORIGIN_COUNTRY_OPTIONS.map((option) => option.value)
)

export function normalizeOriginCountry(value: unknown): SeriesOriginCountry | undefined {
  if (typeof value !== 'string') return undefined
  return ORIGIN_VALUES.has(value as SeriesOriginCountry)
    ? (value as SeriesOriginCountry)
    : undefined
}

export function originCountryLabel(value: SeriesOriginCountry | undefined): string {
  return (
    ORIGIN_COUNTRY_OPTIONS.find((option) => option.value === value)?.label ?? 'Desconocido'
  )
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

const RULES: Array<{
  country: Exclude<SeriesOriginCountry, 'other' | 'unknown'>
  patterns: RegExp[]
}> = [
  {
    country: 'KR',
    patterns: [
      /\bk[-\s]?dramas?\b/,
      /\bdramas?\s+corean(?:o|a|os|as)\b/,
      /\bcorean(?:o|a|os|as)\b/,
      /\bcorea\s+del\s+sur\b/,
      /\bsouth\s+korea\b/,
      /\bkorean\b/
    ]
  },
  {
    country: 'CN',
    patterns: [
      /\bc[-\s]?dramas?\b/,
      /\bdramas?\s+chin(?:o|a|os|as)\b/,
      /\bchin(?:o|a|os|as)\b/,
      /\bchina\b/,
      /\bchinese\b/,
      /\bmandarin\b/
    ]
  },
  {
    country: 'JP',
    patterns: [
      /\bj[-\s]?dramas?\b/,
      /\bdramas?\s+japon(?:es|esa|eses|esas)\b/,
      /\bjapon(?:es|esa|eses|esas)\b/,
      /\bjapan\b/,
      /\bjapanese\b/,
      /\bdorama(?:s)?\b/
    ]
  },
  {
    country: 'TW',
    patterns: [
      /\btw[-\s]?dramas?\b/,
      /\bdramas?\s+taiwan(?:es|esa|eses|esas)\b/,
      /\btaiwan(?:es|esa|eses|esas)\b/,
      /\btaiwan\b/,
      /\btaiwanese\b/
    ]
  },
  {
    country: 'TH',
    patterns: [
      /\blakorn(?:s)?\b/,
      /\bdramas?\s+tailand(?:es|esa|eses|esas)\b/,
      /\btailand(?:es|esa|eses|esas)\b/,
      /\bthailand\b/,
      /\bthai\b/
    ]
  },
  {
    country: 'TR',
    patterns: [
      /\bdizi(?:s)?\b/,
      /\bdramas?\s+turc(?:o|a|os|as)\b/,
      /\bturc(?:o|a|os|as)\b/,
      /\bturkey\b/,
      /\bturkish\b/,
      /\bturquia\b/
    ]
  },
  {
    country: 'PH',
    patterns: [
      /\bdramas?\s+filipin(?:o|a|os|as)\b/,
      /\bfilipin(?:o|a|os|as)\b/,
      /\bphilippines\b/,
      /\bfilipino\b/,
      /\bpinoy\b/
    ]
  }
]

/** Detecta el país de origen a partir de texto. Devuelve `unknown` si no hay señal fiable. */
export function detectOriginCountryFromText(
  ...values: Array<string | undefined>
): SeriesOriginCountry {
  const text = normalizeText(values.filter(Boolean).join(' \n '))
  if (!text) return 'unknown'

  const matches = RULES.filter((rule) => hasAny(text, rule.patterns)).map(
    (rule) => rule.country
  )
  const unique = [...new Set(matches)]

  if (unique.length === 1) return unique[0]
  return 'unknown'
}

/** Detecta el país de origen de una serie usando sus metadatos disponibles. */
export function detectSeriesOriginCountry(
  series: Pick<Series, 'title' | 'aliases' | 'channelTitle' | 'parts'>
): SeriesOriginCountry {
  const partTitles = series.parts.slice(0, 3).map((part) => part.title)
  return detectOriginCountryFromText(
    series.title,
    ...(series.aliases ?? []),
    series.channelTitle,
    ...partTitles
  )
}
