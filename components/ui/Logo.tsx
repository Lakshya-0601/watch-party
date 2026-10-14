import { CirclePlay } from "lucide-react";
import { cn } from "@/lib/cn";

/** Wordmark: a minimal play-button glyph + condensed display type. */
export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CirclePlay
        aria-hidden
        strokeWidth={1.75}
        className={cn("shrink-0 text-ember", size === "lg" ? "size-9" : "size-7")}
      />
      <span
        className={cn(
          "font-display tracking-wide leading-none",
          size === "lg" ? "text-4xl" : "text-[1.7rem]",
        )}
      >
        Reel<span className="text-ember">Room</span>
      </span>
    </span>
  );
}
