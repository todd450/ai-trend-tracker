/**
 * Collects AI trend data from four free public sources and writes it to data/.
 *
 *   npm run collect            everything
 *   npm run collect -- --fast  skip the slow arXiv history backfill
 *
 * Output:
 *   data/history.json              weekly mention counts per topic (grows over time)
 *   data/latest.json               current ranked lists (papers, repos, models, news)
 *   data/snapshots/YYYY-MM-DD.json a dated copy of the lists, kept as a record
 *
 * No API keys are required. Set GITHUB_TOKEN to raise GitHub's rate limit.
 * If one source fails, the previous data for that source is kept and the
 * failure is recorded in latest.json so the site can show it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TOPICS } from "../src/lib/topics.ts";
import type { History, Latest, SourceStatus } from "../src/lib/types.ts";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const WEEKS_OF_HISTORY = 12;
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
  for (let attempt = 0; attempt < 4; attempt++) {
    // arXiv asks for at most one request every three seconds.
    await sleep(attempt === 0 ? 3100 : 8000 * attempt);
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

  console.log("Collecting current lists…");
  const latest: Latest = {
    generatedAt: now.toISOString(),
    sources: status,
    papers: await list("papers", hfPapers),
    models: await list("models", hfTrendingModels),
    releases: await list("releases", hfLabReleases),
    stories: await list("stories", hnTopStories),
    repos: await list("repos", githubRisingRepos),
  };
  await writeJson("latest.json", latest);

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
