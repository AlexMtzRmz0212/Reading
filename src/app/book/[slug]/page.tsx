import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DueSlip } from "@/components/DueSlip";
import { IndexCard } from "@/components/IndexCard";
import { SetupError } from "@/components/SetupError";
import { getLibrary } from "@/lib/library";
import { toPublicBook } from "@/lib/types";

// One card on its own page: what a shared link or a new tab opens. The dialog on the catalog is the usual way in.
export const revalidate = 900;
// Pages are built the first time they are asked for, then cached like the catalog.
export const generateStaticParams = async () => [];

const findBook = cache(async (slug: string) => {
  const book = (await getLibrary()).find((b) => b.slug === slug);
  return book ? toPublicBook(book) : undefined;
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await findBook((await params).slug).catch(() => undefined);
  return book ? { title: book.title, description: [book.title, book.author].filter(Boolean).join(", by ") } : { title: "Card not found" };
}

export default async function BookPage({ params }: Props) {
  let book;
  try {
    book = await findBook((await params).slug);
  } catch (error) {
    return <SetupError error={error} />;
  }
  if (!book) notFound();
  return (
    <div className="max-w-4xl">
      <p className="mb-5">
        <Link href="/" className="link">
          Back to the catalog
        </Link>
      </p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
        <IndexCard book={book} heading="h1" />
        <DueSlip book={book} />
      </div>
    </div>
  );
}
