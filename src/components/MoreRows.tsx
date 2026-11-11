"use client";

import { useState } from "react";

/**
 * A list of trend rows that shows its first five and keeps the rest in the page,
 * hidden until asked for.
 */
export function MoreRows({ count, noun, children }: { count: number; noun: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ol className="trends" data-open={open}>
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
