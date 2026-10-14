import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "light" | "success" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-ember to-ember-2 text-white shadow-[0_8px_30px_-8px_var(--color-ember)] hover:brightness-110",
  secondary: "bg-white/[0.06] text-white ring-1 ring-inset ring-line hover:bg-white/[0.1]",
  ghost: "text-muted hover:text-white hover:bg-white/[0.06]",
  light: "bg-white text-[#1f1f1f] hover:bg-white/90",
  success: "bg-success text-ink",
  danger: "bg-danger/15 text-danger ring-1 ring-inset ring-danger/40 hover:bg-danger hover:text-white",
};

/** Base button with a few visual variants and a built-in loading spinner. */
export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
