import { describe, expect, it } from "vitest";
import { NO_FILTERS, facets, fromQuery, groupBooks, matches, searchKey, sortBooks, toQuery } from "@/lib/catalog";
import type { PublicBook } from "@/lib/types";

const book = (b: Partial<PublicBook> & { title: string }): PublicBook => ({ slug: b.title, genres: [], status: "Not started", rank: null, ...b });

const books = [
  book({ title: "The Chain", author: "Adrian McKinty", rank: 1, status: "In progress", pages: 312 }),
  book({ title: "El Mundo de Sofía", originalTitle: "Sofies verden", author: "Jostein Gaarder", rank: 5, status: "In progress", pages: 638 }),
  book({ title: "Órganon", author: "Aristotle", rank: 42 }),
  book({ title: "La Historia del Loco", author: "John Katzenbach", rank: 87, status: "Done", completed: "2014-09-15", genres: ["Thriller"], year: "2004" }),
  book({ title: "How to Build Your Career in AI", author: "Andrew Ng", rank: 7, status: "Done", completed: "2025-05-30", pages: 41 }),
  book({ title: "An article" }),
];

describe("sorting", () => {
  const titles = (sort: Parameters<typeof sortBooks>[1]) => sortBooks(books, sort).map((b) => b.title);

  it("rank: ascending, uncatalogued last", () => {
    expect(titles("rank")).toEqual(["The Chain", "El Mundo de Sofía", "How to Build Your Career in AI", "Órganon", "La Historia del Loco", "An article"]);
  });

  it("author: by surname, no author last", () => {
    expect(titles("author")).toEqual(["Órganon", "El Mundo de Sofía", "La Historia del Loco", "The Chain", "How to Build Your Career in AI", "An article"]);
  });

  it("title ignores accents", () => {
    expect(titles("title").indexOf("Órganon")).toBeLessThan(titles("title").indexOf("The Chain"));
  });

  it("recently finished: newest first, then the rest by rank", () => {
    expect(titles("finished").slice(0, 3)).toEqual(["How to Build Your Career in AI", "La Historia del Loco", "The Chain"]);
  });

  it("pages: longest first, unknown last", () => {
    expect(titles("pages").slice(0, 3)).toEqual(["El Mundo de Sofía", "The Chain", "How to Build Your Career in AI"]);
  });

  it("does not reorder the input", () => {
    const before = books.map((b) => b.title);
    sortBooks(books, "title");
    expect(books.map((b) => b.title)).toEqual(before);
  });
});

describe("guide tabs", () => {
  const tabs = (sort: Parameters<typeof sortBooks>[1]) => groupBooks(sortBooks(books, sort), sort).map((g) => [g.label, g.books.length]);

  it("rank: tens", () => {
    expect(tabs("rank")).toEqual([
      ["01–10", 3],
      ["41–50", 1],
      ["81–90", 1],
      ["Uncatalogued", 1],
    ]);
  });

  it("author: letters", () => {
    expect(tabs("author")).toEqual([
      ["A", 1],
      ["G", 1],
      ["K", 1],
      ["M", 1],
      ["N", 1],
      ["No author", 1],
    ]);
  });

  it("finished: years", () => {
    expect(tabs("finished")).toEqual([
      ["2025", 1],
      ["2014", 1],
      ["Not finished", 4],
    ]);
  });

  it("gives each run an anchor id", () => {
    expect(groupBooks(sortBooks(books, "rank"), "rank").map((g) => g.id)).toEqual(["tab-01-10", "tab-41-50", "tab-81-90", "tab-uncatalogued"]);
  });
});

describe("filtering", () => {
  const find = (f: Partial<typeof NO_FILTERS>, q = "") => books.filter((b) => matches(b, searchKey(b), { ...NO_FILTERS, ...f }, q)).map((b) => b.title);

  it("searches title, original title and author without accents", () => {
    expect(find({}, "sofia")).toEqual(["El Mundo de Sofía"]);
    expect(find({}, "sofies")).toEqual(["El Mundo de Sofía"]);
    expect(find({}, "organon")).toEqual(["Órganon"]);
    expect(find({}, "katzenbach loco")).toEqual(["La Historia del Loco"]);
    expect(find({}, "zzz")).toEqual([]);
  });

  it("combines menus with search", () => {
    expect(find({ status: "Done" })).toEqual(["La Historia del Loco", "How to Build Your Career in AI"]);
    expect(find({ status: "Done", genre: "Thriller" })).toEqual(["La Historia del Loco"]);
    expect(find({ author: "Aristotle" })).toEqual(["Órganon"]);
    expect(find({ year: "2004" }, "career")).toEqual([]);
  });

  it("offers only values that exist", () => {
    expect(facets(books)).toEqual({ authors: ["Aristotle", "Jostein Gaarder", "John Katzenbach", "Adrian McKinty", "Andrew Ng"], genres: ["Thriller"], years: ["2004"] });
  });
});

describe("filters in the address", () => {
  it("round-trips", () => {
    const filters = { ...NO_FILTERS, q: "plato s", status: "Done" as const, author: "René Descartes" };
    const query = toQuery(filters, "author");
    expect(query).toBe("?q=plato+s&author=Ren%C3%A9+Descartes&status=Done&sort=author");
    expect(fromQuery(query)).toEqual({ filters, sort: "author" });
  });

  it("is empty for the default view and ignores junk", () => {
    expect(toQuery(NO_FILTERS, "rank")).toBe("");
    expect(fromQuery("?status=Paused&sort=random&x=1")).toEqual({ filters: NO_FILTERS, sort: "rank" });
  });
});
