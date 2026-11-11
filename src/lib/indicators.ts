import indicatorsJson from "../../data/indicators.json";
import { TOOLKITS, packageKey, packageKeys } from "./toolkits";
import { latest, type Signal } from "./trends";
import type { Indicators, Release } from "./types";

export const indicators = indicatorsJson as unknown as Indicators;

const DAY = 86_400_000;
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
export const fmtMonth = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));

/** The latest reading against the one twelve months before it. */
function yearOnYear(values: number[]): Signal {
  const recent = values.at(-1) ?? 0;
  const prior = values.at(-13) ?? 0;
  return { values: values.slice(-13), recent, prior, change: prior > 0 ? (recent - prior) / prior : null };
}

export const jobs = indicators.jobs && {
  asOf: indicators.jobs.asOf,
  labels: indicators.jobs.months.slice(-13).map((m) => fmtMonth(m.month)),
  signal: yearOnYear(indicators.jobs.months.map((m) => m.share)),
};

export const federal = indicators.federal && {
  latestMonth: indicators.federal.months.at(-1)?.month ?? "",
  labels: indicators.federal.months.slice(-13).map((m) => fmtMonth(m.month)),
  signal: yearOnYear(indicators.federal.months.map((m) => m.count)),
};

/** Days of releases shown, as six 30-day periods ending when the data was collected. */
const PERIOD_DAYS = 30;
const PERIODS = 6;

function releaseSummary(log: Release[]) {
  const end = Date.parse(latest.generatedAt);
  const age = (r: Release) => Math.floor((end - Date.parse(r.date)) / DAY);
  const shown = log.filter((r) => age(r) >= 0 && age(r) < PERIOD_DAYS * PERIODS);
  const values = Array.from({ length: PERIODS }, (_, i) => {
    const newest = (PERIODS - 1 - i) * PERIOD_DAYS; // period i covers ages [newest, newest + 30)
    return shown.filter((r) => age(r) >= newest && age(r) < newest + PERIOD_DAYS).length;
  });
  const recent = values.slice(-3).reduce((a, b) => a + b, 0);
  const prior = values.slice(0, 3).reduce((a, b) => a + b, 0);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const labels = values.map((_, i) => `30 days to ${day.format(new Date(end - (PERIODS - 1 - i) * PERIOD_DAYS * DAY))}`);
  return {
    shown,
    labels,
    signal: { values, recent, prior, change: prior > 0 ? (recent - prior) / prior : null } satisfies Signal,
  };
}

export const releases = indicators.releases && releaseSummary(indicators.releases.log);

/** Months in each half of the usage comparison: the latest three against the three before. */
export const USAGE_WINDOW = 3;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** The latest `window` readings against the same number before them; no change until both halves are filled. */
function halves(values: number[], window: number): Signal {
  const recent = mean(values.slice(-window));
  const prior = mean(values.slice(-window * 2, -window));
  const filled = values.length >= window * 2;
  return { values, recent, prior, change: filled && prior > 0 ? (recent - prior) / prior : null };
}

const quarterOnQuarter = (values: number[]) => halves(values, USAGE_WINDOW);

/**
 * Each toolkit's share of tracked downloads, over the months every package has a figure for.
 * Share is used because downloads as a whole keep growing, which would make every toolkit look like it is rising.
 *
 * The share is worked out inside each registry and the two are then averaged (a toolkit with no
 * package in a registry has 0% there), so the shares still add up to 100%. Adding the registries'
 * raw counts together would not do: when one registry changes how it counts, as PyPI's figures
 * did for every package in September 2026, each toolkit would move by how much it leans on that registry.
 */
function usageSummary(packages: Record<string, Record<string, number>>) {
  const keys = TOOLKITS.flatMap(packageKeys);
  if (keys.some((key) => !packages[key])) return null;
  const months = Object.keys(packages[keys[0]])
    .filter((month) => keys.every((key) => packages[key][month] !== undefined))
    .sort()
    .slice(-13);
  if (months.length < 2) return null;
  const sum = (ks: string[], month: string) => ks.reduce((total, key) => total + packages[key][month], 0);
  const registries = (["pypi", "npm"] as const).map((registry) => ({
    registry,
    totals: months.map((month) => sum(TOOLKITS.flatMap((t) => t[registry].map((name) => packageKey(registry, name))), month)),
  }));
  const toolkits = TOOLKITS.map((toolkit) => {
    const shares = months.map((month, i) =>
      mean(
        registries.map(({ registry, totals }) => {
          const count = sum(toolkit[registry].map((name) => packageKey(registry, name)), month);
          return totals[i] > 0 ? (count / totals[i]) * 100 : 0;
        }),
      ),
    );
    return {
      ...toolkit,
      /** Downloads in the latest complete month, both registries together. */
      downloads: sum(packageKeys(toolkit), months.at(-1)!),
      share: quarterOnQuarter(shares),
    };
  }).sort((a, b) => b.share.recent - a.share.recent);
  return {
    latestMonth: months.at(-1)!,
    labels: months.map(fmtMonth),
    /** Downloads of every tracked package in the latest complete month. */
    totalDownloads: sum(keys, months.at(-1)!),
    toolkits,
  };
}

export const usage = indicators.downloads ? usageSummary(indicators.downloads.packages) : null;

/** Two-week survey periods in each half of the business comparison: about three months against the three before. */
export const ADOPTION_WINDOW = 6;
/** Periods drawn in the trend line: a year of fortnights. */
const ADOPTION_SHOWN = 26;

function adoptionSummary(all: NonNullable<Indicators["business"]>["periods"]) {
  const periods = all.slice(-ADOPTION_SHOWN);
  const last = periods.at(-1);
  if (!last || periods.length < 2) return null;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const planned = periods.map((p) => p.planning);
  return {
    asOf: last.end,
    /** The earliest survey on record, which may be before the first one drawn. */
    since: all[0].end,
    labels: periods.map((p) => `2 weeks to ${day.format(new Date(`${p.end}T00:00:00Z`))}`),
    latest: { using: last.using, planning: last.planning },
    using: halves(periods.map((p) => p.using), ADOPTION_WINDOW),
    /** Left out if any period lacks the answer, so the line never joins across a gap. */
    planning: planned.every((v): v is number => v !== null) ? halves(planned, ADOPTION_WINDOW) : null,
  };
}

export const adoption = indicators.business ? adoptionSummary(indicators.business.periods) : null;
