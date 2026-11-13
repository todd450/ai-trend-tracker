import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/site";
import { latest } from "@/lib/trends";

/** Every page changes when the data is collected, so that is each one's last-modified date. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(latest.generatedAt);
  return PAGES.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
