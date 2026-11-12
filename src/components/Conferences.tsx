import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  READING_LABEL,
  STAGE_LOUD,
  STAGE_QUIET,
  conferences,
  daysUntil,
  fmtMonthOf,
  fmtSpan,
  phaseOf,
  stageAgainstTrends,
  today,
  type Phase,
} from "@/lib/conferences";
import { HORIZONS, directionOf, fmtChange, fmtDate, fmtDay, type Direction } from "@/lib/trends";
import type { Conference } from "@/lib/types";

const ARROW: Record<Direction, string> = { rising: "▲", steady: "■", cooling: "▼" };

const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "Upcoming",
  underway: "Under way",
  awaiting: "Held · recordings not yet watched",
  partly: "Held · partly watched",
  watched: "Watched",
};

/** The comparison uses the tracker's default view, so its arrows match the front page. */
const HORIZON = "threeMonths" as const;

const pct = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

function Move({ change, label }: { change: number | null; label: string }) {
  const tone = directionOf(change, 0.1);
  return (
    <span className="change">
      <span className={`change__mark change__mark--${tone}`} aria-hidden="true">
        {ARROW[tone]}
      </span>
      <span className="vh">{label} </span>
      {fmtChange(change)}
    </span>
  );
}

function when(c: Conference): string {
  const days = daysUntil(c);
  if (days === 0) return "starts today";
  if (days === 1) return "starts tomorrow";
  if (days < 60) return `in ${days} days`;
  return `in ${Math.round(days / 30.4)} months`;
}

/** One event's comparison: how much of the stage each topic took, beside how its counts are moving. */
function Stage({ c }: { c: Conference }) {
  const rows = stageAgainstTrends(c, HORIZON);
  const stage = c.stage;
  if (!stage) return null;
  const total = rows.reduce((sum, r) => sum + r.mentions, 0);
  const max = Math.max(1, ...rows.map((r) => r.mentions));
  const fromTalks = stage.source === "talks";
  const heard = rows.filter((r) => r.mentions > 0);
  const unheard = rows.filter((r) => r.mentions === 0);
  const window = HORIZONS[HORIZON].window;

  return (
    <>
      <p className="conf__basis">
        {fromTalks ? (
          <>
            Counted from the talks’ captions: {stage.words.toLocaleString("en")} words, {total.toLocaleString("en")}{" "}
            mentions of a tracked topic.
          </>
        ) : (
          <>
            <strong>Counted from the published programme, not the talks.</strong> The recordings have no captions yet,
            so this is what speakers said they would talk about: {stage.words.toLocaleString("en")} words of titles
            and abstracts, {total.toLocaleString("en")} mentions of a tracked topic.
          </>
        )}{" "}
        Trend arrows compare the last {window} weeks with the {window} before.
      </p>

      <div className="stage-cols" aria-hidden="true">
        <span>Topic</span>
        <span>{fromTalks ? "On stage" : "In the programme"} <i>share of topic mentions</i></span>
        <span>Research <i>share of AI papers</i></span>
        <span>Discussion <i>Hacker News stories</i></span>
        <span>Reading</span>
      </div>
      <ol className="stage">
        {heard.map((r) => (
          <li key={r.topic.id} className="stage__row">
            <h3 className="stage__topic">
              <Link href={`/#topic-${r.topic.id}`}>{r.topic.name}</Link>
            </h3>
            <div className="stage__share">
              <span className="stage__label">{fromTalks ? "On stage" : "Programme"}</span>
              <span className="stage__bar" aria-hidden="true">
                <span style={{ width: `${(r.mentions / max) * 100}%` }} />
              </span>
              <span className="stage__num">
                {pct(r.share)}
                <span className="vh"> of topic mentions,</span> <span className="stage__count">{r.mentions}</span>
                <span className="vh"> mentions</span>
              </span>
            </div>
            <div className="stage__move">
              <span className="stage__label">Research</span>
              {r.topic.hasPapers ? <Move change={r.topic.papers.change} label="Research" /> : <span className="stage__none">not collected</span>}
            </div>
            <div className="stage__move">
              <span className="stage__label">Discussion</span>
              <Move change={r.topic.stories.change} label="Discussion" />
            </div>
            <p className={`stage__reading stage__reading--${r.reading}`}>{READING_LABEL[r.reading]}</p>
            {r.points.length > 0 && (
              <ul className="stage__points">
                {r.points.map((p) => (
                  <li key={p.said}>
                    {p.said}
                    {(p.who || p.at) && (
                      <span className="stage__who">
                        {" "}
                        {p.who}
                        {p.who && p.at && ", "}
                        {p.at && <a href={p.at.url}>{p.at.label}</a>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {unheard.length > 0 && (
        <p className="conf__unheard">
          <strong>Not mentioned at all:</strong>{" "}
          {unheard.map((r, i) => (
            <span key={r.topic.id}>
              {i > 0 && ", "}
              {r.topic.name}
              {r.reading === "numbers-ahead" && " (rising in the numbers)"}
            </span>
          ))}
          .
        </p>
      )}
    </>
  );
}

function Programme({ c }: { c: Conference }) {
  if (!c.programme?.length) return null;
  const days = [...new Set(c.programme.map((t) => t.day))].sort();
  return (
    <details className="table-view">
      <summary>Show the main-stage programme ({c.programme.length} talks)</summary>
      <div className="programme">
        {days.map((day) => (
          <section key={day}>
            <h4>{fmtDate(day)}</h4>
            <ol>
              {c.programme!.filter((t) => t.day === day).map((t) => (
                <li key={t.title + t.speaker}>
                  <span className="programme__title">{t.title}</span>
                  <span className="programme__who">
                    {t.speaker}
                    {t.org && `, ${t.org}`}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}

/** The conference tracker: the calendar, and each event read against the trends once there is something to count. */
export function Conferences() {
  const upcoming = conferences.filter((c) => phaseOf(c) === "upcoming");
  const underway = conferences.filter((c) => phaseOf(c) === "underway");
  const past = conferences.filter((c) => ["awaiting", "partly", "watched"].includes(phaseOf(c))).reverse();
  /** Events with something to compare, newest first: these get a full reading. */
  const read = conferences.filter((c) => c.stage || c.recap).reverse();
  const next = upcoming[0];
  const months = [...new Set(upcoming.map((c) => c.start.slice(0, 7)))];
  const watched = conferences.filter((c) => phaseOf(c) === "watched").length;

  const lead = underway.length
    ? `${underway.map((c) => c.name).join(" and ")} ${underway.length > 1 ? "are" : "is"} under way in ${underway[0].place.split(",")[0]}.`
    : next
      ? `Next on the calendar: ${next.name}, ${when(next)}.`
      : "No conferences on the calendar yet.";
  const turn = underway.length && next ? `Next: ${next.name}, ${when(next)}.` : "";

  return (
    <>
      <a className="skip" href="#calendar">
        Skip to the calendar
      </a>

      <header className="mast">
        <p className="mast__line">Conference tracker · as of {fmtDate(today)}</p>
        <p className="mast__name">
          <Logo className="mast__mark" />
          <Link href="/">AI Trend Tracker</Link>
        </p>
      </header>

      <div className="bar">
        <div className="bar__inner">
          <div className="bar__row">
            <nav className="bar__nav" aria-label="Sections">
              <ul>
                <li><Link href="/">← The trends</Link></li>
                {read.length > 0 && <li><a href="#readings">Readings</a></li>}
                <li><a href="#calendar">Calendar</a></li>
                {past.length > 0 && <li><a href="#held">Held</a></li>}
                <li><a href="#method">Method</a></li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <main className="page">
        <section className="lede">
          <div className="lede__main">
            <h1 className="lede__head">
              {lead}
              {turn && (
                <>
                  {" "}
                  <span className="lede__turn">{turn}</span>
                </>
              )}
            </h1>
            <div className="lede__dek">
              <p>
                The major AI conferences, and what each one adds to the picture. Once an event is over and its
                recordings are out, the talks are watched and set against the tracker’s numbers: where the stage
                agrees with the trends, and where it runs ahead of them or behind.
              </p>
              <p className="lede__meta">
                {conferences.length} events on the calendar · {upcoming.length} upcoming · {watched} watched so far
              </p>
            </div>
          </div>
        </section>

        {read.length > 0 && (
          <div id="readings">
            {read.map((c) => {
              const phase = phaseOf(c);
              return (
                <section key={c.id} id={c.id} className="band" aria-labelledby={`${c.id}-h`}>
                  <div className="band__head">
                    <p className="band__source">
                      {PHASE_LABEL[phase]} · {fmtSpan(c.start, c.end)} · {c.place}
                    </p>
                    <h2 id={`${c.id}-h`}>
                      {c.name}: {c.stage?.source === "talks" ? "the stage against the numbers" : "the programme against the numbers"}
                    </h2>
                    {c.note && <p>{c.note}</p>}
                  </div>

                  {c.recap ? (
                    <div className="conf__recap prose">
                      <p>{c.recap.summary}</p>
                      <p className="conf__coverage">
                        Watched {fmtDate(c.recap.watchedOn)}: {c.recap.coverage}
                      </p>
                    </div>
                  ) : (
                    <p className="conf__pending">
                      <span className="status status--fail"><span aria-hidden="true">▲</span> Not watched yet.</span>{" "}
                      {phase === "underway"
                        ? "The event is still running. The talks will be watched and summarised here once it is over and the recordings have captions."
                        : "The talks will be watched and summarised here once the recordings have captions."}
                    </p>
                  )}

                  <Stage c={c} />

                  {(c.videos?.length || c.programme?.length) && (
                    <div className="conf__more">
                      {c.videos?.length ? (
                        <p className="conf__videos">
                          <strong>Recordings:</strong>{" "}
                          {c.videos.map((v, i) => (
                            <span key={v.url}>
                              {i > 0 && " · "}
                              <a href={v.url}>{v.title}</a>
                            </span>
                          ))}
                        </p>
                      ) : null}
                      <Programme c={c} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <section id="calendar" className="band" aria-labelledby="calendar-h">
          <div className="band__head">
            <h2 id="calendar-h">Calendar</h2>
            <p>
              Upcoming events, soonest first. Research meetings are where papers are presented; industry events are
              where labs and companies announce and demonstrate.
            </p>
          </div>
          {[...underway.map((c) => c.start.slice(0, 7)), ...months]
            .filter((m, i, all) => all.indexOf(m) === i)
            .map((month) => (
              <div key={month} className="cal__month">
                <h3>{fmtMonthOf(month + "-01")}</h3>
                <ol>
                  {[...underway, ...upcoming]
                    .filter((c) => c.start.slice(0, 7) === month)
                    .map((c) => (
                      <Entry key={c.id} c={c} />
                    ))}
                </ol>
              </div>
            ))}
          {upcoming.length + underway.length === 0 && <p className="empty">Nothing upcoming has been added.</p>}
        </section>

        {past.length > 0 && (
          <section id="held" className="band" aria-labelledby="held-h">
            <div className="band__head">
              <h2 id="held-h">Already held</h2>
              <p>
                Most recent first. An event is marked watched once its talks have been read against the trends, and
                partly watched while some of them are still to come.
              </p>
            </div>
            <div className="cal__month">
              <ol>
                {past.map((c) => (
                  <Entry key={c.id} c={c} />
                ))}
              </ol>
            </div>
          </section>
        )}

        <section id="method" className="band method" aria-labelledby="method-h">
          <div className="band__head">
            <h2 id="method-h">How conferences are read</h2>
          </div>
          <div className="prose">
            <p>
              <strong>The calendar</strong> is kept by hand, with dates taken from each event’s own site. An event
              moves from upcoming to held on its own: the page compares each date with the day the tracker’s data
              was last collected ({fmtDay(today)}), and that happens daily.
            </p>
            <p>
              <strong>Watching</strong> means reading the captions of an event’s published recordings from start to
              finish, after it has ended. Until captions exist, the published programme is counted instead and the
              page says so. Nothing is summarised from titles alone: a written summary appears only for talks that
              were watched, and it says how much was covered. When some talks are read before an event ends, or
              before every recording has captions, the event stays under way or partly watched until the rest is
              read.
            </p>
            <p>
              <strong>Share of topic mentions</strong> counts each time a tracked topic’s phrases are spoken (or,
              before the talks, written in a title or abstract), as a part of all such mentions at that event. The
              phrases are the ones the tracker searches papers and stories for, plus the way speakers say them
              aloud. A conference picks its own subject, so a coding event will always be mostly about coding; read
              the shares as what that room cared about, not as the whole field.
            </p>
            <p>
              <strong>The reading</strong> is a rule, not a judgement. A topic with {Math.round(STAGE_LOUD * 100)}% or
              more of the mentions is loud; one under {Math.round(STAGE_QUIET * 100)}% is quiet. Loud and rising in
              research or discussion: the event and the numbers agree. Loud while neither is rising and one is cooling:
              louder here than in the numbers. Loud while both are flat: loud here, flat in the numbers. Quiet while rising: rising, but little heard here. The trend side uses the
              three-month view, so it changes as new weeks are counted.
            </p>
          </div>
        </section>
      </main>

      <footer className="colophon">
        <p>
          Conference dates come from each organiser’s site and can change; check the event’s own page before
          travelling. Talk titles and speaker names are the organisers’. Counts are keyword matches and should be
          read as indicators, not measurements. Data last collected {fmtDate(today)}.
        </p>
      </footer>
    </>
  );
}

function Entry({ c }: { c: Conference }) {
  const phase = phaseOf(c);
  const hasReading = Boolean(c.stage || c.recap);
  return (
    <li className="cal__event">
      <p className="cal__dates">{fmtSpan(c.start, c.end)}</p>
      <div className="cal__body">
        <h4>
          <a href={c.url}>{c.name}</a>
        </h4>
        <p className="cal__where">
          {c.place} · {c.host} · {c.kind === "research" ? "Research meeting" : "Industry event"}
        </p>
        {c.note && <p className="cal__note">{c.note}</p>}
      </div>
      <p className={`cal__phase cal__phase--${phase}`}>
        {phase === "upcoming" ? when(c) : PHASE_LABEL[phase]}
        {hasReading && (
          <>
            {" · "}
            <a href={`#${c.id}`}>{c.recap ? "Read the recap" : "See the programme reading"}</a>
          </>
        )}
        {!hasReading && phase !== "upcoming" && c.recordings && (
          <>
            {" · "}
            <a href={c.recordings}>Recordings</a>
          </>
        )}
      </p>
    </li>
  );
}
