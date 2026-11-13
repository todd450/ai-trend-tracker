import type { MetadataRoute } from "next";
import { conferences } from "@/lib/conferences";
import { PAGES, SITE_URL } from "@/lib/site";
import { latest } from "@/lib/trends";

/** Every page changes when the data is collected, so that is each one's last-modified date. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(latest.generatedAt);
  const pages: MetadataRoute.Sitemap = PAGES.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
  // One page per event. Its phase moves with the date, so it too changes with each collection.
  const events: MetadataRoute.Sitemap = conferences.map((c) => ({
    url: `${SITE_URL}/conferences/${c.id}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.5,
  }));
  return [...pages, ...events];
}
