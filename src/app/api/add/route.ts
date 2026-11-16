import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { bad, fail, readBody, requireOwner } from "@/lib/api";
import { findDuplicates } from "@/lib/dedupe";
import { slugify } from "@/lib/format";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { parseNewBook } from "@/lib/newBook";
import { createBook, listChoices } from "@/lib/notion/books";

/**
 * Owner only. Creates a row: Status Not started, Top empty (the Uncatalogued pile), cover as page cover and icon.
 * A book that looks like one already in the catalog is refused with 409 unless `allowDuplicate` is true.
 */
export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const body = await readBody(request);
    const [books, choices] = await Promise.all([getLibrary({ fresh: true }), listChoices()]);
    const parsed = parseNewBook(body, choices);
    if (!parsed.ok) return bad(parsed.error);

    const duplicates = findDuplicates(parsed.value, books);
    if (duplicates.length > 0 && body.allowDuplicate !== true) {
      return NextResponse.json({ error: "This looks like a book already in the catalog", duplicates: duplicates.map((b) => ({ slug: b.slug, title: b.title, author: b.author, rank: b.rank })) }, { status: 409 });
    }

    const id = await createBook(parsed.value);
    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, slug: slugify(parsed.value.title, id), title: parsed.value.title, author: parsed.value.author });
  } catch (error) {
    return fail(error);
  }
}
