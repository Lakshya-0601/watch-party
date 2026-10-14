"use client";

import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { GENRE_META } from "@/lib/data/genres";
import type { Genre } from "@/lib/types";

interface Props {
  selected: Genre[];
  onToggle: (genre: Genre) => void;
}

/** Step 2 — the same card grid as the services step, one card per genre. */
export function GenreSelector({ selected, onToggle }: Props) {
  return (
    <div role="group" aria-label="Favourite genres" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {GENRE_META.map(({ id, icon: Icon, color, tile, tagline }, i) => (
        <SelectionCard
          key={id}
          index={i}
          active={selected.includes(id)}
          onToggle={() => onToggle(id)}
          color={color}
          tile={tile}
          visual={
            <Icon
              aria-hidden
              strokeWidth={1.5}
              className="size-11 drop-shadow-[0_0_14px_var(--brand)]"
              style={{ color }}
            />
          }
          title={id}
          subtitle={tagline}
        />
      ))}
    </div>
  );
}
