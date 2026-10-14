"use client";

import { useMemo } from "react";
import { Info, Play, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBackdrop } from "@/components/dashboard/HeroBackdrop";
import { PosterImage } from "@/components/dashboard/PosterImage";
import { TITLES } from "@/lib/data/titles";
import { SERVICE_BY_ID } from "@/lib/data/services";
import { formatLength, isOnMyServices, matchScore } from "@/lib/recommend";
import { useAppState } from "@/lib/store";
import type { Title } from "@/lib/types";

interface Props {
  onWatchTogether: (title: Title) => void;
  onOpen: (title: Title) => void;
}

/** Billboard for the single best match on the user's own services. */
export function HeroBanner({ onWatchTogether, onOpen }: Props) {
  const { user, services, genres } = useAppState();

  const featured = useMemo(() => {
    const pool = TITLES.filter((t) => isOnMyServices(t, services));
    const candidates = pool.length ? pool : TITLES;
    return candidates
      .map((t) => ({ t, score: matchScore(t, { genres, services }) + t.rating }))
      .sort((a, b) => b.score - a.score)[0].t;
  }, [services, genres]);

  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-ink ring-1 ring-line">
      <HeroBackdrop hues={featured.hues} />

      <div className="relative z-10 flex items-center gap-10 px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-xl flex-1">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="size-3.5 text-ember-2" />
            Tonight&apos;s top pick for you, {firstName}
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[0.9] tracking-wide drop-shadow-lg sm:text-7xl">
            {featured.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
            <span className="font-semibold text-success">{matchScore(featured, { genres, services })}% match</span>
            <span aria-hidden>·</span>
            <span>{featured.year}</span>
            <span aria-hidden>·</span>
            <span>{formatLength(featured)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-amber-300 text-amber-300" /> {featured.rating.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <span>{featured.services.map((s) => SERVICE_BY_ID[s].name).join(", ")}</span>
          </div>
          <p className="mt-4 text-lg text-white/90">{featured.logline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {featured.genres.map((g) => (
              <span key={g} className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white/85 ring-1 ring-white/10 backdrop-blur">
                {g}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <Button className="h-12 px-6 text-[15px]" onClick={() => onWatchTogether(featured)}>
              <Play className="size-4 fill-current" /> Start a watch party
            </Button>
            <Button variant="secondary" className="h-12 px-5 backdrop-blur" onClick={() => onOpen(featured)}>
              <Info className="size-4" /> Details & sentiment
            </Button>
          </div>
        </div>

        {/* Featured poster, tilted, on wide screens */}
        <button
          onClick={() => onOpen(featured)}
          aria-label={`${featured.title} details`}
          className="hidden shrink-0 rotate-2 overflow-hidden rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/15 transition duration-500 hover:rotate-0 hover:scale-[1.02] lg:block"
        >
          <PosterImage title={featured} className="aspect-[2/3] w-56" sizes="224px" priority />
        </button>
      </div>
    </section>
  );
}
