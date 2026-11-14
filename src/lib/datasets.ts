/**
 * The site's datasets: the index on the front page, and the figures behind the topics page,
 * its table and its CSV file. Everything here is worked out from the same functions that build
 * the rest of the site and the MCP server, so a figure cannot differ between them.
 */
import {
  ADOPTION_WINDOW,
  USAGE_WINDOW,
  adoption as adoptionSummary,
  buildMarketShare,
  federal as federalSummary,
  fmtMonth,
  jobs as jobsSummary,
  usage,
} from "./indicators";
import { SITE_URL } from "./site";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  STEADY_BAND,
  THEME_STEADY_BAND,
  buildTrends,
  fmtCompact,
  fmtDate,
  fmtDay,
  heldBack,
  history,
  latest,
  signalDirection,
  type Direction,
  type Horizon,
  type Signal,
} from "./trends";

// ------------------------------------------------------------ addresses and ranges

/** "3-month", "1-week": the range as it reads before "view". */
export const rangeName = (horizon: Horizon) => HORIZONS[horizon].label.replace(/s$/, "").replace(" ", "-");

/** What a range compares, as the page says it: "the last 4 weeks compared with the 4 weeks before". */
export function comparedIn(horizon: Horizon) {
  const { window } = HORIZONS[horizon];
  return window === 1
    ? "the latest week compared with the week before"
    : `the last ${window} weeks compared with the ${window} weeks before`;
}

/**
 * The topics page for a range. The front page's range (3 months) has no range in its address;
 * the others carry the same name as the front page's own view, /data/topics/one-year for /one-year.
 */
export const topicsHref = (horizon: Horizon) => (horizon === "threeMonths" ? "/data/topics" : `/data/topics${HORIZONS[horizon].href}`);

// ------------------------------------------------------------ the topics table

/** What the site calls a change. "too few to call" and "too noisy to call" are its two ways of not calling one. */
export type Call = Direction | "too noisy to call" | "too few to call" | "not yet collected";

export type TableCell = {
  recent: number;
  prior: number;
  change: number | null;
  call: Call;
  /** Counts small enough that the change should be read with care. */
  few: boolean;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Every topic in one range as rows: the two periods compared, the change and how it is called,
 * for research and for discussion. Largest share of AI papers first, as on the graph.
 */
export function topicTable(horizon: Horizon) {
  const { topicTrends, window, weeks, hasHistory } = buildTrends(horizon);
  const rows = [...topicTrends]
    .sort((a, b) => Number(b.hasPapers) - Number(a.hasPapers) || b.papers.recent - a.papers.recent)
    .map((t) => {
      const papersFew = !(t.hasPapers && mean(t.paperCounts.slice(-window)) >= HEADLINE_MIN_PAPERS);
      const storiesFew = !(t.stories.change !== null && mean(t.stories.values.slice(-2 * window)) >= MAP_MIN_STORIES);
      const research: TableCell = {
        recent: t.papers.recent,
        prior: t.papers.prior,
        change: t.papers.change,
        call: !t.hasPapers ? "not yet collected" : heldBack(t.papers, STEADY_BAND) ? "too noisy to call" : t.direction,
        few: papersFew,
      };
      const discussion: TableCell = {
        recent: t.stories.recent,
        prior: t.stories.prior,
        change: t.stories.change,
        call: storiesFew
          ? "too few to call"
          : heldBack(t.stories, STEADY_BAND)
            ? "too noisy to call"
            : signalDirection(t.stories, STEADY_BAND),
        few: storiesFew,
      };
      return { id: t.id, name: t.name, research, discussion };
    });
  return { rows, window, weeks, hasHistory, compared: comparedIn(horizon) };
}

// ------------------------------------------------------------ the CSV file

/** The file's columns. Long form, so adding a topic or a source adds rows and never a column. */
const COLUMNS = ["week", "topic_id", "topic", "source", "count", "total", "share"] as const;

/** One CSV field, quoted only when it holds a comma, a quote or a line break. */
export function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Every week the paper totals were collected for, oldest first: the file holds all of them, whatever range is viewed. */
const allWeeks = Object.keys(history.arxivTotal).sort();

/**
 * The weekly figures behind the topics page, one row per topic and week. Only the arXiv counts:
 * arXiv's terms make its metadata free to reuse (CC0), but nothing in Hacker News's terms says
 * counts drawn from it may be handed out as a file, so its column stays on the page and out of the file.
 */
function topicRows(): (string | number)[][] {
  return allWeeks.flatMap((week) =>
    Object.entries(history.topics).flatMap(([id, series]) => {
      const count = series.arxiv?.[week];
      const total = history.arxivTotal[week];
      if (count === undefined || !(total > 0)) return [];
      const name = TOPIC_NAMES[id] ?? id;
      return [[week, id, name, "arxiv", count, total, Number((count / total).toFixed(6))]];
    }),
  );
}

const TOPIC_NAMES: Record<string, string> = Object.fromEntries(buildTrends("threeMonths").topicTrends.map((t) => [t.id, t.name]));

export function topicsCsv(): string {
  return [COLUMNS, ...topicRows()].map((row) => row.map(csvField).join(",")).join("\n") + "\n";
}

/** What the page says about the file before anyone downloads it. */
export const TOPICS_FILE = (() => {
  const text = topicsCsv();
  const lines = text.trimEnd().split("\n");
  return {
    href: "/data/topics.csv",
    rows: lines.length - 1,
    weeks: allWeeks.length,
    since: allWeeks[0],
    bytes: new TextEncoder().encode(text).length,
    /** The header and the first rows, as the file has them. */
    preview: lines.slice(0, 5),
    columns: COLUMNS,
  };
})();

/** How to cite one view of the topics page. */
export function topicsCitation(horizon: Horizon) {
  return (
    `AI Trend Tracker. “Topic momentum”, ${rangeName(horizon)} view: ${comparedIn(horizon)}. ` +
    `${SITE_URL}${topicsHref(horizon)}. Data collected ${fmtDate(latest.generatedAt)}.`
  );
}

// ------------------------------------------------------------ the index on the front page

/** A series that could be named as a dataset's biggest move. */
export type Candidate = {
  name: string;
  signal: Signal;
  /** False when the series is too small for a move in it to be trusted: the same floor the headline uses. */
  big: boolean;
  /** The smallest change the site calls a rise or a fall for this series. */
  band: number;
  /** Writes the sentence: "Voice & speech fell to 0.9% of AI papers, from 1.5%." */
  say?: (verb: "rose" | "fell") => string;
};

export type Move = { name: string; text: string; change: number; direction: Direction; values: number[] };

/** The largest change the site would call rising or cooling, among series big enough to trust; null when there is none. */
export function biggestMove(candidates: Candidate[]): Move | null {
  const called = candidates
    .filter((c) => c.big && c.signal.change !== null)
    .map((c) => ({ c, direction: signalDirection(c.signal, c.band) }))
    .filter(({ direction }) => direction !== "steady")
    .sort((a, b) => Math.abs(b.c.signal.change ?? 0) - Math.abs(a.c.signal.change ?? 0));
  const top = called[0];
  if (!top) return null;
  const { c, direction } = top;
  const verb = direction === "rising" ? "rose" : "fell";
  return {
    name: c.name,
    text: c.say ? c.say(verb) : `${c.name} ${verb}.`,
    change: c.signal.change ?? 0,
    direction,
    values: c.signal.values,
  };
}

/** Two shares, with one decimal place unless that would print the same figure twice, as the headline does. */
function shares(signal: Signal) {
  const places = signal.recent.toFixed(1) === signal.prior.toFixed(1) ? 2 : 1;
  return [signal.recent.toFixed(places), signal.prior.toFixed(places)];
}
const shareSentence = (name: string, signal: Signal, unit: string) => (verb: string) => {
  const [now, before] = shares(signal);
  return `${name} ${verb} to ${now}% ${unit}, from ${before}%.`;
};

/** Wikipedia views a day, in both halves, below which a product's change in views is not named. */
export const VIEWS_MIN_PER_DAY = 1000;
/** Share, in percent, below which a toolkit's or model maker's change is not named. */
export const SHARE_MIN_PCT = 1;

export type DatasetRow = {
  id: string;
  name: string;
  about: string;
  sources: string;
  href: string;
  /** The date of the newest figures, not the day they were collected. */
  latest: string;
  /** True when the dataset's comparison is fixed, so the range switch does not change it. */
  sameEverySpan: boolean;
  move: Move | null;
};

/** The seven datasets, in the order the front page lists them, with each one's biggest move in this range. */
export function datasetIndex(horizon: Horizon): DatasetRow[] {
  const { weeks, topicTrends, rankedTopics, themeTrends, productTrends, hasHistory, hasThemes, hasProducts } = buildTrends(horizon);
  const latestWeek = weeks.at(-1);
  const weekOf = latestWeek ? `Week of ${fmtDay(latestWeek)} ${latestWeek.slice(0, 4)}` : "Not yet collected";
  const ranked = new Set(rankedTopics.map((t) => t.id));
  const market = buildMarketShare(horizon);
  // Local names, so the null checks below hold inside the sentences' callbacks.
  const [jobs, federal, adoption] = [jobsSummary, federalSummary, adoptionSummary];

  return [
    {
      id: "topics",
      name: "Topic momentum",
      about: `${topicTrends.length} research topics, by their share of AI papers on arXiv and by the Hacker News stories that name them.`,
      sources: "arXiv; Hacker News",
      href: topicsHref(horizon),
      latest: weekOf,
      sameEverySpan: false,
      move: hasHistory
        ? biggestMove(
            topicTrends.map((t) => ({
              name: t.name,
              signal: t.papers,
              big: ranked.has(t.id),
              band: STEADY_BAND,
              say: shareSentence(t.name, t.papers, "of AI papers"),
            })),
          )
        : null,
    },
    {
      id: "themes",
      name: "Economy and society themes",
      about: `What Hacker News says AI is doing to work, companies and society: ${themeTrends.length} themes and ${themeTrends.reduce((n, t) => n + t.parts.length, 0)} sub-themes.`,
      sources: "Hacker News",
      href: "#themes",
      latest: weekOf,
      sameEverySpan: false,
      move: hasThemes
        ? biggestMove(
            themeTrends.map((t) => ({
              name: t.name,
              signal: t.share,
              big: true,
              band: THEME_STEADY_BAND,
              say: shareSentence(t.name, t.share, "of AI stories"),
            })),
          )
        : null,
    },
    {
      id: "products",
      name: "Product momentum",
      about: `${productTrends.length} AI products, from chat assistants to glasses and robots, by Hacker News stories and Wikipedia views.`,
      sources: "Hacker News; Wikipedia",
      href: "#products",
      latest: weekOf,
      sameEverySpan: false,
      move: hasProducts
        ? biggestMove(
            productTrends.flatMap((p) => [
              {
                name: p.name,
                signal: p.stories,
                big: p.enough,
                band: THEME_STEADY_BAND,
                say: (verb: string) =>
                  `${p.name} ${verb} to ${p.stories.recent.toFixed(1)} Hacker News stories a week, from ${p.stories.prior.toFixed(1)}.`,
              },
              ...(p.views
                ? [
                    {
                      name: p.name,
                      signal: p.views,
                      big: p.views.recent >= VIEWS_MIN_PER_DAY && p.views.prior >= VIEWS_MIN_PER_DAY,
                      band: STEADY_BAND,
                      say: (verb: string) =>
                        `Views of ${p.name}’s Wikipedia article ${verb} to ${fmtCompact(Math.round(p.views!.recent))} a day, from ${fmtCompact(Math.round(p.views!.prior))}.`,
                    },
                  ]
                : []),
            ]),
          )
        : null,
    },
    {
      id: "indicators",
      name: "Economy and policy indicators",
      about: "AI’s share of US job postings, US federal documents that mention AI, and the pace of frontier model releases.",
      sources: "Indeed Hiring Lab; Federal Register; the labs",
      href: "#indicators",
      latest: jobs ? `${fmtMonth(jobs.asOf.slice(0, 7))} (postings)` : federal ? fmtMonth(federal.latestMonth) : "Not yet collected",
      sameEverySpan: true,
      move: biggestMove([
        ...(jobs
          ? [
              {
                name: "Job postings",
                signal: jobs.signal,
                big: true,
                band: STEADY_BAND,
                say: (verb: string) =>
                  `US job postings asking for AI skills ${verb} to ${jobs.signal.recent.toFixed(1)}% of all postings, from ${jobs.signal.prior.toFixed(1)}% a year earlier.`,
              },
            ]
          : []),
        ...(federal
          ? [
              {
                name: "Federal documents",
                signal: federal.signal,
                big: true,
                band: STEADY_BAND,
                say: (verb: string) =>
                  `US federal documents mentioning AI ${verb} to ${federal.signal.recent} in ${fmtMonth(federal.latestMonth)}, from ${federal.signal.prior} a year earlier.`,
              },
            ]
          : []),
      ]),
    },
    {
      id: "adoption",
      name: "Business adoption",
      about: "How many US businesses say they use AI, from the Census Bureau’s survey every two weeks.",
      sources: "US Census Bureau",
      href: "#adoption",
      latest: adoption ? `Survey to ${fmtDay(adoption.asOf)} ${adoption.asOf.slice(0, 4)}` : "Not yet collected",
      sameEverySpan: true,
      move: adoption
        ? biggestMove([
            {
              name: "US businesses using AI",
              signal: adoption.using,
              big: true,
              band: STEADY_BAND,
              say: (verb) =>
                `US businesses saying they use AI ${verb} to ${adoption.using.recent.toFixed(1)}%, from ${adoption.using.prior.toFixed(1)}%, over the last ${ADOPTION_WINDOW} surveys against the ${ADOPTION_WINDOW} before.`,
            },
          ])
        : null,
    },
    {
      id: "usage",
      name: "Developer usage",
      about: "Monthly downloads of the toolkits developers build AI with, from PyPI and npm.",
      sources: "PyPI; npm",
      href: "#usage",
      latest: usage ? fmtMonth(usage.latestMonth) : "Not yet collected",
      sameEverySpan: true,
      move: usage
        ? biggestMove(
            usage.toolkits.map((t) => ({
              name: t.name,
              signal: t.share,
              big: t.share.recent >= SHARE_MIN_PCT && t.share.prior >= SHARE_MIN_PCT,
              band: STEADY_BAND,
              say: (verb: string) => {
                const [now, before] = shares(t.share);
                return `${t.name} ${verb} to ${now}% of toolkit downloads, from ${before}%, over the last ${USAGE_WINDOW} months.`;
              },
            })),
          )
        : null,
    },
    {
      id: "market-share",
      name: "Model share on OpenRouter",
      about: "Whose models developers send their work to on OpenRouter, one large marketplace, by share of tokens.",
      sources: "OpenRouter",
      href: "#market-share",
      latest: market ? `Week of ${fmtDay(market.latestWeek)} ${market.latestWeek.slice(0, 4)}` : "Not yet collected",
      sameEverySpan: false,
      move: market
        ? biggestMove(
            market.makers.map((m) => ({
              name: m.name,
              signal: m.share,
              big: m.share.recent >= SHARE_MIN_PCT && m.share.prior >= SHARE_MIN_PCT,
              band: STEADY_BAND,
              say: shareSentence(m.name, m.share, "of tokens"),
            })),
          )
        : null,
    },
  ];
}
