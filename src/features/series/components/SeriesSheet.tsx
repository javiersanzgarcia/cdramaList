import { useEffect, useState } from 'react'
import { formatDuration } from '../../../shared/lib/format'
import { partLabel } from '../model/parts'
import {
  isSeriesComplete,
  nextPartIndex,
  progressPercent,
  seriesStatus,
  watchedCount
} from '../model/series'
import { statusMeta, statusOrder } from '../model/status'
import { channelUrlFor, youtubeThumbnail } from '../../discovery/model/youtube'
import type { ChapterCandidate, SeriesRefreshResult } from '../../discovery/types'
import type { Series, SeriesStatus } from '../types'
import { useSheet } from '../../../shared/hooks/useSheet'
import { SeriesAliasesEditor } from './SeriesAliasesEditor'
import { SeriesPartsList } from './SeriesPartsList'
import { SeriesRefreshPanel } from './SeriesRefreshPanel'
import { SeriesTitleEditor } from './SeriesTitleEditor'
import * as Icon from '../../../shared/components/Icons'

interface SeriesSheetProps {
  series: Series
  semanticConfigured: boolean
  refreshing: boolean
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onPlay: (series: Series, index: number) => void
  onToggleFavorite: (id: string) => void
  onSetThumbnail: (id: string, thumbnail: string) => void
  onSetStatus: (id: string, status: SeriesStatus) => void
  onSetWatched: (seriesId: string, videoId: string, watched: boolean) => void
  onMovePart: (seriesId: string, fromIndex: number, toIndex: number) => void
  onRemovePart: (seriesId: string, videoId: string) => void
  onAddParts: (series: Series) => void
  onRefresh: (series: Series) => Promise<SeriesRefreshResult>
  onAddCandidate: (
    series: Series,
    candidate: ChapterCandidate,
    options: { partNumber?: number; isFinal?: boolean }
  ) => Promise<{ synced: boolean }>
  onDiscardCandidate: (series: Series, videoId: string) => void
  onUpdateAliases: (seriesId: string, aliases: string[]) => void
  onUpdateTitle: (seriesId: string, title: string) => void
  onFillDurations: (series: Series) => Promise<void>
  onDelete: (id: string) => void
  /** Series con novedades que quedan por revisar después de esta. */
  reviewRemaining: number
  onReviewNext: () => void
  /** Candidatos ya encontrados para esta serie (lote de favoritas). */
  initialCandidates: ChapterCandidate[]
  /** Avisa de que la serie ya no tiene novedades pendientes de revisar. */
  onNewsHandled: (seriesId: string) => void
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
  onRemovePart,
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
  onNewsHandled
}: SeriesSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<SeriesStatus | null>(null)
  const handleClose = () => {
    if (!refreshing) onClose()
  }
  useSheet(handleClose)

  // Rellena las duraciones que falten (series antiguas o creadas sin cuota)
  // para poder mostrar la duración de cada parte y el total de la serie.
  useEffect(() => {
    void onFillDurations(series)
    // Solo al abrir la serie; el callback cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id])

  const total = series.parts.length
  const watched = watchedCount(series)
  const complete = isSeriesComplete(series)
  const status = seriesStatus(series)
  const nextIndex = nextPartIndex(series)
  const nextPart = series.parts[nextIndex]
  const progress = progressPercent(series)
  const channelUrl =
    series.channelUrl ?? (series.channelId ? channelUrlFor(series.channelId) : undefined)

  // Solo se conocen las duraciones que ha devuelto YouTube: si falta alguna,
  // el total es parcial y se indica con un «+» para no engañar.
  const totalDuration = series.parts.reduce(
    (sum, part) => sum + (part.durationSeconds ?? 0),
    0
  )
  const missingDurations = series.parts.filter((part) => part.durationSeconds == null).length
  const totalLabel = formatDuration(totalDuration)
  const durationLabel = totalLabel
    ? `${totalLabel}${missingDurations > 0 ? '+' : ''}`
    : undefined
  const durationCaption =
    missingDurations === 0
      ? 'Duración'
      : missingDurations === series.parts.length
        ? 'Sin datos'
        : 'Duración parcial'

  // Al crear la serie la portada es la de la parte 1; desde aquí se puede
  // cambiar por la de cualquier otra parte.
  const coverOptions = series.parts.map((part, index) => ({
    videoId: part.videoId,
    label: partLabel(part, index),
    thumbnail: part.thumbnail ?? youtubeThumbnail(part.videoId)
  }))

  const continueLabel = complete
    ? 'Volver a ver desde el principio'
    : watched === 0
      ? 'Empezar la serie'
      : nextPart
        ? `Continuar en ${partLabel(nextPart, nextIndex)}`
        : 'Empezar la serie'

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    onDelete(series.id)
  }

  // Bajar de «Completada» reinicia el progreso: se pide confirmación para que no
  // se pierda por un toque accidental. La segunda pulsación sí lo aplica.
  function handleSetStatus(option: SeriesStatus) {
    if (option !== 'completed' && complete && pendingStatus !== option) {
      setPendingStatus(option)
      return
    }

    setPendingStatus(null)
    onSetStatus(series.id, option)
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
        className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line/80 bg-surface/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-bright">
              {complete ? 'Completada' : 'Tu serie'}
            </p>
            <h2 id="series-sheet-title" className="truncate text-lg font-bold">
              {series.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised/80 text-ink-soft transition hover:text-ink-bright active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          {reviewRemaining > 0 && (
            <div className="mb-3 rounded-2xl border border-brand/30 bg-brand/10 p-3">
              <div className="flex items-start gap-2">
                <Icon.Sparkles className="mt-0.5 size-4 shrink-0 text-brand-soft" />
                <p className="text-[11px] leading-relaxed text-brand-softest">
                  Esta serie tiene novedades y{' '}
                  {reviewRemaining === 1
                    ? 'queda 1 serie'
                    : `quedan ${reviewRemaining} series`}{' '}
                  por revisar.
                </p>
              </div>
              <button
                type="button"
                onClick={onReviewNext}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink-bright transition hover:bg-brand-bright active:scale-[0.99]"
              >
                Revisar siguiente serie
                <Icon.ChevronRight className="size-4" />
              </button>
            </div>
          )}

          <div className="relative aspect-video overflow-hidden rounded-2xl bg-canvas shadow-lg shadow-overlay/40">
            {series.thumbnail && (
              <img
                src={series.thumbnail}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <span className="absolute left-2.5 top-2.5 rounded-full bg-overlay/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-bright backdrop-blur">
              {watched}/{total} partes
            </span>

            <button
              type="button"
              onClick={() => onToggleFavorite(series.id)}
              aria-label={series.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}
              aria-pressed={series.favorite}
              className={`absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full backdrop-blur transition active:scale-90 ${
                series.favorite
                  ? 'bg-brand text-ink-bright'
                  : 'bg-overlay/50 text-ink-bright/80 hover:text-ink-bright'
              }`}
            >
              <Icon.Heart filled={series.favorite} className="size-4" />
            </button>
          </div>

          {coverOptions.length > 0 && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCoverPickerOpen((open) => !open)}
                aria-expanded={coverPickerOpen}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas/60 px-3 py-1.5 text-[11px] font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink-bright active:scale-95"
              >
                <Icon.Photo className="size-3.5" />
                {coverPickerOpen ? 'Ocultar portadas' : 'Cambiar portada'}
              </button>
            </div>
          )}

          {coverPickerOpen && (
            <div className="mt-3 rounded-2xl border border-line bg-canvas/60 p-2">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Elige la portada
              </p>
              <ul className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                {coverOptions.map((option) => {
                  const active = option.thumbnail === series.thumbnail

                  return (
                    <li key={option.videoId}>
                      <button
                        type="button"
                        onClick={() => {
                          onSetThumbnail(series.id, option.thumbnail)
                          setCoverPickerOpen(false)
                        }}
                        aria-pressed={active}
                        aria-label={`Usar la portada de ${option.label}`}
                        className={`block w-full overflow-hidden rounded-xl border transition active:scale-[0.98] ${
                          active
                            ? 'border-brand'
                            : 'border-transparent hover:border-line-contrast'
                        }`}
                      >
                        <span className="relative block aspect-video bg-surface">
                          <img
                            src={option.thumbnail}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                            className="size-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-overlay/65 px-1.5 py-0.5 text-center text-[10px] font-semibold text-ink-bright">
                            {option.label}
                          </span>
                          {active && (
                            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-brand text-ink-bright">
                              <Icon.Check className="size-3" />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => onPlay(series, nextIndex)}
            disabled={total === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-bright shadow-lg shadow-brand/30 transition hover:bg-brand-bright active:scale-[0.99] disabled:opacity-40"
          >
            <Icon.Play className="size-4" />
            {continueLabel}
          </button>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className={`h-full rounded-full transition-all ${complete ? 'bg-success' : 'bg-brand'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-ink-subtle">
              {progress}%
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
            <Icon.Youtube className="size-4 shrink-0" />
            <span className="truncate">{series.channelTitle}</span>
            {channelUrl && (
              <a
                href={channelUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-ink-muted transition hover:text-ink-bright"
              >
                Ver canal
                <Icon.ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              Estado
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {statusOrder.map((option) => {
                const active = option === status
                const pending = option === pendingStatus

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSetStatus(option)}
                    aria-pressed={active}
                    className={`rounded-2xl border px-2 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                      pending
                        ? 'border-warning/60 bg-warning/10 text-warning-softest'
                        : active
                          ? `border-transparent ${statusMeta[option].badge}`
                          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-bright'
                    }`}
                  >
                    {statusMeta[option].label}
                  </button>
                )
              })}
            </div>
            {pendingStatus && complete && (
              <p className="mt-2 rounded-2xl border border-warning/20 bg-warning/5 px-3 py-2 text-[11px] leading-relaxed text-warning-softer/80">
                Marcar como «{statusMeta[pendingStatus].label}» borra el progreso de las{' '}
                {total} partes vistas. Pulsa otra vez para confirmar.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
              <p className="text-lg font-bold text-ink">{total}</p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">Partes</p>
            </div>
            <div className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
              <p className="text-lg font-bold text-ink">{watched}</p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">Vistas</p>
            </div>
            <div className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
              <p className="text-lg font-bold text-ink">{durationLabel ?? '—'}</p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">{durationCaption}</p>
            </div>
          </div>

          <SeriesTitleEditor
            key={`title-${series.id}`}
            series={series}
            onUpdateTitle={onUpdateTitle}
          />

          <SeriesAliasesEditor
            key={`aliases-${series.id}`}
            series={series}
            onUpdateAliases={onUpdateAliases}
          />

          <SeriesPartsList
            series={series}
            onPlay={onPlay}
            onSetWatched={onSetWatched}
            onMovePart={onMovePart}
            onRemovePart={onRemovePart}
            onAddParts={onAddParts}
          />

          <SeriesRefreshPanel
            key={`refresh-${series.id}`}
            series={series}
            semanticConfigured={semanticConfigured}
            initialCandidates={initialCandidates}
            onRefresh={onRefresh}
            onAddCandidate={onAddCandidate}
            onDiscardCandidate={onDiscardCandidate}
            onBusyChange={onBusyChange}
            onNewsHandled={onNewsHandled}
          />

          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => onAddParts(series)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99]"
            >
              <Icon.Plus className="size-4" />
              Añadir partes a esta serie
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
                confirmingDelete
                  ? 'border-brand bg-brand text-ink-bright hover:bg-brand-bright'
                  : 'border-line text-ink-muted hover:border-brand/40 hover:text-brand-soft'
              }`}
            >
              <Icon.Trash className="size-4" />
              {confirmingDelete ? 'Pulsa otra vez para borrar la serie' : 'Borrar serie'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
