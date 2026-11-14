import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import "../../tokens.css";
import "./globals.css";
import { latest } from "@/lib/trends";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: "AI Trend Tracker: what is rising in AI",
  description: SITE_DESCRIPTION,
};

/**
 * Structured data: tells search engines this is one site whose figures are a dataset
 * that is updated on a known date. `<` is escaped so no value can close the script tag.
 */
const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: "en" },
    {
      "@type": "Dataset",
      "@id": `${SITE_URL}/#dataset`,
      name: "AI Trend Tracker weekly figures",
      description:
        "Weekly counts of AI research papers on arXiv, AI stories on Hacker News, new GitHub repositories and Hugging Face models by topic, with monthly figures for hiring, policy, business adoption and developer toolkit downloads.",
      url: SITE_URL,
      dateModified: latest.generatedAt,
      isAccessibleForFree: true,
      keywords: ["artificial intelligence", "AI trends", "machine learning", "arXiv", "Hacker News", "GitHub", "Hugging Face"],
      includedInDataCatalog: { "@id": `${SITE_URL}/#website` },
    },
  ],
}).replace(/</g, "\\u003c");

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior lets Next switch smooth scrolling off while it opens a page, so a new
    // page starts at the top at once instead of gliding there (and being overtaken on the way).
    <html lang="en" data-scroll-behavior="smooth" className={`${newsreader.variable} ${geist.variable}`}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </body>
    </html>
  );
}
