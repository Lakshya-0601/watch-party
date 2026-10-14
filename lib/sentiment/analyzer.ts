/**
 * Rule-based sentiment model (VADER-style) for short audience reviews.
 *
 * Pipeline per review:
 *   tokenise → lexicon lookup → intensifiers → negation → ALL-CAPS emphasis
 *   → "but" contrast weighting → exclamation emphasis → normalise to −1…+1
 *
 * It runs in microseconds with no model download, which makes it a good
 * stand-in behind the API contract; a hosted transformer can replace
 * `analyze()` later without touching the UI.
 */

import { ASPECTS, BOOSTERS, LEXICON, NEGATIONS } from "@/lib/sentiment/lexicon";
import type { Analysis, Highlight, SentimentLabel } from "@/lib/sentiment/types";

const NEGATION_SCALAR = -0.74;
const CAPS_BOOST = 0.733;
const EXCLAIM_BOOST = 0.292;
const NORMALIZATION_ALPHA = 15;

interface Token {
  raw: string;
  word: string; // lower-case, apostrophes stripped ("didn't" → "didnt")
  start: number;
  end: number;
}

function tokenize(text: string, offset: number): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const raw = m[0].replace(/['’]s$/i, "");
    tokens.push({
      raw,
      word: raw.toLowerCase().replace(/['’]/g, ""),
      start: offset + (m.index ?? 0),
      end: offset + (m.index ?? 0) + raw.length,
    });
  }
  return tokens;
}

/** Split into sentences, remembering where each starts in the original text. */
function sentences(text: string) {
  const out: { text: string; offset: number }[] = [];
  for (const m of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    if (m[0].trim()) out.push({ text: m[0], offset: m.index ?? 0 });
  }
  return out;
}

const normalize = (score: number) => score / Math.sqrt(score * score + NORMALIZATION_ALPHA);

/** "not", "never"… or any contraction ending in n't ("wasn't", "didn’t"). */
const isNegation = (t: Token) => NEGATIONS.has(t.word) || /n['’]t$/i.test(t.raw);

export const labelFor = (compound: number): SentimentLabel =>
  compound >= 0.05 ? "positive" : compound <= -0.05 ? "negative" : "neutral";

/** Score one sentence; returns the raw (un-normalised) sum and its highlights. */
function scoreSentence(sentence: string, offset: number, shouting: boolean) {
  const tokens = tokenize(sentence, offset);
  const butIndex = tokens.findIndex((t) => t.word === "but" || t.word === "however");
  const highlights: Highlight[] = [];
  let sum = 0;

  tokens.forEach((tok, i) => {
    const base = LEXICON[tok.word];
    if (base === undefined) return;
    let v = base;

    // Intensifiers / dampeners up to 3 words back, decaying with distance
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const b = BOOSTERS[tokens[i - back].word];
      if (b !== undefined) v += Math.sign(v) * b * (1 - 0.05 * (back - 1));
    }

    // ALL-CAPS emphasis, only when the review isn't shouting throughout
    if (!shouting && tok.raw.length > 1 && tok.raw === tok.raw.toUpperCase()) v += Math.sign(v) * CAPS_BOOST;

    // Negation in the preceding three words flips and dampens
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      if (isNegation(tokens[i - back])) {
        v *= NEGATION_SCALAR;
        break;
      }
    }

    // Contrast: "X, but Y" — Y carries more weight than X
    if (butIndex >= 0) v *= i < butIndex ? 0.5 : i > butIndex ? 1.5 : 1;

    sum += v;
    highlights.push({ start: tok.start, end: tok.end, valence: Math.round(v * 100) / 100 });
  });

  // Exclamation marks amplify whatever direction the sentence leans
  const bangs = Math.min(4, (sentence.match(/!/g) ?? []).length);
  if (sum !== 0) sum += Math.sign(sum) * bangs * EXCLAIM_BOOST;

  return { sum, highlights };
}

/** Run the full model over one review. */
export function analyze(text: string): Analysis {
  const letters = text.replace(/[^A-Za-z]/g, "");
  const shouting = letters.length > 0 && letters === letters.toUpperCase();

  let total = 0;
  const highlights: Highlight[] = [];
  const aspectSums: Record<string, { sum: number; n: number }> = {};

  for (const s of sentences(text)) {
    const { sum, highlights: h } = scoreSentence(s.text, s.offset, shouting);
    total += sum;
    highlights.push(...h);

    // Aspect-based sentiment: attribute this sentence's score to mentioned aspects
    const lower = s.text.toLowerCase();
    const sentenceCompound = normalize(sum);
    for (const [aspect, triggers] of Object.entries(ASPECTS)) {
      if (triggers.some((t) => new RegExp(`\\b${t}\\b`).test(lower))) {
        aspectSums[aspect] ??= { sum: 0, n: 0 };
        aspectSums[aspect].sum += sentenceCompound;
        aspectSums[aspect].n += 1;
      }
    }
  }

  const compound = Math.round(normalize(total) * 1000) / 1000;
  const aspects = Object.fromEntries(
    Object.entries(aspectSums).map(([a, { sum, n }]) => [a, Math.round((sum / n) * 1000) / 1000]),
  );
  return { compound, label: labelFor(compound), highlights, aspects };
}
