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

/** One series as a past week read it: its call, and its share (the average over the view's latest window). */
export type Reading = { series: Series; key: string; direction: Direction; share: number }[];
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
