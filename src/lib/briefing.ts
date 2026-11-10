/**
 * The week in five lines. Every sentence is written by a fixed rule from the
 * collected data, so the same data always produces the same briefing.
 */
import { federal, fmtMonth, jobs, releases } from "./indicators";
import { hasHistory, hasThemes, rankedTopics, themeTrends } from "./trends";

export type BriefingLine = { label: string; href: string; text: string };

const pct = (change: number | null) => `${Math.round(Math.abs(change ?? 0) * 100)}%`;

/** "Jobs & labor" reads as "jobs & labor" mid-sentence; names that open with an acronym keep their capitals. */
const inSentence = (name: string) => (/^[A-Z]{2,}\b/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

/** One sentence for the biggest riser and one for the biggest faller, when there is one. */
function movers(
  top: { name: string; change: number | null; rising: boolean } | undefined,
  bottom: { name: string; change: number | null; cooling: boolean } | undefined,
  measure: string,
  nothing: string,
) {
  const parts: string[] = [];
  if (top?.rising) parts.push(`${top.name} gained ${pct(top.change)} in ${measure}.`);
  if (bottom?.cooling) parts.push(`${bottom.name} fell ${pct(bottom.change)}${parts.length ? "" : ` in ${measure}`}.`);
  return parts.length ? parts.join(" ") : nothing;
}

const topTopic = hasHistory ? rankedTopics[0] : undefined;
const bottomTopic = hasHistory ? rankedTopics.at(-1) : undefined;
const topTheme = hasThemes ? themeTrends[0] : undefined;
const bottomTheme = hasThemes ? themeTrends.at(-1) : undefined;

/** The page headline: where research and where discussion are heading, when both have a clear riser. */
export const headline: { lead: string; turn?: string } =
  topTopic?.direction === "rising" && topTheme?.direction === "rising"
    ? {
        lead: `Research is moving toward ${inSentence(topTopic.name)}.`,
        turn: `Discussion is moving toward ${inSentence(topTheme.name)}.`,
      }
    : topTopic?.direction === "rising" && bottomTopic?.direction === "cooling"
      ? { lead: `On the rise: ${topTopic.name}.`, turn: `Losing ground: ${bottomTopic.name}.` }
      : { lead: "Where attention in AI is moving this week." };

const lines: (BriefingLine | null)[] = [
  hasHistory
    ? {
        label: "Research",
        href: "#momentum",
        text: movers(
          topTopic && { name: topTopic.name, change: topTopic.papers.change, rising: topTopic.direction === "rising" },
          bottomTopic && {
            name: bottomTopic.name,
            change: bottomTopic.papers.change,
            cooling: bottomTopic.direction === "cooling",
          },
          "share of AI papers",
          "No large topic’s share of AI papers moved by more than 10%.",
        ),
      }
    : null,
  hasThemes
    ? {
        label: "Discussion",
        href: "#themes",
        text: movers(
          topTheme && { name: topTheme.name, change: topTheme.share.change, rising: topTheme.direction === "rising" },
          bottomTheme && {
            name: bottomTheme.name,
            change: bottomTheme.share.change,
            cooling: bottomTheme.direction === "cooling",
          },
          "share of AI stories",
          "No theme’s share of AI stories moved by more than 15%.",
        ),
      }
    : null,
  jobs
    ? {
        label: "Economy",
        href: "#indicators",
        text: `${jobs.signal.recent.toFixed(1)}% of US job postings ask for AI skills, ${
          jobs.signal.recent >= jobs.signal.prior ? "up" : "down"
        } from ${jobs.signal.prior.toFixed(1)}% a year earlier.`,
      }
    : null,
  releases
    ? {
        label: "Releases",
        href: "#indicators",
        text: (() => {
          const newest = [...releases.shown].sort((a, b) => b.date.localeCompare(a.date))[0];
          const count = releases.signal.recent;
          return `${count} frontier model ${count === 1 ? "version" : "versions"} in the last 90 days, against ${
            releases.signal.prior
          } in the 90 days before.${newest ? ` Most recent: ${newest.model}.` : ""}`;
        })(),
      }
    : null,
  federal
    ? {
        label: "Policy",
        href: "#indicators",
        text: `${federal.signal.recent} US federal documents mentioned AI in ${fmtMonth(federal.latestMonth)}, against ${
          federal.signal.prior
        } a year earlier.`,
      }
    : null,
];

export const briefing = lines.filter((line): line is BriefingLine => line !== null);
