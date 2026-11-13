import type { Tab } from '../../app/types'
import * as Icon from './Icons'

const items: { value: Tab; label: string; icon: typeof Icon.Home }[] = [
  { value: 'home', label: 'Inicio', icon: Icon.Home },
  { value: 'list', label: 'Mi lista', icon: Icon.Bookmark },
  { value: 'settings', label: 'Ajustes', icon: Icon.Settings }
]

interface BottomNavProps {
  tab: Tab
  savedCount: number
  onChange: (tab: Tab) => void
}

export function BottomNav({ tab, savedCount, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-line/80 bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const active = tab === item.value
          const TabIcon = item.icon

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active
                  ? 'text-brand-bright'
                  : 'text-ink-subtle hover:text-ink-soft'
              }`}
            >
              <span
                className={`relative grid h-8 w-12 place-items-center rounded-full transition ${
                  active ? 'bg-brand/10' : ''
                }`}
              >
                <TabIcon className="size-5" />
                {item.value === 'list' && savedCount > 0 && (
                  <span className="absolute right-1.5 top-0 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold leading-4 text-ink-bright">
                    {savedCount}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
