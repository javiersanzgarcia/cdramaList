import type { Part, SeriesDraft } from '../types'
import { formatDuration, parseIsoDuration } from './format'
import {
  buildSearchQuery,
  detectPart,
  sharedTokenCount,
  sortParts,
  stripPartMarkers,
  titleSimilarity,
  tokenCount,
} from './parts'

const API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_PLAYLIST_ITEMS = 200

interface Thumbnails {
  default?: { url: string }
  medium?: { url: string }
  high?: { url: string }
  standard?: { url: string }
  maxres?: { url: string }
}

interface VideoSnippet {
  title: string
  channelId: string
  channelTitle: string
  publishedAt: string
  description?: string
  tags?: string[]
  thumbnails?: Thumbnails
}

interface VideoItem {
  id: string
  snippet: VideoSnippet
  contentDetails?: { duration?: string }
}

interface PlaylistItem {
  id: string
  snippet: {
    title: string
    channelId?: string
    channelTitle?: string
    videoOwnerChannelId?: string
    videoOwnerChannelTitle?: string
    publishedAt?: string
    thumbnails?: Thumbnails
    resourceId?: { videoId?: string }
  }
  contentDetails?: { videoId?: string }
}

interface PlaylistResource {
  id: string
  snippet: {
    title: string
    channelId: string
    channelTitle: string
    publishedAt?: string
    description?: string
    thumbnails?: Thumbnails
  }
  contentDetails?: { itemCount?: number }
}

interface SearchItem {
  id: { videoId?: string; playlistId?: string }
  snippet: VideoSnippet
}

interface GoogleErrorBody {
  error?: {
    message?: string
    errors?: { reason?: string; message?: string }[]
  }
}

export interface VideoMeta {
  videoId: string
  title: string
  channelId?: string
  channelTitle: string
  channelUrl?: string
  publishedAt?: string
  description?: string
  tags?: string[]
  thumbnail?: string
  durationSeconds?: number
}

export interface PlaylistData {
  playlistId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnail?: string
  parts: Part[]
  truncated: boolean
}

export interface ParsedYouTubeUrl {
  videoId?: string
  playlistId?: string
}

export class YouTubeError extends Error {
  reason?: string

  constructor(message: string, reason?: string) {
    super(message)
    this.name = 'YouTubeError'
    this.reason = reason
  }
}

const VIDEO_ID = /^[\w-]{11}$/
const PLAYLIST_ID = /^[\w-]{10,}$/

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function channelUrlFor(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`
}

function pickThumbnail(thumbnails?: Thumbnails): string | undefined {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url
  )
}

function toVideoMeta(item: VideoItem): VideoMeta {
  return {
    videoId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    channelUrl: item.snippet.channelId ? channelUrlFor(item.snippet.channelId) : undefined,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
    tags: item.snippet.tags,
    thumbnail: pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(item.id),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
  }
}

async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('key', apiKey)

  let response: Response
  try {
    response = await fetch(url.toString())
  } catch {
    throw new YouTubeError('No se pudo conectar con YouTube. Revisa tu conexión.')
  }

  if (!response.ok) {
    let body: GoogleErrorBody | undefined
    try {
      body = (await response.json()) as GoogleErrorBody
    } catch {
      body = undefined
    }

    const reason = body?.error?.errors?.[0]?.reason
    const detail = body?.error?.message ?? `YouTube respondió con el código ${response.status}.`

    if (reason === 'quotaExceeded') {
      throw new YouTubeError(
        'Se ha agotado la cuota diaria de YouTube. Inténtalo mañana o usa el modo manual.',
        reason,
      )
    }

    if (response.status === 400 || response.status === 403) {
      throw new YouTubeError(
        'La clave de API no es válida o no tiene permiso para YouTube Data API v3. Revísala en Ajustes.',
        reason,
      )
    }

    if (response.status === 404) {
      throw new YouTubeError('No se encontró el vídeo o la lista de reproducción.', reason)
    }

    throw new YouTubeError(detail, reason)
  }

  return (await response.json()) as T
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const value = input.trim()
  if (!value) return null

  if (VIDEO_ID.test(value)) return { videoId: value }
  if (!value.startsWith('http') && PLAYLIST_ID.test(value)) return { playlistId: value }

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (
    !['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
  ) {
    return null
  }

  let videoId = url.searchParams.get('v') ?? undefined
  const playlistId = url.searchParams.get('list') ?? undefined

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0]
  } else {
    const segments = url.pathname.split('/').filter(Boolean)
    if (!videoId && ['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')) {
      videoId = segments[1]
    }
  }

  if (videoId && !VIDEO_ID.test(videoId)) videoId = undefined
  if (playlistId && !PLAYLIST_ID.test(playlistId)) return null
  if (!videoId && !playlistId) return null

  return { videoId, playlistId }
}

export async function fetchVideoMeta(videoId: string, apiKey: string): Promise<VideoMeta> {
  const data = await fetchJson<{ items?: VideoItem[] }>(
    'videos',
    { part: 'snippet,contentDetails', id: videoId },
    apiKey,
  )
  const item = data.items?.[0]

  if (!item) {
    throw new YouTubeError('No se encontró el vídeo. Puede ser privado o haber sido eliminado.')
  }

  return toVideoMeta(item)
}

export async function fetchVideosByIds(
  ids: string[],
  apiKey: string,
): Promise<Map<string, VideoMeta>> {
  const unique = [...new Set(ids.filter((id) => VIDEO_ID.test(id)))]
  const result = new Map<string, VideoMeta>()
  if (unique.length === 0) return result

  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += 50) {
    chunks.push(unique.slice(index, index + 50))
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchJson<{ items?: VideoItem[] }>(
        'videos',
        { part: 'snippet,contentDetails', id: chunk.join(','), maxResults: '50' },
        apiKey,
      ),
    ),
  )

  for (const page of pages) {
    for (const item of page.items ?? []) {
      result.set(item.id, toVideoMeta(item))
    }
  }

  return result
}

export async function searchChannelVideos(
  channelId: string,
  query: string,
  apiKey: string,
): Promise<VideoMeta[]> {
  const data = await fetchJson<{ items?: SearchItem[] }>(
    'search',
    {
      part: 'snippet',
      channelId,
      q: query,
      type: 'video',
      maxResults: '50',
      order: 'relevance',
      relevanceLanguage: 'es',
    },
    apiKey,
  )

  return (data.items ?? [])
    .filter((item) => item.id.videoId && item.snippet.channelId === channelId)
    .map((item) => ({
      videoId: item.id.videoId as string,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      channelUrl: channelUrlFor(item.snippet.channelId),
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      tags: item.snippet.tags,
      thumbnail: pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(item.id.videoId as string),
    }))
}

export async function fetchPlaylist(playlistId: string, apiKey: string): Promise<PlaylistData> {
  const meta = await fetchJson<{ items?: PlaylistResource[] }>(
    'playlists',
    { part: 'snippet,contentDetails', id: playlistId },
    apiKey,
  )
  const playlist = meta.items?.[0]

  if (!playlist) {
    throw new YouTubeError(
      'No se encontró la lista de reproducción. Puede ser privada o haber sido eliminada.',
    )
  }

  const items: PlaylistItem[] = []
  const seenTokens = new Set<string>()
  let pageToken: string | undefined

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    }
    if (pageToken) params.pageToken = pageToken

    const page = await fetchJson<{ items?: PlaylistItem[]; nextPageToken?: string }>(
      'playlistItems',
      params,
      apiKey,
    )

    for (const item of page.items ?? []) {
      if (items.length >= MAX_PLAYLIST_ITEMS) break
      items.push(item)
    }

    pageToken = page.nextPageToken
    if (pageToken && seenTokens.has(pageToken)) pageToken = undefined
    if (pageToken) seenTokens.add(pageToken)
  } while (pageToken && items.length < MAX_PLAYLIST_ITEMS)

  const videoIds = items
    .map((item) => item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId)
    .filter((id): id is string => Boolean(id))

  const durations = await fetchVideosByIds(videoIds, apiKey).catch(
    () => new Map<string, VideoMeta>(),
  )

  const parts: Part[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const videoId = item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId
    const title = item.snippet.title

    if (!videoId || title === 'Deleted video' || title === 'Private video') continue

    const info = detectPart(title)
    const duration = durations.get(videoId)?.durationSeconds

    parts.push({
      videoId,
      title,
      partNumber: info.partNumber ?? index + 1,
      totalParts: info.totalParts ?? items.length,
      isFinal: info.isFinal,
      durationSeconds: duration,
      publishedAt: item.snippet.publishedAt,
      thumbnail: pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(videoId),
      addedAt: Date.now(),
    })
  }

  return {
    playlistId,
    title: playlist.snippet.title,
    channelId: playlist.snippet.channelId,
    channelTitle: playlist.snippet.channelTitle,
    thumbnail: pickThumbnail(playlist.snippet.thumbnails) ?? parts[0]?.thumbnail,
    parts,
    truncated: items.length >= MAX_PLAYLIST_ITEMS,
  }
}

export async function fetchVideoMetaWithoutKey(videoId: string): Promise<VideoMeta> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(endpoint)}`,
  ]

  for (const proxy of proxies) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8_000)

    try {
      const response = await fetch(proxy, { signal: controller.signal })
      if (!response.ok) continue

      const data = (await response.json()) as {
        title?: string
        author_name?: string
        author_url?: string
        thumbnail_url?: string
      }

      return {
        videoId,
        title: data.title || 'Vídeo de YouTube',
        channelTitle: data.author_name || 'YouTube',
        channelUrl: data.author_url,
        thumbnail: data.thumbnail_url || youtubeThumbnail(videoId),
      }
    } catch {
      // Probamos el siguiente proxy.
    } finally {
      window.clearTimeout(timeout)
    }
  }

  return {
    videoId,
    title: 'Vídeo de YouTube',
    channelTitle: 'YouTube',
    thumbnail: youtubeThumbnail(videoId),
  }
}

interface EnrichedVideo {
  video: VideoMeta
  info: ReturnType<typeof detectPart>
  similarity: number
  shared: number
}

function toPart(video: VideoMeta, info: ReturnType<typeof detectPart>): Part {
  return {
    videoId: video.videoId,
    title: video.title,
    partNumber: info.partNumber,
    totalParts: info.totalParts,
    isFinal: info.isFinal,
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    thumbnail: video.thumbnail ?? youtubeThumbnail(video.videoId),
    addedAt: Date.now(),
  }
}

export function buildDraftFromVideo(
  original: VideoMeta,
  candidates: VideoMeta[],
): SeriesDraft {
  const byId = new Map<string, VideoMeta>()
  for (const video of [original, ...candidates]) {
    if (!byId.has(video.videoId)) byId.set(video.videoId, video)
  }

  const originalTokenCount = tokenCount(original.title)
  const minShared = originalTokenCount <= 4 ? 2 : 3

  const enriched: EnrichedVideo[] = [...byId.values()].map((video) => ({
    video,
    info: detectPart(video.title),
    similarity: titleSimilarity(original.title, video.title),
    shared: sharedTokenCount(original.title, video.title),
  }))

  const relevant = enriched.filter(
    (entry) =>
      entry.video.videoId === original.videoId ||
      (entry.shared >= 2 && entry.similarity >= 0.4),
  )

  const sameStory = relevant.filter(
    (entry) =>
      entry.video.videoId === original.videoId ||
      (entry.shared >= minShared && entry.similarity >= 0.6),
  )

  const numbered = sameStory.some((entry) => entry.info.partNumber != null)
  const parts = sortParts(relevant.map((entry) => toPart(entry.video, entry.info)))

  const selected = new Set<string>([original.videoId])
  if (numbered) {
    for (const entry of sameStory) {
      if (entry.info.partNumber != null) selected.add(entry.video.videoId)
    }
  }

  const warnings: string[] = []
  if (relevant.length === 1) {
    warnings.push(
      'No hemos encontrado más partes en el canal. Puedes añadirlas manualmente o abrir el canal en YouTube.',
    )
  } else if (!numbered) {
    warnings.push(
      'Hemos encontrado vídeos parecidos, pero sin número de parte. Revísalos antes de guardar.',
    )
  } else {
    warnings.push('Revisa que las partes seleccionadas sean de la misma historia.')
  }

  return {
    title: stripPartMarkers(original.title),
    channelId: original.channelId,
    channelTitle: original.channelTitle,
    channelUrl:
      original.channelUrl ??
      (original.channelId ? channelUrlFor(original.channelId) : undefined),
    thumbnail: original.thumbnail ?? parts[0]?.thumbnail,
    parts,
    source: 'search',
    warnings,
    selectedIds: [...selected],
  }
}

export function buildManualDraft(video: VideoMeta): SeriesDraft {
  const info = detectPart(video.title)
  const part = toPart(video, info)

  return {
    title: stripPartMarkers(video.title),
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelUrl: video.channelUrl,
    thumbnail: video.thumbnail ?? part.thumbnail,
    parts: [part],
    source: 'manual',
    warnings: [
      'Se ha añadido solo este vídeo. Puedes añadir más partes desde la serie o configurar la clave de YouTube para buscarlas automáticamente.',
    ],
    selectedIds: [video.videoId],
  }
}

export function buildPlaylistDraft(playlist: PlaylistData): SeriesDraft {
  const warnings: string[] = []

  if (playlist.truncated) {
    warnings.push(
      `La lista es muy larga. Se han importado las primeras ${MAX_PLAYLIST_ITEMS} partes.`,
    )
  }

  if (playlist.parts.length === 0) {
    warnings.push('La lista no contiene vídeos disponibles.')
  } else if (playlist.parts.length > 1) {
    warnings.push('Revisa que todas las partes pertenezcan a la misma historia.')
  }

  return {
    title: playlist.title,
    channelId: playlist.channelId,
    channelTitle: playlist.channelTitle,
    channelUrl: channelUrlFor(playlist.channelId),
    thumbnail: playlist.thumbnail,
    parts: playlist.parts,
    source: 'playlist',
    warnings,
    selectedIds: playlist.parts.map((part) => part.videoId),
  }
}

export async function discoverVideoSeries(
  videoId: string,
  apiKey: string,
): Promise<SeriesDraft> {
  const original = await fetchVideoMeta(videoId, apiKey)

  let candidates: VideoMeta[] = []
  const warnings: string[] = []

  try {
    const query = buildSearchQuery(original.title)
    const results = await searchChannelVideos(original.channelId as string, query, apiKey)
    const durations = await fetchVideosByIds(
      results.map((video) => video.videoId),
      apiKey,
    ).catch(() => new Map<string, VideoMeta>())

    candidates = results.map((video) => ({
      ...video,
      durationSeconds: durations.get(video.videoId)?.durationSeconds,
    }))
  } catch (error) {
    if (error instanceof YouTubeError) {
      warnings.push(`No se pudo buscar más partes: ${error.message}`)
    } else {
      throw error
    }
  }

  const draft = buildDraftFromVideo(original, candidates)
  draft.warnings.unshift(...warnings)
  return draft
}

export async function discoverPlaylist(
  playlistId: string,
  apiKey: string,
): Promise<SeriesDraft> {
  const playlist = await fetchPlaylist(playlistId, apiKey)
  return buildPlaylistDraft(playlist)
}

export async function fetchManualVideo(
  videoId: string,
  apiKey?: string,
): Promise<SeriesDraft> {
  const video = apiKey
    ? await fetchVideoMeta(videoId, apiKey)
    : await fetchVideoMetaWithoutKey(videoId)

  return buildManualDraft(video)
}

export function durationLabel(seconds?: number): string | undefined {
  return formatDuration(seconds)
}
