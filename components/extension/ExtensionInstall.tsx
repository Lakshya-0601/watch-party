"use client";

import { useState } from "react";
import { Check, CircleCheck, Copy, Download, LoaderCircle, Puzzle, RefreshCw } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { EXTENSION_DOWNLOAD_URL, EXTENSION_STORE_URL, useExtensionStatus } from "@/lib/extension";
import { cn } from "@/lib/cn";

/** "Installed ✓ / Not installed / Checking…" pill with a re-check button. */
export function ExtensionStatusBadge({ className }: { className?: string }) {
  const { status, recheck } = useExtensionStatus();
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 ring-1",
        status.state === "installed" ? "bg-success/10 ring-success/40" : "bg-white/[0.04] ring-line",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          status.state === "installed" ? "bg-success/20 text-success" : "bg-violet/15 text-violet-300",
        )}
      >
        {status.state === "checking" ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : status.state === "installed" ? (
          <CircleCheck className="size-5" />
        ) : (
          <Puzzle className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {status.state === "checking"
            ? "Looking for the extension…"
            : status.state === "installed"
              ? "ReelRoom extension connected"
              : "Extension not detected in this browser"}
        </p>
        <p className="text-xs text-muted">
          {status.state === "installed"
            ? `Version ${status.version ?? "unknown"} · you're signed in automatically`
            : status.state === "missing"
              ? "Installed it already? Refresh this page so Chrome can connect it."
              : "This only takes a second."}
        </p>
      </div>
      {status.state !== "installed" && (
        <button
          type="button"
          onClick={recheck}
          disabled={status.state === "checking"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ember transition hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" /> Check again
        </button>
      )}
    </div>
  );
}

/** Install instructions: Web Store button when published, otherwise the unpacked-install steps. */
export function InstallSteps({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  if (EXTENSION_STORE_URL) {
    return (
      <a
        href={EXTENSION_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink transition hover:bg-white/90"
      >
        <Puzzle className="size-4" /> Add to Chrome — it&apos;s free
      </a>
    );
  }

  async function copyExtensionsUrl() {
    // Pages can't link to chrome:// URLs, so hand the user the address instead
    if (await copyText("chrome://extensions")) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const steps: React.ReactNode[] = [
    <>
      <a
        href={EXTENSION_DOWNLOAD_URL}
        download
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-white/90"
      >
        <Download className="size-4" /> Download the extension
      </a>{" "}
      <span className="text-muted">and unzip it.</span>
    </>,
    <>
      Open{" "}
      <button
        type="button"
        onClick={copyExtensionsUrl}
        className="inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] ring-1 ring-line transition hover:bg-white/15"
        title="Copy — paste it into Chrome's address bar"
      >
        chrome://extensions
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-muted" />}
      </button>{" "}
      in a new tab and switch on <strong>Developer mode</strong> (top right).
    </>,
    <>
      Click <strong>Load unpacked</strong> and choose the unzipped <span className="font-mono text-[13px]">reelroom-extension</span> folder.
    </>,
    <>Pin ReelRoom from the puzzle-piece menu, then come back and refresh this page.</>,
  ];

  return (
    <ol className={cn("space-y-3", compact && "space-y-2 text-sm")}>
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet/20 text-xs font-bold text-violet-200">
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5 text-sm leading-relaxed text-white/85">{step}</span>
        </li>
      ))}
    </ol>
  );
}
