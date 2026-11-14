/**
 * "Today's AI news": everything the reading-list sources published in the 24 hours before the
 * data was collected. The site is a static page rebuilt once a day, so "today" is that day,
 * not the reader's; the section says which 24 hours it covers.
 *
 * The list is made in three steps. Pool: the lab and newsletter posts and the day's Hacker News
 * stories. Rank: biggest first, by points on Hacker News. Finish: the editor's rules in
 * editorial.ts, which gather posts about one event and apply the pins and hides kept by hand in
 * data/editorial.json. The top slot, when a story earns it, is chosen by `topStory`, which weighs
 * the day's lead against the past days' leads, read from the daily copies in data/snapshots/.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import editorialJson from "../../data/editorial.json";
import { finish, sameArticle, sameHeadline, topStory, topStoryGroup, type Editorial, type Finished, type TopRule } from "./editorial";
import { latest } from "./trends";
import type { Latest } from "./types";

/** The editor's pins and hides, kept by hand. */
export const editorial = editorialJson as Editorial;

const DAY = 86_400_000;

export type TodayItem = {
  title: string;
  url: string;
  /** The lab or publication, or for a Hacker News story the site it links to. */
  from: string;
  publishedAt: string;
  /** Set for Hacker News stories, and for a post a Hacker News story links to or carries the headline of. */
  discussion?: { url: string; points: number };
  /** Set for posts from the labs' own feeds. */
  lab?: boolean;
};

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The day's list: pooled, ranked and finished. */
function listToday(data: Latest, notes: Editorial): { since: string; until: string; items: Finished<TodayItem>[] } {
  const until = Date.parse(data.generatedAt);
  const since = until - DAY;
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= since && t <= until;
  };

  const post = (lab: boolean) => (a: Latest["labNews"][number]): TodayItem => ({
    title: a.title,
    url: a.url,
    from: a.source,
    publishedAt: a.publishedAt,
    ...(lab && { lab: true }),
  });
  const items: TodayItem[] = [
    ...(data.labNews ?? []).filter((a) => inWindow(a.publishedAt)).map(post(true)),
    ...(data.analysis ?? []).filter((a) => inWindow(a.publishedAt)).map(post(false)),
  ];

  // A lab post that also reached Hacker News is listed once, under the lab, with its discussion attached.
  // Hacker News often links a second copy of the announcement, so the headline is matched as well as the address.
  const posts = [...items];
  const byArticle = new Map(items.map((item) => [sameArticle(item.url), item]));
  // Data collected before the past-day list existed falls back to the week's top stories.
  for (const s of (data.today ?? data.stories).filter((s) => inWindow(s.createdAt))) {
    const discussion = { url: s.discussionUrl, points: s.points };
    const known = byArticle.get(sameArticle(s.url)) ?? posts.find((post) => sameHeadline(post.title, s.title));
    // The stories arrive most upvoted first, so a post keeps the largest of its discussions.
    if (known) known.discussion ??= discussion;
    else {
      const item = { title: s.title, url: s.url, from: host(s.url), publishedAt: s.createdAt, discussion };
      items.push(item);
      byArticle.set(sameArticle(s.url), item);
    }
  }

  // Biggest first. Points on Hacker News are the only measure of size the sources share, so a post
  // nobody has discussed there cannot be weighed against one that has: those follow, newest first.
  items.sort(
    (a, b) =>
      (b.discussion?.points ?? -1) - (a.discussion?.points ?? -1) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const finished = finish(items, notes, data.generatedAt.slice(0, 10), (pin) => ({
    title: pin.title,
    url: pin.url,
    from: pin.from,
    publishedAt: data.generatedAt,
  }));
  return { since: new Date(since).toISOString(), until: data.generatedAt, items: finished };
}

/** Where the collector keeps one copy of the lists a day, as YYYY-MM-DD.json. */
const SNAPSHOTS = join(process.cwd(), "data", "snapshots");
/** How many past days' leads the day's lead is weighed against: a week. */
export const PAST_DAYS = 7;
const leadsByDay = new Map<string, number[]>();

/**
 * The points of the most upvoted story on each of the (at most seven) days before `day`
 * (YYYY-MM-DD), oldest first, each from that day's own snapshot, so each was measured when its
 * story was under a day old, as the day's own lead is. A day with no Hacker News story is left out.
 */
export function pastLeads(day: string): number[] {
  const known = leadsByDay.get(day);
  if (known) return known;
  let files: string[] = [];
  try {
    files = readdirSync(SNAPSHOTS);
  } catch {
    // No snapshots, so nothing to compare with.
  }
  const leads = files
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) < day)
    .sort()
    .slice(-PAST_DAYS)
    .map((name) => {
      const snapshot = JSON.parse(readFileSync(join(SNAPSHOTS, name), "utf8")) as Latest;
      // A pin is the editor's word on its own day, not a measure of size, so it is left out here.
      const { items } = listToday(snapshot, { ...editorial, pin: [] });
      return Math.max(0, ...items.map((item) => item.discussion?.points ?? 0));
    })
    .filter((points) => points > 0);
  leadsByDay.set(day, leads);
  return leads;
}

/**
 * The day's list as the page shows it, and its top story when one earns the slot: `index` is
 * the story's place in `items`, and `rule` says which rule put it there. A lab launch is led by
 * the lab's own post (see `topStoryGroup`), so the page and MCP both link to it.
 */
export function buildToday(
  data: Latest = latest,
  notes: Editorial = editorial,
): { since: string; until: string; items: Finished<TodayItem>[]; top?: { index: number; rule: TopRule } } {
  const day = listToday(data, notes);
  const top = topStory(day.items, pastLeads(data.generatedAt.slice(0, 10)));
  if (!top) return day;
  const items = day.items.map((item, n) => (n === top.index ? topStoryGroup(item, top.rule) : item));
  return { ...day, items, top };
}
