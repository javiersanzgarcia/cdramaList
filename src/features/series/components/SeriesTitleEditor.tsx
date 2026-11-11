import { useState } from "react";
import type { FormEvent } from "react";
import type { Series } from "../types";
import * as Icon from "../../../shared/components/Icons";

interface SeriesTitleEditorProps {
  series: Series;
  onUpdateTitle: (seriesId: string, title: string) => void;
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function SeriesTitleEditor({
  series,
  onUpdateTitle,
}: SeriesTitleEditorProps) {
  const [titleDraft, setTitleDraft] = useState(series.title);
  const [previousTitle, setPreviousTitle] = useState(series.title);
  const [message, setMessage] = useState<string | null>(null);

  // Si el título cambia desde fuera (por ejemplo, al sincronizar con Drive),
  // actualiza el campo sin pisar lo que el usuario está escribiendo.
  if (series.title !== previousTitle) {
    setPreviousTitle(series.title);
    if (normalizeTitle(titleDraft) !== series.title) {
      setTitleDraft(series.title);
    }
  }

  const normalized = normalizeTitle(titleDraft);
  const changed = normalized.length >= 2 && normalized !== series.title;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalized.length < 2) {
      setMessage("El título debe tener al menos 2 caracteres.");
      return;
    }

    if (!changed) return;

    onUpdateTitle(series.id, normalized);
    setMessage(
      "Título actualizado. Los títulos de YouTube de sus vídeos se guardarán como alias.",
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center gap-2">
        <Icon.Pencil className="size-4 text-rose-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Título de la serie
        </h3>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Cambia el título que ves en tu lista. Los títulos reales de YouTube de
        sus vídeos se añadirán como alias para que la búsqueda siga
        encontrándolos.
      </p>

      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          value={titleDraft}
          onChange={(event) => {
            setTitleDraft(event.target.value);
            setMessage(null);
          }}
          aria-label="Título de la serie"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
        />
        <button
          type="submit"
          disabled={!changed}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-zinc-800 px-3 py-2 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-40"
        >
          <Icon.Check className="size-3.5" />
          Guardar
        </button>
      </form>

      {message && (
        <p className="mt-1.5 text-[11px] text-amber-200/80">{message}</p>
      )}
    </div>
  );
}
