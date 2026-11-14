import Link from "next/link";
import countedJson from "../../data/counted.json";
import { CountedFoot, countedId } from "@/components/Counted";
import { DataIndex } from "@/components/DataIndex";
import { HorizonSwitch } from "@/components/HorizonSwitch";
import { LeadChart } from "@/components/LeadChart";
import { MoreRows } from "@/components/MoreRows";
import { TrackRecord } from "@/components/TrackRecord";
import { Bar, extentOf } from "@/components/MomentumBars";
import { type Product } from "@/lib/products";
import { Colophon, SiteMast } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { ThemeRow } from "@/components/ThemeRow";
import { buildBriefing, type LeadSeries } from "@/lib/briefing";
import { countedFor, latestSpan, seriesOf, type CountedFile } from "@/lib/counted";
import { lineFor } from "@/lib/editorial";
import { editorial } from "@/lib/today";
import { NEW_TAB } from "@/lib/links";
import {
  HORIZONS,
  SUBTHEME_MIN_STORIES,
  PRODUCT_MIN_STORIES,
  STEADY_BAND,
  THEME_STEADY_BAND,
  buildTrends,
  signalDirection,
  fmtCompact,
  fmtDate,
  fmtDay,
  fmtWeek,
  history,
  latest,
  type Direction,
  type Horizon,
  type ProductTrend,
  type Signal,
} from "@/lib/trends";

import { ADOPTION_WINDOW, USAGE_WINDOW, adoption as adoptionSummary, buildMarketShare, federal, fmtMonth, indicators, jobs, releases, usage as usageSummary } from "@/lib/indicators";

/** The stories and papers kept under the rising moves the headlines name (scripts/collect.ts writes it each day). */
const counted = countedJson as unknown as CountedFile;

/** The lead chart each briefing line speaks for. */
const LEAD_OF: Record<string, string> = { Research: "Research", "Hacker News": "Hacker News discussion" };

/** The reading list's sections, which were on this page before it had its own; old links to them still land. */
const MOVED_ANCHORS = ["today", "reading", "news", "papers", "analysis", "announcements", "launches", "code", "models", "labs"];

/** Called themes first, open; the steady ones last, in one fold. */
const THEME_GROUPS:{ direction: Direction; title: string }[] = [
  { direction: "rising", title: "Rising" },
  { direction: "cooling", title: "Cooling" },
  { direction: "steady", title: "Steady" },
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
  const { window: WINDOW, weeks, topicTrends, themeTrends, productTrends, hasThemes, hasProducts } = trends;
  const { headline, lead, briefing } = buildBriefing(trends);
  /** What was counted under each rising lead chart, if it was collected over the window shown. */
  const span = latestSpan(weeks, WINDOW);
  const countedOf = (s: LeadSeries) =>
    s.direction === "rising" ? countedFor(counted, horizon, seriesOf(s.measure), s.id, span) : null;
  /** How many stories or papers the window's counts hold for a lead chart's series. */
  const matchedIn = (s: LeadSeries) =>
    (seriesOf(s.measure) === "topic"
      ? (topicTrends.find((t) => t.id === s.id)?.paperCounts ?? [])
      : (themeTrends.find((t) => t.id === s.id)?.stories.values ?? [])
    )
      .slice(-WINDOW)
      .reduce((a, b) => a + b, 0);
  const feet = Object.fromEntries(
    lead.map((s) => [s.measure, <CountedFoot key={s.measure} s={s} move={countedOf(s)} matched={matchedIn(s)} window={WINDOW} />]),
  );
  /** The kinds of call today's headline makes, so the track record can mark them. */
  const researchCall = lead.find((s) => s.measure === "Research")?.direction;
  const headlineCalls = {
    topic: researchCall === "steady" ? undefined : researchCall,
    theme: lead.some((s) => s.measure !== "Research"),
  };
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

  /** A product with a rise or fall called on either measure, the same test that colours its bars. */
  const productCalled = (p: ProductTrend) =>
    (p.enough && signalDirection(p.stories, THEME_STEADY_BAND) !== "steady") ||
    (p.views !== null && signalDirection(p.views, STEADY_BAND) !== "steady");
  /**
   * Products in their groups, numbered down the page; within a group, those with a called move
   * first, open, and the rest after them in one fold; most discussed first within each.
   */
  const productRows = PRODUCT_GROUPS.flatMap((group) => {
    const members = productTrends.filter((p) => p.kind === group.kind);
    return [...members.filter(productCalled), ...members.filter((p) => !productCalled(p))];
  }).map((p, i) => ({ p, rank: i + 1, called: productCalled(p) }));
  const productStoryExtent = extentOf(productTrends.filter((p) => p.enough).map((p) => p.stories.change));
  const productViewExtent = extentOf(productTrends.map((p) => p.views?.change ?? null));

  const editorLine = lineFor(editorial, latest.generatedAt.slice(0, 10));

  return (
    <>
      <a className="skip" href="#data">
        Skip to the data
      </a>

      <SiteMast
        heading
        current="trends"
        line={latestWeek ? `Updated ${fmtDate(latest.generatedAt)}` : "First edition in preparation"}
      />

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
            <div className="lede__text">
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
                  {latestWeek && <>Latest week: {fmtWeek(latestWeek)}</>}
                  {papersLastWeek > 0 && <> · {papersLastWeek.toLocaleString("en")} AI papers reached arXiv that week</>}
                  {" · "}Showing {HORIZONS[horizon].label}: charts cover {weeks.length} weeks, and each change is the {compared}.
                </p>
              </div>
            </div>
            <TrackRecord horizon={horizon} headline={headlineCalls} />
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
            feet={feet}
          />
          {lead.length > 0 && (
            <SourceLine names="arXiv (research); Hacker News story titles (discussion)" keys={["arxivHistory", "hnThemes"]} />
          )}
          {briefing.length > 0 && (
            <div className="brief">
              <ol aria-label="The week in numbers">
                {briefing.map((line) => {
                  // A rise with its list under the chart above points down to it.
                  const s = lead.find((l) => l.measure === LEAD_OF[line.label]);
                  const move = s && countedOf(s);
                  const n = move ? ("stories" in move ? move.stories.length : move.papers.length) : 0;
                  const list = s && move ? `#${countedId(s)}` : null;
                  return (
                    <li key={line.label}>
                      {/* The research label keeps its own page; the discussion label's row is further down this one. */}
                      <a className="brief__label" href={list && line.label === "Hacker News" ? list : line.href}>{line.label}</a>
                      <span className="brief__figure">{line.figure}</span>
                      <p>{line.text}</p>
                      {list && move && (
                        <a className="brief__counted" href={list}>
                          {"stories" in move ? `${n} ${n === 1 ? "story" : "stories"} counted` : `${n} example ${n === 1 ? "paper" : "papers"}`}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        <p className="moved">
          {/* Today's news and the reading list's sections were on this page; links to them land here, beside the way to each. */}
          {MOVED_ANCHORS.map((id) => (
            <span key={id} id={id} />
          ))}
          The past day’s stories are in <Link href="/">today’s AI news →</Link> The week’s top stories, papers,
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
                  const section = (
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
                  if (group.direction !== "steady") return section;
                  // Native, with no script: a browser opens it to follow a link to anything inside.
                  return (
                    <details key={group.direction} className="table-view fold">
                      <summary>
                        {members.length} steady {members.length === 1 ? "theme" : "themes"}{" "}
                        <span>· none moved {THEME_STEADY_BAND * 100}% or more, clear of its usual swing</span>
                      </summary>
                      {section}
                    </details>
                  );
                })}
                <p className="mom__note">
                  Called themes first, largest first; steady ones are folded. Line: the weeks charted, from zero. Bar: length is the change (to ±
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

            {/* The key sits above the bars it explains, so a grey +55% beside a blue +19% reads at once. */}
            <p className="mom__key">
              <span>
                <i className="mom__chip mom__chip--rising" aria-hidden="true" />
                Rising
              </span>
              <span>
                <i className="mom__chip mom__chip--cooling" aria-hidden="true" />
                Cooling
              </span>
              <span>
                <i className="mom__chip" aria-hidden="true" />
                Grey: too small to call, or within the product’s usual weekly swing
              </span>
            </p>

            <div className="mom">
              <div className="trend-cols" aria-hidden="true">
                <span>Product</span>
                <span>Discussion <i>change in Hacker News stories, now</i></span>
                <span>Public interest <i>change in Wikipedia views, now</i></span>
              </div>
              {PRODUCT_GROUPS.map((group) => {
                const members = productRows.filter(({ p }) => p.kind === group.kind);
                if (members.length === 0) return null;
                const open = members.filter((m) => m.called);
                const quiet = members.filter((m) => !m.called);
                const rows = (list: typeof members) => list.map(({ p, rank }) => {
                        const views = p.views;
                        return (
                          <li key={p.id} id={`product-${p.id}`} className="mom__row">
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
                      });
                return (
                  <section key={group.kind} className="mom__group">
                    <h3>
                      {group.title} <span>{members.length}</span>
                    </h3>
                    {open.length > 0 && <ol className="mom__list">{rows(open)}</ol>}
                    {quiet.length > 0 && (
                      // Native, with no script: a browser opens it to follow a link such as /#product-grok.
                      <details className="table-view fold">
                        <summary>
                          {quiet.length} steady or too few to call{" "}
                          <span>· {quiet.map(({ p }) => p.name).join(", ")}</span>
                        </summary>
                        <ol className="mom__list">{rows(quiet)}</ol>
                      </details>
                    )}
                  </section>
                );
              })}
              <p className="mom__note">
                Products with a rise or fall called on either measure are open; the rest of each group is folded. Bars run to ±{Math.round(productStoryExtent * 100)}%
                (discussion) and ±{Math.round(productViewExtent * 100)}% (interest). Under {PRODUCT_MIN_STORIES} stories
                a week, discussion is not called.
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
        {/* How this is measured closed this page before it had a page of its own; an old #method link lands at the foot, by the link to it. */}
        <span id="method" />
      </main>

      <Colophon />
    </>
  );
}
