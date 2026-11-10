import type { Filter } from "../../series/types";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "watching", label: "En curso" },
  { value: "planned", label: "Pendientes" },
  { value: "completed", label: "Completadas" },
  { value: "favorites", label: "Favoritas" },
];

interface FilterChipsProps {
  value: Filter;
  onChange: (filter: Filter) => void;
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {filters.map((filter) => {
        const active = value === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            aria-pressed={active}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
              active
                ? "border-transparent bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
