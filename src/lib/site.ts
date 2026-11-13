/**
 * The site's public address and the metadata search engines and link previews read.
 *
 * Search engines attach a page's standing to one address, so every page names its own
 * (the canonical URL). Set SITE_URL when the site moves to another domain.
 */
import type { Metadata } from "next";

export const SITE_URL = (process.env.SITE_URL ?? "https://ai-trend-tracker-pearl.vercel.app").replace(/\/+$/, "");
export const SITE_NAME = "AI Trend Tracker";
/** Who makes the site, and where a reader can report a mistake. Shown in the footer of every page. */
export const SITE_AUTHOR = "Todd Holloway";
export const SITE_ISSUES_URL = "https://github.com/todd450/ai-trend-tracker/issues";
export const SITE_DESCRIPTION =
  "A weekly reading of where attention in artificial intelligence is moving, measured from research papers, open-source code, model releases and news discussion.";

/** Every page on the site, in the order the sitemap lists them. */
export const PAGES = ["/", "/one-week", "/one-month", "/six-months", "/one-year", "/conferences"] as const;

/** The share card drawn by app/opengraph-image.tsx. */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "AI Trend Tracker: what is rising in AI" };

/**
 * One page's metadata. Next replaces nested fields such as `openGraph` whole rather than
 * merging them with the layout's, so each page states all of them here, the share card included.
 */
export function pageMetadata(page: { path: (typeof PAGES)[number]; title: string; description: string }): Metadata {
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
