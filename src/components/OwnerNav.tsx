"use client";

import { LockSimpleIcon, SignOutIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { NavLink } from "./NavLink";
import { useOwner } from "./useOwner";

/** Header links. Visitors see the catalog and a lock that leads to the sign-in page; the owner also gets the desk. */
export function OwnerNav() {
  const owner = useOwner();

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }

  return (
    <>
      <div className="order-last flex w-full items-center gap-6 overflow-x-auto sm:order-none sm:w-auto sm:overflow-visible">
        <NavLink href="/">Catalog</NavLink>
        {owner && (
          <>
            <NavLink href="/desk">Desk</NavLink>
            <NavLink href="/add">Add</NavLink>
            <NavLink href="/ranks">Ranks</NavLink>
          </>
        )}
      </div>
      <div className="ml-auto flex items-center">
        {owner === false && (
          <Link href="/login" className="-mr-3 flex size-11 items-center justify-center opacity-85 hover:opacity-100" aria-label="Owner sign in" title="Owner sign in">
            <LockSimpleIcon size={18} aria-hidden />
          </Link>
        )}
        {owner && (
          <button type="button" onClick={logout} className="-mr-2 flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-[15px] opacity-85 hover:opacity-100" aria-label="Log out">
            <SignOutIcon size={18} aria-hidden />
            <span className="hidden sm:inline">Log out</span>
          </button>
        )}
      </div>
    </>
  );
}
