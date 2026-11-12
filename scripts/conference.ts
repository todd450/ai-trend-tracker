/**
 * Counts how often each tracked topic was mentioned in a conference's talks, from a
 * plain-text transcript of its recordings, and stores the counts in data/conferences.json.
 *
 *   npm run conference -- <conference id> <transcript.txt> [more transcripts…]
 *   npm run conference -- <conference id> --programme <programme.txt>
 *
 * With --programme the text is the event's published titles and abstracts, which is all
 * there is to count until the recordings have captions. The page says which was counted.
 *
 * A topic is mentioned each time one of its search phrases (the Hacker News and arXiv
 * phrases in src/lib/topics.ts, plus the spoken forms below) appears in the transcript.
 * The written recap beside the counts is added by whoever watched the talks; this script
 * only measures, and never changes the recap's wording.
 *
 * Transcripts are not kept in the repository. YouTube's captions for a recording can be
 * saved with `yt-dlp --write-auto-subs --sub-langs en --skip-download <video url>`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TOPICS } from "../src/lib/topics.ts";
import type { ConferenceFile } from "../src/lib/types.ts";

const FILE = path.join(import.meta.dirname, "..", "data", "conferences.json");

/**
 * How speakers say a topic when the written phrases would miss it. Captions spell things
 * the way they sound ("rag", "m c p"), and speakers say "agents" far more often than "AI agents".
 */
const SPOKEN: Record<string, string[]> = {
  agents: ["agent", "agents", "sub-agent", "subagent", "sub agents", "subagents"],
  coding: ["cursor", "codegen", "code gen", "pull request", "pull requests", "code review", "copilot"],
  reasoning: ["reasoning", "thinking tokens", "thinking budget"],
  rag: ["retrieval", "embeddings", "vector database", "vector search"],
  tools: ["tool call", "tool calls", "tools", "m c p", "mcp server", "mcp servers"],
  memory: ["memory", "context window", "context windows", "compaction"],
  multimodal: ["multimodal", "multi-modal", "vision model"],
  "generative-media": ["image model", "video model", "image gen"],
  voice: ["voice", "speech", "realtime api"],
  robotics: ["robot", "robots", "robotics", "humanoid"],
  "world-models": ["world model", "world models"],
  efficient: ["open weights", "open-weight", "on device", "local models", "small models", "small model"],
  safety: ["safety", "alignment", "interpretability", "prompt injection", "guardrails", "red team"],
  science: ["science", "scientific", "alphafold"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches any of the phrases as whole words, longest first so "AI agents" is not also counted as "agents". */
function matcher(phrases: string[]): RegExp {
  const sorted = [...new Set(phrases.map((p) => p.toLowerCase()))].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![a-z0-9])(?:${sorted.map((p) => escape(p).replace(/[\s-]+/g, "[\\s-]+")).join("|")})(?![a-z0-9])`, "g");
}

function countMentions(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  return Object.fromEntries(
    TOPICS.map((t) => [t.id, lower.match(matcher([...t.hn, ...t.arxiv, ...(SPOKEN[t.id] ?? [])]))?.length ?? 0]),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const source = args.includes("--programme") ? "programme" : "talks";
  const [id, ...files] = args.filter((a) => a !== "--programme");
  if (!id || files.length === 0) {
    console.error("Usage: npm run conference -- <conference id> [--programme] <text file> [more files…]");
    process.exit(1);
  }
  const data = JSON.parse(await readFile(FILE, "utf8")) as ConferenceFile;
  const conference = data.conferences.find((c) => c.id === id);
  if (!conference) {
    console.error(`No conference with id "${id}" in data/conferences.json. Known ids: ${data.conferences.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  const text = (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
  // Caption files carry "12:34" or "[1:02:03]" stamps; they are not speech.
  const speech = text.replace(/\[?\b\d{1,2}:\d{2}(?::\d{2})?\b\]?/g, " ");
  const words = speech.split(/\s+/).filter(Boolean).length;
  const mentions = countMentions(speech);

  conference.stage = { source, words, mentions };
  await writeFile(FILE, JSON.stringify(data, null, 1) + "\n");

  const total = Object.values(mentions).reduce((a, b) => a + b, 0);
  console.log(`${conference.name} (${source}): ${words.toLocaleString("en")} words, ${total.toLocaleString("en")} topic mentions`);
  for (const [topic, n] of Object.entries(mentions).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${topic.padEnd(18)} ${String(n).padStart(5)}  ${total ? ((n / total) * 100).toFixed(1) : "0.0"}%`);
  }
}

await main();
