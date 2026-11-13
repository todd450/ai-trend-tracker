import type { LeadSeries } from "@/lib/briefing";
import { fmtChange } from "@/lib/trends";

const W = 320;
const H = 120;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;

/**
 * The evidence for the headline, drawn large: each mover the headline names as a line over the
 * weeks charted, from zero, with the two periods being compared shaded and their averages ruled
 * across them. The step between the two rules is the change the headline reports.
 */
export function LeadChart({ series, window, from }: { series: LeadSeries[]; window: number; from: string }) {
  if (series.length === 0) return null;
  return (
    <div className="leadchart" data-count={series.length}>
      {series.map((s) => (
        <Panel key={s.measure} s={s} window={window} from={from} />
      ))}
    </div>
  );
}

function Panel({ s, window, from }: { s: LeadSeries; window: number; from: string }) {
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
  const weeks = (count: number) => (count === 1 ? "week" : `${count} weeks`);
  const fmt = (v: number) => `${v.toFixed(1)}%`;
  const summary = `${s.name}: ${fmt(s.signal.recent)} ${s.unit} on average over the latest ${weeks(window)}, against ${fmt(s.signal.prior)} over the ${weeks(window)} before, ${fmtChange(s.signal.change)}.`;

  return (
    <figure className={`leadchart__panel leadchart__panel--${s.direction}`}>
      <figcaption>
        <span className="leadchart__measure">{s.measure}</span>
        <strong className="leadchart__name">{s.name}</strong>
        <span className="leadchart__figure">
          <b>{fmtChange(s.signal.change)}</b> {fmt(s.signal.recent)} {s.unit}, was {fmt(s.signal.prior)}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} preserveAspectRatio="none">
        <rect className="leadchart__prior" x={priorFrom} y={0} width={recentFrom - priorFrom} height={H} />
        <rect className="leadchart__recent" x={recentFrom} y={0} width={W - recentFrom} height={H} />
        <line className="leadchart__zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
        <polyline className="leadchart__line" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        <line className="leadchart__mean" x1={priorFrom} x2={recentFrom} y1={y(s.signal.prior)} y2={y(s.signal.prior)} />
        <line className="leadchart__mean leadchart__mean--recent" x1={recentFrom} x2={W} y1={y(s.signal.recent)} y2={y(s.signal.recent)} />
      </svg>
      <p className="leadchart__axis" aria-hidden="true">
        <span>from {from}</span>
        <span>
          {weeks(window)} before <i>|</i> latest {weeks(window)}
        </span>
      </p>
    </figure>
  );
}
