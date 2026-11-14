import Link from "next/link";
import { Ledger } from "@/components/Ledger";
import { OldTrendLinks } from "@/components/OldTrendLinks";
import { SiteMast } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { FRONTIER_LABS, topStoryReason } from "@/lib/editorial";
import { NEW_TAB, host } from "@/lib/links";
import { SITE_MAKER_URL } from "@/lib/site";
import { trendTags } from "@/lib/tags";
import { buildToday, editorial, pastLeads } from "@/lib/today";
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
  const pinsNow = today.items.filter((item) => item.pinned);
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
  const leads = pastLeads(latest.generatedAt.slice(0, 10));

  return (
    <>
      <a className="skip" href="#today">
        Skip to the news
      </a>

      <OldTrendLinks to={HORIZONS.threeMonths.href} />

      <SiteMast ruled current="today" line={`Updated ${fmtDate(latest.generatedAt)}`} />

      <main className="page">
        <div className="chapter chapter--page">
          <header className="chapter__head">
            <h1 className="chapter__title" id="today-h">Today’s AI news</h1>
            <p className="chapter__dek">
              What the labs, the analysts and Hacker News published in the 24 hours to {fmtDayTime(today.until)} UTC,
              biggest stories first.
            </p>
          </header>

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
                    <strong>Why it matters:</strong> {why}
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

        <section id="method" className="band method" aria-labelledby="method-h">
          <div className="band__head">
            <h2 id="method-h">How this is measured</h2>
          </div>
          <div className="prose">
            <p>
              <strong>The list</strong> is what was published in the 24 hours before the data was collected, which
              happens once a day: posts from the labs named under “Lab announcements” in the reading list, pieces
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
              when they share three or more words in a row that include a version number. Posts about an outage
              count as one event too, when they come from the same status page, or when both headlines name the
              same tracked product beside an outage word (down, outage, errors, degraded). The editor can also pin a
              post to the top until a set day, and leave a link out of every list on the site; both are kept in a
              file in the project’s repository, with a reason for each link left out.{" "}
              {pinsNow.length === 0 && editorial.hide.length === 0
                ? "Nothing is pinned or left out today."
                : `Today ${pinsNow.length} ${pinsNow.length === 1 ? "post is" : "posts are"} pinned and ${editorial.hide.length} ${editorial.hide.length === 1 ? "link is" : "links are"} left out.`}
            </p>
            <p>
              <strong>The top story.</strong> One story is set large above the list when a rule lifts it, and the
              line above its headline names the rule. A pinned post always takes the place. Otherwise it goes to the
              highest-ranked story that one of two rules lifts. A launch: a post from a frontier lab’s own news page
              ({[...FRONTIER_LABS].join(", ")}) gathered with at least two Hacker News stories about it, whatever
              their points. A story counts when it discusses the lab’s post itself or links to the lab’s own site;
              one that only shares the headline’s words does not. The lab’s post is then the headline. Or a story as big as the past days’ leads: its points match the middle of the most upvoted
              story on each of up to seven earlier days, as counted when that day’s list was collected, so that
              each had under a day to gather points, as today’s has. With fewer than three past days to compare
              with, points lift nothing. On an ordinary day no story is set large.{" "}
              {leads.length === 0
                ? "No past days are on record to compare with today."
                : `Today’s lead is compared with ${leads.length} past ${leads.length === 1 ? "day" : "days"}.`}
            </p>
            <p>
              <strong>The tags.</strong> A headline is tagged with the tracked products and topics whose Hacker
              News counts it is in, at most two, in the order the headline names them. The match is the one the
              counts use: the trend’s own title phrases, as whole words, with its exceptions, so a headline naming
              Claude Code is not tagged Claude. A headline that matches none has no tag. A tag links to the trend’s
              row: a topic on the topics page, a product under “Product momentum” on the trends page, both over the
              default three months.
            </p>
            <p>
              <strong>Why it matters.</strong> Under the top story, one line reads the trend of its first tag, as
              that trend’s row reads it over three months: its Hacker News stories a week in the last four weeks
              against the four weeks before, and the call the row makes, rising, steady or cooling. A trend with
              too few stories in either period is too few to call, and a change no bigger than its usual week-to-week
              swing is too noisy to call. A top story with no tag has no line. The line is written by this rule,
              never by hand; the editor’s note on a pinned story is shown beside it.
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
          <a href={SITE_MAKER_URL} {...NEW_TAB}>HalfBadger.com</a>
        </p>
      </footer>
    </>
  );
}
