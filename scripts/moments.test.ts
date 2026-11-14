/**
 * Run with `npm test`. The 5-minute version of a watched event: the editor's moments in their
 * written order (the order is the rank), a surprise line only when the editor wrote one or an
 * existing reading finds one, and each moment's day read from the recording it links to.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { surpriseOf, momentDay, READING_LABEL, conferences } = await fromSrc<any>("lib/conferences");
const { TOPICS } = await fromSrc<any>("lib/topics");

const READINGS = Object.keys(READING_LABEL);
const SURPRISING = ["stage-ahead", "numbers-ahead"];

const ev = (extra: Record<string, unknown> = {}) => ({
  id: "x",
  name: "X",
  host: "Host",
  kind: "industry",
  start: "2026-10-01",
  end: "2026-10-02",
  place: "Somewhere",
  url: "https://example.com",
  ...extra,
});
const recap = (extra: Record<string, unknown> = {}) => ({ watchedOn: "2026-10-03", coverage: "All.", summary: "Said.", points: [], ...extra });
const row = (id: string, reading: string, mentions = 10) => ({ topic: TOPICS.find((t: any) => t.id === id), mentions, share: 0.1, reading, points: [] });
const [A, B] = TOPICS.map((t: any) => t.id);

test("with no editor's line, only a stage-ahead or numbers-ahead reading gives a surprise, and nothing else does", () => {
  for (const reading of READINGS) {
    const s = surpriseOf(ev({ recap: recap() }), [row(A, reading)]);
    if (SURPRISING.includes(reading)) {
      assert.equal(s?.from, "numbers", reading);
      assert.equal(s.topic, A, reading);
      assert.ok(s.said.includes(TOPICS[0].name), `${reading}: names the topic`);
      assert.ok(s.said.toLowerCase().includes(READING_LABEL[reading].toLowerCase()), `${reading}: says the reading`);
    } else {
      assert.equal(s, null, `${reading} is not a surprise`);
    }
  }
  assert.equal(surpriseOf(ev({ recap: recap() }), []), null, "no rows, no line");
});

test("the rule takes the loudest surprising topic, the first row, and never a quieter one before it", () => {
  const s = surpriseOf(ev(), [row(A, "loud-flat", 50), row(B, "numbers-ahead", 2), row(A, "stage-ahead", 1)]);
  assert.equal(s.topic, B);
});

test("the editor's line wins over the rule, keeps its topic when given one, and stands without one", () => {
  const rows = [row(A, "stage-ahead")];
  const withTopic = surpriseOf(ev({ recap: recap({ surprise: { said: "Odd.", topic: B } }) }), rows);
  assert.deepEqual(withTopic, { from: "editor", said: "Odd.", topic: B });
  const bare = surpriseOf(ev({ recap: recap({ surprise: { said: "Odd." } }) }), rows);
  assert.deepEqual(bare, { from: "editor", said: "Odd.", topic: undefined });
});

test("a blank editor's line is no line, so the rule or nothing decides", () => {
  assert.equal(surpriseOf(ev({ recap: recap({ surprise: { said: "  " } }) }), [row(A, "quiet")]), null);
  assert.equal(surpriseOf(ev({ recap: recap({ surprise: { said: "" } }) }), [row(A, "stage-ahead")]).from, "numbers");
});

test("a moment's day is the day its recording's title names, matched by the video, in any YouTube link form", () => {
  const c = ev({
    videos: [
      { title: "Session day 1 stream (11 November)", url: "https://www.youtube.com/live/AAA111" },
      { title: "Session Day 2 stream", url: "https://www.youtube.com/watch?v=BBB222" },
      { title: "Keynote", url: "https://youtu.be/CCC333" },
    ],
  });
  const at = (url: string) => ({ topic: A, said: "S.", at: { label: "0:01:00", url } });
  assert.equal(momentDay(c, at("https://www.youtube.com/watch?v=AAA111&t=60s")), 1);
  assert.equal(momentDay(c, at("https://youtu.be/BBB222?t=60")), 2);
  assert.equal(momentDay(c, at("https://www.youtube.com/live/BBB222?t=60")), 2);
  assert.equal(momentDay(c, at("https://www.youtube.com/watch?v=CCC333&t=5")), null, "a title with no day gives none");
  assert.equal(momentDay(c, at("https://www.youtube.com/watch?v=ZZZ999&t=5")), null, "an unknown video gives none");
  assert.equal(momentDay(c, at("https://example.com/talk")), null, "a link that is not a video gives none");
  assert.equal(momentDay(c, { topic: A, said: "S." }), null, "no link, no day");
  assert.equal(momentDay(ev(), at("https://www.youtube.com/watch?v=AAA111")), null, "no videos, no day");
});

test("on the real calendar, every editor's surprise is written and names a tracked topic if it names one", () => {
  const ids = new Set(TOPICS.map((t: any) => t.id));
  for (const c of conferences) {
    const s = c.recap?.surprise;
    if (!s) continue;
    assert.ok(s.said.trim().length > 0, c.id);
    if (s.topic) assert.ok(ids.has(s.topic), `${c.id}: ${s.topic} is a tracked topic`);
  }
});

test("MCP get_conferences: an event gives the page's surprise line (or null) and says its points are ranked, keeping every earlier field", async () => {
  const { TOOLS } = await fromSrc<any>("lib/mcp/tools");
  const tool = TOOLS.find((t: any) => t.name === "get_conferences");
  assert.match(tool.description, /ranked/i, "says the points are ranked");
  for (const c of conferences) {
    const out = tool.run({ when: "all", id: c.id });
    for (const key of ["id", "name", "phase", "recordings", "videos", "recap", "stage", "page"]) assert.ok(key in out, `${c.id}: keeps ${key}`);
    assert.deepEqual(out.surprise, surpriseOf(c), `${c.id}: the same surprise the page shows`);
    if (c.recap) assert.deepEqual(out.recap.points, c.recap.points, `${c.id}: points in the editor's order`);
  }
});

test("on the real calendar, every moment that links into one of the event's videos says which day", () => {
  for (const c of conferences) {
    for (const p of c.recap?.points ?? []) {
      const video = c.videos?.find((v: any) => p.at?.url.includes(v.url.split(/[/=]/).at(-1)));
      if (video && /\bday \d+\b/i.test(video.title)) assert.ok(momentDay(c, p) !== null, `${c.id}: ${p.who}`);
    }
  }
});
