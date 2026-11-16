"use client";

import { useEffect, useState } from "react";

/**
 * The guide tabs along the top of the drawer. Plain anchors to each run of cards, so they work from the keyboard
 * and without script; with script the tab of the run on screen is marked.
 */
export function DrawerTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [current, setCurrent] = useState<string>();
  const ids = tabs.map((t) => t.id).join(" ");

  useEffect(() => {
    const sections = ids.split(" ").flatMap((id) => document.getElementById(id) ?? []);
    if (sections.length === 0) return;
    // A run is "on screen" while it crosses a band just under the sticky tabs.
    const observer = new IntersectionObserver(
      () => {
        const line = 96;
        const on = sections.findLast((s) => s.getBoundingClientRect().top <= line) ?? sections[0];
        setCurrent(on.id);
      },
      { rootMargin: "-88px 0px -55% 0px", threshold: [0, 1] },
    );
    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, [ids]);

  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Drawer dividers" className="sticky top-0 z-30 -mx-4 bg-ground px-4 pt-2 sm:-mx-6 sm:px-6">
      <ul className="relative flex gap-1 overflow-x-auto border-b-2 border-edge">
        {tabs.map((t) => (
          <li key={t.id} className="shrink-0">
            <a href={`#${t.id}`} className="guide-tab" aria-current={current === t.id ? "true" : undefined}>
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
