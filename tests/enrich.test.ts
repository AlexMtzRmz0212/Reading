import { describe, expect, it } from "vitest";
import { bestMatch, fillFrom, hasGap, needsSearch, parseFills, queriesFor } from "@/lib/enrich";
import { toPublished, yearOf } from "@/lib/published";
import type { SearchResult } from "@/lib/providers/types";

const choices = { authors: [], genres: ["Dystopia", "Fantasy", "Science fiction"] };
const result = (over: Partial<SearchResult> = {}): SearchResult => ({ key: "ol:1", source: "Open Library", title: "Nineteen Eighty-Four", authors: ["George Orwell"], year: "1949", subjects: ["Dystopias", "Totalitarianism"], coverUrl: "https://covers.openlibrary.org/b/id/7222246-L.jpg", ...over });
const book = (over = {}) => ({ id: "b1", title: "1984", originalTitle: "Nineteen Eighty-Four", author: "George Orwell", genres: [] as string[], published: undefined as string | undefined, coverUrl: undefined as string | undefined, hasIcon: false, ...over });

describe("toPublished", () => {
  it("turns a year into 1 January and keeps real dates", () => {
    expect(toPublished("1949")).toBe("1949-01-01");
    expect(toPublished("1949-06")).toBe("1949-06-01");
    expect(toPublished(" 1949-06-08 ")).toBe("1949-06-08");
  });
  it("refuses what isn’t a date", () => {
    for (const v of ["", "c. 350 BC", "1949-13-01", "1949-02-30", "0000", 1949, undefined]) expect(toPublished(v)).toBeUndefined();
  });
  it("gives the year back", () => {
    expect(yearOf("1949-01-01")).toBe("1949");
    expect(yearOf("0476-01-01")).toBe("476");
    expect(yearOf(undefined)).toBeUndefined();
  });
});

describe("filling gaps", () => {
  it("knows which books have a gap", () => {
    const full = { genres: ["Dystopia"], published: "1949-01-01", coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg", hasIcon: true };
    expect(hasGap(full)).toBe(false);
    expect(hasGap({ ...full, genres: [] })).toBe(true);
    expect(hasGap({ ...full, published: undefined })).toBe(true);
    expect(hasGap({ ...full, coverUrl: undefined })).toBe(true);
    // A lasting cover with no icon is a gap that needs no search; a Notion-hosted one can’t be an icon.
    expect(hasGap({ ...full, hasIcon: false })).toBe(true);
    expect(needsSearch({ ...full, hasIcon: false })).toBe(false);
    expect(hasGap({ ...full, hasIcon: false, coverUrl: "https://prod-files-secure.s3.us-west-2.amazonaws.com/x.png" })).toBe(false);
  });

  it("searches the original title, then the shown title, then the title alone", () => {
    expect(queriesFor(book())).toEqual(["Nineteen Eighty-Four George Orwell", "1984 George Orwell", "1984"]);
    expect(queriesFor(book({ originalTitle: undefined, author: undefined }))).toEqual(["1984"]);
    expect(queriesFor(book({ originalTitle: "1984" }))).toEqual(["1984 George Orwell", "1984"]);
  });

  it("matches the same book only", () => {
    expect(bestMatch(book(), [result({ title: "Animal Farm" }), result()])?.title).toBe("Nineteen Eighty-Four");
    expect(bestMatch(book(), [result({ authors: ["Someone Else"] })])).toBeUndefined();
    expect(bestMatch(book(), [])).toBeUndefined();
  });

  it("fills only what is missing", () => {
    const cover = "https://covers.openlibrary.org/b/id/7222246-L.jpg";
    expect(fillFrom(book(), result(), choices)).toEqual({ id: "b1", published: "1949-01-01", genres: ["Dystopia"], cover, icon: cover });
    expect(fillFrom(book({ published: "1950-05-05" }), result(), choices)).toEqual({ id: "b1", genres: ["Dystopia"], cover, icon: cover });
    expect(fillFrom(book({ genres: ["Fantasy"], coverUrl: cover, hasIcon: true }), result(), choices)).toEqual({ id: "b1", published: "1949-01-01" });
    expect(fillFrom(book({ genres: ["Fantasy"], published: "1950-05-05", coverUrl: cover, hasIcon: true }), result(), choices)).toBeUndefined();
  });

  it("never replaces a cover or an icon, and only takes covers from known hosts", () => {
    const mine = "https://example.com/mine.jpg";
    expect(fillFrom(book({ coverUrl: mine, hasIcon: true, genres: ["Fantasy"], published: "1950-05-05" }), result(), choices)).toBeUndefined();
    expect(fillFrom(book({ coverUrl: mine, genres: ["Fantasy"], published: "1950-05-05" }), result(), choices)).toEqual({ id: "b1", icon: mine });
    expect(fillFrom(book({ genres: ["Fantasy"], published: "1950-05-05" }), result({ coverUrl: "https://evil.example/x.jpg" }), choices)).toBeUndefined();
    expect(fillFrom(book({ coverUrl: mine, genres: ["Fantasy"], published: "1950-05-05" }), undefined, choices)).toEqual({ id: "b1", icon: mine });
  });
});

describe("parseFills", () => {
  const cover = "https://covers.openlibrary.org/b/id/7222246-L.jpg";
  const books = [book({ id: "a" }), book({ id: "b", genres: ["Fantasy"], published: "1950-05-05", coverUrl: "https://example.com/mine.jpg", hasIcon: true })];

  it("writes only empty fields, with existing genre options", () => {
    const out = parseFills({ changes: [{ id: "a", published: "1949", genres: ["dystopia", "Made up"] }, { id: "b", published: "1999", genres: ["Dystopia"] }] }, books, choices);
    expect(out).toEqual({ ok: true, value: [{ id: "a", patch: { published: "1949-01-01", genres: ["Dystopia"] } }] });
  });

  it("takes a cover and icon from known hosts, only where a book has none", () => {
    expect(parseFills({ changes: [{ id: "a", cover, icon: cover }] }, books, choices)).toEqual({ ok: true, value: [{ id: "a", patch: { cover, icon: cover } }] });
    expect(parseFills({ changes: [{ id: "b", cover, icon: cover }] }, books, choices)).toEqual({ ok: true, value: [] });
    expect(parseFills({ changes: [{ id: "a", cover: "https://evil.example/x.jpg" }] }, books, choices).ok).toBe(false);
    expect(parseFills({ changes: [{ id: "a", icon: "https://evil.example/x.jpg" }] }, books, choices).ok).toBe(false);
  });

  it("refuses unknown books, bad dates and empty bodies", () => {
    expect(parseFills({ changes: [{ id: "zzz", published: "1949" }] }, books, choices).ok).toBe(false);
    expect(parseFills({ changes: [{ id: "a", published: "soon" }] }, books, choices).ok).toBe(false);
    expect(parseFills({ changes: [] }, books, choices).ok).toBe(false);
    expect(parseFills({}, books, choices).ok).toBe(false);
  });
});
