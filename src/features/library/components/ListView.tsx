import type { ReactNode } from 'react'
import { filterSeries, sortSeriesByRecent } from '../../series/model/series'
import type { Filter, Series } from '../../series/types'
import type { Tag } from '../../tags/types'
import { EmptyState } from './EmptyState'
import { FilterChips } from './FilterChips'
import { TagFilterBar } from '../../tags/components/TagFilterBar'
import * as Icon from '../../../shared/components/Icons'
import { SeriesCard } from './SeriesCard'

interface ListViewProps {
  header: ReactNode
  series: Series[]
  tags: Tag[]
  /** Id de la etiqueta activa, o `'all'`. */
  tagFilter: string
  /** Filtro extra por estado o favoritas. */
  listFilter: Filter
  onTagFilterChange: (value: string) => void
  onListFilterChange: (filter: Filter) => void
  onManageTags: () => void
  onOpen: (series: Series) => void
  onToggleFavorite: (id: string) => void
  onAdd: () => void
}

export function ListView({
  header,
  series,
  tags,
  tagFilter,
  listFilter,
  onTagFilterChange,
  onListFilterChange,
  onManageTags,
  onOpen,
  onToggleFavorite,
  onAdd
}: ListViewProps) {
  const tagged =
    tagFilter === 'all'
      ? series
      : series.filter((item) => (item.tagIds ?? []).includes(tagFilter))
  const visible = sortSeriesByRecent(filterSeries(tagged, '', listFilter))
  const activeTag = tags.find((tag) => tag.id === tagFilter && !tag.deletedAt)

  return (
    <>
      {header}

      {series.length === 0 ? (
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
        <div className="px-4 pt-5">
          <TagFilterBar
            tags={tags}
            value={tagFilter}
            onChange={onTagFilterChange}
            onManage={onManageTags}
          />

          <FilterChips value={listFilter} onChange={onListFilterChange} />

          {visible.length === 0 ? (
            <EmptyState
              icon={<Icon.Tag className="size-6" />}
              title="Ninguna serie coincide"
              description={
                activeTag
                  ? `No hay series con la etiqueta «${activeTag.name}» que cumplan el filtro seleccionado.`
                  : 'No hay series que cumplan el filtro seleccionado.'
              }
              actionLabel="Ver todas"
              onAction={() => {
                onTagFilterChange('all')
                onListFilterChange('all')
              }}
            />
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {visible.map((item) => (
                <SeriesCard
                  key={item.id}
                  series={item}
                  tags={tags}
                  onOpen={onOpen}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
