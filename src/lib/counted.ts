/**
 * "What was counted": the few stories and papers kept under each rising move the trends page's
 * headline names, so a reader can see what a rise was made of without leaving the page.
 *
 *   1. Moves: only the rising ones the headline (and so the briefing) names on each view, over
 *      that view's latest window. A fall means fewer stories, so no story stands for it.
 *   2. Stories, for a Hacker News theme: those in the window whose title matches one of the
 *      theme's own searches, one item per story however often it was submitted, most points first.
 *   3. Papers, for a research topic: those in the window whose title or abstract holds one of the
 *      topic's own phrases, the ones upvoted on Hugging Face first, then the newest. They are
 *      examples of what was counted, not the reason for the move, and the page says so.
 *
 * The collector (scripts/collect.ts) fetches the candidates and keeps what these rules choose in
 * data/counted.json, which it overwrites each run. Nothing here reads the data files, so the rules
 * can be tested on their own (scripts/counted.test.ts).
 */
import { sameArticle, sameHeadline } from "./editorial.ts";
import type { LeadSeries } from "./sentences.ts";
import { THEMES } from "./themes.ts";
import { TOPICS } from "./topics.ts";

/** The most items kept under one move. */
export const COUNTED_MAX = 3;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** A view's latest window, by the Mondays of its first and last weeks. */
export type Span = { first: string; last: string };

export type CountedStory = {
  title: string;
  url: string;
  discussionUrl: string;
  points: number;
  comments: number;
  createdAt: string;
};

export type CountedPaper = {
  /** The arXiv id, without its version. */
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  /** Upvotes on Hugging Face's daily papers, when the paper was listed there. */
  upvotes?: number;
};

/** A paper as the collector finds it: with its abstract, which is matched but not kept. */
export type PaperCandidate = CountedPaper & { summary: string };

export type Series = "topic" | "theme";

export type Move = Span & { horizon: string; series: Series; id: string };

export type CountedMove = Move & ({ stories: CountedStory[] } | { papers: CountedPaper[] });

/** data/counted.json */
export type CountedFile = { generatedAt: string; moves: CountedMove[] };

/** The series a lead chart's measure reads: "Research" is a topic's papers, the rest a theme's stories. */
export const seriesOf = (measure: string): Series => (measure === "Research" ? "topic" : "theme");

/** The latest `window` weeks of `weeks` (Mondays, oldest first), or null when there are too few. */
export function latestSpan(weeks: string[], window: number): Span | null {
  if (window < 1 || weeks.length < window) return null;
  return { first: weeks[weeks.length - window], last: weeks[weeks.length - 1] };
}

/** True for a moment from the first Monday of the span to the end of its last week's Sunday (UTC). */
export function within(iso: string, span: Span): boolean {
  const at = Date.parse(iso);
  const from = Date.parse(`${span.first}T00:00:00Z`);
  const to = Date.parse(`${span.last}T00:00:00Z`) + WEEK;
  return Number.isFinite(at) && at >= from && at < to;
}

/** Text as its words: lower case, any run of other characters a break, as the searches split them. */
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** True when `text` holds the words of `phrase` as a run of whole words, in order. */
export function phraseIn(text: string, phrase: string): boolean {
  const want = words(phrase);
  return want.length > 0 && ` ${words(text).join(" ")} `.includes(` ${want.join(" ")} `);
}

/**
 * True when a title matches a Hacker News search as the collector runs it: every word of the
 * search is in the title as a whole word, in any order, and a part in double quotes is in it as
 * that exact phrase.
 */
export function titleMatches(title: string, search: string): boolean {
  const phrases = [...search.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const loose = words(search.replace(/"[^"]*"/g, " "));
  const have = new Set(words(title));
  return loose.every((w) => have.has(w)) && phrases.every((p) => phraseIn(title, p)) && loose.length + phrases.length > 0;
}

/** One key per article. Hacker News's own text posts all share a path, so theirs keeps its item number. */
const articleKey = (url: string) => (/^https?:\/\/news\.ycombinator\.com\//.test(url) ? url : sameArticle(url));

/** Keeps the first of any items that are one article, by link or by headline, up to the cap. */
function distinct<T extends { title: string; url: string }>(ranked: T[]): T[] {
  const kept: T[] = [];
  for (const item of ranked) {
    if (kept.length >= COUNTED_MAX) break;
    const key = articleKey(item.url);
    if (kept.some((k) => articleKey(k.url) === key || sameHeadline(k.title, item.title))) continue;
    kept.push(item);
  }
  return kept;
}

/** A theme's stories: matching one of its searches, inside the window, most points first, then most comments. */
export function pickStories(stories: CountedStory[], searches: string[], span: Span): CountedStory[] {
  const ranked = stories
    .filter((s) => within(s.createdAt, span) && searches.some((q) => titleMatches(s.title, q)))
    .sort((a, b) => b.points - a.points || b.comments - a.comments || b.createdAt.localeCompare(a.createdAt));
  return distinct(ranked);
}

/**
 * A topic's papers: holding one of its phrases in the title or abstract, inside the window. Those
 * upvoted on Hugging Face come first, most upvotes first, then the newest. The same paper found
 * twice keeps its upvotes. The abstract is dropped.
 */
export function pickPapers(papers: PaperCandidate[], phrases: string[], span: Span): CountedPaper[] {
  const byId = new Map<string, PaperCandidate>();
  for (const p of papers) {
    const seen = byId.get(p.id);
    if (!seen || (p.upvotes ?? 0) > (seen.upvotes ?? 0)) byId.set(p.id, p);
  }
  const ranked = [...byId.values()]
    .filter((p) => within(p.publishedAt, span) && phrases.some((phrase) => phraseIn(`${p.title} ${p.summary}`, phrase)))
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0) || b.publishedAt.localeCompare(a.publishedAt));
  return distinct(ranked).map(({ id, title, url, publishedAt, upvotes }) => ({ id, title, url, publishedAt, ...(upvotes ? { upvotes } : {}) }));
}

/**
 * The searches to run for one view: one per rising move its headline names, with the series' own
 * phrases (a theme's Hacker News searches, a topic's arXiv phrases) over the latest window.
 */
export function risingMoves(
  horizon: string,
  lead: Pick<LeadSeries, "measure" | "id" | "direction">[],
  weeks: string[],
  window: number,
): (Move & { searches: string[] })[] {
  const span = latestSpan(weeks, window);
  if (!span) return [];
  return lead.flatMap((s) => {
    if (s.direction !== "rising") return [];
    const series = seriesOf(s.measure);
    const searches = series === "topic" ? TOPICS.find((t) => t.id === s.id)?.arxiv : THEMES.find((t) => t.id === s.id)?.hn;
    return searches ? [{ horizon, series, id: s.id, ...span, searches }] : [];
  });
}

/** The list kept for one move on one view, if it was collected over the window the page now shows. */
export function countedFor(file: CountedFile | null, horizon: string, series: Series, id: string, span: Span | null): CountedMove | null {
  if (!file || !span) return null;
  const move = file.moves.find(
    (m) => m.horizon === horizon && m.series === series && m.id === id && m.first === span.first && m.last === span.last,
  );
  if (!move) return null;
  const items = "stories" in move ? move.stories : move.papers;
  return items.length > 0 ? move : null;
}
