/**
 * Turns OpenRouter's daily model rankings into weekly token totals per model maker.
 * Kept apart from the collector so it can be tested without a network or an account key.
 */

/** One row of OpenRouter's `rankings-daily` dataset. `total_tokens` is a string of digits. */
export type RankingRow = { date?: unknown; model_permaslug?: unknown; total_tokens?: unknown };

export type MakerWeek = { week: string; tokens: Record<string, number> };

/** How many makers a week names; the rest are summed under "Others". */
export const MAKERS_NAMED = 9;
export const OTHER_MAKERS = "Others";

const DAY = 86_400_000;

/** The Monday (UTC) of the week a day falls in. */
function mondayOf(day: string): string {
  const at = Date.parse(`${day}T00:00:00Z`);
  const sinceMonday = (new Date(at).getUTCDay() + 6) % 7;
  return new Date(at - sinceMonday * DAY).toISOString().slice(0, 10);
}

/**
 * Weekly tokens by maker, for every week in which all seven days are present.
 *
 * The maker is the part of a model's name before the slash ("openai/gpt-…" → "openai").
 * Each day lists only its 50 largest models and sums the rest in one "other" row, so a
 * maker's total leaves out any of its models below that line. Each week keeps its nine
 * largest makers by name; smaller makers and the "other" rows go under "Others".
 */
export function weeklyMakerTokens(rows: RankingRow[]): MakerWeek[] {
  const weeks = new Map<string, { days: Set<string>; makers: Map<string, number>; other: number }>();
  for (const row of rows) {
    if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (typeof row.model_permaslug !== "string" || !row.model_permaslug) continue;
    const tokens = Number(row.total_tokens);
    if (!Number.isFinite(tokens) || tokens < 0) continue;

    const monday = mondayOf(row.date);
    let week = weeks.get(monday);
    if (!week) weeks.set(monday, (week = { days: new Set(), makers: new Map(), other: 0 }));
    week.days.add(row.date);

    const slash = row.model_permaslug.indexOf("/");
    if (slash <= 0) {
      week.other += tokens; // the "other" row, or a name with no maker
    } else {
      const maker = row.model_permaslug.slice(0, slash);
      week.makers.set(maker, (week.makers.get(maker) ?? 0) + tokens);
    }
  }

  return [...weeks.entries()]
    .filter(([, week]) => week.days.size === 7)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monday, week]) => {
      const ranked = [...week.makers.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const others = ranked.slice(MAKERS_NAMED).reduce((sum, [, tokens]) => sum + tokens, week.other);
      const tokens = Object.fromEntries(ranked.slice(0, MAKERS_NAMED));
      if (others > 0) tokens[OTHER_MAKERS] = others;
      return { week: monday, tokens };
    });
}
