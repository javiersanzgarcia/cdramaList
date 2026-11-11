import type { Part } from "../series/types";

export interface ChapterCandidate {
  videoId: string;
  title: string;
  description?: string;
  descriptionTitle?: string;
  channelId?: string;
  channelTitle: string;
  channelUrl?: string;
  thumbnail?: string;
  durationSeconds?: number;
  publishedAt?: string;
  partNumber?: number;
  totalParts?: number;
  isFinal?: boolean;
  score: number;
  matchedBy: "title" | "description";
  source: "channel" | "search";
}

export interface SeriesRefreshResult {
  added: number;
  candidates: ChapterCandidate[];
  parts: Part[];
  warnings: string[];
  synced: boolean;
}

export interface SynonymCacheEntry {
  at: number;
  synonyms: string[];
  notFound?: boolean;
}
