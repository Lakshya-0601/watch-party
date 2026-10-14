"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  name: string;
  email: string;
  /** Profile photo; falls back to initials if absent or it fails to load */
  src?: string;
  className?: string;
}

/** Profile photo, or initials on a stable hue derived from the user's email. */
export function Avatar({ name, email, src, className }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const base = "size-9 shrink-0 rounded-full ring-2 ring-white/10";

  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny remote avatar, no optimisation needed
      <img
        src={src}
        alt=""
        aria-hidden
        // Google profile photos refuse hot-linked requests that carry a Referer
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={cn(base, "object-cover", className)}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = [...email].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className={cn(base, "grid place-items-center text-sm font-semibold text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 50) % 360} 70% 40%))` }}
    >
      {initials || "?"}
    </span>
  );
}
