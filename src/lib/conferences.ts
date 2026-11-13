import conferencesJson from "../../data/conferences.json";
import { TOPICS } from "./topics";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  STEADY_BAND,
  buildTrends,
  latest,
  signalDirection,
  type Direction,
  type Horizon,
  type TopicTrend,
} from "./trends";
import type { Conference, ConferenceFile, StagePoint } from "./types";

/** Every conference on the calendar, earliest first. */
export const conferences: Conference[] = [...(conferencesJson as unknown as ConferenceFile).conferences].sort((a, b) =>
  a.start.localeCompare(b.start),
);

/**
 * The page is built ahead of time, so "today" is the day the data was last collected.
 * The collector runs daily and each run rebuilds the site, which moves events from
 * upcoming to passed without anyone editing the calendar.
 */
export const today = latest.generatedAt.slice(0, 10);

/** Where an event is in its life: not yet held, being held, held but not watched, watched in part, or watched. */
export type Phase = "upcoming" | "underway" | "awaiting" | "partly" | "watched";

/**
 * The dates decide first: a recap written while an event is still running (after its
 * first day, say) does not make the event over. Once it has ended, a recap marked
 * `partial` keeps it from being called watched until the rest has been read.
 */
export function phaseOf(c: Conference): Phase {
  if (today < c.start) return "upcoming";
  if (today <= c.end) return "underway";
  if (!c.recap) return "awaiting";
  return c.recap.partial ? "partly" : "watched";
}

const DAY = 86_400_000;
const utc = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

/** Whole days from the collection date to the event's first day. */
export const daysUntil = (c: Conference) => Math.round((utc(c.start) - utc(today)) / DAY);

const monthName = (d: Date, month: "short" | "long" = "long") => d.toLocaleString("en-GB", { month, timeZone: "UTC" });

/**
 * "11–13 Nov 2026", "30 Nov – 6 Dec 2026" or "4 May 2027". Without the year ("11–13 Nov") where a
 * heading above already gives it.
 */
export function fmtSpan(start: string, end: string, { year = true }: { year?: boolean } = {}): string {
  const a = new Date(start + "T00:00:00Z");
  const b = new Date(end + "T00:00:00Z");
  const tail = `${monthName(b, "short")}${year ? ` ${b.getUTCFullYear()}` : ""}`;
  if (start === end) return `${b.getUTCDate()} ${tail}`;
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${tail}`
    : `${a.getUTCDate()} ${monthName(a, "short")} – ${b.getUTCDate()} ${tail}`;
}

/** "November 2026", the heading a calendar month is listed under. */
export const fmtMonthOf = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${monthName(d)} ${d.getUTCFullYear()}`;
};

/** A topic took a large part of the stage at this share of all topic mentions, and a small part below the other. */
export const STAGE_LOUD = 0.1;
export const STAGE_QUIET = 0.02;

/** How the stage and the tracker's counts compare for one topic. */
export type Reading =
  | "agree"
  | "loud-flat"
  | "loud-mixed"
  | "loud-thin"
  | "stage-ahead"
  | "numbers-ahead"
  | "quiet"
  | "none";

export const READING_LABEL: Record<Reading, string> = {
  agree: "Loud here and rising in the numbers",
  "loud-flat": "Loud here, flat in the numbers",
  "loud-mixed": "Loud here, mixed in the numbers",
  "loud-thin": "Loud here, too few to call in the numbers",
  "stage-ahead": "Louder here than in the numbers",
  "numbers-ahead": "Rising, but little heard here",
  quiet: "Quiet on both",
  none: "",
};

/** What the trusted counts say together: one way, both ways at once, nothing, or too little to say. */
type Numbers = "rising" | "cooling" | "mixed" | "flat" | "thin";

export type StageRow = {
  topic: TopicTrend;
  mentions: number;
  /** Part of all topic mentions in the talks, 0 to 1. */
  share: number;
  /** The direction of the topic's research share, and of its Hacker News stories. */
  research: Direction;
  discussion: Direction;
  /**
   * False when the count behind a direction is below the front page's minimum
   * (HEADLINE_MIN_PAPERS, MAP_MIN_STORIES). Such a change is shown but never
   * decides the reading: a move from 3 stories a week to 7 is not a trend.
   */
  researchFirm: boolean;
  discussionFirm: boolean;
  reading: Reading;
  points: StagePoint[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * One row per tracked topic: how much of the stage it took, set against how its
 * research and discussion counts are moving over the given horizon. Loudest first.
 * Only counts large enough for the front page to trust can make a topic rising or
 * cooling here, so the two pages never disagree about the same topic.
 */
export function stageAgainstTrends(c: Conference, horizon: Horizon = "threeMonths"): StageRow[] {
  const { topicTrends } = buildTrends(horizon);
  const { window } = HORIZONS[horizon];
  const mentions = c.stage?.mentions ?? {};
  const total = TOPICS.reduce((sum, t) => sum + (mentions[t.id] ?? 0), 0);
  return topicTrends
    .map((topic) => {
      const n = mentions[topic.id] ?? 0;
      const share = total > 0 ? n / total : 0;
      const research = topic.direction;
      const discussion = signalDirection(topic.stories, STEADY_BAND);
      const researchFirm = topic.hasPapers && mean(topic.paperCounts.slice(-window)) >= HEADLINE_MIN_PAPERS;
      const discussionFirm =
        topic.stories.change !== null && mean(topic.stories.values.slice(-2 * window)) >= MAP_MIN_STORIES;
      const firm = [researchFirm ? research : null, discussionFirm ? discussion : null].filter((d) => d !== null);
      const up = firm.includes("rising");
      const down = firm.includes("cooling");
      const numbers: Numbers =
        firm.length === 0 ? "thin" : up && down ? "mixed" : up ? "rising" : down ? "cooling" : "flat";
      const loud = share >= STAGE_LOUD;
      const quiet = share < STAGE_QUIET;
      const LOUD: Record<Numbers, Reading> = {
        rising: "agree",
        cooling: "stage-ahead",
        mixed: "loud-mixed",
        flat: "loud-flat",
        thin: "loud-thin",
      };
      const reading: Reading =
        total === 0
          ? "none"
          : loud
            ? LOUD[numbers]
            : quiet && numbers === "rising"
              ? "numbers-ahead"
              : quiet && numbers === "cooling"
                ? "quiet"
                : "none";
      return {
        topic,
        mentions: n,
        share,
        research,
        discussion,
        researchFirm,
        discussionFirm,
        reading,
        points: (c.recap?.points ?? []).filter((p) => p.topic === topic.id),
      };
    })
    .sort((a, b) => b.mentions - a.mentions || a.topic.name.localeCompare(b.topic.name));
}
