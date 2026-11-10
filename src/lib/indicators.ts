import indicatorsJson from "../../data/indicators.json";
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
