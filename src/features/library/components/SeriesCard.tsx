import {
  isSeriesComplete,
  progressPercent,
  progressLabel
} from '../../series/model/series'
import type { Series } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

const gradients = [
  'from-rose-500 via-red-500 to-orange-400',
  'from-indigo-500 via-purple-500 to-fuchsia-500',
  'from-amber-400 via-orange-500 to-rose-500',
  'from-sky-500 via-cyan-500 to-emerald-400',
  'from-violet-600 via-purple-600 to-indigo-500',
  'from-fuchsia-500 via-pink-500 to-rose-500'
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
        className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        <div
          className={`relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br ${gradientFor(series.id)} shadow-lg shadow-black/40`}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {complete ? 'Completada' : `${progressLabel(series)} partes`}
          </span>

          <div className="absolute inset-x-2.5 bottom-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <div
                className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-white/75">
              {complete
                ? `${total} ${total === 1 ? 'parte' : 'partes'}`
                : progress === 0
                  ? `${total} ${total === 1 ? 'parte' : 'partes'} por ver`
                  : `${progressLabel(series)} vistas`}
            </p>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
            {series.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
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
            ? 'bg-rose-500 text-white'
            : 'bg-black/45 text-white/80 hover:text-white'
        }`}
      >
        <Icon.Heart filled={series.favorite} className="size-4" />
      </button>
    </article>
  )
}
