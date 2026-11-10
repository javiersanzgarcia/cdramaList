import { useSheet } from "../../../shared/hooks/useSheet";
import type { DriveSync } from "../../sync/hooks/useDriveSync";
import { formatDateTime } from "../../../shared/lib/format";
import type { GoogleUser } from "../../sync/types";
import * as Icon from "../../../shared/components/Icons";

interface AccountSheetProps {
  user: GoogleUser | null;
  clientId: string;
  drive: DriveSync;
  onClose: () => void;
}

export function AccountSheet({
  user,
  clientId,
  drive,
  onClose,
}: AccountSheetProps) {
  useSheet(onClose);

  const busy = drive.busy;
  const signedIn = Boolean(user) || drive.connected;
  const accountName = user?.name ?? drive.email ?? "Cuenta de Google";
  const accountEmail = user?.email ?? drive.email ?? "";
  const lastSync = formatDateTime(drive.lastSyncedAt ?? undefined);

  const statusLabel = busy
    ? "Sincronizando…"
    : drive.status === "error"
      ? "Error"
      : drive.dirty
        ? "Cambios pendientes"
        : drive.connected
          ? "Conectado"
          : "Sin conectar";

  const statusClass = busy
    ? "bg-amber-400/15 text-amber-300"
    : drive.status === "error" || drive.dirty
      ? "bg-rose-500/15 text-rose-300"
      : drive.connected
        ? "bg-emerald-400/15 text-emerald-300"
        : "bg-zinc-800 text-zinc-400";

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
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/95 text-zinc-900">
                <Icon.Google className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Cuenta de Google
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Conecta tu cuenta para sincronizar tus series entre
                  dispositivos con una carpeta privada de Google Drive.
                </p>
              </div>
            </div>

            {signedIn ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-10 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
                  />
                ) : (
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-amber-400 text-sm font-bold text-white">
                    {accountName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {accountName}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {accountEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={drive.disconnect}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/20 transition hover:bg-zinc-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Google className="size-5" />
                  {busy ? "Conectando…" : "Conectar con Google Drive"}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-zinc-600">
                  Se pedirá permiso para guardar un archivo privado de
                  CdramaList en tu Drive. La app no puede ver el resto de tus
                  archivos.
                </p>
              </div>
            )}

            {!clientId && (
              <p className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
                Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code>. Consulta el
                README para activar Google Drive.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
                <Icon.Cloud className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-200">
                    Sincronización en Google Drive
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Tus series se guardan en{" "}
                  <span className="text-zinc-300">cdramalist.json</span> dentro
                  de la carpeta privada de la app en tu Drive.
                </p>
              </div>
            </div>

            {drive.message && (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
                  drive.message.kind === "error"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                    : drive.message.kind === "ok"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-zinc-700 bg-zinc-950/60 text-zinc-300"
                }`}
              >
                {drive.message.text}
              </p>
            )}

            {drive.connected ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Cuenta conectada
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">
                    {accountEmail || "Cuenta de Google"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {lastSync
                      ? `Última sincronización: ${lastSync}`
                      : "Todavía no se ha sincronizado."}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">
                      Sincronización automática
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      {drive.auto
                        ? "Activa: los cambios se suben solos."
                        : "Desactivada: usa los botones manuales."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={drive.auto}
                    aria-label="Sincronización automática"
                    onClick={() => drive.setAuto(!drive.auto)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      drive.auto ? "bg-rose-500" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                        drive.auto ? "left-[1.375rem]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void drive.syncNow()}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.RefreshCw
                    className={`size-4 ${busy ? "animate-spin" : ""}`}
                  />
                  {busy ? "Sincronizando…" : "Sincronizar y combinar"}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void drive.upload()}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Upload className="size-4" />
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => void drive.download()}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon.Download className="size-4" />
                    Bajar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={drive.disconnect}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.CloudOff className="size-4" />
                  Desconectar Google Drive
                </button>

                <p className="text-[11px] leading-relaxed text-zinc-600">
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-black/20 transition hover:bg-zinc-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon.Google className="size-5" />
                  {busy
                    ? "Conectando…"
                    : user
                      ? "Reconectar Google Drive"
                      : "Conectar con Google Drive"}
                </button>
                <p className="text-center text-[11px] leading-relaxed text-zinc-600">
                  {user
                    ? "La sesión de Google ha caducado. Vuelve a conectar para reanudar la sincronización."
                    : "Conecta tu cuenta de Google para activar la sincronización entre dispositivos."}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code>. Consulta el
                README para activar Google Drive.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-200/80">
              <Icon.Shield className="mt-0.5 size-4 shrink-0" />
              <span>
                Los datos se guardan en la carpeta privada{" "}
                <code>appDataFolder</code> de tu Google Drive. CdramaList solo
                puede acceder a sus propios archivos, no al resto de tu Drive.
              </span>
            </div>

            <details className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
              <summary className="cursor-pointer select-none font-medium text-zinc-300">
                Cómo activar Google Drive (5 minutos)
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
                <li>
                  En{" "}
                  <a
                    href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-rose-300 underline decoration-rose-300/30 underline-offset-2"
                  >
                    Google Cloud
                  </a>
                  , activa la{" "}
                  <span className="text-zinc-200">Google Drive API</span>.
                </li>
                <li>
                  En la pantalla de consentimiento OAuth, añade el permiso{" "}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                    https://www.googleapis.com/auth/drive.appdata
                  </code>
                  .
                </li>
                <li>
                  Añade tu correo como usuario de prueba mientras la app esté en
                  modo pruebas.
                </li>
                <li>
                  Usa el mismo <span className="text-zinc-200">Client ID</span>{" "}
                  de tipo «Aplicación web» que ya utiliza la app.
                </li>
              </ol>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
