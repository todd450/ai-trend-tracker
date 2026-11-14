/**
 * Run by check.sh after `next build`. Reads the pages and the file the build wrote, so what a reader
 * gets is checked, not only the functions behind it: each topics page shows the same figures as its
 * table data, the file served is the file the tests check, and no old link into the front page breaks.
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

test("the front page lists the seven datasets, and the topics row opens its page", () => {
  const html = page("/");
  for (const d of data.datasetIndex("threeMonths")) {
    assert.ok(text(html).includes(d.name), d.name);
    assert.ok(html.includes(`href="${d.href}"`), `${d.id} links to ${d.href}`);
    if (d.href.startsWith("#")) assert.ok(ids(html).has(d.href.slice(1)), `${d.href} is on the front page`);
  }
});

/** Every section anchor the front page had before the data pages, so old links still land somewhere. */
const OLD_ANCHORS = [
  "today", "news", "momentum", "themes", "products", "indicators", "adoption", "usage", "market-share", "method",
  "reading", "analysis", "announcements", "code", "labs", "launches", "models", "papers",
];
const READING = ["reading", "analysis", "announcements", "code", "labs", "launches", "models", "papers"];

test("no old link into the front page breaks, and the reading lists are on their own page", () => {
  const front = ids(page("/"));
  for (const id of OLD_ANCHORS) assert.ok(front.has(id), `#${id} is still on the front page`);
  assert.ok(ids(page("/today")).has("today"), "#today is on the news page");
  const reading = ids(page("/reading"));
  for (const id of READING) assert.ok(reading.has(id), `#${id} is on the reading list page`);
});

test("the MCP server ships with the daily snapshots its top story is weighed against", () => {
  // /mcp runs on request, so it reads data/snapshots/ where it is deployed, where only the files the build traced are.
  const trace = JSON.parse(readFileSync(join(APP, "mcp/route.js.nft.json"), "utf8"));
  const shipped = new Set(trace.files.map((f: string) => f.replace(/^(\.\.\/)+/, "")));
  const snapshots = readdirSync(join(import.meta.dirname, "../../data/snapshots")).filter((f) => f.endsWith(".json"));
  assert.ok(snapshots.length > 0);
  for (const f of snapshots) assert.ok(shipped.has(`data/snapshots/${f}`), `${f} is shipped with /mcp`);
});
