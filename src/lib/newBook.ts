/** Validation of a book sent by the Add page, and the suggestions it shows. Pure. */
import { matchOption } from "./dedupe";
import { normalize } from "./format";
import type { NewBook } from "./notion/mapper";
import { toPublished } from "./published";
import type { Choices, Result } from "./types";

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : undefined;
};

/** Only https images; anything else is dropped rather than written to Notion and shown on the public page. */
export function coverUrlOf(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 600) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The row to create. The author reuses an existing option when one matches without accents and case, so
 * "Antoine de Saint-Exupery" never becomes a second option; genres are limited to options that exist.
 */
export function parseNewBook(body: Record<string, unknown>, choices: Choices): Result<NewBook> {
  const title = text(body.title, 300);
  if (!title) return { ok: false, error: "A book needs a title" };
  const author = text(body.author, 100);
  if (author?.includes(",")) return { ok: false, error: "Notion select options can’t contain commas. Write the author as Name Surname." };
  const pages = body.pages;
  if (pages != null && pages !== "" && (typeof pages !== "number" || !Number.isInteger(pages) || pages < 1 || pages > 100_000)) return { ok: false, error: "Pages must be a whole number" };
  if (body.coverUrl != null && body.coverUrl !== "" && !coverUrlOf(body.coverUrl)) return { ok: false, error: "The cover must be an https:// image address" };
  const published = text(body.published, 20);
  if (published && !toPublished(published)) return { ok: false, error: "Published must be a year (1949) or a date (1949-06-08)" };
  const genres = Array.isArray(body.genres) ? [...new Set(body.genres.flatMap((g) => (typeof g === "string" ? (matchOption(g, choices.genres) ?? []) : [])))] : [];
  return {
    ok: true,
    value: {
      title,
      originalTitle: text(body.originalTitle, 300),
      author: author ? (matchOption(author, choices.authors) ?? author) : undefined,
      genres,
      published: toPublished(published),
      pages: typeof pages === "number" ? pages : undefined,
      coverUrl: coverUrlOf(body.coverUrl),
    },
  };
}

/** Existing Genre options that a search result’s subjects point at: "Dystopias" suggests "Dystopia". */
export function suggestGenres(subjects: string[], options: string[]): string[] {
  const heard = subjects.map(normalize).filter(Boolean);
  return options.filter((option) => {
    const key = normalize(option);
    return key.length > 2 && heard.some((s) => s === key || s.split(" ").includes(key) || s.startsWith(key) || (key.includes(" ") && s.includes(key)));
  });
}
