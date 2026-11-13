/**
 * "Today's AI news": everything the reading-list sources published in the 24 hours before the
 * data was collected. The site is a static page rebuilt once a day, so "today" is that day,
 * not the reader's; the section says which 24 hours it covers. The list runs biggest story first,
 * by points on Hacker News.
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

/** A headline reduced to its words, so "Introducing Gemini 4 Hydrogen" can be matched with "Gemini 4 Hydrogen". */
const words = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * True when one headline holds the whole of the other, as whole words. The shorter must run to
 * three words, so that a story titled only "Claude" is not taken for every post about Claude.
 */
function sameHeadline(a: string, b: string) {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length);
  return short.split(" ").length >= 3 && ` ${long} `.includes(` ${short} `);
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
  return { since: new Date(since).toISOString(), until: latest.generatedAt, items };
}
