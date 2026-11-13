import { HorizonSwitch } from "@/components/HorizonSwitch";
import { LeadChart } from "@/components/LeadChart";
import { Ledger } from "@/components/Ledger";
import { Logo } from "@/components/Logo";
import { MoreRows } from "@/components/MoreRows";
import { Bar, MomentumBars, extentOf } from "@/components/MomentumBars";
import { type Product } from "@/lib/products";
import { PageTabs } from "@/components/PageTabs";
import { ThemeRow } from "@/components/ThemeRow";
import { buildBriefing } from "@/lib/briefing";
import { isBigStory, lineFor, visible } from "@/lib/editorial";
import { buildToday, editorial } from "@/lib/today";
import { NEW_TAB } from "@/lib/links";
import { SITE_AUTHOR, SITE_ISSUES_URL } from "@/lib/site";
import { NOISE_MULTIPLE } from "@/lib/noise";
import {
  HEADLINE_MIN_PAPERS,
  HORIZONS,
  MAP_MIN_STORIES,
  SUBTHEME_MIN_STORIES,
  PRODUCT_MIN_STORIES,
  THEME_STEADY_BAND,
  buildTrends,
  fmtCompact,
  fmtDate,
  fmtDay,
  fmtDayTime,
  fmtWeek,
  history,
  latest,
  type Direction,
  type Horizon,
  type Signal,
} from "@/lib/trends";

import { ADOPTION_WINDOW, USAGE_WINDOW, adoption as adoptionSummary, buildMarketShare, federal, fmtMonth, indicators, jobs, releases, usage as usageSummary } from "@/lib/indicators";

const SHOWN = 10;


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

const THEME_GROUPS: { direction: Direction; title: string }[] = [
  { direction: "rising", title: "Rising" },
  { direction: "steady", title: "Steady" },
  { direction: "cooling", title: "Cooling" },
];

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The line under a chart or list that says where its figures come from and when they were last
 * collected, so no reader has to go to the foot of the page to find out. When the latest update
 * of a source failed, the line says so and gives the day of the data being shown.
 */
function SourceLine({ names, keys }: { names: string; keys: string[] }) {
  const status = keys.map((key) => latest.sources[key]).filter((src) => src !== undefined);
  const failed = status.some((src) => !src.ok);
  const oldest = status.map((src) => src.at).filter(Boolean).sort()[0];
  return (
    <p className="source">
      <b>{names.includes(";") ? "Sources" : "Source"}:</b> {names}.
      {oldest && (failed ? ` The latest update failed; this is the data of ${fmtDay(oldest)}.` : ` Collected ${fmtDay(oldest)}.`)}
    </p>
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
  const { window: WINDOW, weeks, topicTrends, rankedTopics, themeTrends, productTrends, hasHistory, hasThemes, hasProducts } = trends;
  const { headline, lead, briefing } = buildBriefing(trends);
  const compared =
    WINDOW === 1
      ? "latest week compared with the week before"
      : `last ${WINDOW} weeks compared with the ${WINDOW} weeks before`;
  const latestWeek = weeks.at(-1);
  /** Topics with enough papers a week for a change in their share to be trusted. */
  const papersFirm = new Set(rankedTopics.map((t) => t.id));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
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
  const todayRows = bigDay ? rest : today.items;
  const editorLine = lineFor(editorial, latest.generatedAt.slice(0, 10));
  // The editor's hides apply to every ranked list, before it is cut to length.
  const stories = visible(latest.stories, editorial).slice(0, SHOWN);
  const papers = visible(latest.papers, editorial).slice(0, SHOWN);
  const repos = visible(latest.repos, editorial).slice(0, SHOWN);
  const launches = visible(latest.launches ?? [], editorial).slice(0, SHOWN);
  const models = visible(latest.models, editorial).slice(0, SHOWN);
  const labModels = visible(latest.releases, editorial).slice(0, SHOWN);
  const analysis = (latest.analysis ?? []).slice(0, SHOWN);
  const labNews = latest.labNews ?? []; // all of it: the collector already keeps this list short
  const sources = Object.entries(latest.sources);
  const stale = sources.filter(([, src]) => !src.ok).length;
  const oldest = sources.map(([, src]) => src.at).filter(Boolean).sort()[0];

  return (
    <>
      <a className="skip" href="#momentum">
        Skip to the trends
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

        <section id="today" className="band band--today" aria-labelledby="today-h">
          <div className="band__head">
            <h2 id="today-h">Today’s AI news</h2>
            <p>
              What the labs announced, what the analysts published and which AI stories Hacker News picked up in the
              24 hours before this page was last updated. The biggest stories come first, by points on Hacker News;
              posts not discussed there follow, newest first. Posts about one announcement are gathered under the
              biggest of them, and the editor can pin a story to the top or leave one out;{" "}
              <a href="#method">how this is measured</a> lists any such decision.
            </p>
          </div>
          {bigDay && (
            <article className="top-story">
              <p className="top-story__kicker">{first.pinned ? "Editor’s pick" : "The day’s biggest story"}</p>
              <h3>
                <a href={first.url} {...NEW_TAB}>{first.title}</a>
              </h3>
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
          {todayRows.length > 0 ? (
            <Ledger
              first="Headline"
              labelledBy="today-h"
              count={todayRows.length}
              start={bigDay ? 2 : 1}
              more={<a className="more" href="#news">The week’s top stories ↓</a>}
              cells={[
                { head: "From", width: "9.5rem", start: true },
                { head: "Hacker News", width: "5.5rem" },
                { head: "Published (UTC)", width: "6.5rem" },
              ]}
            >
              {todayRows.map((item) => (
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
              in <a href="#news">the reading list</a>.
            </p>
          )}
        <SourceLine names="the labs’ and newsletters’ own feeds; Hacker News" keys={["labNews", "analysis", "today"]} />
        </section>

        <section className="chapter" aria-labelledby="trends-h">
          <header className="chapter__head">
            <p className="chapter__title" id="trends-h">The trends</p>
            <p className="chapter__dek">What is rising and what is cooling, in research and in discussion on Hacker News.</p>
          </header>

        <section id="momentum" className="band" aria-labelledby="momentum-h">
          <div className="band__head">
            <h2 id="momentum-h">Topic momentum</h2>
            <p>
              Each topic’s {compared}. Research is the topic’s share
              of all AI papers on arXiv; discussion is Hacker News stories with the topic in the title. A grey
              bar beside a large figure moved, but no further than that topic usually swings from week to week, so
              it is not called a rise or a fall.
            </p>
          </div>

          {hasHistory ? (
            <>
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

              <SourceLine names="arXiv (papers); Hacker News story titles (discussion)" keys={["arxivHistory", "hnHistory"]} />
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

        <section id="reading" className="chapter chapter--reading" aria-labelledby="reading-h">
          <header className="chapter__head">
            <p className="chapter__title" id="reading-h">The reading list</p>
            <p className="chapter__dek">The stories, papers, essays, launches, code and models behind this week’s numbers.</p>
          </header>

        <div className="pair">
          <section id="news" className="band" aria-labelledby="news-h">
            <div className="band__head">
              <h2 id="news-h">In the news</h2>
              <p>The most upvoted AI stories on Hacker News in the past seven days.</p>
            </div>
            <Ledger brief
              first="Story"
              labelledBy="news-h"
              count={stories.length}
              more={
                <a className="more" href="https://hn.algolia.com/?dateRange=pastWeek&query=AI&sort=byPopularity&type=story" {...NEW_TAB}>
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
                    <a href={s.url} title={s.title} {...NEW_TAB}>{s.title}</a>
                    <span className="ledger__note">{host(s.url)}</span>
                  </span>
                  <span className="ledger__data">
                    <Mag value={s.points} max={top(stories.map((x) => x.points))} unit="points" />
                    <span>
                      <a href={s.discussionUrl} {...NEW_TAB}>
                        {fmtCompact(s.comments)}
                        <span className="ledger__unit"> comments</span>
                      </a>
                    </span>
                    <span className="ledger__extra">{fmtDay(s.createdAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          <SourceLine names="Hacker News" keys={["stories"]} />
          </section>

          <section id="papers" className="band" aria-labelledby="papers-h">
            <div className="band__head">
              <h2 id="papers-h">Papers getting attention</h2>
              <p>Recent papers ranked by reader upvotes on Hugging Face.</p>
            </div>
            <Ledger brief
              first="Paper"
              labelledBy="papers-h"
              count={papers.length}
              kind="paper"
              more={
                <a className="more" href="https://huggingface.co/papers" {...NEW_TAB}>
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
                    <a href={p.url} title={p.title} {...NEW_TAB}>{p.title}</a>
                  </span>
                  <span className="ledger__data">
                    <Mag value={p.upvotes} max={top(papers.map((x) => x.upvotes))} unit="upvotes" />
                    <span className="ledger__extra">{fmtDay(p.publishedAt)}</span>
                    <span>{p.codeUrl && <a href={p.codeUrl} {...NEW_TAB}>code</a>}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          <SourceLine names="Hugging Face Daily Papers" keys={["papers"]} />
          </section>
        </div>

        <div className="pair">
          <section id="analysis" className="band" aria-labelledby="analysis-h">
            <div className="band__head">
              <h2 id="analysis-h">From the analysts</h2>
              <p>
                New writing on what AI is doing to work, companies and society, from newsletters and research
                institutions. Some pieces need a subscription to read in full.
              </p>
            </div>
            <Ledger brief
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
                    <a href={a.url} title={a.title} {...NEW_TAB}>{a.title}</a>
                  </span>
                  <span className="ledger__data">
                    <span className="ledger__cell--start">{a.source}</span>
                    <span>{fmtDay(a.publishedAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          <SourceLine names="each publisher’s own feed, named beside its piece" keys={["analysis"]} />
          </section>

          <section id="announcements" className="band" aria-labelledby="announcements-h">
            <div className="band__head">
              <h2 id="announcements-h">Lab announcements</h2>
              <p>
                The latest posts from the labs themselves, including closed-model releases: Anthropic, OpenAI,
                Google DeepMind, Meta, Microsoft, Mistral AI, xAI and DeepSeek, and four smaller labs known for one
                kind of model: Runway (video), ElevenLabs (voice), Suno (music) and Stability AI (images and audio).
              </p>
            </div>
            <Ledger brief
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
                    <a href={a.url} title={a.title} {...NEW_TAB}>{a.title}</a>
                  </span>
                  <span className="ledger__data">
                    <span className="ledger__cell--start">{a.source}</span>
                    <span>{fmtDay(a.publishedAt)}</span>
                  </span>
                </li>
              ))}
            </Ledger>
          <SourceLine names="the labs’ own news feeds, and Hacker News for labs without one" keys={["labNews"]} />
          </section>
        </div>

        {launches.length > 0 && (
        <section id="launches" className="band" aria-labelledby="launches-h">
          <div className="band__head">
            <h2 id="launches-h">Product launches</h2>
            <p>AI products their makers posted to Hacker News in the past seven days, ranked by points.</p>
          </div>
          <Ledger
            first="Product"
            labelledBy="launches-h"
            count={launches.length}
            kind="thing"
            more={
              <a className="more" href="https://news.ycombinator.com/show" {...NEW_TAB}>
                More on Show HN →
              </a>
            }
            cells={[
              { head: "Points", width: "7.5rem" },
              { head: "Comments", width: "4.25rem" },
              { head: "Posted as", width: "5.5rem", start: true },
              { head: "Posted", width: "3.25rem" },
            ]}
          >
            {launches.map((l) => (
              <li key={l.id}>
                <span className="ledger__main">
                  <a href={l.url} title={l.title} {...NEW_TAB}>{l.title}</a>
                  <span className="ledger__note">{host(l.url)}</span>
                </span>
                <span className="ledger__data">
                  <Mag value={l.points} max={top(launches.map((x) => x.points))} unit="points" />
                  <span>
                    <a href={l.discussionUrl} {...NEW_TAB}>
                      {fmtCompact(l.comments)}
                      <span className="ledger__unit"> comments</span>
                    </a>
                  </span>
                  <span className="ledger__cell--start">{l.kind}</span>
                  <span>
                    <span className="ledger__unit">posted </span>
                    {fmtDay(l.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </Ledger>
          <SourceLine names="Hacker News, Show HN and Launch HN posts" keys={["launches"]} />
        </section>
        )}

        <section id="code" className="band" aria-labelledby="code-h">
          <div className="band__head">
            <h2 id="code-h">Repositories gaining stars</h2>
            <p>AI projects created on GitHub in the past 30 days, ranked by stars gained per day.</p>
          </div>
          <Ledger brief
            first="Repository"
            labelledBy="code-h"
            count={repos.length}
            kind="thing"
            more={
              <a className="more" href="https://github.com/trending" {...NEW_TAB}>
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
                  <a href={r.url} title={r.name} {...NEW_TAB}>{r.name}</a>
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
        <SourceLine names="GitHub repository search" keys={["repos"]} />
        </section>

        <div className="pair">
          <section id="models" className="band" aria-labelledby="models-h">
            <div className="band__head">
              <h2 id="models-h">Models trending</h2>
              <p>What builders are picking up on Hugging Face right now.</p>
            </div>
            <Ledger brief
              first="Model"
              labelledBy="models-h"
              count={models.length}
              kind="thing"
              more={
                <a className="more" href="https://huggingface.co/models?sort=trending" {...NEW_TAB}>
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
                    <a href={m.url} title={m.id} {...NEW_TAB}>{m.id}</a>
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
          <SourceLine names="Hugging Face, trending models" keys={["models"]} />
          </section>

          <section id="labs" className="band" aria-labelledby="labs-h">
            <div className="band__head">
              <h2 id="labs-h">New from the labs</h2>
              <p>Open models published by major AI labs in the past 45 days, by likes.</p>
            </div>
            <Ledger brief
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
                    <a href={m.url} title={m.id} {...NEW_TAB}>{m.id}</a>
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
          <SourceLine names="Hugging Face, models published by the labs’ own accounts" keys={["releases"]} />
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
                <strong>Topic momentum</strong> sets two changes over the same windows side by side: a topic’s share
                of AI papers and its Hacker News stories. Each column of bars has its own scale, given under the
                list. A bar is drawn solid only when the topic averages at least {HEADLINE_MIN_PAPERS} papers, or
                for discussion {MAP_MIN_STORIES} stories, a week. Smaller counts swing too easily, so their bars
                are outlined and should be read with care. <strong>The numbers under the headline</strong> are written by fixed rules from the same numbers, not by an editor or a model. Their research and discussion lines follow the view chosen; their economy, releases and policy lines are the same in every view.
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
                <strong>Today’s AI news</strong> lists what was published in the 24 hours before the data was
                collected, which happens once a day: posts from the labs named under “Lab announcements”, pieces from the newsletters and
                institutions, and up to twelve Hacker News stories with an AI term in the title and at least 20
                points. The biggest stories come first, and size is measured by points on Hacker News, the one
                figure the sources share. A lab or newsletter post takes the points of the story that links to it
                or carries its headline; posts with no such story come after the rest, newest first, because
                nothing says how big they are. The times are in UTC, and none of this feeds
                the trends.
              </p>
              <p>
                <strong>The editor’s step.</strong> Points say what one community upvoted, so the ranked list is
                finished by rules before it is shown. Posts about one event are gathered under the highest-ranked
                of them and stay on the page beneath it: two headlines count as one event when one holds the other,
                or when they share three or more words in a row that include a version number. The editor can also
                pin a post to the top until a set day, and leave a link out of every list on this page; both are
                kept in a file in the project’s repository, with a reason for each link left out.{" "}
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
          AI Trend Tracker is rebuilt from public data: arXiv, Hacker News, GitHub, Hugging Face and Wikipedia page views, with headlines from publishers’ own feeds. Thank you to
          arXiv for use of its open access interoperability. Counts are keyword matches and should be read as
          indicators, not measurements. Set in Newsreader and Geist. Data last collected{" "}
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
