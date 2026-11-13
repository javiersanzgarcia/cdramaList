import {
  isSeriesComplete,
  nextPartIndex,
  progressPercent,
  watchedCount
} from '../../series/model/series'
import { partLabel } from '../../series/model/parts'
import type { Series } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

interface ContinueCardProps {
  series: Series
  onPlay: (series: Series, index: number) => void
  onOpen: (series: Series) => void
}

export function ContinueCard({ series, onPlay, onOpen }: ContinueCardProps) {
  const nextIndex = nextPartIndex(series)
  const nextPart = series.parts[nextIndex]
  if (!nextPart) return null

  const complete = isSeriesComplete(series)
  const watched = watchedCount(series)
  const label = complete
    ? 'Volver a ver desde el principio'
    : watched === 0
      ? 'Empezar'
      : partLabel(nextPart, nextIndex)

  return (
    <article className="w-64 shrink-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface shadow-lg shadow-overlay/40">
        <button
          type="button"
          onClick={() => onPlay(series, nextIndex)}
          className="absolute inset-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {series.thumbnail && (
            <img
              src={series.thumbnail}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-overlay/85 via-overlay/20 to-transparent" />

          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-brand/90 text-ink-bright shadow-lg shadow-brand/30 backdrop-blur transition active:scale-90">
              <Icon.Play className="size-5" />
            </span>
          </span>

          <span className="absolute left-2 top-2 rounded-full bg-overlay/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-bright backdrop-blur">
            {watched}/{series.parts.length}
          </span>

          <div className="absolute inset-x-2.5 bottom-2.5 h-1.5 overflow-hidden rounded-full bg-paper/25">
            <div
              className={`h-full rounded-full ${complete ? 'bg-success' : 'bg-brand-bright'}`}
              style={{ width: `${progressPercent(series)}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpen(series)}
          aria-label={`Ver todas las partes de ${series.title}`}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-overlay/50 text-ink-bright/80 backdrop-blur transition hover:text-ink-bright active:scale-90"
        >
          <Icon.Bookmark className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onPlay(series, nextIndex)}
        className="mt-2 block w-full text-left"
      >
        <h3 className="line-clamp-1 text-sm font-semibold text-ink">
          {series.title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-brand-bright">{label}</p>
      </button>
    </article>
  )
}
