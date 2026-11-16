"use client";

import Link from "next/link";
import { useState } from "react";
import { sortBooks } from "@/lib/catalog";
import { catalogAuthor } from "@/lib/format";
import { formatRank } from "@/lib/ranks";
import type { Book } from "@/lib/types";
import { DateStamp, FinishedStamp, StatusStamp, Tally, pageNote } from "./Bits";
import { CallNumber } from "./IndexCard";
import { ProgressLogger } from "./ProgressLogger";

/** One book on the desk: what it is, how far along, and the logger. */
function DeskRow({ book, onChange, stamp }: { book: Book; onChange: (book: Book) => void; stamp?: React.ReactNode }) {
  return (
    <li className="slip grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-3.5 pt-2.5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <CallNumber rank={book.rank} />
          {stamp ?? <StatusStamp status={book.status} />}
        </div>
        <h3 className="mt-1.5 font-serif text-[21px] leading-snug">
          <Link href={`/book/${book.slug}`} className="hover:underline">
            {book.title}
          </Link>
        </h3>
        <p className="mb-3 text-[13px] text-soft">{catalogAuthor(book.author)}</p>
        <div className="mt-auto">
          <Tally book={book} />
          <p className="pencil">{pageNote(book) || "No pages logged"}</p>
        </div>
      </div>
      <div className="border-t border-rule md:border-t-0 md:border-l [&>form]:border-t-0">
        <ProgressLogger book={book} onChange={onChange} />
      </div>
    </li>
  );
}

/** The librarian’s desk: log pages on the books that are out, take a new one from the drawer, see what came back. */
export function DeskView({ books: initial }: { books: Book[] }) {
  const [books, setBooks] = useState(initial);
  const [pick, setPick] = useState("");
  // Books finished in this sitting stay on the desk (with their stamp) instead of jumping to the list below.
  const [finishedHere, setFinishedHere] = useState<string[]>([]);

  const update = (book: Book) => {
    const before = books.find((b) => b.id === book.id);
    if (before && before.status !== "Done" && book.status === "Done") setFinishedHere((ids) => (ids.includes(book.id) ? ids : [...ids, book.id]));
    setBooks((list) => list.map((b) => (b.id === book.id ? book : b)));
  };

  const onDesk = sortBooks(books.filter((b) => b.status === "In progress" || finishedHere.includes(b.id) || b.id === pick), "rank");
  const shelf = sortBooks(books.filter((b) => b.status === "Not started" && b.id !== pick), "rank");
  const returned = sortBooks(books.filter((b) => b.status === "Done" && !finishedHere.includes(b.id)), "finished").slice(0, 5);

  return (
    <div className="max-w-4xl">
      <h1 className="page-title mb-2">Librarian’s desk</h1>
      <p className="mb-8 text-soft">Log the page you’re on. Status and dates are stamped in Notion for you.</p>

      <section aria-labelledby="desk-out" className="mb-10">
        <h2 id="desk-out" className="mb-3 font-serif text-2xl leading-tight font-bold">
          On loan now
        </h2>
        {onDesk.length === 0 ? (
          <p className="max-w-md rounded-[3px] border border-dashed border-soft/50 p-6 text-soft">Nothing is out. Take a book from the drawer below to start one.</p>
        ) : (
          <ul className="grid gap-4">
            {onDesk.map((b) => (
              <DeskRow key={b.id} book={b} onChange={update} stamp={finishedHere.includes(b.id) && b.status === "Done" ? <FinishedStamp className="stamp-thump" /> : undefined} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="desk-take" className="mb-10">
        <h2 id="desk-take" className="mb-3 font-serif text-2xl leading-tight font-bold">
          Take a book out
        </h2>
        <label className="block max-w-xl">
          <span className="label">Books awaiting, by rank. Choosing one puts it on the desk; it starts when you log a page.</span>
          <select className="input" value="" onChange={(e) => setPick(e.target.value)} disabled={shelf.length === 0}>
            <option value="">{shelf.length === 0 ? "Every book has been started" : "Choose a book…"}</option>
            {shelf.map((b) => (
              <option key={b.id} value={b.id}>
                {b.rank != null ? `${formatRank(b.rank)}  ` : ""}
                {b.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      {returned.length > 0 && (
        <section aria-labelledby="desk-back">
          <h2 id="desk-back" className="mb-3 font-serif text-2xl leading-tight font-bold">
            Returned lately
          </h2>
          <ul className="slip max-w-xl divide-y divide-rule">
            {returned.map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
                <Link href={`/book/${b.slug}`} className="min-w-0 truncate hover:underline">
                  {b.title}
                </Link>
                <DateStamp day={b.completed} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
