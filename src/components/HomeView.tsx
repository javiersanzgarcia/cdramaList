import type { Drama, Filter, StatusMap } from "../types";
import { DramaCard } from "./DramaCard";
import { EmptyState } from "./EmptyState";
import { FilterChips } from "./FilterChips";
import * as Icon from "./Icons";
import { SearchBar } from "./SearchBar";
import { TopBar } from "./TopBar";

interface HomeViewProps {
  dramas: Drama[];
  query: string;
  filter: Filter;
  statuses: StatusMap;
  favorites: string[];
  canInstall: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (filter: Filter) => void;
  onOpen: (drama: Drama) => void;
  onToggleFavorite: (id: string) => void;
  onInstall: () => void;
}

export function HomeView({
  dramas,
  query,
  filter,
  statuses,
  favorites,
  canInstall,
  onQueryChange,
  onFilterChange,
  onOpen,
  onToggleFavorite,
  onInstall,
}: HomeViewProps) {
  const sectionTitle =
    filter === "favorites" ? "Tus favoritos" : "Dramas para maratonear";

  function clearFilters() {
    onQueryChange("");
    onFilterChange("all");
  }

  return (
    <>
      <TopBar
        eyebrow="Tu drama, tu ritmo"
        title="CdramaList"
        canInstall={canInstall}
        onInstall={onInstall}
      />

      <section className="px-4 pt-5">
        <h2 className="text-2xl font-bold tracking-tight">¿Qué vemos hoy?</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Descubre, guarda y sigue tus dramas chinos favoritos.
        </p>

        <SearchBar value={query} onChange={onQueryChange} />
        <FilterChips value={filter} onChange={onFilterChange} />
      </section>

      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-red-500">{sectionTitle}</h3>
          <span className="shrink-0 text-xs text-zinc-500">
            {dramas.length} {dramas.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        {dramas.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {dramas.map((drama) => (
              <DramaCard
                key={drama.id}
                drama={drama}
                status={statuses[drama.id]}
                isFavorite={favorites.includes(drama.id)}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Icon.Search className="size-6" />}
            title="Sin resultados"
            description={
              query.length > 0
                ? `No encontramos dramas para «${query}». Prueba con otro título o género.`
                : "Todavía no tienes dramas en este apartado. Marca uno como viendo, pendiente o visto."
            }
            actionLabel="Ver todos los dramas"
            onAction={clearFilters}
          />
        )}
      </section>
    </>
  );
}
