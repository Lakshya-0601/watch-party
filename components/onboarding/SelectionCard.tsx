"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  active: boolean;
  onToggle: () => void;
  /** Accent colour for the selected ring, glow and checkmark */
  color: string;
  /** CSS background for the artwork tile */
  tile: string;
  /** Logo / icon rendered centred in the tile */
  visual: React.ReactNode;
  title: string;
  subtitle: string;
  /** Position in the grid, used to stagger the entrance animation */
  index?: number;
}

/**
 * Toggleable card shared by the streaming-service and genre steps so both
 * read as one consistent selection UI.
 */
export function SelectionCard({ active, onToggle, color, tile, visual, title, subtitle, index = 0 }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      style={{ "--brand": color, animationDelay: `${index * 40}ms` } as React.CSSProperties}
      className={cn(
        "group relative flex animate-fade-up flex-col overflow-hidden rounded-2xl bg-surface text-left ring-1 ring-inset transition duration-200",
        "hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        active ? "ring-2 ring-[var(--brand)] shadow-[0_0_32px_-6px_var(--brand)]" : "ring-line hover:ring-white/20",
      )}
    >
      <span className="relative grid h-24 place-items-center overflow-hidden" style={{ background: tile }}>
        <span className="transition duration-300 group-hover:scale-105">{visual}</span>
        <span
          className={cn(
            "absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full transition",
            active ? "scale-100 bg-[var(--brand)] text-black" : "scale-90 bg-black/40 ring-1 ring-white/20",
          )}
        >
          {active && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </span>
      <span className="px-3.5 py-3">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </button>
  );
}
