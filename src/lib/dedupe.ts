/** Matching that ignores accents, case and punctuation: "Saint-Exupery" is "Saint-Exupéry", "el principe" is "El Príncipe". */
import { normalize } from "./format";

/** The existing select option a typed name should reuse, so Notion doesn’t grow a near-duplicate. */
export function matchOption(name: string, options: string[]): string | undefined {
  const key = normalize(name);
  if (!key) return undefined;
  return options.find((o) => o === name) ?? options.find((o) => normalize(o) === key);
}

/** A title without its subtitle: "Quiet: The Power of Introverts…" is filed as "quiet". */
const mainTitle = (title: string) => normalize(title.split(/[:(]/)[0]);

function titleKeys(titles: (string | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const t of titles) {
    if (!t?.trim()) continue;
    for (const key of [normalize(t), mainTitle(t)]) if (key) keys.add(key);
  }
  return keys;
}

interface Titled {
  title: string;
  originalTitle?: string;
  author?: string;
}

/** "george orwell" and "orwell, george", or one name inside the other ("karl marx" in "friedrich engels y karl marx"). */
function sameAuthor(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const words = (s: string) => new Set(s.split(" ").filter((w) => w.length > 1));
  const [wa, wb] = [words(a), words(b)];
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared > 0 && shared >= Math.min(wa.size, wb.size);
}

/**
 * Books already in the catalog that look like `candidate`: one of its titles equals one of theirs.
 * When both name an author the authors must agree too, so two different books called "Ética" aren’t flagged.
 */
export function findDuplicates<T extends Titled>(candidate: Titled, books: T[]): T[] {
  const wanted = titleKeys([candidate.title, candidate.originalTitle]);
  if (wanted.size === 0) return [];
  const author = candidate.author ? normalize(candidate.author) : "";
  return books.filter((b) => {
    const sameTitle = [...titleKeys([b.title, b.originalTitle])].some((k) => wanted.has(k));
    if (!sameTitle) return false;
    const theirs = b.author ? normalize(b.author) : "";
    return !author || !theirs || sameAuthor(author, theirs);
  });
}
