import * as Icon from './Icons'
import { TopBar } from './TopBar'

interface SettingsViewProps {
  savedCount: number
  favoritesCount: number
  canInstall: boolean
  onInstall: () => void
  onReset: () => void
}

export function SettingsView({
  savedCount,
  favoritesCount,
  canInstall,
  onInstall,
  onReset,
}: SettingsViewProps) {
  function handleReset() {
    const confirmed = window.confirm(
      '¿Seguro que quieres borrar tu progreso y tus favoritos? Esta acción no se puede deshacer.',
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
      />

      <div className="space-y-4 px-4 pt-5">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 text-xl font-black text-white shadow-lg shadow-rose-500/25">
              C
            </div>
            <div>
              <p className="font-semibold">CdramaList</p>
              <p className="text-xs text-zinc-500">Versión 0.1.0 · PWA</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Tu lista personal de dramas chinos. Funciona sin conexión y guarda tus datos en este
            dispositivo.
          </p>
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
                Instalar en Android
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Abre el menú del navegador y elige{' '}
              <span className="font-medium text-zinc-200">«Añadir a pantalla de inicio»</span> para
              usar la app como una aplicación nativa.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">Mis datos</h2>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-2xl font-bold text-zinc-100">{savedCount}</p>
              <p className="mt-0.5 text-xs text-zinc-500">En mi lista</p>
            </div>
            <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
              <p className="text-2xl font-bold text-zinc-100">{favoritesCount}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Favoritos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-[0.99]"
          >
            <Icon.Trash className="size-4" />
            Borrar mi progreso
          </button>
        </section>

        <p className="pb-2 text-center text-xs text-zinc-600">
          Hecho con React, Vite y Tailwind CSS
        </p>
      </div>
    </>
  )
}
