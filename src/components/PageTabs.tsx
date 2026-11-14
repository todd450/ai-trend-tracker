import Link from "next/link";

const PAGES = [
  { id: "trends", label: "Trends", href: "/" },
  { id: "today", label: "Today’s news", href: "/today" },
  // The conference calendar opens at today's line, with what has been held above it.
  { id: "conferences", label: "Conferences", href: "/conferences#now" },
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
