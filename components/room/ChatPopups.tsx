import type { ChatPopup } from "@/lib/rooms/client";

/**
 * One-second lines at the bottom of the screen for new chat messages and
 * reactions (lib/rooms/client.ts removes each after CHAT_POPUP_MS). Purely
 * informational, so they never take clicks away from the player.
 */
export function ChatPopups({ popups }: { popups: ChatPopup[] }) {
  if (!popups.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-1.5 px-4"
    >
      {popups.map((p) => (
        <p
          key={p.id}
          className="max-w-[min(28rem,100%)] animate-fade-up truncate rounded-full bg-surface-2/95 px-4 py-1.5 text-sm shadow-2xl ring-1 ring-line backdrop-blur-xl"
        >
          <span className="font-semibold">{p.who}</span>
          <span className="text-white/80">{p.kind === "message" ? `: ${p.text}` : ` reacted ${p.text}`}</span>
        </p>
      ))}
    </div>
  );
}
