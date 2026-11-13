/**
 * How much a weekly series moves when nothing is happening, and whether a change stands clear of that.
 * A fixed "10% or more" treats every series alike, but a topic with twenty papers a week swings by
 * more than that on its own. So a change must also be bigger than the series' own week-to-week
 * wobble would produce between the two periods being compared.
 */

/** A change must be at least this many times the difference wobble alone would be expected to give. */
export const NOISE_MULTIPLE = 2;
/** Weeks of history needed before the wobble can be estimated; with fewer, only the fixed rule applies. */
export const MIN_WEEKS_FOR_NOISE = 9;

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The typical random movement of one week's value (a standard deviation), or null when the series
 * is too short to tell. It is taken from the differences between neighbouring weeks, so a series
 * that climbs steadily all year is not mistaken for a noisy one, and from their median, so one
 * freak week does not set the level.
 */
export function weeklyNoise(series: number[]): number | null {
  if (series.length < MIN_WEEKS_FOR_NOISE) return null;
  const steps = series.slice(1).map((v, i) => Math.abs(v - series[i]));
  // 1.4826 turns a median absolute deviation into a standard deviation; a difference of two weeks
  // carries the noise of both, hence the square root of two.
  return (1.4826 * median(steps)) / Math.SQRT2;
}

/**
 * True when the difference between the averages of two `window`-week periods is larger than
 * week-to-week wobble would explain. With no estimate of the wobble there is nothing to test
 * against, so the change is let through to the fixed rule.
 */
export function standsClear(difference: number, noise: number | null, window: number): boolean {
  if (noise === null) return true;
  // The average of `window` weeks wobbles less than one week does; the difference of two such averages
  // carries both.
  const expected = noise * Math.sqrt(2 / window);
  return Math.abs(difference) >= NOISE_MULTIPLE * expected && difference !== 0;
}
