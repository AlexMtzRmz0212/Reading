import { percentRead } from "@/lib/format";
import type { PublicBook } from "@/lib/types";
import { DateStamp, StatusStamp, Tally, pageNote } from "./Bits";

/**
 * The back of the card: the date-due slip. Started and Completed are date-stamped, pages read are tallied in pencil.
 * `stamp` replaces the status stamp (the sheet passes a thumping one right after a book is finished); `children`
 * is where the owner’s progress logger goes.
 */
export function DueSlip({ book, stamp, children }: { book: PublicBook; stamp?: React.ReactNode; children?: React.ReactNode }) {
  const percent = percentRead(book);
  const note = pageNote(book);
  return (
    <section aria-label="Date due slip" className="slip flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-red px-3.5 py-2">
        <h3 className="font-bold">Date due</h3>
        {stamp ?? <StatusStamp status={book.status} />}
      </div>
      <dl className="slip-grid">
        <dt className="text-[13px] text-soft">Started</dt>
        <dt className="text-[13px] text-soft">Completed</dt>
        <dd className="min-h-11">
          <DateStamp day={book.started} />
        </dd>
        <dd className="min-h-11">
          <DateStamp day={book.completed} />
        </dd>
      </dl>
      <div className="px-3.5 py-3">
        {percent != null || note ? (
          <>
            <Tally book={book} />
            <p className="pencil mt-1">{[note, percent != null && book.status !== "Done" ? `${percent}%` : ""].filter(Boolean).join(", ") || "Read cover to cover"}</p>
          </>
        ) : (
          <p className="text-[13px] text-soft">No pages logged yet.</p>
        )}
      </div>
      {children}
      <p className="mt-auto border-t border-rule px-3.5 py-2 text-[13px] text-soft">Overdue: 0 days. Fine: $0.00</p>
    </section>
  );
}
