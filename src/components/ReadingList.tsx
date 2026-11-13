import Link from "next/link";
import { Ledger } from "@/components/Ledger";
import { Colophon, SiteMast } from "@/components/SiteFrame";
import { SourceLine } from "@/components/SourceLine";
import { visible } from "@/lib/editorial";
import { NEW_TAB, host } from "@/lib/links";
import { editorial } from "@/lib/today";
import { fmtCompact, fmtDate, fmtDay, latest } from "@/lib/trends";

const SHOWN = 10;

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

/**
 * The reading list: the stories, papers, essays, launches, code and models behind the week's
 * numbers. None of it feeds the trends, so it does not change with the time range and has a page
 * of its own. Today's AI news stays on the front page.
 */
export function ReadingList() {
  // The editor's hides apply to every ranked list, before it is cut to length.
  const stories = visible(latest.stories, editorial).slice(0, SHOWN);
  const papers = visible(latest.papers, editorial).slice(0, SHOWN);
  const repos = visible(latest.repos, editorial).slice(0, SHOWN);
  const launches = visible(latest.launches ?? [], editorial).slice(0, SHOWN);
  const models = visible(latest.models, editorial).slice(0, SHOWN);
  const labModels = visible(latest.releases, editorial).slice(0, SHOWN);
  const analysis = (latest.analysis ?? []).slice(0, SHOWN);
  const labNews = latest.labNews ?? []; // all of it: the collector already keeps this list short

  return (
    <>
      <a className="skip" href="#reading">
        Skip to the reading list
      </a>

      <SiteMast current="reading" line={`Updated ${fmtDate(latest.generatedAt)}`} />

      <main className="page">
        <section id="reading" className="chapter chapter--page" aria-labelledby="reading-h">
          <header className="chapter__head">
            <h1 className="chapter__title" id="reading-h">The reading list</h1>
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
            <h2 id="method-h">How these lists are made</h2>
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
                  <strong>The reading lists</strong> show their first few items; the rest open on request. Where a
                  list is set in columns, the bar beside the figure it is ranked by shows it against the largest in
                  that list.
                </p>
            <p>
              The editor can leave a link out of every list; each link left out is named, with the reason, under{" "}
              <Link href="/#method">how this is measured</Link> on the front page. None of these lists feeds the trends.
            </p>
          </div>
        </section>
      </main>

      <Colophon />
    </>
  );
}
