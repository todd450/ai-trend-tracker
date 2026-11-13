/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAKERS_NAMED, OTHER_MAKERS, weeklyMakerTokens, type RankingRow } from "./marketShare.ts";

/** 2026-11-02 is a Monday. */
const MONDAY = "2026-11-02";
const day = (offset: number) => new Date(Date.parse(MONDAY) + offset * 86_400_000).toISOString().slice(0, 10);
const row = (date: string, model: string, tokens: number): RankingRow => ({
  date,
  model_permaslug: model,
  total_tokens: String(tokens),
});
const fullWeek = (start: number, models: [string, number][]) =>
  Array.from({ length: 7 }, (_, i) => models.map(([model, tokens]) => row(day(start + i), model, tokens))).flat();

test("sums a maker's models and variants over the week", () => {
  const weeks = weeklyMakerTokens(
    fullWeek(0, [
      ["openai/gpt-a", 10],
      ["openai/gpt-a:free", 5],
      ["anthropic/claude-b", 20],
      ["other", 3],
    ]),
  );
  assert.deepEqual(weeks, [{ week: MONDAY, tokens: { anthropic: 140, openai: 105, [OTHER_MAKERS]: 21 } }]);
});

test("leaves out a week with a day missing", () => {
  const rows = [...fullWeek(-7, [["openai/gpt-a", 1]]), ...fullWeek(0, [["openai/gpt-a", 1]]).slice(0, 6)];
  assert.deepEqual(
    weeklyMakerTokens(rows).map((w) => w.week),
    [day(-7)],
  );
});

test("names the nine largest makers and folds the rest into Others", () => {
  const models = Array.from({ length: 12 }, (_, i): [string, number] => [`maker${String(i).padStart(2, "0")}/m`, 100 - i]);
  const [week] = weeklyMakerTokens(fullWeek(0, [...models, ["other", 1]]));
  const named = Object.keys(week.tokens).filter((maker) => maker !== OTHER_MAKERS);
  assert.equal(named.length, MAKERS_NAMED);
  assert.ok(named.includes("maker08") && !named.includes("maker09"));
  assert.equal(week.tokens[OTHER_MAKERS], 7 * (91 + 90 + 89 + 1));
});

test("skips rows it cannot read", () => {
  const rows: RankingRow[] = [
    ...fullWeek(0, [["openai/gpt-a", 1]]),
    { date: "2026-13-40x", model_permaslug: "openai/gpt-a", total_tokens: "9" },
    { date: day(0), model_permaslug: "openai/gpt-a", total_tokens: "many" },
    { date: day(0), total_tokens: "9" },
  ];
  assert.deepEqual(weeklyMakerTokens(rows), [{ week: MONDAY, tokens: { openai: 7 } }]);
});
