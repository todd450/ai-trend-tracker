"use client";

import { useState } from "react";

export type Cell = { head: string; width: string; start?: boolean };

/** How many items a list shows before the reader asks for the rest: five, or three on a phone (set in the stylesheet). */
const FIRST = 5;
const FIRST_PHONE = 3;

type Props = {
  first: string;
  cells: Cell[];
  labelledBy: string;
  /** How many items `children` holds. */
  count: number;
  /** Sets the titles: headlines to read, paper titles, or the names of things to use. */
  kind?: "read" | "paper" | "thing";
  /** A link to the full list at its source, set beside the show-more control. */
  more?: React.ReactNode;
  /** Shows three items on every screen until asked for more: for reference lists, which should not crowd the page. */
  brief?: boolean;
  /** The rank of the first item, when the list carries on from a story set above it. */
  start?: number;
  children: React.ReactNode;
};

/**
 * A ranked list set as a ledger: one line per item where there is room, with the
 * figures in columns under shared headings. Narrow lists stack the figures under the title.
 * The first five items show, or three on a phone; the rest are in the page, hidden until asked for.
 */
export function Ledger({ first, cells, labelledBy, count, kind = "read", more, brief = false, start = 1, children }: Props) {
  const [open, setOpen] = useState(false);
  const extra = Math.max(0, count - FIRST_PHONE);
  return (
    <div
      className={`ledger ledger--${kind}`}
      data-open={open}
      data-short={count <= (brief ? FIRST_PHONE : FIRST)}
      data-brief={brief}
      style={{ "--cells": cells.map((c) => c.width).join(" ") } as React.CSSProperties}
    >
      <div className="ledger__head" aria-hidden="true">
        <span>{first}</span>
        <span className="ledger__data">
          {cells.map((c) => (
            <span key={c.head} className={c.start ? "ledger__cell--start" : undefined}>{c.head}</span>
          ))}
        </span>
      </div>
      <ol aria-labelledby={labelledBy} start={start} style={start > 1 ? { counterReset: `rank ${start - 1}` } : undefined}>
        {children}
      </ol>
      {(extra > 0 || more) && (
        <p className="ledger__foot">
          {extra > 0 && (
            <button type="button" className="ledger__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Show fewer" : "Show more"}
            </button>
          )}
          {more}
        </p>
      )}
    </div>
  );
}
