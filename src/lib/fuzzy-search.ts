/**
 * DnD — Fuzzy search utility.
 * Provides YouTube-style "did you mean?" suggestions with typo tolerance.
 *
 * Uses a combination of:
 * 1. Subsequence fuzzy matching (like fzf/cmdk) — matches characters in order
 * 2. Levenshtein distance for typo correction — finds close misspellings
 * 3. Token-based matching — matches across word boundaries
 */

/** Levenshtein distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[m][n];
}

/** Check if `query` is a fuzzy subsequence of `target` (characters in order, not necessarily adjacent). */
export function fuzzySubsequence(query: string, target: string): { matched: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return { matched: true, score: 0 };
  let qi = 0;
  let score = 0;
  let lastMatchPos = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for adjacent matches
      const gap = lastMatchPos >= 0 ? ti - lastMatchPos - 1 : 0;
      score += gap === 0 ? 10 : Math.max(0, 5 - gap);
      // Bonus for matching at word boundaries
      if (ti === 0 || t[ti - 1] === " " || t[ti - 1] === "_" || t[ti - 1] === "-") {
        score += 5;
      }
      lastMatchPos = ti;
      qi++;
    }
  }
  return { matched: qi === q.length, score };
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matchedFields: string[];
  isExact: boolean;
  isFuzzy: boolean;
  isTypoCorrection: boolean;
}

/**
 * Search a list of items with fuzzy matching and typo tolerance.
 * Returns results sorted by relevance (exact > fuzzy > typo correction).
 *
 * @param items Array of items to search
 * @param query Search query
 * @param fields Function that returns the searchable text fields for each item
 * @param maxTypoDistance Maximum Levenshtein distance for typo corrections (default: 2)
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => string[],
  maxTypoDistance: number = 2,
): SearchResult<T>[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return items.map((item) => ({
      item,
      score: 0,
      matchedFields: [],
      isExact: false,
      isFuzzy: false,
      isTypoCorrection: false,
    }));
  }

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const itemFields = fields(item);
    let bestScore = -1;
    let isExact = false;
    let isFuzzy = false;
    let isTypoCorrection = false;
    const matchedFields: string[] = [];

    for (const field of itemFields) {
      const f = field.toLowerCase();

      // 1. Exact substring match (highest priority)
      if (f.includes(q)) {
        const score = 1000 + (f.startsWith(q) ? 500 : 0) + (f.length === q.length ? 200 : 0);
        if (score > bestScore) {
          bestScore = score;
          isExact = true;
          isFuzzy = false;
          isTypoCorrection = false;
        }
        if (!matchedFields.includes(field)) matchedFields.push(field);
        continue;
      }

      // 2. Token-based match (query matches a token in the field)
      const tokens = f.split(/[\s_\-]+/);
      for (const token of tokens) {
        if (token.startsWith(q)) {
          const score = 800 + (token.length === q.length ? 100 : 0);
          if (score > bestScore) {
            bestScore = score;
            isExact = true;
            isFuzzy = false;
            isTypoCorrection = false;
          }
          if (!matchedFields.includes(field)) matchedFields.push(field);
        }
      }

      // 3. Fuzzy subsequence match (characters in order, not adjacent)
      const fuzzy = fuzzySubsequence(q, f);
      if (fuzzy.matched && fuzzy.score > 0) {
        const score = 300 + fuzzy.score;
        if (score > bestScore) {
          bestScore = score;
          isExact = false;
          isFuzzy = true;
          isTypoCorrection = false;
        }
        if (!matchedFields.includes(field)) matchedFields.push(field);
      }

      // 4. Typo correction via Levenshtein distance
      // Check if query is close to any token in the field
      for (const token of tokens) {
        if (Math.abs(token.length - q.length) <= 2) {
          const dist = levenshtein(q, token);
          if (dist > 0 && dist <= maxTypoDistance) {
            const score = 200 - dist * 50;
            if (score > bestScore) {
              bestScore = score;
              isExact = false;
              isFuzzy = false;
              isTypoCorrection = true;
            }
            if (!matchedFields.includes(field)) matchedFields.push(field);
          }
        }
      }

      // Also check full-field Levenshtein for short fields
      if (f.length <= 20) {
        const dist = levenshtein(q, f);
        if (dist > 0 && dist <= maxTypoDistance) {
          const score = 150 - dist * 40;
          if (score > bestScore) {
            bestScore = score;
            isExact = false;
            isFuzzy = false;
            isTypoCorrection = true;
          }
          if (!matchedFields.includes(field)) matchedFields.push(field);
        }
      }
    }

    if (bestScore >= 0) {
      results.push({
        item,
        score: bestScore,
        matchedFields,
        isExact,
        isFuzzy,
        isTypoCorrection,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}
