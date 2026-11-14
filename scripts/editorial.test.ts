/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { finish, isBigStory, lineFor, sameEvent, sameOutage, visible, type Editorial, type Pin } from "../src/lib/editorial.ts";

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

test("a day's story is big once it matches the middle of the week's top ten", () => {
  const week = [1033, 998, 972, 903, 822, 737, 675, 641, 626, 573];
  assert.equal(isBigStory(551, week), false);
  assert.equal(isBigStory(780, week), true);
  assert.equal(isBigStory(undefined, week), false);
  assert.equal(isBigStory(5000, [900, 800]), false);
});

test("the editor's line shows through its last day and not after", () => {
  const editorial: Editorial = { pin: [], hide: [], line: { text: "A note.", until: TODAY } };
  assert.equal(lineFor(editorial, TODAY), "A note.");
  assert.equal(lineFor(editorial, "2026-11-14"), undefined);
  assert.equal(lineFor(none, TODAY), undefined);
});
