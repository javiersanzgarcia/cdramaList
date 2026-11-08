import { statusMeta } from '../lib/status'
import type { Drama, WatchStatus } from '../types'
import * as Icon from './Icons'

interface DramaCardProps {
  drama: Drama
  status?: WatchStatus
  isFavorite: boolean
  onOpen: (drama: Drama) => void
  onToggleFavorite: (id: string) => void
}

export function DramaCard({
  drama,
  status,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: DramaCardProps) {
  return (
    <article className="relative">
      <button
        type="button"
        onClick={() => onOpen(drama)}
        className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        <div
          className={`relative aspect-[2/3] overflow-hidden rounded-2xl bg-gradient-to-br ${drama.gradient} shadow-lg shadow-black/40`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.32),transparent_58%)]" />
          <span className="absolute inset-0 grid place-items-center text-6xl font-black text-white/25">
            {drama.chineseTitle.slice(0, 1)}
          </span>
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />

          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Icon.Star className="size-3 text-amber-300" />
            {drama.rating.toFixed(1)}
          </span>

          {status && (
            <span
              className={`absolute bottom-2.5 left-2.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${statusMeta[status].badge}`}
            >
              {statusMeta[status].label}
            </span>
          )}
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">{drama.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {drama.year} · {drama.episodes} eps
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(drama.id)}
        aria-label={
          isFavorite ? `Quitar ${drama.title} de favoritos` : `Añadir ${drama.title} a favoritos`
        }
        aria-pressed={isFavorite}
        className={`absolute left-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full backdrop-blur transition active:scale-90 ${
          isFavorite ? 'bg-rose-500 text-white' : 'bg-black/45 text-white/80 hover:text-white'
        }`}
      >
        <Icon.Heart filled={isFavorite} className="size-4" />
      </button>
    </article>
  )
}
