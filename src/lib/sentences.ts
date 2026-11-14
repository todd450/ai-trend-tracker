/**
 * The rules that write the headline and the briefing sentences. Every sentence is produced by a
 * fixed rule from the figures, so the same data always gives the same words. Nothing here reads
 * the data files, so the rules can be tested on their own (scripts/sentences.test.ts).
 */
import type { Direction, Signal } from "./calls";

/** One of the movers the headline names, with the weekly series behind the claim, for the chart under it. */
export type LeadSeries = {
  /** What is measured: "Research" or "Hacker News discussion". */
  measure: string;
  /** The topic's or theme's id. */
  id: string;
  name: string;
  /** Completes "0.9% …": "of AI papers". */
  unit: string;
  signal: Signal;
  direction: Direction;
};

export const pct = (change: number | null) => `${Math.round(Math.abs(change ?? 0) * 100)}%`;

/** "Jobs & labor" reads as "jobs & labor" mid-sentence; names that open with an acronym keep their capitals. */
export const inSentence = (name: string) => (/^[A-Z]{2,}\b/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

/** Leads with the biggest riser's change, or the biggest faller's when nothing rose. */
export function movers(
  top: { name: string; change: number | null; rising: boolean } | undefined,
  bottom: { name: string; change: number | null; cooling: boolean } | undefined,
  measure: string,
  nothing: string,
): { figure: string; text: string } {
  if (top?.rising) {
    return {
      figure: `+${pct(top.change)}`,
      text: `${top.name} rose as a ${measure}.${bottom?.cooling ? ` ${bottom.name} fell ${pct(bottom.change)}.` : ""}`,
    };
  }
  if (bottom?.cooling) return { figure: `−${pct(bottom.change)}`, text: `${bottom.name} fell as a ${measure}.` };
  return { figure: "Steady", text: nothing };
}

/**
 * From a list running biggest rise first: the largest riser that is actually called, and the
 * largest faller that is. A big change that is only the series' usual wobble is called steady, so
 * it is passed over; with nothing called, the two ends of the list are returned as they stand.
 */
export function ends<T extends { direction: Direction }>(list: T[]): [T | undefined, T | undefined] {
  return [
    list.find((t) => t.direction === "rising") ?? list[0],
    list.findLast((t) => t.direction === "cooling") ?? list.at(-1),
  ];
}

/** The one mover a measure's sentence is about: its clearest riser, or failing that its clearest faller. */
export function moverOf<T extends { direction: Direction }>(top: T | undefined, bottom: T | undefined): T | undefined {
  return top?.direction === "rising" ? top : bottom?.direction === "cooling" ? bottom : undefined;
}

/** "Voice & speech fell to 0.9% of AI papers, from 1.5%." Both figures, so the sentence says what the chart shows. */
export function finding(mover: LeadSeries, opening = ""): string {
  const { recent, prior } = mover.signal;
  // One decimal place, unless that would print the same figure twice.
  const places = recent.toFixed(1) === prior.toFixed(1) ? 2 : 1;
  const name = opening ? `${opening} ${inSentence(mover.name)}` : mover.name;
  return `${name} ${recent >= prior ? "rose" : "fell"} to ${recent.toFixed(places)}% ${mover.unit}, from ${prior.toFixed(places)}%.`;
}

/**
 * The page headline: one sentence per named mover, research first. A measure with no clear mover
 * gets no sentence, and with none at all the headline only names the page (`fallback`). Discussion
 * is named for its one source, so the sentence does not claim more than Hacker News can show.
 */
export function headlineOf(lead: LeadSeries[], fallback: string): { lead: string; turn?: string } {
  const sentences = lead.map((mover) => finding(mover, mover.measure === "Research" ? "" : "On Hacker News,"));
  return sentences.length > 0 ? { lead: sentences[0], turn: sentences[1] } : { lead: fallback };
}

/** How a trend's Hacker News discussion reads over one range, as its row on the site shows it. */
export type TrendReading = {
  name: string;
  /** The site's call: rising, steady, cooling, or one of its two ways of not calling a change. */
  call: string;
  /** Stories a week in the latest period and in the one before it. */
  recent: number;
  prior: number;
};

/** A count a week as the topics table prints it: whole from 10 up, one decimal place below. */
const perWeek = (v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));

/**
 * The line under the day's top story, labelled "The trend": "Gemini on Hacker News over three months:
 * rising, with 12 stories a week in the last 4 weeks against 8.0 in the 4 weeks before." It names
 * the range, says the site's own call and gives both figures the call is made on, nothing more.
 */
export function trendLine(r: TrendReading, range: { when: string; window: number }): string {
  const [now, before] =
    range.window === 1
      ? ["in the latest week", "in the week before"]
      : [`in the last ${range.window} weeks`, `in the ${range.window} weeks before`];
  return `${r.name} on Hacker News ${range.when}: ${r.call}, with ${perWeek(r.recent)} stories a week ${now} against ${perWeek(r.prior)} ${before}.`;
}
