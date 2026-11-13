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

  /** One sentence on where a measure is heading: toward its clearest riser, or away from its clearest faller. */
  const heading = (
    subject: string,
    top: { name: string; direction: string } | undefined,
    bottom: { name: string; direction: string } | undefined,
  ) =>
    top?.direction === "rising"
      ? `${subject} is moving toward ${inSentence(top.name)}.`
      : bottom?.direction === "cooling"
        ? `${subject} is moving away from ${inSentence(bottom.name)}.`
        : undefined;

  /**
   * The page headline: where research and where discussion are heading. A measure with no clear
   * mover gets no sentence, and with none at all the headline only names the page. Discussion is
   * named for its one source, so the sentence does not claim more than Hacker News can show.
   */
  const research = heading("Research", topTopic, bottomTopic);
  const discussion = heading("Hacker News discussion", topTheme, bottomTheme);
  const headline: { lead: string; turn?: string } = research
    ? { lead: research, turn: discussion }
    : discussion
      ? { lead: discussion }
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

  return { headline, briefing: lines.filter((line): line is BriefingLine => line !== null) };
}
