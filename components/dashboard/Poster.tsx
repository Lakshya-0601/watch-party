import { Film, Tv } from "lucide-react";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Generated poster art: layered gradients from the title's two hues plus the
 * title set in display type. Avoids hot-linking real artwork in the mock.
 */
export function Poster({ title, className }: { title: Title; className?: string }) {
  const [a, b] = title.hues;
  const Icon = title.kind === "series" ? Tv : Film;
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `
          radial-gradient(120% 80% at 20% 10%, hsl(${a} 85% 55% / 0.9), transparent 60%),
          radial-gradient(90% 70% at 90% 90%, hsl(${b} 80% 45% / 0.85), transparent 65%),
          linear-gradient(170deg, hsl(${a} 45% 14%), hsl(${b} 50% 8%))`,
      }}
    >
      {/* Light streak for a little depth */}
      <div
        aria-hidden
        className="absolute -left-1/4 top-1/3 h-1/3 w-[150%] -rotate-12 bg-white/10 blur-2xl"
      />
      <Icon aria-hidden className="absolute right-3 top-3 size-4 text-white/60" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-16">
        <p className="font-display text-2xl leading-[0.95] tracking-wide text-white drop-shadow-lg">
          {title.title}
        </p>
      </div>
    </div>
  );
}
