import { Ledger } from "@/components/Ledger";
import type { LeadSeries } from "@/lib/briefing";
import { COUNTED_WEEKS, seriesOf, storiesByWeek, type CountedMove, type Span } from "@/lib/counted";
import { NEW_TAB, host } from "@/lib/links";
import { fmtCompact, fmtDay } from "@/lib/trends";

/** The anchor of a move's list, which the briefing line about it links to. */
export const countedId = (s: Pick<LeadSeries, "measure" | "id">) => `counted-${seriesOf(s.measure)}-${s.id}`;

const DAY = 86_400_000;

/** "12 Oct – 8 Nov", with the years when the window crosses one. */
function fmtSpan({ first, last }: Span): string {
  const end = new Date(Date.parse(`${last}T00:00:00Z`) + 6 * DAY).toISOString();
  const year = (iso: string) => iso.slice(0, 4);
  return year(first) === year(end)
    ? `${fmtDay(first)} – ${fmtDay(end)}`
    : `${fmtDay(first)} ${year(first)} – ${fmtDay(end)} ${year(end)}`;
}

/** Points, with a bar against the largest in the list. */
function Mag({ value, max }: { value: number; max: number }) {
  return (
    <span className="ledger__mag">
      <span className="ledger__bar" aria-hidden="true">
        <span style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="ledger__num">
        {fmtCompact(value)}
        <span className="ledger__unit"> points</span>
      </span>
    </span>
  );
}

/**
 * The foot of a lead chart's panel. Under a rise, what was counted: a story from each of the latest
 * weeks (the three with the most points when the window is under three weeks), or three example
 * papers, with the window, how many matched and the rule that chose them. Under a fall,
 * one line saying why there is no list. With nothing collected for a rise, nothing.
 */
export function CountedFoot({
  s,
  move,
  matched,
  window,
}: {
  s: LeadSeries;
  move: CountedMove | null;
  /** How many stories or papers the window's counts hold. */
  matched: number;
  window: number;
}) {
  const papers = seriesOf(s.measure) === "topic";
  const noun = papers ? "papers" : "stories";
  if (s.direction === "cooling") {
    return (
      <div className="leadchart__evidence leadchart__evidence--none">
        <p>
          No list under a fall: a fall means fewer {noun}, so no {noun} stand for it.
        </p>
      </div>
    );
  }
  if (!move) return null;
  const id = countedId(s);
  const span = window === 1 ? "the latest week" : `the latest ${window} weeks`;
  const dates = fmtSpan(move);

  if ("papers" in move) {
    const n = move.papers.length;
    return (
      <section className="leadchart__evidence" id={id} aria-labelledby={`${id}-h`}>
        <h3 id={`${id}-h`}>Examples of the papers counted</h3>
        <p className="leadchart__rule">
          {n} of {Math.max(matched, n).toLocaleString("en")} papers in {span} ({dates}), those upvoted on Hugging Face first,
          then the newest.
        </p>
        <Ledger all first="Paper" labelledBy={`${id}-h`} count={n} kind="paper" cells={[{ head: "Found by", width: "9.5rem", start: true }]}>
          {move.papers.map((p) => (
            <li key={p.id}>
              <span className="ledger__main">
                <a href={p.url} {...NEW_TAB}>{p.title}</a>
                <span className="ledger__note">
                  {host(p.url)} · {fmtDay(p.publishedAt)}
                </span>
              </span>
              <span className="ledger__data">
                <span className="ledger__cell--start">
                  {p.upvotes ? (
                    <>
                      <span aria-hidden="true">▲</span>
                      {p.upvotes}
                      <span className="vh"> upvotes</span> on Hugging Face
                    </>
                  ) : (
                    "arXiv"
                  )}
                </span>
              </span>
            </li>
          ))}
        </Ledger>
      </section>
    );
  }

  const n = move.stories.length;
  const max = Math.max(...move.stories.map((x) => x.points));
  const of = `of ${Math.max(matched, n).toLocaleString("en")} matching stories in ${span} (${dates})`;
  return (
    <section className="leadchart__evidence" id={id} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>What was counted</h3>
      <p className="leadchart__rule">
        {storiesByWeek(move)
          ? `The most-discussed story from each ${window > COUNTED_WEEKS ? `of the last ${COUNTED_WEEKS} weeks` : "week"}, newest first, ${of}.`
          : `The ${n === 1 ? "" : `${n} `}most-discussed ${of}, most points first.`}
      </p>
      <Ledger
        all
        first="Story"
        labelledBy={`${id}-h`}
        count={n}
        cells={[
          { head: "Points", width: "5.5rem" },
          { head: "Comments", width: "4.25rem" },
        ]}
      >
        {move.stories.map((x) => (
          <li key={x.discussionUrl}>
            <span className="ledger__main">
              <a href={x.url} {...NEW_TAB}>{x.title}</a>
              <span className="ledger__note">
                {host(x.url)} · {fmtDay(x.createdAt)}
              </span>
            </span>
            <span className="ledger__data">
              <Mag value={x.points} max={max} />
              <span>
                <a href={x.discussionUrl} {...NEW_TAB}>
                  {fmtCompact(x.comments)}
                  <span className="ledger__unit"> comments</span>
                </a>
              </span>
            </span>
          </li>
        ))}
      </Ledger>
    </section>
  );
}
