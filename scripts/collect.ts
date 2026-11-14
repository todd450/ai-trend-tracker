/**
 * Collects AI trend data from free public sources and writes it to data/:
 * arXiv, Hacker News, GitHub, Hugging Face, plus newsletter and lab news feeds.
 *
 *   npm run collect            everything
 *   npm run collect -- --fast  skip the slow arXiv history backfill
 *   npm run collect -- --accept  store weekly counts without the plausibility checks
 *   npm run collect -- --counted only rewrite counted.json from the stored counts
 *   npm run collect -- --recount <theme id>  recount every stored week of one theme and its
 *                                             sub-themes, after one of its searches is edited
 *
 * Output:
 *   data/history.json              weekly mention counts per topic (grows over time)
 *   data/latest.json               current ranked lists (papers, repos, models, news)
 *   data/indicators.json           job-posting, federal, model-release, download, business-survey and model-share figures
 *   data/counted.json              the few stories and papers behind each rising move the headlines name
 *   data/snapshots/YYYY-MM-DD.json a dated copy of the lists and of counted.json, kept as a record
 *
 * No API keys are required. Set GITHUB_TOKEN to raise GitHub's rate limit.
 * If one source fails, the previous data for that source is kept and the
 * failure is recorded in latest.json so the site can show it. A weekly count
 * that a source returns but that is not believable (see sanity.ts) is treated
 * the same way, and the newest week is held back until all of it is in.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { phraseIn, pickPapers, pickStories, risingMoves, type CountedFile, type CountedMove, type CountedStory, type PaperCandidate, type Span } from "../src/lib/counted.ts";
import { PRODUCTS } from "../src/lib/products.ts";
import { THEMES, hnWordRules, subthemeKey, type Theme } from "../src/lib/themes.ts";
import { TOOLKITS, packageKey } from "../src/lib/toolkits.ts";
import { TOPICS } from "../src/lib/topics.ts";
import type { FeedItem, History, Indicators, Latest, Release, SourceStatus } from "../src/lib/types.ts";
import { weeklyMakerTokens, type RankingRow } from "./marketShare.ts";
import { implausible, type Kind } from "./sanity.ts";
// Lets the collector read the site's own modules, to name the moves exactly as the page does.
import { fromSrc } from "./support/load-src.ts";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
/** Enough for the two-year view: 52 weeks compared with the 52 before. */
const WEEKS_OF_HISTORY = 104;
/** The newest weeks are re-counted each run because sources index late. */
const WEEKS_TO_REFRESH = 2;
const USER_AGENT = "ai-trend-tracker (public dashboard; collector script)";
const DAY = 86_400_000;
const FAST = process.argv.includes("--fast");
/** Skips the plausibility checks, for a person who has looked at a rejected figure and found it real. */
const ACCEPT = process.argv.includes("--accept");
/** Rewrites only counted.json, from the counts already stored. */
const COUNTED_ONLY = process.argv.includes("--counted");
/** Recounts every stored week of one theme, after one of its searches was edited. */
const RECOUNT = process.argv.includes("--recount") ? (process.argv[process.argv.indexOf("--recount") + 1] ?? "") : null;

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

async function getBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).host}`);
  return Buffer.from(await res.arrayBuffer());
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

/** arXiv's search for AI papers submitted from the Monday `first` to the end of the Sunday after `last`, optionally matching any phrase. */
function arxivQuery(first: string, last: string, phrases: string[] | null): string {
  const start = new Date(first + "T00:00:00Z");
  const end = new Date(Date.parse(last + "T00:00:00Z") + 6 * DAY);
  const stamp = (d: Date, hhmm: string) => isoDay(d).replaceAll("-", "") + hhmm;
  const parts = [`(${ARXIV_CATEGORIES.map((c) => `cat:${c}`).join(" OR ")})`];
  if (phrases) parts.push(`(${phrases.map((p) => `abs:"${p}" OR ti:"${p}"`).join(" OR ")})`);
  parts.push(`submittedDate:[${stamp(start, "0000")} TO ${stamp(end, "2359")}]`);
  return parts.join(" AND ");
}

/** One arXiv API request, paced and retried as arXiv asks; `read` turns the answer into a result or throws. */
async function arxivFetch<T>(params: Record<string, string>, read: (xml: string) => T): Promise<T> {
  const url = `https://export.arxiv.org/api/query?${new URLSearchParams(params)}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    // arXiv asks for at most one request every three seconds, and answers 429
    // for a minute or more during a long backfill, so retries wait 30s, 60s, 90s, 120s.
    await sleep(attempt === 0 ? 3100 : 30_000 * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`arXiv responded ${res.status}`);
      return read(await res.text());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Number of AI papers submitted in a week, optionally matching any phrase. */
function arxivCount(weekStart: string, phrases: string[] | null): Promise<number> {
  return arxivFetch({ max_results: "1", search_query: arxivQuery(weekStart, weekStart, phrases) }, (xml) => {
    const match = xml.match(/<opensearch:totalResults[^>]*>(\d+)</);
    if (!match) throw new Error("arXiv response had no result count");
    return Number(match[1]);
  });
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
      ...hnWordRules(query),
      numericFilters: `created_at_i>=${from},created_at_i<${from + 7 * 86400}`,
      attributesToRetrieve: "objectID",
      attributesToHighlight: "",
      hitsPerPage: String(hitsPerPage),
    }),
  );
}

/**
 * Distinct stories in a week matching a theme, and matching each of its sub-themes.
 * Each search runs once; the theme is the union of its sub-themes' matches.
 */
async function hnThemeCounts(weekStart: string, theme: Theme): Promise<{ total: number; parts: Record<string, number> }> {
  const matches = new Map<string, string[]>();
  for (const query of theme.hn) {
    matches.set(query, (await hnWeek(weekStart, query, 1000)).hits.map((hit) => hit.objectID));
    await sleep(120);
  }
  const distinct = (queries: string[]) => new Set(queries.flatMap((q) => matches.get(q) ?? [])).size;
  return {
    total: distinct(theme.hn),
    parts: Object.fromEntries(theme.parts.map((part) => [part.id, distinct(part.hn)])),
  };
}

/** All stories in a week with the word AI in the title; the denominator for theme share. */
const hnAiCount = async (weekStart: string) => (await hnWeek(weekStart, "AI", 0)).nbHits;

const HN_NEWS_QUERIES = ["AI", "LLM", "OpenAI", "Anthropic", "Claude", "GPT", "Gemini", "DeepMind", "agents", "neural"];

/** The most upvoted AI stories newer than `since`, with at least `minPoints`, best first. */
async function hnStories(since: number, minPoints: number, limit: number): Promise<Latest["stories"]> {
  const seen = new Map<string, HnHit>();
  for (const query of HN_NEWS_QUERIES) {
    const data = await getJson<HnResponse>(
      hnUrl({
        query,
        restrictSearchableAttributes: "title",
        typoTolerance: "false",
        queryType: "prefixNone", // otherwise "AI" also matches "Airplanes"
        numericFilters: `created_at_i>=${Math.floor(since / 1000)},points>=${minPoints}`,
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
    .slice(0, limit)
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

const hnTopStories = () => hnStories(Date.now() - 7 * DAY, 100, 20);

/**
 * The past day's AI stories, for "Today's AI news". The bar is far lower than the week's list,
 * because a story a few hours old has not had time to collect points.
 */
const hnTodayStories = () => hnStories(Date.now() - DAY, 20, 12);

/**
 * Title words that mark a launch as an AI product. Wider than the news searches, because a
 * launch names what the thing does ("for agents", "an MCP for…") more often than it says "AI".
 */
const LAUNCH_MENTIONS_AI =
  /\b(A\.?I|artificial intelligence|LLMs?|chatbots?|ChatGPT|GPT|generative|machine learning|agentic|agents?|MCP|Claude|Codex|Copilot|Gemini|Gemma|Llama|OpenAI|Anthropic|Mistral|DeepSeek|diffusion|neural|transformers?|fine-tun\w+|RAG)\b/;
const LAUNCH_PREFIX = /^(Show|Launch) HN\s*[:–-]\s*/i;
const LAUNCH_MIN_POINTS = 10;

/**
 * The past week's product launches on Hacker News that name AI in the title, most upvoted first.
 * "Show HN" posts carry their own tag; "Launch HN" posts (Y Combinator companies) are ordinary
 * stories found by title. Both come from the same search API as the news, so no new site is read.
 */
async function hnLaunches(): Promise<NonNullable<Latest["launches"]>> {
  const window = `created_at_i>=${Math.floor((Date.now() - 7 * DAY) / 1000)},points>=${LAUNCH_MIN_POINTS}`;
  const show = await getJson<HnResponse>(hnUrl({ tags: "show_hn", numericFilters: window, hitsPerPage: "500" }));
  await sleep(120);
  const launch = await getJson<HnResponse>(
    hnUrl({
      query: '"Launch HN"',
      restrictSearchableAttributes: "title",
      typoTolerance: "false",
      numericFilters: window,
      hitsPerPage: "100",
    }),
  );
  const seen = new Map<string, HnHit>();
  for (const hit of [...show.hits, ...launch.hits]) seen.set(hit.objectID, hit);
  return [...seen.values()]
    .filter((h) => LAUNCH_PREFIX.test(h.title) && LAUNCH_MENTIONS_AI.test(h.title.replace(LAUNCH_PREFIX, "")))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
    .map((h) => {
      const discussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        id: h.objectID,
        title: h.title.replace(LAUNCH_PREFIX, "").trim(),
        kind: /^Launch/i.test(h.title) ? ("Launch HN" as const) : ("Show HN" as const),
        url: h.url ?? discussionUrl, // a Launch HN post has no link of its own; the post is the launch
        discussionUrl,
        points: h.points,
        comments: h.num_comments ?? 0,
        createdAt: h.created_at,
      };
    });
}

// ------------------------------------------------------------- Wikipedia

/**
 * Wikimedia allows a script that sends no contact address ten requests a minute, so the
 * collector sends one every seven seconds. A whole run is about thirty requests.
 */
const WIKI_PAUSE = 7000;

type Pageviews = { items?: { timestamp: string; views: number }[] };

/**
 * Views of a product's English Wikipedia article in each of `weeks`, summed over every title
 * the article has carried. Counts people only: the API's "user" agent leaves out crawlers.
 * One request per title covers the whole span. A week is left out when its last day has not
 * been published yet, so a short week is never stored as a fall.
 */
async function wikiWeeklyViews(titles: string[], weeks: string[]): Promise<Record<string, number>> {
  const day = (iso: string) => iso.replaceAll("-", "");
  const lastDay = isoDay(new Date(Date.parse(weeks.at(-1)! + "T00:00:00Z") + 6 * DAY));
  const daily = new Map<string, number>();
  for (const title of titles) {
    const url =
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/" +
      `${encodeURIComponent(title.replaceAll(" ", "_"))}/daily/${day(weeks[0])}/${day(lastDay)}`;
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      await sleep(WIKI_PAUSE);
      if (res.status !== 429 || attempt === 2) break;
      // Told to slow down: wait as long as asked (five seconds if not said), at most two minutes.
      await sleep(Math.min(Number(res.headers.get("retry-after")) || 5, 120) * 1000);
    }
    if (res.status === 404) {
      console.log(`  wiki   no views under "${title}"`); // a title not in use for any of the span
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for wikimedia.org`);
    for (const item of ((await res.json()) as Pageviews).items ?? []) {
      const key = item.timestamp.slice(0, 8);
      daily.set(key, (daily.get(key) ?? 0) + item.views);
    }
  }
  const out: Record<string, number> = {};
  for (const week of weeks) {
    const days = Array.from({ length: 7 }, (_, i) => daily.get(day(isoDay(new Date(Date.parse(week + "T00:00:00Z") + i * DAY)))) ?? 0);
    const total = days.reduce((a, b) => a + b, 0);
    if (week === weeks.at(-1) && days[6] === 0 && total >= 6 * 20) continue;
    out[week] = total;
  }
  return out;
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
  const skipped: string[] = [];
  for (const lab of MODEL_LABS) {
    try {
      const data = await getJson<HfModel[]>(
        `https://huggingface.co/api/models?author=${lab}&sort=createdAt&direction=-1&limit=15`,
      );
      for (const m of data) {
        if (Date.parse(m.createdAt) >= cutoff) releases.push({ ...toModel(m), lab });
      }
    } catch (err) {
      skipped.push(lab);
      console.warn(`  ! skipped ${lab}: ${(err as Error).message}`);
    }
    await sleep(150);
  }
  // A list built from a minority of the labs is not the list; the caller keeps the previous one.
  if (skipped.length > MODEL_LABS.length / 2) {
    throw new Error(`no response for ${skipped.length} of ${MODEL_LABS.length} labs`);
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

type FeedSource = {
  source: string;
  collect: () => Promise<FeedItem[]>;
  /** Places this source may take in its list, when fewer than the list's usual number. */
  limit?: number;
};

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
 * mentions AI, for publishers that cover other subjects too. `categories` keeps
 * only items filed under one of those, for blogs that mix announcements with how-to articles.
 */
function feed(source: string, url: string, aiOnly = false, categories?: string[]): FeedSource {
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
        if (categories) {
          const filed = [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) => plain(m[1]));
          if (!filed.some((c) => categories.includes(c))) continue;
        }
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

/** How far back a lab's posts are looked for on Hacker News; the reading list shows 30 days. */
const HN_POST_DAYS = 30;

/**
 * For a lab that publishes no feed. A script reading its pages is what site terms most often
 * bar, so its posts are found through Hacker News instead: every story from the past 30 days
 * that links to an article on the lab's site. Nothing is requested from the lab.
 *
 * A post nobody submitted is missed. The headline is the one on the most-upvoted
 * submission, which is nearly always the article's own, and the date is the first submission.
 * `domain` is searched for in story links, `post` says which of those links are articles, and
 * `prefix` is a label submitters put before the headline.
 */
async function hnPosts(source: string, domain: string, post: RegExp, prefix: RegExp): Promise<FeedItem[]> {
  const since = Math.floor((Date.now() - HN_POST_DAYS * DAY) / 1000);
  const data = await getJson<HnResponse>(
    "https://hn.algolia.com/api/v1/search_by_date?" +
      new URLSearchParams({
        tags: "story",
        query: domain,
        restrictSearchableAttributes: "url",
        numericFilters: `created_at_i>${since}`,
        hitsPerPage: "100",
      }),
  );
  const posts = new Map<string, { title: string; points: number; first: string }>();
  for (const hit of data.hits) {
    const url = (hit.url ?? "").replace(/[?#].*$/, "").replace(/\/$/, "");
    const title = (hit.title ?? "").replace(prefix, "").replace(/\s*\[pdf\]$/i, "").trim();
    if (!post.test(url) || !title) continue;
    const held = posts.get(url);
    if (!held) posts.set(url, { title, points: hit.points ?? 0, first: hit.created_at });
    else {
      if ((hit.points ?? 0) > held.points) Object.assign(held, { title, points: hit.points });
      if (hit.created_at < held.first) held.first = hit.created_at;
    }
  }
  return [...posts].map(([url, held]) => ({
    source,
    title: held.title,
    url,
    publishedAt: new Date(held.first).toISOString(),
  }));
}

/** An article or model page on Anthropic's site. Section pages such as /news/policy have one-word names. */
const ANTHROPIC_POST = /^https:\/\/www\.anthropic\.com\/(?:(?:news|research)\/[a-z0-9]+-[a-z0-9-]+|claude-[a-z0-9-]+)$/;

const anthropicPosts = () => hnPosts("Anthropic", "anthropic.com", ANTHROPIC_POST, /^Anthropic:\s*/i);

/** A lab with no feed, read through Hacker News. An empty result is not a failure: a quiet month has no stories. */
const viaHackerNews = (source: string, domain: string, post: RegExp): FeedSource => ({
  source,
  collect: () => hnPosts(source, domain, post, new RegExp(`^${source}:\\s*`, "i")),
});

const anthropicNews: FeedSource = { source: "Anthropic", collect: anthropicPosts };

/**
 * Writers and institutions that explain what AI is doing to work, firms and society.
 * Before adding a feed, read the publisher's terms: NBER and PIIE were removed because
 * theirs bar any automatic access to their sites, feeds included.
 */
const ANALYST_SOURCES: FeedSource[] = [
  feed("One Useful Thing", "https://www.oneusefulthing.org/feed"),
  feed("Epoch AI", "https://epoch.ai/atom.xml"),
  feed("AI Supremacy", "https://www.ai-supremacy.com/feed"),
  feed("The Product Compass", "https://www.productcompass.pm/feed", true),
  feed("The Pragmatic Engineer", "https://newsletter.pragmaticengineer.com/feed", true),
  feed("a16z News", "https://www.a16z.news/feed", true),
  feed("Benedict Evans", "https://www.ben-evans.com/benedictevans?format=rss", true),
  feed("Pew Research Center", "https://www.pewresearch.org/topic/internet-technology/feed/", true),
];

/** A specialist lab posts about one kind of model, so it gets fewer places than a frontier lab. */
const specialist = (source: FeedSource): FeedSource => ({ ...source, limit: 2 });

/**
 * The labs whose own announcements are listed: the frontier labs, then smaller ones known for
 * one kind of model.
 *
 * A lab's feed is read only where its terms were read first and do not bar it (November 2026):
 * ElevenLabs' defer to its robots.txt, which allows the feed; Microsoft's and Mistral's have no
 * bar on automated reading and both sites advertise the feed. The rest go through Hacker News,
 * so nothing is requested from them: xAI, DeepSeek and Runway publish no feed and their terms
 * bar scripted reading of pages, and Meta's, Suno's and Stability AI's terms bar automated
 * access with no exception for the feeds they publish.
 */
const LAB_SOURCES: FeedSource[] = [
  anthropicNews,
  feed("OpenAI", "https://openai.com/news/rss.xml"),
  feed("Google DeepMind", "https://deepmind.google/blog/rss.xml"),
  feed("Microsoft", "https://blogs.microsoft.com/feed/", true), // the company blog covers other subjects too
  feed("Mistral AI", "https://mistral.ai/news/rss"),
  viaHackerNews("Meta", "about.fb.com", /^https:\/\/about\.fb\.com\/news\/\d{4}\/\d{2}\/[a-z0-9-]+$/),
  viaHackerNews("xAI", "x.ai", /^https:\/\/x\.ai\/news\/[a-z0-9-]+$/),
  viaHackerNews("DeepSeek", "deepseek.com", /^https:\/\/api-docs\.deepseek\.com\/news\/news\d{6}$/),
  specialist(feed("ElevenLabs", "https://elevenlabs.io/blog/rss.xml", false, ["Product", "Company", "Research"])), // voice
  specialist(viaHackerNews("Runway", "runway.com", /^https:\/\/runway(?:ml)?\.com\/news\/(?:company-news|research)\/[a-z0-9-]+$/)), // video
  specialist(viaHackerNews("Suno", "suno.com", /^https:\/\/suno\.com\/blog\/[A-Za-z0-9-]+$/)), // music
  specialist(viaHackerNews("Stability AI", "stability.ai", /^https:\/\/stability\.ai\/news-updates\/[a-z0-9-]+$/)), // images and audio
];

const FEED_WINDOW_DAYS = 30;
const FEED_KEEP = 12;
/** The lab list is longer: many labs share it, and a busy week should not push a quiet lab's launch off the end. */
const LAB_KEEP = 18;

/**
 * Newest items across several sources, with a cap per source so one prolific
 * publisher cannot fill the list. A source that fails keeps its previous items.
 */
async function newestFrom(
  sources: FeedSource[],
  perSource: number,
  previous: FeedItem[],
  keep = FEED_KEEP,
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
        .slice(0, Math.min(perSource, s.limit ?? perSource)),
    );
    await sleep(300);
  }
  all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items: all.slice(0, keep), failed };
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

/** Months of downloads kept per package: a year-on-year comparison plus a year to compare against. */
const DOWNLOAD_MONTHS_KEPT = 25;

type Downloads = NonNullable<Indicators["downloads"]>;

/** Totals for the months a run of daily counts covers from first day to last; part-months are dropped. */
function completeMonths(days: { day: string; downloads: number }[]): Record<string, number> {
  const byMonth = new Map<string, { days: Set<string>; total: number }>();
  for (const { day, downloads } of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(downloads)) continue;
    const held = byMonth.get(day.slice(0, 7)) ?? { days: new Set<string>(), total: 0 };
    if (!held.days.has(day)) held.total += downloads;
    held.days.add(day);
    byMonth.set(day.slice(0, 7), held);
  }
  const thisMonth = isoDay(new Date()).slice(0, 7);
  const totals: Record<string, number> = {};
  for (const [month, held] of byMonth) {
    const [year, m] = month.split("-").map(Number);
    const length = new Date(Date.UTC(year, m, 0)).getUTCDate();
    if (month < thisMonth && held.days.size === length) totals[month] = held.total;
  }
  return totals;
}

/** Like getJson, but waits and tries again when a registry asks the collector to slow down. */
async function getJsonPatiently<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getJson<T>(url);
    } catch (err) {
      if (attempt === 3 || !/^(429|5\d\d) /.test((err as Error).message)) throw err;
      await sleep(attempt * 10_000);
    }
  }
}

/** A package's daily downloads from npm, for the thirteen complete months before this one. */
async function npmDownloads(name: string): Promise<Record<string, number>> {
  const now = new Date();
  const from = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 13, 1)));
  const to = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
  const data = await getJsonPatiently<{ downloads?: { day: string; downloads: number }[] }>(
    `https://api.npmjs.org/downloads/range/${from}:${to}/${name}`,
  );
  if (!data.downloads?.length) throw new Error(`no npm downloads returned for ${name}`);
  return completeMonths(data.downloads);
}

/** A package's daily downloads from PyPI, leaving out mirrors. PyPI Stats keeps about 180 days. */
async function pypiDownloads(name: string): Promise<Record<string, number>> {
  const data = await getJsonPatiently<{ data?: { category: string; date: string; downloads: number }[] }>(
    `https://pypistats.org/api/packages/${name}/overall?mirrors=false`,
  );
  const days = (data.data ?? []).filter((d) => d.category === "without_mirrors").map((d) => ({ day: d.date, downloads: d.downloads }));
  if (!days.length) throw new Error(`no PyPI downloads returned for ${name}`);
  return completeMonths(days);
}

/**
 * Monthly downloads of every toolkit package. Months already saved are kept and
 * the months just fetched are laid over them, so the record outlasts PyPI's 180 days.
 */
async function packageDownloads(previous: Indicators["downloads"]): Promise<Downloads> {
  const packages: Downloads["packages"] = {};
  const save = (key: string, fetched: Record<string, number>) => {
    const merged = { ...(previous?.packages[key] ?? {}), ...fetched };
    const months = Object.keys(merged).sort().slice(-DOWNLOAD_MONTHS_KEPT);
    if (!months.length) throw new Error(`no complete month of downloads for ${key}`);
    packages[key] = Object.fromEntries(months.map((month) => [month, merged[month]]));
  };
  for (const toolkit of TOOLKITS) {
    for (const name of toolkit.npm) {
      save(packageKey("npm", name), await npmDownloads(name));
      await sleep(300);
    }
    for (const name of toolkit.pypi) {
      save(packageKey("pypi", name), await pypiDownloads(name));
      await sleep(1000);
    }
  }
  return { packages };
}

// An .xlsx workbook is a zip archive of XML files. These two helpers read one
// worksheet out of it, which is all the collector needs and avoids a dependency.

/** The text of one file inside a zip archive. */
function unzipEntry(zip: Buffer, name: string): string {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); // the archive's closing record
  if (end < 0) throw new Error("not a zip archive");
  let at = zip.readUInt32LE(end + 16); // where the list of files starts
  for (let i = zip.readUInt16LE(end + 10); i > 0 && zip.readUInt32LE(at) === 0x02014b50; i--) {
    const nameLength = zip.readUInt16LE(at + 28);
    if (zip.toString("utf8", at + 46, at + 46 + nameLength) === name) {
      const local = zip.readUInt32LE(at + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const packed = zip.subarray(start, start + zip.readUInt32LE(at + 20));
      return (zip.readUInt16LE(at + 10) === 0 ? packed : inflateRawSync(packed)).toString("utf8");
    }
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  throw new Error(`${name} is not in the archive`);
}

/** A worksheet's rows, each a map from column letter to the cell's text. Handles numbers and inline text only. */
function xlsxSheet(workbook: Buffer, sheetName: string): Map<string, string>[] {
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const sheet = (unzipEntry(workbook, "xl/workbook.xml").match(/<sheet [^>]*>/g) ?? []).find((tag) => attr(tag, "name") === sheetName);
  const link = (unzipEntry(workbook, "xl/_rels/workbook.xml.rels").match(/<Relationship [^>]*>/g) ?? []).find(
    (tag) => sheet && attr(tag, "Id") === attr(sheet, "r:id"),
  );
  const target = link && attr(link, "Target");
  if (!target) throw new Error(`no sheet named "${sheetName}"`);
  const xml = unzipEntry(workbook, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  const text = (inner: string) =>
    inner
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e] ?? "")
      .trim();
  return [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map(
    ([, row]) => new Map([...row.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, column, inner]) => [column, text(inner ?? "")])),
  );
}

/** Enough two-week periods for the dashboard's comparison (six against six) with room to spare. */
const BUSINESS_MIN_PERIODS = 12;
const BUSINESS_PERIODS_KEPT = 60;

type Business = NonNullable<Indicators["business"]>;

/**
 * Share of US businesses that used AI in the last two weeks, and that expect to in the next six months,
 * from the Census Bureau's Business Trends and Outlook Survey. Its API has no national figure short of
 * a 10 MB download per period, so this reads the national spreadsheet the Bureau publishes alongside it.
 * Rows are found by the question's wording, because question numbers differ between releases.
 */
async function businessAdoption(previous: Indicators["business"]): Promise<Business> {
  const workbook = await getBuffer("https://www.census.gov/hfp/btos/downloads/National.xlsx");
  const [header, ...rows] = xlsxSheet(workbook, "Response Estimates");
  if (!header) throw new Error("the estimates sheet is empty");
  const column = (title: string) => [...header].find(([, value]) => value === title)?.[0];
  const question = column("Question");
  const answer = column("Answer");
  if (!question || !answer) throw new Error("the estimates sheet has no Question or Answer column");
  const yes = (wording: RegExp) =>
    rows.find((row) => row.get(answer) === "Yes" && /Intelligence/.test(row.get(question) ?? "") && wording.test(row.get(question) ?? ""));
  const using = yes(/^In the last two weeks, did this business use /);
  const planning = yes(/^During the next six months, do you think this business will be using /);
  if (!using) throw new Error("the question on current AI use was not found");

  // The dates sheet gives each period's last day of collection, as a spreadsheet day number.
  const [datesHeader, ...dateRows] = xlsxSheet(workbook, "Collection and Reference Dates");
  const dateColumn = (title: string) => [...(datesHeader ?? [])].find(([, value]) => value === title)?.[0];
  const code = dateColumn("Smpdt");
  const collectionEnd = dateColumn("Col End");
  if (!code || !collectionEnd) throw new Error("the dates sheet has no Smpdt or Col End column");
  const ends = new Map(dateRows.map((row) => [row.get(code), Number(row.get(collectionEnd))]));

  const percent = (value: string | undefined) => (value && /^\d+(\.\d+)?%$/.test(value) ? Number(value.slice(0, -1)) : null);
  const byPeriod = new Map(previous?.periods.map((p) => [p.period, p]));
  for (const [letter, period] of header) {
    const share = percent(using.get(letter));
    const end = ends.get(period);
    if (!/^\d{6}$/.test(period) || share === null || !end) continue;
    byPeriod.set(period, {
      period,
      end: isoDay(new Date(Date.UTC(1899, 11, 30) + end * DAY)),
      using: share,
      planning: percent(planning?.get(letter)),
    });
  }
  const periods = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(-BUSINESS_PERIODS_KEPT);
  if (periods.length < BUSINESS_MIN_PERIODS) throw new Error(`only ${periods.length} periods of AI-use answers`);
  return { periods };
}

/** Weeks of model share kept: the two-year view's 104 with a few to spare. It grows a week at a time. */
const MARKET_SHARE_WEEKS_KEPT = 110;

/** The longest span of days the rankings dataset gives in one request. */
const MARKET_SHARE_DAYS = 366;

/**
 * Tokens processed on OpenRouter each week, by model maker, from OpenRouter's documented
 * Data API (openrouter.ai/docs/cookbook/administration/data-api). It needs an account key in
 * OPENROUTER_API_KEY; any key works and the request costs nothing. One request a day covers
 * the past year, so restated figures are picked up.
 * The data is licensed CC BY 4.0 and must be credited to OpenRouter, with the time in
 * `asOf`, wherever it is shown.
 */
async function modelMarketShare(previous: Indicators["marketShare"]): Promise<NonNullable<Indicators["marketShare"]>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const end = Date.now() - DAY; // the newest complete UTC day
  const params = new URLSearchParams({ start_date: isoDay(new Date(end - (MARKET_SHARE_DAYS - 1) * DAY)), end_date: isoDay(new Date(end)) });
  const body = await getJson<{ data?: RankingRow[]; meta?: { as_of?: string } }>(
    `https://openrouter.ai/api/v1/datasets/rankings-daily?${params}`,
    { Authorization: `Bearer ${key}` },
  );
  const asOf = body.meta?.as_of;
  if (!asOf || Number.isNaN(Date.parse(asOf))) throw new Error("response did not say when it was made");
  // Weeks stored without `asOf` were read another way and group makers differently, so they are not kept.
  const byWeek = new Map(previous?.asOf ? previous.weeks.map((w) => [w.week, w]) : []);
  for (const week of weeklyMakerTokens(body.data ?? [])) {
    if (Object.keys(week.tokens).length >= 2) byWeek.set(week.week, week);
  }
  const weeks = [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-MARKET_SHARE_WEEKS_KEPT);
  const newest = weeks.at(-1);
  if (!newest || Date.now() - Date.parse(`${newest.week}T00:00:00Z`) > 21 * DAY) throw new Error("no recent complete week returned");
  return { asOf, weeks };
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

/**
 * Anthropic model launches: posts on pages named claude-… with a version number, found through
 * Hacker News like the rest of its news. Each page is logged once, when first seen.
 */
async function anthropicReleases(checked: Record<string, Release | null>): Promise<void> {
  for (const post of await anthropicPosts()) {
    if (post.url in checked || !/\/claude-[a-z0-9-]*\d[a-z0-9-]*$/.test(post.url)) continue;
    const model = post.title.match(/^(?:Introducing )?(Claude\b.*\d.*)$/)?.[1];
    if (model) checked[post.url] = { lab: "Anthropic", model, url: post.url, date: post.publishedAt };
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

// ------------------------------------------------------ what was counted

/** Every story in a span whose title matches one Hacker News search, as `hnThemeCounts` runs it. */
async function hnSpanStories(query: string, span: Span): Promise<CountedStory[]> {
  const from = Date.parse(span.first + "T00:00:00Z") / 1000;
  const to = Date.parse(span.last + "T00:00:00Z") / 1000 + 7 * 86400;
  // Algolia returns at most 1,000 hits, by relevance. Over a long window a broad search can
  // match more, so the floor on points is raised until every match is in hand.
  for (let minPoints = 0; ; minPoints = Math.max(10, minPoints * 2)) {
    const data = await getJson<HnResponse>(
      hnUrl({
        query,
        restrictSearchableAttributes: "title",
        typoTolerance: "false",
        queryType: "prefixNone",
        ...hnWordRules(query),
        numericFilters: `created_at_i>=${from},created_at_i<${to},points>=${minPoints}`,
        attributesToRetrieve: "objectID,title,url,points,num_comments,created_at",
        attributesToHighlight: "",
        hitsPerPage: "1000",
      }),
    );
    await sleep(120);
    if (data.nbHits > data.hits.length && minPoints < 10_000) continue;
    return data.hits.map((h) => {
      const discussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        title: h.title,
        url: h.url || discussionUrl,
        discussionUrl,
        points: h.points ?? 0,
        comments: h.num_comments ?? 0,
        createdAt: h.created_at,
      };
    });
  }
}

/** The papers in an arXiv API answer, with their abstracts, ids without their version. */
function arxivEntries(xml: string): PaperCandidate[] {
  return xml
    .split(/<entry>/)
    .slice(1)
    .flatMap((block) => {
      const id = field(block, "id").match(/abs\/([^\s<]+?)(?:v\d+)?$/)?.[1];
      if (!id) return [];
      return [
        {
          id,
          title: plain(field(block, "title")),
          summary: plain(field(block, "summary")),
          url: `https://arxiv.org/abs/${id}`,
          publishedAt: field(block, "published").trim(),
        },
      ];
    });
}

type HfDaily = { paper: { id: string; title: string; summary?: string; upvotes: number; publishedAt: string } };

/** How many of a topic's newest matching papers are read, to find three that hold a phrase as written. */
const ARXIV_EXAMPLES_READ = 30;

/**
 * A topic's candidate papers over a span: the newest matching AI papers from arXiv's own search,
 * and the Hugging Face daily papers that hold one of its phrases, kept only if the same arXiv
 * search finds them too (so each was counted), with their upvotes.
 */
async function arxivSpanPapers(phrases: string[], span: Span, daily: HfDaily[]): Promise<PaperCandidate[]> {
  const search_query = arxivQuery(span.first, span.last, phrases);
  const newest = await arxivFetch(
    { search_query, sortBy: "submittedDate", sortOrder: "descending", max_results: String(ARXIV_EXAMPLES_READ) },
    arxivEntries,
  );
  const upvoted = daily.filter((d) => d.paper.upvotes > 0 && phrases.some((p) => phraseIn(`${d.paper.title} ${d.paper.summary ?? ""}`, p)));
  if (upvoted.length === 0) return newest;
  const ids = upvoted.map((d) => d.paper.id);
  // With both a search and a list of ids, arXiv returns the listed papers the search matches.
  const counted = await arxivFetch({ search_query, id_list: ids.join(","), max_results: String(ids.length) }, arxivEntries);
  const upvotes = new Map(upvoted.map((d) => [d.paper.id, d.paper.upvotes]));
  return [...counted.map((p) => ({ ...p, upvotes: upvotes.get(p.id) })), ...newest];
}

/**
 * data/counted.json: for each view, the rising moves its headline names, with the few stories or
 * papers behind each (see src/lib/counted.ts). The moves are read with the page's own rules from
 * the files just written, so the lists are for exactly the moves the page will name. Overwritten
 * each run; a move whose search fails is left out, and the page then shows no list under it.
 */
async function collectCounted(now: Date): Promise<CountedFile> {
  const { HORIZONS, buildTrends } = await fromSrc<typeof import("../src/lib/trends.ts")>("lib/trends");
  const { buildBriefing } = await fromSrc<typeof import("../src/lib/briefing.ts")>("lib/briefing");
  const searches = (Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]).flatMap((horizon) => {
    const trends = buildTrends(horizon);
    return risingMoves(horizon, buildBriefing(trends).lead, trends.weeks, trends.window);
  });

  let daily: HfDaily[] = [];
  if (searches.some((m) => m.series === "topic")) {
    try {
      daily = await getJson<HfDaily[]>("https://huggingface.co/api/daily_papers?limit=100");
    } catch (err) {
      console.warn(`  ! counted: Hugging Face daily papers failed, papers from arXiv alone: ${(err as Error).message}`);
    }
  }

  const moves: CountedMove[] = [];
  for (const { searches: phrases, ...move } of searches) {
    try {
      if (move.series === "theme") {
        const found: CountedStory[] = [];
        for (const query of phrases) found.push(...(await hnSpanStories(query, move)));
        moves.push({ ...move, stories: pickStories(found, phrases, move) });
      } else {
        moves.push({ ...move, papers: pickPapers(await arxivSpanPapers(phrases, move, daily), phrases, move) });
      }
      const kept = moves.at(-1)!;
      console.log(`  counted ${move.horizon} ${move.id}: ${"stories" in kept ? kept.stories.length : kept.papers.length}`);
    } catch (err) {
      console.warn(`  ! counted ${move.horizon} ${move.id} failed: ${(err as Error).message}`);
    }
  }
  const file: CountedFile = { generatedAt: now.toISOString(), moves };
  await writeJson("counted.json", file);
  return file;
}

// ------------------------------------------------------------------ main

async function collectHistory(history: History, weeks: string[], status: Record<string, SourceStatus>) {
  const refresh = new Set(weeks.slice(-WEEKS_TO_REFRESH));
  const needs = (series: Record<string, number> | undefined, week: string) =>
    refresh.has(week) || series?.[week] === undefined;

  /**
   * Stores a count only if it is believable. A rejected count leaves what was
   * stored before (or nothing, for a new week), and is reported with its source.
   */
  let rejected: string[] = [];
  const put = (label: string, kind: Kind, series: Record<string, number>, week: string, value: number) => {
    const why = ACCEPT ? null : implausible(kind, series, week, value);
    if (why) {
      rejected.push(`${label} ${week}: ${why}`);
      console.warn(`  ! rejected ${label} ${week}: ${why}`);
      return false;
    }
    series[week] = value;
    return true;
  };
  /** The status for one source: current, or failing with the counts that were turned away. */
  const settle = (key: string) => {
    status[key] = rejected.length
      ? {
          ok: false,
          at: status[key]?.at ?? "",
          error: `${rejected.length} implausible count${rejected.length > 1 ? "s" : ""} not stored (${rejected.slice(0, 3).join("; ")}${rejected.length > 3 ? "; …" : ""})`,
        }
      : { ok: true, at: new Date().toISOString() };
    rejected = [];
  };
  const fail = (key: string, what: string, err: unknown) => {
    rejected = [];
    status[key] = { ok: false, at: status[key]?.at ?? "", error: (err as Error).message };
    console.warn(`  ! ${what} failed: ${(err as Error).message}`);
  };

  // Hacker News is quick, so it goes first.
  try {
    for (const topic of TOPICS) {
      const series = ((history.topics[topic.id] ??= { arxiv: {}, hn: {} }).hn ??= {});
      for (const week of weeks) {
        if (needs(series, week)) put(`stories ${topic.id}`, "part", series, week, await hnCount(week, topic.hn));
      }
      console.log(`  hn     ${topic.id}`);
    }
    settle("hnHistory");
  } catch (err) {
    fail("hnHistory", "Hacker News history", err);
  }

  try {
    const totals = (history.hnAiTotal ??= {});
    for (const week of weeks) if (needs(totals, week)) put("AI stories", "total", totals, week, await hnAiCount(week));
    const themes = (history.themes ??= {});
    const subthemes = (history.subthemes ??= {});
    for (const theme of THEMES) {
      const series = (themes[theme.id] ??= {});
      const parts = theme.parts.map((part) => ({ id: part.id, series: (subthemes[subthemeKey(theme.id, part.id)] ??= {}) }));
      for (const week of weeks) {
        // A theme is recounted with its sub-themes, so the two always come from the same searches.
        if (!needs(series, week) && parts.every((part) => !needs(part.series, week))) continue;
        const counts = await hnThemeCounts(week, theme);
        // The sub-themes come from the same searches, so they are stored only with a believable theme.
        if (!put(`theme ${theme.id}`, "part", series, week, counts.total)) continue;
        for (const part of parts) part.series[week] = counts.parts[part.id];
      }
      await writeJson("history.json", history); // save progress; a sub-theme backfill takes several minutes
      console.log(`  theme  ${theme.id}`);
    }
    settle("hnThemes");
  } catch (err) {
    fail("hnThemes", "Hacker News themes", err);
  }

  // The product watchlist: one Hacker News count per product and week, and one Wikipedia
  // request per article title, which returns every week collected.
  const products = (history.products ??= {});
  try {
    for (const product of PRODUCTS) {
      const series = ((products[product.id] ??= { hn: {}, wiki: {} }).hn ??= {});
      for (const week of weeks) {
        if (!needs(series, week)) continue;
        // Stories naming a longer product that contains this one's name are taken off (see `hnExcept`).
        const except = product.hnExcept ? await hnCount(week, product.hnExcept) : 0;
        put(`stories ${product.id}`, "part", series, week, Math.max(0, (await hnCount(week, product.hn)) - except));
      }
      await writeJson("history.json", history); // save progress; the first backfill takes several minutes
      console.log(`  hn     ${product.id}`);
    }
    settle("hnProducts");
  } catch (err) {
    fail("hnProducts", "Hacker News products", err);
  }

  try {
    for (const product of PRODUCTS) {
      if (product.wiki.length === 0) continue;
      const series = ((products[product.id] ??= { hn: {}, wiki: {} }).wiki ??= {});
      const views = await wikiWeeklyViews(product.wiki, weeks);
      for (const week of weeks) {
        if (views[week] !== undefined && needs(series, week)) put(`views ${product.id}`, "views", series, week, views[week]);
      }
      console.log(`  wiki   ${product.id}`);
    }
    settle("wikiProducts");
  } catch (err) {
    fail("wikiProducts", "Wikipedia page views", err);
  }

  // arXiv is rate-limited to one request per three seconds; in --fast mode
  // only the newest weeks are refreshed and gaps are left for a full run.
  try {
    const arxivWeeks = FAST ? weeks.slice(-WEEKS_TO_REFRESH) : weeks;
    for (const week of arxivWeeks) {
      if (needs(history.arxivTotal, week)) put("all papers", "total", history.arxivTotal, week, await arxivCount(week, null));
    }
    for (const topic of TOPICS) {
      const series = ((history.topics[topic.id] ??= { arxiv: {}, hn: {} }).arxiv ??= {});
      for (const week of arxivWeeks) {
        if (!needs(series, week)) continue;
        const count = await arxivCount(week, topic.arxiv);
        const total = history.arxivTotal[week];
        if (!ACCEPT && total !== undefined && count > total) {
          rejected.push(`papers ${topic.id} ${week}: ${count} is more than all ${total} papers`);
          console.warn(`  ! rejected papers ${topic.id} ${week}: ${count} is more than all ${total} papers`);
        } else put(`papers ${topic.id}`, "part", series, week, count);
      }
      console.log(`  arxiv  ${topic.id}`);
      await writeJson("history.json", history); // save progress; a full backfill takes several minutes
    }
    settle("arxivHistory");
  } catch (err) {
    fail("arxivHistory", "arXiv history", err);
  }

  holdBackUnfinishedWeek(history, weeks.at(-1)!);
}

/**
 * The site lists the weeks that have a paper total. If any count for the newest
 * week is missing (a source failed part-way, or returned a figure that was turned
 * away), its total is removed so the site stays on the week before, instead of
 * showing a half-collected week as a set of collapses. The next run tries again.
 */
function holdBackUnfinishedWeek(history: History, week: string) {
  if (history.arxivTotal[week] === undefined) return;
  const missing: string[] = [];
  for (const topic of TOPICS) {
    if (history.topics[topic.id]?.arxiv?.[week] === undefined) missing.push(`papers ${topic.id}`);
    if (history.topics[topic.id]?.hn?.[week] === undefined) missing.push(`stories ${topic.id}`);
  }
  if (history.hnAiTotal?.[week] === undefined) missing.push("AI stories");
  for (const theme of THEMES) {
    if (history.themes?.[theme.id]?.[week] === undefined) missing.push(`theme ${theme.id}`);
  }
  if (missing.length === 0) return;
  delete history.arxivTotal[week];
  console.warn(`  ! week ${week} held back: ${missing.length} count${missing.length > 1 ? "s" : ""} missing (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""})`);
}

/**
 * Recounts every week already stored for one theme and its sub-themes with the searches as they are
 * now. A daily run recounts only the newest weeks, so an edited search would otherwise leave the
 * older weeks counted the old way. Prints each week that changed, for the person who ran it to read.
 */
async function recountTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new Error(`--recount: no theme "${id}"; one of ${THEMES.map((t) => t.id).join(", ")}`);
  const history = await readJson<History>("history.json", { updatedAt: "", arxivTotal: {}, topics: {} });
  const series = history.themes?.[theme.id] ?? {};
  const weeks = Object.keys(series).sort();
  let changed = 0;
  for (const week of weeks) {
    const counts = await hnThemeCounts(week, theme);
    if (counts.total !== series[week]) {
      changed++;
      console.log(`  ${week}: ${series[week]} → ${counts.total}`);
    }
    series[week] = counts.total;
    for (const part of theme.parts) ((history.subthemes ??= {})[subthemeKey(theme.id, part.id)] ??= {})[week] = counts.parts[part.id];
  }
  await writeJson("history.json", history);
  console.log(`Recounted ${theme.id}: ${weeks.length} weeks, ${changed} changed.`);
}

async function main() {
  const now = new Date();
  if (RECOUNT !== null) {
    await recountTheme(RECOUNT);
    return;
  }
  if (COUNTED_ONLY) {
    console.log("Collecting what was counted…");
    await collectCounted(now);
    return;
  }
  const weeks = completedWeeks(WEEKS_OF_HISTORY, now);
  const history = await readJson<History>("history.json", { updatedAt: "", arxivTotal: {}, topics: {} });
  const previous = await readJson<Latest | null>("latest.json", null);
  const status: Record<string, SourceStatus> = { ...(previous?.sources ?? {}) };

  /** Runs one list collector; on failure keeps the previously saved list. */
  async function list<K extends "papers" | "repos" | "models" | "releases" | "stories" | "today" | "launches">(
    key: K,
    collect: () => Promise<NonNullable<Latest[K]>>,
  ): Promise<NonNullable<Latest[K]>> {
    try {
      const items = await collect();
      if (items.length === 0) throw new Error("source returned no items");
      status[key] = { ok: true, at: new Date().toISOString() };
      console.log(`  ${key}: ${items.length}`);
      return items;
    } catch (err) {
      status[key] = { ok: false, at: status[key]?.at ?? "", error: (err as Error).message };
      console.warn(`  ! ${key} failed: ${(err as Error).message}`);
      return (previous?.[key] ?? []) as NonNullable<Latest[K]>;
    }
  }

  /** Like `list`, for lists merged from several feeds; names the feeds that failed. */
  async function feedList(key: "analysis" | "labNews", sources: FeedSource[], perSource: number, keep?: number) {
    const { items, failed } = await newestFrom(sources, perSource, previous?.[key] ?? [], keep);
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
    today: await list("today", hnTodayStories),
    launches: await list("launches", hnLaunches),
    repos: await list("repos", githubRisingRepos),
    analysis: await feedList("analysis", ANALYST_SOURCES, 2),
    labNews: await feedList("labNews", LAB_SOURCES, 3, LAB_KEEP), // many labs share the list, so each gets fewer places
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
  await indicator("downloads", async () => void (indicators.downloads = await packageDownloads(before.downloads)));
  await indicator("marketShare", async () => void (indicators.marketShare = await modelMarketShare(before.marketShare)));
  await indicator("business", async () => void (indicators.business = await businessAdoption(before.business)));
  await writeJson("indicators.json", indicators);

  console.log(`Collecting weekly topic history (${weeks[0]} → ${weeks.at(-1)})${FAST ? " [fast]" : ""}…`);
  await collectHistory(history, weeks, status);
  history.updatedAt = new Date().toISOString();
  await writeJson("history.json", history);

  // The moves are read from the files just written, so this comes after the history.
  console.log("Collecting what was counted…");
  const counted = await collectCounted(now);

  latest.sources = status;
  await writeJson("latest.json", latest);
  await writeJson(`snapshots/${isoDay(now)}.json`, { ...latest, counted });

  const failed = Object.entries(status).filter(([, s]) => !s.ok).map(([k]) => k);
  console.log(failed.length ? `Done, with failures: ${failed.join(", ")}` : "Done. All sources OK.");
}

await main();
