import { HorizonSwitch } from "@/components/HorizonSwitch";
import { Ledger } from "@/components/Ledger";
import { Logo } from "@/components/Logo";
import { MoreRows } from "@/components/MoreRows";
import { MomentumMap } from "@/components/MomentumMap";
import { Sparkline } from "@/components/Sparkline";
import { ThemeRow } from "@/components/ThemeRow";
import { buildBriefing } from "@/lib/briefing";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  SUBTHEME_MIN_STORIES,
  THEME_STEADY_BAND,
  buildTrends,
  directionOf,
  fmtChange,
  fmtCompact,
  fmtDate,
  fmtDay,
  fmtWeek,
  history,
  isoWeek,
  latest,
  type Direction,
  type Horizon,
  type Signal,
} from "@/lib/trends";

import { ADOPTION_WINDOW, USAGE_WINDOW, adoption as adoptionSummary, buildMarketShare, federal, fmtMonth, indicators, jobs, releases, usage as usageSummary } from "@/lib/indicators";

const SHOWN = 10;

const ARROW: Record<Direction, string> = { rising: "▲", steady: "■", cooling: "▼" };

const SOURCE_LABELS: Record<string, string> = {
  arxivHistory: "arXiv weekly paper counts",
  hnHistory: "Hacker News weekly story counts",
  hnThemes: "Hacker News weekly theme counts",
  papers: "Hugging Face daily papers",
  models: "Hugging Face trending models",
  releases: "Hugging Face lab uploads",
  stories: "Hacker News top stories",
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

const toneOf = (signal: Signal, band = 0.1) => directionOf(signal.change, band);

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function Change({ signal, band }: { signal: Signal; band?: number }) {
  const tone = toneOf(signal, band);
  return (
    <span className="change">
      <span className={`change__mark change__mark--${tone}`} aria-hidden="true">
        {ARROW[tone]}
      </span>
      {fmtChange(signal.change)}
    </span>
  );
}

/** A weekly story count, shown short and read out in full. */
function PerWeek({ value }: { value: number }) {
  const n = Math.round(value);
  return (
    <span className="trend__level">
      {n}
      <span aria-hidden="true">/wk</span>
      <span className="vh"> {n === 1 ? "story" : "stories"} a week</span>
    </span>
  );
}

/**
 * The two figure cells of a theme or sub-theme row: share of AI stories, then stories a week.
 * With too few stories to judge, the change gives way to a note and the level stays.
 */
function ThemeCells({
  name,
  share,
  stories,
  labels,
  enough = true,
}: {
  name: string;
  share: Signal;
  stories: Signal;
  labels: string[];
  enough?: boolean;
}) {
  const few = <span className="trend__few">too few to call</span>;
  return (
    <>
      <div className="trend__signal">
        <span className="trend__label">Share</span>
        <Sparkline
          values={share.values}
          labels={labels}
          unit="storyShare"
          tone={enough ? directionOf(share.change, THEME_STEADY_BAND) : "steady"}
          summary={`${name}: share of AI stories on Hacker News over ${labels.length} weeks, now ${share.recent.toFixed(1)}%${enough ? `, ${fmtChange(share.change)}` : ""}`}
        />
        {enough ? (
          <Change signal={share} band={THEME_STEADY_BAND} />
        ) : (
          few
        )}
        <span className="trend__level">
          {share.recent.toFixed(1)}%<span className="vh"> of AI stories</span>
        </span>
      </div>
      <div className="trend__signal">
        <span className="trend__label">Stories</span>
        <Sparkline
          values={stories.values}
          labels={labels}
          unit="stories"
          tone={enough ? directionOf(stories.change, THEME_STEADY_BAND) : "steady"}
          summary={`${name}: Hacker News stories per week over ${labels.length} weeks, now ${Math.round(stories.recent)}${enough ? `, ${fmtChange(stories.change)}` : ""}`}
        />
        {enough ? (
          <Change signal={stories} band={THEME_STEADY_BAND} />
        ) : (
          few
        )}
        <PerWeek value={stories.recent} />
      </div>
    </>
  );
}

/** The figure a list is ranked by, with a bar showing it against the largest in the list. */
function Mag({ value, max, unit }: { value: number; max: number; unit: string }) {
  return (
    <span className="ledger__mag">
      <span className="ledger__bar" aria-hidden="true">
        <span style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="ledger__num">
        {fmtCompact(value)}
        <span className="ledger__unit"> {unit}</span>
      </span>
    </span>
  );
}

const top = (xs: number[]) => Math.max(1, ...xs);
const task = (t: string | null) => (t ? t.replaceAll("-", " ") : "");

/** The whole dashboard, read over one time horizon. The routes differ only in this prop. */
export function Dashboard({ horizon }: { horizon: Horizon }) {
  const trends = buildTrends(horizon);
  const { window: WINDOW, weeks, topicTrends, mapTopics, themeTrends, hasHistory, hasThemes } = trends;
  const { headline, briefing } = buildBriefing(trends);
  const compared =
    WINDOW === 1
      ? "latest week compared with the week before"
      : `last ${WINDOW} weeks compared with the ${WINDOW} weeks before`;
  const latestWeek = weeks.at(-1);
  const weekLabels = weeks.map((w) => `Week of ${fmtDay(w)}`);
  /** Topics whose counts are large enough for their place on the map to be trusted. */
  const firm = new Set(mapTopics.map((t) => t.id));
  /** Every topic with both changes to place, numbered as in the table. */
  const mapPoints = topicTrends
    .map((t, i) => ({ t, rank: i + 1 }))
    .filter(({ t }) => t.hasPapers && t.papers.change !== null && t.stories.change !== null);
  const papersLastWeek = latestWeek ? history.arxivTotal[latestWeek] : 0;
  const adoption = adoptionSummary; // local constants, so the null checks below hold inside the row callbacks
  const adoptionRows = adoption
    ? [
        {
          id: "using",
          name: "US businesses using AI",
          blurb: "Businesses saying yes when asked whether they used AI in any business function in the last two weeks.",
          signal: adoption.using,
          latest: adoption.latest.using,
        },
        ...(adoption.planning && adoption.latest.planning !== null
          ? [
              {
                id: "planning",
                name: "US businesses expecting to use AI",
                blurb: "Businesses saying yes when asked whether they think they will be using AI during the next six months.",
                signal: adoption.planning,
                latest: adoption.latest.planning,
              },
            ]
          : []),
      ]
    : [];
  const usage = usageSummary;
  const marketShare = buildMarketShare(horizon);

  const stories = latest.stories.slice(0, SHOWN);
  const papers = latest.papers.slice(0, SHOWN);
  const repos = latest.repos.slice(0, SHOWN);
  const models = latest.models.slice(0, SHOWN);
  const labModels = latest.releases.slice(0, SHOWN);
  const analysis = (latest.analysis ?? []).slice(0, SHOWN);
  const labNews = (latest.labNews ?? []).slice(0, SHOWN);
  const sources = Object.entries(latest.sources);
  const stale = sources.filter(([, src]) => !src.ok).length;
  const oldest = sources.map(([, src]) => src.at).filter(Boolean).sort()[0];

  return (
    <>
      <a className="skip" href="#momentum">
        Skip to the trends
      </a>

      <header className="mast">
        <p className="mast__line">
          {latestWeek ? `No. ${isoWeek(latestWeek)} · Week of ${fmtWeek(latestWeek)}` : "First edition in preparation"}
        </p>
        <h1 className="mast__name">
          <Logo className="mast__mark" />
          AI Trend Tracker
        </h1>
      </header>

      <div className="bar">
        <div className="bar__inner">
          <div className="bar__row">
            <nav className="bar__nav" aria-label="Sections">
              <ul>
                <li><a href="#momentum">Topics</a></li>
                <li><a href="#themes">Themes</a></li>
                <li><a href="#indicators">Indicators</a></li>
                <li><a href={adoption ? "#adoption" : "#usage"}>Usage</a></li>
                <li><a href="#news">News</a></li>
                <li><a href="#papers">Papers</a></li>
                <li><a href="#analysis">Analysis</a></li>
                <li><a href="#code">Code</a></li>
                <li><a href="#models">Models</a></li>
                <li><a href="#method">Method</a></li>
              </ul>
            </nav>
            <HorizonSwitch current={horizon} label="Time span" />
          </div>
        </div>
      </div>

      <main className="page">
        <section className="lede">
          <div className="lede__main">
            <h2 className="lede__head">
              {headline.lead}
              {headline.turn && (
                <>
                  {" "}
                  <span className="lede__turn">{headline.turn}</span>
                </>
              )}
            </h2>
            <div className="lede__dek">
              <p>
                A weekly reading of where attention in artificial intelligence is moving, measured from public
                sources: research papers, open-source code, model releases, news discussion and economic indicators.
              </p>
              <p className="lede__meta">
                Updated {fmtDate(latest.generatedAt)}
                {papersLastWeek > 0 && <> · {papersLastWeek.toLocaleString("en")} AI papers reached arXiv last week</>}
                {" · "}Showing {HORIZONS[horizon].label}: charts cover {weeks.length} weeks, and each change is the {compared}.
              </p>
            </div>
          </div>
          {briefing.length > 0 && (
            <div className="brief">
              <h3 className="brief__title">The week in {briefing.length === 5 ? "five" : briefing.length} numbers</h3>
              <ol>
                {briefing.map((line) => (
                  <li key={line.label}>
                    <a className="brief__label" href={line.href}>{line.label}</a>
                    <span className="brief__figure">{line.figure}</span>
                    <p>{line.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="chapter" aria-labelledby="trends-h">
          <header className="chapter__head">
            <p className="chapter__kicker">Part 1 of 3</p>
            <p className="chapter__title" id="trends-h">The trends</p>
            <p className="chapter__dek">What is rising and what is cooling, in research and in discussion.</p>
          </header>

        <section id="momentum" className="band" aria-labelledby="momentum-h">
          <div className="band__head">
            <h2 id="momentum-h">Topic momentum</h2>
            <p>
              Each topic’s {compared}. Research is the topic’s share
              of all AI papers on arXiv; discussion is Hacker News stories with the topic in the title.
            </p>
          </div>

          {hasHistory ? (
            <>
              <MomentumMap
                points={mapPoints.map(({ t, rank }) => ({
                  id: t.id,
                  name: t.name,
                  rank,
                  research: t.papers.change ?? 0,
                  discussion: t.stories.change ?? 0,
                  direction: t.direction,
                  firm: firm.has(t.id),
                }))}
                unplaced={topicTrends.filter((t) => !mapPoints.some((p) => p.t.id === t.id)).map((t) => t.name)}
              />
              <div className="trend-cols" aria-hidden="true">
                <span>Topic</span>
                <span>Research <i>share of AI papers</i></span>
                <span>Discussion <i>Hacker News stories</i></span>
              </div>
              <ol className="trends">
                {topicTrends.map((t, i) => (
                  <li key={t.id} id={`topic-${t.id}`} className="trend">
                    <div className="trend__topic">
                      <span className="trend__rank">{i + 1}</span>
                      <h3>{t.name}</h3>
                      <p>{t.blurb}</p>
                    </div>
                    <div className="trend__signal">
                      <span className="trend__label">Research</span>
                      {t.hasPapers ? (
                        <>
                          <Sparkline
                            values={t.papers.values}
                            labels={weekLabels}
                            unit="share"
                            tone={toneOf(t.papers)}
                            summary={`${t.name}: share of AI papers over ${weeks.length} weeks, now ${t.papers.recent.toFixed(1)}%, ${fmtChange(t.papers.change)}`}
                          />
                          <Change signal={t.papers} />
                          <span className="trend__level">
                            {t.papers.recent.toFixed(1)}%<span className="vh"> of papers</span>
                          </span>
                        </>
                      ) : (
                        <p className="trend__pending">Paper counts not collected yet</p>
                      )}
                    </div>
                    <div className="trend__signal">
                      <span className="trend__label">Discussion</span>
                      <Sparkline
                        values={t.stories.values}
                        labels={weekLabels}
                        unit="stories"
                        tone={toneOf(t.stories)}
                        summary={`${t.name}: Hacker News stories per week over ${weeks.length} weeks, now ${Math.round(t.stories.recent)}, ${fmtChange(t.stories.change)}`}
                      />
                      <Change signal={t.stories} />
                      <PerWeek value={t.stories.recent} />
                    </div>
                  </li>
                ))}
              </ol>

              <details className="table-view">
                <summary>Show the weekly numbers as a table</summary>
                <div className="table-view__scroll">
                  <table>
                    <caption>Papers mentioning each topic, per week (and Hacker News stories)</caption>
                    <thead>
                      <tr>
                        <th scope="col">Topic</th>
                        {weeks.map((w) => (
                          <th scope="col" key={w}>{fmtDay(w)}</th>
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
            </>
          ) : (
            <p className="empty">
              This view needs {2 * WINDOW} weeks of history and {weeks.length} have been collected. Run{" "}
              <code>npm run collect</code> to backfill the rest.
            </p>
          )}
        </section>

        <section id="themes" className="band" aria-labelledby="themes-h">
          <div className="band__head">
            <h2 id="themes-h">Economy and society themes</h2>
            <p>
              What the discussion says AI is doing to work, companies and society. Each theme’s share of Hacker News
              stories with AI in the title, {compared}. Select a theme to see the sub-themes inside it.
            </p>
          </div>

          {hasThemes ? (
            <>
              <div className="trend-cols" aria-hidden="true">
                <span>Theme</span>
                <span>Share <i>of AI stories</i></span>
                <span>Stories <i>on Hacker News</i></span>
              </div>
              <ol className="trends">
                {themeTrends.map((t, i) => (
                  <ThemeRow
                    key={t.id}
                    rank={i + 1}
                    name={t.name}
                    blurb={t.blurb}
                    count={t.parts.length}
                    cells={
                      <>
                        <ThemeCells name={t.name} share={t.share} stories={t.stories} labels={weekLabels} />
                      </>
                    }
                  >
                    {t.parts.map((part) => (
                      <li key={part.id} className="trend trend--sub">
                        <div className="trend__topic">
                          <span className="trend__rank" aria-hidden="true" />
                          <h4>{part.name}</h4>
                          <p>Stories whose title matches: {part.searches.join(", ")}</p>
                        </div>
                        <ThemeCells
                          name={`${t.name}, ${part.name}`}
                          share={part.share}
                          stories={part.stories}
                         
                          labels={weekLabels}
                          enough={part.enough}
                        />
                      </li>
                    ))}
                  </ThemeRow>
                ))}
              </ol>

              <details className="table-view">
                <summary>Show the weekly theme numbers as a table</summary>
                <div className="table-view__scroll">
                  <table>
                    <caption>Hacker News stories matching each theme and sub-theme, per week</caption>
                    <thead>
                      <tr>
                        <th scope="col">Theme</th>
                        {weeks.map((w) => (
                          <th scope="col" key={w}>{fmtDay(w)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {themeTrends.flatMap((t) => [
                        <tr key={t.id}>
                          <th scope="row">{t.name}</th>
                          {weeks.map((w, i) => (
                            <td key={w}>{t.stories.values[i]}</td>
                          ))}
                        </tr>,
                        ...t.parts.map((part) => (
                          <tr key={`${t.id}.${part.id}`} className="table-view__sub">
                            <th scope="row">{part.name}</th>
                            {weeks.map((w, i) => (
                              <td key={w}>{part.stories.values[i]}</td>
                            ))}
                          </tr>
                        )),
                      ])}
                      <tr>
                        <th scope="row">All AI stories</th>
                        {weeks.map((w) => (
                          <td key={w}>{(history.hnAiTotal?.[w] ?? 0).toLocaleString("en")}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="empty">Theme history is still being collected.</p>
          )}
        </section>

        </section>

        <section className="chapter" aria-labelledby="evidence-h">
          <header className="chapter__head">
            <p className="chapter__kicker">Part 2 of 3</p>
            <p className="chapter__title" id="evidence-h">The evidence</p>
            <p className="chapter__dek">Slower numbers from outside the conversation: hiring, policy, releases and what developers install.</p>
          </header>

        <section id="indicators" className="band" aria-labelledby="indicators-h">
          <div className="band__head">
            <h2 id="indicators-h">Economy and policy indicators</h2>
            <p>
              Three slower-moving numbers from outside the research world: hiring, government attention and the pace
              of frontier releases. Each comes from one public source.
            </p>
          </div>

          <div className="trend-cols trend-cols--plain" aria-hidden="true">
            <span>Indicator</span>
            <span>Trend <i>change and latest reading</i></span>
            <span>Compared with</span>
          </div>
          <ol className="trends">
            {jobs && (
              <li className="trend trend--plain">
                <div className="trend__topic">
                  <h3>AI share of US job postings</h3>
                  <p>
                    Postings on Indeed that ask for AI skills, as of {fmtDate(jobs.asOf)}. The data is refreshed
                    monthly.
                  </p>
                </div>
                <div className="trend__signal">
                  <span className="trend__label">Trend</span>
                  <Sparkline
                    values={jobs.signal.values}
                    labels={jobs.labels}
                    unit="postings"
                    tone={toneOf(jobs.signal)}
                    summary={`Share of US job postings on Indeed mentioning AI skills, monthly for a year: now ${jobs.signal.recent.toFixed(1)}%, ${fmtChange(jobs.signal.change)} on a year earlier`}
                  />
                  <Change signal={jobs.signal} />
                  <span className="trend__level">{jobs.signal.recent.toFixed(1)}%</span>
                </div>
                <p className="trend__context">
                  {jobs.signal.prior.toFixed(1)}% a year earlier ·{" "}
                  <a href="https://github.com/hiring-lab/ai-tracker">Indeed Hiring Lab</a>
                </p>
              </li>
            )}

            {federal && (
              <li className="trend trend--plain">
                <div className="trend__topic">
                  <h3>US federal documents mentioning AI</h3>
                  <p>
                    Rules, proposed rules and notices whose text includes “artificial intelligence”. A mention can be
                    brief, so this shows attention, not regulation.
                  </p>
                </div>
                <div className="trend__signal">
                  <span className="trend__label">Trend</span>
                  <Sparkline
                    values={federal.signal.values}
                    labels={federal.labels}
                    unit="documents"
                    tone={toneOf(federal.signal)}
                    summary={`Federal Register documents mentioning artificial intelligence, monthly for a year: ${federal.signal.recent} in ${fmtMonth(federal.latestMonth)}, ${fmtChange(federal.signal.change)} on a year earlier`}
                  />
                  <Change signal={federal.signal} />
                  <span className="trend__level">{federal.signal.recent}</span>
                </div>
                <p className="trend__context">
                  {federal.signal.prior} a year earlier, in {fmtMonth(federal.latestMonth)} ·{" "}
                  <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22artificial+intelligence%22">
                    Federal Register
                  </a>
                </p>
              </li>
            )}

            {releases && (
              <li className="trend trend--plain">
                <div className="trend__topic">
                  <h3>Frontier model releases</h3>
                  <p>
                    New version numbers from Anthropic, Google DeepMind and OpenAI in the last 90 days. Latest:{" "}
                    {releases.shown.slice(0, 3).map((r) => `${r.model} (${fmtDay(r.date)})`).join(", ")}.
                  </p>
                </div>
                <div className="trend__signal">
                  <span className="trend__label">Trend</span>
                  <Sparkline
                    values={releases.signal.values}
                    labels={releases.labels}
                    unit="releases"
                    tone={toneOf(releases.signal)}
                    summary={`New model versions from Anthropic, Google DeepMind and OpenAI per 30 days over six periods: ${releases.signal.recent} in the last 90 days, ${releases.signal.prior} in the 90 days before`}
                  />
                  <Change signal={releases.signal} />
                  <span className="trend__level">{releases.signal.recent}</span>
                </div>
                <p className="trend__context">{releases.signal.prior} in the 90 days before</p>
              </li>
            )}
          </ol>

          <details className="table-view">
            <summary>Show the indicator numbers as tables</summary>
            <div className="table-view__scroll table-view__scroll--set">
              {jobs && federal && (
                <table>
                  <caption>Monthly readings</caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">AI share of job postings</th>
                      <th scope="col">Federal documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(indicators.federal?.months ?? []).map((m) => {
                      const share = indicators.jobs?.months.find((j) => j.month === m.month)?.share;
                      return (
                        <tr key={m.month}>
                          <th scope="row">{fmtMonth(m.month)}</th>
                          <td>{share === undefined ? "not yet published" : `${share.toFixed(1)}%`}</td>
                          <td>{m.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {releases && (
                <table>
                  <caption>Model versions counted, past 180 days</caption>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">Lab</th>
                      <th scope="col">First announced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.shown.map((r) => (
                      <tr key={r.url}>
                        <th scope="row">
                          <a href={r.url}>{r.model}</a>
                        </th>
                        <td>{r.lab}</td>
                        <td>{fmtDate(r.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        </section>

        {adoption && (
          <section id="adoption" className="band" aria-labelledby="adoption-h">
            <div className="band__head">
              <h2 id="adoption-h">Business adoption</h2>
              <p>
                How many US businesses say they use AI, from the Census Bureau’s business survey, asked every two
                weeks. Latest survey: two weeks to {fmtDate(adoption.asOf)}. These are businesses’ own answers, and
                each business counts once whatever its size.
              </p>
            </div>

            <div className="trend-cols trend-cols--plain" aria-hidden="true">
              <span>Measure</span>
              <span>Trend <i>change and recent average</i></span>
              <span>Compared with</span>
            </div>
            <ol className="trends">
              {adoptionRows.map((row) => (
                <li key={row.id} className="trend trend--plain">
                  <div className="trend__topic">
                    <h3>{row.name}</h3>
                    <p>{row.blurb}</p>
                  </div>
                  <div className="trend__signal">
                    <span className="trend__label">Trend</span>
                    <Sparkline
                      values={row.signal.values}
                      labels={adoption.labels}
                      unit="businesses"
                      tone={toneOf(row.signal)}
                      summary={`${row.name}: share of businesses saying yes, every two weeks over ${adoption.labels.length} surveys, ${row.latest.toFixed(1)}% in the latest${row.signal.change === null ? "" : `, with the last ${ADOPTION_WINDOW} surveys ${fmtChange(row.signal.change)} on the ${ADOPTION_WINDOW} before`}`}
                    />
                    {row.signal.change === null ? (
                      <span className="trend__few">too little history</span>
                    ) : (
                      <Change signal={row.signal} />
                    )}
                    <span className="trend__level">
                      {row.signal.recent.toFixed(1)}%<span className="vh"> of businesses, average of the last {ADOPTION_WINDOW} surveys</span>
                    </span>
                  </div>
                  <p className="trend__context">
                    {row.signal.change !== null && `${row.signal.prior.toFixed(1)}% over the ${ADOPTION_WINDOW} surveys before · `}
                    {row.latest.toFixed(1)}% in the latest ·{" "}
                    <a href="https://www.census.gov/hfp/btos/data_downloads">Census Bureau</a>
                  </p>
                </li>
              ))}
            </ol>

            <details className="table-view">
              <summary>Show the survey numbers as a table</summary>
              <div className="table-view__scroll">
                <table>
                  <caption>Share of US businesses answering yes, by two-week survey</caption>
                  <thead>
                    <tr>
                      <th scope="col">Survey</th>
                      <th scope="col">Used AI in the last two weeks</th>
                      <th scope="col">Expect to use AI in the next six months</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adoption.labels.map((label, i) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        <td>{adoption.using.values[i].toFixed(1)}%</td>
                        <td>{adoption.planning ? `${adoption.planning.values[i].toFixed(1)}%` : "not published"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )}

        {usage && (
          <section id="usage" className="band" aria-labelledby="usage-h">
            <div className="band__head">
              <h2 id="usage-h">Developer usage</h2>
              <p>
                How often the toolkits developers build AI with were downloaded: {fmtCompact(usage.totalDownloads)}{" "}
                downloads across {usage.toolkits.length} toolkits in {fmtMonth(usage.latestMonth)}. Each toolkit is
                judged by its share of those downloads, averaged across Python and JavaScript, so growth in the whole
                field is not read as a rise for everyone. Automated systems download too, so this shows direction,
                not a count of people.
              </p>
            </div>

            <div className="trend-cols trend-cols--plain" aria-hidden="true">
              <span>Toolkit</span>
              <span>Share of downloads <i>change and latest</i></span>
              <span>Downloads</span>
            </div>
            <MoreRows count={usage.toolkits.length} noun="toolkits">
              {usage.toolkits.map((t) => (
                <li key={t.id} className="trend trend--plain">
                  <div className="trend__topic">
                    <h3>{t.name}</h3>
                    <p>{t.blurb}.</p>
                  </div>
                  <div className="trend__signal">
                    <span className="trend__label">Share</span>
                    <Sparkline
                      values={t.share.values}
                      labels={usage.labels}
                      unit="downloadShare"
                      tone={toneOf(t.share)}
                      summary={`${t.name}: share of tracked toolkit downloads, monthly over ${usage.labels.length} months, ${t.share.recent.toFixed(1)}% over the last ${USAGE_WINDOW}${t.share.change === null ? "" : `, ${fmtChange(t.share.change)} on the ${USAGE_WINDOW} before`}`}
                    />
                    {t.share.change === null ? (
                      <span className="trend__few">too little history</span>
                    ) : (
                      <Change signal={t.share} />
                    )}
                    <span className="trend__level">
                      {t.share.recent.toFixed(1)}%<span className="vh"> of downloads</span>
                    </span>
                  </div>
                  <p className="trend__context">
                    {fmtCompact(t.downloads)} in {fmtMonth(usage.latestMonth)} ·{" "}
                    {t.kind === "lab" ? "lab toolkit" : "building tool"}
                  </p>
                </li>
              ))}
            </MoreRows>

            <details className="table-view">
              <summary>Show the usage numbers as a table</summary>
              <div className="table-view__scroll">
                <table>
                  <caption>Toolkit downloads, share averaged across Python and JavaScript, and the packages counted</caption>
                  <thead>
                    <tr>
                      <th scope="col">Toolkit</th>
                      <th scope="col">Downloads, {fmtMonth(usage.latestMonth)}</th>
                      <th scope="col">Share, last {USAGE_WINDOW} months</th>
                      <th scope="col">Share, {USAGE_WINDOW} months before</th>
                      <th scope="col">Python packages (PyPI)</th>
                      <th scope="col">JavaScript packages (npm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.toolkits.map((t) => (
                      <tr key={t.id}>
                        <th scope="row">{t.name}</th>
                        <td>{t.downloads.toLocaleString("en")}</td>
                        <td>{t.share.recent.toFixed(1)}%</td>
                        <td>{t.share.change === null ? "not yet collected" : `${t.share.prior.toFixed(1)}%`}</td>
                        <td>{t.pypi.join(", ") || "none"}</td>
                        <td>{t.npm.join(", ") || "none"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )}

        {marketShare && (
          <section id="market-share" className="band" aria-labelledby="market-share-h">
            <div className="band__head">
              <h2 id="market-share-h">Model share on OpenRouter</h2>
              <p>
                Whose models developers send their work to, on one large marketplace that offers every major model
                side by side: {fmtCompact(marketShare.totalTokens)} tokens in the week of {fmtWeek(marketShare.latestWeek)}
                . It leans toward cheap and open models, and leaves out everyone who goes to a lab directly, so read
                it as one marketplace, not the whole market.
              </p>
            </div>

            <div className="trend-cols trend-cols--plain" aria-hidden="true">
              <span>Model maker</span>
              <span>Share of tokens <i>change and recent average</i></span>
              <span>Tokens</span>
            </div>
            <MoreRows count={marketShare.makers.length} noun="model makers">
              {marketShare.makers.map((m) => (
                <li key={m.id} className="trend trend--plain">
                  <div className="trend__topic">
                    <h3>{m.name}</h3>
                  </div>
                  <div className="trend__signal">
                    <span className="trend__label">Share</span>
                    <Sparkline
                      values={m.share.values}
                      labels={m.labels}
                      unit="tokenShare"
                      tone={toneOf(m.share)}
                      summary={`${m.name}: share of tokens on OpenRouter, weekly over ${m.labels.length} weeks, now ${m.share.recent.toFixed(1)}%${m.share.change === null ? "" : `, ${fmtChange(m.share.change)}`}`}
                    />
                    {m.share.change === null ? (
                      <span className="trend__few">not always in the top nine</span>
                    ) : (
                      <Change signal={m.share} />
                    )}
                    <span className="trend__level">
                      {m.share.recent.toFixed(1)}%<span className="vh"> of tokens</span>
                    </span>
                  </div>
                  <p className="trend__context">{fmtCompact(m.tokens)} in the latest week</p>
                </li>
              ))}
            </MoreRows>
            <p className="trend__context">
              Other makers together: {marketShare.otherShare.toFixed(1)}% in the latest week ·{" "}
              {WINDOW === 1 ? "latest week compared with the week before" : `last ${WINDOW} weeks compared with the ${WINDOW} before`} ·
              Source: <a href="https://openrouter.ai/rankings">OpenRouter (openrouter.ai/rankings)</a>, as of{" "}
              {fmtDate(indicators.updatedAt)}, licensed{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
            </p>

            <details className="table-view">
              <summary>Show the model share numbers as a table</summary>
              <div className="table-view__scroll">
                <table>
                  <caption>Share of tokens on OpenRouter by model maker, {compared}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Model maker</th>
                      <th scope="col">Share now</th>
                      <th scope="col">Share before</th>
                      <th scope="col">Tokens, latest week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketShare.makers.map((m) => (
                      <tr key={m.id}>
                        <th scope="row">{m.name}</th>
                        <td>{m.share.recent.toFixed(1)}%</td>
                        <td>{m.share.change === null ? "not in the top nine throughout" : `${m.share.prior.toFixed(1)}%`}</td>
                        <td>{m.tokens.toLocaleString("en")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )}

        </section>

        <section className="chapter chapter--reading" aria-labelledby="reading-h">
          <header className="chapter__head">
            <p className="chapter__kicker">Part 3 of 3</p>
            <p className="chapter__title" id="reading-h">The reading list</p>
            <p className="chapter__dek">The stories, papers, essays, code and models behind this week’s numbers.</p>
          </header>

        <div className="pair">
          <section id="news" className="band" aria-labelledby="news-h">
            <div className="band__head">
              <p className="band__source">Hacker News · past 7 days</p>
              <h2 id="news-h">In the news</h2>
              <p>The most upvoted AI stories on Hacker News in the past seven days.</p>
            </div>
            <Ledger
              first="Story"
              labelledBy="news-h"
              count={stories.length}
              more={
                <a className="more" href="https://hn.algolia.com/?dateRange=pastWeek&query=AI&sort=byPopularity&type=story">
                  More on Hacker News →
                </a>
              }
              cells={[
                { head: "Points", width: "5.5rem" },
                { head: "Comments", width: "4.25rem" },
              ]}
            >
              {stories.map((s) => (
                <li key={s.id}>
                  <span className="ledger__main">
                    <a href={s.url} title={s.title}>{s.title}</a>
                    <span className="ledger__note">{host(s.url)}</span>
                  </span>
                  <span className="ledger__data">
                    <Mag value={s.points} max={top(stories.map((x) => x.points))} unit="points" />
                    <span>
                      <a href={s.discussionUrl}>
                        {fmtCompact(s.comments)}
                        <span className="ledger__unit"> comments</span>
                      </a>
                    </span>
                    <span className="ledger__extra">{fmtDay(s.createdAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>

          <section id="papers" className="band" aria-labelledby="papers-h">
            <div className="band__head">
              <p className="band__source">Hugging Face Papers · by upvotes</p>
              <h2 id="papers-h">Papers getting attention</h2>
              <p>Recent papers ranked by reader upvotes on Hugging Face.</p>
            </div>
            <Ledger
              first="Paper"
              labelledBy="papers-h"
              count={papers.length}
              kind="paper"
              more={
                <a className="more" href="https://huggingface.co/papers">
                  More papers →
                </a>
              }
              cells={[
                { head: "Upvotes", width: "5.5rem" },
                { head: "Code", width: "2.25rem" },
              ]}
            >
              {papers.map((p) => (
                <li key={p.id}>
                  <span className="ledger__main">
                    <a href={p.url} title={p.title}>{p.title}</a>
                  </span>
                  <span className="ledger__data">
                    <Mag value={p.upvotes} max={top(papers.map((x) => x.upvotes))} unit="upvotes" />
                    <span className="ledger__extra">{fmtDay(p.publishedAt)}</span>
                    <span>{p.codeUrl && <a href={p.codeUrl}>code</a>}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>
        </div>

        <div className="pair">
          <section id="analysis" className="band" aria-labelledby="analysis-h">
            <div className="band__head">
              <p className="band__source">Newsletters and research institutions</p>
              <h2 id="analysis-h">From the analysts</h2>
              <p>
                New writing on what AI is doing to work, companies and society, from newsletters and research
                institutions. Some pieces need a subscription to read in full.
              </p>
            </div>
            <Ledger
              first="Piece"
              labelledBy="analysis-h"
              count={analysis.length}
              cells={[
                { head: "Source", width: "8.5rem", start: true },
                { head: "Published", width: "3.75rem" },
              ]}
            >
              {analysis.map((a) => (
                <li key={a.url}>
                  <span className="ledger__main">
                    <a href={a.url} title={a.title}>{a.title}</a>
                  </span>
                  <span className="ledger__data">
                    <span className="ledger__cell--start">{a.source}</span>
                    <span>{fmtDay(a.publishedAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>

          <section id="announcements" className="band" aria-labelledby="announcements-h">
            <div className="band__head">
              <p className="band__source">Lab blogs</p>
              <h2 id="announcements-h">Lab announcements</h2>
              <p>The latest posts from Anthropic, OpenAI and Google DeepMind, including closed-model releases.</p>
            </div>
            <Ledger
              first="Post"
              labelledBy="announcements-h"
              count={labNews.length}
              cells={[
                { head: "Lab", width: "7.5rem", start: true },
                { head: "Published", width: "3.75rem" },
              ]}
            >
              {labNews.map((a) => (
                <li key={a.url}>
                  <span className="ledger__main">
                    <a href={a.url} title={a.title}>{a.title}</a>
                  </span>
                  <span className="ledger__data">
                    <span className="ledger__cell--start">{a.source}</span>
                    <span>{fmtDay(a.publishedAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>
        </div>

        <section id="code" className="band" aria-labelledby="code-h">
          <div className="band__head">
            <p className="band__source">GitHub · created in the past 30 days</p>
            <h2 id="code-h">Repositories gaining stars</h2>
            <p>AI projects created on GitHub in the past 30 days, ranked by stars gained per day.</p>
          </div>
          <Ledger
            first="Repository"
            labelledBy="code-h"
            count={repos.length}
            kind="thing"
            more={
              <a className="more" href="https://github.com/trending">
                More on GitHub →
              </a>
            }
            cells={[
              { head: "Stars a day", width: "7.5rem" },
              { head: "Total", width: "3.25rem" },
              { head: "Language", width: "5.5rem", start: true },
              { head: "Created", width: "3.25rem" },
            ]}
          >
            {repos.map((r) => (
              <li key={r.name}>
                <span className="ledger__main">
                  <a href={r.url} title={r.name}>{r.name}</a>
                  {r.description && <span className="ledger__note" title={r.description}>{r.description}</span>}
                </span>
                <span className="ledger__data">
                  <Mag value={r.starsPerDay} max={top(repos.map((x) => x.starsPerDay))} unit="stars a day" />
                  <span>
                    {fmtCompact(r.stars)}
                    <span className="ledger__unit"> total</span>
                  </span>
                  <span className="ledger__cell--start">{r.language}</span>
                  <span>
                    <span className="ledger__unit">created </span>
                    {fmtDay(r.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </Ledger>
        </section>

        <div className="pair">
          <section id="models" className="band" aria-labelledby="models-h">
            <div className="band__head">
              <p className="band__source">Hugging Face · trending now</p>
              <h2 id="models-h">Models trending</h2>
              <p>What builders are picking up on Hugging Face right now.</p>
            </div>
            <Ledger
              first="Model"
              labelledBy="models-h"
              count={models.length}
              kind="thing"
              more={
                <a className="more" href="https://huggingface.co/models?sort=trending">
                  More models →
                </a>
              }
              cells={[
                { head: "Likes", width: "5.5rem" },
                { head: "Downloads", width: "4.5rem" },
              ]}
            >
              {models.map((m) => (
                <li key={m.id}>
                  <span className="ledger__main">
                    <a href={m.url} title={m.id}>{m.id}</a>
                    {m.task && <span className="ledger__note">{task(m.task)}</span>}
                  </span>
                  <span className="ledger__data">
                    <Mag value={m.likes} max={top(models.map((x) => x.likes))} unit="likes" />
                    <span>
                      {fmtCompact(m.downloads)}
                      <span className="ledger__unit"> downloads</span>
                    </span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>

          <section id="labs" className="band" aria-labelledby="labs-h">
            <div className="band__head">
              <p className="band__source">Hugging Face · past 45 days</p>
              <h2 id="labs-h">New from the labs</h2>
              <p>Open models published by major AI labs in the past 45 days, by likes.</p>
            </div>
            <Ledger
              first="Model"
              labelledBy="labs-h"
              count={labModels.length}
              kind="thing"
              cells={[
                { head: "Likes", width: "5.5rem" },
                { head: "Released", width: "3.75rem" },
              ]}
            >
              {labModels.map((m) => (
                <li key={m.id}>
                  <span className="ledger__main">
                    <a href={m.url} title={m.id}>{m.id}</a>
                    {m.task && <span className="ledger__note">{task(m.task)}</span>}
                  </span>
                  <span className="ledger__data">
                    <Mag value={m.likes} max={top(labModels.map((x) => x.likes))} unit="likes" />
                    <span>
                      <span className="ledger__unit">released </span>
                      {fmtDay(m.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </Ledger>
          </section>
        </div>

        </section>

        <section id="method" className="band method" aria-labelledby="method-h">
          <div className="band__head">
            <h2 id="method-h">How this is measured</h2>
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
          <details className="table-view">
            <summary>Read how each number is counted</summary>
            <div className="prose">
              <p>
                <strong>Research momentum</strong> counts the papers submitted to arXiv’s AI-related categories each
                week whose title or abstract mentions a topic, as a share of all AI papers that week. Using share
                rather than raw counts keeps conference deadlines, which lift every topic at once, from looking like
                a trend.
              </p>
              <p>
                <strong>Discussion momentum</strong> counts Hacker News stories with the topic in the title. These
                numbers are small and jumpy, so read them as a second opinion, not a verdict.
              </p>
              <p>
                A topic is called rising or cooling when its paper share moved by at least 10%, rounded to a whole percent as shown, between the two
                windows being compared. The switch at the top sets those windows, and the colours carry no judgement: blue marks a rise and amber a fall. <strong>1 week</strong> compares
                the latest week with the week before, and <strong>1 month</strong> the last{" "}
                {HORIZONS.oneMonth.window} weeks with the {HORIZONS.oneMonth.window} before. These two react
                fastest and are the noisiest: one conference deadline or one news story can move them, so treat a
                call there as a prompt to look, not a trend. <strong>3 months</strong> compares the last{" "}
                {HORIZONS.threeMonths.window} weeks with the {HORIZONS.threeMonths.window} before.{" "}
                <strong>6 months</strong> compares the last {HORIZONS.sixMonths.window} weeks with the{" "}
                {HORIZONS.sixMonths.window} before, one quarter against the previous one.{" "}
                <strong>1 year</strong> compares the last {HORIZONS.oneYear.window} weeks with the{" "}
                {HORIZONS.oneYear.window} before, one half-year against the other. The longer views react slowly,
                and a topic can be rising in one view and cooling in another. Topics are defined by keyword lists, so a paper can count toward several topics,
                and work that uses unfamiliar wording is missed. Small topics swing more easily, so the headline only
                names topics averaging at least {HEADLINE_MIN_PAPERS} papers a week.
              </p>
              <p>
                <strong>The map</strong> places a topic by two changes over the same windows: its share
                of AI papers (across) and its Hacker News stories (up). The map’s scale stretches near the middle, so small changes stay apart and one large change does not flatten the rest; the gridlines carry the real figures. A topic is drawn solid only when it averages at
                least {HEADLINE_MIN_PAPERS} papers and {MAP_MIN_STORIES} stories a week. Smaller topics swing too
                easily, so they are drawn hollow and should be read with care. <strong>The week in five numbers</strong> is written by fixed rules from the same numbers, not by an editor or a model. Its research and discussion lines follow the view chosen; its economy, releases and policy lines are the same in every view.
              </p>
              <p>
                <strong>Economy and society themes</strong> count Hacker News stories whose title contains AI and a
                theme word, such as “layoffs” or “data center”, as a share of all stories with AI in the title. Each
                story counts once per theme. The counts are small, often 10 to 30 stories a week, so a theme is
                called rising or cooling only when its share moved by at least {THEME_STEADY_BAND * 100}%. Hacker
                News readers are mostly technologists, so this shows what that community is discussing, not public
                opinion.
              </p>
              <p>
                <strong>Sub-themes</strong> split each theme into four narrower groups of the same title searches;
                point at a sub-theme’s name, or read it on a phone, to see its searches. A story counts once per
                sub-theme but can sit in more than one, so the sub-themes add up to more than their theme. Their
                counts are smaller still: a sub-theme averaging fewer than {SUBTHEME_MIN_STORIES} stories a week
                in either half of the comparison is marked “too few to call” instead of rising or cooling.
              </p>
              <p>
                Closed models released only through an API do not appear in the model lists, which cover open models
                on Hugging Face. They show up in the news and in the lab announcements instead.
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
                which lifts their makers. Each maker counts tokens its own way, so shares are approximate. A week
                names only its nine largest makers, so a maker’s line starts from when it last entered the nine, and
                its change is shown only if it stayed there for the whole comparison.
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
              <p>
                <strong>From the analysts</strong> lists the newest pieces from a fixed set of ten newsletters and
                research institutions, at most two from each, from the past 30 days. It is a reading list chosen
                by the editor, not a ranking. Publishers that cover other subjects are filtered to pieces that
                mention AI.
              </p>
              <p>
                <strong>The reading lists</strong> show their first few items; the rest open on request. Where a
                list is set in columns, the bar beside the figure it is ranked by shows it against the largest in
                that list.
              </p>
            </div>
          </details>
        </section>
      </main>

      <footer className="colophon">
        <p>
          AI Trend Tracker is rebuilt from public data: arXiv, Hacker News, GitHub and Hugging Face, with headlines from publishers’ own feeds. Thank you to
          arXiv for use of its open access interoperability. Counts are keyword matches and should be read as
          indicators, not measurements. Set in Newsreader and Geist. Data last collected{" "}
          {fmtDate(latest.generatedAt)}.
        </p>
      </footer>
    </>
  );
}
