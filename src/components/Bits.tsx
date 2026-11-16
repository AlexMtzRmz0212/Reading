import { STAMP_WORD, percentRead, stampDate } from "@/lib/format";
import type { PublicBook, Status } from "@/lib/types";

/** Waiting indicator. With reduced motion it stays still: a ring with a gap. */
export function Spinner() {
  return <span aria-hidden className="spinner" />;
}

/** The rubber stamps, one per status. `className="stamp-thump"` plays the stamp coming down. */
export function FinishedStamp({ className = "" }: { className?: string }) {
  return <span className={`stamp relative ${className}`}>{STAMP_WORD.Done}</span>;
}
export function OnLoanStamp({ className = "" }: { className?: string }) {
  return <span className={`stamp stamp-loan relative ${className}`}>{STAMP_WORD["In progress"]}</span>;
}
export function AwaitingStamp({ className = "" }: { className?: string }) {
  return <span className={`stamp stamp-awaiting relative ${className}`}>{STAMP_WORD["Not started"]}</span>;
}

const STAMPS = { Done: FinishedStamp, "In progress": OnLoanStamp, "Not started": AwaitingStamp } as const;

export function StatusStamp({ status, className }: { status: Status; className?: string }) {
  const Stamp = STAMPS[status];
  return <Stamp className={className} />;
}

/** A date as the date stamp prints it, or a typed dash when there is none. */
export function DateStamp({ day }: { day?: string }) {
  if (!day) return <span className="text-soft">—</span>;
  return (
    <time dateTime={day} className="stamp-date">
      {stampDate(day)}
    </time>
  );
}

/** "p. 132 of 638" in pencil. Empty when no page has been logged. */
export function pageNote(book: Pick<PublicBook, "pages" | "currentPage">): string {
  if (book.currentPage == null) return "";
  return book.pages ? `p. ${book.currentPage} of ${book.pages}` : `p. ${book.currentPage}`;
}

/** Pages read as a pencil tally bar. Nothing when the page count is unknown. */
export function Tally({ book }: { book: Pick<PublicBook, "pages" | "currentPage" | "status"> }) {
  const percent = percentRead(book);
  if (percent == null) return null;
  return (
    <div className="tally" role="progressbar" aria-label="Pages read" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  );
}
