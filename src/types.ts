export type Tab = "home" | "list" | "settings";

export type SeriesStatus = "watching" | "planned" | "completed";

export type Filter = "all" | SeriesStatus | "favorites";

export interface Part {
  videoId: string;
  title: string;
  partNumber?: number;
  totalParts?: number;
  sortOrder?: number;
  isFinal?: boolean;
  durationSeconds?: number;
  publishedAt?: string;
  thumbnail?: string;
  addedAt: number;
}

export interface Series {
  id: string;
  title: string;
  /** Otros títulos con los que se publica la misma historia. */
  aliases: string[];
  /** Confianza acumulada en palabras de capítulos aceptados manualmente. */
  keywordConfidence?: Record<string, number>;
  channelId?: string;
  channelTitle: string;
  channelUrl?: string;
  thumbnail?: string;
  parts: Part[];
  watched: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface SeriesDraft {
  title: string;
  channelId?: string;
  channelTitle: string;
  channelUrl?: string;
  thumbnail?: string;
  parts: Part[];
  candidates?: ChapterCandidate[];
  source: "playlist" | "search" | "manual";
  existingSeriesId?: string;
  warnings: string[];
  selectedIds: string[];
}

export interface ChapterCandidate {
  videoId: string;
  title: string;
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

export interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export interface SyncMessage {
  kind: "ok" | "error" | "info";
  text: string;
}
