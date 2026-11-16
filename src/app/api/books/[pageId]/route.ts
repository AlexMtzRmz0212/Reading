import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { bad, fail, readBody, requireOwner } from "@/lib/api";
import { optional } from "@/lib/env";
import { today } from "@/lib/format";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { updateBook } from "@/lib/notion/books";
import type { BookPatch } from "@/lib/notion/mapper";
import { applyProgress, logPage, markFinished, parsePages, parseRestore } from "@/lib/progress";
import { parseScore } from "@/lib/ranks";

/**
 * Owner only. One of:
 *   { page: 142 }          log the page you’re on (status and dates follow the rules in lib/progress)
 *   { finished: true }     mark the book finished
 *   { restore: {...} }     undo: put status, page and dates back
 *   { score: 8.5 | null }  set or clear the score
 *   { pages: 320 | null }  set or clear the total page count
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const { pageId } = await params;
    const body = await readBody(request);
    // Only rows of this database can be written: the id must be a book the catalog holds.
    const book = (await getLibrary({ fresh: true })).find((b) => b.id === pageId);
    if (!book) return bad("That book is no longer in the catalog", 404);

    let patch: BookPatch;
    if ("page" in body) {
      const result = logPage(book, body.page, today(optional("TIME_ZONE")));
      if (!result.ok) return bad(result.error);
      patch = result.value;
    } else if (body.finished === true) {
      patch = markFinished(book, today(optional("TIME_ZONE")));
    } else if ("restore" in body) {
      const result = parseRestore(body.restore);
      if (!result.ok) return bad(result.error);
      patch = result.value;
    } else if ("score" in body) {
      const result = parseScore(body.score);
      if (!result.ok) return bad(result.error);
      patch = { score: result.value };
    } else if ("pages" in body) {
      const result = parsePages(body.pages);
      if (!result.ok) return bad(result.error);
      patch = { pages: result.value };
    } else {
      return bad("Nothing to change");
    }

    await updateBook(pageId, patch);
    invalidateLibrary();
    revalidatePath("/", "layout");
    const { score, pages, ...progress } = patch;
    const next = applyProgress(book, progress);
    return NextResponse.json({
      book: {
        ...next,
        ...(score !== undefined && { score: score ?? undefined }),
        ...(pages !== undefined && { pages: pages ?? undefined }),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
