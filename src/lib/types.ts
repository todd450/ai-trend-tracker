/** Shapes of the JSON files in data/, shared by the collector and the site. */

/** week start date (YYYY-MM-DD, a Monday in UTC) → count */
export type WeeklyCounts = Record<string, number>;

export type History = {
  updatedAt: string;
  /** All AI papers submitted to arXiv each week; the denominator for paper share. */
  arxivTotal: WeeklyCounts;
  topics: Record<string, { arxiv: WeeklyCounts; hn: WeeklyCounts }>;
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
