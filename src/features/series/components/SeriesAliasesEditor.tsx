import { useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeAliases } from '../model/series'
import { MAX_SERIES_ALIASES } from '../model/constants'
import type { Series } from '../types'
import * as Icon from '../../../shared/components/Icons'

interface SeriesAliasesEditorProps {
  series: Series
  onUpdateAliases: (seriesId: string, aliases: string[]) => void
}

export function SeriesAliasesEditor({ series, onUpdateAliases }: SeriesAliasesEditorProps) {
  const [aliasDraft, setAliasDraft] = useState('')
  const [aliasMessage, setAliasMessage] = useState<string | null>(null)
  const aliases = series.aliases ?? []

  function handleAddAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const alias = aliasDraft.trim().replace(/\s+/g, ' ')
    if (alias.length < 2) return

    const key = alias.toLowerCase()
    if (key === series.title.trim().toLowerCase()) {
      setAliasMessage('El alias no puede ser igual al título principal.')
      return
    }

    if (aliases.some((item) => item.toLowerCase() === key)) {
      setAliasMessage('Ese alias ya está añadido.')
      return
    }

    if (aliases.length >= MAX_SERIES_ALIASES) {
      setAliasMessage(`Puedes añadir hasta ${MAX_SERIES_ALIASES} alias.`)
      return
    }

    onUpdateAliases(series.id, normalizeAliases([...aliases, alias]))
    setAliasDraft('')
    setAliasMessage(null)
  }

  function removeAlias(alias: string) {
    onUpdateAliases(
      series.id,
      aliases.filter((item) => item !== alias)
    )
    setAliasMessage(null)
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-canvas/60 p-3">
      <div className="flex items-center gap-2">
        <Icon.Search className="size-4 text-brand-soft" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Alias de búsqueda
        </h3>
        <span className="ml-auto text-[10px] font-medium text-ink-faint">
          {aliases.length}/{MAX_SERIES_ALIASES}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
        Otros títulos con los que se publica esta serie (traducciones o títulos alternativos).
        Se buscarán junto al título principal al actualizar.
      </p>

      {aliases.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <li
              key={alias}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-raised/80 py-1 pl-2.5 pr-1 text-[11px] text-ink-strong"
            >
              <span className="truncate">{alias}</span>
              <button
                type="button"
                onClick={() => removeAlias(alias)}
                aria-label={`Quitar alias ${alias}`}
                className="grid size-5 shrink-0 place-items-center rounded-full text-ink-subtle transition hover:bg-surface-strong hover:text-ink-bright active:scale-90"
              >
                <Icon.X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAddAlias} className="mt-2 flex gap-2">
        <input
          id="series-alias-input"
          name="series-alias"
          value={aliasDraft}
          onChange={(event) => {
            setAliasDraft(event.target.value)
            setAliasMessage(null)
          }}
          placeholder="Ej. Black Rain Apocalypse"
          aria-label="Nuevo alias"
          autoComplete="off"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={aliasDraft.trim().length < 2}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface-raised px-3 py-2 text-[11px] font-semibold text-ink-strong transition hover:bg-surface-strong active:scale-95 disabled:opacity-40"
        >
          <Icon.Plus className="size-3.5" />
          Añadir
        </button>
      </form>

      {aliasMessage && (
        <p className="mt-1.5 text-[11px] text-warning-softer/80">{aliasMessage}</p>
      )}
    </div>
  )
}
