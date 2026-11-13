import { useSheet } from '../../../shared/hooks/useSheet'
import type { DriveSync } from '../../sync/types'
import { formatDateTime } from '../../../shared/lib/format'
import type { GoogleUser } from '../../sync/types'
import * as Icon from '../../../shared/components/Icons'

interface AccountSheetProps {
  user: GoogleUser | null
  clientId: string
  drive: DriveSync
  onClose: () => void
}

export function AccountSheet({
  user,
  clientId,
  drive,
  onClose
}: AccountSheetProps) {
  useSheet(onClose)

  const busy = drive.busy
  const signedIn = Boolean(user) || drive.connected
  const accountName = user?.name ?? drive.email ?? 'Cuenta de Google'
  const accountEmail = user?.email ?? drive.email ?? ''
  const lastSync = formatDateTime(drive.lastSyncedAt ?? undefined)

  const statusLabel = busy
    ? 'Sincronizando…'
    : drive.status === 'error'
      ? 'Error'
      : drive.dirty
        ? 'Cambios pendientes'
        : drive.connected
          ? 'Conectado'
          : 'Sin conectar'

  const statusClass = busy
    ? 'bg-warning/15 text-warning-soft'
    : drive.status === 'error' || drive.dirty
      ? 'bg-brand/15 text-brand-soft'
      : drive.connected
        ? 'bg-success/15 text-success-soft'
        : 'bg-surface-raised text-ink-muted'

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
        className="absolute inset-0 animate-fade-in bg-overlay/70 backdrop-blur-sm"
      />

      <div className="no-scrollbar relative max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line/80 bg-surface/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-bright">
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
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised/80 text-ink-soft transition hover:text-ink-bright active:scale-90"
          >
            <Icon.X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          <section className="rounded-3xl border border-line bg-surface/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-paper/95 text-ink-inverse">
                <Icon.Google className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink-strong">
                  Cuenta de Google
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                  Conecta tu cuenta para sincronizar tus series entre
                  dispositivos con una carpeta privada de Google Drive.
                </p>
              </div>
            </div>

            {signedIn ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-10 shrink-0 rounded-full object-cover ring-1 ring-line-strong"
                  />
                ) : (
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-warning text-sm font-bold text-ink-bright">
                    {accountName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {accountName}
                  </p>
                  <p className="truncate text-xs text-ink-subtle">
                    {accountEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={drive.disconnect}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-ink-muted transition hover:border-brand/40 hover:text-brand-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.LogOut className="size-3.5" />
                  Salir
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => void drive.connect()}
                  disabled={busy || !clientId}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-paper px-4 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-overlay/20 transition hover:bg-paper-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Google className="size-5" />
                  {busy ? 'Conectando…' : 'Conectar con Google Drive'}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-ink-faint">
                  Se pedirá permiso para guardar un archivo privado de
                  CdramaList en tu Drive. La app no puede ver el resto de tus
                  archivos.
                </p>
              </div>
            )}

            {!clientId && (
              <p className="mt-3 rounded-2xl border border-brand/20 bg-brand/10 px-3 py-2 text-[11px] leading-relaxed text-brand-softer">
                Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code>. Consulta el
                README para activar Google Drive.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-line bg-surface/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-warning/10 text-warning-soft">
                <Icon.Cloud className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-ink-strong">
                    Sincronización en Google Drive
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                  Tus series se guardan en{' '}
                  <span className="text-ink-soft">cdramalist.json</span> dentro
                  de la carpeta privada de la app en tu Drive.
                </p>
              </div>
            </div>

            {drive.message && (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
                  drive.message.kind === 'error'
                    ? 'border-brand/20 bg-brand/10 text-brand-softer'
                    : drive.message.kind === 'ok'
                      ? 'border-success/20 bg-success/10 text-success-softer'
                      : 'border-line-strong bg-canvas/60 text-ink-soft'
                }`}
              >
                {drive.message.text}
              </p>
            )}

            {drive.connected ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Cuenta conectada
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink-strong">
                    {accountEmail || 'Cuenta de Google'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {lastSync
                      ? `Última sincronización: ${lastSync}`
                      : 'Todavía no se ha sincronizado.'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas/60 p-3 ring-1 ring-line">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-strong">
                      Sincronización automática
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-subtle">
                      {drive.auto
                        ? 'Activa: los cambios se suben solos.'
                        : 'Desactivada: usa los botones manuales.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={drive.auto}
                    aria-label="Sincronización automática"
                    onClick={() => drive.setAuto(!drive.auto)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      drive.auto ? 'bg-brand' : 'bg-surface-strong'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-paper shadow transition-all ${
                        drive.auto ? 'left-[1.375rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void drive.syncNow()}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-bright shadow-lg shadow-brand/25 transition hover:bg-brand-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.RefreshCw
                    className={`size-4 ${busy ? 'animate-spin' : ''}`}
                  />
                  {busy ? 'Sincronizando…' : 'Sincronizar y combinar'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void drive.upload()}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-line px-3 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Upload className="size-4" />
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => void drive.download()}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-line px-3 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink-bright active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Download className="size-4" />
                    Bajar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={drive.disconnect}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand/40 hover:text-brand-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.CloudOff className="size-4" />
                  Desconectar Google Drive
                </button>

                <p className="text-[11px] leading-relaxed text-ink-faint">
                  Sincronizar combina ambos lados. Subir reemplaza la nube con
                  este dispositivo y Bajar reemplaza este dispositivo con la
                  nube.
                </p>
              </div>
            ) : clientId ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => void drive.connect()}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-paper px-4 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-overlay/20 transition hover:bg-paper-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Google className="size-5" />
                  {busy
                    ? 'Conectando…'
                    : user
                      ? 'Reconectar Google Drive'
                      : 'Conectar con Google Drive'}
                </button>
                <p className="text-center text-[11px] leading-relaxed text-ink-faint">
                  {user
                    ? 'La sesión de Google ha caducado. Vuelve a conectar para reanudar la sincronización.'
                    : 'Conecta tu cuenta de Google para activar la sincronización entre dispositivos.'}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code>. Consulta el
                README para activar Google Drive.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-success/15 bg-success/5 px-3 py-2.5 text-[11px] leading-relaxed text-success-softer/80">
              <Icon.Shield className="mt-0.5 size-4 shrink-0" />
              <span>
                Los datos se guardan en la carpeta privada{' '}
                <code>appDataFolder</code> de tu Google Drive. CdramaList solo
                puede acceder a sus propios archivos, no al resto de tu Drive.
              </span>
            </div>

            <details className="mt-3 rounded-2xl border border-line bg-canvas/50 p-3 text-xs text-ink-muted">
              <summary className="cursor-pointer select-none font-medium text-ink-soft">
                Cómo activar Google Drive (5 minutos)
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                <li>
                  En{' '}
                  <a
                    href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-soft underline decoration-brand-soft/30 underline-offset-2"
                  >
                    Google Cloud
                  </a>
                  , activa la{' '}
                  <span className="text-ink-strong">Google Drive API</span>.
                </li>
                <li>
                  En la pantalla de consentimiento OAuth, añade el permiso{' '}
                  <code className="rounded bg-surface-raised px-1 py-0.5 text-[10px] text-ink-soft">
                    https://www.googleapis.com/auth/drive.appdata
                  </code>
                  .
                </li>
                <li>
                  Añade tu correo como usuario de prueba mientras la app esté en
                  modo pruebas.
                </li>
                <li>
                  Usa el mismo{' '}
                  <span className="text-ink-strong">Client ID</span> de tipo
                  «Aplicación web» que ya utiliza la app.
                </li>
              </ol>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
