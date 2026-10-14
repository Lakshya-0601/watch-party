import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  steps: string[];
  /** Zero-based index of the current step */
  current: number;
}

/** Labelled step dots joined by a smoothly animated progress bar. */
export function StepIndicator({ steps, current }: Props) {
  const progress = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted">
        Step {current + 1} of {steps.length}
      </p>
      <div className="relative mx-auto max-w-md">
        {/* Track + animated fill */}
        <div className="absolute left-4 right-4 top-4 h-1 -translate-y-1/2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember to-violet transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="relative flex justify-between">
          {steps.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={label} className="flex flex-col items-center gap-2" aria-current={active ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-sm font-semibold transition duration-300",
                    done && "bg-ember text-white",
                    active && "bg-ink text-white ring-2 ring-ember shadow-[0_0_20px_-2px_var(--color-ember)]",
                    !done && !active && "bg-surface-2 text-muted ring-1 ring-line",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("text-xs font-medium", active || done ? "text-white" : "text-muted")}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
