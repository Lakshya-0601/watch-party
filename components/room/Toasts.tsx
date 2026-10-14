"use client";

import { Gamepad2, UserPlus, X } from "lucide-react";
import type { RoomNotice } from "@/lib/rooms/client";

interface Props {
  notices: RoomNotice[];
  onDismiss: (id: string) => void;
  /** Host quick actions on join / control requests */
  onDecide: (notice: RoomNotice, accept: boolean) => void;
}

const DURATION: Record<RoomNotice["kind"], number> = {
  "join-request": 12000,
  "control-request": 12000,
  control: 5000,
};

/**
 * Small popups in the corner. Each one auto-dismisses when its progress bar
 * runs out (pausing while hovered); host requests carry inline actions.
 */
export function Toasts({ notices, onDismiss, onDecide }: Props) {
  return (
    <div className="pointer-events-none fixed right-3 top-20 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2" aria-live="polite">
      {notices.map((n) => {
        const Icon = n.kind === "join-request" ? UserPlus : Gamepad2;
        const actionable = n.kind === "join-request" || n.kind === "control-request";
        return (
          <div
            key={n.id}
            role="status"
            className="group pointer-events-auto relative animate-fade-up overflow-hidden rounded-xl bg-surface-2/95 shadow-2xl ring-1 ring-line backdrop-blur-xl"
          >
            <div className="flex items-start gap-3 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-300">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-white/70">{n.body}</p>}
                {actionable && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => (onDecide(n, true), onDismiss(n.id))}
                      className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-white/90"
                    >
                      {n.kind === "join-request" ? "Admit" : "Grant"}
                    </button>
                    <button
                      onClick={() => (onDecide(n, false), onDismiss(n.id))}
                      className="rounded-lg px-3 py-1 text-xs font-medium text-white/75 ring-1 ring-line transition hover:bg-white/10"
                    >
                      {n.kind === "join-request" ? "Deny" : "Decline"}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                aria-label="Dismiss"
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {/* Countdown bar; when it finishes, the toast dismisses itself */}
            <div
              className="toast-timer h-0.5 bg-ember/70"
              style={{ "--toast-duration": `${DURATION[n.kind]}ms` } as React.CSSProperties}
              onAnimationEnd={() => onDismiss(n.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
