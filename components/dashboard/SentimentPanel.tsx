"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Brain, LoaderCircle, Minus, Send, TrendingDown, TrendingUp } from "lucide-react";
import type { Highlight, ScoredReview, SentimentReport } from "@/lib/sentiment/types";
import { cn } from "@/lib/cn";

const POLL_MS = 5_000;

/**
 * "Real-Time Sentiment Score": polls the sentiment API while open, so the
 * Audience Sentiment Index, distribution and review feed update as new
 * (simulated) audience reviews stream in. Users can also run the model on
 * their own review and watch it move the index.
 */
export function SentimentPanel({ titleId }: { titleId: string }) {
  const [report, setReport] = useState<SentimentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  /** Store a report and flag reviews we haven't shown before (for the entry highlight). */
  const acceptReport = useCallback((next: SentimentReport) => {
    const firstLoad = seen.current.size === 0;
    const newIds = next.reviews.filter((r) => !seen.current.has(r.id)).map((r) => r.id);
    newIds.forEach((id) => seen.current.add(id));
    setFresh(firstLoad ? new Set() : new Set(newIds));
    setReport(next);
  }, []);

  // Initial load + live polling
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/sentiment/${titleId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next: SentimentReport = await res.json();
        if (cancelled) return;
        acceptReport(next);
        setError(null);
      } catch {
        if (!cancelled) setError("Sentiment service unavailable — retrying…");
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [titleId, acceptReport]);

  if (!report) {
    return (
      <div className="grid h-48 place-items-center rounded-2xl bg-ink/60 ring-1 ring-line" role="status">
        {error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : (
          <LoaderCircle className="size-5 animate-spin text-violet" aria-label="Loading sentiment" />
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="sentiment-heading" className="space-y-5 rounded-2xl bg-ink/60 p-5 ring-1 ring-line">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="sentiment-heading" className="flex items-center gap-2 font-semibold">
          <Activity className="size-4 text-violet" /> Real-Time Sentiment Score
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-danger">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-danger" />
          </span>
          Live
        </span>
      </header>

      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <Gauge value={report.index} />
        <div className="space-y-4">
          <div>
            <p className="text-lg font-semibold">{report.verdict}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
              <Trend delta={report.trend} /> in the last minute · {report.sampleSize} reviews analysed
            </p>
          </div>
          <Distribution d={report.distribution} />
        </div>
      </div>

      {report.aspects.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">What audiences are reacting to</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {report.aspects.map((a) => (
              <li key={a.aspect} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span>{a.aspect}</span>
                  <span className="text-muted">
                    {a.score} <span className="text-[11px]">· {a.mentions} mentions</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${a.score}%`, background: scoreColor(a.score) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Incoming reviews</p>
        <ul className="space-y-2">
          {report.reviews.slice(0, 5).map((r) => (
            <ReviewRow key={r.id} review={r} now={report.updatedAt} fresh={fresh.has(r.id)} />
          ))}
        </ul>
      </div>

      <TryTheModel titleId={report.titleId} onReport={acceptReport} />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Brain className="size-3.5" /> {report.model.name} v{report.model.version}
        </span>
        <span>
          Scored in {report.latencyMs} ms · refreshes every {POLL_MS / 1000}s
        </span>
      </footer>
    </section>
  );
}

/* ---------------------------------------------------------------- pieces -- */

/** Red → amber → green along the 0–100 index. */
const scoreColor = (v: number) => `hsl(${Math.round((Math.max(0, Math.min(100, v)) / 100) * 130)} 75% 55%)`;

/** Semicircular gauge for the 0–100 Audience Sentiment Index. */
function Gauge({ value }: { value: number }) {
  const r = 52;
  const half = Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * half;
  return (
    <div className="relative mx-auto w-40" role="img" aria-label={`Audience Sentiment Index ${Math.round(value)} out of 100`}>
      <svg viewBox="0 0 128 72" className="w-full">
        <path d="M 12 64 A 52 52 0 0 1 116 64" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 12 64 A 52 52 0 0 1 116 64"
          fill="none"
          stroke={scoreColor(value)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${half}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-display text-4xl leading-none tracking-wide">{Math.round(value)}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Sentiment index</p>
      </div>
    </div>
  );
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.1)
    return (
      <span className="inline-flex items-center gap-0.5">
        <Minus className="size-3.5" /> steady
      </span>
    );
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

function Distribution({ d }: { d: SentimentReport["distribution"] }) {
  const parts = [
    { key: "positive", label: "Positive", value: d.positive, cls: "bg-success" },
    { key: "neutral", label: "Neutral", value: d.neutral, cls: "bg-white/30" },
    { key: "negative", label: "Negative", value: d.negative, cls: "bg-danger" },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        {parts.map((p) => (
          <div key={p.key} className={cn(p.cls, "transition-[width] duration-700")} style={{ width: `${p.value}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-4 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.cls)} /> {p.label} {p.value}%
          </span>
        ))}
      </div>
    </div>
  );
}

function relativeTime(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function ReviewRow({ review, now, fresh }: { review: ScoredReview; now: number; fresh: boolean }) {
  const { compound, label } = review.analysis;
  return (
    <li
      className={cn(
        "rounded-xl bg-white/[0.03] p-3 ring-1 transition-colors duration-1000",
        fresh ? "animate-fade-up ring-violet/60 bg-violet/10" : "ring-line",
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
        <span className="font-medium text-white/80">@{review.author}</span>
        {review.source !== "audience" && (
          <span
            className={cn(
              "rounded px-1 py-px font-bold uppercase tracking-wider",
              review.source === "you" ? "bg-ember/20 text-ember" : "bg-violet/20 text-violet-300",
            )}
          >
            {review.source === "you" ? "You" : "Live"}
          </span>
        )}
        <span>{relativeTime(review.createdAt, now)}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-px font-semibold tabular-nums",
            label === "positive" && "bg-success/15 text-success",
            label === "negative" && "bg-danger/15 text-danger",
            label === "neutral" && "bg-white/10 text-white/70",
          )}
          title="Compound sentiment score (−1 to +1)"
        >
          {compound > 0 ? "+" : ""}
          {compound.toFixed(2)}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-white/85">
        <HighlightedText text={review.text} highlights={review.analysis.highlights} />
      </p>
    </li>
  );
}

/** Underline the words that moved the model, coloured by direction. */
function HighlightedText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  [...highlights]
    .sort((a, b) => a.start - b.start)
    .forEach((h, i) => {
      if (h.start < cursor) return;
      parts.push(text.slice(cursor, h.start));
      parts.push(
        <mark
          key={i}
          title={`valence ${h.valence > 0 ? "+" : ""}${h.valence}`}
          className={cn(
            "rounded-sm bg-transparent px-0.5 underline decoration-2 underline-offset-2",
            h.valence > 0 ? "text-success decoration-success/50" : h.valence < 0 ? "text-danger decoration-danger/50" : "text-white",
          )}
        >
          {text.slice(h.start, h.end)}
        </mark>,
      );
      cursor = h.end;
    });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** Let the user run the model on their own words. */
function TryTheModel({ titleId, onReport }: { titleId: string; onReport: (r: SentimentReport) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScoredReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sentiment/${titleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setResult(body.review);
      onReport(body.report);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="my-review" className="text-xs font-medium uppercase tracking-wider text-muted">
        Add your take — the model scores it instantly
      </label>
      <div className="flex gap-2">
        <textarea
          id="my-review"
          rows={2}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`e.g. "The twist wasn't bad at all, but the pacing was SO slow."`}
          className="min-h-11 flex-1 resize-none rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm outline-none ring-1 ring-inset ring-line placeholder:text-white/25 focus:ring-2 focus:ring-violet"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Analyze sentiment"
          className="grid w-11 shrink-0 place-items-center rounded-xl bg-violet text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {result && (
        <p className="text-xs text-muted" aria-live="polite">
          Model verdict:{" "}
          <span
            className={cn(
              "font-semibold",
              result.analysis.label === "positive" && "text-success",
              result.analysis.label === "negative" && "text-danger",
            )}
          >
            {result.analysis.label} ({result.analysis.compound > 0 ? "+" : ""}
            {result.analysis.compound.toFixed(2)})
          </span>{" "}
          — added to the live feed above.
        </p>
      )}
    </form>
  );
}
