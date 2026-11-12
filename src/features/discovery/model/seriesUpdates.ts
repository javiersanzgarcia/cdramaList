import type { ChapterCandidate } from '../types'
import type { Part, SemanticFingerprint, Series } from '../../series/types'
import {
  detectPart,
  extractDescriptionTitle,
  sortParts
} from '../../series/model/parts'
import {
  buildGlobalSearchQuery,
  keywordConfidenceBonus,
  normalizedBaseTitle,
  sharedTokenCount,
  titleJaccard,
  tokenCount
} from '../../series/model/titleMatching'
import { generateSemanticFingerprints, semanticSimilarity } from './semanticAi'
import {
  buildSynonymAliases,
  expandQueryWithSynonyms,
  fetchSynonyms,
  pickSynonymWordsFromTexts
} from './synonyms'
import {
  YouTubeError,
  fetchVideoMeta,
  fetchVideosByIds,
  searchYouTubeVideos
} from './youtubeApi'
import { fetchChannelUploads } from './youtubePlaylists'
import type { VideoMeta } from './youtubeApi'
import {
  candidateScore,
  combineSearchTerms,
  pickDescriptionReference,
  toCandidate,
  toPart,
  uniqueTitles
} from './seriesCandidateRanking'
import type { RankedCandidate } from './seriesCandidateRanking'

const MAX_CANDIDATES = 12
const MAX_SEMANTIC_CANDIDATES = 12
// Ventana de re-subidas recientes del canal que se clasifica semánticamente.
// Debe cubrir varios días: los canales de resúmenes suben muchos vídeos al día
// y una re-subida puede quedar decenas de posiciones por debajo de la última.
const MAX_RECENT_CHANNEL_CANDIDATES = 30
const MAX_FINGERPRINT_CANDIDATES = 39
// Consultas globales independientes por actualización: título, alias, título
// real de la descripción y títulos de las partes. Cada una cuesta 100 unidades
// de cuota, así que se limita para no agotar la cuota diaria.
const MAX_GLOBAL_SEARCHES = 4

export interface SeriesUpdate {
  parts: Part[]
  added: Part[]
  candidates: ChapterCandidate[]
  channelId?: string
  channelTitle?: string
  channelUrl?: string
  semanticFingerprint?: SemanticFingerprint
  warnings: string[]
}

/** Busca capítulos de la serie en las subidas del canal y en todo YouTube. */
export async function discoverSeriesUpdates(
  series: Series,
  apiKey: string,
  semanticEndpoint?: string
): Promise<SeriesUpdate> {
  if (series.parts.length === 0) {
    throw new YouTubeError(
      'Esta serie no tiene partes que sirvan de referencia para buscar capítulos nuevos.'
    )
  }

  const warnings: string[] = []
  let failed = false
  let failure: unknown
  let channelId = series.channelId
  let channelTitle = series.channelTitle
  let channelUrl = series.channelUrl

  if (!channelId) {
    try {
      const reference = await fetchVideoMeta(series.parts[0].videoId, apiKey)
      channelId = reference.channelId
      channelTitle = channelTitle || reference.channelTitle
      channelUrl = channelUrl ?? reference.channelUrl
    } catch {
      failed = true
      warnings.push(
        'No se ha podido identificar el canal; se buscará solo en todo YouTube.'
      )
    }
  }

  const known = new Set(series.parts.map((part) => part.videoId))
  const discarded = new Set(series.discardedCandidates ?? [])
  const [uploads, referenceVideos] = await Promise.all([
    channelId
      ? fetchChannelUploads(channelId, apiKey).catch((cause) => {
          failed = true
          failure = cause
          warnings.push('No se han podido leer los vídeos recientes del canal.')
          return [] as VideoMeta[]
        })
      : Promise.resolve([] as VideoMeta[]),
    fetchVideosByIds([...known], apiKey).catch(
      () => new Map<string, VideoMeta>()
    )
  ])

  const descriptionTitles: string[] = []
  for (const part of series.parts) {
    const title = extractDescriptionTitle(
      referenceVideos.get(part.videoId)?.description
    )
    if (title) descriptionTitles.push(title)
  }

  for (const video of uploads) {
    if (!known.has(video.videoId)) continue
    const title = extractDescriptionTitle(video.description)
    if (title) descriptionTitles.push(title)
  }

  const descriptionReference = pickDescriptionReference(descriptionTitles)
  const manualAliases = uniqueTitles(series.aliases ?? [])
  const synonyms = await fetchSynonyms(
    pickSynonymWordsFromTexts([
      descriptionReference,
      series.title,
      ...manualAliases,
      ...descriptionTitles,
      ...series.parts.map((part) => part.title)
    ])
  )
  const aliases = buildSynonymAliases(synonyms)
  const baseQuery = buildGlobalSearchQuery(series.title)
  // Cada referencia se busca por separado: YouTube no trata bien las consultas
  // largas unidas con «|», así que un alias o el título real de la descripción
  // puede encontrar capítulos que la consulta combinada no devuelve.
  const identityQuery = combineSearchTerms([
    baseQuery,
    ...expandQueryWithSynonyms(baseQuery, synonyms).split('|')
  ])
  const referenceQueries = [
    ...manualAliases.map((alias) => buildGlobalSearchQuery(alias)),
    ...descriptionTitles.map((title) => buildGlobalSearchQuery(title)),
    descriptionReference
      ? buildGlobalSearchQuery(descriptionReference)
      : undefined,
    ...series.parts.map((part) => buildGlobalSearchQuery(part.title))
  ]
  const queries: string[] = []
  const seenQueries = new Set<string>()
  for (const value of [identityQuery, ...referenceQueries]) {
    const query = value?.trim()
    if (!query) continue
    const key = query.toLowerCase()
    if (seenQueries.has(key)) continue
    seenQueries.add(key)
    queries.push(query)
    if (queries.length >= MAX_GLOBAL_SEARCHES) break
  }

  const searchOutcomes = await Promise.allSettled(
    queries.map((query) => searchYouTubeVideos(query, apiKey))
  )
  const globalResults: VideoMeta[] = []
  const seenGlobal = new Set<string>()
  let searchFailed = false
  for (const outcome of searchOutcomes) {
    if (outcome.status === 'rejected') {
      searchFailed = true
      failure ??= outcome.reason
      continue
    }
    for (const video of outcome.value) {
      if (seenGlobal.has(video.videoId)) continue
      seenGlobal.add(video.videoId)
      globalResults.push(video)
    }
  }
  if (searchFailed) {
    failed = true
    warnings.push('No se ha podido completar alguna búsqueda en todo YouTube.')
  }

  if (uploads.length === 0 && globalResults.length === 0 && failed) {
    if (failure instanceof Error && failure.message) {
      throw new YouTubeError(failure.message)
    }
    throw new YouTubeError(
      warnings.join(' ') ||
        'No se han podido leer los vídeos del canal ni buscar en YouTube. Comprueba la clave de YouTube.'
    )
  }

  const references = uniqueTitles([
    series.title,
    ...manualAliases,
    ...descriptionTitles,
    ...series.parts.map((part) => part.title)
  ])
  const baseReferences = uniqueTitles([
    series.title,
    ...descriptionTitles,
    ...series.parts.map((part) => part.title)
  ])
  const referenceKeys = new Set(
    references
      .map((reference) => normalizedBaseTitle(reference))
      .filter(Boolean)
  )
  const referenceTokenCount = Math.max(
    1,
    ...baseReferences.map((reference) => tokenCount(reference))
  )
  const minShared = referenceTokenCount <= 2 ? 1 : 2
  const exactKeys = new Set(
    [series.title, ...manualAliases]
      .map((title) => normalizedBaseTitle(title))
      .filter(Boolean)
  )

  const byId = new Map<
    string,
    { video: VideoMeta; source: 'channel' | 'search' }
  >()
  for (const video of uploads) {
    byId.set(video.videoId, { video, source: 'channel' })
  }
  for (const video of globalResults) {
    if (!byId.has(video.videoId)) {
      byId.set(video.videoId, { video, source: 'search' })
    }
  }

  const added: Part[] = []
  const ranked: RankedCandidate[] = []
  const semanticPool: RankedCandidate[] = []
  const recentPool: RankedCandidate[] = []
  const recentChannelIds = new Set(
    uploads
      .filter((video) => !known.has(video.videoId))
      .slice(0, MAX_RECENT_CHANNEL_CANDIDATES)
      .map((video) => video.videoId)
  )

  for (const { video, source } of byId.values()) {
    // Los vídeos ya descartados a mano no se vuelven a proponer.
    if (known.has(video.videoId) || discarded.has(video.videoId)) continue

    const info = detectPart(video.title)
    const descriptionTitle = extractDescriptionTitle(video.description)
    const descriptionKey = descriptionTitle
      ? normalizedBaseTitle(descriptionTitle)
      : ''
    const titleOverlap = Math.max(
      ...references.map((reference) =>
        titleJaccard(reference, video.title, aliases)
      )
    )
    const titleShared = Math.max(
      ...references.map((reference) =>
        sharedTokenCount(reference, video.title, aliases)
      )
    )
    const descriptionOverlap = descriptionTitle
      ? Math.max(
          ...references.map((reference) =>
            titleJaccard(reference, descriptionTitle, aliases)
          )
        )
      : 0
    const descriptionShared = descriptionTitle
      ? Math.max(
          ...references.map((reference) =>
            sharedTokenCount(reference, descriptionTitle, aliases)
          )
        )
      : 0
    const learningBonus = keywordConfidenceBonus(
      [video.title, ...(descriptionTitle ? [descriptionTitle] : [])],
      series.keywordConfidence
    )
    const overlap = Math.max(titleOverlap, descriptionOverlap)
    const shared = Math.max(titleShared, descriptionShared)
    const sameChannel = Boolean(channelId && video.channelId === channelId)

    if (exactKeys.has(normalizedBaseTitle(video.title))) {
      added.push(toPart(video, info))
      continue
    }

    const descriptionMatch = Boolean(
      descriptionKey && referenceKeys.has(descriptionKey)
    )
    const descriptionRelevant = Boolean(
      descriptionTitle &&
      (descriptionMatch ||
        (descriptionShared >= minShared && descriptionOverlap >= 0.65) ||
        (learningBonus >= 4 && descriptionShared >= 1))
    )
    const titleRelevant =
      (titleShared >= minShared &&
        (titleOverlap >= 0.45 ||
          (titleOverlap >= 0.3 && (sameChannel || titleShared >= 4)))) ||
      (learningBonus >= 4 && titleShared >= 1)
    const matchedBy: 'title' | 'description' =
      descriptionRelevant &&
      (descriptionMatch || descriptionOverlap >= titleOverlap)
        ? 'description'
        : 'title'

    let score = candidateScore(
      info,
      overlap,
      shared,
      referenceTokenCount,
      sameChannel,
      learningBonus
    )
    if (descriptionMatch) score = Math.min(100, score + 12)
    else if (descriptionRelevant) score = Math.min(100, score + 6)

    const candidate: RankedCandidate = {
      video,
      info,
      source,
      score,
      descriptionTitle,
      matchedBy
    }

    if (!descriptionRelevant && !titleRelevant) {
      if (semanticEndpoint) {
        if (info.partNumber != null || info.isFinal || descriptionTitle) {
          semanticPool.push(candidate)
        } else if (recentChannelIds.has(video.videoId)) {
          // Re-subidas con un título completamente distinto: se clasifican
          // semánticamente para poder ofrecerlas como candidatas.
          recentPool.push(candidate)
        }
      }
      continue
    }
    ranked.push(candidate)
  }

  let semanticFingerprint = series.semanticFingerprint
  if (semanticEndpoint) {
    const lexicalCandidates = [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEMANTIC_CANDIDATES)
    const prioritizedCandidates = [
      ...semanticPool
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SEMANTIC_CANDIDATES),
      ...recentPool,
      ...lexicalCandidates
    ]
    const maxFingerprintCandidates =
      MAX_FINGERPRINT_CANDIDATES - (semanticFingerprint ? 0 : 1)
    const candidatesForFingerprint = prioritizedCandidates
      .filter(
        (candidate, index, candidates) =>
          candidates.findIndex(
            (other) => other.video.videoId === candidate.video.videoId
          ) === index
      )
      .slice(0, maxFingerprintCandidates)
    const entries = [
      ...(!semanticFingerprint
        ? [
            {
              id: 'series',
              text: [
                series.title,
                ...manualAliases,
                ...descriptionTitles,
                ...series.parts.slice(0, 10).map((part) => part.title)
              ].join('\n')
            }
          ]
        : []),
      ...candidatesForFingerprint.map((candidate) => ({
        id: candidate.video.videoId,
        text: [candidate.video.title, candidate.descriptionTitle]
          .filter(Boolean)
          .join('\n')
      }))
    ]

    if (entries.length > 0) {
      try {
        const fingerprints = await generateSemanticFingerprints(
          semanticEndpoint,
          entries
        )
        semanticFingerprint = fingerprints.get('series') ?? semanticFingerprint

        if (semanticFingerprint) {
          const rankedById = new Map(
            ranked.map((candidate, index) => [candidate.video.videoId, index])
          )
          for (const candidate of candidatesForFingerprint) {
            const similarity = semanticSimilarity(
              semanticFingerprint,
              fingerprints.get(candidate.video.videoId)
            )
            if (similarity < 0.3) continue

            const existingIndex = rankedById.get(candidate.video.videoId)
            const baseScore =
              existingIndex == null
                ? Math.max(candidate.score, 30)
                : candidate.score
            const enhanced = {
              ...candidate,
              score: Math.min(100, baseScore + Math.round(similarity * 35))
            }
            if (existingIndex == null) {
              rankedById.set(candidate.video.videoId, ranked.length)
              ranked.push(enhanced)
            } else {
              ranked[existingIndex] = enhanced
            }
          }
        }
      } catch (cause) {
        const detail =
          cause instanceof Error
            ? cause.message
            : 'Error desconocido al consultar el servicio semántico.'
        const safeDetail = detail.slice(0, 240)
        warnings.push(
          `No se pudo analizar la similitud semántica (${safeDetail}); se usarán las coincidencias habituales.`
        )
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score)
  const candidates = ranked
    .slice(0, MAX_CANDIDATES)
    .map((entry) =>
      toCandidate(
        entry.video,
        entry.info,
        entry.source,
        entry.score,
        entry.descriptionTitle,
        entry.matchedBy
      )
    )

  if (ranked.length > MAX_CANDIDATES) {
    warnings.push(
      `Se muestran los ${MAX_CANDIDATES} candidatos más parecidos de ${ranked.length}.`
    )
  }

  return {
    parts: sortParts([...series.parts, ...added]),
    added,
    candidates,
    channelId,
    channelTitle: channelTitle || undefined,
    channelUrl,
    semanticFingerprint,
    warnings
  }
}
