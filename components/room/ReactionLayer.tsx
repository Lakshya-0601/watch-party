"use client";

import { useState } from "react";
import type { Reaction, RoomAction } from "@/lib/rooms/types";

const QUICK = ["😂", "😱", "😭", "🔥", "❤️", "👏", "🍿"];
const VISIBLE_MS = 3200;

/**
 * Floating emoji reactions over the player, plus a quick-react bar.
 * Reactions are ephemeral on the server (a few seconds); each one floats up
 * once, keyed by id. Positions derive from the id so they're stable per render.
 */
export function ReactionLayer({ reactions, serverTime }: { reactions: Reaction[]; serverTime: number }) {
  const fresh = reactions.filter((r) => serverTime - r.at < VISIBLE_MS);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {fresh.map((r) => {
        const seed = [...r.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
        return (
          <span
            key={r.id}
            className="absolute bottom-16 animate-float-up text-4xl drop-shadow-lg"
            style={{ right: `${6 + (seed % 30)}%`, "--tilt": `${(seed % 31) - 15}deg` } as React.CSSProperties}
          >
            {r.emoji}
            <span className="block text-center text-[10px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
              {r.byName}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function ReactionBar({
  act,
  blocked,
}: {
  act: (a: RoomAction) => Promise<{ ok: boolean; error?: string }>;
  /** Why reactions are off (host muted you / the chat), if they are */
  blocked?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1" title={blocked ?? undefined}>
      {QUICK.map((emoji) => (
        <button
          key={emoji}
          onClick={async () => {
            const res = await act({ type: "react", emoji });
            setError(res.ok ? null : (res.error ?? null));
          }}
          aria-label={`React ${emoji}`}
          disabled={Boolean(blocked)}
          className="grid size-9 place-items-center rounded-lg text-xl transition hover:scale-115 hover:bg-white/10 disabled:opacity-30 disabled:hover:scale-100"
        >
          {emoji}
        </button>
      ))}
      {(blocked || error) && <span className="ml-2 text-xs text-danger">{blocked ?? error}</span>}
    </div>
  );
}
