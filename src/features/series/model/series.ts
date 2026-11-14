import type { Filter, Part, PartMetaPatch, Series, SeriesDraft, SeriesStatus } from '../types'
import { normalizeSemanticFingerprint } from '../../discovery/model/semanticAi'
import {
  YOUTUBE_CHANNEL_FALLBACK,
  YOUTUBE_VIDEO_FALLBACK_TITLE
} from '../../discovery/model/constants'
import { sortParts, stripPartMarkers } from './parts'
import { extractKeywords, titleSimilarity } from './titleMatching'
import { statusOrder } from './status'
import { normalizeTagIds } from '../../tags/model/tags'
import {
  DELETED_SERIES_TTL,
  MAX_ALIAS_LENGTH,
  MAX_KEYWORD_CONFIDENCE,
  MAX_KEYWORD_CONFIDENCE_ENTRIES,
  MAX_PART_DESCRIPTION_LENGTH,
  MAX_SERIES_ALIASES,
  MIN_ALIAS_LENGTH,
  MIN_SERIES_TITLE_LENGTH,
  SERIES_MATCH_MIN_SIMILARITY,
  SERIES_MATCH_SAME_CHANNEL_SIMILARITY
} from './constants'

export function watchedCount(series: Series): number {
  return series.parts.filter((part) => series.watched.includes(part.videoId)).length
}

/**
 * Estado efectivo de una serie. Es la única fuente de verdad (la usan el badge,
 * los filtros, «Continuar viendo» y el agrupado de «Mi lista»).
 *
 * Prioridad:
 * 1. Todas las partes vistas ⇒ «completada», aunque haya estado manual: el
 *    progreso y el estado nunca deben contradecirse.
 * 2. Estado elegido a mano, si no contradice lo anterior.
 * 3. Automático: «en curso» con algo de progreso, «pendiente» si no hay nada.
 */
export function seriesStatus(series: Series): SeriesStatus {
  const total = series.parts.length
  const watched = watchedCount(series)

  if (total > 0 && watched >= total) return 'completed'

  // Un «completada» manual que ya no cubre todas las partes (por ejemplo, tras
  // añadir capítulos) se ignora y se recalcula; uno sin partes se respeta.
  if (series.status === 'completed') {
    if (total === 0) return 'completed'
    return watched > 0 || series.lastOpenedAt ? 'watching' : 'planned'
  }

  if (series.status) return series.status

  // Automático: con algo de progreso (parte vista o reproducida), en curso.
  if (watched > 0 || series.lastOpenedAt) return 'watching'

  return 'planned'
}

export function progressPercent(series: Series): number {
  if (series.parts.length === 0) return 0
  return Math.round((watchedCount(series) / series.parts.length) * 100)
}

export function nextPartIndex(series: Series): number {
  const index = series.parts.findIndex((part) => !series.watched.includes(part.videoId))
  return index === -1 ? 0 : index
}

export function isSeriesComplete(series: Series): boolean {
  return series.parts.length > 0 && watchedCount(series) >= series.parts.length
}

export function progressLabel(series: Series): string {
  return `${watchedCount(series)}/${series.parts.length}`
}

export function filterSeries(series: Series[], query: string, filter: Filter): Series[] {
  const term = query.trim().toLowerCase()

  return series.filter((item) => {
    const matchesQuery =
      term.length === 0 ||
      item.title.toLowerCase().includes(term) ||
      (item.aliases ?? []).some((alias) => alias.toLowerCase().includes(term)) ||
      item.channelTitle.toLowerCase().includes(term)

    const matchesFilter =
      filter === 'all' ||
      (filter === 'favorites' ? item.favorite : seriesStatus(item) === filter)

    return matchesQuery && matchesFilter
  })
}

export function groupSeries(series: Series[]): Record<SeriesStatus, Series[]> {
  const groups: Record<SeriesStatus, Series[]> = {
    watching: [],
    planned: [],
    completed: []
  }

  for (const item of series) {
    groups[seriesStatus(item)].push(item)
  }

  for (const status of statusOrder) {
    groups[status].sort(
      (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)
    )
  }

  return groups
}

export function continueWatching(series: Series[]): Series[] {
  return sortSeriesByRecent(series.filter((item) => seriesStatus(item) === 'watching'))
}

/** Ordena por la última vez que se abrió o modificó la serie. */
export function sortSeriesByRecent(series: Series[]): Series[] {
  return [...series].sort(
    (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)
  )
}

export function findExistingSeries(series: Series[], draft: SeriesDraft): Series | undefined {
  if (draft.existingSeriesId) {
    return series.find((item) => item.id === draft.existingSeriesId)
  }

  const draftIds = new Set(draft.parts.map((part) => part.videoId))
  const byPart = series.find((item) => item.parts.some((part) => draftIds.has(part.videoId)))
  if (byPart) return byPart

  const matches = series
    .filter((item) => {
      const similarity = titleSimilarity(item.title, draft.title)
      if (similarity < SERIES_MATCH_MIN_SIMILARITY) return false

      if (draft.channelId && item.channelId) {
        return draft.channelId === item.channelId
      }

      const sameChannelName =
        !draft.channelTitle ||
        !item.channelTitle ||
        draft.channelTitle === item.channelTitle ||
        draft.channelTitle === YOUTUBE_CHANNEL_FALLBACK ||
        item.channelTitle === YOUTUBE_CHANNEL_FALLBACK

      return sameChannelName && similarity >= SERIES_MATCH_SAME_CHANNEL_SIMILARITY
    })
    .sort(
      (a, b) => titleSimilarity(b.title, draft.title) - titleSimilarity(a.title, draft.title)
    )

  return matches[0]
}

function acceptedCandidateTitles(
  draft: SeriesDraft,
  parts: Part[],
  excludedIds: Set<string> = new Set()
): string[] {
  const selectedIds = new Set(parts.map((part) => part.videoId))

  return (draft.candidates ?? [])
    .filter(
      (candidate) => selectedIds.has(candidate.videoId) && !excludedIds.has(candidate.videoId)
    )
    .flatMap((candidate) =>
      [candidate.title, candidate.descriptionTitle].filter(
        (candidateTitle): candidateTitle is string => Boolean(candidateTitle)
      )
    )
}

export function createSeries(draft: SeriesDraft, title: string, parts: Part[]): Series {
  const now = Date.now()
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `series_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const finalTitle = title.trim() || draft.title

  return {
    id,
    title: finalTitle,
    aliases: mergeAliasesWithParts([], parts, finalTitle),
    keywordConfidence: learnKeywordConfidence({}, acceptedCandidateTitles(draft, parts)),
    channelId: draft.channelId,
    channelTitle: draft.channelTitle,
    channelUrl: draft.channelUrl,
    thumbnail: draft.thumbnail ?? parts[0]?.thumbnail,
    parts: sortParts(parts),
    watched: [],
    favorite: false,
    tagIds: [],
    createdAt: now,
    updatedAt: now
  }
}

export function mergeParts(existing: Part[], incoming: Part[]): Part[] {
  const byId = new Map(existing.map((part) => [part.videoId, part]))

  for (const part of incoming) {
    const previous = byId.get(part.videoId)
    byId.set(
      part.videoId,
      previous
        ? {
            ...previous,
            ...part,
            description: part.description ?? previous.description,
            durationSeconds: part.durationSeconds ?? previous.durationSeconds,
            sortOrder: part.sortOrder ?? previous.sortOrder,
            addedAt: previous.addedAt
          }
        : part
    )
  }

  return sortParts([...byId.values()])
}

/**
 * Lápida de parte. Quita de la lista los vídeos quitados a mano (por ejemplo,
 * al eliminar una parte de la serie). Sin este filtro, cualquier merge —el de la
 * sincronización con Drive o el de una búsqueda de capítulos— volvería a añadir
 * la parte desde la copia que todavía la tiene, igual que una serie borrada sin
 * `deletedAt` reaparecería. Una parte reañadida después del borrado (con un
 * `addedAt` más reciente) se conserva: la re-adición levanta su propia lápida.
 */
export function filterRemovedParts(
  parts: Part[],
  removed: Record<string, number> | undefined
): Part[] {
  if (!removed) return parts

  const kept = parts.filter((part) => {
    const removedAt = removed[part.videoId]
    return removedAt == null || part.addedAt > removedAt
  })
  return kept.length === parts.length ? parts : kept
}

/**
 * Une las lápidas de partes de dos copias quedándose con el borrado más
 * reciente de cada vídeo: si una copia borró y otra volvió a añadir después, la
 * re-adición (más nueva) gana al filtrar las partes.
 */
function combineRemovedParts(
  current: Record<string, number> | undefined,
  incoming: Record<string, number> | undefined
): Record<string, number> | undefined {
  const merged: Record<string, number> = { ...(current ?? {}) }

  for (const [videoId, removedAt] of Object.entries(incoming ?? {})) {
    const previous = merged[videoId]
    merged[videoId] = previous == null ? removedAt : Math.max(previous, removedAt)
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

/** Quita las lápidas de un vídeo vuelto a añadir a propósito. */
export function clearRemovedParts(
  removed: Record<string, number> | undefined,
  videoIds: Iterable<string>
): Record<string, number> | undefined {
  if (!removed) return removed

  const cleared = new Set(videoIds)
  const result: Record<string, number> = {}
  for (const [videoId, removedAt] of Object.entries(removed)) {
    if (!cleared.has(videoId)) result[videoId] = removedAt
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Deja solo las lápidas vigentes: una parte presente con un `addedAt` posterior
 * a su lápida se considera reañadida y descarta la suya.
 */
function keepPendingRemovals(
  removed: Record<string, number> | undefined,
  parts: Part[]
): Record<string, number> | undefined {
  if (!removed) return removed

  const lifted: string[] = []
  for (const part of parts) {
    const removedAt = removed[part.videoId]
    if (removedAt != null && part.addedAt > removedAt) lifted.push(part.videoId)
  }
  return clearRemovedParts(removed, lifted)
}

/** Aplica metadatos de un vídeo (descripción y duración) a una parte. */
export function applyPartMeta(series: Series, videoId: string, patch: PartMetaPatch): Series {
  const description = patch.description?.trim()
  const durationSeconds =
    typeof patch.durationSeconds === 'number' && patch.durationSeconds > 0
      ? patch.durationSeconds
      : undefined
  if (!description && durationSeconds == null) return series

  let changed = false
  const parts = series.parts.map((part) => {
    if (part.videoId !== videoId) return part

    const nextDescription = description || part.description
    const nextDuration = durationSeconds ?? part.durationSeconds
    if (nextDescription === part.description && nextDuration === part.durationSeconds) {
      return part
    }

    changed = true
    return {
      ...part,
      description: nextDescription,
      durationSeconds: nextDuration
    }
  })

  return changed ? { ...series, parts, updatedAt: Date.now() } : series
}

/** Rellena las duraciones que falten a partir de los metadatos de YouTube. */
export function applyPartDurations(series: Series, metas: Map<string, PartMetaPatch>): Series {
  let changed = false
  const parts = series.parts.map((part) => {
    if (part.durationSeconds != null) return part

    const meta = metas.get(part.videoId)
    if (!meta) return part

    const durationSeconds = meta.durationSeconds ?? part.durationSeconds
    const description = part.description ?? meta.description
    if (durationSeconds === part.durationSeconds && description === part.description) {
      return part
    }

    changed = true
    return { ...part, durationSeconds, description }
  })

  return changed ? { ...series, parts, updatedAt: Date.now() } : series
}

export function mergeSeries(
  existing: Series,
  draft: SeriesDraft,
  title: string,
  parts: Part[]
): Series {
  // Las partes elegidas a mano se consideran una re-adición: levantan su lápida
  // y dejan de estar descartadas, para que el merge de Drive no las borre.
  const selectedIds = new Set(parts.map((part) => part.videoId))
  const removedParts = clearRemovedParts(existing.removedParts, selectedIds)
  const discardedCandidates = (existing.discardedCandidates ?? []).filter(
    (videoId) => !selectedIds.has(videoId)
  )
  const mergedParts = filterRemovedParts(mergeParts(existing.parts, parts), removedParts)
  const existingPartIds = new Set(existing.parts.map((part) => part.videoId))
  const gainedParts = mergedParts.some((part) => !existingPartIds.has(part.videoId))
  const finalTitle = title.trim() || existing.title

  return {
    ...existing,
    title: finalTitle,
    aliases: mergeAliasesWithParts(existing.aliases, mergedParts, finalTitle),
    channelId: existing.channelId ?? draft.channelId,
    // «YouTube» es el valor por defecto cuando no se conoce el canal; si ahora
    // llega el canal real, se actualiza (igual que hace handleRefreshSeries).
    channelTitle:
      existing.channelTitle === YOUTUBE_CHANNEL_FALLBACK && draft.channelTitle
        ? draft.channelTitle
        : existing.channelTitle,
    channelUrl: existing.channelUrl ?? draft.channelUrl,
    thumbnail: existing.thumbnail ?? draft.thumbnail ?? mergedParts[0]?.thumbnail,
    parts: mergedParts,
    discardedCandidates,
    removedParts,
    status: gainedParts
      ? reconcileCompletedStatus(existing.status, existing.watched, mergedParts)
      : existing.status,
    keywordConfidence: learnKeywordConfidence(
      existing.keywordConfidence,
      acceptedCandidateTitles(draft, parts, existingPartIds)
    ),
    updatedAt: Date.now()
  }
}

/**
 * Descarta un «completada» que ya no cubre todas las partes (por ejemplo, tras
 * añadir capítulos). Devuelve `undefined` para que el estado se recalcule solo a
 * partir del progreso, en lugar de anclarlo a un valor manual.
 */
export function reconcileCompletedStatus(
  status: SeriesStatus | undefined,
  watched: string[],
  parts: Part[]
): SeriesStatus | undefined {
  if (status !== 'completed') return status

  const watchedIds = new Set(watched)
  const hasUnwatched = parts.some((part) => !watchedIds.has(part.videoId))
  return hasUnwatched ? undefined : status
}

export function normalizeKeywordConfidence(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([keyword, score]) => [keyword, Number(score)] as const)
    .filter(
      ([keyword, score]) =>
        /^[\p{L}\p{N}]+$/u.test(keyword) && Number.isFinite(score) && score > 0
    )
    .map(
      ([keyword, score]) =>
        [keyword, Math.min(MAX_KEYWORD_CONFIDENCE, Math.floor(score))] as const
    )
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORD_CONFIDENCE_ENTRIES)

  return Object.fromEntries(entries)
}

export function learnKeywordConfidence(
  current: unknown,
  titles: string[]
): Record<string, number> {
  const confidence = normalizeKeywordConfidence(current)

  for (const keyword of new Set(titles.flatMap(extractKeywords))) {
    const previous = Object.hasOwn(confidence, keyword) ? confidence[keyword] : 0
    confidence[keyword] = Math.min(MAX_KEYWORD_CONFIDENCE, previous + 1)
  }

  return normalizeKeywordConfidence(confidence)
}

function combineKeywordConfidence(
  current: unknown,
  incoming: unknown
): Record<string, number> {
  const confidence = normalizeKeywordConfidence(current)

  for (const [keyword, score] of Object.entries(normalizeKeywordConfidence(incoming))) {
    const currentScore = Object.hasOwn(confidence, keyword) ? confidence[keyword] : 0
    confidence[keyword] = Math.max(currentScore, score)
  }

  return normalizeKeywordConfidence(confidence)
}

/**
 * Limpia la lista de alias: cadenas recortadas, sin duplicados (sin distinguir
 * mayúsculas) y con un límite para no disparar la consulta de búsqueda.
 */
export function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const result: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry !== 'string') continue

    const alias = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_ALIAS_LENGTH)
    if (alias.length < MIN_ALIAS_LENGTH) continue

    const key = alias.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(alias)
    if (result.length >= MAX_SERIES_ALIASES) break
  }

  return result
}

/**
 * IDs de vídeos descartados a mano en las sugerencias de capítulos. Se guardan
 * para no volver a proponerlos en futuras actualizaciones de la serie.
 */
export function normalizeDiscardedCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return [...new Set(value.filter((id): id is string => typeof id === 'string'))]
}

/**
 * Lápidas de partes: id del vídeo y momento en que se quitó de la serie. Se
 * descartan las entradas sin marca de tiempo válida.
 */
export function normalizeRemovedParts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * Títulos base de los vídeos de YouTube, sin marcadores de parte ni emojis.
 * Sirven como alias para que una re-subida publicada con otro título siga
 * apareciendo en las búsquedas de la serie.
 */
export function youtubeTitleAliases(parts: Part[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    const title = stripPartMarkers(part.title)
      .replace(/[\s\-–—|:]*\b(?:final|fin|ending|last|[uú]ltima\s+parte)\s*$/iu, '')
      .replace(/[\s\-–—|:]+$/gu, '')
      .trim()
    if (title.length < MIN_SERIES_TITLE_LENGTH) continue

    const key = title.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(title)
  }

  return result
}

/**
 * Combina los alias actuales con los títulos reales de YouTube de los vídeos,
 * descartando los que coinciden con el título principal de la serie.
 */
export function mergeAliasesWithParts(
  current: string[] | undefined,
  parts: Part[],
  title: string
): string[] {
  const titleKey = title.trim().toLowerCase()
  const aliases = (current ?? []).filter((alias) => alias.trim().toLowerCase() !== titleKey)

  return normalizeAliases([
    // Los títulos de YouTube van primero: la búsqueda global solo lanza unas
    // pocas consultas, así que deben tener prioridad sobre alias antiguos.
    ...youtubeTitleAliases(parts).filter((alias) => alias.toLowerCase() !== titleKey),
    ...aliases
  ])
}

export function isSeries(value: unknown): value is Series {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    Array.isArray(item.parts) &&
    Array.isArray(item.watched)
  )
}

export function normalizeSeries(value: Series): Series {
  const now = Date.now()

  return {
    id: value.id,
    title: value.title.trim() || 'Serie sin título',
    aliases: normalizeAliases(value.aliases),
    keywordConfidence: normalizeKeywordConfidence(value.keywordConfidence),
    semanticFingerprint: normalizeSemanticFingerprint(value.semanticFingerprint),
    channelId: value.channelId,
    channelTitle: value.channelTitle || YOUTUBE_CHANNEL_FALLBACK,
    channelUrl: value.channelUrl,
    thumbnail: value.thumbnail,
    parts: value.parts
      .filter((part) => part && typeof part.videoId === 'string' && part.videoId.length > 0)
      .map((part) => ({
        videoId: part.videoId,
        title:
          typeof part.title === 'string' && part.title.length > 0
            ? part.title
            : YOUTUBE_VIDEO_FALLBACK_TITLE,
        description:
          typeof part.description === 'string'
            ? part.description.slice(0, MAX_PART_DESCRIPTION_LENGTH)
            : undefined,
        partNumber: typeof part.partNumber === 'number' ? part.partNumber : undefined,
        totalParts: typeof part.totalParts === 'number' ? part.totalParts : undefined,
        sortOrder:
          typeof part.sortOrder === 'number' &&
          Number.isFinite(part.sortOrder) &&
          part.sortOrder >= 0
            ? part.sortOrder
            : undefined,
        isFinal: Boolean(part.isFinal),
        durationSeconds:
          typeof part.durationSeconds === 'number' ? part.durationSeconds : undefined,
        publishedAt: typeof part.publishedAt === 'string' ? part.publishedAt : undefined,
        thumbnail: typeof part.thumbnail === 'string' ? part.thumbnail : undefined,
        addedAt: typeof part.addedAt === 'number' ? part.addedAt : now
      })),
    watched: value.watched.filter((id) => typeof id === 'string'),
    favorite: Boolean(value.favorite),
    tagIds: normalizeTagIds(value.tagIds),
    status:
      value.status === 'watching' || value.status === 'planned' || value.status === 'completed'
        ? value.status
        : undefined,
    discardedCandidates: normalizeDiscardedCandidates(value.discardedCandidates),
    removedParts: normalizeRemovedParts(value.removedParts),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    lastOpenedAt: typeof value.lastOpenedAt === 'number' ? value.lastOpenedAt : undefined,
    deletedAt: typeof value.deletedAt === 'number' ? value.deletedAt : undefined
  }
}

function sameStringSet(
  current: string[] | undefined,
  incoming: string[] | undefined
): boolean {
  const left = new Set(current ?? [])
  const right = new Set(incoming ?? [])
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

/**
 * Combina un campo usando la última copia sincronizada como base. Si solo una
 * de las copias lo cambió, gana esa; si ambas lo cambiaron, gana la más
 * reciente. Sin base (primera sincronización o importación) se usa LWW.
 */
function mergeField<T>(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series,
  pick: (series: Series) => T,
  equals: (a: T, b: T) => boolean = Object.is
): T {
  if (!base) return pick(newer)

  const currentValue = pick(current)
  const incomingValue = pick(incoming)
  const baseValue = pick(base)

  if (equals(currentValue, baseValue)) return incomingValue
  if (equals(incomingValue, baseValue)) return currentValue
  return pick(newer)
}

/**
 * Combina el estado manual. Sin base, una copia sin estado no debe borrar el
 * estado definido por la otra (por ejemplo, al recibir por primera vez una
 * serie marcada manualmente en otro dispositivo).
 */
function mergeStatus(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series
): SeriesStatus | undefined {
  if (!base) {
    if (current.status === undefined) return incoming.status
    if (incoming.status === undefined) return current.status
    return newer.status
  }

  if (current.status === base.status) return incoming.status
  if (incoming.status === base.status) return current.status
  return newer.status
}

/**
 * Combina las etiquetas asignadas a una serie. Sin base se usa la unión: una
 * primera sincronización no debe perder las etiquetas de ninguno de los dos
 * dispositivos.
 */
function mergeTagIds(
  base: Series | undefined,
  current: Series,
  incoming: Series,
  newer: Series
): string[] {
  if (!base) {
    return normalizeTagIds([...(current.tagIds ?? []), ...(incoming.tagIds ?? [])])
  }

  return normalizeTagIds(
    mergeField(base, current, incoming, newer, (item) => item.tagIds ?? [], sameStringSet)
  )
}

export function combineSeries(current: Series, incoming: Series, base?: Series): Series {
  // En caso de empate gana la copia local: así un cambio hecho en este
  // dispositivo (por ejemplo el estado) no lo borra la copia de Drive, que
  // puede tener el mismo `updatedAt` sin reflejar ese cambio.
  const newer = incoming.updatedAt > current.updatedAt ? incoming : current
  const older = newer === incoming ? current : incoming
  const lastOpenedAt = Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0)
  const removedParts = combineRemovedParts(current.removedParts, incoming.removedParts)
  const parts = filterRemovedParts(
    // Un vídeo quitado a mano no vuelve desde la copia que aún lo tiene: la
    // lápida de la parte solo la levanta una re-adición posterior.
    mergeParts(current.parts, incoming.parts),
    removedParts
  )
  // Con la base se evita que un cambio en un campo (por ejemplo, marcar una
  // favorita) haga ganar toda la copia y pierda los capítulos vistos que el
  // otro dispositivo había subido.
  const watched = [
    ...new Set(
      mergeField(base, current, incoming, newer, (item) => item.watched, sameStringSet)
    )
  ]
  const aliases = normalizeAliases(
    mergeField(base, current, incoming, newer, (item) => item.aliases ?? [], sameStringSet)
  )
  const title = mergeField(base, current, incoming, newer, (item) => item.title)
  const favorite = mergeField(base, current, incoming, newer, (item) => item.favorite)
  const tagIds = mergeTagIds(base, current, incoming, newer)
  const mergedStatus = mergeStatus(base, current, incoming, newer)

  return {
    ...older,
    ...newer,
    id: current.id,
    title,
    createdAt: Math.min(current.createdAt, incoming.createdAt),
    favorite,
    tagIds,
    aliases,
    keywordConfidence: combineKeywordConfidence(
      current.keywordConfidence,
      incoming.keywordConfidence
    ),
    semanticFingerprint: newer.semanticFingerprint ?? older.semanticFingerprint,
    // Los campos opcionales no deben perderse si la copia más nueva no los
    // trae (por ejemplo, un archivo de Drive creado antes de que existieran).
    channelId: newer.channelId ?? older.channelId,
    channelUrl: newer.channelUrl ?? older.channelUrl,
    thumbnail: newer.thumbnail ?? older.thumbnail,
    parts,
    watched,
    // Se descarta un «completada» que ya no cubra todas las partes, para no
    // propagar una copia antigua con estado «completada» y progreso parcial.
    status: reconcileCompletedStatus(mergedStatus, watched, parts),
    discardedCandidates: [
      ...new Set([
        ...(current.discardedCandidates ?? []),
        ...(incoming.discardedCandidates ?? [])
      ])
    ],
    // Las lápidas de partes que ya levantó una re-adición posterior no se
    // propagan: así una parte vuelta a añadir no se borra en el siguiente sync.
    removedParts: keepPendingRemovals(removedParts, parts),
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
    lastOpenedAt: lastOpenedAt > 0 ? lastOpenedAt : undefined,
    // El borrado es pegajoso: si una de las dos copias tiene lápida, la serie
    // queda borrada en ambas (no existe función para «desborrar»).
    deletedAt: earliest(current.deletedAt, incoming.deletedAt)
  }
}

function earliest(
  current: number | undefined,
  incoming: number | undefined
): number | undefined {
  if (current == null) return incoming
  if (incoming == null) return current
  return Math.min(current, incoming)
}

/**
 * Elimina definitivamente las lápidas con más de `maxAgeMs`. Pasado ese plazo
 * se asume que el borrado ya se ha propagado a los demás dispositivos, así que
 * la serie (y sus duplicados huérfanos al volver a añadirla) se puede purgar.
 */
export function pruneDeletedSeries(
  series: Series[],
  maxAgeMs: number = DELETED_SERIES_TTL,
  now: number = Date.now()
): Series[] {
  const kept = series.filter(
    (item) => item.deletedAt == null || now - item.deletedAt < maxAgeMs
  )
  return kept.length === series.length ? series : kept
}

export function mergeSeriesCollections(
  local: Series[],
  remote: Series[],
  base?: Series[]
): Series[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  const baseById = new Map((base ?? []).map((item) => [item.id, item]))

  for (const incoming of remote) {
    const previous = byId.get(incoming.id)
    byId.set(
      incoming.id,
      previous ? combineSeries(previous, incoming, baseById.get(incoming.id)) : incoming
    )
  }

  // Se descartan las lápidas antiguas para que no crezcan sin límite en
  // localStorage ni en el archivo de Drive.
  return pruneDeletedSeries([...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt))
}
