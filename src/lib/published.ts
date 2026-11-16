/** The Published column is a Notion date, so a year alone is stored as 1 January of that year. Pure. */

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const YEAR = /^\d{4}$/;

/** "1949", "1949-06" or "1949-06-08" as YYYY-MM-DD; undefined when it isn’t a real date (Notion dates can’t be BC either). */
export function toPublished(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const iso = YEAR.test(text) ? `${text}-01-01` : MONTH.test(text) ? `${text}-01` : text;
  const m = FULL.exec(iso);
  if (!m || Number(m[1]) < 1) return undefined;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/** The year of a Published date, for the catalog’s cards and Year filter. */
export const yearOf = (published: string | undefined): string | undefined => (published ? published.slice(0, 4).replace(/^0+(?=\d)/, "") : undefined);
