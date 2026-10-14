"use client";

import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/dashboard/TopNav";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { MoodRecommender } from "@/components/dashboard/MoodRecommender";
import { WatchPartyModal, openStreamingTab } from "@/components/dashboard/WatchPartyModal";
import { TitleDetailModal } from "@/components/dashboard/TitleDetailModal";
import { ProfileDrawer } from "@/components/dashboard/ProfileDrawer";
import type { SentimentSummary } from "@/lib/sentiment/types";
import { obviousPlatform, watchLink } from "@/lib/data/watch-links";
import { useAppState } from "@/lib/store";
import type { ServiceId, Title } from "@/lib/types";

const SENTIMENT_REFRESH_MS = 30_000;

/** Client shell for /dashboard — owns which overlay is open and the sentiment scores. */
export function DashboardView() {
  const { services } = useAppState();
  const [party, setParty] = useState<{ open: boolean; title: Title | null; opened: ServiceId | null }>({
    open: false,
    title: null,
    opened: null,
  });
  const [detail, setDetail] = useState<Title | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sentiment, setSentiment] = useState<Record<string, SentimentSummary>>({});

  // Audience Sentiment Index for every card; refreshed periodically
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/sentiment", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((body: { titles: Record<string, SentimentSummary> }) => !cancelled && setSentiment(body.titles))
        .catch(() => {}); // cards simply omit the score if the service is down
    load();
    const id = setInterval(load, SENTIMENT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /**
   * "Watch together": when the title is on exactly one of the user's services,
   * open it there right away (still inside the click, so it isn't popup-blocked);
   * the modal then walks them through play → connect → invite.
   */
  const openParty = useCallback(
    (title: Title | null = null) => {
      setDetail(null);
      const platform = obviousPlatform(title, services);
      const opened = platform && openStreamingTab(watchLink(title, platform).url) ? platform : null;
      setParty({ open: true, title, opened });
    },
    [services],
  );
  const closeParty = useCallback(() => setParty((p) => ({ ...p, open: false })), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  return (
    <>
      <TopNav onCreateRoom={() => openParty()} onOpenProfile={() => setProfileOpen(true)} />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-14 px-4 pb-24 pt-4 sm:px-6">
        <HeroBanner onWatchTogether={openParty} onOpen={setDetail} />
        <MoodRecommender sentiment={sentiment} onOpen={setDetail} onWatchTogether={openParty} />
      </main>

      {detail && <TitleDetailModal title={detail} onClose={closeDetail} onWatchTogether={openParty} />}
      {party.open && <WatchPartyModal onClose={closeParty} title={party.title} opened={party.opened} />}
      {profileOpen && <ProfileDrawer onClose={closeProfile} />}
    </>
  );
}
