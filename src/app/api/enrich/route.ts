import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { bad, fail, readBody, requireOwner } from "@/lib/api";
import { parseFills } from "@/lib/enrich";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { listChoices, updateBooks } from "@/lib/notion/books";

/**
 * Owner only. { changes: [{ id, published?: "1949" | "1949-06-08", genres?: ["Dystopia"] }] }
 * Fills Genre and Published on books that have none. A value a book already has is never replaced.
 */
export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const body = await readBody(request);
    const [books, choices] = await Promise.all([getLibrary({ fresh: true }), listChoices()]);
    const parsed = parseFills(body, books, choices);
    if (!parsed.ok) return bad(parsed.error);
    await updateBooks(parsed.value);
    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, updated: parsed.value.length });
  } catch (error) {
    return fail(error);
  }
}
