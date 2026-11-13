import type { ChapterCandidate, VideoMeta } from '../types'
import type { Part, PartInfo } from '../../series/types'
import { normalizedBaseTitle, tokenCount } from '../../series/model/titleMatching'
import { channelUrlFor, youtubeThumbnail } from './youtubeApi'
import {
  CANDIDATE_SCORE_FINAL,
  CANDIDATE_SCORE_OVERLAP_WEIGHT,
  CANDIDATE_SCORE_PART_NUMBER,
  CANDIDATE_SCORE_SAME_CHANNEL,
  CANDIDATE_SCORE_SHARED_WEIGHT,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TERMS
} from './constants'

export function uniqueTitles(values: Array<string | undefined>): string[] {
  const titles: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (!value) continue
    const key = normalizedBaseTitle(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    titles.push(value)
  }

  return titles
}

export function combineSearchTerms(terms: Array<string | undefined>): string {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const value of terms) {
    if (!value) continue
    const term = value.trim()
    if (!term) continue

    const key = term.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    unique.push(term)
    if (unique.length >= MAX_SEARCH_TERMS) break
  }

  let query = ''
  for (const term of unique) {
    const next = query ? `${query} | ${term}` : term
    if (next.length > MAX_SEARCH_QUERY_LENGTH) continue
    query = next
  }

  return query
}

export function pickDescriptionReference(values: string[]): string | undefined {
  const groups = new Map<string, { title: string; count: number }>()

  for (const value of values) {
    const key = normalizedBaseTitle(value)
    if (!key) continue

    const entry = groups.get(key)
    if (entry) entry.count += 1
    else groups.set(key, { title: value, count: 1 })
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      tokenCount(b.title) - tokenCount(a.title) ||
      b.title.length - a.title.length
  )[0]?.title
}

export function candidateScore(
  info: PartInfo,
  overlap: number,
  shared: number,
  referenceTokenCount: number,
  sameChannel: boolean,
  confidenceBonus: number
): number {
  const sharedRatio = referenceTokenCount > 0 ? shared / referenceTokenCount : 0

  return Math.round(
    Math.min(overlap, 1) * CANDIDATE_SCORE_OVERLAP_WEIGHT +
      Math.min(sharedRatio, 1) * CANDIDATE_SCORE_SHARED_WEIGHT +
      (info.partNumber != null ? CANDIDATE_SCORE_PART_NUMBER : 0) +
      (info.isFinal ? CANDIDATE_SCORE_FINAL : 0) +
      (sameChannel ? CANDIDATE_SCORE_SAME_CHANNEL : 0) +
      confidenceBonus
  )
}

export function toCandidate(
  video: VideoMeta,
  info: PartInfo,
  source: 'channel' | 'search',
  score: number,
  descriptionTitle: string | undefined,
  matchedBy: 'title' | 'description'
): ChapterCandidate {
  return {
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    descriptionTitle,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelUrl:
      video.channelUrl ?? (video.channelId ? channelUrlFor(video.channelId) : undefined),
    thumbnail: video.thumbnail ?? youtubeThumbnail(video.videoId),
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    partNumber: info.partNumber,
    totalParts: info.totalParts,
    isFinal: info.isFinal,
    score,
    matchedBy,
    source
  }
}

export function toPart(video: VideoMeta, info: PartInfo): Part {
  return {
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    partNumber: info.partNumber,
    totalParts: info.totalParts,
    isFinal: info.isFinal,
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    thumbnail: video.thumbnail ?? youtubeThumbnail(video.videoId),
    addedAt: Date.now()
  }
}
