"use client";

import { MOODS } from "@/lib/data/moods";
import type { MoodId } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  value: MoodId | null;
  onChange: (mood: MoodId | null) => void;
}

/** Mood pills with monochrome icons. Clicking the active pill clears it ("any mood"). */
export function MoodSelector({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Tonight's mood" className="flex flex-wrap gap-2.5">
      {MOODS.map(({ id, icon: Icon, label, gradient }) => {
        const active = value === id;
        return (
          <button
            key={id}
            aria-pressed={active}
            onClick={() => onChange(active ? null : id)}
            style={active ? { background: gradient } : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200 sm:px-5 sm:py-3 sm:text-[15px]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95",
              active
                ? "scale-[1.03] text-ink shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)]"
                : "bg-white/[0.06] text-white/85 ring-1 ring-inset ring-line hover:bg-white/[0.1] hover:text-white",
            )}
          >
            <Icon aria-hidden strokeWidth={2} className={cn("size-[18px]", active ? "text-ink" : "text-white/70")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
