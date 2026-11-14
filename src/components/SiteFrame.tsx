import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PageTabs, type Page } from "@/components/PageTabs";
import { NEW_TAB } from "@/lib/links";
import { SITE_MAKER_URL } from "@/lib/site";
import { fmtDate, latest } from "@/lib/trends";

/**
 * The masthead of a page inside the site: the page tabs, a dateline, and the name as a link home.
 * The trend pages set the name as their h1, and the landing page asks for the same with `heading`;
 * every other page keeps its h1 for its own title.
 * A page with no time-span bar beneath asks for `ruled`, so the rule under the name is on every page.
 */
export function SiteMast({
  current,
  line,
  ruled = false,
  heading = false,
}: {
  current: Page;
  line: string;
  ruled?: boolean;
  /** The landing page: the name is the page's h1, and is not a link to the page it is on. */
  heading?: boolean;
}) {
  return (
    <header className={ruled ? "mast mast--ruled" : "mast"}>
      <div className="mast__top">
        <PageTabs current={current} />
        <p className="mast__line">{line}</p>
      </div>
      {heading ? (
        <h1 className="mast__name">
          <Logo className="mast__mark" />
          AI Trend Tracker
        </h1>
      ) : (
        <p className="mast__name">
          <Logo className="mast__mark" />
          <Link href="/">AI Trend Tracker</Link>
        </p>
      )}
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
