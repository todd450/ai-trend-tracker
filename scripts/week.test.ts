/**
 * Run with `npm test`. The "This week" block at the top of the reading list: up to seven of the
 * past seven days' items, chosen by fixed rules (a trend tag is needed, lab launches and the
 * editor's pins always qualify), grouped under the trend they feed, at most two to a group.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const week = await fromSrc<any>("lib/week");
const { trendTags } = await fromSrc<any>("lib/tags");
const { isLabLaunch } = await fromSrc<any>("lib/editorial");

const NOW = "2026-11-14T12:00:00.000Z";
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString();
const none = { pin: [], hide: [] };

let n = 0;
const story = (title: string, points: number, days = 1, url = `https://example.org/${++n}`) => ({
  id: String(++n),
  title,
  url,
  discussionUrl: `https://news.ycombinator.com/item?id=${n}`,
  points,
  comments: 10,
  createdAt: ago(days),
});
const post = (source: string, title: string, url: string, days = 1) => ({ source, title, url, publishedAt: ago(days) });
const data = (parts: Record<string, unknown>) => ({
  generatedAt: NOW,
  sources: {},
  papers: [],
  models: [],
  releases: [],
  stories: [],
  launches: [],
  repos: [],
  analysis: [],
  labNews: [],
  ...parts,
});

/** Every trend reads steady unless a test says otherwise, so a test controls the order of groups. */
const calls =
  (byName: Record<string, string> = {}) =>
  (tag: { name: string }) => ({ name: tag.name, call: byName[tag.name] ?? "steady", recent: 10, prior: 10 });

const items = (w: any) => w.groups.flatMap((g: any) => g.items);
const titles = (w: any) => items(w).map((i: any) => i.title);

// Headlines that the site's own tagging rule tags, one trend each.
const CLAUDE_CODE = (s: string) => `Claude Code ${s}`;
const GEMINI = (s: string) => `Gemini ${s}`;
const AGENTS = (s: string) => `AI agents ${s}`;
const OPENAI_CHATGPT = (s: string) => `ChatGPT ${s}`;
const DEEPSEEK = (s: string) => `DeepSeek ${s}`;

test("the fixture headlines carry the tag the test means", () => {
  assert.equal(trendTags(CLAUDE_CODE("x"))[0].name, "Claude Code");
  assert.equal(trendTags(GEMINI("x"))[0].name, "Gemini");
  assert.equal(trendTags(AGENTS("x"))[0].name, "AI agents");
  assert.equal(trendTags(OPENAI_CHATGPT("x"))[0].name, "ChatGPT");
  assert.equal(trendTags(DEEPSEEK("x"))[0].name, "DeepSeek");
  assert.deepEqual(trendTags("Anthropic IPO"), []);
});

test("one stated window: the seven days to the collection, and nothing from outside it", () => {
  const w = week.buildWeek(
    data({
      stories: [story(GEMINI("this week"), 500, 2), story(GEMINI("last week"), 900, 8), story(GEMINI("future"), 900, -1)],
      labNews: [post("OpenAI", OPENAI_CHATGPT("old post"), "https://openai.com/old", 10)],
    }),
    none,
    calls(),
  );
  assert.equal(w.until, NOW);
  assert.equal(Date.parse(w.until) - Date.parse(w.since), 7 * DAY);
  assert.deepEqual(titles(w), [GEMINI("this week")]);
  for (const item of items(w)) {
    const t = Date.parse(item.publishedAt);
    assert.ok(t >= Date.parse(w.since) && t <= Date.parse(w.until), item.title);
  }
});

test("an item that names no tracked trend is left out of the block", () => {
  const w = week.buildWeek(data({ stories: [story("Anthropic IPO", 996), story(AGENTS("found a site"), 500)] }), none, calls());
  assert.deepEqual(titles(w), [AGENTS("found a site")]);
});

test("items are grouped under their first trend tag, and each group's items carry that tag", () => {
  const w = week.buildWeek(
    data({
      stories: [story(GEMINI("one"), 900), story(AGENTS("one"), 800), story(GEMINI("two"), 700), story(AGENTS("two"), 600)],
    }),
    none,
    calls(),
  );
  assert.equal(w.groups.length, 2);
  for (const g of w.groups) {
    for (const item of g.items) {
      const tags = [item, ...item.also].flatMap((p: any) => trendTags(p.title).map((t: any) => t.id));
      assert.ok(tags.includes(g.tag.id), `${item.title} is under ${g.tag.name}`);
    }
  }
  const names = w.groups.map((g: any) => g.tag.name);
  assert.equal(new Set(names).size, names.length, "one group per trend");
});

test("at most two items to a group and seven in all", () => {
  const many = [GEMINI, AGENTS, CLAUDE_CODE, OPENAI_CHATGPT, DEEPSEEK].flatMap((t, i) =>
    [1, 2, 3].map((k) => story(t(`story ${k}`), 1000 - i * 10 - k)),
  );
  const w = week.buildWeek(data({ stories: many }), none, calls());
  for (const g of w.groups) assert.ok(g.items.length <= 2, `${g.tag.name}: ${g.items.length}`);
  assert.equal(items(w).length, week.MAX_ITEMS);
  assert.equal(week.MAX_ITEMS, 7);
});

test("groups go by their biggest story on Hacker News, whatever the trend's call: a small rising story does not lead", () => {
  const w = week.buildWeek(
    data({
      stories: [story(GEMINI("steady but big"), 900), story(AGENTS("cooling"), 950), story(CLAUDE_CODE("rising"), 100), story(DEEPSEEK("steady"), 400)],
    }),
    none,
    calls({ "Claude Code": "rising", "AI agents": "cooling" }),
  );
  assert.deepEqual(
    w.groups.map((g: any) => g.tag.name),
    ["AI agents", "Gemini", "DeepSeek", "Claude Code"],
  );
});

test("within a group the biggest story on Hacker News comes first, then posts nobody discussed, newest first", () => {
  const w = week.buildWeek(
    data({
      stories: [story(GEMINI("small"), 100, 1), story(GEMINI("big"), 900, 3)],
      labNews: [post("Google DeepMind", GEMINI("blog post"), "https://deepmind.google/a", 0)],
    }),
    none,
    calls(),
  );
  assert.deepEqual(titles(w), [GEMINI("big"), GEMINI("small")]);
});

// A frontier lab's own post, discussed twice on Hacker News, as Gemini 4 Hydrogen was on 12 Nov 2026.
const launchData = (extra: object[] = []) =>
  data({
    labNews: [post("Google DeepMind", "Introducing Gemini 4 Hydrogen", "https://deepmind.google/blog/introducing-gemini-4-hydrogen/", 2)],
    stories: [
      ...extra,
      story("Gemini 4 Hydrogen", 565, 2, "https://blog.google/gemini-models/introducing-gemini-4-hydrogen/"),
      story("Gemini 4 Hydrogen and Orchestrator", 501, 2, "https://antigravity.google/blog/gemini-4-hydrogen"),
    ],
  });

test("a frontier lab's launch always makes the block, first, led by the lab's own post, its other posts under it", () => {
  const crowd = [GEMINI, AGENTS, CLAUDE_CODE, OPENAI_CHATGPT, DEEPSEEK].flatMap((t, i) =>
    [1, 2].map((k) => story(t(`rising ${k}`), 2000 - i * 10 - k)),
  );
  const w = week.buildWeek(launchData(crowd), none, calls({ "AI agents": "rising", "Claude Code": "rising", ChatGPT: "rising", DeepSeek: "rising" }));
  const first = w.groups[0];
  assert.equal(first.tag.name, "Gemini");
  const lead = first.items[0];
  assert.equal(lead.title, "Introducing Gemini 4 Hydrogen");
  assert.equal(lead.from, "Google DeepMind");
  assert.ok(lead.launch, "marked as a lab launch");
  assert.ok(isLabLaunch(lead));
  assert.ok(lead.also.some((p: any) => p.title === "Gemini 4 Hydrogen and Orchestrator"), "the other post is under it");
  assert.equal(titles(w).filter((t: string) => /Hydrogen/.test(t)).length, 1, "the event is listed once");
  assert.ok(items(w).length <= week.MAX_ITEMS);
});

test("a lab post with one Hacker News story is not a launch", () => {
  const w = week.buildWeek(
    data({
      labNews: [post("Google DeepMind", "Introducing Gemini 4 Hydrogen", "https://deepmind.google/blog/h/", 2)],
      stories: [story("Gemini 4 Hydrogen", 565, 2, "https://deepmind.google/blog/h/")],
    }),
    none,
    calls(),
  );
  assert.ok(!items(w).some((i: any) => i.launch));
});

test("one event posted to two lists, or twice to one, is listed once", () => {
  const url = "https://github.com/x/coding-agent";
  const w = week.buildWeek(
    data({
      stories: [story(CLAUDE_CODE("plugin for the terminal"), 442, 1, url)],
      launches: [{ ...story(CLAUDE_CODE("plugin for the terminal"), 442, 1, url), kind: "Show HN" }],
    }),
    none,
    calls(),
  );
  assert.equal(items(w).length, 1);
});

test("the editor's hide keeps a link out of the block", () => {
  const hidden = story(GEMINI("leaked files"), 900);
  const w = week.buildWeek(data({ stories: [hidden, story(GEMINI("other"), 100)] }), { pin: [], hide: [{ url: hidden.url, reason: "x" }] }, calls());
  assert.ok(!titles(w).includes(hidden.title));
});

test("the editor's pin puts a post at the top of the block with its note, even with no trend tag, until its last day", () => {
  const pinned = story("Anthropic IPO", 996);
  const pin = (until: string) => ({ pin: [{ url: pinned.url, title: pinned.title, from: "ipo.anthropic.com", until, note: "Read the filing." }], hide: [] });
  const w = week.buildWeek(data({ stories: [story(GEMINI("big"), 1200), pinned] }), pin("2026-11-14"), calls({ Gemini: "rising" }));
  const top = w.groups[0].items[0];
  assert.equal(top.title, "Anthropic IPO");
  assert.equal(top.pinned?.note, "Read the filing.");
  assert.equal(w.groups[0].tag, undefined, "no trend to name");
  const lapsed = week.buildWeek(data({ stories: [story(GEMINI("big"), 1200), pinned] }), pin("2026-11-13"), calls());
  assert.ok(!titles(lapsed).includes("Anthropic IPO"));
});

test("each group carries its trend's call and the line read from the tracker's figures", () => {
  const w = week.buildWeek(data({ stories: [story(GEMINI("one"), 900)] }), none, calls({ Gemini: "rising" }));
  const g = w.groups[0];
  assert.equal(g.call, "rising");
  assert.match(g.line, /^Gemini on Hacker News/);
  assert.match(g.line, /rising/);
});

test("the biggest stories left out for want of a tag are named, the biggest first", () => {
  const w = week.buildWeek(
    data({ stories: [story(AGENTS("one"), 1035), story("Anthropic IPO", 996), story("Nvidia scarcity", 747), story(AGENTS("two"), 677), story("Small thing", 50)] }),
    none,
    calls(),
  );
  assert.deepEqual(
    w.leftOut.map((i: any) => i.title),
    ["Anthropic IPO", "Nvidia scarcity"],
    "only those bigger than the smallest story the block holds",
  );
  assert.equal(w.leftOut[0].list, "news", "says which list below holds it");
});

test("an empty week has no groups and nothing left out", () => {
  const w = week.buildWeek(data({}), none, calls());
  assert.deepEqual(w.groups, []);
  assert.deepEqual(w.leftOut, []);
});

test("data written before the launches list existed still builds", () => {
  const old = data({ stories: [story(GEMINI("one"), 900)] });
  delete (old as any).launches;
  delete (old as any).analysis;
  assert.equal(items(week.buildWeek(old, none, calls())).length, 1);
});

// ------------------------------------------------------------ the daily snapshots

const SNAPSHOTS = new URL("../data/snapshots/", import.meta.url);
const days = readdirSync(SNAPSHOTS).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
const snapshot = (f: string) => JSON.parse(readFileSync(new URL(f, SNAPSHOTS), "utf8"));
const unpinned = { ...week.editorial, pin: [] };

for (const f of days) {
  test(`${f.slice(0, 10)}: the block holds five or more items, each with its trend line, within the caps`, () => {
    const w = week.buildWeek(snapshot(f), unpinned);
    assert.ok(items(w).length >= 5, `${items(w).length} items`);
    assert.ok(items(w).length <= week.MAX_ITEMS);
    for (const g of w.groups) {
      assert.ok(g.tag, "every group names its trend");
      assert.ok(g.line, `${g.tag.name} has a line`);
      assert.ok(g.items.length <= 2);
    }
  });
}

test("13 and 14 Nov 2026: Gemini 4 Hydrogen is in the block, first, as a lab launch", () => {
  for (const f of ["2026-11-13.json", "2026-11-14.json"]) {
    const w = week.buildWeek(snapshot(f), unpinned);
    const lead = w.groups[0].items[0];
    assert.match(lead.title, /Gemini 4 Hydrogen/, f);
    assert.ok(lead.launch, f);
    assert.ok(lead.lab, `${f}: led by the lab's own post`);
  }
});
