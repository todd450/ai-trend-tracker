import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PageTabs, type Page } from "@/components/PageTabs";
import { NEW_TAB } from "@/lib/links";
import { SITE_MAKER_URL } from "@/lib/site";
import { fmtDate, latest } from "@/lib/trends";

/**
 * The masthead of a page inside the site: the page tabs, a dateline, and the name as a link home.
 * The front page sets the name as its h1; every other page keeps its h1 for its own title.
 */
export function SiteMast({ current, line }: { current: Page; line: string }) {
  return (
    <header className="mast">
      <div className="mast__top">
        <PageTabs current={current} />
        <p className="mast__line">{line}</p>
      </div>
      <p className="mast__name">
        <Logo className="mast__mark" />
        <Link href="/">AI Trend Tracker</Link>
      </p>
    </header>
  );
}

/** The foot of the trend and reading-list pages: where the figures come from, and a link to the maker's site. */
export function Colophon() {
  return (
    <footer className="colophon">
      <p>
        AI Trend Tracker is rebuilt from public data: arXiv, Hacker News, GitHub, Hugging Face and Wikipedia page views, with headlines from publishers’ own feeds. Thank you to
        arXiv for use of its open access interoperability. Counts are keyword matches and should be read as
        indicators, not measurements. Set in Newsreader and Geist. Data last collected{" "}
        {fmtDate(latest.generatedAt)}.
      </p>
      <p>
        <a href={SITE_MAKER_URL} {...NEW_TAB}>HalfBadger.com</a>
      </p>
    </footer>
  );
}
