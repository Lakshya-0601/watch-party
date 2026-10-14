/**
 * Mock source of *raw* audience reviews. Text is assembled from templates
 * with a seeded PRNG so every title gets a stable, varied corpus; the
 * sentiment model then scores the text itself — nothing here carries a
 * pre-computed score. Higher-rated titles draw more positive templates.
 */

import type { Genre, Title } from "@/lib/types";

/** FNV-1a → mulberry32: deterministic random stream per seed string. */
export function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUTHORS = [
  "popcornpete", "cinephile_ana", "reelrita", "couchcritic", "midnightmarcus", "binge.queen",
  "framebyframe", "tv_tanvi", "sofasquad", "plotholepaul", "nightowl_noor", "director_cut",
  "kai.watches", "theaterkid22", "subtitlesonly", "maya.k", "creditsroller", "late_show_leo",
];

const GENERIC_ASPECTS = ["story", "acting", "pacing", "soundtrack", "ending", "cinematography", "characters", "dialogue"];

const GENRE_ASPECTS: Partial<Record<Genre, string[]>> = {
  Action: ["fight scenes", "stunts"],
  Horror: ["scares", "atmosphere"],
  Comedy: ["jokes", "humor"],
  Romcom: ["chemistry", "banter"],
  Romance: ["chemistry", "score"],
  Animation: ["animation", "art style"],
  "Sci-Fi": ["world-building", "visual effects"],
  Thriller: ["twist", "tension"],
  Drama: ["performances", "writing"],
};

const POS = ["amazing", "brilliant", "stunning", "gripping", "wonderful", "fantastic", "superb", "captivating", "excellent", "phenomenal", "unforgettable", "outstanding"];
const POS_MILD = ["solid", "fun", "enjoyable", "decent", "charming", "satisfying", "nice"];
const NEG = ["boring", "disappointing", "predictable", "messy", "forgettable", "tedious", "weak", "bland", "underwhelming", "clunky"];
const NEG_MILD = ["slow", "uneven", "a little flat", "rushed", "silly"];
const BOOST = ["absolutely", "really", "truly", "so", "incredibly", "genuinely"];

/** Aspect nouns that take "are" instead of "is". */
const PLURAL = new Set(["fight scenes", "stunts", "scares", "jokes", "visual effects", "characters", "performances"]);

type Slots = {
  a: string; b: string; // two different aspects ("the pacing", "the jokes")
  isA: string; isB: string; // matching verb: "is" / "are"
  p: string; p2: string; m: string; n: string; nm: string; x: string; t: string; k: string;
};

const POSITIVE: ((s: Slots) => string)[] = [
  (s) => `The ${s.a} ${s.isA} ${s.x} ${s.p}. Loved every minute of it!`,
  (s) => `${cap(s.p)} ${s.a}, ${s.p2} ${s.b}. Watched it twice with the group.`,
  (s) => `Honestly one of the best ${s.k}s I've seen in years. The ${s.a} ${s.isA} ${s.p}.`,
  (s) => `Not boring at all — the ${s.a} kept the whole room hooked.`,
  (s) => `The ${s.b} ${s.isB} a bit slow at first, but the ${s.a} ${s.isA} ${s.x} ${s.p}.`,
  (s) => `${s.t} is a masterpiece. ${cap(s.p)} from start to finish!!`,
  (s) => `Came for the ${s.a}, stayed for the ${s.b}. ${cap(s.p2)} stuff.`,
  (s) => `We paused it like ten times just to scream about the ${s.a}. ${cap(s.p)}.`,
  (s) => `I didn't expect much, but the ${s.a} ${s.isA} ${s.p}. Highly recommend.`,
  (s) => `The ${s.a} ${s.isA} ${s.x} ${s.p} and the ${s.b} ${s.isB} ${s.p2}. Perfect movie night pick.`,
  (s) => `${cap(s.m)} ${s.k} with ${s.p} ${s.a}. Would rewatch.`,
  (s) => `The ${s.a}?? ${s.p.toUpperCase()}. Don't miss this one.`,
  (s) => `Our whole room went quiet during the ${s.a}. ${cap(s.x)} ${s.p}.`,
  (s) => `Never thought the ${s.b} could be this ${s.p}. Instant favorite.`,
  (s) => `Five stars from our watch party. The ${s.a} ${s.isA} ${s.p2}!`,
];

const NEGATIVE: ((s: Slots) => string)[] = [
  (s) => `The ${s.a} ${s.isA} ${s.n} and the ${s.b} felt ${s.nm}.`,
  (s) => `I wanted to love it, but honestly it was ${s.n}.`,
  (s) => `Not as ${s.p} as everyone says. The ${s.a} felt ${s.n}.`,
  (s) => `Way too ${s.nm}. The ${s.a} never really landed for us.`,
  (s) => `The ${s.a} ${s.isA} ${s.p}, but the ${s.b} ${s.isB} ${s.x} ${s.n}.`,
  (s) => `Half the room fell asleep. ${cap(s.n)} ${s.b} and ${s.n} ${s.a}.`,
  (s) => `Overrated. The ${s.a} wasn't good and the ${s.b} dragged.`,
  (s) => `Expected more from ${s.t}. The ${s.a} ${s.isA} pretty ${s.n}.`,
];

const NEUTRAL: ((s: Slots) => string)[] = [
  (s) => `Watched ${s.t} on a weeknight with the group chat.`,
  (s) => `The ${s.a} ${s.isA} fine. Not my usual kind of ${s.k}.`,
  (s) => `Interesting ${s.b}. Some of us liked it more than others.`,
  (s) => `Third time watching it. Still talking about the ${s.a} afterwards.`,
  (s) => `Good for a group watch, though the ${s.b} ${s.isB} a little ${s.nm}.`,
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

export interface RawReview {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

/** Generate review #n for a title. Same inputs → same review. */
export function generateReview(title: Title, n: number | string, createdAt: number): RawReview {
  const r = seededRandom(`${title.id}:${n}`);
  const aspects = [...GENERIC_ASPECTS, ...title.genres.flatMap((g) => GENRE_ASPECTS[g] ?? [])];
  const a = pick(r, aspects);
  let b = pick(r, aspects);
  if (b === a) b = aspects[(aspects.indexOf(a) + 1) % aspects.length];

  const slots: Slots = {
    a, b,
    isA: PLURAL.has(a) ? "are" : "is",
    isB: PLURAL.has(b) ? "are" : "is",
    p: pick(r, POS), p2: pick(r, POS), m: pick(r, POS_MILD),
    n: pick(r, NEG), nm: pick(r, NEG_MILD), x: pick(r, BOOST),
    t: title.title, k: title.kind === "movie" ? "movie" : "show",
  };

  // Rating 7.0 → ~31% positive templates, 8.0 → ~63%, 9.0 → ~92%
  const pPositive = Math.min(0.92, Math.max(0.25, (title.rating - 6) / 3.2));
  const roll = r();
  const bank = roll < pPositive ? POSITIVE : roll < pPositive + (1 - pPositive) * 0.6 ? NEGATIVE : NEUTRAL;

  return { id: `${title.id}-${n}`, author: pick(r, AUTHORS), text: pick(r, bank)(slots), createdAt };
}
