/**
 * "Today's AI news": everything the reading-list sources published in the 24 hours before the
 * data was collected. The site is a static page rebuilt once a day, so "today" is that day,
 * not the reader's; the section says which 24 hours it covers.
 */
import { latest } from "./trends";

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

/** The same article reached by two routes: ignores the protocol, "www.", the query and a closing slash. */
function sameArticle(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function buildToday(): { since: string; until: string; items: TodayItem[] } {
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
  const byArticle = new Map(items.map((item) => [sameArticle(item.url), item]));
  // Data collected before the past-day list existed falls back to the week's top stories.
  for (const s of (latest.today ?? latest.stories).filter((s) => inWindow(s.createdAt))) {
    const discussion = { url: s.discussionUrl, points: s.points };
    const known = byArticle.get(sameArticle(s.url));
    if (known) known.discussion ??= discussion;
    else {
      const item = { title: s.title, url: s.url, from: host(s.url), publishedAt: s.createdAt, discussion };
      items.push(item);
      byArticle.set(sameArticle(s.url), item);
    }
  }

  items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { since: new Date(since).toISOString(), until: latest.generatedAt, items };
}
