/** Run with `npm test`. The conference calendar as one agenda of months, and each event's place in it. */
import assert from "node:assert/strict";
import { test } from "node:test";
import calendar from "../data/conferences.json" with { type: "json" };
import { PHASES, agenda, dayParts, neighbours, phaseAt } from "../src/lib/agenda.ts";
import type { Conference } from "../src/lib/types.ts";

const ev = (id: string, start: string, end = start, extra: Partial<Conference> = {}): Conference => ({
  id,
  name: id,
  host: "Host",
  kind: "industry",
  start,
  end,
  place: "Somewhere",
  url: "https://example.com",
  ...extra,
});
const recap = (partial = false): Conference["recap"] => ({ watchedOn: "2026-11-12", partial, coverage: "Day one.", summary: "Said.", points: [] });

const ids = (months: ReturnType<typeof agenda>) => months.flatMap((m) => m.items.filter((i) => i.type === "event").map((i) => i.c.id));
const todayLines = (months: ReturnType<typeof agenda>) =>
  months.flatMap((m) => m.items.map((i, n) => ({ month: m.month, n, i }))).filter((x) => x.i.type === "today");

test("the dates decide the phase first; a recap only counts once the event is over", () => {
  const c = ev("a", "2026-11-10", "2026-11-12");
  assert.equal(phaseAt(c, "2026-11-09"), "upcoming");
  assert.equal(phaseAt(c, "2026-11-10"), "underway");
  assert.equal(phaseAt({ ...c, recap: recap() }, "2026-11-12"), "underway");
  assert.equal(phaseAt(c, "2026-11-13"), "awaiting");
  assert.equal(phaseAt({ ...c, recap: recap(true) }, "2026-11-13"), "partly");
  assert.equal(phaseAt({ ...c, recap: recap() }, "2026-11-13"), "watched");
});

test("every phase has a label in words, not only a colour or a mark", () => {
  assert.equal(PHASES.length, 5);
  for (const p of PHASES) {
    assert.ok(p.label.trim().length > 0);
    assert.ok(p.mark.trim().length > 0);
  }
  assert.equal(new Set(PHASES.map((p) => p.label)).size, 5);
  assert.equal(new Set(PHASES.map((p) => p.mark)).size, 5);
});

test("every month from the first event to the last is listed, empty ones too, in order", () => {
  const list = [ev("oct", "2026-10-12"), ev("jan", "2027-01-20"), ev("apr", "2027-04-02")];
  const months = agenda(list, "2026-11-13");
  assert.deepEqual(
    months.map((m) => m.month),
    ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  );
  assert.equal(months.find((m) => m.month === "2027-02")!.items.length, 0);
});

test("every event appears exactly once, under the month it starts in, in date order", () => {
  const list = [ev("b", "2026-12-06", "2026-12-12"), ev("a", "2026-11-30", "2026-12-04"), ev("c", "2026-12-07")];
  const months = agenda(list, "2026-11-13");
  assert.deepEqual(ids(months), ["a", "b", "c"]);
  const nov = months.find((m) => m.month === "2026-11")!;
  assert.ok(nov.items.some((i) => i.type === "event" && i.c.id === "a"));
});

test("one Today line, in today's month, with everything started above it and everything to come below", () => {
  const list = [ev("held", "2026-11-10", "2026-11-12"), ev("now", "2026-11-13", "2026-11-15"), ev("later", "2026-11-17")];
  const months = agenda(list, "2026-11-13");
  const lines = todayLines(months);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].month, "2026-11");
  const flat = months.flatMap((m) => m.items);
  const at = flat.findIndex((i) => i.type === "today");
  for (const [n, i] of flat.entries()) {
    if (i.type !== "event") continue;
    if (n < at) assert.ok(i.c.start <= "2026-11-13", `${i.c.id} is above the line but has not started`);
    else assert.ok(i.c.start > "2026-11-13", `${i.c.id} is below the line but has started`);
  }
});

test("today in a month with no events still gets its month and its line", () => {
  const months = agenda([ev("oct", "2026-10-12"), ev("jan", "2027-01-20")], "2026-12-02");
  const dec = months.find((m) => m.month === "2026-12")!;
  assert.deepEqual(dec.items.map((i) => i.type), ["today"]);
  assert.equal(todayLines(months).length, 1);
});

test("today before the first event or after the last stretches the agenda to reach it", () => {
  const list = [ev("oct", "2026-10-12"), ev("dec", "2026-12-01")];
  const early = agenda(list, "2026-08-20");
  assert.equal(early[0].month, "2026-08");
  assert.equal(early[0].items[0].type, "today");
  const late = agenda(list, "2027-02-01");
  assert.equal(late.at(-1)!.month, "2027-02");
  assert.equal(late.at(-1)!.items.at(-1)!.type, "today");
  assert.equal(todayLines(early).length + todayLines(late).length, 2);
});

test("an empty calendar is today's month and its line", () => {
  const months = agenda([], "2026-11-13");
  assert.deepEqual(months.map((m) => m.month), ["2026-11"]);
  assert.deepEqual(months[0].items.map((i) => i.type), ["today"]);
});

test("each month counts its held and upcoming events", () => {
  const list = [ev("held", "2026-11-02"), ev("now", "2026-11-12", "2026-11-14"), ev("later", "2026-11-20"), ev("later2", "2026-11-25")];
  const nov = agenda(list, "2026-11-13")[0];
  assert.deepEqual(nov.count, { held: 1, underway: 1, upcoming: 2 });
});

test("neighbours run in calendar order and stop at the ends", () => {
  const list = [ev("a", "2026-10-01"), ev("b", "2026-11-01"), ev("c", "2026-12-01")];
  assert.deepEqual(neighbours(list, "a"), { prev: null, next: list[1], index: 0, total: 3 });
  assert.deepEqual(neighbours(list, "b"), { prev: list[0], next: list[2], index: 1, total: 3 });
  assert.deepEqual(neighbours(list, "c"), { prev: list[1], next: null, index: 2, total: 3 });
  assert.equal(neighbours(list, "missing"), null);
});

test("a row's dates: the days, then the weekdays; an event that crosses a month names where it ends", () => {
  assert.deepEqual(dayParts("2026-10-12", "2026-10-14"), { days: "12–14", week: "Mon–Wed" });
  assert.deepEqual(dayParts("2027-05-04", "2027-05-04"), { days: "4", week: "Tue" });
  assert.deepEqual(dayParts("2026-11-30", "2026-12-04"), { days: "30", week: "Mon, to 4 Dec" });
});

test("every event on the real calendar has a unique id that is safe as its page address", () => {
  const all = (calendar as { conferences: Conference[] }).conferences;
  const seen = new Set<string>();
  for (const c of all) {
    assert.match(c.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${c.id} is not a clean address`);
    assert.ok(!seen.has(c.id), `${c.id} is used twice`);
    seen.add(c.id);
    assert.ok(c.start <= c.end, `${c.id} ends before it starts`);
  }
});
