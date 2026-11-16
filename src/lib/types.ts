export const STATUSES = ["Not started", "In progress", "Done"] as const;
export type Status = (typeof STATUSES)[number];

export interface Book {
  /** Notion page id. Never sent to visitors. */
  id: string;
  /** Title plus a few characters of the page id: stable while the title stays. */
  slug: string;
  title: string;
  originalTitle?: string;
  author?: string;
  genres: string[];
  /** Notion keeps Year as text ("1949", "c. 350 BC"). */
  year?: string;
  pages?: number;
  currentPage?: number;
  status: Status;
  /** Place on the list, from the Top column ("07" is 7). null: uncatalogued. */
  rank: number | null;
  /** 0 to 10. */
  score?: number;
  /** YYYY-MM-DD */
  started?: string;
  completed?: string;
  coverUrl?: string;
}

/** What the public catalog shows: everything except the Notion id. */
export type PublicBook = Omit<Book, "id">;

export function toPublicBook(book: Book): PublicBook {
  const { slug, title, originalTitle, author, genres, year, pages, currentPage, status, rank, score, started, completed, coverUrl } = book;
  return { slug, title, originalTitle, author, genres, year, pages, currentPage, status, rank, score, started, completed, coverUrl };
}

/** Select options that exist in Notion, offered when adding a book. */
export interface Choices {
  authors: string[];
  genres: string[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
