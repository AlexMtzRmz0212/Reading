"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link on the oak drawer front that marks the current page. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 shrink-0 items-center text-[15px] after:absolute after:inset-x-0 after:bottom-2 after:h-0.5 ${active ? "font-bold after:bg-brass" : "opacity-85 hover:opacity-100"}`}
    >
      {children}
    </Link>
  );
}
