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

/** Códigos de idioma que YouTube declara en `snippet.defaultLanguage`. */
const LANGUAGE_COUNTRY: Record<string, SeriesOriginCountry> = {
  ko: 'KR',
  ja: 'JP',
  th: 'TH',
  tr: 'TR',
  tl: 'PH',
  fil: 'PH',
  zh: 'CN',
  'zh-cn': 'CN',
  'zh-hans': 'CN',
  'zh-tw': 'TW',
  'zh-hant': 'TW'
}

function detectOriginCountryFromLanguage(defaultLanguage?: string): SeriesOriginCountry {
  if (!defaultLanguage) return 'unknown'
  return LANGUAGE_COUNTRY[defaultLanguage.toLowerCase().trim()] ?? 'unknown'
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
      /\bsur\s?corean(?:o|a|os|as)\b/,
      /\bcorea(?:\s+del\s+sur)?\b/,
      /\bsouth\s+korea\b/,
      /\bkorean\b/,
      /\bhan(?:kook)?\s+drama\b/
    ]
  },
  {
    country: 'CN',
    patterns: [
      /\bc[-\s]?dramas?\b/,
      /\bcdramas?\b/,
      /\bdramas?\s+chin(?:o|a|os|as)\b/,
      /\bchin(?:o|a|os|as)\b/,
      /\bchina\b/,
      /\bchinese\b/,
      /\bmandarin\b/,
      /\bnovela\s+china\b/,
      /\bserie\s+china\b/,
      /\bcn[-\s]?dramas?\b/,
      /\bxianxia\b/,
      /\bwuxia\b/
    ]
  },
  {
    country: 'JP',
    patterns: [
      /\bj[-\s]?dramas?\b/,
      /\bdramas?\s+japon(?:es|esa|eses|esas)\b/,
      /\bjapon(?:es|esa|eses|esas)\b/,
      /\bjapan\b/,
      /\bjapanese\b/
      // «Dorama» se usa en español para cualquier drama asiático, no solo el
      // japonés: contarlo como Japón daba falsos empates con «dorama chino».
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
      /\bdizi(?:s|ler)?\b/,
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

/**
 * Detecta el país usando todos los metadatos disponibles de una serie: título,
 * alias, canal, títulos de partes, descripciones y tags de YouTube. Las
 * descripciones y los tags suelen ser la única pista cuando el título está
 * traducido al español.
 */
export function detectOriginCountryFromMetadata({
  title,
  aliases = [],
  channelTitle,
  videos = []
}: {
  title?: string
  aliases?: string[]
  channelTitle?: string
  videos?: Array<{
    title?: string
    description?: string
    tags?: string[]
    defaultLanguage?: string
  }>
}): SeriesOriginCountry {
  // El idioma declarado por YouTube es una señal directa y fiable. Si todos los
  // vídeos que lo indican coinciden, gana antes que el texto promocional.
  const languages = [
    ...new Set(
      videos
        .map((video) => detectOriginCountryFromLanguage(video.defaultLanguage))
        .filter((value) => value !== 'unknown')
    )
  ]
  if (languages.length === 1) return languages[0]

  const perSource = [
    detectOriginCountryFromText(title, ...aliases, channelTitle),
    ...videos.map((video) =>
      detectOriginCountryFromText(video.title, video.description, ...(video.tags ?? []))
    )
  ].filter((value) => value !== 'unknown')

  // Si todas las fuentes que han dado una pista coinciden, se acepta. Si hay
  // contradicción entre fuentes, se prefiere la que más apariciones tiene;
  // si empatan, `Desconocido` para no inventar.
  const counts = new Map<SeriesOriginCountry, number>()
  for (const value of perSource) counts.set(value, (counts.get(value) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (ranked.length === 0) return 'unknown'
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return 'unknown'
  return ranked[0][0]
}

/** Detecta el país de origen de una serie usando sus metadatos disponibles. */
export function detectSeriesOriginCountry(
  series: Pick<Series, 'title' | 'aliases' | 'channelTitle' | 'parts'>
): SeriesOriginCountry {
  return detectOriginCountryFromMetadata({
    title: series.title,
    aliases: series.aliases,
    channelTitle: series.channelTitle,
    videos: series.parts.slice(0, 5).map((part) => ({
      title: part.title,
      description: part.description
    }))
  })
}

/**
 * Indica si merece la pena volver a detectar el país. `unknown` no es un valor
 * definitivo: puede venir de una serie antigua creada antes de que existiera
 * esta función o de una búsqueda sin metadatos suficientes.
 */
export function shouldRedetectOriginCountry(
  originCountry: SeriesOriginCountry | undefined,
  manual: boolean | undefined
): boolean {
  return !manual && (originCountry === undefined || originCountry === 'unknown')
}
