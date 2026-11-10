import { fmtChange, type Direction } from "@/lib/trends";

export type MapPoint = {
  id: string;
  name: string;
  /** Change in share of AI papers, as a fraction. */
  research: number;
  /** Change in Hacker News stories, as a fraction. */
  discussion: number;
  direction: Direction;
};

/** Axis limits. A point beyond a limit is drawn on the edge; its true figure stays in the label. */
const X_MAX = 0.4;
const Y_MAX = 1;

const QUADRANTS = [
  { key: "both-up", title: "Both rising", test: (p: MapPoint) => p.research >= 0 && p.discussion >= 0 },
  { key: "talk", title: "Talk ahead of research", test: (p: MapPoint) => p.research < 0 && p.discussion >= 0 },
  { key: "research", title: "Research ahead of talk", test: (p: MapPoint) => p.research >= 0 && p.discussion < 0 },
  { key: "both-down", title: "Both cooling", test: (p: MapPoint) => p.research < 0 && p.discussion < 0 },
];

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

// Label placement runs on a virtual canvas the shape of the plot at its narrowest labelled width.
const VW = 700;
const VH = 394;
const DOT = 13;
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Picks, for each point, the first spot around its dot that hits no other dot or label. */
function placeLabels(points: { name: string; left: number; top: number }[]) {
  const dots: Box[] = points.map((p) => ({
    x: (p.left / 100) * VW - DOT,
    y: (p.top / 100) * VH - DOT,
    w: DOT * 2,
    h: DOT * 2,
  }));
  const placed: Box[] = [];
  return points.map((p, i) => {
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
    const box = spots.find(free) ?? spots[0];
    placed.push(box);
    return { left: (box.x / VW) * 100, top: (box.y / VH) * 100 };
  });
}

/**
 * Topics placed by how research (across) and discussion (up) moved.
 * Dots are numbered; the same numbers key the four lists underneath,
 * which also serve as the text alternative.
 */
export function MomentumMap({ points, unplaced }: { points: MapPoint[]; unplaced: string[] }) {
  if (points.length === 0) return null;
  const spots = points.map((p) => ({
    name: p.name,
    left: 50 + (clamp(p.research, X_MAX) / X_MAX) * 44,
    top: 50 - (clamp(p.discussion, Y_MAX) / Y_MAX) * 38,
  }));
  const labels = placeLabels(spots);

  return (
    <figure className="map">
      <figcaption className="map__caption">
        <strong>Where research and discussion agree.</strong> Across: change in the topic’s share of AI papers. Up:
        change in Hacker News stories. Each dot links to its row below.
        <span className="map__legend">
          Dot colour is the research call:
          <span><span className="change__mark change__mark--rising" aria-hidden="true">▲</span> rising</span>
          <span><span className="change__mark change__mark--steady" aria-hidden="true">■</span> steady</span>
          <span><span className="change__mark change__mark--cooling" aria-hidden="true">▼</span> cooling</span>
        </span>
      </figcaption>
      <div className="map__plot">
        <span className="map__axis map__axis--x" aria-hidden="true" />
        <span className="map__axis map__axis--y" aria-hidden="true" />
        <span className="map__corner map__corner--tl" aria-hidden="true">Talk ahead of research</span>
        <span className="map__corner map__corner--tr" aria-hidden="true">Both rising</span>
        <span className="map__corner map__corner--bl" aria-hidden="true">Both cooling</span>
        <span className="map__corner map__corner--br" aria-hidden="true">Research ahead of talk</span>
        <span className="map__tick map__tick--left" aria-hidden="true">Papers −{X_MAX * 100}%</span>
        <span className="map__tick map__tick--right" aria-hidden="true">+{X_MAX * 100}%</span>
        <span className="map__tick map__tick--top" aria-hidden="true">Stories +{Y_MAX * 100}%</span>
        <span className="map__tick map__tick--bottom" aria-hidden="true">−{Y_MAX * 100}%</span>
        {points.map((p, i) => (
          <a
            key={p.id}
            href={`#topic-${p.id}`}
            className={`map__dot map__dot--${p.direction}`}
            style={{ left: `${spots[i].left}%`, top: `${spots[i].top}%` }}
            data-tip={`${p.name}: papers ${fmtChange(p.research)}, stories ${fmtChange(p.discussion)}`}
            aria-label={`${p.name}: papers ${fmtChange(p.research)}, stories ${fmtChange(p.discussion)}`}
          >
            {i + 1}
          </a>
        ))}
        {points.map((p, i) => (
          <span
            key={p.id}
            className="map__name"
            style={{ left: `${labels[i].left}%`, top: `${labels[i].top}%` }}
            aria-hidden="true"
          >
            {p.name}
          </span>
        ))}
      </div>
      <div className="map__key">
        {QUADRANTS.map((q) => {
          const members = points.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => q.test(p));
          return (
            <div key={q.key}>
              <h3>{q.title}</h3>
              {members.length ? (
                <ul>
                  {members.map(({ p, n }) => (
                    <li key={p.id}>
                      <span className="map__num">{n}</span> {p.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None this week</p>
              )}
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <p className="map__note">Too little discussion or too few papers to place: {unplaced.join(", ")}.</p>
      )}
    </figure>
  );
}
