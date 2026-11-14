/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHECK_AFTER,
  FEW_CALLS,
  READINGS_NEEDED,
  RECORD_WEEKS,
  callsChecked,
  callsDue,
  dueDecimals,
  held,
  recordRows,
  trackRecord,
  weeksNeeded,
  type Reading,
} from "../src/lib/record.ts";
import type { Direction } from "../src/lib/calls.ts";

type Row = { series?: "topic" | "theme"; key?: string; name?: string; direction: Direction; share: number };

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
    set(i: number, { series = "topic", key = "a", name, direction, share }: Row) {
      const week = list[first + i];
      const at = week.findIndex((r) => r.series === series && r.key === key);
      const row = { series, key, ...(name ? { name } : {}), direction, share };
      if (at >= 0) week[at] = row;
      else week.push(row);
    },
    /** The index in `list` of week i, for `callsDue(list, w.at(i))`. */
    at(i: number) {
      return first + i;
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

test("a call comes due 13 weeks after the week it first appears, with its share then and now", () => {
  const w = weeks();
  w.set(5, { name: "Tool use & MCP", direction: "rising", share: 2.38 });
  w.set(5 + CHECK_AFTER, { name: "Tool use & MCP", direction: "steady", share: 2.42 });
  assert.deepEqual(callsDue(w.list, w.at(5 + CHECK_AFTER)), [
    { series: "topic", key: "a", name: "Tool use & MCP", direction: "rising", then: 2.38, now: 2.42, held: true },
  ]);
  // Not a week early, nor a week late.
  assert.deepEqual(callsDue(w.list, w.at(4 + CHECK_AFTER)), []);
  assert.deepEqual(callsDue(w.list, w.at(6 + CHECK_AFTER)), []);
});

test("a call made several weeks running comes due once, 13 weeks after its first week", () => {
  const w = weeks();
  w.run(0, 7, { direction: "cooling", share: 1 });
  w.run(CHECK_AFTER, CHECK_AFTER + 7, { direction: "steady", share: 1.1 });
  const due = Array.from({ length: 8 }, (_, i) => callsDue(w.list, w.at(CHECK_AFTER + i))!.length);
  assert.deepEqual(due, [1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(callsDue(w.list, w.at(CHECK_AFTER))![0].held, false);
});

test("steady readings never come due; a call that turns round is a new one; a series gone 13 weeks on is not checked", () => {
  const w = weeks();
  w.run(0, 1, { key: "turn", direction: "rising", share: 1 });
  w.set(2, { key: "turn", direction: "cooling", share: 1 });
  w.set(2 + CHECK_AFTER, { key: "turn", direction: "steady", share: 0.9 });
  w.set(2, { key: "flat", direction: "steady", share: 1 });
  w.set(2, { series: "theme", key: "gone", direction: "rising", share: 1 });
  assert.deepEqual(
    callsDue(w.list, w.at(2 + CHECK_AFTER))!.map((c) => [c.key, c.direction, c.held]),
    [["turn", "cooling", true]],
  );
});

test("a call due names its series, and falls back to the key without a name", () => {
  const w = weeks();
  w.set(3, { series: "theme", key: "trust", name: "Public trust & backlash", direction: "rising", share: 3.43 });
  w.set(3, { key: "nameless", direction: "cooling", share: 1 });
  w.set(3 + CHECK_AFTER, { series: "theme", key: "trust", direction: "steady", share: 2.95 });
  w.set(3 + CHECK_AFTER, { key: "nameless", direction: "steady", share: 0.5 });
  const due = callsDue(w.list, w.at(3 + CHECK_AFTER))!;
  assert.deepEqual(
    due.map((c) => [c.series, c.name, c.then, c.now, c.held]),
    [
      ["theme", "Public trust & backlash", 3.43, 2.95, false],
      ["topic", "nameless", 1, 0.5, true],
    ],
  );
});

test("without a reading for the week, the week of the call, or the week before it, the calls due are unknown", () => {
  const w = weeks();
  const list: (Reading | null)[] = [...w.list];
  const at = w.at(RECORD_WEEKS - 1 + CHECK_AFTER);
  assert.deepEqual(callsDue(list, at), []);
  for (const gap of [at, at - CHECK_AFTER, at - CHECK_AFTER - 1]) {
    const holed = [...list];
    holed[gap] = null;
    assert.equal(callsDue(holed, at), null, `gap at ${gap}`);
  }
  // The latest week is the default, and a week with no week before its call cannot be read.
  assert.deepEqual(callsDue(list), callsDue(list, list.length - 1));
  assert.equal(callsDue(list, CHECK_AFTER), null);
});

test("the calls due across the record's weeks are exactly the calls the record tallies", () => {
  const w = weeks();
  const pick = (n: number, k: number): Direction => (["rising", "steady", "cooling", "steady", "rising"] as const)[(n * 7 + k * 3) % 5];
  for (let i = -1; i < RECORD_WEEKS + CHECK_AFTER; i++) {
    for (const key of ["a", "b", "c"]) w.set(i, { key, direction: pick(i + 1, key.charCodeAt(0)), share: 1 + ((i * 13 + key.charCodeAt(0)) % 7) / 10 });
    w.set(i, { series: "theme", key: "t", direction: pick(i + 2, 1), share: 2 + ((i * 5) % 3) / 10 });
  }
  const record = trackRecord(w.list)!;
  const tally = { topic: { rising: [0, 0], cooling: [0, 0] }, theme: { rising: [0, 0], cooling: [0, 0] } };
  for (let i = 0; i < RECORD_WEEKS; i++) {
    for (const c of callsDue(w.list, w.list.length - 1 - i)!) {
      tally[c.series][c.direction][0]++;
      if (c.held) tally[c.series][c.direction][1]++;
    }
  }
  for (const series of ["topic", "theme"] as const) {
    for (const dir of ["rising", "cooling"] as const) {
      assert.deepEqual([record[series][dir].calls, record[series][dir].held], tally[series][dir], `${series} ${dir}`);
    }
  }
  assert.ok(record.topic.rising.calls > 0 && record.topic.cooling.calls > 0, "the fixture makes calls of both kinds");
});

test("the calls checked: the latest week's, and when it has none, the most recent week in the record that had any", () => {
  const w = weeks();
  const last = RECORD_WEEKS - 1;
  // Nothing comes due anywhere: no list, latest or earlier.
  assert.deepEqual(callsChecked(w.list), { latest: [], earlier: null });

  // Calls due three weeks before the latest: shown as the earlier week.
  w.set(last - 3, { key: "x", direction: "rising", share: 1 });
  w.set(last - 3 + CHECK_AFTER, { key: "x", direction: "steady", share: 2 });
  const quiet = callsChecked(w.list);
  assert.deepEqual(quiet.latest, []);
  assert.equal(quiet.earlier?.at, w.at(last - 3 + CHECK_AFTER));
  assert.deepEqual(quiet.earlier?.calls.map((c) => c.key), ["x"]);

  // Once the latest week has calls of its own, there is no earlier week to show.
  w.set(last, { key: "y", direction: "cooling", share: 1 });
  w.set(last + CHECK_AFTER, { key: "y", direction: "steady", share: 0.5 });
  const busy = callsChecked(w.list);
  assert.deepEqual(busy.latest.map((c) => c.key), ["y"]);
  assert.equal(busy.earlier, null);
});

test("the earlier week shown is never older than the record's year", () => {
  const w = weeks();
  // A call made in the week before the year began, due before the record's first checked week.
  w.set(-1, { key: "old", direction: "rising", share: 1 });
  w.set(-1 + CHECK_AFTER, { key: "old", direction: "steady", share: 2 });
  assert.deepEqual(callsChecked(w.list), { latest: [], earlier: null });
});

test("a call's shares print to two decimals, or more when two would print the same figure for both", () => {
  assert.equal(dueDecimals(2.38, 2.42), 2);
  // Held by under a hundredth: 2.92% then and 2.92% now would read as no move.
  assert.equal(dueDecimals(2.915828, 2.918702), 3);
  assert.equal(dueDecimals(2.91581, 2.91589), 4);
  // Never more than four, even when the shares are the same.
  assert.equal(dueDecimals(1, 1), 4);
});
