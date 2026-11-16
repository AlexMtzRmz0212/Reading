import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { bad, fail, readBody, requireOwner } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { updateBooks } from "@/lib/notion/books";
import { parseOrder, rankChanges } from "@/lib/ranks";

export const maxDuration = 60;

/** Writes per request. The Ranks screen keeps calling until nothing is left, so a big reorder never outlives a serverless function. */
const BATCH = 15;

/**
 * Owner only. { order: [pageId…], apply?: boolean }
 * Without `apply` it is a preview: which books would move, from which place to which. With it, the next batch of
 * those changes is written and `remaining` says how many are still to go. The books in `order` end up holding
 * 1, 2, 3… in that order; every other book leaves the list.
 */
export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const body = await readBody(request);
    const books = await getLibrary({ fresh: true });
    const parsed = parseOrder(body, new Set(books.map((b) => b.id)));
    if (!parsed.ok) return bad(parsed.error);

    // Worked out against Notion as it is right now, so a repeated or interrupted apply just picks up what is left.
    const changes = rankChanges(books, parsed.value);
    if (body.apply !== true) return NextResponse.json({ changes });

    const batch = changes.slice(0, BATCH);
    await updateBooks(batch.map((c) => ({ id: c.id, patch: { rank: c.to } })));
    invalidateLibrary();
    const remaining = changes.length - batch.length;
    if (remaining === 0) revalidatePath("/", "layout");
    return NextResponse.json({ applied: batch.length, remaining });
  } catch (error) {
    return fail(error);
  }
}
