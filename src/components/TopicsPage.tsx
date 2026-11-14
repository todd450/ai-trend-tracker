import type { Metadata } from "next";
import Link from "next/link";
import { HorizonSwitch } from "@/components/HorizonSwitch";
import { MomentumBars } from "@/components/MomentumBars";
import { Colophon, SiteMast } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { TOPICS_FILE, rangeName, topicTable, topicsCitation, topicsHref, type TableCell } from "@/lib/datasets";
import { NEW_TAB } from "@/lib/links";
import { NOISE_MULTIPLE } from "@/lib/noise";
import { pageMetadata, type PagePath } from "@/lib/site";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  buildTrends,
  fmtChange,
  fmtDate,
  fmtDay,
  fmtWeek,
  history,
  latest,
  type Horizon,
} from "@/lib/trends";

/** The search engines' and link previews' description of one view of the page. */
export function topicsMetadata(horizon: Horizon): Metadata {
  return pageMetadata({
    path: topicsHref(horizon) as PagePath,
    title: `Topic momentum ${HORIZONS[horizon].when}: AI research topics rising and cooling`,
    description:
      `Which AI research topics are rising and cooling ${HORIZONS[horizon].when}: each topic’s share of AI papers on arXiv, ` +
      `beside its Hacker News stories, as a graph and a table, with a CSV file of every week’s counts.`,
  });
}

const TONE: Record<TableCell["call"], string> = {
  rising: "rising",
  cooling: "cooling",
  steady: "steady",
  "too noisy to call": "held",
  "too few to call": "held",
  "not yet collected": "held",
};

/** One half of a table row: the two periods, the change and how it is called. */
function Cells({ cell, show }: { cell: TableCell; show: (v: number) => string }) {
  return (
    <>
      <td>
        {show(cell.recent)}
        {cell.few && <small className="dtable__few"> few</small>}
      </td>
      <td>{show(cell.prior)}</td>
      <td className={`dtable__change dtable__change--${TONE[cell.call]}`}>{fmtChange(cell.change)}</td>
      <td className={`dtable__call dtable__call--${TONE[cell.call]}`}>{cell.call}</td>
    </>
  );
}

const share = (v: number) => `${v.toFixed(2)}%`;
const perWeek = (v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));

/**
 * Topic momentum on a page of its own, for one range: the graph and the same figures as a table,
 * the file behind them, how they are counted and how to cite them. Each range is its own prebuilt
 * page, joined by the switch in the masthead; Graph and Table are both on the page and the reader's
 * choice between them is a pair of radio buttons and the stylesheet, with no script.
 */
export function TopicsPage({ horizon }: { horizon: Horizon }) {
  const { window: WINDOW, weeks, topicTrends, rankedTopics, hasHistory } = buildTrends(horizon);
  const table = topicTable(horizon);
  const latestWeek = weeks.at(-1);
  const front = HORIZONS[horizon].href;
  const papersFirm = new Set(rankedTopics.map((t) => t.id));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const recentHead = WINDOW === 1 ? "Latest week" : `Last ${WINDOW} weeks`;
  const priorHead = WINDOW === 1 ? "Week before" : `${WINDOW} weeks before`;

  return (
    <>
      <a className="skip" href="#figures">
        Skip to the figures
      </a>

      <SiteMast current="trends" line={latestWeek ? `Updated ${fmtDate(latest.generatedAt)}` : "First edition in preparation"} />

      <div className="bar">
        <div className="bar__inner">
          <div className="bar__row">
            <HorizonSwitch current={horizon} label="Time span" hrefOf={topicsHref} />
          </div>
        </div>
      </div>

      <main className="page dpage">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href={front}>Trends</Link>
            </li>
            <li>
              <Link href={`${front}#data`}>The data</Link>
            </li>
            <li aria-current="page">Topics</li>
          </ol>
        </nav>

        <header className="dpage__head">
          <p className="dpage__kicker">The data · 1 of 7</p>
          <h1>Topic momentum</h1>
          <p className="dpage__dek">
            Which AI research topics are rising and cooling: each topic’s share of AI papers on arXiv, set beside how
            often Hacker News stories name it.
          </p>
          <p className="dpage__meta">
            Sources: arXiv paper listings; Hacker News story titles
            {latestWeek && <> · Latest week: {fmtWeek(latestWeek)}</>} · Collected {fmtDate(latest.generatedAt)}
          </p>
        </header>

        {hasHistory ? (
          <section id="figures" className="dpage__data" aria-label="The figures">
            <div className="dpage__bar">
              <fieldset className="seg">
                <legend className="vh">Show the figures as</legend>
                <label>
                  <input type="radio" name="view" value="graph" defaultChecked /> Graph
                </label>
                <label>
                  <input type="radio" name="view" value="table" /> Table
                </label>
              </fieldset>
              <a className="dl" href={TOPICS_FILE.href} download>
                <span aria-hidden="true">↓</span> Download this data{" "}
                <span className="dl__size">
                  CSV · {TOPICS_FILE.rows.toLocaleString("en")} rows · about {Math.round(TOPICS_FILE.bytes / 1000)} KB
                </span>
              </a>
            </div>
            <p className="dpage__compared">
              {table.rows.length} topics, largest share of AI papers first. Each change is {table.compared}.
            </p>

            <div className="view view--graph">
              <MomentumBars
                minPapers={HEADLINE_MIN_PAPERS}
                minStories={MAP_MIN_STORIES}
                topics={[...topicTrends]
                  // Largest share of papers first, so the eye meets the big topics before the small ones.
                  .sort((a, b) => Number(b.hasPapers) - Number(a.hasPapers) || b.papers.recent - a.papers.recent)
                  .map((t) => ({
                    id: t.id,
                    name: t.name,
                    blurb: t.blurb,
                    direction: t.direction,
                    papers: t.papers,
                    stories: t.stories,
                    hasPapers: t.hasPapers,
                    papersFirm: papersFirm.has(t.id),
                    storiesFirm: avg(t.stories.values.slice(-2 * WINDOW)) >= MAP_MIN_STORIES,
                  }))}
              />
            </div>

            <div className="view view--table">
              <section className="dtable__scroll" aria-labelledby="dtable-caption" tabIndex={0}>
                <table className="dtable">
                  <caption id="dtable-caption" className="vh">
                    Each topic’s research share and Hacker News stories, {table.compared}
                  </caption>
                  <thead>
                    <tr className="dtable__groups">
                      <td />
                      <th scope="colgroup" colSpan={4}>
                        Research: share of AI papers on arXiv
                      </th>
                      <th scope="colgroup" colSpan={4}>
                        Discussion: Hacker News stories a week
                      </th>
                    </tr>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">{recentHead}</th>
                      <th scope="col">{priorHead}</th>
                      <th scope="col">Change</th>
                      <th scope="col">Call</th>
                      <th scope="col">{recentHead}</th>
                      <th scope="col">{priorHead}</th>
                      <th scope="col">Change</th>
                      <th scope="col">Call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.id} data-topic={row.id}>
                        <th scope="row">{row.name}</th>
                        <Cells cell={row.research} show={share} />
                        <Cells cell={row.discussion} show={perWeek} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <p className="dtable__key">
                <small className="dtable__few">few</small> fewer than {HEADLINE_MIN_PAPERS} papers, or {MAP_MIN_STORIES}{" "}
                stories, a week: small counts swing easily, so read them with care. <i>Too noisy to call</i>: the change
                is no bigger than the topic usually swings from week to week. <i>Too few to call</i>: too few stories
                for a change to mean anything.
              </p>
            </div>

            <SourceLine names="arXiv (papers); Hacker News story titles (discussion)" keys={["arxivHistory", "hnHistory"]} />
            <details className="table-view">
              <summary>Every week in this view, as counts</summary>
              <div className="table-view__scroll">
                <table>
                  <caption>Papers mentioning each topic, per week (and Hacker News stories)</caption>
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      {weeks.map((w) => (
                        <th scope="col" key={w}>
                          {fmtDay(w)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topicTrends.map((t) => (
                      <tr key={t.id}>
                        <th scope="row">{t.name}</th>
                        {weeks.map((w, i) => (
                          <td key={w}>
                            {t.paperCounts[i]} <span>({t.stories.values[i]})</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">All AI papers</th>
                      {weeks.map((w) => (
                        <td key={w}>{history.arxivTotal[w].toLocaleString("en")}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        ) : (
          <p id="figures" className="empty">
            This view needs {2 * WINDOW} weeks of history and {weeks.length} have been collected. Run{" "}
            <code>npm run collect</code> to backfill the rest.
          </p>
        )}

        <div className="dpage__notes">
          <section id="counted" className="band" aria-labelledby="counted-h">
            <div className="band__head">
              <h2 id="counted-h">How this is counted</h2>
            </div>
            <div className="prose">
              <p>
                <strong>Research</strong> counts the papers submitted to arXiv’s AI categories each week whose title
                or abstract mentions the topic, as a share of all AI papers that week. Share, not raw counts, keeps
                conference deadlines, which lift every topic at once, from looking like a trend.
              </p>
              <p>
                <strong>Discussion</strong> counts Hacker News stories with the topic in the title. These numbers are
                small and jumpy, so read them as a second opinion, not a verdict.
              </p>
              <p>
                <strong>Rising or cooling</strong> means the share moved by at least 10%, rounded to a whole percent as
                shown, between the two periods, and the move is at least {NOISE_MULTIPLE} times what the topic’s usual
                week-to-week swing would produce. A move that fails this keeps its figure but is marked too noisy to
                call. With {table.rows.length} topics, an occasional call will still be chance.
              </p>
              <p>
                In this view, each change is {table.compared}. The switch at the top moves between six views, from the latest
                week against the week before to the last 52 weeks against the 52 before; a topic can rise in one and
                cool in another, and the shorter views are the noisiest.
              </p>
              <p>
                <strong>Limits.</strong> Topics are keyword lists, so a paper can count toward several topics and work
                in unfamiliar wording is missed. Topics under {HEADLINE_MIN_PAPERS} papers or {MAP_MIN_STORIES}{" "}
                stories a week are marked “few”, and the headline never names them.
              </p>
            </div>
          </section>

          <section id="cite" className="band" aria-labelledby="cite-h">
            <div className="band__head">
              <h2 id="cite-h">Cite this</h2>
            </div>
            <p className="cite">{topicsCitation(horizon)}</p>
            <p className="dpage__small">
              The tracker’s counts are free to reuse with this credit, under{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" {...NEW_TAB}>CC BY 4.0</a>. They are made from
              arXiv’s listings, whose descriptive metadata arXiv offers under{" "}
              <a href="https://creativecommons.org/publicdomain/zero/1.0/" {...NEW_TAB}>CC0</a>, and from Hacker News
              story titles. The file holds counts only: no paper or story titles.
            </p>

            <h3 className="dpage__sub">What is in the file</h3>
            <p className="dpage__small">
              Every week since {fmtDate(TOPICS_FILE.since)}, {TOPICS_FILE.weeks} weeks in all, whichever view you are
              reading: this {rangeName(horizon)} view shows the last {weeks.length}. One row per topic and week:
            </p>
            <dl className="cols">
              <dt>week</dt>
              <dd>the Monday the week starts</dd>
              <dt>topic_id, topic</dt>
              <dd>e.g. voice, Voice &amp; speech</dd>
              <dt>source</dt>
              <dd>arxiv</dd>
              <dt>count</dt>
              <dd>AI papers mentioning the topic that week</dd>
              <dt>total</dt>
              <dd>all AI papers that week</dd>
              <dt>share</dt>
              <dd>count ÷ total</dd>
            </dl>
            <p className="dpage__small">
              The Hacker News counts are on this page but not yet in the file: Hacker News’s terms do not say that
              counts drawn from it may be handed out as a file.
            </p>
            <figure className="preview">
              <figcaption>The file’s first rows</figcaption>
              <pre tabIndex={0} aria-label="The file's first rows">{TOPICS_FILE.preview.join("\n")}</pre>
            </figure>
          </section>
        </div>

        <nav className="dpage__next" aria-label="Datasets">
          <p>
            <span>Back to</span>
            <Link href={front}>← Trends</Link>
          </p>
          <p>
            <span>Next dataset</span>
            <Link href={`${front}#themes`}>Economy and society themes →</Link>
          </p>
        </nav>
      </main>

      <Colophon />
    </>
  );
}
