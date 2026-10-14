"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { GENRES } from "@/lib/data/genres";
import type { Genre, MediaKind } from "@/lib/types";
import { cn } from "@/lib/cn";

export type KindFilter = MediaKind | "all";
export type SortKey = "match" | "rating" | "newest";

export interface Filters {
  query: string;
  kind: KindFilter;
  genre: Genre | "all";
  myServicesOnly: boolean;
  sort: SortKey;
}

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

const KINDS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
];

/** Search (fuzzy) + category, genre, availability and sort controls. */
export function FilterBar({ filters, onChange }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like most media apps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && onChange({ query: "" })}
            placeholder="Search titles, actors, directors… typos welcome"
            aria-label="Search titles"
            className="h-11 w-full rounded-xl bg-surface-2 pl-10 pr-16 text-sm outline-none ring-1 ring-inset ring-line transition placeholder:text-white/30 focus:ring-2 focus:ring-ember [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query ? (
            <button
              onClick={() => onChange({ query: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">
              /
            </kbd>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Movie / Series segmented control */}
          <div role="group" aria-label="Category" className="flex rounded-xl bg-surface-2 p-1 ring-1 ring-inset ring-line">
            {KINDS.map((k) => (
              <button
                key={k.id}
                aria-pressed={filters.kind === k.id}
                onClick={() => onChange({ kind: k.id })}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
                  filters.kind === k.id ? "bg-white text-ink" : "text-muted hover:text-white",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Availability toggle */}
          <button
            role="switch"
            aria-checked={filters.myServicesOnly}
            onClick={() => onChange({ myServicesOnly: !filters.myServicesOnly })}
            className="flex h-11 items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 text-sm ring-1 ring-inset ring-line transition hover:bg-white/[0.08]"
          >
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition",
                filters.myServicesOnly ? "bg-ember" : "bg-white/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                  filters.myServicesOnly ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
            My services
          </button>

          {/* Sort */}
          <label className="relative">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="h-11 appearance-none rounded-xl bg-surface-2 pl-3.5 pr-9 text-sm outline-none ring-1 ring-inset ring-line transition hover:bg-white/[0.08] focus:ring-2 focus:ring-ember"
            >
              <option value="match">Best match</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          </label>
        </div>
      </div>

      {/* Genre chips — horizontally scrollable on small screens */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", ...GENRES] as const).map((g) => (
          <button
            key={g}
            aria-pressed={filters.genre === g}
            onClick={() => onChange({ genre: g })}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              filters.genre === g
                ? "bg-white/90 text-ink"
                : "text-muted ring-1 ring-inset ring-line hover:text-white hover:ring-white/25",
            )}
          >
            {g === "all" ? "All genres" : g}
          </button>
        ))}
      </div>
    </div>
  );
}
