import * as Icon from '../../../shared/components/Icons'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative mt-4">
      <Icon.Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
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
        className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-3 pl-11 pr-11 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Borrar búsqueda"
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <Icon.X className="size-4" />
        </button>
      )}
    </div>
  )
}
