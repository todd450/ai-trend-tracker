import Link from "next/link";
import type { ReactNode } from "react";

const PAGES = [
  // The day's news is the landing page, so it leads; the Trends tab opens the three-month view.
  // `more` is the part of a label a phone leaves off, so the four tabs fit on one line there.
  // `icon` is the tab's pictogram, drawn in strokes on a 24-unit square.
  { id: "today", label: "Today", more: "’s news", href: "/", icon: <><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v8a2 2 0 0 1-2 2H6" /><path d="M7.5 9h6M7.5 12.5h6M7.5 16h3.5" /></> },
  { id: "trends", label: "Trends", more: "", href: "/three-months", icon: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></> },
  { id: "reading", label: "Reading", more: " list", href: "/reading", icon: <><path d="M12 6.5c-1.5-1.3-4-2-8-2v13c4 0 6.5.7 8 2 1.5-1.3 4-2 8-2v-13c-4 0-6.5.7-8 2z" /><path d="M12 6.5v13" /></> },
  // Every tab opens its page at the top, so the tabs stay in view.
  { id: "conferences", label: "Conferences", more: "", href: "/conferences", icon: <><rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></> },
] as const satisfies readonly { id: string; label: string; more: string; href: string; icon: ReactNode }[];

export type Page = (typeof PAGES)[number]["id"];

/**
 * The site's pages, the main thing in the masthead: a pictogram and a name each, the page you
 * are on inked and underlined. They sit in the masthead so that the sticky bar below is only
 * ever about the page you are on.
 */
export function PageTabs({ current }: { current?: Page }) {
  return (
    <nav className="tabs" aria-label="Pages">
      <ul>
        {PAGES.map((p) => (
          <li key={p.id}>
            <Link href={p.href} aria-current={p.id === current ? "page" : undefined}>
              <svg className="tabs__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {p.icon}
              </svg>
              <span>
                {p.label}
                {p.more && <span className="tabs__more">{p.more}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
