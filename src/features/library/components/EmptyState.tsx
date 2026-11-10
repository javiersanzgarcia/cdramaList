import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-zinc-800/80 text-zinc-400">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-zinc-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition active:scale-95 hover:bg-rose-400"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
