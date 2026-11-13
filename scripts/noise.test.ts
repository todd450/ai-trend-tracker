/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_WEEKS_FOR_NOISE, NOISE_MULTIPLE, standsClear, weeklyNoise } from "../src/lib/noise.ts";

/** A series that alternates `swing` above and below `level`: its week-to-week step is always 2 × swing. */
const wobbling = (level: number, swing: number, weeks = 20) =>
  Array.from({ length: weeks }, (_, i) => level + (i % 2 ? swing : -swing));

test("a series too short to measure has no noise estimate, and any change is let through", () => {
  assert.equal(weeklyNoise(Array(MIN_WEEKS_FOR_NOISE - 1).fill(5)), null);
  assert.equal(standsClear(0.1, null, 4), true);
});

test("noise follows the size of the week-to-week step", () => {
  const small = weeklyNoise(wobbling(10, 1))!;
  const large = weeklyNoise(wobbling(10, 3))!;
  assert.ok(small > 0);
  assert.ok(Math.abs(large / small - 3) < 1e-9);
});

test("a steady climb is not mistaken for noise", () => {
  const climb = Array.from({ length: 20 }, (_, i) => 10 + i);
  const jumpy = wobbling(10, 5);
  assert.ok(weeklyNoise(climb)! < weeklyNoise(jumpy)!);
});

test("one freak week does not set the level", () => {
  const calm = wobbling(10, 1);
  const spiked = [...calm];
  spiked[10] = 500;
  assert.equal(weeklyNoise(spiked), weeklyNoise(calm));
});

test("a change must be the given multiple of what wobble alone would produce", () => {
  const noise = 1;
  const expected = noise * Math.sqrt(2 / 4);
  assert.equal(standsClear(NOISE_MULTIPLE * expected * 1.01, noise, 4), true);
  assert.equal(standsClear(NOISE_MULTIPLE * expected * 0.99, noise, 4), false);
  assert.equal(standsClear(-NOISE_MULTIPLE * expected * 1.01, noise, 4), true);
});

test("longer windows average the wobble away, so a smaller change stands clear", () => {
  assert.equal(standsClear(1, 1, 1), false);
  assert.equal(standsClear(1, 1, 26), true);
});

test("no change is never a clear change, even in a perfectly flat series", () => {
  assert.equal(standsClear(0, 0, 4), false);
  assert.equal(standsClear(0.5, 0, 4), true);
});
