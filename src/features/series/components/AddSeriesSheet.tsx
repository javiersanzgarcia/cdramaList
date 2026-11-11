import { useState } from "react";
import type { FormEvent } from "react";
import {
  buildCandidateState,
  parseCandidateNumber,
  validateCandidateNumber,
} from "../../discovery/model/candidates";
import { sortParts } from "../model/parts";
import { findExistingSeries } from "../model/series";
import type { ChapterCandidate } from "../../discovery/types";
import type { Part, Series, SeriesDraft } from "../types";
import {
  candidateToPart,
  discoverPlaylist,
  discoverVideoSeries,
  fetchManualVideo,
} from "../../discovery/model/youtubeDrafts";
import { parseYouTubeUrl, YouTubeError } from "../../discovery/model/youtube";
import { useSheet } from "../../../shared/hooks/useSheet";
import { SeriesDraftPartsReview } from "./SeriesDraftPartsReview";
import { YouTubeLinkForm } from "./YouTubeLinkForm";
import * as Icon from "../../../shared/components/Icons";

type Phase = "input" | "loading" | "preview" | "error";

interface AddSeriesSheetProps {
  apiKey: string;
  series: Series[];
  targetSeries?: Series;
  onClose: () => void;
  onSave: (draft: SeriesDraft, title: string, parts: Part[]) => void;
  onOpenSettings: () => void;
}

export function AddSeriesSheet({
  apiKey,
  series,
  targetSeries,
  onClose,
  onSave,
  onOpenSettings,
}: AddSeriesSheetProps) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<SeriesDraft | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<ChapterCandidate[]>([]);
  const [candidateNumbers, setCandidateNumbers] = useState<
    Record<string, string>
  >({});
  const [candidateFinal, setCandidateFinal] = useState<Record<string, boolean>>(
    {},
  );
  const [candidateMessage, setCandidateMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  useSheet(onClose);

  const existing = draft?.existingSeriesId
    ? series.find((item) => item.id === draft.existingSeriesId)
    : undefined;
  const allSelected = Boolean(
    draft && draft.parts.length > 0 && selected.size === draft.parts.length,
  );

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(text.trim());
    } catch {
      // El navegador puede bloquear la lectura del portapapeles.
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseYouTubeUrl(url);
    if (!parsed) {
      setError(
        "Pega un enlace válido de YouTube (vídeo, Short o lista de reproducción).",
      );
      setPhase("error");
      return;
    }

    setPhase("loading");
    setError("");

    try {
      let result: SeriesDraft;

      if (parsed.videoId) {
        if (apiKey) {
          setMessage(
            "Buscando el vídeo y los capítulos en el canal y en YouTube…",
          );
          result = await discoverVideoSeries(parsed.videoId, apiKey);
        } else {
          setMessage("Leyendo los datos del vídeo…");
          result = await fetchManualVideo(parsed.videoId);
        }
      } else if (parsed.playlistId) {
        if (!apiKey) {
          throw new YouTubeError(
            "Para importar una lista de reproducción necesitas configurar la clave de YouTube en Ajustes.",
          );
        }
        setMessage("Importando la lista de reproducción…");
        result = await discoverPlaylist(parsed.playlistId, apiKey);
      } else {
        throw new YouTubeError("No se ha reconocido el enlace de YouTube.");
      }

      const match = targetSeries ?? findExistingSeries(series, result);
      const finalDraft = match
        ? { ...result, existingSeriesId: match.id }
        : result;

      const nextCandidates = finalDraft.candidates ?? [];
      const candidateState = buildCandidateState(nextCandidates, [
        ...finalDraft.parts,
        ...(match?.parts ?? []),
      ]);

      setDraft(finalDraft);
      setSelected(new Set(finalDraft.selectedIds));
      setTitle(match ? match.title : finalDraft.title);
      setCandidates(nextCandidates);
      setCandidateNumbers(candidateState.numbers);
      setCandidateFinal(candidateState.finals);
      setCandidateMessage(null);
      setPhase("preview");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo analizar el enlace. Inténtalo de nuevo.",
      );
      setPhase("error");
    }
  }

  function togglePart(videoId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  function toggleAll() {
    if (!draft) return;
    setSelected(
      allSelected
        ? new Set()
        : new Set(draft.parts.map((part) => part.videoId)),
    );
  }

  function discardCandidate(videoId: string) {
    setCandidates((current) =>
      current.filter((candidate) => candidate.videoId !== videoId),
    );
    setCandidateNumbers((current) => {
      const next = { ...current };
      delete next[videoId];
      return next;
    });
    setCandidateFinal((current) => {
      const next = { ...current };
      delete next[videoId];
      return next;
    });
  }

  function handleAddCandidate(candidate: ChapterCandidate) {
    if (!draft) return;

    const raw = candidateNumbers[candidate.videoId] ?? "";
    const numberError = validateCandidateNumber(
      raw,
      [...draft.parts, ...(existing?.parts ?? [])],
      candidateNumbers,
      candidate.videoId,
    );

    if (numberError) {
      setCandidateMessage({ kind: "error", text: numberError });
      return;
    }

    const part = candidateToPart(candidate, {
      partNumber: parseCandidateNumber(raw),
      isFinal: candidateFinal[candidate.videoId] ?? candidate.isFinal,
    });

    setDraft((current) =>
      current
        ? { ...current, parts: sortParts([...current.parts, part]) }
        : current,
    );
    setSelected((current) => new Set([...current, candidate.videoId]));
    discardCandidate(candidate.videoId);
    setCandidateMessage({
      kind: "ok",
      text: `«${candidate.title}» se añadirá al guardar la serie.`,
    });
  }

  function handleSave() {
    if (!draft) return;
    const parts = draft.parts.filter((part) => selected.has(part.videoId));
    if (parts.length === 0) return;
    onSave(draft, title.trim() || draft.title, parts);
  }

  const sourceLabel =
    draft?.source === "playlist"
      ? "Lista de reproducción"
      : draft?.source === "search"
        ? "Canal y YouTube"
        : "Modo manual";

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
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-800 bg-zinc-900 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
              Añadir a tu lista
            </p>
            <h2 id="add-series-title" className="truncate text-lg font-bold">
              Nueva serie
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800/80 text-zinc-300 transition hover:text-white active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          {phase === "input" && (
            <YouTubeLinkForm
              apiKeyAvailable={apiKey.length > 0}
              url={url}
              onUrlChange={setUrl}
              onPaste={handlePaste}
              onSubmit={handleAnalyze}
              onOpenSettings={onOpenSettings}
            />
          )}

          {phase === "loading" && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="size-12 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
              <p className="mt-4 text-sm font-medium text-zinc-200">
                {message}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Esto puede tardar unos segundos.
              </p>
              <button
                type="button"
                onClick={() => setPhase("input")}
                className="mt-6 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="py-8 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-300">
                <Icon.Info className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-100">
                No se pudo añadir
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {error}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase("input")}
                  className="flex-1 rounded-2xl border border-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex-1 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 active:scale-[0.99]"
                >
                  Abrir Ajustes
                </button>
              </div>
            </div>
          )}

          {phase === "preview" && draft && (
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                  {sourceLabel}
                </span>
                {existing && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                    Serie existente
                  </span>
                )}
              </div>

              <label
                htmlFor="series-title"
                className="mt-4 block text-xs font-medium text-zinc-400"
              >
                Título de la serie
              </label>
              <input
                id="series-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                Si escribes un título distinto al del vídeo, el título real de
                YouTube se guardará como alias de búsqueda.
              </p>

              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                <Icon.Youtube className="size-4 shrink-0" />
                <span className="truncate">{draft.channelTitle}</span>
                {draft.channelUrl && (
                  <a
                    href={draft.channelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-zinc-400 transition hover:text-white"
                  >
                    Ver canal
                    <Icon.ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>

              {existing && (
                <p className="mt-2 rounded-xl bg-emerald-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-200/80">
                  Se añadirán a «{existing.title}» sin perder las partes que ya
                  has visto.
                </p>
              )}

              {draft.warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {draft.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex gap-2 rounded-xl bg-amber-400/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/80"
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
                candidates={candidates}
                candidateNumbers={candidateNumbers}
                candidateFinal={candidateFinal}
                candidateMessage={candidateMessage}
                onToggleAll={toggleAll}
                onTogglePart={togglePart}
                onCandidateNumberChange={(videoId, value) =>
                  setCandidateNumbers((current) => ({
                    ...current,
                    [videoId]: value,
                  }))
                }
                onToggleCandidateFinal={(videoId) =>
                  setCandidateFinal((current) => ({
                    ...current,
                    [videoId]: !(
                      current[videoId] ??
                      candidates.find(
                        (candidate) => candidate.videoId === videoId,
                      )?.isFinal
                    ),
                  }))
                }
                onAddCandidate={handleAddCandidate}
                onDiscardCandidate={discardCandidate}
              />

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase("input")}
                  className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selected.size === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Check className="size-4" />
                  {existing ? "Añadir partes" : "Guardar serie"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
