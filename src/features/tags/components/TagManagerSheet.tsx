import { useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeTagName } from '../model/tags'
import { MAX_TAG_NAME_LENGTH } from '../model/constants'
import { useSheet } from '../../../shared/hooks/useSheet'
import type { Tag } from '../types'
import * as Icon from '../../../shared/components/Icons'

interface TagManagerSheetProps {
  tags: Tag[]
  /** Número de series visibles que usan cada etiqueta. */
  counts: Record<string, number>
  onClose: () => void
  onCreate: (name: string) => string | null
  onRename: (id: string, name: string) => boolean
  onDelete: (id: string) => void
}

/** Gestión de etiquetas: crear, renombrar y borrar. */
export function TagManagerSheet({
  tags,
  counts,
  onClose,
  onCreate,
  onRename,
  onDelete
}: TagManagerSheetProps) {
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  useSheet(onClose)

  const activeTags = tags.filter((tag) => !tag.deletedAt)

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = normalizeTagName(draft)
    if (!name) {
      setMessage('Escribe un nombre para la etiqueta.')
      return
    }

    const duplicate = activeTags.some(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
    if (duplicate) {
      setMessage('Ya existe una etiqueta con ese nombre.')
      return
    }

    if (!onCreate(name)) {
      setMessage('No se pudo crear la etiqueta.')
      return
    }

    setDraft('')
    setMessage(null)
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditDraft(tag.name)
    setConfirmingDelete(null)
    setMessage(null)
  }

  function handleRename(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()

    const name = normalizeTagName(editDraft)
    if (!name) {
      setMessage('Escribe un nombre para la etiqueta.')
      return
    }

    if (!onRename(id, name)) {
      setMessage('Ya existe una etiqueta con ese nombre.')
      return
    }

    setEditingId(null)
    setMessage(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-manager-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line/80 bg-surface/95 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-bright">
              Organiza tu lista
            </p>
            <h2 id="tag-manager-title" className="text-lg font-bold">
              Etiquetas
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
          <form onSubmit={handleCreate} className="flex items-center gap-2">
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
              className="min-w-0 flex-1 rounded-2xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-brand px-3.5 py-2.5 text-sm font-semibold text-ink-bright transition hover:bg-brand-bright active:scale-95 disabled:opacity-40"
            >
              <Icon.Plus className="size-4" />
              Crear
            </button>
          </form>

          {message && <p className="mt-2 text-xs text-warning-softer">{message}</p>}

          {activeTags.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-line border-dashed px-4 py-6 text-center text-sm text-ink-subtle">
              Aún no hay etiquetas. Crea una para agrupar series por temática, género o lo que
              prefieras.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {activeTags.map((tag) => {
                const editing = editingId === tag.id
                const confirming = confirmingDelete === tag.id
                const count = counts[tag.id] ?? 0

                return (
                  <li key={tag.id} className="rounded-2xl border border-line bg-canvas/50 p-3">
                    {editing ? (
                      <form
                        onSubmit={(event) => handleRename(event, tag.id)}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editDraft}
                          maxLength={MAX_TAG_NAME_LENGTH}
                          autoFocus
                          onChange={(event) => setEditDraft(event.target.value)}
                          aria-label={`Nuevo nombre para ${tag.name}`}
                          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
                        />
                        <button
                          type="submit"
                          aria-label="Guardar nombre"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-ink-bright transition hover:bg-brand-bright active:scale-90"
                        >
                          <Icon.Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setMessage(null)
                          }}
                          aria-label="Cancelar"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-soft transition hover:text-ink-bright active:scale-90"
                        >
                          <Icon.X className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-brand-soft">
                          <Icon.Tag className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{tag.name}</p>
                          <p className="text-[11px] text-ink-subtle">
                            {count === 0
                              ? 'Sin series'
                              : count === 1
                                ? '1 serie'
                                : `${count} series`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(tag)}
                          aria-label={`Renombrar ${tag.name}`}
                          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface-raised hover:text-ink-bright active:scale-90"
                        >
                          <Icon.Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirming) {
                              onDelete(tag.id)
                              setConfirmingDelete(null)
                            } else {
                              setConfirmingDelete(tag.id)
                            }
                          }}
                          aria-label={
                            confirming
                              ? `Confirmar borrado de ${tag.name}`
                              : `Borrar ${tag.name}`
                          }
                          className={`grid size-8 shrink-0 place-items-center rounded-full transition active:scale-90 ${
                            confirming
                              ? 'bg-brand text-ink-bright'
                              : 'text-ink-muted hover:bg-surface-raised hover:text-brand-soft'
                          }`}
                        >
                          <Icon.Trash className="size-4" />
                        </button>
                      </div>
                    )}

                    {confirming && !editing && (
                      <p className="mt-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-brand-softest/80">
                        Se quitará la etiqueta «{tag.name}» de{' '}
                        {count === 1 ? '1 serie' : `${count} series`}. Pulsa el cubo otra vez
                        para confirmar.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
