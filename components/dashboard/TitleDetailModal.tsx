"use client";

import { Play, Star, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PosterImage } from "@/components/dashboard/PosterImage";
import { SentimentPanel } from "@/components/dashboard/SentimentPanel";
import { SERVICE_BY_ID } from "@/lib/data/services";
import { formatLength, isOnMyServices, matchScore } from "@/lib/recommend";
import { useAppState } from "@/lib/store";
import type { Title } from "@/lib/types";

interface Props {
  title: Title;
  onClose: () => void;
  onWatchTogether: (title: Title) => void;
}

/** Movie / show details with the live Audience Sentiment panel. */
export function TitleDetailModal({ title, onClose, onWatchTogether }: Props) {
  const { services, genres } = useAppState();
  const match = matchScore(title, { genres, services });
  const available = isOnMyServices(title, services);

  return (
    <Dialog onClose={onClose} labelledBy="title-dialog-heading" className="max-w-3xl">
      <div className="max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl ring-1 ring-line sm:rounded-3xl">
        {/* Blurred poster wash behind the header */}
        <div className="relative overflow-hidden">
          <PosterImage title={title} className="absolute inset-0 scale-110 opacity-30 blur-2xl" sizes="64px" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />

          <button
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur transition hover:text-white"
          >
            <X className="size-5" />
          </button>

          <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
            <PosterImage
              title={title}
              sizes="176px"
              className="aspect-[2/3] w-36 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/15 sm:w-44"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                {title.kind === "movie" ? "Movie" : "Series"}
              </p>
              <h2 id="title-dialog-heading" className="mt-1 font-display text-5xl leading-[0.95] tracking-wide">
                {title.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
                <span className="font-semibold text-success">{match}% match</span>
                <span aria-hidden>·</span>
                <span>{title.year}</span>
                <span aria-hidden>·</span>
                <span>{formatLength(title)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-300 text-amber-300" /> {title.rating.toFixed(1)} critics
                </span>
              </div>
              <p className="mt-4 text-white/90">{title.logline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {title.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/80 ring-1 ring-line">
                    {g}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted">
                Streaming on{" "}
                {title.services.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ", "}
                    <span className="font-medium" style={{ color: `color-mix(in srgb, ${SERVICE_BY_ID[id].color} 70%, white)` }}>
                      {SERVICE_BY_ID[id].name}
                    </span>
                  </span>
                ))}
                {!available && " — not on your services"}
              </p>
              <Button data-autofocus className="mt-5" onClick={() => onWatchTogether(title)}>
                <Play className="size-4 fill-current" /> Watch together
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          <SentimentPanel titleId={title.id} />
        </div>
      </div>
    </Dialog>
  );
}
