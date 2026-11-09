import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountSheet, type SyncMessage } from './components/AccountSheet'
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
import { sanitizeGoogleUser, signOutGoogle } from './lib/google'
import {
  createSeries,
  filterSeries,
  groupSeries,
  isSeries,
  mergeSeries,
  mergeSeriesCollections,
  normalizeSeries,
  watchedCount,
} from './lib/series'
import {
  defaultSyncPath,
  isSyncConfigured,
  pullRemote,
  pushRemote,
  seriesCollectionsEqual,
  validateSyncConfig,
  verifySyncConfig,
} from './lib/sync'
import type {
  Filter,
  GoogleUser,
  Part,
  Series,
  SeriesDraft,
  SyncConfig,
  Tab,
} from './types'

interface PlayerState {
  seriesId: string
  index: number
}

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

function emptySyncConfig(sub?: string): SyncConfig {
  return {
    token: '',
    repo: '',
    branch: 'main',
    path: defaultSyncPath(sub),
    auto: true,
  }
}

function sanitizeSyncConfig(value: unknown): SyncConfig {
  if (!value || typeof value !== 'object') return emptySyncConfig()

  const item = value as Record<string, unknown>

  return {
    token: typeof item.token === 'string' ? item.token : '',
    repo: typeof item.repo === 'string' ? item.repo : '',
    branch:
      typeof item.branch === 'string' && item.branch.trim()
        ? item.branch
        : 'main',
    path:
      typeof item.path === 'string' && item.path.trim()
        ? item.path
        : defaultSyncPath(),
    auto: typeof item.auto === 'boolean' ? item.auto : true,
    sha: typeof item.sha === 'string' ? item.sha : undefined,
    lastSyncedAt:
      typeof item.lastSyncedAt === 'number' ? item.lastSyncedAt : undefined,
  }
}

function syncKey(config: SyncConfig): string {
  return `${config.repo}|${config.branch}|${config.path}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo sincronizar.'
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
  const [googleUser, setGoogleUser] = usePersistentState<GoogleUser | null>(
    'cdramalist:googleUser',
    null,
    sanitizeGoogleUser,
  )
  const [googleClientIdOverride, setGoogleClientIdOverride] =
    usePersistentState<string>(
      'cdramalist:googleClientId',
      '',
      (value) => (typeof value === 'string' ? value : ''),
    )
  const googleClientId = ENV_CLIENT_ID || googleClientIdOverride
  const [syncConfig, setSyncConfig] = usePersistentState<SyncConfig>(
    'cdramalist:syncConfig',
    emptySyncConfig(),
    sanitizeSyncConfig,
  )
  const [syncDirty, setSyncDirty] = usePersistentState<boolean>(
    'cdramalist:syncDirty',
    false,
    (value) => value === true,
  )
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<SyncMessage | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('home')
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [player, setPlayer] = useState<PlayerState | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addTargetId, setAddTargetId] = useState<string | null>(null)
  const { canInstall, promptInstall } = useInstallPrompt()

  const seriesRef = useRef(series)
  const revisionRef = useRef(0)
  const autoErrorRef = useRef(false)
  const initialSyncRef = useRef<string | null>(null)

  useEffect(() => {
    seriesRef.current = series
  }, [series])

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

  function updateSeries(
    updater: (current: Series[]) => Series[],
    markDirty = true,
  ) {
    revisionRef.current += 1
    autoErrorRef.current = false
    setSeries((current) => updater(current))
    if (markDirty && isSyncConfigured(syncConfig)) setSyncDirty(true)
  }

  function touchSeries(id: string) {
    updateSeries(
      (current) =>
        current.map((item) =>
          item.id === id ? { ...item, lastOpenedAt: Date.now() } : item,
        ),
      false,
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
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    )
  }

  function setWatched(seriesId: string, videoId: string, watched: boolean) {
    updateSeries((current) =>
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
      updateSeries((current) =>
        current.map((item) =>
          item.id === existing.id ? mergeSeries(item, draft, title, parts) : item,
        ),
      )
      setSelectedSeriesId(existing.id)
    } else {
      const created = createSeries(draft, title, parts)
      updateSeries((current) => [created, ...current])
      setSelectedSeriesId(created.id)
    }

    setAddOpen(false)
    setAddTargetId(null)
  }

  function deleteSeries(id: string) {
    updateSeries((current) => current.filter((item) => item.id !== id))
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
    updateSeries(() => [])
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

      updateSeries((current) => mergeSeriesCollections(current, imported))

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

  function handleSignIn(user: GoogleUser) {
    setGoogleUser(user)
    initialSyncRef.current = null
    setSyncConfig((current) => {
      if (current.path && current.path !== defaultSyncPath()) return current

      return {
        ...current,
        path: defaultSyncPath(user.sub),
        sha: undefined,
        lastSyncedAt: undefined,
      }
    })
    setSyncMessage({
      kind: 'ok',
      text: `Sesión iniciada como ${user.email}.`,
    })
  }

  function handleSignOut() {
    signOutGoogle()
    setGoogleUser(null)
    initialSyncRef.current = null
    setSyncMessage({
      kind: 'info',
      text: 'Has cerrado la sesión. La sincronización configurada se mantiene.',
    })
  }

  function handleClientIdChange(clientId: string) {
    setGoogleClientIdOverride(clientId)
  }

  const syncMerge = useCallback(
    async (silent = false) => {
      if (!isSyncConfigured(syncConfig)) {
        if (!silent) {
          setSyncMessage({
            kind: 'error',
            text: 'Configura la sincronización antes de continuar.',
          })
        }
        return
      }

      setSyncBusy(true)
      try {
        const remote = await pullRemote(syncConfig)
        const merged = remote
          ? mergeSeriesCollections(seriesRef.current, remote.series)
          : seriesRef.current

        if (remote) setSeries(merged)

        const revision = revisionRef.current

        if (remote && seriesCollectionsEqual(merged, remote.series)) {
          setSyncConfig((current) => ({
            ...current,
            sha: remote.sha,
            lastSyncedAt: Date.now(),
          }))
          autoErrorRef.current = false
          if (revisionRef.current === revision) setSyncDirty(false)
          if (!silent) {
            setSyncMessage({ kind: 'ok', text: 'Todo está sincronizado.' })
          }
          return
        }

        const result = await pushRemote(syncConfig, merged, remote?.sha)

        setSyncConfig((current) => ({
          ...current,
          sha: result.sha,
          lastSyncedAt: Date.now(),
        }))
        autoErrorRef.current = false
        if (revisionRef.current === revision) setSyncDirty(false)

        if (!silent || (remote && remote.series.length > 0)) {
          setSyncMessage({
            kind: 'ok',
            text: remote
              ? `Sincronizadas ${merged.length} series con la nube.`
              : `Subidas ${merged.length} series a la nube.`,
          })
        }
      } catch (error) {
        setSyncMessage({ kind: 'error', text: errorMessage(error) })
      } finally {
        setSyncBusy(false)
      }
    },
    [syncConfig, setSeries, setSyncConfig, setSyncDirty],
  )

  async function handleSaveConfig(next: SyncConfig): Promise<boolean> {
    const error = validateSyncConfig(next)
    if (error) {
      setSyncMessage({ kind: 'error', text: error })
      return false
    }

    setSyncBusy(true)
    try {
      await verifySyncConfig(next)
      const remote = await pullRemote(next)
      const saved: SyncConfig = { ...next, sha: remote?.sha }

      autoErrorRef.current = false
      setSyncConfig(saved)
      setSyncMessage({
        kind: 'ok',
        text: syncDirty
          ? 'Conexión verificada. Hay cambios locales: pulsa Sincronizar para combinarlos con la nube.'
          : remote
            ? 'Conexión verificada. Sincronizando los datos de la nube…'
            : 'Conexión verificada. Subiendo tus series…',
      })
      return true
    } catch (error) {
      setSyncMessage({ kind: 'error', text: errorMessage(error) })
      return false
    } finally {
      setSyncBusy(false)
    }
  }

  function handleSyncConfigChange(next: SyncConfig) {
    const changedTarget =
      next.repo !== syncConfig.repo ||
      next.branch !== syncConfig.branch ||
      next.path !== syncConfig.path

    autoErrorRef.current = false
    setSyncConfig(
      changedTarget
        ? { ...next, sha: undefined, lastSyncedAt: undefined }
        : next,
    )
  }

  function handleSync() {
    void syncMerge(false)
  }

  function handleUpload() {
    if (!isSyncConfigured(syncConfig)) {
      setSyncMessage({
        kind: 'error',
        text: 'Configura la sincronización antes de continuar.',
      })
      return
    }

    const confirmed = window.confirm(
      `Se reemplazará el archivo de la nube con tus ${seriesRef.current.length} series locales. ¿Continuar?`,
    )
    if (!confirmed) return

    void (async () => {
      setSyncBusy(true)
      try {
        let sha = syncConfig.sha
        if (!sha) {
          const remote = await pullRemote(syncConfig)
          sha = remote?.sha
        }

        const revision = revisionRef.current
        const result = await pushRemote(syncConfig, seriesRef.current, sha)

        setSyncConfig((current) => ({
          ...current,
          sha: result.sha,
          lastSyncedAt: Date.now(),
        }))
        autoErrorRef.current = false
        if (revisionRef.current === revision) setSyncDirty(false)
        setSyncMessage({
          kind: 'ok',
          text: 'Nube actualizada con las series de este dispositivo.',
        })
      } catch (error) {
        setSyncMessage({ kind: 'error', text: errorMessage(error) })
      } finally {
        setSyncBusy(false)
      }
    })()
  }

  function handleDownload() {
    if (!isSyncConfigured(syncConfig)) {
      setSyncMessage({
        kind: 'error',
        text: 'Configura la sincronización antes de continuar.',
      })
      return
    }

    void (async () => {
      setSyncBusy(true)
      try {
        const remote = await pullRemote(syncConfig)

        if (!remote) {
          setSyncMessage({
            kind: 'info',
            text: 'Todavía no hay datos en la nube.',
          })
          return
        }

        const confirmed = window.confirm(
          `Se reemplazarán tus ${seriesRef.current.length} series locales por las ${remote.series.length} de la nube. ¿Continuar?`,
        )
        if (!confirmed) return

        setSeries(remote.series)
        setSyncConfig((current) => ({
          ...current,
          sha: remote.sha,
          lastSyncedAt: Date.now(),
        }))
        autoErrorRef.current = false
        setSyncDirty(false)
        setSyncMessage({
          kind: 'ok',
          text: `Descargadas ${remote.series.length} series de la nube.`,
        })
      } catch (error) {
        setSyncMessage({ kind: 'error', text: errorMessage(error) })
      } finally {
        setSyncBusy(false)
      }
    })()
  }

  function handleDisconnect() {
    const confirmed = window.confirm(
      'Se quitará la configuración de sincronización de este dispositivo. El archivo de GitHub no se borra. ¿Continuar?',
    )
    if (!confirmed) return

    initialSyncRef.current = null
    autoErrorRef.current = false
    setSyncConfig(emptySyncConfig(googleUser?.sub))
    setSyncDirty(false)
    setSyncMessage({
      kind: 'info',
      text: 'Sincronización desconectada en este dispositivo.',
    })
  }

  useEffect(() => {
    if (!isSyncConfigured(syncConfig)) return
    if (syncDirty) return

    const key = syncKey(syncConfig)
    if (initialSyncRef.current === key) return

    initialSyncRef.current = key
    void syncMerge(true)
  }, [syncConfig, syncDirty, syncMerge])

  useEffect(() => {
    if (!syncDirty) return
    if (!syncConfig.auto) return
    if (!isSyncConfigured(syncConfig)) return
    if (syncBusy || autoErrorRef.current) return

    const timer = window.setTimeout(() => {
      void (async () => {
        setSyncBusy(true)
        try {
          let sha = syncConfig.sha
          if (!sha) {
            const remote = await pullRemote(syncConfig)
            sha = remote?.sha
          }

          const revision = revisionRef.current
          const result = await pushRemote(syncConfig, seriesRef.current, sha)

          setSyncConfig((current) => ({
            ...current,
            sha: result.sha,
            lastSyncedAt: Date.now(),
          }))
          autoErrorRef.current = false
          if (revisionRef.current === revision) setSyncDirty(false)
          setSyncMessage({ kind: 'ok', text: 'Cambios sincronizados.' })
        } catch (error) {
          autoErrorRef.current = true
          setSyncMessage({ kind: 'error', text: errorMessage(error) })
        } finally {
          setSyncBusy(false)
        }
      })()
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [
    syncDirty,
    syncConfig,
    syncBusy,
    series,
    setSyncConfig,
    setSyncDirty,
  ])

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
            googleUser={googleUser}
            syncDirty={syncDirty}
            syncBusy={syncBusy}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onOpen={openSeries}
            onPlay={playSeries}
            onToggleFavorite={toggleFavorite}
            onAdd={openAdd}
            onInstall={promptInstall}
            onOpenSettings={() => setTab('settings')}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )}

        {tab === 'list' && (
          <ListView
            groups={groups}
            canInstall={canInstall}
            googleUser={googleUser}
            syncDirty={syncDirty}
            syncBusy={syncBusy}
            onOpen={openSeries}
            onToggleFavorite={toggleFavorite}
            onInstall={promptInstall}
            onAdd={openAdd}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            apiKey={apiKey}
            seriesCount={series.length}
            watchedPartsCount={watchedParts}
            favoriteCount={favoriteCount}
            canInstall={canInstall}
            googleUser={googleUser}
            syncEnabled={isSyncConfigured(syncConfig)}
            syncDirty={syncDirty}
            syncBusy={syncBusy}
            onApiKeyChange={setApiKey}
            onInstall={promptInstall}
            onReset={handleReset}
            onExport={handleExport}
            onImport={handleImport}
            onOpenAccount={() => setAccountOpen(true)}
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

      {accountOpen && (
        <AccountSheet
          user={googleUser}
          clientId={googleClientId}
          clientIdLocked={ENV_CLIENT_ID.length > 0}
          syncConfig={syncConfig}
          dirty={syncDirty}
          busy={syncBusy}
          message={syncMessage}
          onClose={() => setAccountOpen(false)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onClientIdChange={handleClientIdChange}
          onSaveConfig={handleSaveConfig}
          onSyncConfigChange={handleSyncConfigChange}
          onSync={handleSync}
          onUpload={handleUpload}
          onDownload={handleDownload}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  )
}
