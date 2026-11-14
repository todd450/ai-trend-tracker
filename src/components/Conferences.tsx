import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Spark } from "@/components/MomentumBars";
import { PageTabs } from "@/components/PageTabs";
import { topicsHref } from "@/lib/datasets";
import { NEW_TAB } from "@/lib/links";
import { SITE_MAKER_URL } from "@/lib/site";
import { PHASE_LABEL, PHASE_MARK, dayParts, type AgendaMonth } from "@/lib/agenda";
import {
  READING_LABEL,
  calendarMonths,
  conferences,
  daysUntil,
  fmtMonthOf,
  fmtSpan,
  phaseOf,
  stageAgainstTrends,
  today,
} from "@/lib/conferences";
import { HORIZONS, STEADY_BAND, fmtChange, fmtDate, fmtDay, heldBack, latest, signalDirection, type Direction, type Signal } from "@/lib/trends";
import type { Conference } from "@/lib/types";

const ARROW: Record<Direction, string> = { rising: "▲", steady: "■", cooling: "▼" };

/** The comparison uses the tracker's default view, so its arrows match the front page. */
const HORIZON = "threeMonths" as const;

/** "Tool use & MCP" reads as "tool use & MCP" mid-sentence; names that open with an acronym keep their capitals. */
const inSentence = (name: string) => (/^[A-Z]{2,}\b/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

const pct = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

/** An event has a reading once anything has been counted or written from it. */
export const hasReading = (c: Conference) => Boolean(c.stage || c.recap);


/** A topic at or under this share of mentions, with nothing quoted from the stage, is listed in one line, not given a row. */
const THIN_SHARE = 0.01;

/**
 * A change as the trends page shows it: the series week by week as a small line, then the figure
 * with its mark. A change resting on too few papers or stories is shown grey and says so.
 */
function Move({ signal, label, firm }: { signal: Signal; label: string; firm: boolean }) {
  const change = signal.change;
  const tone = firm ? signalDirection(signal, STEADY_BAND) : "steady";
  const held = firm && heldBack(signal, STEADY_BAND);
  return (
    <span className={firm ? (held ? "change change--held" : "change") : "change change--thin"}>
      <Spark values={signal.values} tone={tone} />
      <span className={`change__mark change__mark--${tone}`} aria-hidden="true">
        {firm ? ARROW[tone] : "○"}
      </span>
      <span className="vh">{label} </span>
      {fmtChange(change)}
      {held && <span className="vh"> (within its usual swing, so not called)</span>}
      {!firm && <span className="stage__thin"> small numbers</span>}
    </span>
  );
}

/** "in 4 days", "in 3 months": how soon an upcoming event starts. */
export function when(c: Conference): string {
  const days = daysUntil(c);
  if (days === 0) return "starts today";
  if (days === 1) return "starts tomorrow";
  if (days < 60) return `in ${days} days`;
  return `in ${Math.round(days / 30.4)} months`;
}

/** One event's comparison: how much of the stage each topic took, beside how its counts are moving. */
export function Stage({ c }: { c: Conference }) {
  const rows = stageAgainstTrends(c, HORIZON);
  const stage = c.stage;
  if (!stage) return null;
  const total = rows.reduce((sum, r) => sum + r.mentions, 0);
  const max = Math.max(1, ...rows.map((r) => r.mentions));
  const fromTalks = stage.source === "talks";
  /** A row needs either a real share of the stage or something quoted from it; the rest are named in one line. */
  const heard = rows.filter((r) => r.mentions > 0 && (r.share > THIN_SHARE || r.points.length > 0));
  const barely = rows.filter((r) => r.mentions > 0 && !heard.includes(r));
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
        The research and discussion figures are the tracker’s own, for the last {window} weeks against the{" "}
        {window} before, as on the <Link href="/">trends page</Link>.
      </p>
      <p className="conf__caveat">
        <strong>How to read this.</strong> A conference’s subject decides most of what is said on its stage, so a
        topic being loud here shows what the event was about, not that the field has moved. The comparison says
        most about topics the event was not built around.
        {fromTalks && (
          <>
            {" "}
            What speakers said is paraphrased from automatic captions, which can mishear names and numbers; each
            claim links to its moment in the recording so it can be checked there.
          </>
        )}
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
              <Link href={`${topicsHref(HORIZON)}#topic-${r.topic.id}`}>{r.topic.name}</Link>
            </h3>
            <div className="stage__share">
              <span className="stage__label">{fromTalks ? "On stage" : "Programme"}</span>
              <span className="stage__bar" aria-hidden="true">
                <span style={{ width: `${(r.mentions / max) * 100}%` }} />
              </span>
              <span className="stage__num">
                {pct(r.share)}
                <span className="vh"> of topic mentions,</span> <span className="stage__count">{r.mentions}</span>
                <span className="vh"> {r.mentions === 1 ? "mention" : "mentions"}</span>
              </span>
            </div>
            <div className="stage__move">
              <span className="stage__label">Research</span>
              {r.topic.hasPapers ? <Move signal={r.topic.papers} label="Research" firm={r.researchFirm} /> : <span className="stage__none">not collected</span>}
            </div>
            <div className="stage__move">
              <span className="stage__label">Discussion</span>
              <Move signal={r.topic.stories} label="Discussion" firm={r.discussionFirm} />
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
                        {p.at && <a href={p.at.url} {...NEW_TAB}>{p.at.label}</a>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {barely.length > 0 && (
        <p className="conf__unheard">
          <strong>Barely mentioned ({pct(THIN_SHARE)} of mentions or less):</strong>{" "}
          {barely.map((r, i) => (
            <span key={r.topic.id}>
              {i > 0 && ", "}
              {r.topic.name} ({r.mentions})
            </span>
          ))}
          .
        </p>
      )}
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
      <p className="source">
        <b>Sources:</b> {fromTalks ? "the event’s recordings, from their automatic captions" : "the organiser’s published programme"}{" "}
        (stage); arXiv and Hacker News story titles (research and discussion). Trend data collected{" "}
        {fmtDay(latest.generatedAt)}.
      </p>
    </>
  );
}

export function Programme({ c }: { c: Conference }) {
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

/** The masthead shared by the calendar and each event's page. */
export function ConfMast() {
  return (
    <header className="mast">
      <div className="mast__top">
        <PageTabs current="conferences" />
        <p className="mast__line">As of {fmtDate(today)}</p>
      </div>
      <p className="mast__name">
        <Logo className="mast__mark" />
        <Link href="/">AI Trend Tracker</Link>
      </p>
    </header>
  );
}

export function ConfColophon() {
  return (
    <footer className="colophon">
      <p>
        Conference dates come from each organiser’s site and can change; check the event’s own page before
        travelling. Talk titles and speaker names are the organisers’. Counts are keyword matches and should be
        read as indicators, not measurements. Data last collected {fmtDate(today)}.
      </p>
      <p>
        <a href={SITE_MAKER_URL} {...NEW_TAB}>HalfBadger.com</a>
      </p>
    </footer>
  );
}

/** "3 held · 1 under way · 2 upcoming", leaving out what is zero. */
function monthCount({ count }: AgendaMonth): string {
  return [
    count.held && `${count.held} held`,
    count.underway && `${count.underway} under way`,
    count.upcoming && `${count.upcoming} upcoming`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The conference calendar: one agenda of months, a line at today, and each event's phase in words. */
export function Conferences() {
  const months = calendarMonths();
  const phases = conferences.map(phaseOf);
  const upcoming = conferences.filter((c) => phaseOf(c) === "upcoming");
  const underway = conferences.filter((c) => phaseOf(c) === "underway");
  const held = phases.filter((p) => p === "awaiting" || p === "partly" || p === "watched").length;
  const watched = phases.filter((p) => p === "watched").length;
  const partly = phases.filter((p) => p === "partly").length;
  const next = upcoming[0];

  /** The newest event whose talks have been read: its loudest topic is the page's finding. */
  const reported = [...conferences].reverse().find((c) => c.recap && c.stage?.source === "talks");
  const loudest = reported ? stageAgainstTrends(reported, HORIZON)[0] : undefined;

  const finding =
    reported && loudest && loudest.mentions > 0
      ? `At ${reported.name}, ${inSentence(loudest.topic.name)} took ${pct(loudest.share)} of topic mentions on stage.`
      : "";
  const calendar = underway.length
    ? `${underway.map((c) => c.name).join(" and ")} ${underway.length > 1 ? "are" : "is"} under way in ${underway[0].place.split(",")[0]}.`
    : next
      ? `Next on the calendar: ${next.name}, ${when(next)}.`
      : "No conferences on the calendar yet.";
  // What was said leads when there is something to report; the calendar follows it.
  const lead = finding || calendar;
  const turn = finding ? calendar : underway.length && next ? `Next: ${next.name}, ${when(next)}.` : "";

  const first = conferences[0];
  const last = conferences.at(-1);
  return (
    <>
      <a className="skip" href="#now">
        Skip to today
      </a>

      <ConfMast />

      <main className="page">
        <section className="lede lede--cal">
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
                Every event on the calendar, month by month. Once an event is over and its talks are watched, its
                card says what the stage was about and how that compares with the tracker’s numbers. Until then it
                makes no claim.
              </p>
              <p className="lede__meta">
                {conferences.length} events
                {first && last && ` from ${fmtMonthOf(first.start)} to ${fmtMonthOf(last.start)}`} · {held} held
                {underway.length > 0 && ` · ${underway.length} under way`} · {upcoming.length} upcoming · {watched}{" "}
                watched in full{partly > 0 && `, ${partly} in part`}
              </p>
            </div>
          </div>
        </section>

        <div className="agenda" id="calendar">
          {months.map((m) => {
            const events = m.items.filter((x) => x.type === "event").length;
            const y = m.month.slice(0, 4);
            return (
              <section
                key={m.month}
                id={`m-${m.month}`}
                className={events ? "month" : "month month--quiet"}
                aria-labelledby={`h-${m.month}`}
              >
                <div className="month__head">
                  <h2 id={`h-${m.month}`}>
                    {fmtMonthOf(m.month + "-01").replace(` ${y}`, "")} <span>{y}</span>
                  </h2>
                  {events > 0 && <p className="month__count">{monthCount(m)}</p>}
                </div>
                {m.items.length > 0 && (
                  <ol className="month__list">
                    {m.items.map((x) =>
                      x.type === "today" ? <TodayLine key="now" hasUnderway={underway.length > 0} /> : <Row key={x.c.id} c={x.c} />,
                    )}
                  </ol>
                )}
                {events === 0 && <p className="month__none">Nothing on the calendar this month.</p>}
              </section>
            );
          })}
        </div>
      </main>

      <ConfColophon />
    </>
  );
}

function TodayLine({ hasUnderway }: { hasUnderway: boolean }) {
  return (
    <li className="today" id="now">
      <b>Today, {fmtSpan(today, today, { year: false })}</b>
      <span>{hasUnderway ? "started above" : "held above"} · upcoming below</span>
    </li>
  );
}

/** One event: its dates, name, place, kind and phase in words. An event with a reading grows into a card. */
function Row({ c }: { c: Conference }) {
  const phase = phaseOf(c);
  const { days, week } = dayParts(c.start, c.end);
  const href = `/conferences/${c.id}`;
  const read = hasReading(c);
  return (
    // The row keeps the event's id, so links to the old /conferences#<id> still land on it.
    <li className={read ? "ev ev--read" : "ev"} id={c.id}>
      <p className="ev__date">
        <span className="vh">{fmtSpan(c.start, c.end)}</span>
        <span aria-hidden="true">
          <span className="ev__days">{days}</span>
          <span className="ev__wk">{week}</span>
        </span>
      </p>
      <h3 className="ev__name">
        <Link href={href}>{c.name}</Link>
      </h3>
      <p className="ev__meta">
        {c.place} · <span className="ev__kind">{c.kind === "research" ? "Research" : "Industry"}</span>
      </p>
      <p className={`ev__phase ph--${phase}`}>
        <i aria-hidden="true">{PHASE_MARK[phase]}</i> {PHASE_LABEL[phase]}
        {phase === "upcoming" && <small>· {when(c)}</small>}
      </p>
      {read && <Card c={c} href={href} />}
    </li>
  );
}

/** What a reading found, in one sentence and the three loudest topics, with a link to the whole of it. */
function Card({ c, href }: { c: Conference; href: string }) {
  const rows = c.stage ? stageAgainstTrends(c, HORIZON).filter((r) => r.mentions > 0) : [];
  const top = rows[0];
  const fromTalks = c.stage?.source === "talks";
  const where = fromTalks ? "on stage" : "in the programme";
  const max = Math.max(1, ...rows.map((r) => r.mentions));
  const said = c.recap?.points.length ?? 0;
  return (
    <>
      {top && (
        <>
          <p className="ev__finding">
            {top.topic.name} took <strong>{pct(top.share)}</strong> of topic mentions {where}.
            {READING_LABEL[top.reading] && <em> {READING_LABEL[top.reading]}.</em>}
          </p>
          <ol className="loud" aria-label={`Loudest topics ${where}`}>
            {rows.slice(0, 3).map((r) => (
              <li key={r.topic.id}>
                <span>{r.topic.name}</span>
                <span className="stage__bar" aria-hidden="true">
                  <span style={{ width: `${(r.mentions / max) * 100}%` }} />
                </span>
                <span className="loud__n">{pct(r.share)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="ev__honest">
        {c.stage && !fromTalks
          ? "Counted from the published programme, not the talks: what speakers said they would talk about."
          : c.recap?.partial
            ? `Watched in part on ${fmtSpan(c.recap.watchedOn, c.recap.watchedOn)}: some of the event is not in this reading yet. Its page says which parts.`
            : c.recap
              ? `Watched ${fmtSpan(c.recap.watchedOn, c.recap.watchedOn)}.`
              : "Counted from the talks’ captions; what was said is not written up yet."}
      </p>
      <p className="ev__go">
        <Link href={href}>
          {c.stage
            ? `The ${fromTalks ? "stage" : "programme"} against the numbers${said > 0 ? `, and ${said} ${said === 1 ? "thing" : "things"} speakers said` : ""}`
            : "Read the recap"}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </p>
    </>
  );
}
