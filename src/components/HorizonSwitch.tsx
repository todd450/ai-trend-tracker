import Link from "next/link";
import { HORIZONS, type Horizon } from "@/lib/trends";

/**
 * Switches every trend on the page between the 3-month, 6-month and 1-year view.
 * The small print is the comparison behind each: the latest weeks v the weeks before.
 * Each view is its own prebuilt page; `scroll={false}` keeps the reader's place.
 */
export function HorizonSwitch({ current, label }: { current: Horizon; label: string }) {
  return (
    <nav className="horizon" aria-label={label}>
      <span className="horizon__title" aria-hidden="true">Trends over</span>
      <ul>
        {(Object.keys(HORIZONS) as Horizon[]).map((h) => (
          <li key={h}>
            <Link href={HORIZONS[h].href} scroll={false} aria-current={h === current ? "page" : undefined}>
              {HORIZONS[h].label}
              <span className="horizon__span">
                {HORIZONS[h].window} v {HORIZONS[h].window} weeks
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
