import Link from "next/link";
import { DataIndex } from "@/components/DataIndex";
import { HorizonSwitch } from "@/components/HorizonSwitch";
import { LeadChart } from "@/components/LeadChart";
import { Ledger } from "@/components/Ledger";
import { Logo } from "@/components/Logo";
import { MoreRows } from "@/components/MoreRows";
import { Bar, extentOf } from "@/components/MomentumBars";
import { type Product } from "@/lib/products";
import { PageTabs } from "@/components/PageTabs";
import { Colophon } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { ThemeRow } from "@/components/ThemeRow";
import { buildBriefing } from "@/lib/briefing";
import { topicsHref } from "@/lib/datasets";
import { lineFor } from "@/lib/editorial";
import { editorial } from "@/lib/today";
import { NEW_TAB, host } from "@/lib/links";
import { NOISE_MULTIPLE } from "@/lib/noise";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  SUBTHEME_MIN_STORIES,
  PRODUCT_MIN_STORIES,
  THEME_STEADY_BAND,
  buildTrends,
  fmtCompact,
  fmtDate,
  fmtDay,
  fmtWeek,
  history,
  latest,
  type Direction,
  type Horizon,
  type Signal,
} from "@/lib/trends";

import { ADOPTION_WINDOW, USAGE_WINDOW, adoption as adoptionSummary, buildMarketShare, federal, fmtMonth, indicators, jobs, releases, usage as usageSummary } from "@/lib/indicators";


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

/** The reading list's sections, which were on this page before it had its own; old links to them still land. */
const MOVED_ANCHORS = ["today", "reading", "news", "papers", "analysis", "announcements", "launches", "code", "models", "labs"];

const THEME_GROUPS:{ direction: Direction; title: string }[] = [
  { direction: "rising", title: "Rising" },
  { direction: "steady", title: "Steady" },
  { direction: "cooling", title: "Cooling" },
];

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
 * The figure cells of a theme or sub-theme row: the change in its share of AI stories as a bar,
 * the share now, then stories a week. With too few stories to judge, the bar is outlined.
 */
function ThemeCells({
  name,
  share,
  stories,
  extent,
  enough = true,
  weight,
}: {
  name: string;
  share: Signal;
  stories: Signal;
  extent: number;
  enough?: boolean;
  /** The share beside the largest theme's, 0 to 1; sets the bar's thickness. */
  weight: number;
}) {
  return (
    <>
      <Bar
        signal={share}
        extent={extent}
        firm={enough}
        weight={weight}
        band={THEME_STEADY_BAND}
        label="Share"
        tip={`${name}: ${share.recent.toFixed(1)}% of AI stories, was ${share.prior.toFixed(1)}%${enough ? "" : " (too few stories to call)"}`}
        level={<>{share.recent.toFixed(1)}%<span className="vh"> of AI stories</span></>}
      />
      <PerWeek value={stories.recent} />
    </>
  );
}

const PRODUCT_GROUPS: { kind: Product["kind"]; title: string }[] = [
  { kind: "assistant", title: "Assistants" },
  { kind: "coding", title: "Coding tools and agents" },
  { kind: "media", title: "Image, video and voice" },
  { kind: "device", title: "Devices" },
  { kind: "robot", title: "Robots and driverless cars" },
];

/** The whole dashboard, read over one time horizon. The routes differ only in this prop. */
export function Dashboard({ horizon }: { horizon: Horizon }) {
  const trends = buildTrends(horizon);
  const { window: WINDOW, weeks, themeTrends, productTrends, hasThemes, hasProducts } = trends;
  const { headline, lead, briefing } = buildBriefing(trends);
  const compared =
    WINDOW === 1
      ? "latest week compared with the week before"
      : `last ${WINDOW} weeks compared with the ${WINDOW} weeks before`;
  const latestWeek = weeks.at(-1);
  /** Themes numbered in the order shown, biggest rise in share first. */
  /** Largest share of AI stories first; a theme's bar is as thick as its share beside the largest. */
  const themeRows = THEME_GROUPS.flatMap((group) =>
    themeTrends.filter((t) => t.direction === group.direction).sort((a, b) => b.share.recent - a.share.recent),
  ).map((t, i) => ({ t, rank: i + 1 }));
  const topThemeShare = Math.max(...themeTrends.map((t) => t.share.recent), 0) || 1;
  /** One scale for every theme bar; sub-themes with too few stories do not stretch it. */
  const themeExtent = extentOf(
    themeTrends.flatMap((t) => [t.share.change, ...t.parts.filter((part) => part.enough).map((part) => part.share.change)]),
  );
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

  /** One bar scale per list, set by its largest change. */
  const indicatorExtent = extentOf([jobs, federal, releases].map((x) => x?.signal.change ?? null));
  const adoptionExtent = extentOf(adoptionRows.map((row) => row.signal.change));
  const usageExtent = extentOf((usage?.toolkits ?? []).map((t) => t.share.change));
  const marketExtent = extentOf((marketShare?.makers ?? []).map((m) => m.share.change));

  /** Products in their groups, numbered down the page; within a group, most discussed first. */
  const productRows = PRODUCT_GROUPS.flatMap((group) => productTrends.filter((p) => p.kind === group.kind)).map(
    (p, i) => ({ p, rank: i + 1 }),
  );
  const productStoryExtent = extentOf(productTrends.filter((p) => p.enough).map((p) => p.stories.change));
  const productViewExtent = extentOf(productTrends.map((p) => p.views?.change ?? null));

  const editorLine = lineFor(editorial, latest.generatedAt.slice(0, 10));
  const sources = Object.entries(latest.sources);
  const stale = sources.filter(([, src]) => !src.ok).length;
  const oldest = sources.map(([, src]) => src.at).filter(Boolean).sort()[0];

  return (
    <>
      <a className="skip" href="#data">
        Skip to the data
      </a>

      <header className="mast">
        <div className="mast__top">
          <PageTabs current="trends" />
          <p className="mast__line">
            {latestWeek ? `Week of ${fmtWeek(latestWeek)}` : "First edition in preparation"}
          </p>
        </div>
        <h1 className="mast__name">
          <Logo className="mast__mark" />
          AI Trend Tracker
        </h1>
      </header>

      <div className="bar">
        <div className="bar__inner">
          <div className="bar__row">
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
              <p className="lede__meta">
                Updated {fmtDate(latest.generatedAt)}
                {papersLastWeek > 0 && <> · {papersLastWeek.toLocaleString("en")} AI papers reached arXiv last week</>}
                {" · "}Showing {HORIZONS[horizon].label}: charts cover {weeks.length} weeks, and each change is the {compared}.
              </p>
            </div>
          </div>
          {editorLine && (
            <p className="lede__note">
              <span>Editor’s note</span> {editorLine}
            </p>
          )}
          <LeadChart
            series={lead}
            window={WINDOW}
            weeks={weeks}
            events={(indicators.releases?.log ?? []).map((r) => ({ date: r.date, label: r.model, url: r.url }))}
          />
          {lead.length > 0 && (
            <SourceLine names="arXiv (research); Hacker News story titles (discussion)" keys={["arxivHistory", "hnThemes"]} />
          )}
          {briefing.length > 0 && (
            <div className="brief">
              <ol aria-label="The week in numbers">
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

        <p className="moved">
          {/* Today's news and the reading list's sections were on this page; links to them land here, beside the way to each. */}
          {MOVED_ANCHORS.map((id) => (
            <span key={id} id={id} />
          ))}
          The past day’s stories are in <Link href="/today">today’s AI news →</Link> The week’s top stories, papers,
          essays, launches, code and models are in <Link href="/reading">the reading list →</Link>
        </p>

        <DataIndex horizon={horizon} />

        <section className="chapter" aria-labelledby="trends-h">
          <header className="chapter__head">
            <p className="chapter__title" id="trends-h">The trends</p>
            <p className="chapter__dek">What is rising and what is cooling in discussion on Hacker News.</p>
          </header>

        <section id="themes" className="band" aria-labelledby="themes-h">
          <div className="band__head">
            <h2 id="themes-h">Economy and society themes</h2>
            <p>
              What Hacker News is saying AI is doing to work, companies and society. Its readers are mostly
              technologists, so this is one community’s conversation, not public opinion. Each theme’s share of
              Hacker News stories with AI in the title, {compared}. Select a theme to see the sub-themes inside it.
            </p>
          </div>

          {hasThemes ? (
            <>
              <div className="mom mom--themes">
                <div className="trend-cols" aria-hidden="true">
                  <span>Theme</span>
                  <span>Share of AI stories <i>by week, change, now</i></span>
                  <span>Stories</span>
                </div>
                {THEME_GROUPS.map((group) => {
                  const members = themeRows.filter(({ t }) => t.direction === group.direction);
                  if (members.length === 0) return null;
                  return (
                    <section key={group.direction} className="mom__group">
                      <h3>
                        {group.title} <span>{members.length}</span>
                      </h3>
                      <ol start={members[0].rank}>
                        {members.map(({ t, rank }) => (
                          <ThemeRow
                            key={t.id}
                            rank={rank}
                            name={t.name}
                            blurb={t.blurb}
                            count={t.parts.length}
                            cells={<ThemeCells name={t.name} share={t.share} stories={t.stories} extent={themeExtent} weight={t.share.recent / topThemeShare} />}
                          >
                            {t.parts.map((part) => (
                              <li key={part.id} className="mom__row mom__row--theme mom__row--sub">
                                <div className="mom__topic">
                                  <span className="mom__rank" aria-hidden="true" />
                                  <h5>{part.name}</h5>
                                  <p className="mom__blurb">Titles matching: {part.searches.join(", ")}</p>
                                </div>
                                <ThemeCells
                                  name={`${t.name}, ${part.name}`}
                                  share={part.share}
                                  stories={part.stories}
                                  extent={themeExtent}
                                  enough={part.enough}
                                  weight={part.share.recent / topThemeShare}
                                />
                              </li>
                            ))}
                          </ThemeRow>
                        ))}
                      </ol>
                    </section>
                  );
                })}
                <p className="mom__note">
                  Largest themes first. Line: the weeks charted, from zero. Bar: length is the change (to ±
                  {Math.round(themeExtent * 100)}%), thickness is the theme’s size. Grey: under{" "}
                  {THEME_STEADY_BAND * 100}%, or within the theme’s usual weekly swing.
                  {themeTrends.some((t) => t.parts.some((part) => !part.enough)) && (
                    <>
                      {" "}
                      <span className="mom__swatch" aria-hidden="true" /> Outlined bars are sub-themes with fewer than{" "}
                      {SUBTHEME_MIN_STORIES} stories a week; read them with care.
                    </>
                  )}
                </p>
              </div>

              <SourceLine names="Hacker News story titles" keys={["hnThemes"]} />
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

        {hasProducts && (
          <section id="products" className="band" aria-labelledby="products-h">
            <div className="band__head">
              <h2 id="products-h">Product momentum</h2>
              <p>
                {productTrends.length} AI products people use, from chat assistants to glasses and robots, measured two ways: stories naming the product on
                Hacker News, which shows what developers are talking about, and views of its Wikipedia article,
                which shows how many people are looking it up. Each is the {compared}.
              </p>
            </div>

            <div className="mom">
              <div className="trend-cols" aria-hidden="true">
                <span>Product</span>
                <span>Discussion <i>change in Hacker News stories, now</i></span>
                <span>Public interest <i>change in Wikipedia views, now</i></span>
              </div>
              {PRODUCT_GROUPS.map((group) => {
                const members = productRows.filter(({ p }) => p.kind === group.kind);
                if (members.length === 0) return null;
                return (
                  <section key={group.kind} className="mom__group">
                    <h3>
                      {group.title} <span>{members.length}</span>
                    </h3>
                    <MoreRows count={members.length} noun="products">
                      {members.map(({ p, rank }) => {
                        const views = p.views;
                        return (
                          <li key={p.id} className="mom__row">
                            <div className="mom__topic">
                              <span className="mom__rank">{rank}</span>
                              <h4>{p.name}</h4>
                              <p className="mom__blurb">
                                {p.blurb}
                                {/* How it is counted is said only where the name alone does not say it. */}
                                {(p.searches.join() !== p.name || p.except.length > 0) && (
                                  <>
                                    . Counted: titles containing {p.searches.join(", ")}
                                    {p.except.length > 0 && `, but not ${p.except.join(", ")}`}
                                  </>
                                )}
                              </p>
                            </div>
                            <Bar
                              signal={p.enough ? p.stories : { ...p.stories, change: null }}
                              extent={productStoryExtent}
                              firm
                              band={THEME_STEADY_BAND}
                              label="Discussion"
                              note="too few to call"
                              tip={`${p.name}: ${p.stories.recent.toFixed(1)} Hacker News stories a week, was ${p.stories.prior.toFixed(1)}${p.enough ? "" : " (too few stories to call)"}`}
                              level={
                                <>
                                  {Math.round(p.stories.recent)}
                                  <span aria-hidden="true">/wk</span>
                                  <span className="vh"> stories a week</span>
                                </>
                              }
                            />
                            {views ? (
                              <Bar
                                signal={views}
                                extent={productViewExtent}
                                firm
                                label="Interest"
                                note="new article"
                                tip={`${p.name}: ${Math.round(views.recent).toLocaleString("en")} Wikipedia views a day, was ${Math.round(views.prior).toLocaleString("en")}`}
                                level={
                                  <>
                                    {fmtCompact(Math.round(views.recent))}
                                    <span aria-hidden="true">/day</span>
                                    <span className="vh"> views a day</span>
                                  </>
                                }
                              />
                            ) : (
                              <p className="mom__pending">No article of its own</p>
                            )}
                          </li>
                        );
                      })}
                    </MoreRows>
                  </section>
                );
              })}
              <p className="mom__note">
                Each group shows its five most discussed products first. Bars run to ±{Math.round(productStoryExtent * 100)}%
                (discussion) and ±{Math.round(productViewExtent * 100)}% (interest). Grey: too small to call, or within
                the product’s usual weekly swing. Under {PRODUCT_MIN_STORIES} stories a week, discussion is not called.
              </p>
              <SourceLine names="Hacker News story titles (discussion); Wikipedia page views (public interest)" keys={["hnProducts", "wikiProducts"]} />
            </div>
          </section>
        )}

        <section className="chapter" aria-labelledby="evidence-h">
          <header className="chapter__head">
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
            <span>Change <i>and latest reading</i></span>
            <span>Compared with</span>
          </div>
          <ol className="mom__list">
            {jobs && (
              <li className="mom__row mom__row--plain">
                <div className="mom__topic">
                  <h3>AI share of US job postings</h3>
                  <p className="mom__blurb">
                    Postings on Indeed that ask for AI skills, as of {fmtDate(jobs.asOf)}. The data is refreshed
                    monthly.
                  </p>
                </div>
                <Bar
                  signal={jobs.signal}
                  extent={indicatorExtent}
                  firm
                  label="Change"
                  tip={`Share of US job postings on Indeed asking for AI skills: ${jobs.signal.recent.toFixed(1)}%, was ${jobs.signal.prior.toFixed(1)}% a year earlier`}
                  level={<>{jobs.signal.recent.toFixed(1)}%</>}
                />
                <p className="trend__context">
                  {jobs.signal.prior.toFixed(1)}% a year earlier ·{" "}
                  Source: <a href="https://github.com/hiring-lab/ai-tracker" {...NEW_TAB}>Indeed Hiring Lab</a>, each
                  month’s last reading, licensed{" "}
                  <a href="https://creativecommons.org/licenses/by/4.0/" {...NEW_TAB}>CC BY 4.0</a>
                </p>
              </li>
            )}

            {federal && (
              <li className="mom__row mom__row--plain">
                <div className="mom__topic">
                  <h3>US federal documents mentioning AI</h3>
                  <p className="mom__blurb">
                    Rules, proposed rules and notices whose text includes “artificial intelligence”. A mention can be
                    brief, so this shows attention, not regulation.
                  </p>
                </div>
                <Bar
                  signal={federal.signal}
                  extent={indicatorExtent}
                  firm
                  label="Change"
                  tip={`Federal Register documents mentioning artificial intelligence: ${federal.signal.recent} in ${fmtMonth(federal.latestMonth)}, was ${federal.signal.prior} a year earlier`}
                  level={<>{federal.signal.recent}</>}
                />
                <p className="trend__context">
                  {federal.signal.prior} a year earlier, in {fmtMonth(federal.latestMonth)} ·{" "}
                  <a href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22artificial+intelligence%22" {...NEW_TAB}>
                    Federal Register
                  </a>
                </p>
              </li>
            )}

            {releases && (
              <li className="mom__row mom__row--plain">
                <div className="mom__topic">
                  <h3>Frontier model releases</h3>
                  <p className="mom__blurb">
                    New version numbers from Anthropic, Google DeepMind and OpenAI in the last 90 days. Latest:{" "}
                    {releases.shown.slice(0, 3).map((r) => `${r.model} (${fmtDay(r.date)})`).join(", ")}.
                  </p>
                </div>
                <Bar
                  signal={releases.signal}
                  extent={indicatorExtent}
                  firm
                  label="Change"
                  tip={`New model versions from Anthropic, Google DeepMind and OpenAI: ${releases.signal.recent} in the last 90 days, ${releases.signal.prior} in the 90 days before`}
                  level={<>{releases.signal.recent}</>}
                />
                <p className="trend__context">{releases.signal.prior} in the 90 days before</p>
              </li>
            )}
          </ol>

          <SourceLine names="Indeed Hiring Lab; Federal Register; the labs’ own release announcements" keys={["jobs", "federal", "modelReleases"]} />
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
                          <a href={r.url} {...NEW_TAB}>{r.model}</a>
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
              <span>Change <i>and recent average</i></span>
              <span>Compared with</span>
            </div>
            <ol className="mom__list">
              {adoptionRows.map((row) => (
                <li key={row.id} className="mom__row mom__row--plain">
                  <div className="mom__topic">
                    <h3>{row.name}</h3>
                    <p className="mom__blurb">{row.blurb}</p>
                  </div>
                  <Bar
                    signal={row.signal}
                    extent={adoptionExtent}
                    firm
                    label="Change"
                    note="too little history"
                    tip={`${row.name}: ${row.signal.recent.toFixed(1)}% of businesses over the last ${ADOPTION_WINDOW} surveys${row.signal.change === null ? "" : `, was ${row.signal.prior.toFixed(1)}% over the ${ADOPTION_WINDOW} before`}`}
                    level={<>{row.signal.recent.toFixed(1)}%<span className="vh"> of businesses, average of the last {ADOPTION_WINDOW} surveys</span></>}
                  />
                  <p className="trend__context">
                    {row.signal.change !== null && `${row.signal.prior.toFixed(1)}% over the ${ADOPTION_WINDOW} surveys before · `}
                    {row.latest.toFixed(1)}% in the latest ·{" "}
                    <a href="https://www.census.gov/hfp/btos/data_downloads" {...NEW_TAB}>Census Bureau</a>
                  </p>
                </li>
              ))}
            </ol>

            <SourceLine names="US Census Bureau, Business Trends and Outlook Survey" keys={["business"]} />
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
                <li key={t.id} className="mom__row mom__row--plain">
                  <div className="mom__topic">
                    <h3>{t.name}</h3>
                    <p className="mom__blurb">{t.blurb}.</p>
                  </div>
                  <Bar
                    signal={t.share}
                    extent={usageExtent}
                    firm
                    label="Share"
                    note="too little history"
                    tip={`${t.name}: ${t.share.recent.toFixed(1)}% of tracked toolkit downloads over the last ${USAGE_WINDOW} months${t.share.change === null ? "" : `, was ${t.share.prior.toFixed(1)}% over the ${USAGE_WINDOW} before`}`}
                    level={<>{t.share.recent.toFixed(1)}%<span className="vh"> of downloads</span></>}
                  />
                  <p className="trend__context">
                    {fmtCompact(t.downloads)} in {fmtMonth(usage.latestMonth)} ·{" "}
                    {t.kind === "lab" ? "lab toolkit" : "building tool"}
                  </p>
                </li>
              ))}
            </MoreRows>

            <SourceLine names="npm and PyPI Stats download counts" keys={["downloads"]} />
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
                <li key={m.id} className="mom__row mom__row--plain">
                  <div className="mom__topic">
                    <h3>{m.name}</h3>
                  </div>
                  <Bar
                    signal={m.share}
                    extent={marketExtent}
                    firm
                    label="Share"
                    note="not always in the top nine"
                    tip={`${m.name}: ${m.share.recent.toFixed(1)}% of tokens on OpenRouter${m.share.change === null ? "" : `, was ${m.share.prior.toFixed(1)}%`}`}
                    level={<>{m.share.recent.toFixed(1)}%<span className="vh"> of tokens</span></>}
                  />
                  <p className="trend__context">{fmtCompact(m.tokens)} in the latest week</p>
                </li>
              ))}
            </MoreRows>
            <p className="trend__context">
              Other makers together: {marketShare.otherShare.toFixed(1)}% in the latest week ·{" "}
              {WINDOW === 1 ? "latest week compared with the week before" : `last ${WINDOW} weeks compared with the ${WINDOW} before`} ·
              Source: <a href="https://openrouter.ai/rankings" {...NEW_TAB}>OpenRouter (openrouter.ai/rankings)</a>, as of{" "}
              {fmtDate(marketShare.asOf)}. Licensed under{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" {...NEW_TAB}>CC BY 4.0</a>.
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
                <strong>Topic momentum</strong>, a topic’s share of AI papers on arXiv and its stories on Hacker
                News, is explained beside its figures on <Link href={`${topicsHref(horizon)}#counted`}>its own page</Link>,
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
                with this many topics, an occasional call will still be chance. The switch at the top sets those windows, and the colours carry no judgement: blue marks a rise and amber a fall. <strong>1 week</strong> compares
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
                <strong>The editor’s step.</strong> The editor can leave a link out of every list on the site;
                each is kept in a file in the project’s repository, with a reason.{" "}
                {editorial.hide.length === 0
                  ? "Nothing is left out today."
                  : `Today ${editorial.hide.length} ${editorial.hide.length === 1 ? "link is" : "links are"} left out.`}{" "}
                The past day’s stories, and how they are ranked, are on <Link href="/today">Today’s news</Link>.
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
          </details>
        </section>
      </main>

      <Colophon />
    </>
  );
}
