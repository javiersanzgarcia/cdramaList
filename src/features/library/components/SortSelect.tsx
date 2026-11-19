import type { SeriesSort } from '../../series/types'
import * as Icon from '../../../shared/components/Icons'

const options: { value: SeriesSort; label: string }[] = [
  { value: 'recent', label: 'Recientes' },
  { value: 'created', label: 'Creadas' },
  { value: 'title', label: 'Título A–Z' },
  { value: 'progress', label: 'Progreso' },
  { value: 'favorites', label: 'Favoritas' }
]

interface SortSelectProps {
  value: SeriesSort
  onChange: (value: SeriesSort) => void
}

/** Ordena la cuadrícula de «Mi lista» junto al filtro de estado. */
export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="relative mt-3 min-w-0 flex-1">
      <select
        id="series-sort"
        name="series-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as SeriesSort)}
        aria-label="Ordenar series"
        className="w-full cursor-pointer appearance-none truncate rounded-full border border-line bg-surface/70 py-2 pl-3 pr-8 text-sm font-semibold text-ink outline-none transition hover:border-line-strong focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface text-ink">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-ink-subtle">
        <Icon.ChevronDown className="size-4" />
      </span>
    </div>
  )
}
