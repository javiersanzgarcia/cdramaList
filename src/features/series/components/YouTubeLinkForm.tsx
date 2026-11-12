import type { FormEventHandler } from 'react'
import * as Icon from '../../../shared/components/Icons'

interface YouTubeLinkFormProps {
  apiKeyAvailable: boolean
  url: string
  onUrlChange: (value: string) => void
  onPaste: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onOpenSettings: () => void
}

export function YouTubeLinkForm({
  apiKeyAvailable,
  url,
  onUrlChange,
  onPaste,
  onSubmit,
  onOpenSettings
}: YouTubeLinkFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <label
        htmlFor="youtube-url"
        className="text-xs font-medium text-zinc-400"
      >
        Enlace de YouTube
      </label>
      <div className="relative mt-1.5">
        <Icon.Youtube className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          id="youtube-url"
          name="youtube-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          autoComplete="off"
          autoFocus
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 py-3 pl-10 pr-20 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
        />
        <button
          type="button"
          onClick={onPaste}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-zinc-700 hover:text-white active:scale-95"
        >
          <Icon.LinkIcon className="size-3.5" />
          Pegar
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Acepta vídeos, Shorts y listas de reproducción. Si el canal agrupa las
        partes en una lista, pégala para importarlas todas de golpe.
      </p>

      {!apiKeyAvailable && (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
          <p className="text-xs leading-relaxed text-amber-200/85">
            Sin clave de YouTube solo podemos añadir un vídeo cada vez.
            Configura la clave para buscar todas las partes automáticamente.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-400/25 active:scale-95"
          >
            <Icon.Key className="size-3.5" />
            Configurar clave
          </button>
        </div>
      )}

      <button
        type="submit"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 active:scale-[0.99]"
      >
        <Icon.Sparkles className="size-4" />
        Buscar partes
      </button>
    </form>
  )
}
