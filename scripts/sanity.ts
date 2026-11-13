/**
 * Plausibility checks for the weekly counts, run by the collector before a new
 * figure replaces an old one. A source can answer "200 OK" with a wrong number
 * (arXiv's search sometimes returns zero results; a dropped filter returns far
 * too many), and the site would print that as a collapse or a surge.
 *
 * The limits are set well outside anything in the first year of history, where
 * the largest real one-week moves against the median of the eight weeks before
 * were: totals 0.61× to 1.89×, topics and themes 0.32× to 2.84×.
 */

export type WeeklyCounts = Record<string, number>;

/** A total is a denominator (all AI papers, all AI stories); a part is one topic's or theme's count. */
export type Kind = "total" | "part";

/** Weeks before the one being checked that the usual level is taken from, and the fewest that will do. */
const LOOKBACK = 8;
const MIN_PRIOR = 4;

/** A part is only judged once its usual level is this high; below it, real counts swing too much. */
const PART_ZERO_FROM = 20;
const PART_DROP_FROM = 40;

const LIMITS = {
  total: { low: 0.4, high: 3 },
  part: { low: 0.15, high: 6 },
} as const;

/** A recount of a week already stored should not fall by half: sources index late, so counts grow. */
const RECOUNT_FLOOR = 0.5;
const RECOUNT_FROM = 20;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Why `value` should not be stored for `week`, or null when it is believable.
 * `series` is what is stored now, including any earlier count for the same week.
 */
export function implausible(kind: Kind, series: WeeklyCounts, week: string, value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return `not a count (${value})`;
  if (kind === "total" && value === 0) return "zero";

  const stored = series[week];
  if (stored !== undefined && stored >= RECOUNT_FROM && value < stored * RECOUNT_FLOOR) {
    return `recount fell from ${stored} to ${value}`;
  }

  const prior = Object.keys(series)
    .filter((w) => w < week)
    .sort()
    .slice(-LOOKBACK)
    .map((w) => series[w]);
  if (prior.length < MIN_PRIOR) return null;
  const usual = median(prior);
  const { low, high } = LIMITS[kind];

  if (kind === "part") {
    if (usual < PART_ZERO_FROM) return null;
    if (value === 0) return `zero against a usual ${Math.round(usual)}`;
    if (usual >= PART_DROP_FROM && value < usual * low) return `${value} against a usual ${Math.round(usual)}`;
  } else if (value < usual * low) {
    return `${value} against a usual ${Math.round(usual)}`;
  }
  if (value > usual * high) return `${value} against a usual ${Math.round(usual)}`;
  return null;
}
