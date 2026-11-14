/**
 * The track record for one view, replayed at build time from the stored weekly counts: each past
 * week is read as that week's page would have read it (`buildTrends(horizon, asOf)`), with today's
 * rules and today's counts, and the rules in record.ts turn those readings into tallies.
 */
import { READINGS_NEEDED, trackRecord, weeksNeeded, type Reading } from "./record";
import { HORIZONS, buildTrends, everyWeek, type Horizon } from "./trends";

/** A past week's calls on research topics and themes, or null when the view had too little history that week. */
function readingAsOf(horizon: Horizon, week: string): Reading | null {
  const t = buildTrends(horizon, week);
  if (!t.hasHistory) return null;
  return [
    ...t.topicTrends.map((topic) => ({ series: "topic" as const, key: topic.id, direction: topic.direction, share: topic.papers.recent })),
    ...(t.hasThemes
      ? t.themeTrends.map((theme) => ({ series: "theme" as const, key: theme.id, direction: theme.direction, share: theme.share.recent }))
      : []),
  ];
}

export function replayRecord(horizon: Horizon) {
  const needed = weeksNeeded(HORIZONS[horizon].window);
  const stored = everyWeek.length;
  // A view without the weeks for a whole record is not replayed at all.
  const readings = stored >= needed ? everyWeek.slice(-READINGS_NEEDED).map((week) => readingAsOf(horizon, week)) : [];
  return { record: trackRecord(readings), readings, needed, stored };
}
