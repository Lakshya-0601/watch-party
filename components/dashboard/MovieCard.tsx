"use client";

import { Activity, Info, Play, Star } from "lucide-react";
import { PosterImage } from "@/components/dashboard/PosterImage";
import { SERVICE_BY_ID } from "@/lib/data/services";
import { formatLength } from "@/lib/recommend";
import type { SentimentSummary } from "@/lib/sentiment/types";
import type { Title } from "@/lib/types";

interface Props {
  title: Title;
  match: number;
  available: boolean;
  /** Audience Sentiment Index, once the API has responded */
  sentiment?: SentimentSummary;
  onOpen: (title: Title) => void;
  onWatchTogether: (title: Title) => void;
  index?: number;
}

/** Poster card: thumbnail, match %, rating + sentiment, services; hover reveals actions. */
export function MovieCard({ title, match, available, sentiment, onOpen, onWatchTogether, index = 0 }: Props) {
  return (
    <article className="group relative animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)] group-hover:ring-white/25 group-focus-within:ring-ember">
        <PosterImage title={title} className="aspect-[2/3] w-full transition duration-500 group-hover:scale-[1.03]" />

        {/* Match badge */}
        <span
          className={`absolute left-2.5 top-2.5 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold shadow backdrop-blur ${
            match >= 85 ? "bg-success/90 text-ink" : "bg-black/65 text-white"
          }`}
        >
          {match}% match
        </span>

        {/* Whole poster opens details (sibling of the quick action, not a parent) */}
        <button
          onClick={() => onOpen(title)}
          aria-label={`${title.title} — details and audience sentiment`}
          className="absolute inset-0 z-10 focus-visible:outline-none"
        />

        {/* Hover / focus overlay */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black via-black/80 to-black/10 p-3.5 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <p className="text-[13px] leading-snug text-white/85">{title.logline}</p>
          <div className="pointer-events-auto mt-3 flex gap-1.5">
            <button
              onClick={() => onWatchTogether(title)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-sm font-semibold text-ink transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
            >
              <Play className="size-4 fill-current" /> Watch together
            </button>
            <button
              onClick={() => onOpen(title)}
              aria-label={`More about ${title.title}`}
              className="grid size-9 place-items-center rounded-lg bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
            >
              <Info className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold">{title.title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{title.year}</span>
          <span aria-hidden>·</span>
          <span>{formatLength(title)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5 text-amber-300" title="Critic rating">
            <Star className="size-3 fill-current" aria-hidden />
            {title.rating.toFixed(1)}
          </span>
          {sentiment && (
            <span
              className="inline-flex items-center gap-0.5 text-violet-300"
              title={`Audience Sentiment Index: ${sentiment.verdict}`}
            >
              <Activity className="size-3" aria-hidden />
              {Math.round(sentiment.index)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {title.services.map((id) => {
            const s = SERVICE_BY_ID[id];
            return (
              <span
                key={id}
                title={s.name}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `${s.color}22`, color: `color-mix(in srgb, ${s.color} 70%, white)` }}
              >
                {s.name}
              </span>
            );
          })}
          {!available && <span className="text-[10px] text-muted">· not on your services</span>}
        </div>
      </div>
    </article>
  );
}
