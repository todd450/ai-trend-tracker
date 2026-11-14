import historyJson from "../../data/history.json";
import latestJson from "../../data/latest.json";
import { compare, signalDirection, type Direction, type Signal } from "./calls";
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
 * The six readings of the same weekly counts. Each compares the latest `window`
 * weeks with the `window` weeks before and charts `shown` weeks, which is never
 * less than both sides of the comparison. The counts are weekly, so the shortest
 * comparison possible is one week against the week before.
 */
export type Horizon = "oneWeek" | "oneMonth" | "threeMonths" | "sixMonths" | "oneYear" | "twoYears";

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
  threeMonths: { label: "3 months", href: "/three-months", window: 4, shown: 12, when: "over three months" },
  sixMonths: { label: "6 months", href: "/six-months", window: 13, shown: 26, when: "over six months" },
  oneYear: { label: "1 year", href: "/one-year", window: 26, shown: 52, when: "over one year" },
  twoYears: { label: "2 years", href: "/two-years", window: 52, shown: 104, when: "over two years" },
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
  /** Phrases whose stories are left out of the count. */
  except: string[];
  /** Hacker News stories per week naming the product in the title. */
  stories: Signal;
  /** False when the story counts are too small for a change to mean anything. */
  enough: boolean;
  /** Views a day of the product's Wikipedia article; null when it has no article or a week is missing. */
  views: Signal | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Every completed week that has a paper total, oldest first. */
export const everyWeek = Object.keys(history.arxivTotal).sort();
const themeTotals = history.hnAiTotal ?? {};

/**
 * Everything the page shows that depends on how far back the comparison looks. With `asOf` (a
 * week's Monday), the reading is made as if that week were the latest.
 */
export function buildTrends(horizon: Horizon, asOf?: string) {
  const { window, shown } = HORIZONS[horizon];
  // The page reads every week on record. The feed asks what an earlier week's edition said,
  // which is the same reading with the later weeks left out.
  const allWeeks = asOf ? everyWeek.filter((w) => w <= asOf) : everyWeek;
  const weeks = allWeeks.slice(-shown);

  /**
   * `all` holds one value for each of `over`, the weeks the series was collected for, oldest first.
   * The page charts the last `shown`; the wobble is measured over all of them.
   */
  const signal = (all: number[]): Signal => compare(all, shown, window);
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
      except: product.hnExcept ?? [],
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

// The rules and the pure formatters live in calls.ts; they are passed on from here so the rest of
// the site has one place to import from.
export { directionOf, fmtChange, fmtWeek, heldBack, signalDirection } from "./calls";
export type { Direction, Signal } from "./calls";
