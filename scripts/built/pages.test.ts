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

const front = (h: string) => page(trends.HORIZONS[h].href);
/** The part of a page between an element's opening and the closing tag of the same name that ends it. */
const sectionOf = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `#${id} is on the page`);
  const open = html.lastIndexOf("<", start);
  const tag = html.slice(open + 1).match(/^\w+/)![0];
  let depth = 0;
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  re.lastIndex = open;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index + m[0].length);
  }
  throw new Error(`#${id} is not closed`);
};

test("each view's track record shows the replay's own figures, or says there is not enough history", async () => {
  const { replayRecord } = await fromSrc<any>("lib/replay");
  const { recordRows } = await fromSrc<any>("lib/record");
  for (const h of Object.keys(trends.HORIZONS)) {
    const block = sectionOf(front(h), "record");
    const seen = text(block);
    const { record } = replayRecord(h);
    if (!record) {
      assert.match(seen, /not enough history/i, `${h} says there is not enough history`);
      continue;
    }
    const lines = [...block.matchAll(/<li class="record__row[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
    const rows = recordRows(record, {});
    assert.equal(lines.length, rows.length, `${h}: one line per kind of call`);
    rows.forEach((row: any, i: number) => {
      assert.ok(lines[i].includes(row.label), `${h}: ${row.label}`);
      assert.ok(lines[i].includes(`${row.held} of ${row.calls}`), `${h}: ${row.label} ${row.held} of ${row.calls}`);
      assert.equal(/few calls/.test(lines[i]), row.few, `${h}: ${row.label} says “few calls” only when it rests on few`);
    });
    assert.match(seen, /13 weeks later/, `${h} says how a call is checked`);
    assert.match(seen, /replay/i, `${h} says it is a replay`);
  }
});

test("the record marks the rows today's headline makes a call of", async () => {
  const { buildBriefing } = await fromSrc<any>("lib/briefing");
  const block = sectionOf(front("threeMonths"), "record");
  const { lead } = buildBriefing(trends.buildTrends("threeMonths"));
  const marked = [...block.matchAll(/<li class="record__row record__row--today"[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
  const research = lead.find((s: any) => s.measure === "Research");
  const themes = lead.some((s: any) => s.measure !== "Research");
  const expected = [
    ...(research ? [research.direction === "rising" ? "Research topics, rising" : "Research topics, cooling"] : []),
    ...(themes ? ["Themes"] : []),
  ];
  assert.equal(marked.length, expected.length, "one marked row per kind of call in the headline");
  expected.forEach((label, i) => assert.ok(marked[i].includes(label), label));
});

test("the method says how the track record is made", () => {
  const method = text(sectionOf(front("threeMonths"), "track-record"));
  assert.match(method, /replay/i);
  assert.match(method, /today’s rules/);
  assert.match(method, /once/);
  assert.match(method, /13 weeks/);
});

test("under each lead chart: a rise shows what was counted, at most three, each from the file; a fall shows only why it has none", async () => {
  const { buildBriefing } = await fromSrc<any>("lib/briefing");
  const counted = await fromSrc<any>("lib/counted");
  const file = JSON.parse(readFileSync(join(import.meta.dirname, "../../data/counted.json"), "utf8"));
  let lists = 0;
  for (const h of Object.keys(trends.HORIZONS)) {
    const html = front(h);
    const t = trends.buildTrends(h);
    const { lead } = buildBriefing(t);
    const panels = [...html.matchAll(/<figure class="leadchart__panel[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    assert.equal(panels.length, lead.length, `${h}: one panel per mover`);
    lead.forEach((s: any, i: number) => {
      const panel = panels[i];
      const id = `counted-${counted.seriesOf(s.measure)}-${s.id}`;
      if (s.direction === "cooling") {
        assert.match(text(panel), /No list under a fall/, `${h} ${s.id}: a fall says why it has no list`);
        assert.ok(!panel.includes(`id="${id}"`), `${h} ${s.id}: a fall has no list`);
        return;
      }
      const move = counted.countedFor(file, h, counted.seriesOf(s.measure), s.id, counted.latestSpan(t.weeks, t.window));
      if (!move) return assert.ok(!panel.includes("leadchart__evidence"), `${h} ${s.id}: nothing collected, nothing shown`);
      lists++;
      const items = move.stories ?? move.papers;
      const list = sectionOf(panel, id);
      const rows = [...list.matchAll(/<li>/g)];
      assert.equal(rows.length, items.length, `${h} ${s.id}: one row per item kept`);
      assert.ok(rows.length <= counted.COUNTED_MAX, `${h} ${s.id}: at most ${counted.COUNTED_MAX}`);
      for (const item of items) assert.ok(list.includes(`href="${item.url.replace(/&/g, "&amp;")}"`), `${h} ${s.id}: links ${item.url}`);
      const label = text(list.slice(0, list.indexOf("<div")));
      assert.match(label, move.stories ? /What was counted/ : /Examples of the papers counted/);
      assert.doesNotMatch(label, /\b(why|because|reason)\b/i, "the heading and rule say what was counted, not why");
      assert.ok(html.includes(`class="brief__counted" href="#${id}"`), `${h} ${s.id}: the briefing line points to the list`);
    });
  }
  assert.ok(lists > 0, "today's data has at least one rise with a list");
});

/** Steady themes and quiet products sit in one closed fold per section or group; called ones stay open. */
const FOLD = '<details class="table-view fold">';

test("themes: called themes stay open, steady ones are folded, and at most six are open on the three-month view", () => {
  for (const h of Object.keys(trends.HORIZONS)) {
    const themes = sectionOf(front(h), "themes");
    const at = themes.indexOf(FOLD);
    const open = at < 0 ? themes : themes.slice(0, at);
    const folded = at < 0 ? "" : themes.slice(at);
    assert.equal(themes.split(FOLD).length - 1, at < 0 ? 0 : 1, `${h}: one fold at most`);
    assert.doesNotMatch(open, /<h3>Steady/, `${h}: no steady group outside the fold`);
    assert.doesNotMatch(folded, /<h3>(Rising|Cooling)/, `${h}: no called group inside the fold`);
    const called = trends.buildTrends(h).themeTrends.filter((t: any) => t.direction !== "steady").length;
    const shown = open.split('class="mom__row mom__row--theme"').length - 1;
    assert.equal(shown, called, `${h}: every called theme is open`);
    if (h === "threeMonths") assert.ok(shown <= 6, `three months: ${shown} theme rows open`);
  }
});

test("products: a row with a called move on either measure stays open; the rest are folded in their group", () => {
  const html = sectionOf(front("threeMonths"), "products");
  const rows = [...html.matchAll(/<li id="(product-[^"]+)"/g)].map((m) => m[1]);
  assert.ok(rows.length > 0);
  for (const id of rows) {
    const row = sectionOf(html, id);
    const called = /mom__signal--(rising|cooling)/.test(row);
    const before = html.slice(0, html.indexOf(`id="${id}"`));
    const inFold = before.lastIndexOf(FOLD) > before.lastIndexOf("</details>");
    assert.equal(inFold, !called, `${id} is ${called ? "open" : "folded"}`);
  }
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
  // Only the page's own words are checked: a headline of the day may say anything.
  const method = html.slice(html.indexOf('id="method"'));
  for (const own of [...shown, text(method)]) assert.doesNotMatch(own, /Why it matters/, "the line is about the trend, and says so");
  assert.match(text(method), /The trend\./, "the method note is headed as the line is labelled");
  if (line) {
    assert.ok(shown[0].endsWith(line), shown[0]);
    assert.ok(shown[0].startsWith("The trend:"), "labelled as the reading list's block labels it");
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

/** Text as React writes it into the page. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

test("a watched event's page leads with its ranked moments, then folds the stage table, then the tracker at the foot", async () => {
  const { conferences, surpriseOf, momentDay } = await fromSrc<any>("lib/conferences");
  const watched = conferences.filter((c: any) => c.recap?.points.length);
  assert.ok(watched.length > 0, "the calendar has a watched event");
  for (const c of watched) {
    const html = page(`/conferences/${c.id}`);
    const stage = html.search(/<details[^>]*id="stage"/);
    const points = c.recap.points;
    const at = points.map((p: any) => html.indexOf(esc(p.said)));
    assert.ok(at[0] >= 0, `${c.id}: moment 1 is on the page`);
    if (c.stage) assert.ok(stage > at[0], `${c.id}: moment 1 comes before the stage table, which is folded`);
    assert.ok(html.indexOf('class="where"') > Math.max(at[0], stage), `${c.id}: the tracker is at the foot`);
    assert.ok(html.indexOf('class="year"') > Math.max(at[0], stage), `${c.id}: the year strip is at the foot`);
    at.forEach((n: number, i: number) => assert.ok(i === 0 || n > at[i - 1], `${c.id}: moment ${i + 1} follows moment ${i}, in the editor's order`));

    const moments = html.slice(html.indexOf('id="moments"'), stage > 0 ? stage : undefined);
    assert.match(moments, /class="conf__caveat"/, `${c.id}: the paraphrase caveat sits with the moments`);
    points.forEach((p: any, i: number) => {
      const from = html.indexOf(`id="moment-${i + 1}"`);
      assert.ok(from >= 0, `${c.id}: moment ${i + 1} has an anchor`);
      const next = html.indexOf(`id="moment-${i + 2}"`);
      const block = html.slice(from, next > 0 ? next : html.indexOf("</section>", from));
      assert.ok(block.includes(esc(p.said)), `${c.id}: moment ${i + 1} is where its anchor is`);
      if (p.at) assert.ok(block.includes(`href="${esc(p.at.url)}"`), `${c.id}: moment ${i + 1} links to its time`);
      const day = momentDay(c, p);
      if (day !== null) assert.match(text(block), new RegExp(`\\bday ${day}\\b`), `${c.id}: moment ${i + 1} says its day`);
    });

    const surprise = surpriseOf(c);
    const box = html.match(/<aside class="surprise"[\s\S]*?<\/aside>/)?.[0];
    assert.equal(Boolean(box), Boolean(surprise), `${c.id}: a surprise box only when there is a surprise`);
    if (surprise) {
      assert.ok(text(box!).includes(surprise.said), `${c.id}: the box holds the line`);
      assert.ok(html.indexOf(box!) < at[0], `${c.id}: the surprise sits above the moments`);
    }

    if (c.stage) {
      const table = html.slice(stage, html.indexOf("</details>", stage));
      for (const p of points) assert.ok(!table.includes(esc(p.said)), `${c.id}: the table does not repeat a moment`);
      for (const topic of new Set<string>(points.map((p: any) => p.topic))) {
        const ranked = points.flatMap((p: any, i: number) => (p.topic === topic ? [i + 1] : []));
        const row = table.match(new RegExp(`<li[^>]*id="stage-${topic}"[\\s\\S]*?</li>`))?.[0];
        assert.ok(row, `${c.id}: a topic with moments has a row`);
        assert.ok(row.includes(`href="#moment-${ranked[0]}"`), `${c.id}: the ${topic} row links to its first moment`);
        assert.match(text(row), new RegExp(`\\b${ranked.length} moments?\\b`), `${c.id}: the ${topic} row counts its moments`);
      }
    }
  }
});

test("on /conferences a watched event's card leads with its surprise or moment 1, not the loudest topic's share", async () => {
  const { conferences, surpriseOf } = await fromSrc<any>("lib/conferences");
  const html = page("/conferences");
  for (const c of conferences.filter((x: any) => x.recap?.points.length)) {
    const from = html.indexOf(`id="${c.id}"`);
    const card = html.slice(from, html.indexOf("</li>", from));
    assert.doesNotMatch(text(card), /took \S+ of topic mentions/, `${c.id}: no "took X% of topic mentions"`);
    const lead = surpriseOf(c)?.said ?? c.recap.points[0].said;
    assert.ok(text(card).includes(lead), `${c.id}: leads with the surprise or moment 1`);
    const first = c.recap.points[0];
    if (first.at) assert.ok(card.includes(`href="${esc(first.at.url)}"`), `${c.id}: links to moment 1's time`);
  }
});

test("an event with no reading keeps its page as it was: the tracker and year strip in its header, no moments", async () => {
  const { conferences } = await fromSrc<any>("lib/conferences");
  for (const c of conferences.filter((x: any) => !x.stage && !x.recap)) {
    const html = page(`/conferences/${c.id}`);
    assert.ok(!html.includes('id="moments"'), c.id);
    const start = html.indexOf('<header class="ehead"');
    const head = html.slice(start, html.indexOf("</header>", start));
    assert.ok(head.includes('class="where"') && head.includes('class="year"'), `${c.id}: tracker and year strip in the header`);
  }
});
