import type { LeadSeries } from "@/lib/briefing";
import { NEW_TAB } from "@/lib/links";
import { fmtChange, fmtDay } from "@/lib/trends";

const W = 320;
const H = 120;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;
const WEEK = 7 * 86_400_000;

/** Something that happened on a known day, marked on the charts for context. */
export type ChartEvent = { date: string; label: string; url: string };

/** Events falling in one charted week share a mark. `at` is a position along the weeks, 0 for the first. */
type Mark = { number: number; at: number; day: string; events: ChartEvent[] };

/** Gridline values: two to four round steps from zero that stay inside the chart. */
function ticks(top: number): number[] {
  const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50].find((s) => top / s <= 4) ?? 100;
  const out: number[] = [];
  for (let v = step; v <= top; v += step) out.push(Number(v.toFixed(2)));
  return out;
}

/**
 * The evidence for the headline, drawn large and labelled on the chart itself: each mover the
 * headline names as a line over the weeks charted, from zero, with the two periods being compared
 * shaded and named, their averages ruled across them and labelled, the scale marked on gridlines,
 * and the frontier model releases of those weeks numbered along the foot. Nothing a reader needs
 * is left to a tooltip.
 */
export function LeadChart({
  series,
  window,
  weeks,
  events,
}: {
  series: LeadSeries[];
  window: number;
  /** The Monday each charted week starts on (YYYY-MM-DD), oldest first. */
  weeks: string[];
  events: ChartEvent[];
}) {
  if (series.length === 0 || weeks.length < 2) return null;
  const start = Date.parse(weeks[0] + "T00:00:00Z");
  const byWeek = new Map<number, ChartEvent[]>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    const week = Math.floor((Date.parse(e.date) - start) / WEEK);
    if (week < 0 || week >= weeks.length) continue;
    byWeek.set(week, [...(byWeek.get(week) ?? []), e]);
  }
  const marks: Mark[] = [...byWeek.values()].map((list, i) => ({
    number: i + 1,
    // A point stands for its whole week, so it sits at the week's middle; the mark sits on the first release's day.
    at: (Date.parse(list[0].date) - start) / WEEK - 0.5,
    day: list[0].date,
    events: list,
  }));

  return (
    <div className="leadchart">
      <div className="leadchart__panels" data-count={series.length}>
        {series.map((s) => (
          <Panel key={s.measure} s={s} window={window} weeks={weeks} marks={marks} />
        ))}
      </div>
      {marks.length > 0 && (
        <p className="leadchart__key">
          <b>Frontier model releases</b>, marked for context and not offered as causes:{" "}
          {marks.map((m, i) => (
            <span key={m.number}>
              {i > 0 && " · "}
              <span className="leadchart__badge" aria-hidden="true">{m.number}</span>
              <span className="vh">Mark {m.number}: </span>{" "}
              {m.events.map((e, n) => (
                <span key={e.url}>
                  {n > 0 && ", "}
                  <a href={e.url} {...NEW_TAB}>{e.label}</a>
                </span>
              ))}
              , {fmtDay(m.day)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Panel({ s, window, weeks, marks }: { s: LeadSeries; window: number; weeks: string[]; marks: Mark[] }) {
  const values = s.signal.values;
  const n = values.length;
  const top = Math.max(...values, s.signal.prior, s.signal.recent) * 1.1 || 1;
  const step = (W - 2 * PAD_X) / Math.max(1, n - 1);
  const x = (i: number) => PAD_X + i * step;
  const y = (v: number) => PAD_TOP + (1 - v / top) * (H - PAD_TOP - PAD_BOTTOM);
  /** A period's edges fall midway between weeks, so neighbouring periods meet without overlapping. */
  const edge = (i: number) => Math.min(W, Math.max(0, x(i) - step / 2));
  const recentFrom = edge(n - window);
  const priorFrom = edge(n - 2 * window);
  const span = (count: number) => (count === 1 ? "week" : `${count} weeks`);
  const fmt = (v: number) => `${v.toFixed(1)}%`;
  /** Positions for the labels laid over the drawing, as shares of its width and height. */
  const left = (px: number) => `${(Math.min(W, Math.max(0, px)) / W) * 100}%`;
  const topOf = (v: number) => `${(y(v) / H) * 100}%`;
  const grid = ticks(top);
  const releases = marks.length
    ? ` Frontier model releases in these weeks: ${marks.map((m) => `${m.events.map((e) => e.label).join(" and ")} on ${fmtDay(m.day)}`).join("; ")}.`
    : "";
  const summary = `${s.name}: ${fmt(s.signal.recent)} ${s.unit} on average over the latest ${span(window)}, against ${fmt(s.signal.prior)} over the ${span(window)} before, ${fmtChange(s.signal.change)}. Weekly values from the week of ${fmtDay(weeks[0])} to the week of ${fmtDay(weeks[n - 1])}.${releases}`;

  return (
    <figure className={`leadchart__panel leadchart__panel--${s.direction}`}>
      <figcaption>
        <span className="leadchart__measure">{s.measure}</span>
        <strong className="leadchart__name">{s.name}</strong>
        <span className="leadchart__figure">
          <b>{fmtChange(s.signal.change)}</b> {fmt(s.signal.recent)} {s.unit}, was {fmt(s.signal.prior)}
        </span>
      </figcaption>
      <div className="leadchart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} preserveAspectRatio="none">
          <rect className="leadchart__prior" x={priorFrom} y={0} width={recentFrom - priorFrom} height={H} />
          <rect className="leadchart__recent" x={recentFrom} y={0} width={W - recentFrom} height={H} />
          {grid.map((v) => (
            <line key={v} className="leadchart__grid" x1={0} x2={W} y1={y(v)} y2={y(v)} />
          ))}
          {marks.map((m) => (
            <line key={m.number} className="leadchart__event" x1={x(m.at)} x2={x(m.at)} y1={0} y2={H} />
          ))}
          <line className="leadchart__zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
          <polyline className="leadchart__line" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          <line className="leadchart__mean" x1={priorFrom} x2={recentFrom} y1={y(s.signal.prior)} y2={y(s.signal.prior)} />
          <line className="leadchart__mean leadchart__mean--recent" x1={recentFrom} x2={W} y1={y(s.signal.recent)} y2={y(s.signal.recent)} />
        </svg>
        {/* The labels repeat what the text alternative above says, so they are hidden from screen readers. */}
        <div className="leadchart__labels" aria-hidden="true">
          {grid.map((v, i) => (
            <span key={v} className="leadchart__tick" style={{ top: topOf(v) }}>
              {i === grid.length - 1 ? `${v}% ${s.unit}` : `${v}%`}
            </span>
          ))}
          <span className="leadchart__band" style={{ left: left(priorFrom) }}>{span(window)} before</span>
          <span className="leadchart__band leadchart__band--recent" style={{ left: left(recentFrom) }}>latest {span(window)}</span>
          <span className="leadchart__avg" style={{ left: left(priorFrom), top: topOf(s.signal.prior) }}>
            average {fmt(s.signal.prior)}
          </span>
          <span className="leadchart__avg leadchart__avg--recent" style={{ left: left(recentFrom), top: topOf(s.signal.recent) }}>
            average {fmt(s.signal.recent)}
          </span>
        </div>
      </div>
      <div className="leadchart__foot" aria-hidden="true">
        {marks.map((m) => (
          <span key={m.number} className="leadchart__badge" style={{ left: left(x(m.at)) }}>{m.number}</span>
        ))}
      </div>
      <p className="leadchart__axis" aria-hidden="true">
        <span>Week of {fmtDay(weeks[0])}</span>
        <span>Week of {fmtDay(weeks[n - 1])}</span>
      </p>
    </figure>
  );
}
