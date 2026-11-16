import { catalogAuthor, normalize, subjectHeadings } from "@/lib/format";
import { formatRank } from "@/lib/ranks";
import type { PublicBook } from "@/lib/types";
import { FinishedStamp, OnLoanStamp, pageNote } from "./Bits";

/** "1949. 328 p." with whatever exists. */
const imprint = (book: PublicBook) => [book.year && `${book.year}.`, book.pages && `${book.pages} p.`].filter(Boolean).join(" ");

/** `№ 07`: the rank is the card’s call number. */
export function CallNumber({ rank }: { rank: number | null }) {
  return (
    <span className="call-number">
      <span aria-hidden className="font-serif text-[1.15em] leading-none font-normal">№ </span>
      <span className="sr-only">{rank == null ? "Uncatalogued" : "Rank "}</span>
      {rank == null ? <span aria-hidden>—</span> : formatRank(rank)}
    </span>
  );
}

/**
 * The front of a catalog card. It is complete with just a number, an author and a title; year, pages, subjects,
 * score, cover and progress appear when the row has them. `heading` is the title’s level where the card is used.
 */
export function IndexCard({ book, heading: Heading = "h3", titleId }: { book: PublicBook; heading?: "h1" | "h2" | "h3"; titleId?: string }) {
  const author = catalogAuthor(book.author);
  const original = book.originalTitle && normalize(book.originalTitle) !== normalize(book.title) ? book.originalTitle : "";
  const printed = imprint(book);
  const note = book.status === "In progress" ? pageNote(book) : "";

  return (
    <article className={`index-card ${book.coverUrl ? "has-cover" : ""}`}>
      <div className="card-head">
        <CallNumber rank={book.rank} />
      </div>
      {book.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt="" width={96} height={144} loading="lazy" decoding="async" className="cover-clip" />
      )}
      <div className="card-lines">
        {author && <p className="card-author">{author}</p>}
        <Heading id={titleId} className="card-title">
          {book.title}
        </Heading>
        {original && (
          <p className="card-original" lang="und">
            {original}
          </p>
        )}
        {printed && <p className="card-meta tabular-nums">{printed}</p>}
        {book.genres.length > 0 && <p className="card-meta">{subjectHeadings(book.genres)}</p>}
        {note && <p className="pencil">{note}</p>}
      </div>
      <div className="card-foot">
        <span className="text-[13px] text-soft tabular-nums">
          {book.score != null && (
            <>
              <span className="sr-only">Score </span>
              {book.score}/10
            </>
          )}
        </span>
        <span aria-hidden className="rod-hole" />
        {book.status === "Done" && <FinishedStamp />}
        {book.status === "In progress" && <OnLoanStamp />}
      </div>
    </article>
  );
}
