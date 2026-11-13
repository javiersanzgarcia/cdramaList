import { formatDuration } from '../../../shared/lib/format'
import type { ChapterCandidate } from '../../discovery/types'
import * as Icon from '../../../shared/components/Icons'

interface CandidateCardProps {
  candidate: ChapterCandidate
  number: string
  isFinal: boolean
  adding: boolean
  busy: boolean
  onNumberChange: (value: string) => void
  onToggleFinal: () => void
  onAdd: () => void
  onDiscard: () => void
}

export function CandidateCard({
  candidate,
  number,
  isFinal,
  adding,
  busy,
  onNumberChange,
  onToggleFinal,
  onAdd,
  onDiscard
}: CandidateCardProps) {
  const duration = formatDuration(candidate.durationSeconds)

  return (
    <li className="rounded-2xl border border-line bg-canvas/60 p-2">
      <div className="flex gap-2">
        <a
          href={`https://www.youtube.com/watch?v=${candidate.videoId}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${candidate.title} en YouTube`}
          className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-surface"
        >
          {candidate.thumbnail && (
            <img
              src={candidate.thumbnail}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
              className="size-full object-cover"
            />
          )}
          <span className="absolute inset-0 grid place-items-center bg-overlay/25 opacity-0 transition hover:opacity-100">
            <Icon.ExternalLink className="size-4 text-ink-bright" />
          </span>
        </a>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs leading-snug text-ink-strong">
            {candidate.title}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-ink-subtle">
            {candidate.channelTitle}
            {duration ? ` · ${duration}` : ''}
            {candidate.source === 'search' ? ' · Fuera del canal' : ''}
            {candidate.matchedBy === 'description' ? ' · Por descripción' : ''}
          </p>
          {candidate.descriptionTitle && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-warning-softer/70">
              Título en la descripción:{' '}
              <span className="font-medium">{candidate.descriptionTitle}</span>
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-[10px] font-medium text-ink-subtle">
              Nº
              <input
                id={`candidate-number-${candidate.videoId}`}
                name="candidate-number"
                type="number"
                inputMode="numeric"
                min={1}
                value={number}
                onChange={(event) => onNumberChange(event.target.value.replace(/[^\d]/g, ''))}
                aria-label={`Número de capítulo para ${candidate.title}`}
                className="w-14 rounded-lg border border-line-strong bg-surface px-2 py-1 text-center text-xs font-semibold text-ink outline-none focus:border-brand"
              />
            </label>

            <button
              type="button"
              onClick={onToggleFinal}
              aria-pressed={Boolean(isFinal)}
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition active:scale-95 ${
                isFinal
                  ? 'border-warning/40 bg-warning/15 text-warning-softer'
                  : 'border-line-strong text-ink-subtle hover:text-ink-soft'
              }`}
            >
              Final
            </button>

            <span className="ml-auto rounded-full bg-surface-raised px-1.5 py-0.5 text-[9px] font-semibold text-ink-muted">
              {candidate.score}% afinidad
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[11px] font-semibold text-success-softer transition hover:border-success/50 hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon.Check className="size-3.5" />
          {adding ? 'Añadiendo…' : 'Añadir capítulo'}
        </button>

        <button
          type="button"
          onClick={onDiscard}
          disabled={adding}
          className="rounded-xl border border-line-strong px-3 py-2 text-[11px] font-semibold text-ink-muted transition hover:border-line-contrast hover:text-ink-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Descartar
        </button>
      </div>
    </li>
  )
}
