import type { Filter } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'planned', label: 'Pendientes' },
  { value: 'watching', label: 'En curso' },
  { value: 'completed', label: 'Completadas' },
  { value: 'favorites', label: 'Favoritas' }
]

interface FilterChipsProps {
  value: Filter
  onChange: (filter: Filter) => void
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div className="relative mt-3">
      <select
        id="series-filter"
        name="series-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as Filter)}
        aria-label="Filtrar series"
        className="w-full cursor-pointer appearance-none rounded-full border border-zinc-800 bg-zinc-900/70 py-2 pl-4 pr-11 text-sm font-semibold text-zinc-100 outline-none transition hover:border-zinc-700 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/25"
      >
        {filters.map((filter) => (
          <option
            key={filter.value}
            value={filter.value}
            className="bg-zinc-900 text-zinc-100"
          >
            {filter.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-zinc-500">
        <Icon.ChevronDown className="size-4" />
      </span>
    </div>
  )
}
