import type { ReactNode } from 'react'
import { statusMeta, statusOrder } from '../../series/model/status'
import type { Series, SeriesStatus } from '../../series/types'
import { EmptyState } from './EmptyState'
import * as Icon from '../../../shared/components/Icons'
import { SeriesCard } from './SeriesCard'

interface ListViewProps {
  header: ReactNode
  groups: Record<SeriesStatus, Series[]>
  onOpen: (series: Series) => void
  onToggleFavorite: (id: string) => void
  onAdd: () => void
}

export function ListView({
  header,
  groups,
  onOpen,
  onToggleFavorite,
  onAdd
}: ListViewProps) {
  const savedCount = statusOrder.reduce(
    (total, status) => total + groups[status].length,
    0
  )

  return (
    <>
      {header}

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
                  <h2 className="text-sm font-semibold text-ink-strong">
                    {meta.label}
                  </h2>
                  <span className="text-xs text-ink-subtle">{list.length}</span>
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
