"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Shuffle } from "lucide-react";
import { MoodSelector } from "@/components/dashboard/MoodSelector";
import { FilterBar, type Filters } from "@/components/dashboard/FilterBar";
import { MovieCard } from "@/components/dashboard/MovieCard";
import { MOODS } from "@/lib/data/moods";
import { TITLES } from "@/lib/data/titles";
import { fuzzySearch } from "@/lib/fuzzy";
import { isOnMyServices, matchScore } from "@/lib/recommend";
import type { SentimentSummary } from "@/lib/sentiment/types";
import { useAppState } from "@/lib/store";
import type { Genre, MoodId, ServiceId, Title } from "@/lib/types";

const DEFAULT_FILTERS: Filters = {
  query: "",
  kind: "all",
  genre: "all",
  myServicesOnly: true,
  sort: "match",
};

interface Criteria {
  mood: MoodId | null;
  filters: Filters;
}

/**
 * Fallback ladder: if the exact combination finds nothing, loosen one
 * constraint at a time (least important first) until something matches, so
 * the grid always shows real, posterised recommendations.
 */
const RELAXATIONS: { label: string; relax: (c: Criteria) => Criteria }[] = [
  { label: "all services", relax: (c) => ({ ...c, filters: { ...c.filters, myServicesOnly: false } }) },
  { label: "any genre", relax: (c) => ({ ...c, filters: { ...c.filters, genre: "all" } }) },
  { label: "movies & series", relax: (c) => ({ ...c, filters: { ...c.filters, kind: "all" } }) },
  { label: "any mood", relax: (c) => ({ ...c, mood: null }) },
  { label: "without your search", relax: (c) => ({ ...c, filters: { ...c.filters, query: "" } }) },
];

function rank({ mood, filters }: Criteria, prefs: { services: ServiceId[]; genres: Genre[] }) {
  // 1) Structured filters
  const pool = TITLES.filter(
    (t) =>
      (!mood || t.moods.includes(mood)) &&
      (filters.kind === "all" || t.kind === filters.kind) &&
      (filters.genre === "all" || t.genres.includes(filters.genre)) &&
      (!filters.myServicesOnly || isOnMyServices(t, prefs.services)),
  );

  // 2) Fuzzy search — title hits outrank cast/keyword/genre hits
  const searched = fuzzySearch(pool, filters.query, (t) => [
    { text: t.title, weight: 1 },
    { text: t.keywords.join(" "), weight: 0.85 },
    { text: t.genres.join(" "), weight: 0.8 },
  ]);

  // 3) Score + sort. With an active query, relevance wins over the sort key.
  const scored = searched.map(({ item, score }) => ({ title: item, relevance: score, match: matchScore(item, prefs) }));
  const bySort = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    filters.sort === "rating"
      ? b.title.rating - a.title.rating
      : filters.sort === "newest"
        ? b.title.year - a.title.year
        : b.match - a.match;
  return scored.sort((a, b) => (filters.query.trim() ? b.relevance - a.relevance || bySort(a, b) : bySort(a, b)));
}

interface Props {
  sentiment: Record<string, SentimentSummary>;
  onOpen: (title: Title) => void;
  onWatchTogether: (title: Title) => void;
}

/**
 * "How are you feeling tonight?" — mood pills + filters + fuzzy search, all
 * combined (AND) into one instantly-updating recommendation grid.
 */
export function MoodRecommender({ sentiment, onOpen, onWatchTogether }: Props) {
  const { services, genres } = useAppState();
  const [mood, setMood] = useState<MoodId | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => {
    setMood(null);
    setFilters(DEFAULT_FILTERS);
  };

  const { results, relaxed } = useMemo(() => {
    const prefs = { services, genres };
    let criteria: Criteria = { mood, filters };
    let found = rank(criteria, prefs);
    const relaxed: string[] = [];
    for (const step of RELAXATIONS) {
      if (found.length) break;
      const next = step.relax(criteria);
      if (JSON.stringify(next) === JSON.stringify(criteria)) continue; // already loose
      criteria = next;
      relaxed.push(step.label);
      found = rank(criteria, prefs);
    }
    return { results: found, relaxed };
  }, [mood, filters, services, genres]);

  /** Highlight a random result and scroll it into view. */
  function surpriseMe() {
    if (!results.length) return;
    const pick = results[Math.floor(Math.random() * results.length)].title;
    setSpotlight(pick.id);
    document.getElementById(`title-${pick.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setSpotlight((s) => (s === pick.id ? null : s)), 2600);
  }

  const activeMood = MOODS.find((m) => m.id === mood);
  const ActiveIcon = activeMood?.icon;
  const hasFilters = mood !== null || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <section aria-labelledby="mood-heading" className="space-y-6">
      <div>
        <h2 id="mood-heading" className="font-display text-4xl tracking-wide sm:text-5xl">
          How are you feeling tonight?
        </h2>
        <p className="mt-1.5 text-muted">
          {activeMood ? activeMood.blurb : "Pick a vibe and we'll line up something the whole room will love."}
        </p>
      </div>

      <MoodSelector value={mood} onChange={setMood} />

      <div className="rounded-2xl bg-surface/70 p-4 ring-1 ring-line backdrop-blur sm:p-5">
        <FilterBar filters={filters} onChange={patch} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted" aria-live="polite">
          <span className="font-semibold text-white">{results.length}</span>
          {results.length === 1 ? "pick" : "picks"}
          {activeMood && ActiveIcon && !relaxed.includes("any mood") && (
            <>
              {" "}for
              <span className="inline-flex items-center gap-1 text-white">
                <ActiveIcon className="size-3.5" aria-hidden /> {activeMood.label}
              </span>
            </>
          )}
          {filters.query.trim() && !relaxed.includes("without your search") && <> matching “{filters.query.trim()}”</>}
        </p>
        <div className="flex items-center gap-1">
          {hasFilters && (
            <button
              onClick={reset}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-white/5 hover:text-white"
            >
              Reset
            </button>
          )}
          <button
            onClick={surpriseMe}
            disabled={!results.length}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ember transition hover:bg-ember/10 disabled:opacity-40"
          >
            <Shuffle className="size-4" /> Surprise me
          </button>
        </div>
      </div>

      {relaxed.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-violet/10 px-4 py-3 text-sm ring-1 ring-violet/30" role="status">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-violet-300" />
          <p className="text-white/80">
            Nothing matched that exact combo, so here are the closest picks with{" "}
            <span className="font-medium text-white">{relaxed.join(", ")}</span>.{" "}
            <button onClick={reset} className="font-medium text-violet-300 underline-offset-2 hover:underline">
              Reset filters
            </button>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {results.map(({ title, match }, i) => (
          <div
            key={title.id}
            id={`title-${title.id}`}
            className={
              spotlight === title.id
                ? "rounded-2xl outline-2 outline-offset-4 outline-ember transition-[outline-color] duration-500"
                : "rounded-2xl outline-2 outline-offset-4 outline-transparent transition-[outline-color] duration-500"
            }
          >
            <MovieCard
              title={title}
              match={match}
              available={isOnMyServices(title, services)}
              sentiment={sentiment[title.id]}
              onOpen={onOpen}
              onWatchTogether={onWatchTogether}
              index={i}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
