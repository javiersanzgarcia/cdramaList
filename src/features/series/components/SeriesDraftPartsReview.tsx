import { formatDuration } from '../../../shared/lib/format'
import { partLabel } from '../model/parts'
import type { ChapterCandidate } from '../../discovery/types'
import type { Part } from '../types'
import { CandidateCard } from './CandidateCard'
import * as Icon from '../../../shared/components/Icons'

interface SeriesDraftPartsReviewProps {
  parts: Part[]
  selected: Set<string>
  allSelected: boolean
  existingVideoIds: Set<string>
  candidates: ChapterCandidate[]
  candidateNumbers: Record<string, string>
  candidateFinal: Record<string, boolean>
  candidateMessage: { kind: 'ok' | 'error'; text: string } | null
  onToggleAll: () => void
  onTogglePart: (videoId: string) => void
  onCandidateNumberChange: (videoId: string, value: string) => void
  onToggleCandidateFinal: (videoId: string) => void
  onAddCandidate: (candidate: ChapterCandidate) => void
  onDiscardCandidate: (videoId: string) => void
}

export function SeriesDraftPartsReview({
  parts,
  selected,
  allSelected,
  existingVideoIds,
  candidates,
  candidateNumbers,
  candidateFinal,
  candidateMessage,
  onToggleAll,
  onTogglePart,
  onCandidateNumberChange,
  onToggleCandidateFinal,
  onAddCandidate,
  onDiscardCandidate
}: SeriesDraftPartsReviewProps) {
  const selectableParts = parts.filter(
    (part) => !existingVideoIds.has(part.videoId)
  )

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-strong">
          Partes encontradas
          <span className="ml-1.5 text-xs font-normal text-ink-subtle">
            {parts.length}
          </span>
        </p>
        {selectableParts.length > 0 && (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-xs font-medium text-brand-soft transition hover:text-brand-softer"
          >
            {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
          </button>
        )}
      </div>

      {parts.length > 0 ? (
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-line bg-canvas/50 p-2">
          {parts.map((part, index) => {
            const inSeries = existingVideoIds.has(part.videoId)
            const checked = !inSeries && selected.has(part.videoId)
            const duration = formatDuration(part.durationSeconds)

            return (
              <li key={part.videoId}>
                <label
                  className={`flex items-center gap-2.5 rounded-xl border p-2 transition ${
                    inSeries
                      ? 'cursor-default border-success-strong/15 bg-success-strong/5 opacity-75'
                      : `cursor-pointer ${
                          checked
                            ? 'border-brand/40 bg-brand/10'
                            : 'border-transparent hover:bg-surface'
                        }`
                  }`}
                >
                  <input
                    id={`draft-part-${part.videoId}`}
                    name="draft-parts"
                    type="checkbox"
                    checked={checked}
                    disabled={inSeries}
                    onChange={() => onTogglePart(part.videoId)}
                    className="size-4 shrink-0 accent-brand disabled:opacity-40"
                  />
                  <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
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
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
                      {partLabel(part, index)}
                      {inSeries && (
                        <span className="rounded-full bg-success-strong/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success-soft">
                          Ya en la serie
                        </span>
                      )}
                      {duration && (
                        <span className="font-normal text-ink-faint">
                          · {duration}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-strong">
                      {part.title}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mt-2 rounded-2xl border border-dashed border-line bg-canvas/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink-soft">No hay partes</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Prueba con otro enlace o añade las partes a mano desde la serie.
          </p>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-3">
          <div className="flex items-start gap-2">
            <Icon.Sparkles className="mt-0.5 size-4 shrink-0 text-warning-soft" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-warning-softest">
                Posibles capítulos ({candidates.length})
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-warning-softer/70">
                Encontrados en el canal y en todo YouTube, también por los
                alias, el título de la descripción y sus sinónimos. Revisa el
                número y añade solo los que sean de esta serie.
              </p>
            </div>
          </div>

          <ul className="mt-2 space-y-2">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.videoId}
                candidate={candidate}
                number={candidateNumbers[candidate.videoId] ?? ''}
                isFinal={Boolean(
                  candidateFinal[candidate.videoId] ?? candidate.isFinal
                )}
                adding={false}
                busy={false}
                onNumberChange={(value) =>
                  onCandidateNumberChange(candidate.videoId, value)
                }
                onToggleFinal={() => onToggleCandidateFinal(candidate.videoId)}
                onAdd={() => onAddCandidate(candidate)}
                onDiscard={() => onDiscardCandidate(candidate.videoId)}
              />
            ))}
          </ul>
        </div>
      )}

      {candidateMessage && (
        <p
          className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
            candidateMessage.kind === 'error'
              ? 'border-brand/20 bg-brand/10 text-brand-softer'
              : 'border-success/20 bg-success/10 text-success-softer'
          }`}
        >
          {candidateMessage.text}
        </p>
      )}
    </>
  )
}
