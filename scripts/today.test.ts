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
      assert.deepEqual(Object.keys(item).filter((k) => !EXISTING.includes(k) && k !== "topStory" && k !== "tags"), [], "no other new field");
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

const tags = await fromSrc<any>("lib/tags");
const SITE = (await fromSrc<any>("lib/site")).SITE_URL;

for (const date of DAYS) {
  test(`MCP get_latest on ${date}: a story's trend tags are its headline's, and left out when it has none`, () => {
    const day = replay(date);
    const items = tools.todayItems(day, 20);
    items.forEach((item: any, n: number) => {
      const expected = tags.trendTags(day.items[n].title);
      if (expected.length === 0) assert.ok(!("tags" in item), `${item.title}: no empty list`);
      else
        assert.deepEqual(
          item.tags,
          expected.map((t: any) => ({ kind: t.kind, id: t.id, name: t.name, page: SITE + t.href })),
          item.title,
        );
    });
  });
}

test("13 Nov 2026: the outage rows are tagged with the products the collector counts them under", () => {
  const items = tools.todayItems(replay("2026-11-13"), 20);
  const row = items.find((item: any) => /^Elevated errors on claude\.ai/.test(item.title));
  assert.deepEqual(row.tags.map((t: any) => t.id), ["claude-code", "coding"]);
  const top = items.find((item: any) => item.topStory);
  assert.ok(top.tags.some((t: any) => t.id === "gemini"), "the top story is tagged too");
});

/** A day built from the 13 Nov snapshot with only these lab posts and Hacker News stories in it. */
const FROM = "2026-11-13T10:00:00.000Z";
const dayWith = (labNews: { source: string; title: string; url: string }[], stories: { title: string; url: string; points: number }[]) =>
  today.buildToday(
    {
      ...snapshot("2026-11-13"),
      labNews: labNews.map((post) => ({ ...post, publishedAt: FROM })),
      analysis: [],
      today: stories.map((s, n) => ({ ...s, id: String(n), discussionUrl: `https://news.ycombinator.com/item?id=${n}`, comments: 1, createdAt: FROM })),
    },
    unpinned,
  );
const HYDROGEN = { source: "Google DeepMind", title: "Introducing Gemini 4 Hydrogen", url: "https://deepmind.google/blog/gemini-4-hydrogen/" };

/** The kicker's claim of origin must match the link it labels, on the page and in MCP. */
function assertSlotMatchesItsClaim(day: any) {
  if (!day.top) return;
  const slot = day.items[day.top.index];
  const [mcp] = tools.todayItems(day, 20).filter((item: any) => "topStory" in item);
  assert.equal(mcp.url, slot.url, "MCP flags the story the page sets large");
  if (day.top.rule === "lab") {
    assert.equal(slot.lab, true, `a lab launch's headline is the lab's own post, not ${slot.url}`);
    assert.ok(mcp.topStory.reason.startsWith(slot.from), "and the kicker names the lab that posted it");
  }
}

test("stories elsewhere that borrow a lab post's words do not make it a lab launch", () => {
  const day = dayWith(
    [HYDROGEN],
    [
      { title: "Gemini 4 Hydrogen login required: claim early access", url: "https://attacker.example/claim", points: 40 },
      { title: "Gemini 4 Hydrogen early access tips", url: "https://attacker.example/tips", points: 25 },
    ],
  );
  assert.notEqual(day.top?.rule, "lab");
  for (const item of tools.todayItems(day, 20)) assert.ok(!/own announcement/.test(item.topStory?.reason ?? ""), item.url);
  assertSlotMatchesItsClaim(day);
});

test("a lab launch led on the list by another post is set large under the lab's own post", () => {
  const day = dayWith(
    [HYDROGEN],
    [
      { title: "Gemini 4 Hydrogen early access", url: "https://attacker.example/claim", points: 90 },
      { title: "Gemini 4 Hydrogen and Orchestrator", url: "https://antigravity.google/blog/hydrogen", points: 40 },
      { title: "Gemini 4 Hydrogen model card", url: "https://deepmind.google/models/gemini-4-hydrogen/", points: 25 },
    ],
  );
  assert.equal(day.top?.rule, "lab");
  const slot = day.items[day.top.index];
  assert.equal(slot.url, HYDROGEN.url);
  assert.equal([slot, ...slot.also].length, 4, "every post stays in the group");
  assertSlotMatchesItsClaim(day);
});

for (const date of DAYS) {
  test(`${date}: the top slot's headline matches its kicker`, () => assertSlotMatchesItsClaim(replay(date)));
}

test("the day's own snapshot is not one of its past days", () => {
  assert.ok(!today.pastLeads("2026-11-13").includes(551), "13 Nov's own lead is not compared with itself");
});
