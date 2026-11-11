import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../../../shared/lib/format";
import { partLabel } from "../../series/model/parts";
import { progressPercent, watchedCount } from "../../series/model/series";
import { fetchVideoMeta } from "../../discovery/model/youtubeApi";
import type { Series } from "../../series/types";
import { useSheet } from "../../../shared/hooks/useSheet";
import * as Icon from "../../../shared/components/Icons";
import { YouTubePlayer } from "./YouTubePlayer";

interface PlayerSheetProps {
  series: Series;
  startIndex: number;
  apiKey: string;
  onClose: () => void;
  onSetWatched: (seriesId: string, videoId: string, watched: boolean) => void;
  onUpdatePartMeta: (
    seriesId: string,
    videoId: string,
    patch: { description?: string; durationSeconds?: number },
  ) => void;
  onFillDurations: (series: Series) => Promise<void>;
}

export function PlayerSheet({
  series,
  startIndex,
  apiKey,
  onClose,
  onSetWatched,
  onUpdatePartMeta,
  onFillDurations,
}: PlayerSheetProps) {
  const [index, setIndex] = useState(startIndex);
  const [playerError, setPlayerError] = useState(false);
  const [description, setDescription] = useState("");
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionCanExpand, setDescriptionCanExpand] = useState(false);
  const [fetchedDuration, setFetchedDuration] = useState<{
    videoId: string;
    seconds: number;
  } | null>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  useSheet(onClose);

  // Completa las duraciones que falten para mostrarlas también en la lista de
  // partes de la serie.
  useEffect(() => {
    void onFillDurations(series);
    // Solo al abrir el reproductor; el callback cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id]);

  const total = series.parts.length;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const part = series.parts[safeIndex];

  useEffect(() => {
    if (!part) return;

    let cancelled = false;
    setDescriptionExpanded(false);
    setDescriptionCanExpand(false);

    const needsDescription = !part.description;
    const needsDuration = part.durationSeconds == null;

    if (!needsDescription && !needsDuration) {
      setDescription(part.description ?? "");
      setDescriptionLoading(false);
      return;
    }

    if (!apiKey) {
      setDescription(part.description ?? "");
      setDescriptionLoading(false);
      return;
    }

    setDescription(part.description ?? "");
    setDescriptionLoading(needsDescription);

    fetchVideoMeta(part.videoId, apiKey)
      .then((meta) => {
        if (cancelled) return;

        const text = meta.description?.trim();
        if (text && !part.description) setDescription(text);
        if (meta.durationSeconds) {
          setFetchedDuration({
            videoId: part.videoId,
            seconds: meta.durationSeconds,
          });
        }

        const patch: { description?: string; durationSeconds?: number } = {};
        if (text && !part.description) patch.description = text;
        if (meta.durationSeconds && part.durationSeconds == null) {
          patch.durationSeconds = meta.durationSeconds;
        }
        if (Object.keys(patch).length > 0) {
          onUpdatePartMeta(series.id, part.videoId, patch);
        }
      })
      .catch(() => {
        // Sin metadatos disponibles: el reproductor sigue funcionando.
      })
      .finally(() => {
        if (!cancelled) setDescriptionLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // El callback cambia en cada render, pero solo depende de la serie y el vídeo.
    // La descripción y la duración no entran en las dependencias: al persistirlas
    // se actualiza la serie y no queremos reiniciar el estado de «Ver más».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.videoId, apiKey, series.id]);

  useEffect(() => {
    if (descriptionExpanded || descriptionLoading) return;

    const element = descriptionRef.current;
    if (!element) return;
    setDescriptionCanExpand(element.scrollHeight > element.clientHeight + 1);
  }, [description, descriptionLoading, descriptionExpanded]);

  if (!part) return null;

  const watched = series.watched.includes(part.videoId);
  const watchedTotal = watchedCount(series);
  const complete = total > 0 && watchedTotal >= total;
  const duration = formatDuration(
    part.durationSeconds ??
      (fetchedDuration?.videoId === part.videoId
        ? fetchedDuration.seconds
        : undefined),
  );
  const hasPrevious = safeIndex > 0;
  const hasNext = safeIndex < total - 1;
  const watchUrl = `https://www.youtube.com/watch?v=${part.videoId}`;

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= total) return;
    setPlayerError(false);
    setIndex(nextIndex);
  }

  function handleEnded() {
    onSetWatched(series.id, part.videoId, true);
    if (hasNext) {
      setPlayerError(false);
      setIndex(safeIndex + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Reproductor de ${series.title}`}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-[calc(env(safe-area-inset-bottom)_+_1.25rem)]">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-900 bg-zinc-950/95 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)_+_0.6rem)] backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reproductor"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-300 transition hover:text-white active:scale-90"
          >
            <Icon.ChevronLeft className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {series.title}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {partLabel(part, safeIndex)} · {series.channelTitle}
            </p>
          </div>

          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir en YouTube"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-400 transition hover:text-white active:scale-90"
          >
            <Icon.ExternalLink className="size-4" />
          </a>
        </header>

        <YouTubePlayer
          videoId={part.videoId}
          onEnded={handleEnded}
          onError={() => setPlayerError(true)}
        />

        <div className="px-4 pt-3">
          {playerError && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/85">
              <Icon.Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Este vídeo no se puede reproducir aquí (puede tener
                restricciones).{" "}
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  Ábrelo en YouTube
                </a>
                .
              </span>
            </div>
          )}

          {complete && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5 text-[11px] font-medium text-emerald-200/90">
              <Icon.Check className="size-4 shrink-0" />
              Has completado todas las partes de esta serie.
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-300">
                {partLabel(part, safeIndex)}
                {duration && (
                  <span className="ml-1.5 text-zinc-500">· {duration}</span>
                )}
              </p>
              <h2 className="mt-1 text-base font-semibold leading-snug text-zinc-100">
                {part.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onSetWatched(series.id, part.videoId, !watched)}
              aria-pressed={watched}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold transition active:scale-95 ${
                watched
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon.Check className="size-3.5" />
              {watched ? "Vista" : "Marcar"}
            </button>
          </div>

          {(description || descriptionLoading) && (
            <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Descripción
              </p>

              {descriptionLoading ? (
                <div className="mt-2 space-y-1.5" aria-hidden="true">
                  <div className="h-2.5 w-full animate-pulse rounded bg-zinc-800" />
                  <div className="h-2.5 w-11/12 animate-pulse rounded bg-zinc-800" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-zinc-800" />
                </div>
              ) : (
                <>
                  <p
                    ref={descriptionRef}
                    className={`mt-1.5 whitespace-pre-line text-xs leading-relaxed text-zinc-400 ${
                      descriptionExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {description}
                  </p>
                  {descriptionCanExpand && (
                    <button
                      type="button"
                      onClick={() =>
                        setDescriptionExpanded((current) => !current)
                      }
                      aria-expanded={descriptionExpanded}
                      className="mt-1.5 text-[11px] font-semibold text-rose-300 transition hover:text-rose-200 active:scale-95"
                    >
                      {descriptionExpanded ? "Ver menos" : "Ver más"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${
                  complete ? "bg-emerald-400" : "bg-rose-500"
                }`}
                style={{ width: `${progressPercent(series)}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-zinc-500">
              {watchedTotal}/{total}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              disabled={!hasPrevious}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon.ChevronLeft className="size-4" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              disabled={!hasNext}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Siguiente
              <Icon.ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                onSetWatched(series.id, part.videoId, true);
                if (hasNext) goTo(safeIndex + 1);
              }}
              disabled={!hasNext}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon.Check className="size-4" />
              {hasNext ? "Vista y siguiente" : "Última parte"}
            </button>
          </div>
        </div>

        <section className="px-4 pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Partes de la serie
            </h3>
            <span className="text-[11px] text-zinc-600">
              {watchedTotal} vistas
            </span>
          </div>

          <ul className="mt-2 space-y-1">
            {series.parts.map((item, itemIndex) => {
              const isWatched = series.watched.includes(item.videoId);
              const isCurrent = itemIndex === safeIndex;
              const itemDuration = formatDuration(item.durationSeconds);

              return (
                <li key={item.videoId}>
                  <button
                    type="button"
                    onClick={() => goTo(itemIndex)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition active:scale-[0.995] ${
                      isCurrent
                        ? "border-rose-500/40 bg-rose-500/10"
                        : "border-transparent hover:bg-zinc-900/70"
                    }`}
                  >
                    <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                          className="size-full object-cover"
                        />
                      )}
                      {isCurrent && (
                        <span className="absolute inset-0 grid place-items-center bg-black/55">
                          <Icon.Play className="size-5 text-white" />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                        {partLabel(item, itemIndex)}
                        {itemDuration && (
                          <span className="font-normal text-zinc-600">
                            · {itemDuration}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-zinc-300">
                        {item.title}
                      </span>
                    </span>

                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full ${
                        isWatched
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-zinc-800/70 text-zinc-600"
                      }`}
                      aria-hidden="true"
                    >
                      <Icon.Check className="size-3.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
