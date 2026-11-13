import * as Icon from '../../../shared/components/Icons'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative mt-4">
      <Icon.Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-subtle" />
      <input
        id="series-search"
        name="series-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Busca por título o canal…"
        aria-label="Buscar series"
        autoComplete="off"
        enterKeyHint="search"
        className="w-full rounded-2xl border border-line bg-surface/80 py-3 pl-11 pr-11 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand/60 focus:ring-2 focus:ring-brand/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Borrar búsqueda"
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-surface-raised hover:text-ink-bright"
        >
          <Icon.X className="size-4" />
        </button>
      )}
    </div>
  )
}
