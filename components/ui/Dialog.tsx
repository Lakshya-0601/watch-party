"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface Props {
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  /** "modal" = centred card (bottom sheet on mobile), "drawer" = right slide-over */
  variant?: "modal" | "drawer";
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible overlay shell: scrim, Escape to close, focus trap, page scroll
 * lock and focus restoration. Mount it only while open — state inside resets
 * naturally on every open.
 */
export function Dialog({ onClose, labelledBy, variant = "modal", className, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the setup effect on every parent render
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") trapFocus(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const drawer = variant === "drawer";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        drawer ? "justify-end" : "items-end justify-center sm:items-center sm:p-4",
      )}
    >
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm animate-fade-up [animation-duration:200ms]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "relative outline-none",
          drawer ? "h-full w-full max-w-md animate-slide-in" : "w-full animate-scale-in",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Keep Tab / Shift+Tab cycling inside the dialog. */
function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const focusables = root.querySelectorAll<HTMLElement>(
    'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select, [href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
