import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../../shared/lib/format'
import { partLabel } from '../../series/model/parts'
import { progressPercent, watchedCount } from '../../series/model/series'
import { fetchVideoMeta } from '../../discovery/model/youtubeApi'
import type { PartMetaPatch, Series } from '../../series/types'
import { useSheet } from '../../../shared/hooks/useSheet'
import * as Icon from '../../../shared/components/Icons'
import { YOUTUBE_WATCH_URL } from '../constants'
import { YouTubePlayer } from './YouTubePlayer'

interface PlayerSheetProps {
  series: Series
  startIndex: number
  apiKey: string
  onClose: () => void
  onSetWatched: (seriesId: string, videoId: string, watched: boolean) => void
  onUpdatePartMeta: (
    seriesId: string,
    videoId: string,
    patch: PartMetaPatch
  ) => void
  onFillDurations: (series: Series) => Promise<void>
}

export function PlayerSheet({
  series,
  startIndex,
  apiKey,
  onClose,
  onSetWatched,
  onUpdatePartMeta,
  onFillDurations
}: PlayerSheetProps) {
  const [index, setIndex] = useState(startIndex)
  const [playerError, setPlayerError] = useState(false)
  const [description, setDescription] = useState('')
  const [descriptionLoading, setDescriptionLoading] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionCanExpand, setDescriptionCanExpand] = useState(false)
  const [fetchedDuration, setFetchedDuration] = useState<{
    videoId: string
    seconds: number
  } | null>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useSheet(onClose)

  // Completa las duraciones que falten para mostrarlas también en la lista de
  // partes de la serie.
  useEffect(() => {
    void onFillDurations(series)
    // Solo al abrir el reproductor; el callback cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id])

  const total = series.parts.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const part = series.parts[safeIndex]

  useEffect(() => {
    if (!part) return

    let cancelled = false
    setDescriptionExpanded(false)
    setDescriptionCanExpand(false)

    const needsDescription = !part.description
    const needsDuration = part.durationSeconds == null

    if (!needsDescription && !needsDuration) {
      setDescription(part.description ?? '')
      setDescriptionLoading(false)
      return
    }

    if (!apiKey) {
      setDescription(part.description ?? '')
      setDescriptionLoading(false)
      return
    }

    setDescription(part.description ?? '')
    setDescriptionLoading(needsDescription)

    fetchVideoMeta(part.videoId, apiKey)
      .then((meta) => {
        if (cancelled) return

        const text = meta.description?.trim()
        if (text && !part.description) setDescription(text)
        if (meta.durationSeconds) {
          setFetchedDuration({
            videoId: part.videoId,
            seconds: meta.durationSeconds
          })
        }

        const patch: PartMetaPatch = {}
        if (text && !part.description) patch.description = text
        if (meta.durationSeconds && part.durationSeconds == null) {
          patch.durationSeconds = meta.durationSeconds
        }
        if (Object.keys(patch).length > 0) {
          onUpdatePartMeta(series.id, part.videoId, patch)
        }
      })
      .catch(() => {
        // Sin metadatos disponibles: el reproductor sigue funcionando.
      })
      .finally(() => {
        if (!cancelled) setDescriptionLoading(false)
      })

    return () => {
      cancelled = true
    }
    // El callback cambia en cada render, pero solo depende de la serie y el vídeo.
    // La descripción y la duración no entran en las dependencias: al persistirlas
    // se actualiza la serie y no queremos reiniciar el estado de «Ver más».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.videoId, apiKey, series.id])

  useEffect(() => {
    if (descriptionExpanded || descriptionLoading) return

    const element = descriptionRef.current
    if (!element) return
    setDescriptionCanExpand(element.scrollHeight > element.clientHeight + 1)
  }, [description, descriptionLoading, descriptionExpanded])

  if (!part) return null

  const watched = series.watched.includes(part.videoId)
  const watchedTotal = watchedCount(series)
  const complete = total > 0 && watchedTotal >= total
  const duration = formatDuration(
    part.durationSeconds ??
      (fetchedDuration?.videoId === part.videoId
        ? fetchedDuration.seconds
        : undefined)
  )
  const hasPrevious = safeIndex > 0
  const hasNext = safeIndex < total - 1
  const watchUrl = `${YOUTUBE_WATCH_URL}${part.videoId}`

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= total) return
    setPlayerError(false)
    setIndex(nextIndex)
  }

  function handleEnded() {
    onSetWatched(series.id, part.videoId, true)
    if (hasNext) {
      setPlayerError(false)
      setIndex(safeIndex + 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`Reproductor de ${series.title}`}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-[calc(env(safe-area-inset-bottom)_+_1.25rem)]">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line-soft bg-canvas/95 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)_+_0.6rem)] backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reproductor"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-soft transition hover:text-ink-bright active:scale-90"
          >
            <Icon.ChevronLeft className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {series.title}
            </p>
            <p className="truncate text-[11px] text-ink-subtle">
              {partLabel(part, safeIndex)} · {series.channelTitle}
            </p>
          </div>

          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir en YouTube"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-muted transition hover:text-ink-bright active:scale-90"
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
            <div className="mb-3 flex items-start gap-2 rounded-2xl border border-warning/20 bg-warning/5 px-3 py-2.5 text-[11px] leading-relaxed text-warning-softer/85">
              <Icon.Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Este vídeo no se puede reproducir aquí (puede tener
                restricciones).{' '}
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
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-success/20 bg-success/5 px-3 py-2.5 text-[11px] font-medium text-success-softer/90">
              <Icon.Check className="size-4 shrink-0" />
              Has completado todas las partes de esta serie.
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-soft">
                {partLabel(part, safeIndex)}
                {duration && (
                  <span className="ml-1.5 text-ink-subtle">· {duration}</span>
                )}
              </p>
              <h2 className="mt-1 text-base font-semibold leading-snug text-ink">
                {part.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onSetWatched(series.id, part.videoId, !watched)}
              aria-pressed={watched}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold transition active:scale-95 ${
                watched
                  ? 'border-success/30 bg-success/10 text-success-soft'
                  : 'border-line bg-surface text-ink-muted hover:text-ink-strong'
              }`}
            >
              <Icon.Check className="size-3.5" />
              {watched ? 'Vista' : 'Marcar'}
            </button>
          </div>

          {(description || descriptionLoading) && (
            <div className="mt-3 rounded-2xl border border-line/80 bg-surface/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                Descripción
              </p>

              {descriptionLoading ? (
                <div className="mt-2 space-y-1.5" aria-hidden="true">
                  <div className="h-2.5 w-full animate-pulse rounded bg-surface-raised" />
                  <div className="h-2.5 w-11/12 animate-pulse rounded bg-surface-raised" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-surface-raised" />
                </div>
              ) : (
                <>
                  <p
                    ref={descriptionRef}
                    className={`mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ink-muted ${
                      descriptionExpanded ? '' : 'line-clamp-4'
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
                      className="mt-1.5 text-[11px] font-semibold text-brand-soft transition hover:text-brand-softer active:scale-95"
                    >
                      {descriptionExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className={`h-full rounded-full transition-all ${
                  complete ? 'bg-success' : 'bg-brand'
                }`}
                style={{ width: `${progressPercent(series)}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-ink-subtle">
              {watchedTotal}/{total}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              disabled={!hasPrevious}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-line px-3 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon.ChevronLeft className="size-4" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              disabled={!hasNext}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-line px-3 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Siguiente
              <Icon.ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                onSetWatched(series.id, part.videoId, true)
                if (hasNext) goTo(safeIndex + 1)
              }}
              disabled={!hasNext}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-bright shadow-lg shadow-brand/25 transition hover:bg-brand-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon.Check className="size-4" />
              {hasNext ? 'Vista y siguiente' : 'Última parte'}
            </button>
          </div>
        </div>

        <section className="px-4 pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Partes de la serie
            </h3>
            <span className="text-[11px] text-ink-faint">
              {watchedTotal} vistas
            </span>
          </div>

          <ul className="mt-2 space-y-1">
            {series.parts.map((item, itemIndex) => {
              const isWatched = series.watched.includes(item.videoId)
              const isCurrent = itemIndex === safeIndex
              const itemDuration = formatDuration(item.durationSeconds)

              return (
                <li key={item.videoId}>
                  <button
                    type="button"
                    onClick={() => goTo(itemIndex)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition active:scale-[0.995] ${
                      isCurrent
                        ? 'border-brand/40 bg-brand/10'
                        : 'border-transparent hover:bg-surface/70'
                    }`}
                  >
                    <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                          className="size-full object-cover"
                        />
                      )}
                      {isCurrent && (
                        <span className="absolute inset-0 grid place-items-center bg-overlay/55">
                          <Icon.Play className="size-5 text-ink-bright" />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-soft">
                        {partLabel(item, itemIndex)}
                        {itemDuration && (
                          <span className="font-normal text-ink-faint">
                            · {itemDuration}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-soft">
                        {item.title}
                      </span>
                    </span>

                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full ${
                        isWatched
                          ? 'bg-success/15 text-success-soft'
                          : 'bg-surface-raised/70 text-ink-faint'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon.Check className="size-3.5" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
