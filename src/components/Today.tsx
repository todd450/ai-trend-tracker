import Link from "next/link";
import { Ledger } from "@/components/Ledger";
import { OldTrendLinks } from "@/components/OldTrendLinks";
import { FootLinks, SiteMast } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { topStoryReason } from "@/lib/editorial";
import { NEW_TAB } from "@/lib/links";
import { trendTags } from "@/lib/tags";
import { buildToday } from "@/lib/today";
import { HORIZONS, fmtCompact, fmtDate, fmtDay, fmtDayTime, latest } from "@/lib/trends";
import { whyItMatters } from "@/lib/why";

/**
 * The trends a headline is counted in (see `trendTags`), each a link to its row on the site.
 * Plain links, not client navigation, so the browser follows the #anchor on arrival.
 */
function Tags({ title, className }: { title: string; className: string }) {
  const tags = trendTags(title);
  if (tags.length === 0) return null;
  return (
    <span className={`tags ${className}`}>
      <span className="vh">Counted in the trends: </span>
      {tags.map((tag) => (
        <a className="tag" href={tag.href} key={tag.href}>
          {tag.name}
        </a>
      ))}
    </span>
  );
}

/**
 * Today's AI news: what was published in the 24 hours before the data was collected. It reads
 * the same whichever span the trends are viewed over, so it has a page of its own.
 */
export function Today() {
  const today = buildToday();
  /**
   * The day's top story is set large, above the list, when the editor pinned it, when it is a
   * frontier lab's launch discussed twice on Hacker News, or when its points match the past days'
   * leads (see `topStory`). On an ordinary day every story is a row.
   */
  const top = today.top;
  const first = top && today.items[top.index];
  const bigDay = first !== undefined;
  /** The line under the top story, from its first tag's trend (see `whyItMatters`); none without a tag. */
  const why = first && whyItMatters(first.title);
  const rows = top ? today.items.filter((_, n) => n !== top.index) : today.items;

  return (
    <>
      <a className="skip" href="#today">
        Skip to the news
      </a>

      <OldTrendLinks to={HORIZONS.threeMonths.href} />

      <SiteMast ruled heading current="today" line={`Updated ${fmtDate(latest.generatedAt)}`} />

      <main className="page">
        <div className="chapter chapter--front">
          {/* The landing page: the name above is its heading, so the page's own title is one line and the lead story sits high. */}
          <div className="dateline">
            {/* A heading, though it is set small: a reader moving by headings finds the list on a day with no top story. */}
            <h2 id="today-h">Today’s AI news</h2>
            <p>
              From the labs, the analysts and Hacker News in the 24 hours to {fmtDayTime(today.until)} UTC, biggest
              stories first.
            </p>
          </div>

          <section id="today" className="band band--today" aria-labelledby="today-h">
            {top && first && (
              <article className="top-story">
                <p className="top-story__kicker">{topStoryReason(first, top.rule)}</p>
                <h2>
                  <a href={first.url} {...NEW_TAB}>{first.title}</a>
                </h2>
                <p className="top-story__meta">
                  {first.from}
                  {first.discussion && (
                    <>
                      {" · "}
                      <a href={first.discussion.url} {...NEW_TAB}>{fmtCompact(first.discussion.points)} points on Hacker News</a>
                    </>
                  )}
                  {" · "}
                  {first.publishedAt.includes("T00:00:00") ? fmtDay(first.publishedAt) : `${fmtDayTime(first.publishedAt)} UTC`}
                </p>
                <Tags title={first.title} className="top-story__tags" />
                {why && (
                  <p className="top-story__why">
                    <strong>The trend:</strong> {why}
                  </p>
                )}
                {first.pinned?.note && <p className="top-story__note">{first.pinned.note}</p>}
                {first.also.length > 0 && (
                  <ul className="top-story__also" aria-label="Other posts on the same story">
                    {first.also.map((other) => (
                      <li key={other.url}>
                        <a href={other.url} {...NEW_TAB}>{other.title}</a> ({other.from}
                        {other.discussion && <>, {fmtCompact(other.discussion.points)} points</>})
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )}
            {rows.length > 0 ? (
              <Ledger
                first="Headline"
                labelledBy="today-h"
                count={rows.length}
                start={bigDay ? 2 : 1}
                all
                more={<Link className="more" href="/reading#news">The week’s top stories →</Link>}
                cells={[
                  { head: "From", width: "9.5rem", start: true },
                  { head: "Hacker News", width: "5.5rem" },
                  { head: "Published (UTC)", width: "6.5rem" },
                ]}
              >
                {rows.map((item) => (
                  <li key={item.url}>
                    <span className="ledger__main">
                      {item.pinned && <span className="ledger__pick">Editor’s pick</span>}
                      <a href={item.url} title={item.title} {...NEW_TAB}>{item.title}</a>
                    </span>
                    <span className="ledger__data">
                      <span className="ledger__cell--start">{item.from}</span>
                      <span>
                        {item.discussion && (
                          <a href={item.discussion.url} {...NEW_TAB}>
                            {fmtCompact(item.discussion.points)}
                            <span className="ledger__unit"> points</span>
                          </a>
                        )}
                      </span>
                      {/* Some feeds give a day and no time; midnight exactly means the time is not known. */}
                      <span>{item.publishedAt.includes("T00:00:00") ? fmtDay(item.publishedAt) : fmtDayTime(item.publishedAt)}</span>
                    </span>
                    {(item.pinned?.note || item.also.length > 0 || trendTags(item.title).length > 0) && (
                      <span className="ledger__also">
                        <Tags title={item.title} className="ledger__tags" />
                        {item.pinned?.note && <span>{item.pinned.note}</span>}
                        {item.also.length > 0 && (
                          <span>
                            Same story:{" "}
                            {item.also.map((other, n) => (
                              <span key={other.url}>
                                {n > 0 && ", "}
                                <a href={other.url} title={other.title} {...NEW_TAB}>
                                  {other.title}
                                </a>{" "}
                                ({other.from}
                                {other.discussion && <>, {fmtCompact(other.discussion.points)} points</>})
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </Ledger>
            ) : bigDay ? null : (
              <p className="band__empty">
                None of the sources published anything in the 24 hours before the last update. The week’s stories are
                in <Link href="/reading">the reading list</Link>.
              </p>
            )}
            <SourceLine names="the labs’ and newsletters’ own feeds; Hacker News" keys={["labNews", "analysis", "today"]} />
          </section>
        </div>
        {/* How this is measured closed this page before it had a page of its own; an old #method link lands at the foot, by the link to it. */}
        <span id="method" />
      </main>

      <footer className="colophon">
        <p>
          Headlines come from publishers’ own feeds and from Hacker News, and each links to its source. Points
          measure the attention of Hacker News readers, not importance. Data last collected{" "}
          {fmtDate(latest.generatedAt)}.
        </p>
        <FootLinks />
      </footer>
    </>
  );
}
