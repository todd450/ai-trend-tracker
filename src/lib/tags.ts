/**
 * Trend tags on the day's headlines. A tag says "this headline is counted in that trend", so it
 * reads a headline exactly as the collector reads a Hacker News title for the trend counts: a
 * trend's `hn` phrases (topics.ts, products.ts), as whole words in any case, and for a product
 * not a title holding one of its `hnExcept` phrases, since the collector takes those stories off
 * its count. Nothing is guessed: no phrase, no tag.
 *
 * A topic links to its row on the topics page, a product to its row in "Product momentum" on the
 * front page, both in the default range, by the trend's own id.
 */
import { PRODUCTS } from "./products.ts";
import { TOPICS } from "./topics.ts";

export type TrendTag = { kind: "product" | "topic"; id: string; name: string; href: string };

/** The most tags one headline carries. */
export const MAX_TAGS = 2;

/** A title as lower-case words, split on anything but letters and digits, as the search splits it. */
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const padded = (text: string) => ` ${words(text).join(" ")} `;

const TRENDS = [
  ...PRODUCTS.map((p) => ({ kind: "product" as const, id: p.id, name: p.name, hn: p.hn, except: p.hnExcept ?? [], href: `/#product-${p.id}` })),
  ...TOPICS.map((t) => ({ kind: "topic" as const, id: t.id, name: t.name, hn: t.hn, except: [] as string[], href: `/data/topics#topic-${t.id}` })),
];

/**
 * The trends a headline is counted in, at most two, in the order the headline names them; a
 * product comes before a topic named by the same words ("Ollama").
 */
export function trendTags(title: string): TrendTag[] {
  const text = padded(title);
  const found: { at: number; order: number; tag: TrendTag }[] = [];
  TRENDS.forEach(({ hn, except, ...tag }, order) => {
    if (except.some((phrase) => text.includes(padded(phrase)))) return;
    const at = Math.min(...hn.map((phrase) => text.indexOf(padded(phrase))).filter((i) => i >= 0));
    if (Number.isFinite(at)) found.push({ at, order, tag });
  });
  return found
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .slice(0, MAX_TAGS)
    .map((f) => f.tag);
}
