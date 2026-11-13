/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compare, directionOf, fmtChange, fmtWeek, heldBack, signalDirection, type Signal } from "../src/lib/calls.ts";

const signal = (change: number | null, clear?: boolean): Signal => ({ values: [], recent: 0, prior: 0, change, clear });

test("a change is called on the whole percent the page prints", () => {
  assert.equal(directionOf(0.1, 0.1), "rising");
  assert.equal(directionOf(-0.1, 0.1), "cooling");
  // 9.6% prints as 10%, so it is called; 9.4% prints as 9%, so it is not.
  assert.equal(directionOf(0.096, 0.1), "rising");
  assert.equal(directionOf(0.094, 0.1), "steady");
  assert.equal(directionOf(-0.094, 0.1), "steady");
});

test("no base to compare with is never a rise or a fall", () => {
  assert.equal(directionOf(null, 0.1), "steady");
  assert.equal(fmtChange(null), "new");
});

test("a wider band needs a bigger move", () => {
  assert.equal(directionOf(0.12, 0.1), "rising");
  assert.equal(directionOf(0.12, 0.15), "steady");
});

test("a change inside the series' own wobble is steady however large, and is marked as held back", () => {
  assert.equal(signalDirection(signal(0.54, false), 0.1), "steady");
  assert.equal(heldBack(signal(0.54, false), 0.1), true);
  assert.equal(signalDirection(signal(0.54, true), 0.1), "rising");
  assert.equal(heldBack(signal(0.54, true), 0.1), false);
});

test("a small change is not 'held back': there was nothing to call", () => {
  assert.equal(heldBack(signal(0.03, false), 0.1), false);
});

test("a series with no wobble test is judged by the fixed rule alone", () => {
  assert.equal(signalDirection(signal(-0.2), 0.1), "cooling");
  assert.equal(heldBack(signal(-0.2), 0.1), false);
});

test("changes print with a sign, and tiny ones as flat", () => {
  assert.equal(fmtChange(0.131), "+13%");
  assert.equal(fmtChange(-0.4), "−40%");
  assert.equal(fmtChange(0.004), "flat");
  assert.equal(fmtChange(-0.004), "flat");
  assert.equal(fmtChange(1.6), "+160%");
});

test("compare charts the last weeks and sets the latest window against the one before", () => {
  const s = compare([1, 1, 1, 1, 2, 2, 4, 4], 4, 2);
  assert.deepEqual(s.values, [2, 2, 4, 4]);
  assert.equal(s.prior, 2);
  assert.equal(s.recent, 4);
  assert.equal(s.change, 1);
});

test("compare gives no change when the earlier window is empty or zero", () => {
  assert.equal(compare([0, 0, 3, 3], 4, 2).change, null);
  assert.equal(compare([5], 4, 2).change, null);
});

test("compare measures wobble over the whole series, not only the weeks charted", () => {
  // Twenty calm weeks, then a step up: the step is far outside the wobble.
  const calm = Array.from({ length: 20 }, (_, i) => 10 + (i % 2 ? 0.1 : -0.1));
  assert.equal(compare([...calm, 20, 20, 20, 20], 8, 4).clear, true);
  // A series that swings by 8 every week: a 2-point difference between windows is nothing.
  const jumpy = Array.from({ length: 24 }, (_, i) => 10 + (i % 2 ? 4 : -4));
  const s = compare([...jumpy.slice(0, 20), 11, 12, 13, 12], 8, 4);
  assert.equal(s.clear, false);
});

test("a week is named by its Monday and Sunday", () => {
  assert.equal(fmtWeek("2026-11-02"), "2–8 November 2026");
  assert.equal(fmtWeek("2026-11-30"), "30 November – 6 December 2026");
  assert.equal(fmtWeek("2026-12-28"), "28 December – 3 January 2027");
});
