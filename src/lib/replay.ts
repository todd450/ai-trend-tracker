/**
 * The track record for one view, replayed at build time from the stored weekly counts: each past
 * week is read as that week's page would have read it (`buildTrends(horizon, asOf)`), with today's
 * rules and today's counts, and the rules in record.ts turn those readings into tallies.
 */
import { READINGS_NEEDED, callsChecked, trackRecord, weeksNeeded, type Reading } from "./record";
import { HORIZONS, buildTrends, everyWeek, type Horizon } from "./trends";

/** A past week's calls on research topics and themes, or null when the view had too little history that week. */
function readingAsOf(horizon: Horizon, week: string): Reading | null {
  const t = buildTrends(horizon, week);
  if (!t.hasHistory) return null;
  return [
    ...t.topicTrends.map((topic) => ({ series: "topic" as const, key: topic.id, name: topic.name, direction: topic.direction, share: topic.papers.recent })),
    ...(t.hasThemes
      ? t.themeTrends.map((theme) => ({ series: "theme" as const, key: theme.id, name: theme.name, direction: theme.direction, share: theme.share.recent }))
      : []),
  ];
}

/**
 * The view's record, the readings behind it, and the calls checked by name: those due in the latest
 * week, or the most recent week that had any. `weeks[i]` is the Monday of `readings[i]`.
 */
export function replayRecord(horizon: Horizon) {
  const needed = weeksNeeded(HORIZONS[horizon].window);
  const stored = everyWeek.length;
  // A view without the weeks for a whole record is not replayed at all.
  const weeks = stored >= needed ? everyWeek.slice(-READINGS_NEEDED) : [];
  const readings = weeks.map((week) => readingAsOf(horizon, week));
  const record = trackRecord(readings);
  return { record, readings, weeks, checked: record ? callsChecked(readings) : null, needed, stored };
}
