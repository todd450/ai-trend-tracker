import { CHECK_AFTER, recordRows, type Called } from "@/lib/record";
import { replayRecord } from "@/lib/replay";
import { HORIZONS, type Horizon } from "@/lib/trends";

/** "3 months" → "3-month", for "3-month calls". */
const asAdjective = (label: string) => label.replace(/ (\w+?)s?$/, "-$1");

/**
 * How often this view's calls held over the past year, replayed at build time, beside the
 * headline so the reader can weigh it. Three lines, each a count, never a percentage, so it reads
 * no more precise than it is; the losing figures sit as plainly as the winning ones.
 */
export function TrackRecord({ horizon, headline }: { horizon: Horizon; headline: { topic?: Called; theme?: boolean } }) {
  const { record, needed, stored } = replayRecord(horizon);
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
