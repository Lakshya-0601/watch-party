"use client";

import { BrandMark } from "@/components/onboarding/BrandMark";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { STREAMING_SERVICES } from "@/lib/data/services";
import type { ServiceId } from "@/lib/types";

interface Props {
  selected: ServiceId[];
  onToggle: (id: ServiceId) => void;
}

/** Step 1 — grid of toggleable streaming-service cards. */
export function StreamingSelector({ selected, onToggle }: Props) {
  return (
    <div role="group" aria-label="Streaming services" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {STREAMING_SERVICES.map((service, i) => (
        <SelectionCard
          key={service.id}
          index={i}
          active={selected.includes(service.id)}
          onToggle={() => onToggle(service.id)}
          color={service.color}
          tile={service.tile}
          visual={<BrandMark id={service.id} className="h-12 w-28" />}
          title={service.name}
          subtitle={service.tagline}
        />
      ))}
    </div>
  );
}
