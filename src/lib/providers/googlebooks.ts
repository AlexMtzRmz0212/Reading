import { fetchRetry } from "../http";
import type { SearchResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Volume = any;

export function mapGoogleVolume(volume: Volume): SearchResult | undefined {
  const info = volume?.volumeInfo;
  const title = typeof info?.title === "string" ? info.title.trim() : "";
  if (!title || typeof volume.id !== "string") return undefined;
  const thumb: string | undefined = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  return {
    key: `gb:${volume.id}`,
    source: "Google Books",
    title: info.subtitle ? `${title}: ${info.subtitle}` : title,
    authors: Array.isArray(info.authors) ? info.authors.filter((a: unknown): a is string => typeof a === "string") : [],
    year: typeof info.publishedDate === "string" ? info.publishedDate.slice(0, 4) : undefined,
    pages: typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : undefined,
    // Google serves thumbnails over http; Notion and the page need https.
    coverUrl: thumb?.replace(/^http:/, "https:").replace("&edge=curl", ""),
    subjects: Array.isArray(info.categories) ? info.categories.filter((c: unknown): c is string => typeof c === "string") : [],
  };
}

/** Second source, used only when GOOGLE_BOOKS_API_KEY is set. */
export async function searchGoogleBooks(query: string, key: string): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&key=${encodeURIComponent(key)}`;
  const res = await fetchRetry(url, undefined, 1);
  if (!res.ok) throw new Error(`Google Books search failed (${res.status})`);
  const data = (await res.json()) as { items?: Volume[] };
  return (data.items ?? []).map(mapGoogleVolume).filter((r): r is SearchResult => Boolean(r));
}
