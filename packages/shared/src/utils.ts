export interface ThreadMatch {
  slug: string;
  id: number;
}

/**
 * Extract F95zone thread IDs from arbitrary text or URLs.
 * Matches `threads/(?:([^./]*)\.)?(\d+)` identically to _reference-repo/modules/utils.py.
 */
export function extractThreadMatches(text: string): ThreadMatch[] {
  if (!text) return [];
  const matches: ThreadMatch[] = [];
  const seen = new Set<number>();
  const pattern = /threads\/(?:([^./?\s#]*)\.)?(\d+)/g;
  for (const match of text.matchAll(pattern)) {
    const id = Number(match[2]);
    if (Number.isSafeInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      matches.push({
        slug: match[1] ?? "",
        id,
      });
    }
  }
  return matches;
}

/** Normalize an F95zone thread ID or URL into its canonical thread URL. */
export function cleanThreadUrl(idOrUrl: number | string): string {
  if (typeof idOrUrl === "number") {
    return `https://f95zone.to/threads/${idOrUrl}/`;
  }
  const found = extractThreadMatches(idOrUrl);
  if (found[0]) {
    return `https://f95zone.to/threads/${found[0].id}/`;
  }
  return idOrUrl;
}

/**
 * Normalize a Unix timestamp (seconds) to 12:00:00 UTC of that calendar date,
 * matching _reference-repo/common/parser.py:datestamp().
 */
export function datestampUtcNoon(unixSeconds: number): number {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return 0;
  }
  const date = new Date(unixSeconds * 1000);
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0) / 1000
  );
}

/**
 * Compute Bayesian average score (`W = 100, C = 0`) matching _reference-repo/modules/utils.py.
 */
export function bayesianAverage(avgRating: number, numVotes: number): number {
  const W = 100;
  const C = 0;
  if (numVotes + W === 0) return 0;
  return (numVotes * avgRating + W * C) / (numVotes + W);
}

/**
 * Exact TypeScript equivalent of Python's `str.strip(chars)`,
 * stripping any leading/trailing character present in `chars`.
 */
export function stripChars(value: string, chars: string): string {
  if (!value || !chars) return value;
  const charSet = new Set(chars);
  let start = 0;
  let end = value.length;
  while (start < end && charSet.has(value[start]!)) {
    start += 1;
  }
  while (end > start && charSet.has(value[end - 1]!)) {
    end -= 1;
  }
  return value.slice(start, end);
}
