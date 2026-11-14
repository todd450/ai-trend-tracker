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

/**
 * True when a day's top story deserves more room than a row in a list: its points already match
 * the middle of the week's ten most upvoted stories, which have had up to seven days to gather
 * theirs. With fewer than five stories to compare with, nothing is called big.
 */
export function isBigStory(points: number | undefined, weekPoints: number[]): boolean {
  const topTen = [...weekPoints].sort((a, b) => b - a).slice(0, 10);
  if (points === undefined || topTen.length < 5) return false;
  const mid = topTen.length >> 1;
  const median = topTen.length % 2 ? topTen[mid] : (topTen[mid - 1] + topTen[mid]) / 2;
  return points >= median;
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
