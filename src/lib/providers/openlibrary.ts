import { fetchRetry } from "../http";
import type { SearchResult } from "./types";

const FIELDS = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject,language";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : []);

/** One search.json doc as a result. Docs without a title are dropped (undefined). */
export function mapOpenLibraryDoc(doc: Doc): SearchResult | undefined {
  const title = typeof doc?.title === "string" ? doc.title.trim() : "";
  if (!title || typeof doc.key !== "string") return undefined;
  const year = Number.isInteger(doc.first_publish_year) ? String(doc.first_publish_year) : undefined;
  const pages = typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0 ? Math.round(doc.number_of_pages_median) : undefined;
  return {
    key: `ol:${doc.key}`,
    source: "Open Library",
    title,
    authors: strings(doc.author_name),
    year,
    pages,
    coverUrl: Number.isInteger(doc.cover_i) && doc.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
    subjects: strings(doc.subject).slice(0, 40),
  };
}

/** No key needed. Open Library asks automated clients to say who they are; this names the app, not its owner. */
export async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${FIELDS}&limit=10`;
  const res = await fetchRetry(url, { headers: { "user-agent": "reading-list-catalog/0.1" } }, 2);
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  const data = (await res.json()) as { docs?: Doc[] };
  return (data.docs ?? []).map(mapOpenLibraryDoc).filter((r): r is SearchResult => Boolean(r));
}
