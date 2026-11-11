import Link from "next/link";
import { HORIZONS, type Horizon } from "@/lib/trends";

/**
 * Switches every trend on the page between the five views, from 1 week to 1 year.
 * What each view compares is said once, in a sentence under the headline, and again
 * in each link's tooltip. Each view is its own prebuilt page; `scroll={false}` keeps
 * the reader's place.
 */
export function HorizonSwitch({ current, label }: { current: Horizon; label: string }) {
  return (
    <nav className="horizon" aria-label={label}>
      <span className="horizon__title" aria-hidden="true">Trends over</span>
      <ul>
        {(Object.keys(HORIZONS) as Horizon[]).map((h) => {
          const { window, shown } = HORIZONS[h];
          return (
            <li key={h}>
              <Link
                href={HORIZONS[h].href}
                scroll={false}
                aria-current={h === current ? "page" : undefined}
                title={
                  window === 1
                    ? `Charts cover ${shown} weeks; changes compare the latest week with the week before`
                    : `Charts cover ${shown} weeks; changes compare the last ${window} weeks with the ${window} before`
                }
              >
                {HORIZONS[h].label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
