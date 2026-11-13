/**
 * The week in five numbers. Every figure and sentence is written by a fixed rule
 * from the collected data, so the same data always produces the same briefing.
 */
import { federal, fmtMonth, jobs, releases } from "./indicators";
import { HORIZONS, type Direction, type Signal, type Trends } from "./trends";

/** One line of the briefing: the figure it leads with, then the sentence that says what the figure is. */
export type BriefingLine = { label: string; href: string; figure: string; text: string };

/** One of the movers the headline names, with the weekly series behind the claim, for the chart under it. */
export type LeadSeries = {
  /** What is measured: "Research" or "Hacker News discussion". */
  measure: string;
  name: string;
  /** Completes "0.9% …": "of AI papers". */
  unit: string;
  signal: Signal;
  direction: Direction;
};

const pct = (change: number | null) => `${Math.round(Math.abs(change ?? 0) * 100)}%`;

/** "Jobs & labor" reads as "jobs & labor" mid-sentence; names that open with an acronym keep their capitals. */
const inSentence = (name: string) => (/^[A-Z]{2,}\b/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

/** Leads with the biggest riser's change, or the biggest faller's when nothing rose. */
function movers(
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

/** The headline and the five lines for one time horizon. */
export function buildBriefing({ horizon, hasHistory, hasThemes, rankedTopics, themeTrends }: Trends) {
  // Both lists run biggest rise first. A big change that is only the series' usual wobble is called
  // steady, so the mover named is the largest one that is called, not simply the first in the list.
  const topTopic = hasHistory ? (rankedTopics.find((t) => t.direction === "rising") ?? rankedTopics[0]) : undefined;
  const bottomTopic = hasHistory
    ? (rankedTopics.findLast((t) => t.direction === "cooling") ?? rankedTopics.at(-1))
    : undefined;
  const topTheme = hasThemes ? (themeTrends.find((t) => t.direction === "rising") ?? themeTrends[0]) : undefined;
  const bottomTheme = hasThemes
    ? (themeTrends.findLast((t) => t.direction === "cooling") ?? themeTrends.at(-1))
    : undefined;

  /** The series behind each sentence of the headline, in the same order. */
  const researchMover =
    topTopic?.direction === "rising" ? topTopic : bottomTopic?.direction === "cooling" ? bottomTopic : undefined;
  const discussionMover =
    topTheme?.direction === "rising" ? topTheme : bottomTheme?.direction === "cooling" ? bottomTheme : undefined;
  const lead: LeadSeries[] = [
    ...(researchMover
      ? [{ measure: "Research", name: researchMover.name, unit: "of AI papers", signal: researchMover.papers, direction: researchMover.direction }]
      : []),
    ...(discussionMover
      ? [{ measure: "Hacker News discussion", name: discussionMover.name, unit: "of AI stories", signal: discussionMover.share, direction: discussionMover.direction }]
      : []),
  ];

  /**
   * The page headline states the finding, figures included: what each named mover's share was
   * and what it is now, so the sentence says what the chart under it shows. A measure with no clear
   * mover gets no sentence, and with none at all the headline only names the page. Discussion is
   * named for its one source, so the sentence does not claim more than Hacker News can show.
   */
  const finding = (mover: LeadSeries, opening: string) => {
    const { recent, prior } = mover.signal;
    // One decimal place, unless that would print the same figure twice.
    const places = recent.toFixed(1) === prior.toFixed(1) ? 2 : 1;
    const name = opening ? `${opening} ${inSentence(mover.name)}` : mover.name;
    return `${name} ${recent >= prior ? "rose" : "fell"} to ${recent.toFixed(places)}% ${mover.unit}, from ${prior.toFixed(places)}%.`;
  };
  const sentences = lead.map((mover) => finding(mover, mover.measure === "Research" ? "" : "On Hacker News,"));
  const headline: { lead: string; turn?: string } =
    sentences.length > 0
      ? { lead: sentences[0], turn: sentences[1] }
      : { lead: `Where attention in AI is moving ${HORIZONS[horizon].when}.` };

  const lines: (BriefingLine | null)[] = [
    hasHistory
      ? {
          label: "Research",
          href: "#momentum",
          ...movers(
            topTopic && { name: topTopic.name, change: topTopic.papers.change, rising: topTopic.direction === "rising" },
            bottomTopic && {
              name: bottomTopic.name,
              change: bottomTopic.papers.change,
              cooling: bottomTopic.direction === "cooling",
            },
            "share of AI papers",
            "No large topic’s share of AI papers made a clear move.",
          ),
        }
      : null,
    hasThemes
      ? {
          label: "Hacker News",
          href: "#themes",
          ...movers(
            topTheme && { name: topTheme.name, change: topTheme.share.change, rising: topTheme.direction === "rising" },
            bottomTheme && {
              name: bottomTheme.name,
              change: bottomTheme.share.change,
              cooling: bottomTheme.direction === "cooling",
            },
            "share of AI stories on Hacker News",
            "No theme’s share of AI stories on Hacker News made a clear move.",
          ),
        }
      : null,
    jobs
      ? {
          label: "Economy",
          href: "#indicators",
          figure: `${jobs.signal.recent.toFixed(1)}%`,
          text: `of US job postings ask for AI skills, ${
            jobs.signal.recent >= jobs.signal.prior ? "up" : "down"
          } from ${jobs.signal.prior.toFixed(1)}% a year earlier.`,
        }
      : null,
    releases
      ? {
          label: "Releases",
          href: "#indicators",
          figure: String(releases.signal.recent),
          text: (() => {
            const newest = [...releases.shown].sort((a, b) => b.date.localeCompare(a.date))[0];
            const count = releases.signal.recent;
            return `frontier model ${count === 1 ? "version" : "versions"} in the last 90 days, against ${
              releases.signal.prior
            } in the 90 days before.${newest ? ` Most recent: ${newest.model}.` : ""}`;
          })(),
        }
      : null,
    federal
      ? {
          label: "Policy",
          href: "#indicators",
          figure: String(federal.signal.recent),
          text: `US federal documents mentioned AI in ${fmtMonth(federal.latestMonth)}, against ${
            federal.signal.prior
          } a year earlier.`,
        }
      : null,
  ];

  return { headline, lead, briefing: lines.filter((line): line is BriefingLine => line !== null) };
}
