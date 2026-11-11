import type { Dispatch, SetStateAction } from "react";
import type { PlayerState } from "../../app/types";
import type { ChapterCandidate, SeriesRefreshResult } from "../discovery/types";
import { candidateToPart } from "../discovery/model/youtubeDrafts";
import { discoverSeriesUpdates } from "../discovery/model/seriesUpdates";
import { fetchVideosByIds } from "../discovery/model/youtubeApi";
import { reorderParts, sortParts } from "./model/parts";
import {
  applyPartDurations,
  applyPartMeta,
  createSeries,
  learnKeywordConfidence,
  mergeAliasesWithParts,
  mergeSeries,
  watchedCount,
} from "./model/series";
import type { PartMetaPatch } from "./model/series";
import type { Part, Series, SeriesDraft, SeriesStatus } from "./types";
import type { DriveSync } from "../sync/hooks/useDriveSync";

interface UseSeriesActionsOptions {
  series: Series[];
  setSeries: Dispatch<SetStateAction<Series[]>>;
  apiKey: string;
  semanticEndpoint: string;
  drive: Pick<DriveSync, "connected" | "syncNow">;
  setSelectedSeriesId: Dispatch<SetStateAction<string | null>>;
  setPlayer: Dispatch<SetStateAction<PlayerState | null>>;
  setAddTargetId: Dispatch<SetStateAction<string | null>>;
  setAddOpen: Dispatch<SetStateAction<boolean>>;
}

export function useSeriesActions({
  series,
  setSeries,
  apiKey,
  semanticEndpoint,
  drive,
  setSelectedSeriesId,
  setPlayer,
  setAddTargetId,
  setAddOpen,
}: UseSeriesActionsOptions) {
  function updateSeries(updater: (current: Series[]) => Series[]) {
    setSeries((current) => updater(current));
  }

  function touchSeries(id: string) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, lastOpenedAt: Date.now() } : item,
      ),
    );
  }

  function openSeries(item: Series) {
    // Abrir la serie no cuenta como progreso: solo reproducir una parte
    // cambia el estado automático a «en curso».
    setSelectedSeriesId(item.id);
  }

  function playSeries(item: Series, index: number) {
    const safeIndex = Math.min(
      Math.max(index, 0),
      Math.max(item.parts.length - 1, 0),
    );
    setPlayer({ seriesId: item.id, index: safeIndex });
    touchSeries(item.id);
  }

  function toggleFavorite(id: string) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    );
  }

  function setSeriesStatus(id: string, status: SeriesStatus) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status, updatedAt: Date.now() } : item,
      ),
    );
  }

  function updateAliases(id: string, aliases: string[]) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, aliases, updatedAt: Date.now() } : item,
      ),
    );
  }

  function updatePartMeta(
    seriesId: string,
    videoId: string,
    patch: PartMetaPatch,
  ) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === seriesId ? applyPartMeta(item, videoId, patch) : item,
      ),
    );
  }

  async function fillMissingDurations(item: Series): Promise<void> {
    if (!apiKey) return;

    const missing = item.parts.filter(
      (part) => part.durationSeconds == null,
    );
    if (missing.length === 0) return;

    try {
      const metas = await fetchVideosByIds(
        missing.map((part) => part.videoId),
        apiKey,
      );
      if (metas.size === 0) return;

      updateSeries((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? applyPartDurations(existing, metas)
            : existing,
        ),
      );
    } catch {
      // La duración es informativa: si falla, la serie sigue funcionando.
    }
  }

  function updateTitle(id: string, title: string) {
    const nextTitle = title.trim().replace(/\s+/g, " ");
    if (nextTitle.length < 2) return;

    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== id || nextTitle === item.title) return item;

        return {
          ...item,
          title: nextTitle,
          aliases: mergeAliasesWithParts(item.aliases, item.parts, nextTitle),
          updatedAt: Date.now(),
        };
      }),
    );
  }

  function setWatched(seriesId: string, videoId: string, watched: boolean) {
    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item;

        const already = item.watched.includes(videoId);
        if (already === watched) return item;

        const nextWatched = watched
          ? [...item.watched, videoId]
          : item.watched.filter((id) => id !== videoId);
        const wasComplete =
          item.parts.length > 0 && watchedCount(item) >= item.parts.length;
        const isComplete =
          item.parts.length > 0 &&
          item.parts.filter((part) => nextWatched.includes(part.videoId))
            .length >= item.parts.length;

        return {
          ...item,
          watched: nextWatched,
          // Al completar todas las partes el estado pasa a «completada». Si una
          // serie completada deja de estarlo, se vuelve al estado automático.
          status: isComplete
            ? "completed"
            : wasComplete
              ? undefined
              : item.status,
          updatedAt: Date.now(),
        };
      }),
    );
  }

  function movePart(seriesId: string, fromIndex: number, toIndex: number) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === seriesId
          ? {
              ...item,
              parts: reorderParts(item.parts, fromIndex, toIndex),
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
  }

  function handleSave(draft: SeriesDraft, title: string, parts: Part[]) {
    const existing = draft.existingSeriesId
      ? series.find((item) => item.id === draft.existingSeriesId)
      : undefined;

    if (existing) {
      updateSeries((current) =>
        current.map((item) =>
          item.id === existing.id
            ? mergeSeries(item, draft, title, parts)
            : item,
        ),
      );
      setSelectedSeriesId(existing.id);
    } else {
      const created = createSeries(draft, title, parts);
      updateSeries((current) => [created, ...current]);
      setSelectedSeriesId(created.id);
    }

    setAddOpen(false);
    setAddTargetId(null);
  }

  function deleteSeries(id: string) {
    updateSeries((current) => current.filter((item) => item.id !== id));
    setSelectedSeriesId((current) => (current === id ? null : current));
    setPlayer((current) => (current?.seriesId === id ? null : current));
    setAddTargetId((current) => (current === id ? null : current));
    setAddOpen(false);
  }

  function handleAddParts(item: Series) {
    setSelectedSeriesId(item.id);
    setAddTargetId(item.id);
    setAddOpen(true);
  }

  async function handleRefreshSeries(
    item: Series,
  ): Promise<SeriesRefreshResult> {
    if (!apiKey) {
      throw new Error(
        "Configura la clave de YouTube en Ajustes para buscar capítulos nuevos.",
      );
    }

    const update = await discoverSeriesUpdates(
      item,
      apiKey,
      semanticEndpoint,
    );
    const learnedFingerprint =
      !item.semanticFingerprint && Boolean(update.semanticFingerprint);

    if (update.added.length === 0 && !learnedFingerprint) {
      return {
        added: 0,
        candidates: update.candidates,
        parts: update.parts,
        warnings: update.warnings,
        synced: false,
      };
    }

    const next: Series = {
      ...item,
      channelId: item.channelId ?? update.channelId,
      channelTitle:
        item.channelTitle === "YouTube" && update.channelTitle
          ? update.channelTitle
          : item.channelTitle,
      channelUrl: item.channelUrl ?? update.channelUrl,
      parts: update.parts,
      semanticFingerprint:
        update.semanticFingerprint ?? item.semanticFingerprint,
      updatedAt: Date.now(),
    };

    updateSeries((current) =>
      current.map((existing) => (existing.id === item.id ? next : existing)),
    );

    let synced = false;
    if (drive.connected) {
      const nextSeries = series.map((existing) =>
        existing.id === item.id ? next : existing,
      );
      synced = await drive.syncNow(nextSeries);
    }

    return {
      added: update.added.length,
      candidates: update.candidates,
      parts: update.parts,
      warnings: update.warnings,
      synced,
    };
  }

  async function handleAddCandidate(
    item: Series,
    candidate: ChapterCandidate,
    options: { partNumber?: number; isFinal?: boolean },
  ): Promise<{ synced: boolean }> {
    if (item.parts.some((part) => part.videoId === candidate.videoId)) {
      return { synced: false };
    }

    const part = candidateToPart(candidate, options);
    const next: Series = {
      ...item,
      parts: sortParts([...item.parts, part]),
      keywordConfidence: learnKeywordConfidence(item.keywordConfidence, [
        candidate.title,
        ...(candidate.descriptionTitle ? [candidate.descriptionTitle] : []),
      ]),
      updatedAt: Date.now(),
    };

    updateSeries((current) =>
      current.map((existing) => (existing.id === item.id ? next : existing)),
    );

    let synced = false;
    if (drive.connected) {
      const nextSeries = series.map((existing) =>
        existing.id === item.id ? next : existing,
      );
      synced = await drive.syncNow(nextSeries);
    }

    return { synced };
  }

  return {
    updateSeries,
    openSeries,
    playSeries,
    toggleFavorite,
    setSeriesStatus,
    updateAliases,
    updateTitle,
    updatePartMeta,
    fillMissingDurations,
    setWatched,
    movePart,
    handleSave,
    deleteSeries,
    handleAddParts,
    handleRefreshSeries,
    handleAddCandidate,
  };
}
