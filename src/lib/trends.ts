import historyJson from "../../data/history.json";
import latestJson from "../../data/latest.json";
import { standsClear, weeklyNoise } from "./noise";
import { PRODUCTS, type Product } from "./products";
import { THEMES, subthemeKey } from "./themes";
import { TOPICS } from "./topics";
import type { History, Latest } from "./types";

export const history = historyJson as unknown as History;
export const latest = latestJson as unknown as Latest;

/** A change in paper share smaller than this (either way) is called steady. */
export const STEADY_BAND = 0.1;
/** Theme counts are small, so a theme needs a bigger move than a topic to be called rising or cooling. */
export const THEME_STEADY_BAND = 0.15;
/** Average papers a week a topic needs before the headline names it or its research bar is drawn solid. */
export const HEADLINE_MIN_PAPERS = 25;
/** Average Hacker News stories a week a topic needs before its discussion change is treated as firm. */
export const MAP_MIN_STORIES = 5;
/** Average stories a week a sub-theme needs, in both halves of the comparison, before it is called rising or cooling. */
export const SUBTHEME_MIN_STORIES = 3;
/** Average stories a week a product needs, in both halves of the comparison, before its discussion is called rising or cooling. */
export const PRODUCT_MIN_STORIES = 3;

/**
 * The five readings of the same weekly counts. Each compares the latest `window`
 * weeks with the `window` weeks before and charts `shown` weeks, which is never
 * less than both sides of the comparison. The counts are weekly, so the shortest
 * comparison possible is one week against the week before.
 */
export type Horizon = "oneWeek" | "oneMonth" | "threeMonths" | "sixMonths" | "oneYear";

export const HORIZONS: Record<
  Horizon,
  {
    /** The name on the switch. */
    label: string;
    href: string;
    window: number;
    shown: number;
    /** Closes the fallback headline: "Where attention in AI is moving this week." */
    when: string;
  }
> = {
  oneWeek: { label: "1 week", href: "/one-week", window: 1, shown: 4, when: "this week" },
  oneMonth: { label: "1 month", href: "/one-month", window: 2, shown: 8, when: "over one month" },
  threeMonths: { label: "3 months", href: "/", window: 4, shown: 12, when: "over three months" },
  sixMonths: { label: "6 months", href: "/six-months", window: 13, shown: 26, when: "over six months" },
  oneYear: { label: "1 year", href: "/one-year", window: 26, shown: 52, when: "over one year" },
};

export type Direction = "rising" | "steady" | "cooling";

export type Signal = {
  /** One value per week, oldest first. */
  values: number[];
  recent: number;
  prior: number;
  /** Relative change of `recent` against `prior`; null when there is no base to compare with. */
  change: number | null;
  /**
   * False when the change is no bigger than the series' own week-to-week wobble would produce
   * (see noise.ts), so it is not called a rise or a fall however large it looks. Absent on
   * series that are not weekly, which are judged by the fixed rule alone.
   */
  clear?: boolean;
};

export type TopicTrend = {
  id: string;
  name: string;
  blurb: string;
  /** Share of all AI papers on arXiv that mention the topic, in percent. */
  papers: Signal;
  /** Raw paper counts behind the share. */
  paperCounts: number[];
  /** Hacker News stories per week with the topic in the title. */
  stories: Signal;
  direction: Direction;
  /** False while a topic's paper counts have not been collected for every week. */
  hasPapers: boolean;
};

export type SubthemeTrend = {
  id: string;
  name: string;
  /** The title searches that define the sub-theme. */
  searches: string[];
  share: Signal;
  stories: Signal;
  direction: Direction;
  /** False when the counts are too small for a change to mean anything. */
  enough: boolean;
};

export type ThemeTrend = {
  id: string;
  name: string;
  blurb: string;
  /** Share of Hacker News stories with AI in the title that match the theme, in percent. */
  share: Signal;
  /** Distinct matching stories per week. */
  stories: Signal;
  direction: Direction;
  /** The theme's sub-themes, largest first; empty until their history has been collected. */
  parts: SubthemeTrend[];
};

export type ProductTrend = {
  id: string;
  name: string;
  kind: Product["kind"];
  blurb: string;
  /** The title searches behind the story count. */
  searches: string[];
  /** Hacker News stories per week naming the product in the title. */
  stories: Signal;
  /** False when the story counts are too small for a change to mean anything. */
  enough: boolean;
  /** Views a day of the product's Wikipedia article; null when it has no article or a week is missing. */
  views: Signal | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Judged on the whole percentage the page prints, so a figure shown as −10%
 * is never labelled steady when the rule says "at least 10%".
 */
export function directionOf(change: number | null, band: number): Direction {
  if (change === null || Math.round(Math.abs(change) * 100) < Math.round(band * 100)) return "steady";
  return change > 0 ? "rising" : "cooling";
}

/** The direction a signal is called: its change must pass the fixed rule and stand clear of its own wobble. */
export function signalDirection(signal: Signal, band: number): Direction {
  return signal.clear === false ? "steady" : directionOf(signal.change, band);
}

/** True for a change big enough to print as a rise or fall that is held back as wobble. */
export function heldBack(signal: Signal, band: number): boolean {
  return signal.clear === false && directionOf(signal.change, band) !== "steady";
}

/** Every completed week that has a paper total, oldest first. */
const allWeeks = Object.keys(history.arxivTotal).sort();
const themeTotals = history.hnAiTotal ?? {};

/** Everything the page shows that depends on how far back the comparison looks. */
export function buildTrends(horizon: Horizon) {
  const { window, shown } = HORIZONS[horizon];
  const weeks = allWeeks.slice(-shown);

  /**
   * `all` holds one value for each of `over`, the weeks the series was collected for, oldest first.
   * The page charts the last `shown`; the wobble is measured over all of them.
   */
  const signal = (all: number[]): Signal => {
    const values = all.slice(-shown);
    const recent = mean(values.slice(-window));
    const prior = mean(values.slice(-2 * window, -window));
    return {
      values,
      recent,
      prior,
      change: prior > 0 ? (recent - prior) / prior : null,
      clear: standsClear(recent - prior, weeklyNoise(all), window),
    };
  };
  /** The weeks a count was stored for: a series added this month has no earlier weeks to measure. */
  const collected = (counts: Record<string, number> | undefined) => {
    const first = allWeeks.findIndex((w) => counts?.[w] !== undefined);
    const have = first < 0 ? [] : allWeeks.slice(first);
    return have.length >= shown ? have : allWeeks.slice(-shown);
  };

  const topicTrends: TopicTrend[] = TOPICS.map((topic) => {
    const series = history.topics[topic.id] ?? { arxiv: {}, hn: {} };
    const paperCounts = weeks.map((w) => series.arxiv?.[w] ?? 0);
    const papers = signal(
      collected(series.arxiv).map((w) => {
        const total = history.arxivTotal[w];
        return total > 0 ? ((series.arxiv?.[w] ?? 0) / total) * 100 : 0;
      }),
    );
    const hasPapers = weeks.every((w) => series.arxiv?.[w] !== undefined);
    return {
      id: topic.id,
      name: topic.name,
      blurb: topic.blurb,
      papers,
      paperCounts,
      stories: signal(collected(series.hn).map((w) => series.hn?.[w] ?? 0)),
      direction: hasPapers ? signalDirection(papers, STEADY_BAND) : "steady",
      hasPapers,
    };
  }).sort((a, b) => Number(b.hasPapers) - Number(a.hasPapers) || (b.papers.change ?? 0) - (a.papers.change ?? 0));

  /** True once there are enough weeks to fill both sides of the comparison. */
  const hasHistory = weeks.length >= 2 * window;

  /** Topics with enough papers that a swing is not noise, biggest riser first. */
  const rankedTopics = topicTrends.filter(
    (t) => t.hasPapers && mean(t.paperCounts.slice(-window)) >= HEADLINE_MIN_PAPERS,
  );

  /** True once every week has both a theme count and an AI story total. */
  const hasThemes =
    hasHistory &&
    weeks.every((w) => themeTotals[w] !== undefined && THEMES.every((t) => history.themes?.[t.id]?.[w] !== undefined));

  const countsOf = (counts: Record<string, number> | undefined) =>
    signal(collected(counts).map((w) => counts?.[w] ?? 0));
  const shareOf = (counts: Record<string, number> | undefined) =>
    signal(collected(counts).map((w) => (themeTotals[w] > 0 ? ((counts?.[w] ?? 0) / themeTotals[w]) * 100 : 0)));

  const themeTrends: ThemeTrend[] = THEMES.map((theme) => {
    const share = shareOf(history.themes?.[theme.id]);
    const series = theme.parts.map((part) => history.subthemes?.[subthemeKey(theme.id, part.id)]);
    const collected = series.every((s) => s !== undefined && weeks.every((w) => s[w] !== undefined));
    const parts: SubthemeTrend[] = collected
      ? theme.parts
          .map((part, n) => {
            const partCounts = weeks.map((w) => series[n]?.[w] ?? 0);
            const partShare = shareOf(series[n]);
            const enough =
              mean(partCounts.slice(-window)) >= SUBTHEME_MIN_STORIES &&
              mean(partCounts.slice(-2 * window, -window)) >= SUBTHEME_MIN_STORIES;
            return {
              id: part.id,
              name: part.name,
              searches: part.hn,
              share: partShare,
              stories: countsOf(series[n]),
              direction: enough ? signalDirection(partShare, THEME_STEADY_BAND) : ("steady" as const),
              enough,
            };
          })
          .sort((a, b) => b.stories.recent - a.stories.recent)
      : [];
    return {
      id: theme.id,
      name: theme.name,
      blurb: theme.blurb,
      share,
      stories: countsOf(history.themes?.[theme.id]),
      direction: signalDirection(share, THEME_STEADY_BAND),
      parts,
    };
  }).sort((a, b) => (b.share.change ?? 0) - (a.share.change ?? 0));

  /** True once every product has a story count for every week shown. */
  const hasProducts =
    hasHistory && PRODUCTS.every((p) => weeks.every((w) => history.products?.[p.id]?.hn?.[w] !== undefined));

  const productTrends: ProductTrend[] = PRODUCTS.map((product) => {
    const series = history.products?.[product.id];
    const counts = weeks.map((w) => series?.hn?.[w] ?? 0);
    const hasViews = product.wiki.length > 0 && weeks.every((w) => series?.wiki?.[w] !== undefined);
    let views = hasViews ? signal(collected(series?.wiki).map((w) => Math.round((series?.wiki?.[w] ?? 0) / 7))) : null;
    // An article written part-way through the earlier period has no fair base to compare with.
    if (views && views.values.slice(-2 * window, -window).some((v) => v === 0)) views = { ...views, change: null };
    return {
      id: product.id,
      name: product.name,
      kind: product.kind,
      blurb: product.blurb,
      searches: product.hn,
      stories: signal(collected(series?.hn).map((w) => series?.hn?.[w] ?? 0)),
      enough:
        mean(counts.slice(-window)) >= PRODUCT_MIN_STORIES &&
        mean(counts.slice(-2 * window, -window)) >= PRODUCT_MIN_STORIES,
      views,
    };
  }).sort((a, b) => b.stories.recent - a.stories.recent || (b.views?.recent ?? 0) - (a.views?.recent ?? 0));

  return {
    horizon,
    window,
    weeks,
    topicTrends,
    rankedTopics,
    themeTrends,
    productTrends,
    hasHistory,
    hasThemes,
    hasProducts,
  };
}

export type Trends = ReturnType<typeof buildTrends>;

// ------------------------------------------------------------ formatting

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const dayTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
/** "12 Nov, 09:30", in UTC. */
export const fmtDayTime = (iso: string) => dayTime.format(new Date(iso));
export const fmtDay = (iso: string) => dayMonth.format(new Date(iso));
export const fmtDate = (iso: string) => fullDate.format(new Date(iso));
export const fmtCompact = (n: number) => (n < 10_000 ? n.toLocaleString("en") : compact.format(n));

export function fmtChange(change: number | null): string {
  if (change === null) return "new";
  const pct = Math.round(Math.abs(change) * 100);
  if (pct === 0) return "flat";
  return `${change > 0 ? "+" : "−"}${pct}%`;
}

/** "2–8 November 2026" for the week starting on the given Monday. */
export function fmtWeek(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return sameMonth
    ? `${start.getUTCDate()}–${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`
    : `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`;
}

/** ISO 8601 week number, used as the edition number. */
export function isoWeek(weekStart: string): number {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 3); // the week's Thursday decides which year it belongs to
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}
