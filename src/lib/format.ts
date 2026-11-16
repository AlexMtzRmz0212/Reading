import type { PublicBook } from "./types";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Lowercase, no accents, no punctuation, single spaces: what titles and names are compared by. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function slugify(title: string, pageId: string): string {
  const base = normalize(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${base || "book"}-${pageId.replace(/-/g, "").slice(0, 8)}`;
}

const PARTICLES = new Set(["de", "del", "della", "der", "di", "du", "la", "le", "van", "von"]);
const SUFFIXES = /^(jr\.?|sr\.?|ii|iii|iv)$/i;
const JOINERS = /\s+(?:y|and|&)\s+/i;

/** Surname and the rest of one person’s name: "Antoine de Saint-Exupéry" is ["Saint-Exupéry", "Antoine de"]. */
function splitName(name: string): [surname: string, rest: string] {
  const words = name.trim().split(/\s+/);
  let suffix = "";
  if (words.length > 2 && SUFFIXES.test(words[words.length - 1])) suffix = words.pop()!;
  if (words.length < 2) return [words[0] ?? "", suffix];
  const surname = words.pop()!;
  // "de", "von"… stay with the given names, as library catalogs file them.
  const given = words.join(" ");
  return [surname, suffix ? `${given}, ${suffix}` : given];
}

/** The author as a catalog card files it: "ORWELL, George". With several authors only the first is turned around. */
export function catalogAuthor(author: string | undefined): string {
  if (!author?.trim()) return "";
  const [first, ...others] = author.split(JOINERS);
  const [surname, rest] = splitName(first);
  const head = rest ? `${surname.toLocaleUpperCase()}, ${rest}` : surname.toLocaleUpperCase();
  const joiner = author.match(JOINERS)?.[0].trim() ?? "";
  return others.length ? `${head} ${joiner} ${others.join(` ${joiner} `)}` : head;
}

/** What Author A to Z sorts by: the first author’s surname, then the given names. */
export function authorSortKey(author: string | undefined): string {
  if (!author?.trim()) return "\uffff";
  const [surname, rest] = splitName(author.split(JOINERS)[0]);
  const given = rest
    .split(" ")
    .filter((w) => !PARTICLES.has(w.toLowerCase()))
    .join(" ");
  return normalize(`${surname} ${given}`);
}

/** "1. Dystopia. 2. Political fiction." the way subject headings are traced on a card. */
export const subjectHeadings = (genres: string[]) => genres.map((g, i) => `${i + 1}. ${g}.`).join(" ");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A date as a library date stamp prints it: "MAY 30 2025". */
export function stampDate(day: string | undefined): string {
  const m = day?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1] ?? "???"} ${Number(m[3])} ${m[1]}`;
}

/** Today as YYYY-MM-DD in the owner’s time zone (TIME_ZONE), so a late-night page isn’t stamped tomorrow. */
export function today(timeZone?: string, now = new Date()): string {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).format(now);
  } catch {
    // An unknown TIME_ZONE falls back to the server’s own.
    return new Intl.DateTimeFormat("en-CA", options).format(now);
  }
}

/** Whole percent read. Notion’s own formula column is read-only, so it is worked out here. */
export function percentRead(book: Pick<PublicBook, "pages" | "currentPage" | "status">): number | null {
  if (book.status === "Done") return 100;
  if (!book.pages || book.currentPage == null) return null;
  return Math.max(0, Math.min(100, Math.round((book.currentPage / book.pages) * 100)));
}

/** The rubber stamp for each status. */
export const STAMP_WORD = { Done: "Finished", "In progress": "On loan", "Not started": "Awaiting" } as const;
