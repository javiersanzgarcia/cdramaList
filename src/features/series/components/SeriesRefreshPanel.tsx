import { useState } from 'react'
import {
  buildCandidateState,
  parseCandidateNumber,
  validateCandidateNumber
} from '../../discovery/model/candidates'
import type {
  ChapterCandidate,
  SeriesRefreshResult
} from '../../discovery/types'
import type { Series } from '../types'
import { CandidateCard } from './CandidateCard'
import * as Icon from '../../../shared/components/Icons'

interface SeriesRefreshPanelProps {
  series: Series
  semanticConfigured: boolean
  /** Candidatos ya encontrados (p. ej. al actualizar todas las favoritas). */
  initialCandidates?: ChapterCandidate[]
  onRefresh: (series: Series) => Promise<SeriesRefreshResult>
  onAddCandidate: (
    series: Series,
    candidate: ChapterCandidate,
    options: { partNumber?: number; isFinal?: boolean }
  ) => Promise<{ synced: boolean }>
  onDiscardCandidate: (series: Series, videoId: string) => void
  onBusyChange?: (busy: boolean) => void
  /** Avisa de que la serie ya no tiene novedades pendientes de revisar. */
  onNewsHandled?: (seriesId: string) => void
}

export function SeriesRefreshPanel({
  series,
  semanticConfigured,
  initialCandidates,
  onRefresh,
  onAddCandidate,
  onDiscardCandidate,
  onBusyChange,
  onNewsHandled
}: SeriesRefreshPanelProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<{
    kind: 'ok' | 'info' | 'error'
    text: string
  } | null>(null)
  const [candidates, setCandidates] = useState<ChapterCandidate[]>(
    () => initialCandidates ?? []
  )
  const [candidateNumbers, setCandidateNumbers] = useState<
    Record<string, string>
  >(() => buildCandidateState(initialCandidates ?? [], series.parts).numbers)
  const [candidateFinal, setCandidateFinal] = useState<Record<string, boolean>>(
    () => buildCandidateState(initialCandidates ?? [], series.parts).finals
  )
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(
    null
  )
  const [candidateMessage, setCandidateMessage] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)

  function prepareCandidates(list: ChapterCandidate[], parts: Series['parts']) {
    const { numbers, finals } = buildCandidateState(list, parts)
    setCandidates(list)
    setCandidateNumbers(numbers)
    setCandidateFinal(finals)
    setCandidateMessage(null)
  }

  function discardCandidate(videoId: string) {
    // Se guarda en la serie para no volver a proponerlo en próximas búsquedas.
    onDiscardCandidate(series, videoId)
    const remaining = candidates.filter(
      (candidate) => candidate.videoId !== videoId
    )
    setCandidates(remaining)
    setCandidateNumbers((current) => {
      const next = { ...current }
      delete next[videoId]
      return next
    })
    setCandidateFinal((current) => {
      const next = { ...current }
      delete next[videoId]
      return next
    })
    // Sin candidatos pendientes, la serie ya no cuenta como «con novedades».
    if (remaining.length === 0) onNewsHandled?.(series.id)
  }

  async function handleAddCandidate(candidate: ChapterCandidate) {
    if (addingCandidateId) return

    const raw = candidateNumbers[candidate.videoId] ?? ''
    const numberError = validateCandidateNumber(
      raw,
      series.parts,
      candidateNumbers,
      candidate.videoId
    )

    if (numberError) {
      setCandidateMessage({ kind: 'error', text: numberError })
      return
    }

    const partNumber = parseCandidateNumber(raw)
    setAddingCandidateId(candidate.videoId)
    setCandidateMessage(null)
    setRefreshMessage(null)

    try {
      const result = await onAddCandidate(series, candidate, {
        partNumber,
        isFinal: candidateFinal[candidate.videoId] ?? candidate.isFinal
      })

      discardCandidate(candidate.videoId)
      setCandidateMessage({
        kind: 'ok',
        text: result.synced
          ? 'Capítulo añadido y sincronizado. Esta coincidencia mejorará futuras sugerencias de la serie.'
          : 'Capítulo añadido. Esta coincidencia mejorará futuras sugerencias de la serie y se sincronizará con Google Drive.'
      })
    } catch (caught) {
      setCandidateMessage({
        kind: 'error',
        text:
          caught instanceof Error
            ? caught.message
            : 'No se pudo añadir el capítulo. Inténtalo de nuevo.'
      })
    } finally {
      setAddingCandidateId(null)
    }
  }

  async function handleRefresh() {
    if (refreshing) return

    setRefreshing(true)
    onBusyChange?.(true)
    setRefreshMessage(null)
    setCandidateMessage(null)

    try {
      const result = await onRefresh(series)
      prepareCandidates(result.candidates, result.parts)
      const warningText =
        result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : ''

      if (result.added === 0 && result.candidates.length === 0) {
        setRefreshMessage({
          kind: 'info',
          text: `No se han encontrado capítulos nuevos ni candidatos.${warningText}`
        })
        // La serie no tiene nada nuevo: se retira de la cola de revisión.
        onNewsHandled?.(series.id)
        return
      }

      if (result.added === 0) {
        const noun =
          result.candidates.length === 1
            ? '1 posible capítulo'
            : `${result.candidates.length} posibles capítulos`
        setRefreshMessage({
          kind: 'info',
          text: `No hay coincidencias exactas. Revisa ${noun} más abajo y valídalos manualmente.${warningText}`
        })
        return
      }

      const noun =
        result.added === 1
          ? '1 capítulo nuevo'
          : `${result.added} capítulos nuevos`
      const verb = result.added === 1 ? 'añadido' : 'añadidos'
      const extra =
        result.candidates.length > 0
          ? ` Además hay ${result.candidates.length === 1 ? '1 posible capítulo' : `${result.candidates.length} posibles capítulos`} para revisar.`
          : ''

      setRefreshMessage({
        kind: 'ok',
        text: result.synced
          ? `${noun} ${verb} y sincronizado con Google Drive.${extra}${warningText}`
          : `${noun} ${verb}. Se sincronizará con Google Drive en la próxima sincronización.${extra}${warningText}`
      })
    } catch (caught) {
      setRefreshMessage({
        kind: 'error',
        text:
          caught instanceof Error
            ? caught.message
            : 'No se pudo actualizar la serie. Inténtalo de nuevo.'
      })
    } finally {
      setRefreshing(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={refreshing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon.RefreshCw
          className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
        />
        {refreshing ? 'Buscando capítulos nuevos…' : 'Actualizar serie'}
      </button>

      {!semanticConfigured && (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Similitud semántica desactivada: no se configuró el servicio de IA al
          compilar esta app.
        </p>
      )}

      {refreshMessage && (
        <p
          className={`rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
            refreshMessage.kind === 'error'
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
              : refreshMessage.kind === 'ok'
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                : 'border-zinc-700 bg-zinc-950/60 text-zinc-300'
          }`}
        >
          {refreshMessage.text}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="flex items-start gap-2">
            <Icon.Sparkles className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-100">
                Posibles capítulos ({candidates.length})
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">
                Hemos buscado por el título, los alias, el título real de la
                descripción y sus sinónimos. Revisa el número y añádelos solo si
                son de esta serie.
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
                adding={addingCandidateId === candidate.videoId}
                busy={addingCandidateId !== null}
                onNumberChange={(value) =>
                  setCandidateNumbers((current) => ({
                    ...current,
                    [candidate.videoId]: value
                  }))
                }
                onToggleFinal={() =>
                  setCandidateFinal((current) => ({
                    ...current,
                    [candidate.videoId]: !(
                      current[candidate.videoId] ?? candidate.isFinal
                    )
                  }))
                }
                onAdd={() => void handleAddCandidate(candidate)}
                onDiscard={() => discardCandidate(candidate.videoId)}
              />
            ))}
          </ul>
        </div>
      )}

      {candidateMessage && (
        <p
          className={`rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
            candidateMessage.kind === 'error'
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
          }`}
        >
          {candidateMessage.text}
        </p>
      )}
    </div>
  )
}
