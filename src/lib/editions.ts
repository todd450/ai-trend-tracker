/**
 * The weekly editions the feed lists. The site keeps no archive of past pages, but it keeps every
 * week's counts, so an earlier edition's headline can be worked out again by reading the data as
 * of that week. It is the headline today's rules and today's stored counts give for that week,
 * which may differ in detail from what the page said at the time.
 */
import { buildBriefing } from "./briefing";
import { buildTrends, everyWeek, fmtWeek } from "./trends";

export type Edition = {
  /** The Monday the edition's week starts on (YYYY-MM-DD). */
  week: string;
  /** "Week of 2–8 November 2026" */
  name: string;
  /** The headline's sentences, as on the three-month view. */
  headline: string;
  /** When the week closed: the Monday after, at midnight UTC. */
  closed: string;
};

/** The newest `count` editions, newest first. */
export function editions(count = 8): Edition[] {
  return everyWeek
    .slice(-count)
    .reverse()
    .map((week) => {
      const { headline } = buildBriefing(buildTrends("threeMonths", week));
      return {
        week,
        name: `Week of ${fmtWeek(week)}`,
        headline: [headline.lead, headline.turn].filter(Boolean).join(" "),
        closed: new Date(Date.parse(week + "T00:00:00Z") + 7 * 86_400_000).toISOString(),
      };
    });
}
