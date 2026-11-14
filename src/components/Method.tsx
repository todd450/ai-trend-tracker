import Link from "next/link";
import { Colophon, SiteMast } from "@/components/SiteFrame";
import { CHECK_AFTER, FEW_CALLS, RECORD_WEEKS, weeksNeeded } from "@/lib/record";
import { COUNTED_MAX, COUNTED_WEEKS } from "@/lib/counted";
import { FRONTIER_LABS } from "@/lib/editorial";
import { host } from "@/lib/links";
import { NOISE_MULTIPLE } from "@/lib/noise";
import { buildToday, editorial, pastLeads } from "@/lib/today";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  PRODUCT_MIN_STORIES,
  SUBTHEME_MIN_STORIES,
  THEME_STEADY_BAND,
  everyWeek,
  fmtDate,
  fmtDay,
  latest,
} from "@/lib/trends";
import { READING_LABEL, STAGE_LOUD, STAGE_QUIET } from "@/lib/conferences";
import { ADOPTION_WINDOW, USAGE_WINDOW, adoption as adoptionSummary } from "@/lib/indicators";

/** What each source is, in words, for the list of when each was last collected. */
const SOURCE_LABELS: Record<string, string> = {
  arxivHistory: "arXiv weekly paper counts",
  hnHistory: "Hacker News weekly story counts",
  hnThemes: "Hacker News weekly theme counts",
  papers: "Hugging Face daily papers",
  models: "Hugging Face trending models",
  releases: "Hugging Face lab uploads",
  stories: "Hacker News top stories",
  today: "Hacker News past-day stories",
  launches: "Hacker News product launches",
  hnProducts: "Hacker News product mentions",
  wikiProducts: "Wikipedia page views",
  repos: "GitHub repository search",
  analysis: "Newsletter and institution feeds",
  labNews: "Lab news pages",
  jobs: "Indeed Hiring Lab job postings",
  federal: "Federal Register document counts",
  modelReleases: "Lab model release log",
  downloads: "npm and PyPI download counts",
  business: "Census Bureau business survey",
  marketShare: "OpenRouter model rankings",
};

/**
 * How this is measured: how the day’s news is ranked, the rules that turn the counts on the trend
 * pages into calls, how the reading list is made, how a conference is read against the numbers, and,
 * last, whether each source is current. It used to close the Today, trend and reading-list pages, and
 * to sit beside each conference's moments and stage table; it has a page of its own, linked from every footer.
 */
export function Method() {
  const sources = Object.entries(latest.sources);
  const stale = sources.filter(([, src]) => !src.ok).length;
  const oldest = sources.map(([, src]) => src.at).filter(Boolean).sort()[0];
  const pinsNow = buildToday().items.filter((item) => item.pinned);
  const leads = pastLeads(latest.generatedAt.slice(0, 10));
  const adoption = adoptionSummary;

  return (
    <>
      <a className="skip" href="#method">
        Skip to how this is measured
      </a>

      <SiteMast ruled line={`Updated ${fmtDate(latest.generatedAt)}`} />

      <main className="page">
        <section id="method" className="chapter chapter--front" aria-labelledby="method-h">
          <div className="dateline">
            <h1 id="method-h">How this is measured</h1>
            <p>Where each figure comes from, and the fixed rules that rank the news and call the trends.</p>
          </div>

          <section id="today-news" className="band method" aria-labelledby="today-news-h">
            <div className="band__head">
              <h2 id="today-news-h">Today’s news</h2>
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
                <strong>The trend.</strong> Under the top story, one line reads the trend of its first tag, as
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

          <section id="trends" className="band method" aria-labelledby="trends-h">
            <div className="band__head">
              <h2 id="trends-h">The trends</h2>
            </div>
            <div className="prose">
              <p id="track-record">
                <strong>Track record.</strong> For each view with enough weeks stored, the page replays the past
                year week by week: it reads the stored counts as each week would have read them, with today’s
                rules, and notes what it would have called on research topics and on themes. A call is counted
                once, in the week it first appears, so a topic called rising eight weeks running is one call; one
                that goes steady or turns round and is called again is a new one. A call held if, {CHECK_AFTER}{" "}
                weeks later, the share (the average over the view’s latest window) had moved further the way it was
                called; the record covers the {RECORD_WEEKS} weeks of calls up to the last one that can be checked.
                This is a replay with today’s rules and today’s counts, which can have been revised since, and
                each week’s wobble is measured on the weeks up to it; it is not a record of what the page said at
                the time. A line resting on fewer than {FEW_CALLS} calls is marked “few calls”. A year of checked
                calls needs {weeksNeeded(HORIZONS.threeMonths.window)} weeks of counts on the 3-month view, but{" "}
                {weeksNeeded(HORIZONS.oneYear.window)} on the 1-year view and {weeksNeeded(HORIZONS.twoYears.window)}{" "}
                on the 2-year view, since each of their calls takes longer to make; {everyWeek.length} weeks are
                stored. Under the record on the trends page, <a href="/three-months#calls-checked">the calls checked by name</a> are the calls that
                came due in the latest week, each first made {CHECK_AFTER} weeks before, with its share when called,
                its share now and whether it held, to two decimals since a call can hold by a few hundredths (more
                where two would print the same figure for both); when
                none came due that week, the list shows the most recent week that had any.
              </p>
              <p>
                <strong>Topic momentum</strong>, a topic’s share of AI papers on arXiv and its stories on Hacker
                News, is explained beside its figures on <Link href="/data/topics#counted">its own page</Link>,
                with a file of every week’s counts.
              </p>
              <p>
                A topic is called rising or cooling when its paper share moved by at least 10%, rounded to a whole percent as shown, between the two
                windows being compared, and when that move stands clear of the topic’s own wobble. The wobble is
                measured from how much the topic’s weekly figure usually changes from one week to the next, over
                every week on record; a move counts only if it is at least {NOISE_MULTIPLE} times what that wobble
                alone would be expected to produce between the two windows. A move that fails this test keeps its
                figure but its bar is drawn grey, under “steady”, and it is never named in the headline. The same test applies
                to discussion, themes and sub-themes. It is a guard against calling noise a trend, not a proof:
                with this many topics, an occasional call will still be chance. The time-span switch at the top of the trends pages sets those windows, and the colours carry no judgement: blue marks a rise and amber a fall. <strong>1 week</strong> compares
                the latest week with the week before, and <strong>1 month</strong> the last{" "}
                {HORIZONS.oneMonth.window} weeks with the {HORIZONS.oneMonth.window} before. These two react
                fastest and are the noisiest: one conference deadline or one news story can move them, so treat a
                call there as a prompt to look, not a trend. <strong>3 months</strong> compares the last{" "}
                {HORIZONS.threeMonths.window} weeks with the {HORIZONS.threeMonths.window} before.{" "}
                <strong>6 months</strong> compares the last {HORIZONS.sixMonths.window} weeks with the{" "}
                {HORIZONS.sixMonths.window} before, one quarter against the previous one.{" "}
                <strong>1 year</strong> compares the last {HORIZONS.oneYear.window} weeks with the{" "}
                {HORIZONS.oneYear.window} before, one half-year against the other.{" "}
                <strong>2 years</strong> compares the last {HORIZONS.twoYears.window} weeks with the{" "}
                {HORIZONS.twoYears.window} before, this year against last year. The longer views react slowly,
                and a topic can be rising in one view and cooling in another. Topics are defined by keyword lists, so a paper can count toward several topics,
                and work that uses unfamiliar wording is missed. Small topics swing more easily, so the headline only
                names topics averaging at least {HEADLINE_MIN_PAPERS} papers a week.
              </p>
              <p>
                <strong>The numbers under the headline</strong> are written by fixed rules from the same numbers, not by an editor or a model. Their research and discussion lines follow the view chosen; their economy, releases and policy lines are the same in every view.
                The moves named in <a href="#data">the data</a> are picked by rule too: each is the largest change in
                its dataset that clears these tests, among series big enough to trust.
              </p>
              <p id="counted">
                <strong>What was counted</strong>, under a chart that rose, is chosen by rule too, each day, for
                the rises the headline names and over the window it compares. For a theme it is the Hacker News
                story with the most points from each of the window’s latest {COUNTED_WEEKS} weeks, newest first,
                among those whose title matches one of the theme’s searches. It is taken week by week because
                points build up over days, so the most points overall would mostly be the window’s oldest
                stories. A window under {COUNTED_MAX} weeks gives the {COUNTED_MAX} stories with the most points
                instead. A story submitted more than once, by link or by headline, counts once. For a
                research topic it is {COUNTED_MAX} of the papers whose title or abstract holds one of the topic’s
                phrases, those upvoted on Hugging Face first, then the newest. The papers are examples of what was
                counted, not the reason for the move: there are hundreds of them, and arXiv gives no figure to rank
                them by. A keyword can match a story that is about something else, and the list shows it as it
                was counted. A fall has no list, since it means fewer stories or papers, so none stand for it.
              </p>
              <p>
                <strong>Economy and society themes</strong> count Hacker News stories whose title contains AI and a
                theme word, such as “layoffs” or “data center”, as a share of all stories with AI in the title. Each
                story counts once per theme. The counts are small, often 10 to 30 stories a week, so a theme is
called rising or cooling only when its share moved by at least {THEME_STEADY_BAND * 100}% and
                stands clear of its own wobble, as above. Hacker
                News readers are mostly technologists, so this shows what that community is discussing, not public
                opinion.
              </p>
              <p>
                <strong>Sub-themes</strong> split each theme into four narrower groups of the same title searches;
                point at a sub-theme’s name, or read under it on a phone, to see its searches. A story counts once per
                sub-theme but can sit in more than one, so the sub-themes add up to more than their theme. Their
                counts are smaller still: a sub-theme averaging fewer than {SUBTHEME_MIN_STORIES} stories a week
                in either half of the comparison is marked “too few to call” instead of rising or cooling.
              </p>
              <p>
                <strong>Product momentum</strong> follows a fixed list of products chosen by the editor, so a
                product not on the list cannot appear however fast it grows. Discussion counts Hacker News
                stories with the product’s name in the title. Claude is counted without its Claude Code stories,
                which have their own row. A few names are also ordinary words: in a sample of 40 recent titles
                each, about one in ten for Cursor (mouse cursors), one in twelve for Gemini (a network protocol
                of the same name) and one in seven for Copilot (“copilot” used for any assistant) were not about
                the product; none were for Codex, Devin, Grok, Antigravity or Perplexity. The phrases are left
                broad because narrowing them would miss far more real stories than it removes. A product averaging fewer than{" "}
                {PRODUCT_MIN_STORIES} stories a week in either half of the comparison is marked “too few to
                call”, and discussion is called rising or cooling only on a move of at least{" "}
                {THEME_STEADY_BAND * 100}%. Image, video and music products are rarely discussed there, so read
                them by the second measure. Public interest is the daily views of the product’s English
                Wikipedia article by people, not crawlers, averaged over each week. It shows how many people
                looked the product up, which rises with news of any kind, good or bad, and is not a count of
                users. It covers English readers only. A product whose article is part of a larger one has no
                figure. Neither measure is use or revenue. Devices, robots and driverless cars are discussed too little on Hacker News to call, so
                they are read by public interest alone; where a robot has no article of its own, its maker’s
                article stands in, and its views include interest in the company.
              </p>
              <p>
                <strong>The editor’s step.</strong> The links the editor leaves out of every list on the site are
                left out of the trends’ lists too, and are named under <a href="#today-news">today’s news</a>{" "}
                above. The past day’s stories themselves are on <Link href="/">Today’s news</Link>.
              </p>
              <p>
                <strong>The indicators</strong> each rest on one source and one rule. Job postings are Indeed’s own
                count of US postings asking for AI skills. Federal documents are those whose text includes the phrase
                “artificial intelligence”. A model release is the first post announcing a new version number in a
                lab’s main line (GPT, Gemini or Claude); variants of a version already announced, such as a smaller
                or faster edition, are not counted again, and labs other than these three are not covered.
              </p>
              {adoption && (
              <p>
                <strong>Business adoption</strong> is the Census Bureau’s Business Trends and Outlook Survey, which
                asks a sample of US businesses the same questions every two weeks. The figure is the share answering
                yes, as the Bureau publishes it for the country as a whole; it counts a business the same whether
                one person or everyone there uses AI, and whether it has five staff or fifty thousand. The trend
                compares the average of the last {ADOPTION_WINDOW} surveys with the {ADOPTION_WINDOW} before, so
                that one survey’s sampling noise is not read as a move. The series here begins with the survey of
                two weeks to {fmtDate(adoption.since)}, the first with the question’s current wording, which asks
                about use “in any of its business functions”; answers to the narrower earlier wording were lower
                and are not joined on.
              </p>
              )}
              <p>
                <strong>Model share</strong> is the weekly count of tokens (the units of text a model reads and
                writes) that passed through OpenRouter, grouped by the company that made the model. OpenRouter is a
                marketplace developers use to reach many models through one account, so it shows the choices of
                developers who shop around; companies that buy from OpenAI, Anthropic or Google directly, and
                everyone using a chat app, are not in it. Free and low-priced models draw heavy automated use there,
                which lifts their makers. Each maker counts tokens its own way, so shares are approximate. OpenRouter
                publishes each day’s 50 most-used models, so a maker’s total leaves out any of its models below
                that line. A week names only its nine largest makers, so a maker’s line starts from when it last
                entered the nine, and its change is shown only if it stayed there for the whole comparison.
              </p>
              <p>
                <strong>Developer usage</strong> counts downloads of each toolkit’s Python packages from PyPI and
                JavaScript packages from npm, per complete month. A download is not a user: build servers fetch
                packages again on every run, and one toolkit can pull in another, so a download of LangChain often
                brings OpenAI’s toolkit with it. Share is worked out separately for Python and for JavaScript, as each
                toolkit’s part of the downloads tracked here in that language, and the two are averaged; a toolkit
                published in only one language counts as 0% in the other. Measuring each language on its own keeps a
                change in how one registry counts from moving every share. A toolkit is rising or cooling when its
                average share over the last {USAGE_WINDOW} months moved by 10% or more against the {USAGE_WINDOW}{" "}
                before. Apps that call a model without one of these toolkits, and everyone using a chat app, are not
                counted.
              </p>
            </div>
          </section>

          <section id="reading-list" className="band method" aria-labelledby="reading-list-h">
            <div className="band__head">
              <h2 id="reading-list-h">The reading list</h2>
            </div>
            <div className="prose">
              <p>
                Closed models released only through an API do not appear in the model lists, which cover open models
                on Hugging Face. They show up in the news and in the lab announcements instead.
              </p>
              <p>
                <strong>From the analysts</strong> lists the newest pieces from a fixed set of eight newsletters and
                research institutions, at most two from each, from the past 30 days. It is a reading list chosen
                by the editor, not a ranking. Publishers that cover other subjects are filtered to pieces that
                mention AI.
              </p>
              <p>
                <strong>Lab announcements</strong> come from the feeds of OpenAI, Google DeepMind, Microsoft,
                Mistral AI and ElevenLabs. The other seven labs publish no feed, or have terms that do not allow a
                script to read it, so their posts are the ones submitted to Hacker News, under the headline given
                there; a post nobody submitted is missing, which leaves the smaller labs thinly covered. A lab
                takes at most three places in the list, and a smaller lab two.
              </p>
              <p>
                <strong>Product launches</strong> are the past seven days’ “Show HN” and “Launch HN” posts on
                Hacker News, where makers present their own work, with an AI term in the title and at least 10
                points. Launch HN posts come from Y Combinator companies. The list shows what technologists
                launched and noticed: it leans to developer tools and open-source projects, and a consumer
                product nobody posted there is missing. A launch that describes an AI product without an AI term
                in its title is missed too. Points measure the attention of Hacker News readers, not use or sales.
              </p>
              <p>
                <strong>This week</strong> is chosen from the lists below by fixed rules, rebuilt with the page each
                day: the items from the seven days before the data was collected whose headline names a product or
                topic the site tracks, as Today’s tags read them, grouped under the first one named. Posts about one
                event are gathered as on Today’s page. A frontier lab’s launch discussed twice on Hacker News, and a
                post the editor pinned, always make it and come first; the other trends follow by their biggest story on Hacker News,
                whichever way the trend is moving. A trend
                shows at most two items, biggest on Hacker News first, and the block at most seven. The line under
                each trend says how its Hacker News stories have moved, read from the tracker’s own figures; it is
                about the trend, not about the stories under it. A big story that names no tracked trend is left
                out, and the block says so.
              </p>
              <p>
                <strong>The reading lists</strong> show their first few items; the rest open on request. Where a
                list is set in columns, the bar beside the figure it is ranked by shows it against the largest in
                that list.
              </p>
              <p>
                The editor can leave a link out of every list; each link left out is named, with the reason, under{" "}
                <a href="#today-news">today’s news</a> above. None of these lists feeds the trends.
              </p>
            </div>
          </section>

          <section id="conferences" className="band method" aria-labelledby="conferences-h">
            <div className="band__head">
              <h2 id="conferences-h">Conferences</h2>
            </div>
            <div className="prose">
              <p>
                <strong>The moments worth hearing</strong> are chosen and ranked by the editor, the one most worth
                your time first, and paraphrased from the recordings’ automatic captions or from the organiser’s
                transcripts and summaries; each event’s note on what was and was not watched says which for each
                day. Captions can mishear names and numbers, so each moment links to its time in the recording to be
                checked there.
              </p>
              <p>
                <strong>The stage against the numbers.</strong> A topic’s share of the stage is its part of all the
                mentions of tracked topics, found with the trends’ own search phrases plus the ways speakers say them
                aloud, in the talks’ captions
                or, where the recordings have no captions yet, in the titles and abstracts of the published
                programme. Beside it are the topic’s research and discussion figures over the default three-month
                view, the last {HORIZONS.threeMonths.window} weeks against the {HORIZONS.threeMonths.window} before,
                as on the trends page. A figure resting on too few papers (under {HEADLINE_MIN_PAPERS} a week) or
                stories (under {MAP_MIN_STORIES} a week) is shown grey, marked “small numbers”, and never decides
                the reading.
              </p>
              <p>
                <strong>The reading</strong> beside each topic follows fixed rules. A topic is loud at{" "}
                {STAGE_LOUD * 100}% of the mentions or more, and quiet under {STAGE_QUIET * 100}%. A loud topic
                reads “{READING_LABEL.agree}” when a trusted figure rises and none cools, “
                {READING_LABEL["stage-ahead"]}” when a figure cools and none rises, “mixed” when one rises and
                the other cools, “flat” when neither moves, and “too few to call” when neither figure is trusted.
                A quiet topic reads “{READING_LABEL["numbers-ahead"]}” when a trusted figure rises and none
                cools, and “{READING_LABEL.quiet}” the other way round. Any other topic has no reading. An event’s page leads with a
                surprise when there is one: the editor’s own note, or failing that, from the numbers, the loudest
                topic that reads “{READING_LABEL["stage-ahead"]}” or “{READING_LABEL["numbers-ahead"]}”.
              </p>
              <p>
                <strong>How to read this.</strong> A conference’s subject decides most of what is said on its stage,
                so a topic being loud there shows what the event was about, not that the field has moved. The
                comparison says most about topics the event was not built around.
              </p>
            </div>
          </section>

          <section id="sources" className="band method" aria-labelledby="sources-h">
            <div className="band__head">
              <h2 id="sources-h">The sources</h2>
            </div>
            <p className="method__status">
              <span className={stale ? "status status--fail" : "status status--ok"}>
                <span aria-hidden="true">{stale ? "▲" : "●"}</span>{" "}
                {stale ? `${stale} of ${sources.length} sources stale` : `All ${sources.length} sources current`}
              </span>
              {oldest && <span className="sources__when">oldest collected {fmtDay(oldest)}</span>}
            </p>
            <details className="table-view" open={stale > 0}>
              <summary>Show each source</summary>
              <div className="sources">
                <ul>
                  {sources.map(([key, src]) => (
                    <li key={key}>
                      <span className={src.ok ? "status status--ok" : "status status--fail"}>
                        <span aria-hidden="true">{src.ok ? "●" : "▲"}</span> {src.ok ? "Current" : "Stale"}
                      </span>
                      <span>{SOURCE_LABELS[key] ?? key}</span>
                      <span className="sources__when">{src.at ? fmtDay(src.at) : "never"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </section>
        </section>
      </main>

      <Colophon />
    </>
  );
}
