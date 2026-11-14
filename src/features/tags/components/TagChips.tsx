import type { Tag } from '../types'
import * as Icon from '../../../shared/components/Icons'

interface TagChipsProps {
  tags: Tag[]
  /** Número máximo de etiquetas visibles; el resto se resume en «+N». */
  max?: number
  className?: string
  onRemove?: (tagId: string) => void
}

export function TagChips({ tags, max, className = '', onRemove }: TagChipsProps) {
  if (tags.length === 0) return null

  const visible = max == null ? tags : tags.slice(0, max)
  const hidden = tags.length - visible.length

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((tag) => (
        <li key={tag.id}>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(tag.id)}
              aria-label={`Quitar la etiqueta ${tag.name}`}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-raised/70 px-2 py-0.5 text-[10px] font-semibold text-ink-muted transition hover:border-brand/40 hover:text-brand-soft active:scale-95"
            >
              {tag.name}
              <Icon.X className="size-2.5" />
            </button>
          ) : (
            <span className="inline-flex max-w-full truncate rounded-full border border-line bg-surface-raised/70 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
              {tag.name}
            </span>
          )}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <span className="rounded-full border border-line/60 px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle">
            +{hidden}
          </span>
        </li>
      )}
    </ul>
  )
}
