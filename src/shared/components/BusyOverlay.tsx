import * as Icon from './Icons'

interface BusyOverlayProps {
  open: boolean
  title: string
  message: string
}

/**
 * Capa modal que bloquea toda la interfaz mientras una operación crítica
 * (por ejemplo, actualizar una serie) está en curso. Evita cerrar el panel,
 * navegar o tocar cualquier control antes de que la operación termine.
 */
export function BusyOverlay({ open, title, message }: BusyOverlayProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/85 px-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="assertive"
      aria-label={title}
    >
      <div className="w-full max-w-xs rounded-3xl border border-line bg-surface p-5 text-center shadow-2xl shadow-overlay/60">
        <Icon.RefreshCw className="mx-auto size-8 animate-spin text-brand-bright" />
        <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{message}</p>
      </div>
    </div>
  )
}
