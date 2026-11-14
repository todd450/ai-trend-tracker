/**
 * Run with `npm test`. "What was counted": the few stories and papers kept under each rising move
 * the trends page's headline names. Every item kept must match its move's own search and fall
 * inside the move's latest window; a story submitted twice is one item; falls get no list.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COUNTED_MAX,
  COUNTED_WEEKS,
  countedFor,
  latestSpan,
  phraseIn,
  pickPapers,
  pickStories,
  risingMoves,
  storiesByWeek,
  titleMatches,
  within,
  type CountedFile,
  type CountedStory,
  type PaperCandidate,
  type Span,
} from "../src/lib/counted.ts";
import { THEMES } from "../src/lib/themes.ts";
import { TOPICS } from "../src/lib/topics.ts";
import type { LeadSeries } from "../src/lib/sentences.ts";

const WEEKS = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"];
/** The latest four weeks: 12 Oct to the end of Sunday 8 Nov. */
const SPAN: Span = { first: "2026-10-12", last: "2026-11-02" };

let n = 0;
const story = (title: string, points: number, at = "2026-10-20T10:00:00.000Z", url?: string): CountedStory => {
  n++;
  return {
    title,
    url: url ?? `https://example.org/story-${n}`,
    discussionUrl: `https://news.ycombinator.com/item?id=${n}`,
    points,
    comments: points / 2,
    createdAt: at,
  };
};
const paper = (title: string, summary: string, at = "2026-10-20T10:00:00Z", upvotes?: number): PaperCandidate => {
  n++;
  return { id: `2610.${String(n).padStart(5, "0")}`, title, summary, url: `https://arxiv.org/abs/2610.${String(n).padStart(5, "0")}`, publishedAt: at, ...(upvotes ? { upvotes } : {}) };
};

// ------------------------------------------------------------ the window

test("the latest window runs from its first Monday to the end of its last week's Sunday", () => {
  assert.deepEqual(latestSpan(WEEKS, 4), SPAN);
  assert.deepEqual(latestSpan(WEEKS, 1), { first: "2026-11-02", last: "2026-11-02" });
  assert.equal(latestSpan(WEEKS, 6), null, "too few weeks for the window");
  assert.equal(latestSpan([], 1), null);

  assert.ok(within("2026-10-12T00:00:00.000Z", SPAN), "the first moment of the window");
  assert.ok(within("2026-11-08T23:59:59.000Z", SPAN), "the last moment of the window");
  assert.ok(!within("2026-11-09T00:00:00.000Z", SPAN), "the Monday after");
  assert.ok(!within("2026-10-11T23:59:59.000Z", SPAN), "the Sunday before");
  assert.ok(!within("not a date", SPAN));
});

// ------------------------------------------------------------ matching a search

test("a Hacker News title matches a search when it holds every word, in any order, as whole words", () => {
  assert.ok(titleMatches("Layoffs blamed on AI", "AI layoffs"));
  assert.ok(titleMatches("Banks are now trying to offload the AI data center debt", "AI data center"));
  assert.ok(titleMatches("The anti-AI movement grows", "anti AI"), "punctuation splits words");
  assert.ok(titleMatches("NVIDIA's AI GPU shipments", "AI GPU"), "case does not matter");
  assert.ok(!titleMatches("Airplanes get faster GPUs", "AI GPU"), "AI is not a prefix of Airplanes");
  assert.ok(!titleMatches("AI chipset makers", "AI chips"), "chips is not a prefix of chipset");
  assert.ok(!titleMatches("Data centers are thirsty", "AI data center"), "every word is needed");
});

test("a quoted part of a search must appear as that exact phrase", () => {
  assert.ok(titleMatches("The EU AI Act takes effect", '"AI Act"'));
  assert.ok(!titleMatches("AI firms act fast", '"AI Act"'));
  assert.ok(titleMatches("Trump signs executive order on AI", 'AI "executive order"'));
  assert.ok(!titleMatches("AI order for the executive suite", 'AI "executive order"'));
});

test("a paper matches a topic phrase in its title or its abstract, as a run of whole words", () => {
  assert.ok(phraseIn("We study chain of thought in small models", "chain-of-thought"), "hyphens are word breaks");
  assert.ok(phraseIn("An LLM agent for spreadsheets", "LLM agent"));
  assert.ok(!phraseIn("An agent built on an LLM", "LLM agent"), "the words must be in order");
  assert.ok(!phraseIn("Quantizations", "quantization"), "whole words only");
});

// ------------------------------------------------------------ choosing the stories

const at = (day: string) => `${day}T10:00:00.000Z`;
/** Two weeks, 26 Oct to 8 Nov: too short for a story from each week, so the most points overall. */
const SHORT: Span = { first: "2026-10-26", last: "2026-11-02" };
const IN_SHORT = at("2026-10-28");

test("stories: a window of three weeks or more is read week by week, a shorter one as a whole", () => {
  assert.ok(storiesByWeek(SPAN));
  assert.ok(storiesByWeek({ first: "2026-10-19", last: "2026-11-02" }), "three weeks");
  assert.ok(!storiesByWeek(SHORT));
  assert.ok(!storiesByWeek({ first: "2026-11-02", last: "2026-11-02" }));
});

test("stories, week by week: the most-discussed from each week, newest week first, each matching a search and inside the window", () => {
  const searches = ["AI data center", "AI GPU"];
  const kept = pickStories(
    [
      story("Banks offload the AI data center debt", 386, at("2026-10-14")),
      story("Intel D270 GPU AI Accelerator", 308, at("2026-10-12")), // the banks' week, with fewer points
      story("AI models may self-replicate without a datacenter", 900, at("2026-10-13")), // matches no search here
      story("Most Americans oppose a new AI data center", 93, at("2026-10-22")),
      story("Fiber lasts decades, an AI GPU three years", 42, at("2026-10-30")),
      story("Voters reject the AI data center", 61, at("2026-11-05")),
      story("AI data center stocks slide", 56, at("2026-11-04")),
      story("Old news on AI GPU prices", 999, "2026-10-11T23:00:00.000Z"), // the week before
      story("Next week's AI GPU", 999, "2026-11-09T00:00:00.000Z"), // after the window
    ],
    searches,
    SPAN,
  );
  assert.deepEqual(kept.map((s) => s.points), [61, 42, 93, 386], "the latest week first, whatever its points");
  for (const s of kept) {
    assert.ok(searches.some((q) => titleMatches(s.title, q)), s.title);
    assert.ok(within(s.createdAt, SPAN), s.title);
  }
});

test("stories, week by week: a week with no match is left out, and a long window gives its latest four weeks only", () => {
  const quarter: Span = { first: "2026-08-10", last: "2026-11-02" };
  const kept = pickStories(
    [
      story("An AI GPU shortage in August", 5000, at("2026-08-12")),
      story("AI GPU prices five weeks back", 4000, at("2026-10-07")),
      story("AI GPU exports four weeks back", 10, at("2026-10-13")),
      story("AI GPU rentals two weeks back", 20, at("2026-10-27")),
      story("AI GPU benchmarks last week", 30, at("2026-11-03")),
    ],
    ["AI GPU"],
    quarter,
  );
  assert.deepEqual(kept.map((s) => s.points), [30, 20, 10]);
  assert.ok(kept.length <= COUNTED_WEEKS);
});

test("stories, week by week: a story submitted in two weeks is listed once, under its higher-scoring copy", () => {
  const kept = pickStories(
    [
      story("Nvidia's AI GPU sales double", 200, at("2026-11-03"), "https://www.nvidia.com/news/q3"),
      story("Nvidia's AI GPU sales double", 300, at("2026-10-28"), "https://nvidia.com/news/q3/"), // same article
      story("A quieter AI GPU launch", 12, at("2026-11-04")),
      story("An AI GPU recall", 15, at("2026-10-29")),
    ],
    ["AI GPU"],
    SPAN,
  );
  assert.deepEqual(kept.map((s) => s.points), [12, 300]);
});

test("stories, short window: the most points first, at most three", () => {
  const kept = pickStories(
    [
      story("Banks offload the AI data center debt", 386, IN_SHORT),
      story("Intel D270 GPU AI Accelerator", 308, IN_SHORT),
      story("A new AI GPU from nowhere", 50, IN_SHORT),
      story("AI data center in orbit", 120, at("2026-11-04")),
      story("Old news on AI GPU prices", 999, at("2026-10-22")), // the week before
    ],
    ["AI data center", "AI GPU"],
    SHORT,
  );
  assert.deepEqual(kept.map((s) => s.points), [386, 308, 120]);
  assert.ok(kept.length <= COUNTED_MAX);
});

test("stories: one story submitted twice is one item, by link or by headline, keeping the higher-scoring copy", () => {
  const kept = pickStories(
    [
      story("Nvidia's AI GPU sales double", 200, IN_SHORT, "https://www.nvidia.com/news/q3"),
      story("Nvidia's AI GPU sales double", 90, IN_SHORT, "https://nvidia.com/news/q3/"), // same article
      story("Nvidia's AI GPU sales double again this quarter", 150, IN_SHORT), // holds the other headline whole
      story("AI GPU", 140, IN_SHORT), // too short to stand for every headline that contains it
      story("Another AI GPU story", 10, IN_SHORT),
    ],
    ["AI GPU"],
    SHORT,
  );
  assert.deepEqual(kept.map((s) => s.points), [200, 140, 10]);
});

test("stories: Hacker News text posts are told apart by their item, not taken for one article", () => {
  const ask = (title: string, points: number) => {
    const s = story(title, points, IN_SHORT);
    return { ...s, url: s.discussionUrl };
  };
  const kept = pickStories([ask("Ask HN: Is the AI GPU shortage over?", 80), ask("Ask HN: Which AI GPU for a home lab?", 60)], ["AI GPU"], SHORT);
  assert.equal(kept.length, 2);
});

test("stories: ties go to the more discussed, and nothing matching gives an empty list", () => {
  const a = { ...story("AI GPU one", 100, IN_SHORT), comments: 5 };
  const b = { ...story("AI GPU two", 100, IN_SHORT), comments: 40 };
  assert.deepEqual(pickStories([a, b], ["AI GPU"], SHORT).map((s) => s.title), ["AI GPU two", "AI GPU one"]);
  assert.deepEqual(pickStories([{ ...a, createdAt: at("2026-11-03") }, { ...b, createdAt: at("2026-11-04") }], ["AI GPU"], SPAN).map((s) => s.title), ["AI GPU two"]);
  assert.deepEqual(pickStories([story("Nothing here", 500)], ["AI GPU"], SPAN), []);
  assert.deepEqual(pickStories([], ["AI GPU"], SPAN), []);
});

// ------------------------------------------------------------ choosing the papers

test("papers: those upvoted on Hugging Face first, most upvotes first, then the newest", () => {
  const phrases = ["quantization", "knowledge distillation"];
  const kept = pickPapers(
    [
      paper("Plain quantization", "", "2026-11-01T00:00:00Z"),
      paper("Newest quantization", "", "2026-11-07T00:00:00Z"),
      paper("Order-only distillation", "We use knowledge distillation.", "2026-10-15T00:00:00Z", 35),
      paper("Extreme compression", "Latent vector quantization of embeddings.", "2026-10-27T00:00:00Z", 12),
      paper("Off-topic but popular", "Robots.", "2026-10-27T00:00:00Z", 99),
      paper("Quantization too early", "", "2026-10-11T00:00:00Z", 50),
    ],
    phrases,
    SPAN,
  );
  assert.deepEqual(kept.map((p) => p.title), ["Order-only distillation", "Extreme compression", "Newest quantization"]);
  for (const p of kept) assert.ok(within(p.publishedAt, SPAN));
  assert.ok(kept.every((p) => !("summary" in p)), "abstracts are read, not stored");
});

test("papers: one paper found twice, by arXiv and by Hugging Face, is one item with its upvotes", () => {
  const a = paper("Small models quantization", "");
  const kept = pickPapers([a, { ...a, upvotes: 7 }, paper("Another quantization", "")], ["quantization"], SPAN);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].upvotes, 7);
});

// ------------------------------------------------------------ which moves get a list

const lead = (measure: string, id: string, direction: "rising" | "cooling"): LeadSeries => ({
  measure,
  id,
  name: id,
  unit: "",
  signal: { values: [], recent: 1, prior: 1, change: 0 },
  direction,
});

test("only the rising moves the headline names get a search, with that series' own phrases", () => {
  const theme = THEMES.find((t) => t.id === "infrastructure")!;
  const topic = TOPICS[0];
  const moves = risingMoves("threeMonths", [lead("Research", topic.id, "cooling"), lead("Hacker News discussion", theme.id, "rising")], WEEKS, 4);
  assert.deepEqual(moves, [{ horizon: "threeMonths", series: "theme", id: theme.id, ...SPAN, searches: theme.hn }]);

  const both = risingMoves("oneWeek", [lead("Research", topic.id, "rising"), lead("Hacker News discussion", theme.id, "rising")], WEEKS, 1);
  assert.deepEqual(both.map((m) => [m.series, m.searches]), [["topic", topic.arxiv], ["theme", theme.hn]]);

  assert.deepEqual(risingMoves("threeMonths", [lead("Research", topic.id, "cooling")], WEEKS, 4), [], "a fall gets no list");
  assert.deepEqual(risingMoves("threeMonths", [lead("Research", "no-such-topic", "rising")], WEEKS, 4), [], "an unknown series is skipped");
  assert.deepEqual(risingMoves("twoYears", [lead("Research", topic.id, "rising")], WEEKS, 52), [], "too few weeks");
});

// ------------------------------------------------------------ the page reads the file

test("the page shows a list only for the same view, series and window it was collected for", () => {
  const stories = [story("AI GPU one", 10)];
  const file: CountedFile = {
    generatedAt: "2026-11-14T06:00:00Z",
    moves: [{ horizon: "threeMonths", series: "theme", id: "infrastructure", ...SPAN, stories }],
  };
  const got = countedFor(file, "threeMonths", "theme", "infrastructure", SPAN);
  assert.ok(got && "stories" in got);
  assert.deepEqual(got.stories, stories);
  assert.equal(countedFor(file, "oneMonth", "theme", "infrastructure", SPAN), null, "another view");
  assert.equal(countedFor(file, "threeMonths", "topic", "infrastructure", SPAN), null, "another series");
  assert.equal(countedFor(file, "threeMonths", "theme", "jobs", SPAN), null, "another move");
  assert.equal(countedFor(file, "threeMonths", "theme", "infrastructure", { first: "2026-10-19", last: "2026-11-09" }), null, "a later window");
  assert.equal(countedFor(file, "threeMonths", "theme", "infrastructure", null), null);
  assert.equal(countedFor({ generatedAt: "", moves: [{ horizon: "threeMonths", series: "theme", id: "infrastructure", ...SPAN, stories: [] }] }, "threeMonths", "theme", "infrastructure", SPAN), null, "an empty list is no list");
});
