import { useEffect } from 'react'
import type { Drama, WatchStatus } from '../types'
import * as Icon from './Icons'

const statusOptions: { value: WatchStatus; label: string; icon: typeof Icon.Play }[] = [
  { value: 'watching', label: 'Viendo', icon: Icon.Play },
  { value: 'planned', label: 'Pendiente', icon: Icon.Clock },
  { value: 'completed', label: 'Visto', icon: Icon.Check },
]

interface DramaSheetProps {
  drama: Drama
  status?: WatchStatus
  isFavorite: boolean
  onClose: () => void
  onStatusChange: (status: WatchStatus) => void
  onClearStatus: () => void
  onToggleFavorite: () => void
}

export function DramaSheet({
  drama,
  status,
  isFavorite,
  onClose,
  onStatusChange,
  onClearStatus,
  onToggleFavorite,
}: DramaSheetProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drama-sheet-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar detalle"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[88dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-800 bg-zinc-900 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className={`relative h-44 bg-gradient-to-br ${drama.gradient}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/10 to-transparent" />
          <span className="absolute inset-0 grid place-items-center text-8xl font-black text-white/20">
            {drama.chineseTitle.slice(0, 1)}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>

          <div className="absolute inset-x-4 bottom-3">
            <p className="text-xs font-medium tracking-wide text-white/75">{drama.chineseTitle}</p>
            <h2
              id="drama-sheet-title"
              className="text-2xl font-bold text-white drop-shadow"
            >
              {drama.title}
            </h2>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span>{drama.year}</span>
            <span className="size-1 rounded-full bg-zinc-600" />
            <span>{drama.episodes} episodios</span>
            <span className="size-1 rounded-full bg-zinc-600" />
            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
              <Icon.Star className="size-3.5" />
              {drama.rating.toFixed(1)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {drama.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-zinc-700/70 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300"
              >
                {genre}
              </span>
            ))}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-zinc-300">{drama.synopsis}</p>

          <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-zinc-950/60 p-1.5 ring-1 ring-zinc-800">
            {statusOptions.map((option) => {
              const active = status === option.value
              const StatusIcon = option.icon

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStatusChange(option.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition active:scale-95 ${
                    active
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                      : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                  }`}
                >
                  <StatusIcon className="size-4" />
                  {option.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
              isFavorite
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-300'
                : 'border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:text-white'
            }`}
          >
            <Icon.Heart filled={isFavorite} className="size-4" />
            {isFavorite ? 'En favoritos' : 'Añadir a favoritos'}
          </button>

          {status && (
            <button
              type="button"
              onClick={onClearStatus}
              className="mt-3 w-full py-1 text-center text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Quitar de mi lista
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
