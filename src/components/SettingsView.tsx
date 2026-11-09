import { useState } from 'react'
import type { GoogleUser } from '../types'
import * as Icon from './Icons'
import { TopBar } from './TopBar'

interface SettingsViewProps {
  apiKey: string
  apiKeyLocked: boolean
  seriesCount: number
  watchedPartsCount: number
  favoriteCount: number
  canInstall: boolean
  googleUser: GoogleUser | null
  syncEnabled: boolean
  syncDirty: boolean
  syncBusy: boolean
  onApiKeyChange: (key: string) => void
  onInstall: () => void
  onReset: () => void
  onExport: () => void
  onImport: (file: File) => void
  onOpenAccount: () => void
}

export function SettingsView({
  apiKey,
  apiKeyLocked,
  seriesCount,
  watchedPartsCount,
  favoriteCount,
  canInstall,
  googleUser,
  syncEnabled,
  syncDirty,
  syncBusy,
  onApiKeyChange,
  onInstall,
  onReset,
  onExport,
  onImport,
  onOpenAccount,
}: SettingsViewProps) {
  const [draftKey, setDraftKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)

  const saved = draftKey.trim() === apiKey && apiKey.length > 0

  function handleSaveKey() {
    const value = draftKey.trim()
    if (!value) return
    onApiKeyChange(value)
    setShowKey(false)
  }

  function handleClearKey() {
    setDraftKey('')
    onApiKeyChange('')
    setShowKey(false)
  }

  function handleReset() {
    const confirmed = window.confirm(
      syncEnabled
        ? '¿Seguro que quieres borrar todas tus series y tu progreso? Si la sincronización automática está activa, también se borrarán en la nube.'
        : '¿Seguro que quieres borrar todas tus series y tu progreso? Esta acción no se puede deshacer.',
    )
    if (confirmed) onReset()
  }

  return (
    <>
      <TopBar
        eyebrow="Preferencias y datos"
        title="Ajustes"
        canInstall={canInstall}
        onInstall={onInstall}
        user={googleUser}
        syncDirty={syncDirty}
        syncBusy={syncBusy}
        onOpenAccount={onOpenAccount}
      />

      <div className="space-y-4 px-4 pt-5">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <button
            type="button"
            onClick={onOpenAccount}
            className="flex w-full items-center gap-3 text-left"
          >
            {googleUser?.picture ? (
              <img
                src={googleUser.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="size-12 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
              />
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-800 text-zinc-300">
                <Icon.User className="size-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-zinc-200">
                Cuenta y sincronización
              </h2>
              <p className="truncate text-xs text-zinc-500">
                {googleUser ? googleUser.email : 'Inicia sesión con Google'}
              </p>
              <p
                className={`mt-0.5 text-[11px] ${
                  syncEnabled
                    ? syncDirty
                      ? 'text-rose-300'
                      : 'text-emerald-300'
                    : 'text-zinc-600'
                }`}
              >
                {syncEnabled
                  ? syncDirty
                    ? 'Cambios pendientes de subir'
                    : 'Sincronización activa'
                  : 'Solo en este dispositivo'}
              </p>
            </div>
            <Icon.ChevronRight className="size-5 shrink-0 text-zinc-500" />
          </button>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 text-xl font-black text-white shadow-lg shadow-rose-500/25">
              C
            </div>
            <div>
              <p className="font-semibold">CdramaList</p>
              <p className="text-xs text-zinc-500">Versión 0.3.0 · PWA</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Encuentra todas las partes de tus historias de YouTube y continúa donde lo
            dejaste. Tus series y tu progreso se guardan en este dispositivo y, si
            conectas Google Drive, también en tu cuenta.
          </p>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-300">
              <Icon.Key className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-200">Búsqueda automática</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Con una clave gratuita de YouTube Data API v3, la app busca las partes en
                el canal y las ordena por ti.
              </p>
            </div>
          </div>

          {apiKeyLocked ? (
            <p className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-emerald-300/80">
              Clave configurada por la aplicación.
            </p>
          ) : (
            <div className="mt-3">
              <label
                htmlFor="youtube-api-key"
                className="text-xs font-medium text-zinc-400"
              >
                Clave de API de YouTube
              </label>
              <div className="relative mt-1.5">
                <Icon.Key className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="youtube-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={draftKey}
                  onChange={(event) => setDraftKey(event.target.value)}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 py-3 pl-10 pr-12 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  {showKey ? <Icon.EyeOff className="size-4" /> : <Icon.Eye className="size-4" />}
                </button>
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={!draftKey.trim() || saved}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saved ? <Icon.Check className="size-4" /> : <Icon.Key className="size-4" />}
                  {saved ? 'Clave guardada' : 'Guardar clave'}
                </button>
                {apiKey.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="rounded-2xl border border-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-[0.99]"
                  >
                    Borrar
                  </button>
                )}
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                La clave se guarda solo en este dispositivo y nunca se sube a Google
                Drive.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">Mis datos</h2>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-2xl font-bold text-zinc-100">{seriesCount}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Series</p>
            </div>
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-2xl font-bold text-zinc-100">{watchedPartsCount}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Partes vistas</p>
            </div>
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-2xl font-bold text-zinc-100">{favoriteCount}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Favoritas</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]"
            >
              <Icon.Download className="size-4" />
              Exportar
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99]">
              <Icon.Upload className="size-4" />
              Importar
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onImport(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            Exporta una copia antes de borrar los datos del navegador o cambiar de
            dispositivo.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-[0.99]"
          >
            <Icon.Trash className="size-4" />
            Borrar series y progreso
          </button>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">Instalación</h2>

          {canInstall ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Añade CdramaList a tu pantalla de inicio y ábrela como una app nativa.
              </p>
              <button
                type="button"
                onClick={onInstall}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99]"
              >
                <Icon.Download className="size-4" />
                Instalar en el móvil
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Abre el menú del navegador y elige{' '}
              <span className="font-medium text-zinc-200">«Añadir a pantalla de inicio»</span>{' '}
              para usar la app como una aplicación nativa.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-zinc-800/80 text-zinc-400">
              <Icon.Info className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Sobre las partes</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                La detección automática busca en el canal y reconoce títulos como «Parte
                2», «P2», «2/5», «Capítulo 2» o «Final». Si un canal no numera las
                partes, puedes añadirlas a mano desde la serie.
              </p>
            </div>
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-zinc-600">
          Hecho con React, Vite y Tailwind CSS
        </p>
      </div>
    </>
  )
}
