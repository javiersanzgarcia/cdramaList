import type { ChapterCandidate } from "../types";
import type { Part } from "../../series/types";
import { detectPart } from "../../series/model/parts";
import {
  normalizedBaseTitle,
  tokenCount,
} from "../../series/model/titleMatching";
import { channelUrlFor, youtubeThumbnail } from "./youtubeApi";
import type { VideoMeta } from "./youtubeApi";

export const MAX_SEARCH_TERMS = 14;
export const MAX_SEARCH_QUERY_LENGTH = 500;

export interface RankedCandidate {
  video: VideoMeta;
  info: ReturnType<typeof detectPart>;
  source: "channel" | "search";
  score: number;
  descriptionTitle?: string;
  matchedBy: "title" | "description";
}

export function uniqueTitles(values: Array<string | undefined>): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const key = normalizedBaseTitle(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    titles.push(value);
  }

  return titles;
}

export function combineSearchTerms(terms: Array<string | undefined>): string {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const value of terms) {
    if (!value) continue;
    const term = value.trim();
    if (!term) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(term);
    if (unique.length >= MAX_SEARCH_TERMS) break;
  }

  let query = "";
  for (const term of unique) {
    const next = query ? `${query} | ${term}` : term;
    if (next.length > MAX_SEARCH_QUERY_LENGTH) continue;
    query = next;
  }

  return query;
}

export function pickDescriptionReference(values: string[]): string | undefined {
  const groups = new Map<string, { title: string; count: number }>();

  for (const value of values) {
    const key = normalizedBaseTitle(value);
    if (!key) continue;

    const entry = groups.get(key);
    if (entry) entry.count += 1;
    else groups.set(key, { title: value, count: 1 });
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      tokenCount(b.title) - tokenCount(a.title) ||
      b.title.length - a.title.length,
  )[0]?.title;
}

export function candidateScore(
  info: ReturnType<typeof detectPart>,
  overlap: number,
  shared: number,
  referenceTokenCount: number,
  sameChannel: boolean,
  confidenceBonus: number,
): number {
  const sharedRatio =
    referenceTokenCount > 0 ? shared / referenceTokenCount : 0;

  return Math.round(
    Math.min(overlap, 1) * 55 +
      Math.min(sharedRatio, 1) * 20 +
      (info.partNumber != null ? 12 : 0) +
      (info.isFinal ? 5 : 0) +
      (sameChannel ? 8 : 0) +
      confidenceBonus,
  );
}

export function toCandidate(
  video: VideoMeta,
  info: ReturnType<typeof detectPart>,
  source: "channel" | "search",
  score: number,
  descriptionTitle: string | undefined,
  matchedBy: "title" | "description",
): ChapterCandidate {
  return {
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    descriptionTitle,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelUrl:
      video.channelUrl ??
      (video.channelId ? channelUrlFor(video.channelId) : undefined),
    thumbnail: video.thumbnail ?? youtubeThumbnail(video.videoId),
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    partNumber: info.partNumber,
    totalParts: info.totalParts,
    isFinal: info.isFinal,
    score,
    matchedBy,
    source,
  };
}

export function toPart(
  video: VideoMeta,
  info: ReturnType<typeof detectPart>,
): Part {
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
    addedAt: Date.now(),
  };
}
