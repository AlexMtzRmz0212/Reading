import { listAllBooks } from "./notion/books";
import type { Book } from "./types";

// A burst of requests (the page plus an API call, a run of progress logs) shares one read of Notion.
const TTL_MS = 15_000;
let cache: { at: number; value: Promise<Book[]> } | undefined;

export function getLibrary({ fresh = false } = {}): Promise<Book[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = listAllBooks();
  cache = { at: Date.now(), value };
  value.catch(() => {
    if (cache?.value === value) cache = undefined;
  });
  return value;
}

export const invalidateLibrary = () => {
  cache = undefined;
};
