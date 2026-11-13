import type { Part } from '../../series/types'
import type { PlaylistData } from '../types'
import { detectPart } from '../../series/model/parts'
import {
  YouTubeError,
  channelUrlFor,
  fetchJson,
  fetchVideosByIds,
  pickThumbnail,
  youtubeThumbnail
} from './youtubeApi'
import type { Thumbnails, VideoMeta } from './youtubeApi'
import {
  MAX_PLAYLIST_ITEMS,
  YOUTUBE_DELETED_VIDEO_TITLE,
  YOUTUBE_PLAYLIST_PAGE_SIZE,
  YOUTUBE_PRIVATE_VIDEO_TITLE
} from './constants'

interface PlaylistItem {
  id: string
  snippet: {
    title: string
    channelId?: string
    channelTitle?: string
    videoOwnerChannelId?: string
    videoOwnerChannelTitle?: string
    publishedAt?: string
    description?: string
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

interface ChannelResource {
  contentDetails?: {
    relatedPlaylists?: { uploads?: string }
  }
}

export async function fetchPlaylist(
  playlistId: string,
  apiKey: string
): Promise<PlaylistData> {
  const meta = await fetchJson<{ items?: PlaylistResource[] }>(
    'playlists',
    { part: 'snippet,contentDetails', id: playlistId },
    apiKey
  )
  const playlist = meta.items?.[0]

  if (!playlist) {
    throw new YouTubeError(
      'No se encontró la lista de reproducción. Puede ser privada o haber sido eliminada.'
    )
  }

  const items: PlaylistItem[] = []
  const seenTokens = new Set<string>()
  let pageToken: string | undefined

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: String(YOUTUBE_PLAYLIST_PAGE_SIZE)
    }
    if (pageToken) params.pageToken = pageToken

    const page = await fetchJson<{
      items?: PlaylistItem[]
      nextPageToken?: string
    }>('playlistItems', params, apiKey)

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
    () => new Map<string, VideoMeta>()
  )
  const parts: Part[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const videoId = item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId
    const title = item.snippet.title

    if (
      !videoId ||
      title === YOUTUBE_DELETED_VIDEO_TITLE ||
      title === YOUTUBE_PRIVATE_VIDEO_TITLE
    )
      continue

    const info = detectPart(title)
    parts.push({
      videoId,
      title,
      partNumber: info.partNumber ?? index + 1,
      totalParts: info.totalParts ?? items.length,
      isFinal: info.isFinal,
      durationSeconds: durations.get(videoId)?.durationSeconds,
      publishedAt: item.snippet.publishedAt,
      thumbnail: pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(videoId),
      addedAt: Date.now()
    })
  }

  return {
    playlistId,
    title: playlist.snippet.title,
    channelId: playlist.snippet.channelId,
    channelTitle: playlist.snippet.channelTitle,
    thumbnail: pickThumbnail(playlist.snippet.thumbnails) ?? parts[0]?.thumbnail,
    parts,
    truncated: items.length >= MAX_PLAYLIST_ITEMS
  }
}

export async function fetchChannelUploads(
  channelId: string,
  apiKey: string,
  limit = MAX_PLAYLIST_ITEMS
): Promise<VideoMeta[]> {
  const channelData = await fetchJson<{ items?: ChannelResource[] }>(
    'channels',
    { part: 'contentDetails', id: channelId },
    apiKey
  )
  const uploads = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return []

  const items: PlaylistItem[] = []
  const seenTokens = new Set<string>()
  let pageToken: string | undefined

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId: uploads,
      maxResults: String(YOUTUBE_PLAYLIST_PAGE_SIZE)
    }
    if (pageToken) params.pageToken = pageToken

    const page = await fetchJson<{
      items?: PlaylistItem[]
      nextPageToken?: string
    }>('playlistItems', params, apiKey)

    for (const item of page.items ?? []) {
      if (items.length >= limit) break
      items.push(item)
    }

    pageToken = page.nextPageToken
    if (pageToken && seenTokens.has(pageToken)) pageToken = undefined
    if (pageToken) seenTokens.add(pageToken)
  } while (pageToken && items.length < limit)

  const videoIds = items
    .map((item) => item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId)
    .filter((id): id is string => Boolean(id))
  const durations = await fetchVideosByIds(videoIds, apiKey).catch(
    () => new Map<string, VideoMeta>()
  )
  const videos: VideoMeta[] = []

  for (const item of items) {
    const videoId = item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId
    const title = item.snippet.title

    if (
      !videoId ||
      title === YOUTUBE_DELETED_VIDEO_TITLE ||
      title === YOUTUBE_PRIVATE_VIDEO_TITLE
    )
      continue

    const ownerId = item.snippet.videoOwnerChannelId ?? item.snippet.channelId ?? channelId
    videos.push({
      videoId,
      title,
      channelId: ownerId,
      channelTitle: item.snippet.videoOwnerChannelTitle ?? item.snippet.channelTitle ?? '',
      channelUrl: ownerId ? channelUrlFor(ownerId) : undefined,
      publishedAt: item.snippet.publishedAt,
      description: durations.get(videoId)?.description ?? item.snippet.description,
      thumbnail: pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(videoId),
      durationSeconds: durations.get(videoId)?.durationSeconds
    })
  }

  return videos
}
