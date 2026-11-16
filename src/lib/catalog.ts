/** Filtering, sorting and the drawer’s guide tabs. Pure, so about a hundred cards re-filter on every keystroke for free. */
import { authorSortKey, normalize } from "./format";
import { formatRank } from "./ranks";
import type { PublicBook, Status } from "./types";

export const SORTS = [
  { value: "rank", label: "Rank" },
  { value: "author", label: "Author A to Z" },
  { value: "title", label: "Title" },
  { value: "finished", label: "Recently finished" },
  { value: "pages", label: "Pages" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export interface Filters {
  q: string;
  author: string;
  genre: string;
  status: Status | "";
  year: string;
}
export const NO_FILTERS: Filters = { q: "", author: "", genre: "", status: "", year: "" };

/** Everything the search box looks through, normalized once per book. */
export const searchKey = (b: PublicBook) => normalize([b.title, b.originalTitle, b.author, b.year, ...b.genres].filter(Boolean).join(" "));

export function matches(book: PublicBook, key: string, f: Filters, q: string): boolean {
  if (f.author && book.author !== f.author) return false;
  if (f.status && book.status !== f.status) return false;
  if (f.genre && !book.genres.includes(f.genre)) return false;
  if (f.year && book.year !== f.year) return false;
  return !q || q.split(" ").every((word) => key.includes(word));
}

const byTitle = (a: PublicBook, b: PublicBook) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

export function sortBooks<T extends PublicBook>(books: T[], sort: Sort): T[] {
  const list = [...books];
  switch (sort) {
    case "rank":
      return list.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || byTitle(a, b));
    case "author":
      return list.sort((a, b) => authorSortKey(a.author).localeCompare(authorSortKey(b.author)) || byTitle(a, b));
    case "title":
      return list.sort(byTitle);
    case "finished":
      // Finished books newest first, then everything else in rank order.
      return list.sort((a, b) => (b.completed ?? "").localeCompare(a.completed ?? "") || (a.rank ?? Infinity) - (b.rank ?? Infinity) || byTitle(a, b));
    case "pages":
      return list.sort((a, b) => (b.pages ?? -1) - (a.pages ?? -1) || byTitle(a, b));
  }
}

export interface Group<T> {
  /** Anchor id of the section. */
  id: string;
  /** What the guide tab says: "01–10", "A", "2025". */
  label: string;
  books: T[];
}

const letter = (key: string) => (/^[a-z]/.test(key) ? key[0].toUpperCase() : "#");

function tabOf(book: PublicBook, sort: Sort): string {
  switch (sort) {
    case "rank": {
      if (book.rank == null) return "Uncatalogued";
      const from = Math.floor((book.rank - 1) / 10) * 10 + 1;
      return `${formatRank(from)}–${formatRank(from + 9)}`;
    }
    case "author":
      return book.author ? letter(authorSortKey(book.author)) : "No author";
    case "title":
      return letter(normalize(book.title));
    case "finished":
      return book.completed ? book.completed.slice(0, 4) : "Not finished";
    case "pages":
      return book.pages ? "By length" : "Length unknown";
  }
}

/** Sorted books cut into the runs that sit behind each guide tab. */
export function groupBooks<T extends PublicBook>(sorted: T[], sort: Sort): Group<T>[] {
  const groups: Group<T>[] = [];
  for (const book of sorted) {
    const label = tabOf(book, sort);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.books.push(book);
    else groups.push({ id: `tab-${normalize(label).replace(/ /g, "-") || "other"}`, label, books: [book] });
  }
  return groups;
}

/** Values the filter menus offer: only what the catalog actually holds. */
export function facets(books: PublicBook[]): { authors: string[]; genres: string[]; years: string[] } {
  const authors = new Set<string>();
  const genres = new Set<string>();
  const years = new Set<string>();
  for (const b of books) {
    if (b.author) authors.add(b.author);
    for (const g of b.genres) genres.add(g);
    if (b.year) years.add(b.year);
  }
  return {
    authors: [...authors].sort((a, b) => authorSortKey(a).localeCompare(authorSortKey(b))),
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    years: [...years].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  };
}

/** Filters and sort as a query string ("?q=plato&sort=author"), so a filtered drawer can be linked to and survives a reload. */
export function toQuery(filters: Filters, sort: Sort): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (sort !== "rank") params.set("sort", sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function fromQuery(search: string): { filters: Filters; sort: Sort } {
  const params = new URLSearchParams(search);
  const get = (key: string) => (params.get(key) ?? "").slice(0, 200);
  const status = get("status");
  const sort = get("sort");
  return {
    filters: { q: get("q"), author: get("author"), genre: get("genre"), year: get("year"), status: (["Not started", "In progress", "Done"] as const).find((s) => s === status) ?? "" },
    sort: SORTS.find((s) => s.value === sort)?.value ?? "rank",
  };
}
