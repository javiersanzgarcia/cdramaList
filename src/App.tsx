import { useEffect, useMemo, useState } from "react";
import { PlayerSheet } from "./features/playback/components/PlayerSheet";
import { AddSeriesSheet } from "./features/series/components/AddSeriesSheet";
import { SeriesSheet } from "./features/series/components/SeriesSheet";
import { AccountSheet } from "./features/settings/components/AccountSheet";
import { SettingsView } from "./features/settings/components/SettingsView";
import { HomeView } from "./features/library/components/HomeView";
import { ListView } from "./features/library/components/ListView";
import { BottomNav } from "./shared/components/BottomNav";
import { BusyOverlay } from "./shared/components/BusyOverlay";
import * as Icon from "./shared/components/Icons";
import { TopBar } from "./shared/components/TopBar";
import { useDriveSync } from "./features/sync/hooks/useDriveSync";
import { useInstallPrompt } from "./app/hooks/useInstallPrompt";
import {
  filterSeries,
  groupSeries,
  isSeries,
  mergeSeriesCollections,
  normalizeSeries,
  watchedCount,
} from "./features/series/model/series";
import { useAppStore } from "./store/appStore";
import { useSeriesActions } from "./features/series/useSeriesActions";
import type { Filter } from "./features/series/types";
import type { PlayerState, Tab } from "./app/types";

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
const ENV_YOUTUBE_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY ?? "").trim();
const ENV_SEMANTIC_API_URL = (import.meta.env.VITE_SEMANTIC_API_URL ?? "").trim();

export default function App() {
  const series = useAppStore((state) => state.series);
  const setSeries = useAppStore((state) => state.setSeries);
  const apiKeyOverride = useAppStore((state) => state.apiKeyOverride);
  const setApiKeyOverride = useAppStore((state) => state.setApiKeyOverride);
  const apiKey = ENV_YOUTUBE_API_KEY || apiKeyOverride;
  const googleUser = useAppStore((state) => state.googleUser);
  const setGoogleUser = useAppStore((state) => state.setGoogleUser);
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
  const [refreshing, setRefreshing] = useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();
  const {
    updateSeries,
    openSeries,
    playSeries,
    toggleFavorite,
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
  } = useSeriesActions({
    series,
    setSeries,
    apiKey,
    semanticEndpoint: ENV_SEMANTIC_API_URL,
    drive,
    setSelectedSeriesId,
    setPlayer,
    setAddTargetId,
    setAddOpen,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // Mientras se actualiza una serie, avisa antes de cerrar o recargar la app
  // y absorbe el botón «atrás» del navegador para no interrumpir la búsqueda
  // ni dejar la sincronización a medias.
  useEffect(() => {
    if (!refreshing) return;

    const guardState = {
      ...(window.history.state ?? {}),
      cdramalistBusy: true,
    };
    window.history.pushState(guardState, "");

    function handlePopState() {
      window.history.pushState(guardState, "");
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Retira la entrada de guardia sin salir de la app. Cada «atrás» se
      // absorbe reponiendo la misma entrada, así que basta con retroceder una.
      if (window.history.state?.cdramalistBusy) {
        window.history.back();
      }
    };
  }, [refreshing]);

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
            header={
              <TopBar
                eyebrow="Tus historias, parte a parte"
                title="CdramaList"
                canInstall={canInstall}
                onInstall={promptInstall}
                user={googleUser}
                syncDirty={drive.dirty}
                syncBusy={drive.busy}
                onOpenAccount={() => setAccountOpen(true)}
              />
            }
            series={filtered}
            allSeries={series}
            query={query}
            filter={filter}
            apiKeyConfigured={apiKey.length > 0}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onOpen={openSeries}
            onPlay={playSeries}
            onToggleFavorite={toggleFavorite}
            onAdd={openAdd}
            onOpenSettings={() => setTab("settings")}
          />
        )}

        {tab === "list" && (
          <ListView
            header={
              <TopBar
                eyebrow={`${series.length} ${series.length === 1 ? "serie guardada" : "series guardadas"}`}
                title="Mi lista"
                canInstall={canInstall}
                onInstall={promptInstall}
                user={googleUser}
                syncDirty={drive.dirty}
                syncBusy={drive.busy}
                onOpenAccount={() => setAccountOpen(true)}
              />
            }
            groups={groups}
            onOpen={openSeries}
            onToggleFavorite={toggleFavorite}
            onAdd={openAdd}
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
          semanticConfigured={ENV_SEMANTIC_API_URL.length > 0}
          refreshing={refreshing}
          onBusyChange={setRefreshing}
          onClose={() => setSelectedSeriesId(null)}
          onPlay={playSeries}
          onToggleFavorite={toggleFavorite}
          onSetWatched={setWatched}
          onMovePart={movePart}
          onAddParts={handleAddParts}
          onRefresh={handleRefreshSeries}
          onAddCandidate={handleAddCandidate}
          onUpdateAliases={updateAliases}
          onUpdateTitle={updateTitle}
          onFillDurations={fillMissingDurations}
          onDelete={deleteSeries}
        />
      )}

      {player && playerSeries && (
        <PlayerSheet
          series={playerSeries}
          startIndex={player.index}
          apiKey={apiKey}
          onClose={() => setPlayer(null)}
          onSetWatched={setWatched}
          onUpdatePartMeta={updatePartMeta}
          onFillDurations={fillMissingDurations}
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

      <BusyOverlay
        open={refreshing}
        title="Actualizando serie…"
        message="No cierres la app ni cambies de pantalla. Estamos buscando capítulos y guardando los cambios; puede tardar hasta un minuto."
      />
    </div>
  );
}
