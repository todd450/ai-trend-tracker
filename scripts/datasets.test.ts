/**
 * Run with `npm test`. The data pages: the topics page's table, its CSV file and the MCP server's
 * get_trends must give the same figure for every topic and week, and the front page's index of
 * datasets must only name a move the site would call.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const trends = await fromSrc<any>("lib/trends");
const data = await fromSrc<any>("lib/datasets");
const { TOOLS } = await fromSrc<any>("lib/mcp/tools");
const getTrends = TOOLS.find((t: any) => t.name === "get_trends");

const HORIZONS = Object.keys(trends.HORIZONS);
const history = trends.history;
const allWeeks = Object.keys(history.arxivTotal).sort();
/** The name each horizon goes by in the MCP server and in the site's addresses. */
const nameOf = (h: string) => trends.HORIZONS[h].href.slice(1) || "three-months";

/** Parses the CSV the site serves; fields are quoted only when they hold a comma, quote or line break. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (quoted || (c !== "," && c !== "\n" && c !== "\r")) {
      field += c;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      rows.push([...row, field]);
      row = [];
      field = "";
    }
  }
  if (field || row.length) rows.push([...row, field]);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const csv = data.topicsCsv();
const rows = parseCsv(csv);
const key = (week: string, id: string) => `${week} ${id}`;
const byKey = new Map(rows.map((r) => [key(r.week, r.topic_id), r]));

test("the file is long form: one row per topic and week, with fixed columns", () => {
  const [header] = csv.split("\n");
  assert.deepEqual(header.split(","), ["week", "topic_id", "topic", "source", "count", "total", "share"]);
  const topics = Object.keys(history.topics);
  assert.equal(rows.length, topics.length * allWeeks.length);
  assert.equal(byKey.size, rows.length, "no topic and week appears twice");
  for (const r of rows) {
    assert.match(r.week, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${r.week}T00:00:00Z`).getUTCDay(), 1, `${r.week} is the Monday the week starts`);
    assert.ok(Number(r.share) >= 0 && Number(r.share) <= 1, `share ${r.share} is a fraction`);
  }
});

test("the file holds every week on record, whichever range is viewed", () => {
  assert.deepEqual([...new Set(rows.map((r) => r.week))].sort(), allWeeks);
  assert.equal(data.TOPICS_FILE.weeks, allWeeks.length);
  assert.equal(data.TOPICS_FILE.since, allWeeks[0]);
  assert.equal(data.TOPICS_FILE.rows, rows.length);
});

test("every count in the file is the collected count, over the week's total", () => {
  for (const [id, series] of Object.entries<any>(history.topics)) {
    for (const week of allWeeks) {
      const r = byKey.get(key(week, id));
      assert.ok(r, `${id} ${week} is in the file`);
      assert.equal(r.source, "arxiv");
      assert.equal(Number(r.count), series.arxiv[week]);
      assert.equal(Number(r.total), history.arxivTotal[week]);
      assert.ok(Math.abs(Number(r.share) - series.arxiv[week] / history.arxivTotal[week]) < 1e-6);
    }
  }
});

test("a field holding a comma or a quote is quoted, so a topic name cannot shift the columns", () => {
  assert.equal(data.csvField('Retrieval, "RAG"'), '"Retrieval, ""RAG"""');
  assert.equal(data.csvField("AI agents"), "AI agents");
  assert.equal(data.csvField(12), "12");
});

for (const h of HORIZONS) {
  test(`${nameOf(h)}: the table, the file and get_trends give the same figures`, () => {
    const table = data.topicTable(h);
    const mcp = getTrends.run({ measure: "research", horizon: nameOf(h) });
    assert.equal(table.rows.length, mcp.topics.length);
    for (const row of table.rows) {
      const m = mcp.topics.find((t: any) => t.id === row.id);
      assert.ok(m, `${row.id} is in get_trends`);
      assert.equal(Number(row.research.recent.toFixed(2)), m.research.shareOfAiPapersPct.recent, `${row.id} research now`);
      assert.equal(Number(row.research.prior.toFixed(2)), m.research.shareOfAiPapersPct.prior, `${row.id} research before`);
      assert.equal(row.research.change === null ? null : Math.round(row.research.change * 100), m.research.changePct);
      assert.equal(row.research.few, !m.research.firm, `${row.id} few papers`);
      assert.equal(
        row.research.call,
        m.research.withinUsualSwing ? "too noisy to call" : m.direction,
        `${row.id} research call`,
      );
      assert.equal(Number(row.discussion.recent.toFixed(1)), m.discussion.hackerNewsStoriesPerWeek.recent);
      assert.equal(Number(row.discussion.prior.toFixed(1)), m.discussion.hackerNewsStoriesPerWeek.prior);
      const storiesHeld = m.discussion.direction === "steady" && row.discussion.call === "too noisy to call";
      assert.ok(row.discussion.call === m.discussion.direction || storiesHeld, `${row.id} discussion call`);

      // Week by week: the series behind the row is the file's.
      const weekly = getTrends.run({ measure: "research", horizon: nameOf(h), id: row.id }).weekly;
      for (const w of weekly) {
        const r = byKey.get(key(w.week, row.id));
        assert.ok(r, `${row.id} ${w.week} is in the file`);
        assert.equal(w.papers, Number(r.count), `${row.id} ${w.week} papers`);
        // The file's share is rounded to six places, so it is checked against the counts it was made from.
        const fileShare = (Number(r.count) / Number(r.total)) * 100;
        assert.equal(w.shareOfAiPapersPct, Number(fileShare.toFixed(2)), `${row.id} ${w.week} share`);
        assert.ok(Math.abs(Number(r.share) * 100 - fileShare) < 1e-4, `${row.id} ${w.week} share in the file`);
      }
    }
  });
}

test("the table says exactly what it compares", () => {
  assert.match(data.topicTable("threeMonths").compared, /last 4 weeks compared with the 4 weeks before/);
  assert.match(data.topicTable("oneWeek").compared, /latest week compared with the week before/);
  assert.match(data.topicTable("twoYears").compared, /last 52 weeks compared with the 52 weeks before/);
});

test("each range has its own address, and the front page's range has none", () => {
  const hrefs = HORIZONS.map((h) => data.topicsHref(h));
  assert.equal(new Set(hrefs).size, HORIZONS.length);
  assert.equal(data.topicsHref("threeMonths"), "/data/topics");
  for (const h of HORIZONS.filter((x) => x !== "threeMonths")) {
    // The same range name as the front page's own view, so a reader's choice carries across.
    assert.equal(data.topicsHref(h), `/data/topics/${nameOf(h)}`);
  }
});

test("the citation names the range and the address it was read at", () => {
  for (const h of HORIZONS) {
    const cite = data.topicsCitation(h);
    // "3-month view", "1-week view"
    assert.ok(cite.includes(`${trends.HORIZONS[h].label.replace(/s$/, "").replace(" ", "-")} view`), `${h}: ${cite}`);
    assert.ok(cite.includes(data.topicsHref(h)), `${h}: ${cite}`);
  }
});

// ------------------------------------------------------------ the index on the front page

const sig = (recent: number, prior: number, clear = true) => ({
  values: [prior, recent],
  recent,
  prior,
  change: prior > 0 ? (recent - prior) / prior : null,
  clear,
});

test("the biggest move is the largest one the site would call, among series big enough to trust", () => {
  const pick = data.biggestMove([
    { name: "Tiny", signal: sig(3, 1), big: false, band: 0.1 },
    { name: "Wobbly", signal: sig(20, 10, false), big: true, band: 0.1 },
    { name: "Small step", signal: sig(10.5, 10), big: true, band: 0.1 },
    { name: "Fell", signal: sig(6, 10), big: true, band: 0.1 },
    { name: "Rose", signal: sig(13, 10), big: true, band: 0.1 },
  ]);
  assert.equal(pick.name, "Fell");
});

test("with no move the site would call, no move is named", () => {
  assert.equal(data.biggestMove([{ name: "Small step", signal: sig(10.5, 10), big: true, band: 0.1 }]), null);
  assert.equal(data.biggestMove([{ name: "New", signal: sig(5, 0), big: true, band: 0.1 }]), null);
  assert.equal(data.biggestMove([]), null);
});

for (const h of HORIZONS) {
  test(`${nameOf(h)}: the index lists seven datasets, each reachable, with the date of its latest figures`, () => {
    const index = data.datasetIndex(h);
    assert.equal(index.length, 7);
    assert.equal(new Set(index.map((d: any) => d.id)).size, 7);
    const topics = index.find((d: any) => d.id === "topics");
    assert.equal(topics.href, data.topicsHref(h));
    for (const d of index.filter((x: any) => x.id !== "topics")) {
      assert.match(d.href, /^#[a-z-]+$/, `${d.id} links to its section on the front page`);
    }
    assert.ok(topics.latest.includes(trends.fmtDay(allWeeks.at(-1))), "topics' latest is its newest week, not the day collected");
    const same = index.filter((d: any) => d.sameEverySpan).map((d: any) => d.id).sort();
    assert.deepEqual(same, ["adoption", "indicators", "usage"]);
    for (const d of index) {
      if (!d.move) continue;
      assert.ok(d.move.direction === "rising" || d.move.direction === "cooling", `${d.id} names only a called move`);
      assert.match(d.move.text, /(rose|fell) to .+, from /, `${d.id}: ${d.move.text}`);
    }
  });
}

test("the topics row names a topic the headline could name: one with enough papers a week", () => {
  for (const h of HORIZONS) {
    const move = data.datasetIndex(h).find((d: any) => d.id === "topics").move;
    if (!move) continue;
    const { rankedTopics } = trends.buildTrends(h);
    assert.ok(
      rankedTopics.some((t: any) => move.text.startsWith(t.name)),
      `${h}: ${move.text} is about a topic with at least ${trends.HEADLINE_MIN_PAPERS} papers a week`,
    );
  }
});
