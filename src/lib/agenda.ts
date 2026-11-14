/**
 * The conference calendar laid out as one agenda: every month from the first event to the last,
 * a "Today" line between what has started and what is still to come, and each event's place
 * in the year. Pure functions of the calendar and the day, so the tests can give either.
 */
import type { Conference } from "./types";

/** Where an event is in its life: not yet held, being held, held but not watched, watched in part, or watched. */
export type Phase = "upcoming" | "underway" | "awaiting" | "partly" | "watched";

/**
 * The five phases in the order an event passes through them. Each has a label in words and a
 * mark of its own shape, so a phase never rests on colour alone.
 */
export const PHASES: { id: Phase; label: string; mark: string }[] = [
  { id: "upcoming", label: "Upcoming", mark: "○" },
  { id: "underway", label: "Under way", mark: "◉" },
  { id: "awaiting", label: "Held · recordings not yet watched", mark: "◌" },
  { id: "partly", label: "Held · partly watched", mark: "◐" },
  { id: "watched", label: "Watched", mark: "●" },
];

export const PHASE_LABEL = Object.fromEntries(PHASES.map((p) => [p.id, p.label])) as Record<Phase, string>;
export const PHASE_MARK = Object.fromEntries(PHASES.map((p) => [p.id, p.mark])) as Record<Phase, string>;

/**
 * The dates decide first: a recap written while an event is still running (after its
 * first day, say) does not make the event over. Once it has ended, a recap marked
 * `partial` keeps it from being called watched until the rest has been read.
 */
export function phaseAt(c: Conference, today: string): Phase {
  if (today < c.start) return "upcoming";
  if (today <= c.end) return "underway";
  if (!c.recap) return "awaiting";
  return c.recap.partial ? "partly" : "watched";
}

export type AgendaItem = { type: "event"; c: Conference } | { type: "today" };
export type AgendaMonth = {
  /** YYYY-MM. */
  month: string;
  items: AgendaItem[];
  count: { held: number; underway: number; upcoming: number };
};

const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/**
 * Every month from the first event (or today, if earlier) to the last (or today, if later), with
 * the events that start in it, earliest first. Today's month carries the one "Today" line, after
 * every event that has started and before every event still to come.
 */
export function agenda(conferences: Conference[], today: string): AgendaMonth[] {
  const sorted = [...conferences].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const now = today.slice(0, 7);
  const starts = [...sorted.map((c) => c.start.slice(0, 7)), now].sort();
  const months: AgendaMonth[] = [];
  for (let ym = starts[0]; ym <= starts.at(-1)!; ym = nextMonth(ym)) {
    const events = sorted.filter((c) => c.start.slice(0, 7) === ym);
    const items: AgendaItem[] = events.map((c) => ({ type: "event", c }));
    if (ym === now) {
      const before = events.filter((c) => c.start <= today).length;
      items.splice(before, 0, { type: "today" });
    }
    const phases = events.map((c) => phaseAt(c, today));
    months.push({
      month: ym,
      items,
      count: {
        held: phases.filter((p) => p !== "upcoming" && p !== "underway").length,
        underway: phases.filter((p) => p === "underway").length,
        upcoming: phases.filter((p) => p === "upcoming").length,
      },
    });
  }
  return months;
}

/**
 * The agenda cut so the calendar opens on now. `ahead` starts at today's month, or earlier if an
 * event that started in an earlier month is still running (re:Invent from 30 November, on 1
 * December), and runs forward, earliest first, with the Today line in today's month. `earlier` is
 * every month before that, newest first and each month's events newest first, so the latest
 * readings lead.
 */
export function splitAtToday(months: AgendaMonth[], today: string): { ahead: AgendaMonth[]; earlier: AgendaMonth[] } {
  const notOver = months.filter((m) => m.items.some((i) => i.type === "event" && i.c.end >= today)).map((m) => m.month);
  const cut = [today.slice(0, 7), ...notOver].sort()[0];
  return {
    ahead: months.filter((m) => m.month >= cut),
    earlier: months
      .filter((m) => m.month < cut)
      .reverse()
      .map((m) => ({ ...m, items: [...m.items].reverse() })),
  };
}

/**
 * What sits either side of the Today line in the months ahead, so the line only says what is
 * there: "started" above if anything above it is still running, "held" if all of it is over, null
 * if nothing is above it; `below` is whether anything is still to come.
 */
export function aroundToday(ahead: AgendaMonth[], today: string): { above: "started" | "held" | null; below: boolean } {
  const items = ahead.flatMap((m) => m.items);
  const at = items.findIndex((i) => i.type === "today");
  const events = (list: AgendaItem[]) => list.flatMap((i) => (i.type === "event" ? [i.c] : []));
  const above = events(items.slice(0, at));
  return {
    above: above.some((c) => phaseAt(c, today) === "underway") ? "started" : above.length ? "held" : null,
    below: events(items.slice(at + 1)).length > 0,
  };
}

/** The events either side of one on the calendar, and its place in the list; null if it is not there. */
export function neighbours(conferences: Conference[], id: string) {
  const index = conferences.findIndex((c) => c.id === id);
  if (index < 0) return null;
  return {
    prev: conferences[index - 1] ?? null,
    next: conferences[index + 1] ?? null,
    index,
    total: conferences.length,
  };
}

const at = (iso: string) => new Date(iso + "T00:00:00Z");
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => at(iso).toLocaleString("en-GB", { ...opts, timeZone: "UTC" });

/**
 * A row's dates as two lines: "12–14" over "Mon–Wed". An event that runs into the next month
 * shows its first day, and says where it ends: "30" over "Mon, to 4 Dec".
 */
export function dayParts(start: string, end: string): { days: string; week: string } {
  const d = (iso: string) => String(at(iso).getUTCDate());
  const wd = (iso: string) => fmt(iso, { weekday: "short" });
  if (start === end) return { days: d(start), week: wd(start) };
  if (start.slice(0, 7) !== end.slice(0, 7)) {
    return { days: d(start), week: `${wd(start)}, to ${d(end)} ${fmt(end, { month: "short" })}` };
  }
  return { days: `${d(start)}–${d(end)}`, week: `${wd(start)}–${wd(end)}` };
}
