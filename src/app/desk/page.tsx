import type { Metadata } from "next";
import { DeskView } from "@/components/DeskView";
import { SetupError } from "@/components/SetupError";
import { requireOwnerPage } from "@/lib/api";
import { getLibrary } from "@/lib/library";
import type { Book } from "@/lib/types";

export const metadata: Metadata = { title: "Desk" };
// Owner only (the proxy sends visitors to sign in), and always current.
export const dynamic = "force-dynamic";

export default async function Desk() {
  await requireOwnerPage();
  let books: Book[];
  try {
    books = await getLibrary({ fresh: true });
  } catch (error) {
    return <SetupError error={error} />;
  }
  return <DeskView books={books} />;
}
