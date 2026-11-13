"use client";

import { useEffect, useRef, useState } from "react";

export type Section = { href: `#${string}`; label: string };

/**
 * The page's sections, in one line under the masthead. The section being read is
 * marked as the page scrolls, and kept in view when the line scrolls sideways.
 */
export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null);
    // A handful of measurements per scroll event: cheap enough to need no throttling.
    const update = () => {
      const bar = list.current?.closest(".bar")?.getBoundingClientRect().bottom ?? 0;
      const line = bar + window.innerHeight * 0.2;
      // The section that most recently passed under the bar. Sections set side by side
      // share a top, and the first of them counts.
      let current: string | null = null;
      let passed = -Infinity;
      for (const el of targets) {
        const top = el.getBoundingClientRect().top;
        if (top <= line && top > passed + 1) {
          current = el.id;
          passed = top;
        }
      }
      // At the foot of the page the last section counts, however short it is.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = targets.at(-1)?.id ?? current;
      }
      setActive(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  // Keep the marked section visible when the line is wider than the screen.
  useEffect(() => {
    const ul = list.current;
    const link = ul?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!ul || !link || ul.scrollWidth <= ul.clientWidth) return;
    const left = link.offsetLeft - ul.offsetLeft;
    if (left < ul.scrollLeft || left + link.offsetWidth > ul.scrollLeft + ul.clientWidth) {
      ul.scrollTo({ left: left - ul.clientWidth / 3, behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav className="bar__nav" aria-label="On this page">
      <ul ref={list}>
        {sections.map((s) => (
          <li key={s.href}>
            <a href={s.href} aria-current={active === s.href.slice(1) ? "location" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
