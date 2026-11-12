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
import {
  channelUrlFor,
  youtubeThumbnail,
} from "../../discovery/model/youtube";
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
  onSetThumbnail: (id: string, thumbnail: string) => void;
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
  onDiscardCandidate: (series: Series, videoId: string) => void;
  onUpdateAliases: (seriesId: string, aliases: string[]) => void;
  onUpdateTitle: (seriesId: string, title: string) => void;
  onFillDurations: (series: Series) => Promise<void>;
  onDelete: (id: string) => void;
  /** Series con novedades que quedan por revisar después de esta. */
  reviewRemaining: number;
  onReviewNext: () => void;
  /** Candidatos ya encontrados para esta serie (lote de favoritas). */
  initialCandidates: ChapterCandidate[];
}

export function SeriesSheet({
  series,
  semanticConfigured,
  refreshing,
  onBusyChange,
  onClose,
  onPlay,
  onToggleFavorite,
  onSetThumbnail,
  onSetStatus,
  onSetWatched,
  onMovePart,
  onAddParts,
  onRefresh,
  onAddCandidate,
  onDiscardCandidate,
  onUpdateAliases,
  onUpdateTitle,
  onFillDurations,
  onDelete,
  reviewRemaining,
  onReviewNext,
  initialCandidates,
}: SeriesSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
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

  // Al crear la serie la portada es la de la parte 1; desde aquí se puede
  // cambiar por la de cualquier otra parte.
  const coverOptions = series.parts.map((part, index) => ({
    videoId: part.videoId,
    label: partLabel(part, index),
    thumbnail: part.thumbnail ?? youtubeThumbnail(part.videoId),
  }));

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
          {reviewRemaining > 0 && (
            <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="flex items-start gap-2">
                <Icon.Sparkles className="mt-0.5 size-4 shrink-0 text-rose-300" />
                <p className="text-[11px] leading-relaxed text-rose-100">
                  Esta serie tiene novedades y{" "}
                  {reviewRemaining === 1
                    ? "queda 1 serie"
                    : `quedan ${reviewRemaining} series`}{" "}
                  por revisar.
                </p>
              </div>
              <button
                type="button"
                onClick={onReviewNext}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 active:scale-[0.99]"
              >
                Revisar siguiente serie
                <Icon.ChevronRight className="size-4" />
              </button>
            </div>
          )}

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

            {coverOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setCoverPickerOpen((open) => !open)}
                aria-expanded={coverPickerOpen}
                className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur transition hover:bg-black/75 active:scale-95"
              >
                <Icon.Photo className="size-3.5" />
                Cambiar portada
              </button>
            )}
          </div>

          {coverPickerOpen && (
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-2">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Elige la portada
              </p>
              <ul className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                {coverOptions.map((option) => {
                  const active = option.thumbnail === series.thumbnail;

                  return (
                    <li key={option.videoId}>
                      <button
                        type="button"
                        onClick={() => {
                          onSetThumbnail(series.id, option.thumbnail);
                          setCoverPickerOpen(false);
                        }}
                        aria-pressed={active}
                        aria-label={`Usar la portada de ${option.label}`}
                        className={`block w-full overflow-hidden rounded-xl border transition active:scale-[0.98] ${
                          active
                            ? "border-rose-500"
                            : "border-transparent hover:border-zinc-600"
                        }`}
                      >
                        <span className="relative block aspect-video bg-zinc-900">
                          <img
                            src={option.thumbnail}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                            className="size-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                            {option.label}
                          </span>
                          {active && (
                            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-white">
                              <Icon.Check className="size-3" />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => onPlay(series, nextIndex)}
            disabled={total === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400 active:scale-[0.99] disabled:opacity-40"
          >
            <Icon.Play className="size-4" />
            {continueLabel}
          </button>

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

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onSetStatus(series.id, option)}
                    aria-pressed={active}
                    className={`rounded-2xl border px-2 py-2 text-xs font-semibold transition active:scale-[0.98] ${
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
            key={series.id}
            series={series}
            semanticConfigured={semanticConfigured}
            initialCandidates={initialCandidates}
            onRefresh={onRefresh}
            onAddCandidate={onAddCandidate}
            onDiscardCandidate={onDiscardCandidate}
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
