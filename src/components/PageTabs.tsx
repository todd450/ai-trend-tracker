import Link from "next/link";

const PAGES = [
  // The day's news is the landing page, so it leads; the Trends tab opens the three-month view.
  // `more` is the part of a label a phone leaves off, so the four tabs fit on one line there.
  { id: "today", label: "Today", more: "’s news", href: "/" },
  { id: "trends", label: "Trends", more: "", href: "/three-months" },
  { id: "reading", label: "Reading", more: " list", href: "/reading" },
  // Every tab opens its page at the top, so the tabs stay in view.
  { id: "conferences", label: "Conferences", more: "", href: "/conferences" },
] as const;

export type Page = (typeof PAGES)[number]["id"];

/**
 * The site's pages, set above the name like a newspaper's section heads. They sit in
 * the masthead so that the sticky bar below is only ever about the page you are on.
 */
export function PageTabs({ current }: { current: Page }) {
  return (
    <nav className="tabs" aria-label="Pages">
      <ul>
        {PAGES.map((p) => (
          <li key={p.id}>
            <Link href={p.href} aria-current={p.id === current ? "page" : undefined}>
              {p.label}
              {p.more && <span className="tabs__more">{p.more}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
