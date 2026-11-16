import type { Metadata } from "next";
import { RankEditor, type RankBook } from "@/components/RankEditor";
import { SetupError } from "@/components/SetupError";
import { requireOwnerPage } from "@/lib/api";
import { getLibrary } from "@/lib/library";
import { ranked } from "@/lib/ranks";
import type { Book } from "@/lib/types";

export const metadata: Metadata = { title: "Ranks" };
// Owner only (the proxy sends visitors to sign in), and always the current order.
export const dynamic = "force-dynamic";

const toRankBook = (b: Book): RankBook => ({ id: b.id, title: b.title, author: b.author, rank: b.rank, score: b.score });

export default async function Ranks() {
  await requireOwnerPage();
  let books: Book[];
  try {
    books = await getLibrary({ fresh: true });
  } catch (error) {
    return <SetupError error={error} />;
  }
  const list = ranked(books).map(toRankBook);
  const pile = books
    .filter((b) => b.rank == null)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(toRankBook);
  return <RankEditor list={list} pile={pile} />;
}
