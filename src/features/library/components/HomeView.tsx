import { useEffect, useRef, useState, type ReactNode } from 'react'
import { continueWatching } from '../../series/model/series'
import type { Filter, Series } from '../../series/types'
import type { Tag } from '../../tags/types'
import { ContinueCard } from './ContinueCard'
import { EmptyState } from './EmptyState'
import { FilterChips } from './FilterChips'
import * as Icon from '../../../shared/components/Icons'
import { SearchBar } from './SearchBar'
import { SeriesCard } from './SeriesCard'

interface HomeViewProps {
  header: ReactNode
  series: Series[]
  allSeries: Series[]
  tags: Tag[]
  query: string
  filter: Filter
  apiKeyConfigured: boolean
  onQueryChange: (value: string) => void
  onFilterChange: (filter: Filter) => void
  onOpen: (series: Series) => void
  onPlay: (series: Series, index: number) => void
  onToggleFavorite: (id: string) => void
  onAdd: () => void
  onRefreshFavorites: () => Promise<{
    updated: number
    failed: number
    warnings: string[]
    syncFailed: boolean
  }>
  onOpenSettings: () => void
}

export function HomeView({
  header,
  series,
  allSeries,
  tags,
  query,
  filter,
  apiKeyConfigured,
  onQueryChange,
  onFilterChange,
  onOpen,
  onPlay,
  onToggleFavorite,
  onAdd,
  onRefreshFavorites,
  onOpenSettings
}: HomeViewProps) {
  const continueList = continueWatching(allSeries).slice(0, 8)
  const showContinue = query.trim().length === 0 && filter === 'all' && continueList.length > 0
  const continueScrollRef = useRef<HTMLDivElement>(null)
  const [favoritesBusy, setFavoritesBusy] = useState(false)
  const [favoritesMessage, setFavoritesMessage] = useState<{
    kind: 'info' | 'error'
    text: string
  } | null>(null)
  const favoriteList = allSeries.filter((item) => item.favorite)

  // La barra de scroll está oculta, así que en desktop la rueda del ratón no
  // desplaza la fila horizontal. La convertimos en scroll horizontal mientras
  // quede contenido por mostrar; en los extremos dejamos libre el scroll vertical.
  useEffect(() => {
    const element = continueScrollRef.current
    if (!element) return
    const scroller: HTMLDivElement = element

    function handleWheel(event: WheelEvent) {
      if (event.deltaY === 0 || event.deltaX !== 0) return
      if (scroller.scrollWidth <= scroller.clientWidth) return

      const atStart = scroller.scrollLeft <= 0
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1
      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return

      event.preventDefault()
      scroller.scrollLeft += event.deltaY
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [showContinue])

  const sectionTitle =
    filter === 'favorites' ? 'Tus favoritas' : filter === 'all' ? 'Tus series' : 'Resultados'

  function clearFilters() {
    onQueryChange('')
    onFilterChange('all')
  }

  async function handleRefreshFavorites() {
    if (favoritesBusy) return

    setFavoritesBusy(true)
    setFavoritesMessage(null)

    try {
      const result = await onRefreshFavorites()

      // Con novedades la ficha se abre sola; solo se muestra el aviso si no hay
      // ninguna o si hubo problemas que el usuario deba conocer (avisos de la
      // búsqueda o fallo al sincronizar con Drive).
      const hasNotices = result.warnings.length > 0 || result.syncFailed
      if (result.updated > 0 && !hasNotices) return

      const lines: string[] = []
      if (result.updated > 0) {
        lines.push(
          `Novedades en ${result.updated} ${result.updated === 1 ? 'serie' : 'series'}.`
        )
      } else if (result.failed > 0) {
        lines.push(
          `No se ${result.failed === 1 ? 'pudo revisar 1 serie' : `pudieron revisar ${result.failed} series`}. Ninguna tiene novedades.`
        )
      } else {
        lines.push('No hay capítulos nuevos ni candidatos en tus favoritas.')
      }
      if (result.syncFailed) {
        lines.push('No se pudo sincronizar con Google Drive.')
      }
      lines.push(...result.warnings)

      setFavoritesMessage({
        kind: result.failed > 0 || result.syncFailed ? 'error' : 'info',
        text: lines.join(' ')
      })
    } catch (caught) {
      setFavoritesMessage({
        kind: 'error',
        text:
          caught instanceof Error
            ? caught.message
            : 'No se pudieron actualizar las favoritas. Inténtalo de nuevo.'
      })
    } finally {
      setFavoritesBusy(false)
    }
  }

  return (
    <>
      {header}

      <section className="px-4 pt-5">
        <h2 className="text-2xl font-bold tracking-tight">¿Qué vemos hoy?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Pega un enlace de YouTube y reúne todas las partes de tu historia.
        </p>

        <button
          type="button"
          onClick={onAdd}
          className="group mt-4 flex w-full items-center gap-3 rounded-2xl border border-brand/25 bg-linear-to-r from-brand/15 via-brand/5 to-warning/10 p-3.5 text-left transition active:scale-[0.99]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand to-warning text-ink-bright shadow-lg shadow-brand/25">
            <Icon.Plus className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Crear una serie nueva</span>
            <span className="block text-xs text-ink-muted">
              Empieza una historia nueva desde un vídeo o una lista.
            </span>
          </span>
          <Icon.ChevronRight className="size-5 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5" />
        </button>

        {!apiKeyConfigured && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-warning/20 bg-warning/5 px-3 py-2.5 text-left text-xs text-warning-softer/85 transition hover:border-warning/40"
          >
            <Icon.Key className="size-4 shrink-0" />
            <span className="flex-1">
              Configura tu clave de YouTube para encontrar partes automáticamente.
            </span>
            <Icon.ChevronRight className="size-4 shrink-0" />
          </button>
        )}

        <SearchBar value={query} onChange={onQueryChange} />
        <FilterChips value={filter} onChange={onFilterChange} />
      </section>

      {showContinue && (
        <section className="px-4 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink-strong">Continuar viendo</h3>
            <span className="shrink-0 text-xs text-ink-subtle">
              {continueList.length} {continueList.length === 1 ? 'serie' : 'series'}
            </span>
          </div>

          <div
            ref={continueScrollRef}
            className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1"
          >
            {continueList.map((item) => (
              <ContinueCard key={item.id} series={item} onPlay={onPlay} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-strong">{sectionTitle}</h3>
          <span className="shrink-0 text-xs text-ink-subtle">
            {series.length} {series.length === 1 ? 'serie' : 'series'}
          </span>
        </div>

        {filter === 'favorites' && favoriteList.length > 0 && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => void handleRefreshFavorites()}
              disabled={favoritesBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-softer transition hover:border-brand/50 hover:bg-brand/15 hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon.RefreshCw className={`size-4 ${favoritesBusy ? 'animate-spin' : ''}`} />
              {favoritesBusy ? 'Buscando novedades…' : 'Actualizar todas las favoritas'}
            </button>

            {favoritesMessage && (
              <p
                className={`rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
                  favoritesMessage.kind === 'error'
                    ? 'border-brand/20 bg-brand/10 text-brand-softer'
                    : 'border-line-strong bg-canvas/60 text-ink-soft'
                }`}
              >
                {favoritesMessage.text}
              </p>
            )}
          </div>
        )}

        {series.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {series.map((item) => (
              <SeriesCard
                key={item.id}
                series={item}
                tags={tags}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : allSeries.length === 0 ? (
          <EmptyState
            icon={<Icon.Youtube className="size-6" />}
            title="Tu lista está vacía"
            description="Añade una serie pegando un enlace de YouTube. La app buscará las partes y guardará tu progreso."
            actionLabel="Añadir serie"
            onAction={onAdd}
          />
        ) : (
          <EmptyState
            icon={<Icon.Search className="size-6" />}
            title="Sin resultados"
            description={
              query.trim().length > 0
                ? `No encontramos series para «${query}». Prueba con otro título o canal.`
                : 'Todavía no tienes series en este apartado. Marca una como en curso, pendiente o completada.'
            }
            actionLabel="Ver todas las series"
            onAction={clearFilters}
          />
        )}
      </section>
    </>
  )
}
