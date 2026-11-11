import type { Dispatch, SetStateAction } from "react";
import type { PlayerState } from "../../app/types";
import type { ChapterCandidate, SeriesRefreshResult } from "../discovery/types";
import { candidateToPart } from "../discovery/model/youtubeDrafts";
import { discoverSeriesUpdates } from "../discovery/model/seriesUpdates";
import { reorderParts, sortParts } from "./model/parts";
import {
  createSeries,
  learnKeywordConfidence,
  mergeSeries,
} from "./model/series";
import type { Part, Series, SeriesDraft } from "./types";
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
    setSelectedSeriesId(item.id);
    touchSeries(item.id);
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

  function updateAliases(id: string, aliases: string[]) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, aliases, updatedAt: Date.now() } : item,
      ),
    );
  }

  function setWatched(seriesId: string, videoId: string, watched: boolean) {
    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item;

        const already = item.watched.includes(videoId);
        if (already === watched) return item;

        return {
          ...item,
          watched: watched
            ? [...item.watched, videoId]
            : item.watched.filter((id) => id !== videoId),
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
    updateAliases,
    setWatched,
    movePart,
    handleSave,
    deleteSeries,
    handleAddParts,
    handleRefreshSeries,
    handleAddCandidate,
  };
}
