import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  buildCandidateState,
  parseCandidateNumber,
  validateCandidateNumber
} from '../../discovery/model/candidates'
import { sortParts } from '../model/parts'
import { findExistingSeries } from '../model/series'
import type { ChapterCandidate } from '../../discovery/types'
import type { Part, Series, SeriesDraft } from '../types'
import {
  candidateToPart,
  discoverPlaylist,
  discoverVideoSeries,
  fetchManualVideo
} from '../../discovery/model/youtubeDrafts'
import { parseYouTubeUrl, YouTubeError } from '../../discovery/model/youtube'
import { useSheet } from '../../../shared/hooks/useSheet'
import { SeriesDraftPartsReview } from './SeriesDraftPartsReview'
import { YouTubeLinkForm } from './YouTubeLinkForm'
import * as Icon from '../../../shared/components/Icons'

type Phase = 'input' | 'loading' | 'preview' | 'error'

interface AddSeriesSheetProps {
  apiKey: string
  series: Series[]
  targetSeries?: Series
  onClose: () => void
  onSave: (draft: SeriesDraft, title: string, parts: Part[]) => void
  onOpenSettings: () => void
}

export function AddSeriesSheet({
  apiKey,
  series,
  targetSeries,
  onClose,
  onSave,
  onOpenSettings
}: AddSeriesSheetProps) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<SeriesDraft | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [suggestedSeries, setSuggestedSeries] = useState<Series | null>(null)
  const [candidates, setCandidates] = useState<ChapterCandidate[]>([])
  const [candidateNumbers, setCandidateNumbers] = useState<
    Record<string, string>
  >({})
  const [candidateFinal, setCandidateFinal] = useState<Record<string, boolean>>(
    {}
  )
  const [candidateMessage, setCandidateMessage] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)

  useSheet(onClose)

  const existing = draft?.existingSeriesId
    ? series.find((item) => item.id === draft.existingSeriesId)
    : undefined
  // La serie destino manda cuando se llega desde su ficha. Si no, solo se
  // adjunta cuando el usuario lo elige en la tarjeta de sugerencia.
  const attachedSeries = targetSeries ?? existing
  const isAddMode = Boolean(attachedSeries)
  const existingVideoIds = useMemo(
    () => new Set((attachedSeries?.parts ?? []).map((part) => part.videoId)),
    [attachedSeries]
  )
  const newParts = draft
    ? draft.parts.filter((part) => !existingVideoIds.has(part.videoId))
    : []
  const allSelected = Boolean(
    newParts.length > 0 && newParts.every((part) => selected.has(part.videoId))
  )

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) setUrl(text.trim())
    } catch {
      // El navegador puede bloquear la lectura del portapapeles.
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = parseYouTubeUrl(url)
    if (!parsed) {
      setError(
        'Pega un enlace válido de YouTube (vídeo, Short o lista de reproducción).'
      )
      setPhase('error')
      return
    }

    setPhase('loading')
    setError('')

    try {
      let result: SeriesDraft

      if (parsed.videoId) {
        if (apiKey) {
          setMessage(
            'Buscando el vídeo y los capítulos en el canal y en YouTube…'
          )
          result = await discoverVideoSeries(parsed.videoId, apiKey)
        } else {
          setMessage('Leyendo los datos del vídeo…')
          result = await fetchManualVideo(parsed.videoId)
        }
      } else if (parsed.playlistId) {
        if (!apiKey) {
          throw new YouTubeError(
            'Para importar una lista de reproducción necesitas configurar la clave de YouTube en Ajustes.'
          )
        }
        setMessage('Importando la lista de reproducción…')
        result = await discoverPlaylist(parsed.playlistId, apiKey)
      } else {
        throw new YouTubeError('No se ha reconocido el enlace de YouTube.')
      }

      // Desde una serie concreta siempre se añade a ella. Desde la portada no
      // se adjunta nada en silencio: como mucho se ofrece la coincidencia.
      const match = targetSeries
      const suggestion = targetSeries
        ? undefined
        : findExistingSeries(series, result)
      const finalDraft = match
        ? { ...result, existingSeriesId: match.id }
        : result

      const matchIds = new Set((match?.parts ?? []).map((part) => part.videoId))
      const nextCandidates = (finalDraft.candidates ?? []).filter(
        (candidate) => !matchIds.has(candidate.videoId)
      )
      const candidateState = buildCandidateState(nextCandidates, [
        ...finalDraft.parts,
        ...(match?.parts ?? [])
      ])

      setDraft(finalDraft)
      setSelected(
        new Set(
          finalDraft.selectedIds.filter((videoId) => !matchIds.has(videoId))
        )
      )
      setTitle(match ? match.title : finalDraft.title)
      setSuggestedSeries(suggestion ?? null)
      setCandidates(nextCandidates)
      setCandidateNumbers(candidateState.numbers)
      setCandidateFinal(candidateState.finals)
      setCandidateMessage(null)
      setPhase('preview')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo analizar el enlace. Inténtalo de nuevo.'
      )
      setPhase('error')
    }
  }

  function togglePart(videoId: string) {
    if (existingVideoIds.has(videoId)) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  function toggleAll() {
    if (!draft) return
    setSelected(
      allSelected ? new Set() : new Set(newParts.map((part) => part.videoId))
    )
  }

  // Adjunta el borrador a la serie sugerida solo cuando el usuario lo pide.
  function attachSuggested() {
    if (!draft || !suggestedSeries) return

    const suggestionIds = new Set(
      suggestedSeries.parts.map((part) => part.videoId)
    )
    const candidateState = buildCandidateState(candidates, [
      ...draft.parts,
      ...suggestedSeries.parts
    ])

    setDraft({ ...draft, existingSeriesId: suggestedSeries.id })
    setTitle(suggestedSeries.title)
    setSelected((current) => {
      const next = new Set(current)
      suggestionIds.forEach((videoId) => next.delete(videoId))
      return next
    })
    setCandidateNumbers(candidateState.numbers)
    setCandidateFinal(candidateState.finals)
  }

  // Vuelve al flujo de creación. Solo se ofrece cuando la coincidencia la
  // propuso la app, nunca cuando se llegó desde la ficha de una serie.
  function createNewFromSuggestion() {
    if (!draft || targetSeries) return

    const candidateState = buildCandidateState(candidates, draft.parts)
    setDraft({ ...draft, existingSeriesId: undefined })
    setTitle(draft.title)
    setSuggestedSeries(null)
    // Al desadjuntar, las partes que se habían excluido por estar en la serie
    // sugerida vuelven a estar seleccionables (y marcadas por defecto).
    if (suggestedSeries) {
      const suggestionIds = new Set(
        suggestedSeries.parts.map((part) => part.videoId)
      )
      setSelected((current) => {
        const next = new Set(current)
        draft.parts.forEach((part) => {
          if (suggestionIds.has(part.videoId)) next.add(part.videoId)
        })
        return next
      })
    }
    setCandidateNumbers(candidateState.numbers)
    setCandidateFinal(candidateState.finals)
  }

  function discardCandidate(videoId: string) {
    setCandidates((current) =>
      current.filter((candidate) => candidate.videoId !== videoId)
    )
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
  }

  function handleAddCandidate(candidate: ChapterCandidate) {
    if (!draft) return

    if (existingVideoIds.has(candidate.videoId)) {
      setCandidateMessage({
        kind: 'error',
        text: 'Esa parte ya está en la serie.'
      })
      return
    }

    const raw = candidateNumbers[candidate.videoId] ?? ''
    const numberError = validateCandidateNumber(
      raw,
      [...draft.parts, ...(attachedSeries?.parts ?? [])],
      candidateNumbers,
      candidate.videoId
    )

    if (numberError) {
      setCandidateMessage({ kind: 'error', text: numberError })
      return
    }

    const part = candidateToPart(candidate, {
      partNumber: parseCandidateNumber(raw),
      isFinal: candidateFinal[candidate.videoId] ?? candidate.isFinal
    })

    setDraft((current) =>
      current
        ? { ...current, parts: sortParts([...current.parts, part]) }
        : current
    )
    setSelected((current) => new Set([...current, candidate.videoId]))
    discardCandidate(candidate.videoId)
    setCandidateMessage({
      kind: 'ok',
      text: `«${candidate.title}» se añadirá al guardar la serie.`
    })
  }

  function handleSave() {
    if (!draft) return
    const parts = draft.parts.filter(
      (part) =>
        selected.has(part.videoId) && !existingVideoIds.has(part.videoId)
    )
    if (parts.length === 0) return

    // En modo añadir el título siempre es el de la serie destino: no se puede
    // renombrar una serie existente desde este flujo.
    const finalTitle = attachedSeries
      ? attachedSeries.title
      : title.trim() || draft.title
    onSave(draft, finalTitle, parts)
  }

  const sourceLabel =
    draft?.source === 'playlist'
      ? 'Lista de reproducción'
      : draft?.source === 'search'
        ? 'Canal y YouTube'
        : 'Modo manual'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-series-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line/80 bg-surface/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-bright">
              {isAddMode ? 'Añadir partes' : 'Añadir a tu lista'}
            </p>
            <h2 id="add-series-title" className="truncate text-lg font-bold">
              {isAddMode ? 'Añadir a la serie' : 'Crear serie nueva'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised/80 text-ink-soft transition hover:text-ink-bright active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          {attachedSeries && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-success-strong/25 bg-success-strong/10 p-3">
              <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
                {attachedSeries.thumbnail && (
                  <img
                    src={attachedSeries.thumbnail}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                    className="size-full object-cover"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-success-soft">
                  Añadiendo a una serie existente
                </p>
                <p className="truncate text-sm font-semibold text-ink">
                  {attachedSeries.title}
                </p>
                <p className="mt-0.5 text-[11px] text-success-softer/70">
                  {attachedSeries.parts.length}{' '}
                  {attachedSeries.parts.length === 1 ? 'parte' : 'partes'} en la
                  serie
                </p>
              </div>
            </div>
          )}

          {phase === 'input' && (
            <YouTubeLinkForm
              mode={isAddMode ? 'add' : 'create'}
              apiKeyAvailable={apiKey.length > 0}
              url={url}
              onUrlChange={setUrl}
              onPaste={handlePaste}
              onSubmit={handleAnalyze}
              onOpenSettings={onOpenSettings}
            />
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="size-12 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
              <p className="mt-4 text-sm font-medium text-ink-strong">
                {message}
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                Esto puede tardar unos segundos.
              </p>
              <button
                type="button"
                onClick={() => setPhase('input')}
                className="mt-6 text-xs font-medium text-ink-subtle transition hover:text-ink-soft"
              >
                Cancelar
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-8 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand-soft">
                <Icon.Info className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">
                {isAddMode ? 'No se pudo añadir' : 'No se pudo crear la serie'}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {error}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('input')}
                  className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99]"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex-1 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink-bright transition hover:bg-brand-bright active:scale-[0.99]"
                >
                  Abrir Ajustes
                </button>
              </div>
            </div>
          )}

          {phase === 'preview' && draft && (
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-soft">
                  {sourceLabel}
                </span>
                {isAddMode && (
                  <span className="rounded-full bg-success-strong/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success-soft">
                    Añadiendo a serie existente
                  </span>
                )}
              </div>

              {suggestedSeries && !isAddMode && (
                <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/5 p-3">
                  <div className="flex items-start gap-2">
                    <Icon.Info className="mt-0.5 size-4 shrink-0 text-warning-soft" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-warning-softest">
                        Puede que esta serie ya exista
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-warning-softer/75">
                        «{suggestedSeries.title}» ya tiene{' '}
                        {suggestedSeries.parts.length}{' '}
                        {suggestedSeries.parts.length === 1
                          ? 'parte'
                          : 'partes'}
                        . ¿Añadimos estas partes a esa serie o creamos una
                        nueva?
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={attachSuggested}
                      className="rounded-xl bg-success-strong px-3 py-2 text-xs font-semibold text-ink-bright transition hover:bg-success active:scale-[0.99]"
                    >
                      Añadir a la existente
                    </button>
                    <button
                      type="button"
                      onClick={createNewFromSuggestion}
                      className="rounded-xl border border-line-strong px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-line-contrast hover:text-ink-bright active:scale-[0.99]"
                    >
                      Crear serie nueva
                    </button>
                  </div>
                </div>
              )}

              {suggestedSeries && isAddMode && !targetSeries && (
                <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">
                  Has elegido añadir estas partes a «{suggestedSeries.title}».{' '}
                  <button
                    type="button"
                    onClick={createNewFromSuggestion}
                    className="font-semibold text-brand-soft transition hover:text-brand-softer"
                  >
                    Crear una serie nueva
                  </button>
                </p>
              )}

              {!isAddMode && (
                <>
                  <label
                    htmlFor="series-title"
                    className="mt-4 block text-xs font-medium text-ink-muted"
                  >
                    Título de la serie
                  </label>
                  <input
                    id="series-title"
                    name="series-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-2xl border border-line bg-canvas/70 px-3.5 py-3 text-sm font-medium text-ink outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-subtle">
                    Si escribes un título distinto al del vídeo, el título real
                    de YouTube se guardará como alias de búsqueda.
                  </p>
                </>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
                <Icon.Youtube className="size-4 shrink-0" />
                <span className="truncate">{draft.channelTitle}</span>
                {draft.channelUrl && (
                  <a
                    href={draft.channelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-ink-muted transition hover:text-ink-bright"
                  >
                    Ver canal
                    <Icon.ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>

              {draft.warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {draft.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex gap-2 rounded-xl bg-warning/5 px-2.5 py-2 text-[11px] leading-relaxed text-warning-softer/80"
                    >
                      <Icon.Info className="mt-0.5 size-3.5 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}

              <SeriesDraftPartsReview
                parts={draft.parts}
                selected={selected}
                allSelected={allSelected}
                existingVideoIds={existingVideoIds}
                candidates={candidates}
                candidateNumbers={candidateNumbers}
                candidateFinal={candidateFinal}
                candidateMessage={candidateMessage}
                onToggleAll={toggleAll}
                onTogglePart={togglePart}
                onCandidateNumberChange={(videoId, value) =>
                  setCandidateNumbers((current) => ({
                    ...current,
                    [videoId]: value
                  }))
                }
                onToggleCandidateFinal={(videoId) =>
                  setCandidateFinal((current) => ({
                    ...current,
                    [videoId]: !(
                      current[videoId] ??
                      candidates.find(
                        (candidate) => candidate.videoId === videoId
                      )?.isFinal
                    )
                  }))
                }
                onAddCandidate={handleAddCandidate}
                onDiscardCandidate={discardCandidate}
              />

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('input')}
                  className="rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99]"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selected.size === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-bright shadow-lg shadow-brand/25 transition hover:bg-brand-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Check className="size-4" />
                  {isAddMode
                    ? `Añadir ${selected.size} ${
                        selected.size === 1 ? 'parte' : 'partes'
                      }`
                    : 'Guardar serie'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
