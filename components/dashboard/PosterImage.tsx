"use client";

import { useState } from "react";
import Image from "next/image";
import { Poster } from "@/components/dashboard/Poster";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  title: Title;
  className?: string;
  /** `sizes` hint for responsive image selection */
  sizes?: string;
  priority?: boolean;
}

/**
 * Real poster artwork with a guaranteed fallback: while loading it shows a
 * shimmer, and if the image is missing or fails it swaps to generated art,
 * so a card never renders an empty or broken thumbnail.
 */
export function PosterImage({ title, className, sizes = "(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw", priority }: Props) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(title.poster ? "loading" : "failed");

  if (status === "failed") return <Poster title={title} className={className} />;

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {status === "loading" && (
        <div
          aria-hidden
          className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.06)_50%,transparent_70%)] bg-[length:200%_100%]"
        />
      )}
      <Image
        src={title.poster!}
        alt={`${title.title} poster`}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className={cn("object-cover transition-opacity duration-500", status === "loaded" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
