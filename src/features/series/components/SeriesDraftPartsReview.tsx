import { formatDuration } from "../../../shared/lib/format";
import { partLabel } from "../model/parts";
import type { ChapterCandidate } from "../../discovery/types";
import type { Part } from "../types";
import { CandidateCard } from "./CandidateCard";
import * as Icon from "../../../shared/components/Icons";

interface SeriesDraftPartsReviewProps {
  parts: Part[];
  selected: Set<string>;
  allSelected: boolean;
  candidates: ChapterCandidate[];
  candidateNumbers: Record<string, string>;
  candidateFinal: Record<string, boolean>;
  candidateMessage: { kind: "ok" | "error"; text: string } | null;
  onToggleAll: () => void;
  onTogglePart: (videoId: string) => void;
  onCandidateNumberChange: (videoId: string, value: string) => void;
  onToggleCandidateFinal: (videoId: string) => void;
  onAddCandidate: (candidate: ChapterCandidate) => void;
  onDiscardCandidate: (videoId: string) => void;
}

export function SeriesDraftPartsReview({
  parts,
  selected,
  allSelected,
  candidates,
  candidateNumbers,
  candidateFinal,
  candidateMessage,
  onToggleAll,
  onTogglePart,
  onCandidateNumberChange,
  onToggleCandidateFinal,
  onAddCandidate,
  onDiscardCandidate,
}: SeriesDraftPartsReviewProps) {
  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-200">
          Partes encontradas
          <span className="ml-1.5 text-xs font-normal text-zinc-500">
            {parts.length}
          </span>
        </p>
        {parts.length > 0 && (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-xs font-medium text-rose-300 transition hover:text-rose-200"
          >
            {allSelected ? "Quitar todas" : "Seleccionar todas"}
          </button>
        )}
      </div>

      {parts.length > 0 ? (
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/50 p-2">
          {parts.map((part, index) => {
            const checked = selected.has(part.videoId);
            const duration = formatDuration(part.durationSeconds);

            return (
              <li key={part.videoId}>
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 transition ${
                    checked
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-transparent hover:bg-zinc-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onTogglePart(part.videoId)}
                    className="size-4 shrink-0 accent-rose-500"
                  />
                  <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    {part.thumbnail && (
                      <img
                        src={part.thumbnail}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                        className="size-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                      {partLabel(part, index)}
                      {duration && (
                        <span className="font-normal text-zinc-600">
                          · {duration}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-zinc-200">
                      {part.title}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-zinc-300">No hay partes</p>
          <p className="mt-1 text-xs text-zinc-500">
            Prueba con otro enlace o añade las partes a mano desde la serie.
          </p>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="flex items-start gap-2">
            <Icon.Sparkles className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-100">
                Posibles capítulos ({candidates.length})
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">
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
                number={candidateNumbers[candidate.videoId] ?? ""}
                isFinal={Boolean(
                  candidateFinal[candidate.videoId] ?? candidate.isFinal,
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
            candidateMessage.kind === "error"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {candidateMessage.text}
        </p>
      )}
    </>
  );
}
