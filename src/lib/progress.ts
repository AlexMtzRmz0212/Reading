/** How logging a page moves a book between Not started, In progress and Done, and which dates get stamped. Pure: the routes and the UI both use it. */
import { STATUSES, type Book, type Result, type Status } from "./types";

export type ProgressState = Pick<Book, "status" | "currentPage" | "pages" | "started" | "completed">;

/** Only the fields that change. null clears a value in Notion. */
export interface ProgressPatch {
  status?: Status;
  currentPage?: number | null;
  started?: string | null;
  completed?: string | null;
}

const MAX_PAGE = 100_000;
const isPage = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PAGE;

/** The reader is now on `page`. `today` is YYYY-MM-DD in the owner’s time zone. */
export function logPage(book: ProgressState, page: unknown, today: string): Result<ProgressPatch> {
  if (!isPage(page)) return { ok: false, error: "The page must be a whole number, 0 or more" };
  const last = book.pages && book.pages > 0 ? book.pages : undefined;
  const patch: ProgressPatch = {};
  const current = last ? Math.min(page, last) : page;
  if (current !== book.currentPage) patch.currentPage = current;

  if (last && current >= last) {
    // The last page: stamp it finished. A missing Started is filled in, an existing one is never touched.
    if (book.status !== "Done") patch.status = "Done";
    if (!book.completed) patch.completed = today;
    if (!book.started && book.status === "Not started") patch.started = today;
  } else if (current > 0) {
    if (book.status !== "In progress") patch.status = "In progress";
    if (!book.started) patch.started = today;
    // Back from Done (a correction or a re-read): it isn’t finished any more.
    if (book.completed) patch.completed = null;
  }
  return { ok: true, value: patch };
}

/** "Finished", for books whose page count is unknown too. */
export function markFinished(book: ProgressState, today: string): ProgressPatch {
  const patch: ProgressPatch = {};
  if (book.status !== "Done") patch.status = "Done";
  if (!book.completed) patch.completed = today;
  if (!book.started && book.status === "Not started") patch.started = today;
  if (book.pages && book.currentPage !== book.pages) patch.currentPage = book.pages;
  return patch;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && !Number.isNaN(Date.parse(v));

/** Undo: the values a book had before the last log, sent back whole. */
export function parseRestore(value: unknown): Result<Required<ProgressPatch>> {
  if (!value || typeof value !== "object") return { ok: false, error: "Nothing to restore" };
  const v = value as Record<string, unknown>;
  const currentPage = v.currentPage ?? null;
  const started = v.started ?? null;
  const completed = v.completed ?? null;
  if (!STATUSES.includes(v.status as Status)) return { ok: false, error: "Unknown status" };
  if (currentPage !== null && !isPage(currentPage)) return { ok: false, error: "The page must be a whole number" };
  if ((started !== null && !isDay(started)) || (completed !== null && !isDay(completed))) return { ok: false, error: "Dates must be YYYY-MM-DD" };
  return { ok: true, value: { status: v.status as Status, currentPage, started, completed } };
}

/** The book as it reads once a patch lands. Used for the optimistic update. */
export function applyProgress<T extends ProgressState>(book: T, patch: ProgressPatch): T {
  const next = { ...book };
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.currentPage !== undefined) next.currentPage = patch.currentPage ?? undefined;
  if (patch.started !== undefined) next.started = patch.started ?? undefined;
  if (patch.completed !== undefined) next.completed = patch.completed ?? undefined;
  return next;
}

/** What Undo sends back: the progress fields as they were. */
export const snapshot = (book: ProgressState): Required<ProgressPatch> => ({
  status: book.status,
  currentPage: book.currentPage ?? null,
  started: book.started ?? null,
  completed: book.completed ?? null,
});
