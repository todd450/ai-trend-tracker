import Link from "next/link";
import { HORIZONS, type Horizon } from "@/lib/trends";

/**
 * Switches every trend on the page between the six views, from 1 week to 2 years.
 * What each view compares is said once, in a sentence under the headline, and again
 * in each link's tooltip. Each view is its own prebuilt page; `scroll={false}` keeps
 * the reader's place.
 */
export function HorizonSwitch({
  current,
  label,
  hrefOf = (h) => HORIZONS[h].href,
}: {
  current: Horizon;
  label: string;
  /** Where each view of this page lives: the trends page's own views unless a page has its own. */
  hrefOf?: (horizon: Horizon) => string;
}) {
  return (
    <nav className="horizon" aria-label={label}>
      <span className="horizon__title" aria-hidden="true">Trends over</span>
      <ul>
        {(Object.keys(HORIZONS) as Horizon[]).map((h) => {
          const { window, shown } = HORIZONS[h];
          return (
            <li key={h}>
              <Link
                href={hrefOf(h)}
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
