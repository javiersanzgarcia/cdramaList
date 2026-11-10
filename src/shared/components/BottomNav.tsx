import type { Tab } from "../../app/types";
import * as Icon from "./Icons";

const items: { value: Tab; label: string; icon: typeof Icon.Home }[] = [
  { value: "home", label: "Inicio", icon: Icon.Home },
  { value: "list", label: "Mi lista", icon: Icon.Bookmark },
  { value: "settings", label: "Ajustes", icon: Icon.Settings },
];

interface BottomNavProps {
  tab: Tab;
  savedCount: number;
  onChange: (tab: Tab) => void;
}

export function BottomNav({ tab, savedCount, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-zinc-800/80 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const active = tab === item.value;
          const TabIcon = item.icon;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? "text-rose-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span
                className={`relative grid h-8 w-12 place-items-center rounded-full transition ${
                  active ? "bg-rose-500/10" : ""
                }`}
              >
                <TabIcon className="size-5" />
                {item.value === "list" && savedCount > 0 && (
                  <span className="absolute right-1.5 top-0 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {savedCount}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
