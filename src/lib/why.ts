/**
 * The "why it matters" line under Today's top story, written by a fixed rule from the tracker's
 * own figures: the trend of the headline's first tag, as its row on the site reads it over the
 * default range (three months), the same row the tag links to. A topic reads as on the topics
 * page's table, a product as under "Product momentum" on the front page. A headline with no tag
 * has no line.
 */
import { topicTable, type Call } from "./datasets";
import { trendLine, type TrendReading } from "./sentences";
import { trendTags, type TrendTag } from "./tags";
import { HORIZONS, THEME_STEADY_BAND, buildTrends, heldBack, signalDirection } from "./trends";

const RANGE = "threeMonths" as const;

function readingOf(kind: "product" | "topic", id: string, name: string): TrendReading | undefined {
  if (kind === "topic") {
    const row = topicTable(RANGE).rows.find((r) => r.id === id);
    return row && { name, call: row.discussion.call, recent: row.discussion.recent, prior: row.discussion.prior };
  }
  const p = buildTrends(RANGE).productTrends.find((t) => t.id === id);
  if (!p) return undefined;
  // The front page draws no bar for a product with too few stories, and greys one within its usual swing.
  const call: Call = !p.enough
    ? "too few to call"
    : heldBack(p.stories, THEME_STEADY_BAND)
      ? "too noisy to call"
      : signalDirection(p.stories, THEME_STEADY_BAND);
  return { name, call, recent: p.stories.recent, prior: p.stories.prior };
}

/** How a tagged trend reads over the default range, as the row its tag links to reads it. */
export function trendReading(tag: TrendTag): TrendReading | undefined {
  return readingOf(tag.kind, tag.id, tag.name);
}

/** The line for one trend's reading, naming the default range. */
export const lineOf = (reading: TrendReading) => trendLine(reading, HORIZONS[RANGE]);

/** The line for a headline, or undefined when it names no tracked trend. */
export function whyItMatters(title: string): string | undefined {
  const [tag] = trendTags(title);
  const reading = tag && trendReading(tag);
  return reading ? lineOf(reading) : undefined;
}
