import { useEffect, useState } from "react";
import { formatDuration } from "../../../shared/lib/format";
import { partLabel } from "../model/parts";
import {
  isSeriesComplete,
  nextPartIndex,
  progressPercent,
  seriesStatus,
  watchedCount,
} from "../model/series";
import { statusMeta, statusOrder } from "../model/status";
import { channelUrlFor } from "../../discovery/model/youtube";
import type {
  ChapterCandidate,
  SeriesRefreshResult,
} from "../../discovery/types";
import type { Series, SeriesStatus } from "../types";
import { useSheet } from "../../../shared/hooks/useSheet";
import { SeriesAliasesEditor } from "./SeriesAliasesEditor";
import { SeriesPartsList } from "./SeriesPartsList";
import { SeriesRefreshPanel } from "./SeriesRefreshPanel";
import { SeriesTitleEditor } from "./SeriesTitleEditor";
import * as Icon from "../../../shared/components/Icons";

interface SeriesSheetProps {
  series: Series;
  semanticConfigured: boolean;
  refreshing: boolean;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onPlay: (series: Series, index: number) => void;
  onToggleFavorite: (id: string) => void;
  onSetStatus: (id: string, status: SeriesStatus) => void;
  onSetWatched: (seriesId: string, videoId: string, watched: boolean) => void;
  onMovePart: (seriesId: string, fromIndex: number, toIndex: number) => void;
  onAddParts: (series: Series) => void;
  onRefresh: (series: Series) => Promise<SeriesRefreshResult>;
  onAddCandidate: (
    series: Series,
    candidate: ChapterCandidate,
    options: { partNumber?: number; isFinal?: boolean },
  ) => Promise<{ synced: boolean }>;
  onUpdateAliases: (seriesId: string, aliases: string[]) => void;
  onUpdateTitle: (seriesId: string, title: string) => void;
  onFillDurations: (series: Series) => Promise<void>;
  onDelete: (id: string) => void;
}

export function SeriesSheet({
  series,
  semanticConfigured,
  refreshing,
  onBusyChange,
  onClose,
  onPlay,
  onToggleFavorite,
  onSetStatus,
  onSetWatched,
  onMovePart,
  onAddParts,
  onRefresh,
  onAddCandidate,
  onUpdateAliases,
  onUpdateTitle,
  onFillDurations,
  onDelete,
}: SeriesSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const handleClose = () => {
    if (!refreshing) onClose();
  };
  useSheet(handleClose);

  // Rellena las duraciones que falten (series antiguas o creadas sin cuota)
  // para poder mostrar la duración de cada parte y el total de la serie.
  useEffect(() => {
    void onFillDurations(series);
    // Solo al abrir la serie; el callback cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id]);

  const total = series.parts.length;
  const watched = watchedCount(series);
  const complete = isSeriesComplete(series);
  const status = seriesStatus(series);
  const hasProgress = watched > 0 || Boolean(series.lastOpenedAt);
  const nextIndex = nextPartIndex(series);
  const nextPart = series.parts[nextIndex];
  const progress = progressPercent(series);
  const channelUrl =
    series.channelUrl ??
    (series.channelId ? channelUrlFor(series.channelId) : undefined);

  const totalDuration = series.parts.reduce(
    (sum, part) => sum + (part.durationSeconds ?? 0),
    0,
  );
  const totalLabel = formatDuration(totalDuration);

  const continueLabel = complete
    ? "Volver a ver desde el principio"
    : watched === 0
      ? "Empezar la serie"
      : nextPart
        ? `Continuar en ${partLabel(nextPart, nextIndex)}`
        : "Empezar la serie";

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(series.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="series-sheet-title"
      inert={refreshing}
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cerrar"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-800 bg-zinc-900 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
              {complete ? "Completada" : "Tu serie"}
            </p>
            <h2 id="series-sheet-title" className="truncate text-lg font-bold">
              {series.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800/80 text-zinc-300 transition hover:text-white active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-950 shadow-lg shadow-black/40">
            {series.thumbnail && (
              <img
                src={series.thumbnail}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {watched}/{total} partes
            </span>

            <button
              type="button"
              onClick={() => onToggleFavorite(series.id)}
              aria-label={
                series.favorite ? "Quitar de favoritas" : "Añadir a favoritas"
              }
              aria-pressed={series.favorite}
              className={`absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full backdrop-blur transition active:scale-90 ${
                series.favorite
                  ? "bg-rose-500 text-white"
                  : "bg-black/50 text-white/80 hover:text-white"
              }`}
            >
              <Icon.Heart filled={series.favorite} className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlay(series, nextIndex)}
              disabled={total === 0}
              className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400 active:scale-[0.99] disabled:opacity-40"
            >
              <Icon.Play className="size-4" />
              {continueLabel}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${
                  complete ? "bg-emerald-400" : "bg-rose-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-zinc-500">
              {progress}%
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <Icon.Youtube className="size-4 shrink-0" />
            <span className="truncate">{series.channelTitle}</span>
            {channelUrl && (
              <a
                href={channelUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-zinc-400 transition hover:text-white"
              >
                Ver canal
                <Icon.ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Estado
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {statusOrder.map((option) => {
                const active = option === status;
                const locked = hasProgress && !active;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onSetStatus(series.id, option)}
                    disabled={locked}
                    aria-pressed={active}
                    className={`rounded-2xl border px-2 py-2 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? `border-transparent ${statusMeta[option].badge}`
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {statusMeta[option].label}
                  </button>
                );
              })}
            </div>
            {hasProgress && (
              <p className="mt-2 text-[11px] text-zinc-500">
                El estado se calcula automáticamente según tu progreso.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-lg font-bold text-zinc-100">{total}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Partes</p>
            </div>
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-lg font-bold text-zinc-100">{watched}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Vistas</p>
            </div>
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-lg font-bold text-zinc-100">
                {totalLabel ?? "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Duración</p>
            </div>
          </div>

          <SeriesTitleEditor
            key={series.id}
            series={series}
            onUpdateTitle={onUpdateTitle}
          />

          <SeriesAliasesEditor
            series={series}
            onUpdateAliases={onUpdateAliases}
          />

          <SeriesPartsList
            series={series}
            onPlay={onPlay}
            onSetWatched={onSetWatched}
            onMovePart={onMovePart}
            onAddParts={onAddParts}
          />

          <SeriesRefreshPanel
            series={series}
            semanticConfigured={semanticConfigured}
            onRefresh={onRefresh}
            onAddCandidate={onAddCandidate}
            onBusyChange={onBusyChange}
          />

          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => onAddParts(series)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
            >
              <Icon.Plus className="size-4" />
              Añadir más vídeos
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
                confirmingDelete
                  ? "border-rose-500 bg-rose-500 text-white hover:bg-rose-400"
                  : "border-zinc-800 text-zinc-400 hover:border-rose-500/40 hover:text-rose-300"
              }`}
            >
              <Icon.Trash className="size-4" />
              {confirmingDelete
                ? "Pulsa otra vez para borrar la serie"
                : "Borrar serie"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
