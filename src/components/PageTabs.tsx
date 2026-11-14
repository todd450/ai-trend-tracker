import Link from "next/link";

const PAGES = [
  { id: "trends", label: "Trends", href: "/" },
  { id: "reading", label: "Reading list", href: "/reading" },
  // Every tab opens its page at the top, so the tabs stay in view. Today's line is one tap away
  // in the calendar's own month bar.
  { id: "conferences", label: "Conferences", href: "/conferences" },
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
