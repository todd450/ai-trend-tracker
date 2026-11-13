/** Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Direction, Signal } from "../src/lib/calls.ts";
import { ends, finding, headlineOf, inSentence, moverOf, movers, type LeadSeries } from "../src/lib/sentences.ts";

const sig = (prior: number, recent: number): Signal => ({ values: [], prior, recent, change: (recent - prior) / prior });
const row = (name: string, direction: Direction) => ({ name, direction });
const mover = (measure: string, name: string, prior: number, recent: number, unit = "of AI papers"): LeadSeries => ({
  measure,
  name,
  unit,
  signal: sig(prior, recent),
  direction: recent >= prior ? "rising" : "cooling",
});

test("names are lowered mid-sentence, except those that open with an acronym", () => {
  assert.equal(inSentence("Jobs & labor"), "jobs & labor");
  assert.equal(inSentence("AI agents"), "AI agents");
  assert.equal(inSentence("Retrieval (RAG)"), "retrieval (RAG)");
});

test("the mover named is the largest that is called, not the first in the list", () => {
  // Biggest rise first; the first two are held back as wobble.
  const list = [row("a", "steady"), row("b", "steady"), row("c", "rising"), row("d", "steady"), row("e", "cooling"), row("f", "steady")];
  const [top, bottom] = ends(list);
  assert.equal(top?.name, "c");
  assert.equal(bottom?.name, "e");
});

test("with nothing called, the ends of the list are returned and no mover is named", () => {
  const list = [row("a", "steady"), row("b", "steady")];
  const [top, bottom] = ends(list);
  assert.equal(top?.name, "a");
  assert.equal(bottom?.name, "b");
  assert.equal(moverOf(top, bottom), undefined);
  assert.deepEqual(ends([]), [undefined, undefined]);
});

test("a riser is preferred to a faller, and a faller is named when nothing rose", () => {
  assert.equal(moverOf(row("up", "rising"), row("down", "cooling"))?.name, "up");
  assert.equal(moverOf(row("flat", "steady"), row("down", "cooling"))?.name, "down");
});

test("the finding gives both figures and the right verb", () => {
  assert.equal(finding(mover("Research", "Voice & speech", 1.5, 0.9)), "Voice & speech fell to 0.9% of AI papers, from 1.5%.");
  assert.equal(
    finding(mover("Hacker News discussion", "Data centers, chips & energy", 1.8, 2.9, "of AI stories"), "On Hacker News,"),
    "On Hacker News, data centers, chips & energy rose to 2.9% of AI stories, from 1.8%.",
  );
});

test("figures that would print alike get a second decimal place", () => {
  assert.equal(finding(mover("Research", "X", 0.11, 0.14)), "X rose to 0.14% of AI papers, from 0.11%.");
});

test("the headline has one sentence per mover, research first, and names Hacker News", () => {
  const h = headlineOf(
    [mover("Research", "World models", 1.9, 2.3), mover("Hacker News discussion", "Education", 1.4, 1.6, "of AI stories")],
    "fallback",
  );
  assert.equal(h.lead, "World models rose to 2.3% of AI papers, from 1.9%.");
  assert.equal(h.turn, "On Hacker News, education rose to 1.6% of AI stories, from 1.4%.");
});

test("with one mover the headline is one sentence; with none it only names the page", () => {
  const one = headlineOf([mover("Hacker News discussion", "Education", 1.4, 1.6, "of AI stories")], "fallback");
  assert.equal(one.lead, "On Hacker News, education rose to 1.6% of AI stories, from 1.4%.");
  assert.equal(one.turn, undefined);
  assert.deepEqual(headlineOf([], "Where attention in AI is moving this week."), { lead: "Where attention in AI is moving this week." });
});

test("the briefing line leads with the riser, falls back to the faller, then to 'Steady'", () => {
  const up = { name: "A", change: 0.66, rising: true };
  const down = { name: "B", change: -0.29, cooling: true };
  assert.deepEqual(movers(up, down, "share of AI stories", "none"), {
    figure: "+66%",
    text: "A rose as a share of AI stories. B fell 29%.",
  });
  assert.deepEqual(movers({ ...up, rising: false }, down, "share of AI papers", "none"), {
    figure: "−29%",
    text: "B fell as a share of AI papers.",
  });
  assert.deepEqual(movers({ ...up, rising: false }, { ...down, cooling: false }, "x", "Nothing moved."), {
    figure: "Steady",
    text: "Nothing moved.",
  });
  assert.deepEqual(movers(undefined, undefined, "x", "Nothing moved."), { figure: "Steady", text: "Nothing moved." });
});
