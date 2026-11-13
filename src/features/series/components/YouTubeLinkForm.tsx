import type { FormEventHandler } from 'react'
import * as Icon from '../../../shared/components/Icons'

interface YouTubeLinkFormProps {
  mode: 'add' | 'create'
  apiKeyAvailable: boolean
  url: string
  onUrlChange: (value: string) => void
  onPaste: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onOpenSettings: () => void
}

export function YouTubeLinkForm({
  mode,
  apiKeyAvailable,
  url,
  onUrlChange,
  onPaste,
  onSubmit,
  onOpenSettings
}: YouTubeLinkFormProps) {
  const isAddMode = mode === 'add'

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="youtube-url" className="text-xs font-medium text-ink-muted">
        Enlace de YouTube
      </label>
      <div className="relative mt-1.5">
        <Icon.Youtube className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        <input
          id="youtube-url"
          name="youtube-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          autoComplete="off"
          autoFocus
          className="w-full rounded-2xl border border-line bg-canvas/70 py-3 pl-10 pr-20 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={onPaste}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:bg-surface-strong hover:text-ink-bright active:scale-95"
        >
          <Icon.LinkIcon className="size-3.5" />
          Pegar
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
        {isAddMode
          ? 'Pega el enlace de la parte nueva. Si está en una lista, también puedes pegarla: las partes que ya están en la serie se marcarán como «Ya en la serie» y no se duplicarán.'
          : 'Acepta vídeos, Shorts y listas de reproducción. Si el canal agrupa las partes en una lista, pégala para importarlas todas de golpe.'}
      </p>

      {!apiKeyAvailable && (
        <div className="mt-3 rounded-2xl border border-warning/20 bg-warning/5 p-3">
          <p className="text-xs leading-relaxed text-warning-softer/85">
            Sin clave de YouTube solo podemos añadir un vídeo cada vez. Configura la clave para
            buscar todas las partes automáticamente.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-[11px] font-semibold text-warning-softer transition hover:bg-warning/25 active:scale-95"
          >
            <Icon.Key className="size-3.5" />
            Configurar clave
          </button>
        </div>
      )}

      <button
        type="submit"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-bright shadow-lg shadow-brand/25 transition hover:bg-brand-bright active:scale-[0.99]"
      >
        <Icon.Sparkles className="size-4" />
        {isAddMode ? 'Buscar partes nuevas' : 'Buscar partes'}
      </button>
    </form>
  )
}
