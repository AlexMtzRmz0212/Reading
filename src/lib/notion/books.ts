import { mapLimit } from "../http";
import type { Book, Choices } from "../types";
import { getSchema, notion, refreshSchema, type NotionAny } from "./client";
import { newBookToProperties, pageToBook, patchToProperties, type BookPatch, type NewBook } from "./mapper";
import { FIELD } from "./schema";

/** Every row of the database, 100 per call. Rows without a title are skipped. */
export async function listAllBooks(): Promise<Book[]> {
  const { dataSourceId, titleProp } = await getSchema();
  const books: Book[] = [];
  let cursor: string | undefined;
  do {
    const res: NotionAny = await notion().dataSources.query({ data_source_id: dataSourceId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    for (const page of res.results as NotionAny[]) {
      if (page.object !== "page" || page.in_trash || page.archived) continue;
      const book = pageToBook(page, titleProp);
      if (book.title) books.push(book);
    }
    cursor = res.has_more ? (res.next_cursor as string) : undefined;
  } while (cursor);
  return books;
}

export async function listChoices(): Promise<Choices> {
  const { options } = await getSchema();
  return { authors: options[FIELD.author] ?? [], genres: options[FIELD.genre] ?? [] };
}

export async function updateBook(pageId: string, patch: BookPatch): Promise<void> {
  const properties = patchToProperties(patch);
  const hasProperties = Object.keys(properties).length > 0;
  if (!hasProperties && !patch.cover && !patch.icon) return;
  await notion().pages.update({
    page_id: pageId,
    ...(hasProperties ? { properties } : {}),
    ...(patch.cover ? { cover: external(patch.cover) } : {}),
    ...(patch.icon ? { icon: external(patch.icon) } : {}),
  });
}

// Notion allows about 3 requests per second per integration.
const WRITE_CONCURRENCY = 3;

/** Several rows at once (a rank reorder), three writes in flight at a time. */
export async function updateBooks(changes: { id: string; patch: BookPatch }[]): Promise<void> {
  await mapLimit(changes, WRITE_CONCURRENCY, (c) => updateBook(c.id, c.patch));
  // New places ("93") became Top options.
  if (changes.some((c) => c.patch.rank)) refreshSchema();
}

const external = (url: string) => ({ type: "external" as const, external: { url } });

/** The cover is both the Notion page cover and its icon, so Notion’s own views show it too. Returns the new page id. */
export async function createBook(input: NewBook): Promise<string> {
  const { dataSourceId, titleProp } = await getSchema();
  const page: NotionAny = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: newBookToProperties(input, titleProp),
    ...(input.coverUrl ? { cover: external(input.coverUrl), icon: external(input.coverUrl) } : {}),
  });
  // A new author became a select option.
  refreshSchema();
  return page.id;
}
