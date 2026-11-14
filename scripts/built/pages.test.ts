/**
 * Run by check.sh after `next build`. Reads the pages and the file the build wrote, so what a reader
 * gets is checked, not only the functions behind it: each topics page shows the same figures as its
 * table data, the file served is the file the tests check, and no old link into the trends page breaks.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fromSrc } from "../support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const trends = await fromSrc<any>("lib/trends");
const data = await fromSrc<any>("lib/datasets");

const APP = join(import.meta.dirname, "../../.next/server/app");
const page = (path: string) => readFileSync(join(APP, `${path === "/" ? "index" : path.slice(1)}.html`), "utf8");
/** The text a reader sees: tags dropped, entities a page commonly uses turned back into characters. */
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const ids = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test("the build wrote every topics range, the file and the reading list", () => {
  assert.ok(existsSync(APP), "run `next build` first");
  for (const h of Object.keys(trends.HORIZONS)) assert.ok(existsSync(join(APP, `${data.topicsHref(h).slice(1)}.html`)), h);
  assert.ok(existsSync(join(APP, "reading.html")));
  assert.ok(existsSync(join(APP, "data/topics.csv.body")));
});

test("the file served is the file the data tests check", () => {
  assert.equal(readFileSync(join(APP, "data/topics.csv.body"), "utf8"), data.topicsCsv());
  const meta = JSON.parse(readFileSync(join(APP, "data/topics.csv.meta"), "utf8"));
  assert.match(meta.headers["content-type"], /^text\/csv/);
});

for (const h of Object.keys(trends.HORIZONS)) {
  test(`${data.topicsHref(h)}: the page shows its table's figures, links the file and cites its range`, () => {
    const html = page(data.topicsHref(h));
    const seen = text(html);
    const table = data.topicTable(h);
    for (const row of table.rows) {
      assert.ok(ids(html).has(`topic-${row.id}`), `${row.id} has an anchor`);
      assert.ok(seen.includes(row.name), row.name);
      if (table.hasHistory) assert.ok(seen.includes(`${row.research.recent.toFixed(2)}%`), `${row.id} research share`);
    }
    assert.ok(seen.includes(table.compared), "says what is compared");
    assert.ok(html.includes(`href="${data.TOPICS_FILE.href}"`), "links the file");
    assert.ok(seen.includes(data.topicsCitation(h)), "the citation names this range");
    assert.match(seen, /every week/i, "says the file holds every week, whichever range is viewed");
  });
}

test("the trends page lists the seven datasets, and the topics row opens its page", () => {
  const html = page("/three-months");
  for (const d of data.datasetIndex("threeMonths")) {
    assert.ok(text(html).includes(d.name), d.name);
    assert.ok(html.includes(`href="${d.href}"`), `${d.id} links to ${d.href}`);
    if (d.href.startsWith("#")) assert.ok(ids(html).has(d.href.slice(1)), `${d.href} is on the trends page`);
  }
});

/** Every section anchor the trends page had before the data pages, so old links still land somewhere. */
const OLD_ANCHORS = [
  "today", "news", "momentum", "themes", "products", "indicators", "adoption", "usage", "market-share", "method",
  "reading", "analysis", "announcements", "code", "labs", "launches", "models", "papers",
];
const READING = ["reading", "analysis", "announcements", "code", "labs", "launches", "models", "papers"];

test("no old link into the trends page breaks, and the reading lists are on their own page", () => {
  const front = ids(page("/three-months"));
  for (const id of OLD_ANCHORS) assert.ok(front.has(id), `#${id} is still on the trends page`);
  assert.ok(ids(page("/")).has("today"), "#today is on the news page");
  const reading = ids(page("/reading"));
  for (const id of READING) assert.ok(reading.has(id), `#${id} is on the reading list page`);
});

test("every product row on the trends page has its own anchor", async () => {
  const { PRODUCTS } = await fromSrc<any>("lib/products");
  const front = ids(page("/three-months"));
  for (const p of PRODUCTS) assert.ok(front.has(`product-${p.id}`), `#product-${p.id}`);
});

test("the news page tags each headline with its trends, and every tag lands on its trend's row", async () => {
  const { buildToday } = await fromSrc<any>("lib/today");
  const { trendTags } = await fromSrc<any>("lib/tags");
  const html = page("/");
  const links = [...html.matchAll(/<a class="tag" href="([^"]+)"/g)].map((m) => m[1]);
  const day = buildToday();
  const shown = day.top ? [day.items[day.top.index], ...day.items.filter((_: any, n: number) => n !== day.top.index)] : day.items;
  const expected = shown.flatMap((item: any) => trendTags(item.title).map((t: any) => t.href));
  assert.deepEqual(links, expected, "one link per tag, top story first, then the rows in order");
  for (const href of new Set(links)) {
    const [path, anchor] = href.split("#");
    assert.ok(ids(page(path)).has(anchor), `${href} lands on a row`);
  }
});

test("the news page prints the why-it-matters line under the top story only, and nowhere on an ordinary day", async () => {
  const { buildToday } = await fromSrc<any>("lib/today");
  const { whyItMatters } = await fromSrc<any>("lib/why");
  const html = page("/");
  const day = buildToday();
  const line = day.top && whyItMatters(day.items[day.top.index].title);
  const shown = [...html.matchAll(/<p class="top-story__why"[\s\S]*?<\/p>/g)].map((m) => text(m[0]).trim());
  assert.equal(shown.length, line ? 1 : 0);
  if (line) {
    assert.ok(shown[0].endsWith(line), shown[0]);
    const story = html.slice(html.indexOf('<article class="top-story"'), html.indexOf("</article>"));
    assert.ok(story.includes("top-story__why"), "inside the top story");
  }
});

test("/reading leads with the week's block: its chosen items, each trend tag landing on its row, then links to every list", async () => {
  const { buildWeek } = await fromSrc<any>("lib/week");
  const html = page("/reading");
  const reading = ids(html);
  const start = html.indexOf('id="week"');
  assert.ok(start >= 0, "the block is on the page");
  assert.ok(start < html.indexOf('id="news"'), "above the lists");
  const block = html.slice(start, html.indexOf("</section>", html.indexOf('class="week__jump"')));
  const week = buildWeek();
  for (const group of week.groups) {
    if (group.tag) assert.ok(block.includes(`href="${group.tag.href}"`), group.tag.name);
    if (group.line) assert.ok(text(block).includes(group.line), `${group.tag?.name}'s line`);
    for (const item of group.items) assert.ok(text(block).includes(item.title), item.title);
  }
  assert.doesNotMatch(text(block), /Why it matters/, "the line is about the trend, and says so");
  for (const href of new Set([...block.matchAll(/<a class="tag" href="([^"]+)"/g)].map((m) => m[1]))) {
    const [path, anchor] = href.split("#");
    assert.ok(ids(page(path)).has(anchor), `${href} lands on a row`);
  }
  const jumps = [...block.slice(block.indexOf("week__jump")).matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(jumps.length >= 7, "a link to each list");
  for (const id of jumps) assert.ok(reading.has(id), `#${id} is on the page`);
  for (const id of READING.filter((id) => id !== "reading")) {
    if (reading.has(id)) assert.ok(jumps.includes(id), `#${id} has a jump link`);
  }
});

test("the MCP server ships with the daily snapshots its top story is weighed against", () => {
  // /mcp runs on request, so it reads data/snapshots/ where it is deployed, where only the files the build traced are.
  const trace = JSON.parse(readFileSync(join(APP, "mcp/route.js.nft.json"), "utf8"));
  const shipped = new Set(trace.files.map((f: string) => f.replace(/^(\.\.\/)+/, "")));
  const snapshots = readdirSync(join(import.meta.dirname, "../../data/snapshots")).filter((f) => f.endsWith(".json"));
  assert.ok(snapshots.length > 0);
  for (const f of snapshots) assert.ok(shipped.has(`data/snapshots/${f}`), `${f} is shipped with /mcp`);
});

test("the landing page is the day's news, and the tabs lead with it", () => {
  const html = page("/");
  assert.match(text(html.match(/<h1[\s\S]*?<\/h1>/)![0]).trim(), /^AI Trend Tracker$/, "the name is the heading");
  assert.match(html, /<h2 id="today-h">Today’s AI news<\/h2>/, "the list keeps its label, as a heading");
  const tabs = html.slice(html.indexOf('<nav class="tabs"'), html.indexOf("</nav>"));
  // A label's second half sits in its own span, which a phone leaves off: "Today", "Reading".
  const links = [...tabs.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => `${m[2].replace(/<[^>]+>/g, "")} ${m[1]}`);
  assert.deepEqual(links, ["Today’s news /", "Trends /three-months", "Reading list /reading", "Conferences /conferences"]);
  const short = [...tabs.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1].replace(/<span class="tabs__more">[\s\S]*?<\/span>/, "").replace(/<[^>]+>/g, ""));
  assert.deepEqual(short, ["Today", "Trends", "Reading", "Conferences"]);
});
