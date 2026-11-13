import { fmtChange, heldBack, signalDirection, type Direction, type Signal } from "@/lib/trends";

export type BarTopic = {
  id: string;
  name: string;
  blurb: string;
  /** Research direction; decides which group the topic sits in. */
  direction: Direction;
  papers: Signal;
  stories: Signal;
  hasPapers: boolean;
  /** False when the weekly counts behind a change are small enough that it should be read with care. */
  papersFirm: boolean;
  storiesFirm: boolean;
};

const GROUPS: { direction: Direction; title: string }[] = [
  { direction: "rising", title: "Research rising" },
  { direction: "steady", title: "Research steady" },
  { direction: "cooling", title: "Research cooling" },
];

/** A column's bars end on the first of these that covers its largest change. */
const EXTENTS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 5, 10];
export const extentOf = (changes: (number | null)[]) => {
  const top = Math.max(0.1, ...changes.map((c) => Math.abs(c ?? 0)));
  return EXTENTS.find((e) => e >= top) ?? top;
};

/**
 * The series behind a change, week by week, as a small line. Each line starts from zero on its own
 * scale, so it shows the shape of the series (a spike, a climb, a slide) and not its size; size is
 * carried by the thickness of the bar beside it and by the order of the rows.
 */
function Spark({ values, tone }: { values: number[]; tone: Direction }) {
  if (values.length < 2) return <span className="mom__spark" />;
  const W = 60;
  const H = 20;
  const top = Math.max(...values) || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 1 - (v / top) * (H - 3)}`).join(" ");
  return (
    <svg className={`mom__spark mom__spark--${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} />
      <polyline points={points} />
    </svg>
  );
}

/**
 * One change as a line over time, then a bar growing left or right from a shared zero line, with
 * its figure and the current level. The bar's length is the relative change; its thickness is how
 * large the series is, so a big swing in a small series does not outweigh a small one in a large series.
 */
export function Bar({
  signal,
  extent,
  firm,
  label,
  level,
  tip,
  band = 0.1,
  note,
  weight = 1,
}: {
  signal: Signal;
  extent: number;
  firm: boolean;
  label: string;
  level: React.ReactNode;
  tip: string;
  /** A change smaller than this, or no bigger than the series' usual week-to-week swing, is drawn as steady. */
  band?: number;
  /** Shown in place of the bar when there is no change to draw. */
  note?: string;
  /** How large the series is beside the largest in its list, 0 to 1; sets the bar's thickness. Full when not given. */
  weight?: number;
}) {
  const change = signal.change ?? 0;
  const tone = signalDirection(signal, band);
  /** Large enough to print as a rise or fall, but within the series' usual swing: drawn grey, and says so. */
  const held = heldBack(signal, band);
  const width = `${(Math.min(Math.abs(change), extent) / extent) * 50}%`;
  return (
    <div className={`mom__signal${firm ? "" : " mom__signal--soft"}${held ? " mom__signal--held" : ""}`} title={held ? `${tip} (within its usual swing, so not called)` : tip}>
      <span className="mom__label">{label}</span>
      <Spark values={signal.values} tone={tone} />
      <span className={`mom__track${signal.change === null && note ? " mom__track--note" : ""}`} aria-hidden={signal.change === null && note ? undefined : true}>
        {signal.change === null && note}
        {signal.change !== null && change !== 0 && (
          <span
            className={`mom__bar mom__bar--${tone}`}
            style={{
              ...(change > 0 ? { left: "50%", width } : { right: "50%", width }),
              // Square root, so a series a tenth the size still gets a bar a third as thick, not a hairline.
              height: `${0.1875 + 0.5625 * Math.sqrt(Math.min(1, Math.max(0, weight)))}rem`,
            }}
          />
        )}
      </span>
      <span className="mom__change">
        {signal.change === null && note ? "" : fmtChange(signal.change)}
        {held && <span className="vh"> (within its usual swing, so not called)</span>}
        {!firm && <span className="vh"> (small numbers)</span>}
      </span>
      <span className="mom__level">{level}</span>
    </div>
  );
}

/**
 * Every topic on one line: how its research and its discussion changed, as bars from a zero line.
 * Topics are grouped by where research went, so the headings carry the finding and the
 * bars beside them show whether discussion agrees.
 */
export function MomentumBars({ topics, minPapers, minStories }: { topics: BarTopic[]; minPapers: number; minStories: number }) {
  const researchExtent = extentOf(topics.filter((t) => t.hasPapers).map((t) => t.papers.change));
  const discussionExtent = extentOf(topics.map((t) => t.stories.change));
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const topShare = Math.max(...topics.filter((t) => t.hasPapers).map((t) => t.papers.recent), 0) || 1;
  const topStories = Math.max(...topics.map((t) => t.stories.recent), 0) || 1;
  const anySoft = topics.some((t) => !t.papersFirm || !t.storiesFirm);

  return (
    <div className="mom">
      <div className="trend-cols" aria-hidden="true">
        <span>Topic</span>
        <span>Research <i>share of AI papers: by week, change, now</i></span>
        <span>Discussion <i>Hacker News stories: by week, change, now</i></span>
      </div>
      {GROUPS.map((group) => {
        const members = topics.filter((t) => t.direction === group.direction);
        if (members.length === 0) return null;
        // Rows are numbered down the page, so the numbers run on from the groups above.
        const before = GROUPS.slice(0, GROUPS.indexOf(group)).reduce(
          (count, g) => count + topics.filter((t) => t.direction === g.direction).length,
          0,
        );
        return (
          <section key={group.direction} className={`mom__group mom__group--${group.direction}`}>
            <h3>
              {group.title} <span>{members.length}</span>
            </h3>
            <ol start={before + 1}>
              {members.map((t, i) => {
                const rank = before + i + 1;
                const stories = Math.round(t.stories.recent);
                return (
                  <li key={t.id} id={`topic-${t.id}`} className="mom__row">
                    <div className="mom__topic" title={t.blurb}>
                      <span className="mom__rank">{rank}</span>
                      <h4>{t.name}</h4>
                    </div>
                    {t.hasPapers ? (
                      <Bar
                        signal={t.papers}
                        extent={researchExtent}
                        firm={t.papersFirm}
                        weight={t.papers.recent / topShare}
                        label="Research"
                        tip={`${t.name}: ${t.papers.recent.toFixed(1)}% of AI papers, was ${t.papers.prior.toFixed(1)}%${t.papersFirm ? "" : " (small numbers)"}`}
                        level={<>{t.papers.recent.toFixed(1)}%<span className="vh"> of papers</span></>}
                      />
                    ) : (
                      <p className="mom__pending">Paper counts not collected yet</p>
                    )}
                    <Bar
                      signal={t.stories}
                      extent={discussionExtent}
                      firm={t.storiesFirm}
                      weight={t.stories.recent / topStories}
                      label="Discussion"
                      tip={`${t.name}: ${t.stories.recent.toFixed(1)} Hacker News stories a week, was ${t.stories.prior.toFixed(1)}${t.storiesFirm ? "" : " (small numbers)"}`}
                      level={
                        <>
                          {stories}
                          <span aria-hidden="true">/wk</span>
                          <span className="vh"> {stories === 1 ? "story" : "stories"} a week</span>
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <p className="mom__note">
        Within each group the largest topics come first. Each line shows the weeks charted, from zero on its own
        scale, so read it for shape. A bar’s length is the change and its thickness is the topic’s size beside the
        largest in its column. Bars run to ±{pct(researchExtent)} for research and ±{pct(discussionExtent)} for discussion. Steady means a
        change under 10%, or one no bigger than the topic’s usual swing from week to week: those keep their
        figure and a grey bar.
        {anySoft && (
          <>
            {" "}
            <span className="mom__swatch" aria-hidden="true" /> Outlined bars rest on fewer than {minPapers} papers or{" "}
            {minStories} stories a week; read them with care.
          </>
        )}
      </p>
    </div>
  );
}
