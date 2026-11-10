import {
  isSeriesComplete,
  nextPartIndex,
  progressPercent,
  watchedCount,
} from "../../series/model/series";
import { partLabel } from "../../series/model/parts";
import type { Series } from "../../series/types";
import * as Icon from "../../../shared/components/Icons";

interface ContinueCardProps {
  series: Series;
  onPlay: (series: Series, index: number) => void;
  onOpen: (series: Series) => void;
}

export function ContinueCard({ series, onPlay, onOpen }: ContinueCardProps) {
  const nextIndex = nextPartIndex(series);
  const nextPart = series.parts[nextIndex];
  if (!nextPart) return null;

  const complete = isSeriesComplete(series);
  const watched = watchedCount(series);
  const label = complete
    ? "Volver a ver desde el principio"
    : watched === 0
      ? "Empezar"
      : partLabel(nextPart, nextIndex);

  return (
    <article className="w-64 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-900 shadow-lg shadow-black/40">
        <button
          type="button"
          onClick={() => onPlay(series, nextIndex)}
          className="absolute inset-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          {series.thumbnail && (
            <img
              src={series.thumbnail}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-rose-500/90 text-white shadow-lg shadow-rose-500/30 backdrop-blur transition active:scale-90">
              <Icon.Play className="size-5" />
            </span>
          </span>

          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {watched}/{series.parts.length}
          </span>

          <div className="absolute inset-x-2.5 bottom-2.5 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div
              className={`h-full rounded-full ${complete ? "bg-emerald-400" : "bg-rose-400"}`}
              style={{ width: `${progressPercent(series)}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpen(series)}
          aria-label={`Ver todas las partes de ${series.title}`}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur transition hover:text-white active:scale-90"
        >
          <Icon.Bookmark className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onPlay(series, nextIndex)}
        className="mt-2 block w-full text-left"
      >
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
          {series.title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-rose-400">{label}</p>
      </button>
    </article>
  );
}
