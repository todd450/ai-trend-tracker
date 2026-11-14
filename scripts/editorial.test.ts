/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finish,
  isLabLaunch,
  lineFor,
  matchesPastLeads,
  sameEvent,
  sameOutage,
  topStory,
  topStoryReason,
  visible,
  type Editorial,
  type Finished,
  type Pin,
} from "../src/lib/editorial.ts";

type Item = { title: string; url: string; points?: number };
const none: Editorial = { pin: [], hide: [] };
const fromPin = (pin: Pin): Item => ({ title: pin.title, url: pin.url });
const TODAY = "2026-11-13";

const launch: Item = { title: "Introducing Gemini 4 Hydrogen", url: "https://deepmind.google/blog/gemini-4-hydrogen/", points: 551 };
const second: Item = { title: "Gemini 4 Hydrogen and Orchestrator", url: "https://antigravity.google/blog/hydrogen", points: 454 };
const other: Item = { title: "I'm making LLMs work on small and old devices", url: "https://github.com/x/y", points: 415 };

test("two headlines sharing a versioned name are one event", () => {
  assert.equal(sameEvent(launch.title, second.title), true);
  assert.equal(sameEvent("Claude Fable 5.2 and Mythos 5.2", "Claude Fable 5.2 and Claude Mythos 5.2"), true);
});

test("a shared name and number alone is not enough", () => {
  assert.equal(sameEvent("Introducing Gemini 4 Hydrogen", "I benchmarked Gemini 4 against my old laptop"), false);
});

test("a shared year or a shared stock phrase does not join two stories", () => {
  assert.equal(sameEvent("The state of AI in 2026", "Jobs lost to AI in 2026"), false);
  assert.equal(sameEvent("How to build a coding agent", "How to build a data center"), false);
});

test("one headline holding the other is one event, as before", () => {
  assert.equal(sameEvent("Introducing Gemini 4 Hydrogen", "Gemini 4 Hydrogen"), true);
  assert.equal(sameEvent("Claude", "Claude Fable 5.2 and Mythos 5.2"), false);
});

// The 13 Nov 2026 pair: one Claude outage, posted twice to Hacker News.
const incident: Item = { title: "Elevated errors on claude.ai, Claude Code, and platform.claude.com", url: "https://status.claude.com/incidents/nn11wk485zfn", points: 339 };
const isDown: Item = { title: "Claude Is Down", url: "https://status.claude.com/history", points: 166 };
const elsewhere = (title: string): Item => ({ title, url: `https://example.org/${encodeURIComponent(title)}` });

test("the 13 Nov 2026 outage posts are one story", () => {
  const out = finish([incident, other, isDown], none, TODAY, fromPin);
  assert.deepEqual(out.map((i) => i.url), [incident.url, other.url]);
  assert.deepEqual(out[0].also.map((i) => i.url), [isDown.url]);
});

test("one tracked product with an outage word in both headlines is one event, wherever the posts live", () => {
  assert.equal(sameOutage(elsewhere(incident.title), elsewhere(isDown.title)), true);
  assert.equal(sameOutage(elsewhere("ChatGPT outage"), elsewhere("Is ChatGPT down for anyone else?")), true);
  assert.equal(sameOutage(elsewhere("Claude Code is down"), elsewhere("Claude Code: degraded performance")), true);
});

test("posts from one status page are one event, whatever their headlines", () => {
  const a: Item = { title: "Incident with Codespaces", url: "https://www.githubstatus.com/incidents/1" };
  assert.equal(sameOutage({ title: "Ongoing incident", url: "https://status.openai.com/incidents/abc" }, { title: "Something is wrong", url: "http://status.openai.com/" }), true);
  assert.equal(sameOutage({ title: "Ongoing incident", url: "https://status.openai.com/a" }, { title: "Ongoing incident", url: "https://status.claude.com/a" }), false);
  assert.equal(sameOutage(a, { title: "Incident with Actions", url: "https://www.githubstatus.com/incidents/2" }), false);
});

test("two stories naming one product, with no outage word in one of them, stay apart", () => {
  assert.equal(sameOutage(elsewhere("Claude can now remember past chats"), elsewhere("Claude Fable 5.2 and Mythos 5.2")), false);
  assert.equal(sameOutage(elsewhere("Claude Is Down"), elsewhere("Claude can now remember past chats")), false);
  const out = finish([elsewhere("Claude can now remember past chats"), elsewhere("What Claude taught me about writing")], none, TODAY, fromPin);
  assert.equal(out.length, 2);
});

test("an outage word with two different products stays apart", () => {
  assert.equal(sameOutage(elsewhere("ChatGPT is down"), elsewhere("Claude Is Down")), false);
  assert.equal(sameOutage(elsewhere("Gemini outage"), elsewhere("Elevated errors on Cursor")), false);
});

test("a product named inside a longer one is not the shorter product", () => {
  assert.equal(sameOutage(elsewhere("Claude Code is down"), elsewhere("Claude Is Down")), false);
});

test("an outage word must stand as a whole word, and 'down' in a phrase like 'shuts down' is no outage", () => {
  assert.equal(sameOutage(elsewhere("Sora is down"), elsewhere("OpenAI shuts down Sora")), false);
  assert.equal(sameOutage(elsewhere("Gemini errors"), elsewhere("Gemini downgrades its free tier")), false);
  assert.equal(sameOutage(elsewhere("Gemini outage"), elsewhere("Gemini outages worldwide")), true);
  assert.equal(sameOutage(elsewhere("Claude site down"), elsewhere("Claude Is Down")), true);
  assert.equal(sameOutage(elsewhere("Cursor is down"), elsewhere("Cursor's CEO stepped down")), false);
});

test("posts about one event are gathered under the highest-ranked, and none is dropped", () => {
  const out = finish([launch, second, other], none, TODAY, fromPin);
  assert.deepEqual(out.map((i) => i.url), [launch.url, other.url]);
  assert.deepEqual(out[0].also.map((i) => i.url), [second.url]);
  assert.equal(out.length + out.reduce((n, i) => n + i.also.length, 0), 3);
});

test("a hidden link leaves every list, whichever way its address is written", () => {
  const editorial: Editorial = { pin: [], hide: [{ url: "http://www.github.com/x/y/", reason: "Test." }] };
  assert.deepEqual(visible([launch, other], editorial).map((i) => i.url), [launch.url]);
  assert.deepEqual(finish([launch, other], editorial, TODAY, fromPin).map((i) => i.url), [launch.url]);
});

test("a pinned post goes to the top with its note", () => {
  const editorial: Editorial = { pin: [{ url: other.url, title: other.title, from: "github.com", until: TODAY, note: "Why." }], hide: [] };
  const out = finish([launch, second, other], editorial, TODAY, fromPin);
  assert.equal(out[0].url, other.url);
  assert.deepEqual(out[0].pinned, { note: "Why." });
  assert.equal(out[1].url, launch.url);
});

test("a pin for a post the sources did not carry adds it", () => {
  const pin: Pin = { url: "https://example.org/report", title: "A report", from: "Example", until: TODAY };
  const out = finish([launch], { pin: [pin], hide: [] }, TODAY, fromPin);
  assert.deepEqual(out.map((i) => i.title), ["A report", launch.title]);
});

test("a pin past its last day is ignored", () => {
  const pin: Pin = { url: other.url, title: other.title, from: "github.com", until: "2026-11-12" };
  const out = finish([launch, other], { pin: [pin], hide: [] }, TODAY, fromPin);
  assert.equal(out[0].url, launch.url);
  assert.equal(out.some((i) => i.pinned), false);
});

test("pinning a post that sat under another makes it the lead of its group", () => {
  const pin: Pin = { url: second.url, title: second.title, from: "antigravity.google", until: TODAY };
  const out = finish([launch, second, other], { pin: [pin], hide: [] }, TODAY, fromPin);
  assert.equal(out[0].url, second.url);
  assert.deepEqual(out[0].also.map((i) => i.url), [launch.url]);
  assert.equal(out.length, 2);
});

test("the first pin in the file ends up on top", () => {
  const pins: Pin[] = [
    { url: other.url, title: other.title, from: "a", until: TODAY },
    { url: launch.url, title: launch.title, from: "b", until: TODAY },
  ];
  const out = finish([launch, other], { pin: pins, hide: [] }, TODAY, fromPin);
  assert.deepEqual(out.map((i) => i.url), [other.url, launch.url]);
});

test("a day's lead is big once its points match the middle of the past days' leads", () => {
  assert.equal(matchesPastLeads(619, [344, 627, 619]), true);
  assert.equal(matchesPastLeads(551, [344, 627, 619]), false);
  // An even count takes the mean of the middle two: (551 + 619) / 2 = 585.
  assert.equal(matchesPastLeads(585, [344, 627, 619, 551]), true);
  assert.equal(matchesPastLeads(584, [344, 627, 619, 551]), false);
  assert.equal(matchesPastLeads(undefined, [100, 100, 100]), false);
});

test("with fewer than three past days to compare with, points lift nothing", () => {
  assert.equal(matchesPastLeads(5000, []), false);
  assert.equal(matchesPastLeads(5000, [10, 20]), false);
  assert.equal(matchesPastLeads(20, [10, 20, 30]), true);
});

type Post = { title: string; url: string; from: string; lab?: boolean; discussion?: { url: string; points: number } };
const hn = (title: string, points: number, from = "example.org"): Post => ({
  title,
  url: `https://${from}/${encodeURIComponent(title)}`,
  from,
  discussion: { url: `https://news.ycombinator.com/item?id=${points}`, points },
});
const labPost = (from: string, title: string, points?: number): Post => ({
  title,
  url: `https://lab.example/${encodeURIComponent(title)}`,
  from,
  lab: true,
  discussion: points === undefined ? undefined : { url: `https://news.ycombinator.com/item?id=${points}`, points },
});
const group = (lead: Post, ...also: Post[]): Finished<Post> => ({ ...lead, also });

test("a frontier lab's own post discussed in two Hacker News stories is a lab launch", () => {
  // 13 Nov 2026: the DeepMind post carries the 551-point story, and a second story sits under it.
  assert.equal(isLabLaunch(group(labPost("Google DeepMind", "Introducing Gemini 4 Hydrogen", 551), hn("Gemini 4 Hydrogen and Orchestrator", 454))), true);
  // The lab post need not have a discussion of its own, nor lead its group.
  assert.equal(isLabLaunch(group(hn("OpenAI ships a model", 300), hn("A model from OpenAI", 120), labPost("OpenAI", "Introducing a model"))), true);
});

test("one discussion, no lab post, or a specialist lab is not a lab launch", () => {
  assert.equal(isLabLaunch(group(labPost("Anthropic", "Introducing a model", 400))), false);
  assert.equal(isLabLaunch(group(labPost("Anthropic", "Introducing a model"), hn("A model", 400))), false);
  // Stories that link to a lab's site are not the lab's own post.
  assert.equal(isLabLaunch(group(hn("Gemini 4 Hydrogen", 551, "deepmind.google"), hn("Gemini 4 Hydrogen and Orchestrator", 454))), false);
  assert.equal(isLabLaunch(group(labPost("ElevenLabs", "A voice model", 300), hn("A voice model is out", 200))), false);
  // A source named like a lab is not the lab's own post unless it came from the lab feeds.
  assert.equal(isLabLaunch(group({ ...hn("Introducing X", 300), from: "OpenAI" }, hn("X is out", 200))), false);
});

const plain = (title: string, points: number) => group(hn(title, points));
const launchGroup = group(labPost("Google DeepMind", "Introducing Gemini 4 Hydrogen", 551), hn("Gemini 4 Hydrogen and Orchestrator", 454));
const PAST = [344, 627, 619];

test("the top slot goes to a lab launch even when a bigger story leads the list", () => {
  assert.deepEqual(topStory([plain("A bigger story", 600), plain("Another", 500), launchGroup], PAST), { index: 2, rule: "lab" });
});

test("the top slot goes to the lead when its points match the past days' leads", () => {
  assert.deepEqual(topStory([plain("A big story", 700), launchGroup], PAST), { index: 0, rule: "points" });
  assert.equal(topStory([plain("A big story", 700)], [10, 20]), undefined);
});

test("a pin wins the top slot over every rule", () => {
  const pinned: Finished<Post> = { ...plain("Pinned", 5), pinned: { note: "Why." } };
  assert.deepEqual(topStory([pinned, plain("A big story", 700), launchGroup], PAST), { index: 0, rule: "pinned" });
});

test("on an ordinary day the top slot stays empty", () => {
  assert.equal(topStory([plain("A story", 300), plain("Another", 200)], PAST), undefined);
  assert.equal(topStory([], PAST), undefined);
});

test("the kicker names the rule that lifted the story", () => {
  const reasons = (["pinned", "lab", "points"] as const).map((rule) => topStoryReason(launchGroup, rule));
  assert.equal(new Set(reasons).size, 3, "each rule reads differently");
  assert.ok(reasons[1].includes("Google DeepMind"), "a lab launch names the lab");
  assert.ok(reasons[1].includes("Hacker News"), "and where it was discussed");
});

test("the editor's line shows through its last day and not after", () => {
  const editorial: Editorial = { pin: [], hide: [], line: { text: "A note.", until: TODAY } };
  assert.equal(lineFor(editorial, TODAY), "A note.");
  assert.equal(lineFor(editorial, "2026-11-14"), undefined);
  assert.equal(lineFor(none, TODAY), undefined);
});
