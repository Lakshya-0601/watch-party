/**
 * Valence lexicon tuned for film & TV reviews, on VADER's −4…+4 scale.
 * Words not listed are treated as neutral.
 */
export const LEXICON: Record<string, number> = {
  // ── positive ──────────────────────────────────────────────
  addictive: 1.6, amazing: 3.1, amazingly: 2.8, astonishing: 2.7, awesome: 3.1, beautiful: 2.9,
  beautifully: 2.7, best: 3.2, binged: 1.2, breathtaking: 3.0, brilliant: 2.8, brilliantly: 2.8,
  captivating: 2.6, charming: 2.4, clever: 2.0, cool: 1.3, compelling: 2.3, cozy: 1.9, decent: 1.2,
  delightful: 2.9, electric: 2.2, emotional: 0.8, engaging: 2.2, enjoy: 2.2, enjoyable: 2.4, enjoyed: 2.3,
  epic: 2.4, excellent: 3.2, exceptional: 3.0, exciting: 2.4, fantastic: 3.0, fascinating: 2.6,
  favorite: 2.0, favourite: 2.0, fine: 0.8, flawless: 3.0, fresh: 1.3, fun: 2.3, funny: 1.9,
  gem: 2.4, genius: 2.9, good: 1.9, goosebumps: 2.0, gorgeous: 3.0, great: 3.1, gripping: 2.4, heartfelt: 2.3,
  heartwarming: 2.8, hilarious: 2.5, hooked: 1.5, impressive: 2.4, incredible: 2.9, inspired: 2.0,
  inspiring: 2.6, intense: 0.9, laugh: 1.8, laughed: 2.0, laughing: 1.8, liked: 1.8, lol: 1.8, love: 3.2, loved: 2.9, lovely: 2.8, magical: 2.6,
  masterful: 3.0, masterpiece: 3.4, memorable: 2.2, mesmerizing: 2.7, moving: 2.1, nice: 1.8,
  okay: 0.9, ok: 0.9, original: 1.5, outstanding: 3.2, perfect: 2.7, perfectly: 2.5,
  phenomenal: 3.1, polished: 1.8, powerful: 2.0, recommend: 1.8, refreshing: 2.0,
  rewatch: 1.4, rewatchable: 2.0, rich: 1.6, riveting: 2.6, satisfying: 2.2, smart: 1.7, solid: 1.6,
  spectacular: 3.0, stellar: 2.8, strong: 1.6, stunning: 2.9, superb: 3.1, sweet: 2.0,
  terrific: 2.9, thoughtful: 2.0, thrilling: 2.6, touching: 2.2, unforgettable: 2.7,
  underrated: 1.0, unique: 1.6, "well-made": 2.0, wonderful: 3.1, wonderfully: 2.9, worth: 1.6, wow: 2.4,

  // ── negative ──────────────────────────────────────────────
  annoying: -1.9, asleep: -1.0, awful: -3.1, awkward: -1.2, bad: -2.5, bland: -1.6, bloated: -1.6,
  bored: -1.9, boring: -2.2, cheap: -1.4, cliche: -1.4, cliched: -1.4, clunky: -1.5, confused: -1.3, confusing: -1.5,
  cringe: -2.0, cringey: -2.0, disappointed: -2.2, disappointing: -2.3, disappointment: -2.3,
  dragged: -1.4, drags: -1.4, dull: -1.9, exhausting: -1.6, fails: -2.0, failed: -2.0,
  flat: -1.3, flaw: -1.4, flaws: -1.4, forced: -1.4, forgettable: -1.8, garbage: -2.8,
  hate: -2.7, hated: -2.7, hollow: -1.6, horrible: -2.9, lacking: -1.4, lame: -1.8, lazy: -1.8,
  meh: -1.2, mediocre: -1.7, mess: -1.9, messy: -1.6, miss: -0.8, missed: -0.9,
  nonsense: -1.8, overacted: -1.6, overlong: -1.3, overrated: -2.0, painful: -2.0, pointless: -2.0, poor: -2.0,
  predictable: -1.5, problem: -1.2, problems: -1.2, ridiculous: -1.5, rushed: -1.5,
  shallow: -1.5, silly: -1.0, sloppy: -1.8, slow: -1.0, snooze: -1.8, stupid: -2.4,
  tedious: -2.1, terrible: -3.0, tiresome: -1.8, trash: -2.6, underwhelming: -1.9,
  uneven: -1.2, unwatchable: -3.0, waste: -2.2, wasted: -2.1, weak: -1.6, worse: -2.1,
  worst: -3.1,
};

/** Intensifiers (+) and dampeners (−) that scale the next sentiment word. */
export const BOOSTERS: Record<string, number> = {
  absolutely: 0.293, completely: 0.293, deeply: 0.293, especially: 0.293, extremely: 0.293,
  genuinely: 0.293, highly: 0.293, hugely: 0.293, incredibly: 0.293, insanely: 0.293,
  really: 0.293, so: 0.293, super: 0.293, totally: 0.293, truly: 0.293, utterly: 0.293,
  very: 0.293, way: 0.2, most: 0.293, seriously: 0.293,
  barely: -0.293, kinda: -0.293, mildly: -0.293, slightly: -0.293, somewhat: -0.293,
  sort: -0.293, bit: -0.293, little: -0.2, fairly: -0.2, pretty: 0.1,
};

export const NEGATIONS = new Set([
  "not", "no", "never", "nothing", "nowhere", "neither", "nor", "without", "hardly",
  "cannot", "isnt", "wasnt", "arent", "werent", "dont", "doesnt", "didnt", "cant",
  "couldnt", "wont", "wouldnt", "shouldnt", "aint",
]);

/**
 * Aspect buckets → trigger phrases. A sentence mentioning a trigger
 * contributes its sentiment to that aspect.
 */
export const ASPECTS: Record<string, string[]> = {
  Story: ["story", "plot", "twist", "ending", "writing", "script", "dialogue", "world-building", "premise"],
  Performances: ["acting", "performance", "performances", "cast", "chemistry", "characters", "lead"],
  Visuals: ["cinematography", "visuals", "animation", "art style", "visual effects", "stunts", "fight scenes", "shots"],
  Sound: ["soundtrack", "score", "music", "sound design"],
  Pacing: ["pacing", "pace", "runtime", "tension"],
  Humor: ["jokes", "humor", "humour", "comedy", "banter"],
  Atmosphere: ["scares", "atmosphere", "mood", "tone"],
};
