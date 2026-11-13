/**
 * The finishing step for the ranked lists. Ranking by Hacker News points says what one community
 * upvoted; it cannot tell that two posts are the same announcement, and it gives nobody the last
 * word. So after a list is ranked:
 *
 *   1. anything listed under `hide` in data/editorial.json is left out,
 *   2. posts about one event are gathered under the highest-ranked of them, and
 *   3. anything listed under `pin` is moved to the top, until the pin's last day.
 *
 * Steps 1 and 3 are a person's decisions, kept by hand in the file; step 2 is a fixed rule.
 * Nothing here changes the trend figures.
 */

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
    const lead = leads.find((l) => sameEvent(l.title, item.title));
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
