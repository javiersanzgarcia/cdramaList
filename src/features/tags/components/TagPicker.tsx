import { useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeTagName, resolveSeriesTags } from '../model/tags'
import { MAX_TAG_NAME_LENGTH } from '../model/constants'
import type { Tag } from '../types'
import type { Series } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

interface TagPickerProps {
  series: Series
  tags: Tag[]
  onToggle: (seriesId: string, tagId: string) => void
  /** Crea una etiqueta y devuelve su id, o `null` si el nombre no es válido. */
  onCreate: (name: string) => string | null
}

/** Selector de etiquetas de una serie, con creación rápida desde la ficha. */
export function TagPicker({ series, tags, onToggle, onCreate }: TagPickerProps) {
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const activeTags = tags.filter((tag) => !tag.deletedAt)
  const selectedIds = new Set(resolveSeriesTags(series, tags).map((tag) => tag.id))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = normalizeTagName(draft)
    if (!name) {
      setMessage('Escribe un nombre para la etiqueta.')
      return
    }

    const existing = activeTags.find(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
    const id = existing?.id ?? onCreate(name)

    if (!id) {
      setMessage('No se pudo crear la etiqueta.')
      return
    }

    if (!selectedIds.has(id)) onToggle(series.id, id)
    setDraft('')
    setMessage(null)
  }

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
        Etiquetas
      </p>

      {activeTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeTags.map((tag) => {
            const active = selectedIds.has(tag.id)

            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(series.id, tag.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                  active
                    ? 'border-brand bg-brand/15 text-brand-softest'
                    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-bright'
                }`}
              >
                <Icon.Tag className="size-3" />
                {tag.name}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-subtle">
          Todavía no hay etiquetas. Crea la primera aquí abajo.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          maxLength={MAX_TAG_NAME_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value)
            setMessage(null)
          }}
          placeholder="Nueva etiqueta…"
          aria-label="Nueva etiqueta"
          className="min-w-0 flex-1 rounded-full border border-line bg-canvas/60 px-3 py-2 text-xs text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-soft transition hover:text-ink-bright active:scale-90 disabled:opacity-40"
          aria-label="Crear etiqueta"
        >
          <Icon.Plus className="size-4" />
        </button>
      </form>

      {message && <p className="mt-1.5 text-[11px] text-warning-softer">{message}</p>}
    </div>
  )
}
