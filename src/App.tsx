import { useEffect, useMemo, useState } from "react";
import { AccountSheet } from "./components/AccountSheet";
import { AddSeriesSheet } from "./components/AddSeriesSheet";
import { BottomNav } from "./components/BottomNav";
import { HomeView } from "./components/HomeView";
import * as Icon from "./components/Icons";
import { ListView } from "./components/ListView";
import { PlayerSheet } from "./components/PlayerSheet";
import { SeriesSheet } from "./components/SeriesSheet";
import { SettingsView } from "./components/SettingsView";
import { useDriveSync } from "./hooks/useDriveSync";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { usePersistentState } from "./hooks/usePersistentState";
import { sanitizeGoogleUser } from "./lib/google";
import { sortParts } from "./lib/parts";
import {
  createSeries,
  filterSeries,
  groupSeries,
  isSeries,
  learnKeywordConfidence,
  mergeSeries,
  mergeSeriesCollections,
  normalizeSeries,
  watchedCount,
} from "./lib/series";
import { candidateToPart, discoverSeriesUpdates } from "./lib/youtube";
import type {
  ChapterCandidate,
  Filter,
  GoogleUser,
  Part,
  Series,
  SeriesDraft,
  SeriesRefreshResult,
  Tab,
} from "./types";

interface PlayerState {
  seriesId: string;
  index: number;
}

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
const ENV_YOUTUBE_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY ?? "").trim();

export default function App() {
  const [series, setSeries] = usePersistentState<Series[]>(
    "cdramalist:series",
    [],
    (value) =>
      Array.isArray(value) ? value.filter(isSeries).map(normalizeSeries) : [],
  );
  const [apiKeyOverride, setApiKeyOverride] = usePersistentState<string>(
    "cdramalist:apiKey",
    "",
    (value) => (typeof value === "string" ? value : ""),
  );
  const apiKey = ENV_YOUTUBE_API_KEY || apiKeyOverride;
  const [googleUser, setGoogleUser] = usePersistentState<GoogleUser | null>(
    "cdramalist:googleUser",
    null,
    sanitizeGoogleUser,
  );
  const drive = useDriveSync({
    clientId: ENV_CLIENT_ID,
    series,
    setSeries,
    onUser: setGoogleUser,
  });
  const [accountOpen, setAccountOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<Tab>("home");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTargetId, setAddTargetId] = useState<string | null>(null);
  const { canInstall, promptInstall } = useInstallPrompt();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // Limpia claves antiguas: el token de GitHub y el Client ID editable, que
  // ahora se configura solo con VITE_GOOGLE_CLIENT_ID.
  useEffect(() => {
    try {
      window.localStorage.removeItem("cdramalist:syncConfig");
      window.localStorage.removeItem("cdramalist:syncDirty");
      window.localStorage.removeItem("cdramalist:googleClientId");
    } catch {
      // Sin acceso a localStorage: no hay nada que limpiar.
    }
  }, []);

  const filtered = useMemo(
    () => filterSeries(series, query, filter),
    [series, query, filter],
  );
  const groups = useMemo(() => groupSeries(series), [series]);

  const selectedSeries = selectedSeriesId
    ? (series.find((item) => item.id === selectedSeriesId) ?? null)
    : null;
  const playerSeries = player
    ? (series.find((item) => item.id === player.seriesId) ?? null)
    : null;
  const addTarget = addTargetId
    ? (series.find((item) => item.id === addTargetId) ?? null)
    : null;

  const watchedParts = useMemo(
    () => series.reduce((total, item) => total + watchedCount(item), 0),
    [series],
  );
  const favoriteCount = useMemo(
    () => series.filter((item) => item.favorite).length,
    [series],
  );

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

    const update = await discoverSeriesUpdates(item, apiKey);

    if (update.added.length === 0) {
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
      updatedAt: Date.now(),
    };

    setSeries((current) =>
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

    setSeries((current) =>
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

  function openAdd() {
    setAddTargetId(null);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setAddTargetId(null);
  }

  function handleReset() {
    updateSeries(() => []);
    setSelectedSeriesId(null);
    setPlayer(null);
    setAddOpen(false);
    setAddTargetId(null);
  }

  function handleExport() {
    const payload = {
      app: "cdramalist",
      version: 2,
      exportedAt: new Date().toISOString(),
      series,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cdramalist-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      let raw: unknown[] | null = null;
      if (Array.isArray(parsed)) {
        raw = parsed;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { series?: unknown }).series)
      ) {
        raw = (parsed as { series: unknown[] }).series;
      }

      if (!raw) throw new Error("Formato no reconocido");

      const imported = raw.filter(isSeries).map(normalizeSeries);
      if (imported.length === 0) throw new Error("Sin series válidas");

      updateSeries((current) => mergeSeriesCollections(current, imported));

      window.alert(
        `Se ${imported.length === 1 ? "ha importado 1 serie" : `han importado ${imported.length} series`}.`,
      );
    } catch {
      window.alert(
        "No se pudo importar el archivo. Asegúrate de que es una copia exportada por CdramaList.",
      );
    }
  }

  function openSettingsFromAdd() {
    closeAdd();
    setSelectedSeriesId(null);
    setTab("settings");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-950 pb-24">
      <main className="flex-1">
        {tab === "home" && (
          <HomeView
            series={filtered}
            allSeries={series}
            query={query}
            filter={filter}
            canInstall={canInstall}
            apiKeyConfigured={apiKey.length > 0}
            googleUser={googleUser}
            syncDirty={drive.dirty}
            syncBusy={drive.busy}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onOpen={openSeries}
            onPlay={playSeries}
            onToggleFavorite={toggleFavorite}
            onAdd={openAdd}
            onInstall={promptInstall}
            onOpenSettings={() => setTab("settings")}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )}

        {tab === "list" && (
          <ListView
            groups={groups}
            canInstall={canInstall}
            googleUser={googleUser}
            syncDirty={drive.dirty}
            syncBusy={drive.busy}
            onOpen={openSeries}
            onToggleFavorite={toggleFavorite}
            onInstall={promptInstall}
            onAdd={openAdd}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )}

        {tab === "settings" && (
          <SettingsView
            apiKey={apiKey}
            seriesCount={series.length}
            watchedPartsCount={watchedParts}
            favoriteCount={favoriteCount}
            canInstall={canInstall}
            googleUser={googleUser}
            syncEnabled={drive.connected}
            syncDirty={drive.dirty}
            syncBusy={drive.busy}
            onApiKeyChange={setApiKeyOverride}
            apiKeyLocked={ENV_YOUTUBE_API_KEY.length > 0}
            onInstall={promptInstall}
            onReset={handleReset}
            onExport={handleExport}
            onImport={handleImport}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )}
      </main>

      <BottomNav tab={tab} savedCount={series.length} onChange={setTab} />

      {tab === "list" &&
        series.length > 0 &&
        !selectedSeries &&
        !player &&
        !addOpen && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_5rem)] z-20 mx-auto w-full max-w-md px-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openAdd}
                aria-label="Añadir serie"
                className="pointer-events-auto grid size-12 place-items-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/30 transition hover:bg-rose-400 active:scale-95"
              >
                <Icon.Plus className="size-5" />
              </button>
            </div>
          </div>
        )}

      {selectedSeries && !player && (
        <SeriesSheet
          series={selectedSeries}
          onClose={() => setSelectedSeriesId(null)}
          onPlay={playSeries}
          onToggleFavorite={toggleFavorite}
          onSetWatched={setWatched}
          onAddParts={handleAddParts}
          onRefresh={handleRefreshSeries}
          onAddCandidate={handleAddCandidate}
          onUpdateAliases={updateAliases}
          onDelete={deleteSeries}
        />
      )}

      {player && playerSeries && (
        <PlayerSheet
          series={playerSeries}
          startIndex={player.index}
          onClose={() => setPlayer(null)}
          onSetWatched={setWatched}
        />
      )}

      {addOpen && (
        <AddSeriesSheet
          apiKey={apiKey}
          series={series}
          targetSeries={addTarget ?? undefined}
          onClose={closeAdd}
          onSave={handleSave}
          onOpenSettings={openSettingsFromAdd}
        />
      )}

      {accountOpen && (
        <AccountSheet
          user={googleUser}
          clientId={ENV_CLIENT_ID}
          drive={drive}
          onClose={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}
