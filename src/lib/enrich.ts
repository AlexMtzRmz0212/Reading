/** Filling in Genre, Published, cover and icon on books that lack them, from a search result. Pure: the page and the route both use it. */
import { findDuplicates, matchOption } from "./dedupe";
import { suggestGenres } from "./newBook";
import type { BookPatch } from "./notion/mapper";
import type { SearchResult } from "./providers/types";
import { toPublished } from "./published";
import type { Book, Choices, Result } from "./types";

/** What the fill-in page needs to know about a book. */
export type Gap = Pick<Book, "id" | "title" | "originalTitle" | "author" | "genres" | "published" | "coverUrl" | "hasIcon">;
type Filled = Pick<Book, "genres" | "published" | "coverUrl" | "hasIcon">;

/** Only these hosts are accepted as a cover, whatever the browser sends (Notion shows the address publicly). */
const COVER_HOSTS = ["covers.openlibrary.org", "books.google.com", "books.googleusercontent.com"];
const isCoverHost = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && COVER_HOSTS.includes(u.hostname) && !u.username && !u.password && url.length <= 600;
  } catch {
    return false;
  }
};

/** A picture that stays put: Notion’s own uploads are signed links that expire within the hour, so they can’t be an icon. */
export const isStableImage = (url: string | undefined): url is string => {
  try {
    const u = url ? new URL(url) : undefined;
    return Boolean(u && u.protocol === "https:" && !u.hostname.endsWith("amazonaws.com") && !u.hostname.endsWith("notion.so"));
  } catch {
    return false;
  }
};

/** Needs a search: something a result can fill. */
export const needsSearch = (book: Filled): boolean => !book.published || book.genres.length === 0 || !book.coverUrl;
/** Has a cover that can become its icon. */
const iconFromOwnCover = (book: Filled): boolean => !book.hasIcon && isStableImage(book.coverUrl);
export const hasGap = (book: Filled): boolean => needsSearch(book) || iconFromOwnCover(book);

/** What to search for, best first: the original title with the author, then the shown title with the author, then the shown title alone. */
export function queriesFor(book: Pick<Book, "title" | "originalTitle" | "author">): string[] {
  const withAuthor = (t: string) => [t, book.author].filter(Boolean).join(" ");
  const all = [book.originalTitle && withAuthor(book.originalTitle), withAuthor(book.title), book.title].filter((q): q is string => Boolean(q?.trim()));
  return [...new Set(all.map((q) => q.trim()))];
}

export interface Fill {
  id: string;
  published?: string;
  genres?: string[];
  /** Page cover, and icon: both an image address. */
  cover?: string;
  icon?: string;
}

/** The first result that is the same book (title and, when both name one, author). Never guesses. */
export function bestMatch(book: Pick<Book, "title" | "originalTitle" | "author">, results: SearchResult[]): SearchResult | undefined {
  const same = (r: SearchResult, author?: string) => findDuplicates({ title: r.title, author }, [book]).length > 0;
  return results.find((r) => (r.authors.length > 0 ? r.authors.some((a) => same(r, a)) : same(r)));
}

/**
 * Only what the book is missing: a value it already has is never replaced. The icon is the cover (the one it is
 * given now, or the one it already has when that is a link that lasts). undefined when there is nothing to add.
 */
export function fillFrom(book: Gap, result: SearchResult | undefined, choices: Choices): Fill | undefined {
  const fill: Fill = { id: book.id };
  const published = book.published ? undefined : toPublished(result?.year);
  if (published) fill.published = published;
  if (result && book.genres.length === 0) {
    const genres = suggestGenres(result.subjects, choices.genres);
    if (genres.length > 0) fill.genres = genres;
  }
  if (!book.coverUrl && result?.coverUrl && isCoverHost(result.coverUrl)) fill.cover = result.coverUrl;
  const picture = fill.cover ?? book.coverUrl;
  if (!book.hasIcon && isStableImage(picture)) fill.icon = picture;
  return fill.published || fill.genres || fill.cover || fill.icon ? fill : undefined;
}

/** The body of a write: each change must name a book that exists, and may only fill what is empty, with Genre options that exist. */
export function parseFills(body: Record<string, unknown>, books: Pick<Book, "id" | "genres" | "published" | "coverUrl" | "hasIcon">[], choices: Choices): Result<{ id: string; patch: BookPatch }[]> {
  if (!Array.isArray(body.changes) || body.changes.length === 0) return { ok: false, error: "Nothing to write" };
  if (body.changes.length > 500) return { ok: false, error: "Too many books at once" };
  const byId = new Map(books.map((b) => [b.id, b]));
  const out: { id: string; patch: BookPatch }[] = [];
  for (const raw of body.changes as unknown[]) {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const book = typeof c.id === "string" ? byId.get(c.id) : undefined;
    if (!book) return { ok: false, error: "One of those books is no longer in the catalog" };
    const patch: BookPatch = {};
    const published = toPublished(c.published);
    if (c.published !== undefined && !published) return { ok: false, error: "Published must be a year or a date" };
    if (published && !book.published) patch.published = published;
    if (Array.isArray(c.genres) && book.genres.length === 0) {
      const genres = [...new Set(c.genres.flatMap((g) => (typeof g === "string" ? (matchOption(g, choices.genres) ?? []) : [])))];
      if (genres.length > 0) patch.genres = genres;
    }
    if (c.cover !== undefined && (typeof c.cover !== "string" || !isCoverHost(c.cover))) return { ok: false, error: "A cover must be an https:// image from Open Library or Google Books" };
    if (typeof c.cover === "string" && !book.coverUrl) patch.cover = c.cover;
    // The icon is the cover that is there now, or the one being added with it.
    if (c.icon !== undefined && (typeof c.icon !== "string" || !(isCoverHost(c.icon) || (c.icon === book.coverUrl && isStableImage(c.icon))))) return { ok: false, error: "That icon isn’t one this book has as a cover" };
    if (typeof c.icon === "string" && !book.hasIcon && (c.icon === patch.cover || c.icon === book.coverUrl)) patch.icon = c.icon;
    if (Object.keys(patch).length > 0) out.push({ id: book.id, patch });
  }
  return { ok: true, value: out };
}
