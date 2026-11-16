import { catalogAuthor } from "@/lib/format";
import type { PublicBook } from "@/lib/types";
import { DateStamp, Tally, pageNote } from "./Bits";
import { CallNumber } from "./IndexCard";

/** The books being read right now, each as a narrow date-due slip. `onOpen` turns the slips into buttons that pull the card. */
export function OnLoanStrip({ books, onOpen }: { books: PublicBook[]; onOpen: (slug: string, event: React.MouseEvent) => void }) {
  if (books.length === 0) return null;
  return (
    <section aria-labelledby="on-loan" className="mb-10">
      <h2 id="on-loan" className="mb-3 font-serif text-2xl leading-tight font-bold">
        On loan now
      </h2>
      <ul className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {books.map((b) => (
          <li key={b.slug} className="w-64 shrink-0 snap-start sm:w-auto">
            <a href={`/book/${b.slug}`} onClick={(e) => onOpen(b.slug, e)} className="card-button slip flex h-full flex-col px-3.5 pt-2.5 pb-3">
              <CallNumber rank={b.rank} />
              <span className="mt-1 line-clamp-2 font-serif text-[19px] leading-snug">{b.title}</span>
              <span className="truncate text-[13px] text-soft">{catalogAuthor(b.author)}</span>
              <span className="mt-auto block pt-3">
                <Tally book={b} />
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="pencil">{pageNote(b) || "No pages logged"}</span>
                  {b.started && (
                    <span className="text-[13px] text-soft">
                      since <DateStamp day={b.started} />
                    </span>
                  )}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
