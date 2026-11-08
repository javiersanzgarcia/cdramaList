import { continueWatching } from '../lib/series'
import type { Filter, GoogleUser, Series } from '../types'
import { ContinueCard } from './ContinueCard'
import { EmptyState } from './EmptyState'
import { FilterChips } from './FilterChips'
import * as Icon from './Icons'
import { SearchBar } from './SearchBar'
import { SeriesCard } from './SeriesCard'
import { TopBar } from './TopBar'

interface HomeViewProps {
  series: Series[]
  allSeries: Series[]
  query: string
  filter: Filter
  canInstall: boolean
  apiKeyConfigured: boolean
  googleUser: GoogleUser | null
  syncDirty: boolean
  syncBusy: boolean
  onQueryChange: (value: string) => void
  onFilterChange: (filter: Filter) => void
  onOpen: (series: Series) => void
  onPlay: (series: Series, index: number) => void
  onToggleFavorite: (id: string) => void
  onAdd: () => void
  onInstall: () => void
  onOpenSettings: () => void
  onOpenAccount: () => void
}

export function HomeView({
  series,
  allSeries,
  query,
  filter,
  canInstall,
  apiKeyConfigured,
  googleUser,
  syncDirty,
  syncBusy,
  onQueryChange,
  onFilterChange,
  onOpen,
  onPlay,
  onToggleFavorite,
  onAdd,
  onInstall,
  onOpenSettings,
  onOpenAccount,
}: HomeViewProps) {
  const continueList = continueWatching(allSeries).slice(0, 8)
  const showContinue = query.trim().length === 0 && filter === 'all' && continueList.length > 0
  const sectionTitle =
    filter === 'favorites'
      ? 'Tus favoritas'
      : filter === 'all'
        ? 'Tus series'
        : 'Resultados'

  function clearFilters() {
    onQueryChange('')
    onFilterChange('all')
  }

  return (
    <>
      <TopBar
        eyebrow="Tus historias, parte a parte"
        title="CdramaList"
        canInstall={canInstall}
        onInstall={onInstall}
        user={googleUser}
        syncDirty={syncDirty}
        syncBusy={syncBusy}
        onOpenAccount={onOpenAccount}
      />

      <section className="px-4 pt-5">
        <h2 className="text-2xl font-bold tracking-tight">¿Qué vemos hoy?</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Pega un enlace de YouTube y reúne todas las partes de tu historia.
        </p>

        <button
          type="button"
          onClick={onAdd}
          className="group mt-4 flex w-full items-center gap-3 rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-amber-400/10 p-3.5 text-left transition active:scale-[0.99]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 text-white shadow-lg shadow-rose-500/25">
            <Icon.Plus className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-100">
              Añadir una serie
            </span>
            <span className="block text-xs text-zinc-400">
              Pega un enlace de YouTube y busca todas las partes.
            </span>
          </span>
          <Icon.ChevronRight className="size-5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5" />
        </button>

        {!apiKeyConfigured && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-left text-xs text-amber-200/85 transition hover:border-amber-400/40"
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
            <h3 className="text-sm font-semibold text-zinc-200">Continuar viendo</h3>
            <span className="shrink-0 text-xs text-zinc-500">
              {continueList.length}{' '}
              {continueList.length === 1 ? 'serie' : 'series'}
            </span>
          </div>

          <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {continueList.map((item) => (
              <ContinueCard
                key={item.id}
                series={item}
                onPlay={onPlay}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">{sectionTitle}</h3>
          <span className="shrink-0 text-xs text-zinc-500">
            {series.length} {series.length === 1 ? 'serie' : 'series'}
          </span>
        </div>

        {series.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {series.map((item) => (
              <SeriesCard
                key={item.id}
                series={item}
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
