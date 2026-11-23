import type { RankedCandidate, SeriesUpdate, VideoMeta } from '../types'
import type { Part, Series, SeriesOriginCountry } from '../../series/types'
import { detectPart, extractDescriptionTitle, sortParts } from '../../series/model/parts'
import {
  detectOriginCountryFromMetadata,
  shouldRedetectOriginCountry
} from '../../series/model/origin'
import {
  buildGlobalSearchQuery,
  keywordConfidenceBonus,
  normalizedBaseTitle,
  sharedTokenCount,
  titleJaccard,
  tokenCount
} from '../../series/model/titleMatching'
import { analyzeSemanticEntries, semanticSimilarity } from './semanticAi'
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
import {
  candidateScore,
  combineSearchTerms,
  pickDescriptionReference,
  toCandidate,
  toPart,
  uniqueTitles
} from './seriesCandidateRanking'
import {
  MAX_CANDIDATES,
  MAX_FINGERPRINT_CANDIDATES,
  MAX_GLOBAL_SEARCHES,
  MAX_RECENT_CHANNEL_CANDIDATES,
  MAX_SEMANTIC_CANDIDATES,
  SERIES_UPDATE_DESCRIPTION_MATCH_BONUS,
  SERIES_UPDATE_DESCRIPTION_OVERLAP,
  SERIES_UPDATE_DESCRIPTION_RELEVANT_BONUS,
  SERIES_UPDATE_FINGERPRINT_TITLE_PARTS,
  SERIES_UPDATE_LEARNING_BONUS_MIN,
  SERIES_UPDATE_MAX_ERROR_LENGTH,
  SERIES_UPDATE_SEMANTIC_MIN_SCORE,
  SERIES_UPDATE_SEMANTIC_MIN_SIMILARITY,
  SERIES_UPDATE_SEMANTIC_SCORE_WEIGHT,
  SERIES_UPDATE_TITLE_OVERLAP,
  SERIES_UPDATE_TITLE_OVERLAP_SAME_CHANNEL,
  SERIES_UPDATE_TITLE_SHARED_SAME_CHANNEL,
  SEMANTIC_MAX_TEXT_LENGTH
} from './constants'

function compactText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, maxLength) : undefined
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
      warnings.push('No se ha podido identificar el canal; se buscará solo en todo YouTube.')
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
    fetchVideosByIds([...known], apiKey).catch(() => new Map<string, VideoMeta>())
  ])

  const descriptionTitles: string[] = []
  for (const part of series.parts) {
    const title = extractDescriptionTitle(referenceVideos.get(part.videoId)?.description)
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
    descriptionReference ? buildGlobalSearchQuery(descriptionReference) : undefined,
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
    references.map((reference) => normalizedBaseTitle(reference)).filter(Boolean)
  )
  const referenceTokenCount = Math.max(
    1,
    ...baseReferences.map((reference) => tokenCount(reference))
  )
  const minShared = referenceTokenCount <= 2 ? 1 : 2
  const exactKeys = new Set(
    [series.title, ...manualAliases].map((title) => normalizedBaseTitle(title)).filter(Boolean)
  )

  const byId = new Map<string, { video: VideoMeta; source: 'channel' | 'search' }>()
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
    const descriptionKey = descriptionTitle ? normalizedBaseTitle(descriptionTitle) : ''
    const titleOverlap = Math.max(
      ...references.map((reference) => titleJaccard(reference, video.title, aliases))
    )
    const titleShared = Math.max(
      ...references.map((reference) => sharedTokenCount(reference, video.title, aliases))
    )
    const descriptionOverlap = descriptionTitle
      ? Math.max(
          ...references.map((reference) => titleJaccard(reference, descriptionTitle, aliases))
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

    const descriptionMatch = Boolean(descriptionKey && referenceKeys.has(descriptionKey))
    const descriptionRelevant = Boolean(
      descriptionTitle &&
      (descriptionMatch ||
        (descriptionShared >= minShared &&
          descriptionOverlap >= SERIES_UPDATE_DESCRIPTION_OVERLAP) ||
        (learningBonus >= SERIES_UPDATE_LEARNING_BONUS_MIN && descriptionShared >= 1))
    )
    const titleRelevant =
      (titleShared >= minShared &&
        (titleOverlap >= SERIES_UPDATE_TITLE_OVERLAP ||
          (titleOverlap >= SERIES_UPDATE_TITLE_OVERLAP_SAME_CHANNEL &&
            (sameChannel || titleShared >= SERIES_UPDATE_TITLE_SHARED_SAME_CHANNEL)))) ||
      (learningBonus >= SERIES_UPDATE_LEARNING_BONUS_MIN && titleShared >= 1)
    const matchedBy: 'title' | 'description' =
      descriptionRelevant && (descriptionMatch || descriptionOverlap >= titleOverlap)
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
    if (descriptionMatch) score = Math.min(100, score + SERIES_UPDATE_DESCRIPTION_MATCH_BONUS)
    else if (descriptionRelevant)
      score = Math.min(100, score + SERIES_UPDATE_DESCRIPTION_RELEVANT_BONUS)

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
  let aiOriginCountry: SeriesOriginCountry | undefined
  const needsOrigin = shouldRedetectOriginCountry(
    series.originCountry,
    series.originCountryManual
  )
  if (semanticEndpoint) {
    const lexicalCandidates = [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEMANTIC_CANDIDATES)
    const prioritizedCandidates = [
      ...semanticPool.sort((a, b) => b.score - a.score).slice(0, MAX_SEMANTIC_CANDIDATES),
      ...recentPool,
      ...lexicalCandidates
    ]
    const maxFingerprintCandidates = MAX_FINGERPRINT_CANDIDATES - (semanticFingerprint ? 0 : 1)
    const candidatesForFingerprint = prioritizedCandidates
      .filter(
        (candidate, index, candidates) =>
          candidates.findIndex((other) => other.video.videoId === candidate.video.videoId) ===
          index
      )
      .slice(0, maxFingerprintCandidates)
    // Aunque ya tengamos la huella semántica, volvemos a enviar la serie si su
    // país está pendiente: el Worker ahora también devuelve el origen inferido.
    // Las etiquetas van antes que las descripciones porque suelen contener las
    // pistas culturales (harem, emperatriz, xianxia…) que recorta el límite de
    // caracteres del Worker.
    const referenceSample = [...referenceVideos.values()].slice(0, 3)
    const seriesAiText = [
      compactText(series.title, 160),
      channelTitle ? `Canal: ${compactText(channelTitle, 80)}` : undefined,
      ...manualAliases.slice(0, 3).map((alias) => compactText(alias, 80)),
      ...referenceSample.flatMap((video) =>
        (video.tags ?? []).slice(0, 15).map((tag) => compactText(tag, 40))
      ),
      ...series.parts
        .slice(0, SERIES_UPDATE_FINGERPRINT_TITLE_PARTS)
        .map((part) => compactText(part.title, 100)),
      ...referenceSample.map((video) => compactText(video.description, 160))
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, SEMANTIC_MAX_TEXT_LENGTH)
    const entries = [
      ...(!semanticFingerprint || needsOrigin
        ? [
            {
              id: 'series',
              text: seriesAiText
            }
          ]
        : []),
      ...candidatesForFingerprint.map((candidate) => ({
        id: candidate.video.videoId,
        text: [candidate.video.title, candidate.descriptionTitle].filter(Boolean).join('\n')
      }))
    ]

    if (entries.length > 0) {
      try {
        const analyses = await analyzeSemanticEntries(semanticEndpoint, entries)
        const seriesAnalysis = analyses.get('series')
        // Si ya había huella, se conserva: esta llamada puede existir solo para
        // pedir el país y su texto está preparado para eso, no para recalcularla.
        if (!semanticFingerprint) semanticFingerprint = seriesAnalysis?.fingerprint
        if (needsOrigin && !series.originCountryManual) {
          aiOriginCountry = seriesAnalysis?.originCountry
        }

        if (semanticFingerprint) {
          const rankedById = new Map(
            ranked.map((candidate, index) => [candidate.video.videoId, index])
          )
          for (const candidate of candidatesForFingerprint) {
            const similarity = semanticSimilarity(
              semanticFingerprint,
              analyses.get(candidate.video.videoId)?.fingerprint
            )
            if (similarity < SERIES_UPDATE_SEMANTIC_MIN_SIMILARITY) continue

            const existingIndex = rankedById.get(candidate.video.videoId)
            const baseScore =
              existingIndex == null
                ? Math.max(candidate.score, SERIES_UPDATE_SEMANTIC_MIN_SCORE)
                : candidate.score
            const enhanced = {
              ...candidate,
              score: Math.min(
                100,
                baseScore + Math.round(similarity * SERIES_UPDATE_SEMANTIC_SCORE_WEIGHT)
              )
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
        const safeDetail = detail.slice(0, SERIES_UPDATE_MAX_ERROR_LENGTH)
        warnings.push(
          `No se pudo analizar la similitud semántica (${safeDetail}); se usarán las coincidencias habituales.`
        )
      }
    }
  }

  // El país se detecta solo con metadatos propios de la serie: descripciones y
  // tags de sus capítulos suelen indicar «Chinese drama», «kdrama», «dizi»…,
  // aunque el título esté traducido. Los resultados globales y los vídeos
  // recientes del canal pueden pertenecer a otras historias, así que no se
  // usan para adivinar el país.
  const detectedOriginCountry = detectOriginCountryFromMetadata({
    title: series.title,
    aliases: [...manualAliases, ...descriptionTitles],
    channelTitle,
    videos: [...referenceVideos.values()].slice(0, 5).map((video) => ({
      title: video.title,
      description: video.description,
      tags: video.tags,
      defaultLanguage: video.defaultLanguage
    }))
  })
  // La IA solo entra en juego cuando los metadatos no dan ninguna pista y el
  // usuario no ha fijado el país a mano. Si tampoco encuentra una señal fiable,
  // se mantiene `Desconocido`.
  const originCountry =
    detectedOriginCountry !== 'unknown'
      ? detectedOriginCountry
      : (aiOriginCountry ?? 'unknown')

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
    originCountry,
    warnings
  }
}
