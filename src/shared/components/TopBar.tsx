import type { GoogleUser } from "../../features/sync/types";
import * as Icon from "./Icons";

interface TopBarProps {
  eyebrow: string;
  title: string;
  canInstall: boolean;
  onInstall: () => void;
  user: GoogleUser | null;
  syncDirty: boolean;
  syncBusy: boolean;
  onOpenAccount: () => void;
}

export function TopBar({
  eyebrow,
  title,
  canInstall,
  onInstall,
  user,
  syncDirty,
  syncBusy,
  onOpenAccount,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-900/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)_+_0.9rem)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 text-lg font-black text-white shadow-lg shadow-rose-500/25">
            C
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400">
              {eyebrow}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canInstall && (
            <button
              type="button"
              onClick={onInstall}
              aria-label="Instalar aplicación"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-white active:scale-95"
            >
              <Icon.Download className="size-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Abrir cuenta y sincronización"
            className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-white active:scale-95"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <Icon.User className="size-5" />
            )}

            {(syncBusy || syncDirty) && (
              <span
                className={`absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-zinc-950 ${
                  syncBusy ? "animate-pulse bg-amber-400" : "bg-rose-400"
                }`}
              />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
