import * as Icon from './Icons'

interface TopBarProps {
  eyebrow: string
  title: string
  canInstall: boolean
  onInstall: () => void
}

export function TopBar({ eyebrow, title, canInstall, onInstall }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-900/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)_+_0.9rem)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 text-lg font-black text-white shadow-lg shadow-rose-500/25">
            C
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
              {eyebrow}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
          </div>
        </div>

        {canInstall && (
          <button
            type="button"
            onClick={onInstall}
            aria-label="Instalar aplicación"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-white active:scale-95"
          >
            <Icon.Download className="size-5" />
          </button>
        )}
      </div>
    </header>
  )
}
