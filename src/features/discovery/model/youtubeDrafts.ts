import type { ChapterCandidate } from "../types";
import type { Part, Series, SeriesDraft } from "../../series/types";
import { detectPart, stripPartMarkers } from "../../series/model/parts";
import { discoverSeriesUpdates } from "./seriesUpdates";
import { MAX_PLAYLIST_ITEMS, fetchPlaylist } from "./youtubePlaylists";
import {
  channelUrlFor,
  fetchVideoMeta,
  fetchVideoMetaWithoutKey,
  youtubeThumbnail,
} from "./youtubeApi";
import type { PlaylistData } from "./youtubePlaylists";
import type { VideoMeta } from "./youtubeApi";

function toPart(video: VideoMeta, info: ReturnType<typeof detectPart>): Part {
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

export function candidateToPart(
  candidate: ChapterCandidate,
  options: { partNumber?: number; isFinal?: boolean } = {},
): Part {
  return {
    videoId: candidate.videoId,
    title: candidate.title,
    description: candidate.description,
    partNumber: options.partNumber,
    totalParts: candidate.totalParts,
    isFinal: options.isFinal ?? candidate.isFinal,
    durationSeconds: candidate.durationSeconds,
    publishedAt: candidate.publishedAt,
    thumbnail: candidate.thumbnail ?? youtubeThumbnail(candidate.videoId),
    addedAt: Date.now(),
  };
}

export function buildManualDraft(video: VideoMeta): SeriesDraft {
  const part = toPart(video, detectPart(video.title));

  return {
    title: stripPartMarkers(video.title),
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelUrl: video.channelUrl,
    thumbnail: video.thumbnail ?? part.thumbnail,
    parts: [part],
    source: "manual",
    warnings: [
      "Se ha añadido solo este vídeo. Puedes añadir más partes desde la serie o configurar la clave de YouTube para buscarlas automáticamente.",
    ],
    selectedIds: [video.videoId],
  };
}

export function buildPlaylistDraft(playlist: PlaylistData): SeriesDraft {
  const warnings: string[] = [];

  if (playlist.truncated) {
    warnings.push(
      `La lista es muy larga. Se han importado las primeras ${MAX_PLAYLIST_ITEMS} partes.`,
    );
  }

  if (playlist.parts.length === 0) {
    warnings.push("La lista no contiene vídeos disponibles.");
  } else if (playlist.parts.length > 1) {
    warnings.push(
      "Revisa que todas las partes pertenezcan a la misma historia.",
    );
  }

  return {
    title: playlist.title,
    channelId: playlist.channelId,
    channelTitle: playlist.channelTitle,
    channelUrl: channelUrlFor(playlist.channelId),
    thumbnail: playlist.thumbnail,
    parts: playlist.parts,
    source: "playlist",
    warnings,
    selectedIds: playlist.parts.map((part) => part.videoId),
  };
}

export async function discoverVideoSeries(
  videoId: string,
  apiKey: string,
): Promise<SeriesDraft> {
  const original = await fetchVideoMeta(videoId, apiKey);
  const title = stripPartMarkers(original.title);

  const seed: Series = {
    id: "draft",
    title,
    aliases: [],
    channelId: original.channelId,
    channelTitle: original.channelTitle,
    channelUrl: original.channelUrl,
    thumbnail: original.thumbnail,
    parts: [toPart(original, detectPart(original.title))],
    watched: [],
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const update = await discoverSeriesUpdates(seed, apiKey);
  const warnings = [...update.warnings];

  if (update.parts.length === 1 && update.candidates.length === 0) {
    warnings.push(
      "No se han encontrado más capítulos en el canal ni en todo YouTube. Puedes añadirlos manualmente desde la serie.",
    );
  } else if (update.candidates.length > 0) {
    warnings.push(
      "Revisa los posibles capítulos: solo se guardarán los que añadas manualmente.",
    );
  }

  return {
    title,
    channelId: update.channelId ?? original.channelId,
    channelTitle: update.channelTitle || original.channelTitle,
    channelUrl: update.channelUrl ?? original.channelUrl,
    thumbnail: original.thumbnail ?? update.parts[0]?.thumbnail,
    parts: update.parts,
    candidates: update.candidates,
    source: "search",
    warnings,
    selectedIds: update.parts.map((part) => part.videoId),
  };
}

export async function discoverPlaylist(
  playlistId: string,
  apiKey: string,
): Promise<SeriesDraft> {
  return buildPlaylistDraft(await fetchPlaylist(playlistId, apiKey));
}

export async function fetchManualVideo(
  videoId: string,
  apiKey?: string,
): Promise<SeriesDraft> {
  const video = apiKey
    ? await fetchVideoMeta(videoId, apiKey)
    : await fetchVideoMetaWithoutKey(videoId);

  return buildManualDraft(video);
}
