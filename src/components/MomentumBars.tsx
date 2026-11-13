import { directionOf, fmtChange, type Direction, type Signal } from "@/lib/trends";

export type BarTopic = {
  id: string;
  name: string;
  blurb: string;
  /** The topic's place in the list, ordered by research change. */
  rank: number;
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

/** One change as a bar growing left or right from a shared zero line, with its figure and the current level. */
export function Bar({
  signal,
  extent,
  firm,
  label,
  level,
  tip,
  band = 0.1,
  note,
}: {
  signal: Signal;
  extent: number;
  firm: boolean;
  label: string;
  level: React.ReactNode;
  tip: string;
  /** A change smaller than this is drawn as steady. */
  band?: number;
  /** Shown in place of the bar when there is no change to draw. */
  note?: string;
}) {
  const change = signal.change ?? 0;
  const tone = directionOf(signal.change, band);
  const width = `${(Math.min(Math.abs(change), extent) / extent) * 50}%`;
  return (
    <div className={`mom__signal${firm ? "" : " mom__signal--soft"}`} title={tip}>
      <span className="mom__label">{label}</span>
      <span className={`mom__track${signal.change === null && note ? " mom__track--note" : ""}`} aria-hidden={signal.change === null && note ? undefined : true}>
        {signal.change === null && note}
        {signal.change !== null && change !== 0 && (
          <span
            className={`mom__bar mom__bar--${tone}`}
            style={change > 0 ? { left: "50%", width } : { right: "50%", width }}
          />
        )}
      </span>
      <span className="mom__change">
        {signal.change === null && note ? "" : fmtChange(signal.change)}
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
  const anySoft = topics.some((t) => !t.papersFirm || !t.storiesFirm);

  return (
    <div className="mom">
      <div className="trend-cols" aria-hidden="true">
        <span>Topic</span>
        <span>Research <i>change in share of AI papers, now</i></span>
        <span>Discussion <i>change in Hacker News stories, now</i></span>
      </div>
      {GROUPS.map((group) => {
        const members = topics.filter((t) => t.direction === group.direction);
        if (members.length === 0) return null;
        return (
          <section key={group.direction} className={`mom__group mom__group--${group.direction}`}>
            <h3>
              {group.title} <span>{members.length}</span>
            </h3>
            <ol start={members[0].rank}>
              {members.map((t) => {
                const stories = Math.round(t.stories.recent);
                return (
                  <li key={t.id} id={`topic-${t.id}`} className="mom__row">
                    <div className="mom__topic" title={t.blurb}>
                      <span className="mom__rank">{t.rank}</span>
                      <h4>{t.name}</h4>
                    </div>
                    {t.hasPapers ? (
                      <Bar
                        signal={t.papers}
                        extent={researchExtent}
                        firm={t.papersFirm}
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
        Bars run to ±{pct(researchExtent)} for research and ±{pct(discussionExtent)} for discussion. Steady means a
        change under 10%.
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
