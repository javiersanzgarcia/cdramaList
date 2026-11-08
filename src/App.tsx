import { useEffect, useMemo, useState } from 'react'
import { AddSeriesSheet } from './components/AddSeriesSheet'
import { BottomNav } from './components/BottomNav'
import { HomeView } from './components/HomeView'
import * as Icon from './components/Icons'
import { ListView } from './components/ListView'
import { PlayerSheet } from './components/PlayerSheet'
import { SeriesSheet } from './components/SeriesSheet'
import { SettingsView } from './components/SettingsView'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { usePersistentState } from './hooks/usePersistentState'
import {
  createSeries,
  filterSeries,
  groupSeries,
  mergeParts,
  mergeSeries,
  watchedCount,
} from './lib/series'
import type { Filter, Part, Series, SeriesDraft, Tab } from './types'

interface PlayerState {
  seriesId: string
  index: number
}

function isSeries(value: unknown): value is Series {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    Array.isArray(item.parts) &&
    Array.isArray(item.watched)
  )
}

function normalizeSeries(value: Series): Series {
  const now = Date.now()

  return {
    id: value.id,
    title: value.title.trim() || 'Serie sin título',
    channelId: value.channelId,
    channelTitle: value.channelTitle || 'YouTube',
    channelUrl: value.channelUrl,
    thumbnail: value.thumbnail,
    parts: value.parts
      .filter(
        (part) => part && typeof part.videoId === 'string' && part.videoId.length > 0,
      )
      .map((part) => ({
        videoId: part.videoId,
        title:
          typeof part.title === 'string' && part.title.length > 0
            ? part.title
            : 'Vídeo de YouTube',
        partNumber:
          typeof part.partNumber === 'number' ? part.partNumber : undefined,
        totalParts: typeof part.totalParts === 'number' ? part.totalParts : undefined,
        isFinal: Boolean(part.isFinal),
        durationSeconds:
          typeof part.durationSeconds === 'number' ? part.durationSeconds : undefined,
        publishedAt:
          typeof part.publishedAt === 'string' ? part.publishedAt : undefined,
        thumbnail: typeof part.thumbnail === 'string' ? part.thumbnail : undefined,
        addedAt: typeof part.addedAt === 'number' ? part.addedAt : now,
      })),
    watched: value.watched.filter((id) => typeof id === 'string'),
    favorite: Boolean(value.favorite),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    lastOpenedAt:
      typeof value.lastOpenedAt === 'number' ? value.lastOpenedAt : undefined,
  }
}

function combineSeries(current: Series, incoming: Series): Series {
  return {
    ...current,
    ...incoming,
    id: current.id,
    createdAt: Math.min(current.createdAt, incoming.createdAt),
    favorite: current.favorite || incoming.favorite,
    parts: mergeParts(current.parts, incoming.parts),
    watched: [...new Set([...current.watched, ...incoming.watched])],
    updatedAt: Date.now(),
  }
}

export default function App() {
  const [series, setSeries] = usePersistentState<Series[]>(
    'cdramalist:series',
    [],
    (value) =>
      Array.isArray(value) ? value.filter(isSeries).map(normalizeSeries) : [],
  )
  const [apiKey, setApiKey] = usePersistentState<string>(
    'cdramalist:apiKey',
    '',
    (value) => (typeof value === 'string' ? value : ''),
  )
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('home')
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [player, setPlayer] = useState<PlayerState | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addTargetId, setAddTargetId] = useState<string | null>(null)
  const { canInstall, promptInstall } = useInstallPrompt()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  const filtered = useMemo(
    () => filterSeries(series, query, filter),
    [series, query, filter],
  )
  const groups = useMemo(() => groupSeries(series), [series])

  const selectedSeries = selectedSeriesId
    ? (series.find((item) => item.id === selectedSeriesId) ?? null)
    : null
  const playerSeries = player
    ? (series.find((item) => item.id === player.seriesId) ?? null)
    : null
  const addTarget = addTargetId
    ? (series.find((item) => item.id === addTargetId) ?? null)
    : null

  const watchedParts = useMemo(
    () => series.reduce((total, item) => total + watchedCount(item), 0),
    [series],
  )
  const favoriteCount = useMemo(
    () => series.filter((item) => item.favorite).length,
    [series],
  )

  function touchSeries(id: string) {
    setSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, lastOpenedAt: Date.now() } : item,
      ),
    )
  }

  function openSeries(item: Series) {
    setSelectedSeriesId(item.id)
    touchSeries(item.id)
  }

  function playSeries(item: Series, index: number) {
    const safeIndex = Math.min(
      Math.max(index, 0),
      Math.max(item.parts.length - 1, 0),
    )
    setPlayer({ seriesId: item.id, index: safeIndex })
    touchSeries(item.id)
  }

  function toggleFavorite(id: string) {
    setSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    )
  }

  function setWatched(seriesId: string, videoId: string, watched: boolean) {
    setSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item

        const already = item.watched.includes(videoId)
        if (already === watched) return item

        return {
          ...item,
          watched: watched
            ? [...item.watched, videoId]
            : item.watched.filter((id) => id !== videoId),
          updatedAt: Date.now(),
        }
      }),
    )
  }

  function handleSave(draft: SeriesDraft, title: string, parts: Part[]) {
    const existing = draft.existingSeriesId
      ? series.find((item) => item.id === draft.existingSeriesId)
      : undefined

    if (existing) {
      setSeries((current) =>
        current.map((item) =>
          item.id === existing.id ? mergeSeries(item, draft, title, parts) : item,
        ),
      )
      setSelectedSeriesId(existing.id)
    } else {
      const created = createSeries(draft, title, parts)
      setSeries((current) => [created, ...current])
      setSelectedSeriesId(created.id)
    }

    setAddOpen(false)
    setAddTargetId(null)
  }

  function deleteSeries(id: string) {
    setSeries((current) => current.filter((item) => item.id !== id))
    setSelectedSeriesId((current) => (current === id ? null : current))
    setPlayer((current) => (current?.seriesId === id ? null : current))
    setAddTargetId((current) => (current === id ? null : current))
    setAddOpen(false)
  }

  function handleAddParts(item: Series) {
    setSelectedSeriesId(item.id)
    setAddTargetId(item.id)
    setAddOpen(true)
  }

  function openAdd() {
    setAddTargetId(null)
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
    setAddTargetId(null)
  }

  function handleReset() {
    setSeries([])
    setSelectedSeriesId(null)
    setPlayer(null)
    setAddOpen(false)
    setAddTargetId(null)
  }

  function handleExport() {
    const payload = {
      app: 'cdramalist',
      version: 2,
      exportedAt: new Date().toISOString(),
      series,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `cdramalist-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown

      let raw: unknown[] | null = null
      if (Array.isArray(parsed)) {
        raw = parsed
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { series?: unknown }).series)
      ) {
        raw = (parsed as { series: unknown[] }).series
      }

      if (!raw) throw new Error('Formato no reconocido')

      const imported = raw.filter(isSeries).map(normalizeSeries)
      if (imported.length === 0) throw new Error('Sin series válidas')

      setSeries((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))

        for (const incoming of imported) {
          const previous = byId.get(incoming.id)
          byId.set(incoming.id, previous ? combineSeries(previous, incoming) : incoming)
        }

        return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
      })

      window.alert(
        `Se ${imported.length === 1 ? 'ha importado 1 serie' : `han importado ${imported.length} series`}.`,
      )
    } catch {
      window.alert(
        'No se pudo importar el archivo. Asegúrate de que es una copia exportada por CdramaList.',
      )
    }
  }

  function openSettingsFromAdd() {
    closeAdd()
    setSelectedSeriesId(null)
    setTab('settings')
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-950 pb-24">
      <main className="flex-1">
        {tab === 'home' && (
          <HomeView
            series={filtered}
            allSeries={series}
            query={query}
            filter={filter}
            canInstall={canInstall}
            apiKeyConfigured={apiKey.length > 0}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onOpen={openSeries}
            onPlay={playSeries}
            onToggleFavorite={toggleFavorite}
            onAdd={openAdd}
            onInstall={promptInstall}
            onOpenSettings={() => setTab('settings')}
          />
        )}

        {tab === 'list' && (
          <ListView
            groups={groups}
            canInstall={canInstall}
            onOpen={openSeries}
            onToggleFavorite={toggleFavorite}
            onInstall={promptInstall}
            onAdd={openAdd}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            apiKey={apiKey}
            seriesCount={series.length}
            watchedPartsCount={watchedParts}
            favoriteCount={favoriteCount}
            canInstall={canInstall}
            onApiKeyChange={setApiKey}
            onInstall={promptInstall}
            onReset={handleReset}
            onExport={handleExport}
            onImport={handleImport}
          />
        )}
      </main>

      <BottomNav tab={tab} savedCount={series.length} onChange={setTab} />

      {tab === 'list' && series.length > 0 && !selectedSeries && !player && !addOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_5rem)] z-20 mx-auto w-full max-w-md px-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openAdd}
              aria-label="Añadir serie"
              className="pointer-events-auto grid size-12 place-items-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/30 transition hover:bg-rose-400 active:scale-95"
            >
              <Icon.Plus className="size-5" />
            </button>
          </div>
        </div>
      )}

      {selectedSeries && !player && (
        <SeriesSheet
          series={selectedSeries}
          onClose={() => setSelectedSeriesId(null)}
          onPlay={playSeries}
          onToggleFavorite={toggleFavorite}
          onSetWatched={setWatched}
          onAddParts={handleAddParts}
          onDelete={deleteSeries}
        />
      )}

      {player && playerSeries && (
        <PlayerSheet
          series={playerSeries}
          startIndex={player.index}
          onClose={() => setPlayer(null)}
          onSetWatched={setWatched}
        />
      )}

      {addOpen && (
        <AddSeriesSheet
          apiKey={apiKey}
          series={series}
          targetSeries={addTarget ?? undefined}
          onClose={closeAdd}
          onSave={handleSave}
          onOpenSettings={openSettingsFromAdd}
        />
      )}
    </div>
  )
}
