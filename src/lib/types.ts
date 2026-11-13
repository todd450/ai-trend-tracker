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
  /**
   * AI stories on Hacker News from the 24 hours before `generatedAt`, most upvoted first.
   * Missing from files written before the "Today's AI news" section existed.
   */
  today?: Latest["stories"];
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
  /**
   * Share of US businesses answering yes to the Census Bureau's two AI questions (percent),
   * one reading per two-week survey period, oldest first. `period` is the survey's own code
   * (year then fortnight, e.g. "202622") and `end` the last day of collection.
   */
  /**
   * Tokens processed on OpenRouter each complete week (starting on a Monday, UTC), by the maker of
   * the model. Each week names only its nine largest makers; the rest are summed under "Others".
   * `asOf` is when OpenRouter's Data API produced the figures, which its licence asks to be shown
   * with them; it is absent on data stored before the collector used that API.
   */
  marketShare?: { asOf?: string; weeks: { week: string; tokens: Record<string, number> }[] } | null;
  business?: { periods: { period: string; end: string; using: number; planning: number | null }[] } | null;
};

/** One video of a conference's talks, usually a day-long stream. */
export type ConferenceVideo = { title: string; url: string };

/** One announced talk: its day (YYYY-MM-DD), title, and who gives it. */
export type ConferenceTalk = { day: string; title: string; speaker: string; org?: string };

/** What was said on stage about one tracked topic, written by whoever watched the talks. */
export type StagePoint = {
  /** A topic id from src/lib/topics.ts. */
  topic: string;
  /** The claim, in the tracker's words. */
  said: string;
  /** Who said it, and where in the recording (a link that opens the video at that moment). */
  who?: string;
  at?: { label: string; url: string };
};

export type Conference = {
  id: string;
  name: string;
  /** Who runs it. */
  host: string;
  /** "research" for academic meetings, "industry" for practitioner and vendor events. */
  kind: "research" | "industry";
  /** First and last day, YYYY-MM-DD, in the event's own time zone. */
  start: string;
  end: string;
  place: string;
  url: string;
  /** Where recordings are published once the event is over. */
  recordings?: string;
  /** One line on why the event matters to this tracker. */
  note?: string;
  /** The recordings the recap is based on. */
  videos?: ConferenceVideo[];
  /** The main-stage talks as announced, in running order. */
  programme?: ConferenceTalk[];
  /**
   * Topic mentions counted by scripts/conference.ts: from the published programme (titles and
   * abstracts) before the recordings can be watched, then from the talks' transcript.
   */
  stage?: { source: "programme" | "talks"; words: number; mentions: Record<string, number> };
  /** Written after watching the recordings. */
  recap?: {
    watchedOn: string;
    /** True while the recap leaves out part of the event (a day not yet streamed or captioned); `coverage` says which. */
    partial?: boolean;
    /** What was watched, and what was not: "Day one's main-stage stream, 8 of 9 hours". */
    coverage: string;
    summary: string;
    points: StagePoint[];
  };
};

/** data/conferences.json: the calendar, kept by hand, with a recap added to each event once watched. */
export type ConferenceFile = { conferences: Conference[] };
