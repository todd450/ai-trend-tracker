/**
 * The track record: how often the page's calls held. The page keeps no archive of what it said,
 * but it keeps every week's counts, so each past week's calls can be worked out again by reading
 * the data as of that week (as editions.ts does for headlines) and checked against the counts 13
 * weeks later. Nothing here reads the data files, so the definition of a call and of "held" can
 * be tested on their own (scripts/record.test.ts).
 */
import type { Direction } from "./calls.ts";

/** How many weeks after a call it is checked. */
export const CHECK_AFTER = 13;
/** How many weeks of calls the record covers: the past year, up to the last week that can be checked. */
export const RECORD_WEEKS = 52;
/** A tally resting on fewer calls than this is marked as few, so its share is not read as firm. */
export const FEW_CALLS = 20;
/** Weekly readings the record reads: the week before the year, the year, and the weeks to check its last call. */
export const READINGS_NEEDED = 1 + RECORD_WEEKS + CHECK_AFTER;

export type Series = "topic" | "theme";
export type Called = Exclude<Direction, "steady">;

/**
 * One series as a past week read it: its call, and its share (the average over the view's latest
 * window). `name` is how the page names it; a reading without one is named by its key.
 */
export type Reading = { series: Series; key: string; name?: string; direction: Direction; share: number }[];
export type Tally = { calls: number; held: number };
export type TrackRecord = Record<Series, Record<Called, Tally>>;

/** A call held if, 13 weeks later, the share had moved further the way it was called. */
export function held(direction: Called, then: number, later: number): boolean {
  return direction === "rising" ? later > then : later < then;
}

/**
 * Weeks of counts a view comparing two `window`-week periods needs before it has a record: enough
 * to make a call in the week before the year, then the year, then 13 weeks to check its last call.
 */
export const weeksNeeded = (window: number) => 2 * window - 1 + READINGS_NEEDED;

/**
 * The record from weekly readings, oldest first, ending with the latest week. A reading is null for a
 * week without enough history to make calls. Each call is counted once, in the week it first
 * appears: a series called rising eight weeks running is one call; one that goes steady, or turns
 * round, and is called again is a new one. Null when the readings do not cover a whole year of
 * calls and the 13 weeks after it.
 */
export function trackRecord(readings: (Reading | null)[]): TrackRecord | null {
  const span = readings.slice(-READINGS_NEEDED);
  if (span.length < READINGS_NEEDED || span.some((r) => r === null)) return null;
  const weeks = span as Reading[];
  const id = (r: Reading[number]) => `${r.series}:${r.key}`;
  const byId = weeks.map((week) => new Map(week.map((r) => [id(r), r])));

  const record: TrackRecord = {
    topic: { rising: { calls: 0, held: 0 }, cooling: { calls: 0, held: 0 } },
    theme: { rising: { calls: 0, held: 0 }, cooling: { calls: 0, held: 0 } },
  };
  for (let i = 1; i <= RECORD_WEEKS; i++) {
    for (const now of weeks[i]) {
      if (now.direction === "steady") continue;
      if (byId[i - 1].get(id(now))?.direction === now.direction) continue;
      const later = byId[i + CHECK_AFTER].get(id(now));
      if (!later) continue;
      const tally = record[now.series][now.direction];
      tally.calls++;
      if (held(now.direction, now.share, later.share)) tally.held++;
    }
  }
  return record;
}

/** One call checked: the series, the way it was called, its share when called and 13 weeks later, and whether it held. */
export type DueCall = { series: Series; key: string; name: string; direction: Called; then: number; now: number; held: boolean };

/**
 * The calls checked in week `at` of the readings (the latest week by default): every rising or
 * cooling call first made CHECK_AFTER weeks before it, counted as `trackRecord` counts it, once, in
 * the week it first appears. A series missing from week `at` is not checked, as in the record.
 * Null when it cannot be told: the week, the week of the call, or the week before that has no reading.
 */
export function callsDue(readings: (Reading | null)[], at = readings.length - 1): DueCall[] | null {
  const made = at - CHECK_AFTER;
  const [before, then, now] = [readings[made - 1], readings[made], readings[at]];
  if (made < 1 || !before || !then || !now) return null;
  const id = (r: Reading[number]) => `${r.series}:${r.key}`;
  const was = new Map(before.map((r) => [id(r), r.direction]));
  const later = new Map(now.map((r) => [id(r), r]));
  const due: DueCall[] = [];
  for (const call of then) {
    if (call.direction === "steady" || was.get(id(call)) === call.direction) continue;
    const checked = later.get(id(call));
    if (!checked) continue;
    due.push({
      series: call.series,
      key: call.key,
      name: call.name ?? call.key,
      direction: call.direction,
      then: call.share,
      now: checked.share,
      held: held(call.direction, call.share, checked.share),
    });
  }
  return due;
}

/**
 * How many decimals a checked call's two shares print with: two, since a call can hold by a few
 * hundredths, or more (up to four) when two would print the same figure for both and hide the move.
 */
export function dueDecimals(then: number, now: number): number {
  let places = 2;
  while (places < 4 && then.toFixed(places) === now.toFixed(places)) places++;
  return places;
}

/**
 * The calls checked in the latest week and, when it has none, the most recent week of the record's
 * year that had any (`at` indexes the readings). `earlier` is null when the latest week has calls,
 * or when no week of the year had any.
 */
export function callsChecked(readings: (Reading | null)[]): { latest: DueCall[]; earlier: { at: number; calls: DueCall[] } | null } {
  const last = readings.length - 1;
  const latest = callsDue(readings, last) ?? [];
  if (latest.length) return { latest, earlier: null };
  for (let at = last - 1; at > last - RECORD_WEEKS; at--) {
    const calls = callsDue(readings, at);
    if (!calls) break;
    if (calls.length) return { latest, earlier: { at, calls } };
  }
  return { latest, earlier: null };
}

/** One line of the scorecard. `tone` colours its bar: the call's colour, or neutral where it mixes both. */
export type RecordRow = {
  id: "topic-rising" | "topic-cooling" | "theme";
  label: string;
  /** What holding means for this row: "kept rising". */
  outcome: string;
  tone: Called | "both";
  calls: number;
  held: number;
  /** Fewer than FEW_CALLS calls behind it. */
  few: boolean;
  /** Today's headline makes a call of this kind. */
  inHeadline: boolean;
};

/**
 * The three lines of the scorecard. Theme calls are few, so rises and falls share one line.
 * `headline` says which kinds of call today's headline makes: a topic's direction, and whether it
 * names a theme.
 */
export function recordRows(record: TrackRecord, headline: { topic?: Called; theme?: boolean }): RecordRow[] {
  const row = (id: RecordRow["id"], label: string, outcome: string, tone: RecordRow["tone"], tallies: Tally[], inHeadline: boolean): RecordRow => {
    const calls = tallies.reduce((n, t) => n + t.calls, 0);
    return { id, label, outcome, tone, calls, held: tallies.reduce((n, t) => n + t.held, 0), few: calls < FEW_CALLS, inHeadline };
  };
  return [
    row("topic-rising", "Research topics, rising", "kept rising", "rising", [record.topic.rising], headline.topic === "rising"),
    row("topic-cooling", "Research topics, cooling", "kept falling", "cooling", [record.topic.cooling], headline.topic === "cooling"),
    row("theme", "Themes, rising or cooling", "kept going", "both", [record.theme.rising, record.theme.cooling], headline.theme === true),
  ];
}
