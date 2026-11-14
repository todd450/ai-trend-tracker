/**
 * The finishing step for the ranked lists. Ranking by Hacker News points says what one community
 * upvoted; it cannot tell that two posts are the same announcement, and it gives nobody the last
 * word. So after a list is ranked:
 *
 *   1. anything listed under `hide` in data/editorial.json is left out,
 *   2. posts about one event (or one outage) are gathered under the highest-ranked of them, and
 *   3. anything listed under `pin` is moved to the top, until the pin's last day.
 *
 * Steps 1 and 3 are a person's decisions, kept by hand in the file; step 2 is a fixed rule.
 * Nothing here changes the trend figures.
 */

import { PRODUCTS } from "./products.ts";

/** A post held at the top of "Today's AI news" through `until` (YYYY-MM-DD), whatever its points. */
export type Pin = { url: string; title: string; from: string; until: string; note?: string };
/** A link left out of every list, with the reason, which the page prints. */
export type Hide = { url: string; reason: string };
/** One sentence in the editor's own words, shown under the headline through `until` (YYYY-MM-DD). */
export type Line = { text: string; until: string };
export type Editorial = { pin: Pin[]; hide: Hide[]; line?: Line };

/** The editor's line, while its last day has not passed. */
export function lineFor(editorial: Editorial, today: string): string | undefined {
  return editorial.line && editorial.line.until >= today ? editorial.line.text : undefined;
}

/** The fewest past days whose leads are worth taking the middle of. */
export const MIN_PAST_DAYS = 3;

/**
 * True when a day's lead story has as many points as the middle of the past days' leads: the
 * most upvoted story on each earlier day's list, measured when that list was collected, so each
 * was under a day old, like today's. With fewer than three past days, points lift nothing.
 */
export function matchesPastLeads(points: number | undefined, pastLeads: number[]): boolean {
  if (points === undefined || pastLeads.length < MIN_PAST_DAYS) return false;
  const sorted = [...pastLeads].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return points >= median;
}

/**
 * The labs whose own posts can make a lab launch: the frontier labs among the lab feeds. The
 * specialist labs (ElevenLabs, Runway, Suno, Stability AI) are listed on the page but not here.
 */
export const FRONTIER_LABS = new Set(["Anthropic", "OpenAI", "Google DeepMind", "Microsoft", "Mistral AI", "Meta", "xAI", "DeepSeek"]);

/** A post that can be weighed for the top slot: `lab` is set on posts from the labs' own feeds. */
type Weighed = { from: string; lab?: boolean; discussion?: { points: number } };

const postsOf = <T>(group: Finished<T>): T[] => [group, ...group.also];

/** The frontier lab whose own post is in a group, if one is. */
const launchingLab = <T extends Weighed>(group: Finished<T>) =>
  postsOf(group).find((post) => post.lab && FRONTIER_LABS.has(post.from))?.from;

/** How many Hacker News stories a group's posts carry. */
const discussions = <T extends Weighed>(group: Finished<T>) => postsOf(group).filter((post) => post.discussion).length;

/**
 * True when a group holds a frontier lab's own post and at least two Hacker News stories: a
 * launch the community picked up twice. This does not depend on points, so a story a few hours
 * old is not weighed against older ones.
 */
export function isLabLaunch<T extends Weighed>(group: Finished<T>): boolean {
  return launchingLab(group) !== undefined && discussions(group) >= 2;
}

/** Why a story has the top slot: the editor pinned it, it is a lab launch, or its points are big. */
export type TopRule = "pinned" | "lab" | "points";

/**
 * Which story, if any, is set large above the list, and by which rule. A pin always wins, and a
 * pinned post is first in the list. Otherwise the first group in ranked order that is a lab
 * launch, or whose points match the past days' leads, takes it; only the list's lead can match
 * on points, since the list is ranked by them. On an ordinary day nothing does.
 */
export function topStory<T extends Weighed>(items: Finished<T>[], pastLeads: number[]): { index: number; rule: TopRule } | undefined {
  if (items[0]?.pinned) return { index: 0, rule: "pinned" };
  const index = items.findIndex((item) => isLabLaunch(item) || matchesPastLeads(item.discussion?.points, pastLeads));
  if (index < 0) return undefined;
  return { index, rule: isLabLaunch(items[index]) ? "lab" : "points" };
}

const times = (n: number) => (n === 2 ? "twice" : `${n} times`);

/** The kicker over the top story: which rule lifted it, in words. */
export function topStoryReason<T extends Weighed>(group: Finished<T>, rule: TopRule): string {
  if (rule === "pinned") return "Editor’s pick";
  if (rule === "lab") return `${launchingLab(group)}’s own announcement, discussed ${times(discussions(group))} on Hacker News`;
  return "As big as the past days’ leading stories";
}

/** The same article reached by two routes: ignores the protocol, "www.", the query and a closing slash. */
export function sameArticle(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** A headline reduced to its words, so "Introducing Gemini 4 Hydrogen" can be matched with "Gemini 4 Hydrogen". */
const words = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * True when one headline holds the whole of the other, as whole words. The shorter must run to
 * three words, so that a story titled only "Claude" is not taken for every post about Claude.
 */
export function sameHeadline(a: string, b: string): boolean {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length);
  return short.length >= 3 && ` ${long.join(" ")} `.includes(` ${short.join(" ")} `);
}

/** A version number ("4", "5.2" as "5" and "2", "v4"), but not a year, which many unrelated headlines share. */
const isVersion = (word: string) => /\d/.test(word) && !/^(19|20)\d\d$/.test(word);

/**
 * True when two headlines are about one event: one holds the other, or they share a run of three
 * or more words that includes a version number, as "Introducing Gemini 4 Hydrogen" and
 * "Gemini 4 Hydrogen and Orchestrator" share "gemini 4 hydrogen". A shared name and number alone
 * ("Gemini 4") is not enough: a review of a model is not its launch.
 */
export function sameEvent(a: string, b: string): boolean {
  if (sameHeadline(a, b)) return true;
  const x = words(a);
  const y = words(b);
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) {
      let n = 0;
      while (i + n < x.length && j + n < y.length && x[i + n] === y[j + n]) n++;
      if (n >= 3 && x.slice(i, i + n).some(isVersion)) return true;
    }
  }
  return false;
}

/** Words that say a service is failing. "down" has its own test, in `hasOutageWord`. */
const OUTAGE_WORDS = new Set(["down", "outage", "outages", "errors", "degraded"]);

/**
 * Verbs, in any tense, that make "down" mean something other than an outage: "shuts down",
 * "cracking down", "stepped down". Whole words only, so "site down" is still an outage.
 */
const NOT_AN_OUTAGE_BEFORE_DOWN =
  /^((shut|cut|crack|step|back|break|turn|wind|slow|water|track|put|let|calm|weigh|lock|clamp|hunt|mark|knock|narrow|boil|bog|dumb|strip|stand|filter|hand|pass|vote)(s|ed|ing|ting|ping|ped|ged|ging|bed|bing)?|broke|scaled?|scal(es|ing)|tone[sd]?|toning|take[sn]?|taking|took|bring(s|ing)?|brought|sit(s|ting)?|sat|pare[sd]?|paring|double[sd]?|doubling|write[sn]?|writing|wrote|written|settle[sd]?|settling|stood)$/;

const hasOutageWord = (w: string[]) =>
  w.some((word, i) => OUTAGE_WORDS.has(word) && !(word === "down" && i > 0 && NOT_AN_OUTAGE_BEFORE_DOWN.test(w[i - 1])));

/** A phrase, as words, padded so that it only matches whole words. */
const padded = (w: string[]) => ` ${w.join(" ")} `;

/**
 * The ids of the tracked products a headline names. A longer product's name is taken out first,
 * so "Claude Code is down" names Claude Code, not Claude, while "claude.ai and Claude Code" names both.
 */
function productsNamed(title: string): Set<string> {
  const named = new Set<string>();
  for (const product of PRODUCTS) {
    let text = padded(words(title));
    for (const except of product.hnExcept ?? []) text = text.split(padded(words(except))).join("  ");
    if (product.hn.some((phrase) => text.includes(padded(words(phrase))))) named.add(product.id);
  }
  return named;
}

/** The host of a status page ("status.claude.com"), or undefined for any other address. */
function statusPage(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.startsWith("status.") ? host : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when two posts are about one outage: both link to the same status page (`status.<host>`),
 * or both headlines carry an outage word (down, outage, errors, degraded) and name the same
 * tracked product. Two posts about one product with no outage word stay apart, as do two outages
 * of different products.
 */
export function sameOutage(a: { title: string; url: string }, b: { title: string; url: string }): boolean {
  const page = statusPage(a.url);
  if (page && page === statusPage(b.url)) return true;
  if (!hasOutageWord(words(a.title)) || !hasOutageWord(words(b.title))) return false;
  const named = productsNamed(b.title);
  return [...productsNamed(a.title)].some((id) => named.has(id));
}

/** The hidden links, keyed as `sameArticle` keys them. */
const hiddenKeys = (editorial: Editorial) => new Set(editorial.hide.map((h) => sameArticle(h.url)));

/** A ranked list without the links the editor has hidden. */
export function visible<T extends { url: string }>(items: T[], editorial: Editorial): T[] {
  const hidden = hiddenKeys(editorial);
  return hidden.size ? items.filter((item) => !hidden.has(sameArticle(item.url))) : items;
}

export type Finished<T> = T & {
  /** Other posts about the same event, in ranked order. They stay on the page, under this one. */
  also: T[];
  /** Set when the editor pinned this post; carries the note, if one was given. */
  pinned?: { note?: string };
};

/**
 * Applies the three steps to a list already in ranked order. `today` is the day the data was
 * collected (YYYY-MM-DD): a pin whose `until` has passed is ignored, so a forgotten pin cannot
 * sit at the top of a page that rebuilds itself every day. `fromPin` builds a list item for a
 * pinned post that the sources did not carry.
 */
export function finish<T extends { title: string; url: string }>(
  ranked: T[],
  editorial: Editorial,
  today: string,
  fromPin: (pin: Pin) => T,
): Finished<T>[] {
  const leads: Finished<T>[] = [];
  for (const item of visible(ranked, editorial)) {
    const lead = leads.find((l) => sameEvent(l.title, item.title) || sameOutage(l, item));
    if (lead) lead.also.push(item);
    else leads.push({ ...item, also: [] });
  }

  const hidden = hiddenKeys(editorial);
  const pins = editorial.pin.filter((p) => p.until >= today && !hidden.has(sameArticle(p.url)));
  // Placed last to first, so the first pin in the file ends up on top.
  for (const pin of [...pins].reverse()) {
    const key = sameArticle(pin.url);
    const at = leads.findIndex((l) => sameArticle(l.url) === key || l.also.some((a) => sameArticle(a.url) === key));
    const pinned = { note: pin.note };
    if (at < 0) {
      leads.unshift({ ...fromPin(pin), also: [], pinned });
      continue;
    }
    const [group] = leads.splice(at, 1);
    // A pinned post that sat under another becomes the lead of its group.
    const { also, ...rest } = group;
    delete (rest as { pinned?: unknown }).pinned;
    const members = [rest as unknown as T, ...also];
    const lead = members.find((m) => sameArticle(m.url) === key)!;
    leads.unshift({ ...lead, also: members.filter((m) => m !== lead), pinned });
  }
  return leads;
}
