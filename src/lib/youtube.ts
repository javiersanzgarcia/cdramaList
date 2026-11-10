import type {
  ChapterCandidate,
  Part,
  SemanticFingerprint,
  Series,
  SeriesDraft,
} from "../types";
import { formatDuration, parseIsoDuration } from "./format";
import { generateSemanticFingerprints, semanticSimilarity } from "./gemini";
import {
  buildGlobalSearchQuery,
  detectPart,
  extractDescriptionTitle,
  keywordConfidenceBonus,
  normalizedBaseTitle,
  sharedTokenCount,
  sortParts,
  stripPartMarkers,
  titleJaccard,
  tokenCount,
} from "./parts";
import {
  buildSynonymAliases,
  expandQueryWithSynonyms,
  fetchSynonyms,
  pickSynonymWordsFromTexts,
} from "./synonyms";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_PLAYLIST_ITEMS = 200;
const MAX_SEARCH_TERMS = 14;
const MAX_SEARCH_QUERY_LENGTH = 500;

interface Thumbnails {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
  standard?: { url: string };
  maxres?: { url: string };
}

interface VideoSnippet {
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description?: string;
  tags?: string[];
  thumbnails?: Thumbnails;
}

interface VideoItem {
  id: string;
  snippet: VideoSnippet;
  contentDetails?: { duration?: string };
}

interface PlaylistItem {
  id: string;
  snippet: {
    title: string;
    channelId?: string;
    channelTitle?: string;
    videoOwnerChannelId?: string;
    videoOwnerChannelTitle?: string;
    publishedAt?: string;
    description?: string;
    thumbnails?: Thumbnails;
    resourceId?: { videoId?: string };
  };
  contentDetails?: { videoId?: string };
}

interface PlaylistResource {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt?: string;
    description?: string;
    thumbnails?: Thumbnails;
  };
  contentDetails?: { itemCount?: number };
}

interface SearchItem {
  id: { videoId?: string; playlistId?: string };
  snippet: VideoSnippet;
}

interface ChannelResource {
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
}

interface GoogleErrorBody {
  error?: {
    message?: string;
    errors?: { reason?: string; message?: string }[];
  };
}

export interface VideoMeta {
  videoId: string;
  title: string;
  channelId?: string;
  channelTitle: string;
  channelUrl?: string;
  publishedAt?: string;
  description?: string;
  tags?: string[];
  thumbnail?: string;
  durationSeconds?: number;
}

export interface PlaylistData {
  playlistId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail?: string;
  parts: Part[];
  truncated: boolean;
}

export interface ParsedYouTubeUrl {
  videoId?: string;
  playlistId?: string;
}

export class YouTubeError extends Error {
  reason?: string;

  constructor(message: string, reason?: string) {
    super(message);
    this.name = "YouTubeError";
    this.reason = reason;
  }
}

const VIDEO_ID = /^[\w-]{11}$/;
const PLAYLIST_ID = /^[\w-]{10,}$/;

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function channelUrlFor(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

function pickThumbnail(thumbnails?: Thumbnails): string | undefined {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url
  );
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
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
  };
}

async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new YouTubeError(
      "No se pudo conectar con YouTube. Revisa tu conexión.",
    );
  }

  if (!response.ok) {
    let body: GoogleErrorBody | undefined;
    try {
      body = (await response.json()) as GoogleErrorBody;
    } catch {
      body = undefined;
    }

    const reason = body?.error?.errors?.[0]?.reason;
    const detail =
      body?.error?.message ??
      `YouTube respondió con el código ${response.status}.`;

    if (reason === "quotaExceeded") {
      throw new YouTubeError(
        "Se ha agotado la cuota diaria de YouTube. Inténtalo mañana o usa el modo manual.",
        reason,
      );
    }

    if (response.status === 400 || response.status === 403) {
      throw new YouTubeError(
        "La clave de API no es válida o no tiene permiso para YouTube Data API v3. Revísala en Ajustes.",
        reason,
      );
    }

    if (response.status === 404) {
      throw new YouTubeError(
        "No se encontró el vídeo o la lista de reproducción.",
        reason,
      );
    }

    throw new YouTubeError(detail, reason);
  }

  return (await response.json()) as T;
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const value = input.trim();
  if (!value) return null;

  if (VIDEO_ID.test(value)) return { videoId: value };
  if (!value.startsWith("http") && PLAYLIST_ID.test(value))
    return { playlistId: value };

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (
    ![
      "youtube.com",
      "youtu.be",
      "music.youtube.com",
      "youtube-nocookie.com",
    ].includes(host)
  ) {
    return null;
  }

  let videoId = url.searchParams.get("v") ?? undefined;
  const playlistId = url.searchParams.get("list") ?? undefined;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0];
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      !videoId &&
      ["shorts", "embed", "live", "v"].includes(segments[0] ?? "")
    ) {
      videoId = segments[1];
    }
  }

  if (videoId && !VIDEO_ID.test(videoId)) videoId = undefined;
  if (playlistId && !PLAYLIST_ID.test(playlistId)) return null;
  if (!videoId && !playlistId) return null;

  return { videoId, playlistId };
}

export async function fetchVideoMeta(
  videoId: string,
  apiKey: string,
): Promise<VideoMeta> {
  const data = await fetchJson<{ items?: VideoItem[] }>(
    "videos",
    { part: "snippet,contentDetails", id: videoId },
    apiKey,
  );
  const item = data.items?.[0];

  if (!item) {
    throw new YouTubeError(
      "No se encontró el vídeo. Puede ser privado o haber sido eliminado.",
    );
  }

  return toVideoMeta(item);
}

export async function fetchVideosByIds(
  ids: string[],
  apiKey: string,
): Promise<Map<string, VideoMeta>> {
  const unique = [...new Set(ids.filter((id) => VIDEO_ID.test(id)))];
  const result = new Map<string, VideoMeta>();
  if (unique.length === 0) return result;

  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += 50) {
    chunks.push(unique.slice(index, index + 50));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchJson<{ items?: VideoItem[] }>(
        "videos",
        {
          part: "snippet,contentDetails",
          id: chunk.join(","),
          maxResults: "50",
        },
        apiKey,
      ),
    ),
  );

  for (const page of pages) {
    for (const item of page.items ?? []) {
      result.set(item.id, toVideoMeta(item));
    }
  }

  return result;
}

/**
 * Busca vídeos en todo YouTube, no solo en un canal. Cada consulta cuesta 100
 * unidades de cuota, así que la actualización de una serie hace una sola.
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults = 50,
): Promise<VideoMeta[]> {
  const term = query.trim();
  if (!term) return [];

  const data = await fetchJson<{ items?: SearchItem[] }>(
    "search",
    {
      part: "snippet",
      q: term,
      type: "video",
      maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
      order: "relevance",
      relevanceLanguage: "es",
    },
    apiKey,
  );

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
        youtubeThumbnail(item.id.videoId as string),
    }));

  // La búsqueda no devuelve la duración: la pedimos en una sola llamada extra.
  const durations = await fetchVideosByIds(
    videos.map((video) => video.videoId),
    apiKey,
  ).catch(() => new Map<string, VideoMeta>());

  return videos.map((video) => ({
    ...video,
    description: durations.get(video.videoId)?.description ?? video.description,
    durationSeconds: durations.get(video.videoId)?.durationSeconds,
  }));
}

export async function fetchPlaylist(
  playlistId: string,
  apiKey: string,
): Promise<PlaylistData> {
  const meta = await fetchJson<{ items?: PlaylistResource[] }>(
    "playlists",
    { part: "snippet,contentDetails", id: playlistId },
    apiKey,
  );
  const playlist = meta.items?.[0];

  if (!playlist) {
    throw new YouTubeError(
      "No se encontró la lista de reproducción. Puede ser privada o haber sido eliminada.",
    );
  }

  const items: PlaylistItem[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const page = await fetchJson<{
      items?: PlaylistItem[];
      nextPageToken?: string;
    }>("playlistItems", params, apiKey);

    for (const item of page.items ?? []) {
      if (items.length >= MAX_PLAYLIST_ITEMS) break;
      items.push(item);
    }

    pageToken = page.nextPageToken;
    if (pageToken && seenTokens.has(pageToken)) pageToken = undefined;
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken && items.length < MAX_PLAYLIST_ITEMS);

  const videoIds = items
    .map(
      (item) =>
        item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId,
    )
    .filter((id): id is string => Boolean(id));

  const durations = await fetchVideosByIds(videoIds, apiKey).catch(
    () => new Map<string, VideoMeta>(),
  );

  const parts: Part[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const videoId =
      item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId;
    const title = item.snippet.title;

    if (!videoId || title === "Deleted video" || title === "Private video")
      continue;

    const info = detectPart(title);
    const duration = durations.get(videoId)?.durationSeconds;

    parts.push({
      videoId,
      title,
      partNumber: info.partNumber ?? index + 1,
      totalParts: info.totalParts ?? items.length,
      isFinal: info.isFinal,
      durationSeconds: duration,
      publishedAt: item.snippet.publishedAt,
      thumbnail:
        pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(videoId),
      addedAt: Date.now(),
    });
  }

  return {
    playlistId,
    title: playlist.snippet.title,
    channelId: playlist.snippet.channelId,
    channelTitle: playlist.snippet.channelTitle,
    thumbnail:
      pickThumbnail(playlist.snippet.thumbnails) ?? parts[0]?.thumbnail,
    parts,
    truncated: items.length >= MAX_PLAYLIST_ITEMS,
  };
}

/**
 * Lee los vídeos recientes del canal usando su playlist de subidas.
 * Cuesta 1 unidad por página en vez de las 100 de `search.list`.
 */
export async function fetchChannelUploads(
  channelId: string,
  apiKey: string,
  limit = MAX_PLAYLIST_ITEMS,
): Promise<VideoMeta[]> {
  const channelData = await fetchJson<{ items?: ChannelResource[] }>(
    "channels",
    { part: "contentDetails", id: channelId },
    apiKey,
  );
  const uploads =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploads) return [];

  const items: PlaylistItem[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId: uploads,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const page = await fetchJson<{
      items?: PlaylistItem[];
      nextPageToken?: string;
    }>("playlistItems", params, apiKey);

    for (const item of page.items ?? []) {
      if (items.length >= limit) break;
      items.push(item);
    }

    pageToken = page.nextPageToken;
    if (pageToken && seenTokens.has(pageToken)) pageToken = undefined;
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken && items.length < limit);

  const videoIds = items
    .map(
      (item) =>
        item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId,
    )
    .filter((id): id is string => Boolean(id));

  const durations = await fetchVideosByIds(videoIds, apiKey).catch(
    () => new Map<string, VideoMeta>(),
  );

  const videos: VideoMeta[] = [];

  for (const item of items) {
    const videoId =
      item.contentDetails?.videoId ?? item.snippet.resourceId?.videoId;
    const title = item.snippet.title;

    if (!videoId || title === "Deleted video" || title === "Private video")
      continue;

    const ownerId =
      item.snippet.videoOwnerChannelId ?? item.snippet.channelId ?? channelId;

    videos.push({
      videoId,
      title,
      channelId: ownerId,
      channelTitle:
        item.snippet.videoOwnerChannelTitle ?? item.snippet.channelTitle ?? "",
      channelUrl: ownerId ? channelUrlFor(ownerId) : undefined,
      publishedAt: item.snippet.publishedAt,
      description:
        durations.get(videoId)?.description ?? item.snippet.description,
      thumbnail:
        pickThumbnail(item.snippet.thumbnails) ?? youtubeThumbnail(videoId),
      durationSeconds: durations.get(videoId)?.durationSeconds,
    });
  }

  return videos;
}

const MAX_CANDIDATES = 12;
const MAX_SEMANTIC_CANDIDATES = 12;

export interface SeriesUpdate {
  parts: Part[];
  added: Part[];
  candidates: ChapterCandidate[];
  channelId?: string;
  channelTitle?: string;
  channelUrl?: string;
  semanticFingerprint?: SemanticFingerprint;
  warnings: string[];
}

interface RankedCandidate {
  video: VideoMeta;
  info: ReturnType<typeof detectPart>;
  source: "channel" | "search";
  score: number;
  descriptionTitle?: string;
  matchedBy: "title" | "description";
}

function uniqueTitles(values: Array<string | undefined>): string[] {
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

/**
 * Une varios términos con el operador OR de YouTube. Se limita el número de
 * términos y la longitud porque demasiados OR hacen que la búsqueda pierda
 * resultados relevantes.
 */
function combineSearchTerms(terms: Array<string | undefined>): string {
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

/**
 * Elige el título de descripción más repetido entre las partes conocidas. Si
 * hay empate, prefiere el más descriptivo (más palabras y más largo).
 */
function pickDescriptionReference(values: string[]): string | undefined {
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

function candidateScore(
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

function toCandidate(
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

/**
 * Busca capítulos nuevos de una serie dentro de su canal y en todo YouTube.
 *
 * Además del título de la serie se usan los títulos reales que aparecen en las
 * descripciones de las partes conocidas. Así se encuentran capítulos cuyo
 * título del vídeo es solo un resumen. Solo se añaden automáticamente los
 * vídeos cuyo título base coincide de forma exacta con el de la serie; las
 * coincidencias por descripción y el resto se devuelven como candidatos para
 * que el usuario los valide manualmente y les asigne el número de capítulo.
 */
export async function discoverSeriesUpdates(
  series: Series,
  apiKey: string,
  geminiApiKey?: string,
  geminiModel = "gemini-2.5-flash",
): Promise<SeriesUpdate> {
  if (series.parts.length === 0) {
    throw new YouTubeError(
      "Esta serie no tiene partes que sirvan de referencia para buscar capítulos nuevos.",
    );
  }

  const warnings: string[] = [];
  let failed = false;
  let failure: unknown;
  let channelId = series.channelId;
  let channelTitle = series.channelTitle;
  let channelUrl = series.channelUrl;

  // Las series añadidas a mano pueden no tener canal: lo deducimos de una parte.
  if (!channelId) {
    try {
      const reference = await fetchVideoMeta(series.parts[0].videoId, apiKey);
      channelId = reference.channelId;
      channelTitle = channelTitle || reference.channelTitle;
      channelUrl = channelUrl ?? reference.channelUrl;
    } catch {
      failed = true;
      warnings.push(
        "No se ha podido identificar el canal; se buscará solo en todo YouTube.",
      );
    }
  }

  const known = new Set(series.parts.map((part) => part.videoId));

  // Leemos las descripciones de las partes conocidas para descubrir el título
  // real del drama, que muchas veces no aparece en el título del vídeo.
  const [uploads, referenceVideos] = await Promise.all([
    channelId
      ? fetchChannelUploads(channelId, apiKey).catch((cause) => {
          failed = true;
          failure = cause;
          warnings.push(
            "No se han podido leer los vídeos recientes del canal.",
          );
          return [] as VideoMeta[];
        })
      : Promise.resolve([] as VideoMeta[]),
    fetchVideosByIds([...known], apiKey).catch(
      () => new Map<string, VideoMeta>(),
    ),
  ]);

  const descriptionTitles: string[] = [];

  for (const part of series.parts) {
    const title = extractDescriptionTitle(
      referenceVideos.get(part.videoId)?.description,
    );
    if (title) descriptionTitles.push(title);
  }

  // Si la parte conocida sigue en el canal, su descripción también sirve de
  // referencia aunque `videos.list` no haya respondido.
  for (const video of uploads) {
    if (!known.has(video.videoId)) continue;
    const title = extractDescriptionTitle(video.description);
    if (title) descriptionTitles.push(title);
  }

  const descriptionReference = pickDescriptionReference(descriptionTitles);
  const manualAliases = uniqueTitles(series.aliases ?? []);

  // Ampliamos el título con sinónimos de la RAE para encontrar también las
  // traducciones que usan otras palabras («lluvia» → «precipitación»,
  // «apocalipsis» → «catástrofe»). Si la API falla, seguimos con el título
  // original: es un extra, no un requisito.
  const synonymWords = pickSynonymWordsFromTexts([
    descriptionReference,
    series.title,
    ...manualAliases,
    ...descriptionTitles,
    ...series.parts.map((part) => part.title),
  ]);
  const synonyms = await fetchSynonyms(synonymWords);
  const aliases = buildSynonymAliases(synonyms);

  // Una sola consulta global por actualización: `search.list` cuesta 100
  // unidades de cuota. El título principal y todos los alias manuales tienen
  // prioridad; las referencias y expansiones automáticas son complementarias.
  const baseQuery = buildGlobalSearchQuery(series.title);
  const query = combineSearchTerms([
    baseQuery,
    ...manualAliases.map((alias) => buildGlobalSearchQuery(alias)),
    descriptionReference
      ? buildGlobalSearchQuery(descriptionReference)
      : undefined,
    ...expandQueryWithSynonyms(baseQuery, synonyms).split("|"),
  ]);
  const globalResults = query
    ? await searchYouTubeVideos(query, apiKey).catch((cause) => {
        failed = true;
        failure = cause;
        warnings.push("No se ha podido completar la búsqueda en todo YouTube.");
        return [] as VideoMeta[];
      })
    : [];

  // Si ambas fuentes fallaron, lo más probable es que la clave no sea válida.
  if (uploads.length === 0 && globalResults.length === 0 && failed) {
    if (failure instanceof Error && failure.message) {
      throw new YouTubeError(failure.message);
    }

    throw new YouTubeError(
      warnings.join(" ") ||
        "No se han podido leer los vídeos del canal ni buscar en YouTube. Comprueba la clave de YouTube.",
    );
  }

  const references = uniqueTitles([
    series.title,
    ...manualAliases,
    ...descriptionTitles,
    ...series.parts.map((part) => part.title),
  ]);
  const baseReferences = uniqueTitles([
    series.title,
    ...descriptionTitles,
    ...series.parts.map((part) => part.title),
  ]);
  const referenceKeys = new Set(
    references
      .map((reference) => normalizedBaseTitle(reference))
      .filter(Boolean),
  );
  const referenceTokenCount = Math.max(
    1,
    ...baseReferences.map((reference) => tokenCount(reference)),
  );
  const minShared = referenceTokenCount <= 2 ? 1 : 2;
  const exactKeys = new Set(
    [series.title, ...manualAliases]
      .map((title) => normalizedBaseTitle(title))
      .filter(Boolean),
  );

  // Un mismo vídeo puede aparecer en el canal y en la búsqueda global.
  const byId = new Map<
    string,
    { video: VideoMeta; source: "channel" | "search" }
  >();
  for (const video of uploads)
    byId.set(video.videoId, { video, source: "channel" });
  for (const video of globalResults) {
    if (!byId.has(video.videoId)) {
      byId.set(video.videoId, { video, source: "search" });
    }
  }

  const added: Part[] = [];
  const ranked: RankedCandidate[] = [];
  const semanticPool: RankedCandidate[] = [];

  for (const { video, source } of byId.values()) {
    if (known.has(video.videoId)) continue;

    const info = detectPart(video.title);
    const descriptionTitle = extractDescriptionTitle(video.description);
    const descriptionKey = descriptionTitle
      ? normalizedBaseTitle(descriptionTitle)
      : "";

    const titleOverlap = Math.max(
      ...references.map((reference) =>
        titleJaccard(reference, video.title, aliases),
      ),
    );
    const titleShared = Math.max(
      ...references.map((reference) =>
        sharedTokenCount(reference, video.title, aliases),
      ),
    );
    const descriptionOverlap = descriptionTitle
      ? Math.max(
          ...references.map((reference) =>
            titleJaccard(reference, descriptionTitle, aliases),
          ),
        )
      : 0;
    const descriptionShared = descriptionTitle
      ? Math.max(
          ...references.map((reference) =>
            sharedTokenCount(reference, descriptionTitle, aliases),
          ),
        )
      : 0;
    const learningBonus = keywordConfidenceBonus(
      [video.title, ...(descriptionTitle ? [descriptionTitle] : [])],
      series.keywordConfidence,
    );

    const overlap = Math.max(titleOverlap, descriptionOverlap);
    const shared = Math.max(titleShared, descriptionShared);
    const sameChannel = Boolean(channelId && video.channelId === channelId);

    // Coincidencia exacta del título base (principal o alias): se añade sin
    // preguntar.
    if (exactKeys.has(normalizedBaseTitle(video.title))) {
      added.push(toPart(video, info));
      continue;
    }

    const descriptionMatch = Boolean(
      descriptionKey && referenceKeys.has(descriptionKey),
    );
    const descriptionRelevant = Boolean(
      descriptionTitle &&
      (descriptionMatch ||
        (descriptionShared >= minShared && descriptionOverlap >= 0.65) ||
        (learningBonus >= 4 && descriptionShared >= 1)),
    );

    // El resto solo se propone si comparte palabras suficientes con la serie,
    // ya sea por el título del vídeo o por el título de la descripción.
    const titleRelevant =
      (titleShared >= minShared &&
        (titleOverlap >= 0.45 || (sameChannel && titleOverlap >= 0.3))) ||
      (learningBonus >= 4 && titleShared >= 1);

    const matchedBy: "title" | "description" =
      descriptionRelevant &&
      (descriptionMatch || descriptionOverlap >= titleOverlap)
        ? "description"
        : "title";

    let score = candidateScore(
      info,
      overlap,
      shared,
      referenceTokenCount,
      sameChannel,
      learningBonus,
    );
    if (descriptionMatch) score = Math.min(100, score + 12);
    else if (descriptionRelevant) score = Math.min(100, score + 6);

    const candidate: RankedCandidate = {
      video,
      info,
      source,
      score,
      descriptionTitle,
      matchedBy,
    };

    if (!descriptionRelevant && !titleRelevant) {
      if (
        geminiApiKey &&
        (info.partNumber != null || info.isFinal || descriptionTitle)
      ) {
        semanticPool.push(candidate);
      }
      continue;
    }

    ranked.push(candidate);
  }

  let semanticFingerprint = series.semanticFingerprint;
  if (geminiApiKey) {
    const lexicalCandidates = [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEMANTIC_CANDIDATES);
    const candidatesForFingerprint = [
      ...lexicalCandidates,
      ...semanticPool
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SEMANTIC_CANDIDATES),
    ].filter(
      (candidate, index, candidates) =>
        candidates.findIndex(
          (other) => other.video.videoId === candidate.video.videoId,
        ) === index,
    );
    const entries = [
      ...(!semanticFingerprint
        ? [
            {
              id: "series",
              text: [
                series.title,
                ...manualAliases,
                ...descriptionTitles,
                ...series.parts.slice(0, 10).map((part) => part.title),
              ].join("\n"),
            },
          ]
        : []),
      ...candidatesForFingerprint.map((candidate) => ({
        id: candidate.video.videoId,
        text: [candidate.video.title, candidate.descriptionTitle]
          .filter(Boolean)
          .join("\n"),
      })),
    ];

    if (entries.length > 0) {
      try {
        const fingerprints = await generateSemanticFingerprints(
          geminiApiKey,
          entries,
          geminiModel,
        );
        semanticFingerprint = fingerprints.get("series") ?? semanticFingerprint;

        if (semanticFingerprint) {
          const rankedById = new Map(
            ranked.map((candidate, index) => [candidate.video.videoId, index]),
          );

          for (const candidate of candidatesForFingerprint) {
            const similarity = semanticSimilarity(
              semanticFingerprint,
              fingerprints.get(candidate.video.videoId),
            );
            if (similarity < 0.3) continue;

            const existingIndex = rankedById.get(candidate.video.videoId);
            const baseScore =
              existingIndex == null
                ? Math.max(candidate.score, 30)
                : candidate.score;
            const enhanced = {
              ...candidate,
              score: Math.min(100, baseScore + Math.round(similarity * 35)),
            };

            if (existingIndex == null) {
              rankedById.set(candidate.video.videoId, ranked.length);
              ranked.push(enhanced);
            } else {
              ranked[existingIndex] = enhanced;
            }
          }
        }
      } catch {
        warnings.push(
          "No se pudo analizar la similitud semántica con Gemini; se usarán las coincidencias habituales.",
        );
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  const candidates = ranked
    .slice(0, MAX_CANDIDATES)
    .map((entry) =>
      toCandidate(
        entry.video,
        entry.info,
        entry.source,
        entry.score,
        entry.descriptionTitle,
        entry.matchedBy,
      ),
    );

  if (ranked.length > MAX_CANDIDATES) {
    warnings.push(
      `Se muestran los ${MAX_CANDIDATES} candidatos más parecidos de ${ranked.length}.`,
    );
  }

  return {
    parts: sortParts([...series.parts, ...added]),
    added,
    candidates,
    channelId,
    channelTitle: channelTitle || undefined,
    channelUrl,
    semanticFingerprint,
    warnings,
  };
}

export async function fetchVideoMetaWithoutKey(
  videoId: string,
): Promise<VideoMeta> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(endpoint)}`,
  ];

  for (const proxy of proxies) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(proxy, { signal: controller.signal });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        title?: string;
        author_name?: string;
        author_url?: string;
        thumbnail_url?: string;
      };

      return {
        videoId,
        title: data.title || "Vídeo de YouTube",
        channelTitle: data.author_name || "YouTube",
        channelUrl: data.author_url,
        thumbnail: data.thumbnail_url || youtubeThumbnail(videoId),
      };
    } catch {
      // Probamos el siguiente proxy.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    videoId,
    title: "Vídeo de YouTube",
    channelTitle: "YouTube",
    thumbnail: youtubeThumbnail(videoId),
  };
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
  };
}

/**
 * Convierte un candidato validado en una parte, aplicando el número y la marca
 * de final que haya elegido el usuario.
 */
export function candidateToPart(
  candidate: ChapterCandidate,
  options: { partNumber?: number; isFinal?: boolean } = {},
): Part {
  return {
    videoId: candidate.videoId,
    title: candidate.title,
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
  const info = detectPart(video.title);
  const part = toPart(video, info);

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

/**
 * Prepara la vista previa al añadir una serie. Usa exactamente la misma
 * búsqueda que «Actualizar serie»: subidas del canal, búsqueda global y
 * coincidencias por el título real de la descripción. Los vídeos que no
 * coinciden de forma exacta se devuelven como candidatos para validarlos a
 * mano antes de guardar.
 */
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
  const playlist = await fetchPlaylist(playlistId, apiKey);
  return buildPlaylistDraft(playlist);
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

export function durationLabel(seconds?: number): string | undefined {
  return formatDuration(seconds);
}
