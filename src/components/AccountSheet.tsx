import { useEffect, useRef, useState } from 'react'
import { useSheet } from '../hooks/useSheet'
import { formatDateTime } from '../lib/format'
import { renderGoogleButton } from '../lib/google'
import { isSyncConfigured, validateSyncConfig } from '../lib/sync'
import type { GoogleUser, SyncConfig } from '../types'
import * as Icon from './Icons'

export interface SyncMessage {
  kind: 'ok' | 'error' | 'info'
  text: string
}

interface AccountSheetProps {
  user: GoogleUser | null
  clientId: string
  syncConfig: SyncConfig
  dirty: boolean
  busy: boolean
  message: SyncMessage | null
  onClose: () => void
  onSignIn: (user: GoogleUser) => void
  onSignOut: () => void
  onClientIdChange: (clientId: string) => void
  onSaveConfig: (config: SyncConfig) => Promise<boolean>
  onSyncConfigChange: (config: SyncConfig) => void
  onSync: () => void
  onUpload: () => void
  onDownload: () => void
  onDisconnect: () => void
}

function configKey(config: SyncConfig): string {
  return [config.token, config.repo, config.branch, config.path, config.auto].join('|')
}

export function AccountSheet({
  user,
  clientId,
  syncConfig,
  dirty,
  busy,
  message,
  onClose,
  onSignIn,
  onSignOut,
  onClientIdChange,
  onSaveConfig,
  onSyncConfigChange,
  onSync,
  onUpload,
  onDownload,
  onDisconnect,
}: AccountSheetProps) {
  useSheet(onClose)

  const [draftClientId, setDraftClientId] = useState(clientId)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const onSignInRef = useRef(onSignIn)

  const configured = isSyncConfigured(syncConfig)
  const [editingSync, setEditingSync] = useState(!configured)
  const [draft, setDraft] = useState<SyncConfig>(syncConfig)
  const [showToken, setShowToken] = useState(false)
  const [showClientId, setShowClientId] = useState(false)

  const syncDraftError = validateSyncConfig(draft)
  const lastSync = formatDateTime(syncConfig.lastSyncedAt)

  useEffect(() => {
    onSignInRef.current = onSignIn
  }, [onSignIn])

  useEffect(() => {
    setDraftClientId(clientId)
  }, [clientId])

  useEffect(() => {
    setDraft(syncConfig)
    if (!isSyncConfigured(syncConfig)) setEditingSync(true)
    // Solo sincronizamos el formulario cuando cambian los datos de conexión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey(syncConfig)])

  useEffect(() => {
    if (user || !clientId) return

    const container = googleButtonRef.current
    if (!container) return

    let cancelled = false
    setGoogleError(null)

    void renderGoogleButton(
      container,
      clientId,
      (nextUser) => {
        if (!cancelled) onSignInRef.current(nextUser)
      },
      (text) => {
        if (!cancelled) setGoogleError(text)
      },
    ).catch((error: unknown) => {
      if (cancelled) return
      setGoogleError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el inicio de sesión de Google.',
      )
    })

    return () => {
      cancelled = true
    }
  }, [clientId, user])

  function saveClientId() {
    const value = draftClientId.trim()

    if (!value.endsWith('.apps.googleusercontent.com')) {
      setGoogleError(
        'El Client ID de Google debe terminar en .apps.googleusercontent.com.',
      )
      return
    }

    setGoogleError(null)
    setShowClientId(false)
    onClientIdChange(value)
  }

  async function saveSync() {
    const ok = await onSaveConfig(draft)
    if (ok) setEditingSync(false)
  }

  const statusLabel = busy
    ? 'Sincronizando…'
    : dirty
      ? 'Cambios pendientes'
      : configured
        ? 'Conectado'
        : 'Sin configurar'

  const statusClass = busy
    ? 'bg-amber-400/15 text-amber-300'
    : dirty
      ? 'bg-rose-500/15 text-rose-300'
      : configured
        ? 'bg-emerald-400/15 text-emerald-300'
        : 'bg-zinc-800 text-zinc-400'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-sheet-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-800 bg-zinc-900 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
              Tu cuenta
            </p>
            <h2 id="account-sheet-title" className="truncate text-lg font-bold">
              Cuenta y sincronización
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800/80 text-zinc-300 transition hover:text-white active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-300">
                <Icon.User className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-200">Cuenta de Google</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Identifica tu cuenta para guardar tus series en tu propio archivo de
                  sincronización.
                </p>
              </div>
            </div>

            {user ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-10 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
                  />
                ) : (
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-amber-400 text-sm font-bold text-white">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-95"
                >
                  <Icon.LogOut className="size-3.5" />
                  Salir
                </button>
              </div>
            ) : clientId ? (
              <div className="mt-3">
                <div
                  ref={googleButtonRef}
                  className="flex min-h-11 items-center justify-center"
                />

                {googleError && (
                  <p className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
                    {googleError}
                  </p>
                )}

                <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-600">
                  Solo se leen tu nombre, correo y foto. La sesión se guarda en este
                  navegador.
                </p>

                <button
                  type="button"
                  onClick={() => setShowClientId((value) => !value)}
                  className="mt-2 w-full text-center text-[11px] font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-300"
                >
                  {showClientId ? 'Ocultar Client ID' : 'Cambiar Client ID'}
                </button>

                {showClientId && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={draftClientId}
                      onChange={(event) => setDraftClientId(event.target.value)}
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                    />
                    <button
                      type="button"
                      onClick={saveClientId}
                      disabled={!draftClientId.trim()}
                      className="w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Guardar Client ID
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <label
                  htmlFor="google-client-id"
                  className="text-xs font-medium text-zinc-400"
                >
                  Client ID de Google
                </label>
                <input
                  id="google-client-id"
                  type="text"
                  value={draftClientId}
                  onChange={(event) => setDraftClientId(event.target.value)}
                  placeholder="1234567890-abc.apps.googleusercontent.com"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                />
                <button
                  type="button"
                  onClick={saveClientId}
                  disabled={!draftClientId.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.User className="size-4" />
                  Guardar Client ID
                </button>

                {googleError && (
                  <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
                    {googleError}
                  </p>
                )}
              </div>
            )}

            <details className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer select-none font-medium text-zinc-300">
                Cómo crear el Client ID de Google (5 minutos)
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                <li>
                  Entra en{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-rose-300 underline decoration-rose-300/30 underline-offset-2"
                  >
                    Credenciales de Google Cloud
                  </a>{' '}
                  y crea o elige un proyecto.
                </li>
                <li>
                  Si es la primera vez, configura la pantalla de consentimiento como{' '}
                  <span className="text-zinc-200">External</span> y añade tu correo como
                  usuario de prueba.
                </li>
                <li>
                  Pulsa <span className="text-zinc-200">Crear credenciales</span> →{' '}
                  <span className="text-zinc-200">ID de cliente OAuth</span> →{' '}
                  <span className="text-zinc-200">Aplicación web</span>.
                </li>
                <li>
                  En <span className="text-zinc-200">Orígenes JavaScript autorizados</span>{' '}
                  añade:
                  <code className="mt-1 block rounded bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-300">
                    https://javiersanzgarcia.github.io
                  </code>
                  <code className="mt-1 block rounded bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-300">
                    http://localhost:5173
                  </code>
                </li>
                <li>
                  Copia el Client ID (termina en{' '}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                    .apps.googleusercontent.com
                  </code>
                  ) y pégalo arriba.
                </li>
              </ol>
            </details>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
                <Icon.Cloud className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-200">
                    Sincronización en GitHub
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Guarda tus series en un JSON dentro de un repositorio de GitHub. Sin
                  backend: la app usa la API de GitHub con tu token.
                </p>
              </div>
            </div>

            {message && (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
                  message.kind === 'error'
                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                    : message.kind === 'ok'
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : 'border-zinc-700 bg-zinc-950/60 text-zinc-300'
                }`}
              >
                {message.text}
              </p>
            )}

            {editingSync ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="sync-token"
                    className="text-xs font-medium text-zinc-400"
                  >
                    Token de GitHub
                  </label>
                  <div className="relative mt-1.5">
                    <Icon.Key className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="sync-token"
                      type={showToken ? 'text' : 'password'}
                      value={draft.token}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          token: event.target.value,
                        }))
                      }
                      placeholder="github_pat_…"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 py-3 pl-10 pr-12 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((value) => !value)}
                      aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                      {showToken ? (
                        <Icon.EyeOff className="size-4" />
                      ) : (
                        <Icon.Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label
                      htmlFor="sync-repo"
                      className="text-xs font-medium text-zinc-400"
                    >
                      Repositorio
                    </label>
                    <input
                      id="sync-repo"
                      type="text"
                      value={draft.repo}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          repo: event.target.value,
                        }))
                      }
                      placeholder="usuario/cdramalist-data"
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="sync-branch"
                      className="text-xs font-medium text-zinc-400"
                    >
                      Rama
                    </label>
                    <input
                      id="sync-branch"
                      type="text"
                      value={draft.branch}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          branch: event.target.value,
                        }))
                      }
                      placeholder="main"
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="sync-path"
                      className="text-xs font-medium text-zinc-400"
                    >
                      Ruta del JSON
                    </label>
                    <input
                      id="sync-path"
                      type="text"
                      value={draft.path}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          path: event.target.value,
                        }))
                      }
                      placeholder="cdramalist/data.json"
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">
                      Sincronización automática
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Sube los cambios 2 segundos después de cada edición.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.auto}
                    aria-label="Sincronización automática"
                    onClick={() =>
                      setDraft((current) => ({ ...current, auto: !current.auto }))
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      draft.auto ? 'bg-rose-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                        draft.auto ? 'left-[1.375rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {syncDraftError && (
                  <p className="text-[11px] leading-relaxed text-amber-300/90">
                    {syncDraftError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveSync()}
                    disabled={Boolean(syncDraftError) || busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Check className="size-4" />
                    Guardar y comprobar
                  </button>
                  {configured && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(syncConfig)
                        setEditingSync(false)
                      }}
                      className="rounded-2xl border border-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-400 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Repositorio
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">
                    {syncConfig.repo}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-zinc-500">
                    {syncConfig.branch} · {syncConfig.path}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {lastSync
                      ? `Última sincronización: ${lastSync}`
                      : 'Todavía no se ha sincronizado.'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">
                      Sincronización automática
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      {syncConfig.auto
                        ? 'Activa: los cambios se suben solos.'
                        : 'Desactivada: usa los botones manuales.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={syncConfig.auto}
                    aria-label="Sincronización automática"
                    onClick={() =>
                      onSyncConfigChange({
                        ...syncConfig,
                        auto: !syncConfig.auto,
                      })
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      syncConfig.auto ? 'bg-rose-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                        syncConfig.auto ? 'left-[1.375rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onSync}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.RefreshCw
                    className={`size-4 ${busy ? 'animate-spin' : ''}`}
                  />
                  {busy ? 'Sincronizando…' : 'Sincronizar y combinar'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onUpload}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Upload className="size-4" />
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Download className="size-4" />
                    Bajar
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(syncConfig)
                      setEditingSync(true)
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
                  >
                    <Icon.Key className="size-4" />
                    Editar conexión
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-[0.99]"
                  >
                    <Icon.CloudOff className="size-4" />
                    Desconectar
                  </button>
                </div>

                <p className="text-[11px] leading-relaxed text-zinc-600">
                  Sincronizar combina ambos lados. Subir reemplaza la nube con este
                  dispositivo y Bajar reemplaza este dispositivo con la nube.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
              <Icon.Shield className="mt-0.5 size-4 shrink-0" />
              <span>
                El token se guarda solo en este navegador. Usa un repositorio privado y un
                token fine-grained con permiso únicamente de{' '}
                <span className="font-semibold">Contents: Read and write</span>.
              </span>
            </div>

            <details className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer select-none font-medium text-zinc-300">
                Cómo crear el repositorio y el token (5 minutos)
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                <li>
                  Crea un repositorio <span className="text-zinc-200">privado</span> en
                  GitHub para tus datos, por ejemplo{' '}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                    cdramalist-data
                  </code>
                  . No hace falta que tenga GitHub Pages.
                </li>
                <li>
                  Entra en{' '}
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-rose-300 underline decoration-rose-300/30 underline-offset-2"
                  >
                    Fine-grained tokens
                  </a>{' '}
                  y crea un token nuevo.
                </li>
                <li>
                  En <span className="text-zinc-200">Repository access</span> elige solo
                  ese repositorio.
                </li>
                <li>
                  En <span className="text-zinc-200">Permissions → Contents</span>{' '}
                  selecciona <span className="text-zinc-200">Read and write</span>.
                </li>
                <li>
                  Genera el token, cópialo y pégalo arriba junto al repositorio en formato{' '}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                    usuario/repositorio
                  </code>
                  .
                </li>
              </ol>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                La ruta recomendada incluye tu identificador de Google (
                <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                  cdramalist/&lt;id&gt;.json
                </code>
                ) para que cada cuenta tenga su propio archivo.
              </p>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
