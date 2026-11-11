/**
 * Collects AI trend data from free public sources and writes it to data/:
 * arXiv, Hacker News, GitHub, Hugging Face, plus newsletter and lab news feeds.
 *
 *   npm run collect            everything
 *   npm run collect -- --fast  skip the slow arXiv history backfill
 *
 * Output:
 *   data/history.json              weekly mention counts per topic (grows over time)
 *   data/latest.json               current ranked lists (papers, repos, models, news)
 *   data/indicators.json           monthly job-posting, federal and model-release figures
 *   data/snapshots/YYYY-MM-DD.json a dated copy of the lists, kept as a record
 *
 * No API keys are required. Set GITHUB_TOKEN to raise GitHub's rate limit.
 * If one source fails, the previous data for that source is kept and the
 * failure is recorded in latest.json so the site can show it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { THEMES } from "../src/lib/themes.ts";
import { TOPICS } from "../src/lib/topics.ts";
import type { FeedItem, History, Indicators, Latest, Release, SourceStatus } from "../src/lib/types.ts";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
/** Enough for the long-term view: 13 weeks compared with the 13 before. */
const WEEKS_OF_HISTORY = 26;
/** The newest weeks are re-counted each run because sources index late. */
const WEEKS_TO_REFRESH = 2;
const USER_AGENT = "ai-trend-tracker (public dashboard; collector script)";
const DAY = 86_400_000;
const FAST = process.argv.includes("--fast");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).host}`);
  return (await res.json()) as T;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).host}`);
  return res.text();
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  const full = path.join(DATA_DIR, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(value, null, 1) + "\n");
}

/** Monday (UTC) start dates of the last `count` completed weeks, oldest first. */
function completedWeeks(count: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = today - daysSinceMonday * DAY;
  return Array.from({ length: count }, (_, i) => isoDay(new Date(thisMonday - (count - i) * 7 * DAY)));
}

// ---------------------------------------------------------------- arXiv

const ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.RO", "cs.MA", "cs.SD", "eess.AS", "stat.ML"];

/** Number of AI papers submitted in a week, optionally matching any phrase. */
async function arxivCount(weekStart: string, phrases: string[] | null): Promise<number> {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start.getTime() + 6 * DAY);
  const stamp = (d: Date, hhmm: string) => isoDay(d).replaceAll("-", "") + hhmm;
  const parts = [`(${ARXIV_CATEGORIES.map((c) => `cat:${c}`).join(" OR ")})`];
  if (phrases) parts.push(`(${phrases.map((p) => `abs:"${p}" OR ti:"${p}"`).join(" OR ")})`);
  parts.push(`submittedDate:[${stamp(start, "0000")} TO ${stamp(end, "2359")}]`);
  const url = `https://export.arxiv.org/api/query?max_results=1&search_query=${encodeURIComponent(parts.join(" AND "))}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    // arXiv asks for at most one request every three seconds, and answers 429
    // for a minute or more during a long backfill, so retries wait 30s, 60s, 90s, 120s.
    await sleep(attempt === 0 ? 3100 : 30_000 * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`arXiv responded ${res.status}`);
      const match = (await res.text()).match(/<opensearch:totalResults[^>]*>(\d+)</);
      if (!match) throw new Error("arXiv response had no result count");
      return Number(match[1]);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------- Hacker News

type HnHit = { objectID: string; title: string; url: string | null; points: number; num_comments: number; created_at: string };
type HnResponse = { nbHits: number; hits: HnHit[] };

function hnUrl(params: Record<string, string>) {
  return "https://hn.algolia.com/api/v1/search?" + new URLSearchParams({ tags: "story", ...params });
}

/** Number of stories in a week whose title contains any of the phrases. */
async function hnCount(weekStart: string, phrases: string[]): Promise<number> {
  const from = Date.parse(weekStart + "T00:00:00Z") / 1000;
  let total = 0;
  for (const phrase of phrases) {
    const data = await getJson<HnResponse>(
      hnUrl({
        query: `"${phrase}"`,
        restrictSearchableAttributes: "title",
        typoTolerance: "false",
        queryType: "prefixNone",
        numericFilters: `created_at_i>=${from},created_at_i<${from + 7 * 86400}`,
        hitsPerPage: "0",
      }),
    );
    total += data.nbHits;
    await sleep(120);
  }
  return total;
}

/** Hacker News title search limited to one week. Every word of `query` must appear in the title. */
function hnWeek(weekStart: string, query: string, hitsPerPage: number) {
  const from = Date.parse(weekStart + "T00:00:00Z") / 1000;
  return getJson<HnResponse>(
    hnUrl({
      query,
      restrictSearchableAttributes: "title",
      typoTolerance: "false",
      queryType: "prefixNone",
      numericFilters: `created_at_i>=${from},created_at_i<${from + 7 * 86400}`,
      attributesToRetrieve: "objectID",
      attributesToHighlight: "",
      hitsPerPage: String(hitsPerPage),
    }),
  );
}

/** Number of distinct stories in a week matching any of a theme's searches. */
async function hnThemeCount(weekStart: string, queries: string[]): Promise<number> {
  const stories = new Set<string>();
  for (const query of queries) {
    const data = await hnWeek(weekStart, query, 1000);
    for (const hit of data.hits) stories.add(hit.objectID);
    await sleep(120);
  }
  return stories.size;
}

/** All stories in a week with the word AI in the title; the denominator for theme share. */
const hnAiCount = async (weekStart: string) => (await hnWeek(weekStart, "AI", 0)).nbHits;

const HN_NEWS_QUERIES = ["AI", "LLM", "OpenAI", "Anthropic", "Claude", "GPT", "Gemini", "DeepMind", "agents", "neural"];

async function hnTopStories(): Promise<Latest["stories"]> {
  const since = Math.floor((Date.now() - 7 * DAY) / 1000);
  const seen = new Map<string, HnHit>();
  for (const query of HN_NEWS_QUERIES) {
    const data = await getJson<HnResponse>(
      hnUrl({
        query,
        restrictSearchableAttributes: "title",
        typoTolerance: "false",
        queryType: "prefixNone", // otherwise "AI" also matches "Airplanes"
        numericFilters: `created_at_i>=${since},points>=100`,
        hitsPerPage: "40",
      }),
    );
    for (const hit of data.hits) seen.set(hit.objectID, hit);
    await sleep(120);
  }
  // The same story is often submitted twice; keep the higher-scoring copy.
  const titles = new Set<string>();
  return [...seen.values()]
    .sort((a, b) => b.points - a.points)
    .filter((h) => {
      const key = h.title.trim().toLowerCase();
      return titles.has(key) ? false : (titles.add(key), true);
    })
    .slice(0, 20)
    .map((h) => ({
      id: h.objectID,
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points,
      comments: h.num_comments ?? 0,
      createdAt: h.created_at,
    }));
}

// ---------------------------------------------------------------- GitHub

type GhRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  created_at: string;
};

const GITHUB_TOPICS = ["llm", "ai", "ai-agents", "machine-learning", "mcp", "generative-ai"];

/** Repositories created in the last 30 days, ranked by stars gained per day. */
async function githubRisingRepos(): Promise<Latest["repos"]> {
  const since = isoDay(new Date(Date.now() - 30 * DAY));
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const seen = new Map<string, GhRepo>();
  for (const topic of GITHUB_TOPICS) {
    const q = encodeURIComponent(`topic:${topic} created:>=${since}`);
    const data = await getJson<{ items: GhRepo[] }>(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`,
      headers,
    );
    for (const repo of data.items) seen.set(repo.full_name, repo);
    await sleep(process.env.GITHUB_TOKEN ? 500 : 6500); // unauthenticated search allows 10 requests a minute
  }
  return [...seen.values()]
    .map((r) => {
      const ageDays = Math.max(1, (Date.now() - Date.parse(r.created_at)) / DAY);
      return {
        name: r.full_name,
        url: r.html_url,
        description: (r.description ?? "").slice(0, 200),
        stars: r.stargazers_count,
        starsPerDay: Math.round(r.stargazers_count / ageDays),
        language: r.language,
        createdAt: r.created_at,
      };
    })
    .sort((a, b) => b.starsPerDay - a.starsPerDay)
    .slice(0, 20);
}

// ---------------------------------------------------------- Hugging Face

type HfModel = { id: string; likes: number; downloads: number; pipeline_tag?: string; createdAt: string; trendingScore?: number };
type HfPaper = {
  paper: { id: string; title: string; upvotes: number; publishedAt: string; githubRepo?: string };
  numComments: number;
};

const toModel = (m: HfModel) => ({
  id: m.id,
  url: `https://huggingface.co/${m.id}`,
  task: m.pipeline_tag ?? null,
  likes: m.likes,
  downloads: m.downloads,
  createdAt: m.createdAt,
});

async function hfTrendingModels(): Promise<Latest["models"]> {
  const data = await getJson<HfModel[]>("https://huggingface.co/api/models?sort=trendingScore&limit=20");
  return data.map(toModel);
}

/** Organisations whose new model uploads count as a "release". */
const MODEL_LABS = [
  "google", "meta-llama", "facebook", "microsoft", "openai", "mistralai", "deepseek-ai", "Qwen",
  "nvidia", "apple", "stabilityai", "black-forest-labs", "xai-org", "ibm-granite", "moonshotai",
  "zai-org", "tencent", "ByteDance-Seed", "HuggingFaceTB", "CohereLabs", "allenai", "baidu",
];

async function hfLabReleases(): Promise<Latest["releases"]> {
  const cutoff = Date.now() - 45 * DAY;
  const releases: Latest["releases"] = [];
  for (const lab of MODEL_LABS) {
    try {
      const data = await getJson<HfModel[]>(
        `https://huggingface.co/api/models?author=${lab}&sort=createdAt&direction=-1&limit=15`,
      );
      for (const m of data) {
        if (Date.parse(m.createdAt) >= cutoff) releases.push({ ...toModel(m), lab });
      }
    } catch (err) {
      console.warn(`  ! skipped ${lab}: ${(err as Error).message}`);
    }
    await sleep(150);
  }
  return releases.sort((a, b) => b.likes - a.likes).slice(0, 20);
}

async function hfPapers(): Promise<Latest["papers"]> {
  const data = await getJson<HfPaper[]>("https://huggingface.co/api/daily_papers?limit=100");
  const cutoff = Date.now() - 10 * DAY;
  return data
    .filter((p) => Date.parse(p.paper.publishedAt) >= cutoff)
    .sort((a, b) => b.paper.upvotes - a.paper.upvotes)
    .slice(0, 15)
    .map((p) => ({
      id: p.paper.id,
      title: p.paper.title.replace(/\s+/g, " ").trim(),
      url: `https://arxiv.org/abs/${p.paper.id}`,
      upvotes: p.paper.upvotes,
      comments: p.numComments ?? 0,
      codeUrl: p.paper.githubRepo ?? null,
      publishedAt: p.paper.publishedAt,
    }));
}

// ------------------------------------------- newsletters and lab news

type FeedSource = { source: string; collect: () => Promise<FeedItem[]> };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Plain text from a feed field: unwraps CDATA, decodes entities, drops markup. */
function plain(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const field = (block: string, name: string) =>
  block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

const MENTIONS_AI_EXACT = /\bA\.?I\b/;
const MENTIONS_AI =
  /\b(artificial intelligence|LLMs?|chatbots?|ChatGPT|generative|machine learning|agentic|GPT|Claude|Gemini|OpenAI|Anthropic|Nvidia|data cent(?:er|re)s?)\b/i;

/**
 * Reads an RSS or Atom feed. `aiOnly` keeps only items whose title or summary
 * mentions AI, for publishers that cover other subjects too.
 */
function feed(source: string, url: string, aiOnly = false): FeedSource {
  return {
    source,
    collect: async () => {
      const xml = await getText(url);
      const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
      const items: FeedItem[] = [];
      for (const block of blocks) {
        const title = plain(field(block, "title"));
        const link =
          plain(field(block, "link")) ||
          (block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i)?.[1] ??
            block.match(/<link[^>]*href=["']([^"']+)/i)?.[1] ??
            "");
        const when = Date.parse(
          plain(field(block, "pubDate") || field(block, "published") || field(block, "updated") || field(block, "dc:date")),
        );
        if (!title || !/^https?:\/\//.test(link) || Number.isNaN(when)) continue;
        if (aiOnly) {
          // Only the opening of the summary: some feeds put the whole article there.
          const text = `${title} ${plain(field(block, "description") || field(block, "summary")).slice(0, 300)}`;
          if (!MENTIONS_AI_EXACT.test(text) && !MENTIONS_AI.test(text)) continue;
        }
        items.push({ source, title, url: link, publishedAt: new Date(when).toISOString() });
      }
      if (blocks.length === 0) throw new Error("feed had no entries");
      return items;
    },
  };
}

const metaTag = (html: string, property: string) =>
  html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? "";

/** Publication day of an Anthropic page; the site states it in one of three ways. */
function anthropicPageDate(html: string): string | null {
  const raw =
    metaTag(html, "article:published_time") ||
    (html.match(/dateTime=["'](\d{4}-\d{2}-\d{2})/)?.[1] ?? "") ||
    (html.match(
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d)\b/,
    )?.[1] ?? "");
  const when = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw.includes(",") ? `${raw} UTC` : raw);
  return Number.isNaN(when) ? null : new Date(when).toISOString();
}

/**
 * Anthropic publishes no feed. Its sitemap lists every article with the date
 * it last changed, so this opens the most recently changed ones and reads the
 * title and publication date from each page. Model launches sit at the top
 * level of the site (/claude-…), not under /news.
 */
const ANTHROPIC_PAGES_TO_CHECK = 14;

const anthropicNews: FeedSource = {
  source: "Anthropic",
  collect: async () => {
    const sitemap = await getText("https://www.anthropic.com/sitemap.xml");
    const pages = [
      ...sitemap.matchAll(
        /<loc>(https:\/\/www\.anthropic\.com\/(?:(?:news|research)\/[a-z0-9-]+|claude-[a-z0-9-]+))<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g,
      ),
    ]
      .map(([, url, changed]) => ({ url, changed }))
      .sort((x, y) => y.changed.localeCompare(x.changed))
      .slice(0, ANTHROPIC_PAGES_TO_CHECK);
    if (pages.length === 0) throw new Error("no articles in the sitemap");

    const items: FeedItem[] = [];
    for (const { url } of pages) {
      const html = await getText(url);
      const title = plain(metaTag(html, "og:title"));
      const publishedAt = anthropicPageDate(html);
      if (title && publishedAt) items.push({ source: "Anthropic", title, url, publishedAt });
      await sleep(300);
    }
    if (items.length === 0) throw new Error("article pages had no title or date (their layout may have changed)");
    return items;
  },
};

/** Writers and institutions that explain what AI is doing to work, firms and society. */
const ANALYST_SOURCES: FeedSource[] = [
  feed("One Useful Thing", "https://www.oneusefulthing.org/feed"),
  feed("Epoch AI", "https://epoch.ai/atom.xml"),
  feed("AI Supremacy", "https://www.ai-supremacy.com/feed"),
  feed("The Product Compass", "https://www.productcompass.pm/feed", true),
  feed("The Pragmatic Engineer", "https://newsletter.pragmaticengineer.com/feed", true),
  feed("a16z News", "https://www.a16z.news/feed", true),
  feed("Benedict Evans", "https://www.ben-evans.com/benedictevans?format=rss", true),
  feed("NBER", "https://www.nber.org/rss/new.xml", true),
  feed("PIIE", "https://www.piie.com/rss/update.xml", true),
  feed("Pew Research Center", "https://www.pewresearch.org/topic/internet-technology/feed/", true),
];

const LAB_SOURCES: FeedSource[] = [
  anthropicNews,
  feed("OpenAI", "https://openai.com/news/rss.xml"),
  feed("Google DeepMind", "https://deepmind.google/blog/rss.xml"),
];

const FEED_WINDOW_DAYS = 30;
const FEED_KEEP = 12;

/**
 * Newest items across several sources, with a cap per source so one prolific
 * publisher cannot fill the list. A source that fails keeps its previous items.
 */
async function newestFrom(
  sources: FeedSource[],
  perSource: number,
  previous: FeedItem[],
): Promise<{ items: FeedItem[]; failed: string[] }> {
  const cutoff = Date.now() - FEED_WINDOW_DAYS * DAY;
  const latestAllowed = Date.now() + DAY; // institutions list future events in their feeds
  const failed: string[] = [];
  const all: FeedItem[] = [];
  for (const s of sources) {
    let items: FeedItem[];
    try {
      items = await s.collect();
    } catch (err) {
      failed.push(s.source);
      console.warn(`  ! ${s.source} failed: ${(err as Error).message}`);
      items = previous.filter((p) => p.source === s.source);
    }
    const seen = new Set<string>();
    all.push(
      ...items
        .filter((i) => {
          const when = Date.parse(i.publishedAt);
          return when >= cutoff && when <= latestAllowed && !seen.has(i.url) && seen.add(i.url);
        })
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, perSource),
    );
    await sleep(300);
  }
  all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items: all.slice(0, FEED_KEEP), failed };
}

// ------------------------------------------------------------ indicators

/** Share of US job postings on Indeed that mention AI skills, at each month's last reading. */
async function jobPostings(): Promise<NonNullable<Indicators["jobs"]>> {
  const csv = await getText("https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/AI_posting.csv");
  const byMonth = new Map<string, { day: string; share: number }>();
  for (const row of csv.split("\n").slice(1)) {
    const [day, country, value] = row.trim().split(",");
    const share = Number(value);
    if (country !== "US" || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") || !Number.isFinite(share)) continue;
    const month = day.slice(0, 7);
    const held = byMonth.get(month);
    if (!held || day > held.day) byMonth.set(month, { day, share });
  }
  const months = [...byMonth.keys()].sort().slice(-25);
  if (months.length < 13) throw new Error("fewer than 13 months of US data");
  return {
    asOf: byMonth.get(months.at(-1)!)!.day,
    months: months.map((month) => ({ month, share: Math.round(byMonth.get(month)!.share * 100) / 100 })),
  };
}

/** Documents in the US Federal Register that mention "artificial intelligence", per complete month. */
async function federalDocuments(previous: Indicators["federal"]): Promise<NonNullable<Indicators["federal"]>> {
  const now = new Date();
  const known = new Map(previous?.months.map((m) => [m.month, m.count]));
  const months: { month: string; count: number }[] = [];
  for (let back = 13; back >= 1; back--) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const month = first.toISOString().slice(0, 7);
    let count = known.get(month);
    if (count === undefined || back === 1) {
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const params = new URLSearchParams({
        per_page: "1",
        "conditions[term]": '"artificial intelligence"',
        "conditions[publication_date][gte]": `${month}-01`,
        "conditions[publication_date][lte]": `${month}-${String(lastDay).padStart(2, "0")}`,
      });
      const data = await getJson<{ count?: number }>(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
      if (typeof data.count !== "number") throw new Error(`no count returned for ${month}`);
      count = data.count;
      await sleep(300);
    }
    months.push({ month, count });
  }
  return { months };
}

/** A release is only logged when first seen within this many days, so a feed's short memory cannot misdate old models. */
const RELEASE_FRESH_DAYS = 200;

/**
 * The first post announcing each new version number of a lab's main model
 * line, e.g. "GPT-6.1" or "Gemini 4". Variants of a version already seen
 * (Flash, mini, Sol…) do not count again.
 */
async function versionedReleases(source: FeedSource, pattern: RegExp, name: (version: string) => string): Promise<Release[]> {
  const first = new Map<string, Release>();
  for (const item of await source.collect()) {
    const version = item.title.match(pattern)?.[1];
    if (!version) continue;
    const model = name(version);
    const held = first.get(model);
    if (!held || item.publishedAt < held.date) {
      first.set(model, { lab: source.source, model, url: item.url, date: item.publishedAt });
    }
  }
  return [...first.values()];
}

/** Anthropic model launches: sitemap pages named claude-…, opened once each and remembered. */
async function anthropicReleases(checked: Record<string, Release | null>): Promise<void> {
  const sitemap = await getText("https://www.anthropic.com/sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.anthropic\.com\/(?:news\/)?claude-[a-z0-9-]*\d[a-z0-9-]*)<\/loc>/g)].map(
    (m) => m[1],
  );
  if (urls.length === 0) throw new Error("no model pages in the sitemap");
  for (const url of urls) {
    if (url in checked) continue;
    const html = await getText(url);
    const title = plain(metaTag(html, "og:title"));
    const date = anthropicPageDate(html);
    const model = title.match(/^(?:Introducing )?(Claude\b.*\d.*)$/)?.[1];
    checked[url] = model && date ? { lab: "Anthropic", model, url, date } : null;
    await sleep(300);
  }
}

async function modelReleases(
  previous: Indicators["releases"],
): Promise<{ releases: NonNullable<Indicators["releases"]>; failed: string[] }> {
  const failed: string[] = [];
  const checked = { ...(previous?.anthropicChecked ?? {}) };
  const log = new Map<string, Release>();
  for (const r of previous?.log ?? []) if (r.lab !== "Anthropic") log.set(`${r.lab}|${r.model}`, r);
  const freshFrom = new Date(Date.now() - RELEASE_FRESH_DAYS * DAY).toISOString();

  const feeds: [FeedSource, RegExp, (v: string) => string][] = [
    [
      feed("OpenAI", "https://openai.com/news/rss.xml"),
      /^(?:Introducing |Previewing |Announcing )?GPT[-‑ ]?(\d+(?:\.\d+)?)/,
      (v) => `GPT-${v}`,
    ],
    [feed("Google DeepMind", "https://deepmind.google/blog/rss.xml"), /^(?:Introducing )?Gemini (\d+(?:\.\d+)?)\b/, (v) => `Gemini ${v}`],
  ];
  for (const [source, pattern, name] of feeds) {
    try {
      for (const r of await versionedReleases(source, pattern, name)) {
        const key = `${r.lab}|${r.model}`;
        const held = log.get(key);
        if (held ? r.date < held.date : r.date >= freshFrom) log.set(key, r);
      }
    } catch (err) {
      failed.push(source.source);
      console.warn(`  ! ${source.source} releases failed: ${(err as Error).message}`);
    }
  }
  try {
    await anthropicReleases(checked);
  } catch (err) {
    failed.push("Anthropic");
    console.warn(`  ! Anthropic releases failed: ${(err as Error).message}`);
  }
  const all = [...log.values(), ...Object.values(checked).filter((r): r is Release => r !== null && r.date >= freshFrom)];
  all.sort((a, b) => b.date.localeCompare(a.date));
  return { releases: { log: all, anthropicChecked: checked }, failed };
}

// ------------------------------------------------------------------ main

async function collectHistory(history: History, weeks: string[], status: Record<string, SourceStatus>) {
  const refresh = new Set(weeks.slice(-WEEKS_TO_REFRESH));
  const needs = (series: Record<string, number> | undefined, week: string) =>
    refresh.has(week) || series?.[week] === undefined;

  // Hacker News is quick, so it goes first.
  try {
    for (const topic of TOPICS) {
      const series = ((history.topics[topic.id] ??= { arxiv: {}, hn: {} }).hn ??= {});
      for (const week of weeks) if (needs(series, week)) series[week] = await hnCount(week, topic.hn);
      console.log(`  hn     ${topic.id}`);
    }
    status.hnHistory = { ok: true, at: new Date().toISOString() };
  } catch (err) {
    status.hnHistory = { ok: false, at: new Date().toISOString(), error: (err as Error).message };
    console.warn(`  ! Hacker News history failed: ${(err as Error).message}`);
  }

  try {
    const totals = (history.hnAiTotal ??= {});
    for (const week of weeks) if (needs(totals, week)) totals[week] = await hnAiCount(week);
    const themes = (history.themes ??= {});
    for (const theme of THEMES) {
      const series = (themes[theme.id] ??= {});
      for (const week of weeks) if (needs(series, week)) series[week] = await hnThemeCount(week, theme.hn);
      console.log(`  theme  ${theme.id}`);
    }
    status.hnThemes = { ok: true, at: new Date().toISOString() };
  } catch (err) {
    status.hnThemes = { ok: false, at: new Date().toISOString(), error: (err as Error).message };
    console.warn(`  ! Hacker News themes failed: ${(err as Error).message}`);
  }

  // arXiv is rate-limited to one request per three seconds; in --fast mode
  // only the newest weeks are refreshed and gaps are left for a full run.
  try {
    const arxivWeeks = FAST ? weeks.slice(-WEEKS_TO_REFRESH) : weeks;
    for (const week of arxivWeeks) {
      if (needs(history.arxivTotal, week)) history.arxivTotal[week] = await arxivCount(week, null);
    }
    for (const topic of TOPICS) {
      const series = ((history.topics[topic.id] ??= { arxiv: {}, hn: {} }).arxiv ??= {});
      for (const week of arxivWeeks) {
        if (needs(series, week)) series[week] = await arxivCount(week, topic.arxiv);
      }
      console.log(`  arxiv  ${topic.id}`);
      await writeJson("history.json", history); // save progress; a full backfill takes several minutes
    }
    status.arxivHistory = { ok: true, at: new Date().toISOString() };
  } catch (err) {
    status.arxivHistory = { ok: false, at: new Date().toISOString(), error: (err as Error).message };
    console.warn(`  ! arXiv history failed: ${(err as Error).message}`);
  }
}

async function main() {
  const now = new Date();
  const weeks = completedWeeks(WEEKS_OF_HISTORY, now);
  const history = await readJson<History>("history.json", { updatedAt: "", arxivTotal: {}, topics: {} });
  const previous = await readJson<Latest | null>("latest.json", null);
  const status: Record<string, SourceStatus> = { ...(previous?.sources ?? {}) };

  /** Runs one list collector; on failure keeps the previously saved list. */
  async function list<K extends "papers" | "repos" | "models" | "releases" | "stories">(
    key: K,
    collect: () => Promise<Latest[K]>,
  ): Promise<Latest[K]> {
    try {
      const items = await collect();
      if (items.length === 0) throw new Error("source returned no items");
      status[key] = { ok: true, at: new Date().toISOString() };
      console.log(`  ${key}: ${items.length}`);
      return items;
    } catch (err) {
      status[key] = { ok: false, at: status[key]?.at ?? "", error: (err as Error).message };
      console.warn(`  ! ${key} failed: ${(err as Error).message}`);
      return (previous?.[key] ?? []) as Latest[K];
    }
  }

  /** Like `list`, for lists merged from several feeds; names the feeds that failed. */
  async function feedList(key: "analysis" | "labNews", sources: FeedSource[], perSource: number) {
    const { items, failed } = await newestFrom(sources, perSource, previous?.[key] ?? []);
    status[key] = failed.length
      ? { ok: false, at: status[key]?.at ?? "", error: `no response from ${failed.join(", ")}` }
      : { ok: true, at: new Date().toISOString() };
    console.log(`  ${key}: ${items.length}`);
    return items;
  }

  console.log("Collecting current lists…");
  const latest: Latest = {
    generatedAt: now.toISOString(),
    sources: status,
    papers: await list("papers", hfPapers),
    models: await list("models", hfTrendingModels),
    releases: await list("releases", hfLabReleases),
    stories: await list("stories", hnTopStories),
    repos: await list("repos", githubRisingRepos),
    analysis: await feedList("analysis", ANALYST_SOURCES, 2),
    labNews: await feedList("labNews", LAB_SOURCES, 4),
  };
  await writeJson("latest.json", latest);

  console.log("Collecting indicators…");
  const before = await readJson<Indicators>("indicators.json", { updatedAt: "", jobs: null, federal: null, releases: null });
  const indicators: Indicators = { ...before, updatedAt: now.toISOString() };
  async function indicator(key: string, collect: () => Promise<void>) {
    try {
      await collect();
      status[key] = { ok: true, at: new Date().toISOString() };
      console.log(`  ${key}: ok`);
    } catch (err) {
      status[key] = { ok: false, at: status[key]?.at ?? "", error: (err as Error).message };
      console.warn(`  ! ${key} failed: ${(err as Error).message}`);
    }
  }
  await indicator("jobs", async () => void (indicators.jobs = await jobPostings()));
  await indicator("federal", async () => void (indicators.federal = await federalDocuments(before.federal)));
  await indicator("modelReleases", async () => {
    const { releases, failed } = await modelReleases(before.releases);
    indicators.releases = releases;
    if (failed.length) throw new Error(`no response from ${failed.join(", ")}`);
  });
  await writeJson("indicators.json", indicators);

  console.log(`Collecting weekly topic history (${weeks[0]} → ${weeks.at(-1)})${FAST ? " [fast]" : ""}…`);
  await collectHistory(history, weeks, status);
  history.updatedAt = new Date().toISOString();
  await writeJson("history.json", history);

  latest.sources = status;
  await writeJson("latest.json", latest);
  await writeJson(`snapshots/${isoDay(now)}.json`, latest);

  const failed = Object.entries(status).filter(([, s]) => !s.ok).map(([k]) => k);
  console.log(failed.length ? `Done, with failures: ${failed.join(", ")}` : "Done. All sources OK.");
}

await main();
