/**
 * The week in five numbers. Every figure and sentence is written by a fixed rule
 * from the collected data, so the same data always produces the same briefing.
 */
import { federal, fmtMonth, jobs, releases } from "./indicators";
import { ends, headlineOf, moverOf, movers, type LeadSeries } from "./sentences";
import { HORIZONS, type Trends } from "./trends";

/** One line of the briefing: the figure it leads with, then the sentence that says what the figure is. */
export type BriefingLine = { label: string; href: string; figure: string; text: string };

/** The headline and the five lines for one time horizon. */
export function buildBriefing({ horizon, hasHistory, hasThemes, rankedTopics, themeTrends }: Trends) {
  // Both lists run biggest rise first; the mover named is the largest one that is actually called.
  const [topTopic, bottomTopic] = hasHistory ? ends(rankedTopics) : [undefined, undefined];
  const [topTheme, bottomTheme] = hasThemes ? ends(themeTrends) : [undefined, undefined];

  /** The series behind each sentence of the headline, in the same order. */
  const researchMover = moverOf(topTopic, bottomTopic);
  const discussionMover = moverOf(topTheme, bottomTheme);
  const lead: LeadSeries[] = [
    ...(researchMover
      ? [{ measure: "Research", name: researchMover.name, unit: "of AI papers", signal: researchMover.papers, direction: researchMover.direction }]
      : []),
    ...(discussionMover
      ? [{ measure: "Hacker News discussion", name: discussionMover.name, unit: "of AI stories", signal: discussionMover.share, direction: discussionMover.direction }]
      : []),
  ];

  const headline = headlineOf(lead, `Where attention in AI is moving ${HORIZONS[horizon].when}.`);

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

export type { LeadSeries } from "./sentences";
