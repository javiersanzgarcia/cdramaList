import type { Tag } from '../types'
import * as Icon from '../../../shared/components/Icons'

interface TagFilterBarProps {
  tags: Tag[]
  /** Id de la etiqueta activa, o `'all'` para no filtrar. */
  value: string
  onChange: (value: string) => void
  onManage: () => void
}

/** Filtro horizontal por etiqueta para «Mi lista». */
export function TagFilterBar({ tags, value, onChange, onManage }: TagFilterBarProps) {
  const activeTags = tags.filter((tag) => !tag.deletedAt)

  return (
    <div className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4">
      <div className="flex w-max items-center gap-1.5 pb-0.5">
        <button
          type="button"
          onClick={() => onChange('all')}
          aria-pressed={value === 'all'}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
            value === 'all'
              ? 'border-brand bg-brand/15 text-brand-softest'
              : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-bright'
          }`}
        >
          Todas
        </button>

        {activeTags.map((tag) => {
          const active = value === tag.id

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onChange(tag.id)}
              aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
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

        <button
          type="button"
          onClick={onManage}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line/70 border-dashed px-3 py-1.5 text-xs font-semibold text-ink-subtle transition hover:border-line-strong hover:text-ink-bright active:scale-95"
        >
          <Icon.Pencil className="size-3" />
          Gestionar
        </button>
      </div>
    </div>
  )
}
