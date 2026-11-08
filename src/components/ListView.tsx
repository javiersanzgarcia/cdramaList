import { statusMeta, statusOrder } from '../lib/status'
import type { Drama, StatusMap, WatchStatus } from '../types'
import { DramaCard } from './DramaCard'
import { EmptyState } from './EmptyState'
import * as Icon from './Icons'
import { TopBar } from './TopBar'

interface ListViewProps {
  groups: Record<WatchStatus, Drama[]>
  statuses: StatusMap
  favorites: string[]
  canInstall: boolean
  onOpen: (drama: Drama) => void
  onToggleFavorite: (id: string) => void
  onInstall: () => void
  onExplore: () => void
}

export function ListView({
  groups,
  statuses,
  favorites,
  canInstall,
  onOpen,
  onToggleFavorite,
  onInstall,
  onExplore,
}: ListViewProps) {
  const savedCount = statusOrder.reduce((total, status) => total + groups[status].length, 0)

  return (
    <>
      <TopBar
        eyebrow={`${savedCount} ${savedCount === 1 ? 'drama guardado' : 'dramas guardados'}`}
        title="Mi lista"
        canInstall={canInstall}
        onInstall={onInstall}
      />

      {savedCount === 0 ? (
        <div className="px-4 pt-5">
          <EmptyState
            icon={<Icon.Bookmark className="size-6" />}
            title="Tu lista está vacía"
            description="Marca los dramas que estás viendo, los que quieres empezar o los que ya terminaste. Todo se guarda en tu dispositivo."
            actionLabel="Explorar dramas"
            onAction={onExplore}
          />
        </div>
      ) : (
        <div className="space-y-6 px-4 pt-5">
          {statusOrder.map((status) => {
            const list = groups[status]
            if (list.length === 0) return null
            const meta = statusMeta[status]

            return (
              <section key={status} className="animate-rise">
                <div className="mb-2.5 flex items-center gap-2 px-0.5">
                  <span className={`size-2 rounded-full ${meta.dot}`} />
                  <h2 className="text-sm font-semibold text-zinc-200">{meta.label}</h2>
                  <span className="text-xs text-zinc-500">{list.length}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {list.map((drama) => (
                    <DramaCard
                      key={drama.id}
                      drama={drama}
                      status={statuses[drama.id]}
                      isFavorite={favorites.includes(drama.id)}
                      onOpen={onOpen}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
