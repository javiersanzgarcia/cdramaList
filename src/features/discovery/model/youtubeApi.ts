import { parseIsoDuration } from '../../../shared/lib/format'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface Thumbnails {
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

export function pickThumbnail(thumbnails?: Thumbnails): string | undefined {
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
    channelUrl: item.snippet.channelId
      ? channelUrlFor(item.snippet.channelId)
      : undefined,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
    tags: item.snippet.tags,
    thumbnail:
      pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(item.id),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration)
  }
}

export async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('key', apiKey)

  let response: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    response = await fetch(url.toString(), { signal: controller.signal })
  } catch {
    throw new YouTubeError(
      controller.signal.aborted
        ? 'YouTube tardó demasiado en responder. Inténtalo de nuevo.'
        : 'No se pudo conectar con YouTube. Revisa tu conexión.'
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    let body: GoogleErrorBody | undefined
    try {
      body = (await response.json()) as GoogleErrorBody
    } catch {
      body = undefined
    }

    const reason = body?.error?.errors?.[0]?.reason
    const detail =
      body?.error?.message ??
      `YouTube respondió con el código ${response.status}.`

    if (reason === 'quotaExceeded') {
      throw new YouTubeError(
        'Se ha agotado la cuota diaria de YouTube. Inténtalo mañana o usa el modo manual.',
        reason
      )
    }

    if (response.status === 400 || response.status === 403) {
      throw new YouTubeError(
        'La clave de API no es válida o no tiene permiso para YouTube Data API v3. Revísala en Ajustes.',
        reason
      )
    }

    if (response.status === 404) {
      throw new YouTubeError(
        'No se encontró el vídeo o la lista de reproducción.',
        reason
      )
    }

    throw new YouTubeError(detail, reason)
  }

  return (await response.json()) as T
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const value = input.trim()
  if (!value) return null

  if (VIDEO_ID.test(value)) return { videoId: value }
  if (!value.startsWith('http') && PLAYLIST_ID.test(value))
    return { playlistId: value }

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (
    ![
      'youtube.com',
      'youtu.be',
      'music.youtube.com',
      'youtube-nocookie.com'
    ].includes(host)
  ) {
    return null
  }

  let videoId = url.searchParams.get('v') ?? undefined
  const playlistId = url.searchParams.get('list') ?? undefined

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0]
  } else {
    const segments = url.pathname.split('/').filter(Boolean)
    if (
      !videoId &&
      ['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')
    ) {
      videoId = segments[1]
    }
  }

  if (videoId && !VIDEO_ID.test(videoId)) videoId = undefined
  if (playlistId && !PLAYLIST_ID.test(playlistId)) return null
  if (!videoId && !playlistId) return null

  return { videoId, playlistId }
}

export async function fetchVideoMeta(
  videoId: string,
  apiKey: string
): Promise<VideoMeta> {
  const data = await fetchJson<{ items?: VideoItem[] }>(
    'videos',
    { part: 'snippet,contentDetails', id: videoId },
    apiKey
  )
  const item = data.items?.[0]

  if (!item) {
    throw new YouTubeError(
      'No se encontró el vídeo. Puede ser privado o haber sido eliminado.'
    )
  }

  return toVideoMeta(item)
}

export async function fetchVideosByIds(
  ids: string[],
  apiKey: string
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
        {
          part: 'snippet,contentDetails',
          id: chunk.join(','),
          maxResults: '50'
        },
        apiKey
      )
    )
  )

  for (const page of pages) {
    for (const item of page.items ?? []) {
      result.set(item.id, toVideoMeta(item))
    }
  }

  return result
}

/**
 * Busca vídeos en todo YouTube, no solo en un canal. Cada consulta cuesta 100
 * unidades de cuota; la actualización de una serie hace varias consultas
 * independientes (título, alias, descripción y partes) con un límite.
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults = 50
): Promise<VideoMeta[]> {
  const term = query.trim()
  if (!term) return []

  const data = await fetchJson<{ items?: SearchItem[] }>(
    'search',
    {
      part: 'snippet',
      q: term,
      type: 'video',
      maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
      order: 'relevance',
      relevanceLanguage: 'es'
    },
    apiKey
  )

  const videos = (data.items ?? [])
    .filter((item) => item.id.videoId)
    .map((item) => ({
      videoId: item.id.videoId as string,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      channelUrl: channelUrlFor(item.snippet.channelId),
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      tags: item.snippet.tags,
      thumbnail:
        pickThumbnail(item.snippet.thumbnails) ??
        youtubeThumbnail(item.id.videoId as string)
    }))

  // La búsqueda no devuelve la duración: la pedimos en una sola llamada extra.
  const durations = await fetchVideosByIds(
    videos.map((video) => video.videoId),
    apiKey
  ).catch(() => new Map<string, VideoMeta>())

  return videos.map((video) => ({
    ...video,
    description: durations.get(video.videoId)?.description ?? video.description,
    durationSeconds: durations.get(video.videoId)?.durationSeconds
  }))
}

export async function fetchVideoMetaWithoutKey(
  videoId: string
): Promise<VideoMeta> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(endpoint)}`
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
        thumbnail: data.thumbnail_url || youtubeThumbnail(videoId)
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
    thumbnail: youtubeThumbnail(videoId)
  }
}
