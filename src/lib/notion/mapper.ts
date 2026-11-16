import { slugify } from "../format";
import { yearOf } from "../published";
import { formatRank, parseRank } from "../ranks";
import { STATUSES, type Book, type Status } from "../types";
import type { NotionAny } from "./client";
import { FIELD } from "./schema";

const text = (prop: NotionAny): string => ((prop?.title ?? prop?.rich_text ?? []) as NotionAny[]).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
const num = (prop: NotionAny): number | undefined => (typeof prop?.number === "number" ? prop.number : undefined);
const choice = (prop: NotionAny): string | undefined => prop?.status?.name ?? prop?.select?.name ?? undefined;
const names = (prop: NotionAny): string[] => ((prop?.multi_select ?? []) as NotionAny[]).map((o) => o.name);
const day = (prop: NotionAny): string | undefined => (typeof prop?.date?.start === "string" ? prop.date.start.slice(0, 10) : undefined);
/** External covers keep working; Notion-hosted ones expire after about an hour (the page revalidates sooner than that). */
const image = (file: NotionAny): string | undefined => file?.external?.url ?? file?.file?.url ?? undefined;

/** Every row maps, whatever it is missing: the database’s templates also allow articles and TV series. */
export function pageToBook(page: NotionAny, titleProp: string): Book {
  const p = page.properties ?? {};
  const title = text(p[titleProp]).trim();
  const status = choice(p[FIELD.status]);
  const pages = num(p[FIELD.pages]);
  const published = day(p[FIELD.published]);
  return {
    id: page.id,
    slug: slugify(title, page.id),
    title,
    originalTitle: text(p[FIELD.originalName]).trim() || undefined,
    author: choice(p[FIELD.author])?.trim() || undefined,
    genres: names(p[FIELD.genre]),
    published,
    year: yearOf(published),
    pages: pages && pages > 0 ? pages : undefined,
    currentPage: num(p[FIELD.currentPage]),
    status: STATUSES.includes(status as Status) ? (status as Status) : "Not started",
    rank: parseRank(choice(p[FIELD.top])),
    score: num(p[FIELD.score]),
    started: day(p[FIELD.started]),
    completed: day(p[FIELD.completed]),
    coverUrl: image(page.cover),
    hasIcon: Boolean(page.icon),
  };
}

/** Changes the owner tools can make to an existing row. null clears a value. */
export interface BookPatch {
  status?: Status;
  currentPage?: number | null;
  started?: string | null;
  completed?: string | null;
  rank?: number | null;
  score?: number | null;
  pages?: number | null;
  published?: string | null;
  genres?: string[];
  /** Page cover and icon: an image address, written as an external image (not Notion properties). */
  cover?: string;
  icon?: string;
}

const date = (value: string | null) => ({ date: value ? { start: value } : null });

export function patchToProperties(patch: BookPatch): Record<string, NotionAny> {
  const out: Record<string, NotionAny> = {};
  if (patch.status !== undefined) out[FIELD.status] = { status: { name: patch.status } };
  if (patch.currentPage !== undefined) out[FIELD.currentPage] = { number: patch.currentPage };
  if (patch.started !== undefined) out[FIELD.started] = date(patch.started);
  if (patch.completed !== undefined) out[FIELD.completed] = date(patch.completed);
  // Top is a select with text values: Notion adds the option ("93", "94"…) the first time a place is used.
  if (patch.rank !== undefined) out[FIELD.top] = { select: patch.rank ? { name: formatRank(patch.rank) } : null };
  if (patch.score !== undefined) out[FIELD.score] = { number: patch.score };
  if (patch.pages !== undefined) out[FIELD.pages] = { number: patch.pages };
  if (patch.published !== undefined) out[FIELD.published] = date(patch.published);
  if (patch.genres !== undefined) out[FIELD.genre] = { multi_select: patch.genres.map((name) => ({ name })) };
  return out;
}

export interface NewBook {
  title: string;
  originalTitle?: string;
  author?: string;
  genres?: string[];
  /** YYYY-MM-DD */
  published?: string;
  pages?: number;
  coverUrl?: string;
}

const rich = (content: string) => [{ type: "text", text: { content } }];

/** A new row: Status starts at Not started and Top stays empty (the Uncatalogued pile). */
export function newBookToProperties(input: NewBook, titleProp: string): Record<string, NotionAny> {
  const out: Record<string, NotionAny> = {
    [titleProp]: { title: rich(input.title) },
    [FIELD.status]: { status: { name: "Not started" } },
  };
  if (input.originalTitle) out[FIELD.originalName] = { rich_text: rich(input.originalTitle) };
  // A select: writing a name that isn’t an option yet creates it.
  if (input.author) out[FIELD.author] = { select: { name: input.author } };
  if (input.genres?.length) out[FIELD.genre] = { multi_select: input.genres.map((name) => ({ name })) };
  if (input.published) out[FIELD.published] = date(input.published);
  if (input.pages) out[FIELD.pages] = { number: input.pages };
  return out;
}
