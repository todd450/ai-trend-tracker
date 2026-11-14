"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A list of trend rows that shows its first five and keeps the rest in the page,
 * hidden until asked for. A link to a hidden row's anchor (`/three-months#product-…`) opens the list,
 * so the row it names is there to land on.
 */
export function MoreRows({ count, noun, children }: { count: number; noun: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const follow = () => {
      // Row ids are plain ASCII, so the fragment is used as it is: decoding it would throw on a
      // malformed link (`/#%`) and take the whole page down with it.
      const id = window.location.hash.slice(1);
      const row = id ? document.getElementById(id) : null;
      if (!row || !list.current?.contains(row)) return;
      setOpen(true);
      // The row was hidden when the browser looked for it, so it is scrolled to once shown.
      requestAnimationFrame(() => row.scrollIntoView());
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  return (
    <>
      <ol ref={list} className="mom__list" data-open={open}>
        {children}
      </ol>
      {count > 5 && (
        <p className="ledger__foot">
          <button type="button" className="ledger__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Show fewer" : `Show all ${count} ${noun}`}
          </button>
        </p>
      )}
    </>
  );
}
