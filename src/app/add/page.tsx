import type { Metadata } from "next";
import { AddFromSearch, type Known } from "@/components/AddFromSearch";
import { FillDetails } from "@/components/FillDetails";
import { SetupError } from "@/components/SetupError";
import { requireOwnerPage } from "@/lib/api";
import { hasGap, type Gap } from "@/lib/enrich";
import { getLibrary } from "@/lib/library";
import { listChoices } from "@/lib/notion/books";
import type { Choices } from "@/lib/types";

export const metadata: Metadata = { title: "Add a book" };
// Owner only, and the duplicate check needs the catalog as it is now.
export const dynamic = "force-dynamic";

export default async function Add() {
  await requireOwnerPage();
  let known: Known[];
  let choices: Choices;
  let gaps: Gap[];
  try {
    const [books, options] = await Promise.all([getLibrary({ fresh: true }), listChoices()]);
    // Just what the duplicate warning needs.
    known = books.map((b) => ({ slug: b.slug, title: b.title, originalTitle: b.originalTitle, author: b.author, rank: b.rank }));
    choices = options;
    gaps = books.filter(hasGap).map(({ id, title, originalTitle, author, genres, published, coverUrl, hasIcon }) => ({ id, title, originalTitle, author, genres, published, coverUrl, hasIcon }));
  } catch (error) {
    return <SetupError error={error} />;
  }
  return (
    <>
      <AddFromSearch known={known} choices={choices} />
      <div className="max-w-4xl">
        <FillDetails gaps={gaps} choices={choices} />
      </div>
    </>
  );
}
