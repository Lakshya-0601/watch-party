/** Shared types for the sentiment pipeline (server) and its UI (client). */

export type SentimentLabel = "positive" | "neutral" | "negative";

/** Character span of a word that moved the score (for in-text highlighting). */
export interface Highlight {
  start: number;
  end: number;
  /** Valence after negation / intensifier / contrast rules */
  valence: number;
}

export interface Analysis {
  /** Normalised score in −1…+1 */
  compound: number;
  label: SentimentLabel;
  highlights: Highlight[];
  /** Aspect → compound for sentences that mention it */
  aspects: Record<string, number>;
}

export interface ScoredReview {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  source: "audience" | "live" | "you";
  analysis: Analysis;
}

export interface AspectScore {
  aspect: string;
  /** 0–100 */
  score: number;
  mentions: number;
}

export interface SentimentReport {
  titleId: string;
  /** Audience Sentiment Index, 0–100 */
  index: number;
  verdict: string;
  /** Index change over the trailing trend window */
  trend: number;
  sampleSize: number;
  distribution: Record<SentimentLabel, number>;
  aspects: AspectScore[];
  reviews: ScoredReview[];
  model: { name: string; version: string };
  latencyMs: number;
  updatedAt: number;
}

export interface SentimentSummary {
  index: number;
  verdict: string;
  trend: number;
}
