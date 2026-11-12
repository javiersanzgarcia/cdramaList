import { useState } from 'react'
import { formatDuration } from '../../../shared/lib/format'
import { partLabel } from '../model/parts'
import type { Series } from '../types'
import * as Icon from '../../../shared/components/Icons'

interface SeriesPartsListProps {
  series: Series
  onPlay: (series: Series, index: number) => void
  onSetWatched: (seriesId: string, videoId: string, watched: boolean) => void
  onMovePart: (seriesId: string, fromIndex: number, toIndex: number) => void
  onRemovePart: (seriesId: string, videoId: string) => void
  onAddParts: (series: Series) => void
}

export function SeriesPartsList({
  series,
  onPlay,
  onSetWatched,
  onMovePart,
  onRemovePart,
  onAddParts
}: SeriesPartsListProps) {
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null)
  const total = series.parts.length
  const pendingIndex = series.parts.findIndex(
    (part) => part.videoId === pendingVideoId
  )
  const pendingPart = pendingIndex >= 0 ? series.parts[pendingIndex] : undefined

  // Quitar una parte es irreversible: la primera pulsación arma el botón y la
  // segunda la elimina de la serie.
  function handleRemove(videoId: string) {
    if (pendingVideoId !== videoId) {
      setPendingVideoId(videoId)
      return
    }

    setPendingVideoId(null)
    onRemovePart(series.id, videoId)
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Partes
        </h3>
        <button
          type="button"
          onClick={() => onAddParts(series)}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-zinc-700 hover:text-white active:scale-95"
        >
          <Icon.Plus className="size-3.5" />
          Añadir partes
        </button>
      </div>

      {total > 0 ? (
        <>
          <ul className="mt-2 space-y-1">
            {series.parts.map((part, index) => {
              const isWatched = series.watched.includes(part.videoId)
              const duration = formatDuration(part.durationSeconds)

              return (
                <li
                  key={part.videoId}
                  className="flex items-center gap-1.5 rounded-2xl border border-transparent transition hover:bg-zinc-950/50"
                >
                  <button
                    type="button"
                    onClick={() => onPlay(series, index)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-950">
                      {part.thumbnail && (
                        <img
                          src={part.thumbnail}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                          className="size-full object-cover"
                        />
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition hover:opacity-100">
                        <Icon.Play className="size-5 text-white" />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                        {partLabel(part, index)}
                        {duration && (
                          <span className="font-normal text-zinc-600">
                            · {duration}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-zinc-300">
                        {part.title}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => onMovePart(series.id, index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Mover ${partLabel(part, index)} hacia arriba`}
                      title="Mover hacia arriba"
                      className="grid size-7 place-items-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      <Icon.ChevronRight className="size-3.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMovePart(series.id, index, index + 1)}
                      disabled={index === total - 1}
                      aria-label={`Mover ${partLabel(part, index)} hacia abajo`}
                      title="Mover hacia abajo"
                      className="grid size-7 place-items-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      <Icon.ChevronRight className="size-3.5 rotate-90" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSetWatched(series.id, part.videoId, !isWatched)
                    }
                    aria-pressed={isWatched}
                    aria-label={
                      isWatched
                        ? `Marcar ${partLabel(part, index)} como no vista`
                        : `Marcar ${partLabel(part, index)} como vista`
                    }
                    className={`grid size-8 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
                      isWatched
                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon.Check className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(part.videoId)}
                    aria-label={`Quitar ${partLabel(part, index)} de la serie`}
                    title={
                      pendingVideoId === part.videoId
                        ? 'Pulsa otra vez para quitarla de la serie'
                        : 'Quitar de la serie'
                    }
                    className={`mr-1.5 grid size-7 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
                      pendingVideoId === part.videoId
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-rose-500/40 hover:text-rose-300'
                    }`}
                  >
                    <Icon.Trash className="size-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
          {pendingPart && (
            <p className="mt-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
              Pulsa otra vez la papelera para quitar{' '}
              {partLabel(pendingPart, pendingIndex)} de la serie.
            </p>
          )}
        </>
      ) : (
        <div className="mt-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-zinc-300">
            Esta serie no tiene partes
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Añade un vídeo o una lista de reproducción para empezar.
          </p>
        </div>
      )}
    </>
  )
}
