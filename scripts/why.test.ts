/**
 * Run with `npm test`. The "why it matters" line under Today's top story is written by a fixed
 * rule from the tracker's own figures: the first tag's trend in history.json, read the way the
 * trend's own row on the site reads it, with the time range named and the site's own call.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { trendLine } = await fromSrc<any>("lib/sentences");
const why = await fromSrc<any>("lib/why");
const { trendTags } = await fromSrc<any>("lib/tags");
const { PRODUCTS } = await fromSrc<any>("lib/products");
const { TOPICS } = await fromSrc<any>("lib/topics");
const trends = await fromSrc<any>("lib/trends");
const { topicTable } = await fromSrc<any>("lib/datasets");

const CALLS = ["rising", "steady", "cooling", "too few to call", "too noisy to call"];
const reading = (call: string, recent = 12, prior = 8) => ({ name: "Gemini", call, recent, prior });
const THREE_MONTHS = { when: "over three months", window: 4 };

test("the line says the site's own call, word for word, for every call there is", () => {
  for (const call of CALLS) {
    const line = trendLine(reading(call), THREE_MONTHS);
    assert.ok(line.includes(call), `${call}: ${line}`);
    for (const other of CALLS.filter((c) => c !== call && !call.includes(c) && !c.includes(call))) {
      assert.ok(!line.includes(other), `${call} does not also say ${other}`);
    }
  }
});

test("the line names its time range and both periods it compares", () => {
  const line = trendLine(reading("rising"), THREE_MONTHS);
  assert.match(line, /over three months/);
  assert.match(line, /last 4 weeks/);
  assert.match(line, /4 weeks before/);
  const week = trendLine(reading("rising"), { when: "this week", window: 1 });
  assert.match(week, /this week/);
  assert.doesNotMatch(week, /\b1 weeks\b/, "no '1 weeks'");
});

test("the line names the trend and gives both figures it is called on", () => {
  const line = trendLine(reading("cooling", 3.25, 7), THREE_MONTHS);
  assert.match(line, /^Gemini\b/);
  assert.match(line, /Hacker News/, "says where the count is from");
  assert.match(line, /3\.3\b/);
  assert.match(line, /\b7\.0\b/);
  // Large counts are whole numbers, as the topics table prints them.
  assert.match(trendLine(reading("rising", 41.4, 30.2), THREE_MONTHS), /\b41\b.*\b30\b/);
});

test("the line is one sentence", () => {
  for (const call of CALLS) {
    const line = trendLine(reading(call, 0, 0), THREE_MONTHS);
    assert.match(line, /^[^.]*(\d\.\d[^.]*)*\.$/, line);
    assert.doesNotMatch(line, /NaN|undefined|Infinity/);
  }
});

// ------------------------------------------------------------ from the tracker's figures

const three = trends.buildTrends("threeMonths");
const topicRows = topicTable("threeMonths").rows;

/** The call the trend's row on the site shows for its Hacker News discussion over three months. */
function rowCall(kind: string, id: string) {
  if (kind === "topic") return topicRows.find((r: any) => r.id === id).discussion;
  const p = three.productTrends.find((t: any) => t.id === id);
  const call = !p.enough
    ? "too few to call"
    : trends.heldBack(p.stories, trends.THEME_STEADY_BAND)
      ? "too noisy to call"
      : trends.signalDirection(p.stories, trends.THEME_STEADY_BAND);
  return { call, recent: p.stories.recent, prior: p.stories.prior };
}

test("every tracked product and topic gets a line with the call its own row shows", () => {
  for (const [kind, list] of [["product", PRODUCTS], ["topic", TOPICS]] as const) {
    for (const trend of list) {
      const title = `News about ${trend.hn[0]} today`;
      const [tag] = trendTags(title);
      if (tag.id !== trend.id) continue; // a product named by the same words comes first
      const line = why.whyItMatters(title);
      const row = rowCall(kind, trend.id);
      assert.ok(CALLS.includes(row.call), `${trend.id}: ${row.call}`);
      assert.equal(line, trendLine({ name: trend.name, ...row }, THREE_MONTHS), trend.id);
    }
  }
});

test("a product with too few stories to call is said to be too few to call", () => {
  const few = three.productTrends.find((p: any) => !p.enough);
  if (!few) return; // every product has enough stories in today's data
  const product = PRODUCTS.find((p: any) => p.id === few.id);
  const line = why.whyItMatters(`News about ${product.hn[0]}`);
  assert.match(line, /too few to call/);
});

test("only the first tag is read", () => {
  const title = "Claude Code ships new AI agents";
  const tags = trendTags(title);
  assert.ok(tags.length === 2, "the headline has two tags");
  const line = why.whyItMatters(title);
  assert.ok(line.startsWith(tags[0].name), line);
  assert.ok(!line.includes(tags[1].name), "the second is not");
});

test("a headline with no tag has no line", () => {
  assert.equal(why.whyItMatters("A quiet day at the office"), undefined);
});

// ------------------------------------------------------------ MCP get_latest

const today = await fromSrc<any>("lib/today");
const tools = await fromSrc<any>("lib/mcp/tools");
const snapshot = (day: string) => JSON.parse(readFileSync(new URL(`../data/snapshots/${day}.json`, import.meta.url), "utf8"));
const unpinned = { ...today.editorial, pin: [] };

for (const date of ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) {
  test(`MCP get_latest on ${date}: only the top story carries whyItMatters, and it is the page's line`, () => {
    const day = today.buildToday(snapshot(date), unpinned);
    tools.todayItems(day, 20).forEach((item: any, n: number) => {
      const expected = day.top?.index === n ? why.whyItMatters(day.items[n].title) : undefined;
      if (expected === undefined) assert.ok(!("whyItMatters" in item), `${item.title}: left out, not empty`);
      else assert.equal(item.whyItMatters, expected);
    });
  });
}

test("MCP get_latest on 13 Nov 2026: the Gemini launch carries its line", () => {
  const items = tools.todayItems(today.buildToday(snapshot("2026-11-13"), unpinned), 20);
  const top = items.find((item: any) => item.topStory);
  assert.match(top.whyItMatters, /^Gemini on Hacker News over three months/);
});

test("a pinned top story keeps the editor's note beside its line", () => {
  const day = today.buildToday(snapshot("2026-11-13"), {
    ...unpinned,
    pin: [{ url: "https://deepmind.google/blog/introducing-gemini-4-hydrogen/", until: "2099-01-01", note: "The editor's note." }],
  });
  const [top] = tools.todayItems(day, 20);
  assert.equal(top.topStory.rule, "pinned");
  assert.equal(top.pinnedByEditor, "The editor's note.");
  assert.ok(top.whyItMatters.length > 0);
});
