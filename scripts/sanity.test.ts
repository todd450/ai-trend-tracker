/** Run with `npm test`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { implausible, median, type WeeklyCounts } from "./sanity.ts";

/** Consecutive weeks at the given levels, ending the week before the one under test. */
const WEEK = "2026-03-02";
const weeksOf = (values: number[]): WeeklyCounts =>
  Object.fromEntries(
    values.map((v, i) => [
      new Date(Date.parse(WEEK) - (values.length - i) * 7 * 86_400_000).toISOString().slice(0, 10),
      v,
    ]),
  );
const steady = (level: number) => weeksOf(Array(8).fill(level));

test("median", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test("the helper builds eight distinct weeks before the test week", () => {
  const keys = Object.keys(steady(1));
  assert.equal(new Set(keys).size, 8);
  assert.ok(keys.every((k) => k < WEEK));
});

test("a total of zero is never accepted, even with no history", () => {
  assert.ok(implausible("total", {}, WEEK, 0));
});

test("a total far below or above its usual level is rejected", () => {
  assert.ok(implausible("total", steady(3500), WEEK, 1000));
  assert.ok(implausible("total", steady(3500), WEEK, 12000));
});

test("a total inside the range seen in real history is accepted", () => {
  assert.equal(implausible("total", steady(3500), WEEK, 2135), null);
  assert.equal(implausible("total", steady(3500), WEEK, 6615), null);
});

test("a large topic dropping to zero is rejected", () => {
  assert.ok(implausible("part", steady(180), WEEK, 0));
});

test("a small topic may be zero or swing widely", () => {
  assert.equal(implausible("part", steady(4), WEEK, 0), null);
  assert.equal(implausible("part", steady(4), WEEK, 30), null);
});

test("a mid-sized topic may fall to a third, as real ones have", () => {
  assert.equal(implausible("part", steady(25), WEEK, 8), null);
  assert.equal(implausible("part", steady(90), WEEK, 39), null);
});

test("a large topic collapsing or surging is rejected", () => {
  assert.ok(implausible("part", steady(180), WEEK, 12));
  assert.ok(implausible("part", steady(180), WEEK, 3500));
});

test("a recount that halves a stored week is rejected; one that grows is accepted", () => {
  const series = { ...steady(180), [WEEK]: 170 };
  assert.ok(implausible("part", series, WEEK, 60));
  assert.equal(implausible("part", series, WEEK, 185), null);
});

test("anything that is not a whole, non-negative number is rejected", () => {
  assert.ok(implausible("part", {}, WEEK, NaN));
  assert.ok(implausible("part", {}, WEEK, -1));
  assert.ok(implausible("part", {}, WEEK, 1.5));
});

test("with too little history only the absolute rules apply", () => {
  assert.equal(implausible("part", weeksOf([200, 200]), WEEK, 0), null);
  assert.equal(implausible("total", weeksOf([200, 200]), WEEK, 5), null);
});

test("every figure already in data/history.json passes its own check", () => {
  const history = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "data", "history.json"), "utf8"));
  const failures: string[] = [];
  const check = (name: string, kind: "total" | "part", series: WeeklyCounts) => {
    const weeks = Object.keys(series).sort();
    weeks.forEach((week) => {
      const before = Object.fromEntries(weeks.filter((w) => w < week).map((w) => [w, series[w]]));
      const why = implausible(kind, before, week, series[week]);
      if (why) failures.push(`${name} ${week}: ${why}`);
    });
  };
  check("arxivTotal", "total", history.arxivTotal);
  check("hnAiTotal", "total", history.hnAiTotal ?? {});
  for (const [id, t] of Object.entries<{ arxiv: WeeklyCounts; hn: WeeklyCounts }>(history.topics)) {
    check(`arxiv ${id}`, "part", t.arxiv ?? {});
    check(`hn ${id}`, "part", t.hn ?? {});
  }
  for (const [id, s] of Object.entries<WeeklyCounts>(history.themes ?? {})) check(`theme ${id}`, "part", s);
  for (const [id, s] of Object.entries<WeeklyCounts>(history.subthemes ?? {})) check(`subtheme ${id}`, "part", s);
  assert.deepEqual(failures, []);
});

test("page views may surge without limit but not collapse", () => {
  assert.equal(implausible("views", steady(7000), WEEK, 400_000), null);
  assert.equal(implausible("views", steady(7000), WEEK, 3000), null);
  assert.ok(implausible("views", steady(7000), WEEK, 700)); // what a renamed article looks like
  assert.ok(implausible("views", steady(7000), WEEK, 0));
  assert.equal(implausible("views", steady(10), WEEK, 0), null);
});
