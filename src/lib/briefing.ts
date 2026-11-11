/**
 * The week in five numbers. Every figure and sentence is written by a fixed rule
 * from the collected data, so the same data always produces the same briefing.
 */
import { federal, fmtMonth, jobs, releases } from "./indicators";
import { HORIZONS, type Trends } from "./trends";

/** One line of the briefing: the figure it leads with, then the sentence that says what the figure is. */
export type BriefingLine = { label: string; href: string; figure: string; text: string };

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
      text: `${top.name}: rise in ${measure}.${bottom?.cooling ? ` ${bottom.name} fell ${pct(bottom.change)}.` : ""}`,
    };
  }
  if (bottom?.cooling) return { figure: `−${pct(bottom.change)}`, text: `${bottom.name}: fall in ${measure}.` };
  return { figure: "Steady", text: nothing };
}

/** The headline and the five lines for one time horizon. */
export function buildBriefing({ horizon, hasHistory, hasThemes, rankedTopics, themeTrends }: Trends) {
  const topTopic = hasHistory ? rankedTopics[0] : undefined;
  const bottomTopic = hasHistory ? rankedTopics.at(-1) : undefined;
  const topTheme = hasThemes ? themeTrends[0] : undefined;
  const bottomTheme = hasThemes ? themeTrends.at(-1) : undefined;

  /** The page headline: where research and where discussion are heading, when both have a clear riser. */
  const headline: { lead: string; turn?: string } =
    topTopic?.direction === "rising" && topTheme?.direction === "rising"
      ? {
          lead: `Research is moving toward ${inSentence(topTopic.name)}.`,
          turn: `Discussion is moving toward ${inSentence(topTheme.name)}.`,
        }
      : topTopic?.direction === "rising" && bottomTopic?.direction === "cooling"
        ? { lead: `On the rise: ${topTopic.name}.`, turn: `Losing ground: ${bottomTopic.name}.` }
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
            "No large topic’s share of AI papers moved by 10% or more.",
          ),
        }
      : null,
    hasThemes
      ? {
          label: "Discussion",
          href: "#themes",
          ...movers(
            topTheme && { name: topTheme.name, change: topTheme.share.change, rising: topTheme.direction === "rising" },
            bottomTheme && {
              name: bottomTheme.name,
              change: bottomTheme.share.change,
              cooling: bottomTheme.direction === "cooling",
            },
            "share of AI stories",
            "No theme’s share of AI stories moved by 15% or more.",
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

  return { headline, briefing: lines.filter((line): line is BriefingLine => line !== null) };
}
