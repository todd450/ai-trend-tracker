import { CHECK_AFTER, dueDecimals, recordRows, type Called, type DueCall } from "@/lib/record";
import { replayRecord } from "@/lib/replay";
import { HORIZONS, fmtWeek, type Horizon } from "@/lib/trends";

/** "3 months" → "3-month", for "3-month calls". */
const asAdjective = (label: string) => label.replace(/ (\w+?)s?$/, "-$1");

/** What a share is a share of. */
const SHARE_OF = { topic: "of papers", theme: "of AI stories" } as const;

/**
 * The calls behind the record, by name: those checked in the latest week, or, when none came due
 * then, those of the most recent week that had any, labelled with its week. `weeks[i]` is the
 * Monday of the reading at `i`.
 */
function CallsChecked({ checked, weeks }: { checked: { latest: DueCall[]; earlier: { at: number; calls: DueCall[] } | null }; weeks: string[] }) {
  const last = weeks.length - 1;
  const shown = checked.latest.length ? { at: last, calls: checked.latest } : checked.earlier;
  return (
    <div id="calls-checked" className="record__due">
      <div className="record__head">
        <h3>Calls checked, by name</h3>
      </div>
      {!checked.latest.length && (
        <p className="record__when">
          No call came due in the latest week, {fmtWeek(weeks[last])}
          {shown ? "." : ", nor in any week of the past year."}
        </p>
      )}
      {shown && (
        <>
          <p className="record__when">
            {shown.at === last ? "Due in the latest week" : "The most recent to come due"}, {fmtWeek(weeks[shown.at])}: calls
            first made {CHECK_AFTER} weeks earlier, in the week of {fmtWeek(weeks[shown.at - CHECK_AFTER])}.
          </p>
          <ol>
            {shown.calls.map((call) => {
              const places = dueDecimals(call.then, call.now);
              return (
                <li key={`${call.series}:${call.key}`} className="record__call">
                  <b>{call.name}</b>, called {call.direction} at {call.then.toFixed(places)}% {SHARE_OF[call.series]}. Now{" "}
                  {call.now.toFixed(places)}%.{" "}
                  <span className={call.held ? "record__held" : "record__missed"}>{call.held ? "Held." : "Did not hold."}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * How often this view's calls held over the past year, replayed at build time, beside the
 * headline so the reader can weigh it. Three lines, each a count, never a percentage, so it reads
 * no more precise than it is; the losing figures sit as plainly as the winning ones.
 * Under them, the calls checked most recently, by name.
 */
export function TrackRecord({ horizon, headline }: { horizon: Horizon; headline: { topic?: Called; theme?: boolean } }) {
  const { record, checked, weeks, needed, stored } = replayRecord(horizon);
  const { label } = HORIZONS[horizon];
  return (
    <section id="record" className="record" aria-labelledby="record-h">
      <div className="record__head">
        <h2 id="record-h">Track record</h2>
        <p>{record ? `${asAdjective(label)} calls over the past year` : `${asAdjective(label)} calls`}</p>
      </div>
      {record ? (
        <>
          <ol>
            {recordRows(record, headline).map((row) => (
              <li key={row.id} className={`record__row${row.inHeadline ? " record__row--today" : ""}`}>
                <span className="record__figure">
                  {row.held} <small>of {row.calls}</small>
                </span>
                <span className="record__label">
                  <span>
                    <b>{row.label}:</b> {row.outcome}
                  </span>
                  {row.few && <span className="record__tag">few calls</span>}
                  {row.inHeadline && <span className="record__tag">in today’s headline</span>}
                </span>
                <span className={`rbar rbar--${row.tone}`} aria-hidden="true">
                  <span style={{ width: `${row.calls ? (row.held / row.calls) * 100 : 0}%` }} />
                </span>
              </li>
            ))}
          </ol>
          {checked && <CallsChecked checked={checked} weeks={weeks} />}
          <p className="record__test">
            A call is counted once, in the week it first appears. It held if, {CHECK_AFTER} weeks later, the share
            had moved further the way it was called. This is a replay of the past year with today’s rules and
            today’s counts, not a record of what the page said at the time.{" "}
            <a href="#track-record">How we check →</a>
          </p>
        </>
      ) : (
        <>
          <p className="record__empty">
            Not enough history yet to check calls on the {asAdjective(label)} view: a year of its calls, each checked{" "}
            {CHECK_AFTER} weeks later, needs {needed} weeks of counts, and {stored} are stored.
          </p>
          <p className="record__test">
            The shorter views carry a record. <a href="#track-record">How we check →</a>
          </p>
        </>
      )}
    </section>
  );
}
