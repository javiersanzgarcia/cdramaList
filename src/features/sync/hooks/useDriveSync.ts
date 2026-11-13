import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import {
  clearStoredDriveToken,
  fetchGoogleUserInfo,
  loadStoredDriveToken,
  requestDriveToken,
  revokeGoogleToken,
  storeDriveToken,
  type AccessToken
} from '../model/google'
import {
  DriveError,
  pullFromDrive,
  pushToDrive,
  seriesSignature
} from '../model/drive'
import { mergeSeriesCollections } from '../../series/model/series'
import { AUTO_SYNC_DEBOUNCE_MS } from '../model/constants'
import type { DrivePersistenceState, GoogleUser, SyncMessage } from '../types'
import type { Series } from '../../series/types'
import { useAppStore } from '../../../store/appStore'

export type DriveSyncStatus =
  'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'

type DriveState = DrivePersistenceState

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
  connect: () => Promise<boolean>
  disconnect: () => void
  syncNow: (seriesOverride?: Series[]) => Promise<boolean>
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
  onUser
}: UseDriveSyncOptions): DriveSync {
  const state = useAppStore((store) => store.drive)
  const setState = useAppStore((store) => store.setDrive)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<DriveSyncStatus>('disconnected')
  const [message, setMessage] = useState<SyncMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string | null>(
    null
  )

  const seriesRef = useRef(series)
  // Última copia sincronizada: sirve de base para combinar cambios de varios
  // dispositivos sin que un campo pise los cambios del otro.
  const lastSyncedSeriesRef = useRef<Series[] | null>(null)
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
    [setState]
  )

  const getToken = useCallback(
    async (prompt: '' | 'none' | 'consent') => {
      if (!clientId) {
        throw new Error('Falta configurar el Client ID de Google.')
      }

      if (tokenRef.current && Date.now() < tokenRef.current.expiresAt) {
        return tokenRef.current.token
      }

      const stored = loadStoredDriveToken()
      if (stored) {
        tokenRef.current = stored
        return stored.token
      }

      // Renovar sin gesto del usuario abre un popup que el navegador bloquea.
      // Solo pedimos un token nuevo desde una acción explícita (prompt '').
      if (prompt === 'none') {
        throw new DriveError(
          'La sesión de Google Drive ha caducado. Vuelve a conectar para reanudar la sincronización.',
          'auth'
        )
      }

      const token = await requestDriveToken(clientId, prompt)
      tokenRef.current = token
      storeDriveToken(token)

      return token.token
    },
    [clientId]
  )

  const handleDriveError = useCallback((cause: unknown) => {
    // Un 401 significa que el token ya no sirve: forzamos reconectar.
    if (cause instanceof DriveError && cause.code === 'auth') {
      tokenRef.current = null
      clearStoredDriveToken()
      connectedRef.current = false
      setConnected(false)
    }

    setStatus('error')
    setMessage({ kind: 'error', text: errorMessage(cause) })
  }, [])

  const syncWithToken = useCallback(
    async (
      token: string,
      silent = false,
      seriesOverride?: Series[]
    ): Promise<boolean> => {
      if (runningRef.current) return false

      runningRef.current = true
      setBusy(true)
      setStatus('syncing')
      if (!silent) setMessage(null)

      try {
        const remote = await pullFromDrive(token)
        const local = seriesOverride ?? seriesRef.current
        const merged = remote
          ? mergeSeriesCollections(
              local,
              remote.series,
              lastSyncedSeriesRef.current ?? undefined
            )
          : local

        let fileId = remote?.fileId ?? null

        if (
          !remote ||
          seriesSignature(merged) !== seriesSignature(remote.series)
        ) {
          fileId = await pushToDrive(token, merged, fileId)
        }

        fileIdRef.current = fileId
        lastSyncedSeriesRef.current = merged
        setLastSyncedSignature(seriesSignature(merged))
        // Si el usuario ha cambiado algo mientras se descargaba Drive, esos
        // cambios se combinan en lugar de quedar pisados por la copia remota.
        setSeries((current) => mergeSeriesCollections(current, merged, local))
        saveState({
          fileId: fileId ?? undefined,
          lastSyncedAt: Date.now(),
          enabled: true
        })
        connectedRef.current = true
        setConnected(true)
        setStatus('synced')

        if (!silent) {
          setMessage({
            kind: 'ok',
            text: remote
              ? `Sincronizadas ${merged.length} series con Google Drive.`
              : `Subidas ${merged.length} series a Google Drive.`
          })
        }

        return true
      } catch (cause) {
        handleDriveError(cause)
        return false
      } finally {
        runningRef.current = false
        setBusy(false)
      }
    },
    [handleDriveError, saveState, setSeries]
  )

  const connect = useCallback(async (): Promise<boolean> => {
    if (!clientId) {
      setStatus('error')
      setMessage({
        kind: 'error',
        text: 'Falta configurar el Client ID de Google en la aplicación.'
      })
      return false
    }

    if (runningRef.current) return false

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

      // La conexión solo se considera correcta si la primera sincronización
      // termina bien; si falla, el llamador debe recibir `false`.
      return await syncWithToken(token)
    } catch (cause) {
      runningRef.current = false
      setBusy(false)
      connectedRef.current = false
      setConnected(false)
      handleDriveError(cause)
      return false
    }
  }, [clientId, getToken, handleDriveError, saveState, syncWithToken])

  const syncNow = useCallback(
    async (seriesOverride?: Series[]) => {
      if (!connectedRef.current) {
        return connect()
      }

      try {
        // `syncNow` se llama a veces después de esperas largas (búsquedas de
        // capítulos), fuera del gesto del usuario. Renovar el token ahí abriría
        // un popup que el navegador puede bloquear, así que solo se usa el
        // token vigente y, si caducó, se pide reconectar.
        const token = await getToken('none')
        return await syncWithToken(token, false, seriesOverride)
      } catch (cause) {
        handleDriveError(cause)
        return false
      }
    },
    [connect, getToken, handleDriveError, syncWithToken]
  )

  const upload = useCallback(async () => {
    if (!connectedRef.current) {
      await connect()
      return
    }

    if (runningRef.current) return

    // Las series borradas (lápida) no se cuentan: se conservan solo para
    // propagar el borrado, no forman parte de la biblioteca visible.
    const count = seriesRef.current.filter((item) => !item.deletedAt).length
    const confirmed = window.confirm(
      `Se reemplazará el archivo de Google Drive con tus ${count} series locales. ¿Continuar?`
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
      lastSyncedSeriesRef.current = current
      setLastSyncedSignature(seriesSignature(current))
      saveState({ fileId, lastSyncedAt: Date.now(), enabled: true })
      setStatus('synced')
      setMessage({
        kind: 'ok',
        text: 'Google Drive actualizado con las series de este dispositivo.'
      })
    } catch (cause) {
      handleDriveError(cause)
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [connect, getToken, handleDriveError, saveState])

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
          text: 'Todavía no hay datos en Google Drive.'
        })
        return
      }

      const localCount = seriesRef.current.filter(
        (item) => !item.deletedAt
      ).length
      const remoteCount = remote.series.filter((item) => !item.deletedAt).length
      const confirmed = window.confirm(
        `Se reemplazarán tus ${localCount} series locales por las ${remoteCount} de Google Drive. ¿Continuar?`
      )

      if (!confirmed) {
        setStatus('synced')
        return
      }

      fileIdRef.current = remote.fileId
      lastSyncedSeriesRef.current = remote.series
      setSeries(remote.series)
      setLastSyncedSignature(seriesSignature(remote.series))
      saveState({
        fileId: remote.fileId,
        lastSyncedAt: Date.now(),
        enabled: true
      })
      setStatus('synced')
      setMessage({
        kind: 'ok',
        text: `Descargadas ${remoteCount} series de Google Drive.`
      })
    } catch (cause) {
      handleDriveError(cause)
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [connect, getToken, handleDriveError, saveState, setSeries])

  const pullAndPush = useCallback(async () => {
    if (!connectedRef.current || runningRef.current) return

    try {
      const token = await getToken('none')
      // A diferencia de una subida directa, esto lee Drive y combina los
      // cambios remotos antes de escribir, para no pisar lo que haya subido
      // otro dispositivo mientras este estaba desconectado.
      await syncWithToken(token, true)
    } catch (cause) {
      handleDriveError(cause)
    }
  }, [getToken, handleDriveError, syncWithToken])

  const disconnect = useCallback(() => {
    const confirmed = window.confirm(
      'Se desconectará Google Drive en este dispositivo. El archivo de tu Drive no se borra. ¿Continuar?'
    )
    if (!confirmed) return

    const token = tokenRef.current?.token
    if (token) revokeGoogleToken(token)

    tokenRef.current = null
    clearStoredDriveToken()
    fileIdRef.current = null
    lastSyncedSeriesRef.current = null
    connectedRef.current = false
    setConnected(false)
    setLastSyncedSignature(null)
    setStatus('disconnected')
    setMessage({
      kind: 'info',
      text: 'Sincronización con Google Drive desconectada.'
    })
    saveState({
      enabled: false,
      email: undefined,
      fileId: undefined,
      lastSyncedAt: undefined
    })
    onUserRef.current(null)
  }, [saveState])

  const setAuto = useCallback(
    (auto: boolean) => saveState({ auto }),
    [saveState]
  )

  // Intenta recuperar la sesión de Google al recargar la página usando el
  // token guardado en la sesión del navegador. No abre ningún popup.
  useEffect(() => {
    if (restoredRef.current || !clientId || !state.enabled) return
    if (connectedRef.current) return

    restoredRef.current = true

    void (async () => {
      setStatus('connecting')

      try {
        const token = await getToken('none')
        connectedRef.current = true
        setConnected(true)
        await syncWithToken(token, true)
      } catch {
        connectedRef.current = false
        setConnected(false)
        setStatus('disconnected')
      }
    })()
  }, [clientId, state.enabled, getToken, syncWithToken])

  // Subida automática con debounce cuando cambian los datos y hay sesión activa.
  // Antes de subir se hace pull/merge para no perder cambios de otros equipos.
  useEffect(() => {
    if (!connected || !state.auto || busy) return
    if (lastSyncedSignature === null) return
    if (signature === lastSyncedSignature) return

    const timer = window.setTimeout(() => {
      void pullAndPush()
    }, AUTO_SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [connected, state.auto, busy, lastSyncedSignature, signature, pullAndPush])

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
    setAuto
  }
}
