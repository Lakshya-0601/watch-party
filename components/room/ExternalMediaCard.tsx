import { ExternalLink, Puzzle } from "lucide-react";
import { formatTime } from "@/components/room/SyncedPlayer";
import type { Playback, RoomMedia } from "@/lib/rooms/types";

const PROVIDER: Record<RoomMedia["provider"], { name: string; color: string }> = {
  netflix: { name: "Netflix", color: "#e50914" },
  hotstar: { name: "JioHotstar", color: "#4f6bff" },
  prime: { name: "Prime Video", color: "#1fa8ff" },
  appletv: { name: "Apple TV+", color: "#e8e8ed" },
  crunchyroll: { name: "Crunchyroll", color: "#f47521" },
};

/**
 * Shown instead of the built-in player when a party is hosted on a streaming
 * service through the browser extension: each person plays the title in
 * their own account, and the extension keeps everyone's player in sync.
 */
export function ExternalMediaCard({ media, playback }: { media: RoomMedia; playback?: Playback }) {
  const provider = PROVIDER[media.provider];
  return (
    <div
      className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl ring-1 ring-line"
      style={{ background: `radial-gradient(90% 90% at 50% 0%, ${provider.color}33, transparent 60%), #08080d` }}
    >
      <div className="max-w-md px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: provider.color }}>
          Watching on {provider.name}
        </p>
        <h2 className="mt-2 font-display text-4xl tracking-wide sm:text-5xl">{media.title}</h2>
        {playback && (
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            {playback.playing ? "Playing" : "Paused"} at {formatTime(playback.position)}
            {playback.byName ? ` · last change by ${playback.byName}` : ""}
          </p>
        )}
        <ol className="mx-auto mt-6 space-y-2 text-left text-sm text-white/80">
          <li className="flex gap-2">
            <Puzzle className="mt-0.5 size-4 shrink-0 text-violet-300" />
            Install the ReelRoom browser extension and sign in here once — it links automatically.
          </li>
          <li className="flex gap-2">
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-violet-300" />
            Open the title on {provider.name}: playback, chat and reactions sync right on the page.
          </li>
        </ol>
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink transition hover:bg-white/90"
        >
          Open on {provider.name} <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}
