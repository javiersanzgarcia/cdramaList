import { useEffect, useMemo, useRef, useState } from "react";
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
import type { ChapterCandidate } from "./features/discovery/types";
import type { PlayerState, Tab } from "./app/types";

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
const ENV_YOUTUBE_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY ?? "").trim();
const ENV_SEMANTIC_API_URL = (import.meta.env.VITE_SEMANTIC_API_URL ?? "").trim();

export default function App() {
  const allSeries = useAppStore((state) => state.series);
  const setSeries = useAppStore((state) => state.setSeries);
  // Las series borradas se conservan marcadas con una lápida para que el
  // borrado se propague al sincronizar, pero no se muestran ni cuentan.
  const series = useMemo(
    () => allSeries.filter((item) => !item.deletedAt),
    [allSeries],
  );
  const apiKeyOverride = useAppStore((state) => state.apiKeyOverride);
  const setApiKeyOverride = useAppStore((state) => state.setApiKeyOverride);
  const apiKey = ENV_YOUTUBE_API_KEY || apiKeyOverride;
  const googleUser = useAppStore((state) => state.googleUser);
  const setGoogleUser = useAppStore((state) => state.setGoogleUser);
  // La sincronización trabaja con la lista completa para no perder las lápidas
  // de las series borradas.
  const drive = useDriveSync({
    clientId: ENV_CLIENT_ID,
    series: allSeries,
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
  // Distingue si el bloqueo de pantalla viene de actualizar una serie o del
  // lote de favoritas, para mostrar el mensaje adecuado.
  const [busyOperation, setBusyOperation] = useState<"series" | "favorites">(
    "series",
  );
  // Series con novedades pendientes de revisar tras actualizar las favoritas.
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<
    Record<string, ChapterCandidate[]>
  >({});
  // Bloqueo síncrono para que dos pulsaciones rápidas no lancen dos lotes
  // antes de que React aplique el estado de `refreshing`.
  const favoritesRefreshRef = useRef(false);
  const { canInstall, promptInstall } = useInstallPrompt();
  const {
    updateSeries,
    openSeries,
    playSeries,
    toggleFavorite,
    setSeriesThumbnail,
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
    handleRefreshFavorites,
    handleAddCandidate,
    discardCandidate,
  } = useSeriesActions({
    // Las acciones ven la lista completa (incluidas las lápidas) para no
    // reintroducir series borradas al construir la lista que se sincroniza.
    series: allSeries,
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
      // Al pulsar «atrás» la entrada de guardia sigue en el historial de avance,
      // así que se recupera con `forward()` en vez de crear una nueva: si se
      // hiciera `pushState` en cada pulsación quedarían entradas fantasma.
      if (window.history.state?.cdramalistBusy) return;
      window.history.forward();
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
      // Retira la entrada de guardia sin salir de la app.
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

  // Cerrar la ficha no descarta la cola de revisión: se conserva para poder
  // reabrirla con el botón flotante «Revisar novedades» sin recalcular todo.
  function closeSeries() {
    setSelectedSeriesId(null);
  }

  async function refreshFavorites() {
    if (favoritesRefreshRef.current) {
      return { updated: 0, failed: 0, warnings: [], syncFailed: false };
    }

    favoritesRefreshRef.current = true;
    // Igual que al actualizar una serie, se bloquea toda la interfaz mientras
    // dura el lote: así no se pueden hacer cambios que luego se perderían al
    // guardar el resultado ni borrar series que el snapshot resucitaría.
    setBusyOperation("favorites");
    setRefreshing(true);

    try {
      const result = await handleRefreshFavorites();
      if (result.updatedIds.length > 0) {
        // Se autoabre la primera serie con novedades y el resto espera en la cola.
        setReviewCandidates(result.candidatesById);
        setReviewQueue(result.updatedIds);
        setSelectedSeriesId(result.updatedIds[0]);
      }
      return {
        updated: result.updatedIds.length,
        failed: result.failed,
        warnings: result.warnings,
        syncFailed: result.syncFailed,
      };
    } finally {
      favoritesRefreshRef.current = false;
      setRefreshing(false);
    }
  }

  function reviewNext() {
    const [, ...rest] = reviewQueue;
    setReviewQueue(rest);
    if (rest.length > 0) setSelectedSeriesId(rest[0]);
  }

  function handleDeleteSeries(id: string) {
    const wasReviewHead = reviewQueue[0] === id;
    const rest = reviewQueue.filter((item) => item !== id);

    setReviewQueue(rest);
    setReviewCandidates((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    deleteSeries(id);

    // Si se borra la serie que encabezaba la cola, se abre la siguiente para
    // que la revisión no se quede atascada esperando a que se abra a mano.
    if (wasReviewHead && rest.length > 0) {
      setSelectedSeriesId(rest[0]);
    }
  }

  // El botón «Revisar siguiente serie» solo aparece en la ficha de la serie que
  // encabeza la cola y cuando queda alguna otra pendiente.
  const reviewHead =
    reviewQueue.length > 1 && reviewQueue[0] === selectedSeriesId;

  function handleReset() {
    updateSeries(() => []);
    setSelectedSeriesId(null);
    setPlayer(null);
    setReviewQueue([]);
    setReviewCandidates({});
    setAddOpen(false);
    setAddTargetId(null);
  }

  function handleExport() {
    const payload = {
      app: "cdramalist",
      version: 2,
      exportedAt: new Date().toISOString(),
      // Se exporta también lo borrado (con lápida) para que al importar en otro
      // dispositivo no reaparezca.
      series: allSeries,
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

      const importedCount = imported.filter((item) => !item.deletedAt).length;
      window.alert(
        `Se ${importedCount === 1 ? "ha importado 1 serie" : `han importado ${importedCount} series`}.`,
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
            onRefreshFavorites={refreshFavorites}
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

      {(reviewQueue.length > 0 ||
        (tab === "list" && series.length > 0)) &&
        !selectedSeries &&
        !player &&
        !addOpen && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_5rem)] z-20 mx-auto flex w-full max-w-md flex-col items-end gap-3 px-4">
            {reviewQueue.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSeriesId(reviewQueue[0])}
                className="pointer-events-auto flex items-center gap-2 self-center rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xl shadow-rose-500/30 transition hover:bg-rose-400 active:scale-95"
              >
                <Icon.Sparkles className="size-4" />
                Revisar novedades ({reviewQueue.length})
              </button>
            )}

            {tab === "list" && series.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                aria-label="Añadir serie"
                className="pointer-events-auto grid size-12 place-items-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/30 transition hover:bg-rose-400 active:scale-95"
              >
                <Icon.Plus className="size-5" />
              </button>
            )}
          </div>
        )}

      {selectedSeries && !player && (
        <SeriesSheet
          key={selectedSeries.id}
          series={selectedSeries}
          semanticConfigured={ENV_SEMANTIC_API_URL.length > 0}
          refreshing={refreshing}
          onBusyChange={(busy) => {
            setBusyOperation("series");
            setRefreshing(busy);
          }}
          onClose={closeSeries}
          onPlay={playSeries}
          onToggleFavorite={toggleFavorite}
          onSetThumbnail={setSeriesThumbnail}
          onSetStatus={setSeriesStatus}
          onSetWatched={setWatched}
          onMovePart={movePart}
          onAddParts={handleAddParts}
          onRefresh={handleRefreshSeries}
          onAddCandidate={handleAddCandidate}
          onDiscardCandidate={discardCandidate}
          onUpdateAliases={updateAliases}
          onUpdateTitle={updateTitle}
          onFillDurations={fillMissingDurations}
          onDelete={handleDeleteSeries}
          reviewRemaining={reviewHead ? reviewQueue.length - 1 : 0}
          onReviewNext={reviewNext}
          initialCandidates={reviewCandidates[selectedSeries.id] ?? []}
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
        title={
          busyOperation === "favorites"
            ? "Actualizando favoritas…"
            : "Actualizando serie…"
        }
        message={
          busyOperation === "favorites"
            ? "No cierres la app ni cambies de pantalla. Estamos buscando capítulos nuevos en todas tus favoritas; puede tardar varios minutos."
            : "No cierres la app ni cambies de pantalla. Estamos buscando capítulos y guardando los cambios; puede tardar hasta un minuto."
        }
      />
    </div>
  );
}
