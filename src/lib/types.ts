/** Shapes of the JSON files in data/, shared by the collector and the site. */

/** week start date (YYYY-MM-DD, a Monday in UTC) → count */
export type WeeklyCounts = Record<string, number>;

export type History = {
  updatedAt: string;
  /** All AI papers submitted to arXiv each week; the denominator for paper share. */
  arxivTotal: WeeklyCounts;
  topics: Record<string, { arxiv: WeeklyCounts; hn: WeeklyCounts }>;
  /** Hacker News stories each week with the word AI in the title; the denominator for theme share. */
  hnAiTotal?: WeeklyCounts;
  /** Distinct Hacker News stories each week matching a theme, keyed by theme id. */
  themes?: Record<string, WeeklyCounts>;
  /** Distinct Hacker News stories each week matching a sub-theme, keyed by "theme.subtheme". */
  subthemes?: Record<string, WeeklyCounts>;
};

export type SourceStatus = { ok: boolean; at: string; error?: string };

export type Model = {
  id: string;
  url: string;
  task: string | null;
  likes: number;
  downloads: number;
  createdAt: string;
};

/** One headline from a newsletter, institution or lab news feed. */
export type FeedItem = { source: string; title: string; url: string; publishedAt: string };

export type Latest = {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  papers: {
    id: string;
    title: string;
    url: string;
    upvotes: number;
    comments: number;
    codeUrl: string | null;
    publishedAt: string;
  }[];
  models: Model[];
  releases: (Model & { lab: string })[];
  stories: {
    id: string;
    title: string;
    url: string;
    discussionUrl: string;
    points: number;
    comments: number;
    createdAt: string;
  }[];
  repos: {
    name: string;
    url: string;
    description: string;
    stars: number;
    starsPerDay: number;
    language: string | null;
    createdAt: string;
  }[];
  /** Newest AI pieces from analysts' newsletters and research institutions. */
  analysis: FeedItem[];
  /** Newest announcements from the frontier labs' own news pages. */
  labNews: FeedItem[];
};

/** The first announcement of a new version of a lab's main model line. */
export type Release = { lab: string; model: string; url: string; date: string };

/** Slower-moving figures from outside the research world, in data/indicators.json. */
export type Indicators = {
  updatedAt: string;
  /** Share of US job postings on Indeed mentioning AI skills (percent), one reading per month. */
  jobs: { asOf: string; months: { month: string; share: number }[] } | null;
  /** US Federal Register documents mentioning "artificial intelligence", per complete month. */
  federal: { months: { month: string; count: number }[] } | null;
  releases: {
    log: Release[];
    /** Anthropic model pages already opened, so each is fetched only once. */
    anthropicChecked: Record<string, Release | null>;
  } | null;
  /**
   * Downloads per complete month of each developer package, keyed by "registry:package"
   * (see src/lib/toolkits.ts), then by month. Months build up here beyond what the registries keep.
   */
  downloads?: { packages: Record<string, Record<string, number>> } | null;
};
