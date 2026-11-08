import { statusMeta, statusOrder } from '../lib/status'
import type { GoogleUser, Series, SeriesStatus } from '../types'
import { EmptyState } from './EmptyState'
import * as Icon from './Icons'
import { SeriesCard } from './SeriesCard'
import { TopBar } from './TopBar'

interface ListViewProps {
  groups: Record<SeriesStatus, Series[]>
  canInstall: boolean
  googleUser: GoogleUser | null
  syncDirty: boolean
  syncBusy: boolean
  onOpen: (series: Series) => void
  onToggleFavorite: (id: string) => void
  onInstall: () => void
  onAdd: () => void
  onOpenAccount: () => void
}

export function ListView({
  groups,
  canInstall,
  googleUser,
  syncDirty,
  syncBusy,
  onOpen,
  onToggleFavorite,
  onInstall,
  onAdd,
  onOpenAccount,
}: ListViewProps) {
  const savedCount = statusOrder.reduce(
    (total, status) => total + groups[status].length,
    0,
  )

  return (
    <>
      <TopBar
        eyebrow={`${savedCount} ${savedCount === 1 ? 'serie guardada' : 'series guardadas'}`}
        title="Mi lista"
        canInstall={canInstall}
        onInstall={onInstall}
        user={googleUser}
        syncDirty={syncDirty}
        syncBusy={syncBusy}
        onOpenAccount={onOpenAccount}
      />

      {savedCount === 0 ? (
        <div className="px-4 pt-5">
          <EmptyState
            icon={<Icon.Bookmark className="size-6" />}
            title="Tu lista está vacía"
            description="Añade las series que estás viendo, las que quieres empezar o las que ya terminaste. Todo se guarda en tu dispositivo."
            actionLabel="Añadir serie"
            onAction={onAdd}
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
                  {list.map((item) => (
                    <SeriesCard
                      key={item.id}
                      series={item}
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
