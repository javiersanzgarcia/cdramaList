import {
  isSeriesComplete,
  progressPercent,
  progressLabel
} from '../../series/model/series'
import type { Series } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

const gradients = [
  'from-cover-rose via-cover-red to-cover-orange',
  'from-cover-indigo via-cover-purple to-cover-fuchsia',
  'from-cover-amber via-cover-orange-strong to-cover-rose',
  'from-cover-sky via-cover-cyan to-cover-emerald',
  'from-cover-violet via-cover-purple-deep to-cover-indigo',
  'from-cover-fuchsia via-cover-pink to-cover-rose'
]

function gradientFor(id: string) {
  let hash = 0
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return gradients[Math.abs(hash) % gradients.length]
}

interface SeriesCardProps {
  series: Series
  onOpen: (series: Series) => void
  onToggleFavorite: (id: string) => void
}

export function SeriesCard({
  series,
  onOpen,
  onToggleFavorite
}: SeriesCardProps) {
  const complete = isSeriesComplete(series)
  const progress = progressPercent(series)
  const total = series.parts.length

  return (
    <article className="relative">
      <button
        type="button"
        onClick={() => onOpen(series)}
        className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div
          className={`relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br ${gradientFor(series.id)} shadow-lg shadow-overlay/40`}
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
          <div className="absolute inset-0 bg-gradient-to-t from-overlay/85 via-overlay/10 to-transparent" />

          <span className="absolute left-2 top-2 rounded-full bg-overlay/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-bright backdrop-blur">
            {complete ? 'Completada' : `${progressLabel(series)} partes`}
          </span>

          <div className="absolute inset-x-2.5 bottom-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-paper/25">
              <div
                className={`h-full rounded-full transition-all ${complete ? 'bg-success' : 'bg-brand-bright'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-ink-bright/75">
              {complete
                ? `${total} ${total === 1 ? 'parte' : 'partes'}`
                : progress === 0
                  ? `${total} ${total === 1 ? 'parte' : 'partes'} por ver`
                  : `${progressLabel(series)} vistas`}
            </p>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
            {series.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-subtle">
            {series.channelTitle}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(series.id)}
        aria-label={
          series.favorite
            ? `Quitar ${series.title} de favoritas`
            : `Añadir ${series.title} a favoritas`
        }
        aria-pressed={series.favorite}
        className={`absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full backdrop-blur transition active:scale-90 ${
          series.favorite
            ? 'bg-brand text-ink-bright'
            : 'bg-overlay/45 text-ink-bright/80 hover:text-ink-bright'
        }`}
      >
        <Icon.Heart filled={series.favorite} className="size-4" />
      </button>
    </article>
  )
}
