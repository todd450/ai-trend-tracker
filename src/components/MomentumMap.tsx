import { fmtChange, type Direction } from "@/lib/trends";

export type MapPoint = {
  id: string;
  name: string;
  /** The topic's place in the table below; the number on its dot. */
  rank: number;
  /** Change in share of AI papers, as a fraction. */
  research: number;
  /** Change in Hacker News stories, as a fraction. */
  discussion: number;
  direction: Direction;
  /** False when the topic's counts are small enough that its position should be read with care. */
  firm: boolean;
};

/** An axis ends on the first of these that covers its largest change, so every dot fits. */
const AXIS_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
/** Round changes that can carry a gridline. */
const TICKS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];

function axisMax(values: number[]) {
  const top = Math.max(0.1, ...values.map(Math.abs));
  return AXIS_STEPS.find((step) => step >= top) ?? top;
}

/** The two largest round changes that sit clear of the edge. */
const ticksFor = (max: number) => TICKS.filter((t) => t <= max * 0.7).slice(-2);

/**
 * Position on an axis, from −1 to 1. The scale is a square root, so the many small
 * changes near the middle stay apart and one large change does not flatten the rest.
 * The gridlines carry the real figures.
 */
const place = (v: number, max: number) => Math.sign(v) * Math.sqrt(Math.min(Math.abs(v), max) / max);

const X_REACH = 44;
const Y_REACH = 40;

const QUADRANTS = [
  { key: "both-up", title: "Both rising", test: (p: MapPoint) => p.research >= 0 && p.discussion >= 0 },
  { key: "talk", title: "Talk ahead of research", test: (p: MapPoint) => p.research < 0 && p.discussion >= 0 },
  { key: "research", title: "Research ahead of talk", test: (p: MapPoint) => p.research >= 0 && p.discussion < 0 },
  { key: "both-down", title: "Both cooling", test: (p: MapPoint) => p.research < 0 && p.discussion < 0 },
];

// Label placement runs on a virtual canvas the shape of the plot at its narrowest labelled width.
const VW = 700;
const VH = 384;
const DOT = 13;
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Picks, for each point, the first spot around its dot that hits no other dot or label.
 * A point with no free spot goes without a name on the plot; its number still keys it to the lists.
 */
function placeLabels(points: { name: string; left: number; top: number; firm: boolean }[]) {
  const dots: Box[] = points.map((p) => ({
    x: (p.left / 100) * VW - DOT,
    y: (p.top / 100) * VH - DOT,
    w: DOT * 2,
    h: DOT * 2,
  }));
  const placed: Box[] = [];
  const result: ({ left: number; top: number } | null)[] = points.map(() => null);
  // Topics with firm counts choose first, so a crowded plot names the ones that matter most.
  const order = points.map((_, i) => i).sort((a, b) => Number(points[b].firm) - Number(points[a].firm));
  for (const i of order) {
    const p = points[i];
    const cx = (p.left / 100) * VW;
    const cy = (p.top / 100) * VH;
    const w = p.name.length * 7.4 + 6;
    const h = 20;
    const spots: Box[] = [
      { x: cx + DOT + 5, y: cy - h / 2, w, h },
      { x: cx - DOT - 5 - w, y: cy - h / 2, w, h },
      { x: cx - w / 2, y: cy - DOT - h - 2, w, h },
      { x: cx - w / 2, y: cy + DOT + 2, w, h },
      { x: cx + DOT, y: cy - DOT - h, w, h },
      { x: cx + DOT, y: cy + DOT, w, h },
      { x: cx - DOT - w, y: cy - DOT - h, w, h },
      { x: cx - DOT - w, y: cy + DOT, w, h },
    ];
    const free = (b: Box) =>
      b.x >= 0 && b.x + b.w <= VW && b.y >= 0 && b.y + b.h <= VH &&
      !placed.some((o) => overlaps(b, o)) && !dots.some((d, j) => j !== i && overlaps(b, d));
    const box = spots.find(free);
    if (!box) continue;
    placed.push(box);
    result[i] = { left: (box.x / VW) * 100, top: (box.y / VH) * 100 };
  }
  return result;
}

const signed = (v: number) => `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%`;

/**
 * Topics placed by how research (across) and discussion (up) moved.
 * Each dot carries the topic's number in the table below; the four lists
 * underneath use the same numbers and serve as the text alternative.
 */
export function MomentumMap({ points, unplaced }: { points: MapPoint[]; unplaced: string[] }) {
  if (points.length === 0) return null;
  const xMax = axisMax(points.map((p) => p.research));
  const yMax = axisMax(points.map((p) => p.discussion));
  const left = (v: number) => 50 + place(v, xMax) * X_REACH;
  const top = (v: number) => 50 - place(v, yMax) * Y_REACH;
  const xTicks = ticksFor(xMax).flatMap((t) => [-t, t]);
  /** On a phone only the outer gridline of each side has room for its figure. */
  const xLabelled = Math.max(...ticksFor(xMax), 0);
  const yTicks = ticksFor(yMax).flatMap((t) => [-t, t]);
  const spots = points.map((p) => ({ name: p.name, left: left(p.research), top: top(p.discussion), firm: p.firm }));
  const labels = placeLabels(spots);
  const anySoft = points.some((p) => !p.firm);
  const tip = (p: MapPoint) =>
    `${p.name}: papers ${fmtChange(p.research)}, stories ${fmtChange(p.discussion)}${p.firm ? "" : " (small numbers)"}`;

  return (
    <figure className="map">
      <figcaption className="map__caption">
        <strong>Where research and discussion agree.</strong> Further right means a bigger rise in the topic’s share of
        AI papers; further up, a bigger rise in Hacker News stories. Each dot carries the topic’s number in the table
        below and links to its row.
        <span className="map__legend">
          <span><span className="map__swatch map__swatch--rising" aria-hidden="true" /> research rising</span>
          <span><span className="map__swatch map__swatch--steady" aria-hidden="true" /> steady</span>
          <span><span className="map__swatch map__swatch--cooling" aria-hidden="true" /> cooling</span>
          {anySoft && (
            <span><span className="map__swatch map__swatch--soft" aria-hidden="true" /> small numbers, read with care</span>
          )}
        </span>
      </figcaption>
      <p className="map__axis-title" aria-hidden="true">↑ Discussion: change in Hacker News stories</p>
      <div className="map__plot">
        {xTicks.map((t) => (
          <span
            key={`x${t}`}
            className={`map__grid map__grid--x${Math.abs(t) < xLabelled ? " map__grid--minor" : ""}`}
            style={{ left: `${left(t)}%` }}
            aria-hidden="true"
          >
            <span>{signed(t)}</span>
          </span>
        ))}
        {yTicks.map((t) => (
          <span key={`y${t}`} className="map__grid map__grid--y" style={{ top: `${top(t)}%` }} aria-hidden="true">
            <span>{signed(t)}</span>
          </span>
        ))}
        <span className="map__axis map__axis--x" aria-hidden="true" />
        <span className="map__axis map__axis--y" aria-hidden="true" />
        <span className="map__corner map__corner--tl" aria-hidden="true">Talk ahead of research</span>
        <span className="map__corner map__corner--tr" aria-hidden="true">Both rising</span>
        <span className="map__corner map__corner--bl" aria-hidden="true">Both cooling</span>
        <span className="map__corner map__corner--br" aria-hidden="true">Research ahead of talk</span>
        {points.map((p, i) => (
          <a
            key={p.id}
            href={`#topic-${p.id}`}
            className={`map__dot map__dot--${p.direction}${p.firm ? "" : " map__dot--soft"}`}
            style={{ left: `${spots[i].left}%`, top: `${spots[i].top}%` }}
            data-tip={tip(p)}
            aria-label={tip(p)}
          >
            {p.rank}
          </a>
        ))}
        {points.map((p, i) => {
          const label = labels[i];
          return (
            label && (
              <span
                key={p.id}
                className="map__name"
                style={{ left: `${label.left}%`, top: `${label.top}%` }}
                aria-hidden="true"
              >
                {p.name}
              </span>
            )
          );
        })}
      </div>
      <p className="map__axis-title map__axis-title--x" aria-hidden="true">Research: change in share of AI papers →</p>
      <div className="map__key">
        {QUADRANTS.map((q) => {
          const members = points.filter(q.test);
          return (
            <div key={q.key}>
              <h3>{q.title}</h3>
              {members.length ? (
                <ul>
                  {members.map((p) => (
                    <li key={p.id}>
                      <span className="map__num">{p.rank}</span> {p.name}
                      {!p.firm && <span className="vh"> (small numbers)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <p className="map__note">
          Not placed, with no papers or stories in the earlier weeks to compare against: {unplaced.join(", ")}.
        </p>
      )}
    </figure>
  );
}
