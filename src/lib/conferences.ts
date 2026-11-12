import conferencesJson from "../../data/conferences.json";
import { TOPICS } from "./topics";
import { buildTrends, latest, type Direction, type Horizon, type TopicTrend } from "./trends";
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

/** "11–13 November 2026", "30 November – 6 December 2026" or "4 May 2027". */
export function fmtSpan(start: string, end: string): string {
  const a = new Date(start + "T00:00:00Z");
  const b = new Date(end + "T00:00:00Z");
  if (start === end) return `${a.getUTCDate()} ${monthName(a)} ${a.getUTCFullYear()}`;
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${monthName(b)} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${monthName(a)} – ${b.getUTCDate()} ${monthName(b)} ${b.getUTCFullYear()}`;
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
export type Reading = "agree" | "loud-flat" | "stage-ahead" | "numbers-ahead" | "quiet" | "none";

export const READING_LABEL: Record<Reading, string> = {
  agree: "Loud here and rising in the numbers",
  "loud-flat": "Loud here, flat in the numbers",
  "stage-ahead": "Louder here than in the numbers",
  "numbers-ahead": "Rising, but little heard here",
  quiet: "Quiet on both",
  none: "",
};

export type StageRow = {
  topic: TopicTrend;
  mentions: number;
  /** Part of all topic mentions in the talks, 0 to 1. */
  share: number;
  /** The direction of the topic's research share, and of its Hacker News stories. */
  research: Direction;
  discussion: Direction;
  reading: Reading;
  points: StagePoint[];
};

/**
 * One row per tracked topic: how much of the stage it took, set against how its
 * research and discussion counts are moving over the given horizon. Loudest first.
 */
export function stageAgainstTrends(c: Conference, horizon: Horizon = "threeMonths"): StageRow[] {
  const { topicTrends } = buildTrends(horizon);
  const mentions = c.stage?.mentions ?? {};
  const total = TOPICS.reduce((sum, t) => sum + (mentions[t.id] ?? 0), 0);
  return topicTrends
    .map((topic) => {
      const n = mentions[topic.id] ?? 0;
      const share = total > 0 ? n / total : 0;
      const research = topic.direction;
      const stories = topic.stories.change;
      const discussion: Direction =
        stories === null || Math.round(Math.abs(stories) * 100) < 10 ? "steady" : stories > 0 ? "rising" : "cooling";
      const rising = research === "rising" || discussion === "rising";
      const cooling = !rising && (research === "cooling" || discussion === "cooling");
      const loud = share >= STAGE_LOUD;
      const quiet = share < STAGE_QUIET;
      const reading: Reading =
        total === 0
          ? "none"
          : loud && rising
            ? "agree"
            : loud && cooling
              ? "stage-ahead"
              : loud
                ? "loud-flat"
                : quiet && rising
                ? "numbers-ahead"
                : quiet && cooling
                  ? "quiet"
                  : "none";
      return {
        topic,
        mentions: n,
        share,
        research,
        discussion,
        reading,
        points: (c.recap?.points ?? []).filter((p) => p.topic === topic.id),
      };
    })
    .sort((a, b) => b.mentions - a.mentions || a.topic.name.localeCompare(b.topic.name));
}
