import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  fetchGoogleUserInfo,
  requestDriveToken,
  revokeGoogleToken,
  type AccessToken,
} from '../lib/google'
import {
  pullFromDrive,
  pushToDrive,
  seriesSignature,
} from '../lib/drive'
import { mergeSeriesCollections } from '../lib/series'
import type { GoogleUser, Series, SyncMessage } from '../types'
import { usePersistentState } from './usePersistentState'

export type DriveSyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'

interface DriveState {
  enabled: boolean
  auto: boolean
  email?: string
  fileId?: string
  lastSyncedAt?: number
}

const DEFAULT_STATE: DriveState = { enabled: false, auto: true }

function sanitizeState(value: unknown): DriveState {
  if (!value || typeof value !== 'object') return DEFAULT_STATE

  const item = value as Record<string, unknown>

  return {
    enabled: item.enabled === true,
    auto: item.auto !== false,
    email: typeof item.email === 'string' ? item.email : undefined,
    fileId: typeof item.fileId === 'string' ? item.fileId : undefined,
    lastSyncedAt:
      typeof item.lastSyncedAt === 'number' ? item.lastSyncedAt : undefined,
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'No se pudo completar la sincronización con Google Drive.'
}

export interface DriveSync {
  configured: boolean
  connected: boolean
  auto: boolean
  dirty: boolean
  busy: boolean
  status: DriveSyncStatus
  email: string | null
  lastSyncedAt: number | null
  message: SyncMessage | null
  connect: () => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  upload: () => Promise<void>
  download: () => Promise<void>
  setAuto: (auto: boolean) => void
}

interface UseDriveSyncOptions {
  clientId: string
  series: Series[]
  setSeries: Dispatch<SetStateAction<Series[]>>
  onUser: (user: GoogleUser | null) => void
}

export function useDriveSync({
  clientId,
  series,
  setSeries,
  onUser,
}: UseDriveSyncOptions): DriveSync {
  const [state, setState] = usePersistentState<DriveState>(
    'cdramalist:drive',
    DEFAULT_STATE,
    sanitizeState,
  )
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<DriveSyncStatus>('disconnected')
  const [message, setMessage] = useState<SyncMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string | null>(
    null,
  )

  const seriesRef = useRef(series)
  const tokenRef = useRef<AccessToken | null>(null)
  const fileIdRef = useRef<string | null>(state.fileId ?? null)
  const connectedRef = useRef(false)
  const runningRef = useRef(false)
  const restoredRef = useRef(false)

  const onUserRef = useRef(onUser)

  useEffect(() => {
    seriesRef.current = series
  }, [series])

  useEffect(() => {
    onUserRef.current = onUser
  }, [onUser])

  const signature = useMemo(() => seriesSignature(series), [series])
  const dirty =
    connected &&
    lastSyncedSignature !== null &&
    signature !== lastSyncedSignature

  const saveState = useCallback(
    (patch: Partial<DriveState>) => {
      setState((current) => ({ ...current, ...patch }))
    },
    [setState],
  )

  const getToken = useCallback(
    async (prompt: '' | 'none' | 'consent') => {
      if (!clientId) {
        throw new Error('Falta configurar el Client ID de Google.')
      }

      if (tokenRef.current && Date.now() < tokenRef.current.expiresAt) {
        return tokenRef.current.token
      }

      const token = await requestDriveToken(clientId, prompt)
      tokenRef.current = token

      return token.token
    },
    [clientId],
  )

  const syncWithToken = useCallback(
    async (token: string, silent = false) => {
      if (runningRef.current) return

      runningRef.current = true
      setBusy(true)
      setStatus('syncing')
      if (!silent) setMessage(null)

      try {
        const remote = await pullFromDrive(token)
        const local = seriesRef.current
        const merged = remote
          ? mergeSeriesCollections(local, remote.series)
          : local

        let fileId = remote?.fileId ?? null

        if (!remote || seriesSignature(merged) !== seriesSignature(remote.series)) {
          fileId = await pushToDrive(token, merged, fileId)
        }

        fileIdRef.current = fileId
        setLastSyncedSignature(seriesSignature(merged))
        setSeries(merged)
        saveState({ fileId: fileId ?? undefined, lastSyncedAt: Date.now(), enabled: true })
        connectedRef.current = true
        setConnected(true)
        setStatus('synced')

        if (!silent) {
          setMessage({
            kind: 'ok',
            text: remote
              ? `Sincronizadas ${merged.length} series con Google Drive.`
              : `Subidas ${merged.length} series a Google Drive.`,
          })
        }
      } catch (cause) {
        setStatus('error')
        setMessage({ kind: 'error', text: errorMessage(cause) })
      } finally {
        runningRef.current = false
        setBusy(false)
      }
    },
    [saveState, setSeries],
  )

  const connect = useCallback(async () => {
    if (!clientId) {
      setStatus('error')
      setMessage({
        kind: 'error',
        text: 'Falta configurar el Client ID de Google en la aplicación.',
      })
      return
    }

    if (runningRef.current) return

    runningRef.current = true
    setBusy(true)
    setStatus('connecting')
    setMessage(null)

    try {
      const token = await getToken('')
      const user = await fetchGoogleUserInfo(token)

      onUserRef.current(user)
      saveState({ enabled: true, email: user.email })
      connectedRef.current = true
      setConnected(true)

      runningRef.current = false
      setBusy(false)

      await syncWithToken(token)
    } catch (cause) {
      runningRef.current = false
      setBusy(false)
      connectedRef.current = false
      setConnected(false)
      setStatus('error')
      setMessage({ kind: 'error', text: errorMessage(cause) })
    }
  }, [clientId, getToken, saveState, syncWithToken])

  const syncNow = useCallback(async () => {
    if (!connectedRef.current) {
      await connect()
      return
    }

    try {
      const token = await getToken('')
      await syncWithToken(token)
    } catch (cause) {
      setStatus('error')
      setMessage({ kind: 'error', text: errorMessage(cause) })
    }
  }, [connect, getToken, syncWithToken])

  const upload = useCallback(async () => {
    if (!connectedRef.current) {
      await connect()
      return
    }

    if (runningRef.current) return

    const count = seriesRef.current.length
    const confirmed = window.confirm(
      `Se reemplazará el archivo de Google Drive con tus ${count} series locales. ¿Continuar?`,
    )
    if (!confirmed) return

    runningRef.current = true
    setBusy(true)
    setStatus('syncing')
    setMessage(null)

    try {
      const token = await getToken('')
      const current = seriesRef.current
      const fileId = await pushToDrive(token, current, fileIdRef.current)

      fileIdRef.current = fileId
      setLastSyncedSignature(seriesSignature(current))
      saveState({ fileId, lastSyncedAt: Date.now(), enabled: true })
      setStatus('synced')
      setMessage({
        kind: 'ok',
        text: 'Google Drive actualizado con las series de este dispositivo.',
      })
    } catch (cause) {
      setStatus('error')
      setMessage({ kind: 'error', text: errorMessage(cause) })
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [connect, getToken, saveState])

  const download = useCallback(async () => {
    if (!connectedRef.current) {
      await connect()
      return
    }

    if (runningRef.current) return

    runningRef.current = true
    setBusy(true)
    setStatus('syncing')
    setMessage(null)

    try {
      const token = await getToken('')
      const remote = await pullFromDrive(token)

      if (!remote) {
        setStatus('synced')
        setMessage({
          kind: 'info',
          text: 'Todavía no hay datos en Google Drive.',
        })
        return
      }

      const confirmed = window.confirm(
        `Se reemplazarán tus ${seriesRef.current.length} series locales por las ${remote.series.length} de Google Drive. ¿Continuar?`,
      )

      if (!confirmed) {
        setStatus('synced')
        return
      }

      fileIdRef.current = remote.fileId
      setSeries(remote.series)
      setLastSyncedSignature(seriesSignature(remote.series))
      saveState({ fileId: remote.fileId, lastSyncedAt: Date.now(), enabled: true })
      setStatus('synced')
      setMessage({
        kind: 'ok',
        text: `Descargadas ${remote.series.length} series de Google Drive.`,
      })
    } catch (cause) {
      setStatus('error')
      setMessage({ kind: 'error', text: errorMessage(cause) })
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [connect, getToken, saveState, setSeries])

  const pushCurrent = useCallback(async () => {
    if (!connectedRef.current || runningRef.current) return

    runningRef.current = true
    setBusy(true)
    setStatus('syncing')

    try {
      const token = await getToken('none')
      const current = seriesRef.current
      const fileId = await pushToDrive(token, current, fileIdRef.current)

      fileIdRef.current = fileId
      setLastSyncedSignature(seriesSignature(current))
      saveState({ fileId, lastSyncedAt: Date.now(), enabled: true })
      setStatus('synced')
    } catch (cause) {
      setStatus('error')
      setMessage({ kind: 'error', text: errorMessage(cause) })
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [getToken, saveState])

  const disconnect = useCallback(() => {
    const confirmed = window.confirm(
      'Se desconectará Google Drive en este dispositivo. El archivo de tu Drive no se borra. ¿Continuar?',
    )
    if (!confirmed) return

    const token = tokenRef.current?.token
    if (token) revokeGoogleToken(token)

    tokenRef.current = null
    fileIdRef.current = null
    connectedRef.current = false
    setConnected(false)
    setLastSyncedSignature(null)
    setStatus('disconnected')
    setMessage({
      kind: 'info',
      text: 'Sincronización con Google Drive desconectada.',
    })
    saveState({
      enabled: false,
      email: undefined,
      fileId: undefined,
      lastSyncedAt: undefined,
    })
    onUserRef.current(null)
  }, [saveState])

  const setAuto = useCallback(
    (auto: boolean) => saveState({ auto }),
    [saveState],
  )

  // Intenta recuperar la sesión de Google al recargar la página.
  useEffect(() => {
    if (restoredRef.current || !clientId || !state.enabled) return
    if (connectedRef.current) return

    restoredRef.current = true
    let cancelled = false

    void (async () => {
      setStatus('connecting')

      try {
        const token = await getToken('none')
        if (cancelled) return

        connectedRef.current = true
        setConnected(true)
        await syncWithToken(token, true)
      } catch {
        if (cancelled) return
        connectedRef.current = false
        setConnected(false)
        setStatus('disconnected')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, state.enabled, getToken, syncWithToken])

  // Subida automática con debounce cuando cambian los datos y hay sesión activa.
  useEffect(() => {
    if (!connected || !state.auto || busy) return
    if (lastSyncedSignature === null) return
    if (signature === lastSyncedSignature) return

    const timer = window.setTimeout(() => {
      void pushCurrent()
    }, 2_000)

    return () => window.clearTimeout(timer)
  }, [
    connected,
    state.auto,
    busy,
    lastSyncedSignature,
    signature,
    pushCurrent,
  ])

  return {
    configured: Boolean(clientId),
    connected,
    auto: state.auto,
    dirty,
    busy,
    status,
    email: state.email ?? null,
    lastSyncedAt: state.lastSyncedAt ?? null,
    message,
    connect,
    disconnect,
    syncNow,
    upload,
    download,
    setAuto,
  }
}
