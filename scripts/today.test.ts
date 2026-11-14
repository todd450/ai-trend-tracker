/**
 * Run with `npm test`. Replays the daily snapshots in data/snapshots through `buildToday()`, the
 * way the page builds its list, to check which story the top slot goes to on real days.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const today = await fromSrc<any>("lib/today");

const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
const snapshot = (day: string) => JSON.parse(readFileSync(new URL(`../data/snapshots/${day}.json`, import.meta.url), "utf8"));
// The editor's hides stay; pins are left out, since a pin added later would otherwise reach back into these days.
const unpinned = { ...today.editorial, pin: [] };
const replay = (day: string) => today.buildToday(snapshot(day), unpinned);

test("13 Nov 2026: Gemini 4 Hydrogen takes the top slot, as a lab launch", () => {
  const day = replay("2026-11-13");
  assert.ok(day.top, "the slot is filled");
  const story = day.items[day.top.index];
  const group = [story, ...story.also];
  assert.ok(group.some((post: any) => /Gemini 4 Hydrogen/.test(post.title) && post.lab), "the DeepMind post is in the group");
  assert.equal(day.top.rule, "lab");
});

test("the top slot does not fill on every day", () => {
  const filled = DAYS.filter((day) => replay(day).top);
  assert.ok(filled.length < DAYS.length, `filled on ${filled.join(", ")}`);
});

test("past days' leads come from earlier snapshots only, at most a week of them", () => {
  assert.deepEqual(today.pastLeads("2026-11-10"), []);
  // Each is the most upvoted story on its own day's list, measured when that list was collected.
  const leads = DAYS.slice(0, 3).map((day) => Math.max(...replay(day).items.map((i: any) => i.discussion?.points ?? 0)));
  assert.deepEqual(today.pastLeads("2026-11-13"), leads);
  assert.ok(today.pastLeads("2027-01-01").length <= 7);
});

const tools = await fromSrc<any>("lib/mcp/tools");
const EXISTING = ["title", "url", "from", "publishedAt", "hackerNews", "sameEvent", "pinnedByEditor"];

test("MCP get_latest answers with today's list, as the page builds it", () => {
  const tool = tools.TOOLS.find((t: any) => t.name === "get_latest");
  const { items } = tool.run({ list: "today", limit: 20 });
  assert.deepEqual(items, tools.todayItems(today.buildToday(), 20));
});

for (const date of DAYS) {
  test(`MCP get_latest on ${date}: every field it had is kept, and only the top story is flagged`, () => {
    const day = replay(date);
    const items = tools.todayItems(day, 20);
    for (const item of items) {
      for (const key of EXISTING) assert.ok(key in item, `${key} is still there`);
      assert.deepEqual(Object.keys(item).filter((k) => !EXISTING.includes(k) && k !== "topStory"), [], "no other new field");
    }
    // The field is optional: it is left out, not set to false, on every other story.
    const flagged = items.filter((item: any) => "topStory" in item);
    if (day.top) {
      assert.equal(flagged.length, 1);
      assert.equal(flagged[0].url, day.items[day.top.index].url);
      assert.equal(flagged[0].topStory.rule, day.top.rule);
      assert.ok(flagged[0].topStory.reason.length > 0, "says why in words");
    } else assert.equal(flagged.length, 0);
  });
}

test("the day's own snapshot is not one of its past days", () => {
  assert.ok(!today.pastLeads("2026-11-13").includes(551), "13 Nov's own lead is not compared with itself");
});
