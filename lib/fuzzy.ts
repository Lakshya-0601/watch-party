/**
 * Tiny dependency-free fuzzy matcher.
 *
 * Two strategies are combined so search feels forgiving:
 *  1. Subsequence matching ("strthngs" → "Stranger Things"), rewarding
 *     consecutive runs and matches at word starts.
 *  2. Typo tolerance via Damerau-Levenshtein per word ("intersteller" →
 *     "Interstellar"), so a single swapped/missing letter still matches.
 *
 * Scores are 0..1 where higher is better; 0 means "no match".
 */

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Subsequence score: every query char must appear in order in the target. */
function subsequenceScore(query: string, target: string): number {
  if (!query) return 1;
  let qi = 0;
  let score = 0;
  let run = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      const atWordStart = ti === 0 || target[ti - 1] === " ";
      run += 1;
      score += 1 + run * 0.5 + (atWordStart ? 1.5 : 0);
      qi++;
    } else {
      run = 0;
    }
  }
  if (qi < query.length) return 0;
  // Normalise against the best possible score for this query length
  const best = query.length * (2.5 + (query.length + 1) * 0.25);
  return Math.min(1, score / best);
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Every query word must loosely match some target word (prefix or small typo). */
function typoScore(query: string, target: string): number {
  const qWords = query.split(" ");
  const tWords = target.split(" ");
  let total = 0;
  for (const qw of qWords) {
    const allowed = qw.length <= 3 ? 0 : qw.length <= 6 ? 1 : 2;
    let best = 0;
    for (const tw of tWords) {
      if (tw.startsWith(qw)) {
        best = 1;
        break;
      }
      // Also compare against the same-length prefix so partial words still count
      const dist = Math.min(editDistance(qw, tw), editDistance(qw, tw.slice(0, qw.length)));
      if (dist <= allowed) best = Math.max(best, 1 - dist / (qw.length + 1));
    }
    if (best === 0) return 0;
    total += best;
  }
  return (total / qWords.length) * 0.9;
}

/** Score one query against one piece of text. */
export function fuzzyScore(rawQuery: string, rawTarget: string): number {
  const query = normalize(rawQuery);
  const target = normalize(rawTarget);
  if (!query) return 1;
  if (!target) return 0;
  if (target === query) return 1;
  if (target.startsWith(query)) return 0.98;
  if (target.includes(query)) return 0.92;
  return Math.max(subsequenceScore(query.replace(/ /g, ""), target), typoScore(query, target));
}

/**
 * Rank items by their best-scoring field. Primary fields (e.g. title) are
 * weighted above secondary ones (cast, keywords) so title hits float to the top.
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => { text: string; weight: number }[],
  threshold = 0.35,
): { item: T; score: number }[] {
  if (!normalize(query)) return items.map((item) => ({ item, score: 1 }));
  return items
    .map((item) => {
      const score = Math.max(...fields(item).map((f) => fuzzyScore(query, f.text) * f.weight));
      return { item, score };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
