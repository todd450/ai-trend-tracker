"use client";

import { useId, useState } from "react";

type Props = {
  rank: number;
  name: string;
  blurb: string;
  /** The theme's own figures: the share bar and the stories cell. */
  cells: React.ReactNode;
  /** How many sub-theme rows `children` holds; with none, the row has nothing to open. */
  count: number;
  /** One row per sub-theme. */
  children: React.ReactNode;
};

/**
 * A theme row whose name opens the sub-themes beneath it. The sub-theme rows are
 * always in the page, only hidden, so they are in the static HTML and searchable.
 */
export function ThemeRow({ rank, name, blurb, cells, count, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="mom__row mom__row--theme">
      <div className="mom__topic" title={blurb}>
        <span className="mom__rank">{rank}</span>
        <h4>
          {count > 0 ? (
            <button type="button" className="drill" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
              {name}
              <span className="drill__mark" aria-hidden="true" />
              <span className="vh">
                , {open ? "hide" : "show"} {count} sub-themes
              </span>
            </button>
          ) : (
            name
          )}
        </h4>
      </div>
      {cells}
      {count > 0 && (
        <ul id={id} className="subtrends" hidden={!open} aria-label={`${name}: sub-themes`}>
          {children}
        </ul>
      )}
    </li>
  );
}
