import Link from "next/link";
import { ConfColophon, ConfMast, HearIt, Programme, SURPRISE_SOURCE, Stage, hasReading, hasRow, pct, when } from "@/components/Conferences";
import { PHASES, PHASE_LABEL, neighbours } from "@/lib/agenda";
import {
  KIND_LABEL,
  conferences,
  fmtMonthOf,
  fmtSpan,
  momentDay,
  phaseOf,
  stageAgainstTrends,
  surpriseOf,
  today,
  type StageRow,
  type Surprise,
} from "@/lib/conferences";
import { NEW_TAB } from "@/lib/links";
import { TOPICS } from "@/lib/topics";
import { fmtDate } from "@/lib/trends";
import type { Conference, StagePoint } from "@/lib/types";

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

const kindOf = (c: Conference) => KIND_LABEL[c.kind];

/** "Upcoming, in 23 days" or "Held · partly watched": the phase, and how soon for an event still to come. */
const status = (c: Conference) => {
  const phase = phaseOf(c);
  return phase === "upcoming" ? `${PHASE_LABEL[phase]}, ${when(c)}` : PHASE_LABEL[phase];
};

/** One line under the current step, saying what it means for this event. */
function stepNote(c: Conference): string {
  switch (phaseOf(c)) {
    case "upcoming":
      return `Starts ${fmtDate(c.start)}. Dates are the organiser’s and can change.`;
    case "underway":
      return `Runs until ${fmtDate(c.end)}.`;
    case "awaiting":
      return `Ended ${fmtDate(c.end)}. The talks have not been watched yet.`;
    case "partly":
      return `Watched in part on ${fmtDate(c.recap!.watchedOn)}; some of the event is not read yet.`;
    case "watched":
      return `Watched ${fmtDate(c.recap!.watchedOn)}.`;
  }
}

/** The five phases as steps, this event's in words and marked as the current one. */
function Where({ c }: { c: Conference }) {
  const phase = phaseOf(c);
  const at = PHASES.findIndex((p) => p.id === phase);
  return (
    <div className="where">
      <h2 className="where__title">Where this event stands</h2>
      <ol className="steps">
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < at ? "done" : i === at ? "now" : undefined} aria-current={i === at ? "step" : undefined}>
            {p.label}
            {i === at && (
              <>
                <span className="vh"> (this event, now)</span>
                <small>{stepNote(c)}</small>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The event's place in the year: one mark per event on the calendar, those held filled, this one ringed. */
function Year({ c }: { c: Conference }) {
  const place = neighbours(conferences, c.id)!;
  const first = conferences[0];
  const last = conferences.at(-1)!;
  return (
    <div className="year">
      <ol aria-hidden="true">
        {conferences.map((x) => {
          const held = !["upcoming", "underway"].includes(phaseOf(x));
          return <li key={x.id} className={x.id === c.id ? "this" : held ? "held" : undefined} />;
        })}
      </ol>
      <p>
        {ordinal(place.index + 1)} of {place.total} events on the calendar, {fmtMonthOf(first.start)} to{" "}
        {fmtMonthOf(last.start)} · filled marks are held
      </p>
    </div>
  );
}

/** What a page without a reading says: when it will have one, and that it makes no claims until then. */
function Nothing({ c }: { c: Conference }) {
  const phase = phaseOf(c);
  return (
    <section className="nothing" aria-labelledby="nothing-h">
      <h2 id="nothing-h">Nothing has been read from this event yet.</h2>
      <p>
        This page makes no claims about what {c.name}{" "}
        {phase === "upcoming" ? "will cover" : phase === "underway" ? "is covering" : "covered"}.{" "}
        {phase === "awaiting"
          ? "Its talks will be watched once recordings with captions are published, and what was said will be set here against the tracker’s research and discussion numbers."
          : `After it ends on ${fmtDate(c.end)}, its talks will be watched once recordings with captions are published, and what was said will be set here against the tracker’s research and discussion numbers.`}
      </p>
      <p>
        {c.recordings ? (
          <>
            Recordings are published on <a href={c.recordings} {...NEW_TAB}>the organiser’s channel</a>.
          </>
        ) : (
          "No recordings are known yet."
        )}
        {phase === "upcoming" && ` The page will change from “Upcoming” to “Under way” on ${fmtDate(c.start)} without anyone editing it.`}
      </p>
    </section>
  );
}

/** How many moments lead the page; the rest are one click down. */
const TOP = 5;
const COUNT = ["", "One moment", "Two moments", "Three moments", "Four moments", "Five moments"];

const topicName = (id: string) => TOPICS.find((t) => t.id === id)?.name ?? id;

/** The surprise, when the editor wrote one or a reading gives one, with its topic's figure and a link to its row. */
function SurpriseBox({ c, s, rows }: { c: Conference; s: Surprise; rows: StageRow[] }) {
  const row = rows.find((r) => r.topic.id === s.topic);
  const words = c.stage?.words;
  return (
    <aside className="surprise" aria-labelledby="surprise-src">
      <p className="surprise__src" id="surprise-src">
        {SURPRISE_SOURCE[s.from]}
      </p>
      <p className="surprise__line">{s.said}</p>
      {row && words ? (
        <p className="surprise__fig">
          <span>
            <b>{pct(row.share)}</b> of the {c.stage?.source === "talks" ? "stage" : "programme"} · <b>{row.mentions}</b>{" "}
            {row.mentions === 1 ? "mention" : "mentions"} in {words.toLocaleString("en")} words
          </span>{" "}
          <a href={hasRow(row) ? `#stage-${row.topic.id}` : "#stage"}>
            The {row.topic.name} row in the table <span aria-hidden="true">↓</span>
          </a>
        </p>
      ) : null}
    </aside>
  );
}

/** One of moments 2 onwards: its rank, who said it and on which topic, the paraphrase, and its time and day. */
function Moment({ c, p, n }: { c: Conference; p: StagePoint; n: number }) {
  const day = momentDay(c, p);
  return (
    <li className="moment" id={`moment-${n}`}>
      <span className="moment__num" aria-hidden="true">
        {n}
      </span>
      <p className="moment__head">
        {p.who && <strong>{p.who}</strong>} <span className="moment__tag">{topicName(p.topic)}</span>
      </p>
      <p className="moment__said">{p.said}</p>
      {p.at && (
        <p className="moment__at">
          <a href={p.at.url} {...NEW_TAB}>
            {p.at.label}
          </a>
          {day !== null && <span>day {day}</span>}
        </p>
      )}
    </li>
  );
}

/**
 * The 5-minute version: the surprise if there is one, the editor's first moment as the lead, the
 * next four as a list, the rest and the stage table each one click down.
 */
function Moments({ c }: { c: Conference }) {
  const points = c.recap!.points;
  const rows = c.stage ? stageAgainstTrends(c) : [];
  const surprise = surpriseOf(c, rows);
  const [lead, ...rest] = points;
  const next = rest.slice(0, TOP - 1);
  const more = rest.slice(TOP - 1);
  return (
    <>
      {surprise && <SurpriseBox c={c} s={surprise} rows={rows} />}
      <section className="band" id="moments" aria-labelledby="moments-h">
        <div className="band__head">
          <h2 id="moments-h">{COUNT[Math.min(TOP, points.length)]} worth hearing</h2>
          <p>Ranked by the editor, the one most worth your time first.</p>
        </div>
        <p className="conf__caveat">
          Paraphrased by the editor from the recordings’ automatic captions or from the organiser’s transcripts and
          summaries; the note on what was and was not watched, below, says which for each day. Captions can mishear
          names and numbers, so each moment links to its time in the recording to be checked there.
        </p>
        <div className="moment--lead" id="moment-1">
          <p className="moment__n">
            <b>1</b> <span className="moment__tag">{topicName(lead.topic)}</span>
          </p>
          <p className="moment__said">{lead.said}</p>
          {lead.who && <p className="moment__who">{lead.who}</p>}
          {lead.at && (
            <p className="hear">
              <HearIt c={c} p={lead} />
            </p>
          )}
        </div>
        {next.length > 0 && (
          <ol className="moments" start={2}>
            {next.map((p, i) => (
              <Moment key={p.said} c={c} p={p} n={i + 2} />
            ))}
          </ol>
        )}
        {more.length > 0 && (
          <details className="more">
            <summary>
              {more.length} more {more.length === 1 ? "moment" : "moments"}{" "}
              <small>
                ranked {TOP + 1}
                {more.length > 1 && ` to ${points.length}`}
              </small>
            </summary>
            <ol className="moments" start={TOP + 1}>
              {more.map((p, i) => (
                <Moment key={p.said} c={c} p={p} n={i + TOP + 1} />
              ))}
            </ol>
          </details>
        )}
        {c.stage && (
          <details className="more more--wide" id="stage">
            <summary>
              How the {c.stage.source === "talks" ? "stage" : "programme"} compares with the numbers{" "}
              <small>({rows.length} topics)</small>
            </summary>
            <Stage c={c} />
          </details>
        )}
      </section>
    </>
  );
}

function Neighbour({ c, dir }: { c: Conference | null; dir: "prev" | "next" }) {
  if (!c) return <span />;
  return (
    <Link href={`/conferences/${c.id}`} className={`evnav__${dir}`} rel={dir}>
      <small>{dir === "prev" ? "‹ Previous" : "Next ›"}</small>
      <b>{c.name}</b>
    </Link>
  );
}

function NeighbourCard({ c, dir }: { c: Conference | null; dir: "prev" | "next" }) {
  if (!c) return <div />;
  return (
    <Link href={`/conferences/${c.id}`} className={`around__${dir}`}>
      <small>{dir === "prev" ? "‹ Before it on the calendar" : "After it on the calendar ›"}</small>
      <b>{c.name}</b>
      <span>
        {fmtSpan(c.start, c.end)} · {c.place} · {status(c)}
      </span>
    </Link>
  );
}

/** One conference's page: where it stands, and once watched, what was said and how it compares with the numbers. */
export function ConferenceEvent({ c }: { c: Conference }) {
  const place = neighbours(conferences, c.id)!;
  const month = c.start.slice(0, 7);
  const fromTalks = c.stage?.source === "talks";
  const read = hasReading(c);
  /** A recap with moments makes the page its 5-minute version; any other page keeps its layout. */
  const ranked = Boolean(c.recap?.points.length);

  return (
    <>
      <a className="skip" href="#event">
        Skip to the event
      </a>

      <ConfMast />

      <div className="bar">
        <div className="bar__inner">
          <nav className="bar__row evnav" aria-label="Events on the calendar">
            <Neighbour c={place.prev} dir="prev" />
            <Link href={`/conferences#${c.id}`} className="evnav__mid">
              <small>
                {ordinal(place.index + 1)} of {place.total}
              </small>
              <b>Calendar</b>
            </Link>
            <Neighbour c={place.next} dir="next" />
          </nav>
        </div>
      </div>

      <main className="page" id="event">
        <header className="ehead">
          <nav className="crumb" aria-label="Breadcrumb">
            <Link href="/conferences#now">Conferences</Link> › <Link href={`/conferences#m-${month}`}>{fmtMonthOf(c.start)}</Link>
          </nav>
          <p className="ehead__source">
            {status(c)} · {fmtSpan(c.start, c.end)} · {c.place} · {kindOf(c)}
          </p>
          <h1>{c.name}</h1>
          {c.note && <p className="ehead__dek">{c.note}</p>}
          <p className="ehead__links">
            Run by {c.host} · <a href={c.url} {...NEW_TAB}>The event’s own site</a>
            {c.recordings && (
              <>
                {" "}
                · <a href={c.recordings} {...NEW_TAB}>Its recordings channel</a>
              </>
            )}
          </p>
          {!ranked && (
            <>
              <Year c={c} />
              <Where c={c} />
            </>
          )}
        </header>

        {ranked && <Moments c={c} />}

        {c.recap && (
          <section className="band" aria-labelledby="said-h">
            <div className="band__head">
              <h2 id="said-h">What was said</h2>
              <p>
                Watched {fmtDate(c.recap.watchedOn)}
                {c.recap.partial && ", in part"}
              </p>
            </div>
            <div className="conf__recap prose">
              <p>{c.recap.summary}</p>
            </div>
            <div className={c.recap.partial ? "covered covered--partial" : "covered"}>
              <h3>{c.recap.partial ? "What was and was not watched" : "What was watched"}</h3>
              <p>{c.recap.coverage}</p>
            </div>
          </section>
        )}

        {!read && <Nothing c={c} />}
        {c.stage && !c.recap && (
          <p className="conf__pending">
            <span className="status status--fail">
              <span aria-hidden="true">▲</span> Not watched yet.
            </span>{" "}
            {phaseOf(c) === "upcoming" || phaseOf(c) === "underway"
              ? "The talks will be watched and summarised here once the event is over and the recordings have captions."
              : "The talks will be watched and summarised here once the recordings have captions."}
          </p>
        )}

        {c.stage && !ranked && (
          <section className="band" aria-labelledby="stage-h">
            <div className="band__head">
              <h2 id="stage-h">{fromTalks ? "The stage against the numbers" : "The programme against the numbers"}</h2>
            </div>
            <Stage c={c} />
          </section>
        )}

        {read && (c.videos?.length || c.programme?.length) ? (
          <section className="band" aria-labelledby="sources-h">
            <div className="band__head">
              <h2 id="sources-h">Recordings and programme</h2>
            </div>
            <div className="conf__more">
              {c.videos?.length ? (
                <p className="conf__videos">
                  <strong>Recordings:</strong>{" "}
                  {c.videos.map((v, i) => (
                    <span key={v.url}>
                      {i > 0 && " · "}
                      <a href={v.url} {...NEW_TAB}>{v.title}</a>
                    </span>
                  ))}
                </p>
              ) : null}
              <Programme c={c} />
            </div>
          </section>
        ) : null}

        {ranked && (
          <div className="band foot">
            <Where c={c} />
            <Year c={c} />
          </div>
        )}

        <nav className="around" aria-label="Before and after it on the calendar">
          <NeighbourCard c={place.prev} dir="prev" />
          <NeighbourCard c={place.next} dir="next" />
        </nav>
      </main>

      <ConfColophon />
    </>
  );
}

/** The page's title and description, from the same facts the page shows. */
export function eventMeta(c: Conference) {
  return {
    title: `${c.name}, ${fmtSpan(c.start, c.end)}: ${status(c)} · AI Trend Tracker`,
    description: c.recap
      ? `${c.name} in ${c.place}: what was said on stage, set against the tracker's research and discussion numbers.`
      : `${c.name} in ${c.place}, ${fmtSpan(c.start, c.end)}. Not watched yet, as of ${fmtDate(today)}: dates, place and status, and no claims about what was said.`,
  };
}
