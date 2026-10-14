/**
 * Audience Sentiment Index pipeline (server-side).
 *
 *   raw reviews ──► analyze() ──► recency-weighted, Bayesian-smoothed mean
 *                                 ──► 0–100 index + distribution + aspects
 *
 * "Real-time": on top of each title's archived reviews, a simulated live
 * stream releases new reviews every few seconds, and reviews posted through
 * the API join the corpus immediately. Polling the endpoint therefore shows
 * the index drift as opinion comes in.
 */

import { analyze } from "@/lib/sentiment/analyzer";
import { generateReview, seededRandom, type RawReview } from "@/lib/sentiment/reviews";
import type { Analysis, AspectScore, ScoredReview, SentimentReport, SentimentSummary } from "@/lib/sentiment/types";
import type { Title } from "@/lib/types";

export const MODEL = { name: "ReelRoom Sentiment · lexicon + rules", version: "1.0.0" };

const ARCHIVE_SIZE = 36;
export const LIVE_INTERVAL_MS = 5_000;
const LIVE_WINDOW_TICKS = 36; // last 3 minutes of the simulated stream
const LIVE_CHANCE = 0.34; // a given title gets a new review on ~1 in 3 ticks
const TREND_TICKS = 12; // trend = change over the last minute
const PRIOR_WEIGHT = 4; // pulls small samples toward neutral
const WEIGHT = { audience: 1, live: 1.5, you: 2 } as const;

/* ---------- caches & in-memory store (per server process; mock only) ---------- */

const analysisCache = new Map<string, Analysis>();
function analyzeCached(review: RawReview) {
  let a = analysisCache.get(review.id);
  if (!a) {
    a = analyze(review.text);
    if (analysisCache.size > 5000) analysisCache.clear();
    analysisCache.set(review.id, a);
  }
  return a;
}

const submitted = new Map<string, ScoredReview[]>();

/* --------------------------------- corpus --------------------------------- */

function corpus(title: Title, now: number): ScoredReview[] {
  const tick = Math.floor(now / LIVE_INTERVAL_MS);
  const streamStart = (tick - LIVE_WINDOW_TICKS) * LIVE_INTERVAL_MS;
  const out: ScoredReview[] = [];

  // Archive: spread over the weeks before the live window
  for (let n = 0; n < ARCHIVE_SIZE; n++) {
    const raw = generateReview(title, n, streamStart - (n + 1) * 11 * 3_600_000);
    out.push({ ...raw, source: "audience", analysis: analyzeCached(raw) });
  }

  // Simulated live stream
  for (let k = tick - LIVE_WINDOW_TICKS + 1; k <= tick; k++) {
    if (seededRandom(`${title.id}:tick:${k}`)() > LIVE_CHANCE) continue;
    const raw = generateReview(title, `live-${k}`, k * LIVE_INTERVAL_MS);
    out.push({ ...raw, source: "live", analysis: analyzeCached(raw) });
  }

  out.push(...(submitted.get(title.id) ?? []));
  return out;
}

/* -------------------------------- scoring --------------------------------- */

function indexOf(reviews: ScoredReview[]) {
  let num = 0;
  let den = PRIOR_WEIGHT; // prior mean is 0 (neutral)
  for (const r of reviews) {
    num += WEIGHT[r.source] * r.analysis.compound;
    den += WEIGHT[r.source];
  }
  // −1…+1 → 0…100
  return Math.round(((num / den + 1) / 2) * 1000) / 10;
}

export function verdictFor(index: number) {
  if (index >= 80) return "Overwhelmingly Positive";
  if (index >= 68) return "Very Positive";
  if (index >= 58) return "Mostly Positive";
  if (index >= 45) return "Mixed";
  if (index >= 35) return "Mostly Negative";
  return "Negative";
}

function summarize(title: Title, now: number) {
  const reviews = corpus(title, now);
  const index = indexOf(reviews);
  const cutoff = now - TREND_TICKS * LIVE_INTERVAL_MS;
  const before = indexOf(reviews.filter((r) => r.createdAt <= cutoff));
  return { reviews, index, trend: Math.round((index - before) * 10) / 10 };
}

/** Lightweight scores for every card on the dashboard. */
export function summaryFor(title: Title, now = Date.now()): SentimentSummary {
  const { index, trend } = summarize(title, now);
  return { index, verdict: verdictFor(index), trend };
}

/** Full report for the title detail modal. */
export function reportFor(title: Title, now = Date.now()): SentimentReport {
  const started = performance.now();
  const { reviews, index, trend } = summarize(title, now);

  const distribution = { positive: 0, neutral: 0, negative: 0 };
  const aspectAcc: Record<string, { sum: number; n: number }> = {};
  for (const r of reviews) {
    distribution[r.analysis.label] += 1;
    for (const [aspect, c] of Object.entries(r.analysis.aspects)) {
      aspectAcc[aspect] ??= { sum: 0, n: 0 };
      aspectAcc[aspect].sum += c;
      aspectAcc[aspect].n += 1;
    }
  }
  for (const k of Object.keys(distribution) as (keyof typeof distribution)[]) {
    distribution[k] = Math.round((distribution[k] / reviews.length) * 100);
  }

  const aspects: AspectScore[] = Object.entries(aspectAcc)
    .map(([aspect, { sum, n }]) => ({ aspect, score: Math.round(((sum / n + 1) / 2) * 100), mentions: n }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);

  return {
    titleId: title.id,
    index,
    verdict: verdictFor(index),
    trend,
    sampleSize: reviews.length,
    distribution,
    aspects,
    reviews: [...reviews].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    model: MODEL,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
    updatedAt: now,
  };
}

/** Score a user-submitted review and add it to the title's corpus. */
export function submitReview(title: Title, text: string, author = "you"): ScoredReview {
  const review: ScoredReview = {
    id: `${title.id}-you-${Date.now()}`,
    author,
    text,
    createdAt: Date.now(),
    source: "you",
    analysis: analyze(text),
  };
  const list = submitted.get(title.id) ?? [];
  submitted.set(title.id, [...list, review].slice(-20));
  return review;
}

