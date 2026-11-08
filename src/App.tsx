import { useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { DramaSheet } from './components/DramaSheet'
import { HomeView } from './components/HomeView'
import { ListView } from './components/ListView'
import { SettingsView } from './components/SettingsView'
import { dramas } from './data/dramas'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { usePersistentState } from './hooks/usePersistentState'
import type { Drama, Filter, StatusMap, Tab, WatchStatus } from './types'

export default function App() {
  const [statuses, setStatuses] = usePersistentState<StatusMap>('cdramalist:statuses', {})
  const [favorites, setFavorites] = usePersistentState<string[]>('cdramalist:favorites', [])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('home')
  const [selected, setSelected] = useState<Drama | null>(null)
  const { canInstall, promptInstall } = useInstallPrompt()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  const filteredDramas = useMemo(() => {
    const term = query.trim().toLowerCase()

    return dramas.filter((drama) => {
      const matchesQuery =
        term.length === 0 ||
        drama.title.toLowerCase().includes(term) ||
        drama.chineseTitle.includes(query.trim()) ||
        drama.genres.some((genre) => genre.toLowerCase().includes(term))

      const matchesFilter =
        filter === 'all' ||
        (filter === 'favorites' ? favorites.includes(drama.id) : statuses[drama.id] === filter)

      return matchesQuery && matchesFilter
    })
  }, [query, filter, favorites, statuses])

  const savedDramas = useMemo(
    () => dramas.filter((drama) => statuses[drama.id] !== undefined),
    [statuses],
  )

  const grouped = useMemo(() => {
    const groups: Record<WatchStatus, Drama[]> = { watching: [], planned: [], completed: [] }

    for (const drama of savedDramas) {
      groups[statuses[drama.id]].push(drama)
    }

    return groups
  }, [savedDramas, statuses])

  function setStatus(id: string, status: WatchStatus) {
    setStatuses((current) => ({ ...current, [id]: status }))
  }

  function clearStatus(id: string) {
    setStatuses((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function resetProgress() {
    setStatuses({})
    setFavorites([])
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-950 pb-24">
      <main className="flex-1">
        {tab === 'home' && (
          <HomeView
            dramas={filteredDramas}
            query={query}
            filter={filter}
            statuses={statuses}
            favorites={favorites}
            canInstall={canInstall}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onOpen={setSelected}
            onToggleFavorite={toggleFavorite}
            onInstall={promptInstall}
          />
        )}

        {tab === 'list' && (
          <ListView
            groups={grouped}
            statuses={statuses}
            favorites={favorites}
            canInstall={canInstall}
            onOpen={setSelected}
            onToggleFavorite={toggleFavorite}
            onInstall={promptInstall}
            onExplore={() => setTab('home')}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            savedCount={savedDramas.length}
            favoritesCount={favorites.length}
            canInstall={canInstall}
            onInstall={promptInstall}
            onReset={resetProgress}
          />
        )}
      </main>

      <BottomNav tab={tab} savedCount={savedDramas.length} onChange={setTab} />

      {selected && (
        <DramaSheet
          drama={selected}
          status={statuses[selected.id]}
          isFavorite={favorites.includes(selected.id)}
          onClose={() => setSelected(null)}
          onStatusChange={(status) => setStatus(selected.id, status)}
          onClearStatus={() => clearStatus(selected.id)}
          onToggleFavorite={() => toggleFavorite(selected.id)}
        />
      )}
    </div>
  )
}
