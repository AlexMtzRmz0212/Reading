/** The Top list: books in the order they’d be recommended, stored in Notion’s Top select as "01", "02", "03"… */
import type { Result } from "./types";

type Ranked = { id: string; title: string; rank: number | null };

/** Top is a select, so every place is an option. This keeps a bad request from writing hundreds of them. */
export const MAX_RANKS = 999;

/** "07" is 7. Anything that isn’t a positive whole number is no rank at all. */
export function parseRank(top: string | null | undefined): number | null {
  if (!top || !/^\d+$/.test(top.trim())) return null;
  const n = parseInt(top, 10);
  return n > 0 ? n : null;
}

/** 7 is "07", the way the Top options are named, so Notion’s own ascending sort keeps working. Three digits from 100. */
export const formatRank = (place: number) => String(place).padStart(place >= 100 ? 3 : 2, "0");

/** Ranked books in list order: by place, then by title where two books share one. */
export function ranked<T extends Ranked>(books: T[]): T[] {
  return books.filter((b) => b.rank != null).sort((a, b) => a.rank! - b.rank! || a.title.localeCompare(b.title));
}

/** What is wrong with the list as stored: places held twice, and places nobody holds below the highest one. */
export function rankProblems(books: { rank: number | null }[]): { shared: number[]; missing: number[] } {
  const count = new Map<number, number>();
  for (const b of books) if (b.rank != null) count.set(b.rank, (count.get(b.rank) ?? 0) + 1);
  const highest = Math.max(0, ...count.keys());
  const missing: number[] = [];
  for (let place = 1; place < highest; place++) if (!count.has(place)) missing.push(place);
  const shared = [...count].filter(([, n]) => n > 1).map(([place]) => place);
  return { shared: shared.sort((a, b) => a - b), missing };
}

export interface RankChange {
  id: string;
  title: string;
  from: number | null;
  /** null: leaves the list. */
  to: number | null;
}

/**
 * What to write so the books in `order` hold 1, 2, 3… in that order and every other book leaves the list.
 * Only books whose place actually changes are returned, so applying costs one Notion write per moved book.
 */
export function rankChanges(books: Ranked[], order: string[]): RankChange[] {
  const place = new Map(order.map((id, i) => [id, i + 1]));
  return books
    .flatMap((b) => {
      const to = place.get(b.id) ?? null;
      return b.rank === to ? [] : [{ id: b.id, title: b.title, from: b.rank, to }];
    })
    .sort((a, b) => (a.to ?? Infinity) - (b.to ?? Infinity) || a.title.localeCompare(b.title));
}

/** The new order sent by the Ranks screen: known book ids, each once. */
export function parseOrder(body: Record<string, unknown>, ids: Set<string>): Result<string[]> {
  const order = body.order;
  if (!Array.isArray(order) || order.some((s) => typeof s !== "string")) return { ok: false, error: "Send the list as an array of books" };
  if (order.length > MAX_RANKS) return { ok: false, error: `The list holds up to ${MAX_RANKS} books` };
  if (new Set(order).size !== order.length) return { ok: false, error: "A book is on the list twice" };
  if (order.some((s) => !ids.has(s))) return { ok: false, error: "A book on the list is no longer in Notion. Reload and try again." };
  return { ok: true, value: order as string[] };
}

/** A score from the editor: 0 to 10 in half steps, or null to clear it. */
export function parseScore(value: unknown): Result<number | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10 || (value * 2) % 1 !== 0) {
    return { ok: false, error: "A score goes from 0 to 10 in steps of 0.5" };
  }
  return { ok: true, value };
}
