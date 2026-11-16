import { CatalogView } from "@/components/CatalogView";
import { SetupError } from "@/components/SetupError";
import { getLibrary } from "@/lib/library";
import { toPublicBook, type PublicBook } from "@/lib/types";

// Public catalog: re-read Notion at most every 15 minutes (owner actions refresh it right away). Notion-hosted
// cover addresses last about an hour, so the window stays well under that.
export const revalidate = 900;

export default async function Home() {
  let books: PublicBook[];
  try {
    // Visitors get the cards without their Notion ids.
    books = (await getLibrary()).map(toPublicBook);
  } catch (error) {
    return <SetupError error={error} />;
  }
  return <CatalogView books={books} />;
}
