/**
 * "This week", the block at the top of the reading list: up to seven of the past seven days'
 * items, chosen by fixed rules and grouped under the trend each one feeds.
 *
 *   1. Pool: everything the eight lists below hold from the seven days before the data was
 *      collected. A post that also reached Hacker News is one item, with its discussion attached.
 *   2. Rank: biggest first, by points on Hacker News, the one figure the sources share; posts
 *      nobody discussed there follow, newest first.
 *   3. Finish: the editor's rules in editorial.ts gather posts about one event and apply the
 *      hides and pins kept by hand in data/editorial.json.
 *   4. Choose: an item qualifies when its headline carries a trend tag (`trendTags`), when it is a
 *      frontier lab's launch (`isLabLaunch`), or when the editor pinned it. Each is grouped under
 *      its first tag. Groups go pinned first, then lab launches, then by their biggest story on Hacker
 *      News, so the week's most discussed stories lead whichever way their trend is moving. At most
 *      two items go in a group and seven in all; a pin or a lab launch is never cut.
 *
 * Nothing here is stored, and nothing about the reader is read: the block is rebuilt with the
 * page each day. Like Today's, it reads the editor's file and the trend figures, and changes neither.
 */
import { finish, isLabLaunch, sameArticle, sameHeadline, topStoryGroup, type Editorial, type Finished } from "./editorial";
import { host } from "./links";
import type { TrendReading } from "./sentences";
import { trendTags, type TrendTag } from "./tags";
import { editorial } from "./today";
import { latest } from "./trends";
import type { Latest } from "./types";
import { lineOf, trendReading } from "./why";

export { editorial };

const DAY = 86_400_000;
/** How far back the block reaches: one week. */
export const WINDOW_DAYS = 7;
/** The most items the block holds, and the most in one trend's group. */
export const MAX_ITEMS = 7;
export const MAX_PER_GROUP = 2;

/** The anchors of the eight lists on the reading list page. */
export type ListId = "news" | "papers" | "analysis" | "announcements" | "launches" | "code" | "models" | "labs";

export type WeekItem = {
  title: string;
  url: string;
  /** The lab or publication, or for a link the site it is on. */
  from: string;
  publishedAt: string;
  /** The list below that holds it; a pinned post the lists do not carry has none. */
  list?: ListId;
  /** Set for Hacker News stories, and for a post a Hacker News story links to or carries the headline of. */
  discussion?: { url: string; points: number };
  /** Set for posts from the labs' own feeds. */
  lab?: boolean;
};

export type WeekEntry = Finished<WeekItem> & { launch?: true };

export type WeekGroup = {
  /** The trend the group's items feed; none for a pinned post or a lab launch that names no trend. */
  tag?: TrendTag;
  /** The trend's call over the default range, as its row reads it. */
  call?: string;
  /** The rule-written line on how the trend is moving (see `whyItMatters`). */
  line?: string;
  items: WeekEntry[];
};

export type Week = {
  since: string;
  until: string;
  groups: WeekGroup[];
  /** The biggest of the week's stories the block leaves out because they name no tracked trend, biggest first. */
  leftOut: Finished<WeekItem>[];
};

/** The week's items from the eight lists, one per article, ranked and finished. */
function pool(data: Latest, notes: Editorial, since: number, until: number): Finished<WeekItem>[] {
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= since && t <= until;
  };

  const items: WeekItem[] = [];
  const byArticle = new Map<string, WeekItem>();
  const add = (item: WeekItem) => {
    if (!inWindow(item.publishedAt) || byArticle.has(sameArticle(item.url))) return;
    items.push(item);
    byArticle.set(sameArticle(item.url), item);
  };

  const feed = (list: ListId, lab: boolean) => (a: Latest["labNews"][number]) =>
    add({ title: a.title, url: a.url, from: a.source, publishedAt: a.publishedAt, list, ...(lab && { lab: true }) });
  (data.labNews ?? []).forEach(feed("announcements", true));
  (data.analysis ?? []).forEach(feed("analysis", false));

  // A post that also reached Hacker News is listed once, with the discussion attached. Hacker News
  // often links a second copy of an announcement, so the headline is matched as well as the address.
  const posts = [...items];
  const discussed = (list: ListId) => (s: Latest["stories"][number]) => {
    if (!inWindow(s.createdAt)) return;
    const discussion = { url: s.discussionUrl, points: s.points };
    const known = byArticle.get(sameArticle(s.url)) ?? posts.find((p) => sameHeadline(p.title, s.title));
    // The stories arrive most upvoted first, so a post keeps the largest of its discussions.
    if (known) known.discussion ??= discussion;
    else add({ title: s.title, url: s.url, from: host(s.url), publishedAt: s.createdAt, list, discussion });
  };
  data.stories.forEach(discussed("news"));
  (data.launches ?? []).forEach(discussed("launches"));

  for (const p of data.papers) add({ title: p.title, url: p.url, from: host(p.url), publishedAt: p.publishedAt, list: "papers" });
  for (const r of data.repos) add({ title: r.name, url: r.url, from: host(r.url), publishedAt: r.createdAt, list: "code" });
  for (const m of data.models) add({ title: m.id, url: m.url, from: host(m.url), publishedAt: m.createdAt, list: "models" });
  for (const m of data.releases) add({ title: m.id, url: m.url, from: host(m.url), publishedAt: m.createdAt, list: "labs" });

  items.sort(
    (a, b) =>
      (b.discussion?.points ?? -1) - (a.discussion?.points ?? -1) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  return finish(items, notes, data.generatedAt.slice(0, 10), (pin) => ({
    title: pin.title,
    url: pin.url,
    from: pin.from,
    publishedAt: data.generatedAt,
  }));
}

/** The trend a group of posts feeds: the first tag of its lead, or failing that of a post under it. */
const tagOf = (group: Finished<WeekItem>) => [group, ...group.also].map((p) => trendTags(p.title)[0]).find(Boolean);

/**
 * The week's block, as the reading list shows it. `read` gives a trend's reading; it is the
 * site's own (see `trendReading`) unless a test supplies one.
 */
export function buildWeek(
  data: Latest = latest,
  notes: Editorial = editorial,
  read: (tag: TrendTag) => TrendReading | undefined = trendReading,
): Week {
  const until = Date.parse(data.generatedAt);
  const since = until - WINDOW_DAYS * DAY;
  const finished = pool(data, notes, since, until);

  type Candidate = { entry: WeekEntry; at: number; must: number };
  type Draft = { key: string; tag?: TrendTag; reading?: TrendReading; first: number; candidates: Candidate[] };
  const drafts = new Map<string, Draft>();
  const leftOut: Finished<WeekItem>[] = [];

  finished.forEach((group, at) => {
    const launch = isLabLaunch(group);
    const entry: WeekEntry = launch ? { ...topStoryGroup(group, "lab"), launch: true } : group;
    const tag = tagOf(entry);
    // 0: the editor's pin, 1: a lab launch, 2: any other item with a tag.
    const must = entry.pinned ? 0 : launch ? 1 : 2;
    if (!tag && must === 2) {
      if (entry.discussion) leftOut.push(entry);
      return;
    }
    const key = tag ? `${tag.kind}:${tag.id}` : `item:${at}`;
    let draft = drafts.get(key);
    if (!draft) {
      draft = { key, tag, reading: tag && read(tag), first: at, candidates: [] };
      drafts.set(key, draft);
    }
    draft.candidates.push({ entry, at, must });
  });

  // `first` is the place of a group's biggest story in the ranked pool, so it orders groups by size.
  const must = (d: Draft) => Math.min(...d.candidates.map((c) => c.must));
  const ordered = [...drafts.values()].sort((a, b) => must(a) - must(b) || a.first - b.first);

  let total = 0;
  const groups: WeekGroup[] = [];
  for (const draft of ordered) {
    const chosen: WeekEntry[] = [];
    for (const c of draft.candidates.sort((a, b) => a.must - b.must || a.at - b.at)) {
      // A pin or a lab launch is never cut; anything else waits for room.
      if (c.must < 2 || (total < MAX_ITEMS && chosen.length < MAX_PER_GROUP)) {
        chosen.push(c.entry);
        total++;
      }
    }
    if (chosen.length === 0) continue;
    groups.push({
      tag: draft.tag,
      call: draft.reading?.call,
      line: draft.reading && lineOf(draft.reading),
      items: chosen,
    });
  }

  // The stories left out for want of a tag that are bigger than the smallest story the block holds.
  const held = groups.flatMap((g) => g.items).flatMap((i) => (i.discussion ? [i.discussion.points] : []));
  const floor = held.length ? Math.min(...held) : 0;
  return {
    since: new Date(since).toISOString(),
    until: data.generatedAt,
    groups,
    leftOut: leftOut.filter((i) => (i.discussion?.points ?? 0) > floor),
  };
}
