/**
 * Run with `npm test`. Replays the stored weekly counts through `replayRecord()`, the way the trends
 * page builds its track record, to check which views can carry one and that its tallies add up.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { replayRecord } = await fromSrc<any>("lib/replay");
const trends = await fromSrc<any>("lib/trends");
const { READINGS_NEEDED, trackRecord } = await fromSrc<any>("lib/record");

const SHORT = ["oneWeek", "oneMonth", "threeMonths", "sixMonths"];
const LONG = ["oneYear", "twoYears"];

test("the 1-week to 6-month views carry a record, and every tally adds up", () => {
  for (const h of SHORT) {
    const { record } = replayRecord(h);
    assert.ok(record, `${h} has a record`);
    for (const series of ["topic", "theme"]) {
      for (const dir of ["rising", "cooling"]) {
        const { calls, held } = record[series][dir];
        assert.ok(Number.isInteger(calls) && Number.isInteger(held) && held >= 0 && held <= calls, `${h} ${series} ${dir}`);
      }
    }
  }
});

test("the 1-year and 2-year views have no record, and say how many weeks one would need", () => {
  for (const h of LONG) {
    const { record, needed, stored } = replayRecord(h);
    assert.equal(record, null, h);
    assert.ok(needed > stored, `${h}: needs ${needed} weeks, ${stored} stored`);
  }
});

test("the replay reads each past week as that week's page would have, with no later weeks", () => {
  // The latest reading, made as of the latest week, is the page's own reading today.
  const latest = trends.everyWeek.at(-1);
  const today = trends.buildTrends("threeMonths");
  const asOf = trends.buildTrends("threeMonths", latest);
  assert.deepEqual(
    asOf.topicTrends.map((t: any) => [t.id, t.direction]),
    today.topicTrends.map((t: any) => [t.id, t.direction]),
  );
  // And the record only ever reads the weeks it needs.
  const { readings } = replayRecord("threeMonths");
  assert.equal(readings.length, READINGS_NEEDED);
  assert.deepEqual(trackRecord(readings), replayRecord("threeMonths").record);
});
