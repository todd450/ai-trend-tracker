import { Logo } from "@/components/Logo";
import { Sparkline } from "@/components/Sparkline";
import {
  WINDOW,
  fmtChange,
  fmtCompact,
  fmtDate,
  fmtDay,
  fmtWeek,
  hasHistory,
  history,
  isoWeek,
  latest,
  topicTrends,
  weeks,
  type Direction,
  type Signal,
} from "@/lib/trends";

import { federal, fmtMonth, indicators, jobs, releases } from "@/lib/indicators";

const SHOWN = 10;
/** Average papers a week a topic needs before the headline will name it. */
const HEADLINE_MIN_PAPERS = 25;

const DIRECTION_LABEL: Record<Direction, string> = { rising: "Rising", steady: "Steady", cooling: "Cooling" };
const ARROW: Record<Direction, string> = { rising: "▲", steady: "■", cooling: "▼" };

const SOURCE_LABELS: Record<string, string> = {
  arxivHistory: "arXiv weekly paper counts",
  hnHistory: "Hacker News weekly story counts",
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
};

function toneOf(signal: Signal): Direction {
  if (signal.change === null || Math.abs(signal.change) < 0.1) return "steady";
  return signal.change > 0 ? "rising" : "cooling";
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function Change({ signal }: { signal: Signal }) {
  const tone = toneOf(signal);
  return (
    <span className="change">
      <span className={`change__mark change__mark--${tone}`} aria-hidden="true">
        {ARROW[tone]}
      </span>
      {fmtChange(signal.change)}
    </span>
  );
}

export default function Home() {
  const latestWeek = weeks.at(-1);
  const weekLabels = weeks.map((w) => `Week of ${fmtDay(w)}`);
  // The headline only names topics with enough papers that a swing is not noise.
  const ranked = topicTrends.filter(
    (t) => t.hasPapers && t.paperCounts.slice(-WINDOW).reduce((a, b) => a + b, 0) / WINDOW >= HEADLINE_MIN_PAPERS,
  );
  const top = ranked[0];
  const bottom = ranked.at(-1);
  const papersLastWeek = latestWeek ? history.arxivTotal[latestWeek] : 0;

  return (
    <>
      <a className="skip" href="#momentum">
        Skip to this week’s trends
      </a>

      <header className="mast">
        <p className="mast__line">
          {latestWeek ? `No. ${isoWeek(latestWeek)} · Week of ${fmtWeek(latestWeek)}` : "First edition in preparation"}
        </p>
        <h1 className="mast__name">
          <Logo className="mast__mark" />
          AI Trend Tracker
        </h1>
        <nav className="mast__nav" aria-label="Sections">
          <ul>
            <li><a href="#momentum">Momentum</a></li>
            <li><a href="#news">News</a></li>
            <li><a href="#papers">Papers</a></li>
            <li><a href="#indicators">Indicators</a></li>
            <li><a href="#analysis">Analysis</a></li>
            <li><a href="#code">Code</a></li>
            <li><a href="#models">Models</a></li>
            <li><a href="#method">Method</a></li>
          </ul>
        </nav>
      </header>

      <main className="page">
        <section className="lede">
          <h2 className="lede__head">
            {hasHistory && top && bottom && top.direction === "rising" && bottom.direction === "cooling" ? (
              <>
                On the rise: {top.name}. <span className="lede__turn">Losing ground: {bottom.name}.</span>
              </>
            ) : (
              "Where attention in AI is moving this week."
            )}
          </h2>
          <div className="lede__dek">
            <p>
              A weekly reading of where attention in artificial intelligence is moving, measured from four public
              sources: new research papers, open-source code, model releases and news discussion.
            </p>
            <p className="lede__meta">
              Updated {fmtDate(latest.generatedAt)}
              {papersLastWeek > 0 && <> · {papersLastWeek.toLocaleString("en")} AI papers reached arXiv last week</>}
            </p>
          </div>
        </section>

        <section id="momentum" className="band" aria-labelledby="momentum-h">
          <div className="band__head">
            <h2 id="momentum-h">Topic momentum</h2>
            <p>
              Each topic’s last {WINDOW} weeks compared with the {WINDOW} weeks before. Research is the topic’s share
              of all AI papers on arXiv; discussion is Hacker News stories with the topic in the title.
            </p>
          </div>

          {hasHistory ? (
            <>
              <div className="trend-cols" aria-hidden="true">
                <span>Topic</span>
                <span>Research</span>
                <span>Discussion</span>
              </div>
              <ol className="trends">
                {topicTrends.map((t, i) => (
                  <li key={t.id} className="trend">
                    <div className="trend__topic">
                      <span className="trend__rank">{i + 1}</span>
                      <div>
                        <h3>{t.name}</h3>
                        <p>{t.blurb}</p>
                        {t.hasPapers && (
                          <span className={`trend__status trend__status--${t.direction}`}>
                            <span aria-hidden="true">{ARROW[t.direction]}</span> {DIRECTION_LABEL[t.direction]}
                          </span>
                        )}
                      </div>
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
                        <p className="trend__figure">
                          <Change signal={t.papers} />
                          <span>{t.papers.recent.toFixed(1)}% of papers</span>
                        </p>
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
                      <p className="trend__figure">
                        <Change signal={t.stories} />
                        <span>{Math.round(t.stories.recent) === 1 ? "1 story" : `${Math.round(t.stories.recent)} stories`} a week</span>
                      </p>
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
              Weekly history is still being collected. Run <code>npm run collect</code> to backfill it.
            </p>
          )}
        </section>

        <div className="pair pair--wide-left">
          <section id="news" className="band" aria-labelledby="news-h">
            <div className="band__head">
              <h2 id="news-h">In the news</h2>
              <p>The most upvoted AI stories on Hacker News in the past seven days.</p>
            </div>
            <ol className="list">
              {latest.stories.slice(0, SHOWN).map((s) => (
                <li key={s.id}>
                  <a href={s.url}>{s.title}</a>
                  <p className="list__meta">
                    {host(s.url)} · {fmtCompact(s.points)} points ·{" "}
                    <a href={s.discussionUrl}>{fmtCompact(s.comments)} comments</a> · {fmtDay(s.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
            <a className="more" href="https://hn.algolia.com/?dateRange=pastWeek&query=AI&sort=byPopularity&type=story">
              More on Hacker News →
            </a>
          </section>

          <section id="papers" className="band" aria-labelledby="papers-h">
            <div className="band__head">
              <h2 id="papers-h">Papers getting attention</h2>
              <p>Recent papers ranked by reader upvotes on Hugging Face.</p>
            </div>
            <ol className="list">
              {latest.papers.slice(0, SHOWN).map((p) => (
                <li key={p.id}>
                  <a href={p.url}>{p.title}</a>
                  <p className="list__meta">
                    {fmtCompact(p.upvotes)} upvotes · {fmtDay(p.publishedAt)}
                    {p.codeUrl && (
                      <>
                        {" "}· <a href={p.codeUrl}>code</a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
            <a className="more" href="https://huggingface.co/papers">
              More papers →
            </a>
          </section>
        </div>

        <section id="indicators" className="band" aria-labelledby="indicators-h">
          <div className="band__head">
            <h2 id="indicators-h">Economy and policy indicators</h2>
            <p>
              Three slower-moving numbers from outside the research world: hiring, government attention and the pace
              of frontier releases. Each comes from one public source.
            </p>
          </div>

          <div className="tiles">
            {jobs && (
              <article className="tile">
                <h3>AI share of US job postings</h3>
                <p className="tile__figure">{jobs.signal.recent.toFixed(1)}%</p>
                <p className="tile__change">
                  <Change signal={jobs.signal} />
                  <span>from {jobs.signal.prior.toFixed(1)}% a year earlier</span>
                </p>
                <Sparkline
                  values={jobs.signal.values}
                  labels={jobs.labels}
                  unit="postings"
                  tone={toneOf(jobs.signal)}
                  summary={`Share of US job postings on Indeed mentioning AI skills, monthly for a year: now ${jobs.signal.recent.toFixed(1)}%, ${fmtChange(jobs.signal.change)} on a year earlier`}
                />
                <p className="tile__note">
                  Postings on Indeed that ask for AI skills, as of {fmtDate(jobs.asOf)}. The data is refreshed
                  monthly. Source: <a href="https://github.com/hiring-lab/ai-tracker">Indeed Hiring Lab</a>.
                </p>
              </article>
            )}

            {federal && (
              <article className="tile">
                <h3>US federal documents mentioning AI</h3>
                <p className="tile__figure">{federal.signal.recent}</p>
                <p className="tile__change">
                  <Change signal={federal.signal} />
                  <span>
                    in {fmtMonth(federal.latestMonth)}, from {federal.signal.prior} a year earlier
                  </span>
                </p>
                <Sparkline
                  values={federal.signal.values}
                  labels={federal.labels}
                  unit="documents"
                  tone={toneOf(federal.signal)}
                  summary={`Federal Register documents mentioning artificial intelligence, monthly for a year: ${federal.signal.recent} in ${fmtMonth(federal.latestMonth)}, ${fmtChange(federal.signal.change)} on a year earlier`}
                />
                <p className="tile__note">
                  Rules, proposed rules and notices whose text includes “artificial intelligence”. A mention can be
                  brief, so this shows attention, not regulation. Source:{" "}
                  <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22artificial+intelligence%22">
                    Federal Register
                  </a>
                  .
                </p>
              </article>
            )}

            {releases && (
              <article className="tile">
                <h3>Frontier model releases</h3>
                <p className="tile__figure">{releases.signal.recent}</p>
                <p className="tile__change">
                  <Change signal={releases.signal} />
                  <span>
                    new versions in 90 days, from {releases.signal.prior} in the 90 days before
                  </span>
                </p>
                <Sparkline
                  values={releases.signal.values}
                  labels={releases.labels}
                  unit="releases"
                  tone={toneOf(releases.signal)}
                  summary={`New model versions from Anthropic, Google DeepMind and OpenAI per 30 days over six periods: ${releases.signal.recent} in the last 90 days, ${releases.signal.prior} in the 90 days before`}
                />
                <p className="tile__note">
                  New version numbers from Anthropic, Google DeepMind and OpenAI. Latest:{" "}
                  {releases.shown.slice(0, 3).map((r, i) => (
                    <span key={r.url}>
                      {i > 0 && ", "}
                      <a href={r.url}>{r.model}</a> ({fmtDay(r.date)})
                    </span>
                  ))}
                  .
                </p>
              </article>
            )}
          </div>

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

        <div className="pair pair--wide-left">
          <section id="analysis" className="band" aria-labelledby="analysis-h">
            <div className="band__head">
              <h2 id="analysis-h">From the analysts</h2>
              <p>
                New writing on what AI is doing to work, companies and society, from newsletters and research
                institutions. Some pieces need a subscription to read in full.
              </p>
            </div>
            <ol className="list">
              {(latest.analysis ?? []).slice(0, SHOWN).map((a) => (
                <li key={a.url}>
                  <a href={a.url}>{a.title}</a>
                  <p className="list__meta">
                    {a.source} · {fmtDay(a.publishedAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section id="announcements" className="band" aria-labelledby="announcements-h">
            <div className="band__head">
              <h2 id="announcements-h">Lab announcements</h2>
              <p>The latest posts from Anthropic, OpenAI and Google DeepMind, including closed-model releases.</p>
            </div>
            <ol className="list">
              {(latest.labNews ?? []).slice(0, SHOWN).map((a) => (
                <li key={a.url}>
                  <a href={a.url}>{a.title}</a>
                  <p className="list__meta">
                    {a.source} · {fmtDay(a.publishedAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="pair pair--wide-right">
          <section id="code" className="band" aria-labelledby="code-h">
            <div className="band__head">
              <h2 id="code-h">Repositories gaining stars</h2>
              <p>AI projects created on GitHub in the past 30 days, ranked by stars gained per day.</p>
            </div>
            <ol className="list">
              {latest.repos.slice(0, SHOWN).map((r) => (
                <li key={r.name}>
                  <a href={r.url}>{r.name}</a>
                  {r.description && <p className="list__desc">{r.description}</p>}
                  <p className="list__meta">
                    {fmtCompact(r.starsPerDay)} stars a day · {fmtCompact(r.stars)} total
                    {r.language && <> · {r.language}</>} · created {fmtDay(r.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
            <a className="more" href="https://github.com/trending">
              More on GitHub →
            </a>
          </section>

          <section id="models" className="band" aria-labelledby="models-h">
            <div className="band__head">
              <h2 id="models-h">Models trending</h2>
              <p>What builders are picking up on Hugging Face right now.</p>
            </div>
            <ol className="list list--tight">
              {latest.models.slice(0, SHOWN).map((m) => (
                <li key={m.id}>
                  <a href={m.url}>{m.id}</a>
                  <p className="list__meta">
                    {m.task ? `${m.task.replaceAll("-", " ")} · ` : ""}
                    {fmtCompact(m.likes)} likes · {fmtCompact(m.downloads)} downloads
                  </p>
                </li>
              ))}
            </ol>

            <div className="band__head band__head--sub">
              <h2 id="labs-h">New from the labs</h2>
              <p>Open models published by major AI labs in the past 45 days, by likes.</p>
            </div>
            <ol className="list list--tight" aria-labelledby="labs-h">
              {latest.releases.slice(0, SHOWN).map((m) => (
                <li key={m.id}>
                  <a href={m.url}>{m.id}</a>
                  <p className="list__meta">
                    {m.task ? `${m.task.replaceAll("-", " ")} · ` : ""}
                    {fmtCompact(m.likes)} likes · released {fmtDay(m.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
            <a className="more" href="https://huggingface.co/models?sort=trending">
              More models →
            </a>
          </section>
        </div>

        <section id="method" className="band method" aria-labelledby="method-h">
          <div className="band__head">
            <h2 id="method-h">How this is measured</h2>
          </div>
          <div className="method__body">
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
                A topic is called rising or cooling when its paper share moved by at least 10% between the two
                four-week windows. Topics are defined by keyword lists, so a paper can count toward several topics,
                and work that uses unfamiliar wording is missed. Small topics swing more easily, so the headline only
                names topics averaging at least {HEADLINE_MIN_PAPERS} papers a week.
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
              <p>
                <strong>From the analysts</strong> lists the newest pieces from a fixed set of ten newsletters and
                research institutions, at most two from each, from the past 30 days. It is a reading list chosen
                by the editor, not a ranking. Publishers that cover other subjects are filtered to pieces that
                mention AI.
              </p>
            </div>
            <div className="sources">
              <h3>Source status</h3>
              <ul>
                {Object.entries(latest.sources).map(([key, s]) => (
                  <li key={key}>
                    <span className={s.ok ? "status status--ok" : "status status--fail"}>
                      <span aria-hidden="true">{s.ok ? "●" : "▲"}</span> {s.ok ? "Current" : "Stale"}
                    </span>
                    <span>{SOURCE_LABELS[key] ?? key}</span>
                    <span className="sources__when">{s.at ? fmtDay(s.at) : "never"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
