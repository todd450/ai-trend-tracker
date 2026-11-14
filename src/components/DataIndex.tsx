import Link from "next/link";
import { Spark } from "@/components/MomentumBars";
import { datasetIndex } from "@/lib/datasets";
import { HORIZONS, fmtChange, type Horizon } from "@/lib/trends";

/**
 * The trends page's contents: one row per dataset, with what it measures, its biggest move in this
 * range, its source and the date of its newest figures. Topic momentum's row leads to its own page;
 * the others lead to their sections further down this page.
 */
export function DataIndex({ horizon }: { horizon: Horizon }) {
  const rows = datasetIndex(horizon);
  const span = HORIZONS[horizon].label;
  return (
    <section id="data" className="chapter dindex" aria-labelledby="data-h">
      <header className="chapter__head">
        <h2 className="chapter__title" id="data-h">
          The data
        </h2>
        <p className="chapter__dek">
          {rows.length} datasets. Topic momentum has its own page, with a table, a file to download and how it is
          counted; the others follow on this page. The move shown is the largest that clears the noise rule, over{" "}
          {span} unless marked.
        </p>
      </header>
      <div className="dindex__cols" aria-hidden="true">
        <span>Dataset</span>
        <span>Biggest move</span>
        <span>Source and latest figures</span>
      </div>
      <ol className="dindex__list">
        {rows.map((d, i) => (
          // The topics section was at /#momentum before it had a page; old links land on its row.
          <li key={d.id} id={d.id === "topics" ? "momentum" : undefined} className="dindex__row">
            <span className="dindex__n" aria-hidden="true">
              {i + 1}
            </span>
            <div className="dindex__name">
              <h3>
                <Link href={d.href}>{d.name}</Link>
              </h3>
              <p>{d.about}</p>
            </div>
            <div className="dindex__move">
              {d.move ? (
                <>
                  <span className="dindex__figure">
                    <Spark values={d.move.values} tone={d.move.direction} />
                    <b className={`dindex__change dindex__change--${d.move.direction}`}>{fmtChange(d.move.change)}</b>
                  </span>
                  <p>{d.move.text}</p>
                </>
              ) : (
                <p className="dindex__none">Nothing moved far enough to call{d.sameEverySpan ? "" : ` over ${span}`}.</p>
              )}
            </div>
            <p className="dindex__src">
              {d.sources}
              <span>Latest: {d.latest}</span>
              {d.sameEverySpan && <span className="dindex__tag">same in every span</span>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
