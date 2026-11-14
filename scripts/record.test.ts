/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHECK_AFTER,
  FEW_CALLS,
  READINGS_NEEDED,
  RECORD_WEEKS,
  held,
  recordRows,
  trackRecord,
  weeksNeeded,
  type Reading,
} from "../src/lib/record.ts";
import type { Direction } from "../src/lib/calls.ts";

type Row = { series?: "topic" | "theme"; key?: string; direction: Direction; share: number };

/**
 * A run of weekly readings, oldest first, all steady at a share of 1, long enough for a record.
 * `set(i, row)` puts a reading of one series in week i, counted from the first week the record
 * can call in (the week before it is index -1).
 */
function weeks() {
  const list: Reading[] = Array.from({ length: READINGS_NEEDED }, () => []);
  const first = list.length - CHECK_AFTER - RECORD_WEEKS;
  return {
    list,
    first,
    set(i: number, { series = "topic", key = "a", direction, share }: Row) {
      const week = list[first + i];
      const at = week.findIndex((r) => r.series === series && r.key === key);
      const row = { series, key, direction, share };
      if (at >= 0) week[at] = row;
      else week.push(row);
    },
    /** One series' readings over weeks `from` to `to` inclusive. */
    run(from: number, to: number, row: Row) {
      for (let i = from; i <= to; i++) this.set(i, row);
    },
  };
}

test("a call holds only if the share moved further the way it was called", () => {
  assert.equal(held("rising", 1, 1.2), true);
  assert.equal(held("rising", 1, 0.8), false);
  assert.equal(held("cooling", 1, 0.8), true);
  assert.equal(held("cooling", 1, 1.2), false);
  // No further move is not a move the way it was called.
  assert.equal(held("rising", 1, 1), false);
  assert.equal(held("cooling", 1, 1), false);
});

test("a call made several weeks running counts once, on the week it first appears", () => {
  const w = weeks();
  w.run(0, 7, { direction: "rising", share: 1 });
  w.set(CHECK_AFTER, { direction: "steady", share: 2 });
  const record = trackRecord(w.list);
  assert.deepEqual(record?.topic.rising, { calls: 1, held: 1 });
});

test("a call that stops and comes back, or turns round, is a new call", () => {
  const w = weeks();
  w.run(0, 2, { direction: "rising", share: 1 });
  w.set(3, { direction: "steady", share: 1 });
  w.run(4, 5, { direction: "rising", share: 1 });
  w.run(6, 7, { direction: "cooling", share: 1 });
  w.run(CHECK_AFTER, CHECK_AFTER + 7, { direction: "steady", share: 1 });
  const record = trackRecord(w.list);
  assert.equal(record?.topic.rising.calls, 2);
  assert.equal(record?.topic.cooling.calls, 1);
});

test("each call is checked 13 weeks after the week it was made, not against the latest week", () => {
  const w = weeks();
  w.set(10, { direction: "rising", share: 1 });
  w.set(10 + CHECK_AFTER, { direction: "steady", share: 1.5 });
  // Later still the share falls back below the call's; that does not undo it.
  w.set(10 + CHECK_AFTER + 1, { direction: "steady", share: 0.5 });
  assert.deepEqual(trackRecord(w.list)?.topic.rising, { calls: 1, held: 1 });
});

test("only the past year's calls count: none already running before it, none too recent to check", () => {
  const w = weeks();
  // Running since the week before the year began: not a call made in the year.
  w.set(-1, { key: "before", direction: "cooling", share: 1 });
  w.set(0, { key: "before", direction: "cooling", share: 1 });
  // Made in the year's last week, and checked in the latest week.
  w.set(RECORD_WEEKS - 1, { key: "last", direction: "cooling", share: 1 });
  w.set(RECORD_WEEKS - 1 + CHECK_AFTER, { key: "last", direction: "steady", share: 0.5 });
  // Made after the year closed: its 13 weeks have not passed.
  w.set(RECORD_WEEKS, { key: "late", direction: "cooling", share: 1 });
  assert.deepEqual(trackRecord(w.list)?.topic.cooling, { calls: 1, held: 1 });
});

test("topics and themes are tallied apart, and a series missing 13 weeks on is not checked", () => {
  const w = weeks();
  w.set(0, { series: "theme", direction: "rising", share: 1 });
  w.set(CHECK_AFTER, { series: "theme", direction: "steady", share: 0.9 });
  w.set(1, { key: "gone", direction: "rising", share: 1 });
  const record = trackRecord(w.list);
  assert.deepEqual(record?.theme.rising, { calls: 1, held: 0 });
  assert.deepEqual(record?.topic.rising, { calls: 0, held: 0 });
});

test("with too few weeks, or a week without enough history to read, there is no record", () => {
  const w = weeks();
  assert.notEqual(trackRecord(w.list), null);
  assert.equal(trackRecord(w.list.slice(1)), null);
  const gap: (Reading | null)[] = [...w.list];
  gap[0] = null;
  assert.equal(trackRecord(gap), null);
  // Older weeks than the record reads may lack history.
  assert.notEqual(trackRecord([null, ...w.list]), null);
});

const tallies = (topicRising: number, topicCooling: number, themeRising: number, themeCooling: number) => ({
  topic: { rising: { calls: topicRising, held: 1 }, cooling: { calls: topicCooling, held: 1 } },
  theme: { rising: { calls: themeRising, held: 1 }, cooling: { calls: themeCooling, held: 1 } },
});

test("the scorecard has three rows: topics rising, topics cooling, and themes either way", () => {
  const rows = recordRows(tallies(49, 33, 5, 7), {});
  assert.deepEqual(
    rows.map((r) => [r.id, r.tone, r.calls, r.held]),
    [
      ["topic-rising", "rising", 49, 1],
      ["topic-cooling", "cooling", 33, 1],
      ["theme", "both", 12, 2],
    ],
  );
  assert.ok(rows.every((r) => r.held <= r.calls));
});

test("a row resting on few calls says so, whichever row it is", () => {
  const rows = recordRows(tallies(FEW_CALLS - 1, FEW_CALLS, 30, 30), {});
  assert.deepEqual(
    rows.map((r) => r.few),
    [true, false, false],
  );
  assert.equal(recordRows(tallies(0, 0, 0, 0), {}).every((r) => r.few), true);
});

test("the rows today's headline makes a call of are marked, and only those", () => {
  const mark = (headline: Parameters<typeof recordRows>[1]) =>
    recordRows(tallies(30, 30, 30, 30), headline).filter((r) => r.inHeadline).map((r) => r.id);
  assert.deepEqual(mark({ topic: "cooling", theme: true }), ["topic-cooling", "theme"]);
  assert.deepEqual(mark({ topic: "rising" }), ["topic-rising"]);
  assert.deepEqual(mark({}), []);
});

test("the weeks of counts a view needs for a record grow with its window", () => {
  // A 4-week window reads 8 weeks for its first call; then the week before the year, the year, and 13 weeks to check.
  assert.equal(weeksNeeded(4), 8 + RECORD_WEEKS + CHECK_AFTER);
  assert.ok(weeksNeeded(26) > weeksNeeded(13));
});
