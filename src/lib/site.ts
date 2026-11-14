/**
 * The site's public address and the metadata search engines and link previews read.
 *
 * Search engines attach a page's standing to one address, so every page names its own
 * (the canonical URL). Set SITE_URL when the site moves to another domain.
 */
import type { Metadata } from "next";

export const SITE_URL = (process.env.SITE_URL ?? "https://ai-trend-tracker-pearl.vercel.app").replace(/\/+$/, "");
export const SITE_NAME = "AI Trend Tracker";
/** Who makes the site (named in the feed), and the maker's own site, linked from the footer of every page. */
export const SITE_AUTHOR = "Todd Holloway";
export const SITE_MAKER_URL = "https://halfbadger.com";
export const SITE_DESCRIPTION =
  "A weekly reading of where attention in artificial intelligence is moving, measured from research papers, open-source code, model releases and news discussion.";

/**
 * The site's fixed pages, in the order the sitemap lists them; each conference adds a page after them.
 * A dataset page is listed at its default range (3 months) only: its other ranges are views of the same
 * figures, linked from the switch on the page, and would only crowd the sitemap.
 */
export const PAGES = [
  "/",
  "/one-week",
  "/one-month",
  "/three-months",
  "/six-months",
  "/one-year",
  "/two-years",
  "/data/topics",
  "/reading",
  "/conferences",
] as const;

/** The share card drawn by app/opengraph-image.tsx. */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "AI Trend Tracker: what is rising in AI" };

/**
 * One page's metadata. Next replaces nested fields such as `openGraph` whole rather than
 * merging them with the layout's, so each page states all of them here, the share card included.
 */
/** A fixed page, one conference's page, or one range of a dataset page. */
export type PagePath = (typeof PAGES)[number] | `/conferences/${string}` | `/data/topics/${string}`;

export function pageMetadata(page: { path: PagePath; title: string; description: string }): Metadata {
  const { path, title, description } = page;
  return {
    title,
    description,
    // The feed is announced on every page, so a feed reader finds it from any of them.
    alternates: { canonical: path, types: { "application/atom+xml": [{ url: "/feed.xml", title: `${SITE_NAME}: weekly editions` }] } },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: path, title, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}
