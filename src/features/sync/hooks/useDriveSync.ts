import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearStoredDriveToken,
  fetchGoogleUserInfo,
  loadStoredDriveToken,
  requestDriveToken,
  revokeGoogleToken,
  storeDriveToken
} from '../model/google'
import { DriveError, pullFromDrive, pushToDrive, syncSignature } from '../model/drive'
import { mergeSeriesCollections } from '../../series/model/series'
import { mergeTagCollections, pruneSeriesTags } from '../../tags/model/tags'
import { AUTO_SYNC_DEBOUNCE_MS } from '../model/constants'
import type {
  AccessToken,
  DrivePersistenceState,
  DriveSync,
  DriveSyncStatus,
  SyncMessage,
  UseDriveSyncOptions
} from '../types'
import type { Series } from '../../series/types'
import type { Tag } from '../../tags/types'
import { useAppStore } from '../../../store/appStore'

type DriveState = DrivePersistenceState

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'No se pudo completar la sincronización con Google Drive.'
}

export function useDriveSync({
  clientId,
  series,
  setSeries,
  tags,
  setTags,
  onUser
}: UseDriveSyncOptions): DriveSync {
  const state = useAppStore((store) => store.drive)
  const setState = useAppStore((store) => store.setDrive)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<DriveSyncStatus>('disconnected')
  const [message, setMessage] = useState<SyncMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string | null>(null)

  const seriesRef = useRef(series)
  const tagsRef = useRef(tags)
  // Última copia sincronizada: sirve de base para combinar cambios de varios
  // dispositivos sin que un campo pise los cambios del otro.
  const lastSyncedSeriesRef = useRef<Series[] | null>(null)
  const lastSyncedTagsRef = useRef<Tag[] | null>(null)
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
    tagsRef.current = tags
  }, [tags])

  useEffect(() => {
    onUserRef.current = onUser
  }, [onUser])

  const signature = useMemo(() => syncSignature(series, tags), [series, tags])
  const dirty = connected && lastSyncedSignature !== null && signature !== lastSyncedSignature

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
      seriesOverride?: Series[],
      tagsOverride?: Tag[]
    ): Promise<boolean> => {
      if (runningRef.current) return false

      runningRef.current = true
      setBusy(true)
      setStatus('syncing')
      if (!silent) setMessage(null)

      try {
        const remote = await pullFromDrive(token)
        const local = seriesOverride ?? seriesRef.current
        const localTags = tagsOverride ?? tagsRef.current
        const mergedTags = remote
          ? mergeTagCollections(localTags, remote.tags, lastSyncedTagsRef.current ?? undefined)
          : localTags
        const merged = pruneSeriesTags(
          remote
            ? mergeSeriesCollections(
                local,
                remote.series,
                lastSyncedSeriesRef.current ?? undefined
              )
            : local,
          mergedTags
        )

        let fileId = remote?.fileId ?? null

        if (
          !remote ||
          syncSignature(merged, mergedTags) !== syncSignature(remote.series, remote.tags)
        ) {
          fileId = await pushToDrive(token, merged, mergedTags, fileId)
        }

        fileIdRef.current = fileId
        lastSyncedSeriesRef.current = merged
        lastSyncedTagsRef.current = mergedTags
        setLastSyncedSignature(syncSignature(merged, mergedTags))
        // Si el usuario ha cambiado algo mientras se descargaba Drive, esos
        // cambios se combinan en lugar de quedar pisados por la copia remota.
        setSeries((current) =>
          pruneSeriesTags(mergeSeriesCollections(current, merged, local), mergedTags)
        )
        setTags((current) => mergeTagCollections(current, mergedTags, localTags))
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
    [handleDriveError, saveState, setSeries, setTags]
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
    async (seriesOverride?: Series[], tagsOverride?: Tag[]) => {
      if (!connectedRef.current) {
        return connect()
      }

      try {
        // `syncNow` se llama a veces después de esperas largas (búsquedas de
        // capítulos), fuera del gesto del usuario. Renovar el token ahí abriría
        // un popup que el navegador puede bloquear, así que solo se usa el
        // token vigente y, si caducó, se pide reconectar.
        const token = await getToken('none')
        return await syncWithToken(token, false, seriesOverride, tagsOverride)
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
      const currentTags = tagsRef.current
      const fileId = await pushToDrive(token, current, currentTags, fileIdRef.current)

      fileIdRef.current = fileId
      lastSyncedSeriesRef.current = current
      lastSyncedTagsRef.current = currentTags
      setLastSyncedSignature(syncSignature(current, currentTags))
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

      const localCount = seriesRef.current.filter((item) => !item.deletedAt).length
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
      lastSyncedTagsRef.current = remote.tags
      setSeries(pruneSeriesTags(remote.series, remote.tags))
      setTags(remote.tags)
      setLastSyncedSignature(syncSignature(remote.series, remote.tags))
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
  }, [connect, getToken, handleDriveError, saveState, setSeries, setTags])

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
    lastSyncedTagsRef.current = null
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

  const setAuto = useCallback((auto: boolean) => saveState({ auto }), [saveState])

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
