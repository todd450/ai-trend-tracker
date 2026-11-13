/**
 * The tools the MCP server at /mcp offers: the same readings the site shows, as data an AI
 * assistant can quote. Every figure comes from the functions that build the pages, and each
 * move is called rising, steady or cooling by the page's own rule, so the two cannot disagree.
 */
import { buildBriefing } from "../briefing";
import { READING_LABEL, conferences, daysUntil, phaseOf, stageAgainstTrends, type Phase } from "../conferences";
import { visible } from "../editorial";
import { ADOPTION_WINDOW, USAGE_WINDOW, adoption, buildMarketShare, federal, indicators, jobs, releases, usage } from "../indicators";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../site";
import { buildToday, editorial } from "../today";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  STEADY_BAND,
  THEME_STEADY_BAND,
  buildTrends,
  directionOf,
  fmtWeek,
  heldBack,
  latest,
  signalDirection,
  type Horizon,
  type Signal,
} from "../trends";
import { ToolError, type InputField, type ServerInfo, type Tool } from "./protocol";

// ------------------------------------------------------------ shared pieces

/** The front page's horizon, which has no path of its own to be named after. */
const FRONT_PAGE = "three-months";

/**
 * The horizons by the names their pages use ("one-week" for /one-week), taken from HORIZONS so a
 * view added to the site is offered here too.
 */
const HORIZON_NAMES: Record<string, Horizon> = Object.fromEntries(
  (Object.keys(HORIZONS) as Horizon[]).map((h) => [HORIZONS[h].href.slice(1) || FRONT_PAGE, h]),
);

const horizonField: InputField = {
  type: "string",
  description:
    "How far back to compare: " +
    Object.entries(HORIZON_NAMES)
      .map(([name, h]) =>
        HORIZONS[h].window === 1
          ? `${name}, the latest week against the week before`
          : `${name}, the latest ${HORIZONS[h].window} weeks against the ${HORIZONS[h].window} before${name === FRONT_PAGE ? " (the site's front page)" : ""}`,
      )
      .join("; ") +
    ". Shorter horizons react faster and are noisier.",
  enum: Object.keys(HORIZON_NAMES),
  default: FRONT_PAGE,
};

const horizonOf = (args: Record<string, string | number>) => HORIZON_NAMES[String(args.horizon)];

const round = (n: number, places = 1) => Number(n.toFixed(places));
/** A relative change as a whole percentage, as the page prints it; null when there was nothing to compare with. */
const pct = (change: number | null) => (change === null ? null : Math.round(change * 100));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Says what "recent" and "prior" mean for a horizon. */
function comparison(horizon: Horizon) {
  const { window } = HORIZONS[horizon];
  return window === 1
    ? "The latest complete week against the week before."
    : `The average of the latest ${window} complete weeks against the average of the ${window} weeks before.`;
}

const pageUrl = (horizon: Horizon) => `${SITE_URL}${HORIZONS[horizon].href}`;

/** Sources whose last collection failed: their figures are the last good ones and may be out of date. */
const failingSources = () =>
  Object.entries(latest.sources)
    .filter(([, s]) => !s.ok)
    .map(([source, s]) => ({ source, lastTried: s.at, error: s.error ?? null }));

/** The week-by-week series behind a signal, lined up with the weeks it was measured in (newest last). */
const byWeek = (weeks: string[], signal: Signal) => {
  const offset = signal.values.length - weeks.length;
  return weeks.map((_, i) => signal.values[offset + i] ?? null);
};

const TOO_FEW = "too few to call";

/** An id was asked for that does not exist: says which ones do, so the model can try again. */
function unknownId(kind: string, id: string, ids: string[]): never {
  throw new ToolError(`No ${kind} with id "${id}". Known ids: ${ids.join(", ")}.`);
}

// ------------------------------------------------------------ get_briefing

const briefingTool: Tool = {
  name: "get_briefing",
  title: "The week's briefing",
  description:
    "The tracker's summary of where attention in AI moved: the headline finding and five lines covering research papers, " +
    "Hacker News discussion, AI jobs, frontier model releases and US federal policy. Start here for a general question such as " +
    "'what is happening in AI this month'. Also reports which data sources failed on the last collection.",
  input: { horizon: horizonField },
  run(args) {
    const horizon = horizonOf(args);
    const trends = buildTrends(horizon);
    const { headline, briefing } = buildBriefing(trends);
    const latestWeek = trends.weeks.at(-1) ?? null;
    return {
      horizon: args.horizon,
      comparison: comparison(horizon),
      latestWeek: latestWeek && { start: latestWeek, label: fmtWeek(latestWeek) },
      dataCollectedAt: latest.generatedAt,
      headline: [headline.lead, headline.turn].filter(Boolean).join(" "),
      lines: briefing.map(({ label, figure, text }) => ({ label, figure, text })),
      failingSources: failingSources(),
      page: pageUrl(horizon),
    };
  },
};

// ------------------------------------------------------------ get_trends

const trendsTool: Tool = {
  name: "get_trends",
  title: "Trends by topic, theme or product",
  description:
    "Rising, steady or cooling readings for one of three sets. research: 20-odd AI research topics (agents, reasoning, robotics...) " +
    "measured as their share of all AI papers on arXiv, with Hacker News stories alongside. discussion: seven economy and society " +
    "themes (jobs, regulation, energy...) measured as their share of AI stories on Hacker News, each with four sub-themes. " +
    "products: AI products people use (assistants, coding tools, devices, robots), measured by Hacker News stories naming them and " +
    "Wikipedia article views. Give an id to get one item's week-by-week figures; without one, every item is summarised.",
  input: {
    measure: { type: "string", description: "Which set to read.", enum: ["research", "discussion", "products"] },
    horizon: horizonField,
    // Free text: which ids are valid depends on the measure, so run() checks it and lists the right ones when it is wrong.
    id: { type: "string", description: "Optional. One item's id (from a call without id) to get its weekly series as well." },
  },
  required: ["measure"],
  run(args) {
    const horizon = horizonOf(args);
    const id = args.id === undefined ? undefined : String(args.id);
    if (args.measure === "research") return researchTrends(horizon, id);
    if (args.measure === "discussion") return discussionTrends(horizon, id);
    return productTrends(horizon, id);
  },
};

function researchTrends(horizon: Horizon, id?: string) {
  const { topicTrends, weeks, window, hasHistory } = buildTrends(horizon);
  const summarise = (t: (typeof topicTrends)[number]) => {
    const papersPerWeek = mean(t.paperCounts.slice(-window));
    const storiesFirm = t.stories.change !== null && mean(t.stories.values.slice(-2 * window)) >= MAP_MIN_STORIES;
    return {
      id: t.id,
      name: t.name,
      description: t.blurb,
      direction: t.hasPapers ? t.direction : "not yet collected",
      research: {
        shareOfAiPapersPct: { recent: round(t.papers.recent, 2), prior: round(t.papers.prior, 2) },
        changePct: pct(t.papers.change),
        papersPerWeek: Math.round(papersPerWeek),
        firm: t.hasPapers && papersPerWeek >= HEADLINE_MIN_PAPERS,
        withinUsualSwing: heldBack(t.papers, STEADY_BAND),
      },
      discussion: {
        hackerNewsStoriesPerWeek: { recent: round(t.stories.recent), prior: round(t.stories.prior) },
        changePct: pct(t.stories.change),
        direction: storiesFirm ? signalDirection(t.stories, STEADY_BAND) : TOO_FEW,
      },
    };
  };
  const notes = [
    `A topic is rising or cooling when its share of AI papers moved by ${STEADY_BAND * 100}% or more and the move is larger than its usual week-to-week swing (withinUsualSwing marks a large move held back as swing).`,
    `firm is false when a topic averages under ${HEADLINE_MIN_PAPERS} papers a week; the site shows those faintly and never names them in its headline.`,
    `Hacker News discussion is called only from ${MAP_MIN_STORIES} stories a week up.`,
    "Topics are keyword lists matched against titles and abstracts, so counts are indicators, not exact measurements.",
  ];
  if (!id) {
    return { measure: "research", comparison: comparison(horizon), enoughHistory: hasHistory, topics: topicTrends.map(summarise), notes };
  }
  const t = topicTrends.find((x) => x.id === id) ?? unknownId("research topic", id, topicTrends.map((x) => x.id));
  const share = byWeek(weeks, t.papers);
  const stories = byWeek(weeks, t.stories);
  return {
    measure: "research",
    comparison: comparison(horizon),
    topic: summarise(t),
    weekly: weeks.map((week, i) => ({
      week,
      papers: t.paperCounts[i],
      shareOfAiPapersPct: share[i] === null ? null : round(share[i], 2),
      hackerNewsStories: stories[i],
    })),
    notes,
  };
}

function discussionTrends(horizon: Horizon, id?: string) {
  const { themeTrends, weeks, hasThemes } = buildTrends(horizon);
  const summarise = (t: (typeof themeTrends)[number]) => ({
    id: t.id,
    name: t.name,
    description: t.blurb,
    direction: t.direction,
    shareOfAiStoriesPct: { recent: round(t.share.recent, 2), prior: round(t.share.prior, 2) },
    changePct: pct(t.share.change),
    withinUsualSwing: heldBack(t.share, THEME_STEADY_BAND),
    storiesPerWeek: { recent: round(t.stories.recent), prior: round(t.stories.prior) },
    subthemes: t.parts.map((p) => ({
      id: p.id,
      name: p.name,
      direction: p.enough ? p.direction : TOO_FEW,
      shareOfAiStoriesPct: { recent: round(p.share.recent, 2), prior: round(p.share.prior, 2) },
      changePct: pct(p.share.change),
      storiesPerWeek: round(p.stories.recent),
      titleSearches: p.searches,
    })),
  });
  const notes = [
    "Each theme counts distinct Hacker News stories whose title matches any of its sub-themes' searches, as a share of all stories with AI in the title.",
    `A theme is rising or cooling when its share moved by ${THEME_STEADY_BAND * 100}% or more and beyond its usual weekly swing. A sub-theme averaging under 3 stories a week in either half is ${TOO_FEW}.`,
    "Hacker News is one community of mostly technical readers; it is not public opinion.",
  ];
  if (!id) {
    return { measure: "discussion", comparison: comparison(horizon), enoughHistory: hasThemes, themes: themeTrends.map(summarise), notes };
  }
  const t = themeTrends.find((x) => x.id === id) ?? unknownId("theme", id, themeTrends.map((x) => x.id));
  const share = byWeek(weeks, t.share);
  const stories = byWeek(weeks, t.stories);
  return {
    measure: "discussion",
    comparison: comparison(horizon),
    theme: summarise(t),
    weekly: weeks.map((week, i) => ({
      week,
      stories: stories[i],
      shareOfAiStoriesPct: share[i] === null ? null : round(share[i], 2),
    })),
    notes,
  };
}

function productTrends(horizon: Horizon, id?: string) {
  const { productTrends: products, weeks, hasProducts } = buildTrends(horizon);
  const summarise = (p: (typeof products)[number]) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    description: p.blurb,
    discussion: {
      direction: p.enough ? signalDirection(p.stories, THEME_STEADY_BAND) : TOO_FEW,
      hackerNewsStoriesPerWeek: { recent: round(p.stories.recent), prior: round(p.stories.prior) },
      changePct: pct(p.stories.change),
      titleSearches: p.searches,
      excluding: p.except,
    },
    interest: p.views && {
      direction: p.views.change === null ? "new article, no base to compare" : signalDirection(p.views, STEADY_BAND),
      wikipediaViewsPerDay: { recent: Math.round(p.views.recent), prior: Math.round(p.views.prior) },
      changePct: pct(p.views.change),
    },
  });
  const notes = [
    `Discussion is Hacker News stories naming the product in the title; under 3 a week it is ${TOO_FEW}. It is called rising or cooling at a ${THEME_STEADY_BAND * 100}% move beyond its usual swing.`,
    `Interest is views of the product's English Wikipedia article by people (not bots), called at a ${STEADY_BAND * 100}% move. interest is null for products without an article.`,
  ];
  if (!id) {
    return { measure: "products", comparison: comparison(horizon), enoughHistory: hasProducts, products: products.map(summarise), notes };
  }
  const p = products.find((x) => x.id === id) ?? unknownId("product", id, products.map((x) => x.id));
  const stories = byWeek(weeks, p.stories);
  const views = p.views ? byWeek(weeks, p.views) : null;
  return {
    measure: "products",
    comparison: comparison(horizon),
    product: summarise(p),
    weekly: weeks.map((week, i) => ({ week, hackerNewsStories: stories[i], wikipediaViewsPerDay: views?.[i] ?? null })),
    notes,
  };
}

// ------------------------------------------------------------ get_indicators

const INDICATOR_NAMES = ["hiring", "policy", "businessAdoption", "modelReleases", "developerToolkits", "modelShare"] as const;

const indicatorsTool: Tool = {
  name: "get_indicators",
  title: "Economy, policy and adoption indicators",
  description:
    "Slower-moving signals from outside the research world: hiring (share of US job postings asking for AI skills, Indeed Hiring Lab, monthly), " +
    "policy (US Federal Register documents mentioning AI, monthly), businessAdoption (share of US businesses using AI, Census Bureau survey, " +
    "every two weeks), modelReleases (new GPT, Gemini and Claude versions), developerToolkits (each of ten AI toolkits' share of npm and PyPI " +
    "downloads) and modelShare (each model maker's share of tokens on the OpenRouter marketplace). Use for questions about AI's effect on work, " +
    "business and government, and about which models and toolkits developers pick.",
  input: {
    only: {
      type: "string",
      description: "Optional. Return just one indicator instead of all six.",
      enum: [...INDICATOR_NAMES, "all"],
      default: "all",
    },
    horizon: {
      ...horizonField,
      description: "Applies to modelShare only, which is weekly. The other indicators use fixed comparisons, stated in each one's comparison field.",
    } as InputField,
  },
  run(args) {
    const horizon = horizonOf(args);
    const all: Record<(typeof INDICATOR_NAMES)[number], () => unknown> = {
      hiring: () =>
        jobs &&
        indicators.jobs && {
          source: "Indeed Hiring Lab",
          measure: "Share of US job postings on Indeed that mention AI skills, percent.",
          comparison: "The latest month against the same month a year earlier.",
          asOf: jobs.asOf,
          latestPct: round(jobs.signal.recent, 2),
          yearEarlierPct: round(jobs.signal.prior, 2),
          changePct: pct(jobs.signal.change),
          direction: directionOf(jobs.signal.change, STEADY_BAND),
          monthly: indicators.jobs.months.slice(-13).map((m) => ({ month: m.month, pct: round(m.share, 2) })),
        },
      policy: () =>
        federal &&
        indicators.federal && {
          source: "US Federal Register",
          measure: 'Documents published in the Federal Register that mention "artificial intelligence", per complete month.',
          comparison: "The latest complete month against the same month a year earlier.",
          latestMonth: federal.latestMonth,
          latestCount: federal.signal.recent,
          yearEarlierCount: federal.signal.prior,
          changePct: pct(federal.signal.change),
          direction: directionOf(federal.signal.change, STEADY_BAND),
          monthly: indicators.federal.months.slice(-13),
        },
      businessAdoption: () =>
        adoption && {
          source: "US Census Bureau, Business Trends and Outlook Survey",
          measure: "Share of US businesses answering yes to using AI in the last two weeks, and to expecting to use it in the next six months, percent.",
          comparison: `The average of the latest ${ADOPTION_WINDOW} two-week surveys (about three months) against the ${ADOPTION_WINDOW} before.`,
          asOf: adoption.asOf,
          seriesStarts: adoption.since,
          latest: { usingPct: adoption.latest.using, planningPct: adoption.latest.planning },
          using: {
            recentPct: round(adoption.using.recent, 2),
            priorPct: round(adoption.using.prior, 2),
            changePct: pct(adoption.using.change),
            direction: directionOf(adoption.using.change, STEADY_BAND),
          },
          planning: adoption.planning && {
            recentPct: round(adoption.planning.recent, 2),
            priorPct: round(adoption.planning.prior, 2),
            changePct: pct(adoption.planning.change),
            direction: directionOf(adoption.planning.change, STEADY_BAND),
          },
          caveat: "Businesses' own answers. The series starts in November 2025, when the Bureau broadened the question; earlier answers are not comparable.",
        },
      modelReleases: () =>
        releases && {
          source: "The labs' own news pages",
          measure: "First announcement of each new version of OpenAI's GPT, Google's Gemini and Anthropic's Claude model lines.",
          comparison: "Versions in the last 90 days against the 90 days before.",
          last90Days: releases.signal.recent,
          prior90Days: releases.signal.prior,
          changePct: pct(releases.signal.change),
          releases: [...releases.shown].sort((a, b) => b.date.localeCompare(a.date)).map(({ lab, model, date, url }) => ({ lab, model, date, url })),
        },
      developerToolkits: () =>
        usage && {
          source: "npm and PyPI Stats",
          measure:
            "Each toolkit's share of monthly downloads across the ten tracked AI toolkits, worked out inside each registry and averaged, so the shares add up to 100%.",
          comparison: `The average share over the latest ${USAGE_WINDOW} complete months against the ${USAGE_WINDOW} before.`,
          latestMonth: usage.latestMonth,
          totalDownloadsLatestMonth: usage.totalDownloads,
          toolkits: usage.toolkits.map((t) => ({
            id: t.id,
            name: t.name,
            kind: t.kind === "lab" ? "a model maker's own toolkit" : "a library for building on any model",
            sharePct: { recent: round(t.share.recent, 2), prior: round(t.share.prior, 2) },
            changePct: pct(t.share.change),
            direction: directionOf(t.share.change, STEADY_BAND),
            downloadsLatestMonth: t.downloads,
          })),
          caveat: "Downloads include build servers and packages pulled in by other packages, so they show direction, not a number of users.",
        },
      modelShare: () => {
        const share = buildMarketShare(horizon);
        return (
          share && {
            source: "OpenRouter rankings",
            credit: `Data from OpenRouter, as of ${share.asOf}.`,
            measure: "Each model maker's share of the tokens processed on OpenRouter in a week.",
            comparison: comparison(horizon),
            latestWeek: share.latestWeek,
            totalTokensLatestWeek: share.totalTokens,
            othersSharePct: round(share.otherShare, 2),
            makers: share.makers.map((m) => ({
              id: m.id,
              name: m.name,
              sharePct: { recent: round(m.share.recent, 2), prior: round(m.share.prior, 2) },
              changePct: pct(m.share.change),
              direction: directionOf(m.share.change, STEADY_BAND),
              tokensLatestWeek: m.tokens,
            })),
            caveat:
              "One marketplace, not the whole market: companies buying from a lab directly, and people using chat apps, are not counted.",
          }
        );
      },
    };
    const names = args.only === "all" ? INDICATOR_NAMES : [args.only as (typeof INDICATOR_NAMES)[number]];
    return {
      dataCollectedAt: indicators.updatedAt,
      ...Object.fromEntries(names.map((name) => [name, all[name]() ?? null])),
      page: `${SITE_URL}/#indicators`,
    };
  },
};

// ------------------------------------------------------------ get_latest

const LISTS = {
  today: "Everything the lab, newsletter and Hacker News sources published in the 24 hours before collection, biggest first, with posts about one event gathered together.",
  papers: "Most-upvoted papers on Hugging Face's daily papers page.",
  models: "Trending models on Hugging Face.",
  labModels: "Newest models uploaded to Hugging Face by major labs.",
  repos: "New AI repositories on GitHub, ranked by stars gained per day.",
  stories: "The week's top AI stories on Hacker News.",
  launches: "AI product launches on Hacker News (Show HN and Launch HN) from the past 7 days, most upvoted first.",
  analysis: "Newest AI pieces from ten newsletters and research institutions, at most two per source, from the past 30 days.",
  labNews: "Newest announcements from Anthropic, OpenAI and Google DeepMind's own news pages.",
} as const;

const latestTool: Tool = {
  name: "get_latest",
  title: "Latest reading lists",
  description:
    "The current ranked lists the site shows, with links: " +
    Object.entries(LISTS)
      .map(([name, what]) => `${name} (${what})`)
      .join(" ") +
    " Use for 'what is new' questions, and to find the stories, papers or repositories behind a trend.",
  input: {
    list: { type: "string", description: "Which list.", enum: Object.keys(LISTS) },
    limit: { type: "integer", description: "How many items, most prominent first.", minimum: 1, maximum: 20, default: 10 },
  },
  required: ["list"],
  run(args) {
    const limit = Number(args.limit);
    const pick = <T extends { url: string }>(items: T[] | undefined) => visible(items ?? [], editorial).slice(0, limit);
    const items = (() => {
      switch (args.list as keyof typeof LISTS) {
        case "today":
          return buildToday()
            .items.slice(0, limit)
            .map((item) => ({
              title: item.title,
              url: item.url,
              from: item.from,
              publishedAt: item.publishedAt,
              hackerNews: item.discussion ?? null,
              sameEvent: item.also.map((a) => ({ title: a.title, url: a.url, from: a.from })),
              pinnedByEditor: item.pinned ? (item.pinned.note ?? true) : false,
            }));
        case "papers":
          return pick(latest.papers).map(({ id, ...paper }) => ({ arxivId: id, ...paper }));
        case "models":
          return pick(latest.models);
        case "labModels":
          return pick(latest.releases);
        case "repos":
          return pick(latest.repos);
        case "stories":
          return pick(latest.stories);
        case "launches":
          return pick(latest.launches);
        case "analysis":
          return pick(latest.analysis);
        case "labNews":
          return pick(latest.labNews);
      }
    })();
    return { list: args.list, about: LISTS[args.list as keyof typeof LISTS], dataCollectedAt: latest.generatedAt, items };
  },
};

// ------------------------------------------------------------ get_conferences

const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "upcoming",
  underway: "underway",
  awaiting: "held, recordings not yet watched",
  partly: "held, partly watched",
  watched: "held and watched",
};

const conferencesTool: Tool = {
  name: "get_conferences",
  title: "AI conference calendar",
  description:
    "The calendar of major AI research and industry conferences (NeurIPS, ICML, AI Engineer, GTC, re:Invent...). Without an id, lists events " +
    "with dates, place and phase. With an id, adds what the tracker found in the event's talks: a written recap, and how much stage time each " +
    "research topic got set against that topic's trend in the numbers (for example 'Loud here, flat in the numbers').",
  input: {
    when: {
      type: "string",
      description: "Which events to list when no id is given.",
      enum: ["upcoming", "underway", "past", "all"],
      default: "all",
    },
    id: {
      type: "string",
      description: "Optional. One event's id, from a call without id, for its recap and stage reading.",
      enum: conferences.map((c) => c.id),
    },
  },
  run(args) {
    const summary = (c: (typeof conferences)[number]) => ({
      id: c.id,
      name: c.name,
      host: c.host,
      kind: c.kind,
      start: c.start,
      end: c.end,
      place: c.place,
      url: c.url,
      phase: PHASE_LABEL[phaseOf(c)],
      daysUntilStart: daysUntil(c),
      whyItMatters: c.note ?? null,
    });
    const id = args.id === undefined ? undefined : String(args.id);
    if (!id) {
      const phases: Record<string, Phase[]> = {
        upcoming: ["upcoming"],
        underway: ["underway"],
        past: ["awaiting", "partly", "watched"],
        all: ["upcoming", "underway", "awaiting", "partly", "watched"],
      };
      const shown = conferences.filter((c) => phases[String(args.when)].includes(phaseOf(c)));
      return { asOf: latest.generatedAt.slice(0, 10), conferences: shown.map(summary), page: `${SITE_URL}/conferences` };
    }
    const c = conferences.find((x) => x.id === id) ?? unknownId("conference", id, conferences.map((x) => x.id));
    const stage = c.stage && {
      countedFrom: c.stage.source === "talks" ? "the talks' transcript" : "the published programme (titles and abstracts), before the talks could be watched",
      words: c.stage.words,
      topics: stageAgainstTrends(c)
        .filter((row) => row.mentions > 0)
        .map((row) => ({
          topic: row.topic.name,
          mentions: row.mentions,
          shareOfStagePct: round(row.share * 100),
          research: row.researchFirm ? row.research : TOO_FEW,
          discussion: row.discussionFirm ? row.discussion : TOO_FEW,
          reading: READING_LABEL[row.reading] || null,
        })),
      readingComparesWith: "Each topic's three-month research and Hacker News trend.",
    };
    return {
      ...summary(c),
      recordings: c.recordings ?? null,
      videos: c.videos ?? [],
      recap: c.recap ?? null,
      stage: stage ?? null,
      page: `${SITE_URL}/conferences/${c.id}`,
    };
  },
};

// ------------------------------------------------------------ the server

export const TOOLS: Tool[] = [briefingTool, trendsTool, indicatorsTool, latestTool, conferencesTool];

export const SERVER: ServerInfo = {
  name: "ai-trend-tracker",
  title: SITE_NAME,
  version: "1.0.0",
  websiteUrl: SITE_URL,
  instructions:
    `${SITE_DESCRIPTION} Read-only; the data is collected once a day from free public sources (arXiv, Hacker News, GitHub, Hugging Face, ` +
    "newsletters, lab news pages, Indeed Hiring Lab, the Federal Register, the US Census Bureau, npm, PyPI and OpenRouter). " +
    "Start with get_briefing for a general question, get_trends for a topic, theme or product, get_indicators for jobs, policy, business " +
    "adoption, releases, toolkits and model share, get_latest for links, and get_conferences for events. " +
    "Each reading is labelled rising, steady, cooling or too few to call by fixed rules; report those labels rather than reading a trend into " +
    "small numbers. The counts are keyword matches and samples of particular communities, so they are indicators of attention, not measures " +
    `of the whole field. When quoting figures, say they come from ${SITE_NAME} (${SITE_URL}) and give the collection date.`,
};
