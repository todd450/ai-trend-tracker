/**
 * The rules that turn a weekly series into a call: the comparison of two periods, the direction
 * it is given, and how a change is printed. Nothing here reads the data files, so the rules can be
 * tested on their own (scripts/calls.test.ts).
 */
import { standsClear, weeklyNoise } from "./noise.ts";

export type Direction = "rising" | "steady" | "cooling";

export type Signal = {
  /** One value per week, oldest first. */
  values: number[];
  recent: number;
  prior: number;
  /** Relative change of `recent` against `prior`; null when there is no base to compare with. */
  change: number | null;
  /**
   * False when the change is no bigger than the series' own week-to-week wobble would produce
   * (see noise.ts), so it is not called a rise or a fall however large it looks. Absent on
   * series that are not weekly, which are judged by the fixed rule alone.
   */
  clear?: boolean;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * One series read over a time span. `all` holds one value per week the series was collected for,
 * oldest first. The last `shown` are charted, the latest `window` weeks are compared with the
 * `window` before, and the wobble the change must clear is measured over all of them.
 */
export function compare(all: number[], shown: number, window: number): Signal {
  const values = all.slice(-shown);
  const recent = mean(values.slice(-window));
  const prior = mean(values.slice(-2 * window, -window));
  return {
    values,
    recent,
    prior,
    change: prior > 0 ? (recent - prior) / prior : null,
    clear: standsClear(recent - prior, weeklyNoise(all), window),
  };
}

/**
 * Judged on the whole percentage the page prints, so a figure shown as −10%
 * is never labelled steady when the rule says "at least 10%".
 */
export function directionOf(change: number | null, band: number): Direction {
  if (change === null || Math.round(Math.abs(change) * 100) < Math.round(band * 100)) return "steady";
  return change > 0 ? "rising" : "cooling";
}

/** The direction a signal is called: its change must pass the fixed rule and stand clear of its own wobble. */
export function signalDirection(signal: Signal, band: number): Direction {
  return signal.clear === false ? "steady" : directionOf(signal.change, band);
}

/** True for a change big enough to print as a rise or fall that is held back as wobble. */
export function heldBack(signal: Signal, band: number): boolean {
  return signal.clear === false && directionOf(signal.change, band) !== "steady";
}

export function fmtChange(change: number | null): string {
  if (change === null) return "new";
  const pct = Math.round(Math.abs(change) * 100);
  if (pct === 0) return "flat";
  return `${change > 0 ? "+" : "−"}${pct}%`;
}

/** "2–8 November 2026" for the week starting on the given Monday. */
export function fmtWeek(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return sameMonth
    ? `${start.getUTCDate()}–${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`
    : `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`;
}
