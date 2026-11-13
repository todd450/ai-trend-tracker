/**
 * "Today's AI news": everything the reading-list sources published in the 24 hours before the
 * data was collected. The site is a static page rebuilt once a day, so "today" is that day,
 * not the reader's; the section says which 24 hours it covers.
 *
 * The list is made in three steps. Pool: the lab and newsletter posts and the day's Hacker News
 * stories. Rank: biggest first, by points on Hacker News. Finish: the editor's rules in
 * editorial.ts, which gather posts about one event and apply the pins and hides kept by hand in
 * data/editorial.json.
 */
import editorialJson from "../../data/editorial.json";
import { finish, sameArticle, sameHeadline, type Editorial, type Finished } from "./editorial";
import { latest } from "./trends";

/** The editor's pins and hides, kept by hand. */
export const editorial = editorialJson as Editorial;

const DAY = 86_400_000;

export type TodayItem = {
  title: string;
  url: string;
  /** The lab or publication, or for a Hacker News story the site it links to. */
  from: string;
  publishedAt: string;
  /** Set for Hacker News stories only. */
  discussion?: { url: string; points: number };
};

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildToday(): { since: string; until: string; items: Finished<TodayItem>[] } {
  const until = Date.parse(latest.generatedAt);
  const since = until - DAY;
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= since && t <= until;
  };

  const items: TodayItem[] = [...(latest.labNews ?? []), ...(latest.analysis ?? [])]
    .filter((a) => inWindow(a.publishedAt))
    .map((a) => ({ title: a.title, url: a.url, from: a.source, publishedAt: a.publishedAt }));

  // A lab post that also reached Hacker News is listed once, under the lab, with its discussion attached.
  // Hacker News often links a second copy of the announcement, so the headline is matched as well as the address.
  const posts = [...items];
  const byArticle = new Map(items.map((item) => [sameArticle(item.url), item]));
  // Data collected before the past-day list existed falls back to the week's top stories.
  for (const s of (latest.today ?? latest.stories).filter((s) => inWindow(s.createdAt))) {
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
  const finished = finish(items, editorial, latest.generatedAt.slice(0, 10), (pin) => ({
    title: pin.title,
    url: pin.url,
    from: pin.from,
    publishedAt: latest.generatedAt,
  }));
  return { since: new Date(since).toISOString(), until: latest.generatedAt, items: finished };
}
