import { NextResponse } from "next/server";
import { bad, requireOwner } from "@/lib/api";
import { optional } from "@/lib/env";
import { searchGoogleBooks } from "@/lib/providers/googlebooks";
import { searchOpenLibrary } from "@/lib/providers/openlibrary";
import type { SearchResult } from "@/lib/providers/types";

/** Owner only. ?q=… searches Open Library, plus Google Books when GOOGLE_BOOKS_API_KEY is set. One source failing doesn’t hide the other. */
export async function GET(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) return bad("Type at least two letters to search");

  const googleKey = optional("GOOGLE_BOOKS_API_KEY");
  const [open, google] = await Promise.allSettled([searchOpenLibrary(q), googleKey ? searchGoogleBooks(q, googleKey) : Promise.resolve<SearchResult[]>([])]);
  const results = [...(open.status === "fulfilled" ? open.value : []), ...(google.status === "fulfilled" ? google.value : [])];
  const failed = [open.status === "rejected" && "Open Library", google.status === "rejected" && "Google Books"].filter(Boolean);
  for (const r of [open, google]) if (r.status === "rejected") console.error(r.reason);
  return NextResponse.json({ results, failed }, { headers: { "cache-control": "no-store" } });
}
