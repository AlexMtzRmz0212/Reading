/** One book found by a search, in the shape the Add page fills its form from. */
export interface SearchResult {
  /** Unique within its source: "ol:/works/OL1168083W". */
  key: string;
  source: "Open Library" | "Google Books";
  title: string;
  authors: string[];
  year?: string;
  pages?: number;
  coverUrl?: string;
  subjects: string[];
}
