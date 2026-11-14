/**
 * Run with `npm test`. A headline's trend tags say "this headline is counted in that trend", so
 * they must follow the collector's own rule for Hacker News titles: a trend's `hn` phrases, as
 * whole words in any case, and for a product not a title holding one of its `hnExcept` phrases.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromSrc } from "./support/load-src.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { trendTags, MAX_TAGS } = await fromSrc<any>("lib/tags");
const { PRODUCTS } = await fromSrc<any>("lib/products");
const { TOPICS } = await fromSrc<any>("lib/topics");

const ids = (title: string) => trendTags(title).map((t: any) => `${t.kind}:${t.id}`);

test("a headline naming a product is tagged with it, linked to its row on the trends page", () => {
  const [tag] = trendTags("Gemini 4 Hydrogen");
  assert.deepEqual(tag, { kind: "product", id: "gemini", name: "Gemini", href: "/three-months#product-gemini" });
});

test("a headline naming a topic is tagged with it, linked to its row on the topics page", () => {
  const [tag] = trendTags("Show HN: AgentRun, a framework for agentic workflows");
  assert.deepEqual(tag, { kind: "topic", id: "agents", name: "AI agents", href: "/data/topics#topic-agents" });
});

test("every product and topic is found by each of its own phrases, in any case", () => {
  for (const [kind, list] of [["product", PRODUCTS], ["topic", TOPICS]] as const) {
    for (const trend of list) {
      for (const phrase of trend.hn) {
        for (const title of [`News about ${phrase} today`, `${phrase.toUpperCase()}: a review`, `Why ${phrase.toLowerCase()}?`]) {
          assert.ok(ids(title).includes(`${kind}:${trend.id}`), `${title} → ${trend.id}`);
        }
      }
    }
  }
});

test("a phrase matches whole words only, as the Hacker News search does", () => {
  for (const title of ["Grokking explained", "Claudette the robot vacuum", "Runway lights at the airport", "A figure of speech", "Ragged edges", "Codexes of old"]) {
    assert.ok(!ids(title).some((id: string) => /grok|claude|runway|figure|rag|codex/.test(id)), title);
  }
  assert.deepEqual(ids("The AI agentry boom"), [], "a phrase is not matched as the start of a longer word");
});

test("punctuation splits words as the search splits them", () => {
  assert.deepEqual(ids("Claude's new memory"), ["product:claude"]);
  assert.deepEqual(ids("Text to speech, finally local"), ["topic:voice"]);
  assert.deepEqual(ids("Ray-Ban Meta glasses get a display"), ["product:meta-glasses"]);
  assert.deepEqual(ids("Running llama.cpp on a phone"), ["topic:efficient"]);
});

test("a product is not tagged on a headline the collector takes off its count (hnExcept)", () => {
  assert.deepEqual(ids("Claude Is Down"), ["product:claude"]);
  assert.ok(!ids("Claude Code now runs in the browser").includes("product:claude"));
  // The collector takes the whole story off, so a headline naming both is not counted for Claude.
  assert.ok(!ids("Elevated errors on claude.ai, Claude Code, and platform.claude.com").includes("product:claude"));
  assert.deepEqual(ids("Elevated errors on claude.ai, Claude Code, and platform.claude.com"), ["product:claude-code", "topic:coding"]);
});

test("at most two tags, in the order the headline names them, and each trend once", () => {
  assert.deepEqual(ids("Cursor vs Codex vs Claude Code vs Devin"), ["product:cursor", "product:codex"]);
  assert.deepEqual(ids("Agentic coding agents: an AI agent for coding agents"), ["topic:agents", "topic:coding"]);
  for (const title of ["ChatGPT, Gemini, Grok, DeepSeek and Perplexity compared", "Robot humanoid robotics robot"]) {
    const tags = trendTags(title);
    assert.ok(tags.length <= MAX_TAGS);
    assert.equal(new Set(tags.map((t: any) => t.id)).size, tags.length, "no trend twice");
  }
  assert.equal(MAX_TAGS, 2);
});

test("a product and a topic named by the same words both tag, product first", () => {
  assert.deepEqual(ids("Ollama adds a new engine"), ["product:ollama", "topic:efficient"]);
});

test("no matching phrase, no tag", () => {
  for (const title of ["", "   ", "Why You Should Expect an AI Crash", "Chicago schools to Google", "Ünïcödé — headline"]) {
    assert.deepEqual(trendTags(title), [], JSON.stringify(title));
  }
});
