import Link from "next/link";
import { ConfMast } from "@/components/Conferences";
import { Ledger } from "@/components/Ledger";
import { SourceLine } from "@/components/SourceLine";
import { isBigStory } from "@/lib/editorial";
import { NEW_TAB } from "@/lib/links";
import { SITE_AUTHOR, SITE_ISSUES_URL } from "@/lib/site";
import { buildToday, editorial } from "@/lib/today";
import { fmtCompact, fmtDate, fmtDay, fmtDayTime, latest } from "@/lib/trends";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Today's AI news: what was published in the 24 hours before the data was collected. It reads
 * the same whichever span the trends are viewed over, so it has a page of its own.
 */
export function Today() {
  const today = buildToday();
  const pinsNow = today.items.filter((item) => item.pinned);
  /**
   * The day's first story is set large, above the list, when the editor pinned it or when it is
   * already as big as the week's top stories. On an ordinary day every story is a row.
   */
  const [first, ...rest] = today.items;
  const bigDay =
    first !== undefined &&
    (first.pinned !== undefined || isBigStory(first.discussion?.points, latest.stories.map((s) => s.points)));
  const rows = bigDay ? rest : today.items;
  const count = today.items.length;

  return (
    <>
      <a className="skip" href="#today">
        Skip to the news
      </a>

      <ConfMast current="today" />

      <main className="page">
        <section className="lede lede--cal">
          <div className="lede__main">
            <h1 className="lede__head" id="today-h">Today’s AI news</h1>
            <div className="lede__dek">
              <p>
                What the labs announced, what the analysts published and which AI stories Hacker News picked up in
                the 24 hours before this page was last updated. The biggest stories come first, by points on Hacker
                News; posts not discussed there follow, newest first.
              </p>
              <p className="lede__meta">
                {count} {count === 1 ? "story" : "stories"} · {fmtDayTime(today.since)} to {fmtDayTime(today.until)} UTC
              </p>
            </div>
          </div>
        </section>

        <section id="today" className="band band--today" aria-labelledby="today-h">
          {bigDay && (
            <article className="top-story">
              <p className="top-story__kicker">{first.pinned ? "Editor’s pick" : "The day’s biggest story"}</p>
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
              more={<Link className="more" href="/#news">The week’s top stories →</Link>}
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
                  {(item.pinned?.note || item.also.length > 0) && (
                    <span className="ledger__also">
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
              in <Link href="/#news">the reading list</Link>.
            </p>
          )}
          <SourceLine names="the labs’ and newsletters’ own feeds; Hacker News" keys={["labNews", "analysis", "today"]} />
        </section>

        <section id="method" className="band method" aria-labelledby="method-h">
          <div className="band__head">
            <h2 id="method-h">How this is measured</h2>
          </div>
          <div className="prose">
            <p>
              <strong>The list</strong> is what was published in the 24 hours before the data was collected, which
              happens once a day: posts from the labs named under “Lab announcements” on the trends page, pieces
              from the newsletters and institutions, and up to twelve Hacker News stories with an AI term in the
              title and at least 20 points. The biggest stories come first, and size is measured by points on Hacker
              News, the one figure the sources share. A lab or newsletter post takes the points of the story that
              links to it or carries its headline; posts with no such story come after the rest, newest first,
              because nothing says how big they are. The times are in UTC, and none of this feeds the trends.
            </p>
            <p>
              <strong>The editor’s step.</strong> Points say what one community upvoted, so the ranked list is
              finished by rules before it is shown. Posts about one event are gathered under the highest-ranked of
              them and stay on the page beneath it: two headlines count as one event when one holds the other, or
              when they share three or more words in a row that include a version number. The editor can also pin a
              post to the top until a set day, and leave a link out of every list on the site; both are kept in a
              file in the project’s repository, with a reason for each link left out.{" "}
              {pinsNow.length === 0 && editorial.hide.length === 0
                ? "Nothing is pinned or left out today."
                : `Today ${pinsNow.length} ${pinsNow.length === 1 ? "post is" : "posts are"} pinned and ${editorial.hide.length} ${editorial.hide.length === 1 ? "link is" : "links are"} left out.`}
            </p>
            {editorial.hide.length > 0 && (
              <ul>
                {editorial.hide.map((h) => (
                  <li key={h.url}>
                    Left out: {host(h.url)}. {h.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="colophon">
        <p>
          Headlines come from publishers’ own feeds and from Hacker News, and each links to its source. Points
          measure the attention of Hacker News readers, not importance. Data last collected{" "}
          {fmtDate(latest.generatedAt)}.
        </p>
        <p>
          Made by {SITE_AUTHOR}. Seen a mistake? <a href={SITE_ISSUES_URL} {...NEW_TAB}>Report it on GitHub</a>. To
          follow along, subscribe to the <a href="/feed.xml">weekly feed</a>: one entry a week, with that week’s headline.
        </p>
      </footer>
    </>
  );
}
