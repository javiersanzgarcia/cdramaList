import type React from 'react'
import type { ReactNode } from 'react'
import { filterSeries, sortSeries } from '../../series/model/series'
import type { Filter, Series, SeriesSort } from '../../series/types'
import type { Tag } from '../../tags/types'
import { EmptyState } from './EmptyState'
import { FilterChips } from './FilterChips'
import { SearchBar } from './SearchBar'
import { SortSelect } from './SortSelect'
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
  /** Texto a buscar por título, alias o canal dentro de la lista. */
  query: string
  onQueryChange: (value: string) => void
  /** Criterio de ordenación de la cuadrícula. */
  sort: SeriesSort
  onSortChange: (value: SeriesSort) => void
  onTagFilterChange: (value: string) => void
  onListFilterChange: (filter: Filter) => void
  onManageTags: () => void
  onOpen: (series: Series) => void
  onToggleFavorite: (id: string) => void
  onAdd: () => void
}

export const ListView: React.FC<ListViewProps> = ({
  header,
  series,
  tags,
  tagFilter,
  listFilter,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onTagFilterChange,
  onListFilterChange,
  onManageTags,
  onOpen,
  onToggleFavorite,
  onAdd
}) => {
  const tagged =
    tagFilter === 'all'
      ? series
      : series.filter((item) => (item.tagIds ?? []).includes(tagFilter))
  const visible = sortSeries(filterSeries(tagged, query, listFilter), sort)
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

          <SearchBar value={query} onChange={onQueryChange} />
          <div className="flex gap-2">
            <FilterChips value={listFilter} onChange={onListFilterChange} />
            <SortSelect value={sort} onChange={onSortChange} />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Icon.Tag className="size-6" />}
              title="Ninguna serie coincide"
              description={
                query.trim()
                  ? `No hay series que coincidan con «${query.trim()}» con los filtros seleccionados.`
                  : activeTag
                    ? `No hay series con la etiqueta «${activeTag.name}» que cumplan el filtro seleccionado.`
                    : 'No hay series que cumplan el filtro seleccionado.'
              }
              actionLabel="Ver todas"
              onAction={() => {
                onQueryChange('')
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
